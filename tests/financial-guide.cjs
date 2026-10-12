/* Financial Guide v15: unit checks of the rule engines and analysis, then a browser pass over every route. */
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const root = path.resolve(__dirname, "..");
const E = require(path.join(root, "financial-guide/src/engines.js"));
const A = require(path.join(root, "financial-guide/src/analysis.js"));
global.window = {};
require(path.join(root, "financial-guide/src/content.generated.js"));
const C = global.window.FG_CONTENT;

/* ---- rules carried over from v14 ---- */
assert.equal(E.procurement({ amount: 2000 }).route, "Direct Award");
assert.equal(E.procurement({ amount: 2001 }).route, "Competitive Bidding");
assert.equal(E.procurement({ amount: 6000, type: "intellectual" }).route, "Direct Award");
assert.equal(E.procurement({ amount: 183999 }).route, "Competitive Bidding");
assert.equal(E.procurement({ amount: 184000 }).route, "International Public Call for Tenders");
assert.match(E.procurement({ amount: 55000, funding: "xb" }).summary, /DLAPIL/);
assert.doesNotMatch(E.procurement({ amount: 54999, funding: "xb" }).summary, /DLAPIL/);
assert.match(E.procurement({ amount: 8000, publicPrices: true }).summary, /Public-price/);
assert.equal(E.budgetRevision({ current: 100000, proposed: 125000 }).route, "Notification");
assert.equal(E.budgetRevision({ current: 100000, proposed: 125001 }).route, "Addendum");
assert.equal(E.budgetRevision({ current: 100000, proposed: 74000 }).route, "Addendum");
assert.equal(E.budgetRevision({ current: 100, proposed: 100, change: "extension" }).route, "Addendum");
assert.equal(E.budgetRevision({ current: 100, proposed: 100, unitsExceeded: "yes" }).route, "Notification review");
assert.equal(E.budgetRevision({ project: "vc", current: 100, proposed: 100, donor: "earmarked" }).kpis[3][1], "Donor acceptance required");
assert.equal(E.grantProcedure({ amount: 14999 }).route, "Direct award");
assert.equal(E.grantProcedure({ amount: 15000 }).route, "Competitive call");
assert.equal(E.grantProcedure({ amount: 15000, exception: "yes" }).route, "Exceptional direct award");
assert.equal(E.contractStrategy({ pattern: "recurring" }).route, "Framework contract");
assert.equal(E.contractStrategy({ pattern: "variable", mini: "yes", suppliers: "multiple", defined: "no" }).route, "Framework agreement");
assert.equal(E.yearEnd({ delivery: "current", invoice: "no" }).route, "Accrual / provision review");
assert.equal(E.yearEnd({ measurable: "no" }).score, 62);
assert.equal(E.whatIf({ current: 100000, proposed: 124000 }).route, "Notification");
assert.equal(E.whatIf({ current: 100000, proposed: 124000, change: "scope" }).route, "Addendum");
assert.equal(E.pettyCash({ budget: "ob", amount: 51, approved: true }).title, "Petty cash not applicable");
assert.equal(E.pettyCash({ amount: 99, approved: false }).title, "Do not spend yet");
assert.equal(E.yearAllocation({ delivery: "next", budget: "special" }).title, "Not 2026 expenditure");
assert.equal(E.readiness("x", [["a", "A"], ["b", "B"]], { a: true }).route, "Not ready");

/* ---- analysis ---- */
assert.equal(A.toNumber("1.234,56"), 1234.56);
assert.equal(A.toNumber("1,234.56"), 1234.56);
assert.equal(A.toNumber("(500)"), -500);
assert.equal(A.toNumber("€ 12 000"), 12000);
const budget = A.parseSheet(A.parseCSV('Title row\n\nBudget Line;Description;Nb of Units;Approved Budget\n1.1;Staff;10;"10.000,00"\n2.1;Travel;;5000\nSubtotal 1;;;15000\n'), C.columnAliases, "budget");
assert.equal(budget.lines.length, 2, "subtotal rows are excluded");
assert.equal(budget.headerRow, 2, "header found below a title row (blank rows are dropped)");
const report = A.parseSheet(A.parseCSV("Budget Line,Actual Expenditure,Open Commitments,Reported Units\n1.1,9000,2000,12\n9.1,50,0,\n"), C.columnAliases, "extract");
const cmp = A.compare(budget, report);
assert.equal(cmp.totals.exposure, 11050);
assert.equal(cmp.lines.find((l) => l.key === "1.1").status, "over");
assert.equal(cmp.unmatched, 1);
assert.equal(cmp.unitsExceeded, 1);
assert.throws(() => A.parseSheet([["a", "b"], ["1", "2"]], C.columnAliases, "budget"), /Approved budget/);
const sig = A.projectSignals({ start: "2025-01-01", end: "2026-12-31", leadMonths: 12 }, cmp.totals, new Date("2026-10-12"));
assert.equal(sig.risk, "High");
console.log("Unit checks passed.");

/* ---- browser ---- */
(async () => {
  const { chromium } = require("playwright");
  const html = path.join(root, "financial-guide.html");
  assert.ok(fs.existsSync(html), "Run python3 financial-guide/scripts/build.py first");
  const browser = await chromium.launch(fs.existsSync("/opt/pw-browsers/chromium") ? { executablePath: "/opt/pw-browsers/chromium" } : {});
  const shots = path.join(root, "test-results/financial-guide");
  fs.mkdirSync(shots, { recursive: true });
  const problems = [];
  for (const [vp, theme] of [[{ width: 1440, height: 900 }, "light"], [{ width: 390, height: 844 }, "dark"]]) {
    const page = await browser.newPage({ viewport: vp, colorScheme: theme });
    page.on("pageerror", (e) => problems.push(`${vp.width} pageerror ${e.message}`));
    page.on("console", (m) => { if (m.type() === "error") problems.push(`${vp.width} console ${m.text()}`); });
    await page.goto("file://" + html);
    const all = await page.evaluate(() => {
      const s = (x) => x.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      return FG.routes.flatMap((r) => r.pattern === "procurement/:stage" ? FG.C.procurementStages.map((x) => "procurement/" + s(x.name))
        : r.pattern === "grants/:stage" ? FG.C.grantStages.map((x) => "grants/" + s(x.name)) : r.pattern === "analysis/:id" ? [] : [r.pattern]);
    });
    for (const p of all) {
      await page.evaluate((x) => { location.hash = "#/" + x; }, p);
      await page.waitForTimeout(60);
      const info = await page.evaluate(() => ({ len: document.querySelector("#content").innerText.length, wide: document.documentElement.scrollWidth - innerWidth, h1: document.querySelector("#content h1")?.textContent }));
      if (info.len < 150) problems.push(`${vp.width} ${p}: almost empty (${info.len} chars)`);
      if (info.wide > 1) problems.push(`${vp.width} ${p}: horizontal overflow ${info.wide}px`);
    }
    // Interactions: engine recompute, save to case, sample analysis, search palette, scenarios.
    await page.evaluate(() => { location.hash = "#/engines/procurement"; });
    await page.fill("[name=amount]", "190000");
    assert.match(await page.textContent("#result h2"), /International Public Call/);
    await page.click("[data-save-case]");
    assert.equal(await page.textContent("#caseCount"), "1");
    await page.evaluate(() => { location.hash = "#/engines/budget-revision"; });
    await page.selectOption("[name=project]", "vc");
    await page.waitForSelector("[name=donor]");
    await page.evaluate(() => { location.hash = "#/analysis"; });
    await page.click("[data-sample]");
    await page.waitForSelector(".hbar");
    assert.ok((await page.textContent("#content")).includes("over budget") || (await page.textContent("#content")).includes("Over"));
    await page.screenshot({ path: path.join(shots, `analysis-${vp.width}.png`), fullPage: false });
    // Real upload path with CSV files (Excel uses the same parser after SheetJS reads the sheet).
    await page.evaluate(() => { location.hash = "#/analysis"; });
    await page.click("[data-add]");
    await page.waitForSelector("[data-file=budget]");
    await page.setInputFiles("[data-file=budget]", { name: "budget.csv", mimeType: "text/csv", buffer: Buffer.from("Budget Line;Description;Approved Budget\n1.1;Staff;1000\n2.1;Travel;500\n") });
    await page.waitForSelector(".drop.ok");
    await page.setInputFiles("[data-file=report]", { name: "q2.csv", mimeType: "text/csv", buffer: Buffer.from("Budget Line;Actual Expenditure;Open Commitments\n1.1;900;200\n2.1;100;0\n") });
    await page.waitForSelector(".hbar");
    assert.match(await page.textContent("#content"), /€1,500/);
    await page.keyboard.press("Control+k");
    await page.fill("#paletteInput", "petty");
    assert.match(await page.textContent("#paletteList"), /Petty cash/);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(80);
    assert.equal(await page.evaluate(() => FG.path()), "petty-cash");
    await page.evaluate(() => { location.hash = "#/scenarios"; });
    await page.click("[data-sc] >> nth=0");
    assert.ok(await page.$(".feedback"));
    for (const p of ["home", "procurement/thresholds-and-procedure", "engines/year-end", "po-file"]) {
      await page.evaluate((x) => { location.hash = "#/" + x; }, p);
      await page.waitForTimeout(2500); // let the view transition and toast finish
      await page.screenshot({ path: path.join(shots, `${p.replace(/\//g, "_")}-${vp.width}.png`) });
    }
    console.log(`${vp.width}px ${theme}: ${all.length} routes visited`);
    await page.close();
  }
  await browser.close();
  if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
  console.log("Browser checks passed.");
})().catch((e) => { console.error(e); process.exit(1); });
