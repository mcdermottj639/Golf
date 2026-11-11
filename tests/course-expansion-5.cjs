'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const root=path.join(__dirname,'..'),read=n=>JSON.parse(fs.readFileSync(path.join(root,'data/course-prep',n+'.json')));
const ids=['quail-brook','middletown-country-club','broad-run','old-corkscrew','quail-village'];
let holes=0,maps=0,guides=0;const routeIds=new Set();
for(const id of ids){
  const c=read(id),raw=read(id+'-osm'),pack=read('packs/'+id);holes+=c.holes.length;
  assert.equal(pack.holes.length,18);assert.ok(c.tees.every(t=>t.yards.length===18&&t.yards.reduce((a,b)=>a+b,0)===t.total));
  for(const h of c.holes){
    if(h.mapReady===false){assert.equal(id,'quail-village');assert.ok(h.n>=14);assert.equal(h.osmId,undefined);assert.ok(h.mapNote);assert.deepEqual(pack.holes[h.n-1].path,[]);continue;}
    maps++;guides++;assert.ok(!routeIds.has(h.osmId));routeIds.add(h.osmId);
    const route=raw.features.find(f=>f.id===h.osmId);assert.ok(route,id+' '+h.n);assert.equal(route.tags.golf,'hole');assert.equal(+route.tags.ref,h.n);
    const correction=c.routeTagCorrections?.find(x=>x.id===h.osmId);
    if(route.tags.par!==undefined)assert.equal(correction?+correction.to:+route.tags.par,h.par);
    else{assert.equal(id,'quail-village');assert.equal(h.parSource,c.source);assert.match(h.mapVerification,/raw route omits par/);}
  }
}
assert.deepEqual([holes,guides,maps],[90,85,85]);
assert.deepEqual(read('quail-brook').tees.map(t=>t.total),[6499]);
assert.deepEqual(read('middletown-country-club').tees.map(t=>t.total),[6217]);
assert.deepEqual(read('broad-run').tees.map(t=>t.total),[6751]);
assert.deepEqual(read('old-corkscrew').tees.map(t=>t.total),[7305,6479,6267,6064,5569,5054]);
assert.deepEqual(read('quail-village').tees.map(t=>t.total),[4873,4714,4177,3707]);
assert.match(read('old-corkscrew').cardNote,/historical|Final published/i);assert.match(read('old-corkscrew').tour,/farewell/);
const qv=read('quail-village');assert.equal(qv.routeTagCorrections[0].id,1568361952);assert.equal(qv.routeTagCorrections[0].to,'4');
const ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'course-prep-data.js'),'utf8'),ctx);
const added=ctx.window.CADDIE_PREP_COURSES.filter(c=>ids.includes(c.id));assert.equal(added.length,5);
assert.ok(added.every(c=>!c.defaultFavorite&&!c.features&&c.holes.every(h=>!h.path)),'directory remains geometry-free and courses remain on demand');
for(const c of added)assert.deepEqual(JSON.parse(JSON.stringify(c.coverage)),c.id==='quail-village'?{holes:18,maps:13,guides:13}:{holes:18,maps:18,guides:18});
assert.ok(!fs.readFileSync(path.join(root,'sw.js'),'utf8').match(/const ASSETS = ([\s\S]+?);/)[1].includes('data/course-prep/'),'packs are not shell assets');
const q=read('onboarding-queue');assert.deepEqual(q.progress,{savedPlayedEntries:49,catalogSupportedEntries:29,fullyMappedEntries:22,remainingUniqueEntries:19,duplicateUmbrellaEntries:1});
assert.ok(ids.every(id=>q.entries.some(e=>e.catalogId===id&&(id==='quail-village'?e.status==='catalog-partial':e.status==='catalog-complete'))));
const batch=read('batch-2026-11-11');assert.deepEqual(batch.courseIds,ids);assert.equal(batch.mapVerification.mappedRoutes,85);assert.equal(batch.mapVerification.unavailableRoutes,5);assert.equal(batch.teeChecks.length,5);
assert.deepEqual(batch.nextFive,['bonita-bay-west-bay-island','arrowhead-golf-course-at-heritage-greens','old-head','waterville','hogs-head']);
console.log('PASS expansion 5: five on-demand courses, 90 scorecard holes, 85 guides/maps and five explicit Quail Village map gaps.');
