import { rules } from '../domain/rules';
import { outcome } from '../domain/insights';
import { useState } from 'preact/hooks';
import { filtered, useStore } from '../data/store';
import { money } from '../domain/calc';
import { flexOf, pctOf } from '../domain/flex';
import type { Project } from '../domain/types';
import { TODAY } from '../today';
import { Chart, base, type Tokens } from '../ui/Chart';
import { date, full, month, short } from '../ui/format';
import { download } from '../ui/xlsxwrite';
import { depletion } from './Depletion';
import { openProject } from './ProjectPage';
import { plabel } from '../domain/label';

const MS = 30.4375 * 86_400_000;
const lab = (p: Project) => (plabel(p));

export interface Crossing { p: Project; code: string; label: string; kind: 'budget' | 'flex'; at: number; now: boolean; budget: number; exposure: number; rate: number; flex: number }
export interface ProjectOutlook { p: Project; budget: number; spent: number; committed: number; atEnd: number; end: number; crossings: Crossing[] }

/**
 * Where each project is heading at the pace of its spending so far: spent + committed today plus each heading's
 * monthly spending until the end date, and the month a heading passes its budget (a notification) and its
 * flexibility (an addendum), if that happens before the end.
 */
export function outlook(p: Project): ProjectOutlook | null {
  const m = money(p); if (!m.budget || p.datesTbc) return null;
  const D = depletion(p), now = Math.max(D.asOf, TODAY.getTime()), end = Date.parse(p.end), fx = flexOf(p);
  const crossings: Crossing[] = [];
  let atEnd = 0;
  for (const h of D.rows) {
    if (!h.budget || h.code === '10') continue; // administrative costs follow the direct costs
    for (const [kind, lim] of [['budget', h.budget], ['flex', h.budget * (1 + fx)]] as const) {
      if (h.exposure > lim + 0.5) { crossings.push({ p, code: h.code, label: h.label, kind, at: now, now: true, budget: h.budget, exposure: h.exposure, rate: h.rate, flex: fx }); continue; }
      if (h.rate <= 0) continue;
      const t = now + ((lim - h.exposure) / h.rate) * MS;
      if (t <= end) crossings.push({ p, code: h.code, label: h.label, kind, at: t, now: false, budget: h.budget, exposure: h.exposure, rate: h.rate, flex: fx });
    }
  }
  // Spending at the end: the end-of-project forecast of the project page (one projection everywhere).
  atEnd = outcome(p, TODAY).projected;
  return { p, budget: m.budget, spent: m.spent, committed: m.exposure - m.spent, atEnd, end, crossings };
}

function barsOption(t: Tokens, O: ProjectOutlook[]) {
  const y = O.map((o) => lab(o.p));
  const g = (a: string, b: string) => ({ type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: a }, { offset: 1, color: b }] });
  const seg = (name: string, v: (o: ProjectOutlook) => number, color: unknown, extra: object = {}) => ({ name, type: 'bar', stack: 'u', barWidth: 18, data: O.map((o) => +(v(o) * 100).toFixed(1)), itemStyle: { color, ...extra }, emphasis: { focus: 'series' } });
  return { ...base(t),
    grid: { left: 84, right: 56, top: 34, bottom: 28 },
    legend: { top: 0, left: 0, itemWidth: 12, itemHeight: 10, textStyle: { color: t.ink2, fontSize: 12 } },
    tooltip: { ...(base(t) as any).tooltip, trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (ps: any[]) => { const o = O[ps[0].dataIndex]; return `<b>${lab(o.p)}</b> · ${o.p.name.slice(0, 60)}<br/>Spent ${full(o.spent)} · committed ${full(o.committed)}<br/>At the end at this pace <b>${full(o.atEnd)}</b> of ${full(o.budget)} (<b>${Math.round((o.atEnd / o.budget) * 100)}%</b>)<br/>${o.atEnd > o.budget ? `<span style="color:${t.critical}">≈ ${full(o.atEnd - o.budget)} above the budget</span>` : `≈ ${full(o.budget - o.atEnd)} would stay unused`} · ends ${date(o.p.end)}`; } },
    xAxis: { type: 'value', max: (v: any) => Math.max(110, Math.ceil(v.max / 10) * 10), axisLabel: { color: t.ink3, fontSize: 11, formatter: '{value}%' }, splitLine: { lineStyle: { color: t.line, type: 'dashed' } } },
    yAxis: { type: 'category', data: y, inverse: true, axisTick: { show: false }, axisLine: { show: false }, axisLabel: { color: t.ink, fontWeight: 600, fontSize: 12, fontFamily: t.mono } },
    series: [
      seg('Spent', (o) => o.spent / o.budget, g(t.c[0], t.c[0] + 'cc'), { borderRadius: [4, 0, 0, 4], shadowBlur: 6, shadowColor: 'rgba(0,0,0,.12)', shadowOffsetY: 2 }),
      seg('Committed', (o) => o.committed / o.budget, g(t.c[0] + '88', t.c[0] + '66')),
      { ...seg('Rest at the current pace', (o) => Math.max(0, o.atEnd - o.spent - o.committed) / o.budget, t.c[0] + '22', { borderRadius: [0, 4, 4, 0], borderColor: t.c[0] + '88', borderWidth: 1, borderType: 'dashed' }),
        label: { show: true, position: 'right', fontFamily: t.mono, fontSize: 12, fontWeight: 700, formatter: (x: any) => { const o = O[x.dataIndex], v = o.atEnd / o.budget; return `{${v > 1.001 ? 'r' : v < 0.85 ? 'b' : 'g'}|${Math.round(v * 100)}%}`; }, rich: { r: { color: t.critical, fontWeight: 700 }, b: { color: t.c[0], fontWeight: 700 }, g: { color: t.good, fontWeight: 700 } } },
        markLine: { symbol: 'none', silent: true, lineStyle: { color: t.ink, type: 'solid', width: 1.5 }, label: { formatter: 'budget', position: 'start', color: t.ink2, fontSize: 11, fontWeight: 600 }, data: [{ xAxis: 100 }] },
        markArea: { silent: true, itemStyle: { color: t.good + '14' }, data: [[{ xAxis: 85 }, { xAxis: 100 }]] } },
    ] };
}

function timelineOption(t: Tokens, X: Crossing[], O: ProjectOutlook[]) {
  const y = O.map((o) => lab(o.p)), now = TODAY.getTime();
  const pts = (k: Crossing['kind']) => X.filter((c) => c.kind === k).map((c) => ({ value: [c.at, lab(c.p)], c }));
  const lastEnd = Math.max(...O.map((o) => o.end), now + 6 * MS);
  return { ...base(t),
    grid: { left: 84, right: 24, top: 52, bottom: 40 },
    legend: { top: 0, left: 0, textStyle: { color: t.ink2, fontSize: 12 } },
    tooltip: { ...(base(t) as any).tooltip, trigger: 'item', formatter: (x: any) => { const c: Crossing = x.data.c; if (!c) return x.name; return `<b>${lab(c.p)}</b> · heading ${c.code} ${c.label}<br/>${c.now ? 'Already' : month(c.at)}: spent + committed ${c.kind === 'budget' ? 'passes the budget' : `passes the ${pctOf(c.flex)}% flexibility`} (${full(c.kind === 'budget' ? c.budget : c.budget * (1 + c.flex))})<br/>Now ${full(c.exposure)} · ${full(c.rate)} a month<br/><b>${c.kind === 'budget' ? 'Notification' : 'Addendum'}</b>`; } },
    xAxis: { type: 'time', min: now - MS, max: lastEnd, axisLabel: { color: t.ink3, fontSize: 11, formatter: (v: number) => month(v) }, splitLine: { show: true, lineStyle: { color: t.line, type: 'dashed' } } },
    yAxis: { type: 'category', data: y, inverse: true, axisTick: { show: false }, axisLine: { show: false }, axisLabel: { color: t.ink, fontWeight: 600, fontSize: 12, fontFamily: t.mono }, splitArea: { show: true, areaStyle: { color: [t.surface2 + '00', t.surface2] } } },
    series: [
      { name: 'Project period', type: 'custom', silent: true, itemStyle: { color: t.line }, renderItem: (_: any, api: any) => { const i = api.value(0), s = api.coord([Math.max(now - MS, Date.parse(O[i].p.start)), i]), e = api.coord([O[i].end, i]); return { type: 'rect', shape: { x: s[0], y: s[1] - 3, width: Math.max(0, e[0] - s[0]), height: 6, r: 3 }, style: { fill: t.line } }; }, data: O.map((_, i) => [i]), encode: { x: -1, y: 0 }, z: 1 },
      { name: 'Passes the budget (notification)', type: 'scatter', symbol: 'circle', symbolSize: 15, data: pts('budget'), itemStyle: { color: { type: 'radial', x: 0.35, y: 0.35, r: 0.8, colorStops: [{ offset: 0, color: '#ffe08a' }, { offset: 1, color: t.warn }] }, borderColor: t.surface, borderWidth: 2, shadowBlur: 8, shadowColor: 'rgba(0,0,0,.25)' }, z: 3 },
      { name: 'Passes the flexibility (addendum)', type: 'scatter', symbol: 'diamond', symbolSize: 19, data: pts('flex'), itemStyle: { color: { type: 'radial', x: 0.35, y: 0.35, r: 0.8, colorStops: [{ offset: 0, color: '#ff9b9b' }, { offset: 1, color: t.critical }] }, borderColor: t.surface, borderWidth: 2, shadowBlur: 8, shadowColor: 'rgba(0,0,0,.3)' }, z: 4,
        markLine: { symbol: 'none', silent: true, lineStyle: { color: t.c[0], width: 2 }, label: { formatter: 'today', position: 'start', color: t.c[0], fontWeight: 700 }, data: [{ xAxis: now }] } },
    ] };
}

/** Portfolio outlook: every project at the end date at its current pace, and when headings will need a letter. */
export function Outlook() {
  const s = useStore((x) => x);
  const [within, setWithin] = useState(12);
  const O = filtered(s).filter((p) => !/closed/i.test(p.status ?? '')).map(outlook).filter((o): o is ProjectOutlook => !!o).sort((a, b) => b.atEnd / b.budget - a.atEnd / a.budget);
  const X = O.flatMap((o) => o.crossings).sort((a, b) => a.at - b.at);
  const soon = X.filter((c) => c.at <= TODAY.getTime() + within * MS);
  const B = O.reduce((a, o) => a + o.budget, 0), E = O.reduce((a, o) => a + o.atEnd, 0), unused = O.reduce((a, o) => a + Math.max(0, o.budget - o.atEnd), 0);
  const under = O.filter((o) => o.atEnd < o.budget * 0.85).length;
  const xlsx = () => download(`outlook-${TODAY.toISOString().slice(0, 10)}.xlsx`, [
    { name: 'At the end', money: [2, 3, 4, 5, 6], rows: [['Project', 'BH', 'Budget', 'Spent', 'Committed', 'At the end at this pace', 'Unused / over', '% of budget', 'End date'].map((v) => ({ v, st: 'head' as const })), ...O.map((o) => [o.p.name, o.p.bh ?? '', o.budget, o.spent, o.committed, Math.round(o.atEnd * 100) / 100, Math.round((o.budget - o.atEnd) * 100) / 100, o.atEnd / o.budget, o.p.end])] },
    { name: 'Headings', money: [4, 5, 6], rows: [['Project', 'BH', 'Heading', 'When', 'Budget', 'Spent + committed', 'A month', 'What'].map((v) => ({ v, st: 'head' as const })), ...X.map((c) => [c.p.name, c.p.bh ?? '', `${c.code} ${c.label}`, c.now ? 'already' : new Date(c.at).toISOString().slice(0, 7), c.budget, c.exposure, Math.round(c.rate * 100) / 100, c.kind === 'budget' ? 'passes the budget — notification' : `passes ${pctOf(c.flex)}% — addendum`])] }]);
  if (!O.length) return <div class="card empty-page"><div><h2>Nothing to project yet</h2><p>Import the financial reports; each project is then projected to its end date.</p></div></div>;
  return (
    <>
      <section class="hero" aria-label="Outlook">
        <div class="kpi lead"><span class="label">At the end, at the current pace</span><span class="value">{Math.round((E / B) * 100)}%</span><span class="ctx">{short(E)} of {short(B)} budget · {O.length} projects</span></div>
        <div class="kpi"><span class="label">Would stay unused</span><span class="value" style={{ color: unused > B * 0.1 ? 'var(--serious)' : undefined }}>{short(unused)}</span><span class="ctx">{under} project{under === 1 ? '' : 's'} below 85% at the end</span></div>
        <div class="kpi"><span class="label">Letters in the next {within} months</span><span class="value" style={{ color: soon.some((c) => c.kind === 'flex') ? 'var(--critical)' : soon.length ? 'var(--warn)' : undefined }}>{soon.length}</span><span class="ctx">{soon.filter((c) => c.kind === 'budget').length} notification · {soon.filter((c) => c.kind === 'flex').length} addendum</span></div>
      </section>
      <div class="grid g-12" style={{ marginTop: '16px' }}>
        <section class="card span-12">
          <div class="card-h"><div><h2>Where each project ends at its current pace</h2><p>Spent, committed and what the rest of the period adds at each heading's monthly spending so far · green band = 85–100% of the budget · click a bar to open the project</p></div><button class="btn" onClick={xlsx}>⤓ Excel</button></div>
          <div class="card-b"><Chart height={O.length * 40 + 80} label="Projected use of the budget at the end date" onClick={(e) => e.dataIndex != null && openProject(O[e.dataIndex].p.id, 'summary')} option={(t) => barsOption(t, O)} /></div>
        </section>
        <section class="card span-12">
          <div class="card-h"><div><h2>When headings will need a letter</h2><p>The month spent + committed passes a heading's budget (notification) and its flexibility — {rules().flexJP}% Joint Programme, {rules().flexVC}% Voluntary Contribution — (addendum), at the current pace · grey bar = project period</p></div></div>
          <div class="card-b"><Chart height={O.length * 46 + 108} label="Heading crossings over time" onClick={(e) => e.data?.c && openProject(e.data.c.p.id, 'budget')} option={(t) => timelineOption(t, X, O)} /></div>
        </section>
        <section class="card span-12">
          <div class="card-h"><div><h2>Coming up</h2><p>Headings passing their budget or flexibility within the period chosen</p></div>
            <div class="seg">{[3, 6, 12, 36].map((m) => <button aria-pressed={within === m} onClick={() => setWithin(m)}>{m === 36 ? 'Until the end' : `${m} months`}</button>)}</div></div>
          {soon.length ? <div class="table-wrap" style={{ padding: '0 16px 12px' }}><table class="wp-t" style={{ width: '100%', margin: 0 }}><thead><tr><th>When</th><th>Project</th><th>Heading</th><th class="num">Spent + committed</th><th class="num">Budget</th><th class="num">A month</th><th>Needed</th></tr></thead>
            <tbody>{soon.map((c) => <tr class="click" style={{ cursor: 'pointer' }} onClick={() => openProject(c.p.id, 'budget')}><td><b>{c.now ? 'Already' : month(c.at)}</b></td><td><b>{lab(c.p)}</b> · {c.p.name.slice(0, 50)}</td><td>{c.code}. {c.label}</td><td class="num">{full(c.exposure)}</td><td class="num">{full(c.budget)}</td><td class="num">{full(c.rate)}</td>
              <td><span class={`badge ${c.kind === 'flex' ? 'critical' : 'warning'}`}>{c.kind === 'flex' ? `Addendum (beyond ${pctOf(c.flex)}%)` : 'Notification'}</span></td></tr>)}</tbody></table></div>
            : <div class="empty-inline" style={{ padding: '20px' }}><p>No heading passes its budget within {within === 36 ? 'the project periods' : `${within} months`} at the current pace.</p></div>}
        </section>
      </div>
    </>
  );
}
