'use strict';
// v268: Mark as sold on a bench row removes the club from the bench (and every list), keeps
// its carries/history, logs Bag history, and Move back to bench undoes it exactly. Also checks
// the Oct 30 shootout session now leads with the per-putter ranking tiles and a short header.
const assert=require('node:assert/strict');
const {server,chromium,state,ready}=require('./course-prep-browser.cjs');
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CADDIE_CHROMIUM||undefined,args:['--no-sandbox']});
 try{
 for(const [width,height] of [[320,568],[390,844]]){
 const ctx=await browser.newContext({viewport:{width,height},serviceWorkers:'block'}),p=await ctx.newPage(),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:'+server.address().port);await ready(p);
 await p.waitForFunction(()=>JSON.parse(localStorage.getItem('caddiehq_v1')||'{}').feedApplied?.includes('s20-putter-shootout-chart-20261030'));
 const before=await state(p);
 const bench=before.clubs.filter(c=>c.status==='backup');
 assert.ok(bench.length>0,'has a bench');
 const target=bench[0];
 await p.locator('#nav button[data-view="bag"]').click();
 const bf=p.locator('details#bag-bench');
 if(await bf.count() && !(await bf.evaluate(e=>e.open))) await bf.locator('summary').first().click();
 const row=p.locator(`.bench-item[data-club-id="${target.id}"]`);
 await row.scrollIntoViewIfNeeded();
 await row.locator('details.bench-sold > summary').click();
 const btn=row.locator('[data-action="sell-club"]');
 const bb=await btn.boundingBox();assert.ok(bb.height>=44,'44px confirm');
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no sideways scroll (confirm open)');
 await btn.click();
 const mid=await state(p);
 const sold=mid.clubs.find(c=>c.id===target.id);
 assert.equal(sold.status,'sold');assert.ok(sold.soldDate);
 assert.equal(await p.locator(`.bench-item[data-club-id="${target.id}"]`).count(),0,'gone from bench');
 assert.deepEqual(mid.carries,before.carries,'carries untouched');
 assert.deepEqual(mid.rounds,before.rounds,'rounds untouched');
 assert.ok(mid.bagHistory[0].text.startsWith('Sold '+target.name),'history row');
 const list=p.locator('details#bag-sold');assert.equal(await list.count(),1);
 if(!(await list.evaluate(e=>e.open))) await list.locator('summary').click();
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no sideways scroll (sold list)');
 await p.locator(`[data-action="unsell-club"][data-id="${target.id}"]`).click();
 const after=await state(p);
 assert.deepEqual(after.clubs,before.clubs,'undo restores the club exactly');
 assert.deepEqual(after.bagHistory,before.bagHistory,'undo removes its history row');
 // Shootout session layout
 await p.locator('#nav button[data-view="game"]').click();
 await p.locator('.labsel[data-disc="putting"]').click();
 await p.locator('.seslog').filter({hasText:'Spider Tour X tops'}).click();
 const h3=await p.locator('#view .card h3').first().innerText();
 assert.ok(h3.length<120,'short header: '+h3.length);
 const labels=await p.locator('#view .rowgrid .stat .l').allInnerTexts();
 assert.match(labels[0],/#1/);assert.match(labels[1],/#2/);assert.match(labels[2],/#3/);
 const first=await p.locator('#view .rowgrid .stat').first().boundingBox();
 console.log('first tile bottom',Math.round(first.y+first.height),'of',height); if(width>=390) assert.ok(first.y+first.height<height,'ranking tiles above the fold');
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no sideways scroll (session)');
 const viz=p.locator('#view .shoot svg');assert.equal(await viz.count(),1,'shootout chart renders');
 assert.equal(await viz.locator('circle').count(),15,'one dot per putt');
 const vb=await viz.boundingBox();assert.ok(vb.width<=width,'chart fits width');
 const storyLen=(await p.locator('#view .card').first().innerText()).length;console.log('session card chars',storyLen);
 assert.deepEqual(errors,[]);
 console.log('PASS bench sold + shootout layout',JSON.stringify({width,height,club:target.name}));
 if(width===390){await p.screenshot({path:'/tmp/sess390.png'});}
 await ctx.close();
 }
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
