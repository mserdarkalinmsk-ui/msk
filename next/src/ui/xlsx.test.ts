import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { excelDate, readXlsx } from './xlsx';

describe('xlsx', () => {
  it('reads sheets, shared strings, numbers, blanks and sparse cells', async () => {
    const b = readFileSync('tests/fixtures/budget.xlsx');
    const wb = await readXlsx(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
    expect(wb.sheets).toEqual(['Summary', 'Budget']);
    const R = wb.read('Budget');
    expect(R[0]).toEqual(['Code', 'Description', 'Approved', 'Actual', 'Committed']);
    expect(R[1]).toEqual(['1', 'Staff & "salaries" <core>', '1860000', '812345.5', '40000']);
    expect(R[2][3]).toBe('');
    expect(R.find((r) => r[6] === 'sparse')).toBeTruthy();
    const eq = R.find((r) => r[1] === 'Equipment')!;
    expect(excelDate(+eq[2])).toBe('2026-03-31');
    expect(eq[3]).toBe('TRUE');
    expect(wb.read()[0][0]).toBe('ignore me');
  });
  it('rejects non-zip input', async () => {
    await expect(readXlsx(new TextEncoder().encode('hello').buffer)).rejects.toThrow(/xlsx/);
  });
});
