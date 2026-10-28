'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const root=path.join(__dirname,'..'),read=n=>JSON.parse(fs.readFileSync(path.join(root,'data/course-prep',n+'.json')));
const ids=['granite-links','bass-river','basin-harbor','vermont-national','fox-hollow'];
function inside(p,poly){let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[0]>p[0])!==(b[0]>p[0])&&p[1]<(b[1]-a[1])*(p[0]-a[0])/(b[0]-a[0])+a[1])hit=!hit;}return hit;}
let holes=0,maps=0,guides=0;const routes=new Set();
for(const id of ids){
  const c=read(id),raw=read(id+'-osm'),pack=read('packs/'+id);holes+=c.holes.length;
  assert.equal(pack.holes.length,c.holes.length);assert.ok(c.tees.every(t=>t.yards.length===c.holes.length&&t.yards.reduce((a,b)=>a+b,0)===t.total));
  for(const h of c.holes){
    maps++;guides++;assert.ok(!routes.has(h.osmId),'physical routes are never shared');routes.add(h.osmId);
    const route=raw.features.find(f=>f.id===h.osmId);assert.ok(route,id+' '+h.n);assert.equal(+route.tags.ref,h.sourceRef||h.n);
    if(h.sourceNine)assert.equal(route.tags[c.sourceNineTag],h.sourceNine);
    assert.ok(pack.features.some(f=>f.kind==='green'&&inside(route.path.at(-1),f.path)),id+' '+h.n+' endpoint must reach a mapped green');
  }
}
assert.deepEqual([holes,guides,maps],[99,99,99]);
const granite=read('granite-links');assert.deepEqual(granite.nines.map(n=>n.name),['Granite','Quincy','Milton']);assert.equal(granite.routings.length,6);assert.equal(granite.routings[0].id,'granite-quincy');assert.equal(granite.sourceNineTag,'golf:links');assert.ok(granite.aliases.includes('Granite Links'));
const bass=read('bass-river'),rawBass=read('bass-river-osm');assert.equal(bass.routeTagCorrections.length,6);for(const c of bass.routeTagCorrections)assert.equal(rawBass.features.find(f=>f.id===c.id).tags.par,c.from,'raw Bass tag remains unchanged');
assert.equal(read('basin-harbor').holes.length,18);assert.equal(read('vermont-national').tees.length,8);assert.match(read('vermont-national').cardNote,/Gold\/Blue.*6,342.*6,292/);assert.equal(read('fox-hollow').tees.every(t=>t.rating===null&&t.slope===null),true);
const ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'course-prep-data.js'),'utf8'),ctx);const added=ctx.window.CADDIE_PREP_COURSES.filter(c=>ids.includes(c.id));assert.equal(added.length,5);assert.ok(added.every(c=>!c.defaultFavorite&&!c.features&&c.holes.every(h=>!h.path)&&c.coverage.maps===c.coverage.holes));
assert.ok(!fs.readFileSync(path.join(root,'sw.js'),'utf8').match(/const ASSETS = ([\s\S]+?);/)[1].includes('data/course-prep/'),'packs are not shell assets');
const q=read('onboarding-queue');assert.deepEqual(q.progress,{savedPlayedEntries:49,catalogSupportedEntries:19,fullyMappedEntries:16,remainingUniqueEntries:29,duplicateUmbrellaEntries:1});assert.ok(ids.every(id=>q.entries.some(e=>e.catalogId===id&&e.status==='catalog-complete')));assert.equal(q.entries.find(e=>e.queueId==='islands-end-golf-and-country-club').status,'source-gap');assert.equal(q.entries.find(e=>e.queueId==='new-york-country-club').status,'source-gap');assert.equal(q.batchCap,5);
const batch=read('batch-2026-10-28');assert.equal(batch.sourceFiles.length,14);assert.ok(batch.sourceFiles.every(s=>/^https:\/\//.test(s.url)&&/^[a-f0-9]{64}$/.test(s.sha256)));assert.equal(batch.teeChecks.length,5);assert.match(batch.mapVerification,/All 99 published routes/);
for(const check of batch.teeChecks)for(const expected of check.tees){const actual=read(check.courseId).tees.find(t=>t.id===expected.id);assert.ok(actual);const parts=check.courseId==='granite-links'?[actual.yards.slice(0,9),actual.yards.slice(9,18),actual.yards.slice(18)]:[actual.yards.slice(0,9),actual.yards.slice(9)];assert.deepEqual(parts.map(row=>row.reduce((a,b)=>a+b,0)),check.courseId==='granite-links'?expected.nines:[expected.front,expected.back]);assert.equal(actual.total,expected.total);}
console.log('PASS expansion 3: five distinct courses, 99 guides, 99 maps, exact Granite nines, audited Bass corrections and on-demand packs.');

const generator=fs.readFileSync(path.join(root,'scripts/build-course-prep.cjs'),'utf8');
for(const kind of ['missing-correction','wrong-nine']){
  const fakeFs={...fs,readFileSync(file,encoding){const value=fs.readFileSync(file,encoding);if(String(file).endsWith('/bass-river.json')&&kind==='missing-correction'){const data=JSON.parse(value);delete data.routeTagCorrections;return JSON.stringify(data);}if(String(file).endsWith('/granite-links-osm.json')&&kind==='wrong-nine'){const data=JSON.parse(value);data.features.find(f=>f.id===720590809).tags['golf:links']='Milton';return JSON.stringify(data);}return value;}};
  assert.throws(()=>vm.runInNewContext(generator,{require:n=>n==='node:fs'?fakeFs:require(n),__dirname:path.join(root,'scripts'),process:{argv:['node','build','--check']},Buffer,console}),kind==='missing-correction'?/3|4/:/wrong physical nine/);
}
console.log('PASS expansion 3 provenance: missing Bass correction or wrong Granite physical nine is rejected.');
