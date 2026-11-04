import { ADMIN_LINE } from './terms';
import type { BudgetNote } from './documents';

export interface VarLine { code: string; d: string; aA: number; act: number; use: number | null; dRp: number | null; dU: number | null; unit: string }
export interface Variance { code: string; d: string; kind: 'overspent' | 'under-used' | 'unit cost' | 'units'; facts: string; draft: string }

const eur = (v: number) => `EUR ${v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pc = (v: number) => `${Math.round(v * 100)}%`;
const just = (n?: BudgetNote) => (n?.justification || n?.clarification || '').replace(/\s+/g, ' ').trim().split(/(?<=[.;])\s/)[0]?.slice(0, 220) ?? '';

/**
 * Lines a donor will ask about: spent beyond the approved amount, far behind the time elapsed, or a unit cost /
 * unit count off the approved budget by more than 10 %. Each gets the facts and a draft explanation to edit.
 */
export function variances(L: VarLine[], elapsed: number, budget: number, notes: Record<string, BudgetNote> = {}): Variance[] {
  const out: Variance[] = [];
  for (const l of L) {
    if (l.code === ADMIN_LINE || !l.aA) continue;
    const big = l.aA >= budget * 0.005, n = notes[l.code], j = just(n), why = j ? ` The line was budgeted for: ${j}` : '';
    if (l.use != null && l.use > 1.005) out.push({ code: l.code, d: l.d, kind: 'overspent', facts: `${eur(l.act)} spent against ${eur(l.aA)} approved (${pc(l.use)}).`,
      draft: `Expenditure on this line exceeded the approved amount by ${eur(l.act - l.aA)} (${pc(l.use - 1)}). [Explain the reason, e.g. higher demand or prices.] The excess is covered within the flexibility allowed between budget headings and does not change the total budget.${why}` });
    else if (big && elapsed > 0.3 && l.use != null && l.use < elapsed - 0.3) out.push({ code: l.code, d: l.d, kind: 'under-used', facts: `${pc(l.use)} used with ${pc(elapsed)} of the period elapsed; ${eur(l.aA - l.act)} remaining.`,
      draft: `Spending on this line is behind schedule (${pc(l.use)} used against ${pc(elapsed)} of the implementation period). [Explain the delay and when the activities will take place.] The remaining ${eur(l.aA - l.act)} is planned to be used by [month/year].${why}` });
    else if (l.dRp != null && Math.abs(l.dRp) > 0.1 && l.act > 0) out.push({ code: l.code, d: l.d, kind: 'unit cost', facts: `Actual unit cost ${l.dRp > 0 ? 'higher' : 'lower'} than approved by ${pc(Math.abs(l.dRp))}.`,
      draft: `The actual unit cost was ${pc(Math.abs(l.dRp))} ${l.dRp > 0 ? 'above' : 'below'} the approved rate. [Explain: market prices, procurement result, exchange rate.]${why}` });
    else if (l.dU != null && l.dU > 0 && l.act > 0) out.push({ code: l.code, d: l.d, kind: 'units', facts: `${l.dU} ${l.unit || 'units'} more than approved.`,
      draft: `More ${l.unit || 'units'} were used than planned (+${l.dU}). [Explain the need.]${why}` });
  }
  return out;
}
