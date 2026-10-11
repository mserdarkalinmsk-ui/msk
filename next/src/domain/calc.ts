import type { BudgetLine, Ledger, Project, ReportingPeriod } from './types';

const DAY = 86_400_000;
export const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
export const parseDate = (s: string): Date => new Date(s + (s.length === 10 ? 'T00:00:00Z' : ''));
const sum = <T>(a: T[], f: (x: T) => number) => a.reduce((s, x) => s + f(x), 0);

/** Most recent reporting period that carries line-level figures. */
export function latestReport(p: Project): ReportingPeriod | undefined {
  return [...(p.reportingPeriods ?? [])]
    .filter((r) => r.snapshot?.lines?.length)
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(-1);
}

export function lines(p: Project): BudgetLine[] {
  return latestReport(p)?.snapshot?.lines ?? [];
}

/** Spent and committed come from the latest report; project-level fields are the fallback. */
export function money(p: Project) {
  const L = lines(p);
  const hasActual = L.some((l) => l.actual != null);
  const spent = hasActual ? sum(L, (l) => n(l.actual)) : n(p.spent);
  const hasCommitted = L.some((l) => l.committed != null);
  const committed = hasCommitted ? sum(L, (l) => n(l.committed)) : n(p.committed);
  const budget = n(p.budget);
  const remaining = budget - spent - committed;
  return { budget, spent, committed, exposure: spent + committed, remaining };
}

/** Fraction of the implementation period elapsed at `today`, clamped to [0, 1]. */
export function elapsed(p: Project, today: Date): number {
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
export function spendPoints(p: Project): { t: number; v: number }[] {
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

/** Monthly spend rate from the last two reports (per 30.4 days). */
export function recentRate(p: Project): number {
  const pts = spendPoints(p);
  if (pts.length < 2) return 0;
  const a = pts.at(-2)!, b = pts.at(-1)!;
  return ((b.v - a.v) / ((b.t - a.t) / DAY)) * 30.4375;
}

export const monthEnd = (y: number, m: number) => Date.UTC(y, m + 1, 0);

export interface SeriesPoint { t: number; actual: number | null; plan: number; low: number | null; mid: number | null; high: number | null }

/**
 * Portfolio cumulative series by month: actual spend (up to the last report),
 * linear plan (budget × elapsed), and a forecast band from the recent rate
 * (±20 %), capped at each project's budget.
 */
export function portfolioSeries(ps: Project[], today: Date): SeriesPoint[] {
  if (!ps.length) return [];
  const s0 = new Date(Math.min(...ps.map((p) => parseDate(p.start).getTime())));
  const e0 = new Date(Math.max(...ps.map((p) => parseDate(p.end).getTime())));
  const lastReport = Math.max(...ps.map((p) => spendPoints(p).at(-1)!.t));
  const out: SeriesPoint[] = [];
  for (let y = s0.getUTCFullYear(), m = s0.getUTCMonth(); ; m++) {
    const t = monthEnd(y, m);
    const plan = sum(ps, (p) => n(p.budget) * elapsed(p, new Date(t)));
    const isPast = t <= lastReport;
    const proj = (k: number) =>
      sum(ps, (p) => {
        const last = spendPoints(p).at(-1)!;
        const base = spendAt(p, Math.min(t, last.t));
        const end = parseDate(p.end).getTime();
        const months = Math.max(0, (Math.min(t, end) - last.t) / DAY / 30.4375);
        return Math.min(n(p.budget), base + recentRate(p) * k * months);
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
  void today;
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
    if (p.status && p.status !== 'Active') continue;
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
export function byCategory(rows: LineRow[]) {
  const m = new Map<string, { key: string; approved: number; actual: number; committed: number; exposure: number; lines: number }>();
  for (const r of rows) {
    const k = r.description.trim();
    const g = m.get(k) ?? { key: k, approved: 0, actual: 0, committed: 0, exposure: 0, lines: 0 };
    g.approved += r.approved; g.actual += r.actual; g.committed += r.committed; g.exposure += r.exposure; g.lines++;
    m.set(k, g);
  }
  return [...m.values()].sort((a, b) => b.approved - a.approved);
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
  if ((p.reportingPeriods ?? []).some((x) => x.date === r.date && x.id !== r.id)) out.push({ level: 'warning', text: 'Another report already has this date' });
  const prev = reportsByDate(p).filter((x) => x.date < r.date && x.id !== r.id).at(-1);
  if (prev) {
    for (const d of compareReports(prev, r))
      if (d.status !== 'added' && d.status !== 'removed' && d.actual[1] < d.actual[0] - 0.5)
        out.push({ level: 'warning', text: `Line ${d.code}: cumulative actual fell from ${Math.round(d.actual[0]).toLocaleString('en-GB')} to ${Math.round(d.actual[1]).toLocaleString('en-GB')}` });
  }
  const t = reportTotals(r);
  if (t.approved && Math.abs(t.approved - n(p.budget)) > 1) out.push({ level: 'warning', text: `Approved total (${Math.round(t.approved).toLocaleString('en-GB')}) differs from project budget (${Math.round(n(p.budget)).toLocaleString('en-GB')})` });
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
