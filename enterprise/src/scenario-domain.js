/* Explicit cost-to-complete model. Never infer spend from commitments. */
function createAdvancedScenarioDomain() {
  const DAY=86400000, MONTH=30.4375*DAY;
  function number(value){return typeof value==='number'&&Number.isFinite(value)?value:typeof value==='string'&&value.trim()&&Number.isFinite(Number(value))?Number(value):null;}
  function day(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;const time=Date.parse(value+'T00:00:00Z');return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===value?time:null;}
  function extendDate(value,months){
    const time=day(value);if(time==null||!Number.isInteger(months)||months<0||months>36)return null;
    const start=new Date(time),target=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+months,1));
    const last=new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate();
    target.setUTCDate(Math.min(start.getUTCDate(),last));return target.toISOString().slice(0,10);
  }
  function sourceKey(row){return JSON.stringify([row.projectId||row.project?.id,row.latest?.id||'',row.latest?.date||'',row.latest?.signature||'',row.actual,row.committed,row.budget,row.start,row.end,row.previous?.id||'',row.previous?.date||'',row.delta,row.intervalDays]);}
  function defaults(){return {planning:{mode:'cost-plan',rateIncludesCommitments:false,planComplete:false,manualMonthly:'',items:[]},cards:[{id:'base',name:'Current plan',extend:0,budgetPct:0,pacePct:0,staffPct:0,extra:0},{id:'extension',name:'6-month extension',extend:6,budgetPct:0,pacePct:0,staffPct:0,extra:0},{id:'cut',name:'Budget −10%',extend:0,budgetPct:-10,pacePct:0,staffPct:0,extra:0}],extensionPolicy:'fixed-workload'};}
  function validateConfiguration(config){
    if(!config||typeof config!=='object'||!['cost-plan','recent-rate','manual-rate'].includes(config.planning?.mode)||!['fixed-workload','fixed-rate'].includes(config.extensionPolicy))return false;
    if(!Array.isArray(config.cards)||config.cards.length<1||config.cards.length>4||!Array.isArray(config.planning.items)||config.planning.items.length>100)return false;
    if(!config.cards.every(card=>card&&typeof card==='object'&&!Array.isArray(card))||!config.planning.items.every(item=>item&&typeof item==='object'&&!Array.isArray(item)))return false;
    if(typeof config.planning.planComplete!=='boolean'||typeof config.planning.rateIncludesCommitments!=='boolean')return false;
    if(new Set(config.cards.map(card=>card.id)).size!==config.cards.length)return false;
    return config.cards.every(card=>typeof card.id==='string'&&card.id.length<=80&&typeof card.name==='string'&&card.name.trim().length>0&&card.name.length<=120&&Number.isInteger(number(card.extend))&&number(card.extend)>=0&&number(card.extend)<=36&&['budgetPct','pacePct','staffPct','extra'].every(field=>number(card[field])!=null)&&number(card.budgetPct)>=-100&&number(card.budgetPct)<=100&&number(card.pacePct)>=-100&&number(card.pacePct)<=100&&number(card.staffPct)>=0&&number(card.staffPct)<=100&&number(card.extra)>=0)&&config.planning.items.every(item=>typeof item.id==='string'&&typeof item.name==='string'&&item.name.trim().length>0&&item.name.length<=160&&['staff','other'].includes(item.category)&&['fixed','monthly'].includes(item.kind)&&number(item.amount)!=null&&number(item.amount)>=0)&&new Set(config.planning.items.map(item=>item.id)).size===config.planning.items.length;
  }
  function calculate(row,planning,card,asOf,extensionPolicy='fixed-workload'){
    const reasons=[],notes=[];
    const actual=number(row.actual),commitments=number(row.committed),registeredBudget=number(row.budget),cutoff=day(asOf),baseline=day(row.latest?.date);
    if(cutoff==null)reasons.push('Choose a valid reporting date.');
    if(actual==null)reasons.push('Complete dated actual-spend evidence is required.');
    if(commitments==null||commitments<0)reasons.push('A complete non-negative open-commitment balance is required.');
    if(registeredBudget==null||registeredBudget<0)reasons.push('A non-negative registered budget is required.');
    if(baseline==null||cutoff!=null&&baseline>cutoff)reasons.push('A source snapshot on or before the reporting date is required.');
    if(!row.fresh)reasons.push('Refresh the financial snapshot before projecting remaining cost.');
    if(row.start==null||row.end==null||row.end<=row.start||row.project?.datesTbc)reasons.push('A confirmed project schedule is required.');
    const extend=number(card?.extend),budgetPct=number(card?.budgetPct),pacePct=number(card?.pacePct),staffPct=number(card?.staffPct),extra=number(card?.extra);
    if(!Number.isInteger(extend)||extend<0||extend>36)reasons.push('Extension must be 0–36 whole months.');
    if(budgetPct==null||budgetPct< -100||budgetPct>100)reasons.push('Budget change must be between −100% and +100%.');
    if(pacePct==null||pacePct< -100||pacePct>100)reasons.push('Future rate change must be between −100% and +100%.');
    if(staffPct==null||staffPct<0||staffPct>100)reasons.push('Uncommitted staff reduction must be 0–100%.');
    if(extra==null||extra<0)reasons.push('Additional one-off cost must be non-negative.');
    if(!['fixed-workload','fixed-rate'].includes(extensionPolicy))reasons.push('Choose an extension policy.');
    const originalEnd=row.end!=null?new Date(row.end).toISOString().slice(0,10):null;
    const end=extendDate(originalEnd,extend),baseMonths=baseline!=null&&row.end!=null?Math.max(0,(row.end-baseline)/MONTH):null;
    const months=baseline!=null&&end?Math.max(0,(day(end)-baseline)/MONTH):null;
    const activeMonths=extensionPolicy==='fixed-workload'?baseMonths:months;
    const budget=registeredBudget!=null&&budgetPct!=null?registeredBudget*(1+budgetPct/100):null;
    const exposure=actual!=null&&commitments!=null?actual+commitments:null;
    const result={status:'withheld',reasons,notes,mode:planning?.mode,sourceDate:row.latest?.date||null,asOf,end,months,baseMonths,budget,registeredBudget,actual,commitments,exposure,availableAfterObligations:budget!=null&&exposure!=null?budget-exposure:null,actualOverrun:budget!=null&&actual!=null?Math.max(0,actual-budget):null,exposureOverrun:budget!=null&&exposure!=null?Math.max(0,exposure-budget):null,projected:null,overrun:null,unused:null,utilisation:null,monthlyRate:null,staffSaving:null,rateGrossFuture:null,overlapRemoved:null,incrementalFuture:null,planFuture:null,extra,components:[],assumptions:{extensionPolicy,extend,budgetPct,pacePct,staffPct}};
    if(baseline!=null&&cutoff!=null&&baseline<cutoff)notes.push(`Projection starts at the source date ${row.latest.date}, not today. Unreported spending since that date is not known.`);
    notes.push('Monthly costs use elapsed days / 30.4375. Average monthly outflow is an arithmetic average, not a dated payment schedule. Display rounding does not change the calculation.');
    if(budgetPct)notes.push('The changed budget is hypothetical; the registered budget is unchanged.');
    if(extend)notes.push(extensionPolicy==='fixed-workload'?'Extension preserves the modeled remaining workload; it lowers the average monthly cost, not the total.':'Extension continues recurring costs at the selected monthly rate; additional months can increase total cost.');
    let gross=0,planFuture=0,staffSaving=0;
    if(planning?.mode==='cost-plan'){
      if(planning.planComplete!==true)reasons.push('Confirm that the cost plan is complete and excludes open commitments.');
      if(!Array.isArray(planning.items)||planning.items.length>100)reasons.push('Provide a valid uncommitted-cost plan (up to 100 lines).');
      const items=Array.isArray(planning.items)?planning.items:[];
      if(new Set(items.map(item=>item?.id)).size!==items.length)reasons.push('Cost-plan line identifiers must be unique.');
      for(const item of items){
        if(!item||typeof item!=='object'){reasons.push('Every plan line must be a valid cost record.');continue;}
        const amount=number(item.amount);
        if(amount==null||amount<0||!['staff','other'].includes(item.category)||!['fixed','monthly'].includes(item.kind)||typeof item.name!=='string'||!item.name.trim()){reasons.push('Every plan line needs a name, non-negative amount, category and recurrence.');continue;}
        const before=amount*(item.kind==='monthly'?(activeMonths??0)*(1+(pacePct??0)/100):1);
        const saving=item.category==='staff'?before*(staffPct??0)/100:0;
        const cost=before-saving;planFuture+=cost;staffSaving+=saving;
        result.components.push({id:item.id,name:item.name,category:item.category,kind:item.kind,amount,before,saving,cost});
      }
      notes.push('Only explicitly uncommitted future costs are added to actuals and open commitments. Staff reductions apply only to uncommitted staff plan lines.');
    }else if(planning?.mode==='recent-rate'||planning?.mode==='manual-rate'){
      if(planning.rateIncludesCommitments!==true)reasons.push('Confirm that the gross future rate includes settlement of current commitments and that extra cost is outside that rate.');
      if(staffPct!==0)reasons.push('Staff reductions require separately identified uncommitted staff cost lines; use Cost plan mode.');
      let rate=null;
      if(planning.mode==='recent-rate'){
        if(!row.forecastEligible||row.delta==null||row.intervalDays==null||row.intervalDays<30)reasons.push('Two complete comparable reports at least 30 days apart are required for an observed rate.');
        else if(row.delta<0)reasons.push('A negative report change can be a refund or correction; it cannot establish a forward spending rate. Use a cost plan or an explicit manual assumption.');
        else rate=row.delta/row.intervalDays*30.4375;
      }else{
        rate=number(planning.manualMonthly);if(rate==null||rate<0)reasons.push('Enter a non-negative assumed gross monthly rate.');
        notes.push('The monthly rate is a user assumption, not an observed or approved spending forecast.');
      }
      result.monthlyRate=rate;
      gross=(rate??0)*(activeMonths??0)*(1+(pacePct??0)/100);
      notes.push('Gross future spending already includes settlement of open commitments. Only the amount above those commitments is added as incremental future cost.');
    }else reasons.push('Choose Cost plan, Observed gross rate or Assumed gross rate.');
    if(reasons.length)return result;
    const overlap=planning.mode==='cost-plan'?0:Math.min(commitments,gross);
    const incremental=planning.mode==='cost-plan'?0:Math.max(0,gross-commitments);
    const projected=actual+commitments+incremental+planFuture+extra;
    if(!Number.isFinite(projected)||!Number.isFinite(planFuture)||!Number.isFinite(gross)){reasons.push('The assumptions exceed the supported numeric range.');return result;}
    return {...result,status:'ready',projected,overrun:Math.max(0,projected-budget),unused:Math.max(0,budget-projected),utilisation:budget>0?projected/budget:null,monthlyRate:months>0?(commitments+incremental+planFuture+extra)/months:null,observedOrAssumedRate:result.monthlyRate,staffSaving,rateGrossFuture:planning.mode==='cost-plan'?null:gross,overlapRemoved:overlap,incrementalFuture:incremental,planFuture,verdict:projected>budget+1?'forecast-overrun':projected<budget-1?'forecast-headroom':'forecast-balanced'};
  }
  function evaluate(row,config,asOf){
    if(!validateConfiguration(config))return {sourceKey:sourceKey(row),results:[],error:'Invalid scenario configuration'};
    return {sourceKey:sourceKey(row),results:config.cards.map(card=>({card,...calculate(row,config.planning,card,asOf,config.extensionPolicy)})),error:null};
  }
  return Object.freeze({number,day,extendDate,sourceKey,defaults,validateConfiguration,calculate,evaluate});
}
const AdvancedScenarioDomain=createAdvancedScenarioDomain();
