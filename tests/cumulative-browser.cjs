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

  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('caddiehq_v1')||'{}').feedApplied?.includes('round-hazeltine-trackman-recap-20260923-v1'));
  const indoor=page.locator('.indoornums');
  await indoor.waitFor();
  assert.equal(await indoor.locator('.indoor-row').count(),3);
  assert.match(await indoor.innerText(),/HAZELTINE NATIONAL[\s\S]*79%[\s\S]*28%[\s\S]*23%/i);
  const bay=page.locator('.baynums');
  await bay.waitFor();
  assert.match(await bay.innerText(),/THE BAY[\s\S]*USABLE SHOTS[\s\S]*MEAN PATH[\s\S]*FACE.PATH/i);
  for(const width of [320,390]){
    await page.setViewportSize({width,height:844});
    assert.ok(await indoor.evaluate(x=>x.scrollWidth<=x.clientWidth),'Today indoor stats overflow '+width);
    assert.ok(await bay.evaluate(x=>x.scrollWidth<=x.clientWidth),'Today bay strip overflow '+width);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Today page overflow '+width);
  }
  await bay.click();
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
