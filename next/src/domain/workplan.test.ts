import { describe, expect, it } from 'vitest';
import { mergeTable } from './workplan';

describe('a Work Plan typed by hand before the follow-up table', () => {
  it('takes the number of its period', () => {
    const own = [{ id: 'a', no: 1, from: '2026-10-01', to: '2026-12-31', planned: 224582 }];
    const S = (no: number, from: string, to: string, planned: number, prev?: { no: number; from: string; to: string; planned: number }) => ({ sheet: 'x', title: '', no, from, to, planned, ...(prev ? { prev } : {}) });
    const out = mergeTable(own as never, [S(2, '2026-04-01', '2026-06-30', 1, { no: 1, from: '2026-01-01', to: '2026-03-31', planned: 2 }), S(3, '2026-07-01', '2026-09-30', 3), S(4, '2026-10-01', '2026-12-31', 224582)] as never);
    expect(out.map((w) => [w.no, w.from])).toEqual([[1, '2026-01-01'], [2, '2026-04-01'], [3, '2026-07-01'], [4, '2026-10-01']]);
    expect(out.find((w) => w.no === 4)!.id).toBe('a');
  });
});
