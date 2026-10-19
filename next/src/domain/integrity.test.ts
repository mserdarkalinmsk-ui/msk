import { describe, expect, it } from 'vitest';
import { integrity } from './integrity';
import type { Project } from './types';

const L = (code: string, actual: number, sc: number) => ({ code, description: code, approved: 100_000, actual, spentCommitted: sc });
const po = (no: string, line: string, sc: number) => ({ po: no, line, description: '', nature: '', supplier: 'S', amount: sc, spent: 0, balance: 0, sc, status: '', date: '2026-01-01', units: null, unitType: '' });
const p = { id: 'a', code: 'BH1', name: 'P', country: 'tr', start: '2025-01-01', end: '2027-12-31', budget: 1,
  reportingPeriods: [
    { id: 'r1', name: 'R1', type: 'x', date: '2025-12-31', snapshot: { lines: [L('5.7', 40_000, 50_000), L('5.8', 10_000, 10_000)] } },
    { id: 'r2', name: 'R2', type: 'x', date: '2026-06-30', snapshot: { lines: [L('5.7', 30_000, 60_000), L('5.8', 12_000, 11_000)],
      staffRecords: [{ name: 'TUNER,Arzu Burcu', code: '1.1.1.2', position: 'PM', po: 'GL 1' }, { name: 'TUNER,Arzu Bursu', code: '1.1.1.3', position: 'PO', po: 'GL 2' }],
      workbook: { pos: [po('900001', '5.7', 70_000), po('900002', '5.7', 1_000), po('900002', '5.8', 1_000)] } } },
  ] } as unknown as Project;

describe('integrity checks', () => {
  it('flags the cross-checks with where to look', () => {
    const t = integrity(p, new Date('2026-10-01')).map((x) => `${x.where}: ${x.text}`).join('\n');
    expect(t).toMatch(/900002: 5\.7 \/ 5\.8/);
    expect(t).toMatch(/above the reported spent \+ committed on 5\.7/);
    expect(t).toMatch(/Spent above spent \+ committed on 5\.8/);
    expect(t).toMatch(/Spent goes down/);
    expect(t).toMatch(/same person under two names: Arzu Burcu TUNER \/ Arzu Bursu TUNER|same person under two names: Arzu Bursu TUNER \/ Arzu Burcu TUNER/);
  });
});
