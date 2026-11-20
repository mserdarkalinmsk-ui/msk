import { describe, expect, it } from 'vitest';
import { TR_SCALE_2027 } from './ccrScaleTR';

describe('Türkiye salary scale at 1 January 2027 (CM(2026)136)', () => {
  it('every step follows from the one before by the step value of its row (A grades: the second value from step 7)', () => {
    for (const r of TR_SCALE_2027.rows) for (let i = 1; i < r.s.length; i++) {
      const st: number = r.step.length > 1 && i >= 6 ? r.step[1]! : r.step[0];
      expect(Math.abs(r.s[i] - r.s[i - 1] - st), `${r.g} step ${i + 1}`).toBeLessThan(0.015);
    }
  });
});
