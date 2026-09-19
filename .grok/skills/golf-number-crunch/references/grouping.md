# Grouping — numbers pick the split

Jack will remember a thought (“halfway through I dropped the trail
hand”, “could’ve been 3 or 4”). That is a **hypothesis**. It is not a
group. Run this file. Name the groups after what the sequence *did*.

Same day, different swing thought is allowed to be two groups. Mixing
them into one average is not.

## Split scan (always run)

Remaining shots only, in hit order. For each candidate cut `k`
(last shot of the left group):

```
B = remaining with shot <= k
A = remaining with shot > k
skip if len(B) < 1 or len(A) < 3
dCarry = mean(A.carry) - mean(B.carry)
dFTP   = mean(A.ftp)   - mean(B.ftp)
dPath  = mean(A.path)  - mean(B.path)
dSmash = mean(A.smash) - mean(B.smash)
```

Read the table. A huge `dCarry` with `len(B) == 1 or 2` is **two cold
openers**, not a new swing. Do not promote it to a baseline.

## Window vs baseline

A **baseline** (the 3-wood after-slot):

- After k, the rest of the session **holds** — rolling last-5 stay near
  the after mean.
- Path / F–P that moved, stay moved.
- After n ≥ 5 remaining.
- Name: `{club} · after slot` (or whatever the thought was). First
  block keeps its own row.

A **window** (the 7-iron later block):

- A consecutive remaining run whose carry band is tight (≤ ~15 yd) and
  whose F–P / smash is quieter than the shots around it.
- Then the session **reverts**: F–P comes back, band opens, floor
  drops. Ceiling may even go *up* — that is scatter, not a new club.
- Name three rows: `{club} · open` / `{club} · window` / `{club} · rest`.
- Do **not** call it after-slot. After-slot means it held.

A **single group** when neither test fires. Leave it as `{club}`.

## Rolling last-5 (how you see a window)

On remaining shots, running mean of the last 5 carries, F–P, path,
smash. A window is a plateau. A baseline is a step that does not walk
back. A remembered shot number with no plateau and no step is nothing.

## What not to do

- Do not split on the remembered shot if the scan’s only big delta is
  n=2 vs the world.
- Do not average a window with the rest “because it was the same club.”
- Do not average first-block 7-iron with later-block 7-iron. Different
  balls, different rows.
- Do not put 3-wood after-slot and 7-iron window in one “slot” number.
  Same thought, different half of the delivery — say that in a
  sentence, not in a mean.

## Group names the app already tags

`clubTag` in `app.js`:

| `rangeShots.club` | Chip |
|---|---|
| `3 wood · after slot` | `3W · slot` |
| `7-iron · open` | `7i · open` |
| `7-iron · window` | `7i · run` |
| `7-iron · rest` | `7i · rest` |

Stick to those suffixes so the setup line and the path rings stay
readable.
