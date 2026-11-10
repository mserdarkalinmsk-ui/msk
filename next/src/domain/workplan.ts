import type { Project } from './types';
import type { WorkbookSummary } from './workbook';

/** One quarterly Work Plan of a project, entered by hand from what the project team sends. */
export interface WpActivity { ref: string; id: string; name: string; amount: number; lines: { line: string; text: string; amount: number }[] }
export interface WorkPlan { id: string; no: number; from: string; to: string; planned: number; notes?: string; teams?: string; hoo?: string; /** activities read from the project's WorkPlan workbook */ acts?: WpActivity[]; file?: string }

/** Headings left out of the activity budget: 1 staff costs, 4 local office (and 10 administrative costs). */
const NOT_ACTIVITY = new Set(['1', '4', '10', '0']);
export const isActivity = (code: string) => !!code && !NOT_ACTIVITY.has(code.split('.')[0]);

const r2 = (v: number) => Math.round(v * 100) / 100;
/** Months as the follow-up table counts them: ROUNDDOWN((to − from) / 30). */
export const months = (from: string, to: string) => (!from || !to ? 0 : Math.max(0, Math.floor((Date.parse(to) - Date.parse(from)) / 86400000 / 30)));

export interface WpFollowUp {
  wp: WorkPlan; prev?: WorkPlan;
  total: number; eligible: number; staff: number; office: number; activity: number;
  start: string; end: string; duration: number;
  elapsedFrom: string; elapsedTo: string; elapsed: number;
  asAt: string; spent: number; sc: number;
  prevSpent: number | null; prevSc: number | null;
  remaining: number; remainingMonths: number;
}

/**
 * Work Plan follow-up for `wp`, from the latest report workbook:
 *  total budget, eligible (total less the 7% administrative costs), activity budget (eligible less staff costs, heading 1,
 *  and local office costs, heading 4); A/B activity spent and spent + committed at the report date; C the previous WP's plan;
 *  D activity spent in the previous WP's dates (dated postings), E that plus the open balance of POs raised in those dates;
 *  remaining = activity budget − B − this WP's plan.
 */
export function followUp(p: Project, wb: WorkbookSummary, wp: WorkPlan, plans: WorkPlan[]): WpFollowUp {
  const leaf = wb.lines.filter((l) => l.leaf);
  const head = (h: string) => leaf.filter((l) => l.code.split('.')[0] === h).reduce((s, l) => s + (l.budget.cost ?? 0), 0);
  const total = wb.totals.eligible?.budget || p.approvedBudget?.total || p.budget;
  const eligible = total / 1.07, staff = head('1'), office = head('4'), activity = eligible - staff - office;
  const act = leaf.filter((l) => isActivity(l.code));
  const spent = act.reduce((s, l) => s + (l.actual.cost ?? 0), 0), sc = act.reduce((s, l) => s + (l.sc ?? 0), 0);
  const prev = plans.filter((x) => x.no < wp.no).sort((a, b) => b.no - a.no)[0];
  let prevSpent: number | null = null, prevSc: number | null = null;
  if (prev && wb.entries?.length) {
    const inR = (d: string) => d >= prev.from && d <= prev.to;
    prevSpent = wb.entries.filter((e) => inR(e.date) && isActivity(e.line)).reduce((s, e) => s + e.amount, 0);
    prevSc = prevSpent + wb.pos.filter((x) => inR(x.date) && isActivity(x.line)).reduce((s, x) => s + Math.max(0, x.sc - x.spent), 0);
  }
  const elapsedTo = dayBefore(wp.from);
  const asAt = wb.meta.situationDate || wb.meta.asAt || '';
  return {
    wp, prev, total: r2(total), eligible: r2(eligible), staff: r2(staff), office: r2(office), activity: r2(activity),
    start: p.start, end: p.end, duration: months(p.start, p.end),
    elapsedFrom: p.start, elapsedTo, elapsed: months(p.start, wp.from),
    asAt, spent: r2(spent), sc: r2(sc), prevSpent: prevSpent == null ? null : r2(prevSpent), prevSc: prevSc == null ? null : r2(prevSc),
    remaining: r2(activity - sc - wp.planned), remainingMonths: Math.max(0, months(p.start, p.end) - months(p.start, wp.from) - Math.max(1, months(wp.from, dayAfter(wp.to)))),
  };
}
const shift = (d: string, n: number) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const dayBefore = (d: string) => (d ? shift(d, -1) : ''), dayAfter = (d: string) => (d ? shift(d, 1) : '');

/** The quarter after the last plan (or the current quarter), numbered after it. */
export function nextPlan(plans: WorkPlan[], today: Date): WorkPlan {
  const last = [...plans].sort((a, b) => b.no - a.no)[0];
  const from = last ? dayAfter(last.to) : `${today.getUTCFullYear()}-${String(Math.floor(today.getUTCMonth() / 3) * 3 + 1).padStart(2, '0')}-01`;
  const f = new Date(from + 'T00:00:00Z'), to = new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth() + 3, 0)).toISOString().slice(0, 10);
  return { id: Math.random().toString(36).slice(2, 10), no: (last?.no ?? 0) + 1, from, to, planned: 0 };
}

const dmy = (t: string) => { const m = /(\d{1,2})[./](\d{1,2})[./](\d{4})/.exec(t); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''; };
const amt = (v: string) => { const x = Number(String(v ?? '').replace(/[€\s]/g, '').replace(/,(?=\d{1,2}$)/, '.').replace(/,/g, '')); return Number.isFinite(x) ? x : 0; };

/** Reads the project team's WorkPlan workbook ("Work plan for project … from dd/mm/yyyy to dd/mm/yyyy"): period, budget head, activities and the grand total. */
export function readWorkPlan(rows: string[][]): { from: string; to: string; bh: string; planned: number; acts: WpActivity[] } | null {
  const title = rows.slice(0, 3).flat().find((c) => /work\s*plan.*from.*to/i.test(c ?? ''));
  const hi = rows.findIndex((r) => r.some((c) => /estimated budget/i.test(c ?? '')) && r.some((c) => /budget line/i.test(c ?? '')));
  if (!title || hi < 0) return null;
  const [, f, t] = /from\s+(\S+)\s+to\s+(\S+)/i.exec(title) ?? [];
  const H = rows[hi], col = (re: RegExp) => H.findIndex((c) => re.test(c ?? ''));
  const cRef = col(/logframe/i), cId = col(/activity id/i), cName = col(/activity name/i), cLine = col(/budget line/i), cPo = col(/^po/i), cAmt = col(/estimated budget/i);
  const bhRow = rows.slice(0, hi).find((r) => r.some((c) => /budget head/i.test(c ?? '')));
  const bh = (bhRow?.slice(bhRow.findIndex((c) => /budget head/i.test(c ?? '')) + 1).find((c) => /\d/.test(c ?? '')) ?? '').trim();
  const acts: WpActivity[] = []; let grand = 0, cur: WpActivity | undefined;
  for (const r of rows.slice(hi + 1)) {
    if (/grand total/i.test(r[0] ?? '')) { grand = amt(r[cAmt]); break; }
    if (r[cId] && /\d/.test(r[cId])) { cur = { ref: r[cRef] ?? '', id: String(r[cId]).trim(), name: (r[cName] ?? '').trim(), amount: 0, lines: [] }; acts.push(cur); }
    if (!cur) continue;
    if (/total activity/i.test(r[cPo] ?? '')) { cur.amount = amt(r[cAmt]) || cur.lines.reduce((s, l) => s + l.amount, 0); continue; }
    if (r[cLine] && /^\d/.test(r[cLine])) cur.lines.push({ line: r[cLine].trim(), text: r[cPo] ?? '', amount: amt(r[cAmt]) });
  }
  for (const a of acts) if (!a.amount) a.amount = a.lines.reduce((s, l) => s + l.amount, 0);
  return { from: dmy(f ?? ''), to: dmy(t ?? ''), bh, planned: r2(grand || acts.reduce((s, a) => s + a.amount, 0)), acts };
}

/** Each Work Plan against what was posted in its own dates: activity spent (invoices + GL) and the open balance of POs raised then. */
export interface WpHistoryRow { wp: WorkPlan; spent: number | null; sc: number | null; spentPct: number | null; scPct: number | null; acts: number; carried: number }
export function history(plans: WorkPlan[], wb: WorkbookSummary): WpHistoryRow[] {
  const sorted = [...plans].sort((a, b) => a.no - b.no);
  return sorted.map((wp, i) => {
    let spent: number | null = null, sc: number | null = null;
    if (wb.entries?.length && wp.from && wp.to) {
      const inR = (d: string) => d >= wp.from && d <= wp.to;
      spent = wb.entries.filter((e) => inR(e.date) && isActivity(e.line)).reduce((s, e) => s + e.amount, 0);
      sc = spent + wb.pos.filter((x) => inR(x.date) && isActivity(x.line)).reduce((s, x) => s + Math.max(0, x.sc - x.spent), 0);
    }
    const before = new Set(sorted.slice(0, i).flatMap((w) => (w.acts ?? []).map((a) => a.id)));
    return { wp, spent: spent == null ? null : r2(spent), sc: sc == null ? null : r2(sc), spentPct: spent == null || !wp.planned ? null : spent / wp.planned, scPct: sc == null || !wp.planned ? null : sc / wp.planned, acts: wp.acts?.length ?? 0, carried: (wp.acts ?? []).filter((a) => before.has(a.id)).length };
  });
}

/** Earlier Work Plans that already held the same activity ID (carried over, not yet delivered). */
export function carriedFrom(plans: WorkPlan[], wp: WorkPlan): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const w of plans) if (w.no < wp.no) for (const a of w.acts ?? []) if (a.amount && (wp.acts ?? []).some((x) => x.id === a.id)) out.set(a.id, [...(out.get(a.id) ?? []), w.no]);
  return out;
}

/** This Work Plan's estimates by budget line, against what is left on that line (budget − spent & committed) in the report. */
export interface WpLine { line: string; description: string; planned: number; budget: number; sc: number; left: number; after: number }
export function byLine(wp: WorkPlan, wb: WorkbookSummary): WpLine[] {
  const M = new Map<string, number>();
  for (const a of wp.acts ?? []) for (const l of a.lines) if (l.amount) M.set(l.line, (M.get(l.line) ?? 0) + l.amount);
  return [...M].map(([line, planned]) => {
    const L = wb.lines.find((x) => x.code === line);
    const budget = L?.budget.cost ?? 0, sc = L?.sc ?? 0;
    return { line, description: L?.description ?? '', planned: r2(planned), budget: r2(budget), sc: r2(sc), left: r2(budget - sc), after: r2(budget - sc - planned) };
  }).sort((a, b) => a.line.localeCompare(b.line, undefined, { numeric: true }));
}
