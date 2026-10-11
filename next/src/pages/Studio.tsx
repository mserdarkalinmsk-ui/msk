import { useState } from 'preact/hooks';
import { filtered, set, useStore } from '../data/store';
import { compareReports, elapsed, lineExposure, lines, money, planStats, reportsByDate, reportTotals, riskScore } from '../domain/calc';
import { headings, outcome } from '../domain/insights';
import { progress, tidy } from '../domain/logframe';
import { roster } from '../domain/staff';
import type { Project } from '../domain/types';
import { TODAY } from '../today';
import { date, full, pct } from '../ui/format';
import { latestWorkbook } from './FinancialReport';
import { Gauge } from '../ui/Gauge';
import { catchUp, perfTrend, staffProjection, warningScore } from '../domain/monitor';
import { HEADINGS } from '../domain/calc';
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
  // Line analysis: approved (baseline) vs actual — units, unit cost and amount, with variances.
  const base = new Map((p.approvedBudget?.lines ?? []).map((l) => [l.code, l]));
  const leaf = L.filter((l) => !L.some((x) => x !== l && x.code.startsWith(l.code + '.')));
  const LA = leaf.map((l) => {
    const b = base.get(l.code);
    const aU = b?.approvedUnits ?? l.approvedUnits ?? null, aR = b?.unitRate ?? l.unitRate ?? null, aA = b?.approved ?? l.approved ?? 0;
    const rU = l.reportedUnits ?? null, act = l.actual ?? 0, rR = l.reportedUnitRate ?? (rU ? act / rU : null);
    return { code: l.code, d: l.description ?? b?.description ?? '', unit: l.unit ?? b?.unit ?? '', aU, aR, aA, rU, rR, act,
      dU: aU != null && rU != null ? rU - aU : null, dR: aR != null && rR != null ? rR - aR : null, dRp: aR && rR != null ? (rR - aR) / aR : null, left: aA - act, use: aA ? act / aA : null };
  });
  const lRows: Cell[][] = LA.map((x) => [x.code, x.d, x.unit, x.aU, x.aR, x.aA, x.rU, x.rR, x.act, x.dU, x.dRp == null ? '' : `${(x.dRp * 100).toFixed(1)}%`, x.left, x.use == null ? '' : pct(x.use)]);
  const iRows: Cell[][] = I.map((x) => [x.indicator.slice(0, 120), tidy(x.baseline), tidy(x.target), x.current ?? '', (() => { const v = progress(x); return v == null ? '' : `${Math.round(v * 100)}%`; })()]);
  const aRows: Cell[][] = (pl?.acts ?? []).map((a) => [a.code, a.name, a.done ? 'Done' : a.late ? 'Late' : a.status || 'Planned', a.plannedEnd ? `month ${a.plannedEnd}` : '']);
  const kRows: Cell[][] = K.map((r) => [tx(r.title), r.category ?? '', `${r.likelihood ?? '–'}×${r.impact ?? '–'}`, tx(r.mitigation), r.status ?? 'Open']);
  const sRows: Cell[][] = S.map((a) => [a.display, a.position, a.status, a.end ? date(a.end) : '']);
  const story = `By ${end ? date(end.date) : 'today'} the project had spent ${full(tEnd.actual)} (${pct(m.budget ? tEnd.actual / m.budget : 0)} of the budget) with ${pct(el)} of the implementation period elapsed${start ? `; ${full(periodSpend)} was spent since ${date(start.date)}` : ''}. Open commitments stand at ${full(tEnd.committed)}. ${o.basis === 'no data' ? '' : o.overrun ? `At the current rate the budget would be exceeded by ${full(o.overrun)}.` : `At the current rate ${pct(o.utilisation)} of the budget will be used by the end date; ${full(o.needRate)} a month would use it in full.`}`;
  const blocks: { sec: Sec; title: string; body: preact.JSX.Element }[] = [
    { sec: 'summary', title: '1. Summary', body: <><p>{story}</p><div class="sd-kpi"><div><span>Budget</span><b class="num">{full(m.budget)}</b></div><div><span>Spent</span><b class="num">{full(tEnd.actual)}</b></div><div><span>Committed</span><b class="num">{full(tEnd.committed)}</b></div><div><span>Forecast at end</span><b class="num">{full(o.projected)}</b></div></div></> },
    { sec: 'headings', title: '2. Budget by heading', body: tbl(['Heading', 'Approved', 'Current', 'Spent + committed', 'Use'], hRows, [1, 2, 3, 4]) },
    { sec: 'period', title: `3. Spending in the period${start ? ` (${date(start.date)} – ${end ? date(end.date) : ''})` : ''}`, body: start ? <><p>{full(periodSpend)} spent in the period. Largest movements:</p>{tbl(['Line', 'Description', 'Spent in period'], pRows, [2])}</> : <p class="muted">Choose a “from” report to show movements in the period.</p> },
    { sec: 'lines', title: '4. Budget lines — units, unit costs and variances', body: LA.length ? <LineTable rows={LA} el={el} /> : <p class="muted">No report lines.</p> },
    { sec: 'indicators', title: '5. Indicators', body: I.length ? tbl(['Indicator', 'Baseline', 'Target', 'Current', 'Progress'], iRows, [4]) : <p class="muted">No indicators on file.</p> },
    { sec: 'activities', title: `6. Activities${pl ? ` · ${pl.done}/${pl.total} done, ${pl.late} late` : ''}`, body: aRows.length ? tbl(['Code', 'Activity', 'Status', 'Planned end'], aRows) : <p class="muted">No activity plan on file.</p> },
    { sec: 'risks', title: '7. Risks', body: kRows.length ? tbl(['Risk', 'Category', 'L × I', 'Mitigation', 'Status'], kRows) : <p class="muted">No risks recorded.</p> },
    { sec: 'staff', title: '8. Staff', body: sRows.length ? tbl(['Name', 'Position', 'Status', 'Contract end'], sRows) : <p class="muted">No staff records.</p> },
  ];
  const sheets: (SheetSpec & { sec: Sec })[] = [
    { sec: 'summary', name: 'Summary', rows: [['Project', p.name], ['Code', p.code], ['Period to', end?.date ?? ''], ['Budget', m.budget], ['Spent', tEnd.actual], ['Committed', tEnd.committed], ['Forecast at end', o.projected], ['Narrative', story]] },
    { sec: 'headings', name: 'Headings', rows: [['Heading', 'Approved', 'Current', 'Spent + committed', 'Use'], ...hRows], money: [1, 2, 3] },
    { sec: 'period', name: 'Period', rows: [['Line', 'Description', 'Spent in period'], ...deltas.map((d) => [d.code, d.description, (d.actual[1] - d.actual[0])])], money: [2] },
    { sec: 'lines', name: 'Lines', rows: [['Line', 'Description', 'Unit', 'Approved units', 'Approved unit cost', 'Approved amount', 'Actual units', 'Actual unit cost', 'Actual amount', 'Unit variance (+/−)', 'Unit cost variance %', 'Remaining', 'Use'], ...lRows], money: [4, 5, 7, 8, 11] },
    { sec: 'indicators', name: 'Indicators', rows: [['Indicator', 'Baseline', 'Target', 'Current', 'Progress'], ...iRows] },
    { sec: 'activities', name: 'Activities', rows: [['Code', 'Activity', 'Status', 'Planned end'], ...aRows] },
    { sec: 'risks', name: 'Risks', rows: [['Risk', 'Category', 'L x I', 'Mitigation', 'Status'], ...kRows] },
    { sec: 'staff', name: 'Staff', rows: [['Name', 'Position', 'Status', 'Contract end'], ...sRows] },
  ];
  return { blocks, sheets };
}

type LA = { code: string; d: string; unit: string; aU: number | null; aR: number | null; aA: number; rU: number | null; rR: number | null; act: number; dU: number | null; dR: number | null; dRp: number | null; left: number; use: number | null };
const nf = (v: number | null, d = 0) => v == null ? '—' : v.toLocaleString('en-GB', { maximumFractionDigits: d });
const sg = (v: number | null, d = 0) => v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toLocaleString('en-GB', { maximumFractionDigits: d })}`;
/** Budget lines by heading: approved vs actual units, unit cost and amount, with increases and decreases. */
function LineTable({ rows, el }: { rows: LA[]; el: number }) {
  const H = new Map<string, LA[]>(); for (const r of rows) { const k = r.code.split('.')[0]; H.set(k, [...(H.get(k) ?? []), r]); }
  const tone = (r: LA) => r.use == null ? '' : r.use > 1 ? 'sd-bad' : r.use > el + 0.25 ? 'sd-warn' : r.use < el - 0.35 ? 'sd-low' : '';
  const T = rows.reduce((a, r) => ({ aA: a.aA + r.aA, act: a.act + r.act }), { aA: 0, act: 0 });
  const over = rows.filter((r) => r.left < 0).sort((a, b) => a.left - b.left).slice(0, 4);
  const up = rows.filter((r) => (r.dRp ?? 0) > 0.05).sort((a, b) => (b.dRp ?? 0) - (a.dRp ?? 0)).slice(0, 4);
  const dn = rows.filter((r) => (r.dRp ?? 0) < -0.05).sort((a, b) => (a.dRp ?? 0) - (b.dRp ?? 0)).slice(0, 4);
  const idle = rows.filter((r) => r.aA > 0 && r.act === 0).sort((a, b) => b.aA - a.aA).slice(0, 4);
  const unitsOver = rows.filter((r) => r.dU != null && r.aU && r.dU > 0).sort((a, b) => (b.dU! / b.aU!) - (a.dU! / a.aU!)).slice(0, 4);
  const box = (t: string, cls: string, R: LA[], f: (r: LA) => string) => R.length ? <div class={`sd-kf ${cls}`}><b>{t}</b><ul>{R.map((r) => <li><span class="num">{r.code}</span> {r.d.slice(0, 48)} — <b>{f(r)}</b></li>)}</ul></div> : null;
  return (
    <>
      <div class="sd-kfs">
        {box('Over approved amount', 'bad', over, (r) => `${full(-r.left)} over (${pct(r.use ?? 0)})`)}
        {box('Unit cost above budget', 'bad', up, (r) => `${full(r.rR ?? 0)} vs ${full(r.aR ?? 0)} (+${((r.dRp ?? 0) * 100).toFixed(1)}%)`)}
        {box('Units above plan', 'warn', unitsOver, (r) => `${nf(r.rU, 1)} of ${nf(r.aU, 1)} ${r.unit.toLowerCase()}`)}
        {box('Unit cost below budget (savings)', 'good', dn, (r) => `${full(r.rR ?? 0)} vs ${full(r.aR ?? 0)} (${((r.dRp ?? 0) * 100).toFixed(1)}%)`)}
        {box('Not started — no spending yet', 'low', idle, (r) => `${full(r.aA)} unspent`)}
        {!over.length && !up.length && !unitsOver.length && !dn.length && !idle.length && <div class="sd-kf good"><b>No line-level issues</b><ul><li>All lines within approved amounts and unit costs.</li></ul></div>}
      </div>
      <p class="sd-note">Approved = baseline budget; actual = latest report. Unit cost variance compares the actual average cost per unit with the budgeted rate. <span class="sd-bad">red</span> over budget · <span class="sd-warn">amber</span> spending well ahead of time ({pct(el)} elapsed) · <span class="sd-low">blue</span> well behind.</p>
      <div class="sd-scroll"><table class="sd-t sd-lt">
        <thead>
          <tr><th rowSpan={2}>Line</th><th rowSpan={2}>Description</th><th colSpan={3} class="c sd-g1">Approved</th><th colSpan={3} class="c sd-g2">Actual</th><th colSpan={2} class="c sd-g3">Variance</th><th rowSpan={2} class="r">Remaining</th><th rowSpan={2} class="r">Use</th></tr>
          <tr><th class="r sd-g1">Units</th><th class="r sd-g1">Unit cost</th><th class="r sd-g1">Amount</th><th class="r sd-g2">Units</th><th class="r sd-g2">Unit cost</th><th class="r sd-g2">Amount</th><th class="r sd-g3">Units ±</th><th class="r sd-g3">Unit cost ±</th></tr>
        </thead>
        <tbody>{[...H].map(([h, R]) => { const s = R.reduce((a, r) => ({ aA: a.aA + r.aA, act: a.act + r.act }), { aA: 0, act: 0 }); return <>
          {R.map((r) => <tr class={tone(r)}>
            <td class="num">{r.code}</td><td>{r.d}{r.unit && <small class="sd-u"> · {r.unit.toLowerCase()}</small>}</td>
            <td class="r num">{nf(r.aU, 1)}</td><td class="r num">{r.aR == null ? '—' : full(r.aR)}</td><td class="r num">{full(r.aA)}</td>
            <td class="r num">{nf(r.rU, 1)}</td><td class="r num">{r.rR == null ? '—' : full(r.rR)}</td><td class="r num"><b>{full(r.act)}</b></td>
            <td class={`r num ${r.dU == null ? '' : r.dU > 0 ? 'up' : r.dU < 0 ? 'dn' : ''}`}>{sg(r.dU, 1)}</td>
            <td class={`r num ${r.dRp == null ? '' : r.dRp > 0.005 ? 'up' : r.dRp < -0.005 ? 'dn' : ''}`}>{r.dRp == null ? '—' : `${sg(r.dR, 0)} (${sg(r.dRp * 100, 1)}%)`}</td>
            <td class={`r num ${r.left < 0 ? 'up' : ''}`}>{full(r.left)}</td><td class="r num">{r.use == null ? '—' : pct(r.use)}</td>
          </tr>)}
          {R.length > 1 && <tr class="sd-sub"><td colSpan={4}>Sub-total {h}</td><td class="r num">{full(s.aA)}</td><td colSpan={2} /><td class="r num">{full(s.act)}</td><td colSpan={2} /><td class="r num">{full(s.aA - s.act)}</td><td class="r num">{s.aA ? pct(s.act / s.aA) : '—'}</td></tr>}
        </>; })}</tbody>
        <tfoot><tr class="sd-tot"><td colSpan={4}>Total</td><td class="r num">{full(T.aA)}</td><td colSpan={2} /><td class="r num">{full(T.act)}</td><td colSpan={2} /><td class="r num">{full(T.aA - T.act)}</td><td class="r num">{T.aA ? pct(T.act / T.aA) : '—'}</td></tr></tfoot>
      </table></div>
    </>
  );
}

/* ---------- Expenditure monitoring (same layout and logic as the CoE monitoring sheet) ---------- */
const rateTone = (v: number) => v >= 1 ? 'em-blue' : v >= 0.9 ? 'em-green' : v >= 0.7 ? 'em-amber' : 'em-red';
const staffTone = (v: number) => v >= 0.5 ? '#d9534f' : v > 0.35 ? '#e8b96a' : '#4f9a7a';
const d8 = (iso: string) => iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '';
const n0 = (v: number) => Math.round(v).toLocaleString('en-GB');
const p0 = (v: number) => `${Math.round(v * 100)}%`;

/** Expenditure monitoring: one row per project — performance (spent vs planned), S&C vs planned, amounts, forecast, staff ratios. */
export function Compare() {
  const s = useStore((x) => x);
  const [group, setGroup] = useState(pref('pl-em-group', 'overall'));
  const [sort, setSort] = useState(pref('pl-em-sort', 'perf'));
  const [riskPct, setRiskPct] = useState(Number(pref('pl-em-risk', '20')));
  const keep = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* */ } };
  const P = filtered(s).filter((p) => !p.datesTbc);
  const cname = (id: string) => s.ledger.countries.find((c) => c.id === id)?.name ?? id;
  const scope = s.filters.country ? cname(s.filters.country) : 'All countries';
  const rows = P.map((p) => {
    const m = money(p), el = elapsed(p, TODAY), planned = m.budget * el, L = lines(p);
    const wb = latestWorkbook(p)?.snapshot?.workbook;
    // Staff ratio as in the accounting system: remuneration articles (permanent + temporary staff) of the Situation budgétaire.
    const SR = wb?.situation ?? [], staff = SR.filter((r) => /r[ée]mun|personnel|salar/i.test(r.description));
    const sum = (R: typeof SR, f: (r: (typeof SR)[number]) => number) => R.reduce((a, r) => a + f(r), 0);
    let sr = 0, scr = 0;
    if (staff.length) {
      const a = sum(SR, (r) => r.actual), sc = sum(SR, (r) => r.actual + r.po + r.da);
      sr = a ? sum(staff, (r) => r.actual) / a : 0; scr = sc ? sum(staff, (r) => r.actual + r.po + r.da) / sc : 0;
    } else {
      const hr = L.filter((l) => /^1\.[12]\.1(\.|$)/.test(l.code) && !L.some((x) => x !== l && x.code.startsWith(l.code + '.')));
      sr = m.spent ? hr.reduce((a, l) => a + (l.actual ?? 0), 0) / m.spent : 0; scr = m.exposure ? hr.reduce((a, l) => a + lineExposure(l), 0) / m.exposure : 0;
    }
    // Underspent forecast only when the report's forecast reaches the end date: amount − (S&C + planned to the end).
    const toEnd = wb?.meta.plannedTo && wb.meta.plannedTo >= p.end.slice(0, 7);
    const under0 = toEnd && wb?.totals.eligible?.planned != null ? wb.totals.eligible.planned : null;
    // Commitments exclude staff: staff POs (remuneration articles) are salaries already planned, not open purchases.
    const staffCommitted = staff.length ? sum(staff, (r) => r.po + r.da) : L.filter((l) => /^1\.[12]\.1(\.|$)/.test(l.code)).reduce((a, l) => a + Math.max(0, lineExposure(l) - (l.actual ?? 0)), 0);
    const committed = Math.max(0, m.exposure - m.spent - staffCommitted), sc = m.spent + committed, risk = committed * riskPct / 100;
    const perf = planned ? m.spent / planned : 0, scp = planned ? sc / planned : 0;
    const ccm = p.ccm || s.ledger.countries.find((c) => c.id === p.country)?.ccm || SR.find((r) => /operation/i.test(r.description) && r.ccm !== '00150')?.ccm || '';
    const under = under0 != null ? Math.max(0, Math.round(m.budget - m.spent - committed - under0)) : 0;
    const note = scp > 1 ? 'over' : under > 0 ? 'under' : '';
    const tr = perfTrend(p), dPerf = tr.length > 1 ? perf - tr.at(-2)!.perf : null;
    return { p, m, planned, perf, scp, ccm, under, note, sr, scr, sc, committed, staffCommitted, risk, pct: m.budget ? sc / m.budget : 0, tr, dPerf,
      ws: warningScore(p, TODAY, { perf, scp, staffRatio: sr }), cu: catchUp(p, TODAY), sp: staffProjection(p, TODAY, sr * m.spent) };
  });
  const SORTS: Record<string, (a: (typeof rows)[number], b: (typeof rows)[number]) => number> = {
    perf: (a, b) => b.perf - a.perf, scp: (a, b) => b.scp - a.scp, amount: (a, b) => b.m.budget - a.m.budget,
    title: (a, b) => a.p.name.localeCompare(b.p.name), end: (a, b) => a.p.end.localeCompare(b.p.end), bh: (a, b) => (a.p.bh ?? '').localeCompare(b.p.bh ?? ''),
  };
  rows.sort((a, b) => (group === 'country' ? cname(a.p.country).localeCompare(cname(b.p.country)) : 0) || SORTS[sort](a, b));
  const groups = group === 'country' ? [...new Set(rows.map((r) => r.p.country))].map((c) => ({ c, R: rows.filter((r) => r.p.country === c) })) : [{ c: '', R: rows }];
  const tot = (R: typeof rows) => R.reduce((a, r) => ({ b: a.b + r.m.budget, s: a.s + r.m.spent, sc: a.sc + r.sc, cm: a.cm + r.committed, rk: a.rk + r.risk, pl: a.pl + r.planned, u: a.u + r.under,
    hs: a.hs + r.sr * r.m.spent, hsc: a.hsc + r.scr * r.m.exposure }), { b: 0, s: 0, sc: 0, cm: 0, rk: 0, pl: 0, u: 0, hs: 0, hsc: 0 });
  const T = rows.reduce((a, r) => ({ b: a.b + r.m.budget, s: a.s + r.m.spent, sc: a.sc + r.sc, cm: a.cm + r.committed, rk: a.rk + r.risk, pl: a.pl + r.planned, u: a.u + r.under,
    hs: a.hs + r.sr * r.m.spent, hsc: a.hsc + r.scr * r.m.exposure }), { b: 0, s: 0, sc: 0, cm: 0, rk: 0, pl: 0, u: 0, hs: 0, hsc: 0 });
  const tp = T.pl ? T.s / T.pl : 0, tsc = T.pl ? T.sc / T.pl : 0;
  const xlsx = () => download(`expenditure-monitoring-${TODAY.toISOString().slice(0, 10)}.xlsx`, [{ name: 'Expenditure monitoring', rows: [
    ['Expenditure monitoring', rows.length, scope, d8(TODAY.toISOString()), 'Spent vs planned', p0(tp), 'Spent and committed vs planned', p0(tsc)], [],
    ['Performance', 'S&C vs planned', 'CCM', 'Title', 'Country', 'MAE', 'PMM', 'BH', 'Start date', 'End date', 'Source of funding', 'Notes', 'Project amount', 'Spent (actual, T)', 'Spent and Committed (T)', 'Left budget (T)', 'Underspent/overspent forecast', 'Staff ratio (spent)', 'Staff ratio (S&C)', 'S&C as % of project amount'],
    ...rows.map((r) => [p0(r.perf), p0(r.scp), r.ccm, r.p.name, cname(r.p.country), r.p.mae ?? '', r.p.pmm ?? r.p.jp ?? '', r.p.bh ?? '', d8(r.p.start), d8(r.p.end), r.p.funding ?? '', r.note === 'over' ? 'Risk of overspending' : r.note === 'under' ? 'Risk of unspent balance' : '', r.m.budget, r.m.spent, r.sc, r.m.budget - r.sc, r.under, p0(r.sr), p0(r.scr), p0(r.pct)]),
    ['Grand Total', '', '', '', '', '', '', '', '', '', '', '', T.b, T.s, T.sc, T.b - T.sc, T.u, p0(T.s ? T.hs / T.s : 0), p0(T.sc ? T.hsc / T.sc : 0), p0(T.b ? T.sc / T.b : 0)]], money: [12, 13, 14, 15, 16] }]);
  const dot = (v: number) => <span class="em-dot" style={{ background: staffTone(v) }} />;
  return (
    <article class="em">
      <div class="no-print em-tools">
        <div class="seg"><button aria-pressed={group === 'overall'} onClick={() => { setGroup('overall'); keep('pl-em-group', 'overall'); }}>Overall</button><button aria-pressed={group === 'country'} onClick={() => { setGroup('country'); keep('pl-em-group', 'country'); }}>By country</button></div>
        <select class="select" value={sort} aria-label="Sort" onChange={(e) => { const v = (e.target as HTMLSelectElement).value; setSort(v); keep('pl-em-sort', v); }}>
          <option value="perf">Sort: Performance</option><option value="scp">Sort: S&C vs planned</option><option value="amount">Sort: Project amount</option><option value="title">Sort: Title</option><option value="end">Sort: End date</option><option value="bh">Sort: BH</option></select>
        <label class="btn" title="Drop this month's report workbooks for all projects">⤒ Monthly update<input type="file" multiple accept=".xlsx,.xlsm" hidden onChange={(e) => { const f = [...((e.target as HTMLInputElement).files ?? [])]; (e.target as HTMLInputElement).value = ''; if (f.length) set({ drawer: { kind: 'portfolio-import', files: f } }); }} /></label>
        <button class="btn primary" onClick={() => print()}>⎙ PDF</button><button class="btn" onClick={xlsx}>⤓ Excel</button></div>
      <div class="gauges no-print">
        <Gauge value={tp} label="Spent vs planned" sub={`${n0(T.s)} of ${n0(T.pl)} planned`} />
        <Gauge value={tsc} label="S&C vs planned" sub="staff commitments excluded" />
        <Gauge value={T.pl ? (T.sc - T.rk) / T.pl : 0} label="Adjusted S&C vs planned" sub={`after ${riskPct}% commitment risk`} />
        <Gauge value={T.s ? T.hs / T.s : 0} max={1} label="Staff ratio (spent)" bands={[[0.35, '#30a46c'], [0.5, '#f5a524'], [1, '#e5484d']]} />
        <Gauge value={rows.length ? rows.reduce((a, r) => a + r.ws.score, 0) / rows.length / 100 : 0} max={1} fmt={(v) => String(Math.round(v * 100))} label="Average attention score" sub={`${rows.filter((r) => r.ws.level === 'high').length} high · ${rows.filter((r) => r.ws.level === 'medium').length} medium`} bands={[[0.25, '#30a46c'], [0.5, '#f5a524'], [1, '#e5484d']]} />
      </div>
      <header class="em-h">
        <table class="em-key"><caption>Colour codes for spending rates</caption><tbody>
          <tr><td>100%</td><td>-</td><td class="em-blue" /></tr><tr><td>90%</td><td>100%</td><td class="em-green" /></tr>
          <tr><td>70%</td><td>90%</td><td class="em-amber" /></tr><tr><td>0%</td><td>70%</td><td class="em-red" /></tr></tbody></table>
        <h1>Expenditure monitoring</h1>
        <b class="em-n">{rows.length}</b><b class="em-c">{scope}</b><b class="em-d">{d8(TODAY.toISOString())}</b>
        <div class="em-box"><span>Spent vs planned</span><b class={rateTone(tp)}>{p0(tp)}</b><span>Spent and committed vs planned</span><b class={rateTone(tsc)}>{p0(tsc)}</b></div>
        <div class="em-x">Extraction date: <span>{date(TODAY.toISOString().slice(0, 10)).toUpperCase()}</span></div>
        <div class="em-tf">T: Today<br />F: Forecast at end</div>
        <table class="em-key em-key2"><caption>Colour codes for staff ratios</caption><tbody>
          <tr><td>0%</td><td>35%</td><td>{dot(0.1)}</td></tr><tr><td>35%</td><td>50%</td><td>{dot(0.4)}</td></tr><tr><td>50%</td><td>100%</td><td>{dot(0.6)}</td></tr></tbody></table>
      </header>
      <div class="sd-scroll"><table class="em-t">
        <thead><tr><th>Performance</th><th>S&C vs planned</th><th>CCM</th><th class="em-title">Title</th><th>Country</th><th>MAE</th><th>PMM</th><th>BH</th><th>Start date</th><th>End date</th><th>Source of funding</th><th>Notes</th>
          <th>Project amount</th><th>Spent (actual, T)</th><th>Spent and Committed (T)</th><th>Left budget (T)</th><th>Underspent/ overspent forecast</th><th>Staff ratio (spent)</th><th>Staff ratio (S&C)</th><th>S&C as % of project amount</th></tr></thead>
        <tbody>{groups.map(({ c, R }) => { const t = tot(R), label = `${cname(c)} total · ${R.length} project${R.length > 1 ? 's' : ''} · spent vs planned ${p0(t.pl ? t.s / t.pl : 0)}`; return <>
          {group === 'country' && <tr class="em-grp"><td colSpan={20}>{cname(c)}</td></tr>}
          {R.map((r) => <tr>
          <td class={`em-rate ${rateTone(r.perf)}`}>{p0(r.perf)}{r.dPerf != null && Math.abs(r.dPerf) >= 0.005 && <small class="em-tr" title="Change since the previous report">{r.dPerf > 0 ? '▲' : '▼'}{Math.abs(Math.round(r.dPerf * 100))}</small>}</td><td class={`em-rate ${rateTone(r.scp)}`}>{p0(r.scp)}</td>
          <td class="em-ccm">{r.ccm}</td><td class="em-title em-g">{r.p.name}</td><td>{cname(r.p.country)}</td><td class="em-g">{r.p.mae ?? ''}</td>
          <td><b>{r.p.pmm ?? r.p.jp ?? ''}</b></td><td class="em-g">{r.p.bh ?? ''}</td><td>{d8(r.p.start)}</td><td class="em-g">{d8(r.p.end)}</td><td>{r.p.funding ?? ''}</td>
          <td class={r.note === 'over' ? 'em-over' : r.note === 'under' ? 'em-under' : ''}>{r.note === 'over' ? 'Risk of overspending' : r.note === 'under' ? 'Risk of unspent balance' : ''}</td>
          <td class="r">{n0(r.m.budget)}</td><td class="r">{n0(r.m.spent)}</td><td class="r">{n0(r.sc)}</td><td class="r">{n0(r.m.budget - r.sc)}</td><td class="r">{n0(r.under)}</td>
          <td class="em-sr">{dot(r.sr)}{p0(r.sr)}</td><td class="em-sr">{dot(r.scr)}{p0(r.scr)}</td><td>{p0(r.pct)}</td>
        </tr>)}
          {group === 'country' && <tr class="em-sub"><td colSpan={12}>{label}</td><td class="r">{n0(t.b)}</td><td class="r">{n0(t.s)}</td><td class="r">{n0(t.sc)}</td><td class="r">{n0(t.b - t.sc)}</td><td class="r">{n0(t.u)}</td><td class="em-sr">{dot(t.s ? t.hs / t.s : 0)}{p0(t.s ? t.hs / t.s : 0)}</td><td class="em-sr">{dot(t.sc ? t.hsc / t.sc : 0)}{p0(t.sc ? t.hsc / t.sc : 0)}</td><td>{p0(t.b ? t.sc / t.b : 0)}</td></tr>}
        </>; })}</tbody>
        <tfoot><tr><td colSpan={12}>Grand Total</td><td class="r">{n0(T.b)}</td><td class="r">{n0(T.s)}</td><td class="r">{n0(T.sc)}</td><td class="r">{n0(T.b - T.sc)}</td><td class="r">{n0(T.u)}</td>
          <td class="em-sr">{dot(T.s ? T.hs / T.s : 0)}{p0(T.s ? T.hs / T.s : 0)}</td><td class="em-sr">{dot(T.sc ? T.hsc / T.sc : 0)}{p0(T.sc ? T.hsc / T.sc : 0)}</td><td>{p0(T.b ? T.sc / T.b : 0)}</td></tr></tfoot>
      </table></div>
      <section class="em-risk">
        <h3 class="em-rh">Commitment risk — <span class="no-print"><select class="select em-rsel" value={String(riskPct)} aria-label="Risk share" onChange={(e) => { const v = (e.target as HTMLSelectElement).value; setRiskPct(Number(v)); keep('pl-em-risk', v); }}>{[0, 5, 10, 15, 20, 25, 30].map((v) => <option value={String(v)}>{v}%</option>)}</select></span><span class="print-only">{riskPct}%</span> of open commitments (staff excluded){riskPct !== 20 && <small class="em-g"> · standard 20%</small>}</h3>
        <table class="em-t em-rt"><thead><tr><th class="em-title">Title</th><th>BH</th><th>Spent (actual)</th><th>Open commitments (excl. staff)</th><th>Staff commitments (excluded)</th><th>Spent and committed (excl. staff)</th><th>At risk of not being spent ({riskPct}%)</th><th>Expected to be spent</th><th>S&C vs planned</th><th>Adjusted S&C vs planned</th></tr></thead>
          <tbody>{rows.filter((r) => r.committed > 0 || r.staffCommitted > 0).map((r) => <tr><td class="em-title em-g">{r.p.name}</td><td class="em-g">{r.p.bh}</td><td class="r">{n0(r.m.spent)}</td><td class="r">{n0(r.committed)}</td><td class="r em-g">{n0(r.staffCommitted)}</td><td class="r">{n0(r.sc)}</td><td class="r"><b>{n0(r.risk)}</b></td><td class="r">{n0(r.committed - r.risk)}</td><td class={`em-rate ${rateTone(r.scp)}`}>{p0(r.scp)}</td><td class={`em-rate ${rateTone(r.planned ? (r.sc - r.risk) / r.planned : 0)}`}>{p0(r.planned ? (r.sc - r.risk) / r.planned : 0)}</td></tr>)}</tbody>
          <tfoot><tr><td colSpan={2}>Total</td><td class="r">{n0(T.s)}</td><td class="r">{n0(T.cm)}</td><td /><td class="r">{n0(T.sc)}</td><td class="r">{n0(T.rk)}</td><td class="r">{n0(T.cm - T.rk)}</td><td>{p0(tsc)}</td><td>{p0(T.pl ? (T.sc - T.rk) / T.pl : 0)}</td></tr></tfoot></table>
        <p class="em-note">Open commitments (purchase orders, staff excluded) are not yet spent. The risk share assumes that part of them may not turn into expenditure (cancelled, closed below value or delayed). <b>Adjusted S&C vs planned</b> = (spent + committed − at risk) ÷ planned — the spending rate to rely on if that share is lost.</p>
      </section>
      <section class="em-risk">
        <h3>Early warning — attention score (0–100)</h3>
        <div class="ew-grid">{[...rows].sort((a, b) => b.ws.score - a.ws.score).map((r) => <div class={`ew ew-${r.ws.level}`}>
          <div class="ew-top"><b class="ew-s">{r.ws.score}</b><div><b>{r.p.bh ? `BH ${r.p.bh}` : r.p.code}</b> · {r.p.name.slice(0, 60)}</div></div>
          <div class="ew-bar"><span style={{ width: `${r.ws.score}%` }} /></div>
          <ul>{r.ws.parts.slice(0, 3).map((x) => <li>{x.label} <span class="em-g">· {x.why}</span> <b>+{x.points}</b></li>)}{!r.ws.parts.length && <li class="em-g">No warning signals</li>}</ul>
          {r.tr.length > 1 && <Spark v={r.tr.map((t) => t.perf)} />}
        </div>)}</div>
      </section>
      <section class="em-risk">
        <h3>Catch-up plan — monthly spending needed to be back on plan within 3 months</h3>
        <table class="em-t em-rt"><thead><tr><th class="em-title">Title</th><th>BH</th><th>Performance</th><th>Current monthly rate</th><th>Needed per month</th><th>× current pace</th><th>Largest gaps (heading: amount behind time)</th></tr></thead>
          <tbody>{rows.filter((r) => r.perf < 0.9 && r.cu.need > 0).sort((a, b) => b.cu.need - a.cu.need).map((r) => <tr><td class="em-title em-g">{r.p.name}</td><td class="em-g">{r.p.bh}</td>
            <td class={`em-rate ${rateTone(r.perf)}`}>{p0(r.perf)}</td><td class="r">{n0(r.cu.rate)}</td><td class="r"><b>{n0(r.cu.need)}</b></td><td class={r.cu.factor > 2 ? 'em-up' : ''}>{r.cu.rate ? `${r.cu.factor.toFixed(1)}×` : '—'}</td>
            <td style={{ textAlign: 'left' }}>{r.cu.gaps.map((g) => `${g.heading} ${HEADINGS[g.heading] ?? ''}: ${n0(g.gap)}`).join(' · ') || '—'}</td></tr>)}</tbody></table>
        {!rows.some((r) => r.perf < 0.9 && r.cu.need > 0) && <p class="em-note">All projects are at 90% of plan or above.</p>}
      </section>
      <section class="em-risk">
        <h3>Staff projection — staff cost to the end date at the current monthly cost</h3>
        <table class="em-t em-rt"><thead><tr><th class="em-title">Title</th><th>BH</th><th>Staff cost per month</th><th>Projected staff cost at end</th><th>Projected staff share of project amount</th><th>Active staff</th><th>Contracts ending before project end</th></tr></thead>
          <tbody>{rows.map((r) => <tr><td class="em-title em-g">{r.p.name}</td><td class="em-g">{r.p.bh}</td><td class="r">{n0(r.sp.monthly)}</td><td class="r">{n0(r.sp.projected)}</td>
            <td class="em-sr">{dot(r.sp.share)}{p0(r.sp.share)}</td><td>{r.sp.active}</td><td class={r.sp.endingEarly ? 'em-up' : ''}>{r.sp.endingEarly}</td></tr>)}</tbody></table>
      </section>
      <section class="em-method">
        <h3>How the figures are calculated</h3>
        <ol>
          <li><b>Planned</b> = project amount × share of the implementation period elapsed at today (T): (today − start date) ÷ (end date − start date).</li>
          <li><b>Performance</b> = spent (actual, T) ÷ planned.</li>
          <li><b>Committed</b> = open purchase orders and requests <b>excluding staff</b> (remuneration of permanent and temporary staff are not counted as commitments).</li>
          <li><b>Spent and committed (S&C)</b> = spent + committed (excluding staff). <b>S&C vs planned</b> = S&C ÷ planned.</li>
          <li><b>Left budget</b> = project amount − S&C. <b>S&C as % of project amount</b> = S&C ÷ project amount.</li>
          <li><b>Underspent/overspent forecast</b> = project amount − S&C − planned expenditure to the end date (only when the report's forecast covers the period to the end date).</li>
          <li><b>Staff ratio (spent)</b> = staff remuneration spent ÷ total spent; <b>(S&C)</b> = staff remuneration spent and committed ÷ total spent and committed (Situation budgétaire).</li>
          <li><b>Trend</b> ▲▼ = change in performance since the previous financial report. <b>Early warning score</b> adds points for spending behind plan (up to 35), S&C above plan (15), staff ratio (up to 15), late activities (15), overdue reports (20) and a worsening trend (10); ≥50 high, 25–49 medium.</li>
          <li><b>Catch-up plan</b> = (planned in 3 months − spent) ÷ 3, compared with the current monthly rate. <b>Staff projection</b> = staff spent ÷ months elapsed × months to the end.</li>
          <li><b>Commitment risk</b> = {riskPct}% of committed (excluding staff) — the share of open commitments that may not be spent; <b>adjusted S&C vs planned</b> = (S&C − at risk) ÷ planned.</li>
          <li><b>Colour codes</b> — spending rates: ≥100% blue, 90–100% green, 70–90% amber, &lt;70% red. Staff ratios: ≤35% green, 35–50% amber, ≥50% red. <b>Notes</b>: “Risk of overspending” when S&C vs planned &gt; 100%; “Risk of unspent balance” when an underspend is forecast.</li>
        </ol>
      </section>
      
    </article>
  );
}

function Spark({ v }: { v: number[] }) {
  const max = Math.max(1, ...v), w = 120, h = 26, pts = v.map((x, i) => `${(i / (v.length - 1)) * w},${h - (x / max) * h}`).join(' ');
  return <svg class="ew-sp" viewBox={`0 0 ${w} ${h + 2}`} width={w} height={h + 2}><line x1="0" x2={w} y1={h - h / max} y2={h - h / max} stroke="#bbb" stroke-dasharray="3 3" /><polyline points={pts} fill="none" stroke="#1f4e9c" stroke-width="1.8" /><title>Performance at each report: {v.map((x) => `${Math.round(x * 100)}%`).join(' → ')}</title></svg>;
}
