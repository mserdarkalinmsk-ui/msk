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
    expect(wb.meta).toMatchObject({ bh: '5260', extraction: true, situationDate: '2026-09-21', unallocated: 70 });
    const p = { id: 'p', code: 'P', name: 'P', country: 'tr', start: '2026-01-01', end: '2028-01-01', budget: 5000, bh: '5260',
      approvedBudget: { lines: [{ code: '1.1.1', description: 'Manager', approved: 3000 }, { code: '2.1', description: 'Travel', approved: 1000 }, { code: '10', description: 'Administrative costs', approved: 280 }] } } as unknown as Project;
    const L = reportFrom(wb, 'x.xlsx', p).report.snapshot!.lines;
    expect(L.map((l) => [l.code, l.description, l.approved, l.actual, l.spentCommitted])).toEqual([
      ['1.1.1', 'Manager', 3000, 250, 1050], ['2.1', 'Travel', 1000, 0, 0], ['5.7', 'Line 5.7 (not in the approved budget)', 0, 300, 300], ['10', 'Administrative costs', 280, 0, 0]]);
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
