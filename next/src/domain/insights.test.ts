import { describe, expect, it } from 'vitest';
import { workbook } from '../ui/xlsxwrite';
import { readXlsx } from '../ui/xlsx';
import { alerts, changes, migrateBackup, status, outcome, scenario } from './insights';
import type { Project } from './types';

const rep = (date: string, actual: number, approved = 1000) => ({ id: date, name: date, type: 'Interim', date, snapshot: { lines: [{ code: '1', description: 'Staff', approved, actual, committed: 0 }, { code: '2', description: 'Travel', approved: 1000, actual: 0, committed: 0 }] } });
const P: Project = { id: 'a', code: 'A', name: 'Alpha', country: 'x', start: '2025-01-01', end: '2026-12-31', budget: 2000, reportingPeriods: [rep('2025-06-30', 200), rep('2025-12-31', 400)] };
const today = new Date('2026-01-01T00:00:00Z');

describe('insights', () => {
  it('projects end-of-project use from the recent rate', () => {
    const o = outcome(P, today);
    expect(o.basis).toBe('recent rate');
    expect(o.rate).toBeGreaterThan(30); expect(o.rate).toBeLessThan(36); // 200 over ~6 months
    expect(o.projected).toBeGreaterThan(780); expect(o.projected).toBeLessThan(820);
    expect(o.unused).toBeCloseTo(2000 - o.projected, 0);
  });
  it('flags low forecast use and writes a narrative', () => {
    expect(alerts([P], today).some((a) => a.kind === 'forecast' && a.severity === 'serious')).toBe(true);
    const S = status(P, today);
    expect(S.headline).toBe('20% spent at 50% of time');
    expect(S.verdict).toBe('Behind schedule');
    expect(S.points.find((x) => x.area === 'Forecast')!.head).toMatch(/of budget used at end/);
  });
  it('a short catch-up period does not explode the forecast', () => {
    const Q: Project = { ...P, reportingPeriods: [rep('2025-06-30', 200), rep('2025-12-31', 400), { ...rep('2026-01-31', 900), id: 'x' }] };
    const o = outcome(Q, new Date('2026-02-01T00:00:00Z'));
    expect(o.basis).toBe('average rate');
    expect(o.utilisation).toBeLessThan(1.1);
  });
  it('compares the latest report with the previous one or a chosen date', () => {
    expect(changes([P])[0].spent).toEqual([200, 400]);
    expect(changes([P], '2025-01-01')[0].note).toContain('first report');
  });
  it('scenario balances and flags lines', () => {
    const s = scenario(P, { '1': -700, '2': 500 });
    expect(s.net).toBe(-200); expect(s.balanced).toBe(false);
    expect(s.rows[0].flag).toBe('below spent + committed'); // 300 < 400 spent
    expect(s.rows[1].flag).toMatch(/above 10%/);
    expect(scenario(P, { '1': 50, '2': -50 }).balanced).toBe(true);
  });
  it('unwraps a backup from the previous app', () => {
    const m = migrateBackup({ app: 'Portfolio Ledger', state: { projects: [P], countries: [], log: [{ at: '2025-01-01T10:00:00Z', msg: 'Edited' }] } });
    expect(m.from).toBe('previous app');
    expect((m.ledger as { audit: unknown[] }).audit).toEqual([{ at: '2025-01-01T10:00:00Z', message: 'Edited' }]);
    expect(migrateBackup({ projects: [] }).from).toBe('current');
  });
});

describe('xlsx writer', () => {
  it('writes a workbook the reader can open', async () => {
    const b = workbook([{ name: 'Lines', money: [1], rows: [['Code', 'Amount', 'Note'], ['1.1', 1234.5, 'a & <b>'], ['2', 0, null]] }, { name: 'Two', rows: [['x']] }]);
    const wb = await readXlsx(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer);
    expect(wb.sheets).toEqual(['Lines', 'Two']);
    expect(wb.read('Lines')[1]).toEqual(['1.1', '1234.5', 'a & <b>']);
  });
});

describe('budget headings', () => {
  it('flags a heading moved beyond the flexibility ceiling', async () => {
    const { headings } = await import('./insights');
    const base = { lines: [{ code: '1.1', approved: 1000 }, { code: '2.1', approved: 1000 }], direct: 2000, admin: 0, contingency: 0, total: 2000, source: 'b.pdf', linesSum: 2000 };
    const Q: Project = { ...P, approvedBudget: base, reportingPeriods: [{ id: 'r', name: 'r', type: 'Interim', date: '2025-12-31', snapshot: { lines: [{ code: '1.1', approved: 1300, actual: 100 }, { code: '2.1', approved: 700, actual: 0 }] } }] };
    const H = headings(Q);
    expect(H.flex).toBe(0.25);
    expect(H.rows.map((r) => [r.code, r.status])).toEqual([['1', 'breach'], ['2', 'breach']]);
    expect(alerts([Q], today).some((a) => a.id.includes(':heading:1'))).toBe(true);
  });
});

describe('readiness & placeholder dates', () => {
  it('scores the project file and keeps set-up projects out of pacing', async () => {
    const { readiness } = await import('./insights');
    const T: Project = { id: 't', code: 'BH1', name: 'New', country: 'tr', start: '2025-01-01', end: '2027-12-31', budget: 0, bh: '1', datesTbc: true };
    expect(readiness(T).items.find((i) => i.key === 'dates')!.done).toBe(false);
    expect(readiness(P).score).toBeGreaterThan(readiness(T).score);
    const A = alerts([T], today);
    expect(A.map((a) => a.kind)).toEqual(['setup']);
  });
});
