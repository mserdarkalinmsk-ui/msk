import { useState } from 'preact/hooks';
import { go, useStore } from '../data/store';
import { events } from '../pages/Agenda';
import { poToCheck } from '../pages/POReview';
import { contractsDue } from '../domain/contracts';
import { coreDue } from '../domain/coreTeam';
import { alerts } from '../domain/insights';
import { openAlerts } from '../domain/worklist';
import { plabel } from '../domain/label';
import { fold, todoGroups, type Todo } from '../domain/today';
import type { Project } from '../domain/types';
import { TODAY } from '../today';
import { date } from './format';

const TAB: Record<string, string> = { report: 'reports', contract: 'staff', activity: 'plan', project: 'summary' };
const iso = TODAY.toISOString().slice(0, 10);

/** What needs the user now, from every corner of the app: reports due, contracts ending, orders to check, urgent alerts. */
export function Today({ P }: { P: Project[] }) {
  const L = useStore((s) => s.ledger);
  const [all, setAll] = useState<Record<string, boolean>>({});
  const cs = new Set(P.map((p) => p.country)), cn = (id: string) => L.countries.find((c) => c.id === id)?.name ?? id;
  const T: Todo[] = [];
  // the calendar: reports, staff contracts, late activities, project ends
  for (const e of events(P)) {
    if (e.kind === 'activity' && e.tone !== 'bad') continue;
    T.push({ key: `ev|${e.kind}|${e.p.id}|${e.day}|${e.title}`, kind: e.kind, when: e.day, tone: e.tone === 'bad' ? 'bad' : e.kind === 'project' ? 'info' : 'warn',
      what: e.kind === 'report' ? `${e.title} due` : e.kind === 'contract' ? `${e.title}: staff contract ends` : e.kind === 'activity' ? `${e.title} is late` : 'Project ends', where: plabel(e.p), go: `project/${e.p.id}/${TAB[e.kind]}` });
  }
  // late activities: one line per project, dated by the oldest
  const late = T.filter((t) => t.kind === 'activity'), byP = new Map<string, Todo[]>();
  for (const t of late) byP.set(t.where, [...(byP.get(t.where) ?? []), t]);
  T.splice(0, T.length, ...T.filter((t) => t.kind !== 'activity'), ...[...byP.values()].map((X) => X.length === 1 ? X[0] : { ...X[0], key: `late|${X[0].where}`, when: X.map((x) => x.when!).sort()[0], what: `${X.length} activities past their planned month` }));
  // contracts with providers and the office's own
  const FW = L.frameworks ?? {};
  for (const d of contractsDue(FW, TODAY)) {
    const c = FW[d.key]; if (d.openEnded || d.severity === 'ok' || d.severity === 'ended' || (c.country && !cs.has(c.country))) continue;
    const country = c.country ?? P[0]?.country;
    T.push({ key: `fw|${d.key}`, kind: 'provider', when: d.end, tone: d.days <= 30 ? 'bad' : 'warn', what: `Contract with ${d.name} ends${c.renewBy ? ` · renewable until ${date(c.renewBy)}` : ''}`, where: d.ref ?? (country ? cn(country) : ''), go: country ? `countries/${country}/tenders` : 'countries' });
  }
  // the core team of each country shown
  for (const [cid, M] of Object.entries(L.coreTeam ?? {})) if (cs.has(cid)) for (const x of coreDue(M, TODAY)) if (x.days != null && x.days >= -30 && x.days <= 90)
    T.push({ key: `core|${x.m.id}`, kind: 'core', when: x.m.end, tone: x.days <= 30 ? 'bad' : 'warn', what: `${x.m.name}: core team contract ends`, where: `${x.m.position} · ${cn(cid)}`, go: `countries/${cid}/staff` });
  // what to check, with no date
  for (const p of P) { const n = poToCheck(p); if (n) T.push({ key: `po|${p.id}`, kind: 'po', tone: 'warn', what: `${n} order${n > 1 ? 's' : ''} to check in PO review`, where: plabel(p), go: `project/${p.id}/poreview` }); }
  for (const a of openAlerts(alerts(P, TODAY), L.alertMarks, TODAY).filter((a) => a.severity === 'critical')) {
    const p = P.find((x) => x.id === a.projectId); if (!p) continue;
    T.push({ key: `al|${a.key}`, kind: 'alert', tone: 'bad', what: a.title, where: plabel(p), go: 'reports/alerts' });
  }
  // yearly contracts ending together are one task, not twenty
  const F = fold(T, ['contract', 'core'], (n, X) => {
    const ps = [...new Set(X.map((x) => x.where))];
    // staff contracts: the country's staff page when they are all in one country, else the staff of every project
    const ctry = [...new Set(X.map((x) => P.find((p) => p.id === x.go.split('/')[1])?.country))];
    return { what: `${n} ${X[0].kind === 'core' ? 'core team' : 'staff'} contracts end`, where: ps.length > 3 ? `${ps.slice(0, 3).join(', ')} +${ps.length - 3}` : ps.join(', '),
      go: X[0].kind === 'core' ? X[0].go : ctry.length === 1 && ctry[0] ? `countries/${ctry[0]}/staff` : 'people' };
  });
  const G = todoGroups(F, iso);
  if (!G.length) return null;
  const n = (id: string) => G.find((g) => g.id === id)?.items.length ?? 0;
  return <section class="card span-12 td" aria-label="What needs you now">
    <div class="card-h"><div><h2>What needs you now</h2><p>Reports due, contracts ending, orders to check and urgent alerts from every project and office shown · click a line to go there</p></div>
      <div class="td-n">{n('overdue') > 0 && <span class="badge critical">{n('overdue')} overdue</span>}{n('week') > 0 && <span class="badge serious">{n('week')} this week</span>}</div></div>
    <div class="card-b td-g">{G.map((g) => { const open = all[g.id], R = open ? g.items : g.items.slice(0, 5);
      return <div class={`td-s td-${g.id}`}><h3>{g.label}<small>{g.items.length}</small></h3>
        <ul>{R.map((t) => <li class={`t-${t.tone}`} role="button" tabIndex={0} onClick={() => go(t.go)} onKeyDown={(e) => { if (e.key === 'Enter') go(t.go); }}>
          <i aria-hidden="true" /><span class="td-w">{t.what}<small>{t.where}</small></span>{t.when && <span class="num td-d">{date(t.when)}</span>}</li>)}</ul>
        {g.items.length > 5 && <button class="linkish" onClick={() => setAll({ ...all, [g.id]: !open })}>{open ? 'Show fewer' : `Show all ${g.items.length}`}</button>}</div>; })}</div>
  </section>;
}
