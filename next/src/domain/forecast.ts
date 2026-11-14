import { latestReport, n, parseDate } from './calc';
import type { BudgetLine, Project } from './types';

const MONTH = 30.44 * 864e5;
export type Basis = 'plan' | 'plan+pace' | 'pace';

/** The spending plan of the latest report (CoE forecast template): planned expenditure per line and its period. */
export function reportPlan(p: Project): { from: string; to: string; lines: BudgetLine[] } | null {
  const r = latestReport(p), m = r?.snapshot?.workbook?.meta;
  if (!r || !m?.plannedTo || !m.plannedFrom || isNaN(Date.parse(m.plannedTo)) || isNaN(Date.parse(m.plannedFrom))) return null;
  const L = r.snapshot!.lines.filter((l) => l.forecast != null);
  return L.length ? { from: m.plannedFrom, to: m.plannedTo, lines: L } : null;
}

/**
 * Spending still to come until the end date, on top of today's spent + committed: the part of the report's plan
 * not yet reached, then the monthly pace for the months after the plan. Without a plan, the pace alone.
 */
export function ahead(p: Project, today: Date, monthlyPace: number, sel: (l: BudgetLine) => boolean = () => true): { add: number; basis: Basis } {
  const t = today.getTime(), end = parseDate(p.end).getTime();
  if (end <= t) return { add: 0, basis: 'pace' };
  const P = reportPlan(p);
  if (P) {
    const f = Date.parse(P.from), to = Date.parse(P.to);
    if (to > t) {
      const share = Math.min(1, Math.max(0, (to - Math.max(t, f)) / Math.max(1, to - f)));
      const planned = P.lines.filter(sel).reduce((a, l) => a + Math.max(0, n(l.forecast)), 0) * share;
      const after = Math.max(0, (end - Math.max(to, t)) / MONTH) * monthlyPace;
      return { add: planned + after, basis: end > to + 15 * 864e5 ? 'plan+pace' : 'plan' };
    }
  }
  return { add: Math.max(0, (end - t) / MONTH) * monthlyPace, basis: 'pace' };
}
export const BASIS_LABEL: Record<Basis, string> = { 'plan': 'report plan', 'plan+pace': 'report plan, then pace', 'pace': 'current pace' };
