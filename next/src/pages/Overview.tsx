import { paceBand, paceTone } from '../domain/rules';
import { staffCount, staffSplit } from '../domain/staff';
import { OverviewCountries } from './CountryDesk';
import { BudgetHealth } from './BudgetHealth';
import { deleteProjects, filtered, go, set, updateProject, useStore } from '../data/store';
import { asOf, burnGap, elapsed, groupBy, money, portfolioSeries, portfolioSoFar, totals } from '../domain/calc';
import { dmy } from '../domain/dt';
import { SECTORS, validUrl, type Project } from '../domain/types';
import { alerts } from '../domain/insights';
import { TODAY } from '../today';
import { base, Chart, type Tokens } from '../ui/Chart';
import { DataTable, type Column } from '../ui/DataTable';
import { cents, date, esc, full, month, pct, short, signedPct } from '../ui/format';
import { Sparkline } from '../ui/Sparkline';
import { Count } from '../ui/Count';
import { openAlerts } from '../domain/worklist';
import { useState } from 'preact/hooks';

const gapTone = paceTone;
const gapWord = (g: number) => ({ 'far-behind': 'Behind', behind: 'Behind', ahead: 'Ahead', ok: 'On track' })[paceBand(g)];

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
      <button class="btn primary ov-present" style={{ height: '28px', marginLeft: 'auto' }} title="The portfolio story, full screen: five slides, one message each (the filters above apply)" onClick={() => { try { sessionStorage.setItem('pl-present', '1'); } catch { /* */ } go('reports/story'); }}>▶ Present</button>
      {(f.country || f.sector) && <button class="btn ghost" style={{ height: '28px' }} onClick={() => setF({ country: '', sector: '' })}>Clear filters</button>}
    </div>
    </>
  );
}

/* Headline-tile icons: 24px line drawings in the label colour. */
const I = {
  wallet: 'M3 7.5A2.5 2.5 0 0 1 5.5 5H18v3M3 7.5V17a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5.5A2.5 2.5 0 0 1 3 7.5ZM16 13.5h.01',
  trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  pace: 'M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18ZM12 7v5l3 2',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  coins: 'M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3ZM4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6',
};
const Ico = ({ d }: { d: string }) => <i class="sc-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d={d} /></svg></i>;
/** A flat ring: the share filled, the figure in the middle. */
function Ring({ share, label }: { share: number; label: string }) {
  const r = 26, c = 2 * Math.PI * r, v = Math.max(0, Math.min(1, share));
  return <div class="sc-ring" title={`${pct(v)} ${label}`}><svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
    <circle cx="32" cy="32" r={r} fill="none" stroke="var(--surface-2)" stroke-width="7" />
    <circle cx="32" cy="32" r={r} fill="none" stroke="var(--c7)" stroke-width="7" stroke-linecap="round" stroke-dasharray={`${(c * v).toFixed(1)} ${c.toFixed(1)}`} transform="rotate(-90 32 32)" />
  </svg><span><b>{pct(v)}</b><small>{label}</small></span></div>;
}

export function Overview() {
  const state = useStore((s) => s);
  const P = filtered(state);
  const countries = state.ledger.countries;
  const cname = (id: string) => countries.find((c) => c.id === id)?.name ?? id;
  const T = totals(P, TODAY), staff = staffCount(P, TODAY);
  const S = portfolioSeries(P, TODAY);
  const allFlags = alerts(P, TODAY), flags = openAlerts(allFlags, state.ledger.alertMarks, TODAY), parked = allFlags.length - flags.length;
  const actualPts = S.filter((x) => x.actual != null);
  const gap = T.burn - T.elapsed;
  const open = (id: string) => set({ drawer: { kind: 'project', id } });
  const final = S.at(-1);
  const [sm, setSm] = useState<'cumulative' | 'remaining' | 'monthly' | 'country'>('cumulative');
  const [bm, setBm] = useState<'country' | 'sector' | 'funding'>('country');
  const keyOf = (p: Project) => (bm === 'country' ? p.country : bm === 'sector' ? p.sector ?? '' : p.funding ?? '');

  if (!P.length) return <><Filters /><div class="card empty-page"><div><h2>No projects match</h2><p>Change the filters or add a project.</p></div></div></>;

  return (
    <>
      <Filters />
      <section class="hero showcase" aria-label="Key figures">
        <div class="kpi">
          <span class="label"><Ico d={I.wallet} />Total budget</span>
          <span class="value"><Count value={T.budget} format={short} /></span>
          <span class="ctx">{T.projects} project{T.projects === 1 ? '' : 's'} · {short(T.budget - T.exposure)} not yet spent or committed</span>
          <div class="sc-split" title={`Spent ${pct(T.burn)} · committed ${pct(T.committed / (T.budget || 1))} · free ${pct(Math.max(0, T.budget - T.exposure) / (T.budget || 1))}`}>
            <span style={{ flex: Math.max(0, T.spent) }} class="s" /><span style={{ flex: Math.max(0, T.committed) }} class="c" /><span style={{ flex: Math.max(0, T.budget - T.exposure) }} class="f" />
          </div>
          {staff.total > 0 && <span class="ctx kpi-staff" title={staff.positions ? "People with a contract running today; projects without staff records count the staff positions of their latest report" : "People with a contract running today (from the staff records of the reports)"}><b>{staff.total} staff</b><span>{staffSplit(staff)}</span></span>}
        </div>
        <div class="kpi lead">
          <span class="label"><Ico d={I.trend} />Spent to date</span>
          <span class="value"><Count value={T.spent} format={short} /></span>
          <span class="ctx"><b>{pct(T.burn)}</b> of {short(T.budget)} budget · {T.projects} projects</span>
          <div class="meter" title={`${pct(T.burn)} spent, ${pct(T.elapsed)} of time elapsed`}>
            <span class="m-s" style={{ width: `${Math.min(100, T.burn * 100)}%` }} />
            <span class="m-c" style={{ left: `${Math.min(100, T.burn * 100)}%`, width: `${Math.max(0, Math.min(100 - T.burn * 100, (T.committed / (T.budget || 1)) * 100))}%` }} />
            <i class="tick" style={{ left: `calc(${Math.min(100, T.elapsed * 100)}% - 1px)` }} />
          </div>
          <span class="ctx sc-key"><span><i class="k-s" />spent</span><span><i class="k-c" />committed</span><span><i class="k-t" />time elapsed {pct(T.elapsed)}</span></span>
        </div>
        <div class="kpi" data-tone={({ good: 'good', warning: 'warn', serious: 'bad' } as const)[gapTone(gap)]}>
          <span class="label"><Ico d={I.pace} />Pace vs time <span class={`badge ${gapTone(gap)}`}>{gapWord(gap)}</span></span>
          <span class="value"><Count value={gap} format={signedPct} /></span>
          <span class="ctx">percentage points {gap < 0 ? "behind" : "ahead of"} the time elapsed ({pct(T.burn)} spent · {pct(T.elapsed)} of time)</span>
          <div class="spark"><Sparkline values={actualPts.map((x) => x.actual!)} target={actualPts.map((x) => x.plan)} height={44} /></div>
        </div>
        <div class="kpi">
          <span class="label"><Ico d={I.lock} />Committed</span>
          <div class="sc-row">
            <span class="value"><Count value={T.committed} format={short} /></span>
            <Ring share={T.exposure > 0 ? T.committed / T.exposure : 0} label="of S+C" />
          </div>
          <span class="ctx"><b>{short(T.exposure)}</b> spent + committed</span>
        </div>
        <div class="kpi" data-tone={T.remaining < 0 ? 'bad' : undefined}>
          <span class="label"><Ico d={I.coins} />Uncommitted balance</span>
          <span class="value"><Count value={T.remaining} format={short} /></span>
          <span class="ctx">{final?.mid != null ? <>forecast end spend <b>{short(final.mid)}</b></> : 'no forecast'}</span>
          {final?.mid != null && T.budget > 0 && <div class="sc-fc" title={`The forecast reaches ${pct(final.mid / T.budget)} of the budget by the last end date`}>
            <div class="sc-fc-bar"><span style={{ width: `${Math.min(100, (final.mid / T.budget) * 100)}%` }} /></div>
            <span class="sc-fc-l">forecast uses <b>{pct(final.mid / T.budget)}</b> of the budget</span>
          </div>}
        </div>
      </section>

      <div class="grid g-12">
        <section class="card span-8">
          <div class="card-h" style={{ alignItems: 'center' }}>
            <div><h2>Spending over time</h2><p>{sm === 'remaining' ? 'Funds left: starts at the total budget and goes down with the spending — when the forecast reaches zero the money runs out before the end' : sm === 'cumulative' ? 'Cumulative actual spend, linear plan and forecast range (recent burn rate ±20%)' : sm === 'monthly' ? 'Spend added each month (interpolated between reports) against the linear plan' : 'Cumulative spend stacked by country'}{sm === 'remaining' ? '' : ' · click a month for its breakdown'}</p></div>
            <div class="tools"><div class="seg">{(['cumulative', 'remaining', 'monthly', 'country'] as const).map((m) => <button aria-pressed={sm === m} onClick={() => setSm(m)}>{m === 'cumulative' ? 'Cumulative' : m === 'remaining' ? 'Funds left' : m === 'monthly' ? 'Monthly' : 'By country'}</button>)}</div></div>
          </div>
          <div class="card-b" style={{ paddingTop: '8px' }}>
            {(sm === 'cumulative' || sm === 'remaining') && <div class="legend" style={{ marginBottom: '4px' }}>
              <span><i class="line" style={{ background: 'var(--c1)' }} />Actual</span>
              <span><i class="dash" />Linear plan</span>
              <span><i style={{ background: 'var(--c2)', opacity: .25 }} />Forecast range</span>
            </div>}
            <Chart height={300} label="Spending over time" onAxisClick={(x) => {
              if (sm === 'remaining') return;
              const A = S.filter((v) => v.actual != null);
              const so = sm === 'monthly' ? portfolioSoFar(P) : null;
              if (so && Math.round(x) + 1 >= A.length) { set({ drawer: { kind: 'period', t: so.t, from: so.from, ids: P.map((p) => p.id) } }); return; }
              const tt = sm === 'monthly' ? A[Math.round(x) + 1]?.t : A.reduce((b, v) => Math.abs(v.t - x) < Math.abs(b.t - x) ? v : b, A[0])?.t;
              const i = S.findIndex((v) => v.t === tt);
              if (i > 0) set({ drawer: { kind: 'period', t: S[i].t, from: S[i - 1].t, ids: P.map((p) => p.id) } });
            }} option={(t) => sm === 'cumulative' ? spendOption(t, S, T.budget, endMarks(P)) : sm === 'remaining' ? remainingOption(t, S, T.budget, endMarks(P)) : sm === 'monthly' ? monthlyOption(t, S, portfolioSoFar(P)) : byCountryOption(t, P, countries)} />
          </div>
        </section>

        <section class="card span-4" style={{ display: 'flex', flexDirection: 'column' }}>
          <div class="card-h"><div><h2>Needs attention</h2><p>{flags.length ? `${flags.length} open, most severe first` : 'Nothing open'}{parked ? ` · ${parked} handled or snoozed` : ''}</p></div><button class="btn ghost" style={{ marginLeft: 'auto', height: '28px' }} onClick={() => go('reports/alerts')}>Alert centre →</button></div>
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
            {!flags.length && <li style={{ cursor: 'default' }}><span class="badge good">ok</span><div class="d">{parked ? 'Every alert is handled or snoozed.' : 'All projects within thresholds.'}</div><span /></li>}
          </ul>
        </section>
        <BudgetHealth P={P} />

        <OverviewCountries />
        <section class="card span-5">
          <div class="card-h"><div><h2>Where the budget stands</h2><p>Budget → spent → committed → balance</p></div></div>
          <div class="card-b"><Chart height={300} label="Budget waterfall" option={(t) => waterfallOption(t, T)} /></div>
        </section>


        <section class="card span-12">
          <div class="card-h" style={{ alignItems: 'center' }}><div><h2>Budget by {bm}</h2><p>Click a bar to filter the page</p></div>
            <div class="tools"><div class="seg">{(['country', 'sector', 'funding'] as const).map((m) => <button aria-pressed={bm === m} onClick={() => setBm(m)}>{m[0].toUpperCase() + m.slice(1)}</button>)}</div></div></div>
          <div class="card-b">
            <div class="legend" style={{ marginBottom: '4px' }}>
              <span><i style={{ background: 'var(--c1)' }} />Spent</span><span><i style={{ background: 'var(--s-committed)' }} />Committed</span><span><i style={{ background: 'var(--surface-2)', border: '1px solid var(--line-strong)' }} />Uncommitted</span>
            </div>
            <Chart height={Math.max(160, groupBy(P, keyOf).length * 52 + 30)} label={`Budget by ${bm}`} onClick={(e) => {
              if (!e.name) return;
              if (bm === 'country') set((s) => ({ filters: { ...s.filters, country: countries.find((c) => c.name === e.name)?.id ?? '' } }));
              else if (bm === 'sector') set((s) => ({ filters: { ...s.filters, sector: s.filters.sector === e.name ? '' : e.name } }));
              else set((s) => ({ filters: { ...s.filters, q: s.filters.q === e.name ? '' : e.name } }));
            }} option={(t) => countryOption(t, groupBy(P, keyOf).map((g) => ({ ...g, key: bm === 'country' ? cname(g.key) : g.key })))} />
          </div>
        </section>


        <section class="card span-12" style={{ overflow: 'hidden' }}>
          <div class="card-h" style={{ paddingBottom: '12px' }}><div><h2>All projects</h2><p>The register of every project · open one for its detail, or its country for the place · Double-click name or status to edit · drag column edges to resize</p></div></div>
          <ProjectTable rows={P} cname={cname} maxHeight={360} />
        </section>
      </div>
    </>
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
        const m = money(p), b = m.budget ? m.spent / m.budget : 0, el = elapsed(p, asOf(p, TODAY));
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
function monthlyOption(t: Tokens, S: ReturnType<typeof portfolioSeries>, so?: ReturnType<typeof portfolioSoFar>) {
  const A = S.filter((x) => x.actual != null);
  const M: { t: number; v: number; plan: number; to?: number }[] = A.map((x, i) => ({ t: x.t, v: i ? x.actual! - A[i - 1].actual! : 0, plan: i ? x.plan - A[i - 1].plan : 0 })).slice(1);
  // The month in progress, to the latest report: shown "so far" (lighter) rather than left out.
  if (so && (!M.length || so.t > M.at(-1)!.t)) M.push({ t: so.t, v: so.actual, plan: so.plan, to: so.t });
  return {
    ...base(t), grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
    tooltip: { ...(base(t).tooltip as object), trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (ps: any[]) => { const x = M[ps[0].dataIndex]; return `<b>${month(x.t)}${x.to ? ` · so far, to ${dmy(new Date(x.to).toISOString())}` : ''}</b><br/>Spent ${full(x.v)}<br/><span style="color:${t.ink3}">plan ${full(x.plan)}</span>`; } },
    xAxis: { type: 'category', data: M.map((x) => (x.to ? `${month(x.t)} (so far)` : month(x.t))), ...axisX(t) },
    yAxis: { type: 'value', ...axisY(t), axisLabel: { ...axisY(t).axisLabel, formatter: axisMoney } },
    series: [
      { type: 'bar', data: M.map((x) => ({ value: x.v, itemStyle: { color: x.v < x.plan * 0.7 ? t.warn : t.c[0], opacity: x.to ? 0.55 : 1, borderRadius: [3, 3, 0, 0] } })), barWidth: '62%' },
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
    legend: { top: 0, left: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10, textStyle: { color: t.ink2, fontSize: 12 } },
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


export const axisMoney = (v: number) => (v === 0 ? '0' : Math.abs(v) >= 1e6 ? `€${+(v / 1e6).toFixed(1)}M` : `€${+(v / 1e3).toFixed(0)}K`);
export const axisX = (t: Tokens) => ({ axisLine: { lineStyle: { color: t.line } }, axisTick: { show: false }, axisLabel: { color: t.ink3, fontSize: 11, hideOverlap: true }, splitLine: { show: false } });
export const axisY = (t: Tokens) => ({ axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: t.ink3, fontSize: 11, fontFamily: t.mono, formatter: axisMoney }, splitLine: { lineStyle: { color: t.line } } });

/** `ends`: the end dates to mark (projects, or the portfolio's last end), drawn as dashed lines with the budget ceiling. */
export function spendOption(t: Tokens, S: ReturnType<typeof portfolioSeries>, budget: number, ends: { t: number; label: string }[] = []) {
  const pick = (k: 'actual' | 'plan' | 'low' | 'mid') => S.filter((x) => x[k] != null).map((x) => [x.t, x[k]]);
  const band = S.filter((x) => x.low != null).map((x) => [x.t, x.high! - x.low!]);
  const row = (c: string, name: string, v: number | null | undefined, dash = false) => v == null ? '' :
    `<div style="display:flex;gap:16px;align-items:center"><span><i style="display:inline-block;width:10px;height:${dash ? 0 : 2}px;border-top:${dash ? `2px dashed ${c}` : 'none'};background:${dash ? 'none' : c};margin-right:6px;vertical-align:3px"></i>${name}</span><b style="margin-left:auto;font-family:${t.mono};font-weight:600">${full(v)}</b></div>`;
  return {
    ...base(t),
    grid: { left: 8, right: ends.length ? 72 : 16, top: 22, bottom: 40, containLabel: true },
    tooltip: {
      ...(base(t).tooltip as object), trigger: 'axis', axisPointer: { type: 'line', lineStyle: { color: t.ink3 } },
      formatter: (ps: any[]) => {
        const x = S.find((s) => s.t === ps[0].value[0]); if (!x) return '';
        return `<div style="min-width:220px"><div style="font-weight:600;margin-bottom:6px">${month(x.t)}</div>${row(t.c[0], 'Actual', x.actual)}${row(t.plan, 'Plan', x.plan, true)}${x.mid != null ? row(t.c[1], 'Forecast', x.mid, true) + `<div style="color:${t.ink3};font-size:12px;margin-top:2px">range ${short(x.low!)} – ${short(x.high!)}</div>` : ''}</div>`;
      },
    },
    xAxis: { type: 'time', ...axisX(t), axisLabel: { ...axisX(t).axisLabel, formatter: (v: number) => month(v) } },
    yAxis: { type: 'value', max: Math.ceil(budget / 1e6) * 1e6, ...axisY(t) },
    dataZoom: [{ type: 'inside' }, { type: 'slider', bottom: 6, labelFormatter: (v: number) => month(v) }],
    series: [
      { name: 'Plan', type: 'line', data: pick('plan'), symbol: 'none', lineStyle: { color: t.plan, width: 1.5, type: 'dashed' }, z: 1,
        markLine: { silent: true, symbol: 'none', label: { formatter: 'Today', color: t.ink3, fontSize: 11 }, lineStyle: { color: t.ink3, type: 'solid', width: 1 }, data: [{ xAxis: TODAY.getTime() },
          ...ends.map((e) => ({ xAxis: e.t, label: { formatter: e.label, color: t.serious, fontSize: 11, fontWeight: 600 }, lineStyle: { color: t.serious, type: 'dashed', width: 1.5 } })),
          ...(ends.length ? [{ yAxis: budget, label: { formatter: `Budget ${axisMoney(budget)}`, position: 'insideStartTop', color: t.ink2, fontSize: 11 }, lineStyle: { color: t.ink2, type: 'dotted', width: 1 } }] : [])] } },
      { name: 'low', type: 'line', data: pick('low'), stack: 'band', symbol: 'none', lineStyle: { opacity: 0 }, areaStyle: { opacity: 0 }, tooltip: { show: false } },
      { name: 'Range', type: 'line', data: band, stack: 'band', symbol: 'none', lineStyle: { opacity: 0 }, areaStyle: { color: t.c[1], opacity: 0.16 } },
      { name: 'Forecast', type: 'line', data: pick('mid'), symbol: 'none', lineStyle: { color: t.c[1], width: 2, type: [6, 4] } },
      { name: 'Actual', type: 'line', data: pick('actual'), symbol: 'none', lineStyle: { color: t.c[0], width: 2.5 }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: t.c[0] + '33' }, { offset: 1, color: t.c[0] + '00' }] } }, z: 3 },
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
      mk('Committed', (g) => g.committed, t.committed, [0, 0, 0, 0]),
      { ...mk('Uncommitted', (g) => Math.max(0, g.budget - g.spent - g.committed), t.surface2, [0, 4, 4, 0]), __flat: true, itemStyle: { color: t.surface2, borderColor: t.line, borderWidth: 1, borderRadius: [0, 4, 4, 0] } },
    ],
  };
}

function waterfallOption(t: Tokens, T: ReturnType<typeof totals>) {
  const steps = [
    { name: 'Budget', base: 0, v: T.budget, c: t.plan },
    { name: 'Spent', base: T.budget - T.spent, v: T.spent, c: t.c[0] },
    { name: 'Committed', base: T.budget - T.spent - T.committed, v: T.committed, c: t.committed },
    { name: 'Balance', base: 0, v: T.remaining, c: T.remaining < 0 ? t.critical : t.left },
  ];
  return {
    ...base(t),
    grid: { left: 8, right: 8, top: 24, bottom: 8, containLabel: true },
    tooltip: { ...(base(t).tooltip as object), trigger: 'item', formatter: (x: any) => `${esc(steps[x.dataIndex].name)}<br/><b style="font-family:${t.mono}">${full(steps[x.dataIndex].v)}</b>` },
    xAxis: { type: 'category', data: steps.map((s) => s.name), ...axisX(t), axisLabel: { color: t.ink2, fontSize: 12, interval: 0 } },
    yAxis: { type: 'value', ...axisY(t) },
    series: [
      { type: 'bar', stack: 'w', silent: true, data: steps.map((s) => s.base), itemStyle: { color: 'transparent' }, tooltip: { show: false } },
      { type: 'bar', stack: 'w', barWidth: '52%', data: steps.map((s) => ({ value: s.v, itemStyle: { color: s.c, borderRadius: 4 } })),
        label: { show: true, position: 'top', color: t.ink, fontFamily: t.mono, fontSize: 12, fontWeight: 600, formatter: (x: any) => short(steps[x.dataIndex].v) } },
    ],
  };
}

/** End lines for the chart: each project's end when there are a few, otherwise the last one only. */
export function endMarks(P: { code: string; end: string; datesTbc?: boolean }[]): { t: number; label: string }[] {
  const E = P.filter((p) => !p.datesTbc && p.end).map((p) => ({ t: Date.parse(p.end), label: `End ${p.code}` })).filter((e) => Number.isFinite(e.t)).sort((a, b) => a.t - b.t);
  if (E.length <= 3) return E.map((e) => ({ ...e, label: `${e.label} · ${date(new Date(e.t).toISOString().slice(0, 10))}` }));
  const last = E[E.length - 1];
  return [{ t: last.t, label: `Last end · ${date(new Date(last.t).toISOString().slice(0, 10))}` }];
}

/**
 * Burn-down: the money left (budget − cumulative spend) for the actual, the linear plan and the forecast range. Where the
 * forecast reaches zero the funds run out before the end; otherwise what is left at the last end date is shown.
 */
export function remainingOption(t: Tokens, S: ReturnType<typeof portfolioSeries>, budget: number, ends: { t: number; label: string }[] = []) {
  const rem = (k: 'actual' | 'plan' | 'mid') => S.filter((x) => x[k] != null).map((x) => [x.t, budget - x[k]!]);
  const lowR = S.filter((x) => x.high != null).map((x) => [x.t, budget - x.high!]), band = S.filter((x) => x.low != null).map((x) => [x.t, x.high! - x.low!]);
  const F = S.filter((x) => x.mid != null), out = F.find((x) => budget - x.mid! <= 0), last = F.at(-1);
  const mark = out ? { coord: [out.t, 0], value: `Funds run out · ${month(out.t)}`, color: t.serious }
    : last ? { coord: [last.t, budget - last.mid!], value: `Left at end ${axisMoney(budget - last.mid!)}`, color: budget - last.mid! > budget * 0.1 ? t.warn : t.c[0] } : null;
  const row = (c: string, name: string, v: number | null | undefined) => v == null ? '' : `<div style="display:flex;justify-content:space-between;gap:16px"><span style="color:${c}">${name}</span><b>${full(v)}</b></div>`;
  return {
    ...base(t),
    grid: { left: 8, right: ends.length ? 72 : 16, top: 22, bottom: 40, containLabel: true },
    tooltip: { ...(base(t).tooltip as object), trigger: 'axis', axisPointer: { type: 'line', lineStyle: { color: t.ink3 } },
      formatter: (ps: any[]) => { const x = S.find((s) => s.t === ps[0].value[0]); if (!x) return '';
        return `<div style="min-width:220px"><div style="font-weight:600;margin-bottom:6px">${month(x.t)} · funds left</div>${row(t.c[0], 'Actual', x.actual != null ? budget - x.actual : null)}${row(t.plan, 'Plan', x.plan != null ? budget - x.plan : null)}${row(t.c[1], 'Forecast', x.mid != null ? budget - x.mid : null)}</div>`; } },
    xAxis: { type: 'time', ...axisX(t), axisLabel: { ...axisX(t).axisLabel, formatter: (v: number) => month(v) } },
    yAxis: { type: 'value', min: (v: { min: number }) => Math.min(0, Math.floor(v.min / 1e6) * 1e6), max: Math.ceil(budget / 1e6) * 1e6, ...axisY(t) },
    dataZoom: [{ type: 'inside' }],
    series: [
      { name: 'Plan', type: 'line', data: rem('plan'), symbol: 'none', lineStyle: { color: t.plan, width: 1.5, type: 'dashed' }, z: 1,
        markLine: { silent: true, symbol: 'none', label: { formatter: 'Today', color: t.ink3, fontSize: 11 }, lineStyle: { color: t.ink3, type: 'solid', width: 1 }, data: [{ xAxis: TODAY.getTime() },
          { yAxis: 0, label: { formatter: 'Nothing left', position: 'insideStartTop', color: t.serious, fontSize: 11 }, lineStyle: { color: t.serious, type: 'solid', width: 1.5 } },
          ...ends.map((e) => ({ xAxis: e.t, label: { formatter: e.label, color: t.serious, fontSize: 11, fontWeight: 600 }, lineStyle: { color: t.serious, type: 'dashed', width: 1.5 } }))] } },
      { name: 'low', type: 'line', data: lowR, stack: 'band', symbol: 'none', lineStyle: { opacity: 0 }, areaStyle: { opacity: 0 }, tooltip: { show: false } },
      { name: 'Range', type: 'line', data: band, stack: 'band', symbol: 'none', lineStyle: { opacity: 0 }, areaStyle: { color: t.c[1], opacity: 0.16 } },
      { name: 'Forecast', type: 'line', data: rem('mid'), symbol: 'none', lineStyle: { color: t.c[1], width: 2, type: [6, 4] },
        ...(mark ? { markPoint: { symbol: 'circle', symbolSize: 9, itemStyle: { color: mark.color }, label: { show: true, position: out ? 'top' : 'left', distance: 8, formatter: mark.value, backgroundColor: t.surface, padding: [2, 5], borderRadius: 4, color: mark.color, fontWeight: 600, fontSize: 12 }, data: [{ coord: mark.coord, value: mark.value }] } } : {}) },
      { name: 'Actual', type: 'line', data: rem('actual'), symbol: 'none', lineStyle: { color: t.c[0], width: 2.5 }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: t.c[0] + '33' }, { offset: 1, color: t.c[0] + '00' }] } }, z: 3 },
    ],
  };
}
