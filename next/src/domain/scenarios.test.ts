import { describe, expect, it } from 'vitest';
import { PRESETS, runScenario } from './scenarios';
import type { Project } from './types';

const p = { id: 'a', code: 'A', name: 'A', country: 'tr', start: '2025-01-01', end: '2027-01-01', budget: 2400, spent: 1200, committed: 0 } as unknown as Project;
describe('scenarios', () => {
  it('an extension alone keeps the projected total, a budget cut lowers the room', () => {
    const t = new Date('2026-01-01');
    const [cur, ext, cut] = PRESETS.map((s) => runScenario(p, s, t));
    expect(ext.projected).toBeCloseTo(cur.projected, 0);
    expect(ext.end).toBe('2027-07-01');
    expect(cut.budget).toBeCloseTo(2160);
    expect(cut.balance).toBeLessThan(cur.balance);
  });
  it('a faster pace raises spending', () => {
    const t = new Date('2026-01-01');
    expect(runScenario(p, { ...PRESETS[0], pacePct: 20 }, t).projected).toBeGreaterThan(runScenario(p, PRESETS[0], t).projected);
  });
});
