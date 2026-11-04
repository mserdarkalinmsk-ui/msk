import { describe, expect, it } from 'vitest';
import { crossDocs } from './crossdocs';
import type { Project } from './types';

const base = (over: Partial<Project> = {}): Project => ({
  id: 'x', code: 'X', name: 'X', country: 'TR', start: '2025-01-01', end: '2026-12-31', budget: 1070, bh: '5260', contractNo: '700012345',
  contract: { total: 1070, start: '2025-01-01', end: '2026-12-31', number: '700012345', bh: '5260' },
  approvedBudget: { lines: [{ code: '1.1', approved: 600 }, { code: '5.7', approved: 400 }, { code: '10', approved: 70 }], direct: 1000, admin: 70, contingency: 0, total: 1070, source: 'DoA.docx', linesSum: 1000 },
  reportingPeriods: [{ id: 'r', name: 'Interim 1', type: 'Interim Financial Report', date: '2025-12-31', snapshot: { lines: [{ code: '1.1', approved: 600, actual: 100 }, { code: '5.7', approved: 400, actual: 50 }, { code: '10', approved: 70, actual: 10.5 }] } }],
  ...over,
});

describe('documents agree', () => {
  it('a project whose documents give the same figures', () => {
    const X = crossDocs(base());
    expect(X.bad).toBe(0);
    expect(X.sources).toEqual(['contract', 'approved', 'card', 'report']);
    expect(X.rows.find((r) => r.key === 'total')?.values).toEqual({ contract: 1070, approved: 1070, card: 1070, report: 1070 });
  });
  it('a heading moved in the report without a recorded change differs; with one it is explained', () => {
    const moved = base({ reportingPeriods: [{ id: 'r', name: 'Interim 1', type: 'Interim Financial Report', date: '2025-12-31', snapshot: { lines: [{ code: '1.1', approved: 550, actual: 0 }, { code: '5.7', approved: 450, actual: 0 }, { code: '10', approved: 70, actual: 0 }] } }] });
    const X = crossDocs(moved);
    expect(X.rows.filter((r) => !r.ok).map((r) => r.key)).toEqual(['h1', 'h5']);
    expect(X.rows.find((r) => r.key === 'h5')?.note).toMatch(/no budget change recorded/);
    const ok = crossDocs({ ...moved, budgetChanges: [{ id: 'c', date: '2025-06-01', from: '1.1', to: '5.7', amount: 50, status: 'notified' }] });
    expect(ok.bad).toBe(0);
    expect(ok.rows.find((r) => r.key === 'h5')?.note).toMatch(/explained by the recorded budget changes/);
  });
  it('a different contract total, end date or budget head is flagged', () => {
    const X = crossDocs(base({ budget: 1100, end: '2027-03-31', bh: '5261' }));
    expect(X.rows.filter((r) => !r.ok).map((r) => r.key)).toEqual(['total', 'end', 'bh']);
  });
});
