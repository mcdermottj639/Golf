// Real mobile UI and on-demand cache checks. No live Google imagery certification.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {server,chromium,state,ready,explore,mode}=require('./course-prep-browser.cjs');
const ids=['lakeside-penn-yan','oak-hills-park','richter-park','fairchild-wheeler-black','fairchild-wheeler-red'];
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/';
 const browser=await chromium.launch({headless:true,executablePath:process.env.CADDIE_CHROMIUM||(fs.existsSync('/tmp/chromium')?'/tmp/chromium':undefined),args:['--no-sandbox']});
 const out=process.env.CADDIE_QA_DIR||'/tmp/caddie-expansion-qa';fs.mkdirSync(out,{recursive:true});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),p=await context.newPage(),errors=[],requests=[];p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(r.url().includes('/packs/'))requests.push(r.url());});
  await p.route(/https:\/\/(www\.poundridgegolf\.com\/images\/|cdn\.cybergolf\.com\/images\/|tours\.skyfoxgolf\.com\/storage\/aerials\/)/,r=>r.abort());
  await p.goto(url);await ready(p);const baseline=await state(p);
  assert.ok(!requests.some(r=>ids.some(id=>r.includes(id+'.json'))),'new courses not auto-downloaded');
  await p.locator('#nav [data-view="rounds"]').click();await p.locator('[data-action="open-course-prep"]').first().click();
  for(const id of ids){
   await p.locator('#cp-courses').selectOption(id);await p.locator('.cp-hole-art').waitFor();
   assert.deepEqual(await p.locator('.cp-modes button').allTextContents(),['Hole guide','Interactive map']);
   for(const width of [320,390]){
    await p.setViewportSize({width,height:844});
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no overflow '+id+' '+width);
    await p.locator('.cp-map-panel').screenshot({style:'#nav,.toast{visibility:hidden!important}',path:path.join(out,id+'-'+width+'.png')});
   }
   for(const n of [9,10,18]){
    await p.locator('.cp-holes [data-n="'+n+'"]').click();await p.locator('.cp-hole-art').waitFor();assert.match(await p.locator('.cp-hole-art title').textContent(),new RegExp('hole '+n+' '));
    await mode(p,'map');await p.locator('#cp-route-map').waitFor();assert.match(await p.locator('.cp-hole-heading').innerText(),new RegExp('Hole '+n+'\\b'));await mode(p,'guide');
   }
   if(id==='lakeside-penn-yan')for(const n of [2,6]){await p.locator('.cp-holes [data-n="'+n+'"]').click();await mode(p,'map');assert.match(await p.locator('#cp-map-stage').innerText(),/Map under review/);assert.equal(await p.locator('#cp-route-map').count(),0);}
   const st=await p.evaluate(id=>CaddieCoursePacks.status(id),id);assert.ok(st.available&&st.current&&!st.favorite,id+' cached on demand without favoriting');
  }
  for(const k of ['rounds','carries','clubs','coursePrep','planCalls'])assert.deepEqual((await state(p))[k],baseline[k],'browsing preserves '+k);
  await context.setOffline(true);
  for(const id of ids){await p.locator('#cp-courses').selectOption(id);await p.locator('.cp-hole-art').waitFor();await p.locator('.cp-holes [data-n="10"]').click();await mode(p,'map');await p.locator('#cp-route-map').waitFor();}
  await context.setOffline(false);
  for(const id of ids){
   const c=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/course-prep',id+'.json')));
   await explore(p,'[data-action="live-new"]');await p.locator('#lvCourse').fill(c.name);await p.locator('[data-action="live-start"]').click();await p.locator('[data-action="live-card-play"]').click();
   for(const n of [9,10]){
    await p.locator('[data-action="live-goto"][data-i="'+(n-1)+'"]').click();assert.match(await p.locator('.lvhn').innerText(),new RegExp('Hole '+n+'\\b'));const before=(await state(p)).live;
    await p.locator('[data-action="live-hole-guide"]').click();await p.locator('#cp-live-guide .cp-hole-art').waitFor();assert.match(await p.locator('#cp-guide-title').innerText(),new RegExp('Hole '+n+'\\b'));
    await p.locator('#cp-live-guide [data-live-map]').click();await p.locator('#cp-live-map #cp-route-map').waitFor();assert.match(await p.locator('#cp-guide-title').innerText(),new RegExp('Hole '+n+'\\b'));
    await p.keyboard.press('Escape');await p.locator('#cp-live-map').waitFor({state:'detached'});assert.deepEqual((await state(p)).live,before,'live popup preserves hole and score');
   }
   if(id==='lakeside-penn-yan'){await p.locator('[data-action="live-goto"][data-i="1"]').click();assert.equal(await p.locator('[data-action="live-hole-guide"]').count(),0);assert.equal(await p.locator('[data-action="live-hole-map"]').count(),0);}
   // Disposable test-profile draft only; never touches an installed user's data.
   await p.evaluate(()=>{const s=JSON.parse(localStorage.caddiehq_v1);delete s.live;localStorage.caddiehq_v1=JSON.stringify(s);});await p.reload();await ready(p);
  }
  assert.deepEqual(errors,[]);console.log('PASS expansion browser: 320/390 mobile guides, physical holes 9/10, all five on-demand/offline packs, live guide/map links, explicit Lakeside gaps and preserved golf state.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
