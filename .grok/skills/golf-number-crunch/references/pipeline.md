# Pipeline

Copy this. Do not skip steps. Do not average until mishits are out.

## Shot object

```
shot, carry, total, side, curve, height, bs, la, spin, ld,
cs, smash, aoa, ftp, path, face, mishit?
```

`face` = `path + ftp` when both exist and face was off-screen.
Distances in yards. Side/curve stay as TrackMan wrote them (`23'R`).

## 1. Ingest

- One club per list. Shot # order = hit order.
- Screen `AVG. CARRY` still has tops in it. Do not use it as the remaining mean.
- If carry is cut off, say so. Sum-to-screen-avg is a check, not a license to invent.

## 2. Mishits

See `mishits.md`. Flag, then **drop from every live number**.
Keep them in `rangeShots` with `mishit: true` so the next pass does not
re-transcribe them, but `struckShots` never shows them.

## 3. Remaining (the broad average)

```
remaining = [s for s in shots if not mishit]
n = len(remaining)
carry = mean(s.carry)
total = mean(s.total)          # not red
path, ftp, smash, aoa, cs, bs, la, spin = means of those keys
```

`n` in every gist is this n, never the screen n.

## 4. Premier

See `premier.md`. Longest 5 remaining carries (3 if 3–4 left; skip if <3).

## 5. Group

See `grouping.md`. Three possible outcomes, pick one:

| Outcome | What it is | Name |
|---|---|---|
| **Baseline** | After a point, the rest of the session holds | `3 wood · after slot` |
| **Window** | A tight run, then the session reverts | `7-iron · open` / `· window` / `· rest` |
| **One group** | No split the numbers will own | `7-iron` |

Memory of when the thought started is not an outcome.

## 6. What moved

See `delivery.md`. Report deltas **between groups of the same club
the same day**. Do not average 3-wood after-slot with 7-iron window.

## 7. Visualize

See `visualize.md`. RED first. Remaining only. Carry labeled carry.

## 8. App write

Append-only `bay-update` on that day's bay.

- `rangeShots`: one object per group, shots in hit order, mishits tagged
  `mishit: true` (not deleted from the JSON — deleted from the *record
  Jack sees*).
- `finding` / `gist` / `metrics` / `story` quote remaining n and best 5.
- Group names match the outcome table above.
- Live ladder stays blank unless Jack says otherwise.

Python-shaped helpers live next to the rule they implement, in the
other reference files. Prefer running them over eyeballing.
