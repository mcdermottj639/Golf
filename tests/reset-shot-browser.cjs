'use strict';
const assert=require('node:assert/strict');
const {server,chromium,state,ready,googleMock}=require('./course-prep-browser.cjs');
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:'/tmp/chromium',args:['--no-sandbox']});
 try{
  const p=await browser.newPage({viewport:{width:393,height:852},serviceWorkers:'block'});
  await p.route('https://maps.googleapis.com/maps/api/js*',r=>r.fulfill({contentType:'text/javascript',body:'('+googleMock.toString()+')()'}));
  await p.goto('http://127.0.0.1:'+server.address().port);await ready(p);
  await p.evaluate(()=>{localStorage.setItem('caddiehq_google_maps_key_v1','AIza'+'x'.repeat(35));const b=document.createElement('button');b.dataset.action='open-course-prep';b.dataset.course='sterling-farms';b.dataset.n=2;document.body.append(b);b.click();b.remove();});
  await p.locator('[data-cp=mode][data-mode=map]').click();await p.locator('qa-map-scene').waitFor();
  for(const live of [false,true]){
   if(live){await p.evaluate(()=>CaddieCoursePrep.openLiveMap('sterling-farms',2));await p.locator('#cp-live-map qa-map-scene').waitFor();}
   const root=p.locator(live?'#cp-live-map':'#course-prep');
   const choice=await root.locator('#cp-map-club').inputValue();
   const before=await state(p);
   const aim=await p.evaluate(()=>CaddieCoursePrep.findCourse('sterling-farms').holes[1].path[1]);
   await root.locator('qa-map-scene').evaluate((el,aim)=>{const e=new Event('gmp-click');e.position={lat:aim[0],lng:aim[1]};el.dispatchEvent(e);},aim);
   assert.equal(await root.locator('#cp-map-club').count(),0);
   const reset=root.locator('[data-cp=restart-shot]');assert.ok(await reset.isVisible());
   const rect=await reset.boundingBox();assert.equal(rect.width,44);assert.equal(rect.height,44);
   await reset.click();await root.locator('#cp-map-club').waitFor();
   assert.equal(await root.locator('#cp-map-club').inputValue(),choice);
   assert.equal(await root.locator('[data-cp=restart-shot]').count(),0);
   assert.equal(await root.locator('qa-map-marker').evaluateAll(ms=>ms.filter(m=>m.label.endsWith(' yd carry')).length),1);
   const after=await state(p);assert.deepEqual(after.planCalls,before.planCalls);assert.deepEqual(after.rounds,before.rounds);
   const plan=after.coursePrep['sterling-farms'];assert.ok(!plan.holes[plan.tee+':2'].target);
   await p.waitForFunction(()=>{const scene=document.querySelector('#cp-live-map qa-map-scene')||document.querySelector('qa-map-scene');return !!scene.lastFlight;});
   console.log('PASS target → reset icon → same club and landing restored:',live?'live popup':'prep');
  }
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1)});
