import { describe, expect, it } from 'vitest';
import demo from '../data/demo.json';
import { alerts } from './insights';
import type { Project } from './types';
import { alertStatus, backReason, openAlerts, pruneMarks, snoozeDay, splitAlerts, type AlertMark } from './worklist';

const P = (demo as { projects: Project[] }).projects, T = new Date('2026-10-11T00:00:00Z');
const A = alerts(P, T);

describe('alerts as a work list', () => {
  it('every alert has its own key, the same on another day', () => {
    expect(A.length).toBeGreaterThan(3);
    expect(new Set(A.map((a) => a.key)).size).toBe(A.length);
    const later = alerts(P, new Date('2026-10-12T00:00:00Z'));
    const kept = A.filter((a) => later.some((b) => b.key === a.key));
    expect(kept.length).toBeGreaterThan(A.length * 0.8);
    // a flag keeps its key when another flag of the project disappears (keys do not depend on the order found)
    for (const a of A.filter((x) => /:\d+$/.test(x.id) && !x.id.includes(':deadline:'))) expect(a.key).not.toBe(a.id);
  });
  it('with nothing marked every alert is open', () => {
    expect(openAlerts(A, undefined, T)).toBe(A);
    expect(splitAlerts(A, {}, T).open).toHaveLength(A.length);
  });
  it('a handled alert leaves the open list and comes back when it gets more serious', () => {
    const a = A.find((x) => x.severity === 'serious') ?? A[0];
    const mark: AlertMark = { state: 'done', at: T.toISOString(), severity: a.severity, title: a.title };
    const G = splitAlerts(A, { [a.key]: mark }, T);
    expect(G.done).toEqual([a]); expect(G.open).toHaveLength(A.length - 1);
    const worse = { ...a, severity: 'critical' as const };
    if (a.severity !== 'critical') { expect(alertStatus(worse, { [a.key]: mark }, T)).toBe('open'); expect(backReason(worse, { [a.key]: mark }, T)).toMatch(/more serious/); }
    expect(alertStatus({ ...a, severity: 'warning' }, { [a.key]: mark }, T)).toBe('done');
  });
  it('a snoozed alert comes back on its date', () => {
    const a = A[0], until = snoozeDay(T, 7);
    expect(until).toBe('2026-10-18');
    const M = { [a.key]: { state: 'snoozed', at: T.toISOString(), until, note: 'waiting for the donor', severity: a.severity, title: a.title } as AlertMark };
    expect(alertStatus(a, M, T)).toBe('snoozed');
    expect(alertStatus(a, M, new Date('2026-10-17T12:00:00Z'))).toBe('snoozed');
    expect(alertStatus(a, M, new Date('2026-10-18T00:00:00Z'))).toBe('open');
    expect(backReason(a, M, new Date('2026-10-18T00:00:00Z'))).toBe('back from snooze — waiting for the donor');
  });
  it('old marks of alerts that are gone are dropped', () => {
    const old: AlertMark = { state: 'done', at: '2024-01-01T00:00:00Z', severity: 'warning', title: 'x' }, recent: AlertMark = { ...old, at: '2026-09-01T00:00:00Z' };
    const out = pruneMarks({ gone: old, live: old, recent }, new Set(['live']), T);
    expect(Object.keys(out).sort()).toEqual(['live', 'recent']);
  });
});
