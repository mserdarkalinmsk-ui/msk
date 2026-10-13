import { useState } from 'preact/hooks';
import { filtered, go, setPoKind, useStore } from '../data/store';
import { ceilings, KINDS, providerPOs, suppliers, type Kind, type ProviderPO } from '../domain/providers';
import type { Project } from '../domain/types';
import { TODAY } from '../today';
import { date, full, short } from '../ui/format';
import { download } from '../ui/xlsxwrite';

const lab = (p: Project) => (p.bh ? `BH ${p.bh}` : p.code);
const kl = (k: Kind) => KINDS.find((x) => x.k === k)!;
const pct = (v: number) => (Number.isFinite(v) ? `${Math.round(v * 100)}%` : '—');
const sum = (L: ProviderPO[]) => L.reduce((a, x) => a + x.value, 0);
function readOn(): Set<Kind> {
  try { const v = JSON.parse(localStorage.getItem('pl-sp-kinds') ?? 'null'); if (Array.isArray(v)) return new Set(v); } catch { /* ignore */ }
  return new Set(KINDS.filter((k) => !k.optional || k.on).map((k) => k.k));
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
  const [sortBy, setSortBy] = useState<'project' | 'year' | 'amount'>('project');
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
  const rows = (review ? every.filter((x) => inYear(x) && !(x.kind && !on.has(x.kind))) : ALL).filter((x) => (!kind || x.kind === kind) && (!proj || x.p.id === proj))
    .sort(sortBy === 'year' ? (a, b) => b.date.localeCompare(a.date) || b.value - a.value : sortBy === 'amount' ? (a, b) => b.value - a.value : (a, b) => a.p.code.localeCompare(b.p.code) || (a.kind ?? '').localeCompare(b.kind ?? '') || b.value - a.value);
  const byYear = years.map((y) => ({ y, v: active.map((k) => sum(every.filter((x) => x.kind === k.k && x.date.startsWith(y)))) }));
  const S = suppliers(ALL.filter((x) => (!kind || x.kind === kind) && (!proj || x.p.id === proj)));
  const over = S.filter((x) => limit && x.max > limit);
  const C = ceilings(P);
  const hand = every.filter((x) => set[x.key]).length, none = every.filter((x) => inYear(x) && !x.kind).length;
  const off = KINDS.filter((k) => k.optional && !on.has(k.k)).map((k) => ({ ...k, L: every.filter((x) => x.kind === k.k && inYear(x)) }));
  const offTot = off.reduce((a, k) => a + sum(k.L), 0);
  const xlsx = () => download(`service-providers-${TODAY.toISOString().slice(0, 10)}.xlsx`, [
    { name: year ? `Summary ${year}` : 'Summary', money: active.map((_, i) => i + 1).concat(active.length + 1), rows: [['Project', ...active.map((k) => k.label), 'Total'], ...projects.map((p) => [lab(p), ...active.map((k) => cell(p, k.k)), cell(p, null)]), ['Total', ...active.map((k) => cell(null, k.k)), total]] },
    { name: 'Purchase orders', money: [9, 10], rows: [['Project', 'Country', 'Kind', 'PO', 'Line', 'Description', 'Service provider', 'Date', 'Year', 'Spent', 'Spent + committed', 'Status', 'Kind set by hand'], ...ALL.map((x) => [lab(x.p), cname(x.p.country), kl(x.kind!).label, x.po, x.line, x.description || x.nature, x.supplier, x.date, x.date.slice(0, 4), x.spent, x.value, x.status, set[x.key] ? 'yes' : ''])] },
    { name: 'By year', money: active.map((_, i) => i + 1).concat(active.length + 1), rows: [['Year', ...active.map((k) => k.label), 'Total'], ...byYear.map((r) => [r.y, ...r.v, r.v.reduce((a, b) => a + b, 0)])] },
    { name: 'Service providers', money: [3, 4, 5], rows: [['Service provider', 'Kind', 'POs', 'Spent', 'Spent + committed', 'Largest in one project', 'Projects'], ...suppliers(ALL).map((x) => [x.supplier, kl(x.kind).label, x.pos, x.spent, x.sc, x.max, [...x.projects.keys()].map((id) => lab(P.find((p) => p.id === id)!)).join(', ')])] },
  ]);
  return (
    <>
      <section class="hero" aria-label="Service providers">
        <div class="kpi lead"><span class="label">Service providers — total{year ? ` ${year}` : ''}</span><span class="value">{short(total)}</span><span class="ctx">spent + committed · {ALL.length} POs · {projects.length} projects · {suppliers(ALL).length} providers</span></div>
        {active.filter((k) => cell(null, k.k)).slice(0, 3).map((k) => <div class="kpi"><span class="label">{k.label}</span><span class="value">{short(cell(null, k.k))}</span><span class="ctx">{ALL.filter((x) => x.kind === k.k).length} POs · {total ? Math.round(cell(null, k.k) / total * 100) : 0}% of the total</span></div>)}
      </section>
      <div class="grid g-12" style={{ marginTop: '16px' }}>
        <section class="card span-12"><div class="card-b" style={{ display: 'grid', gap: '8px' }}>
          <div class="cm-chips"><span class="muted">Year</span><button class={`chip${!year ? ' on' : ''}`} onClick={() => setYear('')}>All years</button>{years.map((y) => <button class={`chip${year === y ? ' on' : ''}`} aria-pressed={year === y} onClick={() => setYear(year === y ? '' : y)}>{y}</button>)}</div>
          <div class="cm-chips"><span class="muted">Included</span>{KINDS.filter((k) => k.optional && on.has(k.k)).map((k) => <button class="chip on" title="Click to leave out" onClick={() => toggle(k.k)}>✓ {k.label} ✕</button>)}</div>
          <details class="sp-off"><summary><b>Not included</b> — {off.map((k) => `${k.label} ${short(sum(k.L))}`).join(' · ') || 'nothing'}{offTot ? <span class="muted"> · total {full(offTot)}</span> : ''}</summary>
            {off.map((k) => <div style={{ marginTop: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Dot k={k.k} /><b>{k.label}</b><span class="muted">{k.L.length} POs · {full(sum(k.L))}</span><button class="btn" style={{ marginLeft: 'auto' }} onClick={() => toggle(k.k)}>Include</button></div>
              {k.L.length > 0 && <div class="table-scroll"><table class="mini"><thead><tr><th>Project</th><th>PO</th><th>Line</th><th>Description</th><th>Supplier</th><th>Date</th><th class="r">Spent + committed</th></tr></thead>
                <tbody>{k.L.slice(0, 200).map((x) => <tr><td><b>{lab(x.p)}</b></td><td class="num">{x.po}</td><td class="num">{x.line}</td><td>{x.description || x.nature}</td><td>{x.supplier}</td><td class="num">{x.date ? date(x.date) : '—'}</td><td class="r num">{full(x.value)}</td></tr>)}</tbody></table></div>}
            </div>)}
          </details>
        </div></section>
        {years.length > 0 && <section class="card span-12">
          <div class="card-h"><div><h2>By year</h2><p>Spent + committed by the year the PO was raised · click a year to filter the page</p></div></div>
          <div class="card-b table-scroll"><table class="mini"><thead><tr><th>Year</th>{active.map((k) => <th class="r"><Dot k={k.k} />{k.label}</th>)}<th class="r">Total</th></tr></thead>
            <tbody>{byYear.map((r) => <tr class={`click${year === r.y ? ' sel' : ''}`} onClick={() => setYear(year === r.y ? '' : r.y)}><td><b>{r.y}</b></td>{r.v.map((v) => <td class="r num">{v ? full(v) : <span class="muted">—</span>}</td>)}<td class="r num"><b>{full(r.v.reduce((a, b) => a + b, 0))}</b></td></tr>)}</tbody>
            <tfoot><tr><td><b>Total</b></td>{active.map((_, i) => <td class="r num"><b>{full(byYear.reduce((a, r) => a + r.v[i], 0))}</b></td>)}<td class="r num"><b>{full(byYear.reduce((a, r) => a + r.v.reduce((x, y) => x + y, 0), 0))}</b></td></tr></tfoot></table></div>
        </section>}
        <section class="card span-12">
          <div class="card-h" style={{ alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}><div><h2>By project and kind{year ? ` — ${year}` : ''}</h2><p>Spent + committed of the purchase orders in the latest report workbook of each project · click a figure to list its POs</p></div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>{(kind || proj) && <button class="btn ghost" onClick={() => { setKind(''); setProj(''); }}>Clear selection</button>}<button class="btn" onClick={xlsx}>⤓ Excel</button></div></div>
          <div class="card-b table-scroll"><table class="mini"><thead><tr><th>Project</th>{active.map((k) => <th class={`r click${kind === k.k ? ' sel' : ''}`} onClick={() => { setKind(kind === k.k ? '' : k.k); setProj(''); }}><Dot k={k.k} />{k.label}</th>)}<th class="r">Total</th></tr></thead>
            <tbody>{projects.map((p) => <tr class={proj === p.id ? 'sel' : ''}>
              <td class="click" onClick={() => { setProj(proj === p.id ? '' : p.id); setKind(''); }}><b>{lab(p)}</b><small class="muted"> {cname(p.country)}</small></td>
              {active.map((k) => { const v = cell(p, k.k); return <td class={`r num${v ? ' click' : ''}`} style={{ outline: proj === p.id && kind === k.k ? '2px solid var(--accent, #3b82c4)' : undefined }} onClick={() => v && (setProj(p.id), setKind(k.k))}>{v ? full(v) : <span class="muted">—</span>}</td>; })}
              <td class="r num"><b>{full(cell(p, null))}</b></td></tr>)}</tbody>
            <tfoot><tr><td><b>Total</b></td>{active.map((k) => <td class="r num"><b>{full(cell(null, k.k))}</b></td>)}<td class="r num"><b>{full(total)}</b></td></tr></tfoot></table>
            {!every.length && <p class="muted">No purchase orders yet — load the report workbooks or system extractions (with the “Purchase Orders” sheet).</p>}</div>
        </section>
        <section class="card span-12">
          <div class="card-h" style={{ alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}><div><h2>Purchase orders{kind ? ` — ${kl(kind).label}` : ''}{proj ? ` — ${lab(P.find((p) => p.id === proj)!)}` : ''}</h2>
            <p>{rows.length} POs · {full(sum(rows.filter((x) => x.kind)))} · the kind is read from what the PO buys; change it in the list if it is wrong{hand ? ` · ${hand} set by hand` : ''}</p></div>
            <div class="seg" style={{ marginLeft: 'auto' }}>{(['project', 'year', 'amount'] as const).map((k) => <button aria-pressed={sortBy === k} onClick={() => setSortBy(k)}>{k === 'project' ? 'By project' : k === 'year' ? 'By year' : 'By amount'}</button>)}</div>
            <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><input type="checkbox" checked={review} onChange={(e) => setReview((e.target as HTMLInputElement).checked)} />Also show the other POs ({none}) to add them</label></div>
          <div class="card-b table-scroll"><table class="mini"><thead><tr><th>Project</th><th>PO</th><th>Line</th><th>Description</th><th>Service provider</th><th>Date</th><th>Kind</th><th class="r">Spent</th><th class="r">Spent + committed</th></tr></thead>
            <tbody>{rows.slice(0, 500).map((x) => <tr style={{ opacity: x.kind ? 1 : 0.6, borderLeft: x.kind ? `4px solid ${kl(x.kind).color}` : undefined }}>
              <td class="click" onClick={() => go(`project/${x.p.id}`)}><b>{lab(x.p)}</b></td><td class="num">{x.po}</td><td class="num">{x.line}</td>
              <td><div class="cm-d">{x.description || x.nature}</div>{x.description && x.nature && x.nature !== x.description && <small class="muted">{x.nature}</small>}</td><td><b>{x.supplier || '—'}</b></td>
              <td class="num" style={{ whiteSpace: 'nowrap' }}>{x.date ? date(x.date) : '—'}</td>
              <td><select value={set[x.key] ?? ''} onChange={(e) => setPoKind(x.key, (e.target as HTMLSelectElement).value)} style={{ fontWeight: set[x.key] ? 700 : 400 }} title={set[x.key] ? 'Set by hand' : 'Read automatically'}>
                <option value="">{x.auto ? `Auto: ${kl(x.auto).label}` : 'Auto: not a service'}</option>
                {KINDS.map((k) => <option value={k.k}>{k.label}</option>)}<option value="none">Not a service provider</option></select></td>
              <td class="r num">{full(x.spent)}</td><td class="r num"><b>{full(x.value)}</b></td></tr>)}</tbody></table>
            {rows.length > 500 && <p class="muted">First 500 shown — the Excel file has them all.</p>}</div>
        </section>
        <section class="card span-12">
          <div class="card-h" style={{ alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}><div><h2>Service providers</h2><p>Spent + committed per provider and kind, across projects</p></div>
            <label style={{ marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center' }}>Limit per provider in one project (€)
              <input type="number" min="0" step="1000" value={limit || ''} placeholder="e.g. 60000" style={{ width: '120px' }} onChange={(e) => setLimit(Number((e.target as HTMLInputElement).value) || 0)} /></label></div>
          <div class="card-b table-scroll">
            {limit > 0 && <p style={{ margin: '0 0 8px', color: over.length ? '#e5484d' : undefined }}>{over.length ? `${over.length} providers above ${full(limit)} in a single project.` : `No provider above ${full(limit)} in a single project.`}</p>}
            <table class="mini"><thead><tr><th>Service provider</th><th>Kind</th><th class="r">POs</th><th class="r">Spent</th><th class="r">Spent + committed</th><th class="r">Largest in one project</th><th>Projects</th></tr></thead>
              <tbody>{S.slice(0, 300).map((x) => <tr style={{ background: limit && x.max > limit ? 'color-mix(in srgb, #e5484d 10%, transparent)' : undefined }}>
                <td><b>{x.supplier}</b></td><td><Dot k={x.kind} />{kl(x.kind).label}</td><td class="r num">{x.pos}</td>
                <td class="r num">{full(x.spent)}</td><td class="r num"><b>{full(x.sc)}</b></td><td class="r num" style={{ color: limit && x.max > limit ? '#e5484d' : undefined }}>{full(x.max)}</td>
                <td>{[...x.projects].map(([id, v]) => <button class="chip" onClick={() => go(`project/${id}`)} title={full(v)}>{lab(P.find((q) => q.id === id)!)}</button>)}</td></tr>)}</tbody>
              {S.length > 0 && <tfoot><tr><td><b>Total</b></td><td /><td class="r num">{S.reduce((a, x) => a + x.pos, 0)}</td><td class="r num">{full(S.reduce((a, x) => a + x.spent, 0))}</td><td class="r num"><b>{full(S.reduce((a, x) => a + x.sc, 0))}</b></td><td colSpan={2} /></tr></tfoot>}</table></div>
        </section>
        {C.length > 0 && <section class="card span-12">
          <div class="card-h"><div><h2>Budget ceilings</h2><p>For comparison: consultant lines (1.1.2–1.1.3, 1.2.2–1.2.3) and conferences (5.7) of the approved budget, with unit rates</p></div></div>
          <div class="card-b table-scroll"><table class="mini"><thead><tr><th>Project</th><th>Line</th><th>Unit</th><th class="r">Rate ceiling</th><th class="r">Budget ceiling</th><th class="r">Spent + committed</th><th class="r">Remaining</th><th class="r">Used</th></tr></thead>
            <tbody>{C.map((r) => <tr><td><b>{lab(r.p)}</b></td><td><span class="num">{r.code}</span> {r.description}</td><td>{r.unit || '—'}</td><td class="r num">{r.rate ? full(r.rate) : '—'}</td><td class="r num"><b>{full(r.approved)}</b></td><td class="r num">{full(r.exposure)}</td>
              <td class="r num" style={{ color: r.remaining < 0 ? '#e5484d' : undefined }}>{full(r.remaining)}</td><td class="r num" style={{ color: r.used > 1 ? '#e5484d' : r.used > 0.9 ? '#c27c0e' : undefined }}>{pct(r.used)}</td></tr>)}</tbody></table></div>
        </section>}
      </div>
    </>
  );
}
