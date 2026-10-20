import { useState } from 'preact/hooks';
import { filtered, go, useStore } from '../data/store';
import type { Project } from '../domain/types';
import type { PO } from '../domain/workbook';
import { TODAY } from '../today';
import { date, full, short } from '../ui/format';
import { download } from '../ui/xlsxwrite';
import { latestWorkbook } from './FinancialReport';

const DAY = 864e5;
const BUCKETS = [
  { k: '0–3 months', max: 91, color: 'var(--good)' }, { k: '3–6 months', max: 183, color: 'var(--c1)' },
  { k: '6–12 months', max: 365, color: 'var(--c4)' }, { k: 'over 12 months', max: Infinity, color: 'var(--critical)' },
];
export interface OpenPO extends PO { p: Project; age: number; bucket: number; flags: string[]; staff: boolean }

/** Open purchase orders of the latest report of each project, with age and warning flags. */
export function openPOs(P: Project[]): OpenPO[] {
  return P.flatMap((p) => {
    const wb = latestWorkbook(p)?.snapshot?.workbook; if (!wb) return [];
    return wb.pos.filter((x) => /open/i.test(x.status) && x.balance > 0.5).map((x) => {
      const age = x.date ? Math.max(0, Math.round((TODAY.getTime() - Date.parse(x.date)) / DAY)) : 0;
      // Staff contracts (remuneration lines 1.x.1, payroll suppliers) are planned salaries, not purchases to chase.
      const staff = /^1\.[12]\.1(\.|$)/.test(x.line) || /\bPAIE\b|payroll|salar/i.test(`${x.supplier} ${x.nature}`);
      const flags: string[] = [];
      if (staff) { /* no review flags on salaries */ }
      else if (age > 183 && x.spent < 0.5) flags.push('nothing paid in 6+ months');
      else if (age > 365 && x.balance > 0.5 * x.amount) flags.push('over half unpaid after a year');
      if (staff) { /* */ } else if (p.end && p.end < TODAY.toISOString().slice(0, 10)) flags.push('project already ended');
      else if (p.end && (Date.parse(p.end) - TODAY.getTime()) / DAY < 90) flags.push('project ends within 90 days');
      return { ...x, p, age, bucket: BUCKETS.findIndex((b) => age <= b.max), flags, staff };
    });
  });
}

export function Commitments() {
  const s = useStore((x) => x);
  const P = filtered(s);
  const [only, setOnly] = useState<'all' | 'nostaff' | 'flag'>('nostaff');
  const [b, setB] = useState(-1);
  // Country and project selection work together: a PO shows when its country and its project are both selected (empty = all).
  const [selC, setSelC] = useState<string[]>([]), [selP, setSelP] = useState<string[]>([]);
  const [sumBy, setSumBy] = useState<'project' | 'country'>('project');
  const tog = (a: string[], v: string) => (a.includes(v) ? a.filter((x) => x !== v) : [...a, v]);
  const cname = (id: string) => s.ledger.countries.find((c) => c.id === id)?.name ?? id.toUpperCase();
  const every = openPOs(P).sort((a, c) => c.balance - a.balance);
  const all = every.filter((x) => (!selC.length || selC.includes(x.p.country)) && (!selP.length || selP.includes(x.p.id)));
  const scope = every.filter((x) => !selC.length || selC.includes(x.p.country));
  const groupRows = (L: OpenPO[], key: (x: OpenPO) => string) => [...L.reduce((m, x) => {
    const k = key(x), g = m.get(k) ?? { k, n: 0, amount: 0, paid: 0, open: 0, staff: 0, review: 0, old: 0, projects: new Set<string>() };
    g.n++; g.amount += x.amount; g.paid += x.spent; g.open += x.balance; if (x.staff) g.staff += x.balance; if (x.flags.length) g.review += x.balance; if (x.age > 183) g.old += x.balance; g.projects.add(x.p.id);
    return m.set(k, g);
  }, new Map<string, { k: string; n: number; amount: number; paid: number; open: number; staff: number; review: number; old: number; projects: Set<string> }>()).values()].sort((a, c) => c.open - a.open);
  const byProject = groupRows(scope, (x) => x.p.id), byCountry = groupRows(every, (x) => x.p.country);
  const countries = [...new Set(every.map((x) => x.p.country))];
  const projOf = (id: string) => P.find((p) => p.id === id)!;
  const rows = all.filter((x) => (only === 'all' || (only === 'nostaff' ? !x.staff : x.flags.length > 0)) && (b < 0 || x.bucket === b));
  const tot = all.reduce((a, x) => a + x.balance, 0), flagged = all.filter((x) => x.flags.length), flaggedTot = flagged.reduce((a, x) => a + x.balance, 0);
  const byB = BUCKETS.map((_, i) => all.filter((x) => x.bucket === i).reduce((a, x) => a + x.balance, 0));
  const sup = [...all.filter((x) => !x.staff).reduce((m, x) => m.set(x.supplier || '—', (m.get(x.supplier || '—') ?? 0) + x.balance), new Map<string, number>())].sort((a, c) => c[1] - a[1]).slice(0, 8);
  const lab = (p: Project) => (p.bh ? `BH ${p.bh}` : p.code);
  const noWb = P.filter((p) => !latestWorkbook(p)?.snapshot?.workbook).length;
  const xlsx = () => download(`open-commitments-${TODAY.toISOString().slice(0, 10)}.xlsx`, [{ name: 'Open POs', money: [6, 7, 8], rows: [
    ['Project', 'PO', 'Line', 'Description', 'Supplier', 'Encumbered', 'PO amount', 'Paid', 'Open balance', 'Age (days)', 'Staff', 'Flags', 'Country'],
    ...all.map((x) => [lab(x.p), x.po, x.line, x.description || x.nature, x.supplier, x.date, x.amount, x.spent, x.balance, x.age, x.staff ? 'yes' : '', x.flags.join('; '), cname(x.p.country)])] },
    { name: 'By project', money: [3, 4, 5, 6, 7, 8], rows: [['Project', 'Country', 'POs', 'Amount', 'Paid', 'Open', 'Staff', 'Older than 6 m', 'To review'], ...groupRows(all, (x) => x.p.id).map((g) => [lab(projOf(g.k)), cname(projOf(g.k).country), g.n, g.amount, g.paid, g.open, g.staff, g.old, g.review])] },
    { name: 'By country', money: [3, 4, 5, 6, 7, 8], rows: [['Country', 'Projects', 'POs', 'Amount', 'Paid', 'Open', 'Staff', 'Older than 6 m', 'To review'], ...groupRows(all, (x) => x.p.country).map((g) => [cname(g.k), g.projects.size, g.n, g.amount, g.paid, g.open, g.staff, g.old, g.review])] }]);
  return (
    <>
      <section class="hero" aria-label="Open commitments">
        <div class="kpi lead"><span class="label">Open commitments</span><span class="value">{short(tot)}</span><span class="ctx">of which staff <b>{short(all.filter((x) => x.staff).reduce((a, x) => a + x.balance, 0))}</b> · {all.length} open purchase orders in {new Set(all.map((x) => x.p.id)).size} projects{noWb ? ` · ${noWb} projects without a report workbook` : ''}</span></div>
        <div class="kpi"><span class="label">To review</span><span class="value" style={{ color: flagged.length ? 'var(--critical)' : undefined }}>{short(flaggedTot)}</span><span class="ctx">{flagged.length} POs flagged — may be released to free budget</span></div>
        <div class="kpi"><span class="label">Older than 6 months</span><span class="value">{short(byB[2] + byB[3])}</span><span class="ctx">{tot ? Math.round((byB[2] + byB[3]) / tot * 100) : 0}% of the open balance</span></div>
        <div class="kpi"><span class="label">Largest supplier</span><span class="value" style={{ fontSize: '20px' }}>{sup[0] ? short(sup[0][1]) : '—'}</span><span class="ctx">{sup[0]?.[0] ?? ''}</span></div>
      </section>
      <div class="grid g-12" style={{ marginTop: '16px' }}>
        <section class="card span-12">
          <div class="card-h" style={{ alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}><div><h2>Summary by {sumBy}</h2><p>Click rows to select · countries and projects can be combined · the whole page follows the selection</p></div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}><div class="seg"><button aria-pressed={sumBy === 'project'} onClick={() => setSumBy('project')}>By project</button><button aria-pressed={sumBy === 'country'} onClick={() => setSumBy('country')}>By country</button></div>
              {(selC.length > 0 || selP.length > 0) && <button class="btn ghost" onClick={() => { setSelC([]); setSelP([]); }}>Clear selection</button>}</div></div>
          <div class="card-b" style={{ display: 'grid', gap: '10px' }}>
            <div class="cm-chips"><span class="muted">Countries</span>{countries.map((c) => <button class={`chip${selC.includes(c) ? ' on' : ''}`} aria-pressed={selC.includes(c)} onClick={() => { setSelC(tog(selC, c)); setSelP([]); }}>{cname(c)}</button>)}</div>
            <div class="cm-chips"><span class="muted">Projects</span>{byProject.map((g) => <button class={`chip${selP.includes(g.k) ? ' on' : ''}`} aria-pressed={selP.includes(g.k)} onClick={() => setSelP(tog(selP, g.k))}>{lab(projOf(g.k))}</button>)}</div>
            <div class="table-scroll"><table class="mini cm-sum"><thead><tr><th>{sumBy === 'project' ? 'Project' : 'Country'}</th><th class="r">POs</th><th class="r">Amount</th><th class="r">Paid</th><th class="r">Open</th><th class="r">of which staff</th><th class="r">Older than 6 m</th><th class="r">To review</th><th style={{ width: '22%' }}>Share of open</th></tr></thead>
              <tbody>{(sumBy === 'project' ? byProject : byCountry).map((g) => { const on = sumBy === 'project' ? selP.includes(g.k) : selC.includes(g.k), max = Math.max(...(sumBy === 'project' ? byProject : byCountry).map((x) => x.open), 1);
                return <tr class={`click${on ? ' sel' : ''}`} onClick={() => (sumBy === 'project' ? setSelP(tog(selP, g.k)) : (setSelC(tog(selC, g.k)), setSelP([])))}>
                  <td><input type="checkbox" checked={on} tabIndex={-1} style={{ marginRight: '8px' }} /><b>{sumBy === 'project' ? lab(projOf(g.k)) : cname(g.k)}</b>{sumBy === 'project' ? <small class="muted"> {cname(projOf(g.k).country)}</small> : <small class="muted"> {g.projects.size} projects</small>}</td>
                  <td class="r num">{g.n}</td><td class="r num">{full(g.amount)}</td><td class="r num">{full(g.paid)}</td><td class="r num"><b>{full(g.open)}</b></td><td class="r num">{full(g.staff)}</td>
                  <td class="r num">{full(g.old)}</td><td class="r num" style={{ color: g.review ? 'var(--critical)' : undefined }}>{full(g.review)}</td><td><span class="cm-bar"><i style={{ width: `${g.open / max * 100}%` }} /></span></td></tr>; })}</tbody>
              <tfoot><tr><td><b>{selC.length || selP.length ? 'Selected' : 'Total'}</b></td><td class="r num">{all.length}</td><td class="r num">{full(all.reduce((a, x) => a + x.amount, 0))}</td><td class="r num">{full(all.reduce((a, x) => a + x.spent, 0))}</td><td class="r num"><b>{full(tot)}</b></td>
                <td class="r num">{full(all.filter((x) => x.staff).reduce((a, x) => a + x.balance, 0))}</td><td class="r num">{full(byB[2] + byB[3])}</td><td class="r num">{full(flaggedTot)}</td><td /></tr></tfoot></table></div>
          </div>
        </section>
        <section class="card span-7"><div class="card-h"><div><h2>Age of open balances</h2><p>Since the PO was encumbered · click a bar to filter</p></div></div>
          <div class="card-b"><div class="cm-age">{BUCKETS.map((x, i) => <button class={`cm-b${b === i ? ' on' : ''}`} onClick={() => setB(b === i ? -1 : i)}>
            <span class="cm-l">{x.k}</span><span class="cm-bar"><i style={{ width: `${tot ? byB[i] / tot * 100 : 0}%`, background: x.color }} /></span><b class="num">{short(byB[i])}</b><small class="muted">{all.filter((y) => y.bucket === i).length} POs</small></button>)}</div></div></section>
        <section class="card span-5"><div class="card-h"><div><h2>Suppliers</h2><p>Open balance by supplier, staff contracts excluded</p></div></div>
          <div class="card-b"><ul class="cm-sup">{sup.map(([n, v]) => <li><span title={n}>{n}</span><span class="cm-bar"><i style={{ width: `${sup[0] ? v / sup[0][1] * 100 : 0}%` }} /></span><b class="num">{short(v)}</b></li>)}</ul></div></section>
        <section class="card span-12">
          <div class="card-h" style={{ alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}><div><h2>Open purchase orders</h2><p>From the latest report workbook of each project · {rows.length} shown</p></div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}><div class="seg"><button aria-pressed={only === 'nostaff'} onClick={() => setOnly('nostaff')}>Excluding staff</button><button aria-pressed={only === 'all'} onClick={() => setOnly('all')}>All</button><button aria-pressed={only === 'flag'} onClick={() => setOnly('flag')}>To review ({flagged.length})</button></div><button class="btn" onClick={xlsx}>⤓ Excel</button></div></div>
          <div class="card-b table-scroll"><table class="mini cm-t"><thead><tr><th>Project</th><th>PO</th><th>Line</th><th>Description / supplier</th><th>Encumbered</th><th class="r">Amount</th><th class="r">Paid</th><th class="r">Open</th><th>Review</th></tr></thead>
            <tbody>{rows.slice(0, 300).map((x) => <tr class="click" onClick={() => go(`project/${x.p.id}`)} style={{ borderLeft: `4px solid ${BUCKETS[x.bucket].color}` }}>
              <td><b>{lab(x.p)}</b></td><td class="num">{x.po}</td><td class="num">{x.line}</td><td><div class="cm-d">{x.description || x.nature}</div><small class="muted">{x.supplier}</small></td>
              <td class="num" style={{ whiteSpace: 'nowrap' }}>{x.date ? date(x.date) : '—'}<small class="muted" style={{ display: 'block' }}>{x.age} days</small></td>
              <td class="r num">{full(x.amount)}</td><td class="r num">{full(x.spent)}</td><td class="r num"><b>{full(x.balance)}</b></td>
              <td>{x.staff && <span class="badge neutral" style={{ marginRight: '4px' }}>staff</span>}{x.flags.map((f) => <span class="badge warning" style={{ marginRight: '4px' }}>{f}</span>)}</td></tr>)}</tbody></table>
            {!rows.length && <p class="muted">{all.length ? 'No PO in this selection.' : 'No open purchase orders — import the report workbooks (with the “Purchase Orders” sheet).'}</p>}</div>
        </section>
      </div>
    </>
  );
}
