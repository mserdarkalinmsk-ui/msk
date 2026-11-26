import { useState } from 'preact/hooks';
import { isAdmin, setTender, useStore } from '../data/store';
import { contractSupKey, KINDS, providerPOs, supKey } from '../domain/providers';
import { contractsDue, dueText, SEV_BADGE } from '../domain/contracts';
import { TODAY } from '../today';
import { lotsUse, outsideTenders, tenderUse, type Tender } from '../domain/tenders';
import { plabel } from '../domain/label';
import type { Project } from '../domain/types';
import { date, full, pct } from '../ui/format';
import { Firm } from '../ui/EntityPanel';
import { Ico } from '../ui/Ico';

const LEVEL = { ok: ['good', 'within'], warning: ['warning', 'over 80%'], serious: ['serious', 'over 90%'], critical: ['critical', 'threshold reached'] } as const;
const kindLabel = (k?: string) => KINDS.find((x) => x.k === k)?.label ?? 'Any kind';
const EMPTY = { name: '', ref: '', kind: 'consult', threshold: '', perMember: '', start: '', end: '', projects: [] as string[] };

/** The tenders of a country (or of one project) and whether what their selected providers were ordered passes the threshold. */
export function TenderBoard({ cid, P, only }: { cid: string; P: Project[]; only?: string }) {
  const L = useStore((s) => s.ledger), all = L.projects.filter((p) => p.country === cid);
  const POs = providerPOs(all, L.poKinds ?? {});
  const T = Object.values(L.tenders ?? {}).filter((t) => (t.country ?? cid) === cid && (!only || !t.projects.length || t.projects.includes(only)));
  const [f, setF] = useState<typeof EMPTY | null>(null), [edit, setEdit] = useState('');
  const open = () => { setF({ ...EMPTY, projects: only ? [only] : [] }); setEdit(''); };
  const save = () => { if (!f || !f.name.trim()) return;
    const prev = edit ? L.tenders?.[edit] : undefined;
    setTender({ id: edit || `tn${Date.now().toString(36)}`, name: f.name.trim(), country: cid, projects: f.projects, members: prev?.members ?? [], ...(f.ref.trim() ? { ref: f.ref.trim() } : {}), ...(f.kind ? { kind: f.kind } : {}),
      ...(+f.threshold > 0 ? { threshold: Math.round(+f.threshold * 100) / 100 } : {}), ...(+f.perMember > 0 ? { perMember: Math.round(+f.perMember * 100) / 100 } : {}), ...(f.start ? { start: f.start } : {}), ...(f.end ? { end: f.end } : {}), ...(prev?.doc ? { doc: prev.doc } : {}) });
    setF(null); setEdit(''); };
  const kinds = [...new Set(T.map((t) => t.kind).filter(Boolean) as string[])], out = outsideTenders(T, providerPOs(P, L.poKinds ?? {}), kinds.length ? kinds : ['consult', 'intl']);
  return <section class="card tn"><div class="card-h"><div><h2>Tenders</h2><p>Each tender with the providers it selected: what they were ordered{only ? ' on this project' : ` on the projects of the country`} (spent + committed) against its threshold — a warning at 80%, serious at 90%, critical when reached</p></div>
      <div class="tools">{!f && <button class="btn primary" onClick={open}>+ New tender</button>}</div></div>
    <div class="card-b">
      {f && <form class="cc-form tn-form" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <label>Tender<input value={f.name} onInput={(e) => setF({ ...f, name: (e.target as HTMLInputElement).value })} placeholder="e.g. Roster of national consultants" required /></label>
        <label>Reference<input value={f.ref} onInput={(e) => setF({ ...f, ref: (e.target as HTMLInputElement).value })} placeholder="Tender no." /></label>
        <label>Kind<select class="select" value={f.kind} onChange={(e) => setF({ ...f, kind: (e.target as HTMLSelectElement).value })}><option value="">Any kind</option>{KINDS.filter((k) => !k.optional).map((k) => <option value={k.k}>{k.label}</option>)}</select></label>
        <label>Threshold (€)<input type="number" min="0" step="0.01" value={f.threshold} onInput={(e) => setF({ ...f, threshold: (e.target as HTMLInputElement).value })} /></label>
        <label title="The most one selected provider may be ordered under the tender">Per provider (€)<input type="number" min="0" step="0.01" value={f.perMember} onInput={(e) => setF({ ...f, perMember: (e.target as HTMLInputElement).value })} /></label>
        <label>From<input type="date" value={f.start} onInput={(e) => setF({ ...f, start: (e.target as HTMLInputElement).value })} /></label>
        <label>Until<input type="date" value={f.end} onInput={(e) => setF({ ...f, end: (e.target as HTMLInputElement).value })} /></label>
        <fieldset class="tn-pj"><legend>Projects</legend>{all.map((p) => <label class="cc-chk"><input type="checkbox" checked={f.projects.includes(p.id)} onChange={(e) => setF({ ...f, projects: (e.target as HTMLInputElement).checked ? [...f.projects, p.id] : f.projects.filter((x) => x !== p.id) })} /> {plabel(p)}</label>)}<small class="muted">none ticked: every project of the country</small></fieldset>
        <button class="btn primary" type="submit" disabled={!f.name.trim()}>{edit ? 'Save changes' : 'Add the tender'}</button>
        <button class="btn ghost" type="button" onClick={() => { setF(null); setEdit(''); }}>Cancel</button>
      </form>}
      {T.length ? T.map((t) => <TenderCard t={t} POs={POs} all={all} only={only} onEdit={() => { setF({ name: t.name, ref: t.ref ?? '', kind: t.kind ?? '', threshold: t.threshold ? String(t.threshold) : '', perMember: t.perMember ? String(t.perMember) : '', start: t.start ?? '', end: t.end ?? '', projects: t.projects }); setEdit(t.id); }} />)
        : !f && <div class="es"><span class="es-i" aria-hidden="true"><Ico n="flag" size={22} /></span><h3>No tender recorded yet</h3><p>Add a tender, then the consultants or firms it selected: what they are ordered is added up and checked against its threshold.</p><div class="es-a"><button class="btn primary" onClick={open}>+ New tender</button></div></div>}
      {out.length > 0 && <div class="tn-out"><h3>Bought without a tender <small>{kinds.length ? kinds.map(kindLabel).join(', ') : 'consultants'}</small></h3>
        <ul>{out.slice(0, 12).map((x) => <li><Firm name={x.name} only={only} /><span class="num">{x.orders} order{x.orders > 1 ? 's' : ''} · {full(x.used)}</span>
          {T.length > 0 && <select class="select" aria-label={`Add ${x.name} to a tender`} value="" onChange={(e) => { const t = L.tenders?.[(e.target as HTMLSelectElement).value]; if (t) setTender(t.lots?.length ? { ...t, lots: t.lots.map((l, i) => (i === 0 ? { ...l, members: [...l.members, { key: x.key, name: x.name }] } : l)) } : { ...t, members: [...t.members, { key: x.key, name: x.name }] }); }}><option value="">Add to a tender…</option>{T.map((t) => <option value={t.id}>{t.name}</option>)}</select>}</li>)}</ul></div>}
    </div></section>;
}

function TenderCard({ t, POs, all, only, onEdit }: { t: Tender; POs: ReturnType<typeof providerPOs>; all: Project[]; only?: string; onEdit: () => void }) {
  const lots = t.lots?.length ? lotsUse(t, POs) : null, U = lots ? null : tenderUse(t, POs);
  const used = lots ? lots.used : U!.used, share = lots ? lots.share : U!.share, level = lots ? lots.level : U!.level;
  const [tone, word] = LEVEL[level];
  const [lf, setLf] = useState<{ name: string; threshold: string; perMember: string } | null>(null);
  const addLot = () => { if (!lf?.name.trim()) return;
    // the tender's own providers become its first lot when lots start
    const first = !t.lots?.length && t.members.length ? [{ id: `lt${Date.now().toString(36)}a`, name: 'Lot 1', members: t.members, ...(t.threshold ? { threshold: t.threshold } : {}) }] : [];
    setTender({ ...t, members: first.length ? [] : t.members, lots: [...(t.lots ?? []), ...first, { id: `lt${Date.now().toString(36)}`, name: lf.name.trim(), members: [], ...(+lf.threshold > 0 ? { threshold: +lf.threshold } : {}), ...(+lf.perMember > 0 ? { perMember: +lf.perMember } : {}) }] }); setLf(null); };
  const setLot = (id: string, members: Tender['members']) => setTender({ ...t, lots: t.lots!.map((l) => (l.id === id ? { ...l, members } : l)) });
  return <div class={`tn-c l-${level}`}>
    <div class="tn-h"><div><b>{t.name}</b><span class="muted">{[t.ref, kindLabel(t.kind), t.lots?.length ? `${t.lots.length} lots` : '', t.start || t.end ? `${t.start ? date(t.start) : '…'} – ${t.end ? date(t.end) : '…'}` : '', t.projects.length ? t.projects.map((id) => { const p = all.find((x) => x.id === id); return p ? plabel(p) : id; }).join(', ') : 'all projects of the country'].filter(Boolean).join(' · ')}</span></div>
      <div class="tn-k">{t.threshold ? <><b>{full(used)}</b><span>of {full(t.threshold)} · {pct(share ?? 0)}</span></> : <><b>{full(used)}</b><span class="muted">{lots ? 'all lots' : 'no threshold set'}</span></>}{(t.threshold || lots) && <span class={`badge ${tone}`}>{word}</span>}
        <button class="btn ghost" title="Change" onClick={onEdit}><Ico n="edit" /></button><button class="btn ghost" title="Remove the tender (admin)" onClick={() => { if (confirm(`Remove the tender “${t.name}”?`) && isAdmin('remove a tender')) setTender(null, t.id); }}>✕</button></div></div>
    {lots ? lots.lots.map(({ lot, use }) => { const [lt, lw] = LEVEL[use.level];
      return <div class={`tn-lot l-${use.level}`}><div class="tn-lh"><b>{lot.name}</b><span class="tn-k">{lot.threshold ? <><b>{full(use.used)}</b><span>of {full(lot.threshold)} · {pct(use.share ?? 0)}</span><span class={`badge ${lt}`}>{lw}</span></> : <><b>{full(use.used)}</b><span class="muted">no threshold for this lot</span></>}
          <button class="btn ghost" title="Remove the lot (admin)" onClick={() => { if (confirm(`Remove ${lot.name}?`) && isAdmin('remove a lot')) setTender({ ...t, lots: t.lots!.filter((l) => l.id !== lot.id) }); }}>✕</button></span></div>
        <Unit id={`${t.id}-${lot.id}`} t={t} members={lot.members} threshold={lot.threshold} perMember={lot.perMember ?? t.perMember} use={use} POs={POs} only={only} save={(m) => setLot(lot.id, m)} /></div>; })
      : <Unit id={t.id} t={t} members={t.members} threshold={t.threshold} perMember={t.perMember} use={U!} POs={POs} only={only} save={(m) => setTender({ ...t, members: m })} />}
    {lf ? <form class="tn-lf" onSubmit={(e) => { e.preventDefault(); addLot(); }}>
        <input class="input" placeholder={`Lot name, e.g. Lot ${(t.lots?.length ?? (t.members.length ? 1 : 0)) + 1} — trainers`} value={lf.name} onInput={(e) => setLf({ ...lf, name: (e.target as HTMLInputElement).value })} />
        <input class="input" type="number" min="0" step="0.01" placeholder="Threshold (€)" value={lf.threshold} onInput={(e) => setLf({ ...lf, threshold: (e.target as HTMLInputElement).value })} />
        <input class="input" type="number" min="0" step="0.01" placeholder="Per provider (€)" value={lf.perMember} onInput={(e) => setLf({ ...lf, perMember: (e.target as HTMLInputElement).value })} />
        <button class="btn primary" type="submit" disabled={!lf.name.trim()}>Add the lot</button><button class="btn ghost" type="button" onClick={() => setLf(null)}>Cancel</button>
        {!t.lots?.length && t.members.length > 0 && <small class="muted">The providers already selected become Lot 1.</small>}</form>
      : <button class="linkish tn-addlot" onClick={() => setLf({ name: '', threshold: '', perMember: '' })}>{t.lots?.length ? '+ Add a lot' : '+ Split into lots'}</button>}
  </div>;
}

/** One set of selected providers (a tender without lots, or one lot): its bar against the threshold, its providers, and adding one. */
function Unit({ id, t, members, threshold, perMember, use: U, POs, only, save }: { id: string; only?: string; t: Tender; members: Tender['members']; threshold?: number; perMember?: number; use: ReturnType<typeof tenderUse>; POs: ReturnType<typeof providerPOs>; save: (m: Tender['members']) => void }) {
  const [q, setQ] = useState('');
  const taken = new Set([...t.members, ...(t.lots ?? []).flatMap((l) => l.members)].map((m) => m.key));
  const pool = [...new Map(POs.filter((x) => (!t.projects.length || t.projects.includes(x.p.id)) && (!t.kind || x.kind === t.kind)).map((x) => [supKey(x.supplier), x.supplier.trim()])).entries()].filter(([k]) => !taken.has(k));
  const add = () => { const n = q.trim(); if (!n) return; const k = supKey(n); if (members.some((m) => m.key === k)) return; save([...members, { key: k, name: pool.find(([pk]) => pk === k)?.[1] ?? n }]); setQ(''); };
  const w = (v: number) => `${Math.min(100, threshold ? (v / threshold) * 100 : 0)}%`;
  return <>
    {threshold ? <div class="tn-bar" aria-hidden="true"><i class="op" style={{ width: w(U.used) }} /><i class="sp" style={{ width: w(U.spent) }} /><u style={{ left: '80%' }} /></div> : null}
    {members.length ? <table class="mini tn-t"><thead><tr><th>Selected provider</th><th class="r">Orders</th><th class="r">Spent</th><th class="r">Still open</th><th class="r">Spent + committed</th><th class="r">Share</th>{perMember ? <th>Per provider ({full(perMember)})</th> : null}<th /></tr></thead>
      <tbody>{U.members.map((m) => <tr class={m.over ? 'over' : ''}><td><Firm name={m.name} only={only} /></td><td class="r num">{m.orders}</td><td class="r num">{full(m.spent)}</td><td class="r num">{full(m.open)}</td><td class="r num"><b>{full(m.used)}</b></td><td class="r num">{pct(m.share)}</td>
        {perMember ? <td>{m.over ? <span class="badge critical">over by {full(m.used - perMember)}</span> : <span class="muted">{pct(m.used / perMember)} used</span>}</td> : null}
        <td><button class="btn ghost" title="Take out (admin)" onClick={() => { if (isAdmin('take a provider out of a tender')) save(members.filter((x) => x.key !== m.key)); }}>✕</button></td></tr>)}</tbody></table>
      : <p class="muted">No provider selected yet: add the consultants or firms selected{t.lots?.length ? ' for this lot' : ''}.</p>}
    <div class="tn-add"><input class="input" list={`tn-${id}`} placeholder="Add a selected provider" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
      <datalist id={`tn-${id}`}>{pool.map(([, n]) => <option value={n} />)}</datalist><button class="btn" onClick={add} disabled={!q.trim()}>+ Add</button></div>
  </>;
}

/** The contracts of the providers this project ordered from, with what this project alone spent and still has open on each. */
export function ProjectContracts({ p }: { p: Project }) {
  const L = useStore((s) => s.ledger), FW = L.frameworks ?? {};
  const POs = providerPOs([p], L.poKinds ?? {}, true);
  const known = new Map<string, string>(); for (const x of POs) if (x.supplier.trim()) known.set(supKey(x.supplier), x.supplier.trim());
  const R = Object.entries(FW).filter(([, c]) => !c.line && (!c.country || c.country === p.country)).map(([k, c]) => ({ k, c, sk: contractSupKey(k, c.name, known) })).filter((x) => known.has(x.sk))
    .map((x) => { const M = POs.filter((o) => supKey(o.supplier) === x.sk), spent = M.reduce((a, o) => a + o.spent, 0), sc = M.reduce((a, o) => a + o.value, 0); return { ...x, n: M.length, spent, sc, open: sc - spent }; })
    .sort((a, b) => b.sc - a.sc);
  const D = new Map(contractsDue(Object.fromEntries(R.map((x) => [x.k, x.c])), TODAY).map((d) => [d.key, d]));
  if (!R.length) return null;
  return <section class="card pc-c"><div class="card-h"><div><h2>Contracts</h2><p>The contracts of the providers this project ordered from, with this project's own orders on each</p></div></div>
    <div class="card-b tw"><table class="mini"><thead><tr><th>Provider</th><th>Contract</th><th>Ends</th><th class="r">Orders</th><th class="r">Spent</th><th class="r">Still open</th><th class="r">Spent + committed</th></tr></thead>
      <tbody>{R.map((x) => { const d = D.get(x.k); return <tr><td><Firm name={known.get(x.sk)!} only={p.id} /></td><td>{x.c.ref || '—'}</td>
        <td>{x.c.end ? date(x.c.end) : x.c.openEnded ? 'open-ended' : '—'}{d && !d.openEnded && <> <span class={`badge ${SEV_BADGE[d.severity]}`}>{dueText(d)}</span></>}</td>
        <td class="r num">{x.n}</td><td class="r num">{full(x.spent)}</td><td class="r num">{full(x.open)}</td><td class="r num"><b>{full(x.sc)}</b></td></tr>; })}</tbody></table></div></section>;
}
