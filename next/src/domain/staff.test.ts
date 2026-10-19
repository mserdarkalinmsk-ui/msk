import { describe, expect, it } from 'vitest';
import type { Project } from './types';
import { classify, coverage, displayName, dmy, extractStaff, renewals, roster, type StaffRecord } from './staff';

const T = new Date('2026-10-11T00:00:00Z');
const PO = {
  name: 'Purchase Orders', R: [
    ['Purchase orders report'],
    ['Reporting line', 'Description PO', 'PO number', 'Spent in EUR', 'Spent and committed in EUR'],
    ['1.1.1.4', 'Yilmaz, Ayse - Project officer from 01/01/2026 to 31/12/2026 100%', '4500123', '30 000,00', '40000'],
    ['1.2.1.2', 'Martin, Claire Anne - PM HQ from 01.03.2025 to 28.02.2027 50 %', '4500124', '12000', '20000'],
    ['1.1.1.7', 'Unclear description without person', '4500125', '', ''],
    ['2.1', 'Travel - not staff', '4500126', '', ''],
    ['1.1.1.6', 'Demir, Can - Finance assistant', '4500127', '', ''],
  ],
};
const GROUPS = { name: 'Budget', R: [['1.1 Local staff (Ankara)'], ['1.2 Staff HQ Strasbourg']] };

describe('staff extraction', () => {
  const { records } = extractStaff([GROUPS, PO]);
  it('reads contracts with names, dates, FTE and base', () => {
    const a = records.find((r) => r.name === 'Yilmaz, Ayse')!;
    expect(a).toMatchObject({ code: '1.1.1.4', position: 'Project officer', start: '2026-01-01', end: '2026-12-31', fte: 1, base: 'Local', po: '4500123', review: false });
    expect(a.actual).toBe(30000);
    expect(records.find((r) => r.name === 'Martin, Claire Anne')).toMatchObject({ base: 'HQ', fte: 0.5, end: '2027-02-28' });
  });
  it('flags rows it cannot read and skips non-staff lines', () => {
    expect(records.filter((r) => !r.name)).toHaveLength(1);
    expect(records.some((r) => r.code === '2.1')).toBe(false);
    expect(records.find((r) => r.name === 'Demir, Can')!.review).toBe(true);
  });
  it('helpers', () => {
    expect(dmy('31/02/2026')).toBe('');
    expect(displayName('Doe, Jane')).toBe('Jane Doe');
    expect(classify('1.3.1.1').base).toBe('Unassigned');
  });
});

describe('roster', () => {
  const rec = (x: Partial<StaffRecord>): StaffRecord => ({ code: '1.1.1.4', position: 'Project officer', recordKind: 'Contract', base: 'Local', ...x });
  const p = {
    id: 'p', code: 'P', name: 'P', country: 'tr', start: '2025-01-01', end: '2027-12-31', budget: 1,
    reportingPeriods: [
      { id: 'a', name: 'R1', type: 'Q', date: '2025-06-30', snapshot: { lines: [], staffRecords: [rec({ name: 'Doe, Jane', po: '1', start: '2025-01-01', end: '2025-12-31', fte: 1 })] } },
      { id: 'b', name: 'R2', type: 'Q', date: '2026-06-30', snapshot: { lines: [], staffRecords: [
        rec({ name: 'Doe, Jane', po: '2', start: '2026-01-01', end: '2026-11-30', fte: 1 }),
        rec({ name: 'Roe, Rick', code: '1.2.1.2', base: 'HQ', po: '3', start: '2027-01-01', end: '2027-12-31', fte: 0.5 }),
        rec({ name: 'Poe, Pat', po: '4', review: true }),
      ] } },
    ],
    staffOverrides: {} as Record<string, unknown>,
  } as unknown as Project;
  it('merges contracts per person and derives status', () => {
    const R = roster(p, T);
    expect(R.map((x) => [x.display, x.status])).toEqual([['Jane Doe', 'Active'], ['Pat Poe', 'Dates missing'], ['Rick Roe', 'Upcoming']]);
    const jane = R[0];
    expect(jane.contracts).toHaveLength(2); expect(jane.end).toBe('2026-11-30');
    expect(R[1].review).toBe(true);
    expect(renewals(R, T, 60).map((x) => x.display)).toEqual(['Jane Doe']);
  });
  it('verified overrides win and leave dates cut contracts short', () => {
    (p as unknown as { staffOverrides: Record<string, unknown> }).staffOverrides = { 'poepat|1.1.1.4': { verified: true, start: '2026-01-01', end: '2026-12-31', fte: 0.8 }, 'doejane|1.1.1.4': { leaveDate: '2026-10-01' } };
    const R = roster(p, T);
    expect(R.find((x) => x.display === 'Pat Poe')).toMatchObject({ status: 'Active', fte: 0.8, review: false });
    expect(R.find((x) => x.display === 'Jane Doe')!.status).toBe('Ended');
  });
  it('coverage counts people per month by base', () => {
    const C = coverage(roster({ ...p, staffOverrides: {} } as Project, T), new Date('2026-10-01T00:00:00Z'), 4);
    expect(C.map((c) => c.Local)).toEqual([1, 1, 0, 0]);
    expect(C[3].HQ).toBe(1);
  });
});

describe('names read from GL texts', () => {
  it('drops day counts before the name and merges a typo in the first name', async () => {
    const { cleanGlName, roster } = await import('./staff');
    expect(cleanGlName('JS TUNER,Arzu Bursu')).toBe('TUNER,Arzu Bursu');
    expect(cleanGlName('16 JS TUNER,Arzu Burcu')).toBe('TUNER,Arzu Burcu');
    const rec = (name: string, po: string) => ({ name, code: '1.1.1.2', position: 'Project manager', po, recordKind: 'Payroll observation' as const });
    const p = { id: 'x', code: 'X', name: 'X', country: 'tr', start: '2024-01-01', end: '2029-01-01', budget: 1, reportingPeriods: [{ id: 'r', name: 'r', type: 'x', date: '2026-06-30',
      snapshot: { lines: [], staffRecords: [rec('TUNER,Arzu Burcu', 'GL 1'), rec('TUNER,Arzu Burcu', 'GL 2'), rec('JS TUNER,Arzu Bursu', 'GL 3'), rec('TUNER,Mehmet', 'GL 4')] } }] };
    const R = roster(p as never, new Date('2026-10-01'));
    expect(R.map((x) => x.display).sort()).toEqual(['Arzu Burcu TUNER', 'Mehmet TUNER']);
    expect(R.find((x) => x.display === 'Arzu Burcu TUNER')!.contracts).toHaveLength(3);
  });
});
