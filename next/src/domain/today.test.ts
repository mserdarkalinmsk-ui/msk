import { describe, expect, it } from 'vitest';
import { fold, todoGroups, type Todo } from './today';

const t = (key: string, when: string | undefined, kind = 'report', tone: Todo['tone'] = 'warn'): Todo => ({ key, kind, when, tone, what: key, where: 'P1', go: 'x' });
describe('what needs me now', () => {
  it('groups by how soon, overdue first, and leaves out what is more than 90 days away', () => {
    const G = todoGroups([t('a', '2026-11-25'), t('b', '2026-11-10', 'report', 'bad'), t('c', '2026-12-15'), t('d', '2027-01-30'), t('e', '2027-06-01'), t('f', undefined)], '2026-11-20');
    expect(G.map((g) => [g.id, g.items.map((x) => x.key)])).toEqual([['overdue', ['b']], ['week', ['a']], ['month', ['c']], ['quarter', ['d']], ['check', ['f']]]);
  });
  it('folds the contracts ending the same day into one line', () => {
    const F = fold([t('x', '2026-12-31', 'contract'), t('y', '2026-12-31', 'contract'), t('z', '2026-12-30', 'contract'), t('r', '2026-12-31')], ['contract'], (n) => ({ what: `${n} contracts end`, where: '', go: 'staff' }));
    expect(F.map((x) => x.what).sort()).toEqual(['2 contracts end', 'r', 'z']);
  });
});
