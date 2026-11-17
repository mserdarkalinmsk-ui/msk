/**
 * The figures behind a chart, as a table: read from the chart's own option, so every chart offers the same "show as
 * a table" without each page writing one. Bar and line charts over categories give one row per category and one
 * column per series; charts over time or values give one row per point; pie charts one row per slice.
 */
export interface ChartTable { cols: string[]; rows: (string | number | null)[][]; time: boolean }

const arr = (v: any): any[] => (Array.isArray(v) ? v : v ? [v] : []);
const num = (v: any): number | null => {
  if (v == null || v === '-') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  if (typeof v === 'object' && !Array.isArray(v)) return num(v.value);
  return null;
};
const text = (v: any): string => (v == null ? '' : typeof v === 'object' ? String(v.value ?? '') : String(v)).replace(/\{[a-z]+\|([^}]*)\}/g, '$1').replace(/\n/g, ' ');
const named = (S: any[]) => S.map((s, i) => String(s.name ?? (S.length === 1 ? 'Value' : `Series ${i + 1}`)));

export function chartTable(o: any): ChartTable | null {
  if (!o || typeof o !== 'object') return null;
  const S = arr(o.series).filter((s) => s && Array.isArray(s.data) && s.data.length && !['graph', 'sankey', 'tree', 'treemap', 'map', 'custom', 'gauge'].includes(s.type));
  if (!S.length) return null;
  // Pie: one row per slice.
  const pie = S.filter((s) => s.type === 'pie');
  if (pie.length) {
    const rows = pie.flatMap((s) => s.data.map((d: any) => [text(d?.name), num(d)])).filter((r: any[]) => r[1] != null);
    return rows.length ? { cols: ['', pie[0].name ? String(pie[0].name) : 'Value'], rows, time: false } : null;
  }
  const X = arr(o.xAxis)[0], Y = arr(o.yAxis)[0];
  const cat = X?.type === 'category' && Array.isArray(X.data) ? X : Y?.type === 'category' && Array.isArray(Y.data) ? Y : null;
  const pairs = (s: any) => s.data.every((d: any) => d == null || Array.isArray(d) || Array.isArray(d?.value));
  if (cat) {
    const C = cat.data.map(text), keep = S.filter((s) => !pairs(s) && s.data.length <= C.length);
    if (!keep.length) return null;
    const rows = C.map((c: string, i: number) => [c, ...keep.map((s) => num(s.data[i]))]).filter((r: any[]) => r.slice(1).some((v) => v != null));
    return rows.length ? { cols: [text(cat.name), ...named(keep)], rows, time: false } : null;
  }
  // Points over a time or value axis: the x values of every series, one row each.
  const keep = S.filter(pairs);
  if (!keep.length) return null;
  const time = X?.type === 'time';
  const xs = new Map<number | string, (number | null)[]>();
  keep.forEach((s, j) => {
    for (const d of s.data) {
      const p = Array.isArray(d) ? d : d?.value; if (!p) continue;
      const x = typeof p[0] === 'number' ? p[0] : time ? Date.parse(String(p[0])) : String(p[0]);
      if (x == null || (typeof x === 'number' && !isFinite(x))) continue;
      const r = xs.get(x) ?? keep.map(() => null); r[j] = num(p[1]); xs.set(x, r);
    }
  });
  const rows = [...xs].sort((a, b) => (typeof a[0] === 'number' && typeof b[0] === 'number' ? a[0] - b[0] : String(a[0]).localeCompare(String(b[0]))))
    .map(([x, v]) => [time && typeof x === 'number' ? new Date(x).toISOString().slice(0, 10) : x, ...v]).filter((r) => r.slice(1).some((v) => v != null));
  return rows.length ? { cols: [time ? 'Date' : text(X?.name), ...named(keep)], rows, time } : null;
}
