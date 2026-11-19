import { unitFamily, unitsDiffer } from './ledger';
import { unitsLookTyped, type PO, type WorkbookSummary } from './workbook';

/**
 * Purchase-order review of one project: every PO line of the latest report checked against its budget line, and
 * every PO followed across the reports loaded so far. Each rule can be checked by hand in the report's
 * "Purchase Orders" sheet: nothing is guessed, a finding only says what the two figures are.
 */
export type PoKind =
  | 'over' | 'no-line' | 'unit' | 'typed' | 'rate' | 'dup' | 'no-units' | 'closed-balance'
  | 'moved' | 'raised' | 'reduced' | 'spent-down' | 'gone' | 'unit-changed' | 'units-changed' | 'described' | 'new';
export type PoGroup = 'error' | 'change' | 'unit';
export interface PoFinding { kind: PoKind; group: PoGroup; level: 'bad' | 'warn' | 'info'; po: string; line: string; supplier: string; description: string; text: string; /** euro amount the finding is about (gap, change, balance) */ amount: number }
export interface PoReport { date: string; label: string; wb: WorkbookSummary }
export interface PoHistoryRow { date: string; label: string; line: string; amount: number; spent: number; balance: number; units: number | null; unitType: string; status: string; description: string }
export interface PoReview { latest?: PoReport; previous?: PoReport; reports: number; pos: number; findings: PoFinding[]; history: (po: string) => PoHistoryRow[] }

export const PO_KIND: Record<PoKind, { label: string; group: PoGroup }> = {
  over: { label: 'Spent above the order', group: 'error' },
  'no-line': { label: 'Line not in the budget', group: 'error' },
  typed: { label: 'Amount typed as units', group: 'error' },
  dup: { label: 'Same order twice', group: 'error' },
  'closed-balance': { label: 'Closed with a balance', group: 'error' },
  moved: { label: 'Moved to another line', group: 'change' },
  raised: { label: 'Order raised', group: 'change' },
  reduced: { label: 'Order reduced', group: 'change' },
  'spent-down': { label: 'Spent went down', group: 'change' },
  gone: { label: 'Missing from the new report', group: 'change' },
  new: { label: 'New order', group: 'change' },
  unit: { label: 'Unit differs from the budget line', group: 'unit' },
  rate: { label: 'Unit cost above the budget rate', group: 'unit' },
  'no-units': { label: 'No units on the order', group: 'unit' },
  'unit-changed': { label: 'Unit changed', group: 'unit' },
  'units-changed': { label: 'Number of units changed', group: 'unit' },
  described: { label: 'Description changed', group: 'unit' },
};
export const PO_GROUP: Record<PoGroup, string> = { error: 'Possible errors', change: 'Changed between reports', unit: 'Units and descriptions' };

const r2 = (v: number) => Math.round(v * 100) / 100;
const eur = (v: number) => '€' + r2(v).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (v: number) => r2(v).toLocaleString('en-GB', { maximumFractionDigits: 2 });
const closed = (s: string) => /closed/i.test(s);
const sum = (L: PO[], f: (x: PO) => number) => r2(L.reduce((a, x) => a + f(x), 0));
const byPo = (L: PO[]) => { const M = new Map<string, PO[]>(); for (const x of L) if (x.po) M.set(x.po, [...(M.get(x.po) ?? []), x]); return M; };
const list = (S: Iterable<string>) => [...new Set(S)].filter(Boolean).sort().join(', ') || '—';

/** Reports in the order they were made (oldest first), each with its workbook; reports without POs are skipped. */
export function poReview(reports: PoReport[]): PoReview {
  const R = reports.filter((r) => r.wb.pos?.length);
  const latest = R.at(-1), previous = R.at(-2);
  const history = (po: string) => R.flatMap((r) => r.wb.pos.filter((x) => x.po === po).map((x) => ({ date: r.date, label: r.label, line: x.line, amount: r2(x.amount), spent: r2(x.spent), balance: r2(x.balance), units: x.units, unitType: x.unitType, status: x.status, description: x.description })));
  if (!latest) return { reports: 0, pos: 0, findings: [], history };
  const out: PoFinding[] = [];
  const add = (kind: PoKind, level: PoFinding['level'], x: Pick<PO, 'po' | 'line' | 'supplier' | 'description'>, text: string, amount: number) =>
    out.push({ kind, group: PO_KIND[kind].group, level, po: x.po, line: x.line, supplier: x.supplier, description: x.description, text, amount: r2(amount) });

  // ---- the latest report, line by line ----
  const wb = latest.wb;
  const leaf = new Map(wb.lines.filter((l) => l.leaf).map((l) => [l.code, l]));
  for (const x of wb.pos) {
    const l = leaf.get(x.line);
    const gap = x.spent - x.amount;
    if (gap > 0.5) add('over', gap > Math.max(100, x.amount * 0.1) ? 'warn' : 'info', x, `Ordered ${eur(x.amount)}, spent ${eur(x.spent)}: ${eur(gap)} (${x.amount > 0 ? Math.round(gap / x.amount * 100) + '%' : 'no order'}) above the order.`, gap);
    if (!x.line || (leaf.size && !l)) {
      const subs = [...leaf.keys()].filter((c) => x.line && c.startsWith(x.line + '.'));
      add('no-line', 'bad', x, !x.line ? 'The order has no budget line.' : subs.length ? `Line ${x.line} is a heading in the budget (${subs.join(', ')}): the order should be on one of its lines.` : `Line ${x.line} is not a line of the budget in this report.`, x.sc);
    }
    if (unitsLookTyped(x)) add('typed', 'warn', x, `${num(x.units ?? 0)} units for ${eur(x.amount)}: the amount looks typed in the units field.`, x.sc);
    if (closed(x.status) && x.balance > 0.5) add('closed-balance', 'warn', x, `Marked ${x.status.toLowerCase()} but ${eur(x.balance)} is still open on it.`, x.balance);
    if (!l) continue;
    if (x.unitType && l.unit && unitsDiffer(x.unitType, l.unit)) add('unit', 'warn', x, `Order counted "${x.unitType}"; line ${l.code} is budgeted "${l.unit}". The units and the cost per unit of the line come out wrong.`, x.sc);
    else if (x.units && x.units > 0 && x.amount > 0 && l.budget.rate && !unitsLookTyped(x)) {
      const rate = x.amount / x.units, b = l.budget.rate;
      if (rate > b * 1.5) add('rate', rate > b * 2 ? 'warn' : 'info', x, `${eur(rate)} per unit (${eur(x.amount)} for ${num(x.units)} ${x.unitType.toLowerCase() || 'units'}); the line is budgeted at ${eur(b)}: ${Math.round((rate / b - 1) * 100)}% more.`, x.amount - x.units * b);
    }
    if (!x.units && x.amount > 0.5 && !closed(x.status) && l.budget.units) add('no-units', 'info', x, `Open order of ${eur(x.amount)} with no units; line ${l.code} is budgeted in units (${l.unit || 'units'}).`, x.amount);
  }
  // the same order placed twice: other PO numbers, same supplier, description and amount
  const seen = new Map<string, PO>();
  for (const x of wb.pos) {
    if (x.amount <= 0.5 || !x.supplier) continue;
    const k = `${x.supplier.trim().toLowerCase()}|${x.description.trim().toLowerCase()}|${r2(x.amount)}`, y = seen.get(k);
    if (y && y.po !== x.po) add('dup', 'warn', x, `Same supplier, description and amount (${eur(x.amount)}) as PO ${y.po} on line ${y.line}.`, x.amount);
    else if (!y) seen.set(k, x);
  }

  // ---- report to report: every pair in turn, so a move made three reports ago is still seen ----
  for (let i = 1; i < R.length; i++) {
    const a = R[i - 1], b = R[i], last = i === R.length - 1, A = byPo(a.wb.pos), B = byPo(b.wb.pos);
    const when = last ? '' : ` (${a.label} → ${b.label})`;
    for (const [po, bl] of B) {
      const al = A.get(po), x = bl[0];
      if (!al) { if (last) add('new', 'info', x, `New since ${a.label}: ordered ${eur(sum(bl, (y) => y.amount))} on line ${list(bl.map((y) => y.line))}.`, sum(bl, (y) => y.amount)); continue; }
      const la = list(al.map((y) => y.line)), lb = list(bl.map((y) => y.line));
      if (la !== lb) add('moved', 'bad', x, `Was on line ${la} in ${a.label}, then on line ${lb} in ${b.label}. Check that the move was agreed.`, sum(bl, (y) => y.sc));
      const aa = sum(al, (y) => y.amount), ab = sum(bl, (y) => y.amount);
      if (ab > aa + 0.5) add('raised', 'warn', x, `Ordered ${eur(aa)} → ${eur(ab)}: +${eur(ab - aa)}${when}.`, ab - aa);
      else if (ab < aa - 0.5 && last) {
        const sb = sum(bl, (y) => y.spent), shut = bl.every((y) => closed(y.status));
        // closing an order down to what was spent is the normal end of a PO, not a change worth a look
        if (!(shut && Math.abs(ab - sb) < 0.5)) add('reduced', 'info', x, `Ordered ${eur(aa)} → ${eur(ab)}: −${eur(aa - ab)}${shut ? '' : ', order still open'}.`, ab - aa);
      }
      const sa = sum(al, (y) => y.spent), sb = sum(bl, (y) => y.spent);
      if (sb < sa - 0.5) add('spent-down', 'warn', x, `Spent ${eur(sa)} → ${eur(sb)}: −${eur(sa - sb)}, an invoice reversed or moved${when}.`, sb - sa);
      const ua = list(al.map((y) => y.unitType)), ub = list(bl.map((y) => y.unitType));
      // the same unit written another way ("Per Travel" / "Per trip") is not a change of unit
      if (list(al.map((y) => unitFamily(y.unitType))) !== list(bl.map((y) => unitFamily(y.unitType)))) add('unit-changed', 'warn', x, `Unit "${ua}" → "${ub}"${when}.`, sum(bl, (y) => y.sc));
      const na = sum(al, (y) => y.units ?? 0), nb = sum(bl, (y) => y.units ?? 0);
      if (last && Math.abs(na - nb) > 0.005) add('units-changed', Math.abs(ab - aa) < 0.5 ? 'warn' : 'info', x, `${num(na)} → ${num(nb)} units${Math.abs(ab - aa) < 0.5 ? ', the amount did not change' : ''}.`, sum(bl, (y) => y.sc));
      const da = list(al.map((y) => y.description)), db = list(bl.map((y) => y.description));
      if (da !== db) add('described', 'info', x, `"${da}" → "${db}"${when}.`, sum(bl, (y) => y.sc));
    }
    for (const [, al] of A) if (!B.has(al[0].po)) add('gone', 'warn', al[0], `In ${a.label} with ${eur(sum(al, (y) => y.amount))} ordered and ${eur(sum(al, (y) => y.spent))} spent; not in ${b.label}.`, -sum(al, (y) => y.sc));
  }
  const L = { bad: 0, warn: 1, info: 2 };
  out.sort((a, b) => L[a.level] - L[b.level] || Math.abs(b.amount) - Math.abs(a.amount));
  return { latest, previous, reports: R.length, pos: new Set(wb.pos.map((x) => x.po)).size, findings: out, history };
}
