import { roundUnits, unitStep, unitsLookTyped, type Entry, type PO } from './workbook';
import { nearOf, pctOf } from './flex';
import { dmy as showDate } from './dt';

/**
 * The dated ledger of a system extraction: spending between two dates, and the entries that look posted in error.
 * "Spent" of an extraction is exactly the invoices on purchase orders (by GL date) plus the direct GL entries.
 */

export interface BudgetRef { code: string; description?: string; unit?: string; approved?: number }
export interface RangeLine { line: string; description: string; amount: number; n: number; invoices: number; gl: number }
export interface RangeResult { from: string; to: string; total: number; n: number; lines: RangeLine[]; months: { month: string; amount: number }[]; rows: Entry[] }

const inRange = (d: string, from: string, to: string) => (!from || d >= from) && (!to || d <= to);

/** Everything posted from `from` to `to` (inclusive, YYYY-MM-DD; empty = open), by budget line and by month. */
export function spendBetween(entries: Entry[], from: string, to: string, budget: BudgetRef[] = []): RangeResult {
  const rows = entries.filter((e) => inRange(e.date, from, to));
  const name = new Map(budget.map((b) => [b.code, b.description ?? '']));
  const L = new Map<string, RangeLine>(), M = new Map<string, number>();
  for (const e of rows) {
    const k = e.line && e.line !== '0' ? e.line : '';
    const x = L.get(k) ?? { line: k, description: k ? name.get(k) || (k === '10' ? 'Levy taken on donor tranches' : '') : 'No reporting line', amount: 0, n: 0, invoices: 0, gl: 0 };
    x.amount += e.amount; x.n++; x[e.src === 'invoice' ? 'invoices' : 'gl'] += e.amount; L.set(k, x);
    M.set(e.date.slice(0, 7), (M.get(e.date.slice(0, 7)) ?? 0) + e.amount);
  }
  const lines = [...L.values()].sort((a, b) => (a.line || '~').localeCompare(b.line || '~', undefined, { numeric: true }));
  return { from, to, total: rows.reduce((a, e) => a + e.amount, 0), n: rows.length, lines, months: [...M].sort().map(([month, amount]) => ({ month, amount })), rows };
}

/** Quick ranges relative to `today`. */
export function presets(today: Date): { key: string; label: string; from: string; to: string }[] {
  const d = (x: Date) => x.toISOString().slice(0, 10), y = today.getUTCFullYear(), m = today.getUTCMonth();
  const mStart = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, 1)), mEnd = (yy: number, mm: number) => new Date(Date.UTC(yy, mm + 1, 0));
  const q = Math.floor(m / 3);
  return [
    { key: 'm', label: 'This month', from: d(mStart(y, m)), to: d(today) },
    { key: 'pm', label: 'Last month', from: d(mStart(y, m - 1)), to: d(mEnd(y, m - 1)) },
    { key: 'pq', label: 'Last quarter', from: d(mStart(y, (q - 1) * 3)), to: d(mEnd(y, (q - 1) * 3 + 2)) },
    { key: 'y', label: 'This year', from: `${y}-01-01`, to: d(today) },
    { key: 'py', label: 'Last year', from: `${y - 1}-01-01`, to: `${y - 1}-12-31` },
    { key: '12', label: 'Last 12 months', from: d(new Date(Date.UTC(y, m - 11, 1))), to: d(today) },
    { key: 'all', label: 'All', from: '', to: '' },
  ];
}

/* ---------- entries that look wrong ---------- */

export type FindingKind = 'no-line' | 'not-in-budget' | 'wrong-line' | 'duplicate' | 'po-over' | 'outside-dates' | 'unposted' | 'other-bh' | 'unit-mismatch' | 'contract-beyond' | 'line-over' | 'head-over' | 'head-near' | 'units-over' | 'staff-short' | 'units-typed' | 'units-missing-open' | 'units-missing-paid';
/** A staff PO that will not last until its contract end: what is paid a month, the months left and what is missing. */
export interface StaffShort { po: string; line: string; person: string; to: string; months: number; perMonth: number; need: number; balance: number; ordered: number; spent: number; shortfall: number }
export interface Finding { kind: FindingKind; level: 'error' | 'warning' | 'info'; title: string; text: string; amount: number; rows: { date: string; doc: string; line: string; description: string; amount: number; staff?: StaffShort }[] }

export const KIND_LABEL: Record<FindingKind, string> = {
  'no-line': 'No reporting line', 'not-in-budget': 'Line not in the budget', 'wrong-line': 'Possibly the wrong line', duplicate: 'Possible duplicate',
  'po-over': 'Invoiced above the PO', 'outside-dates': 'Outside the project dates', unposted: 'Not posted', 'other-bh': 'Mentions another budget head',
  'unit-mismatch': 'Unit differs from the budget', 'contract-beyond': 'Contract runs past the project end', 'line-over': 'Line above its approved budget', 'head-over': 'Heading beyond the flexibility', 'head-near': 'Heading close to the addendum threshold', 'units-over': 'Units above the budget — notification', 'staff-short': 'Staff PO does not cover the remaining months', 'units-typed': 'Amount typed as the number of units', 'units-missing-open': 'Committed on a PO line with no units', 'units-missing-paid': 'Invoiced on a PO line with no units',
};

const r2 = (v: number) => Math.round(v * 100) / 100;
const row = (e: Entry) => ({ date: e.date, doc: e.src === 'invoice' ? `${e.doc}${e.po ? ` (PO ${e.po})` : ''}` : `GL ${e.doc}`, line: e.line, description: [e.description, e.detail !== e.description ? e.detail : ''].filter(Boolean).join(' · '), amount: e.amount });
const eur = (v: number) => '€' + v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const unitWord = (u: string) => u.toLowerCase().replace(/^per\s+/, '').replace(/[^a-z ]/g, '').replace(/s\b/g, '').trim();
/**
 * A PO's unit that does not count the same thing as its budget line ("Per Travel" on a rent line budgeted per month):
 * the units and unit costs of the line come out wrong. Units written differently but meaning the same ("Per return
 * flight" / "Per Travel", "Per item" / "Per unit" or "Per grant", "Per event" / "Per contract") are not a difference;
 * a generic unit (item, unit) goes with anything that is not counted in time or trips.
 */
export function unitsDiffer(poUnit: string, budgetUnit: string): boolean {
  if (!poUnit?.trim() || !budgetUnit?.trim()) return false;
  // For this check only: an event bought as one contract, a grant or a page counted as an item.
  const fam = (u: string) => { const f = unitFamily(u), w = unitWord(u); return /event|contract|conference|seminar|workshop|meeting|training/.test(w) ? 'event' : /^(grant|lump ?sum|package|lot)$|word|page/.test(w) ? 'item' : f; };
  const a = fam(poUnit), b = fam(budgetUnit);
  if (a === b || unitWord(poUnit).includes(unitWord(budgetUnit)) || unitWord(budgetUnit).includes(unitWord(poUnit))) return false;
  const timed = ['month', 'day', 'travel'];
  return !((a === 'item' && !timed.includes(b)) || (b === 'item' && !timed.includes(a)));
}
/** Units written differently but counted the same way ("per return flight" and "Per Travel", "per personday" and "Per Day"). */
export function unitFamily(u: string): string {
  const w = unitWord(u).replace(/\s+/g, ' ');
  if (/travel|trip|flight|journey|ticket/.test(w)) return 'travel';
  if (/diem|day|night/.test(w)) return 'day';
  if (/month/.test(w)) return 'month';
  if (/^(item|unit|piece|pc)$/.test(w)) return 'item';
  return w;
}
const dmy = (s: string) => { const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''; };

/**
 * One-off lines — grants: a single contract paid in instalments, with no further spending expected beyond what is committed.
 * They are left out of "at the current pace" projections (a grant paid early would otherwise look like an overspend to come).
 */
export const oneOff = (description: string, unit = '') => /\bgrants?\b|sub-?grant|\bhibe/i.test(`${description} ${unit}`);

export interface FindOptions { /** heading flexibility of the project (0.25 JP, 0.15 VC) */ flex?: number; budget?: BudgetRef[]; start?: string; end?: string; bh?: string; pos?: PO[]; /** spent + committed by line, to compare with the approved budget */ sc?: Map<string, number>; /** units budgeted and used by line */ units?: { code: string; description: string; unit: string; budget: number; used: number }[]; /** share of the project time gone, 0–1 */ elapsed?: number; /** situation date of the extraction */ asAt?: string }

/**
 * Entries worth a second look. Each rule is stated so a finance officer can check it in the source file:
 * the reporting line is missing or not in the budget; an account almost always booked on one heading appears on
 * another; the same amount for the same document or supplier twice on one day; a PO invoiced above its amount;
 * a date outside the project; an entry not posted; a description naming another budget head; a PO unit that is
 * not the unit of its budget line; a contract whose period runs past the project end.
 * Purchase orders split over several lines are normal (events, interpretation) and are not flagged.
 */
export function findErrors(entries: Entry[], o: FindOptions = {}): Finding[] {
  const out: Finding[] = [];
  const budget = o.budget ?? [], codes = budget.map((b) => b.code);
  const known = (c: string) => codes.includes(c) || codes.some((x) => x.startsWith(c + '.'));
  const push = (kind: FindingKind, level: Finding['level'], text: string, E: Entry[], title = KIND_LABEL[kind]) => {
    if (E.length || kind === 'po-over' || kind === 'unit-mismatch' || kind === 'contract-beyond') out.push({ kind, level, title, text, amount: r2(E.reduce((a, e) => a + e.amount, 0)), rows: E.map(row) });
  };

  // 1. no reporting line
  const none = entries.filter((e) => !e.line || e.line === '0'), levy = none.filter((e) => /tranche|prelev|levy|7\s?%/i.test(e.description + e.detail)), rest = none.filter((e) => !levy.includes(e));
  if (rest.length) push('no-line', 'warning', `${rest.length} entries (${eur(rest.reduce((a, e) => a + e.amount, 0))}) carry no reporting line, so they appear on no line of the report.`, rest);
  if (levy.length) push('no-line', 'info', `${levy.length} levies on donor tranches (${eur(levy.reduce((a, e) => a + e.amount, 0))}) carry no reporting line — usual; they are the administrative costs, not a line of the report.`, levy, 'Levies on tranches');

  // 2. line not in the budget
  if (codes.length) {
    const by = new Map<string, Entry[]>();
    for (const e of entries) if (e.line && e.line !== '0' && e.line !== '10' && !known(e.line)) { const a = by.get(e.line); if (a) a.push(e); else by.set(e.line, [e]); }
    for (const [l, E] of by) push('not-in-budget', 'error', `Line ${l} is not in the approved budget — ${E.length} entries, ${eur(E.reduce((a, e) => a + e.amount, 0))}. A typing error in the reporting line (or a budget revision not loaded).`, E);
  }

  // 3. account almost always on one heading, here on another
  const acc = new Map<string, Entry[]>();
  for (const e of entries) if (e.account && e.line && e.line !== '0') { const a = acc.get(e.account); if (a) a.push(e); else acc.set(e.account, [e]); }
  for (const [a, E] of acc) {
    if (E.length < 5) continue;
    const head = (e: Entry) => e.line.split('.')[0], cnt = new Map<string, number>();
    for (const e of E) cnt.set(head(e), (cnt.get(head(e)) ?? 0) + 1);
    const [main, n] = [...cnt].sort((x, y) => y[1] - x[1])[0];
    if (n / E.length < 0.85) continue;
    const odd = E.filter((e) => head(e) !== main && Math.abs(e.amount) >= 50);
    const mainLines = [...new Set(E.filter((e) => head(e) === main).map((e) => e.line))].slice(0, 3).join(', ');
    if (odd.length) push('wrong-line', 'warning', `Account ${a} is booked ${n} times out of ${E.length} on heading ${main} (${mainLines}); these ${odd.length} sit on another heading.`, odd);
  }

  // 4. duplicates: same document + amount twice, or same supplier + amount on the same day on two documents (not reversed)
  const seen = new Map<string, Entry[]>();
  for (const e of entries) {
    if (Math.abs(e.amount) < 100) continue;
    const k = e.src === 'invoice' ? `i|${e.po || e.supplier}|${e.date}|${r2(e.amount)}` : `g|${e.line}|${e.period}|${e.detail}|${e.description}|${r2(e.amount)}`;
    { const a = seen.get(k); if (a) a.push(e); else seen.set(k, [e]); }
  }
  // Reversals: indexed by line and amount, so each duplicate group looks only at its possible counter-entries.
  const byAmt = new Map<string, Entry[]>();
  for (const x of entries) { const k = `${x.line}|${r2(x.amount)}`, a = byAmt.get(k); if (a) a.push(x); else byAmt.set(k, [x]); }
  const net = (E: Entry[]) => { const hit = new Set<Entry>(); for (const e of E) for (const x of byAmt.get(`${e.line}|${-r2(e.amount)}`) ?? []) if (x.doc === e.doc || x.description === e.description) hit.add(x); return hit.size; };
  const dup = [...seen.values()].filter((E) => E.length > 1 && net(E) === 0);
  for (const E of dup) push('duplicate', 'warning', `${E.length} × ${eur(E[0].amount)} — ${E[0].src === 'invoice' ? `same PO ${E[0].po}, same day` : `same line ${E[0].line}, period ${E[0].period}, same description`}, no reversal. Check it was not posted twice.`, E);

  // 5. PO invoiced above its amount (all lines of the PO together; missions and petty cash settle above the advance by design)
  const P = new Map<string, { po: string; date: string; line: string; d: string; amount: number; spent: number }>();
  for (const p of o.pos ?? []) {
    if (/^(personnel|paie)|petty cash|^OM\d|mission/i.test(`${p.nature} ${p.description} ${p.supplier}`)) continue;
    const x = P.get(p.po) ?? { po: p.po, date: p.date, line: p.line, d: [p.description, p.supplier].filter(Boolean).join(' · '), amount: 0, spent: 0 };
    x.amount += p.amount; x.spent += p.spent; P.set(p.po, x);
  }
  const over = [...P.values()].filter((x) => x.amount > 0 && x.spent - x.amount > Math.max(250, x.amount * 0.05)).sort((a, b) => (b.spent - b.amount) - (a.spent - a.amount));
  if (over.length) out.push({ kind: 'po-over', level: 'warning', title: KIND_LABEL['po-over'], text: `${over.length} purchase order${over.length > 1 ? 's are' : ' is'} invoiced more than 5% above the amount ordered (${eur(over.reduce((a, x) => a + x.spent - x.amount, 0))} in all). An amendment of the PO is normally needed.`,
    amount: r2(over.reduce((a, x) => a + x.spent - x.amount, 0)), rows: over.map((x) => ({ date: x.date, doc: `PO ${x.po}`, line: x.line, description: `${x.d} — ${eur(x.spent)} on ${eur(x.amount)}`, amount: r2(x.spent - x.amount) })) });

  // 6. dates outside the project
  if (o.start || o.end) {
    const E = entries.filter((e) => e.date && ((o.start && e.date < o.start) || (o.end && e.date > o.end)) && Math.abs(e.amount) > 0.5);
    if (E.length) push('outside-dates', 'warning', `${E.length} entries dated outside ${o.start ?? '…'} → ${o.end ?? '…'}. Costs before the start or after the end are not eligible unless a pre-financing or closure rule applies.`, E);
  }

  // 7. not posted
  const un = entries.filter((e) => !e.posted);
  if (un.length) push('unposted', 'info', `${un.length} entries are not posted yet — they can still change.`, un);

  // 8. another budget head named in the description
  if (o.bh) {
    const E = entries.filter((e) => { const m = `${e.description} ${e.detail}`.match(/\bBH\s?(\d{4})\b/gi); return m?.some((x) => x.replace(/\D/g, '') !== o.bh); });
    if (E.length) push('other-bh', 'info', `${E.length} entries name a budget head other than ${o.bh} — usually a transfer or a regularisation; check the amount landed on the right project.`, E);
  }

  // 8a. PO lines with an amount but no units (months of staff, grants and petty cash aside). Not invoiced yet: the
  // amount is committed and will be spent later, with no units — to set on the PO first. Invoiced: the line's
  // spending counts with no units, so its cost per unit reads higher than it is.
  if (o.pos?.length) {
    const Z = o.pos.filter((p) => !p.units && p.amount > 0.005 && !/month/i.test(p.unitType) && !/petty cash|caisse|avans|advance request/i.test(`${p.description} ${p.supplier}`) && unitStep(p.unitType, p.line, p.description) != null && p.line && p.line !== '0' && p.line !== '10');
    const open = Z.filter((p) => p.spent < 0.005 && p.sc > 0.005), paid = Z.filter((p) => p.spent >= 0.005);
    const poPaid = new Map<string, number>(); for (const p of o.pos) poPaid.set(p.po, (poPaid.get(p.po) ?? 0) + p.spent);
    const rows = (L: PO[]) => L.map((p) => ({ date: p.date, doc: `PO ${p.po}`, line: p.line, description: `${p.supplier ? `${p.supplier.trim()} · ` : ''}${p.description} · 0 units ${p.unitType}, ${eur(p.amount)} ordered, ${eur(p.spent)} invoiced${p.spent < 0.005 && (poPaid.get(p.po) ?? 0) > 0.5 ? ` · the PO was paid ${eur(poPaid.get(p.po)!)} on its other lines: check this line and have it closed if it will not be used` : ''}`, amount: p.spent >= 0.005 ? p.spent : p.sc }));
    if (open.length) out.push({ kind: 'units-missing-open', level: 'warning', title: KIND_LABEL['units-missing-open'], text: `${open.length} PO line${open.length > 1 ? 's are' : ' is'} committed (${eur(open.reduce((a, p) => a + p.sc, 0))}) with 0 units and not invoiced yet. When the invoice comes, its cost will count on the line with no units, so the line's cost per unit will rise. Ask for the number of units to be set on the PO before it is invoiced.`, amount: r2(open.reduce((a, p) => a + p.sc, 0)), rows: rows(open) });
    if (paid.length) out.push({ kind: 'units-missing-paid', level: 'info', title: KIND_LABEL['units-missing-paid'], text: `${paid.length} PO line${paid.length > 1 ? 's were' : ' was'} invoiced (${eur(paid.reduce((a, p) => a + p.spent, 0))}) with 0 units — usually a small extra (fee, tax, a second leg) on a PO counted elsewhere; the cost per unit of these lines includes it.`, amount: r2(paid.reduce((a, p) => a + p.spent, 0)), rows: rows(paid) });
  }

  // 8b. the amount typed again as the number of units (1,100 units for EUR 1,100): not counted as units
  if (o.pos?.length) {
    const T = o.pos.filter((p) => unitsLookTyped(p));
    if (T.length) out.push({ kind: 'units-typed', level: 'warning', title: KIND_LABEL['units-typed'], text: `${T.length} PO line${T.length > 1 ? 's' : ''} give as many units as euros — the amount was typed in the units field. Their units are left out of the line's units; correct the PO in the system.`,
      amount: r2(T.reduce((a, p) => a + p.amount, 0)), rows: T.map((p) => ({ date: p.date, doc: `PO ${p.po}`, line: p.line, description: `${p.description} · ${p.units} ${p.unitType} for ${eur(p.amount)}`, amount: p.amount })) });
  }

  // 9. PO unit differs from the budget line unit
  if (budget.length && o.pos?.length) {
    const raw = new Map(budget.filter((b) => b.unit).map((b) => [b.code, b.unit!.trim()]));
    const bad = o.pos.filter((p) => p.unitType && raw.get(p.line) && unitsDiffer(p.unitType, raw.get(p.line)!));
    const by = new Map<string, PO[]>(); for (const p of bad) by.set(p.line, [...(by.get(p.line) ?? []), p]);
    for (const [l, P] of by) out.push({ kind: 'unit-mismatch', level: 'warning', title: KIND_LABEL['unit-mismatch'], text: `Line ${l} is budgeted ${raw.get(l)!.toLowerCase()}; ${P.length} PO line${P.length > 1 ? 's use' : ' uses'} "${[...new Set(P.map((p) => p.unitType))].join('", "')}" — the units and the cost per unit of this line come out wrong. Have the unit corrected on the PO (at the latest when it is closed).`, amount: r2(P.reduce((a, p) => a + p.sc, 0)),
      rows: P.map((p) => ({ date: p.date, doc: `PO ${p.po}`, line: p.line, description: `${p.supplier ? `${p.supplier.trim()} · ` : ''}${p.description} · PO unit "${p.unitType}" (${p.units ?? 0}), budget unit "${raw.get(l)}"`, amount: p.sc })) });
  }

  // 10. contract period past the project end ("from 01/01/2026 to 31/12/2027")
  if (o.end && o.pos?.length) {
    const P = o.pos.filter((p) => { const m = p.description.match(/\bto\s+(\d{1,2}\/\d{1,2}\/\d{4})/i); return m && dmy(m[1]) > o.end!; });
    if (P.length) out.push({ kind: 'contract-beyond', level: 'warning', title: KIND_LABEL['contract-beyond'], text: `${P.length} PO${P.length > 1 ? 's' : ''} run past the project end (${showDate(o.end)}) — the months after it cannot be charged here.`, amount: r2(P.reduce((a, p) => a + p.balance, 0)),
      rows: P.map((p) => ({ date: p.date, doc: `PO ${p.po}`, line: p.line, description: p.description, amount: p.balance })) });
  }

  // 11. against the approved budget
  if (o.sc && budget.some((b) => b.approved)) {
    const fx = o.flex ?? FLEX, C = compareBudget(entries, budget, o.sc, '', '', fx);
    const over = C.lines.filter((l) => l.status === 'over');
    if (over.length) out.push({ kind: 'line-over', level: 'warning', title: KIND_LABEL['line-over'], text: `${over.length} line${over.length > 1 ? 's are' : ' is'} spent + committed above the approved amount (${eur(over.reduce((a, l) => a + l.sc - l.budget, 0))} in all). Within a heading this is covered by the flexibility; check the heading totals.`,
      amount: r2(over.reduce((a, l) => a + l.sc - l.budget, 0)), rows: over.map((l) => ({ date: '', doc: `Budget ${eur(l.budget)}`, line: l.code, description: `${l.description} — ${eur(l.sc)} spent + committed (${Math.round(l.used * 100)}%)`, amount: r2(l.sc - l.budget) })) });
    const hv = C.heads.filter((h) => h.status === 'over-flex');
    if (hv.length) out.push({ kind: 'head-over', level: 'error', title: KIND_LABEL['head-over'], text: `${hv.length} heading${hv.length > 1 ? 's exceed' : ' exceeds'} its budget by more than ${pctOf(fx)}% — a budget revision (addendum) is needed before these costs are eligible.`,
      amount: r2(hv.reduce((a, h) => a + h.diff, 0)), rows: hv.map((h) => ({ date: '', doc: `Heading ${h.h}`, line: h.h, description: `Budget ${eur(h.budget)} · spent + committed ${eur(h.sc)} · +${Math.round(h.pct * 100)}%`, amount: r2(h.diff) })) });
    const nr = C.heads.filter((h) => h.status === 'near-flex');
    if (nr.length) out.push({ kind: 'head-near', level: 'warning', title: KIND_LABEL['head-near'], text: `${nr.length} heading${nr.length > 1 ? 's are' : ' is'} ${pctOf(nearOf(fx))}–${pctOf(fx)}% above budget — still a notification, but close to needing an addendum.`,
      amount: r2(nr.reduce((a, h) => a + h.diff, 0)), rows: nr.map((h) => ({ date: '', doc: `Heading ${h.h}`, line: h.h, description: `Budget ${eur(h.budget)} · spent + committed ${eur(h.sc)} · +${(h.pct * 100).toFixed(1)}% · ${eur(h.budget * (1 + fx) - h.sc)} left before ${pctOf(fx)}%`, amount: r2(h.diff) })) });
  }

  // 12b. open staff POs whose balance does not cover the months left of the contract period
  if (o.asAt && o.pos?.length) {
    const a = Date.parse(o.asAt), MO = 30.4375 * 86_400_000, short: { p: PO; need: number; left: number; per: number; to: string }[] = [];
    const invByPo = new Map<string, Entry[]>(); for (const e of entries) if (e.src === 'invoice' && e.po) { const x = invByPo.get(e.po); if (x) x.push(e); else invByPo.set(e.po, [e]); }
    for (const p of o.pos) {
      const m = p.description.match(/from\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+to\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
      if (!m || !/open/i.test(p.status) || !/month/i.test(p.unitType)) continue;
      const f = Date.parse(dmy(m[1])), t = Date.parse(dmy(m[2])) + 86_400_000;
      if (!(t > a && a > f)) continue;
      // Months already paid = months with an invoice on this PO; the cost of a month = their average.
      const paid = new Map<string, number>();
      for (const e of invByPo.get(p.po) ?? []) paid.set(e.date.slice(0, 7), (paid.get(e.date.slice(0, 7)) ?? 0) + e.amount);
      const last = [...paid.keys()].sort().at(-1);
      const per = paid.size ? [...paid.values()].reduce((x, v) => x + v, 0) / paid.size : p.spent / Math.max(1, (a - f) / MO);
      const from = last ? Date.parse(last + '-01') + 32 * 86_400_000 : a;
      const left = Math.max(0, Math.round((t - Date.UTC(new Date(from).getUTCFullYear(), new Date(from).getUTCMonth(), 1)) / MO)), need = per * left;
      if (!left) continue;
      if (need - p.balance > 100) short.push({ p, need, left, per, to: dmy(m[2]) });
    }
    if (short.length) out.push({ kind: 'staff-short', level: 'warning', title: KIND_LABEL['staff-short'], text: `${short.length} staff PO${short.length > 1 ? 's' : ''} still running have less left than the months to come at the current monthly cost — about ${eur(short.reduce((x, s) => x + s.need - s.p.balance, 0))} is not committed yet. Committed (and spent + committed) are understated until the PO is topped up.`,
      amount: r2(short.reduce((x, s) => x + s.need - s.p.balance, 0)), rows: short.map((s) => ({ date: s.p.date, doc: `PO ${s.p.po}`, line: s.p.line, description: `${s.p.description} — ${s.left} month${s.left > 1 ? 's' : ''} still to pay ≈ ${eur(s.need)}, PO balance ${eur(s.p.balance)}`, amount: r2(s.need - s.p.balance),
        staff: { po: s.p.po, line: s.p.line, person: s.p.description.split(/\s+-\s+/)[0].trim(), to: s.to, months: s.left, perMonth: r2(s.per), need: r2(s.need), balance: r2(s.p.balance), ordered: r2(s.p.amount), spent: r2(s.p.spent), shortfall: r2(s.need - s.p.balance) } })) });
  }

  // 12. units above the budgeted number (now, or at the current pace) → notification
  if (o.units?.length) {
    const el = o.elapsed ?? 0;
    const now = o.units.filter((u) => u.budget > 0 && u.used > u.budget + 1e-6);
    const soon = o.units.filter((u) => u.budget > 0 && u.used <= u.budget && el > 0.05 && !oneOff(u.description, u.unit) && u.used / el > u.budget * 1.0001);
    if (now.length) out.push({ kind: 'units-over', level: 'warning', title: KIND_LABEL['units-over'], text: `${now.length} line${now.length > 1 ? 's use' : ' uses'} more units than budgeted — the change in units is reported by notification (and by addendum if the heading goes beyond ${pctOf(o.flex ?? FLEX)}%).`,
      amount: 0, rows: now.map((u) => ({ date: '', doc: `${+u.used.toFixed(2)} of ${u.budget} ${u.unit}`, line: u.code, description: `${u.description} — +${((u.used / u.budget - 1) * 100).toFixed(1)}% units`, amount: 0 })) });
    if (soon.length) out.push({ kind: 'units-over', level: 'info', title: 'Units heading above the budget', text: `${soon.length} line${soon.length > 1 ? 's' : ''} will pass the budgeted units before the end at the current pace — a notification will be needed.`,
      amount: 0, rows: soon.map((u) => ({ date: '', doc: `${+u.used.toFixed(2)} of ${u.budget} ${u.unit}`, line: u.code, description: `${u.description} — about ${Math.round(u.used / el)} by the end`, amount: 0 })) });
  }

  const rank = { error: 0, warning: 1, info: 2 } as const;
  return out.sort((a, b) => rank[a.level] - rank[b.level] || Math.abs(b.amount) - Math.abs(a.amount));
}

/* ---------- against the approved budget ---------- */

export interface CompareLine { code: string; description: string; budget: number; inRange: number; toDate: number; sc: number; available: number; used: number; status: 'over' | 'high' | 'ok' | 'unbudgeted' }
export interface CompareHead { h: string; budget: number; toDate: number; sc: number; diff: number; pct: number; status: 'over-flex' | 'near-flex' | 'within-flex' | 'ok' }
export const FLEX = 0.25;

/**
 * Each budget line against the approved budget: spent in the range, spent up to its end, spent + committed today,
 * what is left and the share used. Headings are compared with the flexibility of the project (25% for Joint Programmes, 15% for Voluntary
 * Contributions): above budget but within it can be absorbed from other headings; beyond it needs a budget revision.
 */
export function compareBudget(entries: Entry[], budget: BudgetRef[], sc: Map<string, number>, from: string, to: string, flex = FLEX): { lines: CompareLine[]; heads: CompareHead[] } {
  const B = budget.filter((b) => b.code !== '10');
  const of = (code: string, E: Entry[]) => E.filter((e) => e.line === code || e.line.startsWith(code + '.')).reduce((a, e) => a + e.amount, 0);
  const R = entries.filter((e) => inRange(e.date, from, to)), U = entries.filter((e) => !to || e.date <= to);
  const lines: CompareLine[] = B.map((b) => {
    const s = sc.get(b.code) ?? of(b.code, entries), budget = b.approved ?? 0, used = budget ? s / budget : 0;
    return { code: b.code, description: b.description ?? '', budget, inRange: of(b.code, R), toDate: of(b.code, U), sc: s, available: budget - s, used,
      status: !budget && s ? 'unbudgeted' : s > budget + 0.5 ? 'over' : used >= 0.9 ? 'high' : 'ok' };
  });
  const hs = [...new Set(lines.map((l) => l.code.split('.')[0]))];
  const heads = hs.map((h) => {
    const L = lines.filter((l) => l.code.split('.')[0] === h), budget = L.reduce((a, l) => a + l.budget, 0), s = L.reduce((a, l) => a + l.sc, 0), diff = s - budget, pct = budget ? diff / budget : 0;
    return { h, budget, toDate: L.reduce((a, l) => a + l.toDate, 0), sc: s, diff, pct, status: diff > 0.5 ? (pct > flex ? 'over-flex' : pct > nearOf(flex) ? 'near-flex' : 'within-flex') : 'ok' } as CompareHead;
  });
  return { lines, heads };
}

/** Spending of each budget line year by year (the current year to the extraction date), with units, against the budget. */
export interface YearLine { code: string; description: string; unit: string; budget: { units: number | null; rate: number | null; cost: number }; years: Record<string, { units: number; amount: number; /** open balance of the POs raised in the year */ committed: number }>; units: number; amount: number; committed: number }
/** The year key of a date: the calendar year by default; pass `yearKey` to count project years ('01', '02' …) instead. */
export function spendByYear(entries: Entry[], wb: { lines: { code: string; description: string; unit: string; leaf: boolean; budget: { units: number | null; rate: number | null; cost: number | null } }[]; pos: PO[] }, yearKey: (iso: string) => string = (d) => d.slice(0, 4)): { years: string[]; lines: YearLine[] } {
  const po = new Map(wb.pos.map((p) => [p.po + '|' + p.line, p]));
  const L = new Map<string, YearLine>();
  for (const l of wb.lines.filter((x) => x.leaf)) L.set(l.code, { code: l.code, description: l.description, unit: l.unit, budget: { units: l.budget.units, rate: l.budget.rate, cost: l.budget.cost ?? 0 }, years: {}, units: 0, amount: 0, committed: 0 });
  const months = new Map<string, Set<string>>(); // staff PO → year|month already counted
  const staffUsed = new Map<string, number>(); // staff PO → units counted so far
  const years = new Set<string>();
  const poRaw = new Map<string, number>(); // PO → units used so far, before rounding
  for (const e of [...entries].sort((a, b) => a.date.localeCompare(b.date))) {
    const code = e.line && e.line !== '0' && e.line !== '10' ? e.line : ''; if (!code) continue;
    const y = yearKey(e.date); years.add(y);
    const x = L.get(code) ?? { code, description: '', unit: '', budget: { units: null, rate: null, cost: 0 }, years: {}, units: 0, amount: 0, committed: 0 }; L.set(code, x);
    let u = 0;
    // Units typed on GL entries (payroll: 16 days of July = 0.53 month) in the steps of their kind: 0.5 month.
    if (e.src === 'gl') u = roundUnits(e.units ?? 0, unitStep(e.unitType ?? '', code, e.description));
    else { const p = po.get(e.po + '|' + e.line) ?? wb.pos.find((q) => q.po === e.po);
      if (p && /month/i.test(p.unitType) && /from\s+\d/i.test(p.description)) { // A staff PO counts the months paid, never more than the units ordered on it (a PO for 0.25 month counts 0.25) — as the statement does.
        const k = `${p.po}`, s = months.get(k) ?? new Set(); const m = e.date.slice(0, 7);
        if (!s.has(m) && e.amount > 0) { s.add(m); const done = staffUsed.get(k) ?? 0; u = p.units ? Math.max(0, Math.min(1, p.units - done)) : 1; staffUsed.set(k, done + u); }
        months.set(k, s); }
      else if (p && p.units && p.amount) {
        // Units in the steps their kind is used in (per diem 0.25, travel 0.5, events whole): the PO's running total
        // is rounded, and each invoice gets what it adds — so no year shows 0.67 of an event.
        const k = `${p.po}|${p.line}`, step = unitStep(p.unitType, p.line, p.description) ?? p.units /* a grant: its PO's units once anything is paid */, before = poRaw.get(k) ?? 0, after = before + p.units * (e.amount / p.amount);
        poRaw.set(k, after);
        const r = (v: number) => (v > 0 ? Math.min(p.units!, roundUnits(v, step, 1)) : roundUnits(v, step));
        u = r(after) - r(before);
      } }
    const Y = x.years[y] ?? { units: 0, amount: 0, committed: 0 }; Y.units += u; Y.amount += e.amount; x.years[y] = Y; x.units += u; x.amount += e.amount;
  }
  // Commitments: what is still open on each PO, in the year the PO was raised.
  const lastY = [...years].sort().at(-1) ?? '';
  for (const p of wb.pos) {
    const open = Math.max(0, p.sc - p.spent); if (open < 0.005 || !p.line || p.line === '0' || p.line === '10') continue;
    const y = (p.date ? yearKey(p.date) : '') || lastY; if (!y) continue; years.add(y);
    const x = L.get(p.line) ?? { code: p.line, description: '', unit: '', budget: { units: null, rate: null, cost: 0 }, years: {}, units: 0, amount: 0, committed: 0 }; L.set(p.line, x);
    const Y = x.years[y] ?? { units: 0, amount: 0, committed: 0 }; Y.committed += open; x.years[y] = Y; x.committed += open;
  }
  const r2 = (v: number) => Math.round(v * 100) / 100;
  for (const x of L.values()) { x.units = r2(x.units); x.amount = r2(x.amount); x.committed = r2(x.committed); for (const y of Object.values(x.years)) { y.units = r2(y.units); y.amount = r2(y.amount); y.committed = r2(y.committed); } }
  return { years: [...years].sort(), lines: [...L.values()].filter((x) => x.budget.cost || x.amount || x.committed).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })) };
}
