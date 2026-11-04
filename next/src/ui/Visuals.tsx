import type { EChartsCoreOption } from 'echarts/core';
import { money } from '../domain/calc';
import { earlyWarnings, STAGE } from '../domain/earlywarn';
import { headings } from '../domain/insights';
import type { Country, Project } from '../domain/types';
import { TODAY } from '../today';
import { base, Chart, type Tokens } from './Chart';
import { full, short } from './format';

const lab = (p: Project) => (p.bh ? `BH ${p.bh}` : p.code);

/** Money flow: funding → country → project → spent / committed / still available. */
export function MoneyFlow({ P, countries }: { P: Project[]; countries: Country[] }) {
  const cname = (id: string) => countries.find((c) => c.id === id)?.name ?? id;
  const R = P.filter((p) => !p.datesTbc).map((p) => ({ p, m: money(p) })).filter((r) => r.m.budget > 0);
  if (!R.length) return null;
  const fund = (p: Project) => (p.funding?.trim() || 'Joint programmes');
  const nodes = new Map<string, { name: string; depth: number }>();
  const add = (name: string, depth: number) => { if (!nodes.has(name)) nodes.set(name, { name, depth }); };
  const links: { source: string; target: string; value: number }[] = [];
  for (const r of R) {
    const f = fund(r.p), c = cname(r.p.country), pr = lab(r.p);
    add(f, 0); add(c, 1); add(pr, 2); add('Spent', 3); add('Committed', 3); add('Still available', 3);
    links.push({ source: f, target: c, value: r.m.budget }, { source: c, target: pr, value: r.m.budget });
    const sp = Math.max(0, r.m.spent), cm = Math.max(0, r.m.committed), left = Math.max(0, r.m.budget - sp - cm);
    if (sp) links.push({ source: pr, target: 'Spent', value: sp }); if (cm) links.push({ source: pr, target: 'Committed', value: cm }); if (left) links.push({ source: pr, target: 'Still available', value: left });
  }
  // Funding → country links summed.
  const merged = [...links.reduce((m, l) => { const k = `${l.source}|${l.target}`; m.set(k, { ...l, value: (m.get(k)?.value ?? 0) + l.value }); return m; }, new Map<string, (typeof links)[number]>()).values()];
  const option = (t: Tokens): EChartsCoreOption => ({
    ...base(t),
    tooltip: { ...(base(t).tooltip as object), formatter: (q: { dataType: string; data: { source?: string; target?: string; value?: number; name?: string }; value: number }) => q.dataType === 'edge' ? `${q.data.source} → ${q.data.target}<br/><b>${full(q.data.value!)}</b>` : `<b>${q.data.name}</b><br/>${full(q.value)}` },
    series: [{ type: 'sankey', left: 8, right: 110, top: 10, bottom: 10, nodeGap: 10, nodeWidth: 12, draggable: false, layoutIterations: 32, emphasis: { focus: 'adjacency' },
      data: [...nodes.values()].map((n) => ({ ...n, itemStyle: { color: n.name === 'Spent' ? t.c[0] : n.name === 'Committed' ? t.c[2] : n.name === 'Still available' ? t.ink3 : n.depth === 0 ? t.ink2 : n.depth === 1 ? t.c[6] : t.c[0] } })),
      links: merged, lineStyle: { color: 'gradient', opacity: 0.28, curveness: 0.5 },
      label: { color: t.ink, fontSize: 11.5, formatter: (q: { name: string; value: number }) => `${q.name}  ${short(q.value)}` } }],
  });
  return (
    <section class="card span-12">
      <div class="card-h"><div><h2>Money flow</h2><p>Funding → country → project → spent, committed and still available · hover a band to follow it</p></div></div>
      <div class="card-b"><Chart height={Math.max(300, R.length * 34 + 40)} label="Money flow" option={option} /></div>
    </section>
  );
}

/** Heading flexibility of one project: the band allowed without an addendum, the agreement, now and the end-date estimate. */
export function FlexPanel({ p }: { p: Project }) {
  const H = headings(p), W = earlyWarnings(p, TODAY), f = H.flex;
  const rows = H.rows.filter((r) => r.baseline > 0).map((r) => ({ r, w: W.find((x) => x.code === r.code) }));
  if (!rows.length) return null;
  const cats = rows.map(({ r }) => `${r.code} ${r.label}`);
  const tone = (t: Tokens, s?: string) => (s === 'addendum' ? t.critical : s === 'notify-now' ? t.serious : s === 'notify' ? t.warn : t.good);
  // Everything as a share of the amount in the agreement, so every heading reads on the same scale.
  const pc = (v: number, r: { baseline: number }) => Math.round(v / r.baseline * 1000) / 10;
  const top = Math.max(150, ...rows.map(({ r, w }) => Math.ceil(Math.max(pc(r.approved, r), pc(w?.projected ?? r.exposure, r)) / 10) * 10 + 10));
  const option = (t: Tokens): EChartsCoreOption => ({
    ...base(t),
    grid: { left: 170, right: 30, top: 28, bottom: 30 },
    legend: { top: 0, right: 0, textStyle: { color: t.ink2 }, itemWidth: 12, itemHeight: 10, data: ['Allowed without addendum', 'Agreement', 'Now', 'Expected at end'] },
    xAxis: { type: 'value', min: 0, max: top, axisLabel: { formatter: '{value}%', color: t.ink3 }, splitLine: { lineStyle: { color: t.line } } },
    yAxis: { type: 'category', data: cats, inverse: true, axisLabel: { color: t.ink, fontSize: 11.5 } },
    tooltip: { ...(base(t).tooltip as object), trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (q: { dataIndex: number }[]) => { const { r, w } = rows[q[0].dataIndex]; return `<b>${r.code} ${r.label}</b><br/>Agreement ${full(r.baseline)}<br/>Allowed ${full(r.baseline * (1 - f))} – ${full(r.baseline * (1 + f))}<br/>Now ${full(r.approved)} (${pc(r.approved, r)}%) · spent + committed ${full(r.exposure)}<br/>Expected at end ${full(w?.projected ?? r.exposure)} (${pc(w?.projected ?? r.exposure, r)}%)${w && w.stage !== 'ok' ? `<br/><b>${STAGE[w.stage].label}</b>` : ''}`; } },
    series: [
      { type: 'bar', stack: 'band', silent: true, itemStyle: { color: 'transparent' }, data: rows.map(() => 100 - f * 100), barWidth: 18 },
      { name: 'Allowed without addendum', type: 'bar', stack: 'band', itemStyle: { color: t.c[0], opacity: 0.16, borderRadius: 4 }, data: rows.map(() => 2 * f * 100), barWidth: 18 },
      { name: 'Agreement', type: 'scatter', symbol: 'rect', symbolSize: [3, 26], itemStyle: { color: t.ink }, data: rows.map(() => 100), z: 4 },
      { name: 'Now', type: 'scatter', symbol: 'circle', symbolSize: 11, itemStyle: { color: t.c[0], borderColor: t.surface, borderWidth: 1.5 }, data: rows.map(({ r }) => pc(r.approved, r)), z: 5 },
      { name: 'Expected at end', type: 'scatter', symbol: 'diamond', symbolSize: 14, data: rows.map(({ r, w }) => ({ value: pc(w?.projected ?? r.exposure, r), itemStyle: { color: tone(t, w?.stage), borderColor: t.surface, borderWidth: 1 } })), z: 6 },
    ],
  });
  return (
    <section class="card">
      <div class="card-h"><div><h2>Heading flexibility — {lab(p)}</h2><p>Each heading as a share of its amount in the agreement · shaded band = ±{Math.round(f * 100)}% (notification) · outside it an addendum is needed · diamond = expected spending at the end date at the current pace (green fine, amber notification, red addendum)</p></div></div>
      <div class="card-b"><Chart height={rows.length * 46 + 70} label="Heading flexibility" option={option} /></div>
    </section>
  );
}
