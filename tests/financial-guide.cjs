/* Financial Guide v15: unit checks of the rule engines, then a browser pass over every route. */
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const root = path.resolve(__dirname, "..");
const E = require(path.join(root, "financial-guide/src/engines.js"));
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

/* ---- procurement case planner ---- */
{
  const T = new Date("2026-10-12");
  const pc = (x) => E.procurementCase(x, T);
  assert.equal(pc({ value: 1500 }).key, "direct-low");
  assert.equal(pc({ value: 5000, type: "intellectual" }).key, "direct-low");
  assert.equal(pc({ value: 5000 }).key, "competitive");
  assert.equal(pc({ value: 184000 }).key, "international");
  assert.equal(pc({ value: 20000, ground: "urgency" }).key, "direct-exc");
  assert.ok(pc({ value: 90000, funding: "xb" }).lcr);
  assert.ok(!pc({ value: 90000 }).lcr);
  assert.ok(!pc({ value: 200000, funding: "xb" }).lcr);
  assert.ok(pc({ value: 170000 }).risks.some((r) => /184,000/.test(r[1])));
  assert.ok(pc({ value: 250000, deadline: "2026-12-01" }).late);
  assert.ok(pc({ value: 90000 }).eproc.mandatory);
  assert.ok(!pc({ value: 40000 }).eproc.mandatory);
  assert.equal(pc({ value: 90000, need: "variable" }).contract, "Framework agreement");
  const d = pc({ value: 90000, deadline: "2027-02-01" }); assert.equal(d.timeline[d.timeline.length - 1].to.toISOString().slice(0, 10), "2027-02-01");
}

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
        : r.pattern === "grants/:stage" ? FG.C.grantStages.map((x) => "grants/" + s(x.name)) : [r.pattern]);
    });
    for (const p of all) {
      await page.evaluate((x) => { location.hash = "#/" + x; }, p);
      await page.waitForTimeout(60);
      const info = await page.evaluate(() => ({ len: document.querySelector("#content").innerText.length, wide: document.documentElement.scrollWidth - innerWidth, h1: document.querySelector("#content h1")?.textContent }));
      if (info.len < 150) problems.push(`${vp.width} ${p}: almost empty (${info.len} chars)`);
      if (info.wide > 1) problems.push(`${vp.width} ${p}: horizontal overflow ${info.wide}px`);
    }
    // Interactions: engine recompute, search palette, scenarios.
    await page.evaluate(() => { location.hash = "#/engines/procurement"; });
    await page.fill("[name=amount]", "190000");
    assert.match(await page.textContent("#result h2"), /International Public Call/);
    await page.evaluate(() => { location.hash = "#/engines/budget-revision"; });
    await page.selectOption("[name=project]", "vc");
    await page.waitForSelector("[name=donor]");
    // VAT and Events logic.
    const L = await page.evaluate(() => ({
      big: FG.logic.paymentMethod(6000, 0).title, month: FG.logic.paymentMethod(4000, 27000).title, card: FG.logic.paymentMethod(4000, 1000).title,
      due: FG.logic.paymentDue("2026-03-01", "2026-03-10").due.toISOString().slice(0, 10),
      ev: FG.logic.eventBudget([{ item: "a", initial: 100, final: 120 }, { item: "b", initial: 50, final: 50 }]),
    }));
    assert.equal(L.big, "Bank transfer"); assert.equal(L.month, "Bank transfer"); assert.equal(L.card, "Card possible as an exception");
    assert.equal(L.due, "2026-05-09");
    assert.equal(L.ev.diff, 20); assert.equal(L.ev.changed.length, 1);
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
