// v277 — water ripples in the Links 3D view, checked in a real Chromium (SwiftShader).
// Part 1 isolates the renderer on a synthetic hole with a pond and reads pixels: with ripple:true the water clock
// advances and the surface changes between frames; with ripple:false the clock holds and two frames are identical;
// a hole with no mapped water reports water:false.
// Part 2 drives the real app at 390×844 and 320×690: Overview → Play Links, every directory course listed, Wianno front 9
// (hole 1 has mapped water within range), 3D triangles, ripples alive right after the intro camera and asleep ~4 s after it
// settles (the animation loop stopped), alive again through a slingshot flight and asleep after it, no horizontal overflow,
// the 2D hole map still paints, Night mode, Quit and re-enter, golf state unchanged, zero page/console errors.
// Part 3: prefers-reduced-motion keeps the water still even where there is water.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
let chromium;try{({chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright'))}catch{({chromium}=require('playwright'))}
const root=path.join(__dirname,'..');
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon'};
const server=http.createServer((req,res)=>{const u=decodeURIComponent(req.url.split('?')[0]);if(u==='/favicon.ico'){res.writeHead(204);res.end();return}if(u==='/water-fixture'){res.writeHead(200,{'content-type':'text/html'});res.end('<!doctype html><html><body style="margin:0"><canvas id="scene" style="width:390px;height:700px"></canvas></body></html>');return}let f=path.join(root,u==='/'?'index.html':u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return}res.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream','cache-control':'no-store'});fs.createReadStream(f).pipe(res)});
const shots=path.join(process.env.SHOT_DIR||'/tmp','links-v277');fs.mkdirSync(shots,{recursive:true});
const lum=rgb=>rgb[0]*.3+rgb[1]*.59+rgb[2]*.11;
const RIPPLE_MS=4000; // links-game.js RIPPLE_MS
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,executablePath:process.env.CADDIE_CHROMIUM||(fs.existsSync('/tmp/chromium')?'/tmp/chromium':undefined),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try{
    // ---- part 1: the renderer alone, pixels read back from WebGL ----
    {
      const p=await browser.newPage({viewport:{width:390,height:700}}),errors=[];p.on('pageerror',e=>errors.push('pageerror: '+e.message));p.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
      await p.goto(base+'/water-fixture');
      const r=await p.evaluate(async()=>{
        const canvas=document.getElementById('scene'),{create}=await import('/links-scene.js'),scene=await create(canvas);
        const rect=(kind,x,y,w,h)=>({kind,pts:[x-w,y-h,x+w,y-h,x+w,y+h,x-w,y+h],bb:[x-w,y-h,x+w,y+h]});
        const hole={n:1,tee:[0,0],path:[[0,0],[0,400]],pin:[0,400]};
        const pond=rect('water',-8,60,6,12); // just left of the line, 48–72 yd out, inside the tee camera's view
        const course={id:'water-fixture',feats:[rect('fairway',0,220,60,200),pond,rect('green',0,400,14,14)],trees:[]};
        const dry={id:'dry-fixture',feats:[rect('fairway',0,220,60,200),rect('green',0,400,14,14)],trees:[]};
        const gl=canvas.getContext('webgl2'),px=new Uint8Array(4);
        const read=(x,y)=>{const q=scene.project([x,y],.06);const ix=Math.round(q[0]),iy=Math.round(q[1]);if(ix<0||ix>389||iy<0||iy>699)return null;gl.readPixels(ix,699-iy,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);return{sx:ix,sy:iy,rgb:Array.from(px).slice(0,3)}};
        const samples=[[-8,60],[-10,54],[-6,66],[-8,50],[-8,70]];
        const state={course,h:hole,ballState:{ball:[0,0],lie:'tee',club:{id:'Dr'},power:0},anim:null,angle:0};
        const frame=(ripple)=>{scene.render({...state,ripple});return samples.map(s=>read(...s))};
        const sleep=ms=>new Promise(r=>setTimeout(r,ms));
        scene.reset();const first=frame(true);const t0=scene.info().waterTime;
        for(let i=0;i<8;i++){await sleep(120);frame(true)} // each frame adds up to 0.1 s of water time
        const later=frame(true),t1=scene.info().waterTime,infoLive=scene.info();
        // now ask for no ripples: the clock holds and two frames read the same
        await sleep(120);const stillA=frame(false),t2=scene.info().waterTime;await sleep(120);const stillB=frame(false),t3=scene.info().waterTime;
        // a hole with no water nearby reports none
        scene.reset();scene.render({...state,course:dry,ripple:true});const dryInfo=scene.info();
        scene.reset();scene.render({...state,ripple:true}); // leave the pond up for the screenshot
        window.__scene=scene;
        return{first,later,stillA,stillB,t0,t1,t2,t3,infoLive,dryInfo};
      });
      await p.screenshot({path:path.join(shots,'renderer-fixture.png')});await p.evaluate(()=>window.__scene.dispose());
      assert.deepEqual(errors,[]);
      assert(r.infoLive.water===true,'fixture hole reports mapped water');
      assert(r.dryInfo.water===false,'dry hole reports no water');
      assert(r.first.every(Boolean)&&r.later.every(Boolean),'all pond samples on screen '+JSON.stringify(r.first));
      assert(r.t1-r.t0>0.5&&r.t1-r.t0<=0.9+1e-9,'water clock advanced by the frames\' elapsed time (capped 0.1 s each): '+(r.t1-r.t0).toFixed(3));
      const moved=Math.max(...r.first.map((a,i)=>Math.abs(lum(a.rgb)-lum(r.later[i].rgb))));
      assert(moved>6,'the surface changed while rippling (max luminance change '+moved.toFixed(1)+'): '+JSON.stringify([r.first.map(s=>s.rgb),r.later.map(s=>s.rgb)]));
      assert(r.first.every(s=>s.rgb[2]>=s.rgb[0]),'the pond reads blue-green, not grass: '+JSON.stringify(r.first.map(s=>s.rgb)));
      assert.equal(r.t2,r.t1,'ripple:false holds the clock');assert.equal(r.t3,r.t2,'…and keeps holding it');
      assert.deepEqual(r.stillA.map(s=>s.rgb),r.stillB.map(s=>s.rgb),'a resting pond draws the same pixels twice');
      await p.close();
      console.log('ok renderer: clock +'+(r.t1-r.t0).toFixed(2)+' s while rippling, held at rest · max pixel change '+moved.toFixed(1)+' · pond sample',r.first[0].rgb);
    }
    // ---- part 2: the real app on two phones ----
    for(const [width,height] of [[390,844],[320,690]]){
      const ctx=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true,serviceWorkers:'block'}),p=await ctx.newPage();
      const errors=[];p.on('pageerror',e=>errors.push('pageerror: '+e.message));p.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
      await p.goto(base+'/');await p.waitForSelector('[data-action="open-links"]');
      await p.waitForFunction(()=>JSON.parse(localStorage.getItem('caddiehq_v1')||'{}').feedApplied?.includes('returned-clubs-history-20261024'),null,{timeout:30000});
      const golf=()=>p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('caddiehq_v1'));delete s.settings;delete s.updates;delete s.seenUpdates;return JSON.stringify(s)});
      const before=await golf();
      await p.locator('[data-action="open-links"]').first().click();
      const nCourses=await p.evaluate(()=>window.CADDIE_PREP_COURSES.length);assert(nCourses>=14,'directory lists at least the 14 v264 courses: '+nCourses);
      assert.equal(await p.locator('#lk-courses .cpick').count(),nCourses,nCourses+' course buttons');
      await p.locator('#lk-courses [data-id="wianno"]').click();await p.locator('#lk-modeseg [data-mode="sling"]').click();await p.locator('#lk-lenseg [data-len="front"]').click();
      await p.locator('#lk-start').click();await p.waitForFunction(()=>CaddieLinks.debug()?.phase==='aim',null,{timeout:30000});await p.waitForTimeout(600);
      let d=await p.evaluate(()=>CaddieLinks.debug());assert.equal(d.hole,1);assert.equal(d.renderer,'3d');assert(d.scene&&d.scene.triangles>0,'3D scene drew triangles: '+JSON.stringify(d.scene));
      assert(d.water&&d.water.has===true,'Wianno hole 1 has mapped water in range: '+JSON.stringify(d.water));
      assert(d.water.rippling===true,'water is rippling right after the intro camera: '+JSON.stringify(d.water));
      assert(d.scene.waterTime>0,'the water clock has run: '+d.scene.waterTime);
      assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow in game');
      const painted=await p.evaluate(()=>{CaddieLinks.debug().drawMs();const c=document.getElementById('lk-cv3'),gl=c.getContext('webgl2'),px=new Uint8Array(4);let n=0;for(let i=0;i<40;i++){gl.readPixels(Math.floor(c.width*(i+.5)/40),Math.floor(c.height*.5),1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);if(px[3]>0&&px[0]+px[1]+px[2]>0)n++}return n});
      assert(painted>30,'3D canvas painted: '+painted);
      const drawMs=await p.evaluate(()=>CaddieLinks.debug().drawMs());
      await p.screenshot({path:path.join(shots,`tee-${width}.png`)});
      // leave it alone: the ripples rest once the window after the last motion runs out, and the frame loop stops with them
      await p.waitForFunction(()=>{const w=CaddieLinks.debug().water;return w.rippling===false&&w.loop===false},null,{timeout:RIPPLE_MS+6000});
      const rest=await p.evaluate(()=>CaddieLinks.debug());const tRest=rest.scene.waterTime;
      await p.waitForTimeout(400);d=await p.evaluate(()=>CaddieLinks.debug());assert.equal(d.scene.waterTime,tRest,'the water clock holds while the game rests');
      assert.equal(d.water.loop,false,'no animation frame pending at rest');
      const hb=await p.locator('#lk-powerhandle').boundingBox();await p.mouse.move(hb.x+hb.width/2,hb.y+hb.height/2);await p.mouse.down();for(let i=1;i<=6;i++){await p.mouse.move(hb.x+hb.width/2,hb.y+hb.height/2+i*20);await p.waitForTimeout(30)}await p.mouse.up();
      await p.waitForFunction(()=>CaddieLinks.debug()?.phase==='flight',null,{timeout:3000});
      const mid=await p.evaluate(()=>CaddieLinks.debug());assert(mid.water.rippling===true,'water moves during the flight: '+JSON.stringify(mid.water));assert(mid.scene.waterTime>tRest,'the clock runs again in flight');
      await p.screenshot({path:path.join(shots,`flight-${width}.png`)});
      await p.waitForFunction(()=>['aim','done'].includes(CaddieLinks.debug()?.phase),null,{timeout:8000});
      d=await p.evaluate(()=>CaddieLinks.debug());assert(d.strokes===1||d.strokes===2,'one stroke taken (two if the ball found water or OB): '+d.strokes);
      await p.waitForFunction(()=>{const w=CaddieLinks.debug().water;return w.rippling===false&&w.loop===false},null,{timeout:RIPPLE_MS+8000});
      // the 2D hole map still paints
      await p.locator('#lk-camtog').click();await p.waitForTimeout(150);
      const map=await p.evaluate(()=>{const c=document.getElementById('lk-cv'),x=c.getContext('2d'),a=x.getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<a.length;i+=4*97)if(a[i]>0)n++;return n});assert(map>50,'map canvas painted: '+map);
      d=await p.evaluate(()=>CaddieLinks.debug());assert.equal(d.renderer,'map');assert.equal(d.water.rippling,false,'no ripple frames asked for in the 2D map');
      await p.locator('#lk-camtog').click();
      // quit, flip to Night mode, come back in
      await p.locator('#lk-quit').click();await p.waitForSelector('[data-action="open-links"]');
      await p.locator('[data-action="toggle-theme"]').first().click();await p.waitForTimeout(100);
      await p.locator('[data-action="open-links"]').first().click();await p.locator('#lk-start').click();await p.waitForFunction(()=>CaddieLinks.debug()?.phase==='aim',null,{timeout:30000});await p.waitForTimeout(600);
      d=await p.evaluate(()=>CaddieLinks.debug());assert.equal(d.course,'wianno','remembered course after re-entry');assert.equal(d.renderer,'3d');assert.equal(d.water.has,true);
      await p.screenshot({path:path.join(shots,`night-${width}.png`)});
      await p.locator('#lk-quit').click();await p.waitForSelector('[data-action="open-links"]');
      assert.equal(await golf(),before,'golf state untouched');
      assert.deepEqual(errors,[],'no page or console errors');
      console.log(`ok ${width}×${height}: ${nCourses} courses · 3D ${d.scene.triangles} triangles · drawMs ${drawMs.toFixed(2)} · ripples: alive after intro → asleep (loop stopped) → alive in flight → asleep · map paints · night · quit/re-enter · golf state unchanged`);
      await ctx.close();
    }
    // ---- part 3: reduced motion keeps the water still ----
    {
      const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,serviceWorkers:'block',reducedMotion:'reduce'}),p=await ctx.newPage();
      const errors=[];p.on('pageerror',e=>errors.push('pageerror: '+e.message));p.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
      await p.goto(base+'/');await p.waitForSelector('[data-action="open-links"]');
      await p.locator('[data-action="open-links"]').first().click();
      await p.locator('#lk-courses [data-id="wianno"]').click();await p.locator('#lk-lenseg [data-len="front"]').click();
      await p.locator('#lk-start').click();await p.waitForFunction(()=>CaddieLinks.debug()?.phase==='aim',null,{timeout:30000});await p.waitForTimeout(600);
      const d=await p.evaluate(()=>CaddieLinks.debug());assert.equal(d.renderer,'3d');assert.equal(d.water.has,true);
      assert.equal(d.water.rippling,false,'reduced motion: water never ripples');assert.equal(d.scene.waterTime,0,'reduced motion: the water clock never runs');
      await p.screenshot({path:path.join(shots,'reduced-390.png')});
      assert.deepEqual(errors,[],'no page or console errors');
      console.log('ok reduced motion: water present, still, clock at 0');
      await ctx.close();
    }
    console.log('PASS links-water-browser · screenshots in',shots);
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
