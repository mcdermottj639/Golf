---
name: golf-video-analysis
description: >
  Transcribe and analyze Jack McDermott's golf videos for Caddie HQ — TrackMan
  screen recordings (shot tables) and swing / putting film. Use whenever he
  sends a video, screen recording, TrackMan table, sim session, swing clip,
  DTL, face-on, or asks to read carries. Slash command: /golf-video-analysis.
when-to-use: >
  golf video, trackman, screen recording, sim stats, carry table, swing film,
  down-the-line, face-on, slot, trail hand, 3-wood, range session, analyze this
  clip, transcribe shots
user-invocable: true
argument-hint: "[video or table]"
metadata:
  author: Caddie HQ
  short-description: Read Jack's golf videos — TrackMan tables and swing film. Red = look here.
---

# Golf video analysis

A Grok skill stored in this repo. It does **not** add a page to the PWA.
When Jack sends a video, follow this file. Depth: `references/trackman.md`,
`references/swing-film.md`.

**Red is the decoder.** Every readout Jack sees must make the thing to look
at impossible to miss. Carry, mishits, the slot — those go in **red**. Total
distance, setup chatter, and path-without-carry do not.

**After the table is transcribed, load `/golf-number-crunch`.** This skill
reads. That skill decides remaining, premier, and whether the sequence is
a window or a baseline. Do not average here.

---

## Which video is this?

| Kind | Looks like | Do |
|---|---|---|
| TrackMan screen | Scrolling shot table, AVG CARRY, club chip | Transcribe. See `references/trackman.md`. |
| Swing film | Body, club, phone slo-mo | Positions. See `references/swing-film.md`. |
| Both in one drop | Table then a swing, or two files | Two readouts. Do not mix. |

If you cannot read a column, **say so and ask for a reshoot**. Do not invent a number.

---

## Output Jack sees (always this shape)

Lead with a **RED** block, then the rest. Do not bury carry in a paragraph.

```
RED — look here
• CARRY  176.5  n=9 remaining
• BEST 5 191.0  (still carry)
• SLOT    trail arm in-and-down  (swing film only)

Not red
• Total 211.0
• Path −6.1° · face-to-path +1.9°
```

Then one sentence of what it means. Then run `/golf-number-crunch` on the
shot list before grouping or writing a `bay-update`. Never park a bay
average on the live ladder.

If a frame can be marked up, draw **only** the red items (carry column box,
shaft plane, trail-arm slot). Three marks max. Readable at phone size.

---

## Standing rules (Caddie HQ)

- Jack's words = feel. Film / radar = real. Film wins on positions.
- One `session` or one `bay` **per day**. Later clips that day are updates.
- Check the film room / that day's bay **before** writing a new entry.
- First block and after-slot stay split. Never one average.
- Range mishits are out of the live record (`isClearMishit`: two-thirds of
  the cluster that got up, or `mishit: true`). On-course rounds keep every shot.
- Best 5 is the longest 5 **carries**, not a total, not a bag number.
- Follow `CLAUDE.md`. Bump `BUILD` if you change the app.

---

## Done when

- Every readable shot is transcribed or an off-screen column is named.
- RED block is the first thing Jack reads.
- App write (if any) matches remaining shots, not the raw screen n.
