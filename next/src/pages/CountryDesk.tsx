import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { contractAlerts, contractsDue, dueText, SEV_BADGE, type ContractDue } from '../domain/contracts';
import { go, isAdmin, setFramework, useStore } from '../data/store';
import { burnGap, money } from '../domain/calc';
import { plabel } from '../domain/label';
import { officeView, type Office } from '../domain/office';
import { providerPOs, providerSummary, suppliers, supKey, KINDS } from '../domain/providers';
import { paceTone } from '../domain/rules';
import { daysUntil, renewals } from '../domain/staff';
import type { Project } from '../domain/types';
import { TODAY } from '../today';
import { date, full, pct, short, signedPct } from '../ui/format';
import { events, type Ev } from './Agenda';
import { allPeople, StaffBoard } from './People';
import { ProviderBrief } from './Providers';

/** The tabs of a country under Offices: the office's own budget sits in Finance, the rest gathers the country's projects. */
export const DESK_TABS = ['Overview', 'Finance', 'Projects', 'Tenders & suppliers', 'Staff', 'Deadlines'] as const;
export type DeskTab = (typeof DESK_TABS)[number];

const now = () => TODAY.toISOString().slice(0, 10);
const active = (p: Project) => p.start <= now() && p.end >= now();
const KIND_LABEL: Record<Ev['kind'], string> = { report: 'Report due', contract: 'Staff contract ends', activity: 'Activity ends', project: 'Project ends' };
const open = (p: Project, slug = '') => go(`project/${p.id}${slug ? '/' + slug : ''}`);

/** One coloured tile; a click opens its tab. */
function Tile({ k, color, icon, label, value, sub, onClick }: { k: string; color: string; icon: string; label: string; value: ComponentChildren; sub: ComponentChildren; onClick?: () => void }) {
  return <button class={`po-k cd-k cd-${k}`} style={{ '--k': color } as never} onClick={onClick}>
    <span class="po-k-h"><i aria-hidden="true">{icon}</i>{label}</span><b>{value}</b><em>{sub}</em><span class="po-k-bar" aria-hidden="true"><u class="none" style={{ flex: 1 }} /></span></button>;
}

export function CountryOverview({ name, cid, P, offices, setTab }: { name: string; cid: string; P: Project[]; offices: Office[]; setTab: (t: DeskTab) => void }) {
  const set = useStore((s) => s.ledger.poKinds) ?? {};
  const A = P.filter(active), M = P.map(money);
  const budget = M.reduce((a, m) => a + m.budget, 0), spent = M.reduce((a, m) => a + m.spent, 0);
  const people = allPeople(P).filter((a) => a.status === 'Active'), ending = renewals(people, TODAY, 60);
  const S = providerSummary(P, set, 3);
  const E = events(P).filter((e) => e.day >= now() && daysUntil(e.day, TODAY) <= 90), late = events(P).filter((e) => e.kind === 'report' && e.tone === 'bad');
  const FW = useStore((s) => s.ledger.frameworks) ?? {}, mine = new Set(providerPOs(P, set).map((x) => supKey(x.supplier)));
  const due = contractAlerts(contractsDue(Object.fromEntries(Object.entries(FW).filter(([k, c]) => mine.has(k) || c.country === cid)), TODAY));
  const off = offices.map((o) => officeView(o.reports.at(-1)!).T).reduce((a, T) => ({ b: a.b + T.ob.budget + T.ls.budget, sc: a.sc + T.ob.sc + T.ls.sc }), { b: 0, sc: 0 });
  return <>
    <div class="po-kpi cd-kpi">
      <Tile k="fin" color="var(--c1)" icon="€" label="Office budget" value={offices.length ? short(off.b) : '—'} sub={offices.length ? `${pct(off.b ? off.sc / off.b : 0)} used · ${offices.length} office${offices.length > 1 ? 's' : ''}` : 'no office budget imported'} onClick={() => setTab('Finance')} />
      <Tile k="prj" color="var(--c3)" icon="▦" label="Projects" value={`${A.length}`} sub={P.length ? `${A.length} running of ${P.length} · ${short(spent)} of ${short(budget)} spent` : 'no project in this country'} onClick={() => setTab('Projects')} />
      <Tile k="ten" color="var(--c4)" icon="⚑" label="Tenders & suppliers" value={S.total ? short(S.total) : '—'} sub={<>{due.length ? <strong>{due.length} contract{due.length > 1 ? 's' : ''} ending soon · </strong> : ''}{S.total ? `${S.providers} providers · ${S.pos} orders` : 'no service-provider order yet'}</>} onClick={() => setTab('Tenders & suppliers')} />
      <Tile k="stf" color="var(--c7)" icon="☺" label="Staff" value={`${people.length}`} sub={people.length ? `${ending.length} contract${ending.length === 1 ? '' : 's'} ending within 60 days` : 'no staff contract on file'} onClick={() => setTab('Staff')} />
      <Tile k="dl" color="var(--c8)" icon="◷" label="Deadlines" value={`${E.length}`} sub={`in the next 90 days${late.length ? ` · ${late.length} report${late.length > 1 ? 's' : ''} overdue` : ''}`} onClick={() => setTab('Deadlines')} />
    </div>
    <div class="grid g-12" style={{ marginTop: '4px' }}>
      <section class="card span-12"><div class="card-h"><div><h2>Projects in {name}</h2><p>Spent against budget and against time · click a project to open it</p></div></div>
        <div class="card-b"><ProjectRows P={P} limit={8} /></div></section>
      <section class="card span-12"><div class="card-h"><div><h2>Coming up</h2><p>The next 90 days: reports, contracts, activities and project ends</p></div></div>
        <div class="card-b">{E.length ? <ul class="cd-ev two">{E.slice(0, 12).map((e) => <EvRow e={e} />)}</ul> : <p class="muted">Nothing dated in the next 90 days.</p>}</div></section>
    </div>
  </>;
}

function EvRow({ e }: { e: Ev }) {
  const d = daysUntil(e.day, TODAY);
  return <li class={`cd-e t-${e.tone}`} onClick={() => open(e.p, e.kind === 'contract' ? 'staff' : e.kind === 'report' ? 'reports' : '')}>
    <span class="num cd-d">{date(e.day)}</span><span><b>{plabel(e.p)}</b> · {KIND_LABEL[e.kind]}<small class="muted">{e.title !== 'Project ends' ? ` · ${e.title}` : ''}</small></span>
    <span class={`badge ${d < 0 ? 'critical' : d <= 30 ? 'serious' : d <= 60 ? 'warning' : 'neutral'}`}>{d < 0 ? `${-d} d late` : d === 0 ? 'today' : `${d} d`}</span></li>;
}

function ProjectRows({ P, limit }: { P: Project[]; limit?: number }) {
  if (!P.length) return <p class="muted">No project in this country.</p>;
  const L = [...P].sort((a, b) => Number(active(b)) - Number(active(a)) || a.end.localeCompare(b.end)).slice(0, limit);
  return <div class="table-scroll"><table class="mini cd-t"><thead><tr><th>Project</th><th>Status</th><th>Ends</th><th class="r">Budget</th><th class="r">Spent</th>{!limit && <th class="r">Committed</th>}<th>Spent vs time</th></tr></thead>
    <tbody>{L.map((p) => { const m = money(p), g = burnGap(p, TODAY), u = m.budget ? m.spent / m.budget : 0;
      return <tr class="click" onClick={() => open(p)}><td><b>{plabel(p)}</b><small class="muted cd-n">{p.name}</small></td>
        <td><span class={`badge ${active(p) ? 'good' : 'neutral'}`}>{active(p) ? 'Running' : p.end < now() ? 'Ended' : 'Not started'}</span></td>
        <td class="num" style={{ whiteSpace: 'nowrap' }}>{date(p.end)}</td><td class="r num">{limit ? short(m.budget) : full(m.budget)}</td><td class="r num">{limit ? short(m.spent) : full(m.spent)}</td>{!limit && <td class="r num">{full(m.committed)}</td>}
        <td><span class="cd-bar"><i style={{ width: `${Math.min(100, u * 100)}%` }} /></span> <span class={`badge ${paceTone(g)}`}>{p.datesTbc ? 'dates tbc' : signedPct(g)}</span></td></tr>; })}</tbody></table></div>;
}

export function CountryProjects({ name, P }: { name: string; P: Project[] }) {
  const M = P.map(money), t = (f: 'budget' | 'spent' | 'committed') => M.reduce((a, m) => a + m[f], 0);
  return <section class="card"><div class="card-h"><div><h2>Projects in {name}</h2><p>{P.length} project{P.length === 1 ? '' : 's'} · budget {full(t('budget'))} · spent {full(t('spent'))} · committed {full(t('committed'))} · “spent vs time” is spending ahead (+) or behind (−) the time gone</p></div></div>
    <div class="card-b"><ProjectRows P={P} /></div></section>;
}

export function CountryTenders({ name, cid, P, offices }: { name: string; cid: string; P: Project[]; offices: Office[] }) {
  const set = useStore((s) => s.ledger.poKinds) ?? {};
  const L = providerPOs(P, set), S = suppliers(L).slice(0, 25);
  const oe = offices.flatMap((o) => o.reports.at(-1)!.entries.filter((e) => e.supplier));
  const os = [...oe.reduce((m, e) => { const g = m.get(e.supplier) ?? { s: e.supplier, a: 0, c: 0, n: 0 }; g.a += e.spent + e.committed; g.c += e.committed; g.n++; return m.set(e.supplier, g); }, new Map<string, { s: string; a: number; c: number; n: number }>()).values()].sort((a, b) => b.a - a.a).slice(0, 15);
  const kl = (k: string) => KINDS.find((x) => x.k === k)?.label ?? k;
  const cname = () => name;
  return <div class="grid g-12">
    <section class="card span-12"><div class="card-h"><div><h2>Service providers in {name}</h2><p>Orders placed with event organisers, interpreters, consultants, visibility, research and publication providers, from the latest report of each project. The app keeps no tender files: this is what the tenders led to.</p></div>
      <div class="tools"><button class="btn" onClick={() => go('reports/providers')}>All providers ›</button></div></div>
      <div class="card-b"><ProviderBrief P={P} cname={cname} rows={6} /></div></section>
    <ContractCalendar name={name} cid={cid} P={P} />
    <section class="card span-12"><div class="card-h"><div><h2>Office suppliers</h2><p>The office's own running-cost orders, latest office report</p></div></div>
      <div class="card-b">{os.length ? <table class="mini"><thead><tr><th>Supplier</th><th class="r">Orders</th><th class="r">Spent + committed</th><th class="r">Still open</th></tr></thead>
        <tbody>{os.map((x) => <tr><td>{x.s}</td><td class="r num">{x.n}</td><td class="r num">{full(x.a)}</td><td class="r num">{x.c > 0.5 ? full(x.c) : ''}</td></tr>)}</tbody></table>
        : <p class="muted">{offices.length ? 'The office report names no supplier.' : 'No office budget imported for this country.'}</p>}</div></section>
    {S.length > 0 && <section class="card span-12"><div class="card-h"><div><h2>Largest providers</h2><p>By spent + committed, every project of {name}</p></div></div>
      <div class="card-b table-scroll"><table class="mini"><thead><tr><th>Provider</th><th>Kind</th><th class="r">Orders</th><th class="r">Projects</th><th class="r">Spent</th><th class="r">Spent + committed</th></tr></thead>
        <tbody>{S.map((x) => <tr><td>{x.supplier}</td><td class="muted">{kl(x.kind)}</td><td class="r num">{x.pos}</td><td class="r num">{x.projects.size}</td><td class="r num">{full(x.spent)}</td><td class="r num">{full(x.sc)}</td></tr>)}</tbody></table></div></section>}
  </div>;
}

export function CountryStaff({ name, P }: { name: string; P: Project[] }) {
  const people = allPeople(P);
  if (!people.length) return <div class="card empty-page"><div><h2>No staff records for {name}</h2><p>Staff are read from the “Purchase Orders” sheet of each project's report workbook.</p></div></div>;
  return <StaffBoard people={people} showProject />;
}

export function CountryDeadlines({ name, P }: { name: string; P: Project[] }) {
  const FW = useStore((s) => s.ledger.frameworks) ?? {}, set = useStore((s) => s.ledger.poKinds) ?? {};
  const E = events(P).filter((e) => (e.day >= now() && daysUntil(e.day, TODAY) <= 365) || (e.kind === 'report' && e.tone === 'bad'));
  const names = new Map(providerPOs(P, set).map((x) => [supKey(x.supplier), x.supplier.trim()]));
  const mine = new Set(names.keys());
  const fw = Object.entries(FW).filter(([k, f]) => mine.has(k) && f.end && f.end >= now() && daysUntil(f.end, TODAY) <= 365);
  const months = [...new Set(E.map((e) => e.day.slice(0, 7)))].sort();
  return <section class="card"><div class="card-h"><div><h2>Deadlines in {name}</h2><p>Overdue reports and the next 12 months: report deadlines, staff contract ends, planned activity ends and project ends · click a line to open the project</p></div></div>
    <div class="card-b">
      {fw.length > 0 && <p class="cd-fw">Framework contracts ending: {fw.map(([k, f]) => <span class="badge warning">{names.get(k) ?? k} · {date(f.end!)}</span>)}</p>}
      {E.length ? months.map((m) => <div class="cd-m"><h3>{date(m + '-01').replace(/^\d+\s/, '')}</h3><ul class="cd-ev">{E.filter((e) => e.day.startsWith(m)).map((e) => <EvRow e={e} />)}</ul></div>)
        : <p class="muted">Nothing dated in the next 12 months.</p>}
    </div></section>;
}


/** Contracts of the country's providers on a calendar: each from its start to its end, warned 90, 60 and 30 days before. */
export function ContractCalendar({ name, cid, P }: { name: string; cid: string; P: Project[] }) {
  const set = useStore((s) => s.ledger.poKinds) ?? {}, FW = useStore((s) => s.ledger.frameworks) ?? {};
  const L = providerPOs(P, set);
  const names = new Map<string, string>(); for (const x of L) if (x.kind && x.supplier.trim()) names.set(supKey(x.supplier), x.supplier.trim());
  const use = (k: string) => ({ name: names.get(k), used: L.filter((x) => x.kind && supKey(x.supplier) === k).reduce((a, x) => a + x.value, 0) });
  // the country's contracts: those of its providers, and those entered here by name
  const D = contractsDue(Object.fromEntries(Object.entries(FW).filter(([k, c]) => names.has(k) || c.country === cid)), TODAY, use);
  const noEnd = Object.entries(FW).filter(([k, c]) => names.has(k) && !c.end);
  const [f, setF] = useState({ sup: '', ref: '', cap: '', start: '', end: '' });
  const [edit, setEdit] = useState('');
  const save = () => {
    const name = f.sup.trim(); if (!name || !f.end) return;
    const k = supKey(name);
    setFramework(k, { name, ...(names.has(k) ? {} : { country: cid }), ...(f.ref.trim() ? { ref: f.ref.trim() } : {}), ...(+f.cap > 0 ? { cap: Math.round(+f.cap * 100) / 100 } : {}), ...(f.start ? { start: f.start } : {}), end: f.end });
    setF({ sup: '', ref: '', cap: '', start: '', end: '' }); setEdit('');
  };
  const load = (d: ContractDue) => { const c = FW[d.key]; setF({ sup: d.name, ref: c.ref ?? '', cap: c.cap ? String(c.cap) : '', start: c.start ?? '', end: c.end ?? '' }); setEdit(d.key); };
  // the calendar: three months back, fifteen ahead
  const t0 = new Date(Date.UTC(TODAY.getUTCFullYear(), TODAY.getUTCMonth() - 3, 1)), months = Array.from({ length: 18 }, (_, i) => new Date(Date.UTC(t0.getUTCFullYear(), t0.getUTCMonth() + i, 1)));
  const t1 = Date.UTC(t0.getUTCFullYear(), t0.getUTCMonth() + 18, 1), span = t1 - t0.getTime();
  const x = (iso: string) => Math.max(0, Math.min(100, (Date.parse(iso) - t0.getTime()) / span * 100));
  const due = contractAlerts(D);
  return <section class="card span-12 cc"><div class="card-h"><div><h2>Contract calendar</h2>
    <p>Framework contracts and tender awards with {name}'s providers: a warning 90 days before the end, serious at 60, critical at 30 and for a month after. Contracts due also appear in the alert count of the bell.</p></div>
    {due.length > 0 && <span class="badge critical">{due.length} ending soon</span>}</div>
    <div class="card-b">
      <form class="cc-form" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <label>Provider<input list="cc-sup" value={f.sup} onInput={(e) => setF({ ...f, sup: (e.target as HTMLInputElement).value })} placeholder="Choose or type the provider" required /></label>
        <datalist id="cc-sup">{[...new Set(names.values())].sort().map((n) => <option value={n} />)}</datalist>
        <label>Reference<input value={f.ref} onInput={(e) => setF({ ...f, ref: (e.target as HTMLInputElement).value })} placeholder="Tender / contract no." /></label>
        <label>Ceiling (€)<input type="number" min="0" step="0.01" value={f.cap} onInput={(e) => setF({ ...f, cap: (e.target as HTMLInputElement).value })} /></label>
        <label>Starts<input type="date" value={f.start} onInput={(e) => setF({ ...f, start: (e.target as HTMLInputElement).value })} /></label>
        <label>Ends<input type="date" value={f.end} onInput={(e) => setF({ ...f, end: (e.target as HTMLInputElement).value })} required /></label>
        <button class="btn primary" type="submit" disabled={!f.sup.trim() || !f.end}>{edit ? 'Save changes' : '+ Add contract'}</button>
        {edit && <button class="btn ghost" type="button" onClick={() => { setEdit(''); setF({ sup: '', ref: '', cap: '', start: '', end: '' }); }}>Cancel</button>}
      </form>
      {D.length ? <div class="cc-cal">
        <div class="cc-row cc-head"><span /><div class="cc-track">{months.map((m) => <i style={{ left: `${x(m.toISOString())}%` }}>{m.getUTCMonth() === 0 ? m.getUTCFullYear() : m.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' })}</i>)}<u style={{ left: `${x(TODAY.toISOString())}%` }} /></div><span /></div>
        {D.map((d) => { const a = x(d.start ?? t0.toISOString()), b = x(d.end), w90 = x(new Date(Date.parse(d.end) - 90 * 864e5).toISOString()), r = d.cap ? d.used / d.cap : null;
          return <div class={`cc-row s-${d.severity}`}>
            <span class="cc-n"><b>{d.name}</b><small class="muted">{[d.ref, d.cap ? `ceiling ${full(d.cap)}` : '', d.used ? `ordered ${full(d.used)}${r != null ? ` (${pct(r)})` : ''}` : ''].filter(Boolean).join(' · ')}</small></span>
            <div class="cc-track">{months.map((m) => <i style={{ left: `${x(m.toISOString())}%` }} />)}
              {b > 0 && <em style={{ left: `${a}%`, width: `${Math.max(0.6, b - a)}%` }}><s style={{ left: `${b > a ? Math.max(0, (w90 - a) / (b - a) * 100) : 0}%` }} /></em>}
              <u style={{ left: `${x(TODAY.toISOString())}%` }} /></div>
            <span class="cc-s"><span class={`badge ${SEV_BADGE[d.severity]}`} title={`ends ${date(d.end)}`}>{dueText(d)}</span><small class="num muted">{date(d.end)}</small>
              <button class="btn ghost" title="Change" onClick={() => load(d)}>✎</button>
              <button class="btn ghost" title="Remove (admin)" onClick={() => { if (confirm(`Remove the contract with ${d.name}?`) && isAdmin('remove a contract')) setFramework(d.key, null); }}>✕</button></span>
          </div>; })}
      </div> : <p class="muted">No contract with an end date yet for {name}. Add one above: the provider, the reference of the tender or contract, its ceiling and its end date.</p>}
      {noEnd.length > 0 && <p class="muted" style={{ fontSize: '12.5px' }}>Without an end date, so not on the calendar: {noEnd.map(([k]) => names.get(k) ?? k).join(', ')}.</p>}
    </div></section>;
}
