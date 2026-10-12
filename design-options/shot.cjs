const {chromium}=require('/opt/node22/lib/node_modules/playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});const p=await b.newPage({viewport:{width:1440,height:900}});
for(const f of fs.readdirSync(__dirname).filter(x=>/^\d-.*\.html$/.test(x))){await p.goto('file://'+__dirname+'/'+f);await p.waitForTimeout(400);await p.screenshot({path:__dirname+'/'+f.replace('.html','.png')});}
await b.close()})();
