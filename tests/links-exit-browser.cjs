'use strict';
const assert=require('node:assert/strict');
const {server,chromium,state,ready}=require('./course-prep-browser.cjs');
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CADDIE_CHROMIUM||'/tmp/chromium',args:['--no-sandbox']});
 try{
 for(const [width,height,inset] of [[320,568,0],[390,844,0],[390,844,59]]){
 const ctx=await browser.newContext({viewport:{width,height},serviceWorkers:'block'}),p=await ctx.newPage(),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:'+server.address().port);await ready(p);
 // Chromium reports env(safe-area-inset-top) as zero. Substitute the inset in
 // the actual stylesheet expression to test layout, not native iOS rendering.
 if(inset)await p.evaluate(inset=>{for(const sheet of document.styleSheets)for(const rule of sheet.cssRules){if(rule.selectorText==='body.lk-ingame')rule.style.paddingTop=`calc(${inset}px + 8px)`;}},inset);
 await p.locator('[data-action="open-links"]').first().click();
 await p.locator('#lk-start').click();await p.locator('#lk-game').waitFor({state:'visible'});
 const before=await state(p);
 const b=await p.locator('#lk-quit').boundingBox();assert.ok(b.y>=inset+8,JSON.stringify(b));assert.ok(b.height>=44);assert.ok(b.x>=0&&b.x+b.width<=width);
 assert.equal(await p.locator('#lk-quit').textContent(),'← Back to Caddie HQ');
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
 await p.locator('.lk .dock').scrollIntoViewIfNeeded();
 await p.locator('#lk-quit').click();assert.equal(await p.locator('#view').getAttribute('data-page'),'home');
 assert.equal(await p.evaluate(()=>document.body.classList.contains('lk-ingame')),false);
 assert.ok(await p.locator('#nav').isVisible());assert.deepEqual(await state(p),before,'golf state preserved');
 await p.locator('[data-action="open-links"]').first().click();await p.locator('#lk-start').click();await p.locator('#lk-quit').click();
 assert.deepEqual(await state(p),before);assert.deepEqual(errors,[]);
 console.log('PASS Links exit',JSON.stringify({width,height,inset,button:b}));await ctx.close();
 }
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
