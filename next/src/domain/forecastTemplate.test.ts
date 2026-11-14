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

describe('forecast outputs of the guidelines', () => {
  it('hides the proposal for the team and gives the donor values only with the forecast hidden', async () => {
    const { forecastSheets: fs, forecastFileName } = await import('./forecastTemplate');
    const o = { kind: 'payment' as const, programme: 'JP' as const, change: 'notification' as const, changeNo: '3' };
    const T = fs(p, new Date('2026-07-15'), o, undefined, 'team');
    expect(T[0].hiddenCols).toEqual([18, 19, 20, 21]);
    const D = fs(p, new Date('2026-07-15'), o, undefined, 'donor');
    expect(D.map((s) => s.name)).toEqual(['Budget presentation', 'variation', 'FORECAST']);
    expect(D[2].hidden).toBe(true);
    expect(D[0].rows.flat().some((c) => c && typeof c === 'object' && (c as XCell).f?.includes('Forecast!'))).toBe(false);
    expect(forecastFileName(p, 'Turkiye', new Date('2026-07-15'), o, 'donor')).toBe('BH5235-JP3220-Turkiye-Revised Budget proposal-For notification n°3-JUL-2026.xlsx');
    const x = await readXlsx(workbook(D).buffer as ArrayBuffer);
    expect(x.sheets.length).toBe(3);
  });
});

describe('interim financial report sheet', () => {
  it('follows the REPORT layout: title, period header, lines, footnotes, certification and signatures, with the logo drawing', async () => {
    const { ifrSheet } = await import('./forecastTemplate');
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
    const S = ifrSheet(p, new Date('2026-07-15'), undefined, { logo: { png, w: 4, h: 1 }, sign1: 'A NAME\nDirector', sign2: 'B NAME\nTreasurer' });
    const text = S.rows.map((r) => r.map((c) => (c && typeof c === 'object' ? (c as XCell).v : c) ?? '').join('|')).join('\n');
    expect(text).toContain('Test project');
    expect(text).toMatch(/Interim financial report covering period from 01\/01\/2025 to/);
    expect(text).toContain('Sub-total 1');
    expect(text).toContain('11. Total eligible costs');
    expect(text).toContain('(3) A levy of 7%');
    expect(text).toContain('A NAME'); expect(text).toContain('Treasurer');
    expect(S.rows.every((r) => r.length === 9)).toBe(true);
    const files = new TextDecoder('latin1').decode(workbook([S]));
    expect(files).toContain('xl/drawings/drawing1.xml'); expect(files).toContain('xl/media/image1.png');
  });
});

describe('final financial report', () => {
  it('JP: spent only, sources of funding and payments; with the contractual budget after a notification', async () => {
    const { ifrSheet } = await import('./forecastTemplate');
    const q = { ...(p as object), approvedBudget: { ...(p as any).approvedBudget, lines: [{ code: '5.7', description: 'Conf', approved: 90000, approvedUnits: 3, unitRate: 30000 }] }, payments: [{ date: '2025-02-01', amount: 100000 }], contract: { total: 400000, euMax: 360000 } } as never;
    const S = ifrSheet(q, new Date('2026-07-15'), { kind: 'twelve', programme: 'JP', change: 'notification', changeNo: '2' }, { kind: 'final', withOriginal: true });
    const text = S.rows.map((r) => r.map((c) => (c && typeof c === 'object' ? (c as XCell).v : c) ?? '').join('|')).join('\n');
    expect(text).toMatch(/Final financial report covering the period from 01\/01\/2025 to 31\/12\/2027/);
    expect(text).toContain('Notification n°2'); expect(text).toContain('Contractual');
    expect(text).toContain('Source of Funding'); expect(text).toContain('Total payments received'); expect(text).toContain('Balance to be paid');
    expect(text).not.toContain('Spent and');
    expect(S.rows.every((r) => r.length === 11)).toBe(true);
    expect(S.rows.some((r) => r.some((c) => c && typeof c === 'object' && 'f' in c && (c as XCell).f))).toBe(false);
  });
  it('VC: direct, administrative and total costs, source of funding with the balance', async () => {
    const { ifrSheet } = await import('./forecastTemplate');
    const S = ifrSheet(p, new Date('2026-07-15'), { kind: 'revision', programme: 'VC' }, { kind: 'final' });
    const text = S.rows.map((r) => r.map((c) => (c && typeof c === 'object' ? (c as XCell).v : c) ?? '').join('|')).join('\n');
    expect(text).toContain('8. Administrative costs'); expect(text).toContain('9. Total eligible costs (7 + 8)');
    expect(text).not.toMatch(/11\. Total eligible/); expect(text).toContain('Action Plan-level funding');
  });
});
