import { useState } from 'preact/hooks';
import { go, set, useStore } from '../data/store';
import { personCard, providerCard } from '../domain/entity';
import { KINDS, providerPOs, supKey } from '../domain/providers';
import { contractsDue, dueText, SEV_BADGE } from '../domain/contracts';
import { daysUntil, roster } from '../domain/staff';
import { coreEnd, fundLabel, personKeyOf } from '../domain/coreTeam';
import { plabel } from '../domain/label';
import type { Project } from '../domain/types';
import { TODAY } from '../today';
import { openAttachment } from './attach';
import { X } from './CloseX';
import { date, full, pct } from './format';
import { Ico } from './Ico';
import { download } from './xlsxwrite';

const amt = (v: number, cur = 'EUR') => cur === 'EUR' ? full(v) : `${v.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;
const kindLabel = (k: string) => KINDS.find((x) => x.k === k)?.label ?? k;
/** Opens the card of a provider (by its key) or of a person (by their name key). */
export const openProvider = (key: string) => set({ drawer: { kind: 'provider', key }, palette: false });
export const openPerson = (key: string) => set({ drawer: { kind: 'person', key }, palette: false });

/** Everything about one provider: what it is, its contract, what each project ordered, and every order. */
export function ProviderPanel({ k, close }: { k: string; close: () => void }) {
  const L = useStore((s) => s.ledger), P = L.projects;
  const [more, setMore] = useState(false);
  const C = providerCard(providerPOs(P, L.poKinds ?? {}, true), k, L.frameworks ?? {});
  if (!C) return <><div class="drawer-h"><h2>Provider</h2><X close={close} /></div><div class="drawer-b"><p class="muted">No order or contract of this provider in the data.</p></div></>;
  const pj = (id: string) => P.find((p) => p.id === id);
  const country = pj(C.projects[0]?.id ?? '')?.country ?? C.contracts[0]?.c.country;
  const xlsx = () => download(`${C.name.slice(0, 40)}-orders.xlsx`, [{ name: 'Orders', money: [6, 7, 8], rows: [['Date', 'Project', 'PO', 'Line', 'Description', 'Status', 'Ordered', 'Spent', 'Spent + committed'], ...C.pos.map((x) => [x.date, plabel(x.p), x.po, x.line, x.description, x.status, x.amount, x.spent, x.value])] }]);
  const D = contractsDue(Object.fromEntries(C.contracts.map((x) => [x.key, x.c])), TODAY);
  return <>
    <div class="drawer-h"><div><h2>{C.name}</h2><p class="muted">{C.kinds.map(kindLabel).join(' · ') || 'Provider'} · {C.projects.length} project{C.projects.length === 1 ? '' : 's'}</p></div><X close={close} /></div>
    <div class="drawer-b en">
      <div class="en-k"><div><b>{C.total.n}</b><span>orders</span></div><div><b>{full(C.total.spent)}</b><span>spent</span></div><div><b>{full(C.total.open)}</b><span>still open</span></div><div><b>{full(C.total.sc)}</b><span>spent + committed</span></div></div>
      <h3>Contract</h3>
      {C.contracts.length ? C.contracts.map(({ key, c }) => { const d = D.find((x) => x.key === key);
        return <div class="en-c">
          <div class="en-c-h"><b>{c.ref || 'Contract'}</b>{d && <span class={`badge ${d.openEnded ? 'neutral' : SEV_BADGE[d.severity]}`}>{dueText(d)}</span>}</div>
          <dl>
            <dt>Period</dt><dd>{c.start ? date(c.start) : '—'} – {c.openEnded ? 'open-ended' : c.end ? date(c.end) : '—'}</dd>
            {c.renewBy && <><dt>Renewable until</dt><dd>{date(c.renewBy)}</dd></>}
            {c.fee != null && <><dt>Monthly fee</dt><dd class="num">{amt(c.fee, c.cur)}</dd></>}
            {c.total != null && <><dt>Total for the period</dt><dd class="num">{amt(c.total, c.cur)}</dd></>}
            {c.cap != null && <><dt>Ceiling</dt><dd class="num">{full(c.cap)}{!c.line && C.total.sc ? <span class="muted"> · {pct(C.total.sc / c.cap)} ordered</span> : null}</dd></>}
            {c.line && <><dt>Office budget line</dt><dd>{c.line}{c.kind ? ` · ${c.kind}` : ''}</dd></>}
          </dl>
          {c.doc && <button class="btn ghost" onClick={() => openAttachment(c.doc!)}><Ico n="docs" />Open the signed contract</button>}
        </div>; })
        : <p class="muted">No contract entered for this provider. {country && <button class="linkish" onClick={() => { close(); go(`countries/${country}/contracts`); }}>Add it under Tenders &amp; suppliers ›</button>}</p>}
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
export function Firm({ name }: { name: string }) {
  const open = (e: Event) => { e.stopPropagation(); openProvider(supKey(name)); };
  return <span class="ent" role="button" tabIndex={0} title="Open the provider's card" onClick={open} onKeyDown={(e) => { if (e.key === 'Enter') open(e); }}>{name}</span>;
}
/** A person's name that opens their card. */
export function Who({ name, k }: { name: string; k?: string }) {
  const open = (e: Event) => { e.stopPropagation(); openPerson(k ?? personKeyOf(name)); };
  return <span class="ent" role="button" tabIndex={0} title="Open the person's card" onClick={open} onKeyDown={(e) => { if (e.key === 'Enter') open(e); }}>{name}</span>;
}
