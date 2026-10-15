function EnterprisePortfolioTable({model,countries}) {
  const [sort,setSort]=N('priority'),[visible,setVisible]=N(12);
  const rows=[...model.rows].sort((a,b)=>sort==='budget'?(b.budget??-Infinity)-(a.budget??-Infinity):sort==='name'?a.project.name.localeCompare(b.project.name):Number(a.actual!=null)-Number(b.actual!=null)||(b.age??Infinity)-(a.age??Infinity)||a.project.code.localeCompare(b.project.code));
  return e('section',{class:'ex-panel',children:[
    e('div',{class:'ex-section-head',children:[e('div',{children:[e('p',{class:'ex-eyebrow',children:'Portfolio review'}),e('h2',{children:'Projects, with uncertainty in view'}),e('p',{class:'ex-muted',children:'Open a project for evidence, decisions and retained editing tools.'})]}),e('label',{class:'ex-inline-label',children:['Order',e('select',{value:sort,onChange:event=>setSort(event.target.value),children:[e('option',{value:'priority',children:'Evidence needs first'}),e('option',{value:'budget',children:'Budget: high to low'}),e('option',{value:'name',children:'Project name'})]})]})]}),
    e('div',{class:'ex-project-grid',children:rows.slice(0,visible).map(row=>e('article',{class:'ex-project-card',key:row.project.id,children:[
      e('div',{class:'ex-project-meta',children:[e('span',{class:'ex-eyebrow',children:row.project.code}),e(EnterpriseSourceStatus,{row})]}),
      e('h3',{children:e('button',{class:'ex-project-title',onClick:()=>enterpriseProjectOpen(row.project),children:row.project.name})}),
      e('p',{class:'ex-muted',children:`${countries.find(country=>country.id===row.project.country)?.name||row.project.country||'Country not recorded'} · ${row.project.sector||'Sector not recorded'}`}),
      e('dl',{class:'ex-project-facts',children:[e('div',{children:[e('dt',{children:'Registered budget'}),e('dd',{children:enterpriseMoney(row.budget,true)})]}),e('div',{children:[e('dt',{children:'Reported actual'}),e('dd',{children:enterpriseMoney(row.actual,true)})]}),e('div',{children:[e('dt',{children:'Latest source'}),e('dd',{children:row.latest?.date||'Not available'})]}),e('div',{children:[e('dt',{children:'Project ends'}),e('dd',{children:row.project.datesTbc?'Unconfirmed':row.project.end||'Unconfirmed'})]})]}),
      e('div',{class:'ex-progress-track','aria-hidden':'true',children:row.actual!=null&&row.budget>0?e('span',{style:{width:Math.max(0,Math.min(100,row.actual/row.budget*100))+'%'}}):e('i',{})}),
      e('p',{class:'ex-footnote',children:row.actual!=null&&row.budget>0?`${enterprisePercent(row.actual/row.budget)} reported spent · financial measure, not delivery`: 'Spend coverage is incomplete; no progress percentage inferred.'}),
      e('button',{class:'ex-button',onClick:()=>enterpriseProjectOpen(row.project),children:'Review project →'})
    ]}))}),
    rows.length>visible&&e('div',{class:'ex-load-more',children:e('button',{class:'ex-button',onClick:()=>setVisible(visible+12),children:`Show 12 more projects (${Math.min(visible,rows.length)}/${rows.length} shown)`})})
  ]});
}
function EnterpriseChanges({model}) {
  const rows=model.rows.filter(row=>row.delta!=null);
  return e('section',{class:'ex-panel',children:[e('div',{class:'ex-section-head',children:e('div',{children:[e('p',{class:'ex-eyebrow',children:'Comparable changes'}),e('h2',{children:'What changed between reports'}),e('p',{class:'ex-muted',children:'Differences of cumulative actuals, never sums of cumulative reports. Negative changes can represent refunds or corrections.'})]})}),
    rows.length?e('div',{class:'ex-table-wrap',tabIndex:0,'aria-label':'Comparable financial changes',children:e('table',{class:'ex-table',children:[e('thead',{children:e('tr',{children:['Project','From','To','Actual-spend change','Interval'].map(label=>e('th',{scope:'col',children:label}))})}),e('tbody',{children:rows.map(row=>e('tr',{key:row.project.id,children:[e('th',{scope:'row',children:row.project.code}),e('td',{children:row.previous.date}),e('td',{children:row.latest.date}),e('td',{class:'ex-num',children:enterpriseMoney(row.delta)}),e('td',{children:`${row.intervalDays} days`})]}))})]})}):enterpriseEmpty('No comparable reporting pairs','Two complete snapshots with matching line codes and distinct dates are needed. New coverage is not treated as newly incurred expenditure.'),
    e('p',{class:'ex-footnote',children:`${rows.length}/${model.count} projects have comparable report pairs. Intervals can differ, so these changes are not added into a portfolio period total.`})
  ]});
}
function EnterpriseWeekly({projects,asOf}) {
  // Reporting obligations are evaluated at the selected date, not the engine's frozen today.
  const date=new Date(asOf+'T12:00:00Z'),end=new Date(date);end.setUTCDate(end.getUTCDate()+7);
  const endDay=end.toISOString().slice(0,10);
  const events=projects.flatMap(project=>ct(project,date).filter(item=>item.status!=='submitted').map(item=>({project,due:item.due,title:item.kind,periodEnd:item.periodEnd}))).filter(item=>EnterpriseDomain.day(item.due)!=null).sort((a,b)=>a.due.localeCompare(b.due));
  const overdue=events.filter(item=>item.due<asOf),upcoming=events.filter(item=>item.due>=asOf&&item.due<=endDay);
  return e('details',{class:'ex-weekly',children:[e('summary',{children:[e('span',{children:'Reporting horizon'}),e('span',{children:`${overdue.length} overdue · ${upcoming.length} due in 7 days`})]}),e('div',{class:'ex-weekly-body',children:[...overdue.slice(0,5),...upcoming.slice(0,5)].map((item,index)=>e('button',{class:'ex-event',key:index,onClick:()=>enterpriseProjectOpen(item.project),children:[e('strong',{children:item.project.code}),item.project.bh&&e('span',{children:`BH ${item.project.bh}`}),e('span',{children:item.title}),e('span',{children:item.due}),e('small',{children:`Reporting period to ${item.periodEnd}`})]})).concat([e('button',{class:'ex-button',onClick:()=>he('reports/calendar'),children:'Open original calendar (current date)'})])})]});
}
function EnterpriseSavedViews({state,asOf,tab,onRestore}) {
  const [views,setViews]=N(()=>{const value=enterpriseReadPreference().views;return Array.isArray(value)?value.filter(view=>view&&typeof view.name==='string'&&view.filters&&typeof view.filters==='object').slice(0,12):[];}),[name,setName]=N(''),[message,setMessage]=N('');
  function save(){if(!name.trim()){setMessage('Enter a view name.');return;}const view={name:name.trim().slice(0,80),filters:{country:state.filters.country,sector:state.filters.sector,q:state.filters.q},asOf,tab};const next=[...views.filter(item=>item.name!==view.name),view].slice(-12);if(enterpriseWritePreference({...enterpriseReadPreference(),views:next})){setViews(next);setName('');setMessage('View saved on this browser.');}else setMessage('Browser storage is unavailable.');}
  return e('details',{class:'ex-saved-views',children:[e('summary',{children:`Saved views · ${views.length}`}),e('div',{class:'ex-saved-body',children:[
    e('div',{class:'ex-toolbar',children:[e('label',{children:['View name',e('input',{value:name,maxLength:80,onInput:event=>setName(event.target.value),placeholder:'e.g. Türkiye · financial review'})]}),e('button',{class:'ex-button',onClick:save,children:'Save current scope'})]}),
    ...views.map(view=>e('div',{class:'ex-saved-row',key:view.name,children:[e('button',{class:'ex-link',onClick:()=>onRestore(view),children:view.name}),e('span',{class:'ex-muted',children:view.asOf}),e('button',{class:'ex-button small','aria-label':`Remove saved view ${view.name}`,onClick:()=>{const next=views.filter(item=>item.name!==view.name);if(enterpriseWritePreference({...enterpriseReadPreference(),views:next}))setViews(next);},children:'Remove'})]})),
    e('p',{role:'status',children:message})
  ]})]});
}
function ud(){return e(EnterpriseOverview,{});}
function EnterpriseOverview() {
  const state=te(value=>value),projects=He(state),entries=enterpriseEntries(state.ledger);
  const tabs=[['decisions','Decision room'],['finance','Finance'],['evidence','Evidence'],['scenarios','Scenarios'],['brief','Executive brief'],['legacy','Original analytics']];
  const [tab,setTab]=N(()=>{const value=enterpriseReadPreference().tab;return tabs.some(item=>item[0]===value)?value:'decisions';});
  const [asOf,setAsOf]=N(()=>state.enterpriseAsOf||enterpriseToday()),[dateInput,setDateInput]=N(()=>state.enterpriseAsOf||enterpriseToday()),[dateError,setDateError]=N('');
  const model=Yt(()=>enterpriseModel(projects,asOf),[state.ledger,state.filters.country,state.filters.sector,state.filters.q,asOf]);
  const alerts=Yt(()=>enterpriseAlerts(projects,model),[model]);
  const counts=enterpriseActionCounts(alerts,entries);
  function changeTab(value){setTab(value);enterpriseWritePreference({...enterpriseReadPreference(),tab:value});}
  const scope=[state.ledger.countries.find(country=>country.id===state.filters.country)?.name||'All countries',state.filters.sector||'All sectors',state.filters.q?'Search: '+state.filters.q:''].filter(Boolean).join(' · ');
  const report=Yt(()=>enterpriseReportData({model,alerts,entries,scope,filters:state.filters}),[model,alerts,entries,scope]);
  return e('div',{class:'ex-workspace',children:[
    e('header',{class:'ex-masthead',children:[e('div',{children:[e('p',{class:'ex-eyebrow',children:'Portfolio Ledger / Decision workspace'}),e('h1',{children:'A clearer view. A better next step.'}),e('p',{class:'ex-subtitle',children:'Source-aware financial review, explicit uncertainty and accountable follow-up.'})]}),e('span',{class:'ex-release',children:'Enterprise edition · Offline'})]}),
    e('div',{class:'ex-control-bar',children:[e('div',{class:'ex-filter-host',children:e(yn,{})}),e('div',{class:'ex-date-control',children:[e('label',{children:['Reporting date',e('input',{type:'date',value:dateInput,'aria-label':'Reporting date',onInput:event=>setDateInput(event.target.value)})]}),e('button',{class:'ex-button',onClick:()=>{if(EnterpriseDomain.day(dateInput)==null||dateInput>enterpriseToday()){setDateError('Choose a valid date no later than today.');return;}setDateError('');setAsOf(dateInput);Y({enterpriseAsOf:dateInput});},children:'Apply date'})]})]}),
    dateError&&e('p',{class:'ex-error',role:'alert',children:dateError}),
    e('div',{class:'ex-context-row',children:[e('p',{children:[e('strong',{children:`${projects.length} projects`}),` · ${scope} · as of ${asOf}`]}),e(EnterpriseSavedViews,{state,asOf,tab,onRestore:view=>{const filters={country:typeof view.filters.country==='string'?view.filters.country:'',sector:typeof view.filters.sector==='string'?view.filters.sector:'',q:typeof view.filters.q==='string'?view.filters.q:''};Y({filters});if(EnterpriseDomain.day(view.asOf)!=null&&view.asOf<=enterpriseToday()){setAsOf(view.asOf);setDateInput(view.asOf);Y({enterpriseAsOf:view.asOf});}if(tabs.some(item=>item[0]===view.tab))changeTab(view.tab);}})]}),
    e('nav',{class:'ex-tabs','aria-label':'Decision workspace views',children:tabs.map(([id,label])=>e('button',{class:tab===id?'active':'','aria-pressed':tab===id,onClick:()=>changeTab(id),key:id,children:label}))}),
    !projects.length?enterpriseEmpty('No projects match this scope','Change the country, sector or search filters. Saved views can restore an earlier scope.'):e(U,{children:[
      tab==='decisions'&&e(U,{children:[
        e('section',{class:'ex-metrics','aria-label':'Decision summary',children:[e(EnterpriseCoverage,{metric:model.budget,label:'Registered budget'}),e(EnterpriseCoverage,{metric:model.actual,label:'Reported actual spend'}),e(EnterpriseMetric,{label:'Current financial evidence',value:`${model.fresh}/${model.count}`,note:`Reports within ${model.policy.freshnessDays} days · current does not certify completeness`,tone:model.fresh===model.count?'':'ex-unknown'}),e(EnterpriseMetric,{label:'Source conditions to follow up',value:String(counts.open),note:`${counts.unassigned} without an owner · ${counts.recorded} with resolution recorded`,tone:counts.open?'ex-attention':''})]}),
        e(EnterpriseWeekly,{projects,asOf}),
        e('div',{class:'ex-decision-layout',children:[e(EnterpriseActions,{alerts,projects,entries,limit:8}),e('aside',{class:'ex-side-notes',children:[
          e('section',{class:'ex-panel ex-editorial',children:[e('p',{class:'ex-eyebrow',children:'Reading this portfolio'}),e('h2',{children:model.actual.value==null?'Complete the evidence before interpreting the totals.':'Start with the source, then review the signal.'}),e('p',{children:model.actual.value==null?`${model.actual.covered}/${model.count} projects have complete dated actual-spend evidence. Missing values remain unknown; the covered subset is shown separately.`:`Reported actuals cover all ${model.count} selected projects. Check report age and commitment coverage before using balances.`}),e('button',{class:'ex-button',onClick:()=>changeTab('evidence'),children:'Review evidence register →'})]}),
          e('section',{class:'ex-panel ex-editorial',children:[e('p',{class:'ex-eyebrow',children:'Forecast readiness'}),e('strong',{class:'ex-large-number',children:`${model.eligible}/${model.count}`}),e('p',{children:'Projects with two complete comparable reports, current commitments and a confirmed schedule.'}),e('button',{class:'ex-button',onClick:()=>changeTab('scenarios'),children:'Explore scenarios →'})]}),
          e('section',{class:'ex-panel ex-editorial',children:[e('p',{class:'ex-eyebrow',children:'Share the decision context'}),e('h2',{children:'A brief that carries its evidence.'}),e('p',{children:'Export the selected scope, source dates, open conditions and recorded follow-ups together.'}),e('button',{class:'ex-button primary',onClick:()=>changeTab('brief'),children:'Prepare executive brief →'})]})
        ]})]}),
        e(EnterprisePortfolioTable,{model,countries:state.ledger.countries}),e(EnterpriseFollowupHistory,{entries}),e(EnterpriseBackup,{ledger:state.ledger})
      ]}),
      tab==='finance'&&e(U,{children:[e('div',{class:'ex-metrics',children:[e(EnterpriseCoverage,{metric:model.budget,label:'Registered budget'}),e(EnterpriseCoverage,{metric:model.actual,label:'Reported actual spend'}),e(EnterpriseCoverage,{metric:model.committed,label:'Reported commitments'}),e(EnterpriseCoverage,{metric:model.balance,label:'Uncommitted balance'})]}),e('p',{class:'ex-method-strip',children:'Balances use the current registered budget less dated actuals and commitments. Financial pace is not delivery performance. All figures are in EUR; no currency conversion is inferred.'}),e(EnterpriseChanges,{model}),e(EnterpriseSources,{model,onProject:enterpriseProjectOpen}),e(EnterprisePortfolioTable,{model,countries:state.ledger.countries})]}),
      tab==='evidence'&&e(U,{children:[e(EnterpriseSources,{model,onProject:enterpriseProjectOpen}),e(EnterpriseChanges,{model}),e(EnterpriseBackup,{ledger:state.ledger})]}),
      tab==='scenarios'&&e(EnterpriseScenario,{model}),
      tab==='brief'&&e(EnterpriseReport,{report}),
      tab==='legacy'&&e('section',{class:'ex-legacy',children:[e('div',{class:'ex-method-strip',children:'Retained original analytics. These screens use the original current-date calculations and may coerce missing financial values to zero. Use the Evidence and Finance views for the new reporting-date and coverage rules.'}),e(EnterpriseLegacyOverview,{})]})
    ]}),
    e('footer',{class:'ex-footer',children:'Portfolio Ledger · Local-first decision workspace · No external AI calls or team synchronization · Financial signals do not certify delivery'})
  ]});
}
