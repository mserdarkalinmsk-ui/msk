import { describe, expect, it } from 'vitest';
import { staffLines } from './staffreport';
import type { Project } from './types';

const T = new Date('2026-11-20T00:00:00Z');
const rec = (name: string, code: string, fte: number | null) => ({ name, code, position: 'Project assistant', fte, start: '2026-01-01', end: '2029-12-31', po: name, recordKind: 'Contract', actual: 0 });
const p = {
  id: 'x', code: 'tsk', name: 'tsk', start: '2026-01-01', end: '2029-09-30',
  reportingPeriods: [{ id: 'r', name: 'r', date: '2026-10-31', snapshot: {
    lines: [
      { code: '1.2.1.7', description: 'Project assistant (15%)', approved: 38500, approvedUnits: 7, reportedUnits: 3, unitRate: 5500 },
      { code: '1.2.1.3', description: 'Senior project officer (100%)', approved: 364500, approvedUnits: 45, reportedUnits: 4, unitRate: 8100 },
      { code: '1.1.1.7', description: 'Project assistant', approved: 126540, approvedUnits: 45, reportedUnits: 9, unitRate: 2812 },
    ],
    staffRecords: [rec('Alpha, One', '1.2.1.7', 1), rec('Beta, Two', '1.2.1.3', 1), rec('Gamma, Three', '1.2.1.3', 1), rec('Delta, Four', '1.1.1.7', 1)],
  } }],
} as unknown as Project;

describe('staff lines: months needed to the end', () => {
  const L = staffLines(p, T), by = (c: string) => L.find((x) => x.code === c)!;
  it('a part-time line needs only its own share of the months left, not a full month each', () => {
    const l = by('1.2.1.7');
    expect(l.fteOnLine).toBeCloseTo(0.15);
    expect(l.need).toBeCloseTo(0.15 * l.monthsToEnd);
    expect(l.gap).toBeGreaterThan(-2);
  });
  it('two people sharing one full-time line need one post, not two', () => {
    expect(by('1.2.1.3').fteOnLine).toBe(1);
  });
  it('a line without a stated share counts the people on it', () => {
    expect(by('1.1.1.7').fteOnLine).toBe(1);
  });
});
