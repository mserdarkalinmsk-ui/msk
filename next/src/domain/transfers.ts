import { HEADINGS } from './calc';
import type { CompareLine } from './ledger';

export interface LineMove { from: string; to: string; amount: number }
export interface TransferPlan { moves: LineMove[]; lines: { code: string; description: string; budget: number; after: number; sc: number }[]; heads: { h: string; label: string; budget: number; after: number; change: number; beyond: boolean }[]; beyond: boolean }

const staff = (c: string) => /^1\.[12]\.1(\.|$)/.test(c);
const head = (c: string) => c.split('.')[0];
const up = (v: number) => Math.ceil(v - 0.005);

/**
 * Transfers that bring every line back within its budget: first from lines of the same heading (free), then from
 * the lines with the most budget left in other headings (a notification while each heading stays within the
 * flexibility, an addendum beyond). Staff salary lines and administrative costs never give. Whole euros.
 */
export function lineTransfers(L: CompareLine[], flex: number): TransferPlan {
  const after = new Map(L.map((l) => [l.code, l.budget]));
  const left = (c: string) => (after.get(c) ?? 0) - (L.find((l) => l.code === c)?.sc ?? 0);
  const moves: LineMove[] = [];
  const give = (to: string, need: number, pool: CompareLine[]) => {
    for (const d of [...pool].sort((a, b) => left(b.code) - left(a.code))) {
      if (need <= 0) break; const can = Math.floor(left(d.code)); if (can <= 0) continue;
      const a = Math.min(can, need); moves.push({ from: d.code, to, amount: a }); after.set(d.code, after.get(d.code)! - a); after.set(to, after.get(to)! + a); need -= a;
    }
    return need;
  };
  const donors = L.filter((l) => !staff(l.code) && head(l.code) !== '10' && head(l.code) !== '8' && l.budget > 0);
  for (const o of L.filter((l) => l.sc > l.budget + 0.5 && head(l.code) !== '10').sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))) {
    let need = up(o.sc - o.budget);
    need = give(o.code, need, donors.filter((d) => d.code !== o.code && head(d.code) === head(o.code)));
    if (need > 0) give(o.code, need, donors.filter((d) => head(d.code) !== head(o.code)));
  }
  const hs = [...new Set(L.map((l) => head(l.code)))].filter((h) => h !== '10');
  const heads = hs.map((h) => { const X = L.filter((l) => head(l.code) === h), b = X.reduce((a, l) => a + l.budget, 0), a = X.reduce((s, l) => s + (after.get(l.code) ?? 0), 0), change = b ? (a - b) / b : 0;
    return { h, label: HEADINGS[h] ?? h, budget: b, after: a, change, beyond: Math.abs(change) > flex + 1e-9 }; });
  return { moves, lines: L.map((l) => ({ code: l.code, description: l.description, budget: l.budget, after: after.get(l.code) ?? l.budget, sc: l.sc })), heads, beyond: heads.some((h) => h.beyond) };
}
