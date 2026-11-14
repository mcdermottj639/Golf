#!/usr/bin/env node
'use strict';
// External-release parity: every checked byte is fetched from the public Pages
// URL, not from gh-pages, a localhost server, or a synthetic browser fixture.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const base='https://mcdermottj639.github.io/Golf/';
const files=['index.html','app.js','course-prep.js','ux-journey.css','revamp.css','bay-takeaways.js','range-20261114-feed.json','sw.js'];
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const expected=new Map(files.map(file=>[file,hash(fs.readFileSync(path.join(root,file)))]));
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const build=app.match(/const BUILD = '(v[0-9]+)'/)?.[1];
if(!build||!sw.includes("const CACHE = 'caddiehq-"+build+"'"))throw Error('App/build/offline version mismatch');
if(!fs.readFileSync(path.join(root,'index.html'),'utf8').includes('ux-journey.css'))throw Error('Missing journey CSS in shell');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
 let errors=[];
 const tries=24;
 for(let attempt=1;attempt<=tries;attempt++){
  errors=[];
  // Unique CDN cache key each attempt; no private data or credentials requested.
  await Promise.all(files.map(async file=>{
   try{
    const url=base+file+'?release='+build+'-'+attempt+'-'+process.env.GITHUB_SHA?.slice(0,8);
    const response=await fetch(url,{headers:{'Cache-Control':'no-cache','Pragma':'no-cache'},signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw Error('HTTP '+response.status);
    const actual=hash(Buffer.from(await response.arrayBuffer()));
    if(actual!==expected.get(file))throw Error('bytes differ (possibly old edge version)');
   }catch(e){errors.push(file+': '+e.message)}
  }));
  if(!errors.length){
   console.log('PASS public Caddie HQ '+build+' served-byte parity on '+files.join(', ')+'; attempts '+attempt);
   return;
  }
  console.log('Public cache not yet aligned, attempt '+attempt+'/'+tries+': '+errors.join('; '));
  if(attempt<tries)await pause(12000);
 }
 throw Error('Public Caddie HQ served assets differ after retries: '+errors.join('; '));
})().catch(e=>{console.error(e);process.exitCode=1});
