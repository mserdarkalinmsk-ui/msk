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
  check((await p.locator('.drawer h2').first().textContent()).includes('Democratic Resilience'), 'palette opens project drawer');
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
  await p.selectOption('#f-country', 'ge');
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
  const csv = 'Project Code;Name;Country;Budget;Start;End\nUA-X1;Alpha;Ukraine;1.000.000;01.01.2026;31.12.2027\nUA-X2;Beta;Mars;5;2026-01-01;2025-01-01\n';
  writeFileSync(`${shots}/t.csv`, csv);
  await p.setInputFiles('.drawer input[type=file]', `${shots}/t.csv`); await p.waitForTimeout(300);
  check(await p.locator('.drawer .field select').first().inputValue() === '0', 'CSV columns auto-matched');
  check(await p.locator('text=1 ready · 1 with problems').count() === 1, 'CSV preview validates rows');
  await p.screenshot({ path: `${shots}/import.png` });
  await p.click('text=Import 1 row'); await p.waitForTimeout(300);
  check(await p.locator('.dt-cell:has-text("UA-X1")').count() > 0, 'CSV row imported');

  // Persistence across reload
  await p.reload(); await p.waitForSelector('.hero'); await p.waitForTimeout(500);
  check(await p.locator('.dt-cell:has-text("UA-X1")').count() > 0, 'data persists after reload');

  // Table: group + sort
  await p.selectOption('.dt-bar select', 'country'); await p.waitForTimeout(200);
  check(await p.locator('.dt-group').count() === 3, 'grouping shows subtotal rows');
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
