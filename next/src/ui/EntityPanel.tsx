import { useState } from 'preact/hooks';
import { go, set, useStore } from '../data/store';
import { personCard, providerCard } from '../domain/entity';
import { KINDS, providerPOs, supKey } from '../domain/providers';
import { capEur, contractsDue, dueText, SEV_BADGE } from '../domain/contracts';
import { cleanItemLabel } from '../domain/contractRead';
import { daysUntil, roster } from '../domain/staff';
import { coreEnd, fundLabel, personKeyOf } from '../domain/coreTeam';
import { plabel } from '../domain/label';
import type { Project } from '../domain/types';
import { TODAY } from '../today';
import { openAttachment } from './attach';
import { officeEntriesFor } from '../domain/contractItems';
import { X } from './CloseX';
import { date, full, pct } from './format';
import { Ico } from './Ico';
import { download } from './xlsxwrite';

const amt = (v: number, cur = 'EUR') => cur === 'EUR' ? full(v) : `${v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;
const kindLabel = (k: string) => KINDS.find((x) => x.k === k)?.label ?? k;
/** Opens the card of a provider (by its key) or of a person (by their name key). */
export const openProvider = (key: string, only?: string) => set({ drawer: { kind: 'provider', key, ...(only ? { only } : {}) }, palette: false });
export const openPerson = (key: string) => set({ drawer: { kind: 'person', key }, palette: false });

/** Everything about one provider: what it is, its contract, what each project ordered, and every order. */
export function ProviderPanel({ k, only, close }: { k: string; only?: string; close: () => void }) {
  const L = useStore((s) => s.ledger), P = L.projects;
  const [more, setMore] = useState(false);
  // opened from one project: what that project ordered alone; every project a click away
  const [scope, setScope] = useState(only ?? '');
  const all = providerPOs(P, L.poKinds ?? {}, true), C0 = providerCard(all, k, L.frameworks ?? {});
  const C = C0 && scope ? { ...(providerCard(all.filter((x) => x.p.id === scope), C0.key, L.frameworks ?? {}) ?? { ...C0, pos: [], projects: [], total: { n: 0, amount: 0, spent: 0, sc: 0, open: 0 } }), name: C0.name, kinds: C0.kinds, contracts: C0.contracts } : C0;
  if (!C) return <><div class="drawer-h"><h2>Provider</h2><X close={close} /></div><div class="drawer-b"><p class="muted">No order or contract of this provider in the data.</p></div></>;
  const pj = (id: string) => P.find((p) => p.id === id);
  // what the office itself ordered under the provider's contracts (car rental, an accountant…): from the office report
  const OE = scope ? [] : [...new Map(C.contracts.flatMap(({ key, c }) => officeEntriesFor(L.offices ?? [], key, c)).map((e) => [`${e.office}|${e.doc}|${e.line}|${e.description}|${e.amount}`, e])).values()];
  const oe = { n: OE.length, spent: OE.reduce((a, e) => a + e.spent, 0), open: OE.reduce((a, e) => a + e.committed, 0), sc: OE.reduce((a, e) => a + e.amount, 0) };
  const country = pj(C.projects[0]?.id ?? '')?.country ?? C.contracts[0]?.c.country;
  const xlsx = () => download(`${C.name.slice(0, 40)}-orders.xlsx`, [{ name: 'Orders', money: [6, 7, 8], rows: [['Date', 'Project', 'PO', 'Line', 'Description', 'Status', 'Ordered', 'Spent', 'Spent + committed'], ...C.pos.map((x) => [x.date, plabel(x.p), x.po, x.line, x.description, x.status, x.amount, x.spent, x.value])] }]);
  const D = contractsDue(Object.fromEntries(C.contracts.map((x) => [x.key, x.c])), TODAY);
  return <>
    <div class="drawer-h"><div><h2>{C.name}</h2><p class="muted">{C.kinds.map(kindLabel).join(' · ') || 'Provider'} · {scope ? `${plabel(pj(scope) ?? ({ code: scope } as never))} only` : `${C.projects.length} project${C.projects.length === 1 ? '' : 's'}${OE.length ? ' and the office' : ''}`}</p>
      {only && C0!.projects.length > 1 && <div class="seg en-scope" role="group" aria-label="Projects"><button aria-pressed={scope === only} onClick={() => setScope(only)}>{plabel(pj(only) ?? ({ code: only } as never))}</button><button aria-pressed={!scope} onClick={() => setScope('')}>All projects</button></div>}</div><X close={close} /></div>
    <div class="drawer-b en">
      <div class="en-k"><div><b>{C.total.n + oe.n}</b><span>orders</span></div><div><b>{full(C.total.spent + oe.spent)}</b><span>spent</span></div><div><b>{full(C.total.open + oe.open)}</b><span>still open</span></div><div><b>{full(C.total.sc + oe.sc)}</b><span>spent + committed</span></div></div>
      {OE.length > 0 && C.pos.length > 0 && <p class="muted en-split">Projects {full(C.total.sc)} · office {full(oe.sc)}</p>}
      <h3>Contract</h3>
      {C.contracts.length ? C.contracts.map(({ key, c }) => { const d = D.find((x) => x.key === key);
        return <div class="en-c">
          <div class="en-c-h"><b>{c.ref || 'Contract'}</b>{d && <span class={`badge ${d.openEnded ? 'neutral' : SEV_BADGE[d.severity]}`}>{dueText(d)}</span>}</div>
          <dl>
            <dt>Period</dt><dd>{c.start ? date(c.start) : '—'} – {c.openEnded ? 'open-ended' : c.end ? date(c.end) : '—'}</dd>
            {c.renewBy && <><dt>Renewable until</dt><dd>{date(c.renewBy)}</dd></>}
            {(c.renewEvery || c.autoRenew) && <><dt>Renewal</dt><dd>{[c.renewEvery && (c.renewEvery === 'month' ? 'monthly' : c.renewEvery === 'quarter' ? 'quarterly' : c.renewEvery === 'year' ? 'yearly' : `every ${c.renewEvery} months`), c.autoRenew && 'automatic unless notice is given'].filter(Boolean).join(' · ')}</dd></>}
            {c.noticeDays != null && <><dt>Notice</dt><dd>{c.noticeDays} days{c.end ? ` — by ${date(new Date(Date.parse(c.end) - c.noticeDays * 864e5).toISOString().slice(0, 10))}` : ''}</dd></>}
            {c.fee != null && <><dt>Monthly fee</dt><dd class="num">{amt(c.fee, c.cur)}</dd></>}
            {c.items && c.items.length > 1 && c.items.map((x) => <><dt class="en-item">{cleanItemLabel(x.label)}</dt><dd class="num">{amt(x.fee, c.cur)}</dd></>)}
            {c.total != null && <><dt>Total for the period</dt><dd class="num">{amt(c.total, c.cur)}</dd></>}
            {c.cap != null && <><dt>Ceiling</dt><dd class="num">{amt(c.cap, c.cur)}{!c.line && C.total.sc && capEur(c) ? <span class="muted"> · {pct(C.total.sc / capEur(c)!)} ordered</span> : null}</dd></>}
            {c.line && <><dt>Office budget line</dt><dd>{c.line}{c.kind ? ` · ${c.kind}` : ''}</dd></>}
          </dl>
          {c.doc && <button class="btn ghost" onClick={() => openAttachment(c.doc!)}><Ico n="docs" />Open the signed contract</button>}
          {c.fees && c.fees.length > 1 && <p class="en-fees">Monthly fee by date: {c.fees.map((x) => `${amt(x.fee, c.cur)} from ${date(x.from)}`).join(' · ')}</p>}
          {c.history && c.history.length > 0 && <ol class="en-hist">{c.history.map((h) => <li><b>{h.kind === 'original' ? 'Contract' : `${h.kind.charAt(0).toUpperCase()}${h.kind.slice(1)}${h.no ? ` ${h.no}` : ''}`}</b>{h.effective && <span class="muted"> · from {date(h.effective)}</span>}
            {h.changes.length > 0 && <small>{h.changes.map((x) => `${x.label}: ${x.from == null ? '—' : /end|renewBy/.test(x.field) ? date(String(x.from)) : x.field === 'fee' || x.field === 'total' ? amt(Number(x.from), c.cur) : String(x.from)} → ${/end|renewBy/.test(x.field) ? date(String(x.to)) : x.field === 'fee' || x.field === 'total' ? amt(Number(x.to), c.cur) : String(x.to)}`).join(' · ')}</small>}
            {h.doc && <button class="linkish" onClick={() => openAttachment(h.doc!)}>open the document</button>}</li>)}</ol>}
        </div>; })
        : <p class="muted">No contract entered for this provider. {country && <button class="linkish" onClick={() => { close(); go(`countries/${country}/contracts`); }}>Add it under Tenders &amp; suppliers ›</button>}</p>}
      {OE.length > 0 && <><h3>Ordered by the office <small class="muted">from the office report, newest first</small></h3>
        <div class="tw"><table class="mini en-po"><thead><tr><th>Date</th><th>Office</th><th>Line</th><th>Description</th><th class="r">Spent</th><th class="r">Still open</th><th class="r">Spent + committed</th></tr></thead>
          <tbody>{OE.map((e) => <tr><td class="num">{e.date ? date(e.date) : '—'}</td><td>{e.office}</td><td class="num">{e.line}</td><td>{e.description}</td><td class="r num">{full(e.spent)}</td><td class="r num">{e.committed > 0.5 ? full(e.committed) : ''}</td><td class="r num">{full(e.amount)}</td></tr>)}</tbody>
          <tfoot><tr class="tot"><td colSpan={4}>Total</td><td class="r num">{full(oe.spent)}</td><td class="r num">{full(oe.open)}</td><td class="r num">{full(oe.sc)}</td></tr></tfoot></table></div></>}
      {C.projects.length > 0 && <><h3>By project</h3>
        <div class="tw"><table class="mini"><thead><tr><th>Project</th><th>Lines</th><th class="r">Orders</th><th class="r">Spent</th><th class="r">Still open</th><th class="r">Spent + committed</th></tr></thead>
          <tbody>{C.projects.map((s) => { const p = pj(s.id); return <tr class="click" onClick={() => { close(); go(`project/${s.id}/pos`); }}><td><b>{p ? plabel(p) : s.id}</b></td><td class="muted wrap">{s.lines.join(', ')}</td><td class="r num">{s.n}</td><td class="r num">{full(s.spent)}</td><td class="r num">{full(s.open)}</td><td class="r num"><b>{full(s.sc)}</b></td></tr>; })}</tbody></table></div></>}
      {C.pos.length > 0 && <><h3>Orders <small class="muted">newest first</small><button class="btn ghost" style={{ marginLeft: 'auto' }} onClick={xlsx}><Ico n="download" />Excel</button></h3>
        <div class="tw"><table class="mini en-po"><thead><tr><th>Date</th><th>Project</th><th>PO</th><th>Line</th><th>Description</th><th class="r">Spent + committed</th></tr></thead>
          <tbody>{(more ? C.pos : C.pos.slice(0, 15)).map((x) => <tr><td class="num">{x.date ? date(x.date) : '—'}</td><td>{plabel(x.p)}</td><td class="num">{x.po}</td><td class="num">{x.line}</td><td class="wrap">{x.description}{x.status && !/^open$/i.test(x.status) ? <small class="muted"> · {x.status}</small> : null}</td><td class="r num">{full(x.value)}</td></tr>)}</tbody></table></div>
        {C.pos.length > 15 && !more && <button class="linkish" onClick={() => setMore(true)}>Show all {C.pos.length} orders</button>}</>}
    </div></>;
}

/** Everything about one person: the core team post and the contracts on every project. */
export function PersonPanel({ k, close }: { k: string; close: () => void }) {
  const L = useStore((s) => s.ledger), P = L.projects;
  const C = personCard(P.flatMap((p) => roster(p, TODAY)), L.coreTeam ?? {}, k);
  if (!C) return <><div class="drawer-h"><h2>Person</h2><X close={close} /></div><div class="drawer-b"><p class="muted">This person is no longer in the data.</p></div></>;
  const cn = (id: string) => L.countries.find((c) => c.id === id)?.name ?? id;
  const left = (end?: string) => { if (!end) return null; const d = daysUntil(end, TODAY); return d < 0 ? <span class="badge neutral">ended</span> : d <= 90 ? <span class={`badge ${d <= 30 ? 'critical' : d <= 60 ? 'serious' : 'warning'}`}>{d} d left</span> : null; };
  return <>
    <div class="drawer-h"><div><h2>{C.name}</h2><p class="muted">{[...C.core.map((x) => `${x.m.position} · core team ${cn(x.country)}`), ...[...new Set(C.roles.map((r) => r.position))]].join(' · ')}</p></div><X close={close} /></div>
    <div class="drawer-b en">
      {C.core.length > 0 && <><h3>Core team</h3>{C.core.map(({ country, m }) => { const p = P.find((x: Project) => x.id === m.project);
        return <div class="en-c"><div class="en-c-h"><b>{m.position}</b>{m.grade && <span class="muted">grade {m.grade}</span>}{left(m.end)}</div>
          <dl><dt>Office</dt><dd>{cn(country)}</dd><dt>Contract</dt><dd>{m.start ? date(m.start) : '—'} – {coreEnd(m, date)}</dd><dt>Paid from</dt><dd>{m.fund === 'project' && p ? `${plabel(p)}${m.share ? ` · ${m.share}%` : ''}` : fundLabel(m)}</dd>{m.note && <><dt>Note</dt><dd>{m.note}</dd></>}</dl>
          <button class="linkish" onClick={() => { close(); go(`countries/${country}/people`); }}>Open the core team ›</button></div>; })}</>}
      {C.roles.length > 0 && <><h3>On projects</h3>
        <div class="tw"><table class="mini"><thead><tr><th>Project</th><th>Position</th><th>Base</th><th class="r">FTE</th><th>Contract</th><th>Status</th></tr></thead>
          <tbody>{C.roles.map((r) => <tr class="click" onClick={() => { close(); go(`project/${r.project.id}/staff`); }}><td><b>{plabel(r.project as Project)}</b></td><td>{r.position}</td><td>{r.base === 'HQ' ? 'SxB / HQ' : r.base}</td><td class="r num">{r.fte != null ? r.fte.toFixed(2) : '—'}</td>
            <td class="num" style={{ whiteSpace: 'nowrap' }}>{r.start ? date(r.start) : '—'} – {r.end ? date(r.end) : r.base === 'HQ' ? 'SxB staff' : 'dates missing'} {left(r.end)}</td><td class="muted">{r.status}</td></tr>)}</tbody></table></div></>}
    </div></>;
}

/** A provider's name that opens its card. */
export function Firm({ name, only }: { name: string; /** the project the card is opened from: its orders alone */ only?: string }) {
  const open = (e: Event) => { e.stopPropagation(); openProvider(supKey(name), only); };
  return <span class="ent" role="button" tabIndex={0} title="Open the provider's card" onClick={open} onKeyDown={(e) => { if (e.key === 'Enter') open(e); }}>{name}</span>;
}
/** A person's name that opens their card. */
export function Who({ name, k }: { name: string; k?: string }) {
  const open = (e: Event) => { e.stopPropagation(); openPerson(k ?? personKeyOf(name)); };
  return <span class="ent" role="button" tabIndex={0} title="Open the person's card" onClick={open} onKeyDown={(e) => { if (e.key === 'Enter') open(e); }}>{name}</span>;
}
