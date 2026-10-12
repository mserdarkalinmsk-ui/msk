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
  { k: '0–3 months', max: 91, color: '#30a46c' }, { k: '3–6 months', max: 183, color: '#3b82c4' },
  { k: '6–12 months', max: 365, color: '#f5a524' }, { k: 'over 12 months', max: Infinity, color: '#e5484d' },
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
  const all = openPOs(P).sort((a, c) => c.balance - a.balance);
  const rows = all.filter((x) => (only === 'all' || (only === 'nostaff' ? !x.staff : x.flags.length > 0)) && (b < 0 || x.bucket === b));
  const tot = all.reduce((a, x) => a + x.balance, 0), flagged = all.filter((x) => x.flags.length), flaggedTot = flagged.reduce((a, x) => a + x.balance, 0);
  const byB = BUCKETS.map((_, i) => all.filter((x) => x.bucket === i).reduce((a, x) => a + x.balance, 0));
  const sup = [...all.filter((x) => !x.staff).reduce((m, x) => m.set(x.supplier || '—', (m.get(x.supplier || '—') ?? 0) + x.balance), new Map<string, number>())].sort((a, c) => c[1] - a[1]).slice(0, 8);
  const lab = (p: Project) => (p.bh ? `BH ${p.bh}` : p.code);
  const noWb = P.filter((p) => !latestWorkbook(p)?.snapshot?.workbook).length;
  const xlsx = () => download(`open-commitments-${TODAY.toISOString().slice(0, 10)}.xlsx`, [{ name: 'Open POs', money: [6, 7, 8], rows: [
    ['Project', 'PO', 'Line', 'Description', 'Supplier', 'Encumbered', 'PO amount', 'Paid', 'Open balance', 'Age (days)', 'Staff', 'Flags'],
    ...all.map((x) => [lab(x.p), x.po, x.line, x.description || x.nature, x.supplier, x.date, x.amount, x.spent, x.balance, x.age, x.staff ? 'yes' : '', x.flags.join('; ')])] }]);
  return (
    <>
      <section class="hero" aria-label="Open commitments">
        <div class="kpi lead"><span class="label">Open commitments</span><span class="value">{short(tot)}</span><span class="ctx">of which staff <b>{short(all.filter((x) => x.staff).reduce((a, x) => a + x.balance, 0))}</b> · {all.length} open purchase orders in {new Set(all.map((x) => x.p.id)).size} projects{noWb ? ` · ${noWb} projects without a report workbook` : ''}</span></div>
        <div class="kpi"><span class="label">To review</span><span class="value" style={{ color: flagged.length ? '#e5484d' : undefined }}>{short(flaggedTot)}</span><span class="ctx">{flagged.length} POs flagged — may be released to free budget</span></div>
        <div class="kpi"><span class="label">Older than 6 months</span><span class="value">{short(byB[2] + byB[3])}</span><span class="ctx">{tot ? Math.round((byB[2] + byB[3]) / tot * 100) : 0}% of the open balance</span></div>
        <div class="kpi"><span class="label">Largest supplier</span><span class="value" style={{ fontSize: '20px' }}>{sup[0] ? short(sup[0][1]) : '—'}</span><span class="ctx">{sup[0]?.[0] ?? ''}</span></div>
      </section>
      <div class="grid g-12" style={{ marginTop: '16px' }}>
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
