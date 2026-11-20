import { MON } from '../domain/dt';
import { Ico, type IcoName } from '../ui/Ico';
import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { officeServices } from '../domain/officeServices';
import { contractAlerts, contractsDue, dueText, officeContractUse, ceilingSeverity, SEV_BADGE, type ContractDue } from '../domain/contracts';
import { addCoreMembers, go, isAdmin, removeCoreMember, setCoreMember, setFramework, useStore } from '../data/store';
import { readXlsx } from '../ui/xlsx';
import { openAttachment, readAttachment, type Attachment } from '../ui/attach';
import { countryPeople, type CountryPerson, coreDue, coreFromRows, FUND_LABEL, onTeam, type CoreMember } from '../domain/coreTeam';
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
import { events, type Ev } from './Agenda';
import { allPeople, StaffBoard } from './People';
import { ProjectsBody } from './Projects';
import { poReports, reviewOf } from './POReview';
import { reportDiff } from '../domain/reportDiff';
import { ProviderBrief } from './Providers';

/** The tabs of a country under Countries: the office's own budget sits in Finance, the rest gathers the country's projects. */
export const DESK_TABS = ['Overview', 'Office budget', 'Projects', 'Budget lines', 'Tenders & suppliers', 'Staff', 'Deadlines'] as const;
export type DeskTab = (typeof DESK_TABS)[number];
/** A tab's part of the address: "Tenders & suppliers" → "tenders". */
export const deskSlug = (t: DeskTab) => ({ Overview: 'overview', 'Office budget': 'office-budget', Projects: 'projects', 'Budget lines': 'budget', 'Tenders & suppliers': 'tenders', Staff: 'staff', Deadlines: 'deadlines' } as const)[t];

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
      <button class="bud bud-ob" onClick={() => setTab('Office budget')}>
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
      <Tile k="ten" color="var(--c4)" icon="flag" label="Tenders & suppliers" value={S.total ? short(S.total) : '—'} sub={<>{due.length ? <strong>{due.length} contract{due.length > 1 ? 's' : ''} ending soon · </strong> : ''}{S.total ? `${S.providers} providers · ${S.pos} orders` : 'no service-provider order yet'}</>} onClick={() => setTab('Tenders & suppliers')} />
      <Tile k="stf" color="var(--c7)" icon="people" label="Staff" value={`${coreOn.length + people.length}`} sub={`${coreOn.length} core team · ${people.length} on projects · ${coreEnd.length + ending.length} contract${coreEnd.length + ending.length === 1 ? '' : 's'} ending within 60 days`} onClick={() => setTab('Staff')} />
      <Tile k="dl" color="var(--c8)" icon="clock" label="Deadlines" value={`${E.length}`} sub={`in the next 90 days${late.length ? ` · ${late.length} report${late.length > 1 ? 's' : ''} overdue` : ''}`} onClick={() => setTab('Deadlines')} />
    </div>
    <LookingAhead name={name} P={P} officeLeft={Ts.length ? ob.b - ob.sc - ob.pl : null} year={Y} setTab={setTab} />
    <div class="cd-two">
      <CountryAlerts name={name} cid={cid} P={P} setTab={setTab} offices={offices} />
      <section class="card cu"><div class="card-h"><div><h2>Coming up</h2><p>The next 90 days</p></div>{E.length > 6 && <div class="tools"><button class="btn ghost" onClick={() => setTab('Deadlines')}>All {E.length} ›</button></div>}</div>
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
      <button class="la-k" onClick={() => setTab('Office budget')}><span>Office at the end of {year}</span>{officeLeft == null ? <b class="muted">—</b> : <b style={{ color: officeLeft < -0.5 ? 'var(--critical)' : 'var(--good)' }}>{officeLeft < -0.5 ? `short by ${full(-officeLeft)}` : `${full(officeLeft)} left`}</b>}<small>after what is foreseen to the year end</small></button>
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
    ...contractAlerts(contractsDue(Object.fromEntries(Object.entries(FW).filter(([k, c]) => mine.has(k) || c.country === cid)), TODAY)).map((d) => ({ sev: d.severity as keyof typeof rank, who: 'Contract', what: `${d.name}: ${dueText(d)}`, detail: `${d.ref ? d.ref + ' · ' : ''}ends ${date(d.end)}`, go: () => setTab('Tenders & suppliers') })),
    ...contractsDue(Object.fromEntries(Object.entries(FW).filter(([k, c]) => (mine.has(k) || c.country === cid) && c.cap)), TODAY, ceilingUse).flatMap((d) => { const sv = ceilingSeverity(d.used, d.cap); return sv ? [{ sev: sv, who: 'Contract', what: `${d.name}: ${pct(d.cap ? d.used / d.cap : 0)} of its ceiling ordered`, detail: `${full(d.used)} of ${full(d.cap!)}`, go: () => setTab('Tenders & suppliers') }] : []; }),
    ...coreDue(core, TODAY).filter((d) => d.severity === 'critical' || d.severity === 'serious' || d.severity === 'warning').map((d) => ({ sev: d.severity as keyof typeof rank, who: 'Core team', what: `${d.m.name}: contract ${d.days! < 0 ? 'ended' : 'ends'} ${date(d.m.end!)}`, detail: d.m.position, go: () => setTab('Staff') })),
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
  return <>
    <section class="bud2" aria-label={`Extraordinary budget and voluntary contributions in ${name}`}>
      <Card g="JP" title="Joint programmes" k="var(--c3)" /><Card g="VC" title="Voluntary contributions" k="var(--c2)" /><Card g="all" title={`All projects in ${name}`} k="var(--c7)" />
    </section>
    <ProjectsBody P={P} country={cid} />
  </>;
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
  const [v, setV] = useView('pl-tender-view', TENDER_VIEWS);
  return <><ViewBar views={TENDER_VIEWS} v={v} set={setV} label="Tenders and suppliers" />
  <div class="grid g-12">
    {v === 'Providers' && <section class="card span-12"><div class="card-h"><div><h2>Service providers in {name}</h2><p>Orders placed with event organisers, interpreters, consultants, visibility, research and publication providers, from the latest report of each project. The app keeps no tender files: this is what the tenders led to.</p></div>
      <div class="tools"><button class="btn" onClick={() => go('reports/providers')}>All providers ›</button></div></div>
      <div class="card-b"><CountryProviders P={P} cname={cname} /></div></section>}
    {v === 'Contracts' && <ContractCalendar name={name} cid={cid} P={P} pre={pre} offices={offices} />}
    {v === 'Office contracts' && <section class="card span-12"><div class="card-h"><div><h2>Office contracts</h2><p>{rep ? <>The office's own services by budget line, from the office report of {date(rep.date)}: what each is, read from its order descriptions, and the period the orders cover. Add the contract to have its end warned. Petty cash, missions and internal regularisations are left out.</> : 'No office budget imported for this country.'}</p></div></div>
      {OS.length > 0 && <div class="card-b table-scroll"><table class="mini os-t"><thead><tr><th>Budget line</th><th>Service</th><th>Supplier</th><th class="r">Orders</th><th>Orders cover to</th><th class="r">Spent + committed</th><th class="r">Still open</th><th>Contract</th></tr></thead>
        <tbody>{OS.map((x, i) => { const k = okey(x.line, x.supplier), c = FW[k] ?? FW[supKey(x.supplier)], due = c?.end || c?.openEnded ? contractsDue({ [k]: c }, TODAY)[0] : undefined;
          return <tr class={i && OS[i - 1].line === x.line ? 'same' : ''}><td>{i && OS[i - 1].line === x.line ? '' : <><span class="num">{x.line}</span> <span class="muted">{x.lineName}</span></>}</td>
            <td><b>{x.kind}</b></td><td>{x.supplier}</td>
            <td class="r num" title={[...new Set(x.orders.map((o) => o.description))].join('\n')}>{x.orders.length}</td>
            <td class="num" title={x.coverText}>{x.covers ? date(x.covers) : '—'}</td>
            <td class="r num">{full(x.amount)}</td><td class="r num">{x.open > 0.5 ? full(x.open) : ''}</td>
            <td>{due ? <span class={`badge ${due.openEnded ? 'neutral' : SEV_BADGE[due.severity]}`} title={due.openEnded ? 'No end date: nothing to warn' : `${c!.ref ?? ''} ends ${date(due.end)}`}>{dueText(due)}</span>
              : x.directDebit ? <span class="badge neutral" title="Paid by direct debit: a standing service with no end date, so nothing to warn">open-ended · direct debit</span>
              : <button class="btn ghost os-add" onClick={() => { setPre({ n: Date.now(), key: k, sup: x.supplier, line: x.line, kind: x.kind, end: x.covers ?? '' }); setV('Contracts'); setTimeout(() => document.querySelector('.cc-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); }}>+ Contract</button>}</td></tr>; })}</tbody></table></div>}
    </section>}
    {v === 'Providers' && S.length > 0 && <section class="card span-12"><div class="card-h"><div><h2>Largest providers</h2><p>By spent + committed, every project of {name} · staff salaries, mission per diems and travel, and petty cash are not procurement and are left out</p></div></div>
      <div class="card-b table-scroll"><table class="mini"><thead><tr><th>Provider</th><th>Kind</th><th class="r">Orders</th><th class="r">Projects</th><th class="r">Spent</th><th class="r">Spent + committed</th></tr></thead>
        <tbody>{S.map((x) => <tr><td>{x.supplier}</td><td class="muted">{kl(x.kind)}</td><td class="r num">{x.pos}</td><td class="r num">{x.projects.size}</td><td class="r num">{full(x.spent)}</td><td class="r num">{full(x.sc)}</td></tr>)}</tbody></table></div></section>}
  </div></>;
}

/** A tab split into views opened one at a time, the last one remembered (long pages stay short). */
function useView<T extends string>(key: string, views: readonly T[]): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => { try { const x = localStorage.getItem(key) as T; return views.includes(x) ? x : views[0]; } catch { return views[0]; } });
  return [v, (x: T) => { setV(x); try { localStorage.setItem(key, x); } catch { /* the view still changes */ } }];
}
function ViewBar<T extends string>({ views, v, set, label, counts = {} }: { views: readonly T[]; v: T; set: (x: T) => void; label: string; counts?: Partial<Record<T, number>> }) {
  return <div class="seg of-views cd-views" role="tablist" aria-label={label}>{views.map((x) => <button role="tab" aria-pressed={v === x} onClick={() => set(x)}>{x}{counts[x] != null ? <span class="tab-n">{counts[x]}</span> : null}</button>)}</div>;
}
const STAFF_VIEWS = ['Everyone', 'Core team', 'Project staff', 'Staff plan', 'Salary scale'] as const;
const TENDER_VIEWS = ['Contracts', 'Office contracts', 'Providers'] as const;

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
  return <>
    {R.length > 1 && <div class="seg sp-scope" role="group" aria-label="Projects">{[['all', 'All projects'], ...R.map((x) => [x.p.id, plabel(x.p)])].map(([k, l]) => <button aria-pressed={(one ? pj : 'all') === k} onClick={() => setPj(k)}>{l}</button>)}</div>}
    {!one && R.length > 1 && <table class="mini sp-proj"><thead><tr><th>Project</th><th class="r">POs</th><th class="r">Providers</th><th class="r">Amount</th><th class="r">Share</th><th>Largest provider</th></tr></thead>
      <tbody>{R.map(({ p, S }) => <tr class="click" onClick={() => setPj(p.id)}><td><b>{plabel(p)}</b></td><td class="r num">{S.pos}</td><td class="r num">{S.providers}</td><td class="r num">{full(S.total)}</td><td class="r num">{Math.round(S.total / T * 100)}%</td><td class="muted">{S.top[0]?.supplier ?? '—'}</td></tr>)}
        <tr class="tot"><td><b>Total</b></td><td class="r num">{R.reduce((a, x) => a + x.S.pos, 0)}</td><td /><td class="r num"><b>{full(T)}</b></td><td class="r num">100%</td><td /></tr></tbody></table>}
    <ProviderBrief P={one ? [one.p] : P} cname={cname} rows={6} lab={one ? undefined : (id) => plabel(P.find((q) => q.id === id) ?? ({ code: '?' } as Project))} />
  </>;
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
  return <section class="card ev">
    <div class="card-h" style={{ alignItems: 'center' }}><div><h2>Everyone in {name}</h2><p>Each person once — the core team and the project contracts of the same person together</p></div>
      <div class="tools ev-tools"><input class="input" type="search" placeholder="Find a person or a role" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} aria-label="Find a person" />
        <div class="seg" role="group" aria-label="Group by">{([['project', 'By project'], ['end', 'By contract end'], ['name', 'A–Z']] as const).map(([k, l]) => <button aria-pressed={by === k} onClick={() => setBy(k)}>{l}</button>)}</div>
        <div class="seg" role="group" aria-label="Show as">{([['cards', 'Cards'], ['list', 'List']] as const).map(([k, l]) => <button aria-pressed={mode === k} onClick={() => setMode(k)}>{l}</button>)}</div></div></div>
    <div class="ev-sum">
      <div><b>{L.length}</b><span>people</span></div>
      <div><b>{L.filter((x) => x.core).length}</b><span>core team</span></div>
      <div><b>{L.filter((x) => x.roles.length).length}</b><span>on projects</span></div>
      <button class={`ev-soon${soon ? ' on' : ''}`} aria-pressed={soon} onClick={() => setSoon(!soon)}><b>{ending.length}</b><span>contracts ending within 90 days{endDays.length === 1 ? `, all on ${date(endDays[0])}` : ''}{soon ? ' · showing' : ''}</span></button>
      {nn('open') > 0 && <div title="Core team posts with no end date"><b>{nn('open')}</b><span>open-ended</span></div>}
      {nn('sxb') > 0 && <div title="Staff seconded by SxB / HQ: the reports carry no contract dates for them"><b>{nn('sxb')}</b><span>SxB staff</span></div>}
      {nn('missing') > 0 && <div title="On a project's staff list with no contract dates: add them on the project's Staff tab"><b>{nn('missing')}</b><span>dates missing</span></div>}
      {checks > 0 && <div class="ev-chk"><b>{checks}</b><span>to check</span></div>}
      <span class="ev-bar" aria-label="People by project">{projs.map((pr) => { const n = L.filter((x) => x.roles.some((r) => r.project === pr)).length; return <i style={{ flex: n, background: col(pr) }} title={`${pr}: ${n}`} />; })}</span>
    </div>
    <div class="card-b">{groups.map((g) => { const R = shown.filter((x) => key(x) === g).sort((a, b2) => by === 'end' ? (a.ends || '9').localeCompare(b2.ends || '9') : a.name.localeCompare(b2.name));
      return <div class="ev-g"><h3><span class="ev-dot" style={{ background: by === 'project' && g !== 'Core team' ? col(g) : 'var(--ink-3)' }} />{g}<small>{R.length}</small></h3>
        {mode === 'cards' ? <div class="ev-board">{R.map((x) => { const d = days(x), pr = x.roles[0]?.project, tone = d == null ? 'open' : d < 0 ? 'ended' : d <= 30 ? 'critical' : d <= 60 ? 'serious' : d <= 90 ? 'warning' : 'ok';
          // the ring fills as the contract runs out: a full ring is a year or more left
          const left = d == null ? 1 : Math.max(0, Math.min(1, d / 365));
          return <article class={`ev-card t-${tone}${x.check ? ' chk' : ''}`} style={{ '--k': x.core ? 'var(--ink-2)' : pr ? col(pr) : 'var(--ink-3)' } as never}>
            <span class="ev-ring" style={{ '--p': String(left) } as never} title={x.ends ? `Contract ends ${date(x.ends)}` : NO_END[x.noEnd ?? 'missing']}><span class="ev-av">{initials(x.name)}</span></span>
            <b class="ev-n">{x.name}</b>
            <small class="ev-r">{[x.core && `${x.core.position} · core team`, ...[...new Set(x.roles.map((r) => r.position))]].filter(Boolean).join(' · ') || '—'}</small>
            <span class="ev-chips">{x.core && <span class="ev-chip core">{x.core.fund === 'project' ? `${plabel(P.find((p) => p.id === x.core!.project) ?? ({ code: '?' } as Project))}${x.core.share ? ` ${x.core.share}%` : ''}` : FUND_LABEL[x.core.fund ?? 'ob']}</span>}
              {[...new Set(x.roles.map((r) => r.project))].filter((p2) => by !== 'project' || p2 !== g).map((p2) => <span class="ev-chip" style={{ '--k': col(p2) } as never}>{p2}</span>)}</span>
            {x.check && <em class="ev-c">{x.check}</em>}
            <span class="ev-f">{x.ends ? <><span class="num">until {date(x.ends)}</span>{d != null && d >= 0 && d <= 90 ? <span class={`badge ${d <= 30 ? 'critical' : d <= 60 ? 'serious' : 'warning'}`}>{d} days</span> : d != null && d < 0 ? <span class="badge neutral">ended</span> : null}</> : <span class="muted">{NO_END[x.noEnd ?? 'missing']}</span>}</span>
          </article>; })}</div>
        : <ul class="ev-l">{R.map((x) => { const d = days(x), pr = x.roles[0]?.project;
          return <li class={x.check ? 'chk' : ''}>
            <span class="ev-av" style={{ background: x.core ? 'var(--ink-2)' : pr ? col(pr) : 'var(--ink-3)' }}>{initials(x.name)}</span>
            <span class="ev-who"><b>{x.name}</b><small>{[x.core && `${x.core.position} · core team`, ...[...new Set(x.roles.map((r) => r.position))]].filter(Boolean).join(' · ')}</small>{x.check && <em>{x.check}</em>}</span>
            <span class="ev-chips">{x.core && <span class="ev-chip core">{x.core.fund === 'project' ? `${plabel(P.find((p) => p.id === x.core!.project) ?? ({ code: '?' } as Project))}${x.core.share ? ` ${x.core.share}%` : ''}` : FUND_LABEL[x.core.fund ?? 'ob']}</span>}
              {[...new Set(x.roles.map((r) => r.project))].map((p2) => <span class="ev-chip" style={{ '--k': col(p2) } as never}>{p2}</span>)}</span>
            <span class="ev-end">{x.ends ? <><span class="num">{date(x.ends)}</span>{d != null && d >= 0 && d <= 90 ? <span class={`badge ${d <= 30 ? 'critical' : d <= 60 ? 'serious' : 'warning'}`}>{d} days</span> : d != null && d < 0 ? <span class="badge neutral">ended</span> : null}</> : <span class="muted">{NO_END[x.noEnd ?? 'missing']}</span>}</span>
          </li>; })}</ul>}</div>; })}
      {!shown.length && <p class="muted">No one matches.</p>}</div>
  </section>;
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
  return <section class="card cc"><div class="card-h"><div><h2>Core Team</h2><p>The office's own team in {name}, outside the projects: {on.length} on the team today. Contract ends are warned 90, 60 and 30 days ahead, here, under Deadlines and in the bell's count.</p></div><div class="tools"><label class="btn ghost" title="A sheet with a heading row: Name, Position, Grade, Start, End, Funded by"><Ico n="upload" />Import from Excel<input type="file" accept=".xlsx" hidden onChange={importList} /></label></div></div>
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
            <td style={{ whiteSpace: 'nowrap' }}><Attach doc={m.doc} label={`the contract of ${m.name}`} save={(doc) => setCoreMember(cid, { ...m, doc })} /><button class="btn ghost" title="Change" onClick={() => load(m)}><Ico n="edit" /></button><button class="btn ghost" title="Remove (admin)" onClick={() => { if (confirm(`Remove ${m.name} from the core team?`)) removeCoreMember(cid, m.id); }}>✕</button></td></tr>; })}</tbody></table></div>
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
  const [f, setF] = useState({ sup: '', ref: '', cap: '', start: '', end: '', open: false });
  const [edit, setEdit] = useState(''), [meta, setMeta] = useState<{ line?: string; kind?: string }>({});
  // an office service chosen in the table: its supplier, budget line and kind; the end its orders cover, to confirm
  useEffect(() => { if (pre) { setF({ sup: pre.sup, ref: '', cap: '', start: '', end: pre.end, open: false }); setEdit(pre.key); setMeta({ line: pre.line, kind: pre.kind }); } }, [pre?.n]);
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
        {meta.line && <p class="cc-meta">Office contract · <b>{meta.kind}</b> · budget line {meta.line}{pre?.end && pre.key === edit ? <> · the end date is filled with the period its orders cover ({date(pre.end)}): check it against the contract</> : null}</p>}
      </form>
      {D.length ? <div class="cc-cal">
        <div class="cc-row cc-head"><span /><div class="cc-track">{months.map((m) => <i style={{ left: `${x(m.toISOString())}%` }}>{m.getUTCMonth() === 0 ? m.getUTCFullYear() : MON[m.getUTCMonth()]}</i>)}<u style={{ left: `${x(TODAY.toISOString())}%` }} /></div><span /></div>
        {D.map((d) => { const a = x(d.start ?? t0.toISOString()), b = d.openEnded ? 100 : x(d.end), w90 = d.openEnded ? 101 : x(new Date(Date.parse(d.end) - 90 * 864e5).toISOString()), r = d.cap ? d.used / d.cap : null;
          return <div class={`cc-row s-${d.severity}${d.openEnded ? ' open' : ''}`}>
            <span class="cc-n"><b>{d.name}</b><small class="muted">{[d.kind ? `${d.kind} · line ${d.line}` : '', d.ref, d.cap ? `ceiling ${full(d.cap)}` : '', d.used ? `ordered ${full(d.used)}${r != null ? ` (${pct(r)})` : ''}` : ''].filter(Boolean).join(' · ')}</small></span>
            <div class="cc-track">{months.map((m) => <i style={{ left: `${x(m.toISOString())}%` }} />)}
              {b > 0 && <em style={{ left: `${a}%`, width: `${Math.max(0.6, b - a)}%` }}><s style={{ left: `${b > a ? Math.max(0, (w90 - a) / (b - a) * 100) : 0}%` }} /></em>}
              <u style={{ left: `${x(TODAY.toISOString())}%` }} /></div>
            <span class="cc-s"><span class={`badge ${d.openEnded ? 'neutral' : SEV_BADGE[d.severity]}`} title={d.openEnded ? 'No end date: nothing to warn' : `ends ${date(d.end)}`}>{dueText(d)}</span><small class="num muted">{d.openEnded ? 'no end date' : date(d.end)}</small>
              <Attach doc={FW[d.key]?.doc} label={`the contract with ${d.name}`} save={(doc) => setFramework(d.key, { ...FW[d.key], doc })} />
              <button class="btn ghost" title="Change" onClick={() => load(d)}><Ico n="edit" /></button>
              <button class="btn ghost" title="Remove (admin)" onClick={() => { if (confirm(`Remove the contract with ${d.name}?`) && isAdmin('remove a contract')) setFramework(d.key, null); }}>✕</button></span>
          </div>; })}
      </div> : <p class="muted">No contract with an end date yet for {name}. Add one above: the provider, the reference of the tender or contract, its ceiling and its end date.</p>}
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
