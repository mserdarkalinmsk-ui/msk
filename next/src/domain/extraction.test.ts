import { describe, expect, it } from 'vitest';
import { parseWorkbook } from './workbook';
import { reportFrom } from './autoimport';
import type { Project } from './types';
import { summarize } from './workbook';
import { lines } from './calc';
import { toBudgetLines } from './workbook';

const H = ['SOURCE', 'Budget', 'Budget Head', 'REPORTING_LINE', 'NBRE_OF_UNITS', 'DOC_NUMBER', 'DESCRIPTION', 'PO_AMOUNT_EUR', 'SPENT_EUR', 'COMMITTED_EUR', 'SPENT_COM_EUR', 'CLOSURE_STATUS'];
const sheets = [
  { name: 'Situation Budgetaire', R: [['Situation Budgétaire'], ['Date : 21/09/2026   14.26.24'], ['DATE=21/09/2026 BH=5260']] },
  { name: 'Consolidation', R: [['CONSO'], H,
    ['1-PURCHASE ORDERS', '0189', '5260', '1.1.1', '5', '1', 'Salary', '1000', '200', '800', '1000', 'OPEN'],
    ['3-ECRITURE GL', '0189', '5260', '1.1.1', '0', '2', 'Charge', '0', '50', '0', '50', ''],
    ['3-ECRITURE GL', '0189', '5260', '5.7', '0', '3', 'Event', '0', '300', '0', '300', ''],
    ['3-ECRITURE GL', '0189', '5260', '0', '0', '4', 'Levy', '0', '70', '0', '70', ''],
    ['Total']] },
];

describe('system extraction', () => {
  it('sums entries per reporting line and lays them on the approved budget', () => {
    const wb = parseWorkbook(sheets);
    expect(wb.meta).toMatchObject({ bh: '5260', extraction: true, situationDate: '2026-09-21' });
    const p = { id: 'p', code: 'P', name: 'P', country: 'tr', start: '2026-01-01', end: '2028-01-01', budget: 5000, bh: '5260',
      approvedBudget: { lines: [{ code: '1.1.1', description: 'Manager', approved: 3000 }, { code: '2.1', description: 'Travel', approved: 1000 }, { code: '10', description: 'Administrative costs', approved: 280 }] } } as unknown as Project;
    const L = reportFrom(wb, 'x.xlsx', p).report.snapshot!.lines;
    expect(L.map((l) => [l.code, l.description, l.approved, l.actual, l.spentCommitted])).toEqual([
      ['1.1.1', 'Manager', 3000, 250, 1050], ['2.1', 'Travel', 1000, 0, 0], ['5.7', 'Line 5.7 (not in the approved budget)', 0, 300, 300], ['10', 'Administrative costs', 280, 38.5, 94.5]]);
  });

  it('reads an extraction saved by any import screen against the budget, and keeps every euro', () => {
    const wb = parseWorkbook(sheets);
    const p = { id: 'p', code: 'P', name: 'P', country: 'tr', start: '2026-01-01', end: '2028-01-01', budget: 5000,
      approvedBudget: { lines: [{ code: '1.1.1', description: 'Manager', approved: 3000 }, { code: '10', description: 'Administrative costs', approved: 280 }] },
      // Saved through "Import report" as an ordinary workbook, before this rule existed.
      reportingPeriods: [{ id: 'r', name: 'Interim', type: 'Interim', date: '2026-09-21', snapshot: { format: 'CoE workbook', lines: toBudgetLines(wb), workbook: summarize(wb, 'x.xlsx') } }] } as unknown as Project;
    const L = lines(p);
    expect(L.find((l) => l.code === '1.1.1')).toMatchObject({ description: 'Manager', approved: 3000, actual: 250 });
    const entries = 200 + 50 + 300; // every entry with a reporting line (the unallocated 70 is reported apart)
    expect(L.filter((l) => l.code !== '10').reduce((a, l) => a + (l.actual ?? 0), 0)).toBe(entries);
  });
});

import { pickPoLine, relineEntries } from './workbook';
describe('invoices of a PO split over several budget lines', () => {
  const L = [{ line: '2.2', nature: '2.2-Framework agreement', amount: 27.92 }, { line: '5.7', nature: '5.7-Framework agreement', amount: 14334.63 }];
  it('go to the line the invoice names', () => expect(pickPoLine(L, '5.7-Framework agreement', 14334.63)?.line).toBe('5.7'));
  it('else to the single line of the same amount', () => expect(pickPoLine(L, 'Invoice 12', 27.92)?.line).toBe('2.2'));
  it('stay unresolved when nothing tells them apart', () => expect(pickPoLine(L, 'Invoice 12', 50)).toBeUndefined());
  it('are moved in stored workbooks', () => {
    const e = { date: '2026-07-22', period: 'JUL-26', src: 'invoice' as const, doc: '1', po: '9', line: '2.2', account: '6185', description: '', detail: '5.7-Framework agreement', supplier: '', amount: 100, posted: true };
    const pos = L.map((x) => ({ po: '9', line: x.line, description: '', nature: x.nature, supplier: '', amount: x.amount, spent: 0, balance: 0, sc: 0, status: '', date: '', units: null, unitType: '' }));
    expect(relineEntries({ pos, entries: [e] }).entries![0].line).toBe('5.7');
  });
});

import { fixLevy } from './workbook';
describe('levy on a donor tranche posted on line 10', () => {
  it('is not the administrative costs: those stay 7% of the direct costs', () => {
    const wb = { meta: { extraction: true }, totals: { direct: { budget: 0, actual: 1000, sc: 1500 }, admin: { budget: 0, actual: 200, sc: 200 }, eligible: { budget: 0, actual: 1200, sc: 1700 } },
      entries: [{ date: '2025-12-19', period: 'DEC-25', src: 'gl' as const, doc: '1', po: '', line: '10', account: '6810', description: 'PRELEV 7% CONTRIB', detail: '', supplier: '', amount: 200, posted: true }] };
    const f = fixLevy(wb as never) as typeof wb & { meta: { levyTaken?: number } };
    expect(f.totals.admin).toMatchObject({ actual: 70, sc: 105 });
    expect(f.totals.eligible).toMatchObject({ actual: 1070, sc: 1605 });
    expect(f.meta.levyTaken).toBe(200);
  });
});
