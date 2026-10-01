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
window.reviewTest={applyFeed,get:()=>S,roundView,roundDiff,realRounds,bag,bayView,bayCarryVisual,bayConsistencyVisual,bayDeliveryVisual,sessionLibrary,sessionShortcuts,isClearMishit,struckShots,analysisClubs,analysisDelivery,cumulativeView,addManualClub,benchClub,activeBagCount,rosterMembers,clubCanon,bagClubs,orderedCarries,ladderCard,ACTIONS};
})();`;
vm.runInContext(src,ctx);
const T=ctx.window.reviewTest,feed=JSON.parse(fs.readFileSync(path.join(root,'coach-feed.json'),'utf8'));




const oldFeed=feed;
T.applyFeed(oldFeed);T.get().carriesCalibrated=true;
T.get().carries.find(c=>c.club==='5-iron').carry=177;
T.get().clubs.push(
 {id:'manual-duplicate',name:'Cobra DS Adapt Hybrid',cat:'hybrid',status:'backup'},
 {id:'manual-duplicate-label',name:'DS-ADAPT 4H',cat:'other',status:'backup'},
 {id:'keep-wood',name:'Cobra DS-ADAPT X 3-wood',cat:'wood',status:'backup'},
 {id:'keep-other-hybrid',name:'Other Hybrid',cat:'hybrid',status:'backup'});
const bagFeed=require('../bag-20261001-feed.json');
T.applyFeed(feed);T.applyFeed({...bagFeed,entries:bagFeed.entries.slice(0,7)});
assert.equal(T.get().clubs.find(c=>c.id==='bag-ds-adapt-4h-20261001').name,'Cobra DS-ADAPT 4H Hybrid');
T.applyFeed(bagFeed);
assert.ok(!T.get().clubs.some(c=>c.id==='manual-duplicate' || c.id==='manual-duplicate-label'));
assert.ok(T.get().clubs.some(c=>c.id==='keep-wood'));
assert.ok(T.get().clubs.some(c=>c.id==='keep-other-hybrid'));
assert.equal(T.get().clubs.find(c=>c.id==='bag-ds-adapt-4h-20261001').status,'ordered');

assert.equal(T.get().carries.find(c=>c.club==='5-iron').carry,177);
T.applyFeed(require('../range-20260922-feed.json'));T.applyFeed(require('../futurefit-feed.json'));T.applyFeed(require('../range-20260925-feed.json'));
assert.equal(T.activeBagCount(),14);
assert.equal(T.get().clubs.find(c=>c.id==='c6').name,'Cobra KING TEC Irons · 5–PW');
assert.equal(T.get().carries.some(c=>c.club==='4-iron'),false);
assert.equal(T.get().carries.find(c=>c.club==='4-hybrid').carry,null);
assert.equal(T.get().carries.find(c=>c.club==='4-hybrid').loft,'23°');
assert.equal(T.get().clubs.find(c=>c.id==='bag-ds-adapt-4h-20261001').name,'PING G440 4H Hybrid');
assert.equal(T.get().clubs.filter(c=>c.cat==='hybrid' && ['gaming','ordered'].includes(c.status)).length,1);
assert.equal(T.clubCanon('Cobra DS-ADAPT 4H Hybrid'),'4H');
assert.equal(T.clubCanon('4-hybrid'),'4H');
assert.equal(T.bagClubs().find(c=>c.name==='4-hybrid').abbr,'4H');
// Unified equipment/carry view: physical irons, original edit indices, no second ladder.
const unified=T.bag();
assert.equal((unified.match(/class="bag-item"/g)||[]).length,14);
assert.ok(!unified.includes('id="bag-ladder"'));
assert.equal((unified.match(/data-carry="/g)||[]).length,13);
assert.match(unified,/data-member="5-iron"/);
assert.match(unified,/data-member="PW"/);
assert.ok(!unified.includes('data-member="4-iron"'));
assert.match(unified,/3W adjustment chart/);
const scan=unified.slice(unified.indexOf('class="bag-scan"'),unified.indexOf('id="bag-grinds"'));
const carryIndices=Array.from(scan.matchAll(/data-carry="(\d+)"/g),m=>+m[1]);
const scanCarries=carryIndices.map(i=>T.get().carries[i].carry).filter(v=>v!=null);
assert.deepEqual(scanCarries,[...scanCarries].sort((a,b)=>b-a));
assert.equal(new Set(carryIndices).size,13);
assert.match(scan,/class="bag-key">Putter/);
assert.ok(scan.indexOf('class="bag-key">4H') < scan.indexOf('class="bag-key">Putter'));
console.log('PASS unified 14-club rows, per-iron controls, sorted original carry indices and adjustment chart retained.');
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

T.get().carries=[{club:'58° wedge',carry:75},{club:'4-hybrid',carry:200,meas:{carry:202}},{club:'Driver',carry:240},{club:'Unknown',carry:null},{club:'5 wood',carry:200}];
const original=JSON.stringify(T.get().carries);
assert.deepEqual(Array.from(T.orderedCarries(),c=>c.club),['Driver','4-hybrid','5 wood','58° wedge','Unknown']);
assert.equal(JSON.stringify(T.get().carries),original);
let ladder=T.ladderCard();
const labels=Array.from(ladder.matchAll(/class="lc">([^<]+)/g),m=>m[1]);
assert.deepEqual(labels,['Dr','4H','5W','58°','Unknow']);
assert.deepEqual(Array.from(ladder.matchAll(/data-carry="(\d+)"/g),m=>Number(m[1])),[2,1,4,0,3]);
assert.match(ladder,/data-action="use-bay-carry" data-i="1"/);
assert.ok(!ladder.includes('−125') && !ladder.includes('>-125<'));
ctx.document.querySelectorAll=()=>[{dataset:{carry:'2'},value:'230'},{dataset:{carry:'1'},value:'180'},{dataset:{carry:'4'},value:'210'},{dataset:{carry:'0'},value:'75'},{dataset:{carry:'3'},value:''}];
T.ACTIONS['save-carries']();
assert.equal(T.get().carries[1].carry,180);assert.equal(T.get().carries[4].carry,210);
assert.deepEqual(Array.from(T.orderedCarries(),c=>c.club),['Driver','5 wood','4-hybrid','58° wedge','Unknown']);
T.ACTIONS['use-bay-carry']({dataset:{i:'1'}});assert.equal(T.get().carries[1].carry,202);
assert.equal(T.get().carries[4].carry,210);
console.log('PASS carry descending display, stable ties, unknowns last, correct edit/offer indices and gaps.');

const memberCount=T.rosterMembers(T.get().clubs.find(c=>c.id==='c6')).length;
T.ACTIONS['bench-club']({dataset:{id:'c6',member:'6-iron'}});
assert.equal(T.rosterMembers(T.get().clubs.find(c=>c.id==='c6')).length,memberCount-1);
assert.ok(T.rosterMembers(T.get().clubs.find(c=>c.id==='c6')).includes('7-iron'));
console.log('PASS compact row removes only the selected iron.');
