/* Browser-level checks of the workspace using isolated, disposable data. */
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { setTimeout: pause } = require("node:timers/promises");
const { chromium } = require("playwright");
const root = path.resolve(__dirname, "..");
const port = Number(process.env.LEDGER_WORKSPACE_TEST_PORT || 8766);
const base = `http://127.0.0.1:${port}/`;
const KEY = "ledger.workspace.v2",
  PORTFOLIO = "ledger.portfolio.v1";
let checks = 0;
const pass = (name) => {
  checks++;
  console.log("PASS " + name);
};
const order = (page) =>
  page
    .locator("[data-mp-panel]")
    .evaluateAll((nodes) => nodes.map((n) => n.dataset.mpPanel));
const preferences = (page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)), KEY);
async function download(page, action) {
  const waiting = page.waitForEvent("download");
  await action();
  return fs.readFile(await (await waiting).path());
}
async function tools(page, action) {
  if (!(await page.locator(".mp-more-tools").evaluate((e) => e.open)))
    await page.locator(".mp-more-tools summary").click();
  await page.locator(`[data-mp="${action}"]`).click();
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
  const errors = [];
  try {
    for (let i = 0; ; i++) {
      try {
        if ((await fetch(base)).ok) break;
      } catch {}
      if (i > 40) throw Error("Server unavailable");
      await pause(100);
    }
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox"],
    });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1100 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base);
    await page.locator('[data-mp-panel="register"]').waitFor();
    await page.locator(".mp-more-tools summary").click();
    const backup = JSON.parse(
      (
        await download(page, () =>
          page.locator('.mp-more-tools [data-act="export"]').click(),
        )
      ).toString(),
    );
    const originalState = JSON.stringify(backup.state);
    await page.evaluate(({ key, data }) => localStorage.setItem(key, data), {
      key: PORTFOLIO,
      data: originalState,
    });
    await page.reload();

    const initial = await order(page);
    await page.locator('[data-mp="customize"]').click();
    await page
      .locator('[data-mp="move-down"][data-panel="allocation"]')
      .click();
    assert.deepEqual((await order(page)).slice(0, 2), ["trend", "allocation"]);
    await page.locator('[data-mp-handle="allocation"]').focus();
    await page.keyboard.press("Alt+ArrowUp");
    assert.deepEqual(await order(page), initial);
    await page
      .locator('[data-mp-panel="allocation"]')
      .evaluate((el) =>
        scrollTo(0, el.getBoundingClientRect().top + scrollY - 100),
      );
    const trendBox = await page
      .locator('[data-mp-panel="trend"]')
      .boundingBox();
    await page
      .locator('[data-mp-handle="allocation"]')
      .dragTo(page.locator('[data-mp-panel="trend"]'), {
        targetPosition: { x: 60, y: trendBox.height * 0.65 },
      });
    assert.deepEqual((await order(page)).slice(0, 2), ["trend", "allocation"]);
    await page.locator('[data-mp-width="allocation"]').selectOption("third");
    assert.ok(
      await page
        .locator('[data-mp-panel="allocation"]')
        .evaluate((e) => e.classList.contains("mp-width-third")),
    );
    await page.locator('[data-mp="pin"][data-panel="allocation"]').click();
    assert.equal((await order(page))[0], "allocation");
    await page.locator('[data-mp="collapse"][data-panel="allocation"]').click();
    assert.equal(await page.locator("#mp-body-allocation").isVisible(), false);
    await page.locator('[data-mp="hide"][data-panel="map"]').click();
    assert.equal(await page.locator('[data-mp-panel="map"]').count(), 0);
    await page.reload();
    assert.equal(await page.locator("#mp-body-allocation").isVisible(), false);
    assert.equal(await page.locator('[data-mp-panel="map"]').count(), 0);
    assert.equal(
      (await preferences(page)).profiles.overview.widths.allocation,
      "third",
    );
    pass(
      "Native drag, keyboard movement, widths, pinning, collapse and visibility persist",
    );

    await page.locator('[data-mp="manage"]').click();
    assert.equal(
      await page.locator('#mp-manager input[type="checkbox"]').count(),
      12,
    );
    await page.locator('[data-mp-visibility="map"]').check();
    await page.locator("[data-mp-density]").selectOption("compact");
    await page.keyboard.press("Escape");
    await page.waitForFunction(
      () => document.activeElement.dataset.mp === "manage",
    );
    assert.equal(
      await page.evaluate(() => document.activeElement.dataset.mp),
      "manage",
    );
    assert.equal(await page.locator('[data-mp-panel="map"]').count(), 1);
    const layoutFile = await download(page, () => tools(page, "export-layout"));
    const customLayout = JSON.parse(layoutFile.toString());
    await tools(page, "reset-layout");
    await page.locator('[data-mp="confirm-reset"]').click();
    assert.deepEqual(await order(page), initial);
    await tools(page, "import-layout");
    await page
      .locator("#mp-layout-import")
      .setInputFiles({
        name: "layout.json",
        mimeType: "application/json",
        buffer: layoutFile,
      });
    await page.waitForFunction(
      (key) =>
        JSON.parse(localStorage.getItem(key)).profiles.overview.widths
          .allocation === "third",
      KEY,
    );
    const { app: layoutApp, ...expectedPreferences } = customLayout;
    assert.deepEqual(await preferences(page), expectedPreferences);
    pass(
      "Panel manager, density, focus restoration and layout export/import/reset work",
    );

    // Layout settings use a separate storage key and never write portfolio records.
    assert.equal(
      await page.evaluate((key) => localStorage.getItem(key), PORTFOLIO),
      originalState,
    );
    await page.locator('[data-mp="profile"][data-profile="finance"]').click();
    assert.equal(await page.locator('[data-mp-panel="pace"]').count(), 1);
    assert.equal(await page.locator('[data-mp-panel="forecast"]').count(), 1);
    assert.equal(await page.locator('[data-mp-panel="map"]').count(), 0);
    const actualsBefore = await page.locator(".metric-spent b").textContent();
    await page.locator("[data-mp-scenario]").evaluate((el) => {
      el.value = "25";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.locator("[data-mp-scenario]").dispatchEvent("change");
    assert.equal(await page.locator("#fk").inputValue(), "25");
    assert.equal(
      await page.locator(".metric-spent b").textContent(),
      actualsBefore,
    );
    await page.locator('[data-mp="profile"][data-profile="overview"]').click();
    assert.equal(await page.locator("#mp-body-allocation").isVisible(), false);
    await page.locator('[data-mp="profile"][data-profile="delivery"]').click();
    assert.equal(await page.locator('[data-mp-panel="deadlines"]').count(), 1);
    assert.equal(await page.locator('[data-mp-panel="findings"]').count(), 1);
    assert.equal(
      await page.evaluate((key) => localStorage.getItem(key), PORTFOLIO),
      originalState,
    );
    pass(
      "Independent profiles and scenarios preserve stored portfolio and actuals",
    );

    for (const width of [320, 390, 768, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const profile of ["overview", "finance", "delivery"]) {
        await page
          .locator(`[data-mp="profile"][data-profile="${profile}"]`)
          .click();
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          `${profile}: overflow at ${width}`,
        );
      }
    }
    pass("All three profiles fit phone, tablet and wide desktop widths");

    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.locator('[data-mp="profile"][data-profile="finance"]').click();
    await page.locator('[data-mp="chart-export"][data-panel="trend"]').click();
    const svg = (
      await download(page, () => page.locator('[data-mp="export-svg"]').click())
    ).toString();
    assert.ok(
      svg.includes("<svg") && svg.includes("<title") && svg.includes("<desc"),
    );
    assert.ok(!svg.includes('url("http') && !svg.includes("url(&quot;http"));
    assert.ok(/stop-color: rgb/.test(svg));
    const png = await download(page, () =>
      page.locator('[data-mp="export-png"]').click(),
    );
    assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(png.readUInt32BE(16), 1800);
    await page.keyboard.press("Escape");
    for (const panel of ["pace", "composition"]) {
      if (panel === "composition")
        await page
          .locator('[data-mp="profile"][data-profile="overview"]')
          .click();
      await page
        .locator(`[data-mp="chart-export"][data-panel="${panel}"]`)
        .click();
      const image = await download(page, () =>
        page.locator('[data-mp="export-png"]').click(),
      );
      assert.equal(image.readUInt32BE(16), 1800);
      await page.keyboard.press("Escape");
    }
    pass(
      "Trend, scatter and composition export as real 1800px PNGs; SVG retains theme and gradients",
    );

    await page.locator(".mp-columns summary").click();
    await page.locator('[data-mp-column="committed"]').check();
    assert.equal(
      await page.locator(".mp-columns").evaluate((e) => e.open),
      true,
    );
    assert.equal(
      await page.evaluate(() => document.activeElement.dataset.mpColumn),
      "committed",
    );
    await page.locator('[data-mp-column="elapsed"]').check();
    await page.locator(".mp-columns summary").click();
    await page.locator('[data-mp-table="group"]').selectOption("country");
    assert.equal(await page.locator(".mp-register-group").count(), 3);
    await page.locator('[data-mp-table="group"]').selectOption("none");
    await page.locator('[data-mp="sort"][data-column="spent"]').click();
    assert.match(
      await page.locator(".mp-register tbody tr").last().textContent(),
      /Youth Democratic/,
    );
    await page.locator('[data-mp="sort"][data-column="spent"]').click();
    assert.match(
      await page.locator(".mp-register tbody tr").last().textContent(),
      /Youth Democratic/,
    );
    await page.locator("[data-mp-table-query]").pressSequentially("Language");
    assert.equal(await page.locator("[data-mp-row-select]").count(), 1);
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      "mp-register-query",
    );
    await page.locator("[data-mp-table-query]").fill("");
    await page.locator('[data-mp-row-select="lang"]').check();
    await page.locator('[data-mp-row-select="geo"]').check();
    assert.equal(
      await page
        .locator("[data-mp-page-select]")
        .evaluate((e) => e.indeterminate),
      true,
    );
    const csv = (
      await download(page, () =>
        page.locator('[data-mp="table-export"]').click(),
      )
    ).toString("utf8");
    assert.equal(csv.split("\r\n").length, 3);
    assert.match(csv, /Language Rights/);
    assert.match(csv, /Justice Reform/);
    await page.locator('[data-mp="row-detail"][data-row="lang"]').click();
    assert.equal(await page.locator(".mp-register-detail").count(), 1);
    assert.match(
      await page.locator(".mp-register-detail").textContent(),
      /report_4.xlsx/,
    );
    pass(
      "Table search, null-last sorting, grouping, persistent columns, selection CSV and source details work",
    );

    const report = (id, date, spent, committed) => ({
      id,
      date,
      name: id,
      type: "Quarterly Financial Report",
      typeGroup: "Quarterly Financial Report",
      snapshot: {
        lines: [
          {
            code: "1",
            description: "Costs",
            approved: 1000,
            actual: spent,
            committed,
            spentCommitted: spent + committed,
          },
        ],
        totals: {
          approved: 1000,
          actual: spent,
          committed,
          spentCommitted: spent + committed,
        },
      },
    });
    const project = (id, name, reports) => ({
      id,
      name,
      code: id.toUpperCase(),
      country: "tr",
      sector: "Education",
      funding: "Joint Programme",
      start: "2025-01-01",
      end: "2028-12-31",
      budget: 1000,
      spent: 0,
      committed: 0,
      status: "Active",
      reportingPeriods: reports,
    });
    const fixture = {
      ...backup.state,
      projects: [
        project("snap", "=Snapshot test", [
          report("first", "2025-01-31", 200, 50),
          report("second", "2025-06-30", 400, 100),
        ]),
        project("zero", "Known zero", [
          report("zero-report", "2025-01-31", 0, 0),
        ]),
        project("missing", "Missing actuals", []),
      ],
    };
    await page.evaluate(
      ({ key, data, layoutKey }) => {
        localStorage.setItem(key, JSON.stringify(data));
        localStorage.removeItem(layoutKey);
        localStorage.removeItem("ledger.filters.v1");
      },
      { key: PORTFOLIO, data: fixture, layoutKey: KEY },
    );
    await page.reload();
    await page
      .locator('[data-mp-panel="trend"] .mp-data-disclosure summary')
      .click();
    const cells = await page
      .locator('[data-mp-panel="trend"] tbody tr')
      .evaluateAll((rows) =>
        rows.map((row) => [...row.cells].map((cell) => cell.textContent)),
      );
    assert.deepEqual(cells, [
      ["2025-01-31", "€200", "€250", "2/3", "2/3"],
      ["2025-06-30", "€400", "€500", "2/3", "2/3"],
    ]);
    await page.locator(".mp-point").first().focus();
    await page.keyboard.press("Enter");
    assert.match(
      await page.locator(".mp-trend-readout").textContent(),
      /2025-01-31/,
    );
    const zeroRow = page
      .locator(".mp-register tbody tr")
      .filter({ has: page.locator('[data-mp-row-select="zero"]') });
    const missingRow = page
      .locator(".mp-register tbody tr")
      .filter({ has: page.locator('[data-mp-row-select="missing"]') });
    assert.equal(await zeroRow.locator(".mp-col-spent").textContent(), "€0");
    assert.match(
      await missingRow.locator(".mp-col-spent").textContent(),
      /Not recorded/,
    );
    const fixtureCSV = (
      await download(page, () =>
        page.locator('[data-mp="table-export"]').click(),
      )
    ).toString();
    assert.match(fixtureCSV, /"'=Snapshot test"/);
    pass(
      "Controlled fixture proves snapshots are never added; known zero differs from missing; CSV formulas are escaped",
    );

    fixture.projects = [
      project("refund", "Signed correction", [
        report("refund-report", "2025-06-30", -100, 50),
      ]),
      project("over", "Over budget", [
        report("over-report", "2025-06-30", 1100, 100),
      ]),
    ];
    await page.evaluate(
      ({ key, data }) => localStorage.setItem(key, JSON.stringify(data)),
      { key: PORTFOLIO, data: fixture },
    );
    await page.reload();
    assert.match(
      await page.locator(".mp-allocation-list").textContent(),
      /Signed adjustment/,
    );
    assert.match(
      await page.locator(".mp-allocation-list").textContent(),
      /€200 over budget/,
    );
    await page
      .locator('[data-mp="allocation-scale"][data-value="percent"]')
      .click();
    assert.ok(
      await page
        .locator(".mp-allocation-track")
        .evaluateAll((tracks) =>
          tracks.every(
            (track) =>
              [...track.querySelectorAll("i")].reduce(
                (sum, bar) => sum + parseFloat(bar.style.width),
                0,
              ) <= 100.01,
          ),
        ),
    );
    await page.locator('[data-mp="manage"]').click();
    for (const box of await page
      .locator('#mp-manager input[type="checkbox"]')
      .all())
      await box.uncheck();
    await page.keyboard.press("Escape");
    await page.locator(".mp-grid .mp-empty").waitFor();
    assert.equal(await page.locator(".mp-panel").count(), 0);
    await page.locator('.mp-empty [data-mp="manage"]').click();
    await page.locator('[data-mp-visibility="register"]').check();
    await page.keyboard.press("Escape");
    await page.locator('[data-mp-panel="register"]').waitFor();
    pass(
      "Signed corrections and overspend stay explicit; an empty layout can restore its panels",
    );

    fixture.projects = Array.from({ length: 27 }, (_, i) =>
      project("p" + i, "Project " + String(i).padStart(2, "0"), []),
    );
    await page.evaluate(
      ({ key, data, layoutKey }) => {
        localStorage.setItem(key, JSON.stringify(data));
        localStorage.removeItem(layoutKey);
      },
      { key: PORTFOLIO, data: fixture, layoutKey: KEY },
    );
    await page.reload();
    assert.equal(await page.locator("[data-mp-row-select]").count(), 10);
    assert.equal(
      await page.locator(".mp-register tfoot .mp-col-budget b").textContent(),
      "€27,000",
    );
    await page.locator('[data-mp="page-next"]').click();
    assert.equal(await page.locator("[data-mp-row-select]").count(), 10);
    assert.equal(
      await page.locator(".mp-register tfoot .mp-col-budget b").textContent(),
      "€27,000",
    );
    await page.locator('[data-mp="page-next"]').click();
    assert.equal(await page.locator("[data-mp-row-select]").count(), 7);
    assert.equal(
      await page.locator('[data-mp="page-next"]').isDisabled(),
      true,
    );
    await page.locator('[data-mp-table="pageSize"]').selectOption("50");
    assert.equal(await page.locator("[data-mp-row-select]").count(), 27);
    pass(
      "Pagination keeps all-filtered totals, correct last-page counts and page-size changes",
    );

    const mobile = await browser.newContext({
      viewport: { width: 390, height: 1000 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: "reduce",
    });
    const touch = await mobile.newPage();
    touch.on("pageerror", (e) => errors.push(e.message));
    await touch.goto(base);
    await touch.locator('[data-mp="customize"]').click();
    await touch.locator('[data-mp-handle="trend"]').scrollIntoViewIfNeeded();
    await touch.evaluate(() => {
      const p = document.querySelector('[data-mp-panel="trend"]');
      scrollTo(0, p.getBoundingClientRect().top + scrollY - 750);
    });
    const from = await touch.locator('[data-mp-handle="trend"]').boundingBox();
    const to = await touch
      .locator('[data-mp-panel="allocation"]')
      .boundingBox();
    const session = await mobile.newCDPSession(touch);
    const x = from.x + from.width / 2,
      y = from.y + from.height / 2,
      targetY = Math.max(160, to.y + 45);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    for (let i = 1; i <= 12; i++) {
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: y + ((targetY - y) * i) / 12 }],
      });
      await pause(20);
    }
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    assert.equal((await order(touch))[0], "trend");
    await touch.reload();
    assert.equal((await order(touch))[0], "trend");
    await mobile.close();
    pass("Actual touch input reorders panels on a phone and survives reload");
    assert.deepEqual(errors, []);
    console.log(`\n${checks} workspace checks passed.`);
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
