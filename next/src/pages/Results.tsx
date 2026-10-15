import { useState } from 'preact/hooks';
import { filtered, go, useStore } from '../data/store';
import { tidy } from '../domain/logframe';
import { type IndState, resultRows } from '../domain/results';
import type { Project } from '../domain/types';
import { TODAY } from '../today';
import { date } from '../ui/format';
import { download } from '../ui/xlsxwrite';

const TONE: Record<IndState, string> = { reached: '#30a46c', 'on track': '#3b82c4', behind: '#f5a524', 'off track': '#e5484d', 'not measured': '#8b8d98', 'no target': '#8b8d98' };
const lab = (p: Project) => (p.bh ? `BH ${p.bh}` : p.code);
const pct = (v: number | null) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const openInd = (p: Project) => { go(`project/${p.id}`); setTimeout(() => dispatchEvent(new CustomEvent('pl-tab', { detail: 'Indicators' })), 60); };

/** Logframe results across the portfolio, read against money spent and time elapsed. */
export function Results() {
  const s = useStore((x) => x);
  const P = filtered(s);
  const { rows, inds } = resultRows(P, TODAY);
  const [show, setShow] = useState<'attention' | 'all' | 'unmeasured'>('attention');
  const measured = inds.filter((r) => r.prog != null), reached = inds.filter((r) => r.state === 'reached').length, off = inds.filter((r) => r.state === 'off track').length;
  const list = inds.filter((r) => (show === 'all' ? true : show === 'unmeasured' ? r.prog == null : r.state === 'behind' || r.state === 'off track' || (r.prog != null && r.stale)))
    .sort((a, b) => (a.prog ?? 9) - (b.prog ?? 9));
  const xlsx = () => download(`results-${TODAY.toISOString().slice(0, 10)}.xlsx`, [
    { name: 'By project', rows: [['Project', 'Indicators', 'Measured', 'Reached', 'Behind / off track', 'Time elapsed %', 'Spent+committed %', 'Results %', 'Gap (pp)', 'Flag'],
      ...rows.map((r) => [lab(r.p), r.n, r.measured, r.reached, r.behind, Math.round(r.time * 100), Math.round(r.spend * 100), r.results == null ? '' : Math.round(r.results * 100), r.gap == null ? '' : Math.round(r.gap * 100), r.flag ?? ''])] },
    { name: 'Indicators', rows: [['Project', 'Result', 'Indicator', 'Baseline', 'Target', 'Current', 'Progress %', 'Status', 'As of'],
      ...inds.map((r) => [lab(r.p), tidy(r.x.result), r.x.indicator, tidy(r.x.baseline), tidy(r.x.target), tidy(r.x.current), r.prog == null ? '' : Math.round(r.prog * 100), r.state, r.x.asOf ?? ''])] }]);
  if (!inds.length) return <div class="card empty-page"><div><h2>No indicators yet</h2><p>Add each project's Description of Action or logframe: indicators, baselines and targets are read from it. Record current values on the project's Indicators tab.</p></div></div>;
  return (
    <>
      <section class="hero" aria-label="Results">
        <div class="kpi lead"><span class="label">Indicators measured</span><span class="value">{measured.length}<small style={{ fontSize: '18px' }} class="muted"> / {inds.length}</small></span><span class="ctx">{inds.length - measured.length} without a current value · {rows.filter((r) => r.n).length} projects with a logframe</span></div>
        <div class="kpi"><span class="label">Targets reached</span><span class="value" style={{ color: '#30a46c' }}>{reached}</span><span class="ctx">{measured.length ? Math.round(reached / measured.length * 100) : 0}% of measured</span></div>
        <div class="kpi"><span class="label">Off track</span><span class="value" style={{ color: off ? '#e5484d' : undefined }}>{off}</span><span class="ctx">far behind the time elapsed</span></div>
        <div class="kpi"><span class="label">Spending ahead of results</span><span class="value">{rows.filter((r) => r.flag === 'spending ahead of results').length}</span><span class="ctx">projects where spend runs 25 pp+ ahead</span></div>
      </section>
      <div class="grid g-12" style={{ marginTop: '16px' }}>
        <section class="card span-12"><div class="card-h" style={{ alignItems: 'center' }}><div><h2>Time, money and results by project</h2><p>Results = average progress of measured indicators (baseline → target) · flagged first · click to open the indicators</p></div><button class="btn" style={{ marginLeft: 'auto' }} onClick={xlsx}>⤓ Excel</button></div>
          <div class="card-b table-scroll"><table class="mini rs-t"><thead><tr><th>Project</th><th style={{ width: '38%' }}>Time · spent + committed · results</th><th class="r">Gap</th><th class="r">Indicators</th><th class="r">Reached</th><th class="r">Behind</th><th>Attention</th></tr></thead>
            <tbody>{rows.map((r) => <tr class="click" onClick={() => openInd(r.p)}>
              <td><b>{lab(r.p)}</b><small class="muted" style={{ display: 'block', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.p.name}</small></td>
              <td><div class="rs-bars">
                <span><i>Time</i><em><b style={{ width: `${r.time * 100}%`, background: '#8b8d98' }} /></em><small class="num">{pct(r.time)}</small></span>
                <span><i>Money</i><em><b style={{ width: `${Math.min(1, r.spend) * 100}%`, background: '#3b82c4' }} /></em><small class="num">{pct(r.spend)}</small></span>
                <span><i>Results</i><em><b style={{ width: `${(r.results ?? 0) * 100}%`, background: '#30a46c' }} /></em><small class="num">{pct(r.results)}</small></span></div></td>
              <td class="r num" style={{ color: r.gap != null && r.gap > 0.25 ? '#e5484d' : undefined }}>{r.gap == null ? '—' : `${r.gap > 0 ? '+' : ''}${Math.round(r.gap * 100)} pp`}</td>
              <td class="r num">{r.measured}/{r.n}</td><td class="r num">{r.reached}</td><td class="r num">{r.behind}</td>
              <td>{r.flag && <span class="badge warning">{r.flag}</span>}{r.stale > 0 && <span class="badge neutral" style={{ marginLeft: '4px' }}>{r.stale} not updated 6 m+</span>}</td></tr>)}</tbody></table>
            <p class="muted" style={{ fontSize: '12px', margin: '8px 0 0' }}>Gap = spent + committed share minus results share. An indicator is “behind” when its progress trails the time elapsed by 15 pp+, “off track” at 35 pp+ (or nothing achieved past mid-term).</p></div></section>
        <section class="card span-12"><div class="card-h" style={{ alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}><div><h2>Indicators</h2><p>{list.length} shown · click to update the current value on the project</p></div>
          <div class="seg" style={{ marginLeft: 'auto' }}><button aria-pressed={show === 'attention'} onClick={() => setShow('attention')}>Needs attention</button><button aria-pressed={show === 'unmeasured'} onClick={() => setShow('unmeasured')}>Not measured</button><button aria-pressed={show === 'all'} onClick={() => setShow('all')}>All</button></div></div>
          <div class="card-b table-scroll"><table class="mini"><thead><tr><th>Project</th><th>Indicator</th><th>Baseline</th><th>Target</th><th>Now</th><th style={{ width: '140px' }}>Progress</th><th>Status</th><th>As of</th></tr></thead>
            <tbody>{list.slice(0, 300).map((r) => <tr class="click" onClick={() => openInd(r.p)} style={{ borderLeft: `4px solid ${TONE[r.state]}` }}>
              <td><b>{lab(r.p)}</b></td><td><div class="cm-d">{r.x.indicator}</div>{r.x.result && <small class="muted">{tidy(r.x.result).slice(0, 90)}</small>}</td>
              <td>{tidy(r.x.baseline) || '—'}</td><td><b>{tidy(r.x.target) || '—'}</b></td><td>{tidy(r.x.current) || '—'}</td>
              <td>{r.prog != null ? <span class="rs-p"><em><b style={{ width: `${Math.min(1, Math.max(0, r.prog)) * 100}%`, background: TONE[r.state] }} /></em><small class="num">{pct(r.prog)}</small></span> : <span class="muted">—</span>}</td>
              <td><span class="badge" style={{ background: `color-mix(in srgb, ${TONE[r.state]} 15%, transparent)`, color: TONE[r.state] }}>{r.state}</span></td>
              <td class="num" style={{ whiteSpace: 'nowrap' }}>{r.x.asOf ? date(r.x.asOf) : '—'}{r.prog != null && r.stale && <small class="muted" style={{ display: 'block' }}>update due</small>}</td></tr>)}</tbody></table>
            {!list.length && <p class="muted">Nothing here — all measured indicators are on track.</p>}</div></section>
      </div>
    </>
  );
}
