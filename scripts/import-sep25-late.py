"""Verified visible tables; regenerate only the new append-only Sep25 batch."""
import json, statistics, pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
FIELDS='carry total cs bs smash spin spinAxis aoa ftp path face la ld height carrySide totalSide dynLoft impactH spinLoft impactO landAngle curve'.split()
def shots(rows):
    return [dict(shot=i+1,**dict(zip(FIELDS,r))) for i,r in enumerate(rows)]
clubs=[
dict(club='4-iron',target=202,source='ScreenRecording_09-25-2026 23-01-35_1.mp4',carryHits=[],totalHits=[3,10],shots=shots([
 [41.9,73.5,78.4,108.6,1.39,1993,15.1,None,.4,-3.2,-2.8,1.8,-2.9,"1'2\"","4'5\"L","6'L",3.7,-26,None,20,2.4,"1'10\"R"],
 [90.7,125.7,78.7,102.8,1.31,2188,2.2,None,-.5,-5.8,-6.2,6.2,-6.2,"9'5\"","27'11\"L","37'10\"L",8.3,16,None,15,9.6,"1'6\"R"],
 [169.7,210.5,84.1,117.8,1.40,3202,4.6,-5.5,1.4,-4.9,-3.5,11.4,-3.7,"48'1\"","18'5\"L","18'6\"L",14.1,3,19.7,15,29.1,"14'8\"R"],
 [146.9,185.2,78.5,114.6,1.46,3823,13.7,-5.6,4.5,-5.4,-.9,8.2,-1.8,"31'11\"","23'R","39'6\"R",11.5,-7,17.6,-7,23.2,"36'7\"R"],
 [None,None,82.5,118.1,1.43,3392,-1.4,-5.4,-.4,-5.4,-5.8,8.8,-5.8,"37'1\"",None,None,11.7,-4,17.1,17,24.6,"4'1\"L"],
 [None,None,77.8,108.8,1.40,3509,22.2,None,4.6,-6.6,-2.0,5.3,-2.9,"12'6\"",None,None,8.4,-17,None,3,None,"30'1\"R"],
 [39.9,70.3,79.3,104.8,1.32,3516,35.3,-7.3,9.2,-7.5,1.7,1.4,-.4,"0'10\"","4'10\"R","14'5\"R",3.9,-26,14.5,-3,2.0,"5'7\"R"],
 [136.4,173.7,79.9,110.8,1.39,4334,13.3,-6.2,5.7,-7.3,-1.7,7.3,-2.9,"26'3\"","11'3\"R","25'10\"R",11.0,-13,18.1,16,21.2,"31'11\"R"],
 [156.1,182.0,77.9,111.4,1.43,3985,7.0,-2.5,4.2,-6.2,-2.0,12.4,-2.8,"50'4\"","1'1\"L","3'4\"R",15.9,-4,19.0,18,32.1,"21'11\"R"],
 [164.2,201.5,80.0,117.4,1.47,3980,5.7,-7.8,1.5,-5.8,-4.3,10.0,-4.5,"46'2\"","19'8\"L","18'7\"L",13.4,-8,21.3,19,29.7,"19'3\"R"]
])),
dict(club='7-iron',target=147,source='ScreenRecording_09-25-2026 23-02-14_1.mp4',carryHits=[1],totalHits=[1,3,6,8],shots=shots([
 [136.7,146.5,76.1,102.7,1.35,6212,5.8,-6.6,5.4,-5.8,-.4,15.9,-1.6,"59'3\"","6'8\"R","9'9\"R",21.9,3,29.0,14,39.6,"18'1\"R"],
 [None,None,76.5,102.4,1.34,6113,13.0,None,3.3,-5.1,-1.8,13.8,-2.5,"48'8\"",None,None,19.8,-14,None,4,35.1,"37'3\"R"],
 [121.9,143.0,73.2,95.3,1.30,5838,9.1,-4.9,7.0,-6.2,.8,15.4,.9,"45'7\"","16'2\"R","25'1\"R",21.4,-7,27.1,21,34.7,"22'R"],
 [121.0,159.6,77.8,96.3,1.24,4077,0.0,None,1.9,-5.7,-3.8,12.5,-4.3,"33'1\"","27'5\"L","36'2\"L",16.8,10,None,14,26.5,"1'R"],
 [None,None,73.3,104.6,1.43,5045,8.0,-5.5,4.8,-8.3,-3.5,14.5,-4.5,"53'5\"",None,None,19.3,-5,25.3,0,35.7,"24'1\"R"],
 [133.9,144.3,75.9,102.2,1.35,6649,7.8,-5.6,5.7,-6.1,-.4,15.2,-1.9,"56'3\"","10'11\"R","15'5\"R",21.7,-6,27.9,13,38.8,"23'10\"R"],
 [None,None,73.7,102.9,1.40,5607,3.4,-7.9,1.1,-4.8,-3.7,13.8,-3.9,"49'10\"",None,None,19.3,1,27.2,14,35.2,"10'R"],
 [130.2,149.7,71.9,99.7,1.39,5899,8.7,-5.0,5.4,-5.3,.2,14.9,-1.1,"49'10\"","16'1\"R","24'5\"R",20.8,-5,26.4,13,35.9,"23'9\"R"]
])),
dict(club='58°',target=98,source='ScreenRecording_09-25-2026 23-02-40_1.mp4',carryHits=[],totalHits=[3,6],shots=shots([
 [62.1,87.7,55.4,63.5,1.15,6161,5.3,None,-1.9,4.1,2.3,19.0,2.8,"21'1\"","12'10\"R","20'6\"R",28.8,-16,None,1,28.3,"3'8\"R"],
 [74.9,84.0,66.0,64.1,.97,2447,1.6,None,-.9,-.7,-1.5,36.8,-1.4,"54'5\"","4'5\"L","4'8\"L",40.7,7,None,15,47.3,"1'3\"R"],
 [83.1,92.2,63.7,68.9,1.08,3175,-2.4,-7.6,-5.4,3.0,-2.4,34.4,-1.7,"58'3\"","9'9\"L","11'4\"L",39.0,8,46.8,11,47.0,"2'7\"L"],
 [74.1,87.4,58.6,64.0,1.09,2754,-1.4,None,-7.0,1.3,-5.8,31.6,-4.9,"43'9\"","20'1\"L","23'11\"L",35.9,-1,None,14,41.7,"1'1\"L"],
 [53.8,87.1,54.7,69.9,1.28,3437,-.8,None,-7.5,.3,-7.1,10.2,-5.7,"8'8\"","16'5\"L","26'10\"L",14.9,-19,None,-14,13.9,"4'L"],
 [69.5,103.2,60.2,68.7,1.14,6482,1.9,None,-3.0,3.3,.3,17.0,1.1,"21'11\"","5'10\"R","10'1\"R",26.5,-15,None,-17,27.3,"1'8\"R"],
 [79.7,91.6,64.0,66.2,1.04,2307,-2.6,None,-3.7,-.7,-4.4,34.1,-4.1,"52'2\"","19'2\"L","22'5\"L",37.6,-5,None,8,44.5,"2'2\"L"],
 [84.3,112.5,66.6,77.0,1.16,6127,0.0,None,-6.3,.5,-5.8,15.6,-4.2,"26'3\"","18'5\"L","24'7\"L",23.5,-17,None,-14,28.0,"0'"],
 [73.3,82.7,58.4,64.3,1.10,3722,1.0,-7.4,-2.7,-.8,-3.5,32.3,-3.1,"46'3\"","11'L","12'2\"L",38.1,-2,45.6,-3,44.0,"10\"R"],
 [68.0,77.4,56.8,60.9,1.07,2998,4.8,-7.6,.4,-.3,.1,35.0,0.0,"45'10\"","3'7\"R","4'11\"R",40.0,4,47.6,12,45.2,"3'5\"R"]
])),
dict(club='Driver',target=218,source='ScreenRecording_09-25-2026 23-03-00_1.mp4',carryHits=[1],totalHits=[1,2,3,4],shots=shots([
 [224.3,245.1,96.4,138.8,1.44,2830,13.2,.1,5.1,-6.1,-1.1,14.1,-1.7,"86'4\"","45'3\"R","56'9\"R",16.0,5,16.7,8,37.6,"65'3\"R"],
 [215.5,236.6,89.8,132.3,1.47,2598,4.1,1.6,5.5,-4.3,1.2,15.6,.5,"85'8\"","23'8\"R","28'1\"R",17.5,0,16.8,14,37.6,"18'2\"R"],
 [210.6,241.6,94.1,132.4,1.41,2149,18.3,.2,3.9,-6.4,-2.5,15.2,-2.6,"71'11\"","33'6\"R","49'3\"R",16.7,11,17.0,8,32.4,"64'9\"R"],
 [205.8,238.2,92.4,135.7,1.47,2632,8.3,-1.2,1.2,-4.4,-3.2,9.9,-3.4,"52'5\"","5'2\"L","2'R",11.9,-2,13.2,1,27.3,"31'5\"R"]
]))]
for g in clubs:
    g.update(sourceShotCount=len(g['shots']),visibleShotCount=len(g['shots']),unseenShotNumbers=[])
    for row in g['shots']:
        assert len(row)==len(FIELDS)+1
        assert abs(row['bs']/row['cs']-row['smash'])<.015
        assert abs(row['face']-row['path']-row['ftp'])<.21
    if g['club']=='4-iron':
        for row in g['shots']:
            if row['shot'] in [1,2,7]:
                row.update(mishit=True,mishitReason='Clear low-flight carry outlier: below two-thirds of the struck carry cluster, with very low apex.')
            if row['shot']==6:
                row.update(mishit=True,mishitReason='Reviewed low-face mishit: 5.3 degree launch, 12 ft 6 in apex, impact 17 mm down. Distances absent.')
    if g['club']=='58°':
        for row in g['shots']:
            if row['shot'] in [1,5,6,8]:
                row.update(mishit=True,mishitReason='Reviewed thin/skull pattern: 10.2–19 degree launch, low apex, impact 15–19 mm down; excluded from normal-flight analysis.')
    for row in g['shots']:
        if row['carry'] is None and row['total'] is None:
            row['distanceStatus']='not recorded; not estimated'
            row['contactReview']='clear mishit' if row.get('mishit') else 'Not an obvious mishit from visible launch, height and speed transfer; distance unverified.'
raw=dict(date='2026-09-25',environment='TrackMan indoor range; ball, normalization, temperature and altitude not shown in these captures.',
    units=dict(distance='yd',speed='mph',angles='deg',height='ft/in',impact='mm; positive up/toe, negative down/heel'),
    review='32 visible rows. Five have no carry/total; four are contact-plausible, one is a clear low-flight mishit. Seven additional distance-bearing mishits are held out. No estimated distances generated. 4i row 6 landing angle is obscured and left null.',clubs=clubs)
(ROOT/'data/range-2026-09-25-late.json').write_text(json.dumps(raw,ensure_ascii=False,indent=2)+'\n')
groups=[]; summaries=[]
for g in clubs:
    absent=[s for s in g['shots'] if s['carry'] is None and s['total'] is None]
    distance=[s for s in g['shots'] if s not in absent]
    retained=[s for s in distance if not s.get('mishit')]
    summary={'club':g['club'],'n':len(retained),'held':len(distance)-len(retained),'metricCounts':{}}
    for key in FIELDS:
        vals=[s[key] for s in retained if isinstance(s[key],(int,float))]
        if vals:
            summary[key]=round(statistics.mean(vals),3);summary['metricCounts'][key]=len(vals)
    summaries.append(summary)
    groups.append({**g,'shots':distance,'distanceMissingShotNumbers':[s['shot'] for s in absent],
        'excludedShotNumbers':[s['shot'] for s in distance if s.get('mishit')], 'avg':summary,
        'distanceMissingReview':[{'shot':s['shot'],'review':s['contactReview'],'reason':s.get('mishitReason'),**{k:s[k] for k in ['cs','bs','smash','la','height']}} for s in absent]})
entry={'id':'bay-20260925-late-four-clubs-v1','type':'bay','src':'tm:2026-09-25-late-four-clubs','bay':{
    'date':'2026-09-25','venue':'TrackMan Range · indoor sim','mode':'Range','unit':'yd','discipline':'swing',
    'setup':'Sep 25 additional batch · 4i, 7i, Hi-Toe 58°, Driver · 20 usable measured-distance shots',
    'finding':'20 retained shots; 7 distance-bearing mishits held out. Five distance-missing rows separately archived; one of those is also a reviewed mishit. No guessed distances.',
    'detail':{'gist':raw['review'],'rangeCaption':'Additional Sep25 captures. 32 visible rows; 5 missing distances and 7 further mishits excluded.',
        'clubs':summaries,'rangeShots':groups,'sourceRecord':'data/range-2026-09-25-late.json',
        'limits':'Separate source blocks, unknown ball/normalization. Contact-plausible does not establish carry. All exclusions retained in raw transcript; no outdoor carries changed.'}}}
path=ROOT/'range-20260925-feed.json';feed=json.loads(path.read_text())
if not any(e['id']==entry['id'] for e in feed['entries']):
    feed['entries'].append(entry);path.write_text(json.dumps(feed,ensure_ascii=False,indent=2)+'\n')
for c in summaries: print(c['club'],c['n'],c['carry'],c['total'])
