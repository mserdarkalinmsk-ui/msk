import { chromium } from 'playwright-core';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}); const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
await pg.goto('file:///home/user/msk/portfolio-ledger-next.html?today=2026-10-11&demo'); await pg.waitForTimeout(1200);
await pg.getByRole('link',{name:'Map'}).click(); await pg.waitForTimeout(1500);
await pg.screenshot({path:process.argv[2]}); await b.close();
