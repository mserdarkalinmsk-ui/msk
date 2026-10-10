/* Staff document evidence and UI checks in a disposable browser profile. */
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { setTimeout: pause } = require("node:timers/promises");
const { chromium } = require("playwright");
const root = path.resolve(__dirname, "..");
const port = Number(process.env.LEDGER_STAFF_TEST_PORT || 8769);
const base = `http://127.0.0.1:${port}/`;
const KEY = "ledger.portfolio.v1";
let checks = 0;
const pass = (description) => console.log(`PASS ${++checks}. ${description}`);
const record = (index, extra = {}) => ({
  name: `SOURCE${index}, Person`,
  code: index % 3 ? "1.1.1.4" : "1.2.1.4",
  position: "Project officer",
  fte: 0.5,
  start: "2025-01-01",
  end: "2030-12-31",
  po: `PO-${index}`,
  sourceSheet: "Purchase Orders",
  sourceRow: index + 8,
  actual: 0,
  exposure: 0,
  review: false,
  ...extra,
});
const projects = [
  {
    id: "alpha",
    code: "ALPHA",
    name: "Alpha programme",
    country: "tr",
    records: [
      record(1, { name: "ZERO, Morgan", fte: 0 }),
      record(2, {
        name: "UNKNOWN, Riley",
        fte: null,
        start: "",
        end: "",
        recordKind: "Payroll observation",
        payrollPeriod: "SEP-26",
        units: 3,
        unit: "months",
        review: true,
      }),
      ...Array.from({ length: 25 }, (_, i) => record(i + 3)),
      record(50, { name: "COMMON, Ada" }),
    ],
  },
  {
    id: "beta",
    code: "BETA",
    name: "Beta programme",
    country: "ge",
    records: [
      record(60, { name: "COMMON, Ada" }),
      record(61),
      record(62, { name: "FORMULA, =SUM(1+1)" }),
    ],
  },
].map((p) => ({
  id: p.id,
  code: p.code,
  name: p.name,
  country: p.country,
  sector: "Education",
  funding: "Joint Programme",
  start: "2025-01-01",
  end: "2030-12-31",
  budget: 1000,
  spent: 0,
  committed: 0,
  people:
    p.id === "alpha"
      ? [
          {
            id: "manual",
            name: "MANUAL ONLY",
            role: "Separate manual record",
            fte: 9,
          },
        ]
      : [],
  reportingPeriods: [
    {
      id: p.id + "-source",
      date: "2026-09-30",
      name: "Staff source report",
      fileName: p.id + "-staff-source.xlsx",
      type: "Quarterly Financial Report",
      typeGroup: "Quarterly Financial Report",
      snapshot: {
        staffVersion: 3,
        staffRecords: p.records,
        lines: [],
        totals: { approved: 1000, actual: 0, spentCommitted: 0, committed: 0 },
      },
    },
  ],
}));
const fixture = {
  countries: [
    { id: "tr", name: "Türkiye" },
    { id: "ge", name: "Georgia" },
  ],
  projects,
};

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
      if (i >= 40) throw Error("Staff test server did not become ready");
      await pause(100);
    }
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      headless: true,
      args: ["--no-sandbox"],
    });
    const context = await browser.newContext({
        viewport: { width: 1440, height: 1050 },
        reducedMotion: "reduce",
      }),
      page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + "#/team");
    await page.waitForSelector(".ps-studio");
    assert.match(
      await page.locator(".ps-kpis").innerText(),
      /0 \/ 0 assignments with known FTE/,
    );
    assert.match(await page.locator(".ps-kpis").innerText(), /—/);
    pass(
      "Sample with no document staff withholds FTE and identifies missing source rosters",
    );
    await page.evaluate(
      ({ KEY, fixture }) => {
        localStorage.setItem(KEY, JSON.stringify(fixture));
        localStorage.removeItem("ledger.staff.studio.v1");
      },
      { KEY, fixture },
    );
    await page.reload();
    await page.waitForSelector(".ps-table");
    const original = await page.evaluate(
      (KEY) => localStorage.getItem(KEY),
      KEY,
    );
    const assignmentCount = fixture.projects.reduce(
      (n, p) => n + p.reportingPeriods[0].snapshot.staffRecords.length,
      0,
    );
    assert.match(
      await page.locator(".ps-register-status").innerText(),
      new RegExp(`${assignmentCount} of ${assignmentCount}`),
    );
    assert.match(
      await page.locator(".ps-kpis").innerText(),
      new RegExp(
        `${assignmentCount - 1} / ${assignmentCount} assignments with known FTE`,
      ),
    );
    assert.equal(
      await page
        .locator(".ps-table:not(.ps-print-table) tbody tr[data-ps-row]")
        .count(),
      25,
    );
    assert.match(
      await page.locator(".ps-table:not(.ps-print-table) tfoot").innerText(),
      new RegExp(`All ${assignmentCount} filtered assignments`),
    );
    assert.doesNotMatch(
      await page.locator(".ps-register").innerText(),
      /MANUAL ONLY/,
    );
    pass(
      "Document roster aggregates assignments across projects, paginates rows and excludes separate manual records",
    );
    await page.locator('[data-ps-field="query"]').fill("Morgan");
    const zero = page.locator(
      ".ps-table:not(.ps-print-table) tbody tr[data-ps-row]",
    );
    assert.equal(await zero.count(), 1);
    assert.equal(await zero.locator("td").nth(4).innerText(), "0.00");
    assert.equal(
      await page
        .locator('[data-ps-field="query"]')
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await page.locator('[data-ps-field="query"]').fill("Riley");
    assert.equal(
      await page
        .locator(".ps-table:not(.ps-print-table) tbody tr[data-ps-row] td")
        .nth(4)
        .innerText(),
      "—",
    );
    await page.locator('[data-ps-action="evidence"]').click();
    assert.match(
      await page.locator(".ps-evidence").innerText(),
      /alpha-staff-source.xlsx/,
    );
    assert.match(
      await page.locator(".ps-evidence").innerText(),
      /Payroll units do not establish contract dates or current FTE/,
    );
    pass(
      "Explicit zero FTE remains zero; payroll-only FTE stays unknown and reveals the original source evidence",
    );
    await page.locator('[data-ps-action="reset-filters"]').click();
    await page.locator('[data-ps-field="query"]').fill("Riley");
    await page.locator('.ps-row-actions [data-act="staff-contract"]').click();
    assert.equal(await page.locator("#dlg2").isVisible(), true);
    assert.match(await page.locator("#dlg2").innerText(), /contract|Contract/);
    await page.evaluate(() => document.querySelector("#dlg2").close());
    await page.locator('[data-ps-action="reset-filters"]').click();
    pass(
      "The redesigned register retains the existing verified contract details workflow",
    );
    await page
      .locator('.ps-base-legend [data-ps-action="base"][data-ps-value="HQ"]')
      .click();
    assert.equal(
      await page.locator('[data-ps-field="base"]').inputValue(),
      "HQ",
    );
    assert(
      (await page
        .locator(".ps-table:not(.ps-print-table) tbody tr[data-ps-row]")
        .count()) > 0,
    );
    await page.locator('[data-ps-action="clear-base"]').click();
    await page.locator('[data-ps-field="coverage"]').selectOption("fte");
    assert.equal(
      await page
        .locator(".ps-table:not(.ps-print-table) tbody tr[data-ps-row]")
        .count(),
      1,
    );
    await page.locator('[data-ps-action="reset-filters"]').click();
    await page
      .locator(
        '.ps-table:not(.ps-print-table) [data-ps-action="sort"][data-ps-value="fte"]',
      )
      .click();
    await page.locator('[data-ps-field="pageSize"]').selectOption("100");
    const ascending = await page
      .locator(
        ".ps-table:not(.ps-print-table) tbody tr[data-ps-row] td:nth-child(5)",
      )
      .allTextContents();
    assert.equal(ascending[0].trim(), "0.00");
    assert.equal(ascending.at(-1).trim(), "—");
    await page
      .locator(
        '.ps-table:not(.ps-print-table) [data-ps-action="sort"][data-ps-value="fte"]',
      )
      .click();
    const descending = await page
      .locator(
        ".ps-table:not(.ps-print-table) tbody tr[data-ps-row] td:nth-child(5)",
      )
      .allTextContents();
    assert.equal(descending.at(-1).trim(), "—");
    pass(
      "Base chart, evidence filters and null-last sorting coordinate the whole staff workspace",
    );
    const pending = page.waitForEvent("download");
    await page.locator('[data-ps-action="export"]').click();
    const file = await pending,
      csv = (await fs.readFile(await file.path(), "utf8")).replace(
        /^\ufeff/,
        "",
      );
    assert.equal(csv.split("\r\n").length, assignmentCount + 1);
    assert.match(csv, /"'=SUM\(1\+1\) FORMULA"/);
    assert.doesNotMatch(csv, /MANUAL ONLY/);
    assert.match(csv, /alpha-staff-source.xlsx/);
    await page.locator('[data-ps-field="pageSize"]').selectOption("10");
    await page.emulateMedia({ media: "print" });
    assert.equal(await page.locator(".ps-print-only").isVisible(), true);
    assert.equal(
      await page.locator(".ps-print-table tbody tr[data-ps-row]").count(),
      assignmentCount,
    );
    assert.equal(await page.locator(".ps-register").isVisible(), false);
    await page.emulateMedia({ media: "screen" });
    pass(
      "CSV exports all filtered source rows with formula escaping; print includes all rows beyond pagination",
    );
    await page.locator('[data-ps-field="pageSize"]').selectOption("25");
    await page.screenshot({
      path: "/tmp/staff-studio-desktop.png",
      fullPage: true,
    });
    await page
      .locator('[data-ps-action="view"][data-ps-value="cards"]')
      .click();
    assert.equal(await page.locator(".ps-person-card").count(), 25);
    await page.setViewportSize({ width: 390, height: 1000 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await page.locator('[data-ps-field="query"]').fill("Riley");
    if (
      (await page
        .locator('[data-ps-action="evidence"]')
        .getAttribute("aria-expanded")) !== "true"
    )
      await page.locator('[data-ps-action="evidence"]').click();
    assert.match(
      await page.locator(".ps-person-card").innerText(),
      /Payroll units do not establish contract dates or current FTE/,
    );
    await page.screenshot({
      path: "/tmp/staff-studio-mobile.png",
      fullPage: true,
    });
    await page.reload();
    await page.waitForSelector(".ps-person-card");
    assert.equal(
      await page
        .locator('[data-ps-action="view"][data-ps-value="cards"]')
        .getAttribute("aria-pressed"),
      "true",
    );
    assert.equal(
      await page.evaluate((KEY) => localStorage.getItem(KEY), KEY),
      original,
    );
    assert.deepEqual(errors, []);
    pass(
      "Responsive cards, source details and preferences work on mobile without modifying the portfolio",
    );
    console.log(`\n${checks} staff checks passed.`);
  } finally {
    await browser?.close();
    server.kill();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
