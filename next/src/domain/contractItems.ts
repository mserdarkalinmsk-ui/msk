import { capEur, type Contract } from './contracts';
import type { OfficeEntry, OfficeReport, Office } from './office';
import type { Project } from './types';
import { notContract, serviceKind } from './officeServices';
import { contractSupKey, providerPOs, supKey } from './providers';
import { feeAt, impliedRate, orderPeriod, withMonthlyFee } from './contractFx';
import { ceilingPace, renewals, type Pace, type Renewal } from './contractPlan';

/** The office report's orders of an office contract: its line, its supplier, the same kind of service. */
export function officeOrders(rep: OfficeReport, k: string, c: Contract) {
  const sk = k.split(':').slice(3).join(':'), l = rep.lines.find((x) => x.code === c.line);
  return rep.entries.filter((e) => e.line === c.line && supKey(e.supplier) === sk && (!c.kind || serviceKind(e.description, l?.description ?? '') === c.kind))
    .map((e) => ({ description: e.description, amount: e.spent + e.committed, fund: e.fund }));
}

export interface CItem { key: string; name: string; c: Contract; rate?: number }
/**
 * A country's contracts: those of the providers its projects order from, and those entered for it. An office contract in
 * another currency carries the rate its orders were booked at; a provider's contract, the projects' orders it covers.
 */
export function countryContracts(FW: Record<string, Contract>, P: Project[], poKinds: Record<string, string>, offices: Office[], cid: string) {
  const L = providerPOs(P, poKinds), names = new Map<string, string>();
  for (const x of L) if (x.kind && x.supplier.trim()) names.set(supKey(x.supplier), x.supplier.trim());
  const rep = offices[0]?.reports.at(-1);
  const items: CItem[] = Object.entries(FW).filter(([k, c]) => names.has(k) || c.country === cid)
    .map(([k0, c0]) => { const { key, c } = asOfficeContract(offices, cid, k0, c0);
      return { key, c, name: c.name || names.get(k0) || k0, rate: c.line && rep ? impliedRate(c, officeOrders(rep, key, c))?.rate : undefined }; });
  // a contract written in another language (or read from a scan) is the provider whose name is the same company
  const ordersOf = (key: string, c: Contract) => { const sk = contractSupKey(key, c.name, names); return [...L.filter((x) => x.kind && supKey(x.supplier) === sk).map((x) => ({ date: x.date, value: x.value, po: x.po, description: x.description, project: x.p.code })),
    ...(c.line ? [] : officeEntriesFor(offices, key, c).map((e) => ({ date: e.date, value: e.amount, po: e.doc, description: e.description, project: 'Office' })))]; };
  return { items, rep, ordersOf, names };
}

/** Provider contracts whose ceiling is reached before they end at the pace of the last six months (or already reached). */
export function ceilingsAtRisk(items: CItem[], ordersOf: (k: string, c: Contract) => { date: string; value: number }[], today: Date, within = 6): (CItem & { p: Pace })[] {
  const lim = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + within, 1)).toISOString().slice(0, 7);
  return items.filter((x) => capEur(x.c, x.rate) && !x.c.line).map((x) => ({ ...x, p: ceilingPace(capEur(x.c, x.rate)!, ordersOf(x.key, x.c), today, x.c.end) }))
    .filter((x) => x.p.beforeEnd && x.p.reach && x.p.reach <= lim);
}
/** What a country's contracts ask for this month: renewals to decide within `days`, and ceilings at risk. */
export function contractWatch(items: CItem[], ordersOf: (k: string, c: Contract) => { date: string; value: number }[], today: Date, days = 90): { renew: Renewal[]; caps: (CItem & { p: Pace })[] } {
  return { renew: renewals(items, today, days), caps: ceilingsAtRisk(items, ordersOf, today) };
}

/**
 * What an office contract still needs ordered this year: the months after the last one its orders pay, to the end of the
 * year (or of the contract, unless it renews), at the fee in force — in its own currency.
 */
export function stillToOrder(c0: Contract, orders: { description: string }[], year: number): { from?: string; months: number; amount: number } {
  const c = withMonthlyFee(c0);
  let last = '';
  for (const o of orders) { const p = orderPeriod(o.description); if (!p) continue; const d = new Date(Date.UTC(+p.from.slice(0, 4), +p.from.slice(5, 7) - 1 + p.months - 1, 1)).toISOString().slice(0, 7); if (d > last) last = d; }
  const start = c.start?.slice(0, 7) ?? `${year}-01`, next = last ? new Date(Date.UTC(+last.slice(0, 4), +last.slice(5, 7), 1)).toISOString().slice(0, 7) : start;
  const from = [next, start, `${year}-01`].sort().at(-1)!;
  const stop = c.openEnded || c.autoRenew || !c.end ? `${year}-12` : [c.end.slice(0, 7), `${year}-12`].sort()[0];
  let months = 0, amount = 0;
  for (let m = from; m <= stop; m = new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 1)).toISOString().slice(0, 7)) { const f = feeAt(c, m); if (f) { months++; amount += f; } }
  return months ? { from, months, amount: Math.round(amount * 100) / 100 } : { months: 0, amount: 0 };
}

/**
 * The office's own orders under a contract, from the latest office report of each office: an office contract's line and
 * supplier; any other contract's supplier wherever the office ordered from it (a car rental, an accountant) — the office
 * report, not the projects' purchase orders, holds what the office spends.
 */
export function officeEntriesFor(offices: Office[], key: string, c: Contract): (OfficeEntry & { office: string })[] {
  const out: (OfficeEntry & { office: string })[] = [];
  for (const o of offices) {
    const rep = o.reports.at(-1); if (!rep) continue;
    if (c.line) { if (key.startsWith(`office:${o.country}:`)) { const sk = key.split(':').slice(3).join(':'), l = rep.lines.find((x) => x.code === c.line);
      out.push(...rep.entries.filter((e) => e.line === c.line && supKey(e.supplier) === sk && (!c.kind || serviceKind(e.description, l?.description ?? '') === c.kind)).map((e) => ({ ...e, office: o.name }))); } continue; }
    const E = rep.entries.filter((e) => !notContract(e.supplier, e.description));
    const known = new Map(E.map((e) => [supKey(e.supplier), e.supplier.trim()])), sk = contractSupKey(key, c.name, known);
    if (known.has(sk)) out.push(...E.filter((e) => supKey(e.supplier) === sk).map((e) => ({ ...e, office: o.name })));
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * A contract the office pays from its own budget, though entered as a provider's: the office report's orders from the
 * same provider give its budget line (the one with the most spent and committed) and what the service is, so the
 * office's sums — still to order, next year by line, the forecast check — count it as they count an office contract.
 */
export function asOfficeContract(offices: Office[], cid: string, key: string, c: Contract): { key: string; c: Contract } {
  if (c.line) return { key, c };
  const E = officeEntriesFor(offices.filter((o) => o.country === cid), key, c);
  if (!E.length) return { key, c };
  const by = new Map<string, number>(); for (const e of E) by.set(e.line, (by.get(e.line) ?? 0) + e.amount);
  const line = [...by].sort((a, b) => b[1] - a[1])[0][0], top = E.find((e) => e.line === line)!;
  const rep = offices.find((o) => o.country === cid)?.reports.at(-1), lineName = rep?.lines.find((l) => l.code === line)?.description ?? '';
  return { key: `office:${cid}:${line}:${supKey(top.supplier)}`, c: { ...c, line, kind: serviceKind(top.description, lineName) } };
}
