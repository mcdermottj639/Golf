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
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('caddiehq_v1')||'{}').feedApplied?.includes('oct01-map-20261001-retire-split-5w-v1'));
  await page.locator('[data-action="session-category"][data-kind="days"]').first().click();
  const oct=page.locator('.session-row[data-action="open-bay"]').filter({has:page.locator('.session-date', {hasText:'Oct 1'})});
  assert.equal(await oct.count(),1);
  assert.match(await oct.innerText(),/146 usable shots · 13 clubs · 3 source sessions/);
  await oct.click();
  assert.match(await page.locator('.bay-takeaways > p').first().innerText(),/146 usable shots/);
  await page.locator('#day-sources > summary').click();
  assert.equal(await page.locator('[data-action="open-bay-source"]').count(),3);
  await page.locator('[data-action="open-bay-source"]').filter({hasText:'Map My Bag'}).click();
  assert.match(await page.locator('#view').innerText(),/72 reported shots/);
  assert.equal(await page.locator('.bay-takeaways').count(),0);
  await page.locator('[data-action="open-bay"]').filter({hasText:'Open full range day'}).click();
  assert.match(await page.locator('.bay-takeaways > p').first().innerText(),/146 usable shots/);
  for(const width of [320,390,1440]){
    await page.setViewportSize({width,height:900});
    for(const view of ['home','bag','game','rounds','coach']){
      await page.locator('#nav [data-view="'+view+'"]').click();
      const folds=page.locator('.section-fold-toggle');
      assert.ok(await folds.count()>0,view+' has collapsible sections');
      await page.getByRole('button',{name:'Expand sections',exact:true}).click();
      const first=folds.first(),ids=(await first.getAttribute('aria-controls')).split(' ');
      await first.click();
      assert.equal(await first.getAttribute('aria-expanded'),'false');
      for(const id of ids)assert.ok(!await page.locator('[id="'+id+'"]').isVisible(),view+' closes content');
      await first.focus();await page.keyboard.press('Enter');
      assert.equal(await first.getAttribute('aria-expanded'),'true');
      await page.getByRole('button',{name:'Collapse sections',exact:true}).click();
      assert.equal(await page.locator('.section-fold-toggle[aria-expanded="true"]').count(),0);
      await page.getByRole('button',{name:'Expand sections',exact:true}).click();
      assert.equal(await page.locator('.section-fold-toggle[aria-expanded="false"]').count(),0);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),view+' overflow '+width);
    }
  }
  await page.locator('#nav [data-view="bag"]').click();
  const fold=page.locator('.section-fold-toggle').first();await fold.click();
  const key=await fold.getAttribute('data-fold-key');
  await page.locator('#nav [data-view="home"]').click();
  await page.locator('#nav [data-view="bag"]').click();
  assert.equal(await page.locator('.section-fold-toggle').first().getAttribute('aria-expanded'),'false');
  await page.reload();
  await page.locator('#nav [data-view="bag"]').click();
  assert.equal(await page.locator('.section-fold-toggle').first().getAttribute('data-fold-key'),key);
  assert.equal(await page.locator('.section-fold-toggle').first().getAttribute('aria-expanded'),'false');
  await page.locator('.jumpbar .jump').first().click();
  assert.equal(await page.locator('.section-fold-toggle').first().getAttribute('aria-expanded'),'true');
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'/tmp/caddie-folds.png'});
  await page.locator('#nav [data-view="game"]').click();
  await page.locator('[data-action="session-category"][data-kind="days"]').first().click();
  await page.screenshot({path:'/tmp/caddie-days.png'});
  assert.deepEqual(errors,[]);
  console.log('PASS daily grouping and original sources; all five pages fold at 320/390/1440; keyboard, navigation, refresh, jump links and zero overflow/errors.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exit(1);});
