/* Round-specific evidence and next-session tests. No changes to stored golf data. */
(function(root){
  'use strict';
  const finite=x=>typeof x==='number'&&Number.isFinite(x);
  const avg=xs=>xs.reduce((a,b)=>a+b,0)/xs.length;
  const signed=(n,d=1)=>{const v=Math.abs(n)<.5*10**-d?0:n;return(v>0?'+':'')+v.toFixed(d);};
  const unique=xs=>[...new Set(xs)];
  const clubName=k=>({'56-wedge':'56°','60-wedge':'60°','mini-driver':'Mini Driver',driver:'Driver'}[k]||k);
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const metric=(s,k)=>k==='ftp'&&!finite(s.ftp)&&finite(s.face)&&finite(s.path)?s.face-s.path:s[k];
  const holeList=ss=>unique(ss.map(s=>s.hole).filter(n=>Number.isInteger(n)&&n>0));
  const fmt=(x,d=1)=>x.toFixed(d);
  function scoring(r){
    const all=Array.isArray(r.holes)?r.holes:[];
    const hs=all.filter(h=>finite(h.s)&&h.s>=1&&finite(h.par)&&h.par>0&&Number.isInteger(h.n));
    if(!hs.length||unique(hs.map(h=>h.n)).length!==hs.length)return [];
    const doubles=hs.filter(h=>h.s-h.par>=2),bogeys=hs.filter(h=>h.s-h.par===1);
    const birdies=hs.filter(h=>h.s<h.par),pars=hs.filter(h=>h.s===h.par);
    const complete=hs.length===all.filter(h=>finite(h.s)).length;
    const scoreMatches=complete&&hs.length===all.length&&hs.reduce((n,h)=>n+h.s,0)===r.score;
    const scoreVisual={type:'scores',holes:hs};
    const out=[];
    if(doubles.length){
      const cost=doubles.reduce((n,h)=>n+h.s-h.par,0),save=cost-doubles.length;
      out.push({id:'scoring',kind:'Scoring opportunity',priority:100,
        title:`${doubles.length} holes account for ${cost} shots over par`,
        body:`Your double-or-worse holes were ${doubles.map(h=>'H'+h.n).join(', ')}. Making bogey on each would save ${save} stroke${save===1?'':'s'}${scoreMatches?` on this card (${r.score} → ${r.score-save})`:''}.`,
        action:'Inspect those hole sequences. Choose a safer recovery target when the next shot has a poor lie or blocked route.',
        note:`${hs.length} holes with both score and par. The saving is a scoring scenario, not a prediction.`,holes:doubles.map(h=>h.n),visual:scoreVisual});
    }else if(complete&&hs.length>=3){
      const n=Math.min(2,bogeys.length);
      out.push({id:'scoring',kind:'Scoring strength',priority:90,title:hs.length===all.length?'You kept doubles off the card':`${hs.length} scored holes without a double`,
        body:`${birdies.length} birdie-or-better, ${pars.length} par and ${bogeys.length} bogey holes across ${hs.length} scored holes.`,
        action:n?`Pick ${n} bogey hole${n===1?'':'s'} below to work on. Turning ${n===1?'it':'them'} into par would save ${n} stroke${n===1?'':'s'}${scoreMatches?` (${r.score} → ${r.score-n})`:''}.`:'Repeat the target choices that kept this round at par or better on every scored hole.',
        note:'Based on recorded hole scores and pars; this does not assign the result to a swing cause.',holes:bogeys.map(h=>h.n),visual:scoreVisual});
    }
    // Use adjacent recorded rows, describing the recorded position rather than assuming
    // that the first visible row was a tee shot in a potentially partial shot ledger.
    const shots=r.review?.shots||[],opportunities=[];
    hs.filter(h=>h.s>h.par).forEach(h=>{
      const ss=shots.filter(s=>s.hole===h.n);
      for(let i=0;i<ss.length-1;i++){
        const a=ss[i],b=ss[i+1];
        if(!a.flag&&!b.flag&&a.lie==='fairway'&&finite(a.restYds)&&a.restYds>=80&&a.restYds<=170&&
          ['rough','semi rough','sand','deep rough'].includes(b.lie)){
          opportunities.push({hole:h.n,yards:a.restYds,lie:b.lie});break;
        }
      }
    });
    if(opportunities.length>=2){
      const lo=Math.min(...opportunities.map(x=>x.yards)),hi=Math.max(...opportunities.map(x=>x.yards));
      out.push({id:'approaches',kind:'Scoring opportunity',priority:95,
        title:`${opportunities.length} fairway opportunities ended off the green`,
        body:`From ${lo}–${hi} yards in the fairway, the next recorded shot finished off the green on ${opportunities.map(x=>'H'+x.hole).join(', ')}. Each hole finished over par.`,
        action:`Practice 10 approaches at ${Math.round(avg(opportunities.map(x=>x.yards))/5)*5} yards. Aim at the center of the green and record green hits plus finishing distance.`,
        note:'A recorded sequence identifies an opportunity; it does not establish why the approach missed.',holes:opportunities.map(x=>x.hole),
        visual:{type:'positions',rows:opportunities.map(x=>({label:'H'+x.hole,value:x.yards,unit:'yd',detail:x.lie}))}});
    }else{
      const groups=[3,4,5].map(p=>({p,hs:hs.filter(h=>h.par===p)})).filter(g=>g.hs.length>=3);
      groups.forEach(g=>g.over=g.hs.reduce((n,h)=>n+h.s-h.par,0));
      groups.sort((a,b)=>b.over-a.over);
      const worst=groups[0];
      if(worst?.over>0&&groups.length>=2)out.push({id:'par-split',kind:'Scoring pattern',priority:60,
        title:`Par ${worst.p}s contributed ${signed(worst.over,0)}`,
        body:`${worst.over} over par across ${worst.hs.length} par-${worst.p} holes, the largest contribution among your recorded par groups.`,
        action:`Start your review with the over-par par-${worst.p} holes. Identify whether the next practice target should be the tee shot, approach or recovery.`,
        note:`${hs.length} scored holes with known par; partial cards describe only the holes shown.`,holes:worst.hs.filter(h=>h.s>h.par).map(h=>h.n),
        visual:{type:'positions',rows:groups.sort((a,b)=>a.p-b.p).map(g=>({label:'Par '+g.p,value:g.over,unit:'vs par',detail:g.hs.length+' holes'}))}});
    }
    return out.sort((a,b)=>b.priority-a.priority).slice(0,2);
  }
  const METRICS=[
    {key:'carry',name:'Carry',unit:'yd',dec:1,minSpread:10,action:'Use the same target and club for 10 shots. Record the carry spread and the number finishing on the green.'},
    {key:'smash',name:'Smash factor',unit:'',dec:2,minSpread:.08,action:'Record club speed, ball speed and impact location for 10 shots with this club. Check whether ball speed becomes more consistent at similar club speed.'},
    {key:'cs',name:'Club speed',unit:'mph',dec:1,minSpread:5,action:'Hit 10 shots with the same club and intended swing length. Compare speed variation with carry and strike location.'},
    {key:'bs',name:'Ball speed',unit:'mph',dec:1,minSpread:8,action:'Record club speed and impact location alongside ball speed on the next 10 shots. Check which changes together.'},
    {key:'la',name:'Launch angle',unit:'°',dec:1,minSpread:3,action:'Repeat 10 shots with the same club, ball and lie. Record launch, carry and strike location to check whether this spread repeats.'},
    {key:'spin',name:'Spin',unit:'rpm',dec:0,minSpread:1000,action:'Repeat with the same club, ball and lie. Keep spin and carry together in the record and confirm whether spin is measured or estimated.'}
  ];
  function dataFindings(ps){
    const delivery=[],metrics=[];
    ps.forEach(p=>{
      // Unknown-intent wedge shots can be chips; never mix them with full-swing data.
      if(!/^(driver|mini-driver|\d+-wood|\d+-iron|\d+-wedge)$/.test(p.club))return;
      const ss=p.full.filter(s=>!s.flag&&(s.intent==='full'||(p.labelOnly&&s.intent==='unknown'&&!/wedge/.test(p.club))));
      if(ss.length<3)return;
      const provisional=p.labelOnly;
      const name=clubName(p.club),context=provisional?'selected-label shots; swing intent unconfirmed':'identified full shots';
      const baseline=!provisional?p.bay:null;
      const baseNote=baseline?` Range reference: ${p.bayLabel||p.bayDate||'dated source'}${p.bayDate?' ('+p.bayDate+')':''}, ${baseline.n??'unknown'} retained shots; individual metric counts can be smaller. Different lies and session conditions can affect the result.`:'';
      const sampleNote=`${ss.length} ${context}${p.excluded.length?`; ${p.excluded.length} extreme short/flagged mishits excluded from these club averages`:''}.`;
      const pairs=ss.filter(s=>finite(s.path)&&finite(s.face)&&finite(metric(s,'ftp')));
      if(pairs.length>=3){
        const values=Object.fromEntries(['path','face','ftp'].map(k=>[k,avg(pairs.map(s=>metric(s,k)))]));
        const right=pairs.filter(s=>metric(s,'ftp')>0).length,left=pairs.filter(s=>metric(s,'ftp')<0).length;
        const dominant=Math.max(right,left),side=right>=left?'right':'left';
        const phrase=dominant/pairs.length>=.75?`face ${side} of path on ${dominant}/${pairs.length}`
          :right&&left?'face-to-path crossed both sides'
          :dominant?`${dominant}/${pairs.length} readings ${side} of path; the rest square`:'face-to-path stayed at zero';
        const bftp=baseline&&(finite(baseline.ftp)?baseline.ftp:finite(baseline.face)&&finite(baseline.path)?baseline.face-baseline.path:null);
        const compare=finite(bftp)?` The dated range average was ${signed(bftp)}° face-to-path.`:'';
        const faceDirection=Math.abs(values.face)<.05?'at the target':`${values.face<0?'left':'right'} of the target`;
        const relation=Math.abs(values.ftp)<.05?'square to the path':`${values.ftp<0?'left':'right'} of the path`;
        delivery.push({id:'delivery-'+p.club,kind:'Face & path'+(provisional?' · selected club':''),priority:70+Math.min(pairs.length,12)+Math.abs(values.ftp),
          title:`${name}: ${phrase}`,
          body:`Across ${pairs.length} paired readings, path averaged ${signed(values.path)}°, face ${signed(values.face)}° and face-to-path ${signed(values.ftp)}°. The face averaged ${faceDirection}, and ${relation}.${compare}`,
          action:`For your next 10 ${name} shots, choose one starting line and intended curve. Count how often you repeat them, then compare face angle and face-to-path with this round.`,
          note:sampleNote+' Path and face use the target as zero; face-to-path uses the club path. Positive means right, negative left. Face can be derived from path plus face-to-path.'+baseNote,
          holes:holeList(pairs),visual:{type:'delivery',rows:['path','face','ftp'].map(k=>({key:k,label:{path:'Path',face:'Face',ftp:'Face–path'}[k],values:pairs.map(s=>({hole:s.hole,value:metric(s,k)})),average:values[k],reference:k==='ftp'?bftp:baseline?.[k]}))}});
      }else{
        // A missing companion metric must not hide a usable path/face reading. Show
        // one available angular series without pretending it is a paired comparison.
        const choices=['path','face','ftp'].map(k=>({k,rows:ss.filter(s=>finite(metric(s,k)))})).filter(x=>x.rows.length>=3).sort((a,b)=>b.rows.length-a.rows.length);
        const best=choices[0];
        if(best){
          const labels={path:'Club path',face:'Face angle',ftp:'Face-to-path'},nameOf=labels[best.k];
          const average=avg(best.rows.map(s=>metric(s,best.k)));
          delivery.push({id:'delivery-'+p.club,kind:nameOf+(provisional?' · selected club':''),priority:65+Math.min(best.rows.length,12)+Math.abs(average),
            title:`${name}: ${nameOf.toLowerCase()} averaged ${signed(average)}°`,
            body:`${best.rows.length} recorded ${nameOf.toLowerCase()} readings. ${best.k==='ftp'?'Positive is face right of path; negative is face left of path.':'Positive points right of the target; negative points left.'}`,
            action:`Repeat 10 ${name} shots on one starting line. Capture both path and face next time so you can check their relationship as well as this individual reading.`,
            note:sampleNote+' Fewer than three complete path/face pairs were available, so no paired delivery comparison is made.'+baseNote,
            holes:holeList(best.rows),visual:{type:'delivery',rows:[{key:best.k,label:nameOf,values:best.rows.map(s=>({hole:s.hole,value:metric(s,best.k)})),average,reference:baseline?.[best.k]}]}});
        }
      }
      METRICS.forEach(m=>{
        const readings=ss.filter(s=>finite(metric(s,m.key))),values=readings.map(s=>metric(s,m.key));
        if(values.length<3)return;
        const lo=Math.min(...values),hi=Math.max(...values),average=avg(values),spread=hi-lo;
        const ref=baseline?.[m.key];
        const notable=spread>=m.minSpread||(finite(ref)&&Math.abs(average-ref)>=m.minSpread/2);
        if(!notable)return;
        metrics.push({id:m.key+'-'+p.club,kind:m.name+(provisional?' · selected club':''),metricKey:m.key,club:p.club,priority:40+Math.min(values.length,12)+Math.min(spread/m.minSpread,4)*5,
          title:`${name}: ${m.name.toLowerCase()} ranged ${fmt(lo,m.dec)}–${fmt(hi,m.dec)}${m.unit?' '+m.unit:''}`,
          body:`${fmt(average,m.dec)}${m.unit?' '+m.unit:''} average from ${values.length} readings.${finite(ref)?` The dated range mean was ${fmt(ref,m.dec)}${m.unit?' '+m.unit:''}.`:''}${m.key==='carry'?' These are carry distances; total distance is kept separately.':''}`,
          action:m.action,note:sampleNote+baseNote+(m.key==='spin'?' Simulator spin may be estimated; this spread alone does not identify a swing fault.':''),
          holes:holeList(readings),visual:{type:'dots',label:m.name,unit:m.unit,dec:m.dec,values:readings.map(s=>({hole:s.hole,value:metric(s,m.key)})),average,reference:ref}});
      });
    });
    delivery.sort((a,b)=>b.priority-a.priority);
    metrics.sort((a,b)=>b.priority-a.priority);
    const selected=[];
    for(const c of metrics)if(selected.length<2&&!selected.some(x=>x.metricKey===c.metricKey))selected.push(c);
    return [...delivery.slice(0,2),...selected];
  }
  function build(r,ps=[]){return [...scoring(r),...dataFindings(ps)];}
  function plotRow(row,domain,unit,dec=1){
    const [lo,hi]=domain,scale=v=>14+(v-lo)/(hi-lo)*272;
    return `<svg viewBox="0 0 300 46" role="img" aria-label="${esc(row.label)}: ${row.values.length} readings, average ${row.average.toFixed(dec)} ${esc(unit)}"><line x1="14" y1="19" x2="286" y2="19" class="rt-axis"/>${lo<0&&hi>0?`<line x1="${scale(0)}" y1="7" x2="${scale(0)}" y2="30" class="rt-zero"/>`:''}${finite(row.reference)?`<rect x="${scale(row.reference)-4}" y="15" width="8" height="8" class="rt-ref"><title>Range mean ${row.reference.toFixed(dec)} ${esc(unit)}</title></rect>`:''}${row.values.map((v,i)=>`<circle cx="${scale(v.value)}" cy="${14+i%3*5}" r="3" class="rt-dot"><title>Hole ${v.hole}: ${v.value.toFixed(dec)} ${esc(unit)}</title></circle>`).join('')}<path d="M ${scale(row.average)} 4 l 4 5 l -4 5 l -4 -5 Z" class="rt-mean"/><text x="14" y="42">${lo.toFixed(dec)}${esc(unit)}</text><text x="286" y="42" text-anchor="end">${hi.toFixed(dec)}${esc(unit)}</text></svg>`;
  }
  function visual(v){
    if(v.type==='scores')return `<div class="rt-scores" aria-label="Score by hole">${v.holes.map(h=>`<button class="rt-hole ${h.s<h.par?'rt-under':h.s===h.par?'rt-par':h.s-h.par===1?'rt-bogey':'rt-double'}" data-action="review-hole" data-hole="${h.n}" aria-label="Hole ${h.n}: ${h.s} on par ${h.par}"><small>${h.n}</small><b>${h.s-h.par===0?'E':signed(h.s-h.par,0)}</b></button>`).join('')}</div>`;
    if(v.type==='positions')return `<div class="rt-positions">${v.rows.map(x=>`<span><b>${esc(x.label)} · ${x.value} ${esc(x.unit)}</b><small>${esc(x.detail)}</small></span>`).join('')}</div>`;
    if(v.type==='delivery'){
      const bound=Math.ceil(Math.max(1,...v.rows.flatMap(r=>[...r.values.map(x=>Math.abs(x.value)),finite(r.reference)?Math.abs(r.reference):0]))+1);
      return `<div class="rt-plots">${v.rows.map(r=>`<div class="rt-plotlabel"><b>${esc(r.label)}</b><span>${signed(r.average)}° · n=${r.values.length}</span></div>${plotRow(r,[-bound,bound],'°')}`).join('')}</div>`;
    }
    const all=[...v.values.map(x=>x.value),...(finite(v.reference)?[v.reference]:[])];
    const lo=Math.min(...all),hi=Math.max(...all),pad=Math.max((hi-lo)*.08,v.unit==='rpm'?10:.01);
    return `<div class="rt-plots">${plotRow(v,[lo-pad,hi+pad],v.unit,v.dec)}</div>`;
  }
  function render(items){
    if(!items.length)return '';
    return `<section class="round-takeaways" aria-label="Round takeaways"><h2>${items.length} takeaways · your round</h2>${items.map(x=>`<article class="card rt-card" data-insight="${esc(x.id)}"><div class="rt-kind">${esc(x.kind)}</div><h3>${esc(x.title)}</h3><p>${esc(x.body)}</p>${visual(x.visual)}${['delivery','dots'].includes(x.visual.type)?'<div class="rt-key">Dots: shots · diamond: round mean · square: range mean when available</div>':''}<div class="rt-action"><b>Next step</b><span>${esc(x.action)}</span></div><div class="rt-links">${x.holes.map(h=>`<button data-action="review-hole" data-hole="${h}">Hole ${h} ↗</button>`).join('')}</div><details class="rt-source"><summary>Samples & context</summary><p>${esc(x.note)}</p></details></article>`).join('')}</section>`;
  }
  root.CaddieTakeaways={build,render};
  if(typeof module!=='undefined')module.exports=root.CaddieTakeaways;
})(typeof window!=='undefined'?window:globalThis);
