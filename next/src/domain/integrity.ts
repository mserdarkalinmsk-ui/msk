import { budgetOnly, lineExposure, lines, n, reportsByDate } from './calc';
import { crossDocs } from './crossdocs';
import { roster } from './staff';
import type { Project } from './types';

/**
 * Cross-checks between the pieces of data of a project: the same purchase order on two budget lines, purchase orders
 * above what the line reports, spent above spent + committed, a report whose total goes down from the previous one,
 * reversals left negative, and the same person under two names. Each finding says where to look.
 */
/** The records behind a finding, shown as a table, and the project tab where they can be looked at. */
export interface Detail { title: string; cols: string[]; rows: (string | number)[][]; num?: number[] }
export type Tab = 'Summary' | 'Financial report' | 'Budget lines' | 'Reports' | 'Staff';
export interface Integrity { level: 'info' | 'warn' | 'bad'; text: string; where: string; tab?: Tab; detail?: Detail }
const eur = (v: number) => `€${v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const n2 = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z]/g, '');

export function integrity(p: Project, today: Date): Integrity[] {
  const out: Integrity[] = [], add = (level: Integrity['level'], text: string, where: string, tab?: Tab, detail?: Detail) => out.push({ level, text, where, tab, detail });
  const R = reportsByDate(p).filter((r) => r.snapshot?.lines?.length && !budgetOnly(r)), last = R.at(-1);
  const L = lines(p), leaf = L.filter((l) => !L.some((o) => o !== l && o.code.startsWith(l.code + '.')));

  // Purchase orders of the latest report workbook.
  const pos = last?.snapshot?.workbook?.pos ?? [];
  const byPo = new Map<string, Set<string>>();
  for (const x of pos) if (x.po) byPo.set(x.po, (byPo.get(x.po) ?? new Set()).add(x.line));
  const multi = [...byPo].filter(([, s]) => s.size > 1);
  if (multi.length) add('warn', `${multi.length} purchase order${multi.length > 1 ? 's' : ''} on more than one budget line (${multi.slice(0, 3).map(([po, s]) => `${po}: ${[...s].join(' / ')}`).join('; ')}${multi.length > 3 ? '…' : ''}) — check the split is intended`, 'Purchase orders', 'Financial report',
    { title: `Purchase orders on more than one budget line · ${last!.name}`, cols: ['PO', 'Supplier', 'Description', 'Line', 'Spent + committed'], num: [4],
      rows: multi.flatMap(([po]) => pos.filter((x) => x.po === po).map((x) => [po, x.supplier, x.description || x.nature, x.line, x.sc || x.amount])) });
  if (pos.length) {
    const over = leaf.map((l) => ({ l, po: pos.filter((x) => x.line === l.code).reduce((a, x) => a + (x.sc || x.amount), 0) })).filter((x) => x.po > lineExposure(x.l) + 1);
    if (over.length) add('warn', `Purchase orders above the reported spent + committed on ${over.slice(0, 4).map((x) => `${x.l.code} (${eur(x.po - lineExposure(x.l))} more)`).join(', ')}${over.length > 4 ? '…' : ''} — an order may be on the wrong line or not yet in the report`, 'Purchase orders', 'Budget lines',
      { title: 'Purchase orders above the line\'s spent + committed', cols: ['Line', 'Description', 'Spent + committed (report)', 'Purchase orders', 'Difference'], num: [2, 3, 4],
        rows: over.map((x) => [x.l.code, x.l.description ?? '', lineExposure(x.l), x.po, x.po - lineExposure(x.l)]) });
  }

  // Lines that do not hold together.
  const scBelow = leaf.filter((l) => l.spentCommitted != null && n(l.actual) > n(l.spentCommitted) + 1);
  if (scBelow.length) add('bad', `Spent above spent + committed on ${scBelow.slice(0, 4).map((l) => l.code).join(', ')}${scBelow.length > 4 ? '…' : ''} — the commitments column is short`, 'Latest report', 'Budget lines',
    { title: 'Spent above spent + committed', cols: ['Line', 'Description', 'Spent', 'Spent + committed', 'Short by'], num: [2, 3, 4], rows: scBelow.map((l) => [l.code, l.description ?? '', n(l.actual), n(l.spentCommitted), n(l.actual) - n(l.spentCommitted)]) });
  const neg = leaf.filter((l) => n(l.actual) < -1);
  if (neg.length) add('warn', `Negative spent on ${neg.slice(0, 4).map((l) => `${l.code} (${eur(n(l.actual))})`).join(', ')} — a reversal without its original entry`, 'Latest report', 'Budget lines',
    { title: 'Negative spent', cols: ['Line', 'Description', 'Spent'], num: [2], rows: neg.map((l) => [l.code, l.description ?? '', n(l.actual)]) });

  // Each report against the previous one: the cumulative spent should not go down.
  for (let i = 1; i < R.length; i++) {
    const a = R[i - 1].snapshot!.lines.reduce((s, l) => s + n(l.actual), 0), b = R[i].snapshot!.lines.reduce((s, l) => s + n(l.actual), 0);
    const prev = (code: string) => R[i - 1].snapshot!.lines.find((x) => x.code === code);
    const ch = R[i].snapshot!.lines.map((l) => ({ l, d: n(l.actual) - n(prev(l.code)?.actual) })).filter((x) => Math.abs(x.d) > 1);
    const down = ch.filter((x) => x.d < 0), up = ch.filter((x) => x.d > 0);
    if (!down.length) continue;
    const out_ = -down.reduce((s, x) => s + x.d, 0), in_ = up.reduce((s, x) => s + x.d, 0);
    const det: Detail = { title: `Spent by line: ${R[i - 1].name} (${R[i - 1].date}) → ${R[i].name} (${R[i].date})`, cols: ['Line', 'Description', 'Before', 'After', 'Change'], num: [2, 3, 4],
      rows: [...down, ...up.sort((a, b) => b.d - a.d)].map(({ l, d }) => [l.code, l.description ?? '', n(prev(l.code)?.actual), n(l.actual), d]) };
    const codes = (X: typeof ch) => `${X.slice(0, 4).map((x) => x.l.code).join(', ')}${X.length > 4 ? '…' : ''}`;
    if (b < a - 1) add('warn', `Spent goes down from ${eur(a)} (${R[i - 1].date}) to ${eur(b)} (${R[i].date}) — a correction, or a report of another project`, 'Reports', 'Reports', det);
    // Lines lower than before while others rose by at least as much: entries moved between lines (reclassification).
    else if (out_ <= in_ + 1) { if (out_ > 1000) add('info', `${R[i].date}: ${eur(out_)} reclassified from ${codes(down)} to other lines (${codes(up)}) — spent did not go down in total`, 'Reports', 'Reports', det); }
    else add('warn', `${R[i].date}: spent lower than in the previous report on ${codes(down)} by ${eur(out_)}, only ${eur(in_)} rose elsewhere — ${eur(out_ - in_)} not explained by a move between lines`, 'Reports', 'Reports', det);
  }

  // The same person under two names (same surname, first names one letter apart) on different lines.
  const people = roster(p, today);
  const pairs: string[] = [], pairRows: string[][] = [];
  for (let i = 0; i < people.length; i++) for (let k = i + 1; k < people.length; k++) {
    const a = people[i], b = people[k], [sa, ga = ''] = a.name.split(','), [sb, gb = ''] = b.name.split(',');
    if (n2(sa) !== n2(sb) || n2(ga) === n2(gb) || n2(ga).length < 4) continue;
    const x = n2(ga), y = n2(gb);
    if (Math.abs(x.length - y.length) <= 1 && [...x].filter((c, j) => c !== y[j]).length <= 1) { pairs.push(`${a.display} / ${b.display}`); pairRows.push([a.display, a.code, b.display, b.code]); }
  }
  if (pairs.length) add('warn', `Possibly the same person under two names: ${pairs.slice(0, 3).join('; ')}`, 'Staff', 'Staff',
    { title: 'Possibly the same person under two names', cols: ['Name', 'Line', 'Other name', 'Line'], rows: pairRows });

  // The same figure in the contract, the approved budget, the project card and the latest report.
  const X = crossDocs(p).rows.filter((x) => !x.ok);
  if (X.length) add('warn', `${X.map((x) => x.label).slice(0, 4).join(', ')}${X.length > 4 ? '…' : ''} differ between documents — see "Documents agree?" on the project summary`, 'Documents', 'Summary',
    { title: 'Figures that differ between documents', cols: ['Figure', 'Contract', 'Approved budget', 'Project card', 'Latest report'],
      rows: X.map((x) => [x.label, ...(['contract', 'approved', 'card', 'report'] as const).map((k) => x.values[k] ?? '—')]), num: X.every((x) => x.money) ? [1, 2, 3, 4] : [] });
  return out;
}
