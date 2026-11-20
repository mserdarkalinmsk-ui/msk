import { describe, expect, it } from 'vitest';
import { readScale, scaleRow } from './salaryScaleRead';
import { TR_SCALE_2027 } from './ccrScaleTR';

const TR = /t[üu]rkiye|turkey/i, TRY = /\bTRY\b|turkish lira/i;
// the published rows written back the way a PDF or Word table gives them
const fr = (v: number) => v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const en = (v: number) => v.toLocaleString('en-GB', { minimumFractionDigits: 2 });

describe('salary scale read from a document', () => {
  it('reads every grade of the scale, step values apart, in English and French number writing', () => {
    for (const f of [en, fr]) {
      const lines = [['Grade', '1', '2', '3'], ...TR_SCALE_2027.rows.map((r) => [r.g, ...r.s.map(f), r.step.map(f).join(' / ')])];
      const S = readScale([{ text: 'Annex 4 — Türkiye — monthly basic salary scale as of 01.01.2028 (TRY)', lines }], TR, TRY, 'scale.pdf');
      expect('rows' in S && S.rows).toEqual(TR_SCALE_2027.rows);
      expect('rows' in S && [S.asOf, S.currency, S.proposal]).toEqual(['2028-01-01', 'TRY', false]);
    }
  });
  it('reads a grade glued to its first amount, and plain workbook numbers', () => {
    expect(scaleRow(['A 5 530,026.63', '544,858.88', '559,691.13', '14,832.25'])).toEqual({ g: 'A 5', s: [530026.63, 544858.88, 559691.13], step: [14832.25] });
    expect(scaleRow(['C1', '97988.3', '100928.18', '103868.06', '2939.88'])?.s).toEqual([97988.3, 100928.18, 103868.06]);
  });
  it('takes the page that names the country, and says so when nothing can be read', () => {
    const page = (t: string, k: number) => ({ text: t, lines: [1, 2, 3].map((g) => [`B ${g}`, ...[0, 1, 2].map((i) => en(1000 * k + g * 100 + i * 10)), en(10)]) });
    const S = readScale([page('Spain EUR', 1), page('Türkiye TRY proposal', 2)], TR, TRY);
    expect('rows' in S && S.rows[0].s[0]).toBe(2100);
    expect('rows' in S && S.proposal).toBe(true);
    expect('error' in readScale([{ text: 'Türkiye', lines: [['nothing here']] }], TR, TRY)).toBe(true);
  });
});
