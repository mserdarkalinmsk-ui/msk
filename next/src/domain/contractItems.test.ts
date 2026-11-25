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
  it("finds the office's own orders under a provider's contract, wherever the office ordered from it", async () => {
    const { officeEntriesFor } = await import('./contractItems');
    const e = (line: string, supplier: string, description: string, spent: number, committed = 0) => ({ line, doc: 'X', description, supplier, amount: spent + committed, spent, committed, status: '', date: '2026-02-10', fund: 'ob' as const, gl: false });
    const offices = [{ id: 'o', name: 'Alpha Office', country: 'tr', reports: [{ id: 'r', date: '2026-04-30', year: 2026, file: 'r.xlsx', importedAt: '', office: 'Alpha Office', hasPlan: true, lines: [],
      entries: [e('3.1', 'OMEGA GROUP TOURISM TRANSPORT', 'Car rental Q1 2026', 3000), e('3.1', 'OMEGA GROUP TOURISM TRANSPORT', 'Car rental Q2 2026', 0, 3000), e('1.1', 'Sigma Landlord', 'Rent', 9000), e('3.1', 'Council of Europe Programme Office', 'petty cash', 50)] }] }];
    const O = officeEntriesFor(offices, 'omega group tourism transport', { name: 'OMEGA GROUP TOURISM TRANSPORT', end: '2027-06-30' });
    expect(O.map((x) => x.amount)).toEqual([3000, 3000]);
    expect(officeEntriesFor(offices, 'omega grup turizm tasimacilik', { name: 'Omega Grup Turizm Taşımacılık' }).length).toBe(2);
    expect(officeEntriesFor(offices, 'nobody', { name: 'Nobody Ltd' })).toEqual([]);
  });
});
