import type { WorkbookSummary } from './workbook';

const r2 = (v: number) => Math.round(v * 100) / 100;
export interface PoChange { po: string; line: string; description: string; supplier: string; kind: 'new' | 'spent' | 'raised' | 'reduced' | 'closed' | 'gone'; spentBefore: number; spentNow: number; scBefore: number; scNow: number }
export interface LineChange { code: string; description: string; spent: number; sc: number }
export interface ReportDiff { from: string; to: string; spent: number; sc: number; pos: PoChange[]; lines: LineChange[] }

/** What changed between two report workbooks or extractions of one project: by purchase order and by budget line. */
export function reportDiff(a: WorkbookSummary, b: WorkbookSummary): ReportDiff {
  const key = (x: { po: string; line: string }) => `${x.po}|${x.line}`;
  const A = new Map(a.pos.map((x) => [key(x), x])), B = new Map(b.pos.map((x) => [key(x), x]));
  const pos: PoChange[] = [];
  for (const [k, x] of B) {
    const y = A.get(k);
    const base = { po: x.po, line: x.line, description: x.description, supplier: x.supplier, spentBefore: r2(y?.spent ?? 0), spentNow: r2(x.spent), scBefore: r2(y?.sc ?? 0), scNow: r2(x.sc) };
    if (!y) { pos.push({ ...base, kind: 'new' }); continue; }
    const closed = !/open/i.test(x.status) && /open/i.test(y.status);
    if (closed) pos.push({ ...base, kind: 'closed' });
    else if (x.sc > y.sc + 0.5) pos.push({ ...base, kind: 'raised' });
    else if (x.sc < y.sc - 0.5) pos.push({ ...base, kind: 'reduced' });
    else if (x.spent > y.spent + 0.5) pos.push({ ...base, kind: 'spent' });
  }
  for (const [k, y] of A) if (!B.has(k)) pos.push({ po: y.po, line: y.line, description: y.description, supplier: y.supplier, kind: 'gone', spentBefore: r2(y.spent), spentNow: 0, scBefore: r2(y.sc), scNow: 0 });
  const la = new Map(a.lines.filter((l) => l.leaf).map((l) => [l.code, l]));
  const lines = b.lines.filter((l) => l.leaf).map((l) => { const o = la.get(l.code); return { code: l.code, description: l.description, spent: r2((l.actual.cost ?? 0) - (o?.actual.cost ?? 0)), sc: r2((l.sc ?? 0) - (o?.sc ?? 0)) }; }).filter((l) => Math.abs(l.spent) > 0.5 || Math.abs(l.sc) > 0.5);
  const tot = (w: WorkbookSummary, f: 'a' | 's') => w.lines.filter((l) => l.leaf).reduce((s, l) => s + (f === 'a' ? l.actual.cost ?? 0 : l.sc ?? 0), 0);
  const order = { new: 0, raised: 1, spent: 2, reduced: 3, closed: 4, gone: 5 };
  return { from: a.meta.situationDate || a.meta.asAt || '', to: b.meta.situationDate || b.meta.asAt || '', spent: r2(tot(b, 'a') - tot(a, 'a')), sc: r2(tot(b, 's') - tot(a, 's')),
    pos: pos.sort((x, y) => order[x.kind] - order[y.kind] || (y.scNow - y.scBefore) - (x.scNow - x.scBefore)), lines: lines.sort((x, y) => Math.abs(y.sc) - Math.abs(x.sc)) };
}
