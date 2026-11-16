// End-to-end checks against the built single file (dist/index.html) in Chromium.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const url = 'file://' + resolve('dist/index.html') + '?today=2026-10-11&demo';
const shots = resolve(process.env.SHOTS || 'tests/shots'); mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
let failed = 0;
const check = (ok, msg) => { console.log(`${ok ? '✓' : '✗'} ${msg}`); if (!ok) failed++; };


const PGROUP = { 'Financial report': 'Finance', 'Budget lines': 'Finance', Justification: 'Finance', Scenario: 'Finance', Reports: 'Finance', Indicators: 'Results', 'Activity plan': 'Results', Risks: 'Results', 'Results & documents': 'Documents', History: 'Documents' };
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
  check(await p.locator('.ask-btn').count() === 0, 'assistant hidden in a saved copy (no claude.ai viewer)');
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
  await p.keyboard.type('UA-DR'); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
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
  await p.click('.tabs button:has-text("Follow-up")'); await p.waitForTimeout(200);
  await p.click('.subtabs button:has-text("Calendar")'); await p.waitForTimeout(300);
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
  await p.locator('table.stmt .tw').first().click(); await p.waitForTimeout(100);
  check(await p.locator('table.stmt tbody tr').count() < 8, 'statement heading collapses');
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
  await p.reload(); await p.waitForSelector('.hero');
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
  await p.click('.tabs button:has-text("Finance")'); await p.waitForTimeout(200);
  await p.click('.subtabs button:has-text("Month comparison")'); await p.waitForTimeout(200);
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
  check(errors.length === 0, 'bulk: no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
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
