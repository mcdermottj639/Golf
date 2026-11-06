// v289 — "Misses from every range session" (chqlinks:flags.bayDispersion), checked in a real Chromium (SwiftShader).
// Drives the real app at 390×844 and 320×690: Overview → Play Links, every directory course listed, the flag OFF by default
// (built-in miss table, no carry SD), tick it on the menu → debug().bayDispersion pools the retained shots in S.bays and the
// hybrids read exactly what CLAUDE.md records for Nov 4 (3H 16 of 32 at 187.3 ±7.1; 4H 6 of 12 at 178.5 ±5.4), the Mini pools
// its deck sessions and skips the teed sim block, a club with no side data keeps the built-in side (marked ~), the bag table
// header switches to Carry SD, the flag persists in chqlinks:flags only; Wianno front 9 plays a slingshot shot with the pooled
// spread (flight → aim), no horizontal overflow, the 2D map paints, Quit / Night / re-enter keeps the flag, ticking it off
// restores the table, golf state unchanged, zero page/console errors. An in-page recount of the Nov 4 3H record cross-checks
// the cohort rule (mishit:true held out, finite carry) independently of the game's code.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
let chromium;try{({chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright'))}catch{({chromium}=require('playwright'))}
const root=path.join(__dirname,'..');
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon'};
const server=http.createServer((req,res)=>{const u=decodeURIComponent(req.url.split('?')[0]);if(u==='/favicon.ico'){res.writeHead(204);res.end();return}const f=path.join(root,u==='/'?'index.html':u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return}res.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream','cache-control':'no-store'});fs.createReadStream(f).pipe(res)});
const shots=path.join(process.env.SHOT_DIR||'/tmp','links-v289');fs.mkdirSync(shots,{recursive:true});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,executablePath:process.env.CADDIE_CHROMIUM||(fs.existsSync('/tmp/chromium')?'/tmp/chromium':undefined),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try{
    for(const [width,height] of [[390,844],[320,690]]){
      const ctx=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true,serviceWorkers:'block'}),p=await ctx.newPage();
      const errors=[];p.on('pageerror',e=>errors.push('pageerror: '+e.message));p.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
      await p.goto(base+'/');await p.waitForSelector('[data-action="open-links"]');
      await p.waitForFunction(()=>{const a=JSON.parse(localStorage.getItem('caddiehq_v1')||'{}').feedApplied||[];return a.includes('bay-20261104-mini-v1')&&a.includes('bay-20260915-mini-b-v1')},null,{timeout:30000});
      const golf=()=>p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('caddiehq_v1'));delete s.settings;delete s.updates;delete s.seenUpdates;return JSON.stringify(s)});
      const before=await golf();
      // independent recount of the Nov 4 3H record straight from the stored state
      const recount=await p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('caddiehq_v1'));const b=(s.bays||[]).find(x=>x._fid==='bay-20261104-3h-v1');const g=b&&b.detail.rangeShots[0];const kept=g.shots.filter(x=>x.mishit!==true&&Number.isFinite(+x.carry));const m=kept.reduce((a,x)=>a+x.carry,0)/kept.length;return{src:g.shots.length,n:kept.length,mean:+m.toFixed(1),sd:+Math.sqrt(kept.reduce((a,x)=>a+(x.carry-m)**2,0)/(kept.length-1)).toFixed(1)}});
      assert.deepEqual(recount,{src:32,n:16,mean:187.3,sd:7.1},'state holds the Nov 4 3H record as CLAUDE.md records it');
      await p.locator('[data-action="open-links"]').first().click();
      const nCourses=await p.evaluate(()=>window.CADDIE_PREP_COURSES.length);assert(nCourses>=14,'directory lists at least 14 courses: '+nCourses);
      assert.equal(await p.locator('#lk-courses .cpick').count(),nCourses,nCourses+' course buttons');
      // OFF by default
      assert.equal(await p.locator('#lk-flag-disp').isChecked(),false,'flag unticked on a fresh install');
      let d=await p.evaluate(()=>CaddieLinks.debug());
      assert.equal(d.flags.bayDispersion,undefined,'no flag stored yet');assert.equal(d.bayDispersion,null,'nothing pooled while off');
      const h3off=d.bag.find(c=>c.id==='3H');assert(h3off,'3H on the ladder: '+d.bag.map(c=>c.id).join(','));assert.equal(h3off.carrySD,null,'built-in table: no carry SD on the 3H');
      assert.equal(await p.evaluate(()=>document.querySelectorAll('#lk-bagtable th')[2].textContent),'Consist.','table header reads Consist. while off');
      assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow on the menu');
      // tick it on
      const box=await p.locator('#lk-flag-disp').boundingBox();assert(box.width>=20&&box.height>=20,'checkbox is a real tap target: '+JSON.stringify(box));
      await p.locator('#lk-dispflag').click();await p.waitForTimeout(100);
      assert.equal(await p.locator('#lk-flag-disp').isChecked(),true,'flag ticked');
      d=await p.evaluate(()=>CaddieLinks.debug());
      assert.equal(d.flags.bayDispersion,true,'flag stored');
      assert.deepEqual(await p.evaluate(()=>JSON.parse(localStorage.getItem('chqlinks:flags'))),{bayDispersion:true},'stored only in chqlinks:flags');
      const D=d.bayDispersion;assert(D&&typeof D==='object','pooled table present');
      assert.equal(D['3H'].n,16,'3H pools 16 retained shots');assert.equal(D['3H'].carry,187.3);assert.equal(D['3H'].carrySD,7.1);assert.equal(D['3H'].sideN,0,'Nov 4 rows carry no side column');assert.equal(D['3H'].side,null);
      // 4H: the G440 has Oct 1 PDF/video/Map My Bag shots as well as Nov 4, so the pool spans both days and is wider than one session
      assert(D['4H'].n>6&&D['4H'].from==='2026-10-01'&&D['4H'].to==='2026-11-04','4H pools every session Oct 1 → Nov 4: '+JSON.stringify(D['4H']));
      assert(D['4H'].sideN>=5&&D['4H'].side!=null,'4H has side readings (Oct 1 carrySide/sideYards): '+JSON.stringify(D['4H']));
      // Mini: Nov 4 deck 6 + Sep 15 tables 4 + 5 = 15 at 186.7; the teed Nov 4 sim block (5 at 205.3) is skipped. Pinned to the
      // feeds as of v289 — a new mini session on the phone changes these two numbers, nothing else here.
      assert.equal(D.Mini.n,15,'Mini pools its three deck sessions and skips the teed sim block: '+JSON.stringify(D.Mini));assert.equal(D.Mini.carry,186.7);assert.equal(D.Mini.sessions,3);
      assert(D.Dr&&D.Dr.n>=6,'Driver pools shots: '+JSON.stringify(D.Dr));
      for(const k in D){const x=D[k];assert(x.n>=6&&Number.isFinite(x.carrySD)&&x.carrySD>0,'every pooled club has n≥6 and a finite SD: '+JSON.stringify(x));if(x.side!=null)assert(x.sideN>=5,'side only with ≥5 readings: '+JSON.stringify(x))}
      const h3=d.bag.find(c=>c.id==='3H');assert.equal(h3.carrySD,7.1,'3H carries its pooled SD');assert.equal(h3.est,true,'3H side still estimated (no side data)');assert.equal(h3.carry,h3off.carry,'the carry itself is unchanged (ladder number)');
      assert.equal(h3.src,'16 shots · 1 session · Nov 4','3H source line: '+h3.src);const h4=d.bag.find(c=>c.id==='4H');assert(/^\d+ shots · 4 sessions · Oct 1–Nov 4$/.test(h4.src),'4H source line: '+h4.src);assert.equal(h4.est,false,'4H side comes from its shots');
      assert.equal(await p.evaluate(()=>document.querySelectorAll('#lk-bagtable th')[2].textContent),'Carry SD','table header switches to Carry SD');
      const row3h=await p.evaluate(()=>[...document.querySelectorAll('#lk-bagtable tr')].map(r=>r.textContent).find(t=>t.startsWith('3H'))||'');assert(/±7\.1/.test(row3h),'3H row shows ±7.1: '+row3h);
      const note=await p.evaluate(()=>document.getElementById('lk-dispnote').textContent);assert(/^\d+ of \d+ clubs have enough shots/.test(note),'note counts the clubs with data: '+note);
      await p.evaluate(()=>{for(const d of document.querySelectorAll('#lk-menu details'))d.open=true;document.getElementById('lk-bagtable').scrollIntoView()});await p.screenshot({path:path.join(shots,`menu-on-${width}.png`)});
      assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow with the flag on');
      // play with it on
      await p.locator('#lk-courses [data-id="wianno"]').click();await p.locator('#lk-modeseg [data-mode="sling"]').click();await p.locator('#lk-lenseg [data-len="front"]').click();
      await p.locator('#lk-start').click();await p.waitForFunction(()=>CaddieLinks.debug()?.phase==='aim',null,{timeout:30000});await p.waitForTimeout(600);
      d=await p.evaluate(()=>CaddieLinks.debug());assert.equal(d.hole,1);assert.equal(d.renderer,'3d');assert(d.scene&&d.scene.triangles>0,'3D scene drew triangles');
      assert.equal(d.bag.find(c=>c.id==='3H').carrySD,7.1,'in-round bag carries the pooled SD');
      assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow in game');
      const painted=await p.evaluate(()=>{CaddieLinks.debug().drawMs();const c=document.getElementById('lk-cv3'),gl=c.getContext('webgl2'),px=new Uint8Array(4);let n=0;for(let i=0;i<40;i++){gl.readPixels(Math.floor(c.width*(i+.5)/40),Math.floor(c.height*.5),1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);if(px[3]>0&&px[0]+px[1]+px[2]>0)n++}return n});
      assert(painted>30,'3D canvas painted: '+painted);
      const drawMs=await p.evaluate(()=>CaddieLinks.debug().drawMs());
      await p.screenshot({path:path.join(shots,`tee-${width}.png`)});
      const hb=await p.locator('#lk-powerhandle').boundingBox();await p.mouse.move(hb.x+hb.width/2,hb.y+hb.height/2);await p.mouse.down();for(let i=1;i<=6;i++){await p.mouse.move(hb.x+hb.width/2,hb.y+hb.height/2+i*20);await p.waitForTimeout(30)}await p.mouse.up();
      await p.waitForFunction(()=>CaddieLinks.debug()?.phase==='flight',null,{timeout:3000});
      await p.screenshot({path:path.join(shots,`flight-${width}.png`)});
      await p.waitForFunction(()=>['aim','done'].includes(CaddieLinks.debug()?.phase),null,{timeout:8000});
      d=await p.evaluate(()=>CaddieLinks.debug());assert(d.strokes===1||d.strokes===2,'one stroke taken (two if the ball found water or OB): '+d.strokes);
      await p.locator('#lk-camtog').click();await p.waitForTimeout(150);
      const map=await p.evaluate(()=>{const c=document.getElementById('lk-cv'),x=c.getContext('2d'),a=x.getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<a.length;i+=4*97)if(a[i]>0)n++;return n});assert(map>50,'map canvas painted: '+map);
      await p.locator('#lk-camtog').click();
      // quit, Night mode, re-enter: the flag survives
      await p.locator('#lk-quit').click();await p.waitForSelector('[data-action="open-links"]');
      await p.locator('[data-action="toggle-theme"]').first().click();await p.waitForTimeout(100);
      await p.locator('[data-action="open-links"]').first().click();
      assert.equal(await p.locator('#lk-flag-disp').isChecked(),true,'flag remembered after re-entry');
      d=await p.evaluate(()=>CaddieLinks.debug());assert.equal(d.bag.find(c=>c.id==='3H').carrySD,7.1,'pooled SD after re-entry');
      await p.screenshot({path:path.join(shots,`night-${width}.png`)});
      // tick it off again: the built-in table is back
      await p.locator('#lk-dispflag').click();await p.waitForTimeout(100);
      assert.equal(await p.locator('#lk-flag-disp').isChecked(),false);
      d=await p.evaluate(()=>CaddieLinks.debug());assert.equal(d.flags.bayDispersion,false);assert.equal(d.bag.find(c=>c.id==='3H').carrySD,null,'built-in table restored');
      assert.equal(await p.evaluate(()=>document.querySelectorAll('#lk-bagtable th')[2].textContent),'Consist.');
      await p.locator('#lk-start').click();await p.waitForFunction(()=>CaddieLinks.debug()?.phase==='aim',null,{timeout:30000});
      d=await p.evaluate(()=>CaddieLinks.debug());assert.equal(d.bag.find(c=>c.id==='3H').carrySD,null,'round with the flag off uses the built-in spread');
      await p.locator('#lk-quit').click();await p.waitForSelector('[data-action="open-links"]');
      assert.equal(await golf(),before,'golf state untouched');
      assert.deepEqual(errors,[],'no page or console errors');
      console.log(`ok ${width}×${height}: ${nCourses} courses · flag off→on→off · 3H ${D['3H'].n}/32 at ${D['3H'].carry} ±${D['3H'].carrySD} · 4H ${D['4H'].n} shots Oct 1–Nov 4 at ${D['4H'].carry} ±${D['4H'].carrySD} · Mini n=${D.Mini.n} at ${D.Mini.carry} · Dr n=${D.Dr.n} · ${Object.keys(D).length} clubs pooled · 3D ${d.scene?d.scene.triangles:'?'} tri · drawMs ${drawMs.toFixed(2)} · shot flight→aim · map paints · night · quit/re-enter · golf state unchanged`);
      await ctx.close();
    }
    console.log('PASS links-dispersion-browser · screenshots in',shots);
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
