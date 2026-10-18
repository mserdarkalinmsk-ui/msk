import { describe, expect, it } from 'vitest';
import { budgetCheck, rateMedians } from './budgetcheck';

const ab = (lines: object[], extra = {}) => ({ lines, source: 'budget.xlsx', direct: 100000, admin: 7000, contingency: 0, total: 107000, linesSum: 0, ...extra });
describe('budget data check', () => {
  it('finds arithmetic, duplicate and admin mistakes in the approved budget', () => {
    const p = { id: 'a', code: 'A', name: 'A', country: 'tr', start: '2025-01-01', end: '2027-01-01', budget: 107000,
      approvedBudget: ab([{ code: '5.5.1', description: 'Translation', unit: 'Per 250 words', approvedUnits: 1500, unitRate: 15, approved: 25500 }, { code: '5.5.2', description: 'Interpretation', approved: 100 }, { code: '5.5.2', description: 'Interpretation', approved: 100 }], { admin: 8000 }) } as never;
    const C = budgetCheck(p);
    expect(C.findings.some((f) => f.code === '5.5.1' && f.expected === 22500)).toBe(true);
    expect(C.findings.some((f) => /appears 2 times/.test(f.text))).toBe(true);
    expect(C.findings.some((f) => /max 7%/.test(f.text))).toBe(true);
  });
  it('flags report lines that are unknown, renamed or overspent, and rates far from the portfolio', () => {
    const line = { code: '5.7.1', description: 'Capacity building activities', unit: 'Per event', approvedUnits: 10, unitRate: 1000, approved: 10000 };
    const p = { id: 'b', code: 'B', name: 'B', country: 'tr', start: '2025-01-01', end: '2027-01-01', budget: 1,
      approvedBudget: ab([{ ...line, unitRate: 9000, approved: 90000 }]),
      reportingPeriods: [{ id: 'r', name: 'R1', type: 'x', date: '2026-01-31', snapshot: { lines: [{ code: '5.7.1', description: 'Office rent and utilities', approved: 90000, actual: 120000 }, { code: '9.9', description: 'Other', approved: 0, actual: 50 }] } }] } as never;
    const others = ['c', 'd', 'e'].map((id) => ({ id, approvedBudget: ab([line]) })) as never[];
    const C = budgetCheck(p, rateMedians([...others, p]));
    expect(C.findings.some((f) => /not in the approved budget/.test(f.text))).toBe(true);
    expect(C.findings.some((f) => /wrong line used/.test(f.text))).toBe(true);
    expect(C.findings.some((f) => /above the line budget/.test(f.text))).toBe(true);
    expect(C.findings.some((f) => /portfolio median/.test(f.text))).toBe(true);
  });
});
