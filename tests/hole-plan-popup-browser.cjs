'use strict';
const assert=require('node:assert/strict');
const {server,chromium,state,ready}=require('./course-prep-browser.cjs');
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:'/tmp/chromium',args:['--no-sandbox']});
 try{
  const p=await browser.newPage({viewport:{width:393,height:852},serviceWorkers:'block'});
  await p.goto('http://127.0.0.1:'+server.address().port);await ready(p);
  const baseline=await state(p);
  const open=async(id,n)=>p.evaluate(({id,n})=>{const b=document.createElement('button');b.dataset.action='open-course-prep';b.dataset.course=id;b.dataset.n=n;document.body.append(b);b.click();b.remove();},{id,n});
  await open('sterling-farms',2);await p.locator('.cp-guide-zoom-tools [data-hole-plan]').waitFor();
  for(const width of [320,393]){
   await p.setViewportSize({width,height:852});
   const full=await p.locator('[data-guide-zoom=full]').boundingBox(),plan=await p.locator('.cp-guide-zoom-tools [data-hole-plan]').boundingBox();
   assert.ok(Math.abs(full.y-plan.y)<2,'same guide row');
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  }
  await p.locator('[data-guide-zoom=in]').click();
  await p.locator('.cp-guide-zoom-tools [data-hole-plan]').click();
  await p.locator('#cp-hole-plan-dialog[open]').waitFor();
  assert.match(await p.locator('#cp-hole-plan-title').innerText(),/Hole 2/);
  const research=baseline.briefings.find(b=>!b.date&&b.course==='Sterling Farms Golf Course').holes.find(h=>h.n===2);
  assert.ok((await p.locator('#cp-hole-plan-dialog').innerText()).includes(research.play.replace(/\*/g,'')));
  await p.keyboard.press('Escape');await p.locator('#cp-hole-plan-dialog').waitFor({state:'detached'});assert.equal(await p.locator('#cp-hole-plan-dialog').count(),0);
  assert.equal(await p.locator('.cp-guide-zoom-tools output').innerText(),'120%');
  await p.locator('[data-cp=mode][data-mode=map]').click();
  assert.equal(await p.locator('.cp-map-views .cp-simple-view').count(),0);
  await p.locator('.cp-map-views [data-hole-plan]').click();await p.locator('#cp-hole-plan-dialog[open]').waitFor();
  await p.locator('[aria-label="Close hole plan"]').click();await p.locator('#cp-hole-plan-dialog').waitFor({state:'detached'});
  await p.locator('[data-cp=next]').click();await p.locator('.cp-map-views [data-hole-plan]').click();
  assert.match(await p.locator('#cp-hole-plan-title').innerText(),/Hole 3/);
  await p.keyboard.press('Escape');await p.locator('#cp-hole-plan-dialog').waitFor({state:'detached'});
  await open('metedeconk',19);await p.locator('.cp-guide-zoom-tools [data-hole-plan]').click();
  assert.match(await p.locator('#cp-hole-plan-title').innerText(),/Hole 19/);
  assert.match(await p.locator('#cp-hole-plan-dialog').innerText(),/No standing plan/);
  await p.keyboard.press('Escape');await p.locator('#cp-hole-plan-dialog').waitFor({state:'detached'});
  await p.evaluate(()=>CaddieCoursePrep.openGuide('wianno',4));
  await p.locator('#cp-live-guide .cp-guide-zoom-tools [data-hole-plan]').click();
  assert.match(await p.locator('#cp-hole-plan-title').innerText(),/Hole 4/);
  await p.keyboard.press('Escape');await p.locator('#cp-hole-plan-dialog').waitFor({state:'detached'});
  assert.equal(await p.locator('#cp-live-guide[open]').count(),1,'plan popup preserves underlying live guide');
  await p.locator('#cp-live-guide header button').click();
  assert.deepEqual(await state(p),baseline,'reading plans leaves all golf state unchanged');
  console.log('PASS guide/map plan buttons, narrow row, exact hole advice, close/Escape, preserved zoom and golf state, hole 19 empty state');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1)});
