import { useMemo, useState } from 'preact/hooks';
import { go } from '../data/store';
import { compareBudget, findErrors, presets, spendBetween, type Finding } from '../domain/ledger';
import { budgetRefs, organisedSheets } from '../domain/organised';
import type { Project } from '../domain/types';
import type { Entry, WorkbookSummary } from '../domain/workbook';
import { TODAY } from '../today';
import { elapsed } from '../domain/calc';
import { DataTable, type Column } from '../ui/DataTable';
import { exportOk } from '../ui/exportGate';
import { date, full, month } from '../ui/format';
import { download } from '../ui/xlsxwrite';

const SRC = { invoice: 'Invoice', gl: 'GL' } as const;

/** Dated postings of a system extraction: spending between any two dates, entries to check, and the tidy workbook. */
export function LedgerPanel({ p, wb, mode }: { p: Project; wb: WorkbookSummary; mode: 'range' | 'checks' | 'budget' }) {
  const E = wb.entries ?? [];
  const P = presets(TODAY);
  const [from, setFrom] = useState(P.find((x) => x.key === 'y')!.from), [to, setTo] = useState(P.find((x) => x.key === 'y')!.to);
  const [line, setLine] = useState('');
  const leaf = wb.lines.filter((l) => l.leaf);
  const R = useMemo(() => spendBetween(E, from, to, budgetRefs(wb.lines)), [E, from, to, wb.lines]);
  const sc = useMemo(() => new Map(leaf.map((l) => [l.code, l.sc ?? 0])), [wb]);
  const F = useMemo(() => findErrors(E, { budget: budgetRefs(leaf), start: p.start, end: p.end, bh: wb.meta.bh ?? p.bh, pos: wb.pos, sc, asAt: wb.meta.situationDate, elapsed: elapsed(p, TODAY), units: leaf.filter((l) => l.budget.units && l.actual.units != null).map((l) => ({ code: l.code, description: l.description, unit: l.unit, budget: l.budget.units!, used: l.actual.units! })) }), [E, wb, p.start, p.end]);
  const C = useMemo(() => compareBudget(E, budgetRefs(leaf), sc, from, to), [E, wb, from, to]);
  const hasBudget = leaf.some((l) => l.budget.cost);
  const name = new Map(wb.lines.map((l) => [l.code, l.description]));
  const save = (ranged: boolean) => {
    if (!exportOk(p, 'the organised report')) return;
    const tag = ranged ? `${from || 'start'}_${to || 'today'}` : (wb.meta.situationDate ?? TODAY.toISOString().slice(0, 10));
    download(`${p.code}-organised-report-${tag}.xlsx`, organisedSheets(p, wb, { ...(ranged ? { from, to } : {}), findings: F }));
  };
  if (!E.length) return (
    <div class="empty-inline" style={{ padding: '20px' }}>
      <p>This report was saved before dated postings were kept, or the file has no invoice / GL sheets. Import the system extraction again (Factures a date, Ecriture GL) to see spending by date and the entry checks.</p>
    </div>
  );

  if (mode === 'budget') return <BudgetCompare C={C} from={from} to={to} hasBudget={hasBudget} p={p} />;
  if (mode === 'checks') return <Checks F={F} onSave={() => save(false)} />;

  const rows = line ? R.rows.filter((e) => (e.line || '—') === line) : R.rows;
  const cols: Column<Entry>[] = [
    { key: 'dt', label: 'Date', width: 96, pin: true, value: (e) => e.date, render: (e) => <span class="num">{date(e.date)}</span> },
    { key: 'src', label: 'Type', width: 70, value: (e) => SRC[e.src] },
    { key: 'doc', label: 'Document', width: 170, value: (e) => e.doc },
    { key: 'po', label: 'PO', width: 80, value: (e) => e.po },
    { key: 'line', label: 'Line', width: 70, value: (e) => e.line, render: (e) => <span class="num">{e.line || '—'}</span> },
    { key: 'sup', label: 'Supplier', width: 190, value: (e) => e.supplier },
    { key: 'd', label: 'Description', width: 300, value: (e) => e.description },
    { key: 'a', label: 'Amount', width: 120, align: 'r', sum: true, format: full, value: (e) => e.amount },
  ];
  return (
    <div class="ledger">
      <div class="range-bar">
        <div class="seg wrap">{P.map((x) => <button aria-pressed={from === x.from && to === x.to} onClick={() => { setFrom(x.from); setTo(x.to); }}>{x.label}</button>)}</div>
        <label>From <input type="date" value={from} onInput={(e) => setFrom((e.target as HTMLInputElement).value)} /></label>
        <label>To <input type="date" value={to} onInput={(e) => setTo((e.target as HTMLInputElement).value)} /></label>
        <span class="grow" />
        <button class="btn" onClick={() => save(true)}>⬇ Excel for this range</button>
        <button class="btn primary" onClick={() => save(false)}>⬇ Organised report (Excel)</button>
      </div>
      <div class="range-sum">
        <div><span>Spent in range</span><b class="num">{full(R.total)}</b></div>
        <div><span>Postings</span><b class="num">{R.n}</b></div>
        <div><span>Invoices on POs</span><b class="num">{full(R.lines.reduce((a, l) => a + l.invoices, 0))}</b></div>
        <div><span>GL entries</span><b class="num">{full(R.lines.reduce((a, l) => a + l.gl, 0))}</b></div>
        <div class="months">{R.months.map((m) => <span title={full(m.amount)}><i style={{ height: `${Math.max(2, (Math.abs(m.amount) / Math.max(1, ...R.months.map((x) => Math.abs(x.amount)))) * 36)}px` }} /><em>{month(m.month + '-01').split(' ')[0]}</em></span>)}</div>
      </div>
      <table class="range-lines">
        <thead><tr><th>Line</th><th>Description</th><th class="r">Invoices</th><th class="r">GL</th><th class="r">Total</th><th class="r">Entries</th></tr></thead>
        <tbody>{R.lines.map((l) => (
          <tr class={`click${line === (l.line || '—') ? ' on' : ''}`} onClick={() => setLine(line === (l.line || '—') ? '' : l.line || '—')} title="Show the postings of this line">
            <td class="num">{l.line || '—'}</td><td>{l.description || name.get(l.line) || ''}</td><td class="num r">{full(l.invoices)}</td><td class="num r">{full(l.gl)}</td><td class="num r"><b>{full(l.amount)}</b></td><td class="num r">{l.n}</td>
          </tr>))}</tbody>
        <tfoot><tr><td colSpan={4}><b>Total</b></td><td class="num r"><b>{full(R.total)}</b></td><td class="num r">{R.n}</td></tr></tfoot>
      </table>
      <div class="range-h"><h3>{line ? `Postings on line ${line}` : 'All postings in range'} · {rows.length}</h3>{line && <button class="btn sm" onClick={() => setLine('')}>Show all lines</button>}</div>
      <DataTable rows={rows} columns={cols} rowKey={(e) => e.src + e.doc + e.line + e.amount + e.date + e.description} title={`${p.code}-postings-${from || 'start'}-${to || 'today'}`} storageKey="pl-cols-ledger" maxHeight={480} />
    </div>
  );
}

function Checks({ F, onSave }: { F: Finding[]; onSave: () => void }) {
  const [open, setOpen] = useState<number | null>(null);
  const n = F.filter((f) => f.level !== 'info').length;
  return (
    <div class="ledger">
      <div class="range-bar"><p class="muted" style={{ margin: 0 }}>{n ? `${n} kinds of entry to check` : 'No entry needs a second look'} · each rule can be checked line by line in the source file. Purchase orders split over several lines are not flagged.</p><span class="grow" /><button class="btn primary" onClick={onSave}>⬇ Organised report (Excel)</button></div>
      <ul class="findings">{F.map((f, i) => (
        <li class={f.level}>
          <button class="f-h" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
            <span class={`badge ${f.level === 'error' ? 'serious' : f.level === 'warning' ? 'warning' : 'info'}`}>{f.level === 'error' ? 'Error' : f.level === 'warning' ? 'Check' : 'Note'}</span>
            <b>{f.title}</b><span class="f-t">{f.text}</span><span class="num f-a">{full(f.amount)}</span><span class="f-n">{f.rows.length} ▾</span>
          </button>
          {open === i && <div class="f-rows"><table class="range-lines"><thead><tr><th>Date</th><th>Document</th><th>Line</th><th>Description</th><th class="r">Amount</th></tr></thead>
            <tbody>{f.rows.map((r) => <tr><td class="num">{r.date ? date(r.date) : '—'}</td><td>{r.doc}</td><td class="num">{r.line || '—'}</td><td>{r.description}</td><td class="num r">{full(r.amount)}</td></tr>)}</tbody></table></div>}
        </li>))}</ul>
    </div>
  );
}

const HEAD: Record<string, string> = { '1': 'Human resources', '2': 'Travel', '3': 'Equipment and supplies', '4': 'Local office', '5': 'Other costs, services', '6': 'Other', '8': 'Contingency reserve' };
function BudgetCompare({ C, from, to, hasBudget, p }: { C: ReturnType<typeof compareBudget>; from: string; to: string; hasBudget: boolean; p: Project }) {
  if (!hasBudget) return <div class="empty-inline" style={{ padding: '20px' }}><p>No approved budget on file for this project. Add the approved budget (Add documents) and every line is compared here.</p></div>;
  const badge = (st: string) => st === 'over' || st === 'over-flex' ? <span class="badge serious">{st === 'over' ? 'Over budget' : 'Addendum (beyond 25%)'}</span> : st === 'near-flex' ? <span class="badge serious">Near addendum (20–25%)</span> : st === 'within-flex' ? <span class="badge warning">Notification (within 25%)</span> : st === 'high' ? <span class="badge warning">90%+ used</span> : st === 'unbudgeted' ? <span class="badge serious">Not budgeted</span> : <span class="badge good">OK</span>;
  const bar = (u: number) => <div class="minibar" style={{ width: '90px', display: 'inline-block', verticalAlign: 'middle' }}><span style={{ width: `${Math.min(100, u * 100)}%`, background: u > 1 ? 'var(--serious)' : u >= .9 ? 'var(--warn)' : undefined }} /></div>;
  const T = C.lines.reduce((a, l) => ({ b: a.b + l.budget, r: a.r + l.inRange, t: a.t + l.toDate, s: a.s + l.sc }), { b: 0, r: 0, t: 0, s: 0 });
  const over = C.heads.filter((h) => h.diff > 0.5), spare = C.heads.filter((h) => h.diff < -0.5).sort((a, b) => a.diff - b.diff);
  const need = over.reduce((a, h) => a + h.diff, 0), addendum = C.heads.some((h) => h.status === 'over-flex' || h.status === 'near-flex');
  // transfers: cover each heading above its budget from the headings with the most unused budget
  const moves: { from: string; to: string; amount: number }[] = [];
  { const left = spare.map((h) => ({ h: h.h, v: -h.diff })); for (const o of over) { let n = o.diff; for (const l of left) { if (n <= 0.005) break; const m = Math.min(n, l.v); if (m > 0.005) { moves.push({ from: l.h, to: o.h, amount: Math.round(m * 100) / 100 }); l.v -= m; n -= m; } } } }
  const proposal = () => download(`${p.bh ?? p.code}-budget-revision-proposal.xlsx`, [{ name: 'Revision proposal', money: [2, 3, 4, 5], rows: [
    [{ v: `${p.bh ? `${p.bh} - ` : ''}${p.name} — budget revision proposal (${addendum ? 'addendum' : 'notification'})`, st: 'title' }], [],
    ['Heading', 'Name', 'Approved', 'Spent + committed', 'Change', 'Revised', '% change', 'Route'].map((v) => ({ v, st: 'head' as const })),
    ...C.heads.map((h) => { const ch = moves.filter((m) => m.to === h.h).reduce((a, m) => a + m.amount, 0) - moves.filter((m) => m.from === h.h).reduce((a, m) => a + m.amount, 0); return [h.h, HEAD[h.h] ?? '', h.budget, h.sc, ch, h.budget + ch, h.budget ? ch / h.budget : 0, Math.abs(h.budget ? ch / h.budget : 0) > 0.25 ? 'Addendum' : ch ? 'Notification' : '']; }),
    [], [{ v: 'Transfers', st: 'bold' }], ['From heading', '', 'To heading', 'Amount'].map((v) => ({ v, st: 'head' as const })), ...moves.map((m) => [`${m.from}. ${HEAD[m.from] ?? ''}`, '', `${m.to}. ${HEAD[m.to] ?? ''}`, m.amount])] }]);
  return (
    <div class="ledger">
      {over.length ? <div class={`rev-callout ${addendum ? 'serious' : 'warning'}`}>
        <div><b>{addendum ? 'Addendum needed' : 'Notification needed'}</b> — {over.length} heading{over.length > 1 ? 's' : ''} above the approved budget by {full(need)}{spare.length ? `; ${full(Math.min(need, -spare.reduce((a, h) => a + h.diff, 0)))} can come from ${spare.map((h) => `${h.h}. ${HEAD[h.h] ?? ''}`).join(', ')}` : ''}.
          {moves.length ? <ul>{moves.map((m) => <li>{full(m.amount)} from {m.from}. {HEAD[m.from] ?? ''} → {m.to}. {HEAD[m.to] ?? ''}</li>)}</ul> : null}</div>
        <div class="rev-actions"><button class="btn primary" onClick={proposal}>⬇ Revision proposal</button><button class="btn" title="Forecast and budget revision in the CoE template, with the notification letter" onClick={() => go(`project/${p.id}/forecast`)}>Prepare the {addendum ? 'addendum' : 'notification'} →</button></div>
      </div> : null}
      <h3 style={{ margin: '4px 0 0' }}>By heading — 25% flexibility</h3>
      <table class="range-lines"><thead><tr><th>Heading</th><th class="r">Approved budget</th><th class="r">Spent + committed</th><th class="r">Difference</th><th class="r">%</th><th>Status</th></tr></thead>
        <tbody>{C.heads.map((h) => <tr><td>{h.h}. {HEAD[h.h] ?? ''}</td><td class="num r">{full(h.budget)}</td><td class="num r">{full(h.sc)}</td><td class="num r">{h.diff > 0 ? '+' : '−'}{full(Math.abs(h.diff))}</td><td class="num r">{h.budget ? `${h.pct > 0 ? '+' : ''}${(h.pct * 100).toFixed(1)}%` : '—'}</td><td>{badge(h.status)}</td></tr>)}</tbody></table>
      <h3 style={{ margin: '8px 0 0' }}>By line{from || to ? ` · range ${from ? date(from) : 'start'} → ${to ? date(to) : 'today'}` : ''}</h3>
      <table class="range-lines"><thead><tr><th>Line</th><th>Description</th><th class="r">Approved budget</th><th class="r">Spent in range</th><th class="r">Spent to range end</th><th class="r">Spent + committed</th><th class="r">Available</th><th>Used</th><th>Status</th></tr></thead>
        <tbody>{C.lines.map((l) => <tr><td class="num">{l.code}</td><td>{l.description}</td><td class="num r">{full(l.budget)}</td><td class="num r">{full(l.inRange)}</td><td class="num r">{full(l.toDate)}</td><td class="num r">{full(l.sc)}</td><td class="num r">{l.available < 0 ? '−' : ''}{full(Math.abs(l.available))}</td><td class="num">{bar(l.used)} {Math.round(l.used * 100)}%</td><td>{badge(l.status)}</td></tr>)}</tbody>
        <tfoot><tr><td colSpan={2}><b>Total direct costs</b></td><td class="num r"><b>{full(T.b)}</b></td><td class="num r"><b>{full(T.r)}</b></td><td class="num r"><b>{full(T.t)}</b></td><td class="num r"><b>{full(T.s)}</b></td><td class="num r"><b>{full(T.b - T.s)}</b></td><td class="num">{T.b ? Math.round(T.s / T.b * 100) : 0}%</td><td /></tr></tfoot></table>
    </div>
  );
}
