const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright':'playwright');
const root=path.join(__dirname,'..');
const server=http.createServer((q,r)=>{const file=path.join(root,q.url.split('?')[0]==='/'?'index.html':q.url.split('?')[0]);if(!file.startsWith(root+path.sep)){r.writeHead(403).end();return;}fs.readFile(file,(err,data)=>{r.writeHead(err?404:200,{'Content-Type':({'.js':'text/javascript','.json':'application/json','.css':'text/css','.html':'text/html'})[path.extname(file)]||'application/octet-stream'});r.end(err?'':data);});});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const executablePath=process.env.CADDIE_CHROMIUM;
 const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{}),args:['--no-sandbox']});
 const qa=process.env.CADDIE_QA_DIR||'/tmp/caddie-v292-review';fs.mkdirSync(qa,{recursive:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('caddiehq_v1')||'{}').feedApplied?.includes('bay-20261114-club-first-v1'));
  const idx=await page.evaluate(()=>JSON.parse(localStorage.getItem('caddiehq_v1')).bays.findIndex(b=>b._fid==='bay-20261114-club-first-v1'));
  await page.locator('[data-action="session-category"][data-kind="days"]').first().click();
  await page.locator(`[data-action="open-bay"][data-i="${idx}"]`).first().click();
  const review=page.locator('.bay-session-review');
  assert.match(await review.innerText(),/160.0 → 148.7/);assert.match(await review.innerText(),/122.5 → 136.1/);
  assert.match(await review.innerText(),/All irons: old KING Forged/);
  assert.equal(await page.locator('.range-evidence-club').count(),6);
  assert.match(await page.locator('.bay-takeaways>p').first().innerText(),/56 usable shots/);
  for(const width of [320,390]){
   await page.setViewportSize({width,height:844});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'day overflow '+width);
   assert.ok(await review.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'review overflow '+width);
  }
  await review.screenshot({path:path.join(qa,'nov14-review.png')});
  await page.locator('#nav [data-view="bag"]').click();
  await page.evaluate(()=>localStorage.setItem('caddiehq_compare_v1',JSON.stringify({src:'latest',clubs:['4i [KING Forged] · before cue','4i [KING Forged] · club first','7i [KING Forged] · before cue','7i [KING Forged] · club first']})));
  await page.reload();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('caddiehq_v1')||'{}').feedApplied?.includes('bay-20261114-club-first-v1'));
  await page.locator('#nav [data-view="bag"]').click();
  const cmp=page.locator('.cmp-card');
  if(!await cmp.locator('.cmp-table').isVisible())await cmp.locator('summary').first().click();
  assert.equal(await cmp.locator('.cmp-table thead th').count(),5);
  assert.match(await cmp.innerText(),/KING Forged/);
  for(const width of [320,390]){
   await page.setViewportSize({width,height:844});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Compare overflow '+width);
  }
  await cmp.screenshot({path:path.join(qa,'nov14-compare.png')});
  assert.ok(await cmp.locator('.cmp-table').evaluate(el=>el.scrollWidth<=el.parentElement.clientWidth+1),'four equipment/cue columns fit inside Compare');
  const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('caddiehq_v1')));
  assert.equal(state.carries.find(c=>c.club==='Mini Driver').carry,201);
  assert.equal(state.carries.find(c=>c.club==='4-hybrid').carry,178);
  assert.equal(state.clubs.find(c=>c.id==='bag-kingtec-4i-bench-20261001').status,'backup');
  const plan=state.briefings.find(b=>b.course==='Swing Thoughts — Club by Club');
  assert.match(JSON.stringify(plan),/CLUB FIRST/);assert.match(JSON.stringify(plan),/old KING Forged/);
  assert.deepEqual(errors,[]);
  console.log('PASS Nov14 real Chromium: corrected day, six separate equipment/cue groups, comparison cards, Compare selector/table, Swing Thoughts saved, 320/390 no overflow or page errors.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exit(1)});
