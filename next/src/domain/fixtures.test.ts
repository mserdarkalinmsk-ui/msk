import { describe, expect, it } from 'vitest';
import X from '../fixtures/extraction.json';
import B from '../fixtures/budget.json';
import OP from '../fixtures/office-plan.json';
import OR from '../fixtures/office-raw.json';
import { parseWorkbook } from './workbook';
import { approvedBudget } from './documents';
import { enrichExtraction } from './extraction';
import { readCheck, snapshotOf } from './intake';
import { readOffice } from './office';
import type { Project } from './types';

// Real files (BH 5260 system extraction, JP 4555 budget, Ankara office reports) with names and descriptions replaced.
// The figures must stay exactly what the source systems show.
const sheets = (J: Record<string, string[][]>) => Object.entries(J).map(([name, R]) => ({ name, R }));
const xl = (J: Record<string, string[][]>) => ({ sheets: Object.keys(J), read: (n?: string) => J[n ?? Object.keys(J)[0]] });

describe('real files', () => {
  const ab = approvedBudget({ name: 'JP 4555 Budget.xlsx', kind: 'xlsx', paragraphs: [], tables: Object.values(B as Record<string, string[][]>) })!;
  const p = { id: 'p', code: 'BH5260', name: 'Roma', country: 'tr', start: '2026-07-01', end: '2029-07-01', budget: ab.total, bh: '5260', approvedBudget: ab } as unknown as Project;
  const wb = parseWorkbook(sheets(X as Record<string, string[][]>));

  it('reads the JP 4555 budget', () => {
    expect(Math.round(ab.total)).toBe(2223000);
    expect(Math.round(ab.direct)).toBe(2077570);
    expect(Math.round(ab.admin)).toBe(145430);
    expect(ab.names?.['1.1.1']).toBeTruthy();
  });
  it('reads the BH 5260 extraction and every euro lands on a line', () => {
    expect(wb.meta).toMatchObject({ bh: '5260', extraction: true });
    const r = readCheck(wb, p);
    expect(r.blocking).toBe(false);
    expect(Math.round(r.spent)).toBe(69485);
    expect(Math.round(r.sc)).toBe(113264);
    const L = snapshotOf(wb, p).lines;
    expect(L.find((l) => l.code === '1.1.1.3')?.approved).toBe(141696);
    expect(L.every((l) => (l.approved ?? 0) > 0 || /^10$|\.0$/.test(l.code) || (l.description ?? "").includes('not in the approved budget'))).toBe(true);
  });
  it('shows the extraction as a full statement with the same totals as the system', () => {
    const T = enrichExtraction(wb, p).totals;
    expect([Math.round(T.direct!.budget), Math.round(T.direct!.actual), Math.round(T.direct!.sc)]).toEqual([2077570, 27330, 71109]);
    expect([Math.round(T.admin!.budget), Math.round(T.admin!.actual)]).toEqual([145430, 42155]);
  });
  it('reads the Ankara office reports (ordinary budget and LS & Pagoda)', () => {
    const plan = readOffice(xl(OP as Record<string, string[][]>), 'b.xlsx');
    const sum = (k: 'ob' | 'ls', f: 'budget' | 'sc') => Math.round(plan.lines.reduce((a, l) => a + l[k][f], 0));
    expect([sum('ob', 'budget'), sum('ob', 'sc'), sum('ls', 'budget'), sum('ls', 'sc')]).toEqual([78400, 59677, 110000, 58024]);
    const raw = readOffice(xl(OR as Record<string, string[][]>), 'a.xlsx', plan);
    expect(raw.hasPlan).toBe(false);
    expect(raw.lines.length).toBeGreaterThan(0);
  });
});

describe('budget source', () => {
  it('a budget table in a DoA does not replace a budget workbook', async () => {
    const { applyFindings } = await import('./applydocs');
    const xl = { lines: [], direct: 2, admin: 0, contingency: 0, total: 2, source: 'JP 4555 Budget.xlsx', linesSum: 2 };
    const doa = { ...xl, total: 3, source: 'Description of the Action.docx' };
    const p = { id: 'p', code: 'P', name: 'P', country: 'tr', start: '2026-01-01', end: '2027-01-01', budget: 2, approvedBudget: xl } as unknown as Project;
    const all = { notes: true, approved: true, contract: true, dates: true, budget: true, plan: true, risks: true, indicators: true };
    const F = { contract: {}, acts: [], risks: [], indicators: [], summary: [] };
    expect(applyFindings(p, { ...F, budget: doa }, all, []).approvedBudget?.total).toBe(2);
    expect(applyFindings({ ...p, approvedBudget: doa }, { ...F, budget: xl }, all, []).approvedBudget?.total).toBe(2);
  });
});

describe('data check', () => {
  it('checks a system extraction entry by entry and offers one-click fixes', async () => {
    const { health, applyFix } = await import('./health');
    const ab = approvedBudget({ name: 'JP 4555 Budget.xlsx', kind: 'xlsx', paragraphs: [], tables: Object.values(B as Record<string, string[][]>) })!;
    const wb = parseWorkbook(sheets(X as Record<string, string[][]>));
    const base = { id: 'p', code: 'BH5260', name: 'Roma', country: 'tr', start: '2026-07-01', end: '2029-07-01', budget: 3118001, bh: '5260', approvedBudget: ab } as unknown as Project;
    const rep = (id: string, at: string) => ({ id, name: id, type: 'x', date: '2026-09-21', registeredAt: at, snapshot: snapshotOf(wb, base) });
    const p = { ...base, reportingPeriods: [rep('old', '2026-10-01'), rep('new', '2026-10-02')], documents: [{ name: 'B.xlsx', kind: 'xlsx', importedAt: '1', summary: [] }, { name: 'B (1).xlsx', kind: 'xlsx', importedAt: '2', summary: [] }] } as Project;
    const F = health(p, new Date('2026-10-12')).findings;
    expect(F.some((f) => f.level === 'ok' && /System extraction: Spent/.test(f.text))).toBe(true);
    expect(F.some((f) => /Direct-cost total row/.test(f.text))).toBe(false);
    expect(applyFix(p, 'use-approved').p.budget).toBe(2223000);
    const r = applyFix(p, 'dedupe-reports');
    expect(r.p.reportingPeriods!.map((x) => x.id)).toEqual(['new']);
    expect(applyFix(p, 'dedupe-docs').p.documents!.map((d) => d.name)).toEqual(['B (1).xlsx']);
  });
});
