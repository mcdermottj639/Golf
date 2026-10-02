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



const fresh=require('../range-20261001-feed.json');
T.applyFeed(feed);T.applyFeed(require('../range-20260922-feed.json'));T.applyFeed(require('../futurefit-feed.json'));T.applyFeed(require('../range-20260925-feed.json'));T.applyFeed(require('../bag-20261001-feed.json'));
const carries=JSON.stringify(T.get().carries);
T.applyFeed(fresh);T.applyFeed(fresh);
const bays=T.get().bays.filter(b=>b.date==='2026-10-01');
assert.equal(bays.length,2);
assert.deepEqual(Array.from(T.analysisClubs(bays.find(b=>b._fid===fresh.entries[0].id).detail),c=>c.n),[7,10,10,15,11]);
const groups=fresh.entries.filter(e=>e.type==='bay').flatMap(e=>e.bay.detail.rangeShots);
assert.equal(groups.reduce((n,g)=>n+g.shots.length,0),96);
assert.equal(groups.reduce((n,g)=>n+T.struckShots(g).length,0),80);
assert.equal(groups.reduce((n,g)=>n+g.excludedShotNumbers.length,0),16);
const hybrid=T.analysisClubs(bays.find(b=>b._fid===fresh.entries[0].id).detail).find(c=>c.club==='4-hybrid');
assert.equal(hybrid.carry,179.5);assert.equal(hybrid.smash,1.46);assert.equal(hybrid.metricCounts.smash,13);assert.equal(hybrid.metricCounts.apex,15);assert.equal(hybrid.path,null);assert.equal(hybrid.face,null);
for(const g of groups){
 assert.deepEqual(Array.from(T.struckShots(g),s=>s.shot),g.shots.filter(s=>!s.mishit).map(s=>s.shot));
 for(const s of g.shots){
  assert.ok(Math.abs(s.carry-Number(s.sourceValues.carry)/.9144)<.000001);
  assert.ok(Math.abs(s.height-Number(s.sourceValues.height)/.3048)<.000001);
  assert.ok(Math.abs(s.bs-Number(s.sourceValues.bs)/.44704)<.000001);
  assert.equal(s.path,null);assert.equal(s.face,null);assert.equal(s.aoa,null);
  if(s.smash!=null)assert.ok(Math.abs(s.bs/s.cs-s.smash)<.025);
  if(s.sourceValues.smash==='-1.00')assert.equal(s.smash,null);
 }
}
const B=require('../bay-takeaways.js');const day=B.prepare('2026-10-01',bays);
assert.equal(day.usable,80);assert.equal(day.held,16);assert.equal(day.clubs.length,6);
assert.equal(JSON.stringify(T.get().carries),carries);
assert.ok(T.bayView(T.get().bays.indexOf(bays[0])).includes('Oct 1'));
assert.ok(fs.readFileSync(path.join(root,'app.js'),'utf8').includes("'range-20261001-feed.json'].map"));
assert.ok(fs.readFileSync(path.join(root,'sw.js'),'utf8').includes("'./range-20261001-feed.json'"));
console.log('PASS Oct1: 96 source rows, 80 retained, metric conversion, source exclusions, sentinel handling, per-metric counts, day aggregation, idempotence, outdoor carries preserved.');
