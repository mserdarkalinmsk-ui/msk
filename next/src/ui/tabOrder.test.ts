import { describe, expect, it } from 'vitest';
import { moveTab, orderTabs } from './tabOrder';

const G = ['Summary', 'Finance', 'PO review', 'Staff'].map((label) => ({ label }));
describe('project tab order', () => {
  it('moves a tab before a tab on its left and after a tab on its right', () => {
    expect(moveTab(['A', 'B', 'C', 'D'], 'C', 'A')).toEqual(['C', 'A', 'B', 'D']);
    expect(moveTab(['A', 'B', 'C', 'D'], 'A', 'C')).toEqual(['B', 'C', 'A', 'D']);
  });
  it('applies a saved order; tabs it does not know keep their place at the end', () => {
    expect(orderTabs(G, ['Staff', 'Summary']).map((g) => g.label)).toEqual(['Staff', 'Summary', 'Finance', 'PO review']);
    expect(orderTabs(G, [])).toBe(G);
  });
});
