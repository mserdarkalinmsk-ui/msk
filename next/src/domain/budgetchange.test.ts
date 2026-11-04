import { describe, expect, it } from 'vitest';
import { adviseChanges } from './budgetchange';

const L = (code: string, approved: number) => ({ code, description: code, approved });
const p = { id: 'a', code: 'A', name: 'A', country: 'tr', start: '2025-01-01', end: '2027-01-01', budget: 1,
  approvedBudget: { lines: [L('1.1.3', 100000), L('2.1', 40000), L('5.7.1', 200000), L('5.7.2', 60000), L('8', 10000), L('10', 28000)], source: 'x', direct: 400000, admin: 28000, contingency: 10000, total: 438000, linesSum: 0 } } as never;
describe('budget change advice (EU–CoE)', () => {
  it('within a heading is free, between headings within 25 % is a notification', () => {
    expect(adviseChanges(p, [{ from: '5.7.1', to: '5.7.2', amount: 50000 }]).verdict).toBe('free');
    const a = adviseChanges(p, [{ from: '5.7.1', to: '2.1', amount: 9000 }]);
    expect(a.verdict).toBe('notify'); expect(Math.round(a.heads.find((h) => h.code === '2')!.room.up)).toBe(1000);
  });
  it('above 25 %, new headings and admin need an addendum; contingency needs approval', () => {
    expect(adviseChanges(p, [{ from: '5.7.1', to: '2.1', amount: 12000 }]).verdict).toBe('addendum');
    expect(adviseChanges(p, [{ from: '5.7.1', to: '3.1', amount: 1000 }]).verdict).toBe('addendum');
    expect(adviseChanges(p, [{ from: '5.7.1', to: '10', amount: 1000 }]).verdict).toBe('addendum');
    expect(adviseChanges(p, [{ from: '8', to: '5.7.1', amount: 5000 }]).verdict).toBe('approval');
  });
});
