import { describe, expect, it } from 'vitest';
import { coreDue, onTeam } from './coreTeam';

const T = new Date(Date.UTC(2026, 10, 19));
describe('core team', () => {
  it('warns on contracts ending as for providers, soonest first; no end date is no warning', () => {
    const D = coreDue([{ id: 'a', name: 'Alpha One', position: 'Head of office', end: '2027-06-30' }, { id: 'b', name: 'Beta Two', position: 'Driver', end: '2026-12-10' }, { id: 'c', name: 'Gamma Three', position: 'Assistant' }], T);
    expect(D.map((d) => [d.m.id, d.severity])).toEqual([['b', 'critical'], ['a', 'ok'], ['c', 'none']]);
  });
  it('is on the team between its start and its end', () => {
    expect(onTeam({ id: 'a', name: 'A', position: 'P', start: '2027-01-01' }, T)).toBe(false);
    expect(onTeam({ id: 'a', name: 'A', position: 'P', end: '2026-11-18' }, T)).toBe(false);
    expect(onTeam({ id: 'a', name: 'A', position: 'P', start: '2025-01-01', end: '2026-11-19' }, T)).toBe(true);
  });
});
