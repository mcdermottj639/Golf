// v294 — sunlit canopies in the Links 3D view, checked in a real Chromium (SwiftShader).
// Part 1 isolates the renderer on a synthetic hole with one big tree and reads WebGL pixels: the side of the crown toward
// the sun is brighter and warmer than the far side, info().leafSun is a unit vector in camera space, and the crown is still drawn.
// Part 2 drives the real app at 390×844 and 320×690 (Wianno front 9): 3D triangles, canvas paints, trees on screen, no overflow,
// slingshot flight -> aim, 2D map paints, Night, Quit and re-enter, golf state unchanged, zero page/console errors. Frame time is reported.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
let chromium;try{({chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright'))}catch{({chromium}=require('playwright'))}
const root=path.join(__dirname,'..');
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon'};
const server=http.createServer((req,res)=>{const u=decodeURIComponent(req.url.split('?')[0]);if(u==='/favicon.ico'){res.writeHead(204);res.end();return}if(u==='/canopy-fixture'){res.writeHead(200,{'content-type':'text/html'});res.end('<!doctype html><html><body style="margin:0"><canvas id="scene" style="width:390px;height:700px"></canvas></body></html>');return}let f=path.join(root,u==='/'?'index.html':u);if(!f.startsWith(root)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return}res.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream','cache-control':'no-store'});fs.createReadStream(f).pipe(res)});
const shots=path.join(process.env.SHOT_DIR||'/tmp','links-v294');fs.mkdirSync(shots,{recursive:true});
const lum=rgb=>rgb[0]*.3+rgb[1]*.59+rgb[2]*.11;
const RIPPLE_MS=4000; // links-game.js RIPPLE_MS

(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,executablePath:process.env.CADDIE_CHROMIUM||(fs.existsSync('/tmp/chromium')?'/tmp/chromium':undefined),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try{
    if(!process.env.BASELINE){
      const p=await browser.newPage({viewport:{width:390,height:700}}),errors=[];p.on('pageerror',e=>errors.push('pageerror: '+e.message));p.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
      await p.goto(base+'/canopy-fixture');
      const r=await p.evaluate(async()=>{
        const canvas=document.getElementById('scene'),{create}=await import('/links-scene.js'),scene=await create(canvas);
        const rect=(kind,x,y,w,h)=>({kind,pts:[x-w,y-h,x+w,y-h,x+w,y+h,x-w,y+h],bb:[x-w,y-h,x+w,y+h]});
        const hole={n:1,tee:[0,0],path:[[0,0],[0,400]],pin:[0,400]};
        const course={id:'canopy-fixture',feats:[rect('fairway',0,220,60,200),rect('green',0,400,14,14)],trees:[{p:[0,34],r:5,s:.5}]};
        const gl=canvas.getContext('webgl2'),px=new Uint8Array(4);
        const read=(x,y,h)=>{const q=scene.project([x,y],h);const ix=Math.round(q[0]),iy=Math.round(q[1]);gl.readPixels(ix,699-iy,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);return{sx:ix,sy:iy,rgb:Array.from(px).slice(0,3)}};
        scene.reset();scene.render({course,h:hole,ballState:{ball:[0,0],lie:'tee',club:{id:'Dr'},power:0},anim:null,angle:0});
        const info=scene.info();
        // crown centre is ~height/2 up; read a column pair either side of it at the crown's own height
        const ht=5*(2.8+.5*.8),hy=ht*.5;const rows=[];
        for(const off of [-2.6,2.6])for(const dy of [-1.5,0,1.5]) rows.push({off,dy,...read(off,34,hy+dy)});
        window.__scene=scene;return{info,rows,ht};
      });
      await p.screenshot({path:path.join(shots,'renderer-fixture.png')});await p.evaluate(()=>window.__scene.dispose());
      assert.deepEqual(errors,[]);
      const v=r.info.leafSun,len=Math.hypot(...v);assert(Math.abs(len-1)<1e-3,'leafSun is a unit vector: '+JSON.stringify(v));
      assert(Math.abs(v[0])>.1,'the sun is off to one side of the camera view: '+JSON.stringify(v));
      // camera-space +x is screen-right, so the sun side is the right column when v[0]>0
      const litSign=v[0]>0?1:-1;
      const col=sign=>r.rows.filter(x=>Math.sign(x.off)===sign).map(x=>x.rgb);
      const avg=a=>a.reduce((s,c)=>[s[0]+c[0],s[1]+c[1],s[2]+c[2]],[0,0,0]).map(x=>x/a.length);
      const litC=avg(col(litSign)),darkC=avg(col(-litSign));
      assert(lum(litC)>lum(darkC)+8,'sun side brighter than far side: '+JSON.stringify({litC,darkC,rows:r.rows}));
      assert((litC[0]-litC[2])>(darkC[0]-darkC[2])+4,'sun side warmer (red minus blue) than far side: '+JSON.stringify({litC,darkC}));
      await p.close();
      console.log('ok renderer: leafSun',v.map(x=>x.toFixed(2)).join(','),'· lit',litC.map(Math.round),'· far',darkC.map(Math.round));
    }
    for(const [width,height] of [[390,844],[320,690]]){
      const ctx=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true,serviceWorkers:'block'}),p=await ctx.newPage();
      const errors=[];p.on('pageerror',e=>errors.push('pageerror: '+e.message));p.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
      await p.goto(base+'/');await p.waitForSelector('[data-action="open-links"]');
      await p.waitForFunction(()=>JSON.parse(localStorage.getItem('caddiehq_v1')||'{}').feedApplied?.includes('returned-clubs-history-20261024'),null,{timeout:30000});
      const golf=()=>p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('caddiehq_v1'));delete s.settings;delete s.updates;delete s.seenUpdates;return JSON.stringify(s)});
      const before=await golf();
      await p.locator('[data-action="open-links"]').first().click();
      const nCourses=await p.evaluate(()=>window.CADDIE_PREP_COURSES.length);assert(nCourses>=14,'directory lists at least 14 courses: '+nCourses);
      assert.equal(await p.locator('#lk-courses .cpick').count(),nCourses);
      await p.locator('#lk-courses [data-id="wianno"]').click();await p.locator('#lk-modeseg [data-mode="sling"]').click();await p.locator('#lk-lenseg [data-len="front"]').click();
      await p.locator('#lk-start').click();await p.waitForFunction(()=>CaddieLinks.debug()?.phase==='aim',null,{timeout:30000});await p.waitForTimeout(800);
      let d=await p.evaluate(()=>CaddieLinks.debug());assert.equal(d.renderer,'3d');assert(d.scene.triangles>0);
      const ls=d.scene.leafSun;if(!process.env.BASELINE)assert(Array.isArray(ls)&&Math.abs(Math.hypot(...ls)-1)<1e-3,'leafSun unit vector in app: '+JSON.stringify(ls));
      assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
      const painted=await p.evaluate(()=>{CaddieLinks.debug().drawMs();const c=document.getElementById('lk-cv3'),gl=c.getContext('webgl2'),px=new Uint8Array(4);let n=0;for(let i=0;i<40;i++){gl.readPixels(Math.floor(c.width*(i+.5)/40),Math.floor(c.height*.5),1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);if(px[3]>0&&px[0]+px[1]+px[2]>0)n++}return n});assert(painted>30,'3D canvas painted: '+painted);
      const ms=[];for(let i=0;i<3;i++)ms.push(await p.evaluate(()=>CaddieLinks.debug().drawMs()));const drawMs=ms.sort((a,b)=>a-b)[1];
      await p.screenshot({path:path.join(shots,`tee-${width}.png`)});
      const hb=await p.locator('#lk-powerhandle').boundingBox();await p.mouse.move(hb.x+hb.width/2,hb.y+hb.height/2);await p.mouse.down();for(let i=1;i<=6;i++){await p.mouse.move(hb.x+hb.width/2,hb.y+hb.height/2+i*20);await p.waitForTimeout(30)}await p.mouse.up();
      await p.waitForFunction(()=>CaddieLinks.debug()?.phase==='flight',null,{timeout:3000});
      await p.screenshot({path:path.join(shots,`flight-${width}.png`)});
      await p.waitForFunction(()=>['aim','done'].includes(CaddieLinks.debug()?.phase),null,{timeout:8000});
      await p.locator('#lk-camtog').click();await p.waitForTimeout(150);
      const map=await p.evaluate(()=>{const c=document.getElementById('lk-cv'),x=c.getContext('2d'),a=x.getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<a.length;i+=4*97)if(a[i]>0)n++;return n});assert(map>50,'map painted: '+map);
      await p.locator('#lk-camtog').click();
      await p.locator('#lk-quit').click();await p.waitForSelector('[data-action="open-links"]');
      await p.locator('[data-action="toggle-theme"]').first().click();await p.waitForTimeout(100);
      await p.locator('[data-action="open-links"]').first().click();await p.locator('#lk-start').click();await p.waitForFunction(()=>CaddieLinks.debug()?.phase==='aim',null,{timeout:30000});await p.waitForTimeout(600);
      d=await p.evaluate(()=>CaddieLinks.debug());assert.equal(d.renderer,'3d');
      await p.screenshot({path:path.join(shots,`night-${width}.png`)});
      await p.locator('#lk-quit').click();await p.waitForSelector('[data-action="open-links"]');
      assert.equal(await golf(),before,'golf state untouched');
      assert.deepEqual(errors,[],'no page or console errors');
      console.log(`ok ${width}×${height}: ${nCourses} courses · ${d.scene.triangles} triangles · drawMs ${drawMs.toFixed(2)} · flight→aim · map · night · re-enter · golf state unchanged`);
      await ctx.close();
    }
    console.log('PASS links-canopies-browser · screenshots in',shots);
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
