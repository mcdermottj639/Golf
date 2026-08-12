# Plan — Live Round mode — **BUILT 2026-08-12**

*Drafted 2026-08-12; revised after the round deep-dive commit (`ec84539`) and Jack's
answers; **built the same day**. Kept as the design record. Where the build departed from
the plan, the reason is in "Built — what changed" at the bottom; `app.js` and the CLAUDE.md
sections on live rounds are the authority now.*

## What Jack asked for

> A live round updater that lets me select what club from the tee I used, and maybe some
> other info, and when it saves it goes right into the analysis and coaching logic.

So: an **on-course, hole-by-hole logger** — not another after-the-round form. Tap the tee
club, tap the result, tap the putts, next hole. On finish it becomes a normal round in
`S.rounds` and lands directly on that round's own analysis page.

Decisions from Jack (2026-08-12): keep the fairway row; **approach club is in v1 as an
optional row** ("we'll see how much I use it"); **saving jumps straight to the round's
analysis in Scores** — i.e. `roundView`, not the Scores list.

## Why the app is now ~90% ready

1. **The hole schema exists and is documented.** CLAUDE.md ("Logging a round") specifies
   per-hole `{ n, par, s, si, putts, gir, gmiss, fw, fmiss }` — miss codes
   `S / L / R / Lg / X`, and **`fw` omitted entirely on par 3s** (not `false`) so they
   don't count against the fairway rate. A live round must emit exactly this schema plus
   the two new club fields below.
2. **The per-round analysis engine already exists** (`ec84539`): tapping a round in
   Scores opens `roundView(i)` — traditional scorecard with circle/square marks,
   scoring mix, par splits, miss directions, scramble rate, SI-tier split, putts
   on-GIR-vs-off, `roundTips()` coaching with per-hole callouts, and `roundVsBaseline()`
   against the latest GHIN snapshot. **Every block self-hides when its data is absent —
   which means a live-logged round, arriving with full detail on every hole, lights the
   whole page up.** The "goes right into the analysis" ask is mostly *already built*;
   the live logger is the missing input side.
3. **Season-level aggregation of the detail fields is still missing.** `scoreStats()`
   reads only score-vs-par; `gir/fw/gmiss/fmiss/putts` are analysed per-round by
   `roundAnalysis()` but never summed across rounds. And nothing anywhere records
   **which club** was hit — the thing Jack asked for by name.

## The two new data fields

```js
// per hole, alongside n/par/si/s/putts/gir/gmiss/fw/fmiss:
tee: 'driver',   // club id (S.clubs id) hit from the tee
app: 'i7'        // OPTIONAL — club id of the approach shot (par 4/5); skip freely
```

Club *ids*, not names — names change (`club-update`), ids don't. Render via lookup with
graceful fallback to the raw string so an id that leaves the bag still displays. On a
par 3 the tee club *is* the approach club — `tee` + `gir/gmiss` there is the
iron-control record; `app` stays par-4/5 only.

The finished round object: `{ date, course, tees, nine?, par, rating?, slope?, score,
putts, troubles, note, holes:[...], live:true }` — the documented shape, so the rounds
table, sparkline, differential math and `roundView` need no schema work. Round `putts` =
sum of hole putts. `rating`/`slope` only when actually known (both or neither, per
CLAUDE.md); `troubles` keys strictly from `TROUBLES` since they drive lesson matching
for the next three rounds.

## State & flow

### `S.live` — the round in progress

```js
S.live = null | {
  date, course, tees, nine,      // nine: 'F' | 'B' | null (full 18)
  cur: 0,                        // index of the hole being edited
  holes: [ {n, par, si, tee, app, fw, fmiss, gir, gmiss, putts, s}, ... ],
  prevLayout: true|false         // par/si prefilled from history?
}
```

- Add `s.live = s.live ?? null` in `migrate()`.
- **`save()` after every single tap.** iOS suspends and kills PWAs constantly;
  localStorage is what survives. A round in progress must be losable only by explicit
  discard.
- New view `live` in `TITLES` + the `render()` map. **Not** in the bottom nav — entry is
  from Home; the view renders its own exit affordances.

### Entry points (Home)

- A **"Start a live round"** card: course input (reuse `courseList` datalist + the
  courses-db autofill already wired into the `input` listener), date defaulting to
  `today()`, 9 (front/back) vs 18 choice, and — when a dated briefing exists for today —
  a one-tap chip with that briefing's course.
- When `S.live` exists, the start card becomes a **resume banner** at the very top of
  Home: "Round in progress — Sterling Farms · hole 7 · +6 → Resume / Discard". Discard
  confirms first.

### Prefill from history — the big speed win

On start, find the most recent round in `S.rounds` at the same course with `holes`
(matching `nine` when set): copy its `n/par/si` layout and its `tees/rating/slope`.
Wianno and Sterling Farms already have full layouts on record, so at a repeat course
Jack never types a par — only club/result/putts/score. At a new course, par defaults to
4 and gets tapped per hole; rating/slope stay null (see feed backfill below).

### The hole screen — one screen per hole, thumbs only, zero keyboard

Sticky header: **Hole 7 · Par 4 · SI 11** + running total ("+6 thru 6"). Then:

1. **Par** — chips `3 / 4 / 5` (pre-selected when the layout is known).
2. **Off the tee** — club chips from `S.clubs` where `status==='gaming'` and `cat` not
   `wedge`/`putter`, longest first (driver, mini, 2-iron utility, then irons); the
   most-recently-used club sorts first within its slot so the common case is
   tap-top-chip. Wedges excluded from the tee row in v1.
3. **Fairway** — `Hit / L / R` (row hidden entirely on par 3; the field is *omitted*,
   never `false`, on par 3s) → `fw` + `fmiss`.
4. **Approach club** *(par 4/5 only, optional)* — same chip builder as the tee row but
   **including gaming wedges** and nothing pre-selected; skipping it is the expected
   default. This is the "we'll see how much I use it" row: it must never gate Next, and
   if it goes untouched for a few rounds it can be demoted behind a toggle without a
   schema change.
5. **Green** — `Hit / L / R / S / Lg` → `gir` + `gmiss`. Same miss vocabulary as
   `MISS_LAB`/`MISS_CYCLE` — one miss language across the app. (No `X` chip; a skipped
   direction on a missed green just stores `gir:false` with no `gmiss`, which
   `roundAnalysis()` already buckets as `X`.)
6. **Putts** — stepper `0 – 5+`, default 2.
7. **Score** — stepper, default = par; big `− n +`.
8. **Prev / Next** — free navigation both ways (fixing hole 3 while walking hole 5 must
   work). On the last hole, Next becomes **Finish round**.

Every control is a re-tappable toggle (tap again to clear), matching existing chip
behavior. Target: ~5 taps on a typical hole, under 15 seconds walking off the green.
All fields except score are skippable — a half-logged hole is valid, and every consumer
already treats detail fields as optional.

### Finish flow

Review screen: front/back/total, putts total, editable `tees` text, one whole-round
note, and the `troubles` chips **pre-lit from the data** — compute `roundAnalysis()` on
the draft round and light `three-putts` (≥2 three-putt holes), `off-tee` (fairways
< 45%), `approach` (green misses mostly `S`); Jack confirms or untaps. **Save** then:

1. Builds the round object, `S.rounds.push(r)`, clears `S.live`.
2. Advances gear counters exactly as `save-round` does (grip rounds, gaming-wedge
   grooves) — **factor that block into a shared `finalizeRound(r)`** used by both paths.
3. `save()` then **`render('round', S.rounds.length - 1)`** — straight into the new
   round's own `roundView` deep dive, per Jack's call. Toast: "Round saved — tap Scores
   for the season view." The full page of round-scoped tips lighting up *is* the reward
   loop.

## Analysis & coaching integration

### Per-round: `roundView` (mostly free, two additions)

A live round feeds the existing engine with zero glue. Two small extensions:

- **Show the clubs.** The hole-by-hole table's Tee column currently shows only the
  fairway result; when `tee` exists, show the club short-name with it (e.g. `Dr ✓`,
  `Mini left`), and likewise `app` beside the Green column when recorded. Short-name via
  a small `clubAbbr(id)` helper with raw-string fallback.
- **One new `roundTips()` entry — tee-club pattern within the round:** when ≥2 clubs
  have ≥3 tee shots each in this round and their fairway rates split hard, say so
  ("Driver 1/6 fairways today; the mini went 4/4 — tomorrow's tee plan writes itself"),
  threshold-gated like every other tip so it stays silent on thin data.

### Season-level: `scoreStats()` + `scores()` (the new build)

Extend `scoreStats()` to aggregate what `roundAnalysis()` computes per round, across all
rounds with holes — the Sterling Farms feed round contributes on day one:

```js
tee:   Map(clubId → { n, fwN, fwHit, missL, missR, over }),  // over = strokes vs par on those holes
app:   Map(clubId → { n, girHit, miss:{} }),                 // renders only once data exists
fw:    { n, hit, miss:{} },
green: { n, hit, miss:{} },
putts: { holes, total, one, three }
```

(Reuse the `MISS_LAB` vocabulary and the same omit-vs-false conventions; don't duplicate
`roundAnalysis()` — either call it per round and sum, or share a fold helper.)

New `scores()` sections, each rendering only when its data exists:

- **Off the tee** — table: club · tee shots · fairway % · miss split · score vs par on
  those holes. The section Jack asked for by name — where driver-vs-mini (the mini is in
  the bag *as* the fairway-finder) finally gets a number instead of a vibe.
- **Approaches by club** — GIR % and miss split per approach club, only once `app` has
  been logged enough to say anything (≥10 recorded approaches). If Jack never uses the
  row, this section simply never appears.
- **Where misses go & putting, season view** — GIR %, fairway %, miss-direction bars,
  one-putt/three-putt counts across live-logged holes: the hole-measured twin of the
  GHIN snapshot numbers.

New season `scoreTips()`, threshold-gated with sample guards in the house style (each
carries its number):

- **Tee-club verdict** — ≥2 clubs with ≥8 tee shots each and fairway % apart by ≥15
  points; argues whichever way the data points, including "the driver misses cost
  nothing, keep hitting it."
- **Live miss-direction** — hole-level version of `statTips()`'s "You miss short, not
  sideways", firing from the season `green.miss` share.
- **Three-putt pace** — hole-counted 3-putts across rounds, tied to the standing
  distance-control priority and the 30-ft ladder.

**Precedence rule (extends "film is king"):** hole-logged data is *measured*; a GHIN
snapshot is *summarized*; feel is *feel*. Where a season live-derived tip and a
`statTips()` snapshot tip would say the same thing, the live one wins once its sample
passes the snapshot's (same pattern as the existing `bigSampleSaysFine` guard, pointed
the other way). Until then both may show — tips already carry `src` labels with sample
sizes for exactly this. `roundVsBaseline()` already handles the per-round comparison and
needs nothing.

`statsCoverPutter()` needs nothing: any round dated after the gamer's `since` counts as
coverage, so the first live round with the LINK automatically retires the "nothing
measured yet" warning — and its putt count becomes real putter evidence.

## Feed-side changes (two small ones)

1. **Dedupe guard in `applyFeed`'s `round` handler:** skip when `S.rounds` already has a
   round with the same `date + course + nine`. Today the only guard is `feedId`, so a
   live-logged round plus a later GHIN feed entry for the same round double-counts every
   stat. The guard makes the mistake harmless — same philosophy as `course-add`'s name
   check.
2. **New `round-update` feed type:** match by `date + course` (+ optional `nine`),
   `Object.assign` round-level fields, merge per-hole fields by hole `n`. Live rounds
   land without `rating`/`slope` at new courses (killing `roundDiff()` → est. index for
   that round), and Jack won't type slope mid-round — this lets Claude backfill it, or
   correct a fat-fingered hole, afterward. Follows the `session-update`/`club-update`
   pattern. Ship it in app.js *before or with* any feed entry that uses it (unknown
   types are skipped forward-compatibly).

## Not in v1 (deliberately)

- Penalty strokes as a field (round note covers it), GPS/rangefinder anything,
  strokes-gained, shot-by-shot beyond tee/approach, editing past rounds in the UI
  (that's `round-update`'s job), any backend.

## Build checklist (for the implementing session)

1. `migrate()`: `s.live = s.live ?? null`.
2. `TITLES.live` + `render()` map entry; `live()` view (start / hole / finish screens
   off `S.live`).
3. Home: start card + resume banner.
4. `ACTIONS`: `live-start`, one delegated `live-set` handler reading `data-*` (not ten
   handlers), `live-prev/next`, `live-finish`, `live-discard`. Persist on every mutation.
5. Factor gear-counter block out of `save-round` into `finalizeRound(r)`; both paths use
   it. Pre-light finish-screen troubles from `roundAnalysis()` of the draft.
6. `roundView`: club names in the hole table (`clubAbbr` helper) + the within-round
   tee-club tip.
7. `scoreStats()` season aggregation + the new `scores()` sections + season tips +
   snapshot-yield guard.
8. `applyFeed`: round dedupe guard + `round-update` type.
9. `styles.css`: large-tap chip variant + stepper (~40 lines; stay inside the existing
   chip/btn language).
10. `sw.js`: the fetch handler is network-first (`cache:'no-store'` with cache
    fallback), so changed files reach the phone on the next online open without a bump —
    bump `CACHE` only if a new file is added to `ASSETS` (none planned). A courtesy bump
    is harmless.
11. CLAUDE.md: document `tee`/`app` fields, `round-update`, the dedupe guard, the
    live-vs-snapshot precedence rule, and that live rounds are user-layer data (never in
    the feed).
12. Validate (`node --check app.js`; JSON check if the feed changed), commit, push,
    **fast-forward `main`** per the standing instruction.

Estimated footprint: ~350 lines in `app.js`, ~40 in `styles.css`. No new files, no
framework, still offline-first — the live view needs zero network.

## Decisions log (was: open questions)

1. **Fairway row** — kept. It's what makes the tee-club table mean something: "driver
   6/14 fairways" needs the per-hole hit/miss, and it's one tap.
2. **Approach club** — in v1 as an optional, never-blocking row (Jack, 2026-08-12).
   Usage will decide whether it stays prominent, gets demoted behind a toggle, or earns
   deeper analytics.
3. **After save** — jump straight to the new round's `roundView` (Jack, 2026-08-12).

## Built — what changed, and why

Everything above shipped. Seven departures, all found while building or testing:

1. **Club keys come from the carry ladder, not `S.clubs`.** The plan said club ids. It
   can't work: the bag holds the irons as a single "KING TEC 4–PW" entry, so `S.clubs`
   cannot name the club that hit a par-3 tee shot. `S.carries` is the real 13-club list
   and is already ordered longest-first. Keys are slugs of the ladder row (`7-iron`,
   `mini-driver`, `50-wedge`); an unknown key prints itself.
2. **Par 3s offer the whole bag off the tee**, wedges included — a short par 3 *is* a
   wedge. Par 4/5 tee rows exclude the three Vokeys. The plan excluded wedges everywhere.
3. **A club is only credited with results it produced.** The fairway belongs to the tee
   shot; the green belongs to whatever hit at it — the approach club, except on a par 3
   where the tee shot is the approach. Crediting a driver with the green its 7-iron hit
   would make every tee-club number meaningless. So the *Off the tee* table's one rate
   column reads fairways for par 4/5 clubs and greens for par-3 clubs, labelled as such.
4. **Score and putts are chip rows, not steppers, and nothing is pre-filled.** A stepper
   costs up to three taps where a chip costs one, and a default score of par would let a
   skipped hole record a par he never made. Score chips run birdie→triple off the hole's
   par, with `±1` buttons for anything outside that.
5. **The par row rides small in the sticky header.** Six full-size rows made the hole
   2,600px tall — three phone screens, with the score off the bottom. Par is right nine
   times in ten off a prefilled layout, so it shrank; club grids went to seven across.
   A par 4 is now ~1,130px and a par 3 ~920px, which is one screen and a nudge.
6. **A part-round gets no course rating.** Scoring 4 holes of a nine and saving would
   otherwise attach the nine's rating and hand `roundDiff()` a wildly wrong differential —
   it dragged the estimated index from 9.2 to somewhere false in testing. Under a full 9
   or 18 the rating fields don't render, and the screen says why.
7. **`round-update` recomputes the total after a hole edit** (unless the entry sets one),
   so the card header can't disagree with its own hole-by-hole table.

Also added beyond the plan, all cheap: the course name snaps to the spelling already on
record (a phone-thumbed "sterling farms" must not fork the season stats), a new course is
added to Courses on start, a tap-anywhere hole strip for navigation, and `bumpGearCounters()`
rather than `finalizeRound(r)` since the shared block is exactly the gear counters.

**Testing.** No test suite exists, so validation was a Playwright harness driving a real
Chromium at 390×844: an 18-hole round tapped in end to end, re-tap-to-clear, par switching
dropping the fairway/approach rows, the score stepper past the chip range, a partial nine, a
back nine, case-mismatched course names, discard, both feed changes, and every view
rendering. Zero page or console errors. The harness lives in the session scratchpad, not the
repo — there's no runner here to keep it honest.
