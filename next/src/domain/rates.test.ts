import { describe, expect, it } from 'vitest';
import { averageRate, revisedRate, standardRate } from './rates';

const L = (description: string, unit: string, actual: number, reportedUnits: number) => ({ code: 'x', description, unit, actual, reportedUnits }) as never;

describe('revised unit rates', () => {
  it('treats per diems, fees and salaries as tariff lines', () => {
    expect(standardRate({ description: 'International per diem', unit: 'per diem' })).toBe(true);
    expect(standardRate({ description: 'Expert fees', unit: 'day' })).toBe(true);
    expect(standardRate({ description: 'International travel', unit: 'return flight' })).toBe(false);
  });
  it('never averages a tariff line', () => {
    expect(averageRate(L('Local per diem', 'per diem', 4200, 45))).toBeUndefined();
    expect(averageRate(L('International travel', 'flight', 2700, 4))).toBe(675);
  });
  it('keeps the approved rate on decreases and tariffs, averages increased market lines', () => {
    expect(revisedRate(L('Local per diem', 'per diem', 4200, 45), 195, true)).toEqual({ rate: 195, basis: 'approved' });
    expect(revisedRate(L('International travel', 'flight', 2700, 4), 1369.5, false)).toEqual({ rate: 1369.5, basis: 'approved' });
    expect(revisedRate(L('International travel', 'flight', 2700, 4), 1369.5, true)).toEqual({ rate: 675, basis: 'average' });
  });
});
