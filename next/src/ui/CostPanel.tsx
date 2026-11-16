import { filtered, go, useStore } from '../data/store';
import { band, costPerf, type CostPerf } from '../domain/costPerf';
import { plabel } from '../domain/label';
import type { Project } from '../domain/types';
import { reportWorkbook } from '../pages/FinancialReport';
import { TODAY } from '../today';
import { download } from './xlsxwrite';
import { date, full, pct, short } from './format';

const idx = (v: number | null) => (v == null ? '—' : v.toFixed(2));
const Tone = ({ v, children }: { v: number | null; children: preact.ComponentChildren }) => <span class={`cp-i ${band(v) ?? ''}`}>{children}</span>;

/** One project's cost performance: baseline, execution, three estimates at completion and earned value by Work Plan. */
export function CostCard({ p }: { p: Project }) {
  const c = costPerf(p, TODAY, reportWorkbook(p));
  return (
    <section class="card span-12 cpf">
      <div class="card-h"><div><h2>Cost performance</h2><p>Earned value method (PMI / ISO 21508) on the figures of the report of {date(c.asAt)} · baseline = the budget spread evenly over the period</p></div></div>
      <div class="card-b">
        <div class="cpf-k">
          <div><span>Budget at completion</span><b>{full(c.bac)}</b><small>BAC</small></div>
          <div><span>Planned value to date</span><b>{full(c.pv)}</b><small>PV · {pct(c.timeGone)} of the period</small></div>
          <div><span>Actual cost</span><b>{full(c.ac)}</b><small>AC · spent</small></div>
          <div><span>Financial execution</span><b><Tone v={c.fei}>{idx(c.fei)}</Tone></b><small>AC ÷ PV · {c.sv >= 0 ? 'ahead by' : 'behind by'} {short(Math.abs(c.sv))}</small></div>
          <div><span>Needed ÷ current pace</span><b><Tone v={c.tcpiRate == null ? null : 2 - c.tcpiRate}>{idx(c.tcpiRate)}</Tone></b><small>{full(c.needRate)} vs {full(c.rate)} a month</small></div>
        </div>
        {!c.early && <table class="mini cpf-t"><thead><tr><th>Estimate at completion</th><th>Basis</th><th class="r">EAC</th><th class="r">% of budget</th><th class="r">At the end (VAC)</th></tr></thead>
          <tbody>{c.eac.map((w) => <tr class={w.key === c.main.key ? 'cpf-main' : ''}><td><b>{w.label}</b>{w.key === c.main.key && <span class="badge neutral" style={{ marginLeft: '6px' }}>used</span>}</td><td class="muted">{w.basis}</td><td class="r num">{full(w.eac)}</td><td class="r num">{pct(c.bac ? w.eac / c.bac : 0, 1)}</td>
            <td class="r num" style={{ color: w.vac < 0 ? 'var(--critical)' : w.vac > c.bac * 0.15 ? 'var(--warn)' : undefined }}>{w.vac >= 0 ? `${full(w.vac)} unused` : `${full(-w.vac)} over`}</td></tr>)}</tbody></table>}
        {c.ev.length > 0 && <>
          <h3 class="cpf-h3">Earned value by Work Plan</h3>
          <table class="mini cpf-t"><thead><tr><th>Work Plan</th><th>Activities</th><th class="r">PV (planned)</th><th class="r">EV (done)</th><th class="r">AC (spent on it)</th><th class="r">SPI</th><th class="r">CPI</th></tr></thead>
            <tbody>{c.ev.map((x) => <tr><td><b>{x.wp}</b> <small class="muted">{date(x.from)} → {date(x.to)}</small></td><td class="muted">{x.done} done · {x.postponed} postponed · {x.cancelled} cancelled{x.unknown ? ` · ${x.unknown} no status` : ''}</td>
              <td class="r num">{full(x.pv)}</td><td class="r num">{full(x.ev)}</td><td class="r num">{x.ac == null ? '—' : full(x.ac)}</td><td class="r"><Tone v={x.spi}>{idx(x.spi)}</Tone></td><td class="r"><Tone v={x.cpi}>{idx(x.cpi)}</Tone></td></tr>)}</tbody></table>
        </>}
        {c.notes.length > 0 && <ul class="cpf-notes">{c.notes.map((n) => <li>{n}</li>)}</ul>}
      </div>
    </section>
  );
}

/** Every project's cost performance side by side, with the portfolio total. */
export function CostPortfolio() {
  const s = useStore((x) => x);
  const P = filtered(s).filter((p) => !/closed/i.test(p.status ?? ''));
  const R: { p: Project; c: CostPerf }[] = P.map((p) => ({ p, c: costPerf(p, TODAY, reportWorkbook(p)) })).sort((a, b) => (a.c.fei ?? 9) - (b.c.fei ?? 9));
  // Projects with no spending yet stay out of the totals: they have no pace to project from.
  const T = R.filter(({ c }) => !c.early).reduce((a, { c }) => ({ bac: a.bac + c.bac, pv: a.pv + c.pv, ac: a.ac + c.ac, eac: a.eac + c.main.eac }), { bac: 0, pv: 0, ac: 0, eac: 0 });
  const early = R.filter(({ c }) => c.early).length;
  const xlsx = () => download(`cost-performance-${TODAY.toISOString().slice(0, 10)}.xlsx`, [{ name: 'Cost performance', money: [2, 3, 4, 6, 7, 9, 10], rows: [
    ['Project', 'Report', 'BAC', 'PV', 'AC', 'AC ÷ PV', 'EAC', 'EAC basis', 'VAC', 'Needed a month', 'Current a month', 'Needed ÷ current'].map((v) => ({ v, st: 'head' as const })),
    ...R.map(({ p, c }) => [plabel(p), c.asAt, c.bac, c.pv, c.ac, c.fei == null ? '' : +c.fei.toFixed(3), c.main.eac, c.main.label, c.main.vac, c.needRate, c.rate, c.tcpiRate == null ? '' : +c.tcpiRate.toFixed(3)]),
  ] }]);
  return (
    <>
      <section class="hero" aria-label="Cost performance">
        <div class="kpi lead"><span class="label">Financial execution</span><span class="value">{T.pv ? (T.ac / T.pv).toFixed(2) : '—'}</span><span class="ctx">spent {short(T.ac)} against {short(T.pv)} planned to date</span></div>
        <div class="kpi"><span class="label">Estimate at completion</span><span class="value">{short(T.eac)}</span><span class="ctx">{pct(T.bac ? T.eac / T.bac : 0)} of {short(T.bac)}</span></div>
        <div class="kpi" data-tone={T.bac - T.eac > T.bac * 0.15 ? 'warn' : undefined}><span class="label">At the end</span><span class="value">{short(Math.abs(T.bac - T.eac))}</span><span class="ctx">{T.bac >= T.eac ? 'would stay unused' : 'over budget'}</span></div>
      </section>
      <section class="card" style={{ marginTop: '16px' }}>
        <div class="card-h"><div><h2>Cost performance by project</h2><p>Earned value method on each project's latest report · baseline = budget spread evenly over the period · EAC from the report plan where there is one, else the current pace · click a project to open it</p></div>
          <div class="tools"><button class="btn" onClick={xlsx}>⤓ Excel</button></div></div>
        <div class="card-b table-scroll"><table class="mini cpf-t"><thead><tr><th>Project</th><th class="r">BAC</th><th class="r">PV to date</th><th class="r">AC</th><th class="r">AC ÷ PV</th><th class="r">EAC</th><th class="r">At the end</th><th class="r">Needed ÷ current pace</th><th class="r">SPI / CPI (last WP)</th></tr></thead>
          <tbody>{R.map(({ p, c }) => { const ev = c.ev.at(-1); return (
            <tr class="click" onClick={() => go(`project/${p.id}/summary`)}><td><b>{plabel(p)}</b><small class="muted"> · {date(c.asAt)}</small></td><td class="r num">{full(c.bac)}</td><td class="r num">{full(c.pv)}</td><td class="r num">{full(c.ac)}</td>
              {c.early ? <td class="muted" colSpan={4} style={{ textAlign: 'center' }}>no spending yet — too early to project</td> : <>
              <td class="r"><Tone v={c.fei}>{idx(c.fei)}</Tone></td><td class="r num" title={c.main.basis}>{full(c.main.eac)}</td>
              <td class="r num" style={{ color: c.main.vac < 0 ? 'var(--critical)' : c.main.vac > c.bac * 0.15 ? 'var(--warn)' : undefined }}>{c.main.vac >= 0 ? `${short(c.main.vac)} unused` : `${short(-c.main.vac)} over`}</td>
              <td class="r"><Tone v={c.tcpiRate == null ? null : 2 - c.tcpiRate}>{idx(c.tcpiRate)}</Tone></td></>}
              <td class="r">{ev ? <><Tone v={ev.spi}>{idx(ev.spi)}</Tone> / <Tone v={ev.cpi}>{idx(ev.cpi)}</Tone></> : <span class="muted">no statuses</span>}</td></tr>); })}</tbody>
          <tfoot><tr><td><b>Portfolio</b>{early ? <small class="muted"> · {early} too early, not counted</small> : ''}</td><td class="r num">{full(T.bac)}</td><td class="r num">{full(T.pv)}</td><td class="r num">{full(T.ac)}</td><td class="r num">{T.pv ? (T.ac / T.pv).toFixed(2) : '—'}</td><td class="r num">{full(T.eac)}</td><td class="r num">{full(T.bac - T.eac)}</td><td /><td /></tr></tfoot></table>
          <p class="muted cpf-foot">AC ÷ PV: 1.00 = spending keeps up with the baseline; below 0.95 behind it. Needed ÷ current pace: how many times today's monthly spending is needed to use the budget by the end. SPI and CPI need earned value, recorded as the status of the activities of an ended Work Plan.</p></div>
      </section>
    </>
  );
}
