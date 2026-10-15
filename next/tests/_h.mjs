import { chromium } from 'playwright-core';
import { readdirSync } from 'fs';
const S = process.argv[2];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const c = await b.newContext({ viewport: { width: 1400, height: 1300 } });
await c.addInitScript(() => localStorage.setItem('pl-digest-seen', 'off'));
const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('file://' + process.cwd() + '/dist/index.html'); await p.waitForTimeout(2000);
await p.click('text=Import / backup'); await p.waitForTimeout(300);
const files = [...readdirSync(S + '/si').map(f => S + '/si/' + f), S + '/up/r.xlsx'];
await p.setInputFiles('.drawer input[type=file]', files); await p.waitForTimeout(12000);
await p.screenshot({ path: S + '/h1.png' });
const btn = p.locator('.drawer-f .btn.primary'); if (await btn.count()) { await btn.click(); await p.waitForTimeout(3000); }
await p.evaluate(() => { location.hash = '#/reports/health'; }); await p.waitForTimeout(1500);
console.log(await p.locator('#content').innerText());
console.log(errs);
await b.close();
