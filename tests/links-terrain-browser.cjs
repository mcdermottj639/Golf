// Pixel-level terrain checks under tee/flight/landing cameras. Surface labels and
// debug flags cannot prove that the GPU painted a hazard or a fairway correctly.
'use strict';
const assert=require('node:assert/strict');
const {server,chromium}=require('./course-prep-browser.cjs');
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,executablePath:process.env.CADDIE_CHROMIUM||'/tmp/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const p=await browser.newPage({viewport:{width:390,height:700}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.route('**/terrain-fixture',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'}));
  await p.goto('http://127.0.0.1:'+server.address().port+'/terrain-fixture');
  const frames=await p.evaluate(async()=>{
   document.body.innerHTML='<canvas id="scene" style="width:390px;height:700px"></canvas>';document.body.style.margin='0';
   const canvas=document.getElementById('scene'),{create}=await import('/links-scene.js'),scene=await create(canvas);
   const rect=(kind,x,y,w,h)=>({kind,pts:[x-w,y-h,x+w,y-h,x+w,y+h,x-w,y+h],bb:[x-w,y-h,x+w,y+h]});
   const hole={n:1,tee:[0,0],path:[[0,0],[0,600]],pin:[0,600]};
   const course={id:'terrain-regression',feats:[rect('fairway',0,350,90,330),rect('bunker',-20,260,10,14),rect('water',20,260,10,14),rect('green',0,340,20,20)],trees:[]};
   const ballState={ball:[0,0],lie:'tee',club:{id:'Dr'},power:0},frames=[];
   for(const z of [0,40,80,120])for(const height of [5,30,60]){
    // Position the flight at a fixed apex, independent of asynchronous screenshots.
    const anim={kind:'shot',b:[0,0],pos:[0,z],t0:performance.now()-500000,dur:1000000,apex:height,trail:[]};
    scene.reset();scene.render({course,h:hole,ballState,anim,angle:0});
    const gl=canvas.getContext('webgl2'),pixel=new Uint8Array(4),frame={z,height,samples:[]};
    for(const [kind,x,y,lift]of [['sand',-20,260,.475],['water',20,260,.06],['green',0,340,.09],['fairway',-25,340,.035],['fairway',25,340,.035]]){
     const q=scene.project([x,y],lift),ix=Math.round(q[0]),iy=Math.round(q[1]);if(ix<2||ix>387||iy<2||iy>697)continue;
     gl.readPixels(ix,699-iy,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);frame.samples.push({kind,x,y,rgb:Array.from(pixel).slice(0,3)});
    }
    frames.push(frame);
   }
   scene.dispose();return frames;
  });
  let count=0;
  for(const frame of frames){for(const {kind,rgb:[r,g,b]}of frame.samples){
   if(kind==='sand')assert(r>g&&g>b,'bunker sand remains visible '+JSON.stringify(frame));
   if(kind==='water')assert(b>r+15&&g>r+10,'water remains visible '+JSON.stringify(frame));
   if(kind==='fairway')assert(g>r+20&&g>b+25,'fairway is grass rather than sky/hazard '+JSON.stringify(frame));
   count++;
  }
  const greens=frame.samples.filter(s=>s.kind==='green'),fairways=frame.samples.filter(s=>s.kind==='fairway');
  if(greens.length&&fairways.length)assert(greens[0].rgb[0]>fairways[0].rgb[0]+20,'green stays distinct from underlying fairway '+JSON.stringify(frame));
  }
  assert(count>=40,'sampled enough visible terrain across the camera path');assert.deepEqual(errors,[]);console.log('PASS rendered ground layers / hazards / flight-camera sweep',frames.length,'views',count,'pixels');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
