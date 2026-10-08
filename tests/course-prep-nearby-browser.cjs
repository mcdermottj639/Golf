'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {server,chromium,ready}=require('./course-prep-browser.cjs');
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:fs.existsSync('/tmp/chromium')?'/tmp/chromium':undefined,args:['--no-sandbox']});
 try {
  const p=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
  await p.goto('http://127.0.0.1:'+server.address().port);await ready(p);
  const open=async()=>{await p.locator('#nav [data-view="rounds"]').click();await p.locator('[data-action="open-course-prep"]:not([data-course])').click();await p.locator('#cp-courses').waitFor();};
  await p.evaluate(()=>{const s=JSON.parse(localStorage.caddiehq_v1);s.here=null;localStorage.caddiehq_v1=JSON.stringify(s);});await p.reload();await ready(p);await p.reload();await ready(p);await open();assert.equal(await p.locator('#cp-courses').inputValue(),'pound-ridge');
  for(const id of ['wianno','sterling-farms','metedeconk']){
   await p.evaluate(id=>{const c=CADDIE_PREP_COURSES.find(c=>c.id===id);const s=JSON.parse(localStorage.caddiehq_v1);s.here={lat:c.center[0],lon:c.center[1],ts:Date.now()};localStorage.caddiehq_v1=JSON.stringify(s);},id);
   await p.reload();await ready(p);await open();assert.equal(await p.locator('#cp-courses').inputValue(),id);assert.equal(await p.locator('#cp-courses option').first().getAttribute('value'),id);
  }
  await p.locator('#cp-courses').selectOption('pound-ridge');
  assert.equal(await p.locator('#cp-courses').inputValue(),'pound-ridge');
  await p.evaluate(()=>{navigator.geolocation.getCurrentPosition=success=>success({coords:{latitude:41.176,longitude:-73.571}});});
  await p.locator('[data-cp="nearby"]').click();assert.equal(await p.locator('#cp-courses').inputValue(),'pound-ridge');
  await p.evaluate(()=>{const b=document.createElement('button');b.dataset.action='open-course-prep';b.dataset.course='wianno';b.dataset.n='2';document.body.append(b);b.click();b.remove();});
  assert.equal(await p.locator('#cp-courses').inputValue(),'wianno');
  assert.equal(await p.evaluate(()=>getComputedStyle(document.body).touchAction),'manipulation');
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await p.screenshot({path:'/tmp/caddie-nearby.png'});
  console.log('PASS nearest-course entry, sorting, manual selection, location refresh, explicit links, touch policy and mobile width');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
