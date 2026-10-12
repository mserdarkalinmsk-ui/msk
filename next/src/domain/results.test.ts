import { describe, expect, it } from 'vitest';
import { indState, resultRows } from './results';
import type { Project } from './types';

const ind = (baseline: string, target: string, current?: string) => ({ id: Math.random().toString(), result: 'R1', indicator: 'x', baseline, target, current, source: '', asOf: '2026-09-01' });
describe('results', () => {
  it('rates indicators against the time elapsed', () => {
    expect(indState(ind('0', '100', '100'), 0.5).state).toBe('reached');
    expect(indState(ind('0', '100', '45'), 0.5).state).toBe('on track');
    expect(indState(ind('0', '100', '25'), 0.5).state).toBe('behind');
    expect(indState(ind('0', '100', '5'), 0.6).state).toBe('off track');
    expect(indState(ind('0', '100'), 0.5).state).toBe('not measured');
    expect(indState(ind('0', ''), 0.5).state).toBe('no target');
  });
  it('flags spending ahead of results', () => {
    const p = { id: 'a', code: 'A', name: 'A', country: 'tr', start: '2025-01-01', end: '2027-01-01', budget: 100, spent: 80, committed: 0, indicators: [ind('0', '100', '20'), ind('0', '10', '2')] } as unknown as Project;
    const r = resultRows([p], new Date('2026-01-01')).rows[0];
    expect(r.results).toBeCloseTo(0.2);
    expect(r.flag).toBe('spending ahead of results');
  });
});
