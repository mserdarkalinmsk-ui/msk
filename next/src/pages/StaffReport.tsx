import { useState } from 'preact/hooks';
import { set } from '../data/store';
import { staffCosts, staffLines, type StaffCost, type StaffLine } from '../domain/staffreport';
import type { Project } from '../domain/types';
import { TODAY } from '../today';
import { DataTable, type Column } from '../ui/DataTable';
import { full, pct } from '../ui/format';

const m1 = (x: number) => (x ? x.toFixed(x % 1 ? 1 : 0) : '–');

/** Staff report: cost per person and staff budget lines (months budgeted / used / needed). */
export function StaffReport({ projects }: { projects: Project[] }) {
  const [view, setView] = useState<'lines' | 'people'>('lines');
  const L = projects.flatMap((p) => staffLines(p, TODAY));
  const C = projects.flatMap((p) => staffCosts(p, TODAY));
  const short = L.filter((x) => x.budgetMonths && x.gap < -0.5);
  return (
    <section class="card span-12" style={{ overflow: 'hidden' }}>
      <div class="card-h" style={{ alignItems: 'center', paddingBottom: '12px' }}>
        <div><h2>Staff report</h2><p>{view === 'lines' ? 'Staff budget lines: months budgeted, used and still needed for the people on each line until the project ends' : 'Cost per person from contract (PO) and payroll (GL) rows of the imported reports'}{short.length ? ` · ${short.length} line${short.length > 1 ? 's' : ''} short of months` : ''}</p></div>
        <div class="tools"><div class="seg"><button aria-pressed={view === 'lines'} onClick={() => setView('lines')}>Staff lines</button><button aria-pressed={view === 'people'} onClick={() => setView('people')}>Cost per person</button></div></div>
      </div>
      {view === 'lines' ? <LinesT rows={L} multi={projects.length > 1} /> : <PeopleT rows={C} multi={projects.length > 1} />}
    </section>
  );
}

function LinesT({ rows, multi }: { rows: StaffLine[]; multi: boolean }) {
  const cols: Column<StaffLine>[] = [
    ...(multi ? [{ key: 'p', label: 'Project', width: 90, pin: true, value: (x: StaffLine) => x.project.code, render: (x: StaffLine) => <b class="num">{x.project.code}</b> }] : []),
    { key: 'c', label: 'Line', width: 76, pin: !multi, value: (x) => x.code, render: (x) => <span class="num">{x.code}</span> },
    { key: 'd', label: 'Position', width: 200, value: (x) => x.description },
    { key: 'pe', label: 'People on line', width: 200, value: (x) => x.people.join(', '), render: (x) => x.people.length ? <span title={x.people.join('\n')}>{x.people.join(', ')}</span> : <span class="muted">vacant</span> },
    { key: 'bm', label: 'Budget months', width: 110, align: 'r', sum: true, format: m1, value: (x) => x.budgetMonths },
    { key: 'um', label: 'Used', width: 80, align: 'r', sum: true, format: m1, value: (x) => x.usedMonths },
    { key: 'rm', label: 'Remaining', width: 96, align: 'r', sum: true, format: m1, value: (x) => x.remainingMonths },
    { key: 'nd', label: 'Needed to end', width: 110, align: 'r', sum: true, format: m1, value: (x) => x.need, render: (x) => <span title={`${x.fteOnLine} FTE × ${x.monthsToEnd.toFixed(1)} months`}>{m1(x.need)}</span> },
    { key: 'g', label: 'Months gap', width: 110, align: 'r', value: (x) => x.gap, render: (x) => !x.budgetMonths ? '–' : <span class={`badge ${x.gap < -0.5 ? 'critical' : x.gap > 3 ? 'neutral' : 'good'}`}>{x.gap > 0 ? '+' : ''}{x.gap.toFixed(1)}</span> },
    { key: 'br', label: 'Budget rate', width: 106, align: 'r', format: full, value: (x) => x.budgetRate || null },
    { key: 'ar', label: 'Actual rate', width: 106, align: 'r', value: (x) => x.actualRate || null, render: (x) => !x.actualRate ? '–' : <span style={{ color: x.budgetRate && x.actualRate > x.budgetRate * 1.15 ? 'var(--warn)' : undefined, fontWeight: x.budgetRate && x.actualRate > x.budgetRate * 1.15 ? 700 : undefined }}>{full(x.actualRate)}</span> },
    { key: 'b', label: 'Budget €', width: 110, align: 'r', sum: true, format: full, value: (x) => x.budget },
    { key: 's', label: 'Spent + committed', width: 130, align: 'r', sum: true, format: full, value: (x) => x.sc },
    { key: 'u', label: 'Used', width: 70, align: 'r', value: (x) => (x.budget ? x.sc / x.budget : 0), render: (x) => pct(x.budget ? x.sc / x.budget : 0) },
  ];
  return rows.length ? <DataTable rows={rows} columns={cols} rowKey={(x) => x.project.id + x.code} title="staff-lines" storageKey="pl-cols-stafflines" maxHeight={460} groupBy={[{ label: 'project', key: (x) => x.project.code }]} />
    : <div class="dt-empty">No staff budget lines (1.x.1.y) in the latest reports — import a financial report workbook.</div>;
}

function PeopleT({ rows, multi }: { rows: StaffCost[]; multi: boolean }) {
  const cols: Column<StaffCost>[] = [
    { key: 'n', label: 'Name', width: 180, pin: true, value: (x) => x.person.display },
    ...(multi ? [{ key: 'p', label: 'Project', width: 90, value: (x: StaffCost) => x.person.project.code }] : []),
    { key: 'c', label: 'Line', width: 76, value: (x) => x.person.code, render: (x) => <span class="num muted">{x.person.code}</span> },
    { key: 'pos', label: 'Position', width: 170, value: (x) => x.person.position },
    { key: 'b', label: 'Base', width: 86, value: (x) => (x.person.base === 'HQ' ? 'SxB / HQ' : x.person.base) },
    { key: 'f', label: 'FTE', width: 64, align: 'r', value: (x) => x.person.fte, render: (x) => (x.person.fte == null ? '–' : pct(x.person.fte)) },
    { key: 'k', label: 'Contracts', width: 86, align: 'r', value: (x) => x.contracts },
    { key: 'm', label: 'Months paid', width: 100, align: 'r', sum: true, format: m1, value: (x) => x.payrollMonths },
    { key: 's', label: 'Spent', width: 110, align: 'r', sum: true, format: full, value: (x) => x.spent },
    { key: 'cm', label: 'Committed', width: 110, align: 'r', sum: true, format: full, value: (x) => x.committed },
    { key: 'mo', label: 'Avg / month', width: 106, align: 'r', value: (x) => x.monthly, format: full },
    { key: 'e', label: 'Contract end', width: 110, value: (x) => x.person.end || '' },
  ];
  return rows.length ? <DataTable rows={rows} columns={cols} rowKey={(x) => x.person.project.id + x.person.key} title="staff-costs" storageKey="pl-cols-staffcost" maxHeight={460}
    groupBy={[{ label: 'project', key: (x) => x.person.project.code }, { label: 'base', key: (x) => x.person.base }, { label: 'line', key: (x) => x.person.code }]}
    onOpen={(x) => set({ drawer: { kind: 'contract', projectId: x.person.project.id, key: x.person.key } })} />
    : <div class="dt-empty">No staff records yet.</div>;
}
