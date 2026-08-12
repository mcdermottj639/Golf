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
| `course-add` / `course-remove` | Add/remove a course |
| `round`          | Add a played round (see *Logging a round* below) |
| `stats`          | Add/replace a cumulative stats snapshot (GHIN summaries); `replaces` swaps one out |
| `test`           | Append a 10-ball putter test result |
| `shortlist`      | Replace the putter shortlist (keeps prior `demoed` flags) |
| `briefing` / `briefing-remove` | Round-prep briefings & standing plans (see *Writing briefings* below) |
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
| Mini driver | 13.5° | fairway-finder / 3-wood slot (model TBC) |
| Utility | Cobra KING TEC 2-iron · ~17° | |
| Irons | Cobra KING TEC 4–PW | **44° PW** anchors the wedge ladder |
| Wedges | **Vokey 50.08F · 56.10S · 60.08M** | 50 = F/8° sweeper · 56 = S/10° workhorse · 60 = M/8° creative |
| Putter | **L.A.B. Golf LINK.2.1** | the only zero-torque head left. Narrow blade, gamed Jul 30 – Aug 1 and again from **Aug 10, 2026** — and **still inside its own return window** (`returnWindow:true`, deadline unknown). Carries a **Pistol 0** grip: zero built-in lean, shaft vertical, hands ~1.35" behind the ball — that's the live cue. Its column holds the only two reds on the evolution grid (face at impact, 1.5–1.7° left start line, both measured Jul 30) |
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

Tapping a round in **Scores** opens `roundView()` — the hole-by-hole card, scoring mix,
par splits, miss directions, round-scoped coaching, and a comparison against the latest
`stats` snapshot. Every block hides itself when its data is absent, so a score-only round
still opens; it just shows less. `troubles[]` must use the keys in `TROUBLES` (`app.js`
top) — they also feed lesson matching for the next three rounds.

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
