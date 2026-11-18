#!/usr/bin/env node
'use strict';
// Practice Lab (v295): calculation invariants for the Nov 17 Lower Hands Experiment.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const PL=require(path.join(root,'practice-lab.js')),c=PL.calc;
const file='data/practice-lab/lower-hands-2026-11-17.json';
const exp=JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const near=(a,b,eps=1e-9,msg)=>assert.ok(Math.abs(a-b)<=eps,(msg||'')+` ${a} vs ${b}`);
const stat=(club,batch,I={})=>c.clubStats(exp,club,I).find(s=>s.batch===batch);

// Source integrity: 110 swings, every group's carry re-averages to the app's own Avg row.
assert.equal(exp.groups.reduce((a,g)=>a+g.attempts,0),110);
for(const g of exp.groups){
  assert.equal(g.attempts,g.shots.length,g.batch+' '+g.club);
  g.shots.forEach((s,i)=>assert.equal(s.n,i+1));
  if(g.appCarryAvg!=null){
    const m=g.shots.reduce((a,s)=>a+s.carry,0)/g.shots.length;
    assert.ok(Math.abs(m-g.appCarryAvg)<=0.051,`${g.batch} ${g.club} carry ${m} vs app ${g.appCarryAvg}`);
  }
}
assert.ok(PL.files.includes(file));

// Club lines (Jack, Nov 17): woods/hybrids 1.40, 4–6i 1.22, 7–9i 1.18, PW/wedges 1.10.
assert.equal(c.lineFor('5W').line,1.40);assert.equal(c.lineFor('Mini').line,1.40);assert.equal(c.lineFor('4H').line,1.40);
assert.equal(c.lineFor('5i').line,1.22);assert.equal(c.lineFor('6i').line,1.22);
assert.equal(c.lineFor('7i').line,1.18);assert.equal(c.lineFor('9i').line,1.18);
assert.equal(c.lineFor('PW').line,1.10);assert.equal(c.lineFor('56°').line,1.10);

// Clean counts and clean-rate denominators (all attempts, not clean shots).
const expect={Mini:{B1:[3,5,199.4],B3:[4,6,196.0]},'5W':{B1:[7,17,188.5],B3:[3,5,198.5]},'4H':{B1:[12,21,177.0],B3:[2,4,177.1]},
  '5i':{B1:[4,6,145.6],B3:[3,4,158.6]},'6i':{B1:[4,10,139.5],B2:[5,5,156.7],B3:[7,7,150.4]},'7i':{B3:[7,8,136.3]},'9i':{B3:[2,5,116.0]},PW:{B1:[3,4,110.9]}};
for(const [club,bs] of Object.entries(expect))for(const [b,[clean,att,carry]] of Object.entries(bs)){
  const s=stat(club,b);
  assert.equal(s.status,'graded');assert.equal(s.clean,clean,club+b);assert.equal(s.attempts,att,club+b);
  near(s.cleanRate,clean/att,1e-12,club+b+' rate');
  assert.equal(c.fmt('carry',s.mean.carry),carry.toFixed(1),club+' '+b+' carry');
}
// Held reasons are explicit and the held rows stay in the record.
const b1six=stat('6i','B1');
assert.deepEqual(b1six.shots.filter(s=>!s.clean).map(s=>s.n),[4,5,6,7,8,9]);
assert.ok(b1six.shots[4].held.some(r=>/^smash 1\.19/.test(r)));
assert.ok(b1six.shots[3].held.includes('no club speed')&&b1six.shots[3].held.includes('apex 28 ft'));
// Jack's override: PW B1 shot 2 kept despite no club speed; its smash is null, never zero.
const pw=stat('PW','B1');
assert.equal(pw.shots[1].clean,true);assert.equal(pw.shots[1].smash,null);assert.equal(pw.shots[0].clean,false);
assert.equal(pw.n.smash,2,'missing club speed stays missing in smash n');
// 4H B3 shot 1: no club data at all → held; path n excludes missing values, not zero-filled.
const h3=stat('4H','B3');assert.equal(h3.shots[0].clean,false);assert.equal(h3.n.path,2);
// Unrounded smash: 5W B1 shot 1 = 123.1/88.6 = 1.3894 → held under 1.40 even though it shows 1.39.
assert.ok(stat('5W','B1').shots[0].held.some(r=>r.startsWith('smash 1.39')));

// Deltas between batches and their tones.
const d6=c.delta(stat('6i','B1'),stat('6i','B3'),'carry');
near(d6.d,1052.7/7-557.8/4,1e-9,'6i B3-B1');assert.equal(c.fmtD('carry',d6.d),'+10.9 yd');
assert.equal(c.tone('carry',d6),'better');
const p5=c.delta(stat('5i','B1'),stat('5i','B3'),'path');
assert.equal(c.fmt('path',p5.from),'−7.5°');assert.equal(c.fmt('path',p5.to),'−9.7°');assert.equal(c.tone('path',p5),'worse');
const f5w=c.delta(stat('5W','B1'),stat('5W','B3'),'f2p');
assert.equal(c.fmt('f2p',f5w.from),'+3.8°');assert.equal(c.fmt('f2p',f5w.to),'−2.1°');
assert.equal(c.tone('f2p',f5w),'mixed','fade→draw crossing zero is unresolved, not better');
assert.equal(c.tone('carry',c.delta(stat('4H','B1'),stat('4H','B3'),'carry')),'mixed','+0.1 yd is not an improvement');
assert.equal(c.tone('carry',null),'unmeasured');

// Weighted mean of B2+B3 (mutually exclusive cohorts): (5×156.66 + 7×150.36)/12 = 153.0.
const w=c.weightedMean(['B2','B3'].map(b=>{const s=stat('6i',b);return {mean:s.mean.carry,n:s.n.carry};}));
assert.equal(w.n,12);near(w.mean,(5*stat('6i','B2').mean.carry+7*stat('6i','B3').mean.carry)/12,1e-12);
assert.equal(c.fmtD('carry',w.mean-stat('6i','B1').mean.carry),'+13.6 yd');
assert.equal(c.weightedMean([{mean:null,n:3},{mean:10,n:0}]),null);
// An unweighted average of averages would be wrong here; make sure it differs.
assert.notEqual(c.fmt('carry',w.mean),c.fmt('carry',(stat('6i','B2').mean.carry+stat('6i','B3').mean.carry)/2));

// Missing baseline / missing latest batch: no comparison, never a zero.
const cmp7=c.compare(exp,'7i',{});assert.equal(cmp7.base,null);assert.equal(cmp7.last,null);
const cmpPW=c.compare(exp,'PW',{});assert.ok(cmpPW.base);assert.equal(cmpPW.last,null);
assert.equal(c.delta(cmpPW.base,null,'carry'),null);
const fnd=c.findings(exp,{});
for(const club of ['7i','9i','PW','56°'])assert.ok(fnd.uncompared.includes(club),club+' has no before/after');
assert.ok(fnd.worse.some(x=>x.club==='5i'&&x.key==='path'));
assert.ok(fnd.better.some(x=>x.club==='6i'&&x.key==='cleanRate'));
assert.ok(fnd.mixed.some(x=>x.club==='5W'&&x.key==='f2p'));

// 56°: Jack said FULL (data file wedgeIntent) → graded against 1.10, 0/3 clean, no carry.
const w56=stat('56°','B3');
assert.equal(w56.status,'graded');assert.equal(w56.clean,0);assert.equal(w56.attempts,3);assert.equal(w56.cleanRate,0);assert.equal(w56.mean.carry,null);
assert.ok(w56.shots.every(s=>s.held.some(r=>r.startsWith('smash 0.9')||r.startsWith('smash 1.0'))));
assert.equal(exp.wedgeIntent['56°'],'full');
// A tap in the app wins over the file, including an explicit unknown; partial swings are not graded.
for(const v of ['half','unknown']){const s=stat('56°','B3',{'lower-hands-2026-11-17:56°':v});assert.equal(s.status,'unclassified',v);assert.equal(s.clean,null);assert.equal(s.mean.carry,null);}
// The unclassified path still holds for a wedge with no stated intent.
const noIntent=Object.assign({},exp,{wedgeIntent:{}});
assert.equal(c.clubStats(noIntent,'56°',{})[0].status,'unclassified');

// Gapping: flagged pairs need a retest; they are not bag edits.
const gp=c.gapping(exp,{});
const pair=(a,b)=>gp.find(p=>p.longer===a&&p.shorter===b);
assert.ok(pair('Mini','5W').flag);near(pair('Mini','5W').minGap,784.1/4-595.6/3,1e-9);
assert.ok(pair('5i','6i').flag);near(pair('5i','6i').minGap,stat('5i','B3').mean.carry-stat('6i','B2').mean.carry,1e-9);assert.equal(c.fmt('carry',pair('5i','6i').minGap),'2.0');
assert.ok(!pair('5W','4H').flag);

// Evidence labels are qualitative; nothing claims "validated".
assert.equal(c.evidence(c.clubStats(exp,'6i',{})),'Single session · small clean sample');
assert.ok(!/validated|significant|confidence interval/i.test(JSON.stringify(exp)));

// The module never writes playing carries, the bag, bays or rounds: only S.practiceLab.
const src=fs.readFileSync(path.join(root,'practice-lab.js'),'utf8');
assert.ok(!/\.carries\s*(=|\.push|\.splice)|S\.clubs|S\.bays|S\.rounds|carry-update/.test(src),'practice-lab.js must not touch bag/carry/bay/round state');
for(const m of src.matchAll(/S2?\.(\w+)\s*=/g))assert.equal(m[1],'practiceLab','unexpected state write: '+m[0]);

// Release wiring: shell, offline cache and live parity carry the new files.
const app=fs.readFileSync(path.join(root,'app.js'),'utf8'),sw=fs.readFileSync(path.join(root,'sw.js'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const build=app.match(/const BUILD = '(v\d+)'/)[1];
assert.ok(sw.includes(`caddiehq-${build}`));
for(const f of ['practice-lab.js','practice-lab.css',file])assert.ok(sw.includes('./'+f),'sw caches '+f);
assert.ok(html.indexOf('practice-lab.js')<html.indexOf('app.js'));
assert.ok(html.includes('practice-lab.css'));
console.log('practice-lab: OK —',exp.groups.length,'groups,',exp.groups.reduce((a,g)=>a+g.attempts,0),'swings, build',build);
