import type { SheetSpec, XCell } from '../ui/xlsxwrite';
import { defaultOptions, forecastSheets, ifrSheet, type ForecastOptions, type ReportLook } from './forecastTemplate';
import type { Project } from './types';
import { usedUnits, type WorkbookSummary } from './workbook';

/**
 * A raw system extraction laid out as the finance team's report workbook:
 *  - "data for pivot": every PO line and GL entry with its reporting line; NBRE_OF_UNITS holds the units used
 *    (spent share of a PO, months paid on a staff PO, 0 for a PO with nothing spent), the ordered units kept beside it;
 *  - "pivot": units, spent and spent + committed by reporting line (SUMIF formulas over "data for pivot");
 *  - "REPORT": the official interim/final financial report, its actual columns linked to "pivot" and its sub-totals
 *    and totals as formulas, so a unit corrected in "data for pivot" flows through to the report;
 *  - optionally the Forecast workbook (12-month forecast, or a budget revision by notification or addendum).
 */

const HEAD = ['SOURCE', 'REPORTING_LINE', 'UNIT_TYPE', 'NBRE_OF_UNITS', 'UNITS_ORDERED', 'DOC_NUMBER', 'DESCRIPTION', 'DESCRIPTION_LINE', 'SUPPLIER', 'PO_AMOUNT_EUR', 'SPENT_EUR', 'COMMITTED_EUR', 'SPENT_COM_EUR', 'CLOSURE_STATUS', 'DATE'];
const r2 = (v: number) => Math.round(v * 100) / 100;
const N = (v: number | null | undefined): XCell => ({ v: v == null ? null : r2(v), st: 'rate' });

export function dataForPivot(wb: WorkbookSummary): { rows: (string | number | XCell | null)[][]; n: number } {
  const E = wb.entries ?? [], asAt = wb.meta.situationDate;
  const paid = new Map<string, Set<string>>();
  for (const e of E) if (e.src === 'invoice' && e.po) paid.set(e.po, (paid.get(e.po) ?? new Set()).add(e.period || e.date.slice(0, 7)));
  const rows: (string | number | XCell | null)[][] = [HEAD.map((h) => ({ v: h, st: 'head' }))];
  for (const p of wb.pos) {
    const u = p.units ?? 0, used = usedUnits(u, p.spent, p.sc, p.description, p.unitType, asAt, paid.get(p.po)?.size);
    rows.push(['1-PURCHASE ORDERS', p.line, p.unitType, N(used), N(u), p.po, p.description, p.nature, p.supplier, N(p.amount), N(p.spent), N(p.sc - p.spent), N(p.sc), p.status, p.date]);
  }
  for (const e of E) if (e.src === 'gl')
    rows.push(['3-ECRITURE GL', e.line === '10' ? '0' : e.line, e.unitType ?? '', N(e.units ?? 0), N(e.units ?? 0), e.doc, e.description, e.detail, '', N(0), N(e.amount), N(0), N(e.amount), '', e.date]);
  return { rows, n: rows.length };
}

function pivot(wb: WorkbookSummary, n: number): SheetSpec {
  const codes = [...new Set([...wb.pos.map((p) => p.line), ...(wb.entries ?? []).filter((e) => e.src === 'gl').map((e) => (e.line === '10' ? '0' : e.line))])]
    .filter(Boolean).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const D = `'data for pivot'!`, rng = (c: string) => `${D}$${c}$2:$${c}$${n}`;
  const sum = (code: string, k: 'u' | 's' | 'c') => {
    let t = 0;
    for (const p of wb.pos) if (p.line === code) t += k === 'u' ? usedUnits(p.units ?? 0, p.spent, p.sc, p.description, p.unitType, wb.meta.situationDate, new Set((wb.entries ?? []).filter((e) => e.src === 'invoice' && e.po === p.po).map((e) => e.period || e.date.slice(0, 7))).size) : k === 's' ? p.spent : p.sc;
    for (const e of wb.entries ?? []) if (e.src === 'gl' && (e.line === '10' ? '0' : e.line) === code) t += k === 'u' ? e.units ?? 0 : e.amount;
    return r2(t);
  };
  const rows: (string | XCell)[][] = [['Row Labels', 'Sum of NBRE_OF_UNITS', 'Sum of SPENT_EUR', 'Sum of SPENT_COM_EUR'].map((v) => ({ v, st: 'head' }))];
  codes.forEach((c, i) => {
    const r = i + 2;
    rows.push([c, { f: `SUMIF(${rng('B')},$A${r},${rng('D')})`, v: sum(c, 'u'), st: 'rate' }, { f: `SUMIF(${rng('B')},$A${r},${rng('K')})`, v: sum(c, 's'), st: 'rate' }, { f: `SUMIF(${rng('B')},$A${r},${rng('M')})`, v: sum(c, 'c'), st: 'rate' }]);
  });
  const last = codes.length + 1;
  rows.push([{ v: 'Grand Total', st: 'bold' }, ...['B', 'C', 'D'].map((c) => ({ f: `SUM(${c}2:${c}${last})`, v: 0, st: 'rSubN' as const }))]);
  return { name: 'pivot', rows, widths: [14, 18, 18, 20] };
}

/** The REPORT sheet with its actual columns linked to "pivot" and the sub-totals and totals as formulas. */
function linkedReport(p: Project, today: Date, look: ReportLook): SheetSpec {
  const s = ifrSheet(p, today, undefined, look), final = look.kind === 'final';
  const txt = (c: unknown) => String(c && typeof c === 'object' ? (c as XCell).v ?? '' : c ?? '');
  const L = (c: number) => String.fromCharCode(65 + c);
  const A = { u: 5, rate: 6, sp: 7, sc: 8, cost: 4 } as const;
  const cols = final ? [A.cost, A.sp] : [A.cost, A.sp, A.sc];
  const set = (r: (string | number | XCell | null | undefined)[], c: number, f: string) => { const x = (r[c] ?? {}) as XCell; r[c] = { f, v: typeof x.v === 'number' ? x.v : 0, st: x.st ?? 'rNum' }; };
  let block: number[] = [];
  const subs: number[] = [];
  let r7 = 0, r8 = 0, r9 = 0, r10 = 0;
  s.rows.forEach((row, i) => {
    const R = i + 1, label = txt(row[0]), code = /^(\d+(?:\.\d+)*)\s/.exec(label)?.[1];
    if (code && txt(row[1]) && typeof (row[A.cost] as XCell)?.v === 'number') {
      const k = `"${code}"`, look_ = (c: number) => `IFERROR(VLOOKUP(${k},pivot!$A:$D,${c},FALSE),0)`;
      const has = (row[A.sp] as XCell)?.v !== '-';
      if (has) {
        set(row, A.u, look_(2)); set(row, A.sp, look_(3)); if (!final) set(row, A.sc, look_(4));
        set(row, A.rate, `IF(${L(A.u)}${R}=0,0,${L(A.sp)}${R}/${L(A.u)}${R})`);
      }
      block.push(R);
    } else if (/^Sub-total/.test(label)) {
      for (const c of cols) set(row, c, block.length ? `SUM(${block.map((x) => `${L(c)}${x}`).join(',')})` : '0');
      subs.push(R); block = [];
    } else if (/^7\./.test(label)) { r7 = R; for (const c of cols) set(row, c, `SUM(${subs.map((x) => `${L(c)}${x}`).join(',')})`); }
    else if (/^8\./.test(label)) r8 = R;
    else if (/^9\./.test(label)) { r9 = R; for (const c of cols) set(row, c, `${L(c)}${r7}${r8 ? `+N(${L(c)}${r8})` : ''}`); }
    else if (/^10\./.test(label)) { r10 = R; for (const c of cols) if (c !== A.cost) set(row, c, `ROUND(${L(c)}${r9}*7/100,2)`); }
    else if (/^11\./.test(label)) { for (const c of cols) set(row, c, `${L(c)}${r9}+${L(c)}${r10}`); }
  });
  return s;
}

export type PackExtra = 'none' | 'twelve' | 'notification' | 'addendum';

export function reportPack(p: Project, wb: WorkbookSummary, today: Date, look: ReportLook, extra: PackExtra = 'none', changeNo?: string): SheetSpec[] {
  const d = dataForPivot(wb);
  const sheets: SheetSpec[] = [linkedReport(p, today, look), pivot(wb, d.n), { name: 'data for pivot', rows: d.rows, widths: [18, 12, 14, 12, 12, 11, 50, 30, 30, 13, 13, 13, 13, 14, 11] }];
  if (extra !== 'none') {
    const o: ForecastOptions = { ...defaultOptions(p), ...(extra === 'twelve' ? { kind: 'twelve' as const } : { kind: 'revision' as const, change: extra, changeNo }) };
    sheets.push(...forecastSheets(p, today, o));
  }
  return sheets;
}
