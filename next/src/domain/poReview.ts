import { unitsLookTyped, type PO, type WorkbookSummary } from './workbook';

/**
 * Purchase-order review of one project: every PO line of the latest report checked against its budget line, and
 * every PO followed across the reports loaded so far. Each rule can be checked by hand in the report's
 * "Purchase Orders" sheet: a finding says what the order shows, what the budget line expects, and why.
 */
export type PoKind =
  | 'no-line' | 'line-named' | 'line-kind' | 'line-grade' | 'moved'
  | 'unit' | 'generic' | 'unit-kind' | 'unit-count' | 'no-units' | 'unit-changed' | 'units-changed'
  | 'over' | 'rate' | 'typed' | 'dup' | 'closed-balance'
  | 'raised' | 'reduced' | 'spent-down' | 'gone' | 'described' | 'new';
export type PoGroup = 'line' | 'unit' | 'amount' | 'change';
export interface PoFinding { kind: PoKind; group: PoGroup; level: 'bad' | 'warn' | 'info'; po: string; line: string; supplier: string; description: string; text: string; /** euro amount the finding is about (gap, change, balance) */ amount: number; /** what the order should probably say instead (a line, a unit), when the report itself shows it */ fix?: string; /** year the order was raised (its PO date), for the view by year */ year: string }
export interface PoReport { date: string; label: string; wb: WorkbookSummary }
export interface PoHistoryRow { date: string; label: string; line: string; amount: number; spent: number; balance: number; units: number | null; unitType: string; status: string; description: string }
export interface PoReview { latest?: PoReport; previous?: PoReport; reports: number; pos: number; /** orders finally closed in the latest report: nothing left to correct on them, so left out */ finallyClosed: number; findings: PoFinding[]; history: (po: string) => PoHistoryRow[] }
/** A line of the approved budget, for the unit when the report leaves it out. */
export interface PoBudgetLine { code: string; unit?: string; description?: string }

export const PO_KIND: Record<PoKind, { label: string; group: PoGroup }> = {
  'no-line': { label: 'Line not in the budget', group: 'line' },
  'line-named': { label: 'Line differs from the one named on the order', group: 'line' },
  'line-kind': { label: 'Line does not fit what is bought', group: 'line' },
  'line-grade': { label: 'Staff grade on another grade\'s line', group: 'line' },
  moved: { label: 'Moved to another line', group: 'line' },
  unit: { label: 'Unit differs from the budget line', group: 'unit' },
  generic: { label: 'Generic unit (item) instead of the line\'s unit', group: 'unit' },
  'unit-kind': { label: 'Unit does not fit what is bought', group: 'unit' },
  'unit-count': { label: 'Number of months differs from the contract dates', group: 'unit' },
  'no-units': { label: 'Spent with no units', group: 'unit' },
  'unit-changed': { label: 'Unit changed', group: 'unit' },
  'units-changed': { label: 'Number of units changed', group: 'unit' },
  over: { label: 'Spent above the order', group: 'amount' },
  rate: { label: 'Unit cost above the budget rate', group: 'amount' },
  typed: { label: 'Amount typed as units', group: 'amount' },
  dup: { label: 'Same order twice', group: 'amount' },
  'closed-balance': { label: 'Closed with a balance', group: 'amount' },
  raised: { label: 'Order raised', group: 'change' },
  reduced: { label: 'Order reduced', group: 'change' },
  'spent-down': { label: 'Spent went down', group: 'change' },
  gone: { label: 'Missing from the new report', group: 'change' },
  described: { label: 'Description changed', group: 'change' },
  new: { label: 'New order', group: 'change' },
};
export const PO_GROUP: Record<PoGroup, string> = { line: 'Line may be wrong', unit: 'Unit may be wrong', amount: 'Amounts to check', change: 'Changed between reports' };

const r2 = (v: number) => Math.round(v * 100) / 100;
const eur = (v: number) => '€' + r2(v).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (v: number) => r2(v).toLocaleString('en-GB', { maximumFractionDigits: 2 });
const closed = (s: string) => /closed/i.test(s);
const sum = (L: PO[], f: (x: PO) => number) => r2(L.reduce((a, x) => a + f(x), 0));
const byPo = (L: PO[]) => { const M = new Map<string, PO[]>(); for (const x of L) if (x.po) M.set(x.po, [...(M.get(x.po) ?? []), x]); return M; };
const list = (S: Iterable<string>) => [...new Set(S)].filter(Boolean).sort().join(', ') || '—';

/**
 * What a unit counts. Finer than the families used for unit costs: a per diem (subsistence allowance) is not a
 * fee day, so "Per Day" on a subsistence order is a wrong unit even though both count days.
 */
export function unitKind(u: string): string {
  const w = (u ?? '').toLowerCase().replace(/^\s*per\s+/, '').trim();
  if (!w) return '';
  if (/diem|subsist|\bdsa\b/.test(w)) return 'diem';
  if (/travel|trip|flight|journey|ticket/.test(w)) return 'travel';
  if (/month/.test(w)) return 'month';
  if (/word|page/.test(w)) return 'words';
  if (/event|contract|conference|seminar|workshop|meeting|training/.test(w)) return 'event';
  if (/grant/.test(w)) return 'grant';
  if (/day|night/.test(w)) return 'day';
  if (/^(items?|units?|pieces?|pcs?|lots?|lump ?sums?|packages?)$/.test(w)) return 'item';
  return w;
}
const KIND_SAYS: Record<string, string> = { diem: 'subsistence days', travel: 'trips', month: 'months', words: 'words or pages', event: 'events', grant: 'grants', day: 'working days', item: 'items' };
const says = (k: string) => KIND_SAYS[k] ?? k;

/** What an order buys, read from its nature (the system's category of the PO): the headings and units that fit it. */
const CLASSES: { what: string; rx: RegExp; heads: string[]; units: string[] }[] = [
  { what: 'subsistence (per diem)', rx: /per ?diems?|subsistence|\bdsa\b/i, heads: ['1.3'], units: ['diem'] },
  { what: 'travel', rx: /\btravel|flight|ticket|airfare/i, heads: ['2'], units: ['travel'] },
  { what: 'staff contract', rx: /personnel temporaire|temporary staff|staff contract/i, heads: ['1.1', '1.2'], units: ['month'] },
  { what: 'interpretation or translation', rx: /interpret|translat|traduction/i, heads: ['5.5'], units: ['day', 'words', 'event'] },
  { what: 'grant', rx: /\bgrants?\b/i, heads: ['6'], units: ['grant', 'item'] },
];
/** A line code named on the order: at the start of its nature ("2.2 - Framework…") or as "BL 5.5.2". */
const named = (x: PO) => (x.nature.match(/^\s*(\d+(?:\.\d+){1,3})(?=\b|[\s\-/])/) ?? x.nature.match(/\bBL\s?(\d+(?:\.\d+){1,3})/i) ?? x.description.match(/\bBL\s?(\d+(?:\.\d+){1,3})/i))?.[1];
/** Petty-cash advances and their leftovers: small sums for several lines, never counted in units. */
const pettyCash = (x: PO) => /petty cash|caisse|avans|advance request/i.test(`${x.description} ${x.nature} ${x.supplier}`);
const related = (a: string, b: string) => a === b || a.startsWith(b + '.') || b.startsWith(a + '.');
const under = (code: string, head: string) => code === head || code.startsWith(head + '.');
/** The grade of a staff contract as the description gives it: "SURNAME,Name - B4/1 - 100% - …" → "B4". */
export const gradeOf = (d: string) => d.match(/^\s*[^,\-]+,[^\-]+?\s*-\s*([A-C]\d{1,2})(?:\/\d+)?\s*-/)?.[1] ?? '';
/** Months covered by the contract dates in a description ("from 01/09/2024 to 31/12/2024 and 01/02/2025 to 30/04/2025"). */
export function contractMonths(d: string): number | null {
  let days = 0, n = 0;
  for (const m of d.matchAll(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s*(?:to|-|–|au)\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/gi)) {
    const a = Date.UTC(+m[3], +m[2] - 1, +m[1]), b = Date.UTC(+m[6], +m[5] - 1, +m[4]);
    if (b >= a) { days += (b - a) / 864e5 + 1; n++; }
  }
  return n ? r2(days / (365.25 / 12)) : null;
}

/** Reports in the order they were made (oldest first), each with its workbook; reports without POs are skipped. */
export function poReview(reports: PoReport[], budget: PoBudgetLine[] = []): PoReview {
  const R = reports.filter((r) => r.wb.pos?.length);
  const latest = R.at(-1), previous = R.at(-2);
  const history = (po: string) => R.flatMap((r) => r.wb.pos.filter((x) => x.po === po).map((x) => ({ date: r.date, label: r.label, line: x.line, amount: r2(x.amount), spent: r2(x.spent), balance: r2(x.balance), units: x.units, unitType: x.unitType, status: x.status, description: x.description })));
  if (!latest) return { reports: 0, pos: 0, finallyClosed: 0, findings: [], history };
  const out: PoFinding[] = [];
  // the year an order was raised: its PO date in the latest report that has it
  const raised = new Map<string, string>(); for (const r of R) for (const x of r.wb.pos) if (x.date) raised.set(x.po, x.date.slice(0, 4));
  const add = (kind: PoKind, level: PoFinding['level'], x: Pick<PO, 'po' | 'line' | 'supplier' | 'description'>, text: string, amount: number, fix?: string) =>
    out.push({ kind, group: PO_KIND[kind].group, level, po: x.po, line: x.line, supplier: x.supplier, description: x.description, text, amount: r2(amount), year: raised.get(x.po) ?? '', ...(fix ? { fix } : {}) });

  // ---- the latest report, order by order ----
  const wb = latest.wb;
  const leaf = new Map(wb.lines.filter((l) => l.leaf).map((l) => [l.code, l]));
  const ab = new Map(budget.map((b) => [b.code, b]));
  const desc = (c: string) => leaf.get(c)?.description || ab.get(c)?.description || '';
  // the unit a line counts: the report's, else the approved budget's, else what nearly every order on it says
  const usual = new Map<string, { unit: string; n: number; of: number }>();
  for (const c of new Set(wb.pos.map((x) => x.line))) {
    const P = wb.pos.filter((x) => x.line === c && unitKind(x.unitType) && unitKind(x.unitType) !== 'item'), by = new Map<string, PO[]>();
    for (const x of P) by.set(unitKind(x.unitType), [...(by.get(unitKind(x.unitType)) ?? []), x]);
    const top = [...by.values()].sort((a, b) => b.length - a.length)[0];
    if (top && top.length >= 3 && top.length / P.length >= 0.75) usual.set(c, { unit: top[0].unitType, n: top.length, of: P.length });
  }
  const lineUnit = (c: string): { unit: string; from: string } | null => {
    const u = leaf.get(c)?.unit?.trim(); if (u) return { unit: u, from: 'is budgeted' };
    const b = ab.get(c)?.unit?.trim(); if (b) return { unit: b, from: 'is budgeted (approved budget)' };
    const s = usual.get(c); return s ? { unit: s.unit, from: `counts on ${s.n} of its ${s.of} orders` } : null;
  };
  const codes = [...new Set([...leaf.keys(), ...ab.keys()])].filter((c) => !/^10(\.|$)/.test(c)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  // which grades each staff line carries, over every report: a line holds one post, so one grade
  const grades = new Map<string, Map<string, Set<string>>>();
  for (const r of R) for (const x of r.wb.pos) { const g = gradeOf(x.description); if (!g || !x.line) continue; const m = grades.get(x.line) ?? new Map<string, Set<string>>(); m.set(g, (m.get(g) ?? new Set()).add(x.po)); grades.set(x.line, m); }
  const homeOf = (g: string, not: string) => [...grades].filter(([c, m]) => c !== not && c.split('.').slice(0, 2).join('.') === not.split('.').slice(0, 2).join('.') && m.has(g) && m.size === 1).map(([c]) => c);
  for (const x of wb.pos) {
    const l = leaf.get(x.line);
    const g = gradeOf(x.description), m = g ? grades.get(x.line) : undefined;
    if (g && m && m.has(g) && m.size > 1) {
      const others = [...m].filter(([k]) => k !== g), mine = m.get(g)!, home = homeOf(g, x.line);
      // the grade is the odd one out on this line and has a line of its own elsewhere
      if (home.length && others.reduce((a, [, v]) => a + v.size, 0) > mine.size) add('line-grade', 'warn', x, `A ${g} contract on line ${x.line}${desc(x.line) ? ` (${desc(x.line)})` : ''}, whose other orders are ${others.map(([k]) => k).join(', ')}; ${g} contracts of this project are on line ${home.map((c) => desc(c) ? `${c} (${desc(c)})` : c).join(', ')}.`, x.sc, home.join(' / '));
    }
    const gap = x.spent - x.amount;
    if (gap > 0.5) add('over', gap > Math.max(100, x.amount * 0.1) ? 'warn' : 'info', x, `Ordered ${eur(x.amount)}, spent ${eur(x.spent)}: ${eur(gap)} (${x.amount > 0 ? Math.round(gap / x.amount * 100) + '%' : 'no order'}) above the order.`, gap);
    if (!x.line || (leaf.size && !l)) {
      const subs = [...leaf.keys()].filter((c) => x.line && c.startsWith(x.line + '.'));
      add('no-line', 'bad', x, !x.line ? 'The order has no budget line.' : subs.length ? `Line ${x.line} is a heading in the budget (${subs.join(', ')}): the order should be on one of its lines.` : `Line ${x.line} is not a line of the budget in this report.`, x.sc, subs.length ? subs.join(' / ') : undefined);
    }
    if (unitsLookTyped(x)) add('typed', 'warn', x, `${num(x.units ?? 0)} units for ${eur(x.amount)}: the amount looks typed in the units field.`, x.sc);
    if (closed(x.status) && x.balance > 0.5) add('closed-balance', 'warn', x, `Marked ${x.status.toLowerCase()} but ${eur(x.balance)} is still open on it.`, x.balance);

    // ---- is it on the right line? ----
    const nm = named(x);
    if (nm && x.line && !related(nm, x.line)) add('line-named', 'bad', x, `The order names line ${nm} ("${x.nature || x.description}") but is booked on line ${x.line}${desc(x.line) ? ` (${desc(x.line)})` : ''}.`, x.sc, nm);
    const cls = !nm && !/petty cash|framework|multiple/i.test(x.nature) ? CLASSES.find((c) => c.rx.test(x.nature)) : undefined;
    if (cls && x.line && !cls.heads.some((h) => under(x.line, h))) {
      const fits = codes.filter((c) => cls.heads.some((h) => under(c, h)));
      const best = fits.filter((c) => { const u = lineUnit(c); return !u || cls.units.includes(unitKind(u.unit)); });
      const S = (best.length ? best : fits).slice(0, 4);
      add('line-kind', 'warn', x, `A ${cls.what} order ("${x.nature}") booked on line ${x.line}${desc(x.line) ? ` (${desc(x.line)})` : ''}. ${cls.what[0].toUpperCase() + cls.what.slice(1)} goes on ${cls.heads.map((h) => h + '.x').join(' or ')}${S.length ? `: ${S.map((c) => desc(c) ? `${c} ${desc(c)}` : c).join('; ')}` : ''}.`, x.sc, S.join(' / ') || undefined);
    }

    // ---- is the unit right? ----
    const k = unitKind(x.unitType), lu = x.line ? lineUnit(x.line) : null, lk = lu ? unitKind(lu.unit) : '';
    let unitSaid = false;
    if (k && lk && k !== lk) {
      if (k === 'item' && lk !== 'grant') { add('generic', 'warn', x, `Written "${x.unitType}" where line ${x.line} ${lu!.from} "${lu!.unit}" (${says(lk)}): the order does not say how many ${says(lk)} it buys, so the units and the cost per unit of the line come out wrong.`, x.sc, lu!.unit); unitSaid = true; }
      else if (!(lk === 'item' && k !== 'diem' && k !== 'travel' && k !== 'month' && k !== 'day') && !(k === 'grant' && lk === 'item')) { add('unit', 'warn', x, `Counted "${x.unitType}" (${says(k)}); line ${x.line} ${lu!.from} "${lu!.unit}" (${says(lk)}). The units and the cost per unit of the line come out wrong.`, x.sc, lu!.unit); unitSaid = true; }
    }
    if (!unitSaid && cls && k && !cls.units.includes(k)) {
      const want = cls.units[0], ex = wb.pos.find((y) => unitKind(y.unitType) === want)?.unitType;
      add('unit-kind', 'warn', x, `A ${cls.what} order counted "${x.unitType}" (${says(k)}); ${cls.what} is counted in ${says(want)}${ex ? ` ("${ex}", as on other orders of this report)` : ''}.${k === 'day' && want === 'diem' ? ' "Per Day" is a fee day, not a subsistence day.' : ''}`, x.sc, ex);
    }
    if (k === 'month' && x.units) {
      const m = contractMonths(x.description);
      if (m != null && Math.abs(m - x.units) > 0.6) add('unit-count', 'warn', x, `The contract dates in the description cover ${num(m)} months; the order counts ${num(x.units)}.`, x.sc, num(Math.round(m * 4) / 4));
    }
    if (!l) continue;
    if (!unitSaid && x.units && x.units > 0 && x.amount > 0 && l.budget.rate && !unitsLookTyped(x)) {
      const rate = x.amount / x.units, b = l.budget.rate;
      if (rate > b * 1.5) add('rate', rate > b * 2 ? 'warn' : 'info', x, `${eur(rate)} per unit (${eur(x.amount)} for ${num(x.units)} ${x.unitType.toLowerCase() || 'units'}); the line is budgeted at ${eur(b)}: ${Math.round((rate / b - 1) * 100)}% more.`, x.amount - x.units * b);
    }
    // units come with the spending: a PO only committed shows none yet; once something is spent it should
    if (!x.units && x.spent > 0.5 && l.budget.units && k !== 'month' && !pettyCash(x)) {
      const other = wb.pos.some((y) => y.po === x.po && y !== x && (y.units ?? 0) > 0);
      add('no-units', other ? 'info' : 'warn', x, `${eur(x.spent)} spent but no units, though units come with the spending; line ${l.code} counts ${lu?.unit || l.unit || 'units'}, so its cost per unit reads high.${other ? ' Probably an extra cost (a second leg, a fee) on an order counted on its other line.' : ''}`, x.spent);
    }
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
      if (list(al.map((y) => unitKind(y.unitType))) !== list(bl.map((y) => unitKind(y.unitType)))) add('unit-changed', 'warn', x, `Unit "${ua}" → "${ub}"${when}.`, sum(bl, (y) => y.sc));
      const na = sum(al, (y) => y.units ?? 0), nb = sum(bl, (y) => y.units ?? 0);
      if (last && Math.abs(na - nb) > 0.005) add('units-changed', Math.abs(ab - aa) < 0.5 ? 'warn' : 'info', x, `${num(na)} → ${num(nb)} units${Math.abs(ab - aa) < 0.5 ? ', the amount did not change' : ''}.`, sum(bl, (y) => y.sc));
      const da = list(al.map((y) => y.description)), db = list(bl.map((y) => y.description));
      if (da !== db) add('described', 'info', x, `"${da}" → "${db}"${when}.`, sum(bl, (y) => y.sc));
    }
    for (const [, al] of A) if (!B.has(al[0].po)) add('gone', 'warn', al[0], `In ${a.label} with ${eur(sum(al, (y) => y.amount))} ordered and ${eur(sum(al, (y) => y.spent))} spent; not in ${b.label}.`, -sum(al, (y) => y.sc));
  }
  // orders finally closed in the latest report are done: nothing on them can be corrected any more
  const final = new Set([...byPo(wb.pos)].filter(([, L]) => L.every((y) => /finally/i.test(y.status))).map(([po]) => po));
  const kept = out.filter((f) => !final.has(f.po));
  out.length = 0; out.push(...kept);
  const L = { bad: 0, warn: 1, info: 2 };
  out.sort((a, b) => L[a.level] - L[b.level] || Math.abs(b.amount) - Math.abs(a.amount));
  return { latest, previous, reports: R.length, pos: new Set(wb.pos.map((x) => x.po)).size, finallyClosed: final.size, findings: out, history };
}
