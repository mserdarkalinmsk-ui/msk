import { useState } from 'preact/hooks';
import { deleteOfficeReport, set, setOfficeCountry, setOfficeNote, useStore } from '../data/store';
import { type Fund, type Office, type OfficeNote, officeCountry, officePace, officeView, transferPlan } from '../domain/office';
import { downloadDocx } from '../ui/docxwrite';
import { date, full, short } from '../ui/format';
import { download } from '../ui/xlsxwrite';

const RED = 'var(--critical)', AMB = 'var(--c4)', GRN = 'var(--good)';
const FUND: Record<Fund, { label: string; short: string; color: string }> = { ob: { label: 'Ordinary Budget', short: 'OB', color: '#1d5fa8' }, ls: { label: 'LS & Pagoda', short: 'LS & Pagoda', color: '#7b2d8e' } };
const pc = (v: number) => (Number.isFinite(v) ? `${Math.round(v * 100)}%` : '—');
const neg = (v: number) => (v < -0.5 ? { color: RED } : undefined);

/** Programme offices' own running-cost budgets — Ordinary Budget and LS & Pagoda — one box per country, kept apart from projects. */
export function Offices() {
  const O = useStore((s) => s.ledger.offices ?? []);
  const countries = useStore((s) => s.ledger.countries);
  const cf = useStore((s) => s.filters.country);
  const [oid, setOid] = useState(''); const [rid, setRid] = useState(''); const [line, setLine] = useState('');
  const [openOnly, setOpenOnly] = useState(true); const [fund, setFund] = useState<Fund | 'both'>('both');
  const cname = (id: string) => countries.find((c) => c.id === id)?.name ?? officeCountry(id)?.name ?? id.toUpperCase();
  const shown = cf ? O.filter((o) => o.country === cf) : O;
  const o = shown.find((x) => x.id === oid) ?? shown[0];
  // Country boxes: every country with an office, plus portfolio countries still without an office budget.
  const boxes = [...new Set([...O.map((x) => x.country), ...countries.map((c) => c.id)])].filter((c) => !cf || c === cf);
  const Boxes = (
    <div class="of-boxes">{boxes.map((c) => { const of = O.filter((x) => x.country === c);
      if (!of.length) return <button class="of-box empty" onClick={() => set({ drawer: { kind: 'import' } })}><span class="of-c">{cname(c)}</span><span class="muted">No office budget yet</span><small>+ Import the office workbook</small></button>;
      return of.map((x) => { const r = x.reports.at(-1)!, V = officeView(r), T = V.T, tot = T.ob.budget + T.ls.budget, used = T.ob.sc + T.ls.sc, after = T.ob.left + T.ls.left;
        return <button class={`of-box${o?.id === x.id ? ' on' : ''}`} onClick={() => { setOid(x.id); setRid(''); setLine(''); }}>
          <span class="of-c">{cname(c)}</span><b>{x.name}</b>
          <span class="of-k"><span>Budget</span><b class="num">{short(tot)}</b></span>
          <span class="of-k"><span>Used</span><b class="num">{pc(tot ? used / tot : 0)}</b></span>
          <span class="of-k"><span>After plan</span><b class="num" style={neg(after)}>{after < 0 ? '−' : ''}{short(Math.abs(after))}</b></span>
          <span class="of-mini"><i style={{ width: `${Math.min(1, T.ob.sc / (tot || 1)) * 100}%`, background: FUND.ob.color }} /><i style={{ width: `${Math.min(1, T.ls.sc / (tot || 1)) * 100}%`, background: FUND.ls.color }} /></span>
          <small class="muted">situation {date(r.date)} · {x.reports.length} report{x.reports.length > 1 ? 's' : ''}</small></button>; }); })}</div>);
  if (!o) return <>{Boxes}<div class="card empty-page" style={{ marginTop: '16px' }}><div><h2>No office budget{cf ? ` for ${cname(cf)}` : ''} yet</h2><p>Drop the office's budget workbook (Situation Budgétaire with the report / forecast sheet) into Import. The country is recognised from the office (Bureau ANKARA → Türkiye); each office gets its own box. Office running costs are kept apart from the project figures.</p><button class="btn primary" onClick={() => set({ drawer: { kind: 'import' } })}>Import office budget</button></div></div></>;
  return <div class="offices">{Boxes}<OfficeDetail key={o.id} o={o} rid={rid} setRid={setRid} line={line} setLine={setLine} openOnly={openOnly} setOpenOnly={setOpenOnly} fund={fund} setFund={setFund} cname={cname} countries={countries.map((c) => c.id)} /></div>;
}

function OfficeDetail({ o, rid, setRid, line, setLine, openOnly, setOpenOnly, fund, setFund, cname, countries }: { o: Office; rid: string; setRid: (v: string) => void; line: string; setLine: (v: string) => void; openOnly: boolean; setOpenOnly: (v: boolean) => void; fund: Fund | 'both'; setFund: (v: Fund | 'both') => void; cname: (id: string) => string; countries: string[] }) {
  const r = o.reports.find((x) => x.id === rid) ?? o.reports.at(-1)!;
  const prev = o.reports[o.reports.indexOf(r) - 1];
  const V = officeView(r), T = V.T, ys = V.yearShare;
  const F: Fund[] = fund === 'both' ? ['ob', 'ls'] : [fund];
  const sit = r.situation, sysSC = sit ? sit.po + sit.invoice + sit.actual + sit.da : null;
  const entBy = new Map<string, number>(); for (const e of r.entries.filter((e) => e.fund === 'ob')) entBy.set(e.line, (entBy.get(e.line) ?? 0) + e.spent + e.committed);
  const recon = V.lines.map((l) => ({ l, ent: entBy.get(l.code) ?? 0 })).filter((x) => Math.abs(x.ent - x.l.ob.sc) > 1);
  const lsEnt = r.entries.filter((e) => e.fund === 'ls');
  const pv = prev ? new Map(prev.lines.map((l) => [l.code, l])) : null;
  // A system export has no LS & Pagoda figures: compare only the funds both reports carry.
  const DF = F.filter((f) => f === 'ob' || (prev?.hasPlan && r.hasPlan));
  const heads = [...new Set(V.lines.map((l) => l.heading))];
  const active = (l: (typeof V.lines)[number]) => F.some((f) => l[f].budget || l[f].sc || l[f].planned);
  const N = o.notes ?? {}, nk = (code: string) => `${r.year}:${code}`, done = (code: string) => !!N[nk(code)]?.resolved;
  const flags = V.lines.filter((l) => !done(l.code)).flatMap((l) => F.filter((f) => l.c[f].flag).map((f) => ({ l, f, flag: l.c[f].flag! })));
  const [edit, setEdit] = useState('');
  const E = r.entries.filter((e) => (!line || e.line === line) && (fund === 'both' || e.fund === fund) && (!openOnly || (/open/i.test(e.status) && e.committed > 0.5))).sort((a, b) => b.committed - a.committed || b.amount - a.amount);
  const xlsx = () => download(`${o.name.replace(/\s+/g, '-')}-${r.date}.xlsx`, [
    { name: 'Office budget', money: [2, 3, 4, 5, 6, 7, 8, 9], rows: [['Line', 'Description', 'OB budget', 'OB spent+committed', 'OB foreseen', 'OB leftover', 'LS & Pagoda budget', 'LS spent+committed', 'LS foreseen', 'LS leftover', 'OB flag', 'LS flag', 'Explanation'],
      ...V.lines.map((l) => [l.code, l.description, l.ob.budget, l.ob.sc, l.ob.planned, l.c.ob.leftAfterPlan, l.ls.budget, l.ls.sc, l.ls.planned, l.c.ls.leftAfterPlan, l.c.ob.flag ?? '', l.c.ls.flag ?? '', l.note ?? '']),
      ['Total', '', T.ob.budget, T.ob.sc, T.ob.planned, T.ob.left, T.ls.budget, T.ls.sc, T.ls.planned, T.ls.left]] },
    { name: 'Entries', money: [4, 5, 6], rows: [['Line', 'Document', 'Description', 'Supplier', 'Amount', 'Spent', 'Committed', 'Status', 'Date', 'Fund'], ...r.entries.map((e) => [e.line, e.doc, e.description, e.supplier, e.amount, e.spent, e.committed, e.status, e.date, FUND[e.fund].label])] }]);
  const Kpi = ({ f }: { f: Fund }) => { const t = T[f]; return (
    <div class="kpi of-kpi" style={{ borderTop: `3px solid ${FUND[f].color}` }}><span class="label" style={{ color: FUND[f].color }}>{FUND[f].label} {r.year}</span>
      <span class="value">{short(t.budget)}</span>
      <dl class="of-dl sm"><dt>Spent + committed</dt><dd class="num">{full(t.sc)} <small class="muted">({pc(t.budget ? t.sc / t.budget : 0)})</small></dd>
        <dt>{r.hasPlan ? 'Foreseen to year end' : 'Foreseen'}</dt><dd class="num">{r.hasPlan ? full(t.planned) : '—'}</dd>
        <dt><b>Leftover</b></dt><dd class="num" style={neg(t.left)}><b>{full(t.left)}</b></dd></dl>
      <div class="of-meter"><i style={{ width: `${Math.min(1, t.sc / (t.budget || 1)) * 100}%`, background: t.sc > t.budget ? RED : FUND[f].color }} /><i style={{ width: `${Math.min(1, t.planned / (t.budget || 1)) * 100}%`, background: `color-mix(in srgb, ${FUND[f].color} 30%, transparent)` }} /><em style={{ left: `${ys * 100}%` }} /></div>
      <small class="muted">{pc(ys)} of the year gone · tick</small></div>); };
  return (
    <>
      <div class="of-bar" style={{ marginTop: '16px' }}>
        <div><h2 style={{ margin: 0 }}>{o.name}</h2><small class="muted">
          <select class="of-csel" aria-label="Country" value={o.country} onChange={(e) => setOfficeCountry(o.id, (e.target as HTMLSelectElement).value)}>{[...new Set([o.country, ...countries])].map((c) => <option value={c}>{cname(c)}</option>)}</select>
          {o.ccm ? ` · CCM ${o.ccm}` : ''}{o.bh ? ` · BH ${o.bh} External Presence` : ''} · {r.year}</small></div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div class="seg"><button aria-pressed={fund === 'both'} onClick={() => setFund('both')}>Both</button><button aria-pressed={fund === 'ob'} onClick={() => setFund('ob')}>Ordinary Budget</button><button aria-pressed={fund === 'ls'} onClick={() => setFund('ls')}>LS & Pagoda</button></div>
          <select class="select" aria-label="Report" value={r.id} onChange={(e) => setRid((e.target as HTMLSelectElement).value)}>{[...o.reports].reverse().map((x) => <option value={x.id}>Situation {date(x.date)}{x.hasPlan ? '' : ' (system export)'}</option>)}</select>
          <button class="btn" onClick={() => set({ drawer: { kind: 'import' } })}>+ Import</button><button class="btn" onClick={xlsx}>⤓ Excel</button>
          <button class="btn ghost" title="Remove this report" onClick={() => { if (confirm('Remove this office report?')) deleteOfficeReport(o.id, r.id); }}>✕</button>
        </div>
      </div>
      <section class={`of-kpis n${F.length + 1}`} style={{ marginTop: '12px' }}>
        {F.map((f) => <Kpi f={f} />)}
        <div class="kpi of-kpi"><span class="label">{F.length > 1 ? 'Both funds' : 'Attention'}</span>
          {F.length > 1 && <><span class="value">{short(T.ob.budget + T.ls.budget)}</span><dl class="of-dl sm"><dt>Spent + committed</dt><dd class="num">{full(T.ob.sc + T.ls.sc)}</dd><dt>Foreseen</dt><dd class="num">{full(T.ob.planned + T.ls.planned)}</dd><dt><b>Leftover</b></dt><dd class="num" style={neg(T.ob.left + T.ls.left)}><b>{full(T.ob.left + T.ls.left)}</b></dd></dl></>}
          <small class={flags.length ? '' : 'muted'} style={{ color: flags.length ? AMB : undefined, fontWeight: 600 }}>{flags.length ? `${flags.length} line${flags.length > 1 ? 's' : ''} to look at` : 'No line needs attention'}</small>
          {T.ob.left < -0.5 && <small style={{ color: RED }}>Ordinary Budget short by {full(-T.ob.left)} after the forecast</small>}</div>
      </section>
      <div class="grid g-12" style={{ marginTop: '16px' }}>
        <HeadingCard r={r} prev={prev} F={F} skip={done} />
        <section class="card span-12"><div class="card-h"><div><h2>Budget lines</h2><p>As in the office report: budget · spent + committed · foreseen to year end · leftover, per fund{F.length === 1 ? ' · bar = used, light = foreseen, tick = share of the year' : ''} · click a line for its entries</p></div></div>
          <div class="card-b table-scroll"><table class="mini of-t"><thead>
            {F.length > 1 && <tr class="of-fh"><th colSpan={2} />{F.map((f) => <th colSpan={4} style={{ background: FUND[f].color }}>{FUND[f].label}</th>)}{pv && <th />}<th /></tr>}
            <tr><th>Line</th><th>Description</th>{F.map(() => <><th class="r">Budget</th><th class="r">Spent + committed</th><th class="r">Foreseen</th><th class="r">Leftover</th></>)}{F.length === 1 && <th style={{ width: '150px' }}>Use</th>}{pv && <th class="r">Δ S&C{DF.length < F.length ? ' (OB)' : ''} since {date(prev!.date)}</th>}<th>Attention</th></tr></thead>
            <tbody>{heads.map((h) => { const L = V.lines.filter((l) => l.heading === h && active(l)); if (!L.length) return null;
              const s = (f: Fund) => L.reduce((a, l) => ({ b: a.b + l[f].budget, sc: a.sc + l[f].sc, p: a.p + l[f].planned }), { b: 0, sc: 0, p: 0 });
              return <>{h && <tr class="of-h"><td colSpan={2}><b>{h}</b></td>{F.map((f) => { const x = s(f); return <><td class="r num"><b>{full(x.b)}</b></td><td class="r num"><b>{full(x.sc)}</b></td><td class="r num">{full(x.p)}</td><td class="r num" style={neg(x.b - x.sc - x.p)}><b>{full(x.b - x.sc - x.p)}</b></td></>; })}{F.length === 1 && <td />}{pv && <td />}<td /></tr>}
                {L.map((l) => { const d = pv ? DF.reduce((a, f) => a + l[f].sc - (pv.get(l.code)?.[f].sc ?? 0), 0) : 0, fl = F.map((f) => l.c[f].flag && { f, t: l.c[f].flag! }).filter(Boolean) as { f: Fund; t: string }[];
                  return <tr class={`click${line === l.code ? ' sel' : ''}`} onClick={() => setLine(line === l.code ? '' : l.code)}>
                    <td class="num">{l.code}</td><td>{l.description}{l.note && <small class="of-note">{l.note}</small>}</td>
                    {F.map((f) => <><td class="r num">{l[f].budget ? full(l[f].budget) : ''}</td><td class="r num">{l[f].sc ? full(l[f].sc) : ''}</td><td class="r num">{l[f].planned ? full(l[f].planned) : ''}</td><td class="r num" style={neg(l.c[f].leftAfterPlan)}>{l[f].budget || l[f].sc || l[f].planned ? full(l.c[f].leftAfterPlan) : ''}</td></>)}
                    {F.length === 1 && (() => { const f = F[0], a = l[f], w = (v: number) => `${Math.min(1, a.budget ? v / a.budget : v ? 1 : 0) * 100}%`;
                      return <td><span class="of-bar2"><em><b style={{ width: w(a.sc), background: a.sc > a.budget + 0.5 ? RED : FUND[f].color }} /><b style={{ width: w(a.planned), background: `color-mix(in srgb, ${FUND[f].color} 30%, transparent)` }} /><u style={{ left: `${ys * 100}%` }} /></em><small class="num">{a.budget ? pc(l.c[f].use) : a.sc ? 'no budget' : ''}</small></span></td>; })()}
                    {pv && <td class="r num" style={{ color: d > 0.5 ? undefined : 'var(--muted)' }}>{Math.abs(d) > 0.5 ? `${d > 0 ? '+' : '−'}${full(Math.abs(d))}` : ''}</td>}
                    <td>{N[nk(l.code)] ? <NoteBadge n={N[nk(l.code)]} /> : fl.map((x) => <span class={`badge ${/over|without|exceeds/.test(x.t) ? 'serious' : 'warning'}`} style={{ marginRight: '4px' }}>{F.length > 1 ? `${FUND[x.f].short}: ` : ''}{x.t}</span>)}
                      {fl.length > 0 && !N[nk(l.code)] && <button class="btn ghost of-nb" onClick={(e) => { e.stopPropagation(); setEdit(l.code); }}>+ note</button>}</td></tr>; })}</>; })}</tbody>
            <tfoot><tr><td colSpan={2}><b>TOTAL BUDGET</b></td>{F.map((f) => <><td class="r num"><b>{full(T[f].budget)}</b></td><td class="r num"><b>{full(T[f].sc)}</b></td><td class="r num"><b>{full(T[f].planned)}</b></td><td class="r num" style={neg(T[f].left)}><b>{full(T[f].left)}</b></td></>)}{F.length === 1 && <td />}{pv && <td class="r num">{full(DF.reduce((a, f) => a + T[f].sc - prev!.lines.reduce((s, l) => s + l[f].sc, 0), 0))}</td>}<td /></tr></tfoot></table></div></section>
        <PaceCard r={r} />
        <TransferCard o={o} r={r} skip={done} />
        <section class="card span-5"><div class="card-h"><div><h2>Reconciliation with the system</h2><p>Situation Budgétaire (Ordinary Budget, BH {o.bh ?? '0127'}) vs the office report</p></div></div>
          <div class="card-b">{sit ? <>
            <dl class="of-dl"><dt>Budget in the system</dt><dd class="num">{full(sit.budget)}</dd><dt>Purchase orders (open)</dt><dd class="num">{full(sit.po)}</dd><dt>Invoices not yet paid</dt><dd class="num">{full(sit.invoice)}</dd><dt>Actual expenditure</dt><dd class="num">{full(sit.actual)}</dd>
              <dt><b>System spent + committed</b></dt><dd class="num"><b>{full(sysSC!)}</b></dd><dt>Available in the system</dt><dd class="num">{full(sit.available)}</dd>
              <dt><b>Office report spent + committed (OB)</b></dt><dd class="num"><b>{full(T.ob.sc)}</b></dd>
              <dt>Difference</dt><dd class="num" style={{ color: Math.abs(T.ob.sc - sysSC!) > 1 ? AMB : GRN }}><b>{Math.abs(T.ob.sc - sysSC!) > 1 ? full(T.ob.sc - sysSC!) : 'none ✓'}</b></dd>
              {Math.abs(sit.budget - T.ob.budget) > 1 && <><dt>Budget difference</dt><dd class="num" style={{ color: AMB }}>{full(T.ob.budget - sit.budget)}</dd></>}</dl>
            {recon.length > 0 && <><p class="muted" style={{ fontSize: '12.5px', margin: '12px 0 6px' }}>Lines where the office report (OB) differs from the entries posted on the Ordinary Budget:</p>
              <ul class="of-rec">{recon.map((x) => { const ls = lsEnt.filter((e) => e.line === x.l.code).reduce((a, e) => a + e.spent + e.committed, 0);
                const n = N[nk(x.l.code)];
                return <li class={n?.resolved ? 'ok' : ''}><span class="num">{x.l.code}</span><span>{x.l.description}{ls > 0.5 && <small class="muted" style={{ display: 'block' }}>{full(ls)} of entries on this line are posted on LS & Pagoda</small>}
                  {n ? <NoteBadge n={n} onEdit={() => setEdit(x.l.code)} /> : <button class="btn ghost of-nb" onClick={() => setEdit(x.l.code)}>+ note / mark corrected</button>}</span><b class="num">{full(x.l.ob.sc)} vs {full(x.ent)}</b></li>; })}</ul></>}
          </> : <p class="muted">This file has no Situation Budgétaire sheet.</p>}</div></section>
        <section class="card span-7"><div class="card-h" style={{ alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}><div><h2>{line ? `Entries · line ${line}` : 'Entries'}</h2><p>{E.length} shown · purchase orders, invoices and GL postings{fund !== 'both' ? ` · ${FUND[fund].label}` : ''}</p></div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>{line && <button class="btn ghost" onClick={() => setLine('')}>All lines</button>}<div class="seg"><button aria-pressed={openOnly} onClick={() => setOpenOnly(true)}>Open</button><button aria-pressed={!openOnly} onClick={() => setOpenOnly(false)}>All</button></div></div></div>
          <div class="card-b table-scroll" style={{ maxHeight: '420px' }}><table class="mini"><thead><tr><th>Line</th><th>Description / supplier</th><th class="r">Spent</th><th class="r">Open</th><th>Date</th></tr></thead>
            <tbody>{E.slice(0, 200).map((e) => <tr style={{ borderLeft: `3px solid ${FUND[e.fund].color}` }}><td class="num">{e.line || '—'}<small class="muted" style={{ display: 'block' }}>{FUND[e.fund].short}</small></td><td><div class="cm-d">{e.description}</div><small class="muted">{e.supplier}{e.doc ? ` · ${e.gl ? 'GL' : 'PO'} ${e.doc}` : ''}</small></td><td class="r num">{full(e.spent)}</td><td class="r num"><b>{e.committed ? full(e.committed) : ''}</b></td><td class="num" style={{ whiteSpace: 'nowrap' }}>{e.date ? date(e.date) : '—'}</td></tr>)}</tbody></table>
            {!E.length && <p class="muted">No entries in this selection.</p>}</div></section>
      </div>
      {edit && <NoteEditor code={edit} codes={V.lines.map((l) => l.code)} desc={V.lines.find((l) => l.code === edit)?.description ?? ''} n={N[nk(edit)]} close={() => setEdit('')} save={(v) => { setOfficeNote(o.id, nk(edit), v); setEdit(''); }} />}
    </>
  );
}

function NoteBadge({ n, onEdit }: { n: OfficeNote; onEdit?: () => void }) {
  return <span class={`of-note-b${n.resolved ? ' ok' : ''}`} onClick={(e) => { if (onEdit) { e.stopPropagation(); onEdit(); } }} title={onEdit ? 'Edit note' : n.text}>
    {n.resolved ? '✓ corrected' : '✎ note'}{n.moveTo ? ` → line ${n.moveTo}` : ''}{n.text ? `: ${n.text}` : ''}</span>;
}

/** Explains a line's problem: free text, the line it really belongs to, and whether it has been corrected. */
function NoteEditor({ code, desc, codes, n, close, save }: { code: string; desc: string; codes: string[]; n?: OfficeNote; close: () => void; save: (v: OfficeNote | null) => void }) {
  const [text, setText] = useState(n?.text ?? ''), [moveTo, setMoveTo] = useState(n?.moveTo ?? ''), [resolved, setResolved] = useState(n?.resolved ?? true);
  const stop = (e: Event) => e.stopPropagation();
  return <div class="of-modal" onClick={close}><div class="card of-mbox" onClick={stop} role="dialog" aria-label={`Note for line ${code}`}>
    <h3 style={{ margin: 0 }}>Line {code} · {desc}</h3>
    <div class="field"><label for="of-nt">Explanation</label><textarea id="of-nt" rows={3} value={text} placeholder="e.g. Security services were charged to 1.10 by mistake; moved to 1.1 Rent and related charges (GL correction in May)." onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} /></div>
    <div class="field"><label for="of-mv">Belongs to line</label><select id="of-mv" class="select" value={moveTo} onChange={(e) => setMoveTo((e.target as HTMLSelectElement).value)}><option value="">— same line —</option>{codes.filter((c) => c !== code).map((c) => <option value={c}>{c}</option>)}</select></div>
    <label style={{ fontSize: '13px' }}><input type="checkbox" checked={resolved} onChange={() => setResolved(!resolved)} /> Corrected — no longer counted as a problem</label>
    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>{n && <button class="btn ghost" onClick={() => save(null)}>Remove note</button>}<button class="btn" onClick={close}>Cancel</button><button class="btn primary" onClick={() => save({ text: text.trim(), moveTo: moveTo || undefined, resolved, at: new Date().toISOString() })}>Save</button></div>
  </div></div>;
}

/** Office forecast vs the actual pace: is the year-end estimate realistic? Plus spending by month. */
function PaceCard({ r }: { r: Office['reports'][number] }) {
  const P = officePace(r), low = P.lines.filter((l) => l.low).sort((a, b) => b.gap - a.gap), gap = P.paceEnd - P.officeEnd, T = officeView(r).T.ob;
  const [all, setAll] = useState(false);
  const months = new Map<string, number>();
  for (const e of r.entries.filter((e) => e.fund === 'ob' && e.date.startsWith(String(r.year)))) months.set(e.date.slice(0, 7), (months.get(e.date.slice(0, 7)) ?? 0) + e.spent + e.committed);
  const M = Array.from({ length: 12 }, (_, i) => { const k = `${r.year}-${String(i + 1).padStart(2, '0')}`; return { k, v: months.get(k) ?? 0 }; }), mx = Math.max(...M.map((m) => m.v), 1);
  const rows = all ? P.lines : low;
  return <section class="card span-12"><div class="card-h" style={{ alignItems: 'center' }}><div><h2>Year-end estimate — Ordinary Budget</h2><p>The office forecast (spent + committed + foreseen) against the pace of payments so far ({Math.round(P.yearShare * 100)}% of the year gone){r.hasPlan ? '' : ' · this is a system export without a forecast'}</p></div></div>
    <div class="card-b of-pace">
      <dl class="of-dl"><dt>Budget</dt><dd class="num">{full(T.budget)}</dd><dt>Office forecast at year end</dt><dd class="num"><b>{full(P.officeEnd)}</b></dd><dt>Estimate at the current pace</dt><dd class="num"><b>{full(P.paceEnd)}</b></dd>
        <dt>Pace minus forecast</dt><dd class="num" style={{ color: gap > 250 ? AMB : GRN }}><b>{gap > 0 ? '+' : ''}{full(gap)}</b></dd>
        <dt>Shortfall at the current pace</dt><dd class="num" style={neg(T.budget - Math.max(P.paceEnd, P.officeEnd))}><b>{full(T.budget - Math.max(P.paceEnd, P.officeEnd))}</b></dd></dl>
      <div><div class="of-months" aria-label="Spent and committed by month (by posting date)">{M.map((m) => <span title={`${m.k}: ${full(m.v)}`}><i style={{ height: `${m.v / mx * 100}%` }} /><small>{'JFMAMJJASOND'[+m.k.slice(5) - 1]}</small></span>)}</div><small class="muted">Spent + committed by month of posting · a yearly PO shows in the month it was raised</small></div>
    </div>
    <div class="card-b" style={{ paddingTop: 0 }}><div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}><b style={{ fontSize: '13px' }}>{low.length ? `${low.length} line${low.length > 1 ? 's' : ''} where the forecast looks low` : 'The office forecast is in line with the pace on every line ✓'}</b><button class="btn ghost" style={{ marginLeft: 'auto' }} onClick={() => setAll(!all)}>{all ? 'Only lines to check' : 'All lines'}</button></div>
      {rows.length > 0 && <div class="table-scroll"><table class="mini"><thead><tr><th>Line</th><th>Description</th><th class="r">Budget</th><th class="r">Paid a month</th><th class="r">Office forecast</th><th class="r">At current pace</th><th class="r">Difference</th></tr></thead>
        <tbody>{rows.map((l) => <tr><td class="num">{l.code}</td><td>{l.description}</td><td class="r num">{full(l.budget)}</td><td class="r num">{full(l.monthly)}</td><td class="r num">{full(l.officeEnd)}</td><td class="r num"><b>{full(l.paceEnd)}</b></td><td class="r num" style={{ color: l.low ? AMB : undefined }}>{l.gap > 0.5 ? '+' : ''}{full(l.gap)}</td></tr>)}</tbody></table></div>}</div></section>;
}

/** Suggested transfers between lines to cover shortages, and the additional budget still needed; exportable as a Word draft. */
function TransferCard({ o, r, skip }: { o: Office; r: Office['reports'][number]; skip: (code: string) => boolean }) {
  const T = transferPlan(r, skip), short = T.needs.reduce((s, n) => s + n.need, 0);
  let el: HTMLElement | null = null;
  if (!T.needs.length) return <section class="card span-12"><div class="card-b"><b>No line is short after the forecast</b> — no transfer needed.</div></section>;
  const word = () => { if (el) void downloadDocx(`${o.name.replace(/\s+/g, '-')}-budget-transfer-${r.date}.docx`, el, `${o.name} budget transfer request`); };
  return <section class="card span-12"><div class="card-h" style={{ alignItems: 'center' }}><div><h2>Transfer proposal</h2><p>Room left on other lines after their own forecast and pace covers the shortages; the rest is the additional budget to request · lines marked corrected are left out</p></div><button class="btn" style={{ marginLeft: 'auto' }} onClick={word}>⤓ Word draft</button></div>
    <div class="card-b" ref={(x) => { el = x; }}>
      <h3 class="of-doc-t">{o.name} — Ordinary Budget {r.year}: budget transfer request</h3>
      <p>Based on the budget situation of {date(r.date)}, {T.needs.length} budget line{T.needs.length > 1 ? 's' : ''} of the {o.name} Ordinary Budget {r.year} will be short by <b>{full(short)}</b> after the foreseen expenditure to year end. {T.transfers.length ? <>We propose to cover <b>{full(short - T.request)}</b> by transfers from lines with remaining room{T.request > 0.5 ? <>, and request an additional <b>{full(T.request)}</b></> : ''}.</> : <>No line has room left: an additional <b>{full(T.request)}</b> is requested.</>}</p>
      <div class="of-tr"><div><h3>Transfers</h3>{T.transfers.length ? <table class="mini"><thead><tr><th>From line</th><th>To line</th><th class="r">Amount</th></tr></thead><tbody>{T.transfers.map((t) => <tr><td><span class="num">{t.from}</span> {t.fromDesc}</td><td><span class="num">{t.to}</span> {t.toDesc}</td><td class="r num"><b>{full(t.amount)}</b></td></tr>)}</tbody>
        <tfoot><tr><td colSpan={2}><b>Total transferred</b></td><td class="r num"><b>{full(short - T.request)}</b></td></tr></tfoot></table> : <p class="muted">No line has room left after its forecast.</p>}</div>
        <div><h3>Shortages</h3><table class="mini"><thead><tr><th>Line</th><th class="r">Short by</th><th class="r">Covered</th><th class="r">To request</th></tr></thead><tbody>{T.needs.map((n) => <tr><td><span class="num">{n.code}</span> {n.description}</td><td class="r num">{full(n.need)}</td><td class="r num">{full(n.covered)}</td><td class="r num" style={neg(-(n.need - n.covered))}><b>{n.need - n.covered > 0.5 ? full(n.need - n.covered) : '—'}</b></td></tr>)}</tbody>
          <tfoot><tr><td><b>Additional budget to request</b></td><td class="r num">{full(short)}</td><td class="r num">{full(short - T.request)}</td><td class="r num" style={neg(-T.request)}><b>{full(T.request)}</b></td></tr></tfoot></table></div></div>
      <p class="muted" style={{ fontSize: '12px' }}>Room on a line = budget − the larger of (spent + committed + foreseen) and the estimate at the current pace. {T.spare > 0.5 ? `${full(T.spare)} would still remain on other lines.` : ''} Check the transfer rules of the Ordinary Budget before submitting.</p>
    </div></section>;
}

/** Sub-totals per main heading (1 Rent … 4 Other running costs): both funds, change since the previous report, and the heading-level effect of the transfer proposal. */
function HeadingCard({ r, prev, F, skip }: { r: Office['reports'][number]; prev?: Office['reports'][number]; F: Fund[]; skip: (c: string) => boolean }) {
  const key = (c: string) => c.split('.')[0];
  const name = new Map(officeView(r).lines.filter((l) => l.heading).map((l) => [key(l.code), l.heading.replace(/^\d+\s*/, '')]));
  const H = [...new Set(r.lines.map((l) => key(l.code)))].sort((a, b) => +a - +b);
  const sum = (rep: typeof r | undefined, h: string, f: Fund) => { const o = { b: 0, sc: 0, p: 0 }; for (const l of rep?.lines ?? []) if (key(l.code) === h) { o.b += l[f].budget; o.sc += l[f].sc; o.p += l[f].planned; } return o; };
  const TP = transferPlan(r, skip), net = new Map<string, number>();
  for (const t of TP.transfers) { net.set(key(t.from), (net.get(key(t.from)) ?? 0) - t.amount); net.set(key(t.to), (net.get(key(t.to)) ?? 0) + t.amount); }
  const DF = F.filter((f) => f === 'ob' || (prev?.hasPlan && r.hasPlan));
  const tot = (f: Fund) => H.reduce((a, h) => { const x = sum(r, h, f); return { b: a.b + x.b, sc: a.sc + x.sc, p: a.p + x.p }; }, { b: 0, sc: 0, p: 0 });
  const maxB = Math.max(1, ...H.map((h) => F.reduce((a, f) => a + sum(r, h, f).b, 0)));
  return <section class="card span-12"><div class="card-h"><div><h2>By main heading</h2><p>Sub-totals as in the office report{prev ? ` · change in spent + committed since ${date(prev.date)}${DF.length < F.length ? ' (OB only — the system export has no LS figures)' : ''}` : ''} · transfers = net effect of the proposal on each heading (OB)</p></div></div>
    <div class="card-b table-scroll"><table class="mini of-t of-ht"><thead>
      {F.length > 1 && <tr class="of-fh"><th />{F.map((f) => <th colSpan={4} style={{ background: FUND[f].color }}>{FUND[f].label}</th>)}<th colSpan={4} /></tr>}
      <tr><th>Heading</th>{F.map(() => <><th class="r">Budget</th><th class="r">Spent + committed</th><th class="r">Foreseen</th><th class="r">Leftover</th></>)}<th style={{ width: '140px' }}>Share of budget</th>{prev && <th class="r">Δ S&C</th>}<th class="r">Transfers</th><th class="r">Leftover after transfers</th></tr></thead>
      <tbody>{H.map((h) => { const d = prev ? DF.reduce((a, f) => a + sum(r, h, f).sc - sum(prev, h, f).sc, 0) : 0, n = net.get(h) ?? 0, ob = sum(r, h, 'ob'), left = ob.b - ob.sc - ob.p, all = F.reduce((a, f) => a + sum(r, h, f).b, 0);
        return <tr class="of-h"><td><b>{h} — {name.get(h)}</b></td>
          {F.map((f) => { const x = sum(r, h, f), lo = x.b - x.sc - x.p; return <><td class="r num">{full(x.b)}</td><td class="r num">{full(x.sc)}</td><td class="r num">{full(x.p)}</td><td class="r num" style={neg(lo)}><b>{full(lo)}</b></td></>; })}
          <td><span class="of-u" style={{ width: '90px' }}><i style={{ width: `${all / maxB * 100}%`, background: FUND[F[0]].color }} /></span><small class="num">{pc(all / Math.max(1, F.reduce((a, f) => a + tot(f).b, 0)))}</small></td>
          {prev && <td class="r num" style={{ whiteSpace: 'nowrap' }}>{Math.abs(d) > 0.5 ? `${d > 0 ? '+' : '−'}${full(Math.abs(d))}` : '—'}</td>}
          <td class="r num" style={{ whiteSpace: 'nowrap', color: n > 0.5 ? GRN : n < -0.5 ? AMB : undefined }}>{Math.abs(n) > 0.5 ? `${n > 0 ? '+' : '−'}${full(Math.abs(n))}` : '—'}</td>
          <td class="r num" style={neg(left + n)}><b>{full(left + n)}</b></td></tr>; })}</tbody>
      <tfoot><tr><td><b>TOTAL BUDGET</b></td>{F.map((f) => { const x = tot(f); return <><td class="r num"><b>{full(x.b)}</b></td><td class="r num"><b>{full(x.sc)}</b></td><td class="r num"><b>{full(x.p)}</b></td><td class="r num" style={neg(x.b - x.sc - x.p)}><b>{full(x.b - x.sc - x.p)}</b></td></>; })}<td />
        {prev && <td class="r num">{full(DF.reduce((a, f) => a + tot(f).sc - prev.lines.reduce((s, l) => s + l[f].sc, 0), 0))}</td>}<td class="r num">0</td>{(() => { const o = tot('ob'), v = o.b - o.sc - o.p; return <td class="r num" style={neg(v)}><b>{full(v)}</b></td>; })()}</tr></tfoot></table>
      {TP.transfers.length > 0 && <p class="muted" style={{ fontSize: '12px', margin: '8px 0 0' }}>Between headings: {[...new Set(TP.transfers.filter((t) => key(t.from) !== key(t.to)).map((t) => `${key(t.from)} → ${key(t.to)}`))].map((k) => { const a = TP.transfers.filter((t) => `${key(t.from)} → ${key(t.to)}` === k).reduce((s, t) => s + t.amount, 0); return `${k}: ${full(a)}`; }).join(' · ') || 'all transfers stay within their heading'}.</p>}
    </div></section>;
}
