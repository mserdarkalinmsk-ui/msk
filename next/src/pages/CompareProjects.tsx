import { useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { filtered, useStore } from '../data/store';
import { byCategory, elapsed, HEADINGS, lineRows, lines, money } from '../domain/calc';
import { cashRow, pace } from '../domain/cash';
import { providerSummary } from '../domain/providers';
import type { Project } from '../domain/types';
import { TODAY } from '../today';
import { date, full, short } from '../ui/format';

const lab = (p: Project) => (p.bh ? `BH ${p.bh}` : p.code);
const pc = (v: number) => `${Math.round(v * 100)}%`;
const COL = ['var(--c1)', 'var(--critical)', 'var(--c3)'];
// Unit rates worth comparing between projects (same budget codes in the CoE template).
const RATES: [string, string][] = [['1.1.3', 'Local short-term consultant'], ['1.2.3', 'International short-term consultant'], ['5.5.1', 'Translation'], ['5.5.2', 'Interpretation']];

/** Two or three projects side by side: money, pace, budget structure, unit rates, providers and cash. */
export function CompareProjects() {
  const s = useStore((x) => x);
  const P = filtered(s).filter((p) => !p.datesTbc).sort((a, b) => lab(a).localeCompare(lab(b)));
  const [ids, setIds] = useState<string[]>(() => [...P].sort((a, b) => money(b).budget - money(a).budget).slice(0, 2).map((p) => p.id));
  const sel = ids.map((id) => P.find((p) => p.id === id)).filter((p): p is Project => !!p);
  const cname = (id: string) => s.ledger.countries.find((c) => c.id === id)?.name ?? id;
  const D = sel.map((p) => {
    const m = money(p), el = elapsed(p, TODAY), H = byCategory(lineRows([p])), tot = H.reduce((a, h) => a + h.approved, 0);
    return { p, m, el, perf: m.budget * el ? m.spent / (m.budget * el) : 0, H, tot, pace: pace(p, TODAY), cash: cashRow(p, TODAY), sp: providerSummary([p], s.ledger.poKinds ?? {}, 3), L: lines(p) };
  });
  const heads = [...new Set(D.flatMap((d) => d.H.map((h) => h.key)))].sort((a, b) => parseInt(a) - parseInt(b));
  const Row = ({ k, v, bar }: { k: string; v: (d: (typeof D)[number]) => ComponentChildren; bar?: (d: (typeof D)[number]) => number }) =>
    <tr><th>{k}</th>{D.map((d, i) => <td>{bar ? <span class="cpj-bar"><i style={{ width: `${Math.min(100, bar(d) * 100)}%`, background: COL[i] }} /></span> : null}<span class="num">{v(d)}</span></td>)}</tr>;
  return (
    <section class="card">
      <div class="card-h" style={{ alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}><div><h2>Compare projects</h2><p>Choose two or three projects</p></div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>{[0, 1, 2].map((i) => <select class="sp-sel" style={{ borderLeft: `4px solid ${COL[i]}` }} value={ids[i] ?? ''} onChange={(e) => { const v = (e.target as HTMLSelectElement).value, n = [...ids]; n[i] = v; setIds(n.filter((x, j) => x && n.indexOf(x) === j)); }}>
          <option value="">{i < 2 ? 'Choose a project' : '— third project (optional)'}</option>{P.map((p) => <option value={p.id}>{lab(p)} · {p.name.slice(0, 40)}</option>)}</select>)}</div></div>
      {D.length < 2 ? <div class="card-b"><p class="muted">Choose at least two projects.</p></div> :
      <div class="card-b table-scroll"><table class="mini cpj">
        <thead><tr><th /> {D.map((d, i) => <th style={{ borderTop: `4px solid ${COL[i]}` }}><b>{lab(d.p)}</b><div class="muted" style={{ fontWeight: 400 }}>{cname(d.p.country)} · {d.p.name.slice(0, 60)}</div></th>)}</tr></thead>
        <tbody>
          <tr class="cpj-h"><th colSpan={D.length + 1}>Money and time</th></tr>
          <Row k="Period" v={(d) => `${date(d.p.start)} – ${date(d.p.end)}`} />
          <Row k="Budget" v={(d) => full(d.m.budget)} />
          <Row k="Spent" v={(d) => `${full(d.m.spent)} · ${pc(d.m.budget ? d.m.spent / d.m.budget : 0)}`} bar={(d) => (d.m.budget ? d.m.spent / d.m.budget : 0)} />
          <Row k="Spent + committed" v={(d) => `${full(d.m.spent + d.m.committed)} · ${pc(d.m.budget ? (d.m.spent + d.m.committed) / d.m.budget : 0)}`} bar={(d) => (d.m.budget ? (d.m.spent + d.m.committed) / d.m.budget : 0)} />
          <Row k="Time elapsed" v={(d) => pc(d.el)} bar={(d) => d.el} />
          <Row k="Spending against plan" v={(d) => pc(d.perf)} bar={(d) => d.perf / 1.5} />
          <Row k="Pace per month" v={(d) => full(d.pace)} />
          <Row k="Cash left (received − spent)" v={(d) => (d.cash.received ? full(d.cash.cash) : '—')} />
          <tr class="cpj-h"><th colSpan={D.length + 1}>Budget structure (share of approved)</th></tr>
          {heads.map((h) => <Row k={h.replace(/^(\d+) /, '$1. ')} v={(d) => { const x = d.H.find((y) => y.key === h); return x && d.tot ? `${pc(x.approved / d.tot)} · ${short(x.approved)}` : '—'; }} bar={(d) => { const x = d.H.find((y) => y.key === h); return x && d.tot ? x.approved / d.tot : 0; }} />)}
          <tr class="cpj-h"><th colSpan={D.length + 1}>Unit rates in the budget</th></tr>
          {RATES.map(([c, l]) => <Row k={`${c} ${l}`} v={(d) => { const x = d.L.find((y) => y.code === c); return x?.unitRate ? `${full(x.unitRate)} ${(x.unit ?? '').toLowerCase()}` : '—'; }} />)}
          <tr class="cpj-h"><th colSpan={D.length + 1}>Service providers</th></tr>
          <Row k="Spent + committed" v={(d) => (d.sp.total ? `${full(d.sp.total)} · ${d.sp.providers} providers` : '—')} />
          <Row k="Largest kind" v={(d) => (d.sp.kinds[0] ? `${d.sp.kinds[0].label} ${short(d.sp.kinds[0].v)}` : '—')} />
          <Row k="Largest providers" v={(d) => (d.sp.top.length ? d.sp.top.map((x) => `${x.supplier.slice(0, 30)} ${short(x.sc)}`).join(' · ') : '—')} />
        </tbody></table>
        <p class="muted" style={{ fontSize: '12px' }}>Headings: {Object.entries(HEADINGS).map(([k, v]) => `${k} ${v}`).join(' · ')}</p></div>}
    </section>
  );
}
