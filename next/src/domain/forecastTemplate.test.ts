import { describe, expect, it } from 'vitest';
import { forecastSheets } from './forecastTemplate';
import { workbook, type XCell } from '../ui/xlsxwrite';
import { readXlsx } from '../ui/xlsx';
import { parseWorkbook, toBudgetLines } from './workbook';
import { reportDate } from './autoimport';

const L = (code: string, approved: number, actual: number, extra = {}) => ({ code, description: `Line ${code}`, unit: 'Per day', approved, actual, spentCommitted: actual + 100, approvedUnits: 10, unitRate: approved / 10, ...extra });
const p = { id: 'a', code: 'JP1', name: 'Test project', country: 'tr', start: '2025-01-01', end: '2027-12-31', budget: 1, bh: '5235', jp: '3220',
  approvedBudget: { lines: [], names: { '1': 'Human resources', '1.1': 'Local', '5': 'Other costs, services' }, source: 'x', direct: 0, admin: 0, contingency: 0, total: 0, linesSum: 0 },
  reportingPeriods: [{ id: 'r', name: 'R', type: 'Interim', date: '2026-06-30', snapshot: { lines: [L('1.1.1', 50000, 20000), L('1.1.3', 30000, 5000), L('5.7', 100000, 40000), { code: '10', description: 'Admin', approved: 12600, actual: 4550, spentCommitted: 4550 }] } }] } as never;

describe('forecast workbook', () => {
  it('is read back as a financial report with the planned expenditure typed in the yellow cells', async () => {
    const [S] = forecastSheets(p, new Date('2026-07-15'));
    // A user fills planned expenditure on 1.1.3 and 5.7.
    const txt = (c: unknown) => String(c && typeof c === 'object' ? (c as XCell).v ?? '' : c ?? '');
    const rowOf = (code: string) => S.rows.findIndex((r) => txt(r[0]).startsWith(code + ' '));
    (S.rows[rowOf('1.1.3')][11] as XCell).v = 8000; (S.rows[rowOf('5.7')][11] as XCell).v = 25000;
    const x = await readXlsx(workbook([S]).buffer as ArrayBuffer);
    const wb = parseWorkbook(x.sheets.map((n) => ({ name: n, R: x.read(n) })));
    expect(wb.meta.bh).toBe('5235');
    expect(wb.meta.plannedFrom).toBe('2026-07-01'); expect(wb.meta.plannedTo).toBe('2027-06-30');
    expect(reportDate(wb as never)).toBe('2026-06-30');
    const B = toBudgetLines(wb as never);
    expect(B.find((l) => l.code === '5.7')!.forecast).toBe(25000);
    expect(B.find((l) => l.code === '1.1.3')!.forecast).toBe(8000);
    expect(B.find((l) => l.code === '1.1.1')!.approved).toBe(50000);
    expect(wb.totals.direct?.budget).toBe(180000);
    expect(wb.totals.admin?.budget).toBe(12600);
  });
});

describe('forecast template details', () => {
  it('adds the guideline margin to staff rates and the donor sheets', async () => {
    const { staffRate } = await import('./forecastTemplate');
    expect(staffRate('1.1.1.2', 5436.44, 6)).toBe(5440 + 40); // local, short
    expect(staffRate('1.2.1.2', 9601, 30)).toBe(9605 + 225); // HQ, long
    const S = forecastSheets(p, new Date('2026-07-15'));
    expect(S.map((s) => s.name)).toEqual(['Forecast', 'Budget presentation', 'variation']);
    const txt = (c: unknown) => String(c && typeof c === 'object' ? (c as XCell).v ?? '' : c ?? '');
    expect(txt(S[0].rows[2][21])).toContain('Variation');
    expect(txt(S[0].rows[1][9])).toContain('NEXT INSTALMENT');
  });
});

describe('every forecast template', () => {
  const txt = (c: unknown) => String(c && typeof c === 'object' ? (c as XCell).v ?? '' : c ?? '');
  for (const [kind, programme, sheets, width] of [['payment', 'JP', 3, 22], ['twelve', 'JP', 1, 12], ['revision', 'JP', 3, 19], ['revision', 'VC', 3, 18], ['extension', 'JP', 3, 25]] as const) {
    it(`${kind} (${programme}) is read back`, async () => {
      const { forecastSheets: fs } = await import('./forecastTemplate');
      const S = fs(p, new Date('2026-07-15'), { kind, programme, extendTo: '2028-06-30', change: 'addendum', changeNo: '2' });
      expect(S.length).toBe(sheets);
      expect(S[0].rows[3].length).toBe(width);
      const r = S[0].rows.findIndex((x) => txt(x[0]).startsWith('5.7 '));
      (S[0].rows[r][11] as XCell).v = 25000; // first planned block, cost column L
      const x = await readXlsx(workbook(S).buffer as ArrayBuffer);
      const wb = parseWorkbook(x.sheets.map((n) => ({ name: n, R: x.read(n) })));
      expect(toBudgetLines(wb as never).find((l) => l.code === '5.7')!.forecast).toBe(25000);
      expect(wb.meta.plannedFrom).toBe('2026-07-01');
      expect(wb.meta.plannedTo).toBe(kind === 'revision' ? '2028-06-30' : kind === 'extension' ? '2027-12-31' : '2027-06-30');
      if (programme === 'JP' && kind !== 'twelve') expect(S[0].rows[2].map(txt).join(' ')).toContain('Addendum n°2');
      if (programme === 'VC') expect(S[0].rows[2].map(txt).join(' ')).toContain('Revised (');
    });
  }
});
