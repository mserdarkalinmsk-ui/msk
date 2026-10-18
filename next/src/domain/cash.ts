import { money, n, parseDate, spendPoints } from './calc';
import type { Project } from './types';

const DAY = 864e5, MONTH = 30.44 * DAY;

/** Monthly pace of spending: the last six months of reports, else the average since the start. */
export function pace(p: Project, today: Date): number {
  const pts = spendPoints(p).filter((x) => x.t <= today.getTime()), last = pts.at(-1);
  const back = last ? [...pts].reverse().find((x) => last.t - x.t >= 5 * MONTH) : undefined;
  const months = Math.max(1, (today.getTime() - parseDate(p.start).getTime()) / MONTH);
  return last && back && last.t > back.t ? Math.max(0, (last.v - back.v) / ((last.t - back.t) / MONTH)) : money(p).spent / months;
}

export interface EndingRow { p: Project; monthsLeft: number; budget: number; spent: number; sc: number; remaining: number; pace: number; need: number; unspent: number; share: number; level: 'bad' | 'warn' | 'ok' }
/**
 * Projects ending within `within` months: what is left, the monthly spending needed to use it by the end date,
 * the current pace, and what would stay unspent (to be returned) at that pace. Commitments count as used.
 */
export function ending(P: Project[], today: Date, within = 12): EndingRow[] {
  const t = today.getTime();
  return P.filter((p) => !p.datesTbc && parseDate(p.end).getTime() > t && parseDate(p.end).getTime() - t <= within * MONTH).map((p) => {
    const m = money(p), monthsLeft = Math.max(0.5, (parseDate(p.end).getTime() - t) / MONTH);
    const sc = m.spent + m.committed, remaining = Math.max(0, m.budget - sc), pc = pace(p, today);
    const need = remaining / monthsLeft, unspent = Math.max(0, remaining - pc * monthsLeft), share = m.budget ? unspent / m.budget : 0;
    return { p, monthsLeft, budget: m.budget, spent: m.spent, sc, remaining, pace: pc, need, unspent, share, level: share > 0.1 ? 'bad' : share > 0.03 ? 'warn' : 'ok' } as EndingRow;
  }).sort((a, b) => b.unspent - a.unspent);
}
export interface CashRow {
  p: Project; contribution: number; received: number; expected: boolean; spent: number; committed: number;
  cash: number; used: number; threshold: number; burn: number; runout: string | null; request: 'now' | 'soon' | 'later' | 'none'; requestOn: string | null;
}

/**
 * Cash position of a project: money received from the donor (entered payments, or the contract's pre-financing
 * when none is entered yet) against what has been spent, the monthly pace of spending, when the cash runs out and
 * when the next payment can be requested — once `threshold` (70 % by default) of the money received is used.
 */
export function cashRow(p: Project, today: Date, threshold = 0.7): CashRow {
  const c = (p.contract ?? {}) as { total?: number; euMax?: number; prefin?: number; firstPayment?: number; payThreshold?: number };
  // The contract's own rule for the next payment wins over the screen setting.
  if (Number(c.payThreshold) > 0) threshold = Number(c.payThreshold) / 100;
  const m = money(p), contribution = Number(c.euMax) || Number(c.total) || m.budget;
  const paid = (p.payments ?? []).reduce((a, x) => a + n(x.amount), 0);
  const expected = !paid && !!(Number(c.firstPayment) || Number(c.prefin));
  const received = paid || (expected ? Number(c.firstPayment) || contribution * Number(c.prefin) / 100 : 0);
  const burn = pace(p, today);
  const cash = received - m.spent, used = received ? m.spent / received : 0;
  const at = (amount: number) => (burn > 0 ? new Date(today.getTime() + (amount / burn) * MONTH).toISOString().slice(0, 10) : null);
  const runout = received ? (cash <= 0 ? today.toISOString().slice(0, 10) : at(cash)) : null;
  const toThreshold = received * threshold - m.spent;
  const requestOn = received ? (toThreshold <= 0 ? today.toISOString().slice(0, 10) : at(toThreshold)) : null;
  const ended = p.end < today.toISOString().slice(0, 10);
  const request: CashRow['request'] = !received || ended || received >= contribution - 1 ? 'none' : toThreshold <= 0 ? 'now'
    : requestOn && Date.parse(requestOn) - today.getTime() < 90 * DAY ? 'soon' : 'later';
  return { p, contribution, received, expected, threshold, spent: m.spent, committed: m.committed, cash, used, burn, runout, request, requestOn };
}
