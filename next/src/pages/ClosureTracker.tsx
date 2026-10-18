import { useState } from 'preact/hooks';
import { filtered, go, useStore } from '../data/store';
import { closureSteps, inClosure, STEPS, type StepState } from '../domain/closure';
import { money, parseDate } from '../domain/calc';
import { TODAY } from '../today';
import { date, short } from '../ui/format';
import { latestWorkbook } from './FinancialReport';

const C: Record<StepState, string> = { done: 'var(--good)', overdue: 'var(--critical)', due: 'var(--c4)', upcoming: 'var(--surface-2)' };
const SHORT: Record<string, string> = { plan: 'Plan', staff: 'Staff', procure: 'Last POs', assets: 'Assets', visibility: 'Final event', commitments: 'POs settled', narrative: 'Narrative', financial: 'Financial', verification: 'Audit', payment: 'Payment', archive: 'Archive' };

/** Portfolio closure tracker: every project ending within six months or not yet closed, step by step. */
export function ClosureTracker() {
  const s = useStore((x) => x);
  const [win, setWin] = useState(6);
  const R = filtered(s).map((p) => ({ p, S: closureSteps(p, TODAY, latestWorkbook(p)?.snapshot?.workbook) })).filter((x) => inClosure(x.p, TODAY, x.S, win)).sort((a, b) => a.p.end.localeCompare(b.p.end));
  const overdue = R.reduce((n, x) => n + x.S.filter((st) => st.state === 'overdue').length, 0);
  const days = (iso: string) => Math.round((parseDate(iso).getTime() - TODAY.getTime()) / 864e5);
  const open = (id: string) => { go(`project/${id}`); setTimeout(() => dispatchEvent(new CustomEvent('pl-tab', { detail: 'Closure' })), 60); };
  return (
    <>
      <section class="hero" aria-label="Closure">
        <div class="kpi lead"><span class="label">Projects in closure</span><span class="value">{R.length}</span><span class="ctx">{win >= 600 ? 'all projects not yet fully closed' : `ending within ${win} months, or ended and not fully closed`}</span></div>
        <div class="kpi"><span class="label">Overdue steps</span><span class="value" style={{ color: overdue ? 'var(--critical)' : undefined }}>{overdue}</span><span class="ctx">past their date and not ticked</span></div>
        <div class="kpi"><span class="label">Budget still to close</span><span class="value">{short(R.reduce((a, x) => a + money(x.p).budget, 0))}</span><span class="ctx">{short(R.reduce((a, x) => a + money(x.p).remaining, 0))} not yet spent or committed</span></div>
      </section>
      <section class="card" style={{ marginTop: '16px' }}>
        <div class="card-h" style={{ alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}><div class="seg" style={{ order: 2, marginLeft: 'auto' }}>{[[6, '6 months'], [12, '12 months'], [24, '24 months'], [600, 'All']].map(([v, l]) => <button aria-pressed={win === v} onClick={() => setWin(v as number)}>{l}</button>)}</div><div><h2>Closure tracker</h2><p>Each square is a step, due relative to the project end date · green done · red overdue · amber due within a month · click a project to open its closure page</p></div></div>
        <div class="card-b table-scroll">
          {!R.length ? <p class="muted">No project ends within this window — choose a longer one above.</p> : <table class="mini clt">
            <thead><tr><th>Project</th><th>Ends</th>{STEPS.map((st) => <th class="clt-h" title={st.label}>{SHORT[st.k]}<small>{st.m < 0 ? `−${-st.m}m` : `+${st.m}m`}</small></th>)}<th class="r">Done</th></tr></thead>
            <tbody>{R.map(({ p, S }) => { const d = days(p.end); return (
              <tr class="click" onClick={() => open(p.id)}>
                <td><b>{p.bh ? `BH ${p.bh}` : p.code}</b><small class="muted" style={{ display: 'block' }}>{p.name.length > 46 ? p.name.slice(0, 44) + '…' : p.name}</small></td>
                <td class="num" style={{ whiteSpace: 'nowrap' }}>{date(p.end)}<small class="muted" style={{ display: 'block', color: d < 0 ? 'var(--critical)' : undefined }}>{d >= 0 ? `in ${d} days` : `${-d} days ago`}</small></td>
                {S.map((st) => <td class="clt-c"><span title={`${st.label} · ${date(st.due)} · ${st.state}${st.auto ? ` · ${st.auto}` : ''}`} style={{ background: C[st.state] }}>{st.state === 'done' ? '✓' : st.state === 'overdue' ? '!' : ''}</span></td>)}
                <td class="r num"><b>{S.filter((x) => x.state === 'done').length}/{S.length}</b></td>
              </tr>); })}</tbody></table>}
        </div>
      </section>
    </>
  );
}
