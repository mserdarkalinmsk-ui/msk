// Visual comparison of every screen against a baseline, on the demo data of the built single file.
//
//   node tests/visual.mjs baseline     shoot every screen into tests/visual/base (before a change)
//   node tests/visual.mjs check        shoot again into tests/visual/now and list the screens that differ
//
// Both themes are shot at 1440 px; the build stamp is hidden so two builds of the same screens compare equal.
// Exit code 1 when a screen differs, so a change that moves something by one pixel is seen before it ships.
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const mode = process.argv[2];
if (mode !== 'baseline' && mode !== 'check') { console.log('usage: node tests/visual.mjs baseline|check'); process.exit(2); }
const root = resolve('tests/visual'), dir = `${root}/${mode === 'baseline' ? 'base' : 'now'}`;
if (mode === 'check' && !existsSync(`${root}/base`)) { console.log('No baseline yet: run "node tests/visual.mjs baseline" first.'); process.exit(2); }
rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });

const url = 'file://' + resolve('dist/index.html') + '?today=2026-10-11&demo';
const REPORTS = ['close', 'checklist', 'changed', 'changes', 'pack', 'deck', 'studio', 'outlook', 'cost', 'cash', 'calendar', 'ending', 'annual', 'compare', 'heat', 'vs', 'transfer', 'commit', 'staffpo', 'units', 'providers', 'alerts', 'wp', 'results', 'compliance', 'closure', 'gaps', 'health', 'bcheck', 'history'];
const PROJECT = ['summary', 'finance', 'statement', 'checks', 'budget', 'bydate', 'pos', 'diff', 'lines', 'staff', 'docs', 'revision', 'forecast', 'reports', 'risks', 'wp'];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
for (const scheme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' });
  await ctx.addInitScript(() => {
    localStorage.setItem('pl-digest-seen', 'off');
    addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '.build{visibility:hidden!important}'; document.head.appendChild(s); });
  });
  const p = await ctx.newPage();
  const pid = 'lang'; // a demo project with every kind of record
  const routes = ['overview', 'projects', 'budget', 'people', 'offices', ...REPORTS.map((x) => `reports/${x}`), ...PROJECT.map((x) => `project/${pid}/${x}`), `brief/${pid}`];
  for (const r of routes) {
    await p.goto(`${url}#/${r}`); await p.reload(); await p.waitForTimeout(800);
    // Charts below the fold draw when they come near the screen: scroll through once.
    await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise((ok) => setTimeout(ok, 60)); } scrollTo(0, 0); });
    await p.waitForTimeout(800);
    const h = Math.min(4000, await p.evaluate(() => document.documentElement.scrollHeight));
    await p.screenshot({ path: `${dir}/${scheme}-${r.replace(/\//g, '_')}.png`, fullPage: true, clip: { x: 0, y: 0, width: 1440, height: h } });
  }
  await ctx.close();
}

if (mode === 'baseline') { console.log(`Baseline: ${readdirSync(dir).length} screens in ${dir}`); await browser.close(); process.exit(0); }

// Pixel comparison in the browser: a pixel differs when its colour moves by more than a hair.
const page = await browser.newPage();
let differ = 0;
for (const f of readdirSync(`${root}/base`).filter((x) => x.endsWith('.png'))) {
  if (!existsSync(`${dir}/${f}`)) { differ++; console.log(`✗ ${f}: missing now`); continue; }
  const r = await page.evaluate(async ([a, b]) => {
    const load = (u) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = u; });
    const [x, y] = await Promise.all([load(a), load(b)]);
    if (x.width !== y.width || x.height !== y.height) return { size: `${x.width}×${x.height} → ${y.width}×${y.height}` };
    const px = (i) => { const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0); return g.getImageData(0, 0, i.width, i.height).data; };
    const d1 = px(x), d2 = px(y); let n = 0, top = -1;
    for (let j = 0; j < d1.length; j += 4) if (Math.abs(d1[j] - d2[j]) + Math.abs(d1[j + 1] - d2[j + 1]) + Math.abs(d1[j + 2] - d2[j + 2]) > 30) { n++; if (top < 0) top = Math.floor(j / 4 / x.width); }
    return { n, top };
  }, [`data:image/png;base64,${readFileSync(`${root}/base/${f}`).toString('base64')}`, `data:image/png;base64,${readFileSync(`${dir}/${f}`).toString('base64')}`]);
  if (r.size || r.n) { differ++; console.log(`✗ ${f}: ${r.size ?? `${r.n} pixels, first at y=${r.top}`}`); }
}
console.log(differ ? `${differ} screen(s) differ — compare tests/visual/base and tests/visual/now` : 'All screens identical to the baseline');
await browser.close();
process.exit(differ ? 1 : 0);
