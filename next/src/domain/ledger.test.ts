import { describe, expect, it } from 'vitest';
import { parseWorkbook } from './workbook';
import { findErrors, spendBetween } from './ledger';
import { organisedSheets } from './organised';
import type { Project } from './types';

const PO_H = ['Budget', 'Budget Head', 'Nature', 'Reporting line', 'Unit Type', 'Nbre of Units', 'PO Number', 'Description PO', 'Description PO Line', 'PO Amount in EUR', 'Spent in EUR', 'Balance on PO in EUR', 'Spent and Committed in EUR', 'Closure Status', 'Supplier', 'Encumbered Date'];
const INV_H = ['Budget', 'Nature', 'Date GL', 'Period', 'Invoice No', 'Description', 'Posted Flag', 'Montant Ligne', '', 'Montant Engagé €', 'Numero PO'];
const GL_H = ['Budget', 'Nature', 'Reporting Line', 'Unit Type', 'Nbre of Units', 'GL Number', 'Description', 'Line Description', 'SPENT €', 'Period', 'Accounting Date', 'Posting Flag'];
const sheets = [
  { name: 'Purchase Orders', R: [['All Purchase Orders'], PO_H,
    ['0189', '5260', '622000004', '5.5.2', 'Per day', '2', '900001', 'Interpretation workshop', 'Interpretation', '1000', '1000', '0', '1000', 'CLOSED', 'ENTERKON', '2026-01-10'],
    ['0189', '5260', '618500100', '5.7', 'Per contract', '1', '900002', 'Event management conference', 'Contracts', '10000', '12000', '0', '12000', 'CLOSED', 'EVENTCO', '2026-02-01'],
    ['0189', '5260', '640210000', '1.1.1', 'Per month', '12', '900003', 'DOE,Jane - B2 - from 01/01/2026 to 31/12/2028', 'Personnel', '30000', '5000', '25000', '30000', 'OPEN', 'PAIE', '2026-01-01']] },
  { name: 'Factures a date', R: [['Factures'], INV_H,
    ['0189', '622000004', '2026-01-31', 'JAN-26', 'A1', 'Interp', 'Y', '1000', '', '1000', '900001'],
    ['0189', '618500100', '2026-02-28', 'FEB-26', 'B1', 'Event', 'Y', '6000', '', '6000', '900002'],
    ['0189', '618500100', '2026-02-28', 'FEB-26', 'B2', 'Event', 'Y', '6000', '', '6000', '900002'],
    ['0189', '640210000', '2026-03-31', 'MAR-26', 'S1', 'Salary', 'N', '5000', '', '5000', '900003']] },
  { name: 'Ecriture GL', R: [['Ecriture GL'], GL_H,
    ['0189', '681000012', '0', '0', '0', '1', 'TRANCHE ET PRELEV 7% EU', '', '700', 'JAN-26', '2026-01-05', 'Y'],
    ['0189', '640110000', '9.9', 'Per month', '1', '2', 'PAIE PERM BH5048 vers BH5260', 'X', '300', 'APR-26', '2026-04-30', 'Y'],
    ['0189', '622000004', '5.5.2', 'Per day', '1', '3', 'Interp regul', '', '80', 'MAY-26', '2026-05-02', 'Y'],
    ['0189', '622000004', '5.5.2', 'Per day', '1', '4', 'Interp regul', '', '80', 'MAY-26', '2026-05-03', 'Y'],
    ['0189', '622000004', '5.5.2', 'Per day', '1', '5', 'Interp regul', '', '80', 'MAY-26', '2026-05-04', 'Y'],
    ['0189', '622000004', '5.5.2', 'Per day', '1', '6', 'Interp regul', '', '80', 'MAY-26', '2026-05-05', 'Y'],
    ['0189', '622000004', '5.5.2', 'Per day', '1', '7', 'Interp regul', '', '80', 'MAY-26', '2026-05-06', 'Y'],
    ['0189', '622000004', '5.5.2', 'Per day', '1', '8', 'Interp regul', '', '80', 'MAY-26', '2026-05-07', 'Y'],
    ['0189', '622000004', '1.1.1', 'Per month', '1', '9', 'Interp on salary line', '', '400', 'JUN-26', '2026-06-30', 'Y'],
    ['0189', '640110000', '1.1.1', 'Per month', '1', '10', 'Late salary', '', '200', 'AUG-27', '2027-08-31', 'Y']] },
];
const budget = [{ code: '1.1.1', description: 'Expert', unit: 'month' }, { code: '5.5.2', description: 'Interpretation', unit: 'day' }, { code: '5.7', description: 'Events', unit: 'contract' }];

describe('dated ledger of a system extraction', () => {
  const wb = parseWorkbook(sheets);
  it('keeps every invoice (line and supplier from its PO) and GL entry with its date', () => {
    const E = wb.entries!;
    expect(E).toHaveLength(14);
    expect(E.find((e) => e.doc === 'B1')).toMatchObject({ src: 'invoice', line: '5.7', supplier: 'EVENTCO', date: '2026-02-28', amount: 6000 });
    expect(E.find((e) => e.doc === 'S1')!.posted).toBe(false);
  });
  it('sums what was spent between two dates by line and month', () => {
    const R = spendBetween(wb.entries!, '2026-02-01', '2026-03-31', budget);
    expect(R.total).toBe(17000);
    expect(R.lines.map((l) => [l.line, l.description, l.amount])).toEqual([['1.1.1', 'Expert', 5000], ['5.7', 'Events', 12000]]);
    expect(R.months).toEqual([{ month: '2026-02', amount: 12000 }, { month: '2026-03', amount: 5000 }]);
    expect(spendBetween(wb.entries!, '', '').total).toBe(wb.entries!.reduce((a, e) => a + e.amount, 0));
  });
  it('finds the entries that look entered in error, and does not flag split POs', () => {
    const F = findErrors(wb.entries!, { budget, start: '2026-01-01', end: '2027-06-30', bh: '5260', pos: wb.pos });
    const k = (kind: string) => F.filter((f) => f.kind === kind);
    expect(k('not-in-budget')[0]).toMatchObject({ level: 'error', amount: 300 });
    expect(k('duplicate')[0].rows.map((r) => r.doc)).toEqual(['B1 (PO 900002)', 'B2 (PO 900002)']);
    expect(k('po-over')[0].rows[0]).toMatchObject({ doc: 'PO 900002', amount: 2000 });
    expect(k('wrong-line')[0].rows[0]).toMatchObject({ line: '1.1.1', amount: 400 });
    expect(k('outside-dates')[0].rows[0].date).toBe('2027-08-31');
    expect(k('unposted')).toHaveLength(1);
    expect(k('other-bh')[0].rows).toHaveLength(1);
    expect(k('contract-beyond')[0].rows[0].doc).toBe('PO 900003');
    expect(F.find((f) => f.kind === 'no-line')).toMatchObject({ level: 'info', title: 'Levies on tranches', amount: 700 });
    expect(F[0].level).toBe('error');
  });
  it('lays the extraction out as a tidy workbook, with the chosen range', () => {
    const p = { id: 'p', code: 'JP1', name: 'Test', start: '2026-01-01', end: '2027-06-30', bh: '5260' } as unknown as Project;
    const S = organisedSheets(p, { ...wb, fileName: 'x.xlsx' }, { from: '2026-02-01', to: '2026-03-31' });
    expect(S.map((s) => s.name)).toEqual(['Summary', 'Selected period', 'Statement', 'Postings', 'By month', 'Purchase orders', 'Checks']);
    expect(S.find((s) => s.name === 'Postings')!.rows).toHaveLength(15);
    const tot = S.find((s) => s.name === 'Selected period')!.rows.find((r) => (r[0] as { v?: string })?.v === 'Total')!;
    expect((tot[4] as { v: number }).v).toBe(17000);
  });
});

describe('against the approved budget', () => {
  it('compares lines and headings, with the 25% flexibility', async () => {
    const { compareBudget, findErrors } = await import('./ledger');
    const wb = parseWorkbook(sheets);
    const B = [{ code: '1.1.1', description: 'Expert', approved: 30000 }, { code: '5.5.2', description: 'Interp', approved: 2000 }, { code: '5.7', description: 'Events', approved: 8000 }];
    const sc = new Map([['1.1.1', 30600], ['5.5.2', 1480], ['5.7', 12000]]);
    const C = compareBudget(wb.entries!, B, sc, '2026-02-01', '2026-02-28');
    expect(C.lines.map((l) => [l.code, l.inRange, l.status])).toEqual([['1.1.1', 0, 'over'], ['5.5.2', 0, 'ok'], ['5.7', 12000, 'over']]);
    expect(C.heads.map((h) => [h.h, h.status])).toEqual([['1', 'within-flex'], ['5', 'over-flex']]);
    const F = findErrors(wb.entries!, { budget: B, sc });
    expect(F[0]).toMatchObject({ kind: 'head-over', level: 'error' });
    expect(F.find((f) => f.kind === 'line-over')!.rows).toHaveLength(2);
  });
});
