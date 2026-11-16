import { describe, expect, it } from 'vitest';
import { isFigure } from './tableTidy';

describe('isFigure', () => {
  it('reads amounts, percentages, counts and signed figures', () => {
    for (const t of ['€1,234.56', '−€5,921.19', '(€6,150.00)', '205,550.00', '59%', '12.5 %', '7', '€69K', '€1.85M', '-22 pp', '+3.20', '7 mo']) expect(isFigure(t), t).toBe(true);
  });
  it('leaves codes, names and dates as text', () => {
    for (const t of ['1.3', '2.1.4', 'BH 9413', 'Travel', '14 Nov 2026', '4500123456', '']) expect(isFigure(t), t).toBe(false);
  });
});

import { iconFor } from './tileIcons';
describe('iconFor', () => {
  it('picks the icon from the tile label', () => {
    expect(iconFor('Uncommitted balance')).toBe('coins');
    expect(iconFor('Spent to date')).toBe('trend');
    expect(iconFor('Committed')).toBe('receipt');
    expect(iconFor('Total budget')).toBe('wallet');
    expect(iconFor('Pace vs time')).toBe('clock');
    expect(iconFor('Lines over approved')).toBe('alert');
    expect(iconFor('Reports on file')).toBe('file');
    expect(iconFor('Staff')).toBe('users');
  });
});
describe('iconFor on staff tiles', () => {
  it('reads people first', () => { expect(iconFor('Within contract today')).toBe('users'); expect(iconFor('Records to confirm')).toBe('file'); });
});
