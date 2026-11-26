import { filtered, useStore } from '../data/store';
import { addMonths, deadlines, planStats } from '../domain/calc';
import { roster } from '../domain/staff';
import type { Project } from '../domain/types';
import { TODAY } from '../today';
import { date } from '../ui/format';
import { CalendarView, type CalItem, type CalKind } from '../ui/CalendarView';
import { providerPOs, supKey } from '../domain/providers';
import { daysUntil } from '../domain/staff';
import type { CoreMember } from '../domain/coreTeam';
import type { Contract } from '../domain/contracts';
import { downloadIcs } from '../ui/WeekDigest';
import { plabel } from '../domain/label';

type Kind = 'report' | 'contract' | 'activity' | 'project';
export interface Ev { day: string; kind: Kind; p: Project; title: string; sub: string; tone: 'bad' | 'warn' | 'info' | 'good' }
const lab = (p: Project) => (plabel(p));

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

/** The kinds of the calendar, in the order of their entries on a day. */
export const CAL_KINDS: CalKind[] = [
  { k: 'report', label: 'Reports due', color: 'var(--c1)', many: (n) => `${n} reports due` },
  { k: 'contract', label: 'Staff contracts end', color: 'var(--c4)', many: (n) => `${n} staff contracts end` },
  { k: 'core', label: 'Core team contracts end', color: 'var(--c7)', many: (n) => `${n} core team contracts end` },
  { k: 'provider', label: 'Provider contracts end', color: 'var(--c3)', many: (n) => `${n} provider contracts end` },
  { k: 'activity', label: 'Activities end', color: 'var(--c2)', many: (n) => `${n} activities end` },
  { k: 'project', label: 'Projects end', color: 'var(--ink-2)', many: (n) => `${n} projects end` },
];
/** Every dated item of these projects and of the core teams and provider contracts of their countries. */
export function calItems(P: Project[], cores: [string, CoreMember[]][], FW: Record<string, Contract>, set: Record<string, string>): CalItem[] {
  const names = new Map(providerPOs(P, set).map((x) => [supKey(x.supplier), x.supplier.trim()]));
  const cs = new Set(P.map((p) => p.country)), countryOf = (k: string) => P.find((p) => providerPOs([p], set).some((x) => supKey(x.supplier) === k))?.country;
  const TAB: Record<string, string> = { report: 'reports', contract: 'staff', activity: 'plan', project: 'summary' };
  const soon = (d: string) => (daysUntil(d, TODAY) <= 30 ? 'bad' as const : 'warn' as const);
  return [
    ...events(P).map((e) => ({ day: e.day, kind: e.kind, title: e.kind === 'report' ? `${lab(e.p)} · ${e.title} due` : e.kind === 'contract' ? e.title : e.kind === 'activity' ? `${lab(e.p)} · ${e.title}` : `${lab(e.p)} ends`,
      sub: e.kind === 'contract' ? `${lab(e.p)} · ${e.sub}` : e.sub, where: lab(e.p), tone: e.tone === 'bad' ? 'bad' as const : e.tone === 'warn' ? 'warn' as const : 'info' as const, go: `project/${e.p.id}/${TAB[e.kind]}` })),
    ...cores.flatMap(([cid, M]) => M.filter((m) => m.end).map((m) => ({ day: m.end!, kind: 'core', title: m.name, sub: m.position, where: 'core team', tone: soon(m.end!), go: `countries/${cid}/people` }))),
    ...Object.entries(FW).filter(([k, f]) => f.end && (names.has(k) || (f.country && cs.has(f.country)))).flatMap(([k, f]) => { const c = f.country ?? countryOf(k), n = f.name || names.get(k) || k, to = c ? `countries/${c}/contracts` : 'countries';
      return [{ day: f.end!, kind: 'provider', title: `${n} — contract ends`, sub: f.ref, where: n, tone: soon(f.end!), go: to },
        ...(f.renewBy ? [{ day: f.renewBy, kind: 'provider', title: `${n} — last renewal date`, sub: f.ref, where: n, tone: 'info' as const, go: to }] : []),
        // the last day to give notice (to stop it, or to ask for its renewal)
        ...(f.noticeDays ? [{ day: new Date(Date.parse(f.end!) - f.noticeDays * 864e5).toISOString().slice(0, 10), kind: 'provider', title: `${n} — last day to give notice`, sub: `${f.noticeDays} days before the end${f.autoRenew ? ' · renews automatically otherwise' : ''}`, where: n, tone: soon(new Date(Date.parse(f.end!) - f.noticeDays * 864e5).toISOString().slice(0, 10)), go: to }] : [])]; }),
  ];
}

export function Agenda() {
  const s = useStore((x) => x);
  const P = filtered(s);
  const cs = new Set(P.map((p) => p.country));
  const items = calItems(P, Object.entries(s.ledger.coreTeam ?? {}).filter(([c]) => cs.has(c)), s.ledger.frameworks ?? {}, s.ledger.poKinds ?? {});
  const E = events(P);
  return <CalendarView items={items} kinds={CAL_KINDS} title="Calendar"
    extra={<button class="btn" onClick={() => downloadIcs(E.filter((e) => e.day >= TODAY.toISOString().slice(0, 10)))} title="Import into Outlook, Google or a phone calendar">Add to my calendar (.ics)</button>} />;
}
