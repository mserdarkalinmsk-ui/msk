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
