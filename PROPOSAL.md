# Caddie HQ — App Proposal

**One home for Jack's golf game: the bag, the stroke, the practice, and every equipment decision — live, on your phone, always current.**

*Workshopped July 18, 2026 · awaiting Jack's approval before build.*

---

## The problem it solves

Right now your golf brain lives in scattered Drive artifacts — a putting journey HTML, a wedge spec sheet, a putter top-10 PNG. They're great snapshots, but they're **frozen**: you can't log a practice session from the green, tick off a demo, or see whether the left miss is actually drying up over time. Each update means regenerating a document.

Caddie HQ turns those snapshots into a **living app**: seeded with everything already in your Drive folder, editable from your phone, and tracking trends the documents never could.

## Concepts considered

| Option | What it is | Verdict |
|---|---|---|
| **A. Bag Tracker** | Pure equipment inventory + specs | Too thin — solves the smallest part of your problem |
| **B. Shot/Round stat tracker** | Arccos-style round logging | Crowded market, heavy data entry, ignores your real active project (the putting fix) |
| **C. Caddie HQ** ✅ | Bag + specs + putting lab + practice log + decision tracker in one focused app | **Recommended** — it's exactly the workflow you're already doing manually |

## Recommended: Caddie HQ — four modules

### 1 · Dashboard
The "where things stand" screen you open first.
- **Return-window countdown** for the Phantom 7.5 (and any future purchase) — days remaining, big and unmissable
- Current focus card (right now: early lift + 2:1 tempo)
- The scoreboard: **5-footer makes /20** trendline — the single number that says whether the changes are working
- Open action items (demo zero-torque at 34", book fitting, nose-drop test…)

### 2 · My Bag
Every club, every spec, every change — with the *why* preserved.
- Club cards: loft, lie, shaft, flex, grind, bounce, length, grip, date in bag
- **Wedge gapping ladder** (your 44° PW → 50 → 56 → 60 with the 6/6/4 spread visualized)
- Change history: what was swapped, when, and the reasoning (e.g. "56: 8M → 10S because you hit it mostly full and square")
- Mismatch flags: the app knows your stroke is SBST and flags arc-suited putters in the bag
- Wishlist / on-the-radar shelf

### 3 · Putting Lab
Your putting journey, but alive.
- **Session log**: date, angle filmed, reps, findings — Sessions 1–3 pre-loaded
- **5-ft make tracker**: quick-tap 20-ball entry from the practice green, miss direction on each miss (L / R / short / long) → miss-pattern chart over time
- **Drill library**: One-Two tempo drill, low-follow-through gate — with rep logging and streaks
- Diagnosis card: the two-lever left-miss theory, updated as evidence comes in
- Filming guide checklist baked in

### 4 · Decisions
Where equipment calls get made with data instead of vibes.
- **Demo comparator**: run the 10-ball 5-footer test on any putter vs. your 7.5 control, side-by-side results
- The zero-torque top-10 shortlist, checkable as you demo each one
- Deadline tracking so a return window never lapses while you're deciding

## Phase plan

- **Phase 1 (MVP, the approval ask)**: all four modules above, seeded with your real data from the Drive folder
- **Phase 2**: light round logging (score, putts, up-and-downs — 60-second entry, not Arccos), wedge carry-distance calibration, trend charts across months
- **Phase 3**: course log & rankings (import your course rating spreadsheet), "AI caddie" loop — you film a session, I analyze it and push the log entry to the app

## Tech approach

- **Static PWA** — plain HTML/CSS/JS, no backend, no accounts, no cost
- Hosted free on **GitHub Pages** from this repo; installable to your phone home screen and works offline (practice greens have bad signal)
- Data lives in **localStorage** with one-tap **JSON export/import** for backup — your data never leaves your device
- Same dark-green + gold design language as your existing artifacts

## Open questions for Jack

1. Approve Phase 1 as scoped, or add light round logging to the MVP?
2. Name: **Caddie HQ** — or something else?
3. Anything in the current bag beyond the irons/wedges/putters I should seed (driver, woods, hybrids, ball)?
