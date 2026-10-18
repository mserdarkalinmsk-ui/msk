import { describe, expect, it } from 'vitest';
import { earlyWarnings } from './earlywarn';

const L = (code: string, approved: number, actual = 0) => ({ code, description: code, approved, actual });
const proj = (rep: object[]) => ({ id: 'a', code: 'A', name: 'A', country: 'tr', start: '2025-01-01', end: '2027-01-01', budget: 1,
  approvedBudget: { lines: [L('2.1', 100000), L('5.7', 400000), L('1.1.3', 200000)], source: 'x', direct: 700000, admin: 49000, contingency: 0, total: 749000, linesSum: 0 },
  reportingPeriods: [{ id: 'r', name: 'R', type: 'x', date: '2026-01-01', snapshot: { lines: rep } }] }) as never;
const today = new Date('2026-01-01'); // half the period gone
describe('early warning', () => {
  it('sees a notification coming when the pace needs a small transfer, an addendum when it is large', () => {
    const W = earlyWarnings(proj([L('2.1', 100000, 60000), L('5.7', 400000, 100000), L('1.1.3', 200000, 100000)]), today);
    const t = W.find((w) => w.code === '2')!;
    expect(t.stage).toBe('notify'); expect(Math.round(t.need / 1000)).toBe(20); expect(t.from?.code).toBe('5');
    const W2 = earlyWarnings(proj([L('2.1', 100000, 80000), L('5.7', 400000, 100000), L('1.1.3', 200000, 100000)]), today);
    expect(W2.find((w) => w.code === '2')!.stage).toBe('addendum');
  });
  it('asks to notify now when a heading is already overspent', () => {
    const W = earlyWarnings(proj([{ ...L('2.1', 100000, 105000) }, L('5.7', 400000, 100000), L('1.1.3', 200000, 100000)]), new Date('2026-12-20'));
    expect(W.find((w) => w.code === '2')!.stage).toBe('notify-now');
  });
});
