#!/usr/bin/env node
'use strict';
// Practice Lab (v295) in a real browser: phone 320/390, Duo Book (manual, no fold APIs),
// top/bottom, folded phone with Book saved, desktop. Asserts layout against elements and that
// golf state (carries, clubs, bays, rounds) is byte-identical after every interaction.
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright':'playwright');
const root=path.join(__dirname,'..');
const TYPES={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.jpg':'image/jpeg','.png':'image/png'};
const server=http.createServer((q,r)=>{const u=decodeURIComponent(q.url.split('?')[0]);const file=path.join(root,u==='/'?'index.html':u);
  if(!file.startsWith(root+path.sep)){r.writeHead(403).end();return;}
  fs.readFile(file,(err,data)=>{if(err){r.writeHead(404).end();return;}r.writeHead(200,{'Content-Type':TYPES[path.extname(file)]||'application/octet-stream'});r.end(data);});});
const qa=process.env.CADDIE_QA_DIR||'/tmp/caddie-v295-practice-lab';fs.mkdirSync(qa,{recursive:true});
const golf=page=>page.evaluate(()=>{const S=JSON.parse(localStorage.getItem('caddiehq_v1')||'{}');return JSON.stringify([S.carries,S.clubs,S.bays,S.rounds,S.sessions]);});
async function noSideScroll(page,label){
  const o=await page.evaluate(()=>({doc:document.documentElement.scrollWidth,w:innerWidth,root:(()=>{const r=document.getElementById('practice-lab');return r?r.scrollWidth-r.clientWidth:0;})()}));
  assert.ok(o.doc<=o.w,label+': page scrolls sideways '+JSON.stringify(o));
}
async function openLab(page){
  await page.locator('#nav [data-view="game"]').click();
  await page.locator('[data-action="go"][data-view="practicelab"]').first().click();
  await page.locator('.pl-clubpanel').waitFor();
}
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base=`http://127.0.0.1:${server.address().port}/`;
  const executablePath=process.env.CADDIE_CHROMIUM;
  const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{}),args:['--no-sandbox']});
  const errors=[];
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
    const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base);
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('caddiehq_v1')||'{}').feedApplied?.length>0);
    await page.waitForTimeout(400);
    const before=await golf(page);
    await openLab(page);
    assert.equal(await page.locator('#pageTitle').innerText(),'Practice Lab');
    assert.equal((await page.locator('.pl-title').innerText()).trim(),'Lower Hands Experiment');
    assert.equal(await page.locator('.pl-kpi').count(),4);
    assert.match(await page.locator('.pl-kpi').nth(0).innerText(),/4\/10 → 12\/12/);
    assert.match(await page.locator('.pl-kpi').nth(1).innerText(),/\+13\.6 yd/);
    assert.match(await page.locator('.pl-kpi').nth(3).innerText(),/−7\.5° → −9\.7°/);
    assert.match(await page.locator('.pl-kpi').nth(3).innerText(),/worse/);
    assert.equal(await page.locator('.pl-chips .pl-chip').count(),9);
    assert.equal((await page.locator('.pl-clubname').innerText()).trim(),'6i','opens on the 6 iron');
    assert.equal(await page.locator('.pl-timeline li').count(),3);
    assert.equal(await page.locator('.pl-gap').count(),2,'mini–5W and 5i–6i need a retest');
    // Improvements and regressions are separate lists.
    assert.match(await page.locator('.pl-fcol.pl-worse').innerText(),/5i club path −7\.5° → −9\.7°/);
    assert.match(await page.locator('.pl-fcol.pl-better').innerText(),/6i clean rate/);
    for(const width of [320,390]){
      await page.setViewportSize({width,height:844});await page.waitForTimeout(120);
      await noSideScroll(page,'phone '+width);
      const tight=await page.evaluate(()=>[...document.querySelectorAll('.pl-chip,.pl-tab,.pl-segb,.pl-divrow,.pl-btn')].filter(b=>b.offsetParent).map(b=>b.getBoundingClientRect()).filter(r=>r.height<43.5).length);
      assert.equal(tight,0,'every tap target ≥44px at '+width);
      await page.screenshot({path:path.join(qa,`phone-${width}.png`),fullPage:true});
    }
    // Club + tabs.
    await page.locator('.pl-chip[data-pl-club="5i"]').click();
    assert.equal((await page.locator('.pl-clubname').innerText()).trim(),'5i');
    await page.locator('.pl-tab[data-pl-tab="delivery"]').click();
    assert.equal(await page.locator('.pl-diag').count(),2,'B1 and B3 delivery pictures, no invented B2');
    assert.match(await page.locator('.pl-legend').innerText(),/Right-handed/);
    assert.match(await page.locator('.pl-tabbody').innerText(),/−9\.7°/);
    await page.locator('.pl-tab[data-pl-tab="carry"]').click();
    // 7i has no baseline: bars for B3 only, no fabricated comparison.
    await page.locator('.pl-chip[data-pl-club="7i"]').click();
    assert.equal(await page.locator('.pl-tabbody .pl-metric').first().locator('.pl-bar').count(),1);
    assert.equal(await page.locator('.pl-tabbody .pl-dl').count(),0);
    // 56°: unclassified until the swing is stated.
    await page.locator('.pl-chip[data-pl-club="56°"]').click();
    assert.match(await page.locator('.pl-clubpanel').innerText(),/Unclassified: no clean count/);
    assert.match(await page.locator('.pl-clubhead').innerText(),/unclassified · 3 shots/);
    await page.locator('[data-pl-intent="full"]').click();
    assert.match(await page.locator('.pl-clubhead').innerText(),/0\/3 clean/);
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('caddiehq_v1')).practiceLab.intent['lower-hands-2026-11-17:56°']),'full');
    await page.locator('[data-pl-intent="unknown"]').click();
    assert.match(await page.locator('.pl-clubhead').innerText(),/unclassified/);
    // Retest plan saves under S.practiceLab only, and can be removed.
    const form=page.locator('[data-pl-form]');
    if(!await form.isVisible())await page.locator('#pl-retest summary').click();
    await form.locator('input[name="clubs"]').fill('6i, 5i');
    await form.locator('input[name="hands"]').fill('one grip-width lower');
    await form.locator('button[type="submit"]').click();
    assert.equal(await page.locator('.pl-plan').count(),1);
    assert.match(await page.locator('.pl-plan').innerText(),/planned, not run/);
    await page.locator('[data-pl-delplan]').click();
    assert.equal(await page.locator('.pl-plan').count(),0);
    assert.equal(await golf(page),before,'carries, clubs, bays, rounds and sessions unchanged');

    // Duo Book: big inner screen, no fold APIs → manual Book splits at the middle.
    await page.setViewportSize({width:1180,height:820});await page.waitForTimeout(150);
    await page.locator('.pl-chip[data-pl-club="6i"]').click();
    await page.locator('.pl-acts [data-pl-mode="book"]').click();
    await page.waitForFunction(()=>document.getElementById('practice-lab').classList.contains('pl-book'));
    const book=await page.evaluate(()=>{const W=innerWidth,l=document.querySelector('.pl-left').getBoundingClientRect(),r=document.querySelector('.pl-right').getBoundingClientRect(),h=document.querySelector('.pl-hinge').getBoundingClientRect(),nav=document.getElementById('nav').getBoundingClientRect();
      const lp=document.querySelector('.pl-left'),rp=document.querySelector('.pl-right');
      return {W,lr:l.right,rl:r.left,hl:h.left,hr:h.right,navR:nav.right,navTop:nav.top,ll:l.left,lb:l.bottom,rb:r.bottom,H:innerHeight,lscroll:lp.scrollHeight>lp.clientHeight,rscroll:rp.scrollHeight>rp.clientHeight,lock:getComputedStyle(document.documentElement).overflow};});
    assert.ok(book.lr<=book.W/2-11&&book.rl>=book.W/2+11,'pages sit either side of the crease '+JSON.stringify(book));
    assert.ok(Math.abs((book.hl+book.hr)/2-book.W/2)<1,'hinge gutter centred on the crease');
    assert.ok(book.rscroll,'right page scrolls on its own');
    assert.equal(book.lock,'hidden','document locked, no drift');
    assert.equal(await page.evaluate(()=>localStorage.getItem('caddiehq:duo-mode')),'book');
    await noSideScroll(page,'book');
    await page.screenshot({path:path.join(qa,'duo-book.png')});
    // Changing club on the left page updates the right page and keeps Book.
    await page.locator('.pl-left .pl-chip[data-pl-club="5i"]').click();
    assert.equal((await page.locator('.pl-right .pl-clubname').innerText()).trim(),'5i');
    assert.ok(await page.evaluate(()=>document.getElementById('practice-lab').classList.contains('pl-book')));
    // Book survives a reload (manual choice), then Single page turns it off.
    await page.reload();await page.waitForTimeout(300);await openLab(page);
    await page.waitForFunction(()=>document.getElementById('practice-lab').classList.contains('pl-book'));
    assert.equal((await page.locator('.pl-right .pl-clubname').innerText()).trim(),'5i','selected club kept');
    await page.locator('.pl-acts [data-pl-mode="off"]').click();
    await page.waitForFunction(()=>!document.getElementById('practice-lab').classList.contains('pl-book'));
    assert.ok(!(await page.evaluate(()=>document.documentElement.classList.contains('pl-pose-book'))));
    await noSideScroll(page,'book off');
    // Top · bottom on a tall inner screen.
    await page.setViewportSize({width:820,height:1180});await page.waitForTimeout(150);
    await page.locator('.pl-acts [data-pl-mode="seated"]').click();
    await page.waitForFunction(()=>document.getElementById('practice-lab').classList.contains('pl-seated'));
    const seat=await page.evaluate(()=>({H:innerHeight,t:document.querySelector('.pl-left').getBoundingClientRect().bottom,b:document.querySelector('.pl-right').getBoundingClientRect().top}));
    assert.ok(seat.t<=seat.H/2-11&&seat.b>=seat.H/2+11,'top/bottom halves '+JSON.stringify(seat));
    await noSideScroll(page,'seated');
    await page.screenshot({path:path.join(qa,'duo-top-bottom.png')});
    // Back from a split page returns to Progress and releases the lock.
    await page.locator('.pl-acts [data-action="go"][data-view="game"]').click();
    await page.waitForFunction(()=>!document.documentElement.classList.contains('pl-pose-book'));
    assert.equal(await page.locator('#pageTitle').innerText(),'Progress');
    // Folded outer screen with Book saved: never forced (needs the big inner screen).
    await page.evaluate(()=>localStorage.setItem('caddiehq:duo-mode','book'));
    await page.setViewportSize({width:390,height:844});await openLab(page);await page.waitForTimeout(150);
    assert.ok(!(await page.evaluate(()=>document.getElementById('practice-lab').classList.contains('pl-book'))),'no forced Book on the folded screen');
    await noSideScroll(page,'folded with book saved');
    // Desktop standard: two columns, no hinge.
    await page.evaluate(()=>localStorage.setItem('caddiehq:duo-mode','auto'));
    await page.setViewportSize({width:1440,height:900});await openLab(page);await page.waitForTimeout(150);
    assert.ok(await page.evaluate(()=>document.getElementById('practice-lab').classList.contains('pl-wide')));
    const cols=await page.evaluate(()=>{const l=document.querySelector('.pl-left').getBoundingClientRect(),r=document.querySelector('.pl-right').getBoundingClientRect();return {l:l.right,r:r.left,top:Math.abs(l.top-r.top)};});
    assert.ok(cols.l<cols.r&&cols.top<2,'side by side');
    await noSideScroll(page,'desktop');
    await page.screenshot({path:path.join(qa,'desktop.png')});
    // Dark theme renders.
    await page.setViewportSize({width:390,height:844});
    await page.locator('[data-action="toggle-theme"]').first().click();await openLab(page);
    await noSideScroll(page,'night');
    await page.screenshot({path:path.join(qa,'phone-night.png'),fullPage:true});
    assert.equal(await golf(page),before,'golf state unchanged after every layout');
    // Existing routes still render.
    for(const v of ['home','rounds','bag','coach']){await page.locator(`#nav [data-view="${v}"]`).click();await page.waitForTimeout(80);await noSideScroll(page,v);}
    assert.deepEqual(errors,[],'page errors');
    console.log('practice-lab-browser: PASS — phone 320/390, Book, top/bottom, folded, desktop, night; screenshots in '+qa);
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
