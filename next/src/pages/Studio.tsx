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

/** All projects side by side — money, pace, forecast, results, people and open issues — ready to print. */
export function Compare() {
  const s = useStore((x) => x);
  const P = filtered(s).filter((p) => !p.datesTbc);
  const cname = (id: string) => s.ledger.countries.find((c) => c.id === id)?.name ?? id;
  const rows = P.map((p) => {
    const m = money(p), o = outcome(p, TODAY), el = elapsed(p, TODAY), pl = planStats(p, TODAY);
    const I = (p.indicators ?? []).map(progress).filter((v): v is number => v != null);
    const risks = (p.riskRegister ?? []).filter((r) => (r.status ?? 'Open') === 'Open' && riskScore(r) >= 12).length;
    return { p, m, o, el, used: m.budget ? m.spent / m.budget : 0, pl, ind: I.length ? I.reduce((a, b) => a + Math.min(1, b), 0) / I.length : null, staff: roster(p, TODAY).filter((a) => a.status === 'Active').length, risks };
  });
  const T = rows.reduce((a, r) => ({ b: a.b + r.m.budget, s: a.s + r.m.spent, c: a.c + r.m.committed, f: a.f + Math.min(r.o.projected, r.m.budget) }), { b: 0, s: 0, c: 0, f: 0 });
  const bar = (v: number, mark?: number, bad?: boolean) => <div class="cmp-bar"><span style={{ width: `${Math.min(100, v * 100)}%`, background: bad ? '#b42318' : '#1f4e9c' }} />{mark != null && <i style={{ left: `${Math.min(100, mark * 100)}%` }} />}</div>;
  const xlsx = () => download(`portfolio-comparison-${TODAY.toISOString().slice(0, 10)}.xlsx`, [{ name: 'Comparison', rows: [['Code', 'Project', 'Country', 'Sector', 'Budget', 'Spent', 'Committed', 'Spent %', 'Time %', 'Forecast at end', 'Forecast %', 'Activities done', 'Activities late', 'Indicator progress', 'Active staff', 'High risks'],
    ...rows.map((r) => [r.p.code, r.p.name, cname(r.p.country), r.p.sector ?? '', r.m.budget, r.m.spent, r.m.committed, pct(r.used), pct(r.el), r.o.projected, pct(r.o.utilisation), r.pl ? `${r.pl.done}/${r.pl.total}` : '', r.pl?.late ?? '', r.ind == null ? '' : pct(r.ind), r.staff, r.risks])], money: [4, 5, 6, 9] }]);
  return (
    <article class="studio-doc cmp">
      <header class="sd-h" style={{ display: 'flex', alignItems: 'flex-end', gap: '12px' }}>
        <div style={{ flex: 1 }}><div class="sd-k">Portfolio comparison</div><h1>{P.length} projects at {date(TODAY.toISOString().slice(0, 10))}</h1>
          <div class="sd-m">Budget {full(T.b)} · spent {full(T.s)} ({pct(T.b ? T.s / T.b : 0)}) · committed {full(T.c)} · forecast use {pct(T.b ? T.f / T.b : 0)}</div></div>
        <div class="no-print" style={{ display: 'flex', gap: '8px' }}><button class="btn primary" onClick={() => print()}>⎙ PDF</button><button class="btn" onClick={xlsx}>⤓ Excel</button></div>
      </header>
      <div class="sd-scroll"><table class="sd-t cmp-t">
        <thead><tr><th>Project</th><th class="r">Budget</th><th>Spent vs time</th><th class="r">Forecast at end</th><th>Activities</th><th>Indicators</th><th class="r">Staff</th><th class="r">High risks</th></tr></thead>
        <tbody>{rows.map((r) => <tr>
          <td><b>{r.p.code}</b> · {r.p.name}<br /><small class="sd-u">{cname(r.p.country)} · {r.p.sector} · {date(r.p.start)} – {date(r.p.end)}</small></td>
          <td class="r num">{full(r.m.budget)}</td>
          <td style={{ minWidth: '150px' }}>{bar(r.used, r.el, r.used - r.el < -0.25)}<small class="sd-u">{pct(r.used)} spent · {pct(r.el)} time</small></td>
          <td class="r num">{full(r.o.projected)}<br /><small class={r.o.utilisation < 0.85 || r.o.overrun ? 'up' : 'sd-u'}>{pct(r.o.utilisation)} of budget</small></td>
          <td>{r.pl ? <>{bar(r.pl.total ? r.pl.done / r.pl.total : 0)}<small class={r.pl.late ? 'up' : 'sd-u'}>{r.pl.done}/{r.pl.total} done{r.pl.late ? ` · ${r.pl.late} late` : ''}</small></> : <small class="sd-u">no plan</small>}</td>
          <td>{r.ind == null ? <small class="sd-u">not measured</small> : <>{bar(r.ind)}<small class="sd-u">{pct(r.ind)} average</small></>}</td>
          <td class="r num">{r.staff}</td><td class={`r num ${r.risks ? 'up' : ''}`}>{r.risks}</td>
        </tr>)}</tbody>
        <tfoot><tr class="sd-tot"><td>Total</td><td class="r num">{full(T.b)}</td><td>{pct(T.b ? T.s / T.b : 0)} spent</td><td class="r num">{full(T.f)}</td><td colSpan={4} /></tr></tfoot>
      </table></div>
      <footer class="sd-f">Bar = share spent; the tick marks the share of time elapsed. Red when spending is more than 25 points behind time. High risks = open risks with likelihood × impact ≥ 12.</footer>
    </article>
  );
}
