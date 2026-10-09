'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {server,chromium,state,ready,mode,googleMock}=require('./course-prep-browser.cjs');
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CADDIE_CHROMIUM||(fs.existsSync('/tmp/chromium')?'/tmp/chromium':undefined),args:['--no-sandbox']});
 try{
  const p=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(12000);
  await p.route('https://maps.googleapis.com/maps/api/js*',r=>r.fulfill({contentType:'text/javascript',body:'('+googleMock.toString()+')()'}));
  await p.goto('http://127.0.0.1:'+server.address().port);await ready(p);
  await p.evaluate(()=>localStorage.setItem('caddiehq_google_maps_key_v1','AIza'+'x'.repeat(35)));
  const open=async(id,n=1)=>{
   await p.evaluate(({id,n})=>{const b=document.createElement('button');b.dataset.action='open-course-prep';b.dataset.course=id;b.dataset.n=n;document.body.append(b);b.click();b.remove();},{id,n});
   await mode(p,'3d');await p.locator('qa-map-scene').waitFor();
  };
  const baseline=await state(p);
  await open('sterling-farms',2);
  assert.ok(await p.locator('#cp-tee-preview').isVisible(),'par 5 starts with a tee club');
  assert.deepEqual(await p.locator('qa-map-marker').evaluateAll(ms=>ms.map(m=>({kind:m.dataset.iconKind,custom:!!m.querySelector('template')?.content.querySelector('svg')}))),[
   {kind:'tee',custom:true},{kind:'green',custom:true},{kind:'target',custom:false}
  ],'tee and flag use SVG icons; landing retains default red pin');
  assert.equal(await p.evaluate(()=>mapQA.markerImports),0,'icons need no optional marker library');

  for(const width of [320,390,1440]){
   await p.setViewportSize({width,height:844});
   assert.equal(await p.locator('#cp-header-camera button').count(),4);
   assert.ok(await p.evaluate(()=>document.querySelector('#cp-header-camera').getBoundingClientRect().bottom<document.querySelector('#cp-map-stage').getBoundingClientRect().top),'camera controls above map');
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'header fits '+width);
   await p.screenshot({path:'/tmp/map-header-'+width+'.png'});
  }
  await p.setViewportSize({width:390,height:844});
  assert.equal(await p.locator('[data-cp="frame"][data-focus="tee"]').count(),0);
  assert.equal(await p.locator('#cp-map-controls [data-cp="stop"]').count(),1);
  const projection=await p.evaluate(()=>{
   const geo=CaddieCoursePrep.geo,markers=Array.from(document.querySelectorAll('qa-map-marker'));
   const start=markers[0].position,landing=markers.find(m=>m.label.endsWith(' yd carry'));
   return {yards:geo.distance([start.lat,start.lng],[landing.position.lat,landing.position.lng]),label:landing.label,choice:document.querySelector('#cp-map-club').selectedOptions[0].textContent,rings:document.querySelectorAll('qa-map-line').length};
  });
  assert.ok(Math.abs(projection.yards-Number(projection.label.match(/(\d+) yd/)[1]))<.51,'projected straight-line distance equals carry');
  assert.equal(projection.rings,2,'only shot line and carry ring exist; no reference-route line');
  assert.deepEqual(await state(p),baseline,'opening suggestions does not save a club or target');
  const beforeCamera=await p.locator('qa-map-scene').evaluate(e=>e.lastFlight);
  const choices=await p.locator('#cp-map-club option').evaluateAll(es=>es.map(e=>e.value));
  await p.locator('#cp-map-club').selectOption(choices.at(-1));await p.locator('qa-map-scene').waitFor();
  assert.equal(await p.locator('#cp-map-club').inputValue(),choices.at(-1));
  assert.deepEqual(await p.locator('qa-map-scene').evaluate(e=>e.lastFlight),beforeCamera,'club change preserves camera');
  const afterChoice=await state(p);assert.notDeepEqual(afterChoice.planCalls,baseline.planCalls,'explicit change saves only user choice');
  assert.deepEqual(afterChoice.coursePrep,baseline.coursePrep,'changing club does not create a target');
  await p.locator('[data-cp="reset-view"]').click();
  await p.waitForFunction(()=>{
   const scene=document.querySelector('qa-map-scene'),m=Array.from(document.querySelectorAll('qa-map-marker')),tee=m[0].position,landing=m.find(x=>x.label.endsWith(' yd carry')).position;
   return Math.abs(scene.lastFlight.endCamera.heading-CaddieCoursePrep.geo.bearing([tee.lat,tee.lng],[landing.lat,landing.lng]))<.00001;
  });
  await p.locator('qa-map-scene').evaluate(el=>el.dispatchEvent(new CustomEvent('gmp-click',{detail:null}))); // no position: no write
  const aim=await p.evaluate(()=>CaddieCoursePrep.findCourse('sterling-farms').holes[1].path[1]);
  await p.locator('qa-map-scene').evaluate((el,aim)=>{const e=new Event('gmp-click');e.position={lat:aim[0],lng:aim[1]};el.dispatchEvent(e);},aim);
  assert.equal(await p.locator('qa-map-marker').count(),3,'tap replaces club landing with one target pin');
  assert.equal(await p.locator('qa-map-marker').evaluateAll(ms=>ms.filter(m=>m.label.endsWith(' yd carry')).length),0,'no club landing pin after a tap');
  const tapped=await p.locator('qa-map-marker').nth(2).evaluate(m=>({lat:m.position.lat,lng:m.position.lng,label:m.label}));
  assert.ok(Math.abs(tapped.lat-aim[0])<.000001 && Math.abs(tapped.lng-aim[1])<.000001,'red pin is at tapped location');
  assert.match(tapped.label,/yd · .*yd left/);
  assert.match(await p.locator('.cp-map-summary').innerText(),/to your target[\s\S]*left to green/);
  await mode(p,'route');
  assert.equal(await p.locator('[data-point="target"]').count(),1);
  assert.equal(await p.locator('[data-point="landing"]').count(),0);
  await p.locator('[data-cp="reset-view"]').click();
  assert.equal(await p.locator('[data-point="target"]').count(),1,'reset camera keeps tapped target');
  const saved=await state(p);
  await open('wianno',2);assert.ok(await p.locator('#cp-tee-preview').isVisible(),'par 4 gets preview');
  const par3=await p.evaluate(()=>CaddieCoursePrep.findCourse('wianno').holes.find(h=>h.par===3).n);
  await open('wianno',par3);assert.ok(await p.locator('#cp-tee-preview').isHidden(),'no automatic tee preview on par 3');
  assert.equal(await p.locator('qa-map-marker').count(),2,'no previous landing pin on par 3');
  await open('sterling-farms',2);assert.equal(await p.locator('#cp-map-club').inputValue(),choices.at(-1),'saved club takes priority');
  await mode(p,'route');assert.equal(await p.locator('[data-point="landing"]').count(),1);assert.equal(await p.locator('[data-point="target"]').count(),0);
  for(const width of [320,390,1440]){
   await p.setViewportSize({width,height:844});
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow at '+width);
   await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:'/tmp/tee-preview-'+width+'.png'});
  }
  await p.context().setOffline(true);await p.locator('.cp-arrows [data-cp="next"]').click();await p.locator('#cp-route-map').waitFor();
  assert.ok(await p.locator('#cp-tee-preview').isVisible(),'downloaded map preview works offline');
  assert.deepEqual(await state(p),saved,'browsing, reset and offline preview preserve saved state');
  await p.context().setOffline(false);
  await open('sterling-farms',4);
  const customTee=await p.evaluate(()=>{
   const h=CaddieCoursePrep.findCourse('sterling-farms').holes[3];
   return CaddieCoursePrep.geo.destination(h.path[0],15,90);
  });
  await p.locator('[data-cp="edit"][data-kind="tee"]').click();
  await p.locator('qa-map-scene').evaluate((el,point)=>{const e=new Event('gmp-click');e.position={lat:point[0],lng:point[1]};el.dispatchEvent(e);},customTee);
  const shot=await p.locator('qa-map-line').evaluateAll(ls=>ls.filter(l=>l.strokeWidth===4).map(l=>l.path));
  assert.equal(shot.length,1,'custom tee has one shot line, no original green route');
  assert.equal(shot[0].length,2,'preview line joins only tee and landing');
  assert.ok(Math.abs(shot[0][0].lat-customTee[0])<.000001 && Math.abs(shot[0][0].lng-customTee[1])<.000001,'line begins at custom tee');
  await p.locator('[data-cp="rings"]').click();
  assert.equal(await p.locator('qa-map-line').count(),1,'hiding rings leaves only the active shot line');
  await p.locator('[data-cp="edit"][data-kind="target"]').click();
  await p.locator('qa-map-scene').evaluate((el,point)=>{const e=new Event('gmp-click');e.position={lat:point[0],lng:point[1]};el.dispatchEvent(e);},customTee);
  assert.equal(await p.locator('qa-map-line').count(),1,'target tap replaces rather than accumulates shot lines');
  assert.match(await p.locator('.cp-map-summary').innerText(),/to your target/);
  assert.deepEqual(errors,[]);
  console.log('PASS par 4/5 tee suggestions, carry projection, manual choices/targets, camera reset, par 3 cleanup, offline preview and mobile layouts');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
