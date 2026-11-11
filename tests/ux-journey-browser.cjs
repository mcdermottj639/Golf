#!/usr/bin/env node
'use strict';
// Isolated browser storage only: never open the owner's round store or save a score.
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
  ?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright':'playwright');
const root=path.resolve(__dirname,'..');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json',
 '.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg'};
const server=http.createServer((req,res)=>{
 const route=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const file=path.resolve(root,'.'+(route==='/'?'/index.html':route));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(err?'':data);});
});
const qa=process.env.CADDIE_QA_DIR||'/tmp/caddie-v290-ux';
const snapshot=page=>page.evaluate(()=>{
 const s=JSON.parse(localStorage.getItem('caddiehq_v1')||'{}');
 return JSON.stringify({rounds:s.rounds,clubs:s.clubs,carries:s.carries,coursePrep:s.coursePrep,planCalls:s.planCalls});
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const executablePath=process.env.CADDIE_CHROMIUM||(fs.existsSync('/tmp/chromium')?'/tmp/chromium':undefined);
 const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{}),args:['--no-sandbox']});
 fs.mkdirSync(qa,{recursive:true});
 try{
  for(const width of [320,390,1280]){
   const context=await browser.newContext({viewport:{width,height:width<500?844:900},serviceWorkers:'block'});
   const p=await context.newPage(),errors=[];p.setDefaultTimeout(20000);
   p.on('pageerror',err=>errors.push(err.message));
   await p.goto('http://127.0.0.1:'+server.address().port+'/');
   await p.locator('#nav [data-view="rounds"]').click();
   await p.locator('.hq-journey [data-step="course"]').click();
   assert.equal(await p.locator('#view').getAttribute('data-page'),'rounds');
   assert.ok(await p.locator('.hq-journey [aria-current="step"]').count());
   const before=await snapshot(p);
   await p.locator('.hq-journey [data-step="guide"]').click();
   await p.locator('#course-prep').waitFor();
   await p.locator('.cp-arrows [data-cp="next"]').click();
   assert.match(await p.locator('.cp-hole-heading h3').innerText(),/^Hole 2/);
   const remembered=await p.evaluate(()=>JSON.parse(sessionStorage.getItem('caddiehq_course_prep_view_v1')));
   assert.equal(remembered.hole,2,'course+hole remembered in UI-only session key');
   assert.deepEqual(Object.keys(remembered).sort(),['courseId','hole','mode']);
   const pageWidth=await p.evaluate(()=>({content:document.documentElement.scrollWidth,viewport:innerWidth}));
   assert.ok(pageWidth.content<=pageWidth.viewport+1,'no horizontal overflow at '+width);
   const steps=await p.locator('.hq-journey-steps button').count();assert.equal(steps,5);
   const minHeight=await p.locator('.hq-journey-steps button').first().evaluate(el=>el.getBoundingClientRect().height);
   assert.ok(minHeight>=43,'usable touch target at '+width);
   await p.screenshot({path:qa+'/guide-'+width+'.png'});
   await p.goBack();await p.waitForFunction(()=>document.querySelector('#view')?.dataset.page==='rounds');
   await p.goForward();await p.waitForFunction(()=>document.querySelector('#view')?.dataset.page==='courseprep');
   await p.reload();await p.locator('#course-prep').waitFor();
   assert.match(await p.locator('.cp-hole-heading h3').innerText(),/^Hole 2/,'reload restores course/hole at '+width);
   const downloads=p.locator('#cp-downloads');
   if(await downloads.count()){await downloads.locator('summary').click();assert.equal(await downloads.getAttribute('open'),'');}
   await p.locator('.themebtn').click();
   assert.ok(await p.locator('body.night').count(),'theme can be toggled at '+width);
   await p.screenshot({path:qa+'/night-'+width+'.png'});
   assert.equal(await snapshot(p),before,'navigation does not change saved golf records at '+width);
   assert.deepEqual(errors,[],'no browser script errors at '+width);
   await context.close();
  }
  // Separate offline-smoke context: service-worker shell cache is intentionally isolated.
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'allow'});
  const page=await context.newPage();page.setDefaultTimeout(30000);
  await page.goto('http://127.0.0.1:'+server.address().port+'/');
  await page.waitForFunction(()=>!!navigator.serviceWorker?.controller);
  await page.waitForFunction(()=>caches.keys().then(keys=>keys.includes('caddiehq-v290')));
  assert.equal(await page.evaluate(()=>caches.match('./ux-journey.css').then(Boolean)),true);
  await context.setOffline(true);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#nav [data-view="rounds"]').click();
  await page.locator('.hq-journey [data-step="course"]').waitFor();
  await page.screenshot({path:qa+'/offline-390.png'});
  await context.close();
  console.log('PASS Caddie UX browser: 320/390/1280, route Back/Forward/refresh, hole memory, light/night, details, offline shell; no round writes.');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
