import { describe, expect, it } from 'vitest';
import seed from '../data/seed.json';
import type { Ledger, Project } from './types';
import { attention, burnGap, elapsed, groupBy, money, portfolioSeries, spendAt, totals, validateLedger } from './calc';

const L = seed as unknown as Ledger;
const T = new Date('2026-10-11T00:00:00Z');
const base: Project = {
  id: 'x', code: 'X', name: 'Test', country: 'tr', start: '2025-01-01', end: '2027-01-01', budget: 1000,
  reportingPeriods: [
    { id: 'a', name: 'B', type: 'Budget', date: '2025-01-01', snapshot: { lines: [{ code: '1', approved: 600, actual: 0 }, { code: '2', approved: 400, actual: 0 }] } },
    { id: 'b', name: 'R1', type: 'Q', date: '2026-01-01', snapshot: { lines: [{ code: '1', approved: 600, actual: 300, committed: 50 }, { code: '2', approved: 400, actual: 200, committed: 0 }] } },
  ],
};

describe('money', () => {
  it('uses the latest report lines', () => {
    expect(money(base)).toEqual({ budget: 1000, spent: 500, committed: 50, exposure: 550, remaining: 450 });
  });
  it('falls back to project fields without reports', () => {
    expect(money({ ...base, reportingPeriods: [], spent: 7, committed: 3 }).spent).toBe(7);
  });
  it('matches the seed project totals', () => {
    for (const p of L.projects) expect(money(p).spent).toBeCloseTo(p.spent ?? 0, 0);
  });
});

describe('time', () => {
  it('elapsed is clamped', () => {
    expect(elapsed(base, new Date('2024-01-01'))).toBe(0);
    expect(elapsed(base, new Date('2030-01-01'))).toBe(1);
    expect(elapsed(base, new Date('2026-01-01T00:00:00Z'))).toBeCloseTo(0.5, 2);
  });
  it('burn gap = burn − elapsed', () => {
    expect(burnGap(base, new Date('2026-01-01T00:00:00Z'))).toBeCloseTo(0, 2);
  });
  it('interpolates spend between reports', () => {
    const mid = (Date.parse('2025-01-01') + Date.parse('2026-01-01')) / 2;
    expect(spendAt(base, mid)).toBeCloseTo(250, 0);
    expect(spendAt(base, Date.parse('2030-01-01'))).toBe(500);
    expect(spendAt(base, Date.parse('2020-01-01'))).toBe(0);
  });
});

describe('portfolio', () => {
  it('totals reconcile with per-project money', () => {
    const t = totals(L.projects, T);
    expect(t.spent).toBeCloseTo(L.projects.reduce((s, p) => s + money(p).spent, 0), 6);
    expect(t.remaining).toBeCloseTo(t.budget - t.spent - t.committed, 6);
    expect(t.elapsed).toBeGreaterThan(0); expect(t.elapsed).toBeLessThan(1);
  });
  it('series is monotonic, forecast never exceeds budget', () => {
    const S = portfolioSeries(L.projects, T);
    const B = totals(L.projects, T).budget;
    for (let i = 1; i < S.length; i++) {
      expect(S[i].plan).toBeGreaterThanOrEqual(S[i - 1].plan - 1e-6);
      if (S[i].actual != null && S[i - 1].actual != null) expect(S[i].actual!).toBeGreaterThanOrEqual(S[i - 1].actual! - 1e-6);
      if (S[i].high != null) { expect(S[i].high!).toBeLessThanOrEqual(B + 1e-6); expect(S[i].low!).toBeLessThanOrEqual(S[i].high!); }
    }
    expect(S.at(-1)!.plan).toBeCloseTo(B, 0);
  });
  it('groups sum to totals', () => {
    const g = groupBy(L.projects, (p) => p.country);
    expect(g.reduce((s, r) => s + r.budget, 0)).toBe(totals(L.projects, T).budget);
  });
  it('flags overspent lines and sorts by severity', () => {
    const p: Project = { ...base, reportingPeriods: [{ id: 'c', name: 'R', type: 'Q', date: '2026-09-01', snapshot: { lines: [{ code: '9', approved: 100, actual: 140 }] } }] };
    const F = attention([p], T);
    expect(F.some((f) => f.kind === 'line' && f.severity === 'critical')).toBe(true);
    const rank = { critical: 0, serious: 1, warning: 2 };
    for (let i = 1; i < F.length; i++) expect(rank[F[i].severity]).toBeGreaterThanOrEqual(rank[F[i - 1].severity]);
  });
});

describe('validateLedger', () => {
  it('accepts the seed', () => expect(validateLedger(L)).toEqual([]));
  it('reports bad rows', () => {
    const e = validateLedger({ countries: [], projects: [{ id: 'a', code: 'A', name: 'n', budget: 1, start: '2026-01-01', end: '2025-01-01' }] });
    expect(e[0]).toMatch(/end must be after start/);
  });
  it('rejects non-ledgers', () => expect(validateLedger(null)).toHaveLength(1));
});
