/**
 * Tenders: a tender (a call for consultants, a framework) selects providers; each project buys from them under it.
 * The tender's threshold (the most it may spend) and, when set, the most per selected provider are checked against
 * what the orders of its providers add up to (spent + committed), in its projects and within its period.
 */
import type { ProviderPO } from './providers';
import { supKey } from './providers';

export interface Tender {
  id: string; name: string; ref?: string;
  /** the projects it serves (ids); empty: every project of its country */ projects: string[]; country?: string;
  kind?: string; threshold?: number; perMember?: number; start?: string; end?: string;
  /** the selected providers, by provider key, with the name as entered */ members: { key: string; name: string }[];
  note?: string; doc?: import('../ui/attach').Attachment;
  /** lots, when the tender has them: each with its own providers and threshold (the tender's members are then unused) */ lots?: Lot[];
}
export interface Lot { id: string; name: string; threshold?: number; perMember?: number; members: { key: string; name: string }[] }
export interface MemberUse { key: string; name: string; orders: number; spent: number; open: number; used: number; over: boolean; share: number }
export interface TenderUse { used: number; spent: number; open: number; share: number | null; level: 'ok' | 'warning' | 'serious' | 'critical'; members: MemberUse[]; overMembers: number; orders: ProviderPO[] }

const r2 = (v: number) => Math.round(v * 100) / 100;
/** 80% of the threshold a warning, 90% serious, reached or passed critical. */
export const useLevel = (used: number, cap?: number): TenderUse['level'] => (!cap ? 'ok' : used >= cap ? 'critical' : used >= cap * 0.9 ? 'serious' : used >= cap * 0.8 ? 'warning' : 'ok');

/** What a tender's providers were ordered, in its projects and period, against its threshold. */
export function tenderUse(t: Tender, all: ProviderPO[]): TenderUse {
  const keys = new Set(t.members.map((m) => m.key));
  const O = all.filter((x) => keys.has(supKey(x.supplier)) && (!t.projects.length ? !t.country || x.p.country === t.country : t.projects.includes(x.p.id))
    && (!t.start || !x.date || x.date >= t.start) && (!t.end || !x.date || x.date <= t.end));
  const members = t.members.map((m) => { const L = O.filter((x) => supKey(x.supplier) === m.key), used = r2(L.reduce((a, x) => a + x.value, 0)), spent = r2(L.reduce((a, x) => a + x.spent, 0));
    return { key: m.key, name: m.name, orders: L.length, spent, open: r2(used - spent), used, over: !!t.perMember && used > t.perMember, share: 0 }; });
  const used = r2(members.reduce((a, m) => a + m.used, 0)), spent = r2(members.reduce((a, m) => a + m.spent, 0));
  for (const m of members) m.share = used ? m.used / used : 0;
  return { used, spent, open: r2(used - spent), share: t.threshold ? used / t.threshold : null, level: useLevel(used, t.threshold), members: members.sort((a, b) => b.used - a.used), overMembers: members.filter((m) => m.over).length, orders: O };
}
/** Providers of a kind ordered in these projects but in no tender: bought without one. */
export function outsideTenders(T: Tender[], all: ProviderPO[], kinds: string[]): { key: string; name: string; used: number; orders: number }[] {
  const inT = new Set(T.flatMap((t) => [...t.members, ...(t.lots ?? []).flatMap((l) => l.members)].map((m) => m.key))), m = new Map<string, { key: string; name: string; used: number; orders: number }>();
  for (const x of all) { if (!x.kind || !kinds.includes(x.kind)) continue; const k = supKey(x.supplier); if (inT.has(k)) continue; const e = m.get(k) ?? { key: k, name: x.supplier.trim(), used: 0, orders: 0 }; e.used += x.value; e.orders++; m.set(k, e); }
  return [...m.values()].map((e) => ({ ...e, used: r2(e.used) })).sort((a, b) => b.used - a.used);
}

const RANK = { ok: 0, warning: 1, serious: 2, critical: 3 } as const;
/** A tender with lots: each lot against its own threshold, the tender's total against the tender's threshold. */
export function lotsUse(t: Tender, all: ProviderPO[]): { lots: { lot: Lot; use: TenderUse }[]; used: number; spent: number; share: number | null; level: TenderUse['level'] } {
  const lots = (t.lots ?? []).map((lot) => ({ lot, use: tenderUse({ ...t, members: lot.members, threshold: lot.threshold, perMember: lot.perMember ?? t.perMember }, all) }));
  const used = r2(lots.reduce((a, x) => a + x.use.used, 0)), spent = r2(lots.reduce((a, x) => a + x.use.spent, 0));
  const own = useLevel(used, t.threshold), worst = lots.map((x) => x.use.level).reduce((a, b) => (RANK[b] > RANK[a] ? b : a), own);
  return { lots, used, spent, share: t.threshold ? used / t.threshold : null, level: worst };
}
