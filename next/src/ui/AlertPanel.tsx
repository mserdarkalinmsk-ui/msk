import { useStore } from '../data/store';
import { deadlines, lineExposure, lines, money, n, planStats } from '../domain/calc';
import { earlyWarnings, STAGE } from '../domain/earlywarn';
import { alerts, headings, outcome } from '../domain/insights';
import { daysUntil, renewals, roster } from '../domain/staff';
import { TODAY } from '../today';
import { date, full } from './format';

const openTab = (t: string, close: () => void) => { dispatchEvent(new CustomEvent('pl-tab', { detail: t })); close(); };
const row = (k: string, v: unknown) => <><dt>{k}</dt><dd class="num">{v as string}</dd></>;

/** Detail behind one attention item (or a folded group of the same kind). */
export function AlertPanel({ projectId, kind, ids, close }: { projectId: string; kind: string; ids: string[]; close: () => void }) {
  const p = useStore((s) => s.ledger.projects.find((x) => x.id === projectId));
  if (!p) return null;
  const A = alerts([p], TODAY).filter((a) => ids.includes(a.id));
  const head = A[0];
  let body = null, tab = '';
  if (kind === 'deadline') {
    tab = 'Reports';
    body = <table class="mini ap-t"><thead><tr><th>Report</th><th>Period to</th><th>Due</th><th>Status</th></tr></thead>
      <tbody>{deadlines(p, TODAY).map((d) => <tr><td>{d.kind}</td><td class="num">{date(d.periodEnd)}</td><td class="num">{date(d.due)}</td><td><span class={`badge ${d.status === 'overdue' ? 'critical' : d.status === 'submitted' ? 'good' : d.status === 'due' ? 'warning' : 'info'}`}>{d.status}</span></td></tr>)}</tbody></table>;
  } else if (kind === 'forecast' || kind === 'underspend' || kind === 'overspend' || kind === 'overbudget') {
    tab = 'Financial report';
    const o = outcome(p, TODAY), m = money(p);
    body = <dl class="ap-dl">{row('Budget', full(m.budget))}{row('Spent', full(m.spent))}{row('Committed', full(m.committed))}{row('Projected at end', full(o.projected))}{row('Likely unused', full(o.unused))}{row('Current rate', `${full(o.rate)}/month`)}{row('Needed to use all', `${full(o.needRate)}/month`)}{row('Months left', o.monthsLeft.toFixed(1))}</dl>;
  } else if (kind === 'plan') {
    tab = 'Activity plan';
    const late = planStats(p, TODAY)?.acts.filter((a) => a.late) ?? [];
    body = <table class="mini ap-t"><thead><tr><th>Code</th><th>Activity</th><th class="r">Planned end</th></tr></thead>
      <tbody>{late.map((a) => <tr><td class="num">{a.code}</td><td>{a.name}</td><td class="r num">month {a.plannedEnd}</td></tr>)}</tbody></table>;
  } else if (kind === 'contract') {
    tab = 'Staff';
    const R = renewals(roster(p, TODAY), TODAY, 90);
    body = <table class="mini ap-t"><thead><tr><th>Name</th><th>Position</th><th>Ends</th><th class="r">Days</th></tr></thead>
      <tbody>{R.map((a) => <tr><td>{a.display}</td><td>{a.position}</td><td class="num">{date(a.end)}</td><td class="r num">{daysUntil(a.end, TODAY)}</td></tr>)}</tbody></table>;
  } else if (kind === 'line') {
    tab = 'Budget lines';
    const H = headings(p), W = earlyWarnings(p, TODAY), L = lines(p);
    const leaf = L.filter((l) => !L.some((o) => o !== l && o.code.startsWith(l.code + '.')) && l.code !== '10');
    const over = leaf.filter((l) => n(l.approved) > 0 && lineExposure(l) > n(l.approved) + 1).sort((a, b) => (lineExposure(b) - n(b.approved)) - (lineExposure(a) - n(a.approved)));
    const delta = (v: number) => Math.abs(v) < 0.5 ? <span class="muted">—</span> : <span class={v > 0 ? 'ap-up' : 'ap-down'}>{v > 0 ? '▲ +' : '▼ −'}{full(Math.abs(v)).replace('−', '')}</span>;
    body = <>
      {over.length > 0 && <><h3 class="ap-h">Lines above their budget</h3>
        <table class="mini ap-t"><thead><tr><th>Line</th><th class="r">Budget</th><th class="r">Spent + committed</th><th class="r">Difference</th><th class="r">Used</th></tr></thead>
          <tbody>{over.map((l) => { const e = lineExposure(l), b = n(l.approved); return <tr><td><span class="num muted">{l.code}</span> {l.description}</td><td class="r num">{full(b)}</td><td class="r num">{full(e)}</td><td class="r num">{delta(e - b)}</td><td class="r num ap-up">{Math.round(e / b * 100)}%</td></tr>; })}</tbody></table></>}
      <h3 class="ap-h">Headings</h3>
      <table class="mini ap-t"><thead><tr><th>Heading</th><th class="r">Budget</th><th class="r">Spent + committed</th><th class="r">Left or over</th><th>At the end date</th></tr></thead>
        <tbody>{H.rows.map((h) => { const w = W.find((x) => x.code === h.code), left = h.approved - h.exposure; return <tr class={h.exposure > h.approved + 1 ? 'ap-bad' : ''}>
          <td>{h.code} {h.label}{Math.abs(h.change) >= 0.0005 && <small class="muted" style={{ display: 'block' }}>{(h.change * 100).toFixed(1)}% against the agreement</small>}</td>
          <td class="r num">{full(h.approved)}</td><td class="r num">{full(h.exposure)}</td><td class="r num">{left >= -0.5 ? <span class="ap-down">{full(left)} left</span> : <span class="ap-up">▲ {full(-left)} over</span>}</td>
          <td>{w ? <span class={`badge ${STAGE[w.stage].tone}`}>{STAGE[w.stage].label}</span> : h.exposure > h.approved + 1 ? <span class="badge critical" title="Load the approved budget for the early warning">Over budget</span> : <span class="muted" title="Load the approved budget for the early warning">—</span>}</td></tr>; })}</tbody></table>
      <div class="ap-note">{over.map((l) => l.code.split('.')[0]).filter((c, i, a) => a.indexOf(c) === i).map((c) => { const h = H.rows.find((r) => r.code === c); if (!h) return null; const room = h.approved - h.exposure;
        return <p>{room >= 0 ? <>Heading <b>{c} {h.label}</b> still has <b>{full(room)}</b>: cover the lines above with a transfer <b>within the heading</b> — free, no notification.</> : <>Heading <b>{c} {h.label}</b> is <b class="ap-up">{full(-room)}</b> over: a transfer from another heading is needed — a <b>notification</b> while the change stays within {Math.round(H.flex * 100)}% of the agreement, an <b>addendum</b> beyond.</>}</p>; })}</div>
    </>;
  } else if (kind === 'risk') tab = 'Risks';
  return (
    <>
      <div class="drawer-h"><div><h2>{head?.title ?? 'Details'}</h2><p class="muted">{p.code} · {p.name}</p></div><button class="btn ghost" onClick={close} aria-label="Close">✕</button></div>
      <div class="drawer-b ap">
        <ul class="ap-items">{A.map((a) => <li><span class={`badge ${a.severity}`}>{a.severity}</span><div><b>{a.title}</b><small>{a.detail}{a.due ? ` · ${date(a.due)}` : ''}</small></div></li>)}</ul>
        {body}
        {tab && <button class="btn primary" onClick={() => openTab(tab, close)}>Open {tab}</button>}
      </div>
    </>
  );
}
