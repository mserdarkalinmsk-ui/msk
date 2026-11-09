import type { SheetSpec, XCell } from '../ui/xlsxwrite';
import { compareBudget, findErrors, KIND_LABEL, spendBetween, type BudgetRef, type Finding } from './ledger';
import type { Project } from './types';
import type { Entry, WbLine, WorkbookSummary } from './workbook';

/**
 * The raw system extraction (Situation Budgétaire, Purchase Orders, GL, Factures, Consolidation…) laid out as one
 * tidy workbook: the statement by budget line, every dated posting with its line and supplier, spending by month,
 * the purchase orders, and the entries to check. With a date range, a sheet of what was spent in it.
 */

const r2 = (v: number) => Math.round(v * 100) / 100;
const M = (v: number | null | undefined): XCell => ({ v: v == null ? null : r2(v), st: 'rate' });
const MB = (v: number): XCell => ({ v: r2(v), st: 'rSubN' });
const H = (s: string): XCell => ({ v: s, st: 'head' });
const B = (s: string): XCell => ({ v: s, st: 'bold' });
const SRC = { invoice: 'Invoice on PO', gl: 'GL entry' } as const;

export function budgetRefs(lines: WbLine[]): BudgetRef[] {
  return lines.map((l) => ({ code: l.code, description: l.description, unit: l.unit, approved: l.budget.cost ?? 0 }));
}

function statement(lines: WbLine[], wb: WorkbookSummary): SheetSpec {
  const rows: (XCell | string | number | null)[][] = [[H('Line'), H('Description'), H('Unit'), H('Budget'), H('Spent'), H('Committed'), H('Spent + committed'), H('Available'), H('Used %')]];
  const leaf = lines.filter((l) => l.leaf);
  const sum = (L: WbLine[], f: (l: WbLine) => number) => L.reduce((a, l) => a + f(l), 0);
  for (const l of lines) {
    const L = l.leaf ? [l] : leaf.filter((x) => x.code.startsWith(l.code + '.'));
    const b = sum(L, (x) => x.budget.cost ?? 0), a = sum(L, (x) => x.actual.cost ?? 0), sc = sum(L, (x) => x.sc ?? 0);
    if (!b && !a && !sc) continue;
    const C = l.leaf ? M : MB;
    rows.push([l.leaf ? l.code : B(l.code), l.leaf ? l.description : B(l.description), l.unit || '', C(b), C(a), C(sc - a), C(sc), C(b - sc), b ? { v: r2(sc / b), st: 'rPct' } : null]);
  }
  const T = wb.totals;
  rows.push([]);
  for (const [k, label] of [['direct', 'Total direct costs'], ['admin', 'Administrative costs'], ['eligible', 'Total eligible costs']] as const) {
    const t = T[k]; if (!t) continue;
    rows.push([B(label), '', '', MB(t.budget), MB(t.actual), MB(t.sc - t.actual), MB(t.sc), MB(t.budget - t.sc), t.budget ? { v: r2(t.sc / t.budget), st: 'rPctB' } : null]);
  }
  return { name: 'Statement', rows, widths: [10, 56, 14, 15, 15, 15, 17, 15, 9] };
}

function ledgerRows(E: Entry[], name: Map<string, string>) {
  return E.map((e) => [e.date, e.period, SRC[e.src], e.doc, e.po, e.line, name.get(e.line) ?? '', e.supplier, e.description, e.detail !== e.description ? e.detail : '', e.account, M(e.amount)]);
}
const LEDGER_HEAD = ['Date', 'Period', 'Type', 'Document', 'PO', 'Line', 'Line description', 'Supplier', 'Description', 'Detail', 'Account', 'Amount'].map(H);

function byMonth(E: Entry[], lines: WbLine[]): SheetSpec {
  const months = [...new Set(E.map((e) => e.date.slice(0, 7)))].sort();
  const key = (e: Entry) => (e.line && e.line !== '0' ? e.line : '—');
  const codes = [...new Set(E.map(key))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const name = new Map(lines.map((l) => [l.code, l.description]));
  const cell = new Map<string, number>();
  for (const e of E) { const k = `${key(e)}|${e.date.slice(0, 7)}`; cell.set(k, (cell.get(k) ?? 0) + e.amount); }
  const rows: (XCell | string | null)[][] = [[H('Line'), H('Description'), ...months.map(H), H('Total')]];
  for (const c of codes) {
    const v = months.map((m) => cell.get(`${c}|${m}`) ?? 0);
    rows.push([c, name.get(c) ?? (c === '—' ? 'No reporting line' : ''), ...v.map((x) => (x ? M(x) : null)), MB(v.reduce((a, x) => a + x, 0))]);
  }
  const col = months.map((m) => codes.reduce((a, c) => a + (cell.get(`${c}|${m}`) ?? 0), 0));
  rows.push([B('Total'), '', ...col.map(MB), MB(col.reduce((a, x) => a + x, 0))]);
  return { name: 'By month', rows, widths: [10, 40, ...months.map(() => 12), 14] };
}

function checks(F: Finding[]): SheetSpec {
  const rows: (XCell | string | null)[][] = [[H('Level'), H('Check'), H('Date'), H('Document'), H('Line'), H('Description'), H('Amount')]];
  for (const f of F) {
    rows.push([B(f.level === 'error' ? 'Error' : f.level === 'warning' ? 'Check' : 'Note'), B(f.title), '', '', '', { v: f.text, st: 'wrap' }, MB(f.amount)]);
    for (const r of f.rows) rows.push(['', '', r.date, r.doc, r.line, r.description, M(r.amount)]);
  }
  if (F.length === 0) rows.push(['', 'No entry needs a second look', '', '', '', '', null]);
  return { name: 'Checks', rows, widths: [8, 28, 11, 30, 9, 70, 14] };
}

export interface OrganisedOptions { from?: string; to?: string; findings?: Finding[] }

export function organisedSheets(p: Project, wb: WorkbookSummary, o: OrganisedOptions = {}): SheetSpec[] {
  const lines = wb.lines, E = wb.entries ?? [], name = new Map(lines.map((l) => [l.code, l.description]));
  const m = wb.meta, T = wb.totals.eligible ?? wb.totals.direct;
  const F = o.findings ?? findErrors(E, { budget: budgetRefs(lines.filter((l) => l.leaf)), start: p.start, end: p.end, bh: m.bh ?? p.bh, pos: wb.pos, sc: new Map(lines.filter((l) => l.leaf).map((l) => [l.code, l.sc ?? 0])) });
  const ranged = !!(o.from || o.to);
  const R = ranged ? spendBetween(E, o.from ?? '', o.to ?? '', budgetRefs(lines)) : null;
  const sheets: SheetSpec[] = [];
  sheets.push({ name: 'Summary', freeze: 0, widths: [34, 22, 18], rows: [
    [{ v: `${p.code} — ${p.name}`, st: 'title' }], [],
    ['Budget head', m.bh ?? p.bh ?? ''], ['Contract', m.contract ?? ''], ['Situation as at', m.situationDate ?? m.asAt ?? ''], ['Source file', wb.fileName ?? ''], [],
    [H('Figure'), H('Amount')],
    ['Budget', M(T?.budget ?? 0)], ['Spent', M(T?.actual ?? 0)], ['Committed', M((T?.sc ?? 0) - (T?.actual ?? 0))], ['Spent + committed', M(T?.sc ?? 0)], ['Available', M((T?.budget ?? 0) - (T?.sc ?? 0))], [],
    ['Dated postings', E.length], ['  of which invoices on POs', E.filter((e) => e.src === 'invoice').length], ['  of which GL entries', E.filter((e) => e.src === 'gl').length],
    ['Sum of dated postings', M(E.reduce((a, e) => a + e.amount, 0))], [],
    ...(R ? [[B(`Spent from ${o.from || 'the start'} to ${o.to || 'today'}`), MB(R.total)]] : []),
    ['Entries to check', F.filter((f) => f.level !== 'info').reduce((a, f) => a + f.rows.length, 0)],
    ...F.filter((f) => f.level !== 'info').map((f) => [`  ${KIND_LABEL[f.kind]}`, f.rows.length]),
  ] });
  if (R) sheets.push({ name: 'Selected period', widths: [10, 50, 15, 15, 15, 9], rows: [
    [{ v: `Spent from ${o.from || 'the start'} to ${o.to || 'today'}`, st: 'title' }], [],
    [H('Line'), H('Description'), H('Invoices on POs'), H('GL entries'), H('Total'), H('Entries')],
    ...R.lines.map((l) => [l.line || '—', l.description, M(l.invoices), M(l.gl), MB(l.amount), l.n]),
    [B('Total'), '', MB(R.lines.reduce((a, l) => a + l.invoices, 0)), MB(R.lines.reduce((a, l) => a + l.gl, 0)), MB(R.total), R.n], [],
    LEDGER_HEAD, ...ledgerRows(R.rows, name),
  ], freeze: 3 });
  sheets.push(statement(lines, wb));
  const leafs = lines.filter((l) => l.leaf);
  if (leafs.some((l) => l.budget.cost)) {
    const C = compareBudget(E, budgetRefs(leafs), new Map(leafs.map((l) => [l.code, l.sc ?? 0])), o.from ?? '', o.to ?? '');
    const st = (x: string) => ({ over: 'Over budget', high: '90%+ used', ok: 'OK', unbudgeted: 'Not budgeted', 'over-flex': 'Addendum (beyond 25%)', 'within-flex': 'Notification (within 25%)', 'near-flex': 'Near addendum (20–25%)' } as Record<string, string>)[x];
    sheets.push({ name: 'Budget vs actual', widths: [10, 46, 15, 15, 15, 15, 15, 9, 26], rows: [
      [{ v: 'Against the approved budget', st: 'title' }], [],
      [H('Heading'), H(''), H('Approved budget'), H('Spent + committed'), H('Difference'), H('%'), H('Status')],
      ...C.heads.map((h) => [h.h, '', M(h.budget), M(h.sc), M(h.diff), h.budget ? { v: r2(h.pct), st: 'rPct' } as XCell : null, st(h.status)]), [],
      [H('Line'), H('Description'), H('Approved budget'), H(ranged ? 'Spent in range' : 'Spent'), H('Spent to range end'), H('Spent + committed'), H('Available'), H('Used %'), H('Status')],
      ...C.lines.map((l) => [l.code, l.description, M(l.budget), M(l.inRange), M(l.toDate), M(l.sc), M(l.available), l.budget ? { v: r2(l.used), st: 'rPct' } as XCell : null, st(l.status)]),
      [B('Total direct costs'), '', MB(C.lines.reduce((a, l) => a + l.budget, 0)), MB(C.lines.reduce((a, l) => a + l.inRange, 0)), MB(C.lines.reduce((a, l) => a + l.toDate, 0)), MB(C.lines.reduce((a, l) => a + l.sc, 0)), MB(C.lines.reduce((a, l) => a + l.available, 0)), null, ''],
    ], freeze: 0 });
  }
  sheets.push({ name: 'Postings', rows: [LEDGER_HEAD, ...ledgerRows(E, name)], widths: [11, 8, 13, 30, 9, 9, 30, 30, 50, 40, 11, 14] });
  if (E.length) sheets.push(byMonth(E, lines));
  if (wb.pos.length) sheets.push({ name: 'Purchase orders', widths: [9, 9, 50, 30, 30, 14, 11, 14, 14, 14, 14], rows: [
    ['PO', 'Line', 'Description', 'Nature', 'Supplier', 'Status', 'Date', 'Ordered', 'Spent', 'Balance', 'Spent + committed'].map(H),
    ...wb.pos.map((x) => [x.po, x.line, x.description, x.nature, x.supplier, x.status, x.date, M(x.amount), M(x.spent), M(x.balance), M(x.sc)]),
    [B('Total'), '', '', '', '', '', '', MB(wb.pos.reduce((a, x) => a + x.amount, 0)), MB(wb.pos.reduce((a, x) => a + x.spent, 0)), MB(wb.pos.reduce((a, x) => a + x.balance, 0)), MB(wb.pos.reduce((a, x) => a + x.sc, 0))]] });
  if (wb.situation.length) sheets.push({ name: 'Budget situation', rows: [
    ['CCM', 'Article', 'Description', 'Budget', 'Requests (DA)', 'POs', 'Invoices', 'Spent', 'Available', 'Balance'].map(H),
    ...wb.situation.map((s) => [s.ccm, s.article, s.description, M(s.budget), M(s.da), M(s.po), M(s.invoice), M(s.actual), M(s.available), M(s.balance)])] });
  if (wb.movements.length) sheets.push({ name: 'Budget movements', rows: [
    ['Date', 'Period', 'Article', 'Description', 'Funding', 'Amount'].map(H),
    ...wb.movements.map((x) => [x.date, x.period, x.article, x.description, x.funding ? 'Yes' : '', M(x.amount)])] });
  sheets.push(checks(F));
  return sheets;
}
