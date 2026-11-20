import { describe, expect, it } from 'vitest';
import { capacity, endOf, gapDrivers, portfolioWalk, trendOf } from './analysis';

const L = (code: string, approved: number, actual: number) => ({ code, description: `Line ${code}`, approved, actual, spentCommitted: actual });
const rep = (id: string, date: string, a: number[]) => ({ id, name: id, type: 'Interim', date, snapshot: { lines: [L('1.1.1.1', 60000, a[0]), L('2.1', 20000, a[1]), L('5.7', 120000, a[2]), L('10', 14000, a[3])] } });
// Two years, 200 000 direct; half the time gone at 1 Jan 2026.
const p = { id: 'p', code: 'P', name: 'P', country: 'tr', start: '2025-01-01', end: '2027-01-01', budget: 214000,
  reportingPeriods: [rep('a', '2025-07-01', [10000, 2000, 5000, 1200]), rep('b', '2025-10-01', [25000, 5000, 15000, 3000]), rep('c', '2026-01-01', [30000, 6000, 20000, 4000])] } as never;
const today = new Date('2026-01-01');

describe('analysis', () => {
  it('splits the gap to plan by heading: the largest shortfall first, shares adding up to one', () => {
    const G = gapDrivers(p, today);
    expect(G.el).toBeCloseTo(0.5, 1);
    expect(G.drivers[0].heading).toBe('5'); // 120 000 × 0.5 = 60 000 planned, 20 000 spent
    expect(G.drivers[0].gap).toBeCloseTo(20000 - 120000 * G.el, 0);
    expect(G.drivers.reduce((a, d) => a + d.share, 0)).toBeCloseTo(1, 5);
    expect(G.drivers.find((d) => d.heading === '1')!.spent).toBe(30000);
  });
  it('sets the pace needed against the best pace reached between reports', () => {
    const c = capacity(p, today);
    expect(c.remaining).toBe(214000 - 60000);
    expect(c.monthsLeft).toBeCloseTo(12, 0);
    // best: Jul → Oct 2025, (48 000 − 18 200) over about 3 months
    expect(c.bestFrom).toBe('2025-07-01'); expect(c.bestTo).toBe('2025-10-01');
    expect(c.need).toBeGreaterThan(c.best);
    expect(c.verdict).toBe('stretch'); // about 1.3 × the best pace
    expect(c.unspent).toBeGreaterThan(0);
  });
  it('follows spending against plan and the staff share report by report', () => {
    const t = trendOf(p);
    expect(t.points).toHaveLength(3);
    expect(t.points[2].staff).toBeCloseTo(30000 / 56000, 3);
    expect(t.dPerf).toBeLessThan(0);
    expect(t.worsening).toBe(true);
  });
  it('the end at the current pace never passes the budget', () => {
    const e = endOf(p, today);
    expect(e.atEnd).toBeLessThanOrEqual(e.budget);
    expect(e.unspent).toBeCloseTo(e.budget - e.atEnd, 5);
  });
  it('walks the portfolio from planned to spent and leaves out projects that have just started', () => {
    const fresh = { id: 'f', code: 'F', name: 'F', country: 'tr', start: '2025-12-20', end: '2027-12-20', budget: 100000, approvedBudget: { lines: [L('5.7', 100000, 0)] }, reportingPeriods: [] } as never;
    expect(capacity(fresh, today).verdict).toBe('too early');
    const W = portfolioWalk([p, fresh], today), G = gapDrivers(p, today);
    expect(W.planned).toBeCloseTo(G.planned, 2);
    expect(W.gap).toBeCloseTo(G.gap, 2);
    expect(W.lead?.heading).toBe('5');
    expect(W.steps.reduce((a, x) => a + x.gap, 0)).toBeCloseTo(W.gap, 2);
  });
  it('spent at the end is never below spent + committed, as the end-of-project forecast says', () => {
    // 100 spent, 800 committed in open contracts: at least 900 is used by the end, whatever the pace.
    const q = { id: 'q', code: 'Q', name: 'Q', country: 'tr', start: '2025-01-01', end: '2027-01-01', budget: 1000,
      reportingPeriods: [{ id: 'r', name: 'R', type: 'Interim', date: '2026-01-01', snapshot: { lines: [{ code: '1.1', approved: 1000, actual: 100, committed: 800, spentCommitted: 900 }] } }] } as never;
    const E = endOf(q, today), o = outcome(q, today);
    expect(E.atEnd).toBeGreaterThanOrEqual(900);
    expect(E.unspent).toBeCloseTo(o.unused, 6);
    expect(capacity(q, today).unspent).toBeCloseTo(o.unused, 6); // the Excel column of the same table
  });
});
import { outcome } from './insights';
