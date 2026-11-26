import { describe, expect, it } from 'vitest';
import { projectYear, projectYearOf, projectYears } from './calc';

describe('project years', () => {
  it('count from the start date: 12 Jul 2024 → 11 Jul 2025 is year 1', () => {
    expect(projectYearOf('2024-07-12', '2024-07-12')).toBe(1);
    expect(projectYearOf('2024-07-12', '2025-07-11')).toBe(1);
    expect(projectYearOf('2025-07-12', '2025-07-12')).toBe(1);
    expect(projectYearOf('2024-07-12', '2025-07-12')).toBe(2);
    expect(projectYearOf('2024-07-12', '2026-10-14')).toBe(3);
    expect(projectYearOf('2024-07-12', '2024-01-01')).toBe(1);
  });
  it('give each year its first and last day; the last year stops at the end date', () => {
    expect(projectYear('2024-07-12', 1)).toMatchObject({ from: '2024-07-12', to: '2025-07-11', label: 'Year 1' });
    expect(projectYears('2024-07-12', '2027-01-11').map((y) => [y.from, y.to])).toEqual([['2024-07-12', '2025-07-11'], ['2025-07-12', '2026-07-11'], ['2026-07-12', '2027-01-11']]);
    expect(projectYears('2026-01-01', '2027-06-30').length).toBe(2);
  });
});
