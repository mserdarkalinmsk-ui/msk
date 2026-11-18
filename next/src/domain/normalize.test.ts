import { describe, expect, it } from 'vitest';
import { normalizeProject } from './normalize';
import { lineRows, money } from './calc';
import type { Project } from './types';

describe('normalizeProject on older or partial data', () => {
  it('reads a report whose snapshot has no lines list as a report without lines', () => {
    const p = { id: 'a', code: 'A', name: 'n', country: 'tr', budget: 100, start: '2025-01-01', end: '2027-01-01', reportingPeriods: [
      { id: 'r1', name: 'One', type: 'interim', date: '2026-01-31', snapshot: {} },
      { id: 'r2', name: 'Two', type: 'interim', date: '2026-02-28', snapshot: { lines: null } },
      { id: 'r3', name: 'Three', type: 'interim', date: '2026-03-31' },
    ] } as unknown as Project;
    const n = normalizeProject(p);
    expect(n.reportingPeriods!.map((r) => r.snapshot?.lines)).toEqual([[], [], undefined]);
    expect(() => { money(n); lineRows([n]); }).not.toThrow();
  });
});
