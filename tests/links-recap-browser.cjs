// Deterministic shot fixtures drive the real swing, finish and recap UI. Test-only
// setup stays in the served script; there is no mutable debug API in production.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {server,chromium,ready,state}=require('./course-prep-browser.cjs');
const args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'];
const source=fs.readFileSync(path.join(__dirname,'../links-game.js'),'utf8').replace('  dbgFn=()=>(',`  window.__review={
    setup(kind){
      const h=holeObj();Math.random=()=>1;store.set('boost',0);clearBanner();clearTimeout(gimmeTimer);anim=null;fx=null;G=null;
      S.scores=[];S.putts=[];S.gir=0;S.fir=[1,1];S.practice=false;
      S.h.done=false;S.h.holed=false;S.h.recap=null;S.h.phase='aim';S.h.strokes=2;S.h.putts=0;S.h.penalties=0;S.h.gir=false;S.h.fairway=true;
      S.h.shots=[{number:1,kind:'shot',club:'Dr',distance:210,lie:'fairway'},{number:2,kind:'shot',club:'7i',distance:110,lie:'rough'}];
      S.h.ball=[h.pin[0],h.pin[1]-20];S.h.lie=kind==='bunker'?'bunker':'rough';
      S.h.wind={mph:0,from:0};S.h.shape=0;S.h.traj=0;S.h.power=null;S.h.pw=1;S.h.aim=h.pin.slice();S.h.lineAim=h.pin.slice();
      const carry=(kind==='gimme'?19.5:20)/LIE[S.h.lie].carry;
      S.h.club={id:'56°',carry,cons:0,side:0,sideSD:0,roll:0};
      if(kind==='putt'){
        S.h.ball=[h.pin[0],h.pin[1]-5.5];S.h.lie='green';S.h.club=PUTTER;h.slope={bx:0,by:0,dome:0};S.h.gir=true;updatePutt();
      }
      if(kind==='ace'){S.h.strokes=0;S.h.shots=[];S.h.lie='tee';S.h.club.carry=20;S.h.fairway=null;}
      if(kind==='penalty'){
        const club=S.h.club;S.h.strokes++;
        finishShot({b:S.h.ball.slice(),end:[h.pin[0]+80,h.pin[1]],endLie:'ob',lieBefore:'rough',g:'SOLID',club,carry:80});
        S.h.club=club;S.h.aim=h.pin.slice();S.h.lineAim=h.pin.slice();clearBanner();
      }
      if(kind==='final'){S.holes=[h.n];S.idx=0;}
      S.h.history=[h.tee.slice(),S.h.ball.slice()];scene?.reset();frame(true);renderUI();draw();
    },
    snapshot(){return JSON.parse(JSON.stringify({hole:S.h,anim,round:S,recapVisible:!$('recap').hidden}));}
  };
  dbgFn=()=>(`);
async function enter(p){await p.locator('[data-action="open-links"]').first().click();await p.locator('#lk-courses [data-id="wianno"]').click();await p.locator('#lk-modeseg [data-mode="sling"]').click();await p.locator('#lk-start').click();await p.waitForFunction(()=>CaddieLinks.debug()?.phase==='aim');}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,executablePath:process.env.CADDIE_CHROMIUM||'/tmp/chromium',args});
 try{for(const [width,height,reduced]of [[320,568,true],[390,844,false]]){
  const c=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true,reducedMotion:reduced?'reduce':'no-preference',serviceWorkers:'block'}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.route('**/links-game.js',r=>r.fulfill({contentType:'text/javascript',body:source}));
  await p.goto('http://127.0.0.1:'+server.address().port);await ready(p);const saved=await state(p);
  await p.addStyleTag({content:'body.lk-ingame{padding-top:67px!important}'});await enter(p);
  for(const kind of ['chip','bunker','ace','gimme','putt','penalty']){
   await p.evaluate(k=>__review.setup(k),kind);
   await p.locator('#lk-powerhandle').focus();await p.keyboard.press('Enter');
   let expected=null;
   if(kind==='putt'){
    const shot=await p.evaluate(()=>__review.snapshot().anim);assert.equal(shot.kind,'putt');assert(shot.dur<=3200);expected=shot.res.end;
    if(!reduced){await p.waitForTimeout(120);assert.equal(await p.locator('#lk-flight-readout').isVisible(),true);assert.match(await p.locator('#lk-flight-readout').innerText(),/PUTT ROLLING.*\n.*ft/s);assert.equal(await p.locator('#lk-skip').innerText(),'Finish putt ›');}
   }
   await p.waitForFunction(()=>CaddieLinks.debug()?.phase==='done',null,{timeout:5500});
   const s=await p.evaluate(()=>__review.snapshot()),r=s.hole.recap;
   assert.equal(s.recapVisible,true);assert.equal(r.strokes,kind==='ace'?1:kind==='gimme'?4:kind==='penalty'?5:3);
   assert.equal(r.putts,['gimme','putt'].includes(kind)?1:0);
   assert.equal(r.penalties,kind==='penalty'?1:0);assert.equal(r.special?.name,({chip:'CHIP-IN!',bunker:'BUNKER HOLE-OUT!',ace:'HOLE IN ONE!',putt:'LONG PUTT!',penalty:'CHIP-IN!'})[kind]);
   assert.equal(s.hole.shots.length,r.strokes-r.penalties);assert.equal(s.round.scores[0],r.strokes);
   if(kind==='penalty'){assert.match(await p.locator('.lk-shot-list').innerText(),/\+1 penalty/);assert.deepEqual(s.hole.shots.map(s=>s.number),[1,2,3,5]);}
   if(kind==='putt')assert.deepEqual(s.hole.ball,expected,'playback cannot change simulated endpoint');
   assert.match(await p.locator('#lk-recap-title').innerText(),kind==='ace'?/HOLE IN ONE/:kind==='gimme'?/PAR/:kind==='penalty'?/BOGEY/:/BIRDIE/);
   assert.equal(await p.locator('#lk-recap').evaluate(e=>document.activeElement===e),true,'recap receives accessible focus');
   const next=await p.locator('#lk-act').boundingBox();assert(next.y+next.height<=height+1&&next.height>=44,'Next hole stays on screen');
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
   await p.locator('#lk-recap').evaluate(e=>e.scrollTop=e.scrollHeight);assert.equal(await p.locator('.lk-shot-list li').count(),r.strokes-r.penalties);
   if(kind==='chip'){
    await p.locator('#lk-recap').evaluate(e=>e.scrollTop=0);await p.screenshot({path:'/tmp/links-recap-'+width+'.png'});await p.waitForTimeout(1800);assert.equal(await p.locator('#lk-recap').isVisible(),true,'recap does not vanish with the old banner timer');
    await p.locator('#lk-retry').click();const retry=await p.evaluate(()=>__review.snapshot());assert.equal(retry.hole.strokes,2);assert.equal(retry.hole.shots.length,2);assert.equal(retry.recapVisible,false);assert.equal(retry.round.practice,true);assert.deepEqual(retry.round.scores,[]);
    await p.locator('#lk-powerhandle').focus();await p.keyboard.press('Enter');await p.waitForFunction(()=>CaddieLinks.debug()?.phase==='done');assert.match(await p.locator('#lk-recap').innerText(),/practice round/);
   }
  }
  await p.locator('#lk-act').click();assert.equal((await p.evaluate(()=>CaddieLinks.debug())).hole,2);assert.equal(await p.locator('#lk-recap').isVisible(),false);assert.equal(await p.locator('#lk-banner').evaluate(e=>e.classList.contains('on')),false,'no previous result on next tee');
  await p.evaluate(()=>__review.setup('final'));await p.locator('#lk-powerhandle').focus();await p.keyboard.press('Enter');await p.waitForFunction(()=>CaddieLinks.debug()?.phase==='done');assert.equal(await p.locator('#lk-act').innerText(),'See your card');await p.locator('#lk-act').click();assert.equal(await p.locator('#lk-end').isVisible(),true);
  await p.locator('#lk-menu2').click();await p.locator('#lk-start').click();await p.waitForFunction(()=>CaddieLinks.debug()?.phase==='aim');await p.locator('#lk-quit').click();assert.deepEqual(await state(p),saved);assert.deepEqual(errors,[]);
  console.log('PASS chip-in / bunker / ace / gimme / long putt / penalty / recap / retry / next / final card',width,reduced?'reduced':'animated');await c.close();
 }}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
