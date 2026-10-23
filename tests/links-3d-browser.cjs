// Real browser checks for the perspective renderer, touch input and offline shell.
'use strict';
const assert=require('node:assert/strict');
const {server,chromium,state,ready}=require('./course-prep-browser.cjs');
const args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'];
const debug=p=>p.evaluate(()=>{const d=CaddieLinks.debug();delete d.drawMs;return d;});
async function enter(p,course){
 await p.locator('[data-action="open-links"]').first().click();
 if(course)await p.locator('#lk-courses [data-id="'+course+'"]').click();
 await p.locator('#lk-start').click();await p.locator('#lk-game').waitFor({state:'visible'});
 await p.waitForFunction(()=>CaddieLinks.debug()?.phase==='aim');
}
async function pull(p,fraction=1){
 const b=await p.locator('#lk-instr').boundingBox(),x=b.x+b.width*.8,y=b.y+b.height/2;
 await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(x-Math.min(145,b.width*.45)*fraction,y,{steps:15});await p.waitForTimeout(140);await p.mouse.up();
}
async function within(p,selector,width,height){const b=await p.locator(selector).boundingBox();assert.ok(b&&b.x>=0&&b.y>=0&&b.x+b.width<=width+.5&&b.y+b.height<=height+.5,selector+': '+JSON.stringify(b));}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:process.env.CADDIE_CHROMIUM||'/tmp/chromium',args});
 try{
  for(const [width,height,inset] of [[320,568,0],[390,844,0],[390,844,59]]){
   const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,serviceWorkers:'block'}),p=await ctx.newPage(),errors=[];
   p.on('pageerror',e=>errors.push(e.message));await p.goto(url);await ready(p);
   if(inset)await p.addStyleTag({content:`body.lk-ingame{padding-top:${inset+8}px!important}`});
   const before=await state(p);await enter(p);await p.waitForTimeout(300);
   let d=await debug(p);assert.equal(d.renderer,'3d');assert.ok(d.scene.calls<45&&d.scene.triangles<100000,'bounded renderer');
   assert.ok(d.ball[1]>200,'ball is close to the player');
   for(const selector of ['#lk-quit','#lk-instr','#lk-clubsummary','#lk-shapesummary'])await within(p,selector,width,height);
   assert.ok((await p.locator('#lk-quit').boundingBox()).y>=inset+8);
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
   await p.locator('#lk-plan').click();await p.locator('#cp-hole-plan-dialog').waitFor({state:'visible'});assert.match(await p.locator('#cp-hole-plan-title').innerText(),/Hole 1/);await p.locator('[aria-label="Close hole plan"]').click();assert.equal(await p.locator('#lk-plan').evaluate(el=>document.activeElement===el),true);
   await p.locator('#lk-score-toggle').focus();await p.keyboard.press('Enter');assert.equal(await p.locator('#lk-gcard').isVisible(),true);await p.keyboard.press('Enter');
   await p.locator('#lk-clubsummary').click();await within(p,'#lk-clubs',width,height);await p.locator('#lk-clubs [data-c="7i"]').click();assert.match(await p.locator('#lk-clubsummary').innerText(),/7i/);assert.equal(await p.locator('#lk-clubbox').getAttribute('open'),null);
   await p.locator('#lk-shapesummary').click();await p.locator('#lk-trajseg [data-t="-1"]').click();await p.locator('#lk-shape').fill('-1');await p.locator('#lk-shapesummary').click();assert.match(await p.locator('#lk-shapesummary').innerText(),/Low.*Draw/);
   const aim=(await debug(p)).aim,stage=await p.locator('#lk-cv').boundingBox();
   await p.mouse.click(stage.x+stage.width*.63,stage.y+stage.height*.53);await p.waitForTimeout(200);
   assert.notDeepEqual((await debug(p)).aim,aim,'tap changes the perspective target');
   const beforeMap=await debug(p);await p.locator('#lk-camtog').click();assert.equal((await debug(p)).renderer,'map');await p.locator('#lk-camtog').click();assert.equal((await debug(p)).renderer,'3d');assert.deepEqual((await debug(p)).worldBall,beforeMap.worldBall,'camera toggle cannot move the ball');
   await pull(p,.8);await p.waitForFunction(()=>CaddieLinks.debug()?.anim?.trail>2);
   d=await debug(p);assert.equal(d.strokes,1);assert.equal(d.phase,'flight');assert.equal(d.renderer,'3d');assert.ok(d.scene.camera[1]>8,'camera follows the rising ball');assert.equal(await p.locator('#lk-flight-readout').isVisible(),true);
   if(width===390&&!inset)await p.screenshot({path:'/tmp/links-flight.png'});
   await p.locator('#lk-skip').click();await p.waitForFunction(()=>CaddieLinks.debug()?.phase!=='flight');
   d=await debug(p);assert.equal(d.strokes,1);assert.notDeepEqual(d.worldBall,beforeMap.worldBall,'shot lands at a new position');
   assert.equal(d.anim,null);assert.equal(await p.locator('#lk-instr').isVisible(),true);
   await p.locator('#lk-quit').focus();await p.keyboard.press('Enter');assert.equal(await p.locator('#view').getAttribute('data-page'),'home');assert.deepEqual(await state(p),before,'golf records preserved');
   await enter(p);await p.locator('#lk-instr').focus();await p.keyboard.press('Enter');assert.equal((await debug(p)).strokes,1,'keyboard swing is not swallowed');await p.locator('#lk-quit').click();await p.waitForTimeout(300);assert.deepEqual(errors,[]);assert.deepEqual(await state(p),before);
   console.log('PASS perspective / input / layout / flight / exit',JSON.stringify({width,height,inset}));await ctx.close();
  }
  // Touch, reduced motion and Night mode through a complete scored hole.
  const touch=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce',serviceWorkers:'block'}),tp=await touch.newPage(),te=[];
  tp.on('pageerror',e=>te.push(e.message));await tp.goto(url);await ready(tp);await tp.locator('[data-action="toggle-theme"]').first().click();const saved=await state(tp);await tp.evaluate(()=>Math.random=()=>1);await enter(tp);
  const colors=await tp.evaluate(()=>({body:getComputedStyle(document.body).backgroundColor,ink:getComputedStyle(document.querySelector('#lk-quit')).color}));assert.notEqual(colors.body,colors.ink);
  const session=await touch.newCDPSession(tp);let putted=false;
  for(let i=0;i<9;i++){
   await tp.waitForFunction(()=>['aim','done'].includes(CaddieLinks.debug()?.phase));const d=await debug(tp);
   if(d.phase==='done'){assert.ok(d.scores[0]>0);await tp.locator('#lk-act').click();assert.equal((await debug(tp)).hole,2);break;}
   const remaining=Math.hypot(d.pin[0]-d.worldBall[0],d.pin[1]-d.worldBall[1]);let fraction=1;
   if(d.lie==='green'){putted=true;assert.equal(d.renderer,'map','putting keeps the close slope view');}
   else {const carry=Number((await tp.locator('#lk-clubsummary small').innerText()).match(/\d+/)[0]);fraction=Math.min(1,remaining/carry);}
   const b=await tp.locator('#lk-instr').boundingBox(),x=b.x+b.width*.8,y=b.y+b.height/2;
   const point=(x,y)=>[{x,y,id:1,radiusX:5,radiusY:5,force:1}];
   await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:point(x,y)});
   for(let j=1;j<=8;j++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:point(x-Math.min(145,b.width*.45)*fraction*j/8,y)});
   await tp.waitForTimeout(150);await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   await tp.waitForFunction(n=>CaddieLinks.debug()?.strokes>n,d.strokes);await tp.waitForTimeout(950);
  }
  assert.ok(putted,'reached and played the putting view');assert.equal((await debug(tp)).hole,2,'completed a scored hole and advanced');
  await tp.locator('#lk-quit').click();assert.deepEqual(await state(tp),saved);assert.deepEqual(te,[]);console.log('PASS touch / Night / reduced motion / putting / next hole');await touch.close();
  // No WebGL at initial load is a supported playable path, not a blank canvas.
  const no=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),np=await no.newPage(),ne=[];
  np.on('pageerror',e=>ne.push(e.message));await np.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:get.call(this,type,...args);};});
  await np.goto(url);await ready(np);await enter(np);assert.equal((await debug(np)).renderer,'map');await pull(np);assert.equal((await debug(np)).strokes,1);await np.locator('#lk-quit').click();assert.deepEqual(ne,[]);console.log('PASS initial WebGL unavailable fallback');await no.close();
  // Simulate actual WebGL context loss, then finish a shot through the map fallback.
  const c=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(url);await ready(p);await enter(p,'wianno');assert.equal((await debug(p)).course,'wianno');assert.equal((await debug(p)).renderer,'3d');
  await p.evaluate(()=>document.querySelector('#lk-cv3').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());await p.waitForFunction(()=>CaddieLinks.debug()?.renderer==='map');await pull(p);assert.equal((await debug(p)).strokes,1);await p.locator('#lk-skip').click();await p.locator('#lk-quit').click();assert.deepEqual(errors,[]);console.log('PASS second course and context-loss fallback');await c.close();
  // Fresh installed shell: load a course once, then cold-start the game offline.
  const off=await browser.newContext({viewport:{width:390,height:844}}),op=await off.newPage(),oe=[];op.on('pageerror',e=>oe.push(e.message));await op.goto(url);await ready(op);await op.evaluate(()=>navigator.serviceWorker.ready);await op.reload();await ready(op);await enter(op);
  const assets=await op.evaluate(async()=>{const c=await caches.open('caddiehq-v257');return(await c.keys()).map(r=>new URL(r.url).pathname);});for(const f of ['links-scene.js','vendor/three-r186.js','assets/links/oak.webp'])assert.ok(assets.includes('/'+f),'precache '+f);
  await off.setOffline(true);await op.reload();await ready(op);await enter(op);assert.equal((await debug(op)).renderer,'3d','cold 3D module/texture load works offline');await pull(op);assert.equal((await debug(op)).strokes,1);await op.locator('#lk-quit').click();assert.deepEqual(oe,[]);console.log('PASS cold offline 3D game');await off.close();
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
