import { describe, expect, it } from 'vitest';
import { changesSince } from './changes';

const po = (po: string, supplier: string, status = 'OPEN', balance = 100) => ({ po, line: '5.7', description: '', nature: '', supplier, amount: 100, spent: 100 - balance, balance, sc: 100, status, date: '2026-01-01', units: null, unitType: '' });
const proj = (actual: number, pos: object[], reports = ['r1']) => ({ id: 'a', code: 'A', name: 'A', country: 'tr', start: '2025-01-01', end: '2027-01-01', budget: 1000,
  reportingPeriods: reports.map((id, i) => ({ id, name: id, type: 'x', date: `2026-0${i + 1}-28`, snapshot: { lines: [{ code: '1', approved: 1000, actual }], workbook: { pos, lines: [], totals: {} } } })) }) as never;
describe('what changed', () => {
  it('finds spending, new reports, new and closed POs and new suppliers', () => {
    const old = { countries: [], projects: [proj(100, [po('1', 'FLAP'), po('2', 'SERENAS')])] } as never;
    const now = { countries: [], projects: [proj(250, [po('1', 'FLAP', 'CLOSED', 0), po('2', 'SERENAS'), po('3', 'ENTERKON')], ['r1', 'r2'])] } as never;
    const C = changesSince(old, now, '2026-01-15');
    expect(C.spent).toBe(150); expect(C.newPOs).toBe(1); expect(C.newSuppliers).toEqual(['ENTERKON']);
    expect(C.projects[0].reports).toEqual(['r2']); expect(C.projects[0].closedPOs.map((x) => x.po)).toEqual(['1']);
  });
});
