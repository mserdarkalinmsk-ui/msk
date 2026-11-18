import { Analysis } from './Analysis';
import { Story } from './Story';
import { CostPortfolio } from '../ui/CostPanel';
import { Outlook } from './Outlook';
import { Gaps } from './Gaps';
import { MonthlyClose } from './MonthlyClose';
import { Compare, Studio } from './Studio';
import { MonthlyPack } from './Pack';
import { Agenda } from './Agenda';
import { Deck } from './Deck';
import { HealthPage } from './Health';
import { Commitments } from './Commitments';
import { Results } from './Results';
import { MonthCompare } from './MonthCompare';
import { UnitCosts } from './UnitCosts';
import { Providers } from './Providers';
import { CashPlan } from './CashPlan';
import { EndingSoon } from './EndingSoon';
import { WorkPlans } from './WorkPlans';
import { StaffPOs } from './StaffPOs';
import { Heatmap } from './Heatmap';
import { WhatChanged } from './WhatChanged';
import { CompareProjects } from './CompareProjects';
import { BudgetCheck } from './BudgetCheck';
import { BudgetChanges } from './BudgetChanges';
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

type Tab = 'cost' | 'close' | 'transfer' | 'bcheck' | 'vs' | 'changed' | 'ending' | 'cash' | 'providers' | 'annual' | 'closure' | 'units' | 'pack' | 'deck' | 'studio' | 'compare' | 'commit' | 'changes' | 'alerts' | 'results' | 'calendar' | 'compliance' | 'health' | 'history' | 'checklist' | 'wp' | 'staffpo' | 'heat' | 'gaps' | 'outlook' | 'analysis' | 'story';
/** A tab answers one question; when two or three screens answer it, they are views of the tab (a switch above it). */
interface TabDef { label: string; views: [Tab, string][] }
const GROUPS: { label: string; tabs: TabDef[] }[] = [
  { label: 'This month', tabs: [
    { label: 'Monthly close', views: [['close', 'Monthly close']] },
    { label: 'What changed', views: [['changed', 'Since a day'], ['changes', 'Month comparison']] },
    { label: 'Monthly pack', views: [['story', 'Portfolio story'], ['pack', 'Monthly pack'], ['deck', 'Full presentation']] },
    { label: 'Project report', views: [['studio', 'Project report']] },
  ] },
  { label: 'Ahead', tabs: [
    { label: 'Analysis', views: [['analysis', 'Analysis']] },
    { label: 'Outlook', views: [['outlook', 'Outlook']] },
    { label: 'Spending on track', views: [['cost', 'Spending on track']] },
    { label: 'Cash plan', views: [['cash', 'Cash plan']] },
    { label: 'Deadlines', views: [['calendar', 'Calendar'], ['ending', 'Ending soon']] },
    { label: 'Annual plan', views: [['annual', 'Annual plan']] },
  ] },
  { label: 'Budget', tabs: [
    { label: 'Expenditure monitoring', views: [['compare', 'Expenditure monitoring']] },
    { label: 'Compare projects', views: [['heat', 'Headings heat map'], ['vs', 'Side by side']] },
    { label: 'Budget changes', views: [['transfer', 'Budget changes']] },
    { label: 'Purchase orders', views: [['commit', 'Open commitments'], ['staffpo', 'Staff POs']] },
    { label: 'Unit costs & providers', views: [['units', 'Unit costs'], ['providers', 'Service providers']] },
  ] },
  { label: 'Follow-up', tabs: [
    { label: 'Alerts', views: [['alerts', 'Alerts']] },
    { label: 'Work Plans', views: [['wp', 'Work Plans']] },
    { label: 'Results', views: [['results', 'Results'], ['compliance', 'Compliance & results']] },
    { label: 'Closure', views: [['closure', 'Closure']] },
  ] },
  { label: 'Data', tabs: [
    { label: 'Data checks', views: [['gaps', 'Missing data'], ['health', 'Data health'], ['bcheck', 'Budget check']] },
    { label: 'Change history', views: [['history', 'Change history']] },
  ] },
];
const ALL = GROUPS.flatMap((g) => g.tabs);
// Old links keep working: the executive brief is now part of the monthly pack.
const ALIAS: Record<string, Tab> = { brief: 'pack', checklist: 'close' };

export function Reports() {
  const [tab, setTab] = useState<Tab>(() => { const h = location.hash.split('/')[2] ?? ''; return ALIAS[h] ?? (ALL.some((t) => t.views.some(([k]) => k === h)) ? h as Tab : 'pack'); });
  const P = useStore((s) => filtered(s));
  const excel = () => download(`portfolio-${TODAY.toISOString().slice(0, 10)}.xlsx`, portfolioSheets(get().ledger, P, TODAY));
  const g = GROUPS.find((x) => x.tabs.some((t) => t.views.some(([k]) => k === tab)))!, cur = g.tabs.find((t) => t.views.some(([k]) => k === tab))!;
  return (
    <>
      <div class="no-print"><Filters /></div>
      <div class="tabs no-print" role="tablist">
        {GROUPS.map((x) => <button role="tab" aria-selected={x === g} onClick={() => x !== g && setTab(x.tabs[0].views[0][0])}>{x.label}</button>)}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
          <button class="btn" onClick={excel} title="All projects, budget lines, staff, alerts and calendar in one workbook">⤓ Excel</button>
          <button class="btn" onClick={() => print()}>⎙ PDF</button>
        </span>
      </div>
      <div class="subtabs no-print" role="tablist" aria-label={g.label}>{g.tabs.map((t) => <button role="tab" aria-selected={t === cur} onClick={() => t !== cur && setTab(t.views[0][0])}>{t.label}</button>)}</div>
      {cur.views.length > 1 && <div class="seg views no-print" role="group" aria-label={`${cur.label}: view`}>{cur.views.map(([k, l]) => <button aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>)}</div>}
      {tab === 'analysis' ? <Analysis /> : tab === 'story' ? <Story /> : tab === 'cost' ? <CostPortfolio /> : tab === 'gaps' ? <Gaps /> : tab === 'outlook' ? <Outlook /> : tab === 'close' ? <MonthlyClose /> : tab === 'transfer' ? <BudgetChanges /> : tab === 'bcheck' ? <BudgetCheck /> : tab === 'vs' ? <CompareProjects /> : tab === 'changed' ? <WhatChanged /> : tab === 'ending' ? <EndingSoon /> : tab === 'wp' ? <WorkPlans /> : tab === 'staffpo' ? <StaffPOs /> : tab === 'heat' ? <Heatmap /> : tab === 'cash' ? <CashPlan /> : tab === 'providers' ? <Providers /> : tab === 'annual' ? <AnnualPortfolio projects={P} /> : tab === 'closure' ? <ClosureTracker /> : tab === 'units' ? <UnitCosts /> : tab === 'commit' ? <Commitments /> : tab === 'results' ? <Results /> : tab === 'health' ? <HealthPage /> : tab === 'pack' ? <MonthlyPack /> : tab === 'deck' ? <Deck /> : tab === 'studio' ? <Studio /> : tab === 'compare' ? <Compare /> : tab === 'alerts' ? <AlertCentre projects={P} /> : tab === 'changes' ? <MonthCompare projects={P} /> : tab === 'history' ? <History /> : tab === 'compliance' ? <Compliance projects={P} /> : <Calendar />}
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
