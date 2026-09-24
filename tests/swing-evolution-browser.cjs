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
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('caddiehq_v1')||'{}').feedApplied?.includes('bay-20260922-range-184605-batch1'));
  await page.locator('#nav [data-view="game"]').click();
  const lab=page.locator('.labsel[data-disc="swing"]');
  await lab.click();
  if(await page.locator('.labsel[data-disc="swing"]').count()) await page.locator('.labsel[data-disc="swing"]').click();
  await page.locator('.swing-evolution').waitFor();
  const club=page.locator('.swing-evo-club[data-club="3W"]');
  await club.locator(':scope > summary').click();
  await club.locator(':scope > .more > summary').click();
  assert.match(await club.innerText(),/177.7 yd/);
  assert.match(await club.innerText(),/39.6 ft/);
  for(const width of [320,390]){
    await page.setViewportSize({width,height:844});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page overflow '+width);
    assert.ok(await page.locator('.swing-evo-metrics').evaluateAll(xs=>xs.every(x=>x.scrollWidth<=x.clientWidth)),'metric overflow');
  }
  await page.locator('.swing-evolution').screenshot({path:'/tmp/swing-evolution-v175.png'});
  await club.locator('[data-action="open-bay"]').first().click();
  assert.equal(await page.locator('.swing-evolution').count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS evolution: 320/390, real readings, expandable history, source navigation, no page errors.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exit(1);});
