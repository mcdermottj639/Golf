# Premier — best 5 (or best 3)

Jack asked to see the top of each batch next to the broad remaining
average. That is premier. It is **not** a bag number and **not** the
live ladder.

## Rank

```
def shot_rank(s):
    if s.carry is not None: return s.carry
    if s.smash is not None: return s.smash     # only if carry was off-screen
    if s.bs    is not None: return s.bs
    return -inf
```

Carry always wins when it exists. Never rank on total.

## How many

```
def premier_n(n_remaining):
    if n_remaining >= 5: return 5
    if n_remaining >= 3: return 3
    return 0          # n=1 or 2: no premier line. The mean is the mean.
```

Take the top `premier_n` remaining shots by `shot_rank`. Mean those.
Round carry / total the same as the broad mean (0.1).

## What premier is for

- “What does the top of this batch look like?”
- Gold dots on the carry strip.
- A second row under the broad average: `best 5 192.7`.

## What premier is not

- Not a target to put on the bag.
- Not total yards.
- Not “the three I liked.” Rank is carry, not feel.
- Not computed on the raw screen list (tops would steal slots or
  drag). Struck shots only.
- A 5-shot window’s best 5 **is** the window. Say so (`best 5 = the run`)
  rather than pretending it is a selection.

## Copy

```
All      carry 188.4  n=7 remaining
Best 5   carry 192.7  (still carry)
```

If you only have room for one red number, the remaining mean is red
and best 5 sits next to it. Never swap them.
