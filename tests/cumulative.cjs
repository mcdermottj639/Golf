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


feed.entries.push(...require('../range-20260922-feed.json').entries);
const id='bay-20260922-range-184605-batch1';
const sources=[require('../data/range-2026-09-22-184605.json'),require('../data/range-2026-09-22-185003.json')];
const groups=sources.flatMap(x=>x.clubs), entry=feed.entries.find(e=>e.id===id);
assert.equal(groups.reduce((n,g)=>n+g.shots.length,0),80);
assert.equal(feed.entries.filter(e=>e.id===id).length,1);
const liveGroups=entry.bay.detail.rangeShots;
for(let i=0;i<groups.length;i++) assert.deepEqual(liveGroups[i].shots,groups[i].shots.filter(s=>s.carry!=null||s.total!=null));
assert.equal(liveGroups.reduce((n,g)=>n+g.shots.length,0),68);
T.applyFeed({...feed,entries:feed.entries.filter(e=>e.id!==id)});
const carries=JSON.stringify(T.get().carries),outdoor=JSON.stringify(T.realRounds());
T.applyFeed(feed);T.applyFeed(feed);
assert.equal(T.get().bays.filter(b=>b._fid===id).length,1);
assert.equal(JSON.stringify(T.get().carries),carries);
assert.equal(JSON.stringify(T.realRounds()),outdoor);
const b=T.get().bays.find(b=>b._fid===id),a=T.analysisClubs(b.detail);
assert.deepEqual(Array.from(a,x=>x.n),[6,14,14,7,7,15]);
assert.deepEqual(Array.from(a,x=>x.held),[0,0,0,0,1,4]);
assert.deepEqual(Array.from(a,x=>x.carry),[83.6,133.5,149.1,177.7,174.7,153.9]);
assert.deepEqual(Array.from(a,x=>x.total),[92.1,160.8,179.1,223.2,207.2,187.4]);
assert.deepEqual(Array.from(a,x=>x.best),[85.5,149.5,165.4,182.8,188.3,168.2]);
assert.deepEqual(Array.from(a,x=>x.path),[1.7,2.6,-3,-2.5,-3,-2.1]);
assert.equal(a[1].metricCounts.path,14);
assert.equal(a[2].metricCounts.cs,13);
assert.equal(a[5].metricCounts.path,14);
assert.equal(a[5].metricCounts.carry,15);
for(let i=0;i<groups.length;i++){
 const g=groups[i];
 const avg=k=>{const v=g.shots.map(s=>s[k]).filter(x=>x!=null);return v.reduce((a,b)=>a+b,0)/v.length};
 for(const k of ['carry','total','cs','dynLoft'])assert.ok(Math.abs(avg(k)-g.screen[k])<0.11,`${g.club} ${k}`);
 for(const s of g.shots){
   if(s.face!=null&&s.path!=null&&s.ftp!=null)assert.ok(Math.abs(s.face-s.path-s.ftp)<0.16,`${g.club} shot ${s.shot} face/path`);
   if(s.cs!=null&&s.bs!=null)assert.ok(Math.abs(s.bs/s.cs-s.smash)<0.012,`${g.club} shot ${s.shot} smash`);
 }
}
const html=T.bayView(T.get().bays.indexOf(b));
for(const phrase of ['CONTROL THE CURVE','PRACTICE THE LANDING DISTANCE','target 165','target 170','149.5','Smash factor','63 usable'])assert.ok(html.includes(phrase),phrase);
assert.ok(html.includes('carry hits <b>2/6</b> · total hits <b>6/6</b>'));
assert.ok(html.includes('carry hits <b>2/7</b> · total hits <b>0/7</b>'));
assert.ok(html.includes('5i target 165: 14') && html.includes('5i target 170: 15'));
console.log('PASS: 80 source shots, 12 dash rows excluded entirely, 5 clear mishits, 63 usable, source arithmetic, per-metric counts and existing-phone idempotence.');

const before=JSON.stringify(T.get());
const cumulative=T.cumulativeView();
for(const phrase of ['cum-plan','Your bag at a glance','Recent carry readings','On course','Explore the whole record']) {
 assert.ok(cumulative.includes(phrase),phrase);
}
assert.ok(!cumulative.includes('n is the accuracy'));
assert.equal(JSON.stringify(T.get()),before,'cumulative render must not change source records');
assert.ok(!cumulative.includes('NaN'));
const savedBays=T.get().bays;
T.get().bays=[];
assert.ok(T.cumulativeView().includes('No reviewed range clubs yet'));
T.get().bays=savedBays;
console.log('PASS cumulative populated/empty rendering, evidence sections and read-only state.');
