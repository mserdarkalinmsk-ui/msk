import { useState } from 'preact/hooks';
import { filtered, useStore } from '../data/store';
import { HEADINGS, lineExposure, lines, n } from '../domain/calc';
import type { Project } from '../domain/types';
import { TODAY } from '../today';
import { full, pct, short } from '../ui/format';
import { download } from '../ui/xlsxwrite';
import { openProject } from './ProjectPage';

const HS = ['1', '2', '3', '4', '5', '6'];
type Cell = { budget: number; sc: number; spent: number; used: number; over: number; status: 'none' | 'ok' | 'high' | 'notification' | 'near' | 'addendum' };
const LABEL: Record<Cell['status'], string> = { none: 'No budget', ok: 'Within budget', high: '90%+ used', notification: 'Notification (within 25%)', near: 'Near addendum (20–25%)', addendum: 'Addendum (beyond 25%)' };

function cells(p: Project): Record<string, Cell> {
  const out: Record<string, Cell> = {};
  for (const h of HS) {
    const L = lines(p).filter((l) => l.code.split('.')[0] === h);
    const budget = L.reduce((a, l) => a + n(l.approved), 0), sc = L.reduce((a, l) => a + lineExposure(l), 0), spent = L.reduce((a, l) => a + n(l.actual), 0);
    const used = budget ? sc / budget : 0, over = budget ? (sc - budget) / budget : 0;
    out[h] = { budget, sc, spent, used, over, status: !budget ? (sc ? 'addendum' : 'none') : over > 0.25 ? 'addendum' : over >= 0.2 ? 'near' : over > 0 ? 'notification' : used >= 0.9 ? 'high' : 'ok' };
  }
  return out;
}

/** Portfolio heat map: every project against every budget heading, by how much of the heading is used and what a transfer would need. */
export function Heatmap() {
  const s = useStore((x) => x);
  const [mode, setMode] = useState<'sc' | 'spent'>('sc');
  const R = filtered(s).map((p) => ({ p, c: cells(p) })).filter((r) => HS.some((h) => r.c[h].budget || r.c[h].sc));
  const worst = (r: (typeof R)[number]) => Math.max(...HS.map((h) => ['none', 'ok', 'high', 'notification', 'near', 'addendum'].indexOf(r.c[h].status)));
  R.sort((a, b) => worst(b) - worst(a));
  const count = (st: Cell['status']) => R.reduce((a, r) => a + HS.filter((h) => r.c[h].status === st).length, 0);
  const val = (c: Cell) => (c.budget ? (mode === 'sc' ? c.sc : c.spent) / c.budget : 0);
  const bg = (c: Cell) => { const v = Math.min(1, val(c)); return c.status === 'none' ? 'transparent' : mode === 'sc' && c.status === 'addendum' ? 'color-mix(in srgb,var(--critical) 78%,var(--surface))' : mode === 'sc' && c.status === 'near' ? 'color-mix(in srgb,var(--serious) 70%,var(--surface))' : mode === 'sc' && c.status === 'notification' ? 'color-mix(in srgb,var(--warn) 60%,var(--surface))' : `color-mix(in srgb,var(--c1) ${Math.round(8 + v * 62)}%,var(--surface))`; };
  const dark = (c: Cell) => (mode === 'sc' && (c.status === 'addendum' || c.status === 'near')) || val(c) > 0.62;
  const xlsx = () => download(`headings-heatmap-${TODAY.toISOString().slice(0, 10)}.xlsx`, [{ name: 'Headings', rows: [
    ['Project', 'BH', ...HS.flatMap((h) => [`${h}. ${HEADINGS[h]} — budget`, 'Spent + committed', 'Used', 'Status'])].map((v) => ({ v, st: 'head' as const })),
    ...R.map((r) => [r.p.name, r.p.bh ?? '', ...HS.flatMap((h) => [r.c[h].budget, r.c[h].sc, r.c[h].budget ? r.c[h].used : '', LABEL[r.c[h].status]])])] }]);
  if (!R.length) return <div class="card empty-page"><div><h2>No budget lines yet</h2><p>Import the financial reports; every project then appears here against its budget headings.</p></div></div>;
  return (
    <>
      <section class="hero" aria-label="Headings">
        <div class="kpi lead"><span class="label">Headings beyond the 25% flexibility</span><span class="value" style={{ color: count('addendum') ? 'var(--critical)' : undefined }}>{count('addendum')}</span><span class="ctx">an addendum is needed before more is committed</span></div>
        <div class="kpi"><span class="label">Near the addendum threshold</span><span class="value" style={{ color: count('near') ? 'var(--serious)' : undefined }}>{count('near')}</span><span class="ctx">20–25% above the heading</span></div>
        <div class="kpi"><span class="label">Notification</span><span class="value">{count('notification')}</span><span class="ctx">above the heading, within 25%</span></div>
        <div class="kpi"><span class="label">90%+ used</span><span class="value">{count('high')}</span><span class="ctx">of {R.length} projects × {HS.length} headings</span></div>
      </section>
      <section class="card" style={{ marginTop: '16px' }}>
        <div class="card-h"><div><h2>Budget headings — all projects</h2><p>{mode === 'sc' ? 'Spent + committed' : 'Spent'} as a share of each heading's approved budget · the darker, the more is used · click a cell to open the project against its approved budget</p></div>
          <div class="tools" style={{ display: 'flex', gap: '8px' }}><div class="seg"><button aria-pressed={mode === 'sc'} onClick={() => setMode('sc')}>Spent + committed</button><button aria-pressed={mode === 'spent'} onClick={() => setMode('spent')}>Spent</button></div><button class="btn" onClick={xlsx}>⤓ Excel</button></div></div>
        <div class="table-wrap" style={{ padding: '0 16px 8px' }}><table class="hm">
          <thead><tr><th>Project</th>{HS.map((h) => <th>{h}. {HEADINGS[h]}</th>)}</tr></thead>
          <tbody>{R.map((r) => <tr><th><button class="hm-p" onClick={() => openProject(r.p.id, 'summary')}><b>{r.p.bh ? `BH ${r.p.bh}` : r.p.code}</b><span>{r.p.name}</span></button></th>
            {HS.map((h) => { const c = r.c[h]; return <td><button class={`hm-c ${c.status} ${dark(c) ? 'dk' : ''}`} style={{ background: bg(c) }} disabled={c.status === 'none'} onClick={() => openProject(r.p.id, 'budget')}
              title={`${r.p.name} · ${h}. ${HEADINGS[h]}\nBudget ${full(c.budget)}\nSpent ${full(c.spent)}\nSpent + committed ${full(c.sc)}\n${LABEL[c.status]}`}>
              {c.status === 'none' ? <span class="hm-nil">—</span> : <><b>{c.budget ? pct(val(c)) : 'n/b'}</b><small>{short(mode === 'sc' ? c.sc : c.spent)} / {short(c.budget)}</small></>}</button></td>; })}</tr>)}</tbody></table></div>
        <div class="tools legend" style={{ padding: '4px 20px 16px', flexWrap: 'wrap' }}>
          <span><i style={{ background: 'color-mix(in srgb,var(--c1) 20%,var(--surface))' }} />low use</span><span><i style={{ background: 'color-mix(in srgb,var(--c1) 65%,var(--surface))' }} />high use</span>
          <span><i style={{ background: 'color-mix(in srgb,var(--warn) 60%,var(--surface))' }} />Notification</span><span><i style={{ background: 'color-mix(in srgb,var(--serious) 70%,var(--surface))' }} />Near addendum</span><span><i style={{ background: 'color-mix(in srgb,var(--critical) 78%,var(--surface))' }} />Addendum</span></div>
      </section>
    </>);
}
