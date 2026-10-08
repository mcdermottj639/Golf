// Source packs generate a lightweight directory and independently downloadable geometry.
// Run with --check in CI, or without it after adding a verified pack to catalog.json.
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),dir=path.join(root,'data/course-prep');
const read=name=>JSON.parse(fs.readFileSync(path.join(dir,name+'.json'),'utf8'));
const ids=read('catalog'),names=new Set(),storage=new Set();
assert.ok(ids.length);assert.equal(new Set(ids).size,ids.length);
const courses=ids.map(id=>{
  assert.match(id,/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  const c=read(id),raw=read(id+'-osm');assert.equal(c.id,id);
  for(const name of [c.id,c.name,...(c.aliases||[])]){
    const k=name.trim().toLowerCase().replace(/\s+/g,' ');
    // The slug and a human alias may normalize identically within one course.
    assert.ok(!names.has(k),id+': ambiguous course name '+name);
  }
  for(const name of [c.id,c.name,...(c.aliases||[])])names.add(name.trim().toLowerCase().replace(/\s+/g,' '));
  assert.ok(c.storageKey&&!storage.has(c.storageKey));storage.add(c.storageKey);
  assert.ok([9,18,27].includes(c.holes.length),id+': unsupported hole count');
  if(c.holes.length===27){
    assert.deepEqual(c.nines.flatMap(n=>n.holes),Array.from({length:27},(_,i)=>i+1));
    assert.ok(c.nines.every(n=>n.holes.length===9));
    assert.equal(new Set(c.routings.map(r=>r.id)).size,c.routings.length);
    for(const r of c.routings){assert.ok([9,18].includes(r.holes.length));assert.equal(new Set(r.holes).size,r.holes.length);assert.ok(r.holes.every(n=>c.holes.some(h=>h.n===n)));}
  }
  assert.ok(c.bounds.length===4&&c.bounds.every(Number.isFinite));
  const inside=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[0]>c.bounds[0]&&p[0]<c.bounds[2]&&p[1]>c.bounds[1]&&p[1]<c.bounds[3];
  assert.ok(inside(c.center));assert.match(c.source,/^https:\/\//);assert.ok(c.cardNote);
  assert.equal(c.holes.reduce((s,h)=>s+h.par,0),c.par);
  assert.deepEqual(c.holes.map(h=>h.n),Array.from({length:c.holes.length},(_,i)=>i+1));
  if(c.holes.some(h=>h.si))assert.deepEqual(c.holes.map(h=>h.si).sort((a,b)=>a-b),c.holes.map(h=>h.n));
  assert.ok(c.tees.some(t=>t.id===c.defaultTee));
  assert.equal(new Set(c.tees.map(t=>t.id)).size,c.tees.length);
  for(const t of c.tees){assert.equal(t.yards.length,c.holes.length);assert.ok(t.yards.every(y=>Number.isInteger(y)&&y>0));assert.equal(t.yards.reduce((a,b)=>a+b,0),t.total);}
  for(const h of c.holes){
    if(h.mapReady===false)assert.ok(h.mapNote,id+': explain unavailable hole map');
    if(h.guide)assert.match(h.guide,/^https:\/\//);
    if(h.mapReady===false&&!h.osmId){h.path=[];continue;}
    const way=raw.features.find(f=>f.id===h.osmId);
    assert.ok(way,id+': missing source way for hole '+h.n);
    assert.equal(+way.tags.ref,h.n);assert.equal(+way.tags.par,h.par);
    assert.ok(way.path.length>=2&&way.path.every(inside),id+': route outside bounds');
    if(h.guide)assert.match(h.guide,/^https:\/\//);
    h.path=way.path;
  }
  const corrections=new Map();
  for(const correction of c.featureCorrections||[]){
    assert.ok(!corrections.has(correction.id),id+': duplicate feature correction');
    const source=raw.features.find(f=>f.id===correction.id);
    assert.ok(source&&source.tags.golf===correction.from,id+': correction source mismatch');
    assert.ok(['fairway','green','bunker','tee','rough'].includes(correction.to));
    assert.ok(correction.confirmed&&correction.note,id+': correction requires provenance');
    corrections.set(correction.id,correction.to);
  }
  c.features=raw.features.flatMap(f=>{
    const kind=f.tags.golf==='water_hazard'||f.tags.golf==='lateral_water_hazard'||f.tags.natural==='water'?'water':f.tags.natural==='wood'||f.tags.landuse==='forest'?'wood':corrections.get(f.id)||f.tags.golf;
    return ['fairway','green','bunker','water','tee','rough','wood'].includes(kind)?[{kind,id:f.id,path:f.path}]:[];
  });
  return c;
});
const crypto=require('node:crypto');
const outputs=new Map(),defaults=new Set(['pound-ridge','wianno','sterling-farms','metedeconk']);
const directory=courses.map(c=>{
  c.schemaVersion=1;
  for(const h of c.holes)h.physicalId=c.id+':'+h.n;
  const body=JSON.stringify(c)+'\n',version=crypto.createHash('sha256').update(body).digest('hex');
  const packPath='data/course-prep/packs/'+c.id+'.json';
  outputs.set(packPath,body);
  const {features,...entry}=c;
  return {...entry,holes:c.holes.map(({path,...h})=>({...h,mappedGuide:h.mapReady!==false&&path.length>1})),
    pack:{url:packPath,version,bytes:Buffer.byteLength(body),schemaVersion:1},defaultFavorite:defaults.has(c.id),
    coverage:{holes:c.holes.length,maps:c.holes.filter(h=>h.mapReady!==false).length,guides:c.holes.filter(h=>h.guide||(h.mapReady!==false&&h.path.length>1)).length}};
});
outputs.set('course-prep-data.js','// Generated directory only; geometry loads per course.\nwindow.CADDIE_PREP_COURSES = '+JSON.stringify(directory)+';\n');
outputs.set('data/course-prep/coverage.json',JSON.stringify(directory.map(c=>({id:c.id,verified:c.verified,source:c.source,...c.coverage,bytes:c.pack.bytes,exceptions:c.holes.filter(h=>h.mapReady===false).map(h=>({hole:h.n,reason:h.mapNote}))})),null,2)+'\n');
for(const [relative,body] of outputs){
 const file=path.join(root,relative);
 if(process.argv.includes('--check'))assert.equal(fs.readFileSync(file,'utf8'),body,'Rebuild '+relative);
 else{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,body);}
}
console.log('PASS course catalog: '+courses.length+' courses, '+courses.reduce((n,c)=>n+c.holes.length,0)+' source-backed holes; unique names, tee totals, bounds and original OSM coordinates.');
