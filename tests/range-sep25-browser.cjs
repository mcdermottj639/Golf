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
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('caddiehq_v1')||'{}').feedApplied?.includes('bay-20260925-4i-visible-v1'));
  const idx=await page.evaluate(()=>JSON.parse(localStorage.getItem('caddiehq_v1')).bays.findIndex(b=>b._fid==='bay-20260925-4i-visible-v1'));
  await page.locator('[data-action="session-category"][data-kind="days"]').first().click();
  await page.locator(`[data-action="open-bay"][data-i="${idx}"]`).first().click();
  assert.equal(await page.locator('.range-evidence-club').count(),3);
  const flight=page.locator('[data-bay-insight="Flight window-club-58°"]');
  assert.match(await flight.locator('.bt-reference').innerText(),/No matching/);
  assert.match(await flight.locator('.bt-meaning').innerText(),/34.4°/);
  assert.match(await flight.locator('.bt-meaning').innerText(),/one shot/);
  const exact=await page.locator('.bay-clubs').innerText();
  for(const value of ['147.2','181.2','185.1','75.2','APEX FT'])assert.ok(exact.includes(value),value);
  for(const width of [320,390]){
    await page.setViewportSize({width,height:844});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page overflow '+width);
  }
  await flight.screenshot({path:'/tmp/caddie-v179-wedge.png'});
  await page.screenshot({path:'/tmp/caddie-sep25.png',fullPage:true});
  assert.deepEqual(errors,[]);console.log('PASS Sep25 real browser: three-club day, exact values, heights, 320/390 no overflow/errors.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exit(1);});
