#!/usr/bin/env node
'use strict';
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const dummy={addEventListener(){},querySelectorAll(){return []},classList:{add(){},remove(){},toggle(){}},style:{},dataset:{}};
const storage={};
const ctx={console,setTimeout(){},clearTimeout(){},setInterval(){},document:{addEventListener(){},querySelector(){return dummy},querySelectorAll(){return []},getElementById(){return dummy},body:dummy},navigator:{},localStorage:{getItem:k=>storage[k]||null,setItem:(k,v)=>storage[k]=v},window:{addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})}};
ctx.window.CaddieReview={render:()=>''};
vm.createContext(ctx);
for(const f of ['lessons.js','courses-db.js','course-cards.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx);
let src=fs.readFileSync(path.join(root,'app.js'),'utf8');
src=src.slice(0,src.indexOf('// ---------- Boot ----------'))+`
rerender=()=>{};toast=()=>{};load();
window.reviewTest={applyFeed,get:()=>S,bayView,isClearMishit,struckShots,analysisClubs,analysisDelivery,cumulativeView,premierMeans};
})();`;
vm.runInContext(src,ctx);
const T=ctx.window.reviewTest,feed=JSON.parse(fs.readFileSync(path.join(root,'coach-feed.json'),'utf8'));
T.applyFeed(feed);

const tops=[{carry:196.7},{carry:152.3},{carry:26.4},{carry:172.4},{carry:195.3},{carry:161.4},{carry:165.9},{carry:34.9},{carry:201.2},{carry:189.2},{carry:154.5}];
assert.equal(T.struckShots({shots:tops}).length,9);
assert.equal(T.isClearMishit(tops[2],tops),true);
assert.equal(T.isClearMishit(tops[7],tops),true);
assert.equal(T.isClearMishit(tops[0],tops),false);

const fat9=[{carry:97.7},{carry:106},{carry:95.6},{carry:97.2},{carry:100.1},{carry:114.4},{carry:120.3},{carry:108.6},{carry:82.4},{carry:69.5}];
assert.equal(T.isClearMishit(fat9[9],fat9),false);
const w5after=[{carry:180},{carry:180.9},{carry:177},{carry:179.5},{carry:80.4},{carry:47.3},{carry:192.8},{carry:156.1},{carry:112},{carry:3.6},{carry:161}];
assert.equal(T.isClearMishit(w5after[8],w5after),true); // 112 / 8' apex
assert.equal(T.isClearMishit(w5after[7],w5after),false); // 156.1 got up


const sep18=T.get().bays.find(b=>b._fid==='bay-20260918-gl18-3w-5w-7i');
assert.ok(sep18, 'sep 18 bay on file');
const clubs=T.analysisClubs(sep18.detail);
const w3=clubs.find(c=>c.club==='3 wood');
assert.equal(w3.n,9);
assert.equal(w3.held,2);
assert.equal(w3.carry,176.5);
const w5=clubs.find(c=>c.club==='5 wood');
assert.equal(w5.n,6);
assert.equal(w5.held,1);
assert.equal(w5.carry,179.1);
const w5b=clubs.find(c=>c.club==='5 wood · after slot');
assert.equal(w5b.n,7);
assert.equal(w5b.carry,175.3);
assert.ok(!T.bayView(T.get().bays.indexOf(sep18)).includes('>112<') && !T.bayView(T.get().bays.indexOf(sep18)).includes('112.0'));
const i7=clubs.find(c=>c.club==='7-iron');
assert.equal(i7.carry,131.7);
assert.equal(i7.best,141.8);

const html=T.bayView(T.get().bays.indexOf(sep18));
assert.equal(w3.best, 191.0);
assert.equal(w3.bestN, 5);
assert.ok(html.includes('176.5'));
assert.ok(!html.includes('222222'));
assert.ok(html.includes('1.44') || html.includes('1.43'));
assert.ok(html.includes('191.0'));
assert.ok(html.includes('179.1'));
assert.ok(html.includes('Best 5'));
assert.ok(!html.includes('held out'));
assert.ok(html.includes('exact data'));
for (const miss of ['26.4','34.9','21.5','12.6'])
  assert.ok(!new RegExp(`Shot \\d+: ${miss.replace('.', '\\.')} yd carry`).test(html), `${miss} mishit is absent from the rendered shot evidence`);
const cum=T.cumulativeView();
assert.ok(cum.includes('Club path') || cum.includes('Path across'));

const sep15=T.get().bays.find(b=>b._fid==='bay-20260915-range-54');
const s15=T.analysisClubs(sep15.detail);
const drv=s15.find(c=>c.club==='Driver');
assert.equal(drv.held,2);
assert.equal(drv.n,4);
assert.ok(drv.carry>170);
const wdg=s15.find(c=>/56/.test(c.club));
assert.equal(wdg.held,0);

console.log('PASS mishit-review: 3w 176.5 n=9, 5w 179.1 n=6, Sep 15 driver two tops held, fat 9-iron kept.');
