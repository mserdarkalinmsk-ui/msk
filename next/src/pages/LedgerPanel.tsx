import { useMemo, useState } from 'preact/hooks';
import { go } from '../data/store';
import { compareBudget, findErrors, presets, spendBetween, spendByYear, type Finding } from '../domain/ledger';
import { budgetRefs, organisedSheets } from '../domain/organised';
import type { Project } from '../domain/types';
import type { Entry, WorkbookSummary } from '../domain/workbook';
import { TODAY } from '../today';
import { elapsed } from '../domain/calc';
import { DataTable, type Column } from '../ui/DataTable';
import { base, Chart } from '../ui/Chart';
import { axisX, axisY } from './Overview';
import { exportOk } from '../ui/exportGate';
import { date, full, month, short } from '../ui/format';
import { download } from '../ui/xlsxwrite';

const SRC = { invoice: 'Invoice', gl: 'GL' } as const;

/** Dated postings of a system extraction: spending between any two dates, entries to check, and the tidy workbook. */
export function LedgerPanel({ p, wb, mode }: { p: Project; wb: WorkbookSummary; mode: 'range' | 'checks' | 'budget' }) {
  const E = wb.entries ?? [];
  const P = presets(TODAY);
  const [from, setFrom] = useState(P.find((x) => x.key === 'y')!.from), [to, setTo] = useState(P.find((x) => x.key === 'y')!.to);
  const [line, setLine] = useState('');
  const [byYear, setByYear] = useState(false);
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
  const toggle = <div class="seg"><button aria-pressed={!byYear} onClick={() => setByYear(false)}>Date range</button><button aria-pressed={byYear} onClick={() => setByYear(true)}>By year</button></div>;
  if (byYear) return <div class="ledger"><div class="range-bar">{toggle}</div><YearTable p={p} wb={wb} E={E} /></div>;
  return (
    <div class="ledger">
      <div class="range-bar">
        {toggle}
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

const HEADS: Record<string, string> = { '1': 'Human resources', '2': 'Travel', '3': 'Equipment and supplies', '4': 'Local office', '5': 'Other costs, services', '6': 'Other', '8': 'Contingency reserve', '10': 'Administrative costs' };
/** Each line's spending year by year with units, the budget first and the totals last. */
function YearTable({ p, wb, E }: { p: Project; wb: WorkbookSummary; E: Entry[] }) {
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const Y = useMemo(() => spendByYear(E, wb), [E, wb]);
  type L = (typeof Y.lines)[number];
  const asAt = wb.meta.situationDate || wb.meta.asAt || TODAY.toISOString().slice(0, 10);
  const y0 = Math.min(...[...Y.years, ...(p.start ? [p.start.slice(0, 4)] : [])].map(Number)), y1 = Math.max(+asAt.slice(0, 4), ...Y.years.map(Number));
  const years = Number.isFinite(y0) ? Array.from({ length: y1 - y0 + 1 }, (_, i) => String(y0 + i)) : [];
  const yl = (y: string) => (y === asAt.slice(0, 4) && asAt.slice(5) !== '12-31' ? `${y} (to ${date(asAt)})` : p.start && y === p.start.slice(0, 4) && p.start.slice(5) !== '01-01' ? `${y} (from ${date(p.start)})` : y);
  const nf = (v: number | null | undefined) => (v == null || !v ? '' : (Math.round(v * 100) / 100).toLocaleString('en-GB', { maximumFractionDigits: 2 }));
  const m = (v: number | null | undefined) => (v == null || Math.abs(v) < 0.005 ? <span class="yr-nil">—</span> : full(v));
  const heads = [...new Set(Y.lines.map((l) => l.code.split('.')[0]))];
  const sum = (X: L[], f: (l: L) => number) => X.reduce((a, l) => a + f(l), 0);
  const all = Y.lines;
  const [shut, setShut] = useState<string[]>([]);
  const YC = ['#9db4e8', '#5b86e5', '#2c5fd0', '#1b3f99', '#132c6b', '#0b1c45'];
  const ya = (l: L, y: string) => l.years[y]?.amount ?? 0, ysc = (l: L, y: string) => (l.years[y]?.amount ?? 0) + (l.years[y]?.committed ?? 0);
  const NC = 3 + years.length * 4 + 4 + 2; // numeric columns after Line and Description
  const row = (l: L) => { const sc = l.amount + l.committed, left = l.budget.cost - sc, used = l.budget.cost ? sc / l.budget.cost : sc ? 9 : 0, over = left < -0.5; return (
    <tr class={over ? 'yr-over' : ''}><td class="yr-code yr-s1">{l.code}</td><td class="yr-desc yr-s2">{l.description}{l.unit && <small class="yr-sub-u">{l.unit}</small>}{over && (l.budget.cost ? <span class="badge serious">over by {short(-left)}</span> : <span class="badge warning">not in the budget</span>)}</td>
      <td class="num r yr-b">{nf(l.budget.units)}</td><td class="num r yr-b">{l.budget.rate ? full(l.budget.rate) : ''}</td><td class="num r yr-b yr-e"><b>{m(l.budget.cost)}</b></td>
      {years.map((y) => { const v = l.years[y], u = v?.units ?? 0, a = v?.amount ?? 0; return <><td class="num r yr-n">{nf(u)}</td><td class="num r yr-n">{u && a ? full(a / u) : ''}</td><td class="num r">{m(a)}</td><td class="num r yr-e">{m(a + (v?.committed ?? 0))}</td></>; })}
      <td class="num r yr-t">{nf(l.units)}</td><td class="num r yr-t">{l.units && l.amount ? full(l.amount / l.units) : ''}</td><td class="num r yr-t"><b>{m(l.amount)}</b></td><td class="num r yr-t yr-e"><b>{m(sc)}</b></td>
      <td class={`num r ${over ? 'neg' : ''}`}>{full(left)}</td>
      <td class="yr-used"><div class="yr-bar"><span style={{ width: `${Math.min(100, used * 100)}%`, background: used > 1 ? 'var(--critical)' : used >= .9 ? 'var(--warn)' : 'var(--c1)' }} /></div><b class={used > 1 ? 'neg' : ''}>{l.budget.cost ? `${Math.round(used * 100)}%` : '—'}</b></td></tr>); };
  const totRow = (label: string, cls: string, b: number, yA: (y: string) => number, yS: (y: string) => number, a: number, sc: number) => (
    <tr class={cls}><td class="yr-s1" /><td class="yr-s2">{label}</td><td class="yr-b" /><td class="yr-b" /><td class="num r yr-b yr-e">{full(b)}</td>
      {years.map((y) => <><td /><td /><td class="num r">{full(yA(y))}</td><td class="num r yr-e">{full(yS(y))}</td></>)}
      <td class="yr-t" /><td class="yr-t" /><td class="num r yr-t">{full(a)}</td><td class="num r yr-t yr-e">{full(sc)}</td>
      <td class={`num r ${b - sc < -0.5 ? 'neg' : ''}`}>{full(b - sc)}</td><td class="yr-used">{b ? <><div class="yr-bar"><span style={{ width: `${Math.min(100, (sc / b) * 100)}%`, background: sc > b ? 'var(--critical)' : 'var(--c1)' }} /></div><b>{Math.round((sc / b) * 100)}%</b></> : ''}</td></tr>);
  const tot = (X: L[], label: string, cls: string) => totRow(label, cls, sum(X, (l) => l.budget.cost), (y) => sum(X, (l) => ya(l, y)), (y) => sum(X, (l) => ysc(l, y)), sum(X, (l) => l.amount), sum(X, (l) => l.amount + l.committed));
  const db = sum(all, (l) => l.budget.cost), da = sum(all, (l) => l.amount), ds = sum(all, (l) => l.amount + l.committed), ab = wb.totals.admin?.budget || r2(db * 0.07);
  const adm = (v: number) => r2(v * 0.07);
  const xlsx = () => {
    const H = (v: string) => ({ v, st: 'head' as const }), col = (i: number) => { let s = '', n = i; do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0); return s; };
    const h1 = [H('Line'), H('Description'), H('Unit'), H('Approved budget'), H(''), H(''), ...years.flatMap((y) => [H(yl(y)), H(''), H(''), H('')]), H('Total'), H(''), H(''), H(''), H('Remaining'), H('% used')];
    const sub = ['# units', 'Unit rate', 'Spent', 'Spent + committed'].map(H);
    const h2 = [H(''), H(''), H(''), H('# units'), H('Unit rate'), H('Total'), ...years.flatMap(() => sub), ...sub, H('Budget − S&C'), H('')];
    const merges = ['D1:F1', ...years.map((_, i) => `${col(6 + i * 4)}1:${col(9 + i * 4)}1`), `${col(6 + years.length * 4)}1:${col(9 + years.length * 4)}1`];
    const line = (l: L) => [l.code, l.description, l.unit, l.budget.units ?? '', l.budget.rate ?? '', l.budget.cost, ...years.flatMap((y) => { const v = l.years[y], u = v?.units ?? 0, a = v?.amount ?? 0; return [u || '', u && a ? r2(a / u) : '', a, r2(a + (v?.committed ?? 0))]; }), l.units || '', l.units && l.amount ? r2(l.amount / l.units) : '', l.amount, r2(l.amount + l.committed), r2(l.budget.cost - l.amount - l.committed), l.budget.cost ? (l.amount + l.committed) / l.budget.cost : ''];
    const t = (label: string, b: number, yA: (y: string) => number, yS: (y: string) => number, a: number, sc: number) => [{ v: label, st: 'bold' as const }, '', '', '', '', r2(b), ...years.flatMap((y) => ['', '', r2(yA(y)), r2(yS(y))]), '', '', r2(a), r2(sc), r2(b - sc), b ? sc / b : ''];
    const rows: unknown[][] = [h1, h2];
    for (const h of heads) { const X = all.filter((l) => l.code.split('.')[0] === h); rows.push([{ v: `${h}. ${HEADS[h] ?? 'Other lines'}`, st: 'bold' }]); for (const l of X) rows.push(line(l));
      rows.push(t(`Sub-total ${h}`, sum(X, (l) => l.budget.cost), (y) => sum(X, (l) => ya(l, y)), (y) => sum(X, (l) => ysc(l, y)), sum(X, (l) => l.amount), sum(X, (l) => l.amount + l.committed))); }
    rows.push(t('Total direct costs', db, (y) => sum(all, (l) => ya(l, y)), (y) => sum(all, (l) => ysc(l, y)), da, ds));
    rows.push(t('10. Administrative costs (7% of direct costs)', ab, (y) => adm(sum(all, (l) => ya(l, y))), (y) => adm(sum(all, (l) => ysc(l, y))), adm(da), adm(ds)));
    rows.push(t('Total eligible costs', db + ab, (y) => r2(sum(all, (l) => ya(l, y)) * 1.07), (y) => r2(sum(all, (l) => ysc(l, y)) * 1.07), r2(da * 1.07), r2(ds * 1.07)));
    const nY = years.length, moneyCols = [4, 5, ...years.flatMap((_, i) => [7 + i * 4, 8 + i * 4, 9 + i * 4]), 7 + nY * 4, 8 + nY * 4, 9 + nY * 4, 10 + nY * 4];
    download(`${p.bh ?? p.code}-spending-by-year-${asAt}.xlsx`, [{ name: 'By year', rows: rows as never, freeze: 2, merges, money: moneyCols, widths: [9, 44, 13, 9, 11, 14, ...years.flatMap(() => [8, 11, 14, 15]), 8, 11, 14, 15, 14, 8] }]);
  };
  return (
    <>
      <div class="range-sum"><div><span>Budget (incl. 7%)</span><b class="num">{full(db + ab)}</b></div>{years.map((y) => <div><span>{yl(y)} · spent</span><b class="num">{full(r2(sum(all, (l) => ya(l, y)) * 1.07))}</b></div>)}<div><span>Total spent (incl. 7%)</span><b class="num">{full(r2(da * 1.07))}</b></div><div><span>Spent + committed (incl. 7%)</span><b class="num">{full(r2(ds * 1.07))}</b></div><span class="grow" style={{ flex: 1 }} /><button class="btn primary" onClick={xlsx}>⬇ Excel</button></div>
      <Chart height={260} label="Spending by year and heading" option={(t) => ({
        ...base(t), grid: { left: 8, right: 16, top: 34, bottom: 8, containLabel: true },
        legend: { top: 0, left: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: t.ink2, fontSize: 11 } },
        tooltip: { ...(base(t).tooltip as object), trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v: number) => full(v) },
        xAxis: { type: 'category', data: years.map(yl), ...axisX(t) }, yAxis: [{ type: 'value', ...axisY(t) }, { type: 'value', ...axisY(t), splitLine: { show: false } }],
        series: [
          ...heads.map((h, i) => ({ name: `${h}. ${HEADS[h] ?? 'Other lines'}`, type: 'bar', stack: 'y', barMaxWidth: 64, itemStyle: { color: t.c[i % t.c.length], borderRadius: 0 }, emphasis: { focus: 'series' }, data: years.map((y) => r2(sum(all.filter((l) => l.code.split('.')[0] === h), (l) => ya(l, y)))) })),
          { name: 'Cumulative spent', type: 'line', yAxisIndex: 1, symbolSize: 7, lineStyle: { width: 2.5, color: t.ink }, itemStyle: { color: t.ink }, data: years.map((_, i) => r2(years.slice(0, i + 1).reduce((a, y) => a + sum(all, (l) => ya(l, y)), 0))),
            markLine: db ? { symbol: 'none', lineStyle: { color: t.critical, type: 'dashed' }, label: { formatter: 'Direct budget', color: t.critical, fontSize: 11, position: 'insideEndTop' }, data: [{ yAxis: db }] } : undefined },
        ],
      })} />
      <div class="yr-cards">{heads.map((h) => { const X = all.filter((l) => l.code.split('.')[0] === h), b = sum(X, (l) => l.budget.cost), a = sum(X, (l) => l.amount), sc = sum(X, (l) => l.amount + l.committed), over = sc > b + 0.5;
        return <button class={`yr-card ${over ? 'over' : ''}`} onClick={() => setShut(heads.filter((x) => x !== h))} title="Show only this heading">
          <span class="t">{h}. {HEADS[h] ?? 'Other lines'}</span><b>{b ? `${Math.round((sc / b) * 100)}%` : 'no budget'}</b><small>{short(a)} spent · {short(sc)} with commitments · of {short(b)}</small>
          <div class="yr-stack">{years.map((y, i) => { const v = sum(X, (l) => ya(l, y)); return v > 0 ? <span title={`${yl(y)}: ${full(v)}`} style={{ width: `${(v / Math.max(sc, b, 1)) * 100}%`, background: YC[Math.min(i, YC.length - 1)] }} /> : null; })}{sc - a > 0.5 ? <span title={`Committed: ${full(sc - a)}`} style={{ width: `${((sc - a) / Math.max(sc, b, 1)) * 100}%`, background: 'repeating-linear-gradient(45deg,#9db4e8,#9db4e8 3px,transparent 3px,transparent 6px)' }} /> : null}</div></button>; })}
        <div class="yr-legend">{years.map((y, i) => <span><i style={{ background: YC[Math.min(i, YC.length - 1)] }} />{y}</span>)}<span><i style={{ background: 'repeating-linear-gradient(45deg,#9db4e8,#9db4e8 3px,transparent 3px,transparent 6px)' }} />committed</span>{shut.length ? <button class="btn ghost" onClick={() => setShut([])}>Show all headings</button> : null}</div></div>
      <div class="table-wrap yr-wrap"><table class="yr-table yr-x">
        <thead>
          <tr class="yr-g"><th rowSpan={2} class="yr-s1">Line</th><th rowSpan={2} class="yr-s2">Description</th><th colSpan={3} class="c yr-b yr-e">Approved budget</th>{years.map((y) => <th colSpan={4} class="c yr-e">{yl(y)}</th>)}<th colSpan={4} class="c yr-t yr-e">Total</th><th rowSpan={2} class="r">Remaining<small>budget − S&C</small></th><th rowSpan={2}>Used</th></tr>
          <tr class="yr-g2"><th class="r yr-b">Units</th><th class="r yr-b">Unit rate</th><th class="r yr-b yr-e">Total</th>{years.map(() => <><th class="r">Units</th><th class="r">Unit rate</th><th class="r">Spent</th><th class="r yr-e">Spent + comm.</th></>)}<th class="r yr-t">Units</th><th class="r yr-t">Unit rate</th><th class="r yr-t">Spent</th><th class="r yr-t yr-e">Spent + comm.</th></tr>
        </thead>
        <tbody>{heads.map((h) => { const X = all.filter((l) => l.code.split('.')[0] === h); return <><tr class="yr-h" onClick={() => setShut(shut.includes(h) ? shut.filter((x) => x !== h) : [...shut, h])} style={{ cursor: 'pointer' }}><td colSpan={2} class="yr-s1"><span class="yr-tw">{shut.includes(h) ? '▸' : '▾'}</span>{h}. {HEADS[h] ?? 'Other lines'} <span class="yr-hn">{X.length} line{X.length > 1 ? 's' : ''}</span></td><td colSpan={NC} /></tr>{shut.includes(h) ? null : X.map(row)}{tot(X, `Sub-total ${h}. ${HEADS[h] ?? 'Other lines'}`, 'yr-subt')}</>; })}</tbody>
        <tfoot>{tot(all, 'Total direct costs', 'yr-subt')}
          {totRow('10. Administrative costs (7% of direct costs)', 'yr-adm', ab, (y) => adm(sum(all, (l) => ya(l, y))), (y) => adm(sum(all, (l) => ysc(l, y))), adm(da), adm(ds))}
          {totRow('Total eligible costs', 'yr-tot', db + ab, (y) => r2(sum(all, (l) => ya(l, y)) * 1.07), (y) => r2(sum(all, (l) => ysc(l, y)) * 1.07), r2(da * 1.07), r2(ds * 1.07))}</tfoot></table></div>
      <p class="muted" style={{ fontSize: '12px' }}>Spent: invoices and GL entries by posting date. Spent + committed: spent in the year plus what is still open on the purchase orders raised in that year. Units: months paid on staff POs, the spent share of the ordered units on other POs (so they can be fractional), the units of GL entries. Unit rate = spent ÷ units. Remaining and % used compare the budget with spent + committed.</p>
    </>);
}
