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
  const canon=club=>{const base=String(club||'').split('·')[0].trim();return ({'5-iron':'5i','7-iron':'7i','3-wood':'3W','5-wood':'5W','Driver':'Dr','Mini Driver':'Mini'})[base]||base;};
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
    const names={Dr:'Driver',Mini:'Mini Driver','3W':'3-wood','5W':'5-wood','5i':'5-iron','7i':'7-iron'};
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
  function build(day){
    const cards=[];
    const add=(b,kind,score,title,evidence,meaning,action,rows,extra={})=>cards.push({id:`${kind}-${b.id}`,kind,score,title,evidence,meaning,action,rows,blocks:[b],...extra});
    day.clubs.forEach(b=>{
      const ss=b.shots,n=ss.length;if(n<3)return;
      const carry=values(ss,'carry'),total=values(ss,'total');
      const pairs=ss.filter(s=>finite(s.path)&&finite(s.face)&&finite(s.ftp));
      if(pairs.length>=3){
        const p=mean(values(pairs,'path')),f=mean(values(pairs,'face')),ftp=mean(values(pairs,'ftp'));
        const open=pairs.filter(s=>s.ftp>.05).length,closed=pairs.filter(s=>s.ftp<-.05).length;
        const both=open>0&&closed>0,dominant=Math.max(open,closed);
        const direction=dominant/pairs.length>=.75?`${open>=closed?'Open':'Closed'} to path on ${dominant}/${pairs.length}`:both?'Face-to-path varies both ways':'Face-to-path stays near square';
        add(b,'Face & path',75+Math.min(n,12)+Math.min(Math.abs(ftp)*3,15),`${b.club}: ${direction.toLowerCase()}`,
          `Path ${signed(p)}°, face ${signed(f)}°, face-to-path ${signed(ftp)}° across ${pairs.length} paired shots.`,
          `Path is the direction the club travels; face angle is where it points at impact. Positive means right of the target, negative left. Face-to-path compares the face with that travel direction: positive is open, negative closed. ${both?'Both signs occur here, so the average alone hides variation.':'A gap shows the face and path are not pointing together.'} These readings help explain starting direction and curve, but do not prove a body-mechanics fault.`,
          `Hit 10 ${b.club} shots toward one starting-line gate with one intended curve. Count repeated starts and curves; compare the spread of face angle and face-to-path with this block. Keep the strike location in view too.`,
          ['path','face','ftp'].map(k=>({label:{path:'Path',face:'Face',ftp:'Face–path'}[k],unit:'°',dec:1,zero:true,values:values(pairs,k)})));
      }
      if(carry.length>=3){
        const avg=mean(carry),best=mean(carry.slice().sort((a,b)=>b-a).slice(0,carry.length>=5?5:3));
        const delta=best-avg,range=spread(carry);
        add(b,'Carry control',65+Math.min(range/3,18),`${b.club}: ${fmt(avg)} yd carry, ${fmt(range)} yd spread`,
          `${fmt(Math.min(...carry))}–${fmt(Math.max(...carry))} yd across ${carry.length} carries. Best ${Math.min(5,carry.length>=5?5:3)} average ${fmt(best)} yd${total.length?`; total average ${fmt(mean(total))} yd (n=${total.length})`:''}.`,
          `Carry is distance through the air; total includes the simulated finish after landing. The best-shot average is today’s ceiling for this club, not your stock distance. ${delta>=8?`The ${fmt(delta)} yd gap between average and best shots makes repeatability worth testing.`:'The mean sits relatively close to the best shots today.'} A wide carry spread makes front-to-back distance control less predictable. Different targets or effort may contribute, so this is a descriptive full-day average.`,
          `Choose a landing window around ${Math.round(avg/5)*5} yd. Hit 10 ${b.club} shots and count carries within ±10 yd, keeping the same setup. Record that count separately from where the ball finishes.`,
          [{label:'Carry',unit:'yd',dec:1,values:carry}] );
      }
      if(b.target!=null&&b.carryHits&&b.totalHits){
        const ids=new Set(ss.map(s=>s.shot)),ch=b.carryHits.filter(x=>ids.has(x)).length,th=b.totalHits.filter(x=>ids.has(x)).length;
        if(th>ch)add(b,'Landing vs finish',95+(th-ch)*2,`${b.club}: ${th}/${n} finish hits, ${ch}/${n} carry hits`,
          `Recorded TrackMan target ${b.target} yd. Target checkmarks counted only among this block’s ${n} retained shots.`,
          'A finish hit means the ball ended inside the app’s target zone. A carry hit means it landed there. Roll can rescue the finish on the simulator but cannot clear a front bunker or water. These are recorded target-zone hits, not an invented green size.',
          `Repeat 10 shots at ${b.target} yd and score the landing result first. Aim to raise carry-zone hits without counting a rolling finish as a successful carry.`,
          [{label:'Carry distance',unit:'yd',dec:1,values:carry}]);
      }
      const smash=values(ss,'smash');
      if(smash.length>=3&&spread(smash)>=.08){
        add(b,'Strike efficiency',65+Math.min(spread(smash)*70,22),`${b.club}: smash ${fmt(Math.min(...smash),2)}–${fmt(Math.max(...smash),2)}`,
          `${fmt(mean(smash),2)} average from ${smash.length} retained readings.`,
          'Smash factor is ball speed divided by club speed: how much ball speed you produced per unit of swing speed. Variation can flag inconsistent speed transfer, but loft, strike and measurement all matter. It is not a universal grade or proof of heel/toe contact, and wedges should not be compared with woods.',
          `Hit 10 ${b.club} shots at a repeatable effort. Track ball speed, club speed and impact location together. Try to tighten the smash range without chasing maximum swing speed.`,
          [{label:'Smash factor',unit:'',dec:2,values:smash}]);
      }
      const launch=values(ss,'la');
      if(launch.length>=3&&spread(launch)>=3){
        const aoa=values(ss,'aoa');
        add(b,'Flight window',55+Math.min(spread(launch)*2,20),`${b.club}: launch varies ${fmt(spread(launch))}°`,
          `Launch ${fmt(Math.min(...launch))}–${fmt(Math.max(...launch))}°, mean ${fmt(mean(launch))}° (n=${launch.length})${aoa.length?`; attack angle ${signed(mean(aoa))}° (n=${aoa.length})`:''}.`,
          'Launch angle describes how steeply the ball leaves the club. Attack angle describes whether the club is travelling down (negative) or up (positive) at impact. They are different measurements. A changing launch window can change carry and stopping behaviour; these numbers alone do not establish your ideal launch or a swing fix.',
          `Repeat 10 ${b.club} shots with the same ball position and lie. Compare launch, carry and strike together. Test one setup change at a time only after you can repeat the baseline.`,
          [{label:'Launch angle',unit:'°',dec:1,values:launch}]);
      }
      const spin=values(ss,'spin');
      if(spin.length>=3&&spread(spin)>=1000)add(b,'Spin consistency',50+Math.min(spread(spin)/150,20),`${b.club}: ${Math.round(spread(spin))} rpm spin spread`,
        `${Math.round(Math.min(...spin))}–${Math.round(Math.max(...spin))} rpm; ${Math.round(mean(spin))} rpm average from ${spin.length} readings.`,
        'Spin is how quickly the ball rotates. Alongside speed and launch it affects flight and stopping. A broad spread is worth checking, but indoor spin may be estimated; it cannot by itself identify a swing fault or justify changing loft.',
        `Confirm the monitor’s spin-measurement and ball setup first. Then hit 10 ${b.club} shots with the same ball type and lie; compare spin with launch and impact location rather than treating rpm alone as the goal.`,
        [{label:'Spin',unit:'rpm',dec:0,values:spin}]);
    });
    cards.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
    const selected=[];
    // Diversity: one comparison, distinct metrics, and normally no more than two per club.
    for(const c of cards){if(selected.length===6)break;
      if(selected.some(x=>x.kind===c.kind))continue;
      if(selected.filter(x=>x.blocks[0].canon===c.blocks[0].canon).length>=2)continue;
      selected.push(c);
    }
    return selected;
  }
  function plot(row){
    if(!row.values.length)return '';
    const avg=mean(row.values),lo=Math.min(...row.values,...(row.zero?[0]:[])),hi=Math.max(...row.values,...(row.zero?[0]:[]));
    const pad=Math.max((hi-lo)*.1,row.dec===2?.01:row.unit==='rpm'?10:.2),min=lo-pad,max=hi+pad,x=v=>14+(v-min)/(max-min)*272;
    return `<div class="rt-plotlabel"><b>${esc(row.label)}</b><span>${fmt(avg,row.dec)} ${esc(row.unit)} · n=${row.values.length}</span></div><svg viewBox="0 0 300 46" role="img" aria-label="${esc(row.label)}: ${row.values.length} readings, mean ${fmt(avg,row.dec)} ${esc(row.unit)}"><line x1="14" y1="19" x2="286" y2="19" class="rt-axis"/>${row.zero?`<line x1="${x(0)}" x2="${x(0)}" y1="5" y2="31" class="rt-zero"/>`:''}${row.values.map((v,i)=>`<circle cx="${x(v)}" cy="${14+i%3*5}" r="3" class="rt-dot"><title>Retained reading ${i+1}: ${fmt(v,row.dec)} ${esc(row.unit)}</title></circle>`).join('')}<path d="M ${x(avg)} 4 l 4 5 l -4 5 l -4 -5 Z" class="rt-mean"/><text x="14" y="42">${fmt(min,row.dec)}${esc(row.unit)}</text><text x="286" y="42" text-anchor="end">${fmt(max,row.dec)}${esc(row.unit)}</text></svg>`;
  }
  function render(day,cards){
    const source=b=>Number.isInteger(b.index)?`<button data-action="bay-takeaway-source" data-i="${b.index}" data-club="${esc(b.club||'')}">${esc(b.club||b.label)} ↗</button>`:'';
    const sources=c=>c.blocks.flatMap(b=>b.sourceBlocks||[b]);
    return `<section class="round-takeaways bay-takeaways" aria-label="Bay day takeaways"><h2>Your bay day · ${esc(day.date)}</h2><p class="sm">${day.usable} usable shots · ${day.clubs.length} clubs combined from ${day.blocks.length} source blocks. ${day.missing} distance-dash rows excluded; ${day.held} clear mishits held out. One full-day set of numbers per club.</p>${cards.length?`<p class="sm faint">${cards.length} priorities from the full day. Dots = retained readings; diamond = mean. Different targets and effort may contribute to the spread; these are not outdoor stock yardages.</p>`:'<p class="sm">Not enough usable shot-level readings for a reliable takeaway yet. Record at least three distance-bearing shots with the metric you want to compare; summary-only averages cannot establish shot variation.</p>'}${cards.map(c=>`<article class="card rt-card" data-bay-insight="${esc(c.id)}"><div class="rt-kind">${esc(c.kind)}</div><h3>${esc(c.title)}</h3><p>${esc(c.evidence)}</p><div class="rt-plots">${c.rows.map(plot).join('')}</div><div class="bt-meaning"><b>What it means</b><p>${esc(c.meaning)}</p></div><div class="rt-action"><b>Next session</b><span>${esc(c.action)}</span></div><details class="rt-source"><summary>Shots & source blocks</summary>${sources(c).map(b=>`<p>Record ${b.record}: ${esc(b.label||b.club)} · ${esc(b.setup)}. ${b.shots.length} usable / ${b.sourceCount} source rows; ${b.missing} missing-distance, ${b.held} clear-mishit exclusions. Retained source shot IDs: ${b.shots.map(s=>esc(s.shot??'?')).join(', ')}. Conditions: ${esc(b.context)}.</p>`).join('')}<div class="rt-links">${c.blocks.map(source).join('')}</div></details></article>`).join('')}${day.summaryOnly.length?`<details class="rt-source"><summary>${day.summaryOnly.length} summary-only day records</summary><p>Reviewed for coverage but not pooled into shot-level takeaways: no individual carry/total rows were available to apply your exclusions.</p><div class="rt-links">${day.summaryOnly.map(source).join('')}</div></details>`:''}</section>`;
  }
  root.CaddieBayTakeaways={prepare,combine,build,render,mishit};
  if(typeof module!=='undefined')module.exports=root.CaddieBayTakeaways;
})(typeof window!=='undefined'?window:globalThis);
