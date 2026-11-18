#!/usr/bin/env node
'use strict';
// Nov 17 2026 sim session → apply-once bay entries, so the day appears in Days /
// Activity, Cumulative, club history and Compare. Practice Lab keeps the batch
// comparison; these entries carry the same shots with the same held/clean call
// (CaddiePracticeLab.calc.classify, Jack's locked Nov 17 lines). Never edits carries.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const PL=require(path.join(root,'practice-lab.js'));
const exp=JSON.parse(fs.readFileSync(path.join(root,'data/practice-lab/lower-hands-2026-11-17.json'),'utf8'));
const LABEL={Mini:'Mini Driver · TrackMan 3w label · 13.5°','5W':'5-wood','4H':'4-hybrid','5i':'5-iron','6i':'6-iron','7i':'7-iron','9i':'9-iron',PW:'PW','56°':'56°'};
const num=v=>typeof v==='number'&&isFinite(v);
const r3=v=>Math.round(v*1000)/1000;
const KEYS=[['carry','carry'],['total','total'],['cs','clubSpeed'],['bs','ballSpeed'],['smash','smash'],['la','launch'],['spin','spin'],['ftp','f2p'],['path','path'],['face','face'],['ld','launchDir'],['apex','apex']];
const entries=[];
for(const b of exp.batches){
  const groups=exp.groups.filter(g=>g.batch===b.id);
  const clubs=[],rangeShots=[];let clean=0,all=0;
  for(const g of groups){
    const c=PL.calc.classify(exp,g,{});
    const label=LABEL[g.club];if(!label)throw Error('No label for '+g.club);
    const shots=c.shots.map(s=>{
      const row={shot:s.n,cs:s.clubSpeed??null,bs:s.ballSpeed??null,smash:s.smash==null?null:Math.round(s.smash*100)/100,
        la:s.launch??null,ld:s.launchDir??null,spin:s.spin??null,carry:s.carry??null,total:s.total??null,
        height:s.apex??null,heightText:num(s.apex)?s.apex+"'":null,path:s.path??null,face:s.face??null,ftp:s.f2p??null,
        videoSource:{file:b.source,row:s.n}};
      if(c.status!=='graded'){row.mishit=false;row.unclassified=true;}
      else if(!s.clean){row.mishit=true;row.mishitReason=s.held.join(' · ');}
      return row;});
    const keep=c.status==='graded'?c.shots.filter(s=>s.clean):[];
    const avg={club:label,n:keep.length,held:c.status==='graded'?g.shots.length-keep.length:0,metricCounts:{}};
    for(const[k,src]of KEYS){const v=keep.map(s=>s[src]).filter(num);avg.metricCounts[k]=v.length;avg[k]=v.length?r3(v.reduce((a,x)=>a+x,0)/v.length):null;}
    clean+=keep.length;all+=g.shots.length;
    clubs.push(avg);
    rangeShots.push({club:label,source:b.source,normalization:'not shown',sourceShotCount:g.shots.length,visibleShotCount:g.shots.length,
      unseenShotNumbers:[],excludedShotNumbers:shots.filter(s=>s.mishit).map(s=>s.shot),
      appHeader:{carry:g.appCarryAvg??null},avg,shots});
  }
  const id='bay-20261117-'+b.id.toLowerCase()+'-v1';
  entries.push({id,type:'bay',src:b.source,bay:{date:'2026-11-17',venue:'TrackMan · sim · Shots table',mode:'Range',unit:'yd',discipline:'swing',
    norm:'not shown in the recording',ball:'not shown',
    setup:'Nov 17 · '+b.label+' · '+b.setup+' · '+all+' shots · off the deck',
    finding:clean+' clean of '+all+' by the Nov 17 lines (woods/hybrids 1.40 · 4–6i 1.22 · 7–9i 1.18 · PW/wedges 1.10) · batch comparison in Progress → Practice Lab',
    detail:{gist:b.label+': '+clean+' clean of '+all+' · '+groups.map(g=>g.club).join(' · '),
      rangeCaption:b.source+' · mishits held out by the Nov 17 lines (no club speed, apex < 40 ft, smash under the club line)',
      clubs,rangeShots,practiceLab:{experiment:exp.id,batch:b.id},
      limits:['Practice Lab is the batch comparison (B1 vs B2 vs B3); this record is the same shots for Days, Cumulative and Compare.','Normalization and ball not shown. Every club off the deck. Playing carries unchanged.']}}});
}
entries.push({id:'history-sim-20261117-v1',type:'history',date:'2026-11-17',text:'Nov 17 sim · Lower Hands Experiment · 110 swings in 3 batches · range day added; playing carries unchanged'});
const out={updated:'2026-11-17',entries};
fs.writeFileSync(path.join(root,'range-20261117-feed.json'),JSON.stringify(out,null,1)+'\n');
console.log(entries.map(e=>e.id+(e.bay?' · '+e.bay.detail.gist:'')).join('\n'));
