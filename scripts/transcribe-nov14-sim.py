"""Exact visible rows from Jack's six recordings; club identities corrected by Jack."""
import json, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
COLS = 'shot cs aoa path face ftp bs smashIndex la ld spin carry total height'.split()
def rows(text):
    out=[]
    for line in text.strip().splitlines():
        vals=[None if v=='-' else float(v) for v in line.split()]
        assert len(vals)==len(COLS),line
        s=dict(zip(COLS,vals));s['shot']=int(s['shot']);s['spin']=int(s['spin'])
        s['smash']=round(s['bs']/s['cs'],4) if s['cs'] else None
        out.append(s)
    return out
mixed=rows('''
1 80.6 -3.0 -11.2 1.0 12.3 107.0 99 17.0 -1.6 5789 144.5 155.9 65
2 80.6 -7.2 -7.9 0.3 8.1 108.0 98 12.0 -1.6 6278 140.8 159.3 48
3 80.0 -6.7 -8.4 -0.2 8.2 111.9 104 14.6 -1.9 5826 153.2 164.9 65
4 77.7 - 6.6 10.2 3.6 110.6 - 12.2 9.6 4993 150.4 172.7 50
5 79.3 -7.3 -7.8 0.7 8.6 111.8 103 12.3 -1.1 5995 148.9 166.2 53
6 79.0 -4.8 -7.7 -1.4 6.3 102.6 95 14.9 -2.8 5492 136.4 153.8 52
7 80.1 -4.9 -6.1 -0.5 5.6 115.0 105 16.1 -1.6 5551 161.4 170.2 77
8 80.9 -3.7 -7.1 0.8 7.9 110.1 99 15.0 -1.0 5904 149.8 161.3 64
9 72.8 -3.7 -7.1 -2.0 5.1 105.3 103 13.5 -3.2 4922 142.1 163.8 49
10 73.2 - -3.1 -2.7 0.5 102.5 - 11.2 -2.8 4381 132.0 162.7 35
11 77.0 -3.5 -7.3 -3.5 3.8 104.3 96 13.6 -4.3 4562 141.0 164.7 47
12 76.8 -7.5 -3.1 1.5 4.6 108.5 104 13.9 0.6 5560 147.6 163.0 57
13 79.6 -7.4 -7.0 0.6 7.5 113.6 107 15.3 -0.9 6021 156.2 165.4 71
14 76.8 -7.5 -6.7 -0.6 6.1 106.0 100 11.6 -1.8 4899 138.8 165.6 41
15 - - -5.6 -5.3 0.3 82.3 - 15.0 -5.4 3464 93.9 128.1 25
16 77.4 -7.1 -6.4 -0.7 5.7 109.4 105 15.0 -1.8 5504 150.6 163.2 63
17 - - -6.9 0.7 7.6 97.7 - 16.2 -0.7 4348 129.9 152.6 47
18 80.3 -3.6 -6.9 0.5 7.5 114.3 103 15.5 -1.1 5637 159.6 169.0 73
19 80.9 -6.1 -8.3 -3.5 4.8 107.0 97 15.9 -4.3 3853 150.9 172.6 57
20 76.3 -4.0 -4.3 0.8 5.0 110.5 103 13.0 -0.3 4949 152.4 171.9 54
21 77.1 -7.5 -6.1 -6.4 -0.3 110.5 103 12.0 -6.3 4744 151.7 174.8 50
22 87.3 -3.5 -0.6 2.4 3.0 128.9 102 10.7 1.9 3641 193.3 217.3 62
23 87.9 -1.4 0.3 6.1 5.9 123.8 98 13.0 5.3 2819 188.1 217.4 59
24 90.6 -1.9 2.5 17.2 14.6 98.7 78 10.8 12.8 6414 34.9 76.8 5
25 88.0 -1.5 -2.6 5.0 7.6 122.6 99 15.8 3.9 3316 188.8 206.0 79
26 87.1 -0.9 -2.5 3.0 5.5 127.7 102 14.1 2.2 3308 198.3 217.0 77
27 90.5 0.4 -5.8 1.3 7.1 128.4 99 14.5 -0.1 4689 189.2 199.3 88
''')
seven=rows('''
1 75.0 -7.4 -6.1 2.0 8.1 98.5 107 22.9 0.6 5295 134.1 140.2 78
2 76.0 -4.7 -4.1 0.2 4.4 100.6 99 19.6 -0.5 4705 139.8 150.9 68
3 77.2 - -6.6 1.1 7.7 103.6 - 5.9 -0.4 4433 105.7 139.3 13
4 71.0 - -6.4 -5.2 1.2 81.0 - 18.0 -5.4 4726 96.4 121.1 34
5 75.2 -4.4 -5.1 -0.2 4.9 98.6 98 18.1 -1.4 6253 130.1 139.2 61
6 77.0 -5.9 -6.2 -3.2 3.0 103.0 103 19.8 -3.8 6554 137.9 142.5 76
7 76.6 - -5.6 2.3 7.9 99.3 - 10.9 0.6 5249 118.2 150.0 29
8 79.0 -7.1 -6.6 0.3 6.9 100.7 101 21.7 -0.9 5145 138.6 145.9 77
''')
wood=rows('''
1 88.6 -2.7 -0.9 2.5 3.4 124.9 97 11.7 1.9 3141 188.0 216.1 58
2 - - 0.0 1.0 1.0 99.6 - 19.8 0.9 3042 143.8 163.7 62
3 86.0 -2.2 0.4 -0.8 -1.2 127.8 100 7.6 -0.5 3069 177.0 213.5 35
4 85.1 -1.4 -2.0 11.2 13.2 98.9 85 17.9 9.1 3763 136.7 157.6 55
5 89.6 -2.6 -2.4 2.5 4.9 130.4 101 13.5 1.6 4229 196.8 208.7 86
''')
files=['ScreenRecording_11-14-2026 05-20-32_1.mp4','ScreenRecording_11-14-2026 05-24-02_1.mp4','ScreenRecording_11-14-2026 05-26-54_1.mp4']
headers=[dict(cs=80.7,aoa=-4.5,path=-5.1,face=.9,ftp=6.,bs=110.3,smashIndex=100,la=13.9,ld=-.3,spin=4921,carry=149.1,total=168.7,height=56),dict(cs=75.9,aoa=-5.9,path=-5.8,face=-.3,ftp=5.5,bs=98.2,smashIndex=101,la=17.1,ld=-1.4,spin=5295,carry=125.1,total=141.1,height=55),dict(cs=87.3,aoa=-2.2,path=-1.,face=3.3,ftp=4.3,bs=116.3,smashIndex=96,la=14.1,ld=2.6,spin=3449,carry=168.5,total=191.9,height=59)]
sources=[]
for i,(shots,label) in enumerate([(mixed,'4 Iron'),(seven,'7 Iron'),(wood,'4 Wood')]):
    for s in shots:
        s['club']='4-iron' if i==0 and s['shot']<=21 else '7-iron' if i==1 else '5-wood'
    sources.append(dict(file=files[i],sourceId=['mixed-4i-5w','7i-after-cue','5w-fourwood-label'][i],screenClub=label,normalization='Normalized visible on Shot Analysis; settings unknown',appHeader=headers[i],shots=shots))
old4=rows('''
1 81.0 -7.3 -5.3 1.4 6.8 114.0 104 14.2 0.1 5715 156.9 169.2 65
2 81.6 -6.5 -9.4 -4.1 5.3 118.7 105 13.2 -5.0 4522 171.5 187.7 67
3 81.3 - -6.3 0.5 6.9 113.4 - 11.0 -0.8 5128 151.7 176.5 46
4 80.6 -3.1 -8.0 -2.2 5.8 111.4 99 14.1 -3.4 4969 155.3 171.6 60
5 82.0 -5.2 -8.7 -1.9 6.8 109.5 96 13.0 -3.4 5384 147.9 167.0 53
6 82.2 -7.4 -6.9 -0.1 6.8 112.8 100 12.9 -1.4 5463 153.1 171.1 56
7 - - -10.0 -1.5 8.5 101.8 - 13.9 -3.3 5129 134.1 156.4 46
8 84.1 -3.8 -8.8 -1.6 7.2 118.5 100 12.4 -3.1 4910 166.4 184.7 60
9 81.7 -7.6 -9.3 -1.3 8.0 117.8 106 12.6 -2.8 5607 163.4 177.3 64
10 83.3 -6.0 -10.0 -2.3 7.6 118.2 102 11.8 -3.7 4673 166.5 186.9 58
11 81.2 -7.3 -10.0 0.1 10.1 114.3 104 13.2 -2.0 6216 153.7 167.2 60
12 81.1 -5.8 -5.0 -2.7 2.3 117.3 105 13.9 -3.2 5094 167.0 179.2 70
13 80.0 -7.7 -6.4 -2.4 4.0 118.4 108 13.5 -3.1 4741 170.4 184.7 68
14 78.6 -3.1 -8.1 -1.4 6.7 109.0 98 11.9 -3.0 5240 145.2 168.5 46
15 82.0 -3.0 -8.7 -2.4 6.3 119.3 103 13.9 -3.6 4735 171.3 185.7 70
''')
old6=rows('''
1 - - -7.4 -0.9 6.5 98.8 - 16.6 -2.4 6116 129.6 142.0 55
2 80.8 -5.4 -6.3 1.1 7.4 106.1 99 18.0 -0.5 6329 143.4 150.1 73
3 76.0 -5.2 -0.7 -3.7 -3.0 109.6 104 14.5 -3.1 4963 152.9 168.5 61
4 78.2 -5.3 -1.6 1.5 3.0 107.4 98 13.1 0.8 5648 144.1 161.7 52
5 77.4 - -5.1 -1.2 3.9 99.5 - 15.9 -2.0 5567 131.9 147.4 53
6 - - - - - 90.4 - 3.3 0.2 2549 12.9 48.8 0
7 80.6 -2.2 -5.8 -0.7 5.2 111.5 100 16.4 -1.9 6167 153.3 160.2 75
8 80.8 - -2.7 -0.4 2.3 102.0 - 17.0 -0.8 5362 138.5 151.1 60
9 78.0 -3.9 1.2 4.9 3.7 107.6 102 18.1 4.1 5401 149.7 158.1 75
10 75.0 -7.4 -2.4 0.5 2.9 94.5 95 17.2 0.0 4818 124.7 143.4 49
''')
old7=rows('''
1 73.7 -5.3 -2.5 -1.7 0.9 91.8 93 18.0 -1.9 5505 118.7 133.6 50
2 - - 3.1 0.9 -2.2 76.7 - 20.3 1.1 1461 87.6 121.4 28
3 70.3 - -0.1 -1.8 -1.7 95.5 - 7.6 -1.5 4054 100.6 136.2 15
4 72.4 - -1.6 -1.2 0.3 93.8 - 16.7 -1.3 6178 120.2 134.1 49
5 75.0 - -3.4 -5.3 -1.9 101.9 - 13.8 -4.9 6185 133.3 149.0 49
6 77.4 -6.5 0.9 3.4 2.5 96.3 94 18.0 2.8 6055 126.4 136.8 57
7 75.0 -6.6 -3.9 -3.0 0.9 89.7 90 17.6 -3.2 5673 113.7 129.9 46
''')
oldHeaders=[dict(cs=81.5,aoa=-5.7,path=-8.1,face=-1.5,ftp=6.6,bs=114.3,smashIndex=102,la=13.0,ld=-2.8,spin=5168,carry=158.3,total=175.6,height=59),dict(cs=78.4,aoa=-4.9,path=-3.4,face=.1,ftp=3.5,bs=102.7,smashIndex=100,la=15.0,ld=-.6,spin=5292,carry=128.1,total=143.1,height=55),dict(cs=74.0,aoa=-6.1,path=-1.1,face=-1.2,ftp=-.2,bs=92.2,smashIndex=93,la=16.0,ld=-1.3,spin=5016,carry=114.4,total=134.5,height=42)]
for shots,num,clip,header in zip([old4,old6,old7],[4,6,7],['05-30-41','05-31-15','05-31-56'],oldHeaders):
    for s in shots:s['club']=f'{num}-iron [KING Forged]'
    sources.append(dict(file=f'ScreenRecording_11-14-2026 {clip}_1.mp4',sourceId=f'king-forged-{num}i-before-cue',screenClub=f'{num} Iron',screenModel='Tec / Cobra' if num in [6,7] else '4 Iron (no model shown)',equipment='Old Cobra KING Forged irons; KBS 120 stiff shafts, as reported by Jack. Exact head generation, loft and shaft submodel unconfirmed.',identityBasis='Jack explicitly identifies these three clips as his old irons before any cue change; saved TrackMan model labels do not override his identification.',normalization='Normalized visible on Shot Analysis; settings unknown' if num!=6 else 'Not visible in this clip; other clips in the supplied session show Normalized',cuePhase='before club first cue',appHeader=header,shots=shots))
out=dict(sessionDate='2026-11-14',receivedDate='2026-11-14',dateBasis='Jack explicitly corrected all six clips to today, November 14, 2026. TrackMan displays Nov 13; source date retained separately. Date discrepancy cause unconfirmed.',monitorDisplayedDate='2026-11-13',swingThought=dict(cue='Club first',wording='Get the club started down and through first in the downswing.',evidence='Jack-reported feel, not measured body sequencing.',confirmedAfterCue='All eight 7-iron shots.',correction='The apparent late 4-iron jump was a different club. Initial cue-click interpretation is superseded; shots 22–27 are 5-wood.'),clubIdentity='Jack confirmed 4 Iron rows 1–21 are 4i and all rows 22–27 are 5W; the separate 4 Wood table is 5W. 7 Iron is the 7i after the cue change.',mishitDecision='Final Jack clarification November 14: smash adjust as agreed, but remove mishits correctly. Missing club speed/read and apex below 40 ft remain exclusion checks for all clubs in these full-swing blocks. Woods/hybrids also require exact ball-speed / club-speed >= 1.40; irons have no blanket 1.40 cutoff. Preserve imperfect iron strikes that pass the other checks and the carry-cluster top filter. An absent AoA or Smash Index alone is not a missing club reading when club speed is captured.',sources=sources,limitations=['No actual swing footage; cannot infer hand/hip/club sequence or prove cue causation.','No same-club, same-day pre/post-cue 7i pair.','No numeric landing angle or lateral-finish column; do not estimate dispersion from the overview image.','Venue, ball and normalization temperature/altitude unconfirmed.','The first 4 Iron header mixes two clubs and is only a transcription checksum, never a 4i average.','Other clubs shown only in overview are not imported without their shot rows.','7i Smash Index visible values average 101.6 while the header shows 101; preserve both. This percent index is not used to calculate smash or exclusions.'])
out['clubIdentity']='FINAL Jack correction: every iron shot in all six clips is with his OLD Cobra KING Forged irons, KBS 120 stiff shafts. No KING TEC iron was used today. First recording: 4i rows 1–21 AFTER the cue, then 5W rows 22–27. Eight-shot 7i recording AFTER the cue. Later uploaded 4i (15), 6i (10) and 7i (7) clips BEFORE the cue. Upload order is not swing order. TrackMan Tec / Cobra labels do not override the user-confirmed equipment.'
for src in sources:
    for s in src['shots']:
        if s['club'] in ['4-iron','7-iron']:s['club']+=' [KING Forged]'
        s['cuePhase']='after club first cue' if src['sourceId'] in ['mixed-4i-5w','7i-after-cue'] and 'iron' in s['club'] else 'before club first cue' if src['sourceId'].startswith('king-forged') else 'cue timing unconfirmed'
    if any('iron' in s['club'] for s in src['shots']):
        src['equipment']='Old Cobra KING Forged irons; KBS 120 stiff shafts, as reported by Jack. Exact head generation, loft and shaft submodel unconfirmed. No KING TEC irons today.'
        src['identityBasis']='Final direct user corrections: all irons are the old set; the first 21-shot 4i block and eight-shot 7i block are after club first.'
out['swingThought']['confirmedAfterCue']='Old KING Forged 4i rows 1–21 in the first recording, and all eight old KING Forged 7i shots in the second recording.'
out['swingThought']['confirmedBeforeCue']='Old KING Forged 4i (15 shots), 6i (10 shots) and 7i (7 shots) in the three later uploads.'
out['limitations'][1]='Same-equipment, same-day before/after blocks exist for 4i and 7i. They were not randomized or speed-matched; differences do not isolate cue causation from effort, fatigue, warm-up or order.'
out['limitations'] += ['Old 6i normalization setting not shown in its clip. All six clips assigned to November 14 by Jack; the monitor displays November 13 in the dated overviews.','Old KING Forged head generation, loft and precise shaft submodel are not established. Do not attribute a result to shaft flex or weight alone.','Old 7i visible Smash Index values average 92.33 versus header 93; row-derived total is 134.43 versus table header 134.5 and overview 134.4. Preserve rows and displayed summaries separately.']
(ROOT/'data/range-2026-11-14-sim.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print('Transcribed',sum(len(s['shots']) for s in sources),'rows across',len(sources),'recordings.')
