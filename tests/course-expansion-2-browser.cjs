// Mobile prep, routed live round and on-demand download checks. No live Google imagery certification.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {server,chromium,state,ready}=require('./course-prep-browser.cjs');
const ids=['hudson-hills','beekman','ballys-ferry-point','saxon-woods','van-cortlandt'];
const setMode=(p,m)=>p.evaluate(m=>document.querySelector(`.cp-modes [data-mode="${m}"]`)?.click(),m);
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/';
 const browser=await chromium.launch({headless:true,executablePath:process.env.CADDIE_CHROMIUM||(fs.existsSync('/tmp/chromium')?'/tmp/chromium':undefined),args:['--no-sandbox']});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),p=await context.newPage(),errors=[],requests=[];p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(r.url().includes('/packs/'))requests.push(r.url());});
  await p.route(/https:\/\/(casinos\.ballys\.com\/golf-links-ferry-point\/files\/|golf\.westchestercountyny\.gov\/wp-content\/uploads\/|beekmangolf\.com\/wp-content\/uploads\/)/,r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="700" height="1000"><rect width="700" height="1000" fill="#d7dac8"/></svg>'}));
  await p.goto(url);await ready(p);const baseline=await state(p);
  assert.ok(!requests.some(r=>ids.some(id=>r.includes(id+'.json'))),'new courses do not auto-download');
  await p.locator('#nav [data-view="rounds"]').click();await p.locator('[data-action="open-course-prep"]').first().click();
  for(const id of ids){
   await p.locator('#cp-courses').selectOption(id);await p.waitForFunction(id=>CaddieCoursePrep.courseId===id&&CaddieCoursePacks.ready(id),id);await p.locator('.cp-modes').waitFor();
   assert.equal(await p.locator('.cp-holes button').count(),id==='beekman'?9:18);assert.equal(await p.locator('.cp-plan-table button').count(),id==='beekman'?27:18);
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no mobile overflow '+id);
   await setMode(p,'guide');await p.locator('.cp-hole-art,.cp-guide[data-guide-state="ready"]').first().waitFor();await setMode(p,'map');await p.locator('#cp-route-map').waitFor();
   const status=await p.evaluate(id=>CaddieCoursePacks.status(id),id);assert.ok(status.available&&status.current&&!status.favorite,id+' is cached on demand without favoriting');
  }
  await p.locator('#cp-courses').selectOption('beekman');await p.waitForFunction(()=>CaddieCoursePrep.courseId==='beekman'&&CaddieCoursePacks.ready('beekman'));await p.locator('.cp-modes').waitFor();
  for(const n of [4,13]){
   if(n===13){await p.evaluate(()=>document.querySelector('.cp-nines [data-n="10"]').click());await p.waitForFunction(()=>document.querySelector('.cp-holes [data-n="13"]'));}
   await p.evaluate(n=>document.querySelector(`.cp-holes [data-n="${n}"]`).click(),n);await p.waitForFunction(n=>document.querySelector('.cp-hole-heading')?.textContent.includes(`Hole ${n}`),n);
   await setMode(p,'map');await p.locator('#cp-map-stage').waitFor();assert.match(await p.locator('#cp-map-stage').innerText(),/Map under review/);assert.equal(await p.locator('#cp-route-map').count(),0);assert.ok(await p.locator('[data-mode="guide"]').count());
  }
  for(const k of ['rounds','carries','clubs','coursePrep','planCalls'])assert.deepEqual((await state(p))[k],baseline[k],'browsing preserves '+k);
  await context.setOffline(true);for(const id of ids){await p.locator('#cp-courses').selectOption(id);await p.waitForFunction(id=>CaddieCoursePrep.courseId===id&&CaddieCoursePacks.ready(id),id);const n=id==='beekman'?5:10;await p.locator(`.cp-holes [data-n="${n}"]`).click({force:true});await setMode(p,'map');await p.locator('#cp-route-map').waitFor();}await context.setOffline(false);
  await p.locator('#nav [data-view="home"]').click();await p.locator('[data-action="live-new"]').first().click();await p.locator('#lvCourse').fill('Beekman Golf Course');await p.locator('#lvCourse').dispatchEvent('input');
  await p.locator('#lvRouting').selectOption('valley-highland');await p.locator('[data-action="live-start"]').click();
  const routed=await p.evaluate(()=>JSON.parse(localStorage.caddiehq_v1).live);assert.equal(routed.routingId,'valley-highland');assert.deepEqual(routed.holes.map(h=>h.n),[10,11,12,13,14,15,16,17,18,1,2,3,4,5,6,7,8,9]);
  await p.locator('[data-action="live-card-play"]').click();await p.locator('[data-action="live-goto"][data-i="8"]').click();assert.match(await p.locator('.lvhn').innerText(),/Hole 18/);await p.locator('[data-action="live-goto"][data-i="9"]').click();assert.match(await p.locator('.lvhn').innerText(),/Hole 1/);
  assert.deepEqual(errors,[]);console.log('PASS expansion 2 browser: mobile prep, five on-demand/offline packs, explicit Beekman map gaps and Valley→Highland live routing.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
