'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const root=path.join(__dirname,'..'),read=n=>JSON.parse(fs.readFileSync(path.join(root,'data/course-prep',n+'.json')));
const ids=['lakeside-penn-yan','oak-hills-park','richter-park','fairchild-wheeler-black','fairchild-wheeler-red'];
function inside(p,poly){let hit=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[0]>p[0])!==(b[0]>p[0])&&p[1]<(b[1]-a[1])*(p[0]-a[0])/(b[0]-a[0])+a[1])hit=!hit;}return hit;}
let maps=0;const routeIds=new Set();
for(const id of ids){const c=read(id),raw=read(id+'-osm'),pack=read('packs/'+id);
 assert.equal(c.holes.length,18);assert.equal(c.defaultTee,'white');assert.equal(pack.features.filter(f=>f.kind==='green').length>=18,true);
 for(const h of c.holes){
  if(h.mapReady===false){assert.ok(h.mapNote);assert.equal(pack.holes[h.n-1].path.length,0);assert.ok(raw.features.some(f=>f.id===h.candidateOsmId));continue;}
  maps++;assert.ok(!routeIds.has(h.osmId),'courses never share physical hole routes');routeIds.add(h.osmId);
  const route=raw.features.find(f=>f.id===h.osmId);assert.equal(+route.tags.ref,h.n);assert.ok(pack.features.some(f=>f.kind==='green'&&inside(route.path.at(-1),f.path)),'endpoint inside sourced green: '+id+' '+h.n);
  if(id.startsWith('fairchild-'))assert.equal(route.tags['golf:course:name'],id.endsWith('black')?'Black':'Red');
  if(route.tags.par===undefined){assert.equal(h.parSource,c.source);assert.ok(h.mapVerification);}
 }
 assert.ok(c.tees.every(t=>t.yards.length===18&&t.yards.reduce((a,b)=>a+b,0)===t.total));
}
assert.equal(maps,88);assert.deepEqual(read('lakeside-penn-yan').holes.filter(h=>h.mapReady===false).map(h=>h.n),[2,6]);
assert.ok(read('richter-park').tees.every(t=>t.rating===null&&t.slope===null));
const ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'course-prep-data.js'),'utf8'),ctx);
assert.ok(ctx.window.CADDIE_PREP_COURSES.filter(c=>ids.includes(c.id)).every(c=>!c.defaultFavorite&&!c.features&&c.holes.every(h=>!h.path)));
assert.ok(!fs.readFileSync(path.join(root,'sw.js'),'utf8').match(/const ASSETS = ([\s\S]+?);/)[1].includes('data/course-prep/'),'packs are not shell assets');
const q=read('onboarding-queue');assert.equal(q.entries.length,49);assert.equal(q.entries.filter(e=>e.duplicateOf).length,1);assert.ok(!q.entries.some(e=>/Sand Valley|Mammoth Dunes/.test(e.savedName)));
assert.ok(q.entries.find(e=>e.savedName==='Springfield Golf Center').identityNote.includes('UNVERIFIED'));
console.log('PASS expansion: 5 distinct courses, 88 sourced green endpoints, Lakeside 2/6 withheld, exact Red/Black identities, ratings conflicts unset, on-demand packs and played-only queue.');

// Missing OSM par is accepted only with explicit provenance; contradictory tags fail.
const generator=fs.readFileSync(path.join(root,'scripts/build-course-prep.cjs'),'utf8');
for(const kind of ['missing-source','wrong-par']){
 const fakeFs={...fs,readFileSync(file,encoding){const value=fs.readFileSync(file,encoding);if(String(file).endsWith('/lakeside-penn-yan'+(kind==='wrong-par'?'-osm':'')+'.json')){const data=JSON.parse(value);if(kind==='missing-source')delete data.holes[0].parSource;else data.features.find(f=>f.tags.golf==='hole'&&f.tags.ref==='1').tags.par='3';return JSON.stringify(data);}return value;}};
 assert.throws(()=>vm.runInNewContext(generator,{require:n=>n==='node:fs'?fakeFs:require(n),__dirname:path.join(root,'scripts'),process:{argv:['node','build','--check']},Buffer,console}),kind==='missing-source'?/missing source for untagged route par/:/5|3/);
}
console.log('PASS route provenance: absent official-card provenance and contradictory OSM pars are rejected.');
