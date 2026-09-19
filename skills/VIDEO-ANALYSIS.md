# Video analysis skill

Stored in the app as **Video skill** (red ink). This file is the agent copy of
the same skill so a future session can transcribe Jack's golf videos the same
way. Do not invent a second protocol.

**Red in the app is the decoder.** If a mark is red, that is the thing to look
at. Green is remaining carry. Gold is total. Do not paint Best 5 gold.

---

## Two kinds of video Jack sends

### 1. TrackMan screen recordings (tables, not swings)

He scrolls a club's shot list. Transcribe **every remaining row**. Do not guess
a carry from a path. If the carry column is off-screen, say so and leave it
blank — then ask him to reshoot that column.

**Read in this order, left to right as the video allows:**

1. **Club + n** at the top (3 wood · 11). That n is the screen n, tops still in.
2. **Carry** (red) — the number we analyze. Not Total.
3. **Total** (gold) — landing, not the club.
4. Carry side, curve, apex / height.
5. Club mph, ball mph, smash, launch, spin, attack, path, face, face-to-path.

**Match rows across scrolls by shot # and by side/curve.** The Sep 18 7-iron
carry column landed later; side/curve already on file lined up 1:1.

**Batches on the same day stay split.** First block vs after-slot (trail hand
in-and-down) are two groups, never one average. Label the after-slot group
`3 wood · after slot`.

**Range mishits are out of the live record.** `isClearMishit`: two-thirds of the
cluster that already got up (carry ≥ half the raw median), or `mishit: true`.
A 5-wood at 112 yards with 8′ of apex is a mishit. A fat 9-iron at 70% is not.
On-course rounds keep every shot.

**Best 5 is carry** of the longest 5 remaining (best 3 if the batch is short).
It is not a total and it is not a bag number.

**Never park a bay average on the live ladder.** Offer only.

### 2. Swing film (body, not the radar)

Angles, in this order when he can:

1. **Down-the-line** — camera on the target line, hand/hip height. Plane, path,
   shaft at the top, **trail elbow in-and-down (the slot)**.
2. **Face-on** — chest height, square. Posture, weight, hip clearance, low point.
3. Optional overhead for putting only.

Slo-mo 240fps when the phone will do it. Three swings per angle. One `session`
entry per day — later clips that day are `session-update`, not a second session.
Check the film room before writing a new one.

**Red on swing film means:** shaft plane, trail-arm slot, target line. Do not
red-mark every joint. Three marks, readable at phone size.

Jack's words are feel; the film is real. Where they disagree, the film wins and
the card says so.

---

## How it lands in the app

- TrackMan numbers → `bay` / `bay-update` with `rangeShots` per club per block.
- Swing findings → `session` / `session-update` in the matching lab.
- This skill's on-screen home is **Swing Lab → Video skill** (`videoskill` view).
  Red diagrams live there so Jack can read the same protocol the agent uses.

Update this file and `VIDEO_SKILL` in `app.js` together. Bump `BUILD`.
