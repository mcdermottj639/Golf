'use strict';
const assert=require('node:assert/strict');
const {server,chromium,state,ready}=require('./course-prep-browser.cjs');
const args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'];
const debug=p=>p.evaluate(()=>{const d=CaddieLinks.debug();delete d.drawMs;return d;});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:process.env.CADDIE_CHROMIUM||'/tmp/chromium',args});
 try{
  for(const [width,height,mode,fallback,touch] of [[320,568,'sling',false,false],[390,844,'sling',false,true],[390,844,'trace',false,false],[390,844,'dial',false,false],[390,844,'sling',true,false]]){
   const c=await browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch,reducedMotion:touch?'reduce':'no-preference',serviceWorkers:'block'}),p=await c.newPage(),errors=[];
   p.on('pageerror',e=>errors.push(e.message));
   if(fallback)await p.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){return t==='webgl2'?null:get.call(this,t,...a);};});
   await p.goto(url);await ready(p);const saved=await state(p);
   if(width===390)await p.addStyleTag({content:'body.lk-ingame{padding-top:67px!important}'});
   await p.locator('[data-action="open-links"]').first().click();await p.locator('#lk-modeseg [data-mode="'+mode+'"]').click();await p.locator('#lk-start').click();
   await p.waitForFunction(()=>CaddieLinks.debug()?.phase==='aim');const before=await debug(p),club=await p.locator('#lk-clubsummary').innerText();
   const button=await p.locator('#lk-landing').boundingBox();assert.ok(button.height>=44&&button.x>=0&&button.x+button.width<=width&&button.y+button.height<=height);
   if(touch)await p.locator('#lk-landing').tap();else await p.locator('#lk-landing').click();
   let d=await debug(p);assert.ok(d.landingView);assert.equal(d.renderer,fallback?'map':'3d');assert.equal(await p.locator('#lk-powerrail').isVisible(),false);
   assert.match(await p.locator('#lk-landing').innerText(),/Back to tee/);assert.deepEqual(d.worldBall,before.worldBall);assert.equal(d.strokes,0);
   const anchor=d.landingView,cam=d.scene?.camera;assert.ok(fallback||cam[1]===55);
   const stage=await p.locator('#lk-cv').boundingBox(),x=stage.x+stage.width*.58,y=stage.y+stage.height*.54;
   if(touch)await p.touchscreen.tap(x,y);else{await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(x-20,y+15,{steps:5});await p.mouse.up();}
   d=await debug(p);assert.notDeepEqual(d.aim,before.aim);assert.deepEqual(d.landingView,anchor);if(!fallback)assert.deepEqual(d.scene.camera,cam,'camera does not chase aim edits');
   const aimed=d.aim;assert.equal(d.strokes,0);await p.locator('#lk-instr').focus();await p.keyboard.press('Enter');assert.equal((await debug(p)).strokes,0,'inspection cannot fire a shot');
   if(width===390&&mode==='sling'&&!fallback)await p.screenshot({path:'/tmp/links-v259-landing.png'});
   await p.locator('#lk-landing').focus();await p.keyboard.press('Enter');d=await debug(p);assert.equal(d.landingView,null);assert.deepEqual(d.aim,aimed);assert.deepEqual(d.worldBall,before.worldBall);assert.equal(await p.locator('#lk-clubsummary').innerText(),club);
   await p.locator('#lk-landing').click();await p.locator('#lk-camtog').click();assert.equal((await debug(p)).landingView,null);assert.equal((await debug(p)).renderer,'map');
   await p.locator('#lk-landing').click();assert.ok((await debug(p)).landingView);await p.locator('#lk-landing').click();
   if(mode==='sling'){
    await p.locator('#lk-powerhandle').focus();await p.keyboard.press('Enter');assert.equal((await debug(p)).strokes,1);if(!touch)await p.locator('#lk-skip').click();else await p.waitForFunction(()=>CaddieLinks.debug()?.phase!=='flight');
    if((await debug(p)).phase==='aim'&&(await debug(p)).lie!=='green'){await p.locator('#lk-landing').click();assert.match(await p.locator('#lk-landing').innerText(),/Back to ball/);await p.locator('#lk-retry').click();assert.equal((await debug(p)).landingView,null);}
   }
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.locator('#lk-quit').click();assert.deepEqual(await state(p),saved);assert.deepEqual(errors,[]);
   console.log('PASS landing aim / fixed camera / return / state',width,mode,fallback?'fallback':'3D',touch?'touch':'mouse');await c.close();
  }
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
