---
name: golf-number-crunch
description: >
  Turn Jack McDermott's raw TrackMan / sim / range numbers into remaining
  averages, premier (best 5 / best 3), number-picked groups (window vs
  baseline), and a red readout. Use after a table is transcribed, when he
  pastes carries, asks what moved, what to cut, or how to group a session.
  Slash command: /golf-number-crunch.
when-to-use: >
  crunch numbers, remaining average, best 5, best 3, premier, mishit, top,
  worm, split, window, baseline, after slot, before and after, what moved,
  carry vs total, face-to-path, path, smash, group these shots, relevance,
  sort the table, visualize the bay, 7-iron window, 3-wood after slot
user-invocable: true
argument-hint: "[shots or club table]"
metadata:
  author: Caddie HQ
  short-description: Raw TrackMan → remaining, premier, windows vs baselines. Numbers pick the split.
---

# Golf number crunch

A Grok skill stored in this repo. It does **not** add a page to the PWA.

**Video skill transcribes. This skill decides what the numbers mean.**
After `/golf-video-analysis` has a shot list — or Jack pastes a table —
run this file before you group, average, or write a `bay-update`.

Depth: `references/pipeline.md`, `mishits.md`, `grouping.md`, `premier.md`,
`delivery.md`, `visualize.md`, `worked.md`.

**Red is the decoder.** Carry remaining, best-N carry, the group the
sequence actually made, mishit *count* (not the worm yards). Total,
setup chatter, and a remembered split are not red.

---

## Do this, in order

1. **Ingest** the shot list. One club, shot # order. Do not invent a
   missing carry. Off-screen = say so.
2. **Mishits out** of the live record (`references/mishits.md`). Range
   only. On-course keeps every shot.
3. **Broad remaining** mean of what is left. That is the average.
4. **Premier** = longest 5 remaining carries (3 if 3–4 left). Still
   carry. `references/premier.md`.
5. **Group from the sequence**, not from Jack's memory of when the
   thought started. `references/grouping.md`. Window ≠ baseline.
6. **What moved** — carry, face-to-path, path, smash, each compared to
   that club's other group the same day. `references/delivery.md`.
7. **Show it** in the shape below. `references/visualize.md`.
8. **Write the app** only if it belongs: append-only `bay-update`,
   remaining n in the gist, groups named for what they *are*.

If a step would mix two swing thoughts into one average, **stop**.

---

## Output Jack sees (always this shape)

```
RED — look here
• CARRY   188.4  n=7 remaining
• BEST 5  192.7  (still carry)
• GROUP   3-wood · after slot   ← baseline, it held
          not a window

Not red
• Total 218.2
• Path −2.0° · face-to-path +1.4° · smash 1.47
```

Then **one sentence** of what moved. Then the groups as a table
(open / run / rest, or first / after-slot) — remaining n, carry, best 5,
F–P, path. Then, if writing the app, the feed entry.

Worked cases: `references/worked.md` (3-wood held; 7-iron was a window).

---

## Standing rules (Caddie HQ)

- Jack's words = feel. Radar = the number. **Numbers pick the split.**
  A remembered “shot 3 or 4” is a hypothesis. Run the split scan.
- One `bay` per day. Later clips that day are `bay-update`.
- First block and a later thought stay split. Never one average.
- Range mishits are gone (`isClearMishit` in `app.js`, copied in
  `mishits.md`). Do not print the worm yards in the app or the gist.
- Best 5 is carry, not total, not a bag number, not the live ladder.
- Face ≈ path + face-to-path. If both exist and face is missing, fill it.
- Round carry/total/path/F–P to 0.1, smash to 0.01, spin to 0.
- Follow `CLAUDE.md`. Bump `BUILD` if you change the app.

---

## Done when

- Every remaining shot is in exactly one named group.
- RED block is the first thing Jack reads, and it is carry + group.
- Gist / finding / setup quote **remaining n**, not the raw screen n.
- The split is the one the sequence made, with a one-line reason.
