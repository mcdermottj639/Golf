"""Nov 11 2026 sim session -> range-20261111-feed.json (append-only, apply-once).

Source: data/range-2026-11-11-sim.json (every row of Jack's two TrackMan Shots-table
screen recordings: mini driver under the '3 Wood' label, PING G440 3H and 4H).

Same mishit rule as Nov 4, reused from that importer rather than re-derived: no club
read, smash < 1.40, or apex < 40 ft. Jack sent the numbers without asking for the
playing carries to move, so the cleaned averages are parked as `meas` offers only;
live carries (201 / 187 / 178) are untouched.

Run: python3 scripts/import-nov11-sim.py   (rewrites range-20261111-feed.json)
"""
import importlib.util, json, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location('nov04', ROOT / 'scripts/import-nov04-hybrids.py')
nov04 = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(nov04)
build, r = nov04.build, nov04.r

SRC = json.loads((ROOT / 'data/range-2026-11-11-sim.json').read_text())
RULE = "mishits held out by Jack's Nov 4 rule (no club read, smash < 1.40, apex < 40 ft)"
LIMITS = ('Hit off the deck (no tee): at the sim Jack hits everything but driver off the deck. '
          'Venue, normalization and ball are not shown in the recording. '
          'Smash is ball ÷ club; the app\'s own "Smash index" % column is kept in the source record. '
          'Averages are a bay offer, not a 70°F course carry; playing carries were not changed.')


def bay_entry(blk, key, label, setup, extra=''):
    a = blk['avg']
    return {
        'id': f'bay-20261111-{key}-v1', 'type': 'bay', 'src': blk['source'],
        'bay': {
            'date': '2026-11-11', 'venue': 'TrackMan · sim · Shots table', 'mode': 'Range', 'unit': 'yd',
            'discipline': 'swing', 'norm': 'not shown in the recording', 'ball': 'not shown',
            'setup': setup,
            'finding': (f"{r(a['carry'])} carry / {r(a['total'])} total · {r(a['cs'])} club / {r(a['bs'])} ball mph · "
                        f"smash {a['smash']:.2f} · {r(a['la'])}° / {a['spin']:,.0f} rpm · apex {a['apex']:.0f}′ "
                        f"({a['n']} clean of {blk['sourceShotCount']})"),
            'detail': {
                'gist': f"{label}: {a['n']} clean of {blk['sourceShotCount']} · {r(a['carry'])} carry ±{r(a['carrySd'])} · {a['held']} mishits held out",
                'rangeCaption': f"{blk['source']} · {RULE}",
                'clubs': [a], 'rangeShots': [blk],
                'sourceRecord': 'data/range-2026-11-11-sim.json',
                'rangeSource': {'source': blk['source'], 'alias': blk['club'],
                                'coverage': 'Every row and every column transcribed. ' + blk['appHeaderCheck']},
                'limits': LIMITS + extra,
            },
        },
    }


def main():
    by = {s['role'] + ':' + s['club']: build(s) for s in SRC['sources']}
    mini, h3, h4 = by['mini:Mini Driver'], by['main:3-hybrid'], by['main:4-hybrid']
    mini['club'] = 'Mini Driver · TrackMan 3w label · 13.5°'; mini['avg']['club'] = mini['club']
    am, a3, a4 = mini['avg'], h3['avg'], h4['avg']
    entries = [
        bay_entry(mini, 'mini', 'Mini', 'Nov 11 · TaylorMade r7 Quad Mini 13.5° · 15 shots · off the deck',
                  ' TrackMan labelled these shots "3 Wood"; Jack identified them as the mini driver.'),
        bay_entry(h3, '3h', '3H', 'Nov 11 · PING G440 3H · 26 shots · off the deck'),
        bay_entry(h4, '4h', '4H', 'Nov 11 · PING G440 4H · 6 shots · off the deck'),
    ]
    how = 'off the deck (no tee) · TrackMan sim Shots table · screen recording · normalization, ball and venue not shown · mishits held out (Nov 4 rule)'
    for row, key, a, lab in (('Mini Driver', 'minidriver', am, ' · TrackMan label "3 Wood"'), ('3-hybrid', '3-hybrid', a3, ''), ('4-hybrid', '4-hybrid', a4, '')):
        entries.append({
            'id': f'carry-meas-{key}-20261111-v1', 'type': 'carry-update', 'target': row,
            'club': {'meas': {'src': f'tm:2026-11-11-sim-{key}', 'n': a['n'], 'sd': round(a['carrySd'], 1),
                              'date': '2026-11-11', 'ball': 'not shown', 'norm': 'not shown',
                              'carry': round(a['carry'], 1), 'how': how + lab}},
        })
    entries.append({
        'id': 'history-sim-20261111-v1', 'type': 'history', 'date': '2026-11-11',
        'text': (f"Nov 11 sim, off the deck, mishits held out: mini {am['carry']:.1f} carry (n={am['n']} of {mini['sourceShotCount']}), "
                 f"3H {a3['carry']:.1f} (n={a3['n']} of {h3['sourceShotCount']}), 4H {a4['carry']:.1f} (n={a4['n']} of {h4['sourceShotCount']}). "
                 f"3H–4H gap {a3['carry'] - a4['carry']:.1f} yd. Parked as offers; playing carries stay 201 / 187 / 178."),
    })
    feed = {'updated': '2026-11-11', 'entries': entries}
    (ROOT / 'range-20261111-feed.json').write_text(json.dumps(feed, indent=1, ensure_ascii=False) + '\n')
    for b in (mini, h3, h4):
        a = b['avg']
        print(b['club'], 'n', a['n'], 'held', a['held'], b['excludedShotNumbers'], 'carry', a['carry'], 'sd', a['carrySd'], 'total', a['total'],
              'cs', a['cs'], 'bs', a['bs'], 'smash', a['smash'], 'la', a['la'], 'spin', a['spin'], 'apex', a['apex'], 'path', a['path'], 'ftp', a['ftp'], 'aoa', a['aoa'])


if __name__ == '__main__':
    main()
