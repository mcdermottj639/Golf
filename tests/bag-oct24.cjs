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
window.reviewTest={applyFeed,get:()=>S,roundView,roundDiff,realRounds,bag,bayView,bayCarryVisual,bayConsistencyVisual,bayDeliveryVisual,sessionLibrary,sessionShortcuts,isClearMishit,struckShots,analysisClubs,analysisDelivery,cumulativeView,addManualClub,benchClub,startClub,activeBagCount,rosterMembers,clubCanon,bagClubs,orderedCarries,ladderCard,ACTIONS};
})();`;
vm.runInContext(src,ctx);
const T=ctx.window.reviewTest,feed=JSON.parse(fs.readFileSync(path.join(root,'coach-feed.json'),'utf8'));





for(const name of ['coach-feed','front9-feed','path-feed','corrections-20260922','range-20260922-feed','futurefit-feed','range-20260925-feed','bag-20261001-feed','range-20261001-feed','round-20261001-feed','course-prep-feed']) T.applyFeed(require('../'+name+'.json'));
const before=JSON.stringify(T.get());
const old=T.get().clubs.find(c=>c.id==='add-kingtec-2i');
const carry=T.get().carries.find(c=>T.clubCanon(c.club)==='2i');
carry.carry=211;T.get().carriesCalibrated=true;
const four=JSON.stringify(T.get().clubs.find(c=>c.playingClub==='4-hybrid'));
const newFeed=require('../bag-20261024-feed.json');
T.applyFeed(newFeed);
assert.equal(old.status,'backup');
assert.equal(old.savedCarries[0].carry,211);
assert.equal(T.activeBagCount(),14);
assert.ok(!T.get().carries.some(c=>T.clubCanon(c.club)==='2i'));
assert.equal(T.get().carries.find(c=>c.club==='3-hybrid').carry,null);
assert.equal(T.clubCanon('3-hybrid'),'3H');
assert.equal(T.get().clubs.filter(c=>c.playingClub==='3-hybrid').length,1);
assert.equal(JSON.stringify(T.get().clubs.find(c=>c.playingClub==='4-hybrid')),four);
const once=JSON.stringify(T.get());T.applyFeed(newFeed);assert.equal(JSON.stringify(T.get()),once);
const after=T.get(), previous=JSON.parse(before);
for(const key of ['rounds','ranges','bays','sessions']) assert.equal(JSON.stringify(after[key]),JSON.stringify(previous[key]));
assert.match(T.bag(),/PING G440 3H Hybrid/);
console.log('PASS 3H addition, 2i bench with calibrated carry retained, 14 clubs, 4H/history preservation, idempotence and rendering');
