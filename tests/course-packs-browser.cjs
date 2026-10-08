'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {server,chromium,state,ready}=require('./course-prep-browser.cjs');
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CADDIE_CHROMIUM||(fs.existsSync('/tmp/chromium')?'/tmp/chromium':undefined),args:['--no-sandbox']});
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844}}),p=await ctx.newPage(),errors=[];
  p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(20000);
  await p.goto('http://127.0.0.1:'+server.address().port+'/course-prep-data.js');
  await p.evaluate(async()=>{await caches.open('caddiehq-v220');await caches.open('another-app-cache');});
  await p.goto('http://127.0.0.1:'+server.address().port+'/');await ready(p);
  await p.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await p.waitForFunction(async()=>{const s=await Promise.all(CADDIE_PREP_COURSES.map(c=>CaddieCoursePacks.status(c.id)));return s.every(x=>x.available&&!x.busy);});
  assert.equal(await p.evaluate(()=>CADDIE_PREP_COURSES.some(c=>c.features)),false,'background favorites do not hydrate geometry into startup memory');
  const baseline=await state(p);
  await p.locator('#nav [data-view="rounds"]').click();await p.locator('[data-action="open-course-prep"]').first().click();await p.locator('.cp-hole-heading').waitFor();
  await p.locator('#cp-courses').selectOption('wianno');await p.locator('.cp-hole-art').waitFor();await p.locator('.cp-holes [data-n="2"]').click();
  await p.locator('#cp-note').fill('Keep this Wianno plan');await p.locator('#cp-note').dispatchEvent('input');
  const saved=await state(p);
  for(const width of [320,390,1440]){await p.setViewportSize({width,height:900});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  await p.setViewportSize({width:390,height:844});
  await p.locator('.cp-downloads summary').click();
  await p.screenshot({path:'/tmp/caddie-course-downloads.png',fullPage:false});
  await ctx.setOffline(true);await p.reload();await p.locator('#nav [data-view="rounds"]').click();await p.locator('[data-action="open-course-prep"]').first().click();await p.locator('.cp-hole-heading').waitFor();
  for(const id of ['pound-ridge','wianno','sterling-farms','metedeconk']){
    await p.locator('#cp-courses').selectOption(id);await p.locator('.cp-hole-art').waitFor();
    await p.waitForFunction(()=>document.querySelector('#cp-download-status').textContent.includes('Available offline'));
    await p.locator('.cp-modes [data-cp="mode"][data-mode="map"]').click();await p.locator('#cp-route-map').waitFor();
  }
  await p.locator('#cp-courses').selectOption('wianno');await p.locator('.cp-hole-art').waitFor();await p.locator('.cp-holes [data-n="2"]').click();assert.equal(await p.locator('#cp-note').inputValue(),'Keep this Wianno plan');
  await p.evaluate(()=>CaddieCoursePrep.openLiveMap('wianno',2));await p.locator('dialog[open] #cp-route-map').waitFor();await p.locator('dialog[open] header button').click();
  for(const k of ['rounds','carries','clubs','planCalls'])assert.deepEqual((await state(p))[k],baseline[k]);
  assert.deepEqual((await state(p)).coursePrep,saved.coursePrep);
  await p.evaluate(()=>CaddieCoursePacks.remove('wianno'));await p.reload();await p.locator('#nav [data-view="rounds"]').click();await p.locator('[data-action="open-course-prep"]').first().click();await p.locator('.cp-hole-heading').waitFor();await p.locator('#cp-courses').selectOption('wianno');await p.locator('[data-cp="retry-pack"]').waitFor();await p.waitForFunction(()=>document.querySelector('#cp-download-status').textContent.includes('Not downloaded'));
  await p.locator('.cp-holes [data-n="2"]').click();await p.locator('[data-cp="retry-pack"]').waitFor();assert.equal(await p.locator('#cp-note').inputValue(),'Keep this Wianno plan','saved notes remain accessible without a course download');
  await ctx.setOffline(false);await p.locator('[data-cp="retry-pack"]').click();await p.locator('.cp-hole-art').waitFor();
  await p.locator('.cp-holes [data-n="2"]').click();assert.equal(await p.locator('#cp-note').inputValue(),'Keep this Wianno plan');
  // A service-worker activation must preserve the independent course cache.
  assert.ok(await p.evaluate(async()=>{const keys=await caches.keys();return keys.includes('caddiehq-course-packs-v1')&&keys.includes('another-app-cache')&&!keys.some(k=>k==='caddiehq-v220');}));
  assert.deepEqual(errors,[]);
  console.log('PASS browser: four background favorites, geometry lazy loading, 320/390/1440 layout, real offline reload and simple/live maps, missing-download retry, saved golf data.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
