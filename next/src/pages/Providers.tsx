import { useState } from 'preact/hooks';
import { filtered, go, useStore } from '../data/store';
import { ceilings, KINDS, providerPOs, suppliers, type Kind } from '../domain/providers';
import type { Project } from '../domain/types';
import { TODAY } from '../today';
import { full, short } from '../ui/format';
import { download } from '../ui/xlsxwrite';

const lab = (p: Project) => (p.bh ? `BH ${p.bh}` : p.code);
const kl = (k: Kind) => KINDS.find((x) => x.k === k)!;
const pct = (v: number) => (Number.isFinite(v) ? `${Math.round(v * 100)}%` : '—');
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };
function readLimit() { try { return Number(localStorage.getItem('pl-sp-limit')) || 0; } catch { return 0; } }

/** Service providers: budget ceilings (amount and unit rate) per project and overall, and spending per supplier. */
export function Providers() {
  const s = useStore((x) => x);
  const P = filtered(s);
  const [kind, setKind] = useState<Kind | ''>('');
  const [limit, setLimitS] = useState(readLimit);
  const setLimit = (v: number) => { setLimitS(v); try { localStorage.setItem('pl-sp-limit', String(v || '')); } catch { /* ignore */ } };
  const cname = (id: string) => s.ledger.countries.find((c) => c.id === id)?.name ?? id.toUpperCase();
  const C = ceilings(P).filter((r) => !kind || r.kind === kind);
  const POs = providerPOs(P).filter((x) => !kind || x.kind === kind);
  const S = suppliers(POs);
  const byKind = KINDS.map((k) => {
    const R = ceilings(P).filter((r) => r.kind === k.k);
    const rates = R.filter((r) => r.rate).map((r) => r.rate!);
    return { ...k, lines: R.length, projects: new Set(R.map((r) => r.p.id)).size, approved: R.reduce((a, r) => a + r.approved, 0), exposure: R.reduce((a, r) => a + r.exposure, 0), units: [...new Set(R.filter((r) => r.rate).map((r) => r.unit).filter(Boolean))], min: rates.length ? Math.min(...rates) : 0, max: rates.length ? Math.max(...rates) : 0, med: median(rates) };
  });
  const projects = [...new Set(C.map((r) => r.p.id))].map((id) => P.find((p) => p.id === id)!);
  const over = S.filter((x) => limit && (x.max > limit));
  const xlsx = () => download(`service-providers-${TODAY.toISOString().slice(0, 10)}.xlsx`, [
    { name: 'Overall', money: [3, 4, 5], rows: [['Kind', 'Projects', 'Lines', 'Budget ceiling', 'Spent + committed', 'Remaining', 'Used', 'Unit', 'Lowest rate', 'Median rate', 'Highest rate'], ...byKind.map((k) => [k.label, k.projects, k.lines, k.approved, k.exposure, k.approved - k.exposure, k.approved ? k.exposure / k.approved : '', k.units.join(' / '), k.min || '', k.med || '', k.max || ''])] },
    { name: 'By project', money: [7, 8, 9], rows: [['Project', 'Country', 'Line', 'Description', 'Kind', 'Unit', 'Units', 'Unit rate ceiling', 'Budget ceiling', 'Spent + committed', 'Remaining', 'Used'], ...C.map((r) => [lab(r.p), cname(r.p.country), r.code, r.description, kl(r.kind).label, r.unit, r.units ?? '', r.rate ?? '', r.approved, r.exposure, r.remaining, Number.isFinite(r.used) ? r.used : ''])] },
    { name: 'Suppliers', money: [3, 4, 5], rows: [['Supplier', 'Kind', 'POs', 'Amount', 'Spent', 'Spent + committed', 'Largest in one project', 'Projects', ...(limit ? ['Above limit'] : [])], ...S.map((x) => [x.supplier, kl(x.kind).label, x.pos, x.amount, x.spent, x.sc, x.max, [...x.projects.keys()].map((id) => lab(P.find((p) => p.id === id)!)).join(', '), ...(limit ? [x.max > limit ? 'yes' : ''] : [])])] },
    { name: 'Purchase orders', money: [6, 7, 8], rows: [['Project', 'PO', 'Line', 'Kind', 'Description', 'Supplier', 'Amount', 'Spent', 'Spent + committed', 'Status', 'Date'], ...POs.map((x) => [lab(x.p), x.po, x.line, kl(x.kind).label, x.description || x.nature, x.supplier, x.amount, x.spent, x.sc, x.status, x.date])] },
  ]);
  return (
    <>
      <section class="hero" aria-label="Service providers">
        {byKind.filter((k) => k.k !== 'events' || k.lines).slice(0, 4).map((k, i) => <div class={`kpi${i ? '' : ' lead'}`}>
          <span class="label">{k.label}</span><span class="value">{short(k.approved)}</span>
          <span class="ctx">ceiling in {k.projects} projects · used <b>{short(k.exposure)}</b> ({pct(k.approved ? k.exposure / k.approved : 0)}){k.med ? <> · median rate <b>{full(k.med)}</b>{k.units.length === 1 ? ` ${k.units[0].toLowerCase()}` : ''}</> : ''}</span></div>)}
      </section>
      <div class="grid g-12" style={{ marginTop: '16px' }}>
        <section class="card span-12">
          <div class="card-h" style={{ alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}><div><h2>Overall ceilings</h2><p>From the approved budget (or latest report) of each project · lines 1.1.2–1.1.3, 1.2.2–1.2.3, 5.5.1, 5.5.2 and 5.7 only</p></div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}><button class="btn" onClick={xlsx}>⤓ Excel</button></div></div>
          <div class="card-b table-scroll"><table class="mini"><thead><tr><th>Kind</th><th class="r">Projects</th><th class="r">Budget ceiling</th><th class="r">Spent + committed</th><th class="r">Remaining</th><th class="r">Used</th><th>Unit</th><th class="r">Unit rate: lowest</th><th class="r">median</th><th class="r">highest</th></tr></thead>
            <tbody>{byKind.map((k) => <tr class={`click${kind === k.k ? ' sel' : ''}`} onClick={() => setKind(kind === k.k ? '' : k.k)}>
              <td><i style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '2px', background: k.color, marginRight: '8px' }} /><b>{k.label}</b></td><td class="r num">{k.projects}</td>
              <td class="r num"><b>{full(k.approved)}</b></td><td class="r num">{full(k.exposure)}</td><td class="r num" style={{ color: k.approved - k.exposure < 0 ? '#e5484d' : undefined }}>{full(k.approved - k.exposure)}</td><td class="r num">{pct(k.approved ? k.exposure / k.approved : 0)}</td>
              <td>{k.units.join(' / ') || '—'}</td><td class="r num">{k.min ? full(k.min) : '—'}</td><td class="r num">{k.med ? full(k.med) : '—'}</td><td class="r num">{k.max ? full(k.max) : '—'}</td></tr>)}</tbody>
            <tfoot><tr><td><b>Total</b></td><td /><td class="r num"><b>{full(byKind.reduce((a, k) => a + k.approved, 0))}</b></td><td class="r num">{full(byKind.reduce((a, k) => a + k.exposure, 0))}</td><td class="r num">{full(byKind.reduce((a, k) => a + k.approved - k.exposure, 0))}</td><td colSpan={5} /></tr></tfoot></table>
            <p class="muted" style={{ marginTop: '6px' }}>Click a kind to show only it below{kind ? <> · <a href="javascript:void 0" onClick={() => setKind('')}>show all</a></> : ''}. Rates compare only within the same unit (per day, per 250 words…).</p></div>
        </section>
        <section class="card span-12">
          <div class="card-h"><div><h2>Ceilings by project</h2><p>Each budget line with its unit rate and amount — the limit the project may spend</p></div></div>
          <div class="card-b table-scroll"><table class="mini"><thead><tr><th>Project</th><th>Line</th><th>Kind</th><th>Unit</th><th class="r">Units</th><th class="r">Rate ceiling</th><th class="r">Budget ceiling</th><th class="r">Spent + committed</th><th class="r">Remaining</th><th class="r">Used</th></tr></thead>
            <tbody>{projects.map((p) => { const R = C.filter((r) => r.p === p); return <>
              {R.map((r, i) => <tr class="click" onClick={() => go(`project/${p.id}`)}>
                <td>{i === 0 && <><b>{lab(p)}</b><small class="muted"> {cname(p.country)}</small></>}</td>
                <td><span class="num">{r.code}</span> {r.description}</td><td><span class="badge neutral" style={{ borderLeft: `3px solid ${kl(r.kind).color}` }}>{kl(r.kind).label}</span></td>
                <td>{r.unit || '—'}</td><td class="r num">{r.units ?? '—'}</td><td class="r num">{r.rate ? full(r.rate) : '—'}</td><td class="r num"><b>{full(r.approved)}</b></td><td class="r num">{full(r.exposure)}</td>
                <td class="r num" style={{ color: r.remaining < 0 ? '#e5484d' : undefined }}>{full(r.remaining)}</td><td class="r num" style={{ color: r.used > 1 ? '#e5484d' : r.used > 0.9 ? '#c27c0e' : undefined }}>{pct(r.used)}</td></tr>)}
              <tr class="sub"><td /><td colSpan={5} class="muted">Project total</td><td class="r num"><b>{full(R.reduce((a, r) => a + r.approved, 0))}</b></td><td class="r num">{full(R.reduce((a, r) => a + r.exposure, 0))}</td><td class="r num">{full(R.reduce((a, r) => a + r.remaining, 0))}</td><td /></tr></>; })}</tbody></table>
            {!C.length && <p class="muted">No consultant, interpretation, translation or conference lines in the selected projects — import the approved budgets or the financial reports.</p>}</div>
        </section>
        <section class="card span-12">
          <div class="card-h" style={{ alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}><div><h2>Suppliers</h2><p>Spent + committed per supplier, from the purchase orders of the latest report workbook · {POs.length} POs</p></div>
            <label style={{ marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center' }}>Limit per supplier in one project (€)
              <input type="number" min="0" step="1000" value={limit || ''} placeholder="e.g. 60000" style={{ width: '120px' }} onChange={(e) => setLimit(Number((e.target as HTMLInputElement).value) || 0)} /></label></div>
          <div class="card-b table-scroll">
            {limit > 0 && <p style={{ margin: '0 0 8px', color: over.length ? '#e5484d' : undefined }}>{over.length ? `${over.length} suppliers above ${full(limit)} in a single project.` : `No supplier above ${full(limit)} in a single project.`}</p>}
            <table class="mini"><thead><tr><th>Supplier</th><th>Kind</th><th class="r">POs</th><th class="r">Spent</th><th class="r">Spent + committed</th><th class="r">Largest in one project</th><th>Projects</th></tr></thead>
              <tbody>{S.slice(0, 300).map((x) => <tr style={{ background: limit && x.max > limit ? 'color-mix(in srgb, #e5484d 10%, transparent)' : undefined }}>
                <td><b>{x.supplier}</b></td><td><span class="badge neutral" style={{ borderLeft: `3px solid ${kl(x.kind).color}` }}>{kl(x.kind).label}</span></td><td class="r num">{x.pos}</td>
                <td class="r num">{full(x.spent)}</td><td class="r num"><b>{full(x.sc)}</b></td><td class="r num" style={{ color: limit && x.max > limit ? '#e5484d' : undefined }}>{full(x.max)}</td>
                <td>{[...x.projects].map(([id, v]) => { const p = P.find((q) => q.id === id)!; return <button class="chip" onClick={() => go(`project/${id}`)} title={full(v)}>{lab(p)}</button>; })}</td></tr>)}</tbody></table>
            {!S.length && <p class="muted">No purchase orders for these services — supplier totals need report workbooks or system extractions with the “Purchase Orders” sheet.</p>}</div>
        </section>
      </div>
    </>
  );
}
