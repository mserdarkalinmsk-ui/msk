import { useState } from 'preact/hooks';
import { deleteOfficeReport, set, useStore } from '../data/store';
import { type OfficeReport, officeView } from '../domain/office';
import { date, full, short } from '../ui/format';
import { download } from '../ui/xlsxwrite';

const RED = '#e5484d', AMB = '#f5a524', GRN = '#30a46c', BLU = '#3b82c4';
const pc = (v: number) => (Number.isFinite(v) ? `${Math.round(v * 100)}%` : '—');

/** Programme offices' own running-cost budgets (Ordinary Budget + LS & Pagoda), kept apart from project portfolios. */
export function Offices() {
  const O = useStore((s) => s.ledger.offices ?? []);
  const countries = useStore((s) => s.ledger.countries);
  const [oid, setOid] = useState(O[0]?.id ?? ''); const o = O.find((x) => x.id === oid) ?? O[0];
  const [rid, setRid] = useState(''); const [line, setLine] = useState(''); const [openOnly, setOpenOnly] = useState(true);
  if (!o) return <div class="card empty-page"><div><h2>No office budget yet</h2><p>Drop the office's monthly budget workbook (Situation Budgétaire with the report / forecast sheets, BH 0127 External Presence) into Import. Each office gets its own page; office running costs are kept apart from the project figures.</p><button class="btn primary" onClick={() => set({ drawer: { kind: 'import' } })}>Import office budget</button></div></div>;
  const r = o.reports.find((x) => x.id === rid) ?? o.reports.at(-1)!;
  const prev = o.reports[o.reports.indexOf(r) - 1];
  const V = officeView(r), T = V.T, ys = V.yearShare;
  const sit = r.situation, sysSC = sit ? sit.po + sit.invoice + sit.actual + sit.da : null;
  const obE = r.entries.filter((e) => e.fund === 'ob'), entBy = new Map<string, number>();
  for (const e of obE) entBy.set(e.line, (entBy.get(e.line) ?? 0) + e.spent + e.committed);
  const recon = V.lines.map((l) => ({ l, ent: entBy.get(l.code) ?? 0 })).filter((x) => Math.abs(x.ent - x.l.ob.sc) > 1);
  const pv = prev ? new Map(prev.lines.map((l) => [l.code, l])) : null;
  const heads = [...new Set(V.lines.map((l) => l.heading))];
  const flags = V.lines.filter((l) => l.flag);
  const E = r.entries.filter((e) => (!line || e.line === line) && (!openOnly || (/open/i.test(e.status) && e.committed > 0.5))).sort((a, b) => b.committed - a.committed || b.amount - a.amount);
  const cname = countries.find((c) => c.id === o.country)?.name ?? '';
  const xlsx = () => download(`${o.name.replace(/\s+/g, '-')}-${r.date}.xlsx`, [
    { name: 'Office budget', money: [2, 3, 4, 5, 6, 7, 8], rows: [['Line', 'Description', 'OB budget', 'OB spent+committed', 'OB planned', 'OB left after plan', 'LS budget', 'LS spent+committed', 'LS planned', 'Use %', 'Flag', 'Explanation'],
      ...V.lines.map((l) => [l.code, l.description, l.ob.budget, l.ob.sc, l.ob.planned, l.leftAfterPlan, l.ls.budget, l.ls.sc, l.ls.planned, Number.isFinite(l.use) ? Math.round(l.use * 100) : '', l.flag ?? '', l.note ?? '']),
      ['Total', '', T.ob.budget, T.ob.sc, T.ob.planned, T.ob.left, T.ls.budget, T.ls.sc, T.ls.planned]] },
    { name: 'Entries', money: [4, 5, 6], rows: [['Line', 'Document', 'Description', 'Supplier', 'Amount', 'Spent', 'Committed', 'Status', 'Date', 'Fund'], ...r.entries.map((e) => [e.line, e.doc, e.description, e.supplier, e.amount, e.spent, e.committed, e.status, e.date, e.fund === 'ob' ? 'Ordinary budget' : 'LS & Pagoda'])] }]);
  return (
    <>
      <div class="of-bar">
        {O.length > 1 && <select class="select" value={o.id} onChange={(e) => { setOid((e.target as HTMLSelectElement).value); setRid(''); }}>{O.map((x) => <option value={x.id}>{x.name}</option>)}</select>}
        <div><h2 style={{ margin: 0 }}>{o.name}</h2><small class="muted">{cname}{o.ccm ? ` · CCM ${o.ccm}` : ''}{o.bh ? ` · BH ${o.bh} External Presence` : ''} · {r.year} budget</small></div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          <select class="select" aria-label="Report" value={r.id} onChange={(e) => setRid((e.target as HTMLSelectElement).value)}>{[...o.reports].reverse().map((x) => <option value={x.id}>Situation {date(x.date)}{x.hasPlan ? '' : ' (system export)'}</option>)}</select>
          <button class="btn" onClick={() => set({ drawer: { kind: 'import' } })}>+ Import</button><button class="btn" onClick={xlsx}>⤓ Excel</button>
          <button class="btn ghost" title="Remove this report" onClick={() => { if (confirm('Remove this office report?')) deleteOfficeReport(o.id, r.id); }}>✕</button>
        </div>
      </div>
      <section class="hero" aria-label="Office budget" style={{ marginTop: '12px' }}>
        <div class="kpi lead"><span class="label">Ordinary budget {r.year}</span><span class="value">{short(T.ob.budget)}</span><span class="ctx">spent + committed <b>{short(T.ob.sc)}</b> · {pc(T.ob.budget ? T.ob.sc / T.ob.budget : 0)} used with {pc(ys)} of the year gone</span>
          <div class="of-meter"><i style={{ width: `${Math.min(1, T.ob.sc / (T.ob.budget || 1)) * 100}%`, background: T.ob.sc > T.ob.budget ? RED : BLU }} /><i style={{ width: `${Math.min(1, T.ob.planned / (T.ob.budget || 1)) * 100}%`, background: 'color-mix(in srgb, #3b82c4 35%, transparent)' }} /><em style={{ left: `${ys * 100}%` }} /></div></div>
        <div class="kpi"><span class="label">Planned to year end</span><span class="value">{r.hasPlan ? short(T.ob.planned) : '—'}</span><span class="ctx">{r.hasPlan ? 'from the office forecast' : 'system export — no forecast sheet'}</span></div>
        <div class="kpi"><span class="label">Left after plan</span><span class="value" style={{ color: T.ob.left < 0 ? RED : GRN }}>{T.ob.left < 0 ? '−' : ''}{short(Math.abs(T.ob.left))}</span><span class="ctx">{T.ob.left < 0 ? 'additional budget needed (or cuts)' : 'available in the ordinary budget'}</span></div>
        <div class="kpi"><span class="label">LS & Pagoda (rent)</span><span class="value">{short(T.ls.budget)}</span><span class="ctx">used {short(T.ls.sc)}{r.hasPlan ? ` · planned ${short(T.ls.planned)} · left ${short(T.ls.left)}` : ''}</span></div>
      </section>
      <div class="grid g-12" style={{ marginTop: '16px' }}>
        <section class="card span-12"><div class="card-h"><div><h2>Budget lines</h2><p>Bar = spent + committed against the line budget, light = planned to year end, tick = share of the year gone · click a line to see its entries</p></div></div>
          <div class="card-b table-scroll"><table class="mini of-t"><thead><tr><th>Line</th><th>Description</th><th class="r">Budget</th><th class="r">Spent + committed</th><th style={{ width: '170px' }}>Use</th><th class="r">Planned</th><th class="r">Left after plan</th>{pv && <th class="r">Δ since {date(prev!.date)}</th>}<th>Attention</th></tr></thead>
            <tbody>{heads.map((h) => { const L = V.lines.filter((l) => l.heading === h && (l.ob.budget || l.ob.sc || l.ob.planned || l.ls.budget || l.ls.sc)); if (!L.length) return null;
              const s = L.reduce((a, l) => ({ b: a.b + l.ob.budget, sc: a.sc + l.ob.sc, p: a.p + l.ob.planned }), { b: 0, sc: 0, p: 0 });
              return <>{h && <tr class="of-h"><td colSpan={2}><b>{h}</b></td><td class="r num"><b>{full(s.b)}</b></td><td class="r num"><b>{full(s.sc)}</b></td><td /><td class="r num">{full(s.p)}</td><td class="r num" style={{ color: s.b - s.sc - s.p < 0 ? RED : undefined }}><b>{full(s.b - s.sc - s.p)}</b></td>{pv && <td />}<td /></tr>}
                {L.map((l) => { const d = pv ? l.ob.sc - (pv.get(l.code)?.ob.sc ?? 0) : 0, w = (v: number) => `${Math.min(1, l.ob.budget ? v / l.ob.budget : v ? 1 : 0) * 100}%`;
                  return <tr class={`click${line === l.code ? ' sel' : ''}`} onClick={() => setLine(line === l.code ? '' : l.code)}>
                    <td class="num">{l.code}</td><td>{l.description}{l.ls.budget || l.ls.sc ? <small class="muted" style={{ display: 'block' }}>LS & Pagoda: budget {full(l.ls.budget)} · used {full(l.ls.sc)}{l.ls.planned ? ` · planned ${full(l.ls.planned)}` : ''}</small> : null}{l.note && <small class="of-note">{l.note}</small>}</td>
                    <td class="r num">{full(l.ob.budget)}</td><td class="r num">{full(l.ob.sc)}</td>
                    <td><span class="of-bar2"><em><b style={{ width: w(l.ob.sc), background: l.ob.sc > l.ob.budget + 0.5 ? RED : BLU }} /><b style={{ width: w(l.ob.planned), background: 'color-mix(in srgb, #3b82c4 30%, transparent)' }} /><u style={{ left: `${ys * 100}%` }} /></em><small class="num">{l.ob.budget ? pc(l.use) : l.ob.sc ? 'no budget' : ''}</small></span></td>
                    <td class="r num">{l.ob.planned ? full(l.ob.planned) : ''}</td><td class="r num" style={{ color: l.leftAfterPlan < -0.5 ? RED : undefined }}>{full(l.leftAfterPlan)}</td>
                    {pv && <td class="r num" style={{ color: d > 0.5 ? undefined : 'var(--muted)' }}>{Math.abs(d) > 0.5 ? `${d > 0 ? '+' : '−'}${full(Math.abs(d))}` : ''}</td>}
                    <td>{l.flag && <span class={`badge ${/over|without|exceeds/.test(l.flag) ? 'serious' : 'warning'}`}>{l.flag}</span>}</td></tr>; })}</>; })}</tbody>
            <tfoot><tr><td colSpan={2}><b>Total ordinary budget</b></td><td class="r num"><b>{full(T.ob.budget)}</b></td><td class="r num"><b>{full(T.ob.sc)}</b></td><td /><td class="r num"><b>{full(T.ob.planned)}</b></td><td class="r num" style={{ color: T.ob.left < 0 ? RED : undefined }}><b>{full(T.ob.left)}</b></td>{pv && <td class="r num">{full(T.ob.sc - prev!.lines.reduce((a, l) => a + l.ob.sc, 0))}</td>}<td>{flags.length > 0 && <span class="muted">{flags.length} lines to look at</span>}</td></tr></tfoot></table></div></section>
        <section class="card span-5"><div class="card-h"><div><h2>Reconciliation with the system</h2><p>Situation Budgétaire (Ordinary Budget, BH {o.bh ?? '0127'}) vs the office report</p></div></div>
          <div class="card-b">{sit ? <>
            <dl class="of-dl"><dt>Budget in the system</dt><dd class="num">{full(sit.budget)}</dd><dt>Purchase orders (open)</dt><dd class="num">{full(sit.po)}</dd><dt>Invoices not yet paid</dt><dd class="num">{full(sit.invoice)}</dd><dt>Actual expenditure</dt><dd class="num">{full(sit.actual)}</dd>
              <dt><b>System spent + committed</b></dt><dd class="num"><b>{full(sysSC!)}</b></dd><dt>Available in the system</dt><dd class="num">{full(sit.available)}</dd>
              <dt><b>Office report spent + committed</b></dt><dd class="num"><b>{full(T.ob.sc)}</b></dd>
              <dt>Difference</dt><dd class="num" style={{ color: Math.abs(T.ob.sc - sysSC!) > 1 ? AMB : GRN }}><b>{Math.abs(T.ob.sc - sysSC!) > 1 ? full(T.ob.sc - sysSC!) : 'none ✓'}</b></dd>
              {Math.abs(sit.budget - T.ob.budget) > 1 && <><dt>Budget difference</dt><dd class="num" style={{ color: AMB }}>{full(T.ob.budget - sit.budget)}</dd></>}</dl>
            {recon.length > 0 && <><p class="muted" style={{ fontSize: '12.5px', margin: '12px 0 6px' }}>Lines where the office report differs from the posted entries:</p>
              <ul class="of-rec">{recon.map((x) => <li><span class="num">{x.l.code}</span> {x.l.description}<b class="num">{full(x.l.ob.sc)} vs {full(x.ent)}</b></li>)}</ul></>}
          </> : <p class="muted">This file has no Situation Budgétaire sheet.</p>}</div></section>
        <section class="card span-7"><div class="card-h" style={{ alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}><div><h2>{line ? `Entries · line ${line}` : 'Entries'}</h2><p>{E.length} shown · purchase orders, invoices and GL postings from the system export</p></div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>{line && <button class="btn ghost" onClick={() => setLine('')}>All lines</button>}<div class="seg"><button aria-pressed={openOnly} onClick={() => setOpenOnly(true)}>Open</button><button aria-pressed={!openOnly} onClick={() => setOpenOnly(false)}>All</button></div></div></div>
          <div class="card-b table-scroll" style={{ maxHeight: '420px' }}><table class="mini"><thead><tr><th>Line</th><th>Description / supplier</th><th class="r">Spent</th><th class="r">Open</th><th>Date</th></tr></thead>
            <tbody>{E.slice(0, 200).map((e) => <tr><td class="num">{e.line || '—'}{e.fund === 'ls' && <small class="muted" style={{ display: 'block' }}>LS</small>}</td><td><div class="cm-d">{e.description}</div><small class="muted">{e.supplier}{e.doc ? ` · ${e.gl ? 'GL' : 'PO'} ${e.doc}` : ''}</small></td><td class="r num">{full(e.spent)}</td><td class="r num"><b>{e.committed ? full(e.committed) : ''}</b></td><td class="num" style={{ whiteSpace: 'nowrap' }}>{e.date ? date(e.date) : '—'}</td></tr>)}</tbody></table>
            {!E.length && <p class="muted">No entries in this selection.</p>}</div></section>
      </div>
    </>
  );
}
export type { OfficeReport };
