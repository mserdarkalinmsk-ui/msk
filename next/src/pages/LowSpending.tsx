import { filtered, go, useStore } from '../data/store';
import { ending } from '../domain/cash';
import { elapsed } from '../domain/calc';
import type { Project } from '../domain/types';
import { TODAY } from '../today';
import { date, full, short } from '../ui/format';
import { download } from '../ui/xlsxwrite';

const lab = (p: Project) => (p.bh ? `BH ${p.bh}` : p.code);
const TONE = { bad: 'var(--critical)', warn: 'var(--warn)', ok: 'var(--good)' };

/** Low spending: every running project whose current pace would leave part of the budget unspent at the end date. */
export function LowSpending() {
  const s = useStore((x) => x);
  const cname = (id: string) => s.ledger.countries.find((c) => c.id === id)?.name ?? id;
  const R = ending(filtered(s), TODAY, 1200).filter((r) => r.unspent > 0 && r.level !== 'ok');
  const T = R.reduce((a, r) => a + r.unspent, 0);
  const xlsx = () => download(`low-spending-${TODAY.toISOString().slice(0, 10)}.xlsx`, [{ name: 'Low spending', money: [3, 4, 5, 6, 7], rows: [
    ['Project', 'Country', 'Ends', 'Budget', 'Spent + committed', 'Needed per month', 'Pace per month', 'Unspent at this pace', 'Share of budget', 'Time elapsed'],
    ...R.map((r) => [lab(r.p), cname(r.p.country), r.p.end, r.budget, r.sc, r.need, r.pace, r.unspent, r.share, elapsed(r.p, TODAY)])] }]);
  return (
    <>
      <section class="hero" aria-label="Low spending">
        <div class="kpi lead"><span class="label">Low spending</span><span class="value">{R.length}</span><span class="ctx">projects that would not use their budget at the current pace</span></div>
        <div class="kpi"><span class="label">Would stay unspent</span><span class="value" style={{ color: T ? 'var(--critical)' : undefined }}>{short(T)}</span><span class="ctx">across these projects by their end dates</span></div>
        <div class="kpi"><span class="label">Over 10% unspent</span><span class="value" style={{ color: R.some((r) => r.level === 'bad') ? 'var(--critical)' : undefined }}>{R.filter((r) => r.level === 'bad').length}</span><span class="ctx">{R.filter((r) => r.level === 'bad').map((r) => lab(r.p)).join(', ') || '—'}</span></div>
      </section>
      <section class="card" style={{ marginTop: '16px' }}>
        <div class="card-h" style={{ alignItems: 'center' }}><div><h2>Projects at risk of underspending</h2><p>All running projects · needed per month to use the budget by the end date against the current pace</p></div>
          <button class="btn" style={{ marginLeft: 'auto' }} onClick={xlsx}>⤓ Excel</button></div>
        <div class="card-b table-scroll"><table class="mini"><thead><tr><th>Project</th><th>Ends</th><th class="r">Budget</th><th class="r">Spent + committed</th><th style={{ width: '22%' }}>Needed vs pace (per month)</th><th class="r">Unspent at this pace</th></tr></thead>
          <tbody>{R.map((r) => { const mx = Math.max(r.need, r.pace, 1); return <tr class="click" onClick={() => go(`project/${r.p.id}`)} style={{ borderLeft: `4px solid ${TONE[r.level]}` }}>
            <td><b>{lab(r.p)}</b><small class="muted"> {cname(r.p.country)}</small><div class="muted" style={{ fontSize: '11.5px' }}>{r.p.name.slice(0, 70)}</div></td>
            <td class="num" style={{ whiteSpace: 'nowrap' }}>{date(r.p.end)}<small class="muted" style={{ display: 'block' }}>{r.monthsLeft.toFixed(0)} months left</small></td>
            <td class="r num">{full(r.budget)}</td><td class="r num">{full(r.sc)}<small class="muted" style={{ display: 'block' }}>{r.budget ? Math.round(r.sc / r.budget * 100) : 0}% · time {Math.round(elapsed(r.p, TODAY) * 100)}%</small></td>
            <td><div class="es-bars"><span><i style={{ width: `${r.need / mx * 100}%`, background: TONE[r.level] }} /><em>needed {short(r.need)}</em></span><span><i style={{ width: `${r.pace / mx * 100}%`, background: 'var(--ink-3, #888)' }} /><em>pace {short(r.pace)}</em></span></div></td>
            <td class="r num" style={{ color: TONE[r.level] }}><b>{full(r.unspent)}</b><small style={{ display: 'block' }}>{Math.round(r.share * 100)}% of budget</small></td></tr>; })}</tbody></table>
          {!R.length && <p class="muted">No project is below the pace needed to use its budget.</p>}</div>
      </section>
    </>
  );
}
