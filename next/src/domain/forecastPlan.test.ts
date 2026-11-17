import { describe, expect, it } from 'vitest';
import { autofillStaff, balanceOn, computePlan, effective, monthsIn, type ForecastDraft } from './forecastPlan';
import { forecastSheets } from './forecastTemplate';
import type { XCell } from '../ui/xlsxwrite';

const L = (code: string, approved: number, actual: number, extra = {}) => ({ code, description: `Line ${code}`, unit: 'Per month', approved, actual, spentCommitted: actual, ...extra });
const staffRecords = [
  { name: 'Doe, Jane', code: '1.1.1.2', position: 'Project manager', fte: 1, start: '2025-01-01', end: '2027-12-31', recordKind: 'Contract' as const, base: 'Local' as const },
  { name: 'Roe, Ann', code: '1.2.1.2', position: 'Project manager', fte: 0.5, start: '2025-01-01', end: '2026-12-31', recordKind: 'Contract' as const, base: 'HQ' as const },
];
const lines = [
  L('1.1.1.2', 120000, 50000, { approvedUnits: 36, unitRate: 3333.33, reportedUnits: 18, reportedUnitRate: 2777.78 }),
  L('1.2.1.2', 90000, 40000, { approvedUnits: 18, unitRate: 5000, reportedUnits: 9, reportedUnitRate: 4444.44 }),
  L('4.2', 12000, 5000, { approvedUnits: 36, unitRate: 333.33, reportedUnits: 18 }),
  L('4.4', 6000, 2500, { approvedUnits: 36, unitRate: 166.67, reportedUnits: 18 }),
  L('5.7', 200000, 60000, { approvedUnits: 10, unitRate: 20000, reportedUnits: 3 }),
  { code: '10', description: 'Admin', approved: 30660, actual: 10000, spentCommitted: 10000 },
];
const p = { id: 'a', code: 'JP1', name: 'Test', country: 'tr', start: '2025-01-01', end: '2027-12-31', budget: 468660, jp: '1', bh: '2',
  approvedBudget: { lines: lines.map((l) => ({ ...l, actual: 0, spentCommitted: 0 })), names: {}, source: 'x', direct: 428000, admin: 30660, contingency: 0, total: 458660, linesSum: 458660 },
  reportingPeriods: [{ id: 'r', name: 'R', type: 'Interim', date: '2026-06-30', snapshot: { lines, staffRecords } }] } as never;
const today = new Date('2026-07-15');

describe('forecast in the app', () => {
  it('counts months of a contract within a period', () => {
    expect(monthsIn('2026-07-01', '2027-06-30', '2025-01-01', '2027-12-31')).toBeCloseTo(11.99, 1);
    expect(monthsIn('2026-07-01', '2027-06-30', '2025-01-01', '2026-12-31')).toBeCloseTo(6.04, 1);
  });
  it('fills staff from the contracts and charging back from local staff months', () => {
    const d0: ForecastDraft = { opt: { kind: 'revision', programme: 'JP' }, lines: {} };
    const d = autofillStaff(p, today, d0);
    // Jane: 1 FTE from 1 Jul 2026 to 31 Dec 2027 = 18 months; Ann: 0.5 FTE, contract to 2026 carried on to the end = 9 months.
    expect(d.lines['1.1.1.2'].p!.u).toBeCloseTo(18, 0);
    expect(d.lines['1.2.1.2'].p!.u).toBeCloseTo(9, 0);
    expect(d.lines['1.1.1.2'].p!.r).toBe(2780 + 125); // latest monthly cost rounded up + local margin (more than 12 months left)
    expect(d.lines['4.2'].p!.u).toBeCloseTo(18, 0); // local staff months
    expect(d.lines['4.4'].p!.u).toBe(d.lines['4.2'].p!.u);
    expect(d.notes!.some((x) => x.includes('Jane Doe'))).toBe(true);
  });
  it('does not plan again the months a staff purchase order already commits', () => {
    // Ann's contract to 31 Dec 2026 is committed in the report (spent + committed above spent): Jul–Dec are in spent +
    // committed, so only Jan–Dec 2027 at 50% = 6 months are planned, not 9.
    const L2 = lines.map((l) => (l.code === '1.2.1.2' ? { ...l, spentCommitted: 55000 } : l));
    const q = { ...(p as any), reportingPeriods: [{ ...(p as any).reportingPeriods[0], snapshot: { lines: L2, staffRecords } }] } as never;
    const d = autofillStaff(q, today, { opt: { kind: 'revision', programme: 'JP' }, lines: {} });
    expect(d.lines['1.2.1.2'].p!.u).toBeCloseTo(6, 0);
    expect(d.notes!.join(' ')).toMatch(/already committed/);
  });
  it('balances on 5.7 and decides between notification and addendum', () => {
    let d: ForecastDraft = autofillStaff(p, today, { opt: { kind: 'revision', programme: 'JP' }, lines: {} });
    d = balanceOn(p, today, d);
    const R = computePlan(p, today, d);
    expect(Math.abs(R.direct.rounded - R.direct.budget)).toBeLessThan(25000); // within one 5.7 unit after rounding
    expect(['notification', 'addendum']).toContain(R.decision);
    // A big shift into 5 Other costs breaks the 25% limit of heading 5? Here 5.7 absorbs the difference: check a deliberate breach.
    const big = { ...d, lines: { ...d.lines, '5.7': { p: { u: 20, r: 20000 } } } };
    const B = computePlan(p, today, big);
    expect(B.decision).toBe('addendum');
    expect(B.reasons.join(' ')).toMatch(/5 .*%/);
  });
  it('the Excel carries the values typed in the app and gives the same proposal', () => {
    const d: ForecastDraft = { opt: { kind: 'revision', programme: 'JP' }, lines: { '5.7': { p: { u: 5, r: 20000 } } } };
    const [S] = forecastSheets(p, today, d.opt, d.lines);
    const txt = (c: unknown) => String(c && typeof c === 'object' ? (c as XCell).v ?? '' : c ?? '');
    const row = S.rows.find((r) => txt(r[0]).startsWith('5.7 '))!;
    expect((row[9] as XCell).v).toBe(5); expect((row[10] as XCell).v).toBe(20000); expect((row[11] as XCell).v).toBe(100000);
    const R = computePlan(p, today, d), l = R.lines.find((x) => x.code === '5.7')!;
    expect((row[17] as XCell).v).toBe(l.rounded); // rounded version, column R
  });
});

describe('fixed total', () => {
  it('puts the remainder on 5.7 automatically, whatever is typed elsewhere', () => {
    const d: ForecastDraft = autofillStaff(p, today, { opt: { kind: 'revision', programme: 'JP' }, lines: {} });
    for (const extra of [0, 1, 3]) {
      const x = { ...d, lines: { ...d.lines, '4.2': { p: { u: 10 + extra * 5, r: 300 } } } };
      const R = computePlan(p, today, effective(p, today, x));
      expect(Math.abs(R.direct.rounded - R.direct.budget)).toBeLessThan(20000); // within one 5.7 unit of rounding
    }
    const off = computePlan(p, today, effective(p, today, { ...d, auto: { on: false } }));
    expect(Math.abs(off.direct.rounded - off.direct.budget)).toBeGreaterThan(20000);
  });
});

describe('balance line keeps the total', () => {
  it('rounded proposal equals the direct budget to the cent, in the plan and in the Excel', () => {
    let d: ForecastDraft = autofillStaff(p, today, { opt: { kind: 'revision', programme: 'JP' }, lines: { '4.2': { r: { u: 17, r: 351 } }, '1.1.1.2': { r: { u: 17, r: 3371 } } } });
    d = effective(p, today, d);
    const R = computePlan(p, today, d);
    expect(Math.abs(R.direct.rounded - R.direct.budget)).toBeLessThan(0.01);
    const [S] = forecastSheets(p, today, { ...d.opt, balance: '5.7' }, d.lines);
    const row = S.rows.find((r) => String((r[0] as XCell)?.v ?? '').startsWith('7. Sub-total'))!;
    const v = (i: number) => (row[i] as XCell).v as number, last = row.length - 1, rc = (row[last] as XCell)?.f ? last - 1 : last;
    expect(Math.abs(v(rc) - v(4))).toBeLessThan(0.01);
    expect(Math.abs(v(rc - 3) - v(4))).toBeLessThan(0.01); // calculated proposal too
    expect(Math.abs(R.lines.reduce((x, l) => x + l.propCost, 0) - R.direct.budget)).toBeLessThan(0.01);
  });
});

import { snapUnits as snap2 } from './forecastPlan';
describe('planned units in the step of their unit', () => {
  it('a saved 32.88 months reads 33, 65.76 reads 65.75, 164.4 reads 164.5 (quarters of a month)', () => {
    const p: any = { id: 'x', lines: [{ code: '1.1.1.2', description: 'Officer', unit: 'Per month', approved: 1 }, { code: '4.2', description: 'Rent', unit: 'Per month', approved: 1 }, { code: '2.1', description: 'Flights', unit: 'Per return flight', approved: 1 }], entries: [] };
    const d: any = { opt: {}, lines: { '1.1.1.2': { p: { u: 32.88 }, e: { u: 65.76 } }, '4.2': { p: { u: 164.4 } }, '2.1': { p: { u: 3.3 } } } };
    const s = snap2(p, d);
    expect([s.lines['1.1.1.2'].p!.u, s.lines['1.1.1.2'].e!.u, s.lines['4.2'].p!.u, s.lines['2.1'].p!.u]).toEqual([33, 65.75, 164.5, 3.5]);
  });
});

import { liveFinance, suggestKind } from './forecastPlan';
describe('finance lines are calculated, not saved', () => {
  it('a saved unit on a staff line without a hand mark is recalculated; a typed one is kept', () => {
    const p: any = { id: 'x', start: '2025-01-01', end: '2027-12-31', lines: [{ code: '1.1.1.2', description: 'Officer', unit: 'Per month', approved: 1000 }], entries: [], staff: [] };
    const d: any = { opt: { kind: 'revision', programme: 'VC' }, lines: { '1.1.1.2': { p: { u: 32.88, r: 10 } } } };
    expect(liveFinance(p, new Date('2026-11-17'), d).lines['1.1.1.2']?.p?.u).not.toBe(32.88);
    d.lines['1.1.1.2'].p = { u: 12, mu: true };
    expect(liveFinance(p, new Date('2026-11-17'), d).lines['1.1.1.2']?.p?.u).toBe(12);
  });
  it('suggests an extension when the end is near and much of the budget is free', () => {
    const p: any = { id: 'x', start: '2024-01-01', end: '2027-06-30', approvedBudget: { lines: [{ code: '2.1', description: 'Flights', unit: 'Per flight', approved: 1000, actual: 200 }] }, entries: [] };
    expect(suggestKind(p, new Date('2026-11-17')).kind).toBe('extension');
    expect(suggestKind({ ...p, end: '2029-06-30' }, new Date('2026-11-17')).kind).not.toBe('extension');
  });
});
