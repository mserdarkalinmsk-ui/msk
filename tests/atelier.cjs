/* Purpose, shared scope, accountable review, mobile use and representative scale. */
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { setTimeout: pause } = require("node:timers/promises");
const { chromium } = require("playwright");
const root = path.resolve(__dirname, ".."),
  port = Number(process.env.LEDGER_ATELIER_TEST_PORT || 8792),
  base = `http://127.0.0.1:${port}/`;
const KEY = "ledger.portfolio.v1";
let checks = 0;
const pass = (name) => console.log(`PASS ${++checks}. ${name}`);
async function go(page, route) {
  await page.goto(base + "#/" + route);
  await page.locator("#view>*").first().waitFor();
  assert.equal(await page.locator(".recovery-panel").count(), 0);
}
async function exportBackup(page) {
  await page.locator("#cmdk").click();
  await page.locator("#palq").fill("Export JSON backup");
  const pending = page.waitForEvent("download");
  await page
    .getByRole("option")
    .filter({ hasText: "Export JSON backup" })
    .click();
  return JSON.parse(await fs.readFile(await (await pending).path(), "utf8"));
}
async function main() {
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
  const errors = [],
    timings = [];
  try {
    for (let i = 0; ; i++) {
      try {
        if ((await fetch(base)).ok) break;
      } catch {}
      if (i > 40) throw Error("Atelier test server unavailable");
      await pause(100);
    }
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox"],
    });
    const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        reducedMotion: "reduce",
      }),
      page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await go(page, "home");
    const backup = await exportBackup(page),
      original = JSON.stringify(backup.state);
    assert.equal(await page.locator(".home-metrics>.atelier-stat").count(), 4);
    assert.equal(await page.locator("[data-mp-panel]").count(), 0);
    assert.ok(
      (await page
        .locator(".atelier-home-panel")
        .first()
        .evaluate((n) => n.getBoundingClientRect().top)) < 760,
    );
    await go(page, "overview");
    assert.equal(await page.locator(".atelier-welcome").count(), 0);
    assert.equal(await page.locator('[data-mp-panel="allocation"]').count(), 1);
    await go(page, "intel");
    assert.equal(await page.locator(".gauge").count(), 0);
    assert.ok((await page.locator(".atelier-queue-item").count()) > 0);
    pass(
      "Home, Finance and Intelligence answer separate questions with four Home KPIs and visible evidence coverage",
    );
    await page.locator('[data-ledger-scope="c"]').selectOption("tr");
    await page.locator('[data-ledger-scope="project"]').selectOption("lang");
    for (const route of [
      "home",
      "overview",
      "projects",
      "intel",
      "team",
      "calendar",
    ]) {
      await go(page, route);
      assert.match(
        await page.locator(".atelier-selection").innerText(),
        /^1 \/ 6/,
      );
      assert.equal(
        await page.locator('[data-ledger-scope="c"]').inputValue(),
        "tr",
      );
      assert.equal(
        await page.locator('[data-ledger-scope="project"]').inputValue(),
        "lang",
      );
    }
    await go(page, "project/geo");
    assert.equal(
      await page.locator("#title").innerText(),
      "Justice Reform Programme",
    );
    await go(page, "overview");
    const before = await page.locator(".atelier-kpis").innerText();
    await go(page, "overview/history");
    await page.locator('[data-at-history="from"]').fill("2026-01-01");
    await page.locator('[data-at-history="to"]').fill("2026-03-31");
    await go(page, "overview");
    assert.equal(await page.locator(".atelier-kpis").innerText(), before);
    assert.equal(
      await page.evaluate((k) => localStorage.getItem(k), KEY),
      null,
      "Viewing sample records does not silently save them",
    );
    await page.locator('[data-at="reset-scope"]').click();
    pass(
      "One country/project selection follows all six workspaces; report dates leave current financial facts intact",
    );
    await go(page, "home");
    const initial = await page
      .locator("[data-home-panel]")
      .evaluateAll((nodes) => nodes.map((n) => n.dataset.homePanel));
    await page.locator('[data-at="arrange-home"]').click();
    await page.locator('[data-home-handle="decisions"]').focus();
    await page.keyboard.press("Alt+ArrowDown");
    assert.notDeepEqual(
      await page
        .locator("[data-home-panel]")
        .evaluateAll((ns) => ns.map((n) => n.dataset.homePanel)),
      initial,
    );
    await page.reload();
    assert.equal(
      await page
        .locator("[data-home-panel]")
        .first()
        .getAttribute("data-home-panel"),
      "position",
    );
    await page.locator('[data-at="arrange-home"]').click();
    await page
      .locator('[data-home-handle="decisions"]')
      .dragTo(
        page.locator('[data-home-panel="position"] .atelier-section-head'),
      );
    assert.equal(
      await page
        .locator("[data-home-panel]")
        .first()
        .getAttribute("data-home-panel"),
      "decisions",
    );
    pass(
      "Home panel order changes by keyboard and drag, persists on reload and preserves portfolio records",
    );
    await go(page, "projects/directory");
    await page
      .locator('[data-at="table-preset"][data-value="forecast"]')
      .click();
    assert.equal(
      await page.locator(".mp-register th[data-rs-header]").count(),
      6,
    );
    assert.ok(
      await page
        .locator('.mp-register th[data-rs-header="forecast"]')
        .isVisible(),
    );
    await page
      .locator('[data-at="table-preset"][data-value="essential"]')
      .click();
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.locator(".rs-mobile-cards").isVisible());
    assert.equal(await page.locator(".mp-register-scroll").isVisible(), false);
    await page.locator("[data-mp-table-query]").fill("Georgia");
    await page.waitForFunction(
      () => document.querySelectorAll("[data-mobile-project]").length === 1,
    );
    await page.locator("[data-rs-mobile-select]").check();
    assert.match(
      await page.locator(".rs-selection-status").innerText(),
      /1 selected/,
    );
    await page
      .locator('[data-rs-action="mobile-view"][data-value="table"]')
      .click();
    assert.ok(await page.locator(".mp-register-scroll").isVisible());
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    pass(
      "Task table views use six columns; mobile cards and full table share filters and selection",
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    await go(page, "intel");
    await page.locator('[data-at="review"]').first().click();
    await page
      .locator('.atelier-review-dialog [name="status"]')
      .selectOption("reviewed");
    await page
      .locator('.atelier-review-dialog [name="owner"]')
      .fill("Finance team");
    await page
      .locator('.atelier-review-dialog [name="due"]')
      .fill("2026-11-01");
    await page
      .locator('.atelier-review-dialog [name="note"]')
      .fill("<img src=x onerror=alert(1)> Verify the original terms");
    await page.locator('.atelier-review-dialog button[type="submit"]').click();
    await page
      .locator('[data-at-select="queue-status"]')
      .selectOption("reviewed");
    assert.equal(await page.locator(".atelier-queue-item").count(), 1);
    assert.match(
      await page.locator(".atelier-queue-item").innerText(),
      /Finance team/,
    );
    assert.equal(await page.locator(".atelier-review-note img").count(), 0);
    await page.locator('[data-at="review"]').click();
    await page
      .locator('.atelier-review-dialog [name="status"]')
      .selectOption("resolved");
    await page.locator('.atelier-review-dialog button[type="submit"]').click();
    await page
      .locator('[data-at-select="queue-status"]')
      .selectOption("resolved");
    assert.match(
      await page.locator(".atelier-condition").innerText(),
      /still present/,
    );
    const saved = await exportBackup(page);
    assert.equal(Object.values(saved.state.reviewWork).length, 1);
    assert.equal(
      Object.values(saved.state.reviewWork)[0].owner,
      "Finance team",
    );
    await page.locator("#ubtn").click();
    assert.equal(
      Object.values(
        JSON.parse(await page.evaluate((k) => localStorage.getItem(k), KEY))
          .reviewWork,
      )[0].status,
      "reviewed",
    );
    await page.locator("#file").setInputFiles({
      name: "follow-up-roundtrip.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(saved)),
    });
    await page.waitForFunction(
      () =>
        Object.values(
          JSON.parse(localStorage.getItem("ledger.portfolio.v1")).reviewWork,
        )[0].status === "resolved",
    );
    await page.locator("#ubtn").click();
    pass(
      "Reviewed and resolution recorded stay distinct; owner/date/notes survive backup and undo with safe text rendering",
    );
    await page.locator('[data-at-select="queue-status"]').selectOption("all");
    await page.locator('[data-at="source"]').first().click();
    assert.ok(await page.locator(".atelier-drawer").evaluate((n) => n.open));
    assert.match(
      await page.locator(".atelier-drawer").innerText(),
      /Financial versions/i,
    );
    await page.keyboard.press("Escape");
    assert.equal(
      await page.locator(".atelier-drawer").evaluate((n) => n.open),
      false,
    );
    await go(page, "sources");
    await page.locator('[data-at="import"]').click();
    assert.ok(
      await page.locator(".atelier-import-dialog").evaluate((n) => n.open),
    );
    await page.locator("#atelier-import-files").setInputFiles({
      name: "unreadable.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: Buffer.from("invalid zip"),
    });
    const transfer = await page.evaluateHandle(() => {
      const d = new DataTransfer();
      d.items.add(
        new File(["invalid zip"], "unreadable.docx", {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }),
      );
      return d;
    });
    await page
      .locator(".atelier-drop")
      .dispatchEvent("drop", { dataTransfer: transfer });
    assert.equal(
      await page.locator("#dlg3").evaluate((n) => n.open),
      false,
      "The source drop must not also trigger the legacy global import",
    );
    await transfer.dispose();
    await page.locator("#atelier-import-project").selectOption("lang");
    const stateBefore = await page.evaluate(
      (k) => localStorage.getItem(k),
      KEY,
    );
    await page.locator('.atelier-import-dialog button[type="submit"]').click();
    await page.locator('[data-pdi="save"]').waitFor();
    assert.match(
      await page.locator("#ibbox").innerText(),
      /review|recogniz|extract/i,
    );
    assert.equal(
      await page.evaluate((k) => localStorage.getItem(k), KEY),
      stateBefore,
    );
    await page.locator('[data-pdi="save"]').click();
    await page.waitForFunction(
      () => document.querySelector("main").dataset.page === "project",
    );
    const afterImport = JSON.parse(
      await page.evaluate((k) => localStorage.getItem(k), KEY),
    );
    const beforeImport = JSON.parse(stateBefore);
    assert.deepEqual(
      afterImport.projects.map((p) => [p.id, p.budget, p.spent, p.committed]),
      beforeImport.projects.map((p) => [p.id, p.budget, p.spent, p.committed]),
      "Retaining an unparsed original does not invent financial changes",
    );
    await go(page, "sources");
    await page.locator('[data-at-input="sources"]').fill("unreadable.docx");
    await page.waitForFunction(
      () =>
        document.querySelectorAll(".atelier-source-list article").length === 1,
    );
    await page.locator('.atelier-source-list [data-at="source"]').click();
    const downloadPending = page.waitForEvent("download");
    await page
      .locator(".atelier-drawer .atelier-source-version")
      .filter({ hasText: "unreadable.docx" })
      .getByRole("button", { name: "Download original" })
      .click();
    assert.equal(
      (await fs.readFile(await (await downloadPending).path())).toString(),
      "invalid zip",
    );
    await page.keyboard.press("Escape");
    pass(
      "A keyboard-accessible evidence drawer and guided import preview preserve records until the reader review is saved",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await go(page, "home");
    if (
      (await page
        .locator('[data-at="arrange-home"]')
        .getAttribute("aria-pressed")) !== "true"
    )
      await page.locator('[data-at="arrange-home"]').click();
    assert.ok(
      (await page
        .locator(".atelier-home-panel")
        .first()
        .evaluate((n) => n.getBoundingClientRect().top)) < 800,
      "Home decisions should enter the first mobile screen; top=" +
        (await page
          .locator(".atelier-home-panel")
          .first()
          .evaluate((n) => n.getBoundingClientRect().top)),
    );
    const handle = page.locator('[data-home-handle="dates"]');
    await handle.scrollIntoViewIfNeeded();
    const from = await handle.boundingBox();
    const orderBefore = await page
      .locator("[data-home-panel]")
      .evaluateAll((ns) => ns.map((n) => n.dataset.homePanel));
    const cdp = await context.newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: from.x + 15, y: from.y + 12, id: 1 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: from.x + 15, y: Math.max(10, from.y - 55), id: 1 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await pause(100);
    assert.notDeepEqual(
      await page
        .locator("[data-home-panel]")
        .evaluateAll((ns) => ns.map((n) => n.dataset.homePanel)),
      orderBefore,
      "Native touch dragging must move a panel",
    );
    await cdp.detach();
    await go(page, "calendar/agenda");
    assert.ok(
      (await page
        .locator(".atelier-agenda")
        .evaluate((n) => n.getBoundingClientRect().top)) < 800,
    );
    await page.locator("#more").click();
    assert.equal(await page.locator(".mobile-menu-grid a").count(), 8);
    await page.locator('.mobile-menu-grid [data-r="team"]').click();
    await page.waitForFunction(
      () => document.querySelector("#title").textContent === "People",
    );
    assert.equal(await page.locator("#title").innerText(), "People");
    pass(
      "Mobile agenda reaches meaningful content within the first screen and the full navigation remains accessible",
    );
    const compareContext = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    });
    const comparisonData = JSON.parse(original),
      cp = comparisonData.projects.find((p) => p.id === "lang");
    comparisonData.countryReports = [
      {
        id: "country-fixture",
        country: "tr",
        date: cp.reportingPeriods
          .filter((q) => q.type !== "Latest Approved Budget")
          .map((q) => q.date)
          .sort()
          .at(-1),
        fileName: "country-fixture.pdf",
        rows: [
          {
            pid: cp.id,
            pmm: "fixture",
            bh: "fixture",
            title: cp.name,
            budget: cp.budget,
            spent: cp.spent,
            exposure: cp.spent + cp.committed,
            remaining: cp.budget - cp.spent - cp.committed,
          },
        ],
        totals: {
          budget: cp.budget,
          spent: cp.spent,
          exposure: cp.spent + cp.committed,
          remaining: cp.budget - cp.spent - cp.committed,
        },
      },
    ];
    await compareContext.addInitScript(
      ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
      { key: KEY, data: comparisonData },
    );
    const comparePage = await compareContext.newPage();
    comparePage.on("pageerror", (e) => errors.push(e.message));
    await go(comparePage, "overview/sources");
    await comparePage
      .locator('[data-ledger-scope="project"]')
      .selectOption("lang");
    assert.equal(
      await comparePage.locator(".atelier-source-comparison tbody tr").count(),
      1,
    );
    assert.match(
      await comparePage
        .locator(".atelier-source-comparison tbody tr td:nth-child(6)")
        .innerText(),
      /€0/,
    );
    await comparePage.evaluate((k) => {
      const s = JSON.parse(localStorage.getItem(k));
      s.countryReports[0].date = "2026-05-31";
      localStorage.setItem(k, JSON.stringify(s));
    }, KEY);
    // Init script would reset this fixture; remove it by using a second context with the changed record.
    const changed = await comparePage.evaluate(
      (k) => JSON.parse(localStorage.getItem(k)),
      KEY,
    );
    await compareContext.close();
    const dateContext = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    await dateContext.addInitScript(
      ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
      { key: KEY, data: changed },
    );
    const datePage = await dateContext.newPage();
    await go(datePage, "overview/sources");
    await datePage
      .locator('[data-ledger-scope="project"]')
      .selectOption("lang");
    assert.match(
      await datePage
        .locator(".atelier-source-comparison tbody tr td:nth-child(6)")
        .innerText(),
      /Dates differ/,
    );
    await dateContext.close();
    pass(
      "Independent country/project comparison respects the shared project scope and withholds differences across different report dates",
    );
    // Bounded DOM rendering with 50, 200 and 1000 realistic independent project records.
    for (const n of [50, 200, 1000]) {
      const c = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        reducedMotion: "reduce",
      });
      const data = {
        ...backup.state,
        log: [],
        countryReports: [],
        projects: Array.from({ length: n }, (_, i) => ({
          id: "scale-" + i,
          code: "PR-" + String(i).padStart(4, "0"),
          name: "Programme " + i,
          country: ["tr", "ge", "ua"][i % 3],
          sector: ["Education", "Justice", "Rights"][i % 3],
          start: "2025-01-01",
          end: "2028-12-31",
          budget: 1000000,
          spent: 100000 + i,
          committed: 10000,
          successor: "Review",
          fte: null,
          people: [],
          activities: [],
          risks: [],
          docs: [],
          reportingPeriods: [],
          budgetLines: [],
          src: { spent: "manual" },
        })),
      };
      await c.addInitScript(
        ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
        { key: KEY, data },
      );
      const p = await c.newPage();
      p.on("pageerror", (e) => errors.push(e.message));
      const start = performance.now();
      await go(p, "projects/directory");
      const loadMs = Math.round(performance.now() - start);
      assert.equal(await p.locator(".rs-data-row").count(), 10);
      assert.equal(
        await p.locator(".mp-register tfoot .mp-col-budget b").innerText(),
        "€" + new Intl.NumberFormat("en-GB").format(n * 1000000),
      );
      assert.match(
        await p.locator(".atelier-selection").innerText(),
        new RegExp("^" + n + " / " + n),
      );
      const filterStart = performance.now();
      await p.locator('[data-ledger-scope="c"]').selectOption("ge");
      assert.match(
        await p.locator(".atelier-selection").innerText(),
        new RegExp("^" + Math.floor((n + 1) / 3) + " / " + n),
      );
      const filterMs = Math.round(performance.now() - filterStart);
      await go(p, "intel");
      assert.ok((await p.locator(".atelier-queue-item").count()) <= 15);
      await go(p, "overview/sources");
      assert.ok(
        (await p.locator(".atelier-source-comparison tbody tr").count()) <= 25,
      );
      await go(p, "calendar/agenda");
      assert.ok((await p.locator(".atelier-agenda article").count()) <= 30);
      assert.ok(
        loadMs < 15000,
        `${n} projects load exceeded 15 seconds: ${loadMs}`,
      );
      timings.push({ projects: n, loadMs, countryFilterMs: filterMs });
      await c.close();
    }
    pass(
      "50/200/1000 project fixtures preserve scope, bounded register/queue/agenda rendering and complete financial totals",
    );
    assert.deepEqual(errors, []);
    await fs.mkdir(path.join(root, "test-results"), { recursive: true });
    await fs.writeFile(
      path.join(root, "test-results/atelier-performance.json"),
      JSON.stringify(
        { generatedAt: new Date().toISOString(), browser: "Chromium", timings },
        null,
        2,
      ),
    );
    console.log("Performance evidence", JSON.stringify(timings));
    if (process.env.LEDGER_PREVIEWS === "1") {
      const c = await browser.newContext({
          viewport: { width: 1440, height: 1000 },
          reducedMotion: "reduce",
        }),
        p = await c.newPage();
      for (const [route, name] of [
        ["home", "home"],
        ["overview", "overview"],
        ["overview/history", "charts"],
        ["projects", "projects"],
        ["intel", "intelligence"],
        ["team", "people"],
        ["calendar", "planning"],
        ["sources", "sources"],
        ["project/lang", "project-detail"],
      ]) {
        await go(p, route);
        await p.screenshot({ path: path.join(root, "docs", name + ".png") });
      }
      await go(p, "projects/directory");
      await p.screenshot({ path: path.join(root, "docs/register.png") });
      await p.setViewportSize({ width: 390, height: 844 });
      await go(p, "home");
      await p.screenshot({ path: path.join(root, "docs/mobile.png") });
      await c.close();
    }
    console.log(`\n${checks} Atelier checks passed.`);
  } finally {
    await browser?.close();
    server.kill("SIGTERM");
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
