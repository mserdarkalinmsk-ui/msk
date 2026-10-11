import { useState } from 'preact/hooks';
import { filtered, go, useStore } from '../data/store';
import { addMonths, deadlines, planStats } from '../domain/calc';
import { roster } from '../domain/staff';
import type { Project } from '../domain/types';
import { TODAY } from '../today';
import { date, month } from '../ui/format';
import { downloadIcs } from '../ui/WeekDigest';

type Kind = 'report' | 'contract' | 'activity' | 'project';
export interface Ev { day: string; kind: Kind; p: Project; title: string; sub: string; tone: 'bad' | 'warn' | 'info' | 'good' }
const KIND: Record<Kind, { label: string; color: string; tab?: string }> = {
  report: { label: 'Reports', color: '#e5484d', tab: 'Reports' },
  contract: { label: 'Staff contracts', color: '#8e4ec6', tab: 'Staff' },
  activity: { label: 'Activities', color: '#f5a524', tab: 'Activity plan' },
  project: { label: 'Project ends', color: '#3b82c4' },
};
const lab = (p: Project) => (p.bh ? `BH ${p.bh}` : p.code);

/** Everything with a date: report deadlines, staff contract ends, planned activity ends and project end dates. */
export function events(P: Project[]): Ev[] {
  const out: Ev[] = [];
  const now = TODAY.toISOString().slice(0, 10);
  for (const p of P) {
    for (const d of deadlines(p, TODAY)) if (d.status !== 'submitted') out.push({ day: d.due, kind: 'report', p, title: d.kind, sub: `period to ${date(d.periodEnd)}`, tone: d.status === 'overdue' ? 'bad' : d.status === 'due' ? 'warn' : 'info' });
    for (const a of roster(p, TODAY)) if (a.status === 'Active' && a.end && a.end >= now) out.push({ day: a.end, kind: 'contract', p, title: a.display, sub: a.position ?? '', tone: 'warn' });
    if (!p.datesTbc) {
      for (const a of planStats(p, TODAY)?.acts ?? []) if (!a.done && a.plannedEnd > 0) {
        const day = addMonths(p.start, a.plannedEnd).slice(0, 10);
        out.push({ day, kind: 'activity', p, title: `${a.code} ${a.name}`, sub: a.late ? 'late' : 'planned end', tone: a.late ? 'bad' : 'info' });
      }
      out.push({ day: p.end, kind: 'project', p, title: 'Project ends', sub: p.name, tone: 'info' });
    }
  }
  return out.sort((a, b) => a.day.localeCompare(b.day));
}

export function Agenda() {
  const s = useStore((x) => x);
  const P = filtered(s);
  const [on, setOn] = useState<Record<Kind, boolean>>({ report: true, contract: true, activity: true, project: true });
  const [span, setSpan] = useState(6);
  const E = events(P).filter((e) => on[e.kind]);
  const now = TODAY.toISOString().slice(0, 7);
  const overdue = E.filter((e) => e.day.slice(0, 7) < now && e.tone === 'bad');
  const months = Array.from({ length: span }, (_, i) => addMonths(now + '-01', i).slice(0, 7));
  const open = (e: Ev) => { go(`project/${e.p.id}`); const t = KIND[e.kind].tab; if (t) setTimeout(() => dispatchEvent(new CustomEvent('pl-tab', { detail: t })), 60); };
  const chip = (e: Ev) => (
    <button class={`ag-e t-${e.tone}`} style={{ borderLeftColor: KIND[e.kind].color }} onClick={() => open(e)} title={`${lab(e.p)} · ${e.title} · ${date(e.day)}`}>
      <span class="num ag-d">{e.day.slice(8, 10)}</span><b>{lab(e.p)}</b><span class="ag-t">{e.title}</span><small class="muted">{e.sub}</small>
    </button>);
  return (
    <section class="card">
      <div class="card-h" style={{ alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}><div><h2>Calendar</h2><p>Report deadlines, staff contract ends, planned activity ends and project end dates · click an item to open it</p></div>
        <div class="tools" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginLeft: 'auto' }}>
          {(Object.keys(KIND) as Kind[]).map((k) => <button class="chip" aria-pressed={on[k]} onClick={() => setOn({ ...on, [k]: !on[k] })}><i class="ag-dot" style={{ background: KIND[k].color }} />{KIND[k].label}</button>)}
          <button class="btn" onClick={() => downloadIcs(E.filter((e) => e.day >= TODAY.toISOString().slice(0, 10)))} title="Import into Outlook, Google or phone calendar">📅 .ics</button>
          <div class="seg">{[3, 6, 12].map((n) => <button aria-pressed={span === n} onClick={() => setSpan(n)}>{n} mo</button>)}</div>
        </div></div>
      <div class="card-b">
        {overdue.length > 0 && <div class="ag-over"><h3>Overdue</h3><div class="ag-list">{overdue.map(chip)}</div></div>}
        <div class="ag-grid">{months.map((m) => { const X = E.filter((e) => e.day.slice(0, 7) === m); return (
          <div class={`ag-m${m === now ? ' cur' : ''}`}>
            <div class="ag-h"><b>{month(m + '-01')}</b><span class="ag-n">{(Object.keys(KIND) as Kind[]).map((k) => { const c = X.filter((e) => e.kind === k).length; return c ? <span style={{ background: KIND[k].color }}>{c}</span> : null; })}</span></div>
            <div class="ag-list">{X.length ? X.map(chip) : <p class="muted" style={{ fontSize: '12px', margin: '4px 0' }}>Nothing scheduled</p>}</div>
          </div>); })}</div>
      </div>
    </section>
  );
}
