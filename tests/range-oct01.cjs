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



// Preserve the original PDF-only regression; supplement coverage follows below.
const completeFeed=require('../range-20261001-feed.json');
const fresh={...completeFeed,entries:completeFeed.entries.slice(0,3)};
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

// Existing installations have already consumed the PDF IDs. New IDs must enrich
// those same shots and add only twelve unique shots. Reapplying must be a no-op.
T.applyFeed(completeFeed);
const after=JSON.stringify(T.get());T.applyFeed(completeFeed);assert.equal(JSON.stringify(T.get()),after);
const updated=T.get().bays.filter(b=>b.date==='2026-10-01');
assert.equal(updated.length,4);
const completeDay=B.prepare('2026-10-01',updated);
assert.equal(completeDay.raw,108);assert.equal(completeDay.usable,92);assert.equal(completeDay.held,16);
const combined=club=>completeDay.clubs.find(c=>c.club===club);
assert.equal(combined('3-wood').shots.length,24);assert.equal(combined('5-wood').shots.length,22);
assert.equal(combined('4-hybrid').shots.length,21);
const pdf2=updated.find(b=>b._fid==='bay-20261001-pdf-block2-v1');
for(const club of ['3-wood','5-wood']){
 const old=fresh.entries[1].bay.detail.rangeShots.find(g=>g.club===club);
 const now=pdf2.detail.rangeShots.find(g=>g.club===club);
 assert.equal(now.shots.length,old.shots.length);
 assert.equal(JSON.stringify(now.excludedShotNumbers),JSON.stringify(old.excludedShotNumbers));
 for(const row of now.shots){
  const original=old.shots.find(s=>s.shot===row.shot);
  for(const key of ['carry','total','height','bs','cs','smash','spin','ftp','mishit','face'])assert.equal(row[key],original[key],club+' '+row.shot+' '+key);
  assert.ok(row.videoSource);assert.ok(row.carrySide);assert.ok(Number.isFinite(row.path));
 }
}
const w3=pdf2.detail.rangeShots.find(g=>g.club==='3-wood');
assert.equal(w3.shots.find(s=>s.shot===7).path,.5); // reordered video first row maps to PDF #7
assert.equal(w3.shots.find(s=>s.shot===6).videoTotal,214.5);
assert.ok(Math.abs(w3.shots.find(s=>s.shot===6).total-216.535433)<.00001);
const w5=pdf2.detail.rangeShots.find(g=>g.club==='5-wood');
assert.deepEqual(Array.from(T.struckShots(w5),s=>s.shot),[2,4,5,6,7]);
assert.equal(w5.shots.find(s=>s.shot===3).smash,null); // original missing sentinel remains null
assert.equal(w5.shots.find(s=>s.shot===3).videoDisplayedValues.smash,1.51);
assert.equal(pdf2.detail.rangeShots.find(g=>g.club==='4-hybrid').shots[0].path,null);
const new3=updated.find(b=>b._fid==='oct01-video-20261001-3w-new-six-v1');
const new5=updated.find(b=>b._fid==='oct01-video-20261001-5w-new-six-v1');
assert.equal(T.analysisClubs(new3.detail)[0].carry,197.2);
assert.equal(T.analysisClubs(new5.detail)[0].carry,192.4);
assert.equal(T.analysisClubs(new3.detail)[0].metricCounts.path,6);
assert.equal(T.analysisClubs(new5.detail)[0].metricCounts.apex,6);
assert.equal(JSON.stringify(T.get().carries),carries);
const html=T.bayView(T.get().bays.indexOf(new5));
assert.ok(html.includes('Spin index %'));assert.ok(html.includes('Smash index %'));assert.ok(html.includes('Ball speed diff mph'));
assert.ok(html.includes('Carry side'));assert.ok(html.includes('Attack°'));assert.ok(html.includes('Path°'));
assert.ok(!html.includes('NaN'));assert.ok(!html.includes('undefined'));
// A fresh client arrives at exactly the same Oct 1 state as an upgraded client.
T.get().bays=T.get().bays.filter(b=>b.date!=='2026-10-01');
const ids=new Set(completeFeed.entries.map(e=>e.id));
T.get().feedApplied=T.get().feedApplied.filter(id=>!ids.has(id));
T.applyFeed(completeFeed);
assert.equal(JSON.stringify(T.get().bays.filter(b=>b.date==='2026-10-01')),JSON.stringify(updated));
console.log('PASS Oct1 video supplement: 15 enriched, 12 new, 108 unique / 92 retained, reordered matching, original totals preserved, per-metric counts, rendered source columns, upgrade/fresh-client parity.');
