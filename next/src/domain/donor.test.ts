import { describe, expect, it } from 'vitest';
import { donorLedger } from './donor';
import type { Ledger } from './types';

const wb = {
  meta: {}, lines: [], totals: {}, situation: [], monthly: [], sheets: [], checks: [],
  pos: [
    { po: '1', line: '1.1.1.2', description: 'ALPHA, One - Project manager from 01/01/2026 to 31/12/2026 50 %', nature: '', supplier: 'ALPHA One', amount: 100, spent: 50, balance: 50, sc: 100, status: '', date: '2026-01-01', units: 12, unitType: 'month' },
    { po: '2', line: '3.1', description: 'Venue for workshop', nature: '', supplier: 'Venue Ltd', amount: 10, spent: 10, balance: 0, sc: 10, status: '', date: '2026-02-01', units: 1, unitType: 'event' },
  ],
  entries: [
    { date: '2026-03-31', period: '2026-03', src: 'gl', doc: 'g1', po: '', line: '1.2.1.1', account: '', description: 'BETA Two salary March', detail: 'BETA', supplier: 'BETA Two', amount: 40, posted: true },
    { date: '2026-03-31', period: '2026-03', src: 'invoice', doc: 'i1', po: '2', line: '3.1', account: '', description: 'Venue invoice', detail: '', supplier: 'Venue Ltd', amount: 10, posted: true },
  ],
  movements: [{ article: '1.1.1.2', period: '2026-03', date: '2026-03-31', amount: 40, description: 'ALPHA One payroll', funding: false }],
};
const L = {
  countries: [{ id: 'tr', name: 'Country' }],
  offices: [{ id: 'o', name: 'Office', country: 'tr', reports: [] }],
  audit: [{ at: '2026-01-01', message: 'x' }],
  projects: [{
    id: 'lang', code: 'TR-LANG', name: 'Project', country: 'tr', start: '2025-01-01', end: '2027-12-31', budget: 1000,
    staffOverrides: { 'alphaone|1.1.1.2': { note: 'GAMMA Three leaves in May', verified: true } },
    reportingPeriods: [{ id: 'r1', name: 'Report', type: 'interim', date: '2026-03-31', snapshot: {
      lines: [{ code: '1.1.1.2', description: 'Project manager', approved: 100, actual: 50 }],
      staffRecords: [{ name: 'ALPHA, One', code: '1.1.1.2', position: 'Project manager' }], staffGroups: {}, workbook: wb,
    } }],
  }],
} as unknown as Ledger;

describe('donor version of a shared copy', () => {
  const D = donorLedger(L), text = JSON.stringify(D);
  it('names no staff member anywhere', () => {
    for (const n of ['ALPHA', 'alphaone', 'BETA', 'GAMMA']) expect(text).not.toContain(n);
  });
  it('drops offices, history and contract corrections', () => {
    expect(D.offices).toBeUndefined();
    expect(D.audit).toEqual([]);
    expect(D.projects[0].staffOverrides).toBeUndefined();
  });
  it('keeps the figures and the non-staff lines as they are', () => {
    const w = D.projects[0].reportingPeriods![0].snapshot!.workbook!;
    expect(w.pos.map((x) => [x.line, x.amount, x.spent, x.units])).toEqual(wb.pos.map((x) => [x.line, x.amount, x.spent, x.units]));
    expect(w.pos[1].description).toBe('Venue for workshop');
    expect(w.entries!.map((x) => x.amount)).toEqual([40, 10]);
    expect(w.entries![1].supplier).toBe('Venue Ltd');
    expect(D.projects[0].reportingPeriods![0].snapshot!.lines).toEqual(L.projects[0].reportingPeriods![0].snapshot!.lines);
  });
});
