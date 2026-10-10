/* Prevent a route change from switching the application to another design. */
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { setTimeout: pause } = require("node:timers/promises");
const { chromium } = require("playwright");
const root = path.resolve(__dirname, "..");
const port = Number(process.env.LEDGER_DESIGN_TEST_PORT || 8768);
const base = `http://127.0.0.1:${port}/`;
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
  ].map((tab) => `project/lang/${tab}`),
];
let checks = 0;
const pass = (message) => console.log(`PASS ${++checks}. ${message}`);
async function go(page, route) {
  await page.evaluate((route) => {
    location.hash = "#/" + route;
  }, route);
  await page.waitForFunction(
    (route) => document.querySelector("main")?.dataset.page === route,
    route.split("/")[0],
  );
}
async function fingerprint(page) {
  return page.evaluate(() => {
    const main = document.querySelector("main"),
      side = document.querySelector(".side"),
      title = document.querySelector("#title"),
      top = document.querySelector(".top"),
      style = (element) => getComputedStyle(element);
    return {
      sideWidth: side.getBoundingClientRect().width,
      sideBackground: style(side).backgroundColor,
      sideColor: style(side.querySelector("a:not(.on)")).color,
      titleFamily: style(title).fontFamily,
      titleSize: style(title).fontSize,
      titleWeight: style(title).fontWeight,
      mainPadding: style(main).padding,
      topPadding: style(top).padding,
    };
  });
}
async function open(page, selector) {
  const node = page.locator(selector);
  if (!(await node.evaluate((element) => element.open)))
    await node.locator(":scope > summary").click();
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
    for (let i = 0; ; i++) {
      try {
        if ((await fetch(base)).ok) break;
      } catch {}
      if (i > 40) throw Error("Design test server unavailable");
      await pause(100);
    }
    for (const file of ["index.html", "sw.js"]) {
      const response = await fetch(base + file);
      assert.equal(response.status, 200);
      assert.deepEqual(
        Buffer.from(await response.arrayBuffer()),
        await fs.readFile(path.join(root, file)),
      );
    }
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      headless: true,
      args: ["--no-sandbox"],
    });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1050 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(base);
    await page.waitForSelector(".atelier-page");
    const portfolio = await page.evaluate(() =>
      localStorage.getItem("ledger.portfolio.v1"),
    );
    for (const theme of ["light", "dark"]) {
      await page.evaluate((theme) => {
        document.documentElement.dataset.theme = theme;
        localStorage.setItem("ledger.theme", theme);
      }, theme);
      for (const width of [1440, 768, 390]) {
        await page.setViewportSize({ width, height: 1050 });
        await pause(200);
        await go(page, "home");
        const frame = await fingerprint(page);
        for (const route of routes) {
          await go(page, route);
          assert.deepEqual(
            await fingerprint(page),
            frame,
            `Application frame changed on ${route}, ${width}px, ${theme}`,
          );
          assert.ok(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth + 1,
            ),
            `Document overflow on ${route}, ${width}px, ${theme}`,
          );
          assert.equal(
            await page.locator(".side [aria-current=page]").count(),
            1,
            `Active navigation on ${route}`,
          );
          assert.equal(await page.locator(".recovery-panel").count(), 0);
        }
        pass(
          `All 26 routes share navigation, typography and frame at ${width}px in ${theme} theme`,
        );
      }
    }
    await page.setViewportSize({ width: 1440, height: 1050 });
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "light";
    });
    await go(page, "home");
    assert.equal(
      await page.locator("[data-mp-panel]").count(),
      0,
      "Home is independent from the financial studio",
    );
    assert.ok(
      (await page
        .locator(".atelier-home-panel")
        .first()
        .evaluate((n) => n.getBoundingClientRect().top)) < 760,
    );
    await go(page, "overview/studio");
    assert.equal(
      await page.locator(".studio-scope").evaluate((node) => node.open),
      false,
    );
    assert.equal(
      await page
        .locator(".studio-workspace-settings")
        .evaluate((node) => node.open),
      false,
    );
    const top = await page
      .locator("[data-mp-panel]")
      .first()
      .evaluate((node) => node.getBoundingClientRect().top);
    assert.ok(
      top < 900,
      `Secondary controls push the first chart below ${top}px`,
    );
    await page.locator(".studio-scope > summary").focus();
    await page.keyboard.press("Enter");
    assert.equal(
      await page.locator("[data-studio-scope=country]").isVisible(),
      true,
    );
    await page.locator("[data-studio-scope=country]").selectOption("tr");
    assert.match(
      await page.locator(".studio-selection-count").innerText(),
      /4 \/ 6/,
    );
    await page.reload();
    await page.waitForSelector(".studio-shell");
    assert.equal(
      await page.locator("[data-studio-scope=country]").isVisible(),
      true,
    );
    await page.locator("[data-studio-action=clear-scope]").click();
    await open(page, ".studio-workspace-settings");
    await page.locator('[data-mp="customize"]').click();
    assert.equal(
      await page.locator('[data-mp-handle="allocation"]').isVisible(),
      true,
    );
    await page.locator('[data-mp="customize"]').click();
    pass(
      "Compact controls remain keyboard-accessible; active selection opens on reload and arranging remains available",
    );
    await go(page, "projects");
    await page
      .locator('[data-at="projects-view"][data-value="directory"]')
      .click();
    assert.equal(await page.locator(".rs-studio").isVisible(), true);
    await page.locator('[data-at="projects-view"][data-value="cards"]').click();
    await page
      .locator('.project-summary-card[data-href="#/project/lang"]')
      .focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => location.hash === "#/project/lang");
    await page.waitForSelector(
      'svg[aria-label="Spent, committed and available by project"]',
    );
    await page.waitForSelector(
      'svg[aria-label="Cumulative planned and projected spending"]',
    );
    const colors = await page.evaluate(() => {
      const svg = document.querySelector(
          'svg[aria-label="Spent, committed and available by project"]',
        ),
        forecast = document.querySelector(
          'svg[aria-label="Cumulative planned and projected spending"]',
        );
      return {
        spent: getComputedStyle(
          svg.querySelector('rect[fill="var(--brand)"]:not([opacity])'),
        ).fill,
        committed: getComputedStyle(svg.querySelector('rect[opacity=".45"]'))
          .fill,
        projection: getComputedStyle(
          forecast.querySelector('polyline[stroke="var(--brand)"]'),
        ).stroke,
        legend: getComputedStyle(
          svg.nextElementSibling.querySelector("span:nth-child(2) i"),
        ).backgroundColor,
      };
    });
    assert.notEqual(colors.spent, colors.committed);
    assert.equal(colors.committed, colors.legend);
    assert.notEqual(colors.projection, colors.spent);
    pass(
      "Project cards/table/navigation retain their behavior and project chart colors match financial semantics",
    );
    await go(page, "intel");
    await page.locator('[data-at="source"]').first().click();
    assert.equal(
      await page.locator(".atelier-drawer").evaluate((n) => n.open),
      true,
    );
    await page.keyboard.press("Escape");
    assert.equal(
      await page.evaluate(() => localStorage.getItem("ledger.portfolio.v1")),
      portfolio,
    );
    assert.deepEqual(errors, []);
    pass(
      "Intelligence evidence remains interactive; navigation and design changes preserve portfolio records",
    );
    if (process.env.LEDGER_PREVIEWS === "1") {
      for (const [route, name] of [
        ["home", "home"],
        ["overview", "overview"],
        ["intel", "intelligence"],
        ["projects", "projects"],
        ["team", "people"],
        ["project/lang", "project-detail"],
      ]) {
        await page.goto(base + "#/" + route);
        await page.waitForSelector("#view > *", { state: "attached" });
        await pause(300);
        await page.mouse.move(0, 0);
        await page.screenshot({ path: path.join(root, `docs/${name}.png`) });
      }
      await page.goto(base + "#/overview/studio");
      await page.waitForSelector(".studio-shell");
      for (const [panel, name] of [
        ["trend", "charts"],
        ["register", "register"],
      ]) {
        await page
          .locator(`[data-mp-panel="${panel}"]`)
          .scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(root, `docs/${name}.png`) });
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(base + "#/overview/studio");
      await page.waitForSelector(".studio-shell");
      await pause(300);
      await page.screenshot({
        path: path.join(root, "docs/mobile.png"),
        fullPage: true,
      });
    }
    console.log(
      `\n${checks} design checks passed, including 156 route/theme/viewport comparisons.`,
    );
  } finally {
    if (browser) await browser.close();
    server.kill("SIGTERM");
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
