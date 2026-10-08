/* Disposable course downloads. Never reads or writes the player's golf-state key. */
(function () {
  'use strict';
  const courses=window.CADDIE_PREP_COURSES, CACHE='caddiehq-course-packs-v1', PREF='caddiehq_course_downloads_v1';
  const RECENTS=5, BUDGET=30*1024*1024, pending=new Map(), loaded=new Set(), errors=new Map();
  let prefs={},maintenance=Promise.resolve(),started=false;
  try{prefs=JSON.parse(localStorage.getItem(PREF)||'{}')||{};}catch{}
  prefs={favorites:prefs.favorites&&typeof prefs.favorites==='object'?prefs.favorites:{},recent:prefs.recent&&typeof prefs.recent==='object'?prefs.recent:{}};
  const entry=id=>courses.find(c=>c.id===id);
  const favorite=id=>typeof prefs.favorites[id]==='boolean'?prefs.favorites[id]:!!entry(id)?.defaultFavorite;
  const url=id=>new URL(entry(id).pack.url,document.baseURI).href;
  const save=()=>{try{localStorage.setItem(PREF,JSON.stringify(prefs));}catch{}};
  const notify=()=>window.dispatchEvent(new Event('course-downloads-change'));
  const openCache=async()=>{try{return await caches.open(CACHE);}catch{return null;}};
  function valid(data,c){
    if(data?.schemaVersion!==1||data.id!==c.id||data.storageKey!==c.storageKey||!Array.isArray(data.features)||!Array.isArray(data.holes)||!Array.isArray(data.tees))return false;
    if(data.holes.length!==c.holes.length||data.holes.some((h,i)=>h.n!==c.holes[i].n||h.physicalId!==c.holes[i].physicalId))return false;
    const point=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[0]>c.bounds[0]&&p[0]<c.bounds[2]&&p[1]>c.bounds[1]&&p[1]<c.bounds[3];
    return data.holes.every(h=>Array.isArray(h.path)&&(h.mapReady===false||h.path.length>=2)&&h.path.every(point))&&data.features.every(f=>Array.isArray(f.path)&&f.path.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)))&&data.tees.every(t=>Array.isArray(t.yards)&&t.yards.length===c.holes.length);
  }
  async function cached(id){
    const cache=await openCache();if(!cache)return null;
    try{const response=await cache.match(url(id));if(!response)return null;const data=await response.clone().json();return valid(data,entry(id))?{response,data}:null;}catch{return null;}
  }
  function apply(id,data){
    const c=entry(id),{pack,defaultFavorite,coverage}=c;
    Object.assign(c,data,{pack,defaultFavorite,coverage});loaded.add(id);
  }
  async function trimNow(){
    const cache=await openCache();if(!cache)return;
    const candidates=[];
    for(const request of await cache.keys()){
      const c=courses.find(c=>url(c.id)===request.url);
      if(!c){await cache.delete(request);continue;}
      if(!favorite(c.id)&&!pending.has(c.id))candidates.push(c);
    }
    candidates.sort((a,b)=>(prefs.recent[b.id]||0)-(prefs.recent[a.id]||0));
    let bytes=0;
    for(let i=0;i<candidates.length;i++){
      const c=candidates[i];bytes+=c.pack.bytes;
      if(i>=RECENTS||bytes>BUDGET)await cache.delete(url(c.id));
    }
  }
  const trim=()=>{maintenance=maintenance.catch(()=>{}).then(trimNow);return maintenance;};
  async function download(id){
    const c=entry(id),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    try{
      const response=await fetch(url(id),{cache:'no-store',signal:controller.signal});
      if(!response.ok)throw new Error('Course download failed. Try again when connected.');
      const body=await response.text();
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body))),b=>b.toString(16).padStart(2,'0')).join('');
      if(hash!==c.pack.version)throw new Error('Course update is not ready. Your previous download is kept.');
      const data=JSON.parse(body);if(!valid(data,c))throw new Error('Course data could not be verified.');
      const stored=new Response(body,{headers:{'Content-Type':'application/json','X-Caddie-Pack-Version':hash}});
      const cache=await openCache();
      if(cache){try{await cache.put(url(id),stored);}catch{errors.set(id,'Could not save offline. Free device storage and retry.');}}
      else errors.set(id,'Offline storage is unavailable in this browser.');
      return data;
    } finally{clearTimeout(timer);}
  }
  async function ensure(id,{refresh=false,touch=true,hydrate=true}={}){
    if(!entry(id))throw new Error('Unknown course');
    if(touch){prefs.recent[id]=Date.now();save();}
    if(pending.has(id)){const data=await pending.get(id);if(hydrate&&!loaded.has(id))apply(id,data);return entry(id);}
    const task=(async()=>{
      errors.delete(id);
      const old=await cached(id);
      let data=old?.data;
      if(!data||refresh||old.response.headers.get('X-Caddie-Pack-Version')!==entry(id).pack.version){
        try{data=await download(id);}catch(error){errors.set(id,error.message||'Connect to download this course.');if(!data)throw error;}
      }
      // Keep the currently displayed geometry stable; a downloaded update applies on reload.
      if(hydrate&&!loaded.has(id))apply(id,data);
      return data;
    })();
    pending.set(id,task);notify();
    try{const data=await task;if(hydrate&&!loaded.has(id))apply(id,data);return entry(id);}finally{pending.delete(id);await trim();notify();}
  }
  async function status(id){
    const old=await cached(id);
    return {favorite:favorite(id),available:!!old,current:old?.response.headers.get('X-Caddie-Pack-Version')===entry(id).pack.version,busy:pending.has(id),error:errors.get(id)||'',bytes:old?Number(old.response.headers.get('Content-Length'))||new TextEncoder().encode(JSON.stringify(old.data)).length:0};
  }
  async function pin(id,value){prefs.favorites[id]=!!value;save();notify();if(value)await ensure(id,{refresh:true,hydrate:false});else await trim();notify();}
  async function remove(id){prefs.favorites[id]=false;delete prefs.recent[id];save();await pending.get(id)?.catch(()=>{});const cache=await openCache();if(cache)await cache.delete(url(id));errors.delete(id);notify();}
  async function keepFavorites(){
    for(const c of courses)if(favorite(c.id))try{await ensure(c.id,{touch:false,hydrate:false});}catch{}
  }
  function start(){if(started)return;started=true;setTimeout(keepFavorites,1000);}
  window.addEventListener('online',keepFavorites);
  window.CaddieCoursePacks=Object.freeze({ensure,status,pin,remove,trim,start,favorite,ready:id=>loaded.has(id),cacheName:CACHE});
})();
