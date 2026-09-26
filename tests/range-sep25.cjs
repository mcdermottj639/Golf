// Execute the real importer/render functions without browser layout; browser suite is separate.
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const dummy={addEventListener(){},querySelectorAll(){return []},classList:{add(){},remove(){},toggle(){}},style:{},dataset:{}};
const storage={};
const ctx={console,setTimeout(){},clearTimeout(){},setInterval(){},document:{addEventListener(){},querySelector(){return dummy},querySelectorAll(){return []},getElementById(){return dummy},body:dummy},navigator:{},localStorage:{getItem:k=>storage[k]||null,setItem:(k,v)=>storage[k]=v},window:{addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})}};
ctx.window.CaddieReview=require('../round-review.js');
vm.createContext(ctx);
for(const f of ['lessons.js','courses-db.js','course-cards.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx);
let src=fs.readFileSync(path.join(root,'app.js'),'utf8');
src=src.slice(0,src.indexOf('// ---------- Boot ----------'))+`
rerender=()=>{};toast=()=>{};load();
window.reviewTest={applyFeed,get:()=>S,roundView,roundDiff,realRounds,bag,bayView,bayCarryVisual,bayConsistencyVisual,bayDeliveryVisual,sessionLibrary,sessionShortcuts,isClearMishit,struckShots,analysisClubs,analysisDelivery,cumulativeView};
})();`;
vm.runInContext(src,ctx);
const T=ctx.window.reviewTest,feed=JSON.parse(fs.readFileSync(path.join(root,'coach-feed.json'),'utf8'));



const fresh=require('../range-20260925-feed.json');
T.applyFeed(feed);T.applyFeed(require('../range-20260922-feed.json'));T.applyFeed(require('../futurefit-feed.json'));
const carries=JSON.stringify(T.get().carries);
T.applyFeed(fresh);T.applyFeed(fresh);
const b=T.get().bays.find(b=>b._fid===fresh.entries[0].id);
assert.equal(T.get().bays.filter(b=>b._fid===fresh.entries[0].id).length,1);
assert.equal(JSON.stringify(T.get().carries),carries);
const a=T.analysisClubs(b.detail);
assert.deepEqual(Array.from(a,c=>c.n),[6,5]);
assert.deepEqual(Array.from(a,c=>c.held),[1,2]);
assert.deepEqual(Array.from(a,c=>c.carry),[185.1,75.2]);
assert.deepEqual(Array.from(a,c=>c.total),[218.9,82.4]);
assert.deepEqual(Array.from(a,c=>c.best),[191.2,75.2]);
assert.deepEqual(Array.from(a,c=>c.metricCounts.apex),[6,5]);
assert.equal(a[1].metricCounts.aoa,1);
assert.equal(T.get().clubs.find(c=>c.name==='Cobra DS-ADAPT X 3-wood').futureFit.current,'B6');
const raw=require('../data/range-2026-09-25.json');
for(const g of raw.clubs)for(const s of g.shots){
 if(s.cs!=null)assert.ok(Math.abs(s.bs/s.cs-s.smash)<.012);
 if(s.face!=null)assert.ok(Math.abs(s.face-s.path-s.ftp)<.16);
}
const html=T.bayView(T.get().bays.indexOf(b));
assert.ok(html.includes('partial')||html.includes('Partial'));
assert.ok(html.includes('75.2'));assert.ok(html.includes('185.1'));
console.log('PASS Sep25 import: 6+5 usable, 3 mishits, 2 dash rows excluded, partial capture, apex, B6, arithmetic and idempotence.');

const bi=T.get().bays.find(b=>b._fid==='bay-20260925-4i-visible-v1');
const ai=T.analysisClubs(bi.detail)[0];
assert.equal(ai.n,10);assert.equal(ai.held,1);assert.equal(ai.carry,147.2);assert.equal(ai.total,181.2);assert.equal(ai.best,159.2);
assert.equal(ai.metricCounts.apex,10);assert.equal(ai.metricCounts.aoa,5);assert.equal(ai.face,null);
const ir=require('../data/range-2026-09-25-4i.json').clubs[0];
assert.ok(Math.abs(ir.shots.reduce((a,s)=>a+s.carry,0)/11-ir.screen.carry)<.1);
for(const s of ir.shots)assert.ok(Math.abs(s.bs/s.cs-s.smash)<.012);
assert.equal(T.get().bays.filter(b=>b.date==='2026-09-25').length,3);
console.log('PASS 4i: 10 retained, exact carry/total/best5, height, missing face and per-metric counts.');

const extra=T.get().bays.find(b=>b._fid==='bay-20260925-late-four-clubs-v1');
const ae=T.analysisClubs(extra.detail);
assert.deepEqual(Array.from(ae,c=>c.n),[5,5,6,4]);
assert.deepEqual(Array.from(ae,c=>c.carry),[154.7,128.7,75.5,214.1]);
assert.equal(T.get().bays.filter(b=>b._fid===extra._fid).length,1);
const rawLate=require('../data/range-2026-09-25-late.json');
assert.equal(rawLate.clubs.reduce((n,c)=>n+c.shots.length,0),32);
const missingLate=rawLate.clubs.flatMap(c=>c.shots).filter(s=>s.carry==null&&s.total==null);
assert.equal(missingLate.length,5);assert.equal(missingLate.filter(s=>s.mishit).length,1);
assert.equal(rawLate.clubs.flatMap(c=>c.shots).filter(s=>s.mishit).length,8);
const B=require('../bay-takeaways.js');
const dayLate=B.prepare('2026-09-25',T.get().bays);
assert.equal(dayLate.usable,41);assert.equal(dayLate.missing,7);assert.equal(dayLate.held,11);
assert.match(B.render(dayLate,B.build(dayLate)),/Distance-missing shots reviewed · 5/);
for(const c of extra.detail.rangeShots){assert.ok(c.shots.every(s=>s.carry!=null||s.total!=null));for(const s of c.shots)assert.equal(B.mishit(s,c.shots),T.isClearMishit(s,c.shots));}
assert.equal(JSON.stringify(T.get().carries),carries);
console.log('PASS additional batch: 32 rows, 20 retained, 5 distance-missing, 7 additional mishits; 41 day shots, no invented distance, idempotence.');
