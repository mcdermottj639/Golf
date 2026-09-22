const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const dummy = { addEventListener(){}, querySelectorAll(){return []}, classList:{add(){},remove(){},toggle(){}}, style:{}, dataset:{} };
const ctx = { console, setTimeout(){}, clearTimeout(){}, setInterval(){}, document:{addEventListener(){},querySelector(){return dummy},querySelectorAll(){return []},getElementById(){return dummy},body:dummy}, navigator:{}, localStorage:{getItem(){return null},setItem(){}}, window:{addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})} };
ctx.window.CaddieReview = require('../round-review.js');
vm.createContext(ctx);
for(const file of ['lessons.js','courses-db.js','course-cards.js']) vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx);
let src = fs.readFileSync(path.join(root,'app.js'),'utf8');
src = src.slice(0,src.indexOf('// ---------- Boot ----------')) + '\nrerender=()=>{};toast=()=>{};load();window.apexTest={analysisClubs,bayClubTable,rangeShotTables};})();';
vm.runInContext(src,ctx);
const {analysisClubs,bayClubTable,rangeShotTables} = ctx.window.apexTest;
const detail = {rangeShots:[
  {club:'5-iron',shots:[{shot:1,carry:170,height:"70'6\""},{shot:2,carry:175,height:"71'6\""},{shot:3,carry:168,height:null}]},
  {club:'5-wood',shots:[{shot:1,carry:180},{shot:2,carry:185}]}
]};
const clubs = analysisClubs(detail);
assert.equal(clubs[0].apex,71);
assert.equal(clubs[0].metricCounts.apex,2);
assert.equal(clubs[1].apex,null);
const table = bayClubTable(clubs);
assert.match(table,/APEX FT/);
assert.match(table,/71\.0 <small>n=2<\/small>/);
assert.match(rangeShotTables(detail),/70&#39;6&quot;|70'6&quot;/);
console.log('PASS: measured apex appears in exact club data with coverage; unmeasured apex stays blank.');
