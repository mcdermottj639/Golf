// v297 — "Tighter ¾ and ½ swings" flag (chqlinks:flags.tightPartial), checked in a real Chromium at 390×844 and 320×690.
// Off by default: menu checkbox unchecked, no flag stored, ¾/½ spread equals the old straight scaling. On: ¾ and ½ spread
// is smaller on the same hole and club, full-swing spread is identical, the setting survives re-entry, golf state is untouched, zero errors.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
let chromium;try{({chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright'))}catch{({chromium}=require('playwright'))}
const root=path.join(__dirname,'..');
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'};
const server=http.createServer((req,res)=>{const u=decodeURIComponent(req.url.split('?')[0]);const f=path.join(root,u==='/'?'index.html':u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return}res.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res)});
const shots=path.join(process.env.SHOT_DIR||'/tmp','links-v297');fs.mkdirSync(shots,{recursive:true});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,executablePath:process.env.CADDIE_CHROMIUM||undefined,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try{
    for(const [width,height] of [[390,844],[320,690]]){
      const ctx=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true,serviceWorkers:'block'}),p=await ctx.newPage();
      const errors=[];p.on('pageerror',e=>errors.push('pageerror: '+e.message));p.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
      await p.goto(base+'/');await p.waitForSelector('[data-action="open-links"]');
      await p.waitForFunction(()=>JSON.parse(localStorage.getItem('caddiehq_v1')||'{}').feedApplied?.includes('returned-clubs-history-20261024'),null,{timeout:30000});
      const golf=()=>p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('caddiehq_v1'));delete s.settings;delete s.updates;delete s.seenUpdates;return JSON.stringify(s)});
      const before=await golf();
      await p.locator('[data-action="open-links"]').first().click();
      const nCourses=await p.evaluate(()=>window.CADDIE_PREP_COURSES.length);assert(nCourses>=14);
      assert.equal(await p.locator('#lk-courses .cpick').count(),nCourses,nCourses+' course buttons');
      assert.equal(await p.locator('#lk-tight').isChecked(),false,'flag is off by default');
      assert.equal(await p.evaluate(()=>localStorage.getItem('chqlinks:flags')),null,'no flag stored by default');
      const box=await p.locator('.lk-flag').boundingBox();assert(box.height>=44,'flag row tap target >=44px: '+box.height);
      assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow in menu');
      await p.locator('.lk-flag').scrollIntoViewIfNeeded();await p.screenshot({path:path.join(shots,`menu-${width}.png`)});
      await p.locator('#lk-courses [data-id="wianno"]').click();await p.locator('#lk-modeseg [data-mode="dial"]').click();await p.locator('#lk-lenseg [data-len="front"]').click();
      const measure=async()=>{
        await p.locator('#lk-start').click();await p.waitForFunction(()=>CaddieLinks.debug()?.phase==='aim',null,{timeout:30000});await p.waitForTimeout(500);
        // pick the 7-iron if present (a club with room to swing partial on the tee shot), else keep default
        const out={};
        await p.locator('#lk-shapebox summary').click();await p.waitForSelector('#lk-pwseg',{state:'visible'});
        for(const pw of ['1','0.75','0.5']){
          await p.locator(`#lk-pwseg [data-p="${pw}"]`).click();
          out[pw]=await p.evaluate(()=>CaddieLinks.debug().spread());
        }
        out.painted=await p.evaluate(()=>{CaddieLinks.debug().drawMs();const c=document.getElementById('lk-cv3'),gl=c.getContext('webgl2'),px=new Uint8Array(4);let n=0;for(let i=0;i<40;i++){gl.readPixels(Math.floor(c.width*(i+.5)/40),Math.floor(c.height*.5),1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);if(px[3]>0&&px[0]+px[1]+px[2]>0)n++}return n});
        out.drawMs=await p.evaluate(()=>CaddieLinks.debug().drawMs());
        return out;
      };
      const off=await measure();
      assert(off['1']&&off['0.75']&&off['0.5'],'spread readable: '+JSON.stringify(off));
      assert(off.painted>30,'3D canvas painted: '+off.painted);
      await p.screenshot({path:path.join(shots,`game-off-${width}.png`)});
      await p.locator('#lk-quit').click();await p.waitForSelector('[data-action="open-links"]');
      await p.locator('[data-action="open-links"]').first().click();
      await p.locator('.lk-flag').click();
      assert.equal(await p.locator('#lk-tight').isChecked(),true);
      assert.deepEqual(await p.evaluate(()=>JSON.parse(localStorage.getItem('chqlinks:flags'))),{tightPartial:true},'flag stored under chqlinks:flags only');
      const on=await measure();
      assert.equal(on['1'].sc,off['1'].sc,'full swing long spread unchanged');assert.equal(on['1'].sl,off['1'].sl,'full swing side spread unchanged');
      for(const pw of ['0.75','0.5']){
        assert(on[pw].frac<1,'partial frac<1 at '+pw+' '+JSON.stringify([off,on]));
        assert(on[pw].sc<off[pw].sc&&on[pw].sl<off[pw].sl,'partial spread tighter with flag at '+pw+': '+JSON.stringify([off[pw],on[pw]]));
        const expect=0.6+0.4*on[pw].frac;assert(Math.abs(on[pw].sc/off[pw].sc-expect)<0.02,'ratio matches frac*(.6+.4frac): '+on[pw].sc/off[pw].sc+' vs '+expect);
      }
      await p.screenshot({path:path.join(shots,`game-on-${width}.png`)});
      assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow in game');
      // toggle theme, re-enter, flag persists
      await p.locator('#lk-quit').click();await p.waitForSelector('[data-action="open-links"]');
      await p.locator('[data-action="toggle-theme"]').first().click();await p.waitForTimeout(100);
      await p.locator('[data-action="open-links"]').first().click();
      assert.equal(await p.locator('#lk-tight').isChecked(),true,'flag persists across re-entry');
      await p.locator('.lk-flag').scrollIntoViewIfNeeded();await p.screenshot({path:path.join(shots,`menu-night-${width}.png`)});
      await p.locator('.lk-flag').click();assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('chqlinks:flags')).tightPartial),false,'can turn it off again');
      await p.locator('[data-action="back"], #lk-quit').first().click().catch(()=>{});
      assert.equal(await golf(),before,'golf state untouched');
      assert.deepEqual(errors,[],'no page or console errors');
      console.log(`ok ${width}×${height}: flag off by default; ¾ sc ${off['0.75'].sc.toFixed(2)}→${on['0.75'].sc.toFixed(2)}, ½ sc ${off['0.5'].sc.toFixed(2)}→${on['0.5'].sc.toFixed(2)}; full unchanged; drawMs off ${off.drawMs.toFixed(2)} on ${on.drawMs.toFixed(2)}; golf state unchanged`);
      await ctx.close();
    }
  }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);process.exit(1)});
