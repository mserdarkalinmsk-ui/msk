import { Ico } from '../ui/Ico';
import { filtered, go, useStore } from '../data/store';
import { capacity, endOf, gapDrivers, HEAD_LABEL, portfolioWalk, trendOf, type CapacityVerdict } from '../domain/analysis';
import { asOf, elapsed, money } from '../domain/calc';
import { plabel } from '../domain/label';
import type { Project } from '../domain/types';
import { unitCosts } from '../domain/unitcost';
import { TODAY } from '../today';
import { date, full, pct, short } from '../ui/format';
import { BAND_COLOR, bandOf, Bullet, Diverge, Spark } from '../ui/viz';
import { download } from '../ui/xlsxwrite';
import { openPOs } from './Commitments';

export const VERDICT: Record<CapacityVerdict, { word: string; badge: string; why: string }> = {
  'too early': { word: 'Just started', badge: 'neutral', why: 'nothing spent yet in the first tenth of its time: no pace to judge' },
  done: { word: 'Fully spent', badge: 'neutral', why: 'nothing left to spend' },
  'on pace': { word: 'On pace', badge: 'good', why: 'the pace so far is enough' },
  'reached before': { word: 'Reached before', badge: 'info', why: 'faster than the average, but the project has spent this fast before' },
  stretch: { word: 'Stretch', badge: 'warning', why: 'up to 1.5 × the best pace the project ever reached' },
  'out of reach': { word: 'Out of reach', badge: 'critical', why: 'more than 1.5 × the best pace ever reached: plan a revision or an extension' },
};
const AGE = [{ max: 90, label: 'Up to 3 months' }, { max: 180, label: '3–6 months' }, { max: 365, label: '6–12 months' }, { max: Infinity, label: 'Over a year' }];
const lab = (p: Project) => plabel(p);
const sgn = (v: number) => `${v >= 0 ? '+' : '−'}${short(Math.abs(v))}`;
const pts = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(Math.round(v * 100))} pts`;

/** The figures behind the story, project by project: why behind, whether the rest can be spent, how it moves. */
export function Analysis() {
  const s = useStore((x) => x);
  const P = filtered(s).filter((p) => !p.datesTbc && money(p).budget > 0);
  const rows = P.map((p) => ({ p, g: gapDrivers(p, TODAY), c: capacity(p, TODAY), t: trendOf(p), e: endOf(p, TODAY), el: elapsed(p, asOf(p, TODAY)) }))
    .sort((a, b) => a.g.gap - b.g.gap);
  if (!rows.length) return <div class="card empty-page"><div><h2>No projects with a budget</h2><p>Import a financial report first.</p></div></div>;
  const heads = [...new Set(rows.flatMap((r) => r.g.drivers.map((d) => d.heading)))].sort();
  const scale = Math.max(1, ...rows.flatMap((r) => r.g.drivers.map((d) => Math.abs(d.gap))));
  const W = portfolioWalk(P, TODAY);
  const behind = rows.filter((r) => r.g.gap < -0.5 && !r.c.early), gapT = W.gap, unspent = rows.reduce((a, r) => a + r.e.unspent, 0);
  const hard = rows.filter((r) => r.c.verdict === 'out of reach' || r.c.verdict === 'stretch'), worse = rows.filter((r) => r.t.worsening);
  // Heading that carries most of the portfolio shortfall.
  const U = unitCosts(P).filter((g) => g.comparable).flatMap((g) => g.points.filter((x) => (x.actualRate ?? 0) > 0 && g.median > 0 && x.actualRate! / g.median - 1 > 0.25).map((x) => ({ g, x }))).sort((a, b) => b.x.actualRate! / b.g.median - a.x.actualRate! / a.g.median).slice(0, 8);
  const O = openPOs(P).filter((x) => !x.staff), oT = O.reduce((a, x) => a + x.balance, 0);
  const ages = AGE.map((b, i) => { const X = O.filter((x) => x.age <= b.max && (i === 0 || x.age > AGE[i - 1].max)); return { ...b, n: X.length, v: X.reduce((a, x) => a + x.balance, 0) }; });
  const ageMax = Math.max(1, ...ages.map((a) => a.v));
  const xlsx = () => download(`analysis-${TODAY.toISOString().slice(0, 10)}.xlsx`, [
    { name: 'Why behind', money: [2, 3, 4, ...heads.map((_, i) => 5 + i)], rows: [['Project', 'Name', 'Planned to date', 'Spent', 'Gap', ...heads.map((h) => `${h} ${HEAD_LABEL[h] ?? ''}`)].map((v) => ({ v, st: 'head' as const })),
      ...rows.map((r) => [lab(r.p), r.p.name, r.g.planned, r.g.spent, r.g.gap, ...heads.map((h) => r.g.drivers.find((d) => d.heading === h)?.gap ?? '')])] },
    { name: 'Can it be spent', money: [2, 4, 5, 6, 8], rows: [['Project', 'Name', 'Left to spend', 'Months left', 'Needed / month', 'Average / month', 'Best / month', 'Best period', 'Unspent at this pace', 'Verdict'].map((v) => ({ v, st: 'head' as const })),
      ...rows.map((r) => [lab(r.p), r.p.name, r.c.remaining, Math.round(r.c.monthsLeft * 10) / 10, isFinite(r.c.need) ? r.c.need : '', r.c.avg, r.c.best, r.c.bestFrom ? `${r.c.bestFrom} → ${r.c.bestTo}` : 'average', r.c.unspent, VERDICT[r.c.verdict].word])] },
    { name: 'Trend', rows: [['Project', 'Report', 'Spent vs plan', 'Staff share'].map((v) => ({ v, st: 'head' as const })), ...rows.flatMap((r) => r.t.points.map((x) => [lab(r.p), x.date, Math.round(x.perf * 1000) / 10 + '%', x.staff == null ? '' : Math.round(x.staff * 1000) / 10 + '%']))] },
  ]);
  return (
    <div class="an">
      <section class="hero" aria-label="Analysis">
        <div class="kpi lead"><span class="label">Gap to plan today</span><span class="value">{sgn(gapT)}</span><span class="ctx">direct costs · {behind.length} of {rows.filter((r) => !r.c.early).length} projects behind{W.lead ? ` · ${pct(W.lead.share)} of the headings' shortfall is ${(HEAD_LABEL[W.lead.heading] ?? W.lead.label).toLowerCase()}` : ''}</span></div>
        <div class="kpi"><span class="label">Unspent at the end, at this pace</span><span class="value" style={{ color: unspent > 0.5 ? 'var(--critical)' : undefined }}>{short(unspent)}</span><span class="ctx">{pct(rows.reduce((a, r) => a + r.e.budget, 0) ? unspent / rows.reduce((a, r) => a + r.e.budget, 0) : 0)} of the budgets</span></div>
        <div class="kpi"><span class="label">Pace needed is a stretch</span><span class="value" style={{ color: hard.length ? 'var(--warn)' : undefined }}>{hard.length}</span><span class="ctx">{hard.filter((r) => r.c.verdict === 'out of reach').length} out of reach</span></div>
        <div class="kpi"><span class="label">Getting worse</span><span class="value" style={{ color: worse.length ? 'var(--warn)' : undefined }}>{worse.length}</span><span class="ctx">since the previous report</span></div>
      </section>

      <section class="card">
        <div class="card-h"><div><h2>Why behind plan — heading by heading</h2><p>Spent against budget × time elapsed for each heading; red to the left = behind, blue to the right = ahead · all bars on one scale ({short(scale)} = full half)</p></div><button class="btn" style={{ marginLeft: 'auto' }} onClick={xlsx}><Ico n="download" />Excel</button></div>
        <div class="card-b table-scroll"><table class="mini an-t">
          <thead><tr><th>Project</th><th class="r">Planned to date</th><th class="r">Spent</th><th class="r">Gap</th>{heads.map((h) => <th class="c">{h} {HEAD_LABEL[h] ?? ''}</th>)}</tr></thead>
          <tbody>{rows.map((r) => <tr class="click" onClick={() => go(`project/${r.p.id}/statement`)}>
            <td><b class="num">{lab(r.p)}</b> <span class="muted an-n">{r.p.name}</span></td>
            <td class="r num">{full(r.g.planned)}</td><td class="r num">{full(r.g.spent)}</td>
            <td class="r num" style={{ color: r.g.gap < 0 ? 'var(--critical)' : 'var(--c1)', fontWeight: 600 }}>{sgn(r.g.gap)}</td>
            {heads.map((h) => { const d = r.g.drivers.find((x) => x.heading === h); return <td class="an-c" title={d ? `${HEAD_LABEL[h]}: planned ${full(d.planned)}, spent ${full(d.spent)}, ${d.gap < 0 ? `${full(-d.gap)} behind (${pct(d.share)} of the project's shortfall)` : `${full(d.gap)} ahead`}` : 'no budget'}>{d ? <><Diverge value={d.gap} scale={scale} /><small class="num">{sgn(d.gap)}</small></> : <span class="muted">—</span>}</td>; })}
          </tr>)}</tbody>
        </table></div>
      </section>

      <section class="card">
        <div class="card-h"><div><h2>Can the rest be spent by the end date?</h2><p>Bar = average monthly pace, light = the best pace reached between two reports, black tick = pace needed from now · tick beyond the light part = never reached so far</p></div></div>
        <div class="card-b table-scroll"><table class="mini an-t">
          <thead><tr><th>Project</th><th class="r">Left to spend</th><th class="r">Months left</th><th class="r">Needed / month</th><th class="r">Average</th><th class="r">Best</th><th style={{ minWidth: '180px' }}>Pace</th><th>Verdict</th><th class="r">Unspent at this pace</th></tr></thead>
          <tbody>{[...rows].sort((a, b) => (b.c.ratio === Infinity ? 1e9 : b.c.ratio) - (a.c.ratio === Infinity ? 1e9 : a.c.ratio)).map((r) => { const mx = Math.max(r.c.best, isFinite(r.c.need) ? r.c.need : 0, r.c.avg) * 1.08; const V = VERDICT[r.c.verdict]; return <tr class="click" onClick={() => go(`project/${r.p.id}/summary`)}>
            <td><b class="num">{lab(r.p)}</b> <span class="muted an-n">{r.p.name}</span></td>
            <td class="r num">{full(r.c.remaining)}</td><td class="r num">{r.c.monthsLeft.toFixed(1)}</td>
            <td class="r num"><b>{isFinite(r.c.need) ? full(r.c.need) : '—'}</b></td><td class="r num">{full(r.c.avg)}</td>
            <td class="r num" title={r.c.bestFrom ? `${date(r.c.bestFrom)} → ${date(r.c.bestTo!)}` : 'no faster period than the average'}>{full(r.c.best)}</td>
            <td><Bullet value={r.c.avg} extra={Math.max(0, r.c.best - r.c.avg)} target={isFinite(r.c.need) ? r.c.need : mx} max={mx} color={BAND_COLOR[r.c.verdict === 'out of reach' ? 'red' : r.c.verdict === 'stretch' ? 'amber' : r.c.verdict === 'reached before' ? 'blue' : 'green']} label={`needed ${short(r.c.need)}, average ${short(r.c.avg)}, best ${short(r.c.best)}`} /></td>
            <td><span class={`badge ${V.badge}`} title={V.why}>{V.word}</span></td>
            <td class="r num" style={{ color: r.e.unspent > 0.5 ? 'var(--critical)' : undefined }}>{r.e.unspent > 0.5 ? full(r.e.unspent) : '—'}</td>
          </tr>; })}</tbody>
        </table></div>
      </section>

      <section class="card">
        <div class="card-h"><div><h2>How it moves, report by report</h2><p>Spent against plan (dashed line = 100%) and the staff share of spending at every financial report · getting worse = 3 points down on plan or 5 points up on staff since the previous report</p></div></div>
        <div class="card-b table-scroll"><table class="mini an-t">
          <thead><tr><th>Project</th><th>Spent vs plan</th><th class="r">Now</th><th class="r">Change</th><th>Staff share</th><th class="r">Now</th><th class="r">Change</th><th /></tr></thead>
          <tbody>{[...rows].sort((a, b) => Number(b.t.worsening) - Number(a.t.worsening) || (a.t.dPerf ?? 0) - (b.t.dPerf ?? 0)).map((r) => { const last = r.t.points.at(-1); return <tr class="click" onClick={() => go(`project/${r.p.id}/diff`)}>
            <td><b class="num">{lab(r.p)}</b> <span class="muted an-n">{r.p.name}</span></td>
            <td><Spark values={r.t.points.map((x) => x.perf)} ref1={1} min={0} color={last ? BAND_COLOR[bandOf(last.perf)] : undefined} label="spent against plan by report" /></td>
            <td class="r num" style={{ color: last ? BAND_COLOR[bandOf(last.perf)] : undefined, fontWeight: 600 }}>{last ? pct(last.perf) : '—'}</td>
            <td class="r num" style={{ color: r.t.dPerf == null ? undefined : r.t.dPerf < -0.005 ? 'var(--critical)' : r.t.dPerf > 0.005 ? 'var(--good)' : undefined }}>{r.t.dPerf == null ? '—' : pts(r.t.dPerf)}</td>
            <td><Spark values={r.t.points.filter((x) => x.staff != null).map((x) => x.staff!)} min={0} max={1} color="var(--c7)" label="staff share by report" /></td>
            <td class="r num">{last?.staff != null ? pct(last.staff) : '—'}</td>
            <td class="r num" style={{ color: r.t.dStaff != null && r.t.dStaff > 0.05 ? 'var(--warn)' : undefined }}>{r.t.dStaff == null ? '—' : pts(r.t.dStaff)}</td>
            <td>{r.t.worsening && <span class="badge warning">getting worse</span>}</td>
          </tr>; })}</tbody>
        </table></div>
      </section>

      <div class="grid g-12">
        <section class="card span-7">
          <div class="card-h"><div><h2>Paid more than other projects</h2><p>Actual cost per unit more than 25% above the portfolio median for the same kind of line</p></div><button class="btn ghost" style={{ marginLeft: 'auto' }} onClick={() => go('reports/units')}>All unit costs ›</button></div>
          <div class="card-b">{U.length ? <table class="mini an-t"><thead><tr><th>Line</th><th>Project</th><th class="r">Paid / unit</th><th class="r">Median</th><th class="r">Above</th></tr></thead>
            <tbody>{U.map(({ g, x }) => <tr><td>{g.label} <span class="muted">· {g.unit}</span></td><td class="num">{lab(x.p)}</td><td class="r num">{full(x.actualRate ?? 0)}</td><td class="r num">{full(g.median)}</td><td class="r num" style={{ color: 'var(--warn)', fontWeight: 600 }}>+{Math.round((x.actualRate! / g.median - 1) * 100)}%</td></tr>)}</tbody></table>
            : <p class="muted">No unit cost more than 25% above what other projects pay for the same kind of line.</p>}</div>
        </section>
        <section class="card span-5">
          <div class="card-h"><div><h2>Open orders by age</h2><p>{O.length} open purchase orders (staff contracts left out) · {short(oT)} still to pay</p></div><button class="btn ghost" style={{ marginLeft: 'auto' }} onClick={() => go('reports/commit')}>All open orders ›</button></div>
          <div class="card-b"><ul class="an-age">{ages.map((a, i) => <li><span>{a.label}</span><Bullet value={a.v} max={ageMax} color={i >= 2 ? 'var(--warn)' : 'var(--c1)'} h={12} label={`${a.label}: ${short(a.v)}`} /><b class="num">{short(a.v)}</b><small class="muted">{a.n} order{a.n === 1 ? '' : 's'}</small></li>)}</ul>
            <p class="muted" style={{ fontSize: '12px', margin: '8px 0 0' }}>Orders open for more than six months: check that the service is still to come, otherwise close them so the money comes back to the line.</p></div>
        </section>
      </div>
    </div>
  );
}
