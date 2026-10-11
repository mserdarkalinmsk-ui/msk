import { useStore } from '../data/store';
import { deadlines, money, planStats } from '../domain/calc';
import { alerts, headings, outcome } from '../domain/insights';
import { daysUntil, renewals, roster } from '../domain/staff';
import { TODAY } from '../today';
import { date, full, short } from './format';

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
    const H = headings(p);
    body = <><p class="muted">Transfers between headings up to {Math.round(H.flex * 100)}% need no amendment.</p>
      <table class="mini ap-t"><thead><tr><th>Heading</th><th class="r">Approved</th><th class="r">Current</th><th class="r">Change</th></tr></thead>
      <tbody>{H.rows.map((h) => <tr class={h.status === 'breach' ? 'ap-bad' : ''}><td>{h.code} {h.label}</td><td class="r num">{short(h.baseline)}</td><td class="r num">{short(h.approved)}</td><td class="r num">{Math.abs(h.change) < 0.0005 ? '—' : `${(h.change * 100).toFixed(1)}%`}</td></tr>)}</tbody></table></>;
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
