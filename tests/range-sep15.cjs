const assert=require('node:assert/strict');
const source=require('../data/range-2026-09-15.json');
const entry=require('../scripts/range-sep15-entry.cjs');
const feed=require('../coach-feed.json');
assert.deepEqual(feed.entries.find(e=>e.id===source.id),entry);
assert.equal(feed.entries.filter(e=>e.id===source.id).length,1);
assert.deepEqual(source.clubs.map(c=>c.shots.length),[6,10,9,10,10,9]);
assert.equal(source.clubs.reduce((n,c)=>n+c.carryHits.length,0),7);
assert.equal(source.clubs.reduce((n,c)=>n+c.totalHits.length,0),20);
for(const c of source.clubs){
  for(const s of c.shots){
    assert.equal(s.length,source.columns.length);
    assert.ok(s.every(x=>x===null||Number.isFinite(x)));
    assert.ok(s[1]>=s[0]);
    if(s[5]!=null) assert.ok(Math.abs(s[6]-s[5]-s[7])<0.16);
  }
  const avg=k=>c.shots.reduce((n,s)=>n+s[k],0)/c.shots.length;
  assert.ok(Math.abs(avg(0)-c.displayCarry)<0.11,`${c.label} carry screen mean`);
  if(c.displayTotal!=null) assert.ok(Math.abs(avg(1)-c.displayTotal)<0.11,`${c.label} total screen mean`);
  for(const hits of [c.carryHits,c.totalHits]) assert.ok(hits.every(n=>n>=1&&n<=c.shots.length));
}
assert.deepEqual(entry.bay.detail.delivery.map(c=>c.paths.filter(Number.isFinite).length),[5,6,8,9,9,9]);
assert.equal(source.clubs[0].shots[1][0],8);
assert.equal(source.clubs[5].shots[4][0],63.6);
assert.equal(source.clubs[5].shots[4][1],107.3);
console.log('PASS Sep 15: 54 distinct shots, screen averages, 7 carry/20 total hits, 46 readable delivery rows, missing values, deterministic append-only feed entry.');
