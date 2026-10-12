import { OfficeSummary, officeRows } from './OfficeSummary';
import { exportPptx } from '../ui/deckPptx';
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { resultRows } from '../domain/results';
import { filtered, get, useStore } from '../data/store';
import { byCategory, elapsed, HEADINGS, groupBy, lineRows, money, parseDate, portfolioSeries, riskScore, totals } from '../domain/calc';
import { alerts } from '../domain/insights';
import { catchUp } from '../domain/monitor';
import { renewals, roster } from '../domain/staff';
import type { Project } from '../domain/types';
import { TODAY } from '../today';
import { Chart } from '../ui/Chart';
import { Gauge } from '../ui/Gauge';
import { MapView } from '../ui/MapView';
import { date, month, pct, short } from '../ui/format';
import { events } from './Agenda';
import { mapData } from './MapPage';
import { spendOption } from './Overview';
import { moves, narrative } from './Pack';

const BAND_C: Record<string, string> = { blue: '#3b82c4', green: '#30a46c', amber: '#f5a524', red: '#e5484d' };
const BAND_W: Record<string, string> = { blue: 'Ahead', green: 'On track', amber: 'Behind', red: 'Well behind' };
const KIND_C: Record<string, string> = { report: '#e5484d', contract: '#8e4ec6', activity: '#f5a524', project: '#3b82c4' };
const lab = (p: Project) => (p.bh ? `BH ${p.bh}` : p.code);
const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export type Audience = 'management' | 'donor';
/** Running slide number: slides are counted in the order they render, so hidden slides never leave gaps. */
const deckCtx = { n: 1, of: 1, notes: false };
/** One slide: the topic as a small kicker, the key message as the title, speaker notes below when asked. */
function Slide({ title, msg, sub, scope, notes, children, cls = '' }: { n?: number; of?: number; title: string; msg?: string; sub?: string; scope: string; notes?: string; children: ComponentChildren; cls?: string }) {
  const n = ++deckCtx.n;
  return (
    <>
      <section class={`slide ${cls}`}>
        <header class="sl-head"><div>{msg && <div class="sl-k">{title}</div>}<h2>{msg ?? title}</h2>{sub && <p class="sl-sub">{sub}</p>}</div><span class="sl-tag">{scope}</span></header>
        <div class="sl-body">{children}</div>
        <div class="sl-f"><span>{scope} · Progress update · {month(TODAY.getTime())}</span><span>{n} / {deckCtx.of}</span></div>
      </section>
      {deckCtx.notes && notes && <aside class="sl-notes no-print"><b>Speaker notes · slide {n}</b><p>{notes}</p></aside>}
    </>
  );
}
const readPref = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } };
const savePref = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

/** Donor presentation: landscape slides that print one per page, from cover to annex. */
export function Deck() {
  const s = useStore((x) => x);
  const [aud, setAud] = useState<Audience>(() => readPref('pl-deck-aud', 'management'));
  const [pages, setPages] = useState<boolean>(() => readPref('pl-deck-pages', true));
  const [notes, setNotes] = useState<boolean>(() => readPref('pl-deck-notes', false));
  const mg = aud === 'management';
  const P = filtered(s).filter((p) => !p.datesTbc);
  const cname = (id: string) => s.ledger.countries.find((c) => c.id === id)?.name ?? id;
  const scope = s.filters.country ? `${cname(s.filters.country)} portfolio` : 'Portfolio';
  if (!P.length) return <div class="card empty-page"><div><h2>No projects</h2><p>Change the filters.</p></div></div>;
  const T = totals(P, TODAY), S = portfolioSeries(P, TODAY), N = narrative(P, cname), M = moves(P).sort((a, b) => a.perf - b.perf);
  const PL = P.reduce((a, p) => a + money(p).budget * elapsed(p, TODAY), 0), perf = PL ? T.spent / PL : 0;
  const band = perf >= 1 ? 'blue' : perf >= 0.9 ? 'green' : perf >= 0.7 ? 'amber' : 'red';
  const C = groupBy(P, (p) => p.country).sort((a, b) => b.budget - a.budget);
  const H = byCategory(lineRows(P)).filter((h) => h.approved > 0);
  const A = alerts(P, TODAY).filter((a) => a.severity === 'critical' || a.severity === 'serious');
  const R = P.flatMap((p) => (p.riskRegister ?? []).filter((r) => (r.status ?? 'Open') === 'Open').map((r) => ({ p, r, sc: riskScore(r) }))).sort((a, b) => b.sc - a.sc).slice(0, 8);
  const people = P.flatMap((p) => roster(p, TODAY)), active = people.filter((a) => a.status === 'Active'), ren = renewals(people, TODAY, 90);
  const today = TODAY.toISOString().slice(0, 10), in90 = new Date(TODAY); in90.setUTCDate(in90.getUTCDate() + 90);
  const E = events(P).filter((e) => e.day >= today && e.day <= in90.toISOString().slice(0, 10) && e.kind !== 'contract').slice(0, 14);
  const final = S.at(-1)?.mid ?? null;
  const CU = M.filter((x) => x.now === 'red' || x.now === 'amber').map((x) => ({ x, c: catchUp(x.p, TODAY, 3) })).filter((y) => y.c.need > 0).slice(0, 5);
  const nCountries = new Set(P.map((p) => p.country)).size;
  const hasOffice = mg && (get().ledger.offices ?? []).some((o) => o.reports.length);
  const RR = resultRows(P, TODAY), I = RR.inds.filter((r) => r.prog != null);
  const PP = pages ? [...P].sort((a, b) => money(b).budget - money(a).budget) : [];
  // Slides: cover, summary, finance, spending, headings, countries, status, results (donor), risks, staff, offices (management),
  // milestones, next steps, one page per project (optional), annex.
  const of = 12 + (mg ? 0 : 1) + (hasOffice ? 1 : 0) + PP.length;
  deckCtx.n = 1; deckCtx.of = of; deckCtx.notes = notes;
  const gapPp = Math.round((perf - 1) * 100), behind = M.filter((x) => x.now === 'red' || x.now === 'amber');
  const topH = [...H].sort((a, b) => b.approved - a.approved)[0];
  // Key messages and speaker notes, shared by the slides on screen and the PowerPoint export.
  const MS = {
    executive: `${BAND_W[band]}: ${pct(perf)} of planned spending reached, ${short(T.remaining)} still uncommitted`,
    financial: `${pct(T.burn)} of the ${short(T.budget)} budget spent at ${pct(T.elapsed)} of time; ${pct(T.budget ? T.exposure / T.budget : 0)} used with commitments`,
    spending: final != null ? `At the recent pace the portfolio ends at ${short(final)}, ${pct(T.budget ? final / T.budget : 0)} of budget` : `${short(T.spent)} spent against ${short(PL)} planned by now`,
    budget: topH ? `${topH.key} is the largest heading: ${short(topH.approved)}, ${pct(topH.approved ? topH.exposure / topH.approved : 0)} used` : "Budget by heading",
    where: C[0] ? `${cname(C[0].key)} carries ${pct(T.budget ? C[0].budget / T.budget : 0)} of the budget across ${C[0].count} project${C[0].count > 1 ? "s" : ""}` : "Budget by country",
    project: behind.length ? `${behind.length} of ${M.length} projects are behind plan — ${behind.slice(0, 3).map((x) => lab(x.p)).join(", ")} first` : `All ${M.length} projects are on or ahead of plan`,
    risks: R.length ? `${R.length} open risks; the highest is “${cut(R[0].r.title, 60)}” (${lab(R[0].p)})` : "No open risks recorded",
    upcoming: E.length ? `${E.length} milestones in the next 90 days, the first on ${date(E[0].day)}` : "No milestones in the next 90 days",
    next: CU.length ? `${CU.length} project${CU.length > 1 ? "s need" : " needs"} a faster monthly pace to be back on plan in three months` : "Keep the current pace",
    results: I.length ? `${I.filter((r) => r.state === 'reached' || r.state === 'on track').length} of ${I.length} measured indicators are reached or on track` : 'Indicators are not measured yet',
  };
  const STEPS = [
    ...(A.some((a) => a.kind === 'deadline') ? [`Submit the overdue reports: ${[...new Set(A.filter((a) => a.kind === 'deadline').map((a) => lab(P.find((q) => q.id === a.projectId)!)))].join(', ')}.`] : []),
    ...(CU.length ? [`Agree a three-month spending plan with the teams of ${CU.map(({ x }) => lab(x.p)).join(', ')}.`] : []),
    ...(mg && ren.length ? [`Decide on ${ren.length} staff contract renewal${ren.length > 1 ? 's' : ''} before they end.`] : []),
    ...(P.some((p) => { const d = (parseDate(p.end).getTime() - TODAY.getTime()) / 864e5; return d > 0 && d < 183; }) ? ['Prepare closure and final reports for projects ending within six months.'] : []),
    `Next update after the ${month(new Date(Date.UTC(TODAY.getUTCFullYear(), TODAY.getUTCMonth() + 1, 1)).getTime())} financial reports.`,
  ];
  const pptx = () => exportPptx({ aud, scope, cname, lab, P, T, perf, band, bandWord: (b) => BAND_W[b], PL, final, series: S, points: N, H, C, moves: M, results: RR.rows, risks: R, alerts: A,
    staff: active, renewals: ren.length, offices: hasOffice ? officeRows(get().ledger.offices ?? []).map((o) => ({ name: o.o.name, ob: o.T.ob.budget, sc: o.T.ob.sc, end: o.end, request: o.request })) : [],
    events: E, catchUp: CU.map(({ x, c }) => ({ p: x.p, perf: x.perf, rate: c.rate, need: c.need })), steps: STEPS, pages: PP, MS, NS }).catch((e) => alert(`PowerPoint export failed: ${(e as Error).message}`));
  const NS = {
    executive: `Open with the verdict. Spending is ${pct(perf)} of what the linear plan expects by now (${gapPp >= 0 ? "+" : ""}${gapPp} points). ${behind.length} of ${M.length} projects are behind plan. Walk through the points below, one line each.`,
    financial: `Budget ${short(T.budget)}; spent ${short(T.spent)}; committed ${short(T.committed)} in open contracts and orders. The tick on the bar is time elapsed: spending plus commitments ${T.exposure / (T.budget || 1) >= T.elapsed ? "are at or ahead of" : "are behind"} time.`,
    spending: `The dashed line is the linear plan; the band is the forecast at the recent monthly pace ±20%. Gap to plan today: ${short(T.spent - PL)}.`,
    budget: "Read each bar against the black tick (time elapsed). Headings far short of the tick are where spending must pick up; headings past 100% need a budget transfer within the flexibility rules.",
    where: "Country split of budget and spending; the map sizes each country by budget.",
    project: "Projects are ordered weakest first. Trend is the change since the previous financial report.",
    risks: "Top risks by likelihood × impact with their mitigation; on the right the most serious alerts from the data.",
    upcoming: "Reports due, planned activity ends and project end dates in the next three months.",
    next: mg ? "The factor is how much faster each project must spend per month than its recent pace. Agree the plan and owners in this meeting." : "Actions agreed with the project teams; the next update follows the coming financial reports.",
    results: "Progress is the share of the target reached; on track means progress keeps up with time elapsed. Projects whose spending runs well ahead of results are flagged.",
  };
  return (
    <div class="deck">
      <div class="no-print deck-tools"><div class="seg" role="group" aria-label="Audience">{(['management', 'donor'] as const).map((a) => <button aria-pressed={aud === a} onClick={() => { setAud(a); savePref('pl-deck-aud', a); }}>{a === 'management' ? 'Management' : 'Donor'}</button>)}</div>
        <label class="muted" style={{ fontSize: '12.5px' }}><input type="checkbox" checked={pages} onChange={(e) => { const v = (e.target as HTMLInputElement).checked; setPages(v); savePref('pl-deck-pages', v); }} /> One page per project</label>
        <label class="muted" style={{ fontSize: '12.5px' }}><input type="checkbox" checked={notes} onChange={(e) => { const v = (e.target as HTMLInputElement).checked; setNotes(v); savePref('pl-deck-notes', v); }} /> Speaker notes</label>
        <p class="muted" style={{ margin: 0, flex: 1 }}>{of} slides · {mg ? 'internal: staff names, office costs and catch-up plans included' : 'for the donor: results and indicators, no internal staff or office detail'} · A4 landscape</p><button class="btn" onClick={pptx}>⤓ PowerPoint</button><button class="btn primary" onClick={() => print()}>⎙ Save as PDF</button></div>

      <section class="slide sl-cover">
        <div class="sl-cv">
          <div class="sl-k">{mg ? 'Management review' : 'Progress report to the donor'} · {date(today)}</div>
          <h1>{scope === 'Portfolio' ? 'Joint programme portfolio' : scope}</h1>
          <p class="sl-lead">Financial and operational status of {P.length} project{P.length > 1 ? 's' : ''} in {nCountries} countr{nCountries > 1 ? 'ies' : 'y'}</p>
          <div class="sl-cv-k"><div><b>{short(T.budget)}</b><span>total budget</span></div><div><b>{short(T.spent)}</b><span>spent to date</span></div><div><b style={{ color: BAND_C[band] }}>{pct(perf)}</b><span>of planned spending</span></div></div>
        </div>
        <div class="sl-f"><span>Prepared from the Portfolio Ledger · figures at {date(today)}</span><span>1 / {of}</span></div>
      </section>

      <Slide n={2} of={of} scope={scope} title="Executive summary" msg={MS.executive} sub="The position in one page" notes={NS.executive}>
        <div class="sl-verdict" style={{ borderColor: BAND_C[band] }}><span style={{ background: BAND_C[band] }}>{BAND_W[band]}</span><p>{N[0]?.text}</p></div>
        <ul class="pack-pts">{N.slice(1, 7).map((t) => <li class={`t-${t.tone}`}><span>{t.label}</span><p>{t.text}</p></li>)}</ul>
      </Slide>

      <Slide n={3} of={of} scope={scope} title="Financial position" msg={MS.financial} sub={`Budget-weighted time elapsed ${pct(T.elapsed)}`} notes={NS.financial}>
        <div class="sl-kpis">
          <div><span>Budget</span><b>{short(T.budget)}</b><small>{P.length} projects</small></div>
          <div><span>Spent</span><b>{short(T.spent)}</b><small>{pct(T.burn)} of budget</small></div>
          <div><span>Committed</span><b>{short(T.committed)}</b><small>open contracts and orders</small></div>
          <div><span>Uncommitted</span><b>{short(T.remaining)}</b><small>{pct(T.budget ? T.remaining / T.budget : 0)} still free</small></div>
        </div>
        <div class="sl-stack" role="img" aria-label="Budget split">
          <span style={{ width: `${T.budget ? T.spent / T.budget * 100 : 0}%`, background: 'var(--c1)' }}>{T.burn > 0.08 ? `Spent ${pct(T.burn)}` : ''}</span>
          <span style={{ width: `${T.budget ? T.committed / T.budget * 100 : 0}%`, background: 'color-mix(in srgb,var(--c1) 45%,var(--surface))' }}>{T.committed / T.budget > 0.08 ? 'Committed' : ''}</span>
          <span style={{ flex: 1, background: 'var(--surface-2)', color: 'var(--ink-2)' }}>Uncommitted {pct(T.budget ? T.remaining / T.budget : 0)}</span>
          <i style={{ left: `${T.elapsed * 100}%` }} title="time elapsed" />
        </div>
        <div class="gauges"><Gauge value={perf} label="Spent vs planned to date" /><Gauge value={T.budget ? T.exposure / T.budget : 0} max={1} label="Spent + committed of budget" bands={[[0.5, '#f5a524'], [1, '#30a46c']]} /><Gauge value={T.elapsed} max={1} label="Time elapsed" bands={[[1, '#3b82c4']]} /></div>
      </Slide>

      <Slide n={4} of={of} scope={scope} title="Spending over time" msg={MS.spending} notes={NS.spending} sub="Cumulative actual spend against the linear plan; shaded band = forecast at the recent pace ±20%">
        <div class="sl-split">
          <div class="sl-chart"><Chart height={360} label="Spending over time" option={(t) => ({ ...spendOption(t, S, T.budget), dataZoom: [], grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true } })} /></div>
          <div class="sl-callouts">
            <div><span>Planned by now</span><b>{short(PL)}</b></div>
            <div><span>Actually spent</span><b>{short(T.spent)}</b></div>
            <div><span>Gap to plan</span><b style={{ color: PL > T.spent ? '#e5484d' : '#30a46c' }}>{short(T.spent - PL)}</b></div>
            {final != null && <div><span>Forecast at end</span><b>{short(final)}</b><small>{pct(T.budget ? final / T.budget : 0)} of budget</small></div>}
          </div>
        </div>
      </Slide>

      <Slide n={5} of={of} scope={scope} title="Budget by heading" msg={MS.budget} notes={NS.budget} sub="Approved budget and use (spent + committed) per cost heading, all projects">
        {H.length ? <table class="mini sl-t"><thead><tr><th>Heading</th><th class="r">Approved</th><th class="r">Spent</th><th class="r">Spent + committed</th><th class="r">Used</th><th style={{ width: '30%' }} /></tr></thead>
          <tbody>{H.map((h) => { const u = h.approved ? h.exposure / h.approved : 0; return <tr><td>{h.key}</td><td class="r num">{short(h.approved)}</td><td class="r num">{short(h.actual)}</td><td class="r num">{short(h.exposure)}</td><td class="r num"><b>{pct(u)}</b></td><td><div class="sl-bar"><span style={{ width: `${Math.min(100, u * 100)}%`, background: u > 1 ? '#e5484d' : 'var(--c1)' }} /><i style={{ left: `${T.elapsed * 100}%` }} /></div></td></tr>; })}</tbody>
          <tfoot><tr><td>Total</td><td class="r num">{short(H.reduce((a, h) => a + h.approved, 0))}</td><td class="r num">{short(H.reduce((a, h) => a + h.actual, 0))}</td><td class="r num">{short(H.reduce((a, h) => a + h.exposure, 0))}</td><td /><td /></tr></tfoot></table>
          : <p class="sl-empty">No financial reports with budget lines yet.</p>}
        <p class="sl-note">The black tick on each bar marks time elapsed: a bar well short of it is a heading behind schedule.</p>
      </Slide>

      <Slide n={6} of={of} scope={scope} title="Where the money goes" msg={MS.where} notes={NS.where} sub="Budget and spending by country">
        <div class="sl-two">
          <div class="sl-map"><MapView compact countries={s.ledger.countries} data={mapData(s.ledger.countries, P)} mode="budget" height={330} /></div>
          <table class="mini sl-t"><thead><tr><th>Country</th><th class="r">Projects</th><th class="r">Budget</th><th class="r">Share</th><th class="r">Spent</th></tr></thead>
            <tbody>{C.map((c) => <tr><td><b>{cname(c.key)}</b></td><td class="r num">{c.count}</td><td class="r num">{short(c.budget)}</td><td class="r num">{pct(T.budget ? c.budget / T.budget : 0)}</td><td class="r num">{pct(c.budget ? c.spent / c.budget : 0)}</td></tr>)}</tbody></table>
        </div>
      </Slide>

      <Slide n={7} of={of} scope={scope} title="Project status" msg={MS.project} notes={NS.project} sub="Spending against plan to date — weakest first">
        <table class="mini sl-t sl-status"><thead><tr><th>Project</th><th>Country</th><th class="r">Budget</th><th class="r">Spent</th><th class="r">vs plan</th><th class="r">Trend</th><th>Status</th><th>Ends</th></tr></thead>
          <tbody>{M.slice(0, 11).map((x) => { const d = x.prev == null ? null : x.perf - x.prev; return <tr style={{ borderLeft: `5px solid ${BAND_C[x.now]}` }}><td><b>{lab(x.p)}</b> {cut(x.p.name, 62)}</td><td>{cname(x.p.country)}</td><td class="r num">{short(money(x.p).budget)}</td><td class="r num">{short(x.spent)}</td><td class="r num"><b style={{ color: BAND_C[x.now] }}>{Math.round(x.perf * 100)}%</b></td><td class="r num" style={{ color: d == null ? undefined : d > 0 ? '#30a46c' : '#e5484d' }}>{d == null ? '—' : `${d > 0 ? '▲' : '▼'} ${Math.abs(Math.round(d * 100))}`}</td><td><span class="sl-pill" style={{ background: BAND_C[x.now] }}>{BAND_W[x.now]}</span></td><td class="num">{date(x.p.end)}</td></tr>; })}</tbody></table>
        {M.length > 11 && <p class="sl-note">{M.length - 11} more projects in the annex of the monthly pack.</p>}
      </Slide>

      {!mg && <Slide scope={scope} title="Results" msg={MS.results} sub="Logframe indicators against their targets, by project" notes={NS.results}>
        <table class="mini sl-t"><thead><tr><th>Project</th><th class="r">Indicators</th><th class="r">Measured</th><th class="r">Reached</th><th class="r">Behind</th><th class="r">Results</th><th class="r">Spent + committed</th><th>Note</th></tr></thead>
          <tbody>{RR.rows.map((r) => <tr><td><b>{lab(r.p)}</b> {cut(r.p.name, 50)}</td><td class="r num">{r.n}</td><td class="r num">{r.measured}</td><td class="r num">{r.reached}</td><td class="r num">{r.behind}</td><td class="r num">{r.results == null ? '—' : pct(r.results)}</td><td class="r num">{pct(r.spend)}</td><td>{r.flag ?? ''}</td></tr>)}</tbody></table>
      </Slide>}

      <Slide n={8} of={of} scope={scope} title="Risks and issues" msg={MS.risks} notes={NS.risks} sub="Open risks from the registers and the most serious alerts">
        <div class="sl-two">
          <div><h3 class="sl-h3">Top risks</h3>{R.length ? <table class="mini sl-t"><thead><tr><th>Project</th><th>Risk</th><th class="r">Score</th></tr></thead>
            <tbody>{R.map((x) => <tr><td><b>{lab(x.p)}</b></td><td>{cut(x.r.title, 70)}{x.r.mitigation && <small class="sl-mit">Mitigation: {cut(x.r.mitigation, 90)}</small>}</td><td class="r num"><span class="sl-pill" style={{ background: x.sc >= 15 ? '#e5484d' : x.sc >= 8 ? '#f5a524' : '#30a46c' }}>{x.sc}</span></td></tr>)}</tbody></table> : <p class="sl-empty">No open risks recorded.</p>}</div>
          <div><h3 class="sl-h3">Alerts</h3>{A.length ? <ul class="sl-al">{A.slice(0, 9).map((a) => { const p = P.find((q) => q.id === a.projectId)!; return <li><span class={`badge ${a.severity}`}>{a.severity}</span><div><b>{lab(p)}</b> {a.title}<small>{a.detail}</small></div></li>; })}</ul> : <p class="sl-empty">No serious alerts.</p>}</div>
        </div>
      </Slide>

      <Slide n={9} of={of} scope={scope} title="Staff" sub="Staff paid from the projects">
        <div class="sl-kpis">
          <div><span>Active staff</span><b>{active.length}</b></div>
          <div><span>Contracts ending ≤ 90 days</span><b style={{ color: ren.length ? '#c27c0e' : undefined }}>{ren.length}</b></div>
          <div><span>Projects with staff</span><b>{new Set(active.map((a) => a.project.id)).size}</b></div>
          <div><span>All records</span><b>{people.length}</b></div>
        </div>
        {/* Every active staff member, by project; contracts ending within 90 days highlighted. Two columns when long. */}
        {!mg ? <p class="sl-empty">{active.length} staff paid from {new Set(active.map((a) => a.project.id)).size} projects; names and contract details are in the management version.</p> : active.length ? (() => {
          const L = [...active].sort((a, b) => lab(a.project).localeCompare(lab(b.project)) || (a.end ?? '').localeCompare(b.end ?? '') || a.display.localeCompare(b.display));
          const soon = new Set(ren), cols = L.length > 12 ? [L.slice(0, Math.ceil(L.length / 2)), L.slice(Math.ceil(L.length / 2))] : [L];
          return <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols.length}, 1fr)`, gap: '18px' }}>{cols.map((C) => <table class="mini sl-t sl-staff"><thead><tr><th>Name</th><th>Position</th><th>Project</th><th>Contract ends</th></tr></thead>
            <tbody>{C.map((a) => <tr><td>{a.display}</td><td>{a.position}</td><td>{lab(a.project)}</td><td class="num" style={soon.has(a) ? { color: '#c27c0e', fontWeight: 700 } : undefined}>{a.end ? date(a.end) : '—'}</td></tr>)}</tbody></table>)}</div>;
        })() : <p class="sl-empty">No active staff on file.</p>}
        {ren.length > 0 && <p class="sl-empty" style={{ marginTop: '8px' }}><b style={{ color: '#c27c0e' }}>Orange</b> = contract ends within 90 days.</p>}
      </Slide>

      {hasOffice && <Slide n={10} of={of} scope={scope} title="Office running costs" sub="Programme offices' own budgets — Ordinary Budget and LS & Pagoda, latest situation and year-end outlook">
        <OfficeSummary variant="slide" />
      </Slide>}

      <Slide n={10+(hasOffice ? 1 : 0)} of={of} scope={scope} title="Upcoming milestones" msg={MS.upcoming} notes={NS.upcoming} sub="Next 90 days: reports due, planned activity ends and project end dates">
        {E.length ? <ul class="sl-tl">{E.map((e) => <li style={{ borderLeftColor: KIND_C[e.kind] }}><span class="num">{date(e.day)}</span><b>{lab(e.p)}</b><span>{cut(e.title, 70)}</span><small>{e.sub}</small></li>)}</ul> : <p class="sl-empty">Nothing scheduled in the next 90 days.</p>}
      </Slide>

      <Slide n={11+(hasOffice ? 1 : 0)} of={of} scope={scope} title={mg ? "Next steps" : "Next steps"} msg={MS.next} notes={NS.next} sub="What is needed to get back on plan within three months">
        {mg && CU.length ? <table class="mini sl-t"><thead><tr><th>Project</th><th class="r">Now</th><th class="r">Current pace / month</th><th class="r">Needed / month</th><th class="r">Factor</th><th>Focus headings</th></tr></thead>
          <tbody>{CU.map(({ x, c }) => <tr><td><b>{lab(x.p)}</b> {cut(x.p.name, 48)}</td><td class="r num" style={{ color: BAND_C[x.now] }}>{Math.round(x.perf * 100)}%</td><td class="r num">{short(c.rate)}</td><td class="r num"><b>{short(c.need)}</b></td><td class="r num">{c.rate ? `${c.factor.toFixed(1)}×` : '—'}</td><td>{c.gaps.map((g) => HEADINGS[g.heading] ?? g.heading).join(', ') || '—'}</td></tr>)}</tbody></table> : <p class="sl-empty">All projects are on or near plan — no catch-up needed.</p>}
        <ol class="sl-steps">{STEPS.map((t) => <li>{t}</li>)}</ol>
      </Slide>

      {PP.map((p) => { const m = money(p), el = elapsed(p, TODAY), mv = M.find((x) => x.p === p), hp = byCategory(lineRows([p])).filter((h) => h.approved > 0), rr = RR.rows.find((r) => r.p === p), rk = (p.riskRegister ?? []).filter((r) => (r.status ?? 'Open') === 'Open').sort((a, b) => riskScore(b) - riskScore(a)).slice(0, 3);
        const b = mv?.now ?? 'green';
        return <Slide scope={scope} title={`${lab(p)} · ${cname(p.country)}`} msg={cut(p.name, 90)} sub={`${date(p.start)} → ${date(p.end)} · ${pct(el)} of time elapsed`} notes={`${BAND_W[b]}: ${short(m.spent)} spent of ${short(m.budget)} (${pct(m.budget ? m.spent / m.budget : 0)}), ${short(m.committed)} committed.${rr?.results != null ? ` Results ${pct(rr.results)} of targets.` : ''}`}>
          <div class="sl-kpis">
            <div><span>Budget</span><b>{short(m.budget)}</b><small>{p.approvedBudget ? 'approved budget' : 'project amount'}</small></div>
            <div><span>Spent</span><b>{short(m.spent)}</b><small>{pct(m.budget ? m.spent / m.budget : 0)} at {pct(el)} of time</small></div>
            <div><span>Committed</span><b>{short(m.committed)}</b><small>uncommitted {short(m.remaining)}</small></div>
            <div><span>Status</span><b style={{ color: BAND_C[b] }}>{BAND_W[b]}</b><small>{mv ? `${Math.round(mv.perf * 100)}% of planned spending` : ''}</small></div>
          </div>
          <div class="sl-two">
            <div><h3 class="sl-h3">Budget by heading</h3>{hp.length ? <table class="mini sl-t"><thead><tr><th>Heading</th><th class="r">Approved</th><th class="r">Used</th></tr></thead><tbody>{hp.map((h) => <tr><td>{h.key}</td><td class="r num">{short(h.approved)}</td><td class="r num">{pct(h.approved ? h.exposure / h.approved : 0)}</td></tr>)}</tbody></table> : <p class="sl-empty">No financial report yet.</p>}</div>
            <div><h3 class="sl-h3">Results and risks</h3>
              <p class="sl-empty">{rr && rr.n ? `${rr.n} indicators, ${rr.measured} measured, ${rr.reached} reached${rr.behind ? `, ${rr.behind} behind` : ''}.` : 'No logframe indicators on file.'}</p>
              {rk.length ? <ul class="sl-al">{rk.map((r) => <li><b>{cut(r.title, 70)}</b>{r.mitigation && <small class="sl-mit">Mitigation: {cut(r.mitigation, 90)}</small>}</li>)}</ul> : <p class="sl-empty">No open risks recorded.</p>}</div>
          </div>
        </Slide>; })}

      <Slide n={12+(hasOffice ? 1 : 0)} of={of} scope={scope} title="Annex — method and definitions" cls="sl-annex">
        <dl class="sl-def">
          <dt>Planned to date</dt><dd>Budget × share of the implementation period elapsed (linear plan).</dd>
          <dt>Spent vs planned</dt><dd>Actual spending ÷ planned to date. Blue ≥ 100%, green 90–100%, amber 70–90%, red below 70%.</dd>
          <dt>Committed</dt><dd>Open contracts and purchase orders not yet paid, from the latest financial report.</dd>
          <dt>Forecast</dt><dd>Recent monthly spending rate continued to the end date, ±20% band; capped at each project's budget.</dd>
          <dt>Trend</dt><dd>Change in spent vs planned since the previous financial report, in percentage points.</dd>
          <dt>Risk score</dt><dd>Likelihood × impact (1–5 each) from the project risk registers.</dd>
          <dt>Source</dt><dd>Financial report workbooks and contract documents loaded in the Portfolio Ledger; figures at {date(today)}.</dd>
        </dl>
      </Slide>
    </div>
  );
}
