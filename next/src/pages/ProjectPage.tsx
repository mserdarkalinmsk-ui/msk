import { ScenarioCompare } from './ScenarioCompare';
import { Closure, Revision } from './Closure';
import { useEffect, useRef, useState } from 'preact/hooks';
import { deleteProjects, deleteReport, deleteRisk, go, set, updateLine, updateProject, upsertRisk, useStore } from '../data/store';
import { category, burnGap, compareReports, elapsed, lineExposure, money, parseDate, planStats, reportsByDate, reportTotals, riskScore, spendPoints } from '../domain/calc';
import { validUrl, type Project, type ReportingPeriod, type Risk } from '../domain/types';
import { TODAY } from '../today';
import { base, Chart, type Tokens } from '../ui/Chart';
import { parseAmount } from '../ui/csv';
import { DataTable, type Column } from '../ui/DataTable';
import { date, full, month, pct, period, short, signedPct } from '../ui/format';
import { axisMoney, axisX, axisY } from './Overview';
import { usedTone } from './Budget';
import { StaffBoard } from './People';
import { StaffPlanCard } from './StaffPlan';
import { AnnualPlanCard } from './AnnualPlan';
import { StaffReport } from './StaffReport';
import { FinancialReport } from './FinancialReport';
import { roster } from '../domain/staff';
import { Indicators, Justification } from './Logframe';
import { Cockpit, IdentityCard } from './Cockpit';
import { ForecastCard, HeadingsCard, ReadinessCard, History, Scenario, StatusWords } from './Insights';
import { alerts } from '../domain/insights';
import { projectSheets } from '../domain/exports';
import { download } from '../ui/xlsxwrite';
import { ProjectForesight } from './Depletion';

const TABS = ['Summary', 'Financial report', 'Budget lines', 'Annual plan', 'Scenario', 'Revision', 'Closure', 'Reports', 'Staff', 'Activity plan', 'Indicators', 'Justification', 'Risks', 'Results & documents', 'History'] as const;
type Tab = (typeof TABS)[number];
/** Tabs grouped so the bar fits: a group's first tab opens when the group is chosen. */
const GROUPS: { label: string; tabs: Tab[] }[] = [
  { label: 'Summary', tabs: ['Summary'] },
  { label: 'Finance', tabs: ['Financial report', 'Budget lines', 'Annual plan', 'Justification', 'Scenario', 'Revision', 'Reports', 'Closure'] },
  { label: 'Results', tabs: ['Indicators', 'Activity plan', 'Risks'] },
  { label: 'Staff', tabs: ['Staff'] },
  { label: 'Documents', tabs: ['Results & documents', 'History'] },
];
const LABEL: Partial<Record<Tab, string>> = { 'Results & documents': 'Documents' };

export function ProjectPage({ id }: { id: string }) {
  const p = useStore((s) => s.ledger.projects.find((x) => x.id === id));
  const countries = useStore((s) => s.ledger.countries);
  const [tab, setTab] = useState<Tab>('Summary');
  useEffect(() => { const h = (e: Event) => setTab((e as CustomEvent).detail as Tab); addEventListener('pl-tab', h); return () => removeEventListener('pl-tab', h); }, []);
  if (!p) return <div class="card empty-page"><div><h2>Project not found</h2><p>It may have been deleted.</p><button class="btn" onClick={() => go('projects')}>All projects</button></div></div>;
  const m = money(p), el = elapsed(p, TODAY), gap = burnGap(p, TODAY);
  const reports = reportsByDate(p);
  const plan = planStats(p, TODAY);
  const counts: Partial<Record<Tab, number>> = { 'Budget lines': reportsByDate(p).at(-1)?.snapshot?.lines.length, Reports: reports.length, Staff: roster(p, TODAY).length, 'Activity plan': plan?.total, Risks: p.riskRegister?.length, Indicators: p.indicators?.length, Justification: Object.keys(p.budgetNotes ?? {}).length || undefined, 'Results & documents': p.documents?.length };
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
      <section class="hero ph-tiles" aria-label="Project figures">
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
      {tab === 'Staff' && (roster(p, TODAY).length ? <><StaffBoard people={roster(p, TODAY)} /><div class="grid g-12" style={{ marginTop: '16px' }}><StaffPlanCard p={p} /><StaffReport projects={[p]} /></div></> : <div class="card empty-page"><div><h2>No staff records</h2><p>Import a report workbook with a “Purchase Orders” sheet.</p></div></div>)}
      {tab === 'Activity plan' && <Plan p={p} />}
      {tab === 'Risks' && <Risks p={p} />}
      {tab === 'Results & documents' && <ResultsDocs p={p} />}
      {tab === 'Indicators' && <Indicators p={p} />}
      {tab === 'Justification' && <Justification p={p} />}
      {tab === 'Annual plan' && <AnnualPlanCard p={p} />}
      {tab === 'Scenario' && <><ScenarioCompare p={p} /><div style={{ marginTop: '16px' }} /><ProjectForesight p={p} /><div style={{ marginTop: '16px' }}><Scenario p={p} /></div></>}
      {tab === 'Revision' && <div class="grid g-12"><Revision p={p} /></div>}
      {tab === 'Closure' && <Closure p={p} />}
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
      <Cockpit p={p} />
      <Attention flags={flags} pid={p.id} />
      {p.datesTbc && <StatusWords p={p} />}
      <ForecastCard p={p} />
      <section class="card span-8">
        <div class="card-h"><div><h2>Cumulative spend vs linear plan</h2><p>One point per financial report · click a month for its breakdown</p></div></div>
        <div class="card-b"><Chart height={300} label="Project spend over time" onAxisClick={(x) => {
          const d = new Date(x), t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0), from = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0);
          set({ drawer: { kind: 'period', t, from, ids: [p.id] } });
        }} option={(t) => ({
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
      <IdentityCard p={p} />
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
  if (!R.length) return <div class="card empty-page"><div><h2>No reports yet</h2><p>Drop one or many report workbooks — they are ordered by the date inside each report.</p><button class="btn primary" onClick={() => set({ drawer: { kind: 'report', projectId: p.id } })}>Import reports</button></div></div>;
  return (
    <div class="grid g-12">
      <ReportTimeline p={p} />
      <section class="card span-5">
        <div class="card-h"><div><h2>Versions</h2><p>Oldest first; change is spent since the previous report</p></div></div>
        <ul class="att" style={{ marginTop: '12px', maxHeight: '440px', overflow: 'auto' }}>
          {R.map((r, i) => {
            const t = reportTotals(r), prev = i ? reportTotals(R[i - 1]).actual : 0;
            return (
              <li style={{ cursor: 'default', gridTemplateColumns: 'auto 1fr auto auto' }}>
                <span class="badge neutral count num">{i + 1}</span>
                <div style={{ minWidth: 0 }}><div class="t">{r.name}</div><div class="d">{date(r.date)} · {r.type}{r.fileName ? ` · ${r.fileName}` : ''}</div></div>
                <div class="num" style={{ textAlign: 'right', fontSize: '13px' }}>{short(t.actual)}<div class="d" style={{ color: 'var(--ink-3)' }}>{i ? `${t.actual - prev < 0 ? "" : "+"}${short(t.actual - prev)}` : 'baseline'}</div></div>
                <button class="btn icon ghost" aria-label={`Remove ${r.name}`} title="Remove report" onClick={() => confirm(`Remove “${r.name}”? You can undo right after.`) && deleteReport(p.id, r.id)}>✕</button>
              </li>
            );
          })}
        </ul>
        <div class="card-b"><button class="btn primary" onClick={() => set({ drawer: { kind: 'report', projectId: p.id } })}>+ Import reports (one or many)</button></div>
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

const STATUSES = ['', 'In progress', 'Done'] as const;
function Plan({ p }: { p: Project }) {
  const s = planStats(p, TODAY);
  const [zoom, setZoom] = useState<number>(() => Number(localStorage.getItem('pl-gantt-zoom')) || 26);
  const [show, setShow] = useState<'all' | 'late' | 'open' | 'done'>('all');
  const [nameW, setNameW] = useState(320);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => { // start scrolled to a few months before today
    const el = wrap.current; if (el && s) el.scrollLeft = Math.max(0, (s.month - 4) * zoom);
  }, [zoom]);
  if (!s) return <div class="card empty-page"><div><h2>No activity plan on file</h2><p>Add the Description of Action; the action plan is read from it.</p><button class="btn primary" onClick={() => set({ drawer: { kind: 'documents', projectId: p.id } })}>Add documents</button></div></div>;
  const M = p.doa!.months;
  const start = parseDate(p.doa!.start);
  const mdate = (mi: number) => new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + mi - 1, 1));
  const label = (mi: number) => month(mdate(mi).getTime());
  const setZ = (z: number) => { setZoom(z); try { localStorage.setItem('pl-gantt-zoom', String(z)); } catch { /* ignore */ } };
  const acts = s.acts.filter((a) => show === 'all' || (show === 'late' ? a.late : show === 'done' ? a.done : !a.done));
  const groups = [...new Set(acts.map((a) => a.group || '—'))];
  const setStatus = (code: string) => updateProject(p.id, { doa: { ...p.doa!, acts: p.doa!.acts.map((x) => x.code === code ? { ...x, status: STATUSES[(STATUSES.indexOf((x.status ?? '') as never) + 1) % STATUSES.length] } : x) } });
  // year bands for the two-row header
  const years: { y: number; from: number; n: number }[] = [];
  for (let i = 1; i <= M; i++) { const y = mdate(i).getUTCFullYear(); const last = years.at(-1); if (last && last.y === y) last.n++; else years.push({ y, from: i, n: 1 }); }
  const cols = `${nameW}px 112px repeat(${M}, ${zoom}px)`;
  const mlabel = (i: number) => { const t = label(i); return zoom >= 34 ? t.slice(0, 3) : zoom >= 20 ? t.slice(0, 1) : ''; };
  return (
    <section class="card" style={{ overflow: 'hidden' }}>
      <div class="card-h"><div><h2>Activity plan</h2><p>{s.done} of {s.total} done · {s.late} overdue · project month {Math.min(s.month, M)} of {M} · click a status to change it · scroll sideways or Shift + wheel</p></div>
        <div class="tools" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div class="seg" role="group" aria-label="Show">{(['all', 'open', 'late', 'done'] as const).map((k) => <button aria-pressed={show === k} onClick={() => setShow(k)}>{k === 'all' ? `All ${s.total}` : k === 'open' ? 'Open' : k === 'late' ? `Overdue ${s.late}` : `Done ${s.done}`}</button>)}</div>
          <div class="seg" role="group" aria-label="Zoom">{[[12, 'Years'], [26, 'Quarters'], [44, 'Months']].map(([z, l]) => <button aria-pressed={zoom === z} onClick={() => setZ(z as number)}>{l}</button>)}</div>
          <button class="btn ghost" title="Wider activity names" onClick={() => setNameW(nameW >= 480 ? 260 : nameW + 110)}>↔ Names</button>
        </div></div>
      <div class="tools legend" style={{ padding: '6px 20px 0' }}><span><i style={{ background: 'var(--c1)', opacity: .35 }} />Preparation</span><span><i style={{ background: 'var(--c1)' }} />Implementation</span><span><i style={{ background: 'var(--c2)' }} />Extension</span><span><i class="line" style={{ background: 'var(--critical)', width: '2px', height: '10px' }} />Today</span></div>
      <div class="gantt-wrap" ref={wrap}>
        <div class="gantt" style={{ gridTemplateColumns: cols, width: 'max-content' }}>
          <div class="gh gsticky g0" style={{ gridRow: 'span 2' }}>Activity</div><div class="gh gsticky g1" style={{ gridRow: 'span 2', left: `${nameW}px` }}>Status</div>
          {years.map((y) => <div class="gh gy" style={{ gridColumn: `span ${y.n}` }}>{y.n * zoom > 40 ? y.y : ''}</div>)}
          {Array.from({ length: M }, (_, i) => <div class={`gh gm ${i + 1 === s.month ? 'today' : ''}`} title={label(i + 1)}>{mlabel(i + 1)}</div>)}
          {groups.map((g) => (
            <>
              <div class="gg gsticky g0" style={{ gridColumn: 'span 2', width: `${nameW + 112}px` }}>{g}</div><div class="gg" style={{ gridColumn: `span ${M}` }} />
              {acts.filter((a) => (a.group || '—') === g).map((a) => (
                <>
                  <div class="ga gsticky g0" title={`${a.code} ${a.name}`}><span class="num muted">{a.code}</span> {a.name}</div>
                  <div class="gs gsticky g1" style={{ left: `${nameW}px` }}><button class={`badge ${a.done ? 'good' : a.late ? 'serious' : a.status === 'In progress' ? 'warning' : 'neutral'}`} onClick={() => setStatus(a.code)} title="Click to change">{a.done ? 'Done' : a.late ? 'Overdue' : a.status || 'Not started'}</button></div>
                  {Array.from({ length: M }, (_, i) => {
                    const mi = i + 1, P = a.P?.includes(mi), E = a.E?.includes(mi), X = a.X?.includes(mi);
                    const k = X ? 'x' : E ? 'e' : P ? 'p' : '';
                    const prev = (m: number) => (a.X?.includes(m) ? 'x' : a.E?.includes(m) ? 'e' : a.P?.includes(m) ? 'p' : '');
                    const cls = k ? `${k}${prev(mi - 1) !== k ? ' s' : ''}${prev(mi + 1) !== k ? ' f' : ''}` : '';
                    return <div class={`gc ${cls} ${mi === s.month ? 'now' : ''} ${mdate(mi).getUTCMonth() === 0 ? 'ny' : ''}`} title={`${a.code} · ${label(mi)}${k === 'p' ? ' · preparation' : k === 'e' ? ' · implementation' : k === 'x' ? ' · extension' : ''}`} />;
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
    { key: 'score', label: 'Score', width: 70, align: 'r', value: (r) => riskScore(r) },
    { key: 'title', label: 'Risk', width: 320, pin: true, value: (r) => r.title, render: (r) => <span title={r.title}>{r.title}</span> },
    { key: 'rating', label: 'Rating', width: 96, value: (r) => riskScore(r), render: (r) => { const s = riskScore(r); return <span class={`badge ${tone(s)}`}>{s >= 16 ? 'very high' : s >= 12 ? 'high' : s >= 6 ? 'medium' : 'low'}</span>; } },
    { key: 'category', label: 'Category', width: 120, value: (r) => r.category ?? '' },
    { key: 'l', label: 'Likelihood', width: 100, align: 'r', value: (r) => Number(r.likelihood || 0), edit: { type: 'select', options: ['1', '2', '3', '4', '5'], commit: (r, v) => upsertRisk(p.id, { ...r, likelihood: v }) } },
    { key: 'i', label: 'Impact', width: 90, align: 'r', value: (r) => Number(r.impact || 0), edit: { type: 'select', options: ['1', '2', '3', '4', '5'], commit: (r, v) => upsertRisk(p.id, { ...r, impact: v }) } },
    { key: 'status', label: 'Status', width: 100, value: (r) => r.status ?? 'Open', edit: { type: 'select', options: ['Open', 'Resolved'], commit: (r, v) => upsertRisk(p.id, { ...r, status: v }) } },
    { key: 'mitigation', label: 'Mitigation', width: 300, value: (r) => (r.mitigation ?? '').replace(/[\uE000-\uF8FF]/g, '').replace(/\s+/g, ' ').trim() },
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
          <div class="tools" style={{ display: 'flex', gap: '6px' }}><button class="btn" onClick={() => set({ drawer: { kind: 'documents', projectId: p.id } })}>Read from DoA</button><button class="btn primary" onClick={() => set({ drawer: { kind: 'risk', projectId: p.id } })}>+ Add risk</button></div></div>
        <DataTable rows={R} columns={cols} rowKey={(r) => r.id} title={`${p.code}-risks`} storageKey="pl-cols-risks" maxHeight={420}
          onOpen={(r) => set({ drawer: { kind: 'risk', projectId: p.id, id: r.id } })}
          actions={(sel, clear) => sel.length > 0 && <button class="btn danger" onClick={() => { sel.forEach((r) => deleteRisk(p.id, r.id)); clear(); }}>Delete {sel.length}</button>} />
      </section>
      {(p.assumptions?.length ?? 0) > 0 && (
        <section class="card span-12">
          <div class="card-h"><div><h2>Assumptions</h2><p>From the DoA risk analysis · these must hold for the action to succeed</p></div></div>
          <ol class="assume">{p.assumptions!.map((a) => <li>{a}</li>)}</ol>
        </section>
      )}
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

/** All reports of a project over time — as a chart, a table, or spending per budget heading. */
function ReportTimeline({ p }: { p: Project }) {
  const [view, setView] = useState<'chart' | 'table' | 'heading'>(() => (localStorage.getItem('pl-rt-view') as 'chart') || 'chart');
  const pick = (v: typeof view) => { setView(v); try { localStorage.setItem('pl-rt-view', v); } catch { /* ignore */ } };
  const R = reportsByDate(p).filter((r) => r.snapshot?.lines.length);
  const budget = money(p).budget;
  const rows = R.map((r, i) => {
    const t = reportTotals(r), prev = i ? reportTotals(R[i - 1]) : null;
    const months = prev ? (parseDate(r.date).getTime() - parseDate(R[i - 1].date).getTime()) / 2_629_800_000 : (parseDate(r.date).getTime() - parseDate(p.start).getTime()) / 2_629_800_000;
    const delta = t.actual - (prev?.actual ?? 0);
    return { r, t, delta, months, rate: months > 0 ? delta / months : 0 };
  });
  const H = [...new Set(R.flatMap((r) => r.snapshot!.lines.map((l) => category({ code: l.code, description: l.description ?? '' }))))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const byHead = (r: ReportingPeriod, h: string) => { const L = r.snapshot!.lines.filter((l) => category({ code: l.code, description: l.description ?? '' }) === h); return { spent: L.reduce((s, l) => s + (l.actual ?? 0), 0), approved: L.reduce((s, l) => s + (l.approved ?? 0), 0) }; };
  if (R.length < 1) return null;
  return (
    <section class="card span-12" style={{ overflow: 'hidden' }}>
      <div class="card-h"><div><h2>Reports over time</h2><p>{R.length} report{R.length > 1 ? 's' : ''} ordered by report date · {date(R[0].date)} → {date(R.at(-1)!.date)}</p></div>
        <div class="seg" style={{ marginLeft: 'auto' }} role="group" aria-label="View">{([['chart', 'Chart'], ['table', 'Table'], ['heading', 'By heading']] as const).map(([k, l]) => <button aria-pressed={view === k} onClick={() => pick(k)}>{l}</button>)}</div></div>
      {view === 'chart' && <div class="card-b"><Chart height={320} label="Spending per report" option={(t) => ({
        ...base(t), grid: { left: 8, right: 16, top: 36, bottom: 8, containLabel: true },
        legend: { top: 0, left: 0, textStyle: { color: t.ink2 }, itemWidth: 12, itemHeight: 8 },
        tooltip: { ...(base(t).tooltip as object), trigger: 'axis', valueFormatter: (v: number) => full(v) },
        xAxis: { type: 'category', data: rows.map((x) => date(x.r.date)), ...axisX(t) },
        yAxis: { type: 'value', ...axisY(t), axisLabel: { ...axisY(t).axisLabel, formatter: axisMoney } },
        dataZoom: rows.length > 12 ? [{ type: 'inside' }, { type: 'slider', height: 16, bottom: 0 }] : [],
        series: [
          { name: 'Spent in period', type: 'bar', data: rows.map((x) => Math.round(x.delta)), itemStyle: { color: t.c[0], opacity: 0.35, borderRadius: [3, 3, 0, 0] }, barMaxWidth: 28 },
          { name: 'Spent (cumulative)', type: 'line', data: rows.map((x) => Math.round(x.t.actual)), symbolSize: 7, lineStyle: { width: 2.5, color: t.c[0] }, itemStyle: { color: t.c[0] } },
          { name: 'Spent + committed', type: 'line', data: rows.map((x) => Math.round(x.t.exposure)), symbolSize: 5, lineStyle: { width: 1.5, type: 'dashed', color: t.c[1] }, itemStyle: { color: t.c[1] },
            markLine: budget ? { silent: true, symbol: 'none', label: { formatter: 'Budget', color: t.ink3, fontSize: 11 }, lineStyle: { color: t.ink3, type: 'dotted' }, data: [{ yAxis: budget }] } : undefined },
        ],
      })} /></div>}
      {view === 'table' && <div class="card-b table-scroll" style={{ maxHeight: '480px', overflow: 'auto' }}>
        <table class="mini rt">
          <thead><tr><th>Report date</th><th>Report</th><th class="r">Spent</th><th class="r">Change</th><th class="r">Per month</th><th class="r">Committed</th><th class="r">Spent + committed</th><th>Use of budget</th></tr></thead>
          <tbody>{rows.map((x) => (
            <tr><td class="num" style={{ whiteSpace: 'nowrap' }}>{date(x.r.date)}</td><td>{x.r.name}<div class="muted" style={{ fontSize: '11.5px' }}>{x.r.fileName}</div></td>
              <td class="r num">{full(x.t.actual)}</td><td class="r num" style={{ color: x.delta < 0 ? 'var(--serious)' : undefined }}>{fmtDelta(x.delta)}</td><td class="r num">{full(x.rate)}</td>
              <td class="r num">{full(x.t.committed)}</td><td class="r num">{full(x.t.exposure)}</td>
              <td style={{ minWidth: '140px' }}><div class="delta-bar"><span style={{ width: `${Math.min(100, budget ? x.t.exposure / budget * 100 : 0)}%`, background: 'var(--c1)' }} /><b class="num">{pct(budget ? x.t.exposure / budget : 0)}</b></div></td></tr>))}</tbody>
        </table></div>}
      {view === 'heading' && <div class="card-b table-scroll" style={{ overflow: 'auto' }}>
        <table class="mini rt rh">
          <thead><tr><th class="stick">Heading</th>{R.map((r) => <th class="r num">{date(r.date)}</th>)}</tr></thead>
          <tbody>{H.map((h) => <tr><td class="stick"><b>{h}</b></td>{R.map((r) => { const v = byHead(r, h), u = v.approved ? v.spent / v.approved : 0; return <td class="r num" style={{ background: `color-mix(in srgb, var(--c1) ${Math.round(Math.min(1, u) * 45)}%, transparent)` }} title={`${full(v.spent)} of ${full(v.approved)}`}>{pct(u)}</td>; })}</tr>)}</tbody>
        </table><p class="muted" style={{ fontSize: '12px' }}>Share of each heading's budget spent at each report date.</p></div>}
    </section>
  );
}

/** Needs attention: full width, worst first, repeated kinds (e.g. contract ends) folded into one row. */
function Attention({ flags, pid }: { flags: ReturnType<typeof alerts>; pid: string }) {
  const order = { critical: 0, serious: 1, warning: 2, info: 3 } as Record<string, number>;
  const G = new Map<string, { sev: string; title: string; detail: string; n: number; names: string[]; kind: string; ids: string[] }>();
  for (const f of [...flags].sort((a, b) => order[a.severity] - order[b.severity])) {
    const m = f.title.match(/^([^:]+):\s*(.+)$/), k = m ? m[1] : f.id;
    const g = G.get(k);
    if (g) { g.ids.push(f.id); g.n++; g.names.push(m ? m[2] : f.title); g.title = `${m ? m[1] : f.title} · ${g.n}${/contract/i.test(k) ? " people" : ""}`; }
    else G.set(k, { sev: f.severity, title: f.title, detail: f.detail, n: 1, names: [m ? m[2] : f.title], kind: f.kind, ids: [f.id] });
  }
  const rows = [...G.values()];
  for (const g of rows) if (g.n > 1) g.detail = g.names.join(', ') + ' · ' + g.detail.replace(/^[^·]*·\s*/, '');
  return (
    <section class="card span-12 attn">
      <div class="card-h"><div><h2>Needs attention</h2><p>{flags.length ? `${flags.length} items, most serious first` : 'Nothing flagged — within all thresholds'}</p></div></div>
      {rows.length > 0 && <ul class="attn-g">{rows.map((g) => <li class={`sev-${g.sev}`} tabIndex={0} role="button" onClick={() => set({ drawer: { kind: 'alert', projectId: pid, alertKind: g.kind, ids: g.ids } })} onKeyDown={(e) => e.key === 'Enter' && set({ drawer: { kind: 'alert', projectId: pid, alertKind: g.kind, ids: g.ids } })}><span class={`badge ${g.sev}`}>{g.sev}</span><div><b>{g.title}</b><small>{g.detail}</small></div></li>)}</ul>}
    </section>
  );
}
