const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});const p=await b.newPage({viewport:{width:1300,height:900}});
await p.goto('file://'+__dirname+'/type.html');await p.waitForTimeout(2500);await p.screenshot({path:__dirname+'/typography.png',fullPage:true});await b.close();})();
