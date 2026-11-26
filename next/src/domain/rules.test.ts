import { afterEach, describe, expect, it } from 'vitest';
import demo from '../data/demo.json';
import { attention, burnGap } from './calc';
import { closeRows } from './close';
import { flexOf, nearOf } from './flex';
import { alerts } from './insights';
import { cleanRules, customRules, DEFAULT_RULES, paceBand, paceTone, RULE_FIELDS, rules, setRules } from './rules';
import type { Project } from './types';

const P = (demo as { projects: Project[] }).projects, T = new Date('2026-10-11T00:00:00Z');
const fresh = () => P.map((p) => ({ ...p })); // checks are remembered per project object
afterEach(() => setRules(undefined));

describe('house rules', () => {
  it('the defaults are the rules the app always had', () => {
    expect(rules()).toEqual({ flexJP: 25, flexVC: 15, nearShare: 80, paceBehind: 15, paceFarBehind: 30, paceAhead: 10, lineOver: 10, lineCritical: 25, staleDays: 180, freshDays: 75, renewalDays: 90, endingDays: 120 });
    expect(RULE_FIELDS.map((f) => f.key).sort()).toEqual(Object.keys(DEFAULT_RULES).sort());
    const jp = { funding: 'EU' } as Project, vc = { funding: 'Sweden VC' } as Project;
    expect(flexOf(jp)).toBe(0.25); expect(flexOf(vc)).toBe(0.15); expect(nearOf(0.25)).toBeCloseTo(0.2, 9);
  });
  it('heading flexibility follows the rule, a contract figure still wins', () => {
    setRules({ flexJP: 20, flexVC: 10, nearShare: 50 });
    expect(flexOf({ funding: 'EU' } as Project)).toBe(0.2);
    expect(flexOf({ funding: 'Norway' } as Project)).toBe(0.1);
    expect(flexOf({ funding: 'EU', contract: { flexPct: 30 } } as unknown as Project)).toBe(0.3);
    expect(nearOf(0.2)).toBeCloseTo(0.1, 9);
  });
  it('values out of range or out of order are put right', () => {
    expect(cleanRules({ flexJP: 500, staleDays: -3, paceBehind: Number.NaN } as never)).toEqual(DEFAULT_RULES);
    expect(cleanRules({ paceBehind: 40, paceFarBehind: 20 }).paceFarBehind).toBe(40);
    expect(cleanRules({ lineOver: 50, lineCritical: 25 }).lineCritical).toBe(50);
    expect(customRules(DEFAULT_RULES)).toBeUndefined();
    expect(customRules({ ...DEFAULT_RULES, flexVC: 12 })).toEqual({ flexVC: 12 });
  });
  it('pace bands move with the thresholds', () => {
    expect(paceBand(-0.2)).toBe('behind'); expect(paceBand(-0.35)).toBe('far-behind'); expect(paceBand(0.12)).toBe('ahead'); expect(paceBand(0.05)).toBe('ok');
    expect(paceTone(-0.2)).toBe('warning'); expect(paceTone(0.12)).toBe('serious');
    setRules({ paceBehind: 25, paceFarBehind: 50, paceAhead: 20 });
    expect(paceBand(-0.2)).toBe('ok'); expect(paceBand(-0.35)).toBe('behind'); expect(paceBand(0.12)).toBe('ok');
  });
  it('stricter rules give more flags, looser rules fewer — on the same data', () => {
    const base = attention(fresh(), T);
    setRules({ paceBehind: 1, paceFarBehind: 2, paceAhead: 1, lineOver: 0, lineCritical: 0, staleDays: 30 });
    const strict = attention(fresh(), T);
    setRules({ paceBehind: 90, paceFarBehind: 95, paceAhead: 90, lineOver: 100, lineCritical: 200, staleDays: 730 });
    const loose = attention(fresh(), T);
    expect(strict.length).toBeGreaterThan(base.length);
    expect(loose.length).toBeLessThan(base.length);
    expect(loose.some((f) => f.kind === 'underspend' || f.kind === 'overspend' || f.kind === 'stale')).toBe(false);
    // every project whose gap is past the default threshold is flagged under the defaults
    setRules(undefined);
    for (const p of P) if (!p.datesTbc && (!p.status || p.status === 'Active') && burnGap(p, T) > 0.1) expect(base.some((f) => f.projectId === p.id && f.kind === 'overspend')).toBe(true);
  });
  it('alert windows and the close follow the rules', () => {
    const count = (kind: string) => alerts(fresh(), T).filter((a) => a.kind === kind).length;
    const ending = count('ending'), contract = count('contract');
    setRules({ endingDays: 730, renewalDays: 365 });
    expect(count('ending')).toBeGreaterThanOrEqual(ending); expect(count('contract')).toBeGreaterThanOrEqual(contract);
    setRules({ endingDays: 14, renewalDays: 7 });
    expect(count('ending')).toBeLessThanOrEqual(ending); expect(count('contract')).toBeLessThanOrEqual(contract);
    setRules({ freshDays: 15 });
    const tight = closeRows(fresh(), T).filter((r) => r.report && !r.report.fresh).length;
    setRules({ freshDays: 370 });
    const wide = closeRows(fresh(), T).filter((r) => r.report && !r.report.fresh).length;
    expect(tight).toBeGreaterThanOrEqual(wide);
  });
});
