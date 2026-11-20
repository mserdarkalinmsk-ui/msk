import { describe, expect, it } from 'vitest';
import { contractAlerts, contractsDue, contractSeverity, daysTo, officeContractUse, ceilingSeverity } from './contracts';

const T = new Date(Date.UTC(2026, 10, 19));
describe('contract end warnings', () => {
  it('90 days ahead a warning, 60 serious, 30 critical, critical for a month after the end, then ended', () => {
    expect([120, 90, 61, 60, 31, 30, 0, -30, -31].map(contractSeverity)).toEqual(['ok', 'warning', 'warning', 'serious', 'serious', 'critical', 'critical', 'critical', 'ended']);
    expect(daysTo('2026-12-19', T)).toBe(30);
  });
  it('lists contracts with an end date, soonest first, with what was ordered; only those due count as alerts', () => {
    const D = contractsDue({ a: { end: '2027-06-30', cap: 100 }, b: { end: '2026-12-01', ref: 'FWC-1' }, c: { cap: 5 } }, T, (k) => ({ name: k.toUpperCase(), used: k === 'a' ? 40 : 0 }));
    expect(D.map((d) => d.key)).toEqual(['b', 'a']);
    expect(D[1]).toMatchObject({ name: 'A', used: 40, severity: 'ok' });
    expect(contractAlerts(D).map((d) => d.key)).toEqual(['b']);
  });
  it('an open-ended contract (a direct debit) is listed last, without a date and never warned', () => {
    const D = contractsDue({ a: { openEnded: true, name: 'Water' }, b: { end: '2026-12-01' } }, T);
    expect(D.map((d) => [d.key, d.severity])).toEqual([['b', 'critical'], ['a', 'ok']]);
    expect(contractAlerts(D).map((d) => d.key)).toEqual(['b']);
  });
  it('an office contract counts the office\'s own orders on its line from its supplier', () => {
    const E = [{ line: '1.10', supplier: 'Guard Co', spent: 1000, committed: 500 }, { line: '1.10', supplier: 'Other', spent: 70, committed: 0 }, { line: '1.6', supplier: 'Guard Co', spent: 30, committed: 0 }];
    expect(officeContractUse(E, '1.10', (s) => s === 'Guard Co')).toBe(1500);
  });
  it('warns as a contract nears its ceiling', () => {
    expect([[70, 100], [80, 100], [90, 100], [100, 100], [5, 0]].map(([u, c]) => ceilingSeverity(u, c))).toEqual([null, 'warning', 'serious', 'critical', null]);
  });
});
