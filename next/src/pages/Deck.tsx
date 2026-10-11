import { filtered, useStore } from '../data/store';
import { elapsed, groupBy, money, portfolioSeries, totals } from '../domain/calc';
import { alerts } from '../domain/insights';
import { TODAY } from '../today';
import { Chart } from '../ui/Chart';
import { Gauge } from '../ui/Gauge';
import { MapView } from '../ui/MapView';
import { date, month, pct, short } from '../ui/format';
import { mapData } from './MapPage';
import { spendOption } from './Overview';
import { moves, narrative } from './Pack';

const BAND_C: Record<string, string> = { blue: '#3b82c4', green: '#30a46c', amber: '#f5a524', red: '#e5484d' };

/** Donor presentation: six landscape slides that print one per page. */
export function Deck() {
  const s = useStore((x) => x);
  const P = filtered(s).filter((p) => !p.datesTbc);
  const cname = (id: string) => s.ledger.countries.find((c) => c.id === id)?.name ?? id;
  const scope = s.filters.country ? cname(s.filters.country) : 'Portfolio';
  if (!P.length) return <div class="card empty-page"><div><h2>No projects</h2><p>Change the filters.</p></div></div>;
  const T = totals(P, TODAY), S = portfolioSeries(P, TODAY), N = narrative(P, cname), M = moves(P);
  const PL = P.reduce((a, p) => a + money(p).budget * elapsed(p, TODAY), 0), perf = PL ? T.spent / PL : 0;
  const C = groupBy(P, (p) => p.country).sort((a, b) => b.budget - a.budget);
  const A = alerts(P, TODAY).filter((a) => a.severity === 'critical' || a.severity === 'serious').slice(0, 7);
  const lab = (id: string) => { const p = P.find((x) => x.id === id)!; return p.bh ? `BH ${p.bh}` : p.code; };
  const foot = (n: number) => <div class="sl-f"><span>{scope} · {month(TODAY.getTime())}</span><span>{n} / 6</span></div>;
  return (
    <div class="deck">
      <div class="no-print deck-tools"><p class="muted">Six slides, landscape — print or save as PDF to share.</p><button class="btn primary" onClick={() => print()}>⎙ Save as PDF</button></div>

      <section class="slide sl-cover">
        <div><div class="sl-k">Progress update · {date(TODAY.toISOString().slice(0, 10))}</div>
          <h1>{scope === 'Portfolio' ? 'Joint programme portfolio' : `${scope} portfolio`}</h1>
          <p>{P.length} projects · {short(T.budget)} total budget · {new Set(P.map((p) => p.country)).size} countr{new Set(P.map((p) => p.country)).size > 1 ? 'ies' : 'y'}</p></div>
        {foot(1)}
      </section>

      <section class="slide">
        <h2>Key figures</h2>
        <div class="sl-kpis">
          <div><span>Budget</span><b>{short(T.budget)}</b></div><div><span>Spent</span><b>{short(T.spent)}</b><small>{pct(T.burn)} of budget</small></div>
          <div><span>Committed</span><b>{short(T.committed)}</b></div><div><span>Time elapsed</span><b>{pct(T.elapsed)}</b></div>
        </div>
        <div class="gauges"><Gauge value={perf} label="Spent vs planned to date" /><Gauge value={T.budget ? T.exposure / T.budget : 0} max={1} label="Spent + committed of budget" bands={[[0.5, '#f5a524'], [1, '#30a46c']]} /><Gauge value={T.elapsed} max={1} label="Time elapsed" bands={[[1, '#3b82c4']]} /></div>
        {foot(2)}
      </section>

      <section class="slide">
        <h2>Spending over time</h2><p class="sl-sub">Cumulative actual spend against the linear plan, with forecast range</p>
        <div class="sl-chart"><Chart height={380} label="Spending over time" option={(t) => ({ ...spendOption(t, S, T.budget), dataZoom: [], grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true } })} /></div>
        {foot(3)}
      </section>

      <section class="slide">
        <h2>Where the money goes</h2>
        <div class="sl-two">
          <div class="sl-map"><MapView compact countries={s.ledger.countries} data={mapData(s.ledger.countries, P)} mode="budget" height={340} /></div>
          <table class="mini sl-t"><thead><tr><th>Country</th><th class="r">Projects</th><th class="r">Budget</th><th class="r">Spent</th><th style={{ width: '30%' }} /></tr></thead>
            <tbody>{C.map((c) => <tr><td>{cname(c.key)}</td><td class="r num">{c.count}</td><td class="r num">{short(c.budget)}</td><td class="r num">{pct(c.budget ? c.spent / c.budget : 0)}</td><td><div class="sl-bar"><span style={{ width: `${c.budget ? Math.min(100, c.spent / c.budget * 100) : 0}%` }} /></div></td></tr>)}</tbody></table>
        </div>
        {foot(4)}
      </section>

      <section class="slide">
        <h2>Project status</h2>
        <table class="mini sl-t"><thead><tr><th>Project</th><th>Country</th><th class="r">Budget</th><th class="r">Spent</th><th class="r">vs plan</th><th>Ends</th></tr></thead>
          <tbody>{M.sort((a, b) => a.perf - b.perf).slice(0, 12).map((x) => <tr style={{ borderLeft: `5px solid ${BAND_C[x.now]}` }}><td><b>{x.p.bh ? `BH ${x.p.bh}` : x.p.code}</b> {x.p.name.length > 70 ? x.p.name.slice(0, 68) + '…' : x.p.name}</td><td>{cname(x.p.country)}</td><td class="r num">{short(money(x.p).budget)}</td><td class="r num">{short(x.spent)}</td><td class="r num"><b style={{ color: BAND_C[x.now] }}>{Math.round(x.perf * 100)}%</b></td><td class="num">{date(x.p.end)}</td></tr>)}</tbody></table>
        {foot(5)}
      </section>

      <section class="slide">
        <h2>Key messages and next steps</h2>
        <div class="sl-two">
          <ul class="pack-pts">{N.slice(0, 6).map((t) => <li class={`t-${t.tone}`}><span>{t.label}</span><p>{t.text}</p></li>)}</ul>
          <div><h3 class="sl-h3">Points to follow up</h3>{A.length ? <ul class="sl-al">{A.map((a) => <li><span class={`badge ${a.severity}`}>{a.severity}</span><b>{lab(a.projectId)}</b> {a.title}</li>)}</ul> : <p class="muted">No serious alerts.</p>}</div>
        </div>
        {foot(6)}
      </section>
    </div>
  );
}
