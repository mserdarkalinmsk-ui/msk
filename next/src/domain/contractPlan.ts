import type { Contract } from './contracts';
import { feeAt } from './contractFx';

/**
 * What the contracts ask of the months ahead: the payments month by month, the renewals to decide, and the papers missing.
 * Amounts are the contracts' own fees; one in another currency is turned into euros only at the rate its orders were
 * booked at (contractFx.impliedRate), never at an assumed rate.
 */

const ym = (d: Date) => d.toISOString().slice(0, 7);
/** The `n` months from the one of `from` (YYYY-MM each). */
export function monthsFrom(from: Date, n: number): string[] {
  return Array.from({ length: n }, (_, i) => ym(new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + i, 1))));
}
/** The last month a contract runs as signed, and the last it may run if renewed (no limit: open-ended or renewed each year). */
export function runs(c: Contract): { to?: string; renewedTo?: string } {
  const to = c.openEnded ? undefined : c.end?.slice(0, 7);
  const renewedTo = c.renewBy && (!c.end || c.renewBy > c.end) ? c.renewBy.slice(0, 7) : c.autoRenew ? '9999-12' : undefined;
  return { to, renewedTo };
}

export interface PlanRow { key: string; name: string; line?: string; cur: string; /** euros per unit of the row's currency, when known */ toEur?: number;
  /** each month: the fee in the contract's currency, and whether it falls after the signed end (only if renewed) */ cells: { v: number; renewal: boolean }[] }
/** Monthly payments of contracts with a monthly fee over the given months. */
export function paymentPlan(items: { key: string; name: string; c: Contract; rate?: number }[], months: string[]): PlanRow[] {
  return items.filter(({ c }) => c.fee || c.fees?.length).map(({ key, name, c, rate }) => {
    const { to, renewedTo } = runs(c), from = c.start?.slice(0, 7) ?? '0000-01', eur = !c.cur || c.cur === 'EUR';
    const cells = months.map((m) => {
      const inSigned = m >= from && (!to || m <= to), inRenewal = !inSigned && m >= from && !!to && !!renewedTo && m > to && m <= renewedTo;
      return inSigned || inRenewal ? { v: feeAt(c, m) ?? 0, renewal: inRenewal } : { v: 0, renewal: false };
    });
    return { key, name, line: c.line, cur: eur ? 'EUR' : c.cur!, toEur: eur ? 1 : rate ? 1 / rate : undefined, cells };
  }).filter((r) => r.cells.some((x) => x.v > 0));
}
/** Month totals in euros of the rows whose euro value is known, as signed and with the renewals. */
export function planTotals(R: PlanRow[]): { signed: number[]; withRenewals: number[]; unknown: number } {
  const n = R[0]?.cells.length ?? 0, signed = Array(n).fill(0), withRenewals = Array(n).fill(0);
  for (const r of R) if (r.toEur) r.cells.forEach((x, i) => { const e = x.v * r.toEur!; withRenewals[i] += e; if (!x.renewal) signed[i] += e; });
  const round = (A: number[]) => A.map((v) => Math.round(v * 100) / 100);
  return { signed: round(signed), withRenewals: round(withRenewals), unknown: R.filter((r) => !r.toEur).length };
}

export interface Renewal { key: string; name: string; end: string; noticeBy?: string; /** days to the notice deadline, else to the end */ days: number; renewBy?: string; autoRenew: boolean;
  fee?: number; cur: string; /** the next 12 months after the end at the fee in force, in the contract's currency */ year?: number; toEur?: number }
/** Contracts that end (or whose notice falls) within `within` days: what deciding to renew would cost for a year. */
export function renewals(items: { key: string; name: string; c: Contract; rate?: number }[], today: Date, within = 180): Renewal[] {
  const t = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()), day = 864e5;
  return items.flatMap(({ key, name, c, rate }) => {
    if (!c.end || c.openEnded) return [];
    const noticeBy = c.noticeDays ? new Date(Date.parse(c.end) - c.noticeDays * day).toISOString().slice(0, 10) : undefined;
    const endDays = Math.round((Date.parse(c.end) - t) / day), nDays = noticeBy ? Math.round((Date.parse(noticeBy) - t) / day) : undefined;
    const days = nDays != null && nDays >= 0 ? nDays : endDays;
    if (endDays < -30 || days > within) return [];
    const fee = feeAt(c, c.end.slice(0, 7)), eur = !c.cur || c.cur === 'EUR';
    // a year more at the fee in force at the end; a contract priced as a total, at its average month
    const months = c.start ? (+c.end.slice(0, 4) - +c.start.slice(0, 4)) * 12 + +c.end.slice(5, 7) - +c.start.slice(5, 7) + 1 : 0;
    const year = fee ? Math.round(fee * 12 * 100) / 100 : c.total && months > 0 ? Math.round(c.total / months * 12 * 100) / 100 : undefined;
    return [{ key, name, end: c.end, ...(noticeBy && nDays! >= 0 ? { noticeBy } : {}), days, renewBy: c.renewBy, autoRenew: !!c.autoRenew, fee, cur: eur ? 'EUR' : c.cur!, year, toEur: eur ? 1 : rate ? 1 / rate : undefined }];
  }).sort((a, b) => a.days - b.days);
}

export interface Gap { key: string; name: string; missing: string[] }
/** What a contract still lacks to be followed: its signed copy, an amendment's copy, an end date, its fee, a rate. */
export function contractGaps(items: { key: string; name: string; c: Contract; rate?: number }[]): Gap[] {
  return items.map(({ key, name, c, rate }) => {
    const m: string[] = [];
    if (!c.doc) m.push('the signed contract');
    const nod = (c.history ?? []).filter((h) => h.kind !== 'original' && !h.doc);
    if (nod.length) m.push(nod.length === 1 ? `the copy of the ${nod[0].kind}${nod[0].no ? ` ${nod[0].no}` : ''}` : `copies of ${nod.length} amendments`);
    if (!c.end && !c.openEnded) m.push('an end date');
    if (c.line && !c.fee && !c.fees?.length && !c.total) m.push('its fee');
    if (c.line && c.cur && c.cur !== 'EUR' && (c.fee || c.total) && !rate) m.push('an order naming the months it pays (for the rate)');
    return { key, name, missing: m };
  }).filter((g) => g.missing.length);
}

export interface Pace { used: number; cap: number; /** ordered per month over the last six months */ perMonth: number; /** the month the ceiling is reached at that pace */ reach?: string; /** reached before the contract ends */ beforeEnd: boolean }
/** How fast a contract's ceiling is used: the orders of the last six months, carried on. */
export function ceilingPace(cap: number, orders: { date: string; value: number }[], today: Date, end?: string): Pace {
  const used = Math.round(orders.reduce((a, o) => a + o.value, 0) * 100) / 100;
  const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 6, today.getUTCDate())).toISOString().slice(0, 10);
  const perMonth = Math.round(orders.filter((o) => o.date >= from && o.date <= today.toISOString().slice(0, 10)).reduce((a, o) => a + o.value, 0) / 6 * 100) / 100;
  if (used >= cap) return { used, cap, perMonth, reach: today.toISOString().slice(0, 7), beforeEnd: true };
  if (perMonth <= 0) return { used, cap, perMonth, beforeEnd: false };
  const n = Math.ceil((cap - used) / perMonth), reach = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + n, 1)).toISOString().slice(0, 7);
  return { used, cap, perMonth, reach, beforeEnd: !end || reach <= end.slice(0, 7) };
}

export interface LineNeed { line: string; /** next year in euros, of the contracts whose euro value is known */ eur: number; contracts: string[]; /** contracts in another currency with no rate yet */ unknown: string[] }
/** Next year's cost of the office contracts by budget line, for the budget proposal. */
export function needByLine(items: { name: string; c: Contract; rate?: number }[], year: number, cost: (c: Contract, y: number) => number | undefined): LineNeed[] {
  const by = new Map<string, LineNeed>();
  for (const { name, c, rate } of items) {
    if (!c.line) continue;
    const v = cost(c, year); if (!v) continue;
    const r = by.get(c.line) ?? { line: c.line, eur: 0, contracts: [], unknown: [] }, eur = !c.cur || c.cur === 'EUR';
    if (eur || rate) { r.eur += eur ? v : v / rate!; r.contracts.push(name); } else r.unknown.push(name);
    by.set(c.line, r);
  }
  return [...by.values()].map((r) => ({ ...r, eur: Math.round(r.eur * 100) / 100 })).sort((a, b) => a.line.localeCompare(b.line, 'en', { numeric: true }));
}
