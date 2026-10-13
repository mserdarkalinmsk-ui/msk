// Smoke + rule tests: node tests/academy.cjs (after python3 build.py)
const { chromium } = require(process.env.PLAYWRIGHT || "/opt/node22/lib/node_modules/playwright");
const path = require("path"), assert = require("assert");
const F = "file://" + path.resolve(__dirname, "../dist/financial-guide-academy.html");
(async () => {
  const b = await chromium.launch(), errs = [];
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(F + "#/");
  const r = await p.evaluate(() => [[2000, 0], [2001, 0], [6000, 1], [6001, 1], [183999, 0], [184000, 0]].map(([v, i]) => FGA.routeOf(v, !!i, false).k));
  assert.deepStrictEqual(r, ["direct", "comp", "direct", "comp", "comp", "intl"], "procurement thresholds");
  assert.strictEqual(await p.evaluate(() => FGA.routeOf(60000, false, true).extra.some((x) => /DLAPIL/.test(x))), true, "DLAPIL review for XB");
  assert.strictEqual(await p.evaluate(() => FGA.QUESTIONS.every((q) => FGA.LESSONS.some((l) => l.key === q.topic))), true, "every question maps to a lesson");
  for (const h of ["", "tour", "learn", "learn/procurement", "learn/grants/foundations", "learn/brief/year-end", "practice", "check", "tools", "tools/route", "stuck", "glossary"]) {
    await p.goto(F + "#/" + h); await p.waitForSelector(".view");
    assert.ok(!(await p.textContent("#view")).includes("does not exist"), "route renders: " + h);
  }
  // wrong answer → review list → home shows it
  await p.goto(F + "#/learn/procurement/foundations"); await p.waitForSelector(".quiz .opt");
  await p.click('.quiz .opt[data-o="0"]');
  await p.goto(F + "#/"); await p.waitForSelector(".review");
  // mobile: no horizontal overflow
  const m = await b.newPage({ viewport: { width: 375, height: 800 } });
  for (const h of ["", "learn/procurement/foundations", "tools/route", "check"]) { await m.goto(F + "#/" + h); await m.waitForTimeout(150); assert.ok((await m.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0, "no overflow: " + h); }
  assert.deepStrictEqual(errs, []);
  console.log("academy tests passed"); await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
