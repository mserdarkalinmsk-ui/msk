import { describe, expect, it } from 'vitest';
import { cashRow } from './cash';

const proj = (extra: object) => ({ id: 'a', code: 'A', name: 'A', country: 'tr', start: '2025-01-01', end: '2027-12-31', budget: 1000000,
  reportingPeriods: [{ id: 'r', name: 'R', type: 'x', date: '2026-01-31', snapshot: { lines: [{ code: '1', approved: 1000000, actual: 300000 }] } }], ...extra }) as never;
describe('cash plan', () => {
  it('uses the contract pre-financing until payments are entered and asks for the next payment at 70 %', () => {
    const r = cashRow(proj({ contract: { euMax: 1000000, prefin: 40 } }), new Date('2026-02-01'));
    expect(r.expected).toBe(true); expect(r.received).toBe(400000); expect(r.cash).toBe(100000); expect(r.request).toBe('now');
  });
  it('counts entered payments and gives a run-out date', () => {
    const r = cashRow(proj({ payments: [{ date: '2025-01-15', amount: 600000 }] }), new Date('2026-02-01'));
    expect(r.expected).toBe(false); expect(r.received).toBe(600000); expect(r.request).toBe('later');
    expect(r.runout! > '2026-02-01').toBe(true);
  });
});
