import { Ico } from '../ui/Ico';
import { useState } from 'preact/hooks';
import { flexOf, pctOf } from '../domain/flex';
import { plabel } from '../domain/label';
import { monthsAhead, type Cell } from '../domain/monthsAhead';
import type { Project } from '../domain/types';
import { TODAY } from '../today';
import { full, month, pct } from '../ui/format';
import { download } from '../ui/xlsxwrite';
import { depletion } from './Depletion';

const SLIPS = [0, 1, 2, 3, 6], PACES = [0.75, 1, 1.25, 1.5];
const when = (k: string | null) => (k == null ? '—' : k === 'now' ? 'already' : month(Date.parse(`${k}-15T00:00:00Z`)));
const C = ({ c, budget }: { c: Cell; budget: number }) => <td class={`r num ma-c ma-${c.state}`} title={`${full(c.sc)} of ${full(budget)}`}>{budget ? pct(c.share) : '—'}</td>;

/** Each heading, month by month until the end date: where spent + committed stands, and when a letter is needed. */
export function MonthsAhead({ p }: { p: Project }) {
  const [slip, setSlip] = useState(0), [pace, setPace] = useState(1);
  if (p.datesTbc) return null;
  const D = depletion(p), from = Math.max(D.asOf, TODAY.getTime()), end = Date.parse(p.end), fx = flexOf(p);
  const A = monthsAhead(D.rows.filter((h) => h.code !== '10'), from, end, { slip, pace, flex: fx });
  if (!A.months.length) return null;
  const what = `${slip ? `activities slip ${slip} month${slip > 1 ? 's' : ''}` : 'no slip'} · ${pace === 1 ? 'pace as so far' : `pace ${pace > 1 ? '+' : '−'}${Math.round(Math.abs(pace - 1) * 100)}%`}`;
  const xlsx = () => download(`${plabel(p)}-month-by-month-${TODAY.toISOString().slice(0, 10)}.xlsx`, [{ name: 'Month by month', money: [1, 2, 3, ...A.months.map((_, i) => 4 + i)], rows: [
    [{ v: `${plabel(p)} · spent + committed by heading, month by month · ${what}`, st: 'head' as const }],
    ['Heading', 'Budget', 'Now', 'A month', ...A.months.map((m, i) => (i === A.months.length - 1 ? `${m} (end)` : m)), 'Passes the budget', `Passes +${pctOf(fx)}%`].map((v) => ({ v, st: 'head' as const })),
    ...A.heads.map((h) => [`${h.code} ${h.label}`, h.budget, h.now, h.rate, ...h.cells.map((c) => c.sc), h.notify ?? '', h.addendum ?? '']),
    ['Direct costs', A.total.budget, A.total.now, '', ...A.total.cells, '', ''],
  ] }]);
  const letters = A.heads.filter((h) => h.notify || h.addendum);
  return (
    <section class="card ma">
      <div class="card-h" style={{ flexWrap: 'wrap', gap: '8px' }}>
        <div><h2>Month by month ahead</h2><p>Spent + committed of each heading as a share of its budget at the end of every month to {when(A.months.at(-1)!)} · each heading keeps its monthly spending so far · amber = passes the budget (notification), red = passes the {pctOf(fx)}% flexibility (addendum) · nothing changes the project data</p></div>
        <div class="tools" style={{ marginLeft: 'auto', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span class="muted">Activities slip</span><div class="seg">{SLIPS.map((s) => <button aria-pressed={slip === s} onClick={() => setSlip(s)}>{s ? `${s} mo` : 'none'}</button>)}</div>
          <span class="muted">Pace</span><div class="seg">{PACES.map((v) => <button aria-pressed={pace === v} onClick={() => setPace(v)}>{v === 1 ? 'as so far' : `${v > 1 ? '+' : '−'}${Math.round(Math.abs(v - 1) * 100)}%`}</button>)}</div>
          <button class="btn" onClick={xlsx}><Ico n="download" />Excel</button>
        </div>
      </div>
      <div class="card-b">
        <p class="ma-sum">{letters.length ? <>With {what}: {letters.map((h, i) => <>{i ? '; ' : ''}<b>{h.code} {h.label}</b> {h.addendum ? <>needs an <b class="ma-bad">addendum</b> {h.addendum === 'now' ? 'already' : `from ${when(h.addendum)}`}</> : <>needs a <b class="ma-warn">notification</b> {h.notify === 'now' ? 'already' : `from ${when(h.notify)}`}</>}</>)}.</> : <>With {what}, no heading passes its budget before the end date.</>}</p>
        <div class="table-scroll"><table class="mini ma-t" data-raw>
          <thead><tr><th class="ma-h">Heading</th><th class="r">Budget</th><th class="r">Now</th><th class="r">A month</th>{A.months.map((m, i) => <th class="r ma-m">{month(Date.parse(`${m}-15T00:00:00Z`))}{i === A.months.length - 1 && <small class="ma-end">end</small>}</th>)}</tr></thead>
          <tbody>{A.heads.map((h) => <tr><th class="ma-h" scope="row"><b>{h.code}</b> {h.label}</th><td class="r num">{full(h.budget)}</td><td class={`r num ma-c ma-${h.addendum === 'now' ? 'addendum' : h.notify === 'now' ? 'notify' : 'ok'}`} title={h.budget ? `${pct(h.now / h.budget)} of the budget` : undefined}>{full(h.now)}</td><td class="r num">{full(h.rate)}</td>{h.cells.map((c) => <C c={c} budget={h.budget} />)}</tr>)}</tbody>
          <tfoot><tr><th class="ma-h" scope="row">Direct costs</th><td class="r num">{full(A.total.budget)}</td><td class="r num">{full(A.total.now)}</td><td />{A.total.cells.map((v, i) => <td class="r num">{A.total.budget ? (i === A.total.cells.length - 1 ? <b>{pct(v / A.total.budget)}</b> : pct(v / A.total.budget)) : '—'}</td>)}</tr></tfoot>
        </table></div>
      </div>
    </section>
  );
}
