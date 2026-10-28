// Mobile prep, routed live round and on-demand download checks. No live imagery certification.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {server,chromium,state,ready}=require('./course-prep-browser.cjs');
const ids=['granite-links','bass-river','basin-harbor','vermont-national','fox-hollow'];
const setMode=(p,m)=>p.evaluate(m=>document.querySelector(`.cp-modes [data-mode="${m}"]`)?.click(),m);
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/';
 const browser=await chromium.launch({headless:true,executablePath:process.env.CADDIE_CHROMIUM||(fs.existsSync('/tmp/chromium')?'/tmp/chromium':undefined),args:['--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),p=await context.newPage(),errors=[],requests=[];p.setDefaultTimeout(20000);p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(r.url().includes('/packs/'))requests.push(r.url());});
  await p.goto(url);await ready(p);const baseline=await state(p);assert.ok(!requests.some(r=>ids.some(id=>r.includes(id+'.json'))),'new courses do not auto-download');
  await p.locator('#nav [data-view="rounds"]').click();await p.locator('[data-action="open-course-prep"]').first().click();
  for(const id of ids){
   await p.locator('#cp-courses').selectOption(id);await p.waitForFunction(id=>CaddieCoursePrep.courseId===id&&CaddieCoursePacks.ready(id),id);await p.locator('.cp-modes').waitFor();
   assert.equal(await p.locator('.cp-holes button').count(),id==='granite-links'?9:18);assert.equal(await p.locator('.cp-plan-table button').count(),id==='granite-links'?27:18);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no mobile overflow '+id);
   await setMode(p,'guide');await p.locator('.cp-hole-art,.cp-guide[data-guide-state="ready"]').first().waitFor();await setMode(p,'map');await p.locator('#cp-route-map').waitFor();const status=await p.evaluate(id=>CaddieCoursePacks.status(id),id);assert.ok(status.available&&status.current&&!status.favorite,id+' is cached on demand without favoriting');
  }
  for(const k of ['rounds','carries','clubs','coursePrep','planCalls'])assert.deepEqual((await state(p))[k],baseline[k],'browsing preserves '+k);
  await context.setOffline(true);for(const id of ids){await p.locator('#cp-courses').selectOption(id);await p.waitForFunction(id=>CaddieCoursePrep.courseId===id&&CaddieCoursePacks.ready(id),id);await p.locator(`.cp-holes [data-n="${id==='granite-links'?5:10}"]`).click({force:true});await setMode(p,'map');await p.locator('#cp-route-map').waitFor();}await context.setOffline(false);
  await p.locator('#nav [data-view="home"]').click();await p.locator('[data-action="live-new"]').first().click();await p.locator('#lvCourse').fill('Granite Links');await p.locator('#lvCourse').dispatchEvent('input');await p.locator('#lvRouting').selectOption('granite-quincy');await p.locator('[data-action="live-start"]').click();
  const routed=await p.evaluate(()=>JSON.parse(localStorage.caddiehq_v1).live);assert.equal(routed.routingId,'granite-quincy');assert.deepEqual(routed.holes.map(h=>h.n),Array.from({length:18},(_,i)=>i+1));
  await p.locator('[data-action="live-card-play"]').click();await p.locator('[data-action="live-goto"][data-i="8"]').click();assert.match(await p.locator('.lvhn').innerText(),/Hole 9/);await p.locator('[data-action="live-goto"][data-i="9"]').click();assert.match(await p.locator('.lvhn').innerText(),/Hole 10/);
  assert.deepEqual(errors,[]);console.log('PASS expansion 3 browser: mobile prep, five on-demand/offline packs and preserved Granite→Quincy live routing.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
