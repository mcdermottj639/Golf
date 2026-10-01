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
window.reviewTest={applyFeed,get:()=>S,roundView,roundDiff,realRounds,bag,bayView,bayCarryVisual,bayConsistencyVisual,bayDeliveryVisual,sessionLibrary,sessionShortcuts,isClearMishit,struckShots,analysisClubs,analysisDelivery,cumulativeView,addManualClub,benchClub,activeBagCount,rosterMembers,clubCanon,bagClubs};
})();`;
vm.runInContext(src,ctx);
const T=ctx.window.reviewTest,feed=JSON.parse(fs.readFileSync(path.join(root,'coach-feed.json'),'utf8'));




const oldFeed=feed;
T.applyFeed(oldFeed);T.get().carriesCalibrated=true;
T.get().carries.find(c=>c.club==='5-iron').carry=177;
T.applyFeed(feed);T.applyFeed(require('../bag-20261001-feed.json'));
assert.equal(T.get().carries.find(c=>c.club==='5-iron').carry,177);
T.applyFeed(require('../range-20260922-feed.json'));T.applyFeed(require('../futurefit-feed.json'));T.applyFeed(require('../range-20260925-feed.json'));
assert.equal(T.activeBagCount(),14);
assert.equal(T.get().clubs.find(c=>c.id==='c6').name,'Cobra KING TEC Irons · 5–PW');
assert.equal(T.get().carries.some(c=>c.club==='4-iron'),false);
assert.equal(T.get().carries.find(c=>c.club==='4-hybrid').carry,null);
assert.equal(T.clubCanon('Cobra DS-ADAPT 4H Hybrid'),'4H');
assert.equal(T.clubCanon('4-hybrid'),'4H');
assert.equal(T.bagClubs().find(c=>c.name==='4-hybrid').abbr,'4H');
const baseline=JSON.stringify(T.get());T.applyFeed(feed);T.applyFeed(require('../bag-20261001-feed.json'));assert.equal(JSON.stringify(T.get()),baseline);
const history=JSON.stringify(T.get().bays);
let before=JSON.stringify(T.get());
assert.match(T.addManualClub({id:'extra',name:'Test 7-wood',cat:'wood',status:'gaming'},''),/14 clubs maximum/);
assert.equal(JSON.stringify(T.get()),before);
assert.equal(T.addManualClub({id:'extra',name:'Test 7-wood',cat:'wood',status:'gaming'},'','bag-ds-adapt-4h-20261001'),null);
assert.equal(T.activeBagCount(),14);
assert.equal(T.get().carries.some(c=>c.club==='4-hybrid'),false);
assert.equal(T.get().carries.find(c=>c.club==='7 wood').carry,null);
assert.equal(T.get().clubs.find(c=>c.id==='bag-ds-adapt-4h-20261001').status,'backup');
assert.equal(T.benchClub('c6','5-iron'),true);assert.equal(T.activeBagCount(),13);
assert.equal(T.get().carries.some(c=>c.club==='5-iron'),false);
assert.equal(T.rosterMembers(T.get().clubs.find(c=>c.id==='c6')).length,5);
assert.equal(T.addManualClub({id:'newhybrid',name:'Cobra DS-ADAPT Hybrid',spec:'4H Regular',cat:'hybrid',status:'gaming'}),null);
assert.equal(T.get().carries.find(c=>c.club==='4-hybrid').carry,null);assert.equal(T.activeBagCount(),14);
assert.equal(T.addManualClub({id:'bench',name:'Bench driver',cat:'wood',status:'backup'}),null);assert.equal(T.activeBagCount(),14);
assert.equal(T.addManualClub({id:'ball',name:'Ball',cat:'ball',status:'gaming'}),null);assert.equal(T.activeBagCount(),14);
assert.equal(JSON.stringify(T.get().bays),history);
assert.match(T.bag(),/14\/14 CLUBS/);
console.log('PASS bag migration, hybrid identity, 14-club limit, atomic replacement, individual iron removal, bench/accessories and preserved history.');
