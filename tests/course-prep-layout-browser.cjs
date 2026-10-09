'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {server,chromium,state,ready,mode,googleMock}=require('./course-prep-browser.cjs');
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CADDIE_CHROMIUM||(fs.existsSync('/tmp/chromium')?'/tmp/chromium':undefined),args:['--no-sandbox']});
 try{
  const p=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(15000);
  const fixture='<svg xmlns="http://www.w3.org/2000/svg" width="750" height="1107"><rect width="750" height="1107" fill="#b9b7a6"/><circle cx="375" cy="110" r="80" fill="green"/><rect x="300" y="900" width="150" height="100" fill="green"/></svg>';
  await p.route(/https:\/\/(www\.poundridgegolf\.com\/images|cdn\.cybergolf\.com\/images|tours\.skyfoxgolf\.com\/storage\/aerials)\//,r=>{
   const real=process.env.CADDIE_LAYOUT_IMAGE&&r.request().url().includes('metedeconk/hole2_aerial.png');
   return r.fulfill({contentType:real?'image/png':'image/svg+xml',body:real?fs.readFileSync(process.env.CADDIE_LAYOUT_IMAGE):fixture});
  });
  await p.route('https://maps.googleapis.com/maps/api/js*',r=>r.fulfill({contentType:'text/javascript',body:'('+googleMock.toString()+')()'}));
  await p.goto('http://127.0.0.1:'+server.address().port);await ready(p);
  await p.evaluate(()=>localStorage.setItem('caddiehq_google_maps_key_v1','AIza'+'x'.repeat(35)));
  // Include iPhone standalone safe areas, which desktop Chromium does not provide.
  await p.addStyleTag({content:'@media(max-width:760px){body.cpfocus .hero.hq-shell{padding-top:63px!important}#nav{padding-bottom:44px!important}}'});
  const baseline=await state(p);
  for(const width of [320,390,1440]){
   await p.setViewportSize({width,height:width===320?740:width===390?844:1000});
   await p.locator('#nav [data-view="rounds"]').click();await p.locator('[data-action="open-course-prep"]').first().click();
   await p.locator('.cp-guide[data-guide-state="ready"] img').waitFor();
   const layout=await p.evaluate(()=>{
    const box=s=>{const b=document.querySelector(s).getBoundingClientRect();return {top:b.top,bottom:b.bottom};};
    return {scroll:scrollY,width:innerWidth,content:document.documentElement.scrollWidth,height:innerHeight,art:box('.cp-guide-viewport'),map:box('.cp-map-panel'),settings:box('.cp-course-settings'),holes:box('.cp-hole-browser'),downloads:box('.cp-downloads'),nav:box('#nav')};
   });
   await p.screenshot({path:'/tmp/caddie-prep-first-'+width+'.png'});
   assert.ok(layout.art.bottom<=Math.min(layout.height,width<761?layout.nav.top:layout.height)-7,'entire guide stays above navigation at '+width);
   assert.equal(layout.scroll,0,'opening prep stays at the top');
   assert.ok(layout.content<=width+1,'no page overflow at '+width);
   assert.ok(layout.art.top<layout.height*.5,'artwork starts in the first half of the viewport at '+width);
   if(width<761){assert.ok(layout.nav.top-layout.art.top>240,'substantial guide visible without scrolling');assert.ok(layout.settings.top>=layout.map.bottom);}
   assert.ok(layout.holes.top>=layout.map.bottom);assert.ok(layout.downloads.top>layout.map.bottom);
   assert.equal(await p.locator('#cp-downloads').getAttribute('open'),null);
   assert.equal(await p.locator('.cp-guide-zoom output').textContent(),'100%');
   await mode(p,'3d');await p.locator('qa-map-scene').waitFor();
   await p.screenshot({path:'/tmp/header-layout-'+width+'.png'});
   assert.ok(await p.locator('#cp-map-stage').evaluate(e=>e.getBoundingClientRect().top<innerHeight*.5),'interactive map is also visible immediately');
   assert.ok(await p.locator('#cp-map-stage').evaluate(e=>{
    const nav=document.querySelector('#nav').getBoundingClientRect(),bottom=nav.width>innerWidth*.7?nav.top:innerHeight;
    return e.getBoundingClientRect().bottom<=bottom-7;
   }),'entire interactive map stays above navigation');
   if(width===390){
    const before=await p.locator('qa-map-scene').evaluate(e=>e.lastFlight);
    await p.setViewportSize({width,height:700});
    await p.waitForFunction(()=>document.querySelector('#cp-map-stage').getBoundingClientRect().bottom<=document.querySelector('#nav').getBoundingClientRect().top-7);
    assert.deepEqual(await p.locator('qa-map-scene').evaluate(e=>e.lastFlight),before,'resizing keeps the camera position');
    const height=await p.locator('#cp-map-stage').evaluate(e=>e.clientHeight);
    await p.evaluate(()=>scrollTo(0,150));
    assert.equal(await p.locator('#cp-map-stage').evaluate(e=>e.clientHeight),height,'scrolling preserves map size');
    await p.evaluate(()=>scrollTo(0,0));
    await p.setViewportSize({width,height:844});
   }
   await p.evaluate(()=>{document.querySelector('qa-map-scene').range=50;});
   await p.locator('[data-cp="reset-view"]').click();
   await p.waitForFunction(()=>document.querySelector('qa-map-scene').lastFlight?.endCamera.range>50);
   assert.equal(await p.locator('#cp-map-stage').evaluate(e=>e.dispatchEvent(new MouseEvent('dblclick',{bubbles:true,cancelable:true}))),false,'double click map event is suppressed');
   await p.locator('.cp-arrows [data-cp="next"]').click();await p.locator('qa-map-scene').waitFor();
   assert.match(await p.locator('.cp-hole-heading h3').innerText(),/^Hole 2/);
   assert.equal(await p.locator('.cp-map-views [data-mode="3d"]').getAttribute('aria-pressed'),'true');
   await p.locator('.cp-arrows [data-cp="previous"]').click();await p.locator('qa-map-scene').waitFor();
   await mode(p,'route');await p.locator('.cp-holes [data-n="9"]').click();await p.locator('#cp-route-map').waitFor();
   assert.match(await p.locator('.cp-hole-heading h3').innerText(),/^Hole 9/);
   assert.ok(await p.locator('.cp-map-panel').evaluate(e=>e.getBoundingClientRect().top<100),'hole grid returns to map');
   await p.locator('.cp-arrows [data-cp="next"]').click();await p.locator('#cp-route-map').waitFor();
   assert.match(await p.locator('.cp-hole-heading h3').innerText(),/^Hole 10/);
   await mode(p,'guide');await p.locator('.cp-guide[data-guide-state="ready"] img').waitFor();
   await p.locator('[data-guide-zoom="in"]').click();await p.locator('.cp-arrows [data-cp="next"]').click();
   await p.locator('.cp-guide[data-guide-state="ready"] img').waitFor();assert.equal(await p.locator('.cp-guide-zoom output').textContent(),'100%');
  }
  await p.setViewportSize({width:390,height:844});
  await p.locator('#cp-courses').selectOption('metedeconk');await p.locator('.cp-guide[data-guide-state="ready"] img').waitFor();
  await p.locator('.cp-arrows [data-cp="next"]').click();await p.locator('.cp-guide[data-guide-state="ready"] img').waitFor();await p.evaluate(()=>scrollTo(0,0));
  await p.screenshot({path:'/tmp/caddie-prep-metedeconk-full.png'});
  await mode(p,'3d');await p.locator('qa-map-scene').waitFor();
  await p.locator('.cp-nines [data-n="10"]').click();await p.locator('qa-map-scene').waitFor();
  assert.match(await p.locator('.cp-hole-heading h3').innerText(),/^Hole 10/);
  await p.locator('.cp-holes [data-n="18"]').click();await p.locator('qa-map-scene').waitFor();
  await p.locator('.cp-arrows [data-cp="next"]').click();
  assert.match(await p.locator('.cp-hole-heading h3').innerText(),/^Hole 19/);
  assert.match(await p.locator('#cp-map-stage').innerText(),/Map under review/);
  assert.equal(await p.locator('.cp-modes [data-mode="map"]').getAttribute('aria-pressed'),'true');
  await p.locator('.cp-arrows [data-cp="previous"]').click();await p.locator('qa-map-scene').waitFor();
  await p.locator('#cp-round-plan summary').click();await p.locator('.cp-plan-table [data-n="2"]').click();await p.locator('qa-map-scene').waitFor();
  await p.locator('#cp-courses').selectOption('wianno');await p.locator('.cp-hole-art').waitFor();assert.equal(await p.locator('.cp-guide-zoom output').textContent(),'100%');
  await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:'/tmp/caddie-prep-wianno-full.png'});
  await mode(p,'3d');await p.locator('qa-map-scene').waitFor();await p.locator('.cp-arrows [data-cp="next"]').click();await p.locator('qa-map-scene').waitFor();
  await p.locator('#cp-downloads summary').click();await p.locator('[data-cp="download"]').waitFor();await p.locator('#cp-downloads summary').click();
  assert.deepEqual(await state(p),baseline,'layout, guide controls and hole/view navigation preserve all golf state');assert.deepEqual(errors,[]);
  console.log('PASS first-screen maps at 320/390/1440, full guides, retained 3D/simple views across arrows/holes/nines, unavailable hole coverage and unchanged golf state.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
