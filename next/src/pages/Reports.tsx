import { Compare, Studio } from './Studio';
import { MonthlyPack } from './Pack';
import { Agenda } from './Agenda';
import { Deck } from './Deck';
import { HealthPage } from './Health';
import { Checklist } from './Checklist';
import { Commitments } from './Commitments';
import { Results } from './Results';
import { MonthCompare } from './MonthCompare';
import { UnitCosts } from './UnitCosts';
import { Providers } from './Providers';
import { CashPlan } from './CashPlan';
import { EndingSoon } from './EndingSoon';
import { WhatChanged } from './WhatChanged';
import { CompareProjects } from './CompareProjects';
import { ClosureTracker } from './ClosureTracker';
import { AnnualPortfolio } from './AnnualPlan';
import { useState } from 'preact/hooks';
import { filtered, useStore } from '../data/store';
import { deadlines, type Deadline } from '../domain/calc';
import { TODAY } from '../today';
import { date } from '../ui/format';
import { Filters } from './Overview';
import { AlertCentre, Compliance, History } from './Insights';
import { portfolioSheets } from '../domain/exports';
import { download } from '../ui/xlsxwrite';
import { get } from '../data/store';

type Tab = 'vs' | 'changed' | 'ending' | 'cash' | 'providers' | 'annual' | 'closure' | 'units' | 'pack' | 'deck' | 'studio' | 'compare' | 'commit' | 'changes' | 'alerts' | 'results' | 'calendar' | 'compliance' | 'health' | 'history' | 'checklist';
const GROUPS: { label: string; tabs: [Tab, string][] }[] = [
  { label: 'Summary', tabs: [['pack', 'Monthly pack'], ['deck', 'Presentation'], ['studio', 'Project report']] },
  { label: 'Finance', tabs: [['compare', 'Expenditure monitoring'], ['changes', 'Month comparison'], ['vs', 'Compare projects'], ['commit', 'Commitments'], ['cash', 'Cash plan'], ['units', 'Unit costs'], ['providers', 'Service providers'], ['annual', 'Annual plan']] },
  { label: 'Follow-up', tabs: [['checklist', 'This month'], ['changed', 'What changed'], ['ending', 'Ending soon'], ['alerts', 'Alerts'], ['results', 'Results'], ['calendar', 'Calendar'], ['compliance', 'Compliance & results'], ['closure', 'Closure']] },
  { label: 'Data', tabs: [['health', 'Data health'], ['history', 'Change history']] },
];
// Old links keep working: the executive brief is now part of the monthly pack.
const ALIAS: Record<string, Tab> = { brief: 'pack' };

export function Reports() {
  const [tab, setTab] = useState<Tab>(() => { const h = location.hash.split('/')[2] ?? ''; return ALIAS[h] ?? (GROUPS.some((g) => g.tabs.some(([k]) => k === h)) ? h as Tab : 'pack'); });
  const P = useStore((s) => filtered(s));
  const excel = () => download(`portfolio-${TODAY.toISOString().slice(0, 10)}.xlsx`, portfolioSheets(get().ledger, P, TODAY));
  const g = GROUPS.find((x) => x.tabs.some(([k]) => k === tab))!;
  return (
    <>
      <div class="no-print"><Filters /></div>
      <div class="tabs no-print" role="tablist">
        {GROUPS.map((x) => <button role="tab" aria-selected={x === g} onClick={() => x !== g && setTab(x.tabs[0][0])}>{x.label}</button>)}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
          <button class="btn" onClick={excel} title="All projects, budget lines, staff, alerts and calendar in one workbook">⤓ Excel</button>
          <button class="btn" onClick={() => print()}>⎙ PDF</button>
        </span>
      </div>
      <div class="subtabs no-print" role="tablist" aria-label={g.label}>{g.tabs.map(([k, l]) => <button role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'vs' ? <CompareProjects /> : tab === 'changed' ? <WhatChanged /> : tab === 'ending' ? <EndingSoon /> : tab === 'cash' ? <CashPlan /> : tab === 'providers' ? <Providers /> : tab === 'annual' ? <AnnualPortfolio projects={P} /> : tab === 'closure' ? <ClosureTracker /> : tab === 'units' ? <UnitCosts /> : tab === 'commit' ? <Commitments /> : tab === 'results' ? <Results /> : tab === 'health' ? <HealthPage /> : tab === 'checklist' ? <Checklist /> : tab === 'pack' ? <MonthlyPack /> : tab === 'deck' ? <Deck /> : tab === 'studio' ? <Studio /> : tab === 'compare' ? <Compare /> : tab === 'alerts' ? <AlertCentre projects={P} /> : tab === 'changes' ? <MonthCompare projects={P} /> : tab === 'history' ? <History /> : tab === 'compliance' ? <Compliance projects={P} /> : <Calendar />}
    </>
  );
}

function Calendar() {
  const s = useStore((x) => x);
  const P = filtered(s);
  const D = P.flatMap((p) => deadlines(p, TODAY)).sort((a, b) => a.due.localeCompare(b.due));
  const open = D.filter((d) => d.status !== 'submitted');
  const n = (st: Deadline['status']) => D.filter((d) => d.status === st).length;
  return (
    <>
      <section class="hero" aria-label="Reporting deadlines">
        <div class="kpi lead"><span class="label">Overdue reports</span><span class="value" style={{ color: n('overdue') ? 'var(--critical)' : undefined }}>{n('overdue')}</span><span class="ctx">period ended, no report on file after the due date</span></div>
        <div class="kpi"><span class="label">Due within 60 days</span><span class="value">{n('due')}</span><span class="ctx">{open.find((d) => d.status === 'due') ? <>next: <b>{open.find((d) => d.status === 'due')!.project.code}</b> on {date(open.find((d) => d.status === 'due')!.due)}</> : 'nothing imminent'}</span></div>
        <div class="kpi"><span class="label">Later</span><span class="value">{n('upcoming')}</span><span class="ctx">scheduled until the final reports</span></div>
        <div class="kpi"><span class="label">Submitted</span><span class="value">{n('submitted')}</span><span class="ctx">periods covered by a report on file</span></div>
      </section>
      <div style={{ marginTop: '16px' }}><Agenda /></div>
    </>
  );
}
