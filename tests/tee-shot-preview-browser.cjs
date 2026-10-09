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
  assert.ok(projection.rings>=3,'route, tee line and carry ring exist');
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
  assert.equal(await p.locator('qa-map-marker').count(),3,'only tee, green and club landing pins appear despite a saved target');
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
  assert.deepEqual(errors,[]);
  console.log('PASS par 4/5 tee suggestions, carry projection, manual choices/targets, camera reset, par 3 cleanup, offline preview and mobile layouts');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
