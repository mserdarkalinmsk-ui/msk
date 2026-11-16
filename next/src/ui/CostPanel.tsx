import { filtered, go, useStore } from '../data/store';
import { band, costPerf, type CostPerf } from '../domain/costPerf';
import { plabel } from '../domain/label';
import type { Project } from '../domain/types';
import { reportWorkbook } from '../pages/FinancialReport';
import { TODAY } from '../today';
import { download } from './xlsxwrite';
import { date, full, pct, short } from './format';

/* Is spending on track — in plain words. The method underneath is the earned value standard (PMI / ISO 21508);
   the screen says what each figure means instead of naming it. */
const P = (v: number | null) => (v == null ? '—' : pct(v));
const times = (v: number | null) => (v == null ? '—' : `${v.toFixed(1)}×`);
const Tone = ({ v, children }: { v: number | null; children: preact.ComponentChildren }) => <span class={`cp-i ${band(v) ?? ''}`}>{children}</span>;
const left = (v: number) => (v >= 0 ? `${full(v)} left unused` : `${full(-v)} over budget`);

/** One project: planned by now against spent, where the project ends three ways, and what the Work Plans delivered. */
export function CostCard({ p }: { p: Project }) {
  const c = costPerf(p, TODAY, reportWorkbook(p));
  return (
    <section class="card span-12 cpf">
      <div class="card-h"><div><h2>Is spending on track?</h2><p>Figures of the report of {date(c.asAt)}, against a plan that spreads the budget evenly over the project period</p></div></div>
      <div class="card-b">
        <div class="cpf-k">
          <div><span>Total budget</span><b>{full(c.bac)}</b><small>{date(p.start)} → {date(p.end)}</small></div>
          <div><span>Planned by now</span><b>{full(c.pv)}</b><small>{pct(c.timeGone)} of the period has passed</small></div>
          <div><span>Spent</span><b>{full(c.ac)}</b><small>{full(c.sc)} with what is committed</small></div>
          <div><span>Spent against plan</span><b><Tone v={c.fei}>{P(c.fei)}</Tone></b><small>{c.sv >= 0 ? `${short(c.sv)} ahead of the plan` : `${short(-c.sv)} behind the plan`}</small></div>
          <div><span>Pace needed to use the budget</span><b><Tone v={c.tcpiRate == null ? null : 2 - c.tcpiRate}>{times(c.tcpiRate)}</Tone></b><small>{full(c.needRate)} a month, today {full(c.rate)}</small></div>
        </div>
        {!c.early && <>
          <h3 class="cpf-h3">Where the project ends</h3>
          <table class="mini cpf-t"><thead><tr><th>If spending goes on…</th><th>How it is worked out</th><th class="r">Total at the end</th><th class="r">Of the budget</th><th class="r">At the end</th></tr></thead>
            <tbody>{c.eac.map((w) => <tr class={w.key === c.main.key ? 'cpf-main' : ''}><td><b>{w.label}</b>{w.key === c.main.key && <span class="badge neutral" style={{ marginLeft: '6px' }}>most likely</span>}</td><td class="muted">{w.basis}</td><td class="r num">{full(w.eac)}</td><td class="r num">{pct(c.bac ? w.eac / c.bac : 0, 1)}</td>
              <td class="r num" style={{ color: w.vac < 0 ? 'var(--critical)' : w.vac > c.bac * 0.15 ? 'var(--warn)' : undefined }}>{left(w.vac)}</td></tr>)}</tbody></table>
        </>}
        {c.ev.length > 0 && <>
          <h3 class="cpf-h3">What the Work Plans delivered</h3>
          <table class="mini cpf-t"><thead><tr><th>Work Plan</th><th>Activities</th><th class="r">Planned</th><th class="r">Planned value of what was done</th><th class="r">Spent on it</th><th class="r">Done of the plan</th><th class="r">Value done per € spent</th></tr></thead>
            <tbody>{c.ev.map((x) => <tr><td><b>{x.wp}</b> <small class="muted">{date(x.from)} → {date(x.to)}</small></td><td class="muted">{x.done} done · {x.postponed} postponed · {x.cancelled} cancelled{x.unknown ? ` · ${x.unknown} no status` : ''}</td>
              <td class="r num">{full(x.pv)}</td><td class="r num">{full(x.ev)}</td><td class="r num">{x.ac == null ? '—' : full(x.ac)}</td><td class="r"><Tone v={x.spi}>{P(x.spi)}</Tone></td><td class="r"><Tone v={x.cpi}>{x.cpi == null ? '—' : `€${x.cpi.toFixed(2)}`}</Tone></td></tr>)}</tbody></table>
        </>}
        {c.notes.length > 0 && <ul class="cpf-notes">{c.notes.map((n) => <li>{n}</li>)}</ul>}
      </div>
    </section>
  );
}

/** Every project side by side, with the portfolio total. */
export function CostPortfolio() {
  const s = useStore((x) => x);
  const L = filtered(s).filter((p) => !/closed/i.test(p.status ?? ''));
  const R: { p: Project; c: CostPerf }[] = L.map((p) => ({ p, c: costPerf(p, TODAY, reportWorkbook(p)) })).sort((a, b) => (a.c.fei ?? 9) - (b.c.fei ?? 9));
  // Projects with no spending yet stay out of the totals: there is no pace to project from.
  const T = R.filter(({ c }) => !c.early).reduce((a, { c }) => ({ bac: a.bac + c.bac, pv: a.pv + c.pv, ac: a.ac + c.ac, eac: a.eac + c.main.eac }), { bac: 0, pv: 0, ac: 0, eac: 0 });
  const early = R.filter(({ c }) => c.early).length;
  const xlsx = () => download(`spending-on-track-${TODAY.toISOString().slice(0, 10)}.xlsx`, [{ name: 'Spending on track', money: [2, 3, 4, 6, 8, 9, 10], rows: [
    ['Project', 'Report of', 'Total budget', 'Planned by now', 'Spent', 'Spent against plan', 'Total at the end (most likely)', 'How it is worked out', 'Left unused at the end (negative = over)', 'Needed a month', 'Spent a month today', 'Pace needed (× today)'].map((v) => ({ v, st: 'head' as const })),
    ...R.map(({ p, c }) => [plabel(p), c.asAt, c.bac, c.pv, c.ac, c.fei == null ? '' : +c.fei.toFixed(3), c.early ? '' : c.main.eac, c.early ? 'no spending yet' : c.main.label, c.early ? '' : c.main.vac, c.needRate, c.rate, c.tcpiRate == null ? '' : +c.tcpiRate.toFixed(2)]),
  ] }]);
  return (
    <>
      <section class="hero" aria-label="Is spending on track">
        <div class="kpi lead"><span class="label">Spent against plan</span><span class="value">{T.pv ? pct(T.ac / T.pv) : '—'}</span><span class="ctx">{short(T.ac)} spent of {short(T.pv)} planned by now</span></div>
        <div class="kpi"><span class="label">Total at the end</span><span class="value">{short(T.eac)}</span><span class="ctx">most likely · {pct(T.bac ? T.eac / T.bac : 0)} of the {short(T.bac)} budget</span></div>
        <div class="kpi" data-tone={T.bac - T.eac > T.bac * 0.15 ? 'warn' : undefined}><span class="label">{T.bac >= T.eac ? 'Left unused at the end' : 'Over budget at the end'}</span><span class="value">{short(Math.abs(T.bac - T.eac))}</span><span class="ctx">if spending goes on as it most likely will</span></div>
      </section>
      <section class="card" style={{ marginTop: '16px' }}>
        <div class="card-h"><div><h2>Is spending on track — by project</h2><p>Each project's latest report against a plan that spreads its budget evenly over its period · the total at the end follows the report's own plan where there is one, else today's pace · click a project to open it</p></div>
          <div class="tools"><button class="btn" onClick={xlsx}>⤓ Excel</button></div></div>
        <div class="card-b table-scroll"><table class="mini cpf-t"><thead><tr><th>Project</th><th class="r">Total budget</th><th class="r">Planned by now</th><th class="r">Spent</th><th class="r">Spent against plan</th><th class="r">Total at the end</th><th class="r">At the end</th><th class="r">Pace needed</th><th class="r">Last Work Plan done</th></tr></thead>
          <tbody>{R.map(({ p, c }) => { const ev = c.ev.at(-1); return (
            <tr class="click" onClick={() => go(`project/${p.id}/summary`)}><td><b>{plabel(p)}</b><small class="muted"> · report of {date(c.asAt)}</small></td><td class="r num">{full(c.bac)}</td><td class="r num">{full(c.pv)}</td><td class="r num">{full(c.ac)}</td>
              {c.early ? <td class="muted" colSpan={4} style={{ textAlign: 'center' }}>no spending yet — too early to say where it ends</td> : <>
              <td class="r"><Tone v={c.fei}>{P(c.fei)}</Tone></td><td class="r num" title={c.main.basis}>{full(c.main.eac)}</td>
              <td class="r num" style={{ color: c.main.vac < 0 ? 'var(--critical)' : c.main.vac > c.bac * 0.15 ? 'var(--warn)' : undefined }}>{c.main.vac >= 0 ? `${short(c.main.vac)} unused` : `${short(-c.main.vac)} over`}</td>
              <td class="r"><Tone v={c.tcpiRate == null ? null : 2 - c.tcpiRate}>{times(c.tcpiRate)}</Tone></td></>}
              <td class="r">{ev ? <Tone v={ev.spi}>{P(ev.spi)}</Tone> : <span class="muted">no statuses</span>}</td></tr>); })}</tbody>
          <tfoot><tr><td><b>All projects</b>{early ? <small class="muted"> · {early} too early, not counted</small> : ''}</td><td class="r num">{full(T.bac)}</td><td class="r num">{full(T.pv)}</td><td class="r num">{full(T.ac)}</td><td class="r num">{T.pv ? pct(T.ac / T.pv) : '—'}</td><td class="r num">{full(T.eac)}</td><td class="r num">{left(T.bac - T.eac)}</td><td /><td /></tr></tfoot></table>
          <ul class="cpf-notes">
            <li><b>Planned by now</b>: the budget × the share of the project period that has passed.</li>
            <li><b>Spent against plan</b>: spent ÷ planned by now. 100% = on plan; below 95% behind it.</li>
            <li><b>Pace needed</b>: how many times today's monthly spending is needed to use the whole budget by the end date.</li>
            <li><b>Last Work Plan done</b>: the planned amount of the activities marked done, as a share of what that Work Plan planned (needs activity statuses).</li>
          </ul></div>
      </section>
    </>
  );
}
