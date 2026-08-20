// Scorecards — the published par (and stroke index) for courses Jack plays.
//
// WHY THIS FILE EXISTS. The live logger used to prefill every hole of an unplayed course
// as PAR 4, because his own prior card was the only layout source it had. On a first visit
// that silently produced eighteen par 4s, and the wrong par is not a cosmetic problem: it
// moves the score-vs-par on every hole, the birdie/par/bogey chips, the scoring mix, the
// par splits and the round's total. Aug 20 2026 was logged that way at Lakeside. Published
// scorecards are public for most courses, so the app should know them.
//
// PRECEDENCE. This is a BASELINE, below Jack's own cards: `holeLayout()` in app.js takes
// his prior round at that course first (he was standing on the hole), then a `layout` feed
// entry, then this file. Same shape as lessons.js — a frozen baseline that the feed edits
// rather than the file being rewritten. To correct or add a card WITHOUT a build, append a
// `layout` entry to coach-feed.json; it wins over anything here.
//
// THE RULE FOR ADDING ONE. Every card here must come from a published source, named in
// `src`. Never infer a par from a yardage, a course's total par, or a photo you can't read
// — a guessed card is worse than no card, because the app renders a sourced card as fact
// and stops asking. If only part of a card is published, ship the part that is (`si` is
// optional) and leave the rest out. `check()` below refuses a card whose pars don't sum to
// its stated total or whose stroke indexes aren't a permutation, so a typo can't ship.
//
//   { n:   course name — must match the name used in Courses and on his rounds exactly,
//           because course name is the join key everywhere in this app
//     st:  state/country, for disambiguation only
//     par: [18 integers], hole 1 → 18
//     si:  [18 integers] men's stroke index, optional, a permutation of 1..18
//     tot: stated total par, used as a checksum against `par`
//     ver: how well it is known — 'read' or 'reconciled', see below
//     src: where it came from — a URL or a plainly named publication
//     as:  the date the card was read, so a later renovation is detectable }
//
// A 9-hole course, or one nine of a 27-hole facility, uses a 9-long `par` and `nine:'F'`
// or `'B'` to say which half of an 18-hole round it fills.
//
// TWO TIERS, AND THE APP SAYS WHICH (Aug 20 2026). `ver:'read'` means the card table was
// opened and parsed — the numbers below are a transcription of a specific document.
// `ver:'reconciled'` means it was assembled from published data that could not be opened
// directly (this session's egress policy blocks every scorecard host: bluegolf, usga.org,
// nysga.org and the clubs' own sites all answer 403), and it survives three checks a
// fabricated card would fail: par sums to the published total, stroke index is a clean
// permutation of 1..18 with the odds on one nine and the evens on the other, and the hole
// yardages sum to the published tee total. That is good evidence and it is NOT the same
// thing as having read the card, so the card-check screen labels it differently and asks
// him to glance at the real card. Better than eighteen guessed par 4s, honest about which
// it is — the same rule the rest of this app runs on.
const COURSE_CARDS = [
  // --- READ ---------------------------------------------------------------------------
  // The course he played Aug 20 2026, and the one that produced this whole fix. The source
  // is now the club's OWN scorecard, photographed by Jack and read Aug 20 2026, off the
  // WHITE tees he plays. Par 36/36 = 72. The transcription is checked by summing all six
  // tee rows against their own printed totals — 6513 · 6189 · 5687 · 5211 · 4944 · 4013,
  // all exact — and its ratings (Blue 72.3/131, White 70.5/129, Green 68.4/123, Gold
  // 65.8/113, Red 64.3/111) match the figures indexed from GolfLink independently, which
  // is what pins the photo to this course. It also settles the Blue rating this file
  // previously left open: 72.3/131, not the 71.6 the club's own listing carries.
  //
  // WHAT CHANGED, AND THE LESSON IN IT. This entry previously carried the stroke index from
  // the Foresight Sports FSX Play simulator library. Its pars were right; its stroke index
  // was not the row he plays. The real card prints THREE handicap rows — Blue/White, Green,
  // and Gold/Red/Fwd White — and FSX's is a near-copy of the FORWARD one, two digits out.
  // Nothing about the numbers gave that away: it is a clean permutation of 1..18 with the
  // odds out and the evens in, so it passed every check `courseCardOK()` makes. The visible
  // symptom was the 7th — 275 yards, the shortest par 4 here — carrying stroke index 9
  // instead of 15. So: `ver:'read'` says somebody read A card, and it cannot say they read
  // the tee you play. Where a course prints per-tee indexes, NAME THE TEE in `src`.
  //
  // Holes 13 and 16 print dual pars, 5/4 and 4/5. From White (and Blue, Green and Gold) the
  // 13th is a par 5 at 486 and the 16th a par 4 at 441; the forward tees swap them. The
  // pars below are the White ones.
  { n:'Lakeside Country Club', st:'NY', tot:72, ver:'read',
    par:[5,4,4,4,3,5,4,4,3, 4,4,5,5,3,4,4,3,4],
    si: [3,5,1,7,17,9,15,13,11, 6,8,16,12,14,4,2,18,10],
    src:'The club\'s own scorecard, photographed by Jack and read Aug 20 2026 — WHITE tees, 6,189 yds, 70.5/129. The card prints a separate stroke index for Blue/White, for Green, and for Gold/Red/Fwd White; this is the Blue/White row',
    as:'2026-08-20' },

  // --- RECONCILED ---------------------------------------------------------------------
  { n:'Pound Ridge Golf Club', st:'NY', tot:72, ver:'reconciled',
    par:[4,4,4,3,4,3,5,4,5, 4,3,4,5,4,3,5,4,4],
    si: [7,1,5,15,17,13,11,3,9, 12,8,10,16,6,18,14,4,2],
    src:'mScorecard / Golfify, cross-checked against the Black-tee total 7,165 (76.0/150)',
    as:'2026-08-20' },
  { n:'Van Cortlandt Park Golf Course', st:'NY', tot:70, ver:'reconciled',
    par:[4,5,3,4,4,4,3,4,4, 5,3,5,3,4,4,4,3,4],
    si: [11,1,17,5,9,13,3,15,7, 6,18,2,12,4,14,16,8,10],
    src:'GolfNYC/GolfLink card, yardages reconcile to OUT 3096 · IN 2906 · 6002',
    as:'2026-08-20' },
  { n:'Hogs Head', st:'Ireland', tot:72, ver:'reconciled',
    par:[5,4,3,4,3,5,4,5,4, 4,3,4,3,5,3,4,4,5],
    si: [17,15,7,1,9,11,5,13,3, 2,16,4,12,8,10,14,18,6],
    src:'BlueGolf/Top100, reconciles to the Tee I total 7,145; five par 3s and five par 5s corroborated in the course description',
    as:'2026-08-20' },
  // Par only. Their stroke indexes are published for one nine each, and half a stroke-index
  // is worse than none — it would put a hardest-six split on a card that cannot support it.
  { n:'Richter Park Golf Course', st:'CT', tot:71, ver:'reconciled',
    par:[4,5,3,4,3,4,5,4,4, 3,4,5,3,4,4,5,3,4],
    src:'18Birdies/GolfPass, front 36 + back 35 = 71, Blue yardages reconcile to 6,547. Stroke index published for the back nine only, so it is left out',
    as:'2026-08-20' },
  { n:'Trump Links at Ferry Point', st:'NY', tot:72, ver:'reconciled',
    par:[4,5,3,5,4,4,4,3,4, 4,4,3,4,4,5,4,3,5],
    src:'Bally’s course tour / 18Birdies (the club is now Bally’s Golf Links). Hole 2 is called a par 4 by two sources and a 518-yard par 5 by three; par 5 is the only value that makes the nine 36. Stroke index published for the back nine only, so it is left out',
    as:'2026-08-20' },
];

// A card that doesn't reconcile is a typo, and a typo here is indistinguishable from
// research. Anything failing this is dropped at load with a console warning rather than
// rendering as fact.
function courseCardOK(c){
  if(!c || !Array.isArray(c.par) || !(c.par.length === 9 || c.par.length === 18)) return false;
  if(c.par.some(p => !(p >= 3 && p <= 6))) return false;
  if(c.tot != null && c.par.reduce((a, b) => a + b, 0) !== c.tot) return false;
  if(c.si){
    if(c.si.length !== c.par.length) return false;
    const want = c.si.map((_, i) => i + 1).join();
    if(c.si.slice().sort((a, b) => a - b).join() !== want) return false;
  }
  return true;
}

const COURSE_CARDS_OK = COURSE_CARDS.filter(c => {
  const ok = courseCardOK(c);
  if(!ok && typeof console !== 'undefined') console.warn('Scorecard dropped — does not reconcile:', c && c.n);
  return ok;
});
