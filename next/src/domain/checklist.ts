import { latestReport } from './calc';
import { health } from './health';
import type { Office } from './office';
import type { Ledger, Project } from './types';
import { plabel } from './label';
import { dmy } from './dt';
import { contractWatch, countryContracts, officeOrders, stillToOrder } from './contractItems';
import { contractGaps } from './contractPlan';

/** One thing to do this month. Items the data can prove are done tick themselves; the rest are ticked by hand. */
export interface Task { key: string; group: 'Data' | 'Reports' | 'Staff' | 'Contracts' | 'Offices' | 'Close the month'; title: string; detail: string; pid?: string; auto?: boolean; done?: boolean; to?: string; due?: string; /** opens the import panel instead of a screen */ importer?: boolean }

const lab = (p: Project) => (plabel(p));
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
    out.push({ key: `extract:${p.id}`, group: 'Data', title: `Load the system extraction for ${lab(p)}`, detail: r ? `latest figures ${dmy(r.date)}` : 'no financial report yet', pid: p.id, auto: true, done: fresh, importer: true });
  }
  for (const p of running) {
    const bad = health(p, today).findings.filter((f) => f.level === 'bad');
    if (bad.length) out.push({ key: `health:${p.id}`, group: 'Data', title: `Fix ${bad.length} data issue${bad.length > 1 ? 's' : ''} in ${lab(p)}`, detail: bad[0].text, pid: p.id, auto: true, done: false, to: 'reports/health' });
  }
  for (const e of ctx.events.filter((e) => e.kind === 'report' && e.day <= soon).slice(0, 20))
    out.push({ key: `report:${e.p.id}:${e.day}`, group: 'Reports', title: `${e.title} — ${lab(e.p)}`, detail: `${e.day < t ? 'overdue since' : 'due'} ${e.day} · ${e.sub}`, pid: e.p.id, due: e.day });
  for (const e of ctx.events.filter((e) => e.kind === 'contract' && e.day <= soon).slice(0, 20))
    out.push({ key: `contract:${e.p.id}:${e.title}:${e.day}`, group: 'Staff', title: `Decide on the contract of ${e.title} (${lab(e.p)})`, detail: `ends ${e.day}${e.sub ? ' · ' + e.sub : ''}`, pid: e.p.id, due: e.day });
  // contracts: renewals and notices to decide, ceilings reached before the end, office lines the forecast under-plans, papers missing
  for (const c of L.countries) {
    const P = L.projects.filter((p) => p.country === c.id), O = (L.offices ?? []).filter((o) => o.country === c.id);
    const CC = countryContracts(L.frameworks ?? {}, P, L.poKinds ?? {}, O, c.id); if (!CC.items.length) continue;
    const W = contractWatch(CC.items, CC.ordersOf, today, 90), at = `countries/${c.id}/contracts`;
    for (const r of W.renew) out.push({ key: `renew:${r.key}:${r.end}`, group: 'Contracts', title: `Decide on the renewal of ${r.name} (${c.name})`, detail: `${r.noticeBy ? `notice by ${dmy(r.noticeBy)} · ` : ''}ends ${dmy(r.end)} · ${r.autoRenew ? 'renews unless notice is given' : r.renewBy ? `renewable until ${dmy(r.renewBy)}` : 'a new contract or tender'}`, due: r.noticeBy ?? r.end, to: at });
    for (const x of W.caps) out.push({ key: `ceiling:${x.key}:${m}`, group: 'Contracts', title: `Check the ceiling of ${x.name} (${c.name})`, detail: `€${x.p.used.toLocaleString('en-GB', { maximumFractionDigits: 0 })} of €${x.p.cap.toLocaleString('en-GB', { maximumFractionDigits: 0 })} ordered — at this pace reached by ${x.p.reach} ${x.p.used >= x.p.cap ? '(already)' : 'before the end'}`, to: at });
    const rep = O[0]?.reports.at(-1);
    if (rep) {
      const need = new Map<string, number>();
      for (const x of CC.items.filter((i) => i.c.line)) { const s = stillToOrder(x.c, officeOrders(rep, x.key, x.c), rep.year), eur = !x.c.cur || x.c.cur === 'EUR'; if (s.months && (eur || x.rate)) need.set(x.c.line!, (need.get(x.c.line!) ?? 0) + (eur ? s.amount : s.amount / x.rate!)); }
      for (const [line, v] of need) { const l = rep.lines.find((y) => y.code === line), planned = l ? l.ob.planned + l.ls.planned : 0;
        if (v > planned + 0.5) out.push({ key: `forecast:${c.id}:${line}:${m}`, group: 'Contracts', title: `Plan line ${line} in the ${O[0].name} forecast`, detail: `the contracts still need about €${Math.round(v).toLocaleString('en-GB')} this year; the forecast plans €${Math.round(planned).toLocaleString('en-GB')}`, to: at }); }
    }
    const G = contractGaps(CC.items);
    if (G.length) out.push({ key: `papers:${c.id}:${m}`, group: 'Contracts', title: `Complete ${G.length} contract${G.length > 1 ? 's' : ''} in ${c.name}`, detail: G.slice(0, 2).map((g) => `${g.name}: ${g.missing[0]}`).join(' · ') + (G.length > 2 ? ' …' : ''), to: at });
  }
  for (const o of L.offices ?? []) {
    const last = o.reports.at(-1)?.date ?? '';
    out.push({ key: `office:${o.id}`, group: 'Offices', title: `Load the office budget of ${o.name}`, detail: last ? `latest situation ${last}` : 'none yet', auto: true, done: ym(last) === m || ym(last) === prev, importer: true });
  }
  for (const r of ctx.officeRequests.filter((x) => x.request > 0))
    out.push({ key: `transfer:${r.o.id}:${r.date}`, group: 'Offices', title: `Send the budget transfer request of ${r.o.name}`, detail: `about €${r.request.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} to request after transfers (situation ${dmy(r.date)})`, to: 'countries' });
  out.push(
    { key: 'close:pack', group: 'Close the month', title: 'Share the monthly pack', detail: 'Reports → Summary → Monthly pack → Save as PDF', to: 'reports/pack' },
    { key: 'close:deck', group: 'Close the month', title: 'Prepare the presentation', detail: 'Reports → Presentation → PowerPoint (management or donor)', to: 'reports/deck' },
    { key: 'close:backup', group: 'Close the month', title: 'Back up the data', detail: 'Import / backup → Back up now; keep the file on the shared drive', importer: true },
  );
  return out;
}
