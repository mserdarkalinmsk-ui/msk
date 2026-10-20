import { describe, expect, it } from 'vitest';
import demo from '../data/demo.json';
import { closeRecord, closeRows } from './close';
import type { Project } from './types';

const P = (demo as { projects: Project[] }).projects, today = new Date('2026-10-11T00:00:00Z');

describe('monthly close', () => {
  it('puts every running project in one row, blocked first', () => {
    const R = closeRows(P, today);
    expect(R.length).toBeGreaterThan(0);
    const order = R.map((r) => ['blocked', 'check', 'clean'].indexOf(r.status));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    for (const r of R) if (r.status !== 'clean') expect(r.reasons.length).toBeGreaterThan(0);
  });
  it('the next close shows the change since the recorded one', () => {
    const R = closeRows(P, today), rec = closeRecord(R, today);
    const moved = { ...rec, month: '2026-09', rows: rec.rows.map((x) => ({ ...x, spent: x.spent - 1000 })) };
    const N = closeRows(P, today, moved);
    for (const r of N) expect(r.since?.spent).toBeCloseTo(1000, 2);
    expect(rec.month).toBe('2026-10');
  });
});
