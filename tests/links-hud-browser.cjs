'use strict';
const assert=require('node:assert/strict');
const {server,chromium,ready,state}=require('./course-prep-browser.cjs');
async function clearLabels(p){
  await p.waitForFunction(()=>CaddieLinks.debug()?.renderer==='3d');
  await p.waitForTimeout(200);
  const result=await p.evaluate(()=>{
    const rect=e=>{const r=e.getBoundingClientRect();return {id:e.id,x:r.x,y:r.y,w:r.width,h:r.height};};
    const visible=e=>e&&!e.hidden&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
    const labels=['lk-pin','lk-target'].map(id=>document.getElementById(id)).filter(visible).map(rect);
    const controls=[...document.querySelectorAll('#lk-stage .hud > *, #lk-stage .foot > *, #lk-landing, #lk-powerrail, #lk-stage .camrow, #lk-plan')].filter(visible).map(rect);
    const stage=rect(document.getElementById('lk-stage'));
    return {labels,controls,stage};
  });
  assert.equal(result.labels.length,2,'both distance labels remain visible');
  const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
  for(const label of result.labels){
    for(const control of [...result.controls,...result.labels.filter(l=>l.id!==label.id)])assert(!overlap(label,control),label.id+' overlaps '+control.id);
    assert(label.x>=result.stage.x && label.y>=result.stage.y);
    assert(label.x+label.w<=result.stage.x+result.stage.w+1 && label.y+label.h<=result.stage.y+result.stage.h+1);
  }
}
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({headless:true,executablePath:process.env.CADDIE_CHROMIUM||'/tmp/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try{for(const [width,height,len] of [[320,568,'front'],[390,844,'back'],[430,932,'back']]){
    const c=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,reducedMotion:'reduce',serviceWorkers:'block'}),p=await c.newPage(),errors=[];
    p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:'+server.address().port);await ready(p);const saved=await state(p);
    await p.addStyleTag({content:'body.lk-ingame{padding-top:67px!important}'});
    await p.locator('[data-action="open-links"]').first().click();await p.locator('#lk-lenseg [data-len="'+len+'"]').click();await p.locator('#lk-modeseg [data-mode="sling"]').click();await p.locator('#lk-start').click();
    await p.waitForFunction(()=>CaddieLinks.debug()?.phase==='aim');
    await p.waitForFunction(()=>CaddieLinks.debug()?.scene?.camera[1]===11);
    for(let side=0;side<2;side++){
      await clearLabels(p);
      await p.locator('#lk-landing').tap();await clearLabels(p);
      assert.equal((await p.evaluate(()=>CaddieLinks.debug())).scene.camera[1],55,'landing inspection keeps its camera height');
      const r=await p.locator('#lk-cv').boundingBox();
      for(const x of [.3,.5,.7]){await p.touchscreen.tap(r.x+r.width*x,r.y+r.height*.55);await clearLabels(p);}
      await p.locator('#lk-landing').tap();await clearLabels(p);
      assert.equal((await p.evaluate(()=>CaddieLinks.debug())).scene.camera[1],11,'return restores raised tee camera');
      await p.getByRole('button',{name:'Switch side',exact:true}).tap();
    }
    await p.screenshot({path:'/tmp/links-hud-'+width+'.png'});
    assert.equal((await p.evaluate(()=>CaddieLinks.debug())).strokes,0);
    await p.locator('#lk-quit').click();assert.deepEqual(await state(p),saved);assert.deepEqual(errors,[]);
    console.log('PASS HUD non-overlap / both rail sides / landing aim / tee return',width,len);await c.close();
  }}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
