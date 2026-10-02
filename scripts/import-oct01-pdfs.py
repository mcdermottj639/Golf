"""Import October 1 TrackMan PDFs: metric units, PDF exclusions, no guessed metrics.

Usage: python3 scripts/import-oct01-pdfs.py REPORT.pdf SECOND_REPORT.pdf
Requires pdfplumber. Input order is preserved as independent source blocks.
"""
import json
import pathlib
import re
import statistics
import sys
import pdfplumber

ROOT = pathlib.Path(__file__).resolve().parents[1]
NAMES = {'Driver': 'Driver', '3Wood': '3-wood', '5Wood': '5-wood',
         '4Hybrid': '4-hybrid', '2Iron': '2-iron', '6Iron': '6-iron'}
FIELDS = ['carry', 'total', 'side', 'height', 'bs', 'cs', 'smash', 'la', 'spin', 'ftp']

def number(v):
    return None if v == '-' or v == '-1.00' else float(v)

def mean(rows, key):
    values = [s[key] for s in rows if isinstance(s.get(key), (int, float))]
    return round(statistics.mean(values), 3) if values else None

def main(paths):
    blocks = []
    seen = set()
    for block, path in enumerate(paths, 1):
        groups = []
        with pdfplumber.open(path) as doc:
            for page_no, page in enumerate(doc.pages, 1):
                text = page.extract_text() or ''
                if 'Consistency' not in text:
                    continue
                assert 'm, m/s' in text and '2026-10-01' in text
                club = next(NAMES[n] for n in NAMES if re.search(r'\b' + n + r'\b', text))
                # The crossed-out eye is drawn with short diagonal lines. Match its
                # vertical position to the source shot label (verified visually).
                crossed = [l['top'] for l in page.lines if 140 < l['x0'] < 155]
                labels = {int(w['text'][:-1]): w for w in page.extract_words()
                          if re.fullmatch(r'\d+\.', w['text'])}
                rows = []
                for line in text.splitlines():
                    match = re.match(r'^(\d+)\. (.+)$', line)
                    if not match:
                        continue
                    shot = int(match[1])
                    tokens = match[2].split()
                    assert len(tokens) == 10, line
                    raw = dict(zip(FIELDS, tokens))
                    row = {'shot': shot, 'sourcePage': page_no, 'sourceValues': raw,
                           'path': None, 'face': None, 'aoa': None}
                    for key in ['carry', 'total']:
                        row[key] = round(number(raw[key]) / .9144, 6)
                    for key in ['bs', 'cs']:
                        v = number(raw[key])
                        row[key] = round(v / .44704, 6) if v is not None else None
                    row['height'] = round(number(raw['height']) / .3048, 6)
                    row['sideYards'] = round(float(raw['side'][:-1]) / .9144 * (-1 if raw['side'][-1] == 'L' else 1), 6)
                    for key in ['smash', 'la', 'spin', 'ftp']:
                        row[key] = number(raw[key])
                    label = labels[shot]
                    if any(label['top'] - 2 <= y <= label['bottom'] + 2 for y in crossed):
                        row.update(mishit=True, mishitReason='Excluded in source TrackMan PDF (crossed-out shot).')
                    signature = (club, tuple(tokens))
                    assert signature not in seen, 'Duplicate shot across PDFs: ' + line
                    seen.add(signature)
                    rows.append(row)
                assert [r['shot'] for r in rows] == list(range(1, len(rows) + 1))
                med = statistics.median(r['carry'] for r in rows)
                cluster = [r['carry'] for r in rows if r['carry'] >= med * .5]
                cutoff = statistics.median(cluster) * 2 / 3
                for row in rows:
                    if row['carry'] < cutoff and not row.get('mishit'):
                        row.update(mishit=True, mishitReason='Carry below two-thirds of the airborne cluster; existing Caddie HQ range exclusion rule.')
                kept = [r for r in rows if not r.get('mishit')]
                avg = {'club': club, 'n': len(kept), 'held': len(rows) - len(kept), 'metricCounts': {}}
                for key in ['carry', 'total', 'bs', 'cs', 'smash', 'la', 'spin', 'ftp']:
                    avg[key] = mean(kept, key)
                    avg['metricCounts'][key] = sum(r[key] is not None for r in kept)
                avg['apex'] = mean(kept, 'height')
                groups.append({'club': club, 'source': pathlib.Path(path).name, 'sourcePage': page_no,
                               'sourceShotCount': len(rows), 'visibleShotCount': len(rows),
                               'unseenShotNumbers': [], 'distanceMissingShotNumbers': [],
                               'excludedShotNumbers': [r['shot'] for r in rows if r.get('mishit')],
                               'shots': rows, 'avg': avg})
        blocks.append({'source': pathlib.Path(path).name, 'groups': groups})
    raw = {'date': '2026-10-01', 'sourceUnits': {'distance': 'm', 'speed': 'm/s', 'height': 'm'},
           'units': {'distance': 'yd', 'speed': 'mph', 'height': 'ft', 'angles': 'deg', 'spin': 'rpm'},
           'limits': 'Indoor reported results. Ball, normalization, exact shot times and sleeve settings not shown. PDF Side is retained as sideYards and raw source Side; carry-side versus total-side is unspecified, so neither is inferred. Path, face angle and attack angle are unavailable. Negative-one smash sentinel becomes null; valid missing-speed shots remain.',
           'blocks': blocks}
    (ROOT / 'data/range-2026-10-01.json').write_text(json.dumps(raw, indent=2) + '\n')
    entries = []
    for i, block in enumerate(blocks, 1):
        groups = block['groups']
        n = sum(g['avg']['n'] for g in groups)
        held = sum(g['avg']['held'] for g in groups)
        entries.append({'id': f'bay-20261001-pdf-block{i}-v1', 'type': 'bay', 'src': block['source'], 'bay': {
            'date': '2026-10-01', 'venue': 'TrackMan · indoor sim', 'mode': 'Range', 'unit': 'yd', 'discipline': 'swing',
            'setup': f'Oct 1 · PDF block {i} · {n} usable shots',
            'finding': ' · '.join(f"{g['club']}: {g['avg']['carry']:.1f} carry / {g['avg']['total']:.1f} total" for g in groups),
            'detail': {'gist': f'{n + held} captured rows; {held} held out; {n} usable. Metric units converted before analysis.',
                       'rangeCaption': block['source'] + ' · source exclusions honored; invalid smash readings omitted.',
                       'clubs': [g['avg'] for g in groups], 'rangeShots': groups,
                       'sourceRecord': 'data/range-2026-10-01.json', 'limits': raw['limits']}}})
    entries.append({'id': 'g440-first-sim-note-20261001-v1', 'type': 'club-update',
                    'target': 'bag-ds-adapt-4h-20261001', 'club': {
                        'note': 'Received October 1, 2026. Replaces the canceled Cobra DS-ADAPT 4H order and fills the benched KING TEC 4-iron slot. First TrackMan PDFs: 21 usable shots, 176.4 yd mean carry / 202.0 total. Indoor observations only; outdoor carry uncalibrated. ALTA CB Blue 70 Regular (73g). Current adapter setting not confirmed; see saved adjustment chart.'}})
    (ROOT / 'range-20261001-feed.json').write_text(json.dumps({'updated': '2026-10-01', 'entries': entries}, indent=2) + '\n')
    print(json.dumps([(b['source'], [(g['club'], g['avg']) for g in b['groups']]) for b in blocks], indent=2))

if __name__ == '__main__':
    assert len(sys.argv) == 3, __doc__
    main(sys.argv[1:])
