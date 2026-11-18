import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { filtered, go, useStore } from '../data/store';
import { capacity, endOf, gapDrivers, HEAD_LABEL, portfolioWalk, trendOf } from '../domain/analysis';
import { asOf, elapsed, money, portfolioSeries, totals } from '../domain/calc';
import { decisions } from '../domain/decisions';
import { plabel } from '../domain/label';
import type { Project } from '../domain/types';
import { TODAY } from '../today';
/** Height of the app's sticky top bar, and of everything a slide must leave room for: that bar and the slide controls above it. */
const topBar = () => Math.round(document.querySelector<HTMLElement>('.topbar, header.top, .app-top')?.getBoundingClientRect().height ?? 60);
const chrome = (el: HTMLElement) => topBar() + ((el.previousElementSibling as HTMLElement | null)?.getBoundingClientRect().height ?? 40) + 40;
import { base, Chart, type Tokens } from '../ui/Chart';
import { date, month, pct, short } from '../ui/format';
import { BAND_COLOR, BAND_WORD, BANDS, bandOf, Bullet, Spark, type Band } from '../ui/viz';
import { axisX, axisY, endMarks, spendOption } from './Overview';
import { VERDICT } from './Analysis';

const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const lab = (p: Project) => plabel(p);

interface Row { p: Project; perf: number; band: Band; planned: number; spent: number; g: ReturnType<typeof gapDrivers>; c: ReturnType<typeof capacity>; e: ReturnType<typeof endOf>; t: ReturnType<typeof trendOf> }

/** Planned to date → each heading's shortfall or lead → spent: the walk from plan to reality. */
function walkOption(t: Tokens, planned: number, steps: { label: string; v: number }[], spent: number) {
  const cats = ['Planned to date', ...steps.map((s) => s.label), 'Spent'];
  const invisible: (number | string)[] = [0], up: (number | string)[] = [planned], down: (number | string)[] = ['-'];
  const ends: (number | string)[] = [planned];
  let lvl = planned;
  for (const s of steps) {
    const lo = s.v < 0 ? lvl + s.v : lvl;
    invisible.push(lo); down.push(s.v < 0 ? -s.v : '-'); up.push(s.v >= 0 ? s.v : '-'); ends.push('-');
    lvl += s.v;
  }
  invisible.push(0); up.push('-'); down.push('-'); ends.push(spent);
  const lbl = (c: string) => ({ show: true, position: 'top', color: c, fontFamily: t.mono, fontSize: 12, formatter: (x: { value: number }) => (typeof x.value === 'number' && x.value > 0 ? short(x.value) : '') });
  return {
    ...base(t), animation: false,
    grid: { left: 8, right: 8, top: 28, bottom: 8, containLabel: true },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v: number) => (typeof v === 'number' ? short(v) : '') },
    xAxis: { type: 'category', data: cats, ...axisX(t), axisLabel: { ...axisX(t).axisLabel, interval: 0, hideOverlap: false, width: 84, overflow: 'break', fontSize: 11, lineHeight: 13 } },
    yAxis: { type: 'value', ...axisY(t) },
    series: [
      { type: 'bar', stack: 'w', data: invisible, itemStyle: { color: 'transparent' }, emphasis: { disabled: true }, tooltip: { show: false }, silent: true },
      { name: 'Total', type: 'bar', stack: 'w', data: ends.map((v, i) => (i === 0 ? v : i === cats.length - 1 ? v : '-')), itemStyle: { color: t.plan, borderRadius: 3 }, label: lbl(t.ink2), barMaxWidth: 70 },
      { name: 'Behind', type: 'bar', stack: 'w', data: down, itemStyle: { color: t.critical, borderRadius: 3 }, label: { ...lbl(t.critical), formatter: (x: { value: number }) => (typeof x.value === 'number' ? `−${short(x.value)}` : '') }, barMaxWidth: 70 },
      { name: 'Ahead', type: 'bar', stack: 'w', data: up.map((v, i) => (i === 0 ? '-' : v)), itemStyle: { color: t.good, borderRadius: 3 }, label: { ...lbl(t.good), formatter: (x: { value: number }) => (typeof x.value === 'number' ? `+${short(x.value)}` : '') }, barMaxWidth: 70 },
    ],
  };
}

function Slide({ i, n, kicker, msg, sub, children, scope }: { i: number; n: number; kicker: string; msg: string; sub?: string; children: preact.ComponentChildren; scope: string }) {
  return (
    <section class="slide st-slide" data-i={i}>
      <header class="sl-head"><div><div class="sl-k">{kicker}</div><h2>{msg}</h2>{sub && <p class="sl-sub">{sub}</p>}</div><span class="sl-tag">{scope}</span></header>
      <div class="sl-body">{children}</div>
      <div class="sl-f"><span>{scope} · portfolio story · {month(TODAY.getTime())}</span><span>{i} / {n}</span></div>
    </section>
  );
}

/** Five slides, one message each: where we stand, who is where, why behind, where we end, what to decide. */
export function Story() {
  const s = useStore((x) => x);
  const P = filtered(s).filter((p) => !p.datesTbc && money(p).budget > 0);
  const [cur, setCur] = useState(0);
  const box = useRef<HTMLDivElement>(null), deck = useRef<HTMLDivElement>(null);
  // The slide is laid out at its A4 width and zoomed to the window, so type keeps its proportion on any screen.
  const fit = () => { const el = deck.current; if (!el) return; const W = el.parentElement!.clientWidth, H = innerHeight - (document.fullscreenElement ? 40 : chrome(el)); el.style.setProperty('--z', String(Math.max(0.3, Math.min(W / 1123, H / 794)))); };
  useLayoutEffect(fit);
  // The slide uses the whole window: when it does not fit under the menus, the page scrolls to the slide bar.
  useEffect(() => { const el = deck.current, bar = el?.previousElementSibling as HTMLElement | null; if (!el || !bar || document.fullscreenElement) return; if (el.getBoundingClientRect().bottom > innerHeight + 2) scrollTo({ top: bar.getBoundingClientRect().top + scrollY - topBar() - 8 }); }, [cur]);
  useEffect(() => { const f = () => setTimeout(fit, 120); addEventListener('resize', fit); document.addEventListener('fullscreenchange', f); return () => { removeEventListener('resize', fit); document.removeEventListener('fullscreenchange', f); }; }, []);
  // Opened with "Present" from the overview: straight to the first slide, full screen (the click still counts as the gesture).
  useEffect(() => {
    let go1 = false; try { go1 = sessionStorage.getItem('pl-present') === '1'; sessionStorage.removeItem('pl-present'); } catch { /* */ }
    if (go1) { setCur(0); void box.current?.requestFullscreen?.().catch(() => undefined); }
  }, []);
  // With more than one country in view, a slide compares the countries before the projects.
  const multi = new Set(P.map((p) => p.country)).size > 1, N = multi ? 6 : 5, o = multi ? 1 : 0;
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, select, textarea')) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); setCur((c) => Math.min(N - 1, c + 1)); }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); setCur((c) => Math.max(0, c - 1)); }
      if (e.key === 'Home') setCur(0); if (e.key === 'End') setCur(N - 1);
    };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  }, [N]);
  if (!P.length) return <div class="card empty-page"><div><h2>No projects with a budget</h2><p>Change the filters or import a financial report.</p></div></div>;
  const cname = (id: string) => s.ledger.countries.find((c) => c.id === id)?.name ?? id;
  const scope = s.filters.country ? `${cname(s.filters.country)} portfolio` : 'Portfolio';
  const T = totals(P, TODAY), S = portfolioSeries(P, TODAY);
  const R: Row[] = P.map((p) => { const m = money(p), el = elapsed(p, asOf(p, TODAY)), planned = m.budget * el, perf = planned ? m.spent / planned : 0; return { p, perf, band: bandOf(perf), planned, spent: m.spent, g: gapDrivers(p, TODAY), c: capacity(p, TODAY), e: endOf(p, TODAY), t: trendOf(p) }; });
  const PL = R.reduce((a, r) => a + r.planned, 0), perf = PL ? T.spent / PL : 0, band = bandOf(perf);
  // Projects in the first tenth of their time with nothing spent have no pace yet: shown apart, not counted as behind.
  const early = R.filter((r) => r.c.early), RL = R.filter((r) => !r.c.early);
  const behind = RL.filter((r) => r.band === 'red' || r.band === 'amber');
  // Slide 3: the walk from plan to spent, heading by heading (direct costs).
  const W = portfolioWalk(P, TODAY), steps = W.steps.map((x) => ({ h: x.heading, label: x.label, v: x.gap })), gPlanned = W.planned, gSpent = W.spent, lead = W.lead;
  const cells = RL.flatMap((r) => r.g.drivers.filter((d) => d.gap < 0).map((d) => ({ r, d }))).sort((a, b) => a.d.gap - b.d.gap).slice(0, 5);
  // Slide 4: the end at the current pace.
  const E = [...RL].sort((a, b) => a.e.share - b.e.share), unspent = RL.reduce((a, r) => a + r.e.unspent, 0), budgetT = RL.reduce((a, r) => a + r.e.budget, 0);
  const hard = RL.filter((r) => r.c.verdict === 'out of reach' || r.c.verdict === 'stretch');
  // Slide 5: what to decide.
  const D = decisions(P, TODAY), kinds = [...new Set(D.map((d) => d.kind))];
  const revise = RL.filter((r) => r.c.verdict === 'out of reach');
  const msg: string[] = [
    `${BAND_WORD[band]}: ${pct(perf)} of planned spending, ${short(T.spent)} of ${short(T.budget)} spent at ${pct(T.elapsed)} of time`,
    behind.length ? `${behind.length === RL.length ? `All ${RL.length}` : `${behind.length} of ${RL.length}`} projects are behind plan${RL.filter((r) => r.band === 'red').length ? `, ${RL.filter((r) => r.band === 'red').length} well behind` : ''}` : `All ${RL.length} projects are on or ahead of plan`,
    W.gap < -0.5 && lead ? `Direct costs ${short(-W.gap)} behind plan — ${(HEAD_LABEL[lead.heading] ?? lead.label).toLowerCase()} carries ${pct(lead.share)} of the shortfall` : `Direct costs are on or ahead of plan`,
    unspent > 0.5 ? `At this pace ${short(unspent)} (${pct(budgetT ? unspent / budgetT : 0)}) stays unspent${hard.length ? `; ${hard.length} project${hard.length > 1 ? 's need' : ' needs'} a pace above anything reached so far` : ''}` : 'At this pace every budget is used by its end date',
    D.length || revise.length ? `${D.length + revise.length} decision${D.length + revise.length === 1 ? '' : 's'} this month${kinds.length ? `: ${kinds.slice(0, 3).join(', ').toLowerCase()}` : ''}${revise.length ? `${kinds.length ? ', ' : ': '}revision or extension` : ''}` : 'Nothing needs a decision this month',
  ];
  const CR = [...new Set(RL.map((r) => r.p.country))].map((c) => { const X = RL.filter((r) => r.p.country === c), b = X.reduce((a, r) => a + money(r.p).budget, 0), sp = X.reduce((a, r) => a + r.spent, 0), pl = X.reduce((a, r) => a + r.planned, 0), un = X.reduce((a, r) => a + r.e.unspent, 0);
    return { c, name: cname(c), n: X.length, b, sp, pl, perf: pl ? sp / pl : 0, behind: X.filter((r) => r.band === 'red' || r.band === 'amber').length, un, X }; }).sort((a, b) => a.perf - b.perf);
  if (multi) msg.splice(1, 0, CR.length ? `${CR[0].name} is furthest behind: ${pct(CR[0].perf)} of planned spending across ${CR[0].n} project${CR[0].n > 1 ? 's' : ''}` : 'By country');
  const full = () => { const el = box.current; if (!el) return; if (document.fullscreenElement) void document.exitFullscreen(); else void el.requestFullscreen?.(); };
  return (
    <div class="story" ref={box}>
      <div class="st-bar no-print">
        <div class="st-dots" role="tablist" aria-label="Slides">{msg.map((m, i) => <button role="tab" aria-selected={cur === i} title={m} onClick={() => setCur(i)}>{i + 1}</button>)}</div>
        <span class="muted st-hint">← → to move · one message per slide · prints one slide per page</span>
        <button class="btn" disabled={cur === 0} onClick={() => setCur(cur - 1)} aria-label="Previous slide">‹</button>
        <button class="btn" disabled={cur === N - 1} onClick={() => setCur(cur + 1)} aria-label="Next slide">›</button>
        <button class="btn ghost" onClick={() => go('reports/analysis')}>The figures behind it ›</button>
        <button class="btn" onClick={full}>⛶ Full screen</button>
        <button class="btn primary" onClick={() => print()}>⎙ PDF</button>
      </div>
      <div class="st-deck" data-cur={cur} ref={deck}>
        <Slide i={1} n={N} scope={scope} kicker="Where we stand" msg={msg[0]} sub={`${R.length} projects · figures of the latest financial reports to ${date(TODAY.toISOString().slice(0, 10))}`}>
          <div class="st-big">
            <div class="st-stack" role="img" aria-label="Budget used">
              <span style={{ width: `${T.budget ? T.spent / T.budget * 100 : 0}%`, background: 'var(--c1)' }} />
              <span style={{ width: `${T.budget ? T.committed / T.budget * 100 : 0}%`, background: 'color-mix(in srgb, var(--c1) 40%, var(--surface))' }} />
              <i style={{ left: `${T.budget ? PL / T.budget * 100 : 0}%` }}><b>planned by now · {pct(T.elapsed)} of time</b></i>
            </div>
            <div class="st-nums">
              <div><span>Spent</span><b>{short(T.spent)}</b><small>{pct(T.burn)} of the budget</small></div>
              <div><span>Committed</span><b>{short(T.committed)}</b><small>open contracts and orders</small></div>
              <div><span>Planned by now</span><b>{short(PL)}</b><small>budget × time elapsed</small></div>
              <div><span>Against plan</span><b style={{ color: BAND_COLOR[band] }}>{pct(perf)}</b><small>{T.spent >= PL ? `${short(T.spent - PL)} ahead` : `${short(PL - T.spent)} behind`}</small></div>
            </div>
            {S.length > 1 && <div class="st-chart"><Chart height={210} label="Spending over time" option={(t) => ({ ...spendOption(t, S, T.budget, endMarks(P)), dataZoom: [], legend: { show: false }, grid: { left: 8, right: 70, top: 12, bottom: 8, containLabel: true } })} /></div>}
          </div>
        </Slide>

        {multi && <Slide i={2} n={N} scope={scope} kicker="Country by country" msg={msg[1]} sub="Spent against planned to date per country · bar = spent, tick = planned by now, track = budget · unspent = left at the end at the current pace">
          <ul class="st-end st-ctry">{CR.map((x) => <li>
            <span class="st-el"><b>{x.name}</b><small class="muted">{x.n} project{x.n > 1 ? 's' : ''} · {x.behind} behind</small></span>
            <span class="st-eb"><Bullet value={x.sp} target={x.pl} max={x.b} color={BAND_COLOR[bandOf(x.perf)]} h={14} label={`${x.name}: ${short(x.sp)} spent of ${short(x.pl)} planned`} /></span>
            <b class="num st-ep" style={{ color: BAND_COLOR[bandOf(x.perf)] }}>{pct(x.perf)}</b>
            <span class="num st-eu">{short(x.sp)} / {short(x.b)}</span>
            <span class="num st-eu" style={{ color: x.un > 0.5 ? 'var(--critical)' : undefined }}>{x.un > 0.5 ? `${short(x.un)} unspent` : 'all spent'}</span>
          </li>)}</ul>
        </Slide>}
        <Slide i={2+o} n={N} scope={scope} kicker="Who is where" msg={msg[1+o]} sub="Spent against planned to date · bar = spent, tick = planned by now, track = budget · the line under each card is the trend over the reports">
          <div class="st-lanes">{BANDS.map((b) => { const L = RL.filter((r) => r.band === b).sort((x, y) => x.perf - y.perf); return (
            <div class="st-lane"><h3 style={{ color: BAND_COLOR[b] }}><i style={{ background: BAND_COLOR[b] }} />{BAND_WORD[b]} <span class="muted">{L.length}</span></h3>
              {L.map((r) => <button class="st-card" style={{ borderLeftColor: BAND_COLOR[b] }} onClick={() => go(`project/${r.p.id}/summary`)}>
                <span class="st-ct"><b class="num">{lab(r.p)}</b><b class="num" style={{ color: BAND_COLOR[b] }}>{pct(r.perf)}</b></span>
                <span class="st-cn">{cut(r.p.name, 70)}</span>
                <Bullet value={r.spent} target={r.planned} max={money(r.p).budget} color={BAND_COLOR[b]} label={`${short(r.spent)} spent, ${short(r.planned)} planned`} />
                <span class="st-cf"><small class="muted">{short(r.spent)} / {short(money(r.p).budget)}</small><Spark values={r.t.points.map((x) => x.perf)} ref1={1} min={0} w={70} h={18} color={BAND_COLOR[b]} /></span>
              </button>)}
              {!L.length && <p class="muted st-none">—</p>}
            </div>); })}</div>
          {early.length > 0 && <p class="sl-note">Just started, nothing spent yet: {early.map((r) => `${lab(r.p)} (from ${date(r.p.start)})`).join(', ')} — not counted above.</p>}
        </Slide>

        <Slide i={3+o} n={N} scope={scope} kicker="Why behind" msg={msg[2+o]} sub="From what the plan expected by now to what was spent, heading by heading (direct costs) · red = behind, green = ahead">
          <div class="st-split">
            <div class="st-chart"><Chart height={330} label="From planned to spent by heading" option={(t) => walkOption(t, gPlanned, steps.map((x) => ({ label: x.label, v: x.v })), gSpent)} /></div>
            <div class="st-side"><h3>Largest gaps</h3>
              <ol class="st-gaps">{cells.map(({ r, d }) => <li><b class="num">−{short(-d.gap)}</b><span><b>{lab(r.p)}</b> · {d.label.toLowerCase()}</span><small class="muted">spent {short(d.spent)} of {short(d.planned)} planned by now</small></li>)}</ol>
              {!cells.length && <p class="muted">No heading behind plan.</p>}
            </div>
          </div>
        </Slide>

        <Slide i={4+o} n={N} scope={scope} kicker="Where we end" msg={msg[3+o]} sub="Each budget spent by the end date at the current pace · light = left unspent · badge = whether the pace needed has ever been reached">
          <ul class="st-end">{E.map((r) => { const V = VERDICT[r.c.verdict]; return <li>
            <span class="st-el"><b class="num">{lab(r.p)}</b><small class="muted">ends {date(r.p.end)}</small></span>
            <span class="st-eb"><Bullet value={r.e.atEnd} extra={r.e.unspent} target={r.e.budget} max={r.e.budget} color={BAND_COLOR[r.e.share >= 0.95 ? 'green' : r.e.share >= 0.8 ? 'amber' : 'red']} h={14} label={`${pct(r.e.share)} spent at the end`} /></span>
            <b class="num st-ep">{pct(r.e.share)}</b>
            <span class="num st-eu" style={{ color: r.e.unspent > 0.5 ? 'var(--critical)' : undefined }}>{r.e.unspent > 0.5 ? `${short(r.e.unspent)} unspent` : 'all spent'}</span>
            <span class={`badge ${V.badge}`} title={V.why}>{V.word}</span>
          </li>; })}</ul>
        </Slide>

        <Slide i={5+o} n={N} scope={scope} kicker="What to decide" msg={msg[4+o]} sub="From the figures: addenda, notifications, staff contracts, reports — and the projects that cannot spend their budget at any pace reached so far">
          <div class="st-dec">
            {revise.length > 0 && <div class="st-dk bad"><h3>Revision or extension to consider <span>{revise.length}</span></h3><ul>{revise.map((r) => <li><b>{lab(r.p)}</b> needs {short(r.c.need)} a month to the end; the best it reached is {short(r.c.best)}{r.c.bestFrom ? ` (${date(r.c.bestFrom)} → ${date(r.c.bestTo!)})` : ''}.</li>)}</ul></div>}
            {kinds.map((k) => { const X = D.filter((d) => d.kind === k); return <div class={`st-dk ${X.some((d) => d.tone === 'bad') ? 'bad' : 'warn'}`}><h3>{k} <span>{X.length}</span></h3><ul>{X.length <= 5 ? X.map((d) => <li>{d.text}</li>) : [...new Set(X.map((d) => d.p))].map((q) => { const Y = X.filter((d) => d.p === q); return <li><b>{q ? lab(q) : 'Portfolio'}</b> · {Y.length} {/contract/i.test(k) ? (Y.length === 1 ? 'contract' : 'contracts') : Y.length === 1 ? 'item' : 'items'}{Y.length === 1 ? ` — ${Y[0].text.replace(/^[^:]*:\s*/, '')}` : ''}</li>; })}</ul></div>; })}
            {!D.length && !revise.length && <p class="muted">Nothing needs a decision this month.</p>}
          </div>
        </Slide>
      </div>
    </div>
  );
}
