import { describe, expect, it } from 'vitest';
import { parseAmount, parseCSV, parseDay } from './csv';

describe('csv', () => {
  it('handles quotes, escaped quotes, CRLF and semicolons', () => {
    expect(parseCSV('a,b\r\n"x, y","say ""hi"""\n')).toEqual([['a', 'b'], ['x, y', 'say "hi"']]);
    expect(parseCSV('﻿a;b\n1;2')).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('parses amounts in EU and US formats', () => {
    expect(parseAmount('1.234.567,89')).toBeCloseTo(1234567.89);
    expect(parseAmount('€ 1,234,567')).toBe(1234567);
    expect(parseAmount('1.000.000')).toBe(1000000);
    expect(parseAmount('1,000')).toBe(1000);
    expect(parseAmount('12,5')).toBe(12.5);
    expect(parseAmount('1 234,50 €')).toBe(1234.5);
    expect(parseAmount('(2.500)')).toBe(-2500);
    expect(parseAmount('12abc')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('')).toBeNull();
  });
  it('parses and rejects dates', () => {
    expect(parseDay('2026-02-03')).toBe('2026-02-03');
    expect(parseDay('03.02.2026')).toBe('2026-02-03');
    expect(parseDay('31/02/2026')).toBeNull();
  });
});
