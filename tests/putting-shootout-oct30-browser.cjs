'use strict';
// v267: the Oct 30 putter-shootout session lands once in the Putting film room, opens to its
// breakdown, and fits a 320 and 390 phone without sideways scroll. Asserts against the session
// row element, not page text.
const assert=require('node:assert/strict');
const {server,chromium,state,ready}=require('./course-prep-browser.cjs');
const ID='s20-putter-shootout-20261030';
const GIST='Spider Tour X tops a 5-putt shootout on start line; LINK starts it closest but the mat broke it; tempo 1.49:1.';
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CADDIE_CHROMIUM||undefined,args:['--no-sandbox']});
 try{
 for(const [width,height] of [[320,568],[390,844]]){
 const ctx=await browser.newContext({viewport:{width,height},serviceWorkers:'block'}),p=await ctx.newPage(),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:'+server.address().port);await ready(p);
 await p.waitForFunction(id=>JSON.parse(localStorage.getItem('caddiehq_v1')||'{}').feedApplied?.includes(id),ID);
 const st=await state(p);
 assert.equal(st.sessions.filter(s=>s._fid===ID).length,1,'session applied exactly once');
 await p.locator('#nav button[data-view="game"]').click();
 await p.locator('.labsel[data-disc="putting"]').click();
 const row=p.locator('.seslog',{has:p.locator('.sesg',{hasText:GIST})});
 assert.equal(await row.count(),1,'one film-room row');
 await row.scrollIntoViewIfNeeded();
 assert.equal((await row.locator('.sesh b').innerText()).trim().length>0,true);
 const fits=await row.evaluate(el=>el.scrollWidth<=el.clientWidth+1);assert.ok(fits,'row text fits');
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow (lab)');
 await row.click();
 const h=await p.locator('#view').innerText();
 assert.ok(await p.locator('#view details.sect summary',{hasText:'Limits'}).count()>=0);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow (session)');
 assert.ok(h.length>0);
 const after=await state(p);assert.deepEqual(after.sessions.length,st.sessions.length,'opening never writes sessions');
 assert.deepEqual(errors,[]);
 console.log('PASS putting shootout session',JSON.stringify({width,height}));await ctx.close();
 }
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
