function EnterpriseMetric({label,value,note,tone}) {
  return enterpriseElement('article',{class:`ex-metric ${tone||''}`,children:[enterpriseElement('span',{class:'ex-eyebrow',children:label}),enterpriseElement('strong',{class:'ex-metric-value',children:value}),enterpriseElement('span',{class:'ex-metric-note',children:note})]});
}
function EnterpriseCoverage({metric,label}){
  return enterpriseElement(EnterpriseMetric,{label,value:enterpriseMoney(metric.value,true),note:metric.covered===metric.count?`${metric.covered}/${metric.count} projects covered`:`Covered subset ${metric.covered}/${metric.count}: ${enterpriseMoney(metric.coveredValue,true)} · portfolio total withheld`,tone:metric.covered===metric.count?'':'ex-unknown'});
}
function EnterpriseSourceStatus({row}) {
  const tone=row.actual==null?'missing':row.fresh?'fresh':'stale';
  return enterpriseElement('span',{class:`ex-status ${tone}`,children:row.actual==null?'Evidence incomplete':row.fresh?'Current report':'Stale report'});
}
function EnterpriseSources({model,onProject}) {
  const [visible,setVisible]=N(50);
  return enterpriseElement('section',{class:'ex-panel',children:[
    enterpriseElement('div',{class:'ex-section-head',children:[enterpriseElement('div',{children:[enterpriseElement('p',{class:'ex-eyebrow',children:'Evidence register'}),enterpriseElement('h2',{children:'Every number has a source boundary'}),enterpriseElement('p',{class:'ex-muted',children:`As of ${model.asOf} · freshness window ${model.policy.freshnessDays} days · future reports excluded`})]})]}),
    enterpriseElement('div',{class:'ex-table-wrap',tabIndex:0,'aria-label':'Financial evidence register',children:enterpriseElement('table',{class:'ex-table',children:[
      enterpriseElement('thead',{children:enterpriseElement('tr',{children:['Project','Latest snapshot','Actual fields','Actual spend','Commitments','Observed-rate evidence'].map(label=>enterpriseElement('th',{scope:'col',children:label}))})}),
      enterpriseElement('tbody',{children:model.rows.slice(0,visible).map(row=>enterpriseElement('tr',{key:row.project.id,children:[
        enterpriseElement('th',{scope:'row',children:enterpriseElement('button',{class:'ex-link',onClick:()=>onProject(row.project),children:row.project.code||row.project.name})}),
        enterpriseElement('td',{children:[row.latest?.date||'No dated report',enterpriseElement('div',{class:'ex-muted',children:row.age==null?'':`${row.age} days old`})]}),
        enterpriseElement('td',{children:row.latest?`${row.latest.coverage}/${row.latest.lines}`:'Not established'}),
        enterpriseElement('td',{class:'ex-num',children:enterpriseMoney(row.actual)}),enterpriseElement('td',{class:'ex-num',children:enterpriseMoney(row.committed)}),
        enterpriseElement('td',{children:[enterpriseElement(EnterpriseSourceStatus,{row}),enterpriseElement('details',{class:'ex-source-reasons',children:[enterpriseElement('summary',{children:row.forecastEligible?'Method and scope':'Why withheld'}),enterpriseElement('p',{children:row.forecastEligible?`Two comparable reports, ${row.intervalDays} days apart. Latest report ${row.latest.date}. Scenario rate is based on their actual-spend change.`:row.reasons.join('. ')}),row.latest?.sourceName&&enterpriseElement('p',{children:`Source: ${row.latest.sourceName}`})]})]})
      ]}))})
    ]})}),
    model.count>visible&&enterpriseElement('div',{class:'ex-queue-more',children:enterpriseElement('button',{class:'ex-button',onClick:()=>setVisible(visible+50),children:`Show 50 more sources (${Math.min(visible,model.count)}/${model.count} shown)`})}),
    enterpriseElement('p',{class:'ex-footnote',children:'Scope matching uses budget-line codes. Renames, reclassifications and source accuracy still require review. Current registered budgets are not a reconstruction of historical approvals.'})
  ]});
}
function EnterpriseFollowup({alert,entries}) {
  const key=EnterpriseDomain.fingerprint(alert), saved=entries[key];
  const [message,setMessage]=N('');
  return enterpriseElement('details',{class:'ex-followup',children:[
    enterpriseElement('summary',{children:saved?`${saved.status} · ${saved.owner||'Owner unassigned'}${saved.due?' · '+saved.due:''}`:'Assign owner and next step'}),
    enterpriseElement('form',{key:saved?.updatedAt||'new',onSubmit:async event=>{
      event.preventDefault();const data=new FormData(event.currentTarget);
      const entry={owner:String(data.get('owner')||'').trim(),due:String(data.get('due')||''),status:String(data.get('status')||'Open'),notes:String(data.get('notes')||'').trim(),projectId:String(alert.projectId),title:alert.title,detail:alert.detail||'',sourceDate:alert.sourceDate||'',updatedAt:new Date().toISOString()};
      setMessage('Saving…');
      try{await enterpriseSaveFollowup(alert,entry);setMessage('Saved with portfolio data. Source condition remains visible.');}catch(error){setMessage(error.message);}
    },children:[
      enterpriseElement('div',{class:'ex-form-grid',children:[
        enterpriseElement('label',{children:['Owner',enterpriseElement('input',{name:'owner',maxLength:160,defaultValue:saved?.owner||'',disabled:wn,placeholder:'Name or team'})]}),
        enterpriseElement('label',{children:['Follow-up date',enterpriseElement('input',{name:'due',type:'date',defaultValue:saved?.due||'',disabled:wn})]}),
        enterpriseElement('label',{children:['Review state',enterpriseElement('select',{name:'status',defaultValue:saved?.status||'Open',disabled:wn,children:['Open','In review','Resolution recorded'].map(status=>enterpriseElement('option',{value:status,children:status}))})]})
      ]}),
      enterpriseElement('label',{children:['Evidence and next action',enterpriseElement('textarea',{name:'notes',maxLength:4000,defaultValue:saved?.notes||'',disabled:wn,placeholder:'What was checked, what remains, and the next step'})]}),
      enterpriseElement('div',{class:'ex-toolbar',children:[enterpriseElement('button',{class:'ex-button primary',type:'submit',disabled:wn,children:wn?'Read-only copy':'Save follow-up'}),saved&&enterpriseElement('span',{class:'ex-muted',children:`Updated ${saved.updatedAt.slice(0,10)}`})]}),
      enterpriseElement('p',{class:'ex-footnote',children:'Recording a resolution does not remove the source condition. A changed source date or alert detail starts a new follow-up. Earlier entries stay in the history.'}),
      enterpriseElement('p',{role:'status',class:'ex-status-message',children:message})
    ]})
  ]});
}
function EnterpriseActions({alerts,projects,entries,limit=8}){
  const [filter,setFilter]=N('all'),[expanded,setExpanded]=N(false);
  const current=alerts.filter(alert=>filter==='all'||filter==='unassigned'&&!entries[EnterpriseDomain.fingerprint(alert)]?.owner||filter==='critical'&&alert.severity==='critical');
  return enterpriseElement('section',{class:'ex-panel',children:[
    enterpriseElement('div',{class:'ex-section-head',children:[enterpriseElement('div',{children:[enterpriseElement('p',{class:'ex-eyebrow',children:'Decision queue'}),enterpriseElement('h2',{children:'What needs a next step'}),enterpriseElement('p',{class:'ex-muted',children:'Evidence, deadlines and financial signals remain separate.'})]}),enterpriseElement('label',{class:'ex-inline-label',children:['Show',enterpriseElement('select',{value:filter,onChange:event=>setFilter(event.target.value),children:[enterpriseElement('option',{value:'all',children:'All signals'}),enterpriseElement('option',{value:'unassigned',children:'Owner unassigned'}),enterpriseElement('option',{value:'critical',children:'Critical'})]})]})]}),
    current.length?enterpriseElement('div',{class:'ex-action-list',children:current.slice(0,expanded?current.length:limit).map(alert=>{const project=projects.find(item=>item.id===alert.projectId);return enterpriseElement('article',{class:'ex-action',key:EnterpriseDomain.fingerprint(alert),children:[
      enterpriseElement('div',{class:'ex-action-heading',children:[enterpriseElement('span',{class:`ex-severity ${alert.severity}`,children:alert.severity}),enterpriseElement('button',{class:'ex-link',onClick:()=>enterpriseProjectOpen(project),children:project?.code||alert.projectId}),alert.due&&enterpriseElement('span',{class:'ex-muted',children:`Due ${alert.due}`})]}),
      enterpriseElement('h3',{children:alert.title}),enterpriseElement('p',{class:'ex-muted',children:alert.detail}),enterpriseElement('p',{class:'ex-next',children:alert.next}),enterpriseElement(EnterpriseFollowup,{alert,entries})
    ]});})}):enterpriseEmpty('No signals in this view','This does not certify completeness or project delivery.'),
    current.length>limit&&enterpriseElement('div',{class:'ex-queue-more',children:enterpriseElement('button',{class:'ex-button',onClick:()=>setExpanded(!expanded),children:expanded?'Show fewer signals':`Show all ${current.length} signals`})})
  ]});
}
function EnterpriseFollowupHistory({entries,projectId}) {
  const list=Object.values(entries).filter(entry=>!projectId||entry.projectId===projectId).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
  return enterpriseElement('details',{class:'ex-panel ex-history',children:[enterpriseElement('summary',{children:`Recorded follow-up history · ${list.length}`}),enterpriseElement('div',{class:'ex-panel-inner',children:list.length?list.map((entry,index)=>enterpriseElement('article',{class:'ex-history-item',key:index,children:[enterpriseElement('strong',{children:entry.title}),enterpriseElement('p',{children:`${entry.status} · ${entry.owner||'Owner unassigned'} · ${entry.due||'No follow-up date'}`}),enterpriseElement('p',{class:'ex-muted',children:entry.detail}),enterpriseElement('p',{class:'ex-prewrap',children:entry.notes}),enterpriseElement('small',{children:`Updated ${entry.updatedAt.slice(0,10)} · project ${entry.projectId}`})]})):enterpriseEmpty('No follow-ups recorded','Record a review from the decision queue.')})]});
}
function EnterpriseBackup({ledger}){
  const [message,setMessage]=N('');
  async function restore(file){try{
    if(!file)return;if(file.size>4000000)throw Error('Backup exceeds 4 MB');
    const result=EnterpriseDomain.restoreFollowups(enterpriseEntries(et().ledger),JSON.parse(await file.text()),et().ledger.projects.map(project=>String(project.id)));
    await enterpriseSaveEntries(result.entries,'Decision follow-ups restored');setMessage(`${result.added} added, ${result.skipped} existing or unknown-project entries skipped.`);
  }catch(error){setMessage('Restore failed: '+error.message);}}
  return enterpriseElement('details',{class:'ex-panel ex-backup',children:[enterpriseElement('summary',{children:'Data portability & recovery'}),enterpriseElement('div',{class:'ex-panel-inner',children:[
    enterpriseElement('p',{children:'Follow-ups are saved with this portfolio through the application’s save and undo flow. They are browser-local until you export or share a copy. These are not synchronized team tasks.'}),
    enterpriseElement('div',{class:'ex-toolbar',children:[
      enterpriseElement('button',{class:'ex-button',onClick:()=>enterpriseDownload('portfolio-decision-backup.json',JSON.stringify({format:'portfolio-followups-v1',entries:enterpriseEntries(ledger)},null,2)),children:'Export follow-ups'}),
      enterpriseElement('button',{class:'ex-button',onClick:()=>enterpriseDownload('portfolio-complete-backup.json',JSON.stringify(ledger,null,2)),children:'Export portfolio JSON'}),
      enterpriseElement('button',{class:'ex-button',disabled:wn,onClick:async()=>{try{const previous=JSON.parse(localStorage.getItem('pl-premium-followups-v1')||'{}');const result=EnterpriseDomain.restoreFollowups(enterpriseEntries(ledger),{format:'portfolio-followups-v1',entries:previous},ledger.projects.map(project=>String(project.id)));await enterpriseSaveEntries(result.entries,'Previous Premium follow-ups imported');setMessage(`${result.added} previous Premium entries imported. Historical entries retain their original source keys.`);}catch(error){setMessage(error.message);}},children:'Import previous Premium follow-ups'})
    ]}),
    enterpriseElement('label',{class:'ex-file-label',children:['Restore follow-up JSON (adds missing records; preserves existing records)',enterpriseElement('input',{type:'file',accept:'.json,application/json',disabled:wn,onChange:event=>restore(event.target.files[0])})]}),
    enterpriseElement('p',{role:'status',children:message}),
    enterpriseElement('p',{class:'ex-footnote',children:'Portfolio JSON excludes original binary attachments stored separately in IndexedDB. Keep original source documents and verify a backup in a disposable browser profile before relying on it.'})
  ]})]});
}
function EnterpriseScenario({model}){return enterpriseElement(AdvancedScenarioWorkspace,{model});}
function EnterpriseProjectPage({id}) {
  const state=te(value=>value),project=state.ledger.projects.find(item=>item.id===id);
  const [mode,setMode]=N('review');
  Ce(()=>{const show=()=>setMode('original');addEventListener('pl-tab',show);return()=>removeEventListener('pl-tab',show);},[]);
  if(!project)return enterpriseElement(dh,{id});
  const asOf=state.enterpriseAsOf||enterpriseToday(),model=enterpriseModel([project],asOf),row=model.rows[0],alerts=enterpriseAlerts([project],model),entries=enterpriseEntries(state.ledger);
  return enterpriseElement('div',{class:'ex-workspace',children:[
    enterpriseElement('nav',{class:'ex-tabs','aria-label':'Project workspace',children:[enterpriseElement('button',{class:mode==='review'?'active':'',onClick:()=>setMode('review'),'aria-pressed':mode==='review',children:'Decision review'}),enterpriseElement('button',{class:mode==='original'?'active':'',onClick:()=>setMode('original'),'aria-pressed':mode==='original',children:'Original project workspace'})]}),
    mode==='original'?enterpriseElement(dh,{id}):enterpriseElement(U,{children:[
      enterpriseElement('header',{class:'ex-masthead',children:[enterpriseElement('div',{children:[enterpriseElement('p',{class:'ex-eyebrow',children:`Project review · ${project.code}${project.bh?' · BH '+project.bh:''} · as of ${asOf}`}),enterpriseElement('h1',{children:project.name}),enterpriseElement('p',{children:`${project.sector||'Sector not recorded'} · ${project.start||'Start unconfirmed'} — ${project.end||'End unconfirmed'}`})]}),enterpriseElement(EnterpriseSourceStatus,{row})]}),
      enterpriseElement('div',{class:'ex-toolbar',children:[enterpriseElement('button',{class:'ex-button primary',onClick:()=>Y({drawer:{kind:'report',projectId:id}}),disabled:wn,children:'Import financial report'}),enterpriseElement('button',{class:'ex-button',onClick:()=>Y({drawer:{kind:'project',id}}),disabled:wn,children:'Edit project details'}),enterpriseElement('button',{class:'ex-button',onClick:()=>setMode('original'),children:'Budget, delivery & documents →'})]}),
      enterpriseElement('div',{class:'ex-metrics',children:[enterpriseElement(EnterpriseMetric,{label:'Registered budget',value:enterpriseMoney(row.budget,true),note:'Current register; approval history not reconstructed'}),enterpriseElement(EnterpriseMetric,{label:'Reported actual spend',value:enterpriseMoney(row.actual,true),note:row.latest?.date||'No complete source'}),enterpriseElement(EnterpriseMetric,{label:'Uncommitted balance',value:enterpriseMoney(row.balance,true),note:row.balance==null?'Actual and commitment coverage required':'Registered budget less reported exposure'}),enterpriseElement(EnterpriseMetric,{label:'Comparable report change',value:enterpriseMoney(row.delta,true),note:row.delta==null?'Matching source scope required':`${row.previous.date} → ${row.latest.date} · cumulative difference`})]}),
      enterpriseElement(EnterpriseSources,{model,onProject:()=>Y({drawer:{kind:'report',projectId:id}})}),
      enterpriseElement(EnterpriseActions,{alerts,projects:[project],entries,limit:100}),enterpriseElement(EnterpriseScenario,{model}),enterpriseElement(EnterpriseFollowupHistory,{entries,projectId:id})
    ]})
  ]});
}
