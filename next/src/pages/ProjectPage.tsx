import { useState } from 'preact/hooks';
import { deleteProjects, deleteReport, deleteRisk, go, set, updateLine, upsertRisk, useStore } from '../data/store';
import { burnGap, compareReports, elapsed, lineExposure, money, parseDate, planStats, reportsByDate, reportTotals, riskScore, spendPoints } from '../domain/calc';
import { validUrl, type Project, type ReportingPeriod, type Risk } from '../domain/types';
import { TODAY } from '../today';
import { base, Chart, type Tokens } from '../ui/Chart';
import { parseAmount } from '../ui/csv';
import { DataTable, type Column } from '../ui/DataTable';
import { date, full, month, pct, period, short, signedPct } from '../ui/format';
import { axisMoney, axisX, axisY } from './Overview';
import { usedTone } from './Budget';
import { StaffBoard } from './People';
import { StaffReport } from './StaffReport';
import { FinancialReport } from './FinancialReport';
import { roster } from '../domain/staff';
import { Indicators, Justification } from './Logframe';
import { ForecastCard, HeadingsCard, ReadinessCard, History, Scenario, StatusWords } from './Insights';
import { alerts } from '../domain/insights';
import { projectSheets } from '../domain/exports';
import { download } from '../ui/xlsxwrite';

const TABS = ['Summary', 'Financial report', 'Budget lines', 'Scenario', 'Reports', 'People', 'Activity plan', 'Indicators', 'Justification', 'Risks', 'Results & documents', 'History'] as const;
type Tab = (typeof TABS)[number];
/** Tabs grouped so the bar fits: a group's first tab opens when the group is chosen. */
const GROUPS: { label: string; tabs: Tab[] }[] = [
  { label: 'Summary', tabs: ['Summary'] },
  { label: 'Finance', tabs: ['Financial report', 'Budget lines', 'Justification', 'Scenario', 'Reports'] },
  { label: 'Results', tabs: ['Indicators', 'Activity plan', 'Risks'] },
  { label: 'People', tabs: ['People'] },
  { label: 'Documents', tabs: ['Results & documents', 'History'] },
];
const LABEL: Partial<Record<Tab, string>> = { 'Results & documents': 'Documents' };

export function ProjectPage({ id }: { id: string }) {
  const p = useStore((s) => s.ledger.projects.find((x) => x.id === id));
  const countries = useStore((s) => s.ledger.countries);
  const [tab, setTab] = useState<Tab>('Summary');
  if (!p) return <div class="card empty-page"><div><h2>Project not found</h2><p>It may have been deleted.</p><button class="btn" onClick={() => go('projects')}>All projects</button></div></div>;
  const m = money(p), el = elapsed(p, TODAY), gap = burnGap(p, TODAY);
  const reports = reportsByDate(p);
  const plan = planStats(p, TODAY);
  const counts: Partial<Record<Tab, number>> = { 'Budget lines': reportsByDate(p).at(-1)?.snapshot?.lines.length, Reports: reports.length, People: roster(p, TODAY).length, 'Activity plan': plan?.total, Risks: p.riskRegister?.length, Indicators: p.indicators?.length, Justification: Object.keys(p.budgetNotes ?? {}).length || undefined, 'Results & documents': p.documents?.length };
  return (
    <>
      <div class="ph">
        <div style={{ minWidth: 0 }}>
          <div class="ph-meta"><span class="num">{p.code}</span><span>{countries.find((c) => c.id === p.country)?.name ?? p.country}</span><span>{p.sector}</span><span>{period(p)}</span>{p.pmm && <span>PMM <b class="num">{p.pmm}</b></span>}{p.bh && <span>BH <b class="num">{p.bh}</b></span>}{p.mae && <span>MAE <b>{p.mae}</b></span>}<span class={`badge ${p.status === 'Closed' ? 'neutral' : p.status === 'Pipeline' ? 'warning' : 'good'}`}>{p.status || 'Active'}</span></div>
          <h2 class="ph-title">{p.name}</h2>
        </div>
        <div class="ph-actions">
          {validUrl(p.pmmUrl) && <a class="btn" href={validUrl(p.pmmUrl)!} target="_blank" rel="noopener noreferrer" aria-label={`Open PMM for ${p.name}`}>PMM ↗</a>}
          <button class="btn" onClick={() => set({ drawer: { kind: 'documents', projectId: p.id } })}>Add documents</button>
          <button class="btn" onClick={() => set({ drawer: { kind: 'report', projectId: p.id } })}>Import report</button>
          <button class="btn" onClick={() => set({ drawer: { kind: 'project', id: p.id } })}>Edit details</button>
          <button class="btn" title="Project summary, lines, staff, risks and activities as Excel" onClick={() => download(`${p.code}-${TODAY.toISOString().slice(0, 10)}.xlsx`, projectSheets(p, TODAY))}>⤓ Excel</button>
          <button class="btn" onClick={() => print()}>⎙ PDF</button>
          <button class="btn ghost danger" onClick={() => { if (confirm(`Delete ${p.code}? You can undo right after.`)) { deleteProjects([p.id]); go('projects'); } }}>Delete</button>
        </div>
      </div>
      <section class="hero" aria-label="Project figures">
        <div class="kpi lead">
          <span class="label">Spent to date</span><span class="value">{short(m.spent)}</span>
          <span class="ctx"><b>{pct(m.budget ? m.spent / m.budget : 0)}</b> of {full(m.budget)}</span>
          <div class="meter"><span style={{ width: `${Math.min(100, (m.spent / (m.budget || 1)) * 100)}%`, background: 'var(--c1)' }} /><i class="tick" style={{ left: `calc(${el * 100}% - 1px)` }} /></div>
          <span class="ctx" style={{ fontSize: '11.5px' }}>│ time elapsed {pct(el)}</span>
        </div>
        <div class="kpi"><span class="label">Pace vs time</span><span class="value">{signedPct(gap)}</span><span class="ctx">{gap < -0.15 ? 'behind schedule' : gap > 0.1 ? 'ahead of schedule' : 'on track'}</span></div>
        <div class="kpi"><span class="label">Uncommitted balance</span><span class="value" style={{ color: m.remaining < 0 ? 'var(--critical)' : undefined }}>{short(m.remaining)}</span><span class="ctx">after {short(m.committed)} committed</span></div>
        <div class="kpi"><span class="label">Activities</span><span class="value">{plan ? `${plan.done}/${plan.total}` : '—'}</span><span class="ctx">{plan ? <>{plan.late > 0 ? <b style={{ color: 'var(--serious)' }}>{plan.late} overdue</b> : 'none overdue'} · month {plan.month}</> : 'no plan on file'}</span></div>
      </section>
      <div class="tabs" role="tablist">
        {GROUPS.map((g) => { const n = g.tabs.reduce((s, t) => s + (counts[t] ?? 0), 0); return <button role="tab" aria-selected={g.tabs.includes(tab)} onClick={() => !g.tabs.includes(tab) && setTab(g.tabs[0])}>{g.label}{n > 0 && <span class="tab-n">{n}</span>}</button>; })}
      </div>
      {(() => { const g = GROUPS.find((x) => x.tabs.includes(tab))!; return g.tabs.length > 1 && (
        <div class="subtabs" role="tablist" aria-label={g.label}>{g.tabs.map((t) => <button role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{LABEL[t] ?? t}{counts[t] != null && <span class="tab-n">{counts[t]}</span>}</button>)}</div>); })()}
      {tab === 'Summary' && <Summary p={p} />}
      {tab === 'Financial report' && <FinancialReport p={p} />}
      {tab === 'Budget lines' && <Lines p={p} />}
      {tab === 'Reports' && <Reports p={p} />}
      {tab === 'People' && (roster(p, TODAY).length ? <><StaffBoard people={roster(p, TODAY)} /><div class="grid g-12" style={{ marginTop: '16px' }}><StaffReport projects={[p]} /></div></> : <div class="card empty-page"><div><h2>No staff records</h2><p>Import a report workbook with a “Purchase Orders” sheet.</p></div></div>)}
      {tab === 'Activity plan' && <Plan p={p} />}
      {tab === 'Risks' && <Risks p={p} />}
      {tab === 'Results & documents' && <ResultsDocs p={p} />}
      {tab === 'Indicators' && <Indicators p={p} />}
      {tab === 'Justification' && <Justification p={p} />}
      {tab === 'Scenario' && <Scenario p={p} />}
      {tab === 'History' && <History project={p.code} />}
    </>
  );
}

function Summary({ p }: { p: Project }) {
  const m = money(p), s = parseDate(p.start).getTime(), e = parseDate(p.end).getTime();
  const pts = spendPoints(p);
  const flags = alerts([p], TODAY);
  return (
    <div class="grid g-12">
      <StatusWords p={p} />
      <ForecastCard p={p} />
      <section class="card span-8">
        <div class="card-h"><div><h2>Cumulative spend vs linear plan</h2><p>One point per financial report</p></div></div>
        <div class="card-b"><Chart height={300} label="Project spend over time" option={(t) => ({
          ...base(t),
          grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
          tooltip: { ...(base(t).tooltip as object), trigger: 'axis', valueFormatter: (v: number) => full(v) },
          xAxis: { type: 'time', min: s, max: e, ...axisX(t), axisLabel: { ...axisX(t).axisLabel, formatter: (v: number) => month(v) } },
          yAxis: { type: 'value', max: m.budget, ...axisY(t), axisLabel: { ...axisY(t).axisLabel, formatter: axisMoney } },
          series: [
            { name: 'Plan', type: 'line', data: [[s, 0], [e, m.budget]], symbol: 'none', lineStyle: { color: t.plan, type: 'dashed', width: 1.5 },
              markLine: { silent: true, symbol: 'none', label: { formatter: 'Today', color: t.ink3, fontSize: 11 }, lineStyle: { color: t.ink3, type: 'solid', width: 1 }, data: [{ xAxis: TODAY.getTime() }] } },
            { name: 'Actual', type: 'line', data: pts.map((x) => [x.t, x.v]), symbolSize: 8, lineStyle: { width: 2.5, color: t.c[0] }, itemStyle: { color: t.c[0], borderColor: t.surface, borderWidth: 2 }, areaStyle: { color: t.c[0], opacity: 0.08 } },
          ],
        })} /></div>
      </section>
      <section class="card span-4">
        <div class="card-h"><div><h2>Needs attention</h2><p>{flags.length ? `${flags.length} items` : 'Nothing flagged'}</p></div></div>
        <ul class="att" style={{ marginTop: '12px' }}>
          {flags.map((f) => <li style={{ cursor: 'default' }}><span class={`badge ${f.severity}`}>{f.severity}</span><div><div class="t">{f.title}</div><div class="d">{f.detail}</div></div><span /></li>)}
          {!flags.length && <li style={{ cursor: 'default' }}><span class="badge good">ok</span><div class="d">Within all thresholds.</div><span /></li>}
        </ul>
      </section>
      <HeadingsCard p={p} />
      <ReadinessCard p={p} />
    </div>
  );
}

interface LineV { code: string; description: string; approved: number; actual: number; committed: number; exposure: number; used: number; note?: string; why?: string }
function Lines({ p }: { p: Project }) {
  const rep = reportsByDate(p).filter((r) => r.snapshot?.lines.length).at(-1)
    ?? (p.approvedBudget ? { id: '__approved', name: 'Approved budget', type: `baseline from ${p.approvedBudget.source}`, date: (p.approvedBudget.importedAt ?? p.start).slice(0, 10), snapshot: { lines: p.approvedBudget.lines } } as ReportingPeriod : undefined);
  if (!rep) return <div class="card empty-page"><div><h2>No budget lines yet</h2><p>Import an approved budget or a financial report.</p><button class="btn primary" onClick={() => set({ drawer: { kind: 'report', projectId: p.id } })}>Import report</button></div></div>;
  const rows: LineV[] = rep.snapshot!.lines.map((l) => { const ex = lineExposure(l), ap = l.approved ?? 0; const nt = p.budgetNotes?.[l.code]; return { code: l.code, description: l.description ?? '', approved: ap, actual: l.actual ?? 0, committed: ex - (l.actual ?? 0), exposure: ex, used: ap ? ex / ap : 0, note: nt?.clarification, why: nt?.justification }; });
  const ro = rep.id === '__approved'; // the approved baseline is replaced by a newer approved budget, not edited
  const ed = (f: 'approved' | 'actual' | 'committed') => ro ? undefined : ({ type: 'text' as const, commit: (r: LineV, v: string) => { const x = parseAmount(v); if (x != null && x >= 0) updateLine(p.id, rep.id, r.code, { [f]: x }); } });
  const cols: Column<LineV>[] = [
    { key: 'code', label: 'Line', width: 84, pin: true, value: (r) => r.code, render: (r) => <span class="num">{r.code}</span> },
    { key: 'description', label: 'Description', width: 240, value: (r) => r.description, edit: ro ? undefined : { type: 'text', commit: (r, v) => updateLine(p.id, rep.id, r.code, { description: v }) } },
    { key: 'approved', label: 'Approved', width: 130, align: 'r', sum: true, format: full, value: (r) => r.approved, edit: ed('approved') },
    { key: 'actual', label: 'Spent', width: 130, align: 'r', sum: true, format: full, value: (r) => r.actual, edit: ed('actual') },
    { key: 'committed', label: 'Committed', width: 130, align: 'r', sum: true, format: full, value: (r) => r.committed, edit: ed('committed') },
    { key: 'used', label: 'Used', width: 180, value: (r) => r.used, render: (r) => <div class="bar-cell"><div class="minibar"><span style={{ width: `${Math.min(100, r.used * 100)}%`, background: `var(--${usedTone(r.used) === 'good' ? 'c1' : usedTone(r.used) === 'warning' ? 'warn' : usedTone(r.used)})` }} /><i style={{ left: `${elapsed(p, TODAY) * 100}%` }} /></div><span class="num" style={{ fontSize: '12px' }}>{pct(r.used)}</span></div> },
    { key: 'balance', label: 'Balance', width: 130, align: 'r', sum: true, format: full, value: (r) => r.approved - r.exposure },
    ...(p.budgetNotes ? [{ key: 'note', label: 'Clarification & justification', width: 360, value: (r: LineV) => `${r.note ?? ''} ${r.why ?? ''}`, render: (r: LineV) => (r.note || r.why) ? <span class="just" title={[r.note, r.why].filter(Boolean).join('\n\n')}>{r.note || r.why}</span> : <span class="muted">—</span> } as Column<LineV>] : []),
  ];
  return (
    <section class="card" style={{ overflow: 'hidden' }}>
      <div class="card-h" style={{ paddingBottom: '12px' }}><div><h2>{rep.name}</h2><p>{date(rep.date)} · {rep.type} · double-click a value to correct it · tick = time elapsed</p></div></div>
      <DataTable rows={rows} columns={cols} rowKey={(r) => r.code} title={`${p.code}-lines`} storageKey="pl-cols-plines" maxHeight={520} />
    </section>
  );
}

function Reports({ p }: { p: Project }) {
  const R = reportsByDate(p);
  const [a, setA] = useState(R.at(-2)?.id ?? '');
  const [b, setB] = useState(R.at(-1)?.id ?? '');
  const A = R.find((r) => r.id === a), B = R.find((r) => r.id === b);
  const D = A && B ? compareReports(A, B) : [];
  if (!R.length) return <div class="card empty-page"><div><h2>No reports yet</h2><button class="btn primary" onClick={() => set({ drawer: { kind: 'report', projectId: p.id } })}>Import report</button></div></div>;
  return (
    <div class="grid g-12">
      <section class="card span-5">
        <div class="card-h"><div><h2>Versions</h2><p>Oldest first; change is spent since the previous report</p></div></div>
        <ul class="att" style={{ marginTop: '12px' }}>
          {R.map((r, i) => {
            const t = reportTotals(r), prev = i ? reportTotals(R[i - 1]).actual : 0;
            return (
              <li style={{ cursor: 'default', gridTemplateColumns: 'auto 1fr auto auto' }}>
                <span class="badge neutral count num">{i + 1}</span>
                <div style={{ minWidth: 0 }}><div class="t">{r.name}</div><div class="d">{date(r.date)} · {r.type}{r.fileName ? ` · ${r.fileName}` : ''}</div></div>
                <div class="num" style={{ textAlign: 'right', fontSize: '13px' }}>{short(t.actual)}<div class="d" style={{ color: 'var(--ink-3)' }}>{i ? `+${short(t.actual - prev)}` : 'baseline'}</div></div>
                <button class="btn icon ghost" aria-label={`Remove ${r.name}`} title="Remove report" onClick={() => confirm(`Remove “${r.name}”? You can undo right after.`) && deleteReport(p.id, r.id)}>✕</button>
              </li>
            );
          })}
        </ul>
        <div class="card-b"><button class="btn primary" onClick={() => set({ drawer: { kind: 'report', projectId: p.id } })}>+ Import report (Excel / CSV)</button></div>
      </section>
      <section class="card span-7">
        <div class="card-h" style={{ flexWrap: 'wrap' }}><div><h2>Compare versions</h2><p>Line-by-line change in spent and approved amounts</p></div>
          <div class="tools">
            <select class="select" value={a} onChange={(e) => setA((e.target as HTMLSelectElement).value)} aria-label="From report">{R.map((r) => <option value={r.id}>{r.name}</option>)}</select>
            <span class="muted" style={{ alignSelf: 'center' }}>→</span>
            <select class="select" value={b} onChange={(e) => setB((e.target as HTMLSelectElement).value)} aria-label="To report">{R.map((r) => <option value={r.id}>{r.name}</option>)}</select>
          </div></div>
        <div class="card-b">
          {D.length > 0 && <Chart height={Math.max(180, D.length * 34 + 40)} label="Change in spend by line" option={(t) => deltaOption(t, D)} />}
          <table class="mini">
            <thead><tr><th>Line</th><th>Description</th><th class="r">Spent change</th><th class="r">Approved change</th><th /></tr></thead>
            <tbody>{D.map((d) => (
              <tr><td class="num">{d.code}</td><td>{d.description}</td>
                <td class="r num">{fmtDelta(d.actual[1] - d.actual[0])}</td>
                <td class="r num" style={{ color: d.approved[1] !== d.approved[0] ? 'var(--warn)' : 'var(--ink-3)' }}>{fmtDelta(d.approved[1] - d.approved[0])}</td>
                <td>{d.status === 'added' ? <span class="badge good">new</span> : d.status === 'removed' ? <span class="badge critical">removed</span> : d.status === 'same' ? <span class="badge neutral">same</span> : null}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
const fmtDelta = (v: number) => (Math.abs(v) < 0.5 ? '—' : `${v > 0 ? '+' : '−'}${full(Math.abs(v)).slice(0)}`);

function deltaOption(t: Tokens, D: ReturnType<typeof compareReports>) {
  return {
    ...base(t),
    grid: { left: 8, right: 64, top: 4, bottom: 4, containLabel: true },
    tooltip: { ...(base(t).tooltip as object), trigger: 'item', formatter: (x: any) => { const d = D[x.dataIndex]; return `<b>${d.code} ${d.description}</b><br/>${full(d.actual[0])} → <b>${full(d.actual[1])}</b>`; } },
    xAxis: { type: 'value', ...axisY(t), axisLabel: { ...axisY(t).axisLabel, formatter: axisMoney } },
    yAxis: { type: 'category', inverse: true, data: D.map((d) => `${d.code} ${d.description}`.slice(0, 26)), ...axisX(t), axisLabel: { color: t.ink2, fontSize: 11.5 } },
    series: [{ type: 'bar', barWidth: 14, data: D.map((d) => { const v = d.actual[1] - d.actual[0]; return { value: v, itemStyle: { color: v < 0 ? t.critical : t.c[0], borderRadius: v < 0 ? [4, 0, 0, 4] : [0, 4, 4, 0] } }; }),
      label: { show: true, position: 'right', color: t.ink2, fontFamily: t.mono, fontSize: 11, formatter: (x: any) => (x.value ? axisMoney(x.value) : '') } }],
  };
}

function Plan({ p }: { p: Project }) {
  const s = planStats(p, TODAY);
  if (!s) return <div class="card empty-page"><div><h2>No activity plan on file</h2></div></div>;
  const M = p.doa!.months;
  const groups = [...new Set(s.acts.map((a) => a.group || '—'))];
  const start = parseDate(p.doa!.start);
  const label = (mi: number) => month(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + mi - 1, 1));
  return (
    <section class="card" style={{ overflow: 'hidden' }}>
      <div class="card-h"><div><h2>Activity plan</h2><p>{s.done} of {s.total} done · {s.late} overdue (planned end passed, not done) · project month {Math.min(s.month, M)} of {M}</p></div>
        <div class="tools legend" style={{ alignSelf: 'center' }}><span><i style={{ background: 'var(--c1)', opacity: .35 }} />Preparation</span><span><i style={{ background: 'var(--c1)' }} />Implementation</span><span><i style={{ background: 'var(--c2)' }} />Extension</span><span><i class="line" style={{ background: 'var(--ink)', width: '2px', height: '10px' }} />Today</span></div></div>
      <div class="gantt-wrap">
        <div class="gantt" style={{ gridTemplateColumns: `minmax(220px, 280px) 110px repeat(${M}, minmax(14px, 1fr))` }}>
          <div class="gh">Activity</div><div class="gh">Status</div>
          {Array.from({ length: M }, (_, i) => <div class="gh gm" title={label(i + 1)}>{(i % 3 === 0) ? (label(i + 1).startsWith('Jan') || i === 0 ? label(i + 1).replace(/ 20(\d\d)$/, " '$1") : label(i + 1).slice(0, 3)) : ''}</div>)}
          {groups.map((g) => (
            <>
              <div class="gg" style={{ gridColumn: '1 / -1' }}>{g}</div>
              {s.acts.filter((a) => (a.group || '—') === g).map((a) => (
                <>
                  <div class="ga"><span class="num muted">{a.code}</span> {a.name}</div>
                  <div class="gs"><span class={`badge ${a.done ? 'good' : a.late ? 'serious' : a.status === 'In progress' ? 'warning' : 'neutral'}`}>{a.done ? 'Done' : a.late ? 'Overdue' : a.status || 'Not started'}</span></div>
                  {Array.from({ length: M }, (_, i) => {
                    const mi = i + 1, P = a.P?.includes(mi), E = a.E?.includes(mi), X = a.X?.includes(mi);
                    const k = X ? 'x' : E ? 'e' : P ? 'p' : '';
                    const prev = (m: number) => (a.X?.includes(m) ? 'x' : a.E?.includes(m) ? 'e' : a.P?.includes(m) ? 'p' : '');
                    const cls = k ? `${k}${prev(mi - 1) !== k ? ' s' : ''}${prev(mi + 1) !== k ? ' f' : ''}` : '';
                    return <div class={`gc ${cls} ${mi === s.month ? 'now' : ''}`} title={`${label(mi)}${k === 'p' ? ' · preparation' : k === 'e' ? ' · implementation' : k === 'x' ? ' · extension' : ''}`} />;
                  })}
                </>
              ))}
            </>
          ))}
        </div>
      </div>
    </section>
  );
}

function Risks({ p }: { p: Project }) {
  const R = [...(p.riskRegister ?? [])].sort((a, b) => riskScore(b) - riskScore(a));
  const open = R.filter((r) => (r.status ?? 'Open') === 'Open');
  const tone = (s: number) => (s >= 16 ? 'critical' : s >= 12 ? 'serious' : s >= 6 ? 'warning' : 'good');
  const cols: Column<Risk>[] = [
    { key: 'score', label: 'Score', width: 80, value: (r) => riskScore(r), render: (r) => <span class={`badge ${tone(riskScore(r))}`}>{riskScore(r)}</span> },
    { key: 'title', label: 'Risk', width: 220, pin: true, value: (r) => r.title },
    { key: 'category', label: 'Category', width: 120, value: (r) => r.category ?? '' },
    { key: 'l', label: 'Likelihood', width: 100, align: 'r', value: (r) => Number(r.likelihood || 0), edit: { type: 'select', options: ['1', '2', '3', '4', '5'], commit: (r, v) => upsertRisk(p.id, { ...r, likelihood: v }) } },
    { key: 'i', label: 'Impact', width: 90, align: 'r', value: (r) => Number(r.impact || 0), edit: { type: 'select', options: ['1', '2', '3', '4', '5'], commit: (r, v) => upsertRisk(p.id, { ...r, impact: v }) } },
    { key: 'status', label: 'Status', width: 100, value: (r) => r.status ?? 'Open', edit: { type: 'select', options: ['Open', 'Resolved'], commit: (r, v) => upsertRisk(p.id, { ...r, status: v }) } },
    { key: 'mitigation', label: 'Mitigation', width: 300, value: (r) => r.mitigation ?? '' },
  ];
  return (
    <div class="grid g-12">
      <section class="card span-4">
        <div class="card-h"><div><h2>Risk matrix</h2><p>{open.length} open risks by likelihood × impact</p></div></div>
        <div class="card-b">
          <div class="matrix" role="table" aria-label="Risk matrix">
            {[5, 4, 3, 2, 1].map((l) => (
              <>
                <div class="mx-ax">{l}</div>
                {[1, 2, 3, 4, 5].map((i) => {
                  const here = open.filter((r) => Number(r.likelihood) === l && Number(r.impact) === i);
                  return <div class={`mx ${tone(l * i)}`} title={here.map((r) => r.title).join('\n') || `${l} × ${i}`}>{here.length || ''}</div>;
                })}
              </>
            ))}
            <div />{[1, 2, 3, 4, 5].map((i) => <div class="mx-ax">{i}</div>)}
          </div>
          <div class="muted" style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}><span>↑ likelihood</span><span>impact →</span></div>
        </div>
      </section>
      <section class="card span-8" style={{ overflow: 'hidden' }}>
        <div class="card-h" style={{ paddingBottom: '12px' }}><div><h2>Risk register</h2><p>Double-click likelihood, impact or status to change it</p></div>
          <div class="tools"><button class="btn primary" onClick={() => set({ drawer: { kind: 'risk', projectId: p.id } })}>+ Add risk</button></div></div>
        <DataTable rows={R} columns={cols} rowKey={(r) => r.id} title={`${p.code}-risks`} storageKey="pl-cols-risks" maxHeight={420}
          onOpen={(r) => set({ drawer: { kind: 'risk', projectId: p.id, id: r.id } })}
          actions={(sel, clear) => sel.length > 0 && <button class="btn danger" onClick={() => { sel.forEach((r) => deleteRisk(p.id, r.id)); clear(); }}>Delete {sel.length}</button>} />
      </section>
    </div>
  );
}
export type { ReportingPeriod };

function ResultsDocs({ p }: { p: Project }) {
  const D = p.documents ?? [];
  const c = (p.contract ?? {}) as Record<string, unknown>;
  const facts: [string, string][] = ([['Contract', c.number], ['Title', c.title], ['Total', typeof c.total === 'number' ? full(c.total) : ''], ['EU maximum', typeof c.euMax === 'number' ? full(c.euMax) : ''], ['Duration', c.months ? `${c.months} months` : ''], ['Reporting', c.repMonths ? `every ${c.repMonths} months, due ${c.progDays ?? 60} days after` : ''], ['Pre-financing', c.prefin ? `${c.prefin}%` : '']] as [string, unknown][]).filter(([, v]) => v).map(([k, v]) => [k, String(v)]);
  return (
    <div class="grid g-12">
      <section class="card span-8">
        <div class="card-h"><div><h2>Project documents</h2><p>DoA, contract, budget annexes and logframe — what was read from each</p></div>
          <div class="tools"><button class="btn primary" onClick={() => set({ drawer: { kind: 'documents', projectId: p.id } })}>Add documents</button></div></div>
        <ul class="att" style={{ marginTop: '8px' }}>{D.map((d) => <li style={{ cursor: 'default' }}><span class="badge neutral">{d.kind}</span><div><div class="t">{d.name}</div><div class="d">{d.summary.join(' · ') || '—'} · {date(d.importedAt.slice(0, 10))}</div></div><span /></li>)}
          {!D.length && <li style={{ cursor: 'default' }}><span /><div class="d">None yet</div><span /></li>}</ul>
      </section>
      <section class="card span-4">
        <div class="card-h"><div><h2>Contract</h2><p>{facts.length ? 'Read from documents' : 'No contract read yet'}</p></div></div>
        <div class="card-b">{facts.length > 0 && <dl class="dl" style={{ gridTemplateColumns: '110px 1fr' }}>{facts.map(([k, v]) => <><dt>{k}</dt><dd>{v}</dd></>)}</dl>}</div>
      </section>
    </div>
  );
}
