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
| `evolution`      | Replace the metric-evolution grid |
| `faults`         | Replace the current faults list |
| `action`         | Add an open action item |
| `action-done`    | Mark action `target` done |
| `action-update`  | Rewrite action `target` text |
| `carries`        | Replace the distance ladder (ignored once the user calibrates) |
| `course-add` / `course-remove` | Add/remove a course |
| `test`           | Append a 10-ball putter test result |
| `shortlist`      | Replace the putter shortlist (keeps prior `demoed` flags) |
| `briefing` / `briefing-remove` | Round-prep briefings & standing plans |
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

## Current bag (source-of-truth summary — keep in sync with the feed)

| Slot | Club | Notes |
|------|------|-------|
| Driver | TaylorMade Stealth 2 · 9° | |
| Mini driver | 13.5° | fairway-finder / 3-wood slot (model TBC) |
| Utility | Cobra KING TEC 2-iron · ~17° | |
| Irons | Cobra KING TEC 4–PW | **44° PW** anchors the wedge ladder |
| Wedges | **Vokey 50.08F · 56.10S · 60.08M** | 50 = F/8° sweeper · 56 = S/10° workhorse · 60 = M/8° creative |
| Putter | **L.A.B. Golf DF3i · 34"** | zero-torque — the fix for the SBST stroke; bought Jul 18, 2026 |
| Backup putter | Scotty Newport 2 | arc-suited blade, bullpen |
| Returned | ~~Scotty Phantom 7.5~~ | **officially returned Jul 20, 2026** — putter search closed |

Wedge ladder behind the 44° PW carries roughly: PW 122 · 50° 108 · 56° 95 · 60° 80.

## How to make common updates

- **Bag change** (new club, spec fix, status change): append a `club-add` or
  `club-update` entry + usually a `history` entry. Use a unique dated `id`.
- **Log a filmed putting session**: append a `session` entry; update `evolution` /
  `faults` if the read changed.
- **Close out a to-do**: append an `action-done` targeting the action's id.
- **Round-prep briefing**: append a `briefing` entry (dated = one round; undated =
  standing plan, singleton per course/title).

After any feed change: `python3 -c "import json; json.load(open('coach-feed.json'))"`,
`node --check app.js`, bump `"updated"`, commit, push.

## Gotchas

- Do **not** hand-edit `S.feedApplied` or expect `seed()` edits to reach existing installs.
- Some UI copy is hardcoded around specific gear (e.g. the Home "Putter return window"
  card keys off a club named *Phantom 7.5* being `returned`). If the marquee gear changes,
  grep `app.js` for the old name and update the render branch too — data alone won't cover it.
- `design-options/` and `mockup/` are frozen pre-launch artifacts; leave them be.
