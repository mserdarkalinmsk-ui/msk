import { MON } from '../domain/dt';
import { Ico, type IcoName } from '../ui/Ico';
import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { officeServices } from '../domain/officeServices';
import { amendmentDiff, applyAmendment, contractAlerts, contractsDue, dueText, officeContractUse, ceilingSeverity, SEV_BADGE, type ContractDue } from '../domain/contracts';
import { addCoreMembers, go, isAdmin, removeCoreMember, setCoreMember, setFramework, setPoKind, useStore } from '../data/store';
import { readXlsx } from '../ui/xlsx';
import { openAttachment, readAttachment, type Attachment } from '../ui/attach';
import { ocrPdf, readDocument, readPages } from '../ui/docread';
import { contractTerms, type ContractTerms } from '../domain/contractRead';
import { fundLabel, openPost, countryPeople, type CountryPerson, coreDue, coreFromRows, FUND_LABEL, onTeam, type CoreMember } from '../domain/coreTeam';
import { budgetOnly, money, reportsByDate, reportTotals } from '../domain/calc';
import { spentInYear } from '../domain/yearSpend';
import { alerts, outcome } from '../domain/insights';
import { openAlerts } from '../domain/worklist';
import { programmeOf } from '../domain/flex';
import { plabel } from '../domain/label';
import { LS_BH, OB_BH, officeView, type Office } from '../domain/office';
import { providerPOs, providerSummary, suppliers, supKey, KINDS } from '../domain/providers';
import { daysUntil, n2, renewals, type Base } from '../domain/staff';
import { SalarySection } from '../ui/CountryPanel';
import { StaffPlanTable } from './StaffPlan';
import { StaffReport } from './StaffReport';
import type { Project } from '../domain/types';
import { TODAY } from '../today';
import { date, full, pct, short } from '../ui/format';
import { CAL_KINDS, calItems, events, type Ev } from './Agenda';
import { allPeople, StaffBoard } from './People';
import { ProjectsBody } from './Projects';
import { BudgetBody } from './Budget';
import { poReports, reviewOf } from './POReview';
import { reportDiff } from '../domain/reportDiff';
import { ProviderBrief } from './Providers';
import { Firm, Who } from '../ui/EntityPanel';
import { CalendarView } from '../ui/CalendarView';

/** The tabs of a country, in the order of the questions asked of it: how is it doing; the money of the projects, then of
 *  the office; the people; the contracts and suppliers (one place for the office's and the projects'); what is coming. */
export const DESK_TABS = ['Overview', 'Projects', 'Office', 'People', 'Contracts & suppliers', 'Calendar'] as const;
export type DeskTab = (typeof DESK_TABS)[number];
/** A tab's part of the address: "Contracts & suppliers" → "contracts". */
export const deskSlug = (t: DeskTab) => ({ Overview: 'overview', Projects: 'projects', Office: 'office', People: 'people', 'Contracts & suppliers': 'contracts', Calendar: 'calendar' } as const)[t];
/** The tab of an address part, the addresses of the earlier tabs included (links and bookmarks keep working). */
export const slugTab = (s?: string): DeskTab | undefined => DESK_TABS.find((t) => deskSlug(t) === s) ?? ({ 'office-budget': 'Office', budget: 'Projects', staff: 'People', tenders: 'Contracts & suppliers', deadlines: 'Calendar' } as Record<string, DeskTab>)[s ?? ''];

const now = () => TODAY.toISOString().slice(0, 10);
const active = (p: Project) => p.start <= now() && p.end >= now();
const KIND_LABEL: Record<Ev['kind'], string> = { report: 'Report due', contract: 'Staff contract ends', activity: 'Activity ends', project: 'Project ends' };
const open = (p: Project, slug = '') => go(`project/${p.id}${slug ? '/' + slug : ''}`);

/** One coloured tile; a click opens its tab. */
function Tile({ k, color, icon, label, value, sub, onClick }: { k: string; color: string; icon: IcoName; label: string; value: ComponentChildren; sub: ComponentChildren; onClick?: () => void }) {
  return <button class={`po-k cd-k cd-${k}`} style={{ '--k': color } as never} onClick={onClick}>
    <span class="po-k-h"><i aria-hidden="true"><Ico n={icon} size={14} /></i>{label}</span><b>{value}</b><em>{sub}</em><span class="po-k-bar" aria-hidden="true"><u class="none" style={{ flex: 1 }} /></span></button>;
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
  // the year looked at: the office budget is yearly, the projects run over years — both read for the same calendar year
  const thisYear = TODAY.getUTCFullYear();
  const years = [...new Set([...offices.flatMap((o) => o.reports.map((r) => r.year)), ...P.flatMap((p) => { const a = +p.start.slice(0, 4), b = Math.min(+p.end.slice(0, 4), thisYear); return Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i); })])].filter((y) => y <= thisYear).sort();
  const [yr, setYr] = useState(thisYear);
  const Y = years.includes(yr) ? yr : years.at(-1) ?? thisYear;
  const Ts = offices.flatMap((o) => { const r = [...o.reports].filter((x) => x.year === Y).sort((a, b) => a.date.localeCompare(b.date)).at(-1); return r ? [{ r, T: officeView(r).T }] : []; });
  const inYear = P.map((p) => spentInYear(p, Y)), spentY = inYear.reduce((a, x) => a + x.v, 0), basis = inYear.some((x) => x.basis === 'reports') ? 'from the reports around the year' : 'from the dated postings';
  const ob = Ts.reduce((a, { T }) => ({ b: a.b + T.ob.budget + T.ls.budget, sc: a.sc + T.ob.sc + T.ls.sc, pl: a.pl + T.ob.planned + T.ls.planned, ob: a.ob + T.ob.budget, ls: a.ls + T.ls.budget }), { b: 0, sc: 0, pl: 0, ob: 0, ls: 0 });
  const committed = M.reduce((a, m) => a + m.committed, 0);
  return <>
    {years.length > 1 && <div class="cd-year"><span>Year</span><div class="seg" role="group" aria-label="Year">{years.slice(-4).map((y) => <button aria-pressed={Y === y} onClick={() => setYr(y)}>{y}</button>)}</div></div>}
    <section class="bud2" aria-label={`Budgets in ${name}`}>
      <button class="bud bud-ob" onClick={() => setTab('Office')}>
        <span class="bud-h">Office budget<small>the office's running costs: Ordinary Budget and LS & Pagoda{Ts[0] ? ` · ${Ts[0].r.year}, situation ${date(Ts[0].r.date)}` : ''}</small></span>
        {Ts.length ? <><b class="bud-v" title={full(ob.b)}>{short(ob.b)}</b>
          <Bar parts={[[ob.sc, 'var(--c1)'], [ob.pl, 'color-mix(in srgb, var(--c1) 35%, transparent)']]} of={ob.b} />
          <dl><dt>Ordinary Budget · BH {offices[0]?.bh ?? OB_BH}</dt><dd>{full(ob.ob)}</dd><dt>LS & Pagoda · BH {LS_BH}</dt><dd>{full(ob.ls)}</dd><dt>Spent + committed</dt><dd>{full(ob.sc)} <small>({pct(ob.b ? ob.sc / ob.b : 0)})</small></dd><dt>Foreseen to year end</dt><dd>{full(ob.pl)}</dd><dt><b>Left after the forecast</b></dt><dd style={{ color: ob.b - ob.sc - ob.pl < -0.5 ? 'var(--critical)' : undefined }}><b>{full(ob.b - ob.sc - ob.pl)}</b></dd></dl></>
          : <p class="muted">{offices.length ? `No office report for ${Y}.` : `No office budget imported for ${name}.`}</p>}
      </button>
      <button class="bud bud-eb" onClick={() => setTab('Projects')}>
        <span class="bud-h">Projects<small>extraordinary budget: joint programmes and voluntary contributions · {A.length} running{P.length > A.length ? ` of ${P.length}` : ''}</small></span>
        {P.length ? <><b class="bud-v" title={full(budget)}>{short(budget)}</b>
          <Bar parts={[[spent, 'var(--c3)'], [committed, 'color-mix(in srgb, var(--c3) 40%, transparent)']]} of={budget} />
          <dl><dt><b>Spent in {Y}</b></dt><dd title={basis}><b>{full(spentY)}</b></dd><dt>Spent to date</dt><dd>{full(spent)} <small>({pct(budget ? spent / budget : 0)})</small></dd><dt>Committed</dt><dd>{full(committed)}</dd><dt>Not yet committed</dt><dd>{full(budget - spent - committed)}</dd></dl></>
          : <p class="muted">No project in {name}.</p>}
      </button>
      <div class="bud bud-all"><span class="bud-h">In {name}<small>office and projects together</small></span><b class="bud-v" title={full(ob.b + budget)}>{short(ob.b + budget)}</b>
        <Bar parts={[[ob.b, 'var(--c1)'], [budget, 'var(--c3)']]} of={ob.b + budget} />
        <dl><dt>Used in {Y}</dt><dd title="office spent + committed, and the projects' spending of the year">{full(ob.sc + spentY)}</dd><dt>Office</dt><dd>{pct(ob.b + budget ? ob.b / (ob.b + budget) : 0)}</dd><dt>Extraordinary</dt><dd>{pct(ob.b + budget ? budget / (ob.b + budget) : 0)}</dd></dl></div>
    </section>
    <div class="po-kpi cd-kpi cd-kpi3">
      <Tile k="ten" color="var(--c4)" icon="flag" label="Contracts & suppliers" value={S.total ? short(S.total) : '—'} sub={<>{due.length ? <strong>{due.length} contract{due.length > 1 ? 's' : ''} ending soon · </strong> : ''}{S.total ? `${S.providers} providers · ${S.pos} orders` : 'no service-provider order yet'}</>} onClick={() => setTab('Contracts & suppliers')} />
      <Tile k="stf" color="var(--c7)" icon="people" label="People" value={`${coreOn.length + people.length}`} sub={`${coreOn.length} core team · ${people.length} on projects · ${coreEnd.length + ending.length} contract${coreEnd.length + ending.length === 1 ? '' : 's'} ending within 60 days`} onClick={() => setTab('People')} />
      <Tile k="dl" color="var(--c8)" icon="clock" label="Calendar" value={`${E.length}`} sub={`in the next 90 days${late.length ? ` · ${late.length} report${late.length > 1 ? 's' : ''} overdue` : ''}`} onClick={() => setTab('Calendar')} />
    </div>
    <LookingAhead name={name} P={P} officeLeft={Ts.length ? ob.b - ob.sc - ob.pl : null} year={Y} setTab={setTab} />
    <div class="cd-two">
      <CountryAlerts name={name} cid={cid} P={P} setTab={setTab} offices={offices} />
      <section class="card cu"><div class="card-h"><div><h2>Coming up</h2><p>The next 90 days</p></div>{E.length > 6 && <div class="tools"><button class="btn ghost" onClick={() => setTab('Calendar')}>All {E.length} ›</button></div>}</div>
        <div class="card-b">{E.length ? <ul class="cd-ev">{E.slice(0, 6).map((e) => <EvRow e={e} />)}</ul> : <p class="muted">Nothing dated in the next 90 days.</p>}</div></section>
    </div>
    <SinceLastReports name={name} P={P} offices={offices} />
  </>;
}

/** Where the country is heading: the office's result at the year end, and each running project's use of its budget at its current pace. */
function LookingAhead({ name, P, officeLeft, year, setTab }: { name: string; P: Project[]; officeLeft: number | null; year: number; setTab: (t: DeskTab) => void }) {
  const R = P.filter(active).filter((p) => !p.datesTbc).map((p) => ({ p, o: outcome(p, TODAY) })).filter((x) => x.o.basis !== 'no data').sort((a, b) => a.o.utilisation - b.o.utilisation);
  const unused = R.reduce((a, x) => a + x.o.unused, 0), over = R.reduce((a, x) => a + x.o.overrun, 0);
  return <section class="card la"><div class="card-h"><div><h2>Looking ahead in {name}</h2><p>The office at the end of {year}, and each running project at its end if it keeps its current pace of spending</p></div></div>
    <div class="card-b la-g">
      <button class="la-k" onClick={() => setTab('Office')}><span>Office at the end of {year}</span>{officeLeft == null ? <b class="muted">—</b> : <b style={{ color: officeLeft < -0.5 ? 'var(--critical)' : 'var(--good)' }}>{officeLeft < -0.5 ? `short by ${full(-officeLeft)}` : `${full(officeLeft)} left`}</b>}<small>after what is foreseen to the year end</small></button>
      <div class="la-k"><span>Projects at their end</span><b style={{ color: unused > 0.5 ? 'var(--serious)' : 'var(--good)' }}>{unused > 0.5 ? `${short(unused)} may stay unused` : 'budgets used in full'}</b><small>{over > 0.5 ? `and ${short(over)} above budget on others · ` : ''}at the current pace</small></div>
      <ul class="la-l">{R.map(({ p, o }) => <li onClick={() => open(p)}><b>{plabel(p)}</b><span class="la-bar"><i style={{ width: `${Math.min(100, o.utilisation * 100)}%`, background: o.utilisation < 0.85 ? 'var(--serious)' : o.utilisation > 1 ? 'var(--critical)' : 'var(--good)' }} /></span><span class="num">{pct(o.utilisation)}</span><small class="muted">{o.unused > 0.5 ? `${short(o.unused)} unused` : o.overrun > 0.5 ? `${short(o.overrun)} over` : 'on track'}</small></li>)}</ul>
    </div></section>;
}

/** What the latest report of each project brought, against the one before: spending, orders, and the lines and units to check. */
function SinceLastReports({ name, P, offices }: { name: string; P: Project[]; offices: Office[] }) {
  // every report counts for the dates and the spending; the orders come from the reports that carry a purchase-order sheet
  const R = P.map((p) => { const L = reportsByDate(p).filter((r) => r.snapshot?.lines?.length && !budgetOnly(r)), a = L.at(-2), b = L.at(-1); if (!b) return null;
    const W = poReports(p), D = W.length > 1 ? reportDiff(W.at(-2)!.wb, W.at(-1)!.wb) : null, F = reviewOf(p).findings.filter((f) => (f.group === 'line' || f.group === 'unit') && f.level !== 'info');
    return { p, to: b.name || date(b.date), from: a ? a.name || date(a.date) : undefined, spent: a ? reportTotals(b).actual - reportTotals(a).actual : null, d: D, flags: F.length, n: (k: string) => D?.pos.filter((x) => x.kind === k).length ?? 0 }; })
    .filter(Boolean) as { p: Project; to: string; from?: string; spent: number | null; d: ReturnType<typeof reportDiff> | null; flags: number; n: (k: string) => number }[];
  const off = offices.map((o) => { const a = o.reports.at(-2), b = o.reports.at(-1)!; // a system export carries no LS & Pagoda figures: then only the Ordinary Budget, which both reports carry, is compared
    const both = !!a && a.hasPlan && b.hasPlan, sc = (r: typeof b) => officeView(r).T.ob.sc + (both ? officeView(r).T.ls.sc : 0); return { o, b, d: a ? sc(b) - sc(a) : null, from: a, both }; });
  if (!R.length && !off.length) return null;
  return <section class="card sl"><div class="card-h"><div><h2>Since the last reports in {name}</h2><p>Each project's latest report against the one before it · click a project for its PO review</p></div></div>
    <div class="card-b table-scroll"><table class="mini"><thead><tr><th>Project</th><th>Latest report</th><th class="r" title="As the reports total it: administrative costs (line 10) included">Spent since the one before</th><th class="r">New orders</th><th class="r">Orders with more committed</th><th class="r">Lines and units to check</th></tr></thead>
      <tbody>{R.map((x) => <tr class="click" onClick={() => open(x.p, 'poreview')}><td><b>{plabel(x.p)}</b></td><td>{x.to}{x.from ? <small class="muted"> · after {x.from}</small> : <small class="muted"> · the first</small>}</td>
        <td class="r num">{x.spent != null ? full(x.spent) : '—'}</td><td class="r num">{x.d ? x.n('new') : '—'}</td><td class="r num">{x.d ? x.n('raised') : '—'}</td>
        <td class="r">{x.flags ? <span class="badge warning">{x.flags}</span> : <span class="muted">0</span>}</td></tr>)}
        {off.map((x) => <tr><td><b>{x.o.name}</b> <small class="muted">office</small></td><td>situation {date(x.b.date)}{x.from ? <small class="muted"> · after {date(x.from.date)}</small> : null}</td><td class="r num" title={x.both ? 'office spent + committed, both funds' : 'Ordinary Budget only: one of the two reports is a system export without LS & Pagoda'}>{x.d != null ? full(x.d) : '—'}{x.d != null && !x.both ? <small class="muted"> OB</small> : null}</td><td /><td /><td /></tr>)}</tbody></table></div></section>;
}

/** Everything open in the country in one list: the projects' alerts, contracts with providers and core team contracts ending. */
function CountryAlerts({ name, cid, P, setTab, offices }: { name: string; cid: string; P: Project[]; setTab: (t: DeskTab) => void; offices: Office[] }) {
  const marks = useStore((s) => s.ledger.alertMarks), FW = useStore((s) => s.ledger.frameworks) ?? {}, core = useStore((s) => s.ledger.coreTeam?.[cid]) ?? [], set = useStore((s) => s.ledger.poKinds) ?? {};
  const mine = new Set(providerPOs(P, set).map((x) => supKey(x.supplier)));
  const PO = providerPOs(P, set), entries = offices.flatMap((o) => o.reports.at(-1)?.entries ?? []);
  const ceilingUse = (k: string) => { const c = FW[k]; if (c?.line) { const sk = k.split(':').slice(3).join(':'); return { used: officeContractUse(entries, c.line, (s) => supKey(s) === sk) }; } return { used: PO.filter((x) => x.kind && supKey(x.supplier) === k).reduce((a, x) => a + x.value, 0) }; };
  const rank = { critical: 0, serious: 1, warning: 2 } as const;
  type Item = { sev: keyof typeof rank; who: string; what: string; detail: string; go: () => void };
  const items: Item[] = [
    ...openAlerts(alerts(P, TODAY), marks, TODAY).map((a) => { const p = P.find((x) => x.id === a.projectId)!; return { sev: a.severity, who: plabel(p), what: a.title, detail: a.detail, go: () => open(p) }; }),
    ...contractAlerts(contractsDue(Object.fromEntries(Object.entries(FW).filter(([k, c]) => mine.has(k) || c.country === cid)), TODAY)).map((d) => ({ sev: d.severity as keyof typeof rank, who: 'Contract', what: `${d.name}: ${dueText(d)}`, detail: `${d.ref ? d.ref + ' · ' : ''}${d.noticeBy ? `last day to give notice ${date(d.noticeBy)} · ` : ''}ends ${date(d.end)}`, go: () => setTab('Contracts & suppliers') })),
    ...contractsDue(Object.fromEntries(Object.entries(FW).filter(([k, c]) => (mine.has(k) || c.country === cid) && c.cap)), TODAY, ceilingUse).flatMap((d) => { const sv = ceilingSeverity(d.used, d.cap); return sv ? [{ sev: sv, who: 'Contract', what: `${d.name}: ${pct(d.cap ? d.used / d.cap : 0)} of its ceiling ordered`, detail: `${full(d.used)} of ${full(d.cap!)}`, go: () => setTab('Contracts & suppliers') }] : []; }),
    ...coreDue(core, TODAY).filter((d) => d.severity === 'critical' || d.severity === 'serious' || d.severity === 'warning').map((d) => ({ sev: d.severity as keyof typeof rank, who: 'Core team', what: `${d.m.name}: contract ${d.days! < 0 ? 'ended' : 'ends'} ${date(d.m.end!)}`, detail: d.m.position, go: () => setTab('People') })),
  ].sort((a, b) => rank[a.sev] - rank[b.sev]);
  const [all, setAll] = useState(false);
  const n = (k: keyof typeof rank) => items.filter((x) => x.sev === k).length;
  return <section class="card ca"><div class="card-h"><div><h2>Needs attention in {name}</h2><p>{items.length ? `${n('critical')} critical · ${n('serious')} serious · ${n('warning')} to watch — projects, contracts with providers and the core team in one list` : 'Nothing open: no project alert, no contract or core team contract ending soon.'}</p></div></div>
    {items.length > 0 && <div class="card-b"><ul class="ca-l">{(all ? items : items.slice(0, 8)).map((x) => <li class={`ca-i s-${x.sev}`} onClick={x.go}><span class={`badge ${x.sev}`}>{x.sev}</span><b>{x.who}</b><span>{x.what}<small class="muted">{x.detail}</small></span></li>)}</ul>
      {items.length > 8 && <button class="btn ghost" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all ${items.length}`}</button>}</div>}</section>;
}

/** A stacked bar: each part's share of the whole. */
function Bar({ parts, of }: { parts: [number, string][]; of: number }) {
  return <span class="bud-bar">{parts.map(([v, c]) => <i style={{ width: `${of > 0 ? Math.max(0, Math.min(100, v / of * 100)) : 0}%`, background: c }} />)}</span>;
}

function EvRow({ e }: { e: Ev }) {
  const d = daysUntil(e.day, TODAY);
  return <li class={`cd-e t-${e.tone}`} onClick={() => open(e.p, e.kind === 'contract' ? 'staff' : e.kind === 'report' ? 'reports' : '')}>
    <span class="num cd-d">{date(e.day)}</span><span><b>{plabel(e.p)}</b> · {KIND_LABEL[e.kind]}<small class="muted">{e.title !== 'Project ends' ? ` · ${e.title}` : ''}</small></span>
    <span class={`badge ${d < 0 ? 'critical' : d <= 30 ? 'serious' : d <= 60 ? 'warning' : 'neutral'}`}>{d < 0 ? `${-d} d late` : d === 0 ? 'today' : `${d} d`}</span></li>;
}

/** The country's projects as on the Projects page, opened by a short overview of joint programmes and voluntary contributions. */
export function CountryProjects({ name, cid, P }: { name: string; cid: string; P: Project[] }) {
  const part = (g: 'JP' | 'VC' | 'all') => { const L = g === 'all' ? P : P.filter((p) => programmeOf(p) === g), M = L.map(money); return { n: L.length, run: L.filter(active).length, b: M.reduce((a, m) => a + m.budget, 0), s: M.reduce((a, m) => a + m.spent, 0), c: M.reduce((a, m) => a + m.committed, 0) }; };
  const Card = ({ g, title, k }: { g: 'JP' | 'VC' | 'all'; title: string; k: string }) => { const x = part(g);
    return <div class="bud" style={{ '--k': k } as never}><span class="bud-h">{title}<small>{x.n} project{x.n === 1 ? '' : 's'} · {x.run} running</small></span><b class="bud-v" title={full(x.b)}>{short(x.b)}</b>
      <Bar parts={[[x.s, k], [x.c, `color-mix(in srgb, ${k} 40%, transparent)`]]} of={x.b} />
      <dl><dt>Spent</dt><dd>{full(x.s)} <small>({pct(x.b ? x.s / x.b : 0)})</small></dd><dt>Committed</dt><dd>{full(x.c)}</dd><dt><b>Not yet committed</b></dt><dd><b>{full(x.b - x.s - x.c)}</b></dd></dl></div>; };
  const [v, setV] = useView('pl-proj-view', PROJECT_VIEWS);
  return <>
    <ViewBar views={PROJECT_VIEWS} v={v} set={setV} label="Projects" />
    {v === 'By budget line' ? <BudgetBody P={P} /> : <>
    <section class="bud2" aria-label={`Extraordinary budget and voluntary contributions in ${name}`}>
      <Card g="JP" title="Joint programmes" k="var(--c3)" /><Card g="VC" title="Voluntary contributions" k="var(--c2)" /><Card g="all" title={`All projects in ${name}`} k="var(--c7)" />
    </section>
    <ProjectsBody P={P} country={cid} /></>}
  </>;
}

export function CountryTenders({ name, cid, P, offices }: { name: string; cid: string; P: Project[]; offices: Office[] }) {
  const [pre] = useState<Prefill | null>(() => { const x = pending; pending = null; return x; });
  const cname = () => name;
  const [v, setV] = useView('pl-tender-view', TENDER_VIEWS);
  useEffect(() => { if (pre) { setV('Contracts'); setTimeout(() => document.querySelector('.cc-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80); } }, []);
  return <><ViewBar views={TENDER_VIEWS} v={v} set={setV} label="Contracts and suppliers" />
  <div class="grid g-12">
    {v === 'Providers' && <section class="card span-12"><div class="card-h"><div><h2>Service providers in {name}</h2><p>Orders placed with event organisers, interpreters, consultants, visibility, research and publication providers, from the latest report of each project. The app keeps no tender files: this is what the tenders led to.</p></div>
      <div class="tools"><button class="btn" onClick={() => go('reports/providers')}>All providers ›</button></div></div>
      <div class="card-b"><CountryProviders P={P} cname={cname} /></div></section>}
    {v === 'Contracts' && <ContractCalendar name={name} cid={cid} P={P} pre={pre} offices={offices} />}
  </div></>;
}

/** The office's own services by budget line (rent, cleaning, security…), each with its contract or a way to add it. */
export function OfficeServices({ cid, offices }: { cid: string; offices: Office[] }) {
  const FW = useStore((s) => s.ledger.frameworks) ?? {};
  const rep = offices[0]?.reports.at(-1), OS = rep ? officeServices(rep) : [];
  const okey = (line: string, sup: string) => `office:${cid}:${line}:${supKey(sup)}`;
  return <section class="card span-12"><div class="card-h"><div><h2>Office services</h2><p>{rep ? <>The office's own services by budget line, from the office report of {date(rep.date)}: what each is, read from its order descriptions, and the period the orders cover. Add the contract to have its end warned; it is kept under Contracts &amp; suppliers with the projects' contracts. Petty cash, missions and internal regularisations are left out.</> : 'No office budget imported for this country.'}</p></div></div>
      {OS.length > 0 && <div class="card-b table-scroll"><table class="mini os-t"><thead><tr><th>Budget line</th><th>Service</th><th>Supplier</th><th class="r">Orders</th><th>Orders cover to</th><th class="r">Spent + committed</th><th class="r">Still open</th><th>Contract</th></tr></thead>
        <tbody>{OS.map((x, i) => { const k = okey(x.line, x.supplier), c = FW[k] ?? FW[supKey(x.supplier)], due = c?.end || c?.openEnded ? contractsDue({ [k]: c }, TODAY)[0] : undefined;
          return <tr class={i && OS[i - 1].line === x.line ? 'same' : ''}><td>{i && OS[i - 1].line === x.line ? '' : <><span class="num">{x.line}</span> <span class="muted">{x.lineName}</span></>}</td>
            <td><b>{x.kind}</b></td><td><Firm name={x.supplier} /></td>
            <td class="r num" title={[...new Set(x.orders.map((o) => o.description))].join('\n')}>{x.orders.length}</td>
            <td class="num" title={x.coverText}>{x.covers ? date(x.covers) : '—'}</td>
            <td class="r num">{full(x.amount)}</td><td class="r num">{x.open > 0.5 ? full(x.open) : ''}</td>
            <td>{due ? <span class={`badge ${due.openEnded ? 'neutral' : SEV_BADGE[due.severity]}`} title={due.openEnded ? 'No end date: nothing to warn' : `${c!.ref ?? ''} ends ${date(due.end)}`}>{dueText(due)}</span>
              : x.directDebit ? <span class="badge neutral" title="Paid by direct debit: a standing service with no end date, so nothing to warn">open-ended · direct debit</span>
              : <button class="btn ghost os-add" onClick={() => { pending = { n: Date.now(), key: k, sup: x.supplier, line: x.line, kind: x.kind, end: x.covers ?? '' }; go(`countries/${cid}/contracts`); }}>+ Contract</button>}</td></tr>; })}</tbody></table></div>}
    </section>;
}

/** A tab split into views opened one at a time, the last one remembered (long pages stay short). */
export function useView<T extends string>(key: string, views: readonly T[]): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => { try { const x = localStorage.getItem(key) as T; return views.includes(x) ? x : views[0]; } catch { return views[0]; } });
  return [v, (x: T) => { setV(x); try { localStorage.setItem(key, x); } catch { /* the view still changes */ } }];
}
export function ViewBar<T extends string>({ views, v, set, label, counts = {} }: { views: readonly T[]; v: T; set: (x: T) => void; label: string; counts?: Partial<Record<T, number>> }) {
  return <div class="seg of-views cd-views" role="tablist" aria-label={label}>{views.map((x) => <button role="tab" aria-pressed={v === x} onClick={() => set(x)}>{x}{counts[x] != null ? <span class="tab-n">{counts[x]}</span> : null}</button>)}</div>;
}
const STAFF_VIEWS = ['Everyone', 'Core team', 'Project staff', 'Staff plan', 'Salary scale'] as const;
const TENDER_VIEWS = ['Contracts', 'Providers'] as const;
const PROJECT_VIEWS = ['Projects', 'By budget line'] as const;
/** An office service whose contract is to be added: handed from the Office tab to the contract form. */
let pending: Prefill | null = null;

export function CountryStaff({ name, cid, P }: { name: string; cid: string; P: Project[] }) {
  const everyone = allPeople(P);
  const [b, setB] = useState<'all' | Base>('all');
  const people = everyone.filter((a) => b === 'all' || a.base === b);
  const [v, setV] = useView('pl-staff-view', STAFF_VIEWS);
  const core = useStore((s) => s.ledger.coreTeam?.[cid]) ?? [];
  return <>
    <ViewBar views={STAFF_VIEWS} v={v} set={setV} label="Staff" counts={{ 'Core team': core.length, 'Project staff': everyone.filter((a) => a.status === 'Active').length }} />
    {v === 'Everyone' && (core.length || everyone.length ? <PeopleOfCountry name={name} cid={cid} P={P} /> : <div class="card empty-page"><div><h2>No one recorded in {name} yet</h2><p>Add the core team under “Core team”; project staff come from the reports.</p></div></div>)}
    {v === 'Core team' && <CoreTeam name={name} cid={cid} P={P} />}
    {v === 'Project staff' && <><section class="card"><div class="card-h" style={{ alignItems: 'center' }}><div><h2>Project staff in {name}</h2><p>Staff on the projects, read from the “Purchase Orders” sheet of each project's report workbook</p></div>
      {everyone.length > 0 && <div class="seg" role="group" aria-label="Base">{(['all', 'Local', 'HQ'] as const).map((x) => <button aria-pressed={b === x} onClick={() => setB(x)}>{x === 'all' ? 'All staff' : x === 'HQ' ? 'SxB / HQ' : 'Local'}</button>)}</div>}</div></section>
      {everyone.length ? <StaffBoard people={people} showProject /> : <div class="card empty-page"><div><h2>No project staff records for {name}</h2><p>Staff are read from the “Purchase Orders” sheet of each project's report workbook.</p></div></div>}</>}
    {v === 'Staff plan' && <div class="grid g-12"><StaffPlanTable projects={P} /><StaffReport projects={P} /></div>}
    {v === 'Salary scale' && <SalarySection countryIds={[cid]} />}
  </>;
}

/** Everyone working for the country once: core team and project contracts of the same person together. */
/** The country's providers in total, with what each project placed, or one project's alone. */
function CountryProviders({ P, cname }: { P: Project[]; cname: (id: string) => string }) {
  const set = useStore((x) => x.ledger.poKinds) ?? {};
  const [pj, setPj] = useState('all');
  const R = P.map((p) => ({ p, S: providerSummary([p], set, 1) })).filter((x) => x.S.total > 0).sort((a, b) => b.S.total - a.S.total);
  const T = R.reduce((a, x) => a + x.S.total, 0), one = R.find((x) => x.p.id === pj);
  const lab = (id: string) => plabel(P.find((q) => q.id === id) ?? ({ code: '?' } as Project));
  return <>
    {R.length > 1 && <div class="seg sp-scope" role="group" aria-label="Projects">{[['all', 'All projects'], ...R.map((x) => [x.p.id, plabel(x.p)])].map(([k, l]) => <button aria-pressed={(one ? pj : 'all') === k} onClick={() => setPj(k)}>{l}</button>)}</div>}
    {!one && R.length > 1 && <table class="mini sp-proj"><thead><tr><th>Project</th><th class="r">POs</th><th class="r">Providers</th><th class="r">Amount</th><th class="r">Share</th><th>Largest provider</th></tr></thead>
      <tbody>{R.map(({ p, S }) => <tr class="click" onClick={() => setPj(p.id)}><td><b>{plabel(p)}</b></td><td class="r num">{S.pos}</td><td class="r num">{S.providers}</td><td class="r num">{full(S.total)}</td><td class="r num">{Math.round(S.total / T * 100)}%</td><td class="muted">{S.top[0]?.supplier ?? '—'}</td></tr>)}
        <tr class="tot"><td><b>Total</b></td><td class="r num">{R.reduce((a, x) => a + x.S.pos, 0)}</td><td /><td class="r num"><b>{full(T)}</b></td><td class="r num">100%</td><td /></tr></tbody></table>}
    <ProviderBrief P={one ? [one.p] : P} cname={cname} rows={6} lab={one ? undefined : lab} />
    <ProviderList P={one ? [one.p] : P} lab={one ? undefined : lab} />
  </>;
}

/** Every provider of the projects shown, one group per kind (largest first), each provider with its projects and what is still open. */
function ProviderList({ P, lab }: { P: Project[]; lab?: (id: string) => string }) {
  const set = useStore((x) => x.ledger.poKinds) ?? {};
  const S = suppliers(providerPOs(P, set)).filter((x) => x.kind && !KINDS.find((k) => k.k === x.kind)?.optional);
  const G = [...new Set(S.map((x) => x.kind))].map((k) => ({ k, label: KINDS.find((x) => x.k === k)?.label ?? k, R: S.filter((x) => x.kind === k) })).map((g) => ({ ...g, sc: g.R.reduce((a, x) => a + x.sc, 0), sp: g.R.reduce((a, x) => a + x.spent, 0) })).sort((a, b) => b.sc - a.sc);
  if (!G.length) return null;
  return <div class="sp-list"><h3>All providers, by kind <small class="muted">{S.length} · click a kind to open it</small></h3>
    {G.map((g) => <details class="sp-grp">
      <summary><i class="sp-dot" style={{ background: KINDS.find((x) => x.k === g.k)?.color }} /><b>{g.label}</b><span class="muted">{g.R.length} provider{g.R.length > 1 ? 's' : ''}</span><span class="num">{full(g.sc)}</span></summary>
      <table class="mini"><thead><tr><th>Provider</th>{lab && <th>Projects</th>}<th class="r">Orders</th><th class="r">Spent</th><th class="r">Still open</th><th class="r">Spent + committed</th><th>Kind</th></tr></thead>
        <tbody>{g.R.map((x) => <tr><td><Firm name={x.supplier} /></td>{lab && <td class="muted">{[...x.projects.keys()].map(lab).join(', ')}</td>}<td class="r num">{x.pos}</td><td class="r num">{full(x.spent)}</td><td class="r num">{full(x.sc - x.spent)}</td><td class="r num"><b>{full(x.sc)}</b></td>
          <td><select class="select sp-kind" aria-label={`Kind of ${x.supplier}`} title="Change the kind of every order of this provider" value={set[`sup|${supKey(x.supplier)}`] ?? ''} onChange={(e) => setPoKind(`sup|${supKey(x.supplier)}`, (e.target as HTMLSelectElement).value)}>
            <option value="">{KINDS.find((k) => k.k === x.kind)?.label ?? x.kind} (automatic)</option>{KINDS.filter((k) => !k.optional).map((k) => <option value={k.k}>{k.label}</option>)}<option value="none">Not a service provider</option></select></td></tr>)}</tbody></table>
    </details>)}</div>;
}

const NO_END = { open: 'Open-ended', sxb: 'SxB staff', missing: 'Dates missing' } as const;
function PeopleOfCountry({ name, cid, P }: { name: string; cid: string; P: Project[] }) {
  const core = useStore((s) => s.ledger.coreTeam?.[cid]) ?? [];
  const L = countryPeople(core, allPeople(P).filter((a) => a.status !== 'Ended'), (p) => plabel(p as Project));
  const [by, setBy] = useState<'project' | 'end' | 'name'>('project'), [mode, setMode] = useState<'cards' | 'list'>('cards'), [q, setQ] = useState(''), [soon, setSoon] = useState(false);
  if (!L.length) return null;
  // each project its own colour, the same on the avatar, the chip and the bar
  const projs = [...new Set(L.flatMap((x) => x.roles.map((r) => r.project)))].sort();
  const col = (pr: string) => `var(--c${(projs.indexOf(pr) % 8) + 1})`;
  const days = (x: CountryPerson) => (x.ends ? daysUntil(x.ends, TODAY) : null);
  const ending = L.filter((x) => { const d = days(x); return d != null && d >= 0 && d <= 90; });
  const shown = L.filter((x) => (!soon || ending.includes(x)) && (!q || `${x.name} ${x.core?.position ?? ''} ${x.roles.map((r) => `${r.position} ${r.project}`).join(' ')}`.toLowerCase().includes(q.toLowerCase())));
  const key = (x: CountryPerson) => by === 'project' ? (x.core ? 'Core team' : x.roles[0]?.project ?? '—') : by === 'end' ? (x.ends ? (days(x)! < 0 ? 'Ended' : days(x)! <= 90 ? 'Ending within 90 days' : days(x)! <= 365 ? 'Ending within a year' : 'Later') : NO_END[x.noEnd ?? 'missing']) : x.name.replace(/^[^A-Za-zÇĞİÖŞÜçğıöşü]*/, '').charAt(0).toUpperCase();
  const order = by === 'end' ? ['Ended', 'Ending within 90 days', 'Ending within a year', 'Later', NO_END.open, NO_END.sxb, NO_END.missing] : null;
  const groups = [...new Set(shown.map(key))].sort((a, b2) => order ? order.indexOf(a) - order.indexOf(b2) : a === 'Core team' ? -1 : b2 === 'Core team' ? 1 : a.localeCompare(b2));
  const initials = (n: string) => n.replace(/,/g, ' ').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const checks = L.filter((x) => x.check).length, nn = (k: CountryPerson['noEnd']) => L.filter((x) => x.noEnd === k).length;
  // when every contract in the window ends the same day (yearly contracts), say so: the count is one renewal, not twenty surprises
  const endDays = [...new Set(ending.map((x) => x.ends))];
  const sxb = (x: CountryPerson) => !x.core && x.roles.some((r) => r.base === 'HQ');
  const mix = [{ l: 'core team', n: L.filter((x) => x.core).length, c: 'var(--ink-2)' }, { l: 'local project staff', n: L.filter((x) => !x.core && x.roles.length && !sxb(x)).length, c: 'var(--c1)' }, { l: 'SxB staff', n: L.filter(sxb).length, c: 'var(--c7)' }];
  // positions written in capitals in the lists read as the rest of the page
  const soft = (t: string) => (/[A-Z]{3}/.test(t) && !/[a-z]/.test(t) ? t.charAt(0) + t.slice(1).toLowerCase() : t);
  return <section class="card ev">
    <div class="card-h" style={{ alignItems: 'center' }}><div><h2>Everyone in {name}</h2><p>Each person once — the core team and the project contracts of the same person together</p></div>
      <div class="tools ev-tools"><input class="input" type="search" placeholder="Find a person or a role" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} aria-label="Find a person" />
        <div class="seg" role="group" aria-label="Group by">{([['project', 'By project'], ['end', 'By contract end'], ['name', 'A–Z']] as const).map(([k, l]) => <button aria-pressed={by === k} onClick={() => setBy(k)}>{l}</button>)}</div>
        <div class="seg" role="group" aria-label="Show as">{([['cards', 'Cards'], ['list', 'List']] as const).map(([k, l]) => <button aria-pressed={mode === k} onClick={() => setMode(k)}>{l}</button>)}</div></div></div>
    {/* who the people are, as one bar with its parts named; then where their contracts stand */}
    <div class="ev-ov">
      <div class="ev-tot"><b>{L.length}</b><span>people</span></div>
      <div class="ev-mix">
        <div class="ev-mix-bar" aria-hidden="true">{mix.filter((m) => m.n).map((m) => <i style={{ flex: m.n, background: m.c }} title={`${m.l}: ${m.n}`} />)}</div>
        <div class="ev-mix-l">{mix.filter((m) => m.n).map((m) => <span><i style={{ background: m.c }} /><b>{m.n}</b> {m.l}</span>)}</div>
      </div>
      <div class="ev-st">
        {ending.length > 0 && <button class={`ev-soon${soon ? ' on' : ''}`} aria-pressed={soon} onClick={() => setSoon(!soon)}><i class="ev-st-d warn" /><span><b>{ending.length}</b> contract{ending.length > 1 ? 's' : ''} end within 90 days{endDays.length === 1 ? <>, all on {date(endDays[0])}</> : ''}</span><em>{soon ? 'Show everyone' : 'Show them'}</em></button>}
        {nn('missing') > 0 && <div><i class="ev-st-d bad" /><span><b>{nn('missing')}</b> without contract dates — complete them under Core team or the project's Staff tab</span></div>}
        {nn('open') > 0 && <div><i class="ev-st-d" /><span><b>{nn('open')}</b> open-ended: head of office, head of operations</span></div>}
        {checks > 0 && <div class="ev-chk"><i class="ev-st-d bad" /><span><b>{checks}</b> to check: on the core team and on a project's staff list</span></div>}
      </div>
    </div>
    <div class="card-b">{groups.map((g) => { const R = shown.filter((x) => key(x) === g).sort((a, b2) => by === 'end' ? (a.ends || '9').localeCompare(b2.ends || '9') : a.name.localeCompare(b2.name));
      return <div class="ev-g"><h3><span class="ev-dot" style={{ background: by === 'project' && g !== 'Core team' ? col(g) : 'var(--ink-3)' }} />{g}<small>{R.length}</small></h3>
        {mode === 'cards' ? <div class="ev-board">{R.map((x) => { const d = days(x), pr = x.roles[0]?.project, tone = d == null ? (x.noEnd === 'missing' ? 'missing' : 'open') : d < 0 ? 'ended' : d <= 30 ? 'critical' : d <= 60 ? 'serious' : d <= 90 ? 'warning' : 'ok';
          const chips = [...new Set(x.roles.map((r) => r.project))].filter((p2) => by !== 'project' || p2 !== g);
          return <article class={`ev-card t-${tone}${x.check ? ' chk' : ''}`} style={{ '--k': x.core ? 'var(--ink-2)' : pr ? col(pr) : 'var(--ink-3)' } as never}>
            <span class="ev-av" aria-hidden="true">{initials(x.name)}</span>
            <span class="ev-who"><b class="ev-n"><Who name={x.name} k={x.key} /></b>
              <small class="ev-r">{[x.core && soft(x.core.position), ...[...new Set(x.roles.map((r) => soft(r.position)))]].filter(Boolean).join(' · ') || '—'}</small>
              {(x.core || chips.length > 0) && <span class="ev-chips">{x.core && <span class="ev-chip core">Core team{(x.core.fund !== 'other' || x.core.fundText) ? ` · ${x.core.fund === 'project' ? `${plabel(P.find((p) => p.id === x.core!.project) ?? ({ code: '?' } as Project))}${x.core.share ? ` ${x.core.share}%` : ''}` : fundLabel(x.core)}` : ''}</span>}
                {chips.map((p2) => <span class="ev-chip" style={{ '--k': col(p2) } as never}>{p2}</span>)}</span>}
              {x.check && <em class="ev-c">{x.check}</em>}</span>
            <span class="ev-f" title={x.ends ? `Contract ends ${date(x.ends)}` : NO_END[x.noEnd ?? 'missing']}>{x.ends ? <><span class="num">{date(x.ends)}</span>{d != null && d >= 0 && d <= 90 ? <span class="ev-days">{d} d</span> : d != null && d < 0 ? <span class="ev-days">ended</span> : null}</> : <span class="ev-ne">{NO_END[x.noEnd ?? 'missing']}</span>}</span>
          </article>; })}</div>
        : <ul class="ev-l">{R.map((x) => { const d = days(x), pr = x.roles[0]?.project;
          return <li class={x.check ? 'chk' : ''}>
            <span class="ev-av" style={{ background: x.core ? 'var(--ink-2)' : pr ? col(pr) : 'var(--ink-3)' }}>{initials(x.name)}</span>
            <span class="ev-who"><b><Who name={x.name} k={x.key} /></b><small>{[x.core && `${x.core.position} · core team`, ...[...new Set(x.roles.map((r) => r.position))]].filter(Boolean).join(' · ')}</small>{x.check && <em>{x.check}</em>}</span>
            <span class="ev-chips">{x.core && (x.core.fund !== 'other' || x.core.fundText) && <span class="ev-chip core">{x.core.fund === 'project' ? `${plabel(P.find((p) => p.id === x.core!.project) ?? ({ code: '?' } as Project))}${x.core.share ? ` ${x.core.share}%` : ''}` : fundLabel(x.core)}</span>}
              {[...new Set(x.roles.map((r) => r.project))].map((p2) => <span class="ev-chip" style={{ '--k': col(p2) } as never}>{p2}</span>)}</span>
            <span class="ev-end">{x.ends ? <><span class="num">{date(x.ends)}</span>{d != null && d >= 0 && d <= 90 ? <span class={`badge ${d <= 30 ? 'critical' : d <= 60 ? 'serious' : 'warning'}`}>{d} days</span> : d != null && d < 0 ? <span class="badge neutral">ended</span> : null}</> : <span class="muted">{NO_END[x.noEnd ?? 'missing']}</span>}</span>
          </li>; })}</ul>}</div>; })}
      {!shown.length && <p class="muted">No one matches.</p>}</div>
  </section>;
}

const EMPTY = { name: '', position: '', grade: '', start: '', end: '', fund: 'ob', project: '', share: '', note: '' };
/** A screen with nothing in it yet: what it will hold and the one thing to do. */
export function Empty({ icon, title, text, children }: { icon: IcoName; title: string; text: string; children?: ComponentChildren }) {
  return <div class="es"><span class="es-i" aria-hidden="true"><Ico n={icon} size={22} /></span><h3>{title}</h3><p>{text}</p>{children && <div class="es-a">{children}</div>}</div>;
}

/** The office's own team: entered by hand, with contract ends warned like contracts with providers. */
function CoreTeam({ name, cid, P }: { name: string; cid: string; P: Project[] }) {
  const M = useStore((s) => s.ledger.coreTeam?.[cid]) ?? [];
  const [f, setF] = useState(EMPTY), [edit, setEdit] = useState(''), [adding, setAdding] = useState(false);
  const D = coreDue(M, TODAY), on = M.filter((m) => onTeam(m, TODAY));
  const v = (k: keyof typeof EMPTY) => ({ value: f[k], onInput: (e: Event) => setF({ ...f, [k]: (e.target as HTMLInputElement).value }) });
  const save = () => {
    if (!f.name.trim() || !f.position.trim()) return;
    const m: CoreMember = { id: edit || `ct${Date.now().toString(36)}`, name: f.name.trim(), position: f.position.trim(), fund: f.fund as CoreMember['fund'],
      ...(f.grade.trim() ? { grade: f.grade.trim() } : {}), ...(f.start ? { start: f.start } : {}), ...(f.end ? { end: f.end } : {}),
      ...(f.fund === 'project' && f.project ? { project: f.project, ...(+f.share > 0 ? { share: Math.min(100, +f.share) } : {}) } : {}), ...(f.note.trim() ? { note: f.note.trim() } : {}) };
    setCoreMember(cid, m); setF(EMPTY); setEdit('');
  };
  const importList = async (e: Event) => {
    const inp = e.target as HTMLInputElement, file = inp.files?.[0]; inp.value = ''; if (!file) return;
    try { const wb = await readXlsx(await file.arrayBuffer()), found = wb.sheets.map((sh) => coreFromRows(wb.read(sh))).find((L) => L.length) ?? [];
      const n = found.length ? addCoreMembers(cid, found) : 0;
      alert(found.length ? `${n} added to the core team of ${name}${found.length > n ? `; ${found.length - n} already on it` : ''}.` : 'No heading row with a name and a position column was found in this file.');
    } catch { alert('This file could not be read as an Excel workbook.'); }
  };
  const load = (m: CoreMember) => { setF({ name: m.name, position: m.position, grade: m.grade ?? '', start: m.start ?? '', end: m.end ?? '', fund: m.fund ?? 'ob', project: m.project ?? '', share: m.share ? String(m.share) : '', note: m.note ?? '' }); setEdit(m.id); };
  // a post charged to a project: is the person on that project's staff list?
  const onProject = (m: CoreMember) => { const p = P.find((x) => x.id === m.project); if (!p) return null; const k = n2(m.name); return allPeople([p]).some((a) => n2(a.name) === k || n2(a.display) === k); };
  const todo = M.filter((m) => (!m.end && !openPost(m)) || (m.fund === 'other' && !m.fundText)).length, open = M.filter((m) => openPost(m)).length;
  const soft = (t: string) => (/[A-Z]{3}/.test(t) && !/[a-z]/.test(t) ? t.charAt(0) + t.slice(1).toLowerCase() : t);
  const initials = (n: string) => n.replace(/,/g, ' ').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const formOpen = adding || !!edit;
  const Import = ({ primary }: { primary?: boolean }) => <label class={`btn ${primary ? 'primary' : 'ghost'}`} title="A sheet with a heading row: Name, Position, Grade, Start, End, Funded by"><Ico n="upload" />Import from Excel<input type="file" accept=".xlsx" hidden onChange={importList} /></label>;
  return <section class="card cc"><div class="card-h"><div><h2>Core team</h2><p>The office's own staff in {name}, outside the projects · contract ends are warned 90, 60 and 30 days ahead, here, in the calendar and in the bell</p></div>
      <div class="tools"><Import />{!formOpen && <button class="btn primary" onClick={() => setAdding(true)}>+ Add a person</button>}</div></div>
    <div class="card-b">
      {M.length > 0 && <div class="ct-sum"><span><b>{on.length}</b> on the team today</span>{open > 0 && <span><b>{open}</b> open-ended (head of office, head of operations)</span>}{todo > 0 && <span class="todo"><b>{todo}</b> to complete: an end date or what pays for the post — fill them in the table</span>}</div>}
      {formOpen && <form class="cc-form" onSubmit={(e) => { e.preventDefault(); save(); setAdding(false); }}>
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
        <button class="btn ghost" type="button" onClick={() => { setEdit(''); setF(EMPTY); setAdding(false); }}>Cancel</button>
      </form>}
      {D.length ? <div class="table-scroll"><table class="mini ct-t"><thead><tr><th>Person</th><th>Grade</th><th>Paid from</th><th>Contract</th><th /></tr></thead>
        <tbody>{D.map(({ m, days, severity }) => { const p = P.find((x) => x.id === m.project), seen = m.fund === 'project' ? onProject(m) : null, noFund = m.fund === 'other' && !m.fundText, noEnd = !m.end && !openPost(m);
          return <tr class={`${onTeam(m, TODAY) ? '' : 'muted'}${noFund || noEnd ? ' ct-todo' : ''}`}>
            <td><span class="ct-p"><span class="ct-av" aria-hidden="true">{initials(m.name)}</span><span><b><Who name={m.name} /></b><small>{soft(m.position)}{m.note ? ` · ${m.note}` : ''}</small></span></span></td>
            <td class="num">{m.grade ?? <span class="muted">—</span>}</td>
            <td>{noFund ? <select class="select ct-in" aria-label={`What pays for the post of ${m.name}`} value="" onChange={(e) => { const k = (e.target as HTMLSelectElement).value; if (k) setCoreMember(cid, { ...m, fund: k as CoreMember['fund'] }); }}><option value="">Choose…</option>{Object.entries(FUND_LABEL).filter(([k]) => k !== 'other' && k !== 'project').map(([k, l]) => <option value={k}>{l}</option>)}</select>
              : m.fund === 'project' && p ? <>{plabel(p)}{m.share ? ` · ${m.share}%` : ''} {seen != null && <span class={`badge ${seen ? 'good' : 'warning'}`} title={seen ? 'The person is on the project\'s staff list' : 'Not found on the project\'s staff list: check the charging'}>{seen ? 'on the project' : 'not on its staff list'}</span>}</> : fundLabel(m)}</td>
            <td><span class="ct-c">{m.start && <span class="num">{date(m.start)} –</span>}
              {m.end ? <><span class="num">{date(m.end)}</span>{days != null && <span class={`badge ${SEV_BADGE[severity as ContractDue['severity']]}`}>{days < 0 ? `ended ${-days} d ago` : days === 0 ? 'ends today' : `${days} d left`}</span>}</>
                : noEnd ? <input type="date" class="ct-in" aria-label={`Contract end of ${m.name}`} title="Type the end date: it is saved at once" onChange={(e) => { const d = (e.target as HTMLInputElement).value; if (d) setCoreMember(cid, { ...m, end: d }); }} />
                : <span class="muted">open-ended</span>}</span></td>
            <td class="ct-act"><Attach doc={m.doc} label={`the contract of ${m.name}`} save={(doc) => setCoreMember(cid, { ...m, doc })} /><button class="btn ghost" title="Change" onClick={() => load(m)}><Ico n="edit" /></button><button class="btn ghost" title="Remove (admin)" onClick={() => { if (confirm(`Remove ${m.name} from the core team?`)) removeCoreMember(cid, m.id); }}>✕</button></td></tr>; })}</tbody></table></div>
        : !formOpen && <Empty icon="people" title={`No core team for ${name} yet`} text="The office's own staff, outside the projects: their contract ends are warned like those of providers, 90, 60 and 30 days ahead.">
            <Import primary /><button class="btn" onClick={() => setAdding(true)}>+ Add a person</button></Empty>}
    </div></section>;
}

/** What falls when in a country: reports, staff, core team and provider contracts, activities and project ends, on a calendar. */
export function CountryDeadlines({ name, cid, P }: { name: string; cid: string; P: Project[] }) {
  const core = useStore((s) => s.ledger.coreTeam?.[cid]) ?? [];
  const FW = useStore((s) => s.ledger.frameworks) ?? {}, set = useStore((s) => s.ledger.poKinds) ?? {};
  const items = calItems(P, [[cid, core]], FW, set);
  return <CalendarView items={items} kinds={CAL_KINDS} title={`Calendar of ${name}`} />;
}


/** Contracts of the country's providers on a calendar: each from its start to its end, warned 90, 60 and 30 days before. */
/** A contract to add, filled in from an office service. */
/** The known name closest to a name read from a document (most words alike), when more than half of its words match. */
function closest(name: string, known: string[]) {
  // a scan reads ü as "ii" and drops letters: words are alike when they differ by at most two letters
  const fold = (t: string) => t.toLocaleLowerCase('tr').normalize('NFD').replace(/\p{M}/gu, '').replace(/ı/g, 'i').replace(/ii/g, 'u');
  const w = (s: string) => [...new Set(fold(supKey(s)).split(/[^a-z0-9]+/).filter((x) => x.length > 2))];
  const lev = (a: string, b: string) => { const d = Array.from({ length: b.length + 1 }, (_, j) => j); for (let i = 1; i <= a.length; i++) { let p = d[0]; d[0] = i; for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, p + (a[i - 1] === b[j - 1] ? 0 : 1)); p = t; } } return d[b.length]; };
  const like = (x: string, y: string) => x === y || (Math.min(x.length, y.length) >= 5 && lev(x, y) <= 2);
  const a = w(name); let best: string | undefined, score = 0.5;
  for (const k of known) { const b = w(k), n = a.filter((x) => b.some((y) => like(x, y))).length / Math.max(1, Math.min(a.length, b.length)); if (n > score) { score = n; best = k; } }
  return best;
}
/** A document of a contract by its kind and number. */
const stepName = (k: string, no?: number) => (k === 'original' ? 'Contract' : `${k.charAt(0).toUpperCase()}${k.slice(1)}${no ? ` ${no}` : ''}`);
const EMPTY_C = { sup: '', ref: '', cap: '', start: '', end: '', open: false, renew: '', fee: '', total: '', cur: 'EUR', every: '', auto: false, notice: '' };
/** How a contract is renewed, in words. */
const everyText = (v?: string) => !v ? '' : v === 'month' ? 'monthly' : v === 'quarter' ? 'quarterly' : v === 'year' ? 'yearly' : `every ${v} months`;
const noticeBy = (end?: string, days?: number) => (end && days ? new Date(Date.parse(end) - days * 864e5).toISOString().slice(0, 10) : '');
/** Whole months a contract covers, its first day to its last (1 Jan – 31 Dec = 12). */
const monthsOf = (a: string, b: string) => Math.max(1, Math.round(((Date.parse(b) - Date.parse(a)) / 864e5 + 1) / 30.4375));
const amt = (v: number, cur = 'EUR') => cur === 'EUR' ? full(v) : `${v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;
export interface Prefill { n: number; key: string; sup: string; line: string; kind: string; end: string }
export function ContractCalendar({ name, cid, P, pre, offices = [] }: { name: string; cid: string; P: Project[]; pre?: Prefill | null; offices?: Office[] }) {
  const set = useStore((s) => s.ledger.poKinds) ?? {}, FW = useStore((s) => s.ledger.frameworks) ?? {};
  const L = providerPOs(P, set);
  const names = new Map<string, string>(); for (const x of L) if (x.kind && x.supplier.trim()) names.set(supKey(x.supplier), x.supplier.trim());
  // an office contract is used by the office's own orders on its line; a provider's, by the projects' orders
  const entries = offices.flatMap((o) => o.reports.at(-1)?.entries ?? []);
  const use = (k: string) => { const c = FW[k];
    if (c?.line) { const sk = k.split(':').slice(3).join(':'); return { name: c.name, used: officeContractUse(entries, c.line, (s) => supKey(s) === sk) }; }
    return { name: names.get(k), used: L.filter((x) => x.kind && supKey(x.supplier) === k).reduce((a, x) => a + x.value, 0) }; };
  // the country's contracts: those of its providers, and those entered here by name
  const D = contractsDue(Object.fromEntries(Object.entries(FW).filter(([k, c]) => names.has(k) || c.country === cid)), TODAY, use);
  const noEnd = Object.entries(FW).filter(([k, c]) => names.has(k) && !c.end && !c.openEnded);
  const [f, setF] = useState(EMPTY_C);
  const [edit, setEdit] = useState(''), [meta, setMeta] = useState<{ line?: string; kind?: string }>({});
  const [doc, setDoc] = useState<Attachment | null>(null), [readMsg, setReadMsg] = useState('');
  // an office service chosen in the table: its supplier, budget line and kind; the end its orders cover, to confirm
  useEffect(() => { if (pre) { setF({ ...EMPTY_C, sup: pre.sup, end: pre.end }); setEdit(pre.key); setMeta({ line: pre.line, kind: pre.kind }); } }, [pre?.n]);
  const save = () => {
    const name = f.sup.trim(); if (!name || (!f.end && !f.open)) return;
    const k = edit || supKey(name);
    const att = doc ?? FW[k]?.doc;
    setFramework(k, { name, ...(att ? { doc: att } : {}), ...(meta.line ? { line: meta.line, kind: meta.kind } : {}), ...(names.has(k) && !meta.line ? {} : { country: cid }), ...(f.ref.trim() ? { ref: f.ref.trim() } : {}), ...(+f.cap > 0 ? { cap: Math.round(+f.cap * 100) / 100 } : {}), ...(f.start ? { start: f.start } : {}), ...(f.open ? { openEnded: true } : { end: f.end }), ...(f.renew && !f.open && f.renew > f.end ? { renewBy: f.renew } : {}), ...(+f.fee > 0 ? { fee: Math.round(+f.fee * 100) / 100 } : {}), ...(+f.total > 0 ? { total: Math.round(+f.total * 100) / 100 } : {}), ...(+f.fee > 0 || +f.total > 0 ? { cur: f.cur } : {}), ...(f.every ? { renewEvery: f.every } : {}), ...(f.auto ? { autoRenew: true } : {}), ...(+f.notice > 0 ? { noticeDays: Math.round(+f.notice) } : {}) });
    setF(EMPTY_C); setEdit(''); setMeta({}); setDoc(null); setReadMsg('');
  };
  // the terms read from the contract itself (a PDF or Word with text); a scan is attached and its terms typed
  const [over, setOver] = useState(false);
  const allNames = [...new Set([...names.values(), ...offices.flatMap((o) => (o.reports.at(-1)?.entries ?? []).map((e) => e.supplier.trim())).filter(Boolean)])];
  const readContract = async (file?: File) => {
    if (!file) return;
    if (!/\.(pdf|docx)$/i.test(file.name)) { setReadMsg(`${file.name}: drop the contract as PDF or Word (.docx).`); return; }
    const att = await readAttachment(file); if (typeof att === 'string') { setReadMsg(att); return; }
    setDoc(att); setReadMsg('Reading…'); setAmend(null);
    let t: ContractTerms = {};
    // a PDF read line by line in page order (a label and its value stay together); Word as paragraphs and tables
    try { t = contractTerms(/\.pdf$/i.test(file.name) ? (await readPages(file)).map((x) => x.text).join(' ') : (({ paragraphs: P0, tables }) => [...P0, ...tables.flat(2)].join(' '))(await readDocument(file))); } catch { /* attached all the same */ }
    // nothing in the text layer (a scan, or only an e-signature stamp): the pages are read as images
    let ocr = false;
    if (/\.pdf$/i.test(file.name) && !t.ref && !t.end && !t.provider) {
      try { const txt = await ocrPdf(file, 6, setReadMsg); t = contractTerms(txt); ocr = true; }
      catch (x) { setReadMsg(`${file.name} is a scanned copy and ${(x as Error).message}: it is kept with the contract. Type the dates and amounts from it.`); return; }
    }
    const scan = ocr ? ' (a scanned copy, read from its image: check each figure)' : '';
    // a rider, amendment or addendum: the contract it changes, found by its reference or its provider
    if (t.amend) {
      const norm = (r?: string) => (r ?? '').replace(/\s+/g, '').toUpperCase();
      const byRef = Object.entries(FW).find(([, c]) => t.ref && norm(c.ref) === norm(t.ref));
      const who = t.provider ? closest(t.provider, Object.values(FW).map((c) => c.name ?? '').filter(Boolean)) : undefined;
      const base = byRef ?? Object.entries(FW).find(([, c]) => who && c.name === who);
      if (base) { setAmend({ key: base[0], t, doc: att, file: file.name, scan }); setReadMsg(''); return; }
      setReadMsg(`${file.name} is ${t.amend.kind === 'amendment' ? 'an amendment' : `a ${t.amend.kind}`} to ${t.ref ?? 'a contract'} that is not in the app yet: enter the contract first (or save this one as the contract) — its terms are in the form below.`);
    }
    // the provider as the orders spell it, when the contract's spelling is close enough
    const known = t.provider ? closest(t.provider, allNames) : undefined;
    setF((f0) => ({ ...f0, sup: f0.sup || known || t.provider || '', ref: t.ref ?? f0.ref, start: t.start ?? f0.start, end: t.end ?? f0.end, open: t.end ? false : f0.open, renew: t.renewBy ?? f0.renew, total: t.total ? String(t.total) : f0.total, fee: t.fee ? String(t.fee) : f0.fee, cur: t.cur ?? f0.cur, every: t.renewEvery ?? f0.every, auto: t.autoRenew ?? f0.auto, notice: t.noticeDays ? String(t.noticeDays) : f0.notice }));
    if (t.amend) return;
    const got = [t.ref && 'reference', t.provider && 'provider', t.end && 'end date', t.renewBy && 'renewal limit', t.total && 'total', t.fee && 'monthly fee', t.renewEvery && 'renewal step', t.autoRenew && 'automatic renewal', t.noticeDays && 'notice period'].filter(Boolean);
    setReadMsg(got.length ? `Read from ${file.name}${scan}: ${got.join(', ')}. Check them, then save; the file is kept with the contract.` : `${file.name} has no text that can be read (a scanned copy): it is kept with the contract. Type the dates and amounts from it.`);
  };
  // a later document to apply: what it changes, then applied as the contract's next step
  const [amend, setAmend] = useState<{ key: string; t: ContractTerms; doc: Attachment; file: string; scan: string } | null>(null);
  const applyIt = () => { if (!amend) return; const c = FW[amend.key], a = amend.t.amend!;
    setFramework(amend.key, applyAmendment(c, amend.t, { kind: a.kind, ...(a.no ? { no: a.no } : {}), ...(a.effective ? { effective: a.effective } : {}), at: TODAY.toISOString().slice(0, 10), ...(amend.t.ref ? { ref: amend.t.ref } : {}), doc: amend.doc }));
    setAmend(null); setDoc(null); setReadMsg(`${stepName(a.kind, a.no)} applied to the contract with ${c.name ?? amend.key}; the document is kept in its history.`); };
  const load = (d: ContractDue) => { const c = FW[d.key]; setF({ sup: d.name, ref: c.ref ?? '', cap: c.cap ? String(c.cap) : '', start: c.start ?? '', end: c.end ?? '', open: !!c.openEnded, renew: c.renewBy ?? '', fee: c.fee ? String(c.fee) : '', total: c.total ? String(c.total) : '', cur: c.cur ?? 'EUR', every: c.renewEvery ?? '', auto: !!c.autoRenew, notice: c.noticeDays ? String(c.noticeDays) : '' }); setEdit(d.key); setMeta({ line: c.line, kind: c.kind }); };
  // the calendar: three months back, fifteen ahead
  const t0 = new Date(Date.UTC(TODAY.getUTCFullYear(), TODAY.getUTCMonth() - 3, 1)), months = Array.from({ length: 18 }, (_, i) => new Date(Date.UTC(t0.getUTCFullYear(), t0.getUTCMonth() + i, 1)));
  const t1 = Date.UTC(t0.getUTCFullYear(), t0.getUTCMonth() + 18, 1), span = t1 - t0.getTime();
  const x = (iso: string) => Math.max(0, Math.min(100, (Date.parse(iso) - t0.getTime()) / span * 100));
  const due = contractAlerts(D);
  return <section class="card span-12 cc"><div class="card-h"><div><h2>Contract calendar</h2>
    <p>Framework contracts and tender awards with {name}'s providers: a warning 90 days before the end, serious at 60, critical at 30 and for a month after. Contracts due also appear in the alert count of the bell.</p></div>
    {due.length > 0 && <span class="badge critical">{due.length} ending soon</span>}</div>
    <div class="card-b">
      {amend && (() => { const c = FW[amend.key], a = amend.t.amend!, D = amendmentDiff(c, amend.t), fv = (k: string, v: unknown) => v == null || v === '' ? '—' : k === 'end' || k === 'renewBy' ? date(String(v)) : k === 'fee' || k === 'total' ? amt(Number(v), amend.t.cur ?? c.cur) : k === 'renewEvery' ? everyText(String(v)) : typeof v === 'boolean' ? (v ? 'yes' : 'no') : String(v);
        return <div class="am-rev"><div class="am-h"><b>{stepName(a.kind, a.no)} to {c.ref ?? 'the contract'} — {c.name}</b><span>{a.effective ? `applies from ${date(a.effective)}` : 'no effective date read'} · {amend.file}{amend.scan}</span></div>
          {D.length ? <table class="mini am-t"><thead><tr><th>Term</th><th>In force</th><th>With this {a.kind}</th></tr></thead><tbody>{D.map((x) => <tr><td>{x.label}</td><td class="muted">{fv(x.field, x.from)}</td><td><b>{fv(x.field, x.to)}</b></td></tr>)}</tbody></table> : <p class="muted">No term read that differs from the contract in force: the document is added to its history.</p>}
          {amend.t.fees && <p class="am-fees">Monthly fee by date: {amend.t.fees.map((x) => `${amt(x.fee, amend.t.cur ?? c.cur)} from ${date(x.from)}`).join(' · ')}</p>}
          <div class="am-a"><button class="btn primary" type="button" onClick={applyIt}>Apply to the contract</button><button class="btn ghost" type="button" onClick={() => { setAmend(null); setDoc(null); }}>Cancel</button></div></div>; })()}
      <form class="cc-form" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <label>Provider<input list="cc-sup" value={f.sup} onInput={(e) => setF({ ...f, sup: (e.target as HTMLInputElement).value })} placeholder="Choose or type the provider" required /></label>
        <datalist id="cc-sup">{[...new Set(names.values())].sort().map((n) => <option value={n} />)}</datalist>
        <label>Reference<input value={f.ref} onInput={(e) => setF({ ...f, ref: (e.target as HTMLInputElement).value })} placeholder="Tender / contract no." /></label>
        <label>Ceiling (€)<input type="number" min="0" step="0.01" value={f.cap} onInput={(e) => setF({ ...f, cap: (e.target as HTMLInputElement).value })} /></label>
        <label>Starts<input type="date" value={f.start} onInput={(e) => setF({ ...f, start: (e.target as HTMLInputElement).value })} /></label>
        <label>Ends<input type="date" value={f.open ? '' : f.end} disabled={f.open} onInput={(e) => setF({ ...f, end: (e.target as HTMLInputElement).value })} required={!f.open} /></label>
        <label class="cc-open"><input type="checkbox" checked={f.open} onChange={(e) => setF({ ...f, open: (e.target as HTMLInputElement).checked })} /> Open-ended (no end date)</label>
        <label title="“May not be renewed beyond”: the last date the contract can be extended to">Renewable until<input type="date" value={f.open ? '' : f.renew} min={f.end || undefined} disabled={f.open} onInput={(e) => setF({ ...f, renew: (e.target as HTMLInputElement).value })} /></label>
        <label>Monthly fee<input type="number" min="0" step="0.01" value={f.fee} onInput={(e) => setF({ ...f, fee: (e.target as HTMLInputElement).value })} /></label>
        <label title="The total of the contract for its period (e.g. 12 months)">Total for the period<input type="number" min="0" step="0.01" value={f.total} onInput={(e) => setF({ ...f, total: (e.target as HTMLInputElement).value })} /></label>
        <label>Currency<select class="select" value={f.cur} onChange={(e) => setF({ ...f, cur: (e.target as HTMLSelectElement).value })}>{['EUR', 'TRY', 'USD'].map((c) => <option>{c}</option>)}</select></label>
        <label title="How each renewal runs: read from the contract (“may be renewed [annually]”, “extended for a further period of …”)">Renewed<select class="select" value={f.every} onChange={(e) => setF({ ...f, every: (e.target as HTMLSelectElement).value })}><option value="">—</option><option value="month">monthly</option><option value="quarter">quarterly</option><option value="year">yearly</option>{f.every && !['month', 'quarter', 'year'].includes(f.every) && <option value={f.every}>every {f.every} months</option>}</select></label>
        <label title="Days of notice to give before the end (to stop or to renew it)">Notice (days)<input type="number" min="0" step="1" value={f.notice} style={{ minWidth: '70px', width: '90px' }} onInput={(e) => setF({ ...f, notice: (e.target as HTMLInputElement).value })} /></label>
        <label class="cc-chk" title="Renewed without a new signature unless notice is given"><input type="checkbox" checked={f.auto} onChange={(e) => setF({ ...f, auto: (e.target as HTMLInputElement).checked })} /> Renews automatically</label>
        {+f.fee > 0 && f.start && f.end && !f.open && <p class="cc-meta">{f.fee} {f.cur} a month over {monthsOf(f.start, f.end)} months = <b>{amt(+f.fee * monthsOf(f.start, f.end), f.cur)}</b>{+f.total > 0 && Math.abs(+f.total - +f.fee * monthsOf(f.start, f.end)) > 0.5 ? <> · the total typed differs ({amt(+f.total, f.cur)}): fees that change during the period</> : null}</p>}
        <button class="btn primary" type="submit" disabled={!f.sup.trim() || (!f.end && !f.open)}>{edit ? 'Save changes' : '+ Add contract'}</button>
        {(edit || doc) && <button class="btn ghost" type="button" onClick={() => { setEdit(''); setMeta({}); setF(EMPTY_C); setDoc(null); setReadMsg(''); }}>Cancel</button>}
        <label class={`drop cc-read${over ? ' on' : ''}`} onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setOver(true); }} onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setOver(false); readContract(e.dataTransfer?.files?.[0]); }}>
          <input type="file" accept=".pdf,.docx" hidden onChange={(e) => { const i = e.target as HTMLInputElement; readContract(i.files?.[0]); i.value = ''; }} />
          <Ico n="upload" /><span><strong>Drop the contract here</strong> or click to choose it (PDF or Word) · its terms fill the form below</span></label>
        {readMsg && <p class="cc-meta">{readMsg}</p>}
        {meta.line && <p class="cc-meta">Office contract · <b>{meta.kind}</b> · budget line {meta.line}{pre?.end && pre.key === edit ? <> · the end date is filled with the period its orders cover ({date(pre.end)}): check it against the contract</> : null}</p>}
      </form>
      {D.length ? <div class="cc-cal">
        <div class="cc-row cc-head"><span /><div class="cc-track">{months.map((m) => <i style={{ left: `${x(m.toISOString())}%` }}>{m.getUTCMonth() === 0 ? m.getUTCFullYear() : MON[m.getUTCMonth()]}</i>)}<u style={{ left: `${x(TODAY.toISOString())}%` }} /></div><span /></div>
        {D.map((d) => { const a = x(d.start ?? t0.toISOString()), b = d.openEnded ? 100 : x(d.end), w90 = d.openEnded ? 101 : x(new Date(Date.parse(d.end) - 90 * 864e5).toISOString()), r = d.cap ? d.used / d.cap : null;
          return <div class={`cc-row s-${d.severity}${d.openEnded ? ' open' : ''}`}>
            <span class="cc-n"><b><Firm name={d.name} /></b><small class="muted">{[d.kind ? `${d.kind} · line ${d.line}` : '', d.ref, d.cap ? `ceiling ${full(d.cap)}` : '', FW[d.key]?.fee ? `${amt(FW[d.key].fee!, FW[d.key].cur)} a month` : '', FW[d.key]?.total ? `${amt(FW[d.key].total!, FW[d.key].cur)} in total` : '', FW[d.key]?.renewBy ? `renewable until ${date(FW[d.key].renewBy!)}` : '', FW[d.key]?.renewEvery ? `renewed ${everyText(FW[d.key].renewEvery)}` : '', FW[d.key]?.autoRenew ? 'renews automatically' : '', FW[d.key]?.noticeDays ? `notice ${FW[d.key].noticeDays} d${noticeBy(d.end, FW[d.key].noticeDays) ? ` — by ${date(noticeBy(d.end, FW[d.key].noticeDays))}` : ''}` : '', d.used ? `ordered ${full(d.used)}${r != null ? ` (${pct(r)})` : ''}` : ''].filter(Boolean).join(' · ')}</small>{FW[d.key]?.history && <span class="cc-hist">{FW[d.key].history!.map((h) => <em>{stepName(h.kind, h.no)}{h.effective ? ` · ${date(h.effective)}` : ''}</em>)}</span>}</span>
            <div class="cc-track">{months.map((m) => <i style={{ left: `${x(m.toISOString())}%` }} />)}
              {b > 0 && <em style={{ left: `${a}%`, width: `${Math.max(0.6, b - a)}%` }}><s style={{ left: `${b > a ? Math.max(0, (w90 - a) / (b - a) * 100) : 0}%` }} /></em>}
              {FW[d.key]?.renewBy && !d.openEnded && x(FW[d.key].renewBy!) > b && <em class="cc-renew" title={`Renewable until ${date(FW[d.key].renewBy!)}`} style={{ left: `${b}%`, width: `${x(FW[d.key].renewBy!) - b}%` }} />}
              <u style={{ left: `${x(TODAY.toISOString())}%` }} /></div>
            <span class="cc-s"><span class={`badge ${d.openEnded ? 'neutral' : SEV_BADGE[d.severity]}`} title={d.openEnded ? 'No end date: nothing to warn' : `ends ${date(d.end)}`}>{dueText(d)}</span><small class="num muted">{d.openEnded ? 'no end date' : date(d.end)}</small>
              <Attach doc={FW[d.key]?.doc} label={`the contract with ${d.name}`} save={(doc) => setFramework(d.key, { ...FW[d.key], doc })} />
              <button class="btn ghost" title="Change" onClick={() => load(d)}><Ico n="edit" /></button>
              <button class="btn ghost" title="Remove (admin)" onClick={() => { if (confirm(`Remove the contract with ${d.name}?`) && isAdmin('remove a contract')) setFramework(d.key, null); }}>✕</button></span>
          </div>; })}
      </div> : <Empty icon="flag" title={`No contract on the calendar for ${name} yet`} text="Drop a contract above, or type its provider, reference and end date: it is then warned 90, 60 and 30 days before it ends, here, in the country's alerts and in the bell." />}
      {noEnd.length > 0 && <p class="muted" style={{ fontSize: '12.5px' }}>Without an end date, so not on the calendar: {noEnd.map(([k]) => names.get(k) ?? k).join(', ')}.</p>}
    </div></section>;
}

/** The Overview's country rows: each country in one line — office budget, projects, urgent alerts, next deadline — opening its desk. */
export function OverviewCountries() {
  const L = useStore((s) => s.ledger);
  const cs = [...new Set([...(L.offices ?? []).map((o) => o.country), ...L.projects.map((p) => p.country)])];
  const row = (cid: string) => {
    const P = L.projects.filter((p) => p.country === cid), M = P.map(money), b = M.reduce((a, m) => a + m.budget, 0), sp = M.reduce((a, m) => a + m.spent, 0);
    const O = (L.offices ?? []).filter((o) => o.country === cid).map((o) => officeView(o.reports.at(-1)!).T), ob = O.reduce((a, T) => a + T.ob.budget + T.ls.budget, 0), osc = O.reduce((a, T) => a + T.ob.sc + T.ls.sc, 0);
    const urgent = openAlerts(alerts(P, TODAY), L.alertMarks, TODAY).filter((a) => a.severity !== 'warning').length;
    const next = events(P).find((e) => e.day >= now() && e.kind !== 'activity');
    return { cid, name: L.countries.find((c) => c.id === cid)?.name ?? cid, n: P.length, run: P.filter(active).length, b, sp, ob, osc, hasOffice: O.length > 0, urgent, next };
  };
  const R = cs.map(row).sort((a, b) => b.b + b.ob - (a.b + a.ob));
  return <section class="card span-7"><div class="card-h"><div><h2>Countries</h2><p>Each country in one line · click to open it</p></div></div>
    <div class="card-b table-scroll"><table class="mini ov-ct"><thead><tr><th>Country</th><th class="r">Office budget</th><th class="r">Projects</th><th class="r">Spent</th><th class="r">Urgent</th><th>Next deadline</th></tr></thead>
      <tbody>{R.map((x) => <tr class="click" onClick={() => go(`countries/${x.cid}/overview`)}>
        <td><b>{x.name}</b></td>
        <td class="r num">{x.hasOffice ? <>{short(x.ob)} <small class="muted">{pct(x.ob ? x.osc / x.ob : 0)} used</small></> : <span class="muted">—</span>}</td>
        <td class="r num">{x.run} <small class="muted">· {short(x.b)}</small></td>
        <td class="r num">{pct(x.b ? x.sp / x.b : 0)}</td>
        <td class="r">{x.urgent ? <span class="badge serious">{x.urgent}</span> : <span class="muted">0</span>}</td>
        <td>{x.next ? <span>{date(x.next.day)} <small class="muted">· {plabel(x.next.p)} {KIND_LABEL[x.next.kind].toLowerCase()}</small></span> : <span class="muted">—</span>}</td></tr>)}</tbody></table></div></section>;
}

/** A paper clip: opens the attached document, or attaches one (replacing one asks for the admin password). */
function Attach({ doc, label, save }: { doc?: Attachment; label: string; save: (d: Attachment) => void }) {
  const pick = async (e: Event) => {
    const inp = e.target as HTMLInputElement, f = inp.files?.[0]; inp.value = ''; if (!f) return;
    if (doc && !isAdmin(`replace ${label}`)) return;
    const a = await readAttachment(f); if (typeof a === 'string') return alert(a); save(a);
  };
  return <span class="att-c">{doc && <button class="btn ghost att-open" title={`Open ${doc.name} (${Math.round(doc.size / 1024)} KB, attached ${date(doc.at.slice(0, 10))})`} onClick={() => openAttachment(doc)}><Ico n="doc" /></button>}
    <label class="btn ghost" title={doc ? `Replace ${label}` : `Attach ${label} (PDF, Word, scan — kept in this browser and in backups)`}><Ico n="attach" /><input type="file" hidden onChange={pick} /></label></span>;
}
