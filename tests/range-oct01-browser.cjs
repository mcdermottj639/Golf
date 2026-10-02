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
  page.on('pageerror',e=>{errors.push(e.message);console.error(e.message)});
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('caddiehq_v1')||'{}').feedApplied?.includes('g440-first-sim-note-20261001-v1'));
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('caddiehq_v1')));
  assert.equal(stored.bays.filter(b=>b.date==='2026-10-01').length,2);
  assert.match(stored.clubs.find(c=>c.name==='PING G440 4H Hybrid').note,/21 usable/);
  await page.locator('.baynums').click();
  const hybrid=page.locator('.cum-club').filter({has:page.locator('[data-action="club-history"][data-club="4H"]')});
  await hybrid.locator('summary').click();
  await hybrid.locator('[data-action="club-history"]').click();
  await page.locator('#pageTitle').filter({hasText:'Club history'}).waitFor();
  assert.equal(await page.locator('.swing-evo-club').getAttribute('data-club'),'4H');
  assert.equal(await page.locator('.swing-evo-record').count(),2);
  assert.ok(await page.locator('.swing-evo-club').innerText().then(x=>x.includes('179.5')));
  for(const width of [320,390,1440]){
    await page.setViewportSize({width,height:900});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page overflow '+width);
    assert.ok(await page.locator('.swing-evo-metrics').evaluateAll(xs=>xs.every(x=>x.scrollWidth<=x.clientWidth)),'metric overflow');
    await page.screenshot({path:'/tmp/oct01-history-'+width+'.png'});
  }
  assert.deepEqual(errors,[]);
  console.log('PASS Oct1 browser: feed loaded, G440 note and two source records, 320/390/1440 widths, no overflow or page errors.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exit(1);});
