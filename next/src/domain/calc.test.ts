import { describe, expect, it } from 'vitest';
import seed from '../data/demo.json';
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

import { byCategory, checkReport, compareReports, lineRows, planStats, reportTotals } from './calc';

describe('budget lines', () => {
  it('flattens latest lines and reconciles with money()', () => {
    const R = lineRows(L.projects);
    for (const p of L.projects) {
      const mine = R.filter((r) => r.project.id === p.id);
      expect(mine.reduce((s, r) => s + r.actual, 0)).toBeCloseTo(money(p).spent, 6);
    }
    const C = byCategory(R);
    expect(C.reduce((s, c) => s + c.approved, 0)).toBeCloseTo(R.reduce((s, r) => s + r.approved, 0), 6);
  });
  it('compares versions by code, including added and removed lines', () => {
    const a = { id: 'a', name: 'a', type: 'Q', date: '2026-01-01', snapshot: { lines: [{ code: '1', approved: 10, actual: 1 }, { code: '2', approved: 5, actual: 0 }] } };
    const b = { id: 'b', name: 'b', type: 'Q', date: '2026-06-01', snapshot: { lines: [{ code: '1', approved: 10, actual: 4 }, { code: '3', approved: 2, actual: 0 }] } };
    const D = compareReports(a, b);
    expect(D.map((d) => [d.code, d.status])).toEqual([['1', 'changed'], ['2', 'removed'], ['3', 'added']]);
    expect(D[0].actual).toEqual([1, 4]);
    expect(reportTotals(b)).toMatchObject({ approved: 12, actual: 4 });
  });
  it('checks a new report', () => {
    const p = L.projects[0];
    const prev = p.reportingPeriods!.at(-1)!;
    const bad = { id: 'n', name: 'n', type: 'Q', date: '2026-09-30', snapshot: { lines: [{ ...prev.snapshot!.lines[0], actual: 1 }, { code: '1', approved: 1, actual: 0 }] } };
    const C = checkReport(p, bad);
    expect(C.some((c) => c.level === 'error' && /twice/.test(c.text))).toBe(true);
    expect(C.some((c) => /fell from/.test(c.text))).toBe(true);
    const good = { ...prev, id: 'g', date: '2026-09-30' };
    expect(checkReport(p, good).filter((c) => c.level === 'error')).toEqual([]);
  });
  it('computes plan status', () => {
    const s = planStats(L.projects[0], T)!;
    expect(s.total).toBe(L.projects[0].doa!.acts.length);
    expect(s.month).toBe(22);
    expect(s.late).toBeGreaterThanOrEqual(0);
  });
});

import { normalizeSector, validUrl } from './types';
describe('identifiers', () => {
  it('accepts only safe http(s) links', () => {
    expect(validUrl('https://pmm.example.org/p/123')).toBe('https://pmm.example.org/p/123');
    expect(validUrl('javascript:alert(1)')).toBeNull();
    expect(validUrl('https://user:pw@x.org')).toBeNull();
    expect(validUrl('pmm/123')).toBeNull();
  });
  it('normalises sector names', () => {
    expect(normalizeSector('rule_of_law')).toBe('Rule of Law');
    expect(normalizeSector('İnsan Hakları')).toBe('Human Rights');
    expect(normalizeSector('HUKUKUN ÜSTÜNLÜĞÜ')).toBe('Rule of Law');
    expect(normalizeSector('Health')).toBeNull();
  });
});

import { addMonths, deadlines } from './calc';
describe('reporting calendar', () => {
  it('derives yearly progress and final report deadlines', () => {
    const p = { ...L.projects[0] }; // 2025-01-01 → 2027-12-31, 12-month periods, 60 days
    const D = deadlines(p, T);
    expect(D.map((d) => [d.kind, d.periodEnd, d.due])).toEqual([
      ['Progress report', '2025-12-31', '2026-03-01'],
      ['Progress report', '2026-12-31', '2027-03-01'],
      ['Final report', '2027-12-31', '2028-06-30'],
    ]);
    expect(D[0].status).toBe('submitted'); // the Mar 2026 report covers the 2025 period
    expect(D[1].status).toBe('upcoming');
  });
  it('clamps month arithmetic to month ends', () => {
    expect(addMonths('2027-12-31', 6)).toBe('2028-06-30');
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
  });
  it('flags overdue periods with no report', () => {
    const p = { ...L.projects[0], reportingPeriods: [] };
    expect(deadlines(p, T)[0].status).toBe('overdue');
  });
});

import { recentRate } from './calc';
describe('forecast rate', () => {
  it('is never negative when a later report shows lower cumulative spend', () => {
    const p = { ...base, reportingPeriods: [...base.reportingPeriods!, { id: 'c', name: 'R2', type: 'Q', date: '2026-06-01', snapshot: { lines: [{ code: '1', approved: 600, actual: 100 }] } }] };
    expect(recentRate(p)).toBe(0);
  });
});

import { latestReport as _latest } from './calc';
describe('latest report', () => {
  const rep = (id: string, date: string, at?: string) => ({ id, name: id, type: 'Interim Financial Report', date, registeredAt: at, snapshot: { lines: [{ code: '1.1', approved: 1, actual: 1 }] } });
  it('is the one of the latest period, even when an older one is loaded after it', () => {
    const p = { reportingPeriods: [rep('a', '2026-09-30', '2026-10-01T10:00:00Z'), rep('b', '2026-06-30', '2026-10-05T10:00:00Z')] } as unknown as Project;
    expect(_latest(p)?.id).toBe('a');
  });
  it('within one month, the last one loaded', () => {
    const p = { reportingPeriods: [rep('a', '2026-09-30', '2026-10-05T10:00:00Z'), rep('b', '2026-09-15', '2026-10-01T10:00:00Z')] } as unknown as Project;
    expect(_latest(p)?.id).toBe('a');
  });
  it('falls back to the period when the reports have no load time', () => {
    const p = { reportingPeriods: [rep('a', '2026-09-30'), rep('b', '2026-06-30')] } as unknown as Project;
    expect(_latest(p)?.id).toBe('a');
  });
});
