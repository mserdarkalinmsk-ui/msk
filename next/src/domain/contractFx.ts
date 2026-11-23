import type { Contract } from './contracts';

/**
 * A contract written in another currency (TRY) against an office budget kept in euros. The office report holds no
 * exchange rate, but each order says the period it pays ("Office Rent - Jan-Feb-Mar 2026", "Q2 2026", "from Feb to
 * Dec 2026") and its amount in euros: the contract's monthly fee × those months ÷ the euros booked is the rate the
 * office actually paid at. Nothing is assumed when an order names no period.
 */

const MON = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/g;
const IDX: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const ORD: Record<string, number> = { '1st': 1, first: 1, '2nd': 2, second: 2, '3rd': 3, third: 3, '4th': 4, fourth: 4 };

/** The months an order pays, from its description: its first month (YYYY-MM) and how many. */
export function orderPeriod(description: string): { from: string; months: number } | undefined {
  const t = description.toLowerCase(), y = t.match(/\b(20\d\d)\b/)?.[1];
  if (!y) return undefined;
  const q = t.match(/(?:^|[^a-z0-9])q([1-4])\b/)?.[1] ?? (() => { const m = t.match(/\b(1st|2nd|3rd|4th|first|second|third|fourth)\s+quarter\b/); return m ? String(ORD[m[1]]) : undefined; })();
  if (q) return { from: `${y}-${String(+q * 3 - 2).padStart(2, '0')}`, months: 3 };
  const ms = [...t.matchAll(MON)].map((m) => IDX[m[1].slice(0, 3)]);
  if (ms.length) { const a = Math.min(...ms), b = Math.max(...ms); return { from: `${y}-${String(a + 1).padStart(2, '0')}`, months: b - a + 1 }; }
  if (new RegExp(`\\bfor (?:the year )?${y}\\b`).test(t)) return { from: `${y}-01`, months: 12 };
  return undefined;
}

/** The monthly fee in force in a month (YYYY-MM): the latest revision applying by then, else the fee typed. */
export function feeAt(c: Contract, ym: string): number | undefined {
  const f = (c.fees ?? []).filter((x) => x.from.slice(0, 7) <= ym).at(-1);
  return f?.fee ?? (c.fees?.length && c.fees[0].from.slice(0, 7) > ym ? c.fees[0].fee : c.fee);
}

export interface ImpliedRate { /** units of the contract's currency per euro */ rate: number; /** orders it was read from */ n: number }
/** The rate the orders were booked at: the median over the orders that name their period (one odd order does not move it). */
export function impliedRate(c: Contract, orders: { description: string; amount: number }[]): ImpliedRate | undefined {
  if (!c.cur || c.cur === 'EUR' || !(c.fee || c.fees?.length)) return undefined;
  const R = orders.flatMap((o) => { const p = orderPeriod(o.description), fee = p && feeAt(c, p.from); return p && fee && o.amount > 0.5 ? [fee * p.months / o.amount] : []; }).sort((a, b) => a - b);
  if (!R.length) return undefined;
  const m = R.length >> 1, rate = R.length % 2 ? R[m] : (R[m - 1] + R[m]) / 2;
  return { rate: Math.round(rate * 10000) / 10000, n: R.length };
}

/** What a contract costs in a calendar year, in its own currency: each month it runs, at the fee in force then. */
export function yearCost(c: Contract, year: number): number | undefined {
  const a = c.start && c.start.slice(0, 4) === String(year) ? +c.start.slice(5, 7) : c.start && c.start.slice(0, 4) > String(year) ? 13 : 1;
  const b = c.openEnded || !c.end ? 12 : c.end.slice(0, 4) === String(year) ? +c.end.slice(5, 7) : c.end.slice(0, 4) < String(year) ? 0 : 12;
  if (b < a) return 0;
  if (c.fee || c.fees?.length) { let s = 0; for (let m = a; m <= b; m++) s += feeAt(c, `${year}-${String(m).padStart(2, '0')}`) ?? 0; return Math.round(s * 100) / 100; }
  if (c.total && c.start && c.end) {
    const all = (+c.end.slice(0, 4) - +c.start.slice(0, 4)) * 12 + +c.end.slice(5, 7) - +c.start.slice(5, 7) + 1;
    return Math.round(c.total * (b - a + 1) / all * 100) / 100;
  }
  return undefined;
}
