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
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('caddiehq_v1')||'{}').feedApplied?.includes('bay-20260922-range-184605-batch1'));
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('caddiehq_v1')||'{}').feedApplied?.includes('bag-ping-g440-history-20261001'));
  await page.locator('.baynums').click();
  const five=page.locator('.cum-club').filter({has:page.locator('[data-action="club-history"][data-club="5W"]')});
  await five.locator('summary').click();
  await five.locator('[data-action="club-history"]').click();
  await page.locator('#pageTitle').filter({hasText:'Club history'}).waitFor();
  assert.equal(await page.locator('.swing-evo-club').count(),1);
  assert.equal(await page.locator('.swing-evo-club').getAttribute('data-club'),'5W');
  assert.ok(await page.locator('.swing-evo-record').count()>3);
  assert.ok(await page.locator('.club-trend').count()>8);
  assert.ok(await page.locator('.swing-evo-record').first().isVisible());
  assert.ok(await page.locator('.swing-evo-record').last().isVisible());
  for(const width of [320,390,1440]){
    await page.setViewportSize({width,height:900});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page overflow '+width);
    assert.ok(await page.locator('.swing-evo-metrics').evaluateAll(xs=>xs.every(x=>x.scrollWidth<=x.clientWidth)),'metric overflow');
    await page.screenshot({path:'/tmp/club-history-'+width+'.png'});
  }
  await page.locator('.backlink').click();
  await page.locator('#cum-bag').waitFor();
  const driver=page.locator('.cum-club').filter({has:page.locator('[data-action="club-history"][data-club="Dr"]')});
  if(!await driver.evaluate(x=>x.open)) await driver.locator('summary').click();
  await driver.locator('[data-action="club-history"]').click();
  assert.equal(await page.locator('.swing-evo-club').getAttribute('data-club'),'Dr');
  await page.locator('.club-trend-row').first().click();
  assert.equal(await page.locator('.swing-evolution').count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS club history: 320/390/1440, isolated club, complete batches, metric trends, back and source navigation, no page errors.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exit(1);});
