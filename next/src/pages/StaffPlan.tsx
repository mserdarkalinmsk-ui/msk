import type { Project } from '../domain/types';
import { staffPlan } from '../domain/staffplan';
import { TODAY } from '../today';
import { base, Chart, type Tokens } from '../ui/Chart';
import { date, full, month, short } from '../ui/format';

/** Project staff cost plan: monthly cost to the end date, signed vs renewals, against the free staff budget. */
export function StaffPlanCard({ p }: { p: Project }) {
  const S = staffPlan(p, TODAY);
  if (!S.people.length) return null;
  const ok = S.gap >= 0;
  return (
    <section class="card span-12">
      <div class="card-h"><div><h2>Staff cost plan to {date(S.end)}</h2><p>Monthly cost of current staff: under signed contracts, and what renewing everyone to the project end would need</p></div></div>
      <div class="card-b">
        <div class="sp-k">
          <div><span>Staff budget</span><b class="num">{short(S.hrBudget)}</b><small>lines 1.1.1 / 1.2.1</small></div>
          <div><span>Spent + committed</span><b class="num">{short(S.hrExposure)}</b><small>{S.hrBudget ? Math.round(S.hrExposure / S.hrBudget * 100) : 0}% used</small></div>
          <div><span>Free staff budget</span><b class="num">{short(S.hrFree)}</b></div>
          <div><span>Renewals to the end</span><b class="num">{short(S.renewalNeed)}</b><small>{S.people.filter((x) => x.renewal > 0).length} contracts end before the project</small></div>
          <div class={ok ? 'good' : 'bad'}><span>{ok ? 'Left after renewals' : 'Shortfall'}</span><b class="num">{short(Math.abs(S.gap))}</b><small>{ok ? 'can fund renewals' : 'renewals exceed the free budget'}</small></div>
        </div>
        <Chart height={240} label="Monthly staff cost" option={(t) => planOption(t, S.months)} />
        <div class="table-scroll"><table class="mini sp-t"><thead><tr><th>Name</th><th>Position</th><th>Contract</th><th class="r">Per month</th><th class="r">Still to pay (signed)</th><th class="r">Renewal to end</th><th class="r">Total to end</th></tr></thead>
          <tbody>{S.people.map((x) => <tr><td>{x.a.display}</td><td>{x.a.position}</td><td class="num" style={{ whiteSpace: 'nowrap' }}>{x.a.start ? date(x.a.start) : '—'} → {x.a.end ? date(x.a.end) : '—'}</td>
            <td class="r num" title={x.rateSource}>{x.rate ? full(x.rate) : <span class="muted">no rate</span>}</td><td class="r num">{full(x.signedLeft)}</td>
            <td class="r num" style={{ color: x.renewal ? 'var(--warn)' : undefined }}>{x.renewal ? full(x.renewal) : '—'}</td><td class="r num"><b>{full(x.toEnd)}</b></td></tr>)}</tbody>
          <tfoot><tr><td colSpan={3}>Total</td><td class="r num">{full(S.people.reduce((a, x) => a + x.rate, 0))}</td><td class="r num">{full(S.people.reduce((a, x) => a + x.signedLeft, 0))}</td><td class="r num">{full(S.renewalNeed)}</td><td class="r num">{full(S.people.reduce((a, x) => a + x.toEnd, 0))}</td></tr></tfoot></table></div>
        <p class="muted" style={{ fontSize: '11.5px' }}>Per month = value of the person's latest contract (spent + committed on its PO) ÷ its months; without one, the budget unit rate × FTE. Signed amounts are already in “spent + committed”; renewals are the new money needed.</p>
      </div>
    </section>
  );
}

function planOption(t: Tokens, M: { m: string; signed: number; renewal: number }[]) {
  return {
    ...base(t), grid: { left: 8, right: 16, top: 26, bottom: 8, containLabel: true },
    legend: { top: 0, left: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10, textStyle: { color: t.ink2, fontSize: 11.5 } },
    tooltip: { ...(base(t).tooltip as object), trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v: number) => full(v) },
    xAxis: { type: 'category', data: M.map((x) => month(x.m)), axisLabel: { color: t.ink3, fontSize: 11 }, axisLine: { lineStyle: { color: t.line } }, axisTick: { show: false } },
    yAxis: { type: 'value', axisLabel: { color: t.ink3, fontSize: 11, formatter: (v: number) => short(v) }, splitLine: { lineStyle: { color: t.line } } },
    series: [
      { name: 'Under signed contracts', type: 'bar', stack: 's', data: M.map((x) => Math.round(x.signed)), itemStyle: { color: t.c[0] }, barWidth: '60%' },
      { name: 'Renewals needed', type: 'bar', stack: 's', data: M.map((x) => Math.round(x.renewal)), itemStyle: { color: t.warn, borderRadius: [3, 3, 0, 0] } },
    ],
  };
}

/** Portfolio view: one row per project. */
export function StaffPlanTable({ projects }: { projects: Project[] }) {
  const R = projects.map((p) => ({ p, S: staffPlan(p, TODAY) })).filter((x) => x.S.people.length);
  if (!R.length) return null;
  return (
    <section class="card span-12">
      <div class="card-h"><div><h2>Staff cost plan by project</h2><p>Free staff budget against renewing current staff to each project's end date</p></div></div>
      <div class="card-b table-scroll"><table class="mini sp-t"><thead><tr><th>Project</th><th class="r">Staff</th><th class="r">Staff budget</th><th class="r">Spent + committed</th><th class="r">Free</th><th class="r">Renewals needed</th><th class="r">Left / shortfall</th><th>Ends</th></tr></thead>
        <tbody>{R.map(({ p, S }) => <tr><td><b>{p.bh ? `BH ${p.bh}` : p.code}</b> <span class="muted">{p.name.slice(0, 50)}</span></td><td class="r num">{S.people.length}</td><td class="r num">{short(S.hrBudget)}</td><td class="r num">{short(S.hrExposure)}</td><td class="r num">{short(S.hrFree)}</td><td class="r num">{short(S.renewalNeed)}</td>
          <td class="r num"><b style={{ color: S.gap < 0 ? 'var(--critical)' : 'var(--good)' }}>{S.gap < 0 ? '−' : '+'}{short(Math.abs(S.gap))}</b></td><td class="num">{date(S.end)}</td></tr>)}</tbody></table></div>
    </section>
  );
}
