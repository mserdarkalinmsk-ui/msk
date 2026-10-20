import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readXlsx } from '../ui/xlsx';
import { docType, formatKey } from './doctype';
import { parseWorkbook, toBudgetLines } from './workbook';

const S = (R: (string | number | null)[][]) => [{ name: 'Budget', R: R.map((r) => r.map((c) => (c == null ? '' : String(c)))) }];
// VC budget proposal layout: all years + secured block, sub-totals, no actual block.
const proposal = (cost57 = 400623.44) => S([
  ['VC 4552 Budget proposal'],
  [null, null, 'Budget for all Years', null, null, 'Secured budget (500K)'],
  ['Description', 'Unit', '# of units', 'Unit rate (in EUR)', 'Cost (in EUR)', '# of units', 'Unit rate (in EUR)', 'Cost (in EUR)'],
  ['1 Human resources'],
  ['1.1.3 Local short-term consultant', 'Per day', 52, 200, 10400, 31, 200, 6200],
  ['1.2.3 International short-term consultant', 'Per day', 9, 500, 4500, 9, 500, 4500],
  ['Sub-total 1 Human resources', null, null, null, 14900, null, null, 10700],
  ['5 Other costs, services'],
  ['5.2 Studies/research', 'Per item', 1, 15000, 15000, 1, 15000, 15000],
  ['5.7 Cost of conferences/seminars', 'Per event', 18, 22256.8578, cost57, 10, 18872.972, 188729.72],
  ['Sub-total 5 Other costs, services', null, null, null, 415623.44, null, null, 203729.72],
]);
// Interim report layout: budget + actual + S&C.
const interim = S([
  ['Interim financial report covering period from 01/10/2025 to 30/09/2026'],
  [null, null, 'Budget for all years', null, null, 'Actual expenditure as at 30/09/2026', null, null, 'Spent and committed'],
  ['Description', 'Unit', '# of units', 'Unit rate', 'Cost', '# of units', 'Unit rate', 'Cost', 'EUR'],
  ['1.1.3 Local short-term consultant', 'Per day', 52, 200, 10400, 20, 200, 4000, 5000],
  ['2.1 International travel', 'Per return flight', 24, 700, 16800, 10, 700, 7000, 7000],
  ['5.2 Studies/research', 'Per item', 1, 15000, 15000, 1, 9000, 9000, 15000],
]);

describe('document type', () => {
  it('a proposal with a secured block is a budget, not a report', () => {
    const wb = parseWorkbook(proposal()), d = docType(wb);
    expect(d).toMatchObject({ kind: 'proposal', type: 'Latest Approved Budget', sure: true });
    expect(d.why.join(' ')).toMatch(/secured/);
    expect(wb.meta.blocks?.map((b) => b.role)).toEqual(['budget', 'secured']);
  });
  it('an interim report is read as one, with its period', () => {
    const wb = parseWorkbook(interim);
    expect(docType(wb)).toMatchObject({ kind: 'interim', type: 'Interim Financial Report', sure: true });
    expect(wb.meta.blocks?.map((b) => b.role)).toEqual(['budget', 'actual', 'sc']);
  });
  it('a final report is recognised by its heading', () => {
    const R = interim.map((s) => ({ ...s, R: [['Final financial report covering the period from 01/10/2024 to 30/09/2026'], ...s.R.slice(1)] }));
    expect(docType(parseWorkbook(R)).kind).toBe('final');
  });
});

describe('arithmetic of the grid', () => {
  it('passes a file that adds up', () => {
    const c = parseWorkbook(proposal()).checks;
    expect(c.some((x) => /Arithmetic re-done: \d+ units × rate = cost, 2 sub-totals/.test(x.text))).toBe(true);
    expect(c.filter((x) => x.level === 'warning' && /add up|×/.test(x.text))).toEqual([]);
  });
  it('points to the row of a line that does not add up, and to its sub-total', () => {
    const c = parseWorkbook(proposal(401000)).checks.map((x) => x.text);
    expect(c.some((t) => /^5\.7 \(Budget, row 10\): budget 18 × €22,256\.86 = €400,623\.44, the file says €401,000\.00/.test(t))).toBe(true);
    expect(c.some((t) => /^Sub-total 5 \(Budget, row 11\)/.test(t))).toBe(true);
  });
});

describe('corrections by hand', () => {
  it('a block set by hand is read that way (secured → actual, or ignored)', () => {
    const wb0 = parseWorkbook(proposal()), key = wb0.meta.blocks![1].key;
    const asActual = parseWorkbook(proposal(), { roles: { [key]: 'actual' } });
    expect(toBudgetLines(asActual).reduce((a, l) => a + l.actual, 0)).toBeCloseTo(214429.72, 2);
    expect(asActual.meta.blocks![1]).toMatchObject({ role: 'actual', byHand: true });
    const ignored = parseWorkbook(proposal(), { roles: { [key]: 'ignore' } });
    expect(ignored.meta.secured).toBeUndefined();
    expect(toBudgetLines(ignored).reduce((a, l) => a + l.actual, 0)).toBe(0);
    // the format key does not change with the corrections, so they are found again
    expect(formatKey(asActual)).toBe(formatKey(wb0));
  });
  it('an unnamed second block is not taken as spending once it is set to "not used"', () => {
    const R = S([['x'], [null, null, 'Budget for all years', null, null, 'Option B'], ['Description', 'Unit', '# of units', 'Unit rate', 'Cost', '# of units', 'Unit rate', 'Cost'],
      ['1.1.3 Consultant', 'Per day', 10, 200, 2000, 5, 200, 1000], ['2.1 Travel', 'Per trip', 2, 700, 1400, 1, 700, 700], ['5.2 Study', 'Per item', 1, 900, 900, 1, 900, 900]]);
    const wb = parseWorkbook(R);
    expect(wb.meta.blocks![1]).toMatchObject({ label: 'Option B', role: 'actual' });
    const fixed = parseWorkbook(R, { roles: { [wb.meta.blocks![1].key]: 'ignore' } });
    expect(docType(fixed).kind).toBe('proposal');
  });
});

describe('real report formats keep reading the same', () => {
  it('the CoE report fixture: blocks, type and arithmetic', async () => {
    const b = readFileSync('tests/fixtures/coe-report.xlsx'), x = await readXlsx(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
    const wb = parseWorkbook(x.sheets.map((n) => ({ name: n, R: x.read(n) })));
    expect(docType(wb).kind).toBe('interim');
    expect(wb.meta.blocks?.map((b) => b.role)).toContain('actual');
    expect(wb.lines.every((l) => l.row && l.row > 1)).toBe(true);
  });
});
