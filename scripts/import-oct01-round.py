"""Reproducible, manually verified Oct 1 video transcript; emits apply_patch only."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
# hole: par, score, stroke index, tee yardage
HEADERS = [(5,5,6,488),(4,5,10,375),(4,3,2,399),(3,3,18,154),(4,4,8,353),(4,5,16,331),(3,5,12,187),(5,5,4,499),(4,4,14,297),(5,6,6,518),(3,4,12,220),(5,5,4,481),(4,4,10,489),(4,4,2,439),(3,3,18,140),(4,3,16,296),(3,7,14,220),(4,5,8,360)]
# Each non-putting observation: selected club,total yd,finish,remaining,ftp,smash,height,spin,launch,dynamic loft,frame second.
ROWS = {
1:[['Dr',267,'deep rough','199 yd',-1.3,1.50,"36\'1\"",2082,8.4,9.9,0],['58',112,'fairway','89 yd',.3,1.25,"64\'7\"",5319,22.3,28.2,3],['58',99,'green','28 ft 9 in',-1.7,1.06,"53\'3\"",3374,30.1,34.9,5]],
2:[['Dr',26,'rough','345 yd',1.3,1.34,'5"',1224,2.2,3.2,9],['3w',215,'fairway','107 yd',1.7,1.46,"57\'5\"",2941,10.5,12.7,11],['58',89,'fairway','10 yd',None,None,"34\'6\"",5429,22.2,None,13],['58',10,'hole direction','1 yd',9.8,1.14,"1\'6\"",1013,28.5,35.7,15]],
3:[['Dr',242,'fairway','145 yd',.5,1.48,"45\'4\"",2609,8.9,10.8,16],['9i',135,'hole direction','2 yd',-1.3,1.31,"61\'",6712,17.2,24,19]],
4:[['8i',163,'rough','16 yd',4.6,1.39,"69\'3\"",5222,16,20.8,22],['58',27,'green','30 ft 4 in',7.7,.90,"4\'7\"",1772,33.1,41.6,24]],
5:[['5i',246,'rough','87 yd',1.7,1.45,"75\'8\"",2635,13,14.9,26],['58',82,'fairway','6 yd',.7,1.02,"40\'8\"",4419,30.9,38.1,28],['58',5,'hole direction','0 yd',14.6,1.21,'8"',950,27.1,36.7,30]],
6:[['Dr',213,'rough','115 yd',3.1,1.45,"78\'8\"",4101,10.7,13.6,32],['58',90,'green','50 ft 4 in',-9,1.21,"30\'8\"",4183,22,28,34]],
7:[['8i',130,'deep rough','32 yd',.4,1.26,None,None,21.6,27.7,37],['58',44,'rough','24 yd',1.6,1.14,"21\'2\"",2726,32.5,38.7,38],['58',23,'fringe','5 yd',7.4,1.33,"1\'7\"",1355,28.3,37.9,39],['58',5,'hole direction','1 yd',-2.8,1.24,'9"',825,31.3,40.5,41]],
8:[['Dr',179,'rough','316 yd',1.4,1.41,"34\'8\"",3188,5.8,8.1,42],['3w',183,'deep rough','119 yd',3.4,1.45,"69\'7\"",4005,10.5,13.5,44],['58',36,'rough','84 yd',-.4,1.17,"11\'3\"",3769,21.8,30.2,45],['58',83,'green','14 ft 3 in',-.7,1.07,"44\'10\"",2070,34.3,37.7,47]],
9:[['Dr',214,'fairway','134 yd',None,None,"63\'3\"",4098,8.3,None,49],['PW',126,'rough','13 yd',-9.1,1.18,"54\'2\"",5790,21,27.4,51],['58',10,'hole direction','3 yd',-18.3,1.39,"1\'4\"",1169,23,29.5,52]],
10:[['Dr',218,'rough','305 yd',7.9,1.44,"72\'2\"",4143,9.8,12.4,2],['3w',215,'fairway','96 yd',-2.5,1.42,"70\'2\"",2943,15.4,17.8,3],['58',114,'green','44 ft 3 in',-2.2,1.07,"71\'8\"",2389,34.2,37.3,6]],
11:[['6i',188,'sand','28 yd',None,None,"71\'11\"",3172,15.4,None,10],['58',23,'green','15 ft 9 in',None,None,"13\'5\"",1153,48.3,None,13]],
12:[['Dr',255,'fairway','237 yd',.1,1.46,"62\'10\"",3307,8.4,10.7,16],['3w',166,'fairway','69 yd',.5,1.36,"49\'7\"",1114,16.7,17.7,19],['58',54,'sand','14 yd',-2.1,1.11,"34\'1\"",2040,32.9,36.6,20],['58',11,'hole direction','2 yd',11.8,.65,"7\'4\"",1704,45.2,53.3,22]],
13:[['Dr',277,'fairway','160 yd',0,1.46,"62\'",3617,8.4,11.1,24],['9i',137,'green','23 ft 4 in',2.2,1.21,"61\'",3291,24.1,27.9,27]],
14:[['Dr',215,'rough','207 yd',4.3,1.47,"68\'6\"",3407,10.5,12.9,30],['6i',61,'fairway','139 yd',1.8,1.03,"9\'8\"",11385,16.3,28.6,32],['50',124,'hole direction','3 yd',.2,1.14,"82\'7\"",3586,29.8,33.9,34]],
15:[['8i',143,'green','53 ft 6 in',6.9,1.26,"30\'2\"",6595,11.6,18.4,38]],
16:[['5w',229,'rough','23 yd',-.2,1.47,"81\'7\"",3165,12.6,14.9,40],['58',20,'hole direction','5 yd',6.9,1.54,"2\'10\"",1454,29,36.7,43]],
17:[['5w',0,'not shown','220 yd',10.7,1.33,"67\'3\"",3252,17.8,20.6,45],['5w',197,'deep rough','26 yd',4.5,1.45,"59\'",3888,13.7,17.1,48],['58',40,'fairway','15 yd',-4.7,1.04,"19\'",1590,34.2,38.1,50],['58',20,'green','17 ft',4.6,1.12,"2\'4\"",1223,30.2,37.7,52]],
18:[['Dr',214,'sand','132 yd',-.8,1.45,"67\'10\"",2633,12.4,14.3,55],['58',92,'sand','26 yd',-2.3,1.24,"48\'6\"",4201,24.3,29.7,57],['58',18,'green','17 ft',14.9,.79,"12\'2\"",1043,46.4,50.2,59]]}
CLUBS={'Dr':'driver','3w':'3-wood','5w':'5-wood','5i':'5-iron','6i':'6-iron','8i':'8-iron','9i':'9-iron','PW':'pw','50':'50-wedge','58':'58-wedge'}
shots=[]
for hole,rows in ROWS.items():
    for i,row in enumerate(rows):
        club,distance,lie,proximity,ftp,smash,height,spin,la,loft,sec=row
        shot=dict(id=f'h{hole}-s{i+1}',hole=hole,club=CLUBS[club],distance=distance,total=distance,lie=lie,proximity=proximity,intent='unknown',source=f'ScreenRecording_10-01-2026 {"21-20-57" if hole<=9 else "21-32-05"}_1.mp4 · approximately {sec}s')
        shot.update({k:v for k,v in dict(ftp=ftp,smash=smash,height=height,spin=spin,la=la,loft=loft).items() if v is not None})
        if i==0 or (hole==17 and i==1):
            shot.update(actualClub='4-hybrid' if club=='5i' else CLUBS[club],intent='full')
        if hole==17 and i==0:
            shot['flag']='Source shows zero total and 220 yd remaining. Outcome/penalty unresolved; excluded from club profiles, retained in ledger.'
        shots.append(shot)
holes=[dict(n=i+1,par=h[0],s=h[1],si=h[2],yards=h[3]) for i,h in enumerate(HEADERS)]
coverage='Both October 1 recordings transcribed: all 18 hole headers and 51 non-putting observations. Back-nine clip repeats the final H9 shot; imported once. Shot-list distance is total, not carry; no carry tile captured. Missing delivery readings remain absent. H7 tee height/spin were obscured. H17 zero-distance row retained and flagged; no invented penalty count. No canceled mulligan identified. Putt count, course identity and simulator settings unconfirmed. Non-tee club selections remain unconfirmed; never infer identity from distance.'
review=dict(shots=shots,distanceMeaning='total',bagLine='Tee clubs confirmed by Jack; the H5 tee labelled 5i was his G440 4H at 24.5°. Non-tee club labels may be incorrect and remain unconfirmed.',puttingNote='Putt and gimme settings unconfirmed. Scorecard retained as displayed; putting skill is not evaluated.',sources='Front nine: ScreenRecording_10-01-2026 21-20-57_1.mp4. Back nine: ScreenRecording_10-01-2026 21-32-05_1.mp4. Play date confirmed by Jack as October 1.',coverage=coverage,availableClubs=list(CLUBS.values())+['4-hybrid'],trackman={})
round_=dict(date='2026-10-01',course='TrackMan · course unconfirmed',sim=True,par=sum(h['par'] for h in holes),score=sum(h['s'] for h in holes),note='October 1 simulator round: 39 out / 41 in, 80 (+8). Course name not shown. Tee labels confirmed, with 5i corrected to 4H; approach identities unconfirmed. Carry not captured. Kept separate from Map My Bag and outdoor statistics.',holes=holes,review=review)
assert round_['score']==80 and round_['par']==71
round_['note']=round_['note'].replace('80 (+8)', '80 (+9)')
feed={'entries':[dict(id='round-tm-20261001-v1',type='round',src='tm:2026-10-01-two-round-videos',round=round_)]}
print('*** Begin Patch')
print('*** Add File: '+str(ROOT/'round-20261001-feed.json'))
for line in json.dumps(feed,ensure_ascii=False,indent=2).splitlines(): print('+'+line)
print('*** End Patch')
