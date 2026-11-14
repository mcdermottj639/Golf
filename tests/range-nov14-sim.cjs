// Execute the real importer/render functions without browser layout; browser suite is separate.
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const dummy={addEventListener(){},querySelectorAll(){return []},classList:{add(){},remove(){},toggle(){}},style:{},dataset:{}};
const storage={};
const ctx={console,setTimeout(){},clearTimeout(){},setInterval(){},document:{addEventListener(){},querySelector(){return dummy},querySelectorAll(){return []},getElementById(){return dummy},body:dummy},navigator:{},localStorage:{getItem:k=>storage[k]||null,setItem:(k,v)=>storage[k]=v},window:{addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})}};
ctx.window.CaddieReview=require('../round-review.js');
ctx.window.CaddieBayTakeaways=require('../bay-takeaways.js');
vm.createContext(ctx);
for(const f of ['lessons.js','courses-db.js','course-cards.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx);
let src=fs.readFileSync(path.join(root,'app.js'),'utf8');
src=src.slice(0,src.indexOf('// ---------- Boot ----------'))+`
rerender=()=>{};toast=()=>{};load();
window.reviewTest={applyFeed,get:()=>S,roundView,roundDiff,realRounds,bag,bayView,bayCarryVisual,bayConsistencyVisual,bayDeliveryVisual,sessionLibrary,sessionShortcuts,isClearMishit,struckShots,analysisClubs,analysisDelivery,cumulativeView,bayDayData,compareClubData,swingEvolutionRows,cumulativeClubSeries,benchClub,startClub,activeBagCount,clubCanon,clubEvidenceKey,clubCanonLabel};
})();`;
vm.runInContext(src,ctx);
const T=ctx.window.reviewTest,read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const source=read('data/range-2026-11-14-sim.json'),feed=read('range-20261114-feed.json'),report=read('data/range-2026-11-14-analysis.json');
const eq=(a,b,msg)=>assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)),msg);
const near=(a,b,tol=.001)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
const files=[...fs.readFileSync(path.join(root,'app.js'),'utf8').match(/Promise\.all\(\[([^\]]+)/)[1].matchAll(/'([^']+)'/g)].map(m=>m[1]);
for(const f of files.filter(f=>f!=='range-20261114-feed.json'))T.applyFeed(read(f));
const before=JSON.parse(JSON.stringify(T.get()));
assert.equal(source.sessionDate,'2026-11-14');assert.equal(source.monitorDisplayedDate,'2026-11-13');
assert.match(source.dateBasis,/Jack explicitly corrected/);
eq(source.sources.map(s=>s.shots.length),[27,8,5,15,10,7]);
const rawShots=source.sources.flatMap(s=>s.shots);assert.equal(rawShots.length,72);
for(const s of rawShots.filter(s=>/iron/.test(s.club)))assert.match(s.club,/KING Forged/);
eq(source.sources[0].shots.slice(0,21).map(s=>s.cuePhase),Array(21).fill('after club first cue'));
assert.ok(source.sources[0].shots.slice(21).every(s=>s.club==='5-wood'));
assert.ok(source.sources[1].shots.every(s=>s.cuePhase==='after club first cue'));
assert.ok(source.sources.slice(3).every(s=>s.shots.every(s=>s.cuePhase==='before club first cue')));
// Visible headers are checksums only. Keep both exceptional Smash Index readouts;
// the index is NOT the ball/club ratio, nor used in the mishit decision.
for(const src of source.sources){
 for(const [k,h] of Object.entries(src.appHeader)){
  const xs=src.shots.map(s=>s[k]).filter(x=>x!=null),mean=xs.reduce((s,x)=>s+x,0)/xs.length;
  if(k==='smashIndex'&&['7i-after-cue','king-forged-7i-before-cue'].includes(src.sourceId))continue;
  near(mean,h,['spin','height','smashIndex'].includes(k)?1:.11);
 }
 for(const s of src.shots){
  if(s.cs!=null)near(s.smash,s.bs/s.cs,.00006);
  if(s.face!=null&&s.path!=null)near(s.face-s.path,s.ftp,.111);
 }
}
const groups=feed.entries.find(e=>e.type==='bay').bay.detail.rangeShots;
eq(groups.map(g=>g.excludedShotNumbers),[[10,15,17],[24,25],[3,4,7],[2,3,4],[7],[1,6],[2,3]]);
assert.equal(groups.reduce((n,g)=>n+g.shots.length,0),72);
assert.equal(groups.flatMap(g=>g.shots).filter(s=>!s.mishit).length,56);
for(const g of groups){
 const raw=source.sources.find(s=>s.file===g.source);
 for(const s of g.shots){
  const original=raw.shots.find(x=>x.shot===s.shot);
  for(const key of ['carry','total','cs','bs','height','path','face','ftp','aoa','la','spin'])assert.equal(s[key],original[key]);
  const shouldHold=s.cs==null||s.height<40||(/wood/.test(g.club)&&s.bs/s.cs<1.40);
  assert.equal(s.mishit,shouldHold,`${g.club} #${s.shot}`);
  if(s.mishit)assert.ok(s.mishitReason);
 }
 const kept=g.shots.filter(s=>!s.mishit);
 assert.equal(g.avg.n,kept.length);assert.equal(g.measuredOffer.n,kept.length);
 for(const key of ['carry','total','cs','bs','smash','la','spin','path','face','ftp','aoa']){
  const xs=kept.map(s=>s[key]).filter(x=>x!=null);near(g.avg[key],xs.reduce((s,x)=>s+x,0)/xs.length);
  assert.equal(g.avg.metricCounts[key],xs.length);
 }
}
assert.equal(groups[0].shots[3].mishit,false,'missing AoA/index does not erase a valid club-speed read');
assert.equal(groups[1].shots.find(s=>s.shot===25).mishit,true,'1.3932 must not round up to 1.40');
assert.equal(groups[3].shots[2].mishit,true,'wood with good smash but low apex still held');
assert.equal(groups[6].shots[3].mishit,false,'imperfect iron with missing AoA/index is retained');
const oldIDs=new Set(before.feedApplied);for(const e of feed.entries)assert.ok(!oldIDs.has(e.id));
assert.equal(new Set(feed.entries.map(e=>e.id)).size,feed.entries.length);
assert.ok(feed.entries.filter(e=>e.type==='carry-update').every(e=>e.target==='5 wood'&&e.club.meas&&!('carry' in e.club)));
assert.ok(!feed.entries.some(e=>e.type==='club-update'&&['c6','bag-kingtec-4i-bench-20261001'].includes(e.target)));
T.applyFeed(feed);
const b=T.get().bays.find(b=>b._fid==='bay-20261114-club-first-v1'),day=T.bayDayData(b);
assert.equal(day.raw,72);assert.equal(day.held,16);assert.equal(day.usable,56);assert.equal(day.clubs.length,6);assert.equal(day.clubCount,4);
const expected=[['4i [KING Forged] · before cue',14,160.0214],['4i [KING Forged] · club first',18,148.6833],['6i [KING Forged] · before cue',8,142.3125],['7i [KING Forged] · before cue',5,122.46],['7i [KING Forged] · club first',5,136.1],['5W',6,192.2833]];
const cmp=T.compareClubData('latest'),evo=T.swingEvolutionRows();
for(const [key,n,carry] of expected){
 const group=day.clubs.find(c=>c.canon===key);assert.equal(group.shots.length,n,key);
 near(group.shots.reduce((s,x)=>s+x.carry,0)/n,carry);
 assert.equal(cmp.get(key).n,n);near(cmp.get(key).v.carry.value,carry);
 assert.ok(evo.get(key).filter(x=>x.date==='2026-11-14').every(x=>!x.summary));
}
assert.ok(!evo.get('7i').some(x=>x.date==='2026-11-14'),'old set cannot enter current 7i history');
assert.ok(!evo.get('4i').some(x=>x.date==='2026-11-14'),'old set cannot enter current 4i history');
assert.ok(!T.cumulativeClubSeries().get('7i').some(x=>x.date==='2026-11-14'));
for(const c of before.carries.filter(c=>!['3-hybrid','5 wood'].includes(c.club)))eq(T.get().carries.find(x=>x.club===c.club),c,'untouched playing carry '+c.club);
for(const id of ['c6','bag-kingtec-4i-bench-20261001'])eq(T.get().clubs.find(c=>c.id===id),before.clubs.find(c=>c.id===id));
assert.equal(T.get().carries.find(c=>c.club==='Mini Driver').carry,201);
assert.equal(T.get().carries.find(c=>c.club==='4-hybrid').carry,178);
const hybrid=T.get().clubs.find(c=>c.id==='bag-ping-g440-3h-20261024');
assert.equal(hybrid.status,'backup');assert.equal(hybrid.savedCarries[0].carry,187);
assert.match(hybrid.note,/RETURN IN PROGRESS/);assert.equal(T.get().carries.some(c=>c.club==='3-hybrid'),false);
assert.equal(T.get().carries.find(c=>c.club==='5 wood').carry,before.carries.find(c=>c.club==='5 wood').carry);
near(T.get().carries.find(c=>c.club==='5 wood').meas.carry,192.3);
eq(T.get().bays.filter(x=>x._fid!==b._fid),before.bays,'past shot records unchanged');
const once=JSON.stringify(T.get());T.applyFeed(feed);assert.equal(JSON.stringify(T.get()),once,'apply once');
const html=T.bayView(T.get().bays.indexOf(b));
for(const text of ['160.0 → 148.7','122.5 → 136.1','56 usable','Old KING Forged','14 clean of 15','18 clean of 21'])assert.ok(html.includes(text),text);
// An existing phone may have benched its 5W with a user-calibrated carry.
T.get().carries.find(c=>c.club==='5 wood').carry=199;
assert.equal(T.benchClub('add-darkspeed-5w-20260812'),true);
T.get().feedApplied=T.get().feedApplied.filter(id=>id!=='bag-start-5w-20261114-v1');
T.applyFeed({entries:[feed.entries.find(e=>e.type==='club-start')]});
assert.equal(T.get().clubs.find(c=>c.id==='add-darkspeed-5w-20260812').status,'gaming');
assert.equal(T.get().carries.find(c=>c.club==='5 wood').carry,199);
assert.ok(T.activeBagCount()<=14);
console.log('PASS Nov14: 72 raw / 56 clean / 16 held, exact rules, corrected date/equipment/cue, separate history/Compare cohorts, preserved KING TEC and playing carries, safe 5W restore, idempotence.');
