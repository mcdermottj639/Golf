# CLAUDE.md — Caddie HQ

Personal golf command center for **Jack McDermott** — bag, stroke diagnosis, coaching,
and courses in one installable web app. This file is the guide for keeping it current.

## What it is

A **static, offline-first PWA** — no backend, no build step, no framework. Plain
HTML/CSS/vanilla JS. All of a user's data lives in the browser (`localStorage`).
Hosted on GitHub Pages; installs to the phone home screen via the service worker.

```
index.html            App shell + nav + service-worker registration
app.js                The whole app: seed data, state, all views, render logic
                      (incl. the live-round logger — see "Live rounds" below,
                       the Mental tab, see "The Mental tab", and RELEASES, the
                       app's own changelog — see "Home ends with What's new")
styles.css            "Scorecard Heritage" theme (cream paper, Masters green, burgundy)
lessons.js            Coaching lesson library (window.LESSONS)
courses-db.js         Course autocomplete database
coach-feed.json       One-way "coach inbox" — see Data model below  ← updates land here
sw.js                 Service worker (offline cache of the shell)
manifest.webmanifest  PWA manifest;  icon.svg — app icon
PROPOSAL.md           The concept this build implements (historical)
design-options/       Pre-approval design candidates (historical snapshots — don't edit)
mockup/               Original pre-approval mockup (historical snapshot — don't edit)
```

There is **no test suite and no bundler.** "Build" = the files as-is. Validate before
committing:

```
node --check app.js
python3 -c "import json; json.load(open('coach-feed.json'))"
```

To preview locally: `npx http-server .` then open the served URL (a plain
`file://` open mostly works too, but the service worker + `fetch` want a server).

**For a LAYOUT or ORDER change, drive it in a real browser before pushing** — `node --check`
proves the file parses and nothing else, and the app has no tests, so a section that landed
in the wrong place or a row of chips that wraps off a 320px phone reaches Jack's phone
unless somebody looked. Serve the folder and drive it with Playwright against the Chromium
already on the machine; `app.js` is an IIFE, so its functions are NOT global — navigate by
clicking real elements (`#nav button[data-view=…]`, a `.labsel`, a `.seg`) rather than
calling `render()`. What is worth asserting, because each of these has actually been wrong:
the order of `#view h2`s, an element's `getBoundingClientRect()` against the viewport
(is it above the fold?), `scrollWidth > clientWidth` on a chip (does the label clip?),
`documentElement.scrollWidth > innerWidth` (does the page scroll sideways?), and a
`pageerror` listener for the whole run. **Check 320px as well as 390px** — that is the
narrowest phone and the width the form-control rule below was set at. This proves layout,
not correctness: a number can be confidently wrong in a page that renders perfectly.

## Data model — READ THIS BEFORE CHANGING BAG / SESSION / COURSE DATA

State comes from **two layers merged at runtime**, plus the user's own local edits:

1. **`seed()` in `app.js`** — the *frozen baseline* ("everything already known from
   Jack's Drive folder" at launch). Treat it as history. It is NOT the live truth and
   generally should not be rewritten to reflect new events.

2. **`coach-feed.json`** — an **append-only, apply-once inbox.** On every app open
   (`fetchFeed()`), the app fetches this file and applies any entry whose `id` it hasn't
   seen. Applied ids are remembered in `S.feedApplied`, so:

   - **Each `id` applies exactly once, ever.** Editing or re-using an existing entry does
     **nothing** for anyone whose app already applied that id (i.e. Jack's phone).
   - **To push an update, APPEND a NEW entry with a NEW unique id.** Never mutate or
     rename an existing entry to change live behavior — it won't take.
   - Order matters: entries apply top-to-bottom on first sight.

3. **`localStorage`** — the live per-device state (seed + all feed entries applied so far
   + the user's own logged rounds/tests/carries). This is what actually renders.

**Golden rule:** *Live changes go through new `coach-feed.json` entries, not through
`seed()`.* Bump the top-level `"updated"` date when you append.

### Feed entry types (see `applyFeed()` in `app.js` for the authority)

| `type`           | Effect |
|------------------|--------|
| `club-add`       | Add a club (`club` object; the entry `id` becomes the club id) |
| `club-update`    | Patch a club matched by `target` (club `id` **or** `name`); `Object.assign` of `club` |
| `history`        | Prepend a bag change-history row (`date`, `text`) |
| `history-edit`   | Rewrite a history row containing `match` |
| `session`        | Add a filmed putting session (`date`, `setup`, `finding`, `detail`) |
| `session-update` | Patch a session by `target` (its feed id) or `setupMatch` prefix |
| `session-remove` | Drop a session by `target` (its feed id), **or** by a `setupMatch` prefix optionally narrowed by `date` — the second form is the only way to remove a `seed()` session, which has no feed id. Used to fold duplicates and to clear out retired-gear film |
| `evolution`      | Replace the metric-evolution grid. Carries `sessions` (short column labels), `notes` + `foot` (the legend, now data not code), and per metric `name` / `marks` / `s` / `state` / `verdict` |
| `faults`         | Replace the faults list. **`discipline`** (`putting` default / `swing` / `short-game`) scopes the replace to that lab only, so pushing swing faults can't wipe the putting ones; omit it and it replaces everything. **Start a `why` with `CLOSED` or `DOWNGRADED`** to settle one — `faultState()` reads that first word, which is what drops it off the Putting tab's diagnosis card and out of Coach's open-fault to-dos. Anything else reads as open |
| `action`         | Add an open action item |
| `action-done`    | Mark action `target` done |
| `action-update`  | Rewrite action `target` text |
| `carries`        | Replace the distance ladder (ignored once the user calibrates) |
| `carry-update`   | Patch ONE ladder row by `target` name: `club` to add/patch (`after` names the row to insert behind), `remove:true` to drop it. **Not** gated on calibration — see below |
| `course-add` / `course-remove` | Add/remove a course. **`course-add` dedupes on an EXACT name match only**, so pushing a course Jack already typed under a different spelling gives him two rows for one course — see *Two rows, one course* below |
| `round`          | Add a played round (see *Logging a round* below). Skipped if a round with the same `date` + `course` + `nine` is already there, whatever put it there |
| `round-update`   | Patch a round matched by `date` + `course` (+ `nine`): `Object.assign` of the top level, per-hole merge by hole `n`. **The way to backfill `rating`/`slope` onto a live-logged card**, or fix a hole after the fact. **On a `live:true` card it only FILLS GAPS** — fields the card already carries are left alone, because he recorded them standing on the hole. To overwrite one deliberately, put `"force": true` on the entry. Per-hole merges are unaffected either way |
| `stats`          | Add/replace a cumulative stats snapshot (GHIN summaries); `replaces` swaps one out |
| `test`           | Append a 10-ball putter test result |
| `shortlist`      | Replace the putter shortlist (keeps prior `demoed` flags) |
| `briefing` / `briefing-remove` | Round-prep briefings & standing plans (see *Writing briefings* below). `discipline` routes a standing plan to its lab: `putting`, `mental`, `short-game`, `full-swing`/absent |
| `debrief` / `debrief-update` | Add/patch a mental-game debrief Jack **recounted** rather than typed (see *The Mental tab*). Entry `id` becomes the debrief id |
| *(round fields)* | A round may carry `result` (`W`/`L`/`T`), `margin` (holes, signed from Jack's side) and `matchNo` — set them with `round-update`. See *Match play* |
| `lesson-update` | Patch a Coach lesson by `target` (its id); `Object.assign` of `lesson`. Patches accumulate, so two updates to one lesson both survive. A `target` matching no lesson is ignored |
| `lesson-add`    | Add a whole Coach lesson (`lesson` object carrying its own `id`). Naming a new `shelf` creates one |
| `lesson-remove` | Retire a lesson by `target` — a later `lesson-add` with the same id un-retires it |
| `kit`            | Mark practice kit owned (`add`) or gone (`remove`) — arrays of `KIT` keys from `app.js`. **Only ever a relay of Jack's own declaration** ("got this for at home practice"); ownership is his to state and is never inferred, so never send one on a guess. Added Aug 24 2026 with the PuttOut AirBreak mat (`airbreak`) |
| `geo`            | Put a course's location on file (`geo:{course, lat, lon, prec, place, src}`). Round Prep sorts the standing plans and Courses sorts the rankings **nearest first** off it — see *Nearest first* below. Replaces any earlier fix for that course, matching on the name **before the em dash**, so one fix serves every course at a facility |
| `deadline`       | Set the return-window deadline (clears "estimated") |

Unknown types are left unapplied on purpose (forward-compat), so a typo'd `type` silently
does nothing — double-check against `applyFeed()`.

### Club status values

`gaming` (in the bag), `ordered` (on order), `backup` (owned, not in the 14),
`wishlist` (scouting), and `returned` (sent back — drops out of every bag list).
`clubRow()` also renders a **MISMATCH** flag for a `flow:'toe'` putter against an
`SBST` stroke. Its other status pills are read off the club's own record and nothing else
(Aug 27 2026): `DECIDED` is `returnWindow:false`, `IN RETURN WINDOW` is `returnWindow:true`,
`UNMEASURED` is a null carry on the club's ladder row, and `OVERLAP` is two ladder lofts
inside 1.5° of each other. A club's `note` is never scanned for any of them.

## Player profile (drives the diagnosis logic)

- Jack McDermott · ~8.5 handicap · 5'10"
- Putting stroke: **SBST** (straight-back-straight-through) — confirmed on overhead film.
  This is why arc/toe-flow putters get flagged as a mismatch.
- **Right-eye dominant** (self-reported, Aug 13 2026) — and right-handed, so *same-side*
  dominant, the group taught to aim **left**. That is the signature miss, and it is the
  only candidate cause that predates every putter he has owned, so it is worth carrying.
  Treat it as an **explanation, never a second correction**: the barely-open feel already
  cancels whatever aims him left, and stacking an eye-dominance fix on top misses right.
  Two honesty guards: the reported dominance is almost certainly a *standing* (primary-gaze)
  result, and the only peer-reviewed study here (Dalton, Guillon & Naroo, *Optom Vis Sci*
  2015;92(10):968–75, n=31) found primary- and putting-gaze dominance are neither equal
  nor predictive of each other, with putting-gaze the weaker — so putting-gaze dominance
  is **unmeasured**. Full read in the *Putting — The Workshop Log* plan (Aug 13 section);
  the owed two-drop test rides along with the overhead five in *Grip & Posture*'s sibling,
  the *Putting Routine* FACE section.
- Signature miss: **left on short putts** — the through-line of the whole putter saga.
  **Aug 10, 2026: likely reclassified as an AIM error, not a delivery error.** Jack found
  that setting the face *barely open* at address is the sweet spot. A zero-torque head
  doesn't twist — it delivers the angle you set — so the 1.5–1.7° left measured at
  *impact* was almost certainly 1.5–1.7° left at *address*. Unconfirmed until the overhead
  five is run. Two guards live in the plans: don't stack the feel-fix with an aim-picture
  retrain (that applies the correction twice and misses right), and put a number on
  "barely" so it can't drift.

## Current bag (source-of-truth summary — keep in sync with the feed)

| Slot | Club | Notes |
|------|------|-------|
| Driver | TaylorMade Stealth 2 · 9° | |
| 5-wood | **Cobra Darkspeed X · 16.5°** | bumped DOWN from stock; back in Aug 12 2026 after a year out, taking the mini driver's fairway-finder slot. **Carry unmeasured** — and at 16.5° it sits ~0.5° off the 2-iron utility, so whether both belong in the bag is an open question |
| Utility | Cobra KING TEC 2-iron · ~17° | |
| Irons | Cobra KING TEC 4–PW | **44° PW** anchors the wedge ladder |
| Wedges | **Vokey 50.08F · 56.10S · 60.08M** | 50 = F/8° sweeper · 56 = S/10° workhorse · 60 = M/8° creative |
| Putter | **L.A.B. Golf LINK.2.1** | the only zero-torque head left. Narrow blade, gamed Jul 30 – Aug 1 and again from **Aug 10, 2026**. **KEPT for good Aug 12, 2026** — Jack closed the return window by decision, so `returnWindow:false` and `pendingReturn()` is empty: the Home return-window card is gone and Decisions reads DECIDED. The putter search is over; every remaining explanation for the left miss is aim or stroke, not gear. Carries a **Lamkin Deep Etched** grip (the app said *Pistol 0* Jul 30 – Aug 14; corrected by looking at it — both are 0° lean, so no cue changed): zero built-in lean, shaft vertical, hands ~1.35" behind the ball — that's the live cue. **Loft confirmed 2° effective** (Aug 14, L.A.B.'s spec panel on the *custom* build page — the stock page and every retailer omit it). Still unknown: **as-built length** (34" targeted, never confirmed) and **head weight** (never known on any putter Jack has owned) — both build-order facts, so they need L.A.B., not a website. Its column holds the only two reds on the evolution grid (face at impact, 1.5–1.7° left start line, both measured Jul 30) |
| Benched | ~~TaylorMade r7 Quad Mini Driver · 13.5°~~ | **out Aug 12 2026**, kept not sold. Its tee-shot record stays in the Off-the-tee table as history |
| Bullpen | Titleist TSR2 7-wood | used demo · HZRDUS Red CB regular · picked up Aug 12 2026, **owned not gamed**. Sits behind the 4-iron on loft if it's stock, so it is not in the 14 and not on the carry ladder |
| Backup putter | Scotty Newport 2 | arc-suited toe-hang blade — renders a **MISMATCH** flag against the SBST stroke. If the LINK goes back this is all that's left, i.e. the mismatch the whole saga opened with |
| Returned | ~~L.A.B. Golf DF3i · 34"~~ | **returned Aug 10, 2026 — distance control.** Gamed Jul 18–30 and Aug 1–10. Its Press Pistol 2° went with it, so the "hands even with the ball" cue is **retired** — don't carry it to the LINK. Lost with it: the only measured scoreboard in the project (8/10 from four feet, Jul 20) and the high-MOI control head |
| Returned | ~~Scotty Phantom 7.5~~ | **officially returned Jul 20, 2026** |

**Live putting priority: distance control.** Pace has now decided the fate of two putters (DF3i benched Jul 30, reprieved Aug 1, returned Aug 10) and had never been measured once until the live logger's first-putt distance field (Aug 20) — the three-putt rate from 21 ft + is the on-course version of it, so check that row before repeating "unmeasured". The grind is the 30-ft ladder twice a week on the LINK, logging *shorts · spread · green speed*, plus the unrun tape test — an off-centre strike bleeds ball speed, so it's a distance fault before it's a line fault. Tempo is **not** the problem (2.0:1 on this head vs a 2:1 target).

Wedge ladder behind the 44° PW carries roughly: PW 122 · 50° 108 · 56° 95 · 60° 80.

## How to make common updates

- **Bag change** (new club, spec fix, status change): append a `club-add` or
  `club-update` entry + usually a `history` entry. Use a unique dated `id`.
- **Log a filmed putting session**: append a `session` entry; update `evolution` /
  `faults` if the read changed. **Give its `detail` a `gist`** — ONE line, ~95 characters,
  saying what the session concluded. That is what the labs' film-room list renders
  (`sessionLog()` in `app.js`), and it follows the same rule as a briefing section's `k`:
  an authored line wins, the finding's opening sentence is the fallback, so older sessions
  still read. Findings run to paragraphs now, and a session without a `gist` is a row you
  have to read in order to navigate past it. Note `session-update` sets `detail` WHOLESALE,
  so send the existing metrics/story back with it.
- **Close out a to-do**: append an `action-done` targeting the action's id.
### Logging a round (the hole array is the whole point)

A `round` entry carries `date`, `course`, `par`, `score`, `putts`, `troubles[]`, `note`, and
optionally `tees`, `nine` (`'F'`/`'B'`), `rating` + `slope` (both needed for a handicap
differential — omit rather than guess). The value is in `holes[]`, one object per hole:

| Field | Meaning |
|---|---|
| `n` · `par` · `s` | hole number, par, score — the minimum; everything else is optional |
| `si` | stroke index. Unlocks the hardest-six / easiest-six split |
| `putts` | putts on that hole. Unlocks 1/2/3-putt counts and putts-on-GIR-vs-off |
| `pm` | how long the putt he **holed** was, as a `PUTT_DIST` key. Absent on a conceded hole and where `putts` is 0 |
| `pd` | where the **first** putt started, same keys. Only recorded when `putts` >= 2 — on a one-putt hole the first putt IS the made putt |
| `gimme` | `true` when the last putt was conceded rather than holed. Still counted in `putts` and in the score; see *Given putts* below |
| `gir` | `true`/`false` — green in regulation |
| `gmiss` | where a missed green finished: `S` `L` `R` `Lg` `OB` `X` (short/left/right/long/out of bounds/other) |
| `fw` | `true`/`false` — fairway hit. **Omit entirely on par 3s** so they don't count against the fairway rate |
| `fmiss` | where a missed tee shot finished, same codes — `OB` included |
| `tee` | **club key** hit off the tee — drives the *Off the tee · by club* table |
| `app` | **club key** hit into the green on a par 4/5. Omit on par 3s: there the tee shot *is* the approach |
| `noshot` | `true` when the tee shot left **no realistic play at the green** — see *Two ways to miss a green* below. Par 4/5 only |
| `note` | free text Jack wrote **on that hole**, in the live logger. The only field on a card that records *why* — everything else records *what*. Renders on the round card under "What you wrote on the course", and marks the hole with ✎ |

Tapping a round in **Scores** opens `roundView()` — the hole-by-hole card, scoring mix,
par splits, miss directions, round-scoped coaching, and a comparison against the latest
`stats` snapshot. Every block hides itself when its data is absent, so a score-only round
still opens; it just shows less. `troubles[]` must use the keys in `TROUBLES` (`app.js`
top) — they also feed lesson matching for the next three rounds.

**The carry ladder is the club roster.** `S.carries` is what the live logger offers off
the tee, so a club leaving or joining the bag is a ladder change as much as a `S.clubs`
change — miss it and the logger keeps offering a club he no longer carries. Use
`carry-update`, never `carries`: a whole-ladder replace is ignored once he has calibrated
his numbers and would silently do nothing. He owns the carry figures; bag membership is a
coaching update, which is why only one of the two is gated. Leave a new club's `carry`
**null** rather than estimating it into a calibrated ladder — blank reads as unknown, a
guess reads as measured. A key that has left the ladder still renders on old cards via
`clubFallback()`, so retiring a club never orphans the rounds it played.

**Club keys** are slugs of the **carry-ladder** row names, not `S.clubs` ids — the bag holds
the irons as one "KING TEC 4–PW" entry and so can't name the club that hit a shot, while
`S.carries` is the real 13-club list: `driver`, `mini-driver`, `2-iron`, `4-iron`…`9-iron`,
`pw`, `50-wedge`, `56-wedge`, `60-wedge` (`clubKey()` in `app.js` is the authority). An
unrecognised key still renders — it just prints itself.

### Live rounds (Jack logs these himself — do not feed them)

Home → **Play a live round** opens the hole-by-hole logger: one screen per hole, chips only,
saving to `S.live` on every tap (iOS kills suspended PWAs, so nothing may live in memory).
Finishing writes an ordinary round — same schema as above, plus `live:true`, which is what
puts the card at the top of the evidence stack (see *Live rounds take precedence* below) —
and drops him straight into its `roundView`. Two rows on the hole screen beyond the scoring
chips: **OB** on Fairway and Green, and a per-hole **Note** — both documented below. Par and stroke index prefill from the newest card at that
course, so a repeat course needs no typing at all.

**The course box offers what he has already prepped (Aug 20 2026).** Tapping it opens
`livePicker()` — the prepped courses first (upcoming plans by date, then standing plans,
then played ones, each with its hole-note count), then every other course on his list,
marked where a scorecard is on file. It filters as he types and a tap fills the box, so a
round at a prepped course needs no keyboard. Two things to keep: a pick resolves through
`planPlayName()` to the spelling already on record — course name is the join key for
layouts, the worst-holes table and a briefing's history link, and a plan's own name may
carry an event suffix — and the second group exists so the list never dead-ends on a
course nobody has written a plan for.

**Round prep reaches the course, one hole at a time.** A briefing whose `course` matches
the round (suffix-tolerant, so "Beekman Golf Course — Scramble" matches a round logged as
"Beekman Golf Course") reaches the logger through its **per-hole notes only** — the
whole-round `focus`/`rules` deliberately do NOT ride along on every hole, because they are
a first-tee read and repeating them on all eighteen screens just pushes the hole note down.
The full plan lives in Home → Round Prep, which keeps every course plan permanently.
A briefing carries **`holes[]`** — per-hole course
knowledge that surfaces on that exact hole while he's standing on it, which is the
highest-value thing a briefing can contain and worth writing whenever the research
supports it. It renders in `briefing()` as a "Hole by hole" table too.

Write a hole as a **decision plus its reasons**, never a paragraph — it gets read on a tee
box, one-handed:

```json
{ "n": 1, "yds": 337,
  "play": "*5-wood or 2-iron* — not driver",
  "leaves": "A *full wedge* in",
  "avoid": "*Right*. That is where you had *no play* at the green",
  "why": ["337 and *downhill* — the shortest hole out here"] }
```

`play` is the one line to act on: it renders as the FIRST labelled row, tagged **TEE** by
default, with `playAs` overriding the label where the decision isn't a tee-shot call
("Play" on a lay-up or a damage-control hole). `leaves` and `avoid` are optional rows after
it — their value is that LEAVES sits in the same place on every hole that has one, so the
eye finds it without reading. Omit any of them where there is nothing true to put in it; a
padded slot is worse than a missing one. `why[]` are the bullets underneath and carry
everything the slots don't.

`yds` rides in the header, the hole's own record renders as a LAST row under a rule, and
`*asterisks*` bold a phrase (applied after escaping, so the markup is author-only). A
prose `note` still renders for older plans, but don't write new ones that way.

**Three more fields make the hole MARKABLE afterwards — write them on every hole you can
(Aug 20 2026).** They are what lets the round card grade the plan (see *The prep loop* below),
and they exist because the prose can't be trusted to say it: `avoid` reads "*Right*." on one
hole and "The long second" on another, and only one of those two words is a direction.

| Field | Meaning |
|---|---|
| `club` | Carry-ladder **keys** the `play` call names, as an array — `["5-wood","2-iron"]`. Omit where the call is positional ("Fairway first — favour left-center") rather than a club |
| `avoidDir` | The finish `avoid` warns about, as a **`DIRS` code** (`S` `L` `R` `Lg`). Omit where the warning isn't a direction — "the three-putt", "getting greedy", "the water" all correctly get nothing |
| `avoidOn` | `tee` or `green` — which shot the warning is about. Omit for a hazard in play on both (bunkers right of the fairway *and* the green). A tree down the right and a bunker short are different warnings, and counting either finish against either one would inflate the hit rate |

**The Sterling Farms standard (standing instruction, Aug 12 2026) — every round prep
works this way now.** Jack approved the Sterling Farms plan as the model. When he names a
course he's playing:

1. **Research the course first.** Hunt the course's own hole-by-hole pro tips (most
   course sites carry a tour; search snippets work when the site itself is blocked), then
   reviews for doglegs, elevation, green complexes, and per-hole yardages.
   *What the course demands* leads every note; *what happened last time* backs it up
   underneath. Aim for a note on every hole the sources can support — the per-hole
   `holes[]` notes are the highest-value part of the plan.
2. **Hunt the water and the bunkers specifically (standing instruction, Aug 12 2026).**
   Hazards are the single most valuable researched fact, because unlike a pin they do not
   move: where the water sits on the 13th is true every round forever. Chase them
   deliberately rather than taking whatever a review happens to mention — which hole has
   water, which greens are bunkered and on which side, what guards the fairway. Each one
   goes in that hole's **`avoid`**, named plainly ("the *water*", "*large bunkers* right of
   the fairway AND the green"), and the big ones earn a `rules[]` chip so they are on the
   first-tee read too. List every hazard found in the paper-trail section so the next
   session doesn't have to rediscover it — and say which are unconfirmed.
3. **Pin before you write.** Syndicated copies of a course tour shift the hole numbering,
   so match every tip against the pars and shapes on Jack's own card (or the official
   scorecard) before attaching it to a hole — and DROP any tip that can't be pinned. A
   floating tip on the wrong hole is worse than no tip.
4. **Every note traceable, and say when it's an inference.** A yardage or hazard means it
   was researched; a score, miss or stroke index means it came off his card. **Never
   describe a hole you haven't got a source for** — holes with no source get only his own
   record, which needs no briefing. Where a line is REASONED from a sourced fact rather
   than sourced itself ("dogleg right, so a ball started left runs through the fairway"),
   the note has to admit it and name what's still unknown. A confident tee line built on
   nothing but a hole's shape reads exactly like a researched one, and that is the failure
   worth guarding against.
5. **Centre of the green, always.** Never build a plan around a pin position — you can't
   know where the flag is on the day, and a plan written for one sends him at an edge on
   a course where his standing miss is already short. Every approach and par-3 note
   targets the **middle**, club chosen off the yardage to the middle. *Back pin*, *front
   pin*, *tucked* and *short-side* are smells. Hazard and green-complex facts are fine —
   where the trouble sits doesn't move; where the flag sits does.
6. **Say where it came from.** Close the plan with a paper-trail section splitting
   researched facts from card facts, source by source.
Underneath that, `holeRecord()` shows what his own cards say about the hole (plays, average
against par, best, the club he's used) — that one needs no briefing at all and flags a hole
averaging +1.5 or worse as one to play for bogey on purpose.

**The tee club is suggested, never assumed.** On arriving at a hole the logger pre-fills
the club from what he hit off *that hole at that course* last time, else from the last club
he hit off a tee earlier in the same round (never onto a par 3 — a par 3's club belongs to
the hole). A suggested chip renders **half-lit**, a confirmed one solid, and tapping the
suggestion confirms it rather than clearing it. On a repeat course that is 18 taps saved.
The half-lit state has to stay visible: a silent "driver" default would swallow every hole
he actually hit the mini on, which is precisely the comparison the club tables exist for.
`teeAuto`/`teeTouched` are UI state on `S.live` only and never reach the saved round.

Two things follow for anyone writing feed entries:

- **Never send a `round` entry for a round he logged live.** The dedupe guard above makes it
  harmless if you do, but the round is already there.
- A live card carries **no `rating`/`slope`** at a course he hasn't played with a full card
  before, and none at all if he scored fewer than 9 or 18 holes (a part-round can't produce
  a differential). Backfill with `round-update` when he tells you the tees.

### Two ways to miss a green (the `noshot` flag, Aug 12 2026)

A green missed from a playable position asks a **club** question — was the number right?
A green the tee shot already took away asks a **driving** one, and the stroke was gone
before the approach club came out of the bag. Both used to land in the same bucket, which
made the app's loudest finding ("you miss short → re-baseline your carry ladder") point at
the wrong club whenever the real cause was the drive.

`noshot:true` separates them. It is one chip on the live logger's Green row (par 4/5 only —
on a par 3 the tee shot *is* the approach, so there is always a shot), independent of the
direction chips: a hole can be both `gmiss:'S'` **and** `noshot:true`, and only the second
fact says who to blame. Tapping it implies `gir:false`; tapping *Hit* clears it.

What it changes, and what it deliberately doesn't:

- **Miss directions** (round card, Scores, and the tips) compute over *playable* misses
  only, and report the conceded ones alongside. `liveTroubles()` charges them to `off-tee`.
- **The tee-club table gains a "Dead" column** — how often that club left him with no play.
  It convicts a club far better than a fairway percentage does: most rough is playable and
  none of these are, which is the real driver-vs-mini question.
- **GIR% is unchanged.** A miss is a miss; the flag explains it, it does not erase it.
- **Scrambling is unchanged.** Every missed green stays in the up-and-down denominator —
  you scramble from where the ball is, not from where you meant to be.

Only Jack can set this: a missed fairway is *not* the same thing, since plenty of rough
leaves a clean look. Never infer it from `fw:false`. Rounds logged before this existed
carry no flag, so their misses all read as playable — backfill with `round-update` if he
tells you which holes.

### Out of bounds is a price, not a direction (Aug 19 2026)

`OB` is a `fmiss` / `gmiss` code, tapped on the **Fairway** and **Green** rows of the live
logger — a shot at the green goes out of bounds as readily as a tee shot does. It sits in
the miss maps with the directions because it is where the ball *finished*, which is what
those maps record, and it renders in the miss splits and on the round card like any other.

What it is **not** is a dispersion reading. Out of bounds is stroke and distance — one
penalty plus replaying the shot, **two strokes every time**, before there is a ball in
play — and "40% of your misses go OB" answers a penalty question, not an aim one. So every
place that asks *which way does the miss go* sorts through **`topDir()`**, which filters to
the real directions in **`DIRS`**. Add a new finish code and it must be added to `MISS_LAB`,
and to `DIRS` **only if it is genuinely a direction**.

Where OB then speaks for itself:

- Its own finding on Scores (`key:'ob'`) and on the round card, both stating the strokes
  rather than the count — the number that matters is `n × 2`.
- **An OB column in the off-the-tee club table**, beside Dead. A club that finds two thirds
  of fairways and goes out of bounds with the rest is not the club its percentage makes it
  look like, and that is the driver-vs-fairway-finder question stated in strokes.
- One OB pre-ticks *Off the tee* (or *Approach*) on the finish screen. Two strokes gone is
  not a marginal round.

GIR% and fairway% are unchanged — a miss is a miss, and the flag prices it rather than
erasing it. Same rule as `noshot`.

### Putting by distance (Aug 20 2026)

Three rows on the live logger, in Jack's own shape — the first version recorded only the
first putt and he rejected it, correctly:

1. **Putts** — the total, as before.
2. **Putt made** — how long the one he holed was, with **Given** as the seventh chip in
   the same row, because a hole ends either with a putt going in from somewhere or with
   nobody making him hit it.
3. **First putt** — where he started. **Only rendered once the total says two or more**:
   on a one-putt hole the first putt and the made putt are the same putt, and asking twice
   is asking him to tap one fact into two rows.

The pay-off is that a two-putt hole now records **one putt he missed and one he holed,
both with distances** — so the app has a real *make rate per putt struck* rather than a
count of holes. `puttAttempts()` is the reader: it yields the first putt as a miss and the
made putt as a make, and leaves a three-putt's middle putts out because nothing knows how
long they were. `puttFirstK()` / `puttMadeK()` derive the two distances and both tolerate
cards written before `pm` existed, so nothing needed migrating.

**The buckets are `PUTT_DIST` in `app.js`, and every boundary is a line this project
already draws** — that is what makes them worth counting rather than generic:

| Key | Range | Why that line |
|---|---|---|
| `t`   | ≤3 ft    | tap-in range. Splitting it out stops gimmes inflating the make rate, and a miss inside it is a real event |
| `s`   | 4–6 ft   | the scoring zone and **his** zone: the 5-ft test sits in the middle of it, the left miss is the whole putter saga, and `Short Putts — The Pop Stroke` covers exactly this range |
| `m`   | 7–12 ft  | the make-some window — birdie chances and par saves |
| `l`   | 13–20 ft | two-putt territory; a make is a bonus. First real pace test |
| `xl`  | 21–30 ft | lag proper — three-putt risk climbs steeply through here |
| `xxl` | 30+ ft   | the ladder distance, so the on-course number is directly comparable to the 30-ft grind |

Changing a `k` orphans every hole already logged with it, the same trap as
`MENTAL_TRIGGERS` — add a bucket rather than resplitting the existing ones.

`puttDistTable()` on Scores and on every round card carries **two questions on one axis,
counted over different things and labelled as such**: `att`/`made` are individual putts
struck from that range (the conversion rate), while `first`/`three` are HOLES that started
there (the pace question, which is only meaningful about a first putt). Don't merge those
columns — a make rate over holes is the thing this rebuild exists to stop computing.

Three findings inside `holeTips()` — `putt-short` (the 4–6 ft conversion, compared against
the latest 5-ft mat test, which is the first mat-vs-green comparison the project can make),
`putt-lag` (three-putt rate from 21 ft +, i.e. **the open distance-control fault with a
number on it at last**) and `putt-tap` (misses from inside three feet). Being in `holeTips`
with keys, they inherit live-round precedence.

Tapping 0 putts (chipped in) clears all three fields; dropping the total back to 1 clears
`pd` alone.

### Given putts (Aug 20 2026)

`h.gimme` means the LAST putt on the hole was conceded. It still counts — he scores it,
everyone does — but it was never struck, and that cuts two opposite ways, which is the
whole reason the flag exists rather than being folded into the putt count:

- **Given from the first putt** (`putts === 1`) — a make he never hit. It is simply not a
  putt attempt, so `puttAttempts()` yields nothing for it and it never reaches the make
  rate in either the numerator or the denominator. You cannot measure a putt that was not
  attempted. Film is king, applied to a scorecard.
- **Given after a lag** (`putts >= 2`) — the opposite. The first putt finished inside
  gimme range, which is the closest thing a scorecard can produce to a **proximity**
  measurement, and it is a straight read on the open distance-control fault. Counted as
  `lagIn` and reported next to the three-putt rate.

`conceded()` and `lagGiven()` in `app.js` are the two predicates, and `bagPutt()` counts
`gim` / `lagIn` from them alongside the attempt tallies. **Given and a made distance are
one slot** — tapping either clears the other, because the hole ended one way or the other.

### The hole's prep collapses (Aug 20 2026)

The prep card at the top of a live hole is a **tee-box read**; the scoring chips are a
between-shots one. Once he has played the hole, the plan is just pushing the chips down
the screen — so tapping its header folds it away (`live-intel` → `h.intelShut`, UI state
on `S.live` that never reaches the saved card).

**It starts collapsed** (Jack's call, Aug 20) and opens with a tap, per hole and not
sticky. That is only safe because **shut is not empty**: the header keeps the one line to
act on (`play`, else the prose note, else his record for the hole), so the default state
still delivers the decision and it is the reasoning under it that costs a tap. Never make
the collapsed state a bare header — the whole design rests on the gist being there.

### The hole screen redesigned (Aug 27 2026 — Jack's redesign)

The logging RULES did not change; how the screen says them did. What is worth knowing
before touching `livePlay()`:

- **The header is the identity of the screen** and the only part of it that is not a chip:
  a mono eyebrow `LIVE · COURSE · TEES`, `Hole N` in the display serif with `PAR n · SI n`
  beside it, a `Finish` button (`live-finish` — the same route the last hole's Next button
  takes, so the troubles still come pre-ticked off the card), the par picker and the Card
  link, the hole strip, and the footer line `THRU n · +n` with a **pulsing ● SAVED**.
- **The pulse is the save receipt.** Every tap writes `S.live` to localStorage before the
  screen redraws, and this is the only thing on the phone that says so. Don't make it a
  static label — a static label reads as decoration.
- **The hole strip is 18 bars**, always visible, tappable to jump (the old fold-away
  numbered strip and its `holesOpen` flag are gone). Solid = here; 72% = played at or under
  par; 40% = played over; 16% = unplayed; a burgundy inset marks a hole he wrote a note on.
  Eighteen targets across one phone cannot each be 44px wide — no arrangement of them can —
  so the strip is a **shortcut** with a 30px hit area and the 52px footer Back / Next
  buttons stay the primary way between holes. Jumping is a `render()` (a navigation); every
  chip tap is still a `rerender()`.
- **One section per question, and a section exists only once it can be answered.** `qRows()`
  is the single source of that order for BOTH layouts. The addition on Aug 27 is the
  **fairway, which now waits for a tee club** — where the ball finished is not a question
  until there is a shot to ask it about — and the tee section carries the line saying so, so
  the row can never look like something the app forgot to show. On a par 3 the green section
  reads **“Green · from the tee”**.
- **Chips light in one of two accents: green for a neutral or good outcome, burgundy for
  everything that costs strokes** — OB, a penalty, a green the drive took away, a conceded
  putt, and every miss direction (`bad` is the class that says which). The colour is a
  property of the ANSWER, not of the row. A suggested-but-unconfirmed tee club is still
  half-lit, now in the green accent, with `LAST TIME: <club>` in the section header — that
  distinction is what the whole driver-vs-mini comparison rests on, so never fill it solid.
- **Motion has two jobs and no more**: a section that has just appeared rises 10px over
  .26s, and arriving at a hole slides the whole card in from the right over .3s. Which
  sections were on screen last draw lives in the module variables `lvHoleSeen` / `lvSeen` —
  **not** on `S.live`, because nothing about an animation belongs in the round.
- **The logger still gets NO `fold()` sections.** It already hides what cannot exist yet;
  the hole-prep card's own collapse (above) is the one disclosure control on the screen.

### A note on any hole (Aug 19 2026)

Jack asked to be able to write a note on **any hole**, the way he already could at the end
of a round. The live logger's Note row does it: one chip (`＋ Add a note`) that opens a
textarea, saved to `h.note` on **every keystroke** — same reason every chip tap saves, iOS
kills suspended PWAs — plus `syncHoleNote()` on every way off the hole. `noteOpen` is UI
state on `S.live` and never reaches the card.

Two things this preserves. **The logger stays thumbs-only by default**: the keyboard is
opt-in, one tap away, never in the way of the chips. And **the textarea is 16px** like every
other form control — see the iOS auto-zoom rule below; do not shrink it.

A noted hole is marked with a dot on the jump strip and a ✎ on the scorecard, and the notes
themselves render as their own block — on the finish screen before he saves (so he can go
back and edit any of them) and on the round card afterwards. **This is the only part of a
card that remembers *why*; everything else records *what*** — so it is worth reading before
the analytics when a round is being discussed. Feed entries can carry a hole `note` too, via
`round` or `round-update`'s per-hole merge.

**Notes are CARRIED, never PARSED (standing rule, Aug 20 2026).** A note is free text, so
nothing in the app scans it for keywords — no note ever produces a finding, changes a number,
pre-ticks a trouble, or matches a lesson, and none ever should. That road is inference wearing
a measurement's badge, which is precisely what `EV_RANK` and *film is king* exist to stop.
The countable version of "why" already exists and is deliberately a **fixed vocabulary**:
`TROUBLES` on the finish screen and `MENTAL_TRIGGERS` on a debrief. Prose stays prose.

What a note gets instead is **delivery** — it is handed back wherever it answers something
the numbers can't, joined on the hole it was written about:

- **`holeRecord()` carries `notes[]`**, so the live logger prints *Wrote* under *Last* on the
  hole card. Standing on the 7th tee he gets his own words from the last time he stood there.
  This is the highest-value one: it needs no memory and no scrolling.
- **`scoreStats()`'s `spots` carry `notes[]`**, so the worst-hole finding quotes what he wrote
  on those plays rather than leaving the number to speak alone. A round's blow-up list does
  the same per hole.
- **Scores ends with *What you wrote on the course*** — every hole note across every card,
  newest first, tappable through to its round. Before this a note was only visible inside the
  one card it was written on, which made the field that records *why* the hardest thing on the
  page to find.

So a new place for notes is a **join**, not a scan: find the holes a finding is already built
on and quote them. Anything injecting note text into a tip `b`/`h` must `esc()` it — those
fields render as raw HTML.

### The prep loop, closed (Aug 20 2026)

The per-hole plan notes had the same problem one rung up, and worse: they were the biggest
**write-only** file in the app. They travelled one way — onto the tee, via `briefHole()` —
and nothing ever came back to ask whether the call was taken or whether it worked. The
record fed the plan (`holeRecord()` prints his history on the hole card); the plan never fed
the record. `courseShape()` was the only thing that read a plan's prose at all, and only to
describe the course on the cheat sheet.

**`planHeld(r)`** joins a played card to the plan covering that course and renders *How the
plan held up* at the bottom of the round card: per hole, what the plan called, what he hit,
where both shots finished, what it scored. Three rules hold it honest:

- **It counts the fields, never the prose.** Only `club` and `avoidDir`/`avoidOn` (above)
  feed the two rates — took-the-call, and did-the-warned-miss-happen. The plan's words are
  quoted beside the result, which needs no interpretation. Same rule as a hole note:
  **carried, not parsed.**
- **A plan only marks a round it PREDATES**, by its feed-id date vs. the round's. The
  Sterling Farms standing plan was written Aug 12 largely from the Aug 12 card, so that
  card renders as *what it was built on*, not as a test of it. Grading a plan against the
  round it was derived from is marking your own homework, and the block says which it is.
- **No Coach tip fires off it.** One round is not a sample, and "the plan held" is exactly
  the sort of claim that would harden into folklore. It stays descriptive on the card until
  there are repeat rounds at a planned course to compute over.

Consequence for writing plans: a hole note with no `club` and no `avoidDir` is unmarkable
forever. Fill them in wherever the call genuinely names one — and leave them off where it
doesn't, because a padded field is a false record, not a fuller one.

### Hole data outranks a stats snapshot

An extension of *film is king* to the numbers: a hole Jack recorded himself is **measured**,
a pasted GHIN average is **summarized**, a feel is **feel**. This works two ways:

1. **Ranking.** Every tip carries an `ev` provenance — `live` (cards he logged in the live
   logger, on the hole) → `round` (any other hole-by-hole card) → `measured` (5-ft tests,
   filmed faults) → `snapshot` (pasted GHIN summaries)
   → `self` (his own post-round debrief, the Mental tab's only witness for what a card
   can't see), ranked by `EV_RANK` and badged in the UI by `evTag()`. Coach sorts severity first, then
   evidence, so the warnings still lead but his own rounds speak before a season average
   somebody else computed. **Any new tip must carry an `ev`** or it sorts as a snapshot.
2. **Suppression.** Once the hole-logged sample is real (36+ recorded greens or putting
   holes), `statTips()` stands its snapshot versions of the approach-miss and three-putt
   findings down and the live ones speak instead — see its `live` argument.

Don't reintroduce a snapshot claim the hole data now answers better; do keep saying which
one a number came from.

### Live rounds take precedence over everything (standing instruction, Aug 19 2026)

Jack's words: *"I've started adding the live rounds to the app — make sure those take
precedence for everything. That's the best info we have right now to go off of."* A card
logged in the live logger was recorded **on the hole, between shots, with the bag he is
playing today**. Nothing sits between the shot and the record. Every other card — typed up
afterwards, fed in from a GHIN summary — is the same shape of data one remove further
away. So `live:true` is not a decoration; it is the top of the evidence stack, and four
things enforce it:

- **`EV_RANK` puts `live` above `round`**, so live findings lead every ranked list (Scores,
  Coach, Mental) and wear the strongest badge.
- **`scoreTips()` computes from the live cards ALONE wherever they can carry a finding.**
  `holeTips(st, EV)` makes every hole-derived finding out of whatever set of cards it is
  handed, and each one carries a stable **`key`**. `scoreTips()` runs it twice — once over
  the live cards, once over all of them — and the live version of a finding **replaces**
  the all-cards version rather than sitting beside it. Where the live sample can't clear a
  finding's own gate yet, the full sample still speaks and the badge says `from your rounds`,
  so preferring the better evidence can never *lose* a finding: the worst case is the answer
  he already had. **A new hole-derived finding must be added inside `holeTips()` with a
  `key`**, or it will render twice once he has a live sample.
- **The GHIN claims stand down at a live-only bar.** `statTips()`'s approach-miss and
  three-putt findings retire at 36 recorded holes as before, *or* at **14 live-logged ones**
  — most of one round he tapped in himself. Only suppress a snapshot claim the live version
  genuinely answers: the blow-up claim fires at 15% while its live twin needs a 25% share of
  strokes lost, so standing that one down would delete a finding rather than replace it.
- **A feed entry never overwrites a live card.** See `round-update` above: on `live:true` it
  fills gaps only, unless the entry says `"force": true`.

Two more places live wins, both in `app.js`: `newestLiveFirst` sorts the logger's par /
stroke-index / tee-club prefill so a live card beats a fed one of the same date, and the
Scores round list badges every live card so it is obvious at a glance which data is which.

The honesty guard that makes all of this safe: **`evOf()` claims `live` only when the live
cards really do carry the sample** — a round's worth, and at least half of what was counted.
A badge saying "you logged this live" over a number mostly made of fed-in rounds is exactly
the laundering the evidence ranks exist to prevent.

### The Mental tab (off-course, added Aug 13 2026)

Jack asked for it in these words: he struggles to stay locked in for a full round, slow
play and random partners set him off, he gets to a lead or a good position and doesn't
close, and he lets himself get angry or distracted. **He asked for an OFF-COURSE tool** —
so nothing on this page is meant to be tapped mid-round, and the live logger was
deliberately left untouched. The deciding happens here; the course is execution only.

Four moving parts, all in `app.js`:

- **`mentalStats()`** reads `withHoles()` and computes, over cards of 6+ holes: the
  **reset test** (the hole *after* a bogey-or-worse, and after a double-or-worse, each
  against his own average hole), the **closing three** vs. everything before them, the
  same closing three restricted to rounds that were *going well* when he got there, the
  round in **thirds**, and the blow-up share. Nothing here needs new logging — it is the
  hole arrays he already has, asked a different question.
- **`mentalTips()`** turns those into `{ev, s, src, h, b}` tips on the usual contract:
  sample gates, the triggering number in the copy, and — the important part — **a finding
  that comes out GOOD still fires**. As of Aug 13 the cards do *not* show an anger tax or
  a closing fade (+0.62 after a dropped shot vs +0.83 overall; +0.67 closing vs +0.89
  before), while doubles are 50% of everything lost. Telling him that is the point of the
  page; do not quietly drop a "we can't find what you described" card. Tips carrying
  `coach:false` stay on this tab instead of also going to Coach, for findings Coach
  already states from the scoring side.
- **`MENTAL_TRIGGERS`** — a fixed eight-trigger vocabulary in his own words, each with an
  **if-then** response. Fixed so it can be *counted*; the whole value is turning "stupid
  stuff got me" into a tally across rounds. Editing a trigger's `k` orphans past debriefs.
- **`S.mental`** — post-round debriefs, `{id, date, round:{course,date,nine}|null,
  focus:1–5|null, triggers:[], when:[], note, next}`. Self-report, so it ranks `self` —
  below every number on the page and still the only witness for match play, mood and
  pace-of-play, none of which appear on a scorecard. The newest `next` renders as the
  **"Next round · one job"** card at the top: one job, never a list.

  He usually types these himself, but he often just *tells* you about a round instead —
  push those with a **`debrief` feed entry**. Two rules when you do. **`round` needs
  `nine`** where the course has two cards on one date, or `debriefRound()` matches the
  wrong one. And **leave `focus` null unless he actually rated it** — "he sounded
  frustrated" is not a 2 out of 5, and inventing his self-report is the one thing this
  page cannot survive.

  A linked debrief renders the card underneath it (`debriefCard()`): the round's total and
  the thirds he flagged, against his average hole. That cross-reference is the point of
  linking at all — and at 3+ linked cards a trigger's rounds get compared to his baseline
  in `mentalTips()`, which is the only route by which a self-reported trigger becomes a
  measured cost. The selection stays his, so the tip stays `self`.

### Match play is the only witness for "I don't close"

A stroke-play card cannot see a match: Jack shot his best score of the Wianno week and won,
shot 41 twice and went halved / 1 down, and none of that is visible in strokes. So rounds
carry **`result`** (`W`/`L`/`T`), **`margin`** (holes, signed from his side) and **`matchNo`**,
set via `round-update`, and `matchStats()` reads them into the tab's Match play block.

Two rules learned from the Wianno backfill. **`matchNo` is not optional where an event
plays out of date order** — Jul 10 and Jul 11 were both played back nine first, so numbering
the table by date silently renames his own matches. And **"live at the finish" is the whole
point of the block**: only a halve or a one-hole margin can carry a closing story; a match
lost 2 down was decided by scoring, and saying otherwise invents a nerve problem out of a
bad round. Of five Wianno matches, two were live — and both were the ones he lost short
putts on, with the arc-suited Phantom 7.5 in the bag. That reframe (his closing problem is,
on his own record, a short-putt problem) is the most useful thing the tab has produced;
don't let a later edit quietly turn it back into a mental-toughness story.

**Mental plans are briefings with `"discipline": "mental"`.** That keys them to this tab
(`swing()` excludes them explicitly — the swing lab is the default home for any plan that
doesn't name a discipline, so a new discipline must be added to its exclusion list and to
`briefing()`'s back-link map). The standing plan is *Locked In — The Mental Round*.

Two honesty guards worth keeping: the sample is thin, and **every card is stroke play**,
so "got to a lead and didn't close" is untested rather than disproved — say so rather than
letting the closing number answer a match-play question.

**Worked examples (Aug 13 2026)** — Jack gave three, and they set the standard for how to
handle the rest. Two were checkable against cards he'd already logged, so they were checked
rather than just recorded: the match where an opponent got into his head cost **+6 over
holes 1–3** against +3 on each of the other four Wianno nines (partner disruption lands
EARLY, not at the finish), and the crumble he remembered was confirmed — bogey-double on
17 and 18 — but is **one card in six**, with every other round finishing its last two at
+0.50 a hole or better. Both readings are in the *Locked In* plan with their caveats: the
+6 card was also the coldest start of the event, so warm-up and partner are confounded on
it and neither is established. Two lessons for next time: **check a recounted example
against the card before writing it up** — it can invert the conclusion — and **ask which
card he means** when the date is ambiguous (Jul 10 had a front and a back; front finished
par-par, back finished bogey-double, and the answer changes the whole finding).

### Re-rendering must not move the page — or close what's open

`render()` resets scroll to the top — that's right for navigation. `rerender()` **preserves
the scroll position**, because redrawing the view you're already on is an update, not a
navigation. Every chip tap in the live logger re-renders, and jumping to the top each time
made scoring a hole mean scrolling back down six times. Use `rerender()` for in-place
changes and `render()` only when the user has actually gone somewhere (including moving to
the next hole, which is a navigation).

Same rule for **open `<details>`**: `render()` replaces the view's DOM, so a section he had
expanded snapped shut on every in-place update — which on the drill bench meant logging a
drill collapsed the drill he was reading. A `rerender()` now restores the open/closed state
of any `<details>` that carries an **`id`** — **both ways** as of Aug 27 2026, because a
section that defaults open (every `fold()`) would otherwise spring back open on the next
in-place update, so folding the scorecard away and then tapping anything else undid the
fold. A `render()` deliberately restores nothing. Give a section an `id` if it should
survive an update, and nothing else has to change. The DOM stays the only store for this —
never build a parallel open/closed map.

### The page paints under the notch, so every edge claims its own inset (Aug 30 2026)

`index.html` sets **`viewport-fit=cover`**, which is what lets the nav's background reach the
bottom of the screen — and it also means iOS stops reserving the status bar and home
indicator for you. Every top and bottom edge has to claim its own `env(safe-area-inset-*)`.
The bottom was accounted for from the start (`body` padding, the nav, the sheet, the cheat
bar); **the top never was**, so on the installed PWA the clock sat on top of the masthead
strapline for weeks. `.hero` — and `body.lvfocus .hero` — now pad by
`calc(20px + env(safe-area-inset-top))`. Add a new fixed or full-bleed edge and it needs the
same. Note these read as `0` in a desktop browser, so a local check can never catch this
one; it is only visible on the phone.

Two related mitigations shipped alongside, for a scrolling glitch Jack reported where the
page shows through past the tab bar. Neither is reproducible in desktop Chromium — the nav
is pinned at every scroll offset there — so both are standard iOS fixes applied on the
symptom, and they are **unconfirmed**: `overscroll-behavior-y:none` on `html`/`body` (the
rubber-band bounce drags fixed children with it on iOS and shows the page past its own end)
and `will-change:transform` + `backface-visibility:hidden` on `nav` (iOS repaints a fixed
child in step with the scroll rather than ahead of it, so a fast flick leaves the bar
lagging). If it recurs, the next thing to establish is **installed PWA vs Safari** — in
Safari the strip under the bar is Safari's own translucent toolbar with page content behind
it, which is expected behaviour and not this bug at all.

### Form controls never go below 16px (Aug 14 2026)

iOS Safari **auto-zooms the whole page** when you focus an `input`/`select`/`textarea` whose
computed `font-size` is under 16px, and it never zooms back out. The base rule in
`styles.css` was 14px, so starting a live round — where the first tap is the Course box —
zoomed the phone in and left it that way for all eighteen holes. The base is now **16px**;
don't lower it, and don't set a smaller inline `font-size` on the narrow numeric inputs
(carry ladder, gap matrix) either. The other "fix" for this — `maximum-scale=1` on the
viewport — is worse: it disables pinch-zoom everywhere in the app. Checked at 320px, the
narrowest phone: the tightest row (Tees · Rating · Slope) still fits at 16px.

### The numbers on Today (Aug 30 2026)

**Everything Today counts, under one heading**, in one block: a thin row of four stats —
**courses · handicap · scramble · up & down** — over four tiles in the order a hole is
played — **last score · off the tee · irons · putting** — and one paragraph under the lot.
They were three separate blocks with the start-round button between them until Jack asked
for one. Between the row and the tiles all four parts of the game are covered: the tiles
carry off-the-tee, irons and putting, and `up & down` is the short game.

**The block says WHICH CARDS it read, and that line is not decoration.** `areaCards()` flips
the whole sample from every card to the **live cards only** the moment 18 live holes exist,
so finishing one round he logged himself moves every number here at once — by design, and
correctly. Coach has always announced that; Today did not, and shipping these numbers without
it is exactly how Jack came to ask why they had all changed since the last update. **A number
that moves for a good reason still has to say what the reason was** — put the provenance line
on the block, not just on Coach, any time these numbers are rendered somewhere new.

**It is a READER, never a fifth tally.** Three tiles and both recovery stats come from
`gameAreas()` / `scoreStats()` / `shortGameStats()` through **`areaCards()`** — the card-set
choice extracted out of `coach()` so Today and Coach cannot quote different percentages for
the same rounds. The **labels come from `AREA_LAB`** and the value line is formatted exactly
as Coach formats it: a tile saying "Greens hit" over the figure Coach calls "Irons" is how
one number quietly becomes two.

**`scramble` and `up & down` are a pair, and the paragraph says so because the words do not.**
Jack's definitions, in his words: *"up and down is near green, scramble is errant drive safe
percentage."* One question asked about two different mistakes — did he save the hole from off
the **fairway**, and from off the **green**. His `scramble` is **not** the standard golf usage
(which is up-and-down), which is exactly why the line under the block spells both out rather
than trusting the labels to carry it. Each counts where its own hole tally already lives —
`scoreStats()`'s `fw` and `shortGameStats()` — as the same pair with the same meaning:
`saved` = par or better, `bogey` = par or bogey, **nested** so the two can never drift apart.
Never in a second pass: a scramble rate that disagreed with the fairway percentage beside it
would be worse than not having one.

**A tile may carry a SECOND, smaller number (`.stat .sv`) that qualifies its headline one.**
That is Jack's fix for the two-handicaps problem and it generalises: `handicap` and
`est. index` are two readings of one thing, and as equal tiles they read as a contradiction
rather than as a figure and the app's own estimate of it. **Subordinating one says which is
which in a way no amount of prose underneath can** — the first attempt put the index in the
paragraph below and he sent it back: he meant a smaller number in the same card. So a
qualifying number goes in the tile, small and mono; the paragraph below is for what a number
MEANS, never for more numbers.

Both recovery tiles carry one (`63% bogey`, `75% up & 2`), and that pairing earned its place
immediately: up & down reads `0/12`, which looks like nothing is ever saved, while the tier
under it says 9 of those 12 still came in at bogey — three got worse, and that is the real
damage. **A headline with no tier under it can be true and still leave the wrong impression.**

**A `.stat` may be a link** (`.stat.opens` + `data-action="go"`) — Courses opens the course
list. It stays a `div` rather than a `button` because it sits in a grid beside stats that are
not tappable and has to line up with them exactly.

What the three retired tiles were is worth keeping, because each was live for weeks before
anyone looked and each failed differently:

- **5-ft makes** read `— · needs 2+ entries`. A mat test he has run once, so the tile leading
  the page had never once shown a number. A tile whose empty state is its normal state is
  worse than no tile. It was in the stat row **as well**, blank there too — when you retire a
  dead metric, grep for it: the same number is usually rendered twice.
- **Carry ladder** was a *fact about the bag*, not a result — the top of the ladder does not
  move between rounds, and it already lives on Bag.
- **Conditions** was the weather card immediately above it, restated and smaller. Jack caught
  it the moment the swap put the two adjacent, which is the transferable lesson: **a
  duplicate is invisible until the two copies are next to each other.** When you move a
  block, check what it now sits beside.

A tile with no data renders a dash and says what would fill it — never a zero and never a
hidden tile, the same reason `sortCourses()` puts nulls last: absent and zero are different
claims.

**THE BANDS EVERY TILE HAS GO FIRST AND ADJACENT; THE OPTIONAL ONE GOES LAST.** Both grids
follow it — `.stat` is value · label · `.sv`, `.charttile` is label · value · `.sub` ·
`.trend` — each a flex column with only the LAST, optional band pushed down by
`margin-top:auto`. Putting the universal bands adjacent aligns them by construction, and it
survives a label wrapping to two lines.

Both halves of this were learned by getting them wrong, an hour apart, and both are worth
keeping:

- **Stacking and hoping.** Courses has no `.sv`, so its label sat a whole band higher than
  its neighbours' and the row read as four cards at three heights. Round Scores' caption sat
  34px below Off the tee's because only one of them carries a sparkline. **Mixing tiles with
  and without an optional row is the normal case, not the edge case.**
- **Bottom-aligning the wrong band.** The first fix pushed `.charttile .sub` down, which
  aligned the captions and opened a 57px hole *between the number and its caption* on every
  tile with no sparkline — Jack's words were "now off the tee is screwed up", and he was
  right. **Slack belongs at the card's bottom edge, where it reads as nothing; slack in the
  middle of a stack reads as broken.** Only ever give `margin-top:auto` to the last child.

At 320px the `.stat` labels give up tracking rather than wrap ("UP & DOWN" is the longest),
the same trade the nav makes at that width.

### Nearest first (Aug 21 2026)

Jack asked for the standing course plans to be ordered nearest to furthest, off the
location the app already asks for. Three pieces:

- **`S.here`** — his last position fix, `{lat, lon, ts}`, rounded to three decimals.
  `fetchWeather()` has always asked the phone for a position and thrown it away; it now
  calls `setHere()` on the way past, and `fetchHere()` asks for one on its own (the
  *Sort by distance* button) without pulling the weather down. **The sort is arithmetic on
  the phone** — nothing about where he is is sent anywhere for it, and that is worth
  keeping true.
- **`geo` feed entries** — a coordinate is a researched fact about the world, so it
  arrives the way a scorecard does and carries `place`, `src` and **`prec`**. `prec` is
  `exact` when it is the club's own coordinate and `town` when it is the town centre
  standing in for one; anything other than `exact` renders with a **`≈`**, because a
  placement is not a measurement.
- **`byDistance()` / `courseMiles()`** — great-circle miles, nulls last and stable, so a
  course with no coordinate on file **keeps its place at the bottom rather than
  disappearing**. `coursePlans().standing` is sorted, which means the live logger's course
  picker inherits the same order for free.

Two things the UI must keep saying: that the list is sorted and from when (`standingNote()`
prints the date of the fix), and that these are **straight-line miles, not drive time** —
an hour up the Merritt and an hour to the Cape are not the same hour. With no fix at all
the list renders in its original order with a button, never silently re-sorted.

**Every course on his list has a fix on file (Aug 21 2026)** — 49 of them, 12 on the club's
own coordinate and the rest on the town centre standing in for it. Add a course and add its
`geo` in the same push: a course with no location is not broken, but it can only ever sit at
the bottom of a distance sort, and the sort is the reason the coordinates exist.

### The rankings sort three ways (Aug 21 2026)

Jack asked for Courses to sort by rating, PR and distance. `COURSE_SORTS` / `sortCourses()` /
`courseSortNote()` do it, with the picked sort kept in `S.settings.courseSort`. Rating is the
default and what an empty setting falls back to.

The rules that make it safe to add a fourth:

- **Nulls go last, never to zero.** A course he hasn't rated is not a course he rated 0, and
  one with no PR on file is not one he shot nothing at. `sortCourses()` puts every null at
  the bottom whichever key is picked, so a sort is only ever a re-ordering — nothing drops
  off the page for want of a value.
- **Direction is per key**: rating counts DOWN from the best, a PR and a distance both count
  UP from the lowest.
- **`courseSortNote()` says which order the list is in**, and how many are sitting at the
  bottom for want of a value — the same rule `standingNote()` follows in Round Prep, and for
  the same reason: a list that silently re-ordered itself is worse than one that never did.
- **Distance degrades rather than failing.** With no `S.here` the list renders in its RATING
  order and the note says so, with a button that asks for a fix; picking *Nearest* with no fix
  calls `fetchHere(true)` there and then, so the chip is the request. Deny it and nothing
  moves.

### Two rows, one course (Aug 21 2026)

`course-add` only dedupes on an **exact** name match, so a batch import is how the list grows
a second row for a course he had already typed himself — caught the day his round history
landed, where he had *Mammoth Dunes* and the import added *Sand Valley Golf Resort — Mammoth
Dunes* beside it. So when you push courses in bulk:

- **His spelling wins where he already has the row.** There is no `course-update`, so a
  `course-add` for a course he already has under another name cannot patch it — it can only
  duplicate it. Remove the import's row and put the `geo` on HIS name instead.
- **`courseDupes()`** flags the pairs on the Courses page and does nothing else. It never
  merges and never deletes: the rating, PR and notes on those rows are his, and picking
  between two of his rows is not a heuristic's job. Two courses at one facility are written
  `Facility — Course` and are never flagged against each other.

### Writing briefings (they render in layers — write for that)

`briefing()` renders a plan as four layers, so depth is opt-in rather than a wall of text:

1. `focus` — the whole plan in a sentence or two. Always visible.
2. `rules[]` — the "If you read nothing else" chips. **Renders with or without `steps`**, so
   every plan should carry them.
3. `steps[]` — the numbered routine, if the plan has one.
4. `sections[]` — a collapsed accordion. Each shows its title plus one summary line and
   opens on tap; there's an Expand-all control.

**Give every section a `k`** — one plain sentence saying what that section *concludes*, not
what it's about ("Don't manufacture lean with your hands" beats "Two mechanisms sit under
this"). Without `k` the app falls back to the section's opening sentence, which is why old
briefings still read fine, but an authored `k` is much better. Bodies may use blank lines
for paragraph breaks — `prose()` honours them (a single `\n` does nothing).

Keep `h2`s few: the jump bar at the top of every view is built from them.

- **Round-prep briefing**: append a `briefing` entry (dated = one round; undated =
  standing plan, singleton per course/title).

### The labs live behind one nav button (Aug 13 2026)

The bar was at eight tabs and a short-game lab would have made nine, so **Swing · Short Game ·
Putting · Mental now sit behind a single `Game` tab** (`game()` — the hub). `NAV_OF` in
`render()` maps every lab view back to the `game` button so it stays lit. Adding a fifth lab
costs nothing in the nav.

**Three changes on Aug 30 2026, all Jack's, and one principle under all of them: what you
came for goes above what it was derived from.**

1. **On the hub, the "Open the ⟨lab⟩ lab" row sits directly under the four tiles**, not at
   the bottom of the page. It was below a diagnosis that runs several screens on any lab
   with faults open, so picking a lab and entering it were separated by everything the hub
   had to say about it. The diagnosis is what you read INSTEAD of going in, not something to
   scroll past on the way. The selected tile is still a second door (it reads `OPEN LAB ›`),
   which is why the row can be plain rather than shouting.

2. **A lab page reads: which lab · the cheat sheet · the routine · the plans · the
   diagnosis · the film · the rest.** The plans used to sit UNDER the diagnosis, so reaching
   a workshop log meant scrolling past every open fault and everything each was read off.
   Mental already read this way and was left alone.

3. **Every lab page carries a `labBar()` across the top** — a `.segbar.labs` of all four, so
   Putting → Short Game is one tap instead of a trip back through the hub. It has the same
   relationship to the jump bar that the Rounds segmented control does (which lab, then
   where inside it), which is why `buildJumpBar()` places itself after a `.segbar` and the
   order can't invert. FIXED `LABS` order, like the hub and for the same reason. The lab you
   are in is inert rather than a link: a state, not a destination. It maps over `LABS`, so a
   fifth lab joins the bar with nothing to add.

**The hub order is FIXED and must stay that way** (standing instruction, Aug 14 2026): Swing ·
Short Game · Putting · Mental, top down — i.e. `LABS` order. It used to float the last-opened
lab into a "Pick up where you were" block at the top (`S.settings.lastLab`, now removed); Jack
asked for the fixed order instead, because a row that moves defeats the muscle memory that
makes a hub worth having. Don't reintroduce recency sorting here, and add a new lab to the END
of `LABS` rather than reordering it. **The hub is the four labs and nothing else** since
Aug 27 2026 — Round Prep used to sit under them and now lives in Rounds (see below).

### The nav is five tabs and a tee button (Aug 27 2026 — Jack's redesign)

Jack commissioned a redesign; this supersedes the six-tab bar described above. The nav is
**TODAY · BAG · [TEE] · GAME · ROUNDS · COACH** — five tabs and a burgundy centre button.

- **TEE** goes to the live logger from any screen (`data-view="live"`). It is both *start* and
  *resume*, because from the player's side that is one intention and `live()` already knows
  which it is; `render()` relabels it `RESUME` while `S.live` exists. It is the only thing in
  the app that has to be one thumb away everywhere, which is why it gets the middle.
- **Courses is no longer a tab** and **Round Prep is no longer in the Game hub.** Both are
  segments of **Rounds**, whose three faces are `Cards · Round prep · Courses` — a card, the
  plan written for it, and the course it was played on are three views of one subject, and
  the plan now sits beside the cards it gets judged against (`planHeld()`).
- The segment lives in `roundsSeg`, a **module variable, never saved** — it is a property of
  the view, not of the player. Switching is a `rerender()` (you have not gone anywhere), so
  `current.arg` moves with it.
- **The old view names still work and must keep working.** `SEG_OF` in `render()` resolves
  `scores` → Cards, `preps` → Round prep, `courses` → Courses before anything else happens, so
  every `go('courses')` link, every `render('scores')` in an action, and every `act:go('preps')`
  already sitting in a user's saved `S.updates` still lands where it meant to. Those stored
  update rows are why the aliases are permanent, not a migration step. A link may also carry
  `data-seg` to ask for a face directly (`data-view="rounds" data-seg="prep"`).
- `NAV_OF` maps `round` (a round card) to the Rounds button as well as the four labs to Game,
  and `landed` — the full What's-landed log, which hangs off Today — back to the Today button.

The tab glyphs are **CSS shapes** — a 19px bordered box, round or square, filled when active.
No SVG, no icon font, no emoji: nothing to load, and legible at label size.

**Every lab shares one diagnosis renderer.** `diagnosisCard(discipline)` draws open faults with
their detail and collapses settled ones to a line; `faultState()` reads the first word of a
fault's `why`. So a new lab gets a real diagnosis for free, and closing a fault in the feed
removes it from both the lab and Coach's to-do list with no second place to edit.

A new discipline needs four things: an entry in `LABS`, a view in the `render()` map and
`TITLES`, exclusion from `swing()`'s catch-all plan filter, and a row in `briefing()`'s `LAB`
back-link map (plus `SESSION_LAB` if it will have film).

### Where a new thing goes (standing instruction, Aug 13 2026)

Jack's rule, in his words: as new stuff comes up we are **either expanding the plans we
have, or creating a new one if it's a new issue**. Nothing lands loose. Route it:

| What arrived | Where it goes |
|---|---|
| Changes what he DOES in a situation that already has a plan | **Expand that plan.** New section, or edit the section that owns it |
| A genuinely new situation or skill | **New plan**, named for the situation |
| A question worked through — research, a claim checked, a decision reached | **A workshop-log section**, whatever else it also does |
| A **training** — drills, reps, at-home work | **A lesson in Coach**, not a plan. See below |
| Contradicts something in another plan | **Fix both.** Never leave two live sources for one instruction |

**Trainings live in Coach, not in a lab** (standing instruction, Aug 13 2026). Plans say what
to do on the course; the Coach library trains it. A lesson in `lessons.js` already has a
`drill` field, tag-matching to logged struggles, and the streak button — which is exactly
what a training needs, and what a plan gives it none of. Add one to `lessons.js` as
`{id, shelf, title, min, tags[], body, drill}`; the file declares a top-level `const LESSONS`
(not `window.LESSONS`) and shelves are created just by naming one. Two hard rules: **`id`
must be unique across the whole file** (`S.lessonsRead` keys off it, so a collision marks the
wrong lesson read — the swing shelf uses `sw*` because `m*` was already Mental Game), and
**`tags` must come from the struggle vocabulary** at the top of `lessons.js` or the lesson
never surfaces for anyone. `body`/`drill` are escaped on render, so plain text only.

**Drills have exactly ONE home: the bench in Coach** (standing instruction, Aug 14 2026).
Jack's rule — drills are not to appear anywhere else in the app. `drills()` (Coach → *the
drill bench*) lists **every lesson's `drill`**, sorted by the kit he owns and the place he's
standing, so a drill exists in the library and on the bench and nowhere else. The labs
diagnose, plans say what to do on the course, Coach trains — and a lab that grows its own
drill section is how one went on prescribing a tempo fix for a fault that closed on film in
July. What that means for writing:

- **A new lesson should carry `where` and `kit`** in its `lesson-add` object. `where` is one
  of `home` · `green` · `range` · `bunker` · `course`; `kit` is keys from **`KIT`** in
  `app.js` (`putter` `airbreak` `phone` `laser` `m201` `coins` `ruler` `metro` `powder`
  `mirror` `sticks`). Baseline lessons are mapped in **`DRILL_KIT`** instead, which is presentation
  metadata and so lives in `app.js` rather than in frozen `lessons.js`. A lesson in neither
  reads as "anywhere, nothing needed" and shows under every filter, so it can never fall off
  the page for want of a table row.
- **`S.kit` is a claim about the world, so nothing infers it.** It seeds to only what the
  record proves and he taps the rest. A drill needing unmarked kit is **never hidden** — it
  drops to a *Needs kit you haven't marked* group with the missing item named, because a
  silently shortened list reads as "that's everything".
- **`struggles()` returns OPEN faults only** (fixed Aug 14). A `CLOSED` fault already drops
  off the diagnosis card and Coach's to-dos; it used to go on matching lessons anyway, which
  is how the bench opened flagging a tempo drill FOR YOU under the words "CLOSED Jul 30 ✓".
- The *For you right now* group is **capped at six**, filmed faults first, then whatever has
  gone longest unrun, and the ones that don't make the cut keep their badge in the group
  below rather than vanishing.

### Coach's shape is fixed: focus, then the bench, then the library (Aug 24 2026)

Jack's instruction, in his words: *"move the drill bench and the library to top of coach tab.
Only thing above it should be a high level coaching of where the coach thinks I am/should be
focusing on at that time based on the recent info we have."* The order is now **Where your
game is → Drills → The library → Keep the streak → Everything else on the board · ranked →
Next actions → Score history.** Before this the bench was the sixth block and the library the
last, under a to-do list and a link to Scores — the two pages Coach exists to reach were the
two furthest from the top. Don't push anything above the focus card.

**The four areas (Aug 24 2026).** Jack's instruction: the top of Coach reads high level
across **off the tee · irons · short game · putting**, off the live round data. `gameAreas()`
is a READER over `scoreStats()` and `shortGameStats()` — both now take an optional card set —
rather than a fourth place that counts holes for itself. Two numbers disagreeing about the
same round would be worse than no numbers, so never compute a fifth tally here.

- **Live cards alone, once they can carry it.** At 18+ live holes the older cards stand down
  and the header counts them out. This deliberately skips `evOf()`'s at-least-half clause:
  that rule stops a number computed from MIXED cards wearing a live badge, and computing
  live-only removes the mixture, so the badge is earned by construction.
- **No benchmark column** (Jack's call). The only snapshot carrying fairway/GIR/scrambling
  detail is a 47-round archive from an old tracking app; a years-old baseline dressed up as a
  target is worse than the bare number. Bring the comparison back when there are enough live
  rounds to compare against each other — and **only one tile is ever coloured**, the focus
  area's, because with nothing to measure against, a red tile is a verdict the page can't
  support.
- **The putting headline switches itself.** Putts-a-hole until `PUTT_HEADLINE_MIN` (10) putts
  carry a distance, then the **4–6 ft make rate** — the range the putter saga lives in and the
  only number directly comparable to the mat test.
- **`AREA_OF`** maps a ranked finding to its tile, and admits gaps the way `FOCUS_TAG` does:
  a finding about doubles or the opening hole belongs to no single area and highlights none.

**`coachHero()` is a renderer, not a new source of truth.** It states no claim the page below
doesn't already make: the focus is whatever `coachSignals()` ranked first, carrying its own
`ev` badge, so the strongest evidence still leads and the top of the page cannot quietly
outrank the rest of it. Three parts, in the order a coach says them:

1. **Where you are** — the old *read* line, plus **`coachSince()`**: which cards it was read
   off and how recent they are. "Based on the recent info we have" only means something if
   the page says *which* info — a focus built on a three-week-old card is a different thing
   from one built on Saturday's round.
2. **The focus** — ONE finding, never a list. `coachFocus()` takes the first warning, else the
   first mid. The rest stay in the ranked block further down, which now **excludes** the
   focus rather than repeating it.
3. **The work** — the drills that train *that* finding, via `focusTag()`.

**`FOCUS_TAG` is a written-down join, and it must stay honest.** A finding computed off
scorecards and a drill that trains it are two vocabularies; only add an entry where the drill
really does train the thing the finding names. A finding with no entry is normal and fine —
"your opening hole runs +1.4" is a routine problem, and the plan it already links to is the
right answer. Where there's no tag the card says so plainly and claims nothing. The first
version of this shipped as *"40 drills matched to this"* when 40 was simply every matched
drill on the bench; a wrong join reads exactly like a right one, which is the whole reason
this table is explicit rather than inferred.

### The practice record — read is not done (Aug 24 2026)

`S.drillDays` records only *that* something was practised on a date, which is enough for the
streak and nothing else. **`S.drillLog`** — `{id, date, v}` — records **which** drill and what
it scored, and it is what makes the pass marks worth writing:

- **`v` is the result exactly as he typed it** (`"7/10"`, `"18"`), and it is **optional**: a
  drill run on a night he didn't count is still worth recording, and a required number just
  teaches him to skip the button. `drillNum()` pulls a leading number out for the trend line
  and gives up quietly when there isn't one, so no drill has to be forced onto one scale. The
  trend needs **three** results before it draws — two points are a line through anything.
- **`due` replaced "unread" as the shortlist gate.** The *For you right now* group used to
  filter on `!S.lessonsRead.includes(id)`, so tapping *"why this drill exists"* — the one tap
  the card invites — quietly dropped the drill off the shortlist. **Reading a lesson is not
  doing its drill.** A drill now leaves the shortlist when it is LOGGED and returns after
  **`STALE_DAYS`** (10). `lessonsRead` still does what it should: the library's *read ✓*.
- **Logging keeps the streak too.** One tap, both records — making him tap twice for one
  session is how a log stops being kept.

### The labs and the bench are joined (Aug 24 2026)

Jack's rule: *"the whole app should be connected working in unison."* The labs diagnose and
Coach trains, so the join is a **pointer, never a drill rendered in a lab** — the one-home
rule above is unchanged.

- **`faultDrillRow(tag)`** puts a line under every open fault on a `diagnosisCard`: how many
  drills train it, how many are due, opening the bench filtered to that fault. The filter is
  a module variable (`drillTag`), NOT a saved setting — it is a question asked once, and a
  filter still quietly on next week would make the bench lie about what is due. `render()`
  clears it on the way to any other view.
- **The coverage guard is the part that matters going forward.** Where a fault matches no
  lesson, the card says *"No drill trains this yet"* out loud. An open fault with nothing
  training it is a real gap in the library, and a silent one is how a diagnosis goes on being
  restated for weeks with no work attached — same principle as the evolution grid's row of
  question marks. **So when you push a `faults` entry, check its tag reaches a drill**, and
  if it doesn't, either tag the lessons that train it or write the lesson. The lab will
  otherwise say so on Jack's phone, which is the point.
- **A fault also needs a row in `FAULT_EV`** (`app.js`, Aug 27 2026) to render an evidence
  tier and a tappable "what this was read off" panel. A fault object is only `{tag, why}`,
  so the tier has to be written down rather than inferred from the prose — a `why` saying
  "filmed Jul 26" and one saying "the film could not settle it" are the same keywords and
  opposite claims. Each entry is `[tier, sample]` and both come from what that fault's own
  text says its basis is. **A tag with no entry is fine**: the row renders with no rail and
  no chip and claims nothing, which is the honest failure mode.
- **The join key is the lesson's `tags`.** Fault tags and round-trouble tags share that one
  field, which is why a `faults` push and a `lesson-update` are often the same job. The
  Aug 24 audit found three open faults reaching **zero** drills — `delivery-unverified`,
  `up-and-down`, and `across-the-line-top`, whose own drill (`sw6`, *Kill the across-the-line
  top*) was not tagged with it. Thirteen lessons were re-tagged; nothing else changed.
- **`lesson-update` is an `Object.assign`, so `tags` REPLACES the array.** Always send the
  full list, existing tags included.

**`lessons.js` is a FROZEN BASELINE — same rule as `seed()`** (standing instruction, Aug 13
2026). Do NOT edit a lesson in place: append a `lesson-update` / `lesson-add` /
`lesson-remove` entry instead. `lessons()` in `app.js` merges the baseline with those edits
and **nothing reads `LESSONS` directly**, so a lesson change gets the same dated,
append-only trail a plan change does. This exists because editing the file overwrites the
text on Jack's phone with no history — which is how two lessons stayed stale for three weeks,
one of them still naming a putter returned Jul 20. Only touch `lessons.js` itself to seed a
genuinely new baseline shelf, and bump `CACHE` in `sw.js` when you do, since it is a cached
shell asset rather than feed data.

Standing plans are sliced by **situation, not by topic** — that's what Jack asked for and
what the putting lab now models: `Grip & Posture — The Setup` (before the putter moves) ·
`Putting Routine — Locked` (the order you do it in) · `Short Putts — The Pop Stroke`
(inside ~6 ft) · `Lag Putts — The Distance Grind` (past ~6 ft) · `Putting — The Workshop
Log`. Swing has `Swing — The Workshop Log` alongside its doing-plans. A new plan should be
answerable to "which situation is this for?"

Two rules that fall out of it, both learned the hard way on Aug 13:

- **The doing-plans stay short; the log absorbs the reasoning.** A workshop section carries
  the same skeleton every time — the question, what checked out, what did not, what changed
  in the other plans, what is still unmeasured, and the sources. The unmeasured line is not
  optional. Plans that tell him what to do get the conclusion and the guards, not the
  derivation.
- **A log is a record, so don't rewrite what it concluded.** When a later decision overtakes
  a workshop, append a `SINCE UPDATED` line to that section rather than editing its finding.
  Editing the conclusion to match what happened afterwards is how a log stops being worth
  keeping.

Merging plans is a `briefing` for the survivor plus a `briefing-remove` for each one folded
in — and **read a plan before folding it**, so its content is carried rather than summarised
from memory. The same trap catches SECTION rewrites, which feel safe and are not: folding two
sections into one by writing a fresh body drops whatever wasn't in your head at the time.
Caught on Aug 13 — merging two claw sections silently lost the distance-feel-for-line-control
trade, the "quiet hands and claw are the same instruction" framing, and the claw-vs-conventional
A/B. **After any merge, grep the survivor for distinctive phrases from the original** (case-
insensitively — a phrase re-typed in CAPS reads as missing) and restore what dropped. Prefer
concatenating bodies over rewriting them when the content is still live instruction. Retitling a plan is the same two entries, because the singleton key is `course`:
a new title creates a second plan unless the old id is explicitly removed. Before retiring a
plan, move any live action it owns into a plan that survives.

**Two plan titles are hardwired in `app.js` — do not rename them.** `positions` finds its
detail plan with `/Swing Positions/i` against `course`, and `isRoutine()` / `planIdBy()`
match `/routine/i`, which is what floats a routine plan to the top of its lab and links the
Coach tips to it. Also grep for a plan's name before retiring it: the Round Prep empty-state
copy names the swing plans literally, and it had to be updated when Miracle 201 moved to
Coach — and again on Aug 14 when *Golf Mind* was renamed.

**A plan with no `discipline` lands in the SWING lab, so always set one** (Aug 14 2026).
The catch-all is a convenience that quietly became a dumping ground: an audit found the
*Sterling Farms* course plan and *Golf Mind* both rendering as swing plans. Two fixes, and
both matter going forward:

- `swing()` now also excludes any plan whose `course` matches a **known course** — a course
  plan has no discipline *by design* and belongs to Round Prep, so it must never need one.
- *Golf Mind* was never a mental plan despite the name — it is Jack's club-by-club swing
  thoughts (driver / 5-wood / irons / wedges). Renamed **Swing Thoughts — Club by Club**
  and tagged `full-swing`. **Check a plan's TITLE against its CONTENT**: once the Mental lab
  existed, "Golf Mind" read as a mental plan and pointed at the wrong lab.

**A drill that names retired gear is the same bug as a stale lesson body.** `e1`'s drill was
still sending Jack to a demo with a putter returned Jul 20 — invisible while drills were
buried inside lessons, obvious the moment the drill bench listed them all. When gear changes,
grep the lesson library's `drill` fields too, not just the bodies.

### Forward plans only (standing instruction, Aug 10 2026)

Main sections of a briefing say what Jack does **now** — no dwelling on old setups,
putters, retired rules, or how a section used to read. Condense all history into one
trailing **`Notes — the paper trail`** section per plan; a changed instruction gets a
line there, not a main section explaining what it replaced. "REWRITTEN", "reverts",
"the old rule was" are smells in a main section.

### Film is king (standing instruction, Aug 10 2026)

Jack's words are **feel**; the film is **real**. In tabs, plans and session copy, weight
measurement over self-report — and say which one you're using.

- **Authoritative from Jack:** intent and actions — what he's doing, changing, trying,
  or has decided ("the press is out", "trialling a claw", "the DF3i went back"). Nobody
  else can report those, and they are never overridden by film.
- **Subordinate to film:** claimed *positions* and *sensations* — how open the face is,
  where his hands sit, whether pace "felt dialled". Where film contradicts a feel, the
  film wins and the plan says so. Where there is **no** measurement, say that explicitly
  rather than repeating the feel as if it were established.
- Worked example, Aug 10: "hands over the ball" → corrected by Jack to "hands over the
  **head of the putter**". Those are different positions (forward lean vs vertical shaft),
  and the corrected one matches the Jul 30 stills exactly — a vertical shaft *is* hands
  ~1.35" behind the ball centre (half a ball, 0.84", plus ~0.5" from shaft axis to face
  on a riser-hosel blade). Prefer his wording, note that it agrees with the film.
- Counter-example to keep visible: "pace felt dialled" (Aug 1) un-benched a putter that
  was returned nine days later, and "barely open" still has no number on it.
- **Filming sessions — ONE entry per day** (standing instruction, Jul 30 2026): all clips Jack
  sends on the same day belong in a SINGLE `session` entry, however many angles or batches
  they arrive in. Don't create a second session because a new clip turns up hours later —
  `session-update` the day's entry and widen its `setup` to list every angle. If separate
  entries already exist for one day, fold them with `session-remove`.

- **Deleting film: preserve the numbers first** (standing instruction, Aug 14 2026). Jack
  cleared every putting session shot on a putter he no longer plays — the Phantom 7.5,
  Newport 2 and DF3i, eight sessions Jul 17–21, which also emptied Jul 18 entirely and
  settled the one-per-day backlog above. The rule that came out of it: **before removing a
  session, write what it MEASURED into the discipline's workshop log**, because the
  conclusions live in the faults, the evolution grid and the plans while the evidence lived
  only on the row being deleted — and a claim whose source was thrown away becomes folklore.
  The Aug 14 section of the *Putting — The Workshop Log* is the worked example; it carries
  the SBST confirmation (the basis of the whole zero-torque case, measured on the two ARC
  putters) and the 8/10 from four feet (Jul 20, DF3i — still the only scored putting
  benchmark in the project).
  Two kinds of session survive a gear clear-out on purpose: one with **no film** (the Aug 1
  Beekman entry is the "pace felt dialled" counter-example this project keeps visible), and
  a **mixed A/B** (Aug 10 is DF3i-vs-LINK, i.e. the comparison that decided the putter).
  **Consequence, since resolved:** the grid's old columns (`S1`–`S4`, `BL`) WERE those
  deleted sessions, so it briefly tracked nothing current. **Rebuilt Aug 14 on the LINK
  alone** — three columns, `Jul 30` · `Aug 10 pm` · `Aug 10 mat` — and the rebuild is the
  model for the next one. Three things it does that the old grid didn't:
  a column per **BATCH** rather than per day, since Aug 10's outdoor set could score pace
  but not direction and its mat set the reverse; a `—` that means *this batch couldn't
  answer this row*, stated in the legend so a dash never reads as a bad result; and **two
  new rows for the things nothing has ever measured** — `Strike location` (all `?`, the
  leading candidate for the Aug 10 scatter) and `Pace / distance` (the open fault, which the
  old grid didn't track at all). A row of question marks is the most useful row on the page:
  it is the only one that says what to go and film next.

  **The grid is the interface, and the verdicts hide behind it** (Aug 24 2026). Seven verdicts
  running to paragraphs used to print in full under the table — the most useful block on the
  page was the one you scrolled past. `evolutionCard()` now renders each metric as a
  `<details>` whose summary carries the marks and a **`state`**: two or three words —
  *Settled · Closed · Open · Quick of 2:1 · Never measured · The open fault* — coloured off
  the metric's `s`. That is what makes the grid readable without reading anything, so **give
  every metric a `state`**; one without renders bare rather than breaking. The rows are CSS
  grid rather than a `<table>` so a `<details>` still column-aligns with the header, and each
  carries an `id` so a tapped-open row survives a `rerender()`.

  Two things that WERE hardcoded in `putting()` now live in the data, so a rebuild is a feed
  push rather than a code change: **`notes`** (one line per column, parallel to `sessions`,
  rendered behind a collapsed *What the N columns are*) and **`foot`** (the closing caveat).
  Only the `<h2>` and the mark legend are still in the view. Keep the `sessions` labels SHORT
  — they render in 34px columns — and put the batch description in `notes`.

  **Consolidate a verdict rather than appending to it.** The grid is a live summary, not a
  log; the append-only rule belongs to the workshop plan. Verdicts reached 9,200 characters
  across seven rows by appending a paragraph per session before being rewritten to 4,800.

### Say which is HIS and which is the TEXTBOOK (standing instruction, Aug 30 2026)

Jack's words: *"there should always be what I'm thinking and feeling and then what best
practices typically are. Clearly separate the two so I can see if I'm off track ever."*

So a plan section, a workshop section or a lesson that carries an instruction has to make
its provenance **scannable, not inferable**. The short-game plan is the worked example: a
`SOURCE ·` line opens every section — `STANDARD PRACTICE`, `YOURS`, or
`YOURS, CHECKED AGAINST STANDARD PRACTICE` — and a section built on something he said sets
out **WHAT YOU SAID** and **WHAT STANDARD PRACTICE SAYS** as two labelled blocks before it
draws any conclusion.

This is the **film-is-king ladder seen from the other side**. That rule ranks his *feel*
against a *measurement*; this one ranks his *read* against the *textbook*, and the two are
independent — a read can be textbook-correct and still unmeasured, which is exactly what
the Aug 30 loft-dial section is. Say both.

Three things that make it worth the words:

- **A verdict is required, and "you're on track" is a real one.** Same rule as
  `mentalTips()` firing a finding that came out good: the point of separating the two is
  that agreement becomes sayable. Don't blend his model into the prose so smoothly that
  nothing says whether it was right.
- **Never let the textbook silently overwrite him.** Where they diverge, both go on the
  page with the divergence named. His *intent* is never overridden at all (film-is-king);
  his claimed *positions* are subordinate to film, not to the textbook.
- **Standard practice is somebody else's number.** A benchmark, a published ratio or a
  stock setup gets labelled `STANDARD PRACTICE` however confident it is, so a page full of
  general advice can't read as a page built from his game — the failure the short-game
  plan's own *What your own cards say* section already guards against.

### Film reports arrive through Drive (Aug 25 2026)

Video analysis no longer happens here. It runs in a separate Claude project with two
installed skills and a **geometry gate** that decides, before any processing, whether the
capture can answer the metric being asked — so a blocked metric comes back reported as
blocked instead of silently producing a wrong number. Reports are named
`YYYY-MM-DD — description` and save **per discipline** — `Golf/Putting/Analysis Reports/`,
`Golf/Short Game/Analysis Reports/`. The discipline is not cosmetic: short game and putting
are separate labs with separate faults lists and separate workshop logs, and a chipping
report filed under Putting will be read against putting metrics that do not transfer (there
is no tempo ratio, no arc-vs-SBST and no mat break in a chip).

**A session MAY be able to read that folder directly, and must check rather than assume.**
This session could, on Aug 25 2026, through the Drive connector — Jack pasted nothing, he
said *"pull the latest report."* But Drive access is a per-session connector, not a property
of the project: verify it in the session you are in. Where it works, sort on the **date
prefix in the filename**, not on modified time — a report can be edited after the fact
without its findings changing. Where it doesn't, say so and ask for a paste; never report a
finding as missing because you failed to fetch it.

Evidence tags map onto the ladder with no conversion: `[VERIFIED]`, `[DERIVED]` and
`[OBSERVED]` all land at **`ev:"measured"`**, above a snapshot and below a logged round.
`[UNKNOWN]` is **not a finding** — it is a capture problem. An `[OBSERVED]` magnitude
**must carry its uncertainty in the visible text**, because no feed type has an
uncertainty field: `test` is `{date, putter, makes, note}`, a 10-ball make count and
nothing else. Drop the uncertainty and an observation is promoted to a measurement, which
is the exact failure the tagging exists to prevent.

**Read what the app already knows BEFORE drafting entries. That is the job, not a
preliminary to it.** The first report through this pipeline — Aug 25, *Findings to Date
(Sessions 1–2)* — was correctly ingested as **nothing at all**. Every headline number in
it was already in the app from the Aug 24 push, and in four places the record was
*stronger* than the report:

| Report said | The app already had |
|---|---|
| Tempo 1.79:1 pooled, n=6 `[DERIVED]` | The same 1.79 pooled from the same six strokes, *plus* the Jul 30 comparison (7 of 8 at 1.9–2.1) the report omits |
| SBST retrace within 0.6–0.9% `[VERIFIED]` | Residuals under 1%, *plus* the unnamed principal-point assumption that moves them to 3–9%, and the 0.5x barrel distortion that bends the very lines a straightness test measures |
| Mat break ~4.9" at the hole `[VERIFIED]` | The break resolved *by pace* — 95% of speed breaks 2.54", 80% breaks 3.95" — which is what makes "on a breaking putt, pace IS line" sayable |
| Early lift reopened `[OBSERVED, ±50%]` | Challenged and **kept closed**: an independent background-difference replication returns the *opposite sign* at every matched depth, so the effect is a motion-blur artifact and the ±50% understates it — the **sign** is method-dependent, not just the magnitude |

Ingesting it would have reopened a settled fault, laundered a caveated figure into a
`[VERIFIED]` one, traded a pace-resolved table for a single pooled number, and minted a
fourth capture action beside three that already exist. **A newer report is not
automatically a better one** — "newest wins on a contested subject" is too coarse when the
older reading has the larger n or names an assumption the newer one doesn't. Resolve
contradictions on **n and method**, and when the record is stronger, say so and push
nothing.

Four rules follow, and they are the standing protocol:

- **Demand the provenance line.** Every report opens with `FILM: NEW — n clips, shot
  <date>` or `FILM: RE-ANALYSIS — re-measures <report>`. Without it a recount of ingested
  footage is indistinguishable from a fresh session, and the evolution grid is one column
  per *batch of film*, not one per time somebody looked at it.
- **Stamp `"src": "drive:<fileId>"` on every film-derived entry.** `applyFeed()` ignores
  unknown keys, so it is inert on the phone and a permanent ledger in the repo:
  `grep src coach-feed.json` answers "has this report been ingested" as a check you can
  run rather than something you have to remember.
- **Capture problems reuse the standing action, never mint a new one.** The same blockers
  recur every session until the reshoot happens. `faceon-action-20260730`,
  `tape-action-20260730` and `action-overhead-20260824` are the open ones — `action-update`
  them; a duplicate to-do is how an unfinished item stops meaning anything.
- **Reports state numbers; they never propose feed JSON.** `applyFeed()` is the authority
  and its shapes drift. A wrongly-shaped entry that looks authoritative reads as done.
- **The duty to check what is already shipped is OURS, not the analysis side's.** It is a
  chat project with no view of this repo, so it cannot know what has landed and will
  re-derive from scratch every time — which is not a fault, it is the arrangement. All it
  owes is the provenance line saying which footage it looked at. Everything downstream of
  that — has this been ingested, is the record already stronger — is a `coach-feed.json`
  read on this side, before drafting.

The reciprocal brief to the analysis side lives in `Golf/Caddie HQ/` on Drive. Where the
two disagree about a **finding**, the report wins; about **protocol**, this file wins.

- **Jack mentions a course he's playing** (standing instruction, Jul 29 2026): don't wait
  to be asked — append a `course-add` for it alongside whatever else the message calls
  for, so it's already in Courses for him to rate afterward. Use the plain course name
  (no format/event suffix) and its state/country in `st`; leave `rating`/`pr`/`notes`
  empty — those are his to fill in. `course-add` is a no-op if the name already exists,
  so a duplicate is harmless. Name it the same as the matching briefing's `course` where
  possible — `briefing()` links a briefing's "Your history" line by exact name match.

### Home ends with What's new — and it has to be fed (Aug 20 2026)

Jack's instruction: *"Make home page the same down to from your coach today. After that make
it showing anything new that is updated for reference. If multiple list them all."* So Home
is unchanged through the coach tip, and everything below it is now a **changelog**: every
change, newest first, grouped by the day it was made, all of them listed rather than the
latest one. (The old *Gear intelligence* card moved to Bag → **Wear**, where the clubs it
describes are; the return-window card and the Decisions / Data links still follow it.)

Two streams merge in `whatsNew()`:

- **The coach feed.** `applyFeed()` calls `recordUpdate()` on every entry it applies, and
  `updateLine()` turns the entry into one line of plain English plus where it landed.
  **A new feed `type` needs a case in `updateLine()`** or it renders as a bare
  `Update · <type>` — the fallback exists so a change can never be invisible, not as a
  substitute for describing it. Text stored there is RAW; `whatsNew()` escapes on render.
- **`RELEASES` in `app.js`** — the app's own notes. The feed carries data; a change to the
  app itself has no other route onto the phone and nowhere else to announce itself.
  **Add a `RELEASES` block every time you bump `BUILD`**, newest first, written for Jack
  rather than for a developer. An update he can't see landed is indistinguishable from one
  that didn't.

Three behaviours worth not breaking:

- **Dates come from the feed id** (`plan-short-putts-20260814-v8` → Aug 14), because that is
  the day the change was made. `entryDate()` prefers it over the entry's own `date`, which
  means different things per type — and on a briefing is the date of a round that may not
  have happened yet.
- **Same headline, same day = one row**, with an `N updates` count. The feed versions a plan
  by re-sending it, which is right for the data and pure noise in a changelog.
- **`updatesInit` / `seenUpdates`.** On an install that has already applied the whole feed
  the log would open empty, so `backfillUpdates()` replays the feed's tail once and marks it
  — plus every release before the current `BUILD` — already seen. That way the "N new"
  banner on the first open after an upgrade counts only what is genuinely new. Boot renders
  Home before the feed is fetched, so the first render is deliberately read-only; the one
  after it commits.

**Aug 27 2026 (Jack's redesign): the block is titled *What's landed*, folds behind a
`fold()` header, and each row leads with a mono TYPE column** (`UP_TYPE` / `upType()` in
`app.js`) tinted by how strong the evidence behind that kind of change is — burgundy for
film and scorecards, green for a round, green accent for the coaching library, gold for a
number nobody measured, neutral ink for everything else. The day heading moved into the
rows as a right-aligned date. **None of the three behaviours above changed**, and a type
with no `UP_TYPE` row falls through to a neutral `UPDATE` for the same forward-compat
reason `updateLine()` has a default case. Above the changelog, Today also grew three
blocks — the green **weather card** (a restyle of what the Conditions tile already
computed, `playsFactor()` unchanged and temperature-only, which the card says out loud),
**The one thing** (`oneThing()` — `coachFocus()` over `coachSignals()`, i.e. the same pick
Coach leads with, so the top of Today can never quietly outrank the page below it), and the
**start/resume round button**, which absorbed the old round-in-progress banner: one
affordance for one intention, matching the TEE tab.

**Aug 30 2026 — Today carries the LATEST DAY only, and the whole log moved to its own page**
(`landed`, reached from the button under the rows and mapped to the Today nav button).
Jack's words: *"it should be like whatever landed actually that day and then there's a
button to see the entire list."* The block had reached a hundred-odd rows, so the thing
that answers *what is different since yesterday* had become an archive of changes he had
already read — two different questions, and only the first belongs on a home page. Nothing
was cut and none of the three behaviours above changed; `upDays()` builds and collapses the
days once and both renderers read it, so the two can never disagree about what landed.

The rule that makes the split safe is **`upMarkSeen(days, shown)`: only what was actually
put on the screen is marked seen.** Marking the whole log read from Today would retire the
fresh flag on rows he has never been shown, and a "N new" count is worth nothing the moment
it stops meaning what it says. It is additive and then pruned to what is still on the list,
so the set can't grow forever either. Today's meta counts its own day; the button carries
the rest of the count and how many of those are unseen.

**Aug 30 2026 — Today's running order, after Jack swapped the numbers and the one thing:**
weather · **The numbers** (the stat row and the tiles, one block) · start/resume round ·
Round prep · **The one thing** · the coach tip · What's landed · the return window · the
data links. The four chart
tiles sit directly under the weather; the focus sits below Round prep, beside the coach tip
it belongs with. `oneThing()` itself is untouched and still renders `coachFocus()` over
`coachSignals()`, so this was purely where a block sits — not a change to what Today claims
or to the order in which it decides. The rule above still holds: whatever leads Coach is
what that card shows, wherever on the page it happens to be.

### The evidence drawer (Aug 27 2026 — build a finding's provenance once)

`evDrawer(id, label, ev, sample, more)` in `app.js` is the disclosure behind a tier chip:
tapping the header opens **EVIDENCE USED** — the sample, the source, and *what is not
measured*. Reuse it wherever a finding renders; the tiers must never be explained two
different ways on two screens.

- The **sample** is the finding's own `src` — pass it, never a number you computed here.
- The **source** and the **not measured** lines come from `EV_SOURCE` / `EV_BLIND`, written
  down **per tier** rather than per finding, because they are properties of the source and
  not of the number: a scorecard cannot see a stroke however many holes of it there are.
  An invented per-finding limitation reads exactly like a real one — the failure the whole
  ladder exists to prevent — so anything finding-specific goes in the optional `more`.
- It is a plain `<details id=…>`, so an open drawer survives a `rerender()` on the
  machinery that already reopens folds. Never build a parallel open/closed store for it.

After any feed change: `python3 -c "import json; json.load(open('coach-feed.json'))"`,
`node --check app.js`, bump `"updated"`, commit, push.

**Always merge to `main` when the work is done** (standing instruction, Aug 1 2026): Jack
doesn't review PRs on this repo — GitHub Pages serves from `main`, so work that stops on a
feature branch never reaches his phone. Develop on the assigned branch, then fast-forward
`main` and push it. No PR needed unless he asks for one.

## Gotchas

- **Dates are the player's LOCAL day, via `isoDay()` — never `toISOString()`** (fixed
  Aug 30 2026). `today()` read the clock in UTC, so from 8pm Eastern onwards (7pm in
  winter) the app believed it was already tomorrow: a round finished on a Sunday evening
  saved itself as Monday, a drill logged at nine landed on the wrong day of the streak,
  and What's landed stopped saying "today" hours before the day was over. Evening is
  prime time for this app, so the bug fired most nights. Anything deriving a `YYYY-MM-DD`
  from a `Date` — a saved round, a `drillDays` entry, an `entryDate()` fallback, a
  location fix's display date — goes through `isoDay()`. Note this is only about turning
  a moment into a calendar day; `fmtDate()` already parses a stored date at `T12:00:00`
  precisely so a stored day never shifts on the way back out.
- Do **not** hand-edit `S.feedApplied` or expect `seed()` edits to reach existing installs.
- Some UI copy is hardcoded around specific gear. If the marquee gear changes, grep
  `app.js` for the old name and update the render branch too — data alone won't cover it.
  The Home "Putter return window" card and the Decisions "putter call" used to key off a
  club literally named *Phantom 7.5*; **fixed Aug 10, 2026** — both now use
  `pendingReturn()`, which finds any non-`returned` club carrying `returnWindow:true`.
  So putting a club in a return window is a data change (`club-update` with
  `returnWindow:true`) plus a `deadline` entry for the date. The deadline is a single
  global setting, so pass `"date": ""` to clear a stale one belonging to a different club —
  the card then renders "Deadline unknown" instead of a wrong countdown.
- `design-options/` and `mockup/` are frozen pre-launch artifacts; leave them be.
