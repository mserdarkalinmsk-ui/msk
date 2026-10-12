const {chromium}=require('/opt/node22/lib/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});const p=await b.newPage({viewport:{width:1300,height:900}});
await p.goto('file://'+__dirname+'/index.html');await p.addStyleTag({content:'.grid{grid-template-columns:repeat(2,1fr)!important}'});await p.waitForTimeout(500);await p.screenshot({path:__dirname+'/all-options.png',fullPage:true});await b.close()})();
