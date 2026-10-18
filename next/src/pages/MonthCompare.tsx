import { useState } from 'preact/hooks';
import { HEADINGS, compareReports, reportsByDate } from '../domain/calc';
import type { Project, ReportingPeriod } from '../domain/types';
import { full, month, pct, short } from '../ui/format';
import { burn } from '../domain/burn';
import { TODAY } from '../today';
import { base, Chart, type Tokens } from '../ui/Chart';
import { money, parseDate } from '../domain/calc';
import { download } from '../ui/xlsxwrite';

const H = ['1', '2', '3', '4', '5', '6', '10'];
const head = (code: string) => code.split('.')[0];
const at = (p: Project, m: string) => reportsByDate(p).filter((r) => r.snapshot?.lines?.length && r.date.slice(0, 7) <= m).at(-1);

/** Portfolio month-against-month: for each project the report on file at each month, spend added per heading and line. */
export function MonthCompare({ projects }: { projects: Project[] }) {
  const months = [...new Set(projects.flatMap((p) => reportsByDate(p).filter((r) => r.snapshot?.lines?.length).map((r) => r.date.slice(0, 7))))].sort();
  const [a, setA] = useState(months.at(-2) ?? months[0] ?? '');
  const [b, setB] = useState(months.at(-1) ?? '');
  const [open, setOpen] = useState('');
  if (months.length < 2) return <section class="card"><div class="card-h"><div><h2>Month comparison</h2><p>Needs reports from at least two different months.</p></div></div></section>;
  const rows = projects.map((p) => {
    const A = at(p, a), B = at(p, b);
    if (!B || A?.id === B.id) return null;
    const D = compareReports(A ?? ({ snapshot: { lines: [] } } as unknown as ReportingPeriod), B);
    const by: Record<string, number> = {}, byC: Record<string, number> = {}, byB: Record<string, number> = {};
    for (const d of D) { const h = head(d.code); by[h] = (by[h] ?? 0) + d.actual[1] - d.actual[0]; byC[h] = (byC[h] ?? 0) + (d.exposure[1] - d.actual[1]) - (d.exposure[0] - d.actual[0]); byB[h] = (byB[h] ?? 0) + d.approved[1] - d.approved[0]; }
    const spent = Object.values(by).reduce((s, v) => s + v, 0), committed = Object.values(byC).reduce((s, v) => s + v, 0), budget = A ? Object.values(byB).reduce((s, v) => s + v, 0) : 0; // first report: its budget is not a change
    return { p, A, B, D: D.filter((d) => d.status !== 'same'), by, spent, committed, budget };
  }).filter(Boolean) as { p: Project; A?: ReportingPeriod; B: ReportingPeriod; D: ReturnType<typeof compareReports>; by: Record<string, number>; spent: number; committed: number; budget: number }[];
  rows.sort((x, y) => y.spent - x.spent);
  const max = Math.max(1, ...rows.flatMap((r) => Object.values(r.by).map(Math.abs)));
  const tot = (h: string) => rows.reduce((s, r) => s + (r.by[h] ?? 0), 0);
  const lab = (p: Project) => (p.bh ? `BH ${p.bh}` : p.code);
  const cell = (v: number) => { const x = Math.min(1, Math.abs(v) / max); return { background: v > 0.5 ? `color-mix(in srgb,var(--c1) ${Math.round(8 + x * 50)}%,var(--surface))` : v < -0.5 ? `color-mix(in srgb,var(--critical) ${Math.round(8 + x * 45)}%,var(--surface))` : undefined }; };
  const xlsx = () => download(`month-comparison-${a}-${b}.xlsx`, [{ name: `${a} vs ${b}`, money: [3, 4, 5, ...H.map((_, i) => 6 + i)], rows: [
    ['Project', 'Report A', 'Report B', 'Spent added', 'Commitments change', 'Budget change', ...H.map((h) => `${h} ${HEADINGS[h] ?? ''}`)],
    ...rows.map((r) => [lab(r.p), r.A?.date ?? '', r.B.date, r.spent, r.committed, r.budget, ...H.map((h) => Math.round(r.by[h] ?? 0))])] }]);
  return (
    <section class="card" style={{ marginTop: '16px' }}>
      <div class="card-h" style={{ alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}><div><h2>Month comparison</h2><p>Spend added between the reports on file at each month, by budget heading · click a project for its lines</p></div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center' }}>
          <select class="select" value={a} onChange={(e) => setA((e.target as HTMLSelectElement).value)} aria-label="From month">{months.map((m) => <option value={m}>{month(m + '-01')}</option>)}</select><span class="muted">→</span>
          <select class="select" value={b} onChange={(e) => setB((e.target as HTMLSelectElement).value)} aria-label="To month">{months.map((m) => <option value={m}>{month(m + '-01')}</option>)}</select>
          <button class="btn" onClick={xlsx}>⤓ Excel</button></div></div>
      <div class="card-b table-scroll">
        {a >= b ? <p class="muted">Choose a later “to” month.</p> : <table class="mini mc-t">
          <thead><tr><th>Project</th><th class="r">Spent added</th><th class="r">Commit. Δ</th><th class="r">Budget Δ</th>{H.map((h) => <th class="r" title={HEADINGS[h]}>{h}. {(HEADINGS[h] ?? '').split(' ')[0]}</th>)}</tr></thead>
          <tbody>{rows.map((r) => <>
            <tr class="click" onClick={() => setOpen(open === r.p.id ? '' : r.p.id)}>
              <td><span class="muted">{open === r.p.id ? '▾' : '▸'}</span> <b>{lab(r.p)}</b><small class="muted" style={{ display: 'block' }}>{r.A ? `${month(r.A.date)} → ${month(r.B.date)}` : `first report ${month(r.B.date)}`}</small></td>
              <td class="r num"><b>{short(r.spent)}</b></td><td class="r num">{short(r.committed)}</td><td class="r num" style={{ color: Math.abs(r.budget) > 1 ? 'var(--warn)' : 'var(--ink-3)' }}>{Math.abs(r.budget) > 1 ? short(r.budget) : '—'}</td>
              {H.map((h) => <td class="r num" style={cell(r.by[h] ?? 0)}>{Math.abs(r.by[h] ?? 0) > 0.5 ? short(r.by[h]) : ''}</td>)}</tr>
            {open === r.p.id && <tr class="mc-d"><td colSpan={4 + H.length}><BurnPanel p={r.p} from={r.A ? Date.parse(r.A.date) : null} to={Date.parse(r.B.date)} /><table class="mini"><thead><tr><th>Line</th><th>Description</th><th class="r">Spent A</th><th class="r">Spent B</th><th class="r">Δ spent</th><th class="r">Δ approved</th></tr></thead>
              <tbody>{r.D.sort((x, y) => Math.abs(y.actual[1] - y.actual[0]) - Math.abs(x.actual[1] - x.actual[0])).map((d) => <tr><td class="num">{d.code}</td><td>{d.description}{r.A && d.status !== 'changed' && <span class="badge neutral" style={{ marginLeft: '6px' }}>{d.status === 'added' ? 'new line' : 'removed'}</span>}</td><td class="r num">{full(d.actual[0])}</td><td class="r num">{full(d.actual[1])}</td><td class="r num"><b style={{ color: d.actual[1] - d.actual[0] < 0 ? 'var(--critical)' : undefined }}>{full(d.actual[1] - d.actual[0])}</b></td><td class="r num" style={{ color: d.approved[1] !== d.approved[0] ? 'var(--warn)' : 'var(--ink-3)' }}>{d.approved[1] !== d.approved[0] ? full(d.approved[1] - d.approved[0]) : '—'}</td></tr>)}</tbody></table></td></tr>}
          </>)}</tbody>
          <tfoot><tr><td>Total · {rows.length} projects</td><td class="r num">{short(rows.reduce((s, r) => s + r.spent, 0))}</td><td class="r num">{short(rows.reduce((s, r) => s + r.committed, 0))}</td><td class="r num">{short(rows.reduce((s, r) => s + r.budget, 0))}</td>{H.map((h) => <td class="r num">{Math.abs(tot(h)) > 0.5 ? short(tot(h)) : ''}</td>)}</tr></tfoot>
        </table>}
        {a < b && !rows.length && <p class="muted">No project has a different report between these months.</p>}
      </div>
    </section>
  );
}

/** Burn analysis for one project between two reports: rate, acceleration, plan and the pace needed, with the spending curve. */
function BurnPanel({ p, from, to }: { p: Project; from: number | null; to: number }) {
  const X = burn(p, from, to, TODAY);
  const tone = (v: number, ref: number) => (v >= ref * 0.9 ? 'good' : v >= ref * 0.7 ? 'warn' : 'bad');
  return (
    <div class="bp">
      <div class="bp-k">
        <div class={tone(X.rate, X.planRate)}><span>Spend per month in this period</span><b class="num">{short(X.rate)}</b><small>{X.planRate ? pct(X.rate / X.planRate) : ''} of the even pace ({short(X.planRate)}/month)</small></div>
        <div class={X.accel == null ? '' : X.accel >= 0 ? 'good' : 'bad'}><span>Change vs previous period</span><b class="num">{X.accel == null ? '—' : `${X.accel >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(X.accel * 100))}%`}</b><small>{X.prevRate != null ? `before: ${short(X.prevRate)}/month` : 'no earlier period'}</small></div>
        <div><span>Needed to use the budget</span><b class="num">{short(X.needRate)}</b><small>per month for {X.monthsLeft.toFixed(1)} months{X.rate ? ` · ${(X.needRate / X.rate).toFixed(1)}× this pace` : ''}</small></div>
        <div class={X.projectedUse >= 0.95 && X.projectedUse <= 1.02 ? 'good' : X.projectedUse > 1.02 ? 'bad' : X.projectedUse >= 0.85 ? 'warn' : 'bad'}><span>At this pace by the end</span><b class="num">{pct(X.projectedUse)}</b><small>{short(X.projectedEnd)} of {short(money(p).budget)}</small></div>
      </div>
      <Chart height={220} label="Spending curve" option={(t) => curveOption(t, p, X, from, to)} />
    </div>
  );
}

function curveOption(t: Tokens, p: Project, X: ReturnType<typeof burn>, from: number | null, to: number) {
  const s = parseDate(p.start).getTime(), e = parseDate(p.end).getTime(), B = money(p).budget, last = X.curve.at(-1)!;
  const proj = [[last.t, last.v], [e, X.projectedEnd]];
  return {
    ...base(t), grid: { left: 8, right: 56, top: 26, bottom: 8, containLabel: true },
    legend: { top: 0, left: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10, textStyle: { color: t.ink2, fontSize: 11.5 } },
    tooltip: { ...(base(t).tooltip as object), trigger: 'axis', valueFormatter: (v: number) => full(v) },
    xAxis: { type: 'time', min: s, max: e, axisLabel: { color: t.ink3, fontSize: 11, formatter: (v: number) => month(v) }, axisLine: { lineStyle: { color: t.line } } },
    yAxis: [{ type: 'value', max: Math.max(B, X.projectedEnd), axisLabel: { color: t.ink3, fontSize: 11, formatter: (v: number) => short(v) }, splitLine: { lineStyle: { color: t.line } } },
      { type: 'value', axisLabel: { color: t.ink3, fontSize: 11, formatter: (v: number) => short(v) }, splitLine: { show: false } }],
    series: [
      { name: 'Plan', type: 'line', data: [[s, 0], [e, B]], symbol: 'none', lineStyle: { color: t.plan, type: 'dashed', width: 1.5 }, itemStyle: { color: t.plan } },
      { name: 'Actual', type: 'line', data: X.curve.map((x) => [x.t, x.v]), symbol: 'circle', symbolSize: 6, lineStyle: { color: t.c[0], width: 2.5 }, itemStyle: { color: t.c[0] },
        markArea: { silent: true, itemStyle: { color: t.c[0], opacity: 0.08 }, data: [[{ xAxis: from ?? s }, { xAxis: to }]] } },
      { name: 'At this pace', type: 'line', data: proj, symbol: 'none', lineStyle: { color: t.c[1], type: [6, 4], width: 2 }, itemStyle: { color: t.c[1] } },
      { name: 'Spend per month', type: 'bar', yAxisIndex: 1, barWidth: 10, data: X.intervals.map((i) => [i.to, Math.round(i.rate)]), itemStyle: { color: t.c[2], opacity: 0.55, borderRadius: [3, 3, 0, 0] } },
    ],
  };
}
