// Compare Spyglass against exact recorded range blocks through the real app analysis.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const R=require('../round-review.js');
const dummy={addEventListener(){},querySelectorAll(){return[]},classList:{add(){},remove(){},toggle(){}},style:{},dataset:{}};
const ctx={console,setTimeout(){},clearTimeout(){},setInterval(){},document:{addEventListener(){},querySelector(){return dummy},querySelectorAll(){return[]},getElementById(){return dummy},body:dummy},navigator:{},localStorage:{getItem(){return null},setItem(){}},window:{CaddieReview:R,addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})}};
vm.createContext(ctx);
for(const p of ['lessons.js','courses-db.js','course-cards.js'])vm.runInContext(fs.readFileSync(path.join(root,p),'utf8'),ctx);
let app=fs.readFileSync(path.join(root,'app.js'),'utf8');
app=app.slice(0,app.indexOf('// ---------- Boot ----------'))+'\nrerender=()=>{};toast=()=>{};load();window.T={analysisClubs,roundReviewBays,applyFeed,get:()=>S};})();';
vm.runInContext(app,ctx);
const T=ctx.window.T,fixes=read('corrections-20260922.json');
const first=read('data/range-2026-09-18.json'),after=read('data/range-2026-09-18-after-slot.json'),short=read('data/range-2026-09-15.json');
T.get().bays=[
 {_fid:first.id,date:first.date,detail:{rangeShots:[...first.clubs,...after.clubs]}},
 {_fid:short.id,date:short.date,detail:{rangeShots:short.clubs.map(c=>({...c,shots:c.shots.map(v=>Array.isArray(v)?Object.fromEntries(short.columns.map((k,i)=>[k,v[i]])):v)}))}},
 {_fid:fixes.entries[0].target,...fixes.entries[0].bay}
];
const r=read('data/spyglass-verified-2026-09-22.json').round;
const original=JSON.stringify(r.review.shots);
let bays=T.roundReviewBays();
let ps=R.profiles(r,bays);
assert.deepEqual(ps.map(p=>[p.club,p.bay.carry,p.bay.path,p.bay.n]),[
 ['3-wood',188.4,-2,7],['5-wood',175.3,-2.1,7],['5-iron',147.7,-4.6,15],
 ['7-iron',130.5,-1.9,15],['9-iron',99.2,-5.3,10],['56-wedge',75.5,0.4,9]
]);
assert.equal(JSON.stringify(r.review.shots),original,'review must not mutate shot evidence');
const html=R.render(r,{bays,rounds:[r]});
assert.ok(html.includes('Sep 18 · later block'));
assert.ok(html.includes('188.4') && html.includes('99.2'));
assert.ok(!html.includes('Bay comparison is off'));
const wrong={_fid:'other-range',date:'2026-09-21',detail:{clubs:[{club:'3 wood · after slot',carry:999,path:99}]}};
ps=R.profiles(r,[wrong,...bays.filter(b=>b._fid!==first.id)]);
assert.equal(ps.find(p=>p.club==='3-wood').bay,undefined,'missing explicit source cannot select another session or Mini');
assert.equal(ps.find(p=>p.club==='5-iron').bay.carry,147.7,'other clubs still resolve independently');
const later=structuredClone(bays);later[0].date='2026-09-23';
assert.equal(R.profiles(r,later).find(p=>p.club==='3-wood').bay,undefined,'no later session can enter this dated comparison');
const changed=structuredClone(bays);changed[0].detail.clubs.find(c=>c.club==='3 wood · after slot').carry=190;
assert.equal(R.profiles(r,changed).find(p=>p.club==='3-wood').bay.carry,190,'correction to the linked source flows through without a copied average');
const old=structuredClone(r);delete old.review.bayClubLinks;old.review.noBay=true;
assert.ok(R.profiles(old,bays).every(p=>p.bay===undefined),'legacy noBay behavior remains until an explicit mapping exists');
old.feedId='round-tm-spyglass-20260915-review-v1';
T.get().rounds=[old];
const count=old.review.shots.length;
const patch=fixes.entries.find(e=>e.id==='round-spyglass-club-baselines-20260922-v1');
assert.ok(patch);
T.applyFeed({entries:[patch]});T.applyFeed({entries:[patch]});
assert.equal(T.get().rounds.length,1);
assert.equal(old.review.shots.length,count);
assert.equal(old.trackmanHcpSnapshot,7.4);
assert.equal(old.date,'2026-09-22');
assert.ok(R.profiles(old,bays).every(p=>p.bay),'new entry repairs an already imported round');
console.log('PASS Spyglass six-club baselines: real remaining means, exact source blocks, missing/future safeguards, correction propagation and existing-install replay.');
