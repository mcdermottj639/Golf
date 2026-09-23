const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
const root=path.join(__dirname,'..');
const server=http.createServer((q,r)=>{const file=path.join(root,q.url.split('?')[0]==='/'?'index.html':q.url.split('?')[0]);if(!file.startsWith(root+path.sep)){r.writeHead(403).end();return;}fs.readFile(file,(err,data)=>{r.writeHead(err?404:200,{'Content-Type':({'.js':'text/javascript','.json':'application/json','.css':'text/css','.html':'text/html'})[path.extname(file)]||'application/octet-stream'});r.end(err?'':data);});});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,...(process.env.CADDIE_CHROMIUM?{executablePath:process.env.CADDIE_CHROMIUM}:{}),args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('caddiehq_v1')||'{}').feedApplied?.includes('bay-20260922-wood-peak-heights-20260923'));
  const idx=await page.evaluate(()=>JSON.parse(localStorage.getItem('caddiehq_v1')).bays.findIndex(b=>b._fid==='bay-20260922-range-184605-batch1'));
  await page.locator('[data-action="session-category"][data-kind="days"]').first().click();
  await page.locator(`[data-action="open-bay"][data-i="${idx}"]`).first().click();
  const cards=page.locator('[data-bay-insight]');assert.ok(await cards.count()>=4&&await cards.count()<=6);
  const summary=await page.locator('.bay-takeaways>p').first().innerText();
  assert.equal(await page.locator('.range-evidence-club[data-club="5-iron"]').count(),1);
  assert.equal(await page.locator('.range-evidence-club[data-club="7-iron"]').count(),1);
  assert.equal(await page.locator('.range-evidence-club').count(),5);
  const exact=await page.locator('.bay-clubs').innerText();
  assert.match(exact,/APEX FT/);
  assert.match(exact,/39\.6 n=7/);
  assert.match(exact,/44\.2 n=5/);
  const three=page.locator('.sect').filter({has:page.locator('summary b', {hasText:'3-wood · 7'})}).last();
  await three.locator('summary').click();
  assert.match(await three.innerText(),/63'11"/);
  const five=page.locator('.sect').filter({has:page.locator('summary b', {hasText:'5-wood · 7'})}).last();
  await five.locator('summary').click();
  assert.match(await five.innerText(),/56'11"/);
  for(const width of [320,390]){
    await page.setViewportSize({width,height:844});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.ok(await cards.evaluateAll(xs=>xs.every(x=>x.scrollWidth<=x.clientWidth)));
    assert.equal(await cards.locator('.bt-meaning').count(),await cards.count());
    assert.ok(await page.locator('.bay-takeaways').evaluate(x=>x.getBoundingClientRect().top<innerHeight));
  }
  await cards.first().screenshot({path:'/tmp/caddie-bay-v162.png'});
  const details=cards.first().locator('details');await details.locator('summary').click();
  const link=details.locator('[data-action="bay-takeaway-source"]').first();const club=await link.getAttribute('data-club');await link.click();
  assert.equal(await page.evaluate(()=>document.activeElement.dataset.club),club);
  assert.equal(await page.locator('.bay-takeaways>p').first().innerText(),summary,'same day full review after following source');
  assert.deepEqual(errors,[]);console.log('PASS mobile: '+summary+'; source link focus, 320/390 layout and all explanation/next-step cards.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exit(1);});
