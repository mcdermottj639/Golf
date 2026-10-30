// v267 (PR #81, authored as v265) — sun-cast shadows in the Links 3D view, checked in a real Chromium (SwiftShader).
// Part 1 isolates the renderer on a synthetic hole and reads pixels: a tree's shadow darkens the ground
// on the far side from the sun and not on the near side, the flagstick throws a strip the same way, and the
// ball's shadow slides away from the sun by height × cot(elevation) in flight while staying under a ball at rest.
// Part 2 drives the real app at 390×844 and 320×690: Overview → Play Links, every directory course listed, Wianno, 3D triangles,
// one slingshot pull (flight → aim), no horizontal overflow, Night mode, Quit and re-enter, zero page/console errors.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
let chromium;try{({chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright'))}catch{({chromium}=require('playwright'))}
const root=path.join(__dirname,'..');
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon'};
const server=http.createServer((req,res)=>{const u=decodeURIComponent(req.url.split('?')[0]);if(u==='/favicon.ico'){res.writeHead(204);res.end();return}if(u==='/shadow-fixture'){res.writeHead(200,{'content-type':'text/html'});res.end('<!doctype html><html><body style="margin:0"><canvas id="scene" style="width:390px;height:700px"></canvas></body></html>');return}let f=path.join(root,u==='/'?'index.html':u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return}res.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream','cache-control':'no-store'});fs.createReadStream(f).pipe(res)});
const shots=path.join(process.env.SHOT_DIR||'/tmp','links-v267');fs.mkdirSync(shots,{recursive:true});
const lum=rgb=>rgb[0]*.3+rgb[1]*.59+rgb[2]*.11;
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,executablePath:process.env.CADDIE_CHROMIUM||(fs.existsSync('/tmp/chromium')?'/tmp/chromium':undefined),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try{
    // ---- part 1: the renderer alone, pixels read back from WebGL ----
    {
      const p=await browser.newPage({viewport:{width:390,height:700}}),errors=[];p.on('pageerror',e=>errors.push('pageerror: '+e.message));p.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
      await p.goto(base+'/shadow-fixture');
      const r=await p.evaluate(async()=>{
        const canvas=document.getElementById('scene'),{create}=await import('/links-scene.js'),scene=await create(canvas);
        const rect=(kind,x,y,w,h)=>({kind,pts:[x-w,y-h,x+w,y-h,x+w,y+h,x-w,y+h],bb:[x-w,y-h,x+w,y+h]});
        const hole={n:1,tee:[0,0],path:[[0,0],[0,400]],pin:[0,400]};
        const tree={p:[-4,40],r:6,s:.5},height=tree.r*(2.8+tree.s*.8); // the renderer's own height rule
        const course={id:'shadow-fixture',feats:[rect('fairway',0,220,60,200),rect('green',0,400,14,14)],trees:[tree]};
        const gl=canvas.getContext('webgl2'),px=new Uint8Array(4);
        const read=(x,y)=>{const q=scene.project([x,y],.12);const ix=Math.round(q[0]),iy=Math.round(q[1]);if(ix<0||ix>389||iy<0||iy>699)return null;gl.readPixels(ix,699-iy,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);return{sx:ix,sy:iy,rgb:Array.from(px).slice(0,3)}};
        // at rest on the tee (camera 18 back, 11 up): the tree's shadow should lie on the sun-away side of its trunk
        scene.reset();scene.render({course,h:hole,ballState:{ball:[0,0],lie:'tee',club:{id:'Dr'},power:0},anim:null,angle:0});
        const info=scene.info(),[dx,dz]=info.sun.dir,st=info.sun.stretch,hc=height*.62;
        const toWorld=(x,z)=>[x,-z]; // scene z runs south; game y runs north
        const shadowCentre=toWorld(tree.p[0]+dx*hc*st,-tree.p[1]+dz*hc*st),mirror=toWorld(tree.p[0]-dx*hc*st,-tree.p[1]-dz*hc*st);
        const rest={info,shadow:read(...shadowCentre),mirror:read(...mirror),open:read(20,120),ballShadow:info.ballShadow,ballPos:info.ballPos,poleShadow:info.poleShadow};
        // in flight at 20 yd up over (0,40): the shadow is on the ground, away from the sun, by 20 × cot(elevation)
        const anim={kind:'shot',b:[0,0],pos:[0,40],t0:performance.now()-500000,dur:1000000,apex:20,trail:[]};
        scene.reset();scene.render({course,h:hole,ballState:{ball:[0,0],lie:'tee',club:{id:'Dr'},power:0},anim,angle:0});
        const fi=scene.info();
        window.__scene=scene; // disposed after the screenshot below
        return{rest,flight:{ballShadow:fi.ballShadow,ballPos:fi.ballPos},sun:info.sun,stretch:st,dir:[dx,dz]};
      });
      await p.screenshot({path:path.join(shots,'renderer-fixture.png')});await p.evaluate(()=>window.__scene.dispose());
      assert.deepEqual(errors,[]);
      assert(Math.abs(r.sun.elevationDeg-49.7)<.2,'sun elevation '+r.sun.elevationDeg);
      assert(r.dir[0]>0&&r.dir[1]<0,'shadows fall east and north of a south-west sun: '+r.dir);
      assert(r.rest.shadow&&r.rest.mirror&&r.rest.open,'all three sample points on screen '+JSON.stringify(r.rest));
      assert(lum(r.rest.shadow.rgb)<lum(r.rest.mirror.rgb)-8,'ground under the thrown shadow is darker than the mirrored point: '+JSON.stringify([r.rest.shadow,r.rest.mirror]));
      assert(lum(r.rest.shadow.rgb)<lum(r.rest.open.rgb)-8,'…and darker than open fairway: '+JSON.stringify([r.rest.shadow,r.rest.open]));
      assert(Math.abs(lum(r.rest.mirror.rgb)-lum(r.rest.open.rgb))<14,'the sun side of the trunk stays unshaded: '+JSON.stringify([r.rest.mirror,r.rest.open]));
      // ball at rest: shadow directly beneath; in flight: offset = height × stretch along the sun's ground direction
      assert(Math.hypot(r.rest.ballShadow[0]-r.rest.ballPos[0],r.rest.ballShadow[2]-r.rest.ballPos[2])<.05,'rest shadow under the ball');
      const off=[r.flight.ballShadow[0]-r.flight.ballPos[0],r.flight.ballShadow[2]-r.flight.ballPos[2]],want=20*r.stretch;
      assert(Math.abs(Math.hypot(...off)-want)<.05,'flight shadow offset '+Math.hypot(...off).toFixed(2)+' vs '+want.toFixed(2));
      assert(Math.abs(off[0]/Math.hypot(...off)-r.dir[0])<.01&&Math.abs(off[1]/Math.hypot(...off)-r.dir[1])<.01,'flight shadow lies along the sun direction');
      // the flagstick's strip starts at the pin (scene z = -400) and runs the same way
      const ps=r.rest.poleShadow;assert(Math.abs(ps[0]-1.5*r.stretch*r.dir[0])<.01&&Math.abs(ps[2]+400-1.5*r.stretch*r.dir[1])<.01,'pole shadow centred 1.5 × stretch from the pin: '+ps);
      await p.close();
      console.log('ok renderer: tree shadow',r.rest.shadow.rgb,'mirror',r.rest.mirror.rgb,'open',r.rest.open.rgb,'· flight offset',Math.hypot(...off).toFixed(2),'yd at 20 yd up');
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
      // one button per course in the generated directory (14 at v264, 19 after the v266 course batch) — read the directory, never a fixed number
      const nCourses=await p.evaluate(()=>window.CADDIE_PREP_COURSES.length);assert(nCourses>=14,'directory lists at least the 14 v264 courses: '+nCourses);
      assert.equal(await p.locator('#lk-courses .cpick').count(),nCourses,nCourses+' course buttons');
      await p.locator('#lk-courses [data-id="wianno"]').click();await p.locator('#lk-modeseg [data-mode="sling"]').click();await p.locator('#lk-lenseg [data-len="front"]').click();
      await p.locator('#lk-start').click();await p.waitForFunction(()=>CaddieLinks.debug()?.phase==='aim',null,{timeout:30000});await p.waitForTimeout(900);
      let d=await p.evaluate(()=>CaddieLinks.debug());assert.equal(d.hole,1);assert.equal(d.renderer,'3d');assert(d.scene&&d.scene.triangles>0,'3D scene drew triangles: '+JSON.stringify(d.scene));
      assert(d.scene.sun&&d.scene.ballShadow,'scene info carries the sun and the ball shadow');
      assert(Math.hypot(d.scene.ballShadow[0]-d.scene.ballPos[0],d.scene.ballShadow[2]-d.scene.ballPos[2])<.05,'tee ball: shadow beneath it');
      assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow in game');
      // WebGL's buffer is cleared once composited, so draw and read back inside one task (debug().drawMs() draws 30 frames synchronously)
      const painted=await p.evaluate(()=>{CaddieLinks.debug().drawMs();const c=document.getElementById('lk-cv3'),gl=c.getContext('webgl2'),px=new Uint8Array(4);let n=0;for(let i=0;i<40;i++){gl.readPixels(Math.floor(c.width*(i+.5)/40),Math.floor(c.height*.5),1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);if(px[3]>0&&px[0]+px[1]+px[2]>0)n++}return n});
      assert(painted>30,'3D canvas painted: '+painted);
      const drawMs=await p.evaluate(()=>CaddieLinks.debug().drawMs());
      await p.screenshot({path:path.join(shots,`tee-${width}.png`)});
      const hb=await p.locator('#lk-powerhandle').boundingBox();await p.mouse.move(hb.x+hb.width/2,hb.y+hb.height/2);await p.mouse.down();for(let i=1;i<=6;i++){await p.mouse.move(hb.x+hb.width/2,hb.y+hb.height/2+i*20);await p.waitForTimeout(30)}await p.mouse.up();
      await p.waitForFunction(()=>CaddieLinks.debug()?.phase==='flight',null,{timeout:3000});
      // mid-flight the shadow has left the ball's ground point, along the sun's direction
      const mid=await p.evaluate(()=>CaddieLinks.debug());if(mid.scene&&mid.scene.ballPos[1]>2){const o=[mid.scene.ballShadow[0]-mid.scene.ballPos[0],mid.scene.ballShadow[2]-mid.scene.ballPos[2]];assert(Math.hypot(...o)>1,'flight shadow has moved off the ball: '+o)}
      await p.screenshot({path:path.join(shots,`flight-${width}.png`)});
      await p.waitForFunction(()=>['aim','done'].includes(CaddieLinks.debug()?.phase),null,{timeout:8000});
      d=await p.evaluate(()=>CaddieLinks.debug());assert(d.strokes===1||d.strokes===2,'one stroke taken (two if the ball found water or OB): '+d.strokes);
      // the 2D hole map still paints
      await p.locator('#lk-camtog').click();await p.waitForTimeout(150);
      const map=await p.evaluate(()=>{const c=document.getElementById('lk-cv'),x=c.getContext('2d'),a=x.getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<a.length;i+=4*97)if(a[i]>0)n++;return n});assert(map>50,'map canvas painted: '+map);
      await p.locator('#lk-camtog').click();
      // quit, flip to Night mode, come back in
      await p.locator('#lk-quit').click();await p.waitForSelector('[data-action="open-links"]');
      await p.locator('[data-action="toggle-theme"]').first().click();await p.waitForTimeout(100);
      await p.locator('[data-action="open-links"]').first().click();await p.locator('#lk-start').click();await p.waitForFunction(()=>CaddieLinks.debug()?.phase==='aim',null,{timeout:30000});await p.waitForTimeout(600);
      d=await p.evaluate(()=>CaddieLinks.debug());assert.equal(d.course,'wianno','remembered course after re-entry');assert.equal(d.renderer,'3d');
      await p.screenshot({path:path.join(shots,`night-${width}.png`)});
      await p.locator('#lk-quit').click();await p.waitForSelector('[data-action="open-links"]');
      assert.equal(await golf(),before,'golf state untouched');
      assert.deepEqual(errors,[],'no page or console errors');
      console.log(`ok ${width}×${height}: ${nCourses} courses · 3D ${d.scene.triangles} triangles · drawMs ${drawMs.toFixed(2)} · flight→aim · map paints · night · quit/re-enter · golf state unchanged`);
      await ctx.close();
    }
    console.log('PASS links-shadows-browser · screenshots in',shots);
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
