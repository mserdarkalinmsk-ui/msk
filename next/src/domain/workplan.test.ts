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

describe('activity number column', () => {
  it('counts postings by the report activity number, ignoring the text', () => {
    const plan: WPx = { id: 'q', no: 2, from: '2026-07-01', to: '2026-09-30', planned: 5000, acts: [{ ref: '', id: '146732', name: 'Launch', amount: 5000, lines: [] }] };
    const e = (date: string, line: string, amount: number, activity?: string, po = '') => ({ date, period: '', src: 'gl' as const, doc: '', po, line, account: '', description: 'text 146732', detail: '', supplier: '', amount, posted: true, ...(activity ? { activity } : {}) });
    const wb = {
      entries: [e('2026-11-02', '1.1.1.3', 400, '146732'), e('2026-11-02', '5.7', 900, '144976'), e('2026-08-02', '5.7', 100)],
      pos: [{ po: '1', line: '5.7', description: '', supplier: '', amount: 1000, spent: 0, sc: 1000, date: '2026-11-01', activity: '146732' }],
      lines: [], totals: {}, meta: {},
    } as unknown as WBx;
    const u = wpUse(plan, wb);
    expect(u.spent).toBe(500);   // 400 by number (staff line, after the dates) + 100 in-date activity line; 900 has another number
    expect(u.sc).toBe(1500);
  });
});

import { activityLedger } from './workplan';
describe('activity ledger', () => {
  const act = (id: string, amount: number, status?: string) => ({ ref: '1.1', id, name: `Activity ${id}`, amount, lines: [], ...(status ? { status } : {}) });
  const plans: WPx[] = [
    { id: 'a', no: 1, from: '2026-04-01', to: '2026-06-30', planned: 3000, acts: [act('100001', 1000), act('100002', 2000)] },
    { id: 'b', no: 2, from: '2026-07-01', to: '2026-09-30', planned: 1500, acts: [act('100002', 1500)] },
  ];
  const e = (activity: string, amount: number) => ({ date: '2026-08-01', period: '', src: 'gl' as const, doc: '', po: '', line: '5.7', account: '', description: '', detail: '', supplier: '', amount, posted: true, activity });
  const wb = { entries: [e('100002', 1800), e('100009', 400)], pos: [], lines: [], totals: {}, meta: {} } as unknown as WBx;
  it('follows each activity across the plans and the report', () => {
    const L = activityLedger(plans, wb, new Date('2026-11-16'));
    const r = (id: string) => L.rows.find((x) => x.id === id)!;
    expect(L.numbered).toBe(true);
    expect(r('100002')).toMatchObject({ wps: ['WP 1', 'WP 2'], planned: 3500, latestPlanned: 1500, spent: 1800 });
    expect(r('100002').flags).toEqual(['carried', 'over-plan']);
    expect(r('100001').flags).toEqual(['not-started']);
    expect(r('100009').flags).toEqual(['no-plan']);
  });
  it('says when the report carries no activity numbers', () => {
    const L = activityLedger(plans, { ...wb, entries: [] } as unknown as WBx, new Date('2026-11-16'));
    expect(L.numbered).toBe(false); expect(L.rows.every((x) => x.spent == null)).toBe(true);
  });
});
