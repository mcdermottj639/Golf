'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
(async()=>{
 const stored=new Map(),files=new Map(),prefs=new Map([['caddiehq_v1','{"rounds":["keep"],"coursePrep":{"wianno":{"note":"keep"}}}']]);
 const ctx={window:{addEventListener(){},dispatchEvent(){}},document:{baseURI:'https://caddie.test/'},localStorage:{getItem:k=>prefs.get(k),setItem:(k,v)=>prefs.set(k,v)},console,URL,Response,TextEncoder,Event,AbortController,crypto:crypto.webcrypto,setTimeout,clearTimeout,Date};
 vm.createContext(ctx);vm.runInContext(read('course-prep-data.js'),ctx);
 const courses=ctx.window.CADDIE_PREP_COURSES;
 for(const c of courses)files.set(c.pack.url,read(c.pack.url));
 for(let i=0;i<8;i++){
   const c=JSON.parse(files.get(courses[0].pack.url));c.id='test-'+i;c.storageKey=c.id;c.holes.forEach(h=>h.physicalId=c.id+':'+h.n);
   const body=JSON.stringify(c),pack={url:'data/course-prep/packs/'+c.id+'.json',version:crypto.createHash('sha256').update(body).digest('hex'),bytes:Buffer.byteLength(body)};
   courses.push({...c,pack,defaultFavorite:false});files.set(pack.url,body);
 }
 let fail=false,corrupt=false,quota=false,delay=null,calls=0;
 ctx.caches={open:async()=>({match:async u=>stored.get(typeof u==='string'?u:u.url)?.clone(),put:async(u,r)=>{if(quota)throw Error('Quota exceeded');stored.set(u,r.clone());},keys:async()=>[...stored.keys()].map(url=>({url})),delete:async u=>stored.delete(typeof u==='string'?u:u.url)})};
 ctx.fetch=async u=>{calls++;if(delay)await delay;if(fail)return new Response('',{status:503});return new Response(corrupt?'{}':files.get(new URL(u).pathname.slice(1)));};
 vm.runInContext(read('course-packs.js'),ctx);const P=ctx.window.CaddieCoursePacks;
 for(const c of courses.slice(0,4)){assert.equal(P.favorite(c.id),true);await P.ensure(c.id,{hydrate:false,touch:false});assert.equal(P.ready(c.id),false);assert.equal((await P.status(c.id)).available,true);}
 await P.ensure('wianno');assert.equal(P.ready('wianno'),true);
 const baseline=await stored.get('https://caddie.test/data/course-prep/packs/wianno.json').clone().text();
 fail=true;await P.ensure('wianno',{refresh:true});assert.equal(await stored.get('https://caddie.test/data/course-prep/packs/wianno.json').clone().text(),baseline);fail=false;
 corrupt=true;await P.ensure('wianno',{refresh:true});assert.equal(await stored.get('https://caddie.test/data/course-prep/packs/wianno.json').clone().text(),baseline);corrupt=false;
 for(let i=0;i<8;i++)await P.ensure('test-'+i);
 assert.equal(stored.size,9,'four favorites plus five recent downloads');
 assert.equal((await P.status('test-0')).available,false);assert.equal((await P.status('test-7')).available,true);
 for(const c of courses.slice(0,4))assert.equal((await P.status(c.id)).available,true,'favorites never automatically evicted');
 await P.remove('wianno');assert.equal((await P.status('wianno')).available,false);assert.equal(P.favorite('wianno'),false);
 let release;delay=new Promise(r=>release=r);const before=calls;
 const a=P.ensure('test-0',{hydrate:false}),b=P.ensure('test-0',{hydrate:true});release();await Promise.all([a,b]);delay=null;assert.equal(calls,before+1,'concurrent fetch deduplicated');assert.equal(P.ready('test-0'),true);
 quota=true;await P.ensure('wianno',{refresh:true});assert.equal((await P.status('wianno')).available,false);assert.match((await P.status('wianno')).error,/storage/);quota=false;
 await P.pin('wianno',true);assert.equal((await P.status('wianno')).available,true);
 const wc=courses.find(c=>c.id==='wianno'),oldPrompt=wc.holes[0].prompt;
 const update=JSON.parse(files.get(wc.pack.url));update.holes[0].prompt='Verified updated prompt';const updatedBody=JSON.stringify(update);
 files.set(wc.pack.url,updatedBody);wc.pack.version=crypto.createHash('sha256').update(updatedBody).digest('hex');
 await P.ensure('wianno',{refresh:true});assert.equal((await stored.get('https://caddie.test/'+wc.pack.url).clone().json()).holes[0].prompt,'Verified updated prompt');
 assert.equal(wc.holes[0].prompt,oldPrompt,'successful update does not swap active course geometry or prompts');
 for(let i=0;i<8;i++)courses.find(c=>c.id==='test-'+i).pack.bytes=12*1024*1024;
 await P.trim();assert.ok(stored.size<=6,'30 MiB nonfavorite budget independent of favorite storage');
 stored.clear();assert.equal((await P.status('wianno')).available,false,'availability checks actual cache after browser eviction');
 assert.equal(prefs.get('caddiehq_v1'),'{"rounds":["keep"],"coursePrep":{"wianno":{"note":"keep"}}}','golf state untouched');
 console.log('PASS course storage: defaults, deduplication, LRU, favorites, failed/hash-invalid updates, quota failure, eviction detection and separate golf state.');
})().catch(e=>{console.error(e);process.exitCode=1;});
