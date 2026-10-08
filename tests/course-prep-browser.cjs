// Real UI and offline checks. Google is mocked: this does not certify live imagery.
'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
const root=path.join(__dirname,'..'),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
  const route=new URL(req.url,'http://localhost').pathname;
  const file=path.resolve(root,'.'+(route==='/'?'/index.html':route));
  if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
  fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(err?'':data);});
});
const state=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('caddiehq_v1')));
const ready=p=>p.waitForFunction(()=>JSON.parse(localStorage.getItem('caddiehq_v1')||'{}').feedApplied?.includes('pound-ridge-visual-prep-briefing-20261008-v1'));
async function prep(p){await p.locator('#nav [data-view="rounds"]').click();await p.locator('[data-action="open-course-prep"]').first().click();assert.equal(await p.locator('.cp-modes [data-mode="guide"]').getAttribute('aria-pressed'),'true','guide opens first');await mode(p,'route');await p.locator('#cp-route-map').waitFor();}
async function explore(p,selector){await p.locator('.hq-search-trigger:visible').first().click();await p.locator('.hq-explorer-link'+selector).first().click();}
const mode=(p,m)=>p.locator('.cp-modes [data-mode="'+m+'"]').click();
function googleMock(){
  window.mapQA={maps:0,scenes:0,flights:0,stops:0,fits:0,markerImports:0,fail3dDraw:false,overlays:[]};
  class Map{constructor(el,opts){this.el=el;this.opts=opts;this.listeners={};mapQA.maps++;mapQA.mapGesture=opts.gestureHandling;}getDiv(){return this.el;}addListener(k,f){this.listeners[k]=f;}fitBounds(b){this.bounds=b;mapQA.fits++;}}
  class Overlay{constructor(opts){this.opts=opts;mapQA.overlays.push(this);}setMap(map){this.opts.map=map;}}
  class Point{constructor(x,y){this.x=x;this.y=y;}}
  class Bounds{constructor(){this.points=[];}extend(p){this.points.push(p);}}
  class Scene extends HTMLElement{constructor(opts){super();Object.assign(this,opts);mapQA.scenes++;}flyCameraTo(opts){if(mapQA.stopping)throw Error('camera started before stop completed');this.lastFlight=opts;mapQA.flights++;}async stopCameraAnimation(){mapQA.stops++;mapQA.stopping=true;await new Promise(r=>setTimeout(r,0));mapQA.stopping=false;}}
  class Line extends HTMLElement{constructor(opts){super();if(mapQA.fail3dDraw)throw new Error("Simulated 3D drawing failure");Object.assign(this,opts);}}
  class Marker extends HTMLElement{constructor(opts){super();Object.assign(this,opts);}}
  customElements.define('qa-map-scene',Scene);customElements.define('qa-map-line',Line);customElements.define('qa-map-marker',Marker);
  class Pin extends HTMLElement{constructor(opts){super();Object.assign(this,opts);}}
  customElements.define('qa-map-pin',Pin);
  const maps3d={Map3DElement:Scene,Polyline3DElement:Line,Marker3DElement:Marker};
  window.google={maps:{SymbolPath:{CIRCLE:0},Point,maps3d,Map,LatLngBounds:Bounds,Polyline:Overlay,Circle:Overlay,Marker:Overlay,importLibrary:async name=>{if(name==='marker')mapQA.markerImports++;return name==='maps3d'?maps3d:{Map,Marker:Overlay,PinElement:Pin};}}};
  window.__caddieMapsReady();
}
function locationMock(){
  const watches=new Map();let next=0;
  window.locationQA={calls:0,cleared:[],last:null,options:null,
    fix(point,accuracy=5,age=0){this.last.success({coords:{latitude:point[0],longitude:point[1],accuracy},timestamp:Date.now()-age});},
    error(code){this.last.error({code});},active:()=>watches.size};
  Object.defineProperty(navigator,'geolocation',{configurable:true,value:{
    watchPosition(success,error,options){const id=++next;locationQA.calls++;locationQA.options=options;locationQA.last={success,error};watches.set(id,locationQA.last);return id;},
    clearWatch(id){locationQA.cleared.push(id);watches.delete(id);}
  }});
}
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const url='http://127.0.0.1:'+server.address().port+'/',errors=[],screens=process.env.CADDIE_QA_DIR||'/tmp/caddie-prep-qa';fs.mkdirSync(screens,{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:process.env.CADDIE_CHROMIUM||(fs.existsSync('/tmp/chromium')?'/tmp/chromium':undefined),args:['--no-sandbox']});
  try{
    const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',acceptDownloads:true}),p=await context.newPage();p.setDefaultTimeout(12000);p.on('pageerror',e=>errors.push(e.message));
    let googleRequests=0,guideFailure=false;
    await p.route('https://www.poundridgegolf.com/images/galleries/courseOverview/PoundRidgeGolf*.jpg*',async route=>{
      if(guideFailure)return route.abort('failed');
      const n=route.request().url().match(/Golf(\d+)\.jpg/)[1];
      if(n==='1' && process.env.CADDIE_GUIDE_IMAGE)return route.fulfill({contentType:'image/jpeg',body:fs.readFileSync(process.env.CADDIE_GUIDE_IMAGE)});
      await route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="650"><rect width="400" height="650" fill="#b9b7a6"/><text x="200" y="320" text-anchor="middle">Guide fixture · Hole '+n+'</text></svg>'});
    });
    await p.route('https://maps.googleapis.com/maps/api/js*',async route=>{googleRequests++;await route.fulfill({contentType:'text/javascript',body:'('+googleMock.toString()+')()'});});
    await p.goto(url);await ready(p);const initial=await state(p);await prep(p);
    assert.equal(await p.locator('.cp-holes button').count(),18);assert.equal(await p.locator('#cp-tees option').count(),7);
    assert.match(await p.locator('.cp-hole-heading').innerText(),/380 yd/);
    assert.equal(await p.locator('.cp-clubs [data-club]').count(),initial.carries.length);
    assert.equal(await p.locator('#cp-club-readout .cp-distances').count(),0,'no misleading zero-distance target before a landing spot exists');
    for(let n=1;n<=18;n++){
      await p.locator('.cp-holes [data-n="'+n+'"]').click();await mode(p,'route');
      const tee=+await p.locator('[data-point="tee"] circle').getAttribute('cy'),green=+await p.locator('[data-point="green"] circle').getAttribute('cy');
      assert.ok(tee>green,'green above tee on hole '+n);assert.equal(await p.locator('.cp-route-line').count(),1,'focused view hides neighboring routes');
    }
    await p.locator('.cp-holes [data-n="1"]').click();await mode(p,'route');
    await p.locator('[data-point="green"] circle').click({force:true});
    const mappedTarget=(await state(p)).coursePrep.poundRidge.holes['granite:1'].target;
    assert.ok(await p.evaluate(point=>{const c=CADDIE_PREP_COURSES[0];return CaddieCoursePrep.geo.distance(point,c.holes[0].path.at(-1))<1;},mappedTarget),'rotated map click lands within one yard of the mapped green');
    await p.locator('[data-cp="clear-target"]').click();
    for(const width of [320,390,1440]){
      await p.setViewportSize({width,height:width===1440?1000:844});await p.evaluate(()=>scrollTo(0,0));
      const bounds=await p.evaluate(()=>({width:innerWidth,content:document.documentElement.scrollWidth,holeButtons:[...document.querySelectorAll('.cp-holes button')].map(e=>({left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right})),skip:document.querySelector('.hq-skip').getBoundingClientRect().bottom}));
      assert.ok(bounds.content<=width+1,'page fits '+width);assert.ok(bounds.holeButtons.every(b=>b.left>=0&&b.right<=width),'hole buttons fit '+width);assert.ok(bounds.skip<=0,'skip link stays offscreen when unfocused');
      await p.locator('.cp-map-panel').screenshot({path:path.join(screens,'course-map-'+width+'.png')});
      await p.screenshot({path:path.join(screens,'course-prep-'+width+'.png'),fullPage:true});
    }
    await p.setViewportSize({width:390,height:844});
    await p.locator('#cp-tees').selectOption('oak');assert.match(await p.locator('.cp-hole-heading').innerText(),/415 yd/);
    await p.locator('#cp-tees').selectOption('granite');
    await p.locator('[data-cp="club"][data-club="5-wood"]').click();assert.match(await p.locator('#cp-club-readout').innerText(),/no carry/);
    await p.locator('#cp-basis').selectOption('range');assert.match(await p.locator('#cp-club-readout').innerText(),/Range · 2026-/);assert.ok(await p.locator('.cp-carry-ring').count());
    const note='5W toward my target; check the front-edge carry. <img src=x onerror=alert(1)>';
    await p.locator('#cp-note').fill(note);await p.locator('#cp-reviewed').check();assert.equal(await p.locator('#cp-reviewed-count').innerText(),'1/18');
    await p.locator('#cp-roll').fill('15');assert.equal(await p.locator('#cp-roll-label').textContent(),'15 yd');
    await p.locator('#cp-route-map').click({position:{x:170,y:160}});
    assert.ok((await state(p)).coursePrep.poundRidge.holes['granite:1'].target);
    assert.equal(await p.locator('.cp-compare-options button').count(),3);
    const comparedClub=await p.locator('.cp-compare-options button').first().getAttribute('data-club');await p.locator('.cp-compare-options button').first().click();
    assert.equal((await state(p)).planCalls['pound ridge golf club'][1].club[0],comparedClub,'comparison selects a real saved bag club');
    await p.locator('.cp-clubs [data-club="5-wood"]').click();
    await p.locator('[data-cp="rings"]').click();assert.equal(await p.locator('.cp-carry-ring').count(),0);await p.locator('[data-cp="rings"]').click();assert.ok(await p.locator('.cp-carry-ring').count());
    for(const width of [320,390,1440]){await p.setViewportSize({width,height:width===1440?1000:844});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.locator('.cp-plan-card').first().screenshot({path:path.join(screens,'shot-plan-'+width+'.png')});}
    await p.setViewportSize({width:390,height:844});
    await p.locator('[data-cp="edit"][data-kind="tee"]').click();await p.locator('#cp-route-map').click({position:{x:140,y:85}});
    assert.ok((await state(p)).coursePrep.poundRidge.holes['granite:1'].tee);
    await p.locator('#cp-round-plan summary').click();assert.equal(await p.locator('.cp-plan-table [data-n="1"] > span:last-child').innerText(),note);
    await p.locator('.cp-holes [data-n="15"]').click();assert.match(await p.locator('.cp-hole-heading').innerText(),/Par 3 · 144 yd/);
    await p.locator('.cp-holes [data-n="1"]').click();assert.equal(await p.locator('#cp-note').inputValue(),note);
    await p.locator('#cp-tees').selectOption('oak');assert.equal(await p.locator('#cp-note').inputValue(),'');await p.locator('#cp-tees').selectOption('granite');assert.equal(await p.locator('#cp-note').inputValue(),note);
    await mode(p,'route');await p.locator('[data-cp="overview"]').click();assert.equal(await p.locator('[data-cp="map-hole"][role="button"]').count(),18);await p.locator('[data-cp="map-hole"][data-n="18"]').press('Enter');assert.match(await p.locator('.cp-hole-heading').innerText(),/Hole 18/);
    await p.locator('.cp-holes [data-n="1"]').click();
    await p.locator('[data-cp="review-next"]').click();assert.match(await p.locator('.cp-hole-heading').innerText(),/Hole 2/);assert.equal((await state(p)).coursePrep.poundRidge.holes['granite:1'].reviewed,true);
    await p.locator('.cp-holes [data-n="1"]').click();
    const saved=(await state(p)).coursePrep;
    await p.reload();await ready(p);await prep(p);assert.deepEqual((await state(p)).coursePrep,saved);assert.equal(await p.locator('#cp-note').inputValue(),note);
    assert.equal(googleRequests,0,'no Google request before a configured imagery view');
    await mode(p,'3d');assert.match(await p.locator('#cp-map-stage').innerText(),/Connect your Google Maps key/);
    await p.locator('[data-cp="map-setup"]').click();await p.locator('#cp-api-key').fill('invalid');await p.locator('[data-cp="key-save"]').click();assert.equal(googleRequests,0);
    await p.locator('#cp-api-key').fill('AIza'+'x'.repeat(35));await p.locator('[data-cp="key-save"]').click();await p.locator('qa-map-scene').waitFor();
    assert.equal(googleRequests,1);assert.ok(await p.locator('qa-map-line').count()>=3);
    assert.equal(await p.locator('qa-map-scene').evaluate(e=>e.gestureHandling),'GREEDY');
    const beforeJump=await state(p);await p.locator('[data-cp="shot-plan"]').click();assert.deepEqual(await state(p),beforeJump,'jumping to the plan preserves golf state');
    const initialLabels=await p.locator('qa-map-marker').evaluateAll(els=>els.map(e=>e.label));
    assert.deepEqual(initialLabels.slice(0,2),['Tee','Green']);assert.match(initialLabels[2],/^\d[\d,]* yd · \d[\d,]* yd left$/);
    assert.equal(await p.evaluate(()=>mapQA.markerImports),0,'3D has no optional marker-library startup dependency');
    await p.evaluate(()=>{mapQA.fail3dDraw=true;});await p.locator('.cp-clubs [data-club="5-wood"]').click();
    await p.locator('#cp-map-stage .cp-map-message').waitFor();assert.match(await p.locator('#cp-map-stage').innerText(),/drawing the 3D hole/);
    assert.ok(!(await p.locator('#cp-map-stage').innerText()).includes('billing'));
    await mode(p,'satellite');await p.locator('.cp-google-map').waitFor();
    await p.evaluate(()=>{mapQA.fail3dDraw=false;});await mode(p,'3d');await p.locator('qa-map-scene').waitFor();
    await p.locator('[data-cp="frame"][data-focus="green"]').click();await p.waitForFunction(()=>document.querySelector('qa-map-scene').lastFlight?.endCamera.range===190);assert.equal(await p.locator('qa-map-scene').evaluate(e=>e.lastFlight.endCamera.range),190);
    const cameraBefore=await p.evaluate(()=>mapQA.flights);await p.locator('.cp-clubs [data-club="5-wood"]').click();await p.locator('qa-map-scene').waitFor();assert.equal(await p.evaluate(()=>mapQA.flights),cameraBefore,'club changes preserve 3D camera');
    await p.locator('[data-cp="frame"][data-focus="hole"]').click();await p.waitForFunction(()=>document.querySelector('qa-map-scene').lastFlight?.endCamera.range>190);assert.ok(await p.locator('qa-map-scene').evaluate(e=>e.lastFlight.endCamera.range>190));
    const framed=await p.evaluate(()=>mapQA.flights);await p.locator('[data-cp="fly"]').click();await p.waitForFunction(n=>mapQA.flights===n+1,framed);assert.equal(await p.evaluate(()=>mapQA.flights),framed+1);await p.locator('qa-map-scene').dispatchEvent('gmp-animationend');assert.equal(await p.evaluate(()=>mapQA.flights),framed+2);
    await p.locator('[data-cp="next"]').click();assert.equal(await p.locator('.cp-modes [data-mode="guide"]').getAttribute('aria-pressed'),'true');await mode(p,'3d');await p.locator('qa-map-scene').waitFor();assert.equal(await p.evaluate(()=>mapQA.scenes),1,'reuse 3D map');
    for(let n=1;n<=18;n++){
      await p.evaluate(n=>{CaddieCoursePrep.openHole(n);document.querySelector('[data-cp="mode"][data-mode="3d"]').click();},n);
      await p.waitForFunction(n=>{const e=document.querySelector('qa-map-scene'),h=CADDIE_PREP_COURSES[0].holes[n-1];return e?.lastFlight?.endCamera.heading===CaddieCoursePrep.geo.bearing(JSON.parse(localStorage.caddiehq_v1).coursePrep.poundRidge.holes['granite:'+n]?.tee||h.path[0],h.path.at(-1));},n);
      const cam=await p.locator('qa-map-scene').evaluate(e=>e.lastFlight.endCamera);
      assert.equal(cam.tilt,58);assert.equal(cam.roll,0);
    }
    await p.locator('[data-cp="frame"][data-focus="green"]').click();await p.waitForFunction(()=>document.querySelector('qa-map-scene').lastFlight.endCamera.range===190);
    await p.locator('[data-cp="frame"][data-focus="tee"]').click();await p.waitForFunction(()=>document.querySelector('qa-map-scene').lastFlight.endCamera.tilt===58);
    await p.evaluate(()=>{CaddieCoursePrep.openHole(2);document.querySelector('[data-cp="mode"][data-mode="3d"]').click();});
    await p.waitForFunction(()=>document.querySelector('qa-map-scene')?.lastFlight.endCamera.heading===CaddieCoursePrep.geo.bearing(CADDIE_PREP_COURSES[0].holes[1].path[0],CADDIE_PREP_COURSES[0].holes[1].path.at(-1)));
    await p.locator('qa-map-scene').dispatchEvent('gmp-error');assert.match(await p.locator('#cp-map-stage').innerText(),/3D could not initialize/);
    await mode(p,'satellite');await p.locator('.cp-google-map').waitFor();await p.locator('[data-cp="next"]').click();assert.equal(await p.locator('.cp-modes [data-mode="guide"]').getAttribute('aria-pressed'),'true');await mode(p,'satellite');await p.locator('.cp-google-map').waitFor();assert.equal(await p.evaluate(()=>mapQA.maps),1,'reuse satellite map');
    assert.equal(await p.evaluate(()=>mapQA.mapGesture),'greedy');
    const fits=await p.evaluate(()=>mapQA.fits);await p.locator('.cp-clubs [data-club="5-wood"]').click();await p.locator('.cp-google-map').waitFor();assert.equal(await p.evaluate(()=>mapQA.fits),fits,'club changes preserve satellite camera');
    await p.locator('[data-cp="frame"][data-focus="green"]').click();assert.equal(await p.evaluate(()=>mapQA.fits),fits+1);
    await p.evaluate(()=>window.gm_authFailure());assert.match(await p.locator('#cp-map-stage').innerText(),/Google rejected/);
    await p.evaluate(()=>console.error('Google Maps JavaScript API error: BillingNotEnabledMapError https://example.test/?key=PRIVATE_TEST_KEY'));
    assert.equal(await p.locator('.cp-error-code').innerText(),'BillingNotEnabledMapError');
    assert.match(await p.locator('#cp-map-stage').innerText(),/Enable billing/);
    assert.ok(!(await p.locator('#course-prep').innerText()).includes('PRIVATE_TEST_KEY'));
    await mode(p,'3d');assert.equal(await p.locator('.cp-error-code').innerText(),'BillingNotEnabledMapError','auth error persists across imagery tabs');
    assert.equal(await p.locator('qa-map-scene').count(),0,'rejected Google session cannot show a misleading 3D viewer');
    await mode(p,'satellite');
    await Promise.all([p.waitForEvent('load',{timeout:5000}),p.locator('#cp-map-stage [data-cp="retry"]').click()]);
    await p.locator('.cp-google-map').waitFor();assert.equal(googleRequests,2,'retry must request a fresh Google session');
    assert.match(await p.locator('.cp-hole-heading').innerText(),/Hole 3/,'retry restores the selected hole');
    assert.deepEqual((await state(p)).coursePrep,saved,'retry preserves the saved plan');
    await p.evaluate(()=>{console.warn('Google Maps JavaScript API error: RefererNotAllowedMapError');window.gm_authFailure();});
    assert.equal(await p.locator('.cp-error-code').innerText(),'RefererNotAllowedMapError','specific code survives a later generic auth callback');
    await p.locator('#cp-map-stage [data-cp="map-setup"]').click();await p.locator('#cp-api-key').fill('AIza'+'x'.repeat(35));
    await Promise.all([p.waitForEvent('load',{timeout:5000}),p.locator('[data-cp="key-save"]').click()]);
    await p.locator('.cp-google-map').waitFor();assert.equal(googleRequests,3,'reconnecting the same rejected key must create a fresh session');
    await mode(p,'route');await p.locator('#cp-route-map').waitFor();
    // Existing backup actions carry plans, not the separate Maps credential.
    await explore(p,'[data-action="go"][data-view="data"]');
    const [download]=await Promise.all([p.waitForEvent('download'),p.locator('[data-action="export"]').click()]);const exported=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
    assert.deepEqual(exported.coursePrep,saved);assert.ok(!JSON.stringify(exported).includes('AIza'+'x'.repeat(35)));
    const [chooser]=await Promise.all([p.waitForEvent('filechooser'),p.locator('[data-action="import"]').click()]);await chooser.setFiles({name:'prep-test.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});
    await p.reload();await ready(p);assert.deepEqual((await state(p)).coursePrep,saved);
    const final=await state(p);for(const k of ['carries','clubs','rounds','bays'])assert.deepEqual(final[k],initial[k],k+' preserved');
    await explore(p,'[data-action="live-new"]');await p.locator('#lvCourse').fill('Pound Ridge Golf Club');await p.locator('[data-action="live-start"]').click();await p.locator('[data-action="live-card-play"]').click();
    assert.match(await p.locator('.lvhn').innerText(),/Hole 1/);assert.ok(await p.locator('[data-action="open-course-prep"][data-n="1"]').isVisible());
    await p.locator('.holeintel .hi-head').click();assert.ok((await p.locator('.holeintel .hi-grid').innerText()).includes(note),'saved note reaches the live hole');
    // The guide is a modal over the active round, not a navigation or score edit.
    for(const width of [320,390,1440]){
      await p.setViewportSize({width,height:width===1440?1000:844});
      const beforeGuide=await state(p);await p.locator('[data-action="live-hole-guide"]').click();await p.locator('#cp-live-guide img').waitFor();
      await p.waitForFunction(()=>document.querySelector('#cp-live-guide img').naturalWidth>0);
      const bounds=await p.locator('#cp-live-guide').evaluate(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,w:innerWidth,h:innerHeight};});
      assert.ok(bounds.left>=0&&bounds.right<=bounds.w&&bounds.top>=0&&bounds.bottom<=bounds.h,'guide fits '+width);
      assert.equal(await p.locator('#cp-guide-title').innerText(),'Hole 1 · Par 4');
      await p.screenshot({path:path.join(screens,'live-guide-'+width+'.png')});
      await p.locator('[aria-label="Close hole guide"]').click();await p.locator('#cp-live-guide').waitFor({state:'detached'});
      assert.deepEqual(await state(p),beforeGuide,'opening and closing the guide preserves all golf state');
      assert.equal(await p.evaluate(()=>document.activeElement?.dataset.action),'live-hole-guide');
    }
    await p.setViewportSize({width:390,height:844});
    for(let n=1;n<=18;n++){
      await p.locator('.lvbar[data-i="'+(n-1)+'"]').click();const beforeGuide=(await state(p)).live;
      await p.locator('[data-action="live-hole-guide"]').click();assert.match(await p.locator('#cp-live-guide img').getAttribute('src'),new RegExp('Golf'+n+'\\.jpg$'));
      await p.keyboard.press('Escape');await p.locator('#cp-live-guide').waitFor({state:'detached'});assert.deepEqual((await state(p)).live,beforeGuide,'guide preserves hole '+n);
    }
    guideFailure=true;await p.locator('[data-action="live-hole-guide"]').click();
    // A fresh URL exercises a real failed request even if the guide is decoded in memory.
    await p.locator('#cp-live-guide img').evaluate(img=>{img.src+='?qa=failed-request';});
    await p.locator('.cp-guide-dialog-error').waitFor();assert.ok(await p.locator('#cp-live-guide footer a').isVisible());
    await p.mouse.click(2,2);await p.locator('#cp-live-guide').waitFor({state:'detached'});assert.equal(await p.evaluate(()=>document.body.classList.contains('cp-guide-open')),false);guideFailure=false;
    // Explicit device-location reference: no initial request, no stored coordinates,
    // no overwrite of the saved tee, and yardages follow movement in every map mode.
    const gps=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
    await gps.addInitScript(locationMock);const gp=await gps.newPage();gp.setDefaultTimeout(12000);gp.on('pageerror',e=>errors.push(e.message));
    await gp.route('https://maps.googleapis.com/maps/api/js*',r=>r.fulfill({contentType:'text/javascript',body:'('+googleMock.toString()+')()'}));
    await gp.goto(url);await ready(gp);await prep(gp);await gp.clock.install();
    assert.equal(await gp.evaluate(()=>locationQA.calls),0,'location requires an explicit tap');
    await gp.locator('[data-cp="edit"][data-kind="tee"]').click();await gp.locator('#cp-route-map').click({position:{x:140,y:320}});
    await gp.locator('[data-cp="edit"][data-kind="target"]').click();await gp.locator('#cp-route-map').click({position:{x:170,y:145}});
    const beforeLocation=await state(gp),teeDistance=await gp.locator('.cp-map-summary b').first().innerText();
    const points=await gp.evaluate(()=>{const h=CADDIE_PREP_COURSES[0].holes[0],g=CaddieCoursePrep.geo;return [g.destination(h.path[0],110,g.bearing(h.path[0],h.path.at(-1))),g.destination(h.path[0],150,g.bearing(h.path[0],h.path.at(-1)))];});
    await gp.locator('[data-cp="locate"]').click();await gp.evaluate(point=>locationQA.fix(point),points[0]);
    assert.match(await gp.locator('#cp-reference').innerText(),/My location[\s\S]*±5 yd/);
    assert.notEqual(await gp.locator('.cp-map-summary b').first().innerText(),teeDistance);
    assert.deepEqual(await state(gp),beforeLocation,'GPS does not write any golf state');
    const assertLocationLabels=async()=>{
      const expected=await gp.evaluate(point=>{const s=JSON.parse(localStorage.caddiehq_v1).coursePrep.poundRidge,h=CADDIE_PREP_COURSES[0].holes[0],t=s.holes[s.tee+':1'].target;return Math.round(CaddieCoursePrep.geo.distance(point,t)).toLocaleString('en-US')+' yd · '+Math.round(CaddieCoursePrep.geo.distance(t,h.path.at(-1))).toLocaleString('en-US')+' yd left';},points[0]);
      assert.ok((await gp.locator('#cp-route-map').textContent()).includes(expected));return expected;
    };
    const expected=await assertLocationLabels();
    await gp.locator('[data-cp="locate"]').click();assert.equal(await gp.locator('.cp-map-summary b').first().innerText(),teeDistance,'pending refresh consistently returns to the tee');await gp.evaluate(point=>locationQA.fix(point),points[0]);
    for(const width of [320,390,1440]){
      await gp.setViewportSize({width,height:width===1440?1000:844});assert.ok(await gp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await gp.locator('#cp-reference').screenshot({path:path.join(screens,'location-reference-'+width+'.png')});
      await gp.locator('#cp-route-map').screenshot({path:path.join(screens,'location-map-'+width+'.png')});
    }
    await gp.setViewportSize({width:390,height:844});
    await mode(gp,'3d');await gp.locator('[data-cp="map-setup"]').click();await gp.locator('#cp-api-key').fill('AIza'+'x'.repeat(35));await gp.locator('[data-cp="key-save"]').click();await gp.locator('qa-map-scene').waitFor();
    assert.deepEqual(await gp.locator('qa-map-marker').evaluateAll(els=>els.map(e=>e.label)),['You','Green',expected]);
    const camera=await gp.evaluate(()=>mapQA.flights);await gp.evaluate(point=>locationQA.fix(point),points[1]);
    assert.equal(await gp.evaluate(()=>mapQA.flights),camera,'GPS movement preserves the 3D camera');
    assert.notEqual((await gp.locator('qa-map-marker').evaluateAll(els=>els.map(e=>e.label)))[2],expected);
    await gp.evaluate(point=>locationQA.fix(point),points[0]);
    await mode(gp,'satellite');await gp.locator('.cp-google-map').waitFor();
    assert.equal(await gp.evaluate(()=>mapQA.overlays.findLast(o=>o.opts.map&&o.opts.label?.className==='cp-google-yardage-label').opts.label.text),expected);
    assert.equal(await gp.evaluate(()=>locationQA.active()),1,'map switches reuse the same location watch');
    await gp.locator('[data-cp="use-tee"]').click();assert.equal(await gp.evaluate(()=>locationQA.active()),0);
    assert.equal(await gp.locator('.cp-map-summary b').first().innerText(),teeDistance);assert.deepEqual(await state(gp),beforeLocation);
    await gp.evaluate(point=>locationQA.fix(point),points[1]);assert.match(await gp.locator('#cp-reference').innerText(),/Your tee/,'late callback cannot restart GPS');
    // Real 3D click adapter updates the saved target and the labels, without a camera reset.
    await mode(gp,'3d');await gp.locator('qa-map-scene').waitFor();
    await gp.locator('qa-map-scene').evaluate((el,point)=>{const e=new Event('gmp-click');e.position={lat:point[0],lng:point[1]};el.dispatchEvent(e);},points[1]);
    assert.deepEqual((await state(gp)).coursePrep.poundRidge.holes['granite:1'].target,points[1].map(n=>+n.toFixed(7)));
    for(const [code,message] of [[1,/permission is off/],[2,/Location is unavailable/],[3,/timed out/]]){
      await gp.locator('[data-cp="locate"]').click();await gp.evaluate(code=>locationQA.error(code),code);
      assert.match(await gp.locator('#cp-reference').innerText(),message);assert.equal(await gp.evaluate(()=>locationQA.active()),0);
    }
    await gp.locator('[data-cp="locate"]').click();await gp.evaluate(()=>locationQA.fix([40,-74]));assert.match(await gp.locator('#cp-reference').innerText(),/outside Pound Ridge/);assert.equal(await gp.evaluate(()=>locationQA.active()),0);
    await gp.locator('[data-cp="locate"]').click();await gp.evaluate(point=>locationQA.fix(point,100),points[0]);assert.match(await gp.locator('#cp-reference').innerText(),/accuracy is too low/);assert.match(await gp.locator('#cp-reference b').innerText(),/Your tee/);
    await gp.evaluate(point=>locationQA.fix(point,5,50000),points[0]);assert.match(await gp.locator('#cp-reference').innerText(),/fresh location/);
    await gp.evaluate(point=>locationQA.fix(point),points[0]);await gp.clock.fastForward(46000);assert.match(await gp.locator('#cp-reference').innerText(),/Location expired/);assert.equal(await gp.evaluate(()=>locationQA.active()),0);
    await gp.locator('[data-cp="locate"]').click();await gp.evaluate(point=>locationQA.fix(point),points[0]);
    await gp.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
    assert.equal(await gp.evaluate(()=>locationQA.active()),0);assert.match(await gp.locator('#cp-reference').innerText(),/Location paused/);
    await gp.evaluate(()=>{delete document.hidden;});
    await gp.locator('[data-cp="locate"]').click();await gp.evaluate(point=>locationQA.fix(point),points[0]);
    await gp.locator('#nav [data-view="bag"]').click();assert.equal(await gp.evaluate(()=>locationQA.active()),0,'leaving prep stops location');await prep(gp);
    assert.match(await gp.locator('#cp-reference b').innerText(),/Your tee/);
    await gp.evaluate(()=>{Object.defineProperty(navigator,'geolocation',{configurable:true,value:undefined});});await gp.locator('[data-cp="locate"]').click();assert.match(await gp.locator('#cp-reference').innerText(),/unavailable in this browser/);
    await gps.close();
    // Exercise the browser's real Geolocation implementation with permission and
    // simulated on-course coordinates, in addition to deterministic error cases.
    const device=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',permissions:['geolocation'],geolocation:{latitude:points[0][0],longitude:points[0][1],accuracy:5}}),dp=await device.newPage();
    dp.on('pageerror',e=>errors.push(e.message));await dp.goto(url);await ready(dp);await prep(dp);const beforeDevice=await state(dp);
    await dp.locator('[data-cp="locate"]').click();await dp.getByText('My location',{exact:true}).first().waitFor();assert.match(await dp.locator('#cp-reference').innerText(),/Live · accuracy/);
    const oldYardage=await dp.locator('.cp-map-summary b').first().innerText();
    await device.setGeolocation({latitude:points[1][0],longitude:points[1][1],accuracy:5});await dp.waitForFunction(old=>document.querySelector('.cp-map-summary b').innerText!==old,oldYardage);
    assert.deepEqual(await state(dp),beforeDevice);await device.close();
    // Actual service worker, actual offline reload, and a note saved offline.
    const offline=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'allow'}),op=await offline.newPage();op.on('pageerror',e=>errors.push(e.message));
    await op.goto(url);await ready(op);await op.evaluate(()=>navigator.serviceWorker.ready);await op.waitForFunction(()=>!!navigator.serviceWorker.controller);await prep(op);
    await op.locator('#cp-note').fill('Offline prep survives');await offline.setOffline(true);await op.reload();await prep(op);assert.equal(await op.locator('#cp-note').inputValue(),'Offline prep survives');
    await op.locator('.cp-holes [data-n="18"]').click();assert.match(await op.locator('.cp-hole-heading').innerText(),/Hole 18/);await op.locator('#cp-note').fill('Saved while offline');assert.equal((await state(op)).coursePrep.poundRidge.holes['granite:18'].note,'Saved while offline');
    const cached=await op.evaluate(async()=>{const keys=await caches.keys();const requests=(await Promise.all(keys.map(async k=>(await (await caches.open(k)).keys()).map(r=>r.url)))).flat();return requests;});assert.ok(cached.every(u=>new URL(u).origin===new URL(url).origin));
    assert.deepEqual(errors,[]);console.log('PASS course prep browser: 320/390/1440 layouts, all holes/tees, saved plans, live guides, backup/import, offline reload, map yardage labels, native Geolocation movement, simulated GPS errors/staleness/lifecycle, no location persistence, mocked Google reuse/flyover/auth fallback. Live Google imagery requires a real key.');
  }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
