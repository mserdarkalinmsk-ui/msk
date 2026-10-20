import { describe, expect, it } from 'vitest';
import seed from '../data/seed.json';
import demo from '../data/demo.json';
import { lineRows, lines, money, totals } from './calc';
import { headings } from './insights';
import { portfolioStatement } from './statement';
import type { Project } from './types';

/** The same figure (budget, spent, committed) must read the same on every screen. */
const sets: [string, Project[]][] = [['seed', (seed as { projects: Project[] }).projects], ['demo', (demo as { projects: Project[] }).projects]];
const near = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(1);

describe.each(sets)('cross-screen consistency (%s)', (_, P) => {
  it('project card, budget lines and headings agree per project', () => {
    for (const p of P) {
      const m = money(p), L = lines(p);
      if (!L.some((l) => l.actual != null)) continue;
      const rows = lineRows([p]);
      near(rows.reduce((s, r) => s + r.actual, 0), m.spent);
      near(rows.reduce((s, r) => s + r.committed, 0), m.committed);
      const h = headings(p);
      near(h.total.exposure, m.exposure);
      expect(new Set(L.map((l) => l.code)).size).toBe(L.length);
    }
  });
  it('spent to date equals the last point of "Reports over time"', () => {
    for (const p of P) {
      const R = [...(p.reportingPeriods ?? [])].filter((r) => r.snapshot?.lines?.length).sort((a, b) => a.date.localeCompare(b.date));
      if (!R.length || R.at(-1)!.snapshot!.workbook?.meta?.extraction) continue;
      const last = R.filter((r) => r.date.slice(0, 7) === R.at(-1)!.date.slice(0, 7));
      if (last.length > 1) continue;
      near(money(p).spent, R.at(-1)!.snapshot!.lines.reduce((s, l) => s + (l.actual ?? 0), 0));
    }
  });
  it('portfolio statement totals equal the sum of the projects', () => {
    const S = portfolioStatement(P), R = lineRows(P);
    near(S.totals.eligible?.budget ?? S.totals.direct.budget, R.reduce((s, r) => s + r.approved, 0));
    near(S.totals.eligible?.actual ?? S.totals.direct.actual, R.reduce((s, r) => s + r.actual, 0));
  });
  it('portfolio totals equal the sum of project cards', () => {
    const T = totals(P, new Date('2026-10-12')) as unknown as Record<string, number>;
    const sum = (k: 'budget' | 'spent' | 'committed') => P.reduce((s, p) => s + money(p)[k], 0);
    if ('budget' in T) near(T.budget, sum('budget'));
    if ('spent' in T) near(T.spent, sum('spent'));
    if ('committed' in T) near(T.committed, sum('committed'));
  });
});
