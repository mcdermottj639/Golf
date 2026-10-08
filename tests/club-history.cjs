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
rerender=()=>{};toast=()=>{};load();render=(view,arg)=>{current={view,arg}};
window.reviewTest={applyFeed,get:()=>S,roundView,roundDiff,realRounds,bag,bayView,bayCarryVisual,bayConsistencyVisual,bayDeliveryVisual,sessionLibrary,sessionShortcuts,isClearMishit,struckShots,analysisClubs,analysisDelivery,cumulativeView,addManualClub,benchClub,startClub,activeBagCount,rosterMembers,clubCanon,bagClubs,orderedCarries,ladderCard,clubHistoryView,swingEvolutionRows,ACTIONS,route:()=>current};
})();`;
vm.runInContext(src,ctx);
const T=ctx.window.reviewTest;
for(const file of ['coach-feed.json','range-20260922-feed.json','futurefit-feed.json','range-20260925-feed.json','bag-20261001-feed.json']) T.applyFeed(JSON.parse(fs.readFileSync(path.join(root,file),'utf8')));
const before=JSON.stringify(T.get());
const rows=T.swingEvolutionRows();
for(const club of ['5W','7i','4H','7i']){
  const bag=T.bag();
  assert.equal((bag.match(new RegExp('data-action="club-history" data-club="'+club+'" data-from="bag"','g'))||[]).length,1);
  T.ACTIONS['club-history']({dataset:{club,from:'bag'}});
  assert.equal(T.route().view,'clubhistory');
  assert.equal(T.route().arg.club,club);
  const history=T.clubHistoryView(T.route().arg);
  assert.match(history,/data-action="club-history-back" data-from="bag">← My Bag/);
  assert.ok(history.includes('Full club history'));
  if(club==='4H') assert.match(history,/No readings yet/);
  else assert.ok((rows.get(club)||[]).length>0);
  T.ACTIONS['club-history-back']({dataset:{from:'bag'}});
  assert.equal(T.route().view,'bag');
  assert.equal(JSON.stringify(T.get()),before);
}
T.ACTIONS['club-history']({dataset:{club:'5W'}});
assert.match(T.clubHistoryView(T.route().arg),/data-from="cumulative">← Bag at a glance/);
T.ACTIONS['club-history-back']({dataset:{from:'cumulative'}});
assert.equal(T.route().view,'sessions');assert.equal(T.route().arg,'cumulative');
assert.match(T.clubHistoryView('5W'),/data-from="cumulative">← Bag at a glance/,'legacy string route remains supported');
assert.equal(JSON.stringify(T.get()),before);
// An active iron still has history even if its carry row is absent.
T.get().carries=T.get().carries.filter(r=>T.clubCanon(r.club)!=='7i');
assert.match(T.bag(),/data-action="club-history" data-club="7i" data-from="bag"/);
console.log('PASS club history: canonical clubs, unmeasured hybrid, iron without carry, repeated origin-aware navigation, legacy route and complete player-state preservation.');
