import { describe, expect, it } from 'vitest';
import { contractGaps, monthsFrom, paymentPlan, planTotals, renewals } from './contractPlan';

const T = new Date(Date.UTC(2026, 10, 24));
describe('what the contracts ask of the months ahead', () => {
  it('lists the months ahead', () => {
    expect(monthsFrom(T, 3)).toEqual(['2026-11', '2026-12', '2027-01']);
  });
  it('pays each month the fee in force; after the signed end only when it is renewed, and marked so', () => {
    const M = monthsFrom(T, 4);
    const R = paymentPlan([
      { key: 'a', name: 'Alpha', c: { cur: 'EUR', fee: 1000, start: '2026-01-01', end: '2026-12-31', autoRenew: true } },
      { key: 'b', name: 'Beta', c: { cur: 'TRY', fee: 90000, start: '2026-01-01', end: '2027-12-31', fees: [{ from: '2026-01-01', fee: 90000 }, { from: '2027-01-01', fee: 99000 }] }, rate: 45 },
      { key: 'c', name: 'Gamma', c: { cur: 'TRY', fee: 4500, start: '2026-01-01', end: '2026-11-30' } },
      { key: 'd', name: 'Delta', c: { cur: 'EUR', total: 5000, start: '2026-01-01', end: '2026-12-31' } },
    ], M);
    expect(R.map((r) => r.key)).toEqual(['a', 'b', 'c']);
    expect(R[0].cells.map((x) => [x.v, x.renewal])).toEqual([[1000, false], [1000, false], [1000, true], [1000, true]]);
    expect(R[1].cells.map((x) => x.v)).toEqual([90000, 90000, 99000, 99000]);
    expect(R[2].cells.map((x) => x.v)).toEqual([4500, 0, 0, 0]);
    const S = planTotals(R);
    expect(S.signed).toEqual([3000, 3000, 2200, 2200]);
    expect(S.withRenewals).toEqual([3000, 3000, 3200, 3200]);
    expect(S.unknown).toBe(1);
  });
  it('lists the renewals to decide, by the notice deadline when there is one, with a year more at the fee in force', () => {
    const R = renewals([
      { key: 'a', name: 'Alpha', c: { cur: 'EUR', fee: 1000, start: '2026-01-01', end: '2027-03-31', noticeDays: 90 } },
      { key: 'b', name: 'Beta', c: { cur: 'EUR', total: 6000, start: '2026-01-01', end: '2026-06-30' } },
      { key: 'c', name: 'Gamma', c: { cur: 'EUR', fee: 500, start: '2026-01-01', end: '2028-12-31' } },
      { key: 'd', name: 'Delta', c: { cur: 'EUR', total: 12000, start: '2026-01-01', end: '2026-12-20' } },
    ], T);
    expect(R.map((r) => r.key)).toEqual(['d', 'a']);
    expect(R[1]).toMatchObject({ noticeBy: '2026-12-31', days: 37, year: 12000 });
    expect(R[0]).toMatchObject({ days: 26, year: 12000 });
  });
  it('says what each contract still lacks', () => {
    const G = contractGaps([
      { key: 'a', name: 'Alpha', c: { end: '2027-01-01', doc: { name: 'a.pdf', type: 'application/pdf', size: 1, at: '' }, history: [{ kind: 'original', at: '', changes: [] }, { kind: 'amendment', no: 2, at: '', changes: [] }] } },
      { key: 'b', name: 'Beta', c: { line: '1.1', cur: 'TRY', fee: 100 } },
      { key: 'c', name: 'Gamma', c: { openEnded: true, doc: { name: 'c.pdf', type: 'application/pdf', size: 1, at: '' } } },
    ]);
    expect(G).toEqual([
      { key: 'a', name: 'Alpha', missing: ['the copy of the amendment 2'] },
      { key: 'b', name: 'Beta', missing: ['the signed contract', 'an end date', 'an order naming the months it pays (for the rate)'] },
    ]);
  });
});
