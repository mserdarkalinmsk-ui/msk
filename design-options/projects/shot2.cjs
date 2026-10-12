const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});const p=await b.newPage({viewport:{width:1360,height:800}});
for(const h of ['metro','orbit']){await p.goto('file://'+__dirname+'/creative.html#'+h);await p.reload();await p.waitForTimeout(1300);await p.screenshot({path:__dirname+'/option-'+h+'.png',fullPage:true});}await b.close();})();
