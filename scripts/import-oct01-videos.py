"""Reconcile reviewed Oct 1 screen recordings without duplicating PDF shots.

Source rows are transcribed in data/range-2026-10-01-videos.json. Re-running is
idempotent and leaves the original PDF feed entries and transcript unchanged.
"""
import copy
import json
from pathlib import Path
import statistics

ROOT = Path(__file__).resolve().parents[1]
PREFIX = 'oct01-video-20261001-'


def mean(rows, key):
    values = [r[key] for r in rows if isinstance(r.get(key), (int, float))]
    return round(statistics.mean(values), 3) if values else None


def summary(group):
    rows = [r for r in group['shots'] if not r.get('mishit')]
    fields = ['carry', 'total', 'cs', 'bs', 'smash', 'la', 'spin', 'ftp', 'path', 'aoa', 'ld']
    return dict(club=group['club'], n=len(rows), held=len(group['shots'])-len(rows),
                **{k: mean(rows, k) for k in fields}, apex=mean(rows, 'height'),
                metricCounts={k: sum(r.get(k) is not None for r in rows) for k in fields})


def main():
    source = json.loads((ROOT/'data/range-2026-10-01-videos.json').read_text())
    path = ROOT/'range-20261001-feed.json'
    feed = json.loads(path.read_text())
    # Only regenerate this supplement; existing apply-once history is immutable.
    base = [e for e in feed['entries'] if not e['id'].startswith(PREFIX)]
    pdf = json.loads((ROOT/'data/range-2026-10-01.json').read_text())
    pdf_groups = [g for b in pdf['blocks'] for g in b['groups']]
    second = copy.deepcopy(next(e['bay'] for e in base if e['id']=='bay-20261001-pdf-block2-v1'))
    entries = []
    matched = set()
    for index, block in enumerate(source['blocks'], 1):
        if block['mode'] == 'enrich-existing':
            group = next(g for g in second['detail']['rangeShots'] if g['club']==block['club'])
            for incoming in block['shots']:
                # Several independent flight readings identify a shot despite row reordering
                # and metric/imperial display rounding. Never use ordinal-only matching.
                candidates = [r for r in group['shots'] if
                              abs(r['carry']-incoming['carry']) < .12 and
                              abs(r['total']-incoming['total']) < 3 and
                              abs(r['spin']-incoming['spin']) <= 2 and
                              abs(r['bs']-incoming['bs']) < .2]
                assert len(candidates)==1, (block['source'], incoming['shot'], candidates)
                row = candidates[0]
                assert row['shot']==incoming['pdfShot'], 'Reviewed mapping disagrees with flight match'
                key = (group['club'], row['shot'])
                assert key not in matched
                matched.add(key)
                # Keep all original PDF numbers/exclusions; add only previously absent fields.
                for field in ['aoa','path','ld','carrySide','side','curve','spinIndex','smashIndex','ballSpeedDiff','spinRateDiff']:
                    if incoming.get(field) is not None:
                        assert row.get(field) is None
                        row[field] = incoming[field]
                row['videoSource'] = {'file': block['source'], 'row': incoming['shot'],
                                      'libraryFileId': block['libraryFileId']}
                row['videoDisplayedValues'] = copy.deepcopy(incoming)
                if abs(row['total']-incoming['total']) > .12:
                    row['videoTotal'] = incoming['total']
            group['normalization'] = 'ON (visible in matching screen recording)'
            group['supplementarySource'] = block['source']
            group['avg'] = summary(group)
        else:
            rows = copy.deepcopy(block['shots'])
            for row in rows:
                assert not any(abs(r['carry']-row['carry']) < .12 and
                               abs(r['total']-row['total']) < .12 and
                               abs(r['spin']-row['spin']) <= 2
                               for g in pdf_groups if g['club']==block['club'] for r in g['shots'])
            med = statistics.median(r['carry'] for r in rows)
            cluster = [r['carry'] for r in rows if r['carry'] >= med*.5]
            cutoff = statistics.median(cluster)*2/3
            for r in rows:
                if r['carry'] < cutoff:
                    r.update(mishit=True, mishitReason='Below two-thirds of airborne carry cluster.')
            group = dict(club=block['club'], source=block['source'], normalization='ON',
                         sourceShotCount=len(rows), visibleShotCount=len(rows), unseenShotNumbers=[],
                         distanceMissingShotNumbers=[], excludedShotNumbers=[r['shot'] for r in rows if r.get('mishit')],
                         shots=rows, distanceSeconds=[0], metricSeconds=[4,6,8])
            group['avg'] = summary(group)
            a = group['avg']
            entries.append(dict(id=PREFIX+block['id'], type='bay', src=block['source'], bay={
                'date':'2026-10-01', 'venue':'TrackMan · indoor sim', 'mode':'Range', 'unit':'yd',
                'discipline':'swing', 'norm':'ON; environment settings not shown',
                'setup':f"Oct 1 · {block['club']} additional video · {a['n']} usable shots",
                'finding':f"{a['carry']:.1f} yd carry / {a['total']:.1f} total. Separate source block; setup timing unconfirmed.",
                'detail':{'gist':f"{a['n']} additional usable shots; no duplicates of either PDF. Normalize ON.",
                          'rangeShots':[group], 'clubs':[a], 'sourceRecord':'data/range-2026-10-01-videos.json',
                          'rangeSource':{'source':block['source'],'alias':block['club'],
                              'dateEvidence':'Jack identifies these as October 1 shots; recording filename is capture time, not swing time.',
                              'coverage':'All visible rows and readable columns transcribed. Normalize ON.'},
                          'limits':source['limits']}}))
    assert len(matched)==15
    second['detail']['clubs'] = [summary(g) for g in second['detail']['rangeShots']]
    second['detail']['limits'] = ('Matching 3W and 5W videos confirm Normalize ON in the recordings and add measured path, attack angle, launch direction, carry side and curve. PDF normalization remains unknown. Original PDF distances and mishit flags are preserved: some video totals differ by up to about 2 yards, beyond unit rounding; the cause is unconfirmed. Exact video readings are retained separately. PDF Side endpoint agrees with video carry side for the matched wood rows only. Face angle remains unmeasured; launch direction is not face angle. '+source['limits'])
    second['detail']['gist'] += ' Fifteen existing wood shots enriched from matching videos; none added twice.'
    second['detail']['supplementarySources'] = [b['source'] for b in source['blocks'] if b['mode']=='enrich-existing']
    entries.insert(0, dict(id=PREFIX+'enrich-pdf2-v1', type='bay-update', target='bay-20261001-pdf-block2-v1',
                          src='October 1 wood screen recordings', bay={'detail':second['detail']}))
    feed['entries'] = base+entries
    path.write_text(json.dumps(feed, indent=2, ensure_ascii=False)+'\n')
    print('15 existing shots enriched; 12 new shots across two separate bays; 108 unique / 92 retained for Oct 1.')


if __name__ == '__main__':
    main()
