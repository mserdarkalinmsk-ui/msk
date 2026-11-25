import { describe, expect, it } from 'vitest';
import { monthTasks } from './checklist';
import type { Ledger } from './types';

describe("the month's checklist: contracts", () => {
  it('lists the renewal to decide, the papers missing, and nothing for a contract far from its end', () => {
    const L = { countries: [{ id: 'tr', name: 'Alpha' }], projects: [], frameworks: {
      a: { name: 'Omega Services', country: 'tr', start: '2026-01-01', end: '2026-12-31', noticeDays: 30, autoRenew: true },
      b: { name: 'Sigma Supplies', country: 'tr', start: '2026-01-01', end: '2029-12-31', doc: { name: 'b.pdf', type: 'application/pdf', size: 1, at: '' } } } } as unknown as Ledger;
    const T = monthTasks(L, new Date(Date.UTC(2026, 10, 26)), { events: [], officeRequests: [] }).filter((t) => t.group === 'Contracts');
    expect(T.map((t) => t.title)).toEqual(['Decide on the renewal of Omega Services (Alpha)', 'Complete 1 contract in Alpha']);
    expect(T[0]).toMatchObject({ due: '2026-12-01', to: 'countries/tr/contracts' });
    expect(T[0].detail).toContain('renews unless notice is given');
  });
});
