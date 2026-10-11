import { useState } from 'preact/hooks';
import { set } from '../data/store';
import { elapsed } from '../domain/calc';
import type { Project } from '../domain/types';
import type { WbLine, WorkbookSummary } from '../domain/workbook';
import { TODAY } from '../today';
import { base, Chart, type Tokens } from '../ui/Chart';
import { DataTable, type Column } from '../ui/DataTable';
import { date, full, month, pct, short } from '../ui/format';
import { axisMoney, axisX, axisY } from './Overview';
import { Statement } from '../ui/Statement';

const HEADINGS: Record<string, string> = { '1': 'Human resources', '2': 'Travel', '3': 'Equipment & supplies', '4': 'Local office', '5': 'Other costs, services', '6': 'Other' };

export function latestWorkbook(p: Project) {
  const R = [...(p.reportingPeriods ?? [])].filter((r) => r.snapshot?.workbook).sort((a, b) => a.date.localeCompare(b.date));
  return R.at(-1);
}

export function FinancialReport({ p }: { p: Project }) {
  const rep = latestWorkbook(p);
  const [view, setView] = useState<'lines' | 'rates' | 'pos'>('lines');
  if (!rep) return (
    <div class="card empty-page"><div><h2>No financial report workbook yet</h2>
      <p>Import the Council of Europe report workbook (REPORT / Forecast / Purchase Orders / Situation Budgétaire…) and everything in it is analysed here.</p>
      <button class="btn primary" onClick={() => set({ drawer: { kind: 'report', projectId: p.id } })}>Import workbook</button></div></div>
  );
  const wb = rep.snapshot!.workbook!, m = wb.meta, E = wb.totals.eligible;
  const leaf = wb.lines.filter((l) => l.leaf);
  const heads = Object.keys(HEADINGS).map((h) => {
    const L = leaf.filter((l) => l.code.split('.')[0] === h);
    const s = (f: (l: WbLine) => number | null | undefined) => L.reduce((a, l) => a + (f(l) ?? 0), 0);
    return { h, name: HEADINGS[h], budget: s((l) => l.budget.cost), actual: s((l) => l.actual.cost), sc: s((l) => l.sc), planned: s((l) => l.planned?.cost), proposal: s((l) => l.rounded?.cost ?? l.proposal?.cost) };
  }).filter((x) => x.budget || x.actual || x.planned);
  const openPO = wb.pos.filter((x) => /open/i.test(x.status) && x.balance > 0.5).sort((a, b) => b.balance - a.balance);
  const funding = wb.movements.filter((x) => x.funding);
  const received = funding.reduce((s, x) => s + x.amount, 0);
  const el = elapsed(p, TODAY);
  const warn = wb.checks.filter((c) => c.level !== 'info');
  const after = E ? E.actual + (E.sc - E.actual) + (E.planned ?? 0) : 0;
  return (
    <>
      <div class="wb-strip">
        <div><span>Contract</span><b class="num">{m.contract ?? '—'}</b></div>
        <div><span>JP / BH</span><b class="num">{m.jp ?? '—'} / {m.bh ?? '—'}</b></div>
        <div><span>Report period</span><b>{m.periodFrom ? `${date(m.periodFrom)} → ${date(m.periodTo!)}` : '—'}</b></div>
        <div><span>Actuals as at</span><b>{m.asAt ? date(m.asAt) : date(rep.date)}</b></div>
        <div><span>Source</span><b title={wb.sheets.join(', ')}>{wb.fileName ?? rep.fileName ?? '—'}</b></div>
        <button class="btn" onClick={() => set({ drawer: { kind: 'report', projectId: p.id } })}>Import newer workbook</button>
      </div>

      {E && (
        <section class="hero" aria-label="Report totals">
          <div class="kpi lead">
            <span class="label">Total eligible costs — actual</span><span class="value">{short(E.actual)}</span>
            <span class="ctx"><b>{pct(E.budget ? E.actual / E.budget : 0)}</b> of {full(E.budget)} · {pct(el)} of time used</span>
            <div class="meter">
              <span style={{ width: `${Math.min(100, (E.actual / E.budget) * 100)}%`, background: 'var(--c1)' }} />
              <span style={{ left: `${Math.min(100, (E.actual / E.budget) * 100)}%`, width: `${Math.min(100, ((E.sc - E.actual) / E.budget) * 100)}%`, background: 'var(--c1)', opacity: .35 }} />
              {E.planned != null && <span style={{ left: `${Math.min(100, (E.sc / E.budget) * 100)}%`, width: `${Math.min(100 - (E.sc / E.budget) * 100, (E.planned / E.budget) * 100)}%`, background: 'var(--c2)', opacity: .5 }} />}
              <i class="tick" style={{ left: `calc(${el * 100}% - 1px)` }} />
            </div>
            <span class="ctx" style={{ fontSize: '11.5px' }}>spent · committed{E.planned != null && ' · planned next 12 months'} │ time</span>
          </div>
          <div class="kpi"><span class="label">Spent + committed</span><span class="value">{short(E.sc)}</span><span class="ctx">{short(E.sc - E.actual)} committed, not yet spent</span></div>
          <div class="kpi"><span class="label">Planned next 12 months</span><span class="value">{E.planned != null ? short(E.planned) : '—'}</span>
            <span class="ctx">{m.plannedFrom ? `${month(m.plannedFrom)} → ${month(m.plannedTo!)}` : 'no forecast in file'} · reaches {pct(E.budget ? after / E.budget : 0)}</span></div>
          <div class="kpi"><span class="label">Budget proposal (projected total need)</span><span class="value">{E.rounded != null ? short(E.rounded) : E.proposal != null ? short(E.proposal) : '—'}</span>
            <span class="ctx">{E.rounded != null || E.proposal != null ? (() => { const d = (E.rounded ?? E.proposal!) - E.budget; return d < 0 ? <><b>{short(-d)}</b> of the {short(E.budget)} budget would stay unused</> : <><b>{short(d)}</b> more than the {short(E.budget)} budget</>; })() : 'not in file'}</span></div>
        </section>
      )}

      <div class="grid g-12">
        <section class="card span-7">
          <div class="card-h"><div><h2>Budget, use and plan by heading</h2><p>Spent, committed and planned for the next 12 months against each heading's budget</p></div></div>
          <div class="card-b">
            <div class="legend" style={{ marginBottom: '4px' }}><span><i style={{ background: 'var(--c1)' }} />Spent</span><span><i style={{ background: 'var(--c1)', opacity: .4 }} />Committed</span><span><i style={{ background: 'var(--c2)' }} />Planned 12 m</span><span><i style={{ background: 'var(--surface-2)', border: '1px solid var(--line-strong)' }} />Budget</span></div>
            <Chart height={Math.max(220, heads.length * 52 + 40)} label="Budget by heading" option={(t) => headingOption(t, heads)} />
          </div>
        </section>
        <section class="card span-5">
          <div class="card-h"><div><h2>Checks</h2><p>{warn.length ? `${warn.length} items to review` : 'Everything reconciles'} · computed from the workbook</p></div></div>
          <ul class="att" style={{ marginTop: '12px', maxHeight: '340px', overflow: 'auto' }}>
            {[...wb.checks].sort((a, b) => Number(a.level === 'info') - Number(b.level === 'info')).map((c) => (
              <li style={{ cursor: 'default' }}><span class={`badge ${c.level === 'error' ? 'critical' : c.level === 'warning' ? 'warning' : 'good'}`}>{c.level === 'info' ? 'ok' : c.level}</span><div class="d" style={{ color: 'var(--ink)', whiteSpace: 'normal' }}>{c.text}</div><span /></li>
            ))}
          </ul>
        </section>

        {wb.monthly.length > 0 && (
          <section class="card span-7">
            <div class="card-h"><div><h2>Monthly postings</h2><p>Invoices on purchase orders and direct GL postings by accounting month, with the running total</p></div></div>
            <div class="card-b"><Chart height={280} label="Monthly postings" option={(t) => monthlyOption(t, wb)} /></div>
          </section>
        )}
        {(funding.length > 0 || wb.situation.length > 0) && (
          <section class="card span-5">
            <div class="card-h"><div><h2>Funding & accounts</h2><p>Contributions received and the budget situation in the accounting system{m.situationDate ? ` (${date(m.situationDate)})` : ''}</p></div></div>
            <div class="card-b" style={{ display: 'grid', gap: '14px' }}>
              {funding.length > 0 && (
                <div class="fa-fund">
                  <div class="fa-total"><span>Net received</span><b class="num">{full(received)}</b><small>{funding.filter((x) => x.amount > 0).length} receipts · {funding.filter((x) => x.amount < 0).length} reversals</small></div>
                  <ul class="fa-flow">{funding.map((x) => <li class={x.amount < 0 ? 'neg' : ''} title={x.description}><span class="num">{month(x.date)}</span><span>{fundLabel(x.description)}</span><b class="num">{x.amount < 0 ? '−' : '+'}{short(Math.abs(x.amount))}</b></li>)}</ul>
                </div>
              )}
              {wb.situation.length > 0 && (
                <div class="fa-acc">
                  <div class="fa-legend"><span><i style={{ background: 'var(--c1)' }} />Actual</span><span><i style={{ background: 'var(--c1)', opacity: .4 }} />PO</span><span><i style={{ background: 'var(--line)' }} />Available</span></div>
                  {wb.situation.map((r) => { const B = r.budget || 1; return (
                    <div class="fa-row" title={r.description}>
                      <div class="fa-h"><span class="num">{r.ccm}/{+r.article}</span><span class="muted">{r.description.replace(/\s+/g, ' ')}</span><b class="num">{short(r.budget)}</b></div>
                      <div class="fa-bar"><span style={{ width: `${Math.min(100, r.actual / B * 100)}%` }} /><span style={{ width: `${Math.min(100, r.po / B * 100)}%`, opacity: .4 }} /></div>
                      <div class="fa-f num"><span>{short(r.actual)} actual</span>{r.po ? <span>{short(r.po)} PO</span> : null}<span style={{ marginLeft: 'auto', color: r.available < 0 ? 'var(--critical)' : undefined }}>{short(r.available)} left · {Math.round((r.actual + r.po) / B * 100)}% used</span></div>
                    </div>); })}
                </div>
              )}
            </div>
          </section>
        )}

        <section class="card span-12" style={{ overflow: 'hidden' }}>
          <div class="card-h" style={{ paddingBottom: '12px', alignItems: 'center' }}>
            <div><h2>{view === 'lines' ? 'Financial statement' : view === 'rates' ? 'Units and unit rates' : `Open purchase orders · ${short(openPO.reduce((s, x) => s + x.balance, 0))}`}</h2>
              <p>{view === 'lines' ? 'In the layout of the official report — click a heading to collapse it' : view === 'rates' ? 'Consumption of budgeted units against time, and actual vs budgeted unit rates' : 'Commitments still open, largest balance first'}</p></div>
            <div class="tools"><div class="seg">
              <button aria-pressed={view === 'lines'} onClick={() => setView('lines')}>Statement</button>
              <button aria-pressed={view === 'rates'} onClick={() => setView('rates')}>Units & rates</button>
              <button aria-pressed={view === 'pos'} onClick={() => setView('pos')}>Open POs ({openPO.length})</button>
            </div></div>
          </div>
          {view === 'lines' && <Statement lines={wb.lines} totals={wb.totals} elapsed={el} title={`${p.code}-financial-statement`} />}
          {view === 'rates' && <RatesTable lines={leaf.filter((l) => l.budget.units)} el={el} />}
          {view === 'pos' && <POTable rows={openPO} />}
        </section>
      </div>
    </>
  );
}

const v = (x: number | null | undefined) => x ?? 0;
function RatesTable({ lines, el }: { lines: WbLine[]; el: number }) {
  const cols: Column<WbLine>[] = [
    { key: 'code', label: 'Line', width: 76, pin: true, value: (l) => l.code, render: (l) => <span class="num">{l.code}</span> },
    { key: 'd', label: 'Description', width: 220, value: (l) => l.description },
    { key: 'unit', label: 'Unit', width: 120, value: (l) => l.unit },
    { key: 'bu', label: 'Units budgeted', width: 110, align: 'r', value: (l) => l.budget.units },
    { key: 'au', label: 'Units used', width: 96, align: 'r', value: (l) => l.actual.units },
    { key: 'uu', label: 'Units used vs time', width: 170, value: (l) => v(l.actual.units) / v(l.budget.units), render: (l) => { const u = v(l.actual.units) / v(l.budget.units); return <div class="bar-cell"><div class="minibar"><span style={{ width: `${Math.min(100, u * 100)}%` }} /><i style={{ left: `${el * 100}%` }} /></div><span class="num" style={{ fontSize: '12px' }}>{pct(u)}</span></div>; } },
    { key: 'br', label: 'Budget rate', width: 110, align: 'r', format: full, value: (l) => l.budget.rate },
    { key: 'ar', label: 'Actual rate', width: 110, align: 'r', format: full, value: (l) => l.actual.rate },
    { key: 'rd', label: 'Rate difference', width: 130, align: 'r', value: (l) => (l.budget.rate && l.actual.rate ? l.actual.rate / l.budget.rate - 1 : null), render: (l) => { if (!l.budget.rate || !l.actual.rate) return '—'; const d = l.actual.rate / l.budget.rate - 1; return <span class={`badge ${d > 0.15 ? 'serious' : d > 0.05 ? 'warning' : 'good'}`}>{d > 0 ? '+' : '−'}{Math.abs(Math.round(d * 100))}%</span>; } },
  ];
  return <DataTable rows={lines} columns={cols} rowKey={(l) => l.code} title="unit-rates" storageKey="pl-cols-rates" maxHeight={520} />;
}

function POTable({ rows }: { rows: WorkbookSummary['pos'] }) {
  const cols: Column<WorkbookSummary['pos'][number]>[] = [
    { key: 'po', label: 'PO', width: 90, pin: true, value: (x) => x.po, render: (x) => <span class="num">{x.po}</span> },
    { key: 'line', label: 'Line', width: 70, value: (x) => x.line, render: (x) => <span class="num muted">{x.line}</span> },
    { key: 'd', label: 'Description', width: 300, value: (x) => x.description },
    { key: 'n', label: 'Nature', width: 170, value: (x) => x.nature },
    { key: 'a', label: 'PO amount', width: 110, align: 'r', sum: true, format: full, value: (x) => x.amount },
    { key: 's', label: 'Spent', width: 110, align: 'r', sum: true, format: full, value: (x) => x.spent },
    { key: 'b', label: 'Open balance', width: 120, align: 'r', sum: true, format: full, value: (x) => x.balance },
    { key: 'dt', label: 'Raised', width: 100, value: (x) => x.date, render: (x) => (x.date ? date(x.date) : '—') },
  ];
  return <DataTable rows={rows} columns={cols} rowKey={(x) => x.po + x.line + x.description} title="open-pos" storageKey="pl-cols-pos" maxHeight={520} groupBy={[{ label: 'nature', key: (x) => x.nature }, { label: 'line', key: (x) => x.line }]} />;
}

function headingOption(t: Tokens, H: { name: string; budget: number; actual: number; sc: number; planned: number }[]) {
  return {
    ...base(t),
    grid: { left: 8, right: 56, top: 8, bottom: 8, containLabel: true },
    tooltip: { ...(base(t).tooltip as object), trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (ps: any[]) => { const h = H[ps[0].dataIndex]; return `<b>${h.name}</b><br/>Budget ${full(h.budget)}<br/>Spent ${full(h.actual)} · committed ${full(h.sc - h.actual)}<br/>Planned 12 m ${full(h.planned)}<br/>After plan: <b>${pct(h.budget ? (h.sc + h.planned) / h.budget : 0)}</b> of budget`; } },
    xAxis: { type: 'value', ...axisY(t), axisLabel: { ...axisY(t).axisLabel, formatter: axisMoney } },
    yAxis: { type: 'category', inverse: true, data: H.map((h) => h.name), ...axisX(t), axisLabel: { color: t.ink2, fontSize: 12 } },
    series: [
      { name: 'Budget', type: 'bar', barWidth: 24, barGap: '-100%', z: 1, data: H.map((h) => h.budget), itemStyle: { color: t.surface2, borderColor: t.ink3, borderWidth: 0.5, borderRadius: 5 },
        label: { show: true, position: 'right', color: t.ink2, fontFamily: t.mono, fontSize: 11, formatter: (x: any) => pct(H[x.dataIndex].budget ? (H[x.dataIndex].sc + H[x.dataIndex].planned) / H[x.dataIndex].budget : 0) } },
      { name: 'Spent', type: 'bar', stack: 'u', barWidth: 12, z: 2, data: H.map((h) => h.actual), itemStyle: { color: t.c[0], borderRadius: [3, 0, 0, 3] } },
      { name: 'Committed', type: 'bar', stack: 'u', barWidth: 12, z: 2, data: H.map((h) => Math.max(0, h.sc - h.actual)), itemStyle: { color: t.c[0], opacity: 0.4 } },
      { name: 'Planned', type: 'bar', stack: 'u', barWidth: 12, z: 2, data: H.map((h) => h.planned), itemStyle: { color: t.c[1], borderRadius: [0, 3, 3, 0] } },
    ],
  };
}

function monthlyOption(t: Tokens, wb: WorkbookSummary) {
  let run = 0;
  const M = wb.monthly.map((x) => ({ ...x, t: Date.parse(x.month + '-15'), total: x.invoices + x.gl, cum: (run += x.invoices + x.gl) }));
  return {
    ...base(t),
    grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
    tooltip: { ...(base(t).tooltip as object), trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (ps: any[]) => { const x = M[ps[0].dataIndex]; return `<b>${month(x.t)}</b><br/>Invoices ${full(x.invoices)}<br/>GL postings ${full(x.gl)}<br/>Month <b>${full(x.total)}</b> · running ${full(x.cum)}`; } },
    xAxis: { type: 'category', data: M.map((x) => month(x.t)), ...axisX(t), axisLabel: { ...axisX(t).axisLabel, interval: 'auto' } },
    yAxis: { type: 'value', ...axisY(t), axisLabel: { ...axisY(t).axisLabel, formatter: axisMoney } },
    series: [
      { name: 'Invoices', type: 'bar', stack: 'm', data: M.map((x) => x.invoices), itemStyle: { color: t.c[0] }, barWidth: '60%' },
      { name: 'GL', type: 'bar', stack: 'm', data: M.map((x) => x.gl), itemStyle: { color: t.c[2], borderRadius: [3, 3, 0, 0] } },
    ],
  };
}

/** Accounting descriptions are long bank strings; keep what they mean. */
function fundLabel(d: string) {
  const t = d.replace(/\s+/g, ' '), tr = t.match(/(\d+)\s*(?:è|e)re\s+tranche/i);
  const kind = /annul/i.test(t) ? 'Reversal of advance' : /avance/i.test(t) ? 'Advance payment' : 'EU contribution';
  return tr ? `${kind} · tranche ${tr[1]}` : kind;
}
