import type { Entry, PO } from './workbook';

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
    const x = L.get(k) ?? { line: k, description: k ? name.get(k) ?? '' : 'No reporting line', amount: 0, n: 0, invoices: 0, gl: 0 };
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

export type FindingKind = 'no-line' | 'not-in-budget' | 'wrong-line' | 'duplicate' | 'po-over' | 'outside-dates' | 'unposted' | 'other-bh' | 'unit-mismatch' | 'contract-beyond';
export interface Finding { kind: FindingKind; level: 'error' | 'warning' | 'info'; title: string; text: string; amount: number; rows: { date: string; doc: string; line: string; description: string; amount: number }[] }

export const KIND_LABEL: Record<FindingKind, string> = {
  'no-line': 'No reporting line', 'not-in-budget': 'Line not in the budget', 'wrong-line': 'Possibly the wrong line', duplicate: 'Possible duplicate',
  'po-over': 'Invoiced above the PO', 'outside-dates': 'Outside the project dates', unposted: 'Not posted', 'other-bh': 'Mentions another budget head',
  'unit-mismatch': 'Unit differs from the budget', 'contract-beyond': 'Contract runs past the project end',
};

const r2 = (v: number) => Math.round(v * 100) / 100;
const row = (e: Entry) => ({ date: e.date, doc: e.src === 'invoice' ? `${e.doc}${e.po ? ` (PO ${e.po})` : ''}` : `GL ${e.doc}`, line: e.line, description: [e.description, e.detail !== e.description ? e.detail : ''].filter(Boolean).join(' · '), amount: e.amount });
const eur = (v: number) => '€' + v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const unitWord = (u: string) => u.toLowerCase().replace(/^per\s+/, '').replace(/[^a-z ]/g, '').replace(/s\b/g, '').trim();
const dmy = (s: string) => { const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''; };

export interface FindOptions { budget?: BudgetRef[]; start?: string; end?: string; bh?: string; pos?: PO[] }

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
    for (const e of entries) if (e.line && e.line !== '0' && !known(e.line)) by.set(e.line, [...(by.get(e.line) ?? []), e]);
    for (const [l, E] of by) push('not-in-budget', 'error', `Line ${l} is not in the approved budget — ${E.length} entries, ${eur(E.reduce((a, e) => a + e.amount, 0))}. A typing error in the reporting line (or a budget revision not loaded).`, E);
  }

  // 3. account almost always on one heading, here on another
  const acc = new Map<string, Entry[]>();
  for (const e of entries) if (e.account && e.line && e.line !== '0') acc.set(e.account, [...(acc.get(e.account) ?? []), e]);
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
    seen.set(k, [...(seen.get(k) ?? []), e]);
  }
  const net = (E: Entry[]) => entries.filter((x) => E.some((e) => e.line === x.line && r2(x.amount) === -r2(e.amount) && (x.doc === e.doc || x.description === e.description))).length;
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

  // 9. PO unit differs from the budget line unit
  if (budget.length && o.pos?.length) {
    const unit = new Map(budget.filter((b) => b.unit).map((b) => [b.code, unitWord(b.unit!)]));
    const bad = o.pos.filter((p) => p.unitType && unit.get(p.line) && unitWord(p.unitType) && !unitWord(p.unitType).includes(unit.get(p.line)!) && !unit.get(p.line)!.includes(unitWord(p.unitType)));
    const by = new Map<string, PO[]>(); for (const p of bad) by.set(p.line, [...(by.get(p.line) ?? []), p]);
    for (const [l, P] of by) out.push({ kind: 'unit-mismatch', level: 'info', title: KIND_LABEL['unit-mismatch'], text: `Line ${l} is budgeted per ${unit.get(l)}; ${P.length} PO${P.length > 1 ? 's' : ''} use "${[...new Set(P.map((p) => p.unitType))].join('", "')}" — unit counts on this line will not compare with the budget.`, amount: r2(P.reduce((a, p) => a + p.sc, 0)),
      rows: P.map((p) => ({ date: p.date, doc: `PO ${p.po}`, line: p.line, description: `${p.description} · ${p.units ?? ''} ${p.unitType}`, amount: p.sc })) });
  }

  // 10. contract period past the project end ("from 01/01/2026 to 31/12/2027")
  if (o.end && o.pos?.length) {
    const P = o.pos.filter((p) => { const m = p.description.match(/\bto\s+(\d{1,2}\/\d{1,2}\/\d{4})/i); return m && dmy(m[1]) > o.end!; });
    if (P.length) out.push({ kind: 'contract-beyond', level: 'warning', title: KIND_LABEL['contract-beyond'], text: `${P.length} PO${P.length > 1 ? 's' : ''} run past the project end (${o.end}) — the months after it cannot be charged here.`, amount: r2(P.reduce((a, p) => a + p.balance, 0)),
      rows: P.map((p) => ({ date: p.date, doc: `PO ${p.po}`, line: p.line, description: p.description, amount: p.balance })) });
  }

  const rank = { error: 0, warning: 1, info: 2 } as const;
  return out.sort((a, b) => rank[a.level] - rank[b.level] || Math.abs(b.amount) - Math.abs(a.amount));
}
