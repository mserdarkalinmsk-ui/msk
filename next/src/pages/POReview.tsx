import { useMemo, useState } from 'preact/hooks';
import { set } from '../data/store';
import { byPeriodThenImport } from '../domain/calc';
import { enrichExtraction } from '../domain/extraction';
import { PO_GROUP, PO_KIND, poReview, type PoFinding, type PoGroup, type PoReport, type PoReview } from '../domain/poReview';
import type { Project } from '../domain/types';
import type { WorkbookSummary } from '../domain/workbook';
import { DataTable, type Column } from '../ui/DataTable';
import { date, full } from '../ui/format';
import { download } from '../ui/xlsxwrite';

/** The report workbooks of a project, oldest first, extractions completed from the approved budget. */
export function poReports(p: Project): PoReport[] {
  return [...(p.reportingPeriods ?? [])].filter((r) => r.snapshot?.workbook?.pos?.length).sort(byPeriodThenImport).map((r) => {
    const w0 = r.snapshot!.workbook as WorkbookSummary, wb = w0.meta.extraction ? enrichExtraction(w0, p) : w0;
    const d = wb.meta.situationDate || wb.meta.asAt || r.date;
    return { date: d, label: r.name || (d ? date(d) : 'report'), wb };
  });
}
const cache = new WeakMap<Project, { rp: unknown; ab: unknown; R: PoReview }>();
/** The review of a project, kept until its reports or approved budget change. */
export function reviewOf(p: Project): PoReview {
  const c = cache.get(p);
  if (c && c.rp === p.reportingPeriods && c.ab === p.approvedBudget) return c.R;
  const R = poReview(poReports(p), (p.approvedBudget?.lines ?? []).map((l) => ({ code: l.code, unit: l.unit, description: l.description }))); cache.set(p, { rp: p.reportingPeriods, ab: p.approvedBudget, R }); return R;
}
/** Findings worth a look (not the notes): the count on the tab. */
export const poToCheck = (p: Project) => reviewOf(p).findings.filter((f) => f.level !== 'info').length;

const TONE = { bad: ['critical', 'Check'], warn: ['warning', 'Look'], info: ['neutral', 'Note'] } as const;

export function POReview({ p }: { p: Project }) {
  const R = reviewOf(p);
  const [g, setG] = useState<'all' | PoGroup>('all');
  const [minor, setMinor] = useState(false);
  const [open, setOpen] = useState<string>('');
  const F = useMemo(() => R.findings.filter((f) => (g === 'all' || f.group === g) && (minor || f.level !== 'info')), [R, g, minor]);
  if (!R.latest) return (
    <div class="card empty-page"><div><h2>No purchase orders to review yet</h2>
      <p>Import a report workbook or a system extraction with its “Purchase Orders” sheet. Each new report is then checked order by order and compared with the one before.</p>
      <button class="btn primary" onClick={() => set({ drawer: { kind: 'report', projectId: p.id } })}>Import a report</button></div></div>);
  const n = (x: PoGroup, lv?: PoFinding['level']) => R.findings.filter((f) => f.group === x && (lv ? f.level === lv : f.level !== 'info')).length;
  const minorN = R.findings.filter((f) => f.level === 'info' && (g === 'all' || f.group === g)).length;
  const cols: Column<PoFinding>[] = [
    { key: 'lv', label: 'Level', width: 76, value: (f) => ({ bad: 0, warn: 1, info: 2 })[f.level], render: (f) => <span class={`badge ${TONE[f.level][0]}`}>{TONE[f.level][1]}</span> },
    { key: 'k', label: 'Finding', width: 210, value: (f) => PO_KIND[f.kind].label },
    { key: 'po', label: 'PO', width: 90, value: (f) => f.po, render: (f) => <span class="num">{f.po}</span> },
    { key: 'line', label: 'Line', width: 74, value: (f) => f.line, render: (f) => <span class="num muted">{f.line}</span> },
    { key: 'f', label: 'Probably should be', width: 150, value: (f) => f.fix ?? '', render: (f) => f.fix ? <b>{f.fix}</b> : <span class="muted">—</span> },
    { key: 't', label: 'What the report shows', width: 540, value: (f) => f.text },
    { key: 'd', label: 'Description', width: 260, value: (f) => f.description },
    { key: 's', label: 'Supplier', width: 200, value: (f) => f.supplier },
    { key: 'a', label: 'Amount', width: 120, align: 'r', format: full, value: (f) => f.amount },
  ];
  const xlsx = () => download(`${p.bh ?? p.code}-po-review-${R.latest!.date}.xlsx`, [
    { name: 'PO review', money: [7], rows: [['Level', 'Group', 'Finding', 'PO', 'Line', 'Supplier', 'Description', 'Amount', 'What the report shows', 'Probably should be'], ...R.findings.map((f) => [TONE[f.level][1], PO_GROUP[f.group], PO_KIND[f.kind].label, f.po, f.line, f.supplier, f.description, f.amount, f.text, f.fix ?? ''])] }]);
  const H = open ? R.history(open) : [];
  return (
    <div class="po-review">
      <section class="card">
        <div class="card-h"><div><h2>PO review</h2>
          <p>{R.pos} purchase orders in {R.latest.label}, each checked against its budget line{R.previous ? <>; every report compared with the one before, back to the first of {R.reports}</> : ' — load the next report to see what changed'}. Click a row for the order's history in every report.</p></div>
          <div class="tools"><button class="btn" onClick={xlsx}>⬇ Excel</button></div></div>
        <div class="wp-kpi">
          {(['line', 'unit', 'amount', 'change'] as const).map((x) => (
            <button class={`k click${g === x ? ' on' : ''}`} aria-pressed={g === x} onClick={() => setG(g === x ? 'all' : x)}>
              <span>{PO_GROUP[x]}</span><b>{n(x)}</b><em class="muted">{n(x, 'bad') ? `${n(x, 'bad')} to check · ` : ''}{n(x, 'info')} notes</em></button>))}
          <div class="k"><span>Reports followed</span><b>{R.reports}</b><em class="muted">{R.previous ? `latest: ${R.latest.label}` : 'one report so far'}</em></div>
        </div>
        <div class="tools" style={{ padding: '0 20px 10px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div class="seg" role="group" aria-label="Show">{(['all', 'line', 'unit', 'amount', 'change'] as const).map((x) => <button aria-pressed={g === x} onClick={() => setG(x)}>{x === 'all' ? 'All' : PO_GROUP[x]}</button>)}</div>
          <label class="chk"><input type="checkbox" checked={minor} onChange={(e) => setMinor((e.target as HTMLInputElement).checked)} /> Include notes ({minorN})</label>
        </div>
        {F.length ? <DataTable rows={F} columns={cols} rowKey={(f) => `${f.kind}|${f.po}|${f.line}|${f.text}`} onOpen={(f) => setOpen(f.po === open ? '' : f.po)} title={`${p.bh ?? p.code}-po-review`} storageKey="pl-cols-poreview" maxHeight={560}
          groupBy={[{ label: 'finding', key: (f) => PO_KIND[f.kind].label }, { label: 'line', key: (f) => f.line }, { label: 'supplier', key: (f) => f.supplier }]} />
          : <p class="muted" style={{ padding: '4px 20px 20px' }}>{R.findings.length ? 'Nothing here at this level. Tick “Include notes” to see the minor ones.' : 'No finding: every order agrees with its budget line and with the previous report.'}</p>}
      </section>
      {open && <section class="card" style={{ marginTop: '16px' }}>
        <div class="card-h"><div><h2>PO {open} in every report</h2><p>Figures as each report gives them; a changed figure is marked.</p></div><div class="tools"><button class="btn ghost" onClick={() => setOpen('')}>Close</button></div></div>
        <ul class="po-says">{R.findings.filter((f) => f.po === open).map((f) => <li><span class={`badge ${TONE[f.level][0]}`}>{TONE[f.level][1]}</span> <b>{PO_KIND[f.kind].label}</b> · line {f.line}: {f.text}{f.fix ? <> <b>Probably: {f.fix}</b></> : null}</li>)}</ul>
        <div class="table-wrap" style={{ padding: '0 20px 16px' }}><table class="mini po-hist"><thead><tr><th>Report</th><th>Line</th><th class="r">Ordered</th><th class="r">Spent</th><th class="r">Open balance</th><th class="r">Units</th><th>Unit</th><th>Status</th><th>Description</th></tr></thead>
          <tbody>{H.map((h, i) => { const o = H.slice(0, i).reverse().find((y) => y.line === h.line) ?? H[i - 1]; const c = (k: keyof typeof h) => o && o[k] !== h[k] ? 'ch' : ''; return (
            <tr><td>{h.label}</td><td class={`num ${c('line')}`}>{h.line}</td><td class={`r num ${c('amount')}`}>{full(h.amount)}</td><td class={`r num ${c('spent')}`}>{full(h.spent)}</td><td class={`r num ${c('balance')}`}>{full(h.balance)}</td><td class={`r num ${c('units')}`}>{h.units ?? '—'}</td><td class={c('unitType')}>{h.unitType || '—'}</td><td class={c('status')}>{h.status}</td><td class={c('description')}>{h.description}</td></tr>); })}</tbody></table></div>
      </section>}
    </div>
  );
}
