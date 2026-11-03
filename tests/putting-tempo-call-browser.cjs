'use strict';
// v274: Jack's Nov 3 call — putting tempo of record is 1.79:1. The putting grid's Tempo row
// reads 1.79, the other six rows are unchanged, and the lab fits 320/390 with no sideways scroll.
const assert=require('node:assert/strict');
const {server,chromium,state,ready}=require('./course-prep-browser.cjs');
const EV='evolution-tempo-call-20261103', SU='s20-putter-shootout-tempo-call-20261103';
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CADDIE_CHROMIUM||undefined,args:['--no-sandbox']});
 try{
 for(const [width,height] of [[320,568],[390,844]]){
  const ctx=await browser.newContext({viewport:{width,height},serviceWorkers:'block'}),p=await ctx.newPage(),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:'+server.address().port);await ready(p);
  await p.waitForFunction(ids=>{const a=JSON.parse(localStorage.getItem('caddiehq_v1')||'{}').feedApplied||[];return ids.every(i=>a.includes(i));},[EV,SU]);
  const st=await state(p);
  const g=st.grids.putting, t=g.metrics.find(m=>m.name==='Tempo / load');
  assert.equal(t.state,'1.79:1 · your call');
  assert.equal(g.metrics.length,7,'all seven rows kept');
  assert.equal(g.sessions.length,4,'same four columns');
  const s=st.sessions.find(x=>x._fid==='s20-putter-shootout-20261030');
  assert.ok(!/Jack's call\./.test(s.finding),'shootout no longer says unresolved');
  assert.ok(s.detail.metrics.find(m=>m.k==='Tempo back:through').n.includes('1.79:1'));
  assert.ok(s.detail.paths && s.detail.shootout,'chart + paths survive the update');
  await p.locator('#nav button[data-view="game"]').click();
  await p.locator('.labsel[data-disc="putting"]').click();
  const txt=await p.locator('#view').evaluate(el=>el.textContent);
  assert.ok(txt.includes('1.79:1 · your call'),'grid row visible in the lab');
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
  if(width===390) await p.screenshot({path:'/tmp/tempo-390.png',fullPage:false});
  assert.deepEqual(errors,[]);
  console.log('PASS putting tempo call',JSON.stringify({width,height}));await ctx.close();
 }
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
