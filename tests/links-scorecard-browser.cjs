// v264 — Links course records + shareable scorecard image, driven in a real Chromium.
// Serves the repo itself; a test-only hook (injected into the served script, never shipped)
// ends a round with fixed scores so the round-complete screen can be checked at phone widths.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
let chromium;try{({chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright'))}catch{({chromium}=require('playwright'))}
const root=path.join(__dirname,'..');
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon'};
const server=http.createServer((req,res)=>{const u=decodeURIComponent(req.url.split('?')[0]);let f=path.join(root,u==='/'?'index.html':u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return}res.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream','cache-control':'no-store'});fs.createReadStream(f).pipe(res)});
const source=fs.readFileSync(path.join(root,'links-game.js'),'utf8').replace('  dbgFn=()=>(',`  window.__card={
    finishNow(opts){const o=Object.assign({practice:false,scores:[4,5,3,6,4,4,3,5,4]},opts||{});
      if(o.len){S.len=o.len}S.holes=cur.holes.filter(h=>h.n<=(S.len==='18'?18:9)).map(h=>h.n);S.scores=o.scores.slice(0,S.holes.length);S.putts=S.scores.map(()=>2);S.fir=[4,7];S.gir=3;S.longest=251.4;S.practice=o.practice;S.idx=S.holes.length-1;finish();const par=S.holes.reduce((a,n)=>a+cur.holes.find(h=>h.n===n).par,0);return{par,tot:S.scores.reduce((a,b)=>a+b,0)};},
    sample(){const im=$('cardimg').querySelector('img');return new Promise(res=>{const i=new Image();i.onload=()=>{const c=document.createElement('canvas');c.width=i.naturalWidth;c.height=i.naturalHeight;const x=c.getContext('2d');x.drawImage(i,0,0);const px=(a,b)=>Array.from(x.getImageData(a,b,1,1).data);res({w:i.naturalWidth,h:i.naturalHeight,header:px(10,25),paper:px(10,1000),gold:px(540,312)});};i.src=im.src;});}
  };
  dbgFn=()=>(`);
assert(source.includes('window.__card'),'hook injected');
const shots=path.join(process.env.SHOT_DIR||'/tmp','links-v264');fs.mkdirSync(shots,{recursive:true});
const near=(a,hex)=>{const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return Math.abs(a[0]-r)<=6&&Math.abs(a[1]-g)<=6&&Math.abs(a[2]-b)<=6&&a[3]===255};
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,executablePath:process.env.CADDIE_CHROMIUM||(fs.existsSync('/tmp/chromium')?'/tmp/chromium':undefined),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try{
    for(const [width,height] of [[390,844],[320,690]]){
      const ctx=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true,serviceWorkers:'block',acceptDownloads:true}),p=await ctx.newPage();
      const errors=[];p.on('pageerror',e=>errors.push('pageerror: '+e.message));p.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
      await p.route('**/links-game.js',r=>r.fulfill({contentType:'text/javascript',body:source}));
      await p.goto(base+'/');await p.waitForSelector('[data-action="open-links"]');
      await p.waitForFunction(()=>JSON.parse(localStorage.getItem('caddiehq_v1')||'{}').feedApplied?.includes('returned-clubs-history-20261024'),null,{timeout:30000});
      // the theme toggle and the What's-landed seen list are app settings; everything else in golf state must be untouched by the game
      const golf=()=>p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('caddiehq_v1'));delete s.settings;delete s.updates;delete s.seenUpdates;return JSON.stringify(s)});
      const before=await golf();
      await p.locator('[data-action="open-links"]').first().click();
      assert.equal(await p.locator('#lk-courses .cpick').count(),14,'14 course buttons');
      assert.equal(await p.locator('#lk-courses [data-id="wianno"] .best').innerText(),'Not played');
      await p.locator('#lk-courses [data-id="wianno"]').click();await p.locator('#lk-modeseg [data-mode="sling"]').click();await p.locator('#lk-lenseg [data-len="front"]').click();
      await p.locator('#lk-start').click();await p.waitForFunction(()=>CaddieLinks.debug()?.phase==='aim',null,{timeout:30000});
      let d=await p.evaluate(()=>CaddieLinks.debug());assert.equal(d.hole,1);assert(d.scene&&d.scene.triangles>0,'3D scene drew triangles: '+JSON.stringify(d.scene));
      assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow in game');
      // a slingshot pull on the side rail: flight, then back to aim
      const hb=await p.locator('#lk-powerhandle').boundingBox();await p.mouse.move(hb.x+hb.width/2,hb.y+hb.height/2);await p.mouse.down();for(let i=1;i<=6;i++){await p.mouse.move(hb.x+hb.width/2,hb.y+hb.height/2+i*20);await p.waitForTimeout(30)}await p.mouse.up();
      await p.waitForFunction(()=>CaddieLinks.debug()?.phase==='flight',null,{timeout:3000});
      await p.waitForFunction(()=>['aim','done'].includes(CaddieLinks.debug()?.phase),null,{timeout:8000});
      d=await p.evaluate(()=>CaddieLinks.debug());assert(d.strokes===1||d.strokes===2,'one stroke taken (two if the ball found water or OB): '+d.strokes);
      // 2D map canvas paints when the hole map is chosen
      await p.locator('#lk-camtog').click();await p.waitForTimeout(150);
      const painted=await p.evaluate(()=>{const c=document.getElementById('lk-cv'),x=c.getContext('2d'),a=x.getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<a.length;i+=4*97)if(a[i]>0)n++;return n});assert(painted>50,'map canvas painted: '+painted);
      await p.locator('#lk-camtog').click();
      await p.screenshot({path:path.join(shots,`game-${width}.png`)});
      // --- the new feature: finish the nine with fixed scores ---
      const tp=v=>v===0?'E':(v>0?'+':'')+v;
      const r1=await p.evaluate(()=>__card.finishNow());await p.waitForSelector('#lk-end:not([hidden])');const tp1=r1.tot-r1.par;
      assert.equal(await p.locator('#lk-escore').innerText(),tp(tp1));
      assert.match(await p.locator('#lk-erecord').innerText(),/First front 9 round recorded at Wianno/);
      let card=await p.evaluate(()=>__card.sample());assert.equal(card.w,1080);assert.equal(card.h,1190,'9-hole card height');
      assert(near(card.header,'#1E4A38'),'header pine '+card.header);assert(near(card.paper,'#FBF7EC'),'paper '+card.paper);assert(near(card.gold,'#E1B65E'),'gold rule '+card.gold);
      await p.waitForSelector('#lk-savecard:not([hidden])');d=await p.evaluate(()=>CaddieLinks.debug());assert.equal(d.card.save,true);assert.match(d.card.href,/^caddie-links-wianno-\d{4}-\d{2}-\d{2}\.png$/);
      assert.equal(d.records['wianno:front'].length,1);assert.equal(d.records['wianno:front'][0].tp,tp1);
      const img=await p.locator('#lk-cardimg img').boundingBox();assert(img.width<=width-16&&img.width>120,'card preview fits: '+img.width);
      assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow on the end screen');
      // Share falls back to a PNG download where the share sheet is unavailable (headless Chromium)
      const [dl]=await Promise.all([p.waitForEvent('download',{timeout:5000}),p.locator('#lk-sharebtn').click()]);
      assert.match(dl.suggestedFilename(),/^caddie-links-wianno-.*\.png$/);const file=await dl.path();assert(fs.statSync(file).size>20000,'PNG has content');
      if(width===390)fs.copyFileSync(file,path.join(shots,'scorecard-front9.png'));
      await p.locator('#lk-cardimg').scrollIntoViewIfNeeded();await p.screenshot({path:path.join(shots,`end-${width}.png`)});
      // a second round builds the record; a practice round does not
      await p.locator('#lk-again').click();await p.waitForFunction(()=>CaddieLinks.debug()?.phase==='aim',null,{timeout:30000});
      const r2=await p.evaluate(()=>__card.finishNow({scores:[4,4,3,5,4,4,3,5,4]}));await p.waitForSelector('#lk-end:not([hidden])');const tp2=r2.tot-r2.par,avg=(tp1+tp2)/2;
      assert.equal(await p.locator('#lk-etitle').innerText(),'New best round');
      assert.equal(await p.locator('#lk-erecord').innerText().then(t=>t.replace(/\s+/g,' ')),`Your record here · 2 rounds · best ${tp(Math.min(tp1,tp2))} · average ${avg>0?'+':''}${avg.toFixed(1)} · previous: ${tp(tp1)}`);
      // an 18-hole card draws two nines and keeps the 4:5 shape
      await p.locator('#lk-again').click();await p.waitForFunction(()=>CaddieLinks.debug()?.phase==='aim',null,{timeout:30000});
      await p.evaluate(()=>__card.finishNow({len:'18',scores:[4,5,3,6,4,4,3,5,4,4,4,3,5,4,2,3,5,1]}));await p.waitForSelector('#lk-end:not([hidden])');
      card=await p.evaluate(()=>__card.sample());assert.equal(card.w,1080);assert.equal(card.h,1350,'18-hole card height');
      if(width===390){const [dl18]=await Promise.all([p.waitForEvent('download',{timeout:5000}),p.locator('#lk-sharebtn').click()]);fs.copyFileSync(await dl18.path(),path.join(shots,'scorecard-18.png'));}
      d=await p.evaluate(()=>CaddieLinks.debug());assert.equal(d.records['wianno:18'].length,1);
      await p.locator('#lk-again').click();await p.waitForFunction(()=>CaddieLinks.debug()?.phase==='aim',null,{timeout:30000});
      await p.evaluate(()=>__card.finishNow({len:'front',practice:true,scores:[3,3,3,3,3,3,3,3,3]}));await p.waitForSelector('#lk-end:not([hidden])');
      assert.match(await p.locator('#lk-erecord').innerText(),/Practice round · not added/);
      d=await p.evaluate(()=>CaddieLinks.debug());assert.equal(d.records['wianno:front'].length,2,'practice not recorded');
      // the course picker reads Best 18 after one recorded 18, Best of N once there are more
      await p.locator('#lk-menu2').click();assert.match(await p.locator('#lk-courses [data-id="wianno"] .best').innerText().then(t=>t.replace(/\s+/g,' ')),/^Best 18 [-+E]\d*$/);
      await p.evaluate(()=>{const r=JSON.parse(localStorage.getItem('chqlinks:records'));r['wianno:18']=[{tp:3},{tp:1},{tp:5}];localStorage.setItem('chqlinks:records',JSON.stringify(r));const b=JSON.parse(localStorage.getItem('chqlinks:best')||'{}');b['wianno:18']=1;localStorage.setItem('chqlinks:best',JSON.stringify(b))});
      await p.locator('#lk-lenseg [data-len="18"]').click();assert.equal(await p.locator('#lk-courses [data-id="wianno"] .best').innerText().then(t=>t.replace(/\s+/g,' ')),'Best of 3 +1');
      // theme toggle, quit and re-enter
      await p.locator('#lk-start').click();await p.waitForFunction(()=>CaddieLinks.debug()?.phase==='aim',null,{timeout:30000});
      await p.locator('#lk-quit').click();await p.waitForSelector('[data-action="open-links"]');
      await p.locator('.themebtn').click();await p.locator('[data-action="open-links"]').first().click();assert.equal(await p.locator('#lk-courses [data-id="wianno"]').getAttribute('aria-pressed'),'true','remembered course survives re-entry');await p.locator('#lk-start').click();await p.waitForFunction(()=>CaddieLinks.debug()?.phase==='aim',null,{timeout:30000});
      d=await p.evaluate(()=>CaddieLinks.debug());assert.equal(d.course,'wianno');await p.screenshot({path:path.join(shots,`night-${width}.png`)});
      assert.equal(await golf(),before,'golf state unchanged (rounds, carries, clubs, bays, course prep)');
      assert.deepEqual(errors,[],'no page or console errors');
      await ctx.close();console.log(`ok ${width}x${height}: 14 courses, 3D triangles, slingshot stroke, map canvas painted, scorecard 1080x1350 + download, records 1→2 (practice skipped), Best of 3 label, night mode, 0 errors`);
    }
  }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);process.exit(1)});
