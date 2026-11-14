import { describe, expect, it } from 'vitest';
import { applyMerge, planMerge } from './merge';

const p = (id: string, extra: object = {}) => ({ id, code: id, name: id, country: 'tr', start: '2025-01-01', end: '2027-01-01', budget: 1, ...extra }) as never;
describe('merge backups', () => {
  it('adds new projects, keeps identical ones and lets the newer side win a conflict', () => {
    const mine = { countries: [{ id: 'tr', name: 'Türkiye' }], projects: [p('a'), p('b', { documents: [{ name: 'x', kind: 'doa', importedAt: '2026-01-01', summary: [] }] })], poKinds: { k: 'events' } } as never;
    const theirs = { countries: [{ id: 'tr', name: 'Türkiye' }, { id: 'ge', name: 'Georgia' }], projects: [p('a'), p('b', { documents: [{ name: 'x', kind: 'doa', importedAt: '2026-01-01', summary: [] }, { name: 'y', kind: 'contract', importedAt: '2026-05-01', summary: [] }] }), p('c')], poKinds: { k: 'interp', j: 'visibility' } } as never;
    const plan = planMerge(mine, theirs);
    expect(plan.added.map((x) => x.id)).toEqual(['c']); expect(plan.same).toBe(1);
    expect(plan.conflicts[0].newer).toBe('theirs'); expect(plan.conflicts[0].diff[0]).toBe('documents 1 → 2');
    const L = applyMerge(mine, theirs, plan, {});
    expect(L.projects.map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(L.projects[1].documents!.length).toBe(2);
    expect(L.countries.length).toBe(2); expect(L.poKinds).toEqual({ k: 'events', j: 'visibility' });
    expect(applyMerge(mine, theirs, plan, { b: 'mine' }).projects[1].documents!.length).toBe(1);
  });
});
