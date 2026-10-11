import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import seed from '../data/seed.json';
import { readXlsx } from '../ui/xlsx';
import type { Ledger } from './types';
import { parseWorkbook } from './workbook';
import { applyPlans, guessSector, plan } from './autoimport';

const L = seed as unknown as Ledger;
async function wb() {
  const b = readFileSync('tests/fixtures/coe-report.xlsx');
  const x = await readXlsx(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  return parseWorkbook(x.sheets.map((n) => ({ name: n, R: x.read(n) })));
}

describe('automatic import', () => {
  it('creates a project from an unmatched workbook', async () => {
    const P = plan(await wb(), 'coe.xlsx', L);
    expect(P.match).toBeUndefined();
    expect(P.project).toMatchObject({ code: 'JP9999', name: 'Demo Rights Programme', bh: '9001', contractNo: '700009999', start: '2025-10-01', end: '2027-09-30', sector: 'Human Rights' });
    expect(P.project.budget).toBeCloseTo(398000 * 1.07);
    expect(P.problems.some((x) => /Country/.test(x))).toBe(true);
    const N = applyPlans(L, [P]);
    expect(N.projects).toHaveLength(L.projects.length + 1);
    expect(N.projects.at(-1)!.reportingPeriods![0].snapshot!.workbook!.meta.bh).toBe('9001');
  });
  it('updates the project with the same budget head and replaces a same-date report', async () => {
    const W = await wb();
    const L2: Ledger = { ...L, projects: L.projects.map((p) => (p.id === 'msk' ? { ...p, bh: '9001' } : p)) };
    const P = plan(W, 'coe.xlsx', L2);
    expect(P.matchedBy).toBe('budget head');
    const N = applyPlans(L2, [P]);
    const msk = N.projects.find((p) => p.id === 'msk')!;
    expect(msk.contractNo).toBe('700009999');
    expect(msk.budget).toBeCloseTo(398000 * 1.07);
    const again = applyPlans(N, [plan(W, 'coe.xlsx', N)]);
    expect(again.projects.find((p) => p.id === 'msk')!.reportingPeriods!.length).toBe(msk.reportingPeriods!.length);
  });
  it('guesses sectors from titles', () => {
    expect(guessSector('Strengthening the judiciary in Georgia')).toBe('Rule of Law');
    expect(guessSector('Youth participation in local democracy')).toBe('Democracy');
    expect(guessSector('Enhancing foreign language education')).toBe('Human Rights');
  });
});
