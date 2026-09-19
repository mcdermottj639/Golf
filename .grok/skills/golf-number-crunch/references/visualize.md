# Visualize

Jack reads this on a phone. One red block, then a short table, then
one sentence. If it needs a paragraph it is not done.

## RED block (first, always)

```
RED — look here
• CARRY   <remaining mean>  n=<struck>
• BEST 5  <premier carry>   (still carry)
• GROUP   <name the numbers picked>
```

Red items: remaining carry, best-N carry, the group, mishit **count**.
Not red: total, path-without-carry, remembered shot numbers, worm yards.

## Group table (second)

One row per group of that club that day. Remaining only.

```
          n    carry   best 5   F–P    path
Open      2    113.5      —    +8.9   −8.2
Run       5    138.2   138.2   +3.1   −6.0
Rest     20    128.9   146.6   +6.5   −7.6
```

Label the carry column **carry**. If you also show total, a second
column named **total**. Never a naked “188.4” that could be either.

## Sorting

Default: **hit order** (shot #). That is how a window is visible.
Premier is a second view, not a resorted table Jack has to decode.
Do not sort the exact-data table by carry.

## What the PWA already draws

Do not invent a new page. The bay view already has:

- Carry vs total bars (green = carry, gold = total) per group
- Every-carry strip (green remaining, gold = premier)
- Exact-data table, remaining rows only, sticky first column
- Path rings from `analysisDelivery`

Write `rangeShots` so those render. Group names must be ones `clubTag`
knows (`after slot`, `open`, `window`, `rest`).

## Setup line

Live remaining counts, derived, never a frozen “49 shots”:

```
67 remaining · first 3W 9 · 5W 6 · 7i 11 · 7i · open 2 · 7i · run 5 · 7i · rest 20 · after slot 3W 7 · 5W 7
```

If a number on that line is a screen n, it is wrong.

## Don’ts

- No mishit yards in any card, gist, finding, or table.
- No mixing first-block and later-block into one ring.
- No long floats (`1.323333`).
- No screenshot of a remembered split drawn as fact.
