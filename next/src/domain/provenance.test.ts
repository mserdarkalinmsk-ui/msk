import { describe, expect, it } from 'vitest';
import seed from '../data/seed.json';
import demo from '../data/demo.json';
import { lines, money } from './calc';
import { outcome } from './insights';
import { normalizeProject } from './normalize';
import { trace, traceLine, type Figure, type Trace } from './provenance';
import type { Project } from './types';

const T = new Date('2026-06-15T00:00:00Z');
const sets: [string, Project[]][] = [['seed', (seed as { projects: Project[] }).projects.map(normalizeProject)], ['demo', (demo as { projects: Project[] }).projects.map(normalizeProject)]];
/** Reads the terms as a sum: the first term, then + and − ones, up to the first '='. */
const addUp = (t: Trace) => { let v = 0; for (const x of t.terms) { if (x.op === '=') break; v += x.op === '−' ? -x.value : x.value; } return v; };

describe.each(sets)('where a figure comes from (%s)', (_, P) => {
  it('explains the figure the screens show', () => {
    for (const p of P) {
      const m = money(p), o = outcome(p, T);
      const want: Record<Figure, number> = { budget: m.budget, spent: m.spent, committed: m.committed, exposure: m.exposure, remaining: m.remaining, pace: trace(p, 'pace', T).value, projected: o.projected, unused: o.unused };
      for (const f of Object.keys(want) as Figure[]) {
        const t = trace(p, f, T);
        expect(t.value, `${p.code} ${f}`).toBeCloseTo(want[f], 2);
        expect(t.terms.at(-1)!.op).toBe('=');
        expect(t.sources.length).toBeGreaterThan(0);
        expect(t.how.length).toBeGreaterThan(10);
      }
    }
  });
  it('the terms of the sums add up to the figure', () => {
    for (const p of P) for (const f of ['committed', 'exposure', 'remaining'] as Figure[]) {
      const t = trace(p, f, T);
      if (t.terms.length === 1) { expect(t.notes.some((n) => /differs by/.test(n))).toBe(true); continue; }
      expect(Math.abs(addUp(t) - t.value), `${p.code} ${f}`).toBeLessThan(0.02);
    }
  });
  it('the breakdown by heading adds up to the total', () => {
    for (const p of P) {
      if (!lines(p).some((l) => l.actual != null)) continue;
      for (const f of ['spent', 'committed', 'exposure'] as Figure[]) {
        const t = trace(p, f, T), s = t.parts!.rows.reduce((a, r) => a + r.value, 0);
        expect(Math.abs(s - t.value), `${p.code} ${f}`).toBeLessThan(0.5);
      }
    }
  });
  it('a line and its heading read the same as the budget lines', () => {
    for (const p of P) {
      const L = lines(p); if (!L.length) continue;
      const l = L.find((x) => (x.actual ?? 0) > 0) ?? L[0];
      const t = traceLine(p, l.code, 'actual')!;
      const kids = L.filter((x) => x.code === l.code || x.code.startsWith(l.code + '.'));
      if (kids.length === 1) expect(t.value).toBeCloseTo(l.actual ?? 0, 2);
      const b = traceLine(p, l.code, 'balance')!;
      expect(Math.abs(addUp(b) - b.value)).toBeLessThan(0.02);
      const h = l.code.split('.')[0], th = traceLine(p, h, 'exposure')!;
      const sum = L.filter((x) => x.code === h || x.code.startsWith(h + '.')).filter((k, _i, A) => !A.some((o) => o !== k && o.code.startsWith(k.code + '.')));
      expect(th.value).toBeCloseTo(sum.reduce((a, x) => a + (x.spentCommitted != null ? x.spentCommitted : (x.actual ?? 0) + (x.committed ?? 0)), 0), 1);
    }
  });
  it('an unknown line has no trace', () => { expect(traceLine(P[0], '99.99', 'actual')).toBeNull(); });
});
