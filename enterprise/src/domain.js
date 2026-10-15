/* Pure decision model. No browser storage, mutation, or UI dependencies. */
function createEnterpriseDomain() {
  const DAY = 86400000;
  const defaults = Object.freeze({freshnessDays: 180, minHistoryDays: 30});
  const number = value => value == null || value === '' || typeof value === 'boolean' ? null : Number.isFinite(Number(value)) ? Number(value) : null;
  function day(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const time = Date.parse(value + 'T00:00:00Z');
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : null;
  }
  const sum = values => values.reduce((total, value) => total + value, 0);
  const total = values => values.length && values.every(value => value != null) ? sum(values) : null;
  function leaves(lines) {
    const parents=new Set();
    for(const line of lines){const parts=String(line.code||'').split('.');for(let index=1;index<parts.length;index++)parents.add(parts.slice(0,index).join('.'));}
    return lines.filter(line=>!parents.has(String(line.code||'')));
  }
  function snapshot(report, cutoff) {
    const time = day(report?.date);
    if (time == null || time > cutoff) return null;
    const all = Array.isArray(report.snapshot?.lines) ? report.snapshot.lines : [];
    const lines = leaves(all);
    if (!lines.length) return null;
    const codes = lines.map(line => String(line.code || ''));
    const ambiguous = codes.some(code => !code) || new Set(codes).size !== codes.length;
    const actualComplete = !ambiguous && lines.every(line => number(line.actual) != null);
    const committed = line => number(line.committed) ?? (number(line.spentCommitted) != null && number(line.actual) != null ? number(line.spentCommitted) - number(line.actual) : null);
    const commitmentsComplete = !ambiguous && lines.every(line => committed(line) != null);
    return {
      id: String(report.id || ''), date: report.date, time, lines: lines.length,
      signature: codes.slice().sort().join('|'), ambiguous, actualComplete, commitmentsComplete,
      actual: actualComplete ? sum(lines.map(line => number(line.actual))) : null,
      committed: commitmentsComplete ? sum(lines.map(committed)) : null,
      coverage: lines.filter(line => number(line.actual) != null).length,
      reportedBudget: !ambiguous ? total(lines.map(line => number(line.approved))) : null,
      sourceName: String(report.fileName || report.sourceName || report.snapshot?.fileName || ''),
    };
  }
  function evidence(project, asOf, policy = defaults, resolver) {
    const cutoff = day(asOf);
    if (cutoff == null) throw Error('Invalid reporting date');
    const reports = (project.reportingPeriods || []).map(report => snapshot(report, cutoff)).filter(Boolean).sort((a,b) => a.time - b.time || a.id.localeCompare(b.id));
    const latest = reports.at(-1) || null;
    const previous = reports.length > 1 ? reports.at(-2) : null;
    const duplicateDates = new Set(reports.map(report => report.date)).size !== reports.length;
    const age = latest ? Math.floor((cutoff - latest.time) / DAY) : null;
    const fresh = age != null && age <= policy.freshnessDays;
    const sameScope = !!(latest && previous && latest.signature === previous.signature && latest.actualComplete && previous.actualComplete && !duplicateDates);
    const intervalDays = sameScope ? (latest.time - previous.time) / DAY : null;
    // A bridge may normalize source totals; apply it consistently to both dates.
    const resolved = latest && resolver ? resolver(project, latest.date, latest.id) : null;
    const previousResolved = previous && resolver ? resolver(project, previous.date, previous.id) : null;
    const actual = latest?.actualComplete && !duplicateDates ? (number(resolved?.spent) ?? latest.actual) : null;
    const delta = sameScope && intervalDays > 0 ? (number(resolved?.spent) ?? latest.actual) - (number(previousResolved?.spent) ?? previous.actual) : null;
    const committed = latest?.commitmentsComplete && !duplicateDates ? (number(resolved?.committed) ?? latest.committed) : null;
    const budget = number(project.budget);
    const start = day(project.start), end = day(project.end);
    const validSchedule = !project.datesTbc && start != null && end != null && end > start;
    const elapsed = validSchedule ? Math.max(0, Math.min(1, (cutoff - start) / (end - start))) : null;
    const reasons = [];
    if (!latest) reasons.push('No dated financial snapshot');
    if (latest && !latest.actualComplete) reasons.push('Actual-spend fields are incomplete or line codes are ambiguous');
    if (latest && !latest.commitmentsComplete) reasons.push('Commitment fields are incomplete');
    if (duplicateDates) reasons.push('Multiple snapshots share a date; resolve the source version');
    if (latest && !fresh) reasons.push(`Latest report is ${age} days old`);
    if (!sameScope) reasons.push('Two complete snapshots with matching budget-line codes are required');
    else if (intervalDays < policy.minHistoryDays) reasons.push(`Reporting interval is shorter than ${policy.minHistoryDays} days`);
    if (!validSchedule) reasons.push('Project schedule is not confirmed');
    if (budget == null || budget <= 0) reasons.push('A positive registered budget is required');
    const forecastEligible = reasons.length === 0;
    const rate = forecastEligible ? delta / intervalDays * 30.4375 : null;
    const exposure = actual != null && committed != null ? actual + committed : null;
    const balance = budget != null && exposure != null ? budget - exposure : null;
    const pace = fresh && actual != null && budget > 0 && elapsed != null ? actual / budget - elapsed : null;
    return {projectId:project.id, budget, latest, previous, reports, age, fresh, actual, committed, exposure, balance, delta, intervalDays, sameScope, elapsed, pace, forecastEligible, reasons, rate, start, end};
  }
  function scenario(row, asOf, multiplier = 1, adjustment = 0, assumptions = {}) {
    // An observed rate is not a complete remaining-cost model until its overlap
    // with commitments is explicitly confirmed. Never manufacture that consent.
    if(assumptions.rateIncludesCommitments!==true)return null;
    const factor=number(multiplier),extra=number(adjustment);
    if(factor==null||factor<.5||factor>1.5||extra==null||extra<0)return null;
    const result=AdvancedScenarioDomain.calculate(row,{mode:'recent-rate',rateIncludesCommitments:true},{extend:0,budgetPct:0,pacePct:(factor-1)*100,staffPct:0,extra},asOf,'fixed-rate');
    return result.status==='ready'?result:null;
  }
  function model(projects, asOf, policy = defaults, resolver) {
    const rows = projects.map(project => ({project, ...evidence(project, asOf, policy, resolver)}));
    const known = field => rows.filter(row => row[field] != null);
    const aggregate = field => ({value:total(rows.map(row=>row[field])), covered:known(field).length, coveredValue:sum(known(field).map(row=>row[field])), count:rows.length});
    const forecasts = rows.map(row=>scenario(row, asOf));
    return {asOf, policy, rows, count:rows.length, budget:aggregate('budget'), actual:aggregate('actual'), committed:aggregate('committed'), balance:aggregate('balance'), fresh:rows.filter(row=>row.fresh).length, eligible:rows.filter(row=>row.forecastEligible).length, forecast:total(forecasts.map(value=>value?.projected ?? null)), latestDate:rows.map(row=>row.latest?.date).filter(Boolean).sort().at(-1)||null};
  }
  function fingerprint(alert) {
    return JSON.stringify([String(alert.projectId),String(alert.kind),String(alert.title),String(alert.detail || ''),String(alert.sourceDate || '')]);
  }
  function actions(model, legacy = []) {
    const rows = new Map(model.rows.map(row=>[row.project.id,row]));
    const list = legacy.filter(alert => {
      const row=rows.get(alert.projectId);
      if (!row || alert.kind==='stale' || alert.kind==='forecast') return false;
      if (['underspend','overspend'].includes(alert.kind)) return row.pace != null;
      if (['line','overbudget'].includes(alert.kind)) return row.exposure != null;
      return true;
    }).map(alert=>({...alert, sourceDate:rows.get(alert.projectId)?.latest?.date || '', next:alert.kind==='deadline'?'Review the reporting obligation and record the next submission action.':'Open project evidence and record an owner and next step.'}));
    for (const row of model.rows) {
      if (row.actual == null || !row.fresh || row.committed == null) list.push({projectId:row.project.id,kind:'evidence',severity:row.actual==null?'serious':'warning',title:row.actual==null?'Financial evidence needs review':!row.fresh?'Financial report needs refreshing':'Commitment coverage needs review',detail:row.latest?`${row.latest.date} · ${row.latest.coverage}/${row.latest.lines} actual-spend fields · ${row.age} days old`:'No complete dated financial snapshot is available',sourceDate:row.latest?.date||'',next:'Import or verify a complete financial report before interpreting balances and forecasts.'});
      const forecast=row.savedScenario?.status==='ready'?row.savedScenario:null;
      if(forecast?.overrun>1)list.push({projectId:row.project.id,kind:'forecast',severity:'serious',title:'Saved scenario projects an overrun',detail:`${forecast.card.name}: projected cost exceeds its scenario budget by €${Math.round(forecast.overrun).toLocaleString('en-GB')}; this is not current actual-spend overrun`,sourceDate:row.latest.date,next:'Review saved cost assumptions, obligations and the hypothetical budget.'});
    }
    const order={critical:0,serious:1,warning:2};
    return [...new Map(list.map(alert=>[fingerprint(alert),alert])).values()].sort((a,b)=>(order[a.severity]??3)-(order[b.severity]??3)||String(a.projectId).localeCompare(String(b.projectId)));
  }
  function validateFollowup(entry) {
    if (!entry || typeof entry!=='object' || Array.isArray(entry)) return false;
    if (!['Open','In review','Resolution recorded'].includes(entry.status)) return false;
    if (!['owner','due','notes','projectId','title','detail','updatedAt'].every(field=>typeof entry[field]==='string')) return false;
    return entry.owner.length<=160 && entry.notes.length<=4000 && entry.title.length<=1000 && entry.detail.length<=4000 && (!entry.due || day(entry.due)!=null) && Number.isFinite(Date.parse(entry.updatedAt));
  }
  function restoreFollowups(current, payload, allowedIds) {
    if(payload?.format!=='portfolio-followups-v1' || !payload.entries || typeof payload.entries!=='object' || Array.isArray(payload.entries)) throw Error('Unsupported backup format');
    const entries=Object.entries(payload.entries);
    if(entries.length>10000) throw Error('Too many follow-up entries');
    const restored={...current};let added=0,skipped=0;
    for(const [key,entry] of entries){
      if(['__proto__','prototype','constructor'].includes(key) || !validateFollowup(entry)) throw Error('Invalid follow-up entry');
      if(!allowedIds.includes(entry.projectId)){skipped++;continue;}
      if(!Object.hasOwn(restored,key)){Object.defineProperty(restored,key,{value:{...entry},enumerable:true,writable:true,configurable:true});added++;} else skipped++;
    }
    return {entries:restored,added,skipped};
  }
  function csv(rows) {
    return '\uFEFF'+rows.map(row=>row.map(value=>{let text=String(value??'');if(/^[=+@-]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';}).join(',')).join('\r\n');
  }
  return Object.freeze({defaults, number, day, leaves, snapshot, evidence, scenario, model, actions, fingerprint, validateFollowup, restoreFollowups, csv});
}
const EnterpriseDomain = createEnterpriseDomain();
