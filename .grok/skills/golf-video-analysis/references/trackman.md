# TrackMan screen recordings

Jack scrolls a club's table. Pause and transcribe. Do not guess.

## Column order (as the video allows)

1. Club + n at the top (screen n still has tops in it).
2. **Carry** — RED. The number we analyze.
3. **Total** — not red. Landing, not the club.
4. Carry side, curve, apex / height.
5. Club mph, ball mph, smash, launch, spin, attack, path, face, face-to-path.

Match rows across scrolls by **shot #** and by **side/curve**. Sep 18 7-iron
carries landed later; side/curve already on file lined up 1:1.

## Batches

Same day, different swing thought = **two groups**. Label after-slot
`3 wood · after slot`. Do not mix into the first-block average.

## Mishits (range only)

`isClearMishit` in `app.js`: two-thirds of the cluster that already got up
(carry ≥ half the raw median), or `mishit: true`.

- 5-wood 112 yards / 8′ apex = mishit. Out.
- Fat 9-iron at 70% of the mean = keep.
- On-course rounds: do not cut shots this way.

## After the table

Hand the shot list to `/golf-number-crunch`. Remaining average + best 5
carry + the group the sequence made (window vs baseline). Gist and
finding must not still quote the raw screen n or a 150 that had tops
in it. Live ladder stays blank unless Jack says otherwise.

A remembered split (“shot 3 or 4”) is a hypothesis. The crunch skill
runs the scan. Sep 18 7-iron was a window. Sep 18 3-wood after-slot
was a baseline. Do not copy one name onto the other.
