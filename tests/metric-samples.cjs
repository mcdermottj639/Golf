// Exercise actual analysis sample counts and cumulative metric weighting in the app VM.
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
window.metricTest={analysisClubs,rollRemaining};
})();`;
vm.runInContext(src,ctx);
const T = ctx.window.metricTest;
const detail = {rangeShots:[
  {club:'5-iron',shots:[{carry:100},{carry:100},{carry:null}]},
  {club:'5-iron',shots:[{carry:200,cs:10},{carry:200,cs:10},{carry:200,cs:10}]}
]};
const samples = T.analysisClubs(detail);
assert.equal(samples.length,2);
assert.deepEqual(JSON.parse(JSON.stringify(samples.map(c=>c.metricCounts.carry))),[2,3]);
assert.deepEqual(JSON.parse(JSON.stringify(samples.map(c=>c.metricCounts.cs))),[0,3]);
const roll = T.rollRemaining(samples);
assert.equal(roll.carry,160,'carry mean weights only the five shots with carry readings');
assert.equal(roll.cs,10,'missing club-speed values contribute neither weight nor zero');
assert.equal(roll.metricCounts.carry,5);
assert.equal(roll.metricCounts.cs,3);
const fallback = T.rollRemaining([{n:2,carry:100},{n:3,carry:200,metricCounts:{carry:0}}]);
assert.equal(fallback.carry,100,'legacy points use n, while explicit zero metric count suppresses fallback');
assert.equal(fallback.metricCounts.carry,2);
console.log('PASS per-metric samples: partial carry and club-speed counts weight cumulative means correctly; legacy fallback retained.');
