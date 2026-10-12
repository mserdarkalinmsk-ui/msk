import type { Project } from '../domain/types';
import { annualPlan } from '../domain/annual';
import { TODAY } from '../today';
import { base, Chart, type Tokens } from '../ui/Chart';
import { full, short } from '../ui/format';
import { download } from '../ui/xlsxwrite';

const thisYear = TODAY.getUTCFullYear();

/** One project: cash still to pay per calendar year and heading, with what was already spent in past years. */
export function AnnualPlanCard({ p }: { p: Project }) {
  const A = annualPlan(p, TODAY);
  const Y = A.years.filter((y) => y >= thisYear);
  const xlsx = () => download(`${p.code}-annual-plan.xlsx`, [{ name: 'Annual plan', money: [1, 2, 3, ...Y.map((_, i) => 4 + i)], rows: [
    ['Heading', 'Budget', 'Spent', 'Committed', ...Y.map(String)], ...A.rows.map((r) => [r.label, r.budget, r.spent, r.committed, ...Y.map((y) => Math.round(r.byYear[y]))]),
    ['Total', A.rows.reduce((a, r) => a + r.budget, 0), A.rows.reduce((a, r) => a + r.spent, 0), A.rows.reduce((a, r) => a + r.committed, 0), ...Y.map((y) => Math.round(A.total[y]))]] }]);
  return (
    <div class="grid g-12">
      <section class="card span-12">
        <div class="card-h" style={{ alignItems: 'center' }}><div><h2>Annual budget plan</h2><p>Cash still to pay per calendar year until {p.end}: open commitments in the next three months, the free balance spread evenly over the months left</p></div><button class="btn" style={{ marginLeft: 'auto' }} onClick={xlsx}>⤓ Excel</button></div>
        <div class="card-b">
          <div class="ap-years">{A.years.map((y) => <div class={y < thisYear ? 'past' : y === thisYear ? 'cur' : ''}><span>{y}{y === thisYear ? ' · rest of year' : ''}</span><b class="num">{short(y < thisYear ? A.past[y] ?? 0 : A.total[y])}</b><small>{y < thisYear ? 'spent' : y === thisYear ? `${short(A.past[y] ?? 0)} spent so far` : 'to pay'}</small></div>)}</div>
          <Chart height={220} label="Spending by year" option={(t) => yearsOption(t, A, thisYear)} />
          <div class="table-scroll"><table class="mini ap-plan">
            <thead><tr><th>Heading</th><th class="r">Budget</th><th class="r">Spent</th><th class="r">Committed</th><th class="r">Free</th>{Y.map((y) => <th class="r">{y}</th>)}</tr></thead>
            <tbody>{A.rows.map((r) => <tr><td>{r.h !== '*' && <b>{r.h}. </b>}{r.label}</td><td class="r num">{full(r.budget)}</td><td class="r num">{full(r.spent)}</td><td class="r num">{full(r.committed)}</td><td class="r num">{full(r.free)}</td>{Y.map((y) => <td class="r num">{full(r.byYear[y])}</td>)}</tr>)}</tbody>
            <tfoot><tr><td>Total</td><td class="r num">{full(A.rows.reduce((a, r) => a + r.budget, 0))}</td><td class="r num">{full(A.rows.reduce((a, r) => a + r.spent, 0))}</td><td class="r num">{full(A.rows.reduce((a, r) => a + r.committed, 0))}</td><td class="r num">{full(A.rows.reduce((a, r) => a + r.free, 0))}</td>{Y.map((y) => <td class="r num">{full(A.total[y])}</td>)}</tr></tfoot>
          </table></div>
        </div>
      </section>
    </div>
  );
}

function yearsOption(t: Tokens, A: ReturnType<typeof annualPlan>, cur: number) {
  return {
    ...base(t), grid: { left: 8, right: 16, top: 26, bottom: 8, containLabel: true },
    legend: { top: 0, left: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10, textStyle: { color: t.ink2, fontSize: 11.5 } },
    tooltip: { ...(base(t).tooltip as object), trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v: number) => full(v) },
    xAxis: { type: 'category', data: A.years.map(String), axisLabel: { color: t.ink3 }, axisLine: { lineStyle: { color: t.line } }, axisTick: { show: false } },
    yAxis: { type: 'value', axisLabel: { color: t.ink3, formatter: (v: number) => short(v) }, splitLine: { lineStyle: { color: t.line } } },
    series: [
      { name: 'Spent', type: 'bar', stack: 'y', barWidth: '50%', data: A.years.map((y) => Math.round(A.past[y] ?? 0)), itemStyle: { color: t.c[0] } },
      { name: 'To pay (plan)', type: 'bar', stack: 'y', data: A.years.map((y) => (y >= cur ? Math.round(A.total[y]) : 0)), itemStyle: { color: t.c[1], borderRadius: [3, 3, 0, 0] } },
    ],
  };
}

/** Portfolio: cash need per project and year. */
export function AnnualPortfolio({ projects }: { projects: Project[] }) {
  const R = projects.filter((p) => !p.datesTbc).map((p) => ({ p, A: annualPlan(p, TODAY) }));
  const Y = [...new Set(R.flatMap((x) => x.A.years))].filter((y) => y >= thisYear).sort();
  const tot = (y: number) => R.reduce((a, x) => a + (x.A.total[y] ?? 0), 0), max = Math.max(1, ...Y.map(tot));
  const lab = (p: Project) => (p.bh ? `BH ${p.bh}` : p.code);
  const xlsx = () => download(`portfolio-annual-plan-${TODAY.toISOString().slice(0, 10)}.xlsx`, [{ name: 'Annual plan', money: Y.map((_, i) => 2 + i), rows: [
    ['Project', 'Ends', ...Y.map(String)], ...R.map((x) => [lab(x.p), x.p.end, ...Y.map((y) => Math.round(x.A.total[y] ?? 0))]), ['Total', '', ...Y.map((y) => Math.round(tot(y)))]] }]);
  return (
    <>
      <section class="hero" aria-label="Annual plan">{Y.slice(0, 4).map((y, i) => <div class={`kpi${i ? '' : ' lead'}`}><span class="label">{y}{y === thisYear ? ' · rest of year' : ''}</span><span class="value">{short(tot(y))}</span><span class="ctx">cash to pay across {R.filter((x) => (x.A.total[y] ?? 0) > 1).length} projects</span><div class="meter"><span style={{ width: `${tot(y) / max * 100}%`, background: 'var(--c1)' }} /></div></div>)}</section>
      <section class="card" style={{ marginTop: '16px' }}>
        <div class="card-h" style={{ alignItems: 'center' }}><div><h2>Annual cash plan by project</h2><p>Open commitments in the next three months, the free balance spread evenly until each project's end date</p></div><button class="btn" style={{ marginLeft: 'auto' }} onClick={xlsx}>⤓ Excel</button></div>
        <div class="card-b table-scroll"><table class="mini ap-plan">
          <thead><tr><th>Project</th><th>Ends</th>{Y.map((y) => <th class="r">{y}</th>)}<th class="r">Total</th></tr></thead>
          <tbody>{R.map((x) => { const m = Math.max(1, ...Y.map((y) => x.A.total[y] ?? 0)); return <tr><td><b>{lab(x.p)}</b> <span class="muted">{x.p.name.slice(0, 50)}</span></td><td class="num">{x.p.end}</td>{Y.map((y) => { const v = x.A.total[y] ?? 0; return <td class="r num" style={{ background: v > 1 ? `color-mix(in srgb,var(--c1) ${Math.round(6 + v / m * 30)}%,var(--surface))` : undefined }}>{v > 1 ? short(v) : ''}</td>; })}<td class="r num"><b>{short(Y.reduce((a, y) => a + (x.A.total[y] ?? 0), 0))}</b></td></tr>; })}</tbody>
          <tfoot><tr><td colSpan={2}>Total</td>{Y.map((y) => <td class="r num">{short(tot(y))}</td>)}<td class="r num">{short(Y.reduce((a, y) => a + tot(y), 0))}</td></tr></tfoot>
        </table></div>
      </section>
    </>
  );
}
