/* Compare the additive build with the uploaded engine in disposable profiles. */
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const { setTimeout: pause } = require("node:timers/promises");
const { chromium } = require("playwright");
const root = path.resolve(__dirname, "..");
const port = Number(process.env.LEDGER_PROFESSIONAL_TEST_PORT || 8796);
const base = `http://127.0.0.1:${port}/`;
const results = path.join(root, "test-results/preserve");
const boot =
  "S.projects.forEach(p=>{try{resolveProject(p)}catch(e){}});\nsyncBar();render();";
const probe = `
let testFinCalls=0; const testFinOriginal=finAt;
finAt=function(...args){testFinCalls++;return testFinOriginal(...args)};
window.__test40={
state:()=>JSON.parse(JSON.stringify(S)), facts:()=>JSON.parse(JSON.stringify(rows().map(r=>({...r,p:undefined})))),
filter:(k,v)=>setF(k,v), openForm:()=>openForm(), undo, redo,
replaceState:(x)=>{S=migrate(x);S.projects.forEach(resolveProject);F={q:'',c:'all',s:'all',g:'all',k:0,fm:'auto',ds:'',de:''};syncBar();render()},
output:(route)=>V[route]().html,
measure:(route)=>{testFinCalls=0;const start=performance.now();const html=V[route]().html;return{ms:performance.now()-start,calls:testFinCalls,hash:html.length}}
};
`;
const routes = [
  "home",
  "overview",
  "intel",
  "countries",
  "projects",
  "calendar",
  "continuity",
  "brief",
  "data",
  "country/tr",
  "project/lang",
  ...[
    "finance",
    "reports",
    "monthly",
    "contract",
    "plan",
    "results",
    "activities",
    "people",
    "risks",
    "successor",
  ].map((t) => `project/lang/${t}`),
];
let checks = 0;
const pass = (message) => console.log(`PASS ${++checks}. ${message}`);
async function go(page, variant, route) {
  await page.goto(`${base}test-results/preserve/${variant}.html#/${route}`);
  await page.waitForSelector("#view > *");
}
async function digest(page) {
  return page.evaluate(() => {
    const clone = document.querySelector("#view").cloneNode(true);
    clone
      .querySelectorAll(".lp-table-tools,.lp-chart-tools")
      .forEach((x) => x.remove());
    return {
      title: document.querySelector("#title").textContent,
      nav: [...document.querySelectorAll(".side a")].map((a) => [
        a.textContent,
        a.getAttribute("href"),
        a.classList.contains("on"),
      ]),
      headings: [...clone.querySelectorAll("h2,h3")].map((x) => x.textContent),
      text: clone.textContent.replace(/\s+/g, " ").trim(),
      tables: [...clone.querySelectorAll("table")].map((t) =>
        [...t.rows].map((r) => [...r.cells].map((c) => c.textContent)),
      ),
      cards: [...clone.querySelectorAll(".card")].map(
        (c) => c.querySelector("h2")?.textContent || c.className,
      ),
      charts: [
        ...clone.querySelectorAll("svg[role='img'],svg[aria-label]"),
      ].map((s) => [
        s.getAttribute("aria-label"),
        s.getAttribute("viewBox"),
        s.querySelectorAll("path,rect,polyline,circle").length,
      ]),
    };
  });
}
const median = (values) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
async function main() {
  const original = await fs.readFile(
    path.join(root, "src/original/portfolio-ledger-40.html"),
    "utf8",
  );
  const enhanced = await fs.readFile(
    path.join(root, "portfolio-ledger-professional.html"),
    "utf8",
  );
  const stripped = enhanced
    .replace(
      /<!-- PROFESSIONAL_STYLE_START -->[\s\S]*?<!-- PROFESSIONAL_STYLE_END -->\n/,
      "",
    )
    .replace(
      /\/\* PROFESSIONAL_EXTENSION_START \*\/[\s\S]*?\/\* PROFESSIONAL_EXTENSION_END \*\/\n/,
      "",
    );
  assert.equal(stripped, original);
  assert.equal(
    crypto.createHash("sha256").update(original).digest("hex"),
    "af4f7a60b46f6b092bd7c84abd4f95e83ca81d041dabc92366f823c3cf2fc45e",
  );
  pass(
    "Removing the two extension blocks restores the exact uploaded HTML, including every original function and embedded reader",
  );
  const demo = JSON.parse(original.match(/const DEMO=(.*);\nconst KEY=/)[1]);
  demo.projects.forEach((p) =>
    ["budgetLines", "actuals", "activities", "people", "riskRegister"].forEach(
      (k) =>
        (p[k] || []).forEach((x, i) => {
          x.id ||= `${k}-${i}`;
        }),
    ),
  );
  await fs.mkdir(results, { recursive: true });
  await fs.writeFile(
    path.join(results, "baseline.html"),
    original.replace(boot, probe + boot),
  );
  await fs.writeFile(
    path.join(results, "enhanced.html"),
    enhanced.replace(
      "/* PROFESSIONAL_EXTENSION_START */",
      probe + "/* PROFESSIONAL_EXTENSION_START */",
    ),
  );
  const server = spawn(
    "python3",
    [
      "-m",
      "http.server",
      String(port),
      "--bind",
      "127.0.0.1",
      "--directory",
      root,
    ],
    { stdio: "ignore" },
  );
  let browser;
  const errors = [];
  try {
    for (let i = 0; ; i++) {
      try {
        if ((await fetch(base)).ok) break;
      } catch {}
      if (i > 40) throw Error("Server unavailable");
      await pause(100);
    }
    for (const file of [
      "portfolio-ledger-professional.html",
      "src/original/portfolio-ledger-40.html",
    ]) {
      const response = await fetch(base + file);
      assert.equal(response.status, 200);
      assert.deepEqual(
        Buffer.from(await response.arrayBuffer()),
        await fs.readFile(path.join(root, file)),
      );
    }
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox"],
    });
    async function profile() {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        reducedMotion: "reduce",
        acceptDownloads: true,
      });
      await context.addInitScript((state) => {
        if (!localStorage.getItem("ledger.portfolio.v1"))
          localStorage.setItem("ledger.portfolio.v1", JSON.stringify(state));
      }, demo);
      const page = await context.newPage();
      await page.clock.setFixedTime(new Date("2026-10-10T12:00:00Z"));
      page.on("pageerror", (e) => errors.push(e.message));
      return { context, page };
    }
    const a = await profile(),
      b = await profile();
    for (const width of [1440, 390]) {
      await a.page.setViewportSize({ width, height: 1000 });
      await b.page.setViewportSize({ width, height: 1000 });
      for (const route of routes) {
        await go(a.page, "baseline", route);
        await go(b.page, "enhanced", route);
        assert.deepEqual(
          await digest(b.page),
          await digest(a.page),
          `Original content/structure changed: ${route} at ${width}`,
        );
        assert.equal(
          await b.page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          true,
          `Overflow ${route}`,
        );
      }
    }
    assert.deepEqual(errors, []);
    pass(
      `${routes.length} routes retain the original menus, section order, chart marks, tables and content at desktop and phone sizes (42 before/after comparisons)`,
    );
    await a.page.setViewportSize({ width: 1440, height: 1000 });
    await b.page.setViewportSize({ width: 1440, height: 1000 });
    await go(a.page, "baseline", "overview");
    await go(b.page, "enhanced", "overview");
    assert.deepEqual(
      await b.page.evaluate(() => __test40.state()),
      await a.page.evaluate(() => __test40.state()),
    );
    for (const k of [-40, 0, 35])
      for (const fm of ["auto", "plan", "team", "trend"]) {
        for (const p of [a.page, b.page])
          await p.evaluate(
            ([k, fm]) => {
              __test40.filter("k", k);
              __test40.filter("fm", fm);
            },
            [k, fm],
          );
        assert.deepEqual(
          await b.page.evaluate(() => __test40.facts()),
          await a.page.evaluate(() => __test40.facts()),
          `${k}/${fm} financial mismatch`,
        );
        const viewRoutes = routes.slice(0, 9);
        assert.deepEqual(
          await b.page.evaluate((routes) => routes.map((route) => __test40.output(route)), viewRoutes),
          await a.page.evaluate((routes) => routes.map((route) => __test40.output(route)), viewRoutes),
          `${k}/${fm} cached route output mismatch`,
        );
      }
    for (const p of [a.page, b.page])
      await p.evaluate(() => {
        __test40.filter("k", 0);
        __test40.filter("fm", "auto");
      });
    pass(
      "Original records/model fields and 108 cached route outputs match across twelve forecast/scenario combinations",
    );
    const beforePasses = await b.page.evaluate(
      () => LedgerProfessional.getMetrics().passes,
    );
    await b.page.evaluate(() => {
      const input = document.querySelector("#fq");
      for (const text of [
        "L",
        "La",
        "Lan",
        "Lang",
        "Langu",
        "Langua",
        "Languag",
        "Language",
      ]) {
        input.value = text;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    await b.page.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem("ledger.filters.v1")).q === "Language",
    );
    assert.equal(
      (await b.page.evaluate(() => LedgerProfessional.getMetrics().passes)) -
        beforePasses,
      1,
    );
    assert.equal((await b.page.evaluate(() => __test40.facts())).length, 1);
    await b.page.evaluate(() => {
      const input = document.querySelector("#fq");
      input.value = "not-a-project";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      document.querySelector("#freset").click();
    });
    await pause(200);
    assert.equal((await b.page.evaluate(() => __test40.facts())).length, 6);
    await b.page.evaluate(() => {
      const slider = document.querySelector("#fk");
      slider.value = "25";
      slider.dispatchEvent(new Event("input", { bubbles: true }));
      slider.dispatchEvent(new Event("change", { bubbles: true }));
    });
    assert.equal(
      await b.page.evaluate(
        () => JSON.parse(localStorage.getItem("ledger.filters.v1")).k,
      ),
      25,
    );
    await b.page.evaluate(() => document.querySelector("#freset").click());
    await b.page.evaluate(() => __test40.filter("k", 25));
    await b.page.evaluate(() => {
      const slider = document.querySelector("#fk");
      slider.value = "40";
      slider.dispatchEvent(new Event("input", { bubbles: true }));
      document.querySelector('[data-act="resetk"]').click();
    });
    await pause(150);
    assert.deepEqual(await b.page.evaluate(() => [JSON.parse(localStorage.getItem("ledger.filters.v1")).k, document.querySelector("#fk").value, document.querySelector("#fkv").textContent]), [0, "0", "0%"]);
    // Reproduce host integrations which restore scope within the debounce window.
    await b.page.evaluate(() => {
      const filters = JSON.parse(localStorage.getItem("ledger.filters.v1"));
      localStorage.setItem("ledger.fpresets", JSON.stringify([{ name: "All", f: filters }]));
    });
    await b.page.reload();
    await b.page.waitForSelector("#view>*");
    await b.page.evaluate(() => {
      const input = document.querySelector("#fq");
      input.value = "Language"; input.dispatchEvent(new Event("input", { bubbles: true }));
      const preset = document.querySelector("#fpreset");
      preset.value = "0"; preset.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await pause(180);
    assert.deepEqual(await b.page.evaluate(() => [JSON.parse(localStorage.getItem("ledger.filters.v1")).q, document.querySelector("#fq").value, __test40.facts().length]), ["", "", 6]);
    b.page.once("dialog", (dialog) => dialog.accept("Pending selection"));
    await b.page.evaluate(() => {
      const input = document.querySelector("#fq");
      input.value = "Language"; input.dispatchEvent(new Event("input", { bubbles: true }));
      document.querySelector("#fpsave").click();
    });
    assert.equal(await b.page.evaluate(() => JSON.parse(localStorage.getItem("ledger.fpresets")).at(-1).f.q), "Language");
    await b.page.evaluate(() => document.querySelector("#freset").click());
    pass(
      "Search batching, scenario release, reset/preset cancellation and preset save reflect the final visible scope",
    );
    const saved = await b.page.evaluate(() => __test40.state());
    const tableTools = b.page.locator(".lp-table-tools").last();
    await tableTools.locator("input").fill("Language");
    assert.match(
      await tableTools.locator("output").textContent(),
      /1 \/ 6 rows/,
    );
    assert.deepEqual(await b.page.evaluate(() => __test40.state()), saved);
    const csvPending = b.page.waitForEvent("download");
    await tableTools.getByRole("button", { name: "Visible rows CSV" }).click();
    const csv = await fs.readFile(await (await csvPending).path(), "utf8");
    assert.match(csv, /Language Rights Programme/);
    assert.doesNotMatch(csv, /Media Standards/);
    assert.equal(csv.trim().split(/\r?\n/).length, 2);
    await b.page.emulateMedia({ media: "print" });
    assert.equal(
      await b.page
        .locator(".lp-filtered-row")
        .first()
        .evaluate((n) => getComputedStyle(n).display),
      "table-row",
    );
    await b.page.emulateMedia({ media: "screen" });
    const sort = b.page.locator('th[data-sort="name"]').first();
    await sort.focus();
    await b.page.keyboard.press("Enter");
    await b.page.waitForFunction(
      () =>
        document
          .querySelector('th[data-sort="name"]')
          .getAttribute("aria-sort") !== "none",
    );
    await b.page.waitForFunction(() => [...document.querySelectorAll(".lp-table-tools input")].at(-1)?.value === "Language");
    assert.match(await tableTools.locator("output").textContent(), /1 \/ 6 rows/);
    await b.page.locator('th[data-sort="name"]').first().click();
    await b.page.waitForFunction(() => [...document.querySelectorAll(".lp-table-tools input")].at(-1)?.value === "Language");
    const sortedDownload = b.page.waitForEvent("download");
    await tableTools.getByRole("button", { name: "Visible rows CSV" }).click();
    const sortedCSV = await fs.readFile(await (await sortedDownload).path(), "utf8");
    assert.equal(sortedCSV.trim().split(/\r?\n/).length, 2);
    assert.match(sortedCSV, /Language Rights Programme Türkiye/);
    assert.doesNotMatch(sortedCSV, /Media Standards/);
    await tableTools.locator("input").fill("");
    pass(
      "Local table search preserves original totals and records; filtered CSV, complete printing and keyboard sorting work",
    );
    const chart = b.page.locator(".lp-chart-tools").first();
    assert.equal(await chart.count(), 1);
    await b.page.evaluate(() => { __test40.filter("c", "tr"); __test40.filter("k", 35); __test40.filter("fm", "team"); });
    const svgPending = b.page.waitForEvent("download");
    await chart.getByRole("button", { name: /as SVG/ }).click();
    const svgDownload = await svgPending;
    const svg = await fs.readFile(await svgDownload.path(), "utf8");
    assert.match(svg, /xmlns="http:\/\/www.w3.org\/2000\/svg"/);
    assert.match(svg, /<desc>/);
    assert.match(svg, /Scenario: \+35%/);
    assert.match(svg, /Country: Türkiye/);
    assert.match(svg, /Forecast method:/);
    assert.match(svg, /Selected date window:/);
    assert.match(svg, /export time is not a source date/);
    assert.match(svgDownload.suggestedFilename(), /tr-scenario-35/);
    const visibleCaption = svg.slice(0, svg.indexOf('<svg', 5));
    assert.match(visibleCaption, /<text[^>]*>Scenario: \+35%/);
    const pngPending = b.page.waitForEvent("download");
    await chart.getByRole("button", { name: /as PNG/ }).click();
    const png = await fs.readFile(await (await pngPending).path());
    assert.equal(png.subarray(1, 4).toString(), "PNG");
    assert.ok(png.readUInt32BE(16) >= 1799 && png.readUInt32BE(16) <= 1800);
    await chart.getByRole("button", { name: /Inspect/ }).click();
    assert.ok(await b.page.locator(".lp-inspection-values li").count() > 0);
    await b.page.getByRole("button", { name: "Close chart", exact: true }).click();
    await b.page.evaluate(() => document.querySelector("#freset").click());
    pass(
      "SVG/PNG exports carry visible selection, method, scenario and time captions; enlarged chart inspection exposes existing values",
    );
    await b.page.locator("#lp-display-button").click();
    const dlg = b.page.locator(".lp-display");
    await dlg.locator('[data-lp-setting="density"]').selectOption("compact");
    await dlg.locator('[data-lp-setting="reading"]').selectOption("large");
    await dlg.locator('[data-lp-setting="tables"]').uncheck();
    assert.equal(
      await b.page.locator(".lp-table-tools").last().isVisible(),
      false,
    );
    await dlg.locator('[data-lp-setting="design"]').uncheck();
    assert.deepEqual(await b.page.locator("#view td").first().evaluate((cell) => ({ font: getComputedStyle(cell).fontSize, padding: getComputedStyle(cell).paddingTop })), { font: "15px", padding: "8px" });
    assert.equal(await b.page.locator("#view td small").first().evaluate((cell) => getComputedStyle(cell).fontSize), "14px");
    await dlg.locator('[data-lp-setting="fast"]').uncheck();
    await dlg.locator("[data-lp-close]").click();
    const directPasses = await b.page.evaluate(
      () => LedgerProfessional.getMetrics().passes,
    );
    await b.page.evaluate(() => {
      const input = document.querySelector("#fq");
      for (const text of ["L", "La", "Lan"]) {
        input.value = text;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    assert.equal(
      (await b.page.evaluate(() => LedgerProfessional.getMetrics().passes)) -
        directPasses,
      3,
    );
    await b.page.reload();
    await b.page.waitForSelector("#view>*");
    assert.equal(
      await b.page.evaluate(() => LedgerProfessional.getSettings().design),
      false,
    );
    assert.equal(
      await b.page.evaluate(() => document.documentElement.dataset.lpReading),
      "large",
    );
    await b.page.locator("#lp-display-button").click();
    await b.page.locator("[data-lp-reset]").click();
    await b.page.locator("[data-lp-close]").click();
    await b.page.evaluate(() => document.querySelector("#freset").click());
    pass(
      "Each extension can be disabled independently; reading/density preferences persist without altering portfolio records",
    );
    const mobile = await profile();
    await mobile.page.setViewportSize({ width: 390, height: 844 });
    await go(mobile.page, "enhanced", "overview");
    assert.equal(await mobile.page.locator("#bartog").getAttribute("aria-expanded"), "false");
    assert.ok((await mobile.page.locator("#view .card").first().boundingBox()).y < 750);
    await mobile.page.locator("#bartog").click();
    assert.equal(await mobile.page.locator("#bartog").getAttribute("aria-expanded"), "true");
    assert.ok(await mobile.page.locator(".bar").evaluate((node) => node.scrollHeight <= node.clientHeight + 2));
    assert.ok((await mobile.page.locator(".lp-chart-tools .btn").first().boundingBox()).height >= 44);
    const activity = mobile.page.locator('g[data-act="tlexp"]').first();
    assert.equal(await activity.getAttribute("role"), "button");
    const activityId = await activity.getAttribute("data-id");
    await activity.focus(); await mobile.page.keyboard.press("Enter");
    await mobile.page.waitForFunction((id) => document.querySelector(`g[data-id="${id}"]`)?.getAttribute("aria-expanded") === "true", activityId);
    await mobile.page.locator(`g[data-id="${activityId}"]`).focus();
    await mobile.page.keyboard.press("Space");
    await mobile.page.waitForFunction((id) => document.querySelector(`g[data-id="${id}"]`)?.getAttribute("aria-expanded") === "false", activityId);
    await mobile.page.setViewportSize({ width: 320, height: 844 });
    assert.equal(await mobile.page.locator(".side a").first().evaluate((a) => getComputedStyle(a).fontSize), "10.5px");
    await mobile.context.close();
    pass("Phone filters expand without clipping, touch actions are 44px, and activity expansion works with Enter/Space");
    await b.page.evaluate(() => __test40.openForm());
    for (const [name, value] of Object.entries({
      name: "Preserved architecture check",
      code: "CHECK-40",
      sector: "Education",
      start: "2026-01-01",
      end: "2028-12-31",
      budget: "100000",
      spent: "10000",
      committed: "2500",
      fte: "0",
    }))
      await b.page.locator(`#form [name="${name}"]`).fill(value);
    b.page.on("dialog", (d) => d.accept());
    await b.page.locator("#fsave").click();
    await b.page.waitForFunction(() => __test40.state().projects.length === 7);
    const newFact = (await b.page.evaluate(() => __test40.facts())).find(
      (x) => x.b === 100000,
    );
    assert.equal(newFact.u, 12500);
    await b.page.locator("#ubtn").click();
    assert.equal(
      await b.page.evaluate(() => __test40.state().projects.length),
      6,
    );
    await b.page.locator("#rbtn").click();
    assert.equal(
      await b.page.evaluate(() => __test40.state().projects.length),
      7,
    );
    await go(b.page, "enhanced", "data");
    const backupPending = b.page.waitForEvent("download");
    await b.page.locator('[data-act="export"]').first().click();
    const backup = await fs.readFile(await (await backupPending).path());
    const backupData = JSON.parse(backup.toString());
    const backupState = backupData.state || backupData;
    assert.equal(backupState.projects.length, 7);
    await b.page.locator("#file").setInputFiles({
      name: "roundtrip.json",
      mimeType: "application/json",
      buffer: backup,
    });
    await b.page.waitForFunction(() =>
      __test40.state().log[0]?.msg.startsWith("Imported roundtrip"),
    );
    assert.equal(
      await b.page.evaluate(
        () =>
          __test40.state().projects.find((p) => p.code === "CHECK-40").budget,
      ),
      100000,
    );
    pass(
      "The retained project form, zero FTE, undo/redo and original JSON backup import/export remain functional",
    );
    const timings = [];
    for (const n of [50, 200, 1000]) {
      const fixture = JSON.parse(JSON.stringify(demo));
      fixture.projects = Array.from({ length: n }, (_, i) => {
        const p = JSON.parse(
          JSON.stringify(demo.projects[i % demo.projects.length]),
        );
        p.id = "scale-" + i;
        p.name = "Scale project " + i;
        p.code = "S-" + i;
        return p;
      });
      const measured = [];
      for (const page of [a.page, b.page]) {
        await page.evaluate((x) => __test40.replaceState(x), fixture);
        const samples = [];
        for (let i = 0; i < 7; i++)
          samples.push(await page.evaluate(() => __test40.measure("overview")));
        measured.push({
          medianMs: Math.round(median(samples.map((s) => s.ms)) * 10) / 10,
          finAtCalls: samples[0].calls,
        });
      }
      assert.equal(
        await b.page.evaluate(() => __test40.output("overview")),
        await a.page.evaluate(() => __test40.output("overview")),
        `${n} projects changed engine output`,
      );
      assert.ok(
        measured[1].finAtCalls < measured[0].finAtCalls,
        `${n}: expected fewer repeated source calculations`,
      );
      timings.push({
        projects: n,
        original: measured[0],
        enhanced: measured[1],
      });
    }
    await fs.writeFile(
      path.join(results, "performance.json"),
      JSON.stringify(
        {
          measuredAt: new Date().toISOString(),
          method:
            "Median of seven Analytics HTML evaluations; excludes DOM/layout and document parsing",
          timings,
        },
        null,
        2,
      ),
    );
    pass(
      "50/200/1000-project fixtures produce byte-identical Analytics output with fewer repeated source calculations",
    );
    console.log("Performance evidence", JSON.stringify(timings));
    await b.page.evaluate(() => { location.hash = "#/overview"; });
    await b.page.waitForSelector(".lp-chart-tools");
    const tallDownload = b.page.waitForEvent("download");
    await b.page.locator(".lp-chart-tools").first().getByRole("button", { name: /as PNG/ }).click();
    const tallPNG = await fs.readFile(await (await tallDownload).path());
    const tallWidth = tallPNG.readUInt32BE(16), tallHeight = tallPNG.readUInt32BE(20);
    assert.equal(tallPNG.subarray(1, 4).toString(), "PNG");
    assert.ok(tallWidth <= 8192 && tallHeight <= 8192 && tallWidth * tallHeight <= 8000000);
    assert.ok(tallHeight > tallWidth, "Actual tall timeline must retain aspect ratio");
    pass("A real 1,000-project timeline exports PNG within the 8-million-pixel and 8192px limits");
    const standalone = await browser.newContext({
      viewport: { width: 390, height: 844 },
      colorScheme: "dark",
    });
    const filePage = await standalone.newPage();
    const external = [];
    const standaloneURL = "https://ledger-standalone.test/";
    await filePage.route(standaloneURL, (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: enhanced }),
    );
    filePage.on("request", (r) => {
      if (/^https?:/.test(r.url()) && r.url() !== standaloneURL)
        external.push(r.url());
    });
    await filePage.goto(standaloneURL + "#/home");
    await filePage.waitForSelector("#view>*");
    assert.deepEqual(external, []);
    assert.equal(await filePage.locator(".side a").count(), 9);
    assert.equal(
      await filePage.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      true,
    );
    await standalone.close();
    assert.deepEqual(errors, []);
    pass(
      "The distributable opens independently on a phone in dark mode without external requests",
    );
    if (process.env.LEDGER_PREVIEWS === "1") {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        reducedMotion: "reduce",
      });
      const p = await context.newPage();
      for (const route of [
        "home",
        "overview",
        "projects",
        "intel",
        "calendar",
      ]) {
        await p.goto(base + "portfolio-ledger-professional.html#/" + route);
        await p.waitForSelector("#view>*");
        await p.screenshot({
          path: path.join(root, "docs/professional", route + ".png"),
        });
      }
      await p.setViewportSize({ width: 390, height: 1000 });
      await p.goto(base + "portfolio-ledger-professional.html#/overview");
      await p.waitForSelector("#view>*");
      await p.screenshot({
        path: path.join(root, "docs/professional/mobile.png"),
      });
      await context.close();
    }
    console.log(`\n${checks} professional check groups passed.`);
  } finally {
    await browser?.close();
    server.kill();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
