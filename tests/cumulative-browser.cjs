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

  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('caddiehq_v1')||'{}').feedApplied?.includes('bay-20260922-range-184605-batch1'));
  await page.locator('[data-action="session-category"][data-kind="cumulative"]').first().click();
  await page.locator('#cum-plan').waitFor();
  assert.ok(await page.locator('.cum-club').count()>5);
  for(const width of [320,390]){
    await page.setViewportSize({width,height:844});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page overflow '+width);
    await page.locator('.cum-club summary').first().click();
    assert.ok(await page.locator('.cum-history').count()>0);
    assert.ok(await page.locator('.cum-club').evaluateAll(xs=>xs.every(x=>x.scrollWidth<=x.clientWidth)),'club overflow');
    await page.locator('.cum-club summary').first().click();
  }
  await page.locator('#cum-bag').screenshot({path:'/tmp/cumulative-v163.png'});
  await page.locator('#cum-plan [data-action="open-bay"]').click();
  assert.equal(await page.locator('#cum-plan').count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS cumulative: 320/390, expandable histories, baseline navigation, no page errors.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exit(1);});
