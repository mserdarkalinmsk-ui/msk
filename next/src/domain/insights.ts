import { ADMIN_LINE } from './terms';
import { HEADINGS, attention, riskScore, deadlines, forecastRate, elapsed, lineExposure, lines, money, n, parseDate, planStats, reportsByDate, reportTotals, compareReports, type Severity } from './calc';
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
  const f = forecastRate(p, today);
  const rate = f.rate, basis: Outcome['basis'] = !rate ? 'no data' : f.recent ? 'recent rate' : 'average rate';
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
  forecast: 'Forecast', setup: 'Set-up', contract: 'Staff', deadline: 'Reporting', plan: 'Activities', ending: 'Project end',
};

/** Everything that needs attention across the portfolio: finance, staff, reporting, activities. */
export function alerts(ps: Project[], today: Date): Alert[] {
  const out: Alert[] = attention(ps, today).map((f, i) => ({ ...f, id: `${f.projectId}:${f.kind}:${i}` }));
  for (const p of ps) {
    if (p.status && p.status !== 'Active') continue;
    if (p.datesTbc) { out.push({ id: `${p.id}:setup`, projectId: p.id, kind: 'setup', severity: 'warning', title: 'Set-up incomplete', detail: 'Add the DoA / contract and the approved budget to confirm dates and budget' }); continue; }
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
    for (const h of headings(p).rows) if (h.status === 'breach')
      out.push({ id: `${p.id}:heading:${h.code}`, projectId: p.id, kind: 'line', severity: 'serious', title: `Heading ${h.code} ${h.label} beyond flexibility`, detail: Math.abs(h.change) * 100 > h.overspend * 100 ? `budget changed ${(h.change * 100).toFixed(1)}% from the approved baseline — needs an amendment` : `spent + committed ${(h.overspend * 100).toFixed(1)}% above the approved heading` });
    const left = daysUntil(p.end, today);
    if (left >= 0 && left <= 120) out.push({ id: `${p.id}:ending`, projectId: p.id, kind: 'ending', severity: left <= 45 ? 'serious' : 'warning', title: `Project ends in ${left} days`, detail: p.successor ? `Successor: ${p.successor}` : 'No successor recorded', due: p.end });
  }
  const order: Record<Severity, number> = { critical: 0, serious: 1, warning: 2 };
  return out.sort((a, b) => order[a.severity] - order[b.severity] || (a.due ?? '9').localeCompare(b.due ?? '9'));
}

/* ---------------- narrative ---------------- */
export type Tone = 'good' | 'warn' | 'bad' | 'info';
export interface Point { area: string; tone: Tone; head: string; text: string }
export interface Status { verdict: string; tone: Tone; headline: string; points: Point[]; plain: string }

/** Status built from the figures: a verdict, a headline and short points with a tone each. */
export function status(p: Project, today: Date): Status {
  const m = money(p), el = elapsed(p, today), o = outcome(p, today), P: Point[] = [];
  const burn = m.budget ? m.spent / m.budget : 0, gap = burn - el;
  const tone: Tone = gap < -0.15 || gap > 0.1 || m.remaining < 0 ? 'bad' : gap < -0.05 ? 'warn' : 'good';
  const verdict = m.remaining < 0 ? 'Over budget' : gap < -0.15 ? 'Behind schedule' : gap > 0.1 ? 'Ahead of schedule' : gap < -0.05 ? 'Slightly behind' : 'On track';
  const headline = `${pct(burn)} spent at ${pct(el)} of time`;
  P.push({ area: 'Budget', tone: m.remaining < 0 ? 'bad' : 'info', head: `${eur(m.remaining)} uncommitted`, text: `${eur(m.spent)} spent and ${eur(m.committed)} committed of ${eur(m.budget)}` });
  if (o.basis !== 'no data' && el < 1) {
    const t: Tone = o.overrun > 1 ? 'bad' : o.utilisation < 0.7 ? 'bad' : o.utilisation < 0.9 ? 'warn' : 'good';
    P.push({ area: 'Forecast', tone: t, head: o.overrun > 1 ? `${eur(o.overrun)} over budget at end` : o.unused > 1 ? `${pct(o.utilisation)} of budget used at end` : 'Full budget used at end', text: `${eur(o.rate)}/month now · ${eur(o.needRate)}/month needed to use the remaining budget` });
  }
  const over = lines(p).filter((l) => n(l.approved) && lineExposure(l) > n(l.approved));
  if (over.length) P.push({ area: 'Lines', tone: 'bad', head: `${over.length} line${over.length > 1 ? 's' : ''} over approved`, text: over.slice(0, 4).map((l) => `${l.code} ${l.description ?? ''}`.trim()).join(' · ') });
  const people = roster(p, today), ren = renewals(people, today, 60);
  if (people.length) P.push({ area: 'Staff', tone: ren.length ? 'warn' : 'good', head: `${people.filter((a) => a.status === 'Active').length} on active contracts`, text: ren.length ? `${ren.length} contract${ren.length > 1 ? 's end' : ' ends'} within 60 days` : 'No contract ends within 60 days' });
  const st = planStats(p, today);
  if (st) P.push({ area: 'Activities', tone: st.late ? 'warn' : 'good', head: `${st.done} of ${st.total} done`, text: st.late ? `${st.late} past the planned month · project month ${st.month}` : `None late · project month ${st.month}` });
  const risks = (p.riskRegister ?? []).filter((r) => (r.status ?? 'Open') === 'Open');
  if (risks.length) { const hi = risks.filter((r) => riskScore(r) >= 12).length; P.push({ area: 'Risks', tone: hi ? 'bad' : 'info', head: `${risks.length} open risk${risks.length > 1 ? 's' : ''}`, text: hi ? `${hi} rated high` : 'None rated high' }); }
  const od = deadlines(p, today).filter((d) => d.status === 'overdue');
  if (od.length) P.push({ area: 'Reporting', tone: 'bad', head: `${od.length} report${od.length > 1 ? 's' : ''} overdue`, text: od.map((d) => `${d.kind} due ${d.due}`).join(' · ') });
  const plain = [`${verdict}: ${headline}.`, ...P.map((x) => `${x.area}: ${x.head} (${x.text}).`)].join('\n');
  return { verdict, tone, headline, points: P, plain };
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

/* ---------------- budget heading flexibility ---------------- */
export interface HeadingRow { code: string; label: string; baseline: number; approved: number; exposure: number; change: number; overspend: number; status: 'ok' | 'warn' | 'breach' }

/**
 * Compares each budget heading (1 Human resources, 2 Travel …) of the latest report with the approved
 * baseline. Contracts allow moving money between headings up to a ceiling (25 % in this portfolio) without an
 * amendment; beyond it, or when spent + committed exceeds the heading by more than the ceiling, it is a breach.
 */
type Sums = { baseline: number; approved: number; exposure: number };
export function headings(p: Project): { flex: number; rows: HeadingRow[]; direct: Sums; admin: Sums; contingency: number; total: Sums } {
  // Heading flexibility: 25% between headings (portfolio rule), unless the project sets its own.
  const flex = (Number((p as { flexPct?: number }).flexPct) || 25) / 100;
  const base = p.approvedBudget?.lines ?? [];
  const cur = lines(p);
  const key = (c: string) => c.split('.')[0];
  const codes = [...new Set([...base, ...cur].map((l) => key(l.code)))].filter((c) => HEADINGS[c] && c !== ADMIN_LINE && c !== '8').sort((a, b) => +a - +b);
  const sum = (L: typeof cur, c: string, f: (l: (typeof cur)[number]) => number) => L.filter((l) => key(l.code) === c).reduce((s, l) => s + f(l), 0);
  const rows = codes.map((c) => {
    const inCur = cur.some((l) => key(l.code) === c);
    const baseline = sum(base.length ? base : cur, c, (l) => n(l.approved)), approved = inCur ? sum(cur, c, (l) => n(l.approved)) : baseline, exposure = sum(cur, c, lineExposure);
    const change = baseline ? (approved - baseline) / baseline : 0, overspend = baseline ? exposure / baseline - 1 : 0;
    const status: HeadingRow['status'] = Math.abs(change) > flex || overspend > flex ? 'breach' : Math.abs(change) > flex * 0.7 || overspend > 0 ? 'warn' : 'ok';
    return { code: c, label: HEADINGS[c], baseline, approved, exposure, change, overspend, status };
  });
  const ab = p.approvedBudget, admCur = sum(cur, '10', (l) => n(l.approved)), admExp = sum(cur, '10', lineExposure);
  const direct = { baseline: rows.reduce((s, r) => s + r.baseline, 0), approved: rows.reduce((s, r) => s + r.approved, 0), exposure: rows.reduce((s, r) => s + r.exposure, 0) };
  const adm8 = base.filter((l) => key(l.code) === '8' && /admin|indirect/i.test(l.description ?? '')).reduce((a, l) => a + n(l.approved), 0);
  const admin = { baseline: ab?.admin || (base.length ? sum(base, '10', (l) => n(l.approved)) : 0) || adm8 || admCur, approved: admCur || ab?.admin || 0, exposure: admExp };
  // Line 8 is the contingency reserve in some templates and administrative costs in others (7/8/9 layout):
  // count it as contingency only when its wording says so and it is not the admin amount again.
  const l8 = [...base, ...cur].filter((l) => key(l.code) === '8');
  const l8IsCont = l8.some((l) => /contingen/i.test(l.description ?? '')) && !l8.some((l) => /admin|indirect/i.test(l.description ?? ''));
  const c0 = ab?.contingency ?? (l8IsCont ? sum(base.length ? base : cur, '8', (l) => n(l.approved)) : 0);
  const contingency = c0 && Math.abs(c0 - admin.baseline) > 1 ? c0 : 0;
  const total = { baseline: direct.baseline + admin.baseline + contingency, approved: direct.approved + admin.approved + contingency, exposure: direct.exposure + admin.exposure };
  return { flex, rows, direct, admin, contingency, total };
}

/* ---------------- set-up completeness ---------------- */
export interface ReadyItem { key: string; label: string; done: boolean; hint: string }

/** What is on file for a project, in the order it is usually collected. */
export function readiness(p: Project): { items: ReadyItem[]; score: number } {
  const c = (p.contract ?? {}) as Record<string, unknown>;
  const items: ReadyItem[] = [
    { key: 'ids', label: 'Identifiers', done: !!(p.bh && (p.contractNo || p.jp)), hint: 'BH and contract / JP number' },
    { key: 'dates', label: 'Implementation period', done: !p.datesTbc, hint: 'from the DoA or contract' },
    { key: 'budget', label: 'Approved budget', done: !!p.approvedBudget, hint: 'budget annex (PDF / Excel)' },
    { key: 'notes', label: 'Budget justification', done: !!p.budgetNotes && Object.keys(p.budgetNotes).length > 0, hint: 'clarification & justification table' },
    { key: 'contract', label: 'Contract terms', done: !!(c.repMonths || c.progDays || c.flexPct || c.prefin), hint: 'reporting, flexibility, pre-financing' },
    { key: 'plan', label: 'Action plan', done: !!p.doa?.acts.length, hint: 'activities by month' },
    { key: 'logframe', label: 'Logframe', done: !!p.indicators?.length, hint: 'indicators, baselines, targets' },
    { key: 'risks', label: 'Risk register', done: !!p.riskRegister?.length, hint: 'from the DoA' },
    { key: 'report', label: 'Financial report', done: !!p.reportingPeriods?.some((r) => r.snapshot?.lines?.length), hint: 'latest report workbook' },
    { key: 'staff', label: 'Staff', done: roster(p, new Date()).length > 0, hint: 'read from the report workbook' },
  ];
  return { items, score: items.filter((i) => i.done).length / items.length };
}
