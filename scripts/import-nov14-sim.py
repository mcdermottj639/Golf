"""Nov 14 six-clip import, reflecting Jack's final equipment/date/cue corrections.
All irons are OLD KING Forged / KBS 120 stiff. Missing club-speed or apex <40
held for all; exact wood smash <1.40 also held. Iron smash is descriptive.
Raw rows, before/after cohorts and playing carries are preserved.
"""
import copy, json, pathlib, re, statistics as st
ROOT=pathlib.Path(__file__).resolve().parents[1]
def read(f): return json.loads((ROOT/f).read_text())
def save(f,d): (ROOT/f).write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
SRC=read('data/range-2026-11-14-sim.json')
METRICS='carry total cs bs smash la ld spin path face ftp aoa height'.split()
def feet(v):
    if isinstance(v,(int,float)):return v
    if isinstance(v,str):
        m=re.fullmatch(r"(\d+)'\s*(\d+(?:\.\d+)?)?\"?",v)
        if m:return float(m[1])+float(m[2] or 0)/12
    return None
def normalize(s):
    s=copy.deepcopy(s);s['height']=feet(s.get('height',s.get('heightText')))
    s['smash']=s['bs']/s['cs'] if s.get('bs') is not None and s.get('cs') else None
    return s
def exclusions(s,club,group):
    why=[]
    if s.get('cs') is None:why.append('no club-speed reading captured')
    if s.get('height') is not None and s['height']<40:why.append(f"apex {s['height']:g} ft below 40 ft")
    if re.search(r'wood|hybrid|driver',club,re.I) and s.get('smash') is not None and s['smash']<1.40:why.append(f"ball / club = {s['smash']:.4f}, below the wood/hybrid 1.40 cutoff")
    cs=[x['carry'] for x in group if x.get('carry') is not None]
    if len(cs)>=3 and s.get('carry') is not None:
        med=st.median(cs);cluster=[c for c in cs if c>=med*.5]
        if s['carry']<st.median(cluster if len(cluster)>=2 else cs)*2/3:why.append('carry below two-thirds of the airborne cluster')
    if s.get('carry') is None:why.append('carry missing')
    return why
def metrics(shots):
    out={'n':len(shots)};counts={}
    for k in METRICS:
        xs=[s[k] for s in shots if s.get(k) is not None];key='apex' if k=='height' else k
        out[key]=round(st.mean(xs),4) if xs else None;counts[key]=len(xs)
    cs=[s['carry'] for s in shots if s.get('carry') is not None]
    n=5 if len(cs)>=5 else 3 if len(cs)>=3 else 0
    out.update(best=round(st.mean(sorted(cs,reverse=True)[:n]),4) if n else None,bestN=n,carrySd=round(st.stdev(cs),4) if len(cs)>1 else None,metricCounts=counts)
    out['roll']=round(out['total']-out['carry'],4) if out['total'] is not None and out['carry'] is not None else None
    for k in ['path','ftp']:
        xs=[s[k] for s in shots if s.get(k) is not None]
        out[k+'Median']=round(st.median(xs),4) if xs else None
        out[k+'Sd']=round(st.stdev(xs),4) if len(xs)>1 else None
    xs=[abs(s['ftp']) for s in shots if s.get('ftp') is not None]
    out['ftpAbsMean']=round(st.mean(xs),4) if xs else None
    return out
def mark(shots,club):
    ss=[normalize(s) for s in shots]
    for s in ss:
        why=exclusions(s,club,ss);s['mishit']=bool(why)
        if why:s['mishitReason']='; '.join(why)
        else:s.pop('mishitReason',None)
    return ss
def filtered(shots,club):return [s for s in mark(shots,club) if not s['mishit']]

groups=[]
for src in SRC['sources']:
    for club in dict.fromkeys(s['club'] for s in src['shots']):
        shots=mark([s for s in src['shots'] if s['club']==club],club)
        phase=shots[0]['cuePhase'];label=club
        if 'iron' in club:label+=' · '+('club first' if phase.startswith('after') else 'before cue')
        else:label+=' · '+('4i-label block' if src['sourceId']=='mixed-4i-5w' else '4w-label block')
        for s in shots:s.update(videoSource={'file':src['file'],'row':s['shot']},heightText=f"{s['height']:g}'")
        a=metrics([s for s in shots if not s['mishit']]);a.update(club=label,held=sum(s['mishit'] for s in shots))
        groups.append(dict(club=label,equipment=src.get('equipment','Cobra Darkspeed X 5W, per Jack'),source=src['file'],sourceId=src['sourceId'],normalization=src['normalization'],sourceShotCount=len(shots),visibleShotCount=len(shots),shots=shots,avg=a,excludedShotNumbers=[s['shot'] for s in shots if s['mishit']],distanceMissingShotNumbers=[],unseenShotNumbers=[],cuePhase=phase,
            measuredOffer=dict(date=SRC['sessionDate'],carry=round(a['carry'],1),n=a['n'],sd=round(a['carrySd'],1),scope=label,status='measured offer only; no playing-carry change')))

def cohort(club,phase):
    ss=[s for g in groups if g['club'].startswith(club) and g['cuePhase'].startswith(phase) for s in g['shots']]
    return dict(metrics([s for s in ss if not s['mishit']]),sourceCount=len(ss),held=sum(s['mishit'] for s in ss))
current={f'{n}i-{phase}':cohort(f'{n}-iron',phase) for n,phase in [(4,'before'),(4,'after'),(6,'before'),(7,'before'),(7,'after')]}
current['5W']=cohort('5-wood','cue timing')
b4,a4,b7,a7,a6,a5=[current[k] for k in ['4i-before','4i-after','7i-before','7i-after','6i-before','5W']]
# Historical figures are contextual, using the current rule on source rows.
# Original records/flags remain unchanged; no retrospective rewrite of history.
prior4=[]
for f in ['data/range-2026-09-25-4i.json','data/range-2026-09-25-late.json']:
    for g in read(f)['clubs']:
        if g['club']=='4-iron':prior4+=g['shots']
prior7=next(g['shots'] for e in read('range-20261001-feed.json')['entries'] if e['id']=='oct01-map-20261001-combine-v1' for g in e['bay']['detail']['rangeShots'] if g['club']=='7-iron')
prior={'4-iron':dict(metrics(filtered(prior4,'4-iron')),date='2026-09-25',equipment='KING TEC as documented in the repository; not used today',sources=['data/range-2026-09-25-4i.json','data/range-2026-09-25-late.json']),
       '7-iron':dict(metrics(filtered(prior7,'7-iron')),date='2026-10-01',equipment='KING TEC as documented in the repository; not used today',sources=['range-20261001-feed.json#oct01-map-20261001-combine-v1'])}
three=next(e['bay']['detail']['clubs'][0] for e in read('range-20261111-feed.json')['entries'] if e['id']=='bay-20261111-3h-v1')
scans={}
for g in groups:
    ss=[s for s in g['shots'] if not s['mishit']];cuts=[];rolling=[]
    for k in range(1,len(ss)-2):
        before,after=metrics(ss[:k]),metrics(ss[k:])
        cuts.append({'afterSourceShot':ss[k-1]['shot'],'beforeN':k,'afterN':len(ss)-k,**{m:round(after[m]-before[m],4) for m in ['carry','path','ftp','smash'] if before[m] is not None and after[m] is not None}})
    for k in range(4,len(ss)):
        m=metrics(ss[k-4:k+1]);rolling.append(dict(endingSourceShot=ss[k]['shot'],**{x:m[x] for x in ['carry','path','ftp','smash']}))
    scans[g['club']]={'candidates':cuts,'rollingLastFive':rolling,'verdict':'No additional sustained change is established within this short block. Preserve the user-confirmed pre/post-cue boundary; do not manufacture a winning window or join different cue phases.'}
checks=[]
for src in SRC['sources']:
    checks.append({'file':src['file'],'columns':{k:{'rowMean':round(st.mean(s[k] for s in src['shots'] if s[k] is not None),4),'displayedHeader':v,'difference':round(st.mean(s[k] for s in src['shots'] if s[k] is not None)-v,4)} for k,v in src['appHeader'].items()},'authority':'individual visible shot rows; header is a transcription cross-check, not the clean average'})
analysis={'sessionDate':SRC['sessionDate'],'monitorDisplayedDate':SRC['monitorDisplayedDate'],'dateBasis':SRC['dateBasis'],'equipment':SRC['clubIdentity'],'rule':SRC['mishitDecision'],'cohorts':current,'historicalSameRule':prior,'prior3H':dict(three,date='2026-11-11'),
          'splitScans':scans,'headerChecks':checks,'exclusions':[{'file':g['source'],'club':g['club'],'shot':s['shot'],'reason':s['mishitReason']} for g in groups for s in g['shots'] if s['mishit']],'limits':SRC['limitations']}
save('data/range-2026-11-14-analysis.json',analysis)

def comparisons(title,b,a):
    return dict(title=title,rows=[dict(label=label,before=f'{b[key]:.{dec}f}'+unit,after=f'{a[key]:.{dec}f}'+unit) for key,label,dec,unit in [('carry','Carry',1,' yd'),('best','Best five',1,' yd'),('carrySd','Carry SD',1,' yd'),('cs','Club speed',1,' mph'),('bs','Ball speed',1,' mph'),('smash','Smash',3,''),('path','Path',1,'°'),('ftp','Face-to-path',1,'°'),('apex','Apex',1,' ft')]],beforeCount=f"{b['n']} clean of {b['sourceCount']}",afterCount=f"{a['n']} clean of {a['sourceCount']}")
story=(f"4i — SAME OLD CLUB, BEFORE → CLUB FIRST: {b4['carry']:.1f} → {a4['carry']:.1f} yd carry ({b4['n']}/15 → {a4['n']}/21 clean); best five {b4['best']:.1f} → {a4['best']:.1f}. Speed {b4['cs']:.1f} → {a4['cs']:.1f} mph, ball speed {b4['bs']:.1f} → {a4['bs']:.1f}; smash {b4['smash']:.3f} → {a4['smash']:.3f}. Path {b4['path']:.1f}° → {a4['path']:.1f}° is somewhat less left, but face-to-path stays open (+{b4['ftp']:.1f}° → +{a4['ftp']:.1f}°). The after-cue path mean includes a retained +6.6° shot; medians {b4['pathMedian']:.1f}° → {a4['pathMedian']:.1f}° still point left. Carry SD tightened {b4['carrySd']:.1f} → {a4['carrySd']:.1f} yd at a lower distance. This does not show a 4i comeback or a reason to unbench the KING TEC 4i, which was not used.\n\n"
 f"7i — SAME OLD CLUB, BEFORE → CLUB FIRST: {b7['carry']:.1f} → {a7['carry']:.1f} yd carry (+{a7['carry']-b7['carry']:.1f}); {b7['n']}/7 → {a7['n']}/8 clean. Ball speed {b7['bs']:.1f} → {a7['bs']:.1f}, smash {b7['smash']:.3f} → {a7['smash']:.3f}, apex {b7['apex']:.0f} → {a7['apex']:.0f} ft; carry SD {b7['carrySd']:.1f} → {a7['carrySd']:.1f}. There is a real observed speed/flight gain among kept shots, but not a directional fix: path {b7['path']:.1f}° → {a7['path']:.1f}°, face-to-path +{b7['ftp']:.1f}° → +{a7['ftp']:.1f}°. Absolute face-to-path grew {b7['ftpAbsMean']:.1f}° → {a7['ftpAbsMean']:.1f}° too, so the small pre-cue mean is not just positive and negative values cancelling. Retention fell from 5/7 to 5/8; five good shots are not the whole consistency story. More leftward path and more open face-to-path are compatible with a stronger cut tendency for centered right-handed strikes, but curve/finish was not measured numerically.\n\n"
 f"OLD SET VS KING TEC: Your feeling is useful, but there was no KING TEC trial today. The old 4i pre-cue {b4['carry']:.1f} is only {b4['carry']-prior['4-iron']['carry']:+.1f} yd versus the Sep 25 KING TEC same-rule {prior['4-iron']['carry']:.1f}; the old after-cue 4i is lower. Today's old 7i after-cue {a7['carry']:.1f} is {a7['carry']-prior['7-iron']['carry']:+.1f} yd versus Oct 1 KING TEC {prior['7-iron']['carry']:.1f}, with club speed {a7['cs']:.1f} versus {prior['7-iron']['cs']:.1f} mph. Different dates, effort, heads, lofts and conditions prevent a shaft-flex/weight conclusion. Old 6i before cue: {a6['carry']:.1f} carry, best five {a6['best']:.1f}, 8/10 clean; no today post-cue 6i comparison.\n\n"
 f"5W: {a5['carry']:.1f} carry; best five {a5['best']:.1f}; 6/11 clean across two separately preserved blocks. Compared with Nov 11 3H: carry {three['carry']:.1f} → {a5['carry']:.1f}; apex {three['apex']:.0f} → {a5['apex']:.0f} ft; face-to-path +{three['ftp']:.1f}° → +{a5['ftp']:.1f}°. Similar distance with a higher measured peak; more open-to-path delivery and no landing-angle measurement. The late jump in the mixed table is the club change to 5W, not a 4i breakthrough.\n\n"
 'NEXT TEST: Test one question at a time. First, old 7i with usual feel versus club first, alternating short blocks at the same target and normal effort; record every attempt. Compare kept fraction, carry, path and absolute face-to-path. Then test old versus KING TEC with the same cue, ball and target, and match speed ranges. Record actual loft/shaft specs. Down-the-line and face-on film can test sequencing; radar tables cannot. Keep the 4i benched and playing distances as saved.')
exclusionSummary='\n\n'.join(f"{g['club']}: {len(g['shots'])-len(g['excludedShotNumbers'])} clean of {len(g['shots'])}. "+' '.join(f"Source row {s['shot']}: {s['mishitReason']}." for s in g['shots'] if s['mishit']) for g in groups)
review={'title':'Old KING Forged · club first test','cue':'All irons: old KING Forged / KBS 120 stiff. Your feel: get the club started down and through first. 4i and 7i have separate before/after blocks; no KING TECs today.',
 'tiles':[{'k':'Old 4i · before → after','v':f"{b4['carry']:.1f} → {a4['carry']:.1f}",'n':'carry yd · 14/15 → 18/21 clean'},{'k':'Old 7i · before → after','v':f"{b7['carry']:.1f} → {a7['carry']:.1f}",'n':'carry yd · 5/7 → 5/8 clean'},{'k':'5W · separate club','v':f"{a5['carry']:.1f} yd",'n':f"6/11 clean · best 5 {a5['best']:.1f}"}],
 'takeaway':'The cue produced mixed results: 7i carried farther with a tighter kept-shot carry spread, but its path moved farther left. 4i lost carry. No overall cue or shaft verdict yet.',
 'comparisons':[comparisons('Old 4i · same club',b4,a4),comparisons('Old 7i · same club',b7,a7)],'story':story,'exclusions':exclusionSummary,'references':[{'label':'TrackMan: smash factor','url':'https://www.trackman.com/blog/smash-factor'},{'label':'TrackMan: club path','url':'https://www.trackman.com/blog/club-path'},{'label':'TrackMan: face-to-path','url':'https://www.trackman.com/blog/face-to-path'}],'limits':'\n\n'.join(SRC['limitations'])+'\n\n'+SRC['mishitDecision']}
entries=[{'id':'bay-20261114-club-first-v1','type':'bay','src':'; '.join(s['file'] for s in SRC['sources']),
 'bay':{'date':'2026-11-14','venue':'TrackMan simulator · venue unconfirmed','mode':'Range','unit':'yd','discipline':'swing','norm':'Normalized shown except 6i clip; exact settings unconfirmed','ball':'not shown',
        'setup':'Old KING Forged / KBS 120 stiff · 4i and 7i before/after club first · 6i before · 5W separate · off the deck',
        'finding':f"56 clean of 72. Old 4i {b4['carry']:.1f} → {a4['carry']:.1f}; old 7i {b7['carry']:.1f} → {a7['carry']:.1f} before → club first. 5W {a5['carry']:.1f}. Playing distances unchanged.",
        'detail':{'gist':f"Old 4i {b4['carry']:.1f} → {a4['carry']:.1f} · old 7i {b7['carry']:.1f} → {a7['carry']:.1f} · 56/72 clean · club first",
                  'clubs':[g['avg'] for g in groups],'rangeShots':groups,'sessionReview':review,'story':story,'limits':review['limits'],
                  'sourceRecord':'data/range-2026-11-14-sim.json','rangeCaption':'Six recordings · all today per Jack (monitor date Nov 13 retained in source) · all irons OLD KING Forged, KBS 120 stiff · separate cue cohorts · off the deck · held rows retained with reasons'}}}]

def offer(club,a):return dict(src='tm:2026-11-14-'+club,date='2026-11-14',carry=round(a['carry'],1),n=a['n'],sd=round(a['carrySd'],1),ball='not shown',norm='Normalized ON; settings unconfirmed',how='Off the deck · missing club read / apex <40 ft / exact wood smash <1.40 excluded. Measured offer only.')
entries += [
 {'id':'bag-bench-3h-return-20261114-v1','type':'club-bench','target':'bag-ping-g440-3h-20261024'},
 {'id':'bag-start-5w-20261114-v1','type':'club-start','target':'add-darkspeed-5w-20260812','playingLabel':'5 wood'},
 {'id':'carry-meas-5w-20261114-v1','type':'carry-update','target':'5 wood','club':{'meas':offer('5w',a5)}},
 {'id':'bag-3h-return-note-20261114-v1','type':'club-update','target':'bag-ping-g440-3h-20261024','club':{'noteGist':'Return in progress · 5W taking its place. Prior carries and shots preserved.','noteKeys':[{'k':'Status','v':'Returning','n':'completion not confirmed'}],'note':'RETURN IN PROGRESS, November 14, 2026: Jack says the 3H is being returned and the 5W is coming back to replace it. Removed from the active bag; backup status is temporary pending return completion. Saved playing carry 187 and all prior shots retained. PING G440 3H, Regular, ALTA CB Blue 70 Graphite, right hand; sleeve setting unconfirmed.'}},
 {'id':'bag-5w-returning-20261114-v1','type':'club-update','target':'add-darkspeed-5w-20260812','club':{'noteGist':f"Back in the playing bag · replaces returning 3H · sim offer {a5['carry']:.1f} yd.",'noteKeys':[{'k':'Nov 14 · carry','v':f"{a5['carry']:.1f}",'n':'6/11 clean · offer'},{'k':'Best five','v':f"{a5['best']:.1f}",'n':'off the deck'}],'note':'BACK IN THE BAG, November 14, 2026: Jack says the Cobra Darkspeed X 5W returns in place of the PING 3H being returned. Today identified by Jack despite TrackMan labels 4 Iron (22–27) and 4 Wood (1–5). Six clean of eleven; playing carry not changed. Last repo-reported loft 19.5° is not a new sleeve reading; current setting unconfirmed. UST Mamiya LIN-Q M40X Blue 6 graphite, Regular flex.'}},
 {'id':'history-sim-and-bag-20261114-v1','type':'history','date':'2026-11-14','text':f"Today's 72-shot sim: ALL irons old KING Forged / KBS 120 stiff, no KING TECs. Before → club first: 4i {b4['carry']:.1f} → {a4['carry']:.1f}; 7i {b7['carry']:.1f} → {a7['carry']:.1f}. Old 6i {a6['carry']:.1f} before cue; 5W {a5['carry']:.1f}. 56 kept / 16 held. Date corrected by Jack. Separate measured offers; no old-iron data assigned to active KING TEC carry rows. 5W back, 3H return in progress; benched 4i unchanged."}
]
plan=None
for e in read('coach-feed.json')['entries']:
    if e.get('type')=='briefing' and e['briefing'].get('course')=='Swing Thoughts — Club by Club':plan=copy.deepcopy(e['briefing'])
assert plan
plan['focus']='Current feel: CLUB FIRST — get the club started down and through first. All November 14 irons were old KING Forged / KBS 120 stiff, not KING TEC. Same-club 4i/7i before-and-after results are mixed; sequencing was not filmed.'
plan['sections']=[s for s in plan['sections'] if not any(t in s['t'] for t in ['fairway finder','The 5-wood'])]
plan['sections'].insert(0,{'t':'Club first','k':'Your late-session cue · old KING Forged irons','b':f"YOURS: get the club started down and through first in the downswing. This is a feel, not an instruction to flip the clubhead past the hands or stop body rotation. Today, old 4i carry {b4['carry']:.1f} → {a4['carry']:.1f}; old 7i {b7['carry']:.1f} → {a7['carry']:.1f}. The 7i flight gain came with a more leftward path and more open face-to-path. Retest without stacking more swing thoughts; use footage to evaluate movement."})
plan['sections'].insert(2,{'t':'5-wood · back in the bag','k':'Replaces returning 3H · measured offer, not playing carry','b':f"YOURS, November 14: 5W comes back in place of the 3H being returned. {a5['carry']:.1f} yd carry, 6/11 clean, best five {a5['best']:.1f}. Six shots were under 4 Iron and five under 4 Wood. Sleeve setting unconfirmed; playing distance stays as saved."})
for s in plan['sections']:
    if s['t']=='Irons':s.update(k='Old KING Forged tested today · KING TEC set unchanged',b='All November 14 iron shots were the old KING Forged / KBS 120 stiff set. The first uploaded 4i block and eight-shot 7i block were after club first; the later-uploaded 15-shot 4i, 10-shot 6i and seven-shot 7i were before it. Today supplies a cue comparison, not an old-versus-KING-TEC head-to-head. Current iron bag/carry settings and the benched KING TEC 4i are unchanged.')
    if s['t']=='Wedges':s.update(k='Keep wedge feels separate from the iron experiment',b='Use your current Bag for available wedges and saved playing distances; no new wedge result or cue was measured in this session.')
plan['rules']=[r for r in plan.get('rules',[]) if not any(t in r for t in ['3-wood','5-wood','blank carries','Mini driver and 4-iron','Irons:'])]
plan['rules']=['Club first is your current feel. Old 4i and 7i have separate before/after blocks; do not blend them.','All irons today were old KING Forged / KBS 120 stiff; no KING TECs.','4i stays benched; 5W returns in place of the 3H being returned.','Mishits held with reasons; measured offers do not change playing carries.']+plan['rules']
plan['sections'].append({'t':'Notes — the paper trail','k':'November 14 · final user corrections','b':'All six recordings belong to today per Jack, despite the monitor Nov 13 date. Upload order is not swing order. The late jump in the mixed 4 Iron table was 5W, not 4i improvement. Smash is club-specific: keep the wood/hybrid 1.40 threshold; no blanket iron threshold. No club read or apex below 40 ft still held for these full-swing blocks. Missing AoA/index alone is not a missing club read. Raw shots retained, history uses kept shots. Earlier mini-out/3W-in and 2i-active descriptions are superseded by current Bag; historical source notes remain.'})
entries.append({'id':'plan-club-first-20261114-v1','type':'briefing','briefing':plan})
save('range-20261114-feed.json',{'updated':'2026-11-14','entries':entries})
for key,a in current.items():print(key, a['n'],'/',a['sourceCount'],'carry',a['carry'],'best5',a['best'],'path',a['path'],'ftp',a['ftp'])

# v293: Jack explicitly requests one full-day result per club, while keeping
# "club first" as a process thought. This supersedes the earlier grouping request.
# Preserve the original entries and raw phase/source metadata; append corrections
# so phones that already applied v292 receive exactly the same combined view.
combined=[]
for club in ['5-wood','4-iron [KING Forged]','6-iron [KING Forged]','7-iron [KING Forged]']:
    blocks=[g for g in groups if g['club'].split(' · ')[0]==club]
    shots=[]
    for block in blocks:
        for original in block['shots']:
            shot=copy.deepcopy(original)
            shot.update(shot=len(shots)+1,sourceShot=original['shot'],sourceGroup=block['club'])
            shots.append(shot)
    kept=[s for s in shots if not s['mishit']]
    avg=dict(metrics(kept),club=club,sourceCount=len(shots),held=len(shots)-len(kept))
    combined.append(dict(club=club,source='Combined November 14 recordings; original file and row on each shot',
        sourceBlocks=[{k:b[k] for k in ['source','sourceId','club','normalization','sourceShotCount','excludedShotNumbers']} for b in blocks],
        sourceShotCount=len(shots),visibleShotCount=len(shots),shots=shots,avg=avg,
        excludedShotNumbers=[s['shot'] for s in shots if s['mishit']],distanceMissingShotNumbers=[],unseenShotNumbers=[],
        measuredOffer=dict(date=SRC['sessionDate'],carry=round(avg['carry'],1),n=avg['n'],sd=round(avg['carrySd'],1),scope=club,status='measured offer only; no playing-carry change')))
summary={g['club']:g['avg'] for g in combined}
analysis.update(combinedClubs=summary,aggregationPolicy='Jack requests all Nov14 shots combined by physical club; club first stays in his process. Earlier cue cohorts are archived provenance, not the current performance grouping.')
save('data/range-2026-11-14-analysis.json',analysis)
combinedStory='\n\n'.join(
    f"{g['club']}: {g['avg']['n']} clean of {len(g['shots'])}; carry {g['avg']['carry']:.1f} yd, best five {g['avg']['best']:.1f}, total {g['avg']['total']:.1f}, roll {g['avg']['roll']:.1f}. Carry SD {g['avg']['carrySd']:.1f} yd. Club speed {g['avg']['cs']:.1f} mph, ball speed {g['avg']['bs']:.1f}, smash {g['avg']['smash']:.3f}; launch {g['avg']['la']:.1f}°, spin {g['avg']['spin']:.0f} rpm, apex {g['avg']['apex']:.1f} ft. Path {g['avg']['path']:+.1f}°, face-to-path {g['avg']['ftp']:+.1f}°, attack angle {g['avg']['aoa']:+.1f}°."
    for g in combined)
combinedStory+='\n\nAll retained shots are weighted equally within their club; averages are not averages of block averages. Best five and carry spread are recalculated from the combined retained rows. All irons were old KING Forged / KBS 120 stiff; no KING TECs today. Playing distances remain unchanged.\n\nPROCESS: Keep your club first thought — get the club started down and through first. Today is recorded as one session per club, without a before/after cue verdict. No sequencing change or shaft advantage is established.'
combinedLimits='\n\n'.join(x for x in SRC['limitations'] if 'before/after' not in x)
combinedLimits+='\n\nCombined row numbers are reference IDs, not a reconstructed swing order. Each row retains its original file, shot number and cue-phase note. Filtering decisions are unchanged from the source blocks.\n\n'+SRC['mishitDecision']
combinedReview=dict(title='Today · one result per club',
    cue='Get the club started down and through first. Kept in Swing Thoughts for your process; today’s stats combine all shots by club.',
    tiles=[dict(k=g['club'].replace('-iron [KING Forged]','i · old Forged').replace('5-wood','5W'),v=f"{g['avg']['carry']:.1f} yd",n=f"{g['avg']['n']} clean of {len(g['shots'])} · best 5 {g['avg']['best']:.1f}") for g in combined],
    takeaway='56 clean of 72 shots across four clubs. All irons: old KING Forged / KBS 120 stiff. Mishits remain held out; playing carries stay as saved.',
    comparisons=[],story=combinedStory,limits=combinedLimits,references=review['references'],
    exclusions='\n\n'.join(f"{g['club']}: {g['avg']['n']} clean of {len(g['shots'])}. "+' '.join(f"{s['videoSource']['file']} row {s['videoSource']['row']}: {s['mishitReason']}." for s in g['shots'] if s['mishit']) for g in combined))
combinedGist=' · '.join(f"{g['club'].replace('-iron [KING Forged]','i').replace('5-wood','5W')} {g['avg']['carry']:.1f}" for g in combined)+' yd · 56/72 clean'
entries.append(dict(id='bay-20261114-combined-v2',type='bay-update',target='bay-20261114-club-first-v1',
    bay=dict(setup='Old KING Forged / KBS 120 stiff · full-day 4i, 6i, 7i and 5W · off the deck',
        finding=combinedGist+'. All shots combined per club; club first retained as a process thought.',
        detail=dict(gist=combinedGist,clubs=[g['avg'] for g in combined],rangeShots=combined,
            sessionReview=combinedReview,story=combinedStory,limits=combinedLimits,
            rangeCaption='All six recordings combined into one result per club at Jack’s request. All irons OLD KING Forged / KBS 120 stiff. Every original row and exclusion remains traceable.'))))
combinedPlan=copy.deepcopy(plan)
combinedPlan['focus']='Current feel: CLUB FIRST — get the club started down and through first. Kept for your process. November 14 stats combine all shots by club; no before/after cue verdict.'
for section in combinedPlan['sections']:
    if section['t']=='Club first':
        section.update(k='Your process thought · kept at your request',b='YOURS: get the club started down and through first in the downswing. This is a feel, not an instruction to flip the clubhead past the hands or stop body rotation. Keep it in your process. November 14 is now one combined result per club; the stats are not being used as a before/after cue test.')
    if section['t']=='Irons':
        section.update(b='All November 14 iron shots were old KING Forged / KBS 120 stiff. The full day is combined by club: 4i 153.6 yd (32/36), 6i 142.3 (8/10), 7i 129.3 (10/15). KING TEC irons were not used. Current iron bag/carry settings and the benched KING TEC 4i are unchanged.')
combinedPlan['rules'][0]='Keep club first as your process thought. November 14 stats combine all retained shots by club; no before/after cue performance split.'
entries.append(dict(id='plan-club-first-process-20261114-v2',type='briefing',briefing=combinedPlan))
entries.append(dict(id='history-sim-combined-20261114-v2',type='history-edit',match="Today's 72-shot sim: ALL irons old KING Forged / KBS 120 stiff, no KING TECs.",text="Today's 72-shot sim: ALL irons old KING Forged / KBS 120 stiff, no KING TECs. Jack requests one combined result per club: "+combinedGist+'. Every raw row and mishit exclusion retained. Club first stays in Swing Thoughts for his process; no cue performance split. Playing carries unchanged; 5W back, 3H return in progress, 4i remains benched.'))
save('range-20261114-feed.json',{'updated':'2026-11-14','entries':entries})
for g in combined:print('Combined',g['club'],g['avg'])
