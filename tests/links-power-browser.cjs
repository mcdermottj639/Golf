'use strict';
const assert=require('node:assert/strict');
const {server,chromium,state,ready}=require('./course-prep-browser.cjs');
const args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'];
const debug=p=>p.evaluate(()=>{const d=CaddieLinks.debug();delete d.drawMs;return d;});
async function enter(p,daily=false){await p.locator('[data-action="open-links"]').first().click();await p.locator(daily?'#lk-daily':'#lk-start').click();await p.waitForFunction(()=>CaddieLinks.debug()?.phase==='aim');}
async function load(p,power=1){
 const b=await p.locator('#lk-powerhandle').boundingBox(),track=await p.locator('.lk-powertrack').boundingBox();
 const x=b.x+22,y=b.y+22,end=y+(track.height-44)*power/1.1;
 assert.ok(end+22<=track.y+track.height+.5,'whole grip remains in track at full power');
 await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(x,end,{steps:12});return{x,y:end};
}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:process.env.CADDIE_CHROMIUM||'/tmp/chromium',args});
 try{
  for(const [width,height,inset] of [[320,568,0],[390,844,59],[430,932,0]]){
   const c=await browser.newContext({viewport:{width,height},serviceWorkers:'block'}),p=await c.newPage(),errors=[];
   p.on('pageerror',e=>errors.push(e.message));await p.goto(url);await ready(p);
   if(inset)await p.addStyleTag({content:`body.lk-ingame{padding-top:${inset+8}px!important}`});
   const saved=await state(p);await enter(p);const initial=await debug(p);
   await p.locator('.lk-distance-note summary').click();assert.match(await p.locator('#lk-distance-info').innerText(),/Scorecard: 380 yd.*399 yd/);await p.locator('.lk-distance-note summary').click();
   assert.equal(await p.locator('#lk-retry').isDisabled(),true);
   await load(p,.5);assert.equal(await p.locator('#lk-powerlabel').innerText(),'50%');
   const half=Number((await p.locator('#lk-powercarry').innerText()).match(/\d+/)[0]);assert.ok(half>60&&half<140);
   assert.match(await p.locator('#lk-readout').innerText(),new RegExp('Carry '+half+' yd'));
   // Native pointer cancellation never scores or leaves a loaded club.
   await p.locator('#lk-powerrail').dispatchEvent('pointercancel',{pointerId:1});await p.mouse.up();assert.equal((await debug(p)).strokes,0);
   assert.equal(await p.locator('#lk-powerlabel').innerText(),'Pull down');
   await p.locator('#lk-hand').click();let box=await p.locator('#lk-powerrail').boundingBox();assert.ok(box.x<width/2,'left hand placement');
   const pt=await load(p,1.1);assert.equal(await p.locator('#lk-powerlabel').innerText(),'110%');
   await p.mouse.move(pt.x+80,pt.y);assert.equal(await p.locator('#lk-powerhint').innerText(),'Release to cancel');await p.mouse.up();assert.equal((await debug(p)).strokes,0);
   await p.locator('#lk-hand').click();box=await p.locator('#lk-powerrail').boundingBox();assert.ok(box.x>width/2,'right hand placement');
   await load(p,1);assert.deepEqual((await debug(p)).aim,initial.aim,'loading does not rotate the aim');
   if(width===390)await p.screenshot({path:'/tmp/links-v258-power.png'});
   await p.waitForTimeout(140);await p.mouse.up();assert.equal((await debug(p)).strokes,1);assert.equal(await p.locator('#lk-powerrail').isVisible(),false);
   await p.locator('#lk-skip').click();await p.waitForFunction(()=>CaddieLinks.debug()?.phase!=='flight');
   assert.equal(await p.locator('#lk-retry').isEnabled(),true);await p.locator('#lk-retry').click();
   const restored=await debug(p);assert.deepEqual(restored.worldBall,initial.worldBall);assert.equal(restored.strokes,0);assert.deepEqual(restored.scores,initial.scores);assert.match(await p.locator('#lk-shotno').innerText(),/Practice/);
   await p.locator('#lk-clubsummary').click();await p.locator('#lk-clubs [data-c="2i"]').click();
   if(width===390){await p.waitForTimeout(1700);await p.screenshot({path:'/tmp/links-v258-iron.png'});}
   await p.locator('#lk-powerhandle').focus();await p.keyboard.press('Enter');assert.equal((await debug(p)).strokes,1);
   await p.locator('#lk-quit').click();assert.deepEqual(await state(p),saved);
   await enter(p,true);await p.locator('#lk-powerhandle').focus();await p.keyboard.press('Enter');await p.locator('#lk-skip').click();
   assert.equal(await p.locator('#lk-retry').isDisabled(),true,'daily challenge excludes mulligans');
   await p.locator('#lk-quit').click();assert.deepEqual(await state(p),saved);assert.deepEqual(errors,[]);
   console.log('PASS rail bounds / partial power / cancel / hand / replay / daily',width,height,inset);await c.close();
  }
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
