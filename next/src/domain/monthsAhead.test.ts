import { describe, expect, it } from 'vitest';
import { monthEnds, monthsAhead } from './monthsAhead';

const T = (s: string) => Date.parse(s + 'T00:00:00Z');
const H = [
  { code: '1', label: 'Human resources', budget: 1000, exposure: 400, rate: 100 },
  { code: '2', label: 'Travel', budget: 500, exposure: 600, rate: 10 },
  { code: '3', label: 'Equipment', budget: 1000, exposure: 0, rate: 0 },
];

describe('month by month ahead', () => {
  it('lists the calendar months up to the end date', () => {
    const m = monthEnds(T('2026-11-16'), T('2027-02-10'));
    expect(m.map((x) => x.key)).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
    expect(m.at(-1)!.t).toBe(T('2027-02-10'));
  });
  it('adds the monthly pace to spent + committed and flags the month a heading passes its budget and flexibility', () => {
    const a = monthsAhead(H, T('2026-01-01'), T('2027-01-01'), { flex: 0.25 });
    const hr = a.heads[0];
    expect(hr.cells[0].sc).toBeGreaterThan(400);
    expect(hr.end.sc).toBeCloseTo(400 + 100 * 12, -1);
    expect(hr.notify).toBe('2026-07');
    expect(hr.addendum).toBe('2026-09');
    expect(a.heads[1].notify).toBe('now');
    expect(a.heads[2].notify).toBeNull();
    expect(a.total.end).toBeCloseTo(a.heads.reduce((s, h) => s + h.end.sc, 0), 2);
  });
  it('a slip pauses spending; a slower pace spends less', () => {
    const base = monthsAhead(H, T('2026-01-01'), T('2027-01-01'));
    const slip = monthsAhead(H, T('2026-01-01'), T('2027-01-01'), { slip: 3 });
    const slow = monthsAhead(H, T('2026-01-01'), T('2027-01-01'), { pace: 0.5 });
    expect(slip.heads[0].cells[1].sc).toBe(400);
    expect(slip.heads[0].end.sc).toBeCloseTo(base.heads[0].end.sc - 300, -1);
    expect(slow.heads[0].end.sc).toBeLessThan(base.heads[0].end.sc);
  });
  it('an ended project has no months ahead', () => {
    expect(monthsAhead(H, T('2027-02-01'), T('2027-01-01')).months).toEqual([]);
  });
});
