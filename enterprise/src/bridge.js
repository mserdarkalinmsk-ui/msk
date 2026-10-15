/* Narrow adapter to the retained application. All writes use its audited undo flow. */
function enterpriseToday() {
  return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
}
function enterpriseMoney(value, compact=false) {
  if(value == null || !Number.isFinite(value)) return 'Not established';
  return new Intl.NumberFormat('en-GB',{style:'currency',currency:'EUR',maximumFractionDigits:compact?1:0,...compact?{notation:'compact'}:{}}).format(value);
}
function enterprisePercent(value){return value==null?'Not established':new Intl.NumberFormat('en-GB',{style:'percent',maximumFractionDigits:1}).format(value);}
function enterpriseReadPreference(){try{const value=JSON.parse(localStorage.getItem('pl-enterprise-view-v2')||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch{return {};}}
function enterpriseWritePreference(value){try{localStorage.setItem('pl-enterprise-view-v2',JSON.stringify(value));return true;}catch{return false;}}
function enterpriseResolve(project,date,id){
  const report=(project.reportingPeriods||[]).find(item=>item.date===date&&String(item.id||'')===id);
  // Count only source leaf lines. The retained calculator can include parent
  // subtotals or approval-only administrative values; neither is new evidence.
  const source=report?EnterpriseDomain.snapshot(report,EnterpriseDomain.day(date)):null;
  return source?{spent:source.actual,committed:source.committed}:null;
}
function enterpriseModel(projects,asOf){return EnterpriseDomain.model(projects,asOf,EnterpriseDomain.defaults,enterpriseResolve);}
function enterpriseAlerts(projects,model){
  const date=new Date(model.asOf+'T12:00:00Z');
  const dated=projects.map(project=>({...project,reportingPeriods:(project.reportingPeriods||[]).filter(report=>EnterpriseDomain.day(report.date)!=null&&report.date<=model.asOf)}));
  return EnterpriseDomain.actions(model,en(dated,date));
}
function enterpriseEntries(ledger){const entries=ledger.enterprise?.followups;return entries&&typeof entries==='object'&&!Array.isArray(entries)?entries:{};}
async function enterpriseSaveEntries(entries,message){
  if(wn)throw Error('This shared copy is read-only');
  const ledger=et().ledger;
  ze({...ledger,enterprise:{...ledger.enterprise,schemaVersion:2,followups:entries}},message);
  // The retained save scheduler is debounced. Confirm the canonical IndexedDB
  // transaction before telling the user the follow-up is durably saved.
  const database=await ss();
  if(!database)throw Error('Browser database is unavailable. Export the portfolio before closing.');
  await Na(et().ledger);
  await new Promise((resolve,reject)=>{
    const transaction=database.transaction(ft,'readonly');
    const request=transaction.objectStore(ft).get(xo);
    transaction.oncomplete=()=>{
      if(JSON.stringify(request.result?.enterprise?.followups)!==JSON.stringify(entries))reject(Error('Save could not be confirmed. Export the portfolio before closing.'));
      else resolve();
    };
    transaction.onabort=transaction.onerror=()=>reject(Error('Browser database save failed. Export the portfolio before closing.'));
  });
}
async function enterpriseSaveFollowup(alert,entry){
  const key=EnterpriseDomain.fingerprint(alert);
  if(!EnterpriseDomain.validateFollowup(entry))throw Error('Follow-up fields are invalid');
  const entries={...enterpriseEntries(et().ledger),[key]:entry};
  await enterpriseSaveEntries(entries,'Decision follow-up saved');
}
function enterpriseDownload(name,content,type='application/json'){$n(name,new Blob([content],{type}));}
function enterpriseProjectOpen(project){he(`project/${project.id}`);}
function enterpriseEmpty(label,detail){return e('div',{class:'ex-empty',children:[e('strong',{children:label}),e('p',{children:detail})]});}
function enterpriseActionCounts(alerts,entries){return alerts.reduce((counts,alert)=>{const entry=entries[EnterpriseDomain.fingerprint(alert)];if(entry?.status==='Resolution recorded')counts.recorded++;else counts.open++;if(!entry?.owner)counts.unassigned++;return counts;},{open:0,recorded:0,unassigned:0});}
