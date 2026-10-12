// v249: Google 3.66.8 camera calls settle when MOTION ends and reject on stop. The shared
// mock returns at once, so this suite swaps in that behaviour to check Stop latency,
// the ~9 s green-sweep stop and the safe overhead start/fallback. Mocked, not real imagery.
const assert=require('node:assert/strict');
const {server,chromium,state,ready,googleMock}=require('./course-prep-browser.cjs');
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const url='http://127.0.0.1:'+server.address().port+'/',errors=[];
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
  await ctx.route('https://maps.googleapis.com/maps/api/js*',r=>r.fulfill({contentType:'text/javascript',body:'('+googleMock.toString()+')()'}));
  await ctx.addInitScript(()=>localStorage.setItem('caddiehq_google_maps_key_v1','AIzaTESTKEY0000000000000000000000000'));
  const p=await ctx.newPage();p.setDefaultTimeout(20000);p.on('pageerror',e=>errors.push(e.message));
  await p.goto(url);await ready(p);const before=await state(p);
  await p.locator('#nav [data-view="rounds"]').click();await p.locator('[data-action="open-course-prep"]').first().click();
  await p.locator('[data-cp="mode"][data-mode="map"]').first().click();
  await p.locator('qa-map-scene').waitFor();
  const init=await p.evaluate(()=>{const s=document.querySelector('qa-map-scene');return {tilt:s.tilt,range:s.range,alt:s.center?.altitude};});
  // initial view is the constructor's unless framing changed props; mock framing sets lastFlight only
  assert.equal(init.tilt,0,'starts straight down');assert.equal(init.range,900);
  await p.waitForTimeout(3500);
  // Make the SDK behave like 3.66.8: flights settle when motion ends; stop interrupts.
  await p.evaluate(()=>{const S=customElements.get('qa-map-scene');window.slow={stops:[],orbitEnd:null};
    S.prototype.flyCameraTo=function(o){this.lastFlight=o;mapQA.flights++;return new Promise((res,rej)=>{const t=setTimeout(res,o.durationMillis);this._cur={t,rej};});};
    S.prototype.flyCameraAround=function(o){slow.orbitStart=performance.now();return new Promise((res,rej)=>{const t=setTimeout(()=>{slow.orbitEnd=performance.now();res();},o.durationMillis);this._cur={t,rej};});};
    S.prototype.stopCameraAnimation=async function(){slow.stops.push(performance.now());if(this._cur){clearTimeout(this._cur.t);this._cur.rej(new Error('interrupted'));this._cur=null;}};});
  // Stop during the first leg must act at once
  await p.locator('[data-cp="fly"]').click();await p.waitForTimeout(1200);
  const t0=await p.evaluate(()=>performance.now());
  await p.locator('[data-cp="stop"], [data-cp="stop-fly"], button:has-text("Stop")').first().click();
  await p.waitForFunction(t=>slow.stops.some(s=>s>t),t0,{timeout:1500});
  const lag=await p.evaluate(t=>slow.stops.find(s=>s>t)-t,t0);assert.ok(lag<500,'stop acts in '+Math.round(lag)+' ms');
  // A full tour: sweep must be stopped ~9 s after it starts, not after 36 s
  await p.locator('[data-cp="fly"]').click();
  await p.waitForFunction(()=>slow.orbitStart,null,{timeout:40000});
  const os=await p.evaluate(()=>slow.orbitStart);
  await p.waitForFunction(t=>slow.stops.some(s=>s>t),os,{timeout:14000});
  const swept=await p.evaluate(t=>slow.stops.find(s=>s>t)-t,os);assert.ok(swept>8000&&swept<11500,'sweep stopped after '+Math.round(swept));
  // Fallback when camera fails: safe overhead, not a tilted sea-level camera
  await p.waitForTimeout(6000);
  await p.evaluate(()=>{const S=customElements.get('qa-map-scene');S.prototype.flyCameraTo=()=>Promise.reject(new Error('Simulated renderer failure'));});
  await p.locator('[data-cp="reset-view"]').first().click();await p.waitForTimeout(2000);
  const fb=await p.evaluate(()=>{const s=document.querySelector('qa-map-scene');return {tilt:s.tilt,range:s.range};});
  assert.deepEqual(fb,{tilt:0,range:900});
  assert.deepEqual(await state(p),before);assert.deepEqual(errors,[]);
  console.log('PASS v249: overhead start, Stop in '+Math.round(lag)+' ms during a settling flight, sweep stopped at '+Math.round(swept)+' ms, safe overhead fallback, no state writes, no page errors');
  await browser.close();server.close();
})().catch(e=>{console.error(e);process.exit(1);});
