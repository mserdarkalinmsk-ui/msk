import { attention, deadlines, elapsed, lineExposure, lines, money, n, parseDate, planStats, recentRate, reportsByDate, reportTotals, compareReports, type Severity } from './calc';
import { daysUntil, renewals, roster } from './staff';
import type { Ledger, Project } from './types';

const DAY = 86_400_000;
const pct = (x: number) => `${Math.round(x * 100)}%`;
const eur = (x: number) => `€${Math.round(x).toLocaleString('en-GB')}`;

/* ---------------- end-of-project forecast ---------------- */
export interface Outcome { projected: number; utilisation: number; unused: number; overrun: number; monthsLeft: number; rate: number; needRate: number; basis: 'recent rate' | 'average rate' | 'no data' }

/**
 * Projects spend at the end date: actual spend so far plus the recent monthly rate
 * (falls back to the average rate since start) over the remaining months.
 * Open commitments are assumed to be paid within that period.
 */
export function outcome(p: Project, today: Date): Outcome {
  const m = money(p);
  const end = parseDate(p.end).getTime(), start = parseDate(p.start).getTime();
  const monthsLeft = Math.max(0, (end - Math.max(today.getTime(), start)) / DAY / 30.4375);
  let rate = recentRate(p), basis: Outcome['basis'] = 'recent rate';
  if (!rate) {
    const done = (Math.min(today.getTime(), end) - start) / DAY / 30.4375;
    rate = done > 0 ? m.spent / done : 0; basis = rate ? 'average rate' : 'no data';
  }
  const projected = Math.max(m.exposure, m.spent + rate * monthsLeft);
  const capped = Math.min(projected, m.budget);
  return {
    projected, utilisation: m.budget ? projected / m.budget : 0, unused: Math.max(0, m.budget - capped), overrun: Math.max(0, projected - m.budget),
    monthsLeft, rate, needRate: monthsLeft > 0 ? Math.max(0, m.budget - m.spent) / monthsLeft : 0, basis,
  };
}

/* ---------------- alert centre ---------------- */
export interface Alert { id: string; projectId: string; severity: Severity; kind: string; title: string; detail: string; due?: string }

export const ALERT_KINDS: Record<string, string> = {
  underspend: 'Pacing', overspend: 'Pacing', overbudget: 'Budget', line: 'Budget', stale: 'Reporting', risk: 'Risk',
  forecast: 'Forecast', contract: 'Staff', deadline: 'Reporting', plan: 'Activities', ending: 'Project end',
};

/** Everything that needs attention across the portfolio: finance, staff, reporting, activities. */
export function alerts(ps: Project[], today: Date): Alert[] {
  const out: Alert[] = attention(ps, today).map((f, i) => ({ ...f, id: `${f.projectId}:${f.kind}:${i}` }));
  for (const p of ps) {
    if (p.status && p.status !== 'Active') continue;
    const o = outcome(p, today), el = elapsed(p, today);
    if (el > 0.25 && o.basis !== 'no data' && o.utilisation < 0.85)
      out.push({ id: `${p.id}:forecast`, projectId: p.id, kind: 'forecast', severity: o.utilisation < 0.7 ? 'serious' : 'warning', title: `Forecast to use ${pct(o.utilisation)} of budget`, detail: `${eur(o.unused)} may stay unused at the current rate; ${eur(o.needRate)}/month needed` });
    if (o.overrun > 1) out.push({ id: `${p.id}:forecast-over`, projectId: p.id, kind: 'forecast', severity: 'serious', title: 'Forecast exceeds budget', detail: `${eur(o.overrun)} over at the current rate` });
    for (const a of renewals(roster(p, today), today, 90))
      out.push({ id: `${p.id}:contract:${a.key}`, projectId: p.id, kind: 'contract', severity: daysUntil(a.end, today) <= 30 ? 'serious' : 'warning', title: `Contract ends: ${a.display}`, detail: `${a.position} · ${daysUntil(a.end, today)} days`, due: a.end });
    for (const d of deadlines(p, today))
      if (d.status === 'overdue' || d.status === 'due')
        out.push({ id: `${p.id}:deadline:${d.due}`, projectId: p.id, kind: 'deadline', severity: d.status === 'overdue' ? 'critical' : 'warning', title: `${d.kind} ${d.status}`, detail: `Period to ${d.periodEnd}`, due: d.due });
    const ps_ = planStats(p, today);
    if (ps_ && ps_.late) out.push({ id: `${p.id}:plan`, projectId: p.id, kind: 'plan', severity: ps_.late > 3 ? 'serious' : 'warning', title: `${ps_.late} activit${ps_.late > 1 ? 'ies' : 'y'} past planned month`, detail: `${ps_.done}/${ps_.total} done in month ${ps_.month}` });
    const left = daysUntil(p.end, today);
    if (left >= 0 && left <= 120) out.push({ id: `${p.id}:ending`, projectId: p.id, kind: 'ending', severity: left <= 45 ? 'serious' : 'warning', title: `Project ends in ${left} days`, detail: p.successor ? `Successor: ${p.successor}` : 'No successor recorded', due: p.end });
  }
  const order: Record<Severity, number> = { critical: 0, serious: 1, warning: 2 };
  return out.sort((a, b) => order[a.severity] - order[b.severity] || (a.due ?? '9').localeCompare(b.due ?? '9'));
}

/* ---------------- narrative ---------------- */
/** Plain-language status sentences generated from the figures. */
export function narrative(p: Project, today: Date): string[] {
  const m = money(p), el = elapsed(p, today), o = outcome(p, today), S: string[] = [];
  const burn = m.budget ? m.spent / m.budget : 0, gap = burn - el;
  S.push(`${pct(burn)} of the ${eur(m.budget)} budget is spent at ${pct(el)} of the implementation period${Math.abs(gap) < 0.05 ? ', in line with time' : gap < 0 ? ` — ${Math.round(-gap * 100)} points behind time` : ` — ${Math.round(gap * 100)} points ahead of time`}.`);
  if (m.committed > 0) S.push(`A further ${eur(m.committed)} is committed, leaving ${eur(m.remaining)} uncommitted.`);
  if (o.basis !== 'no data' && el < 1) S.push(`At ${o.basis === 'recent rate' ? 'the recent' : 'the average'} rate of ${eur(o.rate)}/month the project would close at ${pct(o.utilisation)} of budget${o.unused > 1 ? ` (${eur(o.unused)} unused)` : o.overrun > 1 ? ` (${eur(o.overrun)} over)` : ''}.`);
  const over = lines(p).filter((l) => n(l.approved) && lineExposure(l) > n(l.approved));
  if (over.length) S.push(`${over.length} budget line${over.length > 1 ? 's are' : ' is'} over the approved amount (${over.slice(0, 3).map((l) => l.code).join(', ')}).`);
  const people = roster(p, today), ren = renewals(people, today, 60);
  const active = people.filter((a) => a.status === 'Active').length;
  if (people.length) S.push(`${active} staff on active contracts${ren.length ? `; ${ren.length} contract${ren.length > 1 ? 's end' : ' ends'} within 60 days` : ''}.`);
  const st = planStats(p, today);
  if (st) S.push(`Activity plan: ${st.done} of ${st.total} done, ${st.late} past the planned month (project month ${st.month}).`);
  const risks = (p.riskRegister ?? []).filter((r) => (r.status ?? 'Open') === 'Open').length;
  if (risks) S.push(`${risks} open risk${risks > 1 ? 's' : ''} in the register.`);
  const od = deadlines(p, today).filter((d) => d.status === 'overdue');
  if (od.length) S.push(`${od.length} report${od.length > 1 ? 's are' : ' is'} overdue.`);
  return S;
}

/* ---------------- period comparison ---------------- */
export interface PeriodChange { project: Project; from?: string; to?: string; spent: [number, number]; exposure: [number, number]; budget: [number, number]; lines: number; note: string[] }

/** What changed between each project's latest report and the one before it (or before `since`). */
export function changes(ps: Project[], since?: string): PeriodChange[] {
  const out: PeriodChange[] = [];
  for (const p of ps) {
    const R = reportsByDate(p).filter((r) => r.snapshot?.lines?.length);
    const b = R.at(-1); if (!b) continue;
    const a = since ? R.filter((r) => r.date <= since).at(-1) : R.at(-2);
    if (a === b) continue;
    const A = a ? reportTotals(a) : { approved: 0, actual: 0, exposure: 0 }, B = reportTotals(b);
    const D = a ? compareReports(a, b).filter((d) => d.status !== 'same') : [];
    const note: string[] = [];
    if (!a) note.push('first report');
    if (a && Math.abs(B.approved - A.approved) > 1) note.push('budget revised');
    const added = D.filter((d) => d.status === 'added').length; if (added) note.push(`${added} new line${added > 1 ? 's' : ''}`);
    out.push({ project: p, from: a?.date, to: b.date, spent: [A.actual, B.actual], exposure: [A.exposure, B.exposure], budget: [A.approved, B.approved], lines: D.length, note });
  }
  return out.sort((x, y) => (y.spent[1] - y.spent[0]) - (x.spent[1] - x.spent[0]));
}

/* ---------------- budget revision scenario ---------------- */
export interface ScenarioRow { code: string; description: string; approved: number; exposure: number; delta: number; revised: number; share: number; flag?: string }

/**
 * Applies proposed changes to the latest approved amounts. Flags lines whose revised
 * budget falls below money already spent or committed, and transfers above `limit`
 * of the line (default 10 %, a common threshold for needing a contract amendment).
 */
export function scenario(p: Project, delta: Record<string, number>, limit = 0.1) {
  const rows: ScenarioRow[] = lines(p).map((l) => {
    const approved = n(l.approved), d = n(delta[l.code]), revised = approved + d, exposure = lineExposure(l);
    const share = approved ? d / approved : d ? 1 : 0;
    const flag = revised < exposure - 0.5 ? 'below spent + committed' : Math.abs(share) > limit ? `change above ${Math.round(limit * 100)}% of line` : undefined;
    return { code: l.code, description: l.description ?? '', approved, exposure, delta: d, revised, share, flag };
  });
  const tot = (f: (r: ScenarioRow) => number) => rows.reduce((s, r) => s + f(r), 0);
  const net = tot((r) => r.delta);
  return { rows, approved: tot((r) => r.approved), revised: tot((r) => r.revised), net, moved: tot((r) => Math.max(0, r.delta)), balanced: Math.abs(net) < 0.5, flags: rows.filter((r) => r.flag).length };
}

/* ---------------- old backups ---------------- */
/** Accepts this app's ledger or a backup from the previous app ({ app, state: { projects, countries, … } }). */
export function migrateBackup(x: unknown): { ledger: unknown; from: 'current' | 'previous app' } {
  const o = x as { app?: string; state?: Record<string, unknown> } & Record<string, unknown>;
  if (o && typeof o === 'object' && o.state && typeof o.state === 'object' && Array.isArray((o.state as { projects?: unknown }).projects)) {
    const s = o.state as { projects: Project[]; countries?: Ledger['countries']; log?: { at?: string; t?: string; text?: string; msg?: string }[] };
    return { from: 'previous app', ledger: { countries: s.countries ?? [], projects: s.projects, audit: (s.log ?? []).slice(0, 300).map((e) => ({ at: e.at ?? e.t ?? '', message: e.text ?? e.msg ?? String(e) })) } };
  }
  return { ledger: x, from: 'current' };
}
