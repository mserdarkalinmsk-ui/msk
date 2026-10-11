import { deleteProjects, filtered, set, updateProject, useStore } from '../data/store';
import { attention, burnGap, elapsed, groupBy, money, portfolioSeries, totals } from '../domain/calc';
import { SECTORS, validUrl, type Project } from '../domain/types';
import { TODAY } from '../today';
import { base, Chart, type Tokens } from '../ui/Chart';
import { DataTable, type Column } from '../ui/DataTable';
import { full, month, pct, short, signedPct } from '../ui/format';
import { Sparkline } from '../ui/Sparkline';
import { MapView, type MapMode } from '../ui/MapView';
import { mapData, ModeSwitch } from './MapPage';
import { useState } from 'preact/hooks';

const gapTone = (g: number) => (g < -0.3 ? 'serious' : g < -0.15 ? 'warning' : g > 0.1 ? 'serious' : 'good');
const gapWord = (g: number) => (g < -0.15 ? 'Behind' : g > 0.1 ? 'Ahead' : 'On track');

export function Filters() {
  const { countries } = useStore((s) => s.ledger);
  const f = useStore((s) => s.filters);
  const setF = (patch: Partial<typeof f>) => set((s) => ({ filters: { ...s.filters, ...patch } }));
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginBottom: '16px' }} role="toolbar" aria-label="Filters">
      <button class="chip" aria-pressed={!f.country} onClick={() => setF({ country: '' })}>All countries</button>
      {countries.map((c) => (
        <button class="chip" aria-pressed={f.country === c.id} onClick={() => setF({ country: f.country === c.id ? '' : c.id })}>{c.name}</button>
      ))}
      <select class="select" style={{ height: '28px', borderRadius: '99px' }} value={f.sector} onChange={(e) => setF({ sector: (e.target as HTMLSelectElement).value })} aria-label="Sector">
        <option value="">All sectors</option>{SECTORS.map((s) => <option>{s}</option>)}
      </select>
      <button class="chip" style={{ borderStyle: 'dashed' }} onClick={() => set({ drawer: { kind: 'countries', edit: 'new' } })} title="Add a country">+ Country</button>
      <button class="btn ghost" style={{ height: '28px' }} onClick={() => set({ drawer: { kind: 'countries' } })}>Manage countries</button>
      {(f.country || f.sector) && <button class="btn ghost" style={{ height: '28px' }} onClick={() => setF({ country: '', sector: '' })}>Clear filters</button>}
    </div>
  );
}

export function Overview() {
  const state = useStore((s) => s);
  const P = filtered(state);
  const countries = state.ledger.countries;
  const cname = (id: string) => countries.find((c) => c.id === id)?.name ?? id;
  const T = totals(P, TODAY);
  const S = portfolioSeries(P, TODAY);
  const flags = attention(P, TODAY);
  const actualPts = S.filter((x) => x.actual != null);
  const gap = T.burn - T.elapsed;
  const open = (id: string) => set({ drawer: { kind: 'project', id } });
  const final = S.at(-1);

  if (!P.length) return <><Filters /><div class="card empty-page"><div><h2>No projects match</h2><p>Change the filters or add a project.</p></div></div></>;

  return (
    <>
      <Filters />
      <section class="hero" aria-label="Key figures">
        <div class="kpi lead">
          <span class="label">Spent to date</span>
          <span class="value">{short(T.spent)}</span>
          <span class="ctx"><b>{pct(T.burn)}</b> of {short(T.budget)} budget · {T.projects} projects</span>
          <div class="meter" title={`${pct(T.burn)} spent, ${pct(T.elapsed)} of time elapsed`}>
            <span style={{ width: `${Math.min(100, T.burn * 100)}%`, background: 'var(--c1)' }} />
            <span style={{ left: `${Math.min(100, T.burn * 100)}%`, width: `${Math.min(100 - T.burn * 100, (T.committed / T.budget) * 100)}%`, background: 'var(--c1)', opacity: 0.35 }} />
            <i class="tick" style={{ left: `calc(${T.elapsed * 100}% - 1px)` }} />
          </div>
          <span class="ctx" style={{ fontSize: '11.5px' }}><span><i style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '2px', background: 'var(--c1)', marginRight: '4px' }} />spent</span><span><i style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '2px', background: 'var(--c1)', opacity: .35, marginRight: '4px' }} />committed</span><span>│ time elapsed {pct(T.elapsed)}</span></span>
        </div>
        <div class="kpi">
          <span class="label">Burn vs time <span class={`badge ${gapTone(gap)}`}>{gapWord(gap)}</span></span>
          <span class="value">{signedPct(gap)}</span>
          <span class="ctx">spend share minus time share</span>
          <div class="spark"><Sparkline values={actualPts.map((x) => x.actual!)} target={actualPts.map((x) => x.plan)} /></div>
        </div>
        <div class="kpi">
          <span class="label">Committed</span>
          <span class="value">{short(T.committed)}</span>
          <span class="ctx"><b>{short(T.exposure)}</b> spent + committed</span>
        </div>
        <div class="kpi">
          <span class="label">Uncommitted balance</span>
          <span class="value" style={{ color: T.remaining < 0 ? 'var(--critical)' : undefined }}>{short(T.remaining)}</span>
          <span class="ctx">{final?.mid != null ? <>forecast end spend <b>{short(final.mid)}</b></> : 'no forecast'}</span>
        </div>
      </section>

      <div class="grid g-12">
        <section class="card span-8">
          <div class="card-h">
            <div><h2>Spending over time</h2><p>Cumulative actual spend, linear plan and forecast range (recent burn rate ±20%)</p></div>
          </div>
          <div class="card-b" style={{ paddingTop: '8px' }}>
            <div class="legend" style={{ marginBottom: '4px' }}>
              <span><i class="line" style={{ background: 'var(--c1)' }} />Actual</span>
              <span><i class="dash" />Linear plan</span>
              <span><i style={{ background: 'var(--c2)', opacity: .25 }} />Forecast range</span>
            </div>
            <Chart height={300} label="Cumulative spending over time" option={(t) => spendOption(t, S, T.budget)} />
          </div>
        </section>

        <section class="card span-4" style={{ display: 'flex', flexDirection: 'column' }}>
          <div class="card-h"><div><h2>Needs attention</h2><p>{flags.length ? `${flags.length} items, most severe first` : 'Nothing flagged'}</p></div></div>
          <ul class="att" style={{ marginTop: '12px', maxHeight: '352px', overflow: 'auto' }}>
            {flags.map((f) => {
              const p = P.find((x) => x.id === f.projectId)!;
              return (
                <li onClick={() => open(f.projectId)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && open(f.projectId)}>
                  <span class={`badge ${f.severity}`}>{f.severity}</span>
                  <div style={{ minWidth: 0 }}><div class="t">{f.title}</div><div class="d">{f.detail}</div></div>
                  <span class="code">{p.code}</span>
                </li>
              );
            })}
            {!flags.length && <li style={{ cursor: 'default' }}><span class="badge good">ok</span><div class="d">All projects within thresholds.</div><span /></li>}
          </ul>
        </section>

        <OverviewMap />

        <section class="card span-7">
          <div class="card-h"><div><h2>Pacing by project</h2><p>Share of budget spent; the tick marks time elapsed. Click a bar for details.</p></div></div>
          <div class="card-b"><Chart height={Math.max(180, P.length * 40 + 40)} label="Spend share by project with elapsed time" onClick={(e) => e.data?.id && open(e.data.id)} option={(t) => pacingOption(t, P)} /></div>
        </section>

        <section class="card span-5">
          <div class="card-h"><div><h2>Budget by country</h2><p>Click a country to filter the page</p></div></div>
          <div class="card-b">
            <div class="legend" style={{ marginBottom: '4px' }}>
              <span><i style={{ background: 'var(--c1)' }} />Spent</span><span><i style={{ background: 'var(--c3)' }} />Committed</span><span><i style={{ background: 'var(--surface-2)', border: '1px solid var(--line-strong)' }} />Uncommitted</span>
            </div>
            <Chart height={Math.max(160, groupBy(P, (p) => p.country).length * 52 + 30)} label="Budget by country" onClick={(e) => e.name && set((s) => ({ filters: { ...s.filters, country: countries.find((c) => c.name === e.name)?.id ?? '' } }))}
              option={(t) => countryOption(t, groupBy(P, (p) => p.country).map((g) => ({ ...g, key: cname(g.key) })))} />
          </div>
        </section>

        <section class="card span-4">
          <div class="card-h"><div><h2>Where the budget stands</h2><p>Budget → spent → committed → balance</p></div></div>
          <div class="card-b"><Chart height={330} label="Budget waterfall" option={(t) => waterfallOption(t, T)} /></div>
        </section>

        <section class="card span-8" style={{ overflow: 'hidden' }}>
          <div class="card-h" style={{ paddingBottom: '12px' }}><div><h2>Projects</h2><p>Double-click name or status to edit · drag column edges to resize</p></div></div>
          <ProjectTable rows={P} cname={cname} maxHeight={360} />
        </section>
      </div>
    </>
  );
}

function OverviewMap() {
  const L = useStore((s) => s.ledger);
  const f = useStore((s) => s.filters);
  const [mode, setMode] = useState<MapMode>('budget');
  const P = L.projects.filter((p) => !f.sector || p.sector === f.sector);
  return (
    <section class="card span-12">
      <div class="card-h" style={{ alignItems: 'center' }}>
        <div><h2>Portfolio map</h2><p>Numbers are project counts · select a country to filter the page · Ctrl + scroll to zoom</p></div>
        <div class="tools"><ModeSwitch mode={mode} setMode={setMode} only={['budget', 'used', 'pace', 'attention']} /></div>
      </div>
      <div class="card-b"><MapView compact countries={L.countries} data={mapData(L.countries, P)} mode={mode} height={380} selected={f.country || undefined}
        onSelect={(id) => set((s) => ({ filters: { ...s.filters, country: id ?? '' } }))} /></div>
    </section>
  );
}

export function ProjectTable({ rows, cname, maxHeight }: { rows: Project[]; cname: (id: string) => string; maxHeight: number }) {
  const cols: Column<Project>[] = [
    { key: 'code', label: 'Code', width: 96, pin: true, value: (p) => p.code, render: (p) => <span class="num" style={{ fontWeight: 600 }}>{p.code}</span> },
    { key: 'name', label: 'Name', width: 240, value: (p) => p.name, edit: { type: 'text', commit: (p, v) => v.trim() && updateProject(p.id, { name: v.trim() }) } },
    { key: 'pmm', label: 'PMM', width: 90, value: (p) => p.pmm ?? '', render: (p) => validUrl(p.pmmUrl) ? <a class="num" href={validUrl(p.pmmUrl)!} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{p.pmm || 'link'} ↗</a> : <span class="num">{p.pmm ?? ''}</span> },
    { key: 'country', label: 'Country', width: 110, value: (p) => cname(p.country) },
    { key: 'sector', label: 'Sector', width: 120, value: (p) => p.sector ?? '' },
    { key: 'budget', label: 'Budget', width: 110, align: 'r', sum: true, format: short, value: (p) => money(p).budget },
    { key: 'spent', label: 'Spent', width: 110, align: 'r', sum: true, format: short, value: (p) => money(p).spent },
    { key: 'committed', label: 'Committed', width: 110, align: 'r', sum: true, format: short, value: (p) => money(p).committed },
    {
      key: 'pace', label: 'Spent vs time', width: 170, value: (p) => burnGap(p, TODAY), render: (p) => {
        const m = money(p), b = m.budget ? m.spent / m.budget : 0, el = elapsed(p, TODAY);
        return <div class="bar-cell" title={`${pct(b)} spent · ${pct(el)} time`}><div class="minibar"><span style={{ width: `${Math.min(100, b * 100)}%` }} /><i style={{ left: `${el * 100}%` }} /></div><span class="num" style={{ fontSize: '12px' }}>{pct(b)}</span></div>;
      },
    },
    { key: 'gap', label: 'Pace', width: 100, value: (p) => burnGap(p, TODAY), render: (p) => { const g = burnGap(p, TODAY); return <span class={`badge ${gapTone(g)}`}>{signedPct(g)}</span>; } },
    { key: 'end', label: 'Ends', width: 100, value: (p) => p.end, render: (p) => month(p.end) },
    { key: 'status', label: 'Status', width: 100, value: (p) => p.status ?? 'Active', edit: { type: 'select', options: ['Active', 'Pipeline', 'Closed'], commit: (p, v) => updateProject(p.id, { status: v }) } },
  ];
  return (
    <DataTable rows={rows} columns={cols} rowKey={(p) => p.id} title="projects" storageKey="pl-cols-projects" maxHeight={maxHeight}
      groupBy={[{ label: 'country', key: (p) => cname(p.country) }, { label: 'sector', key: (p) => p.sector ?? '' }, { label: 'status', key: (p) => p.status ?? 'Active' }]}
      onOpen={(p) => set({ drawer: { kind: 'project', id: p.id } })}
      actions={(sel, clear) => sel.length > 0 && (
        <button class="btn danger" onClick={() => { if (confirm(`Delete ${sel.length} selected project${sel.length > 1 ? 's' : ''}? You can undo right after.`)) { deleteProjects(sel.map((p) => p.id)); clear(); } }}>
          Delete {sel.length}
        </button>
      )} />
  );
}

/* ---------------- chart options ---------------- */
export const axisMoney = (v: number) => (v === 0 ? '0' : Math.abs(v) >= 1e6 ? `€${+(v / 1e6).toFixed(1)}M` : `€${+(v / 1e3).toFixed(0)}K`);
export const axisX = (t: Tokens) => ({ axisLine: { lineStyle: { color: t.line } }, axisTick: { show: false }, axisLabel: { color: t.ink3, fontSize: 11, hideOverlap: true }, splitLine: { show: false } });
export const axisY = (t: Tokens) => ({ axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: t.ink3, fontSize: 11, fontFamily: t.mono, formatter: axisMoney }, splitLine: { lineStyle: { color: t.line } } });

export function spendOption(t: Tokens, S: ReturnType<typeof portfolioSeries>, budget: number) {
  const pick = (k: 'actual' | 'plan' | 'low' | 'mid') => S.filter((x) => x[k] != null).map((x) => [x.t, x[k]]);
  const band = S.filter((x) => x.low != null).map((x) => [x.t, x.high! - x.low!]);
  const row = (c: string, name: string, v: number | null | undefined, dash = false) => v == null ? '' :
    `<div style="display:flex;gap:16px;align-items:center"><span><i style="display:inline-block;width:10px;height:${dash ? 0 : 2}px;border-top:${dash ? `2px dashed ${c}` : 'none'};background:${dash ? 'none' : c};margin-right:6px;vertical-align:3px"></i>${name}</span><b style="margin-left:auto;font-family:${t.mono};font-weight:600">${full(v)}</b></div>`;
  return {
    ...base(t),
    grid: { left: 8, right: 16, top: 16, bottom: 40, containLabel: true },
    tooltip: {
      ...(base(t).tooltip as object), trigger: 'axis', axisPointer: { type: 'line', lineStyle: { color: t.ink3 } },
      formatter: (ps: any[]) => {
        const x = S.find((s) => s.t === ps[0].value[0]); if (!x) return '';
        return `<div style="min-width:220px"><div style="font-weight:650;margin-bottom:6px">${month(x.t)}</div>${row(t.c[0], 'Actual', x.actual)}${row(t.plan, 'Plan', x.plan, true)}${x.mid != null ? row(t.c[1], 'Forecast', x.mid, true) + `<div style="color:${t.ink3};font-size:11.5px;margin-top:2px">range ${short(x.low!)} – ${short(x.high!)}</div>` : ''}</div>`;
      },
    },
    xAxis: { type: 'time', ...axisX(t), axisLabel: { ...axisX(t).axisLabel, formatter: (v: number) => month(v) } },
    yAxis: { type: 'value', max: Math.ceil(budget / 1e6) * 1e6, ...axisY(t) },
    dataZoom: [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 6, borderColor: t.line, fillerColor: 'rgba(127,127,127,.12)', handleStyle: { color: t.surface, borderColor: t.ink3 }, textStyle: { color: t.ink3 }, dataBackground: { lineStyle: { color: t.line }, areaStyle: { color: t.surface2 } }, labelFormatter: (v: number) => month(v) }],
    series: [
      { name: 'Plan', type: 'line', data: pick('plan'), symbol: 'none', lineStyle: { color: t.plan, width: 1.5, type: 'dashed' }, z: 1,
        markLine: { silent: true, symbol: 'none', label: { formatter: 'Today', color: t.ink3, fontSize: 11 }, lineStyle: { color: t.ink3, type: 'solid', width: 1 }, data: [{ xAxis: TODAY.getTime() }] } },
      { name: 'low', type: 'line', data: pick('low'), stack: 'band', symbol: 'none', lineStyle: { opacity: 0 }, areaStyle: { opacity: 0 }, tooltip: { show: false } },
      { name: 'Range', type: 'line', data: band, stack: 'band', symbol: 'none', lineStyle: { opacity: 0 }, areaStyle: { color: t.c[1], opacity: 0.16 } },
      { name: 'Forecast', type: 'line', data: pick('mid'), symbol: 'none', lineStyle: { color: t.c[1], width: 2, type: [6, 4] } },
      { name: 'Actual', type: 'line', data: pick('actual'), symbol: 'none', lineStyle: { color: t.c[0], width: 2.5 }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: t.c[0] + '33' }, { offset: 1, color: t.c[0] + '00' }] } }, z: 3 },
    ],
  };
}

function pacingOption(t: Tokens, P: Project[]) {
  const R = P.map((p) => { const m = money(p); return { p, b: m.budget ? m.spent / m.budget : 0, c: m.budget ? m.committed / m.budget : 0, el: elapsed(p, TODAY), g: burnGap(p, TODAY) }; })
    .sort((a, b) => a.g - b.g).reverse();
  const tone = (g: number) => (g < -0.3 ? t.serious : g < -0.15 ? t.warn : g > 0.1 ? t.serious : t.c[0]);
  return {
    ...base(t),
    grid: { left: 8, right: 56, top: 8, bottom: 8, containLabel: true },
    tooltip: { ...(base(t).tooltip as object), trigger: 'item', formatter: (x: any) => { const r = R[x.dataIndex]; return `<b>${r.p.code}</b> ${r.p.name}<br/>Spent <b>${pct(r.b)}</b> · committed ${pct(r.c)}<br/>Time elapsed <b>${pct(r.el)}</b> → ${signedPct(r.g)}`; } },
    xAxis: { type: 'value', max: 1, ...axisY(t), axisLabel: { ...axisY(t).axisLabel, formatter: (v: number) => pct(v) } },
    yAxis: { type: 'category', inverse: true, data: R.map((r) => r.p.code), ...axisX(t), axisLabel: { color: t.ink2, fontFamily: t.mono, fontSize: 11.5 } },
    series: [
      { type: 'bar', stack: 's', barWidth: 14, data: R.map((r) => ({ value: r.b, id: r.p.id, itemStyle: { color: tone(r.g), borderRadius: [4, 0, 0, 4] } })),
},
      { type: 'bar', stack: 's', barWidth: 14, data: R.map((r) => ({ value: r.c, id: r.p.id, itemStyle: { color: tone(r.g), opacity: 0.35, borderRadius: [0, 4, 4, 0] } })),
},
      { type: 'custom', silent: true, data: R.map((r, i) => [r.el, i]), z: 5,
        renderItem: (_: any, api: any) => {
          const i = api.value(1), r = R[i];
          const [x, y] = api.coord([r.el, i]);
          const [xe] = api.coord([Math.min(1, r.b + r.c), i]);
          return { type: 'group', children: [
            { type: 'rect', shape: { x: x - 1, y: y - 12, width: 2.5, height: 24, r: 1 }, style: { fill: t.ink } },
            { type: 'text', x: Math.max(x, xe) + 10, y, style: { text: signedPct(r.g), fill: tone(r.g) === t.c[0] ? t.ink2 : tone(r.g), font: `600 11.5px ${t.mono}`, verticalAlign: 'middle' } },
          ] };
        } },
    ],
  };
}

function countryOption(t: Tokens, G: { key: string; budget: number; spent: number; committed: number }[]) {
  const mk = (name: string, f: (g: (typeof G)[number]) => number, color: string, r: number[]) =>
    ({ name, type: 'bar', stack: 'b', barWidth: 18, data: G.map(f), itemStyle: { color, borderRadius: r, borderColor: t.surface, borderWidth: 1 }, emphasis: { focus: 'series' } });
  return {
    ...base(t),
    grid: { left: 8, right: 24, top: 8, bottom: 8, containLabel: true },
    tooltip: { ...(base(t).tooltip as object), trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v: number) => full(v) },
    xAxis: { type: 'value', ...axisY(t) },
    yAxis: { type: 'category', inverse: true, data: G.map((g) => g.key), ...axisX(t), axisLabel: { color: t.ink2, fontSize: 12 } },
    series: [
      mk('Spent', (g) => g.spent, t.c[0], [4, 0, 0, 4]),
      mk('Committed', (g) => g.committed, t.c[2], [0, 0, 0, 0]),
      { ...mk('Uncommitted', (g) => Math.max(0, g.budget - g.spent - g.committed), t.surface2, [0, 4, 4, 0]), itemStyle: { color: t.surface2, borderColor: t.ink3, borderWidth: 0.5, borderRadius: [0, 4, 4, 0] } },
    ],
  };
}

function waterfallOption(t: Tokens, T: ReturnType<typeof totals>) {
  const steps = [
    { name: 'Budget', base: 0, v: T.budget, c: t.ink3 },
    { name: 'Spent', base: T.budget - T.spent, v: T.spent, c: t.c[0] },
    { name: 'Committed', base: T.budget - T.spent - T.committed, v: T.committed, c: t.c[2] },
    { name: 'Balance', base: 0, v: T.remaining, c: T.remaining < 0 ? t.critical : t.good },
  ];
  return {
    ...base(t),
    grid: { left: 8, right: 8, top: 24, bottom: 8, containLabel: true },
    tooltip: { ...(base(t).tooltip as object), trigger: 'item', formatter: (x: any) => `${steps[x.dataIndex].name}<br/><b style="font-family:${t.mono}">${full(steps[x.dataIndex].v)}</b>` },
    xAxis: { type: 'category', data: steps.map((s) => s.name), ...axisX(t), axisLabel: { color: t.ink2, fontSize: 11.5, interval: 0 } },
    yAxis: { type: 'value', ...axisY(t) },
    series: [
      { type: 'bar', stack: 'w', silent: true, data: steps.map((s) => s.base), itemStyle: { color: 'transparent' }, tooltip: { show: false } },
      { type: 'bar', stack: 'w', barWidth: '52%', data: steps.map((s) => ({ value: s.v, itemStyle: { color: s.c, borderRadius: 4 } })),
        label: { show: true, position: 'top', color: t.ink, fontFamily: t.mono, fontSize: 11.5, fontWeight: 600, formatter: (x: any) => short(steps[x.dataIndex].v) } },
    ],
  };
}
