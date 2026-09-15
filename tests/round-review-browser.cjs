const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8765/');
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('caddiehq_v1')||'{}').rounds?.some(r=>r.review));
 const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('caddiehq_v1')));
 let state=await read(); const beforeOutdoor=state.rounds.filter(r=>!r.sim).length;
 const idx=state.rounds.findIndex(r=>r.review);
 await page.click('#nav [data-view="bag"]');
 await page.click(`[data-action="open-round"][data-i="${idx}"]`);
 await page.waitForSelector('.rr');
 assert.ok((await page.locator('.rr').innerText()).includes('59 verified shot observations'));
 assert.equal(await page.locator('.rr [data-action="open-bay"]').count(),1);
 assert.equal(await page.locator('.rr .bvdelivery').count(),0);
 assert.equal(await page.locator('#round-range-reference').count(),1);
 for(const width of [320,390,768]){
  await page.setViewportSize({width,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow ${width}`);
 }
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'/tmp/caddie-review-v105.png',fullPage:true});
 await page.click('[data-action="save-review-test"]');
 assert.ok((await page.locator('#rr-error').innerText()).includes('whole-number'));
 await page.fill('#rr125','7');await page.fill('#rr150','5');await page.fill('#rrconditions','9i / 6i, venue ball, 70F, fairway');
 await page.click('[data-action="save-review-test"]');
 assert.equal((await read()).reviewTests.length,1);
 const details=page.locator('details').filter({has:page.locator('#rrshot')});
 await details.locator('summary').click();
 await page.selectOption('#rrclub','5-wood');await page.selectOption('#rrintent','full');
 await page.click('[data-action="save-review-identity"]');
 assert.ok(Object.values((await read()).reviewClubOverrides).some(x=>x.actualClub==='5-wood'));
 await page.reload();await page.waitForTimeout(700);
 state=await read();assert.equal(state.rounds.filter(r=>r.review).length,1);
 assert.equal(state.reviewTests.length,1);assert.equal(state.rounds.filter(r=>!r.sim).length,beforeOutdoor);
 assert.ok(Object.values(state.reviewClubOverrides).some(x=>x.actualClub==='5-wood'));
 await page.click('#nav [data-view="bag"]');await page.click(`[data-action="open-round"][data-i="${idx}"]`);
 await page.locator('#round-range-reference summary').click();
 await page.click('.rr [data-action="open-bay"]');
 assert.equal(await page.getByRole('heading',{name:'Exact club data',exact:true}).count(),1);
 assert.equal(await page.locator('.bvdelivery').count(),1);
 for(const width of [320,390,768]){
  await page.setViewportSize({width,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Bay overflow ${width}`);
 }
 await page.setViewportSize({width:390,height:844});
 await page.locator('.bayvisuals').screenshot({path:'/tmp/caddie-bay-v108.png'});
 await page.click('#nav [data-view="home"]');
 await page.click('[data-kind="sim"]');
 await page.click(`[data-action="open-round"][data-i="${idx}"]`);
 await page.click('[data-action="open-lesson"][data-id="sim-approach-repeatability"]');
 assert.ok((await page.locator('#view').innerText()).includes('20-ball baseline'));
 assert.deepEqual(errors,[]);
 console.log('PASS browser: feed import, review, Bay and lesson links, 320/390/768 layouts, validation, saved test and club identity, persistence, no duplicates, outdoor records unchanged, no JS errors.');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
