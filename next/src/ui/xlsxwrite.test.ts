import { describe, expect, it } from 'vitest';
import { workbook } from './xlsxwrite';

/** The number format applied by a cell style index, read from the written styles part. */
function formatOf(text: string, s: number): string {
  const styles = /<styleSheet[\s\S]*?<\/styleSheet>/.exec(text)![0];
  const xfs = [.../<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(styles)![1].matchAll(/<xf [^>]*?numFmtId="(\d+)"/g)].map((m) => Number(m[1]));
  const id = xfs[s];
  return [...styles.matchAll(/<numFmt numFmtId="(\d+)" formatCode="([^"]*)"\/>/g)].find((m) => Number(m[1]) === id)?.[2] ?? `builtin ${id}`;
}

describe('xlsx writer amounts', () => {
  it('shows amounts with two decimals in money, total and input cells', () => {
    const b = workbook([{ name: 'Lines', money: [1], rows: [['Code', 'Amount'], ['1.1', 1234.5], [{ v: 'Total', st: 'bold' }, { v: 1234.5, st: 'total' }], ['in', { v: 10.25, st: 'in' }], ['mb', { v: 3, st: 'moneyBold' }]] }]);
    const text = new TextDecoder().decode(b);
    const cell = (ref: string) => Number(new RegExp(`<c r="${ref}" s="(\\d+)"`).exec(text)![1]);
    for (const ref of ['B2', 'B3', 'B4', 'B5']) expect(formatOf(text, cell(ref)), ref).toMatch(/0\.00/);
  });
});
