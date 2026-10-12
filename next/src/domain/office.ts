import type { Workbook } from '../ui/xlsx';

/** Running-cost budget of a programme office (CoE Ordinary Budget "External Presence", plus LS & Pagoda rent). */
export interface OfficeAmounts { budget: number; sc: number; planned: number }
export interface OfficeLine { code: string; heading: string; description: string; ob: OfficeAmounts; ls: OfficeAmounts; note?: string; units?: number }
export interface OfficeEntry { line: string; doc: string; description: string; supplier: string; amount: number; spent: number; committed: number; status: string; date: string; fund: 'ob' | 'ls'; gl: boolean }
export interface OfficeSituation { budget: number; da: number; po: number; invoice: number; actual: number; available: number }
export interface OfficeReport {
  /** label of the CCM in the system export, e.g. "Bureau ANKARA" */
  ccmName?: string;
  id: string; date: string; year: number; file: string; importedAt: string;
  office: string; ccm?: string; bh?: string;
  /** Lines from the office's own report/forecast sheet; absent in a raw system export (then carried from an earlier report). */
  lines: OfficeLine[]; hasPlan: boolean; situation?: OfficeSituation; entries: OfficeEntry[];
}
/** A finding on a line, explained by the user: e.g. security booked on 1.10 that belongs to 1.1, corrected in the system. */
export interface OfficeNote { text: string; resolved: boolean; moveTo?: string; at: string }
export interface Office { id: string; name: string; country: string; ccm?: string; bh?: string; reports: OfficeReport[]; /** by `${year}:${line}` */ notes?: Record<string, OfficeNote> }

const num = (v: unknown) => { const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/\s/g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
const low = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
const dmy = (s: string) => { const m = s.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''; };
const xdate = (v: string) => (/^\d{5}(\.\d+)?$/.test(v) ? new Date(Date.UTC(1899, 11, 30) + Math.round(+v) * 864e5).toISOString().slice(0, 10) : /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : dmy(v));

/** True for an office budget workbook: the Ordinary Budget situation or the office's own running-cost report. */
export function isOfficeWorkbook(wb: Workbook): boolean {
  const sit = wb.sheets.find((s) => /situation budg/i.test(s));
  const head = sit ? wb.read(sit).slice(0, 12).flat().join(' ') : '';
  if (/budget\s*ordinaire|external presence/i.test(head)) return true;
  return wb.sheets.some((s) => /^(report|forecast)$/i.test(s.trim()) && /ordinary budget/i.test(wb.read(s).slice(0, 4).flat().join(' ')));
}

/** Reads the office sheet laid out as: code · description · OB budget · LS budget · OB S&C · OB planned · OB left · LS S&C · LS planned · LS left · note. */
function planLines(rows: string[][]): { lines: OfficeLine[]; date: string; office: string } {
  const top = rows.slice(0, 3).flat().join(' ');
  const date = dmy(top.match(/as of\s*([\d./]+)/i)?.[1] ?? '');
  const office = (rows[0]?.find((c) => /office/i.test(c)) ?? '').replace(/^council of europe\s*/i, '').trim();
  const hi = rows.findIndex((r) => r.some((c) => /approved ordinary budget/i.test(c)));
  const H = rows[hi] ?? [];
  const col = (re: RegExp, after = 0) => H.findIndex((c, i) => i >= after && re.test(c));
  const cOB = col(/approved ordinary budget/i), cLS = col(/ls\s*pagoda/i);
  const cSC = col(/spent and commit/i), cPl = col(/(additional expenditures foreseen|planned expenditures)/i);
  const cSC2 = col(/spent and commit/i, cSC + 1), cPl2 = col(/(additional expenditures foreseen|planned expenditures)/i, cPl + 1), cNote = col(/explanation/i);
  const lines: OfficeLine[] = [];
  let heading = '';
  for (const r of rows.slice(hi + 1)) {
    const a = (r[0] ?? '').trim();
    if (/^total/i.test(a) || /^available/i.test(a)) break;
    const hm = a.match(/^(\d)\s*-\s*(.+)$/);
    if (hm && !/^\d+\.\d+/.test(a)) { heading = `${hm[1]} ${hm[2].trim()}`; continue; }
    if (!/^\d+\.\d+$/.test(a)) continue;
    const g = (c: number) => (c >= 0 ? num(r[c]) : 0);
    const l: OfficeLine = { code: a, heading, description: (r[1] ?? '').trim(), ob: { budget: g(cOB), sc: g(cSC), planned: g(cPl) }, ls: { budget: g(cLS), sc: g(cSC2), planned: g(cPl2) } };
    const note = cNote >= 0 ? (r[cNote] ?? '').trim() : '';
    if (note) l.note = note;
    lines.push(l);
  }
  return { lines, date, office };
}

/** Line-level entries (purchase orders, invoices without PO, GL postings) of the system export. */
function entries(rows: string[][]): OfficeEntry[] {
  const hi = rows.findIndex((r) => r.some((c) => /reporting_line/i.test(c)));
  if (hi < 0) return [];
  const H = rows[hi].map(low), c = (n: string) => H.findIndex((h) => h === n.toLowerCase());
  const k = { src: c('source'), bud: c('budget'), line: c('reporting_line'), units: c('nbre_of_units'), doc: c('doc_number'), d: c('description'), dl: c('description_line'), amt: c('po_amount_eur'), sp: c('spent_eur'), cm: c('committed_eur'), st: c('closure_status'), sup: c('supplier'), dt: c('acct_date') };
  return rows.slice(hi + 1).filter((r) => r[k.src] && !/^total/i.test(r[k.src])).map((r) => ({
    line: (r[k.line] ?? '').trim() === '0' ? '' : (r[k.line] ?? '').trim(), doc: r[k.doc] ?? '', description: (r[k.d] || r[k.dl] || '').trim(), supplier: (r[k.sup] ?? '').trim(),
    amount: num(r[k.amt]), spent: num(r[k.sp]), committed: num(r[k.cm]), status: (r[k.st] ?? '').trim(), date: xdate(r[k.dt] ?? ''),
    fund: (r[k.bud] ?? '').trim() === '0101' ? 'ob' : 'ls', gl: /ecriture|gl/i.test(r[k.src]),
  }));
}

/** Reads one office workbook. `prev` (an earlier report of the same office and year) supplies line budgets to a raw export. */
export function readOffice(wb: Workbook, file: string, prev?: OfficeReport): OfficeReport {
  const sitName = wb.sheets.find((s) => /situation budg/i.test(s));
  const sit = sitName ? wb.read(sitName) : [];
  const flat = sit.slice(0, 12).map((r) => r.join(' ')).join('\n');
  const sDate = dmy(flat.match(/date\s*[:=]\s*([\d/]+)/i)?.[1] ?? '');
  const ccm = flat.match(/CCM:\s*(\d+)/)?.[1], bh = flat.match(/Budget Head:\s*(\d+)/)?.[1] ?? flat.match(/BH=(\d+)/)?.[1];
  const ccmName = flat.match(/CCM:\s*\d+\s+([^\n]+)/)?.[1]?.trim();
  let situation: OfficeSituation | undefined;
  const tot = sit.find((r) => /^total budget head/i.test((r[0] ?? '').trim()));
  if (tot) { const v = tot.slice(1).filter((c) => c !== '' && c != null && !isNaN(+c)).map(num); if (v.length >= 6) situation = { budget: v[0], da: v[1], po: v[2], invoice: v[3], actual: v[4], available: v[5] }; }
  // The office's forecast sheet (with planned spending and explanations) is preferred over the plain report sheet.
  const planSheet = wb.sheets.find((s) => /^forecast$/i.test(s.trim())) ?? wb.sheets.find((s) => /^report$/i.test(s.trim()));
  const plan = planSheet ? planLines(wb.read(planSheet)) : null;
  const entSheet = wb.sheets.find((s) => /^data for pivot$/i.test(s.trim())) ?? wb.sheets.find((s) => /^consolidation$/i.test(s.trim()));
  const E = entSheet ? entries(wb.read(entSheet)) : [];
  let lines = plan?.lines ?? [];
  if (!lines.length) {
    // Raw export: line budgets from the earlier report, spent + committed from the entries by reporting line.
    const by = new Map<string, number>(); for (const e of E.filter((e) => e.fund === 'ob')) by.set(e.line, (by.get(e.line) ?? 0) + e.spent + e.committed);
    lines = (prev?.lines ?? []).map((l) => ({ ...l, ob: { budget: l.ob.budget, sc: by.get(l.code) ?? 0, planned: 0 }, ls: { ...l.ls, planned: 0 }, note: undefined }));
    for (const [code, v] of by) if (code && !lines.some((l) => l.code === code)) lines.push({ code, heading: '', description: `Line ${code}`, ob: { budget: 0, sc: v, planned: 0 }, ls: { budget: 0, sc: 0, planned: 0 } });
    lines.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  }
  const date = plan?.date || sDate || new Date().toISOString().slice(0, 10);
  const office = plan?.office || prev?.office || (ccmName ? ccmName.replace(/^bureau\s+/i, '').replace(/\b\w/g, (x) => x.toUpperCase()).replace(/(\w+)/, (w) => w[0] + w.slice(1).toLowerCase()) + ' Office' : 'Programme office');
  return { ccmName, id: `${bh ?? 'office'}-${date}`, date, year: +date.slice(0, 4), file, importedAt: new Date().toISOString(), office, ccm, bh, lines, hasPlan: !!plan?.lines.length, situation, entries: E };
}

export type Fund = 'ob' | 'ls';
export interface FundCalc { left: number; leftAfterPlan: number; use: number; flag?: string }
export interface OfficeView {
  r: OfficeReport; lines: (OfficeLine & { c: Record<Fund, FundCalc> })[];
  T: Record<Fund, OfficeAmounts & { left: number }>; yearShare: number;
}
/** Totals, balances and warnings per fund: overspent lines, lines over the time share of the year, plans beyond budget. */
export function officeView(r: OfficeReport): OfficeView {
  const d = new Date(r.date + 'T00:00:00Z'), y0 = Date.UTC(r.year, 0, 1), y1 = Date.UTC(r.year + 1, 0, 1);
  const yearShare = Math.min(1, Math.max(0, (d.getTime() - y0) / (y1 - y0)));
  const calc = (a: OfficeAmounts): FundCalc => {
    const left = a.budget - a.sc, leftAfterPlan = left - a.planned, use = a.budget ? a.sc / a.budget : a.sc ? Infinity : 0;
    const flag = a.sc > 0.5 && !a.budget ? 'spent without a budget' : left < -0.5 ? 'over budget' : r.hasPlan && leftAfterPlan < -0.5 ? 'plan exceeds budget' : a.budget > 500 && use > yearShare + 0.35 ? 'ahead of the year' : undefined;
    return { left, leftAfterPlan, use, flag };
  };
  const lines = r.lines.map((l) => ({ ...l, c: { ob: calc(l.ob), ls: calc(l.ls) } }));
  const sum = (k: Fund) => { const o = { budget: 0, sc: 0, planned: 0 }; for (const l of r.lines) { o.budget += l[k].budget; o.sc += l[k].sc; o.planned += l[k].planned; } return { ...o, left: o.budget - o.sc - o.planned }; };
  return { r, lines, T: { ob: sum('ob'), ls: sum('ls') }, yearShare };
}

/** Country of an office from its CCM label or name (Bureau ANKARA → tr). */
const CITY: [RegExp, string, string][] = [
  [/ankara|istanbul|t[uü]rk/i, 'tr', 'Türkiye'], [/tbilisi|georgia/i, 'ge', 'Georgia'], [/kyiv|kiev|ukrain/i, 'ua', 'Ukraine'], [/tirana|albania/i, 'al', 'Albania'],
  [/chi[sș]in[aă]u|moldova/i, 'md', 'Moldova'], [/yerevan|armenia/i, 'am', 'Armenia'], [/baku|azerbaijan/i, 'az', 'Azerbaijan'], [/belgrade|serbia/i, 'rs', 'Serbia'],
  [/sarajevo|bosnia/i, 'ba', 'Bosnia and Herzegovina'], [/podgorica|montenegro/i, 'me', 'Montenegro'], [/skopje|macedonia/i, 'mk', 'North Macedonia'], [/pristina|prishtin|kosovo/i, 'xk', 'Kosovo'],
];
export function officeCountry(text: string): { id: string; name: string } | null {
  const m = CITY.find(([re]) => re.test(text));
  return m ? { id: m[1], name: m[2] } : null;
}

export interface PaceLine { code: string; description: string; budget: number; sc: number; officeEnd: number; paceEnd: number; gap: number; low: boolean; monthly: number }
/**
 * Year-end estimate from the actual pace: payments so far spread over the share of the year gone, never below
 * what is already spent + committed. Compared with the office's own forecast (spent + committed + foreseen).
 */
export function officePace(r: OfficeReport, fund: Fund = 'ob'): { lines: PaceLine[]; officeEnd: number; paceEnd: number; yearShare: number } {
  const ys = officeView(r).yearShare || 1 / 12;
  const paid = new Map<string, number>(), months = new Map<string, Set<string>>();
  for (const e of r.entries.filter((e) => e.fund === fund)) {
    paid.set(e.line, (paid.get(e.line) ?? 0) + e.spent);
    if (e.spent > 0.5 && e.date) months.set(e.line, (months.get(e.line) ?? new Set()).add(e.date.slice(0, 7)));
  }
  const lines = r.lines.filter((l) => l[fund].budget || l[fund].sc || l[fund].planned).map((l) => {
    const a = l[fund], p = paid.get(l.code) ?? a.sc, officeEnd = a.sc + a.planned;
    // Only recurring costs (paid in 3+ different months) are projected at their pace; one-off purchases
    // (insurance, a renovation) would be wildly overstated, so the office forecast stands for those.
    const recurring = (months.get(l.code)?.size ?? 0) >= 3;
    const paceEnd = recurring ? Math.max(a.sc, p / ys) : Math.max(a.sc, officeEnd), gap = paceEnd - officeEnd;
    return { code: l.code, description: l.description, budget: a.budget, sc: a.sc, officeEnd, paceEnd, gap, low: r.hasPlan && gap > Math.max(250, officeEnd * 0.15), monthly: p / (ys * 12) };
  });
  return { lines, officeEnd: lines.reduce((s, l) => s + l.officeEnd, 0), paceEnd: lines.reduce((s, l) => s + l.paceEnd, 0), yearShare: ys };
}

export interface Transfer { from: string; fromDesc: string; to: string; toDesc: string; amount: number }
/**
 * Covers lines short after the forecast with the room other lines keep after their own forecast (and pace),
 * largest needs first; what cannot be covered is the additional budget to request. Lines a note marks as
 * corrected (booked on the wrong line) are left out.
 */
export function transferPlan(r: OfficeReport, skip: (code: string) => boolean = () => false): { transfers: Transfer[]; needs: { code: string; description: string; need: number; covered: number }[]; request: number; spare: number } {
  const pace = new Map(officePace(r).lines.map((l) => [l.code, l.paceEnd]));
  const L = r.lines.filter((l) => !skip(l.code));
  const room = L.map((l) => ({ l, v: Math.floor(l.ob.budget - Math.max(l.ob.sc + l.ob.planned, pace.get(l.code) ?? 0)) })).filter((x) => x.v >= 50).sort((a, b) => b.v - a.v);
  const needs = L.map((l) => ({ code: l.code, description: l.description, need: Math.ceil(l.ob.sc + l.ob.planned - l.ob.budget), covered: 0 })).filter((x) => x.need > 0).sort((a, b) => b.need - a.need);
  const transfers: Transfer[] = [];
  for (const n of needs) for (const d of room) {
    if (n.covered >= n.need) break; if (d.v <= 0) continue;
    const amt = Math.min(d.v, n.need - n.covered); d.v -= amt; n.covered += amt;
    transfers.push({ from: d.l.code, fromDesc: d.l.description, to: n.code, toDesc: n.description, amount: amt });
  }
  return { transfers, needs, request: needs.reduce((s, n) => s + n.need - n.covered, 0), spare: room.reduce((s, d) => s + d.v, 0) };
}
