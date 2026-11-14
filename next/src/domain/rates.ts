import { n } from './calc';
import { oneOff } from './ledger';
import type { BudgetLine } from './types';

/**
 * The unit cost a line has really had: what was spent divided by the units used, once at least two units are
 * reported (one unit says little). Grants and lines without units keep the budgeted rate.
 */
export function averageRate(l: BudgetLine): number | undefined {
  const u = n(l.reportedUnits), a = n(l.actual);
  if (u < 2 || a <= 0 || oneOff(l.description ?? '', l.unit ?? '')) return undefined;
  return Math.round((a / u) * 100) / 100;
}
