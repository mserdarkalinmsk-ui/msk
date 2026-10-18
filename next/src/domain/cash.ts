import { money, n, parseDate, spendPoints } from './calc';
import type { Project } from './types';

const DAY = 864e5, MONTH = 30.44 * DAY;
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
  // Pace: spending over the last six months of reports, else the average since the start.
  const pts = spendPoints(p).filter((x) => x.t <= today.getTime()), last = pts.at(-1);
  const back = last ? [...pts].reverse().find((x) => last.t - x.t >= 5 * MONTH) : undefined;
  const months = Math.max(1, (today.getTime() - parseDate(p.start).getTime()) / MONTH);
  const burn = last && back && last.t > back.t ? Math.max(0, (last.v - back.v) / ((last.t - back.t) / MONTH)) : m.spent / months;
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
