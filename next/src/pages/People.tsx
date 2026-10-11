import { useState } from 'preact/hooks';
import { filtered, go, set, useStore } from '../data/store';
import { coverage, daysUntil, renewals, roster, type Base, type Person } from '../domain/staff';
import type { Project } from '../domain/types';
import { TODAY } from '../today';
import { base, Chart, type Tokens } from '../ui/Chart';
import { DataTable, type Column } from '../ui/DataTable';
import { date, month, pct } from '../ui/format';
import { axisX, axisY, Filters } from './Overview';
import { StaffReport } from './StaffReport';

export const statusTone = (s: Person['status']) => (s === 'Active' ? 'good' : s === 'Upcoming' ? 'neutral' : s === 'Ended' ? 'neutral' : 'warning');
export const daysTone = (d: number) => (d <= 30 ? 'critical' : d <= 60 ? 'serious' : 'warning');
const openContract = (a: Person) => set({ drawer: { kind: 'contract', projectId: a.project.id, key: a.key } });

export function allPeople(P: Project[]) { return P.flatMap((p) => roster(p, TODAY)); }

export function People() {
  const state = useStore((s) => s);
  const [b, setB] = useState<'all' | Base>('all');
  const P = filtered(state);
  const everyone = allPeople(P);
  const A = everyone.filter((a) => b === 'all' || a.base === b);
  return (
    <>
      <Filters />
      <div class="seg" role="group" aria-label="Base" style={{ marginBottom: '16px' }}>
        {(['all', 'Local', 'HQ'] as const).map((x) => <button aria-pressed={b === x} onClick={() => setB(x)}>{x === 'all' ? 'All staff' : x === 'HQ' ? 'SxB / HQ' : 'Local'}</button>)}
      </div>
      {!everyone.length
        ? <div class="card empty-page"><div><h2>No staff records yet</h2><p>Staff are read from the “Purchase Orders” sheet of imported financial reports (lines 1.x.1.y).</p></div></div>
        : <><StaffBoard people={A} showProject /><div class="grid g-12" style={{ marginTop: '16px' }}><StaffReport projects={P} /></div></>}
    </>
  );
}

export function StaffBoard({ people: A, showProject }: { people: Person[]; showProject?: boolean }) {
  const active = A.filter((a) => a.status === 'Active');
  const due = renewals(A, TODAY, 120);
  const review = A.filter((a) => a.review);
  const from = new Date(Date.UTC(TODAY.getUTCFullYear(), TODAY.getUTCMonth() - 6, 1));
  const C = coverage(A, from, 24);
  const fte = active.reduce((s, a) => s + (a.fte ?? 0), 0);
  return (
    <>
      <section class="hero" aria-label="Staff figures">
        <div class="kpi lead"><span class="label">Within contract today</span><span class="value">{active.length}</span>
          <span class="ctx"><b>{fte.toFixed(1)} FTE</b> · {active.filter((a) => a.base === 'Local').length} local · {active.filter((a) => a.base === 'HQ').length} SxB/HQ</span>
          <div class="spark" /></div>
        <div class="kpi"><span class="label">Renewals due ≤ 120 days {due.length > 0 && <span class={`badge ${daysTone(daysUntil(due[0].end, TODAY))}`}>{due.length}</span>}</span>
          <span class="value">{due.length}</span><span class="ctx">{due.length ? <>first: <b>{due[0].display}</b> on {date(due[0].end)}</> : 'none in the next four months'}</span></div>
        <div class="kpi"><span class="label">Records to confirm</span><span class="value" style={{ color: review.length ? 'var(--warn)' : undefined }}>{review.length}</span><span class="ctx">missing dates or unclear source rows</span></div>
        <div class="kpi"><span class="label">Starting later</span><span class="value">{A.filter((a) => a.status === 'Upcoming').length}</span><span class="ctx">contracts with a future start</span></div>
      </section>
      <div class="grid g-12">
        <section class="card span-8">
          <div class="card-h"><div><h2>Coverage by recorded contract dates</h2><p>Staff under contract at each month end · gaps show where renewals are needed</p></div></div>
          <div class="card-b">
            <div class="legend" style={{ marginBottom: '4px' }}><span><i style={{ background: 'var(--c1)' }} />Local</span><span><i style={{ background: 'var(--c7)' }} />SxB / HQ</span>{C.some((c) => c.Unassigned) && <span><i style={{ background: 'var(--plan)' }} />Unassigned</span>}</div>
            <Chart height={280} label="Staff coverage by month" option={(t) => coverageOption(t, C)} />
          </div>
        </section>
        <section class="card span-4">
          <div class="card-h"><div><h2>Renewal & handover queue</h2><p>Active contracts ending soonest</p></div></div>
          <ul class="att" style={{ marginTop: '12px', maxHeight: '330px', overflow: 'auto' }}>
            {due.map((a) => { const d = daysUntil(a.end, TODAY); return (
              <li onClick={() => openContract(a)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && openContract(a)}>
                <span class={`badge ${daysTone(d)}`}>{d} d</span>
                <div style={{ minWidth: 0 }}><div class="t">{a.display}</div><div class="d">{a.position} · ends {date(a.end)}</div></div>
                <span class="code">{a.project.code}</span>
              </li>); })}
            {review.slice(0, 6).map((a) => (
              <li onClick={() => openContract(a)}><span class="badge warning">confirm</span><div style={{ minWidth: 0 }}><div class="t">{a.display}</div><div class="d">{a.status === 'Dates missing' ? 'contract dates missing' : 'source row needs a check'}</div></div><span class="code">{a.project.code}</span></li>
            ))}
            {!due.length && !review.length && <li style={{ cursor: 'default' }}><span class="badge good">ok</span><div class="d">No renewals in the next 120 days.</div><span /></li>}
          </ul>
        </section>
        <section class="card span-12" style={{ overflow: 'hidden' }}>
          <div class="card-h" style={{ paddingBottom: '12px' }}><div><h2>Staff & positions</h2><p>Merged across all reports · click a person to see source rows and confirm contract dates</p></div></div>
          <PeopleTable rows={A} showProject={showProject} />
        </section>
      </div>
    </>
  );
}

function PeopleTable({ rows, showProject }: { rows: Person[]; showProject?: boolean }) {
  const cols: Column<Person>[] = [
    { key: 'name', label: 'Name', width: 180, pin: true, value: (a) => a.display, render: (a) => <span style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><span class={`avatar ${a.base === 'HQ' ? 'hq' : ''}`}>{a.display.split(/\s+/).filter((_, i, x) => i === 0 || i === x.length - 1).map((x) => x[0]).join('')}</span>{a.display}</span> },
    ...(showProject ? [{ key: 'project', label: 'Project', width: 96, value: (a: Person) => a.project.code, render: (a: Person) => <a class="num" href={`#/project/${a.project.id}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); go(`project/${a.project.id}`); }}>{a.project.code}</a> }] : []),
    { key: 'position', label: 'Position', width: 180, value: (a) => a.position },
    { key: 'base', label: 'Base', width: 96, value: (a) => (a.base === 'HQ' ? 'SxB / HQ' : a.base) },
    { key: 'fte', label: 'FTE', width: 70, align: 'r', value: (a) => a.fte, render: (a) => (a.fte == null ? '—' : pct(a.fte)) },
    { key: 'start', label: 'Start', width: 110, value: (a) => a.start, render: (a) => (a.start ? date(a.start) : '—') },
    { key: 'end', label: 'End', width: 110, value: (a) => a.end, render: (a) => (a.end ? date(a.end) : '—') },
    { key: 'left', label: 'Days left', width: 90, align: 'r', value: (a) => (a.status === 'Active' ? daysUntil(a.end, TODAY) : null) },
    { key: 'status', label: 'Status', width: 140, value: (a) => a.status, render: (a) => <span style={{ display: 'flex', gap: '4px' }}><span class={`badge ${statusTone(a.status)}`}>{a.status}</span>{a.override?.verified && <span class="badge good count" title="Confirmed manually">✓</span>}{a.review && <span class="badge warning count">check</span>}</span> },
    { key: 'po', label: 'PO', width: 100, value: (a) => a.po, render: (a) => <span class="num muted">{a.po}</span> },
  ];
  return <DataTable rows={rows} columns={cols} rowKey={(a) => `${a.project.id}:${a.key}`} title="staff" storageKey="pl-cols-staff" maxHeight={460}
    groupBy={[{ label: 'project', key: (a) => a.project.code }, { label: 'base', key: (a) => a.base }, { label: 'status', key: (a) => a.status }]} onOpen={openContract} />;
}

function coverageOption(t: Tokens, C: ReturnType<typeof coverage>) {
  const bar = (name: string, k: 'Local' | 'HQ' | 'Unassigned', color: string) => ({ name, type: 'bar', stack: 's', barWidth: '62%', data: C.map((c) => [c.t, c[k]]), itemStyle: { color, borderColor: t.surface, borderWidth: 1 } });
  return {
    ...base(t),
    grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
    tooltip: { ...(base(t).tooltip as object), trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (ps: any[]) => { const c = C[ps[0].dataIndex]; return `<b>${month(c.t)}</b><br/>Local ${c.Local} · SxB/HQ ${c.HQ}${c.Unassigned ? ` · unassigned ${c.Unassigned}` : ''}<br/><span style="color:${t.ink3}">${c.fte.toFixed(1)} FTE</span>`; } },
    xAxis: { type: 'time', ...axisX(t), axisLabel: { ...axisX(t).axisLabel, formatter: (v: number) => month(v) } },
    yAxis: { type: 'value', minInterval: 1, ...axisY(t), axisLabel: { ...axisY(t).axisLabel, formatter: (v: number) => String(v) } },
    series: [
      { ...bar('Local', 'Local', t.c[0]), markLine: { silent: true, symbol: 'none', label: { formatter: 'Today', color: t.ink3, fontSize: 11 }, lineStyle: { color: t.ink3, type: 'solid', width: 1 }, data: [{ xAxis: TODAY.getTime() }] } },
      bar('SxB / HQ', 'HQ', t.c[6]),
      bar('Unassigned', 'Unassigned', t.plan),
    ],
  };
}
