/* Task regressions for Calendar, Brief, Data, Logframe and source unit details. */
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { setTimeout: pause } = require("node:timers/promises");
const { chromium } = require("playwright");
const root = path.resolve(__dirname, "..");
const port = Number(process.env.LEDGER_REFINEMENTS_TEST_PORT || 8806);
const base = `http://127.0.0.1:${port}/`;
const output = path.join(root, "test-results/refinements");
const boot = "S.projects.forEach(p=>{try{resolveProject(p)}catch(e){}});\nsyncBar();render();";
const probe = `let refResolve, refGetFile;window.__ref={parse:(file)=>readSnapshot(file),state:()=>JSON.parse(JSON.stringify(S)),
replace:(x)=>{S=migrate(x);S.projects.forEach(resolveProject);F={q:'',c:'all',s:'all',g:'all',k:0,fm:'auto',ds:'',de:''};syncBar();render()},
events:()=>portfolioEvents(rows()).map(e=>({...e,p:{id:e.p.id,code:e.p.code}})),
icsEvents:()=>calEvents().map(e=>({...e,p:{id:e.p.id,code:e.p.code}})),
facts:()=>rows().map(r=>({code:r.p.code,b:r.b,sp:r.sp,co:r.co,eac:r.eac})),history:()=>H.past.length,
delaySource:()=>{const p=S.projects.find(p=>p.id==='lang'),r=reps(p).at(-1);delete r.snapshot.ledgerDetails;p.docs=[{id:'delayed',kind:'report',fileName:'old-source.csv',ref:r.id}];refResolve=null;refGetFile=IDB.getFile;IDB.getFile=()=>new Promise(resolve=>{refResolve=resolve});render()},
waiting:()=>!!refResolve,editSource:()=>{S.projects.find(p=>p.id==='lang').docs[0].fileName='changed-source.csv'},
releaseSource:()=>{IDB.getFile=refGetFile;refResolve(new File(['Line code,Spent units,Unit\\n1,99,day\\n'],'old-source.csv'))},
workbook:(rows)=>xlsx([['Source detail fixture',rows]]),storeSource:async(pid,rid,text)=>{
 const p=S.projects.find(p=>p.id===pid);const f=new File([text],'retained-source.csv',{type:'text/csv'});
 const id=storeDoc(p,f,'report',rid);await IDB.putFile(id,f);save();return id;
},workbookRows:async(bytes)=>{const w=await wbOpen(new Uint8Array(bytes).buffer);return w.rows(w.names[0])}};\n`;
let count = 0;
const pass = (text) => console.log(`PASS ${++count}. ${text}`);
async function main() {
  const original = await fs.readFile(path.join(root, "src/original/portfolio-ledger-40.html"), "utf8");
  const enhanced = await fs.readFile(path.join(root, "portfolio-ledger-professional.html"), "utf8");
  const demo = JSON.parse(original.match(/const DEMO=(.*);\nconst KEY=/)[1]);
  demo.projects[0].people = [{ id: "fixture-person", name: "Fixture team member", role: "Coordinator", base: "Local", fte: 0, until: "2027-01-31" }];
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(path.join(output, "original.html"), original.replace(boot, probe + boot));
  await fs.writeFile(path.join(output, "enhanced.html"), enhanced.replace("/* PROFESSIONAL_EXTENSION_START */", probe + "/* PROFESSIONAL_EXTENSION_START */"));
  const server = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", root], { stdio: "ignore" });
  let browser;
  try {
    for (let i = 0; ; i++) { try { if ((await fetch(base)).ok) break; } catch {} if (i > 40) throw Error("Server unavailable"); await pause(100); }
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", args: ["--no-sandbox"] });
    async function profile(variant = "enhanced") {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true, reducedMotion: "reduce" });
      await context.addInitScript((demo) => { if (!localStorage.getItem("ledger.portfolio.v1")) localStorage.setItem("ledger.portfolio.v1", JSON.stringify(demo)); }, demo);
      const page = await context.newPage(), errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.clock.setFixedTime(new Date("2026-10-10T12:00:00Z"));
      await page.goto(`${base}test-results/refinements/${variant}.html#/home`);
      await page.waitForSelector("#view > *");
      return { page, context, errors };
    }
    const a = await profile("original"), b = await profile();
    async function route(page, route) { await page.evaluate((route) => { location.hash = '#/' + route; }, route); await page.waitForFunction((route) => document.querySelector("main").dataset.lpRoute === '#/' + route, route); }
    await route(b.page, "calendar");
    assert.equal(await b.page.locator(".lp-month-browser").getAttribute("open"), null);
    assert.ok(await b.page.locator(".cal-rl").count() > 12);
    await b.page.locator('.lp-month-picker input').fill("2027-03");
    await b.page.locator('.lp-month-picker input').dispatchEvent("change");
    await b.page.waitForFunction(() => document.querySelector('.lp-month-picker input').value === "2027-03");
    assert.match(await b.page.locator('.cal-nav h3').textContent(), /March 2027/);
    await b.page.getByRole("button", { name: "Next month", exact: true }).click();
    assert.match(await b.page.locator('.cal-nav h3').textContent(), /April 2027/);
    await b.page.getByRole("button", { name: "Previous month", exact: true }).click();
    await b.page.getByRole("button", { name: "Today", exact: true }).click();
    assert.match(await b.page.locator('.cal-nav h3').textContent(), /October 2026/);
    const overdue = (await b.page.evaluate(() => __ref.events())).filter((e) => e.kind === "report" && !e.done && e.date < "2026-10-10");
    assert.ok(overdue.length > 0);
    await b.page.getByRole("button", { name: "Review overdue reports", exact: true }).click();
    assert.equal(await b.page.locator(".lp-deadlines .ag-item").count(), overdue.length);
    assert.match(await b.page.locator(".lp-deadlines").textContent(), /not been marked/);
    await b.page.locator(".lp-deadlines .ag-item").first().click();
    await b.page.waitForFunction(() => !document.querySelector(".lp-deadlines").open && location.hash.startsWith("#/project/"));
    await route(b.page, "calendar");
    const icsPending = b.page.waitForEvent("download");
    await b.page.locator('[data-act="calics"]').click();
    const ics = await fs.readFile(await (await icsPending).path(), "utf8");
    assert.match(ics, /BEGIN:VCALENDAR/);
    assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, (await b.page.evaluate(() => __ref.icsEvents())).length);
    pass("Compact month navigation, exact overdue queue and original ICS events remain accessible");

    await route(b.page, "data");
    assert.equal(await b.page.locator("#view .card").count(), 7);
    assert.equal(await b.page.locator(".lp-data-section").count(), 6);
    assert.equal(await b.page.locator("#barwrap").isVisible(), false);
    await b.page.locator('[data-lp-data-group="records"] > summary').click();
    const beforeImport = await b.page.evaluate(() => __ref.state());
    const chooserPending = b.page.waitForEvent("filechooser");
    await b.page.locator('[data-act="impick"]').click();
    await (await chooserPending).setFiles({ name: "records.csv", mimeType: "text/csv", buffer: Buffer.from("Project code,Project name,Country,Start date,End date\nTR-LANG,Task verification project,Türkiye,2025-01-01,2027-12-31\n") });
    await b.page.waitForFunction(() => document.querySelector("#imres").textContent.includes("Task verification project"));
    assert.equal(await b.page.locator('[data-lp-data-group="records"]').getAttribute("open"), "");
    assert.deepEqual(await b.page.evaluate(() => __ref.state()), beforeImport);
    const templatePending = b.page.waitForEvent("download");
    await b.page.locator('[data-act="tpl"][data-id="xlsx"]').click();
    assert.equal((await fs.readFile(await (await templatePending).path())).subarray(0, 2).toString(), "PK");
    await b.page.locator('[data-lp-data-group="backups"] > summary').focus();
    await b.page.keyboard.press("Enter");
    await b.page.waitForFunction(() => JSON.parse(localStorage.getItem("ledger.refinements.v1"))?.data?.backups === true);
    await b.page.reload(); await b.page.waitForSelector(".lp-data-groups");
    assert.equal(await b.page.locator('[data-lp-data-group="backups"]').getAttribute("open"), "");
    assert.equal(await b.page.locator('[data-lp-data-group="reset"]').getAttribute("open"), null);
    pass("All seven Data cards retain native file actions, import preview, keyboard disclosures and saved group choices");

    await route(b.page, "brief");
    const brief = await b.page.locator(".brief").boundingBox(), view = await b.page.locator("#view").boundingBox();
    assert.ok(brief.width >= view.width * .98);
    assert.equal(await b.page.locator(".lp-evidence-table tbody tr").count(), demo.projects.length);
    assert.match(await b.page.locator(".lp-brief-evidence").textContent(), /project dates, not report dates/);
    assert.match(await b.page.locator(".lp-brief-evidence").textContent(), /Source|source/);
    const pdf = await b.page.pdf({ format: "A4", printBackground: true });
    assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
    await fs.writeFile(path.join(output, "brief.pdf"), pdf);
    const extracted = spawnSync("pdftotext", [path.join(output, "brief.pdf"), "-"], { encoding: "utf8" });
    if (extracted.status === 0) {
      assert.match(extracted.stdout, /Evidence and briefing scope/);
      assert.match(extracted.stdout, /Language Rights Programme/);
      assert.ok(extracted.stdout.includes(demo.projects[0].people[0].name), "Printed appendix must include closed disclosure team content");
    }
    pass("Management Brief uses the workspace width and includes source/coverage context in genuine PDF output");

    await route(b.page, "project/lang/delivery/results");
    const indicators = demo.projects.find((p) => p.id === "lang").doa.inds;
    assert.equal(await b.page.locator("[data-ind]").count(), indicators.length);
    assert.ok((await b.page.locator(".lp-logframe-viewport").boundingBox()).height <= 562);
    const firstInput = b.page.locator("[data-ind]").first(), key = await firstInput.getAttribute("data-ind");
    await firstInput.fill("0"); await firstInput.dispatchEvent("change");
    await b.page.waitForFunction((key) => __ref.state().projects.find((p) => p.id === "lang").doa.inds.find((i) => i.id === key.split('|')[1]).current === "0", key);
    await b.page.locator('.lp-indicator-tools select').selectOption("blank");
    assert.equal(await b.page.locator(`[data-ind="${key}"]`).isVisible(), false);
    await b.page.locator('.lp-indicator-tools select').selectOption("measured");
    assert.equal(await b.page.locator(`[data-ind="${key}"]`).isVisible(), true);
    await b.page.locator('.lp-result-toggle').first().click();
    assert.equal(await b.page.locator('.lp-result-toggle').first().getAttribute("aria-expanded"), "false");
    const lfPending = b.page.waitForEvent("download");
    await b.page.locator('[data-act="lfxl"]').click();
    const lf = await fs.readFile(await (await lfPending).path());
    assert.equal(lf.subarray(0, 2).toString(), "PK");
    assert.equal((await b.page.evaluate((bytes) => __ref.workbookRows(bytes), [...lf])).length, indicators.length + 1);
    await b.page.getByRole("button", { name: "Expand all results", exact: true }).click();
    await b.page.emulateMedia({ media: "print" });
    assert.equal(await b.page.locator(".lp-indicator-hidden").first().evaluate((row) => getComputedStyle(row).display), "table-row");
    await b.page.emulateMedia({ media: "screen" });
    pass("Logframe retains every original input; zero is measured, result groups/filtering work, and original Excel/Print remain complete");

    const csv = "Line code,Description,Approved,Actual,Spent and committed,Approved units,Approved unit cost,Spent units,Spent unit cost,Unit,Staff names\n1.1,Staff role,1000,600,800,10,100,6,,person-month,Alice;Bob\n1.2,Zero quantity,500,0,0,5,100,0,0,day,Carol\n1.3,Missing quantity,300,50,75,3,100,,,item,\n1.4,Over budget,100,150,175,1,100,2,75,day,Dana\n";
    const snapshots = [];
    for (const page of [a.page, b.page]) snapshots.push(await page.evaluate(async (csv) => __ref.parse(new File([csv], "details.csv", { type: "text/csv" })), csv));
    const rawEnhanced = JSON.parse(JSON.stringify(snapshots[1])); delete rawEnhanced.ledgerDetails;
    assert.deepEqual(rawEnhanced, snapshots[0]);
    assert.equal(snapshots[1].ledgerDetails.lines["1.2"].fields.actualUnits, 0);
    assert.equal(snapshots[1].ledgerDetails.lines["1.3"].presence.actualUnits, false);
    const fixture = JSON.parse(JSON.stringify(demo));
    const project = fixture.projects.find((p) => p.id === "lang");
    const budget = JSON.parse(JSON.stringify(snapshots[1]));
    budget.lines.forEach((line) => { line.actual = 0; line.spentCommitted = 0; line.committed = 0; });
    project.reportingPeriods = [
      { id: "budget-details", name: "Budget details", type: "Latest Approved Budget", typeGroup: "Latest Approved Budget", date: "2025-01-01", snapshot: budget },
      { id: "report-details", name: "Report details", type: "Quarterly Financial Report", typeGroup: "Quarterly Financial Report", date: "2026-09-30", snapshot: snapshots[1] },
    ];
    for (const page of [a.page, b.page]) await page.evaluate((fixture) => __ref.replace(fixture), fixture);
    assert.deepEqual(await b.page.evaluate(() => __ref.facts()), await a.page.evaluate(() => __ref.facts()));
    const projection = await b.page.evaluate(() => LedgerReportDetails.project(__ref.state().projects.find((p) => p.id === "lang")));
    assert.equal(projection.lines[0].fields.actualUnitCost.value, 100);
    assert.equal(projection.lines[0].fields.actualUnitCost.state, "derived");
    assert.equal(projection.lines[0].fields.remainingUnits.value, 4);
    assert.equal(projection.lines[1].fields.actualUnits.value, 0);
    assert.equal(projection.lines[2].fields.actualUnits.value, null);
    assert.equal(projection.lines[3].financial.remaining, -75);
    await route(b.page, "project/lang/finance/reports");
    assert.equal(await b.page.locator(".lp-report-details-table .lp-unit-actualUnits").first().textContent(), "6");
    assert.match(await b.page.locator(".lp-report-details-table").textContent(), /Alice; Bob/);
    const sourceCSVPending = b.page.waitForEvent("download");
    await b.page.locator('.card').filter({ has: b.page.getByRole('heading', { name: 'Budget lines at the latest report', exact: true }) }).getByRole("button", { name: "Visible rows CSV", exact: true }).click();
    const sourceCSV = await fs.readFile(await (await sourceCSVPending).path(), "utf8");
    assert.match(sourceCSV, /Spent units/i); assert.match(sourceCSV, /Alice; Bob/);
    await b.page.getByRole("button", { name: "Financial overview", exact: true }).click();
    const simpleCSVPending = b.page.waitForEvent("download");
    await b.page.locator('.card').filter({ has: b.page.getByRole('heading', { name: 'Budget lines at the latest report', exact: true }) }).getByRole("button", { name: "Visible rows CSV", exact: true }).click();
    assert.doesNotMatch(await fs.readFile(await (await simpleCSVPending).path(), "utf8"), /Spent units/i);
    pass("Explicit quantities/names, zero/missing and derived costs appear in source details without changing financial results");

    const cases = await b.page.evaluate(async () => {
      const conflict = await LedgerReportDetails.extract(new File(["Line code,Spent units,Unit\n1.1,2,day\n1.1,3,day\n"], "conflict.csv"));
      const xlsx = __ref.workbook([["Line code", "Spent units", "Spent unit cost", "Unit", "Staff names"], ["1.1", 0, 0, "day", "Alice"]]);
      const workbook = await LedgerReportDetails.extract(new File([xlsx], "details.xlsx"));
      const p = __ref.state().projects.find((p) => p.id === "lang");
      p.reportingPeriods[1].snapshot.ledgerDetails.lines["1.1"].fields.actualUnit = "day";
      p.reportingPeriods[1].snapshot.ledgerDetails.lines["1.1"].presence.actualUnit = true;
      const incompatible = LedgerReportDetails.project(p).lines[0].fields.remainingUnits;
      const state = __ref.state(); state.projects[state.projects.findIndex((item) => item.id === p.id)] = p; __ref.replace(state);
      p.reportingPeriods[0].date = "2027-12-31";
      const future = LedgerReportDetails.project(p);
      const numerators = [];
      for (const csv of [
        "Line code,Approved,Spent units,Unit\n1.1,1000,6,day\n",
        "Line code,Approved,Actual,Spent units,Unit\n1.1,1000,,6,day\n",
        "Line code,Approved,Actual,Spent units,Unit\n1.1,1000,0,6,day\n",
        "Line code,Approved,Actual,Spent units,Unit\n1.1,1000,-30,6,day\n",
        "Line code,Approved,Actual,Spent units,Unit\n1.1,1000,10,6,day\n1.1,1000,20,6,day\n",
      ]) {
        const snapshot = await __ref.parse(new File([csv], "numerator.csv"));
        const source = { ...p, reportingPeriods: [{ id: "numerator-report", date: "2026-01-01", name: "Numerator report", type: "Quarterly Financial Report", typeGroup: "Quarterly Financial Report", snapshot }] };
        numerators.push(LedgerReportDetails.project(source).lines[0].fields);
      }
      return { conflict, workbook, incompatible, future: future.lines[0].fields.remainingUnits, numerators };
    });
    assert.equal(cases.conflict.status, "partial");
    assert.equal(cases.conflict.lines["1.1"].presence.actualUnits, false);
    assert.equal(cases.workbook.lines["1.1"].fields.actualUnits, 0);
    assert.equal(cases.workbook.lines["1.1"].provenance.columns.actualUnits.sheet, "Source detail fixture");
    assert.equal(cases.incompatible.state, "incompatible");
    assert.equal(cases.future.state, "chronology");
    assert.equal(cases.numerators[0].actualUnitCost.value, null);
    assert.equal(cases.numerators[1].actualUnitCost.value, null);
    assert.equal(cases.numerators[2].actualUnitCost.value, 0);
    assert.equal(cases.numerators[2].actualAmount.state, "source");
    assert.equal(cases.numerators[3].actualUnitCost.value, -5);
    assert.equal(cases.numerators[4].actualAmount.state, "conflict");
    assert.equal(cases.numerators[4].actualUnitCost.value, null);
    assert.equal(await b.page.locator(".lp-report-details-table .lp-unit-actualUnit").first().textContent(), "day");
    pass("Source provenance guards missing/blank/zero/refund/conflicting numerators, incompatible units and future budgets");

    await b.page.evaluate(async (csv) => {
      const p = __ref.state().projects.find((p) => p.id === "lang");
      delete p.reportingPeriods[1].snapshot.ledgerDetails;
      const state = __ref.state(); state.projects[state.projects.findIndex((p) => p.id === "lang")] = p;
      __ref.replace(state);
      await __ref.storeSource("lang", "report-details", csv);
    }, csv);
    const beforeHydration = await b.page.evaluate(() => __ref.facts());
    await b.page.getByRole("button", { name: "Read details from stored originals", exact: true }).click();
    await b.page.waitForFunction(() => __ref.state().projects.find((p) => p.id === "lang").reportingPeriods[1].snapshot.ledgerDetails?.status === "recognized");
    assert.deepEqual(await b.page.evaluate(() => __ref.facts()), beforeHydration);
    await b.page.locator("#ubtn").click();
    assert.equal(await b.page.evaluate(() => __ref.state().projects.find((p) => p.id === "lang").reportingPeriods[1].snapshot.ledgerDetails), undefined);
    await b.page.locator("#rbtn").click();
    assert.equal(await b.page.evaluate(() => __ref.state().projects.find((p) => p.id === "lang").reportingPeriods[1].snapshot.ledgerDetails.status), "recognized");
    pass("Retained exact-report originals can refresh details with existing history; financial facts survive hydrate/undo/redo");

    for (const replacement of ["dataset", "source"]) {
      await b.page.evaluate(() => __ref.delaySource());
      await b.page.getByRole("button", { name: "Read details from stored originals", exact: true }).click();
      await b.page.waitForFunction(() => __ref.waiting());
      await b.page.evaluate((replacement) => replacement === "dataset" ? __ref.replace(__ref.state()) : __ref.editSource(), replacement);
      const expected = await b.page.evaluate(() => ({ state: __ref.state(), history: __ref.history() }));
      await b.page.evaluate(() => __ref.releaseSource());
      await b.page.waitForFunction(() => document.querySelector("#toast").textContent.includes("No details were applied"));
      assert.deepEqual(await b.page.evaluate(() => ({ state: __ref.state(), history: __ref.history() })), expected);
    }
    pass("Delayed source reads cannot mutate a replacement dataset or changed source, including undo history");

    await b.page.waitForFunction(() => !document.querySelector("#toast").classList.contains("on"));
    if (process.env.LEDGER_PREVIEWS === "1") await fs.mkdir(path.join(root, "docs/refinements"), { recursive: true });
    for (const width of [1440, 390, 320]) {
      await b.page.setViewportSize({ width, height: 1000 });
      for (const routeName of ["calendar", "brief", "data", "project/lang/delivery/results", "project/lang/finance/reports"]) {
        await route(b.page, routeName);
        assert.equal(await b.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `Overflow ${routeName}/${width}`);
        if (width <= 390 && routeName.endsWith("results")) {
          const toggle = await b.page.locator(".lp-result-toggle").first().boundingBox();
          assert.ok(toggle.x >= 0 && toggle.x + toggle.width <= width, "Mobile group control must be visible without sideways scrolling");
          assert.match(await b.page.locator(".lp-indicator-tools").textContent(), /Scroll sideways/);
        }
        if (process.env.LEDGER_PREVIEWS === "1" && width !== 320) await b.page.screenshot({ path: path.join(root, "docs/refinements", routeName.replaceAll('/', '-') + '-' + width + '.png') });
      }
    }
    assert.deepEqual(b.errors, []); assert.deepEqual(a.errors, []);
    pass("Five requested areas render at desktop/390px/320px without page overflow or browser errors");
    await a.context.close(); await b.context.close();
    console.log(`\n${count} refinement groups passed.`);
  } finally { await browser?.close(); server.kill(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
