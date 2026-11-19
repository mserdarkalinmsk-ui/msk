import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { officeServices } from '../domain/officeServices';
import { contractAlerts, contractsDue, dueText, SEV_BADGE, type ContractDue } from '../domain/contracts';
import { go, isAdmin, removeCoreMember, setCoreMember, setFramework, useStore } from '../data/store';
import { coreDue, FUND_LABEL, onTeam, type CoreMember } from '../domain/coreTeam';
import { n2 } from '../domain/staff';
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
  const core = useStore((s) => s.ledger.coreTeam?.[cid]) ?? [], coreOn = core.filter((m) => onTeam(m, TODAY)), coreEnd = coreDue(core, TODAY).filter((d) => d.days != null && d.days >= 0 && d.days <= 60);
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
      <Tile k="stf" color="var(--c7)" icon="☺" label="Staff" value={`${coreOn.length + people.length}`} sub={`${coreOn.length} core team · ${people.length} on projects · ${coreEnd.length + ending.length} contract${coreEnd.length + ending.length === 1 ? '' : 's'} ending within 60 days`} onClick={() => setTab('Staff')} />
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
  // procurement only: staff salaries, per diems and travel of missions, and petty cash are not bought from providers
  const notBought = new Set(KINDS.filter((k) => k.optional).map((k) => k.k));
  const L = providerPOs(P, set), S = suppliers(L).filter((x) => !notBought.has(x.kind)).slice(0, 25);
  const FW = useStore((s) => s.ledger.frameworks) ?? {};
  const rep = offices[0]?.reports.at(-1), OS = rep ? officeServices(rep) : [];
  const [pre, setPre] = useState<Prefill | null>(null);
  const okey = (line: string, sup: string) => `office:${cid}:${line}:${supKey(sup)}`;
  const kl = (k: string) => KINDS.find((x) => x.k === k)?.label ?? k;
  const cname = () => name;
  return <div class="grid g-12">
    <section class="card span-12"><div class="card-h"><div><h2>Service providers in {name}</h2><p>Orders placed with event organisers, interpreters, consultants, visibility, research and publication providers, from the latest report of each project. The app keeps no tender files: this is what the tenders led to.</p></div>
      <div class="tools"><button class="btn" onClick={() => go('reports/providers')}>All providers ›</button></div></div>
      <div class="card-b"><ProviderBrief P={P} cname={cname} rows={6} /></div></section>
    <ContractCalendar name={name} cid={cid} P={P} pre={pre} />
    <section class="card span-12"><div class="card-h"><div><h2>Office contracts</h2><p>{rep ? <>The office's own services by budget line, from the office report of {date(rep.date)}: what each is, read from its order descriptions, and the period the orders cover. Add the contract to have its end warned. Petty cash, missions and internal regularisations are left out.</> : 'No office budget imported for this country.'}</p></div></div>
      {OS.length > 0 && <div class="card-b table-scroll"><table class="mini os-t"><thead><tr><th>Budget line</th><th>Service</th><th>Supplier</th><th class="r">Orders</th><th>Orders cover to</th><th class="r">Spent + committed</th><th class="r">Still open</th><th>Contract</th></tr></thead>
        <tbody>{OS.map((x, i) => { const k = okey(x.line, x.supplier), c = FW[k] ?? FW[supKey(x.supplier)], due = c?.end || c?.openEnded ? contractsDue({ [k]: c }, TODAY)[0] : undefined;
          return <tr class={i && OS[i - 1].line === x.line ? 'same' : ''}><td>{i && OS[i - 1].line === x.line ? '' : <><span class="num">{x.line}</span> <span class="muted">{x.lineName}</span></>}</td>
            <td><b>{x.kind}</b></td><td>{x.supplier}</td>
            <td class="r num" title={[...new Set(x.orders.map((o) => o.description))].join('\n')}>{x.orders.length}</td>
            <td class="num" title={x.coverText}>{x.covers ? date(x.covers) : '—'}</td>
            <td class="r num">{full(x.amount)}</td><td class="r num">{x.open > 0.5 ? full(x.open) : ''}</td>
            <td>{due ? <span class={`badge ${due.openEnded ? 'neutral' : SEV_BADGE[due.severity]}`} title={due.openEnded ? 'No end date: nothing to warn' : `${c!.ref ?? ''} ends ${date(due.end)}`}>{dueText(due)}</span>
              : x.directDebit ? <span class="badge neutral" title="Paid by direct debit: a standing service with no end date, so nothing to warn">open-ended · direct debit</span>
              : <button class="btn ghost os-add" onClick={() => { setPre({ n: Date.now(), key: k, sup: x.supplier, line: x.line, kind: x.kind, end: x.covers ?? '' }); setTimeout(() => document.querySelector('.cc-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); }}>+ Contract</button>}</td></tr>; })}</tbody></table></div>}
    </section>
    {S.length > 0 && <section class="card span-12"><div class="card-h"><div><h2>Largest providers</h2><p>By spent + committed, every project of {name} · staff salaries, mission per diems and travel, and petty cash are not procurement and are left out</p></div></div>
      <div class="card-b table-scroll"><table class="mini"><thead><tr><th>Provider</th><th>Kind</th><th class="r">Orders</th><th class="r">Projects</th><th class="r">Spent</th><th class="r">Spent + committed</th></tr></thead>
        <tbody>{S.map((x) => <tr><td>{x.supplier}</td><td class="muted">{kl(x.kind)}</td><td class="r num">{x.pos}</td><td class="r num">{x.projects.size}</td><td class="r num">{full(x.spent)}</td><td class="r num">{full(x.sc)}</td></tr>)}</tbody></table></div></section>}
  </div>;
}

export function CountryStaff({ name, cid, P }: { name: string; cid: string; P: Project[] }) {
  const people = allPeople(P);
  return <>
    <CoreTeam name={name} cid={cid} P={P} />
    <section class="card" style={{ marginTop: '16px' }}><div class="card-h"><div><h2>Project staff in {name}</h2><p>Staff on the projects, read from the “Purchase Orders” sheet of each project's report workbook</p></div></div></section>
    {people.length ? <StaffBoard people={people} showProject /> : <div class="card empty-page"><div><h2>No project staff records for {name}</h2><p>Staff are read from the “Purchase Orders” sheet of each project's report workbook.</p></div></div>}
  </>;
}

const EMPTY = { name: '', position: '', grade: '', start: '', end: '', fund: 'ob', project: '', share: '', note: '' };
/** The office's own team: entered by hand, with contract ends warned like contracts with providers. */
function CoreTeam({ name, cid, P }: { name: string; cid: string; P: Project[] }) {
  const M = useStore((s) => s.ledger.coreTeam?.[cid]) ?? [];
  const [f, setF] = useState(EMPTY), [edit, setEdit] = useState('');
  const D = coreDue(M, TODAY), on = M.filter((m) => onTeam(m, TODAY));
  const v = (k: keyof typeof EMPTY) => ({ value: f[k], onInput: (e: Event) => setF({ ...f, [k]: (e.target as HTMLInputElement).value }) });
  const save = () => {
    if (!f.name.trim() || !f.position.trim()) return;
    const m: CoreMember = { id: edit || `ct${Date.now().toString(36)}`, name: f.name.trim(), position: f.position.trim(), fund: f.fund as CoreMember['fund'],
      ...(f.grade.trim() ? { grade: f.grade.trim() } : {}), ...(f.start ? { start: f.start } : {}), ...(f.end ? { end: f.end } : {}),
      ...(f.fund === 'project' && f.project ? { project: f.project, ...(+f.share > 0 ? { share: Math.min(100, +f.share) } : {}) } : {}), ...(f.note.trim() ? { note: f.note.trim() } : {}) };
    setCoreMember(cid, m); setF(EMPTY); setEdit('');
  };
  const load = (m: CoreMember) => { setF({ name: m.name, position: m.position, grade: m.grade ?? '', start: m.start ?? '', end: m.end ?? '', fund: m.fund ?? 'ob', project: m.project ?? '', share: m.share ? String(m.share) : '', note: m.note ?? '' }); setEdit(m.id); };
  // a post charged to a project: is the person on that project's staff list?
  const onProject = (m: CoreMember) => { const p = P.find((x) => x.id === m.project); if (!p) return null; const k = n2(m.name); return allPeople([p]).some((a) => n2(a.name) === k || n2(a.display) === k); };
  return <section class="card cc"><div class="card-h"><div><h2>Core Team</h2><p>The office's own team in {name}, outside the projects: {on.length} on the team today. Contract ends are warned 90, 60 and 30 days ahead, here, under Deadlines and in the bell's count.</p></div></div>
    <div class="card-b">
      <form class="cc-form" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <label>Name<input {...v('name')} placeholder="Surname, Name" required /></label>
        <label>Position<input {...v('position')} placeholder="e.g. Head of Office" required /></label>
        <label>Grade<input {...v('grade')} style={{ minWidth: '70px', width: '80px' }} /></label>
        <label>Starts<input type="date" {...v('start')} /></label>
        <label>Ends<input type="date" {...v('end')} /></label>
        <label>Paid from<select class="select" value={f.fund} onChange={(e) => setF({ ...f, fund: (e.target as HTMLSelectElement).value })}>{Object.entries(FUND_LABEL).map(([k, l]) => <option value={k}>{l}</option>)}</select></label>
        {f.fund === 'project' && <><label>Project<select class="select" value={f.project} onChange={(e) => setF({ ...f, project: (e.target as HTMLSelectElement).value })}><option value="">—</option>{P.map((p) => <option value={p.id}>{plabel(p)}</option>)}</select></label>
          <label>Share %<input type="number" min="0" max="100" {...v('share')} style={{ minWidth: '70px', width: '80px' }} /></label></>}
        <label>Note<input {...v('note')} /></label>
        <button class="btn primary" type="submit" disabled={!f.name.trim() || !f.position.trim()}>{edit ? 'Save changes' : '+ Add to the team'}</button>
        {edit && <button class="btn ghost" type="button" onClick={() => { setEdit(''); setF(EMPTY); }}>Cancel</button>}
      </form>
      {D.length ? <div class="table-scroll"><table class="mini ct-t"><thead><tr><th>Name</th><th>Position</th><th>Grade</th><th>Paid from</th><th>Contract</th><th>Ends</th><th /></tr></thead>
        <tbody>{D.map(({ m, days, severity }) => { const p = P.find((x) => x.id === m.project), seen = m.fund === 'project' ? onProject(m) : null;
          return <tr class={onTeam(m, TODAY) ? '' : 'muted'}><td><b>{m.name}</b>{m.note && <small class="muted cd-n">{m.note}</small>}</td><td>{m.position}</td><td class="num">{m.grade ?? '—'}</td>
            <td>{m.fund === 'project' && p ? <>{plabel(p)}{m.share ? ` · ${m.share}%` : ''} {seen != null && <span class={`badge ${seen ? 'good' : 'warning'}`} title={seen ? 'The person is on the project\'s staff list' : 'Not found on the project\'s staff list: check the charging'}>{seen ? 'on the project' : 'not on its staff list'}</span>}</> : FUND_LABEL[m.fund ?? 'ob']}</td>
            <td class="num" style={{ whiteSpace: 'nowrap' }}>{m.start ? date(m.start) : '—'} – {m.end ? date(m.end) : 'open-ended'}</td>
            <td>{days == null ? <span class="muted">no end date</span> : <span class={`badge ${SEV_BADGE[severity as ContractDue['severity']]}`}>{days < 0 ? `ended ${-days} d ago` : days === 0 ? 'ends today' : `${days} d left`}</span>}</td>
            <td style={{ whiteSpace: 'nowrap' }}><button class="btn ghost" title="Change" onClick={() => load(m)}>✎</button><button class="btn ghost" title="Remove (admin)" onClick={() => { if (confirm(`Remove ${m.name} from the core team?`)) removeCoreMember(cid, m.id); }}>✕</button></td></tr>; })}</tbody></table></div>
        : <p class="muted">No one on the core team of {name} yet. Add the office's own staff above: name, position, contract dates and what pays for the post.</p>}
    </div></section>;
}

export function CountryDeadlines({ name, cid, P }: { name: string; cid: string; P: Project[] }) {
  const core = coreDue(useStore((s) => s.ledger.coreTeam?.[cid]) ?? [], TODAY).filter((d) => d.days != null && d.days >= -30 && d.days <= 365);
  const FW = useStore((s) => s.ledger.frameworks) ?? {}, set = useStore((s) => s.ledger.poKinds) ?? {};
  const E = events(P).filter((e) => (e.day >= now() && daysUntil(e.day, TODAY) <= 365) || (e.kind === 'report' && e.tone === 'bad'));
  const names = new Map(providerPOs(P, set).map((x) => [supKey(x.supplier), x.supplier.trim()]));
  const mine = new Set(names.keys());
  const fw = Object.entries(FW).filter(([k, f]) => mine.has(k) && f.end && f.end >= now() && daysUntil(f.end, TODAY) <= 365);
  const months = [...new Set(E.map((e) => e.day.slice(0, 7)))].sort();
  return <section class="card"><div class="card-h"><div><h2>Deadlines in {name}</h2><p>Overdue reports and the next 12 months: report deadlines, staff contract ends, planned activity ends and project ends · click a line to open the project</p></div></div>
    <div class="card-b">
      {core.length > 0 && <p class="cd-fw">Core team contracts ending: {core.map((d) => <span class={`badge ${SEV_BADGE[d.severity as ContractDue['severity']]}`}>{d.m.name} · {date(d.m.end!)}</span>)}</p>}
      {fw.length > 0 && <p class="cd-fw">Framework contracts ending: {fw.map(([k, f]) => <span class="badge warning">{names.get(k) ?? k} · {date(f.end!)}</span>)}</p>}
      {E.length ? months.map((m) => <div class="cd-m"><h3>{date(m + '-01').replace(/^\d+\s/, '')}</h3><ul class="cd-ev">{E.filter((e) => e.day.startsWith(m)).map((e) => <EvRow e={e} />)}</ul></div>)
        : <p class="muted">Nothing dated in the next 12 months.</p>}
    </div></section>;
}


/** Contracts of the country's providers on a calendar: each from its start to its end, warned 90, 60 and 30 days before. */
/** A contract to add, filled in from an office service. */
export interface Prefill { n: number; key: string; sup: string; line: string; kind: string; end: string }
export function ContractCalendar({ name, cid, P, pre }: { name: string; cid: string; P: Project[]; pre?: Prefill | null }) {
  const set = useStore((s) => s.ledger.poKinds) ?? {}, FW = useStore((s) => s.ledger.frameworks) ?? {};
  const L = providerPOs(P, set);
  const names = new Map<string, string>(); for (const x of L) if (x.kind && x.supplier.trim()) names.set(supKey(x.supplier), x.supplier.trim());
  const use = (k: string) => ({ name: names.get(k), used: L.filter((x) => x.kind && supKey(x.supplier) === k).reduce((a, x) => a + x.value, 0) });
  // the country's contracts: those of its providers, and those entered here by name
  const D = contractsDue(Object.fromEntries(Object.entries(FW).filter(([k, c]) => names.has(k) || c.country === cid)), TODAY, use);
  const noEnd = Object.entries(FW).filter(([k, c]) => names.has(k) && !c.end && !c.openEnded);
  const [f, setF] = useState({ sup: '', ref: '', cap: '', start: '', end: '', open: false });
  const [edit, setEdit] = useState(''), [meta, setMeta] = useState<{ line?: string; kind?: string }>({});
  // an office service chosen in the table: its supplier, budget line and kind; the end its orders cover, to confirm
  useEffect(() => { if (pre) { setF({ sup: pre.sup, ref: '', cap: '', start: '', end: '', open: false }); setEdit(pre.key); setMeta({ line: pre.line, kind: pre.kind }); } }, [pre?.n]);
  const save = () => {
    const name = f.sup.trim(); if (!name || (!f.end && !f.open)) return;
    const k = edit || supKey(name);
    setFramework(k, { name, ...(meta.line ? { line: meta.line, kind: meta.kind } : {}), ...(names.has(k) && !meta.line ? {} : { country: cid }), ...(f.ref.trim() ? { ref: f.ref.trim() } : {}), ...(+f.cap > 0 ? { cap: Math.round(+f.cap * 100) / 100 } : {}), ...(f.start ? { start: f.start } : {}), ...(f.open ? { openEnded: true } : { end: f.end }) });
    setF({ sup: '', ref: '', cap: '', start: '', end: '', open: false }); setEdit(''); setMeta({});
  };
  const load = (d: ContractDue) => { const c = FW[d.key]; setF({ sup: d.name, ref: c.ref ?? '', cap: c.cap ? String(c.cap) : '', start: c.start ?? '', end: c.end ?? '', open: !!c.openEnded }); setEdit(d.key); setMeta({ line: c.line, kind: c.kind }); };
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
        <label>Ends<input type="date" value={f.open ? '' : f.end} disabled={f.open} onInput={(e) => setF({ ...f, end: (e.target as HTMLInputElement).value })} required={!f.open} /></label>
        <label class="cc-open"><input type="checkbox" checked={f.open} onChange={(e) => setF({ ...f, open: (e.target as HTMLInputElement).checked })} /> Open-ended (no end date)</label>
        <button class="btn primary" type="submit" disabled={!f.sup.trim() || (!f.end && !f.open)}>{edit ? 'Save changes' : '+ Add contract'}</button>
        {edit && <button class="btn ghost" type="button" onClick={() => { setEdit(''); setMeta({}); setF({ sup: '', ref: '', cap: '', start: '', end: '', open: false }); }}>Cancel</button>}
        {meta.line && <p class="cc-meta">Office contract · <b>{meta.kind}</b> · budget line {meta.line}{pre?.end && pre.key === edit ? <> · its orders cover to {date(pre.end)}: enter the contract's own end date</> : null}</p>}
      </form>
      {D.length ? <div class="cc-cal">
        <div class="cc-row cc-head"><span /><div class="cc-track">{months.map((m) => <i style={{ left: `${x(m.toISOString())}%` }}>{m.getUTCMonth() === 0 ? m.getUTCFullYear() : m.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' })}</i>)}<u style={{ left: `${x(TODAY.toISOString())}%` }} /></div><span /></div>
        {D.map((d) => { const a = x(d.start ?? t0.toISOString()), b = d.openEnded ? 100 : x(d.end), w90 = d.openEnded ? 101 : x(new Date(Date.parse(d.end) - 90 * 864e5).toISOString()), r = d.cap ? d.used / d.cap : null;
          return <div class={`cc-row s-${d.severity}${d.openEnded ? ' open' : ''}`}>
            <span class="cc-n"><b>{d.name}</b><small class="muted">{[d.kind ? `${d.kind} · line ${d.line}` : '', d.ref, d.cap ? `ceiling ${full(d.cap)}` : '', d.used ? `ordered ${full(d.used)}${r != null ? ` (${pct(r)})` : ''}` : ''].filter(Boolean).join(' · ')}</small></span>
            <div class="cc-track">{months.map((m) => <i style={{ left: `${x(m.toISOString())}%` }} />)}
              {b > 0 && <em style={{ left: `${a}%`, width: `${Math.max(0.6, b - a)}%` }}><s style={{ left: `${b > a ? Math.max(0, (w90 - a) / (b - a) * 100) : 0}%` }} /></em>}
              <u style={{ left: `${x(TODAY.toISOString())}%` }} /></div>
            <span class="cc-s"><span class={`badge ${d.openEnded ? 'neutral' : SEV_BADGE[d.severity]}`} title={d.openEnded ? 'No end date: nothing to warn' : `ends ${date(d.end)}`}>{dueText(d)}</span><small class="num muted">{d.openEnded ? 'no end date' : date(d.end)}</small>
              <button class="btn ghost" title="Change" onClick={() => load(d)}>✎</button>
              <button class="btn ghost" title="Remove (admin)" onClick={() => { if (confirm(`Remove the contract with ${d.name}?`) && isAdmin('remove a contract')) setFramework(d.key, null); }}>✕</button></span>
          </div>; })}
      </div> : <p class="muted">No contract with an end date yet for {name}. Add one above: the provider, the reference of the tender or contract, its ceiling and its end date.</p>}
      {noEnd.length > 0 && <p class="muted" style={{ fontSize: '12.5px' }}>Without an end date, so not on the calendar: {noEnd.map(([k]) => names.get(k) ?? k).join(', ')}.</p>}
    </div></section>;
}
