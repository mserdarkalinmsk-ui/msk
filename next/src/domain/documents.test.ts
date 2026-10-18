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

describe('justification PDF', () => {
  it('assigns wrapped, vertically centred cell text to the right line', async () => {
    const { readFileSync } = await import('node:fs');
    const { readPdf } = await import('../ui/docread');
    const b = readFileSync('tests/fixtures/justification.pdf');
    const d = await readPdf(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), 'justification.pdf');
    const N = d.notes!;
    expect(Object.keys(N).slice(0, 4)).toEqual(['1.1.1.2', '1.1.1.3', '1.1.1.4', '1.1.1.7']);
    expect(N['1.1.1.2'].clarification).toMatch(/^PM in charge of overall management .* 4\.3\.2\.$/);
    expect(N['1.1.1.2'].justification).toMatch(/^1 full-time manager in Ankara for 60 months\. .*various factors\.$/);
    expect(N['1.1.1.3'].clarification).toMatch(/^SPO assists the PM/);
    expect(N['1.1.1.3'].justification).toBe('1 full-time officer for 48 months.');
    expect(N['1.1.1.4'].clarification).toBe('PO organises activities.');
    expect(N['1.1.1.7'].description).toBe('Project assistant (2 persons: 1 PA 100%, 1 PA 80%)');
    expect(N['1.1.1.7'].justification).toMatch(/^Grade B2\./);
  }, 20000);
});

describe('justification PDF running headers', () => {
  it('keeps page headers and page numbers out of the cells', async () => {
    const { readFileSync } = await import('node:fs');
    const { readPdf } = await import('../ui/docread');
    const b = readFileSync('tests/fixtures/justification.pdf');
    const d = await readPdf(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), 'justification.pdf');
    const all = Object.values(d.notes!).map((n) => n.clarification + ' ' + n.justification).join(' ');
    expect(Object.keys(d.notes!).length).toBe(12);
    expect(all).not.toMatch(/Demo Rights Programme|Contract n°/);
  }, 20000);
});

describe('narrative risks', () => {
  it('reads bulleted risks with ratings, assumptions and mitigation across a page break', async () => {
    const { narrativeRisks } = await import('./documents');
    const paragraphs = ['4.9 Sustainability: risk analysis and assumptions', 'The assumptions are as follows:', '- There is commitment at all levels to improve the quality of education based on the CEFR', 'and CEFR Companion Volume (2020).', '- All stakeholders collaborate closely; and', '- In-house know-how and/or staff with necessary competencies are available.',
      'The risks are as follows:', '- Workload of the beneficiary (low).', '- Contradicting interests between different institutions (medium).', '40', '- Any pandemic, similar to the Covid-19 may cause additional limitations imposed by', 'national authorities, pose a potential risk to face-to-face meetings (medium).', '- Other natural disasters, such as an earthquake (low).',
      'Mitigation measures are as follows:', '• High-level discussions in the framework of the Türkiye-EU dialogue.', '• regular consultations between the CoE and Turkish authorities.', 'As regards the risk related to the spread of Covid-19, during the initial phase'];
    const N = narrativeRisks({ name: 'doa.pdf', kind: 'pdf', paragraphs, tables: [] });
    expect(N.assumptions).toEqual(['There is commitment at all levels to improve the quality of education based on the CEFR and CEFR Companion Volume (2020).', 'All stakeholders collaborate closely', 'In-house know-how and/or staff with necessary competencies are available.']);
    expect(N.risks.map((r) => [r.title, r.likelihood, r.category])).toEqual([
      ['Workload of the beneficiary', '2', 'Operational'], ['Contradicting interests between different institutions', '3', 'Institutional'],
      ['Any pandemic, similar to the Covid-19 may cause additional limitations imposed by national authorities, pose a potential risk to face-to-face meetings', '3', 'External'], ['Other natural disasters, such as an earthquake', '2', 'External']]);
    expect(N.mitigation.length).toBe(2);
  });
});

import { contractFacts as cf2 } from './documents';
describe('payment terms', () => {
  it('reads the first payment, the instalments and the threshold for the next payment', () => {
    const doc = { paragraphs: ['The pre-financing rate is 40 %.', 'The first pre-financing payment of EUR 1.200.000 shall be paid within 30 days.', 'The contribution will be paid in three instalments.', 'A further payment may be requested when at least 70 % of the previous payment has been used.'], tables: [] } as never;
    const f = cf2(doc);
    expect(f.prefinancing).toBe(40); expect(f.firstPayment).toBe(1200000); expect(f.instalments).toBe(3); expect(f.payThreshold).toBe(70);
  });
});
