import type { OfficeEntry, OfficeReport } from './office';

/**
 * The office's running services, read from its budget report: the orders of each budget line grouped by supplier,
 * named by what the order descriptions say ("Office Rent" is the rent contract, even on a line that also pays the tax
 * adviser), with the period the orders cover. Petty cash, missions and internal regularisations are not contracts.
 */
export interface OfficeService { line: string; lineName: string; supplier: string; kind: string; orders: OfficeEntry[]; amount: number; open: number; covers?: string; coverText?: string; last: string }

const KINDS: [string, RegExp][] = [
  ['Office rent', /\b(office\s+)?rent\b(?!al)|\bkira\b/i],
  ['Security', /security|guard|alarm|monitoring and intervention/i],
  ['Insurance', /insurance|sigorta/i],
  ['Cleaning', /clean/i],
  ['Electricity', /electric/i],
  ['Drinking water', /drinking water/i],
  ['Water', /water|aski/i],
  ['Internet', /internet|adsl|fibre|fiber/i],
  ['Telephone', /telephone|mobile phone|phone/i],
  ['Building maintenance', /maintenance|apartman|y[öo]neticili/i],
  ['Accounting and tax', /tax declaration|withholding|accounting|muhasebe|m[üu]şavir/i],
  ['Vehicle rental and fuel', /car rental|vehicle|petrol|fuel/i],
  ['Works and refurbishment', /refurbish|painting|renovat|works\b/i],
  ['Translation tools', /deepl|subscription/i],
];
/** Not contracts: advances to the office itself, missions, entries without a supplier. */
export const notContract = (supplier: string, description = '') => !supplier.trim() || /council of europe programme office|^missions\b|plan 01 general/i.test(supplier) || /petty cash|regul/i.test(description);

export function serviceKind(description: string, lineName: string): string {
  return (KINDS.find(([, re]) => re.test(description)) ?? KINDS.find(([, re]) => re.test(lineName)))?.[0] ?? lineName.replace(/\s*\(.*$/, '');
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const endOf = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10);
/** The last day an order's description says it covers: "from Feb to Dec 2026", "Jan-Feb-Mar 2026", "Q1 2026", "for 2026", "January 2026". */
export function coverEnd(d: string): string | undefined {
  const t = d.toLowerCase(), y = t.match(/\b(20\d\d)\b/g)?.map(Number).at(-1);
  if (!y) return undefined;
  const q = t.match(/(?:^|[^a-z0-9])q([1-4])\b/); if (q) return endOf(y, +q[1] * 3 - 1);
  const ms = [...t.matchAll(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/g)].map((m) => MONTHS.indexOf(m[1]));
  if (ms.length) return endOf(y, Math.max(...ms));
  if (new RegExp(`\\bfor (the year )?${y}\\b|\\b${y}\\s*$`).test(t)) return `${y}-12-31`;
  return undefined;
}

export function officeServices(r: OfficeReport): OfficeService[] {
  const name = new Map(r.lines.map((l) => [l.code, l.description]));
  const by = new Map<string, OfficeService>();
  for (const e of r.entries) {
    if (notContract(e.supplier, e.description)) continue;
    const lineName = name.get(e.line) ?? '', kind = serviceKind(e.description, lineName), k = `${e.line}|${e.supplier.trim().toLowerCase()}|${kind}`;
    const s = by.get(k) ?? { line: e.line, lineName, supplier: e.supplier.trim(), kind, orders: [], amount: 0, open: 0, last: '' };
    s.orders.push(e); s.amount += e.spent + e.committed; s.open += e.committed;
    if (e.date > s.last) s.last = e.date;
    const c = coverEnd(e.description); if (c && (!s.covers || c > s.covers)) { s.covers = c; s.coverText = e.description; }
    by.set(k, s);
  }
  return [...by.values()].map((s) => ({ ...s, amount: Math.round(s.amount * 100) / 100, open: Math.round(s.open * 100) / 100 }))
    .sort((a, b) => a.line.localeCompare(b.line, 'en', { numeric: true }) || b.amount - a.amount);
}
