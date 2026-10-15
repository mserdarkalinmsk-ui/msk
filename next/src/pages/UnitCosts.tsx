import { useState } from 'preact/hooks';
import { filtered, go, useStore } from '../data/store';
import { unitCosts, type UnitGroup, type UnitPoint } from '../domain/unitcost';
import { TODAY } from '../today';
import { full, short } from '../ui/format';
import { download } from '../ui/xlsxwrite';

const lab = (x: UnitPoint) => (x.p.bh ? `BH ${x.p.bh}` : x.p.code);
const pctS = (v: number | null) => (v == null ? '—' : `${v >= 0 ? '+' : '−'}${Math.abs(Math.round(v * 100))}%`);
const tone = (v: number | null, lim: number) => (v == null ? '' : v > lim ? 'bad' : v < -lim ? 'low' : 'ok');
const COL = ['#3b82c4', '#e5484d', '#30a46c', '#f5a524', '#8e4ec6', '#0e9384', '#c2410c', '#64748b'];

/** One group as a strip: each project's budget rate (ring) and actual rate (dot) on a shared scale, median marked. */
function Strip({ g, color }: { g: UnitGroup; color: (id: string) => string }) {
  const lo = g.min * 0.9, hi = g.max * 1.1, X = (v: number) => `${((v - lo) / Math.max(1e-9, hi - lo)) * 100}%`;
  return (
    <div class="uc-strip">
      <div class="uc-axis"><span>{short(lo)}</span><span>{short(hi)}</span></div>
      <div class="uc-track">
        {g.comparable && <i class="uc-med" style={{ left: X(g.median) }} title={`median ${full(g.median)}`}><b>median {short(g.median)}</b></i>}
        {g.points.map((x) => <>
          {x.budgetRate && x.actualRate && <span class="uc-link" style={{ left: X(Math.min(x.budgetRate, x.actualRate)), width: `calc(${X(Math.max(x.budgetRate, x.actualRate))} - ${X(Math.min(x.budgetRate, x.actualRate))})`, background: color(x.p.id) }} />}
          {x.budgetRate && <span class="uc-dot ring" style={{ left: X(x.budgetRate), borderColor: color(x.p.id) }} title={`${lab(x)} budget ${full(x.budgetRate)}`} />}
          {x.actualRate && <span class="uc-dot" style={{ left: X(x.actualRate), background: color(x.p.id) }} title={`${lab(x)} actual ${full(x.actualRate)}`} />}
        </>)}
      </div>
    </div>
  );
}

export function UnitCosts() {
  const s = useStore((x) => x);
  const P = filtered(s);
  const G = unitCosts(P);
  const [only, setOnly] = useState(false);
  const [h, setH] = useState('');
  const heads = [...new Set(G.map((g) => g.heading))].sort((a, b) => parseInt(a) - parseInt(b));
  const shown = G.filter((g) => (!only || g.flags) && (!h || g.heading === h));
  const ids = [...new Set(G.flatMap((g) => g.points.map((x) => x.p.id)))];
  const color = (id: string) => COL[ids.indexOf(id) % COL.length];
  const over = G.flatMap((g) => g.points).filter((x) => (x.vsBudget ?? 0) > 0.15);
  const aboveMed = G.flatMap((g) => g.points).filter((x) => (x.vsMedian ?? 0) > 0.25);
  const xlsx = () => download(`unit-costs-${TODAY.toISOString().slice(0, 10)}.xlsx`, [{ name: 'Unit costs', money: [4, 5, 7], rows: [
    ['Heading', 'Line', 'Unit', 'Project', 'Budget rate', 'Actual rate', 'Actual vs budget', 'Portfolio median', 'vs median'],
    ...G.flatMap((g) => g.points.map((x) => [g.heading, g.label, g.unit, lab(x), x.budgetRate ?? '', x.actualRate ?? '', pctS(x.vsBudget), g.comparable ? Math.round(g.median) : '', pctS(x.vsMedian)]))] }]);
  if (!G.length) return <div class="card empty-page"><div><h2>No unit rates yet</h2><p>Unit costs come from report workbooks (units × rate columns) and approved budgets with units.</p></div></div>;
  return (
    <>
      <section class="hero" aria-label="Unit costs">
        <div class="kpi lead"><span class="label">Unit costs compared</span><span class="value">{G.length}</span><span class="ctx">budget lines with a unit rate across {ids.length} projects · {G.filter((g) => g.points.length > 1).length} shared by several projects</span></div>
        <div class="kpi"><span class="label">Actual above budget rate</span><span class="value" style={{ color: over.length ? '#e5484d' : undefined }}>{over.length}</span><span class="ctx">lines where the real unit cost is more than 15% over the budgeted rate</span></div>
        <div class="kpi"><span class="label">Above portfolio median</span><span class="value" style={{ color: aboveMed.length ? '#c27c0e' : undefined }}>{aboveMed.length}</span><span class="ctx">more than 25% above what other projects pay</span></div>
      </section>
      <section class="card" style={{ marginTop: '16px' }}>
        <div class="card-h" style={{ alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}><div><h2>Unit cost benchmark</h2><p>○ budget rate · ● actual rate · line joins a project's two rates · black tick = portfolio median</p></div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <select class="select" value={h} onChange={(e) => setH((e.target as HTMLSelectElement).value)} aria-label="Heading"><option value="">All headings</option>{heads.map((x) => <option>{x}</option>)}</select>
            <div class="seg"><button aria-pressed={!only} onClick={() => setOnly(false)}>All</button><button aria-pressed={only} onClick={() => setOnly(true)}>Outliers ({G.filter((g) => g.flags).length})</button></div>
            <button class="btn" onClick={xlsx}>⤓ Excel</button></div></div>
        <div class="uc-leg">{ids.map((id) => { const p = P.find((x) => x.id === id)!; return <span><i style={{ background: color(id) }} />{p.bh ? `BH ${p.bh}` : p.code}</span>; })}</div>
        <div class="card-b uc-list">{shown.map((g) => (
          <article class={`uc-g${g.flags ? ' flag' : ''}`}>
            <header><div><b>{g.label}</b><small class="muted"> · per {g.unit || 'unit'} · {g.heading}</small>{g.points.length > 1 && !g.comparable && <small class="uc-nc">items differ between projects — not compared</small>}</div>{g.flags > 0 && <span class="badge warning">{g.flags} to check</span>}</header>
            <Strip g={g} color={color} />
            <table class="mini uc-t"><thead><tr><th>Project</th><th class="r">Budget rate</th><th class="r">Actual rate</th><th class="r">Actual vs budget</th><th class="r">vs median</th></tr></thead>
              <tbody>{g.points.map((x) => <tr class="click" onClick={() => go(`project/${x.p.id}`)}><td><i class="uc-sw" style={{ background: color(x.p.id) }} /><b>{lab(x)}</b></td><td class="r num">{x.budgetRate ? full(x.budgetRate) : '—'}</td><td class="r num">{x.actualRate ? full(x.actualRate) : '—'}</td>
                <td class={`r num uc-${tone(x.vsBudget, 0.15)}`}>{pctS(x.vsBudget)}</td><td class={`r num uc-${tone(x.vsMedian, 0.25)}`}>{pctS(x.vsMedian)}</td></tr>)}</tbody></table>
          </article>))}
          {!shown.length && <p class="muted">Nothing to show with these filters.</p>}
        </div>
        <p class="muted" style={{ fontSize: '11.5px', padding: '0 20px 16px' }}>Budget rate = approved amount ÷ budgeted units; actual rate = reported cost ÷ reported units, from each project's latest report. Lines are matched by their template number and unit, so a project manager month is compared with other project manager months. Flags: actual rate more than 15% over the budget rate, or more than 25% above the portfolio median.</p>
      </section>
    </>
  );
}
