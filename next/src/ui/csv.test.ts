import { describe, expect, it } from 'vitest';
import { headKey, parseAmount, parseCSV, parseDay } from './csv';

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
  it('reads raw Excel numbers: decimals after a long integer part and scientific notation', () => {
    expect(parseAmount('1234.567')).toBe(1234.567);
    expect(parseAmount('0.125')).toBe(0.125);
    expect(parseAmount('0,500')).toBe(0.5);
    expect(parseAmount('-1.1368683772161603E-13')).toBeCloseTo(0);
    expect(parseAmount('1.5E+7')).toBe(15000000);
    expect(parseAmount('1.000')).toBe(1000);
    expect(parseAmount('12.345')).toBe(12345);
  });
  it('reads currency codes, the lira sign and a trailing minus', () => {
    expect(parseAmount('EUR 1,000.00')).toBe(1000);
    expect(parseAmount('1.000,00 TL')).toBe(1000);
    expect(parseAmount('₺1.234,50')).toBe(1234.5);
    expect(parseAmount('TRY 2 500')).toBe(2500);
    expect(parseAmount('1.234,56-')).toBe(-1234.56);
    expect(parseAmount('1,234.56−')).toBe(-1234.56);
    expect(parseAmount('-')).toBeNull();
    expect(parseAmount('TL')).toBeNull();
    expect(parseAmount('1-2')).toBeNull();
  });
  it('matches column headers written in Turkish capitals', () => {
    for (const [cap, alias] of [['AÇIKLAMA', 'açıklama'], ['ONAYLI', 'onaylı'], ['BAŞLANGIÇ', 'başlangıç'], ['BİTİŞ', 'bitiş'], ['ÜLKE', 'ülke'], ['SEKTÖR', 'sektör'], [' Line Code ', 'line code']]) expect(headKey(cap)).toBe(headKey(alias));
    expect(headKey('LINE')).toBe('line');
  });
  it('parses and rejects dates', () => {
    expect(parseDay('2026-02-03')).toBe('2026-02-03');
    expect(parseDay('03.02.2026')).toBe('2026-02-03');
    expect(parseDay('31/02/2026')).toBeNull();
  });
});
