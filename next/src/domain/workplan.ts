import type { Project } from './types';
import { STANDARD_LINES } from './forecastTemplate';
import type { WorkbookSummary } from './workbook';

/** One quarterly Work Plan of a project, entered by hand from what the project team sends. */
export interface WpActivity { ref: string; id: string; name: string; amount: number; /** status column of the WorkPlan file (done / postponed / cancelled …) */ status?: string; start?: string; end?: string; lines: { line: string; text: string; amount: number }[] }
export interface WorkPlan { id: string; no: number; /** name used by older follow-up sheets (e.g. Q3-2024) when the WP had no number */ label?: string; from: string; to: string; planned: number; notes?: string; teams?: string; hoo?: string; /** activities read from the project's WorkPlan workbook */ acts?: WpActivity[]; file?: string; /** the report as it stood when the WP was prepared */ snap?: WpSnap; /** figures recorded in the follow-up table for this WP's own period (D and E of the next WP's sheet) */ rec?: { spent?: number; sc?: number } }

/** Activity spending and commitments frozen at the report the WP was prepared on. */
export interface WpSnap { asAt: string; file?: string; spent: number; sc: number; pos: { po: string; line: string; description: string; supplier: string; spent: number; sc: number }[] }

/** Headings left out of the activity budget: 1 staff costs, 4 local office (and 10 administrative costs). */
/** Staff salaries: the project team posts, 1.1.1 local team and 1.2.1 HQ team. Consultants (1.1.2/3, 1.2.2/3) and per diems (1.3) are activity costs. */
export const isSalary = (code: string) => /^1\.[12]\.1(\.|$)/.test(code);
/** Office costs: heading 4 (local office). */
export const isOffice = (code: string) => code.split('.')[0] === '4';
export const isActivity = (code: string) => !!code && !isSalary(code) && !isOffice(code) && !['10', '0'].includes(code.split('.')[0]) && code !== '1' && code !== '1.1' && code !== '1.2';

const r2 = (v: number) => Math.round(v * 100) / 100;
/** Months as the follow-up table counts them: ROUNDDOWN((to − from) / 30). */
export const months = (from: string, to: string) => (!from || !to ? 0 : Math.max(0, Math.floor((Date.parse(to) - Date.parse(from)) / 86400000 / 30)));

export interface WpFollowUp {
  wp: WorkPlan; prev?: WorkPlan; /** deduction typed by hand (follow-up table's own figure) instead of the budget's */ manual: boolean;
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
  const sumB = (f: (c: string) => boolean) => leaf.filter((l) => f(l.code)).reduce((s, l) => s + (l.budget.cost ?? 0), 0);
  const total = wb.totals.eligible?.budget || p.approvedBudget?.total || p.budget;
  const eligible = total / 1.07, staff = sumB(isSalary), office = sumB(isOffice);
  const activity = p.wpDeduct != null ? eligible - p.wpDeduct : eligible - staff - office;
  const act = leaf.filter((l) => isActivity(l.code));
  const spent = act.reduce((s, l) => s + (l.actual.cost ?? 0), 0), sc = act.reduce((s, l) => s + (l.sc ?? 0), 0);
  const prev = plans.filter((x) => x.no < wp.no).sort((a, b) => b.no - a.no)[0];
  let prevSpent: number | null = null, prevSc: number | null = null;
  if (prev && wb.entries?.length) {
    const inR = (d: string) => d >= prev.from && d <= prev.to;
    prevSpent = wb.entries.filter((e) => inR(e.date) && isActivity(e.line)).reduce((s, e) => s + e.amount, 0);
    prevSc = prevSpent + wb.pos.filter((x) => inR(x.date) && isActivity(x.line)).reduce((s, x) => s + Math.max(0, x.sc - x.spent), 0);
  }
  if (prev?.rec) { if (prevSpent == null && prev.rec.spent != null) prevSpent = prev.rec.spent; if (prevSc == null && prev.rec.sc != null) prevSc = prev.rec.sc; }
  const elapsedTo = dayBefore(wp.from);
  const asAt = wb.meta.situationDate || wb.meta.asAt || '';
  return {
    wp, prev, manual: p.wpDeduct != null, total: r2(total), eligible: r2(eligible), staff: r2(staff), office: r2(office), activity: r2(activity),
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
  const cRef = col(/logframe/i), cId = col(/activity id/i), cName = col(/activity name/i), cLine = col(/budget line/i), cPo = col(/^po/i), cAmt = col(/estimated budget/i), cSt = col(/^status/i), cS = col(/^start/i), cE = col(/^end/i);
  const bhRow = rows.slice(0, hi).find((r) => r.some((c) => /budget head/i.test(c ?? '')));
  const bh = (bhRow?.slice(bhRow.findIndex((c) => /budget head/i.test(c ?? '')) + 1).find((c) => /\d/.test(c ?? '')) ?? '').trim();
  const acts: WpActivity[] = []; let grand = 0, cur: WpActivity | undefined;
  for (const r of rows.slice(hi + 1)) {
    if (/grand total/i.test(r[0] ?? '')) { grand = amt(r[cAmt]); break; }
    if (r[cId] && /\d/.test(r[cId])) { cur = { ref: r[cRef] ?? '', id: String(r[cId]).trim(), name: (r[cName] ?? '').trim(), amount: 0, lines: [], ...(cSt >= 0 && r[cSt]?.trim() ? { status: r[cSt].trim() } : {}), ...(cS >= 0 && r[cS]?.trim() ? { start: r[cS].trim() } : {}), ...(cE >= 0 && r[cE]?.trim() ? { end: r[cE].trim() } : {}) }; acts.push(cur); }
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
    let spent: number | null = wp.rec?.spent ?? null, sc: number | null = wp.rec?.sc ?? null;
    if (spent == null && wb.entries?.length && wp.from && wp.to) {
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
export interface WpLine { line: string; description: string; /** the line has no budget in the report */ unbudgeted: boolean; planned: number; budget: number; sc: number; left: number; after: number }
export function byLine(wp: WorkPlan, wb: WorkbookSummary): WpLine[] {
  const M = new Map<string, number>();
  for (const a of wp.acts ?? []) for (const l of a.lines) if (l.amount) M.set(l.line, (M.get(l.line) ?? 0) + l.amount);
  return [...M].map(([line, planned]) => {
    const L = wb.lines.find((x) => x.code === line);
    const budget = L?.budget.cost ?? 0, sc = L?.sc ?? 0;
    return { line, description: L?.description || STANDARD_LINES.find((x) => x[0] === line)?.[1] || '', unbudgeted: !budget, planned: r2(planned), budget: r2(budget), sc: r2(sc), left: r2(budget - sc), after: r2(budget - sc - planned) };
  }).sort((a, b) => a.line.localeCompare(b.line, undefined, { numeric: true }));
}

export function snapshot(wb: WorkbookSummary): WpSnap {
  const act = wb.lines.filter((l) => l.leaf && isActivity(l.code));
  return { asAt: wb.meta.situationDate || wb.meta.asAt || '', file: wb.fileName, spent: r2(act.reduce((s, l) => s + (l.actual.cost ?? 0), 0)), sc: r2(act.reduce((s, l) => s + (l.sc ?? 0), 0)),
    pos: wb.pos.filter((x) => isActivity(x.line)).map((x) => ({ po: x.po, line: x.line, description: x.description, supplier: x.supplier, spent: r2(x.spent), sc: r2(x.sc) })) };
}

/** What became of the commitments open when a WP was prepared, in a later report: spent since, still open, released (cancelled / reduced). */
export type RollKind = 'spent' | 'partly' | 'open' | 'released';
export interface RollRow { po: string; line: string; description: string; supplier: string; open: number; spentSince: number; stillOpen: number; released: number; kind: RollKind }
export interface Rollover { from: string; to: string; open: number; spentSince: number; stillOpen: number; released: number; rows: RollRow[]; newPos: { po: string; line: string; description: string; supplier: string; spent: number; open: number }[]; spentGrowth: number; scGrowth: number }
export function rollover(snap: WpSnap, wb: WorkbookSummary): Rollover {
  const now = new Map(wb.pos.map((x) => [x.po + '|' + x.line, x]));
  const rows: RollRow[] = [];
  for (const s of snap.pos) {
    const open = s.sc - s.spent; if (open <= 0.5) continue;
    const x = now.get(s.po + '|' + s.line);
    const spentSince = Math.min(open, Math.max(0, (x?.spent ?? s.spent) - s.spent)), stillOpen = x ? Math.max(0, Math.min(open - spentSince, x.sc - x.spent)) : 0;
    const released = Math.max(0, open - spentSince - stillOpen);
    const kind: RollKind = spentSince >= open - 0.5 ? 'spent' : released > 0.5 && spentSince < 0.5 && stillOpen < 0.5 ? 'released' : spentSince > 0.5 ? 'partly' : stillOpen > 0.5 ? 'open' : 'released';
    rows.push({ po: s.po, line: s.line, description: s.description, supplier: s.supplier, open: r2(open), spentSince: r2(spentSince), stillOpen: r2(stillOpen), released: r2(released), kind });
  }
  const had = new Set(snap.pos.map((s) => s.po + '|' + s.line));
  const newPos = wb.pos.filter((x) => isActivity(x.line) && !had.has(x.po + '|' + x.line)).map((x) => ({ po: x.po, line: x.line, description: x.description, supplier: x.supplier, spent: r2(x.spent), open: r2(Math.max(0, x.sc - x.spent)) }));
  const t = (k: keyof RollRow) => r2(rows.reduce((a, r) => a + (r[k] as number), 0)), cur = snapshot(wb);
  return { from: snap.asAt, to: cur.asAt, open: t('open'), spentSince: t('spentSince'), stillOpen: t('stillOpen'), released: t('released'), rows: rows.sort((a, b) => b.open - a.open), newPos: newPos.sort((a, b) => b.spent + b.open - a.spent - a.open), spentGrowth: r2(cur.spent - snap.spent), scGrowth: r2(cur.sc - snap.sc) };
}

/** One sheet of the FOMA follow-up table (2026 layout): "WP No:n - dd.mm.yyyy / dd.mm.yyyy", planned, C/D/E of the previous WP, notes. */
export interface TableSheet { sheet: string; title: string; no: number; label?: string; from: string; to: string; planned: number; deduct: number | null; total: number | null;
  prev?: { no: number; label?: string; from: string; to: string; planned: number; spent: number | null; sc: number | null }; notes: string; teams: string; hoo: string }
const dot = (t: string) => { const m = /(\d{1,2})[./](\d{1,2})[./](\d{4})/.exec(t); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''; };
const two = (t: string) => { const m = /(\d{1,2}[./]\d{1,2}[./]\d{4})\s*[\/–-]\s*(\d{1,2}[./]\d{1,2}[./]\d{4})/.exec(t); return m ? [dot(m[1]), dot(m[2])] : ['', '']; };
export function readTableSheet(sheet: string, rows: string[][]): TableSheet | null {
  const n = readNewSheet(sheet, rows); return n ?? readOldSheet(sheet, rows);
}
function readNewSheet(sheet: string, rows: string[][]): TableSheet | null {
  const cell = (re: RegExp) => rows.find((r) => r.some((c) => re.test(c ?? '')));
  const val = (r?: string[]) => { if (!r) return null; const i = r.findIndex((c) => /[a-z]/i.test(c ?? '')); const v = r.slice(i + 1).find((c) => c != null && c !== '' && Number.isFinite(amt(c)) && /\d/.test(c)); return v == null ? null : amt(v); };
  const all = rows.flat().filter(Boolean).join('\n');
  const head = /WP\s*No\s*:?\s*(\d+)\s*-\s*([\d.\/]+\s*\/\s*[\d.\/]+)/i.exec(all);
  const plannedRow = cell(/Activity Planned Expenditure/i);
  if (!head || !plannedRow) return null;
  const [from, to] = two(head[2]);
  if (!from) return null;
  const elig = val(cell(/Total Eligible Budget/i)), act = val(cell(/Total Activity Budget/i));
  const C = cell(/^\s*C\s*[–-]\s*Previous WP/i), D = cell(/^\s*D\s*[–-]\s*Previous WP/i), E = cell(/^\s*E\s*[–-]\s*Previous WP/i);
  const first = /first WP/i.test(all);
  let prev: TableSheet['prev'];
  if (C && !first) {
    const lab = C.find((c) => /Previous WP/i.test(c ?? '')) ?? '', [pf, pt] = two(lab), pn = Number(/WP\s*No\s*:?\s*(\d+)/i.exec(lab)?.[1] ?? 0);
    const num = (r?: string[]) => { if (!r) return null; const i = r.findIndex((c) => /Previous WP/i.test(c ?? '')); const v = r.slice(i + 1).find((c) => /\d/.test(c ?? '') && !/%/.test(c ?? '')); return v == null ? null : amt(v); };
    if (pn) prev = { no: pn, from: pf, to: pt, planned: num(C) ?? 0, spent: num(D), sc: num(E) };
  }
  const text = (re: RegExp) => { const c = rows.flat().find((x) => re.test(x ?? '')) ?? ''; return c.replace(re, '').replace(/^[\s:-]+/, '').trim(); };
  return { sheet, title: (rows[0]?.find(Boolean) ?? '').split('\n')[0].trim(), no: Number(head[1]), from, to, planned: val(plannedRow) ?? 0,
    deduct: elig != null && act != null ? r2(elig - act) : null, total: val(cell(/Total Project Budget/i)), prev,
    notes: text(/^FOMA NOTES:?/i), teams: text(/^Project Teams\s*-\s*Comments:?/i), hoo: text(/^Head of Operations\s*-\s*Comments:?/i) };
}

/** Which project a sheet belongs to: BH number in the sheet name or title, else the project code number in the title. */
export function matchProject<T extends { bh?: string; code: string; name: string }>(ps: T[], t: TableSheet): T | undefined {
  const digits = (x?: string) => (x ?? '').replace(/\D/g, '');
  const bh = /BH\s*(\d{4})/i.exec(t.sheet + ' ' + t.title)?.[1] ?? /^(\d{4})\b/.exec(t.sheet.trim())?.[1];
  if (bh) { const p = ps.find((x) => digits(x.bh) === bh || digits(x.bh).endsWith(bh)); if (p) return p; }
  const code = /^(?:BH\s*\d{4}\s*-\s*)?(\d{4})\b/i.exec(t.title)?.[1];
  return code ? ps.find((x) => digits(x.code) === code || x.code.includes(code) || x.name.startsWith(code)) : undefined;
}

/** Merges the sheets of one project into its Work Plans: each sheet's WP, and its previous WP (planned, D and E) when missing. */
export function mergeTable(plans: WorkPlan[], sheets: TableSheet[]): WorkPlan[] {
  const out = [...plans];
  const id = () => Math.random().toString(36).slice(2, 10);
  const put = (no: number, patch: Partial<WorkPlan>, keep: boolean) => {
    // the period identifies a WP (sheets sometimes repeat a number); the number only when no dates are given
    let i = patch.from ? out.findIndex((w) => w.from === patch.from) : -1;
    if (i < 0 && no > 0) i = out.findIndex((w) => w.no === no && (!patch.from || !w.from || w.from === patch.from));
    if (i < 0 && no > 0 && out.some((w) => w.no === no)) no = Math.max(...out.map((w) => w.no)) + 1;
    if (i < 0 && no <= 0) no = 0;
    if (i < 0) out.push({ id: id(), no, from: '', to: '', planned: 0, ...patch });
    else out[i] = keep ? { ...patch, ...out[i], rec: { ...patch.rec, ...out[i].rec } } : { ...out[i], ...patch };
  };
  for (const t of [...sheets].sort((a, b) => a.no - b.no || a.from.localeCompare(b.from))) {
    put(t.no, { ...(t.label ? { label: t.label } : {}), from: t.from, to: t.to, planned: t.planned, notes: t.notes || undefined, teams: t.teams || undefined, hoo: t.hoo || undefined }, false);
    if (t.prev) put(t.prev.no, { ...(t.prev.label ? { label: t.prev.label } : {}), from: t.prev.from, to: t.prev.to, planned: t.prev.planned, rec: { ...(t.prev.spent != null ? { spent: t.prev.spent } : {}), ...(t.prev.sc != null ? { sc: t.prev.sc } : {}) } }, true);
  }
  // recorded D/E always come from the later sheet
  for (const t of sheets) if (t.prev) { const w = out.find((x) => (t.prev!.from && x.from === t.prev!.from)) ?? (t.prev.no > 0 ? out.find((x) => x.no === t.prev!.no) : undefined); if (!w) continue; w.rec = { ...w.rec, ...(t.prev.spent != null ? { spent: t.prev.spent } : {}), ...(t.prev.sc != null ? { sc: t.prev.sc } : {}) }; }
  // WPs without a number (older sheets) go before the numbered ones, in date order
  const un = out.filter((w) => w.no <= 0).sort((a, b) => a.from.localeCompare(b.from)), num = out.filter((w) => w.no > 0);
  const firstNumbered = num.length ? Math.min(...num.map((w) => w.no)) : 1;
  const numberedFrom = num.length ? num.reduce((a, w) => (w.no === firstNumbered ? w.from : a), '') : '9999';
  un.forEach((w, i) => { w.no = firstNumbered - un.length + i; if (w.from > numberedFrom) w.no = Math.max(...out.map((x) => x.no)) + 1; });
  return out.sort((a, b) => a.no - b.no);
}
/** How a WP is named on screen: its number, or the quarter label of an older sheet. */
export const wpName = (w: WorkPlan) => (w.label && w.no <= 0 ? `WP ${w.label}` : `WP ${w.no}`);

/** The previous WP's activities and what became of them: carried into this WP (not done), marked done/cancelled in a WorkPlan file, or not mentioned again. */
export type ActFate = 'carried' | 'done' | 'cancelled' | 'postponed' | 'unknown';
export interface PrevAct { a: WpActivity; fate: ActFate; note: string; now?: WpActivity }
export function previousActivities(plans: WorkPlan[], wp: WorkPlan): { prev?: WorkPlan; rows: PrevAct[] } {
  const prev = plans.filter((x) => x.no < wp.no).sort((a, b) => b.no - a.no)[0];
  if (!prev?.acts?.length) return { prev, rows: [] };
  const later = plans.filter((x) => x.no > prev.no).flatMap((x) => x.acts ?? []);
  const rows = prev.acts.map((a): PrevAct => {
    const now = (wp.acts ?? []).find((x) => x.id === a.id), st = [now?.status, ...later.filter((x) => x.id === a.id).map((x) => x.status), a.status].find(Boolean) ?? '';
    const fate: ActFate = /cancel|iptal/i.test(st) ? 'cancelled' : now ? 'carried' : /postpon|ertelen|modif/i.test(st) ? 'postponed' : /\bdone\b|complet|tamam|implemented|held|organi[sz]ed/i.test(st) ? 'done' : 'unknown';
    return { a, fate, note: st, now };
  });
  return { prev, rows: rows.sort((x, y) => ['carried', 'postponed', 'cancelled', 'unknown', 'done'].indexOf(x.fate) - ['carried', 'postponed', 'cancelled', 'unknown', 'done'].indexOf(y.fate) || y.a.amount - x.a.amount) };
}

/** Excel serial day or dd/mm/yyyy text → YYYY-MM-DD. */
const xdate = (v: string | undefined) => { const t = (v ?? '').trim(); if (/^\d{5}(\.\d+)?$/.test(t)) return new Date(Date.UTC(1899, 11, 30) + Math.floor(+t) * 86400000).toISOString().slice(0, 10); return dot(t); };
const quarter = (from: string) => (from ? `Q${Math.floor((+from.slice(5, 7) - 1) / 3) + 1}-${from.slice(0, 4)}` : '');

/** 2023–2025 layout: "C- Current WP amount", "Period of WP" (dates in the next cells), "B – … WP Amount" and "B'' – Spending amount according to WP" for the previous plan. No WP numbers. */
function readOldSheet(sheet: string, rows0: string[][]): TableSheet | null {
  const rows = rows0.map((r) => r.slice(0, 9));
  const find = (re: RegExp) => rows.find((r) => re.test(r[0] ?? '') || re.test(r[1] ?? ''));
  const val = (r?: string[]) => { if (!r) return null; const v = r.slice(2).find((c) => /^-?[\d.,]+$/.test((c ?? '').trim())); return v == null ? null : amt(v); };
  const cur = find(/Current WP amount/i);
  if (!cur) return null;
  let [from, to] = two(cur[0] ?? '');
  const per = find(/^Period of WP/i);
  if (!from && per) { const ds = per.slice(1).map(xdate).filter(Boolean); if (ds.length >= 2) [from, to] = ds; else [from, to] = two(per.slice(1).join(' ')); }
  if (!from) return null;
  const label = per?.find((c) => /^Q\d/i.test((c ?? '').trim()))?.trim() || quarter(from);
  const bAmt = rows.find((r) => /^B\s*[–-]/.test(r[0] ?? '') && /WP Amount/i.test(r[0] ?? '')), bSp = find(/^B''/);
  let prev: TableSheet['prev'];
  if (bAmt) { const [pf, pt] = two(bAmt[0]); const q = /(Q\d)\s*-\s*(\d{4})|(\d{4})\s*-\s*(Q\d)/i.exec(bAmt[0]); const pl = q ? `${(q[1] ?? q[4]).toUpperCase()}-${q[2] ?? q[3]}` : quarter(pf);
    if (pf) prev = { no: 0, label: pl, from: pf, to: pt, planned: val(bAmt) ?? 0, spent: val(bSp) == null ? null : r2(val(bSp)!), sc: null }; }
  const text = (re: RegExp) => { const c = rows.flat().find((x) => re.test(x ?? '')) ?? ''; return c.replace(re, '').replace(/^[\s:-]+/, '').trim(); };
  const tot = val(find(/^Total Budget/i));
  return { sheet, title: (rows[0]?.find(Boolean) ?? '').split('\n')[0].trim(), no: 0, label, from, to, planned: val(cur) ?? 0, deduct: null, total: tot, prev,
    notes: text(/^FOMA (NOTES|Comments)[^:]*:?/i), teams: text(/^Project Teams?\s*-\s*Comments:?/i), hoo: text(/^Head of Operation'?s?\s*-?\s*'?s?\s*Comments:?/i) };
}

/** Checks of a WorkPlan file against itself and the budget: line codes, unit rates, quantity × rate against the amount, dates. */
export interface WpCheck { level: 'error' | 'warning'; act?: string; line?: string; text: string }
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const TR = ['oca', 'şub', 'mar', 'nis', 'may', 'haz', 'tem', 'ağu', 'eyl', 'eki', 'kas', 'ara'];
const monthOf = (t: string) => { const x = t.toLowerCase().trim(); const d = dmy(x); if (d) return +d.slice(5, 7); let i = MONTHS.findIndex((m) => x.startsWith(m)); if (i < 0) i = TR.findIndex((m) => x.startsWith(m)); return i < 0 ? 0 : i + 1; };
export function wpChecks(wp: WorkPlan, wb: WorkbookSummary): WpCheck[] {
  const out: WpCheck[] = [], missing = new Map<string, { amount: number; acts: Set<string> }>();
  const leaf = new Map(wb.lines.filter((l) => l.leaf).map((l) => [l.code, l]));
  const fm = wp.from ? +wp.from.slice(5, 7) : 0, tm = wp.to ? +wp.to.slice(5, 7) : 0, wrap = fm > tm;
  const inWp = (m: number) => !m || !fm || (wrap ? m >= fm || m <= tm : m >= fm && m <= tm);
  for (const a of wp.acts ?? []) {
    for (const l of a.lines) {
      if (!l.amount) continue;
      const L = leaf.get(l.line);
      if (wb.lines.length && !L) { const o = missing.get(l.line) ?? { amount: 0, acts: new Set<string>() }; o.amount += l.amount; o.acts.add(a.id); missing.set(l.line, o); }
      const m = /([\d.,]+)\s*\*\s*([\d.,]+)/.exec(l.text);
      if (m) {
        const q = amt(m[1]), rate = amt(m[2]);
        if (q && rate && Math.abs(q * rate - l.amount) > 0.5) out.push({ level: 'error', act: a.id, line: l.line, text: `${l.line}: ${m[1]} × ${m[2]} = ${full2(q * rate)} but the amount is ${full2(l.amount)}` });
        const br = L?.budget.rate;
        if (br && rate && Math.abs(rate - br) > 0.01 && rate > br && !out.some((c) => c.line === l.line && /unit rate/.test(c.text) && c.text.includes(full2(rate)))) out.push({ level: 'warning', act: a.id, line: l.line, text: `${l.line}: unit rate ${full2(rate)} is above the budgeted ${full2(br)}` });
      }
      if (L && L.budget.cost != null && L.sc != null && l.amount > (L.budget.cost - L.sc) + 0.5) out.push({ level: 'warning', act: a.id, line: l.line, text: `${l.line}: ${full2(l.amount)} planned but only ${full2(L.budget.cost - L.sc)} left on the line` });
    }
    const sm = a.start ? monthOf(a.start) : 0, em = a.end ? monthOf(a.end) : 0;
    if (!inWp(sm) || !inWp(em)) out.push({ level: 'warning', act: a.id, text: `dates ${a.start ?? ''} – ${a.end ?? ''} fall outside the WP period` });
    const sum = r2(a.lines.reduce((s, l) => s + l.amount, 0));
    if (a.lines.length && Math.abs(sum - a.amount) > 0.5) out.push({ level: 'error', act: a.id, text: `activity total ${full2(a.amount)} differs from the sum of its lines ${full2(sum)}` });
  }
  for (const [line, o] of missing) out.unshift({ level: 'error', line, text: `line ${line} is not a budget line of the project — ${full2(o.amount)} planned in ${o.acts.size} activit${o.acts.size > 1 ? 'ies' : 'y'} (${[...o.acts].join(', ')})` });
  const ids = new Map<string, number>(); for (const a of wp.acts ?? []) ids.set(a.id, (ids.get(a.id) ?? 0) + 1);
  for (const [id, n] of ids) if (n > 1) out.push({ level: 'warning', act: id, text: `activity ${id} appears ${n} times` });
  return out;
}
const full2 = (v: number) => '€' + v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** The WP's plan by line against the purchase orders raised since the WP started (activity id in the PO text when given). */
export interface PoMatch { line: string; planned: number; raised: number; pos: { po: string; description: string; supplier: string; amount: number; date: string }[]; acts: string[] }
export function poMatch(wp: WorkPlan, wb: WorkbookSummary): PoMatch[] {
  const M = new Map<string, PoMatch>();
  for (const a of wp.acts ?? []) for (const l of a.lines) if (l.amount) { const x = M.get(l.line) ?? { line: l.line, planned: 0, raised: 0, pos: [], acts: [] }; x.planned += l.amount; if (!x.acts.includes(a.id)) x.acts.push(a.id); M.set(l.line, x); }
  for (const p of wb.pos) {
    if (!wp.from || p.date < wp.from || (wp.to && p.date > wp.to)) continue;
    const x = M.get(p.line); if (!x) continue;
    x.raised += p.sc; x.pos.push({ po: p.po, description: p.description, supplier: p.supplier, amount: r2(p.sc), date: p.date });
  }
  return [...M.values()].map((x) => ({ ...x, planned: r2(x.planned), raised: r2(x.raised) })).sort((a, b) => a.line.localeCompare(b.line, undefined, { numeric: true }));
}
