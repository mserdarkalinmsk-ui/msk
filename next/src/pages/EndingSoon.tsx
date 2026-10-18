import { useState } from 'preact/hooks';
import { filtered, go, useStore } from '../data/store';
import { ending } from '../domain/cash';
import type { Project } from '../domain/types';
import { TODAY } from '../today';
import { date, full, short } from '../ui/format';
import { download } from '../ui/xlsxwrite';

const lab = (p: Project) => (p.bh ? `BH ${p.bh}` : p.code);
const TONE = { bad: '#e5484d', warn: '#c27c0e', ok: '#30a46c' };

/** Projects ending soon: the monthly spending needed to use the budget by the end date against the current pace. */
export function EndingSoon() {
  const s = useStore((x) => x);
  const [within, setWithin] = useState(12);
  const cname = (id: string) => s.ledger.countries.find((c) => c.id === id)?.name ?? id;
  const R = ending(filtered(s), TODAY, within);
  const risk = R.filter((r) => r.level === 'bad'), unspent = R.reduce((a, r) => a + r.unspent, 0);
  const xlsx = () => download(`ending-soon-${TODAY.toISOString().slice(0, 10)}.xlsx`, [{ name: 'Ending soon', money: [4, 5, 6, 7, 8, 9], rows: [
    ['Project', 'Country', 'End date', 'Months left', 'Budget', 'Spent + committed', 'Left to use', 'Needed per month', 'Current pace per month', 'Unspent at this pace', 'Share of budget'],
    ...R.map((r) => [lab(r.p), cname(r.p.country), r.p.end, Math.round(r.monthsLeft * 10) / 10, r.budget, r.sc, r.remaining, r.need, r.pace, r.unspent, r.share])] }]);
  return (
    <>
      <section class="hero" aria-label="Ending soon">
        <div class="kpi lead"><span class="label">Ending within {within} months</span><span class="value">{R.length}</span><span class="ctx">{short(R.reduce((a, r) => a + r.remaining, 0))} still to use · commitments count as used</span></div>
        <div class="kpi"><span class="label">Would stay unspent</span><span class="value" style={{ color: unspent ? TONE.bad : undefined }}>{short(unspent)}</span><span class="ctx">at the current pace — likely to be returned</span></div>
        <div class="kpi"><span class="label">Need to speed up</span><span class="value" style={{ color: risk.length ? TONE.bad : undefined }}>{risk.length}</span><span class="ctx">{risk.length ? risk.map((r) => lab(r.p)).join(', ') : 'none would leave over 10% unspent'}</span></div>
      </section>
      <section class="card" style={{ marginTop: '16px' }}>
        <div class="card-h" style={{ alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}><div><h2>Spending needed to the end date</h2><p>Needed per month = budget left ÷ months left · pace = spending of the last six months of reports</p></div>
          <div class="seg" style={{ marginLeft: 'auto' }}>{[6, 12, 18].map((m) => <button aria-pressed={within === m} onClick={() => setWithin(m)}>{m} months</button>)}</div>
          <button class="btn" onClick={xlsx}>⤓ Excel</button></div>
        <div class="card-b table-scroll"><table class="mini"><thead><tr><th>Project</th><th>Ends</th><th class="r">Months left</th><th class="r">Left to use</th><th style={{ width: '22%' }}>Needed vs pace (per month)</th><th class="r">Unspent at this pace</th></tr></thead>
          <tbody>{R.map((r) => { const mx = Math.max(r.need, r.pace, 1); return <tr class="click" onClick={() => go(`project/${r.p.id}`)} style={{ borderLeft: `4px solid ${TONE[r.level]}` }}>
            <td><b>{lab(r.p)}</b><small class="muted"> {cname(r.p.country)}</small><div class="muted" style={{ fontSize: '11.5px' }}>{r.p.name.slice(0, 70)}</div></td>
            <td class="num" style={{ whiteSpace: 'nowrap' }}>{date(r.p.end)}</td><td class="r num">{r.monthsLeft.toFixed(1)}</td><td class="r num"><b>{full(r.remaining)}</b><small class="muted" style={{ display: 'block' }}>of {short(r.budget)}</small></td>
            <td><div class="es-bars"><span><i style={{ width: `${r.need / mx * 100}%`, background: TONE[r.level] }} /><em>needed {short(r.need)}</em></span><span><i style={{ width: `${r.pace / mx * 100}%`, background: 'var(--ink-3, #888)' }} /><em>pace {short(r.pace)}</em></span></div></td>
            <td class="r num" style={{ color: TONE[r.level] }}><b>{r.unspent ? full(r.unspent) : '—'}</b>{r.unspent > 0 && <small style={{ display: 'block' }}>{Math.round(r.share * 100)}% of budget</small>}</td></tr>; })}</tbody></table>
          {!R.length && <p class="muted">No project ends within {within} months.</p>}</div>
      </section>
    </>
  );
}
