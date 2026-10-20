import { useState } from 'preact/hooks';
import { filtered, go, useStore } from '../data/store';
import { budgetCheck, rateMedians, type Level } from '../domain/budgetcheck';
import type { Project } from '../domain/types';
import { TODAY } from '../today';
import { full } from '../ui/format';
import { download } from '../ui/xlsxwrite';

const lab = (p: Project) => (p.bh ? `BH ${p.bh}` : p.code);
const TAG: Record<Level, { t: string; c: string }> = { bad: { t: 'Error', c: 'critical' }, warn: { t: 'Check', c: 'warning' }, info: { t: 'Note', c: 'neutral' } };

/** Budget check: line-by-line mistakes in approved budgets and reports, per project. */
export function BudgetCheck() {
  const s = useStore((x) => x);
  const [show, setShow] = useState<'all' | 'bad' | 'warn'>('all');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const med = rateMedians(s.ledger.projects);
  const C = filtered(s).map((p) => budgetCheck(p, med)).sort((a, b) => b.bad - a.bad || b.warn - a.warn);
  const keep = (l: Level) => show === 'all' || l === show;
  const tot = { bad: C.reduce((a, c) => a + c.bad, 0), warn: C.reduce((a, c) => a + c.warn, 0), clean: C.filter((c) => !c.bad && !c.warn).length };
  const flip = (id: string) => { const n = new Set(open); n.has(id) ? n.delete(id) : n.add(id); setOpen(n); };
  const xlsx = () => download(`budget-check-${TODAY.toISOString().slice(0, 10)}.xlsx`, [{ name: 'Budget check', money: [5, 6], rows: [
    ['Project', 'Level', 'Where', 'Line', 'Finding', 'Expected', 'Found'],
    ...C.flatMap((c) => c.findings.map((f) => [lab(c.p), TAG[f.level].t, f.where, f.code ?? '', f.text, f.expected ?? '', f.found ?? '']))] }]);
  return (
    <>
      <section class="hero" aria-label="Budget check">
        <div class="kpi lead"><span class="label">Budget errors</span><span class="value">{tot.bad}</span><span class="ctx">wrong sums, duplicate lines, admin above 7% · {C.length} projects checked</span></div>
        <div class="kpi click" onClick={() => setShow(show === 'warn' ? 'all' : 'warn')}><span class="label">To check</span><span class="value" style={{ color: tot.warn ? 'var(--warn)' : undefined }}>{tot.warn}</span><span class="ctx">unknown or renamed lines, overspent lines, unusual rates</span></div>
        <div class="kpi"><span class="label">Clean</span><span class="value" style={{ color: 'var(--good)' }}>{tot.clean}</span><span class="ctx">projects with nothing to check</span></div>
      </section>
      <section class="card" style={{ marginTop: '16px' }}>
        <div class="card-h" style={{ alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}><div><h2>Findings by project</h2><p>Approved budget and every report, line by line · units × rate, heading sums, codes, descriptions, line budgets and rates against the portfolio</p></div>
          <div class="seg" style={{ marginLeft: 'auto' }}>{(['all', 'bad', 'warn'] as const).map((k) => <button aria-pressed={show === k} onClick={() => setShow(k)}>{k === 'all' ? 'All' : k === 'bad' ? `Errors (${tot.bad})` : `To check (${tot.warn})`}</button>)}</div>
          <button class="btn" onClick={xlsx}>⤓ Excel</button></div>
        <div class="card-b" style={{ display: 'grid', gap: '10px' }}>
          {C.map((c) => { const F = c.findings.filter((f) => keep(f.level)), o = open.has(c.p.id) !== (c.bad > 0); // projects with errors open by default
            return <article class={`bc${c.bad ? ' bad' : c.warn ? ' warn' : ' ok'}`}>
              <header class="click" onClick={() => flip(c.p.id)}><b>{lab(c.p)}</b><span class="muted"> {c.p.name.slice(0, 80)}</span>
                <span class="bc-n">{c.bad > 0 && <span class="badge critical">{c.bad} error{c.bad > 1 ? 's' : ''}</span>}{c.warn > 0 && <span class="badge warning">{c.warn} to check</span>}{!c.bad && !c.warn && <span class="badge good">clean</span>}<span class="muted">{o ? '▾' : '▸'}</span></span></header>
              {o && (F.length ? <div class="table-scroll"><table class="mini"><thead><tr><th style={{ width: '70px' }} /><th>Where</th><th>Line</th><th>Finding</th><th class="r">Should be</th></tr></thead>
                <tbody>{F.map((f) => <tr><td><span class={`badge ${TAG[f.level].c}`}>{TAG[f.level].t}</span></td><td class="muted" style={{ whiteSpace: 'nowrap' }}>{f.where}</td><td class="num">{f.code ?? '—'}</td><td>{f.text}</td><td class="r num">{f.expected != null ? full(f.expected) : ''}</td></tr>)}</tbody></table>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}><button class="btn ghost" onClick={() => go(`project/${c.p.id}`)}>Open project →</button></div></div>
                : <p class="muted" style={{ margin: '6px 0 0' }}>{c.p.approvedBudget || c.p.reportingPeriods?.length ? 'Nothing found.' : 'No approved budget or report loaded yet — nothing to check.'}</p>)}
            </article>; })}
          {!C.length && <p class="muted">No projects in the selection.</p>}
        </div>
      </section>
    </>
  );
}
