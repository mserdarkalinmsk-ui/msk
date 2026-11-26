/**
 * One card per provider or per person: everything the app knows about them, gathered from every project, so the user
 * does not have to look in Providers, Contracts, PO review and Staff one after the other.
 */
import type { ProviderPO } from './providers';
import { contractSupKey, supKey } from './providers';
import type { Person } from './staff';
import { personKeyOf, type CoreMember } from './coreTeam';
import type { Contract } from './contracts';

export interface ProjectShare { id: string; n: number; amount: number; spent: number; sc: number; open: number; lines: string[] }
export interface ProviderCard {
  key: string; name: string; kinds: string[]; pos: ProviderPO[]; projects: ProjectShare[];
  total: { n: number; amount: number; spent: number; sc: number; open: number }; contracts: { key: string; c: Contract }[];
}
const r2 = (v: number) => Math.round(v * 100) / 100;

/** The card of the provider whose key is `key`: its orders in every project (newest first) and its contracts. */
export function providerCard(all: ProviderPO[], key: string, FW: Record<string, Contract> = {}): ProviderCard | null {
  // a contract under its own (Turkish, or scanned) spelling belongs to the provider whose orders are the same company
  const known = new Map<string, string>(); for (const x of all) if (x.supplier.trim()) known.set(supKey(x.supplier), x.supplier.trim());
  const owner = (k: string, c: Contract) => (c.line ? k.split(':').slice(3).join(':') : contractSupKey(k, c.name, known));
  const sk = known.has(key) ? key : FW[key] ? owner(key, FW[key]) : key;
  const pos = all.filter((x) => supKey(x.supplier) === sk).sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.value - a.value);
  const contracts = Object.entries(FW).filter(([k, c]) => k === key || k === sk || owner(k, c) === sk).map(([k, c]) => ({ key: k, c }));
  if (!pos.length && !contracts.length) return null;
  // the spelling used most often
  const seen = new Map<string, number>(); for (const x of pos) seen.set(x.supplier.trim(), (seen.get(x.supplier.trim()) ?? 0) + 1);
  const name = [...seen].sort((a, b) => b[1] - a[1])[0]?.[0] ?? contracts[0]?.c.name ?? key;
  const by = new Map<string, ProjectShare>();
  for (const x of pos) {
    const s = by.get(x.p.id) ?? { id: x.p.id, n: 0, amount: 0, spent: 0, sc: 0, open: 0, lines: [] };
    s.n++; s.amount += x.amount; s.spent += x.spent; s.sc += x.value; s.open += x.value - x.spent;
    if (!s.lines.includes(x.line)) s.lines.push(x.line);
    by.set(x.p.id, s);
  }
  const projects = [...by.values()].map((s) => ({ ...s, amount: r2(s.amount), spent: r2(s.spent), sc: r2(s.sc), open: r2(s.open), lines: s.lines.sort() })).sort((a, b) => b.sc - a.sc);
  const sum = (k: 'amount' | 'spent' | 'sc' | 'open') => r2(projects.reduce((a, s) => a + s[k], 0));
  return { key: sk, name, kinds: [...new Set(pos.map((x) => x.kind).filter(Boolean) as string[])], pos, projects, total: { n: pos.length, amount: sum('amount'), spent: sum('spent'), sc: sum('sc'), open: sum('open') }, contracts };
}

export interface PersonCard { key: string; name: string; roles: Person[]; core: { country: string; m: CoreMember }[] }
/** The card of a person: their contracts on every project and their place on a country's core team. */
export function personCard(people: Person[], core: Record<string, CoreMember[]>, key: string): PersonCard | null {
  const roles = people.filter((a) => personKeyOf(a.name) === key || personKeyOf(a.display) === key).sort((a, b) => (b.end || '9').localeCompare(a.end || '9'));
  const cm = Object.entries(core).flatMap(([country, M]) => M.filter((m) => personKeyOf(m.name) === key).map((m) => ({ country, m })));
  if (!roles.length && !cm.length) return null;
  return { key, name: cm[0]?.m.name ?? roles[0].display ?? roles[0].name, roles, core: cm };
}

/** Providers to search: one entry each, with what was ordered from them. */
export function providerIndex(all: ProviderPO[]): { key: string; name: string; sc: number; n: number }[] {
  const m = new Map<string, { key: string; name: string; sc: number; n: number }>();
  for (const x of all) { if (!x.supplier.trim()) continue; const k = supKey(x.supplier), e = m.get(k) ?? { key: k, name: x.supplier.trim(), sc: 0, n: 0 }; e.sc += x.value; e.n++; m.set(k, e); }
  return [...m.values()].sort((a, b) => b.sc - a.sc);
}
