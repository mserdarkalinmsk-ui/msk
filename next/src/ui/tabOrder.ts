/** The order of the project tabs chosen by dragging, kept in this browser (a viewer's own preference). */
export const TAB_ORDER = 'pl-tab-order';
export const readTabOrder = (): string[] => { try { const v = JSON.parse(localStorage.getItem(TAB_ORDER) || '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []; } catch { return []; } };
/** Groups in the saved order; a group not in it (a tab added later) keeps its standard place after the ones before it. */
export function orderTabs<T extends { label: string }>(G: T[], order: string[]): T[] {
  if (!order.length) return G;
  const at = (g: T) => { const i = order.indexOf(g.label); return i >= 0 ? i : order.length + G.indexOf(g); };
  return [...G].sort((a, b) => at(a) - at(b));
}
/** Moves one label to where another stands. */
export function moveTab(L: string[], from: string, to: string): string[] {
  const out = L.filter((x) => x !== from), i = out.indexOf(to), j = L.indexOf(from) < L.indexOf(to) ? i + 1 : i;
  out.splice(j, 0, from); return out;
}
