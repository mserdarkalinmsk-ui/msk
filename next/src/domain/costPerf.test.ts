import { describe, expect, it } from 'vitest';
import demo from '../data/demo.json';
import { band, costPerf, evByWorkPlan } from './costPerf';
import type { Project } from './types';
import type { WorkPlan } from './workplan';
import type { WorkbookSummary } from './workbook';

const P = (demo as { projects: Project[] }).projects, today = new Date('2026-10-11T00:00:00Z');

describe('cost performance', () => {
  it('keeps the standard identities on every project', () => {
    for (const p of P) {
      const c = costPerf(p, today);
      expect(c.pv).toBeCloseTo(c.bac * c.timeGone, 0);
      if (c.fei != null) expect(c.fei).toBeCloseTo(c.ac / c.pv, 6);
      for (const w of c.eac) expect(w.vac).toBeCloseTo(c.bac - w.eac, 1);
      expect(c.eac[0].eac).toBeCloseTo(c.ac + c.rate * c.monthsLeft, 0);
      expect(c.eac[1].eac).toBeGreaterThanOrEqual(c.sc - 0.01);
      expect(c.eac.map((w) => w.key)).toContain(c.main.key);
    }
  });
});

describe('earned value of Work Plans', () => {
  const act = (id: string, amount: number, status: string) => ({ ref: '', id, name: id, amount, lines: [], status });
  const plan: WorkPlan = { id: 'w', no: 1, from: '2026-04-01', to: '2026-06-30', planned: 0, acts: [act('1', 1000, 'Done'), act('2', 3000, 'Postponed'), act('3', 500, 'Cancelled'), act('4', 1000, 'Completed')] };
  const e = (amount: number, activity: string) => ({ date: '2026-05-01', period: '', src: 'gl' as const, doc: '', po: '', line: '5.7', account: '', description: '', detail: '', supplier: '', amount, posted: true, activity });
  const wb = { entries: [e(1200, '1'), e(900, '4'), e(300, '2')], pos: [], lines: [], totals: {}, meta: {} } as unknown as WorkbookSummary;
  it('earns the planned amount of activities done, descopes cancelled ones, and compares with what was spent', () => {
    const [x] = evByWorkPlan([plan], wb, today);
    expect(x).toMatchObject({ pv: 5000, ev: 2000, ac: 2400, done: 2, postponed: 1, cancelled: 1 });
    expect(x.spi).toBeCloseTo(0.4, 6); expect(x.cpi).toBeCloseTo(2000 / 2400, 6);
  });
  it('measures nothing for a plan still running or without statuses', () => {
    expect(evByWorkPlan([{ ...plan, to: '2026-12-31' }], wb, today)).toEqual([]);
    expect(evByWorkPlan([{ ...plan, acts: plan.acts!.map((a) => ({ ...a, status: undefined })) }], wb, today)).toEqual([]);
  });
  it('reads an index against 1', () => { expect(band(1.02)).toBe('good'); expect(band(0.9)).toBe('warn'); expect(band(0.5)).toBe('bad'); expect(band(null)).toBe(null); });
});
