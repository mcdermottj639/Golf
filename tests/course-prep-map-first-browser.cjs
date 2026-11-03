'use strict';
// v275 (Jack, Nov 3 2026): prep opens on Hole guide only where the club publishes its own
// illustration; a mapped hole without club art (Lakeside, Wianno…) opens on Interactive map.
// Asserts the pressed mode button, not page text, at 320 and 390, with no sideways scroll.
const assert=require('node:assert/strict');
const {server,chromium,state,ready}=require('./course-prep-browser.cjs');
const pressed=p=>p.locator('[data-cp="mode"][aria-pressed="true"]').first().getAttribute('data-mode');
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CADDIE_CHROMIUM||undefined,args:['--no-sandbox']});
 try{for(const [width,height] of [[320,568],[390,844]]){
  const ctx=await browser.newContext({viewport:{width,height},serviceWorkers:'block'});
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
  const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:'+server.address().port);await ready(p);
  const before=await state(p);
  await p.locator('#nav [data-view="rounds"]').click();await p.locator('[data-action="open-course-prep"]').first().click();
  await p.locator('[data-cp="mode"]').first().waitFor();
  assert.equal(await p.evaluate(()=>CaddieCoursePrep.courseId),'pound-ridge');
  assert.equal(await pressed(p),'guide','Pound Ridge (club art) opens on Hole guide');
  await p.selectOption('#cp-courses','lakeside-penn-yan');
  await p.waitForFunction(()=>CaddieCoursePrep.courseId==='lakeside-penn-yan');
  await p.locator('[data-cp="mode"]').first().waitFor();await p.waitForTimeout(400);
  assert.equal(await pressed(p),'map','Lakeside (no club art) opens on Interactive map');
  assert.ok(await p.locator('[data-cp="mode"][data-mode="guide"]').count()>=1,'guide tab still offered');
  await p.locator('[data-cp="mode"][data-mode="guide"]').first().click();
  assert.equal(await pressed(p),'guide','guide one tap away');
  await p.selectOption('#cp-courses','metedeconk');
  await p.waitForFunction(()=>CaddieCoursePrep.courseId==='metedeconk');await p.waitForTimeout(400);
  assert.equal(await pressed(p),'guide','Metedeconk (club art) opens on Hole guide');
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no sideways scroll');
  assert.deepEqual(await state(p),before,'opening prep never writes golf state');
  assert.deepEqual(errors,[]);
  console.log('PASS map-first without club art',JSON.stringify({width}));await ctx.close();
 }}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
