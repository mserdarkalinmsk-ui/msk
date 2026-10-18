import { latestReport } from './calc';
import { health } from './health';
import type { Office } from './office';
import type { Ledger, Project } from './types';

/** One thing to do this month. Items the data can prove are done tick themselves; the rest are ticked by hand. */
export interface Task { key: string; group: 'Data' | 'Reports' | 'Staff' | 'Offices' | 'Close the month'; title: string; detail: string; pid?: string; auto?: boolean; done?: boolean; to?: string; due?: string; /** opens the import panel instead of a screen */ importer?: boolean }

const lab = (p: Project) => (p.bh ? `BH ${p.bh}` : p.code);
const ym = (d: string) => d.slice(0, 7);

/**
 * The month's checklist from the ledger: a fresh financial report for every running project, open data issues,
 * report deadlines and staff contracts ending soon, office budgets, and the monthly close (pack, presentation, backup).
 */
export function monthTasks(L: Ledger, today: Date, ctx: { events: { day: string; kind: string; p: Project; title: string; sub: string }[]; officeRequests: { o: Office; request: number; date: string }[] }): Task[] {
  const t = today.toISOString().slice(0, 10), m = ym(t);
  const prev = ym(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 15)).toISOString());
  const in45 = new Date(today); in45.setUTCDate(in45.getUTCDate() + 45); const soon = in45.toISOString().slice(0, 10);
  const running = L.projects.filter((p) => !p.datesTbc && p.start <= t && p.end >= ym(t) + '-01');
  const out: Task[] = [];
  for (const p of running) {
    const r = latestReport(p), fresh = !!r && (ym(r.date) === m || ym(r.date) === prev || ym(r.registeredAt ?? '') === m);
    out.push({ key: `extract:${p.id}`, group: 'Data', title: `Load the system extraction for ${lab(p)}`, detail: r ? `latest figures ${r.date}` : 'no financial report yet', pid: p.id, auto: true, done: fresh, importer: true });
  }
  for (const p of running) {
    const bad = health(p, today).findings.filter((f) => f.level === 'bad');
    if (bad.length) out.push({ key: `health:${p.id}`, group: 'Data', title: `Fix ${bad.length} data issue${bad.length > 1 ? 's' : ''} in ${lab(p)}`, detail: bad[0].text, pid: p.id, auto: true, done: false, to: 'reports/health' });
  }
  for (const e of ctx.events.filter((e) => e.kind === 'report' && e.day <= soon).slice(0, 20))
    out.push({ key: `report:${e.p.id}:${e.day}`, group: 'Reports', title: `${e.title} — ${lab(e.p)}`, detail: `${e.day < t ? 'overdue since' : 'due'} ${e.day} · ${e.sub}`, pid: e.p.id, due: e.day });
  for (const e of ctx.events.filter((e) => e.kind === 'contract' && e.day <= soon).slice(0, 20))
    out.push({ key: `contract:${e.p.id}:${e.title}:${e.day}`, group: 'Staff', title: `Decide on the contract of ${e.title} (${lab(e.p)})`, detail: `ends ${e.day}${e.sub ? ' · ' + e.sub : ''}`, pid: e.p.id, due: e.day });
  for (const o of L.offices ?? []) {
    const last = o.reports.at(-1)?.date ?? '';
    out.push({ key: `office:${o.id}`, group: 'Offices', title: `Load the office budget of ${o.name}`, detail: last ? `latest situation ${last}` : 'none yet', auto: true, done: ym(last) === m || ym(last) === prev, importer: true });
  }
  for (const r of ctx.officeRequests.filter((x) => x.request > 0))
    out.push({ key: `transfer:${r.o.id}:${r.date}`, group: 'Offices', title: `Send the budget transfer request of ${r.o.name}`, detail: `about €${r.request.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} to request after transfers (situation ${r.date})`, to: 'offices' });
  out.push(
    { key: 'close:pack', group: 'Close the month', title: 'Share the monthly pack', detail: 'Reports → Summary → Monthly pack → Save as PDF', to: 'reports/pack' },
    { key: 'close:deck', group: 'Close the month', title: 'Prepare the presentation', detail: 'Reports → Presentation → PowerPoint (management or donor)', to: 'reports/deck' },
    { key: 'close:backup', group: 'Close the month', title: 'Back up the data', detail: 'Import / backup → Back up now; keep the file on the shared drive', importer: true },
  );
  return out;
}
