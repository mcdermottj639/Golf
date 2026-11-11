// Mobile prep, Quail Village partial maps, live-round boundaries and on-demand downloads.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {server,chromium,state,ready}=require('./course-prep-browser.cjs');
const ids=['quail-brook','middletown-country-club','broad-run','old-corkscrew','quail-village'];
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/';
 const browser=await chromium.launch({headless:true,executablePath:process.env.CADDIE_CHROMIUM||(fs.existsSync('/tmp/chromium')?'/tmp/chromium':undefined),args:['--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),p=await context.newPage(),errors=[],requests=[];
  p.setDefaultTimeout(20000);p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(r.url().includes('/packs/'))requests.push(r.url());});
  await p.goto(url);await ready(p);const baseline=await state(p);assert.ok(!requests.some(r=>ids.some(id=>r.includes(id+'.json'))),'new courses do not auto-download');
  await p.locator('#nav [data-view="rounds"]').click();await p.locator('[data-action="open-course-prep"]').first().click();
  for(const id of ids){
   await p.locator('#cp-courses').selectOption(id);await p.waitForFunction(id=>CaddieCoursePrep.courseId===id&&CaddieCoursePacks.ready(id),id);
   assert.equal(await p.locator('.cp-holes button').count(),18);assert.equal(await p.locator('.cp-plan-table button').count(),18);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no mobile overflow '+id);
   if(id==='quail-village'){await p.locator('.cp-holes button').nth(13).click();await p.locator('.cp-map-message h3').waitFor();assert.match(await p.locator('.cp-map-message h3').innerText(),/Map under review/);assert.equal(await p.locator('#cp-route-map').count(),0);}
   else{await p.locator('#cp-route-map').waitFor();await p.locator('.cp-modes [data-mode="guide"]').click();await p.locator('.cp-guide[data-guide-state="ready"]').waitFor();}
   const status=await p.evaluate(id=>CaddieCoursePacks.status(id),id);assert.ok(status.available&&status.current&&!status.favorite,id+' is cached on demand without favoriting');
  }
  for(const k of ['rounds','carries','clubs','coursePrep','planCalls'])assert.deepEqual((await state(p))[k],baseline[k],'browsing preserves '+k);
  await p.locator('#nav [data-view="home"]').click();await p.locator('[data-action="live-new"]').first().click();await p.locator('#lvCourse').fill('Broad Run Golf Club');await p.locator('#lvCourse').dispatchEvent('input');await p.locator('[data-action="live-start"]').click();
  let live=await p.evaluate(()=>JSON.parse(localStorage.caddiehq_v1).live);assert.deepEqual(live.holes.map(h=>h.n),Array.from({length:18},(_,i)=>i+1));
  await p.locator('[data-action="live-card-play"]').click();await p.locator('[data-action="live-goto"][data-i="8"]').click();assert.match(await p.locator('.lvhn').innerText(),/Hole 9/);await p.locator('[data-action="live-goto"][data-i="9"]').click();assert.match(await p.locator('.lvhn').innerText(),/Hole 10/);
  await p.locator('[data-action="live-exit"]').click();await p.locator('[data-action="live-new"]').first().click();await p.locator('#lvCourse').fill('Quail Village Golf Course');await p.locator('#lvCourse').dispatchEvent('input');await p.locator('[data-action="live-start"]').click();
  await p.locator('[data-action="live-card-play"]').click();await p.locator('[data-action="live-goto"][data-i="13"]').click();live=await p.evaluate(()=>JSON.parse(localStorage.caddiehq_v1).live);assert.equal(live.course,'Quail Village Golf Course');assert.equal(await p.locator('[data-action="live-hole-map"]').count(),0);assert.match(await p.locator('.cp-live-guides').innerText(),/Hole map under review/);
  assert.deepEqual(errors,[]);console.log('PASS expansion 5 browser: mobile on-demand packs, Quail Village map gaps and 9→10 live-round boundaries.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
