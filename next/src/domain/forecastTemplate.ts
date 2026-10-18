import { HEADINGS, latestReport, lineExposure, lines, n, parseDate } from './calc';
import type { BudgetLine, Project } from './types';
import type { Cell, SheetSpec, XCell } from '../ui/xlsxwrite';

/**
 * Forecast workbook in the layout of the CoE financial report: budget, actual expenditure and spent + committed
 * filled in from the latest report, planned expenditure and the budget proposal left in yellow cells to fill in.
 * Loaded back through Import, it is read like any financial report with a forecast.
 */
const dmy = (d: string) => { const [y, m, dd] = d.slice(0, 10).split('-'); return `${dd}/${m}/${y}`; };
const addMonths = (d: string, k: number) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCMonth(x.getUTCMonth() + k); x.setUTCDate(x.getUTCDate() - 1); return x.toISOString().slice(0, 10); };
const col = (i: number): string => (i >= 26 ? col(Math.floor(i / 26) - 1) : '') + String.fromCharCode(65 + (i % 26));
// Columns: A description, B unit, C–E budget, F–H actual, I spent + committed, J–L planned, M–O proposal, P balance after the plan, Q comments.
const C = { units: 2, rate: 3, cost: 4, aUnits: 5, aRate: 6, actual: 7, sc: 8, pUnits: 9, pRate: 10, planned: 11, qUnits: 12, qRate: 13, proposal: 14, balance: 15, note: 16 };
const SUMMED = [C.cost, C.actual, C.sc, C.planned, C.proposal, C.balance];

export function forecastPeriod(p: Project, today: Date): { from: string; to: string; asAt: string } {
  const r = latestReport(p), asAt = (r?.snapshot?.workbook?.meta.asAt || r?.date || today.toISOString()).slice(0, 10);
  const from = new Date(parseDate(asAt).getTime() + 864e5).toISOString().slice(0, 10);
  const months = Number((p.contract as { repMonths?: number } | undefined)?.repMonths) || 6;
  const to = addMonths(from, months);
  return { from, to: to > p.end ? p.end : to, asAt };
}

export function forecastSheets(p: Project, today: Date): SheetSpec[] {
  const per = forecastPeriod(p, today), L = lines(p);
  const names = p.approvedBudget?.names ?? {};
  const isSpecial = (c: string) => c === '10' || /^8(\.|$)/.test(c);
  const leafs = L.filter((l) => !isSpecial(l.code) && !L.some((o) => o !== l && o.code.startsWith(l.code + '.')));
  const codes = [...new Set(leafs.flatMap((l) => l.code.split('.').map((_, i, a) => a.slice(0, i + 1).join('.'))))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const leafBy = new Map(leafs.map((l) => [l.code, l]));
  const desc = (c: string) => leafBy.get(c)?.description || names[c] || (c.includes('.') ? '' : HEADINGS[c] ?? '');
  const c = (p.contract ?? {}) as { number?: string };
  const top = 9; // rows above the data (1-based row of the first line = top + 1)
  const rows: (Cell | XCell)[][] = [
    [{ v: 'Financial report — forecast', st: 'title' }],
    [`JP ${p.jp ?? p.pmm ?? ''} - BH ${p.bh ?? ''}`.trim()],
    [c.number ? `Contract n° ${c.number}` : ''],
    [`Interim report covering the period from ${dmy(p.start)} to ${dmy(per.asAt)}`],
    [{ v: p.name, st: 'bold' }],
    [{ v: `Fill in the yellow cells: planned expenditure from ${dmy(per.from)} to ${dmy(per.to)}, the budget proposal and comments. Totals recalculate. Save and load the file back through Import.`, st: 'wrap' }],
    [],
    ['', '', { v: 'Budget for all years', st: 'head' }, { v: '', st: 'head' }, { v: '', st: 'head' }, { v: `Actual expenditure as at ${dmy(per.asAt)}`, st: 'head' }, { v: '', st: 'head' }, { v: '', st: 'head' }, { v: 'Spent and committed', st: 'head' },
      { v: `Planned expenditure from ${dmy(per.from)} to ${dmy(per.to)}`, st: 'head' }, { v: '', st: 'head' }, { v: '', st: 'head' }, { v: 'Budget proposal calculated', st: 'head' }, { v: '', st: 'head' }, { v: '', st: 'head' }, { v: 'Balance after the plan', st: 'head' }, { v: 'Comments', st: 'head' }],
    ['Description', 'Unit', '# of units', 'Unit rate (in EUR)', 'Cost (in EUR)', '# of units', 'Unit rate (in EUR)', 'Cost (in EUR)', 'Cost (in EUR)', '# of units', 'Unit rate (in EUR)', 'Cost (in EUR)', '# of units', 'Unit rate (in EUR)', 'Cost (in EUR)', 'Cost (in EUR)', ''].map((v) => ({ v, st: 'head' as const })),
  ];
  // Row numbers and values, to write formulas with the values Excel would show.
  const at = new Map<string, number>(), val = new Map<string, number[]>();
  const children = (code: string) => codes.filter((x) => x.startsWith(code + '.') && x.split('.').length === code.split('.').length + 1);
  codes.forEach((code, i) => at.set(code, top + 1 + i));
  const valueOf = (code: string): number[] => {
    if (val.has(code)) return val.get(code)!;
    const l = leafBy.get(code);
    let v: number[];
    if (l) { const b = n(l.approved), sc = lineExposure(l); v = [b, n(l.actual), sc, 0, b, b - sc]; }
    else v = children(code).map(valueOf).reduce((a, x) => a.map((y, k) => y + x[k]), [0, 0, 0, 0, 0, 0]);
    val.set(code, v); return v;
  };
  for (const code of codes) {
    const r = at.get(code)!, l = leafBy.get(code), v = valueOf(code), kids = children(code);
    const row: (Cell | XCell)[] = Array(17).fill('');
    if (l) {
      row[0] = `${code} ${desc(code)}`; row[1] = l.unit ?? '';
      row[C.units] = l.approvedUnits ?? ''; row[C.rate] = l.unitRate != null ? { v: l.unitRate, st: 'rate' } : ''; row[C.cost] = { v: v[0], st: 'money' };
      row[C.aUnits] = l.reportedUnits ?? ''; row[C.aRate] = l.reportedUnitRate != null ? { v: l.reportedUnitRate, st: 'rate' } : ''; row[C.actual] = { v: v[1], st: 'money' };
      row[C.sc] = { v: v[2], st: 'money' };
      row[C.pUnits] = { st: 'in' }; row[C.pRate] = { v: l.unitRate ?? undefined, st: 'inRate' }; row[C.planned] = { st: 'in' };
      row[C.qUnits] = { v: l.approvedUnits ?? undefined, st: 'in' }; row[C.qRate] = { v: l.unitRate ?? undefined, st: 'inRate' }; row[C.proposal] = { v: v[4], st: 'in' };
      row[C.balance] = { f: `${col(C.cost)}${r}-${col(C.sc)}${r}-${col(C.planned)}${r}`, v: v[5], st: 'money' };
      row[C.note] = { st: 'inText' };
    } else {
      row[0] = { v: `${code} ${desc(code)}`, st: 'bold' };
      SUMMED.forEach((ci, k) => { row[ci] = { f: kids.length ? kids.map((x) => `${col(ci)}${at.get(x)}`).join('+') : '0', v: v[k], st: 'moneyBold' }; });
    }
    rows.push(row);
  }
  // Totals in the wording the report reader recognises.
  const tops = codes.filter((x) => !x.includes('.'));
  const D = tops.map(valueOf).reduce((a, x) => a.map((y, k) => y + x[k]), [0, 0, 0, 0, 0, 0]);
  const rD = top + 1 + codes.length, adminLine = L.find((l) => l.code === '10'), cont = L.filter((l) => /^8(\.|$)/.test(l.code));
  const total = (label: string, f: (ci: number, k: number) => XCell) => { const row: (Cell | XCell)[] = Array(17).fill(''); row[0] = { v: label, st: 'bold' }; SUMMED.forEach((ci, k) => { row[ci] = f(ci, k); }); return row; };
  rows.push(total('7. Sub-total direct eligible costs of the Action (1+2+3+4+5+6)', (ci, k) => ({ f: tops.map((x) => `${col(ci)}${at.get(x)}`).join('+') || '0', v: D[k], st: 'total' })));
  let rC = 0;
  if (cont.length) {
    const cv = [cont.reduce((a, l) => a + n(l.approved), 0), cont.reduce((a, l) => a + n(l.actual), 0), cont.reduce((a, l) => a + lineExposure(l), 0)];
    rC = rD + 1;
    rows.push(total('8. Provision for contingency reserve', (ci, k) => (ci === C.planned || ci === C.proposal ? { v: k === 4 ? cv[0] : undefined, st: 'in' } : ci === C.balance ? { f: `${col(C.cost)}${rC}-${col(C.sc)}${rC}-${col(C.planned)}${rC}`, v: cv[0] - cv[2], st: 'total' } : { v: cv[k] ?? 0, st: 'total' })));
  }
  const rA = rD + 1 + (cont.length ? 1 : 0), av = adminLine ? [n(adminLine.approved), n(adminLine.actual), lineExposure(adminLine)] : [0, 0, 0];
  rows.push(total(`${cont.length ? 10 : 8}. Administrative costs (maximum 7% of the direct eligible costs)`, (ci, k) =>
    ci === C.planned ? { f: `ROUND(${col(C.planned)}${rD}*0.07,0)`, v: 0, st: 'total' } : ci === C.proposal ? { f: `ROUND(${col(C.proposal)}${rD}*0.07,0)`, v: Math.round(D[4] * 0.07), st: 'total' }
      : ci === C.balance ? { f: `${col(C.cost)}${rA}-${col(C.sc)}${rA}-${col(C.planned)}${rA}`, v: av[0] - av[2], st: 'total' } : { v: av[k] ?? 0, st: 'total' }));
  rows.push(total(`${cont.length ? 11 : 9}. Total eligible costs of the Action`, (ci) => ({ f: [rD, rC, rA].filter(Boolean).map((r) => `${col(ci)}${r}`).join('+'), st: 'total', v: undefined })));
  // Cached values for the grand total (shown before Excel recalculates).
  const last = rows[rows.length - 1];
  SUMMED.forEach((ci) => { const cells = [rD, rC, rA].filter(Boolean).map((r) => rows[r - 1][ci] as XCell); (last[ci] as XCell).v = cells.reduce((a, x) => a + (typeof x?.v === 'number' ? x.v : 0), 0); });
  return [{ name: 'Forecast', rows, freeze: top, widths: [46, 12, 9, 11, 13, 9, 11, 13, 13, 9, 11, 13, 9, 11, 13, 13, 40], protect: true }];
}
export type { BudgetLine };
