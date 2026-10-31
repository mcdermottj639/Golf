'use strict';
// v271: a club's Bag note is scannable — fact tiles + one line, the full history folded
// under "Full notes" and split into short paragraphs. Nothing in the note is dropped.
const assert=require('node:assert/strict');
const {server,chromium,state,ready}=require('./course-prep-browser.cjs');
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CADDIE_CHROMIUM||undefined,args:['--no-sandbox']});
 try{
 for(const [width,height] of [[320,568],[390,844]]){
  const ctx=await browser.newContext({viewport:{width,height},serviceWorkers:'block'}),p=await ctx.newPage(),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:'+server.address().port);await ready(p);
  await p.waitForFunction(()=>JSON.parse(localStorage.getItem('caddiehq_v1')||'{}').feedApplied?.includes('link21-note-scan-20261031'));
  const st=await state(p);const link=st.clubs.find(c=>/LINK\.2\.1/.test(c.name));
  await p.locator('#nav button[data-view="bag"]').click();
  const item=p.locator('details.bag-item',{hasText:'LINK.2.1'}).first();
  await item.scrollIntoViewIfNeeded();await item.locator('summary').first().click();
  const det=item.locator('.bag-detail');
  assert.equal(await det.locator('.clubkeys .ck').count(),4,'four fact tiles');
  const more=det.locator('details.more');assert.equal(await more.count(),1,'history folded');
  assert.equal(await more.evaluate(e=>e.open),false,'folded by default');
  const visible=(await det.innerText()).length;console.log('visible chars',visible);
  assert.ok(visible<900,'no wall of text before opening');
  await more.locator('summary').click();
  const paras=await more.locator('p').count();assert.ok(paras>=4,'split into paragraphs: '+paras);
  const full=(await more.innerText()).replace(/\s+/g,' ');
  assert.ok(full.includes('STILL UNKNOWN')&&full.includes('shop with a scale'),'note intact');
  assert.equal((await state(p)).clubs.find(c=>c.id===link.id).note,link.note,'note unchanged');
  for(const t of await det.locator('.clubkeys .ck').all()) assert.ok(await t.evaluate(e=>e.scrollWidth<=e.clientWidth+1),'tile fits');
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no sideways scroll');
  assert.deepEqual(errors,[]);
  if(width===320){await more.locator('summary').click();await item.screenshot({path:'/tmp/link320.png'});}
  console.log('PASS club notes',width);await ctx.close();
 }
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1)});
