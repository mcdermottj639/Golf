// Source integrity and existing-install preservation for the new planner.
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),clone=x=>JSON.parse(JSON.stringify(x));
const dummy={addEventListener(){},querySelectorAll(){return []},classList:{add(){},remove(){},toggle(){}},style:{},dataset:{}};
const storage={},ctx={console,setTimeout(){},clearTimeout(){},setInterval(){},document:{addEventListener(){},querySelector(){return dummy},querySelectorAll(){return []},getElementById(){return dummy},body:dummy},navigator:{},localStorage:{getItem:k=>storage[k]||null,setItem:(k,v)=>storage[k]=v},window:{addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})}};
vm.createContext(ctx);
for(const f of ['lessons.js','courses-db.js','course-cards.js','course-prep-data.js','hole-guide.js','course-prep.js'])vm.runInContext(read(f),ctx);
for(const c of ctx.window.CADDIE_PREP_COURSES)Object.assign(c,JSON.parse(read(c.pack.url)));
let app=read('app.js');
vm.runInContext(app.slice(0,app.indexOf('// ---------- Boot ----------'))+`
rerender=()=>{};toast=()=>{};load();initCoursePrep();
window.prepTest={applyFeed,get:()=>S,briefHole,liveBriefing,livePlay,coursePrepNote,publishedCard,liveRound,priorLayout,liveCard};
})();`,ctx);
const T=ctx.window.prepTest,C=ctx.window.CADDIE_PREP_COURSES[0],P=ctx.window.CaddieCoursePrep;
const feedNames=app.match(/Promise\.all\(\[([^\]]+)\]\.map\(name => fetch/)[1].match(/'([^']+)'/g).map(x=>x.slice(1,-1));
for(const f of feedNames.filter(x=>x!=='course-prep-feed.json'))T.applyFeed(JSON.parse(read(f)));
const state=T.get();
state.planCalls={'pound ridge golf club':{1:{club:['5-wood'],ts:'2026-10-05'}}};
state.futureCustomField={keep:'unknown state must survive'};
const before=clone(state),newFeed=JSON.parse(read('course-prep-feed.json'));
T.applyFeed(newFeed);
for(const k of ['rounds','carries','clubs','bays','sessions','planCalls','futureCustomField'])assert.deepEqual(clone(state[k]),before[k],k+' unchanged');
const once=JSON.stringify(state);T.applyFeed(newFeed);assert.equal(JSON.stringify(state),once,'feed applies once');
assert.equal(C.holes.length,18);assert.equal(new Set(C.holes.map(h=>h.n)).size,18);
assert.equal(C.holes.reduce((s,h)=>s+h.par,0),72);
assert.deepEqual(clone(C.holes.map(h=>h.si).sort((a,b)=>a-b)),Array.from({length:18},(_,i)=>i+1));
const expected={black:[7165,75.9,148],oak:[6773,74.2,144],pound:[6486,72.4,138],granite:[6261,71.7,138],ridge:[6010,70.2,134],sand:[5683,68.3,132],pine:[5151,null,null]};
assert.equal(C.tees.length,7);
for(const tee of C.tees){assert.equal(tee.yards.length,18);assert.equal(tee.yards.reduce((a,b)=>a+b,0),tee.total);assert.deepEqual([tee.total,tee.rating,tee.slope],expected[tee.id]);}
const osm=JSON.parse(read('data/course-prep/pound-ridge-osm.json'));
for(const h of C.holes){const original=osm.features.find(f=>f.id===h.osmId);assert.ok(original);assert.equal(+original.tags.ref,h.n);assert.equal(+original.tags.par,h.par);assert.deepEqual(clone(h.path),original.path);assert.ok(h.path.every(P.geo.pointOK));}
// Haversine and destination agree for actual course-sized planning distances.
for(const yards of [0,100,235,600])for(const heading of [0,90,180,270])assert.ok(Math.abs(P.geo.distance(C.center,P.geo.destination(C.center,yards,heading))-yards)<0.001);
assert.equal(P.geo.pointOK([0,0]),false);
const sanitized=P.clean({tee:'invented',basis:'invented',holes:{'granite:1':{note:'a'.repeat(2500),roll:999,tee:[0,0],target:C.center,reviewed:'yes'},'granite:99':{note:'bad'}}});
assert.equal(sanitized.tee,'granite');assert.equal(sanitized.basis,'playing');assert.equal(sanitized.holes['granite:1'].note.length,1800);assert.equal(sanitized.holes['granite:1'].roll,60);assert.equal(sanitized.holes['granite:1'].tee,undefined);assert.equal(sanitized.holes['granite:1'].reviewed,false);assert.equal(sanitized.holes['granite:99'],undefined);
state.coursePrep={poundRidge:{tee:'granite',holes:{'granite:1':{note:'Aim at my saved target <script>bad()</script>'}}}};
const b=T.liveBriefing({course:C.name,date:'2026-10-22'}),h=T.briefHole(b,1);
assert.equal(b.holes.length,18);assert.ok(b.sections.some(s=>/archiv/i.test(s.t)),'historical research remains available');
assert.deepEqual(clone(h.club),['5-wood']);assert.equal(h.yours,true);assert.ok(h.prepNote.includes('Aim at my saved target'));
assert.equal(T.coursePrepNote('Spyglass Hill',1),'');
const html=P.render();assert.ok(html.includes('&lt;script&gt;bad()&lt;/script&gt;'));assert.ok(!html.includes('<script>bad()'));
assert.equal(JSON.stringify(state.carries),JSON.stringify(before.carries));
console.log('PASS course prep: 18 source routes, seven official tee totals/ratings, geometry math, input bounds, idempotent feed, preserved rounds/bag/calls and live prep note.');

const catalog=ctx.window.CADDIE_PREP_COURSES;
assert.equal(catalog.length,4);const stable=clone(state);
for(const course of catalog){
  const raw=JSON.parse(read('data/course-prep/'+course.id+'-osm.json'));
  P.openHole(1,course.id);assert.equal(P.courseId,course.id);
  assert.ok(P.render().includes(course.shortName));
  for(const h of course.holes){if(!h.osmId){assert.equal(h.mapReady,false);assert.ok(h.guide);continue;}const way=raw.features.find(f=>f.id===h.osmId);assert.deepEqual(clone(h.path),way.path);assert.ok(h.path.every(P.geo.pointOK));}
  const other=catalog.find(c=>c.id!==course.id);
  assert.equal(P.geo.pointOK(other.center),false,'course-specific GPS boundary');
  const plan=P.clean({tee:course.defaultTee,holes:{[course.defaultTee+':1']:{note:course.id,target:course.center,tee:other.center}}},course.id);
  assert.deepEqual(clone(plan.holes[course.defaultTee+':1'].target),clone(course.center));assert.equal(plan.holes[course.defaultTee+':1'].tee,undefined);
  assert.equal(T.publishedCard(course.name,null).by.get(1).par,course.holes[0].par);
  assert.equal(P.findCourse(course.aliases[0]).id,course.id);
}
assert.deepEqual(clone(state),stable,'course entry/read-only cleaning never changes player state');
assert.equal(T.coursePrepNote('Pound Ridge Golf Club',1),'Aim at my saved target <script>bad()</script>','notes resolve their own course independently of the active map');
assert.equal(P.openHole(1,'unknown-course'),false);assert.equal(P.findCourse('Sterling'),undefined,'no ambiguous partial course match');
console.log('PASS multi-course data: original coordinates, isolated boundaries and notes, sourced live cards, exact aliases, no state writes during navigation.');

assert.equal(catalog.flatMap(c=>c.holes).filter(h=>h.mapReady!==false).length,72);
const W=P.findCourse('wianno'),w2=W.holes[1],wraw=JSON.parse(read('data/course-prep/wianno-osm.json'));
assert.notEqual(w2.mapReady,false);assert.ok(w2.mapVerification);
assert.equal(wraw.features.find(f=>f.id===989266485).tags.golf,'tee','raw source remains unchanged');
assert.equal(W.features.find(f=>f.id===989266485).kind,'green','confirmed correction reaches all map renderers');
assert.deepEqual(clone(w2.path),wraw.features.find(f=>f.id===1136751491).path,'confirmed route coordinates stay unchanged');
assert.ok(P.hasGuide(W,w2),'hole 2 has a sourced illustration');
P.openHole(2,'wianno');assert.ok(!P.render().includes('17 of 18 interactive hole maps ready'));

const M=P.findCourse('The Conk');assert.equal(M.holes.length,27);assert.equal(M.holes.filter(h=>h.guide).length,27);assert.equal(M.tees.length,4);
for(const h of catalog.flatMap(c=>c.holes)){
 const c=catalog.find(c=>c.holes.includes(h)),geometry=ctx.window.CaddieHoleGuide.layout(c,h);
 if(h.mapReady===false){assert.equal(geometry,null);continue;}
 assert.ok(geometry.tee[1]>geometry.green[1],'tee is below green');
 for(const p of [geometry.tee,geometry.green])assert.ok(p[0]>=0&&p[0]<=600&&p[1]>=0&&p[1]<=900);
 const svg=ctx.window.CaddieHoleGuide.render(c,h);assert.ok(!svg.includes('NaN'));assert.ok(svg.includes('CADDIE HQ GUIDE'));
}
for(const route of M.routings){
 const L={course:M.name,routingId:route.id,routingLabel:route.name,date:'2026-10-08',holes:route.holes.map(n=>({n,par:M.holes[n-1].par,s:M.holes[n-1].par})),cur:0,stage:'card'};
 const r=T.liveRound(L);assert.equal(r.routingId,route.id);assert.deepEqual(clone(r.holes.map(h=>h.n)),clone(route.holes));
 assert.ok(T.liveCard(L).includes(route.name.replaceAll('&','&amp;')));
}
console.log('PASS illustrated guides: sourced shapes, tee-to-green orientation, all 27 official Metedeconk guides, physical-hole routing and preserved round identity.');

const oldRounds=state.rounds;
state.rounds=[{course:M.name,date:'2026-10-08',routingId:'third',rating:36,slope:130,holes:M.holes.slice(18).map(h=>({n:h.n,par:h.par,s:h.par}))}];
assert.equal(T.priorLayout(M.name,null,'third').rating,36,'nine-hole rating stays with the same routing');
assert.equal(T.priorLayout(M.name,null,'first-third'),null,'a different nine combination cannot inherit the rating or card');
state.rounds=oldRounds;
