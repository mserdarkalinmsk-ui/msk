import { Studio } from './Studio';
import { useState } from 'preact/hooks';
import { filtered, go, useStore } from '../data/store';
import { attention, burnGap, deadlines, elapsed, groupBy, money, portfolioSeries, totals, type Deadline } from '../domain/calc';
import { renewals, roster } from '../domain/staff';
import { TODAY } from '../today';
import { Chart } from '../ui/Chart';
import { date, full, month, pct, short, signedPct } from '../ui/format';
import { Filters, spendOption } from './Overview';
import { AlertCentre, Changes, Compliance, History } from './Insights';
import { portfolioSheets } from '../domain/exports';
import { download } from '../ui/xlsxwrite';
import { get } from '../data/store';

const DTONE: Record<Deadline['status'], string> = { submitted: 'good', overdue: 'critical', due: 'serious', upcoming: 'neutral' };

export function Reports() {
  const [tab, setTab] = useState<'studio' | 'brief' | 'alerts' | 'changes' | 'compliance' | 'calendar' | 'history'>(() => (location.hash.split('/')[2] as 'alerts') || 'brief');
  const P = useStore((s) => filtered(s));
  const excel = () => download(`portfolio-${TODAY.toISOString().slice(0, 10)}.xlsx`, portfolioSheets(get().ledger, P, TODAY));
  return (
    <>
      <div class="no-print"><Filters /></div>
      <div class="tabs no-print" role="tablist">
        <button role="tab" aria-selected={tab === 'studio'} onClick={() => setTab('studio')}>Report studio</button>
        <button role="tab" aria-selected={tab === 'brief'} onClick={() => setTab('brief')}>Executive brief</button>
        <button role="tab" aria-selected={tab === 'alerts'} onClick={() => setTab('alerts')}>Alert centre</button>
        <button role="tab" aria-selected={tab === 'changes'} onClick={() => setTab('changes')}>What changed</button>
        <button role="tab" aria-selected={tab === 'compliance'} onClick={() => setTab('compliance')}>Compliance & results</button>
        <button role="tab" aria-selected={tab === 'calendar'} onClick={() => setTab('calendar')}>Reporting calendar</button>
        <button role="tab" aria-selected={tab === 'history'} onClick={() => setTab('history')}>History</button>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
          <button class="btn" onClick={excel} title="All projects, budget lines, staff, alerts and calendar in one workbook">⤓ Excel</button>
          <button class="btn" onClick={() => print()}>⎙ PDF</button>
        </span>
      </div>
      {tab === 'studio' ? <Studio /> : tab === 'brief' ? <Brief /> : tab === 'alerts' ? <AlertCentre projects={P} /> : tab === 'changes' ? <Changes projects={P} /> : tab === 'history' ? <History /> : tab === 'compliance' ? <Compliance projects={P} /> : <Calendar />}
    </>
  );
}

function Brief() {
  const s = useStore((x) => x);
  const P = filtered(s);
  const T = totals(P, TODAY), S = portfolioSeries(P, TODAY), F = attention(P, TODAY);
  const people = P.flatMap((p) => roster(p, TODAY));
  const due = renewals(people, TODAY, 90);
  const D = P.flatMap((p) => deadlines(p, TODAY)).filter((d) => d.status !== 'submitted').sort((a, b) => a.due.localeCompare(b.due));
  const cname = (id: string) => s.ledger.countries.find((c) => c.id === id)?.name ?? id;
  const scope = [s.filters.country && cname(s.filters.country), s.filters.sector].filter(Boolean).join(' · ') || 'Whole portfolio';
  const gap = T.burn - T.elapsed, final = S.at(-1)?.mid;
  const behind = P.filter((p) => burnGap(p, TODAY) < -0.15 && elapsed(p, TODAY) > 0.1);
  return (
    <article class="brief">
      <header class="brief-h">
        <div><div class="muted" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '.08em' }}>Executive brief · {scope}</div>
          <h2>Portfolio position at {date(TODAY.toISOString().slice(0, 10))}</h2></div>
        <button class="btn primary no-print" onClick={() => print()}>Print / save as PDF</button>
      </header>
      <div class="brief-kpis">
        <div><span>Budget</span><b class="num">{short(T.budget)}</b><small>{T.projects} projects</small></div>
        <div><span>Spent</span><b class="num">{short(T.spent)}</b><small>{pct(T.burn)} of budget</small></div>
        <div><span>Pace vs time</span><b class="num">{signedPct(gap)}</b><small>{pct(T.elapsed)} of time used</small></div>
        <div><span>Staff</span><b class="num">{people.filter((a) => a.status === 'Active').length}</b><small>{due.length} renewals ≤ 90 days</small></div>
      </div>
      <section>
        <h3>Financial position</h3>
        <p>
          The {scope.toLowerCase() === 'whole portfolio' ? 'portfolio' : scope} has spent <b>{full(T.spent)}</b> ({pct(T.burn)}) of a {full(T.budget)} budget with {pct(T.elapsed)} of implementation time elapsed,
          {Math.abs(gap) < 0.05 ? ' broadly in line with a linear plan.' : gap < 0 ? ` ${Math.abs(Math.round(gap * 100))} percentage points behind a linear plan.` : ` ${Math.round(gap * 100)} percentage points ahead of a linear plan.`}
          {' '}A further {full(T.committed)} is committed, leaving {full(T.remaining)} uncommitted.
          {final != null && <> At the recent burn rate, end-of-period spend is projected at <b>{full(final)}</b> ({pct(T.budget ? final / T.budget : 0)} of budget).</>}
          {behind.length > 0 && <> Projects furthest behind: {behind.map((p) => `${p.code} (${signedPct(burnGap(p, TODAY))})`).join(', ')}.</>}
        </p>
        <div class="brief-chart"><Chart height={240} label="Cumulative spending" option={(t) => ({ ...spendOption(t, S, T.budget), dataZoom: [], grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true } })} /></div>
      </section>
      <section>
        <h3>Management attention</h3>
        {F.length ? <ul class="brief-list">{F.slice(0, 10).map((f) => <li><span class={`badge ${f.severity}`}>{f.severity}</span> <b>{P.find((p) => p.id === f.projectId)?.code}</b> — {f.title}: <span class="muted">{f.detail}</span></li>)}</ul> : <p>No items above thresholds.</p>}
        {F.length > 10 && <p class="muted">… and {F.length - 10} more.</p>}
      </section>
      <section>
        <h3>Projects</h3>
        <table class="mini">
          <thead><tr><th>Project</th><th>Country</th><th class="r">Budget</th><th class="r">Spent</th><th class="r">Pace</th><th>Ends</th><th>Next report due</th></tr></thead>
          <tbody>{P.map((p) => { const m = money(p), nd = deadlines(p, TODAY).find((d) => d.status !== 'submitted'); return (
            <tr><td><b class="num">{p.code}</b> {p.name}</td><td>{cname(p.country)}</td><td class="r num">{short(m.budget)}</td><td class="r num">{pct(m.budget ? m.spent / m.budget : 0)}</td>
              <td class="r num">{signedPct(burnGap(p, TODAY))}</td><td>{month(p.end)}</td><td>{nd ? <>{date(nd.due)} {nd.status !== 'upcoming' && <span class={`badge ${DTONE[nd.status]}`}>{nd.status}</span>}</> : '—'}</td></tr>); })}</tbody>
        </table>
      </section>
      <div class="brief-2">
        <section>
          <h3>By country</h3>
          <table class="mini"><tbody>{groupBy(P, (p) => p.country).map((g) => <tr><td>{cname(g.key)}</td><td class="r num">{short(g.budget)}</td><td class="r num">{pct(g.budget ? g.spent / g.budget : 0)} spent</td></tr>)}</tbody></table>
        </section>
        <section>
          <h3>Upcoming deadlines</h3>
          <table class="mini"><tbody>{D.slice(0, 6).map((d) => <tr><td class="num">{d.project.code}</td><td>{d.kind}</td><td>{date(d.due)}</td><td><span class={`badge ${DTONE[d.status]}`}>{d.status}</span></td></tr>)}</tbody></table>
        </section>
      </div>
      <footer class="muted brief-f">Figures from the latest financial report per project; pace = share of budget spent minus share of time elapsed. Generated by Portfolio Ledger.</footer>
    </article>
  );
}

function Calendar() {
  const s = useStore((x) => x);
  const P = filtered(s);
  const D = P.flatMap((p) => deadlines(p, TODAY)).sort((a, b) => a.due.localeCompare(b.due));
  const open = D.filter((d) => d.status !== 'submitted');
  const byMonth = new Map<string, Deadline[]>();
  open.forEach((d) => { const k = d.due.slice(0, 7); byMonth.set(k, [...(byMonth.get(k) ?? []), d]); });
  const n = (st: Deadline['status']) => D.filter((d) => d.status === st).length;
  return (
    <>
      <section class="hero" aria-label="Reporting deadlines">
        <div class="kpi lead"><span class="label">Overdue reports</span><span class="value" style={{ color: n('overdue') ? 'var(--critical)' : undefined }}>{n('overdue')}</span><span class="ctx">period ended, no report on file after the due date</span></div>
        <div class="kpi"><span class="label">Due within 60 days</span><span class="value">{n('due')}</span><span class="ctx">{open.find((d) => d.status === 'due') ? <>next: <b>{open.find((d) => d.status === 'due')!.project.code}</b> on {date(open.find((d) => d.status === 'due')!.due)}</> : 'nothing imminent'}</span></div>
        <div class="kpi"><span class="label">Later</span><span class="value">{n('upcoming')}</span><span class="ctx">scheduled until the final reports</span></div>
        <div class="kpi"><span class="label">Submitted</span><span class="value">{n('submitted')}</span><span class="ctx">periods covered by a report on file</span></div>
      </section>
      <section class="card">
        <div class="card-h"><div><h2>Reporting calendar</h2><p>From each contract: progress report every reporting period (due after the period end) and a final report after the project ends</p></div></div>
        <div class="card-b cal">
          {[...byMonth].map(([k, ds]) => (
            <div class="cal-m">
              <div class="cal-h">{month(k + '-01')}</div>
              {ds.map((d) => (
                <button class="cal-i" onClick={() => go(`project/${d.project.id}`)}>
                  <span class={`badge ${DTONE[d.status]}`}>{d.status}</span>
                  <b class="num">{d.project.code}</b><span>{d.kind}</span>
                  <span class="muted">period to {date(d.periodEnd)}</span>
                  <span class="num" style={{ marginLeft: 'auto' }}>due {date(d.due)}</span>
                </button>
              ))}
            </div>
          ))}
          {!open.length && <p class="muted">All reporting periods are covered.</p>}
        </div>
      </section>
    </>
  );
}
