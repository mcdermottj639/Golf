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
  const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];
  const bulk=async label=>{
    await page.locator('.section-menu > summary').click();
    await page.getByRole('button',{name:label,exact:true}).click();
    assert.equal(await page.locator('.section-menu').getAttribute('open'),null);
  };
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
      assert.equal(await page.locator('.section-fold-tools').count(),0,'no separate bulk-action row');
      assert.ok((await page.locator('.page-sections').boundingBox()).height<=52,'compact section row');
      await bulk('Expand all');
      const first=folds.first(),ids=(await first.getAttribute('aria-controls')).split(' ');
      await first.click();
      assert.equal(await first.getAttribute('aria-expanded'),'false');
      for(const id of ids)assert.ok(!await page.locator('[id="'+id+'"]').isVisible(),view+' closes content');
      await first.focus();await page.keyboard.press('Enter');
      assert.equal(await first.getAttribute('aria-expanded'),'true');
      await bulk('Collapse all');
      assert.equal(await page.locator('.section-fold-toggle[aria-expanded="true"]').count(),0);
      assert.equal(await page.locator('details[data-section-key][open]').count(),0,'native sections collapse too');
      await bulk('Expand all');
      assert.equal(await page.locator('.section-fold-toggle[aria-expanded="false"]').count(),0);
      assert.equal(await page.locator('details[data-section-key]:not([open])').count(),0,'native sections expand too');
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
  // Closing a named section must not swallow the independent section below it.
  await page.locator('.section-fold-toggle').filter({hasText:'Wedge yardage matrix'}).click();
  assert.ok(await page.locator('#bag-history > summary').isVisible(),'Bag history is independent of the matrix');
  // Native section preferences share the navigation/reload behavior of enhanced headings.
  await page.locator('#bag-roster > summary').click();
  assert.equal(await page.locator('#bag-roster').getAttribute('open'),null);
  await page.locator('#nav [data-view="home"]').click();
  await page.locator('#nav [data-view="bag"]').click();
  assert.equal(await page.locator('#bag-roster').getAttribute('open'),null);
  await page.reload();await page.locator('#nav [data-view="bag"]').click();
  assert.equal(await page.locator('#bag-roster').getAttribute('open'),null);
  await page.locator('.jumpbar .jump').filter({hasText:'In the bag'}).click();
  assert.ok(await page.locator('#bag-roster').getAttribute('open')!==null,'shortcut opens native destination');
  // Menu dismissal works with Escape and outside taps, without changing the data store.
  const stored=await page.evaluate(()=>localStorage.getItem('caddiehq_v1'));
  await page.locator('.section-menu > summary').click();await page.keyboard.press('Escape');
  assert.equal(await page.locator('.section-menu').getAttribute('open'),null);
  await page.locator('.section-menu > summary').click();await page.locator('#pageTitle').click();
  assert.equal(await page.locator('.section-menu').getAttribute('open'),null);
  await bulk('Collapse all');await bulk('Expand all');
  assert.equal(await page.evaluate(()=>localStorage.getItem('caddiehq_v1')),stored,'folding never changes golf data');
  assert.equal(await page.locator('#nav .ic svg').count(),5);
  // The same Rounds segment keeps its state through both entry routes.
  await page.locator('#nav [data-view="rounds"]').click();
  await page.locator('[data-action="rounds-seg"][data-k="cards"]').click();
  await page.locator('.section-fold-toggle').first().click();
  await page.locator('#nav [data-view="home"]').click();
  await page.locator('#nav [data-view="rounds"]').click();
  assert.equal(await page.locator('.section-fold-toggle').first().getAttribute('aria-expanded'),'false');
  // A nested shortcut reveals both its native wrapper and its own hidden body.
  await page.setViewportSize({width:390,height:844});
  await page.locator('#nav [data-view="game"]').click();
  await page.locator('[data-action="session-category"][data-kind="cumulative"]').first().click();
  await bulk('Collapse all');
  await page.locator('.jumpbar .jump').filter({hasText:'Every club'}).click();
  const delivery=page.locator('h2').filter({hasText:'Every club'});
  assert.ok(await delivery.isVisible());
  assert.equal(await delivery.locator('.section-fold-toggle').getAttribute('aria-expanded'),'true');
  assert.ok(await page.locator('#view .cum-jumps').first().isVisible(),'intro fold does not hide independent navigation');
  await bulk('Expand all');
  await page.locator('#nav [data-view="bag"]').click();
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'/tmp/caddie-folds.png'});
  await page.locator('#nav [data-view="game"]').click();
  await page.locator('[data-action="session-category"][data-kind="days"]').first().click();
  await page.screenshot({path:'/tmp/caddie-days.png'});
  // Weather is a compact section, with the existing freshness and temperature-only rule.
  await page.evaluate(()=>{
    const data=JSON.parse(localStorage.getItem('caddiehq_v1'));
    data.weather={t:77,wind:6,code:2,ts:Date.now()};data.here=null;
    localStorage.setItem('caddiehq_v1',JSON.stringify(data));
    localStorage.removeItem('caddiehq_section_folds_v1');
  });
  await page.setViewportSize({width:320,height:844});await page.reload();
  assert.equal(await page.locator('#home-conditions').getAttribute('open'),null,'conditions start compact');
  assert.match(await page.locator('.wx-playing').innerText(),/150 → 149 yd/);
  assert.match(await page.locator('.wx-playing').innerText(),/temp only/);
  assert.ok((await page.locator('#home-conditions').boundingBox()).height<=70);
  await page.locator('#home-conditions > summary').click();
  assert.ok(await page.locator('#home-conditions [data-action="get-weather"]').isVisible());
  assert.ok(await page.locator('#home-conditions [data-action="relocate"]').isVisible());
  await bulk('Collapse all');
  assert.equal(await page.locator('#home-conditions').getAttribute('open'),null);
  assert.equal(await page.locator('#today-focus').getAttribute('open'),null,'the full focus card folds too');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.evaluate(()=>{
    const data=JSON.parse(localStorage.getItem('caddiehq_v1'));data.weather.ts=Date.now()-4*3600000;
    localStorage.setItem('caddiehq_v1',JSON.stringify(data));
    localStorage.setItem('caddiehq_section_folds_v1','true');
  });
  await page.reload();
  assert.match(await page.locator('.wx-playing').innerText(),/Update needed/);
  assert.doesNotMatch(await page.locator('.wx-playing').innerText(),/150 →/,'stale weather has no distance claim');
  await bulk('Collapse all');await bulk('Expand all');
  assert.deepEqual(errors,[]);
  console.log('PASS daily grouping and sources; compact menu at 320/390/1440; enhanced + native panels, independent Bag history, keyboard/dismissal, navigation/reload, shortcuts, data preservation and no overflow/errors.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exit(1);});
