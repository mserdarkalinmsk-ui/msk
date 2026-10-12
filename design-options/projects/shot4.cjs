const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});const p=await b.newPage({viewport:{width:1360,height:800}});
await p.goto('file://'+__dirname+'/layered.html');await p.waitForTimeout(1300);await p.screenshot({path:__dirname+'/option-layered.png',fullPage:true});await b.close();})();
