import { describe, expect, it } from 'vitest';
import { ceilingsAtRisk, stillToOrder } from './contractItems';

const T = new Date(Date.UTC(2026, 10, 25));
describe('contracts watched across the portfolio', () => {
  it('flags a ceiling reached before the contract ends within six months at the recent pace', () => {
    const items = [{ key: 'a', name: 'Alpha', c: { cap: 20000, end: '2027-12-31' } }, { key: 'b', name: 'Beta', c: { cap: 100000, end: '2027-12-31' } }, { key: 'c', name: 'Gamma', c: { cap: 20000, end: '2027-01-31' } }, { key: 'o', name: 'Office', c: { cap: 1, line: '1.1' } }];
    const O = [{ date: '2026-08-01', value: 12000 }];
    expect(ceilingsAtRisk(items, () => O, T).map((x) => [x.key, x.p.reach])).toEqual([['a', '2027-03']]);
  });
  it('counts what is still to order this year after the months the orders pay', () => {
    const c = { fee: 1000, start: '2026-01-01', end: '2026-12-31' };
    expect(stillToOrder(c, [{ description: 'Rent Q1 2026' }, { description: 'Rent Apr-May-Jun 2026' }], 2026)).toEqual({ from: '2026-07', months: 6, amount: 6000 });
    expect(stillToOrder(c, [{ description: 'Rent for 2026' }], 2026)).toEqual({ months: 0, amount: 0 });
    expect(stillToOrder({ ...c, end: '2026-09-30' }, [{ description: 'Rent Q1 2026' }], 2026)).toMatchObject({ months: 6, amount: 6000 });
    expect(stillToOrder({ ...c, end: '2026-09-30', autoRenew: true }, [{ description: 'Rent Q1 2026' }], 2026)).toMatchObject({ months: 9 });
    expect(stillToOrder({ fee: 500, start: '2026-05-01', openEnded: true }, [], 2026)).toEqual({ from: '2026-05', months: 8, amount: 4000 });
  });
});
