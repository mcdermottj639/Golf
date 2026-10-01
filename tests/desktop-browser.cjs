const assert=require('node:assert/strict'), http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
const root=path.join(__dirname,'..');
const types={'.js':'text/javascript','.css':'text/css','.json':'application/json','.html':'text/html','.svg':'image/svg+xml'};
const server=http.createServer((q,r)=>{const file=path.join(root,q.url.split('?')[0]==='/'?'index.html':q.url.split('?')[0]);fs.readFile(file,(e,d)=>{r.writeHead(e?404:200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});r.end(e?'':d);});});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({...(process.env.CADDIE_CHROMIUM?{executablePath:process.env.CADDIE_CHROMIUM}:{}),args:['--no-sandbox'],headless:true});
 try {
 const page=await browser.newPage({viewport:{width:1440,height:1000},serviceWorkers:'block'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('caddiehq_v1')||'{}').feedApplied?.includes('bay-20260925-4i-visible-v1'));
 for(const width of [320,390,1000,1440,1920]) {
  await page.setViewportSize({width,height:1000});
  for(const view of ['home','bag','game','rounds','coach']) {
   await page.locator('#nav button[data-view="'+view+'"]').click();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page overflow '+view+' '+width);
   if(width>=1000) assert.ok((await page.locator('#nav').boundingBox()).width<220,'desktop rail');
  }
  await page.locator('#nav button[data-view="game"]').click();
  await page.locator('[data-action="session-category"][data-kind="cumulative"]').first().click();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'cumulative overflow '+width);
  const plan=await page.locator('#cum-plan').boundingBox(),bag=await page.locator('#cum-bag').boundingBox();
  if(width>=1000){assert.ok(Math.abs(plan.y-bag.y)<2,'plan and chart share a row');assert.ok(bag.x>plan.x+plan.width,'chart beside plan');}
  else assert.ok(bag.y>=plan.y+plan.height,'mobile stacked');
  await page.locator('.cum-club summary').first().click();
  assert.ok(await page.locator('.cum-club').first().getAttribute('open')!==null);
 }
 assert.deepEqual(errors,[]);
 console.log('PASS five main views + cumulative at 320,390,1000,1440,1920; rail, plan/chart placement, expanded club and no page errors');
 } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exit(1)});
