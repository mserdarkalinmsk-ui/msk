import { describe, expect, it } from 'vitest';
import { mergeTable } from './workplan';

describe('a Work Plan typed by hand before the follow-up table', () => {
  it('takes the number of its period', () => {
    const own = [{ id: 'a', no: 1, from: '2026-10-01', to: '2026-12-31', planned: 224582 }];
    const S = (no: number, from: string, to: string, planned: number, prev?: { no: number; from: string; to: string; planned: number }) => ({ sheet: 'x', title: '', no, from, to, planned, ...(prev ? { prev } : {}) });
    const out = mergeTable(own as never, [S(2, '2026-04-01', '2026-06-30', 1, { no: 1, from: '2026-01-01', to: '2026-03-31', planned: 2 }), S(3, '2026-07-01', '2026-09-30', 3), S(4, '2026-10-01', '2026-12-31', 224582)] as never);
    expect(out.map((w) => [w.no, w.from])).toEqual([[1, '2026-01-01'], [2, '2026-04-01'], [3, '2026-07-01'], [4, '2026-10-01']]);
    expect(out.find((w) => w.no === 4)!.id).toBe('a');
  });
});

import { budgetLineOf } from './workplan';
describe('a Work Plan line below the budget line', () => {
  it('counts on the budget line above it', () => {
    const has = (c: string) => ['5.7', '1.1.3'].includes(c);
    expect(budgetLineOf('5.7.3', has)).toBe('5.7');
    expect(budgetLineOf('1.1.3', has)).toBe('1.1.3');
    expect(budgetLineOf('5.9', has)).toBe('5.9');
  });
});

import { overlaps, previousPlan, wpUse, carriesActivity, type WorkPlan as WPx } from './workplan';
import type { WorkbookSummary as WBx } from './workbook';

describe('previous Work Plan by dates', () => {
  const wp = (id: string, no: number, from: string, to: string, extra: Partial<WPx> = {}): WPx => ({ id, no, from, to, planned: 0, ...extra });
  it('an empty plan added for the current quarter is not the previous of a plan that starts before it', () => {
    const w1 = wp('a', 1, '2026-10-01', '2026-12-31'), w2 = wp('b', 2, '2026-09-01', '2027-02-28');
    expect(previousPlan([w1, w2], w2)).toBeUndefined();
    expect(overlaps([w1, w2]).length).toBe(1);
  });
  it('picks the plan that ended last before this one starts', () => {
    const q2 = wp('a', 1, '2026-04-01', '2026-06-30'), q3 = wp('b', 2, '2026-07-01', '2026-09-30'), q4 = wp('c', 3, '2026-10-01', '2026-12-31');
    expect(previousPlan([q4, q2, q3], q4)?.id).toBe('b');
    expect(overlaps([q2, q3, q4])).toEqual([]);
  });
});

describe('spending of a Work Plan', () => {
  const plan: WPx = { id: 'p', no: 1, from: '2026-07-01', to: '2026-09-30', planned: 10000,
    acts: [{ ref: '1.1.1', id: '127413', name: 'Study', amount: 10000, lines: [] }] };
  const e = (date: string, line: string, amount: number, description = '', po = '') => ({ date, period: '', src: 'invoice' as const, doc: '', po, line, account: '', description, detail: '', supplier: '', amount, posted: true });
  const wb = {
    entries: [
      e('2026-08-10', '5.2', 1000),                                  // activity line, in the dates
      e('2026-08-10', '1.1.1.2', 500),                               // salary line, in the dates: not activity
      e('2026-10-20', '5.2', 700, 'Baseline study 127413 – 2nd tranche'), // after the dates, but tagged with the activity ID
      e('2026-10-20', '1.1.3', 300, '', '900001'),                   // invoice on a PO tagged with the activity ID
      e('2026-10-21', '5.2', 9999, 'Other study 1274130'),           // a longer number is not the ID
    ],
    pos: [{ po: '900001', line: '1.1.3', description: 'Consultant – activity 127413', supplier: '', amount: 2000, spent: 300, sc: 2000, date: '2026-10-05' }],
    lines: [], totals: {}, meta: {},
  } as unknown as WBx;
  it('counts in-date activity lines and every posting carrying the activity ID', () => {
    const u = wpUse(plan, wb);
    expect(u.spent).toBe(2000);
    expect(u.sc).toBe(3700);
    expect(u.tagged).toBe(2);
  });
  it('reads the ID only as a whole number', () => {
    expect(carriesActivity('activity 127413', plan)).toBe(true);
    expect(carriesActivity('ref 1274130', plan)).toBe(false);
  });
});
