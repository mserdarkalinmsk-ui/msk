import { describe, expect, it } from 'vitest';
import { lotsUse, outsideTenders, tenderUse, type Tender } from './tenders';
import { supKey, type ProviderPO } from './providers';

const p1 = { id: 'p1', country: 'tr' }, p2 = { id: 'p2', country: 'tr' };
const po = (p: object, supplier: string, value: number, spent: number, date: string, kind = 'consult') => ({ p, supplier, value, spent, date, kind, po: 'x', line: '1.1.3', description: '', amount: value }) as unknown as ProviderPO;
const all = [po(p1, 'ALPHA, One', 6000, 6000, '2031-02-01'), po(p1, 'ALPHA, One', 3000, 0, '2031-05-01'), po(p1, 'BETA, Two', 2500, 2500, '2031-03-01'), po(p2, 'ALPHA, One', 4000, 4000, '2031-03-01'), po(p1, 'GAMMA, Three', 1200, 1200, '2031-03-01'), po(p1, 'ALPHA, One', 900, 900, '2029-01-01')];
const T: Tender = { id: 't', name: 'Roster of national consultants', projects: ['p1'], threshold: 10000, perMember: 8000, start: '2031-01-01', members: [{ key: supKey('ALPHA, One'), name: 'ALPHA, One' }, { key: supKey('BETA, Two'), name: 'BETA, Two' }] };

describe('tenders and their threshold', () => {
  it('adds up the orders of the selected providers in its projects and period, against the threshold and the cap per provider', () => {
    const U = tenderUse(T, all);
    expect([U.used, U.spent, U.open, U.level, U.overMembers]).toEqual([11500, 8500, 3000, 'critical', 1]);
    expect(U.members.map((m) => [m.name, m.used, m.over])).toEqual([['ALPHA, One', 9000, true], ['BETA, Two', 2500, false]]);
    expect(tenderUse({ ...T, threshold: 12500 }, all).level).toBe('serious');
    expect(tenderUse({ ...T, threshold: 14000 }, all).level).toBe('warning');
    expect(tenderUse({ ...T, projects: [], country: 'tr' }, all).used).toBe(15500);
  });
  it('lists the providers of a kind bought from without a tender', () => {
    expect(outsideTenders([T], all, ['consult']).map((x) => [x.name, x.used])).toEqual([['GAMMA, Three', 1200]]);
  });
});

describe('tenders in lots', () => {
  it('checks each lot against its own threshold, and the tender against its own', () => {
    const t: Tender = { ...T, members: [], threshold: 20000, lots: [{ id: 'l1', name: 'Lot 1 — legal experts', threshold: 8000, members: [{ key: supKey('ALPHA, One'), name: 'ALPHA, One' }] }, { id: 'l2', name: 'Lot 2 — trainers', threshold: 5000, members: [{ key: supKey('BETA, Two'), name: 'BETA, Two' }] }] };
    const U = lotsUse(t, all);
    expect(U.lots.map((x) => [x.lot.name, x.use.used, x.use.level])).toEqual([['Lot 1 — legal experts', 9000, 'critical'], ['Lot 2 — trainers', 2500, 'ok']]);
    expect([U.used, U.level]).toEqual([11500, 'critical']);
    expect(lotsUse({ ...t, lots: [t.lots![1]] }, all).level).toBe('ok');
  });
});
