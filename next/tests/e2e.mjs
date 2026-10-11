// End-to-end checks against the built single file (dist/index.html) in Chromium.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const url = 'file://' + resolve('dist/index.html') + '?today=2026-10-11';
const shots = resolve(process.env.SHOTS || 'tests/shots'); mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
let failed = 0;
const check = (ok, msg) => { console.log(`${ok ? '✓' : '✗'} ${msg}`); if (!ok) failed++; };

async function page(opts) {
  const ctx = await browser.newContext(opts);
  const p = await ctx.newPage();
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
  p.on('dialog', (d) => d.accept());
  await p.click('text=+ Country');
  await p.fill('#c-name', 'Moldova'); await p.fill('#c-iso', 'mda'); await p.click('.drawer .btn.primary:has-text("Add country")'); await p.waitForTimeout(250);
  check(await p.locator('.chip:has-text("Moldova")').count() === 1, 'country added and shown as filter');
  await p.click('[aria-label="Remove Türkiye"]');
  check(await p.locator('.errlist:has-text("still use this country")').count() === 1, 'country with projects cannot be removed');
  await p.click('[aria-label="Remove Moldova"]'); await p.waitForTimeout(250);
  check(await p.locator('.chip:has-text("Moldova")').count() === 0, 'empty country removed');
  await p.keyboard.press('Escape');

  // Bulk delete from the table + undo
  await p.goto(url + '#/projects'); await p.waitForSelector('.dt-row'); await p.waitForTimeout(300);
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
  await p.screenshot({ path: `${shots}/budget.png`, fullPage: true });

  // Project page tabs + Excel report import
  await p.goto(url + '#/project/lang'); await p.waitForSelector('.ph-title'); await p.waitForTimeout(500);
  await p.screenshot({ path: `${shots}/project.png`, fullPage: true });
  for (const t of ['Budget lines', 'Reports', 'Activity plan', 'Risks']) {
    await p.click(`.tabs button:has-text("${t}")`); await p.waitForTimeout(250);
    await p.screenshot({ path: `${shots}/project-${t.split(' ')[0].toLowerCase()}.png`, fullPage: true });
    if (t === 'Activity plan') check(await p.locator('.gantt .gc.e').count() > 10, 'activity plan renders');
    if (t === 'Risks') check(await p.locator('.matrix .mx').count() === 25, 'risk matrix renders');
  }
  await p.click('.tabs button:has-text("Reports")');
  const nReports = await p.locator('.att li').count();
  await p.click('text=+ Import report');
  await p.setInputFiles('.drawer input[type=file]', resolve('tests/fixtures/report-q3.xlsx')); await p.waitForTimeout(400);
  await p.selectOption('#r-sheet', 'Budget'); await p.waitForTimeout(200);
  await p.fill('#r-date', '2026-09-30');
  check(await p.locator('.drawer table.mini tbody tr').count() === 6, 'Excel report: header found, total row skipped');
  check(await p.locator('.drawer .badge.warning').count() >= 1, 'Excel report: decreases flagged as warnings');
  await p.screenshot({ path: `${shots}/report-import.png` });
  await p.click('.drawer-f .btn.primary'); await p.waitForTimeout(300);
  check(await p.locator('.att li').count() === nReports + 1, 'imported report added as a new version');
  await p.click('.tabs button:has-text("People")'); await p.waitForTimeout(300);
  check(await p.locator('.dt-cell:has-text("Ayla Testova")').count() === 1, 'staff read from the Purchase Orders sheet');

  // People: renewal queue → confirm contract dates
  await p.goto(url + '#/people'); await p.waitForSelector('.hero'); await p.waitForTimeout(500);
  await p.screenshot({ path: `${shots}/people.png`, fullPage: true });
  const firstName = (await p.locator('.att li .t').first().textContent()).trim();
  await p.locator('.att li').first().click(); await p.waitForTimeout(300);
  await p.fill('#ct-end', '2027-12-31'); await p.click('.drawer-f .btn.primary'); await p.waitForTimeout(300);
  const row = p.locator('.dt-row', { hasText: firstName });
  check(await row.locator('text=31 Dec 2027').count() > 0 && await row.locator('.badge.good:has-text("✓")').count() > 0, 'confirmed contract date overrides the source');
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
  await p.goto(url + '#/reports'); await p.waitForSelector('.brief'); await p.waitForTimeout(500);
  check((await p.locator('.brief p').first().textContent()).includes('has spent'), 'executive brief writes the financial summary');
  await p.screenshot({ path: `${shots}/brief.png`, fullPage: true });
  await p.emulateMedia({ media: 'print' });
  check(!(await p.locator('.side').isVisible()) && await p.locator('.brief').isVisible(), 'print view shows only the brief');
  await p.emulateMedia({ media: 'screen' });
  await p.click('.tabs button:has-text("Reporting calendar")'); await p.waitForTimeout(300);
  check(await p.locator('.cal-i').count() >= 6, 'reporting calendar lists open deadlines');
  await p.screenshot({ path: `${shots}/calendar.png`, fullPage: true });
  check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
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
  const sw = await p.evaluate(() => document.documentElement.scrollWidth);
  check(sw <= 390, `mobile: no horizontal page scroll (${sw}px)`);
  await p.screenshot({ path: `${shots}/overview-mobile.png`, fullPage: true });
  check(errors.length === 0, 'mobile: no console errors');
  await ctx.close();
}
await browser.close();
console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
