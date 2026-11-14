import { roster } from '../domain/staff';
import { filtered, go, useStore } from '../data/store';
import { attention, elapsed, latestReport, money } from '../domain/calc';
import type { Project } from '../domain/types';
import { wpName } from '../domain/workplan';
import { TODAY } from '../today';
import { date, full, pct, short } from '../ui/format';
import { latestWorkbook } from './FinancialReport';
import { openProject } from './ProjectPage';
import { wpRow } from './WorkPlans';

const today = TODAY.toISOString().slice(0, 10);
const lab = (p: Project) => (p.bh ? `BH ${p.bh}` : p.code);
type Item = { p: Project; slug: string; title: string; detail: string; tone: 'serious' | 'warning' | 'good' | 'neutral' };

/** Home page: what needs doing, grouped, each item opening the right screen of the project. */
export function MyDesk() {
  const s = useStore((x) => x);
  const P = filtered(s).filter((p) => (p.status ?? 'Active') === 'Active');
  const wp: Item[] = [], fin: Item[] = [], data: Item[] = [];
  for (const p of P) {
    const r = wpRow(p);
    if (!r) { if (latestWorkbook(p)) wp.push({ p, slug: 'wp', title: 'No Work Plan entered', detail: 'add this quarter\'s WorkPlan file', tone: 'neutral' }); }
    else if (!(r.wp.from <= today && today <= r.wp.to)) wp.push({ p, slug: 'wp', title: `No Work Plan for this quarter`, detail: `last: ${wpName(r.wp)} to ${date(r.wp.to)}`, tone: 'warning' });
    else if (r.V.level !== 'good') wp.push({ p, slug: 'wp', title: `${wpName(r.wp)} · ${r.V.label}`, detail: r.V.flags[0] ?? '', tone: r.V.level === 'serious' ? 'serious' : 'warning' });
  }
  for (const f of attention(P, TODAY)) {
    const p = P.find((x) => x.id === f.projectId)!;
    const it: Item = { p, slug: f.kind === 'line' ? 'budget' : f.kind === 'risk' ? 'risks' : f.kind === 'stale' ? 'reports' : 'statement', title: f.title, detail: f.detail, tone: f.severity === 'warning' ? 'warning' : 'serious' };
    (f.kind === 'stale' ? data : fin).push(it);
  }
  for (const p of P) { const w = latestWorkbook(p)?.snapshot?.workbook; const n = w?.checks.filter((c) => c.level === 'error').length ?? 0; if (n) data.push({ p, slug: 'finance', title: `${n} check${n > 1 ? 's' : ''} failed in the report`, detail: w?.fileName ?? '', tone: 'serious' }); }
  const col = (key: string, icon: string, title: string, hint: string, items: Item[], all: string) => {
    const hot = items.filter((i) => i.tone === 'serious').length;
    return (
    <section class={`desk-col ${key}`}>
      <header><span class="desk-ic" aria-hidden="true">{icon}</span><div><h3>{title}</h3><p>{hint}</p></div>
        <span class={`desk-count ${hot ? 'hot' : items.length ? 'some' : 'none'}`}>{items.length}</span></header>
      {items.length ? <ul class="desk-list">{items.slice(0, 6).map((i) => <li><button class={`desk-item ${i.tone}`} onClick={() => openProject(i.p.id, i.slug)}><i class="dot" /><b>{lab(i.p)}</b><span>{i.title}</span><small>{i.detail}</small><em>›</em></button></li>)}</ul>
        : <div class="desk-ok"><span>✓</span>All clear</div>}
      <button class="desk-all" onClick={() => go(all)}>{items.length > 6 ? `See all ${items.length}` : 'Open the full list'} →</button>
    </section>); };
  const total = wp.length + fin.length + data.length, hot = [...wp, ...fin, ...data].filter((i) => i.tone === 'serious').length;
  const hour = new Date().getHours();
  return (
    <div class="desk" aria-label="My desk">
      <div class="desk-h"><div><span class="eyebrow">{date(today)} · {P.length} active projects</span><h2>{hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'} — {total ? <>{total} item{total > 1 ? 's' : ''} need{total === 1 ? 's' : ''} your attention</> : 'everything is in order'}</h2></div>
        <div class="desk-pills">{hot ? <span class="pill serious">{hot} urgent</span> : null}<span class="pill">{wp.length} Work Plan</span><span class="pill">{fin.length} budget</span><span class="pill">{data.length} data</span></div></div>
      <div class="desk-grid">
        {col('wp', '◷', 'Work Plans', 'This quarter\'s plans to check', wp, 'reports/wp')}
        {col('fin', '€', 'Budget & spending', 'Overspends, lines above approved, pace', fin, 'reports/alerts')}
        {col('data', '⇪', 'Data to update', 'Reports to load and checks that failed', data, 'reports/health')}
      </div>
    </div>);
}

/** Project summary: one card per area, each opening its screen. */
export function QuickAccess({ p }: { p: Project }) {
  const rep = latestWorkbook(p), wb = rep?.snapshot?.workbook, E = wb?.totals.eligible, r = wpRow(p), m = money(p), last = latestReport(p);
  const warn = wb?.checks.filter((c) => c.level !== 'info').length ?? 0;
  const tile = (slug: string, title: string, big: string, sub: string, tone = '') => <button class={`qa-tile ${tone}`} onClick={() => openProject(p.id, slug)}><span class="t">{title}</span><b>{big || '—'}</b><small>{sub}</small>{tone && tone !== 'good' ? <i class="flag" /> : null}<i class="go">›</i></button>;
  return (
    <section class="span-12 qa"><div class="qa-h"><h3>Go to</h3><span class="muted">every area of the project, one click away</span></div><div class="qa-grid">
      {tile('statement', 'Financial statement', E ? pct(E.budget ? E.actual / E.budget : 0) : pct(m.budget ? m.spent / m.budget : 0), `${short(E?.actual ?? m.spent)} spent · ${pct(elapsed(p, TODAY))} of time`)}
      {tile('wp', 'Work Plan', r ? `${wpName(r.wp)} · ${r.V.label}` : '—', r ? `${full(r.wp.planned)} planned` : 'no Work Plan yet', r ? r.V.level : '')}
      {tile('budget', 'vs approved budget', p.approvedBudget ? short(p.approvedBudget.total) : '—', p.approvedBudget ? 'lines, headings, 25% flexibility' : 'load the approved budget')}
      {tile('checks', 'Entry checks', warn ? String(warn) : '✓', warn ? 'points to review in the report' : 'nothing to review', warn ? 'warning' : 'good')}
      {tile('staff', 'Staff', String(roster(p, TODAY).length), 'contracts, months paid, staff POs')}
      {tile('reports', 'Reports', last ? date(last.date) : '—', last ? last.name : 'no report loaded')}
      {tile('docs', 'Documents', String(p.documents?.length ?? 0), 'DoA, contract, letters')}
      {tile('revision', 'Budget revision', String(p.budgetVersions?.length ?? 0), 'notifications and addenda')}
    </div></section>);
}
