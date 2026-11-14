import { describe, expect, it } from 'vitest';
import { auditSheets } from './audit';

describe('audit pack', () => {
  it('ties each line to its purchase orders and shows what POs do not cover', () => {
    const po = (po: string, line: string, sc: number) => ({ po, line, description: 'x', nature: '', supplier: 'S', amount: sc, spent: sc, balance: 0, sc, status: 'OPEN', date: '2026-03-01', units: null, unitType: '' });
    const p = { id: 'a', code: 'A', name: 'A', country: 'tr', start: '2025-01-01', end: '2027-01-01', budget: 1, reportingPeriods: [{ id: 'r', name: 'R1', type: 'Interim', date: '2026-03-31', snapshot: { lines: [{ code: '5.7', description: 'Conferences', approved: 1000, actual: 700, spentCommitted: 900 }, { code: '1.1.1', description: 'Staff', approved: 2000, actual: 500, spentCommitted: 500 }], workbook: { pos: [po('1', '5.7', 600), po('2', '5.7', 200)], lines: [], totals: {} } } }] } as never;
    const S = auditSheets(p, new Date('2026-04-01'));
    const lines = S.find((x) => x.name === 'Lines')!.rows;
    const r57 = lines.find((r) => r[0] === '5.7')!;
    expect(r57[10]).toBe(2); expect(r57[11]).toBe(800); expect(r57[12]).toBe(100);
    expect(lines.find((r) => r[0] === '1.1.1')![12]).toBe(500);
    expect(S.find((x) => x.name === 'POs by line')!.rows.length).toBe(3);
  });
});
