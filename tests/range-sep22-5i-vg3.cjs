const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root=path.join(__dirname,'..');
const feed=JSON.parse(fs.readFileSync(path.join(root,'corrections-20260922.json'),'utf8'));
const source=require('../data/range-2026-09-22.json');
const transcript=require('../data/evidence/2026-09-22-range-transcript.json');
const correction=feed.entries.find(e=>e.id==='bay-source-correction-20260922-v1');
assert.ok(correction,'existing phones require a NEW correction ID');
assert.equal(correction.type,'bay-update');
assert.equal(correction.target,'bay-20260922-range-8i-5i');
const groups=correction.bay.detail.rangeShots;
assert.deepEqual(groups.map(g=>g.club),['7-iron','5-iron']);
assert.deepEqual(groups.map(g=>g.shots.length),[16,17]);
assert.deepEqual(groups.map(g=>g.shots.filter(s=>s.mishit).map(s=>s.shot)),[[2],[9,11]]);
for (const [i,g] of groups.entries()) {
  assert.deepEqual(g.shots,source.clubs[i].shots);
  assert.equal(new Set(g.shots.map(s=>s.shot)).size,g.shots.length);
  const mean=g.shots.reduce((n,s)=>n+s.total,0)/g.shots.length;
  assert.ok(Math.abs(mean-transcript.sources[i].summary_visible.avg_total_yards)<.06,'source AVG total must corroborate row alignment');
  const remaining=g.shots.filter(s=>!s.mishit);
  const c=correction.bay.detail.clubs[i];
  assert.equal(c.n,remaining.length);
  assert.equal(c.carry,+(remaining.reduce((n,s)=>n+s.carry,0)/remaining.length).toFixed(1));
  for(const s of g.shots){
    assert.ok(Math.abs(s.face-s.path-s.ftp)<=.21,'face/path column alignment');
    if(s.cs!=null&&s.bs!=null) assert.ok(Math.abs(s.bs/s.cs-s.smash)<.015,'speed/strike column alignment');
  }
}
// The 60 ft 3 in lateral field is not this shot's 156.3-yard carry.
assert.equal(groups[1].shots[9].carry,156.3);
assert.equal(groups[1].shots[9].total,170);
assert.equal(groups[0].shots[13].spin,5787);
assert.deepEqual(correction.bay.detail.clubs.map(c=>[c.carry,c.best]),[[130.5,142.6],[147.7,163.5]]);
console.log('PASS source-backed Sep22 range: club badges, 33 rows, independent AVG checks, field alignment, exclusions and carry means.');
