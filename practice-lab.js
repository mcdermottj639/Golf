/* practice-lab.js — Caddie HQ Practice Lab (v295, Nov 17 2026).
 *
 * Swing/equipment experiments from launch-monitor sessions, compared batch by batch.
 * READ-ONLY over golf data: it never writes carries, bag clubs, bays or rounds.
 * The only state it writes is what Jack taps here — a wedge swing intent and retest
 * plans — under S.practiceLab, created on first write (a fresh install is unchanged).
 *
 * Rules (Jack, Nov 4 + Nov 17 2026): a shot is held out of averages when it has no club
 * speed (unless Jack kept it because the rest of the ball data is complete), apex < 40 ft,
 * or smash (ball ÷ club, unrounded) under the club's line: woods/hybrids 1.40, 4–6i 1.22,
 * 7–9i 1.18, PW/wedges 1.10. Held shots stay in the record and on screen.
 * A wedge is NOT graded until Jack says what swing it was (full / ¾ / half / pitch / chip).
 * Clean-shot means and clean rates (clean ÷ all attempts) are separate numbers; never mix.
 * Missing data stays missing (null), never zero, never filled from an average.
 * Tones describe the DIRECTION of the data, not statistical significance.
 */
(function(root){
  'use strict';
  var EXPERIMENT_FILES=['data/practice-lab/lower-hands-2026-11-17.json'];
  var BAG_ORDER=['Dr','Mini','3W','5W','2i','3H','4H','4i','5i','6i','7i','8i','9i','PW','50°','54°','56°','58°','60°'];
  var INTENTS=[['full','Full'],['three-quarter','¾'],['half','Half'],['pitch','Pitch'],['chip','Chip'],['unknown','Unknown']];
  var METRICS={
    carry:{label:'Carry',unit:'yd',dp:1,better:'up',material:3},
    total:{label:'Total',unit:'yd',dp:1,better:null,material:3},
    apex:{label:'Apex',unit:'ft',dp:0,better:null,material:5},
    launch:{label:'Launch',unit:'°',dp:1,better:null,material:1},
    spin:{label:'Spin',unit:'rpm',dp:0,better:null,material:300},
    clubSpeed:{label:'Club speed',unit:'mph',dp:1,better:null,material:1.5},
    ballSpeed:{label:'Ball speed',unit:'mph',dp:1,better:'up',material:2},
    smash:{label:'Smash',unit:'',dp:2,better:'up',material:0.03},
    path:{label:'Club path',unit:'°',dp:1,better:'zero',material:1,signed:true},
    face:{label:'Face angle',unit:'°',dp:1,better:null,material:1,signed:true},
    f2p:{label:'Face to path',unit:'°',dp:1,better:'zero',material:1,signed:true},
    launchDir:{label:'Launch direction',unit:'°',dp:1,better:'zero',material:1,signed:true,lr:true},
    cleanRate:{label:'Clean rate',unit:'%',dp:0,better:'up',material:15}
  };
  var TABS=[['carry','Carry',['carry','total','apex','cleanRate']],['delivery','Delivery',['path','face','f2p','launchDir']],
    ['flight','Flight',['launch','spin','apex','total']],['contact','Contact',['clubSpeed','ballSpeed','smash','cleanRate']]];

  // ---------- pure calculations (also used by tests/practice-lab.cjs) ----------
  function isNum(v){return typeof v==='number'&&isFinite(v);}
  function lineFor(club){
    var c=String(club);
    if(/^(Dr|Mini|\dW|\dH)$/.test(c))return {line:1.40,kind:'woods/hybrids'};
    var i=c.match(/^(\d)i$/);
    if(i){var n=+i[1];return n<=6?{line:1.22,kind:'4–6 iron'}:{line:1.18,kind:'7–9 iron'};}
    if(c==='PW'||/°$/.test(c))return {line:1.10,kind:'PW/wedges'};
    return {line:null,kind:'unknown'};
  }
  function isWedge(club){return /°$/.test(String(club));}
  function intentOf(exp,club,intents){
    var key=exp.id+':'+club;
    if(intents&&intents[key])return intents[key];
    var fixed=exp.wedgeIntent&&exp.wedgeIntent[club];
    return fixed||null;
  }
  function overrideFor(exp,batch,club,n){
    return (exp.overrides||[]).find(function(o){return o.batch===batch&&o.club===club&&o.n===n;})||null;
  }
  // Classify every shot of a group. Returns {status, shots:[{...shot, smash, clean, held:[]}]}.
  // status: 'graded' | 'unclassified' (wedge with no stated full-swing intent).
  function classify(exp,group,intents){
    var intent=isWedge(group.club)?intentOf(exp,group.club,intents):'full';
    var graded=!isWedge(group.club)||intent==='full';
    var line=lineFor(group.club).line;
    var shots=group.shots.map(function(s){
      var smash=isNum(s.clubSpeed)&&isNum(s.ballSpeed)&&s.clubSpeed>0?s.ballSpeed/s.clubSpeed:null;
      var out=Object.assign({},s,{smash:smash,clean:null,held:[]});
      if(!graded)return out;
      var ov=overrideFor(exp,group.batch,group.club,s.n);
      if(!isNum(s.clubSpeed)&&!(ov&&ov.keep))out.held.push('no club speed');
      if(isNum(s.apex)&&s.apex<40)out.held.push('apex '+s.apex+' ft');
      if(smash!=null&&line!=null&&smash<line)out.held.push('smash '+smash.toFixed(2)+' < '+line.toFixed(2));
      out.clean=out.held.length===0;
      if(ov&&ov.keep&&out.clean)out.kept=ov.why;
      return out;
    });
    return {status:graded?'graded':'unclassified',intent:intent,shots:shots};
  }
  function mean(vals){var v=vals.filter(isNum);if(!v.length)return null;return v.reduce(function(a,b){return a+b;},0)/v.length;}
  var SHOT_KEYS=['carry','total','apex','launch','spin','clubSpeed','ballSpeed','smash','path','face','f2p','launchDir'];
  function groupStats(exp,group,intents){
    var c=classify(exp,group,intents);
    var attempts=group.shots.length;
    var st={batch:group.batch,club:group.club,attempts:attempts,status:c.status,intent:c.intent,shots:c.shots,
      clean:null,cleanRate:null,mean:{},n:{}};
    if(c.status!=='graded'){SHOT_KEYS.forEach(function(k){st.mean[k]=null;st.n[k]=0;});return st;}
    var keep=c.shots.filter(function(s){return s.clean;});
    st.clean=keep.length;
    st.cleanRate=attempts?keep.length/attempts:null;
    SHOT_KEYS.forEach(function(k){
      var vals=keep.map(function(s){return s[k];}).filter(isNum);
      st.n[k]=vals.length;st.mean[k]=vals.length?mean(vals):null;
    });
    st.mean.cleanRate=st.cleanRate==null?null:st.cleanRate*100;st.n.cleanRate=attempts;
    return st;
  }
  // Weighted mean of mutually exclusive cohorts: sum(n × mean) / sum(n). Never an
  // unweighted average of averages.
  function weightedMean(parts){
    var p=parts.filter(function(x){return x&&isNum(x.mean)&&x.n>0;});
    var n=p.reduce(function(a,x){return a+x.n;},0);
    if(!n)return null;
    return {mean:p.reduce(function(a,x){return a+x.n*x.mean;},0)/n,n:n};
  }
  function batchesOf(exp){return (exp.batches||[]).slice().sort(function(a,b){return a.order-b.order;});}
  function baselineId(exp){var b=batchesOf(exp);return b.length?b[0].id:null;}
  function clubsOf(exp){
    var seen=[];exp.groups.forEach(function(g){if(seen.indexOf(g.club)<0)seen.push(g.club);});
    return seen.sort(function(a,b){return rank(a)-rank(b);});
  }
  function rank(c){var i=BAG_ORDER.indexOf(c);return i<0?99:i;}
  function clubStats(exp,club,intents){
    return batchesOf(exp).map(function(b){
      var g=exp.groups.find(function(x){return x.batch===b.id&&x.club===club;});
      return g?groupStats(exp,g,intents):null;
    }).filter(Boolean);
  }
  // Delta between two batch stats for one metric; null when either side is missing.
  function delta(a,b,key){
    if(!a||!b)return null;
    var x=a.mean[key],y=b.mean[key];
    if(!isNum(x)||!isNum(y))return null;
    return {from:x,to:y,d:y-x,nFrom:key==='cleanRate'?a.attempts:a.clean,nTo:key==='cleanRate'?b.attempts:b.clean};
  }
  // Data-direction tone. better/worse only when the change clears the metric's material
  // size AND each side has ≥3 clean shots; otherwise 'mixed' (unresolved). 'unmeasured' when null.
  function tone(key,dl){
    if(!dl)return 'unmeasured';
    var m=METRICS[key];if(!m||!m.better)return 'neutral';
    var gain;
    if(m.better==='up')gain=dl.d;
    else gain=Math.abs(dl.from)-Math.abs(dl.to);
    if(Math.abs(gain)<m.material)return 'mixed';
    if(key!=='cleanRate'&&(dl.nFrom<3||dl.nTo<3))return 'mixed';
    // A face-to-path or launch direction that crosses zero swaps one curve for the other.
    if(m.better==='zero'&&dl.from*dl.to<0&&Math.abs(dl.to)>=m.material)return 'mixed';
    return gain>0?'better':'worse';
  }
  function compare(exp,club,intents){
    var st=clubStats(exp,club,intents),base=baselineId(exp);
    var b1=st.find(function(s){return s.batch===base;})||null;
    var last=st.length>1?st[st.length-1]:null;
    if(last&&b1&&last.batch===b1.batch)last=null;
    return {stats:st,base:b1,last:last};
  }
  function findings(exp,intents){
    var out={better:[],worse:[],mixed:[],uncompared:[]};
    clubsOf(exp).forEach(function(club){
      var c=compare(exp,club,intents);
      if(!c.base||!c.last||c.base.status!=='graded'||c.last.status!=='graded'||!c.base.clean||!c.last.clean){out.uncompared.push(club);return;}
      ['carry','cleanRate','path','f2p','smash'].forEach(function(k){
        var dl=delta(c.base,c.last,k),t=tone(k,dl);
        if(t==='better'||t==='worse'||t==='mixed')out[t].push({club:club,key:k,dl:dl,from:c.base.batch,to:c.last.batch});
      });
    });
    return out;
  }
  // Adjacent clubs whose practice carries sit too close: compared across every non-baseline
  // batch pairing of the same session, so a mixed-batch overlap is flagged, never hidden.
  function gapping(exp,intents,minGap){
    minGap=minGap||6;
    var base=baselineId(exp),clubs=clubsOf(exp),pairs=[];
    var withCarry=clubs.map(function(club){
      var st=clubStats(exp,club,intents).filter(function(s){return s.batch!==base&&s.status==='graded'&&isNum(s.mean.carry);});
      return {club:club,stats:st};
    }).filter(function(x){return x.stats.length;});
    for(var i=0;i+1<withCarry.length;i++){
      var a=withCarry[i],b=withCarry[i+1],combos=[];
      a.stats.forEach(function(x){b.stats.forEach(function(y){combos.push({a:x,b:y,gap:x.mean.carry-y.mean.carry});});});
      combos.sort(function(p,q){return p.gap-q.gap;});
      var tight=combos[0];
      pairs.push({longer:a.club,shorter:b.club,combos:combos,minGap:tight.gap,flag:tight.gap<minGap});
    }
    return pairs;
  }
  function evidence(st){
    var ns=st.filter(function(s){return s.status==='graded';}).map(function(s){return s.clean;});
    var small=ns.some(function(n){return n<5;});
    return small?'Single session · small clean sample':'Single session';
  }

  // ---------- formatting ----------
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  // Round half away from zero on the decimal value (13.55 → 13.6), not the float's binary tail.
  function rnd(v,dp){var f=Math.pow(10,dp),a=Math.abs(v);return (v<0?-1:1)*Math.round(a*f+1e-7)/f;}
  function num(v,dp){var r=rnd(v,dp);return dp===0?Math.abs(r).toLocaleString('en-US'):Math.abs(r).toFixed(dp);}
  function fmt(key,v){
    if(!isNum(v))return '—';
    var m=METRICS[key]||{dp:1,unit:''},r=rnd(v,m.dp);
    if(m.lr)return r===0?'0.0':num(v,m.dp)+(r<0?'L':'R');
    var s=(r<0?'−':m.signed&&r>0?'+':'')+num(v,m.dp);
    return s+(m.unit==='%'?'%':m.unit==='°'?'°':'');
  }
  function fmtD(key,d){
    var m=METRICS[key]||{dp:1};
    if(!isNum(d))return '';
    var r=rnd(d,m.dp);
    return (r>0?'+':r<0?'−':'±')+num(d,m.dp)+(m.unit==='yd'?' yd':m.unit==='%'?' pts':m.unit==='°'?'°':m.unit?' '+m.unit:'');
  }
  var TONE_TXT={better:'▲ better',worse:'▼ worse',mixed:'◆ unclear',neutral:'● changed',unmeasured:'– not measured'};
  function toneChip(t){return '<span class="pl-tone pl-'+t+'">'+TONE_TXT[t]+'</span>';}
  function clubLabel(c){return c==='Mini'?'Mini':c;}
  function cleanTxt(s){
    if(!s)return '—';
    if(s.status!=='graded')return 'unclassified · '+s.attempts+' shots';
    return s.clean+'/'+s.attempts+' clean';
  }

  // ---------- rendering ----------
  var ui={club:null,tab:'carry',exp:null,mode:'auto',pose:''};
  var data={list:null,loading:null,error:null};
  var ctx=null,host=null,listeners=[];
  function intents(){var S=ctx&&ctx.state();return (S&&S.practiceLab&&S.practiceLab.intent)||{};}
  function plans(){var S=ctx&&ctx.state();return (S&&S.practiceLab&&S.practiceLab.plans)||[];}
  function batchMeta(exp,id){return batchesOf(exp).find(function(b){return b.id===id;})||{label:id};}

  function headlineTiles(exp){
    var I=intents(),tiles=[];
    (exp.headlines||[]).forEach(function(h){
      var st=clubStats(exp,h.club,I),from=st.find(function(s){return s.batch===h.from;});
      var parts=h.to.map(function(id){return st.find(function(s){return s.batch===id;});}).filter(Boolean);
      if(!from||!parts.length)return;
      var to;
      if(h.metric==='cleanRate'){
        var c=parts.reduce(function(a,s){return a+(s.clean||0);},0),n=parts.reduce(function(a,s){return a+s.attempts;},0);
        to={mean:{cleanRate:n?100*c/n:null},clean:c,attempts:n};
        tiles.push({h:h,big:from.clean+'/'+from.attempts+' → '+c+'/'+n,sub:Math.round(from.cleanRate*100)+'% → '+Math.round(100*c/n)+'% of all swings',
          t:tone('cleanRate',{from:from.cleanRate*100,to:100*c/n,d:100*c/n-from.cleanRate*100,nFrom:from.attempts,nTo:n})});
      }else{
        var w=weightedMean(parts.map(function(s){return {mean:s.mean[h.metric],n:s.n[h.metric]};}));
        if(!w||!isNum(from.mean[h.metric]))return;
        var dl={from:from.mean[h.metric],to:w.mean,d:w.mean-from.mean[h.metric],nFrom:from.n[h.metric],nTo:w.n};
        var big=h.metric==='carry'?fmtD('carry',dl.d):fmt(h.metric,dl.from)+' → '+fmt(h.metric,dl.to);
        tiles.push({h:h,big:big,sub:(h.metric==='carry'?fmt('carry',dl.from)+' → '+fmt('carry',dl.to)+' · ':'')+'n '+dl.nFrom+' → '+dl.nTo+(parts.length>1?' · weighted':''),t:tone(h.metric,dl)});
      }
    });
    return tiles.map(function(x){
      return '<div class="pl-kpi pl-'+x.t+'"><div class="pl-kpi-k">'+esc(x.h.label)+'</div><div class="pl-kpi-v">'+esc(x.big)+'</div>'+
        '<div class="pl-kpi-s">'+esc(x.sub)+'</div><div class="pl-kpi-f">'+toneChip(x.t)+' <span>'+esc(x.h.compare)+'</span></div></div>';
    }).join('');
  }
  function timeline(exp){
    return '<ol class="pl-timeline">'+batchesOf(exp).map(function(b){
      var shots=exp.groups.filter(function(g){return g.batch===b.id;}),n=shots.reduce(function(a,g){return a+g.attempts;},0);
      var clubs=shots.map(function(g){return g.club;}).sort(function(a,c){return rank(a)-rank(c);});
      return '<li><span class="pl-dot pl-b-'+esc(b.id)+'" aria-hidden="true"></span><div><b>'+esc(b.label)+'</b><span>'+esc(b.setup)+'</span>'+
        '<span class="pl-sm">'+n+' swings · '+esc(clubs.join(' · '))+'</span></div></li>';
    }).join('')+'</ol>';
  }
  function carryChange(exp){
    var I=intents(),rows=[],max=1;
    clubsOf(exp).forEach(function(club){
      var c=compare(exp,club,I),dl=c.base&&c.last?delta(c.base,c.last,'carry'):null;
      if(dl){rows.push({club:club,dl:dl,t:tone('carry',dl),from:c.base.batch,to:c.last.batch});max=Math.max(max,Math.abs(dl.d));}
    });
    if(!rows.length)return '';
    var b=rows[0];
    return '<section class="pl-card" aria-label="Carry change"><h3 class="pl-h">Carry change · '+esc(b.to)+' vs '+esc(b.from)+'</h3><div class="pl-div">'+rows.map(function(r){
      var w=Math.max(2,Math.round(48*Math.abs(r.dl.d)/max));
      return '<button type="button" class="pl-divrow" data-pl-club="'+esc(r.club)+'" aria-label="'+esc(r.club+' carry '+fmtD('carry',r.dl.d))+'">'+
        '<span class="pl-divk">'+esc(clubLabel(r.club))+'</span><span class="pl-divbar"><span class="pl-divfill pl-'+r.t+' '+(r.dl.d<0?'neg':'pos')+'" style="width:'+w+'%"></span></span>'+
        '<span class="pl-divv">'+esc(fmtD('carry',r.dl.d))+'</span><span class="pl-divn">n '+r.dl.nFrom+'→'+r.dl.nTo+'</span></button>';
    }).join('')+'</div><p class="pl-foot">Clean-shot means. Clubs hit in only one batch have no change to show.</p></section>';
  }
  function findingsCard(exp){
    var f=findings(exp,intents());
    function li(x){
      var m=METRICS[x.key];
      return '<li><b>'+esc(clubLabel(x.club))+'</b> '+esc(m.label.toLowerCase())+' '+esc(fmt(x.key,x.dl.from))+' → '+esc(fmt(x.key,x.dl.to))+
        ' <span class="pl-sm">('+esc(fmtD(x.key,x.dl.d))+')</span></li>';
    }
    function col(k,title){
      var list=f[k];
      return '<div class="pl-fcol pl-'+k+'"><div class="pl-fh">'+toneChip(k)+' <span>'+esc(title)+' · '+list.length+'</span></div>'+
        (list.length?'<ul>'+list.map(li).join('')+'</ul>':'<p class="pl-sm">None</p>')+'</div>';
    }
    return '<section class="pl-card" aria-label="What changed"><h3 class="pl-h">What changed, kept apart</h3><div class="pl-fgrid">'+
      col('better','Improved')+col('worse','Worse')+'</div>'+
      '<details class="pl-more pl-fcol pl-mixed"><summary>'+toneChip('mixed')+'&nbsp;Unclear or small · '+f.mixed.length+'</summary>'+(f.mixed.length?'<ul>'+f.mixed.map(li).join('')+'</ul>':'')+'</details>'+
      (f.uncompared.length?'<p class="pl-foot">No before/after for '+esc(f.uncompared.join(', '))+' (one batch only, or not graded).</p>':'')+
      '<details class="pl-more"><summary>How these are labelled</summary><p>Baseline vs the latest batch for each club, clean shots only. Better/worse needs the change to clear a set size (carry 3 yd, path and face-to-path 1°, clean rate 15 points, smash 0.03) with at least 3 clean shots each side; anything smaller or thinner is unclear. A face-to-path that crosses zero swaps fade spin for draw spin, so it reads unclear rather than better. This is the direction of the data, not a significance test.</p></details></section>';
  }
  function chips(exp){
    return '<div class="pl-chips" role="tablist" aria-label="Club">'+clubsOf(exp).map(function(c){
      var on=c===ui.club;
      return '<button type="button" role="tab" aria-selected="'+on+'" class="pl-chip'+(on?' on':'')+'" data-pl-club="'+esc(c)+'">'+esc(clubLabel(c))+'</button>';
    }).join('')+'</div>';
  }
  function gappingCard(exp){
    var g=gapping(exp,intents()).filter(function(p){return p.flag;});
    if(!g.length)return '';
    return '<section class="pl-card" aria-label="Gapping"><h3 class="pl-h">Gapping · needs retest</h3>'+g.map(function(p){
      var rows=p.combos.slice(0,3).map(function(c){return '<li>'+esc(p.longer)+' '+esc(c.a.batch)+' '+fmt('carry',c.a.mean.carry)+' (n '+c.a.clean+') vs '+esc(p.shorter)+' '+esc(c.b.batch)+' '+fmt('carry',c.b.mean.carry)+' (n '+c.b.clean+') → <b>'+(c.gap<0?'−':'')+num(c.gap,1)+' yd</b></li>';}).join('');
      var pa=ctx&&ctx.playingCarry?ctx.playingCarry(p.longer):null,pb=ctx&&ctx.playingCarry?ctx.playingCarry(p.shorter):null;
      return '<div class="pl-gap"><div class="pl-gaph"><span class="pl-tone pl-mixed">◆ Needs retest</span> <b>'+esc(p.longer)+' – '+esc(p.shorter)+'</b> <span class="pl-sm">'+(p.minGap<0?esc(p.shorter)+' carried '+num(-p.minGap,1)+' yd farther':'only '+num(p.minGap,1)+' yd apart')+'</span></div><ul>'+rows+'</ul>'+
        '<p class="pl-sm">Bag playing carries unchanged: '+esc(p.longer)+' '+(isNum(pa)?pa:'not set')+' · '+esc(p.shorter)+' '+(isNum(pb)?pb:'not set')+'.</p></div>';
    }).join('')+'<p class="pl-foot">Practice carries from mixed batches of one session. Nothing here edits your bag.</p></section>';
  }
  function bars(st,key){
    var vals=st.map(function(s){return s.mean[key];}).filter(isNum);
    if(!vals.length)return '<p class="pl-sm">Not measured.</p>';
    var m=METRICS[key],signed=!!m.signed,maxAbs=Math.max.apply(null,vals.map(Math.abs))||1;
    var lo=signed?0:Math.min.apply(null,vals),hi=Math.max.apply(null,vals);
    var floor=signed?0:Math.max(0,lo-(hi-lo||Math.abs(hi)*0.1)*1.2);
    return '<div class="pl-bars'+(signed?' signed':'')+'">'+st.map(function(s){
      var v=s.mean[key],w;
      if(!isNum(v))return '<div class="pl-bar"><span class="pl-bk">'+esc(s.batch)+'</span><span class="pl-btrack"></span><span class="pl-bv pl-missing">'+(s.status==='graded'?'—':'unclassified')+'</span><span class="pl-bn"></span></div>';
      w=signed?Math.max(2,Math.round(50*Math.abs(v)/maxAbs)):Math.max(4,Math.round(100*(v-floor)/((hi-floor)||1)));
      var n=key==='cleanRate'?s.clean+'/'+s.attempts:'n '+s.n[key];
      return '<div class="pl-bar"><span class="pl-bk">'+esc(s.batch)+'</span><span class="pl-btrack">'+
        '<span class="pl-bfill pl-b-'+esc(s.batch)+(signed?(v<0?' neg':' pos'):'')+'" style="width:'+w+'%"></span></span>'+
        '<span class="pl-bv">'+esc(fmt(key,v))+'</span><span class="pl-bn">'+esc(n)+'</span></div>';
    }).join('')+(signed?'<div class="pl-axis"><span>'+(m.lr?'left':'−')+'</span><span>0</span><span>'+(m.lr?'right':'+')+'</span></div>':'')+'</div>';
  }
  function deltaLine(c,key){
    if(!c.base||!c.last)return '';
    var dl=delta(c.base,c.last,key);
    if(!dl)return '<div class="pl-dl">'+toneChip('unmeasured')+'</div>';
    return '<div class="pl-dl">'+toneChip(tone(key,dl))+' <span>'+esc(c.last.batch)+' vs '+esc(c.base.batch)+' '+esc(fmtD(key,dl.d))+'</span></div>';
  }
  // Delivery picture from measured numbers only: target line, club path, face and launch
  // direction per batch. Angles drawn ×3 so a 2° change is visible; labels carry the real values.
  function diagram(st,hand){
    var cells=st.filter(function(s){return s.status==='graded'&&(isNum(s.mean.path)||isNum(s.mean.face));}).map(function(s){
      function ray(deg,cls,len){
        if(!isNum(deg))return '';
        var a=deg*3*Math.PI/180,x=50+Math.sin(a)*len,y=92-Math.cos(a)*len;
        return '<line x1="50" y1="92" x2="'+x.toFixed(1)+'" y2="'+y.toFixed(1)+'" class="'+cls+'"/>';
      }
      return '<figure class="pl-diag"><svg viewBox="0 0 100 100" role="img" aria-label="'+esc(s.batch+': path '+fmt('path',s.mean.path)+', face '+fmt('face',s.mean.face)+', launch '+fmt('launchDir',s.mean.launchDir))+'">'+
        '<line x1="50" y1="94" x2="50" y2="6" class="pl-target"/>'+ray(s.mean.path,'pl-path',78)+ray(s.mean.face,'pl-face',64)+ray(s.mean.launchDir,'pl-ldir',50)+
        '<circle cx="50" cy="92" r="3" class="pl-ball"/></svg><figcaption><b>'+esc(s.batch)+'</b> path '+esc(fmt('path',s.mean.path))+' · face '+esc(fmt('face',s.mean.face))+'<br>launch '+esc(fmt('launchDir',s.mean.launchDir))+' · n '+s.clean+'</figcaption></figure>';
    });
    if(!cells.length)return '';
    return '<div class="pl-diags">'+cells.join('')+'</div><p class="pl-legend"><span class="k-target">┆ target</span> <span class="k-path">— club path</span> <span class="k-face">— face</span> <span class="k-ldir">— launch</span> · '+
      esc(hand==='right'?'Right-handed':'Handedness: '+hand)+'. Angles drawn ×3; labels are the measured values. Positive path = in-to-out, negative = out-to-in. Not a ball-flight trace: no spin axis or strike location in the recording.</p>';
  }
  function shotTable(exp,st){
    return st.map(function(s){
      var rows=s.shots.map(function(x){
        var cls=s.status!=='graded'?'':x.clean?'':' class="pl-held"';
        var why=s.status!=='graded'?'not graded':x.clean?(x.kept?'kept (Jack)':'clean'):x.held.join(', ');
        return '<tr'+cls+'><td>'+x.n+'</td><td>'+fmt('carry',x.carry)+'</td><td>'+fmt('total',x.total)+'</td><td>'+fmt('apex',x.apex)+'</td><td>'+fmt('clubSpeed',x.clubSpeed)+'</td><td>'+fmt('ballSpeed',x.ballSpeed)+'</td><td>'+(x.smash==null?'—':x.smash.toFixed(2))+'</td><td>'+fmt('path',x.path)+'</td><td>'+fmt('face',x.face)+'</td><td>'+fmt('f2p',x.f2p)+'</td><td>'+fmt('launchDir',x.launchDir)+'</td><td>'+fmt('launch',x.launch)+'</td><td>'+fmt('spin',x.spin)+'</td><td>'+esc(why)+'</td></tr>';
      }).join('');
      return '<div class="pl-tablewrap"><div class="pl-sm"><b>'+esc(batchMeta(exp,s.batch).label)+'</b> · '+esc(cleanTxt(s))+'</div><table class="pl-table"><thead><tr><th>#</th><th>Carry</th><th>Total</th><th>Apex</th><th>Club</th><th>Ball</th><th>Smash</th><th>Path</th><th>Face</th><th>F2P</th><th>Dir</th><th>Launch</th><th>Spin</th><th>Status</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
    }).join('');
  }
  function wedgeCard(exp,club,st){
    if(!isWedge(club))return '';
    var cur=intentOf(exp,club,intents())||'unknown';
    return '<div class="pl-wedge"><div class="pl-sm"><b>What swing was this '+esc(club)+'?</b> Graded against the '+lineFor(club).line.toFixed(2)+' full-swing line only if you say Full.</div>'+
      '<div class="pl-seg" role="group" aria-label="Swing intent">'+INTENTS.map(function(o){
        return '<button type="button" class="pl-segb'+(cur===o[0]?' on':'')+'" data-pl-intent="'+o[0]+'" aria-pressed="'+(cur===o[0])+'">'+o[1]+'</button>';
      }).join('')+'</div>'+
      (st.every(function(s){return s.status!=='graded';})?'<p class="pl-sm">Unclassified: no clean count or averages until the swing is known. Raw shots stay below.</p>':'')+'</div>';
  }
  function clubPanel(exp){
    var club=ui.club,I=intents(),c=compare(exp,club,I),st=c.stats;
    var tab=TABS.find(function(t){return t[0]===ui.tab;})||TABS[0];
    var pc=ctx&&ctx.playingCarry?ctx.playingCarry(club):null;
    var head='<div class="pl-clubhead"><div><div class="pl-kicker">Club analysis</div><h3 class="pl-clubname">'+esc(club)+'</h3>'+
      '<div class="pl-sm">'+st.map(function(s){return esc(s.batch)+' '+esc(cleanTxt(s));}).join(' · ')+'</div></div>'+
      '<div class="pl-evid"><span class="pl-badge">'+esc(evidence(st))+'</span><span class="pl-sm">Bag carry '+(isNum(pc)?pc:'not set')+' · unchanged</span></div></div>';
    var tabs='<div class="pl-tabs" role="tablist" aria-label="Measure">'+TABS.map(function(t){
      return '<button type="button" role="tab" aria-selected="'+(t[0]===tab[0])+'" class="pl-tab'+(t[0]===tab[0]?' on':'')+'" data-pl-tab="'+t[0]+'">'+t[1]+'</button>';
    }).join('')+'</div>';
    var body=tab[2].map(function(k){
      return '<div class="pl-metric"><div class="pl-mh"><b>'+esc(METRICS[k].label)+'</b>'+deltaLine(c,k)+'</div>'+bars(st,k)+'</div>';
    }).join('');
    if(tab[0]==='delivery')body=diagram(st,exp.handedness)+body;
    var combined='';
    var lower=st.filter(function(s){return s.batch!==(c.base&&c.base.batch)&&s.status==='graded'&&s.clean;});
    if(c.base&&lower.length>1){
      var w=weightedMean(lower.map(function(s){return {mean:s.mean.carry,n:s.n.carry};}));
      var att=lower.reduce(function(a,s){return a+s.attempts;},0),cl=lower.reduce(function(a,s){return a+s.clean;},0);
      if(w)combined='<p class="pl-combined"><b>'+esc(lower.map(function(s){return s.batch;}).join('+'))+' together</b> (both after the change): carry '+fmt('carry',w.mean)+
        ' weighted over '+w.n+' clean · '+cl+'/'+att+' clean of all swings. vs '+esc(c.base.batch)+' '+fmt('carry',c.base.mean.carry)+' ('+fmtD('carry',w.mean-c.base.mean.carry)+').</p>';
    }
    return '<section class="pl-card pl-clubpanel" id="pl-club" aria-label="'+esc(club)+' analysis">'+head+wedgeCard(exp,club,st)+tabs+'<div class="pl-tabbody">'+body+'</div>'+combined+
      '<details class="pl-more"><summary>Every shot · '+st.reduce(function(a,s){return a+s.attempts;},0)+' swings</summary>'+shotTable(exp,st)+'<p class="pl-foot">Held shots stay in the record. Smash = ball ÷ club, unrounded. '+esc(exp.smashColumnNote||'')+'</p></details></section>';
  }
  function retestCard(exp){
    var mine=plans().filter(function(p){return p.exp===exp.id;});
    var protocol=(exp.retest||[]).map(function(s){return '<li>'+esc(s)+'</li>';}).join('');
    var list=mine.map(function(p){
      return '<li class="pl-plan"><div><b>'+esc(p.clubs||'Clubs not set')+'</b> · '+esc(p.date||'date not set')+' <span class="pl-tone pl-mixed">◆ planned, not run</span></div>'+
        '<div class="pl-sm">'+['ball','surface','normalization','hands','other'].filter(function(k){return p[k];}).map(function(k){return esc(k)+': '+esc(p[k]);}).join(' · ')+'</div>'+
        '<button type="button" class="pl-link" data-pl-delplan="'+esc(p.id)+'">Remove</button></li>';
    }).join('');
    function f(k,label,ph){return '<label class="pl-field"><span>'+esc(label)+'</span><input type="text" name="'+k+'" placeholder="'+esc(ph)+'" autocomplete="off"></label>';}
    return '<section class="pl-card" id="pl-retest" aria-label="Retest planner"><h3 class="pl-h">Retest plan</h3><ol class="pl-steps">'+protocol+'</ol>'+
      (list?'<ul class="pl-plans">'+list+'</ul>':'')+
      '<details class="pl-more"><summary>Log the next controlled test</summary><form class="pl-form" data-pl-form>'+
      f('clubs','Clubs','6i, 5i')+'<label class="pl-field"><span>Date</span><input type="date" name="date"></label>'+
      f('ball','Ball','same ball both setups')+f('surface','Mat or grass','mat, off the deck')+f('normalization','Normalization','on / off')+
      f('hands','Hand position (how low?)','e.g. 1 grip-width lower')+f('other','Other swing changes','none')+
      '<button type="submit" class="pl-btn">Save plan</button><p class="pl-sm">Saved on this phone with your golf data. Results arrive as a new batch on this experiment, never as a bag change.</p></form></details></section>';
  }
  function historyCard(){
    var I=intents();
    return '<section class="pl-card" aria-label="Experiment history"><h3 class="pl-h">Experiments</h3><ul class="pl-hist">'+(data.list||[]).map(function(exp){
      var on=exp.id===ui.exp.id,shots=exp.groups.reduce(function(a,g){return a+g.attempts;},0),f=findings(exp,I);
      return '<li><button type="button" class="pl-histrow'+(on?' on':'')+'" data-pl-exp="'+esc(exp.id)+'"><b>'+esc(exp.name)+'</b><span>'+esc(exp.date)+' · '+shots+' swings · '+clubsOf(exp).length+' clubs · launch monitor</span>'+
        '<span class="pl-sm">'+f.better.length+' improved · '+f.worse.length+' worse · '+f.mixed.length+' unclear · single session, retest pending</span></button></li>';
    }).join('')+'</ul><p class="pl-foot">Launch-monitor averages only. Course performance stays in Rounds.</p></section>';
  }
  function layoutBar(){
    var big=Math.min(window.innerWidth,window.innerHeight)>=600;
    var opts=[['auto','Automatic'],['book','Book'],['seated','Top · bottom'],['off','Off']];
    return '<details class="pl-more pl-layout"><summary>Fold layout · '+esc((opts.find(function(o){return o[0]===ui.mode;})||opts[0])[1])+'</summary>'+
      '<div class="pl-seg" role="group" aria-label="Fold layout">'+opts.map(function(o){return '<button type="button" class="pl-segb'+(ui.mode===o[0]?' on':'')+'" data-pl-mode="'+o[0]+'" aria-pressed="'+(ui.mode===o[0])+'">'+o[1]+'</button>';}).join('')+
      '</div><p class="pl-sm" data-pl-diag>'+esc(diagText())+'</p>'+(big?'':'<p class="pl-sm">Book and Top · bottom need the big inner screen.</p>')+'</details>';
  }
  function view(){
    var exp=ui.exp;
    if(!exp)return '<div class="pl-card"><p>'+(data.error?'Practice Lab data could not load ('+esc(data.error)+'). Reconnect once to cache it for offline use.':'Loading Practice Lab…')+'</p></div>';
    if(!ui.club||clubsOf(exp).indexOf(ui.club)<0)ui.club=exp.defaultClub&&clubsOf(exp).indexOf(exp.defaultClub)>=0?exp.defaultClub:clubsOf(exp)[0];
    var big=Math.min(window.innerWidth,window.innerHeight)>=600;
    var back=ui.pose?'<button type="button" class="pl-btn ghost" data-action="go" data-view="game" aria-label="Back to Progress">←</button>':'';
    var bookBtn=big?(ui.pose==='book'||ui.pose==='seated'?back+'<button type="button" class="pl-btn ghost" data-pl-mode="off">✕ Single page</button>':
      '<button type="button" class="pl-btn ghost" data-pl-mode="'+(window.innerWidth>window.innerHeight?'book':'seated')+'">📖 Book</button>'):'';
    var left='<section class="pl-card pl-hero" aria-label="Experiment"><div class="pl-kicker">Practice Lab · '+esc(exp.date)+'</div><div class="pl-herorow"><h2 class="pl-title" data-no-fold>'+esc(exp.name)+'</h2><span class="pl-acts">'+bookBtn+'</span></div>'+
      '<p class="pl-sub">'+esc(exp.hypothesis)+' '+esc(exp.surface.charAt(0).toUpperCase()+exp.surface.slice(1))+'.</p>'+timeline(exp)+
      '<details class="pl-more"><summary>Setup, source and rules</summary><p>'+esc(exp.note)+'</p><p>'+esc(exp.provenance)+'</p><p>'+esc(exp.rule.text)+' Lines: woods/hybrids 1.40 · 4–6i 1.22 · 7–9i 1.18 · PW/wedges 1.10.</p><p>Not recorded: '+esc((exp.unknown||[]).join(', '))+'.</p></details></section>'+
      '<div class="pl-kpis">'+headlineTiles(exp)+'</div>'+
      '<div class="pl-pick"><div class="pl-kicker">Pick a club</div>'+chips(exp)+'</div>'+
      carryChange(exp)+findingsCard(exp)+gappingCard(exp)+historyCard()+layoutBar();
    var right=clubPanel(exp)+retestCard(exp)+
      '<p class="pl-foot pl-guard">Practice numbers never change your bag. Playing carries move only when you ask.</p>';
    return '<div class="pl-pane pl-left">'+left+'</div><div class="pl-hinge" aria-hidden="true"></div><div class="pl-pane pl-right">'+right+'</div>';
  }
  function paint(keepClub){
    if(!host)return;
    var r=host.querySelector('.pl-right'),ry=r?r.scrollTop:0,l=host.querySelector('.pl-left'),ly=l?l.scrollTop:0;
    host.innerHTML=view();
    var r2=host.querySelector('.pl-right'),l2=host.querySelector('.pl-left');
    if(r2&&keepClub!==false)r2.scrollTop=ry;
    if(l2)l2.scrollTop=ly;
    decide();
  }

  // ---------- fold layouts (same behaviour as CFP Study Lab / Sports Hub) ----------
  var MODE_KEY='caddiehq:duo-mode',FOLD_GAP=24;
  function mq(s){try{return window.matchMedia?window.matchMedia(s):null;}catch(e){return null;}}
  var MQ=null;
  function segments(){
    var v=window.viewport,s=v&&v.segments;
    if(s&&s.length===2){var p=Array.prototype.slice.call(s).sort(function(a,b){return a.top-b.top||a.left-b.left;});return {n:2,a:p[0],b:p[1]};}
    return {n:s?s.length:null};
  }
  function posture(){
    var dp=navigator.devicePosture;if(dp&&dp.type)return dp.type;
    if(MQ&&MQ.folded&&MQ.folded.matches)return 'folded';
    return '';
  }
  function diagText(){var seg=segments();return 'fold: '+(posture()||'n/a')+' · '+(seg.n==null?'?':seg.n)+' seg · '+(ui.pose||'flat')+' · mode '+ui.mode;}
  function decide(){
    if(!host)return;
    var seg=segments(),post=posture(),W=window.innerWidth,H=window.innerHeight,name='',fl=null,fr=null,ft=null,fb=null;
    if(ui.mode!=='off'&&seg.n===2&&post!=='continuous'){
      var a=seg.a,b=seg.b;
      if(b.left>=a.right-1&&Math.abs(a.top-b.top)<2){name='book';var mx=(a.right+b.left)/2;fl=Math.min(a.right,mx-FOLD_GAP/2);fr=Math.max(b.left,mx+FOLD_GAP/2);}
      else if(b.top>=a.bottom-1&&Math.abs(a.left-b.left)<2){name='seated';var my=(a.bottom+b.top)/2;ft=Math.min(a.bottom,my-FOLD_GAP/2);fb=Math.max(b.top,my+FOLD_GAP/2);}
      if(ui.mode==='book'&&name!=='book')name='';
      if(ui.mode==='seated'&&name!=='seated')name='';
    }
    // Safari usually reports no segments: split at the middle only when Jack chose a
    // split (or posture says folded) and only on the big inner screen. Never forced.
    var big=Math.min(W,H)>=600,wide=W>H;
    var want=ui.mode==='book'||ui.mode==='seated'?ui.mode:(ui.mode==='auto'&&post==='folded'?(wide?'book':'seated'):'');
    if(!name&&big&&want==='book'&&wide){name='book';fl=W/2-FOLD_GAP/2;fr=W/2+FOLD_GAP/2;}
    if(!name&&big&&want==='seated'&&!wide){name='seated';ft=H/2-FOLD_GAP/2;fb=H/2+FOLD_GAP/2;}
    var lab=host;
    ['--pl-fold-left','--pl-fold-right','--pl-fold-top','--pl-fold-bottom'].forEach(function(k){lab.style.removeProperty(k);});
    if(name==='book'){lab.style.setProperty('--pl-fold-left',Math.round(fl)+'px');lab.style.setProperty('--pl-fold-right',Math.round(fr)+'px');}
    if(name==='seated'){lab.style.setProperty('--pl-fold-top',Math.round(ft)+'px');lab.style.setProperty('--pl-fold-bottom',Math.round(fb)+'px');}
    // Keep both pages clear of the app's navigation: a bottom bar on phones, a left rail on wide screens.
    var nav=document.getElementById('nav'),nr=nav?nav.getBoundingClientRect():null,padL=0,padB=0;
    if(nr&&nr.width&&nr.height){if(nr.height>nr.width&&nr.left<W/3)padL=Math.ceil(nr.right)+8;else if(nr.top>H/2)padB=Math.ceil(H-nr.top)+6;}
    lab.style.setProperty('--pl-pad-left',padL+'px');lab.style.setProperty('--pl-pad-bottom',padB+'px');
    var was=ui.pose,wasBig=ui.big,wasWide=ui.wideScr;ui.pose=name;ui.big=big;ui.wideScr=wide;
    lab.classList.toggle('pl-book',name==='book');
    lab.classList.toggle('pl-seated',name==='seated');
    lab.classList.toggle('pl-wide',!name&&W>=1100);
    document.documentElement.classList.toggle('pl-pose-book',!!name);
    var d=lab.querySelector('[data-pl-diag]');if(d)d.textContent=diagText();
    if((was!==name||wasBig!==big||(big&&wasWide!==wide))&&lab.querySelector('.pl-herorow'))paintSoon();
  }
  var soon=null;function paintSoon(){if(soon)return;soon=setTimeout(function(){soon=null;paint();},0);}
  function setMode(m){ui.mode=m;try{localStorage.setItem(MODE_KEY,m);}catch(e){}paint();}

  // ---------- events ----------
  function onClick(e){
    var t=e.target.closest&&e.target.closest('[data-pl-club],[data-pl-tab],[data-pl-intent],[data-pl-mode],[data-pl-exp],[data-pl-delplan]');
    if(!t||!host.contains(t))return;
    if(t.dataset.plClub){ui.club=t.dataset.plClub;saveUi();paint(false);
      var panel=host.querySelector('#pl-club');
      if(panel&&!ui.pose&&t.closest('.pl-left')){var r=panel.getBoundingClientRect();if(r.top>window.innerHeight*0.6||r.top<0)window.scrollTo(0,window.scrollY+r.top-70);}
      if(ui.pose==='book'){var rp=host.querySelector('.pl-right');if(rp)rp.scrollTop=0;}
      return;}
    if(t.dataset.plTab){ui.tab=t.dataset.plTab;saveUi();paint();return;}
    if(t.dataset.plMode){setMode(t.dataset.plMode);return;}
    if(t.dataset.plExp){ui.exp=(data.list||[]).find(function(x){return x.id===t.dataset.plExp;})||ui.exp;ui.club=null;paint();return;}
    if(t.dataset.plIntent){
      var S=ctx.state(),key=ui.exp.id+':'+ui.club,v=t.dataset.plIntent;
      S.practiceLab=S.practiceLab||{};S.practiceLab.intent=S.practiceLab.intent||{};
      if(v==='unknown')delete S.practiceLab.intent[key];else S.practiceLab.intent[key]=v;
      ctx.save();paint();return;}
    if(t.dataset.plDelplan){
      var S2=ctx.state();if(S2.practiceLab&&S2.practiceLab.plans)S2.practiceLab.plans=S2.practiceLab.plans.filter(function(p){return p.id!==t.dataset.plDelplan;});
      ctx.save();paint();return;}
  }
  function onSubmit(e){
    var f=e.target.closest&&e.target.closest('[data-pl-form]');if(!f||!host.contains(f))return;
    e.preventDefault();
    var fd={};['clubs','date','ball','surface','normalization','hands','other'].forEach(function(k){var i=f.elements[k];fd[k]=i?String(i.value||'').trim():'';});
    if(!fd.clubs){if(ctx.toast)ctx.toast('Add the clubs to retest');return;}
    var S=ctx.state();S.practiceLab=S.practiceLab||{};S.practiceLab.plans=S.practiceLab.plans||[];
    S.practiceLab.plans.push(Object.assign({id:'plan-'+Date.now().toString(36),exp:ui.exp.id,created:new Date().toISOString().slice(0,10)},fd));
    ctx.save();if(ctx.toast)ctx.toast('Retest plan saved');paint();
  }
  var UI_KEY='caddiehq_practice_ui_v1';
  function saveUi(){try{localStorage.setItem(UI_KEY,JSON.stringify({club:ui.club,tab:ui.tab}));}catch(e){}}
  function loadUi(){try{var u=JSON.parse(localStorage.getItem(UI_KEY)||'{}');if(u.club)ui.club=u.club;if(u.tab&&TABS.some(function(t){return t[0]===u.tab;}))ui.tab=u.tab;}catch(e){}
    try{var m=localStorage.getItem(MODE_KEY);var q=(location.search.match(/[?&]duo=(book|seated|off|auto)\b/)||[])[1];if(q){m=q;localStorage.setItem(MODE_KEY,q);}if(/^(auto|book|seated|off)$/.test(m||''))ui.mode=m;}catch(e){}}
  function load(){
    if(data.list)return Promise.resolve(data.list);
    if(data.loading)return data.loading;
    data.loading=Promise.all(EXPERIMENT_FILES.map(function(f){return fetch(f).then(function(r){if(!r.ok)throw Error('HTTP '+r.status);return r.json();});}))
      .then(function(list){data.list=list.sort(function(a,b){return a.date<b.date?1:-1;});data.error=null;return data.list;})
      .catch(function(e){data.error=e.message;data.loading=null;throw e;});
    return data.loading;
  }
  function listen(target,type,fn,opt){target.addEventListener(type,fn,opt);listeners.push([target,type,fn,opt]);}
  function mount(el,c){
    unmount();host=el;ctx=c;if(!host)return;
    if(!MQ)MQ={folded:mq('(device-posture: folded)')};
    loadUi();
    listen(host,'click',onClick);listen(host,'submit',onSubmit);
    var rd=function(){decide();};
    listen(window,'resize',rd);listen(window,'orientationchange',rd);
    if(window.visualViewport)listen(window.visualViewport,'resize',rd);
    if(MQ.folded&&MQ.folded.addEventListener)listen(MQ.folded,'change',rd);
    if(navigator.devicePosture&&navigator.devicePosture.addEventListener)listen(navigator.devicePosture,'change',rd);
    paint();
    load().then(function(list){if(host!==el)return;if(!ui.exp)ui.exp=list[0];paint();}).catch(function(){if(host===el)paint();});
  }
  function unmount(){
    listeners.forEach(function(l){try{l[0].removeEventListener(l[1],l[2],l[3]);}catch(e){}});listeners=[];
    if(soon){clearTimeout(soon);soon=null;}
    document.documentElement.classList.remove('pl-pose-book');
    host=null;ui.pose='';
  }
  function teaser(){return 'Swing and gear experiments, batch by batch';}

  var api={mount:mount,unmount:unmount,teaser:teaser,files:EXPERIMENT_FILES,
    calc:{lineFor:lineFor,classify:classify,groupStats:groupStats,weightedMean:weightedMean,clubStats:clubStats,delta:delta,tone:tone,
      compare:compare,findings:findings,gapping:gapping,evidence:evidence,clubsOf:clubsOf,fmt:fmt,fmtD:fmtD}};
  root.CaddiePracticeLab=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
