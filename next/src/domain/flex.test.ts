import { describe, expect, it } from 'vitest';
import { flexOf, programmeOf } from './flex';
import { compareBudget } from './ledger';
import type { Project } from './types';

const P = (x: Partial<Project>) => ({ id: 'a', code: 'A', name: 'A', country: 'c', start: '2025-01-01', end: '2026-12-31', budget: 1, ...x }) as Project;

describe('heading flexibility by programme', () => {
  it('is 25% for Joint Programmes and 15% for Voluntary Contributions', () => {
    expect(flexOf(P({}))).toBe(0.25);
    expect(flexOf(P({ programme: 'VC' }))).toBe(0.15);
    expect(flexOf(P({ funding: 'VC Norway' }))).toBe(0.15);
    expect(flexOf(P({ funding: 'Voluntary contribution' }))).toBe(0.15);
    expect(programmeOf(P({ funding: 'VC', programme: 'JP' }))).toBe('JP');
  });
  it('lets the contract figure win', () => expect(flexOf(P({ programme: 'VC', contract: { flexPct: 20 } }))).toBe(0.2));
  it('an 18% overrun is a notification in a JP and an addendum in a VC', () => {
    const budget = [{ code: '2.1', approved: 100 }], sc = new Map([['2.1', 118]]);
    expect(compareBudget([], budget, sc, '', '').heads[0].status).toBe('within-flex');
    expect(compareBudget([], budget, sc, '', '', 0.15).heads[0].status).toBe('over-flex');
    expect(compareBudget([], budget, new Map([['2.1', 113]]), '', '', 0.15).heads[0].status).toBe('near-flex');
  });
});
