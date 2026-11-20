import { latestReport, lineRows, lines, money, n, reportsByDate } from './calc';
import { isExtraction } from './extraction';
import { headings } from './insights';
import { portfolioStatement } from './statement';
import type { Project } from './types';

/**
 * The app checking itself: the same figure must read the same on every screen — the project card, the budget lines,
 * the headings, the chart of reports over time, the portfolio statement. A difference here is a fault of the app
 * (or of how a file was stored), not of the user's data, and is shown so it is never taken for a real figure.
 */
export interface SelfIssue { project?: Project; figure: string; a: { label: string; v: number }; b: { label: string; v: number } }

const near = (a: number, b: number) => Math.abs(a - b) <= 1;

export function selfCheck(P: Project[]): SelfIssue[] {
  const out: SelfIssue[] = [];
  const cmp = (project: Project | undefined, figure: string, a: SelfIssue['a'], b: SelfIssue['b']) => { if (!near(a.v, b.v)) out.push({ project, figure, a, b }); };
  for (const p of P) {
    const m = money(p), L = lines(p);
    if (!L.some((l) => l.actual != null)) continue;
    const rows = lineRows([p]);
    cmp(p, 'Spent', { label: 'Project card', v: m.spent }, { label: 'Budget lines', v: rows.reduce((s, r) => s + r.actual, 0) });
    cmp(p, 'Spent + committed', { label: 'Project card', v: m.exposure }, { label: 'Headings', v: headings(p).total.exposure });
    // The last point of "Reports over time" is the report of the latest period.
    const last = latestReport(p), end = reportsByDate(p).filter((r) => r.snapshot?.lines?.length && !/approved budget/i.test(r.type ?? '')).at(-1);
    if (last && end && !isExtraction(end.snapshot) && end.date.slice(0, 7) > last.date.slice(0, 7))
      cmp(p, 'Spent', { label: `Project card (${last.name})`, v: m.spent }, { label: `Reports over time (${end.name})`, v: end.snapshot!.lines.reduce((s, l) => s + n(l.actual), 0) });
  }
  if (P.length > 1) {
    const S = portfolioStatement(P), R = lineRows(P);
    cmp(undefined, 'Portfolio spent', { label: 'Portfolio statement', v: S.totals.eligible?.actual ?? S.totals.direct.actual }, { label: 'Sum of the projects', v: R.reduce((s, r) => s + r.actual, 0) });
  }
  return out;
}
