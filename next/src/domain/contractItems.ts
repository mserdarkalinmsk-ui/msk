import type { Contract } from './contracts';
import type { OfficeEntry, OfficeReport, Office } from './office';
import type { Project } from './types';
import { notContract, serviceKind } from './officeServices';
import { contractSupKey, providerPOs, supKey } from './providers';
import { feeAt, impliedRate, orderPeriod } from './contractFx';
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
    .map(([key, c]) => ({ key, c, name: c.name || names.get(key) || key, rate: c.line && rep ? impliedRate(c, officeOrders(rep, key, c))?.rate : undefined }));
  // a contract written in another language (or read from a scan) is the provider whose name is the same company
  const ordersOf = (key: string, c: Contract) => { const sk = contractSupKey(key, c.name, names); return [...L.filter((x) => x.kind && supKey(x.supplier) === sk).map((x) => ({ date: x.date, value: x.value, po: x.po, description: x.description, project: x.p.code })),
    ...(c.line ? [] : officeEntriesFor(offices, key, c).map((e) => ({ date: e.date, value: e.amount, po: e.doc, description: e.description, project: 'Office' })))]; };
  return { items, rep, ordersOf, names };
}

/** Provider contracts whose ceiling is reached before they end at the pace of the last six months (or already reached). */
export function ceilingsAtRisk(items: CItem[], ordersOf: (k: string, c: Contract) => { date: string; value: number }[], today: Date, within = 6): (CItem & { p: Pace })[] {
  const lim = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + within, 1)).toISOString().slice(0, 7);
  return items.filter((x) => x.c.cap && !x.c.line).map((x) => ({ ...x, p: ceilingPace(x.c.cap!, ordersOf(x.key, x.c), today, x.c.end) }))
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
export function stillToOrder(c: Contract, orders: { description: string }[], year: number): { from?: string; months: number; amount: number } {
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
