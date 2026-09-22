// Regression coverage for simulator/outdoor round identity and authoritative feed targets.
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const dummy = { addEventListener(){}, querySelectorAll(){ return []; }, classList:{add(){},remove(){},toggle(){}}, style:{}, dataset:{} };
const storage = {};
const ctx = { console, setTimeout(){}, clearTimeout(){}, setInterval(){}, document:{
  addEventListener(){}, querySelector(){ return dummy; }, querySelectorAll(){ return []; },
  getElementById(){ return dummy; }, body:dummy
}, navigator:{}, localStorage:{getItem:k=>storage[k]||null,setItem:(k,v)=>storage[k]=v}, window:{
  addEventListener(){}, matchMedia:()=>({matches:false,addEventListener(){}})
} };
ctx.window.CaddieReview = require('../round-review.js');
vm.createContext(ctx);
for (const file of ['lessons.js','courses-db.js','course-cards.js'])
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx);
let src = fs.readFileSync(path.join(root,'app.js'),'utf8');
src = src.slice(0,src.indexOf('// ---------- Boot ----------')) + `
rerender=()=>{};toast=()=>{};load();
window.identityTest={applyFeed,get:()=>S};
})();`;
vm.runInContext(src,ctx);
const T = ctx.window.identityTest;
const date = '2026-09-21';
const course = 'Identity Test Course';
const userRound = { date, course, sim:false, score:91, note:'Jack local card', holes:[], live:true };
T.get().rounds.push(userRound);
const entries = [
  { id:'identity-sim-round', type:'round', round:{date,course,sim:true,score:82,holes:[],review:{finding:'initial'}} },
  { id:'identity-outdoor-round', type:'round', round:{date,course,sim:false,score:88,holes:[]} },
  { id:'identity-sim-correction', type:'round-update', target:'identity-sim-round', round:{date,course,sim:true,score:80,force:true} },
  { id:'identity-sim-review', type:'round-review-update', target:'identity-sim-round', round:{date,course,sim:true}, review:{finding:'targeted review'} },
  { id:'identity-unknown-target', type:'round-update', target:'missing-feed-id', round:{date,course,sim:false,score:1,force:true} },
  { id:'identity-unknown-review', type:'round-review-update', target:'missing-feed-id', round:{date,course,sim:true}, review:{finding:'must not land'} },
];
const feed = {entries};
T.applyFeed(feed);
T.applyFeed(feed);
const matches = T.get().rounds.filter(r=>r.date===date && r.course===course);
assert.equal(matches.length,2,'simulator feed round and the pre-existing outdoor user round both survive');
const sim = matches.find(r=>r.sim);
assert.ok(sim);
assert.equal(sim.feedId,'identity-sim-round');
assert.equal(sim.score,80);
assert.equal(sim.review.finding,'targeted review');
assert.equal(matches.find(r=>!r.sim),userRound);
assert.equal(userRound.score,91);
assert.equal(userRound.note,'Jack local card');
assert.equal(T.get().rounds.filter(r=>r.feedId==='identity-sim-round').length,1,'repeat import is idempotent');
console.log('PASS round identity: simulator/outdoor coexistence, targeted corrections, local preservation, unknown targets, idempotence.');
