# Plan — Trackman at Golf Lounge 18 — **ALL PHASES BUILT 2026-09-11 (v96–v97)**

*Research + design. **Phases 1–2 shipped in v96; phases 3–5 (the grid per discipline,
simulator rounds, the Combine) shipped in v97 the same day** — built ahead of the data for
the same reason as the first two: so the first session has somewhere to land. `CLAUDE.md`'s "The bay" section is the authority on what was
built and why — this file keeps the research and the reasoning behind it. Jack's words: "New golf lounge 18 is open near me
with trackman. I made a trackman acct and will start playing there and getting lots of
data. Research this all and mock up a plan how we can integrate it into the app."*

---

## 0. The short version

A Trackman bay is the first source this project has ever had that **measures the ball and
the club directly**. Everything the app currently knows is one of: a scorecard (what
happened, never how), phone film (how, hand-measured, with stated assumptions), or Jack's
own feel. Trackman is a fourth thing, and it lands squarely on the numbers this app has
been openly unable to produce:

| The app says today | What a bay session produces |
|---|---|
| Driver **235, estimated**, on a shaft that changed in June and has never been measured | Club speed, ball speed, smash, launch, carry — and whether the regular LZ 5.5 is right (spin needs a marked ball; see §1) |
| Mini driver 15.5° — **carry blank** | A carry, at the loft it actually plays |
| 5-wood 19.5° — **carry blank, at either loft** | Same |
| 2-iron **~17°, 205 estimated** | Same, plus whether it and the mini are genuinely the same number (the OVERLAP flag is loft arithmetic and says so) |
| Wedge matrix: **6 of 9 clock numbers never measured** | All nine in half an hour |
| Evolution grid: **Strike location — all `?`** | Impact location every shot — *if the ball is marked; see §1* |
| Evolution grid: **Face at impact — one red mark, Jul 30** | Face angle at impact, every stroke, to 0.1° |
| Swing faults read off **seven phone stills** | Club path, face-to-path, attack angle, low point, dynamic loft |

That is the case for doing this. The case for doing it **carefully** is the rest of this
document, and it comes down to one sentence: **a bay number is measured off a perfect lie
in still air with nothing at stake, and the carry is a flight model, not a ball that
landed.** This app's whole discipline is not letting two different kinds of evidence wear
one badge, so Trackman gets its own evidence tier, its own blind-spot text, and a hard wall
between simulator rounds and the handicap.

Recommended order, revised 2026-09-11 once Jack answered §9: **the ladder first** (biggest
gap, smallest build), **putting second and possibly first** — it needs no marked ball, his
bay probably has it, and face angle at impact has been measured once in the project's
history — then bay sessions in the labs, then sim rounds, then the Combine.

Two answers from Jack that change the shape of it: **the lounge's balls are plain and
unmarked**, which means spin is estimated rather than measured and a bay carry is a range
ball's carry (§1 — the fix is a $15 sheet of metal dots or a sleeve of Pro V1 RCT); and
**the bay settings are his to set**, which means normalization goes to **70°F / sea level**
rather than Trackman's 77°F default, because 70 is the baseline `playsFactor()` already
assumes and matching it makes the app's "plays like" numbers exact.

---

## 1. What Trackman actually gives you

### The hardware in those bays

Golf Lounge 18 runs **Trackman 4 dual-radar** units — their own copy says so, and the
venue listings agree. TM4 is the tour-standard unit: two radars (one tracking the club
through impact, one tracking the ball) plus a camera for impact location. Locations are
Canton, Danbury, Fairfield, Orange and South Windsor, with Stamford announced — Jack will
know which one is his; it matters only for the venue name that goes on each record.

### Your shots are tied to your account, if you log in

This is the piece that makes any of this work. In the bay you scan the **QR code** on the
screen with the Trackman Golf app (or a 6-digit PIN, or email + password), which links your
account to that bay. From then on shots, rounds and club data save to your profile and show
up in the app under **Activities** after the session.

**If he doesn't log in, the session is gone when the bay resets.** That is rule one of the
capture protocol in §8.

### What lands in the account

- **Range / practice sessions** — every shot, with the full parameter set below.
- **Course rounds (Virtual Golf)** — a scorecard plus shot-by-shot for every hole, and
  aggregate stats: driving distance, fairways hit, greens in regulation.
- **Map My Bag** — a per-club profile (carry, total, dispersion, gapping) kept as a
  **rolling 30-shot average**, so the oldest shots fall out as new ones go in. Minimum 6
  shots per club, 30 recommended.
- **A "Trackman handicap"**, computed off his Trackman performances. Noted here only so it
  is never confused with his GHIN index — see §5.
- **Combine** test results (§7, phase 5).

### The parameters, and which are measured vs modelled

Club delivery: **club speed · attack angle · club path · face angle · face-to-path ·
dynamic loft · spin loft · swing direction · swing plane · impact location**.
Ball launch: **ball speed · smash factor · launch angle · launch direction · spin rate ·
spin axis**.
Flight and landing: **carry · total · side · side total · height · landing angle · curve**.

Indoors the radar sees only the first stretch of ball flight — roughly 8–10 feet of it is
what a TM4 needs for reliable data — so **launch is measured and the rest of the flight is
computed** by Trackman's ball-flight model. That model is the same one that comes within a
few percent on carry outdoors (a vendor-adjacent claim, not an independent one), and it is
enormously better than the estimates currently on the ladder. It is still a model, and the
app has to say so.

### The ball decides how much of this is actually measured

**The lounge hits plain, unmarked white balls** (Jack, 2026-09-11). That is the single
most consequential answer of the four, and it splits the parameter list in two:

- **Unaffected — measured on any ball.** Everything the radar reads off the club and off
  the ball at separation: club speed, attack angle, club path, face angle, face-to-path,
  dynamic loft, low point, ball speed, smash factor, launch angle and launch direction.
  **The swing diagnosis and the putting stroke are in this half**, which is most of what
  this project actually wants.
- **Compromised — spin, and probably impact location.** Indoors TrackMan needs the ball to
  complete about **two revolutions inside the tracked window** to measure spin; on a plain
  ball in a bay it frequently cannot, and **reports an estimate instead**. Trackman's own
  remedy is a **Titleist Pro V1 RCT** ball (radar-reflective marker under the cover) or a
  **metal sticker dot** on a normal ball. Reports also tie impact location indoors to a
  marked ball — treat that as unconfirmed until he looks at the screen.

**Carry is computed from launch AND spin**, so on a venue ball the ladder number is a model
built partly on an estimated input — and it is a *range ball's* flight, not his gamer's.
That is still better than "235, estimated, on a shaft that changed in June", and it is two
removes rather than one, so it gets said out loud on the row.

**The fix costs about $15 and one sentence at the desk:** bring his own balls, and put a
metal sticker dot on them (or play a sleeve of Pro V1 RCT, which needs no sticker and no
orienting). Then the carry is his ball, with measured spin, and it transfers to the course.
Until then, phase 1 carries get logged with `ball: "venue, unmarked"` and are treated as
**provisional** — good enough to fill a blank row, not good enough to overwrite a number he
typed.

**Normalization — set the bay to 70°F and sea level, not Trackman's 77°F default.** Jack
says the settings are his to set, and this one is free precision. `playsFactor()` in
`app.js` is `1 + (t − 70) × 0.001`: the app's stored carries are **70°F numbers**, and it
adjusts them for today's air from there. Store a 77°F-normalized carry and every "plays
like" figure on the phone runs about **0.7% long — a couple of yards on the driver, and
wrong in the same direction every time**. Matching the bay to the app's own baseline makes
that error zero by construction.

If a bay ever can't be changed, do **not** silently convert: record `norm: "77°F · sea
level"` as given, and let the ingest state both numbers in `meas.how` ("241 at 77°F = 239 at
the app's 70°F baseline"). An adjusted number with no arithmetic on the page is
indistinguishable from a measured one.

### Putting — the one that matters most here

TM4 measures putting: **face angle at impact, putter path, launch direction, ball speed,
skid distance, roll speed, roll %**. Face angle at impact is the single number the entire
putter saga has been built on one measurement of (1.5–1.7° left, Jul 30 2026, the only red
on the evolution grid) and has never re-measured since the LINK.2.1 arrived. Jack believes
his bay has putting analysis and has not used it (2026-09-11) — so this is *probable, not
established*, and it is the first thing to check on the next visit. **No marked ball is
needed for it**, which is what makes it the cheapest measurement available to him: **one
20-putt session settles the open question of
whether "barely open" at address is delivering square** — and puts a number on "barely",
which is a standing to-do.

**Whether a commercial bay exposes putting analysis is unknown and he has to check.** It is
a TPS practice mode; some venues run it, some run course play only. Question 1 in §9.

---

## 2. Getting the data out — the hard constraint

**There is no consumer export.** A Trackman account holder using the Golf app cannot export
CSV, and mytrackman.com has no export either — the portal is a viewer. CSV export exists
only for **owners** of a unit with a software subscription, through TPS's Shot Analysis
module. There is a Trackman Cloud GraphQL API and a Range REST API, but credentials are
sold to facilities, not to players.

So the integration is **not** an API integration and never pretends to be. Three routes,
ranked by how much work they are for Jack:

**Route A — screenshots (the default).** He photographs the summary table in the app or the
bay screen, sends them here, and this session reads the numbers and drafts the feed
entries. This is exactly the pipeline film reports already use, and it works from day one
with no permission from anyone. Cost: one message after a session. **Everything in this
plan is designed to work off Route A alone.**

**Route B — a TPS emailed report.** TPS can send a Shot Analysis report (PDF, and CSV for
the operator) to a player's email, and can auto-share reports into the player's portal.
This needs the venue's TPS and a staff member — most naturally **during a lesson**, which
Golf Lounge 18 sells. If a pro there will email the session report, the data arrives
typed rather than transcribed. Worth asking at the desk; not worth depending on.

**Route C — a third-party shim** (SwingSync and similar re-expose Trackman sessions with a
CSV export). Mentioned for completeness. It means handing a third party his Trackman
credentials, and this app has no backend to consume a CSV anyway. **Not recommended.**

The consequence for the design: **the ingestion format is a human-readable number table,
and the app never talks to Trackman.** Same as Drive film reports, same trust model, same
`src:` stamp so `grep src coach-feed.json` answers "have we already ingested this session?"

---

## 3. Where it lands in this app — the routing decision

The routing table in CLAUDE.md says a new thing either expands a plan, starts a new one,
becomes a workshop-log section, or becomes a Coach lesson. Trackman is none of those: it is
a **new source of evidence**, like film, and film has a shape already — sessions filed per
discipline, findings that become faults, a grid that tracks a metric over batches.

So the decision, stated plainly because the alternative is tempting:

> **There is no "Trackman lab" and no fifth tab.** Bay sessions file into the labs that
> already exist — Swing, Short Game, Putting — by discipline, exactly as film does.

A lab named for a *device* would break the rule the labs are built on (sliced by situation,
not by topic) and would split the putting evidence across two pages the first time a bay
session and a phone clip disagreed. A fifth lab is cheap in the nav and expensive in
meaning.

Second decision: **bay sessions are a separate array from film sessions, not a `kind` flag
on `S.sessions`.** Reusing `session` would render for free, which is genuinely attractive —
but `sessionSize()` prints "23 clips", the labs count sessions as "filmed", and the two
sources have opposite blind spots (film sees the body and can't measure the ball; radar
measures the ball and never sees his posture). One array, two badges, is how a Trackman
carry ends up quoted as "filmed". They sit in the same place on the page, under their own
heading, and share the row renderer.

---

## 4. The evidence tier

A new tier, `bay`, slotted **above** `measured` (a radar reading beats a frame counted by
hand off a phone) and **below** `round` (a card he actually played outranks a perfect-lie
number, which is the whole `EV_RANK` premise):

```js
const EV_RANK = { live:0, round:1, bay:2, measured:3, snapshot:4, self:5 };
const EV_LAB  = { …, bay:'measured in the bay' };

EV_SOURCE.bay = 'Trackman 4 in a simulator bay — radar-measured club delivery and ball ' +
  'launch, indoors, off a mat.';
EV_BLIND.bay  = 'A perfect lie, still air, no slope and nothing at stake — and the carry ' +
  'is a flight MODEL computed from measured launch, not a ball anyone watched land. It ' +
  'cannot tell you what this swing does off grass, in wind, with a score going.';
```

`evDrawer()` then explains it once, everywhere, and nothing else has to change: the drawer,
the badges and the ranked lists all read `EV_RANK`/`EV_LAB`/`EV_SOURCE`/`EV_BLIND`.

`UP_TYPE` gains `bay:['BAY','u-m']` — the measured tint, beside FILM and CARD — and
`updateLine()` gains its case, or What's landed renders a bare `Update · bay`.

---

## 5. The three honesty guards

These are the parts that will look like over-engineering in six months and will be the
reason the numbers still mean something.

### Guard 1 — a simulator round never touches the handicap

The USGA does not accept simulator scores for a Handicap Index: an acceptable score is
played on a rated course under the Rules of Golf. So:

- A sim round is stored with **`sim:true`**.
- `indexBasis()` and `roundDiff()` **filter it out**, unconditionally, before anything else
  happens. Not "if rating is absent" — a Trackman round of Pebble Beach knows the real
  course rating and slope and would happily produce a differential. It must not.
- `areaCards()` excludes sim cards from every set it hands out, so Today's tiles and
  Coach's four areas stay on-course numbers. A 78 indoors must never move the fairway
  percentage the coaching is built on.
- Sim rounds render in their own place (§6.4) with their own badge, and their scoring is
  worth having — it is just a different game.

### Guard 2 — a mat is not turf, and the app says so on the page

Every bay number renders next to text that names what it cannot see. That is `EV_BLIND.bay`
doing its job, and it is why the tier exists rather than reusing `measured`.

Two specific traps to write down now, before either one produces a "finding":

- **Carry off a mat runs longer than off grass** for most players, and a mat forgives fat
  strikes that would cost real yards. A ladder built purely on bay carries will be
  optimistic on the short irons and wedges in particular. The ladder note must say the
  number's source, and the on-course cards remain the check.
- **Sim putting is not putting.** In a virtual round the putt is struck on a flat mat and
  the break is applied by software. Sim putting data is worthless for pace and break, and
  actively misleading if it reached `bagPutt()`. The *practice* putting mode (real stroke,
  real roll, measured face and path) is a different thing and is welcome; a *round's*
  putting numbers are not.

### Guard 3 — provenance on every push, or it doesn't go in

Film reports carry a `FILM:` line for exactly this reason. The bay version, required on
every entry:

```
BAY: Golf Lounge 18 <town> · bay <n> · 2026-09-20 · TM4 · <TPS mode>
     ball <venue premium | his own> · normalization <on: 77°F / 0 ft | off>
     n=<shots> · <warm-up excluded? yes/no>
```

and `"src": "tm:2026-09-20-gl18-fairfield"` stamped on every entry it produces, so the repo
can answer "did we already ingest this?" with a grep instead of a memory.

Without the ball and the normalization line, two sessions a month apart are not comparable
and nobody will be able to tell why the driver "gained" eight yards.

---

## 6. The data model, screen by screen

### 6.1 Phase 1 — the carry ladder gets real numbers

The ladder already has the right route in (`carry-update`, deliberately not gated on
`carriesCalibrated`, because bag membership is a coaching update). What it lacks is
**provenance**: a row carries `{club, loft, carry}` and nothing that says whether 235 was
measured or invented. Right now every number on it is estimated and one banner covers the
lot — which is honest today and becomes a lie the first time a measured number lands
beside an estimate.

Add three optional fields to a ladder row, all set through the existing `carry-update`:

```json
{ "type": "carry-update", "id": "carry-driver-tm-20260920",
  "target": "Driver",
  "club": { "carry": 241, "meas": { "src": "tm:2026-09-20-gl18-fairfield",
            "n": 14, "sd": 9, "date": "2026-09-20",
            "ball": "venue, unmarked", "norm": "70°F · sea level",
            "spin": "estimated",
            "how": "TM4 indoors · venue ball · spin estimated · carry modelled from launch" } } }
```

- `meas.n` — how many shots it is the average of. **A carry with no n is not a measurement**,
  and 6 is the floor Trackman itself sets.
- `meas.sd` — the spread. This is the number that decides club selection on a par 3 and the
  app has never had it for anything.
- `meas.ball` — `"venue, unmarked"` / `"his own, dotted"` / `"Pro V1 RCT"`. **The field that
  decides whether the number transfers to the course**, and the reason it is a field rather
  than prose in `how`: it has to be comparable between sessions without anyone re-reading a
  sentence.
- `meas.norm` — the bay's normalization setting, so a 77°F row can never be silently
  compared against a 70°F one.
- `meas.spin` — `"measured"` / `"estimated"`, off the ball answer above. A carry built on an
  estimated spin is a model on a model and the row says so.
- `meas.how` — the one-line description that renders under the row.

Render (`ladderCard()`), at phone width:

```
 DRIVER   ████████████████████░░░░░░░░   241   ·
          MEASURED 20 SEP · n=14 · ±9 · venue ball
 MINI     ███████████████░░░░░░░░░░░░░   228   13
          MEASURED 20 SEP · n=11 · ±7 · venue ball
 2-IRON   ██████████████░░░░░░░░░░░░░░   205   23
          ESTIMATED — never measured
 5-WOOD   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░    —    ·
          unmeasured
```

- The per-row badge replaces the whole-ladder "Estimated · not calibrated" banner as soon
  as **any** row is measured; the banner stays while none is. Mixed is the normal state for
  months, and a banner that says everything is estimated over a row that isn't is worse
  than no banner.
- `clubPill()` keeps working untouched: `UNMEASURED` is still a null carry, `OVERLAP` is
  still loft arithmetic. But the moment two measured carries exist, **an overlap can be
  stated in yards instead of degrees** — which is what actually answers the mini-driver vs
  2-iron question the bag currently flags on loft alone. Small addition to `ladderOverlap()`'s
  rendering, not to its rule: if both rows carry `meas`, print "and they carry within 4
  yards of each other" or "and they are 17 yards apart — the flag is loft, not distance."
- **The wedge matrix fills from the same session.** `syncWedgeCarries()` already keeps the
  full-swing column and the ladder in step; the half and three-quarter columns are six
  empty boxes that a single bay session answers. Those go in by hand or by a new
  `matrix-update` entry — see the checklist.

**What must not happen:** a bay carry silently overwriting a number Jack typed. `carry-update`
is an `Object.assign` and will overwrite. That is correct for a coached number and wrong for
his own calibration, so the rule is the same one `coursePR()` follows — **if he has typed a
carry, the push names both**: it sets `meas` and leaves `carry` alone unless he says
otherwise, and the row renders "you have 230 · the bay says 241 (n=14)". One question at the
next session settles it; a silent overwrite never gets noticed.

### 6.2 Phase 2 — bay sessions in the labs

New state, new feed types, film-shaped so the renderers are siblings rather than forks:

```js
S.bays = [];   // migrate(): if(!s.bays) s.bays = [];
```

```json
{ "type": "bay", "id": "bay-20260920-gl18",
  "src": "tm:2026-09-20-gl18-fairfield",
  "bay": {
    "date": "2026-09-20",
    "venue": "Golf Lounge 18 · Fairfield", "unit": "TM4", "mode": "Range practice",
    "ball": "venue premium", "norm": "77°F · sea level",
    "discipline": "swing",
    "setup": "38 shots · driver, mini, 2i, 5w · warm-up excluded",
    "finding": "…the paragraphs…",
    "detail": {
      "gist": "Driver is 241 with the regular shaft and the spin is fine; the mini is 228.",
      "clubs": [
        { "club": "driver", "n": 14, "cs": 103.5, "bs": 151.2, "smash": 1.46,
          "la": 12.8, "spin": 2760, "carry": 241, "sd": 9, "total": 262,
          "path": 2.1, "face": 3.4, "ftp": 1.3, "aoa": -1.2, "side": "R 6" }
      ],
      "metrics": [ { "k": "Attack angle", "v": "-1.2°", "s": "warn", "n": "target +2 to +4 with a driver" } ],
      "story": "…",
      "limits": "Mat, still air, normalized to 77°F at sea level. Carry is modelled from measured launch."
    } } }
```

`bay-update` and `bay-remove` mirror `session-update` / `session-remove` exactly, including
the `date` patch route (the lesson from Sep 9 2026: a capture's date is a fact like any
other and needs a route in).

- `detail.clubs[]` is the machine-readable half — one row per club, keys matching the
  carry ladder's club keys (`clubKey()`), so the ladder, the bag and a bay row all join on
  the same name.
- `detail.metrics[]` is the human half, the same `{k,v,s,n}` shape a film session uses, so
  `sessionView()`'s renderer works with no changes.
- **Every session needs a `gist`** — same rule as film, same reason: the lab list is a
  scannable log, not a reading list.

Renders in each lab, under **"The bay · measured numbers"**, directly beneath the film room:

```
 THE BAY · MEASURED NUMBERS
 ┌──────────────────────────────────────┐
 │ 20 Sep 2026        38 shots · TM4 ▸  │
 │ Driver is 241 with the regular shaft │
 │ and the spin is fine; mini is 228.   │
 ├──────────────────────────────────────┤
 │ 12 Sep 2026        24 shots · TM4 ▸  │
 │ Attack angle −1.2° with the driver — │
 │ the tee shot is being hit down on.   │
 └──────────────────────────────────────┘
 Tap a session for every number it produced.
```

And a **club table** inside the session view, which is the thing a screenshot can't give
him searchably:

```
 CLUB      n    CARRY  ±    BALL   SPIN   LAUNCH  PATH  FACE
 Driver    14   241    9    151.2  2760   12.8°   +2.1  +3.4
 Mini      11   228    7    145.0  3310   13.9°   +1.4  +2.0
 2-iron     7   206    11   138.6  4190   14.2°   +0.9  +1.1
```

### 6.3 Phase 3 — putting, and the grid that has been waiting for it

The putting evolution grid is already built to take this: it is **one column per batch of
film**, with `—` meaning "this batch could not answer this row" and a row of `?` meaning
"nothing has ever measured this". A bay putting session is a new column, and it is the
first column in the project's history that can fill **Face at impact** and **Strike
location** on the same batch.

Two things to build:

1. **`evolution` gains a `discipline`**, scoped exactly like `faults` — `putting` by
   default so every existing entry keeps working, `swing` for a second grid. Without this
   there can only ever be one grid in the app, and a swing grid is the natural home for
   attack angle / path / face-to-path over sessions. Four lines in `applyFeed()`, one
   argument on `evolutionCard(disc)`.
2. **The column label rule holds**: labels render in 34px columns, so `TM 20 Sep`, and the
   batch description goes in `notes[]`.

The grid after one bay putting session (mock):

```
                         Jul 30   Aug 10   Aug 10   TM
                                  pm       mat      20 Sep
 Path            Settled    ✓        ✓        —       ✓
 Tempo           Quick…     ✓        ✓        —       ✓
 Face at impact  Open?      ✗        —        —       ✓
 Strike location Never m.   ?        ?        ?       ✓
 Pace / distance The open…  ?        ✗        ~       ~
```

**What a bay putting session cannot do**, and the plan says it here so nobody discovers it
by being surprised: it is an indoor mat with a modelled break. It measures the *stroke*
superbly — face, path, speed, skid, roll — and it does not measure *green reading* or how
his pace travels on a real surface. The open fault (distance control) stays open on this
evidence; what closes is whether the face is square, which is a different fault and the one
the whole putter saga hangs on.

### 6.4 Phase 4 — simulator rounds, quarantined

Stored as ordinary rounds carrying **`sim:true`** plus `venue`, and blocked at the three
gates in Guard 1. They earn their place because 400 courses in a bay in February is real
practice and the *shot* data is real — but they are a different game and the app says so
everywhere they appear:

- Rounds list: a **`SIM`** badge beside the existing `LIVE` badge.
- The round card renders normally (it is a legitimate hole-by-hole card) with a standing
  line under the header: *"Played indoors at Golf Lounge 18. Not eligible for a handicap
  differential, and not counted in the numbers on Today or in Coach — a mat is not turf and
  the greens were software."*
- **Putting data from a sim round is dropped on the way in**, not rendered and hidden —
  `putts` counted for the score, `pm`/`gimme` never set. See Guard 2.
- Fairways and greens **are** kept on the card, because he genuinely hit those shots, and
  they are visible on the card only.

**BUILT ANYWAY, and the reasoning is worth keeping** (Jack, Sep 11 2026: *"U still have more
phases? Why are u waiting"*). The draft above recommended holding phase 4 unless he plays sim
rounds often. That was the wrong test: the quarantine IS the feature, every guard is a no-op
while there are no sim cards, and building it later would mean writing the rules under
pressure from data already sitting in the app. The same argument retired the other reason for
waiting — that a swing grid needs sessions first. Machinery ahead of data; nothing renders
until there is something to render.

### 6.5 Phase 5 — the Combine as a benchmark

The Combine is 60 shots to nine targets plus driver, scored 0–100 with percentile rankings
per yardage. It is the only thing Trackman produces that is **directly comparable against
itself over time** — which is exactly what `S.tests` is for on the putting side (10-ball
tests, a make count, and nothing else).

Cheapest honest version: a `combine` feed type storing `{date, venue, score, targets:[{yds,
score, avgDist}], note}`, rendering as a small table in the Swing lab with a trend line once
there are three. No new concepts, and it gives the app its first repeatable full-swing
benchmark. The one rule from `drillLog`'s trend applies: **three results before a line is
drawn** — two points are a line through anything.

---

## 7. What it changes elsewhere, once the numbers exist

These are joins, not new features, and each one is the reason to do the work above:

- **Round prep gets real yardages.** Every standing plan currently reads off the 2-iron's
  205 and the 5-iron's 180 because those are the only figures left at the long end. Measured
  carries make the tee-shot calls on Wianno, Pound Ridge, Lakeside and Sterling Farms
  defensible instead of arithmetic on an estimate.
- **`playsFactor()` starts meaning something.** It adjusts a stored carry for today's air —
  which is only useful if the stored carry has a known baseline. A normalized 77°F/sea-level
  Trackman number is that baseline, for the first time.
- **The driver shaft question gets an answer.** The Project X LZ 5.5 regular went in Jun 2
  2026 on Jack's read (*"~15 yds longer, much less curve, misses both ways"*) and has never
  been measured. Spin, launch and face-to-path across 15 drives is the measurement.
- **Two open swing faults get a number or get closed.** The path faults were read off seven
  phone stills from one clip; club path and face-to-path are measured on every shot.
- **The bag's four unknown build facts stay unknown.** Trackman cannot read a sleeve setting,
  a shaft band or a playing length. Worth saying because a pile of new numbers makes it feel
  like everything got measured: **loft setting, length, shaft weight and torque are still
  read off the club with a wrench and a tape**, and they are still open.
- **A new `where` for the drill bench.** `KIT`/`where` currently run `home · green · range ·
  bunker · course`. A bay is none of them — it is a range with instant feedback and a clock
  running. Adding **`bay`** lets drills that need a launch monitor (gapping ladders, spin
  windows, start-line gates with a number attached) be filtered to the session he has
  actually booked, which is what the bench's whole filter exists for.

---

## 8. The bay capture protocol — what Jack does on the first visit

This is the Trackman twin of the film capture protocol, and it is worth more than any single
session, for the same reason: it is the difference between the next session answering the
question and failing the same way again.

**Before hitting a ball**

1. **Log in.** Scan the QR on the bay screen with the Trackman Golf app. No login, no data —
   this is the one unrecoverable mistake.
2. **Set normalization to 70°F and sea level, and photograph the settings screen.** 70, not
   Trackman's 77 default — that is the baseline `playsFactor()` already assumes, and matching
   it makes every "plays like" number on the phone exact instead of a couple of yards long.
3. **The ball.** The lounge's are plain and unmarked, which means spin is being *estimated*
   rather than measured (§1). Two options, in order: bring his own gamer balls with a **metal
   sticker dot** on each, or a sleeve of **Titleist Pro V1 RCT** (no sticker, no orienting).
   Either way, **write down which ball every session used** — that one word decides whether
   the session's carries are worth putting on the ladder or only worth comparing to each
   other.
4. **Warm up first, and know where the warm-up ends.** Trackman's own Map My Bag has a no-data
   warm-up mode. A cold 7-iron in a club average is a lie that is impossible to find later.

**For a gapping session (phase 1 — do this one first)**

5. **Six shots per club minimum, ten or more if there is time.** Trackman's floor is 6; its
   rolling average is 30.
6. **Do not delete the bad ones.** A ladder built on his best strikes is the classic gapping
   error and it puts him a club short on every approach. Keep the whole set; the app stores the
   average *and* the spread, and the spread is the more useful number.
7. **Order: driver → mini → 2-iron → 5-wood → 5i → 7i → 9i → PW → 50 → 56 → 60.** The four blank
   or estimated rows come first while he is fresh, because those are the ones the app cannot do
   anything about today.
8. **The wedge matrix in the same session if there is time**: 50/56/60 at half, three-quarter
   and full. Six of those nine numbers have never been measured.

**What to send afterwards**

9. The **club summary table** — a screenshot per club or one of the whole session. Club, shots,
   ball speed, launch, spin, carry, total, side.
10. The **settings shot** from step 2, and which ball.
11. One line saying what he was working on and anything the numbers wouldn't know ("mat felt
    fast", "first session with the new grip").

That is enough for a complete push. Anything he doesn't send is simply absent — which is fine
and is the app's normal failure mode — but a number sent without its settings is worse than a
missing one, because it reads as current.

---

## 9. The four questions — answered 2026-09-11, and what is left

**1. Putting analysis — *probably yes, never used.*** Jack's read, not the venue's confirmation.
It needs no marked ball, so if it is there it is the cheapest real measurement available to him
and **phase 3 jumps the queue**: one 20-putt session re-measures face angle at impact, which has
been measured exactly once (Jul 30) and is the number the whole putter saga rests on. Still to
confirm: that the mode is actually on that bay's TPS. *One look at the practice menu.*

**2. The ball — *plain unmarked white venue balls.*** Answered, and it is the answer with
consequences: spin is being estimated rather than measured, so a carry off it is a model built
partly on a modelled input, on a range ball rather than his. **Fix: his own balls with a metal
dot, or Pro V1 RCT.** Until then bay carries fill blank ladder rows and never overwrite a number
he typed. Still to confirm: *that the lounge lets him hit his own ball* — normal in a bay, worth
one question.

**3. The emailed report — *unknown.*** He does not know what they send. Ask for it by name:
**"a TPS Shot Analysis report, emailed to my Trackman account address."** If they will, ingestion
stops depending on screenshots. If they won't, nothing in this plan changes — route A was always
the design.

**4. The settings — *his to set.*** Then the standing instruction is **normalization ON, 70°F,
sea level**, every session, because that is the baseline `app.js` already assumes. Set it once,
photograph it once, and every carry on the ladder is directly comparable to every other.

And the one for Jack rather than the venue, still open: **how often is he actually going?**
Weekly through the winter justifies phases 4 and 5; once a month says do phases 1–3 properly and
stop there.

---

## 10. Build checklist

**Phase 1 — the ladder (small, high value)**

- [x] `meas` on a carry row: `{src, n, sd, date, ball, norm, spin, how}`; `carry-update`
      passes it through (already an `Object.assign`, so nothing to change in `applyFeed()`).
- [x] A provisional row — venue ball, estimated spin — **fills a blank and never overwrites a
      typed carry**; it renders both numbers until he picks.
- [x] `ladderCard()`: per-row MEASURED / ESTIMATED / unmeasured badge; whole-ladder banner
      only while nothing is measured.
- [x] `ladderOverlap()` rendering: state the gap in **yards** where both rows are measured.
- [x] Bag → the ladder's gold note gains one sentence on where a measured number came from.
- [x] `updateLine()` case so a measured carry announces itself properly in What's landed.

**Phase 2 — bay sessions**

- [x] `S.bays` + `migrate()`; `bay` / `bay-update` / `bay-remove` in `applyFeed()`, mirroring
      the session trio including the `date` patch.
- [x] `bayLog()` — sibling of `sessionLog()`, own heading, `BAY` chip, newest first.
- [x] `bayView()` — reuses the `detail.metrics` renderer, adds the club table.
- [x] `EV_RANK`/`EV_LAB`/`EV_SOURCE`/`EV_BLIND` gain `bay`; `UP_TYPE` gains `bay`.
- [x] Discipline routing — a bay session declares its own, so there is nothing to infer.
- [ ] (open, needs a session) `FAULT_EV` rows for any fault a bay session becomes the basis of.

**Phase 3 — putting / the grid**

- [x] `discipline` on `evolution` (default `putting`), `evolutionCard(disc)` — grids live in `S.grids`.
- [ ] (open) A swing grid seeded from the first two bay sessions — needs sessions.

**Phase 4 — sim rounds**

- [x] `sim:true` + `venue` on a round; `SIM` badge in the rounds list.
- [x] Hard exclusions, through one door — `realRounds()`, read by `roundDiff()`, `withHoles()`, `indexBasis()`, `courseRounds()` and the rest.
- [x] Putting fields stripped on ingest.
- [x] The standing caveat line on the round card.

**Phase 5 — Combine**

- [x] `combine` feed type + a table in the Swing lab; trend at three results.

**Every phase**

- [ ] `node --check app.js` · `python3 -c "import json; json.load(open('coach-feed.json'))"`
- [ ] Browser pass at **320 and 390** for any row or table added — the club table in §6.2 is
      nine columns and is a `.tscroll` candidate from the start.
- [ ] Bump `BUILD` + `CACHE`, add a `RELEASES` block, update CLAUDE.md in the same commit.

---

## 11. Paper trail

**Researched — venue and hardware**
- Golf Lounge 18: TM4 dual-radar bays, CT locations (Canton, Danbury, Fairfield, Orange,
  South Windsor; Stamford announced), lessons and leagues — golflounge18.com and CT visitor
  listings, Sep 2026.

**Researched — what the account holds and how shots get into it**
- QR / PIN / email quick login links a bay to a Trackman account; shots, rounds and club data
  save to the profile and appear under Activities — Trackman Help Center, *Golf App | How To Use
  Quick Login/QR Code To Sign Into TPS*.
- App Activities: range, simulator and practice sessions; virtual golf stats (driving distance,
  fairways, GIR); shot-by-shot replay; Trackman handicap — Trackman Golf app listing and help
  centre, *Golf App | Overview of Activities*.
- Map My Bag: 6 shots minimum, 30 recommended, rolling 30-shot average per club — trackman.com
  blog, *Know your numbers: introducing Map My Bag in TPS 10.1*.

**Researched — export**
- No consumer export (no CSV, no PDF); mytrackman.com is a viewer; CSV exists for TPS owners via
  Shot Analysis — SwingSync and ShotMetrics write-ups, Sep 2026. *Secondary sources, consistent
  with each other and with Trackman's own help centre saying nothing about player export.*
- TPS can send Shot Analysis reports and screencasts to a player's email and auto-share them into
  the portal; requires a valid software subscription on the unit — Trackman Help Center,
  *Shot Analysis | How To Send Reports & Screencasts* and *Automatic Report Sharing*.
- Cloud GraphQL API / Range REST API exist but require signed Data API terms and facility
  credentials — Trackman Help Center integration pages.

**Researched — measurement**
- Parameter definitions (club speed, attack angle, club path, face angle, dynamic loft, spin loft,
  smash factor, and the rest) — trackman.com, *40+ Trackman Parameters Explained*, and the help
  centre's data parameter definitions.
- Normalization: actual trajectory vs calm conditions at a chosen altitude/temperature, default
  77°F and sea level — trackman.com, *Understanding Trackman's Golf Normalization Feature*.
- Indoors the radar captures only part of the trajectory; ~8–10 ft of ball flight is the working
  minimum — Trackman help centre, *TM4 | Understanding Trackman 4 Unit Data: Indoors vs Outdoors*,
  plus review coverage. **Carry indoors is therefore modelled from measured launch.**
- TM4 putting: face angle, path, launch direction, ball speed, skid distance, roll speed, roll %,
  and club data for putting (~30 parameters) — Trackman help centre, *Practice | Putting Analysis*
  and *Parameters | Face to Path (Putting)*; trackman.com, *Introducing Club Data for Putting*;
  PARennial Golf's summary. **No ball marking is named as a requirement** in any of them.
- Indoor spin needs roughly two ball revolutions inside the tracked window; where it cannot get
  them TrackMan estimates the spin rate. Trackman's remedy is the **Titleist Pro V1 RCT** ball
  (radar-reflective marker under the cover, no orientation needed) or a **metal sticker dot** on
  a normal ball — Trackman help centre, *TM4 | Supported Golf Balls for TM4* and *TM4 | Titleist
  RCT Ball*; Titleist/MyGolfSpy coverage of RCT; simulator-forum practitioner reports for the
  indoor distances at which spin becomes measurable. *The claim that impact location indoors
  also depends on a marked ball comes from a single secondary source and is flagged unconfirmed
  in §1.*
- Combine: 60 shots, three at a time to nine targets plus driver, twice; 0–100 score with
  percentile rankings per yardage — Trackman Combine brochure and coaching write-ups.
- There is published work on TM4's within- and between-session reliability indoors (*Journal of
  Sports Sciences*, 2024). **Not read for this draft.** Worth reading before a single session is
  ever treated as a baseline — it speaks directly to how many shots a club average needs.

**Card / app facts** (from this repo, not researched)
- The ladder's four blank-or-estimated rows, the wedge matrix's six empty cells, the evolution
  grid's `?` rows, the driver shaft change of Jun 2 2026 and the four unknown build facts are all
  as recorded in CLAUDE.md and `app.js` on 2026-09-11.

**Inference, flagged as such**
- That a bay carry runs longer than a grass carry is **standard practice, not measured about
  Jack** — it is the reason the ladder note has to name the source, and the on-course cards
  remain the check.
- That Fairfield or Stamford is his nearest lounge is a guess off the courses on his list.
