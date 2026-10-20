import { describe, expect, it } from 'vitest';
import { againstOriginal, budgetVersions } from './budgetVersions';
import { letterFacts } from './letters';

const s = (R: (string | number | null)[][]) => R.map((r) => r.map((c) => (c == null ? '' : String(c))));
// Original and Notification No:4 side by side, with year blocks (left out) — the CFCU revision layout.
const sheet = s([
  ['Annex III. Budget for the Action', 'Budget All Years', null, null, null, 'Year 1', null, null, null, 'Notification No:4', 'Budget All Years'],
  ['Costs', 'Unit', '# of units', 'Unit Value (in EUR)', 'Total Cost (in EUR)', 'Unit', '# of units', 'Unit rate', 'Cost', 'Costs', 'Unit', '# of units', 'Unit Value (in EUR)', 'Total Cost (in EUR)'],
  ['1. Human Resources'],
  ['   1.1.2.1 Local short-term consultant', 'Per day', 765, 200, 153000, 'Per day', 220, 200, 44000, '   1.1.2.1 Local short-term consultant', 'Per day', 797, 200, 159400],
  ['2. Travel'],
  ['  2.1. International travel', 'Per flight', 331, 650, 215150, 'Per flight', 100, 650, 65000, '  2.1. International travel', 'Per flight', 321, 650, 208650],
  ['5. Other costs, services'],
  ['5.7 Costs of conferences/seminars', 'Per event', 300, 4811.95, 1443585, null, null, null, null, '5.7 Costs of conferences/seminars', 'Per event', 300, 4811.95, 1443685],
  ['7. Subtotal Direct eligible costs of the action (1-6)', null, null, null, 1811735, null, null, null, null, '7. Subtotal Direct eligible costs of the action (1-6)', null, null, null, 1811735],
  ['8.  Indirect costs (maximum 7%)', null, null, 0.07, 126821.45, null, null, null, null, '8.  Indirect costs (maximum 7%)', null, null, 0.07, 126821.45],
  ['11. Total eligible costs (9+10)', null, null, null, 1938556.45, null, null, null, null, '11. Total eligible costs (9+10)', null, null, null, 1938556.45],
]);

describe('budget versions in a revision workbook', () => {
  it('reads the original and the notification, leaves the year blocks out, the last one is in force', () => {
    const V = budgetVersions([sheet], 'Budget_Revised.xlsx');
    expect(V.map((v) => [v.label, v.kind, v.no])).toEqual([['Original budget', 'original', undefined], ['Notification No. 4', 'notification', 4]]);
    expect(V[1].budget.lines.find((l) => l.code === '1.1.2.1')).toMatchObject({ approvedUnits: 797, unitRate: 200, approved: 159400 });
    expect(V[1].budget).toMatchObject({ direct: 1811735, admin: 126821.45, total: 1938556.45 });
    expect(againstOriginal(V).find((h) => h.code === '2')?.pct).toBeCloseTo(-0.0302, 3);
  });
});

describe('notification and addendum letters', () => {
  it('a letter with text: kind, number, date, reference and outcome', () => {
    const L = letterFacts({ name: 'Notification_No.4.pdf', kind: 'pdf', tables: [], paragraphs: ['No: 26758377/370.02/4176 24.06.2020', 'Subject: TR2015/RL/04/A3.3-01/001- Strengthening Democratic Culture in Basic Education (Notifications No. 4)', 'Dear Ms. Başpınar,', 'your notification concerning "modifications in the budget" is hereby recorded by the Contracting Authority'] });
    expect(L).toMatchObject({ kind: 'notification', no: 4, date: '2020-06-24', ref: 'TR2015/RL/04/A3.3-01/001', outcome: 'recorded', scanned: false });
  });
  it('a scanned letter gives its kind and number from the file name', () => {
    expect(letterFacts({ name: 'Notification_No.4.pdf', kind: 'pdf', tables: [], paragraphs: [] })).toMatchObject({ kind: 'notification', no: 4 });
    expect(letterFacts({ name: 'Addendum_No_1_Strengthening_sgn.pdf', kind: 'pdf', tables: [], paragraphs: [] })).toMatchObject({ kind: 'addendum', no: 1, scanned: true });
  });
});
