import { describe, expect, it } from 'vitest';
import { accuracyRows, cashSeries, committedSeries, headingBars, mixSeries, neededSeries } from './portfolioCharts';
import type { Project } from './types';

const L = (code: string, approved: number, actual: number, sc: number, forecast = 0) => ({ code, description: code, approved, actual, spentCommitted: sc, forecast });
const p = { id: 'a', code: 'BH1', name: 'P', country: 'tr', start: '2025-01-01', end: '2027-12-31', budget: 1_000_000,
  payments: [{ date: '2025-01-15', amount: 400_000 }],
  reportingPeriods: [
    { id: 'r1', name: 'R1', type: 'Interim', date: '2025-12-31', snapshot: { lines: [L('1.1.1.1', 300_000, 50_000, 50_000, 60_000), L('4.2', 50_000, 10_000, 10_000), L('5.7', 650_000, 40_000, 90_000, 100_000)] } },
    { id: 'r2', name: 'R2', type: 'Interim', date: '2026-06-30', snapshot: { lines: [L('1.1.1.1', 300_000, 110_000, 110_000), L('4.2', 50_000, 20_000, 20_000), L('5.7', 650_000, 130_000, 200_000)] } },
  ] } as unknown as Project;
const today = new Date('2026-10-15');

describe('portfolio charts', () => {
  it('needed per month spreads what is left over the months left', () => {
    const R = neededSeries([p], today), at = R.find((x) => x.t >= Date.UTC(2026, 5, 29) && x.t <= Date.UTC(2026, 6, 1))!;
    // 260 000 spent by end June 2026, 18 months left → about 41 000 per month
    expect(at.needed).toBeGreaterThan(38_000); expect(at.needed).toBeLessThan(44_000);
    expect(R.some((x) => !x.past && x.spend != null)).toBe(true);
  });
  it('headings carry spent, committed and the budget', () => {
    const H = headingBars([p], today), h5 = H.find((h) => h.code === '5')!;
    expect(h5.budget).toBe(650_000); expect(h5.spent).toBe(130_000); expect(h5.committed).toBe(70_000);
  });
  it('spent and committed step at each report', () => {
    const x = committedSeries([p], today).at(-1)!;
    expect(x.spent).toBe(260_000); expect(x.committed).toBe(70_000);
  });
  it('splits staff, charging back and activities', () => {
    const x = mixSeries([p], today).at(-1)!;
    expect(x.staff).toBe(110_000); expect(x.cb).toBe(20_000); expect(x.act).toBe(130_000); expect(x.ratio).toBeCloseTo(110 / 260);
  });
  it('cash: 70% of the money received is reached → request due', () => {
    const C = cashSeries([p], today);
    expect(C.projects).toBe(1); expect(C.rows.at(-1)!.received).toBe(400_000);
    expect(C.dueAt).not.toBeNull();
  });
  it('forecast accuracy compares the plan of a report with the next one', () => {
    const A = accuracyRows([p]);
    expect(A).toHaveLength(1); expect(A[0].planned).toBe(160_000); expect(A[0].spent).toBe(160_000);
  });
});
