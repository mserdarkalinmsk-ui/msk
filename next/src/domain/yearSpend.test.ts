import { describe, expect, it } from 'vitest';
import { spentInYear } from './yearSpend';
import type { Project } from './types';

const rep = (id: string, date: string, actual: number, entries?: { date: string; amount: number }[]) => ({ id, name: id, type: 'interim', date, snapshot: { lines: [{ code: '1', actual }], ...(entries ? { workbook: { meta: {}, lines: [], totals: {}, situation: [], pos: [], monthly: [], movements: [], sheets: [], checks: [], entries } } : {}) } });
const P = (r: unknown[]) => ({ id: 'a', code: 'A', name: 'A', country: 'x', start: '2025-01-01', end: '2027-12-31', budget: 1000, reportingPeriods: r }) as unknown as Project;

describe('spending in a calendar year', () => {
  it('sums the dated postings of the year when the report has them', () => {
    expect(spentInYear(P([rep('r', '2026-06-30', 300, [{ date: '2025-11-02', amount: 100 }, { date: '2026-02-01', amount: 150 }, { date: '2026-05-01', amount: 50 }])]), 2026)).toEqual({ v: 200, basis: 'postings' });
  });
  it('else takes the difference between the reports around the year, and says which', () => {
    const s = spentInYear(P([rep('a', '2025-12-31', 100), rep('b', '2026-06-30', 250), rep('c', '2027-03-31', 400)]), 2026);
    expect(s).toMatchObject({ v: 150, basis: 'reports', from: '2025-12-31', to: '2026-06-30' });
    expect(spentInYear(P([]), 2026).basis).toBe('none');
  });
});
