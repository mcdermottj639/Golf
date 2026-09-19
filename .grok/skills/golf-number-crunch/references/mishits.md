# Mishits (range only)

On-course rounds: **do not cut**. A fat 7 on the card is a 7.

Range / bay / TrackMan: out of the live record. Jack does not want to
look at them. Do not print the worm yards in the gist, the finding, the
setup line, or the exact-data table.

## `isClearMishit` (must match `app.js`)

```
def median(xs):
    a = sorted(xs); m = len(a) // 2
    return a[m] if len(a) % 2 else (a[m-1] + a[m]) / 2

def is_clear_mishit(shot, group):
    if shot.get('mishit') is True: return True
    if shot.get('carry') is None: return False
    carries = [float(s['carry']) for s in group if s.get('carry') is not None]
    if len(carries) < 3: return False          # two shots are not a median
    med_all = median(carries)
    if not (med_all > 0): return False
    cluster = [c for c in carries if c >= med_all * 0.5]
    med = median(cluster if len(cluster) >= 2 else carries)
    return med > 0 and float(shot['carry']) < med * (2/3)
```

Why the cluster step: a pile of tops will drag a raw median down until
a 112-yard 5-wood with 8′ of apex looks “in.” Filter to the balls that
already got up (`≥ 0.5 × raw median`), then cut under two-thirds of
**that**.

## Examples (this bag, these bays)

| Shot | Cut? | Why |
|---|---|---|
| 5-wood 112 yd / 8′ apex | **Out** | Under 2/3 of the 5-wood cluster |
| 3-wood 150s with tops in the same block | **Out** | Same rule |
| 7-iron worms ~74 / 78 / 77, 5′–20′ apex | **Out** | Under 2/3 of the 7-iron cluster |
| Fat 9-iron at ~70% of the mean | **Keep** | 70% is above 2/3 |
| Sep 15 driver two tops | Held on purpose (on-course-shaped day) | Do not “fix” without Jack |
| n = 2 group | Never auto-cut | No median |

Apex is supporting evidence (5′ on a 7-iron is a worm), not a second
formula. If the carry rule already cuts it, do not also narrate the yards.

## What Jack sees

- Struck n only.
- “Three worms out.” Not “73.8 / 78.2 / 77.4.”
- Gold dots = premier remaining. Green dots = other remaining. No red
  dots for the tops — they are gone.
