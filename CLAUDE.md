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
                      (incl. the live-round logger — see "Live rounds" below —
                       and the Mental tab, see "The Mental tab")
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
| `session-remove` | Drop a session by `target` (its feed id) — used to fold duplicates together |
| `evolution`      | Replace the metric-evolution grid |
| `faults`         | Replace the current faults list |
| `action`         | Add an open action item |
| `action-done`    | Mark action `target` done |
| `action-update`  | Rewrite action `target` text |
| `carries`        | Replace the distance ladder (ignored once the user calibrates) |
| `carry-update`   | Patch ONE ladder row by `target` name: `club` to add/patch (`after` names the row to insert behind), `remove:true` to drop it. **Not** gated on calibration — see below |
| `course-add` / `course-remove` | Add/remove a course |
| `round`          | Add a played round (see *Logging a round* below). Skipped if a round with the same `date` + `course` + `nine` is already there, whatever put it there |
| `round-update`   | Patch a round matched by `date` + `course` (+ `nine`): `Object.assign` of the top level, per-hole merge by hole `n`. **The way to backfill `rating`/`slope` onto a live-logged card**, or fix a hole after the fact |
| `stats`          | Add/replace a cumulative stats snapshot (GHIN summaries); `replaces` swaps one out |
| `test`           | Append a 10-ball putter test result |
| `shortlist`      | Replace the putter shortlist (keeps prior `demoed` flags) |
| `briefing` / `briefing-remove` | Round-prep briefings & standing plans (see *Writing briefings* below). `discipline` routes a standing plan to its lab: `putting`, `mental`, `full-swing`/absent |
| `deadline`       | Set the return-window deadline (clears "estimated") |

Unknown types are left unapplied on purpose (forward-compat), so a typo'd `type` silently
does nothing — double-check against `applyFeed()`.

### Club status values

`gaming` (in the bag), `ordered` (on order), `backup` (owned, not in the 14),
`wishlist` (scouting), and `returned` (sent back — drops out of every bag list).
`clubCard()` also renders a **MISMATCH** flag for a `flow:'toe'` putter against an
`SBST` stroke.

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
  is **unmeasured**. Full read in the *Eye Dominance — What It Changes* plan.
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
| Putter | **L.A.B. Golf LINK.2.1** | the only zero-torque head left. Narrow blade, gamed Jul 30 – Aug 1 and again from **Aug 10, 2026**. **KEPT for good Aug 12, 2026** — Jack closed the return window by decision, so `returnWindow:false` and `pendingReturn()` is empty: the Home return-window card is gone and Decisions reads DECIDED. The putter search is over; every remaining explanation for the left miss is aim or stroke, not gear. Carries a **Pistol 0** grip: zero built-in lean, shaft vertical, hands ~1.35" behind the ball — that's the live cue. Its column holds the only two reds on the evolution grid (face at impact, 1.5–1.7° left start line, both measured Jul 30) |
| Benched | ~~TaylorMade r7 Quad Mini Driver · 13.5°~~ | **out Aug 12 2026**, kept not sold. Its tee-shot record stays in the Off-the-tee table as history |
| Backup putter | Scotty Newport 2 | arc-suited toe-hang blade — renders a **MISMATCH** flag against the SBST stroke. If the LINK goes back this is all that's left, i.e. the mismatch the whole saga opened with |
| Returned | ~~L.A.B. Golf DF3i · 34"~~ | **returned Aug 10, 2026 — distance control.** Gamed Jul 18–30 and Aug 1–10. Its Press Pistol 2° went with it, so the "hands even with the ball" cue is **retired** — don't carry it to the LINK. Lost with it: the only measured scoreboard in the project (8/10 from four feet, Jul 20) and the high-MOI control head |
| Returned | ~~Scotty Phantom 7.5~~ | **officially returned Jul 20, 2026** |

**Live putting priority: distance control.** Pace has now decided the fate of two putters (DF3i benched Jul 30, reprieved Aug 1, returned Aug 10) and has never been measured once. The grind is the 30-ft ladder twice a week on the LINK, logging *shorts · spread · green speed*, plus the unrun tape test — an off-centre strike bleeds ball speed, so it's a distance fault before it's a line fault. Tempo is **not** the problem (2.0:1 on this head vs a 2:1 target).

Wedge ladder behind the 44° PW carries roughly: PW 122 · 50° 108 · 56° 95 · 60° 80.

## How to make common updates

- **Bag change** (new club, spec fix, status change): append a `club-add` or
  `club-update` entry + usually a `history` entry. Use a unique dated `id`.
- **Log a filmed putting session**: append a `session` entry; update `evolution` /
  `faults` if the read changed.
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
| `gir` | `true`/`false` — green in regulation |
| `gmiss` | where a missed green finished: `S` `L` `R` `Lg` `X` (short/left/right/long/other) |
| `fw` | `true`/`false` — fairway hit. **Omit entirely on par 3s** so they don't count against the fairway rate |
| `fmiss` | where a missed tee shot finished, same codes |
| `tee` | **club key** hit off the tee — drives the *Off the tee · by club* table |
| `app` | **club key** hit into the green on a par 4/5. Omit on par 3s: there the tee shot *is* the approach |
| `noshot` | `true` when the tee shot left **no realistic play at the green** — see *Two ways to miss a green* below. Par 4/5 only |

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
Finishing writes an ordinary round — same schema as above, plus `live:true` — and drops him
straight into its `roundView`. Par and stroke index prefill from the newest card at that
course, so a repeat course needs no typing at all.

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

### Hole data outranks a stats snapshot

An extension of *film is king* to the numbers: a hole Jack recorded himself is **measured**,
a pasted GHIN average is **summarized**, a feel is **feel**. This works two ways:

1. **Ranking.** Every tip carries an `ev` provenance — `round` (hole-by-hole cards he
   logged) → `measured` (5-ft tests, filmed faults) → `snapshot` (pasted GHIN summaries)
   → `self` (his own post-round debrief, the Mental tab's only witness for what a card
   can't see), ranked by `EV_RANK` and badged in the UI by `evTag()`. Coach sorts severity first, then
   evidence, so the warnings still lead but his own rounds speak before a season average
   somebody else computed. **Any new tip must carry an `ev`** or it sorts as a snapshot.
2. **Suppression.** Once the hole-logged sample is real (36+ recorded greens or putting
   holes), `statTips()` stands its snapshot versions of the approach-miss and three-putt
   findings down and the live ones speak instead — see its `live` argument.

Don't reintroduce a snapshot claim the hole data now answers better; do keep saying which
one a number came from.

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
- **`S.mental`** — post-round debriefs, `{id, date, round:{course,date}|null, focus:1–5,
  triggers:[], when:[], note, next}`. Self-report, so it ranks `self` — below every number
  on the page and still the only witness for match play, mood and pace-of-play, none of
  which appear on a scorecard. The newest `next` renders as the **"Next round · one job"**
  card at the top: one job, never a list.

**Mental plans are briefings with `"discipline": "mental"`.** That keys them to this tab
(`swing()` excludes them explicitly — the swing lab is the default home for any plan that
doesn't name a discipline, so a new discipline must be added to its exclusion list and to
`briefing()`'s back-link map). The standing plan is *Locked In — The Mental Round*.

Two honesty guards worth keeping: the sample is thin (63 holes at two courses), and
**every card is stroke play**, so "got to a lead and didn't close" is untested rather than
disproved — say so rather than letting the closing number answer a match-play question.

### Re-rendering must not move the page

`render()` resets scroll to the top — that's right for navigation. `rerender()` **preserves
the scroll position**, because redrawing the view you're already on is an update, not a
navigation. Every chip tap in the live logger re-renders, and jumping to the top each time
made scoring a hole mean scrolling back down six times. Use `rerender()` for in-place
changes and `render()` only when the user has actually gone somewhere (including moving to
the next hole, which is a navigation).

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

- **Jack mentions a course he's playing** (standing instruction, Jul 29 2026): don't wait
  to be asked — append a `course-add` for it alongside whatever else the message calls
  for, so it's already in Courses for him to rate afterward. Use the plain course name
  (no format/event suffix) and its state/country in `st`; leave `rating`/`pr`/`notes`
  empty — those are his to fill in. `course-add` is a no-op if the name already exists,
  so a duplicate is harmless. Name it the same as the matching briefing's `course` where
  possible — `briefing()` links a briefing's "Your history" line by exact name match.

After any feed change: `python3 -c "import json; json.load(open('coach-feed.json'))"`,
`node --check app.js`, bump `"updated"`, commit, push.

**Always merge to `main` when the work is done** (standing instruction, Aug 1 2026): Jack
doesn't review PRs on this repo — GitHub Pages serves from `main`, so work that stops on a
feature branch never reaches his phone. Develop on the assigned branch, then fast-forward
`main` and push it. No PR needed unless he asks for one.

## Gotchas

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
