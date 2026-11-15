import { describe, expect, it } from 'vitest';
import demo from '../data/demo.json';
import { closeDrift, closeRecord, closeRows, lockOf } from './close';
import { latestReport } from './calc';
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
  it('a closed month locks the report behind each project and nothing has drifted', () => {
    const R = closeRows(P, today), rec = closeRecord(R, today);
    const withReport = R.filter((r) => r.report);
    expect(withReport.length).toBeGreaterThan(0);
    for (const r of withReport) expect(lockOf([rec], r.p.id, latestReport(r.p)!)?.month).toBe('2026-10');
    expect(closeDrift(P, [rec])).toEqual([]);
    // a reopened month locks nothing and is not watched
    const open = { ...rec, reopened: '2026-10-12T00:00:00Z' };
    expect(lockOf([open], withReport[0].p.id, latestReport(withReport[0].p)!)).toBeUndefined();
    expect(closeDrift(P, [open])).toEqual([]);
  });
  it('a figure changed after the close is reported, a newer report is not', () => {
    const R = closeRows(P, today), rec = closeRecord(R, today), r = R.find((x) => x.report && x.spent > 0)!;
    const changed = { ...rec, rows: rec.rows.map((x) => (x.pid === r.p.id ? { ...x, spent: x.spent - 250 } : x)) };
    const D = closeDrift(P, [changed]);
    expect(D).toHaveLength(1);
    expect(D[0]).toMatchObject({ pid: r.p.id, what: 'Spent' });
    expect(D[0].now - D[0].closed).toBeCloseTo(250, 2);
    // the project moved on to another report: that is the month's movement, not drift
    const older = { ...changed, rows: changed.rows.map((x) => (x.pid === r.p.id ? { ...x, reportId: 'some-earlier-report' } : x)) };
    const p2 = { ...r.p, reportingPeriods: [...(r.p.reportingPeriods ?? []), { ...latestReport(r.p)!, id: 'some-earlier-report', date: '2020-01-31' }] } as Project;
    expect(closeDrift(P.map((p) => (p.id === r.p.id ? p2 : p)), [older])).toEqual([]);
    // the report of the close was removed
    const gone = { ...rec, rows: rec.rows.map((x) => (x.pid === r.p.id ? { ...x, reportId: 'deleted' } : x)) };
    expect(closeDrift(P, [gone])).toMatchObject([{ pid: r.p.id, removed: true }]);
  });
});
