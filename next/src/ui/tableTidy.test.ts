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
