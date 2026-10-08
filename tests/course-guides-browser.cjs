// Actual UI coverage for generated artwork and 27-hole routing. External images are fixtures.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {server,chromium,state,ready,prep,explore,mode,googleMock}=require('./course-prep-browser.cjs');
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/';
 const browser=await chromium.launch({headless:true,executablePath:process.env.CADDIE_CHROMIUM||(fs.existsSync('/tmp/chromium')?'/tmp/chromium':undefined),args:['--no-sandbox']});
 const errors=[],screens='/tmp/caddie-v218';fs.mkdirSync(screens,{recursive:true});
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(12000);
  await p.route(/https:\/\/(www\.poundridgegolf\.com\/images\/|cdn\.cybergolf\.com\/images\/|tours\.skyfoxgolf\.com\/storage\/aerials\/)/,r=>{
   if(/hole19_aerial/.test(r.request().url())&&process.env.CADDIE_METE_GUIDE)return r.fulfill({contentType:'image/png',body:fs.readFileSync(process.env.CADDIE_METE_GUIDE)});
   return r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900"><rect width="600" height="900" fill="#ecefdf"/><text x="50" y="450">Official guide image fixture</text></svg>'});
  });
  await p.goto(url);await ready(p);await prep(p);const baseline=await state(p);
  await p.locator('#cp-courses').selectOption('wianno');
  for(const width of [320,390,1440]){
   await p.setViewportSize({width,height:width===1440?1100:844});await p.locator('.cp-hole-art').waitFor();
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow '+width);
   const ends=await p.locator('.cp-hole-art [data-guide-point]').evaluateAll(a=>a.map(e=>e.getBoundingClientRect()));assert.ok(ends[0].y>ends[1].y);
   await p.locator('.cp-map-panel').screenshot({style:'#nav,.toast{visibility:hidden!important}',path:screens+'/wianno-guide-'+width+'.png'});
  }
  await p.setViewportSize({width:390,height:844});
  for(const n of [3,4,8,10,14,18]){await p.locator('.cp-holes [data-n="'+n+'"]').click();await p.locator('.cp-hole-art').waitFor();assert.match(await p.locator('.cp-hole-art title').textContent(),new RegExp('hole '+n+' '));}
  await p.locator('#cp-courses').selectOption('sterling-farms');await p.locator('.cp-guide-styles [data-style="caddie"]').click();await p.locator('.cp-hole-art').waitFor();
  await p.locator('.cp-map-panel').screenshot({style:'#nav,.toast{visibility:hidden!important}',path:screens+'/sterling-guide.png'});
  await p.locator('.cp-holes [data-n="12"]').click();assert.equal(await p.locator('.cp-hole-art').count(),1,'missing club image has generated guide');
  await p.locator('#cp-courses').selectOption('metedeconk');await p.locator('.cp-hole-heading').waitFor();assert.equal(await p.locator('.cp-nines button').count(),3);assert.equal(await p.locator('#cp-tees option').count(),4);
  for(const start of [1,10,19]){
   await p.locator('.cp-nines [data-n="'+start+'"]').click();assert.equal(await p.locator('.cp-holes button').count(),9);
   for(let n=start;n<start+9;n++){await p.locator('.cp-holes [data-n="'+n+'"]').click();await p.locator('.cp-guide[data-guide-state="ready"] img').waitFor();assert.match(await p.locator('.cp-guide img').getAttribute('src'),new RegExp('/hole'+n+'_aerial.png'));}
  }
  await p.locator('.cp-nines [data-n="19"]').click();await p.locator('.cp-guide[data-guide-state="ready"]').waitFor();await p.locator('.cp-map-panel').screenshot({style:'#nav,.toast{visibility:hidden!important}',path:screens+'/metedeconk-hole19.png'});
  await mode(p,'map');assert.match(await p.locator('#cp-map-stage').innerText(),/Map under review/);assert.equal(await p.locator('#cp-reference').isVisible(),false);
  await mode(p,'guide');await p.locator('.cp-guide').waitFor();
  for(const k of ['rounds','carries','clubs','coursePrep','planCalls'])assert.deepEqual((await state(p))[k],baseline[k],'browsing art preserves '+k);
  await p.locator('#cp-note').fill('Third nine plan is for physical hole 19');await p.locator('.cp-clubs [data-club="5-wood"]').click();
  const routes=await p.evaluate(()=>CaddieCoursePrep.findCourse('metedeconk').routings);
  for(const route of routes){
   await explore(p,'[data-action="live-new"]');await p.locator('#lvCourse').fill('Metedeconk National');await p.locator('#lvRouting').selectOption(route.id);
   assert.equal(await p.locator('#lvNine').isVisible(),false);await p.locator('[data-action="live-start"]').click();
   const L=(await state(p)).live;assert.deepEqual(L.holes.map(h=>h.n),route.holes);assert.ok(L.holes.every(h=>!h.parAuto));
   await p.locator('[data-action="live-card-play"]').click();
   for(const index of [0,route.holes.length-1]){
    const n=route.holes[index];await p.locator('[data-action="live-goto"][data-i="'+index+'"]').click();assert.match(await p.locator('.lvhn').innerText(),new RegExp('Hole '+n+'\\b'));
    const before=(await state(p)).live;await p.locator('[data-action="live-hole-guide"]').click();await p.locator('#cp-live-guide .cp-guide[data-guide-state="ready"] img').waitFor();assert.match(await p.locator('#cp-live-guide img').getAttribute('src'),new RegExp('/hole'+n+'_aerial.png'));
    await p.keyboard.press('Escape');assert.deepEqual((await state(p)).live,before,'guide never edits round');
   }
   // Remove only this disposable unfinished test round, never a user's records.
   await p.evaluate(()=>{const s=JSON.parse(localStorage.caddiehq_v1);delete s.live;localStorage.caddiehq_v1=JSON.stringify(s);});await p.reload();await ready(p);
  }
  await explore(p,'[data-action="open-course-prep"][data-course="wianno"]');await p.locator('.cp-art-guide').waitFor();await ctx.setOffline(true);
  await p.locator('.cp-holes [data-n="3"]').click();await p.locator('.cp-art-guide').waitFor();assert.equal(await p.locator('.cp-guide-loading').count(),0,'generated guide has no network loading state');
  assert.deepEqual(errors,[]);console.log('PASS new guides: responsive source-based art, offline rendering, all 27 official images, every 9/18 routing, correct live physical-hole popup, unavailable-map handling and unchanged golf records.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
