// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { tableRows } from './tableExport';

// a minimal table: the reader only uses rows, cells, tHead and innerText
const cell = (s: string) => ({ innerText: s, textContent: s });
const row = (c: string[]) => ({ cells: c.map(cell), closest: () => null });
const table = (head: string[], body: string[][]) => ({ rows: [row(head), ...body.map(row)], tHead: { rows: [1] } }) as unknown as HTMLTableElement;

describe('a small table taken to Excel', () => {
  it('keeps amounts as numbers, money columns marked, text and percentages as they are', () => {
    const { rows, money } = tableRows(table(['Project', 'POs', 'Amount', 'Share'], [['BH 1', '183', '€654,725.63', '35%'], ['BH 2', '36', '−€1,500.00', '5%'], ['Total', '219', '€653,225.63', '—']]));
    expect(rows[1]).toEqual(['BH 1', 183, 654725.63, '35%']);
    expect(rows[2][2]).toBe(-1500);
    expect(money).toEqual([2]);
  });
});
