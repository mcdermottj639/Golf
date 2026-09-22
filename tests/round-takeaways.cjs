const assert=require('node:assert/strict');
const fs=require('node:fs');
const R=require('../round-review.js');
const T=require('../round-takeaways.js');
const haz=require('../data/hazeltine-verified-2026-09-22.json').round;
const spy=require('../data/spyglass-verified-2026-09-22.json').round;
const bally=require('../data/ballybunion-2026-09-15.json').round;
const front=require('../front9-feed.json').entries.find(e=>e.type==='round').round;
const before=JSON.stringify([haz,spy,bally,front]);
const sets=[haz,spy,bally,front].map(r=>R.findings(r));
assert.deepEqual(sets.map(xs=>xs.length),[6,6,5,1]);
assert.equal(new Set(sets.map(xs=>xs.map(x=>x.title).join('|'))).size,4);
const h=sets[0];
assert.deepEqual(h.find(x=>x.id==='approaches').holes,[1,6,9]);
assert.match(h.find(x=>x.id==='scoring').body,/2 birdie-or-better, 6 par and 10 bogey/);
const iron=h.find(x=>x.id==='delivery-7-iron');
assert.match(iron.title,/3\/3/);
assert.equal(iron.visual.rows[2].average,4);
assert.deepEqual(iron.visual.rows.map(x=>x.values.length),[3,3,3]);
assert.match(iron.kind,/selected club/);
assert.ok(iron.visual.rows.every(x=>x.reference==null),'provisional selection must not claim a club baseline comparison');
assert.ok(!h.some(x=>/56-wedge/.test(x.id)),'unknown-intent wedges cannot become full-swing comparisons');
const s=sets[1];
assert.deepEqual(s.find(x=>x.id==='scoring').holes,[16,18]);
assert.match(s.find(x=>x.id==='scoring').body,/85 → 83/);
const carry=s.find(x=>x.id==='carry-3-wood');
assert.equal(carry.visual.values.length,14);
assert.equal(carry.visual.average.toFixed(1),'186.0');
assert.ok(!carry.visual.values.some(x=>x.value===43.8||x.value===89));
assert.ok(s.some(x=>x.id==='smash-3-wood'));
assert.ok(!sets[3].some(x=>x.visual.type==='delivery'),'unknown labels cannot combine unrelated clubs into a swing diagnosis');
assert.deepEqual(R.findings({}),[]);
assert.deepEqual(R.findings({holes:[{n:1,s:5,par:null}]}),[],'missing par is not zero doubles');
assert.deepEqual(R.findings({holes:[{n:1,s:5,par:4},{n:1,s:4,par:4}]}),[],'duplicated hole IDs cannot double count scoring evidence');
const sparse={holes:[{n:1,s:4,par:4},{n:2,s:4,par:4},{n:3,s:4,par:4},{n:4,s:null,par:4}]};
assert.ok(!R.findings(sparse).some(x=>/kept doubles off the card/.test(x.title)));
const outdoor=structuredClone(haz);outdoor.sim=false;delete outdoor.review;
const out=R.render(outdoor,{});
assert.match(out,/Round takeaways/);assert.match(out,/80 → 78/);
assert.doesNotMatch(out,/Face &amp; path/);
// Derived F-P is face minus path, paired samples are independent of missing metrics,
// and zero must never be treated as absent or as crossing both sides.
const shot=(i,fields={})=>({id:'s'+i,hole:i,actualClub:'5-iron',intent:'full',path:-3,face:-1,carry:150,...fields});
const round={sim:true,review:{availableClubs:['5-iron'],shots:[shot(1),shot(2),shot(3),shot(4,{face:null}),shot(5,{intent:'partial',path:99,face:99}),shot(6,{flag:'unreadable',path:88,face:88})]}};
let d=R.findings(round).find(x=>x.id==='delivery-5-iron');
assert.equal(d.visual.rows[0].average,-3);assert.equal(d.visual.rows[2].average,2);
assert.equal(d.visual.rows[0].values.length,3);
const pathOnly=structuredClone(round);pathOnly.review.shots=pathOnly.review.shots.map(s=>({...s,face:null}));
const po=R.findings(pathOnly).find(x=>x.id==='delivery-5-iron');
assert.equal(po.visual.rows.length,1);assert.equal(po.visual.rows[0].key,'path');
assert.equal(po.visual.rows[0].values.length,4);
round.review.shots=[shot(1,{path:0,face:0}),shot(2,{path:0,face:0}),shot(3,{path:0,face:0})];
d=R.findings(round).find(x=>x.id==='delivery-5-iron');
assert.match(d.title,/stayed at zero/);assert.doesNotMatch(d.title,/both sides/);
// A new confirmed source reading changes findings, not a stored narrative.
round.review.shots[2].face=4;
assert.equal(R.findings(round).find(x=>x.id==='delivery-5-iron').visual.rows[2].average,4/3);
// Exact linked bay values appear only for confirmed groups and carry is never total.
round.review.bayClubLinks={'5-iron':{bayId:'bay',club:'5-iron',label:'Sep 20'}};round.date='2026-09-22';
const bays=[{_fid:'bay',date:'2026-09-20',detail:{clubs:[{club:'5-iron',n:5,path:-2,face:0,ftp:2,carry:140,total:999}]}}];
d=R.findings(round,bays).find(x=>x.id==='delivery-5-iron');
assert.equal(d.visual.rows[2].reference,2);
assert.ok(!JSON.stringify(R.findings(round,bays)).includes('999'));
assert.ok(R.findings(round,[{...bays[0],date:'2026-09-23'}]).find(x=>x.id==='delivery-5-iron').visual.rows.every(x=>x.reference==null));
// Every supported performance metric can surface when its own readings are notable.
for(const [key,values] of [['carry',[140,150,165]],['smash',[1.1,1.3,1.5]],['cs',[70,78,85]],['bs',[90,105,120]],['la',[12,17,23]],['spin',[2000,4000,6000]]]){
 const p={club:'5-iron',full:values.map((v,i)=>shot(i+1,{[key]:v})),excluded:[],labelOnly:false};
 assert.ok(T.build({},[p]).some(x=>x.id===key+'-5-iron'),key+' should surface');
}
const rendered=T.render(h);
assert.match(rendered,/data-action="review-hole" data-hole="6"/);
assert.match(rendered,/role="img"/);
assert.doesNotMatch(rendered,/Approach evidence is incomplete|Delivery is not one fixed pattern|Review holes not recorded/);
assert.ok(fs.readFileSync(require('node:path').join(__dirname,'../sw.js'),'utf8').includes('./round-takeaways.js'));
assert.equal(JSON.stringify([haz,spy,bally,front]),before,'calculating and rendering insights must not mutate records');
console.log('PASS round takeaways: four distinct round outputs, outdoor scoring, paired face/path samples, carry/total isolation, exclusions, missing/zero data, live recomputation, six metric types and hole links.');
