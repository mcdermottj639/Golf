'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const root=path.join(__dirname,'..'),read=n=>JSON.parse(fs.readFileSync(path.join(root,'data/course-prep',n+'.json')));
const ids=['princeton-country-club','makefield-highlands','mountain-view-nj','northampton-valley','westover-golf-club'];
const partial=new Set(['princeton-country-club','makefield-highlands','mountain-view-nj']);
function inside(p,poly){let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[0]>p[0])!==(b[0]>p[0])&&p[1]<(b[1]-a[1])*(p[0]-a[0])/(b[0]-a[0])+a[1])hit=!hit;}return hit;}
let holes=0,maps=0,guides=0;const routes=new Set();
for(const id of ids){
  const c=read(id),raw=read(id+'-osm'),pack=read('packs/'+id);holes+=c.holes.length;
  assert.equal(pack.holes.length,18);assert.ok(c.tees.every(t=>t.yards.length===18&&t.yards.reduce((a,b)=>a+b,0)===t.total));
  for(const h of c.holes){
    if(partial.has(id)){
      assert.equal(h.mapReady,false);assert.ok(h.mapNote);assert.equal(h.osmId,undefined);assert.deepEqual(pack.holes[h.n-1].path,[]);
    }else{
      maps++;guides++;assert.ok(!routes.has(h.osmId));routes.add(h.osmId);
      const route=raw.features.find(f=>f.id===h.osmId);assert.ok(route,id+' '+h.n);assert.equal(+route.tags.ref,h.n);
      if(id==='northampton-valley'){assert.equal(+route.tags.par,h.par);assert.ok(raw.features.some(f=>f.tags.golf==='tee'&&inside(route.path[0],f.path)),id+' '+h.n+' begins in a mapped tee');assert.ok(raw.features.some(f=>f.tags.golf==='green'&&inside(route.path.at(-1),f.path)),id+' '+h.n+' ends in a mapped green');}
      else{assert.equal(route.tags.par,undefined);assert.equal(h.parSource,c.source);assert.match(h.mapVerification,/inside the Westover course boundary/);}
    }
  }
}
assert.deepEqual([holes,guides,maps],[90,36,36]);
assert.deepEqual(read('princeton-country-club').tees.map(t=>t.total),[6005,5765]);
assert.deepEqual(read('makefield-highlands').tees.map(t=>t.total),[7058,6619,6157,5653,5065]);
assert.deepEqual(read('mountain-view-nj').tees.map(t=>t.total),[6611,6182,5769,5436]);
assert.deepEqual(read('northampton-valley').tees.map(t=>t.total),[6402,6102,5255,5083]);
assert.deepEqual(read('westover-golf-club').tees.map(t=>t.total),[5982,5602,4931]);
const ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'course-prep-data.js'),'utf8'),ctx);
const added=ctx.window.CADDIE_PREP_COURSES.filter(c=>ids.includes(c.id));assert.equal(added.length,5);
assert.ok(added.every(c=>!c.defaultFavorite&&!c.features&&c.holes.every(h=>!h.path)),'directory remains geometry-free and courses remain on demand');
for(const c of added)assert.deepEqual(JSON.parse(JSON.stringify(c.coverage)),partial.has(c.id)?{holes:18,maps:0,guides:0}:{holes:18,maps:18,guides:18});
assert.ok(!fs.readFileSync(path.join(root,'sw.js'),'utf8').match(/const ASSETS = ([\s\S]+?);/)[1].includes('data/course-prep/'),'packs are not shell assets');
const q=read('onboarding-queue');assert.deepEqual(q.progress,{savedPlayedEntries:49,catalogSupportedEntries:24,fullyMappedEntries:18,remainingUniqueEntries:24,duplicateUmbrellaEntries:1});
assert.ok(ids.every(id=>q.entries.some(e=>e.catalogId===id&&(partial.has(id)?e.status==='catalog-partial':e.status==='catalog-complete'))));
for(const queueId of ['trenton-country-club','spring-lake-golf-club','neshaminy-valley-golf-club','green-knoll-golf-course','weequahic-park-golf-course','concordia-golf-club'])assert.equal(q.entries.find(e=>e.queueId===queueId).status,'source-gap');
for(const id of partial)assert.ok(q.exceptions.some(e=>e.catalogId===id&&e.physicalHoles.length===18));
const batch=read('batch-2026-11-04');assert.deepEqual(batch.courseIds,ids);assert.equal(batch.sourceFiles.length,12);assert.deepEqual(batch.mapVerification.mappedRoutes,36);assert.deepEqual(batch.mapVerification.unavailableRoutes,54);
for(const check of batch.teeChecks){const c=read(check.courseId);assert.equal(c.holes.slice(0,9).reduce((n,h)=>n+h.par,0),check.parFront);assert.equal(c.holes.slice(9).reduce((n,h)=>n+h.par,0),check.parBack);for(const expected of check.tees){const t=c.tees.find(t=>t.id===expected.id);assert.ok(t);assert.deepEqual([t.yards.slice(0,9).reduce((a,b)=>a+b,0),t.yards.slice(9).reduce((a,b)=>a+b,0),t.total],[expected.front,expected.back,expected.total]);}}
console.log('PASS expansion 4: five on-demand courses, 90 exact scorecard holes, 36 guides/maps and 54 explicit map-source gaps.');
