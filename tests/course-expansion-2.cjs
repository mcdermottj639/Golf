'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const root=path.join(__dirname,'..'),read=n=>JSON.parse(fs.readFileSync(path.join(root,'data/course-prep',n+'.json')));
const ids=['hudson-hills','beekman','ballys-ferry-point','saxon-woods','van-cortlandt'];
function inside(p,poly){let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[0]>p[0])!==(b[0]>p[0])&&p[1]<(b[1]-a[1])*(p[0]-a[0])/(b[0]-a[0])+a[1])hit=!hit;}return hit;}
let maps=0,guides=0,verifiedWithoutContainingGreen=0;const routes=new Set();
for(const id of ids){
 const c=read(id),raw=read(id+'-osm'),pack=read('packs/'+id);
 assert.equal(c.holes.length,id==='beekman'?27:18);assert.equal(pack.holes.length,c.holes.length);
 assert.ok(c.tees.every(t=>t.yards.length===c.holes.length&&t.yards.reduce((a,b)=>a+b,0)===t.total));
 for(const h of c.holes){
  guides+=Number(!!h.guide||h.mapReady!==false);
  if(h.mapReady===false){assert.ok(h.guide&&h.mapNote);assert.equal(pack.holes[h.n-1].path.length,0);continue;}
  maps++;assert.ok(!routes.has(h.osmId),'physical routes are never shared');routes.add(h.osmId);
  const route=raw.features.find(f=>f.id===h.osmId);assert.ok(route);assert.equal(+route.tags.ref,h.sourceRef||h.n);
  if(h.sourceNine)assert.equal(route.tags['golf:course:name'],h.sourceNine);
  const endpointGreen=pack.features.some(f=>f.kind==='green'&&inside(route.path.at(-1),f.path));
  if(!endpointGreen){verifiedWithoutContainingGreen++;assert.ok(h.mapVerification,id+' '+h.n+' needs bounded map evidence');}
 }
}
assert.equal(maps,97);assert.equal(guides,99);assert.equal(verifiedWithoutContainingGreen,4);
assert.deepEqual(read('beekman').holes.filter(h=>h.mapReady===false).map(h=>h.n),[4,13]);
assert.deepEqual(read('beekman').nines.map(n=>n.name),['Highland','Valley','Taconic']);assert.equal(read('beekman').routings.length,6);
assert.equal(read('ballys-ferry-point').storageKey,'trump_links_at_ferry_point');assert.ok(read('ballys-ferry-point').aliases.includes('Trump Links at Ferry Point'));
const hudson=read('hudson-hills'),correction=hudson.routeTagCorrections[0],rawHudson=read('hudson-hills-osm');
assert.deepEqual([correction.id,correction.from,correction.to],[1049812263,'6','4']);assert.equal(rawHudson.features.find(f=>f.id===correction.id).tags.par,'6','raw tag remains unchanged');
const ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'course-prep-data.js'),'utf8'),ctx);
const added=ctx.window.CADDIE_PREP_COURSES.filter(c=>ids.includes(c.id));assert.equal(added.length,5);assert.ok(added.every(c=>!c.defaultFavorite&&!c.features&&c.holes.every(h=>!h.path)));
assert.ok(!fs.readFileSync(path.join(root,'sw.js'),'utf8').match(/const ASSETS = ([\s\S]+?);/)[1].includes('data/course-prep/'),'packs are not shell assets');
const q=read('onboarding-queue');assert.equal(q.progress.savedPlayedEntries,49);assert.equal(q.progress.duplicateUmbrellaEntries,1);assert.ok(q.progress.catalogSupportedEntries>=14&&q.progress.fullyMappedEntries>=11&&q.progress.remainingUniqueEntries<=34);
assert.ok(ids.every(id=>q.entries.some(e=>e.catalogId===id&&e.status.startsWith('catalog-'))));assert.equal(q.batchCap,5);
const batch=read('batch-2026-10-21');assert.equal(batch.sourceFiles.length,11);assert.ok(batch.sourceFiles.every(s=>/^https:\/\//.test(s.url)&&/^[a-f0-9]{64}$/.test(s.sha256)));
console.log('PASS expansion 2: five distinct courses, 99 guides, 97 maps, exact Beekman nines, Ferry Point alias continuity, audited Hudson tag correction and on-demand packs.');

// The raw Hudson tag may differ only through the documented correction record.
const generator=fs.readFileSync(path.join(root,'scripts/build-course-prep.cjs'),'utf8');
for(const kind of ['missing-correction','wrong-original']){
 const fakeFs={...fs,readFileSync(file,encoding){const value=fs.readFileSync(file,encoding);if(String(file).endsWith('/hudson-hills.json')&&kind==='missing-correction'){const data=JSON.parse(value);delete data.routeTagCorrections;return JSON.stringify(data);}if(String(file).endsWith('/hudson-hills-osm.json')&&kind==='wrong-original'){const data=JSON.parse(value);data.features.find(f=>f.id===1049812263).tags.par='5';return JSON.stringify(data);}return value;}};
 assert.throws(()=>vm.runInNewContext(generator,{require:n=>n==='node:fs'?fakeFs:require(n),__dirname:path.join(root,'scripts'),process:{argv:['node','build','--check']},Buffer,console}),kind==='missing-correction'?/6|4/:/original tag mismatch/);
}
console.log('PASS corrected route provenance: absent or mismatched audit evidence is rejected.');
