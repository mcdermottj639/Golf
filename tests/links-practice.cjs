'use strict';
// Runs the real finish() (plus the v264 record/scorecard helpers it calls) in a bare VM with stubbed DOM:
// practice rounds must reach neither best scores nor course records; eligible rounds reach both.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('links-game.js','utf8');
const block=src.slice(src.indexOf('  /* ---------- course records + shareable scorecard'),src.indexOf('  /* The game is sized'));
assert.ok(block.includes('  function finish(){')&&block.includes('function recordRound('),'finish and its record helpers are in the sliced block');
const ctx2d=new Proxy({measureText:()=>({width:0})},{get:(t,k)=>k in t?t[k]:(k==='canvas'?null:()=>{}),set:()=>true});
const node=()=>({hidden:true,textContent:'',innerHTML:'',appendChild(){},querySelector(){return null},setAttribute(){},getAttribute(){return null},click(){}});
for(const practice of [true,false])for(const prior of [undefined,2]){
 const nodes={},writes=[],saved={best:prior===undefined?{}:{'pound:front':prior},records:{}};
 const context={
  S:{practice,holes:[1],scores:[3],putts:[1],course:'pound',len:'front',fir:[1,1],gir:1,longest:200,daily:false},
  cur:{id:'pound',name:'Test',place:'Town',tee:'Blue',holes:[{n:1,par:4}]},
  store:{get:(k,d)=>k in saved?saved[k]:d,set:(k,v)=>{saved[k]=v;writes.push([k,v])}},
  $:id=>nodes[id]||(nodes[id]=node()),toParStr:v=>v===0?'E':(v>0?'+':'')+v,scoreClass:()=>'',esc:v=>String(v),show:()=>{},
  document:{createElement:tag=>tag==='canvas'?{width:0,height:0,getContext:()=>ctx2d,toDataURL:()=>'data:,',toBlob:cb=>cb(null)}:node()},
  URL:{createObjectURL:()=>'blob:x',revokeObjectURL(){}},navigator:{},File:function(){},Promise,Math,Date,String,Number,Array,Object,JSON,console,
 };
 vm.runInNewContext(block+'\nfinish();',context);
 assert.equal(writes.filter(w=>w[0]==='best').length,practice?0:1,'best written only for eligible rounds');
 assert.equal(writes.filter(w=>w[0]==='records').length,practice?0:1,'records written only for eligible rounds');
 assert.equal(nodes.etitle.textContent,practice?'Practice complete':'New best round');
 assert.ok(!nodes.estrokes.textContent.includes('undefined'));
 assert.equal(nodes.erecord.hidden,false);
 if(practice){assert.equal(saved.best['pound:front'],prior);assert.match(nodes.erecord.textContent,/Practice round · not added/);}
 else{assert.equal(saved.records['pound:front'].length,1);assert.equal(saved.records['pound:front'][0].tp,-1);assert.match(nodes.erecord.textContent,/First front 9 round recorded at Test/);}
 assert.ok(nodes.cardimg.hidden===false,'scorecard preview is shown');
}
// a growing record is capped at RECORD_MAX and keeps the newest first
{
 const saved={best:{},records:{'pound:front':Array.from({length:20},(_,i)=>({tp:i}))}},nodes={};
 const context={S:{practice:false,holes:[1],scores:[5],putts:[2],course:'pound',len:'front',fir:[0,1],gir:0,longest:180,daily:true},cur:{id:'pound',name:'Test',place:'',tee:'',holes:[{n:1,par:4}]},
  store:{get:(k,d)=>k in saved?saved[k]:d,set:(k,v)=>{saved[k]=v}},$:id=>nodes[id]||(nodes[id]=node()),toParStr:v=>v===0?'E':(v>0?'+':'')+v,scoreClass:()=>'',esc:v=>String(v),show:()=>{},
  document:{createElement:tag=>tag==='canvas'?{width:0,height:0,getContext:()=>ctx2d,toDataURL:()=>'data:,',toBlob:cb=>cb(null)}:node()},URL:{createObjectURL:()=>'blob:x',revokeObjectURL(){}},navigator:{},File:function(){},Promise,Math,Date,String,Number,Array,Object,JSON,console};
 vm.runInNewContext(block+'\nfinish();',context);
 assert.equal(saved.records['pound:front'].length,20);assert.equal(saved.records['pound:front'][0].tp,1);assert.equal(saved.records['pound:front'][0].daily,true);
 assert.match(nodes.erecord.innerHTML,/20 rounds · best <b>E<\/b> · average <b>\+8\.6<\/b> · previous: E, \+1, \+2, \+3, \+4 …/); // (1 + 0..18)/20: the oldest round, +19, dropped off
}
console.log('PASS replay practice excluded from best rounds and course records; eligible rounds reach both; record capped at 20');
