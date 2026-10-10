/* Run against an isolated browser profile; never touches a user's portfolio. */
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { setTimeout: pause } = require("node:timers/promises");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const port = Number(process.env.LEDGER_TEST_PORT || 8765);
const base = `http://127.0.0.1:${port}/`;
const errors = [];
let checks = 0;
function pass(name) {
  checks++;
  console.log(`PASS ${name}`);
}
function watch(page) {
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
}
async function go(page, route = "home") {
  await page.goto(base + "#/" + route);
  await page.waitForFunction(
    () => document.querySelector("#view").children.length > 0,
  );
  assert.equal(
    await page.locator(".recovery-panel").count(),
    0,
    `Broken route: ${route}`,
  );
  assert.ok(await page.locator("#title").textContent());
  assert.deepEqual(errors.splice(0), [], `Console errors on ${route}`);
}
async function palette(page, query, label) {
  await page.locator("#cmdk").click();
  await page.locator("#palq").fill(query);
  await page.getByRole("option").filter({ hasText: label }).click();
}
async function projectCount(page) {
  return page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("ledger.portfolio.v1")).projects.length,
  );
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
  try {
    for (let tries = 0; ; tries++) {
      try {
        if ((await fetch(base)).ok) break;
      } catch {}
      if (tries >= 40) throw new Error("Test server did not become ready");
      await pause(100);
    }
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      headless: true,
      args: ["--no-sandbox"],
    });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    watch(page);
    const routes = [
      "home",
      "overview",
      "intel",
      "monitoring",
      "countries",
      "projects",
      "team",
      "calendar",
      "continuity",
      "brief",
      "data",
      "compare",
      "country/tr",
      "country/tr/monitoring",
      "country/tr/history",
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
      ].map((tab) => "project/lang/" + tab),
      "finance",
      "people",
      "planning",
      "sources",
      "overview/history",
      "overview/forecast",
      "overview/sources",
      "overview/studio",
      "projects/directory",
      "projects/cards",
      "projects/countries",
      "projects/compare",
      "calendar/agenda",
      "calendar/calendar",
      "calendar/timeline",
      "calendar/continuity",
    ];
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const route of routes) {
        await go(page, route);
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          `Page overflow: ${route} at ${width}`,
        );
      }
      pass(
        `${routes.length} screens render at ${width}px without runtime errors or page overflow`,
      );
    }

    await page.setViewportSize({ width: 1440, height: 1000 });
    await go(page);
    assert.equal(await page.locator(".home-metrics > *").count(), 4);
    assert.equal(
      await page.locator(".home-metrics .metric-budget b").textContent(),
      "€38.4M",
    );
    assert.equal(
      await page.locator(".home-metrics .metric-spent b").textContent(),
      "€12.1M",
    );
    await page.locator(".operational-details > summary").click();
    assert.equal(
      await page.locator(".operational-metrics .metric-used b").textContent(),
      "—",
    );
    pass(
      "Dashboard keeps source totals and distinguishes missing coverage from zero",
    );

    await page.locator("[data-ledger-scope=c]").selectOption("tr");
    assert.match(
      await page.locator(".home-metrics .metric-budget .ks").textContent(),
      /4 projects/,
    );
    await page
      .locator("[data-ledger-scope=q]")
      .fill("a-project-that-does-not-exist");
    await page.waitForFunction(() =>
      document.querySelector("#view").textContent.includes("No projects match"),
    );
    await page.locator('#view [data-act="reset"]').click();
    await page.waitForFunction(() =>
      document
        .querySelector(".metric-budget .ks")
        ?.textContent.includes("6 projects"),
    );
    pass("Country and search filters, empty state and reset work");

    await go(page, "overview/studio");
    await page.locator('[data-act="mm"][data-id="att"]').click();
    assert.equal(
      await page
        .locator('[data-act="mm"][data-id="att"]')
        .getAttribute("aria-pressed"),
      "true",
    );
    const originalBox = await page.locator("#map").getAttribute("viewBox");
    await page.locator('[data-act="mz"][data-id="in"]').click();
    assert.notEqual(
      await page.locator("#map").getAttribute("viewBox"),
      originalBox,
    );
    await page.locator('#map [data-cid="tr"]').focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => location.hash === "#/country/tr");
    pass("Map modes, zoom and keyboard country navigation work");

    await palette(page, "Staff", "Staff");
    await page.waitForFunction(() => location.hash === "#/team");
    await palette(page, "Scenario analysis", "Scenario analysis");
    await page.waitForFunction(
      () =>
        location.hash === "#/overview" &&
        document.querySelector("#fk").value === "15",
    );
    await palette(page, "Clear filters", "Clear filters");
    assert.equal(await page.locator("#fk").inputValue(), "0");
    await page.locator("#cmdk").click();
    await page.locator("#palq").fill("no matching commands 1234");
    assert.equal(
      await page.locator("#palq").getAttribute("aria-activedescendant"),
      null,
    );
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#pal").evaluate((e) => e.open), false);
    pass(
      "Command palette includes Staff, routes scenarios correctly and handles no matches",
    );

    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await go(page);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
    }
    pass("Dashboard fits phone, tablet and desktop widths");

    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.locator(".side a:visible").count(), 4);
    await page.locator("#more").click();
    assert.equal(
      await page.locator("#more").getAttribute("aria-expanded"),
      "true",
    );
    assert.equal(await page.locator(".mobile-menu-grid a").count(), 8);
    await page.locator('.mobile-menu-grid a[data-r="team"]').click();
    await page.waitForFunction(() => location.hash === "#/team");
    assert.equal(
      await page.locator("#mobile-menu").evaluate((e) => e.open),
      false,
    );
    assert.equal(
      await page.locator("#more").getAttribute("aria-expanded"),
      "false",
    );
    await page.locator("#more").click();
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => document.activeElement.id), "more");
    pass(
      "Five-item mobile navigation, full page menu and focus restoration work",
    );

    await go(page, "monitoring");
    const matrix = await page.locator(".cm-financial-matrix").evaluate((e) => ({
      width: e.clientWidth,
      scroll: e.scrollWidth,
      table: getComputedStyle(e.querySelector("table")).display,
    }));
    assert.equal(matrix.table, "block");
    assert.ok(matrix.scroll <= matrix.width + 1);
    await page.locator(".cm-detail-button").first().scrollIntoViewIfNeeded();
    assert.ok(await page.locator(".cm-detail-button").first().isVisible());
    pass(
      "Financial monitoring uses readable mobile cards with accessible details",
    );

    await page.setViewportSize({ width: 1440, height: 1000 });
    await go(page, "countries");
    for (const name of ["Türkiye", "Georgia", "Ukraine"]) {
      assert.ok(
        await page.getByRole("heading", { name, exact: true }).isVisible(),
      );
    }
    await page.locator("#theme").click();
    assert.equal(
      await page.evaluate(() => document.documentElement.dataset.theme),
      "dark",
    );
    await page.locator(".country-premium-name h3").first().waitFor();
    const colors = await page.evaluate(() => {
      const e = document.querySelector(".country-premium-name h3");
      return {
        ink: getComputedStyle(e).color,
        bg: getComputedStyle(e.closest(".country-premium-head"))
          .backgroundColor,
      };
    });
    assert.ok(
      colors.ink && colors.bg,
      "Country colors resolve on the current rendered view",
    );
    assert.notEqual(colors.ink, colors.bg);
    for (const route of [
      "home",
      "overview",
      "projects",
      "monitoring",
      "countries",
    ])
      await go(page, route);
    await page.reload();
    assert.equal(
      await page.evaluate(() => document.documentElement.dataset.theme),
      "dark",
    );
    assert.equal(
      await page.locator("#theme").getAttribute("aria-label"),
      "Switch to light theme",
    );
    pass("Dark theme persists, names stay visible and major screens render");

    await go(page);
    await palette(page, "Add project by hand", "Add project by hand");
    assert.equal(await page.locator("#dlg").evaluate((e) => e.open), true);
    await page.locator("#fsave").click();
    assert.match(
      await page.locator("#ferr").textContent(),
      /Enter a project name/,
    );
    const form = page.locator("#form");
    await form.locator('[name="name"]').fill("Refinement test project");
    await form.locator('[name="code"]').fill("TEST-UI");
    await form.locator('[name="start"]').fill("2026-01-01");
    await form.locator('[name="end"]').fill("2028-12-31");
    await form.locator('[name="budget"]').fill("123456");
    await form.locator('[name="spent"]').fill("12000");
    await form.locator('[name="committed"]').fill("3400");
    await page.locator("#fsave").click();
    await page.waitForFunction(
      () =>
        document.querySelector("#title").textContent ===
        "Refinement test project",
    );
    assert.equal(await projectCount(page), 7);
    await page.locator("#ubtn").click();
    assert.equal(await projectCount(page), 6);
    await page.locator("#rbtn").click();
    assert.equal(await projectCount(page), 7);
    await page.reload();
    assert.equal(await projectCount(page), 7);
    pass(
      "Project form validation, creation, undo, redo and reload persistence work",
    );

    await page.locator("#cmdk").click();
    await page.locator("#palq").fill("Export JSON backup");
    const downloadPromise = page.waitForEvent("download");
    await page
      .getByRole("option")
      .filter({ hasText: "Export JSON backup" })
      .click();
    const download = await downloadPromise;
    const exported = JSON.parse(
      await fs.readFile(await download.path(), "utf8"),
    );
    assert.equal(exported.state.projects.length, 7);
    assert.equal(
      exported.state.projects.find((p) => p.code === "TEST-UI").budget,
      123456,
    );
    await page.locator("#file").setInputFiles({
      name: "roundtrip.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(exported)),
    });
    await page.waitForFunction(() =>
      document
        .querySelector("#toast")
        .textContent.includes("Imported 7 projects"),
    );
    assert.equal(await projectCount(page), 7);
    await page.reload();
    assert.equal(await projectCount(page), 7);
    pass("Backup export/import preserves all projects and financial values");

    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller)
        await new Promise((resolve) =>
          navigator.serviceWorker.addEventListener(
            "controllerchange",
            resolve,
            { once: true },
          ),
        );
    });
    await go(page);
    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () =>
        document.querySelector("#title").textContent === "Portfolio overview",
    );
    assert.equal(await projectCount(page), 7);
    await context.setOffline(false);
    pass("Hosted app reloads offline with its saved portfolio");

    const standalone = await browser.newContext({
      reducedMotion: "reduce",
      colorScheme: "dark",
    });
    const filePage = await standalone.newPage();
    watch(filePage);
    // The managed cloud browser blocks file:// navigation. Render the complete
    // artifact in an empty document to verify it needs no separate assets.
    await filePage.setContent(
      await fs.readFile(path.join(root, "index.html"), "utf8"),
    );
    assert.equal(
      await filePage.locator("#title").textContent(),
      "Portfolio overview",
    );
    assert.equal(
      await filePage.locator(".home-metrics .metric-budget b").textContent(),
      "€38.4M",
    );
    assert.equal(
      await filePage.evaluate(() => document.documentElement.dataset.theme),
      "dark",
    );
    assert.deepEqual(errors.splice(0), []);
    pass(
      "Self-contained HTML renders without external assets and respects the system theme",
    );

    await page.emulateMedia({ media: "print" });
    await go(page);
    assert.equal(await page.locator(".side").isVisible(), false);
    assert.equal(await page.locator(".home-metrics").isVisible(), true);
    pass("Print layout keeps portfolio metrics and removes navigation");
    assert.deepEqual(errors.splice(0), []);
    console.log(
      `\n${checks} checks passed, including ${routes.length * 2} screen renders.`,
    );
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
