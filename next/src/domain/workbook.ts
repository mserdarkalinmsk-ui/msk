import { extractStaff, n2, type Sheet, type StaffGroup, type StaffRecord } from './staff';

/**
 * Reader for the Council of Europe financial-report workbook (REPORT / Forecast /
 * Situation Budgétaire / Purchase Orders / Ecriture GL / Factures / Budget Movements…).
 * Every sheet is optional and found by its column headings, not its name.
 */

export interface Triple { units: number | null; rate: number | null; cost: number | null }
export interface WbLine {
  code: string; description: string; unit: string; level: number; leaf: boolean;
  budget: Triple; actual: Triple; sc: number | null; planned?: Triple; proposal?: Triple; rounded?: Triple;
}
export interface WbTotals { budget: number; actual: number; sc: number; planned?: number; proposal?: number; rounded?: number }
export interface WbMeta {
  title?: string; contract?: string; jp?: string; bh?: string; periodFrom?: string; periodTo?: string; asAt?: string;
  plannedFrom?: string; plannedTo?: string; situationDate?: string; situationPeriod?: string;
}
export interface SituationRow { ccm: string; article: string; description: string; budget: number; da: number; po: number; invoice: number; actual: number; available: number; balance: number }
export interface PO { po: string; line: string; description: string; nature: string; supplier: string; amount: number; spent: number; balance: number; sc: number; status: string; date: string; units: number | null; unitType: string }
export interface Movement { article: string; period: string; date: string; amount: number; description: string; funding: boolean }
export interface MonthPoint { month: string; invoices: number; gl: number }
export interface Check { ok: boolean; level: 'error' | 'warning' | 'info'; text: string }

export interface Workbook {
  meta: WbMeta;
  lines: WbLine[];
  totals: { direct?: WbTotals; contingency?: WbTotals; admin?: WbTotals; eligible?: WbTotals };
  situation: SituationRow[];
  pos: PO[];
  monthly: MonthPoint[];
  movements: Movement[];
  staff: StaffRecord[]; staffGroups: Record<string, StaffGroup>;
  sheets: string[];
  checks: Check[];
}

/* ---------- value helpers ---------- */
const num = (v: unknown): number | null => {
  const s = String(v ?? '').trim();
  if (!s || s === '-' || s === '–') return null;
  const x = Number(s.replace(/[\s€ ]/g, '').replace(/,(?=\d{1,2}$)/, '.').replace(/,/g, ''));
  return Number.isFinite(x) ? x : null;
};
const z = (v: unknown) => num(v) ?? 0;
const dmy = (s: string) => { const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/); if (!m) return ''; const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; };
/** Excel serial, ISO date-time text or dd/mm/yyyy → YYYY-MM-DD. */
export const toDay = (v: unknown): string => {
  const s = String(v ?? '').trim(); if (!s) return '';
  if (/^\d{4,5}(\.\d+)?$/.test(s)) return new Date(Date.UTC(1899, 11, 30) + Math.round(+s) * 86_400_000).toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return dmy(s);
};
const MON: Record<string, string> = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06', JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12' };
/** "JUL-26" → "2026-07". */
export const periodMonth = (p: string) => { const m = p.trim().toUpperCase().match(/^([A-Z]{3})-(\d{2,4})$/); return m && MON[m[1]] ? `${m[2].length === 2 ? '20' + m[2] : m[2]}-${MON[m[1]]}` : ''; };

/** Finds the sheet whose header row has all `must` columns; when several match (e.g. an empty
 *  "Factures sans PO" next to "Factures a date") the one with the most data rows wins. */
function table(sheets: Sheet[], must: string[]) {
  let best: { sh: Sheet; at: number } | null = null;
  for (const sh of sheets) {
    const at = sh.R.findIndex((r) => must.every((k) => r.some((x) => n2(x) === k)));
    if (at >= 0 && (!best || sh.R.length - at > best.sh.R.length - best.at)) best = { sh, at };
  }
  if (!best) return null;
  const { sh, at } = best, H = sh.R[at].map(n2);
  return { sh, at, rows: sh.R.slice(at + 1), col: (...ks: string[]) => { for (const k of ks) { const i = H.indexOf(k); if (i >= 0) return i; } return -1; } };
}
const cell = (r: string[], i: number) => (i >= 0 ? String(r[i] ?? '').trim() : '');

/* ---------- financial report grid (REPORT and/or Forecast) ---------- */
type Group = 'budget' | 'actual' | 'sc' | 'planned' | 'planned2' | 'proposal' | 'rounded';
function groupOf(label: string): Group | null {
  const t = n2(label);
  if (t.startsWith('budgetforallyears')) return 'budget';
  if (t.startsWith('actualexp')) return 'actual';
  if (t.startsWith('spentandcommitted')) return 'sc';
  if (t.startsWith('plannedexpenditure')) return 'planned';
  if (t.startsWith('budgetproposalcalc')) return 'proposal';
  if (t.startsWith('budgetproposalround')) return 'rounded';
  return null;
}

function readGrid(sh: Sheet) {
  const hi = sh.R.findIndex((r) => n2(r[0]) === 'description' && r.some((x) => n2(x) === 'unit'));
  if (hi < 1) return null;
  // group headings sit on one of the two rows above the sub-headings
  const groups: { g: Group; at: number; label: string }[] = [];
  for (const gr of [sh.R[hi - 1] ?? [], sh.R[hi - 2] ?? []]) gr.forEach((x, i) => {
    let g = groupOf(String(x ?? '')); if (!g) return;
    if (g === 'planned' && groups.some((y) => y.g === 'planned')) g = 'planned2';
    if (!groups.some((y) => y.at === i)) groups.push({ g, at: i, label: String(x).replace(/\s+/g, ' ').trim() });
  });
  // The first group heading often sits on the "Interim report covering…" cell; the budget block starts at the first "# of units".
  const sub = sh.R[hi].map(n2);
  const unitsCols = sub.map((x, i) => (x.startsWith('ofunits') ? i : -1)).filter((i) => i >= 0);
  groups.sort((a, b) => a.at - b.at);
  const starts = new Map<Group, number>();
  for (const g of groups) {
    const u = unitsCols.find((c) => c >= g.at) ?? g.at;
    starts.set(g.g, g.g === 'sc' ? g.at : u);
  }
  if (!starts.has('budget') && unitsCols.length) starts.set('budget', unitsCols[0]);
  if (!starts.has('actual') && unitsCols.length > 1) starts.set('actual', unitsCols[1]);
  const trip = (r: string[], g: Group): Triple | undefined => {
    const s = starts.get(g); if (s == null) return undefined;
    return { units: num(r[s]), rate: num(r[s + 1]), cost: num(r[s + 2]) };
  };
  const lines: WbLine[] = [];
  const totals: Workbook['totals'] = {};
  const meta: WbMeta = {};
  const costCols = (['budget', 'actual', 'sc', 'planned', 'proposal', 'rounded'] as Group[]).map((g) => [g, g === 'sc' ? starts.get('sc') : (starts.get(g) ?? -10) + 2] as const);
  for (const g of groups) {
    if (g.g === 'planned' || g.g === 'planned2') {
      const m = g.label.match(/from\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+to\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
      if (m && g.g === 'planned') { meta.plannedFrom = dmy(m[1]); meta.plannedTo = dmy(m[2]); }
    }
    if (g.g === 'actual') { const m = g.label.match(/as at\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i); if (m) meta.asAt = dmy(m[1]); }
  }
  for (let i = hi + 1; i < sh.R.length; i++) {
    const r = sh.R[i], a = String(r[0] ?? '').trim();
    const tm = a.match(/^(7|8|9|10|11)\.\s/);
    if (tm) {
      // totals rows put each group's total in that group's cost column (sometimes shifted left in REPORT)
      const vals = r.slice(1).map(num).filter((x): x is number => x != null);
      const byCol = Object.fromEntries(costCols.filter(([, c]) => c != null && c >= 0).map(([g, c]) => [g, num(r[c!])]));
      const t: WbTotals = byCol.budget != null || byCol.actual != null
        ? { budget: byCol.budget ?? 0, actual: byCol.actual ?? 0, sc: byCol.sc ?? 0, planned: byCol.planned ?? undefined, proposal: byCol.proposal ?? undefined, rounded: byCol.rounded ?? undefined }
        : { budget: vals[0] ?? 0, actual: vals[1] ?? 0, sc: vals[2] ?? 0 };
      // Numbering differs between templates (admin is 8 without a contingency row, 10 with one): classify by wording.
      const key: keyof Workbook['totals'] | undefined = /administrative|indirect/i.test(a) ? 'admin' : /contingency/i.test(a) ? 'contingency'
        : /total eligible costs/i.test(a) ? 'eligible' : /direct eligible/i.test(a) && /sub-?total|\(1\s*\+/i.test(a) ? 'direct' : undefined;
      if (key) totals[key] = t;
      continue;
    }
    const m = a.match(/^(\d+(?:\.\d+)*)\.?\s+(.+)$/);
    if (!m || /^sub-?total/i.test(a)) continue;
    const b = trip(r, 'budget')!, ac = trip(r, 'actual')!;
    lines.push({
      code: m[1], description: m[2].trim(), unit: String(r[1] ?? '').trim(), level: m[1].split('.').length, leaf: true,
      budget: b, actual: ac, sc: starts.has('sc') ? num(r[starts.get('sc')!]) : null,
      planned: trip(r, 'planned'), proposal: trip(r, 'proposal'), rounded: trip(r, 'rounded'),
    });
  }
  for (const l of lines) l.leaf = !lines.some((o) => o !== l && o.code.startsWith(l.code + '.'));
  return { lines, totals, meta, hasForecast: starts.has('planned') };
}

/* ---------- main ---------- */
export function parseWorkbook(sheets: Sheet[]): Workbook {
  const meta: WbMeta = {};
  const text = sheets.flatMap((s) => s.R.slice(0, 16).flat()).map((x) => String(x ?? ''));
  for (const t of text) {
    const c = t.match(/Contract\s*n[°o.]?\s*:?\s*(\d{5,})/i); if (c && !meta.contract) meta.contract = c[1];
    const jb = t.match(/JP\s*(\d+)\s*-\s*BH\s*(\d+)/i); if (jb) { meta.jp ??= jb[1]; meta.bh ??= jb[2]; }
    const bh = t.match(/\bBH\s*[=:]?\s*(\d{3,})/i); if (bh && !meta.bh) meta.bh = bh[1];
    const p = t.match(/period\s+from\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+to\s+(\d{1,2}\/\d{1,2}\/\d{4})/i); if (p && !meta.periodFrom) { meta.periodFrom = dmy(p[1]); meta.periodTo = dmy(p[2]); }
    const sd = t.match(/^Date\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i); if (sd && !meta.situationDate) meta.situationDate = dmy(sd[1]);
    const sp = t.match(/Period\s*:\s*([A-Z]{3}-\d{2})/i); if (sp && !meta.situationPeriod) meta.situationPeriod = sp[1].toUpperCase();
  }
  // Prefer the Forecast grid (it carries planned + proposal columns), else REPORT.
  const grids = sheets.map((s) => ({ s, g: readGrid(s) })).filter((x) => x.g && x.g.lines.length);
  const best = grids.find((x) => x.g!.hasForecast) ?? grids[0];
  const report = grids.find((x) => !x.g!.hasForecast);
  const lines = best?.g!.lines ?? [];
  const totals = { ...(report?.g!.totals ?? {}), ...(best?.g!.totals ?? {}) };
  Object.assign(meta, Object.fromEntries(Object.entries(best?.g!.meta ?? {}).filter(([, v]) => v)));
  for (const s of sheets) { const t = String(s.R[0]?.[0] ?? '').trim(); if (!meta.title && grids.some((g) => g.s === s) && t && !/^\d/.test(t)) meta.title = t.split(/\r?\n/)[0].trim(); }

  /* situation budgétaire */
  const situation: SituationRow[] = [];
  const sb = table(sheets, ['ccm', 'article', 'depensesreelles']);
  if (sb && sb.col('depensesreelles') >= 0) {
    const C = { ccm: sb.col('ccm'), art: sb.col('article'), d: sb.col('description'), b: sb.col('budget'), da: sb.col('engagementda'), po: sb.col('engagementpo'), inv: sb.col('engagementfacture'), act: sb.col('depensesreelles'), av: sb.col('disponible'), bal: sb.col('solde') };
    for (const r of sb.rows) if (/^\d{3,}$/.test(cell(r, C.ccm)) && /^\d+$/.test(cell(r, C.art)))
      situation.push({ ccm: cell(r, C.ccm), article: cell(r, C.art), description: cell(r, C.d), budget: z(r[C.b]), da: z(r[C.da]), po: z(r[C.po]), invoice: z(r[C.inv]), actual: z(r[C.act]), available: z(r[C.av]), balance: z(r[C.bal]) });
  }

  /* purchase orders */
  const pos: PO[] = [];
  const pt = table(sheets, ['ponumber', 'descriptionpo']);
  if (pt) {
    const C = { line: pt.col('reportingline'), ut: pt.col('unittype'), u: pt.col('nbreofunits'), po: pt.col('ponumber'), d: pt.col('descriptionpo'), nat: pt.col('descriptionpoline'), amt: pt.col('poamountineur'), sp: pt.col('spentineur'), bal: pt.col('balanceonpoineur'), sc: pt.col('spentandcommittedineur'), st: pt.col('closurestatus'), sup: pt.col('supplier'), dt: pt.col('encumbereddate') };
    for (const r of pt.rows) {
      if (!cell(r, C.po)) continue;
      pos.push({ po: cell(r, C.po), line: cell(r, C.line), description: cell(r, C.d), nature: cell(r, C.nat), supplier: cell(r, C.sup), amount: z(r[C.amt]), spent: z(r[C.sp]), balance: z(r[C.bal]), sc: z(r[C.sc]), status: cell(r, C.st), date: toDay(r[C.dt]), units: num(r[C.u]), unitType: cell(r, C.ut) });
    }
  }

  /* monthly actuals: invoices (PO spend) + GL postings */
  const months = new Map<string, MonthPoint>();
  const add = (m: string, k: 'invoices' | 'gl', v: number) => { if (!m) return; const p = months.get(m) ?? { month: m, invoices: 0, gl: 0 }; p[k] += v; months.set(m, p); };
  const inv = table(sheets, ['invoiceno', 'montantligne']);
  if (inv) { const dg = inv.col('dategl'), pe = inv.col('period'), am = inv.col('montantligne'); for (const r of inv.rows) add(periodMonth(cell(r, pe)) || toDay(r[dg]).slice(0, 7), 'invoices', z(r[am])); }
  const gl = table(sheets, ['glnumber', 'reportingline']);
  if (gl) { const pe = gl.col('period'), ad = gl.col('accountingdate'), am = gl.col('spent'); for (const r of gl.rows) add(periodMonth(cell(r, pe)) || toDay(r[ad]).slice(0, 7), 'gl', z(r[am])); }
  const monthly = [...months.values()].sort((a, b) => a.month.localeCompare(b.month));

  /* budget movements: EU / donor contributions vs internal transfers */
  const movements: Movement[] = [];
  const mv = table(sheets, ['movement']);
  if (mv) {
    const C = { art: mv.col('article'), pe: mv.col('period'), dt: mv.col('date'), am: mv.col('movement'), d: mv.col('linesdescription', 'description') };
    for (const r of mv.rows) {
      const amount = num(r[C.am]); if (amount == null) continue;
      const description = cell(r, C.d);
      movements.push({ article: cell(r, C.art), period: cell(r, C.pe), date: toDay(r[C.dt]) || (periodMonth(cell(r, C.pe)) + '-01'), amount, description, funding: /\b(CV|UNION|EU|AVANCE|TRANCHE|CONTRIBUTION|DONOR)\b/i.test(description) });
    }
  }

  const { records: staff, groups: staffGroups } = extractStaff(sheets);
  const wb: Workbook = { meta, lines, totals, situation, pos, monthly, movements, staff, staffGroups, sheets: sheets.map((s) => s.name), checks: [] };
  wb.checks = reconcile(wb);
  return wb;
}

/* ---------- cross-checks ---------- */
const close = (a: number, b: number, tol = 1) => Math.abs(a - b) <= tol;
const eur = (v: number) => '€' + Math.round(v).toLocaleString('en-GB');

export function reconcile(wb: Workbook): Check[] {
  const C: Check[] = [];
  const leaf = wb.lines.filter((l) => l.leaf);
  const sum = (f: (l: WbLine) => number | null | undefined) => leaf.reduce((s, l) => s + (f(l) ?? 0), 0);
  const d = wb.totals.direct;
  if (d) {
    const b = sum((l) => l.budget.cost), a = sum((l) => l.actual.cost);
    C.push({ ok: close(b, d.budget), level: close(b, d.budget) ? 'info' : 'error', text: `Budget lines add up to the direct-cost total (${eur(b)} vs ${eur(d.budget)})` });
    C.push({ ok: close(a, d.actual), level: close(a, d.actual) ? 'info' : 'error', text: `Actual lines add up to the direct-cost total (${eur(a)} vs ${eur(d.actual)})` });
  }
  const ad = wb.totals.admin;
  if (d && ad) {
    const ok = close(ad.actual, d.actual * 0.07, 2) && close(ad.budget, d.budget * 0.07, 2);
    C.push({ ok, level: ok ? 'info' : 'warning', text: `Administrative costs are 7% of direct costs (actual ${eur(ad.actual)})` });
  }
  if (wb.situation.length && wb.totals.eligible) {
    const sAct = wb.situation.reduce((s, r) => s + r.actual, 0);
    const gap = sAct - (d?.actual ?? 0);
    C.push({ ok: true, level: 'info', text: `Accounting actuals (Situation budgétaire) ${eur(sAct)}; report direct costs ${eur(d?.actual ?? 0)} — difference ${eur(gap)} is the overhead booked in accounts` });
  }
  if (wb.pos.length) {
    const open = wb.pos.filter((p) => /open/i.test(p.status) && p.balance > 0.5);
    C.push({ ok: true, level: open.length ? 'warning' : 'info', text: `${open.length} open purchase orders still hold ${eur(open.reduce((s, p) => s + p.balance, 0))} of commitments` });
  }
  const over = leaf.filter((l) => (l.budget.cost ?? 0) > 0 && (l.sc ?? l.actual.cost ?? 0) > (l.budget.cost ?? 0));
  for (const l of over) C.push({ ok: false, level: 'warning', text: `Line ${l.code} ${l.description}: spent + committed ${eur(l.sc ?? 0)} exceeds budget ${eur(l.budget.cost ?? 0)}` });
  const rate = leaf.filter((l) => l.budget.rate && l.actual.rate && l.actual.units && l.actual.rate > l.budget.rate * 1.15);
  for (const l of rate) C.push({ ok: false, level: 'warning', text: `Line ${l.code} ${l.description}: actual unit rate ${eur(l.actual.rate!)} is ${Math.round((l.actual.rate! / l.budget.rate! - 1) * 100)}% above budget rate ${eur(l.budget.rate!)}` });
  if (wb.pos.length && wb.situation.length) {
    const openBal = wb.pos.filter((p) => /open/i.test(p.status)).reduce((s, p) => s + p.balance, 0);
    const sbPo = wb.situation.reduce((s, r) => s + r.po, 0);
    C.push({ ok: close(openBal, sbPo, 5), level: close(openBal, sbPo, 5) ? 'info' : 'warning', text: `Open PO balances match PO commitments in the accounts (${eur(openBal)} vs ${eur(sbPo)})` });
  }
  return C;
}

/** Converts parsed lines to app budget lines (leaf lines + administrative costs as line 10). */
export function toBudgetLines(wb: Workbook) {
  const L = wb.lines.filter((l) => l.leaf && ((l.budget.cost ?? 0) !== 0 || (l.actual.cost ?? 0) !== 0 || (l.sc ?? 0) !== 0)).map((l) => {
    const actual = l.actual.cost ?? 0, sc = l.sc ?? actual;
    return { code: l.code, description: l.description, unit: l.unit, approved: l.budget.cost ?? 0, approvedUnits: l.budget.units, unitRate: l.budget.rate, actual, spentCommitted: sc, committed: Math.max(0, sc - actual), reportedUnits: l.actual.units, reportedUnitRate: l.actual.rate, forecast: l.planned?.cost ?? null, proposedBudget: l.proposal?.cost ?? null, roundedBudget: l.rounded?.cost ?? null };
  });
  const ad = wb.totals.admin;
  if (ad && (ad.budget || ad.actual)) L.push({ code: '10', description: 'Administrative costs', unit: '7%', approved: ad.budget, approvedUnits: null, unitRate: null, actual: ad.actual, spentCommitted: ad.sc, committed: Math.max(0, ad.sc - ad.actual), reportedUnits: null, reportedUnitRate: null, forecast: ad.planned ?? null, proposedBudget: ad.proposal ?? null, roundedBudget: ad.rounded ?? null });
  return L;
}

/** Compact copy stored with the report (staff are stored separately as staffRecords). */
export type WorkbookSummary = Omit<Workbook, 'staff' | 'staffGroups'> & { fileName?: string; importedAt?: string };
export const summarize = (wb: Workbook, fileName?: string): WorkbookSummary => {
  const { staff: _s, staffGroups: _g, ...rest } = wb; void _s; void _g;
  return { ...rest, fileName, importedAt: new Date().toISOString() };
};
