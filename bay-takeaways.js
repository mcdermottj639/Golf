/* Full-day range insights. Pure calculation; never edits stored shots or playing carries. */
(function(root){
  'use strict';
  const finite=x=>typeof x==='number'&&Number.isFinite(x);
  const mean=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
  const median=xs=>{const a=xs.slice().sort((a,b)=>a-b),i=Math.floor(a.length/2);return a.length?(a.length%2?a[i]:(a[i-1]+a[i])/2):null;};
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=(v,d=1)=>v.toFixed(d);
  const signed=v=>(Math.abs(v)<.05?'0.0':(v>0?'+':'')+v.toFixed(1));
  const values=(ss,k)=>ss.map(s=>s[k]).filter(finite);
  const spread=xs=>Math.max(...xs)-Math.min(...xs);
  const canon=club=>{const base=String(club||'').split('·')[0].trim();if(/^\d+-iron$/.test(base))return base.replace('-iron','i');return ({'5-iron':'5i','7-iron':'7i','3-wood':'3W','5-wood':'5W','Driver':'Dr','Mini Driver':'Mini'})[base]||base;};
  function mishit(s,shots){
    if(s.mishit===true)return true;
    const xs=values(shots,'carry');if(xs.length<3||!finite(s.carry))return false;
    const m=median(xs),cluster=xs.filter(x=>x>=m*.5);
    return m>0&&s.carry<median(cluster.length>=2?cluster:xs)*2/3;
  }
  function prepare(date,bays,isMishit=mishit){
    const blocks=[],summaryOnly=[],seen=new Set();let raw=0,missing=0,held=0;
    (bays||[]).filter(b=>b.date===date&&(!b.discipline||b.discipline==='swing')).forEach((b,i)=>{
      const id=b._fid||`local-${b.index??i}`;
      if(seen.has(id))return;seen.add(id);
      const groups=b.detail?.rangeShots||[];
      if(!groups.length){summaryOnly.push({index:b.index,label:b.setup||b.venue||'Summary-only session'});return;}
      groups.forEach((g,j)=>{
        const source=Array.isArray(g.shots)?g.shots:[];
        const distance=source.filter(s=>finite(s.carry)||finite(s.total));
        const retained=distance.filter(s=>!isMishit(s,distance));
        const archivedMissing=Array.isArray(g.distanceMissingShotNumbers)?g.distanceMissingShotNumbers.length:0;
        raw+=source.length+archivedMissing;missing+=source.length-distance.length+archivedMissing;held+=distance.length-retained.length;
        const shots=retained.map(s=>({...s,ftp:finite(s.ftp)?s.ftp:finite(s.face)&&finite(s.path)?s.face-s.path:null}));
        const label=(g.club||'Unlabelled club')+(finite(g.target)&&!String(g.club).includes('target')?` · target ${g.target}`:'');
        blocks.push({id:`${id}-${j}`,club:g.club||'Unlabelled club',label,record:seen.size,canon:g.canon||canon(g.club),target:finite(g.target)?g.target:null,
          index:b.index,setup:b.setup||b.venue||'',shots,sourceCount:source.length+archivedMissing,
          missing:source.length-distance.length+archivedMissing,held:distance.length-retained.length,
          carryHits:Array.isArray(g.carryHits)?g.carryHits:null,totalHits:Array.isArray(g.totalHits)?g.totalHits:null,
          context:[b.ball,b.norm,b.spin,b.venue].map(x=>x||'not recorded').join(' / ')});
      });
    });
    const day={date,blocks,summaryOnly,raw,missing,held,usable:blocks.reduce((n,b)=>n+b.shots.length,0),sessions:seen.size};
    day.clubs=combine(blocks);
    return day;
  }
  function combine(blocks){
    const by=new Map();
    const names={Dr:'Driver',Mini:'Mini Driver','3W':'3-wood','5W':'5-wood',...Object.fromEntries([2,3,4,5,6,7,8,9].map(n=>[n+'i',n+'-iron']))};
    for(const b of blocks){
      const key=b.canon||b.club;
      if(!by.has(key))by.set(key,{id:`club-${key}`,club:names[key]||key,canon:key,index:b.index,shots:[],sourceBlocks:[],
        sourceCount:0,missing:0,held:0,carryHits:[],totalHits:[],targets:[],setup:'Combined full-day club data',context:'See original source blocks',retainedOnly:true});
      const c=by.get(key);c.sourceBlocks.push(b);c.sourceCount+=b.sourceCount;c.missing+=b.missing;c.held+=b.held;
      if(b.target!=null)c.targets.push(b.target);
      for(const s of b.shots){
        const shot=c.shots.length+1;
        c.shots.push({...s,shot,sourceShot:s.shot,sourceClub:b.club,sourceRecord:b.record,sourceIndex:b.index});
        if(b.carryHits?.includes(s.shot))c.carryHits.push(shot);
        if(b.totalHits?.includes(s.shot))c.totalHits.push(shot);
      }
      if(b.carryHits==null)c.carryHitsKnown=false;
      if(b.totalHits==null)c.totalHitsKnown=false;
    }
    return [...by.values()].map(c=>({...c,label:c.club,target:c.targets.length===c.sourceBlocks.length&&new Set(c.targets).size===1?c.targets[0]:null,
      carryHits:c.carryHitsKnown===false?null:c.carryHits,totalHits:c.totalHitsKnown===false?null:c.totalHits}));
  }
  const tourSource='https://www.trackman.com/blog/introducing-updated-tour-averages';
  const tour={
    Dr:[115,282,1.49,10.4,2545], '3W':[110,249,1.47,9.3,3663],
    '5W':[106,236,1.47,9.7,4322], '3i':[100,218,1.46,10.3,4404],
    '4i':[98,209,1.44,10.8,4782], '5i':[96,199,1.41,11.9,5280],
    '6i':[94,188,1.39,14.0,6204], '7i':[92,176,1.34,16.1,7124],
    '8i':[89,164,1.33,17.8,8078], '9i':[87,152,1.29,20.0,8793],
    PW:[84,142,1.24,23.7,9316]
  };

  // Selection gates are editorial, not confidence intervals or causal tests.
  function windowGroup(shots,key,width){
    const sorted=shots.filter(s=>finite(s[key])).slice().sort((a,b)=>a[key]-b[key]);
    let best=[];
    for(let i=0;i<sorted.length;i++){
      const group=sorted.slice(i).filter(s=>s[key]-sorted[i][key]<=width+1e-9);
      if(group.length>best.length)best=group;
    }
    return best;
  }
  const direction=s=>typeof s==='string'&&/[LR]$/.test(s.trim())?s.trim().slice(-1):null;
  const extent=(ss,key,dec=1)=>`${fmt(Math.min(...values(ss,key)),dec)}–${fmt(Math.max(...values(ss,key)),dec)}`;
  function reference(b){
    const t=tour[b.canon];
    return t?`PGA Tour ${b.club}: ${t[1]} yd carry at ${t[0]} mph; smash ${t[2].toFixed(2)} (2023). Context, not your target.`:
      `No matching ${b.club} row in the cited Tour table. This practice baseline comes from your shots.`;
  }
  const feet=s=>{const m=typeof s==='string'&&s.match(/^(\d+)'(?:(\d+(?:\.\d+)?)")?[LR]$/);return m?Number(m[1])+Number(m[2]||0)/12:null;};
  function flightEvidence(ss){
    const measured=ss.filter(s=>direction(s.curve)),left=measured.filter(s=>direction(s.curve)==='L').length,right=measured.length-left;
    const paired=measured.filter(s=>finite(s.ftp)),open=paired.filter(s=>s.ftp>.05).length;
    const contradictions=paired.filter(s=>s.ftp>.05&&direction(s.curve)==='L'||s.ftp<-.05&&direction(s.curve)==='R').length;
    return {n:measured.length,left,right,paired:paired.length,open,contradictions,material:measured.filter(s=>feet(s.curve)>=10).length};
  }
  function build(day){
    if(!day)return [];
    const candidates=[];
    for(const club of day.clubs){
      // Never infer that separate source blocks have the same intent/setup.
      for(const block of club.sourceBlocks){
        const b={...block,club:club.club,canon:club.canon,sourceBlocks:[block]},ss=block.shots;
        const carryShots=ss.filter(s=>finite(s.carry)),carries=values(carryShots,'carry');
        if(carries.length<3)continue;
        const avg=mean(carries),cg=windowGroup(carryShots,'carry',5),cluster=cg.length>=4&&cg.length/carries.length>=.75;
        const target=(cluster?Math.ceil(mean(values(cg,'carry'))/5):Math.round(avg/5))*5;
        const flight=flightEvidence(ss),speed=carryShots.filter(s=>finite(s.cs)&&finite(s.bs)&&finite(s.smash));
        const scoped=club.sourceBlocks.length>1?`One source block: ${ss.length} retained shots; full-day club total ${club.shots.length}. `:'';
        const add=(kind,score,title,evidence,meaning,action,track,extra={})=>{
          const c={id:`${kind}-${block.id}`,kind,score,title:`${club.club}: ${title}`,evidence,meaning,action,track,blocks:[b],
            scope:scoped,smallSample:ss.length<10,reference:reference(b),referenceSource:tourSource,
            rows:[{label:'Carry',unit:'yd',dec:1,values:carries}],
            practice:{heading:`${club.club} · ${title}`,evidence:evidence+' '+meaning,test:action,track,input:'count',max:10},...extra};
          candidates.push(c);
        };
        // Stable speed + materially different carry: illustrate with same-speed paired rows.
        if(speed.length>=5&&spread(values(speed,'cs'))<=median(values(speed,'cs'))*.05&&spread(values(speed,'carry'))>=median(values(speed,'carry'))*.15){
          let pair=null;
          for(let i=0;i<speed.length;i++)for(let j=i+1;j<speed.length;j++){
            const a=speed[i],b=speed[j];
            if(Math.abs(a.cs-b.cs)>.5)continue;
            const gap=Math.abs(a.carry-b.carry);
            if(!pair||gap>pair.gap)pair={lo:a.carry<=b.carry?a:b,hi:a.carry<=b.carry?b:a,gap};
          }
          if(pair&&pair.gap>=median(values(speed,'carry'))*.15&&pair.hi.bs-pair.lo.bs>=3){
            const a=pair.lo,z=pair.hi,same=Math.abs(a.cs-z.cs)<.05;
            add('Delivery consistency',100,'repeat delivery before adding speed',
              `Shots ${a.shot} and ${z.shot}: ${same?`both ${fmt(a.cs)}`:`${fmt(a.cs)} / ${fmt(z.cs)}`} mph, but ${fmt(a.carry)} / ${fmt(z.carry)} yd carry. Ball speed: ${fmt(a.bs)} / ${fmt(z.bs)} mph.`,
              `Across ${speed.length} paired shots, swing speed spans only ${fmt(spread(values(speed,'cs')))} mph. Delivery and speed transfer deserve attention before extra effort; this does not identify a mechanical fault.`,
              `Hit 10 ${club.club} shots at steady effort. Display club speed, ball speed and carry; check whether shorter shots also lose ball speed at similar swing speed.`,
              'Save all 10 rows; compare carry spread within similar speeds.',
              {pair:{shots:[a.shot,z.shot],carryGap:pair.gap},practice:{heading:`${club.club} · Repeat delivery`,evidence:`${fmt(pair.gap)} yd carry difference at similar club speed.`,test:`Hit 10 ${club.club} shots at steady effort. Record club speed, ball speed and carry.`,track:'Enter low/high carry for shots within a 3 mph club-speed window; save all attempts.',input:'range',max:10}});
          }
        }
        // Select a speed group using speed ONLY, before looking at its carry.
        const speedCarry=carryShots.filter(s=>finite(s.cs)),sg=windowGroup(speedCarry,'cs',3);
        if(speedCarry.length===carries.length&&speedCarry.length>=5&&sg.length>=4&&sg.length/speedCarry.length>=.7&&sg.length<speedCarry.length){
          const other=speedCarry.filter(s=>!sg.includes(s)),sa=mean(values(sg,'carry'));
          if(other.every(s=>s.cs<Math.min(...values(sg,'cs')))&&sa-avg>=3){
            const curve=flight.n>=3?` Actual curves: ${flight.left} left / ${flight.right} right.`:'';
            add('Speed group',95,'separate speed changes from carry consistency',
              `${sg.length}/${speedCarry.length} paired shots at ${extent(sg,'cs')} mph carried ${extent(sg,'carry')} yd (${fmt(sa)} average).`,
              `The ${other.length} slower ${other.length===1?'shot pulls':'shots pull'} the full ${carries.length}-shot mean to ${fmt(avg)} yd.${curve} Use the speed group as a provisional practice reference, not a new stock carry.`,
              `Hit 10 ${club.club} shots at one intended effort and unchanged club setting. Record carry, club speed and actual curve; compare the similar-speed group with this baseline.`,
              `Count carries in the observed ${extent(sg,'carry')} yd window out of all 10 attempts; also save speeds and curve.`,
              {group:{n:sg.length,mean:sa,low:Math.min(...values(sg,'carry')),high:Math.max(...values(sg,'carry'))},flight});
          }
        }
        if(finite(b.target)&&Math.max(...carries)<b.target&&b.target-avg>=10){
          const cgMean=cluster?mean(values(cg,'carry')):avg;
          add('Target fit',90,`establish your carry before chasing ${b.target} yd`,
            cluster?`${cg.length}/${carries.length} carries cluster at ${extent(cg,'carry')} yd (${fmt(cgMean)} average); all retained carries are below the ${b.target} yd screen target.`:
              `Your ${carries.length} carries average ${fmt(avg)} yd; even the longest (${fmt(Math.max(...carries))}) is below the ${b.target} yd screen target.`,
            `The selected target is beyond this sample. First test a repeatable landing distance; the longest shot is not established stock carry.`,
            `Hit 10 ${club.club} shots at a ${target} yd on-screen target using the same intended effort. Count carries from ${target-5}–${target+5} yd, including mishits as attempts.`,
            `Landings in ${target-5}–${target+5} yd out of 10. This is a proposed practice window.`,
            {targetYds:target,cluster:cluster?{n:cg.length,mean:cgMean}:null});
        }else if(cluster&&cg.length<carries.length){
          add('Carry group',80,'calibrate the distance you repeat most often',
            `${cg.length}/${carries.length} shots carry ${extent(cg,'carry')} yd (${fmt(mean(values(cg,'carry')))} average); the full sample spans ${extent(carryShots,'carry')} yd.`,
            'The overall mean blends the main group with other valid shots. Test whether the group repeats before using it as a playing yardage.',
            `Hit 10 ${club.club} shots at ${target} yd with one intended effort. Count all attempts in ${target-5}–${target+5} yd.`,
            `Proposed practice window: ${target-5}–${target+5} yd; record hits out of 10.`,{targetYds:target});
        }
        if(flight.material>=3&&(flight.left&&flight.right||flight.contradictions||Math.max(flight.left,flight.right)/flight.n>=.8)){
          add('Observed flight',85,flight.left&&flight.right?'address the measured two-way curve':'check your repeated curve against your intended shot',
            `${flight.n} recorded curves: ${flight.left} left / ${flight.right} right.`+(flight.paired>=3?` Face-to-path is open on ${flight.open}/${flight.paired} of those shots.`:''),
            flight.contradictions?'Recorded curve does not always follow the face-to-path prediction. Check strike and the monitor readings before making a face correction; the cause is not established.':
              'Compare this pattern with your intended shot. A repeated curve can be playable; a straight-shot target needs a different test.',
            `Hit 10 ${club.club} shots toward one on-screen start line with one intended curve. Count actual starts and curves; record impact location if available.`,
            'Count shots matching your intended start and curve out of all 10.',{flight});
        }
        const roll=ss.filter(s=>finite(s.carry)&&finite(s.total)),rollAvg=mean(roll.map(s=>s.total-s.carry));
        if(roll.length>=3&&rollAvg>=15){
          add('Carry vs roll',60,'plan forced carries from the landing distance',
            `Paired shots average ${fmt(mean(values(roll,'carry')))} yd carry and ${fmt(mean(values(roll,'total')))} yd total: ${fmt(rollAvg)} yd after landing.`,
            'The simulator finish overstates the distance you cleared through the air. For a front hazard, judge the landing; this is not an outdoor rollout forecast.',
            `Hit 10 ${club.club} shots at a ${target} yd landing target. Score carry in ${target-10}–${target+10} yd without using total distance.`,
            `Proposed landing-window hits out of 10: ${target-10}–${target+10} yd.`,{targetYds:target});
        }
      }
    }
    candidates.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
    const primary=[],more=[],clubs=new Set();
    for(const c of candidates){
      if(primary.length<3&&!clubs.has(c.blocks[0].canon)){primary.push(c);clubs.add(c.blocks[0].canon);}
      else more.push(c);
    }
    // One secondary decision per club; no repeated cards for multiple source blocks.
    const extra=[],seen=new Set();
    for(const c of more.slice().sort((a,b)=>(b.kind==='Observed flight')-(a.kind==='Observed flight')||b.score-a.score||a.id.localeCompare(b.id))){if(!seen.has(c.blocks[0].canon)&&!primary.some(p=>p.kind===c.kind&&p.blocks[0].canon===c.blocks[0].canon)){extra.push({...c,secondary:true});seen.add(c.blocks[0].canon);}}
    return primary.concat(extra.slice(0,3));
  }
  function plot(row){
    if(!row.values.length)return '';
    const avg=mean(row.values),lo=Math.min(...row.values,...(row.zero?[0]:[])),hi=Math.max(...row.values,...(row.zero?[0]:[]));
    const pad=Math.max((hi-lo)*.1,row.dec===2?.01:row.unit==='rpm'?10:.2),min=lo-pad,max=hi+pad,x=v=>14+(v-min)/(max-min)*272;
    return `<div class="rt-plotlabel"><b>${esc(row.label)}</b><span>${fmt(avg,row.dec)} ${esc(row.unit)} · n=${row.values.length}</span></div><svg viewBox="0 0 300 46" role="img" aria-label="${esc(row.label)}: ${row.values.length} readings, mean ${fmt(avg,row.dec)} ${esc(row.unit)}"><line x1="14" y1="19" x2="286" y2="19" class="rt-axis"/>${row.zero?`<line x1="${x(0)}" x2="${x(0)}" y1="5" y2="31" class="rt-zero"/>`:''}${row.values.map((v,i)=>`<circle cx="${x(v)}" cy="${14+i%3*5}" r="3" class="rt-dot"><title>Retained reading ${i+1}: ${fmt(v,row.dec)} ${esc(row.unit)}</title></circle>`).join('')}<path d="M ${x(avg)} 4 l 4 5 l -4 5 l -4 -5 Z" class="rt-mean"/><text x="14" y="42">${fmt(min,row.dec)}${esc(row.unit)}</text><text x="286" y="42" text-anchor="end">${fmt(max,row.dec)}${esc(row.unit)}</text></svg>`;
  }
  function render(day,cards){
    const source=b=>Number.isInteger(b.index)?`<button data-action="bay-takeaway-source" data-i="${b.index}" data-club="${esc(b.club||'')}">${esc(b.club||b.label)} ↗</button>`:'';
    const article=c=>`<article class="card rt-card" data-bay-insight="${esc(c.id)}"><div class="rt-kind">${esc(c.kind)}${c.smallSample?' · small sample':''}</div><h3>${esc(c.title)}</h3><div class="bt-meaning"><b>Why this matters</b><p>${esc(c.evidence)} ${esc(c.meaning)}</p></div><div class="rt-action"><b>Next test</b><span>${esc(c.action)}</span></div>${c.scope?`<p class="bt-scope">${esc(c.scope)}</p>`:''}<details class="rt-source"><summary>Numbers, reference & sources</summary><div class="rt-plots">${c.rows.map(plot).join('')}</div><p class="bt-reference">${esc(c.reference)} <a href="${esc(c.referenceSource)}" target="_blank" rel="noopener noreferrer">Trackman reference ↗</a></p><p>${esc(c.track)}</p>${c.blocks.flatMap(b=>b.sourceBlocks||[b]).map(b=>`<p>Record ${b.record}: ${esc(b.label||b.club)} · ${esc(b.setup)}. ${b.shots.length} usable / ${b.sourceCount} source rows; ${b.missing} missing-distance, ${b.held} clear-mishit exclusions. Source shot IDs: ${b.shots.map(s=>esc(s.shot??'?')).join(', ')}. Conditions: ${esc(b.context)}.</p>`).join('')}<div class="rt-links">${c.blocks.map(source).join('')}</div></details></article>`;
    const primary=cards.filter(c=>!c.secondary),more=cards.filter(c=>c.secondary);
    return `<section class="round-takeaways bay-takeaways" aria-label="Bay day takeaways"><h2>Your bay day · ${esc(day.date)}</h2><p class="sm">${day.usable} usable shots · ${day.clubs.length} clubs combined from ${day.blocks.length} source blocks. ${day.missing} distance-dash rows excluded; ${day.held} clear mishits held out.</p><p class="sm faint">Indoor practice evidence, not outdoor stock yardages. Each finding uses one source block; different settings or targets are not pooled into a diagnosis.</p>${primary.length?primary.map(article).join(''):'<p class="sm">No clear practice priority supported by these shots yet. The exact data remains below; more comparable shots can reveal a repeatable pattern.</p>'}${more.length?`<details class="bt-more"><summary>More findings · ${more.length}</summary>${more.map(article).join('')}</details>`:''}${day.summaryOnly.length?`<details class="rt-source"><summary>${day.summaryOnly.length} summary-only day records</summary><p>No individual distance-bearing shots available for the exclusion and relationship checks.</p><div class="rt-links">${day.summaryOnly.map(source).join('')}</div></details>`:''}</section>`;
  }
  root.CaddieBayTakeaways={prepare,combine,build,render,mishit};
  if(typeof module!=='undefined')module.exports=root.CaddieBayTakeaways;
})(typeof window!=='undefined'?window:globalThis);
