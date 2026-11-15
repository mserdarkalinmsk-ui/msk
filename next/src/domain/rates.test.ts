import { describe, expect, it } from 'vitest';
import { averageRate, lineRate, revisedRate } from './rates';
import type { BudgetLine, Project } from './types';

const L = (actual: number, reportedUnits: number, more: Partial<BudgetLine> = {}) => ({ code: '1.3.1', description: 'International', unit: 'Per diem', approved: 1560, unitRate: 195, actual, reportedUnits, ...more }) as BudgetLine;

describe('unit rates for revised budgets', () => {
  it('is the report average: spent ÷ units used (29.25 per diems for EUR 5,921.19)', () => {
    expect(averageRate(L(5921.19, 29.25))).toBe(202.43);
  });
  it('does not average units only estimated from a raw extraction', () => {
    expect(averageRate(L(5921.19, 43, { unitsEstimated: true }))).toBeUndefined();
  });
  it('takes the latest full report when the current units are estimated', () => {
    const p = { reportingPeriods: [{ date: '2026-09-30', snapshot: { lines: [L(4020.19, 20.75)] } }, { date: '2026-11-09', snapshot: { lines: [L(5921.19, 43, { unitsEstimated: true })], workbook: { meta: { extraction: true } } } }] } as unknown as Project;
    expect(lineRate(p, L(5921.19, 43, { unitsEstimated: true }))).toEqual({ rate: 193.74, date: '2026-09-30' });
  });
  it('keeps the approved rate when no units are known', () => {
    expect(revisedRate({} as Project, L(500, 1), 195)).toEqual({ rate: 195, basis: 'approved' });
    expect(revisedRate({} as Project, L(5921.19, 29.25), 195)).toEqual({ rate: 202.43, basis: 'average', date: undefined });
  });
});
