import { ADMIN_LINE } from './terms';
import type { BudgetLine, Ledger, Project, ReportingPeriod } from './types';
import { extractionLines, isExtraction } from './extraction';

const DAY = 86_400_000;
export const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
export const parseDate = (s: string): Date => new Date(s + (s.length === 10 ? 'T00:00:00Z' : ''));
const sum = <T>(a: T[], f: (x: T, i: number) => number) => a.reduce((s, x, i) => s + f(x, i), 0);

/** Most recent reporting period that carries line-level figures. */
/** Same month → the most recently imported report wins (a re-upload replaces an older reading of the same report). */
export const byPeriodThenImport = (a: ReportingPeriod, b: ReportingPeriod) => {
  const ia = a.snapshot?.workbook?.importedAt ?? a.registeredAt ?? '', ib = b.snapshot?.workbook?.importedAt ?? b.registeredAt ?? '';
  return a.date.slice(0, 7).localeCompare(b.date.slice(0, 7)) || ia.localeCompare(ib) || a.date.localeCompare(b.date);
};

/** When each report was loaded (reports kept from before the stamp have none). */
export const loadedAt = (r: ReportingPeriod) => r.snapshot?.workbook?.importedAt ?? r.registeredAt ?? '';
/** Order of reports: by period (the screens and the charts agree on it); within a month the last one loaded wins. */
export const byUpload = (a: ReportingPeriod, b: ReportingPeriod) => {
  void loadedAt; return byPeriodThenImport(a, b);
};

export function latestReport(p: Project): ReportingPeriod | undefined {
  const R = [...(p.reportingPeriods ?? [])].filter((r) => r.snapshot?.lines?.length).sort(byUpload);
  return R.filter((r) => !budgetOnly(r)).at(-1) ?? (p.approvedBudget ? undefined : R.at(-1));
}
/** A budget saved as a report (no spending at all): not a report of spending, so never the latest one. */
export const budgetOnly = (r: ReportingPeriod) => /approved budget/i.test(r.type ?? '') && !r.snapshot!.lines.some((l) => n(l.actual) !== 0 || n(l.spentCommitted) !== 0);

// Every screen asks for the same project's lines many times per render: remember them per project object,
// re-reading when its reports or approved budget change (edits replace these, so a stale read cannot survive).
const linesCache = new WeakMap<Project, { rp: unknown; n: number; ab: unknown; L: BudgetLine[] }>();
export function lines(p: Project): BudgetLine[] {
  const c = linesCache.get(p), rp = p.reportingPeriods, k = rp?.length ?? 0;
  if (c && c.rp === rp && c.n === k && c.ab === p.approvedBudget) return c.L;
  const L = readLines(p);
  linesCache.set(p, { rp, n: k, ab: p.approvedBudget, L });
  return L;
}
function readLines(p: Project): BudgetLine[] {
  const r = latestReport(p);
  if (!r) return p.approvedBudget?.lines ?? [];
  // A system extraction is laid on the current approved budget each time (the budget may arrive later).
  if (isExtraction(r.snapshot)) return extractionLines(r.snapshot!.workbook!, p);
  const L = r.snapshot!.lines, T = r.snapshot!.workbook?.totals;
  // Reports read before admin rows were recognised by wording (row 8 in templates without contingency) lack line 10:
  // rebuild it from the stored totals, or as eligible − direct − contingency.
  if (L.some((l) => l.code === ADMIN_LINE)) return L;
  const ab = (p.approvedBudget as { admin?: number } | undefined)?.admin;
  const ad = T?.admin ?? (T?.eligible && T.direct ? { budget: T.eligible.budget - T.direct.budget - (T.contingency?.budget ?? 0), actual: T.eligible.actual - T.direct.actual - (T.contingency?.actual ?? 0), sc: T.eligible.sc - T.direct.sc - (T.contingency?.sc ?? 0) } : ab ? { budget: ab, actual: 0, sc: 0 } : null);
  if (!ad || (Math.abs(ad.budget) < 1 && Math.abs(ad.actual) < 1)) return L;
  return [...L, { code: ADMIN_LINE, description: 'Administrative costs', approved: ad.budget, actual: ad.actual, spentCommitted: ad.sc, committed: Math.max(0, ad.sc - ad.actual) }];
}

/** Spent and committed come from the latest report; project-level fields are the fallback. */
export function money(p: Project) {
  const L = lines(p);
  const hasActual = L.some((l) => l.actual != null);
  const spent = hasActual ? sum(L, (l) => n(l.actual)) : n(p.spent);
  // Same rule as the budget-lines table: a line without a committed figure derives it from spent + committed.
  const hasCommitted = L.some((l) => l.committed != null || l.spentCommitted != null);
  const committed = hasCommitted ? sum(L, lineCommitted) : n(p.committed);
  const budget = n(p.budget);
  // Exposure follows the report's own spent + committed column (as headings and the statement do), so a
  // rounding gap between actual + committed and S&C never shows two different totals.
  const exposure = hasActual || hasCommitted ? sum(L, lineExposure) : spent + committed;
  return { budget, spent, committed, exposure, remaining: budget - exposure };
}

/** Fraction of the implementation period elapsed at `today`, clamped to [0, 1]. */
export function elapsed(p: Project, today: Date): number {
  if (p.datesTbc) return 0;
  const s = parseDate(p.start).getTime(), e = parseDate(p.end).getTime();
  if (!(e > s)) return 0;
  return Math.min(1, Math.max(0, (today.getTime() - s) / (e - s)));
}

/** Burn (spent / budget) minus time elapsed. Negative = behind plan. */
export function burnGap(p: Project, today: Date): number {
  const m = money(p);
  return (m.budget ? m.spent / m.budget : 0) - elapsed(p, today);
}

export function monthsBetween(a: Date, b: Date) {
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + b.getUTCMonth() - a.getUTCMonth();
}

/** Cumulative actual spend known at each report date (start at 0 on the project start). */
// Spend points are asked for per month and per project while building series: read them once per project version.
const ptsCache = new WeakMap<Project, { rp: unknown; st: string; v: { t: number; v: number }[] }>();
export function spendPoints(p: Project): { t: number; v: number }[] {
  const c = ptsCache.get(p);
  if (c && c.rp === p.reportingPeriods && c.st === p.start) return c.v;
  const v = readSpendPoints(p);
  ptsCache.set(p, { rp: p.reportingPeriods, st: p.start, v });
  return v;
}
function readSpendPoints(p: Project): { t: number; v: number }[] {
  const pts = (p.reportingPeriods ?? [])
    .filter((r) => r.snapshot?.lines?.length)
    .map((r) => ({ t: parseDate(r.date).getTime(), v: sum(r.snapshot!.lines, (l) => n(l.actual)) }))
    .sort((a, b) => a.t - b.t);
  const s = parseDate(p.start).getTime();
  if (!pts.length || pts[0].t > s) pts.unshift({ t: s, v: 0 });
  return pts;
}

/** Linear interpolation of cumulative spend; flat after the last report, zero before start. */
export function spendAt(p: Project, t: number): number {
  const pts = spendPoints(p);
  if (t <= pts[0].t) return t < pts[0].t ? 0 : pts[0].v;
  for (let i = 1; i < pts.length; i++) {
    if (t <= pts[i].t) {
      const a = pts[i - 1], b = pts[i];
      return a.v + ((b.v - a.v) * (t - a.t)) / (b.t - a.t);
    }
  }
  return pts.at(-1)!.v;
}

/** Monthly spend rate from the last two reports (per 30.4 days); never negative — a correcting report must not project spending going backwards. */
export function recentRate(p: Project): number {
  const pts = spendPoints(p);
  if (pts.length < 2) return 0;
  const a = pts.at(-2)!, b = pts.at(-1)!;
  return Math.max(0, ((b.v - a.v) / ((b.t - a.t) / DAY)) * 30.4375);
}

/**
 * Monthly rate used for forecasts: the average since start, blended 50/50 with the recent
 * rate when the last two reports are at least ~3 months apart (recent capped at 2x average),
 * so a short or catch-up period between reports cannot swing the forecast.
 */
export function forecastRate(p: Project, today: Date): { rate: number; recent: boolean } {
  const start = parseDate(p.start).getTime(), end = parseDate(p.end).getTime();
  const pts = spendPoints(p), a = pts.at(-2), b = pts.at(-1)!;
  const asOf = Math.min(end, Math.max(b.t, Math.min(today.getTime(), b.t)));
  const done = (asOf - start) / DAY / 30.4375;
  const avg = done >= 1 ? b.v / done : 0;
  if (a && avg && b.t - a.t >= 85 * DAY && a.v > 0) return { rate: 0.5 * avg + 0.5 * Math.min(recentRate(p), 2 * avg), recent: true };
  return { rate: avg, recent: false };
}

export const monthEnd = (y: number, m: number) => Date.UTC(y, m + 1, 0);

export interface SeriesPoint { t: number; actual: number | null; plan: number; low: number | null; mid: number | null; high: number | null }

/**
 * Portfolio cumulative series by month: actual spend (up to the last report),
 * linear plan (budget × elapsed), and a forecast band from the recent rate
 * (±20 %), capped at each project's budget.
 */
let seriesMemo: { ps: Project[]; t: number; v: SeriesPoint[] } | null = null;
export function portfolioSeries(ps: Project[], today: Date): SeriesPoint[] {
  // Overview, pack and deck ask for the same series: reuse it while the projects (objects) are unchanged.
  const m = seriesMemo;
  if (m && m.t === today.getTime() && m.ps.length === ps.length && m.ps.every((p, i) => p === ps[i])) return m.v;
  const v = buildSeries(ps, today);
  seriesMemo = { ps: [...ps], t: today.getTime(), v };
  return v;
}
function buildSeries(ps: Project[], today: Date): SeriesPoint[] {
  ps = ps.filter((p) => !p.datesTbc);
  if (!ps.length) return [];
  const s0 = new Date(Math.min(...ps.map((p) => parseDate(p.start).getTime())));
  const e0 = new Date(Math.max(...ps.map((p) => parseDate(p.end).getTime())));
  const lastReport = Math.max(...ps.map((p) => spendPoints(p).at(-1)!.t));
  const rates = ps.map((p) => forecastRate(p, today).rate);
  const out: SeriesPoint[] = [];
  for (let y = s0.getUTCFullYear(), m = s0.getUTCMonth(); ; m++) {
    const t = monthEnd(y, m);
    const plan = sum(ps, (p) => n(p.budget) * elapsed(p, new Date(t)));
    const isPast = t <= lastReport;
    const proj = (k: number) =>
      sum(ps, (p, i) => {
        const last = spendPoints(p).at(-1)!, rate = rates[i];
        const base = spendAt(p, Math.min(t, last.t));
        const end = parseDate(p.end).getTime();
        const months = Math.max(0, (Math.min(t, end) - last.t) / DAY / 30.4375);
        return Math.min(n(p.budget), base + rate * k * months);
      });
    out.push({
      t,
      plan,
      actual: isPast ? sum(ps, (p) => spendAt(p, t)) : null,
      low: t >= lastReport ? proj(0.8) : null,
      mid: t >= lastReport ? proj(1) : null,
      high: t >= lastReport ? proj(1.2) : null,
    });
    if (t >= e0.getTime()) break;
    if (out.length > 600) break;
  }
  return out;
}

export interface Totals { budget: number; spent: number; committed: number; exposure: number; remaining: number; elapsed: number; burn: number; projects: number }

export function totals(ps: Project[], today: Date): Totals {
  const M = ps.map(money);
  const budget = sum(M, (m) => m.budget), spent = sum(M, (m) => m.spent), committed = sum(M, (m) => m.committed);
  // budget-weighted elapsed time
  const el = budget ? sum(ps, (p) => n(p.budget) * elapsed(p, today)) / budget : 0;
  return { budget, spent, committed, exposure: spent + committed, remaining: budget - spent - committed, elapsed: el, burn: budget ? spent / budget : 0, projects: ps.length };
}

export function groupBy(ps: Project[], key: (p: Project) => string) {
  const g = new Map<string, { key: string; budget: number; spent: number; committed: number; count: number }>();
  for (const p of ps) {
    const k = key(p) || '—';
    const m = money(p);
    const r = g.get(k) ?? { key: k, budget: 0, spent: 0, committed: 0, count: 0 };
    r.budget += m.budget; r.spent += m.spent; r.committed += m.committed; r.count++;
    g.set(k, r);
  }
  return [...g.values()].sort((a, b) => b.budget - a.budget);
}

export type Severity = 'critical' | 'serious' | 'warning';
export interface Flag { projectId: string; severity: Severity; title: string; detail: string; kind: string }

export const riskScore = (r: { likelihood?: unknown; impact?: unknown }) => Number(r.likelihood || 0) * Number(r.impact || 0);

/** Items that need management attention, ordered by severity. */
export function attention(ps: Project[], today: Date): Flag[] {
  const F: Flag[] = [];
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  for (const p of ps) {
    if ((p.status && p.status !== 'Active') || p.datesTbc) continue;
    const m = money(p);
    const gap = burnGap(p, today), el = elapsed(p, today);
    if (el > 0.1 && gap < -0.15)
      F.push({ projectId: p.id, kind: 'underspend', severity: gap < -0.3 ? 'serious' : 'warning', title: 'Spending behind schedule', detail: `${pct(m.budget ? m.spent / m.budget : 0)} spent at ${pct(el)} of time` });
    if (gap > 0.1)
      F.push({ projectId: p.id, kind: 'overspend', severity: 'serious', title: 'Spending ahead of schedule', detail: `${pct(m.spent / m.budget)} spent at ${pct(el)} of time` });
    if (m.remaining < 0)
      F.push({ projectId: p.id, kind: 'overbudget', severity: 'critical', title: 'Exposure exceeds budget', detail: `Spent + committed is over budget` });
    for (const l of lines(p)) {
      const ex = l.spentCommitted ?? n(l.actual) + n(l.committed);
      if (n(l.approved) > 0 && ex > n(l.approved) * 1.1)
        F.push({ projectId: p.id, kind: 'line', severity: ex > n(l.approved) * 1.25 ? 'critical' : 'serious', title: `Line ${l.code} over approved`, detail: `${l.description || ''} at ${pct(ex / n(l.approved))} of approved` });
    }
    const last = latestReport(p);
    const sinceStart = (today.getTime() - parseDate(p.start).getTime()) / DAY;
    const age = last ? (today.getTime() - parseDate(last.date).getTime()) / DAY : sinceStart;
    if (sinceStart > 180 && age > 180)
      F.push({ projectId: p.id, kind: 'stale', severity: 'warning', title: 'No recent financial report', detail: `Last figures ${Math.round(age / 30.4)} months old` });
    for (const r of p.riskRegister ?? [])
      if ((r.status ?? 'Open') === 'Open' && riskScore(r) >= 12)
        F.push({ projectId: p.id, kind: 'risk', severity: riskScore(r) >= 16 ? 'critical' : 'serious', title: `High risk: ${r.title}`, detail: `Likelihood ${r.likelihood} × impact ${r.impact}` });
  }
  const order: Record<Severity, number> = { critical: 0, serious: 1, warning: 2 };
  return F.sort((a, b) => order[a.severity] - order[b.severity]);
}

/** Validates an imported ledger; returns readable problems (empty = valid). */
export function validateLedger(x: unknown): string[] {
  const errs: string[] = [];
  const o = x as Ledger;
  if (!o || typeof o !== 'object') return ['File is not a JSON object'];
  if (!Array.isArray(o.projects)) return ['Missing "projects" list'];
  if (!Array.isArray(o.countries)) errs.push('Missing "countries" list');
  o.projects.forEach((p, i) => {
    const at = `Project ${i + 1}${p?.code ? ` (${p.code})` : ''}`;
    if (!p?.id) errs.push(`${at}: missing id`);
    if (!p?.name) errs.push(`${at}: missing name`);
    if (!(n(p?.budget) >= 0)) errs.push(`${at}: budget must be a number`);
    if (!p?.start || isNaN(parseDate(p.start).getTime())) errs.push(`${at}: invalid start date`);
    if (!p?.end || isNaN(parseDate(p.end).getTime())) errs.push(`${at}: invalid end date`);
    else if (p.start && parseDate(p.end) <= parseDate(p.start)) errs.push(`${at}: end must be after start`);
  });
  return errs;
}

/* ---------------- budget lines & report versions ---------------- */

export const lineExposure = (l: BudgetLine) => (l.spentCommitted != null ? n(l.spentCommitted) : n(l.actual) + n(l.committed));
export const lineCommitted = (l: BudgetLine) => (l.committed != null ? n(l.committed) : Math.max(0, lineExposure(l) - n(l.actual)));

export interface LineRow { key: string; project: Project; code: string; description: string; approved: number; actual: number; committed: number; exposure: number; used: number; balance: number }

/** Every budget line from each project's latest report, flattened. */
export function lineRows(ps: Project[]): LineRow[] {
  return ps.flatMap((p) => lines(p).map((l) => {
    const approved = n(l.approved), exposure = lineExposure(l);
    return { key: `${p.id}:${l.code}`, project: p, code: l.code, description: l.description || `Line ${l.code}`, approved, actual: n(l.actual), committed: lineCommitted(l), exposure, used: approved ? exposure / approved : 0, balance: approved - exposure };
  }));
}

/** Lines grouped by description (cost category) across projects. */
/** Budget headings of the standard template; line codes start with the heading number (1.1.2 → Human resources). */
export const HEADINGS: Record<string, string> = { '1': 'Human resources', '2': 'Travel', '3': 'Equipment and supplies', '4': 'Local office', '5': 'Other costs, services', '6': 'Other', '8': 'Contingency reserve', '10': 'Administrative costs' };
/** Category of a line: its budget heading when the code is numbered, otherwise the description. */
export const category = (r: { code: string; description: string }) => {
  const h = r.code.match(/^(\d{1,2})(?:\.|$)/)?.[1];
  return h && HEADINGS[h] ? `${h} ${HEADINGS[h]}` : r.description.trim();
};
export function byCategory(rows: LineRow[]) {
  const m = new Map<string, { key: string; approved: number; actual: number; committed: number; exposure: number; lines: number }>();
  for (const r of rows) {
    const k = category(r);
    const g = m.get(k) ?? { key: k, approved: 0, actual: 0, committed: 0, exposure: 0, lines: 0 };
    g.approved += r.approved; g.actual += r.actual; g.committed += r.committed; g.exposure += r.exposure; g.lines++;
    m.set(k, g);
  }
  return [...m.values()].sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
}

export function reportTotals(r: ReportingPeriod) {
  const L = r.snapshot?.lines ?? [];
  return { approved: sum(L, (l) => n(l.approved)), actual: sum(L, (l) => n(l.actual)), committed: sum(L, lineCommitted), exposure: sum(L, lineExposure) };
}

export const reportsByDate = (p: Project) => [...(p.reportingPeriods ?? [])].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

export interface LineDelta { code: string; description: string; status: 'added' | 'removed' | 'changed' | 'same'; approved: [number, number]; actual: [number, number]; exposure: [number, number] }

/** Line-by-line comparison of two report versions, matched on line code. */
export function compareReports(a: ReportingPeriod, b: ReportingPeriod): LineDelta[] {
  const A = new Map((a.snapshot?.lines ?? []).map((l) => [l.code, l]));
  const B = new Map((b.snapshot?.lines ?? []).map((l) => [l.code, l]));
  const codes = [...new Set([...A.keys(), ...B.keys()])].sort((x, y) => x.localeCompare(y, undefined, { numeric: true }));
  return codes.map((code) => {
    const x = A.get(code), y = B.get(code);
    const pair = (f: (l: BudgetLine) => number): [number, number] => [x ? f(x) : 0, y ? f(y) : 0];
    const d: LineDelta = { code, description: y?.description || x?.description || '', status: 'same', approved: pair((l) => n(l.approved)), actual: pair((l) => n(l.actual)), exposure: pair(lineExposure) };
    d.status = !x ? 'added' : !y ? 'removed' : d.approved[0] !== d.approved[1] || d.actual[0] !== d.actual[1] || d.exposure[0] !== d.exposure[1] ? 'changed' : 'same';
    return d;
  });
}

export interface ReportCheck { level: 'error' | 'warning'; text: string }

/** Sanity checks for a new report against the project and its previous report. */
export function checkReport(p: Project, r: ReportingPeriod): ReportCheck[] {
  const out: ReportCheck[] = [];
  const L = r.snapshot?.lines ?? [];
  if (!L.length) out.push({ level: 'error', text: 'The report has no budget lines' });
  const seen = new Set<string>();
  for (const l of L) {
    if (!l.code) out.push({ level: 'error', text: 'A line is missing its code' });
    else if (seen.has(l.code)) out.push({ level: 'error', text: `Line code ${l.code} appears twice` });
    seen.add(l.code);
    if (n(l.actual) < 0 || n(l.approved) < 0) out.push({ level: 'error', text: `Line ${l.code} has a negative amount` });
  }
  if (isNaN(parseDate(r.date).getTime())) out.push({ level: 'error', text: 'Report date is invalid' });
  else if (r.date < p.start) out.push({ level: 'warning', text: 'Report date is before the project start' });
  if ((p.reportingPeriods ?? []).some((x) => x.date === r.date && x.id !== r.id)) out.push({ level: 'warning', text: r.snapshot?.workbook?.meta.plannedTo ? 'Another report already has this date — this one is kept as the latest, with its plan' : 'Another report already has this date' });
  const prev = reportsByDate(p).filter((x) => x.date < r.date && x.id !== r.id).at(-1);
  if (prev) {
    for (const d of compareReports(prev, r))
      if (d.status !== 'added' && d.status !== 'removed' && d.actual[1] < d.actual[0] - 0.5)
        out.push({ level: 'warning', text: `Line ${d.code}: cumulative actual fell from ${d.actual[0].toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} to ${d.actual[1].toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` });
  }
  const t = reportTotals(r);
  if (t.approved && Math.abs(t.approved - n(p.budget)) > 1) out.push({ level: 'warning', text: `Report total ${t.approved.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} differs from project budget ${n(p.budget).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (workbook imports update the budget)` });
  for (const l of L) if (n(l.approved) && lineExposure(l) > n(l.approved)) out.push({ level: 'warning', text: `Line ${l.code} is over its approved amount` });
  return out;
}

/* ---------------- activity plan ---------------- */
export function planStats(p: Project, today: Date) {
  const d = p.doa; if (!d) return null;
  const cm = monthsBetween(parseDate(d.start), today) + 1; // current project month, 1-based
  const acts = d.acts.map((a) => {
    // P = preparation, E = implementation, X = extension months (1-based project months)
    const all = [...(a.P ?? []), ...(a.E ?? []), ...((a as { X?: number[] }).X ?? [])];
    const plannedEnd = all.length ? Math.max(...all) : 0;
    const done = a.status === 'Done';
    const late = !done && plannedEnd > 0 && plannedEnd < cm;
    return { ...a, plannedEnd, done, late };
  });
  return { month: cm, total: acts.length, done: acts.filter((a) => a.done).length, late: acts.filter((a) => a.late).length, acts };
}

/* ---------------- reporting calendar ---------------- */
export interface Deadline { project: Project; kind: 'Progress report' | 'Final report'; periodEnd: string; due: string; status: 'submitted' | 'overdue' | 'due' | 'upcoming' }

/** Adds calendar months, clamping to the last day of the target month (31 Dec + 6 → 30 Jun). */
export const addMonths = (iso: string, m: number) => {
  const d = parseDate(iso), y = d.getUTCFullYear(), mo = d.getUTCMonth() + m;
  const last = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, mo, Math.min(d.getUTCDate(), last))).toISOString().slice(0, 10);
};
const addDays = (iso: string, n: number) => new Date(parseDate(iso).getTime() + n * DAY).toISOString().slice(0, 10);

/**
 * Contractual reporting deadlines: a progress report every `repMonths` from the
 * start (due `progDays` after the period end) and a final report `finalMonths`
 * after the end. A period counts as submitted when a report dated on or after
 * its end is on file. Defaults: 12 months / 60 days / 6 months.
 */
/**
 * Caches a per-project result for one day. Projects are replaced, never changed in place (see data/store), so a project
 * object that is unchanged gives the same answer and the page does not recompute it on every render.
 */
export function perProject<T>(f: (p: Project, today: Date) => T): (p: Project, today: Date) => T {
  const c = new WeakMap<Project, { t: number; v: T }>();
  return (p, today) => { const t = today.getTime(), h = c.get(p); if (h && h.t === t) return h.v; const v = f(p, today); c.set(p, { t, v }); return v; };
}
export const deadlines = perProject(deadlinesOf);
function deadlinesOf(p: Project, today: Date): Deadline[] {
  if (p.datesTbc) return [];
  const c = (p.contract ?? {}) as { repMonths?: number; progDays?: number; finalMonths?: number };
  const rep = c.repMonths || 12, prog = c.progDays || 60, fin = c.finalMonths || 6;
  const t = today.toISOString().slice(0, 10);
  const reports = (p.reportingPeriods ?? []).filter((r) => !/approved budget/i.test(r.type)).map((r) => r.date);
  const out: Deadline[] = [];
  // A report dated from a month before the period end up to 120 days after it covers the period.
  const status = (periodEnd: string, due: string): Deadline['status'] =>
    reports.some((d) => d >= addDays(periodEnd, -31) && d <= addDays(periodEnd, 120)) ? 'submitted'
      : due < t ? 'overdue' : due <= addDays(t, 60) ? 'due' : 'upcoming';
  for (let k = 1; ; k++) {
    const periodEnd = addDays(addMonths(p.start, k * rep), -1);
    if (periodEnd >= p.end) break;
    const due = addDays(periodEnd, prog);
    out.push({ project: p, kind: 'Progress report', periodEnd, due, status: status(periodEnd, due) });
    if (k > 40) break;
  }
  const due = addMonths(p.end, fin);
  out.push({ project: p, kind: 'Final report', periodEnd: p.end, due, status: status(p.end, due) });
  return out;
}
