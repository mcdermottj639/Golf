'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {server,chromium,state,ready,prep,mode,googleMock}=require('./course-prep-browser.cjs');
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CADDIE_CHROMIUM||(fs.existsSync('/tmp/chromium')?'/tmp/chromium':undefined),args:['--no-sandbox']});
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),p=await ctx.newPage(),errors=[];
  p.setDefaultTimeout(12000);p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>localStorage.setItem('caddiehq_google_maps_key_v1','AIza'+'m'.repeat(35)));
  await p.route('https://maps.googleapis.com/maps/api/js*',r=>r.fulfill({contentType:'text/javascript',body:'('+googleMock.toString()+')()'}));
  await p.goto('http://127.0.0.1:'+server.address().port+'/');await ready(p);await prep(p);const baseline=await state(p);
  await p.locator('#cp-courses').selectOption('wianno');await p.locator('.cp-holes [data-n="2"]').click();
  await p.locator('.cp-hole-art').waitFor();assert.match(await p.locator('.cp-hole-art title').textContent(),/hole 2 /);
  for(const width of [320,390]){
   await p.setViewportSize({width,height:844});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  await p.locator('.cp-map-panel').screenshot({path:'/tmp/caddie-v218/wianno-hole2-fixed.png',style:'#nav,.toast{visibility:hidden!important}'});
  await mode(p,'map');await p.locator('qa-map-scene').waitFor();assert.equal(await p.locator('#cp-reference').isVisible(),true);
  const pins=await p.locator('qa-map-marker').evaluateAll(a=>a.map(e=>({label:e.label,position:e.position})));
  assert.equal(pins.length,2);assert.equal(pins[0].label,'Tee');assert.match(pins[1].label,/Green/);
  assert.ok(pins[1].position.lat<41.625,'correct green south of West Bay Road, not neighboring hole 7');
  await mode(p,'guide');await p.evaluate(()=>CaddieCoursePrep.openLiveMap('Wianno Club',2));
  await p.locator('dialog[open] qa-map-scene').waitFor();assert.match(await p.locator('dialog[open]').innerText(),/Hole 2/);
  for(const k of ['rounds','carries','clubs','coursePrep','planCalls'])assert.deepEqual((await state(p))[k],baseline[k]);
  assert.deepEqual(errors,[]);console.log('PASS Wianno hole 2: full mobile guide, correct green pins, live map popup, and preserved golf state. Google lifecycle mocked.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
