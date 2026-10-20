import { describe, expect, it } from 'vitest';
import { costFactor, salaryPath } from './salaryProjection';

describe('local salary projection', () => {
  it('follows the raise policy on the known CPI', () => {
    const { events } = salaryPath('2026-09', { on: true });
    const e = (m: string) => events.find((x) => x.month === m);
    expect(e('2023-08')).toMatchObject({ kind: 'spike' }); // July 2023: 9.49% in one month
    expect(e('2023-08')!.pct).toBeCloseTo(9.49, 2);
    expect(events.filter((x) => x.kind === 'catch-up').length).toBeGreaterThan(0);
    expect(events.every((x) => !x.projected)).toBe(true);
  });
  it('projects raises after the known months and turns them into a euro cost factor', () => {
    const s = { on: true, cpi: 2, fx: 0 };
    const { events } = salaryPath('2027-12', s);
    expect(events.some((x) => x.projected)).toBe(true);
    const f = costFactor('2026-09-30', '2026-10-01', '2027-09-30', s);
    expect(f).toBeGreaterThan(1.03); expect(f).toBeLessThan(1.3);
    // A falling lira cancels the raises in euros.
    expect(costFactor('2026-09-30', '2026-10-01', '2027-09-30', { ...s, fx: 2 })).toBeLessThan(f);
  });
});
