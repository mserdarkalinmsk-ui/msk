import { describe, expect, it } from 'vitest';
import { portfolioStatement } from './statement';
import type { Project } from './types';

const proj = (id: string, lines: { code: string; approved: number; actual?: number }[]): Project => ({ id, code: id, name: id, country: 'tr', start: '2024-01-01', end: '2027-01-01', budget: lines.reduce((s, l) => s + l.approved, 0),
  reportingPeriods: [{ id: 'r', name: 'r', type: 'Interim', date: '2026-06-30', snapshot: { lines: lines.map((l) => ({ ...l, description: `Line ${l.code}` })) } }] } as Project);

describe('portfolio statement', () => {
  it('keeps a line that is a leaf in one project but broken down in another, so totals match the budget lines', () => {
    const A = proj('A', [{ code: '5.7', approved: 598074, actual: 17891 }, { code: '10', approved: 1000 }]);
    const B = proj('B', [{ code: '5.7.1', approved: 529000 }, { code: '5.7.2', approved: 206884 }, { code: '10', approved: 2000 }]);
    const S = portfolioStatement([A, B]);
    expect(S.totals.eligible!.budget).toBe(598074 + 529000 + 206884 + 3000);
    expect(S.totals.direct.actual).toBe(17891);
  });
});
