import { describe, expect, it } from 'vitest';
import X from '../fixtures/extraction.json';
import B from '../fixtures/budget.json';
import { lines, money } from './calc';
import { approvedBudget } from './documents';
import { importReview } from './importReview';
import { snapshotOf } from './intake';
import { normalizeProject } from './normalize';
import type { Project, ReportingPeriod } from './types';
import { parseWorkbook } from './workbook';

const sheets = (J: Record<string, string[][]>) => Object.entries(J).map(([name, R]) => ({ name, R }));
const ab = approvedBudget({ name: 'JP 4555 Budget.xlsx', kind: 'xlsx', paragraphs: [], tables: Object.values(B as Record<string, string[][]>) })!;
const base = { id: 'p', code: 'BH5260', name: 'Roma', country: 'tr', start: '2026-07-01', end: '2029-07-01', budget: ab.total, bh: '5260', approvedBudget: ab } as unknown as Project;
const wb = parseWorkbook(sheets(X as Record<string, string[][]>));
const report = (id: string, date: string, w = wb): ReportingPeriod => ({ id, name: `Extraction ${date}`, type: 'Interim report', date, snapshot: snapshotOf(w, base, 'x.xlsx') });

describe('import preview: line by line', () => {
  it('a first report has nothing to compare with', () => {
    const R = importReview(base, report('a', '2026-09-30'));
    expect(R.compared).toBe(false); expect(R.lines).toEqual([]); expect(R.pos).toEqual([]);
  });
  it('the same file again changes no line and no purchase order', () => {
    const p = { ...base, reportingPeriods: [report('a', '2026-09-30')] } as Project;
    const R = importReview(p, report('b', '2026-10-31'));
    expect(R.compared).toBe(true); expect(R.lines).toEqual([]); expect(R.pos).toEqual([]);
    expect(R.after.spent).toBeCloseTo(R.before.spent, 2);
  });
  it('lists the lines that move and the changes add up to the change in spent', () => {
    // The file on record misses the postings of two lines: importing the full file brings them in.
    const E = wb.entries ?? [], codes = [...new Set(E.map((e) => e.line))].filter((c) => c && c !== '10').slice(0, 2);
    expect(codes.length).toBe(2);
    const less = parseWorkbook(sheets(X as Record<string, string[][]>));
    const old = { ...less, entries: (less.entries ?? []).filter((e) => !codes.includes(e.line)), lines: less.lines.map((l) => (codes.includes(l.code) ? { ...l, actual: { ...l.actual, cost: 0 }, sc: 0 } : l)), pos: less.pos.filter((x) => !codes.includes(x.line)) };
    const p = normalizeProject({ ...base, reportingPeriods: [report('a', '2026-09-30', old as typeof wb)] } as Project);
    const R = importReview(p, report('b', '2026-10-31'));
    const now = normalizeProject({ ...base, reportingPeriods: [report('b', '2026-10-31')] } as Project);
    expect(R.after.spent).toBeCloseTo(money(now).spent, 2);
    const moved = R.lines.filter((l) => Math.abs(l.dSpent) > 0.5);
    expect(moved.length).toBeGreaterThan(0);
    // Administrative costs follow the direct costs (7%), so they move too: every moved line is in the list.
    expect(moved.reduce((a, l) => a + l.dSpent, 0)).toBeCloseTo(R.after.spent - R.before.spent, 0);
    for (const l of moved) expect(l.spent).toBeCloseTo(lines(now).find((x) => x.code === l.code)!.actual ?? 0, 2);
    expect(R.lines[0]).toMatchObject({ code: expect.any(String) });
    if (wb.pos.some((x) => codes.includes(x.line))) expect(R.pos.some((x) => x.kind === 'new')).toBe(true);
  });
});

describe('import preview: payments of a PO split over several lines', () => {
  it('raise no warning when every payment sits on the line the PO records it on', () => {
    const R = importReview(base, report('a', '2026-09-30'));
    expect(R.issues.some((i) => /could not all be tied/.test(i.text))).toBe(false);
  });
  it('warn when payments cannot be tied to the line they were made from', () => {
    const po = (line: string, spent: number) => ({ po: 'X1', line, description: 'Event', nature: '', supplier: 'S', amount: spent, spent, balance: 0, sc: spent, status: 'OPEN', date: '2026-08-01', units: null, unitType: '' });
    const inv = { date: '2026-08-10', period: 'AUG-26', src: 'invoice' as const, doc: 'I1', po: 'X1', line: '5.7', account: '6185', description: 'Event', detail: 'Invoice', supplier: 'S', amount: 140, posted: true };
    const w2 = { ...wb, pos: [...wb.pos, po('5.7', 100), po('2.2', 50)], entries: [...(wb.entries ?? []), inv] };
    const R = importReview(base, report('a', '2026-09-30', w2 as typeof wb));
    expect(R.issues.some((i) => /could not all be tied.*X1/.test(i.text))).toBe(true);
  });
});
