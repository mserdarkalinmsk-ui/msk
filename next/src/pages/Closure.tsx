import { useState } from 'preact/hooks';
import { updateProject } from '../data/store';
import { deadlines, HEADINGS, lineExposure, lines, money, n, parseDate } from '../domain/calc';
import { headings, outcome } from '../domain/insights';
import type { Project } from '../domain/types';
import { TODAY } from '../today';
import { closureSteps } from '../domain/closure';
import { date, full, pct } from '../ui/format';
import { download } from '../ui/xlsxwrite';
import { latestWorkbook } from './FinancialReport';

const DAY = 86_400_000;

/** Closure: what still has to be done before and after the end date, and the final balance of the contribution. */
export function Closure({ p }: { p: Project }) {
  const c = p.closure ?? {}, done = c.done ?? {};
  const m = money(p), o = outcome(p, TODAY);
  const final = deadlines(p, TODAY).find((d) => d.kind === 'Final report');
  const left = Math.round((parseDate(p.end).getTime() - TODAY.getTime()) / DAY);
  const wb = latestWorkbook(p)?.snapshot?.workbook;
  const recv = c.received ?? (wb ? wb.movements.filter((x) => x.funding).reduce((s, x) => s + x.amount, 0) : 0);
  const share = c.euShare ?? (Number((p.contract as { euShare?: number } | undefined)?.euShare) || 100);
  const eligible = Math.min(o.projected, m.budget), due = eligible * share / 100, balance = due - recv;
  const steps = closureSteps(p, TODAY, wb);
  const nDone = steps.filter((x) => x.state === 'done').length;
  const save = (patch: Partial<NonNullable<Project['closure']>>) => updateProject(p.id, { closure: { ...c, ...patch } });
  return (
    <div class="grid g-12">
      <section class="hero ph-tiles span-12">
        <div class="kpi lead"><span class="label">End date</span><span class="value">{left >= 0 ? `${left} days` : 'ended'}</span><span class="ctx">{date(p.end)}</span></div>
        <div class="kpi"><span class="label">Final report due</span><span class="value" style={{ fontSize: '22px' }}>{final ? date(final.due) : '—'}</span><span class="ctx">{final?.status ?? 'set reporting terms in the contract'}</span></div>
        <div class="kpi"><span class="label">Closure checklist</span><span class="value">{nDone}/{steps.length}</span><span class="ctx">{nDone === steps.length ? 'complete' : `${steps.filter((x) => x.state === 'overdue').length} overdue · ${steps.length - nDone} to do`}</span></div>
        <div class="kpi"><span class="label">{balance >= 0 ? 'Final payment expected' : 'To be recovered'}</span><span class="value" style={{ color: balance < 0 ? 'var(--critical)' : undefined }}>{full(Math.abs(balance))}</span><span class="ctx">at the current forecast</span></div>
      </section>
      <section class="card span-7">
        <div class="card-h"><div><h2>Closure timeline</h2><p>Each step is due relative to the end date ({date(p.end)}) · tick when done · some are checked from the data on file</p></div></div>
        <ol class="ct">{steps.map((st) => (
          <li class={`ct-${st.state}`}><span class="ct-dot" />
            <label><input type="checkbox" checked={st.state === 'done'} onChange={() => save({ done: { ...done, [st.k]: st.state !== 'done' } })} />
              <div><div class="ct-top"><b>{st.label}</b><span class={`badge ${st.state === 'done' ? 'good' : st.state === 'overdue' ? 'critical' : st.state === 'due' ? 'warning' : 'neutral'}`}>{st.state === 'done' ? 'done' : st.state === 'overdue' ? 'overdue' : st.state === 'due' ? 'due soon' : 'upcoming'}</span></div>
                <small>{st.hint}{st.auto ? ` · ${st.auto}` : ''}</small>
                <small class="ct-when num">{date(st.due)} · {st.offset === 0 ? 'end date' : st.offset < 0 ? `${-st.offset} month${st.offset < -1 ? 's' : ''} before the end` : `${st.offset} month${st.offset > 1 ? 's' : ''} after the end`}</small></div></label></li>))}
        </ol>
      </section>
      <section class="card span-5">
        <div class="card-h"><div><h2>Final balance</h2><p>Forecast eligible costs × EU share − contributions received</p></div></div>
        <div class="card-b">
          <dl class="ap-dl">
            <dt>Budget</dt><dd class="num">{full(m.budget)}</dd>
            <dt>Eligible costs at end (forecast)</dt><dd class="num">{full(eligible)}</dd>
            <dt>EU share</dt><dd><input class="input num cl-in" value={String(share)} onChange={(e) => save({ euShare: Number((e.target as HTMLInputElement).value) || 100 })} /> %</dd>
            <dt>EU contribution due</dt><dd class="num">{full(due)}</dd>
            <dt>Received so far</dt><dd><input class="input num cl-in" style={{ width: '120px' }} value={String(Math.round(recv))} onChange={(e) => save({ received: Number((e.target as HTMLInputElement).value.replace(/[^\d.-]/g, '')) || 0 })} /></dd>
            <dt><b>{balance >= 0 ? 'Final payment' : 'Recovery'}</b></dt><dd class="num"><b style={{ color: balance < 0 ? 'var(--critical)' : 'var(--good)' }}>{full(Math.abs(balance))}</b></dd>
            <dt>Likely unused budget</dt><dd class="num">{full(o.unused)}</dd>
          </dl>
          <p class="muted" style={{ fontSize: '12px', marginTop: '10px' }}>“Received” is read from the funding movements of the latest report workbook; overwrite it if more was paid.</p>
        </div>
      </section>
    </div>
  );
}

/** Budget revision draft: heading need at the end date vs approved, transfers and the flexibility check. */
export function Revision({ p }: { p: Project }) {
  const H = headings(p), o = outcome(p, TODAY), m = money(p);
  const L = lines(p);
  const ratio = m.spent ? o.projected / m.spent : 1;
  const [edit, setEdit] = useState<Record<string, number>>({});
  const base = H.rows.map((h) => {
    const spent0 = L.filter((l) => l.code.split('.')[0] === h.code).reduce((s, l) => s + n(l.actual), 0);
    const exp0 = L.filter((l) => l.code.split('.')[0] === h.code).reduce((s, l) => s + lineExposure(l), 0);
    return Math.max(exp0, spent0 * ratio);
  });
  const needSum = base.reduce((a, b) => a + b, 0) || 1, curSum = H.rows.reduce((s, h) => s + h.approved, 0);
  const rows = H.rows.map((h, i) => {
    const spent = L.filter((l) => l.code.split('.')[0] === h.code).reduce((s, l) => s + n(l.actual), 0);
    const exp = L.filter((l) => l.code.split('.')[0] === h.code).reduce((s, l) => s + lineExposure(l), 0);
    const need = Math.max(exp, Math.round(spent * ratio));
    // Default proposal keeps the total: the current total shared out in proportion to each heading's need.
    const proposed = edit[h.code] ?? Math.round(base[i] / needSum * curSum);
    const change = proposed - h.approved, vs = h.baseline ? (proposed - h.baseline) / h.baseline : 0;
    return { ...h, spent, need, proposed, change, vs, breach: Math.abs(vs) > H.flex };
  });
  const tA = rows.reduce((s, r) => s + r.approved, 0), tP = rows.reduce((s, r) => s + r.proposed, 0);
  const gap = tA - tP;
  const xlsx = () => download(`${p.code}-budget-revision.xlsx`, [{ name: 'Revision', rows: [['Heading', 'Approved baseline', 'Current budget', 'Spent', 'Need at end', 'Proposed', 'Change', 'Change vs baseline', 'Amendment needed'], ...rows.map((r) => [`${r.code} ${HEADINGS[r.code]}`, r.baseline, r.approved, r.spent, r.need, r.proposed, r.change, `${(r.vs * 100).toFixed(1)}%`, r.breach ? 'yes' : 'no']), ['Total direct costs', H.direct.baseline, tA, '', '', tP, tP - tA, '', '']], money: [1, 2, 3, 4, 5, 6] }]);
  return (
    <section class="card span-12">
      <div class="card-h"><div><h2>Budget revision draft</h2><p>Need at end = spent × the project's forecast ratio ({ratio.toFixed(2)}), never below spent + committed · the proposal shares the current total in proportion to need, so transfers net to zero · edit “Proposed” to adjust · flexibility {Math.round(H.flex * 100)}% per heading</p></div>
        <button class="btn" style={{ marginLeft: 'auto' }} onClick={xlsx}>⤓ Excel</button></div>
      <div class="card-b table-scroll">
        <table class="mini hd">
          <thead><tr><th>Heading</th><th class="r">Approved baseline</th><th class="r">Current</th><th class="r">Spent</th><th class="r">Need at end</th><th class="r">Proposed</th><th class="r">Transfer</th><th class="r">vs baseline</th><th /></tr></thead>
          <tbody>{rows.map((r) => <tr>
            <td><b>{r.code}</b> {HEADINGS[r.code]}</td><td class="r num">{full(r.baseline)}</td><td class="r num">{full(r.approved)}</td><td class="r num">{full(r.spent)}</td><td class="r num">{full(r.need)}</td>
            <td class="r"><input class="input num cl-in" style={{ width: '120px', textAlign: 'right' }} value={String(Math.round(r.proposed))} onChange={(e) => setEdit({ ...edit, [r.code]: Number((e.target as HTMLInputElement).value.replace(/[^\d.-]/g, '')) || 0 })} /></td>
            <td class="r num" style={{ color: r.change < 0 ? 'var(--good)' : r.change > 0 ? 'var(--serious)' : undefined }}>{Math.abs(r.change) < 1 ? '—' : `${r.change > 0 ? '+' : '−'}${full(Math.abs(r.change))}`}</td>
            <td class="r num">{Math.abs(r.vs) < 0.0005 ? '—' : `${r.vs > 0 ? '+' : ''}${(r.vs * 100).toFixed(1)}%`}</td>
            <td>{r.breach ? <span class="badge serious">amendment</span> : <span class="badge good">within</span>}</td>
          </tr>)}</tbody>
          <tfoot class="hd-f"><tr class="hd-total"><td>Total direct costs</td><td class="r num">{full(H.direct.baseline)}</td><td class="r num">{full(tA)}</td><td /><td /><td class="r num">{full(tP)}</td><td class="r num">{Math.abs(tP - tA) < 1 ? '—' : `${tP > tA ? '+' : '−'}${full(Math.abs(tP - tA))}`}</td><td /><td /></tr></tfoot>
        </table>
        <p class="muted" style={{ fontSize: '12.5px', marginTop: '10px' }}>{Math.abs(gap) < 1 ? 'Proposal keeps the total unchanged.' : gap > 0 ? `${full(gap)} of direct costs would stay unallocated (${pct(gap / (tA || 1))}) — move it to headings that need more, or plan activities to use it.` : `Proposal exceeds the current total by ${full(-gap)} — reduce other headings.`}{rows.some((r) => r.breach) ? ' Headings marked “amendment” move more than the flexibility allows and need a contract amendment.' : ''}</p>
      </div>
    </section>
  );
}
