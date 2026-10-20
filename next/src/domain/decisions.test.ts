import { describe, expect, it } from 'vitest';
import { decisions } from './decisions';
import type { Project } from './types';

const L = (code: string, approved: number, actual: number) => ({ code, description: code, approved, actual, spentCommitted: actual });
const p = { id: 'a', code: 'X', bh: '5235', name: 'P', country: 'tr', start: '2024-01-01', end: '2027-02-28', budget: 1_000_000,
  payments: [{ date: '2024-02-01', amount: 300_000 }],
  reportingPeriods: [{ id: 'r', name: 'R', type: 'x', date: '2026-06-30', snapshot: { lines: [L('1.1.1.1', 400_000, 150_000), L('5.7', 600_000, 150_000)] } }] } as unknown as Project;

describe('decisions this month', () => {
  it('lists the payment request and the money left at the end', () => {
    const D = decisions([p], new Date('2026-10-11'));
    const t = D.map((x) => `${x.kind}: ${x.text}`).join('\n');
    expect(t).toMatch(/Payment request: BH 5235: 100% of the money received is spent/);
    expect(t).toMatch(/Ending: BH 5235 ends 28 Feb 2027/);
    expect(D[0].tone).toBe('bad');
  });
});
