// End-to-end checks against the built single file (dist/index.html) in Chromium.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const url = 'file://' + resolve('dist/index.html') + '?today=2026-10-11&demo';
const shots = resolve(process.env.SHOTS || 'tests/shots'); mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
let failed = 0;
const check = (ok, msg) => { console.log(`${ok ? '✓' : '✗'} ${msg}`); if (!ok) failed++; };


const PGROUP = { 'Financial report': 'Finance', 'Budget lines': 'Finance', Justification: 'Plan & revise', Scenario: 'Plan & revise', Reports: 'Finance', Indicators: 'Results', 'Activity plan': 'Results', Risks: 'Results', 'Results & documents': 'Documents', History: 'Documents' };
const SUBLABEL = { 'Results & documents': 'Documents' };
/** Opens a project tab: its group in the tab bar, then the sub-tab. */
async function ptab(p, name) {
  const g = PGROUP[name];
  if (!g) return p.click(`.tabs button:has-text("${name}")`);
  await p.click(`.tabs button:has-text("${g}")`); await p.waitForTimeout(80);
  await p.click(`.subtabs button:has-text("${SUBLABEL[name] ?? name}")`);
}

async function page(opts) {
  const ctx = await browser.newContext(opts);
  const p = await ctx.newPage(); await ctx.addInitScript(() => localStorage.setItem('pl-digest-seen', 'off'));
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await p.goto(url); await p.waitForSelector('.hero'); await p.waitForTimeout(700);
  return { p, errors, ctx };
}

// Desktop light
{
  const { p, errors, ctx } = await page({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
  check((await p.locator('.kpi.lead .value').textContent()).startsWith('€'), 'hero KPI renders');
  check(await p.locator('svg path').count() > 20, 'charts render');
  await p.screenshot({ path: `${shots}/overview-light.png`, fullPage: true });

  // Scroll stability: nothing but the top bar may move relative to the document
  const pos = () => p.$$eval('.card-h h2, .kpi .value', (els) => els.map((e) => Math.round(e.getBoundingClientRect().top + scrollY)));
  const before = await pos();
  for (const y of [300, 900, 1600, 0]) { await p.mouse.wheel(0, y - (await p.evaluate(() => scrollY))); await p.waitForTimeout(120); }
  check(JSON.stringify(before) === JSON.stringify(await pos()), 'layout is stable while scrolling');
  await p.evaluate(() => scrollTo(0, 800)); await p.waitForTimeout(150);
  const top = await p.$eval('.top', (e) => e.getBoundingClientRect().top);
  check(top === 0, 'top bar stays pinned');
  await p.evaluate(() => scrollTo(0, 0));

  // Command palette
  await p.keyboard.press('Control+k');
  check(await p.locator('.palette').isVisible(), 'Ctrl+K opens palette');
  await p.locator('.palette input:focus').waitFor(); // typed once the box has the focus, as a person would
  await p.keyboard.type('UA-DR'); await p.waitForSelector('.palette li:has-text("Democratic Resilience")'); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  check((await p.locator('.ph-title').textContent()).includes('Democratic Resilience'), 'palette opens project page');
  await p.goto(url + '#/overview'); await p.waitForSelector('.hero'); await p.waitForTimeout(400);
  await p.locator('.dt-row:not(.dt-head)').nth(0).locator('.dt-cell').nth(2).click(); await p.waitForTimeout(300);
  check(await p.locator('.drawer h2').count() > 0, 'table row opens project drawer');
  await p.screenshot({ path: `${shots}/drawer.png` });
  await p.keyboard.press('Escape');

  // Add project with validation
  await p.click('text=New project');
  await p.click('.drawer-f .btn.primary');
  check(await p.locator('.field .err').count() >= 4, 'form shows validation errors');
  await p.fill('#f-code', 'TR-TSK');
  check(await p.locator('text=Code already used').count() === 1, 'duplicate code rejected');
  await p.fill('#f-code', 'GE-NEW'); await p.fill('#f-name', 'Test Project'); await p.fill('#f-budget', '1.500.000,00');
  await p.fill('#f-start', '2026-01-01'); await p.fill('#f-end', '2027-12-31');
  await p.selectOption('#f-country', 'ge'); await p.selectOption('#f-sector', 'Democracy');
  await p.click('.drawer-f .btn.primary'); await p.waitForTimeout(300);
  check(await p.locator('.dt-cell:has-text("GE-NEW")').count() > 0, 'new project appears in table');
  await p.click('.toast button'); await p.waitForTimeout(300);
  check(await p.locator('.dt-cell:has-text("GE-NEW")').count() === 0, 'undo removes it');

  // Chart modes
  for (const m of ['Monthly', 'By country', 'Cumulative']) { await p.click(`.seg button:text-is("${m}")`); await p.waitForTimeout(250); }
  for (const m of ['Gap', '+ Committed', 'Spent']) { await p.click(`.seg button:text-is("${m}")`); await p.waitForTimeout(150); }
  await p.click('.seg button:text-is("Sector")'); await p.waitForTimeout(250);
  check(await p.locator('h2:text-is("Budget by sector")').count() === 1, 'breakdown switches to sector');
  await p.click('.seg button:text-is("Country")');
  // Chart drill-down: country filter
  await p.click('.chip:has-text("Georgia")'); await p.waitForTimeout(300);
  check((await p.locator('.kpi.lead .ctx').first().textContent()).includes('1 projects'), 'country filter narrows data');
  await p.click('.chip:has-text("All countries")');

  // CSV import with mapping + row validation
  await p.click('text=Import / backup');
  const csv = 'Project Code;Name;Country;Sector;Budget;Start;End\nUA-X1;Alpha;Ukraine;human rights;1.000.000;01.01.2026;31.12.2027\nUA-X2;Beta;Mars;Health;5;2026-01-01;2025-01-01\n';
  writeFileSync(`${shots}/t.csv`, csv);
  await p.setInputFiles('.drawer input[type=file]', `${shots}/t.csv`); await p.waitForTimeout(300);
  check(await p.locator('.drawer .field select').first().inputValue() === '0', 'CSV columns auto-matched');
  check(await p.locator('text=1 new · 0 updates · 1 with problems').count() === 1, 'CSV preview validates rows');
  await p.screenshot({ path: `${shots}/import.png` });
  await p.click('text=Import 1 row'); await p.waitForTimeout(300);
  check(await p.locator('.dt-cell:has-text("UA-X1")').count() > 0, 'CSV row imported');

  // Master list import: updates existing projects by code and fills identifiers
  await p.click('text=Import / backup');
  writeFileSync(`${shots}/master.csv`, 'Code,PMM No,BH,MAE,PMM link\nTR-TSK,4521,30117,DGI,https://pmm.example.org/projects/4521\n');
  await p.setInputFiles('.drawer input[type=file]', `${shots}/master.csv`); await p.waitForTimeout(300);
  check(await p.locator('text=0 new · 1 updates').count() === 1, 'master list matches existing project by code');
  await p.click('text=Import 1 row'); await p.waitForTimeout(300);
  check(await p.locator('a:has-text("4521 ↗")').count() === 1, 'PMM number and link shown in project table');

  // Persistence across reload
  await p.reload(); await p.waitForSelector('.hero'); await p.waitForTimeout(500);
  check(await p.locator('.dt-cell:has-text("UA-X1")').count() > 0, 'data persists after reload');

  // Table: group + sort
  await p.selectOption('.dt-bar select', 'country'); await p.waitForTimeout(200);
  check(await p.locator('.dt-group').count() === 3, 'grouping shows subtotal rows');
  // Sectors are a fixed list
  const opts = await p.$$eval('select[aria-label=Sector] option', (o) => o.map((x) => x.textContent));
  check(JSON.stringify(opts) === JSON.stringify(['All sectors', 'Human Rights', 'Democracy', 'Rule of Law']), 'sector filter has the three sectors');

  // Countries: add, block removal while used, remove when empty
  let pw = 'wrong';
  p.on('dialog', (d) => d.accept(d.type() === 'prompt' ? pw : undefined));
  await p.click('text=+ Country');
  await p.fill('#c-name', 'Moldova'); await p.fill('#c-iso', 'mda'); await p.waitForFunction(() => (document.querySelector('#c-region'))?.value, null, { timeout: 3000 }).catch(() => {}); check(await p.inputValue('#c-region') === 'Eastern Partnership', 'region filled from the country list'); await p.click('.drawer .btn.primary:has-text("Add country")'); await p.waitForTimeout(250);
  check(await p.locator('.chip:has-text("Moldova")').count() === 1, 'country added and shown as filter');
  await p.click('[aria-label="Remove Republic of Moldova"]'); await p.waitForTimeout(250);
  check(await p.locator('.chip:has-text("Moldova")').count() === 1, 'removal needs the admin password');
  pw = 'MSK';
  await p.click('[aria-label="Remove Republic of Moldova"]'); await p.waitForTimeout(250);
  check(await p.locator('.chip:has-text("Moldova")').count() === 0, 'empty country removed');
  await p.keyboard.press('Escape');

  // Bulk delete from the table + undo
  await p.goto(url + '#/projects'); await p.waitForSelector('.pcard');
  check(await p.locator('.pcard:not(.pcard-add)').count() >= 6, 'projects shown as cards by default');
  await p.waitForTimeout(700); await p.screenshot({ path: `${shots}/project-cards.png`, fullPage: true });
  await p.click('.seg button:has-text("List")'); await p.waitForSelector('.dt-row'); await p.waitForTimeout(300);
  const rowsBefore = await p.locator('.dt-row:not(.dt-head):not(.dt-total)').count();
  await p.locator('.dt-row:not(.dt-head):not(.dt-total) input[type=checkbox]').nth(0).check();
  await p.locator('.dt-row:not(.dt-head):not(.dt-total) input[type=checkbox]').nth(1).check();
  await p.click('.dt-bar .btn.danger'); await p.waitForTimeout(250);
  check(await p.locator('.dt-row:not(.dt-head):not(.dt-total)').count() === rowsBefore - 2, 'bulk delete removes selected projects');
  await p.click('.toast button:has-text("Undo")'); await p.waitForTimeout(250);
  check(await p.locator('.dt-row:not(.dt-head):not(.dt-total)').count() === rowsBefore, 'bulk delete undone');

  // Budget workspace
  await p.goto(url + '#/budget'); await p.waitForSelector('.hero'); await p.waitForTimeout(600);
  check(await p.locator('.dt-total:has-text("Total · 36")').count() === 1, 'budget lines table totals all 36 lines');
  check(await p.locator('table.stmt tfoot tr.t3 td:has-text("Total eligible")').count() === 1, 'portfolio statement on the budget page');
  await p.screenshot({ path: `${shots}/budget.png`, fullPage: true });

  // Project page tabs + Excel report import
  await p.goto(url + '#/project/lang'); await p.waitForSelector('.ph-title'); await p.waitForTimeout(500);
  await p.screenshot({ path: `${shots}/project.png`, fullPage: true });
  for (const t of ['Budget lines', 'Reports', 'Scenario', 'Activity plan', 'Risks']) {
    await ptab(p, t); await p.waitForTimeout(250);
    await p.screenshot({ path: `${shots}/project-${t.split(' ')[0].toLowerCase()}.png`, fullPage: true });
    if (t === 'Activity plan') {
      check(await p.locator('.gantt .gc.e').count() > 10, 'activity plan renders');
      const w0 = await p.evaluate(() => document.querySelector('.gantt').scrollWidth);
      await p.click('.seg button:has-text("Months")'); await p.waitForTimeout(150);
      check(await p.evaluate(() => document.querySelector('.gantt').scrollWidth) > w0 && await p.evaluate(() => document.querySelector('.gantt-wrap').scrollWidth > document.querySelector('.gantt-wrap').clientWidth), 'activity plan zooms and scrolls sideways');
      await p.locator('.gantt .gs button').first().click(); await p.waitForTimeout(150);
      await p.screenshot({ path: `${shots}/gantt.png` });
    }
    if (t === 'Risks') check(await p.locator('.matrix .mx').count() === 25, 'risk matrix renders');
    if (t === 'Scenario') check(await p.locator('.sim').count() === 1, 'project simulator renders');
  }
  await ptab(p, 'Reports');
  const nReports = await p.locator('.att li').count();
  await p.click('text=+ Import report');
  await p.setInputFiles('.drawer input[type=file]', resolve('tests/fixtures/report-q3.xlsx')); await p.waitForTimeout(400);
  await p.selectOption('#r-sheet', 'Budget'); await p.waitForTimeout(200);
  await p.fill('#r-date', '2026-09-30');
  check(await p.locator('.drawer table.mini:not(.irv-t) tbody tr').count() === 6, 'Excel report: header found, total row skipped');
  check(await p.locator('.drawer .irv-c .irv-t tbody tr').count() > 0, 'import preview lists the budget lines that change');
  check(await p.locator('.drawer .badge.warning').count() >= 1, 'Excel report: decreases flagged as warnings');
  await p.screenshot({ path: `${shots}/report-import.png` });
  await p.click('.drawer-f .btn.primary'); await p.waitForTimeout(300);
  check(await p.locator('.att li').count() === nReports + 1, 'imported report added as a new version');
  await ptab(p, 'Staff'); await p.waitForTimeout(300);
  check(await p.locator('.dt-cell:has-text("Ayla Testova")').count() === 1, 'staff read from the Purchase Orders sheet');

  // People: renewal queue → confirm contract dates
  await p.goto(url + '#/people'); await p.waitForSelector('.hero'); await p.waitForTimeout(500);
  await p.screenshot({ path: `${shots}/people.png`, fullPage: true });
  const firstName = (await p.locator('.att li .t').first().textContent()).trim();
  await p.locator('.att li').first().click(); await p.waitForTimeout(300);
  await p.fill('#ct-end', '2027-12-31'); await p.click('.drawer-f .btn.primary'); await p.waitForTimeout(300);
  const row = p.locator('.dt-row', { hasText: firstName });
  check(await row.locator('text=31 Dec 2027').count() > 0 && await row.locator('.badge.good:has-text("✓")').count() > 0, 'confirmed contract date overrides the source');
  check(await p.locator('h2:text-is("Staff report")').count() === 1, 'staff report section');
  await p.click('.seg button:has-text("Cost per person")'); await p.waitForTimeout(150); await p.click('.seg button:has-text("Staff lines")');
  await p.click('.seg button:has-text("SxB / HQ")'); await p.waitForTimeout(200);
  check(await p.locator('.dt-cell:has-text("Local")').count() === 0, 'base filter shows only HQ staff');

  // Map + reports
  await p.goto(url + '#/map'); await p.waitForSelector('.mapsvg'); await p.waitForTimeout(500);
  check(await p.locator('.map-proj').count() === 3, 'map lists every country');
  check(await p.locator('.mapsvg path.ctry.on').count() === 3, 'map colours the three portfolio countries');
  await p.locator('.map-proj').first().click(); await p.waitForTimeout(400);
  check(await p.locator('.map-side h2').textContent() === 'Türkiye', 'country drill-down opens');
  await p.click('.seg button:has-text("Pace")'); await p.waitForTimeout(300);
  await p.screenshot({ path: `${shots}/map.png`, fullPage: true });
  await p.goto(url + '#/reports'); await p.waitForSelector('.pack'); await p.waitForTimeout(500);
  check((await p.locator('.pack-pts li').first().textContent()).includes('have spent'), 'monthly pack writes the financial summary');
  await p.screenshot({ path: `${shots}/brief.png`, fullPage: true });
  await p.emulateMedia({ media: 'print' });
  check(!(await p.locator('.side').isVisible()) && await p.locator('.pack').isVisible(), 'print view shows only the pack');
  await p.emulateMedia({ media: 'screen' });
  // the deadlines of every country: under each country's Deadlines tab, and at their own address for all countries
  await p.goto(url + '#/reports/calendar'); await p.waitForSelector('.ag-e'); await p.waitForTimeout(300);
  check(await p.locator('.seg.views button[aria-pressed="true"]:has-text("Calendar")').count() === 1, 'deadlines open on the calendar view');
  check(await p.locator('.ag-e').count() >= 6, 'calendar lists open deadlines');
  await p.screenshot({ path: `${shots}/calendar.png`, fullPage: true });
  // CoE workbook dropped on the global import: recognised and offered to its project via Smart import
  await p.goto(url + '#/overview'); await p.waitForSelector('.hero');
  await p.click('text=Import / backup');
  await p.setInputFiles('.drawer .drop input', resolve('tests/fixtures/coe-report.xlsx')); await p.waitForTimeout(600);
  check(await p.locator('.drawer .si-l li').count() === 1 && await p.locator('.drawer:has-text("Financial report")').count() === 1, 'global import routes a report to Smart import');
  await p.keyboard.press('Escape');
  await p.goto(url + '#/project/tsk'); await p.waitForSelector('.ph-title');
  await p.click('.ph-actions button:has-text("Import report")');
  await p.setInputFiles('.drawer input[type=file]', resolve('tests/fixtures/coe-report.xlsx')); await p.waitForTimeout(700);
  check(await p.locator('.drawer :text("belongs to another project")').count() === 1 && await p.locator('.drawer-f .btn.primary').isDisabled(), 'report of another project is refused');
  await p.keyboard.press('Escape');
  await p.goto(url + '#/project/ukr'); await p.waitForSelector('.ph-title');
  await p.click('.ph-actions button:has-text("Import report")');
  await p.setInputFiles('.drawer input[type=file]', resolve('tests/fixtures/coe-report.xlsx')); await p.waitForTimeout(700);
  await p.click('.drawer-f .btn.primary'); await p.waitForTimeout(400);
  check(await p.locator('.ph-meta :text("BH")').count() === 1, 'BH saved to the project from the workbook');
  await ptab(p, 'Financial report'); await p.waitForTimeout(700);
  check(await p.locator('.wb-strip :text("700009999")').count() === 1, 'financial report tab shows the contract');
  check(await p.locator('.att li:has-text("20% above budget rate")').count() === 1, 'unit-rate check shown');
  check(await p.locator('table.stmt tfoot tr.t3').count() === 1, 'financial statement with totals block');
  const rowsOpen = await p.locator('table.stmt tbody tr').count();
  await p.locator('table.stmt .tw').first().click(); await p.waitForTimeout(100);
  check(await p.locator('table.stmt tbody tr').count() < rowsOpen, 'statement heading collapses');
  check(await p.locator('table.stmt tbody tr', { hasText: 'Equipment' }).count() >= 1, 'statement keeps every heading of the official layout, empty ones at zero');
  await p.click('.seg button:has-text("Units & rates")'); await p.waitForTimeout(100);
  await p.click('.seg button:has-text("Open POs")'); await p.waitForTimeout(200);
  check(await p.locator('.dt-total:has-text("€27,000")').count() === 1, 'open PO balance totals');
  await p.screenshot({ path: `${shots}/financial-report.png`, fullPage: true });

  // Project documents → contract, plan, risks, indicators
  await p.goto(url + '#/project/new'); await p.waitForSelector('.ph-title');
  await p.click('.ph-actions button:has-text("Add documents")');
  await p.setInputFiles('.drawer input[type=file]', [resolve('tests/fixtures/doa.docx'), resolve('tests/fixtures/contract.pdf')]);
  await p.waitForSelector('.doc-find', { timeout: 15000 });
  check(await p.locator('.doc-find').count() >= 5, 'documents: contract, dates, plan, risks and indicators found');
  await p.screenshot({ path: `${shots}/documents.png` });
  await p.click('.drawer-f .btn.primary'); await p.waitForTimeout(400);
  check((await p.locator('.ph-meta').textContent()).includes('Mar 2026'), 'implementation period updated from documents');
  await ptab(p, 'Activity plan'); await p.waitForTimeout(200);
  check(await p.locator('.gantt .ga').count() === 3, 'action plan replaced from the DoA');
  await ptab(p, 'Results & documents'); await p.waitForTimeout(200);
  check(await p.locator('dd:has-text("700008888")').count() === 1, 'contract shown');
  await ptab(p, 'Indicators'); await p.waitForTimeout(200);
  const ind = p.locator('.dt-row', { hasText: 'Judges trained' });
  check(await ind.count() === 1 && await p.locator('.dt-group').count() >= 1, 'indicators table grouped by output');
  await ind.locator('.editable').dblclick(); await ind.locator('input.dt-edit').fill('50'); await ind.locator('input.dt-edit').press('Enter'); await p.waitForTimeout(200);
  check(await p.locator('.dt-row', { hasText: 'Judges trained' }).locator('.lf-prog b').textContent() === '25%', 'indicator progress from the current value');
  await p.screenshot({ path: `${shots}/indicators.png`, fullPage: true });
  await ptab(p, 'Justification'); await p.waitForTimeout(200);
  check(await p.locator('h2:text-is("Budget justification")').count() === 1, 'justification tab');
  await ptab(p, 'Reports'); await ptab(p, 'Summary');

  // Appearance options
  await p.goto(url + '#/overview'); await p.waitForSelector('.hero');
  for (const st of ['Executive', 'Atlas', 'Bento']) {
    await p.click('text=Appearance'); await p.click(`.style-opt:has-text("${st}")`); await p.click('.drawer-f .btn.primary'); await p.waitForTimeout(500);
    await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(200);
    await p.screenshot({ path: `${shots}/style-${st.toLowerCase()}.png` });
  }
  check(await p.evaluate(() => document.documentElement.dataset.style) === 'pop', 'design direction applied');
  // Headless Chromium sometimes drops a file:// page's whole localStorage on reload (a marker key goes with it); the
  // choice is then made again once, so the check below still tests that a stored choice is applied on opening.
  for (let k = 0; k < 2; k++) {
    await p.evaluate(() => localStorage.setItem('pl-e2e-marker', '1'));
    await p.reload(); await p.waitForSelector('.hero');
    if (await p.evaluate(() => localStorage.getItem('pl-e2e-marker') === '1')) break;
    await p.click('text=Appearance'); await p.click('.style-opt:has-text("Bento")'); await p.click('.drawer-f .btn.primary'); await p.waitForTimeout(500);
  }
  await p.waitForFunction(() => document.documentElement.dataset.style === 'pop', null, { timeout: 3000 }).catch(() => {});
  check(await p.evaluate(() => document.documentElement.dataset.style) === 'pop', 'design direction remembered');
  await p.click('text=Appearance'); await p.click('text=Reset to default'); await p.click('.drawer-f .btn.primary');
  check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await ctx.close();
}


// Insights: alerts, changes, scenario, history, exports, import preview, old backup
{
  const { p, errors, ctx } = await page({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', acceptDownloads: true });
  const bell = await p.locator('.bell-n').textContent().catch(() => '0');
  check(Number(bell) > 0, `alert bell shows urgent count (${bell})`);
  await p.click('.bell'); await p.waitForSelector('.alerts li');
  const nAll = await p.locator('.alerts li').count();
  await p.click('.kpi-btn:has-text("critical")'); await p.waitForTimeout(100);
  check(await p.locator('.alerts li').count() < nAll, 'alert centre filters by severity');
  check(await p.locator('.wl-areas button:has-text("Staff")').count() + await p.locator('.wl-areas button:has-text("Reporting")').count() >= 1, 'alerts grouped by area');
  await p.screenshot({ path: `${shots}/alerts.png`, fullPage: true });
  await p.click('.tabs button:has-text("This month")'); await p.waitForTimeout(200);
  await p.click('.subtabs button:has-text("What changed")'); await p.waitForTimeout(200);
  await p.click('.seg.views button:has-text("Month comparison")'); await p.waitForTimeout(200);
  check(await p.locator('.mc-t tbody tr').count() >= 1, 'month comparison lists projects');
  await p.screenshot({ path: `${shots}/changes.png`, fullPage: true });
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('.tabs button:has-text("Excel")')]);
  const path = await dl.path(); const { readFileSync, statSync } = await import('node:fs');
  check(dl.suggestedFilename().endsWith('.xlsx') && statSync(path).size > 2000 && readFileSync(path).subarray(0, 2).toString() === 'PK', 'portfolio Excel export downloads');
  writeFileSync(`${shots}/portfolio.xlsx`, readFileSync(path));
  // project: words, forecast, scenario, history
  await p.goto(url + '#/project/lang'); await p.waitForSelector('.ph-title'); await p.waitForTimeout(300);
  check((await p.locator('.ck-story').textContent()).includes('spent'), 'project story written');
  check(await p.locator('.fc-big').count() === 1, 'end-of-project forecast shown');
  check(await p.locator('table.hd tbody tr').count() >= 3, 'budget headings vs approved budget');
  check(await p.locator('.rd-list li').count() === 10, 'project file checklist');
  await p.screenshot({ path: `${shots}/project-summary.png`, fullPage: true });
  await ptab(p, 'Scenario'); await p.waitForSelector('.scn-in');
  await p.locator('.scn-in').first().fill('-5000'); await p.locator('.scn-in').first().press('Tab');
  check(await p.locator('.scn-sum :text("−€5,000")').count() === 1, 'scenario shows net change');
  await p.click('button:has-text("Balance")'); await p.waitForTimeout(100);
  check(await p.locator('.scn-sum :text("balanced")').count() === 1, 'scenario balances');
  await p.screenshot({ path: `${shots}/scenario.png`, fullPage: true });
  // backup from the previous app
  const old = { app: 'Portfolio Ledger', exportedAt: '2025-01-01', state: { countries: [{ id: 'tr', name: 'Türkiye' }], projects: [{ id: 'o1', code: 'OLD-1', name: 'Old project', country: 'tr', start: '2024-01-01', end: '2026-12-31', budget: 1000 }], log: [{ at: '2025-01-01T09:00:00Z', msg: 'Old edit' }] } };
  writeFileSync(`${shots}/old-backup.json`, JSON.stringify(old));
  await p.goto(url + '#/overview'); await p.waitForSelector('.hero'); await p.click('text=Import / backup');
  await p.setInputFiles('.drawer .drop input', `${shots}/old-backup.json`); await p.waitForTimeout(300);
  check(await p.locator('.drawer h3:has-text("previous Portfolio Ledger")').count() === 1, 'previous-app backup recognised');
  await p.click('.drawer button:has-text("Replace data")'); await p.waitForTimeout(300);
  await p.goto(url + '#/reports/history'); await p.waitForSelector('.hist');
  check(await p.locator('.hist-i:has-text("Old edit")').count() === 1, 'old history carried over');
  check(await p.locator('.hist-i').first().textContent().then((t) => t.includes('Imported')), 'change history records the import');
  check(errors.length === 0, 'insights: no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await ctx.close();
}

// Where a figure comes from, the work list, rules, the period lock and protected backups
{
  const { p, errors, ctx } = await page({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', acceptDownloads: true });
  p.on('dialog', (d) => d.accept(d.type() === 'prompt' ? 'MSK' : undefined));
  // a project figure explains itself
  await p.goto(url + '#/project/lang'); await p.waitForSelector('.ph-title'); await p.waitForTimeout(300);
  const tile = (await p.locator('.ph-tiles .kpi.lead .value').innerText()).trim();
  await p.locator('.ph-tiles .kpi.lead .fig').click(); await p.waitForSelector('.tr-hero');
  check((await p.locator('.tr-t').innerText()) === 'Spent to date' && (await p.locator('.tr-terms li.eq').count()) === 1 && (await p.locator('.tr-src dt').count()) >= 2, `a figure opens where it comes from (${tile})`);
  check(await p.evaluate(() => { const b = document.querySelector('.drawer-b'); return b.scrollWidth <= b.clientWidth + 1; }), 'trace panel fits its drawer');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  check(await p.locator('.ck-g .gauge-bar').count() === 3 && await p.locator('.ck-g svg').count() === 0, 'project ratios shown as bars');
  // alerts as a work list: handled leaves the open list and the bell, reopen brings it back
  await p.goto(url + '#/reports/alerts'); await p.waitForSelector('.alerts li');
  const open0 = Number(await p.locator('.hero .kpi.lead .value').innerText()), bell0 = Number(await p.locator('.bell-n').textContent().catch(() => '0'));
  const first = (await p.locator('.alerts li .t').first().innerText()).trim();
  await p.locator('.alerts li .wl-act button:has-text("Handled")').first().click(); await p.fill('.wl-form .wl-in', 'letter sent'); await p.click('.wl-form .primary'); await p.waitForTimeout(300);
  const open1 = Number(await p.locator('.hero .kpi.lead .value').innerText()), bell1 = Number(await p.locator('.bell-n').textContent().catch(() => '0'));
  check(open1 === open0 - 1 && bell1 <= bell0, `a handled alert leaves the open list (${open0} → ${open1}, bell ${bell0} → ${bell1})`);
  await p.click('.wl .seg button:has-text("Handled")'); await p.waitForTimeout(150);
  check((await p.locator('.alerts li .t').first().innerText()).trim() === first && (await p.locator('.wl-note').first().innerText()).includes('letter sent'), 'handled alert kept with its note');
  await p.click('.wl .seg button:has-text("History")'); await p.waitForTimeout(150);
  check(await p.locator('.wl-log tbody tr').count() === 1, 'the decision is in the history');
  await p.click('.wl .seg button:has-text("Open")'); await p.locator('.alerts li .wl-act button:has-text("Snooze")').first().click(); await p.click('.wl-when .chipb:has-text("1 week")'); await p.click('.wl-form .primary'); await p.waitForTimeout(300);
  check(Number(await p.locator('.hero .kpi.lead .value').innerText()) === open0 - 2, 'a snoozed alert leaves the open list');
  await p.reload(); await p.waitForSelector('.alerts li'); await p.waitForTimeout(300);
  check(Number(await p.locator('.hero .kpi.lead .value').innerText()) === open0 - 2, 'alert decisions persist after reload');
  await p.click('.wl .seg button:has-text("Handled")'); await p.click('.wl-act button:has-text("Reopen")'); await p.waitForTimeout(300);
  check(Number(await p.locator('.hero .kpi.lead .value').innerText()) === open0 - 1, 'a reopened alert is open again');
  // rules: a stricter threshold gives more alerts, the defaults bring the count back
  const count = async () => Number(await p.locator('.hero .kpi.lead .value').innerText()) + await p.locator('.wl .seg button:has-text("Snoozed") .muted').innerText().then(Number) + await p.locator('.wl .seg button:has-text("Handled") .muted').innerText().then(Number);
  const all0 = await count();
  await p.click('.side-foot button:has-text("Rules")'); await p.waitForSelector('#rl-paceBehind');
  check(await p.locator('.rl-row').count() === 12 && await p.locator('.drawer-f .primary').isDisabled(), 'rules panel lists the twelve rules');
  await p.fill('#rl-paceBehind', '1'); await p.fill('#rl-staleDays', '30'); await p.fill('#rl-endingDays', '700'); await p.waitForTimeout(400);
  const prev = await p.locator('.rl-prev').innerText().catch(() => '');
  await p.click('.drawer-f .primary'); await p.waitForTimeout(500);
  const all1 = await count();
  check(all1 > all0 && prev.includes(`${all1} alert`), `stricter rules give more alerts, as previewed (${all0} → ${all1})`);
  await p.reload(); await p.waitForSelector('.alerts li'); await p.waitForTimeout(300);
  check(await count() === all1, 'rules persist after reload');
  await p.click('.side-foot button:has-text("Rules")'); await p.click('.drawer-f button:has-text("Reset all")'); await p.click('.drawer-f .primary'); await p.waitForTimeout(500);
  check(await count() === all0, 'defaults bring the alerts back');
  // monthly close locks the report of each project; a change afterwards is shown
  await p.goto(url + '#/reports/close'); await p.waitForSelector('.mc'); await p.waitForTimeout(300);
  await p.click('button:has-text("Close and lock")'); await p.waitForTimeout(400);
  check((await p.locator('.mc .hero .kpi.lead .ctx').innerText()).includes('figures locked') && await p.locator('.mc-drift').count() === 0, 'closing a month locks its figures');
  await p.locator('.mc-hrow').first().click(); await p.waitForTimeout(150);
  check(await p.locator('.mc-hx tbody tr').count() >= 2, 'a closed month shows the figures as closed');
  await p.goto(url + '#/project/lang/reports'); await p.waitForSelector('.rp-lock');
  check(await p.locator('.rp-lock').count() === 1, 'the report of the close carries a lock');
  await p.goto(url + '#/project/lang/lines'); await p.waitForSelector('.dt-scroll .editable');
  await p.locator('.dt-scroll .dt-cell.r .editable').nth(1).dblclick(); await p.waitForTimeout(150);
  await p.locator('.dt-scroll input:not([type=checkbox])').first().fill('1'); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  await p.goto(url + '#/reports/close'); await p.waitForSelector('.mc'); await p.waitForTimeout(300);
  check(await p.locator('.mc-drift tbody tr').count() >= 1, 'a figure changed after the close is shown');
  await p.locator('.mc-hrow').first().click(); await p.click('.mc-hx button:has-text("Reopen")'); await p.waitForTimeout(400);
  check(await p.locator('.mc-drift').count() === 0 && (await p.locator('.mc .hero .kpi.lead .value').innerText()).includes('Reopened'), 'a reopened month is no longer watched');
  // protected backup: encrypted file, opened again with the saved password
  await p.click('.side-foot button:has-text("Import / backup")'); await p.waitForSelector('.ds');
  await p.click('.ds button:has-text("Set a password")'); await p.fill('dialog.ask input[name=a]', 'secret-12'); await p.fill('dialog.ask input[name=b]', 'secret-13'); await p.click('dialog.ask button.primary');
  check((await p.locator('.ask-e').innerText()).includes('not the same'), 'a mistyped password is refused');
  await p.fill('dialog.ask input[name=b]', 'secret-12'); await p.click('dialog.ask button.primary'); await p.waitForTimeout(600);
  const [bk] = await Promise.all([p.waitForEvent('download'), p.click('.ds button:has-text("Back up now")')]);
  const { readFileSync } = await import('node:fs'); const raw = readFileSync(await bk.path(), 'utf8'), J = JSON.parse(raw);
  check(J.protected === true && !!J.enc?.data && !raw.includes('"projects":[') && !raw.includes('"code"'), 'protected backup is encrypted');
  check((await p.locator('.ds-head').innerText()).includes('backed up') && (await p.locator('.bk-status').innerText()).startsWith('Backed up'), 'backup state shown in the panel and the sidebar');
  writeFileSync(`${shots}/protected.json`, raw);
  await p.setInputFiles('.drawer .drop input[type=file]', `${shots}/protected.json`); await p.waitForTimeout(1500);
  check(await p.locator('.drawer button:has-text("Replace data")').count() === 1, 'protected backup opens with the saved password');
  await p.screenshot({ path: `${shots}/safety.png` });
  check(errors.length === 0, `work list, rules, lock, backup: no console errors${errors.length ? ' — ' + errors[0] : ''}`);
  await ctx.close();
}

// Many reports at once inside a project, ordered by the date in each report
{
  const { p, errors, ctx } = await page({ viewport: { width: 1440, height: 900 } });
  await p.goto(url + '#/project/geo'); await p.waitForSelector('.ph-title');
  await p.click('.ph-actions button:has-text("Import report")');
  await p.setInputFiles('.drawer input[type=file]', ['c', 'a', 'b'].map((k) => resolve(`tests/fixtures/series/report-${k}.xlsx`))); await p.waitForSelector('.drawer h2:has-text("Ordered by report date")', { timeout: 20000 });
  const dates = await p.locator('.drawer tbody tr td:first-child').allTextContents();
  check(dates.join('|') === '31 Mar 2026|30 Jun 2026|30 Sept 2026' || dates.join('|') === '31 Mar 2026|30 Jun 2026|30 Sep 2026', `bulk import sorted by report date (${dates.join(', ')})`);
  check(await p.locator('.drawer :text("belongs to another project")').count() === 0, 'bulk import: no conflicts');
  await p.screenshot({ path: `${shots}/bulk.png` });
  await p.click('.drawer-f .btn.primary'); await p.waitForTimeout(500);
  await ptab(p, 'Reports'); await p.waitForTimeout(400);
  check(await p.locator('h2:text-is("Reports over time")').count() === 1, 'reports over time shown');
  await p.screenshot({ path: `${shots}/reports-chart.png`, fullPage: true });
  await p.click('.seg button:has-text("Table")'); await p.waitForTimeout(150);
  const rows = await p.locator('table.rt tbody tr').count();
  await p.click('.seg button:has-text("By heading")'); await p.waitForTimeout(150);
  check(rows >= 4 && await p.locator('table.rh tbody tr').count() >= 3, 'reports table and heading view');
  await p.screenshot({ path: `${shots}/reports-heading.png`, fullPage: true });
  // PO review: its own tab on the project, every report followed, a row opens the order's history in every report
  await ptab(p, 'PO review'); await p.waitForSelector('.po-review');
  const poKpi = await p.locator('.po-review .po-kpi .po-k').last().textContent();
  const poRows = await p.locator('.po-review .dt-row:not(.dt-group):not(.dt-total)').count();
  console.log('   PO review:', poKpi, poRows, 'rows');
  check(/Reports followed\s*3/.test(poKpi ?? ''), `PO review follows the three reports (${poKpi})`);
  if (poRows > 1) { await p.locator('.po-review .dt-row[role=row] .dt-cell[role=gridcell]').nth(1).click(); await p.waitForTimeout(200); check(await p.locator('table.po-hist tbody tr').count() >= 1, 'a PO review row opens the order in every report'); }
  await p.screenshot({ path: `${shots}/po-review.png`, fullPage: true });
  // project tabs: dragged into another order, kept after a reload, back to the standard order with ↺
  const tabsNow = async () => (await p.locator('.tabs button[draggable]').allTextContents()).map((t) => t.replace(/\d+$/, '').trim());
  const t0 = await tabsNow();
  await p.locator('.tabs button[draggable]:has-text("Staff")').dragTo(p.locator('.tabs button[draggable]').first()); await p.waitForTimeout(200);
  const t1 = await tabsNow();
  check(t1[0] === 'Staff' && t1.length === t0.length, `a project tab dragged to the front (${t1.join(', ')})`);
  // the same headless quirk as above (a dropped file:// storage): told apart by a marker key, and the drag made once more
  let t2 = [];
  // the drop can repeat (seen twice in a row): up to four tries, each after a pause that lets the storage settle
  for (let i = 0; i < 4; i++) {
    await p.evaluate(() => localStorage.setItem('pl-e2e-marker', '1')); await p.waitForTimeout(400);
    await p.reload(); await p.waitForSelector('.ph-title'); await p.waitForTimeout(300);
    t2 = await tabsNow();
    if (await p.evaluate(() => localStorage.getItem('pl-e2e-marker') === '1')) break;
    if (t2[0] !== 'Staff') { await p.locator('.tabs button[draggable]:has-text("Staff")').dragTo(p.locator('.tabs button[draggable]').first()); await p.waitForTimeout(200); }
  }
  check(t2[0] === 'Staff', `the tab order is kept after a reload (${t2.join(', ')})`);
  if (await p.locator('.tabs .tab-reset').count()) { await p.click('.tabs .tab-reset'); await p.waitForTimeout(150); }
  check((await tabsNow()).join() === t0.join(), 'the standard tab order comes back with ↺');
  check(errors.length === 0, 'bulk: no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await ctx.close();
}

// Outputs: every deck and story slide keeps its content inside the slide body (nothing past the footer, nothing clipped),
// in screen and print media; chart labels stay inside their chart; the PowerPoint cover counts agree with the screen.
{
  const { p, errors, ctx } = await page({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  /** Slides whose content leaves the body box, and chart labels that leave their chart. */
  const outside = () => p.evaluate(() => {
    const bad = [];
    const svgText = (root, where) => root.querySelectorAll('svg').forEach((sv) => {
      const R = sv.getBoundingClientRect();
      sv.querySelectorAll('text').forEach((t) => { const r = t.getBoundingClientRect(); if (!r.width || !t.textContent.trim()) return;
        const d = Math.max(r.right - R.right, R.left - r.left, R.top - r.top, r.bottom - R.bottom); if (d > 1) bad.push(`${where}: chart label "${t.textContent.slice(0, 30)}" ${Math.round(d)}px outside`); });
    });
    document.querySelectorAll('.slide').forEach((sl, i) => {
      if (getComputedStyle(sl).display === 'none') return;
      const b = sl.querySelector(':scope > .sl-body'); if (!b) return;
      const B = b.getBoundingClientRect(), where = `slide ${i + 1} "${(sl.querySelector('h2, h1')?.textContent ?? '').slice(0, 40)}"`;
      if (!b.textContent.trim() && !b.querySelector('svg, canvas, img')) bad.push(`${where}: empty`);
      b.querySelectorAll('*').forEach((e) => {
        if (e.closest('svg') && e.tagName.toLowerCase() !== 'svg') return;
        const r = e.getBoundingClientRect(); if (!r.width || !r.height || getComputedStyle(e).visibility === 'hidden') return;
        const d = Math.max(r.bottom - B.bottom, r.right - B.right, B.left - r.left, B.top - r.top);
        if (d > 1) bad.push(`${where}: ${e.tagName.toLowerCase()} "${(e.textContent ?? '').trim().slice(0, 30)}" ${Math.round(d)}px outside the body`);
      });
      svgText(b, where);
    });
    document.querySelectorAll('.pack').forEach((pk) => svgText(pk, 'monthly pack'));
    return [...new Set(bad)].slice(0, 6);
  });
  const both = async (what) => {
    for (const media of ['screen', 'print']) { await p.emulateMedia({ media }); await p.waitForTimeout(900); const bad = await outside(); check(!bad.length, `${what} (${media}): content stays inside every slide and chart${bad.length ? ': ' + bad.join(' | ') : ''}`); }
    await p.emulateMedia({ media: 'screen' });
  };
  for (const aud of ['Management', 'Donor']) {
    await p.goto(url + '#/reports/deck'); await p.waitForSelector('.slide'); await p.waitForTimeout(600);
    await p.click(`.seg[aria-label=Audience] button:has-text("${aud}")`);
    const cb = p.locator('label:has-text("One page per project") input'); if (!(await cb.isChecked())) await cb.check();
    await p.click('.seg[aria-label=View] button:has-text("All slides")'); await p.waitForTimeout(1200);
    await both(`${aud} presentation`);
  }
  await p.goto(url + '#/reports/story'); await p.waitForSelector('.slide'); await p.waitForTimeout(1200);
  await both('portfolio story');
  await p.goto(url + '#/reports/pack'); await p.waitForSelector('.pack'); await p.waitForTimeout(1200);
  await both('monthly pack');
  // PowerPoint cover with one project in one country reads in the singular, as the slide on screen does
  await p.goto(url + '#/overview'); await p.waitForSelector('.hero'); await p.click('.chip:has-text("Georgia")'); await p.waitForTimeout(300);
  await p.evaluate(() => { location.hash = '#/reports/deck'; }); await p.waitForSelector('.slide'); await p.waitForTimeout(600);
  const lead = (await p.locator('.sl-cover .sl-lead').textContent()) ?? '';
  const [px] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.click('button:has-text("PowerPoint")')]);
  const { readFileSync } = await import('node:fs'); const { default: JSZip } = await import('jszip');
  const cover = await (await JSZip.loadAsync(readFileSync(await px.path()))).file('ppt/slides/slide1.xml').async('string');
  check(lead.includes('1 project in 1 country') && cover.includes('1 project in 1 country'), `PowerPoint cover agrees with the slide (${lead})`);
  await p.click('.chip:has-text("All countries")').catch(() => {});
  check(errors.length === 0, 'outputs: no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await ctx.close();
}

// Start data (no demo): real project, empty other countries
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage(); await ctx.addInitScript(() => localStorage.setItem('pl-digest-seen', 'off'));
  await p.goto(url.replace('&demo', '') + '#/projects'); await p.waitForSelector('.ph-title, .pcard, .empty-page', { timeout: 10000 }).catch(() => {});
  await p.waitForTimeout(500);
  check(await p.locator('article.pcard').count() === 6 && await p.locator('article.pcard:has-text("Enhancing Foreign Language")').count() === 1, 'start data: six real Türkiye projects');
  check(await p.locator('article.pcard:has-text("ROMA INTEGRATION") .pc-setup').count() === 1, 'projects without documents are marked set-up');
  await p.screenshot({ path: `${shots}/real-projects.png`, fullPage: true });
  await p.goto(url.replace('&demo', '') + '#/reports/compliance'); await p.waitForSelector('.chg-t');
  check(await p.locator('.chg-t tbody tr').count() === 6, 'compliance & results lists every project');
  await p.screenshot({ path: `${shots}/compliance.png`, fullPage: true });
  await p.goto(url.replace('&demo', '') + '#/project/jp3220'); await p.waitForSelector('.ph-title');
  await ptab(p, 'Budget lines'); await p.waitForTimeout(300);
  check(await p.locator('.dt-total:has-text("€5,403,333")').count() >= 1, 'approved budget baseline shown as budget lines');
  await p.screenshot({ path: `${shots}/real-lines.png`, fullPage: true });
  await ctx.close();
}

// Text the user typed or imported never runs as HTML inside a chart tooltip
{
  const { p, ctx } = await page({ viewport: { width: 1440, height: 900 } });
  await p.click('text=New project');
  await p.fill('#f-code', 'GE-ALPHA'); await p.fill('#f-name', 'Alpha <img src=x onerror="window.__xss=1">'); await p.fill('#f-budget', '1.000.000,00');
  await p.fill('#f-start', '2025-01-01'); await p.fill('#f-end', '2027-12-31');
  await p.selectOption('#f-country', 'ge'); await p.selectOption('#f-sector', 'Democracy');
  await p.click('.drawer-f .btn.primary'); await p.waitForTimeout(500); await p.keyboard.press('Escape');
  const c = p.locator('[aria-label="Pacing by project"]').first();
  await c.scrollIntoViewIfNeeded(); await p.click('.seg button:text-is("Gap")'); await p.waitForTimeout(600);
  const bx = await c.boundingBox(); let seen = false;
  for (let k = 0; k < 120 && !seen; k++) {
    await p.mouse.move(bx.x + 60 + Math.floor(k / 12) * 50, bx.y + 10 + (k % 12) * (bx.height / 12), { steps: 2 }); await p.waitForTimeout(60);
    seen = await p.evaluate(() => [...document.querySelectorAll('div')].some((d) => d.style.position === 'absolute' && d.textContent.includes('Alpha <img')));
  }
  check(seen && !(await p.evaluate(() => window.__xss)), 'chart tooltip shows a project name with markup as plain text');
  // The revision note printed as PDF carries the project code in its window title
  p.on('dialog', (d) => d.accept());
  await p.goto(url + '#/project/lang'); await p.waitForSelector('.ph-title'); await p.waitForTimeout(400);
  await p.click('text=Edit details'); await p.waitForTimeout(300);
  if (!(await p.locator('#f-code').count())) { await p.click('.drawer-f button:text-is("Edit")'); await p.waitForTimeout(300); }
  await p.fill('#f-code', 'TR-ALPHA</title><img src=x onerror="opener.__xss=2">');
  await p.click('.drawer-f .btn.primary'); await p.waitForTimeout(400); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.click('.tabs button:has-text("Plan & revise")'); await p.waitForTimeout(400);
  await p.click('.subtabs button:has-text("Forecast"), .tabs button:has-text("Forecast")'); await p.waitForTimeout(800);
  await p.click('button:has-text("Reports")'); await p.waitForTimeout(500);
  const [pop] = await Promise.all([ctx.waitForEvent('page', { timeout: 5000 }).catch(() => null), p.click('button:text-is("⎙ PDF") >> nth=-1')]);
  await p.waitForTimeout(800);
  check(!!pop && (await pop.title()).includes('</title>') && !(await p.evaluate(() => window.__xss)), 'PDF print window keeps a project code with markup in its title as text');
  await ctx.close();
}

// Removing a payment or resetting all data needs the admin password
{
  const { p, ctx } = await page({ viewport: { width: 1440, height: 900 } });
  let pw = 'wrong'; const asked = [];
  p.on('dialog', (d) => { if (d.type() === 'prompt') asked.push(d.message()); d.accept(d.type() === 'prompt' ? pw : undefined); });
  await p.goto(url + '#/reports/cash'); await p.waitForTimeout(1000);
  await p.locator('table tbody tr').first().locator('button, td').first().click(); await p.waitForTimeout(300);
  await p.fill('.cp-pay input[type=number]', '1000'); await p.click('.cp-pay button:has-text("Add payment")'); await p.waitForTimeout(300);
  await p.click('.cp-pay button:text-is("Remove")'); await p.waitForTimeout(300);
  check(asked.length === 1 && await p.locator('.cp-pay tbody tr').count() === 1, 'removing a payment asks the admin password and keeps it on a wrong one');
  await p.click('text=Import / backup'); await p.waitForTimeout(300);
  await p.click('button:has-text("Reset to start data")'); await p.waitForTimeout(300);
  check(asked.length === 2 && await p.locator('.toast:has-text("Start data restored")').count() === 0, 'reset to start data asks the admin password');
  pw = 'MSK'; await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.click('.cp-pay button:text-is("Remove")'); await p.waitForTimeout(300);
  check(await p.locator('.cp-pay tbody tr').count() === 0, 'the admin can remove a payment');
  await ctx.close();
}

// A save the browser refuses (storage full) is reported and written again with the next save, never taken as done
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => {
    localStorage.setItem('pl-digest-seen', 'off');
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...a) { const r = put.apply(this, a); if (window.__full) { const t = this.transaction; queueMicrotask(() => { try { t.abort(); } catch { /* done */ } }); } return r; };
  });
  const p = await ctx.newPage();
  const rename = async (id, name) => {
    await p.goto(url + '#/project/' + id); await p.waitForSelector('.ph-title'); await p.waitForTimeout(300);
    await p.click('text=Edit details'); await p.waitForTimeout(300);
    if (!(await p.locator('#f-name').count())) { await p.click('.drawer-f button:text-is("Edit")'); await p.waitForTimeout(300); }
    await p.fill('#f-name', name); await p.click('.drawer-f .btn.primary'); await p.waitForTimeout(800); await p.keyboard.press('Escape');
  };
  await p.goto(url); await p.waitForSelector('.hero'); await p.waitForTimeout(700);
  await p.evaluate(() => { window.__full = true; });
  await rename('lang', 'Alpha renamed');
  check(await p.locator('.toast:has-text("could not be saved")').count() === 1, 'a refused save is reported');
  await p.evaluate(() => { window.__full = false; });
  await rename('tsk', 'Beta renamed'); await p.waitForTimeout(500);
  const st = await p.evaluate(() => new Promise((res) => { const r = indexedDB.open('portfolio-ledger-next'); r.onsuccess = () => { const s = r.result.transaction('kv').objectStore('kv'), m = s.get('demo:m'), l = s.get('demo:p:lang'); s.transaction.oncomplete = () => res({ ids: m.result?.ids?.length, lang: l.result?.name }); }; }));
  const n = await p.evaluate(() => new Promise((res) => { const r = indexedDB.open('portfolio-ledger-next'); r.onsuccess = () => { const k = r.result.transaction('kv').objectStore('kv').getAllKeys(); k.onsuccess = () => res(k.result.filter((x) => String(x).startsWith('demo:p:')).length); }; }));
  check(st.ids === n && n >= 6 && st.lang === 'Alpha renamed', `after a refused save every project is stored (${n}/${st.ids}, lang “${st.lang}”)`);
  await ctx.close();
}
{
  // Offices: a country's desk with its tabs; a contract entered on the calendar is warned before its end, there and in the alert centre
  const { p, errors, ctx } = await page({ viewport: { width: 1440, height: 900 } });
  await p.goto(url + '#/offices'); await p.waitForSelector('.cd-tabs');
  const tabs = await p.locator('.cd-tabs button').allTextContents();
  await p.click('.cd-tabs button:text-is("Staff")'); await p.waitForTimeout(200);
  check(/#\/countries\/[^/]+\/staff$/.test(p.url()), `a country's tab is in the address (${p.url().split('#')[1]})`);
  await p.reload(); await p.waitForSelector('.cd-tabs');
  check((await p.locator('.cd-tabs [aria-selected=true]').textContent()) === 'Staff', 'the country tab is kept after a reload');
  await p.goBack(); await p.waitForTimeout(300);
  check(tabs.join('|') === 'Overview|Office budget|Projects|Budget lines|Tenders & suppliers|Staff|Deadlines', `country desk tabs (${tabs.join(', ')})`);
  for (const t of tabs) { await p.click(`.cd-tabs button:text-is("${t}")`); await p.waitForTimeout(150); }
  await p.click('.cd-tabs button:text-is("Tenders & suppliers")'); await p.waitForSelector('.cc-form');
  const f = (i, v) => p.fill(`.cc-form label:nth-of-type(${i}) input`, v);
  await f(1, 'Gamma Events Ltd'); await f(2, 'FWC-T1'); await f(3, '50000'); await f(4, '2025-01-01'); await f(5, '2026-10-31');
  await p.click('.cc-form button[type=submit]'); await p.waitForTimeout(300);
  check(await p.locator('.cc-row.s-critical:has-text("Gamma Events Ltd") .badge:has-text("20 d left")').count() === 1, 'a contract ending in 20 days is on the calendar as critical');
  await p.setInputFiles('.cc-row:has-text("Gamma Events Ltd") .att-c input', resolve('tests/fixtures/contract.pdf')); await p.waitForTimeout(400);
  check(await p.locator('.cc-row:has-text("Gamma Events Ltd") .att-open').count() === 1, 'the signed contract is attached to its row and can be opened');
  await f(1, 'Delta Utilities'); await p.check('.cc-form label.cc-open input'); await p.click('.cc-form button[type=submit]'); await p.waitForTimeout(300);
  check(await p.locator('.cc-row.open:has-text("Delta Utilities") .badge:has-text("open-ended")').count() === 1 && await p.locator('.cc-alerts, .cc-row.open .badge.critical').count() === 0, 'an open-ended contract is on the calendar without a date and without a warning');
  await p.screenshot({ path: `${shots}/contract-calendar.png`, fullPage: true });
  // Staff: everyone, the core team, the project staff… one view at a time; a core team contract ending soon is warned
  await p.click('.cd-tabs button:text-is("Staff")'); await p.click('.cd-views button:has-text("Core team")'); await p.waitForSelector('.cc-form');
  await f(1, 'Alpha, One'); await f(2, 'Office assistant'); await f(5, '2026-11-25');
  await p.click('.cc-form button[type=submit]'); await p.waitForTimeout(300);
  check(await p.locator('.ct-t tr:has-text("Alpha, One") .badge:has-text("45 d left")').count() === 1, 'core team member added, with the days left');
  p.once('dialog', (d) => d.accept());
  await p.setInputFiles('.cc label.btn input[type=file]', resolve('tests/fixtures/core-team.xlsx')); await p.waitForTimeout(800);
  check(await p.locator('.ct-t tr:has-text("Gamma, Three") .badge:has-text("19 d left")').count() === 1 && await p.locator('.ct-t tr:has-text("Delta, Four")').count() === 1, 'core team read from an Excel list, dates and all');
  await p.click('.cd-views button:has-text("Everyone")'); await p.waitForSelector('.cp-t');
  check(await p.locator('.cp-t tr:has-text("Alpha, One")').count() === 1 && await p.locator('.cp-t tr:has-text("Gamma, Three")').count() === 1, 'everyone of the country listed once, core team and project staff together');
  await p.goto(url + '#/reports/alerts'); await p.waitForSelector('.cc-alerts');
  check(await p.locator('.cc-alerts li:has-text("Gamma Events Ltd")').count() === 1, 'the contract ending soon is in the alert centre');
  // the admin password is changed under Rules & thresholds, kept hashed, and asked from then on
  await p.click('text=Rules & thresholds'); await p.waitForSelector('.rl-pw');
  const pw = p.locator('.rl-pw input'); await pw.nth(0).fill('MSK'); await pw.nth(1).fill('NewPass1'); await pw.nth(2).fill('NewPass1'); await p.click('.rl-pw button'); await p.waitForTimeout(300);
  check(await p.locator('.rl-pw .rl-ok').count() === 1, 'the admin password can be changed');
  const stored = await p.evaluate(() => JSON.stringify(localStorage) + document.documentElement.outerHTML);
  check(!stored.includes('NewPass1'), 'the new password is not kept as typed');
  await pw.nth(0).fill('NewPass1'); await pw.nth(1).fill('MSK'); await pw.nth(2).fill('MSK'); await p.click('.rl-pw button'); await p.waitForTimeout(300);
  await p.keyboard.press('Escape');
  check(await p.locator('.cc-alerts li:has-text("Alpha, One")').count() === 1, 'the core team contract ending soon is in the alert centre');
  // a long page lists its sections at the bottom right, and one click takes you to a section
  await p.goto(url + '#/overview'); await p.waitForTimeout(1500);
  if (await p.locator('.pidx-b').count()) { await p.click('.pidx-b'); const n = await p.locator('.pidx-l li').count(); await p.locator('.pidx-l li').nth(Math.max(0, n - 2)).click(); await p.waitForTimeout(700);
    check(await p.evaluate(() => scrollY) > 300, 'the page index takes you down to a section'); }
  else check(false, 'a long page offers its list of sections');
  await p.goto(url + '#/countries'); await p.waitForSelector('.cd-tabs'); await p.click('.cd-tabs button:text-is("Overview")'); await p.waitForSelector('.ca');
  if (await p.locator('.ca button:has-text("Show all")').count()) await p.click('.ca button:has-text("Show all")');
  check(await p.locator('.ca-i:has-text("Gamma Events Ltd")').count() === 1 && await p.locator('.ca-i:has-text("Alpha, One")').count() === 1, 'the country lists its own alerts, contracts and core team in one place');
  check(await p.locator('.la').count() === 1 && await p.locator('.sl tbody tr').count() >= 1, 'the country looks ahead and says what its latest reports brought');
  check(errors.length === 0, 'offices desk: no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await ctx.close();
}
{
  // Browser storage not available at all (blocked site data): changes are not kept, and the user is told
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => {
    localStorage.setItem('pl-digest-seen', 'off');
    IDBFactory.prototype.open = function () { const r = {}; setTimeout(() => r.onerror?.(new Event('error')), 0); return r; };
  });
  const p = await ctx.newPage();
  await p.goto(url + '#/project/lang'); await p.waitForSelector('.ph-title'); await p.waitForTimeout(400);
  await p.click('text=Edit details'); await p.waitForTimeout(300);
  if (!(await p.locator('#f-name').count())) { await p.click('.drawer-f button:text-is("Edit")'); await p.waitForTimeout(300); }
  await p.fill('#f-name', 'Alpha renamed'); await p.click('.drawer-f .btn.primary'); await p.waitForTimeout(900);
  check(await p.locator('.toast:has-text("could not be saved")').count() === 1, 'a save without browser storage is reported');
  await ctx.close();
}

// Smallest desktop width: no sideways page scroll, nothing wider than its card or tile, chart labels apart
{
  const { p, errors, ctx } = await page({ viewport: { width: 1280, height: 900 }, colorScheme: 'dark' });
  const fit = () => {
    const out = [], de = document.documentElement;
    if (de.scrollWidth > de.clientWidth) out.push(`page scrolls sideways by ${de.scrollWidth - de.clientWidth}px`);
    // Content past a card's edge, unless a scrolling or clipping box inside the card holds it.
    for (const card of document.querySelectorAll('main .card, main .kpi, main .pcard')) {
      const cr = card.getBoundingClientRect(); if (!cr.width) continue;
      for (const e of card.querySelectorAll('*')) {
        if (e.closest('svg') && e.tagName !== 'svg') continue;
        const r = e.getBoundingClientRect(); if (!r.width || !r.height || getComputedStyle(e).visibility === 'hidden') continue;
        let held = false; for (let a = e.parentElement; a && a !== card; a = a.parentElement) if (getComputedStyle(a).overflowX !== 'visible') { held = true; break; }
        if (!held && (r.right > cr.right + 2 || r.left < cr.left - 2)) { out.push(`"${(e.textContent || e.className).trim().slice(0, 30)}" leaves "${card.querySelector('h2, .label')?.textContent?.trim().slice(0, 30)}" by ${Math.round(Math.max(r.right - cr.right, cr.left - r.left))}px`); break; }
      }
    }
    // Chart labels: no two visible texts of one chart on top of each other, none under the Table switch.
    const box = (e) => e.getBoundingClientRect(), hit = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2;
    for (const w of document.querySelectorAll('main .chart-wrap')) {
      const T = [...w.querySelectorAll('svg text')].filter((t) => t.textContent.trim() && box(t).width && !t.closest('[clip-path]'));
      for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) if (hit(box(T[i]), box(T[j]))) out.push(`chart labels "${T[i].textContent}" and "${T[j].textContent}" overlap`);
      const wr = box(w); for (const t of T) { const r = box(t); if (r.right > wr.right + 2 || r.left < wr.left - 2) out.push(`chart label "${t.textContent}" cut at the chart edge`); }
      const b = w.querySelector('.chart-tbl-btn'); if (b) for (const t of T) if (/^\d+\/\d+$/.test(t.textContent.trim()) && hit(box(t), box(b))) out.push('legend page arrows under the Table switch');
    }
    // Text contrast in the dark theme: at least 3:1 against the flat background behind it.
    const cv = document.createElement('canvas').getContext('2d');
    const rgba = (c) => { cv.fillStyle = '#000'; cv.fillStyle = c; const h = cv.fillStyle; if (h[0] === '#') return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).concat(1); const p = h.match(/[\d.]+/g).map(Number); return h.startsWith('color(') ? [p[0] * 255, p[1] * 255, p[2] * 255, p[3] ?? 1] : [p[0], p[1], p[2], p[3] ?? 1]; };
    const lum = (c) => c.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
    const tw = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT);
    for (let n; (n = tw.nextNode());) {
      const e = n.parentElement; if (!n.textContent.trim() || !e || e.closest('svg, [disabled], .soon') || !e.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      let bg = null, layers = [], op = 1, skip = false;
      for (let a = e; a; a = a.parentElement) { const s = getComputedStyle(a); op *= +s.opacity; if (/absolute|fixed/.test(s.position) || s.backgroundImage !== 'none') { skip = true; break; } const c = rgba(s.backgroundColor); if (c[3] > 0) { layers.push(c); if (c[3] > 0.99) break; } }
      if (skip || !layers.length) continue;
      bg = layers.reverse().reduce((o, c) => o.map((v, i) => v * (1 - c[3]) + c[i] * c[3]), [0, 0, 0]);
      const f = rgba(getComputedStyle(e).color), a = f[3] * op, fg = f.slice(0, 3).map((v, i) => v * a + bg[i] * (1 - a));
      const r = (Math.max(lum(fg), lum(bg)) + 0.05) / (Math.min(lum(fg), lum(bg)) + 0.05);
      if (r < 3) { out.push(`"${n.textContent.trim().slice(0, 30)}" contrast ${r.toFixed(2)}:1`); break; }
    }
    return out;
  };
  for (const r of ['overview', 'projects', 'budget', 'people', 'offices', 'countries', 'map', 'reports', 'reports/outlook', 'reports/heat', 'reports/close', 'reports/studio', 'reports/compare', 'project/lang', 'project/lang/finance', 'project/geo/scenario']) {
    await p.goto(url + '#/' + r); await p.waitForTimeout(500);
    // Charts draw when they come into view.
    const H = await p.evaluate(() => document.body.scrollHeight); for (let y = 0; y < H; y += 800) { await p.evaluate((y) => scrollTo(0, y), y); await p.waitForTimeout(60); }
    await p.waitForTimeout(700);
    const bad = await p.evaluate(fit);
    check(bad.length === 0, `1280 px ${r}: fits its cards, labels apart, text readable${bad.length ? ' — ' + bad.slice(0, 3).join('; ') : ''}`);
  }
  check(errors.length === 0, '1280 px: no console errors');
  await ctx.close();
}

// A shared copy carries its data compressed and opens with every project in it
{
  const { p, ctx } = await page({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  await p.goto(url + '#/projects'); await p.waitForSelector('.pcard'); const n = await p.locator('.pcard:not(.pcard-add)').count();
  await p.click('text=Share a copy'); await p.waitForTimeout(400);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('.drawer-f .btn.primary')]);
  const file = resolve(shots, 'shared-copy.html'); await dl.saveAs(file);
  const html = (await import('node:fs')).readFileSync(file, 'utf8');
  const emb = JSON.parse(html.match(/<script id="pl-embed" type="application\/json">(.*?)<\/script>/s)?.[1] ?? '{}');
  check(typeof emb.z === 'string' && !emb.ledger, 'shared copy: data stored compressed');
  const q = await ctx.newPage(); await q.goto('file://' + file + '#/projects'); await q.waitForSelector('.pcard');
  check(await q.locator('.pcard:not(.pcard-add)').count() === n && await q.locator('.sh-banner').count() === 1, 'shared copy opens with every project');
  await ctx.close();
}

// Dark + mobile
{
  const { p, errors, ctx } = await page({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
  await p.screenshot({ path: `${shots}/overview-dark.png`, fullPage: true });
  check(errors.length === 0, 'dark: no console errors');
  await ctx.close();
}
{
  const { p, errors, ctx } = await page({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  for (const r of ['overview', 'projects', 'budget', 'people', 'map', 'reports', 'reports/alerts', 'reports/changes', 'project/lang']) {
    await p.goto(url + '#/' + r); await p.waitForTimeout(500);
    const sw = await p.evaluate(() => document.documentElement.scrollWidth);
    check(sw <= 390, `mobile ${r}: no horizontal page scroll (${sw}px)`);
    await p.screenshot({ path: `${shots}/m-${r.replace('/', '-')}.png`, fullPage: true });
  }
  check(errors.length === 0, 'mobile: no console errors');
  await ctx.close();
}
await browser.close();
console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
