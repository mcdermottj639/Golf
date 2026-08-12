# Plan — Live Round mode (workshop draft, not built)

*Drafted 2026-08-12 on `claude/live-round-updater-plan-911qg0`. This is the build spec for a
follow-up session. Nothing here is implemented yet.*

## What Jack asked for

> A live round updater that lets me select what club from the tee I used, and maybe some
> other info, and when it saves it goes right into the analysis and coaching logic.

So: an **on-course, hole-by-hole logger** — not another after-the-round form. Tap the tee
club, tap the result, tap the putts, next hole. On finish it becomes a normal round in
`S.rounds` and every existing analytic picks it up with zero glue.

## Why the app is already 80% ready

1. **The hole schema already exists.** The Sterling Farms feed round
   (`round-sterlingfarms-20260812`) carries per-hole
   `{ n, par, si, s, putts, gir, gmiss, fw, fmiss }` — green misses as `L/R/S/Lg`,
   fairway misses as `L/R`. A live round should emit **exactly this schema** plus one new
   field, and everything downstream (`withHoles()`, `scoreStats()`, `roundPar()`,
   `estIndex()`, worst-holes, par splits) works untouched.
2. **The analytics funnel exists.** `scores()` → `scoreStats()` → `scoreTips()` +
   `statTips()` already turns hole data into coaching copy, and `statsCoverPutter()`
   already counts logged rounds as evidence covering the gamer putter.
3. **What's missing** is (a) a capture UI usable mid-round, (b) the tee-club field, and
   (c) aggregation of the per-hole detail fields — today `gir/fw/gmiss/fmiss/putts` at
   hole level are *stored but never read*; only pasted GHIN `stats` snapshots drive the
   direction/putting tips.

## The one new data field

```js
// per hole, alongside n/par/si/s/putts/gir/gmiss/fw/fmiss:
tee: 'driver'        // club id (S.clubs id) of the club hit from the tee
```

Club *id*, not name — names change (`club-update`), ids don't. Render via a lookup with a
graceful fallback to the raw string so an id that has left the bag still displays.
On par 3s the tee club is the approach club; that's fine — `tee` + `gir/gmiss` on a par 3
*is* the iron-control record, no extra field needed.

The finished round object: `{ date, course, tees, par, rating, slope, score, putts,
troubles, note, holes:[...], live:true }` — same shape `save-round` and the feed's
`round` type produce today, so the Every-round table, sparkline, and differential math
need no changes. `putts` at round level = sum of hole putts.

## State & flow

### `S.live` — the round in progress

```js
S.live = null | {
  date, course, tees,
  cur: 0,                       // index of the hole being edited
  holes: [ {n, par, si, tee, fw, fmiss, gir, gmiss, putts, s}, ... ],
  prevLayout: true|false        // whether par/si were prefilled from history
}
```

- Add `s.live = s.live ?? null` in `migrate()`.
- **`save()` after every single tap.** iOS suspends and kills PWAs constantly;
  localStorage is the only thing that survives. A round in progress must be losable only
  by explicit discard.
- New view `live` in `TITLES` + the `render()` map. **Not** in the bottom nav — entry is
  from Home (below) and the view renders its own exit affordances.

### Entry points (Home)

- A **"Start a live round"** card: course input (reuse `courseList` datalist + the
  courses-db autofill that's already wired into the `input` listener), date defaulting to
  `today()`, and — when a dated briefing exists for today — a one-tap chip with that
  briefing's course name. 9 vs 18 choice (sets `nine:'F'/'B'` or full 18).
- When `S.live` exists, the start card is replaced by a **resume banner** at the very top
  of Home: "Round in progress — Sterling Farms · hole 7 · +6 → Resume / Discard".
  Discard confirms first.

### Prefill from history — the big speed win

On start, find the most recent round in `S.rounds` at the same course that has `holes`:
copy its `par`, `si`, `n` layout and its `tees/rating/slope`. Wianno and Sterling Farms
already have full layouts on record, so at a repeat course Jack never types par — he only
taps club/result/putts/score. At a new course, par defaults to 4 and gets tapped per hole.
If no history gives rating/slope, leave them `null` (see feed backfill below).

### The hole screen — one screen per hole, thumbs only, zero keyboard

Sticky header: **Hole 7 · Par 4 · SI 11** + running total ("+6 thru 6"). Then, top to
bottom:

1. **Par** — chips `3 / 4 / 5` (pre-selected from layout when known).
2. **Off the tee** — club chips built from `S.clubs` where `status==='gaming'` and
   `cat` is not `wedge`/`putter`, longest first (driver, mini, 2-iron utility, then
   irons). Wedges excluded from v1 — no par 3 on his card plays at 80–122 yds often
   enough to earn the row space; revisit if one does. Most-recently-used club sorts
   first within its slot so the common pattern is tap-top-chip.
3. **Fairway** — `Hit / L / R` (row hidden entirely on par 3) → `fw:true` or
   `fw:false, fmiss:'L'|'R'`.
4. **Green** — `Hit / L / R / S / Lg` → `gir` + `gmiss`. Same vocabulary as
   `MISS_CYCLE` in the 5-ft putting test, on purpose — one miss language across the app.
5. **Putts** — stepper `0 – 5+`, default 2.
6. **Score** — stepper, default = par; big `− n +`.
7. **Prev / Next hole** — free navigation both ways (fixing hole 3 while walking hole 5
   must work). On the last hole, Next becomes **Finish round**.

Every control is a re-tappable toggle (tap again to clear), matching the existing chip
behavior. Target: ~5 taps on a typical hole, under 15 seconds while walking off the green.

All fields except score are skippable — a half-logged hole (score only) is valid and the
aggregations must treat every detail field as optional, exactly as `scoreStats()` already
guards `h.s == null`.

### Finish flow

Review screen: front/back/total, putts total, editable `tees` text, one whole-round note
field (`troubles`-style chips too — see auto-derive below, chips arrive pre-lit and Jack
can adjust). **Save** then:

1. Builds the round object, `S.rounds.push(r)`, clears `S.live`.
2. Advances gear counters exactly as `save-round` does today (grip rounds, gaming-wedge
   grooves). **Factor that block into a shared `finalizeRound(r)`** used by both paths
   rather than duplicating it.
3. **Auto-derives `troubles` from the hole data** so `struggles()`/`coachSignals()` and
   the Coach lesson picker keep working without being asked: ≥2 three-putt holes →
   `three-putts`; fairways < 45% → `off-tee`; GIR misses mostly `S` → `approach` — each
   pre-lights its chip on the review screen, Jack confirms or untaps.
4. `save(); render('scores')` + toast "Round saved — Coach updated" — landing on Scores
   *is* the "goes right into the analysis" moment; he should see the tables move.

## Analysis & coaching integration (the actual point)

Extend `scoreStats()` to aggregate the detail fields it currently ignores — sourced from
**all** rounds with holes, so the Sterling Farms feed round contributes on day one:

```js
tee:   Map(clubId → { n, fwN, fwHit, missL, missR, over }),  // over = strokes vs par on those holes
fw:    { n, hit, L, R },
green: { n, hit, L, R, S, Lg },
putts: { holes, total, one, three }                          // three = 3-putt-or-worse count
```

New `scores()` sections (each renders only when its data exists, like everything else on
that page):

- **Off the tee** — table: club · tee shots · fairway % · miss split · score vs par per
  hole. This is the section Jack asked for by name, and it's where the
  driver-vs-mini-driver question (the mini is literally in the bag as the
  "fairway-finder") finally gets a number instead of a vibe.
- **Where approaches finish** — GIR % and a miss-direction bar from `gmiss`. This is the
  live-data twin of the GHIN "misses short" snapshot stat.
- **Putting, from your own holes** — putts/round, one-putt and three-putt counts.

New `scoreTips()` entries, threshold-gated with sample-size guards exactly in the style
of `thin()` / the existing tips (each carries its number):

- **Tee-club verdict** — only when ≥2 clubs have ≥8 tee shots each and fairway % differs
  by ≥15 points: "The mini finds 71% of fairways; the driver 38% — and the holes score
  the same. The driver is costing position without buying strokes." (Or the reverse —
  the tip argues whichever way the data points, including "the driver misses cost
  nothing, keep hitting it.")
- **Live miss-direction** — the hole-level version of `statTips()`'s "You miss short,
  not sideways", firing from `green.S` share instead of a pasted snapshot.
- **Three-putt pace** — ties hole-counted 3-putts to the standing distance-control
  priority and the 30-ft ladder drill already on the card.

**Precedence rule (extends "film is king"):** hole-logged data is *measured*; a GHIN
snapshot is *summarized*; feel is *feel*. Where a live-derived tip and a `statTips()`
snapshot tip would say the same thing, the live one wins and the snapshot version yields
(same pattern as the existing `bigSampleSaysFine` guard, pointed the other way once live
sample size passes the snapshot's). Until then both may show with their sample sizes —
the tips already carry `src` labels for exactly this.

`statsCoverPutter()` needs nothing: it already treats any round dated after the gamer's
`since` as coverage, so the first live round with the LINK automatically retires the
"nothing measured yet" warning — and its 38-putt cousin becomes real putter evidence.

## Feed-side changes (two small ones)

1. **Dedupe guard in `applyFeed`'s `round` handler:** skip when `S.rounds` already has a
   round with the same `date + course + nine`. Today the only guard is `feedId`, so if
   Jack live-logs a round and later sends me the GHIN summary (or I log it from his
   message out of habit), the round double-counts in every stat. The convention "don't
   feed rounds he live-logged" isn't enough on its own — the guard makes the mistake
   harmless, same philosophy as `course-add`'s name check.
2. **New `round-update` feed type:** match a round by `date + course` (+ optional
   `nine`), `Object.assign` round-level fields, and merge per-hole fields by hole `n`.
   Live rounds will land without `rating`/`slope` at new courses (breaking `roundDiff()`
   → est. index for that round) and Jack won't type slope mid-round — this lets me
   backfill it, or correct a fat-fingered hole, from the feed afterward. Follows the
   existing `session-update`/`club-update` pattern. Remember: unknown types are skipped
   forward-compatibly, so this must ship in app.js *before or with* any feed entry that
   uses it.

## Not in v1 (deliberately)

- **Approach-club tracking on par 4/5** — the obvious phase 2. One more chip row per
  hole doubles the input cost on every hole; ship the tee version, and add it only if
  Jack still wants it after a few live rounds. The schema slot (`app` field) costs
  nothing to reserve mentally; don't build the UI yet.
- Penalty strokes as a field (goes in the round note), GPS/rangefinder anything,
  strokes-gained, shot-by-shot, editing past rounds in the UI (that's what
  `round-update` is for), any backend.

## Build checklist (for the implementing session)

1. `migrate()`: `s.live = s.live ?? null`.
2. `TITLES.live` + entry in `render()`'s map; `live()` view function (start screen /
   hole screen / finish screen off `S.live` state).
3. Home: start card + resume banner.
4. `ACTIONS`: `live-start`, `live-set` (one delegated handler reading `data-*`, not ten),
   `live-prev/next`, `live-finish`, `live-discard`. Persist on every mutation.
5. Factor gear-counter block out of `save-round` into `finalizeRound(r)`; both paths use it.
6. `scoreStats()` aggregation + three `scores()` sections + three `scoreTips()` entries
   + snapshot-yield guard.
7. `applyFeed`: round dedupe guard + `round-update` type.
8. `styles.css`: large-tap chip variant + stepper (~40 lines; stay inside the existing
   chip/btn language).
9. `sw.js`: bump `CACHE` to v22 — **the phone doesn't get new app code without this.**
10. CLAUDE.md: document `tee` field, `round-update`, the dedupe guard, and the
    live-vs-snapshot precedence rule.
11. Validate (`node --check app.js`, JSON check if the feed changed), commit, push,
    **fast-forward `main`** per the standing instruction.

Estimated footprint: ~300 lines in `app.js`, ~40 in `styles.css`, one-line `sw.js` bump.
No new files, no framework, still offline-first — the live view needs zero network.

## Open questions for Jack (defaults chosen so building can start without answers)

1. **Input depth per hole** — the six-row screen above, or a leaner four-row version
   (drop the fairway row, keep tee club + green + putts + score)? *Default: six rows;
   fairway data is what makes the tee-club table say something.*
2. **Approach club in v1?** *Default: no — phase 2 after the tee version proves itself.*
3. **Should finishing a live round land on Scores or back on Home?** *Default: Scores —
   seeing the analysis move is the reward loop.*
