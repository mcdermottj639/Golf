"""Build an append-only Map My Bag migration from reviewed source readings.

Print an apply_patch patch; never alter historical entries or playing carries.
Run: python3 scripts/import-oct01-map.py (apply stdout with apply_patch).
"""
import copy
import difflib
import json
import statistics
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PREFIX = 'oct01-map-20261001-'


def mean(rows, key):
    xs = [r[key] for r in rows if isinstance(r.get(key), (int, float))]
    return round(statistics.mean(xs), 3) if xs else None


def group_summary(g):
    rows = g['shots']
    keys = ['carry','total','cs','bs','smash','la','spin','ftp','path','aoa','ld']
    return dict(club=g['club'], n=len(rows), cons=g['screen']['consistency'],
                displayedCarry=g['screen']['carry'],
                **{k:mean(rows,k) for k in keys}, apex=mean(rows,'height'),
                metricCounts={k:sum(r.get(k) is not None for r in rows) for k in keys})


def build():
    source = json.loads((ROOT/'data/map-my-bag-2026-10-01-transcript.json').read_text())
    wood = json.loads((ROOT/'data/range-2026-10-01-videos.json').read_text())
    groups = []
    missing = []
    for block in wood['blocks']:
        if block['mode'] != 'new':
            continue
        g = copy.deepcopy(block)
        g['normalization'] = 'ON'
        g['sourceShotCount'] = len(g['shots'])
        groups.append(g)
    for block in source['groups']:
        rows = []
        for i, values in enumerate(block['rows'], 1):
            assert len(values) == len(source['columns']), (block['club'], i)
            row = dict(zip(source['columns'], values))
            row.update(shot=i, face=None)
            feet, inches = row['heightText'].replace('"','').split("'")
            row['height'] = int(feet) + (int(inches) if inches else 0)/12
            row['side'] = row['carrySide']
            if row['cs'] is not None:
                assert abs(row['bs']/row['cs'] - row['smash']) < .025, (block['club'], i)
            rows.append(row)
        g = dict(club=block['club'], source=source['sources'][block['source']]['file'],
                 libraryFileId=source['sources'][block['source']]['libraryFileId'],
                 screen=block['screen'], shots=rows, sourceShotCount=len(rows),
                 normalization='ON', metricSeconds=block['seconds'])
        if all(r['carry'] is None and r['total'] is None for r in rows):
            missing.append(g)
        else:
            assert all(r['carry'] is not None and r['total'] is not None for r in rows)
            assert abs(mean(rows,'carry')-g['screen']['carry']) < .11, block['club']
            groups.append(g)
    assert len(groups) == 11
    assert sum(len(g['shots']) for g in groups) == 66
    assert len(missing) == 1 and len(missing[0]['shots']) == 6
    pdf = json.loads((ROOT/'data/range-2026-10-01.json').read_text())
    for g in groups:
        for row in g['shots']:
            matches = [r for b in pdf['blocks'] for p in b['groups'] if p['club']==g['club']
                       for r in p['shots'] if abs(r['carry']-row['carry'])<.12
                       and abs(r['bs']-row['bs'])<.2 and abs(r['spin']-row['spin'])<=2]
            assert not matches, (g['club'], row['shot'], 'PDF duplicate')
        carries = [r['carry'] for r in g['shots']]
        cluster = [v for v in carries if v >= statistics.median(carries)*.5]
        cutoff = statistics.median(cluster)*2/3
        assert all(v >= cutoff for v in carries), (g['club'], 'new clear mishit requires review')
        g.update(visibleShotCount=len(carries), unseenShotNumbers=[],
                 distanceMissingShotNumbers=[], excludedShotNumbers=[])
        g['avg'] = group_summary(g)
    clubs = [g['avg'] for g in groups]
    # Displayed summary only: never materialize fake 164.1-yard shot rows or delivery means.
    clubs.append(dict(club='2-iron', n=6, carry=164.1, cons=9.1,
                      summaryOnly=True, metricCounts={'carry':0},
                      note='TrackMan displayed summary; six individual carry/total readings not captured.'))
    clubs.sort(key=lambda c:-c['carry'])
    detail = {
        'gist':'One Map My Bag session: 12 clubs / 72 reported shots. 66 complete distance rows; 2i has only a displayed distance summary.',
        'rangeShots':groups, 'clubs':clubs, 'distanceMissingEvidence':missing,
        'sourceRecord':'data/map-my-bag-2026-10-01-transcript.json',
        'rangeCaption':'October 1 Map My Bag only. Earlier range PDFs and simulator rounds are separate. No duplicated wood batches.',
        'rangeSource':{'source':'Four Map My Bag recordings plus overview screenshots',
            'coverage':'72 reported shots; 66 complete carry/total rows; 6 distance-missing 2i rows archived separately.'},
        'mapMyBag':{'reportedShots':72,'reportedClubs':12,'completeDistanceShots':66,
                    'summaryOnlyClubs':['2-iron'],'normalization':'ON',
                    'clubSummaries':[dict(club=c['club'],carry=c['carry'],n=c['n'],cons=c['cons'],
                                          summaryOnly=c.get('summaryOnly',False)) for c in clubs]},
        'story':'This same-session map changes the earlier bag interpretation. 4H 174.9 to 5i 163.5 is an 11.4-yard gap; 5i to 6i 156.6 is 6.9 yards. Keep the 5i while testing repeatability rather than buying a gap hybrid now. Its carry consistency is tighter, but five of six finishes are right of target and face-to-path averages about +6.2 degrees; distance consistency is not directional accuracy. The 3W 197.2 and 5W 192.4 remain close. The 50-degree 113.1 to 58-degree 97.0 gap is 16.1 yards, so a 54-degree purchase is not yet established. These are normalized simulator observations, not outdoor stock distances. Small samples and different session conditions do not prove improvement.',
        'limits':source['limits']
    }
    path = ROOT/'range-20261001-feed.json'
    original = json.loads(path.read_text())
    feed = copy.deepcopy(original)
    entries = [e for e in feed['entries'] if not e['id'].startswith(PREFIX)]
    migration = [
      {'id':PREFIX+'combine-v1','type':'bay-update','target':'oct01-video-20261001-3w-new-six-v1',
       'src':'Jack: combine these batches as one Map My Bag',
       'bay':{'date':'2026-10-01','mode':'Map My Bag','sessionKind':'map-my-bag',
          'setup':'Oct 1 · Map My Bag · 12 clubs / 72 reported shots',
          'venue':'TrackMan · indoor sim','norm':'ON; environment settings not shown',
          'finding':detail['gist'],'detail':detail}},
      {'id':PREFIX+'retire-split-5w-v1','type':'bay-remove',
       'target':'oct01-video-20261001-5w-new-six-v1',
       'src':'Six shots preserved inside the combined Map My Bag; remove only the duplicate split card.'}
    ]
    # Once published, the migration is immutable. A future correction needs a new ID.
    existing = [e for e in original['entries'] if e['id'].startswith(PREFIX)]
    assert not existing or existing == migration, 'Published migration changed; append a new correction ID.'
    feed['entries'] = entries + migration
    feed['updated'] = '2026-10-01'
    old = path.read_text()
    if not existing:
        assert old.endswith('  ]\n}\n')
        new = old[:-len('  ]\n}\n')].rstrip()+',\n'
        new += ',\n'.join('    '+json.dumps(e,ensure_ascii=False) for e in migration)+'\n  ]\n}\n'
        assert json.loads(new) == feed
        print('*** Begin Patch\n*** Update File: '+str(path))
        for line in list(difflib.unified_diff(old.splitlines(),new.splitlines(),n=3))[2:]:
            print('@@' if line.startswith('@@') else line)
        print('*** End Patch')


if __name__ == '__main__':
    build()
