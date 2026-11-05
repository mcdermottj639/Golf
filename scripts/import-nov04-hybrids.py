"""Nov 4 2026 hybrid range session -> range-20261104-feed.json (append-only, apply-once).

Source: data/range-2026-11-04-hybrids.json (every visible row of Jack's TrackMan
screen recordings). Only the two 'main' recordings become bay cards; the two
early-session warm-up recordings stay in the source record, as Jack directed.

Mishits: Jack asked in chat to remove them. The reviewed rule shown to him:
a row is held out (mishit:true) when the app reports no club data, smash < 1.40,
or apex < 40 ft. Rows whose smash/delivery cells were never on screen are judged
on what is visible (apex) and are otherwise retained. isClearMishit() still runs
on top in the app. Live playing carries are never touched: the cleaned averages
are parked in carry-row `meas` as offers.

Run: python3 scripts/import-nov04-hybrids.py   (rewrites range-20261104-feed.json)
"""
import json, pathlib, statistics

ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC = json.loads((ROOT / 'data/range-2026-11-04-hybrids.json').read_text())
METRICS = ['carry', 'total', 'cs', 'bs', 'smash', 'la', 'spin', 'ftp', 'path', 'face', 'aoa', 'ld']


def held_reason(s):
    if s.get('carry') is None:
        return None
    if s.get('cs') is None and s.get('smash') is None and s.get('bs') is not None:
        return 'no club read (app shows dashes for club speed and smash)'
    if s.get('smash') is not None and s['smash'] < 1.40:
        return f"smash {s['smash']:.2f} < 1.40 (off-centre strike)"
    if s.get('height') is not None and s['height'] < 40:
        return f"apex {s['height']:.0f} ft < 40 ft (thin / low strike)"
    return None


def mean(xs):
    return round(statistics.mean(xs), 3) if xs else None


def sd(xs):
    return round(statistics.stdev(xs), 3) if len(xs) > 1 else None


def build(src):
    shots, excluded = [], []
    for raw in src['shots']:
        s = {k: v for k, v in raw.items()}
        s['heightText'] = f"{s['height']:.0f}'" if s.get('height') is not None else None
        why = held_reason(s)
        if why:
            s['mishit'] = True
            s['mishitReason'] = why
            excluded.append(s['shot'])
        s['videoSource'] = {'file': src['file'], 'row': s['shot']}
        shots.append(s)
    kept = [s for s in shots if not s.get('mishit')]
    avg = {'club': src['club'], 'n': len(kept), 'held': len(excluded)}
    counts = {}
    for m in METRICS:
        xs = [s[m] for s in kept if s.get(m) is not None]
        avg[m] = mean(xs)
        counts[m] = len(xs)
    hs = [s['height'] for s in kept if s.get('height') is not None]
    avg['apex'] = mean(hs)
    avg['metricCounts'] = counts
    avg['carrySd'] = sd([s['carry'] for s in kept])
    unseen = sorted(int(k) for k in src.get('unseenCells', {}))
    return {
        'club': src['club'], 'source': src['file'], 'normalization': 'not shown',
        'sourceShotCount': src['sourceShotCount'], 'visibleShotCount': len(shots),
        'unseenShotNumbers': [], 'partialShotNumbers': unseen,
        'distanceMissingShotNumbers': [s['shot'] for s in shots if s.get('carry') is None],
        'excludedShotNumbers': excluded, 'appHeader': src['appHeader'], 'appHeaderCheck': src['check'],
        'shots': shots, 'avg': avg,
    }


def r(x, d=1):
    return f'{x:.{d}f}'


def bay_entry(blk, label, model='PING G440'):
    a = blk['avg']
    finding = (f"{r(a['carry'])} carry / {r(a['total'])} total · {r(a['cs'])} club / {r(a['bs'])} ball mph · "
               f"smash {a['smash']:.2f} · {r(a['la'])}° / {a['spin']:,.0f} rpm · apex {a['apex']:.0f}′ "
               f"({a['n']} clean of {blk['sourceShotCount']})")
    return {
        'id': f"bay-20261104-{label.lower()}-v1", 'type': 'bay', 'src': blk['source'],
        'bay': {
            'date': '2026-11-04', 'venue': 'TrackMan · Range mode', 'mode': 'Range', 'unit': 'yd',
            'discipline': 'swing', 'norm': 'not shown in the recording', 'ball': 'not shown',
            'setup': f"Nov 4 · {model} {label} · {blk['sourceShotCount']} shots",
            'finding': finding,
            'detail': {
                'gist': f"{label}: {a['n']} clean of {blk['sourceShotCount']} · {r(a['carry'])} carry ±{r(a['carrySd'])} · {a['held']} mishits held out",
                'rangeCaption': f"{blk['source']} · mishits held out by Jack's Nov 4 rule (no club read, smash < 1.40, apex < 40 ft)",
                'clubs': [a],
                'rangeShots': [blk],
                'sourceRecord': 'data/range-2026-11-04-hybrids.json',
                'rangeSource': {'source': blk['source'], 'alias': blk['club'],
                                'coverage': 'Every row transcribed; column cells never scrolled on screen are null, not guessed. '
                                            + blk['appHeaderCheck']},
                'limits': ('Indoor/outdoor, normalization, ball and sleeve setting are not shown in the recording. '
                           'Mishit rule is the one Jack approved in chat on Nov 4 (stricter than isClearMishit). '
                           'Two early-session warm-up recordings (6 × 3H, 6 × 4H) are kept in the source record only, at Jack\'s direction. '
                           'Averages are a bay offer, not a 70°F course carry.'),
            },
        },
    }


def main():
    mains = [s for s in SRC['sources'] if s['role'] == 'main']
    blocks = {s['club']: build(s) for s in mains}
    h3, h4 = blocks['3-hybrid'], blocks['4-hybrid']
    a3, a4 = h3['avg'], h4['avg']
    gap = a3['carry'] - a4['carry']
    entries = [bay_entry(h3, '3H'), bay_entry(h4, '4H')]
    how = 'TrackMan Range mode · screen recording · normalization, ball and venue not shown · mishits held out (Nov 4 rule)'
    for club, a in (('3-hybrid', a3), ('4-hybrid', a4)):
        entries.append({
            'id': f"carry-meas-{club}-20261104-v1", 'type': 'carry-update', 'target': club,
            'club': {'meas': {'src': f"tm:2026-11-04-range-{club}", 'n': a['n'], 'sd': round(a['carrySd'], 1),
                              'date': '2026-11-04', 'ball': 'not shown', 'norm': 'not shown',
                              'carry': round(a['carry'], 1), 'how': how}},
        })
    entries.append({
        'id': 'history-hybrids-20261104-v1', 'type': 'history', 'date': '2026-11-04',
        'text': (f"First full PING G440 3H range session. Clean carry 3H {a3['carry']:.1f} (n={a3['n']}, ±{a3['carrySd']:.1f}) "
                 f"vs 4H {a4['carry']:.1f} (n={a4['n']}, ±{a4['carrySd']:.1f}): {gap:.1f} yd gap. 3H launches lower "
                 f"({a3['la']:.1f}° vs {a4['la']:.1f}°) with less spin ({a3['spin']:,.0f} vs {a4['spin']:,.0f}) and rolls "
                 f"{a3['total'] - a4['total']:.0f} yd further. Mishits held out: 3H {a3['held']}, 4H {a4['held']}. "
                 "Parked as carry offers; live playing carries unchanged."),
    })
    # v279 — Jack, Nov 4 2026, 16:25 ET: "Make sure carries are updated with these new distances."
    # His explicit instruction promotes the offers to the live playing carries. Same effect as tapping
    # "use" on each row (row.carry = meas.carry); no meas key here, so the parked provenance stays intact.
    for club, a in (('3-hybrid', a3), ('4-hybrid', a4)):
        entries.append({
            'id': f"carry-live-{club}-20261104-v1", 'type': 'carry-update', 'target': club, 'force': True,
            'src': 'Jack in chat, 2026-11-04: make sure carries are updated with these new distances',
            'club': {'carry': round(a['carry'])},  # whole yards, like every other ladder row
        })
    entries.append({
        'id': 'history-hybrid-carries-live-20261104-v1', 'type': 'history', 'date': '2026-11-04',
        'text': (f"Playing carries set from the Nov 4 range session at Jack's instruction: 3H {a3['carry']:.1f}, "
                 f"4H {a4['carry']:.1f} (mishits held out). Indoor TrackMan numbers; normalization not shown."),
    })
    # v280 — Jack, Nov 4 2026, 19:02 ET: "mini driver ... numbers from today since that's back in the bag".
    # TrackMan filed it under "3 Wood"; same rule, same importer. Back in the 14 (13 clubs after the
    # Oct 24 returns); a new ladder row with the measured offer, then the live carry in whole yards.
    mini = build([x for x in SRC['sources'] if x['role'] == 'mini'][0])
    am = mini['avg']
    me = bay_entry(mini, 'Mini', 'TaylorMade r7 Quad')
    me['bay']['detail']['limits'] += ' TrackMan labelled these shots "3 Wood"; Jack identified them as the mini driver. Its Avg row never scrolled into view.'
    entries.append(me)
    entries.append({
        'id': 'club-minidriver-back-20261104-v1', 'type': 'club-update', 'target': 'add-minidriver',
        'club': {'status': 'gaming',
                 'noteGist': f"Back in the bag Nov 4 2026 · {am['carry']:.0f} carry on TrackMan that day ({am['n']} clean of {mini['sourceShotCount']}).",
                 'note': (f"BACK IN THE BAG Nov 4 2026 (Jack). First measured carry for this head: {am['carry']:.1f} yd, "
                          f"n={am['n']} clean of {mini['sourceShotCount']} on TrackMan Range (filed under the '3 Wood' label), "
                          f"{am['total']:.1f} total, {am['cs']:.1f} club / {am['bs']:.1f} ball mph. "
                          "Loft carried forward as the last reported 15.5°; shaft still unrecorded. "
                          "Earlier: out Aug 12, back Sep 8 at 15.5°, out Sep 18 for the DS-ADAPT X 3-wood (since returned Oct 24).")},
    })
    entries.append({
        'id': 'carry-meas-minidriver-20261104-v1', 'type': 'carry-update', 'target': 'Mini Driver', 'after': 'Driver',
        'club': {'club': 'Mini Driver', 'loft': '15.5°', 'carry': None,
                 'meas': {'src': 'tm:2026-11-04-range-mini', 'n': am['n'], 'sd': round(am['carrySd'], 1),
                          'date': '2026-11-04', 'ball': 'not shown', 'norm': 'not shown',
                          'carry': round(am['carry'], 1), 'how': how + ' · TrackMan label "3 Wood"'}},
    })
    entries.append({
        'id': 'carry-live-minidriver-20261104-v1', 'type': 'carry-update', 'target': 'Mini Driver', 'force': True,
        'src': "Jack in chat, 2026-11-04: mini driver numbers from today, it's back in the bag",
        'club': {'carry': round(am['carry'])},
    })
    entries.append({
        'id': 'history-minidriver-back-20261104-v1', 'type': 'history', 'date': '2026-11-04',
        'text': (f"TaylorMade r7 Quad Mini Driver back in the bag (13 clubs). Nov 4 TrackMan: {am['carry']:.1f} carry "
                 f"(n={am['n']} clean of {mini['sourceShotCount']}, ±{am['carrySd']:.1f}), {am['total']:.1f} total; playing carry set to {round(am['carry'])}."),
    })
    print('mini n', am['n'], 'held', am['held'], mini['excludedShotNumbers'], 'carry', am['carry'], 'sd', am['carrySd'], 'total', am['total'],
          'cs', am['cs'], 'bs', am['bs'], 'smash', am['smash'], 'la', am['la'], 'spin', am['spin'], 'apex', am['apex'], 'path', am['path'], 'ftp', am['ftp'])
    feed = {'updated': '2026-11-04', 'entries': entries}
    (ROOT / 'range-20261104-feed.json').write_text(json.dumps(feed, indent=1, ensure_ascii=False) + '\n')
    for b in (h3, h4):
        a = b['avg']
        print(b['club'], 'n', a['n'], 'held', a['held'], b['excludedShotNumbers'], 'carry', a['carry'], 'sd', a['carrySd'],
              'total', a['total'], 'cs', a['cs'], 'bs', a['bs'], 'smash', a['smash'], 'la', a['la'], 'spin', a['spin'],
              'apex', a['apex'], 'path', a['path'], 'ftp', a['ftp'])
    for s in SRC['sources']:
        c = [x['carry'] for x in s['shots'] if x.get('carry') is not None]
        print('check', s['file'], s['role'], 'n', len(c), 'raw mean', round(statistics.mean(c), 2), (s.get('appHeader') or {}).get('carry'))


if __name__ == '__main__':
    main()
