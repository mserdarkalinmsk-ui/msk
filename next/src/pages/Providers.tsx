import { useState } from 'preact/hooks';
import { filtered, go, setPoKind, useStore } from '../data/store';
import { KINDS, providerPOs, suppliers, type Kind, type ProviderPO } from '../domain/providers';
import type { Project } from '../domain/types';
import { TODAY } from '../today';
import { date, full, short } from '../ui/format';
import { download } from '../ui/xlsxwrite';

const lab = (p: Project) => (p.bh ? `BH ${p.bh}` : p.code);
const kl = (k: Kind) => KINDS.find((x) => x.k === k)!;
const sum = (L: ProviderPO[]) => L.reduce((a, x) => a + x.value, 0);
function readOn(): Set<Kind> {
  // The main kinds are always counted; only the optional groups (per diem, salaries, petty cash) are remembered.
  const base = KINDS.filter((k) => !k.optional).map((k) => k.k);
  try { const v = JSON.parse(localStorage.getItem('pl-sp-kinds') ?? 'null'); if (Array.isArray(v)) return new Set([...base, ...v.filter((k: Kind) => KINDS.some((x) => x.k === k && x.optional))]); } catch { /* ignore */ }
  return new Set(base);
}
function readLimit() { try { return Number(localStorage.getItem('pl-sp-limit')) || 0; } catch { return 0; } }
const Dot = ({ k }: { k: Kind }) => <i style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '2px', background: kl(k).color, marginRight: '6px' }} />;

/**
 * Service providers: the purchase orders for event management, consultants (national / international), visibility,
 * research and publication — by project, by supplier and in total. Kinds are read from what each PO buys; any PO
 * can be put in another kind (or left out) by hand, and that choice is kept with the data.
 */
export function Providers() {
  const s = useStore((x) => x);
  const P = filtered(s);
  const set = s.ledger.poKinds ?? {};
  const [kind, setKind] = useState<Kind | ''>('');
  const [proj, setProj] = useState('');
  const [review, setReview] = useState(false);
  const [on, setOnS] = useState(readOn);
  const toggle = (k: Kind) => { const n = new Set(on); n.has(k) ? n.delete(k) : n.add(k); setOnS(n); try { localStorage.setItem('pl-sp-kinds', JSON.stringify([...n])); } catch { /* ignore */ } };
  const [year, setYear] = useState('');
  const [sortBy, setSortBy] = useState<'amount' | 'year' | 'name'>('amount');
  const [byKind, setByKind] = useState(true);
  const [shut, setShut] = useState<Set<string>>(new Set());
  const fold = (k: string) => { const n = new Set(shut); n.has(k) ? n.delete(k) : n.add(k); setShut(n); };
  const [open, setOpen] = useState<Set<string>>(new Set());
  const flip = (k: string) => { const n = new Set(open); n.has(k) ? n.delete(k) : n.add(k); setOpen(n); };
  const [limit, setLimitS] = useState(readLimit);
  const setLimit = (v: number) => { setLimitS(v); try { localStorage.setItem('pl-sp-limit', String(v || '')); } catch { /* ignore */ } };
  const cname = (id: string) => s.ledger.countries.find((c) => c.id === id)?.name ?? id.toUpperCase();
  const every = providerPOs(P, set, true);
  const years = [...new Set(every.map((x) => x.date.slice(0, 4)).filter(Boolean))].sort().reverse();
  const active = KINDS.filter((k) => on.has(k.k));
  const inYear = (x: ProviderPO) => !year || x.date.startsWith(year);
  const ALL = every.filter((x) => x.kind && on.has(x.kind) && inYear(x));
  const projects = [...new Set(ALL.map((x) => x.p))].sort((a, b) => sum(ALL.filter((x) => x.p === b)) - sum(ALL.filter((x) => x.p === a)));
  const cell = (p: Project | null, k: Kind | null) => sum(ALL.filter((x) => (!p || x.p === p) && (!k || x.kind === k)));
  const total = sum(ALL);
  // Kinds with nothing in the selection are left out of the table (fewer, wider columns).
  const cols = active.filter((k) => cell(null, k.k)).length ? active.filter((k) => cell(null, k.k)) : active;
  const rows = (review ? every.filter((x) => inYear(x) && !(x.kind && !on.has(x.kind))) : ALL).filter((x) => (!kind || x.kind === kind) && (!proj || x.p.id === proj))
    .sort((a, b) => b.date.localeCompare(a.date) || b.value - a.value);
  // Service providers: one row each, their POs folded underneath.
  const groups = [...rows.reduce((m, x) => { const name = x.supplier.trim() || '(no supplier)', k = (byKind ? `${x.kind ?? ''}|` : '') + name.toLowerCase(); const g = m.get(k) ?? { k, name, L: [] as ProviderPO[] }; g.L.push(x); return m.set(k, g); }, new Map<string, { k: string; name: string; L: ProviderPO[] }>()).values()].map((g) => {
    const per = new Map<string, number>(); for (const x of g.L) per.set(x.p.id, (per.get(x.p.id) ?? 0) + x.value);
    return { ...g, kinds: [...new Set(g.L.map((x) => x.kind).filter((k): k is Kind => !!k))], projects: [...per], last: g.L.reduce((a, x) => (x.date > a ? x.date : a), ''), spent: g.L.reduce((a, x) => a + x.spent, 0), sc: sum(g.L), max: Math.max(0, ...per.values()) };
  }).sort(sortBy === 'year' ? (a, b) => b.last.localeCompare(a.last) : sortBy === 'name' ? (a, b) => a.name.localeCompare(b.name) : (a, b) => b.sc - a.sc);
  const byYear = years.map((y) => ({ y, v: active.map((k) => sum(every.filter((x) => x.kind === k.k && x.date.startsWith(y)))) }));
  const over = groups.filter((g) => limit && g.max > limit);
  const hand = every.filter((x) => set[x.key]).length, none = every.filter((x) => inYear(x) && !x.kind).length;
  const off = KINDS.filter((k) => k.optional && !on.has(k.k)).map((k) => ({ ...k, L: every.filter((x) => x.kind === k.k && inYear(x)) }));
  const offTot = off.reduce((a, k) => a + sum(k.L), 0);
  const xlsx = () => download(`service-providers-${TODAY.toISOString().slice(0, 10)}.xlsx`, [
    { name: year ? `Summary ${year}` : 'Summary', money: active.map((_, i) => i + 1).concat(active.length + 1), rows: [['Project', ...active.map((k) => k.label), 'Total'], ...projects.map((p) => [lab(p), ...active.map((k) => cell(p, k.k)), cell(p, null)]), ['Total', ...active.map((k) => cell(null, k.k)), total]] },
    { name: 'Purchase orders', money: [9, 10], rows: [['Project', 'Country', 'Kind', 'PO', 'Line', 'Description', 'Service provider', 'Date', 'Year', 'Spent', 'Spent + committed', 'Status', 'Kind set by hand'], ...ALL.map((x) => [lab(x.p), cname(x.p.country), kl(x.kind!).label, x.po, x.line, x.description || x.nature, x.supplier, x.date, x.date.slice(0, 4), x.spent, x.value, x.status, set[x.key] ? 'yes' : ''])] },
    { name: 'By year', money: active.map((_, i) => i + 1).concat(active.length + 1), rows: [['Year', ...active.map((k) => k.label), 'Total'], ...byYear.map((r) => [r.y, ...r.v, r.v.reduce((a, b) => a + b, 0)])] },
    { name: 'Service providers', money: [3, 4, 5], rows: [['Service provider', 'Kind', 'POs', 'Spent', 'Spent + committed', 'Largest in one project', 'Projects'], ...suppliers(ALL).map((x) => [x.supplier, kl(x.kind).label, x.pos, x.spent, x.sc, x.max, [...x.projects.keys()].map((id) => lab(P.find((p) => p.id === id)!)).join(', ')])] },
  ]);
  const row = (g: typeof groups[number]) => { const o = open.has(g.k), hot = limit > 0 && g.max > limit; return <>
                <tr class="click" onClick={() => flip(g.k)} style={{ background: hot ? 'color-mix(in srgb, #e5484d 9%, transparent)' : undefined }}>
                  <td class="muted">{o ? '▾' : '▸'}</td><td><b>{g.name}</b></td><td>{g.kinds.length ? <Kinds L={g.kinds} /> : <span class="muted">unsorted</span>}</td>
                  <td>{g.projects.map(([id, v]) => <span class="sp-p" title={full(v)} style={{ color: limit && v > limit ? '#e5484d' : undefined }}>{lab(P.find((q) => q.id === id)!)}</span>)}</td>
                  <td class="r num">{g.L.length}</td><td class="num" style={{ whiteSpace: 'nowrap' }}>{g.last ? date(g.last) : '—'}</td><td class="r num">{full(g.spent)}</td><td class="r num"><b>{full(g.sc)}</b></td></tr>
                {o && <tr class="sp-sub"><td /><td colSpan={7}><table class="mini"><thead><tr><th>Project</th><th>PO</th><th>Line</th><th>Description</th><th>Date</th><th>Kind</th><th class="r">Spent + committed</th></tr></thead>
                  <tbody>{g.L.map((x) => <tr><td class="click" onClick={() => go(`project/${x.p.id}`)}><b>{lab(x.p)}</b></td><td class="num">{x.po}</td><td class="num">{x.line}</td><td>{x.description || x.nature}</td><td class="num" style={{ whiteSpace: 'nowrap' }}>{x.date ? date(x.date) : '—'}</td>
                    <td><select value={set[x.key] ?? ''} onChange={(e) => setPoKind(x.key, (e.target as HTMLSelectElement).value)} style={{ fontWeight: set[x.key] ? 700 : 400 }}>
                      <option value="">{x.auto ? `Auto: ${kl(x.auto).label}` : 'Auto: not sorted'}</option>{KINDS.map((k) => <option value={k.k}>{k.label}</option>)}<option value="none">Not a service provider</option></select></td>
                    <td class="r num">{full(x.value)}</td></tr>)}</tbody></table></td></tr>}</>; };
  const Kinds = ({ L }: { L: Kind[] }) => <>{L.map((k) => <span class="sp-k" style={{ borderColor: kl(k).color, color: kl(k).color }}>{kl(k).label}</span>)}</>;
  return (
    <>
      <section class="hero" aria-label="Service providers">
        <div class="kpi lead"><span class="label">Service providers — total{year ? ` ${year}` : ''}</span><span class="value">{short(total)}</span><span class="ctx">spent + committed · {ALL.length} POs · {projects.length} projects · {suppliers(ALL).length} providers</span></div>
        {active.filter((k) => cell(null, k.k)).sort((a, b) => cell(null, b.k) - cell(null, a.k)).slice(0, 3).map((k) => <div class="kpi"><span class="label">{k.label}</span><span class="value">{short(cell(null, k.k))}</span><span class="ctx">{ALL.filter((x) => x.kind === k.k).length} POs · {total ? Math.round(cell(null, k.k) / total * 100) : 0}% of the total</span></div>)}
      </section>
      <div class="sp-bar">
        <div class="cm-chips"><span class="muted">Year</span><button class={`chip${!year ? ' on' : ''}`} onClick={() => setYear('')}>All</button>{years.map((y) => <button class={`chip${year === y ? ' on' : ''}`} aria-pressed={year === y} onClick={() => setYear(year === y ? '' : y)}>{y}</button>)}</div>
        <div class="cm-chips"><span class="muted">Add</span>{KINDS.filter((k) => k.optional).map((k) => { const v = sum(every.filter((x) => x.kind === k.k && inYear(x))); return <button class={`chip${on.has(k.k) ? ' on' : ''}`} aria-pressed={on.has(k.k)} onClick={() => toggle(k.k)} title={on.has(k.k) ? 'Counted — click to leave out' : 'Not counted — click to add'}>{on.has(k.k) ? '✓ ' : '+ '}{k.label} <small class="muted">{short(v)}</small></button>; })}</div>
        <button class="btn" style={{ marginLeft: 'auto' }} onClick={xlsx}>⤓ Excel</button>
      </div>
      <div class="grid g-12" style={{ marginTop: '12px', gap: '12px' }}>
        <section class="card span-12">
          <div class="card-h" style={{ alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}><div><h2>By project and kind{year ? ` — ${year}` : ''}</h2><p>Spent + committed · click a figure to see its providers{cols.length < active.length ? ` · kinds with no PO hidden: ${active.filter((k) => !cols.includes(k)).map((k) => k.label).join(', ')}` : ''}</p></div>
            {(kind || proj) && <button class="btn ghost" style={{ marginLeft: 'auto' }} onClick={() => { setKind(''); setProj(''); }}>Clear selection</button>}</div>
          <div class="card-b table-scroll"><table class="mini"><thead><tr><th>Project</th>{cols.map((k) => <th class={`r click${kind === k.k ? ' sel' : ''}`} onClick={() => { setKind(kind === k.k ? '' : k.k); setProj(''); }}><Dot k={k.k} />{k.label}</th>)}<th class="r">Total</th></tr></thead>
            <tbody>{projects.map((p) => <tr class={proj === p.id ? 'sel' : ''}>
              <td class="click" onClick={() => { setProj(proj === p.id ? '' : p.id); setKind(''); }}><b>{lab(p)}</b><small class="muted"> {cname(p.country)}</small></td>
              {cols.map((k) => { const v = cell(p, k.k); return <td class={`r num${v ? ' click' : ''}`} style={{ outline: proj === p.id && kind === k.k ? '2px solid var(--accent, #3b82c4)' : undefined }} onClick={() => v && (setProj(p.id), setKind(k.k))}>{v ? full(v) : <span class="muted">—</span>}</td>; })}
              <td class="r num"><b>{full(cell(p, null))}</b></td></tr>)}</tbody>
            <tfoot><tr><td><b>Total</b></td>{cols.map((k) => <td class="r num"><b>{full(cell(null, k.k))}</b></td>)}<td class="r num"><b>{full(total)}</b></td></tr></tfoot></table>
            {!every.length && <p class="muted">No purchase orders yet — load the report workbooks or system extractions (with the “Purchase Orders” sheet).</p>}</div>
        </section>
        <section class="card span-12">
          <div class="card-h" style={{ alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}><div><h2>Service providers{kind ? ` — ${kl(kind).label}` : ''}{proj ? ` — ${lab(P.find((p) => p.id === proj)!)}` : ''}</h2>
            <p>{groups.length} providers · {rows.length} POs · {full(sum(rows.filter((x) => x.kind)))} · click a provider to see its POs{hand ? ` · ${hand} POs set by hand` : ''}</p></div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div class="seg"><button aria-pressed={byKind} onClick={() => setByKind(true)}>By kind</button><button aria-pressed={!byKind} onClick={() => setByKind(false)}>One list</button></div>
              <div class="seg">{(['amount', 'year', 'name'] as const).map((k) => <button aria-pressed={sortBy === k} onClick={() => setSortBy(k)}>{k === 'amount' ? 'By amount' : k === 'year' ? 'Latest first' : 'A–Z'}</button>)}</div>
              <label class="muted" style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>Limit / project €<input type="number" min="0" step="1000" value={limit || ''} placeholder="—" style={{ width: '90px' }} onChange={(e) => setLimit(Number((e.target as HTMLInputElement).value) || 0)} /></label>
              <label class="muted" style={{ display: 'flex', gap: '4px', alignItems: 'center' }}><input type="checkbox" checked={review} onChange={(e) => setReview((e.target as HTMLInputElement).checked)} />Unsorted POs ({none})</label></div></div>
          <div class="card-b table-scroll">
            {limit > 0 && <p style={{ margin: '0 0 8px', color: over.length ? '#e5484d' : undefined }}>{over.length ? `${over.length} providers above ${full(limit)} in a single project.` : `No provider above ${full(limit)} in a single project.`}</p>}
            <table class="mini sp-t"><thead><tr><th style={{ width: '18px' }} /><th>Service provider</th><th>Kind</th><th>Projects</th><th class="r">POs</th><th>Last PO</th><th class="r">Spent</th><th class="r">Spent + committed</th></tr></thead>
              <tbody>{byKind ? [...KINDS.map((k) => k.k as Kind | ''), ''].map((k) => { const G = groups.filter((g) => (g.L[0].kind ?? '') === k); if (!G.length) return null; const o = !shut.has(k || 'none'); return <>
                <tr class="click sp-h" onClick={() => fold(k || 'none')}><td>{o ? '▾' : '▸'}</td><td colSpan={5}>{k ? <><Dot k={k as Kind} /><b>{kl(k as Kind).label}</b></> : <b>Unsorted</b>} <span class="muted">· {G.length} providers · {G.reduce((a, g) => a + g.L.length, 0)} POs</span></td><td class="r num">{full(G.reduce((a, g) => a + g.spent, 0))}</td><td class="r num"><b>{full(G.reduce((a, g) => a + g.sc, 0))}</b></td></tr>
                {o && G.slice(0, 300).map(row)}</>; }) : groups.slice(0, 300).map(row)}</tbody>
              {groups.length > 0 && <tfoot><tr><td /><td colSpan={3}><b>Total</b></td><td class="r num">{rows.length}</td><td /><td class="r num">{full(groups.reduce((a, g) => a + g.spent, 0))}</td><td class="r num"><b>{full(groups.reduce((a, g) => a + g.sc, 0))}</b></td></tr></tfoot>}</table>
            {groups.length > 300 && <p class="muted">First 300 providers shown — the Excel file has them all.</p>}</div>
        </section>
        {years.length > 0 && <details class="card span-12 sp-fold"><summary><b>By year</b> <span class="muted">{byYear.map((r) => `${r.y} ${short(r.v.reduce((a, b) => a + b, 0))}`).join(' · ')}</span></summary>
          <div class="card-b table-scroll"><table class="mini"><thead><tr><th>Year</th>{active.map((k) => <th class="r"><Dot k={k.k} />{k.label}</th>)}<th class="r">Total</th></tr></thead>
            <tbody>{byYear.map((r) => <tr class={`click${year === r.y ? ' sel' : ''}`} onClick={() => setYear(year === r.y ? '' : r.y)}><td><b>{r.y}</b></td>{r.v.map((v) => <td class="r num">{v ? full(v) : <span class="muted">—</span>}</td>)}<td class="r num"><b>{full(r.v.reduce((a, b) => a + b, 0))}</b></td></tr>)}</tbody></table></div>
        </details>}
        {off.some((k) => k.L.length) && <details class="card span-12 sp-fold"><summary><b>Not counted</b> <span class="muted">{off.filter((k) => k.L.length).map((k) => `${k.label} ${short(sum(k.L))}`).join(' · ')} · total {full(offTot)}</span></summary>
          <div class="card-b">{off.filter((k) => k.L.length).map((k) => <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Dot k={k.k} /><b>{k.label}</b><span class="muted">{k.L.length} POs · {full(sum(k.L))}</span><button class="btn" style={{ marginLeft: 'auto' }} onClick={() => toggle(k.k)}>+ Add to the totals</button></div>
            <div class="table-scroll"><table class="mini"><thead><tr><th>Project</th><th>PO</th><th>Line</th><th>Description</th><th>Supplier</th><th>Date</th><th class="r">Spent + committed</th></tr></thead>
              <tbody>{k.L.slice(0, 100).map((x) => <tr><td><b>{lab(x.p)}</b></td><td class="num">{x.po}</td><td class="num">{x.line}</td><td>{x.description || x.nature}</td><td>{x.supplier}</td><td class="num">{x.date ? date(x.date) : '—'}</td><td class="r num">{full(x.value)}</td></tr>)}</tbody></table></div></div>)}</div>
        </details>}
      </div>
    </>
  );
}
