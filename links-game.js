/* Caddie HQ Links — a perspective course game played on the app's own course packs with the player's own bag.
   Self-contained module. Reads: window.CADDIE_PREP_COURSES (directory), window.CaddieCoursePacks.ensure(id) (geometry),
   and a bridge from app.js ({state, clubCanon, toast}) for the live carry ladder. Writes only its own localStorage keys
   (chqlinks:*: mode, course, length, distance boost, best scores). Never touches golf state, packs or feeds. */
(function(){
'use strict';
const HTML="<div class=\"wrap\" id=\"lk-menuwrap\">\n  <section id=\"lk-menu\" class=\"menu\">\n    <div>\n      <div class=\"kick\">Caddie HQ · course game</div>\n      <h1>Play your courses with your own bag</h1>\n    </div>\n    <p class=\"lk-note\">Your mapped courses, your TrackMan carries, your measured misses. Play from behind the ball, follow your shot, and explore your mapped holes.</p>\n    <div class=\"picked\" id=\"lk-picked\"></div>\n    <div class=\"lk-seg\" id=\"lk-lenseg\" role=\"group\" aria-label=\"Round length\">\n      <button type=\"button\" data-len=\"front\" aria-pressed=\"false\">Front 9</button>\n      <button type=\"button\" data-len=\"back\" aria-pressed=\"false\">Back 9</button>\n      <button type=\"button\" data-len=\"18\" aria-pressed=\"true\">18 holes</button>\n    </div>\n    <button class=\"go\" id=\"lk-start\" type=\"button\">Tee off</button>\n    <button class=\"lk-ghost\" id=\"lk-daily\" type=\"button\">Today's course: <span id=\"lk-dailyName\"></span></button>\n    <div class=\"kick\" style=\"margin-top:4px\">Courses · tap to pick</div>\n    <div class=\"courses\" id=\"lk-courses\"></div>\n    <div class=\"kick\">Swing style</div>\n    <div class=\"lk-seg\" id=\"lk-modeseg\" role=\"group\" aria-label=\"Swing style\">\n      <button type=\"button\" data-mode=\"sling\" aria-pressed=\"false\">Slingshot</button>\n      <button type=\"button\" data-mode=\"trace\" aria-pressed=\"false\">Trace</button>\n      <button type=\"button\" data-mode=\"dial\" aria-pressed=\"false\">Shape dial</button>\n    </div>\n    <p class=\"lk-note\" id=\"lk-modenote\"></p>\n    <div class=\"row\" style=\"justify-content:space-between\"><span class=\"kick\">Distance vs indoor numbers</span><span class=\"kick\" id=\"lk-boostlab\"></span></div>\n    <input type=\"range\" id=\"lk-boost\" min=\"0\" max=\"25\" step=\"1\" aria-label=\"Distance adjustment percent\">\n    <details class=\"lk-note\"><summary>How it plays · course accuracy</summary><p><b>Course accuracy.</b> Routing and available hazards come from your course packs. The 3D scenery, tree shapes and green breaks are simulated; elevations are not surveyed. Use your saved Caddie plan for real-course advice. Missing mapped fairways/greens use the existing game approximations. This game does not measure real putting breaks.</p>\n      <p><b>Swing styles.</b> Choose Slingshot, Trace or Shape dial on the menu. In Slingshot, tap the hole to aim, pull the side grip down and release. Slide away to cancel; Switch side changes hands. Trace remains an optional down-and-up swing on the course.</p>\n      <p><b>Shape dial.</b> Tap the hole to set your line, choose draw/fade, trajectory and swing length, then tap Strike and tap again when the closing ring meets the ball. Older meter notes: pick a club, drag on the hole to aim. The shaded oval is where that club usually lands for you, wind included. Tap <b>Lock the line</b>, then tap <b>Swing</b> as the needle crosses center. Center is pured, the green band is solid, outside it is struck. Early pulls it left, late pushes it right.</p>\n      <p><b>Putting.</b> The view zooms to the green. Arrows point downhill; longer arrows mean more slope. Drag to set your line. The dotted preview shows where the ball rolls at perfect pace on that line, so move the line until the preview runs over the hole. Then use the side grip for pace: 100% is ideal, less runs shorter, more runs farther. Anything inside 2 ft is a gimme.</p>\n      <p>Rough costs about 8% of carry, fairway bunkers 20%, trees force a punch-out. Water is a one-stroke penalty with a drop behind where the ball crossed.</p>\n    </details>\n    <details class=\"lk-note\"><summary>Your bag in this game</summary>\n      <div class=\"tablewrap\"><table class=\"lk-bag\" id=\"lk-bagtable\"></table></div>\n      <p id=\"lk-bagnote\"></p>\n    </details>\n    <p class=\"lk-note\" style=\"font-size:11px\">Course shapes: © OpenStreetMap contributors (ODbL), from Caddie HQ's verified course packs. Pars and yardages from each course's published scorecard. Trees between holes and green slopes are generated for play.</p>\n  </section>\n\n  <section id=\"lk-end\" class=\"final\" hidden>\n    <div class=\"kick\" id=\"lk-ecourse\"></div>\n    <div class=\"row\" style=\"justify-content:space-between;align-items:flex-end\">\n      <div><h1 id=\"lk-etitle\">Round complete</h1><div class=\"lk-note\" id=\"lk-estrokes\"></div></div>\n      <div class=\"bigscore\" id=\"lk-escore\"></div>\n    </div>\n    <div class=\"tablewrap\"><table class=\"lk-bag\" id=\"lk-etable\"></table></div>\n    <div class=\"lk-stats\" id=\"lk-estats\"></div>\n    <button class=\"go\" id=\"lk-again\" type=\"button\">Play it again</button>\n    <button class=\"lk-ghost\" id=\"lk-menu2\" type=\"button\">Back to courses</button>\n  </section>\n</div>\n\n<section class=\"lk-game\" id=\"lk-game\" hidden>\n  <header class=\"lk-playhead\">\n    <button class=\"lk-exit\" id=\"lk-quit\" type=\"button\" aria-label=\"Back to Caddie HQ\">‹ <span>Caddie HQ</span></button>\n    <div class=\"lk-hole-title\"><div class=\"kick\" id=\"lk-gcourse\"></div><div class=\"row\"><h1 id=\"lk-ghole\"></h1><div class=\"holeline\" id=\"lk-gline\"></div></div></div>\n    <button class=\"lk-score-toggle\" id=\"lk-score-toggle\" type=\"button\" aria-label=\"Show scorecard\" aria-expanded=\"false\"><span id=\"lk-gpar\">E</span><small>Card</small></button>\n  </header>\n  <div class=\"lk-card\" id=\"lk-gcard\" hidden></div>\n  <div class=\"stage\" id=\"lk-stage\">\n    <canvas id=\"lk-cv3\" aria-hidden=\"true\" hidden></canvas><canvas id=\"lk-cv\"></canvas>\n    <div class=\"hud\">\n      <div class=\"lk-pill wind\" id=\"lk-wind\"></div>\n      <div class=\"lk-pill\" id=\"lk-lie\"></div>\n    </div>\n    <div class=\"lk-target\" id=\"lk-target\" hidden></div><button id=\"lk-skip\" class=\"lk-skip\" type=\"button\" hidden>Skip flight ›</button><div class=\"lk-flight-readout\" id=\"lk-flight-readout\" hidden></div><button class=\"lk-plan\" id=\"lk-plan\" type=\"button\" aria-haspopup=\"dialog\">Caddie plan ↗</button><div class=\"camrow\"><button type=\"button\" class=\"lk-pill lk-camtog\" id=\"lk-camtog\"><canvas id=\"lk-mini\" width=\"140\" height=\"180\" aria-hidden=\"true\"></canvas><span id=\"lk-maplabel\">Hole map</span></button>\n    </div>\n    <div class=\"banner\" id=\"lk-banner\"><div class=\"lk-big\" id=\"lk-bbig\"></div><div class=\"lk-sub\" id=\"lk-bsub\"></div></div>\n    <div class=\"hint\" id=\"lk-hint\" hidden></div>\n    <div class=\"foot\"><div class=\"lk-pill\" id=\"lk-topin\"></div><div class=\"lk-pill\" id=\"lk-shotno\"></div></div>\n  </div>\n  <div class=\"dock\">\n    <div class=\"lk-controlrow\"><details class=\"lk-clubbox\" id=\"lk-clubbox\"><summary id=\"lk-clubsummary\">Choose club</summary><div class=\"lk-clubs\" id=\"lk-clubs\" role=\"group\" aria-label=\"Clubs\"></div></details><details class=\"lk-shapebox\" id=\"lk-shapebox\"><summary id=\"lk-shapesummary\">Stock · Straight</summary>    <div class=\"shaperow\" id=\"lk-shaperow\" hidden>\n      <div class=\"lk-seg\" id=\"lk-trajseg\" role=\"group\" aria-label=\"Trajectory\"><button type=\"button\" data-t=\"-1\" aria-pressed=\"false\">Low</button><button type=\"button\" data-t=\"0\" aria-pressed=\"true\">Stock</button><button type=\"button\" data-t=\"1\" aria-pressed=\"false\">High</button></div>\n      <div class=\"lk-seg\" id=\"lk-pwseg\" role=\"group\" aria-label=\"Swing length\" hidden><button type=\"button\" data-p=\"1\" aria-pressed=\"true\">Full</button><button type=\"button\" data-p=\"0.75\" aria-pressed=\"false\">¾</button><button type=\"button\" data-p=\"0.5\" aria-pressed=\"false\">½</button></div><span class=\"shp\"><span id=\"lk-shapeL\">Draw</span><input type=\"range\" id=\"lk-shape\" min=\"-3\" max=\"3\" step=\"1\" value=\"0\" aria-label=\"Shape\"><span>Fade</span><span class=\"val\" id=\"lk-shapeval\">straight</span></span>\n    </div>\n</details></div>\n    <div class=\"readout\" id=\"lk-readout\"></div>\n    <div class=\"lk-meter\" id=\"lk-meter\" aria-hidden=\"true\">\n      <div class=\"z solid\"></div><div class=\"z pure\"></div>\n      <span class=\"lk-lab\" id=\"lk-labL\" style=\"left:6px\">EARLY · LEFT</span><span class=\"lk-lab\" id=\"lk-labR\" style=\"right:6px\">LATE · RIGHT</span>\n      <div class=\"needle\" id=\"lk-needle\"></div><div class=\"lk-hit\" id=\"lk-hit\" hidden></div><div class=\"grade\" id=\"lk-grade\" hidden></div>\n    </div>\n    <button class=\"go\" id=\"lk-act\" type=\"button\">Lock the line</button>\n    <button type=\"button\" class=\"instr\" id=\"lk-instr\" hidden></button>\n  </div>\n</section>\n\n";
let R=null,bridge={},stopFn=null,dbgFn=null;
function render(){return '<div class="lk" id="lk-root">'+HTML+'</div>';}
function mount(node,b){unmount();R=node;bridge=b||{};if(!R)return;boot();}
function unmount(){if(stopFn){try{stopFn();}catch{}stopFn=null;}R=null;}
function boot(){

  const DIR=(window.CADDIE_PREP_COURSES||[]).filter(c=>c&&Array.isArray(c.holes)&&c.holes.length);
  const COURSES={}; // course geometry in local yards, converted from the pack on first play
  const dirOf=id=>DIR.find(c=>c.id===id);

  /* Jack's bag. Carry and consistency are TrackMan readings (indoor, Normalize on).
     side = average carry-side (yd, + is right), sideSD = spread of carry-side (yd), roll = avg total - carry. */
  const BAG_DEFAULT = [
   {id:'Dr', carry:195.8, cons:18.4, side:0,    sideSD:14,   roll:28,  src:'Map My Bag 9/14', est:'Left/right spread and roll estimated; 9/14 table did not include side.'},
   {id:'3W', carry:197.2, cons:7.6,  side:14.0, sideSD:12.9, roll:26.3,src:'Map My Bag 10/1'},
   {id:'5W', carry:192.4, cons:5.8,  side:0.6,  sideSD:14.9, roll:33.7,src:'Map My Bag 10/1'},
   {id:'4H', carry:174.9, cons:17.1, side:13.4, sideSD:8.5,  roll:17.2,src:'Map My Bag 10/1'},
   {id:'2i', carry:164.1, cons:9.1,  side:6,    sideSD:10,   roll:18,  src:'Map My Bag 10/1', est:'Only the summary was readable; side and roll estimated.'},
   {id:'5i', carry:163.5, cons:3.6,  side:11.4, sideSD:11.5, roll:25,  src:'Map My Bag 10/1'},
   {id:'6i', carry:156.6, cons:8.8,  side:5.1,  sideSD:4.3,  roll:21.2,src:'Map My Bag 10/1'},
   {id:'7i', carry:148.3, cons:6.2,  side:4.3,  sideSD:10.2, roll:13.1,src:'Map My Bag 10/1'},
   {id:'8i', carry:140.6, cons:5.9,  side:4.0,  sideSD:7.9,  roll:11.2,src:'Map My Bag 10/1'},
   {id:'9i', carry:129.8, cons:3.6,  side:4.3,  sideSD:9.3,  roll:6.3, src:'Map My Bag 10/1'},
   {id:'PW', carry:121.5, cons:7.2,  side:2.0,  sideSD:5.0,  roll:8.2, src:'Map My Bag 10/1'},
   {id:'50°',carry:113.1, cons:9.1,  side:-5.6, sideSD:6.6,  roll:6.2, src:'Map My Bag 10/1'},
   {id:'58°',carry:97.0,  cons:11.1, side:-3.3, sideSD:2.9,  roll:11.3,src:'Map My Bag 10/1'},
  ];
  let BAG=BAG_DEFAULT.slice();
  const PUTTER={id:'PT',carry:0,putter:true};
  const GIMME_FT=2, HOLE_R_FT=0.177, FT=3; // yards→feet

  /* ---------- helpers ---------- */
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const rootNode=R;let stopped=false;
  const $=id=>rootNode.querySelector('#lk-'+id);
  const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const store={get(k,d){try{const v=localStorage.getItem('chqlinks:'+k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem('chqlinks:'+k,JSON.stringify(v))}catch(e){}}};
  function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
  function hashStr(s){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
  function gauss(r=Math.random){let u=0,v=0;while(!u)u=r();while(!v)v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)}
  const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
  const lerp=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
  function segDist(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],L=dx*dx+dy*dy;let t=L?((p[0]-a[0])*dx+(p[1]-a[1])*dy)/L:0;t=Math.max(0,Math.min(1,t));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)}
  function lineDist(p,path){let m=1e9;for(let i=1;i<path.length;i++)m=Math.min(m,segDist(p,path[i-1],path[i]));return m}
  function inPoly(p,f){const a=f.pts;let c=false;for(let i=0,j=a.length-2;i<a.length;j=i,i+=2){const xi=a[i],yi=a[i+1],xj=a[j],yj=a[j+1];if((yi>p[1])!==(yj>p[1])&&p[0]<(xj-xi)*(p[1]-yi)/(yj-yi)+xi)c=!c}return c}
  function bbox(pts){let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(let i=0;i<pts.length;i+=2){x0=Math.min(x0,pts[i]);x1=Math.max(x1,pts[i]);y0=Math.min(y0,pts[i+1]);y1=Math.max(y1,pts[i+1])}return[x0,y0,x1,y1]}
  function pathLen(p){let s=0;for(let i=1;i<p.length;i++)s+=dist(p[i-1],p[i]);return s}
  function alongPath(p,d){for(let i=1;i<p.length;i++){const L=dist(p[i-1],p[i]);if(d<=L)return lerp(p[i-1],p[i],d/L);d-=L}return p[p.length-1].slice()}
  function nearestParam(p,path){let best=1e9,acc=0,out=0;for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],L=dist(a,b);const dx=b[0]-a[0],dy=b[1]-a[1];let t=L?((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(L*L):0;t=Math.max(0,Math.min(1,t));const q=[a[0]+t*dx,a[1]+t*dy],d=dist(p,q);if(d<best){best=d;out=acc+t*L}acc+=L}return out}
  function circlePts(c,r,n=24){const o=[];for(let i=0;i<n;i++){const a=i/n*Math.PI*2;o.push(c[0]+Math.cos(a)*r,c[1]+Math.sin(a)*r)}return o}
  function strip(path,from,to,half){const L=[],R=[];for(let d=from;d<=to;d+=8){const p=alongPath(path,d),q=alongPath(path,Math.min(to,d+4)),dx=q[0]-p[0],dy=q[1]-p[1],l=Math.hypot(dx,dy)||1;const w=half*(0.85+0.15*Math.sin(d/37));L.push([p[0]-dy/l*w,p[1]+dx/l*w]);R.push([p[0]+dy/l*w,p[1]-dx/l*w])}return[...L,...R.reverse()].flat()}

  /* ---------- bag from Caddie HQ ---------- */
  function liveBag(){
    const st=bridge.state?bridge.state():null;const rows=(st&&st.carries)||[];const out=[];
    for(const r of rows){
      const carry=+(r.meas&&r.meas.carry!=null?r.meas.carry:r.carry);if(!(carry>30))continue;
      const id=bridge.clubCanon?bridge.clubCanon(r.club):String(r.club);
      const d=BAG_DEFAULT.find(x=>x.id===id)||{};
      const cons=r.meas&&r.meas.cons!=null?+r.meas.cons:(d.cons!=null?d.cons:(carry>180?14:carry>140?8:6));
      out.push({id,club:r.club,carry,cons,side:d.side||0,sideSD:d.sideSD!=null?d.sideSD:(carry>180?13:carry>140?9:5),roll:d.roll!=null?d.roll:Math.max(4,carry*0.1),src:r.meas&&r.meas.carry!=null?'measured':'bag ladder',est:d.sideSD==null});
    }
    out.sort((a,b)=>b.carry-a.carry);
    return out.length>=4?out:BAG_DEFAULT.slice();
  }
  const driverOf=()=>BAG.find(c=>/^(Dr|DR|Driver)/.test(c.id))||BAG[0];
  /* ---------- course packs → game geometry (yards, local tangent plane) ---------- */
  function rdp(pts,eps){
    if(pts.length<3)return pts;
    const a=pts[0],b=pts[pts.length-1];let dmax=0,idx=0;
    const dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy);
    for(let i=1;i<pts.length-1;i++){const p=pts[i];const d=L>1e-9?Math.abs(dy*p[0]-dx*p[1]+b[0]*a[1]-b[1]*a[0])/L:Math.hypot(p[0]-a[0],p[1]-a[1]);if(d>dmax){dmax=d;idx=i}}
    if(dmax>eps)return rdp(pts.slice(0,idx+1),eps).slice(0,-1).concat(rdp(pts.slice(idx),eps));
    return[a,b];
  }
  function convertPack(e){
    const lat0=e.center[0],lon0=e.center[1];const ky=1.0936*111320,kx=ky*Math.cos(lat0*Math.PI/180);
    const P=p=>[Math.round((p[1]-lon0)*kx*10)/10,Math.round((p[0]-lat0)*ky*10)/10];
    const feats=[];
    for(const f of e.features||[]){if(!['fairway','green','bunker','water','tee','wood'].includes(f.kind)||!Array.isArray(f.path))continue;const pts=rdp(f.path.map(P),['green','bunker','tee'].includes(f.kind)?0.8:1.5);if(pts.length>=3)feats.push([f.kind,pts.flat()])}
    const tee=(e.tees||[]).find(t=>t.id===e.defaultTee)||(e.tees||[])[0];
    const holes=[];
    (e.holes||[]).forEach((h,i)=>{if(!Array.isArray(h.path)||h.path.length<2||h.mapReady===false)return;holes.push({n:h.n,par:h.par,si:h.si,yds:tee&&tee.yards?tee.yards[i]:null,path:h.path.map(P)})});
    const c={id:e.id,name:e.shortName||e.name,place:e.place||'',tee:tee?tee.name:'',holes,features:feats,total:(e.holes||[]).length};
    // snap each tee to the mapped tee box whose route length best matches the card yardage
    const tees=feats.filter(f=>f[0]==='tee').map(f=>{const a=f[1];let x=0,y=0,n=a.length/2;for(let i=0;i<a.length;i+=2){x+=a[i];y+=a[i+1]}return[x/n,y/n]});
    for(const h of holes){
      if(!h.yds)continue;const p=h.path;let rest=0;for(let i=2;i<p.length;i++)rest+=dist(p[i-1],p[i]);
      const L0=rest+dist(p[0],p[1]);let best=null;
      for(const ce of tees){if(dist(ce,p[0])>90)continue;const L=rest+dist(ce,p[1]);if(!best||Math.abs(L-h.yds)<Math.abs(best[1]-h.yds))best=[ce,L]}
      if(best&&Math.abs(best[1]-h.yds)<Math.abs(L0-h.yds)&&Math.abs(best[1]-h.yds)<35)h.path[0]=[best[0][0],best[0][1]];
    }
    return c;
  }
  async function loadCourse(id){
    if(COURSES[id])return COURSES[id];
    const packs=window.CaddieCoursePacks;if(!packs)throw new Error('Course packs are unavailable');
    const entry=await packs.ensure(id);
    const c=convertPack(entry);if(!c.holes.length)throw new Error('No mapped holes');
    COURSES[id]=c;return c;
  }
  /* ---------- course prep ---------- */
  function prepCourse(c){
    if(c._ready)return c;
    c.feats=c.features.map(([kind,pts])=>({kind,pts,bb:bbox(pts)}));
    for(const h of c.holes){
      h.pin=h.path[h.path.length-1]; h.tee=h.path[0]; h.len=pathLen(h.path);
      let g=c.feats.find(f=>f.kind==='green'&&inPoly(h.pin,f));
      if(!g){g=c.feats.filter(f=>f.kind==='green').map(f=>({f,d:dist(h.pin,[(f.bb[0]+f.bb[2])/2,(f.bb[1]+f.bb[3])/2])})).sort((a,b)=>a.d-b.d)[0];g=g&&g.d<22?g.f:null;
        if(g){h.pin=[(g.bb[0]+g.bb[2])/2,(g.bb[1]+g.bb[3])/2];}}
      if(!g){const pts=circlePts(h.pin,13);g={kind:'green',pts,bb:bbox(pts),drawn:true};c.feats.push(g)}
      h.green=g;h.gc=[(g.bb[0]+g.bb[2])/2,(g.bb[1]+g.bb[3])/2];h.gr=Math.max(8,(g.bb[2]-g.bb[0]+g.bb[3]-g.bb[1])/4);
      // green slope: overall tilt (0.4–1.8%) plus crown (+) or bowl (−); seeded per hole so a course plays the same every time
      const r=mulberry(hashStr(c.id+':'+h.n));const mag=0.004+r()*0.014,ang=r()*Math.PI*2;
      h.slope={bx:Math.cos(ang)*mag,by:Math.sin(ang)*mag,dome:(r()<0.55?1:-0.7)*(0.003+r()*0.007)};
      if(h.par>3){let n=0,hit=0;for(let d=120;d<h.len-40;d+=10){n++;const p=alongPath(h.path,d);if(c.feats.some(f=>f.kind==='fairway'&&inPoly(p,f)))hit++}
        if(n&&hit/n<0.35){const pts=strip(h.path,Math.min(110,h.len*0.3),h.len-28,16);c.feats.push({kind:'fairway',pts,bb:bbox(pts),drawn:true})}}
    }
    const order={wood:0,fairway:1,tee:2,water:3,bunker:4,green:5};
    c.feats.sort((a,b)=>order[a.kind]-order[b.kind]);
    let all=[];for(const f of c.feats)all.push(...f.pts);for(const h of c.holes)for(const p of h.path)all.push(...p);
    const bb=bbox(all);c.ext=[bb[0]-70,bb[1]-70,bb[2]+70,bb[3]+70];
    const r=mulberry(hashStr(c.id)),trees=[];const step=13;
    for(let x=c.ext[0];x<c.ext[2];x+=step)for(let y=c.ext[1];y<c.ext[3];y+=step){
      const p=[x+(r()-.5)*step,y+(r()-.5)*step];
      const inWood=c.feats.some(f=>f.kind==='wood'&&p[0]>f.bb[0]&&p[0]<f.bb[2]&&p[1]>f.bb[1]&&p[1]<f.bb[3]&&inPoly(p,f));
      if(!inWood&&r()>0.62)continue;
      let near=1e9;for(const h of c.holes){near=Math.min(near,lineDist(p,h.path));if(near<34)break}
      if(near<34)continue;
      if(c.feats.some(f=>f.kind!=='wood'&&p[0]>f.bb[0]-6&&p[0]<f.bb[2]+6&&p[1]>f.bb[1]-6&&p[1]<f.bb[3]+6&&inPoly(p,f)))continue;
      if(dist(p,[(c.ext[0]+c.ext[2])/2,(c.ext[1]+c.ext[3])/2])>Math.max(c.ext[2]-c.ext[0],c.ext[3]-c.ext[1])*0.62&&r()<.5)continue;
      trees.push({p,r:4.5+r()*4.5,s:r()});
    }
    c.trees=trees;
    const G=c.grid={cell:60,x0:c.ext[0],y0:c.ext[1],cells:new Map()};
    for(const t of trees){const k=Math.floor((t.p[0]-G.x0)/G.cell)+','+Math.floor((t.p[1]-G.y0)/G.cell);(G.cells.get(k)||G.cells.set(k,[]).get(k)).push(t)}
    c._ready=true;return c;
  }
  function lieAt(c,p){
    if(p[0]<c.ext[0]+20||p[0]>c.ext[2]-20||p[1]<c.ext[1]+20||p[1]>c.ext[3]-20)return'ob';
    const hit=k=>c.feats.some(f=>f.kind===k&&p[0]>=f.bb[0]&&p[0]<=f.bb[2]&&p[1]>=f.bb[1]&&p[1]<=f.bb[3]&&inPoly(p,f));
    if(hit('water'))return'water';
    if(hit('green'))return'green';
    if(hit('bunker'))return'bunker';
    if(hit('fairway'))return'fairway';
    if(hit('tee'))return'fairway';
    for(const t of c.trees)if(Math.abs(t.p[0]-p[0])<t.r&&Math.abs(t.p[1]-p[1])<t.r&&dist(t.p,p)<t.r)return'trees';
    if(hit('wood'))return'trees';
    return'rough';
  }
  const LIE={tee:{name:'Tee',carry:1,spread:1},fairway:{name:'Fairway',carry:1,spread:1},rough:{name:'Rough',carry:.92,spread:1.3},
    bunker:{name:'Bunker',carry:.8,spread:1.5},trees:{name:'Trees',carry:.55,spread:1.8},green:{name:'Green',carry:1,spread:1}};
  /* downhill gradient (dimensionless) at p, in world yards */
  function slopeAt(h,p){const dx=(p[0]-h.gc[0])/h.gr,dy=(p[1]-h.gc[1])/h.gr;return[h.slope.bx+h.slope.dome*dx,h.slope.by+h.slope.dome*dy]}

  /* ---------- putting physics (feet/seconds; positions kept in yards) ---------- */
  const STIMP_DECEL=1.9, G_ROLL=32.2*0.714;
  function simPutt(h,start,dir,v0){
    let p=start.slice(),vx=dir[0]*v0,vy=dir[1]*v0;const dt=0.02,path=[p.slice()];let holed=false,lip=false,t=0,lastOn=true;
    for(let i=0;i<1500;i++){
      const sp=Math.hypot(vx,vy);if(sp<0.08)break;
      const s=slopeAt(h,p);const onG=(i%4)?lastOn:(lastOn=inPoly(p,h.green));const mu=onG?STIMP_DECEL:6;
      vx+=(-mu*vx/sp+G_ROLL*s[0])*dt;vy+=(-mu*vy/sp+G_ROLL*s[1])*dt;
      p=[p[0]+vx*dt/FT,p[1]+vy*dt/FT];t+=dt;
      const d=dist(p,h.pin)*FT;
      if(d<HOLE_R_FT){const sp2=Math.hypot(vx,vy);if(sp2<4.6||(sp2<6.2&&d<0.09)){holed=true;p=h.pin.slice();path.push(p.slice());break}
        if(!lip){lip=true;const nx=(p[0]-h.pin[0])*FT/(d||1e-6),ny=(p[1]-h.pin[1])*FT/(d||1e-6);const k=0.5;vx=(vx+nx*sp2*0.9)*k;vy=(vy+ny*sp2*0.9)*k}}
      if(i%5===0)path.push(p.slice());
    }
    path.push(p.slice());return{path,end:p,holed,lip,t};
  }
  function perfectSpeed(h,start,dir){const need=dist(start,h.pin)*FT+1.5;let lo=0.5,hi=45;for(let i=0;i<22;i++){const mid=(lo+hi)/2;const r=simPutt(h,start,dir,mid);const L=pathLen(r.path)*FT;if(r.holed||L>need)hi=mid;else lo=mid}return(lo+hi)/2}

  /* ---------- state ---------- */
  let S=null, cur=null;
  let mode=store.get('mode','sling');if(!['sling','trace','dial'].includes(mode))mode='sling';
  let camMode=store.get('cam','shot');if(camMode!=='hole')camMode='shot'; // 'shot' = close behind the ball, 'hole' = the whole hole from the air
  let G=null; // active gesture
  const view={cx:0,cy:0,s:1,ang:0,tcx:0,tcy:0,ts:1,tang:0};
  let cv=$('cv'),ctx=cv.getContext('2d');
  $('stage').insertAdjacentHTML('beforeend',`<div id="lk-powerrail" class="lk-powerrail" hidden><strong id="lk-powerlabel">Pull down</strong><small id="lk-powercarry">Release to swing</small><div class="lk-powertrack"><i class="lk-powertick t50">50</i><i class="lk-powertick t75">75</i><i class="lk-powertick t100">100%</i><button id="lk-powerhandle" class="lk-powerhandle" type="button" aria-label="Swing power. Drag down, release to swing. Arrow keys adjust; Enter swings.">↓</button></div><small id="lk-powerhint">Slide away to cancel</small></div>`);
  $('stage').insertAdjacentHTML('beforeend','<section id="lk-recap" class="lk-recap" role="region" aria-labelledby="lk-recap-title" tabindex="-1" hidden></section>');
  $('instr').insertAdjacentHTML('afterend',`<div class="lk-tools"><button type="button" id="lk-retry" disabled>Try shot again</button><button type="button" id="lk-hand">Switch side</button><details class="lk-distance-note"><summary>Map distances ⓘ</summary><p id="lk-distance-info"></p></details></div>`);
  let lastShot=null,rail=null,railPower=1,landingView=null;
  $('stage').insertAdjacentHTML('beforeend','<button type="button" id="lk-landing" class="lk-landing" aria-pressed="false">Landing spot ↗</button>');
  $('stage').insertAdjacentHTML('beforeend','<div id="lk-pin" class="lk-pin" hidden></div>');
  rootNode.classList.toggle('lk-left-handed',store.get('hand','right')==='left');
  let scene=null,scenePromise=null,threeActive=false,sceneMoving=false,roundToken=0,gimmeTimer=0;
  async function ensureScene(){
    if(scene||scenePromise)return scenePromise;
    scenePromise=import('./links-scene.js').then(async m=>{if(stopped)return;const candidate=await m.create($('cv3'),()=>{threeActive=false;scene?.dispose();scene=null;$('cv3').hidden=true;rootNode.classList.remove('lk-perspective');banner('Map view','3D unavailable on this device');draw()});if(stopped){candidate.dispose();return;}scene=candidate;}).catch(()=>{if(!stopped)banner('Map view','3D unavailable on this device');});
    return scenePromise;
  }
  const use3D=()=>!!(scene&&S?.h&&camMode==='shot'&&!onGreen());
  let anim=null, meterT0=0, meterOn=false, raf=0;
  let fx=null; // after-shot effects: the flight trail fading out and the landing puff (v255); pure drawing, never scoring
  const FX_MS=1500, TRAIL_MAX=110;

  function holesFor(len){const H=cur.holes;if(len==='front')return H.filter(h=>h.n<=9);if(len==='back')return H.filter(h=>h.n>=10&&h.n<=18);return H.filter(h=>h.n<=18)}
  function windFor(seed,h){const r=mulberry(hashStr(seed+':'+h.n));return{mph:Math.round(2+r()*14),from:r()*Math.PI*2}}
  function newRound(courseId,len,daily){
    cur=prepCourse(COURSES[courseId]);if(!cur.holes.length)return;
    const seed=daily?todayKey():String(Date.now());
    S={course:courseId,len,daily,seed,holes:holesFor(len).map(h=>h.n),idx:0,scores:[],putts:[],longest:0,fir:[0,0],gir:0};
    show('game');startHole();
  }
  function holeObj(){return cur.holes.find(h=>h.n===S.holes[S.idx])}
  function startHole(){
    lastShot=null;rail=null;landingView=null;clearBanner();
    const h=holeObj();
    S.h={ball:h.tee.slice(),lie:'tee',strokes:0,putts:0,penalties:0,shots:[],fairway:null,wind:windFor(S.seed,h),done:false,phase:'aim',history:[h.tee.slice()],club:null,aim:null,preview:null,vPerfect:0,shape:0,traj:0,power:null,lineAim:null,pw:1};
    clearTimeout(gimmeTimer);G=null;scene?.reset();$('clubbox').open=false;$('shapebox').open=false;fx=null;pickDefaultClub();defaultAim();introCam();renderUI();draw();
  }
  function remaining(){return dist(S.h.ball,holeObj().pin)}
  function onGreen(){return S.h.lie==='green'}
  function carryOf(c){return c.carry*(1+boost()/100)}
  function boost(){return +store.get('boost',10)||0}
  function fullCarry(c){return carryOf(c)*LIE[S.h.lie==='tee'?'tee':S.h.lie].carry}
  function pickDefaultClub(){
    if(onGreen()){S.h.club=PUTTER;return}
    const h=holeObj(),d=remaining();
    if(S.h.lie==='tee'&&h.par>3){S.h.club=driverOf();return}
    const usable=BAG.filter(c=>fullCarry(c)>=d*0.97).sort((a,b)=>a.carry-b.carry);
    S.h.club=usable[0]||BAG.slice().sort((a,b)=>b.carry-a.carry)[0];
  }
  function defaultAim(){
    const h=holeObj(),b=S.h.ball,c=S.h.club;
    if(c.putter){S.h.aim=h.pin.slice();updatePutt();return}
    const fc=fullCarry(c);
    if(S.h.lie==='trees'){const t=nearestParam(b,h.path);S.h.aim=alongPath(h.path,Math.min(h.len,t+Math.min(fc*.8,60)));S.h.lineAim=S.h.aim.slice();S.h.power=null;return}
    if(remaining()<=fc*1.04){S.h.aim=h.pin.slice();S.h.lineAim=S.h.aim.slice();S.h.power=null;return}
    const t0=nearestParam(b,h.path);let best=null;
    for(let t=t0;t<=h.len;t+=3){const p=alongPath(h.path,t);if(!best||Math.abs(dist(p,b)-fc)<Math.abs(dist(best,b)-fc))best=p}
    S.h.aim=best||h.pin.slice();S.h.lineAim=S.h.aim.slice();S.h.power=null;
  }
  function updatePutt(){ // recompute perfect pace and preview path for the current line
    const h=holeObj(),b=S.h.ball,a=S.h.aim,d=dist(b,a)||1e-6;const dir=[(a[0]-b[0])/d,(a[1]-b[1])/d];
    S.h.dir=dir;S.h.vPerfect=perfectSpeed(h,b,dir);S.h.preview=simPutt(h,b,dir,S.h.vPerfect);
  }
  function forecast(){
    const b=S.h.ball,a=S.h.aim,c=S.h.club,L=LIE[S.h.lie==='tee'?'tee':S.h.lie];
    const want=dist(b,a),fc=fullCarry(c);const cv0=S.h.shape/3,tj=S.h.traj||0;
    const shapeMult=(1-0.05*Math.abs(cv0))*(tj<0?0.94:tj>0?0.985:1);
    let carry=(S.h.power!=null?fc*Math.min(1.1,S.h.power):Math.min(want,fc))*shapeMult*(mode==='dial'?(S.h.pw||1):1);
    const frac=Math.max(.25,carry/carryOf(c));
    const u=[(a[0]-b[0])/(want||1),(a[1]-b[1])/(want||1)],rgt=[u[1],-u[0]];
    const w=S.h.wind,wv=[-Math.sin(w.from)*w.mph,-Math.cos(w.from)*w.mph];
    const along=wv[0]*u[0]+wv[1]*u[1],cross=wv[0]*rgt[0]+wv[1]*rgt[1];
    const wf=tj<0?0.5:tj>0?1.4:1;
    const carryW=carry*(1+(along>0?0.005:0.01)*along*wf);
    const curve=cv0*carry*0.12;
    const lat=c.side*frac+cross*0.5*carry/100*wf+curve;
    const over=S.h.power!=null&&S.h.power>1?1+(S.h.power-1)*6:1;
    const rollMult=(cv0<0?1+0.15*-cv0:1-0.1*cv0)*(tj<0?1.6:tj>0?0.5:1);
    return{u,rgt,carry,carryW,lat,curve,sc:c.cons/2*frac*L.spread*over,sl:c.sideSD*frac*L.spread*over,frac,fc,want,rollMult,tj};
  }

  /* ---------- camera ---------- */
  function frameTarget(){
    const h=holeObj(),b=S.h.ball,pin=h.pin;
    if(landingView&&!onGreen()){
      const {center:p,angle:ang}=landingView,u=[Math.sin(ang),Math.cos(ang)],r=[u[1],-u[0]];
      return{mx:p[0]*r[0]+p[1]*r[1],my:p[0]*u[0]+p[1]*u[1],s:Math.min(cv.clientWidth/110,cv.clientHeight/145),ang};
    }
    let fwd=[pin[0]-b[0],pin[1]-b[1]];
    if(dist(b,pin)<0.15||S.h.lie==='tee')fwd=[pin[0]-h.tee[0],pin[1]-h.tee[1]];
    if(mode!=='meter'&&!onGreen()&&S.h.lineAim&&dist(S.h.lineAim,b)>5)fwd=[S.h.lineAim[0]-b[0],S.h.lineAim[1]-b[1]];
    const ang=Math.atan2(fwd[0],fwd[1]);
    const pts=[b,pin];if(S.h.aim)pts.push(S.h.aim);if(S.h.lineAim)pts.push(S.h.lineAim);
    if(camMode==='hole')pts.push(...h.path);
    const u=[Math.sin(ang),Math.cos(ang)],r=[u[1],-u[0]];
    const W0=cv.clientWidth||400,H0=cv.clientHeight||500,g0=mode!=='meter';
    if(camMode==='shot'&&!onGreen()){
      // Close view: the ball sits low in the frame and the view runs out to where this club lands (a little past it), never further than the pin.
      const c=S.h.club,fc=c&&!c.putter?fullCarry(c)*(1+(c.est?0:0)):120;
      const rem=remaining();const reach=Math.min(rem+25,Math.max(45,fc*1.22+15));
      const ballFrac=g0?0.74:0.84; // share of the height above the ball; gesture modes keep room under it to pull back
      let s=H0*(ballFrac-0.05)/reach;
      const minW=Math.max(42,reach*0.42);s=Math.min(s,W0/(minW*1.15));
      const xb=b[0]*r[0]+b[1]*r[1],yb=b[0]*u[0]+b[1]*u[1];
      const land=S.h.lineAim&&dist(S.h.lineAim,b)>5?S.h.lineAim:S.h.aim;const xl=land?land[0]*r[0]+land[1]*r[1]:xb;
      return{mx:(xb+Math.min(Math.max(xl,xb-reach*0.3),xb+reach*0.3))/2,my:yb+(ballFrac-0.5)*H0/s,s,ang};
    }
    let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;for(const p of pts){const x=p[0]*r[0]+p[1]*r[1],y=p[0]*u[0]+p[1]*u[1];x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)}
    let w,hh;
    const W=cv.clientWidth||400,H=cv.clientHeight||500;let s;
    const g=mode!=='meter'; // gesture modes need room below the ball to pull back
    if(onGreen()){const span=Math.max(3,remaining()*1.1);w=Math.max(x1-x0,span*0.45);hh=Math.max(y1-y0,span);s=Math.min(W/(w*1.7+4),H/(hh*(g?1.9:1.25)+3))}
    else{w=Math.max(x1-x0,54);hh=Math.max(y1-y0,90);s=Math.min(W/(w*1.35+40),H/(hh*(g?1.6:1.22)+50))}
    const mx=(x0+x1)/2,my=(y0+y1)/2+hh*0.03-(g?hh*(onGreen()?0.3:0.17):0);
    return{mx,my,s,ang};
  }
  function frame(snap){const t=frameTarget();view.tcx=t.mx;view.tcy=t.my;view.ts=t.s;view.tang=t.ang;if(snap){view.cx=t.mx;view.cy=t.my;view.s=t.s;view.ang=t.ang}kick()}
  let camK=0.14,intro=false;
  function introCam(){ // start over the green, glide back to the tee
    if(cv.clientWidth<2||reduced){frame(true);return}
    const t=frameTarget(),h=holeObj();frame(false);
    const u=[Math.sin(t.ang),Math.cos(t.ang)],r=[u[1],-u[0]];
    view.ang=t.ang;view.cx=h.pin[0]*r[0]+h.pin[1]*r[1];view.cy=h.pin[0]*u[0]+h.pin[1]*u[1];view.s=t.s*2.6;camK=0.055;intro=true;kick();
  }
  function toScreen(p){if(threeActive)return scene.project(p,.2);return flatScreen(p)}
  function flatScreen(p){const u=[Math.sin(view.ang),Math.cos(view.ang)],r=[u[1],-u[0]];const x=p[0]*r[0]+p[1]*r[1]-view.cx,y=p[0]*u[0]+p[1]*u[1]-view.cy;return[cv.clientWidth/2+x*view.s,cv.clientHeight/2-y*view.s]}
  function toWorld(sx,sy){if(threeActive)return scene.unproject(sx,sy)||S.h.lineAim||S.h.aim;const u=[Math.sin(view.ang),Math.cos(view.ang)],r=[u[1],-u[0]];const a=(sx-cv.clientWidth/2)/view.s+view.cx,b=-(sy-cv.clientHeight/2)/view.s+view.cy;return[a*r[0]+b*u[0],a*r[1]+b*u[1]]}

  /* ---------- drawing ---------- */
  const COL={rough:'#83A66C',rough2:'#7A9D63',fair:'#A9CC85',fair2:'#B3D48E',green:'#BFE09A',green2:'#B6D991',fringe:'#9FC77E',tee:'#A2C882',sand:'#EADBB0',sandE:'#C9B47E',sandIn:'rgba(120,95,40,.18)',water:'#6FAFC9',waterE:'#4D8FAE',waterHi:'rgba(255,255,255,.35)',wood:'#5E8A55',tree:'#3F6E3F',tree2:'#47764A',treeHi:'#5C8F55',shadow:'rgba(30,50,25,.28)'};
  function poly(f){const a=f.pts;ctx.beginPath();let p=toScreen([a[0],a[1]]);ctx.moveTo(p[0],p[1]);for(let i=2;i<a.length;i+=2){p=toScreen([a[i],a[i+1]]);ctx.lineTo(p[0],p[1])}ctx.closePath()}
  function visible(f){const c=[toScreen([f.bb[0],f.bb[1]]),toScreen([f.bb[2],f.bb[1]]),toScreen([f.bb[0],f.bb[3]]),toScreen([f.bb[2],f.bb[3]])];const W=cv.clientWidth,H=cv.clientHeight;const xs=c.map(q=>q[0]),ys=c.map(q=>q[1]);return Math.max(...xs)>-20&&Math.min(...xs)<W+20&&Math.max(...ys)>-20&&Math.min(...ys)<H+20}
  let staticKey='',off=null;
  function draw(){
    const dpr=Math.min(2,window.devicePixelRatio||1),W=cv.clientWidth,H=cv.clientHeight;
    if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(H*dpr)){cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr)}
    ctx.setTransform(dpr,0,0,dpr,0,0);
    if(!cur||!S||!S.h||W<2||H<2){ctx.fillStyle=COL.rough;ctx.fillRect(0,0,W,H);return}
    threeActive=use3D();$('cv3').hidden=!threeActive;rootNode.classList.toggle('lk-perspective',threeActive);
    if(threeActive){
      const result=scene.render({course:cur,h:holeObj(),ballState:S.h,anim,fx,forecast:S.h.club.putter?null:forecast(),angle:view.ang,reduced,pulling:!!G,landing:landingView});
      ctx.clearRect(0,0,W,H);if(result){sceneMoving=result.moving;drawSceneOverlay(result,W,H);if(sceneMoving)kick();}drawMini();return;
    }
    $('target').hidden=true;$('pin').hidden=true;
    const putting=onGreen()&&!S.h.done;
    const key=[view.cx.toFixed(2),view.cy.toFixed(2),view.s.toFixed(4),view.ang.toFixed(4),W,H,cur.id,putting?1:0,holeObj().n].join('|');
    if(staticKey!==key){staticKey=key;if(!off)off=document.createElement('canvas');if(off.width!==cv.width||off.height!==cv.height){off.width=cv.width;off.height=cv.height}
      const main=ctx;ctx=off.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);drawStatic(W,H,putting);ctx=main}
    ctx.drawImage(off,0,0,W,H);
    drawDynamic(W,H,putting);drawMini();drawFlightReadout();
  }
  function drawSceneOverlay(result,W,H){
    const bs=result.ball,phase=S.h.phase,flight=phase==='flight';
    const target=$('target');target.hidden=flight||S.h.done;
    const pinBadge=$('pin');pinBadge.hidden=flight||S.h.done;
    const labels=[];
    if(!pinBadge.hidden){const p=scene.project(holeObj().pin,3.1);pinBadge.textContent='⚑ Pin '+Math.round(remaining())+' yd';labels.push({el:pinBadge,x:p[0],y:p[1]-52,anchor:1});}
    if(!target.hidden&&result.target){const p=scene.project(result.target,.2);target.textContent='Carry '+Math.round(dist(S.h.ball,result.target))+' yd';labels.push({el:target,x:p[0],y:p[1]-24,anchor:.5});}
    placeSceneLabels(labels,W,H);
    drawFlightReadout();
    if(G&&(G.kind==='pull'||G.kind==='trace')){ctx.strokeStyle='#fff9df';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(bs[0],bs[1]);for(const p of G.pts)ctx.lineTo(p.x,p.y);ctx.stroke();label(clamp(G.cur[0]-20,8,W-95),clamp(G.cur[1]-20,60,H-25),Math.round((S.h.power||0)*100)+'%');}
    if(mode==='dial'&&phase==='armed'){const r=12+Math.abs(S.h.needle||0)*75;ctx.strokeStyle='#fff4bd';ctx.lineWidth=3;ctx.beginPath();ctx.arc(bs[0],bs[1],r,0,7);ctx.stroke();ctx.lineWidth=1;ctx.beginPath();ctx.arc(bs[0],bs[1],12,0,7);ctx.stroke();}
  }
  function drawFlightReadout(){
    const read=$('flight-readout'),A=anim;read.hidden=S.h.phase!=='flight'||!A;
    if(read.hidden)return;
    if(A.kind==='putt'){
      const ft=dist(A.pos||A.b,holeObj().pin)*FT,near=ft<1;
      read.innerHTML='<span>PUTT ROLLING</span><strong>'+Math.round(near?ft*12:ft)+' <small>'+(near?'in':'ft')+'</small></strong><span>to the cup · '+Math.round(dist(A.b,holeObj().pin)*FT)+' ft putt</span>';
    }else{
      const inAir=performance.now()-A.t0<A.dur;
      read.innerHTML='<span>'+(inAir?'BALL IN FLIGHT':'ROLLING')+'</span><strong>'+Math.round(dist(A.pos||A.b,A.b))+' <small>yd</small></strong><span>'+esc(A.club.id)+' · '+(inAir?'distance so far':'total distance')+'</span>';
    }
  }
  // Keep projected distances near their course position without covering HUD
  // controls or each other. Measure the current layout so handedness, viewport,
  // landing inspection and different button widths use the same safe placement.
  function placeSceneLabels(labels,W,H){
    if(!labels.length)return;
    const base=$('stage').getBoundingClientRect(),gap=8;
    const blocked=[...$('stage').querySelectorAll('.hud > *, .foot > *, .lk-landing, .lk-powerrail, .camrow, .lk-plan')]
      .filter(el=>!el.hidden&&el.getClientRects().length).map(el=>{const r=el.getBoundingClientRect();return{x:r.left-base.left,y:r.top-base.top,w:r.width,h:r.height};});
    const overlaps=(a,b)=>a.x<b.x+b.w+gap&&a.x+a.w+gap>b.x&&a.y<b.y+b.h+gap&&a.y+a.h+gap>b.y;
    for(const {el,x,y,anchor} of labels){
      const w=el.offsetWidth,h=el.offsetHeight,maxX=W-w-gap,maxY=H-h-gap;
      const desired={x:clamp(x-w/2,gap,maxX),y:clamp(y-h*anchor,gap,maxY)};
      const xs=[desired.x,gap,maxX],ys=[desired.y,gap,maxY];
      for(const b of blocked){xs.push(clamp(b.x-w-gap,gap,maxX),clamp(b.x+b.w+gap,gap,maxX));ys.push(clamp(b.y-h-gap,gap,maxY),clamp(b.y+b.h+gap,gap,maxY));}
      let best=null,cost=Infinity;
      for(const px of xs)for(const py of ys){const box={x:px,y:py,w,h};if(blocked.some(b=>overlaps(box,b)))continue;const d=(px-desired.x)**2+(py-desired.y)**2;if(d<cost){best=box;cost=d;}}
      // Extremely small stages can have no free label-sized area. The same
      // distances remain in the dock rather than covering an interactive control.
      el.style.visibility=best?'':'hidden';
      if(best){el.style.left=best.x+'px';el.style.top=best.y+'px';blocked.push(best);}
    }
  }
  function drawMini(){
    if(!S?.h||$('mini').hidden)return;const mc=$('mini'),c=mc.getContext('2d'),h=holeObj(),p=h.path;
    const dx=h.pin[0]-h.tee[0],dy=h.pin[1]-h.tee[1],ang=Math.atan2(dx,dy),u=[Math.sin(ang),Math.cos(ang)],r=[u[1],-u[0]];
    const coords=q=>[(q[0]-h.tee[0])*r[0]+(q[1]-h.tee[1])*r[1],(q[0]-h.tee[0])*u[0]+(q[1]-h.tee[1])*u[1]];
    const pts=p.map(coords),minX=Math.min(...pts.map(q=>q[0]))-32,maxX=Math.max(...pts.map(q=>q[0]))+32,minY=-20,maxY=Math.max(...pts.map(q=>q[1]))+24;
    const scale=Math.min(140/(maxX-minX),180/(maxY-minY)),P=q=>{const v=coords(q);return[70+(v[0]-(minX+maxX)/2)*scale,170-(v[1]-minY)*scale]};
    c.fillStyle='#284e3a';c.fillRect(0,0,140,180);
    for(const f of cur.feats){
      if(!['fairway','green','bunker','water'].includes(f.kind))continue;
      const center=[(f.bb[0]+f.bb[2])/2,(f.bb[1]+f.bb[3])/2];
      // The small map is a guide to this hole, not a thumbnail of the property.
      if(['fairway','green'].includes(f.kind)&&cur.holes.some(other=>other!==h&&lineDist(center,other.path)+1<lineDist(center,h.path)))continue;
      if(lineDist(center,h.path)>65)continue;
      c.fillStyle={fairway:'#709956',green:'#a3bb71',bunker:'#e7d5ae',water:'#6ca5b2'}[f.kind];c.beginPath();for(let i=0;i<f.pts.length;i+=2){const q=P([f.pts[i],f.pts[i+1]]);i?c.lineTo(...q):c.moveTo(...q)}c.closePath();c.fill();
    }
    c.strokeStyle='rgba(255,255,238,.8)';c.lineWidth=1.5;c.setLineDash([3,3]);c.beginPath();p.forEach((q,i)=>{const a=P(q);i?c.lineTo(...a):c.moveTo(...a)});c.stroke();c.setLineDash([]);
    for(const [q,color,size]of [[h.pin,'#f3d276',4],[anim?.pos||S.h.ball,'#fff',4]]){const a=P(q);c.fillStyle=color;c.beginPath();c.arc(...a,size,0,7);c.fill();}
  }
  function drawStatic(W,H,putting){
    const s=view.s;
    ctx.fillStyle=COL.rough;ctx.fillRect(0,0,W,H);
    ctx.fillStyle=COL.rough2;const band=Math.max(8,22*s);for(let y=-band*2+((view.cy*s)%(band*2)+band*2)%(band*2);y<H;y+=band*2)ctx.fillRect(0,y,W,band);
    for(const f of cur.feats){if(!visible(f))continue;
      if(f.kind==='wood'){poly(f);ctx.fillStyle=COL.wood;ctx.fill()}
      else if(f.kind==='fairway'){poly(f);ctx.fillStyle=COL.fair;ctx.fill();ctx.save();ctx.clip();ctx.fillStyle=COL.fair2;const b=Math.max(5,12*s);for(let y=((view.cy*s)%(b*2)+b*2)%(b*2)-b*2;y<H;y+=b*2)ctx.fillRect(0,y,W,b);ctx.restore()}
      else if(f.kind==='tee'){poly(f);ctx.fillStyle=COL.tee;ctx.fill()}
      else if(f.kind==='water'){poly(f);ctx.fillStyle=COL.water;ctx.fill();ctx.lineWidth=Math.max(1,2*s);ctx.strokeStyle=COL.waterE;ctx.stroke();ctx.save();ctx.clip();ctx.strokeStyle=COL.waterHi;ctx.lineWidth=1;const b=Math.max(6,9*s);for(let y=((view.cy*s)%b+b)%b-b;y<H;y+=b){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}ctx.restore()}
      else if(f.kind==='bunker'){poly(f);ctx.fillStyle=COL.sand;ctx.fill();ctx.save();ctx.clip();ctx.lineWidth=Math.max(2,4*s);ctx.strokeStyle=COL.sandIn;ctx.stroke();ctx.restore();ctx.lineWidth=Math.max(1,1.4*s);ctx.strokeStyle=COL.sandE;ctx.stroke()}
      else if(f.kind==='green'){poly(f);ctx.lineWidth=Math.max(2,4*s);ctx.strokeStyle=putting?'#587540':COL.fringe;ctx.stroke();ctx.fillStyle=putting?'#799951':COL.green;ctx.fill();
        ctx.save();ctx.clip();ctx.fillStyle=putting?'#7c9d54':COL.green2;const b=Math.max(4,6*s);for(let x=((view.cx*s)%(b*2)+b*2)%(b*2)-b*2;x<W;x+=b*2)ctx.fillRect(x,0,b,H);ctx.restore()}
    }
    const W2=W+30,H2=H+30,G=cur.grid;
    const corners=[toWorld(-30,-30),toWorld(W2,-30),toWorld(-30,H2),toWorld(W2,H2)];
    const wx0=Math.min(...corners.map(q=>q[0])),wx1=Math.max(...corners.map(q=>q[0])),wy0=Math.min(...corners.map(q=>q[1])),wy1=Math.max(...corners.map(q=>q[1]));
    const cx0=Math.floor((wx0-G.x0)/G.cell),cx1=Math.floor((wx1-G.x0)/G.cell),cy0=Math.floor((wy0-G.y0)/G.cell),cy1=Math.floor((wy1-G.y0)/G.cell);
    const vis=[];for(let i=cx0;i<=cx1;i++)for(let j=cy0;j<=cy1;j++){const b=G.cells.get(i+','+j);if(b)vis.push(...b)}
    for(const t of vis){const p=toScreen(t.p);if(p[0]<-30||p[1]<-30||p[0]>W2||p[1]>H2)continue;const R=t.r*s;
      ctx.fillStyle=COL.shadow;ctx.beginPath();ctx.arc(p[0]+R*.35,p[1]+R*.35,R,0,7);ctx.fill();
      ctx.fillStyle=t.s>.5?COL.tree:COL.tree2;ctx.beginPath();ctx.arc(p[0],p[1],R,0,7);ctx.fill();
      ctx.fillStyle=COL.treeHi;ctx.beginPath();ctx.arc(p[0]-R*.3,p[1]-R*.3,R*.45,0,7);ctx.fill()}
    if(putting)drawSlopeField(W,H);
  }
  function drawSlopeField(W,H){ // downhill chevrons across the green, sized by grade
    const h=holeObj(),g=h.green,s=view.s;
    const step=Math.max(1.4,46/s);
    ctx.save();poly(g);ctx.clip();
    ctx.strokeStyle='rgba(240,248,210,.32)';ctx.lineWidth=1.2;ctx.lineCap='round';ctx.lineJoin='round';
    let row=0;
    for(let y=g.bb[1];y<=g.bb[3];y+=step,row++)for(let x=g.bb[0]-(row%2?step/2:0);x<=g.bb[2];x+=step){
      const p=[x,y];if(!inPoly(p,g))continue;
      const sl=slopeAt(h,p),m=Math.hypot(sl[0],sl[1]);if(m<0.002)continue;
      const L=Math.min(step*0.55,step*0.14+m*step*16)*s;
      const a=toScreen(p),b2=toScreen([p[0]+sl[0],p[1]+sl[1]]);const dx=b2[0]-a[0],dy=b2[1]-a[1],dl=Math.hypot(dx,dy)||1,ux=dx/dl,uy=dy/dl;
      const ex=a[0]+ux*L*.5,ey=a[1]+uy*L*.5,sx=a[0]-ux*L*.5,sy=a[1]-uy*L*.5,hd=Math.min(5,L*.4);
      ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(ex,ey);ctx.moveTo(ex-ux*hd-uy*hd*.7,ey-uy*hd+ux*hd*.7);ctx.lineTo(ex,ey);ctx.lineTo(ex-ux*hd+uy*hd*.7,ey-uy*hd-ux*hd*.7);ctx.stroke();
    }
    ctx.restore();
  }
  function drawDynamic(W,H,putting){
    const s=view.s,h=holeObj();
    const pp=toScreen(h.pin);
    const cupR=putting?Math.max(6,HOLE_R_FT/FT*s):HOLE_R_FT/FT*s;
    if(cupR>2.5){ctx.fillStyle='rgba(0,0,0,.4)';ctx.beginPath();ctx.arc(pp[0],pp[1]+cupR*.25,cupR*1.2,0,7);ctx.fill();ctx.fillStyle='#F7F3E8';ctx.beginPath();ctx.arc(pp[0],pp[1],cupR*1.12,0,7);ctx.fill();ctx.fillStyle='#2A2622';ctx.beginPath();ctx.arc(pp[0],pp[1],cupR*0.95,0,7);ctx.fill()}
    if(S.h.phase!=='flight'&&!S.h.done&&S.h.aim){
      const b=toScreen(S.h.ball),a=toScreen(S.h.aim);
      if(!putting){
        const F=forecast();const land=[S.h.ball[0]+F.u[0]*F.carryW+F.rgt[0]*F.lat,S.h.ball[1]+F.u[1]*F.carryW+F.rgt[1]*F.lat];
        const lp=toScreen(land);const q2=toScreen([land[0]+F.u[0],land[1]+F.u[1]]);const rot=Math.atan2(q2[1]-lp[1],q2[0]-lp[0]);
        ctx.save();ctx.translate(lp[0],lp[1]);ctx.rotate(rot);
        ctx.beginPath();ctx.ellipse(0,0,Math.max(3,F.sc*1.6*s),Math.max(3,F.sl*1.6*s),0,0,7);ctx.fillStyle='rgba(255,250,235,.26)';ctx.fill();ctx.lineWidth=1.2;ctx.setLineDash([4,3]);ctx.strokeStyle='rgba(255,250,235,.85)';ctx.stroke();ctx.setLineDash([]);ctx.restore();
        {const st=[land[0]-F.rgt[0]*F.curve,land[1]-F.rgt[1]*F.curve];ctx.strokeStyle='rgba(110,34,48,.9)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(b[0],b[1]);
          for(let k=0.1;k<=1.001;k+=0.1){const q=lerp(S.h.ball,st,k);const w=[q[0]+F.rgt[0]*F.curve*k*k,q[1]+F.rgt[1]*F.curve*k*k];const sp=toScreen(w);ctx.lineTo(sp[0],sp[1])}ctx.stroke()}
        if(mode==='sling'&&G&&G.kind==='pull'){const bs=toScreen(S.h.ball);ctx.strokeStyle='rgba(35,32,26,.55)';ctx.setLineDash([3,3]);ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(bs[0],bs[1]);ctx.lineTo(G.cur[0],G.cur[1]);ctx.stroke();ctx.setLineDash([]);
          ctx.strokeStyle='rgba(35,32,26,.35)';ctx.beginPath();ctx.arc(bs[0],bs[1],maxPull(),0,7);ctx.stroke();const pw=Math.round((S.h.power||0)*100);label(G.cur[0]+14,G.cur[1]-14,pw+'%'+(pw>100?' OVER':''))}
        if(mode==='meter'){ctx.strokeStyle='rgba(110,34,48,.45)';ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(pp[0],pp[1]);ctx.stroke();ctx.setLineDash([])}
        ctx.strokeStyle='#23201A';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(a[0],a[1],7,0,7);ctx.moveTo(a[0]-11,a[1]);ctx.lineTo(a[0]+11,a[1]);ctx.moveTo(a[0],a[1]-11);ctx.lineTo(a[0],a[1]+11);ctx.stroke();
        label(a[0]+12,a[1]-12,Math.round(F.want)+' yds');
      } else if(S.h.preview){
        ctx.strokeStyle='rgba(35,32,26,.45)';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(b[0],b[1]);const far=lerp(S.h.ball,S.h.aim,1.25),fp=toScreen(far);ctx.lineTo(fp[0],fp[1]);ctx.stroke();
        const P=S.h.preview.path;ctx.strokeStyle='rgba(255,255,255,.95)';ctx.lineWidth=2.2;ctx.setLineDash([2,6]);ctx.lineCap='round';ctx.beginPath();P.forEach((p,i)=>{const q=toScreen(p);i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1])});ctx.stroke();ctx.setLineDash([]);
        if(mode!=='meter'&&G&&G.kind==='pull'){const bs=toScreen(S.h.ball);ctx.strokeStyle='rgba(35,32,26,.55)';ctx.setLineDash([3,3]);ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(bs[0],bs[1]);ctx.lineTo(G.cur[0],G.cur[1]);ctx.stroke();ctx.setLineDash([]);
          const dx=G.cur[0]-bs[0],dy=G.cur[1]-bs[1],L=Math.hypot(dx,dy)||1,P0=maxPull()*0.4;ctx.strokeStyle='#F7F3E8';ctx.lineWidth=2;ctx.beginPath();ctx.arc(bs[0]+dx/L*P0,bs[1]+dy/L*P0,5,0,7);ctx.stroke();label(G.cur[0]+14,G.cur[1]-14,Math.round(L/P0*100)+'% pace')}
        const e=toScreen(S.h.preview.end);if(!S.h.preview.holed){ctx.strokeStyle='rgba(255,255,255,.95)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(e[0],e[1],5,0,7);ctx.stroke()}
        if(dist(S.h.aim,h.pin)>0.35){ctx.strokeStyle='#23201A';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(a[0],a[1],6,0,7);ctx.moveTo(a[0]-9,a[1]);ctx.lineTo(a[0]+9,a[1]);ctx.moveTo(a[0],a[1]-9);ctx.lineTo(a[0],a[1]+9);ctx.stroke()}
      }
    }
    if(!putting&&S.h.history.length>1){ctx.strokeStyle='rgba(255,255,255,.55)';ctx.lineWidth=1.2;ctx.setLineDash([2,4]);ctx.beginPath();S.h.history.forEach((p,i)=>{const q=toScreen(p);i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1])});if(anim&&anim.pos&&anim.kind==='shot'){const q=toScreen(anim.pos);ctx.lineTo(q[0],q[1])}ctx.stroke();ctx.setLineDash([])}
    if(anim&&anim.kind==='putt'&&anim.pos){const P=anim.res.path;ctx.strokeStyle='rgba(255,255,255,.7)';ctx.lineWidth=1.5;ctx.beginPath();let q=toScreen(P[0]);ctx.moveTo(q[0],q[1]);for(let i=1;i<=anim.i&&i<P.length;i++){q=toScreen(P[i]);ctx.lineTo(q[0],q[1])}q=toScreen(anim.pos);ctx.lineTo(q[0],q[1]);ctx.stroke()}
    if(!putting){ctx.strokeStyle='#F7F3E8';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(pp[0],pp[1]);ctx.lineTo(pp[0],pp[1]-26);ctx.stroke();
    ctx.fillStyle='#B3263A';ctx.beginPath();ctx.moveTo(pp[0]+1,pp[1]-26);ctx.lineTo(pp[0]+15,pp[1]-21);ctx.lineTo(pp[0]+1,pp[1]-16);ctx.closePath();ctx.fill()}
    const tp=toScreen(h.tee);ctx.fillStyle='#1D5E9A';ctx.beginPath();ctx.arc(tp[0]-7,tp[1]+2,2.5,0,7);ctx.arc(tp[0]+7,tp[1]+2,2.5,0,7);ctx.fill();
    if(mode==='trace'&&G&&(G.kind==='trace'||G.kind==='maybe')&&G.pts.length>1&&!putting){
      const st=G.pts[0];ctx.strokeStyle='rgba(35,32,26,.25)';ctx.lineWidth=1;ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(st.x,st.y-maxPull());ctx.lineTo(st.x,st.y+maxPull());ctx.stroke();ctx.setLineDash([]);
      for(const f of[.25,.5,.75,1]){const y=st.y+maxPull()*f;ctx.beginPath();ctx.moveTo(st.x-8,y);ctx.lineTo(st.x+8,y);ctx.stroke()}
      ctx.strokeStyle='rgba(251,247,236,.95)';ctx.lineWidth=3;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();G.pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();
      const r=traceRead(G);if(r){label(st.x+16,st.y-16,Math.round(r.power*100)+'%'+(r.phase==='through'?' · '+r.read:''))}}
    if(mode==='dial'&&S.h.phase==='armed'&&!putting){const bs=toScreen(S.h.ball),t=S.h.needle||0,RM=Math.min(110,cv.clientWidth*0.26),rb=Math.max(3.6,Math.min(7,0.047*s))+4;
      ctx.strokeStyle='rgba(251,247,236,.55)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(bs[0],bs[1],rb,0,7);ctx.stroke();
      ctx.strokeStyle='rgba(251,247,236,.5)';ctx.beginPath();ctx.arc(bs[0],bs[1],rb+RM*0.08,0,7);ctx.stroke();
      const r=rb+RM*Math.abs(t);ctx.strokeStyle=Math.abs(t)<=0.08?'#F2C14E':'#FBF7EC';ctx.lineWidth=3;ctx.beginPath();ctx.arc(bs[0],bs[1],r,0,7);ctx.stroke()}
    // flight trail (v255): the ground track in shadow and the arc the ball flew in white, both fading toward the tail
    const now=performance.now();
    if(anim&&anim.kind==='shot'&&anim.trail)drawTrail(anim.trail,1);
    else if(fx){const e=Math.min(1,(now-fx.t0)/FX_MS);drawTrail(fx.trail,1-e);drawPuff(fx,e)}
    if(anim&&anim.kind==='shot'&&anim.landedAt)drawPuff({t0:anim.landedAt,land:anim.land,lie:anim.lieLand},Math.min(1,(now-anim.landedAt)/FX_MS));
    let bp=S.h.ball,hgt=0;if(anim&&anim.pos){bp=anim.pos;hgt=anim.h||0}
    if(!(S.h.done&&S.h.holed)){
      const q=toScreen(bp);const hf=1/(1+hgt/45); // the shadow shrinks and fades as the ball climbs, so height reads without a side view
      ctx.fillStyle='rgba(0,0,0,'+(0.3*hf).toFixed(3)+')';ctx.beginPath();ctx.ellipse(q[0]+hgt*.35,q[1]+hgt*.2,3.4*(0.6+0.4*hf),2.2*(0.6+0.4*hf),0,0,7);ctx.fill();
      const r=Math.max(3.6,Math.min(7,0.047*s))+hgt*0.06;ctx.fillStyle='#fff';ctx.strokeStyle='rgba(0,0,0,.45)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(q[0],q[1]-hgt,r,0,7);ctx.fill();ctx.stroke();
    }
  }
  function drawTrail(T,alphaMul){
    if(!T||T.length<2||alphaMul<=0)return;
    const s=view.s;ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
    const pts=T.map(t=>{const q=toScreen(t.p);return[q[0],q[1],t.hy*s]});
    // ground track: a soft dark line under the flight
    ctx.strokeStyle='rgba(20,30,15,'+(0.16*alphaMul).toFixed(3)+')';ctx.lineWidth=2;ctx.beginPath();pts.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]));ctx.stroke();
    // the arc, drawn in short segments so the tail fades and the head stays bright
    const n=pts.length;for(let i=1;i<n;i++){const k=i/n;ctx.strokeStyle='rgba(255,255,255,'+(0.85*k*alphaMul).toFixed(3)+')';ctx.lineWidth=1+2.2*k;ctx.beginPath();ctx.moveTo(pts[i-1][0],pts[i-1][1]-pts[i-1][2]);ctx.lineTo(pts[i][0],pts[i][1]-pts[i][2]);ctx.stroke()}
    ctx.restore();
  }
  function drawPuff(F,e){ // a ring that spreads and fades where the ball landed; sand-coloured in a bunker, a splash ring in water
    if(e>=1)return;const q=toScreen(F.land),s=view.s;const ease=1-(1-e)*(1-e);const R=(3+14*ease)*Math.max(0.35,Math.min(1.2,s/3));const a=(1-e)*(F.lie==='water'?0.8:0.55);
    ctx.save();ctx.lineWidth=F.lie==='bunker'?3:2;ctx.strokeStyle=F.lie==='bunker'?'rgba(201,180,126,'+a.toFixed(3)+')':F.lie==='water'?'rgba(255,255,255,'+a.toFixed(3)+')':'rgba(255,255,255,'+(a*0.8).toFixed(3)+')';
    ctx.beginPath();ctx.ellipse(q[0],q[1],R,R*0.62,0,0,7);ctx.stroke();
    if(F.lie==='water'){ctx.lineWidth=1.2;ctx.beginPath();ctx.ellipse(q[0],q[1],R*0.55,R*0.34,0,0,7);ctx.stroke()}
    else if(F.lie==='bunker'){ctx.fillStyle='rgba(234,219,176,'+(a*0.9).toFixed(3)+')';for(let i=0;i<5;i++){const an=i/5*Math.PI*2+0.4;const d=R*(0.7+0.4*ease);ctx.beginPath();ctx.arc(q[0]+Math.cos(an)*d,q[1]+Math.sin(an)*d*0.62-ease*6,1.6+ease,0,7);ctx.fill()}}
    ctx.restore();
  }
  function label(x,y,t){ctx.font='600 11px ui-monospace,SFMono-Regular,Menlo,monospace';const w=ctx.measureText(t).width+10;ctx.fillStyle='rgba(251,247,236,.94)';ctx.beginPath();ctx.roundRect?ctx.roundRect(x,y-9,w,18,9):ctx.rect(x,y-9,w,18);ctx.fill();ctx.fillStyle='#23201A';ctx.fillText(t,x+5,y+4)}

  /* ---------- loop ---------- */
  function kick(){if(!raf)raf=requestAnimationFrame(tick)}
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function tick(ts){
    raf=0;let busy=false;
    const k=reduced?1:camK;
    let da=view.tang-view.ang;while(da>Math.PI)da-=2*Math.PI;while(da<-Math.PI)da+=2*Math.PI;
    if(Math.abs(view.tcx-view.cx)>.05||Math.abs(view.tcy-view.cy)>.05||Math.abs(view.ts-view.s)/view.s>.002||Math.abs(da)>.001){
      view.cx+=(view.tcx-view.cx)*k;view.cy+=(view.tcy-view.cy)*k;view.s+=(view.ts-view.s)*k;view.ang+=da*k;busy=true}
    else{camK=0.14;intro=false}
    if(anim){busy=true;stepAnim(ts)}
    if(fx){if(ts-fx.t0<FX_MS)busy=true;else fx=null}
    if(meterOn){busy=true;updateNeedle(performance.now())}
    draw();
    if(busy&&!raf)raf=requestAnimationFrame(tick);
  }
  function needleAt(now){if(mode==='dial'){const p=((now-meterT0)/meterPeriod())%2;return p<1?-(1-p):(p-1)}const t=(now-meterT0)/meterPeriod();return -Math.cos(t*Math.PI*2)}
  function updateNeedle(now){S.h.needle=needleAt(now);$('needle').style.left=(50+S.h.needle*50)+'%'}
  function meterPeriod(){const c=S.h.club;if(mode==='dial')return 950;if(c.putter)return 1600;const base=c.id==='DR'?1050:c.carry>170?1200:1400;return base*(S.h.lie==='rough'||S.h.lie==='bunker'?0.9:1)}

  /* ---------- shot ---------- */
  function grade(t){const a=Math.abs(t);return a<=0.08?'PURED':a<=0.25?'SOLID':'STRUCK'}
  function swing(gest){
    if(!S?.h||landingView||!['aim','armed'].includes(S.h.phase))return;
    clearBanner();
    lastShot=JSON.parse(JSON.stringify(S));lastShot.h.power=null;lastShot.h.phase='aim';
    const now=performance.now();if(meterOn)S.h.needle=needleAt(now);meterOn=false;const t=gest?(gest.t||0):(S.h.needle||0);const g=gest?gest.g:grade(t);
    if(!gest){
    $('needle').style.left=(50+t*50)+'%';const hit=$('hit');hit.style.left=(50+t*50)+'%';hit.hidden=false;
    const gl=$('grade');const put=S.h.club.putter;gl.textContent=put?(g==='PURED'?'PERFECT PACE':t<0?'SHORT':'LONG'):g+(Math.abs(t)>0.08?(t<0?' · LEFT':' · RIGHT'):'');gl.hidden=false;}
    const c=S.h.club,h=holeObj(),b=S.h.ball.slice();
    S.h.strokes++;S.h.phase='flight';
    if(c.putter){putt(t,gest);renderUI();return}
    const F=forecast();const kq=g==='PURED'?.45:g==='SOLID'?1:1.7;
    const lieBefore=S.h.lie;
    let carry=F.carryW+gauss()*F.sc*kq-(g==='STRUCK'?F.carry*0.06*Math.random():0);
    let lat=F.lat+gauss()*F.sl*kq+t*14*(F.carry/150);
    carry=Math.max(5,carry);
    const land=[b[0]+F.u[0]*carry+F.rgt[0]*lat,b[1]+F.u[1]*carry+F.rgt[1]*lat];
    const dir=[land[0]-b[0],land[1]-b[1]],dl=Math.hypot(...dir);const ud=[dir[0]/dl,dir[1]/dl];
    const lieLand=lieAt(cur,land);
    const rollF={fairway:.85,rough:.3,green:.5,bunker:0,water:0,trees:.05,ob:0}[lieLand];
    let roll=c.roll*(1+boost()/100)*F.frac*F.frac*rollF*F.rollMult;
    let end=[land[0]+ud[0]*roll,land[1]+ud[1]*roll];
    if(lieLand==='green'||lieLand==='fairway'){const dp=segDist(h.pin,land,end);if(dp<0.25&&g!=='STRUCK')end=h.pin.slice()}
    let endLie=lieAt(cur,end);if(lieLand==='water'||lieLand==='ob'){end=land;endLie=lieLand}
    const apex=Math.min(60,10+carry*0.22)*(F.tj<0?0.55:F.tj>0?1.35:1);
    const dur=reduced?1:Math.min(2300,900+carry*7);
    anim={kind:'shot',t0:performance.now(),dur,rollDur:reduced?1:Math.min(900,200+roll*20),b,land,end,apex,g,carry,lieLand,endLie,lieBefore,club:c,curve:F.curve,rgt:F.rgt,gest};
    S.h.power=null;G=null;
    renderUI();kick();
  }
  function stepAnim(ts){
    const A=anim;const t=(ts-A.t0);
    if(A.kind==='shot'){
      if(t<A.dur){const k=Math.max(0,t)/A.dur;const st=[A.land[0]-A.rgt[0]*A.curve,A.land[1]-A.rgt[1]*A.curve];const q=lerp(A.b,st,k);A.pos=[q[0]+A.rgt[0]*A.curve*k*k,q[1]+A.rgt[1]*A.curve*k*k];A.h=4*A.apex*k*(1-k)*Math.min(1,view.s*0.8);
        // trail: world position + height in yards (height is stored in world units so it scales with the camera like everything else)
        if(!reduced){(A.trail||(A.trail=[])).push({p:A.pos,hy:A.h/Math.max(view.s,1e-6),worldHeight:4*A.apex*k*(1-k)});if(A.trail.length>TRAIL_MAX)A.trail.shift()}}
      else if(t<A.dur+A.rollDur){const k=(t-A.dur)/A.rollDur;const e=1-(1-k)*(1-k);A.pos=lerp(A.land,A.end,e);A.h=0;if(!A.landedAt&&!reduced)A.landedAt=ts}
      else{if(!reduced)fx={t0:A.landedAt||ts,land:A.land,lie:A.lieLand,trail:A.trail||[]};anim=null;finishShot(A)}
    } else if(A.kind==='putt'){
      const P=A.res.path,i=clamp(t/A.dur,0,1)*(P.length-1);
      if(i<P.length-1){const k=Math.floor(i);A.i=k;A.pos=lerp(P[k],P[k+1],i-k)}
      else{anim=null;finishPutt(A)}
    }
  }
  function finishShot(A){
    const h=holeObj();let msg=A.g,sub='';
    const shotNumber=S.h.strokes;let penalty=0,holed=false;
    const flown=dist(A.b,A.end);
    if(A.lieBefore==='tee'&&h.par>3)S.fir[1]++;
    if(A.endLie==='water'){
      S.h.strokes++;S.h.penalties++;penalty=1;
      let p=A.end;for(let k=1;k<=60;k++){const q=lerp(A.end,A.b,k/60);if(lieAt(cur,q)!=='water'){p=lerp(q,A.b,Math.min(1,3/Math.max(1,dist(q,A.b))));break}}
      S.h.ball=p;S.h.lie=lieAt(cur,p);if(S.h.lie==='green')S.h.lie='rough';msg='WATER';sub='+1 penalty · drop';
    } else if(A.endLie==='ob'){
      S.h.strokes++;S.h.penalties++;penalty=1;S.h.ball=A.b;S.h.lie=A.lieBefore;msg='OUT OF BOUNDS';sub='stroke and distance';
    } else {
      S.h.ball=A.end;S.h.lie=A.endLie;
      if(A.lieBefore==='tee'&&h.par>3&&A.endLie==='fairway')S.fir[0]++;
      if(A.lieBefore==='tee')S.longest=Math.max(S.longest,flown);
      sub=Math.round(A.carry)+' yd carry · '+LIE[S.h.lie].name.toLowerCase()+' · '+Math.round(remaining())+' yd left';
      holed=dist(S.h.ball,h.pin)<0.3;
    }
    if(A.lieBefore==='tee'&&h.par>3)S.h.fairway=A.endLie==='fairway';
    S.h.shots.push({number:shotNumber,kind:'shot',club:A.club.id,from:A.lieBefore,distance:dist(A.b,A.end),toPin:dist(A.b,h.pin),carry:A.carry,lie:A.endLie,penalty,holed});
    S.h.history.push(S.h.ball.slice());
    if(S.h.lie==='green'&&!S.h.gir&&S.h.strokes<=h.par-2)S.h.gir=true;
    if(holed){holeOut();return}
    if(S.h.lie==='green'&&remaining()*FT<=GIMME_FT){banner(msg,sub+' · tap-in',1200);S.h.phase='flight';renderUI();frame();gimmeTimer=setTimeout(gimme,900);return}
    banner(msg,sub);
    S.h.phase='aim';S.h.pw=1;S.h.traj=0;pickDefaultClub();defaultAim();frame();renderUI();
  }
  function gimme(){if(!S||!S.h||S.h.done)return;S.h.strokes++;S.h.putts++;S.h.shots.push({number:S.h.strokes,kind:'gimme',club:'PT',from:'green',distance:remaining(),toPin:remaining(),holed:true});S.h.history.push(holeObj().pin.slice());holeOut()}
  function putt(t,gest){
    const h=holeObj(),b=S.h.ball.slice();
    const v0=(gest?gest.v0:S.h.vPerfect*(1+0.38*t))*(1+gauss()*0.02);
    const a=Math.atan2(S.h.dir[1],S.h.dir[0])+gauss()*0.0035;
    const dir=[Math.cos(a),Math.sin(a)];
    const res=simPutt(h,b,dir,v0);
    S.h.putts++;
    // Playback is bounded and distance-aware; the full simulated path and final
    // outcome remain untouched, including slopes, lip-outs and gimme scoring.
    anim={kind:'putt',t0:performance.now(),res,b,i:0,dur:reduced?120:clamp(900+pathLen(res.path)*FT*65,1000,3200),g:grade(t),t:gest?gest.t:t};S.h.power=null;G=null;kick();
  }
  function finishPutt(A){
    const h=holeObj();S.h.ball=A.res.end;S.h.history.push(A.res.end.slice());
    S.h.shots.push({number:S.h.strokes,kind:'putt',club:'PT',from:'green',distance:pathLen(A.res.path),toPin:dist(A.b,h.pin),left:remaining(),holed:A.res.holed,lip:A.res.lip});
    if(A.res.holed){holeOut();return}
    S.h.lie=lieAt(cur,A.res.end);if(S.h.lie!=='green'&&S.h.lie!=='rough')S.h.lie='rough';
    const ft=remaining()*FT;
    if(S.h.lie==='green'&&ft<=GIMME_FT){banner(A.res.lip?'LIP OUT':'CLOSE','tap-in',1100);renderUI();gimmeTimer=setTimeout(gimme,800);return}
    banner(A.res.lip?'LIP OUT':A.t<-0.08?'SHORT':A.t>0.08?'RAN BY':'GOOD PACE',Math.round(ft)+' ft left');
    S.h.phase='aim';pickDefaultClub();defaultAim();frame();renderUI();
  }
  function holeOut(){
    if(S.h.done)return;
    const h=holeObj(),n=S.h.strokes,d=n-h.par;
    S.h.done=true;S.h.holed=true;S.scores[S.idx]=n;S.putts[S.idx]=S.h.putts;S.h.gir=!!S.h.gir||n<=h.par-2;if(S.h.gir)S.gir++;
    const names={'-3':'ALBATROSS','-2':'EAGLE','-1':'BIRDIE','0':'PAR','1':'BOGEY','2':'DOUBLE BOGEY','3':'TRIPLE BOGEY'};
    const big=n===1?'HOLE IN ONE':(names[d]||('+'+d));
    clearBanner();renderHoleRecap(big);
    S.h.phase='done';renderUI();draw();$('recap').scrollTop=0;$('recap').focus({preventScroll:true});
  }
  function renderHoleRecap(scoreName){
    const h=holeObj(),last=S.h.shots.at(-1),n=S.h.strokes;
    let special=null;
    if(last?.kind==='shot'&&last.holed){
      const name=n===1?'HOLE IN ONE!':last.from==='bunker'?'BUNKER HOLE-OUT!':last.toPin<=50?'CHIP-IN!':'HOLE-OUT!';
      special={name,detail:n===1?Math.round(last.toPin)+' yards. One swing. In the cup.':last.club+' from '+Math.round(last.toPin)+' yd — straight in.'};
    }else if(last?.kind==='putt'&&last.holed&&last.toPin*FT>=15){special={name:'LONG PUTT!',detail:'Drained it from '+Math.round(last.toPin*FT)+' feet.'};}
    const round=S.scores.reduce((sum,score,i)=>sum+score-cur.holes.find(q=>q.n===S.holes[i]).par,0);
    S.h.recap={scoreName,strokes:n,putts:S.h.putts,penalties:S.h.penalties,fairway:S.h.fairway,gir:S.h.gir,special,round};
    const stat=(label,value)=>'<div><dt>'+label+'</dt><dd>'+value+'</dd></div>';
    $('recap').innerHTML='<div class="lk-recap-kicker">'+esc(cur.name)+' · Hole '+h.n+' · Par '+h.par+'</div>'+
      (special?'<div class="lk-special"><strong>'+special.name+'</strong><span>'+esc(special.detail)+'</span></div>':'')+
      '<div class="lk-recap-score"><div><h2 id="lk-recap-title">'+scoreName+'</h2><p>'+toParStr(round)+' for the round · '+(S.practice?'practice round':S.idx+1+' '+(S.idx?'holes':'hole')+' complete')+'</p></div><div class="lk-stroke-total"><strong>'+n+'</strong><span>strokes</span></div></div>'+
      '<dl class="lk-recap-stats">'+stat('Putts',S.h.putts)+stat('Fairway',h.par===3?'Par 3':S.h.fairway?'Hit':'Missed')+stat('Green in reg.',S.h.gir?'Yes':'No')+stat('Penalties',S.h.penalties)+'</dl>'+
      '<h3>How you played it</h3><ol class="lk-shot-list">'+S.h.shots.map(shot=>{
        const putt=shot.kind!=='shot',name=shot.kind==='gimme'?'Tap-in':putt?'Putter':shot.club==='Dr'?'Driver':esc(shot.club);
        const distance=Math.round((putt?shot.toPin:shot.distance)*(putt?FT:1))+' '+(putt?'ft':'yd');
        const result=shot.kind==='gimme'?'Gimme':shot.holed?'In the hole':putt?Math.round(shot.left*FT)+' ft left':shot.lie==='ob'?'Out of bounds':LIE[shot.lie]?.name||shot.lie;
        return '<li><span class="lk-shot-index">'+shot.number+'</span><span><b>'+name+'</b><small>'+distance+(shot.penalty?' · +1 penalty':'')+'</small></span><em>'+result+'</em></li>';
      }).join('')+'</ol>';
  }
  function nextHole(){if(S.idx+1>=S.holes.length){finish();return}S.idx++;startHole()}

  /* ---------- UI ---------- */
  let bannerTimer=0;
  function clearBanner(){clearTimeout(bannerTimer);$('banner').classList.remove('on');}
  function banner(big,sub,ms=1600){$('bbig').textContent=big;$('bsub').textContent=sub||'';const el=$('banner');el.classList.add('on');clearTimeout(bannerTimer);bannerTimer=setTimeout(()=>el.classList.remove('on'),ms)}
  function toParStr(v){return v===0?'E':(v>0?'+':'')+v}
  function scoreClass(n,par){if(n==null)return'';const d=n-par;if(n===1)return'ace';return d<=-2?'u2':d===-1?'u1':d===1?'o1':d>=2?'o2':''}
  function sideStr(v){const a=Math.round(Math.abs(v));return a<1?'straight':a+(v>0?' R':' L')}
  function shotReadout(){const F=forecast(),h=holeObj(),pinAlong=(h.pin[0]-S.h.ball[0])*F.u[0]+(h.pin[1]-S.h.ball[1])*F.u[1],delta=Math.round(F.carryW-pinAlong);
    $('readout').innerHTML='<span>Pin <b>'+Math.round(remaining())+' yd</b> · Carry <b>'+Math.round(F.carryW)+' yd</b></span><span>'+(Math.abs(delta)<2?'Pin distance':Math.abs(delta)+' yd '+(delta>0?'long':'short'))+' · Expected drift <b>'+sideStr(F.lat)+'</b></span>';
  }
  function renderUI(){$('maplabel').textContent=camMode==='shot'?'Hole map':'Shot view';$('camtog').hidden=onGreen();
    const h=holeObj();
    rootNode.classList.toggle('lk-hole-complete',S.h.done);$('recap').hidden=!S.h.done;
    const flight=S.h.phase==='flight';rootNode.classList.toggle('lk-flying',flight);$('skip').hidden=!flight||!anim;
    $('skip').textContent=anim?.kind==='putt'?'Finish putt ›':'Skip flight ›';
    rootNode.classList.toggle('lk-landing-view',!!landingView);
    $('landing').hidden=S.h.phase!=='aim'||onGreen();
    $('landing').setAttribute('aria-pressed',String(!!landingView));
    $('landing').textContent=landingView?(S.h.lie==='tee'?'← Back to tee':'← Back to ball'):'Landing spot ↗';
    $('powerrail').hidden=!!landingView||S.h.phase!=='aim'||(mode!=='sling'&&!S.h.club.putter);
    $('retry').disabled=!lastShot||flight||S.daily;
    $('retry').title=S.daily?'Retry is unavailable in the daily challenge':'Return to the same lie and wind; switches this round to practice';
    $('distance-info').textContent='Scorecard: '+(h.yds||'unavailable')+' yd. Mapped tee to pin: '+Math.round(dist(h.tee,h.pin))+' yd. Card yardage is for '+cur.tee+' tees; mapped route endpoints are approximate and may use a different tee/pin position. Terrain elevation and green breaks are simulated, not surveyed. Course data has not been stretched to match the card.';
    if(!rail)resetRail();
    $('clubsummary').innerHTML='<span>'+esc(S.h.club.putter?'Putter':S.h.club.id==='Dr'?'Driver':S.h.club.id)+'</span><small>'+(S.h.club.putter?'Read the green':Math.round(fullCarry(S.h.club))+' yd carry')+'</small><b>⌄</b>';
    $('shapesummary').textContent=(S.h.traj<0?'Low':S.h.traj>0?'High':'Stock')+' · '+(S.h.shape<0?'Draw':S.h.shape>0?'Fade':'Straight');
    $('shapebox').hidden=onGreen()||S.h.done;$('clubbox').hidden=onGreen()||S.h.done;
    if(flight){$('clubbox').open=false;$('shapebox').open=false;}
    $('plan').dataset.holePlan=cur.id;$('plan').dataset.hole=h.n;
    $('gcourse').textContent=cur.name+' · '+cur.tee;
    $('ghole').textContent='Hole '+h.n;
    const played=S.scores.reduce((a,n,i)=>a+(n!=null?n-cur.holes.find(x=>x.n===S.holes[i]).par:0),0);
    $('gpar').textContent=toParStr(played);
    $('gline').innerHTML='<span>Par '+h.par+'</span><span>'+(h.yds||Math.round(h.len))+' yd card</span>';
    const start=Math.floor(S.idx/9)*9,slice=S.holes.slice(start,start+9);
    let html='';for(let i=0;i<9;i++){const n=slice[i];if(n==null){html+='<div></div>';continue}const hh=cur.holes.find(x=>x.n===n),sc=S.scores[start+i];
      html+='<div class="'+(start+i===S.idx?'lk-cur':'')+'">'+n+'<b><span class="lk-sc '+scoreClass(sc,hh.par)+'">'+(sc??(start+i===S.idx&&S.h.strokes?S.h.strokes:''))+'</span></b>'+hh.par+'</div>'}
    $('gcard').innerHTML=html;
    const w=S.h.wind;const rel=(w.from+Math.PI)-view.tang;
    $('wind').innerHTML='<svg viewBox="0 0 16 16" style="transform:rotate('+(rel*180/Math.PI)+'deg)"><path d="M8 2 L12 9 H9 V14 H7 V9 H4 Z" fill="#23201A"/></svg><b>'+w.mph+'</b> mph';
    $('lie').innerHTML=S.h.done?'<b>Holed</b>':'Lie <b>'+(S.h.lie==='tee'?'Tee':LIE[S.h.lie]?.name||S.h.lie)+'</b>';
    const putting=onGreen()&&!S.h.done;
    $('topin').innerHTML=S.h.done?'In the hole':putting?'<b>'+Math.round(remaining()*FT)+'</b> ft':'<b>'+Math.round(remaining())+'</b> yds to pin';
    $('shotno').innerHTML=(S.practice?'Practice · ':'')+'Shot <b>'+(S.h.strokes+(S.h.done||S.h.phase==='flight'?0:1))+'</b>';
    $('clubs').hidden=putting;
    if(!putting)$('clubs').innerHTML=BAG.map(cb=>'<button type="button" class="lk-club" data-c="'+cb.id+'" aria-pressed="'+(S.h.club&&S.h.club.id===cb.id)+'"'+(S.h.phase!=='aim'?' disabled':'')+'><b>'+cb.id+'</b><span>'+Math.round(fullCarry(cb))+'</span></button>').join('');
    $('labL').textContent=putting?'SHORT':'EARLY · LEFT';$('labR').textContent=putting?'LONG':'LATE · RIGHT';
    const hint=$('hint');
    if(S.h.done){$('readout').innerHTML='<span>'+(S.idx+1<S.holes.length?'On to hole '+S.holes[S.idx+1]:'Last hole done')+'</span>';hint.hidden=true}
    else if(putting&&S.h.preview){const ft=remaining()*FT,P=S.h.preview;const brk=((P.end[0]-S.h.ball[0])*S.h.dir[1]-(P.end[1]-S.h.ball[1])*S.h.dir[0])*FT*12;const sl=slopeAt(h,lerp(S.h.ball,h.pin,.5));const up=-(sl[0]*S.h.dir[0]+sl[1]*S.h.dir[1]);
      $('readout').innerHTML='<span>Putt <b>'+Math.round(ft)+' ft</b> · '+(Math.abs(up)<0.004?'flat':up>0?'uphill':'downhill')+'</span><span>breaks <b>'+(Math.abs(brk)<1?'straight':Math.round(Math.abs(brk))+' in '+(brk>0?'R':'L'))+'</b>'+(P.holed?' · <b>on line</b>':'')+'</span>';
      hint.textContent=mode==='meter'?'DRAG TO SET YOUR LINE · DOTS = PERFECT PACE':'PULL THE SIDE GRIP DOWN · 100% = IDEAL PACE';hint.hidden=S.h.phase!=='aim'}
    else{shotReadout();
      hint.hidden=true;hint.textContent=mode==='meter'?'DRAG ON THE HOLE TO AIM':mode==='dial'?'TAP THE HOLE TO SET YOUR LINE · SET SHAPE · STRIKE':'TAP THE HOLE TO SET YOUR LINE'}
    const act=$('act');
    const gest=mode!=='meter';
    $('meter').hidden=true;$('shaperow').hidden=!gest||putting||S.h.done;
    if(gest){for(const b of $('trajseg').children)b.setAttribute('aria-pressed',+b.dataset.t===(S.h.traj||0));$('shape').value=S.h.shape;$('shape').disabled=mode==='trace';$('shapeval').textContent=S.h.shape?((S.h.shape<0?'draw ':'fade ')+Math.abs(S.h.shape)):(mode==='trace'?'from swing':'straight')}
    const instr=$('instr');
    $('pwseg').hidden=mode!=='dial';
    const dialFull=mode==='dial'&&!putting;
    if(gest&&S.h.phase==='aim'&&!dialFull){act.hidden=true;instr.hidden=false;instr.innerHTML=putting?'<b>Pull the side grip down to putt</b>':mode==='sling'?'<b>Tap course to aim · pull side grip ↓</b>':'<b>Trace: down, then up through the ball</b>';}
    else if(gest&&S.h.phase==='flight'&&!dialFull){act.hidden=true;instr.hidden=false;instr.textContent=putting?'Rolling…':'In the air…'}
    else{act.hidden=false;instr.hidden=true}
    if(dialFull){for(const b of $('pwseg').children)b.setAttribute('aria-pressed',+b.dataset.p===(S.h.pw||1))}
    act.disabled=S.h.phase==='flight';
    act.textContent=S.h.phase==='done'?(S.idx+1<S.holes.length?'Next hole':'See your card'):S.h.phase==='armed'?(mode==='dial'?'Tap when the ring meets the ball':putting?'Putt':'Swing'):S.h.phase==='flight'?(putting?'Rolling…':'In the air…'):mode==='dial'?'Strike':'Lock the line';
    $('meter').style.opacity=S.h.phase==='armed'?1:.5;if(mode==='dial')$('shaperow').hidden=putting||S.h.done;
    if(S.h.phase==='done'||(S.h.phase==='aim'&&S.h.strokes===0)){$('needle').style.left='50%';$('hit').hidden=true;$('grade').hidden=true}
    if(landingView){act.hidden=true;instr.hidden=false;instr.textContent='Tap or drag to adjust aim · return to swing';}
  }
  function act(){
    if(!S||!S.h||landingView)return;
    if(S.h.phase==='done'){nextHole();return}
    if(mode!=='meter'&&mode!=='dial'&&S.h.phase!=='done')return;
    if(mode==='dial'&&S.h.phase==='armed'){strike();return}
    if(mode==='dial'&&S.h.phase==='aim'&&S.h.club.putter)return;
    if(S.h.phase==='aim'){S.h.phase='armed';meterOn=true;meterT0=performance.now();$('hit').hidden=true;$('grade').hidden=true;renderUI();kick();return}
    if(S.h.phase==='armed'){swing();return}
  }
  /* one input path: pointerdown acts immediately (exact swing read, no tap delay); click only serves keyboards */
  let lastPointer=0;
  $('act').addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;lastPointer=performance.now();act()});
  $('act').addEventListener('click',()=>{if(performance.now()-lastPointer<800)return;act()});
  const onKey=e=>{if(!R||e.target.closest?.('button,input,select,textarea,summary,a,[role="dialog"]'))return;if((e.code==='Space'||e.code==='Enter')&&S?.h&&!$('game').hidden&&(mode==='meter'||S.h.phase==='done')){e.preventDefault();act()}};document.addEventListener('keydown',onKey);
  $('score-toggle').addEventListener('click',()=>{const open=$('gcard').hidden;$('gcard').hidden=!open;$('score-toggle').setAttribute('aria-expanded',String(open));$('score-toggle').setAttribute('aria-label',open?'Hide scorecard':'Show scorecard');});
  $('skip').addEventListener('click',()=>{if(!anim)return;const A=anim;anim=null;fx=null;if(A.kind==='shot')finishShot(A);else finishPutt(A);scene?.reset();draw();});
  // Separate thumb pad keeps the chosen target line: screen perspective must not
  // turn a horizontal pull into an arbitrary direction in world coordinates.
  function resetRail(){railPower=1;$('powerrail').style.setProperty('--power','0');$('powerlabel').textContent='Pull down';$('powercarry').textContent=S?.h?.club.putter?'100% = ideal pace':'Release to swing';$('powerhint').textContent='Slide away to cancel';}
  function railUpdate(power){
    railPower=power;
    if(S.h.club.putter){G.pace=power;G.v0=S.h.vPerfect*power;S.h.preview=simPutt(holeObj(),S.h.ball,S.h.dir,G.v0);}
    else {S.h.power=power;shotReadout();}
    $('powerrail').style.setProperty('--power',String(power/1.1));
    $('powerlabel').textContent=Math.round(power*100)+'%';
    $('powercarry').textContent=S.h.club.putter?'putt pace':Math.round(forecast().carryW)+' yd carry';
    draw();
  }
  function cancelRail(){rail=null;G=null;if(S?.h){S.h.power=null;if(S.h.club.putter)updatePutt();renderUI();draw();}}
  $('powerhandle').addEventListener('pointerdown',e=>{
    if(e.button!==0||G||!S?.h||S.h.phase!=='aim')return;
    e.preventDefault();e.stopPropagation();$('powerrail').setPointerCapture(e.pointerId);
    rail={id:e.pointerId,x:e.clientX,y:e.clientY,travel:$('powerrail').querySelector('.lk-powertrack').clientHeight-44};
    G={id:e.pointerId,kind:'pad',cur:[e.clientX,e.clientY],pts:[],t0:performance.now()};railUpdate(0);
  });
  $('powerrail').addEventListener('pointermove',e=>{
    if(!rail||rail.id!==e.pointerId)return;
    rail.cancel=Math.abs(e.clientX-rail.x)>65;
    G.pts.push({x:e.clientX,y:e.clientY,t:performance.now()});G.cur=[e.clientX,e.clientY];
    railUpdate(Math.max(0,Math.min(1.1,(e.clientY-rail.y)/rail.travel*1.1)));
    $('powerhint').textContent=rail.cancel?'Release to cancel':'Release to '+(S.h.club.putter?'putt':'swing');
  });
  $('powerrail').addEventListener('pointerup',e=>{if(!rail||rail.id!==e.pointerId)return;if(rail.cancel||railPower<.15){cancelRail();return;}rail=null;firePull();G=null;if(S?.h){renderUI();draw();}});
  $('powerrail').addEventListener('pointercancel',cancelRail);
  $('powerrail').addEventListener('lostpointercapture',()=>{if(rail)cancelRail();});
  $('powerhandle').addEventListener('keydown',e=>{if(!S?.h||S.h.phase!=='aim')return;if(['ArrowDown','ArrowUp','Escape'].includes(e.key)){e.preventDefault();if(e.key==='Escape'){cancelRail();return;}G={kind:'pad',pts:[],cur:[0,0]};railUpdate(Math.max(.15,Math.min(1.1,railPower+(e.key==='ArrowDown'?.05:-.05))));}});
  $('powerhandle').addEventListener('click',e=>{if(e.detail!==0||!S?.h||S.h.phase!=='aim')return;G={kind:'pad',pts:[],cur:[0,0]};railUpdate(railPower);firePull();G=null;renderUI();draw();});
  $('hand').addEventListener('click',()=>{cancelRail();const left=rootNode.classList.toggle('lk-left-handed');store.set('hand',left?'left':'right');draw();});
  $('retry').addEventListener('click',()=>{
    if(!lastShot||!S||S.daily||S.h.phase==='flight')return;
    clearTimeout(gimmeTimer);clearTimeout(bannerTimer);anim=null;fx=null;meterOn=false;G=null;rail=null;landingView=null;
    S=JSON.parse(JSON.stringify(lastShot));S.practice=true;S.h.power=null;S.h.phase='aim';
    if(S.h.club.putter)updatePutt();scene?.reset();frame(true);renderUI();draw();banner('Practice shot','Same lie and wind · excluded from best rounds');
  });
  $('instr').addEventListener('click',e=>{if(e.detail!==0||!S?.h||landingView||S.h.phase!=='aim'||mode==='trace')return;S.h.power=1;swing({g:'SOLID',t:0,...(S.h.club.putter?{v0:S.h.vPerfect}:{})});});
  $('landing').addEventListener('click',()=>{
    if(!S?.h||S.h.phase!=='aim'||onGreen())return;
    cancelRail();
    if(landingView)landingView=null;
    else {const F=forecast(),b=S.h.ball;landingView={center:[b[0]+F.u[0]*F.carryW+F.rgt[0]*F.lat,b[1]+F.u[1]*F.carryW+F.rgt[1]*F.lat],angle:frameTarget().ang};}
    camMode='shot';scene?.reset();frame(true);renderUI();draw();
  });
  $('camtog').addEventListener('click',e=>{e.preventDefault();e.stopPropagation();cancelRail();landingView=null;scene?.reset();camMode=camMode==='shot'?'hole':'shot';store.set('cam',camMode);if(S&&S.h)frame(false);renderUI();draw()});
  $('clubs').addEventListener('click',e=>{const b=e.target.closest('.lk-club');if(!b||S.h.phase!=='aim')return;cancelRail();const id=b.dataset.c;S.h.club=BAG.find(c=>c.id===id);
    const fc=fullCarry(S.h.club),d=dist(S.h.ball,S.h.aim);if(d>fc*1.05||d<fc*0.6)defaultAim();$('clubbox').open=false;scene?.reset();frame();renderUI();draw()});
  function maxPull(){return Math.min(220,cv.clientHeight*0.38)}
  function local(e){const r=cv.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top]}
  function screenDirToWorld(bs,dx,dy){const w1=toWorld(bs[0],bs[1]),w2=toWorld(bs[0]+dx,bs[1]+dy);const d=[w2[0]-w1[0],w2[1]-w1[1]],L=Math.hypot(d[0],d[1])||1;return[d[0]/L,d[1]/L]}
  function setLine(p){
    if(S.h.club.putter){S.h.aim=p;updatePutt();frame();renderUI();draw();return}
    S.h.lineAim=p;S.h.power=null;const fc=fullCarry(S.h.club),d=dist(p,S.h.ball)||1;S.h.aim=[S.h.ball[0]+(p[0]-S.h.ball[0])/d*Math.min(d,fc),S.h.ball[1]+(p[1]-S.h.ball[1])/d*Math.min(d,fc)];frame();renderUI();draw()}
  function pullUpdate(){
    const bs=toScreen(S.h.ball),dx=G.cur[0]-bs[0],dy=G.cur[1]-bs[1],L=Math.hypot(dx,dy);
    if(L<6)return;const dir=screenDirToWorld(bs,-dx,-dy);
    if(S.h.club.putter){const P0=maxPull()*0.4;S.h.aim=[S.h.ball[0]+dir[0]*3,S.h.ball[1]+dir[1]*3];updatePutt();G.v0=S.h.vPerfect*(L/P0);S.h.preview=simPutt(holeObj(),S.h.ball,S.h.dir,G.v0);G.pace=L/P0}
    else{S.h.power=Math.min(1.1,L/maxPull());const fc=fullCarry(S.h.club);S.h.aim=[S.h.ball[0]+dir[0]*fc*S.h.power,S.h.ball[1]+dir[1]*fc*S.h.power]}
    renderUI();draw();
  }
  function releaseSteadiness(){const now=performance.now();const recent=G.pts.filter(p=>now-p.t<120);if(recent.length<2)return 0;let m=0;for(let i=1;i<recent.length;i++)m=Math.max(m,Math.hypot(recent[i].x-recent[i-1].x,recent[i].y-recent[i-1].y));return m}
  function strike(){
    const t=needleAt(performance.now());meterOn=false;const g=grade(t);
    const sh=S.h.shape;const where=Math.abs(t)<=0.08?'CENTER':t<0?'TOE':'HEEL';
    const read=g+' · '+where+(sh?' · '+(sh<0?'DRAW ':'FADE ')+Math.abs(sh):'')+(S.h.traj?(S.h.traj<0?' · LOW':' · HIGH'):'')+(S.h.pw<1?' · '+(S.h.pw===0.75?'¾':'½')+' SWING':'');
    swing({g,read,t:t*0.6});
  }
  function firePull(){
    if(S.h.club.putter){if(!G.v0||G.pace<0.15){renderUI();draw();return}const t=Math.max(-1,Math.min(1,(G.pace-1)/0.38));swing({g:grade(t),t,v0:G.v0});return}
    if(!S.h.power||S.h.power<0.15){S.h.power=null;renderUI();draw();return}
    const j=releaseSteadiness();const g=j<3?'PURED':j<8?'SOLID':'STRUCK';
    const sh=S.h.shape;const read=g+(sh?' · '+(sh<0?'DRAW ':'FADE ')+Math.abs(sh):'')+(S.h.traj?(S.h.traj<0?' · LOW':' · HIGH'):'');
    swing({g,read});
  }
  function traceRead(g){
    const P=g.pts,st=P[0];let bi=0;for(let i=1;i<P.length;i++)if(P[i].y>P[bi].y)bi=i;
    const back=P[bi],backLen=back.y-st.y;if(backLen<14)return null;
    const power=Math.max(0.2,Math.min(1.1,backLen/maxPull()));
    const e=P[P.length-1];const thr=[e.x-back.x,e.y-back.y],thrLen=Math.hypot(thr[0],thr[1]);
    if(bi===P.length-1||thrLen<backLen*0.25)return{power,phase:'back',read:''};
    const pathDeg=Math.max(-25,Math.min(25,Math.atan2(thr[0],-thr[1])*180/Math.PI));
    const faceDeg=Math.max(-18,Math.min(18,(e.x-st.x)/4));
    const punch=thrLen<backLen*0.6;
    let dev=0;for(let i=bi;i<P.length;i++){const d=Math.abs((P[i].x-back.x)*thr[1]-(P[i].y-back.y)*thr[0])/(thrLen||1);dev=Math.max(dev,d)}
    const ratio=dev/(thrLen||1);const gq=ratio<0.06?'PURED':ratio<0.14?'SOLID':'STRUCK';
    const curve=Math.max(-1,Math.min(1,(faceDeg-pathDeg)/8));
    const start=0.8*faceDeg+0.2*pathDeg;
    const read=(Math.abs(faceDeg)<1.5?'FACE SQUARE':'FACE '+Math.abs(faceDeg).toFixed(0)+'° '+(faceDeg>0?'OPEN':'CLOSED'))+' · PATH '+Math.abs(pathDeg).toFixed(0)+'° '+(pathDeg>0?'IN-OUT':'OUT-IN')+(punch?' · PUNCH':'');
    return{power:punch?power*0.8:power,phase:'through',g:gq,curve,start,punch,read,faceDeg,pathDeg};
  }
  function fireTrace(){
    const r=traceRead(G);if(!r||r.phase!=='through'){S.h.power=null;renderUI();draw();return}
    const b=S.h.ball,la=S.h.lineAim||S.h.aim;const base=Math.atan2(la[1]-b[1],la[0]-b[0]);
    const ang=base-r.start*Math.PI/180;const dir=[Math.cos(ang),Math.sin(ang)];
    S.h.shape=Math.round(r.curve*3);if(r.punch)S.h.traj=-1;S.h.power=r.power;
    const fc=fullCarry(S.h.club);S.h.aim=[b[0]+dir[0]*fc*r.power,b[1]+dir[1]*fc*r.power];
    const shapeTxt=Math.abs(r.curve)<0.2?'STRAIGHT':r.curve<0?'DRAW':'FADE';
    swing({g:r.g,read:r.g+' · '+shapeTxt+' · '+r.read});
  }
  let dragging=false;
  function aimFrom(e){if(!S||!S.h||S.h.phase!=='aim')return;const r=cv.getBoundingClientRect();const p=toWorld(e.clientX-r.left,e.clientY-r.top);
    if(S.h.club.putter){if(dist(p,S.h.ball)<0.3)return;S.h.aim=p;updatePutt()}else S.h.aim=p;renderUI();draw()}
  cv.addEventListener('pointerdown',e=>{
    if(rail)return;if(G?.kind==='pad')cancelRail();
    if(landingView){if(!e.isPrimary||e.button!==0||S.h.phase!=='aim')return;e.preventDefault();cv.setPointerCapture(e.pointerId);G={id:e.pointerId,kind:'landing'};setLine(toWorld(...local(e)));return;}
    if(mode==='meter'){dragging=true;cv.setPointerCapture(e.pointerId);aimFrom(e);return}
    if(mode==='dial'&&S&&S.h&&S.h.phase==='armed'){strike();return}
    if(!S||!S.h||S.h.phase!=='aim')return;cv.setPointerCapture(e.pointerId);const pt=local(e);
    if(G&&G.id!==e.pointerId){if(!G.second){G.second={id:e.pointerId,a0:Math.atan2(pt[1]-G.cur[1],pt[0]-G.cur[0]),shape0:S.h.shape}}return}
    G={id:e.pointerId,start:pt,cur:pt,pts:[{x:pt[0],y:pt[1],t:performance.now()}],t0:performance.now(),kind:'tap',second:null};
    const bs=toScreen(S.h.ball);const near=Math.hypot(pt[0]-bs[0],pt[1]-bs[1])<52;
    if(mode==='sling'||S.h.club.putter){G.kind='tap'}else{G.kind='maybe'}
    draw();
  });
  cv.addEventListener('pointermove',e=>{
    if(G?.kind==='landing'){if(e.pointerId===G.id)setLine(toWorld(...local(e)));return;}
    if(mode==='meter'){if(dragging)aimFrom(e);return}
    if(!G)return;const pt=local(e);
    if(G.second&&e.pointerId===G.second.id){const a=Math.atan2(pt[1]-G.cur[1],pt[0]-G.cur[0]);let d=(a-G.second.a0)*180/Math.PI;while(d>180)d-=360;while(d<-180)d+=360;S.h.shape=Math.max(-3,Math.min(3,Math.round(G.second.shape0+d/15)));$('shape').value=S.h.shape;renderUI();draw();return}
    if(e.pointerId!==G.id)return;
    G.cur=pt;G.pts.push({x:pt[0],y:pt[1],t:performance.now()});if(G.pts.length>400)G.pts.shift();
    const moved=Math.hypot(pt[0]-G.start[0],pt[1]-G.start[1]);
    if(G.kind==='maybe'&&moved>10)G.kind='trace';
    if(G.kind==='tap'&&moved>10)G.kind='none';
    if(G.kind==='pull')pullUpdate();else if(G.kind==='trace'){const r=traceRead(G);if(r)S.h.power=r.power;draw()}
  });
  function endGesture(e){
    if(G?.kind==='landing'){if(e.pointerId===G.id){G=null;setLine(toWorld(...local(e)));}return;}
    if(mode==='meter'){dragging=false;return}
    if(!G)return;
    if(G.second&&e.pointerId===G.second.id){G.second=null;return}
    if(e.pointerId!==G.id)return;
    const g=G;const pt=local(e);
    if(g.kind==='tap'||(g.kind==='maybe'&&performance.now()-g.t0<350)){G=null;setLine(toWorld(pt[0],pt[1]));return}
    if(g.kind==='pull'){firePull();G=null;return}
    if(g.kind==='trace'){fireTrace();G=null;return}
    G=null;S.h.power=null;renderUI();draw();
  }
  cv.addEventListener('pointerup',endGesture);
  cv.addEventListener('pointercancel',e=>{G=null;dragging=false;if(S&&S.h){S.h.power=null;renderUI();draw()}});
  const ro=new ResizeObserver(()=>{if(S&&S.h){frame(!intro)}draw()});ro.observe($('stage'));

  /* ---------- menu / end ---------- */
  function show(which){
    $('menu').hidden=which!=='menu';$('end').hidden=which!=='end';$('game').hidden=which!=='game';$('menuwrap').hidden=which==='game';
    document.body.classList.toggle('lk-ingame',which==='game');window.scrollTo(0,0);fit();requestAnimationFrame(()=>{fit();if(S&&S.h)frame(true);draw()});
  }
  function todayKey(){const d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()}
  const ids=DIR.map(c=>c.id);
  function dailyCourse(){return ids[hashStr(todayKey())%ids.length]}
  let pick=store.get('course',ids[0]);if(!COURSES[pick])pick=ids[0];let plen=store.get('len','18');
  function renderMenu(){
    BAG=liveBag();const best=store.get('best',{});
    $('courses').innerHTML=ids.map(id=>{const c=dirOf(id),par=c.par||c.holes.reduce((a,h)=>a+(h.par||0),0),b=best[id+':18'],tee=(c.tees||[]).find(t=>t.id===c.defaultTee)||(c.tees||[])[0];
      return '<button type="button" class="cpick" data-id="'+id+'" aria-pressed="'+(id===pick)+'"><span class="n">'+esc(c.shortName||c.name)+'</span><span class="m">'+esc(c.place||'')+(c.holes.length===18?' · par '+par:'')+' · '+c.holes.length+' holes'+(tee?' · '+esc(tee.name)+' tees':'')+'</span><span class="best">'+(b!=null?'Best 18<b>'+toParStr(b)+'</b>':'Not played')+'</span></button>'}).join('');
    {const c=dirOf(pick),tee=(c.tees||[]).find(t=>t.id===c.defaultTee)||(c.tees||[])[0],b=best[pick+':18'];$('picked').innerHTML='<span class="n">'+esc(c.shortName||c.name)+'</span><span class="m">'+esc(c.place||'')+' · '+c.holes.length+' holes'+(tee?' · '+esc(tee.name)+' tees':'')+(b!=null?' · best '+toParStr(b):'')+'</span>'}
    for(const b of $('lenseg').children)b.setAttribute('aria-pressed',b.dataset.len===plen);
    for(const b of $('modeseg').children)b.setAttribute('aria-pressed',b.dataset.mode===mode);$('modenote').textContent=MODENOTE[mode];
    $('dailyName').textContent=(dirOf(dailyCourse())||{}).shortName+' · 18 · same wind for everyone today';
    $('boost').value=boost();$('boostlab').textContent='+'+boost()+'% · driver plays '+Math.round(carryOf(BAG[0]))+' carry';
    const rows=BAG.map(c=>'<tr><td>'+esc(c.id)+'</td><td>'+Math.round(c.carry)+'</td><td>'+c.cons+'</td><td>'+sideStr(c.side)+'</td><td>'+(c.est?'~':'')+c.sideSD+'</td><td>'+(c.est?'~':'')+Math.round(c.roll)+'</td><td>'+esc(c.src)+'</td></tr>').join('');
    $('bagtable').innerHTML='<tr><th>Club</th><th>Carry</th><th>Consist.</th><th>Avg side</th><th>Side spread</th><th>Roll</th><th>Source</th></tr>'+rows;
    $('bagnote').innerHTML='Yards. Carries come from your Caddie HQ bag ladder (edit them in Bag). The slider adds a percentage on top of every carry and roll, since indoor Normalize-on readings run short of outdoor stock numbers; +10% is a starting guess, not a measurement. ~ marks spread and roll values the game estimates because no session measured them.';
  }
  $('pwseg').addEventListener('click',e=>{const b=e.target.closest('button');if(!b||!S||!S.h||S.h.phase!=='aim')return;S.h.pw=+b.dataset.p;renderUI();draw()});
  $('trajseg').addEventListener('click',e=>{const b=e.target.closest('button');if(!b||!S||!S.h||S.h.phase!=='aim')return;S.h.traj=+b.dataset.t;renderUI();draw()});
  $('shape').addEventListener('input',e=>{if(!S||!S.h||S.h.phase!=='aim')return;S.h.shape=+e.target.value;renderUI();draw()});
  const MODENOTE={sling:'Tap the course to aim. Pull the side grip down and release to swing; 100% is full power, 110% adds spread. Slide sideways away from the rail to cancel. Switch side suits either hand. Choose draw/fade in the shot drawer. Putting uses the same rail, with 100% indicating ideal pace. Try shot again restores the same lie/wind and makes the round practice-only; unavailable in the daily challenge.',trace:'Draw the swing with your thumb: down for the backswing, then up through the ball. Backswing length is power. Face (where you finish left or right) and path (the angle you come through) shape the ball like real flight laws.',dial:'Plan the shot, then execute it. Tap the hole to set your line, pick draw or fade, trajectory and swing length, then tap Strike. A ring closes on the ball; tap when it meets the ball for pure contact. Early is toe, late is heel.'};
  $('modeseg').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;mode=b.dataset.mode;store.set('mode',mode);renderMenu()});
  $('boost').addEventListener('input',e=>{store.set('boost',+e.target.value);$('boostlab').textContent='+'+boost()+'% · driver plays '+Math.round(carryOf(BAG[0]))+' carry'});
  $('courses').addEventListener('click',e=>{const b=e.target.closest('.cpick');if(!b)return;pick=b.dataset.id;store.set('course',pick);renderMenu();$('picked').scrollIntoView({block:'start',behavior:'smooth'})});
  $('lenseg').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;plen=b.dataset.len;store.set('len',plen);renderMenu()});
  async function startRound(id,len,daily,btn){
    if(btn){btn.disabled=true;btn.dataset.label=btn.textContent;btn.textContent='Loading course…'}
    const token=++roundToken;
    try{await Promise.all([loadCourse(id),ensureScene()]);if(stopped||token!==roundToken)return;BAG=liveBag();newRound(id,len,daily)}
    catch(err){if(stopped)return;(bridge.toast||(m=>console.warn(m)))('Could not load that course. Connect to the internet to download it, then try again.')}
    finally{if(btn&&btn.isConnected){btn.disabled=false;btn.textContent=btn.dataset.label}}
  }
  $('start').addEventListener('click',e=>startRound(pick,plen,false,e.currentTarget));
  $('daily').addEventListener('click',e=>startRound(dailyCourse(),'18',true,e.currentTarget));
  $('quit').addEventListener('click',()=>{S=null;anim=null;fx=null;meterOn=false;if(bridge.onExit){bridge.onExit();return}renderMenu();show('menu')});
  $('menu2').addEventListener('click',()=>{S=null;renderMenu();show('menu')});
  $('again').addEventListener('click',e=>startRound(S.course,S.len,false,e.currentTarget));
  function finish(){
    const holes=S.holes.map(n=>cur.holes.find(h=>h.n===n));
    const par=holes.reduce((a,h)=>a+h.par,0),tot=S.scores.reduce((a,b)=>a+b,0),tp=tot-par;
    const key=S.course+':'+S.len,best=store.get('best',{});const isBest=!S.practice&&(best[key]==null||tp<best[key]);if(isBest){best[key]=tp;store.set('best',best)}
    $('ecourse').textContent=cur.name+' · '+(S.len==='18'?'18 holes':S.len==='front'?'Front 9':'Back 9')+(S.daily?' · today\'s course':'');
    $('escore').textContent=toParStr(tp);$('etitle').textContent=S.practice?'Practice complete':isBest?'New best round':'Round complete';
    $('estrokes').textContent=tot+' strokes on a par '+par+(S.practice?' · practice, excluded from best rounds':isBest||best[key]==null?'':' · best '+toParStr(best[key]));
    let t='';for(let i=0;i<holes.length;i+=9){const part=holes.slice(i,i+9);t+='<tr><th>Hole</th>'+part.map(h=>'<th>'+h.n+'</th>').join('')+'<th>Tot</th></tr><tr><td>Par</td>'+part.map(h=>'<td>'+h.par+'</td>').join('')+'<td>'+part.reduce((a,h)=>a+h.par,0)+'</td></tr><tr><td>You</td>'+part.map((h,j)=>'<td><span class="lk-sc '+scoreClass(S.scores[i+j],h.par)+'">'+S.scores[i+j]+'</span></td>').join('')+'<td><b>'+S.scores.slice(i,i+9).reduce((a,b)=>a+b,0)+'</b></td></tr>'}
    $('etable').innerHTML=t;
    const putts=S.putts.reduce((a,b)=>a+b,0);
    $('estats').innerHTML='<div class="lk-stat"><span class="kick">Fairways</span><b>'+S.fir[0]+'/'+S.fir[1]+'</b></div><div class="lk-stat"><span class="kick">Greens in reg</span><b>'+S.gir+'/'+holes.length+'</b></div><div class="lk-stat"><span class="kick">Putts</span><b>'+putts+'</b></div><div class="lk-stat"><span class="kick">Longest drive</span><b>'+Math.round(S.longest)+'</b></div>';
    const g2=S;S=null;S=g2;show('end');
  }
  /* The game is sized to the VISIBLE viewport: top of the game section down to the bottom safe-area inset (CSS subtracts env()).
     visualViewport beats innerHeight on iOS, where the toolbar and the home indicator both eat space innerHeight still reports. */
  function fit(){const g=$('game');if(!g||g.hidden)return;const top=Math.max(0,g.getBoundingClientRect().top);const vv=window.visualViewport;const vh=vv&&vv.height?vv.height:window.innerHeight;R.style.setProperty('--lk-vh',Math.round(vh)+'px');R.style.setProperty('--lk-top',Math.round(top)+'px')}
  window.addEventListener('resize',fit);if(window.visualViewport)window.visualViewport.addEventListener('resize',fit);
  dbgFn=()=>({landingView,camMode,renderer:threeActive?'3d':'map',scene:scene?.info(),course:S?.course,hole:S?.h?holeObj().n:null,aim:S?.h?.aim,worldBall:S?.h?.ball,pin:S?.h?holeObj().pin:null,lie:S?.h?.lie,ball:S&&S.h?toScreen(S.h.ball):null,phase:S&&S.h&&S.h.phase,mode,strokes:S&&S.h&&S.h.strokes,scores:S&&S.scores,anim:anim?{kind:anim.kind,trail:anim.trail?anim.trail.length:0,landed:!!anim.landedAt}:null,fx:fx?{age:Math.round(performance.now()-fx.t0),trail:fx.trail.length,lie:fx.lie}:null,drawMs:()=>{const t0=performance.now();for(let i=0;i<30;i++){staticKey='';draw()}return(performance.now()-t0)/30}});
  stopFn=()=>{stopped=true;S=null;roundToken++;clearTimeout(gimmeTimer);scene?.dispose();scene=null;if(raf)cancelAnimationFrame(raf);raf=0;anim=null;fx=null;meterOn=false;clearTimeout(bannerTimer);ro.disconnect();document.removeEventListener('keydown',onKey);window.removeEventListener('resize',fit);if(window.visualViewport)window.visualViewport.removeEventListener('resize',fit);document.body.classList.remove('lk-ingame')};
  renderMenu();draw();

}
window.CaddieLinks=Object.freeze({render,mount,unmount,debug:()=>dbgFn?dbgFn():null});
})();
