import { describe, expect, it } from 'vitest';
import { mergeReports } from './merge_reports';
import { parseWorkbook } from './workbook';
import type { Project } from './types';

const S = (R: (string | number | null)[][]) => [{ name: 'Report', R: R.map((r) => r.map((c) => (c == null ? '' : String(c)))) }];
const report = (sc22: number) => parseWorkbook(S([
  ['Interim financial report covering period from 01/01/2026 to 10/09/2026'],
  [null, null, 'Budget for all years', null, null, 'Actual expenditure as at 10/09/2026', null, null, 'Spent and committed'],
  ['Description', 'Unit', '# of units', 'Unit rate', 'Cost', '# of units', 'Unit rate', 'Cost', 'EUR'],
  ['2.1 International travel', 'Per flight', 4, 700, 2800, 6, 670.47, 4022.83, 4052.3],
  ['2.2 Local transportation', 'Per trip', 41, 150, 6150, 6, 183.01, 1098.09, sc22],
  ['5.7 Conferences', 'Per event', 33, 4290.77, 141595.35, 6, 5006.36, 30038.14, 30110.76],
]));
const budget = parseWorkbook(S([
  ['VC budget proposal'], [null, null, 'Budget for all Years', null, null, 'Secured budget'],
  ['Description', 'Unit', '# of units', 'Unit rate', 'Cost', '# of units', 'Unit rate', 'Cost'],
  ['2.1 International travel', 'Per flight', 4, 700, 2800, 2, 700, 1400], ['2.2 Local transportation', 'Per trip', 41, 150, 6150, 20, 150, 3000], ['5.7 Conferences', 'Per event', 10, 4000, 40000, 5, 4000, 20000],
]));
const p0 = { id: 'x', code: 'BH9413', name: 'P', country: 'tr', start: '2025-07-01', end: '2027-06-30', budget: 0, reportingPeriods: [] } as unknown as Project;

describe('one way into a project', () => {
  it('the same file loaded twice replaces its first reading, whatever was loaded in between', () => {
    const a = mergeReports(p0, [{ wb: report(3221.07), fileName: 'Report BH9413 September.xlsx' }]);
    const p1 = { ...p0, ...a.patch } as Project;
    const b = mergeReports(p1, [{ wb: report(1321.07), fileName: 'Report BH9413 September.xlsx' }]);
    const p2 = { ...p1, ...b.patch } as Project;
    expect(p2.reportingPeriods).toHaveLength(1);
    expect(b.receipt).toMatchObject({ added: 0, replaced: 1 });
    expect(p2.reportingPeriods![0].snapshot!.lines.find((l) => l.code === '2.2')?.spentCommitted).toBeCloseTo(1321.07, 2);
  });
  it('a budget file becomes the approved budget, not a report', () => {
    const { patch, receipt } = mergeReports(p0, [{ wb: budget, fileName: 'VC budget.xlsx' }]);
    expect(patch.reportingPeriods).toHaveLength(0);
    expect(patch.approvedBudget?.total).toBeCloseTo(48950, 2);
    expect(receipt.budget).toBeCloseTo(48950, 2);
  });
});
