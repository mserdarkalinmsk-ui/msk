import { staffCount, staffSplit } from '../domain/staff';
import { MoneyFlow } from '../ui/Visuals';
import { OfficeSummary } from './OfficeSummary';
import { deleteProjects, filtered, go, set, updateProject, useStore } from '../data/store';
import { burnGap, elapsed, groupBy, money, portfolioSeries, totals } from '../domain/calc';
import { SECTORS, validUrl, type Project } from '../domain/types';
import { alerts } from '../domain/insights';
import { TODAY } from '../today';
import { base, Chart, type Tokens } from '../ui/Chart';
import { DataTable, type Column } from '../ui/DataTable';
import { cents, full, month, pct, short, signedPct } from '../ui/format';
import { Sparkline } from '../ui/Sparkline';
import { Count } from '../ui/Count';
import { MapView, type MapMode } from '../ui/MapView';
import { mapData, ModeSwitch } from './MapPage';
import { useState } from 'preact/hooks';

const gapTone = (g: number) => (g < -0.3 ? 'serious' : g < -0.15 ? 'warning' : g > 0.1 ? 'serious' : 'good');
const gapWord = (g: number) => (g < -0.15 ? 'Behind' : g > 0.1 ? 'Ahead' : 'On track');

export function Filters() {
  const { countries } = useStore((s) => s.ledger);
  const f = useStore((s) => s.filters);
  const setF = (patch: Partial<typeof f>) => set((s) => ({ filters: { ...s.filters, ...patch } }));
  const scope = [f.country ? countries.find((c) => c.id === f.country)?.name ?? f.country : 'All countries', f.sector || 'all sectors'].join(' · ');
  return (
    <>
    <p class="print-scope">Scope: {scope} · printed {new Date().toISOString().slice(0, 10)}</p>
    <div class="filters-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginBottom: '16px' }} role="toolbar" aria-label="Filters">
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
    </>
  );
}

export function Overview() {
  const state = useStore((s) => s);
  const P = filtered(state);
  const countries = state.ledger.countries;
  const cname = (id: string) => countries.find((c) => c.id === id)?.name ?? id;
  const T = totals(P, TODAY), staff = staffCount(P, TODAY);
  const S = portfolioSeries(P, TODAY);
  const flags = alerts(P, TODAY);
  const actualPts = S.filter((x) => x.actual != null);
  const gap = T.burn - T.elapsed;
  const open = (id: string) => set({ drawer: { kind: 'project', id } });
  const final = S.at(-1);
  const [sm, setSm] = useState<'cumulative' | 'monthly' | 'country'>('cumulative');
  const [pm, setPm] = useState<'spent' | 'exposure' | 'gap'>('spent');
  const [bm, setBm] = useState<'country' | 'sector' | 'funding'>('country');
  const keyOf = (p: Project) => (bm === 'country' ? p.country : bm === 'sector' ? p.sector ?? '' : p.funding ?? '');

  if (!P.length) return <><Filters /><div class="card empty-page"><div><h2>No projects match</h2><p>Change the filters or add a project.</p></div></div></>;

  return (
    <>
      <Filters />
      <section class="hero" aria-label="Key figures">
        <div class="kpi">
          <span class="label">Total budget</span>
          <span class="value"><Count value={T.budget} format={short} /></span>
          <span class="ctx">{T.projects} project{T.projects === 1 ? '' : 's'} · {short(T.budget - T.exposure)} not yet spent or committed</span>
          {staff.total > 0 && <span class="ctx kpi-staff" title={staff.positions ? "People with a contract running today; projects without staff records count the staff positions of their latest report" : "People with a contract running today (from the staff records of the reports)"}><b>👥 {staff.total} staff</b><span>{staffSplit(staff)}</span></span>}
        </div>
        <div class="kpi lead">
          <span class="label">Spent to date</span>
          <span class="value"><Count value={T.spent} format={short} /></span>
          <span class="ctx"><b>{pct(T.burn)}</b> of {short(T.budget)} budget · {T.projects} projects</span>
          <div class="meter" title={`${pct(T.burn)} spent, ${pct(T.elapsed)} of time elapsed`}>
            <span style={{ width: `${Math.min(100, T.burn * 100)}%`, background: 'var(--c1)' }} />
            <span style={{ left: `${Math.min(100, T.burn * 100)}%`, width: `${Math.min(100 - T.burn * 100, (T.committed / T.budget) * 100)}%`, background: 'var(--c1)', opacity: 0.35 }} />
            <i class="tick" style={{ left: `calc(${T.elapsed * 100}% - 1px)` }} />
          </div>
          <span class="ctx" style={{ fontSize: '11.5px' }}><span><i style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '2px', background: 'var(--c1)', marginRight: '4px' }} />spent</span><span><i style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '2px', background: 'var(--c1)', opacity: .35, marginRight: '4px' }} />committed</span><span>│ time elapsed {pct(T.elapsed)}</span></span>
        </div>
        <div class="kpi">
          <span class="label">Pace vs time <span class={`badge ${gapTone(gap)}`}>{gapWord(gap)}</span></span>
          <span class="value"><Count value={gap} format={signedPct} /></span>
          <span class="ctx">percentage points {gap < 0 ? "behind" : "ahead of"} the time elapsed ({pct(T.burn)} spent · {pct(T.elapsed)} of time)</span>
          <div class="spark"><Sparkline values={actualPts.map((x) => x.actual!)} target={actualPts.map((x) => x.plan)} /></div>
        </div>
        <div class="kpi">
          <span class="label">Committed</span>
          <span class="value"><Count value={T.committed} format={short} /></span>
          <span class="ctx"><b>{short(T.exposure)}</b> spent + committed</span>
        </div>
        <div class="kpi">
          <span class="label">Uncommitted balance</span>
          <span class="value" style={{ color: T.remaining < 0 ? 'var(--critical)' : undefined }}><Count value={T.remaining} format={short} /></span>
          <span class="ctx">{final?.mid != null ? <>forecast end spend <b>{short(final.mid)}</b></> : 'no forecast'}</span>
        </div>
      </section>

      <div class="grid g-12">
        <section class="card span-8">
          <div class="card-h" style={{ alignItems: 'center' }}>
            <div><h2>Spending over time</h2><p>{sm === 'cumulative' ? 'Cumulative actual spend, linear plan and forecast range (recent burn rate ±20%)' : sm === 'monthly' ? 'Spend added each month (interpolated between reports) against the linear plan' : 'Cumulative spend stacked by country'} · click a month for its breakdown</p></div>
            <div class="tools"><div class="seg">{(['cumulative', 'monthly', 'country'] as const).map((m) => <button aria-pressed={sm === m} onClick={() => setSm(m)}>{m === 'cumulative' ? 'Cumulative' : m === 'monthly' ? 'Monthly' : 'By country'}</button>)}</div></div>
          </div>
          <div class="card-b" style={{ paddingTop: '8px' }}>
            {sm === 'cumulative' && <div class="legend" style={{ marginBottom: '4px' }}>
              <span><i class="line" style={{ background: 'var(--c1)' }} />Actual</span>
              <span><i class="dash" />Linear plan</span>
              <span><i style={{ background: 'var(--c2)', opacity: .25 }} />Forecast range</span>
            </div>}
            <Chart height={300} label="Spending over time" onAxisClick={(x) => {
              const A = S.filter((v) => v.actual != null);
              const tt = sm === 'monthly' ? A[Math.round(x) + 1]?.t : A.reduce((b, v) => Math.abs(v.t - x) < Math.abs(b.t - x) ? v : b, A[0])?.t;
              const i = S.findIndex((v) => v.t === tt);
              if (i > 0) set({ drawer: { kind: 'period', t: S[i].t, from: S[i - 1].t, ids: P.map((p) => p.id) } });
            }} option={(t) => sm === 'cumulative' ? spendOption(t, S, T.budget) : sm === 'monthly' ? monthlyOption(t, S) : byCountryOption(t, P, countries)} />
          </div>
        </section>

        <section class="card span-4" style={{ display: 'flex', flexDirection: 'column' }}>
          <div class="card-h"><div><h2>Needs attention</h2><p>{flags.length ? `${flags.length} items, most severe first` : 'Nothing flagged'}</p></div><button class="btn ghost" style={{ marginLeft: 'auto', height: '28px' }} onClick={() => go('reports/alerts')}>Alert centre →</button></div>
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
        <section class="card span-5">
          <div class="card-h"><div><h2>Where the budget stands</h2><p>Budget → spent → committed → balance</p></div></div>
          <div class="card-b"><Chart height={300} label="Budget waterfall" option={(t) => waterfallOption(t, T)} /></div>
        </section>

        <OfficeSummary variant="card" />

        <section class="card span-7">
          <div class="card-h" style={{ alignItems: 'center' }}><div><h2>Pacing by project</h2><p>{pm === 'gap' ? 'Spend share minus time share — left of zero is behind schedule' : 'Share of budget used; the tick marks time elapsed'} · click a bar for details</p></div>
            <div class="tools"><div class="seg">{(['spent', 'exposure', 'gap'] as const).map((m) => <button aria-pressed={pm === m} onClick={() => setPm(m)}>{m === 'spent' ? 'Spent' : m === 'exposure' ? '+ Committed' : 'Gap'}</button>)}</div></div></div>
          <div class="card-b"><Chart height={Math.max(180, P.length * 40 + 40)} label="Pacing by project" onClick={(e) => e.data?.id && open(e.data.id)} option={(t) => pm === 'gap' ? gapOption(t, P) : pacingOption(t, P, pm === 'exposure')} /></div>
        </section>

        <section class="card span-5">
          <div class="card-h" style={{ alignItems: 'center' }}><div><h2>Budget by {bm}</h2><p>Click a bar to filter the page</p></div>
            <div class="tools"><div class="seg">{(['country', 'sector', 'funding'] as const).map((m) => <button aria-pressed={bm === m} onClick={() => setBm(m)}>{m[0].toUpperCase() + m.slice(1)}</button>)}</div></div></div>
          <div class="card-b">
            <div class="legend" style={{ marginBottom: '4px' }}>
              <span><i style={{ background: 'var(--c1)' }} />Spent</span><span><i style={{ background: 'var(--c3)' }} />Committed</span><span><i style={{ background: 'var(--surface-2)', border: '1px solid var(--line-strong)' }} />Uncommitted</span>
            </div>
            <Chart height={Math.max(160, groupBy(P, keyOf).length * 52 + 30)} label={`Budget by ${bm}`} onClick={(e) => {
              if (!e.name) return;
              if (bm === 'country') set((s) => ({ filters: { ...s.filters, country: countries.find((c) => c.name === e.name)?.id ?? '' } }));
              else if (bm === 'sector') set((s) => ({ filters: { ...s.filters, sector: s.filters.sector === e.name ? '' : e.name } }));
              else set((s) => ({ filters: { ...s.filters, q: s.filters.q === e.name ? '' : e.name } }));
            }} option={(t) => countryOption(t, groupBy(P, keyOf).map((g) => ({ ...g, key: bm === 'country' ? cname(g.key) : g.key })))} />
          </div>
        </section>


        <MoneyFlow P={P} countries={countries} />
        <section class="card span-12" style={{ overflow: 'hidden' }}>
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
    <section class="card span-7">
      <div class="card-h" style={{ alignItems: 'center' }}>
        <div><h2>Portfolio map</h2><p>Numbers are project counts · select a country to filter the page · Ctrl + scroll to zoom</p></div>
        <div class="tools"><ModeSwitch mode={mode} setMode={setMode} only={['budget', 'used', 'pace', 'attention']} /></div>
      </div>
      <div class="card-b"><MapView compact countries={L.countries} data={mapData(L.countries, P)} mode={mode} height={300} selected={f.country || undefined}
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
    { key: 'budget', label: 'Budget', width: 140, align: 'r', sum: true, format: cents, value: (p) => money(p).budget },
    { key: 'spent', label: 'Spent', width: 140, align: 'r', sum: true, format: cents, value: (p) => money(p).spent },
    { key: 'committed', label: 'Committed', width: 140, align: 'r', sum: true, format: cents, value: (p) => money(p).committed },
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
function monthlyOption(t: Tokens, S: ReturnType<typeof portfolioSeries>) {
  const A = S.filter((x) => x.actual != null);
  const M = A.map((x, i) => ({ t: x.t, v: i ? x.actual! - A[i - 1].actual! : 0, plan: i ? x.plan - A[i - 1].plan : 0 })).slice(1);
  return {
    ...base(t), grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
    tooltip: { ...(base(t).tooltip as object), trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (ps: any[]) => { const x = M[ps[0].dataIndex]; return `<b>${month(x.t)}</b><br/>Spent ${full(x.v)}<br/><span style="color:${t.ink3}">plan ${full(x.plan)}</span>`; } },
    xAxis: { type: 'category', data: M.map((x) => month(x.t)), ...axisX(t) },
    yAxis: { type: 'value', ...axisY(t), axisLabel: { ...axisY(t).axisLabel, formatter: axisMoney } },
    series: [
      { type: 'bar', data: M.map((x) => ({ value: x.v, itemStyle: { color: x.v < x.plan * 0.7 ? t.warn : t.c[0], borderRadius: [3, 3, 0, 0] } })), barWidth: '62%' },
      { type: 'line', data: M.map((x) => x.plan), symbol: 'none', lineStyle: { color: t.plan, type: 'dashed', width: 1.5 } },
    ],
  };
}

function byCountryOption(t: Tokens, P: Project[], countries: { id: string; name: string }[]) {
  const ids = [...new Set(P.map((p) => p.country))].sort((a, b) => totals(P.filter((p) => p.country === b), TODAY).budget - totals(P.filter((p) => p.country === a), TODAY).budget);
  const S = ids.map((id) => portfolioSeries(P.filter((p) => p.country === id), TODAY).filter((x) => x.actual != null));
  const all = [...new Set(S.flat().map((x) => x.t))].sort((a, b) => a - b);
  return {
    ...base(t), grid: { left: 8, right: 16, top: 30, bottom: 8, containLabel: true },
    legend: { top: 0, left: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10, textStyle: { color: t.ink2, fontSize: 11.5 } },
    tooltip: { ...(base(t).tooltip as object), trigger: 'axis', valueFormatter: (v: number) => full(v) },
    xAxis: { type: 'time', ...axisX(t), axisLabel: { ...axisX(t).axisLabel, formatter: (v: number) => month(v) } },
    yAxis: { type: 'value', ...axisY(t), axisLabel: { ...axisY(t).axisLabel, formatter: axisMoney } },
    series: ids.map((id, i) => ({
      name: countries.find((c) => c.id === id)?.name ?? id, type: 'line', stack: 'c', symbol: 'none', smooth: 0.2,
      data: all.map((tt) => [tt, S[i].find((x) => x.t === tt)?.actual ?? S[i].filter((x) => x.t < tt).at(-1)?.actual ?? 0]),
      lineStyle: { width: 1.5, color: t.c[i % 8] }, itemStyle: { color: t.c[i % 8] }, areaStyle: { color: t.c[i % 8], opacity: 0.5 }, emphasis: { focus: 'series' },
    })),
  };
}

function gapOption(t: Tokens, P: Project[]) {
  const R = P.map((p) => ({ p, g: burnGap(p, TODAY) })).sort((a, b) => a.g - b.g);
  return {
    ...base(t), grid: { left: 8, right: 40, top: 8, bottom: 8, containLabel: true },
    tooltip: { ...(base(t).tooltip as object), trigger: 'item', formatter: (x: any) => `<b>${R[x.dataIndex].p.code}</b> ${R[x.dataIndex].p.name}<br/>${signedPct(R[x.dataIndex].g)}` },
    xAxis: { type: 'value', ...axisY(t), axisLabel: { ...axisY(t).axisLabel, formatter: (v: number) => signedPct(v) } },
    yAxis: { type: 'category', data: R.map((r) => r.p.code), ...axisX(t), axisLabel: { color: t.ink2, fontFamily: t.mono, fontSize: 11.5 } },
    series: [{ type: 'bar', barWidth: 14, data: R.map((r) => ({ value: r.g, id: r.p.id, itemStyle: { color: r.g < -0.3 || r.g > 0.1 ? t.serious : r.g < -0.15 ? t.warn : t.c[0], borderRadius: r.g < 0 ? [4, 0, 0, 4] : [0, 4, 4, 0] } })),
      label: { show: true, position: 'outside', color: t.ink2, fontFamily: t.mono, fontSize: 11, formatter: (x: any) => signedPct(x.value) },
      markLine: { silent: true, symbol: 'none', label: { show: false }, lineStyle: { color: t.ink3, type: 'solid' }, data: [{ xAxis: 0 }] } }],
  };
}

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

function pacingOption(t: Tokens, P: Project[], exposure = false) {
  const R = P.map((p) => { const m = money(p); const b = m.budget ? m.spent / m.budget : 0, c = m.budget ? m.committed / m.budget : 0; return { p, b, c, el: elapsed(p, TODAY), g: exposure ? b + c - elapsed(p, TODAY) : burnGap(p, TODAY) }; })
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
