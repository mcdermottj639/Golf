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
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('caddiehq_v1')||'{}').bays?.some(b=>b._fid==='bay-20260922-range-184605-batch1'));
  await page.locator('#nav [data-view="coach"]').click();
  await page.locator('[data-action="build-sim-practice"]').click();
  assert.equal(await page.locator('.sim-practice-block').count(),5);
  const plan=await page.evaluate(()=>JSON.parse(localStorage.getItem('caddiehq_v1')).simPracticePlan);
  assert.equal(plan.usable,93);assert.equal(plan.minutes,45);
  await page.locator('[data-action="toggle-sim-practice"]').first().click();
  await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('caddiehq_v1'));for(const b of s.simPracticePlan.blocks){delete b.kind;delete b.baseline;delete b.targetYds;}localStorage.setItem('caddiehq_v1',JSON.stringify(s));});
  await page.reload();
  await page.locator('#nav [data-view="coach"]').click();
  assert.equal(await page.locator('[data-action="toggle-sim-practice"]').first().getAttribute('aria-pressed'),'true');
  const wedgeIndex=await page.evaluate(()=>JSON.parse(localStorage.getItem('caddiehq_v1')).simPracticePlan.blocks.findIndex(b=>b.title.includes('finish hits')));
  const faceIndex=await page.evaluate(()=>JSON.parse(localStorage.getItem('caddiehq_v1')).simPracticePlan.blocks.findIndex(b=>b.title.includes('open to path')));
  const wedge=page.locator('.sim-practice-block').nth(wedgeIndex);
  assert.match(await wedge.locator('h3').innerText(),/landing/);
  assert.match(await wedge.innerText(),/92 yd/);
  assert.match(await page.locator('.sim-practice-block').nth(faceIndex).innerText(),/not the number of bad shots/);
  await wedge.locator('[data-sim-field="count"]').fill('12');
  await wedge.locator('[data-action="save-sim-practice"]').click();
  assert.equal(await page.evaluate(i=>JSON.parse(localStorage.getItem('caddiehq_v1')).simPracticePlan.blocks[i].result,wedgeIndex),undefined);
  await wedge.locator('[data-sim-field="count"]').fill('4');
  await wedge.locator('[data-action="save-sim-practice"]').click();
  assert.match(await page.locator('.sim-practice-block').nth(wedgeIndex).innerText(),/Saved: 4\/10/);
  const smashIndex=await page.evaluate(()=>JSON.parse(localStorage.getItem('caddiehq_v1')).simPracticePlan.blocks.findIndex(b=>b.title.includes('smash')));
  const smash=page.locator('.sim-practice-block').nth(smashIndex);
  await smash.locator('[data-sim-field="low"]').fill('1.42');
  await smash.locator('[data-sim-field="high"]').fill('1.38');
  await smash.locator('[data-action="save-sim-practice"]').click();
  assert.equal(await page.evaluate(i=>JSON.parse(localStorage.getItem('caddiehq_v1')).simPracticePlan.blocks[i].result,smashIndex),undefined);
  await smash.locator('[data-sim-field="high"]').fill('1.49');
  await smash.locator('[data-action="save-sim-practice"]').click();
  assert.match(await page.locator('.sim-practice-block').nth(smashIndex).innerText(),/0.07 spread/);
  await page.reload();await page.locator('#nav [data-view="coach"]').click();
  assert.match(await page.locator('.sim-practice-block').nth(wedgeIndex).innerText(),/Saved: 4\/10/);
  assert.match(await page.locator('.sim-practice-block').nth(smashIndex).innerText(),/0.07 spread/);
  for(const width of [320,390]){
    await page.setViewportSize({width,height:844});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  await page.locator('.sim-practice').screenshot({path:'/tmp/caddie-coach-plan.png'});
  await page.locator('[data-action="build-sim-practice"]').click();
  assert.equal(await page.locator('[data-action="toggle-sim-practice"]').first().getAttribute('aria-pressed'),'false');
  assert.ok(await page.evaluate(i=>JSON.parse(localStorage.getItem('caddiehq_v1')).simPracticeHistory.some(p=>p.blocks[i].result?.count===4),wedgeIndex));
  await page.locator('.sim-practice [data-action="bay-takeaway-source"]').first().click();
  assert.equal(await page.locator('.bay-takeaways').count(),1);
  assert.deepEqual(errors,[]);console.log('PASS Coach: generate, persist, reload, rebuild, source navigation and 320/390 layout.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exit(1);});
