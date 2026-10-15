const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {spawn}=require('node:child_process'),{setTimeout:pause}=require('node:timers/promises'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'../..'),output=path.join(root,'test-results/advanced-scenarios');
const port=Number(process.env.LEDGER_SCENARIO_TEST_PORT||8819),url=`http://127.0.0.1:${port}/downloads/portfolio-analysis-enterprise.html`;
let count=0;const pass=text=>console.log(`PASS ${++count}: ${text}`);
async function main(){
 await fs.mkdir(output,{recursive:true});const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1','--directory',root],{stdio:'ignore'});let browser;
 try{
  for(let tries=0;;tries++){try{if((await fetch(url)).ok)break;}catch{}if(tries>50)throw Error('Server unavailable');await pause(100);}
  const html=await fs.readFile(path.join(root,'downloads/portfolio-analysis-enterprise.html'),'utf8');assert.ok(!html.includes('function Nu('));assert.ok(!html.includes('rate||s.exposure/g'));
  const marker='cm();tc(e(jm,{}),',instrumented=html.replace(marker,'window.__advancedTest={get:et,set:Y,undo:er};'+marker);
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:1600,height:1100},acceptDownloads:true,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));await page.route('**/downloads/portfolio-analysis-enterprise.html',route=>route.fulfill({status:200,contentType:'text/html',body:instrumented}));await page.clock.setFixedTime(new Date('2026-10-15T09:00:00Z'));await page.goto(url);await page.getByRole('heading',{name:'A clearer view. A better next step.'}).waitFor();
  const fixture=await page.evaluate(()=>structuredClone(window.__advancedTest.get().ledger));const original=fixture.projects[0];
  const report=(id,date,actual,committed)=>({id,date,periodEnd:date,snapshot:{lines:[{code:'1',description:'Recorded costs',approved:1482000,actual,committed}]}});
  fixture.projects=[{...original,id:'known',code:'KNOWN',name:'Scenario model programme',budget:1482000,start:'2025-01-01',end:'2028-12-21',datesTbc:false,reportingPeriods:[report('r1','2026-08-01',80000,380000),report('r2','2026-10-01',100000,361888)]},{...original,id:'no-history',code:'NO-HISTORY',name:'Commitments without observed history',budget:1482000,start:'2025-01-01',end:'2028-12-21',datesTbc:false,reportingPeriods:[report('single','2026-10-01',0,461888)]},{...original,id:'missing',code:'MISSING',name:'No financial source',budget:1482000,start:'2025-01-01',end:'2028-12-21',datesTbc:false,reportingPeriods:[]}];delete fixture.enterprise;
  await page.evaluate(ledger=>window.__advancedTest.set({ledger,filters:{country:'',sector:'',q:''},route:'overview'}),fixture);
  await page.getByRole('button',{name:'Scenarios',exact:true}).click();await page.getByRole('heading',{name:'Advanced scenario model',exact:true}).waitFor();
  assert.equal(await page.locator('.as-card .as-blockers').count(),3);
  await page.getByRole('checkbox',{name:'Confirm complete uncommitted cost plan',exact:true}).check();
  async function evidence(){const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Export scenario evidence JSON',exact:true}).click();const file=await pending;const target=path.join(output,'scenario-evidence.json');await file.saveAs(target);return JSON.parse(await fs.readFile(target,'utf8'));}
  let data=await evidence();assert.equal(data.results[0].projected,461888);assert.equal(data.results[2].budget,1333800);assert.equal(data.results[2].overrun,0);assert.equal(data.results[2].unused,871912);
  await page.screenshot({path:path.join(output,'no-false-overrun-desktop.png'),fullPage:true});
  pass('the screenshot budget-cut case has no invented overrun when no additional cost is planned');
  await page.getByRole('button',{name:'Add uncommitted cost',exact:true}).click();let line=page.locator('.as-plan-row').first();await line.locator('input').first().fill('Future staff, outside commitments');await line.locator('select').first().selectOption('staff');await line.locator('input[type=number]').fill('100000');assert.equal(await page.getByRole('checkbox',{name:'Confirm complete uncommitted cost plan',exact:true}).isChecked(),false);
  await page.getByRole('checkbox',{name:'Confirm complete uncommitted cost plan',exact:true}).check();
  const staff=page.getByRole('slider',{name:'Current plan: Uncommitted staff reduction',exact:true});await staff.fill('50');await staff.dispatchEvent('input');
  data=await evidence();assert.equal(data.results[0].projected,511888);assert.equal(data.results[0].staffSaving,50000);assert.equal(data.results[0].commitments,361888);assert.equal(data.results[0].actual,100000);
  pass('staff savings reduce only named uncommitted staff lines; plan edits reset confirmation');
  await line.locator('select').first().selectOption('other');await line.locator('select').nth(1).selectOption('monthly');await line.locator('input[type=number]').fill('1000');await page.getByRole('checkbox',{name:'Confirm complete uncommitted cost plan',exact:true}).check();
  const spread=await evidence();assert.ok(Math.abs(spread.results[0].projected-spread.results[1].projected)<.001);
  await page.getByRole('combobox',{name:'Extension assumption',exact:true}).selectOption('fixed-rate');data=await evidence();assert.ok(data.results[1].projected>data.results[0].projected);
  pass('extension policies separately preserve workload or add recurring costs');
  await page.getByRole('combobox',{name:'Calculation basis',exact:true}).selectOption('manual-rate');await page.getByRole('spinbutton',{name:'Assumed gross monthly rate',exact:true}).fill('0');await page.getByRole('checkbox',{name:'Confirm gross rate includes commitments',exact:true}).check();await page.getByRole('spinbutton',{name:'Current plan: Additional one-off cost',exact:true}).fill('50000');
  data=await evidence();assert.equal(data.results[0].projected,511888);assert.equal(data.results[0].rateGrossFuture,0);assert.equal(data.results[0].incrementalFuture,0);assert.equal(data.results[0].overrun,0);
  pass('zero assumed rate is explicit; one-off cost is added beyond the commitment floor');
  await page.getByRole('spinbutton',{name:'Budget −10%: Additional one-off cost',exact:true}).fill('1000000');data=await evidence();assert.equal(data.results[2].status,'ready');assert.equal(data.results[2].overrun,128088);assert.equal(data.results[2].actualOverrun,0);await page.getByText('Projected overrun — not current expenditure',{exact:true}).waitFor();await page.getByRole('spinbutton',{name:'Budget −10%: Additional one-off cost',exact:true}).fill('0');
  pass('a genuine modeled overrun is distinguished from current actual expenditure');
  const sourceBefore=await page.evaluate(()=>JSON.stringify(window.__advancedTest.get().ledger.projects));await page.getByRole('button',{name:'Save scenario assumptions',exact:true}).click();await page.getByText('Assumptions saved and storage confirmed. Actuals, commitments and registered budget are unchanged.',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>JSON.stringify(window.__advancedTest.get().ledger.projects)),sourceBefore);
  await page.reload();await page.getByRole('heading',{name:'Advanced scenario model',exact:true}).waitFor();assert.equal(await page.getByRole('checkbox',{name:'Confirm gross rate includes commitments',exact:true}).isChecked(),true);assert.equal(await page.getByRole('spinbutton',{name:'Assumed gross monthly rate',exact:true}).inputValue(),'0');assert.match(await page.locator('.as-intro').innerText(),/1\/3 projects have a saved/);
  pass('saved source-linked assumptions persist through reload without editing financial records');
  await page.getByRole('spinbutton',{name:'Current plan: Additional one-off cost',exact:true}).fill('60000');await page.getByRole('button',{name:'Save scenario assumptions',exact:true}).click();await page.getByText('Assumptions saved and storage confirmed. Actuals, commitments and registered budget are unchanged.',{exact:true}).waitFor();await page.evaluate(()=>window.__advancedTest.undo());assert.equal(await page.evaluate(()=>window.__advancedTest.get().ledger.enterprise.scenarios.known.cards[0].extra),'50000');
  pass('saved scenario edits participate in the original audited undo flow');
  await page.getByRole('button',{name:'Executive brief',exact:true}).click();assert.match(await page.locator('.ex-report').innerText(),/Saved scenario models/);assert.match(await page.locator('.ex-report').innerText(),/511,888/);assert.match(await page.locator('.ex-report').innerText(),/Commitment overlap removed/);
  const jsonPending=page.waitForEvent('download');await page.getByRole('button',{name:'Download evidence JSON',exact:true}).click();const json=await jsonPending;const jsonPath=path.join(output,'brief-evidence.json');await json.saveAs(jsonPath);const brief=JSON.parse(await fs.readFile(jsonPath,'utf8'));assert.equal(brief.scenarios[0].reference.projected,511888);
  pass('the executive brief and evidence export include the saved scenario formula and assumptions');
  await page.getByRole('button',{name:'Scenarios',exact:true}).click();
  await page.evaluate(()=>{const state=window.__advancedTest.get();const ledger=structuredClone(state.ledger);ledger.projects[0].reportingPeriods[1].snapshot.lines[0].actual=101000;window.__advancedTest.set({ledger});});
  await page.getByText('The source, schedule or comparable history changed since this model was saved.',{exact:false}).waitFor();assert.equal(await page.getByRole('checkbox',{name:'Confirm gross rate includes commitments',exact:true}).isChecked(),false);assert.match(await page.locator('.as-card').first().innerText(),/Projection withheld/);assert.match(await page.locator('.as-intro').innerText(),/0\/3 projects have a saved/);
  pass('changed source evidence invalidates confirmations and excludes the stale saved projection');
  await page.getByRole('combobox',{name:'Scenario project',exact:true}).selectOption('no-history');await page.getByRole('combobox',{name:'Calculation basis',exact:true}).selectOption('recent-rate');await page.getByRole('checkbox',{name:'Confirm gross rate includes commitments',exact:true}).check();data=await evidence();assert.equal(data.results[0].status,'withheld');assert.equal(data.results[0].projected,null);assert.equal(data.results[0].monthlyRate,null);
  pass('commitments without an observed report pair never create a monthly rate');
  await page.getByRole('combobox',{name:'Scenario project',exact:true}).selectOption('missing');await page.getByRole('checkbox',{name:'Confirm complete uncommitted cost plan',exact:true}).check();data=await evidence();assert.equal(data.results[0].status,'withheld');assert.equal(data.results[0].actual,null);assert.equal(data.results[0].projected,null);
  pass('explicit assumptions cannot turn missing financial baseline values into zero');
  await page.getByRole('combobox',{name:'Scenario project',exact:true}).selectOption('known');
  for(const width of [1600,1024,768,390,320]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`advanced studio overflow at ${width}`);}
  await page.evaluate(()=>document.documentElement.dataset.theme='dark');await page.screenshot({path:path.join(output,'advanced-dark-mobile.png'),fullPage:true});
  pass('advanced cards, confirmations and cost controls fit 320–1600px and dark mode');
  await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>{document.documentElement.dataset.theme='light';location.hash='#/project/known';});await page.getByRole('button',{name:'Original project workspace',exact:true}).click();await page.getByRole('button',{name:'Edit details',exact:true}).waitFor();await page.evaluate(()=>dispatchEvent(new CustomEvent('pl-tab',{detail:'Scenario'})));await page.getByRole('heading',{name:'Advanced scenario model',exact:true}).waitFor();assert.equal(await page.getByRole('heading',{name:'Compare scenarios',exact:true}).count(),0);
  assert.deepEqual(errors,[]);await page.screenshot({path:path.join(output,'replaced-original-screen.png'),fullPage:true});
  pass('the exact original comparison screen is replaced, with no browser errors');
  const readContext=await browser.newContext(),readPage=await readContext.newPage();const shared=await page.evaluate(()=>window.__advancedTest.get().ledger),embedded=JSON.stringify({mode:'view',id:'advanced-readonly',ledger:shared}).replace(/</g,'\\u003c');const readHtml=html.replace('<body><div id="app">',`<body><script type="application/json" id="pl-embed">${embedded}</script><div id="app">`);await readPage.route('**/downloads/portfolio-analysis-enterprise.html',route=>route.fulfill({status:200,contentType:'text/html',body:readHtml}));await readPage.goto(url);await readPage.getByRole('button',{name:'Scenarios',exact:true}).click();await readPage.getByRole('heading',{name:'Advanced scenario model',exact:true}).waitFor();assert.equal(await readPage.locator('.as-model-footer').getByRole('button',{name:'Read-only copy',exact:true}).isDisabled(),true);await readContext.close();
  pass('read-only shared copies cannot persist scenario models');
  console.log(`${count} advanced browser groups passed.`);
 }finally{await browser?.close();server.kill();}
}
main().catch(error=>{console.error(error);process.exit(1);});
