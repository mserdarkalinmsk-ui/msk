/* Financial and interaction regressions for the analysis studio.
 * Every context is disposable; production/browser portfolio data is never used.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { setTimeout: pause } = require("node:timers/promises");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const port = Number(process.env.LEDGER_STUDIO_TEST_PORT || 8767);
const base = `http://127.0.0.1:${port}/`;
const PORTFOLIO = "ledger.portfolio.v1";
const WORKSPACE = "ledger.workspace.v2";
let checks = 0;
const pass = (description) => console.log(`PASS ${++checks}. ${description}`);
const preference = (page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)), WORKSPACE);
const rowIds = (page) =>
  page
    .locator("[data-mp-row-select]")
    .evaluateAll((nodes) => nodes.map((node) => node.dataset.mpRowSelect));
const panelOrder = (page) =>
  page
    .locator("[data-mp-panel]")
    .evaluateAll((nodes) => nodes.map((node) => node.dataset.mpPanel));
async function download(page, action) {
  const pending = page.waitForEvent("download");
  await action();
  const file = await pending;
  return {
    name: file.suggestedFilename(),
    bytes: await fs.readFile(await file.path()),
  };
}
async function openDetails(locator) {
  if (!(await locator.evaluate((node) => node.open)))
    await locator.locator("summary").first().click();
}
async function commitInput(locator, value) {
  await locator.fill(String(value));
  await locator.dispatchEvent("change");
}
async function noOverflow(page, description) {
  const geometry = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: innerWidth,
  }));
  assert.ok(
    geometry.document <= geometry.viewport + 1,
    `${description}: document ${geometry.document}px exceeds ${geometry.viewport}px viewport`,
  );
}
const report = (id, date, actual, committed) => ({
  id,
  date,
  name: id,
  fileName: `${id}.xlsx`,
  type: "Quarterly Financial Report",
  typeGroup: "Quarterly Financial Report",
  snapshot: {
    lines: [
      {
        code: "1",
        description: "Verified costs",
        approved: 1000,
        actual,
        committed,
        spentCommitted: actual + committed,
      },
    ],
    totals: {
      approved: 1000,
      actual,
      committed,
      spentCommitted: actual + committed,
    },
  },
});
const project = (id, name, country, reports, extra = {}) => ({
  id,
  name,
  code: id.toUpperCase(),
  country,
  sector: country === "tr" ? "Education" : "Justice",
  funding: "Joint Programme",
  start: "2025-01-01",
  end: "2028-12-31",
  budget: 1000,
  spent: 0,
  committed: 0,
  status: "Active",
  reportingPeriods: reports,
  ...extra,
});
function makeFixture(state) {
  return {
    ...state,
    projects: [
      project(
        "snap",
        "=Snapshot test",
        "tr",
        [
          report("first", "2025-01-31", 200, 50),
          report("second", "2025-06-30", 400, 100),
          report("refund", "2025-09-30", 350, 70),
        ],
        {
          doa: {
            fileName: "Milestone-source.pdf",
            start: "2025-01-01",
            months: 48,
            useDates: false,
            useBudget: false,
            inds: [],
            acts: [
              {
                id: "a1",
                code: "M1",
                name: "Validation workshop",
                group: "Output",
                impl: "Lead",
                P: [],
                E: [],
                X: [8],
                status: "Done",
              },
            ],
          },
        },
      ),
      project("zero", "Known zero", "tr", [
        report("zero-first", "2025-01-31", 0, 0),
        report("zero-second", "2025-06-30", 0, 0),
        report("zero-latest", "2025-09-30", 0, 0),
      ]),
      project("new", "New reporting cohort", "ge", [
        report("new-first", "2025-06-30", 900, 100),
        report("new-latest", "2025-09-30", 950, 50),
      ]),
      project("missing", "Missing actuals", "ge", [], { budget: 2000 }),
    ],
  };
}
function readWorkbook(bytes) {
  const result = spawnSync(
    "python3",
    [
      "-c",
      `
import io,json,sys,zipfile,xml.etree.ElementTree as E
N={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read()))
shared=[]
if 'xl/sharedStrings.xml' in z.namelist():
 shared=[''.join(t.itertext()) for t in E.fromstring(z.read('xl/sharedStrings.xml')).findall('s:si',N)]
out={'entries':z.namelist(),'sheets':[],'formats':[],'styles':[]}
if 'xl/styles.xml' in z.namelist():
 styles=E.fromstring(z.read('xl/styles.xml'))
 out['formats']=[f.attrib for f in styles.findall('s:numFmts/s:numFmt',N)]
 out['styles']=[f.attrib for f in styles.findall('s:cellXfs/s:xf',N)]
for name in z.namelist():
 if name.startswith('xl/worksheets/') and name.endswith('.xml'):
  sheet=E.fromstring(z.read(name)); rows=[]
  for r in sheet.findall('s:sheetData/s:row',N):
   cells=[]
   for c in r.findall('s:c',N):
    v=c.find('s:v',N); value=v.text if v is not None else None
    if c.get('t')=='s' and value is not None:value=shared[int(value)]
    if c.get('t')=='inlineStr':value=''.join(c.find('s:is',N).itertext())
    cells.append({'ref':c.get('r'),'type':c.get('t'),'style':c.get('s'),'value':value,'formula':c.find('s:f',N) is not None})
   rows.append(cells)
  out['sheets'].append({'name':name,'rows':rows})
print(json.dumps(out))
`,
    ],
    { input: bytes, maxBuffer: 8 * 1024 * 1024 },
  );
  assert.equal(result.status, 0, result.stderr.toString());
  return JSON.parse(result.stdout.toString());
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
  const contexts = [];
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        if ((await fetch(base)).ok) break;
      } catch {}
      if (attempt > 40) throw Error("Studio test server unavailable");
      await pause(100);
    }
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox"],
    });
    const sample = await browser.newContext({
      viewport: { width: 1440, height: 1100 },
    });
    contexts.push(sample);
    const seed = await sample.newPage();
    seed.on("pageerror", (error) => errors.push(error.message));
    await seed.goto(base + "#/overview/studio");
    await seed.locator('[data-mp-panel="register"]').waitFor();
    await openDetails(seed.locator(".studio-workspace-settings"));
    await openDetails(seed.locator(".mp-more-tools"));
    const backup = JSON.parse(
      (
        await download(seed, () =>
          seed.locator('.mp-more-tools [data-act="export"]').click(),
        )
      ).bytes.toString(),
    );
    const fixture = makeFixture(backup.state);
    const original = JSON.stringify(fixture);
    async function fresh(data = fixture, options = {}) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1100 },
        reducedMotion: "reduce",
        ...options,
      });
      contexts.push(context);
      await context.addInitScript(
        ({ key, value }) => {
          if (!localStorage.getItem(key)) localStorage.setItem(key, value);
        },
        { key: PORTFOLIO, value: JSON.stringify(data) },
      );
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(base + "#/overview/studio");
      await page.locator('[data-mp-panel="register"]').waitFor();
      await openDetails(page.locator(".studio-scope"));
      await openDetails(page.locator(".studio-workspace-settings"));
      return page;
    }
    async function untouched(page, expected = original) {
      assert.equal(
        await page.evaluate((key) => localStorage.getItem(key), PORTFOLIO),
        expected,
        "Analysis/workspace controls must never persist a change to portfolio records",
      );
    }

    const page = await fresh();
    assert.equal(
      await page.locator(".mp-register tfoot .mp-col-budget b").textContent(),
      "€5,000",
    );
    assert.equal(
      await page.locator(".mp-register tfoot .mp-col-spent b").textContent(),
      "€1,300",
    );
    assert.equal(
      await page.locator(".mp-register tfoot .mp-col-exposure b").textContent(),
      "€1,420",
    );
    await untouched(page);
    pass(
      "Controlled sources establish current budget, actuals and exposure independently of history preferences",
    );

    await page.locator('[data-studio-scope="country"]').selectOption("tr");
    assert.deepEqual((await rowIds(page)).sort(), ["snap", "zero"]);
    assert.equal(
      await page.locator(".mp-register tfoot .mp-col-budget b").textContent(),
      "€2,000",
    );
    assert.equal(
      await page.locator(".mp-register tfoot .mp-col-spent b").textContent(),
      "€350",
    );
    await page.locator('[data-studio-scope="project"]').selectOption("snap");
    assert.deepEqual(await rowIds(page), ["snap"]);
    await commitInput(page.locator('[data-studio-scope="from"]'), "2025-06-30");
    await commitInput(page.locator('[data-studio-scope="to"]'), "2025-09-30");
    assert.equal(
      await page.locator(".mp-register tfoot .mp-col-budget b").textContent(),
      "€1,000",
    );
    assert.equal(
      await page.locator(".mp-register tfoot .mp-col-spent b").textContent(),
      "€350",
    );
    assert.match(
      await page.locator(".studio-scope").textContent(),
      /histor|current/i,
    );
    await untouched(page);
    await page.reload();
    assert.deepEqual(await rowIds(page), ["snap"]);
    assert.equal(
      await page.locator('[data-studio-scope="from"]').inputValue(),
      "2025-06-30",
    );
    await page.locator('[data-studio-action="clear-scope"]').click();
    assert.equal(
      await page.locator('[data-studio-scope="from"]').inputValue(),
      "",
    );
    assert.equal(
      await page.locator('[data-studio-scope="to"]').inputValue(),
      "",
    );
    assert.equal((await rowIds(page)).length, 4);
    pass(
      "Country and project crossfilters persist while historical date ranges leave current financial totals intact",
    );

    const charts = await fresh();
    const historyTable = charts.locator(
      '[data-mp-panel="trend"] .mp-data-disclosure',
    );
    async function historyValues() {
      await openDetails(historyTable);
      return historyTable
        .locator("tbody tr")
        .evaluateAll((rows) =>
          rows.map((row) =>
            [...row.cells].map((cell, index) =>
              index === 0
                ? cell.querySelector("button").textContent
                : cell.textContent.trim(),
            ),
          ),
        );
    }
    assert.deepEqual(await historyValues(), [
      ["2025-01-31", "€200", "€250", "2/4", "2/4"],
      ["2025-06-30", "€1,300", "€1,500", "3/4", "3/4"],
      ["2025-09-30", "€1,300", "€1,420", "3/4", "3/4"],
    ]);
    await charts
      .locator(
        '[data-cs-action="option"][data-cs-key="mode"][data-cs-value="interval"]',
      )
      .click();
    assert.deepEqual(await historyValues(), [
      ["2025-01-31", "—", "—", "0/4", "0/4", "0"],
      ["2025-06-30", "€200", "€250", "2/4", "2/4", "1"],
      ["2025-09-30", "€0", "€-80", "3/4", "3/4", "0"],
    ]);
    await charts
      .locator(
        '[data-cs-action="option"][data-cs-key="style"][data-cs-value="columns"]',
      )
      .click();
    assert.equal(
      await charts.locator(".cs-history-chart .cs-column").count(),
      4,
    );
    await charts
      .locator('button[data-cs-action="select-country"][data-cs-value="tr"]')
      .click();
    assert.deepEqual((await rowIds(charts)).sort(), ["snap", "zero"]);
    await openDetails(charts.locator(".cs-source-disclosure"));
    await charts
      .locator(
        '.cs-source-disclosure [data-cs-action="select-project"][data-cs-value="snap"]',
      )
      .click();
    assert.deepEqual(await rowIds(charts), ["snap"]);
    const refunded = (await historyValues()).at(-1);
    assert.equal(refunded[1], "€-50");
    assert.equal(refunded[2], "€-80");
    const refundPoint = charts.locator(
      '.cs-history-chart [data-cs-action="pick-date"][data-cs-value="2025-09-30"][data-cs-series="spent"]',
    );
    assert.match(await refundPoint.getAttribute("aria-label"), /€-50/);
    await untouched(charts);
    pass(
      "Cumulative charts never add snapshots; interval comparisons exclude new coverage and preserve signed refunds",
    );

    await charts
      .locator(
        '[data-cs-action="option"][data-cs-key="style"][data-cs-value="line"]',
      )
      .click();
    assert.equal(
      await charts.locator(".cs-history-chart .cs-column").count(),
      0,
    );
    await charts
      .locator('[data-cs-action="series"][data-cs-value="exposure"]')
      .click();
    assert.equal(
      await charts
        .locator('.cs-history-chart [data-cs-series="exposure"]')
        .count(),
      0,
    );
    await charts
      .locator('[data-cs-action="series"][data-cs-value="spent"]')
      .click();
    assert.equal(
      await charts
        .locator('[data-cs-action="series"][data-cs-value="spent"]')
        .getAttribute("aria-pressed"),
      "true",
    );
    assert.ok(
      (await charts
        .locator('.cs-history-chart [data-cs-series="spent"]')
        .count()) > 0,
    );
    await charts
      .locator('[data-cs-action="series"][data-cs-value="exposure"]')
      .click();
    await charts
      .locator('.cs-history-chart [data-cs-series="spent"]')
      .first()
      .focus();
    await charts.keyboard.press("End");
    assert.match(
      await charts.locator(".mp-trend-readout").textContent(),
      /2025-09-30/,
    );
    await charts.waitForFunction(
      () => document.activeElement.dataset.csValue === "2025-09-30",
    );
    await charts.keyboard.press("Home");
    assert.match(
      await charts.locator(".mp-trend-readout").textContent(),
      /2025-06-30/,
    );
    await charts.locator('[data-cs-range="from"]').focus();
    await charts.keyboard.press("ArrowRight");
    assert.equal(
      await charts.locator('[data-studio-scope="from"]').inputValue(),
      "2025-06-30",
    );
    await charts.locator('[data-cs-range="to"]').focus();
    await charts.keyboard.press("ArrowLeft");
    assert.equal(
      await charts.locator('[data-studio-scope="to"]').inputValue(),
      "2025-06-30",
    );
    assert.equal((await historyValues()).length, 1);
    assert.equal(
      await charts.locator(".mp-register tfoot .mp-col-spent b").textContent(),
      "€350",
    );
    await charts.locator('[data-cs-action="reset-range"]').click();
    assert.equal((await historyValues()).length, 3);
    await charts.locator('[data-cs-action="zoom"][data-cs-value="in"]').click();
    assert.equal((await historyValues()).length, 2);
    await charts
      .locator('[data-cs-action="zoom"][data-cs-value="out"]')
      .click();
    assert.equal((await historyValues()).length, 3);
    await untouched(charts);
    pass(
      "Line and column views, safe series toggles, keyboard point selection and native range zoom operate together",
    );

    const initialOrder = await panelOrder(page);
    await openDetails(page.locator(".studio-workspace-settings"));
    await page.locator('[data-mp="customize"]').click();
    await page
      .locator('[data-mp="move-down"][data-panel="allocation"]')
      .click();
    assert.notDeepEqual(await panelOrder(page), initialOrder);
    await page.locator('[data-studio-action="layout-undo"]').click();
    assert.deepEqual(await panelOrder(page), initialOrder);
    await page.locator('[data-mp-width="allocation"]').selectOption("full");
    await page.locator('[data-studio-action="save-workspace"]').click();
    await page.locator("#studio-workspace-name").fill("Board review");
    await page.locator('#studio-workspace-form button[type="submit"]').click();
    const named = (await preference(page)).workspaces.find(
      (view) => view.name === "Board review",
    );
    assert.ok(
      named,
      "A named workspace is stored separately from project data",
    );
    await page.locator('[data-mp-width="allocation"]').selectOption("third");
    await page.locator("[data-studio-workspaces]").selectOption(named.id);
    assert.ok(
      await page
        .locator('[data-mp-panel="allocation"]')
        .evaluate((node) => node.classList.contains("mp-width-full")),
    );
    await page.reload();
    assert.equal(
      await page.locator("[data-studio-workspaces]").inputValue(),
      named.id,
    );
    await untouched(page);
    pass(
      "Layout undo and named workspaces restore the chosen arrangement without changing portfolio records",
    );

    const exposureOnly = project(
      "exposure-only",
      "Exposure without actuals",
      "ge",
      [
        {
          id: "exposure-source",
          date: "2025-08-31",
          name: "Exposure source",
          fileName: "exposure-only.xlsx",
          type: "Quarterly Financial Report",
          typeGroup: "Quarterly Financial Report",
          snapshot: {
            lines: [
              {
                code: "1",
                approved: 1000,
                actual: null,
                committed: null,
                spentCommitted: 400,
              },
            ],
            totals: {
              approved: 1000,
              actual: null,
              committed: null,
              spentCommitted: 400,
            },
          },
        },
      ],
    );
    const partialFixture = {
      ...fixture,
      projects: [...fixture.projects, exposureOnly],
    };
    const partial = await fresh(partialFixture);
    await partial
      .locator('[data-studio-scope="project"]')
      .selectOption("exposure-only");
    await openDetails(
      partial.locator('[data-mp-panel="trend"] .mp-data-disclosure'),
    );
    const partialCells = await partial
      .locator('[data-mp-panel="trend"] tbody tr')
      .first()
      .locator("td")
      .allTextContents();
    assert.deepEqual(partialCells, ["2025-08-31", "—", "€400", "0/1", "1/1"]);
    assert.match(
      await partial.locator(".mp-register tbody .mp-col-spent").textContent(),
      /Not recorded/,
    );
    await untouched(partial, JSON.stringify(partialFixture));
    await partial.locator('[data-studio-scope="country"]').selectOption("tr");
    await partial.goto(base + "#/country/ge");
    await partial
      .locator('[data-rs-action="analyse-project"][data-row="new"]')
      .click();
    await partial.waitForURL("**/#/overview");
    assert.deepEqual(await rowIds(partial), ["new"]);
    assert.equal((await preference(partial)).analysis.country, "all");
    await untouched(partial, JSON.stringify(partialFixture));
    pass(
      "Exposure-only report history preserves unknown actuals, and country-register analysis replaces stale scope safely",
    );

    const visual = await fresh();
    const colors = () =>
      visual
        .locator(".mp-panel")
        .first()
        .evaluate((node) => {
          const computed = getComputedStyle(node);
          return ["--mp-spent", "--mp-committed", "--mp-violet"].map((name) =>
            computed.getPropertyValue(name).trim(),
          );
        });
    const initialColors = await colors();
    await visual
      .locator("[data-studio-palette-select]")
      .selectOption("executive");
    assert.notDeepEqual(
      await colors(),
      initialColors,
      "Palette choice must change the rendered chart colors",
    );
    await visual
      .locator("[data-studio-palette-select]")
      .selectOption("contrast");
    assert.notDeepEqual(await colors(), initialColors);
    await visual.locator("[data-studio-effects-select]").selectOption("none");
    assert.equal(
      await visual
        .locator(".mp-panel")
        .first()
        .evaluate((node) => getComputedStyle(node).animationName),
      "none",
    );
    await visual.reload();
    await openDetails(visual.locator(".studio-workspace-settings"));
    assert.equal(
      await visual.locator("[data-studio-palette-select]").inputValue(),
      "contrast",
    );
    assert.equal(
      await visual.locator("[data-studio-effects-select]").inputValue(),
      "none",
    );
    await untouched(visual);
    pass(
      "Semantic chart palettes affect real styling and reduced-motion preferences survive reload",
    );

    const brief = await fresh();
    await commitInput(brief.locator('[data-studio-scope="to"]'), "2025-01-31");
    await brief.locator('[data-studio-action="open-brief"]').click();
    const summary = brief.locator("#studio-brief-dialog");
    assert.deepEqual(
      await summary.locator(".studio-report-kpis b").allTextContents(),
      ["€5,000", "€1,300", "€1,420", "—"],
    );
    assert.match(
      await summary.locator(".studio-report-kpis").textContent(),
      /3\/4/,
    );
    assert.match(
      await summary.locator(".studio-report-context").textContent(),
      /2025-01-31/,
    );
    assert.match(
      await summary.locator(".studio-report-context").textContent(),
      /not current financial|not current|not a uniform historical/i,
    );
    const zeroBrief = summary
      .locator("tbody tr")
      .filter({ hasText: "Known zero" });
    const missingBrief = summary
      .locator("tbody tr")
      .filter({ hasText: "Missing actuals" });
    assert.equal(await zeroBrief.locator("td").nth(2).textContent(), "€0");
    assert.equal(await missingBrief.locator("td").nth(2).textContent(), "—");
    await brief.keyboard.press("Escape");
    await brief.waitForFunction(
      () => document.activeElement.dataset.studioAction === "open-brief",
    );
    await untouched(brief);
    pass(
      "Decision brief keeps dates, financial scope and missing coverage explicit; Escape restores keyboard focus",
    );

    const register = await fresh();
    await openDetails(
      register.locator("details").filter({
        has: register.locator('[data-rs-filter="budget"][data-rs-bound="min"]'),
      }),
    );
    await commitInput(
      register.locator('[data-rs-filter="budget"][data-rs-bound="min"]'),
      "1500",
    );
    assert.deepEqual(await rowIds(register), ["missing"]);
    assert.equal(
      await register
        .locator(".mp-register tfoot .mp-col-budget b")
        .textContent(),
      "€2,000",
    );
    assert.match(
      await register.locator(".mp-register tbody .mp-col-spent").textContent(),
      /Not recorded|—/,
    );
    await commitInput(
      register.locator('[data-rs-filter="budget"][data-rs-bound="min"]'),
      "",
    );
    await commitInput(
      register.locator('[data-rs-filter="country"][data-rs-bound="text"]'),
      "Türkiye",
    );
    assert.deepEqual((await rowIds(register)).sort(), ["snap", "zero"]);
    await commitInput(
      register.locator('[data-rs-filter="country"][data-rs-bound="text"]'),
      "",
    );
    assert.equal((await rowIds(register)).length, 4);
    await register.locator(".rs-filters summary").click();
    await register.locator('[data-mp="sort"][data-column="country"]').click();
    await register
      .locator('[data-mp="sort"][data-column="spent"]')
      .click({ modifiers: ["Shift"] });
    assert.deepEqual(await rowIds(register), [
      "new",
      "missing",
      "zero",
      "snap",
    ]);
    await register
      .locator('[data-mp="sort"][data-column="spent"]')
      .click({ modifiers: ["Shift"] });
    assert.deepEqual(await rowIds(register), [
      "new",
      "missing",
      "snap",
      "zero",
    ]);
    assert.equal((await preference(register)).table.sorts.length, 2);
    await untouched(register);
    pass(
      "Column filters and multi-sort retain known zeros and put missing values last within each country",
    );

    const separator = register.locator('[data-rs-resize="budget"]');
    const originalWidth = Number(await separator.getAttribute("aria-valuenow"));
    assert.ok(
      originalWidth > 0,
      "Resizable columns expose their current width to keyboard users",
    );
    await separator.focus();
    await register.keyboard.press("ArrowRight");
    assert.equal(
      Number(await separator.getAttribute("aria-valuenow")),
      originalWidth + 16,
    );
    const handle = await separator.boundingBox();
    await register.mouse.move(
      handle.x + handle.width / 2,
      handle.y + handle.height / 2,
    );
    await register.mouse.down();
    await register.mouse.move(
      handle.x + handle.width / 2 + 40,
      handle.y + handle.height / 2,
      { steps: 8 },
    );
    await register.mouse.up();
    assert.ok(
      Number(await separator.getAttribute("aria-valuenow")) >=
        originalWidth + 52,
    );
    const resized = Number(await separator.getAttribute("aria-valuenow"));
    await openDetails(register.locator(".mp-columns"));
    const beforeColumns = [...(await preference(register)).table.order];
    await register
      .locator('.mp-columns [data-rs-drag="budget"]')
      .dragTo(register.locator('.mp-columns [data-rs-drag="country"]'));
    assert.notDeepEqual(
      (await preference(register)).table.order,
      beforeColumns,
      "Native column drag changes the saved display order",
    );
    await register.reload();
    assert.equal(
      Number(
        await register
          .locator('[data-rs-resize="budget"]')
          .getAttribute("aria-valuenow"),
      ),
      resized,
    );
    assert.notDeepEqual(
      (await preference(register)).table.order,
      beforeColumns,
    );
    await untouched(register);
    pass(
      "Native column ordering, pointer resizing and accessible keyboard widths persist across reloads",
    );

    await register
      .locator('[data-mp-table="group"]')
      .selectOption("country-sector");
    assert.equal(
      await register.locator('[data-rs-action="group-toggle"]').count(),
      4,
    );
    assert.match(
      await register
        .locator(".rs-group-metrics")
        .allTextContents()
        .then((values) => values.join(" ")),
      /€2,000/,
    );
    assert.match(
      await register
        .locator(".rs-group-metrics")
        .allTextContents()
        .then((values) => values.join(" ")),
      /€3,000/,
    );
    await register.locator('[data-rs-action="group-toggle"]').first().click();
    assert.ok((await rowIds(register)).length < 4);
    assert.equal(
      await register
        .locator(".mp-register tfoot .mp-col-budget b")
        .textContent(),
      "€5,000",
    );
    await register.locator('[data-rs-action="group-toggle"]').first().click();
    const views = register
      .locator("details")
      .filter({ has: register.locator("[data-rs-view-name]") });
    await openDetails(views);
    await register.locator("[data-rs-view-name]").fill("Audit shortlist");
    await register.locator('[data-rs-action="view-save"]').click();
    const savedView = await register
      .locator("[data-rs-view-select] option")
      .filter({ hasText: "Audit shortlist" })
      .getAttribute("value");
    assert.ok(savedView);
    await register.locator('[data-mp-table="group"]').selectOption("none");
    await register.locator("[data-rs-view-select]").selectOption(savedView);
    assert.equal(
      await register.locator('[data-mp-table="group"]').inputValue(),
      "country-sector",
    );
    assert.equal((await preference(register)).table.sorts.length, 2);
    await untouched(register);
    pass(
      "Nested groups show all-filtered subtotals and named table views restore grouping plus multi-sort",
    );

    const exports = await fresh();
    await openDetails(exports.locator(".rs-export-menu"));
    const workbookFile = await download(exports, () =>
      exports.locator('[data-rs-action="export-xlsx"]').click(),
    );
    assert.match(workbookFile.name, /\.xlsx$/i);
    assert.equal(workbookFile.bytes.subarray(0, 4).toString("hex"), "504b0304");
    const workbook = readWorkbook(workbookFile.bytes);
    assert.equal(
      workbook.sheets.length,
      3,
      "Financial register exports include sources and context sheets",
    );
    const cells = workbook.sheets.flatMap((sheet) => sheet.rows.flat());
    assert.ok(
      cells.every((cell) => !cell.formula),
      "User-entered names must never become Excel formulas",
    );
    assert.ok(cells.some((cell) => cell.value === "'=Snapshot test"));
    const mainSheet = workbook.sheets.find(
      (sheet) => sheet.name === "xl/worksheets/sheet1.xml",
    );
    const zeroCells = mainSheet.rows.find((row) =>
      row.some((cell) => cell.value === "Known zero"),
    );
    assert.ok(
      zeroCells.some(
        (cell) => cell.value === "0" && (!cell.type || cell.type === "n"),
      ),
      "A documented zero remains an Excel numeric zero",
    );
    const headers = mainSheet.rows.find((row) => row[0]?.ref === "A4");
    const spentColumn = headers
      .find((cell) => cell.value === "Spent")
      .ref.replace(/\d/g, "");
    const missingCells = mainSheet.rows.find((row) =>
      row.some((cell) => cell.value === "Missing actuals"),
    );
    assert.equal(
      missingCells.find((cell) => cell.ref.replace(/\d/g, "") === spentColumn)
        .value,
      null,
      "Missing financial amounts are blank, not fabricated zero values",
    );
    assert.ok(
      workbook.formats.some((format) => /€/.test(format.formatCode)),
      "Workbook has currency formats",
    );
    assert.ok(
      workbook.formats.some((format) => /%/.test(format.formatCode)),
      "Workbook has percentage formats",
    );
    assert.ok(
      cells.some(
        (cell) => cell.value === "1300" && (!cell.type || cell.type === "n"),
      ),
      "All-filtered actuals totals are numeric and reflect latest sources only",
    );
    await untouched(exports);
    pass(
      "XLSX is a real three-sheet workbook with typed financial cells, source context and safe project names",
    );

    const many = {
      ...fixture,
      projects: Array.from({ length: 27 }, (_, index) =>
        project(
          `p${String(index).padStart(2, "0")}`,
          `Project ${String(index).padStart(2, "0")}`,
          index % 2 ? "tr" : "ge",
          [report(`source-${index}`, "2025-09-30", index * 10, 0)],
        ),
      ),
    };
    const print = await fresh(many);
    assert.equal((await rowIds(print)).length, 10);
    assert.equal(
      await print.locator(".mp-register tfoot .mp-col-budget b").textContent(),
      "€27,000",
    );
    await openDetails(print.locator(".rs-export-menu"));
    await print.locator('[data-rs-action="print-register"]').click();
    const printFrame = print.frameLocator("iframe[data-register-print]");
    await printFrame.locator("table.register tbody tr").first().waitFor();
    assert.equal(
      await printFrame.locator("table.register tbody tr").count(),
      27,
    );
    assert.match(
      await printFrame.locator("table.register tfoot").textContent(),
      /27,000/,
    );
    assert.equal(
      await printFrame.locator("table.sources tbody tr").count(),
      27,
    );
    assert.match(
      await printFrame.locator("table.context").textContent(),
      /filtered|source|EUR/i,
    );
    await untouched(print, JSON.stringify(many));
    pass(
      "Print-ready register includes every filtered project and its sources rather than only the visible page",
    );

    const schedule = await fresh();
    await schedule
      .locator('[data-ss-action="zoom"][data-ss-value="quarter"]')
      .click();
    const quarter = await schedule
      .locator(".ss-canvas")
      .evaluate((node) => node.scrollWidth);
    await schedule
      .locator('[data-ss-action="zoom"][data-ss-value="month"]')
      .click();
    const month = await schedule
      .locator(".ss-canvas")
      .evaluate((node) => node.scrollWidth);
    await schedule
      .locator('[data-ss-action="zoom"][data-ss-value="week"]')
      .click();
    const week = await schedule
      .locator(".ss-canvas")
      .evaluate((node) => node.scrollWidth);
    assert.ok(
      week > month && month > quarter,
      "Calendar zoom increases timeline resolution",
    );
    assert.ok(
      await schedule
        .locator(".ss-scroll")
        .evaluate((node) => node.scrollWidth > node.clientWidth),
    );
    await noOverflow(schedule, "Week-scale timeline");
    await schedule
      .locator('[data-ss-action="project-filter"][data-ss-id="snap"]')
      .click();
    assert.equal(
      await schedule.locator('[data-studio-scope="project"]').inputValue(),
      "snap",
    );
    assert.deepEqual(await rowIds(schedule), ["snap"]);
    const milestone = schedule
      .locator('[data-ss-action="event"]')
      .filter({ hasText: /Validation workshop/ })
      .first();
    if (!(await milestone.isVisible())) {
      await openDetails(schedule.locator(".ss-event-list"));
    }
    assert.equal(
      await milestone.locator("time").getAttribute("datetime"),
      "2025-08-01",
    );
    await milestone.click();
    const sourceSheet = schedule.locator(".ss-source-sheet");
    assert.match(await sourceSheet.textContent(), /1 Aug 2025/);
    assert.match(await sourceSheet.textContent(), /Description of Action/i);
    assert.match(await sourceSheet.textContent(), /Milestone-source\.pdf/);
    assert.match(await sourceSheet.textContent(), /Done|Completed/i);
    await untouched(schedule);
    pass(
      "Quarter, month and week timeline zoom stays contained; milestones expose recorded dates, completion and sources",
    );

    for (const width of [1440, 768, 390, 320]) {
      const responsive = await fresh(fixture, {
        viewport: { width, height: 1000 },
        colorScheme: "dark",
        ...(width <= 390 ? { isMobile: true, hasTouch: true } : {}),
      });
      await responsive
        .locator("[data-studio-palette-select]")
        .selectOption("contrast");
      await responsive
        .locator('[data-ss-action="zoom"][data-ss-value="week"]')
        .click();
      for (const profile of ["overview", "finance", "delivery"]) {
        await responsive
          .locator(`[data-mp="profile"][data-profile="${profile}"]`)
          .click();
        await noOverflow(responsive, `${profile} in dark mode at ${width}px`);
      }
      await untouched(responsive);
    }
    pass(
      "Shared controls, charts, register and timeline fit desktop, tablet and narrow touch screens in dark mode",
    );

    assert.deepEqual(errors, []);
    console.log(`\n${checks} studio checks passed.`);
  } finally {
    await Promise.allSettled(contexts.map((context) => context.close()));
    if (browser) await browser.close();
    server.kill();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
