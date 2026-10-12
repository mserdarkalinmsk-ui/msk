const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});const p=await b.newPage({viewport:{width:1360,height:800}});
for(const h of ['a','b']){await p.goto('file://'+__dirname+'/mock.html#'+h);await p.reload();await p.waitForTimeout(1200);await p.screenshot({path:__dirname+'/option-'+h+'.png',fullPage:true});}await b.close();})();
