// Verify measured-only delivery and shot summaries in the real app's rendered range card.
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const dummy={addEventListener(){},querySelectorAll(){return[]},classList:{add(){},remove(){},toggle(){}},style:{},dataset:{}};
const storage={},ctx={console,setTimeout(){},clearTimeout(){},setInterval(){},document:{addEventListener(){},querySelector(){return dummy},querySelectorAll(){return[]},getElementById(){return dummy},body:dummy},navigator:{},localStorage:{getItem:k=>storage[k]||null,setItem:(k,v)=>storage[k]=v},window:{addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})}};
ctx.window.CaddieReview=require('../round-review.js');vm.createContext(ctx);
for(const f of ['lessons.js','courses-db.js','course-cards.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx);
let src=fs.readFileSync(path.join(root,'app.js'),'utf8');
src=src.slice(0,src.indexOf('// ---------- Boot ----------'))+`\nrerender=()=>{};toast=()=>{};load();window.rangeVisualTest={rangeShotVisuals};})();`;
vm.runInContext(src,ctx);
const shots=[
  {shot:1,path:-2,face:-1,ftp:1,smash:1.30,cs:80,bs:104,la:13},
  {shot:2,path:0,face:1,ftp:1,smash:1.32,cs:82,bs:108},
  {shot:3,path:2,face:2,smash:1.28,spin:5200}
];
const html=ctx.window.rangeVisualTest.rangeShotVisuals({rangeShots:[{club:'Test 7-iron',shots}]});
assert.ok(html.includes('target line as 0°'));
assert.ok(html.includes('Center = face square to path'));
assert.ok(html.includes('closed')&&html.includes('open'),'face-to-path explains negative/positive direction');
assert.ok(html.includes('Smash factor'));
assert.ok(html.includes('Club speed')&&html.includes('n=2'));
assert.ok(html.includes('Ball speed')&&html.includes('n=2'));
assert.ok(html.includes('Launch')&&html.includes('n=1'));
assert.ok(html.includes('Spin')&&html.includes('n=1'));
assert.equal((html.match(/class="range-angle-row"/g)||[]).length,3,'path, face and face-to-path each get their own reference row');
const missing=ctx.window.rangeVisualTest.rangeShotVisuals({rangeShots:[{club:'Unmeasured 8-iron',shots:[{shot:1,path:1}]}]});
assert.ok(!missing.includes('Spin')&&!missing.includes('Launch'),'entirely unmeasured metrics are omitted rather than rendered as zero');
console.log('PASS range visuals: target-relative delivery and per-metric measured sample counts; missing metrics omitted.');
