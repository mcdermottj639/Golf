# Historical rewrite snapshots

The live PWA loads `coach-feed.json`, `front9-feed.json`, `path-feed.json`, then
`corrections-20260922.json`. It does not load this folder.

The v153 source audit found conflicts between the original Sep22 videos and older
transcripts. Do not use a snapshot as independent corroboration of a copied number.

- `range-2026-09-22.json` and the Sep22 entry in `sessions.json` now reflect the
  verified 7-iron16 / 5-iron17 source shots.
- `hazeltine-2026-09-22.json` is explicitly **superseded**; the corrected live record
  is `../hazeltine-verified-2026-09-22.json` (80, front41 / back39).
- `vg3-5i-afternoon.json` is an unverified historical transcript, **not an additional
  session**. It must not enter current averages.
- The old Spyglass snapshot is superseded wherever the v153 source audit corrects
  or flags a field. Use the original-video evidence and targeted correction.

Original filenames, hashes, timestamped transcripts, and the replaced range record
are preserved under `../evidence/`. Range means exclude clear mishits; simulator
rounds remain separate from outdoor statistics and range means.
