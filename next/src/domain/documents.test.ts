import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readDocx, readPdf } from '../ui/docread';
import { readXlsx } from '../ui/xlsx';
import { amount, analyse, anyDate } from './documents';

const buf = (f: string) => { const b = readFileSync('tests/fixtures/' + f); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };

describe('project documents', () => {
  it('Word DoA: dates, action plan with preparation/implementation months, risks, indicators', async () => {
    const F = analyse(await readDocx(buf('doa.docx'), 'doa.docx'));
    expect(F.contract).toMatchObject({ title: 'Demo Rights Programme for Testing', months: 24, start: '2026-03-01', end: '2028-02-29' });
    expect(F.acts.map((a) => [a.code, a.group, a.P, a.E])).toEqual([
      ['1.1', 'Output 1: Laws reviewed', [1, 2], [3, 4]], ['1.2', 'Output 1: Laws reviewed', [], [3, 4, 5]], ['2.1', 'Output 2: Capacity built', [], [4, 5, 6]],
    ]);
    expect(F.risks.map((r) => [r.title, r.likelihood, r.impact])).toEqual([['Staff turnover', '4', '3'], ['Political change', '2', '5']]);
    expect(F.indicators.map((i) => [i.result, i.indicator, i.target])).toEqual([['Outcome 1', 'Number of laws aligned', '3'], ['Outcome 1', 'Judges trained', '200']]);
  });
  it('PDF contract: number, amounts, share, period, reporting', async () => {
    const F = analyse(await readPdf(buf('contract.pdf'), 'contract.pdf'));
    expect(F.contract).toMatchObject({ number: '700008888', total: 2500000, euMax: 2250000, euShare: 90, months: 24, start: '2026-03-01', repMonths: 12, progDays: 60, prefinancing: 30 });
  });
  it('Excel workplan with calendar-month columns', async () => {
    const wb = await readXlsx(buf('plan.xlsx'));
    const F = analyse({ name: 'plan.xlsx', kind: 'xlsx', paragraphs: [], tables: wb.sheets.map((s) => wb.read(s)) });
    expect(F.acts.map((a) => [a.code, a.name, a.E])).toEqual([['1.1', 'Kick-off', [1]], ['1.2', 'Survey', [2, 3]]]);
    expect(F.planMonths).toBe(4);
  });
  it('helpers', () => {
    expect(amount('EUR 2 500 000')).toBe(2500000);
    expect(amount('1.234.567,50')).toBe(1234567.5);
    expect(amount('5,580,000')).toBe(5580000);
    expect(anyDate('on 15 January 2025')).toBe('2025-01-15');
  });
});
