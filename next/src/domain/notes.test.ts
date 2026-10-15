import { describe, expect, it } from 'vitest';
import { joinLines, structureNote } from './notes';

describe('justification structure', () => {
  it('splits outputs, activities and subtotals and checks the sums', () => {
    const S = structureNote('Output 1.1: A.1.1.1: (2 STCs*5 days= 10 days) Sub Total: 10 Output 1.2: A.1.2.2: (1 STCs+ 10 MoNE staff +3 CoE staff,+2 interpreters+1 technician)*7days = 119 days A.1.2.3: ( 2 STCs+ 2CoE Staff)*3 days*2 meetings= 24 days Sub Total: 143 Output 2.2: A.2.2.2: (4 STCs*7 days* 3 rounds of camps=84 days) (2 STCs*7 days* 3 rounds of camps= 42 days) Sub Total: 168')!;
    expect(S.unit).toBe('days');
    expect(S.groups.map((g) => [g.title, g.rows.map((r) => r.code), g.subtotal, g.sum])).toEqual([
      ['Output 1.1', ['A.1.1.1'], 10, 10], ['Output 1.2', ['A.1.2.2', 'A.1.2.3'], 143, 143], ['Output 2.2', ['A.2.2.2'], 168, 42],
    ]);
    expect(structureNote('1 full-time manager in Ankara for 60 months.')).toBeNull();
  });
  it('re-attaches hyphenated words but keeps real hyphens', () => {
    expect(joinLines(['the imple-', 'mentation team', 'short-', 'term experts', '( see 4.3.2 )'])).toBe('the implementation team short-term experts (see 4.3.2)');
  });
});

describe('event justification with "A 2.1.1" codes and European numbers', () => {
  it('splits groups, activities and subtotals, and repairs the lost "ti" ligature', () => {
    const S = structureNote('Large Scale Events - A 2.1.1 Workshops 12.100*12 =145.200 EUR -A 3.3.2 Training on ac Θ on-oriented approach: 103.000 EUR -Opening Conference: 75.000 EUR Sub total: 323.200 EUR Medium Scale Events - A 1.1.1: Policy exercise: 32.000 EUR Sub total: 32.000 EUR')!;
    expect(S.groups.map((g) => [g.title, g.rows.length, g.subtotal, g.sum])).toEqual([['Large Scale Events', 3, 323200, 323200], ['Medium Scale Events', 1, 32000, 32000]]);
    expect(S.groups[0].rows[1].text).toContain('action-oriented');
  });
});
