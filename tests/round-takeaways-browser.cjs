const assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
const root=path.join(__dirname,'..');
const types={'.js':'text/javascript','.css':'text/css','.json':'application/json','.html':'text/html','.svg':'image/svg+xml'};
const server=http.createServer((q,r)=>{
 const url=q.url.split('?')[0],file=path.join(root,url==='/'?'index.html':url);
 if(!file.startsWith(root+path.sep)){r.writeHead(403).end();return;}
 fs.readFile(file,(e,d)=>{r.writeHead(e?404:200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});r.end(e?'':d);});
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,...(process.env.CADDIE_CHROMIUM?{executablePath:process.env.CADDIE_CHROMIUM}:{}),args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('caddiehq_v1')||'{}').rounds?.some(r=>r.course==='Hazeltine National'&&r.review?.profileMode==='selected-label'));
  const rounds=await page.evaluate(()=>JSON.parse(localStorage.getItem('caddiehq_v1')).rounds.map((r,i)=>({i,course:r.course,sim:r.sim,review:!!r.review,scored:r.holes?.some(h=>h.s&&h.par)})));
  const open=async r=>{await page.click('#nav [data-view="rounds"]');await page.locator(`tr[data-action="open-round"][data-i="${r.i}"]`).click();};
  const counts=[];
  for(const r of rounds.filter(r=>r.sim&&r.review)){
   await open(r);
   const count=await page.locator('.rt-card').count();assert.ok(count>0&&count<=6,r.course);counts.push([r.course,count]);
   assert.equal(await page.getByText('Approach evidence is incomplete',{exact:true}).count(),0);
   for(const width of [320,390]){
    await page.setViewportSize({width,height:844});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),r.course+' overflow '+width);
    assert.ok(await page.locator('.rt-card').evaluateAll(xs=>xs.every(x=>x.scrollWidth<=x.clientWidth)),r.course+' card overflow');
   }
   const button=page.locator('.rt-links [data-action="review-hole"]').first();
   const hole=await button.getAttribute('data-hole');await button.click();
   assert.equal(await page.locator(`details[data-review-hole="${hole}"]`).evaluate(x=>x.open),true);
   assert.equal(await page.evaluate(()=>document.activeElement.tagName),'SUMMARY');
   if(r.course==='Hazeltine National')await page.locator('[data-insight="delivery-7-iron"]').screenshot({path:'/tmp/caddie-v160-delivery.png'});
  }
  assert.ok(new Set(counts.map(x=>x[1])).size>1,'sparse records have fewer cards');
  const outdoor=rounds.find(r=>!r.sim&&r.scored);await open(outdoor);
  assert.ok(await page.locator('.rt-card').count()>0,'outdoor scoring takeaways');
  const link=page.locator('.rt-links [data-action="review-hole"]').first();const hole=await link.getAttribute('data-hole');await link.click();
  assert.equal(await page.locator(`tr[data-review-hole="${hole}"]`).evaluate(x=>!!x.closest('details')?.open),true);
  assert.deepEqual(errors,[]);
  console.log('PASS browser: '+JSON.stringify(counts)+'; outdoor takeaways, real hole links/focus, 320/390 card layout and no page errors.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exit(1);});
