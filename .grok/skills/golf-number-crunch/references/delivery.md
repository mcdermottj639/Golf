# Delivery — what actually moved

Carry going up is not a diagnosis. Name which half of the delivery
moved, and whether it **held**.

## The numbers

| Key | Meaning | Sign |
|---|---|---|
| `path` | Club path, degrees. Negative = out-to-in | −2.0° is a lot less left than −6.1° |
| `ftp` | Face-to-path | + = face open to the path (fade / slice) |
| `face` | Face vs target. `path + ftp` if missing | |
| `aoa` | Attack angle | Irons more negative than woods |
| `smash` | Ball speed / club speed | Strike |
| `cs` / `bs` | Club / ball mph | |
| `la` / `spin` | Launch, rpm | |

Round path / face / F–P / aoa to **0.1** with a leading sign (`−2.0`,
`+1.4`). Smash to **0.02 → 0.01** (`1.47`). Never dump a long float.

## Compare same club, same day

```
delta = after_or_window − first_or_open
```

Report four deltas: carry, F–P, path, smash. Then **one sentence**
picking the half that moved.

| Pattern | Sentence |
|---|---|
| Path steps toward zero and stays | Path moved. (3-wood after-slot: −6.1° → −2.0°) |
| F–P quiets, path barely moves, then F–P comes back | Strike / face window. Not a path change. (7-iron later block) |
| Smash up, carry up, path and F–P flat | Strike only |
| Carry up, everything else noise, n < 5 | Not enough |

Same thought on two clubs can move **different halves**. That is a
finding. It is not a license to average them.

## Relevance filter (do not dump the table)

Jack does not need every column in the first block. Rank the readout:

1. **RED:** remaining carry, best 5 carry, the group name.
2. **Next line:** F–P, path, smash — the three that explain carry.
3. **Only if it changed:** aoa, launch, spin, start-side.
4. **Never first:** total, smash index, spin index, ball-speed diff.

If a column was off-screen, a dash. Not zero. Not a guess.
