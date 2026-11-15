import { n } from './calc';
import { oneOff } from './ledger';
import type { BudgetLine } from './types';

/** Lines paid at a fixed tariff (per diems, allowances, fees, salaries): their unit value is the approved rate, never an average. */
export function standardRate(l: Pick<BudgetLine, 'description' | 'unit'>): boolean {
  return /per\s*-?\s*diem|\bdsa\b|allowance|subsistence|honorari|\bfees?\b|salar|\bstaff\b/i.test(`${l.description ?? ''} ${l.unit ?? ''}`);
}

/**
 * The unit cost a line has really had: what was spent divided by the units used, once at least two units are
 * reported (one unit says little). Grants, tariff lines and lines without units keep the budgeted rate.
 */
export function averageRate(l: BudgetLine): number | undefined {
  const u = n(l.reportedUnits), a = n(l.actual);
  if (u < 2 || a <= 0 || oneOff(l.description ?? '', l.unit ?? '') || standardRate(l)) return undefined;
  return Math.round((a / u) * 100) / 100;
}

/**
 * Unit value of a line in a revised (notification / addendum) budget, by one standard rule:
 * tariff lines and decreased lines keep the approved rate; an increased market-priced line takes its average cost so far.
 */
export function revisedRate(l: BudgetLine | undefined, approved: number | null | undefined, increased: boolean): { rate: number; basis: 'average' | 'approved' } {
  const avg = increased && l ? averageRate(l) : undefined;
  return avg ? { rate: avg, basis: 'average' } : { rate: approved ?? 0, basis: 'approved' };
}
