'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('links-game.js','utf8');
const finish=src.slice(src.indexOf('  function finish(){'),src.indexOf('  /* The game is sized'));
for(const practice of [true,false])for(const prior of [undefined,2]){
 const nodes={},writes=[],best=prior===undefined?{}:{'pound:front':prior};
 const context={S:{practice,holes:[1],scores:[3],putts:[1],course:'pound',len:'front',fir:[1,1],gir:1,longest:200},cur:{name:'Test',holes:[{n:1,par:4}]},store:{get:()=>best,set:(...a)=>writes.push(a)},$:id=>nodes[id]||(nodes[id]={}),toParStr:String,scoreClass:()=>'',show:()=>{}};
 vm.runInNewContext(finish+'\nfinish();',context);
 assert.equal(writes.length,practice?0:1);
 assert.equal(nodes.etitle.textContent,practice?'Practice complete':'New best round');
 assert.ok(!nodes.estrokes.textContent.includes('undefined'));
 if(practice)assert.equal(best['pound:front'],prior);
}
console.log('PASS replay practice excluded from best rounds; eligible rounds still saved');
