'use strict';
const assert=require('node:assert/strict');
const {server,chromium,ready}=require('./course-prep-browser.cjs');
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:'/tmp/chromium',args:['--no-sandbox']});
 try{
  for(const [width,height] of [[393,852],[390,667],[320,568]]){
   const p=await browser.newPage({viewport:{width,height},serviceWorkers:'block'});
   await p.goto('http://127.0.0.1:'+server.address().port);await ready(p);
   // Reserve the iPhone status area and bottom home indicator even in desktop Chromium.
   await p.addStyleTag({content:`body.lvcardfocus .hero.hq-shell{padding-top:${width===320?28:70}px!important} #nav{padding-bottom:${width===320?0:34}px!important}`});
   await p.locator('[data-action="live-new"]').first().click();
   async function fits(selector){
    assert.equal(await p.locator('.page-sections').count(),0);
    const rect=await p.locator(selector).boundingBox(),nav=await p.locator('#nav').boundingBox();
    assert.ok(rect.y+rect.height<=nav.y,`${width}×${height}: ${selector} ends ${rect.y+rect.height}, nav ${nav.y}`);
    assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   }
   await fits('.live-start-button');
   const date=await p.locator('#lvDate').boundingBox(),holes=await p.locator('#lvNine').boundingBox();
   assert.ok(date.x+date.width<=holes.x,'date does not overlap holes');
   await p.locator('#lvCourse').fill('Sterling');
   await p.locator('#lvPick [data-action="live-pick"]').filter({hasText:'Sterling Farms'}).first().click();
   await fits('.live-start-button');
   if(width===393)await p.screenshot({path:'/tmp/live-start-fixed.png'});
   await p.locator('[data-action="live-start"]').click();await fits('.live-card-play');
   assert.equal(await p.locator('.pcell').count(),18);
   await p.locator('.pcell').first().click();await fits('.live-card-play');
   await p.locator('.live-card-play').click();
   assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('caddiehq_v1')).live.stage),'play');
   assert.equal(await p.locator('body.lvcardfocus').count(),0);
   console.log(`PASS course selection → card → play at ${width}×${height}, with simulated iPhone safe areas`);
   await p.close();
  }
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1)});
