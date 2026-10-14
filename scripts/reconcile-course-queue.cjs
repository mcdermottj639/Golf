// Reconstruct saved outdoor courses from the frozen seed and ordered feeds, never autocomplete.
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),dir=path.join(root,'data/course-prep'),file=path.join(dir,'onboarding-queue.json');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8'),start=app.indexOf('    courses: ['),end=app.indexOf('    rounds: []',start);
assert.ok(start>0&&end>start);
let saved=vm.runInNewContext('({'+app.slice(start,end)+'})').courses.map(c=>({...c,evidence:'app.js#seed.courses'}));
const feeds=app.match(/Promise\.all\(\[([^\]]+)\]\.map\(name => fetch/)[1].match(/'([^']+)'/g).map(x=>x.slice(1,-1));
const removed=[];
for(const f of feeds)for(const e of JSON.parse(fs.readFileSync(path.join(root,f),'utf8')).entries||[]){
 if(e.type==='course-add'&&e.course&&!saved.some(c=>c.name===e.course.name))saved.push({...e.course,evidence:f+'#'+e.id});
 if(e.type==='course-remove'){saved=saved.filter(c=>c.name!==e.target);removed.push({name:e.target,evidence:f+'#'+e.id,reason:'explicit removal'});}
}
const old=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{schemaVersion:1,batchCap:5,successfulBatches:0,entries:[]};
const catalog=JSON.parse(fs.readFileSync(path.join(dir,'catalog.json'))).map(id=>JSON.parse(fs.readFileSync(path.join(dir,id+'.json'))));
const coverage=JSON.parse(fs.readFileSync(path.join(dir,'coverage.json')));
const norm=x=>x.toLowerCase().replace(/\s+/g,' ').trim(),slug=x=>norm(x).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const priority=['Lakeside Country Club','Oak Hills Park Golf Club','Richter Park Golf Course','Fairchild Wheeler Golf Course — Black','Fairchild Wheeler Golf Course — Red','Hudson Hills Golf Course','Beekman Golf Course','Trump Links at Ferry Point','Saxon Woods Golf Course','Van Cortlandt Park Golf Course','Granite Links Golf Club','Bass River Golf Course','Islands End Golf and Country Club','New York Country Club'];
const entries=saved.filter(c=>!c.bucket&&!c.sim).map((s,i)=>{
 const prev=old.entries.find(e=>e.savedName===s.name)||{},pack=catalog.find(c=>[c.name,...c.aliases].some(n=>norm(n)===norm(s.name))),cv=pack&&coverage.find(c=>c.id===pack.id);
 const e={queueId:prev.queueId||slug(s.name),savedName:s.name,canonicalName:pack?.name||prev.canonicalName||s.name,aliases:[...new Set([s.name,...(pack?.aliases||prev.aliases||[])])],region:s.st,priority:priority.includes(s.name)?priority.indexOf(s.name)+1:20+(['NY','NJ','CT','MA','PA','VT'].includes(s.st)?0:s.st==='FL'?100:200)+i,routing:prev.routing||null,evidence:[s.evidence],status:prev.status||'pending',coverageGaps:prev.coverageGaps||[],completionCommit:prev.completionCommit||null,...prev};
 e.evidence=[...new Set([s.evidence,...(prev.evidence||[])])];
 if(pack){Object.assign(e,{catalogId:pack.id,canonicalName:pack.name,status:cv.maps===cv.holes?'catalog-complete':'catalog-partial',routing:pack.nines?{nines:pack.nines,routings:pack.routings}:{physicalHoles:18,nines:[{name:'Front',holes:[1,2,3,4,5,6,7,8,9]},{name:'Back',holes:[10,11,12,13,14,15,16,17,18]}],playableOrder:Array.from({length:18},(_,i)=>i+1)},coverage:{holes:cv.holes,guides:cv.guides,maps:cv.maps},coverageGaps:cv.exceptions,sourceUrls:[pack.source,pack.osmSource,...(pack.additionalSources||[])],retrieved:pack.verified});}
 return e;
});
const out={...old,reconciled:process.argv.includes('--check')?old.reconciled:new Date().toISOString().slice(0,10),sourcePolicy:'Frozen seed courses plus course-add/course-remove entries from the current ordered app feeds. Bucket-list and simulator-only records excluded; autocomplete is not play evidence.',entries:entries.sort((a,b)=>a.priority-b.priority),excluded:[...saved.filter(c=>c.bucket||c.sim).map(c=>({name:c.name,evidence:c.evidence,reason:c.bucket?'bucket list':'simulator only'})),...removed]};
out.progress={savedPlayedEntries:entries.length,catalogSupportedEntries:entries.filter(e=>e.catalogId).length,fullyMappedEntries:entries.filter(e=>e.status==='catalog-complete').length,remainingUniqueEntries:entries.filter(e=>!e.catalogId&&!e.duplicateOf).length,duplicateUmbrellaEntries:entries.filter(e=>e.duplicateOf).length};
const text=JSON.stringify(out,null,2)+'\n';if(process.argv.includes('--check'))assert.equal(fs.readFileSync(file,'utf8'),text,'Reconcile onboarding queue');else fs.writeFileSync(file,text);
console.log('PASS played queue:',JSON.stringify(out.progress));
