import { describe, expect, it } from 'vitest';
import { isOfficeWorkbook, officeView, readOffice } from './office';

const sheets: Record<string, string[][]> = {
  'Situation Budgetaire': [['Situation Budgétaire'], ['DATE=17/04/2026 BH=0127'], ['Budget : 0101  BO Budget Ordinaire'], ['CCM: 00901   Bureau ANKARA'], ['Budget Head: 0127   External Presence'],
    ['Total Budget Head : 0127', '', '1000', '', '0', '', '200', '', '0', '', '300', '', '500', '']],
  forecast: [['Council of Europe  Ankara Programme Office', 'Situation as of 17.04.2026'],
    ['', '', 'Total 2026 Approved Ordinary Budget', 'Total 2026 LS Pagoda', 'Spent and Commited 2026 Ordinary Budget', 'The planned expenditures from 18.04.26 to 31.12.2026', 'Letfover', 'Spent and Commited 2026 LS & Pagoda', 'The planned expenditures from 18.04.26', 'Leftover', 'Explanations'],
    ['1 - Rent and related charges'], ['1.1', 'Rent', '100', '1000', '0', '50', '', '400', '500', '', 'rent note'], ['1.2', 'Insurance', '400', '', '500', '0'],
    ['2 - Consumables'], ['2.1', 'Supplies', '500', '', '100', '600'], ['TOTAL BUDGET:', '', '1000']],
};
const wb = { sheets: Object.keys(sheets), read: (n?: string) => sheets[n ?? 'forecast'] };

describe('office budget', () => {
  it('reads the office forecast, the system situation and flags lines', () => {
    expect(isOfficeWorkbook(wb)).toBe(true);
    const r = readOffice(wb, 'f.xlsx');
    expect(r).toMatchObject({ office: 'Ankara Programme Office', date: '2026-04-17', ccm: '00901', bh: '0127', hasPlan: true });
    expect(r.situation).toMatchObject({ budget: 1000, po: 200, actual: 300, available: 500 });
    expect(r.lines.map((l) => [l.code, l.heading, l.ob.budget, l.ob.sc, l.ob.planned, l.ls.budget, l.ls.sc])).toEqual([
      ['1.1', '1 Rent and related charges', 100, 0, 50, 1000, 400], ['1.2', '1 Rent and related charges', 400, 500, 0, 0, 0], ['2.1', '2 Consumables', 500, 100, 600, 0, 0]]);
    const V = officeView(r);
    expect(V.lines.map((l) => l.flag)).toEqual([undefined, 'over budget', 'plan exceeds budget']);
    expect(V.T.ob).toMatchObject({ budget: 1000, sc: 600, planned: 650, left: -250 });
  });
});
