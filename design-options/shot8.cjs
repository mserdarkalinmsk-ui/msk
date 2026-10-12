const {chromium}=require('/opt/node22/lib/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});const p=await b.newPage({viewport:{width:1440,height:900}});
await p.goto('file://'+__dirname+'/8-futuristic-light.html');await p.waitForTimeout(2200);await p.hover('.hub:nth-child(2)');await p.waitForTimeout(500);await p.screenshot({path:__dirname+'/8-futuristic-light.png'});await b.close()})();
