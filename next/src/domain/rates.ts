import { n } from './calc';
import { oneOff } from './ledger';
import type { BudgetLine, Project } from './types';

/**
 * The unit cost a line has really had, as the financial report shows it: what was spent divided by the units used,
 * once at least two units are reported (one unit says little). Grants, lines without units and units only estimated
 * from a raw extraction give none.
 */
export function averageRate(l: BudgetLine): number | undefined {
  const u = n(l.reportedUnits), a = n(l.actual);
  if (l.unitsEstimated || u < 2 || a <= 0 || oneOff(l.description ?? '', l.unit ?? '')) return undefined;
  return Math.round((a / u) * 100) / 100;
}

/** Average unit cost of a line in the latest full financial report (the units counted by the finance team), with its date. */
export function reportRate(p: Project, code: string): { rate: number; units: number; date: string } | undefined {
  const R = [...(p.reportingPeriods ?? [])].filter((r) => r.snapshot?.lines?.length && !r.snapshot.workbook?.meta?.extraction).sort((a, b) => a.date.localeCompare(b.date));
  for (let i = R.length - 1; i >= 0; i--) { const l = R[i].snapshot!.lines!.find((x) => x.code === code); if (!l) continue; const r = averageRate(l); return r ? { rate: r, units: n(l.reportedUnits), date: R[i].date } : undefined; }
  return undefined;
}

/** Average unit cost of a line: from the current figures, else (units only estimated) from the latest full report. */
export function lineRate(p: Project, l: BudgetLine | undefined): { rate: number; date?: string } | undefined {
  if (!l) return undefined;
  const a = averageRate(l); if (a) return { rate: a };
  if (!l.unitsEstimated) return undefined;
  const r = reportRate(p, l.code); return r && { rate: r.rate, date: r.date };
}

/**
 * Unit value of a changed line in a revised (notification / addendum) budget, by one rule: the average unit cost the
 * financial report shows for it (spent ÷ units used); a line without enough units keeps the approved rate.
 */
export function revisedRate(p: Project, l: BudgetLine | undefined, approved: number | null | undefined): { rate: number; basis: 'average' | 'approved'; date?: string } {
  const a = lineRate(p, l);
  return a ? { rate: a.rate, basis: 'average', date: a.date } : { rate: approved ?? 0, basis: 'approved' };
}
