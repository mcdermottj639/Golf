// Flyover v247 — real UI in Chromium with Google's 3D API mocked. This certifies the
// camera script, captions, stop behaviour, layout and golf-state preservation. It does
// NOT certify how Google's real imagery or camera easing looks on Jack's phone.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {server,chromium,state,ready,googleMock}=require('./course-prep-browser.cjs');
const root=path.join(__dirname,'..'),KEY='AIza'+'f'.repeat(35);
const shots=process.env.CADDIE_QA_DIR||'/tmp/caddie-flyover-qa';fs.mkdirSync(shots,{recursive:true});

// Runs in the page once the mocked SDK exists: log every camera call in order.
function patchScene(){
  const S=customElements.get('qa-map-scene');if(S.prototype.__flyPatched)return;S.prototype.__flyPatched=true;
  window.flyLog=[];
  const to=S.prototype.flyCameraTo,stop=S.prototype.stopCameraAnimation,now=()=>performance.now();
  S.prototype.flyCameraTo=function(o){
    try{const r=to.call(this,o);flyLog.push({type:'to',cam:JSON.parse(JSON.stringify(o.endCamera)),ms:o.durationMillis,t:now()});return r;}
    catch(e){flyLog.push({type:'error',msg:e.message});throw e;}
  };
  S.prototype.flyCameraAround=function(o){
    if(mapQA.stopping){flyLog.push({type:'error',msg:'orbit started before stop completed'});throw Error('orbit started before stop completed');}
    flyLog.push({type:'around',cam:JSON.parse(JSON.stringify(o.camera)),ms:o.durationMillis,repeat:o.repeatCount,t:now()});
  };
  S.prototype.stopCameraAnimation=function(){flyLog.push({type:'stop',t:now()});return stop.call(this);};
}
const log=p=>p.evaluate(()=>window.flyLog.slice());
const tos=entries=>entries.filter(e=>e.type==='to');
const near=(a,b,eps=1e-7)=>Math.abs(a.lat-b[0])<eps&&Math.abs(a.lng-b[1])<eps;
async function fresh(p){await p.evaluate(()=>{window.flyLog.length=0;});}
async function captionState(p,scope='body'){
  return p.evaluate(s=>{const el=document.querySelector(s+' #cp-fly-caption');if(!el)return null;
    return {hidden:el.hidden,eyebrow:el.querySelector('.cp-fly-eyebrow')?.innerText||'',main:el.querySelector('.cp-fly-main')?.innerText||'',
      rows:[...el.querySelectorAll('.cp-fly-row')].map(r=>r.innerText),text:el.innerText,
      preview:getComputedStyle(document.querySelector(s+' .cp-tee-preview')).display};},scope);
}

(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const url='http://127.0.0.1:'+server.address().port+'/',errors=[];
  const browser=await chromium.launch({headless:true,executablePath:process.env.CADDIE_CHROMIUM||undefined,args:['--no-sandbox']});
  try{
    const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
    await context.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
    await context.route('https://maps.googleapis.com/maps/api/js*',r=>r.fulfill({contentType:'text/javascript',body:'('+googleMock.toString()+')()'}));
    await context.addInitScript(k=>localStorage.setItem('caddiehq_google_maps_key_v1',k),KEY);
    const p=await context.newPage();p.setDefaultTimeout(20000);p.on('pageerror',e=>errors.push(e.message));
    await p.goto(url);await ready(p);
    await p.locator('#nav [data-view="rounds"]').click();await p.locator('[data-action="open-course-prep"]').first().click();
    await p.locator('qa-map-scene').waitFor();await p.evaluate(patchScene);
    assert.equal(await p.evaluate(()=>CaddieCoursePrep.courseId),'pound-ridge');
    await p.waitForTimeout(300);
    const before=await state(p);

    // 1 · Full motion, hole 1 (par 4): tee → landing → green → sweep, captions at each stop.
    const g1=await p.evaluate(()=>{const h=CaddieCoursePrep.findCourse('pound-ridge').holes[0];
      const m=[...document.querySelectorAll('qa-map-marker')].find(m=>m.label?.endsWith(' yd carry'));
      return {par:h.par,tee:h.path[0],green:h.path.at(-1),route:h.path,landing:m?[m.position.lat,m.position.lng]:null};});
    assert.equal(g1.par,4);assert.ok(g1.landing,'hole 1 shows a club landing preview');
    await fresh(p);await p.locator('[data-cp="fly"]').click();
    await p.waitForFunction(()=>flyLog.some(e=>e.type==='to'));
    let L=await log(p),intro=tos(L)[0];
    assert.equal(intro.ms,2500);assert.equal(intro.cam.tilt,66);assert.equal(intro.cam.range,150);
    assert.equal(intro.cam.altitudeMode,'RELATIVE_TO_GROUND');assert.equal(intro.cam.center.altitude,0);assert.equal(intro.cam.roll,0);
    const bearing=(a,b)=>p.evaluate(([a,b])=>CaddieCoursePrep.geo.bearing(a,b),[a,b]);
    assert.ok(Math.abs(intro.cam.heading-await bearing(g1.tee,g1.landing))<1e-9,'opening camera looks down the line to the landing');
    let c=await captionState(p);
    assert.equal(c.hidden,false);assert.equal(c.eyebrow,'HOLE 1 · PAR 4 · 380 YD');assert.ok(!c.text.includes('*'),'plan markup is rendered, not printed');
    assert.equal(c.preview,'none','club overlay steps aside during the tour');
    await p.waitForFunction(()=>flyLog.filter(e=>e.type==='to').length>=2,null,{timeout:12000});
    L=await log(p);const leg1=tos(L)[1];
    assert.ok(near(leg1.cam.center,g1.landing),'first stop is the club landing');
    assert.equal(leg1.cam.range,185);assert.equal(leg1.cam.tilt,60);
    assert.ok(leg1.ms>=3500&&leg1.ms<=6000);
    assert.ok(Math.abs(leg1.cam.heading-await bearing(g1.tee,g1.landing))<1e-9);
    // Google's own end event advances the tour before the fallback timer would.
    await p.waitForTimeout(Math.ceil(leg1.ms*0.65));
    await p.locator('qa-map-scene').dispatchEvent('gmp-animationend');
    await p.waitForFunction(()=>document.querySelector('#cp-fly-caption .cp-fly-eyebrow')?.innerText==='LANDING',null,{timeout:900});
    c=await captionState(p);assert.match(c.main,/^.+ · \d+ yd carry · \d+ left$/);
    await p.waitForFunction(()=>flyLog.some(e=>e.type==='around'),null,{timeout:30000});
    L=await log(p);const legs=tos(L).slice(1),last=legs.at(-1),orbit=L.find(e=>e.type==='around');
    assert.ok(near(last.cam.center,g1.green),'tour ends on the green');assert.equal(last.cam.range,200);assert.equal(last.cam.tilt,52);
    for(let i=1;i<legs.length;i++){
      const prev=[legs[i-1].cam.center.lat,legs[i-1].cam.center.lng];
      assert.ok(Math.abs(legs[i].cam.heading-await bearing(prev,[legs[i].cam.center.lat,legs[i].cam.center.lng]))<1e-9,'each leg faces its next stop');
      if(i<legs.length-1)assert.ok(g1.route.some(q=>near(legs[i].cam.center,q)),'intermediate stops are real route bends');
    }
    assert.ok(near(orbit.cam.center,g1.green));assert.equal(orbit.ms,36000);assert.equal(orbit.repeat,1);
    assert.equal((await captionState(p)).eyebrow,'HOLE 1 · GREEN');
    await p.waitForFunction(t=>flyLog.some(e=>e.type==='stop'&&e.t>t),orbit.t,{timeout:14000});
    const swept=(await log(p)).find(e=>e.type==='stop'&&e.t>orbit.t).t-orbit.t;
    assert.ok(swept>8500&&swept<11000,'green sweep is stopped in place after about nine seconds ('+Math.round(swept)+' ms)');
    await p.waitForFunction(()=>document.querySelector('#cp-fly-caption').hidden,null,{timeout:7000});
    assert.notEqual((await captionState(p)).preview,'none','club overlay returns after the tour');
    assert.deepEqual((await log(p)).filter(e=>e.type==='error'),[]);

    // 2 · A touch on the map stops the tour, and that touch does not drop a target pin.
    await fresh(p);await p.locator('[data-cp="fly"]').click();
    await p.waitForFunction(()=>flyLog.some(e=>e.type==='to'));await p.waitForTimeout(300);
    await p.evaluate(landing=>{const s=document.querySelector('qa-map-scene');
      s.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,composed:true}));
      const click=new Event('gmp-click');click.position={lat:landing[0],lng:landing[1]};s.dispatchEvent(click);},g1.landing);
    c=await captionState(p);assert.equal(c.hidden,true,'touch hides the caption at once');
    const afterTouch=tos(await log(p)).length;await p.waitForTimeout(4500);
    assert.equal(tos(await log(p)).length,afterTouch,'no camera moves after a touch');
    assert.ok(!(await log(p)).some(e=>e.type==='around'));
    assert.deepEqual(await state(p),before,'the stopping touch saved no target and the tour wrote no golf state');

    // 3 · The Stop button ends it too.
    await fresh(p);await p.locator('[data-cp="fly"]').click();
    await p.waitForFunction(()=>flyLog.some(e=>e.type==='to'));
    await p.locator('[data-cp="stop"]').click();
    const afterStop=tos(await log(p)).length;assert.equal((await captionState(p)).hidden,true);
    await p.waitForTimeout(3500);assert.equal(tos(await log(p)).length,afterStop,'no camera moves after Stop');

    // 4 · Caption layout at phone and desktop widths while a tour is running.
    for(const [w,h] of [[320,640],[390,844],[1440,900]]){
      await p.setViewportSize({width:w,height:h});await p.waitForTimeout(200);
      await fresh(p);await p.locator('[data-cp="fly"]').click();await p.waitForFunction(()=>!document.querySelector('#cp-fly-caption').hidden);
      const m=await p.evaluate(()=>{const cap=document.querySelector('#cp-fly-caption'),can=document.querySelector('.cp-map-canvas');
        const a=cap.getBoundingClientRect(),b=can.getBoundingClientRect();
        return {inside:a.left>=b.left-0.5&&a.right<=b.right+0.5&&a.top>=b.top-0.5,ratio:a.height/b.height,
          clip:[cap,...cap.children].some(e=>e.scrollWidth>e.clientWidth+1),page:document.documentElement.scrollWidth>innerWidth};});
      assert.ok(m.inside,w+'px: caption sits inside the map');assert.ok(m.ratio<=0.46,w+'px: caption leaves the map visible ('+m.ratio.toFixed(2)+')');
      assert.ok(!m.clip,w+'px: caption text is not clipped sideways');assert.ok(!m.page,w+'px: no sideways page scroll');
      await p.locator('.cp-map-canvas').screenshot({path:path.join(shots,'flyover-'+w+'.png')});
      await p.locator('[data-cp="stop"]').click();
    }
    await p.setViewportSize({width:390,height:844});

    // 5 · Reduced motion on a par 3: instant cuts, no sweep, no landing stop.
    const par3=JSON.parse(fs.readFileSync(path.join(root,'data/course-prep/packs/pound-ridge.json'),'utf8')).holes.find(h=>h.par===3&&h.mapReady!==false);
    await p.emulateMedia({reducedMotion:'reduce'});
    await p.locator('[data-cp="hole"][data-n="'+par3.n+'"]').first().click();await p.locator('qa-map-scene').waitFor();await p.waitForTimeout(300);
    await fresh(p);await p.locator('[data-cp="fly"]').click();
    await p.waitForFunction(()=>document.querySelector('#cp-fly-caption .cp-fly-eyebrow')?.innerText.endsWith('GREEN'),null,{timeout:8000});
    await p.waitForFunction(()=>document.querySelector('#cp-fly-caption').hidden,null,{timeout:12000});
    L=await log(p);
    assert.ok(tos(L).every(e=>e.ms===0),'reduced motion uses instant cuts');assert.ok(!L.some(e=>e.type==='around'),'reduced motion skips the sweep');
    assert.ok(near(tos(L).at(-1).cam.center,par3.path.at(-1)));
    assert.ok(tos(L).slice(1,-1).every(e=>par3.path.some(q=>near(e.cam.center,q))),'a par 3 has no landing stop');
    await p.emulateMedia({reducedMotion:'no-preference'});

    // 6 · Every mapped hole on every course, in the live-round popup, timers compressed 50×.
    await p.evaluate(()=>{const st=window.setTimeout.bind(window);window.setTimeout=(f,ms=0,...a)=>st(f,ms>=1000?ms/50:ms,...a);});
    const catalog=JSON.parse(fs.readFileSync(path.join(root,'data/course-prep/catalog.json'),'utf8'));
    let checked=0;const problems=[];
    for(const id of catalog){
      const pack=JSON.parse(fs.readFileSync(path.join(root,'data/course-prep/packs/'+id+'.json'),'utf8'));
      for(const hole of pack.holes.filter(h=>h.mapReady!==false&&h.path?.length>=2)){
        assert.ok(await p.evaluate(([id,n])=>CaddieCoursePrep.openLiveMap(id,n,'3d'),[id,hole.n]),id+' '+hole.n+' opens');
        const dlg=p.locator('dialog[open]').last();await dlg.locator('qa-map-scene').waitFor();await p.waitForTimeout(80);
        await fresh(p);await dlg.locator('[data-cp="fly"]').click();
        await p.waitForFunction(()=>{const a=flyLog.findIndex(e=>e.type==='around');return a>=0&&flyLog.slice(a).some(e=>e.type==='stop');},null,{timeout:8000});
        const bad=await p.evaluate(([id,n])=>{
          const g=CaddieCoursePrep.geo,h=CaddieCoursePrep.findCourse(id).holes.find(x=>x.n===n),out=[];
          const d=document.querySelector('dialog[open]'),m=[...d.querySelectorAll('qa-map-marker')].find(m=>m.label?.endsWith(' yd carry'));
          const landing=m?[m.position.lat,m.position.lng]:null,near=(c,q)=>Math.abs(c.lat-q[0])<1e-7&&Math.abs(c.lng-q[1])<1e-7;
          const T=flyLog.filter(e=>e.type==='to'),O=flyLog.find(e=>e.type==='around');
          if(flyLog.some(e=>e.type==='error'))out.push('camera error');
          for(const e of [...T,O]){const c=e.cam;if(![c.center.lat,c.center.lng,c.range,c.heading,c.tilt].every(Number.isFinite)||c.center.altitude!==0||c.altitudeMode!=='RELATIVE_TO_GROUND'||c.roll!==0)out.push('bad camera');}
          if(!near(T.at(-1).cam.center,h.path.at(-1)))out.push('does not end on green');
          if(!near(O.cam.center,h.path.at(-1)))out.push('sweep not on green');
          if(h.par===3&&landing)out.push('par 3 landing');
          if(h.par!==3&&landing&&!near(T[1].cam.center,landing))out.push('first stop is not the landing');
          const stops=T.slice(1).map(e=>[e.cam.center.lat,e.cam.center.lng]);
          stops.slice(landing?1:0,-1).forEach(q=>{if(!h.path.some(r=>Math.abs(r[0]-q[0])<1e-7&&Math.abs(r[1]-q[1])<1e-7))out.push('invented stop');});
          if(Math.abs(T[0].cam.heading-g.bearing(h.path[0],stops[0]))>1e-9)out.push('opening heading');
          stops.forEach((q,i)=>{if(Math.abs(T[i+1].cam.heading-g.bearing(i?stops[i-1]:h.path[0],q))>1e-9)out.push('leg heading '+i);});
          return out;
        },[id,hole.n]);
        if(bad.length)problems.push(id+' #'+hole.n+': '+bad.join(', '));
        await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.querySelector('dialog[open]'));
        checked++;
      }
    }
    assert.deepEqual(problems,[]);assert.equal(checked,72,'all 72 mapped holes flown');
    assert.deepEqual(await state(p),before,'flyovers never write golf state');
    assert.deepEqual(errors,[]);
    console.log('PASS course prep flyover browser: tee/landing/green camera script, caption copy, Google end-event advance, green sweep stop, touch + Stop cancellation without a stray pin, reduced motion par 3, caption layout 320/390/1440, all '+checked+' mapped holes in live popups, unchanged golf state. Google mocked; screenshots in '+shots+'.');
  } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
