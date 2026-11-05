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
    # v281 — Jack, Nov 4 2026: "These are off the deck numbers too fyi". Every Nov 4 shot (3H, 4H, mini)
    # was hit off the ground, not a tee. Label it; no number changes. Earlier entries stay byte-identical.
    DECK = 'Hit off the deck (no tee), per Jack. '
    byid = {e['id']: e for e in entries}
    for lab in ('3h', '4h', 'mini'):
        b = byid[f'bay-20261104-{lab}-v1']['bay']
        entries.append({'id': f'bay-offdeck-{lab}-20261104-v1', 'type': 'bay-update', 'target': f'bay-20261104-{lab}-v1',
                        'bay': {'setup': b['setup'] + ' · off the deck', 'detail': {'limits': DECK + b['detail']['limits']}}})
    for row, src in (('3-hybrid', 'carry-meas-3-hybrid-20261104-v1'), ('4-hybrid', 'carry-meas-4-hybrid-20261104-v1'),
                     ('Mini Driver', 'carry-meas-minidriver-20261104-v1')):
        meas = dict(byid[src]['club']['meas']); meas['how'] = 'off the deck (no tee) · ' + meas['how']
        entries.append({'id': f"carry-offdeck-{row.lower().replace(' ', '')}-20261104-v1", 'type': 'carry-update',
                        'target': row, 'club': {'meas': meas}})
    mc = byid['club-minidriver-back-20261104-v1']['club']
    entries.append({'id': 'club-minidriver-offdeck-20261104-v1', 'type': 'club-update', 'target': 'add-minidriver',
                    'club': {'noteGist': 'Back in the bag Nov 4 2026 · 201 carry off the deck (no tee) on TrackMan · off a tee likely longer, unmeasured.',
                             'note': mc['note'] + ' OFF THE DECK: all Nov 4 shots were hit off the ground, not a tee (Jack); a teed carry is unmeasured.'}})
    entries.append({'id': 'history-offdeck-20261104-v1', 'type': 'history', 'date': '2026-11-04',
                    'text': 'Nov 4 TrackMan numbers (3H, 4H, mini driver) labelled off the deck (no tee). Carries unchanged: 187 / 178 / 201.'})
    # v282 — Jack, Nov 4 2026: today's mini is 13.5° (not the 15.5° carried forward), and the older
    # mini numbers "need to be in the app too". Sep 14 Map My Bag and the Sep 15 range filed the mini under
    # TrackMan's "3w" label, so their club rows read as the 3-wood. Relabel those rows to the mini (15.5° then),
    # re-sending each touched detail array WHOLE from its latest feed version (bay-update merges detail shallowly).
    old = {e['id']: e for e in json.loads((ROOT / 'coach-feed.json').read_text())['entries']}
    OLD3W = '3w · TrackMan label'; MINI = 'Mini Driver · TrackMan 3w label · 15.5°'
    def relabel(v):
        if isinstance(v, list): return [relabel(x) for x in v]
        if isinstance(v, dict): return {k: (MINI if k == 'club' and x == OLD3W else relabel(x)) for k, x in v.items()}
        return v
    m14 = {'clubs': old['bay-swingread-20260917-map']['bay']['detail']['clubs'],
           'delivery': old['bay-map-repair-20260915-v2']['bay']['detail']['delivery']}
    r15d = old['bay-20260915-range-54']['bay']['detail']
    r15 = {k: r15d[k] for k in ('clubs', 'delivery', 'rangeShots')}
    for tid, det in (('bay-20260914-gl18-map-my-bag', m14), ('bay-20260915-range-54', r15)):
        new = relabel(det); js = json.dumps(new, ensure_ascii=False); assert js.count(MINI) >= 2 and OLD3W not in js
        entries.append({'id': f"bay-minilabel-{tid[4:12]}-20261104-v1", 'type': 'bay-update', 'target': tid, 'bay': {'detail': new}})
    entries.append({'id': 'bay-minidriver-loft-20261104-v1', 'type': 'bay-update', 'target': 'bay-20261104-mini-v1',
                    'bay': {'setup': 'Nov 4 · TaylorMade r7 Quad Mini 13.5° · 8 shots · off the deck'}})
    entries.append({'id': 'carry-minidriver-loft-20261104-v1', 'type': 'carry-update', 'target': 'Mini Driver', 'club': {'loft': '13.5°'}})
    entries.append({'id': 'club-minidriver-loft-20261104-v1', 'type': 'club-update', 'target': 'add-minidriver',
                    'club': {'loft': '13.5°',
                             'noteGist': 'Back in the bag Nov 4 2026 at 13.5° · 201 carry off the deck (Sep at 15.5°: 182 map, 168 range) · all off the deck.',
                             'noteKeys': [{'k': 'Nov 4 · 13.5°', 'v': '201', 'n': '6 of 8 · off the deck'},
                                          {'k': 'Sep 15 · 15.5°', 'v': '168', 'n': '8 of 10 · range · deck'},
                                          {'k': 'Sep 14 · 15.5°', 'v': '182', 'n': '6 · Map My Bag · deck'}],
                             'note': ('BACK IN THE BAG Nov 4 2026 (Jack), at 13.5° (Jack). Nov 4 TrackMan Range, off the deck (no tee): 201.1 yd carry, '
                                      'n=6 clean of 8 (filed under the "3 Wood" label), 229.5 total, 93.0 club / 134.5 ball mph. '
                                      'OLDER NUMBERS, both at 15.5° and both filed by TrackMan as "3w": Sep 14 Map My Bag 182.4 carry, n=6, '
                                      'Consistency 9.2; Sep 15 range 145.5 on screen with two tops in it, 167.5 with the 15.5 and 99.1 held out '
                                      '(n=8 of 10), best 5 176.1. All three are off the deck: at the sim Jack hits everything but driver off the deck. Normalization was not shown for September. '
                                      'Earlier: out Aug 12 (13.5° then), back Sep 8 at 15.5°, out Sep 18 for the DS-ADAPT X 3-wood (returned Oct 24).')}})
    entries.append({'id': 'history-minidriver-loft-20261104-v1', 'type': 'history', 'date': '2026-11-04',
                    'text': 'Mini driver loft corrected to 13.5° (Nov 4). Sep 14 Map My Bag (182.4) and Sep 15 range (167.5 clean) mini groups now sit under the mini, not the 3-wood.'})
    # v283 — Jack, Nov 4 2026, 19:21/19:23: two recordings of the Sep 15 mini (TrackMan "3 Wood") table, every
    # column. Enrich the 10 stored shots (matched by carry) and hold mishits by the same Nov 4 rule as today.
    byid = {e['id']: e for e in entries}
    sep = json.loads((ROOT / 'data' / 'range-2026-09-15-mini.json').read_text())
    rs = json.loads(json.dumps(byid['bay-minilabel-20260915-20261104-v1']['bay']['detail']['rangeShots']))
    g = next(x for x in rs if x['club'] == MINI)
    held = []
    for v in sep['shots']:
        tgt = [x for x in g['shots'] if x['carry'] == v['carry']]; assert len(tgt) == 1, v
        x = tgt[0]
        for k in ('cs', 'aoa', 'path', 'face', 'ftp', 'bs', 'smash', 'la', 'ld', 'spin', 'total'):
            if x.get(k) is not None and v[k] is not None: assert abs(x[k] - v[k]) < 0.051, (k, x, v)
            if v[k] is not None: x[k] = v[k]
        x['height'] = v['apex']; x['heightText'] = f"{v['apex']}'"
        x['videoSource'] = {'file': sep['files'][0], 'row': v['screen']}
        why = held_reason({'carry': v['carry'], 'cs': v['cs'], 'bs': v['bs'], 'smash': v['smash'], 'height': v['apex']})
        if why: x['mishit'] = True; x['mishitReason'] = why; held.append(x['shot'])
    g['excludedShotNumbers'] = sorted(held)
    g['sourceRecord'] = 'data/range-2026-09-15-mini.json'
    kept = [x for x in g['shots'] if not x.get('mishit')]
    print('sep15 mini kept', len(kept), round(sum(x['carry'] for x in kept) / len(kept), 2), 'held', g['excludedShotNumbers'])
    entries.append({'id': 'bay-minishots-20260915-20261104-v1', 'type': 'bay-update', 'target': 'bay-20260915-range-54',
                    'src': 'video:' + '+'.join(sep['files']), 'bay': {'detail': {'rangeShots': rs}}})
    note2 = byid['club-minidriver-loft-20261104-v1']['club']['note'].replace(
        "Sep 15 range 145.5 on screen with two tops in it, 167.5 with the 15.5 and 99.1 held out (n=8 of 10), best 5 176.1.",
        f"Sep 15 range 145.5 on screen; full table now in (Jack's recordings): by the same Nov 4 rule as today {sum(x['carry'] for x in kept)/len(kept):.1f} carry, n={len(kept)} of 10 (the app's looser carry-only filter gives 167.5, n=8).")
    assert note2 != byid['club-minidriver-loft-20261104-v1']['club']['note']
    entries.append({'id': 'club-minidriver-sep15-20261104-v1', 'type': 'club-update', 'target': 'add-minidriver',
                    'club': {'noteGist': f"Back in the bag Nov 4 2026 at 13.5° · 201 carry off the deck (Sep at 15.5°: 182 map, {round(sum(x['carry'] for x in kept)/len(kept))} range).",
                             'noteKeys': [{'k': 'Nov 4 · 13.5°', 'v': '201', 'n': '6 of 8 · off the deck'},
                                          {'k': 'Sep 15 · 15.5°', 'v': str(round(sum(x['carry'] for x in kept)/len(kept))), 'n': f"{len(kept)} of 10 · same rule · deck"},
                                          {'k': 'Sep 14 · 15.5°', 'v': '182', 'n': '6 · Map My Bag · deck'}],
                             'note': note2}})
    entries.append({'id': 'history-minidriver-sep15-20261104-v1', 'type': 'history', 'date': '2026-11-04',
                    'text': f"Sep 15 mini driver table added from your recordings: {sum(x['carry'] for x in kept)/len(kept):.1f} carry by the Nov 4 rule (n={len(kept)} of 10)."})
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
