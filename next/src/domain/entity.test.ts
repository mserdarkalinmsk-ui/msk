import { describe, expect, it } from 'vitest';
import { personCard, providerCard, providerIndex } from './entity';
import type { ProviderPO } from './providers';
import type { Person } from './staff';

const p1 = { id: 'p1', code: 'P1' }, p2 = { id: 'p2', code: 'P2' };
const po = (p: object, n: string, supplier: string, line: string, sc: number, spent: number, date: string) => ({ p, po: n, supplier, line, sc, value: sc, amount: sc, spent, balance: sc - spent, date, kind: 'events', description: '', nature: '', status: 'Open', units: null, unitType: '' }) as unknown as ProviderPO;

describe('provider and person cards', () => {
  const all = [po(p1, '1', 'Alpha Events Ltd', '5.7.1', 1000, 400, '2026-03-01'), po(p2, '2', 'ALPHA EVENTS LTD.', '5.7.2', 500, 500, '2026-05-01'), po(p1, '3', 'Alpha Events Ltd', '5.7.1', 250, 0, '2026-06-01'), po(p1, '4', 'Beta Print', '5.9', 90, 90, '2026-01-01')];
  it('gathers a provider across projects, spellings and its contracts, newest order first', () => {
    const k = providerIndex(all)[0].key;
    const C = providerCard(all, k, { [k]: { end: '2026-12-31', fee: 10, cur: 'TRY' }, other: { end: '2027-01-01' } })!;
    expect(C.name).toBe('Alpha Events Ltd');
    expect(C.pos.map((x) => x.po)).toEqual(['3', '2', '1']);
    expect(C.projects.map((s) => [s.id, s.n, s.sc, s.open, s.lines])).toEqual([['p1', 2, 1250, 850, ['5.7.1']], ['p2', 1, 500, 0, ['5.7.2']]]);
    expect(C.total).toEqual({ n: 3, amount: 1750, spent: 900, sc: 1750, open: 850 });
    expect(C.contracts.map((x) => x.key)).toEqual([k]);
  });
  it('finds the orders of a contract written in Turkish, from the contract or from the provider', () => {
    const L = [po(p1, '7', 'OMEGA CONGRESS MEETING SERVICES', '5.7', 300, 100, '2026-02-01')] as unknown as ProviderPO[];
    const FW = { 'omega kongre toplanti hizmetleri': { name: 'Omega Kongre Toplanti Hizmetleri A.S.', end: '2029-06-30' } };
    const C = providerCard(L, 'omega kongre toplanti hizmetleri', FW)!;
    expect([C.total.n, C.total.sc, C.contracts.length]).toEqual([1, 300, 1]);
    expect(providerCard(L, providerIndex(L)[0].key, FW)!.contracts.length).toBe(1);
  });
  it('gathers a person: project contracts and the core team, under any order of the names', () => {
    const a = { name: 'ALPHA,One', display: 'One ALPHA', position: 'Assistant', end: '2026-12-31', project: p1 } as unknown as Person;
    const C = personCard([a], { tr: [{ id: 'c', name: 'Alpha, One', position: 'Head of office' }] }, 'alpha one')!;
    expect([C.name, C.roles.length, C.core[0].country]).toEqual(['Alpha, One', 1, 'tr']);
    expect(personCard([a], {}, 'nobody')).toBeNull();
  });
});
