/* What the assistant may read: the app's own figures, through the same functions every screen uses. Each tool returns
   small plain data; nothing here writes. Amounts are euros rounded to cents; dates are ISO (YYYY-MM-DD). */
import type { Project } from '../domain/types';
import type { WorkbookSummary } from '../domain/workbook';
import { elapsed, lines, money } from '../domain/calc';
import { alerts as allAlerts } from '../domain/insights';
import { openAlerts } from '../domain/worklist';
import { closeRows } from '../domain/close';
import { activityUse, followUp, previousActivities, wpName, wpUse } from '../domain/workplan';
import { latestWorkbook } from '../pages/FinancialReport';
import { roster } from '../domain/staff';
import { TODAY } from '../today';
import { get } from '../data/store';

const r2 = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 100) / 100);
const pc = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null);
const label = (p: Project) => (p.bh ? `BH ${p.bh}` : p.code);

/** Finds a project from what the model wrote: id, code, BH number ("5235", "BH5235", "BH 5235") or part of the name. */
export function findProject(q: unknown): Project {
  const P = get().ledger.projects, s = String(q ?? '').trim().toLowerCase();
  const d = s.replace(/\D/g, '');
  const hit = P.find((p) => p.id.toLowerCase() === s || p.code.toLowerCase() === s)
    ?? (d.length >= 4 ? P.find((p) => (p.bh ?? '').replace(/\D/g, '') === d || p.code.replace(/\D/g, '') === d || (p.jp ?? '').replace(/\D/g, '') === d || (p.pmm ?? '') === d) : undefined)
    ?? (s.length >= 4 ? P.find((p) => p.name.toLowerCase().includes(s)) : undefined);
  if (!hit) throw new Error(`No project matches "${q}". Call list_projects to see the projects.`);
  return hit;
}
const wbOf = (p: Project): { wb: WorkbookSummary; date: string; file?: string } | null => {
  const r = latestWorkbook(p); const wb = r?.snapshot?.workbook as WorkbookSummary | undefined;
  return wb ? { wb, date: wb.meta.situationDate || wb.meta.asAt || r!.date, file: wb.fileName } : null;
};
const lim = (v: unknown, d: number, max: number) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.min(max, Math.floor(n)) : d; };

export interface AiTool { name: string; description: string; inputSchema?: { type: 'object'; properties?: Record<string, unknown>; required?: string[] }; run(input: Record<string, unknown>): unknown; /** what the panel shows while it runs */ say(input: Record<string, unknown>): string }

const PROJECT = { project: { type: 'string', description: 'Project: BH number (e.g. "5235"), code, id or part of the name' } };

export const TOOLS: AiTool[] = [
  {
    name: 'list_projects',
    description: 'All projects with budget, spent, committed, spent + committed, remaining, % spent, % of time gone, pace gap (points), dates, latest report date and open alerts. Call first to find a project or compare projects.',
    say: () => 'Reading the portfolio',
    run: () => {
      const L = get().ledger, open = openAlerts(allAlerts(L.projects, TODAY), L.alertMarks, TODAY);
      return L.projects.map((p) => {
        const m = money(p), t = elapsed(p, TODAY), w = wbOf(p);
        return { project: label(p), id: p.id, name: p.name, country: L.countries.find((c) => c.id === p.country)?.name ?? p.country, sector: p.sector ?? null, programme: p.programme ?? null,
          start: p.start, end: p.end, budget: r2(m.budget), spent: r2(m.spent), committed: r2(m.committed), spentAndCommitted: r2(m.exposure), remaining: r2(m.remaining),
          spentPct: pc(m.spent, m.budget), timePct: Math.round(t * 1000) / 10, paceGapPoints: m.budget ? Math.round((m.spent / m.budget - t) * 1000) / 10 : null,
          latestReport: w?.date ?? null, openAlerts: open.filter((a) => a.projectId === p.id).length, workPlans: p.workPlans?.length ?? 0 };
      });
    },
  },
  {
    name: 'budget_lines',
    description: 'Budget lines of one project from its latest report: code, description, approved budget, spent, spent + committed, left (approved − spent & committed) and % used. Heading totals are the lines with one-part codes.',
    inputSchema: { type: 'object', properties: PROJECT, required: ['project'] },
    say: (i) => `Reading the budget lines of ${String(i.project ?? '')}`,
    run: (i) => {
      const p = findProject(i.project), w = wbOf(p);
      return { project: label(p), reportDate: w?.date ?? null, lines: lines(p).map((l) => {
        const sc = l.spentCommitted ?? ((l.actual ?? 0) + (l.committed ?? 0));
        return { code: l.code, description: l.description ?? '', approved: r2(l.approved), spent: r2(l.actual), spentAndCommitted: r2(sc), left: l.approved == null ? null : r2(l.approved - sc), usedPct: l.approved ? pc(sc, l.approved) : null };
      }) };
    },
  },
  {
    name: 'purchase_orders',
    description: 'Purchase-order lines of one project from its latest report: PO number, budget line, PMM activity number, description, supplier, amount, spent, spent + committed, open balance, date, status. Filter by text (matches PO, description, supplier, line or activity), by line, by activity number, or open ones only. Largest open balance first.',
    inputSchema: { type: 'object', properties: { ...PROJECT, text: { type: 'string' }, line: { type: 'string', description: 'Budget line code, e.g. "5.7" (sub-lines included)' }, activity: { type: 'string', description: 'PMM activity number, e.g. "146732"' }, openOnly: { type: 'boolean' }, limit: { type: 'number', description: 'Default 40, at most 80' } }, required: ['project'] },
    say: (i) => `Reading the purchase orders of ${String(i.project ?? '')}`,
    run: (i) => {
      const p = findProject(i.project), w = wbOf(p); if (!w) throw new Error(`${label(p)} has no report workbook on file.`);
      const t = String(i.text ?? '').toLowerCase(), ln = String(i.line ?? ''), act = String(i.activity ?? '').replace(/^0+/, '');
      const rows = w.wb.pos.filter((x) => (!t || `${x.po} ${x.description} ${x.supplier} ${x.line} ${x.activity ?? ''}`.toLowerCase().includes(t)) && (!ln || x.line === ln || x.line.startsWith(ln + '.'))
        && (!act || x.activity === act) && (!i.openOnly || x.sc - x.spent > 0.5)).sort((a, b) => (b.sc - b.spent) - (a.sc - a.spent));
      const n = lim(i.limit, 40, 80);
      return { project: label(p), reportDate: w.date, matching: rows.length, shown: Math.min(n, rows.length), totalOpen: r2(rows.reduce((s, x) => s + Math.max(0, x.sc - x.spent), 0)),
        pos: rows.slice(0, n).map((x) => ({ po: x.po, line: x.line, activity: x.activity ?? null, description: x.description, supplier: x.supplier, amount: r2(x.amount), spent: r2(x.spent), spentAndCommitted: r2(x.sc), open: r2(Math.max(0, x.sc - x.spent)), date: x.date, status: x.status })) };
    },
  },
  {
    name: 'postings',
    description: 'Dated postings (invoices and GL entries) of one project from its latest report, newest first: date, source, document, PO, line, activity number, description, amount. Filter by date range, line, activity number or text; returns the total of what matches.',
    inputSchema: { type: 'object', properties: { ...PROJECT, from: { type: 'string', description: 'YYYY-MM-DD' }, to: { type: 'string', description: 'YYYY-MM-DD' }, line: { type: 'string' }, activity: { type: 'string' }, text: { type: 'string' }, limit: { type: 'number', description: 'Default 40, at most 100' } }, required: ['project'] },
    say: (i) => `Reading the postings of ${String(i.project ?? '')}`,
    run: (i) => {
      const p = findProject(i.project), w = wbOf(p); if (!w?.wb.entries?.length) throw new Error(`${label(p)} has no dated postings on file (import its latest report again).`);
      const f = String(i.from ?? ''), to = String(i.to ?? ''), ln = String(i.line ?? ''), act = String(i.activity ?? '').replace(/^0+/, ''), t = String(i.text ?? '').toLowerCase();
      const E = w.wb.entries.filter((e) => (!f || e.date >= f) && (!to || e.date <= to) && (!ln || e.line === ln || e.line.startsWith(ln + '.')) && (!act || e.activity === act)
        && (!t || `${e.description} ${e.detail} ${e.supplier} ${e.po} ${e.doc}`.toLowerCase().includes(t))).sort((a, b) => b.date.localeCompare(a.date));
      const n = lim(i.limit, 40, 100);
      return { project: label(p), reportDate: w.date, matching: E.length, total: r2(E.reduce((s, e) => s + e.amount, 0)), shown: Math.min(n, E.length),
        postings: E.slice(0, n).map((e) => ({ date: e.date, source: e.src, doc: e.doc, po: e.po || null, line: e.line, activity: e.activity ?? null, description: e.description, detail: e.detail !== e.description ? e.detail : undefined, supplier: e.supplier || undefined, amount: r2(e.amount) })) };
    },
  },
  {
    name: 'work_plans',
    description: 'Work Plans of one project. Without "wp": the list (number, dates, planned). With "wp" (its number): the follow-up table (total, eligible and activity budget, A spent, B spent & committed, C/D/E of the previous WP, remaining budget and months), the activities with planned amount and what the report shows spent per activity number, and what became of the previous WP\'s activities.',
    inputSchema: { type: 'object', properties: { ...PROJECT, wp: { type: 'number', description: 'Work Plan number' } }, required: ['project'] },
    say: (i) => `Reading the Work Plans of ${String(i.project ?? '')}`,
    run: (i) => {
      const p = findProject(i.project), plans = [...(p.workPlans ?? [])].sort((a, b) => a.from.localeCompare(b.from));
      if (!plans.length) return { project: label(p), workPlans: [], note: 'No Work Plan entered for this project.' };
      const w = wbOf(p);
      const list = plans.map((x) => ({ wp: wpName(x), no: x.no, from: x.from, to: x.to, planned: r2(x.planned), activities: x.acts?.length ?? 0, ...(w && w.wb.entries?.length ? (() => { const u = wpUse(x, w.wb); return { spentOnIt: r2(u.spent), spentAndCommittedOnIt: r2(u.sc) }; })() : {}) }));
      if (i.wp == null) return { project: label(p), reportDate: w?.date ?? null, workPlans: list };
      const wp = plans.find((x) => x.no === Number(i.wp)); if (!wp) throw new Error(`${label(p)} has no WP ${i.wp}. It has: ${list.map((x) => x.wp).join(', ')}.`);
      if (!w) throw new Error(`${label(p)} has no report workbook on file, so the follow-up cannot be computed.`);
      const f = followUp(p, w.wb, wp, plans), AU = activityUse(w.wb), prevActs = previousActivities(plans, wp);
      return { project: label(p), reportDate: w.date, wp: wpName(wp), from: wp.from, to: wp.to, planned: r2(wp.planned),
        followUp: { totalBudget: f.total, eligible: f.eligible, staffSalaries: f.staff, officeCosts: f.office, activityBudget: f.activity, monthsElapsed: f.elapsed, A_activitySpent: f.spent, B_activitySpentAndCommitted: f.sc,
          previousWp: f.prev ? { wp: wpName(f.prev), from: f.prev.from, to: f.prev.to, C_planned: r2(f.prev.planned), D_spent: f.prevSpent, E_spentAndCommitted: f.prevSc, postingsCountedByActivityNumber: f.prevTagged } : null,
          remainingAfterWp: f.remaining, remainingMonths: f.remainingMonths },
        activities: (wp.acts ?? []).map((a) => { const u = AU.get(a.id.trim().replace(/^0+/, '')); return { activityId: a.id, ref: a.ref, name: a.name, planned: r2(a.amount), status: a.status ?? null, start: a.start ?? null, end: a.end ?? null, lines: a.lines.filter((l) => l.amount).map((l) => `${l.line} ${r2(l.amount)}`), reportSpent: u ? u.spent : null, reportSpentAndCommitted: u ? u.sc : null }; }),
        previousWpActivities: prevActs.rows.map((r) => ({ activityId: r.a.id, name: r.a.name, planned: r2(r.a.amount), fate: r.fate, note: r.note || undefined })) };
    },
  },
  {
    name: 'alerts',
    description: 'Open alerts (not handled or snoozed in the work list), most severe first: project, severity, kind, title, detail, due date. Optionally for one project.',
    inputSchema: { type: 'object', properties: { project: { type: 'string', description: 'Optional: one project' } } },
    say: () => 'Reading the open alerts',
    run: (i) => {
      const L = get().ledger, only = i.project ? findProject(i.project) : null, rank = { critical: 0, serious: 1, warning: 2 } as const;
      return openAlerts(allAlerts(only ? [only] : L.projects, TODAY), L.alertMarks, TODAY).sort((a, b) => rank[a.severity] - rank[b.severity])
        .slice(0, 60).map((a) => ({ project: label(L.projects.find((p) => p.id === a.projectId)!), severity: a.severity, kind: a.kind, title: a.title, detail: a.detail, due: a.due ?? null }));
    },
  },
  {
    name: 'month_close',
    description: 'This month\'s close: each running project\'s status (clean / to check / blocked) with the reasons, its report for the month, budget, spent, spent + committed, the change since the last close or previous report, and the decisions still open.',
    say: () => 'Reading this month\'s close',
    run: () => {
      const L = get().ledger, rows = closeRows(L.projects, TODAY, L.closes?.[0]);
      return { month: TODAY.toISOString().slice(0, 7), lastClose: L.closes?.[0]?.month ?? null, projects: rows.map((r) => ({ project: label(r.p), status: r.status, reasons: r.reasons, report: r.report ? `${r.report.name} (${r.report.date})${r.report.fresh ? '' : ' — not this month'}` : null,
        budget: r2(r.budget), spent: r2(r.spent), spentAndCommitted: r2(r.sc), change: r.since ? { since: r.since.label, spent: r2(r.since.spent), spentAndCommitted: r2(r.since.sc) } : null,
        openDecisions: r.decisions.map((d) => d.text) })) };
    },
  },
];

/** People's names known to the app (project staff), for masking before anything is sent. */
export function knownPeople(): string[] {
  const out = new Set<string>();
  for (const p of get().ledger.projects) for (const x of roster(p, TODAY)) { out.add(x.name); out.add(x.display); }
  return [...out].filter((n) => n.replace(/[^a-z]/gi, '').length >= 5);
}
