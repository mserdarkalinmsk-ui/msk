function EnterpriseMetric({label,value,note,tone}) {
  return e('article',{class:`ex-metric ${tone||''}`,children:[e('span',{class:'ex-eyebrow',children:label}),e('strong',{class:'ex-metric-value',children:value}),e('span',{class:'ex-metric-note',children:note})]});
}
function EnterpriseCoverage({metric,label}){
  return e(EnterpriseMetric,{label,value:enterpriseMoney(metric.value,true),note:metric.covered===metric.count?`${metric.covered}/${metric.count} projects covered`:`Covered subset ${metric.covered}/${metric.count}: ${enterpriseMoney(metric.coveredValue,true)} · portfolio total withheld`,tone:metric.covered===metric.count?'':'ex-unknown'});
}
function EnterpriseSourceStatus({row}) {
  const tone=row.actual==null?'missing':row.fresh?'fresh':'stale';
  return e('span',{class:`ex-status ${tone}`,children:row.actual==null?'Evidence incomplete':row.fresh?'Current report':'Stale report'});
}
function EnterpriseSources({model,onProject}) {
  const [visible,setVisible]=N(50);
  return e('section',{class:'ex-panel',children:[
    e('div',{class:'ex-section-head',children:[e('div',{children:[e('p',{class:'ex-eyebrow',children:'Evidence register'}),e('h2',{children:'Every number has a source boundary'}),e('p',{class:'ex-muted',children:`As of ${model.asOf} · freshness window ${model.policy.freshnessDays} days · future reports excluded`})]})]}),
    e('div',{class:'ex-table-wrap',tabIndex:0,'aria-label':'Financial evidence register',children:e('table',{class:'ex-table',children:[
      e('thead',{children:e('tr',{children:['Project','Latest snapshot','Actual fields','Actual spend','Commitments','Forecast eligibility'].map(label=>e('th',{scope:'col',children:label}))})}),
      e('tbody',{children:model.rows.slice(0,visible).map(row=>e('tr',{key:row.project.id,children:[
        e('th',{scope:'row',children:e('button',{class:'ex-link',onClick:()=>onProject(row.project),children:row.project.code||row.project.name})}),
        e('td',{children:[row.latest?.date||'No dated report',e('div',{class:'ex-muted',children:row.age==null?'':`${row.age} days old`})]}),
        e('td',{children:row.latest?`${row.latest.coverage}/${row.latest.lines}`:'Not established'}),
        e('td',{class:'ex-num',children:enterpriseMoney(row.actual)}),e('td',{class:'ex-num',children:enterpriseMoney(row.committed)}),
        e('td',{children:[e(EnterpriseSourceStatus,{row}),e('details',{class:'ex-source-reasons',children:[e('summary',{children:row.forecastEligible?'Method and scope':'Why withheld'}),e('p',{children:row.forecastEligible?`Two comparable reports, ${row.intervalDays} days apart. Latest report ${row.latest.date}. Scenario rate is based on their actual-spend change.`:row.reasons.join('. ')}),row.latest?.sourceName&&e('p',{children:`Source: ${row.latest.sourceName}`})]})]})
      ]}))})
    ]})}),
    model.count>visible&&e('div',{class:'ex-queue-more',children:e('button',{class:'ex-button',onClick:()=>setVisible(visible+50),children:`Show 50 more sources (${Math.min(visible,model.count)}/${model.count} shown)`})}),
    e('p',{class:'ex-footnote',children:'Scope matching uses budget-line codes. Renames, reclassifications and source accuracy still require review. Current registered budgets are not a reconstruction of historical approvals.'})
  ]});
}
function EnterpriseFollowup({alert,entries}) {
  const key=EnterpriseDomain.fingerprint(alert), saved=entries[key];
  const [message,setMessage]=N('');
  return e('details',{class:'ex-followup',children:[
    e('summary',{children:saved?`${saved.status} · ${saved.owner||'Owner unassigned'}${saved.due?' · '+saved.due:''}`:'Assign owner and next step'}),
    e('form',{key:saved?.updatedAt||'new',onSubmit:async event=>{
      event.preventDefault();const data=new FormData(event.currentTarget);
      const entry={owner:String(data.get('owner')||'').trim(),due:String(data.get('due')||''),status:String(data.get('status')||'Open'),notes:String(data.get('notes')||'').trim(),projectId:String(alert.projectId),title:alert.title,detail:alert.detail||'',sourceDate:alert.sourceDate||'',updatedAt:new Date().toISOString()};
      setMessage('Saving…');
      try{await enterpriseSaveFollowup(alert,entry);setMessage('Saved with portfolio data. Source condition remains visible.');}catch(error){setMessage(error.message);}
    },children:[
      e('div',{class:'ex-form-grid',children:[
        e('label',{children:['Owner',e('input',{name:'owner',maxLength:160,defaultValue:saved?.owner||'',disabled:wn,placeholder:'Name or team'})]}),
        e('label',{children:['Follow-up date',e('input',{name:'due',type:'date',defaultValue:saved?.due||'',disabled:wn})]}),
        e('label',{children:['Review state',e('select',{name:'status',defaultValue:saved?.status||'Open',disabled:wn,children:['Open','In review','Resolution recorded'].map(status=>e('option',{value:status,children:status}))})]})
      ]}),
      e('label',{children:['Evidence and next action',e('textarea',{name:'notes',maxLength:4000,defaultValue:saved?.notes||'',disabled:wn,placeholder:'What was checked, what remains, and the next step'})]}),
      e('div',{class:'ex-toolbar',children:[e('button',{class:'ex-button primary',type:'submit',disabled:wn,children:wn?'Read-only copy':'Save follow-up'}),saved&&e('span',{class:'ex-muted',children:`Updated ${saved.updatedAt.slice(0,10)}`})]}),
      e('p',{class:'ex-footnote',children:'Recording a resolution does not remove the source condition. A changed source date or alert detail starts a new follow-up. Earlier entries stay in the history.'}),
      e('p',{role:'status',class:'ex-status-message',children:message})
    ]})
  ]});
}
function EnterpriseActions({alerts,projects,entries,limit=8}){
  const [filter,setFilter]=N('all'),[expanded,setExpanded]=N(false);
  const current=alerts.filter(alert=>filter==='all'||filter==='unassigned'&&!entries[EnterpriseDomain.fingerprint(alert)]?.owner||filter==='critical'&&alert.severity==='critical');
  return e('section',{class:'ex-panel',children:[
    e('div',{class:'ex-section-head',children:[e('div',{children:[e('p',{class:'ex-eyebrow',children:'Decision queue'}),e('h2',{children:'What needs a next step'}),e('p',{class:'ex-muted',children:'Evidence, deadlines and financial signals remain separate.'})]}),e('label',{class:'ex-inline-label',children:['Show',e('select',{value:filter,onChange:event=>setFilter(event.target.value),children:[e('option',{value:'all',children:'All signals'}),e('option',{value:'unassigned',children:'Owner unassigned'}),e('option',{value:'critical',children:'Critical'})]})]})]}),
    current.length?e('div',{class:'ex-action-list',children:current.slice(0,expanded?current.length:limit).map(alert=>{const project=projects.find(item=>item.id===alert.projectId);return e('article',{class:'ex-action',key:EnterpriseDomain.fingerprint(alert),children:[
      e('div',{class:'ex-action-heading',children:[e('span',{class:`ex-severity ${alert.severity}`,children:alert.severity}),e('button',{class:'ex-link',onClick:()=>enterpriseProjectOpen(project),children:project?.code||alert.projectId}),alert.due&&e('span',{class:'ex-muted',children:`Due ${alert.due}`})]}),
      e('h3',{children:alert.title}),e('p',{class:'ex-muted',children:alert.detail}),e('p',{class:'ex-next',children:alert.next}),e(EnterpriseFollowup,{alert,entries})
    ]});})}):enterpriseEmpty('No signals in this view','This does not certify completeness or project delivery.'),
    current.length>limit&&e('div',{class:'ex-queue-more',children:e('button',{class:'ex-button',onClick:()=>setExpanded(!expanded),children:expanded?'Show fewer signals':`Show all ${current.length} signals`})})
  ]});
}
function EnterpriseFollowupHistory({entries,projectId}) {
  const list=Object.values(entries).filter(entry=>!projectId||entry.projectId===projectId).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
  return e('details',{class:'ex-panel ex-history',children:[e('summary',{children:`Recorded follow-up history · ${list.length}`}),e('div',{class:'ex-panel-inner',children:list.length?list.map((entry,index)=>e('article',{class:'ex-history-item',key:index,children:[e('strong',{children:entry.title}),e('p',{children:`${entry.status} · ${entry.owner||'Owner unassigned'} · ${entry.due||'No follow-up date'}`}),e('p',{class:'ex-muted',children:entry.detail}),e('p',{class:'ex-prewrap',children:entry.notes}),e('small',{children:`Updated ${entry.updatedAt.slice(0,10)} · project ${entry.projectId}`})]})):enterpriseEmpty('No follow-ups recorded','Record a review from the decision queue.')})]});
}
function EnterpriseBackup({ledger}){
  const [message,setMessage]=N('');
  async function restore(file){try{
    if(!file)return;if(file.size>4000000)throw Error('Backup exceeds 4 MB');
    const result=EnterpriseDomain.restoreFollowups(enterpriseEntries(et().ledger),JSON.parse(await file.text()),et().ledger.projects.map(project=>String(project.id)));
    await enterpriseSaveEntries(result.entries,'Decision follow-ups restored');setMessage(`${result.added} added, ${result.skipped} existing or unknown-project entries skipped.`);
  }catch(error){setMessage('Restore failed: '+error.message);}}
  return e('details',{class:'ex-panel ex-backup',children:[e('summary',{children:'Data portability & recovery'}),e('div',{class:'ex-panel-inner',children:[
    e('p',{children:'Follow-ups are saved with this portfolio through the application’s save and undo flow. They are browser-local until you export or share a copy. These are not synchronized team tasks.'}),
    e('div',{class:'ex-toolbar',children:[
      e('button',{class:'ex-button',onClick:()=>enterpriseDownload('portfolio-decision-backup.json',JSON.stringify({format:'portfolio-followups-v1',entries:enterpriseEntries(ledger)},null,2)),children:'Export follow-ups'}),
      e('button',{class:'ex-button',onClick:()=>enterpriseDownload('portfolio-complete-backup.json',JSON.stringify(ledger,null,2)),children:'Export portfolio JSON'}),
      e('button',{class:'ex-button',disabled:wn,onClick:async()=>{try{const previous=JSON.parse(localStorage.getItem('pl-premium-followups-v1')||'{}');const result=EnterpriseDomain.restoreFollowups(enterpriseEntries(ledger),{format:'portfolio-followups-v1',entries:previous},ledger.projects.map(project=>String(project.id)));await enterpriseSaveEntries(result.entries,'Previous Premium follow-ups imported');setMessage(`${result.added} previous Premium entries imported. Historical entries retain their original source keys.`);}catch(error){setMessage(error.message);}},children:'Import previous Premium follow-ups'})
    ]}),
    e('label',{class:'ex-file-label',children:['Restore follow-up JSON (adds missing records; preserves existing records)',e('input',{type:'file',accept:'.json,application/json',disabled:wn,onChange:event=>restore(event.target.files[0])})]}),
    e('p',{role:'status',children:message}),
    e('p',{class:'ex-footnote',children:'Portfolio JSON excludes original binary attachments stored separately in IndexedDB. Keep original source documents and verify a backup in a disposable browser profile before relying on it.'})
  ]})]});
}
function EnterpriseScenario({model}) {
  const [factor,setFactor]=N(100),[extra,setExtra]=N('0');
  const eligible=model.rows.filter(row=>row.forecastEligible);
  const extraNumber=EnterpriseDomain.number(extra),valid=extraNumber!=null&&extraNumber>=0;
  const values=eligible.map(row=>({row,base:EnterpriseDomain.scenario(row,model.asOf),adjusted:EnterpriseDomain.scenario(row,model.asOf,factor/100,valid?extraNumber:NaN)}));
  const total=valid&&eligible.length===model.count&&model.count?values.reduce((sum,item)=>sum+item.adjusted.projected,0):null;
  return e('section',{class:'ex-panel',children:[
    e('div',{class:'ex-section-head',children:e('div',{children:[e('p',{class:'ex-eyebrow',children:'Scenario studio'}),e('h2',{children:'Explore remaining spend, without changing records'}),e('p',{class:'ex-muted',children:'Recent comparable report change projected to the project end; commitments act as a floor. Refund-driven negative rates use a zero future run rate.'})]})}),
    e('div',{class:'ex-scenario-controls',children:[
      e('label',{children:[`Future run rate · ${factor}% of recent rate`,e('input',{type:'range',min:50,max:150,step:5,value:factor,onInput:event=>setFactor(Number(event.target.value)),'aria-label':'Future run rate'})]}),
      e('label',{children:['Additional future cost per eligible project (€)',e('input',{type:'number',min:0,step:100,value:extra,onInput:event=>setExtra(event.target.value),'aria-label':'Additional future cost'})]}),
      e('button',{class:'ex-button',onClick:()=>{setFactor(100);setExtra('0');},children:'Reset assumptions'})
    ]}),
    !valid&&e('p',{role:'alert',class:'ex-error',children:'Enter a non-negative additional cost.'}),
    e('div',{class:'ex-callout',children:[e('span',{class:'ex-eyebrow',children:'Selected portfolio scenario'}),e('strong',{children:enterpriseMoney(total)}),e('p',{children:`${eligible.length}/${model.count} projects eligible. Incomplete coverage withholds the portfolio scenario; individual eligible projects remain visible below.`})]}),
    e('p',{class:'ex-footnote',children:'Assumptions, not a statistical confidence interval. Additional cost is applied to each eligible project. No budget, actual, commitment or approved forecast is edited.'}),
    values.length?e('div',{class:'ex-table-wrap',tabIndex:0,'aria-label':'Scenario comparison',children:e('table',{class:'ex-table',children:[e('thead',{children:e('tr',{children:['Project','Latest report','Base scenario','Adjusted scenario','Over budget'].map(label=>e('th',{scope:'col',children:label}))})}),e('tbody',{children:values.map(item=>e('tr',{key:item.row.project.id,children:[e('th',{scope:'row',children:item.row.project.code}),e('td',{children:item.row.latest.date}),e('td',{children:enterpriseMoney(item.base.projected)}),e('td',{children:enterpriseMoney(item.adjusted?.projected)}),e('td',{children:enterpriseMoney(item.adjusted?.overrun)})]}))})]})}):enterpriseEmpty('Scenario withheld','Add two complete, comparable reports at least 30 days apart, current commitments, a confirmed schedule and a positive registered budget.')
  ]});
}
function EnterpriseProjectPage({id}) {
  const state=te(value=>value),project=state.ledger.projects.find(item=>item.id===id);
  const [mode,setMode]=N('review');
  Ce(()=>{const show=()=>setMode('original');addEventListener('pl-tab',show);return()=>removeEventListener('pl-tab',show);},[]);
  if(!project)return e(dh,{id});
  const asOf=state.enterpriseAsOf||enterpriseToday(),model=enterpriseModel([project],asOf),row=model.rows[0],alerts=enterpriseAlerts([project],model),entries=enterpriseEntries(state.ledger);
  return e('div',{class:'ex-workspace',children:[
    e('nav',{class:'ex-tabs','aria-label':'Project workspace',children:[e('button',{class:mode==='review'?'active':'',onClick:()=>setMode('review'),'aria-pressed':mode==='review',children:'Decision review'}),e('button',{class:mode==='original'?'active':'',onClick:()=>setMode('original'),'aria-pressed':mode==='original',children:'Original project workspace'})]}),
    mode==='original'?e(dh,{id}):e(U,{children:[
      e('header',{class:'ex-masthead',children:[e('div',{children:[e('p',{class:'ex-eyebrow',children:`Project review · ${project.code}${project.bh?' · BH '+project.bh:''} · as of ${asOf}`}),e('h1',{children:project.name}),e('p',{children:`${project.sector||'Sector not recorded'} · ${project.start||'Start unconfirmed'} — ${project.end||'End unconfirmed'}`})]}),e(EnterpriseSourceStatus,{row})]}),
      e('div',{class:'ex-toolbar',children:[e('button',{class:'ex-button primary',onClick:()=>Y({drawer:{kind:'report',projectId:id}}),disabled:wn,children:'Import financial report'}),e('button',{class:'ex-button',onClick:()=>Y({drawer:{kind:'project',id}}),disabled:wn,children:'Edit project details'}),e('button',{class:'ex-button',onClick:()=>setMode('original'),children:'Budget, delivery & documents →'})]}),
      e('div',{class:'ex-metrics',children:[e(EnterpriseMetric,{label:'Registered budget',value:enterpriseMoney(row.budget,true),note:'Current register; approval history not reconstructed'}),e(EnterpriseMetric,{label:'Reported actual spend',value:enterpriseMoney(row.actual,true),note:row.latest?.date||'No complete source'}),e(EnterpriseMetric,{label:'Uncommitted balance',value:enterpriseMoney(row.balance,true),note:row.balance==null?'Actual and commitment coverage required':'Registered budget less reported exposure'}),e(EnterpriseMetric,{label:'Comparable report change',value:enterpriseMoney(row.delta,true),note:row.delta==null?'Matching source scope required':`${row.previous.date} → ${row.latest.date} · cumulative difference`})]}),
      e(EnterpriseSources,{model,onProject:()=>Y({drawer:{kind:'report',projectId:id}})}),
      e(EnterpriseActions,{alerts,projects:[project],entries,limit:100}),e(EnterpriseScenario,{model}),e(EnterpriseFollowupHistory,{entries,projectId:id})
    ]})
  ]});
}
