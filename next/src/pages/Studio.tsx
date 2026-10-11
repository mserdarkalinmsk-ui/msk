import { useState } from 'preact/hooks';
import { filtered, useStore } from '../data/store';
import { compareReports, elapsed, money, planStats, reportsByDate, reportTotals, riskScore } from '../domain/calc';
import { headings, outcome } from '../domain/insights';
import { progress, tidy } from '../domain/logframe';
import { roster } from '../domain/staff';
import type { Project } from '../domain/types';
import { TODAY } from '../today';
import { date, full, pct } from '../ui/format';
import { download, type Cell, type SheetSpec } from '../ui/xlsxwrite';

const SECTIONS = [
  ['summary', 'Summary and key figures'], ['headings', 'Budget by heading'], ['period', 'Spending in the period'], ['lines', 'Budget lines'],
  ['indicators', 'Indicators'], ['activities', 'Activities'], ['risks', 'Risks'], ['staff', 'Staff'],
] as const;
type Sec = (typeof SECTIONS)[number][0];
const tx = (s?: string) => (s ?? '').replace(/[\uE000-\uF8FF]/g, '').replace(/\s*·\s*·\s*/g, ' · ').replace(/\s+/g, ' ').replace(/^[\s·]+|[\s·]+$/g, '');
const pref = (k: string, d: string) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };

/** Report studio: pick a project, a reporting period and sections → a print-ready report and a matching workbook. */
export function Studio() {
  const s = useStore((x) => x);
  const P = filtered(s).filter((p) => !p.datesTbc);
  const [pid, setPid] = useState(pref('pl-studio-p', P[0]?.id ?? ''));
  const p = P.find((x) => x.id === pid) ?? P[0];
  const R = p ? reportsByDate(p).filter((r) => r.snapshot?.lines?.length && !/approved budget/i.test(r.type)) : [];
  const [to, setTo] = useState(''); const [from, setFrom] = useState('');
  const [on, setOn] = useState<Record<Sec, boolean>>(() => { try { return JSON.parse(localStorage.getItem('pl-studio-s') ?? ''); } catch { return Object.fromEntries(SECTIONS.map(([k]) => [k, true])) as Record<Sec, boolean>; } });
  if (!p) return <div class="card empty-page"><div><h2>No project with figures yet</h2><p>Import a financial report into a project first.</p></div></div>;
  const end = R.find((r) => r.id === to) ?? R.at(-1), start = R.find((r) => r.id === from) ?? R[R.indexOf(end!) - 1];
  const toggle = (k: Sec) => { const n = { ...on, [k]: !on[k] }; setOn(n); try { localStorage.setItem('pl-studio-s', JSON.stringify(n)); } catch { /* */ } };
  const D = build(p, end, start);
  const xlsx = () => download(`${p.code}-report-${end?.date ?? TODAY.toISOString().slice(0, 10)}.xlsx`, D.sheets.filter((x) => on[x.sec]).map(({ sec: _, ...x }) => x));
  return (
    <div class="studio">
      <aside class="card studio-c no-print">
        <h3>Project</h3>
        <select class="select" value={p.id} onChange={(e) => { const v = (e.target as HTMLSelectElement).value; setPid(v); setTo(''); setFrom(''); try { localStorage.setItem('pl-studio-p', v); } catch { /* */ } }}>{P.map((x) => <option value={x.id}>{x.code} · {x.name}</option>)}</select>
        <h3>Period</h3>
        {R.length ? <>
          <label class="studio-l">From report<select class="select" value={start?.id ?? ''} onChange={(e) => setFrom((e.target as HTMLSelectElement).value)}><option value="">Project start</option>{R.filter((r) => !end || r.date < end.date).map((r) => <option value={r.id}>{date(r.date)}</option>)}</select></label>
          <label class="studio-l">To report<select class="select" value={end?.id} onChange={(e) => setTo((e.target as HTMLSelectElement).value)}>{R.map((r) => <option value={r.id}>{date(r.date)}</option>)}</select></label>
        </> : <p class="muted">No financial reports yet — figures use the budget only.</p>}
        <h3>Sections</h3>
        {SECTIONS.map(([k, l]) => <label class="studio-ck"><input type="checkbox" checked={on[k] !== false} onChange={() => toggle(k)} />{l}</label>)}
        <div class="studio-b"><button class="btn primary" onClick={() => print()}>⎙ PDF</button><button class="btn" onClick={xlsx}>⤓ Excel</button></div>
      </aside>
      <article class="studio-doc">
        <header class="sd-h">
          <div class="sd-k">Progress report · {p.sector}</div>
          <h1>{p.name}</h1>
          <div class="sd-m">{p.code}{p.contractNo ? ` · Contract ${p.contractNo}` : ''} · {date(p.start)} – {date(p.end)} · period {start ? date(start.date) : date(p.start)} – {end ? date(end.date) : date(TODAY.toISOString().slice(0, 10))}</div>
        </header>
        {D.blocks.filter((b) => on[b.sec] !== false).map((b) => <section class="sd-s"><h2>{b.title}</h2>{b.body}</section>)}
        <footer class="sd-f">Prepared {date(TODAY.toISOString().slice(0, 10))} from the project file · figures in EUR</footer>
      </article>
    </div>
  );
}

type R_ = ReturnType<typeof reportsByDate>[number];
function build(p: Project, end?: R_, start?: R_) {
  const m = money(p), o = outcome(p, TODAY), H = headings(p), el = elapsed(p, TODAY);
  const tEnd = end ? reportTotals(end) : { approved: m.budget, actual: m.spent, committed: m.committed, exposure: m.exposure };
  const tStart = start ? reportTotals(start) : null;
  const periodSpend = tEnd.actual - (tStart?.actual ?? 0);
  const deltas = end && start ? compareReports(start, end).filter((d) => Math.abs((d.actual[1] - d.actual[0])) > 0.5).sort((a, b) => Math.abs(b.actual[1] - b.actual[0]) - Math.abs(a.actual[1] - a.actual[0])) : [];
  const L = end?.snapshot?.lines ?? [];
  const I = p.indicators ?? [], pl = planStats(p, TODAY), K = [...(p.riskRegister ?? [])].sort((a, b) => riskScore(b) - riskScore(a)), S = roster(p, TODAY);
  const tbl = (head: string[], rows: Cell[][], r: number[] = []) => <table class="sd-t"><thead><tr>{head.map((h, i) => <th class={r.includes(i) ? 'r' : ''}>{h}</th>)}</tr></thead><tbody>{rows.map((x) => <tr>{x.map((c, i) => <td class={r.includes(i) ? 'r num' : ''}>{typeof c === 'number' ? full(c) : c}</td>)}</tr>)}</tbody></table>;
  const hRows: Cell[][] = [...H.rows.map((h) => [`${h.code} ${h.label}`, h.baseline, h.approved, h.exposure, h.baseline ? pct(h.exposure / h.baseline) : '']), ['Total direct costs', H.direct.baseline, H.direct.approved, H.direct.exposure, H.direct.baseline ? pct(H.direct.exposure / H.direct.baseline) : ''], ['Administrative costs', H.admin.baseline, H.admin.approved, H.admin.exposure, ''], ['Total budget', H.total.baseline, H.total.approved, H.total.exposure, H.total.baseline ? pct(H.total.exposure / H.total.baseline) : '']];
  const pRows: Cell[][] = deltas.slice(0, 15).map((d) => [d.code, d.description, (d.actual[1] - d.actual[0])]);
  const lRows: Cell[][] = L.map((l) => [l.code, l.description ?? '', l.approved ?? 0, l.actual ?? 0, l.approved ? pct((l.actual ?? 0) / l.approved) : '']);
  const iRows: Cell[][] = I.map((x) => [x.indicator.slice(0, 120), tidy(x.baseline), tidy(x.target), x.current ?? '', (() => { const v = progress(x); return v == null ? '' : `${Math.round(v * 100)}%`; })()]);
  const aRows: Cell[][] = (pl?.acts ?? []).map((a) => [a.code, a.name, a.done ? 'Done' : a.late ? 'Late' : a.status || 'Planned', a.plannedEnd ? `month ${a.plannedEnd}` : '']);
  const kRows: Cell[][] = K.map((r) => [tx(r.title), r.category ?? '', `${r.likelihood ?? '–'}×${r.impact ?? '–'}`, tx(r.mitigation), r.status ?? 'Open']);
  const sRows: Cell[][] = S.map((a) => [a.display, a.position, a.status, a.end ? date(a.end) : '']);
  const story = `By ${end ? date(end.date) : 'today'} the project had spent ${full(tEnd.actual)} (${pct(m.budget ? tEnd.actual / m.budget : 0)} of the budget) with ${pct(el)} of the implementation period elapsed${start ? `; ${full(periodSpend)} was spent since ${date(start.date)}` : ''}. Open commitments stand at ${full(tEnd.committed)}. ${o.basis === 'no data' ? '' : o.overrun ? `At the current rate the budget would be exceeded by ${full(o.overrun)}.` : `At the current rate ${pct(o.utilisation)} of the budget will be used by the end date; ${full(o.needRate)} a month would use it in full.`}`;
  const blocks: { sec: Sec; title: string; body: preact.JSX.Element }[] = [
    { sec: 'summary', title: '1. Summary', body: <><p>{story}</p><div class="sd-kpi"><div><span>Budget</span><b class="num">{full(m.budget)}</b></div><div><span>Spent</span><b class="num">{full(tEnd.actual)}</b></div><div><span>Committed</span><b class="num">{full(tEnd.committed)}</b></div><div><span>Forecast at end</span><b class="num">{full(o.projected)}</b></div></div></> },
    { sec: 'headings', title: '2. Budget by heading', body: tbl(['Heading', 'Approved', 'Current', 'Spent + committed', 'Use'], hRows, [1, 2, 3, 4]) },
    { sec: 'period', title: `3. Spending in the period${start ? ` (${date(start.date)} – ${end ? date(end.date) : ''})` : ''}`, body: start ? <><p>{full(periodSpend)} spent in the period. Largest movements:</p>{tbl(['Line', 'Description', 'Spent in period'], pRows, [2])}</> : <p class="muted">Choose a “from” report to show movements in the period.</p> },
    { sec: 'lines', title: '4. Budget lines', body: L.length ? tbl(['Line', 'Description', 'Approved', 'Actual', 'Use'], lRows, [2, 3, 4]) : <p class="muted">No report lines.</p> },
    { sec: 'indicators', title: '5. Indicators', body: I.length ? tbl(['Indicator', 'Baseline', 'Target', 'Current', 'Progress'], iRows, [4]) : <p class="muted">No indicators on file.</p> },
    { sec: 'activities', title: `6. Activities${pl ? ` · ${pl.done}/${pl.total} done, ${pl.late} late` : ''}`, body: aRows.length ? tbl(['Code', 'Activity', 'Status', 'Planned end'], aRows) : <p class="muted">No activity plan on file.</p> },
    { sec: 'risks', title: '7. Risks', body: kRows.length ? tbl(['Risk', 'Category', 'L × I', 'Mitigation', 'Status'], kRows) : <p class="muted">No risks recorded.</p> },
    { sec: 'staff', title: '8. Staff', body: sRows.length ? tbl(['Name', 'Position', 'Status', 'Contract end'], sRows) : <p class="muted">No staff records.</p> },
  ];
  const sheets: (SheetSpec & { sec: Sec })[] = [
    { sec: 'summary', name: 'Summary', rows: [['Project', p.name], ['Code', p.code], ['Period to', end?.date ?? ''], ['Budget', m.budget], ['Spent', tEnd.actual], ['Committed', tEnd.committed], ['Forecast at end', o.projected], ['Narrative', story]] },
    { sec: 'headings', name: 'Headings', rows: [['Heading', 'Approved', 'Current', 'Spent + committed', 'Use'], ...hRows], money: [1, 2, 3] },
    { sec: 'period', name: 'Period', rows: [['Line', 'Description', 'Spent in period'], ...deltas.map((d) => [d.code, d.description, (d.actual[1] - d.actual[0])])], money: [2] },
    { sec: 'lines', name: 'Lines', rows: [['Line', 'Description', 'Approved', 'Actual', 'Use'], ...lRows], money: [2, 3] },
    { sec: 'indicators', name: 'Indicators', rows: [['Indicator', 'Baseline', 'Target', 'Current', 'Progress'], ...iRows] },
    { sec: 'activities', name: 'Activities', rows: [['Code', 'Activity', 'Status', 'Planned end'], ...aRows] },
    { sec: 'risks', name: 'Risks', rows: [['Risk', 'Category', 'L x I', 'Mitigation', 'Status'], ...kRows] },
    { sec: 'staff', name: 'Staff', rows: [['Name', 'Position', 'Status', 'Contract end'], ...sRows] },
  ];
  return { blocks, sheets };
}
