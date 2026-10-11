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

describe('approved budget', () => {
  it('reads the budget-for-all-years table and keeps admin costs', async () => {
    const { approvedBudget } = await import('./documents');
    const T = [
      ['Description', 'Unit', '# of units', 'Unit rate', 'Cost'],
      ['1.1.1.1 Senior project manager', 'Per month'],
      ['1.1.1.2 Project manager (100%)', 'Per month', '60', '5,850', '351,000', '12', '5,850', '70,200'],
      ['2.1 International travel', 'Per return flight', '142', '650', '92,300'],
      ['5.4 Evaluation costs', 'Per item', '1', '50,000', '50,000'],
      ['Sub-total 1 Human resources', '351,000'],
      ['7. Sub-total Direct eligible costs of the action (1+2+3+4+5+6)', '493,300', '70,200'],
      ['10. Administrative costs (maximum 7% of 9. Total direct eligible costs of the action)', '34,531', '4,914'],
    ];
    const B = approvedBudget({ name: 'b.pdf', kind: 'pdf', paragraphs: [], tables: [T] })!;
    expect(B.lines.map((l) => [l.code, l.approvedUnits, l.unitRate, l.approved])).toEqual([['1.1.1.2', 60, 5850, 351000], ['2.1', 142, 650, 92300], ['5.4', 1, 50000, 50000], ['10', undefined, undefined, 34531]]);
    expect(B.direct).toBe(493300); expect(B.linesSum).toBe(493300); expect(B.total).toBe(527831);
  });
});

describe('budget annex notes & logframe', () => {
  it('reads clarification and justification per line', async () => {
    const { budgetNotes } = await import('./documents');
    const T = [['Description', 'Unit', 'Clarification of the budget items', 'Justification of the estimated costs'], ['1 Human resources'], ['1.1.1.2 Project manager (100%)', 'Per month', 'PM in charge of overall management', '1 full-time manager in Ankara for 60 months']];
    expect(budgetNotes({ name: 'j.pdf', kind: 'pdf', paragraphs: [], tables: [T] })).toEqual({ '1.1.1.2': { description: 'Project manager (100%)', unit: 'Per month', clarification: 'PM in charge of overall management', justification: '1 full-time manager in Ankara for 60 months' } });
  });
  it('keeps logframe levels and assumptions', async () => {
    const { indicators } = await import('./documents');
    const T = [['Results chain', 'Indicators', 'Baselines', 'Targets', 'Sources of data', 'Assumptions'], ['Specific objective: better teaching', 'Share of trained teachers', '0', '60%', 'Survey', 'Ministry commitment'], ['', 'Number of modules', '0', '10', 'Reports', '']];
    const I = indicators({ name: 'l.docx', kind: 'docx', paragraphs: [], tables: [T] });
    expect(I.map((x) => [x.level, x.indicator, x.target, x.assumptions])).toEqual([['Outcome', 'Share of trained teachers', '60%', 'Ministry commitment'], ['Outcome', 'Number of modules', '10', 'Ministry commitment']]);
  });
  it('reads EU contribution agreement wording', async () => {
    const { contractFacts } = await import('./documents');
    const f = contractFacts({ name: 'c.pdf', kind: 'pdf', tables: [], paragraphs: ['CONTRIBUTION AGREEMENT N° 700001964', 'The implementation period of this Contribution Agreement is 60 months from the 12/07/2024.', 'The pre-financing rate is 30 %.', 'a variation (as the case may be in cumulative terms) of 15 % or less of the amount originally entered', 'progress reports shall be submitted within sixty (60) Days after the period'] });
    expect([f.number, f.months, f.start, f.end, f.prefinancing, f.flexPct, f.progDays]).toEqual(['700001964', 60, '2024-07-12', '2029-07-11', 30, 15, 60]);
  });
});
