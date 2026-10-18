import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readXlsx } from '../ui/xlsx';
import { parseWorkbook, periodMonth, toBudgetLines, toDay } from './workbook';

async function load() {
  const b = readFileSync('tests/fixtures/coe-report.xlsx');
  const x = await readXlsx(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  return parseWorkbook(x.sheets.map((n) => ({ name: n, R: x.read(n) })));
}

describe('CoE financial report workbook', () => {
  it('reads identifiers and periods', async () => {
    const wb = await load();
    expect(wb.meta).toMatchObject({ contract: '700009999', jp: '9999', bh: '9001', periodFrom: '2025-10-01', periodTo: '2026-09-30', asAt: '2026-09-30', plannedFrom: '2026-10-01', plannedTo: '2027-09-30', situationDate: '2026-09-30', situationPeriod: 'SEP-26' });
    expect(wb.meta.title).toBe('Demo Rights Programme');
  });
  it('reads lines with units, rates, forecast and proposal', async () => {
    const wb = await load();
    const pm = wb.lines.find((l) => l.code === '1.1.1.2')!;
    expect(pm).toMatchObject({ leaf: true, unit: 'Per month', budget: { units: 36, rate: 5000, cost: 180000 }, actual: { units: 9, rate: 6000, cost: 54000 }, sc: 60000, planned: { units: 12, rate: 6000, cost: 72000 } });
    expect(pm.rounded!.cost).toBe(126000);
    expect(wb.lines.find((l) => l.code === '1.1.1')!.leaf).toBe(false);
    expect(wb.totals.direct).toMatchObject({ budget: 398000, actual: 85080, sc: 91080, planned: 118120 });
    expect(wb.totals.admin!.budget).toBeCloseTo(27860);
  });
  it('reads accounts, POs, postings, funding and staff', async () => {
    const wb = await load();
    expect(wb.situation).toHaveLength(2);
    expect(wb.pos).toHaveLength(3);
    expect(wb.pos.filter((p) => p.status === 'OPEN').reduce((s, p) => s + p.balance, 0)).toBe(27000);
    expect(wb.monthly).toEqual([{ month: '2026-01', invoices: 6000, gl: 5000 }, { month: '2026-02', invoices: 6000, gl: 8000 }, { month: '2026-03', invoices: 20000, gl: 0 }]);
    expect(wb.movements.filter((m) => m.funding).map((m) => m.amount)).toEqual([400000]);
    const doe = wb.staff.find((s) => s.name === 'DOE,Jane')!;
    expect(doe).toMatchObject({ start: '2026-01-01', end: '2026-12-31', fte: 1, base: 'Local' });
  });
  it('reconciles and flags issues', async () => {
    const wb = await load();
    const t = wb.checks.map((c) => `${c.level}:${c.text}`);
    expect(t.some((x) => x.startsWith('info:Budget lines add up'))).toBe(true);
    expect(t.some((x) => x.startsWith('info:Administrative costs are 7%'))).toBe(true);
    expect(t.some((x) => /1\.1\.1\.2.*unit rate.*20% above/.test(x))).toBe(true);
    expect(t).toContain('info:Open PO balances match PO commitments in the accounts (€27,000.00 vs €30,000.00)'.replace('info', 'warning'));
  });
  it('converts to app budget lines with administrative costs as line 10', async () => {
    const L = toBudgetLines(await load());
    expect(L.map((l) => l.code)).toEqual(['1.1.1.2', '1.1.1.4', '2.1', '5.7', '10']);
    expect(L.reduce((s, l) => s + l.approved, 0)).toBeCloseTo(398000 * 1.07);
  });
  it('date helpers', () => {
    expect(periodMonth('JUL-26')).toBe('2026-07');
    expect(toDay('45565')).toBe('2024-09-30');
    expect(toDay('31/12/2026')).toBe('2026-12-31');
  });
});
