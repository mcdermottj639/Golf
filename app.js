/* Caddie HQ — Jack's golf command center. Vanilla JS, localStorage, no backend. */
(function(){
'use strict';

const LS_KEY = 'caddiehq_v1';
const TROUBLES = [
  ['three-putts','3-putts'], ['short-putts','Short putts'], ['bunkers','Bunkers'],
  ['off-tee','Off the tee'], ['approach','Approach'], ['chipping','Chipping'],
  ['wedge-distance','Wedge distance'], ['mental','Mental'],
];
const MISS_CYCLE = ['', 'make', 'L', 'R', 'S', 'Lg']; // 5-ft tap states
// How long a putt was. One tap on the green, and it is what turns a putt count into a
// putting statistic: a 2-putt from 40 feet is a good hole and a 2-putt from 5 is a dropped
// shot, and a putt count alone cannot tell them apart.
//
// The boundaries are not generic — every one of them is a line this project already draws,
// which is what makes the buckets worth counting:
//   ≤3     tap-in range. Separating it stops gimmes inflating the make rate, and a miss
//          from inside it is a real event rather than a rounding error.
//   4–6    the scoring zone, and HIS zone: the 5-ft test sits in the middle of it and the
//          left miss on short putts is the through-line of the whole putter saga. Where
//          `Short Putts — The Pop Stroke` applies.
//   7–12   the make-some window — birdie chances and par saves. Where strokes are won.
//   13–20  two-putt territory where a make is a bonus. The first real pace test.
//   21–30  lag proper: three-putt risk starts to climb steeply through here.
//   30+    the ladder distance. The 30-ft grind is measured here, so the on-course number
//          is directly comparable to the practice one for the first time.
const PUTT_DIST = [
  { k:'t',  lab:'≤3',    name:'inside 3 ft' },
  { k:'s',  lab:'4–6',   name:'4–6 ft' },
  { k:'m',  lab:'7–12',  name:'7–12 ft' },
  { k:'l',  lab:'13–20', name:'13–20 ft' },
  { k:'xl', lab:'21–30', name:'21–30 ft' },
  { k:'xxl',lab:'30+',   name:'over 30 ft' },
];
const PD = Object.fromEntries(PUTT_DIST.map(d => [d.k, d]));
// A conceded putt: the last one on the hole was given rather than holed. It still COUNTS
// — he scores it, everybody does — but it was never struck, and the difference matters in
// two opposite directions:
//   · given from the FIRST putt, it is a make he never hit. Counting it as one inflates
//     exactly the number this whole project is about (the short ones), so it comes out of
//     the make rate entirely rather than being credited: you cannot measure a putt that
//     was not attempted. Film is king, applied to a scorecard.
//   · given after a LAG, it is the opposite — evidence the first putt finished inside
//     gimme range, which is the closest thing to a proximity measurement the card has and
//     a straight win for the open distance-control fault.
const conceded = h => !!h.gimme && h.putts === 1;      // a make he never hit
const lagGiven = h => !!h.gimme && h.putts >= 2;       // a lag that finished inside the circle
// A hole records up to two putts by distance, which is what makes a real make rate
// possible rather than a count of holes:
//   `pm` — the putt that WENT IN. On a one-putt hole it is the only putt there was.
//   `pd` — where the FIRST one started, asked only once the total says there were two or
//          more, because on a one-putt hole the first putt and the made putt are the same
//          putt and asking twice would be asking him to tap the same fact into two rows.
//   `gimme` — the last one was given instead of holed, so there is no made distance.
// Both readers tolerate cards written before `pm` existed, where the single distance was
// stored as `pd` whatever the putt count — nothing has to be migrated to keep counting.
const puttFirstK = h => ((h.putts >= 2 ? h.pd : (h.pm || h.pd)) || null);
const puttMadeK  = h => (h.gimme ? null : ((h.putts === 1 ? (h.pm || h.pd) : h.pm) || null));
// Every putt on the hole whose distance is actually known, and whether it went in. A
// three-putt's middle putts are unknown and stay out rather than being guessed at.
function puttAttempts(h){
  const out = [];
  if(h.putts == null || h.putts === 0) return out;
  if(h.putts >= 2 && h.pd) out.push({ k:h.pd, made:false });
  const m = puttMadeK(h);
  if(m) out.push({ k:m, made:true });
  return out;
}
const pdName = k => (PD[k] || { name:k }).name;
// Inside six feet is one question (do you hole them), past it is another (do you leave
// yourself a tap-in). The plans are sliced the same way, so the analytics are too.
const PD_SHORT = ['t', 's'], PD_LAG = ['l', 'xl', 'xxl'];
// The mental tab's vocabulary. A fixed set, in Jack's own words, so that "I got upset by
// stupid stuff" becomes something countable across rounds instead of a feeling that reads
// the same every time. Each one carries its IF-THEN — the response is decided at home,
// off the course, which is the whole point of deciding it in advance: on the 14th tee
// there is no deciding, only doing whatever was already decided.
const MENTAL_TRIGGERS = [
  { k:'opener', lab:'Opening tee shot', blurb:'Threw the first one away and it rattled you.',
    then:'The recovery needs no fixing — your second hole plays at your season average and a bad opening does not predict the round. What the opening hole costs is the opening hole, which makes this a WARM-UP and first-swing problem, not a resilience one. Prime the feel before the tee rather than hunting for it on the 4th, and commit to the fuller swing on the 1st instead of the safe short one — your own Golf Mind note says the straight driver ball needs the LONGER swing. If the miss is going somewhere your usual miss does not, that is a swing question and it needs film of a COLD swing, not a warmed-up one.' },
  { k:'slow', lab:'Slow play', blurb:'Waiting on every shot; the group ahead never moves.',
    then:'Do not stand over the ball early. Wait AWAY from it — pick the club and the target while you wait, and start the routine only when it is actually your turn. Your routine has a fixed length; let the waiting happen outside it, never inside it.' },
  { k:'partner', lab:'Random partners', blurb:'Chatter, gimmes, someone standing in your eyeline.',
    then:'The only response available is where you stand. Move so they are out of your eyeline for the ten seconds the shot takes. You get one comment in your head, then it is a course condition — you do not argue with wind either. Watch the FIRST THREE HOLES specifically: on the one card where you logged this, that is where the damage went.' },
  { k:'closing', lab:'Did not close', blurb:'Up in the match, or a good score going, and it slipped.',
    then:'Same routine, same target selection as the 2nd hole — closing is not a different skill, it is the refusal to change anything. The one legitimate change: one more club, aimed at the middle. That is protecting a lead correctly; steering is not.' },
  { k:'anger', lab:'Anger at a shot', blurb:'It was gone, and you carried it to the next one.',
    then:'Ten yards of walking, then the club goes back in the bag and the hole is filed. The rule is not "do not be angry" — it is that anger gets a container with an end you can see.' },
  { k:'drift', lab:'Checked out', blurb:'Went through the motions — no target, no routine.',
    then:'Attention comes back through a target, not through effort. Next shot, name the smallest thing you can see — a branch, a mower line, a bunker lip — out loud. If you cannot name one, you are not in the round yet.' },
  { k:'score', lab:'Score math', blurb:'Adding the round up while it was still going.',
    then:'Convert it to the hole in front of you: what number makes THIS hole fine? Play that one. The arithmetic still works in the car.' },
  { k:'rush', lab:'Rushed', blurb:'Played quicker than your own routine.',
    then:'Count the beats — read, one rehearsal, step in, go. Rushing shows up as the rehearsal disappearing first, every time, so that is the one to check.' },
  { k:'body', lab:'Tired · hungry · hot', blurb:'A physical state wearing a mental costume.',
    then:'Eat before you diagnose your head. Water at every tee from the 10th and food at the turn whether you want it or not — the standing advice is that a lot of late-round collapses are blood sugar rather than character. That is general practice, not something measured about you.' },
];
const MENTAL_WHEN = [['open','Opening holes'], ['mid','Middle'], ['close','Closing stretch'], ['after','After a blow-up']];
const FOCUS_LAB = ['', 'Gone', 'Patchy', 'In and out', 'Good', 'Locked in'];
// Bump this WITH `CACHE` in sw.js — they're the same build, and the Data tab shows this
// one so "is the new version actually on the phone?" is answerable without guessing.
const BUILD = 'v77';
// The app's own changelog. coach-feed.json carries DATA updates and announces itself
// through them; a change to the app ITSELF has no other route onto the phone and nowhere
// else to say what it did, so it is written here and merged into Home's What's new block
// alongside the feed updates. Newest first. Add a block whenever BUILD is bumped — an
// update he can't see landed is indistinguishable from one that didn't.
const RELEASES = [
  { b:'v77', d:'2026-08-30', items:[
    'The two handicaps are one tile now. HANDICAP keeps the big number and the estimated index off your logged cards sits under it, small \u2014 they were two readings of one thing side by side as equals, which reads as a contradiction rather than as a figure and the app\u2019s estimate of it.',
    'The freed tile is SCRAMBLE, your definition: par or better after a missed fairway. 1 of 8 so far, with the bogey-or-better rate under it in the same small type \u2014 63%.',
    'Scramble and up & down are a pair and the line under the block says so, because the words do not: the same question asked about two different mistakes \u2014 did you save the hole from off the fairway, and did you save it from off the green. Worth flagging that your \u201cscramble\u201d is not the standard golf usage, which is up-and-down.' ] },
  { b:'v75', d:'2026-08-30', items:[
    'The numbers is now everything Today counts, under one heading: the handicap row you used to scroll past the round button to reach, and under it four live numbers in the order a hole is played \u2014 your last score, off the tee, irons, putting. Tap any tile for what is behind it.',
    'UP & DOWN replaced 5-ft makes in that top row, so the row and the tiles together cover all four parts of your game.',
    'Three tiles went. 5-FT MAKES had never shown a number \u2014 it needs two mat tests and there is one. CARRY LADDER was a fact about your bag, not a result, and it lives on Bag. CONDITIONS was the weather card directly above it, said again and smaller \u2014 you spotted that one, and it was only visible because the swap had just put the two side by side.',
    'The three new numbers are read off the same cards and the same reader Coach uses, so the front page and the coach cannot quote you different percentages.',
    'The clock no longer sits on top of the masthead. The app paints under the status bar by design, but nothing was reserving room for it at the top \u2014 only at the bottom.',
    'Two changes aimed at the scrolling glitch where the page shows through past the tab bar: the rubber-band bounce is off, and the tab bar now gets its own layer so it stops lagging behind a fast flick. Tell me if you still see it, and whether it is the home-screen app or Safari \u2014 they would be different causes.' ] },
  { b:'v74', d:'2026-08-30', items:[
    'On Today, the numbers and the one thing swapped places. The four tiles \u2014 5-ft makes, round scores, carry ladder, conditions \u2014 now sit straight under the weather, and the one thing you are working on sits below round prep, next to the coaching that goes with it.' ] },
  { b:'v73', d:'2026-08-30', items:[
    'Your plans moved to the top of every lab, above the diagnosis. Reaching a workshop log meant scrolling past every open fault and everything it was read off \u2014 several screens on Putting and Swing. A lab now reads: which lab, the cheat sheet, the routine, the plans, then the diagnosis under them.' ] },
  { b:'v72', d:'2026-08-30', items:[
    'On the Labs hub, the way INTO the lab you picked now sits directly under the four tiles instead of at the very bottom of the page. Picking Putting and actually opening Putting were separated by the entire diagnosis \u2014 several screens on any lab with faults open. Picking a lab and going in is one motion.',
    'Every lab page now carries all four labs across the top, so you can go straight from Putting to Short Game without going back to the hub. Fixed order, always \u2014 Swing, Short, Putting, Mental \u2014 and the one you are already in is the lit one.' ] },
  { b:'v71', d:'2026-08-30', items:[
    'The app now keeps YOUR calendar day, not the server\u2019s. It was reading the clock in UTC, so from 8pm Eastern onwards it believed it was already tomorrow \u2014 a round finished on a Sunday evening saved itself as Monday, a drill logged at nine went on the wrong day of the streak, and What\u2019s landed stopped saying "today" hours before your day was over.',
    'Nothing already saved was changed. If a card or a drill is sitting on the wrong date from an evening before this, tell me which and I will move it.' ] },
  { b:'v70', d:'2026-08-30', items:[
    'What\u2019s landed on Today is now just that \u2014 what landed. It shows the latest day only, with a button to the full log. It had grown to a hundred-odd rows, so the block that answers "what is different since yesterday" had turned into an archive of changes you had already read.',
    'The full history moved to its own page, unchanged and one tap away. The "N new" count is honest about the split: Today counts what it is showing you, and the button says how many more are waiting and how many of those you have not seen.' ] },
  { b:'v69', d:'2026-08-30', items:[
    'Every coaching page now says whether an instruction is YOURS or standard practice. You asked to always see what you are thinking and feeling separately from what best practice typically is, so you can tell when you are off track \u2014 the short-game plan is the worked example, and the whole app was audited against it.',
    'The audit found four things that were wrong rather than just unlabelled. Your wedge bounce was listed as 10/10/8 in a Coach lesson; the build is 8/10/8. A lesson said "your proximity from 150 yards is 45+ feet" \u2014 nothing here has ever measured your proximity, that is a published amateur average. The Swing Positions page still named the hip slide as your miss, which the Aug 20 film retracted. And the Bag stated a shallow sweeping attack angle as fact one card above the card admitting nobody has filmed it.',
    'On the Putting Routine, "barely open is square" now says out loud that it is your own read and still unconfirmed. It was stated flat on the collapsed card, which is the version you actually see \u2014 the instruction has not changed, only what it admits.' ] },
  { b:'v68', d:'2026-08-27', items:[
    'Your film history is easier to find. Every lab now calls it the same thing \u2014 FILM ROOM. Putting was still calling it "Stroke session log" while Swing and Short Game called it Film room, and the jump bar at the top of a lab is built from those headings, so the same block announced itself with a different word depending on which lab you were in.',
    'In Putting it also moved UP, above the stroke evolution grid. The grid is a summary OF the film, so the film itself should not have been the thing you scroll past the summary to reach.',
    'Nothing was ever lost: every session is still there, ten across the three labs, and tapping one still opens the full breakdown. It was findable-only-if-you-knew-where, which is the same as missing.' ] },
  { b:'v67', d:'2026-08-27', items:[
    'The whole app has been redrawn. The tab bar is five tabs with the TEE button in the middle of them — one thumb, any screen, and it starts a round or picks the one you are in the middle of back up.',
    'Courses moved under Rounds, and your round prep moved there too. Cards · Round prep · Courses are now three faces of one tab, so the plans sit next to the cards that judge them. The Game tab is the four labs and nothing else.',
    'The live logger only asks what can exist. Putts appear once there is a score; the first-putt distance only when you actually had two putts; say nought putts and it stops asking about putting at all. The fairway question waits until you have named the club you hit, and on a par 3 it asks for the green off the tee rather than pretending there was a second shot.',
    'Your round card now prints the FULL scorecard — par, stroke index, score and putts across the nine, with circles on the birdies and squares on the bogeys, doubled for eagles and doubles. Tap the header to fold it away.',
    'Under it: a miss map of where the greens went, the distances you actually holed from, putting by distance, and a by-club table for that round alone.',
    'Every finding carries a coloured rail in the tier of its evidence, and tapping the badge now opens EVIDENCE USED — what was counted, what it was read off, and what that source cannot tell you. Same panel on Today, on the labs and on a round card.',
    'The bag leads with the clubs instead of the numbers: type, make, loft, what it measures and where it stands. Then a section on grinds and bounce — what an F, an S and an M sole actually do differently, which of your three sits in which bounce band, and the four Vokey grinds you do not have and why each exists.',
    'The carry ladder is bars against a 300-yard scale with the number in its own column, gaps flagged where they are wide, and the 5-wood showing UNMEASURED rather than a guess. It says out loud that the ladder IS the club list the logger offers you.',
    'The labs hub is four cards; pick one and its diagnosis is right there, a row per open fault with its evidence rail and the drills that train it.',
    'Every section on every tab folds away, and what you left open stays open when the page redraws.' ] },
  { b:'v66', d:'2026-08-24', items:[
    'The stroke evolution grid stopped printing seven paragraphs under the table. Every row now shows its marks AND a two-word state \u2014 Settled, Closed, Open, Never measured \u2014 so you can read where the stroke stands without reading anything.',
    'Tap any row for the full reasoning behind it. Nothing was cut; it just stopped being printed on the page you use to find things.',
    'What each column was is now behind one collapsed line instead of a paragraph of legend.',
    'Under the hood: the column blurbs moved out of the app and into the data, so rebuilding the grid is a feed push rather than a code change. That was a documented trap \u2014 the old legend was hardcoded and had to be edited by hand every time a column was added.' ] },
  { b:'v65', d:'2026-08-24', items:[
    'The film room log on every lab \u2014 Putting, Swing, Short Game \u2014 is now a scannable list instead of a three-column table. A row is the date, how big the batch was, and ONE line saying what it concluded.',
    'The full breakdown is unchanged and one tap away, same as before. Nothing was thrown out; it just stopped being printed on the page you use to find things.',
    'The reason it needed doing: the findings have grown to paragraphs, and three columns at phone width meant you had to READ the log to navigate it.',
    'Putting now lists newest first, like the other two labs already did.' ] },
  { b:'v64', d:'2026-08-24', items:[
    'The three ball-height stroke clips got read properly, and they were written off too early \u2014 the head fills 224 to 365 pixels in them, which is the closest look at the club anywhere in this project.',
    'PATH goes to a tick on the Aug 24 column: SBST confirmed from a second camera, by a test that needs no scale at all. The head travels a straight line back and through and essentially retraces it. Two unrelated methods agreeing is the strongest evidence on that page.',
    'TEMPO is running quick. Six strokes now, across two sessions and two mats \u2014 mean about 1.79 against a 2:1 target, five of six under 2.0. Read the direction as real and the number as not yet, because the way backswing start is detected shortens the ratio.',
    'EARLY LIFT was challenged by those clips and the challenge did not survive \u2014 so it stays closed. Two ways of finding the head\u2019s edge give OPPOSITE answers on the same footage, because the head is more motion-blurred coming down than going back. Its grid mark is now a question mark: the angle was tried and could not settle it.',
    'First thing in the record that points at STRIKE LOCATION rather than inferring it: at address the ball sits toward the toe side of the head. Eyeball read, so it proves nothing \u2014 but that camera plus impact tape closes the fault in one session.' ] },
  { b:'v63', d:'2026-08-24', items:[
    'Four more putts on the AirBreak landed, same mat and same tilt as the first three \u2014 so the stroke evolution grid\u2019s Aug 24 column now reads off SEVEN putts, and two of its rows moved off a dash.',
    'START LINE is measurable on this mat after all, and the rule it was written under this morning was half wrong. Break only bends the ball about 0.02 in over the first 8 in of roll, so the line a putt LEAVES on reads to roughly a third of a degree. What the mat cannot tell you is whether you aimed it there \u2014 a 2.9\u00b0 right start is either a perfect allowance or a shove, and no camera can separate those.',
    'The one that matters: the mat wants about 2.5\u00b0 of right start line, and THE ONLY MISS IN THAT BATCH IS THE ONE THAT STARTED AT THE TARGET. The three that allowed 1.6\u20132.9\u00b0 right all went in. Every miss across both batches went left, and on a mat falling left that is an under-read break, not the old aim fault.',
    'TEMPO got its first re-measurement since Jul 30 \u2014 1.64 to 2.13 across four putts, mean about 1.86. Consistent with the settled 2.0 and too soft to move it, so the row reads as holding. The firmer number underneath it is the down-stroke duration, which varied 32% across four strokes.',
    'A new to-do: shoot the OVERHEAD set. It is the only angle that separates stroke path from head rise and the only route to face angle at impact \u2014 two open faults for one clip.' ] },
  { b:'v62', d:'2026-08-24', items:[
    'The stroke evolution grid has a fourth column \u2014 Aug 24 AirBreak \u2014 for the three putts filmed on the new mat at the PuttOut trainer.',
    'One row moved: PACE. Nothing ran long — both misses finished five to six inches past on a six-foot putt, a dying pace rather than a firm one, and the holed one stayed in the cup. Same answer the Aug 10 outdoor session gave, and the first time an indoor batch has given it.',
    'Start line got a DASH, and the reason is the useful part: on a mat that makes the ball curve, aim and break are the same number and there is no way to pull them apart. The AirBreak is the wrong mat for the aim question and the right one for pace. Flat mat with a line for start line; this one for speed.',
    'Strike location took a fourth column of question marks. Six clips on the day and not one shows the face.' ] },
  { b:'v61', d:'2026-08-24', items:[
    'Where your game is now reads across FOUR AREAS \u2014 off the tee, irons, short game, putting \u2014 each with its headline number and the one thing its misses say.',
    'It computes off your LIVE rounds alone as soon as they carry a round\u2019s worth of holes, and the older cards stand down and are counted out loud. Until then it says exactly which cards it read and when.',
    'No benchmark column, on your call \u2014 the only detailed baseline is a years-old archive, and a target dressed up out of it is worse than the bare number. The comparison comes back when there are enough live rounds to measure against each other.',
    'The putting tile switches itself from putts-a-hole to your MAKE RATE FROM 4\u20136 FT as soon as ten putts carry a distance \u2014 the number that is directly comparable to your mat test.',
    'One tile is outlined: the area the focus belongs to. Nothing else is coloured, because with no benchmark behind it a red tile would be a verdict the page cannot support.' ] },
  { b:'v60', d:'2026-08-24', items:[
    'The build number now sits in the top right of Home. It is read out of the code actually running on your phone, so it is the way to check a change really landed \u2014 if it does not match what you were told shipped, it did not ship. Tap it for the update check.',
    'Worth knowing why it earns the space: v59 was pushed but never published \u2014 the job that copies the site across was cancelled part-way, so your phone stayed on v58 while everything looked fine from this end.' ] },
  { b:'v59', d:'2026-08-24', items:[
    'Coach opens with one thing now: where your game is, and the single thing to focus on. It says what it read to get there \u2014 your last round, the last film, the drills you logged this week \u2014 so a focus built on a card from three weeks ago cannot pass for one built on Saturday.',
    'Under the focus is the work: the drills that train THAT finding, with how many are due. Miss short off 44% of your playable misses and it hands you the three drills for missing short, not a general nudge to go and practise.',
    'The drill bench and the library are now second and third on the page. They were sixth and last, under the to-do list and a link to Scores \u2014 the two pages Coach exists to reach were the two furthest from the top.',
    'The rest of the findings are still there, ranked, further down \u2014 with the focus left out rather than repeated.',
    'An open fault now links to ITS OWN lab. Every one of them pointed at the Putting Lab whatever it was of, so a swing fault sent you to the wrong page.' ] },
  { b:'v58', d:'2026-08-24', items:[
    'The drill bench now records WHICH drill you did, not just that you did one. Every drill has a Did it \u2713 button with a box for the result \u2014 7/10, 18, whatever that drill scores in \u2014 and it keeps the last run, the whole history, and a trend line once there are three numbers.',
    'Reading a lesson no longer counts as doing its drill. Tapping \u201cwhy this drill exists\u201d used to quietly drop the drill off your shortlist \u2014 the one tap the page invites. Now a drill leaves the shortlist when you LOG it, and comes back when it has gone ten days unrun.',
    'Every lab now says what trains its faults. Each open fault on a diagnosis card carries a line \u2014 how many drills train it, how many are due \u2014 that opens the bench filtered to that fault. Where nothing trains it, it says so rather than staying quiet.',
    'And it did: three open faults had NO drill attached to them at all \u2014 the face-on film the putting lab is waiting on, nought-from-twelve up-and-downs, and your across-the-line top, whose own drill was not tagged with it. Thirteen lessons were re-tagged; every open fault in every lab now reaches at least one drill.',
    'Opening a section no longer snaps shut when the page updates underneath you.' ] },
  { b:'v57', d:'2026-08-24', items:[
    'The AirBreak putting mat is on the kit list and marked owned — you said you got it, so the drill bench counts it, the same as tapping the chip yourself.',
    'Four new drills are built for it on the At-Home Putting shelf: an owner’s manual for the pumps, breakers in both directions (the pair that catches a left aim before a green does), the uphill–downhill pace ladder, and a nine-hole pump game where no two putts are alike.',
    'Every carpet drill you already had — the coin gate, 20-in-a-row, the pop stroke — runs on the mat unchanged, now with one known speed and a real hole that can lip a putt out.' ] },
  { b:'v56', d:'2026-08-21', items:[
    'Courses now flags TWO ROWS FOR ONE COURSE. Adding your round history brought in names that did not always match the ones you had already typed, and the list quietly grew a second row for the same place.',
    'Sand Valley Golf Resort \u2014 Mammoth Dunes is gone; your own Mammoth Dunes row stays, with your rating and your PR on it, and it now has a location so it sorts by distance like the rest.',
    'Anything else it finds sits in a Two rows, one course? card above the rankings. It never merges or deletes on its own \u2014 tap the row you want to lose and Delete it. Two courses at one club (Whistling Straits \u2014 Straits and \u2014 Irish) are never flagged against each other.' ] },
  { b:'v55', d:'2026-08-21', items:[
    'The course rankings sort three ways now \u2014 Rating, PR or Nearest. Rating is still what opens, and the one you pick sticks.',
    'Nearest works off the same location the weather card asks for, and the arithmetic happens on this phone. Pick it with no fix on file and it asks for one there and then; say no and the list simply stays in its rating order.',
    'Every course you have played now has a location on file \u2014 45 of them, added today. Nine are the club\u2019s own coordinate; the rest are the town centre standing in for it, which is what the \u2248 beside the mileage means. Straight-line miles, not drive time.',
    'A course with no rating, no PR or no location sits at the BOTTOM of whichever sort you are in. It never counts as a zero and it never drops off the page.' ] },
  { b:'v54', d:'2026-08-21', items:[
    'The whole drill bench is drawn now \u2014 all 63 drills, not just the new ones. Every one opens with a diagram of the setup, then numbered steps, then a PASS MARK saying what a good session looks like.',
    'Some of those diagrams answer a question on their own. The wedge matrix shows that six of your nine clock numbers have never been measured. The green-reading one shows the same putt needing three different lines at three speeds. The groove test makes the heel of the club the control sample for the worn middle.',
    'Kill the laid-off top is now Kill the ACROSS-THE-LINE top. The drill was always the right one \u2014 the name was left over from before the fault was re-read on Aug 20, and the two words mean opposite things.',
    'The bounce drill moved off the Range filter to the practice green, where it is actually done.' ] },
  { b:'v53', d:'2026-08-21', items:[
    'Your standing course plans now sort NEAREST FIRST. Round Prep puts the closest one at the top and prints the miles beside each name, so the plan for the course you are actually driving to is the one you land on.',
    'It uses the location your phone already gives the weather card \u2014 that fix is now kept instead of thrown away, and the sorting happens on the phone. Nothing about where you are is sent anywhere to do it.',
    'If the app has never had a fix, Round Prep shows a Sort by distance button instead and the list stays exactly as it was until you tap it.',
    'The distances are straight-line miles to the course, not drive time. Sterling Farms and Wianno are pinned to the club itself; Pound Ridge and Lakeside are pinned to the town, which is why they show a \u2248 \u2014 good to a couple of miles, which is plenty to order a list. A plan with no location on file keeps its place at the bottom rather than disappearing.' ] },
  { b:'v52', d:'2026-08-21', items:[
    'Drills are drawn now. Every new range and practice-green drill comes with a diagram \u2014 where the headcover goes, where the phone goes, which way the club travels, what the divot has to do \u2014 so the setup is a picture instead of a paragraph.',
    'And they read as instructions: one line of setup, numbered steps, then a PASS MARK saying what a good session actually looks like. The reasoning is still there, one tap away under Why this drill exists.',
    'A wedge drill joins the range shelf: a club on the ground, the ball just ahead of it, and the divot has to start at or after the line. Every number on your carry ladder assumes a good strike, and seven of the twelve greens you missed at Sterling finished short.' ] },
  { b:'v51', d:'2026-08-20', items:[
    'The course box on Start a live round opens its own list. Tap it and every course you have a plan written for is right there \u2014 the upcoming ones first with their date, then the standing plans, each one saying how many hole notes it carries.',
    'Underneath them sits everywhere else you have on file, marked where a scorecard is already on record, so a course with no plan still fills in its own spelling rather than being thumbed in from scratch.',
    'It filters as you type and a tap fills the box \u2014 no keyboard needed to start a round at a course you have played or prepped.' ] },
  { b:'v50', d:'2026-08-20', items:[
    'What\u2019s new sends film to the right lab. Every film session in the log linked to the Putting Lab whatever it was of \u2014 so the driver breakdown that just landed would have opened your putting page. Swing film now goes to the Swing Lab, short-game film to Short Game, putting film to Putting. Rows already sitting in your log keep the link they were filed with; everything from here lands right.' ] },
  { b:'v49', d:'2026-08-20', items:[
    'Lakeside\u2019s real scorecard is on file \u2014 you photographed it, so par, stroke index, rating and slope now come off the club\u2019s own card instead of a simulator library.',
    'Your stroke indexes there were WRONG and are now fixed, both on the card on file and on your Aug 20 round. That card prints three different handicap rows \u2014 one for Blue/White, one for Green, one for the forward tees \u2014 and the old source had copied the forward one. Off the whites the 3rd is stroke index 1, the 16th is 2, and the 7th at 275 yards is 15, not 9. Your scores were not touched.',
    'The Aug 20 round now carries White, 70.5 and 129, so it produces a handicap differential at last.',
    'The Lakeside plan is rebuilt as a standing plan with all eighteen holes on it \u2014 yardage, par and stroke index on every one, and the club the number asks for. It is 6,189 yards from the whites: eight of the ten par 4s are under 400, no par 3 is over 180, and only the 441-yard 16th really needs a driver.' ] },
  { b:'v48', d:'2026-08-20', items:[
    'The live hole gives you the screen back. Everything above Off the tee was eating a third of the phone before a single chip appeared \u2014 the scoring rows now start about 220px higher.',
    'The 1\u201318 strip folds away. It starts collapsed and lives behind a 1\u201318 control in the par row, so it costs no room until you want to jump; opening it and tapping a hole closes it again.',
    'On a live hole the app\u2019s own banner shrinks to just the night-mode button \u2014 the hole title, course and par row say where you are, and they now sit at the top of the screen.' ] },
  { b:'v47', d:'2026-08-20', items:[
    'The card gets checked before you tee off. Starting a live round now opens the whole scorecard — every par, the total, and out and in — so a wrong one gets caught on the first tee instead of on the last. Tap any hole to cycle its par.',
    'No more silent par 4s. A course with no card on file used to prefill eighteen par 4s that looked exactly like a real scorecard. Guessed pars now render DASHED, on that screen and on the hole, so a placeholder can never pass for a card.',
    'Six scorecards are on file — Lakeside, Pound Ridge, Van Cortlandt, Hogs Head, Richter Park and Ferry Point. Lakeside was read off a real card table; the other five were pieced together from published data and are labelled that way, so glance at them against the card in your hand.',
    'Your Aug 20 round at Lakeside has been corrected — the real pars and stroke indexes are on it now, and your scores were not touched. It was logged before the card was on file, which is what put a par 4 on every hole.',
    'On the hole screen, the next-hole button moved up above the scoring card and the prep note moved down below it.' ] },
  { b:'v46', d:'2026-08-20', items:[
    'Quick view on the live logger. A Full card / Quick view switch sits under the hole’s prep; flip it and the hole becomes one-line rows — tee shot through score on one screen, no scrolling.',
    'One row is open at a time with full-size chips. Answer it and the next unanswered row opens by itself; tap any row to fix it, and a row you don’t track just stays blank, same as the full card.',
    'The switch remembers which view you used last, the full card stays one tap away, and every tap still saves instantly.' ] },
  { b:'v45', d:'2026-08-20', items:[
    'The putting rows are rebuilt. Putts is the total; Putt made is how long the one you holed was, with Given as one of its options; and First putt only appears once the total says there were two or more, to record where you started.',
    'That gives a REAL make rate for the first time — from a two-putt hole the app now knows one putt you missed and one you holed, both with distances, so the table counts putts struck rather than holes played.',
    'The hole\u2019s prep now starts collapsed, showing just the one line to act on. Tap its header for the reasoning underneath.' ] },
  { b:'v44', d:'2026-08-20', items:[
    'A gimme chip for when you lag it up and it gets given.',
    'Given putts are handled honestly. One given from close is a make you never hit, so it stays out of your make rate rather than padding it. One given after a lag is the opposite — proof the lag finished inside the circle, which is the only proximity number a scorecard can produce.' ] },
  { b:'v43', d:'2026-08-20', items:[
    'The round prep now gets marked. Open a round played at a course with a plan and the card ends with How the plan held up — what the plan called on each hole, what you hit, where both shots finished, what it scored.',
    'Where a plan names a club or a direction to avoid, the card counts it: how often you took the call, and whether the miss it warned about is the one that happened. The Sterling Farms plan carries those on 11 of its holes now.',
    'A plan is only marked against a round it was written BEFORE. Where it was built from that card, the block says so instead of pretending to have predicted it.' ] },
  { b:'v42', d:'2026-08-20', items:[
    'The live logger asks how far the first putt was — six ranges, one tap: \u22643, 4\u20136, 7\u201312, 13\u201320, 21\u201330, 30+.',
    'That turns your putt count into a putting stat. New table on Scores and on every card: makes and three-putts from each range, so a two-putt from forty feet stops looking like a two-putt from five.',
    'It also puts a number on the two things the plans are sliced by — holing the ones inside six feet, and leaving the long ones close. Distance control has been the open fault on feel alone; this is the first thing that can measure it on a green.' ] },
  { b:'v41', d:'2026-08-20', items:[
    'The notes you write on a hole now come back to you. Play that hole again and the note is on the hole card in the live logger, under your record for it.',
    'Scores has a What you wrote on the course section — every hole note you have written, newest first, tappable through to its round.',
    'A finding about a hole that keeps costing you now quotes what you wrote on it, and a round\u2019s blow-up list shows the note off each hole.' ] },
  { b:'v40', d:'2026-08-20', items:[
    'Home now ends with What\u2019s new — every change, newest first, with the day it was made. Tap any row to open what it changed.',
    'The gear wear counters moved to the Bag, where the clubs they describe are.' ] },
  { b:'v39', d:'2026-08-19', items:[
    'Rounds you log live now outrank everything else. Where your live cards can answer a question on their own they answer it alone, and the finding says "you logged this live".',
    'OB on the live logger — one chip on Fairway and on Green. It gets priced rather than counted: stroke and distance is two strokes every time, and there is now an OB column in the off-the-tee club table.',
    'A note on any hole, not just at the end of the round. One tap opens the box; it saves as you type.' ] },
  { b:'v38', d:'2026-08-14', items:[
    'Starting a live round no longer zooms the phone in and leaves it there.' ] },
  { b:'v37', d:'2026-08-14', items:[
    'The course cheat sheet describes the course rather than repeating the hole notes.' ] },
  { b:'v36', d:'2026-08-14', items:[
    'Pre-round cheat sheet, reachable from Home.',
    'The app checks for a new build every time you open it and refreshes itself.' ] },
];

const GROOVE_LIFE = 80;  // rounds until a wedge face is considered spent
const GRIP_LIFE = 40;    // rounds until regrip

// ---------- Seed: everything already known from Jack's Drive folder ----------
function seed(){
  return {
    v: 1,
    profile: { name:'Jack', handicap:8.5, height:`5'10"`, stroke:'SBST', miss:'Left (short putts)' },
    settings: { returnDeadline:'2026-10-15', deadlineEstimated:true, gripRounds:0 },
    clubs: [
      { id:'c1', name:'Scotty Phantom 7.5', cat:'putter', spec:'34" · jet neck · max toe flow',
        status:'gaming', flow:'toe', rounds:0,
        note:'Arc-suited head vs. your confirmed SBST stroke — flagged as the equipment half of the left miss. In return window.' },
      { id:'c2', name:'Scotty Newport 2', cat:'putter', spec:'Blade · toe hang',
        status:'backup', flow:'toe', rounds:0,
        note:'Also arc-suited. Historically putted poorly with it — the pattern fits.' },
      { id:'c3', name:'Vokey SM11 60°', cat:'wedge', loft:60, spec:'8° bounce · M grind',
        status:'ordered', rounds:0,
        note:'The creative wedge — opens wide for flops & splash. Changed from 10S: M grind is built for the open face.' },
      { id:'c4', name:'Vokey SM11 56°', cat:'wedge', loft:56, spec:'10° bounce · S grind',
        status:'ordered', rounds:0,
        note:'Workhorse — full & stock shots, standard bunkers. Changed from 8M for forgiveness on square deliveries.' },
      { id:'c5', name:'Vokey SM11 50°', cat:'wedge', loft:50, spec:'10° bounce · S grind',
        status:'gaming', rounds:0,
        note:'Full-swing gap wedge — already right for a shallow sweeper.' },
      { id:'c6', name:'Cobra King Tec irons', cat:'iron', spec:'PW 44° (anchors the wedge ladder)',
        status:'gaming', rounds:0, note:'Strong-lofted set. Confirm the PW stamp.' },
    ],
    pwLoft: 44,
    bagHistory: [
      { date:'2026-07', text:'56°: 8M → 10S — hit mostly full & square; forgiving grind fits the job.' },
      { date:'2026-07', text:'60°: 10S → 8M — the club you open up; M grind is built for it.' },
      { date:'2026', text:'Catalina Studio Style returned — funded the Phantom 7.5.' },
    ],
    actions: [
      { id:'a1', text:'Arc vs. straight — ANSWERED: overhead confirms SBST → zero-torque is the match', done:true, pri:false },
      { id:'a2', text:'Demo zero-torque putters at 34" (L.A.B. DF3 / Mezz.1 Max, Odyssey S2S, Spider ZT)', done:false, pri:true },
      { id:'a3', text:'Book a putter fitting inside the return window', done:false, pri:true },
      { id:'a4', text:'Confirm the exact return deadline', done:false, pri:true },
      { id:'a5', text:'Nose-drop eyeline test at 34"', done:false, pri:false },
      { id:'a6', text:'Aim check on a straight 6-footer', done:false, pri:false },
      { id:'a7', text:'Demo the SM11s: 56.10S feel · 60.08M splash', done:false, pri:false },
    ],
    sessions: [
      { date:'2026-07-17', setup:'3 strokes · ground-level close-up', finding:'Tempo ~1:1 · face closes · early lift. Contact centered ✓',
        detail: {
          metrics: [
            { k:'Tempo', v:'~1:1', s:'warn', n:'target 2:1' },
            { k:'Contact', v:'Centered', s:'good', n:'off the sweet spot' },
            { k:'Start line', v:'Up the track', s:'good', n:'aim solid' },
            { k:'Face', v:'Closes', s:'warn', n:'toe-over, varies rep-to-rep' },
            { k:'Lift', v:'Lifts early', s:'warn', n:'up & out after impact' },
          ],
          story:'The baseline. Three strokes on the indoor mat, filmed as a tight ground-level close-up of the clubhead. Contact was clean and centered on all three, and the ball started on a reasonable line — aim and strike were never the problem. The faults: a quick, short-backswing stroke; the head popping up right after impact; and the toe rotating over through impact — worst on stroke 2, calmer on stroke 3, which is what flagged it as timing-dependent.',
          limits:'Clubhead-only close-up: posture, eyeline, stance and true path could not be assessed from this angle.',
        } },
      { date:'2026-07-18', setup:'2 strokes · face-on / near-DTL', finding:'Path near-neutral · start line straight · early lift pronounced',
        detail: {
          metrics: [
            { k:'Path', v:'Near-neutral', s:'good', n:'not a big arc' },
            { k:'Face release', v:'Moderate', s:'mid', n:'less than the close-ups showed' },
            { k:'Lift', v:'Pronounced ✗', s:'warn', n:'clearest fault on film' },
            { k:'Start line', v:'On center', s:'good', n:'no left miss these reps' },
            { k:'Tempo', v:'Brisk', s:'warn', n:'still quick' },
          ],
          story:'Wider framing unlocked the path question — and the read was mild arc / nearly neutral, clearly not a big-arc stroke. The early lift became the headline: the head pops off the mat right after impact instead of chasing low, the most consistent fault across every stroke filmed to that point. Face rotation was present but moderate.',
          limits:'Shot from behind-and-slightly-above rather than pure ball-height down-the-line, so the arc read was "best available," not final — Session 3 settled it.',
        } },
      { date:'2026-07-18', setup:'9 clips · overhead + DTL', finding:'Path confirmed STRAIGHT (SBST) → zero-torque putter is the match',
        detail: {
          metrics: [
            { k:'Path', v:'STRAIGHT · SBST', s:'good', n:'overhead = gold standard' },
            { k:'Face at takeaway', v:'Square-ish', s:'good', n:'no arc rotation' },
            { k:'Start line', v:'Straight', s:'good', n:'good reps on the mat' },
          ],
          story:'The big one. The overhead angle — the gold standard for path — showed a clear straight-back-straight-through stroke across multiple Phantom 7.5 reps, superseding the earlier "mild arc" guess from angles that could not actually see path. Verdict: you are a zero-torque / face-balanced player, and both putters you own are arc-suited. The mismatch explains the recurring left miss: the putter wants to close the face and a straight stroke does not time that rotation.',
          limits:'Overhead cannot see vertical movement, so the lift question stayed open.',
        } },
    ],
    evolution: {
      updated: '2026-07-18',
      sessions: ['S1','S2','S3','S4','BL'],
      metrics: [
        { name:'Path', marks:['?','~','✓','✓','✓'], verdict:'SETTLED — straight (SBST), confirmed from overhead across 15+ clips and both putters.', s:'good' },
        { name:'Tempo / load', marks:['✗','✗','—','✓','✓'], verdict:'FIXED on film — backswing load grew ~60% (0.40s → 0.65s), ratio ≈2:1. Keep the One-Two drill.', s:'good' },
        { name:'Face at impact', marks:['✗','~','—','✓','?'], verdict:'Square on the newest film. Historically timing-dependent — zero-torque removes the timing requirement.', s:'mid' },
        { name:'Early lift', marks:['✗','✗','—','?','✗'], verdict:'THE OPEN FAULT — documented from 3 angles in the baseline. Needs a face-on clip to confirm the fix.', s:'warn' },
        { name:'Start line / aim', marks:['✓','✓','✓','✓','✓'], verdict:'A strength in every session ever filmed. Protect it: pick a putter you can aim with confidence.', s:'good' },
      ],
    },
    fiveFt: [],           // {date, results:[...20 of make/L/R/S/Lg]}
    stats: [],            // stat snapshots (GHIN etc), oldest first — see the `stats` feed type
    drillLog: [],         // {date, drill}
    tests: [],            // {date, putter, makes, note} — 10-ball demo tests
    shortlist: [
      { name:'L.A.B. DF3', type:'Zero-torque · XL mallet', price:479, demoed:false },
      { name:'Odyssey Ai-One S2S Jailbird', type:'Zero-torque · high-MOI', price:399, demoed:false },
      { name:'L.A.B. Mezz.1 Max', type:'Zero-torque · max MOI', price:449, demoed:false },
      { name:'TaylorMade Spider ZT', type:'Zero-torque · trusted shape', price:449, demoed:false },
      { name:'Odyssey Ai-One S2S #7', type:'Zero-torque · fang', price:349, demoed:false },
      { name:'Scotty Phantom 7 DB', type:'Face-balanced · easy swap', price:449, demoed:false },
    ],
    courses: [
      { id:'x1', name:'Old Head', st:'Ireland', rating:null, pr:null, bucket:false, notes:'' },
      { id:'x2', name:'Waterville', st:'Ireland', rating:null, pr:null, bucket:false, notes:'' },
      { id:'x3', name:'Hogs Head', st:'Ireland', rating:null, pr:null, bucket:false, notes:'' },
      { id:'x5', name:'Metedeconk National', st:'NJ', rating:null, pr:null, bucket:false, notes:'' },
      { id:'x6', name:'Trump Links at Ferry Point', st:'NY', rating:null, pr:null, bucket:false, notes:'' },
      { id:'x4', name:'Sand Valley', st:'WI', rating:null, pr:null, bucket:true, notes:'Next up.' },
    ],
    rounds: [],           // {date, course, score, putts, troubles:[], note}
    mental: [],           // post-round debriefs — {id, date, round, focus, triggers:[], when:[], note, next}
    matrix: { 50:{h:null,t:null,f:null}, 56:{h:null,t:null,f:null}, 60:{h:null,t:null,f:null} },
    carries: [
      { club:'Driver', loft:'9°', carry:235 },
      { club:'Mini Driver', loft:'13.5°', carry:220 },
      { club:'2-iron (utility)', loft:'~17°', carry:205 },
      { club:'4-iron', loft:'21°', carry:190 },
      { club:'5-iron', loft:'23°', carry:180 },
      { club:'6-iron', loft:'26°', carry:170 },
      { club:'7-iron', loft:'29.5°', carry:158 },
      { club:'8-iron', loft:'34°', carry:146 },
      { club:'9-iron', loft:'39°', carry:134 },
      { club:'PW', loft:'44°', carry:122 },
      { club:'50° wedge', loft:'50°', carry:108 },
      { club:'56° wedge', loft:'56°', carry:95 },
      { club:'60° wedge', loft:'60°', carry:80 },
    ],
    carriesCalibrated: false,
    lessonsRead: [],
    drillDays: [],        // ISO dates a drill was marked done
    // WHICH drill was done, and what it scored. `drillDays` records only that SOMETHING
    // was practised that day, so it can keep a streak alive and nothing else — it cannot
    // say the tape test has never been run, or that the coin gate is climbing. Every drill
    // now carries a pass mark that produces a number, and a number with nowhere to go is
    // the one kind of evidence this app has always refused to lose. {id, date, v} — `v` is
    // the result as he typed it ("7/10", "18"), optional, because doing the drill is worth
    // recording even on a night he didn't count.
    drillLog: [],
    briefings: [],        // {id, course, date, focus, sections:[{t,b}]} — pushed by Claude pre-round
    // Published scorecards pushed by feed — {course, par:[], si:[], nine, src}. Ranks
    // below Jack's own cards and above the course-cards.js baseline. See holeLayout().
    layouts: [],
    // Lesson layer. `lessons.js` is the FROZEN BASELINE, exactly like seed() is for
    // everything else; these three carry the live edits so a lesson change has the same
    // append-only trail a plan change does. See lessons() below.
    lessonEdits: {},      // { lessonId: {…patched fields} } — from `lesson-update`
    lessonAdds: [],       // whole lessons pushed by feed — from `lesson-add`
    lessonHidden: [],     // ids retired — from `lesson-remove`
    // The kit on hand, which is what the drill bench filters by. Owning something is a
    // claim about the world, so this starts as ONLY what the record establishes — the bag,
    // the phone every filmed fault came off, the Miracle 201, the PUTTLAZR laser bought
    // Aug 13 2026, and a tee, which anybody carrying that bag has. Everything else waits
    // for a tap rather than being assumed.
    kit: ['putter','phone','laser','m201','coins'],
  };
}

// ---------- State ----------
let S;
function migrate(s){
  // Additive upgrades for states saved by older app versions.
  if(!s.feedApplied) s.feedApplied = [];
  if(!s.stats) s.stats = [];
  if(!s.faults) s.faults = [
    { tag:'early-lift', why:'fault #1 in your filmed stroke sessions' },
    { tag:'tempo', why:'your filmed tempo runs ~1:1 (target 2:1)' },
  ];
  if(!s.carries){ const fresh = seed(); s.carries = fresh.carries; s.carriesCalibrated = false; }
  if(!s.briefings) s.briefings = [];
  if(!s.layouts) s.layouts = [];             // scorecards pushed by feed — see holeLayout()
  if(!s.geo) s.geo = [];                     // course locations pushed by feed — see courseGeo()
  if(s.here === undefined) s.here = null;    // his last location fix — see fetchHere()
  if(!s.mental) s.mental = [];
  if(!s.lessonEdits) s.lessonEdits = {};
  if(!s.lessonAdds) s.lessonAdds = [];
  if(!s.lessonHidden) s.lessonHidden = [];
  if(!s.kit) s.kit = seed().kit;
  if(!s.drillLog) s.drillLog = [];   // per-drill practice record — see drillRuns()
  if(s.live === undefined) s.live = null;   // a round being logged hole-by-hole
  if(!s.updates) s.updates = [];            // the What's new log — see recordUpdate()
  if(s.updatesInit === undefined) s.updatesInit = false;
  if(s.settings.seenBuild === undefined) s.settings.seenBuild = null;
  if(!s.settings.seenUpdates) s.settings.seenUpdates = [];
  if(!s.evolution || s.sessions.every(x => !x.detail)){
    const fresh = seed();
    if(!s.evolution) s.evolution = fresh.evolution;
    // graft seed details onto matching pre-detail session rows
    s.sessions.forEach(row => {
      if(row.detail) return;
      const match = fresh.sessions.find(f => f.setup === row.setup);
      if(match) row.detail = match.detail;
    });
  }
  return s;
}
function load(){
  try { S = migrate(JSON.parse(localStorage.getItem(LS_KEY)) || seed()); }
  catch(e){ S = migrate(seed()); }
}
function save(){ localStorage.setItem(LS_KEY, JSON.stringify(S)); }

// ---------- Utils ----------
const $ = sel => document.querySelector(sel);
function esc(s){ return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// ---- Reading helpers: long-form coaching stays whole, but arrives in layers ----
// Bodies are authored with blank-line paragraph breaks; HTML would eat them.
function prose(t, cls){
  return String(t ?? '').split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
    .map(p => `<p class="${cls || 'lesson-body'}">${esc(p)}</p>`).join('');
}
// Split off the opening sentence so it can stand as the summary line.
// lead + rest always reconstruct the whole text — nothing is dropped.
function splitLead(t){
  const s = String(t ?? '').trim();
  const re = /[.!?](?=\s|$)/g;
  let m;
  while((m = re.exec(s))){
    const end = m.index + 1;
    if(end < 40) continue;                                  // too short to stand alone
    const lead = s.slice(0, end);
    if(/(^|\s)[A-Z]\.$/.test(lead)) continue;               // initials, L.A.B., etc.
    if(/\b(vs|approx|Dr|Mr|Mrs|No|St|Jr|Sr|e\.g|i\.e)\.$/i.test(lead)) continue;
    return [lead, s.slice(end).trim()];
  }
  return [s, ''];
}
// One scannable line for a section: an authored `k`, else its opening sentence.
function gist(s){
  if(s.k) return s.k;
  const lead = splitLead(s.b)[0];
  return lead.length > 190 ? lead.slice(0, 170).replace(/\s+\S*$/, '') + '…' : lead;
}
// ----- A collapsible section (Aug 27 2026) -----
// One pattern for every foldable section in the app. It is a plain <details> carrying an
// ID, deliberately: render() already restores any open <details id=…> across a rerender(),
// so the open/closed state costs no store, no bookkeeping, and cannot drift out of sync
// with what is actually on screen. Never build a parallel open/closed map for this — the
// drill-bench bug CLAUDE.md records (an expanded section snapping shut on every in-place
// update) is exactly what that machinery exists to prevent.
//
//   id    unique and STABLE — it is the key the reopen-after-rerender works off
//   label the section name, in the mono label voice (rendered uppercase by CSS)
//   meta  the right-hand line: a count, a date, a hint. Optional.
//   body  the section's HTML
//   open  default state (true unless you have a reason)
//   cls   extra classes — `oncard` for the cream-on-green variant
// The one screen that gets NO folds is the live logger: it already hides what cannot exist
// yet, and two disclosure systems on the strictest screen in the app is one too many.
function fold(id, label, meta, body, open = true, cls = ''){
  return `<details class="fold ${cls}" id="${esc(id)}"${open ? ' open' : ''}>
    <summary><span class="foldl">${esc(label)}</span>${
      meta ? `<span class="foldm">${esc(meta)}</span>` : '<span class="foldm"></span>'}</summary>
    <div class="foldb">${body}</div>
  </details>`;
}
// The 4px rail down the left of a card carrying a finding, in the finding's own evidence
// tier. Pair it with evTag() for the chip — same five tiers, one vocabulary.
const rail = ev => ev ? ` tierrail t-${ev}` : '';

// Lead sentence up front, the rest one tap away.
function expandable(t, cls){
  const [lead, rest] = splitLead(t);
  const c = cls || 'sm';
  return rest ? `<p class="${c}">${esc(lead)}</p>
    <details class="more"><summary>Read the rest</summary>${prose(rest, c)}</details>`
    : `<p class="${c}">${esc(lead)}</p>`;
}
// A fault's `why` opens with its own status word — the feed writes CLOSED or DOWNGRADED as
// the first token when one is settled. Deriving status from that keeps ONE source of truth,
// so a fault closing in the feed drops off the diagnosis card and out of Coach's to-do list
// on its own. The old hardcoded diagnosis card is exactly what this replaces.
const faultState = f => /^\s*CLOSED\b/i.test(f.why || '') ? 'closed'
  : /^\s*DOWNGRADED\b/i.test(f.why || '') ? 'downgraded' : 'open';
const faultLabel = t => String(t).replace(/-/g, ' ').replace(/^./, c => c.toUpperCase());
// Faults are per-discipline. Everything logged before Aug 13 was putting, so an entry
// without a `discipline` is putting — that keeps the six existing faults where they are.
const faultDisc = f => f.discipline || 'putting';
const faultsFor = disc => S.faults.filter(f => faultDisc(f) === disc);
// The line that keeps a lab and the drill bench honest with each other. A fault is a thing
// to FIX, so the diagnosis has to be able to say what fixes it — but drills have exactly one
// home, so this is a pointer to the bench filtered to that fault, never a drill rendered
// here. When the answer is nothing it says so out loud: an untrained open fault is a real
// gap in the library, and a silent one is how a diagnosis goes on being restated for weeks
// with no work attached. Same principle as the evolution grid's row of question marks —
// naming what is missing is the most useful thing the page can do.
function faultDrillRow(tag){
  const ds = drillsForTag(tag);
  if(!ds.length) return `<p class="sm faint" style="margin-top:6px">No drill trains this yet —
    it is a diagnosis without a fix, which is worth saying out loud.</p>`;
  const due = ds.filter(d => d.due).length;
  return `<div class="linkrow" data-action="drills-for" data-tag="${esc(tag)}">
    <span class="sm"><b>${ds.length} drill${ds.length === 1 ? '' : 's'} train${ds.length === 1 ? 's' : ''} this</b>${
      due ? ` · <b class="warn">${due} due</b>` : ' · all run recently'}</span><span class="arr">→</span></div>`;
}
// The shared diagnosis card, used by every lab: open faults with their detail, settled
// ones collapsed to a line. One renderer so a new lab gets a real diagnosis for free.
// One row per open fault, each with its own evidence rail — see faultRows() below, which
// is the renderer both this and the labs hub draw, so a fault can never be presented two
// different ways on two screens. `emptyMsg` is the lab's own words for a genuinely empty
// list; it is a FALLBACK for a lab with no faults at all, never copy to lead with.
function diagnosisCard(disc, emptyMsg){
  const all = faultsFor(disc);
  const open = all.filter(f => faultState(f) === 'open').length;
  return `<div class="card">
    <h2>The diagnosis</h2>
    ${all.length ? faultRows(disc)
      : `<p class="sm">${esc(emptyMsg || 'Nothing measured yet for this part of the game.')}</p>`}
    ${open ? `<p class="sm faint" style="margin-top:8px">Tap a tier badge to see what the fault
      was read off — and what that source cannot tell you.</p>` : ''}
  </div>`;
}
function readMins(b){
  const w = (b.sections || []).reduce((n, s) => n + String(s.b || '').split(/\s+/).length, 0);
  return Math.max(1, Math.round(w / 220));
}
// The local calendar day, never the UTC one. toISOString() is UTC, so east of Greenwich
// this said tomorrow from 8pm Eastern onwards (7pm in winter) — which is prime time for
// this app: a round finished at 8.30 on a Sunday evening saved itself as Monday, a drill
// logged at nine went on the wrong day of the streak, and What's landed stopped saying
// "today" hours before the day was over. Golf happens in the evening; the clock has to
// agree with the player, not with the server.
function isoDay(d){
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function today(){ return isoDay(new Date()); }
function fmtDate(iso){
  if(!iso) return '—';
  const d = new Date(iso + (iso.length===10 ? 'T12:00:00' : ''));
  return isNaN(d) ? iso : d.toLocaleDateString('en-US',{month:'short',day:'numeric'});
}
function daysLeft(iso){
  if(!iso) return null;
  return Math.ceil((new Date(iso+'T23:59:59') - new Date()) / 86400000);
}
function toast(msg){
  let t = $('.toast');
  if(!t){ t = document.createElement('div'); t.className='toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(()=>t.classList.remove('show'), 1800);
}
function uid(){ return 'i' + Math.random().toString(36).slice(2,9); }
function spark(vals, h=34, color='currentColor'){
  if(vals.length < 2) return '<div class="sub">needs 2+ entries</div>';
  const w = 120, mn = Math.min(...vals), mx = Math.max(...vals);
  const pts = vals.map((v,i) =>
    `${(i/(vals.length-1)*w).toFixed(1)},${(h-3-(mx===mn ? h/2 : (v-mn)/(mx-mn)*(h-6))).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="height:${h}px">
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.5"
      stroke-linecap="round" stroke-linejoin="round" opacity=".9"/></svg>`;
}
// Weather → "plays like": cold air shortens carry ≈1% per 10°F below 70.
function playsFactor(){
  const wx = S.weather;
  if(!wx || Date.now() - wx.ts > 3*3600*1000) return null;
  return 1 + (wx.t - 70) * 0.001;
}
const WX_ICON = c => c===0?'☀️':c<=3?'⛅️':c<=48?'🌫':c<=67?'🌦':c<=77?'🌨':c<=82?'🌧':'⛈';

// ---------- Derived ----------
function latestFiveFt(){ return S.fiveFt.length ? S.fiveFt[S.fiveFt.length-1] : null; }
function fiveFtScore(entry){
  const filled = entry.results.filter(r => r);
  return { makes: filled.filter(r => r==='make').length, total: filled.length };
}
function missCounts(){
  const c = {L:0,R:0,S:0,Lg:0};
  S.fiveFt.forEach(e => e.results.forEach(r => { if(c[r]!==undefined) c[r]++; }));
  return c;
}
function struggles(){
  // Struggle tags from the last 3 rounds + standing stroke faults
  const tags = new Map(); // tag -> reason
  // `troubles` is defaulted on every write path, but an imported backup or a hand-built
  // round can arrive without it — and this renders on Home, so an undefined here is a
  // white screen on app open.
  S.rounds.slice(-3).forEach(r => (r.troubles || []).forEach(t =>
    tags.set(t, `logged at ${r.course || 'your round'} on ${fmtDate(r.date)}`)));
  const mc = missCounts();
  if (mc.L > mc.R) tags.set('short-putts', `${mc.L} left misses in your 5-ft logs`);
  // OPEN faults only. A fault whose `why` opens with CLOSED already drops off the lab's
  // diagnosis card and out of Coach's to-do list, so letting it go on matching lessons was
  // the one place a settled fault could still ask for work — and it showed: the drill bench
  // opened flagging a tempo drill FOR YOU underneath the words "CLOSED Jul 30 ✓".
  S.faults.filter(f => faultState(f) === 'open').forEach(f => tags.set(f.tag, f.why));
  return tags;
}
// The live lesson list: the frozen `lessons.js` baseline with every feed edit applied on
// top. Nothing reads LESSONS directly — a lesson change has to leave the same append-only
// trail a plan change does, or a stale lesson can sit on the phone unnoticed (which is
// exactly how a returned putter stayed named in the Equipment shelf for three weeks).
function lessons(){
  const base = typeof LESSONS !== 'undefined' ? LESSONS : [];
  // Concat BEFORE patching: a feed-added lesson has to be patchable too, and it is the
  // common case from here on, since every new lesson arrives through the feed.
  return base.concat(S.lessonAdds || [])
    .map(l => S.lessonEdits[l.id] ? { ...l, ...S.lessonEdits[l.id] } : l)
    .filter(l => !(S.lessonHidden || []).includes(l.id));
}
function pickedLessons(){
  const tags = struggles();
  return lessons()
    .map(l => {
      const hit = l.tags.find(t => tags.has(t));
      return hit ? { l, why: tags.get(hit) } : null;
    })
    .filter(Boolean)
    .sort((a,b) => (S.lessonsRead.includes(a.l.id)?1:0) - (S.lessonsRead.includes(b.l.id)?1:0))
    .slice(0,2);
}
function shelfCounts(){
  const tags = struggles();
  const by = {};
  lessons().forEach(l => {
    by[l.shelf] = by[l.shelf] || { n:0, forYou:0 };
    by[l.shelf].n++;
    if (l.tags.some(t => tags.has(t)) && !S.lessonsRead.includes(l.id)) by[l.shelf].forYou++;
  });
  return by;
}

// ----- The drill bench -----
// "What can I do right now" is a different question from "what should I learn", and the
// library only answers the second one. Every lesson already carries a `drill`, so the bench
// is the same content asked the other way round — sorted by the KIT in the house and the
// PLACE he's standing, because those are what actually decide whether a drill happens.
//
// Two rules this is built on. A drill needing kit he hasn't marked is never hidden: it
// drops to the bottom with the missing item named, since a silently shortened list reads as
// "that's everything" — the same failure the round-prep rules warn about. And kit is his to
// declare, never inferred: reading a lesson about a yardstick is not evidence he owns one.
const KIT = [
  { k:'putter', lab:'Putter + carpet',  n:'Six feet of floor is a putting lab' },
  { k:'airbreak', lab:'AirBreak putting mat', n:'PuttOut AirBreak · pumps put break and slope under 8 ft of mat · Aug 24 2026' },
  { k:'phone',  lab:'Phone + a prop',   n:'Every fault in this app came off it' },
  { k:'laser',  lab:'PUTTLAZR laser',   n:'Shaft-clamp aim laser · bought Aug 13 2026' },
  { k:'m201',   lab:'Miracle 201',      n:'The swing trainer that clicks' },
  { k:'coins',  lab:'Coins or tees',    n:'Gates and targets, on any surface' },
  { k:'ruler',  lab:'Metal yardstick',  n:'The $3 start-line machine' },
  { k:'metro',  lab:'Metronome app',    n:'Free — the tempo checks need it' },
  { k:'powder', lab:'Foot powder or impact tape', n:'The tape test needs it' },
  { k:'mirror', lab:'Putting mirror',   n:'Eye line and shoulders' },
  { k:'sticks', lab:'Alignment sticks', n:'' },
];
const KIT_LAB = Object.fromEntries(KIT.map(g => [g.k, g.lab]));
const PLACES = { home:'At home', green:'Practice green', range:'Range',
                 bunker:'Practice bunker', course:'On the course' };

// Where each baseline drill happens and what it needs. This lives in app.js rather than in
// lessons.js because it is presentation metadata, not lesson content — and lessons.js is a
// frozen baseline. A lesson arriving through the feed can carry its own `where` / `kit`
// instead, which is the route every new lesson takes from here on. An id in neither place
// is fine: it reads as "anywhere, nothing needed" and shows under every filter, so a new
// lesson can never fall off this page for want of a table entry.
const DRILL_KIT = {
  p1:{ where:'green' }, p2:{ where:'home', kit:['putter','metro'] },
  p3:{ where:'home', kit:['putter','coins'] }, p4:{ where:'green', kit:['putter'] },
  p5:{ where:'green', kit:['putter'] },
  h1:{ where:'home', kit:['putter','coins'] }, h2:{ where:'home', kit:['putter','ruler'] },
  h3:{ where:'home', kit:['putter'] }, h4:{ where:'home', kit:['putter','phone'] },
  h5:{ where:'home', kit:['putter','metro'] }, h6:{ where:'home', kit:['putter'] },
  h7:{ where:'home', kit:['putter','coins'] }, h8:{ where:'home', kit:['putter','coins'] },
  h9:{ where:'home', kit:['putter'] },
  sw1:{ where:'home', kit:['m201'] }, sw2:{ where:'home', kit:['m201'] },
  sw3:{ where:'home', kit:['m201'] }, sw4:{ where:'home', kit:['m201'] },
  sw5:{ where:'home', kit:['m201'] }, sw6:{ where:'home', kit:['m201','phone'] },
  sw7:{ where:'home', kit:['m201'] },
  g1:{ where:'green' }, g2:{ where:'green' }, g3:{ where:'course' },
  g4:{ where:'green' }, g5:{ where:'green' },
  w1:{ where:'range' }, w2:{ where:'range' }, w3:{ where:'green' }, w4:{ where:'green' },
  c1:{ where:'course' }, c2:{ where:'course' }, c3:{ where:'course' }, c4:{ where:'course' },
  m1:{ where:'range' }, m2:{ where:'course' }, m3:{ where:'green' },
  b1:{ where:'bunker' }, b2:{ where:'bunker' }, b3:{ where:'bunker' },
  e1:{ where:'green' }, e2:{ where:'home' }, e3:{ where:'home' }, e4:{ where:'course' },
};
const haveKit = k => (S.kit || []).includes(k);

// ----- The practice record -----
// What was actually DONE, per drill. The streak answers "did I practise on Tuesday"; this
// answers "when did I last run the tape test, and is the coin gate climbing" — which is the
// question the pass marks were written for. Results are stored as typed, because a drill
// scores in whatever unit it scores in (7/10, 18, a streak length); `drillNum()` pulls the
// leading number out for a trend and gives up quietly when there isn't one, rather than
// forcing every drill onto one scale.
const drillRuns = id => (S.drillLog || []).filter(r => r.id === id);
const lastRun = id => { const r = drillRuns(id); return r.length ? r[r.length - 1] : null; };
const drillNum = v => { const m = /-?\d+(\.\d+)?/.exec(String(v || '')); return m ? +m[0] : null; };
const daysSince = iso => iso == null ? null
  : Math.max(0, Math.round((new Date(today() + 'T12:00:00') - new Date(iso + 'T12:00:00')) / 86400000));
// A drill run inside this window counts as current work, so it stops crowding the
// shortlist while the ones going stale move up. Ten days is a fortnight with a bad week in
// it — long enough that a drill done properly isn't nagging by the weekend, short enough
// that nothing sits at the top of the page for a month unattended.
const STALE_DAYS = 10;

function drillList(){
  const tags = struggles();
  // A struggle tag arrives from one of two places and they are not equal evidence: a
  // standing FAULT was measured off film, while a round tag is a trouble chip he tapped
  // after playing. Both are worth surfacing; the filmed one goes first.
  const faultTags = new Set(S.faults.filter(f => faultState(f) === 'open').map(f => f.tag));
  return lessons().filter(l => l.drill).map(l => {
    const m = DRILL_KIT[l.id] || {};
    const kit = l.kit || m.kit || [];
    const hit = l.tags.find(t => tags.has(t));
    const runs = drillRuns(l.id), last = runs.length ? runs[runs.length - 1] : null;
    const since = last ? daysSince(last.date) : null;
    return { l, kit, where: l.where || m.where || null,
             missing: kit.filter(k => !haveKit(k)),
             tag: hit || null,
             why: hit ? tags.get(hit) : null, filmed: hit ? faultTags.has(hit) : false,
             runs, last, since,
             // DUE, not unread. Reading a lesson is not doing its drill, and keying this off
             // `lessonsRead` meant tapping "why this drill exists" quietly dropped the drill
             // off the shortlist — the one tap the page invites you to make.
             due: !last || since >= STALE_DAYS };
  });
}
// Which drills train a given fault. The labs diagnose and Coach trains, so this is the
// join between them: a lab names its open faults, and this says what the bench has for
// each one — including, honestly, when the answer is nothing.
const drillsForTag = tag => drillList().filter(d => d.l.tags.includes(tag));
// ----- Drill diagrams -----
// A drill is instructions, and instructions about where to stand, what goes on the ground
// and which way the club travels are read off a picture in a second and out of a paragraph
// in thirty. `viz` is a tiny scene — a list of primitives on a 100-wide grid, top-down or
// side-on — authored per drill IN THE FEED, so a diagram arrives by the same append-only
// route a lesson body does and needs no app release. Colours are theme variables, so night
// mode needs no second drawing, and arrowheads are computed as polygons rather than SVG
// markers because marker ids would collide across the dozen diagrams on the bench.
const VIZ_C = { i:'var(--ink)', g:'var(--gtext)', b:'var(--btext)', f:'var(--faint)', s:'var(--soft)' };
const vizC = k => VIZ_C[k] || VIZ_C.i;
function vizHead(x1, y1, x2, y2, c, L, W){
  L = L || 2.9; W = W || 1.7;
  const dx = x2 - x1, dy = y2 - y1, m = Math.hypot(dx, dy) || 1;
  const ux = dx/m, uy = dy/m, bx = x2 - ux*L, by = y2 - uy*L, px = -uy*W, py = ux*W;
  return `<polygon points="${x2},${y2} ${bx+px},${by+py} ${bx-px},${by-py}" fill="${c}"/>`;
}
function drillViz(v){
  if(!v || !Array.isArray(v.parts) || !v.parts.length) return '';
  const H = +v.h || 62;
  const out = v.parts.map(p => {
    const c = vizC(p.c), w = p.w || 0.7, dash = p.d ? ' stroke-dasharray="2.2 1.8"' : '';
    switch(p.k){
      case 'band':
        return `<rect x="0" y="${p.y}" width="100" height="${p.h}" fill="${c}" opacity=".12"/>`
             + `<line x1="0" y1="${p.y}" x2="100" y2="${p.y}" stroke="${c}" stroke-width=".6"/>`;
      case 'box':
        return `<rect x="${p.x}" y="${p.y}" width="${p.bw}" height="${p.bh}" rx="${p.r || 1}"`
             + ` fill="${p.f ? vizC(p.f) : 'none'}" fill-opacity="${p.f ? (p.o || .12) : 0}"`
             + ` stroke="${c}" stroke-width="${w}"${dash}/>`;
      case 'line':
        return `<line x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}" stroke="${c}"`
             + ` stroke-width="${w}"${dash} stroke-linecap="round"/>`;
      case 'club':
        return `<line x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}" stroke="${c}"`
             + ` stroke-width="${p.w || 1.5}" stroke-linecap="round"/>`;
      case 'arrow':
        return `<line x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}" stroke="${c}"`
             + ` stroke-width="${w}"${dash} stroke-linecap="round"/>` + vizHead(p.x1, p.y1, p.x2, p.y2, c);
      case 'curve':
        return `<path d="M${p.x1} ${p.y1} Q${p.cx} ${p.cy} ${p.x2} ${p.y2}" fill="none" stroke="${c}"`
             + ` stroke-width="${w}"${dash} stroke-linecap="round"/>` + vizHead(p.cx, p.cy, p.x2, p.y2, c);
      case 'ball':
        return `<circle cx="${p.x}" cy="${p.y}" r="${p.r || 1.9}" fill="var(--card)"`
             + ` stroke="${vizC('i')}" stroke-width=".6"/>`;
      case 'dot':   return `<circle cx="${p.x}" cy="${p.y}" r="${p.r || 1.2}" fill="${c}"/>`;
      case 'hole':  return `<circle cx="${p.x}" cy="${p.y}" r="${p.r || 2.1}" fill="${c}"/>`;
      case 'ring':
        return `<circle cx="${p.x}" cy="${p.y}" r="${p.r || 6}" fill="none" stroke="${c}"`
             + ` stroke-width=".6" stroke-dasharray="1.8 1.6"/>`;
      case 'obj':   // a headcover, a bottle, a range marker — something in the way
        return `<rect x="${p.x - 2.6}" y="${p.y - 1.6}" width="5.2" height="3.2" rx="1.5"`
             + ` fill="${c}" fill-opacity=".22" stroke="${c}" stroke-width=".6"/>`;
      case 'cam':
        return `<rect x="${p.x - 3.2}" y="${p.y - 2.2}" width="6.4" height="4.4" rx="1"`
             + ` fill="${c}" fill-opacity=".16" stroke="${c}" stroke-width=".7"/>`
             + `<circle cx="${p.x}" cy="${p.y}" r="1.2" fill="none" stroke="${c}" stroke-width=".7"/>`;
      case 'flag':
        return `<line x1="${p.x}" y1="${p.y}" x2="${p.x}" y2="${p.y - 8}" stroke="${c}" stroke-width=".7"/>`
             + `<polygon points="${p.x},${p.y-8} ${p.x+5},${p.y-6.3} ${p.x},${p.y-4.6}" fill="${c}"/>`;
      case 'text':
        return `<text x="${p.x}" y="${p.y}" font-size="${p.sz || 3.1}" font-weight="${p.bold ? 800 : 600}"`
             + ` text-anchor="${p.a || 'middle'}" fill="${c}"`
             + ` letter-spacing="${p.ls || .05}">${esc(p.t)}</text>`;
      default: return '';
    }
  }).join('');
  return `<figure class="dviz"><svg viewBox="0 0 100 ${H}" role="img" aria-label="${esc(v.cap || 'Drill setup')}">`
       + `${out}</svg>${v.cap ? `<figcaption>${esc(v.cap)}</figcaption>` : ''}</figure>`;
}
// A drill renders the same way on the bench and inside its lesson. `steps` is the
// instruction; `drill` is the one-line setup above it. A lesson with no `steps` is a
// baseline one whose whole drill is the paragraph, so it still renders as prose — the two
// shapes coexist rather than one needing a migration.
function drillBody(l){
  const steps = (Array.isArray(l.steps) ? l.steps : []).filter(Boolean);
  return `${steps.length ? `<p class="dlead">${esc(l.drill)}</p>` : prose(l.drill, 'lesson-body')}
    ${drillViz(l.viz)}
    ${steps.length ? `<ol class="dsteps">${steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
    ${l.score ? `<p class="dscore"><b>Pass mark</b> ${esc(l.score)}</p>` : ''}`;
}

// ----- The playable club list -----
// This comes from the CARRY LADDER, not S.clubs: the bag holds the irons as a single
// "KING TEC 4–PW" entry, so it can't name the club that actually hit a shot. The ladder
// is the real 13-club list and is already ordered longest to shortest. A hole stores the
// key, never the label, so renaming a ladder row can't orphan old cards — an unknown key
// falls back to printing itself.
// One slugger, used for club keys and for the DOM ids that let a <details> survive a
// rerender(). Brackets and the degree sign go first so "Cobra KING TEC (16.5°)" and
// "Start line / aim" both come out as something stable and readable.
function slug(name){
  return String(name).toLowerCase().replace(/\(.*?\)/g, '').replace(/°/g, '')
    .trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
const clubKey = slug;
function clubAbbr(name){
  const n = String(name || '');
  if(/mini/i.test(n)) return 'Mini';
  if(/driver/i.test(n)) return 'Dr';
  const iron = n.match(/(\d+)\s*-?\s*iron/i);
  if(iron) return iron[1] + 'i';
  const wedge = n.match(/(\d{2})\s*°?\s*wedge/i);
  if(wedge) return wedge[1] + '°';
  const wood = n.match(/(\d+)\s*wood/i);
  if(wood) return wood[1] + 'W';        // "5 wood" wraps in a chip; "5W" is what he'd write
  if(/^pw/i.test(n)) return 'PW';
  return n.length > 6 ? n.slice(0, 6) : n;
}
function bagClubs(){
  return S.carries.map(c => ({ key:clubKey(c.club), name:c.club, abbr:clubAbbr(c.club),
    wedge: /wedge/i.test(c.club) }));
}
function clubBy(key){ return bagClubs().find(c => c.key === key) || null; }
// A club that has left the ladder still has to render on every old card it hit a shot on,
// so an unknown key gets turned back into something readable rather than printing a slug.
function clubFallback(key){
  return String(key || '').replace(/-/g, ' ')
    .replace(/\b(\d+)\s*(wedge)\b/i, '$1°')
    .replace(/\b(pw|sw|lw)\b/i, m => m.toUpperCase())
    .replace(/\b[a-z]/g, c => c.toUpperCase());
}
function clubName(key){ const c = clubBy(key); return c ? c.name : clubFallback(key); }
function clubTag(key){ const c = clubBy(key); return c ? c.abbr : clubAbbr(clubFallback(key)); }

function groovePct(club){ return Math.max(0, Math.round(100 - (club.rounds||0)/GROOVE_LIFE*100)); }
function weekStreak(){
  // Mon..Sun of current week
  const now = new Date(); const dow = (now.getDay()+6)%7;
  const mon = new Date(now); mon.setDate(now.getDate()-dow);
  return ['M','T','W','T','F','S','S'].map((lab,i) => {
    const d = new Date(mon); d.setDate(mon.getDate()+i);
    return { lab, hit: S.drillDays.includes(isoDay(d)) };
  });
}

// ---------- Renderers ----------
const TITLES = {
  home:['Caddie HQ','Your bag, your stroke, your game — one book.'],
  bag:['My Bag','Every club, every spec, and the story of every change.'],
  swing:['Swing Lab','Driver to wedge — film, plans, and speed work.'],
  positions:['Swing Positions','Where the body goes, address to finish.'],
  game:['The Labs','Four parts of the game, each with its own workbench.'],
  shortgame:['Short Game','Around the green — where the strokes hide.'],
  putting:['Putting Lab','Stroke, pace, and the short ones.'],
  mental:['Mental Game','Staying locked in for eighteen — decided off the course.'],
  coach:['Coach','Lessons that follow your game — not generic tips.'],
  drills:['Drills','What you can actually do — with the kit you own.'],
  rounds:['Rounds','Your cards, the plans behind them, and the courses.'],
  decisions:['Decisions','Equipment calls made with data, not vibes.'],
  data:['Data & Backup','Your data lives on this device — export it anywhere.'],
  session:['Film Breakdown','Frame-by-frame findings from this session.'],
  briefing:['Round Prep','Course knowledge, tuned to your game.'],
  shelf:['Coach','One shelf of the library.'],
  lesson:['Coach','One lesson, and the drill that trains it.'],
  round:['Round Detail','One card, hole by hole, and what it cost you.'],
  live:['Live Round','Tap it in as you play — it scores itself.'],
  landed:['What’s landed','Every change to your app, newest first.'],
};

// ----- Rounds: one tab, three segments (Aug 27 2026, Jack's redesign) -----
// Cards, the plans written for them, and the courses they were played on are three faces
// of one subject, so they are segments of one tab rather than three places to be. Courses
// stopped being a top-level tab (you reach a course through a round or a ranking, never
// cold) and Round Prep moved out of the Game hub, which is now the four labs only.
//
// The three OLD view names stay alive as entry points — every `go('courses')`, every
// `render('scores')` in an action, and every `act:go('preps')` in the changelog still
// resolve, they just land on the segment instead of a page of their own. Nothing
// dead-ends, and no caller had to learn the new shape.
const ROUND_SEGS = [
  { k:'cards',   lab:'Cards',      view:'scores',
    tag:'Every round, what it cost you, and what to fix.' },
  { k:'prep',    lab:'Round prep', view:'preps',
    tag:'Every course plan, kept for the next time.' },
  { k:'courses', lab:'Courses',    view:'courses',
    tag:'Everywhere you’ve played, rated and remembered.' },
];
const SEG_OF = Object.fromEntries(ROUND_SEGS.map(s => [s.view, s.k]));
// View-local state, exactly as the design specifies: which face of Rounds is showing is a
// property of the view, not of the player, so it is a module variable and never saved.
let roundsSeg = 'cards';
function rounds(seg){
  if(seg && ROUND_SEGS.some(s => s.k === seg)) roundsSeg = seg;
  const cur = ROUND_SEGS.find(s => s.k === roundsSeg) || ROUND_SEGS[0];
  const body = { cards:scores, prep:preps, courses }[cur.k];
  return `<div class="segbar">${ROUND_SEGS.map(s =>
    `<button class="seg ${s.k === cur.k ? 'on' : ''}" data-action="rounds-seg" data-k="${s.k}">${s.lab}</button>`).join('')}</div>
  ${body()}`;
}

// Which fault the bench is filtered to, set by a lab's diagnosis card. Deliberately a
// module variable rather than a saved setting: it is a question asked once, and a filter
// still quietly on next week would make the bench lie about what is due. It survives a
// rerender (a chip tap) and is cleared by navigating anywhere else.
let drillTag = null;
function render(view, arg, keepScroll){
  closeCheat();  // the cheat sheet overlay lives on <body>, so navigation must clear it
  if(view !== 'drills') drillTag = null;
  // Scores / Round Prep / Courses are segments of Rounds now. Resolving the old names
  // here rather than at every call site is the whole reason nothing dead-ended when the
  // nav changed shape: a link written a month ago still lands where it always meant to.
  if(SEG_OF[view]){ arg = SEG_OF[view]; view = 'rounds'; }
  current = { view, arg };
  let [title, tag] = TITLES[view] || TITLES.home;
  // The Rounds masthead says which face you're on — the tab is one place, the segments
  // are three subjects, and the strapline is the only thing that can tell them apart.
  if(view === 'rounds'){
    const s = ROUND_SEGS.find(x => x.k === (arg || roundsSeg));
    if(s) tag = s.tag;
  }
  $('#pageTitle').textContent = title;
  $('#pageTag').textContent = tag;
  // Standing over a shot, the app's own masthead is pure overhead — the hole screen
  // already says where he is. On that one view it shrinks to the theme toggle, which
  // hands roughly a fifth of the phone back to the rows he is actually tapping.
  document.body.classList.toggle('lvfocus',
    view === 'live' && !!S.live && S.live.stage === 'play');
  // The build chip, top right of Home. It reads BUILD out of the code that is actually
  // executing, which is the only honest answer to "did the update land?" — a published
  // version is not the same claim as an installed one, and the two have disagreed twice
  // now (a suspended PWA serving stale code in August, and a publish job that was
  // cancelled before it ever reached the branch Pages serves).
  const bt = $('#buildTag');
  if(bt){ bt.textContent = BUILD; bt.hidden = view !== 'home'; }
  // The four labs live behind one nav button, so they all light it — and so does every
  // view that hangs off Rounds: a round card, and a course plan you opened from one.
  const NAV_OF = { swing:'game', shortgame:'game', putting:'game', mental:'game', positions:'game', game:'game',
                   drills:'coach', shelf:'coach', lesson:'coach', landed:'home',
                   round:'rounds', rounds:'rounds' };
  const navView = NAV_OF[view] || view;
  document.querySelectorAll('#nav button').forEach(b =>
    b.classList.toggle('on', b.dataset.view === navView));
  // The tee button is both "start" and "resume" — the same tap, because from the player's
  // side it is the same intention and live() already knows which one it is.
  const teeLab = $('#navTeeLab');
  if(teeLab) teeLab.textContent = S.live ? 'RESUME' : 'TEE';
  const R = { home, bag, game, swing, shortgame, positions:swingPositions, putting, mental, coach, drills, rounds, decisions, data:dataView, shelf, lesson, session:sessionView, briefing, round:roundView, live, landed }[view] || home;
  // An in-place update must not close what he has open. Redrawing the view replaces the
  // DOM, so any <details> he expanded snaps shut — which on the drill bench meant logging
  // a drill collapsed the drill you were reading. Same distinction as the scroll position:
  // preserved on a rerender (an update), reset on a render (a navigation). Only sections
  // carrying an id take part, so nothing else has to change.
  // BOTH states are restored, not just the open ones (Aug 27 2026): a section that defaults
  // open would otherwise spring back open on the next in-place update, so folding the
  // scorecard away and then tapping anything else would undo the fold. The DOM is still the
  // only store — this reads the state off the elements that were on screen a moment ago and
  // puts it back — which is the whole reason this pattern needs no bookkeeping.
  const was = keepScroll
    ? [...$('#view').querySelectorAll('details[id]')].map(d => [d.id, d.open]) : [];
  $('#view').innerHTML = R(arg);
  was.forEach(([id, open]) => { const d = document.getElementById(id); if(d) d.open = open; });
  buildJumpBar();
  if(!keepScroll) window.scrollTo(0,0);
}

// Every view is a stack of <h2> sections, so the in-page nav is built from the
// rendered DOM rather than hand-maintained in each of the thirteen views —
// add a section anywhere and it shows up here for free.
function buildJumpBar(){
  const view = $('#view');
  if(!view) return;
  const hs = [...view.querySelectorAll('h2')];
  if(hs.length < 2) return;
  const bar = document.createElement('div');
  bar.className = 'jumpbar';
  hs.forEach((h, i) => {
    h.id = h.id || `sec${i}`;
    const b = document.createElement('button');
    b.className = 'jump';
    b.dataset.jump = h.id;
    // Headings read "Scoring mix · 45 holes" or "Shaft at the top (down-the-line)".
    // Keep the half before the dot, drop a trailing parenthetical — a jump label
    // only has to be recognisable, and short chips keep the bar to fewer rows.
    b.textContent = h.textContent.split('·')[0].replace(/\s*\([^)]*\)\s*$/, '').trim();
    bar.appendChild(b);
  });
  // Below the segmented control where there is one: the segments say WHICH LIST you are
  // looking at and the jump bar says where you are in it, so they can't be reordered.
  const seg = view.querySelector('.segbar');
  if(seg) seg.after(bar); else view.prepend(bar);
}
let current = { view:'home' };
// Redrawing the view you're already on is an UPDATE, not a navigation — jumping to the
// top on every tap made the live logger unusable, since scoring a hole meant scrolling
// back down six times. Navigation (nav bar, links, back) still resets to the top.
function rerender(){
  const y = window.scrollY;
  render(current.view, current.arg, true);
  if(window.scrollY !== y) window.scrollTo(0, y);
}

// ----- Round prep: every course plan, kept -----
// What's coming up first, then the standing course plans (they don't expire — that's the
// point of them), then the played ones as an archive. Lab routines (Swing Focus, Golf
// Mind…) stay in their labs: a standing plan only counts as ROUND prep if its course is
// one Jack actually has.
function coursePlans(){
  const t = today();
  const known = [...S.courses.map(c => c.name), ...S.rounds.map(r => r.course)].filter(Boolean);
  return {
    up: S.briefings.filter(b => b.date && b.date >= t)
      .sort((a, b) => (a.date || '').localeCompare(b.date || '')),
    // Standing plans are sorted NEAREST FIRST once his phone has given up a location and
    // the courses have one on file. It is the right order for the question this list gets
    // asked — which of these am I playing? — and it is only ever a re-ordering: a plan
    // with no coordinate keeps its place at the bottom rather than dropping off.
    standing: byDistance(
      S.briefings.filter(b => !b.date && b.course && known.some(n => courseMatches(b.course, n)))),
    past: S.briefings.filter(b => b.date && b.date < t)
      .sort((a, b) => (b.date || '').localeCompare(a.date || '')),
  };
}
// Nulls last, and stable within each group — Array.prototype.sort is stable, so plans
// with no location on file stay in the order the feed put them in.
function byDistance(list){
  if(!S.here) return list;
  return [...list].sort((a, b) => {
    const x = courseMiles(a.course), y = courseMiles(b.course);
    if(x == null && y == null) return 0;
    if(x == null) return 1;
    if(y == null) return -1;
    return x - y;
  });
}
function planRow(b){
  const t = today();
  const tag = !b.date ? 'standing plan' : b.date < t ? `played · ${fmtDate(b.date)}` : fmtDate(b.date);
  const holes = (b.holes || []).filter(h => h && (h.play || h.note || (h.why || []).length)).length;
  const mi = courseMilesLab(b.course);
  return `<div class="linkrow" data-action="open-briefing" data-id="${b.id}">
    <span><b>${esc(b.course)}</b>${mi ? `<span class="mi">${mi}</span>` : ''}<span class="sm faint"> · ${tag}${holes ? ` · ${holes} hole notes` : ''}</span><br>
    <span class="sm clip2">${esc(b.focus || 'Briefing ready')}</span></span><span class="arr">→</span></div>`;
}
// The line under the standing plans. It has to say which order they are in, because a list
// that silently re-sorted itself is worse than one that never did — and where the sort
// could not run, it has to say why rather than looking unsorted.
function standingNote(list){
  const base = "These don't expire — course knowledge keeps. Each one's hole notes surface on that hole while you're logging a live round there.";
  const placed = list.filter(b => courseGeo(b.course)).length;
  if(!S.here) return `${base}<br><br>${list.length > 1 && placed
    ? `<button class="btn ghost tiny" data-action="locate">Sort by distance</button> — nearest first. Your location is used on this phone to do the arithmetic and is not sent anywhere.`
    : ''}`;
  const missing = list.length - placed;
  return `${base}<br><br>Sorted <b>nearest first</b>, from your last location fix (${fmtDate(isoDay(new Date(S.here.ts)))}) — straight-line miles to the course, not drive time.${
    missing ? ` ${missing} plan${missing > 1 ? 's have' : ' has'} no location on file yet, so ${missing > 1 ? 'they sit' : 'it sits'} at the bottom.` : ''}`;
}
function preps(){
  const p = coursePlans();
  const block = (title, list, note) => !list.length ? '' : `
    <h2>${title}</h2>
    <div class="card">${list.map(planRow).join('')}
      ${note ? `<p class="sm faint" style="margin-top:8px">${note}</p>` : ''}</div>`;
  const any = p.up.length + p.standing.length + p.past.length;
  // No back link: this is the Round prep SEGMENT of Rounds now (Aug 27 2026), not a page
  // you arrived at from somewhere — the segmented control above it is the way back out.
  return `
  ${any ? cheatBtn('prep') : ''}
  ${!any ? `<div class="card"><p class="sm">No course plans yet. Tell Claude where you're playing and one lands here — tee strategy, the holes that cost you, lay-up numbers off your ladder, and a note on every hole the research can support.</p></div>` : ''}
  ${block('Coming up', p.up)}
  ${block('Standing course plans', p.standing, standingNote(p.standing))}
  ${block('Played', p.past, 'Kept for the next time you go back.')}`;
}

// One row of the to-do list, used open and done alike — the done ones stay tappable so a
// wrongly-ticked action can be brought back.
const actionLi = a => `<li class="${a.done ? 'done' : ''}" data-action="toggle-action" data-id="${a.id}">
  <span class="box"></span><span class="txt">${esc(a.text)}${a.pri && !a.done ? '<span class="pri">HIGH</span>' : ''}</span></li>`;

// The type column: three-to-six mono characters saying what KIND of change a row is,
// tinted by the strength of the evidence behind that kind — burgundy for a measurement or
// a scorecard read off the real card, green for a round he played, green accent for the
// coaching library, gold for a number nobody measured, neutral ink for everything else.
// It is presentation metadata over the feed's own `type`, which is why it lives here and
// not in the feed: a tint is a reading of the entry, and the entry is the record.
// A type with no row falls through to a neutral UPDATE — the same forward-compatibility
// rule updateLine() follows, so a new feed type can never render as a blank column.
const UP_TYPE = {
  session:['FILM','u-m'], 'session-update':['FILM','u-m'], 'session-remove':['FILM','u-m'],
  evolution:['GRID','u-m'], faults:['FAULT','u-m'], test:['TEST','u-m'], layout:['CARD','u-m'],
  round:['ROUND','u-l'], 'round-update':['ROUND','u-l'],
  'lesson-add':['LESSON','u-k'], 'lesson-update':['LESSON','u-k'], 'lesson-remove':['LESSON','u-k'],
  kit:['KIT','u-k'],
  stats:['GHIN','u-u'], carries:['CARRY','u-u'], 'carry-update':['CARRY','u-u'],
  'club-add':['BAG',''], 'club-update':['BAG',''], history:['BAG',''], 'history-edit':['BAG',''],
  briefing:['PLAN',''], 'briefing-remove':['PLAN',''],
  action:['TO-DO',''], 'action-done':['TO-DO',''], 'action-update':['TO-DO',''],
  'course-add':['COURSE',''], 'course-remove':['COURSE',''], geo:['GEO',''],
  debrief:['DEBRIEF',''], 'debrief-update':['DEBRIEF',''],
  shortlist:['PUTTER',''], deadline:['WINDOW',''], build:['BUILD',''],
};
const upType = t => { const r = UP_TYPE[t] || ['UPDATE','']; return { l:r[0], c:r[1] }; };

// ----- What's landed -----
// Everything that has changed, newest first, in one place — Jack asked for it on Home
// under the coach tip. Two streams merge here: the coach feed (data — plans, bag changes,
// rounds, lessons) and RELEASES (the app itself, which the feed cannot carry). Grouped by
// the day the change was made, so it reads as a log rather than a list.
//
// It renders in TWO places, and the split is Jack's (Aug 30 2026): the whole log on Today
// ran to a hundred-odd rows, so the page you open every morning was mostly an archive of
// changes you had already read. Today now carries the LATEST DAY only — what actually
// landed — and the rest is one tap away on its own page. Nothing was cut; the block that
// answers "what is different since yesterday" stopped also being the block that answers
// "everything that has ever changed", because those are two different questions and only
// the first one belongs on a home page.
//
// A row is tappable wherever the change has somewhere to be looked at, which is the point
// of the block: it is a table of contents for what is different, not a substitute for it.

// The days, newest first, with a day's duplicate headlines collapsed. Shared by both
// renderers so the two can never disagree about what landed or when.
function upDays(){
  const rows = [];
  (S.updates || []).forEach(u => rows.push({ d:u.d, k:u.id, t:u.t, h:u.h, s:u.s, act:u.act }));
  // One row per RELEASE, not per note: three sentences of release copy set as three
  // headlines shouts over the data changes around it, and a build is one event anyway.
  RELEASES.forEach(r => rows.push({ d:r.d, k:`build:${r.b}`, t:'build', h:'The app updated',
    b:r.b, items:r.items, s:'', act:null }));
  // Stable sort on the date alone, so within one day the feed's own order survives and
  // the app notes sit under the data changes they shipped alongside.
  rows.sort((a, b) => (b.d || '').localeCompare(a.d || ''));
  const days = [];
  rows.forEach(r => {
    const last = days[days.length - 1];
    if(last && last.d === r.d) last.rows.push(r); else days.push({ d:r.d, rows:[r] });
  });
  // Three pushes to one plan on one day is one change to that plan, not three — the feed
  // is append-only and versions a plan by re-sending it, which is right for the data and
  // pure noise in a changelog. Collapse them onto the newest, keep the count, and carry
  // every merged id so the row is fresh if ANY of them is and all of them are marked seen.
  days.forEach(day => {
    const byHead = new Map();
    day.rows.forEach(r => {
      const hit = byHead.get(r.h);
      if(hit){ hit.n++; hit.keys.push(r.k); }
      else byHead.set(r.h, Object.assign(r, { n:1, keys:[r.k] }));
    });
    day.rows = [...byHead.values()];
  });
  return days;
}
const upFresh = (days, seen) => days.reduce((a, day) =>
  a + day.rows.filter(r => !r.keys.every(k => seen.has(k))).length, 0);

// Mark seen only what was actually put on the screen. Today shows one day, so marking the
// whole log read there would retire the "N new" flag on rows he has never been shown —
// the count is only worth anything if it means what it says. Additive, then pruned to
// what is still on the list, so the set can't grow forever either.
function upMarkSeen(days, shown){
  // Boot renders Home before the feed has been fetched, so on the very first open after an
  // upgrade this runs with nothing in the log yet. Marking seen there would consume this
  // build's release notes in the same paint that introduced them, a second before the feed
  // lands and redraws. So the first render is read-only and the one after it does the work.
  if(!S.updatesInit) return;
  const seen = new Set(S.settings.seenUpdates || []);
  const now = new Set(shown.flatMap(day => day.rows.flatMap(r => r.keys)));
  const next = days.flatMap(day => day.rows.flatMap(r => r.keys))
    .filter(k => seen.has(k) || now.has(k));
  if(next.length !== seen.size || next.some(k => !seen.has(k))){
    S.settings.seenUpdates = next;
    save();
  }
}

const upAttrs = a => !a ? '' :
  ` data-action="${a.a}"${a.v ? ` data-view="${a.v}"` : ''}${a.id ? ` data-id="${esc(a.id)}"` : ''}`;
function upRows(day, seen){
  return `<div class="upday"><div>${day.rows.map(r => { const ty = upType(r.t);
    return `<div class="uprow${r.keys.every(k => seen.has(k)) ? '' : ' fresh'}${
    r.act ? ' opens' : ''}"${upAttrs(r.act)}>
    <div class="upt ${ty.c}">${esc(ty.l)}</div>
    <div class="upm">
      <div class="uph">${esc(r.h)}${r.b ? `<span class="upb">${esc(r.b)}</span>` : ''}${
        r.n > 1 ? `<span class="upn">${r.n} updates</span>` : ''}</div>
      ${r.s ? `<div class="ups">${esc(r.s)}</div>` : ''}
      ${r.items ? `<ul class="upli">${r.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}
    </div>
    <div class="upd">${fmtDate(day.d)}${r.act ? '<span class="arr">→</span>' : ''}</div>
  </div>`; }).join('')}</div></div>`;
}

// Today's card: the latest day that has anything on it, and a way to the rest.
function whatsNew(){
  const days = upDays();
  if(!days.length) return '';
  const seen = new Set(S.settings.seenUpdates || []);
  const day = days[0];
  const rest = days.slice(1);
  const fresh = upFresh([day], seen), restFresh = upFresh(rest, seen);
  const restN = rest.reduce((a, d) => a + d.rows.length, 0);
  upMarkSeen(days, [day]);
  const n = day.rows.length;
  const body = `
    <p class="sm faint" style="margin:0 0 8px">${
      day.d === today() ? 'Landed today' : `Nothing since ${fmtDate(day.d)} — that day’s changes`}.</p>
    ${upRows(day, seen)}
    ${restN ? `<p class="sm" style="margin-top:10px"><button class="btn ghost tiny" data-action="go" data-view="landed">See everything that’s landed →</button>
      <span class="faint" style="margin-left:8px">${restN} more change${restN === 1 ? '' : 's'}${
        restFresh ? ` · ${restFresh} you haven’t seen` : ''}</span></p>` : ''}`;
  return `<div class="card">${fold('fold-landed', "What's landed",
    `${fresh ? fresh + ' new · ' : ''}${n} change${n === 1 ? '' : 's'}`, body)}</div>`;
}

// The whole log, on its own page. Same rows, every day — this is the archive Today used
// to be, and the only place the seen-flag on an older row is allowed to be cleared.
function landed(){
  const days = upDays();
  const seen = new Set(S.settings.seenUpdates || []);
  const fresh = upFresh(days, seen);
  upMarkSeen(days, days);
  const n = days.reduce((a, d) => a + d.rows.length, 0);
  if(!n) return `<button class="backlink" data-action="go" data-view="home">← Today</button>
    <div class="card"><p class="sm faint">Nothing has landed yet. Changes show up here the moment they reach your phone.</p></div>`;
  return `<button class="backlink" data-action="go" data-view="home">← Today</button>
  <div class="card">
    <h2>Everything that’s landed</h2>
    ${fresh ? `<p class="sm"><b class="warn">${fresh} new</b> since you last opened this page.</p>` : ''}
    ${days.map(day => upRows(day, seen)).join('')}
    <p class="sm faint" style="margin-top:10px">Every change Claude has pushed, newest first — plans, bag changes, rounds, lessons and coaching, plus what changed in the app itself. Tap any row to open what it changed. Dated by the day the change was made. Older entries drop off the bottom once there are ${UPDATE_CAP}; nothing is lost — the change itself lives in the bag, the plan or the card it landed on.</p>
  </div>`;
}

// ----- Today: the three blocks above the existing page (Aug 27 2026, Jack's redesign) -----
// Conditions, the one thing, and the way onto the tee. Everything below them — the stat
// row, round prep, the numbers, the coach tip, the changelog, the return window and the
// data links — keeps the order it already had.
//
// AUG 30 2026, Jack's call: THE NUMBERS AND THE ONE THING SWAPPED PLACES. The four chart
// tiles now sit directly under the weather and the focus sits below Round prep, next to
// the coach tip it belongs with. oneThing() is unchanged and still renders coachFocus()
// over coachSignals() — the same pick Coach leads with — so this is purely where it sits
// on the page, not a change to what the page claims or in what order it decides it.

// The weather, at arm's length in sun: the temperature at display size, the reading under
// it, and the only thing the weather actually changes about his golf in a mono block on
// the right. The arithmetic is playsFactor()'s and is unchanged — roughly 1% of carry per
// 10°F below 70 — and it is TEMPERATURE ONLY, which the card says out loud rather than
// letting a wind reading sitting beside it imply otherwise. A stale reading is shown as
// stale instead of being quietly recomputed: playsFactor() returns null past three hours.
function wxCard(){
  const wx = S.weather, f = playsFactor();
  const mins = wx ? Math.round((Date.now() - wx.ts) / 60000) : null;
  const ago = mins == null ? '' : mins < 60 ? `${mins} min ago`
    : `${Math.round(mins / 60)}h ago`;
  if(!wx) return `<div class="wx" data-action="get-weather">
    <div><div class="wxt">—°</div><div class="wxc">Tap to load the conditions where you are</div></div>
    <div class="wxr"><b>Plays like</b><span>needs a location fix</span></div></div>`;
  const p150 = f ? Math.round(150 / f) : null;
  const d = p150 == null ? null : p150 - 150;
  return `<div class="wx" data-action="get-weather">
    <div><div class="wxt">${WX_ICON(wx.code)} ${Math.round(wx.t)}°</div>
      <div class="wxc">Wind ${Math.round(wx.wind)} mph · read ${esc(ago)} · tap to refresh</div></div>
    <div class="wxr"><b>Plays like</b>${f
      ? `<span>150 → <i>${p150}</i></span>
         <span>${d === 0 ? 'no change at 150' : `${d > 0 ? '+' : ''}${d} yds · ${Math.round(wx.t)}°F air`}</span>
         <span class="wxn">Temperature only — the wind is not in this number.</span>`
      : `<span>reading is over 3h old</span><span class="wxn">Tap to refresh and the carry effect comes back.</span>`}</div>
  </div>`;
}

// The one thing. Not a list — the single finding the ranked board leads with, which is the
// same pick Coach makes (coachFocus over coachSignals), so the top of Today can never
// quietly outrank the rest of the app. It carries its own tier: the 4px rail down the
// side, and a tappable chip that opens what the claim is actually standing on.
function oneThing(){
  const f = coachFocus(coachSignals());
  if(!f) return '';
  const L = f.link;
  return `<div class="card one${rail(f.ev)}">
    ${evDrawer('ev-onething', 'The one thing', f.ev, f.src)}
    <div class="oneh">${f.h}</div>
    ${expandable(f.b)}
    ${L ? `<div class="linkrow" data-action="${L.a}"${L.view ? ` data-view="${L.view}"` : ''}${
      L.id ? ` data-id="${esc(L.id)}"` : ''}><span class="sm"><b>${esc(L.lab)}</b></span><span class="arr">→</span></div>` : ''}
  </div>`;
}

// ----- Today: The numbers (Aug 30 2026, Jack's call) -----
// EVERYTHING Today counts, in one block. A thin row of four — handicap, courses, and the two
// recovery numbers — over four tiles, in the order a hole is played: the score, then off the
// tee, then into the green, then on it. They were three separate blocks with the start button
// in between; one heading over both is what Jack asked for and it reads as one subject.
//
// SCRAMBLE AND UP & DOWN ARE A PAIR, and the footnote says so because the words do not.
// Jack's definitions, in his own words: "up and down is near green, scramble is errant drive
// safe percentage." So they are the same question asked about two different mistakes — did
// you save the hole from off the FAIRWAY, and did you save it from off the GREEN. Note his
// `scramble` is NOT the standard golf usage, which is up-and-down; that is exactly why the
// line under the row spells both out rather than trusting the labels to carry it.
//
// A tile may carry a SECOND, smaller number (`.sv`) that qualifies its headline one — the
// estimated index under the handicap, bogey-saves under scramble. That is Jack's fix for the
// two-handicaps problem and it generalises: `handicap` and `est. index` are two readings of
// one thing, and as equal tiles they read as a contradiction rather than as a figure and the
// app's own estimate of it. Subordinating one says which is which in a way no amount of
// prose underneath can. So a qualifying number belongs in the tile, small; the paragraph
// below is for what a number MEANS, not for more numbers. Three of them are `gameAreas()` read through `areaCards()` — the SAME
// reader and the same card set Coach uses, so the front page and the coach can never quote
// different fairway percentages at each other. Nothing here counts a hole for itself.
//
// What it replaced, and why, because both were live for weeks before anyone looked:
//   · 5-FT MAKES read "— · needs 2+ entries" — a mat test he has run once, so the tile that
//     led the page had never shown a number. The putting tile answers what it was reaching
//     for and does it off rounds he actually played.
//   · CARRY LADDER was a yardage, not a result: the top of the ladder is a fact about the
//     bag, it lives on Bag, and it does not move between rounds.
//   · CONDITIONS was the weather card immediately above it, said again and smaller. Jack
//     spotted it the moment the swap put the two next to each other, which is the useful
//     lesson: a duplicate is invisible until the two copies are adjacent.
//
// A tile with no data renders a dash and says what would fill it — never a zero, and never
// a hidden tile, for the same reason `sortCourses()` puts nulls last: absent and zero are
// different claims.
// The label comes from AREA_LAB and the value line is formatted exactly as Coach formats
// it, deliberately: these are the same three numbers in two places, and a tile calling it
// "Greens hit" while Coach calls the identical figure "Irons" is how one number quietly
// becomes two. One vocabulary, one reader, one card set.
function numTile(lab, view, a, empty){
  return `<div class="charttile opens" data-action="go" data-view="${view}">
    <div class="lab">${esc(lab)}</div>
    ${a ? `<div class="big">${esc(a.v)}</div>
           <div class="sub">${esc(a.u)}${a.raw ? ` · ${esc(a.raw)}` : ''}</div>`
        : `<div class="big faint">—</div><div class="sub">${esc(empty)}</div>`}
  </div>`;
}
function theNumbers(){
  const { areas: A, st } = gameAreas(areaCards().cards);
  const scored = S.rounds.filter(r => r.score);
  const last = scored.slice(-1)[0];
  const idx = estIndex();
  const miss = st.fw.n - st.fw.hit;
  const pc = (n, d) => d ? Math.round(n / d * 100) + '%' : '—';
  return `
  <h2>The numbers</h2>
  <div class="rowgrid">
    <div class="stat"><div class="v">${esc(S.profile.handicap)}</div>${
      idx != null ? `<div class="sv">${idx.toFixed(1)} est.</div>` : ''}<div class="l">Handicap</div></div>
    <div class="stat"><div class="v">${S.courses.filter(c => !c.bucket).length}</div><div class="l">Courses</div></div>
    <div class="stat"><div class="v">${pc(st.fw.saved, miss)}</div>${
      miss ? `<div class="sv">${pc(st.fw.bogey, miss)} bogey</div>` : ''}<div class="l">Scramble</div></div>
    <div class="stat"><div class="v">${A.short ? esc(A.short.v) : '—'}</div><div class="l">Up &amp; down</div></div>
  </div>
  <div class="rowgrid g2">
    <div class="charttile opens" data-action="go" data-view="rounds" data-seg="cards">
      <div class="lab">Round scores</div>
      <div class="big">${last ? esc(last.score) : '<span class="faint">—</span>'}</div>
      <div style="color:var(--btext)">${spark(scored.map(r => r.score))}</div>
      <div class="sub">${S.rounds.length} logged</div></div>
    ${numTile(AREA_LAB.tee, 'rounds', A.tee, 'no tee shots logged yet')}
    ${numTile(AREA_LAB.app, 'rounds', A.app, 'no greens logged yet')}
    ${numTile(AREA_LAB.putt, 'putting', A.putt, 'no putts logged yet')}
  </div>
  <p class="sm faint" style="margin-top:8px">${miss
    ? `<b>Scramble</b> is par or better after a missed fairway (${st.fw.saved} of ${miss}); <b>up &amp; down</b> is the same question off a missed green. `
    : 'Scramble fills in once a card records a missed fairway. '}Off the same cards Coach reads — tap any tile for the detail behind it.</p>
`;
}

// The way onto the tee, at the size of the decision. One button, which is a START when
// there is no round on the go and a RESUME when there is — the same tap for the same
// intention, exactly like the TEE button in the tab bar. The discard link only exists on
// the resume face, because there is nothing to discard on the other one.
function startRound(){
  const L = S.live;
  if(L){
    const t = liveThru(L), h = L.holes[L.cur];
    return `<button class="bigbtn" data-action="live-new">
      <span class="bb-l">Resume your round<em>${esc(L.course)}</em></span>
      <span class="bb-r">${t.n ? `${t.over > 0 ? '+' : ''}${t.over} THRU ${t.n} ›` : `HOLE ${h ? h.n : 1} ›`}</span></button>
    <div class="bbfoot"><button class="btn ghost tiny" data-action="live-discard">Discard this round</button></div>`;
  }
  // "Card ready" is a claim about the scorecards on file, so it is only made where there
  // are some — otherwise the first course he types gets eighteen placeholder par 4s and
  // the card check screen says so.
  const ready = coursesWithLayout().length;
  return `<button class="bigbtn" data-action="live-new">
    <span class="bb-l">Play a live round<em>One screen a hole · saves on every tap</em></span>
    <span class="bb-r">${ready ? 'CARD READY ›' : 'NEW CARD ›'}</span></button>`;
}

// ----- Home -----
function home(){
  const dl = daysLeft(S.settings.returnDeadline);
  const pending = pendingReturn();
  const picks = pickedLessons().slice(0,1);
  return `
  ${wxCard()}
  ${theNumbers()}
  ${startRound()}

  ${(() => {
    const p = coursePlans();
    const next = [...p.up, ...p.standing, ...p.past][0];
    const rest = p.up.length + p.standing.length + p.past.length - (next ? 1 : 0);
    return `<div class="card">
      <h2>Round prep</h2>
      ${next ? planRow(next)
      : `<p class="sm">Playing somewhere soon? Tell Claude the course and day — a briefing built for <i>your</i> game (tee strategy, key holes, lay-up numbers off your ladder, greens notes) lands here before the round. Your standing plans (Swing Focus, Swing Positions, Swing Thoughts) live in the <b>Swing</b> lab, and the at-home training lives in <b>Coach</b>.</p>`}
      ${rest > 0 ? `<div class="linkrow" data-action="go" data-view="rounds" data-seg="prep">
        <span class="sm"><b>All round prep</b> · ${rest} more plan${rest === 1 ? '' : 's'} on file</span><span class="arr">→</span></div>` : ''}
      ${S.live ? '' : `<div class="linkrow" data-action="live-new">
        <span><b>Play a live round</b><br><span class="sm">Tap each hole in as you go — clubs, fairways, greens, putts</span></span><span class="arr">→</span></div>`}
      <div class="linkrow" style="border-bottom:none;padding-bottom:0"
        data-action="cheat-open" data-disc="${next ? 'prep' : 'swing'}">
        <span><b>⚡ Cheat sheet</b><br><span class="sm">The pre-round read — course, swing, short game, putting, mental</span></span><span class="arr">→</span></div>
    </div>`;
  })()}

  ${oneThing()}

  ${picks.length ? `<div class="card">
    <h2>From your coach today</h2>
    ${picks.map(p => tipHTML(p)).join('')}
    <button class="btn ghost tiny" data-action="go" data-view="coach">All lessons →</button>
  </div>` : ''}

  ${whatsNew()}

  ${!pending ? '' : `
  <div class="card">
    <h2>Putter return window</h2>
    <h3>${dl===null ? 'Deadline not set' : dl + ' days left on the ' + esc(pending.name)}</h3>
    <p class="sm">${dl===null
      ? `<span class="warn">Deadline unknown</span> — the ${esc(pending.name)} is still returnable and nothing here knows until when. Find the receipt, confirm the window with the shop, and set it below.`
      : S.settings.deadlineEstimated ? '<span class="warn">Estimated deadline</span> — confirm the real one with the shop and update it below.' : 'Deadline confirmed.'}</p>
    <div class="formrow" style="margin-top:8px">
      <div><label>Deadline</label><input type="date" id="deadlineInput" value="${esc(S.settings.returnDeadline||'')}"></div>
      <div style="align-self:end"><button class="btn ghost" data-action="save-deadline">Save deadline</button></div>
    </div>
    <p class="sm" style="margin-top:8px"><button class="btn tiny burg" data-action="go" data-view="decisions">Open the decision tracker →</button></p>
  </div>`}

  <div class="card flat">
    <div class="linkrow" data-action="go" data-view="decisions"><b>Decisions</b><span class="arr">→</span></div>
    <div class="linkrow" data-action="go" data-view="data"><b>Data & backup</b><span class="arr">→</span></div>
  </div>`;
}

function tipHTML(p){
  const read = S.lessonsRead.includes(p.l.id);
  return `<div class="tipcard" data-action="open-lesson" data-id="${p.l.id}" style="cursor:pointer">
    <div class="src">${esc(p.l.shelf)} · ${p.l.min} min read${read?' · read ✓':''}</div>
    <h4>${esc(p.l.title)}</h4>
    <p class="sm">${esc(p.l.body.slice(0,140))}…</p>
    <div class="why">Why you're seeing this: ${esc(p.why)}.</div>
  </div>`;
}

// ----- Bag -----
// Order the bag the way it sits in real life: driver → woods → hybrids →
// irons → wedges → putter, then by loft within each category.
const CAT_RANK = { wood:0, hybrid:1, iron:2, wedge:3, putter:4, ball:5, other:6 };
function clubLoft(c){
  if(typeof c.loft === 'number') return c.loft;
  const deg = ((c.spec || '') + ' ' + (c.name || '')).match(/(\d+(?:\.\d+)?)\s*°/);
  if(deg) return parseFloat(deg[1]);
  const iron = (c.name || '').match(/(\d+)\s*-?\s*iron/i);   // "2-iron" sorts ahead of the 4–PW set
  if(iron) return 15 + parseInt(iron[1], 10) * 3.5;
  return 999;
}
const bagSort = (a, b) => (CAT_RANK[a.cat] ?? 5) - (CAT_RANK[b.cat] ?? 5) || clubLoft(a) - clubLoft(b);
// The mono type label down the left of a roster row. It is read off the club's OWN NAME
// wherever the name says what the club is ("Utility 2-iron" → UTILITY, "5-wood" → 5-WOOD),
// and off its loft where the name doesn't, so nothing here is a classification invented on
// the club's behalf. Anything unrecognised falls back to the category, which is data.
function clubType(c){
  const n = c.name || '';
  if(c.cat === 'putter') return 'PUTTER';
  if(c.cat === 'wedge') return c.loft ? `${c.loft}° WEDGE` : 'WEDGE';
  if(/mini\s*driver/i.test(n)) return 'MINI DRIVER';
  if(/driver/i.test(n)) return 'DRIVER';
  const wood = n.match(/(\d+)\s*-?\s*wood/i);
  if(wood) return `${wood[1]}-WOOD`;
  if(/utility/i.test(n)) return 'UTILITY';
  const iron = n.match(/(\d+)\s*-?\s*iron/i);
  if(iron) return `${iron[1]}-IRON`;
  if(c.cat === 'iron') return 'IRONS';
  return String(c.cat || 'club').toUpperCase();
}
// The Vokey shorthand, composed out of the club's real loft and its real spec string —
// "50.08F" is loft, bounce and grind, and every one of those three is on `S.clubs`. Where
// the spec doesn't carry a bounce and a grind (every club that isn't a wedge), this is
// simply the loft, and where there is no loft either it is the spec as written.
function wedgeSpec(c){
  const m = /(\d+(?:\.\d+)?)\s*°?\s*bounce\s*·?\s*([A-Z])\s*grind/i.exec(c.spec || '');
  return m && c.loft ? `${c.loft}.${String(Math.round(+m[1])).padStart(2, '0')}${m[2].toUpperCase()}` : null;
}
// The loft line, and it will only print a loft it can actually SOURCE. `clubLoft()` guesses
// one from the iron number so the bag can be sorted, which is fine for an ordering and a
// lie about a club: the KING TEC utility comes out of it at 22° when the record says ~17°.
// So: the club's own `loft`, else a degree figure written in its spec, else the ladder
// row's loft, else the spec's own first phrase. A putter's spec carries a LIE angle rather
// than a loft, and an iron SET has no single loft at all — both are named, not numbered.
function clubSpecLine(c){
  const head = () => (c.spec || '').split('·')[0].replace(/\(.*?\)/g, '').trim().toUpperCase();
  const w = wedgeSpec(c);
  if(w) return w;
  if(c.cat === 'putter') return head() || 'PUTTER';
  if(typeof c.loft === 'number') return `${c.loft}°`;
  const deg = ((c.spec || '') + ' ' + (c.name || '')).match(/(\d+(?:\.\d+)?)\s*°/);
  if(deg && clubType(c) !== 'IRONS') return `${deg[1]}°`;
  const row = carryRow(c);
  if(row && row.loft) return String(row.loft);
  return head();
}
// A bag club, joined to its row on the carry ladder. `clubAbbr()` is the app's existing
// authority for turning a club name into a short key, so running it over both sides is a
// join the app already trusts everywhere else rather than a new piece of string-matching —
// and it is deliberately strict: an abbreviation that fell through to the name-slice
// fallback is not a match, and the iron SET matches nothing, which is right, because it
// spans seven ladder rows and no single one of them is "the irons".
const ABBR_OK = /^(Mini|Dr|PW|\d+i|\d+°|\d+W)$/;
// Hyphens are spelling, not meaning: the bag says "5-wood" and the ladder says "5 wood".
// Normalised here rather than in clubAbbr(), which is what every saved card's club chip
// renders through and is not worth disturbing for a join.
const abbrOf = n => clubAbbr(String(n || '').replace(/[-–—]/g, ' '));
function carryRow(c){
  if(c.cat === 'wedge' && c.loft) return S.carries.find(x => x.club === `${c.loft}° wedge`) || null;
  const k = abbrOf(c.name);
  if(!ABBR_OK.test(k)) return null;
  return S.carries.find(x => abbrOf(x.club) === k) || null;
}
const ladderLoft = row => { const m = /(\d+(?:\.\d+)?)/.exec(row.loft || ''); return m ? +m[0] : null; };
// Two clubs within a degree and a half of each other on the ladder are fighting for one
// number — the classic gapping trap, and in this bag a live question rather than a general
// one. It is arithmetic over the ladder's own lofts, so it says nothing the data doesn't.
function ladderOverlap(row){
  const i = S.carries.indexOf(row), l = ladderLoft(row);
  if(i < 0 || l == null) return null;
  return [S.carries[i - 1], S.carries[i + 1]].find(o => {
    const ol = o ? ladderLoft(o) : null;
    return ol != null && Math.abs(ol - l) <= 1.5;
  }) || null;
}
// The status pill. Every state here is something the club's own record SAYS, never a read
// of its notes: a closed return window is `returnWindow:false`, an unmeasured carry is a
// null on the ladder row, an overlap is two ladder lofts inside a degree and a half. A club
// with none of them in play is simply in the bag.
function clubPill(c){
  const mismatch = c.cat === 'putter' && c.flow === 'toe' && S.profile.stroke === 'SBST';
  if(mismatch) return ['MISMATCH', 'p-burg'];
  if(c.returnWindow === true) return ['IN RETURN WINDOW', 'p-gold'];
  if(c.returnWindow === false) return ['DECIDED', 'p-burg'];
  if(c.status === 'ordered') return ['ON ORDER', 'p-gold'];
  if(c.status === 'wishlist') return ['SCOUTING', 'p-gold'];
  if(c.status !== 'gaming') return ['BENCHED', 'p-plain'];
  const row = carryRow(c);
  if(row && row.carry == null) return ['UNMEASURED', 'p-gold'];
  if(row && ladderOverlap(row)) return ['OVERLAP', 'p-gold'];
  return ['IN PLAY', 'p-green'];
}
// The roster row: what it is, what it is, what it measures, and where it stands.
function clubRow(c){
  const [pill, pcls] = clubPill(c);
  const row = carryRow(c);
  const mismatch = c.cat === 'putter' && c.flow === 'toe' && S.profile.stroke === 'SBST';
  const ov = row ? ladderOverlap(row) : null;
  return `<div class="crow">
    <div class="ct">${esc(clubType(c))}</div>
    <div class="cm">
      <div class="cn">${esc(c.name)}</div>
      <div class="cs">${esc(clubSpecLine(c))}${row && row.carry != null ? ` · carries ${row.carry}` : ''}${
        row && row.carry == null ? ' · carry unmeasured' : ''}</div>
      ${c.note ? expandable(c.note) : ''}
      ${mismatch ? `<p class="sm warn">Toe-flow head on your straight (SBST) stroke — see Decisions.</p>` : ''}
      ${ov ? `<p class="sm faint">Sits ${Math.abs(ladderLoft(ov) - ladderLoft(row)).toFixed(1)}° off the
        ${esc(ov.club)} on the ladder.</p>` : ''}
      ${c.cat === 'wedge' && c.status === 'gaming'
        ? `<div class="meter grn" title="groove life"><span style="width:${groovePct(c)}%"></span></div>
           <div class="sm faint">Groove life ${groovePct(c)}% · ${c.rounds || 0} rounds</div>` : ''}
    </div>
    <div class="cp"><span class="pill ${pcls}">${esc(pill)}</span></div>
  </div>`;
}
// ----- Grinds & bounce -----
// The one explanatory block in the bag, and it is here because the three wedges are three
// deliberately different tools and nothing on the card said so. The letters and bounces are
// read out of `S.clubs` — his real Vokey specs — and the copy explains what those numbers
// mean, which is knowledge about wedges rather than a claim about his game. The one claim
// about his game is the closing note, and it says it is UNMEASURED, because it is.
const GRIND_LORE = {
  F:['Full sole', 'The sweeper. A full, unrelieved sole with the most material behind the leading edge — it resists digging on a square face and a shallow strike. Built for full swings, which is what this club mostly gets.', 'FULL SWINGS · SQUARE FACE'],
  S:['Sole grind, trailing-edge relief', 'The workhorse. Heel and trailing edge trimmed just enough to sit down on a slightly open face without the leading edge lifting. Mid bounce, so it works on firm and normal turf alike — the reason it can take full shots, half shots and bunker shots all day.', 'DO-EVERYTHING · FULL TO OPEN'],
  M:['Crescent, heel-toe-trailing relief', 'The creative one. Material removed from heel, toe and trailing edge so the face can open wide, lie flat, and slide under the ball without the leading edge rising. Low bounce, so it wants a shallow attack and firm-to-normal turf — it punishes a steep, digging strike.', 'FLOPS · SPLASH · OPEN FACE'],
  K:['Widest sole, highest bounce', 'The widest, highest-bounce sole Vokey makes. A bunker specialist for soft sand and fluffy lies — it refuses to dig, which is exactly why it is clumsy off a tight fairway.'],
  D:['Crescent with high bounce', 'The M shape with the bounce turned up. Made for a steep, digging attack angle: the relief lets you open it, and the bounce keeps a steep strike from burying.'],
  L:['Fully relieved, very low bounce', 'The most relieved sole in the range. Firm turf and tight lies only, and it demands a shallow, precise strike — a low-handicap tool with almost no margin.'],
  T:['Narrow tour sole, low bounce', 'A narrow, tour-shaped low-bounce sole. Similar brief to the L, made for players who slide the club rather than dig it.'],
};
// Bands are inclusive of their top figure and matched in order, so an 8° sole reads LOW and
// a 12° reads MID — which is how a fitter would call them, and how Jack's three land.
const BOUNCE_BANDS = [
  ['LOW · 4–8°', 'Firm turf, tight lies, a shallow attack. Less protection from a fat strike.', 4, 8],
  ['MID · 8–12°', 'The all-conditions band. Forgiving on both turf types and out of sand.', 8, 12],
  ['HIGH · OVER 12°', 'Soft turf, fluffy sand, a steep attack. Skids rather than digs — and can bounce off firm ground into the middle of the ball.', 12, 99],
];
function grindsCard(wedges){
  const mine = wedges.map(w => {
    const m = /(\d+(?:\.\d+)?)\s*°?\s*bounce\s*·?\s*([A-Z])\s*grind/i.exec(w.spec || '');
    return m ? { w, bounce:+m[1], g:m[2].toUpperCase() } : null;
  }).filter(Boolean);
  if(!mine.length) return '';
  const band = b => BOUNCE_BANDS.findIndex(([, , lo, hi]) => b >= lo && b <= hi);
  const absent = ['K', 'D', 'L', 'T'].filter(k => !mine.some(x => x.g === k));
  return `
  <p class="sm"><b>Bounce</b> is the angle between the leading edge and the sole — how hard the
    club resists digging. <b>Grind</b> is what has been shaved off that sole, which decides how
    the club sits when you open the face. Your three are deliberately different tools.</p>
  ${mine.map(x => `<div class="grind">
    <div class="gl">${esc(x.g)}</div>
    <div class="gm">
      <div class="gs">${esc(x.w.loft ? `${x.w.loft}°` : '')} · ${x.bounce}° BOUNCE${
        wedgeSpec(x.w) ? ` · ${esc(wedgeSpec(x.w))}` : ''}</div>
      <div class="gn">${esc(GRIND_LORE[x.g] ? GRIND_LORE[x.g][0] : 'Grind')}</div>
      <p class="sm">${esc(GRIND_LORE[x.g] ? GRIND_LORE[x.g][1] : '')}</p>
      ${GRIND_LORE[x.g] && GRIND_LORE[x.g][2] ? `<div class="gu">${esc(GRIND_LORE[x.g][2])}</div>` : ''}
    </div>
  </div>`).join('')}
  <div class="bbands">${BOUNCE_BANDS.map(([lab, body], i) => {
    const here = mine.filter(x => band(x.bounce) === i);
    return `<div class="bband">
      <div class="bl">${esc(lab)}</div>
      <p class="sm">${esc(body)}</p>
      <div class="bm ${here.length ? '' : 'none'}">${here.length
        ? esc(here.map(x => `your ${x.w.loft}°`).join(' · ')) : 'nothing of yours here'}</div>
    </div>`; }).join('')}
  ${absent.length ? `<p class="sm" style="margin-top:10px"><b>The grinds you don't have</b>, and why
    each exists — so the three above read as choices rather than as what came in the box.</p>
  ${absent.map(k => `<div class="gabs"><span class="gk">${esc(k)}</span>
    <span class="sm"><b>${esc(GRIND_LORE[k][0])}.</b> ${esc(GRIND_LORE[k][1])}</span></div>`).join('')}` : ''}
  <div class="goldnote">
    <div class="gnl">What this cannot tell you</div>
    <p class="sm">Whether the M grind on the 60° suits your attack angle is a <b>measurement</b>
      question, and no film of your pitching motion exists. A low-bounce crescent is the least
      forgiving choice there is for a steep, digging strike — and nothing on file says which kind
      of strike you have. Until there is film, this section describes the tools, not the fit.</p>
  </div>`;
}
// ----- The carry ladder -----
// Bars against a fixed 300-yard scale, so the shape of the ladder is the shape of the bag
// and every row shares one axis. Three rules the design turns on: the CARRY LIVES IN ITS
// OWN COLUMN and never inside the bar (an editable number laid over a coloured bar is
// unreadable in sun and untappable with a thumb); a null carry draws NO BAR at all, because
// a guessed length is a measurement claim; and the ESTIMATED badge appears only while
// `S.carriesCalibrated` is false — once he has calibrated, saying otherwise would be a lie
// about his own numbers.
const LADDER_MAX = 300;
function ladderCard(){
  const pf = playsFactor();
  return `
  ${S.carriesCalibrated ? '' : `<div class="goldnote">
    <div class="gnl">Estimated · not calibrated</div>
    <p class="sm">No number here has been measured yet — they are starting points for your game.
      Edit any row as a real carry comes in from the range or the course.</p>
  </div>`}
  <div class="ladr">${S.carries.map((c, i) => {
    const next = S.carries[i + 1];
    const gap = next && c.carry && next.carry ? c.carry - next.carry : null;
    return `<div class="lrow">
      <span class="lc">${esc(clubAbbr(c.club))}</span>
      <span class="lb">${c.carry != null
        ? `<i style="width:${Math.min(100, Math.round(c.carry / LADDER_MAX * 100))}%"></i>`
        : '<em>unmeasured</em>'}</span>
      <span class="lv"><input data-carry="${i}" inputmode="numeric" value="${c.carry ?? ''}" placeholder="—">${
        pf && c.carry ? `<b>${Math.round(c.carry * pf)} today</b>` : ''}</span>
      <span class="lg ${gap !== null && (gap >= 15 || gap <= 5) ? 'wide' : ''}">${
        gap !== null ? `${gap}` : '·'}</span>
    </div>`; }).join('')}</div>
  <div class="lfoot"><span>0</span><span>${LADDER_MAX} yd scale</span></div>
  <button class="btn ghost tiny" data-action="save-carries">Save carries</button>
  ${pf ? `<p class="sm faint" style="margin-top:8px">"Today" = carry adjusted for ${Math.round(S.weather.t)}°F air (${
    pf > 1 ? '+' : ''}${((pf - 1) * 100).toFixed(1)}%).</p>` : ''}
  <div class="goldnote">
    <div class="gnl">The ladder IS the roster</div>
    <p class="sm">This list is what the live logger offers you off the tee and into the green, so
      it stays as long as the bag is — a club leaving or joining is a ladder change as much as a
      bag change. Gap column: <b>15 yd or more</b> is a hole in the bag, <b>5 or less</b> is two
      clubs fighting for one number.</p>
  </div>`;
}
function bag(){
  const lineup = S.clubs.filter(c => c.status === 'gaming' || c.status === 'ordered').sort(bagSort);
  const bullpen = S.clubs.filter(c => c.status === 'backup').sort(bagSort);
  const wishlist = S.clubs.filter(c => c.status === 'wishlist').sort(bagSort);
  const wedges = S.clubs.filter(c => c.cat === 'wedge' && c.loft).sort((a, b) => a.loft - b.loft);
  // Grouped the way the bag is carried: the long clubs, the irons, the wedges, the putter.
  // Every group is drawn from `S.clubs` by CATEGORY, so a club can only appear where its own
  // record puts it, and an empty group doesn't render.
  const GROUPS = [['Woods &amp; long clubs', ['wood', 'hybrid']], ['Irons', ['iron']],
    ['Wedges', ['wedge']], ['Putter', ['putter']], ['Everything else', ['ball', 'other']]];
  const groups = GROUPS.map(([lab, cats]) => [lab, lineup.filter(c => cats.includes(c.cat))])
    .filter(([, cs]) => cs.length);
  return `
  <div class="card">
    ${fold('bag-roster', 'In the bag', `${lineup.length} CLUB${lineup.length === 1 ? '' : 'S'}`,
      groups.length ? groups.map(([lab, cs]) => `<div class="cgrp">${lab}</div>
        ${cs.map(clubRow).join('')}`).join('')
        : '<p class="sm faint">Nothing gaming yet.</p>')}
  </div>

  ${wedges.length ? `<div class="card">
    ${fold('bag-grinds', 'Grinds & bounce', `${wedges.length} WEDGES`, grindsCard(wedges), false)}
  </div>` : ''}

  ${bullpen.length || wishlist.length ? `<div class="card bench">
    ${fold('bag-bench', 'On the bench', `${bullpen.length + wishlist.length} OWNED, NOT IN THE 14`, `
      ${bullpen.map(clubRow).join('')}
      ${wishlist.length ? `<div class="cgrp">Scouting list</div>${wishlist.map(clubRow).join('')}` : ''}
      <p class="rdf">Kept, not gone. What a benched club did is still true — the mini driver's
        tee-shot record stays in the off-the-tee table as history, it just stops accumulating.</p>`, false)}
  </div>` : ''}
  <div class="formrow" style="margin-top:6px">
    <button class="btn" data-action="show-add-club">+ Add a club</button>
  </div>
  <div id="addClubForm" class="card" style="display:none">
    <div class="cgrp">New club</div>
    <label>Name</label><input id="clNa" placeholder="e.g. TaylorMade Qi35 driver">
    <div class="formrow">
      <div><label>Category</label><select id="clCat"><option value="wood">Driver / wood</option><option value="hybrid">Hybrid</option><option value="iron">Irons</option><option value="wedge">Wedge</option><option value="putter">Putter</option><option value="ball">Ball</option><option value="other">Other</option></select></div>
      <div><label>Status</label><select id="clSt"><option value="gaming">Starting lineup</option><option value="ordered">On order</option><option value="backup">Bullpen</option><option value="wishlist">Scouting list</option></select></div>
    </div>
    <label>Specs (loft, shaft, flex…)</label><input id="clSp" placeholder="e.g. 9° · Ventus Blue 6S">
    <label>Notes</label><input id="clNo" placeholder="Why it's in the bag">
    <div style="margin-top:10px"><button class="btn" data-action="add-club">Save club</button></div>
  </div>

  ${(() => {
    // The wear counters used to live on Home. Home is the what's-changed page now, and
    // these belong with the clubs they describe anyway: the groove meter is already on
    // every wedge card above, and the grip count had nowhere else at all.
    const w = S.clubs.filter(c => c.cat === 'wedge' && c.status === 'gaming')
      .sort((a, b) => groovePct(a) - groovePct(b))[0];
    return `<h2>Wear</h2>
    <div class="card">
      <p class="sm"><b>Grips</b> — round ${S.settings.gripRounds} of ~${GRIP_LIFE} before a regrip.${
        w ? ` <b>Grooves</b> — the ${esc(w.name)} is the most worn face in the bag at ${groovePct(w)}% of its ${GROOVE_LIFE}-round life; spin drops noticeably below ~50%.` : ''}</p>
      ${w ? `<div class="meter grn"><span style="width:${groovePct(w)}%"></span></div>` : ''}
      <p class="sm faint" style="margin-top:8px">Both counters advance automatically every time you log a round, however you logged it.</p>
    </div>`;
  })()}

  <div class="card">
    ${fold('bag-ladder', 'Carry ladder',
      S.carriesCalibrated ? `${S.carries.length} CLUBS` : 'ESTIMATED · NOT CALIBRATED', ladderCard())}
  </div>

  ${wedges.length ? `<h2>Wedge gapping ladder</h2>
  <div class="card">${ladderHTML(wedges)}</div>` : ''}

  <h2>Wedge yardage matrix</h2>
  <div class="card">
    <p class="sm">Carries per swing length — fill in from a range session (Lesson: "The clock system").</p>
    <table><tr><th>Club</th><th>½ (9:00)</th><th>¾ (10:30)</th><th>Full</th></tr>
      ${Object.keys(S.matrix).map(L => `<tr><td><b>${L}°</b></td>
        ${['h','t','f'].map(k => `<td><input data-matrix="${L}.${k}" inputmode="numeric" style="width:56px;text-align:center;padding:6px 4px" value="${S.matrix[L][k] ?? ''}" placeholder="—"></td>`).join('')}
      </tr>`).join('')}
    </table>
    <button class="btn ghost tiny" data-action="save-matrix">Save carries</button>
  </div>

  <div class="card">
    ${fold('bag-history', 'Bag history', `${S.bagHistory.length} CHANGES`, `
      <div class="bhist">${S.bagHistory.map(h => `<div class="bhr">
        <span class="d">${esc(h.date)}</span><span class="t">${esc(h.text)}</span></div>`).join('')}</div>
      <div class="formrow" style="margin-top:10px">
        <input id="newHist" placeholder="Log a change (what & why)…">
        <button class="btn ghost" data-action="add-history">Log it</button>
      </div>`, false)}
  </div>`;
}

// `clubCard()` — the old boxed club tile — was removed on Aug 27 2026 when the roster
// became a grouped list. `clubRow()` above replaces it, and nothing else rendered it.

function ladderHTML(wedges){
  const pw = S.pwLoft;
  const lofts = [pw, ...wedges.map(w=>w.loft)];
  const span = lofts[lofts.length-1] - pw;
  let marks = `<div class="mk pw" style="left:0%"><div class="pin"></div><div class="lab">${pw}°</div><div class="nm">PW</div></div>`;
  let gaps = '';
  for(let i=1;i<lofts.length;i++){
    const left = (lofts[i]-pw)/span*100;
    const mid = ((lofts[i]+lofts[i-1])/2-pw)/span*100;
    const w = wedges[i-1];
    marks += `<div class="mk" style="left:${left}%"><div class="pin"></div><div class="lab">${lofts[i]}°</div><div class="nm">${esc((w.spec||'').split('·')[0].trim())}</div></div>`;
    gaps += `<div class="gapb" style="left:${mid}%">${lofts[i]-lofts[i-1]}°</div>`;
  }
  return `<div class="ladder">${gaps}${marks}</div>
    <p class="sm faint">Off the ${pw}° PW. Repeatedly stuck between clubs at one yardage? That's the sign to revisit this (Lesson: "Loft gaps beat brand loyalty").</p>`;
}

// ----- Putting Lab -----
// A session belongs to the Swing Lab if its setup names the full swing or a
// full-swing club; everything else (the putter project) stays in the Putting Lab.
// Read setup only — putting findings mention "backswing", which must not match.
function sessionDiscipline(s){
  const t = s.setup || '';
  if(/chip|pitch|bunker|short[\s-]?game|greenside/i.test(t)) return 'short-game';
  return /full[\s-]?swing|driver|\biron\b|\bwedge\b|mini/i.test(t) ? 'swing' : 'putting';
}

// ----- Stroke evolution grid -----
// The grid IS the interface. Seven verdicts running to paragraphs used to print in
// full under the table, which made the most useful block on the page the one you
// scroll past. Every row now shows its marks and a two-or-three-word STATE, and its
// reasoning is one tap away. Two things moved out of this function and into the DATA
// so a future rebuild is a feed push rather than an app change: the per-column blurbs
// (`notes`, parallel to `sessions`) and the closing footnote (`foot`). A metric with
// no `state` renders without one, so an older grid still reads.
function evolutionCard(){
  const e = S.evolution;
  if(!e || !e.metrics || !e.metrics.length) return '';
  const sc = { good:'var(--green)', warn:'var(--burg)', mid:'var(--ink)' };
  const mc = mk => mk === '\u2713' ? 'var(--green)' : mk === '\u2717' ? 'var(--burg)' : 'var(--faint)';
  const notes = e.notes || [];
  return `<div class="card">
    <p class="sm faint" style="margin-bottom:6px">Tap a row for the reasoning behind it.</p>
    <div class="evo" style="--n:${e.sessions.length}">
      <div class="evohead"><span></span>${e.sessions.map(x => `<span>${esc(x)}</span>`).join('')}</div>
      ${e.metrics.map(m => `<details class="evorow" id="evo-${slug(m.name)}">
        <summary><span class="evon"><b>${esc(m.name)}</b>${m.state
          ? `<span class="evos" style="color:${sc[m.s] || 'var(--ink)'}">${esc(m.state)}</span>` : ''}</span>${
          m.marks.map(mk => `<span class="evom" style="color:${mc(mk)}">${esc(mk)}</span>`).join('')}</summary>
        <p class="sm">${esc(m.verdict)}</p>
      </details>`).join('')}
    </div>
    <p class="sm faint" style="margin-top:10px">\u2713 good \u00b7 \u2717 fault \u00b7 ~ partial \u00b7 ? that angle couldn't see it \u00b7 \u2014 not assessed.
    A dash means that batch couldn't answer that row, not that it went badly.</p>
    ${notes.length ? `<details class="more"><summary>What the ${e.sessions.length} columns are</summary>
      ${e.sessions.map((x,i) => `<p class="sm" style="margin:5px 0"><b>${esc(x)}</b> \u2014 ${esc(notes[i] || '')}</p>`).join('')}
      ${e.foot ? `<p class="sm faint" style="margin-top:7px">${esc(e.foot)}</p>` : ''}
    </details>` : ''}
  </div>`;
}

// ----- The film room log -----
// The lab pages get a SCANNABLE list, not the full text. Findings here run to
// paragraphs, and three table columns at phone width turned the log into a wall of
// prose you had to read to navigate. A row is now the date, how big the batch was,
// and ONE line saying what it concluded; the whole breakdown stays one tap away in
// sessionView(). Same rule as a briefing section's `k`: an authored one-liner wins,
// the finding's opening sentence is the fallback, so older sessions still read fine.
// Write `detail.gist` on any session whose finding does not open with its headline.
function sessionGist(s){
  if(s.detail && s.detail.gist) return s.detail.gist;
  const lead = splitLead(s.finding)[0];
  return lead.length > 150 ? lead.slice(0, 132).replace(/\s+\S*$/, '') + '…' : lead;
}
// "23 clips" off the front of the setup line. Filmed sessions all start with a count;
// one he logs himself by hand usually doesn't, and then the chip is simply absent.
function sessionSize(s){
  const m = /(\d+)\s*(?:phone\s+)?(clips?|strokes?|stills?|putts?)/i.exec(s.setup || '');
  return m ? m[1] + ' ' + m[2].toLowerCase() : '';
}
// NEWEST FIRST everywhere — a log you scan reads down from the last time you filmed.
function sessionLog(list, empty){
  if(!list.length) return `<p class="sm">${empty}</p>`;
  return `<p class="sm faint" style="margin-bottom:2px">Tap a session for the full film breakdown.</p>
  ${list.map(({s,i}) => `<div class="seslog" data-action="open-session" data-i="${i}">
    <div class="sesh"><b>${fmtDate(s.date)}</b><span class="sesm">${esc(sessionSize(s))}${s.detail ? ' ▸' : ''}</span></div>
    <div class="sesg">${esc(sessionGist(s))}</div>
  </div>`).join('')}`;
}

// ----- Lab plan blocks -----
// Pre-shot routines head every lab: they're what you read standing on the first tee,
// so they sit above the diagnosis rather than buried under it.
const isRoutine = b => /routine/i.test(b.course || '');
// Which standing plans belong to a lab — ONE source, shared by the lab views, the hub
// rows and the cheat sheet. The swing lab is the catch-all for any plan with no
// discipline, EXCEPT course plans, which have none by design and belong to Round Prep
// (that's the Aug 14 audit fix — Sterling Farms was rendering as a swing plan).
function plansFor(disc){
  if(disc !== 'swing') return S.briefings.filter(b => !b.date && b.discipline === disc);
  const known = S.courses.map(c => c.name);
  return S.briefings.filter(b => !b.date
    && !['putting','mental','short-game'].includes(b.discipline || 'swing')
    && !known.some(n => courseMatches(b.course, n)));
}
function planLinks(list){
  return list.map(b => `<div class="linkrow" data-action="open-briefing" data-id="${b.id}">
      <span><b>${esc(b.course)}</b><br><span class="sm clip2">${esc(b.focus || 'Plan ready')}</span></span><span class="arr">→</span></div>`).join('');
}
function routineBlock(plans){
  const r = plans.filter(isRoutine);
  return r.length ? `<h2>Pre-round · routine</h2>
  <div class="card">${planLinks(r)}</div>` : '';
}

// ----- Pre-round cheat sheet -----
// One screen, read in the parking lot. Nothing on it is authored twice: the chips are
// the lead plan's own rules[], the focus line is that plan's focus, and the watch list
// is the open faults off the diagnosis card — so the sheet updates itself whenever a
// feed entry updates the plan or settles a fault, with no second copy to keep current.
function cheatBtn(disc){
  return `<button class="cheatbtn" data-action="cheat-open" data-disc="${disc}">⚡ Cheat sheet<span>the pre-round read · one screen</span></button>`;
}
// A rule chip compressed to the phrase you act on. The plans author their rules with
// the payload up front ("Set the face BARELY OPEN — that's your square"), so the lead
// clause IS the cue; the reasoning stays one tap away in the full plan.
function cheatCue(r){
  let t = String(r || '').trim();
  if(t.length <= 44) return t;
  const dash = t.split(/\s+[—–]\s+/)[0];
  if(dash.length <= 52) return dash;
  t = splitLead(dash)[0];
  if(t.length <= 52) return t;
  t = t.split(/,\s/)[0];
  return t.length <= 56 ? t : t.slice(0, 52).replace(/\s+\S*$/, '') + '…';
}
// Per-lab art — a picture instead of a paragraph. Like the Swing Positions guide this
// is hardcoded presentation, and it draws the standing plans' HEADLINE instructions:
// if a plan's headline changes (the face call, the landing-spot rule, the guard-the-
// start read), the drawing here has to change with it. Theme-aware via CSS vars.
const CHEAT_ART = {
  swing(){
    // The two positions the whole plan hangs on: address, and the top — where the
    // laid-off re-route starts and the ONE thought (trail elbow) does its work.
    const d = posData();
    return `<div class="sheetart"><div class="duo">
      <div>${posSvg(d[0])}<div class="cap">Address · 50/50, hinge from the hips</div></div>
      <div>${posSvg(d[2])}<div class="cap">Top · trail elbow DOWN &amp; IN FRONT</div></div>
    </div></div>`;
  },
  putting(){
    // Overhead, drawn for a RIGHT-hander: you stand at the bottom of the frame facing
    // the ball, so the target is off to your LEFT — hole left, ball in front of you,
    // putter head behind it on the right, shaft running back down to your hands.
    // The stance is drawn on purpose: without feet a horizontal line diagram reads
    // the same for a lefty, which is exactly the confusion this replaces.
    // OPEN for a righty here = the face turned CLOCKWISE off the line (SVG rotate is
    // clockwise), so the arc arrow at the toe has to swing right. Flip either one and
    // the picture starts teaching the miss instead of the fix.
    const INK='var(--ink)', GRN='var(--gtext)', FNT='var(--faint)';
    return `<div class="sheetart"><svg viewBox="0 0 320 128" role="img" aria-label="Overhead for a right-hander: hole left, face barely open, read pace before break">
      <line x1="48" y1="50" x2="238" y2="50" style="stroke:${FNT};stroke-width:1.5;stroke-dasharray:5 5;opacity:.7"/>
      <circle cx="32" cy="50" r="9" style="fill:none;stroke:${INK};stroke-width:2.5"/>
      <circle cx="32" cy="50" r="2.5" style="fill:${FNT}"/>
      <rect x="264" y="35" width="5" height="30" rx="2" style="fill:none;stroke:${FNT};stroke-width:1.5;stroke-dasharray:3 3"/>
      <g transform="rotate(9 266.5 50)">
        <rect x="264" y="35" width="5" height="30" rx="2" style="fill:${GRN}"/>
        <line x1="269" y1="56" x2="288" y2="92" style="stroke:${GRN};stroke-width:3;stroke-linecap:round"/>
      </g>
      <circle cx="250" cy="50" r="6.5" style="fill:#fff;stroke:${INK};stroke-width:2"/>
      <path d="M 258 27 A 22 22 0 0 1 274 30" style="fill:none;stroke:${GRN};stroke-width:2"/>
      <polygon points="279,32 269,26 269,35" style="fill:${GRN}"/>
      <text x="312" y="16" text-anchor="end" style="fill:${GRN};font:800 11px var(--sans)">Face BARELY OPEN — that IS your square</text>
      <ellipse cx="232" cy="104" rx="13" ry="6" transform="rotate(-20 232 104)" style="fill:${INK};opacity:.75"/>
      <ellipse cx="272" cy="107" rx="13" ry="6" style="fill:${INK};opacity:.75"/>
      <text x="316" y="126" text-anchor="end" style="fill:${FNT};font:italic 9px var(--sans)">your stance · ball inside the lead heel</text>
      <path d="M 196 76 q -28 -13 -54 0 q -24 11 -46 2" style="fill:none;stroke:${INK};stroke-width:2;opacity:.55"/>
      <polygon points="88,76 98,71 97,80" style="fill:${INK};opacity:.55"/>
      <text x="10" y="97" style="fill:${INK};font:800 11px var(--sans)">Read PACE first — break second</text>
    </svg></div>`;
  },
  'short-game'(){
    const INK='var(--ink)', GRN='var(--gtext)', FNT='var(--faint)', BURG='var(--btext)';
    return `<div class="sheetart"><svg viewBox="0 0 320 112" role="img" aria-label="Pick a landing spot and take the lowest shot that works">
      <line x1="8" y1="96" x2="312" y2="96" style="stroke:${FNT};stroke-width:1.5"/>
      <rect x="150" y="93.5" width="162" height="5" rx="2.5" style="fill:${GRN};opacity:.45"/>
      <ellipse cx="122" cy="96" rx="20" ry="4.5" style="fill:${FNT};opacity:.5"/>
      <line x1="282" y1="93" x2="282" y2="40" style="stroke:${INK};stroke-width:2"/>
      <polygon points="282,40 300,46 282,52" style="fill:${BURG}"/>
      <circle cx="30" cy="90" r="5.5" style="fill:#fff;stroke:${INK};stroke-width:2"/>
      <path d="M 30 88 Q 100 34 178 92" style="fill:none;stroke:${INK};stroke-width:2.5"/>
      <line x1="184" y1="92" x2="266" y2="92" style="stroke:${INK};stroke-width:2;stroke-dasharray:3 5"/>
      <path d="M 30 88 Q 140 -18 254 90" style="fill:none;stroke:${FNT};stroke-width:1.5;stroke-dasharray:4 4"/>
      <circle cx="178" cy="93" r="6" style="fill:none;stroke:${GRN};stroke-width:2.5"/>
      <text x="118" y="24" style="fill:${GRN};font:800 11px var(--sans)">Land it HERE, let it roll</text>
      <line x1="172" y1="30" x2="178" y2="84" style="stroke:${GRN};stroke-width:1.5;stroke-dasharray:2 3"/>
      <text x="8" y="48" style="fill:${INK};font:800 10.5px var(--sans)">LOW beats high</text>
      <text x="312" y="110" text-anchor="end" style="fill:${FNT};font:italic 9.5px var(--sans)">pitch: only over trouble</text>
      <text x="104" y="110" style="fill:${FNT};font:italic 9.5px var(--sans)">bunker</text>
    </svg></div>`;
  },
  mental(){
    const INK='var(--ink)', GRN='var(--gtext)', FNT='var(--faint)', BURG='var(--btext)';
    const dots = Array.from({length:18}, (_,i) => {
      const x = 21 + i * 16.4;
      const guard = i < 3, last = i === 17;
      return `<circle cx="${x}" cy="34" r="5.5" style="fill:${last?GRN:'none'};stroke:${guard?BURG:FNT};stroke-width:${guard?2.5:1.5}"/>`;
    }).join('');
    return `<div class="sheetart"><svg viewBox="0 0 320 100" role="img" aria-label="Guard holes 1 to 3; attention on for the shot, off on the walk">
      ${dots}
      <path d="M 15 20 h 44" style="stroke:${BURG};stroke-width:2"/>
      <text x="64" y="23" style="fill:${BURG};font:800 10.5px var(--sans)">guard the START — that's where it lands</text>
      <text x="314" y="53" text-anchor="end" style="fill:${GRN};font:800 10.5px var(--sans)">change NOTHING</text>
      <path d="M 16 84 h 30 v-16 h 11 v16 h 44 v-16 h 11 v16 h 44 v-16 h 11 v16 h 46" style="fill:none;stroke:${GRN};stroke-width:2"/>
      <text x="64" y="62" style="fill:${GRN};font:800 10px var(--sans)">ON 30s</text>
      <text x="126" y="97" style="fill:${INK};font:800 10px var(--sans)">OFF on the walk</text>
    </svg></div>`;
  },
};
// The tab row: the four labs plus the course you're about to play. Round Prep isn't a
// lab (no faults, no film, and its content is per-COURSE rather than standing), so it
// rides alongside LABS here rather than being forced into it.
// A FUNCTION, not a const array: `LABS` is declared further down the file, so building
// this at load time reads it inside its temporal dead zone and throws — which kills the
// whole IIFE and white-screens the app. Evaluate it when a sheet is drawn instead.
const cheatTabs = () => [...LABS.map(l => ({ k:l.disc, ic:l.ic, short:l.short || l.name })),
  { k:'prep', ic:'🗒', short:'Course' }];
function cheatHead(disc, title){
  return `
  <div class="sheethead">
    <h2>${esc(title)}</h2>
    <button class="minibtn" data-action="cheat-close">✕ Close</button>
  </div>
  <div class="sheettabs">${cheatTabs().map(t => `<span class="${t.k === disc ? 'on' : ''}"
    data-action="cheat-open" data-disc="${t.k}">${t.ic} ${esc(t.short)}</span>`).join('')}</div>`;
}
// The course sheet. Unlike a lab, this one has to pick WHICH plan: the next dated
// briefing is unambiguous, and a lone standing plan is too — otherwise it can't know
// which course he's playing today, so it asks instead of guessing.
function cheatPrep(id){
  const p = coursePlans();
  const list = [...p.up, ...p.standing];
  const b = (id && S.briefings.find(x => x.id === id))
    || p.up[0] || (list.length === 1 ? list[0] : null);
  if(!b) return `${cheatHead('prep', '🗒 Round Prep')}
    ${list.length ? `<p class="sm" style="margin:11px 0 2px">Which course are you playing?</p>
      ${list.map(x => `<div class="linkrow" data-action="cheat-open" data-disc="prep" data-id="${x.id}">
        <span class="sm"><b>${esc(x.course)}</b>${x.date ? ` · ${fmtDate(x.date)}` : ''}</span><span class="arr">→</span></div>`).join('')}`
    : `<p class="sm" style="margin-top:11px">No course plans yet. Tell Claude where you're playing and one lands here — tee strategy, the hazards, and a note on every hole the research supports.</p>`}`;
  const sh = courseShape(b);
  return `${cheatHead('prep', '🗒 ' + (b.course.length > 22 ? b.course.slice(0, 21) + '…' : b.course))}
  <p class="sm" style="margin-top:11px">${b.date ? `<b class="warn">${fmtDate(b.date)}</b> · ` : ''}${esc(b.focus || 'Plan ready')}</p>
  ${sh.rules.length ? `<div class="cues">${sh.rules.map(r => `<span>${esc(cheatCue(r))}</span>`).join('')}</div>` : ''}
  ${sh.plays.length ? `<p class="sm sheetwatch"><b>How it plays</b></p>
    <ul class="hi-why" style="margin-top:5px">${sh.plays.map(t => `<li>${emph(t)}</li>`).join('')}</ul>` : ''}
  ${sh.record.length ? `<p class="sm sheetwatch"><b>Your record here</b></p>
    <ul class="hi-why" style="margin-top:5px">${sh.record.map(t => `<li>${emph(t)}</li>`).join('')}</ul>` : ''}
  <div class="linkrow" style="border-bottom:none;margin-top:8px" data-action="open-briefing" data-id="${b.id}">
    <span class="sm"><b>The full plan</b>${sh.noted ? ` · ${sh.noted} hole notes` : ''}</span><span class="arr">→</span></div>
  <p class="sm faint" style="margin-top:2px">Hole by hole reaches you on the tee — each note shows on its own hole while you log the round.</p>
  ${list.length > 1 ? `<div class="linkrow" style="border-bottom:none" data-action="cheat-open" data-disc="prep" data-id="pick">
    <span class="sm faint">Playing somewhere else?</span><span class="arr">→</span></div>` : ''}`;
}
// What the course IS, rather than what each hole is — the hole notes already reach him
// on the tee through the live logger, so repeating them here spends the one screen he
// reads before a round on something he's about to be told anyway. Everything below is
// computed: the plan's own tee calls and hazard warnings counted up into a character,
// and his own cards at the course asked what it actually costs him.
function courseShape(b){
  const holes = (b.holes || []).filter(h => h && h.n);
  const plays = [], record = [];
  const has = (h, re) => re.test(`${h.avoid || ''} ${h.play || ''} ${h.note || ''} ${(h.why || []).join(' ')}`);
  // TEE POLICY. A course that wants irons off the tee is the single most useful thing
  // to know walking to the 1st, and the plan already decided it hole by hole.
  const tee = holes.filter(h => h.play);
  const drv = tee.filter(h => /\bdriver\b/i.test(h.play) && !/not driver|isn't driver|no driver/i.test(h.play));
  if(tee.length >= 6) plays.push(drv.length <= tee.length / 3
    ? `*Driver on ${drv.length} of ${tee.length}* tee calls — this is a *positioning* course, not a long one`
    : `*Driver on ${drv.length} of ${tee.length}* tee calls — it lets you have it`);
  // HAZARD CENSUS by kind. Which hazards exist and how many, not where each one is.
  // Naming the holes keeps it a fact about the course ("the water is on 13") rather than
  // a tee instruction ("13: wood, right-center") — the instruction arrives on the tee.
  const kinds = [[/\bwater\b|\bpond\b|\bcreek\b/i, 'Water'], [/\bbunker/i, 'Bunkers'],
                 [/\btree/i, 'Trees'], [/\bO\.?B\b|out of bounds/i, 'OB']];
  const cen = kinds.map(([re, lab]) => [lab, holes.filter(h => has(h, re)).map(h => h.n)]).filter(x => x[1].length);
  const ord = n => n + (['th','st','nd','rd'][n % 10] && n % 100 - n % 10 !== 10 ? ['th','st','nd','rd'][n % 10] || 'th' : 'th');
  if(cen.length) plays.push(cen.map(([lab, ns]) =>
    `*${lab}* on ${ns.length === 1 ? `the ${ord(ns[0])}` : ns.join(', ')}`).join(' · '));
  // THE RECURRING MISS. When one direction is the warning on hole after hole, that's a
  // property of the course, and it's worth knowing whether it's also his own miss.
  const dirs = [[/\bshort\b/i, 'SHORT'], [/\bright\b/i, 'RIGHT'], [/\bleft\b/i, 'LEFT'], [/\blong\b/i, 'LONG']]
    .map(([re, lab]) => [lab, holes.filter(h => h.avoid && re.test(h.avoid)).length])
    .sort((x, y) => y[1] - x[1])[0];
  if(dirs && dirs[1] >= 3) plays.push(`*${dirs[0]}* is the warning on ${dirs[1]} holes — the miss this course punishes`);
  // HIS OWN CARDS. Par mix comes off a card rather than the plan, since a briefing's
  // holes carry yardages but never pars.
  const rds = S.rounds.filter(r => courseMatches(r.course, b.course) && (r.holes || []).length);
  const full = rds.find(r => r.holes.length >= 18) || rds[0];
  if(full){
    const hs = full.holes.filter(h => h && h.par != null);
    const p3 = hs.filter(h => h.par === 3).length, p5 = hs.filter(h => h.par === 5).length;
    if(hs.length >= 9) plays.push(`Par ${hs.reduce((s, h) => s + h.par, 0)} — *${p3} par 3s*, *${p5} par 5s*`);
  }
  const scored = rds.filter(r => r.score != null);
  if(scored.length){
    const best = scored.reduce((a, r) => r.score < a.score ? r : a);
    record.push(`${scored.length} round${scored.length > 1 ? 's' : ''} here · best *${best.score}*${best.par ? ` (${best.score - best.par > 0 ? '+' : ''}${best.score - best.par})` : ''}`);
  }
  // Where the strokes actually went last time — greens, and the tee shots that took the
  // approach away before it was hit. Both are course-level, neither is a hole note.
  const card = (rds.slice().sort((a, b2) => (b2.date || '').localeCompare(a.date || ''))[0] || {}).holes || [];
  const gir = card.filter(h => h.gir === true).length, miss = card.filter(h => h.gir === false).length;
  const dead = card.filter(h => h.noshot).length;
  if(gir + miss >= 9) record.push(`Last time: *${gir} greens*${dead ? ` · *${dead} tee shots* left no play at the green` : ''}`);
  // The stretch that costs him. Four consecutive holes, so it names a part of the course
  // ("the turn", "the closing stretch") rather than a hole he'll be told about anyway.
  if(card.length >= 12){
    const d = card.filter(h => h.par != null && h.s != null);
    let worst = null;
    for(let i = 0; i + 4 <= d.length; i++){
      const w = d.slice(i, i + 4), over = w.reduce((s, h) => s + (h.s - h.par), 0);
      if(!worst || over > worst.over) worst = { over, a:w[0].n, b:w[3].n };
    }
    if(worst && worst.over >= 4) record.push(`*${worst.a}–${worst.b}* is where it went: *+${worst.over}* across four holes`);
  }
  // A rule scoped to one hole ("13: WATER — wood off the tee") is a tee instruction, and
  // the tee is where he'll get it. Only the rules that describe the whole course survive
  // onto this sheet; the rest are on the full plan and on the hole itself.
  const holeScoped = r => /^\s*\d{1,2}\s*(?:[–-]\s*\d{1,2}\s*)?[:.]/.test(r)
    || /^\s*(?:the\s+)?(?:\d{1,2}(?:st|nd|rd|th)|1st|2nd|3rd)\b/i.test(r);
  const rules = (b.rules || []).filter(r => !holeScoped(r));
  return { plays, record, rules,
    noted: holes.filter(h => h.play || h.note || (h.why || []).length).length };
}
function cheatSheet(disc, arg){
  if(disc === 'prep') return cheatPrep(arg === 'pick' ? null : arg);
  const lab = LABS.find(l => l.disc === disc);
  const plans = plansFor(disc);
  const lead = plans.find(isRoutine) || plans[0];
  const open = faultsFor(disc).filter(f => faultState(f) === 'open');
  // Same pick as the Mental tab's "one job" card: newest debrief that set one.
  const oneJob = disc === 'mental' ? (S.mental || []).map((d, i) => ({ d, i }))
    .sort((a, b) => (b.d.date || '').localeCompare(a.d.date || '') || b.i - a.i)
    .map(o => o.d).find(d => d.next) : null;
  return `
  ${cheatHead(disc, `${lab ? `${lab.ic} ${lab.name}` : ''} · before you play`)}
  ${oneJob ? `<div class="tipcard" style="margin-top:11px"><h4>One job</h4><p class="sm"><b>${esc(oneJob.next)}</b></p></div>` : ''}
  ${CHEAT_ART[disc] ? CHEAT_ART[disc]() : ''}
  ${lead
    ? ((lead.rules || []).length ? `<div class="cues">${lead.rules.map(r => `<span>${esc(cheatCue(r))}</span>`).join('')}</div>` : '')
    : `<p class="sm" style="margin-top:9px">No standing plan in this lab yet — ask Claude for one and this sheet builds itself from it.</p>`}
  ${open.length ? `<p class="sm sheetwatch"><b>Watch for:</b> ${open.map(f => `<b class="warn">${esc(faultLabel(f.tag))}</b>`).join(' · ')}</p>` : ''}
  ${lead ? `<div class="linkrow" style="border-bottom:none;margin-top:8px" data-action="open-briefing" data-id="${lead.id}">
    <span class="sm"><b>${esc(lead.course)}</b> — the full plan</span><span class="arr">→</span></div>` : ''}`;
}
// Opening a sheet and switching between them are the same call: if the overlay is
// already up, only its contents are swapped. That keeps the pre-round read as ONE
// pass through the whole game — swing, short game, putting, mental — instead of four
// separate trips out to the hub and back.
function openCheat(disc, arg){
  let v = document.getElementById('sheetveil');
  if(!v){
    v = document.createElement('div');
    v.className = 'sheetveil'; v.id = 'sheetveil';
    v.addEventListener('click', e => { if(e.target === v) closeCheat(); });
    document.body.appendChild(v);
  }
  v.innerHTML = `<div class="sheet card">${cheatSheet(disc, arg)}</div>`;
  const s = v.querySelector('.sheet');
  if(s) s.scrollTop = 0;   // a switched sheet starts at its own top, not the last one's
}
function closeCheat(){
  const v = document.getElementById('sheetveil');
  if(v) v.remove();
}

// ----- Swing Lab -----
function swing(){
  const sessions = S.sessions.map((s,i) => ({ s, i })).filter(o => sessionDiscipline(o.s) === 'swing').reverse();
  // Anything not explicitly claimed by another lab lands here — plansFor('swing') is the
  // catch-all, minus course plans; see its comment.
  const plans = plansFor('swing');
  const other = plans.filter(b => !isRoutine(b));
  return `
  ${labBar('swing')}
  ${cheatBtn('swing')}
  ${routineBlock(plans)}

  ${other.length ? `<h2>Plans</h2>
  <div class="card">
    ${planLinks(other)}
  </div>` : ''}

  ${diagnosisCard('swing', 'No swing faults on the card yet — send film and they land here.')}

  <div class="card flat"><div class="linkrow" data-action="go" data-view="positions">
    <span><b>📐 Swing Positions · visual guide</b><br><span class="sm">Body checkpoints, address → finish, with a slide-vs-clear hip diagram</span></span><span class="arr">→</span></div></div>

  <h2>Film room</h2>
  <div class="card">
    ${sessionLog(sessions, 'No swing sessions logged yet. Send Claude swing clips — down-the-line and face-on — and the breakdowns land here.')}
  </div>

  <h2>Filming guide</h2>
  <div class="card flat">
    <p class="sm"><b>1 · Down-the-line</b> — behind the ball, camera at hand/hip height on the target line: plane, path, shaft position at the top.<br>
    <b>2 · Face-on</b> — chest height, square to you: posture, weight shift, hip clearance, low point.<br>
    Film 3 swings per angle in slo-mo (240fps), and grab the sim's numbers — path, attack angle, face-to-path, spin, carry.</p>
  </div>`;
}

// ----- Swing Positions · visual guide (inline SVG, theme-aware) -----
// Face-on figure, richer anatomy: shoe shapes (flat / flared / up on the toe),
// pressure pills with % (green = loaded foot), pelvis belt + buckle, cap,
// hip-clearing arc with degrees, and motion arrows (arms drop, foot press).
// Trail side (right, for a RH golfer) draws on the viewer's LEFT; target is right.
function posSvg(p, solid){
  const INK='var(--ink)', BURG='var(--burg)', GRN='var(--gtext)', FNT='var(--faint)', CLB='var(--soft)', CARD='var(--card)';
  const G=220; // ground line
  const ln=(a,b,c,w=6)=>`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" style="stroke:${c};stroke-width:${w};stroke-linecap:round"/>`;
  // In solid mode the figure is a filled silhouette: fat capsule limbs, solid
  // torso & head, card-color underlays so arms/club/belt read on top of the body.
  const legW=solid?11:6, armW=solid?8:4.5;
  const under=(a,b,w)=>solid?ln(a,b,CARD,w+3.5):'';
  const shT=[p.sh[0]-p.shW, p.sh[1]+(p.tiltT||0)], shL=[p.sh[0]+p.shW, p.sh[1]+(p.tiltL||0)];
  const hipT=[p.hip[0]-p.hipW, p.hip[1]], hipL=[p.hip[0]+p.hipW, p.hip[1]];
  const shoe=(x,mode)=>{
    const r=`<rect x="${x-12}" y="${G-8}" width="25" height="9" rx="4.5" style="fill:${INK}"/>`;
    if(mode==='flare') return `<g transform="rotate(-16 ${x} ${G-4})">${r}</g>`;
    if(mode==='toe')   return `<g transform="rotate(55 ${x+10} ${G-2})">${r}</g>`;
    return r;
  };
  const pill=(x,pct)=>{const hot=pct>=60;
    return `<rect x="${x-14}" y="${G+7}" width="28" height="14" rx="7" style="fill:${hot?GRN:'none'};stroke:${hot?GRN:FNT};stroke-width:1.5"/>
    <text x="${x}" y="${G+17.5}" text-anchor="middle" style="fill:${hot?CARD:FNT};font:800 9px var(--sans)">${pct}</text>`;};
  const wl=Math.round(p.wtLead*100);
  const legT = ln(hipT,p.kneeT,INK,legW)+ln(p.kneeT,[p.footT,G-6],INK,legW-1);
  const legL = under(hipL,p.kneeL,legW)+under(p.kneeL,[p.footL,G-6],legW-1)
    + ln(hipL,p.kneeL,p.post?GRN:INK,legW)+ln(p.kneeL,[p.footL,G-6],p.post?GRN:INK,legW-1);
  const club = p.club?`${under(p.hands,p.club,3.5)}${ln(p.hands,p.club,CLB,3.5)}
    <path d="M ${p.club[0]} ${p.club[1]} l ${p.blade[0]} ${p.blade[1]} l ${p.blade[2]} ${p.blade[3]}" style="fill:none;stroke:${CLB};stroke-width:5;stroke-linecap:round"/>`:'';
  const cap = `<path d="M ${p.head[0]-8} ${p.head[1]-4} A 9 9 0 0 1 ${p.head[0]+8} ${p.head[1]-4}" style="fill:${INK}"/>
    <line x1="${p.head[0]+5}" y1="${p.head[1]-5}" x2="${p.head[0]+(p.bill||8)+5}" y2="${p.head[1]-3}" style="stroke:${INK};stroke-width:4;stroke-linecap:round"/>`;
  return `<svg viewBox="0 0 200 246" role="img" aria-label="${esc(p.name)}">
    <line x1="10" y1="${G}" x2="182" y2="${G}" style="stroke:${FNT};stroke-width:1.5;opacity:.6"/>
    <polygon points="190,${G} 181,${G-4.5} 181,${G+4.5}" style="fill:${FNT};opacity:.7"/>
    <text x="164" y="${G-6}" style="fill:${FNT};font:italic 8.5px var(--sans)">target</text>
    ${pill(p.footT,100-wl)}${pill(p.footL,wl)}
    ${legT}${legL}
    ${shoe(p.footT,p.toeT?'toe':'flat')}${shoe(p.footL,p.flareL?'flare':(p.toeL?'toe':'flat'))}
    <polygon points="${hipT[0]},${hipT[1]} ${hipL[0]},${hipL[1]} ${shL[0]},${shL[1]} ${shT[0]},${shT[1]}" style="fill:${INK};opacity:${solid?1:.13}${solid?`;stroke:${INK};stroke-width:7;stroke-linejoin:round`:''}"/>
    ${solid?'':`<line x1="${p.hip[0]}" y1="${p.hip[1]}" x2="${p.sh[0]}" y2="${p.sh[1]}" style="stroke:${INK};stroke-width:4;opacity:.5"/>`}
    ${ln(shT,shL,INK,solid?11:6.5)}
    ${under(shT,p.hands,armW)}${under(shL,p.hands,armW)}
    ${ln(shT,p.hands,INK,armW)}${ln(shL,p.hands,INK,armW)}
    ${club}
    <circle cx="${p.hands[0]}" cy="${p.hands[1]}" r="${solid?4.5:3.5}" style="fill:${INK}${solid?`;stroke:${CARD};stroke-width:2`:''}"/>
    ${solid?`<line x1="${hipT[0]}" y1="${hipT[1]}" x2="${hipL[0]}" y2="${hipL[1]}" style="stroke:${CARD};stroke-width:10;stroke-linecap:round"/>`:''}
    <line x1="${hipT[0]}" y1="${hipT[1]}" x2="${hipL[0]}" y2="${hipL[1]}" style="stroke:${BURG};stroke-width:${solid?6:7};stroke-linecap:round"/>
    ${p.hipOpen?`<circle cx="${hipL[0]}" cy="${hipL[1]}" r="4.5" style="fill:${BURG}"/>`:''}
    <line x1="${p.sh[0]}" y1="${p.sh[1]}" x2="${p.head[0]}" y2="${p.head[1]+8}" style="stroke:${INK};stroke-width:${solid?7:4.5}"/>
    ${solid?`<circle cx="${p.head[0]}" cy="${p.head[1]}" r="11.5" style="fill:${CARD};opacity:.92"/>`:''}
    <circle cx="${p.head[0]}" cy="${p.head[1]}" r="8.5" style="fill:${solid?INK:CARD};stroke:${INK};stroke-width:4"/>
    ${cap}
    ${p.ball?`<ellipse cx="${p.ball[0]}" cy="${G-1.5}" rx="6" ry="2" style="fill:${FNT};opacity:.35"/><circle cx="${p.ball[0]}" cy="${p.ball[1]}" r="4.5" style="fill:#fff;stroke:${INK};stroke-width:2"/>`:''}
    ${p.hipOpen?`<path d="M ${hipL[0]+7} ${p.hip[1]-16} q 17 6 11 24" style="fill:none;stroke:${BURG};stroke-width:2.5"/><polygon points="${hipL[0]+15},${p.hip[1]+10} ${hipL[0]+24},${p.hip[1]+3} ${hipL[0]+25},${p.hip[1]+13}" style="fill:${BURG}"/>`:''}
    ${p.deg?`<text x="${hipL[0]+16}" y="${p.hip[1]+26}" style="fill:${BURG};font:800 9px var(--sans)">${p.deg}</text>`:''}
    ${p.drop?`<path d="M 50 92 q -6 26 8 44" style="fill:none;stroke:${INK};stroke-width:2.5;stroke-dasharray:4 3"/><polygon points="58,136 46,132 54,125" style="fill:${INK}"/><text x="30" y="88" style="fill:${INK};font:italic 800 9px var(--sans)">drop</text>`:''}
    ${p.press?`<line x1="${p.footL}" y1="${G-40}" x2="${p.footL}" y2="${G-18}" style="stroke:${GRN};stroke-width:3"/><polygon points="${p.footL},${G-12} ${p.footL-5},${G-20} ${p.footL+5},${G-20}" style="fill:${GRN}"/>`:''}
  </svg>`;
}
function posFig(p, solid){
  return `<div class="posfig">${posSvg(p, solid)}<div class="posname">${p.n} · ${esc(p.name)}</div>
  <div class="poschips">${p.chips.map(c=>`<span>${esc(c)}</span>`).join('')}</div></div>`;
}
// The six checkpoints, matched to the "Swing Positions — Body Checkpoints" plan.
function posData(){
  return [
    {n:1, name:'Address', head:[96,95], bill:7, sh:[97,110], shW:17, tiltT:3, tiltL:-3, hip:[100,151], hipW:12,
      kneeT:[82,184], kneeL:[118,184], footT:74, footL:126, flareL:true, hands:[105,163],
      club:[96,211], blade:[7,2,2,-7], ball:[100,215], wtLead:0.5,
      chips:['50/50 on the arches','hinge from the hip sockets','lead foot flared 20–30°','ball center (irons) · hands under chin']},
    {n:2, name:'Takeaway', head:[95,95], bill:7, sh:[96,110], shW:17, tiltT:2, tiltL:-2, hip:[100,151], hipW:12,
      kneeT:[82,184], kneeL:[118,184], footT:74, footL:126, flareL:true, hands:[79,159],
      club:[38,153], blade:[-2,-10,0,0], ball:[100,215], wtLead:0.45,
      chips:['one piece — chest & arms together','shaft parallel · toe up','trail hip turns behind — no sway']},
    {n:3, name:'Top', head:[93,94], bill:6, sh:[97,108], shW:16, tiltT:-7, tiltL:7, hip:[99,151], hipW:11,
      kneeT:[82,184], kneeL:[116,183], footT:74, footL:126, flareL:true, hands:[62,70],
      club:[106,53], blade:[7,-3,0,0], wtLead:0.25,
      chips:['shoulders ~90° · hips ~45°','loaded into the trail glute','trail knee holds flex','shaft points on line']},
    {n:4, name:'Transition', head:[93,95], bill:6, sh:[98,109], shW:16, tiltT:-4, tiltL:4, hip:[101,150], hipW:11,
      kneeT:[86,184], kneeL:[118,183], footT:76, footL:126, flareL:true, hands:[76,118],
      club:[54,80], blade:[-2,-8,0,0], wtLead:0.6, hipOpen:true, drop:true, press:true,
      chips:['1 · press the lead foot','2 · lead hip clears back & up','3 · arms DROP into the slot']},
    {n:5, name:'Impact', head:[91,94], bill:7, sh:[96,108], shW:16, tiltT:-2, tiltL:2, hip:[102,149], hipW:11,
      kneeT:[88,185], kneeL:[120,182], footT:76, footL:126, toeT:true, hands:[114,160],
      club:[95,211], blade:[7,2,2,-7], ball:[100,215], wtLead:0.85, hipOpen:true, deg:'35–45°', post:true,
      chips:['80–90% into the lead foot','lead leg posts up','hips open · buckle left of ball','hands ahead · head behind ball']},
    {n:6, name:'Finish', head:[104,92], bill:8, sh:[102,106], shW:13, tiltT:0, tiltL:0, hip:[100,150], hipW:9,
      kneeT:[90,186], kneeL:[118,183], footT:80, footL:122, toeT:true, hands:[120,70],
      club:[84,52], blade:[-7,-4,0,0], wtLead:0.95, hipOpen:true, post:true,
      chips:['belt buckle past the target','tall & stacked on the lead leg','trail laces to target · hold 3s']},
  ];
}
// Top-down: the pelvis sliding at the target vs rotating (clearing).
function hipTopDown(){
  const INK='var(--ink)', BURG='var(--burg)', GRN='var(--gtext)', FNT='var(--faint)';
  const stage=`<line x1="16" y1="132" x2="150" y2="132" style="stroke:${FNT};stroke-width:2;stroke-dasharray:4 4"/><polygon points="150,132 142,128 142,136" style="fill:${FNT}"/><text x="58" y="147" style="fill:${FNT};font:9px var(--sans)">target →</text><ellipse cx="50" cy="110" rx="15" ry="8" style="fill:none;stroke:${INK};stroke-width:3"/><ellipse cx="112" cy="110" rx="15" ry="8" style="fill:none;stroke:${INK};stroke-width:3"/>`;
  const pelvis=(c)=>`<rect x="56" y="58" width="52" height="24" rx="11" style="fill:${c};opacity:.13"/><rect x="56" y="58" width="52" height="24" rx="11" style="fill:none;stroke:${c};stroke-width:4"/><circle cx="106" cy="70" r="4.5" style="fill:${c}"/>`;
  const slide=`<svg viewBox="0 0 168 156" role="img" aria-label="Hips sliding sideways">
    ${stage}${pelvis(BURG)}
    <line x1="90" y1="40" x2="140" y2="40" style="stroke:${BURG};stroke-width:4"/><polygon points="140,40 131,35 131,45" style="fill:${BURG}"/>
    <text x="10" y="19" style="fill:${BURG};font:bold 12px var(--sans)">✗ SLIDE</text>
  </svg>`;
  const clear=`<svg viewBox="0 0 168 156" role="img" aria-label="Hips rotating and clearing">
    ${stage}
    <!-- The wall sits BEHIND the golfer (up the panel, away from the target line),
         because that is the direction the lead hip retreats into. Negative rotation
         is counter-clockwise on screen: lead hip back and up, trail hip toward the ball. -->
    <line x1="88" y1="34" x2="152" y2="34" style="stroke:${FNT};stroke-width:3;stroke-dasharray:3 3"/><text x="124" y="28" style="fill:${FNT};font:8px var(--sans)">wall</text>
    <g transform="rotate(-34 82 70)">${pelvis(GRN)}</g>
    <path d="M 112 78 q 10 -24 -4 -34" style="fill:none;stroke:${GRN};stroke-width:4"/><polygon points="108,38 102,49 114,48" style="fill:${GRN}"/>
    <text x="10" y="19" style="fill:${GRN};font:bold 12px var(--sans)">✓ CLEAR</text>
  </svg>`;
  return `<div class="posfig">${slide}</div><div class="posfig">${clear}</div>`;
}
// Down-the-line: where the shaft points at the top — the across-the-line fault.
function topShaft(){
  const INK='var(--ink)', BURG='var(--burg)', GRN='var(--gtext)', FNT='var(--faint)';
  return `<svg viewBox="0 0 270 100" role="img" aria-label="Shaft at the top: on line vs across the line">
    <line x1="28" y1="66" x2="242" y2="66" style="stroke:${FNT};stroke-width:2;stroke-dasharray:5 4"/>
    <polygon points="28,66 37,61 37,71" style="fill:${FNT}"/>
    <text x="42" y="60" style="fill:${FNT};font:9px var(--sans)">target</text>
    <circle cx="206" cy="66" r="5" style="fill:${INK}"/>
    <text x="214" y="63" style="fill:${INK};font:8px var(--sans)">hands</text>
    <line x1="206" y1="66" x2="60" y2="66" style="stroke:${GRN};stroke-width:5;stroke-linecap:round"/>
    <circle cx="60" cy="66" r="5.5" style="fill:${GRN}"/>
    <text x="58" y="86" style="fill:${GRN};font:bold 10px var(--sans)">✓ on line — points at the target</text>
    <line x1="206" y1="66" x2="66" y2="30" style="stroke:${BURG};stroke-width:5;stroke-linecap:round;stroke-dasharray:2 3"/>
    <circle cx="66" cy="30" r="5.5" style="fill:${BURG}"/>
    <text x="30" y="20" style="fill:${BURG};font:bold 10px var(--sans)">✗ across the line — points right (your tendency)</text>
  </svg>`;
}
// Top-down club path + ball flight: over-the-top slice vs from-the-inside.
function pathDiagram(){
  const INK='var(--ink)', BURG='var(--burg)', GRN='var(--gtext)', FNT='var(--faint)';
  const stage=`<line x1="84" y1="150" x2="84" y2="34" style="stroke:${FNT};stroke-width:1.5;stroke-dasharray:4 4"/><polygon points="84,30 96,35 84,40" style="fill:${FNT}"/><text x="90" y="30" style="fill:${FNT};font:8px var(--sans)">target</text><circle cx="84" cy="150" r="4" style="fill:#fff;stroke:${INK};stroke-width:2"/>`;
  const ott=`<svg viewBox="0 0 168 168" role="img" aria-label="Over the top, out-to-in, slice">
    ${stage}
    <line x1="120" y1="166" x2="52" y2="126" style="stroke:${BURG};stroke-width:5;stroke-linecap:round"/><polygon points="52,126 63,127 57,136" style="fill:${BURG}"/>
    <text x="112" y="150" style="fill:${BURG};font:8px var(--sans)">out→in</text>
    <path d="M 84 150 C 84 112 100 84 128 50" style="fill:none;stroke:${BURG};stroke-width:3;stroke-dasharray:5 4"/><polygon points="128,50 120,58 131,60" style="fill:${BURG}"/>
    <text x="8" y="18" style="fill:${BURG};font:bold 11px var(--sans)">✗ Over the top → slice</text>
  </svg>`;
  const inside=`<svg viewBox="0 0 168 168" role="img" aria-label="From the inside, straight or draw">
    ${stage}
    <line x1="48" y1="166" x2="116" y2="126" style="stroke:${GRN};stroke-width:5;stroke-linecap:round"/><polygon points="116,126 105,127 111,136" style="fill:${GRN}"/>
    <text x="40" y="150" style="fill:${GRN};font:8px var(--sans)">in→out</text>
    <path d="M 84 150 C 84 112 80 84 74 50" style="fill:none;stroke:${GRN};stroke-width:3"/><polygon points="74,50 70,60 80,57" style="fill:${GRN}"/>
    <text x="8" y="18" style="fill:${GRN};font:bold 11px var(--sans)">✓ From the inside</text>
  </svg>`;
  return `<div class="posfig">${ott}</div><div class="posfig">${inside}</div>`;
}
function swingPositions(){
  const plan = S.briefings.find(b => /Swing Positions/i.test(b.course));
  const F = posData();
  const legend = `<div class="poslegend">
    <span><i style="background:var(--burg)"></i>pelvis / belt line</span>
    <span><i style="background:var(--gtext)"></i>lead leg posting up</span>
    <span><i style="background:var(--gtext);border-radius:7px;height:10px"></i>pressure pill · % under foot</span>
    <span><i class="arc"></i>hips clearing</span>
  </div>`;
  return `
  <button class="backlink" data-action="go" data-view="swing">← Swing Lab</button>
  <div class="card">
    <h2>Swing Positions · visual guide</h2>
    <p class="sm">The six face-on checkpoints, address to finish — freeze each one in a mirror and match it. The pill under each foot is pressure (green = the loaded foot); the burgundy belt is your pelvis. Trail side = right, lead = left, target to the right.</p>
    ${legend}
    <div class="posgrid">${F.map(p=>posFig(p,true)).join('')}</div>
  </div>
  <div class="card">
    <h2>The hips · slide vs clear <span class="sm faint">(top-down)</span></h2>
    <div class="hipcompare">${hipTopDown()}</div>
    <p class="sm" style="margin-top:8px"><b class="warn">Slide</b> = the pelvis shifts sideways at the target and stays closed — no speed, hands flip to save the face. <b style="color:var(--gtext)">Clear</b> = the pelvis turns, the lead hip pulls back to the <b>wall</b> behind it and up, and the belt buckle ends left of the ball. Feet shift, hips spin.</p>
  </div>
  <div class="card">
    <h2>Shaft at the top <span class="sm faint">(down-the-line)</span></h2>
    <div class="posfig" style="padding:8px 6px">${topShaft()}</div>
    <p class="sm" style="margin-top:8px">Your tendency is <b class="warn">across the line</b> — at the top the shaft points right of the target. The fix is Fix 1: feel the <b>trail elbow lead down</b> and the shaft drops back <b style="color:var(--gtext)">on line</b>. The one-handed Miracle 201 drop trains this directly — it's in <b>Coach</b>, on the At-Home Swing shelf.</p>
  </div>
  <div class="card">
    <h2>Club path · your slice <span class="sm faint">(top-down)</span></h2>
    <div class="hipcompare">${pathDiagram()}</div>
    <p class="sm" style="margin-top:8px">Your slice is an <b class="warn">over-the-top</b> path — the upper body throws the club out, then across the ball <b>out-to-in</b>; an open face turns that into start-left, curve-right. <b>Same cure as everything above:</b> shallow the club (the one-handed drop) and let the hips CLEAR so the club falls behind you and swings from the <b style="color:var(--gtext)">inside</b>. Feel it: swing out toward right-center field; a headcover just <i>outside</i> the ball that you must miss forces the inside path. Fix the path first — then the face.</p>
  </div>
  ${plan ? `<div class="card flat"><div class="linkrow" data-action="open-briefing" data-id="${plan.id}"><b>Read the full checkpoint detail</b><span class="arr">→</span></div></div>` : ''}`;
}

function putting(){
  const entries = S.fiveFt.slice(-6);
  const mc = missCounts();
  // The lab diagnoses; Coach trains. This page used to carry two hardcoded drills of its
  // own, which is how one of them went on prescribing a tempo fix for a fault that closed
  // on film in July. Drills have exactly one home now — the bench in Coach.
  const putDrills = drillList().filter(d => !d.missing.length &&
    /Putting/.test(d.l.shelf)).length;
  const plans = plansFor('putting');
  const other = plans.filter(b => !isRoutine(b));
  return `
  ${labBar('putting')}
  ${cheatBtn('putting')}
  ${routineBlock(plans)}

  ${other.length ? `<h2>Plans</h2><div class="card">${planLinks(other)}</div>` : ''}

  ${diagnosisCard('putting')}

  <div class="card flat"><div class="linkrow" data-action="go" data-view="drills">
    <span><b>Training lives in Coach</b><br><span class="sm">${putDrills} putting drills you have the kit for — the drill bench keeps them all, with the streak</span></span><span class="arr">→</span></div></div>

  <h2>Film room</h2>
  <div class="card">
    ${sessionLog(S.sessions.map((s,i) => ({s,i})).filter(o => sessionDiscipline(o.s) === 'putting').reverse(), 'No putting film yet — send clips and the breakdowns land here.')}
    <details><summary>+ Log a session</summary>
      <label>Setup (angle · strokes)</label><input id="sesSetup" placeholder="e.g. 5 strokes · overhead, zero-torque demo">
      <label>Finding</label><input id="sesFind" placeholder="What the film showed">
      <div style="margin-top:10px"><button class="btn" data-action="add-session">Save session</button></div>
    </details>
  </div>

  <h2>Stroke evolution · on the LINK.2.1</h2>
  ${evolutionCard()}

  <h2>Filming guide</h2>
  <div class="card flat">
    <p class="sm"><b>1 · Overhead</b> — the gold standard for path (this is what settled SBST).<br>
    <b>2 · Down-the-line</b> — behind the ball at hip height: start line, face at address.<br>
    <b>3 · Face-on</b> — waist height: posture, eyeline, tempo.<br>
    Film 3–5 strokes per angle so rep-to-rep patterns show.<br>
    <b>Shooting with the laser?</b> It needs a scale in frame or the clip can't be measured — the protocol is in Coach, <i>Filming the beam so it can actually be measured</i>.</p>
  </div>

  <h2>5-footer scoreboard</h2>
  <div class="card">
    <p class="sm">Tap each ball: <b>green = make</b>, then cycle the miss — L, R, S (short), Lg (long). Tap again to clear.</p>
    <div class="tapgrid" id="tapgrid">
      ${Array.from({length:20}, (_,i)=>`<div class="tap" data-tap="${i}" data-state="">${i+1}</div>`).join('')}
    </div>
    <button class="btn" data-action="save-fiveft">Save today's 20</button>
    ${entries.length ? `
    <div class="spark">
      ${entries.map(e => { const s=fiveFtScore(e); return `<div class="c"><div class="b ${e===latestFiveFt()?'hot':''}" style="height:${Math.max(4, s.total? s.makes/20*56 : 2)}px"></div><div class="t">${fmtDate(e.date)}</div></div>`; }).join('')}
      <div class="c"><div class="b goal" style="height:${17/20*56}px"></div><div class="t">goal 17</div></div>
    </div>
    <p class="sm" style="margin-top:8px">All-time miss pattern: <b>${mc.L} left</b> · ${mc.R} right · ${mc.S} short · ${mc.Lg} long ${mc.L>mc.R?'— <span class="warn">the left miss is still the story</span>':'— <span class="good">left miss under control</span>'}</p>` : '<p class="sm faint" style="margin-top:8px">No entries yet — the first 20-ball test sets your baseline.</p>'}
  </div>`;
}

// ----- Mental game -----
// An OFF-COURSE tab. Nothing here is meant to be tapped mid-round — the point of the
// mental game is that the responses are decided at home and merely executed on the
// course, so this page is where the deciding happens and where the round gets reviewed
// afterwards. It leads with the thing Jack's own cards can already answer.
//
// "I get upset and it costs me" and "I don't close" are both claims about WHERE in a
// round the strokes go, and every hole-by-hole card carries that. So the measurement
// speaks first and the debrief — his own read, written after the fact — is the weaker
// witness, the same film-over-feel rule the rest of the app runs on.
const perHole = o => o && o.n ? o.over / o.n : null;
const sgn = v => (v > 0 ? '+' : '') + v.toFixed(2);

function mentalStats(){
  // Six holes is the floor: a card shorter than that has no "closing stretch" to speak of
  // and can't say anything about the shape of a round.
  const src = withHoles()
    .map(r => ({ live: !!r.live,
      d: r.holes.filter(h => h && h.par != null && h.s != null).map(h => h.s - h.par) }))
    .filter(x => x.d.length >= 6);
  const cards = src.map(x => x.d);
  // Same precedence rule as the Scores page: a card he tapped in on the hole outranks one
  // reconstructed afterwards, so the tab says which kind of card it is reading.
  const liveHoles = src.filter(x => x.live).reduce((a, x) => a + x.d.length, 0);
  const m = { rounds:cards.length, liveRounds:src.filter(x => x.live).length, liveHoles, all:{n:0,over:0}, blow:{n:0,shots:0},
    afterBog:{n:0,over:0,save:0}, afterDbl:{n:0,over:0},
    thirds:[{n:0,over:0},{n:0,over:0},{n:0,over:0}],
    close:{n:0,over:0}, before:{n:0,over:0}, inPos:{n:0,over:0,rounds:0},
    open:{n:0,over:0}, second:{n:0,over:0}, badOpen:{n:0,over:0,rounds:0}, okOpen:{n:0,over:0,rounds:0} };
  const acc = (o, v) => { o.n++; o.over += v; };
  cards.forEach(d => {
    // The first tee is its own event, and the two holes after it are the rattle test:
    // does the opening hole cost you the hole, or does it cost you the round?
    acc(m.open, d[0]);
    if(d.length > 1) acc(m.second, d[1]);
    const rest = d[0] >= 2 ? m.badOpen : m.okOpen;
    rest.rounds++;
    d.slice(1).forEach(v => acc(rest, v));
    d.forEach((v, i) => {
      acc(m.all, v);
      if(v >= 2){ m.blow.n++; m.blow.shots += v; }
      acc(m.thirds[Math.min(2, Math.floor(i * 3 / d.length))], v);
      if(i >= d.length - 3) acc(m.close, v); else acc(m.before, v);
      if(i){
        // The reset test: what the hole AFTER a dropped shot costs, against his own average.
        if(d[i-1] >= 1){ acc(m.afterBog, v); if(v <= 0) m.afterBog.save++; }
        if(d[i-1] >= 2) acc(m.afterDbl, v);
      }
    });
  });
  // Closing when there was something to close. A fade only counts as a fade if the round
  // was going at least as well as usual when he got to the last three.
  const base = perHole(m.all);
  if(base != null) cards.forEach(d => {
    const head = d.slice(0, d.length - 3);
    if(!head.length || head.reduce((a, b) => a + b, 0) / head.length > base) return;
    m.inPos.rounds++;
    d.slice(-3).forEach(v => acc(m.inPos, v));
  });
  return m;
}

// Same contract as every other tip generator: nothing fires without a sample behind it,
// each card carries the number that triggered it, and a finding that comes out GOOD says
// so rather than being quietly dropped — "the cards don't show what you think" is one of
// the more useful things this page can tell him.
function mentalTips(m){
  const EV = evOf(m.liveHoles || 0, m.all.n || 0);
  const t = [];
  const base = perHole(m.all);
  if(base == null) return t;
  const thin = `Six-ish rounds is a first read, not a verdict — it grows every time you log a card hole by hole.`;

  if(m.afterBog.n >= 12){
    const a = perHole(m.afterBog), gap = a - base;
    const save = Math.round(m.afterBog.save / m.afterBog.n * 100);
    t.push(gap >= 0.2
      ? { ev:EV, s:'warn', src:`The reset · ${m.afterBog.n} holes`, h:'The hole after a dropped shot costs you extra',
          b:`It plays ${sgn(a)} a hole against ${sgn(base)} across every hole you've logged — ${sgn(gap)} of tax for carrying the last one${m.afterDbl.n >= 6 ? `, and ${sgn(perHole(m.afterDbl))} after a double or worse` : ''}. That is the measured version of what you described, and it has a fix with a landmark in it: ten yards of walking, then the hole is filed. ${thin}` }
      : { ev:EV, s:'good', src:`The reset · ${m.afterBog.n} holes`, h:'Your cards do not show a tilt tax',
          b:`The hole after a dropped shot plays ${sgn(a)} against ${sgn(base)} overall, and you make par or better on ${save}% of them${m.afterDbl.n >= 6 ? ` — ${sgn(perHole(m.afterDbl))} even after a double or worse` : ''}. So the anger is real as an experience and it is NOT currently showing up as strokes on the next tee. Two honest readings: the damage may be landing inside the bad hole rather than after it (see below), or the sample is still small. ${thin} Either way, do not spend practice on a reset problem the scorecard cannot find.` });
  }

  // Coach already carries the doubles finding from the scoring side; what's new here is
  // only the framing, so this one stays on the Mental tab rather than going up twice.
  if(m.blow.n && m.all.over > 0 && m.blow.shots / m.all.over >= 0.25)
    t.push({ ev:EV, s:'warn', coach:false, src:`Where it actually lands · ${m.blow.n} holes`, h:'The damage is inside the bad hole, not after it',
      b:`${m.blow.n} holes of double bogey or worse across ${m.all.n} played, costing ${m.blow.shots} strokes — ${Math.round(m.blow.shots / m.all.over * 100)}% of everything you've lost to par. A blow-up hole is where a bad decision gets made while you're already hot: the hero recovery, the second aggressive club, the flop you'd bet against. The mental work with the biggest number attached to it is not calming down afterwards, it is the one club you pick while still angry, DURING the hole.` });

  if(m.close.n >= 9 && m.before.n >= 18){
    const c = perHole(m.close), b = perHole(m.before), gap = c - b;
    t.push(gap >= 0.2
      ? { ev:EV, s:'warn', src:`Closing · ${m.close.n} holes`, h:'You fade over the last three',
          b:`The closing three play ${sgn(c)} a hole against ${sgn(b)} for everything before them${m.inPos.rounds >= 3 ? `, and ${sgn(perHole(m.inPos))} across the ${m.inPos.rounds} rounds that were going well when you got there` : ''}. That is the shape you described, measured. The counter is deliberately boring: same routine, same target selection, one more club, aimed at the middle. ${thin}` }
      : { ev:EV, s:'good', src:`Closing · ${m.close.n} holes`, h:'The closing stretch is not where your strokes go',
          b:`The last three holes play ${sgn(c)} a hole against ${sgn(b)} for everything before them${m.inPos.rounds >= 3 ? `, and ${sgn(perHole(m.inPos))} across the ${m.inPos.rounds} rounds that were going well when you reached them` : ''}. So "not closing" is so far a MATCH feeling rather than a scoring one — which is worth knowing, because it means the fix is about how the last three feel, not about a swing that leaves you. ${thin} Match play doesn't live in these cards at all: log the ones that matter and this line can start answering the question you're actually asking.` });
  }

  // The rattle test. Two separate questions that get answered as one thing in the retelling:
  // what does the opening hole cost, and does it cost you anything AFTER it? They can come
  // out opposite ways, and they point at completely different fixes if they do.
  if(m.open.n >= 4){
    const o = perHole(m.open), s2 = perHole(m.second);
    const bleed = (m.badOpen.n >= 8 && m.okOpen.n >= 8) ? perHole(m.badOpen) - perHole(m.okOpen) : null;
    if(o - base >= 0.3) t.push({ ev:EV, s:'warn', src:`The first tee · ${m.open.n} starts`,
      h:`Your opening hole costs ${sgn(o)} a hole`,
      b:`${sgn(o)} across ${m.open.n} opening holes against ${sgn(base)} for every hole you've logged — the most concentrated leak in your data, and it happens before you've hit anything else. ${s2 != null ? `Then the SECOND hole plays ${sgn(s2)}, which is ${Math.abs(s2 - base) < 0.15 ? 'your average almost exactly' : s2 < base ? 'better than your average' : 'still above your average'}. ` : ''}${bleed != null ? `And the rest of a round after a bad opening plays ${sgn(perHole(m.badOpen))} against ${sgn(perHole(m.okOpen))} after a clean one${bleed <= 0.1 ? ' — no worse, so it does not bleed' : ''}. ` : ''}${bleed != null && bleed <= 0.1
        ? 'So it costs you the opening hole and nothing after it. That makes this a WARM-UP and first-swing problem rather than a mental-toughness one: you do not need to recover better, you need to arrive with a swing. Prime the feel before the tee instead of hunting for it on the 4th.'
        : 'Worth watching whether it bleeds into the rest of the round as more cards come in — that is the difference between a warm-up fix and a reset fix.'}` });
  }

  if(m.all.n >= 27){
    const v = m.thirds.map(perHole);
    const worst = v.indexOf(Math.max(...v)), best = v.indexOf(Math.min(...v));
    const LAB = ['the opening third', 'the middle third', 'the closing third'];
    if(v[worst] - v[best] >= 0.25)
      t.push({ ev:EV, s: worst === 2 ? 'warn' : 'mid', coach: worst === 2, src:`Shape of a round · ${m.all.n} holes`,
        h:`Your strokes cluster in ${LAB[worst]}`,
        b:`Per hole: ${sgn(v[0])} opening · ${sgn(v[1])} middle · ${sgn(v[2])} closing. ${worst === 2
          ? 'The worst third is the last one, so attention is the likeliest suspect — this is the shape a fade actually has.'
          : worst === 0 ? 'The worst third is the FIRST one, which is a warm-up problem rather than a focus problem — you are settling into the round instead of starting in it.'
          : 'The worst third is the middle, which is usually where a round stops being new and nobody is watching the clock yet. It is the least glamorous place to lose shots and the easiest to fix with a target you say out loud.'}` });
  }

  // The debriefs get their own voice, ranked below every measurement on the page.
  const d = S.mental || [];
  if(d.length >= 3){
    const c = new Map();
    d.forEach(x => (x.triggers || []).forEach(k => c.set(k, (c.get(k) || 0) + 1)));
    const top = [...c.entries()].sort((a, b) => b[1] - a[1])[0];
    const tr = top && MENTAL_TRIGGERS.find(x => x.k === top[0]);
    if(tr && top[1] >= 2) t.push({ ev:'self', s:'mid', src:`Your debriefs · ${d.length} rounds`,
      h:`"${esc(tr.lab)}" is your most-logged trigger`,
      b:`Logged after ${top[1]} of ${d.length} rounds. Your plan for it: ${tr.then} A trigger this repeatable is worth rehearsing off the course rather than meeting fresh every time.` });
  }

  // Does a trigger actually COST anything? Only answerable where a debrief is tied to a
  // card with holes on it: WHICH rounds go in the bucket is his own read, but what they
  // cost is measured. That hybrid is why it still ranks `self` — the arithmetic is only
  // ever as good as the label on the bucket.
  MENTAL_TRIGGERS.forEach(x => {
    // Three separate cards AND 27 holes: an 18-hole round and a nine would otherwise clear
    // a hole-count gate on two rounds, and two rounds cannot carry a claim this loud.
    const cards = d.filter(e => (e.triggers || []).includes(x.k)).map(debriefRound).filter(Boolean);
    const v = cards.flat();
    if(cards.length < 3 || v.length < 27) return;
    const a = v.reduce((p, q) => p + q, 0) / v.length, gap = a - base;
    if(gap >= 0.2) t.push({ ev:'self', s:'warn', src:`"${x.lab}" · ${cards.length} rounds`,
      h:`Rounds where "${x.lab.toLowerCase()}" fired cost you ${sgn(gap)} a hole`,
      b:`They play ${sgn(a)} across ${v.length} holes against ${sgn(base)} for everything you've logged — about ${(gap * 18).toFixed(1)} strokes a round. Which rounds belong in that bucket is your own read, so this is only ever as good as the labelling; the strokes themselves are off the cards. Your plan for it: ${x.then}` });
  });
  return t.sort((a, b) => EV_RANK[a.ev || 'snapshot'] - EV_RANK[b.ev || 'snapshot']);
}

// What the card says about the part of the round a debrief flagged. A diary entry sitting
// next to its own numbers is worth more than either alone — and it is the only route by
// which a self-reported trigger ever earns, or loses, its credibility.
const WHEN_THIRD = { open:0, mid:1, close:2 };
function debriefRound(d){
  if(!d.round) return null;
  // Two nines at the same course on the same day are two different cards, so `nine`
  // is part of the key wherever the debrief carries it.
  const r = S.rounds.find(x => x.date === d.round.date && x.course === d.round.course
    && (d.round.nine == null || (x.nine || null) === d.round.nine)
    && Array.isArray(x.holes) && x.holes.length >= 6);
  if(!r) return null;
  const v = r.holes.filter(h => h && h.par != null && h.s != null).map(h => h.s - h.par);
  return v.length >= 6 ? v : null;
}
function debriefCard(d, base){
  const v = debriefRound(d);
  if(!v) return '';
  const th = [[], [], []];
  v.forEach((x, i) => th[Math.min(2, Math.floor(i * 3 / v.length))].push(x));
  const LAB = ['opening third', 'middle third', 'closing third'];
  const parts = (d.when || []).filter(k => WHEN_THIRD[k] != null)
    .map(k => { const s = th[WHEN_THIRD[k]]; return `${LAB[WHEN_THIRD[k]]} ${sgn(s.reduce((a, b) => a + b, 0) / s.length)}`; });
  const tot = v.reduce((a, b) => a + b, 0);
  const r = S.rounds.find(x => x.date === d.round.date && x.course === d.round.course
    && (d.round.nine == null || (x.nine || null) === d.round.nine));
  const match = matchLine(r);
  return `<br><span class="sm faint">That card: ${tot > 0 ? '+' : ''}${tot} over ${v.length} holes${
    match ? ` · <b>${match}</b>` : ''}${parts.length ? ` · ${parts.join(' · ')} a hole` : ''}${
    base != null ? ` · you average ${sgn(base)}` : ''}</span>`;
}

// ----- Match play -----
// The only place the "I don't close" question can actually be answered. A stroke-play card
// cannot see a match: you can shoot your best score of the week and still lose, and you can
// hand back a two-hole lead without a single number on the card moving. So the result rides
// on the round itself (`result` W/L/T and `margin` in holes, signed from Jack's side) and
// the Mental tab reads it here.
function matchLine(r){
  if(!r || !r.result) return '';
  const m = Math.abs(r.margin || 0);
  return r.result === 'T' ? 'halved'
    : `${r.result === 'W' ? 'won' : 'lost'} ${m ? `${m} ${r.result === 'W' ? 'up' : 'down'}` : ''}`.trim();
}
function matchStats(){
  const ms = S.rounds.filter(r => r.result && Array.isArray(r.holes) && r.holes.length >= 6)
    .map(r => ({ r, vs: roundVsPar(r), margin: r.margin || 0 }))
    // `matchNo` wins where it's known: an event can play the back nine first, so date
    // order is not match order and numbering them 1..n by date renames Jack's own matches.
    .sort((a, b) => (a.r.matchNo || 99) - (b.r.matchNo || 99)
      || (a.r.date || '').localeCompare(b.r.date || ''));
  const w = ms.filter(m => m.r.result === 'W').length, l = ms.filter(m => m.r.result === 'L').length;
  // "Live at the finish" is the set the closing question is actually about: halved, or
  // decided by a single hole. A 4&3 loss was never a closing problem.
  const live = ms.filter(m => m.r.result === 'T' || Math.abs(m.margin) <= 1);
  return { ms, w, l, t: ms.length - w - l, live, holes: ms.reduce((a, m) => a + m.margin, 0) };
}

function mentalCounts(){
  const c = {};
  (S.mental || []).forEach(d => (d.triggers || []).forEach(k => c[k] = (c[k] || 0) + 1));
  return c;
}

function mental(){
  const m = mentalStats();
  const tips = mentalTips(m);
  // Newest first BY DATE, not by insertion — a debrief written on Tuesday about Sunday's
  // round must not sit above Monday's. Insertion order only breaks ties.
  const logs = (S.mental || []).map((d, i) => ({ d, i }))
    .sort((a, b) => (b.d.date || '').localeCompare(a.d.date || '') || b.i - a.i)
    .map(o => o.d);
  const counts = mentalCounts();
  const focus = logs.filter(d => d.focus).map(d => d.focus);
  const avgFocus = focus.length ? focus.reduce((a, b) => a + b, 0) / focus.length : null;
  const next = logs.find(d => d.next);
  const plans = plansFor('mental');
  const other = plans.filter(b => !isRoutine(b));
  const rounds = S.rounds.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 10);
  const v = m.thirds.map(perHole);
  const worst = v.every(x => x != null) ? v.indexOf(Math.max(...v)) : -1;
  const THIRD = ['Opening third', 'Middle third', 'Closing third'];
  return `
  ${labBar('mental')}
  ${cheatBtn('mental')}
  ${next ? `<div class="card">
    <h2>Next round · one job</h2>
    <p class="sm"><b>${esc(next.next)}</b></p>
    <p class="sm faint" style="margin-top:6px">You wrote that after ${next.round ? esc(next.round.course) : 'your last round'}${next.date ? ` on ${fmtDate(next.date)}` : ''}. One job is the limit — a list of five is the same as none.</p>
  </div>` : ''}

  <div class="card">
    <p class="sm"><b>This page is for the kitchen table, not the golf course.</b> Everything a mental game does on the course is execution; the deciding happens here, before and after. What you get: what your own cards say about the two things you described — the anger tax and the fade — an if-then plan for every trigger that keeps getting you, and a debrief to fill in the evening after you play.</p>
  </div>

  ${routineBlock(plans)}
  ${other.length ? `<h2>Plans</h2><div class="card">${planLinks(other)}</div>` : ''}

  <h2>What your cards say</h2>
  ${m.all.n ? `<div class="rowgrid g3">
    ${m.thirds.map((th, i) => `<div class="stat ${i === worst && v[worst] - Math.min(...v) >= 0.25 ? 'alert' : ''}">
      <div class="v">${th.n ? sgn(perHole(th)) : '—'}</div><div class="l">${THIRD[i]}</div></div>`).join('')}
  </div>
  <div class="card">
    <table><tr><th>Situation</th><th>Holes</th><th>Per hole</th><th>vs. you</th></tr>
      ${[['The opening hole', m.open], ['The second hole', m.second],
         [`After a bad opening${m.badOpen.rounds ? ` · ${m.badOpen.rounds} rounds` : ''}`, m.badOpen],
         [`After a clean opening${m.okOpen.rounds ? ` · ${m.okOpen.rounds} rounds` : ''}`, m.okOpen],
         ['Every hole logged', m.all], ['After a bogey or worse', m.afterBog], ['After a double or worse', m.afterDbl],
         ['The closing three', m.close], ['Everything before them', m.before],
         [`Closing when it was going well${m.inPos.rounds ? ` · ${m.inPos.rounds} rounds` : ''}`, m.inPos]]
        .filter(([, o]) => o.n).map(([lab, o]) => {
          const p = perHole(o), d = p - perHole(m.all);
          return `<tr><td class="sm"><b>${lab}</b></td><td>${o.n}</td>
            <td><b style="color:${p >= 1 ? 'var(--burg)' : p <= 0.5 ? 'var(--green)' : 'var(--ink)'}">${sgn(p)}</b></td>
            <td class="sm">${Math.abs(d) < 0.05 ? '<span class="faint">—</span>'
              : `<b style="color:${d > 0 ? 'var(--burg)' : 'var(--green)'}">${sgn(d)}</b>`}</td></tr>`;
        }).join('')}
    </table>
    <p class="sm faint" style="margin-top:8px">Counted from ${m.rounds} of your own hole-by-hole cards. "vs. you" compares each situation against your own average hole — so it answers whether the situation costs you anything, not whether you're a good golfer in it.</p>
  </div>` : `<div class="card"><p class="sm">Nothing to measure yet. This section reads your hole-by-hole cards — the reset test (what the hole after a dropped shot costs), the closing three, and the shape of a round in thirds. Log a live round and it fills itself in.</p></div>`}

  ${tips.length ? `<div class="card">
    ${tips.map(t => `<div class="tipcard ${t.s === 'good' ? 'green' : ''}">
      <div class="src">${esc(t.src)}${evTag(t.ev)}</div><h4>${t.h}</h4>${expandable(t.b)}</div>`).join('')}
    <p class="sm faint">Measurement first, your own read last. A "good" card here is not a compliment — it means the cards can't find the thing you described, which is worth knowing before you spend practice on it.</p>
  </div>` : ''}

  ${(() => {
    const M = matchStats();
    if(M.ms.length < 3) return '';
    const base = perHole(m.all);
    return `
  <h2>Match play · ${M.w}–${M.l}${M.t ? `–${M.t}` : ''}</h2>
  <div class="card">
    <table><tr><th>Match</th><th>Score</th><th>vs par</th><th>Result</th></tr>
      ${M.ms.map((x, i) => `<tr>
        <td class="sm"><b>${x.r.matchNo || i + 1}</b> <span class="faint">${fmtDate(x.r.date)}${x.r.nine ? ` ${x.r.nine === 'B' ? 'back' : 'front'}` : ''}</span></td>
        <td>${x.r.score ?? '—'}</td><td class="sm">${x.vs != null ? `${x.vs > 0 ? '+' : ''}${x.vs}` : '—'}</td>
        <td class="sm"><b style="color:${x.r.result === 'W' ? 'var(--green)' : x.r.result === 'T' ? 'var(--ink)' : 'var(--burg)'}">${esc(matchLine(x.r))}</b></td></tr>`).join('')}
    </table>
    <p class="sm" style="margin-top:8px">${M.live.length
      ? `<b>${M.live.length} of ${M.ms.length} ${M.live.length === 1 ? 'was' : 'were'} live at the finish</b> — halved or decided by a single hole. Those are the only ones the closing question is about; a match lost by more than that was decided by scoring, not by nerve. ${M.live.length >= 2 ? 'Look at what your debriefs say about those specific rounds — if one mechanism keeps turning up in them, that is your closing problem, whatever it turns out to be.' : ''}`
      : 'None of these were decided by a single hole, so none of them can carry a closing story — they were decided by scoring.'}</p>
    <p class="sm faint" style="margin-top:8px">A match result is the only thing that can answer "I get up and don't close" — a scorecard can't see it. You can shoot your best score of the week and lose, and hand back a lead without a number on the card moving. Tell Claude the result of a match and it lands here.</p>
  </div>`;
  })()}

  <h2>Triggers · decided in advance</h2>
  <div class="card">
    <p class="sm">An if-then plan beats willpower because it removes the deciding. Read these cold, at home, until the response is boring — that is the whole mechanism.${Object.keys(counts).length ? '' : ' The counts fill in as you log debriefs.'}</p>
    ${MENTAL_TRIGGERS.map(x => `<div class="tipcard">
      <div class="src">If · ${esc(x.lab)}${counts[x.k] ? ` · logged ${counts[x.k]}×` : ''}</div>
      <h4>${esc(x.blurb)}</h4>
      <p class="sm"><b>Then:</b> ${esc(x.then)}</p></div>`).join('')}
  </div>

  <h2>Round debrief</h2>
  <div class="card">
    <p class="sm">The evening after you play, not on the drive home. Two minutes: how locked in you were, what fired, and the one job for next time.</p>
    <div class="formrow">
      <div><label>Date</label><input type="date" id="mtDate" value="${today()}"></div>
      <div><label>Round</label><select id="mtRound">
        <option value="">Not logged / practice</option>
        ${rounds.map((r, i) => `<option value="${i}">${fmtDate(r.date)} · ${esc(r.course || 'round')}${r.nine ? ` ${r.nine === 'B' ? 'back' : 'front'}` : ''}${r.score != null ? ` (${r.score})` : ''}</option>`).join('')}
      </select></div>
    </div>
    <label>How locked in were you?</label>
    <div class="chips" id="mtFocus">${[1,2,3,4,5].map(n =>
      `<span class="chip" data-action="mental-focus" data-focus="${n}">${n} · ${FOCUS_LAB[n]}</span>`).join('')}</div>
    <label>What fired?</label>
    <div class="chips" id="mtTriggers" data-multi>${MENTAL_TRIGGERS.map(x =>
      `<span class="chip" data-trig="${x.k}">${esc(x.lab)}</span>`).join('')}</div>
    <label>When?</label>
    <div class="chips" id="mtWhen" data-multi>${MENTAL_WHEN.map(([k, lab]) =>
      `<span class="chip" data-when="${k}">${lab}</span>`).join('')}</div>
    <label>What actually happened</label><input id="mtNote" placeholder="e.g. two groups backed up on 7, stood over it waiting, blocked it right">
    <label>One job next round</label><input id="mtNext" placeholder="e.g. wait off the tee box — routine starts when it's my turn">
    <div style="margin-top:10px"><button class="btn" data-action="save-debrief">Save debrief</button></div>
  </div>

  ${logs.length ? `<h2>Debrief log · ${logs.length}</h2>
  <div class="card">
    ${avgFocus != null ? `<p class="sm">Focus averages <b>${avgFocus.toFixed(1)} / 5</b> across ${focus.length} rounds${focus.length >= 3 ? ` · newest three ${focus.slice(0,3).join(' · ')}` : ''}. Your own read, so it is the softest number on this page — but it is the only one that knows how the round felt.</p>` : ''}
    ${logs.map((d, i) => `<div class="linkrow" style="align-items:flex-start${i === logs.length - 1 ? ';border-bottom:none' : ''}">
      <span><b>${fmtDate(d.date)}${d.round ? ` · ${esc(d.round.course)}` : ''}</b>${d.focus ? ` <span class="sm faint">${d.focus}/5 ${FOCUS_LAB[d.focus]}</span>` : ''}
      ${(d.triggers || []).length ? `<br><span class="sm">${d.triggers.map(k => esc((MENTAL_TRIGGERS.find(x => x.k === k) || {}).lab || k)).join(' · ')}${(d.when || []).length ? ` <span class="faint">— ${d.when.map(k => esc((MENTAL_WHEN.find(w => w[0] === k) || [])[1] || k)).join(', ')}</span>` : ''}</span>` : ''}
      ${d.note ? `<br><span class="sm faint">${esc(d.note)}</span>` : ''}
      ${debriefCard(d, perHole(m.all))}
      ${d.next ? `<br><span class="sm"><b>Next:</b> ${esc(d.next)}</span>` : ''}</span>
      <button class="minibtn" data-action="del-debrief" data-id="${esc(d.id)}">×</button></div>`).join('')}
  </div>` : ''}

  <h2>Off-course reps</h2>
  <div class="card">
    <p class="sm">The mental game is a skill, and a skill only ever attempted under pressure never improves. The reps that transfer are drills like any other, so they live on the bench in Coach with the rest — routines with no ball, practising with the interference, and three to leave.</p>
    <div class="linkrow" data-action="go" data-view="drills"><span><b>The drill bench</b><br><span class="sm">Every drill you have the kit for, filtered by where you are</span></span><span class="arr">→</span></div>
    <div class="linkrow" data-action="open-shelf" data-shelf="Mental Game"><span><b>Mental Game lessons</b><br><span class="sm">One target one thought · the 10-yard reset · practice like it counts</span></span><span class="arr">→</span></div>
    <div class="linkrow" data-action="open-lesson" data-id="c4"><span><b>Bogey is not an emergency</b><br><span class="sm">The lesson behind the blow-up finding above</span></span><span class="arr">→</span></div>
    <div class="linkrow" data-action="go" data-view="putting" style="border-bottom:none"><span><b>Putting Lab · the 20-ball test</b><br><span class="sm">Pressure with a score on it</span></span><span class="arr">→</span></div>
  </div>`;
}

// ----- Coach -----
// Find a standing plan by title so a finding can point at the page that fixes it.
function planIdBy(re, disc){
  const b = S.briefings.find(x => !x.date && re.test(x.course || '') &&
    (disc ? (x.discipline || 'swing') === disc : true));
  return b ? b.id : null;
}
// Everything Caddie HQ knows, ranked. Measured findings outrank standing faults,
// which outrank to-dos — a number you can point at beats an opinion.
function coachSignals(){
  const st = scoreStats();
  const out = scoreTips(st).map(t => ({ sev:t.s, src:t.src, h:t.h, b:t.b, ev:t.ev, key:t.key, link:null }));
  out.forEach(t => {
    if(/opening hole/i.test(t.h)){ const id = planIdBy(/routine/i, 'full-swing'); if(id) t.link = { a:'open-briefing', id, lab:'Open the swing routine' }; }
    else if(/par 3/i.test(t.h)) t.link = { a:'go', view:'swing', lab:'Swing lab' };
    else if(/par 5/i.test(t.h)) t.link = { a:'go', view:'bag', lab:'Check the wedge ladder' };
    else if(/double/i.test(t.h)) t.link = { a:'go', view:'scores', lab:'See the full breakdown' };
  });
  const last = latestFiveFt();
  if(last){
    const s = fiveFtScore(last), mc = missCounts();
    const id = planIdBy(/routine/i, 'putting');
    out.push({ sev: s.makes >= 17 ? 'good' : 'warn', src:'Putting · measured', ev:'measured',
      h:`${s.makes}/${s.total} from 5 feet`,
      b:`Last logged test${mc.L || mc.R ? ` · all-time misses ${mc.L} left / ${mc.R} right / ${mc.S} short / ${mc.Lg} long` : ''}. ${s.makes >= 17 ? 'At or past the goal of 17 — hold it there.' : 'Goal is 17. ' + (mc.L > mc.R ? 'The left miss is still the pattern.' : 'Miss pattern is balanced — this is pace and read, not face.')}`,
      link: id ? { a:'open-briefing', id, lab:'Open the putting routine' } : { a:'go', view:'putting', lab:'Putting lab' } });
  }
  // The mental findings are computed from the same cards, so they belong in the same
  // ranked list — but only the ones that say something is wrong. A "the cards can't find
  // it" card is the point of the Mental tab and pointless as a Coach to-do.
  mentalTips(mentalStats()).filter(t => t.s !== 'good' && t.coach !== false).forEach(t => out.push({
    sev:t.s, src:t.src, h:t.h, b:t.b, ev:t.ev, link:{ a:'go', view:'mental', lab:'Mental Game' } }));
  // Open ones only — a closed fault is a record, not a to-do, and listing it under
  // "Open fault" was telling him to work on early lift and stance creep months after both
  // were measured shut.
  // Each one links to ITS OWN lab, and carries its tag so the focus card can name the
  // drills that train it. Both were wrong before: every fault linked to the Putting Lab
  // whatever it was of, so a swing fault sent him to the wrong page — the same bug the
  // film log had in v50, in the one place it is most confusing.
  S.faults.filter(f => faultState(f) === 'open').forEach(f => {
    const disc = faultDisc(f), lab = LABS.find(l => l.disc === disc);
    out.push({ sev:'mid', src:`Open fault · ${lab ? lab.name : disc}`, ev:'measured',
      h:faultLabel(f.tag), b:f.why, tag:f.tag,
      link:{ a:'go', view:LAB_VIEW[disc] || 'putting', lab:`${lab ? lab.name : 'Putting'} lab` } });
  });
  // Severity decides the band, evidence decides the order inside it — so the warnings
  // still lead, but within them his own rounds speak before a pasted season average.
  // Array.sort is stable, so scoreTips' evidence order survives this pass.
  const order = { warn:0, mid:1, good:2 };
  return out.sort((a,b) => order[a.sev] - order[b.sev]
    || EV_RANK[a.ev || 'snapshot'] - EV_RANK[b.ev || 'snapshot']);
}

// ----- The four areas -----
// Jack's instruction (Aug 24 2026): the top of Coach reads high level across off the tee,
// irons, short game and putting, off the live round data. So this is a READER over the
// stats the app already computes — scoreStats() and shortGameStats(), both scoped to a
// card set — rather than a fourth place that counts holes for itself. Two numbers that
// disagree about the same round would be worse than no numbers.
//
// There is deliberately NO benchmark column. Jack's call: the only snapshot carrying
// fairway / GIR / scrambling detail is a 47-round archive from an older tracking app, and
// measuring today's game against a years-old baseline dressed up as a target is worse than
// showing the number on its own. When there are enough live rounds to compare against each
// other, that is the comparison worth building.
const AREAS = ['tee', 'app', 'short', 'putt'];
const AREA_LAB = { tee:'Off the tee', app:'Irons', short:'Short game', putt:'Putting' };
// Which area a ranked finding belongs to. Written down rather than inferred, and it admits
// gaps: a finding about doubles or the opening hole belongs to no single area, and one that
// maps nowhere simply highlights no tile. Same rule as FOCUS_TAG — a wrong join reads
// exactly like a right one.
const AREA_OF = {
  // scoreTips keys
  'tee-club':'tee', 'greens-lost-at-tee':'tee', 'ob':'tee',
  'approach-dir':'app', 'par-3s':'app', 'par-5s':'app',
  'three-putts':'putt', 'putt-short':'putt', 'putt-lag':'putt', 'putt-tap':'putt',
  // fault + struggle tags
  'off-tee':'tee', 'missing-short':'app', 'approach':'app', 'wedge-distance':'app',
  'up-and-down':'short', 'chipping':'short', 'bunkers':'short',
  'short-putts':'putt', 'pace-calibration':'putt', 'strike-location':'putt',
  'delivery-unverified':'putt', 'start-line-left':'putt', 'early-lift':'putt',
  'stance-creep':'putt',
};
const areaOf = f => !f ? null : (AREA_OF[f.key] || AREA_OF[f.tag] || null);

// The putting headline switches once the data exists to carry a better one. Putts-a-hole
// is what a scorecard can always give, and it is a blunt number: it cannot tell a two-putt
// from forty feet from a two-putt from five. The make rate from 4–6 ft can, it is the range
// the whole putter saga lives in, and it is the one number directly comparable to the mat
// test — so as soon as enough putts carry a distance, that becomes the headline.
const PUTT_HEADLINE_MIN = 10;

// Returns the four areas AND the stats they were computed from, so every line on the card
// speaks about the same set of cards. Reading the tiles off the live rounds and the summary
// line off everything would be a quiet lie about what the card is showing.
// WHICH CARDS THE AREA NUMBERS ARE READ OFF. Extracted so Today's four tiles and Coach's
// four areas can never disagree about the same round — they are the same numbers in two
// places, and two front pages quoting different fairway percentages would be worse than
// neither quoting one. The live-only rule and the reasoning behind it live at coachHero().
function areaCards(){
  const all = withHoles();
  const liveCards = all.filter(r => r.live);
  const holesIn = rs => rs.reduce((a, r) => a + r.holes.filter(h => h.s != null).length, 0);
  const liveHoles = holesIn(liveCards), allHoles = holesIn(all);
  const ev = liveHoles >= 18 ? 'live' : 'round';
  return { all, liveCards, liveHoles, allHoles, ev,
    cards: ev === 'live' ? liveCards : all,
    setAside: ev === 'live' ? all.length - liveCards.length : 0 };
}
function gameAreas(rounds){
  const st = scoreStats(rounds);
  const sg = shortGameStats(rounds);
  const pct = (n, d) => d ? Math.round(n / d * 100) : null;
  // topDir() yields an [key, count] entry, and it filters to the real directions — OB is a
  // price, not an aim reading, so it never becomes "your miss goes OB".
  const dirs = m => { const t = topDir(m); return t ? { k:t[0], n:t[1] } : null; };
  const out = {};

  // OFF THE TEE. Fairways, then the two things that price a miss: a tee shot that left no
  // play at all, and one that went out of bounds — two strokes before there is a ball in
  // play. Neither is a direction, which is why they are named rather than folded in.
  const fwMiss = dirs(st.fw.miss), ob = st.fw.miss.OB || 0;
  out.tee = st.fw.n ? {
    v:`${pct(st.fw.hit, st.fw.n)}%`, u:'fairways', raw:`${st.fw.hit}/${st.fw.n}`, n:st.fw.n,
    read:[ fwMiss ? `${fwMiss.n} of ${st.fw.n - st.fw.hit} misses went <b>${esc((MISS_LAB[fwMiss.k] || fwMiss.k).toLowerCase())}</b>` : '',
           st.green.noshot ? `${st.green.noshot} left <b>no play</b> at the green` : '',
           ob ? `${ob} <b>out of bounds</b> — ${ob * 2} strokes` : '' ].filter(Boolean).join('. ') + '.'
  } : null;

  // IRONS. Greens in regulation, and where the misses finish — with the conceded ones held
  // out, because a green the tee shot already took away asks a driving question, not a club
  // one. That split is the whole point of the noshot flag.
  const gMiss = dirs(st.green.miss);
  const playable = Object.entries(st.green.miss).reduce((a, [, v]) => a + v, 0);
  out.app = st.green.n ? {
    v:`${pct(st.green.hit, st.green.n)}%`, u:'greens', raw:`${st.green.hit}/${st.green.n}`, n:st.green.n,
    read:[ gMiss ? `${gMiss.n} of ${playable} playable misses finished <b>${esc((MISS_LAB[gMiss.k] || gMiss.k).toLowerCase())}</b>` : '',
           st.green.noshot ? `${st.green.noshot} charged to the tee` : '' ].filter(Boolean).join('. ') + '.'
  } : null;

  // SHORT GAME. Up and down off every missed green — including the ones the tee shot ruined,
  // because you scramble from where the ball is, not from where you meant to be.
  out.short = sg.chances ? {
    v:`${sg.saved}/${sg.chances}`, u:'up & down', raw:`${pct(sg.saved, sg.chances)}%`, n:sg.chances,
    read:`${sg.chances} chance${sg.chances === 1 ? '' : 's'} to save a hole, ${sg.saved ? `<b>${sg.saved}</b> taken` : '<b>none</b> taken'}.`
  } : null;

  // PUTTING. See PUTT_HEADLINE_MIN — the 4–6 ft make rate as soon as the distances exist,
  // putts a hole until then.
  const z = st.putts.dist.get('s');
  const zoneReady = z && z.att >= PUTT_HEADLINE_MIN;
  out.putt = st.putts.holes ? (zoneReady ? {
    v:`${pct(z.made, z.att)}%`, u:'made from 4–6 ft', raw:`${z.made}/${z.att}`, n:st.putts.distN,
    read:`${st.putts.three} three-putt${st.putts.three === 1 ? '' : 's'} over ${st.putts.holes} holes, at ${(st.putts.total / st.putts.holes).toFixed(2)} putts a hole.`
  } : {
    v:(st.putts.total / st.putts.holes).toFixed(2), u:`putts a hole · ${st.putts.total}`, raw:'', n:st.putts.holes,
    read:`${st.putts.three} three-putt${st.putts.three === 1 ? '' : 's'} and ${st.putts.one} one-putt${st.putts.one === 1 ? '' : 's'} over ${st.putts.holes} holes.`
      + (st.putts.distN < PUTT_HEADLINE_MIN ? ' <b>No putt distances logged</b> — tap them on the green and this becomes a make rate.' : '')
  }) : null;

  return { areas:out, st, sg };
}

// ----- The top of Coach: where the game is, and the one thing to work on -----
// Jack's instruction (Aug 24 2026): the only thing above the drills and the library is a
// high-level read of where he is and what to focus on right now. So this is deliberately
// ONE focus, not a ranked list — the ranked list still exists further down and is where
// the other findings live. Three parts, in the order a coach would say them: what the
// record currently says, what that makes the priority, and what to go and do about it.
//
// Everything here is derived from what is already computed. No new claim is invented at
// the top of the page: the focus is the highest-ranked signal `coachSignals()` produced,
// carrying its own evidence badge, so the strongest evidence still leads and the card
// cannot quietly outrank the page below it.
// A finding computed from scorecards and a drill that trains it are two vocabularies, so
// the join has to be written down rather than guessed. Only entries where the drill really
// does train the thing the finding names belong here — a wrong join reads exactly like a
// right one, which is why the fallback below claims nothing at all rather than pointing at
// the nearest tag. A finding with no entry is fine and common: "your opening hole runs
// +1.4" is a routine problem, and the plan it links to is the right answer, not a drill.
const FOCUS_TAG = {
  'approach-dir':'missing-short',  // the short-miss finding IS the missing-short fault
  'three-putts':'three-putts', 'putt-lag':'pace-calibration', 'putt-short':'short-putts',
  'putt-tap':'short-putts', 'tee-club':'off-tee', 'greens-lost-at-tee':'off-tee',
  'ob':'off-tee', 'par-5s':'wedge-distance', 'worst-hole':'mental',
};
const focusTag = f => f ? (f.tag || FOCUS_TAG[f.key] || null) : null;
function coachFocus(sig){
  // Warnings first, then whatever leads. `coachSignals()` has already sorted by severity
  // and then by evidence, so the first of each band is the right pick without re-sorting.
  return sig.find(t => t.sev === 'warn') || sig.find(t => t.sev === 'mid') || sig[0] || null;
}
// What the read is standing on, said plainly and with dates. "Based on the recent info we
// have" is only meaningful if the page says WHICH info and HOW recent — a focus built on a
// card from three weeks ago is a different thing from one built on Saturday's round.
function coachSince(){
  const bits = [];
  const rs = S.rounds.filter(r => r.date).slice().sort((a,b) => a.date.localeCompare(b.date));
  const lr = rs[rs.length - 1];
  if(lr) bits.push(`your last round${lr.course ? ` at ${lr.course}` : ''} on ${fmtDate(lr.date)}${lr.live ? ' (logged live)' : ''}`);
  const ss = S.sessions.filter(x => x.date).slice().sort((a,b) => a.date.localeCompare(b.date));
  const ls = ss[ss.length - 1];
  if(ls) bits.push(`film from ${fmtDate(ls.date)}`);
  const week = (S.drillLog || []).filter(r => daysSince(r.date) <= 6);
  if(week.length) bits.push(`${week.length} drill${week.length === 1 ? '' : 's'} logged this week`);
  return bits;
}
function coachHero(sig, dr){
  // LIVE FIRST (standing instruction, Aug 19 2026), and the way scoreTips() already does it:
  // once the live cards can carry the read on their own, they carry it ALONE and the older
  // cards stand down. A round's worth of live holes is the bar.
  //
  // Note this deliberately does NOT use evOf()'s second clause — at-least-half-the-sample.
  // That rule exists to stop a number computed from MIXED cards wearing a badge saying he
  // logged it live, which would be laundering. Computing from the live cards only removes
  // the mixture, so the badge is earned by construction rather than by a threshold. The
  // header says how many older cards were set aside, so nothing disappears quietly.
  const C = areaCards();
  const { all, liveHoles, allHoles, ev, cards, setAside } = C;
  const { areas: A, st: stC } = gameAreas(cards);
  const f = coachFocus(sig), fArea = areaOf(f);
  const since = coachSince();
  const up = coursePlans().up[0];
  // The focus is a fault → say exactly what trains it, which is the same row the labs use.
  // Anything else → the bench, claiming nothing about a match it cannot vouch for.
  const ft = focusTag(f);
  const work = ft ? faultDrillRow(ft)
    : `<div class="linkrow" data-action="go" data-view="drills">
         <span class="sm"><b>${dr.ready} drills on the bench</b> — nothing on the shelf trains this one
           directly; it is a decision, not a stroke.</span><span class="arr">→</span></div>`;
  // What this was read off, with dates on it. The only tile that gets a coloured top is the
  // one the focus belongs to — with no benchmark to measure against, a red tile would be an
  // invented verdict, whereas "this is the one we are working on" is a fact about the page.
  const tile = k => {
    const a = A[k], on = fArea === k;
    return `<div class="area${on ? ' focus' : ''}">
      <div class="l">${esc(AREA_LAB[k])}${on ? ' · focus' : ''}</div>
      ${a ? `<div class="v">${esc(a.v)}</div><div class="u">${esc(a.u)}${a.raw ? ` · ${esc(a.raw)}` : ''}</div>
             <div class="rd">${a.read}</div>`
          : `<div class="v faint">—</div><div class="u">not logged yet</div>
             <div class="rd">Log a live round and this fills itself in.</div>`}
    </div>`;
  };
  const counted = AREAS.filter(k => A[k]);
  const thin = counted.length && Math.min(...counted.map(k => A[k].n)) < 36;
  const rounds = cards.length;
  // The read, at the size of a thing somebody said to you. It states nothing the page below
  // doesn't — it is the same sentence the card always carried, set in the display voice,
  // with the three standing facts about the player under it. The profile is the only thing
  // here that isn't computed, and every one of its three is on `S.profile`.
  const read = allHoles
    ? `${ev === 'live'
        ? `${rounds} live round${rounds === 1 ? '' : 's'} — ${liveHoles} holes you logged standing on them`
        : `${rounds} card${rounds === 1 ? '' : 's'} on record — ${allHoles} holes`}${
      stC.holes ? `, running ${(stC.over / stC.holes).toFixed(2)} a hole over par` : ''}.`
    : 'Nothing measured yet. Everything on this page is built from your own numbers, so it stays blank until there are some.';
  const facts = [[S.profile.handicap, 'Handicap'], [S.profile.stroke, 'Stroke · confirmed'],
    [S.profile.miss, 'Signature miss']].filter(x => x[0] != null && x[0] !== '');
  return `
  <div class="card readcard">
    ${fold('coach-read', 'Where the game is', allHoles ? EV_LAB[ev].toUpperCase() : '', `
      <p class="readh">${esc(read)}</p>
      ${setAside ? `<p class="reads">${setAside} older card${setAside === 1 ? '' : 's'} set aside — this is your live rounds only.</p>` : ''}
      ${since.length ? `<p class="reads">Read off ${esc(since.join(' · '))}.</p>` : ''}
      <div class="readst">${facts.map(([v, k]) =>
        `<div><b>${esc(v)}</b><span>${esc(k)}</span></div>`).join('')}</div>`, true, 'oncard')}
  </div>

  <div class="card">
    ${allHoles ? `
      <div class="areagrid">${AREAS.map(tile).join('')}</div>
      ${thin ? `<p class="sm faint">Thin sample — some of these rest on fewer than 36 recorded
        holes, which is a flag rather than a rate. They redraw off every live round you log.</p>` : ''}`
      : `<p class="sm">Log a live round and these four fill themselves in.</p>`}
    ${f ? `<div class="tipcard ${f.sev === 'good' ? 'green' : ''}${rail(f.ev)}" style="margin-top:12px">
      <div class="src">Focus right now · ${esc(f.src)}${evTag(f.ev)}</div>
      <h4>${f.h}</h4>${expandable(f.b)}
      ${work}
    </div>
    ${sig.length > 1 ? `<p class="sm faint">${sig.length - 1} other finding${sig.length === 2 ? '' : 's'} on the board, ranked further down this page.</p>` : ''}` : ''}
    ${up ? `<div class="linkrow" data-action="open-briefing" data-id="${esc(up.id)}">
      <span class="sm"><b>Next up: ${esc(up.course || 'your round')}</b> · ${fmtDate(up.date)} — the plan is written</span><span class="arr">→</span></div>` : ''}
  </div>`;
}

function coach(){
  const st = scoreStats();
  const sig = coachSignals();
  const picks = pickedLessons();
  const counts = shelfCounts();
  const streak = weekStreak();
  const dl = drillList().filter(d => !d.missing.length);
  const dr = { ready: dl.length, home: dl.filter(d => d.where === 'home').length,
               forYou: dl.filter(d => d.why && d.due).length,
               week: (S.drillLog || []).filter(r => daysSince(r.date) <= 6).length };
  const open = S.actions.filter(a => !a.done);
  const others = sig.filter(t => t !== coachFocus(sig));
  // No plan list here on purpose. Coach owns LESSONS, DRILLS and the to-do list; a plan
  // belongs to its lab, and a course plan to Round Prep. Listing every standing plan here
  // as well put each one in two places and flattened the discipline split that the labs
  // exist to make — a course prep and a putting routine sat in one undifferentiated column.
  // The tips below still deep-link to a specific plan, which is the useful version: a
  // pointer earned by context rather than a second copy of the shelf.
  const linkFor = l => !l ? '' :
    `<div class="linkrow" data-action="${l.a}"${l.id ? ` data-id="${esc(l.id)}"` : ''}${l.view ? ` data-view="${l.view}"` : ''}>
       <span class="sm"><b>${esc(l.lab)}</b></span><span class="arr">→</span></div>`;
  // ORDER (Jack's instruction, Aug 24 2026): one high-level read of where he is and what
  // to focus on, then the two things he actually came here to open — the bench and the
  // library. Everything else is detail and sits below them. Before this, the drills were
  // the sixth block on the page and the library the last, under a to-do list and a link to
  // Scores: the two pages Coach exists to reach were the two furthest from the top.
  return `
  ${coachHero(sig, dr)}

  <div class="card">
    ${fold('coach-drills', 'Drill bench',
      `${dr.ready} READY${dr.forYou ? ` · ${dr.forYou} FOR YOU` : ''}`, `
      <div class="linkrow" data-action="go" data-view="drills">
        <span><b>Open the drill bench</b><br><span class="sm">${dr.ready} drills you have the kit for${dr.home ? ` · ${dr.home} at home` : ''}${dr.forYou ? ` · <b>${dr.forYou} matched to your game</b>` : ''}</span></span><span class="arr">→</span></div>
      ${dr.week ? `<p class="sm">${dr.week} logged in the last seven days.</p>` : ''}
      <p class="sm faint">Every lesson's drill in one list, filtered by the kit in the house and where you're standing. Drills live here and nowhere else.</p>`)}
  </div>

  <div class="card">
    ${fold('coach-library', 'The library',
      `${Object.values(counts).reduce((a, c) => a + c.n, 0)} LESSONS`, `
      <div class="shelf-grid">
        ${Object.entries(counts).map(([name,c]) => `
          <div class="shelf" data-action="open-shelf" data-shelf="${esc(name)}">
            <div class="nm">${esc(name)}</div>
            <div class="ct">${c.n} lessons</div>
            ${c.forYou ? `<span class="new">${c.forYou} FOR YOU</span>` : ''}
          </div>`).join('')}
      </div>`)}
  </div>

  <h2>Keep the streak</h2>
  <div class="card">
    ${picks.length ? picks.map(tipHTML).join('') : '<p class="sm">Lessons matched to your struggles appear here as you log rounds.</p>'}
    <button class="btn" data-action="drill-done">Mark today's work done · keep streak</button>
    <div class="streak">${streak.map(d=>`<div class="day ${d.hit?'hit':''}">${d.lab}</div>`).join('')}</div>
  </div>

  ${others.length ? `<h2>Everything else on the board · ranked</h2>
  <div class="card">
    ${others.slice(0,6).map(t => `<div class="tipcard ${t.sev === 'good' ? 'green' : ''}">
      <div class="src">${esc(t.src)}${evTag(t.ev)}</div><h4>${t.h}</h4>${expandable(t.b)}
      ${linkFor(t.link)}</div>`).join('')}
    <p class="sm faint">The focus at the top of this page is left out of this list rather than repeated. Ranked by how good the evidence is: rounds you logged hole by hole lead, then what you've measured, then the GHIN summaries — those are somebody else's arithmetic over a season, so they speak last. Within that, the warnings come first.</p>
  </div>` : ''}

  <h2>Next actions${open.length ? ` · ${open.length}` : ''}</h2>
  <div class="card">
    ${open.length ? `<ul class="check">${open.map(actionLi).join('')}</ul>`
      : '<p class="sm">Nothing open. Log a round or send Claude some film and the next things to do land here.</p>'}
    ${S.actions.some(a => a.done) ? `<details class="more">
      <summary>${S.actions.filter(a => a.done).length} done</summary>
      <ul class="check">${S.actions.filter(a => a.done).map(actionLi).join('')}</ul>
    </details>` : ''}
    <div class="formrow" style="margin-top:10px">
      <input id="newAction" placeholder="Add an action item…">
      <button class="btn ghost" data-action="add-action">Add</button>
    </div>
  </div>

  <div class="card flat"><div class="linkrow" data-action="go" data-view="rounds" data-seg="cards">
    <span><b>Score history &amp; analytics</b><br><span class="sm">${S.rounds.length ? `${S.rounds.length} rounds · scoring mix, par splits, worst holes` : 'Log a round — the coaching above is built from them'} · logging lives there</span></span><span class="arr">→</span></div></div>`;
}

function shelf(name){
  const tags = struggles();
  const items = lessons().filter(l => l.shelf === name);
  return `
  <button class="backlink" data-action="go" data-view="coach">← Coach</button>
  <h2>${esc(name)}</h2>
  ${items.map(l => {
    const forYou = l.tags.some(t=>tags.has(t)) && !S.lessonsRead.includes(l.id);
    const read = S.lessonsRead.includes(l.id);
    return `<div class="card" data-action="open-lesson" data-id="${l.id}" style="cursor:pointer">
      <h3>${esc(l.title)}</h3>
      <p class="sm faint">${l.min} min ${forYou?'· <span class="warn">FOR YOU</span>':''} ${read?'· read ✓':''}</p>
    </div>`; }).join('')}`;
}

function lesson(id){
  const l = lessons().find(x=>x.id===id);
  if(!l) return coach();
  if(!S.lessonsRead.includes(id)){ S.lessonsRead.push(id); save(); }
  return `
  <button class="backlink" data-action="open-shelf" data-shelf="${esc(l.shelf)}">← ${esc(l.shelf)}</button>
  <div class="card">
    <h2>${esc(l.shelf)} · ${l.min} min</h2>
    <h3 style="font-size:19px">${esc(l.title)}</h3>
    <p class="lesson-body">${esc(l.body)}</p>
    ${l.drill ? `<div class="lesson-drill"><b>Drill</b>${drillBody(l)}</div>` : ''}
    <div style="margin-top:12px"><button class="btn" data-action="drill-done">Did the work · keep streak</button></div>
  </div>`;
}

// One drill's practice record, and the form that adds to it. The result box is optional on
// purpose: logging that the work happened is worth something on its own, and a required
// number would just teach him to skip the button on a night he didn't count. The trend line
// only appears once there are three numbers to draw, because two points are a line through
// anything. Input font-size is left to the stylesheet — see the 16px rule; a smaller one
// here zooms the whole page on iOS and never zooms back.
function runRecord(d){
  const nums = d.runs.map(r => drillNum(r.v)).filter(v => v != null);
  const hist = d.runs.slice(-6).reverse();
  return `<div class="drun">
    <p class="sm">${d.last
      ? `<b>Last run ${fmtDate(d.last.date)}</b>${d.since === 0 ? ' · today' : d.since === 1 ? ' · yesterday' : ` · ${d.since} days ago`}${
          d.last.v ? ` · scored <b>${esc(d.last.v)}</b>` : ''}${d.runs.length > 1 ? ` · ${d.runs.length} runs on record` : ''}`
      : '<b>Never run.</b> Nothing on record for this one yet.'}</p>
    ${nums.length >= 3 ? `<div class="sm faint">Last ${nums.length} results ${spark(nums, 26, 'var(--gtext)')}</div>` : ''}
    ${hist.length > 1 ? `<details class="more"><summary>${d.runs.length} runs</summary>
      <p class="sm faint">${hist.map(r => `${fmtDate(r.date)}${r.v ? ` · ${esc(r.v)}` : ''}`).join(' · ')}</p></details>` : ''}
    <div class="formrow" style="margin-top:8px">
      <input id="dres-${esc(d.l.id)}" placeholder="Result (optional) — e.g. ${esc(passHint(d.l))}">
      <button class="minibtn" data-action="log-drill" data-id="${esc(d.l.id)}">Did it ✓</button>
    </div>
  </div>`;
}
// A placeholder taken from the drill's own pass mark, so the box asks for the unit that
// drill actually scores in rather than a generic number.
function passHint(l){
  const m = /(\d+\s*\/\s*\d+)/.exec(l.score || '');
  return m ? m[1].replace(/\s+/g, '') : '7/10';
}

// ----- The drill bench -----
// Sorted the way a decision actually gets made: is it for me, can I do it here, do I own
// the thing. Blocked drills stay on the page under their own heading — see drillList().
function drills(){
  const all = drillList();
  const place = S.settings.drillPlace || 'all';
  // A fault filter arrives from a lab's diagnosis card, so the bench can answer "what
  // trains THIS" without a lab ever growing a drill section of its own. It is deliberately
  // not sticky in settings: it is a question asked once, and a filter still silently on
  // next week would make the page lie about what is due.
  const tag = drillTag;
  const here = d => place === 'all' || !d.where || d.where === place;
  const inTag = d => !tag || d.l.tags.includes(tag);
  const shown = all.filter(d => here(d) && inTag(d));
  const ready = shown.filter(d => !d.missing.length);
  // Matching on tags alone flags roughly half the library, which is a list, not a
  // priority. So the top group is capped at six and ordered filmed-fault first, then by
  // what has gone longest without being run — and the ones that don't make the cut keep
  // their FOR YOU badge in the group below rather than disappearing, so the page never
  // claims the shortlist is everything.
  const matched = ready.filter(d => d.why && d.due)
    .sort((a,b) => (b.filmed ? 1 : 0) - (a.filmed ? 1 : 0)
                || (b.since == null ? 1e6 : b.since) - (a.since == null ? 1e6 : a.since));
  const forYou = matched.slice(0,6);
  const rest = ready.filter(d => !forYou.includes(d));
  const spill = matched.length - forYou.length;
  const blocked = shown.filter(d => d.missing.length);
  const week = (S.drillLog || []).filter(r => daysSince(r.date) <= 6);
  const chip = (k, lab, n) => `<span class="chip ${place === k ? 'on' : ''}" data-action="pick-place" data-place="${k}">${esc(lab)}${n ? ` · ${n}` : ''}</span>`;
  const card = d => {
    // Naming the place is only worth a line when the list spans more than one of them.
    const label = [d.l.shelf].concat(place === 'all' ? [d.where ? PLACES[d.where] : 'Anywhere'] : []).join(' · ');
    return `<details class="sect" id="drill-${esc(d.l.id)}">
      <summary><b>${esc(label)}${d.why && d.due ? ' <span class="warn">FOR YOU</span>' : ''}</b>
        <span class="gist">${esc(d.l.title)}</span></summary>
      ${d.missing.length ? `<p class="sm warn"><b>Needs ${esc(d.missing.map(k => KIT_LAB[k] || k).join(' + '))}</b> — mark it above once you have it.</p>` : ''}
      ${d.why ? `<p class="sm faint">Matched to your game: ${esc(splitLead(d.why)[0])}</p>` : ''}
      ${drillBody(d.l)}
      ${d.kit.length ? `<div class="chips">${d.kit.map(k => `<span class="chip static ${haveKit(k) ? 'grn' : 'ns'}">${esc(KIT_LAB[k] || k)}</span>`).join('')}</div>` : ''}
      ${runRecord(d)}
      <div class="linkrow" data-action="open-lesson" data-id="${esc(d.l.id)}">
        <span class="sm"><b>Why this drill exists</b> — read the lesson</span><span class="arr">→</span></div>
    </details>`;
  };
  const group = (title, list, note) => !list.length ? '' : `
    <div class="secthead"><h2>${title} · ${list.length}</h2>
      <button class="minibtn" data-action="toggle-sections">Expand all</button></div>
    ${note ? `<p class="sm faint" style="margin:-4px 0 6px">${note}</p>` : ''}
    <div class="card">${list.map(card).join('')}</div>`;
  return `
  <button class="backlink" data-action="go" data-view="coach">← Coach</button>

  ${tag ? `<div class="card">
    <h2>Training one fault</h2>
    <p class="sm">Showing only what trains <b class="warn">${esc(faultLabel(tag))}</b> — the finding that sent you
      here is on the page you came from.
      ${shown.length ? `${shown.length} drill${shown.length === 1 ? '' : 's'}.` : 'Nothing in the library trains it yet.'}</p>
    <div class="chips"><span class="chip on" data-action="clear-drill-tag">✕ Show every drill</span></div>
  </div>` : ''}

  <div class="card">
    <h2>Your practice week</h2>
    <p class="sm">${week.length
      ? `<b>${week.length} drill${week.length === 1 ? '' : 's'}</b> logged in the last seven days${
          (S.drillLog || []).length > week.length ? ` · ${(S.drillLog || []).length} on record all told` : ''}.`
      : 'Nothing logged in the last seven days. Tap <b>Did it ✓</b> under a drill when you run it — that is what turns a pass mark into a trend.'}</p>
    <p class="sm faint">Logging a drill records WHICH one and what it scored, so the bench can put the ones going stale back at the top. It keeps the streak alive too.</p>
  </div>

  <h2>What you've got</h2>
  <div class="card">
    <p class="sm">Tap what you own. Nothing is assumed — the ones already lit are the ones your record proves, plus a tee, which anyone carrying that bag has.</p>
    <div class="chips">
      ${KIT.map(g => `<span class="chip ${haveKit(g.k) ? 'grn' : ''}" data-action="toggle-kit" data-kit="${g.k}">${esc(g.lab)}</span>`).join('')}
    </div>
    <p class="sm faint">A drill needing something you haven't marked doesn't vanish — it drops to the bottom of this page with the missing item named.</p>
  </div>

  <h2>Where are you?</h2>
  <div class="card">
    <div class="chips">
      ${chip('all', 'Everything', all.length)}
      ${Object.entries(PLACES).map(([k, lab]) =>
        chip(k, lab, all.filter(d => d.where === k).length)).join('')}
    </div>
  </div>

  ${group('For you right now', forYou,
    `Matched to a fault or a struggle that is currently open, film-measured ones first, then whatever has gone longest unrun — and you have the kit for every one.${spill ? ` ${spill} more carry the badge below.` : ''}`)}
  ${group('Ready to go', rest)}
  ${group('Needs kit you haven\'t marked', blocked,
    'Not hidden, just parked — every one of these is a tap on the kit list away.')}
  ${!shown.length ? '<div class="card"><p class="sm">Nothing filed under that place yet.</p></div>' : ''}
  <p class="sm faint" style="margin:10px 0">Every drill here belongs to a lesson in the library — this page is the same shelf sorted by what you can actually do today. A drill drops off the shortlist when you log it, and comes back when it goes stale; close the fault it trains in a lab and it stops being flagged at all.</p>`;
}

// ----- Session deep-dive -----
function sessionView(i){
  const s = S.sessions[+i];
  if(!s) return putting();
  const d = s.detail;
  const sc = { good:'var(--green)', warn:'var(--burg)', mid:'var(--ink)' };
  const disc = sessionDiscipline(s);
  const SESSION_LAB = { swing:['swing','Swing Lab'], 'short-game':['shortgame','Short Game'], putting:['putting','Putting Lab'] };
  return `
  <button class="backlink" data-action="go" data-view="${SESSION_LAB[disc][0]}">← ${SESSION_LAB[disc][1]}</button>
  <div class="card">
    <h2>${fmtDate(s.date)} · film breakdown</h2>
    <h3>${esc(s.setup)}</h3>
    ${!d ? `<p class="sm" style="margin-top:8px">${esc(s.finding)}</p>
      <p class="sm faint">No deep-dive attached — sessions you log yourself carry the summary only. Filmed sessions analyzed by Claude arrive with the full breakdown.</p>` : `
    <div class="rowgrid g3" style="margin:12px 0 4px">
      ${d.metrics.map(m => `<div class="stat" style="border-top-color:${sc[m.s]||'var(--green)'}">
        <div class="v" style="font-size:13px;color:${sc[m.s]||'var(--green)'}">${esc(m.v)}</div>
        <div class="l">${esc(m.k)}</div>
        <div class="n" style="font-size:9px;color:var(--faint);font-family:var(--sans);margin-top:2px">${esc(m.n||'')}</div>
      </div>`).join('')}
    </div>
    <h2 style="margin-top:14px">What the film showed</h2>
    ${prose(d.story)}
    ${d.compare ? `<details class="sect"><summary><b>Versus prior sessions</b><span class="gist">${esc(splitLead(d.compare)[0])}</span></summary>${prose(d.compare)}</details>` : ''}
    ${d.limits ? `<details class="sect"><summary><b>What this angle couldn't see</b><span class="gist">${esc(splitLead(d.limits)[0])}</span></summary>${prose(d.limits)}</details>` : ''}
    `}
  </div>`;
}

// ----- Round-prep briefing -----
function briefing(id){
  const b = S.briefings.find(x => x.id === id);
  if(!b) return home();
  const played = S.courses.find(c => c.name.toLowerCase() === b.course.toLowerCase());
  const wx = playsFactor();
  // An undated plan is usually a lab routine, but a COURSE plan is undated too — course
  // knowledge doesn't expire — and sending that one back to the Swing Lab is nonsense.
  const isCourse = !!played || S.rounds.some(r => courseMatches(r.course, b.course));
  // Back where it came from. A discipline plan belongs to its lab; a COURSE plan belongs
  // to Round Prep — which is the second segment of Rounds since Aug 27 2026, so the link
  // names the tab and the segment rather than a page of its own.
  const LAB = { putting:['putting','Putting Lab'], mental:['mental','Mental Game'], 'short-game':['shortgame','Short Game'] };
  const lab = LAB[b.discipline] || ['swing','Swing Lab'];
  const [backView, backLabel] = b.date || isCourse ? ['rounds','Round Prep'] : lab;
  const backSeg = backView === 'rounds' ? ' data-seg="prep"' : '';
  return `
  <button class="backlink" data-action="go" data-view="${backView}"${backSeg}>← ${backLabel}</button>
  <div class="card">
    <h2>${b.date ? 'Round prep · ' + fmtDate(b.date) : 'Standing plan'}</h2>
    <h3 style="font-size:19px">${esc(b.course)}</h3>
    ${b.focus ? `<p class="sm" style="margin-top:4px"><b class="warn">${b.date ? "Today's one focus:" : 'The short version:'}</b> ${esc(b.focus)}</p>` : ''}
    ${played ? `<p class="sm faint" style="margin-top:6px">Your history: ${played.rating != null ? 'rated ' + Number(played.rating).toFixed(2) : 'unrated'}${played.pr != null ? ' · PR ' + esc(played.pr) : ''}${played.notes ? ' · "' + esc(played.notes) + '"' : ''}</p>` : ''}
    ${wx ? `<p class="sm faint">Conditions now: ${Math.round(S.weather.t)}°F — carries play ${wx>1?'+':''}${((wx-1)*100).toFixed(1)}% (see the ladder's Today column).</p>` : ''}
  </div>
  ${b.rules && b.rules.length ? `<div class="card flat">
    <h2>If you read nothing else</h2>
    <div class="steprules top">${b.rules.map(r => `<span>${esc(r)}</span>`).join('')}</div>
  </div>` : ''}
  ${b.steps && b.steps.length ? `<div class="card">
    <h2>The routine</h2>
    <ol class="steps">${b.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
  </div>` : ''}
  ${(b.holes || []).length ? `<div class="card">
    <h2>Hole by hole</h2>
    <table><tr><th>Hole</th><th>The play</th></tr>
      ${b.holes.filter(h => h && h.n && (h.play || h.note || (h.why || []).length)).map(h =>
        `<tr><td><b>${h.n}</b>${h.yds ? `<br><span class="sm faint">${h.yds}y</span>` : ''}</td>
        <td class="sm">${(() => {
          const rows = [[h.playAs || 'Tee', h.play], ['Leaves', h.leaves],
                        ['Green', h.green], ['Avoid', h.avoid]].filter(r => r[1]);
          return rows.length ? `<dl class="hi-grid">${rows.map(([k, v], i) =>
            `<dt>${esc(k)}</dt><dd class="${k === 'Avoid' ? 'hot' : i === 0 && h.play ? 'lead' : ''}">${emph(v)}</dd>`).join('')}</dl>` : '';
        })()}
        ${h.note ? emph(h.note) : ''}
        ${(h.why || []).length ? `<ul class="hi-why">${h.why.map(w => `<li>${emph(w)}</li>`).join('')}</ul>` : ''}</td></tr>`).join('')}
    </table>
    <p class="sm faint" style="margin-top:8px">Each of these surfaces on its own hole while you're logging a live round — that's the point of writing them.</p>
  </div>` : ''}
  ${(b.sections || []).length ? `<div class="card">
    <div class="secthead">
      <h2>The detail</h2>
      <button class="minibtn" data-action="toggle-sections">Expand all</button>
    </div>
    <p class="sm faint" style="margin:-4px 0 6px">${b.sections.length} sections · about ${readMins(b)} min end to end. Tap any one to open it.</p>
    ${b.sections.map(s => `<details class="sect">
      <summary><b>${esc(s.t)}</b><span class="gist">${esc(gist(s))}</span></summary>
      ${prose(s.b)}
    </details>`).join('')}
  </div>` : ''}
  <p class="sm faint" style="margin:10px 0">Briefed by Claude from course research + your bag, carries, and stroke history.</p>`;
}

// ----- Short game -----
// Nothing new is logged for this: it is the green-miss and up-and-down data already sitting
// in the hole arrays, asked as a short-game question instead of a scoring one.
// Takes an optional card set, exactly as scoreStats() does, so the same arithmetic can be
// asked of the live cards alone or of everything — one implementation, two scopes, and no
// way for the lab's number and the Coach card's number to drift apart.
function shortGameStats(rounds){
  const a = { holes:0, gir:0, miss:{}, chances:0, saved:0, noshot:0, rounds:0, live:0 };
  (rounds || withHoles()).forEach(r => {
    let counted = false;
    r.holes.forEach(h => {
      if(h.gir === undefined || h.gir === null) return;
      if(!counted){ a.rounds++; counted = true; }
      a.holes++;
      if(h.gir){ a.gir++; return; }
      if(h.noshot) a.noshot++;
      const k = h.gmiss || 'X';
      a.miss[k] = (a.miss[k] || 0) + 1;
      // You scramble from where the ball IS — a conceded green still counts, same rule the
      // round card uses, so the two numbers can never disagree.
      a.chances++;
      if(r.live) a.live++;
      if(h.s != null && h.par != null && h.s - h.par <= 0) a.saved++;
    });
  });
  return a;
}
function shortgame(){
  const pc = (n, d) => d ? Math.round(n / d * 100) : 0;
  const plans = plansFor('short-game');
  const other = plans.filter(b => !isRoutine(b));
  const a = shortGameStats();
  const sessions = S.sessions.map((x,i) => ({ s:x, i })).filter(o => sessionDiscipline(o.s) === 'short-game').reverse();
  const missRow = Object.entries(a.miss).sort((x,y) => y[1]-x[1])
    .map(([k,v]) => `${v} ${MISS_LAB[k] || k}`).join(' · ');
  return `
  ${labBar('short-game')}
  ${cheatBtn('short-game')}
  ${routineBlock(plans)}

  ${other.length ? `<h2>Plans</h2><div class="card">${planLinks(other)}</div>`
    : `<h2>Plans</h2><div class="card"><p class="sm">No short-game plan yet — ask Claude for one and it lands here.</p></div>`}

  ${a.holes ? `<div class="rowgrid g3">
    <div class="stat"><div class="v">${pc(a.gir, a.holes)}%</div><div class="l">Greens hit</div></div>
    <div class="stat"><div class="v">${pc(a.saved, a.chances)}%</div><div class="l">Up &amp; down</div></div>
    <div class="stat"><div class="v">${a.chances}</div><div class="l">Greens missed</div></div>
  </div>
  <div class="card">
    <h2>Around the green · what the cards say</h2>
    <p class="sm"><b>${a.saved} of ${a.chances}</b> missed greens saved, over ${a.holes} recorded holes${a.rounds ? ` in ${a.rounds} round${a.rounds>1?'s':''}` : ''}.
    ${missRow ? `Where they finished: ${esc(missRow)}.` : ''}</p>
    ${a.holes < 36 ? `<p class="sm faint" style="margin-top:6px">Thin sample — ${a.holes} of the 36 recorded holes this starts speaking confidently at. Log greens and misses on the live round and this fills itself.</p>` : ''}
  </div>` : `<div class="card"><h2>Around the green</h2>
    <p class="sm">Nothing logged yet. Every green you mark missed on a live round — and where it finished — lands here as scrambling data.</p></div>`}

  ${diagnosisCard('short-game', 'No short-game faults on the card yet. Log a few rounds with green misses, or send chipping film, and they land here.')}

  <h2>Film room</h2>
  <div class="card">
    ${sessionLog(sessions, 'No short-game film yet. Send chipping, pitching or bunker clips — name the shot in the message and they file themselves here.')}
  </div>

  <h2>Train it</h2>
  <div class="card flat">
    <div class="linkrow" data-action="open-shelf" data-shelf="Wedges &amp; Short Game"><span><b>Wedges &amp; Short Game</b><br><span class="sm">Clock system, bounce, chip vs pitch, landing spots</span></span><span class="arr">→</span></div>
    <div class="linkrow" data-action="open-shelf" data-shelf="Bunker Play"><span><b>Bunker Play</b><br><span class="sm">Splash, distance by follow-through, plugged lies</span></span><span class="arr">→</span></div>
    <div class="linkrow" data-action="go" data-view="drills" style="border-bottom:none"><span><b>The drill bench</b><br><span class="sm">Every drill you have the kit for, filtered by where you are</span></span><span class="arr">→</span></div>
  </div>`;
}

// ----- The labs hub -----
// Four labs behind one nav button. The bar was at eight tabs and a short-game lab would
// have made nine; these four are the same KIND of thing — a discipline with faults, film
// and plans — so they belong behind one door. Training is deliberately NOT on that list:
// drills live on the bench in Coach, one home for all of them. Nor is Round Prep, as of
// Aug 27 2026 — a course plan is about the round you are about to play, not about a part
// of your game, so it sits in Rounds beside the cards it gets judged against.
// `short` is the cheat sheet's tab label — four have to sit in one row on a phone.
const LABS = [
  { view:'swing',     disc:'swing',       ic:'🏌', name:'Full Swing',  short:'Swing', sub:'Driver to wedge — film, plans, speed work.' },
  { view:'shortgame', disc:'short-game',  ic:'⛳', name:'Short Game',  short:'Short', sub:'Around the green — chipping, pitching, bunkers.' },
  { view:'putting',   disc:'putting',     ic:'◎', name:'Putting',     short:'Putting', sub:'Stroke, pace and the short ones.' },
  { view:'mental',    disc:'mental',      ic:'🧠', name:'Mental',      short:'Mental', sub:'Staying locked in — decided off the course.' },
];
// THE PLANS SIT DIRECTLY UNDER THE ROUTINE, ABOVE THE DIAGNOSIS (Jack's instruction,
// Aug 30 2026) — same reason the hub's way-in moved up, one level down. The plans are what
// you came to READ; the diagnosis is what they are built on, and on any lab with faults
// open it is several screens of reading between the top of the page and the workshop log.
// A lab's order is now: which lab · the cheat sheet · the routine · the plans · the
// diagnosis · the film · the rest. Mental already read this way and was left alone.
//
// The lab switcher, at the top of every lab (Jack's instruction, Aug 30 2026). Before
// this, moving from Putting to Short Game meant going back to the hub and picking again —
// two taps and a page you did not want, on the four pages most likely to be read one after
// another. Same idiom as the Rounds segmented control, and the same relationship to the
// jump bar underneath it: the segments say WHICH lab you are in, the jump bar says where
// you are inside it, so buildJumpBar() puts itself after this and the order can't invert.
//
// FIXED ORDER, always — LABS order, the same standing instruction the hub follows. A bar
// that reordered itself would defeat the muscle memory that is the entire reason it is
// here. The lab you are already in is inert rather than a link: it is a state, not a
// destination, and a tap that reloads the page you are on reads as a dead control.
function labBar(disc){
  return `<div class="segbar labs">${LABS.map(l => l.disc === disc
    ? `<button class="seg on" aria-current="page">${esc(l.short)}</button>`
    : `<button class="seg" data-action="go" data-view="${l.view}">${esc(l.short)}</button>`
  ).join('')}</div>`;
}
function labRow(l, last){
  const open = faultsFor(l.disc).filter(f => faultState(f) === 'open').length;
  const plans = plansFor(l.disc).length;
  return `<div class="linkrow" data-action="go" data-view="${l.view}"${last ? ' style="border-bottom:none"' : ''}>
    <span><b>${l.ic} ${esc(l.name)}</b><br><span class="sm">${esc(l.sub)}</span>
    <br><span class="sm faint">${open ? `${open} open fault${open>1?'s':''}` : 'no open faults'} · ${plans} plan${plans===1?'':'s'}</span></span>
    <span class="arr">→</span></div>`;
}
// ----- What a fault was read off (Aug 27 2026) -----
// A fault carries `{tag, why}` and nothing else, so the evidence tier it renders with has
// to be WRITTEN DOWN rather than guessed at, exactly like FOCUS_TAG and DRILL_KIT. Every
// entry below is grounded in what that fault's own text says its basis is, and the `src`
// is the sample it names — nothing here is a number or a source invented on its behalf.
//
// A tag with NO entry is normal and fine: it renders with no rail and no chip, and the card
// claims nothing about where it came from. That is the honest failure mode, and it is why
// this table is explicit rather than inferred from the prose — a fault text saying "filmed"
// and one saying "the film could not settle it" read identically to a keyword scan.
const FAULT_EV = {
  // Read off the Aug 12 Sterling Farms card — a scorecard, hole by hole, typed up after.
  'pace-calibration':['round', '18 holes at Sterling Farms, Aug 12 — 38 putts, three 3-putts'],
  'up-and-down':['round', '12 missed greens on one card — Sterling Farms, Aug 12'],
  'missing-short':['round', '12 green misses on one card — 7 of them short'],
  // Read off film, and each says so: the measurement exists, or it is the measurement that
  // could not be made from the angles shot.
  'strike-location':['measured', 'Aug 10 evening start lines — ~0.8° scatter either side, no bias'],
  'delivery-unverified':['measured', 'Aug 10 — 23 oblique clips and six on the target line, neither able to see lean'],
  'across-the-line-top':['measured', 'Jul 26 film, both clubs'],
  'posture-through-impact':['measured', 'Aug 20 film — the first that caught a finish'],
  // Its own text says NOT MEASURED: seven stills neither confirm nor refute it. It is his
  // lifelong read of his own miss, which is exactly what the `self` tier is for.
  'over-the-top-slice':['self', 'Your own lifelong read — Aug 20 stills could neither confirm nor refute it'],
};
const faultEv = f => FAULT_EV[f.tag] || null;
// The diagnosis, one row per open fault, each carrying its own tier rail and a tappable
// chip that opens what the fault was read off. Settled ones collapse to a line — the same
// behaviour `faultState()` has always produced, drawn instead of listed.
function faultRows(disc){
  const all = faultsFor(disc);
  const open = all.filter(f => faultState(f) === 'open');
  const settled = all.filter(f => faultState(f) !== 'open');
  if(!all.length) return `<p class="sm">Nothing here is measured yet. No film, no faults —
    this lab fills itself the moment something gets shot or logged.</p>`;
  return `${open.length ? open.map(f => { const e = faultEv(f);
    return `<div class="faultrow${rail(e ? e[0] : null)}">
      ${e ? evDrawer(`ev-fault-${f.tag}`, 'Diagnosis', e[0], e[1])
          : '<div class="evdl">Diagnosis</div>'}
      <h4>${esc(faultLabel(f.tag))}</h4>
      ${expandable(f.why)}
      ${faultDrillRow(f.tag)}
    </div>`; }).join('')
    : `<p class="sm">No open faults here — everything tracked in this lab has been measured shut.</p>`}
  ${settled.length ? `<p class="sm faint" style="margin-top:10px"><b>Settled:</b> ${settled.map(f =>
      esc(faultLabel(f.tag)) + (faultState(f) === 'downgraded' ? ' (downgraded)' : ' ✓')).join(' · ')}</p>` : ''}`;
}
// FIXED ORDER, always (Jack's instruction, Aug 14 2026): Swing · Short Game · Putting ·
// Mental, top down — LABS order. It used to float the last-opened lab to the top, which
// meant the row you wanted was in a different place every visit — muscle memory beats
// recency on a page whose whole job is to get you somewhere else in one tap. Add a new lab
// to the END of LABS rather than reordering it.
//
// The hub is the four labs and NOTHING ELSE (Aug 27 2026, Jack's redesign). Round Prep
// used to sit at the bottom of this list; it lives in Rounds now, beside the cards its
// plans get judged against. This page is the game you are working on, not the round you
// are about to play.
//
// THE WAY INTO THE LAB SITS DIRECTLY UNDER THE GRID (Jack's instruction, Aug 30 2026). It
// was the last thing on the page, under a diagnosis that runs several screens on any lab
// with faults open — so picking Putting and then actually opening Putting were separated
// by everything the hub had to say about it. Picking a lab and entering it are one motion;
// the diagnosis is what you read INSTEAD of going in, not something to scroll past on the
// way. The selected tile is still a second door (it reads OPEN LAB ›), which is why this
// row can be plain rather than shouting.
// Which lab the hub is showing. View-local state, like `roundsSeg`: which face of the hub
// you last looked at is a property of the page, not of the player, so it is a module
// variable and never saved. Switching is a rerender() — you have not gone anywhere.
let gameLab = LABS[0].disc;
function game(){
  const cur = LABS.find(l => l.disc === gameLab) || LABS[0];
  const clips = S.sessions.filter(s => sessionDiscipline(s) === cur.disc).length;
  const plans = plansFor(cur.disc).length;
  const open = faultsFor(cur.disc).filter(f => faultState(f) === 'open').length;
  return `
  <div class="labgrid">${LABS.map(l => {
    const on = l.disc === cur.disc;
    const n = faultsFor(l.disc).filter(f => faultState(f) === 'open').length;
    return `<button class="labsel ${on ? 'on' : ''}" data-action="${on ? 'go' : 'game-lab'}"
      data-view="${l.view}" data-disc="${l.disc}">
      <span class="k">${n ? `${n} OPEN` : 'CLEAR'}${on ? ' · OPEN LAB ›' : ''}</span>
      <span class="nm">${esc(l.name)}</span>
      <span class="sb">${esc(l.sub)}</span></button>`; }).join('')}</div>

  <div class="card flat">
    <div class="linkrow" data-action="go" data-view="${cur.view}" style="border-bottom:none">
      <span><b>Open the ${esc(cur.name)} lab</b><br><span class="sm">The film room, the plans,
        and everything this diagnosis is built on</span></span><span class="arr">→</span></div>
  </div>

  <div class="card">
    ${fold('game-diag', 'Diagnosis', `${cur.name.toUpperCase()} · ${
      open ? `${open} OPEN FAULT${open === 1 ? '' : 'S'}` : 'NOTHING OPEN'}`, faultRows(cur.disc))}
  </div>

  <div class="twoup">
    <div class="card tu"><div class="rdl">Film room</div>
      <b>${clips || '—'}</b>
      <span>${clips ? `session${clips === 1 ? '' : 's'} on file` : 'no film on file'}</span></div>
    <div class="card tu"><div class="rdl">Standing plans</div>
      <b>${plans || '—'}</b>
      <span>${plans ? 'sliced by situation' : 'none written yet'}</span></div>
  </div>`;
}

// ----- Courses -----
// The rankings answer three different questions and they do not share an order: which
// course did you like best, where have you played best, and which of these could you get
// to today. So the list sorts by any of the three and says which one it is in — a list
// that silently re-ordered itself is worse than one that never did.
//
// Two rules hold across all three. NULLS GO LAST, never to zero: a course you have not
// rated is not a course you rated 0, and one with no PR on file is not one you shot
// nothing at. And the sort is only ever a re-ordering — nothing drops off the page for
// want of a value. Array.prototype.sort is stable, so ties keep the order they were added
// in rather than shuffling between renders.
// ----- Two rows, one course -----
// Importing a batch of courses from anywhere else is how a list ends up with two rows for
// one course: his spelling and the import's differ, and `course-add` only dedupes on an
// EXACT name match. Caught the day the round history landed — he already had "Mammoth
// Dunes" and the import added "Sand Valley Golf Resort — Mammoth Dunes" beside it.
//
// This only ever NAMES the pairs worth a look. It never merges and never deletes: which
// spelling survives is his call, and the rating, PR and notes on those rows are his data,
// not something to be picked between by a heuristic.
const COURSE_STOP = new Set(['golf','club','course','courses','country','the','at','of','and','cc','gc','resort']);
const courseWords = n => (n || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  .split(' ').filter(w => w && !COURSE_STOP.has(w));
function courseDupes(list){
  const sub = (a, b) => a.length > 0 && a.every(w => b.includes(w));
  const out = [];
  for(let i = 0; i < list.length; i++) for(let j = i + 1; j < list.length; j++){
    const a = list[i], b = list[j];
    // Two courses at one facility are written "Facility — Course" and are genuinely two
    // rows. Whistling Straits' Straits and Irish are not a duplicate of each other, and
    // flagging them as one would train him to ignore this card.
    if(/ — /.test(a.name || '') && / — /.test(b.name || '')) continue;
    const wa = courseWords(a.name), wb = courseWords(b.name);
    if(sub(wa, wb) || sub(wb, wa)) out.push([a, b]);
  }
  return out;
}

const COURSE_SORTS = [['rating','Rating'], ['pr','PR'], ['dist','Nearest']];
function courseSortKey(){
  const k = S.settings.courseSort;
  return COURSE_SORTS.some(x => x[0] === k) ? k : 'rating';
}
function sortCourses(list, key){
  const val = c => key === 'pr' ? (c.pr != null ? +c.pr : null)
    : key === 'dist' ? courseMiles(c.name)
    : (c.rating != null ? +c.rating : null);
  // Rating counts DOWN from the best; a PR and a distance both count up from the lowest.
  const dir = key === 'rating' ? -1 : 1;
  return [...list].sort((a, b) => {
    const x = val(a), y = val(b);
    if(x == null && y == null) return 0;
    if(x == null) return 1;
    if(y == null) return -1;
    return (x - y) * dir;
  });
}
// What the current order is, what it leaves at the bottom, and — on distance — where the
// fix came from and that these are straight-line miles. Same honesty guards as Round Prep,
// which sorts the standing plans off the same location.
function courseSortNote(list, key){
  const missing = (n, what) => !n ? '' :
    ` ${n} ${n > 1 ? 'have' : 'has'} no ${what} on file, so ${n > 1 ? 'they sit' : 'it sits'} at the bottom rather than counting as a zero.`;
  if(key === 'pr')
    return `<b>Best score first.</b>${missing(list.filter(c => c.pr == null).length, 'PR')} A PR is the lowest score you have sent me for that course — send a better one and it moves.`;
  if(key === 'dist'){
    const placed = list.filter(c => courseGeo(c.name)).length;
    if(!S.here) return `Sorted by rating for now — your phone hasn't given up a location yet.<br><br>${
      placed ? `<button class="btn ghost tiny" data-action="locate">Use my location</button> — the arithmetic happens on this phone and nothing about where you are is sent anywhere.`
             : 'No course here has a location on file yet, so there is nothing to measure from.'}`;
    return `<b>Nearest first</b>, from your last location fix (${fmtDate(isoDay(new Date(S.here.ts)))}) — straight-line miles to the course, <b>not drive time</b>.${
      missing(list.length - placed, 'location')}`;
  }
  return `<b>Your rating, best first.</b>${missing(list.filter(c => c.rating == null).length, 'rating')}`;
}
function courses(){
  const played = S.courses.filter(c=>!c.bucket);
  const bucket = S.courses.filter(c=>c.bucket);
  const states = new Set(played.map(c=>c.st).filter(Boolean));
  const rated = played.filter(c=>c.rating!=null);
  const avg = rated.length ? (rated.reduce((s,c)=>s+ +c.rating,0)/rated.length).toFixed(1) : '—';
  // Distance falls back to the rating order until the phone has given up a fix — the list
  // still renders in a sensible order, and the note under it says why it isn't distance.
  const key = courseSortKey();
  const live = key === 'dist' && !S.here ? 'rating' : key;
  const sorted = sortCourses(played, live);
  // One row renderer, shared by the rankings and the duplicate check.
  const row = c => {
    const mi = courseMilesLab(c.name);
    return `<div class="crs" data-action="edit-course" data-id="${c.id}">
      <span class="nm">${esc(c.name)}<span class="st">${esc(c.st||'')}</span>${mi ? `<span class="mi">${mi}</span>` : ''}</span>
      <span class="rt">${c.rating!=null? Number(c.rating).toFixed(2) : '—'}${c.pr!=null?' · PR '+esc(c.pr):''}</span>
    </div>`;
  };
  return `
  <div class="rowgrid g3">
    <div class="stat"><div class="v">${played.length}</div><div class="l">Played</div></div>
    <div class="stat"><div class="v">${states.size}</div><div class="l">States/Countries</div></div>
    <div class="stat"><div class="v">${avg}</div><div class="l">Avg rating</div></div>
  </div>

  ${(() => {
    const d = courseDupes(S.courses);
    if(!d.length) return '';
    return `<h2>Two rows, one course?</h2>
    <div class="card">
      ${d.map(pair => `<div class="dupe">${pair.map(row).join('')}</div>`).join('')}
      <p class="sm faint" style="margin-top:8px">These look like the same course under two names — usually one you added yourself and one that came in with an import. Tap the row you want to lose and <b>Delete</b> it; the other keeps its rating, PR and notes. If they really are two courses, ignore this. Two courses at one club are written <i>Facility — Course</i> and are never flagged against each other.</p>
    </div>`;
  })()}

  <h2>The rankings</h2>
  <div class="card">
    <div class="chips">${COURSE_SORTS.map(([k,l]) =>
      `<span class="chip ${k===key?'on':''}" data-action="course-sort" data-k="${k}">${l}</span>`).join('')}</div>
    ${sorted.length ? sorted.map(row).join('') : '<p class="sm">No courses yet — add your first below.</p>'}
    <p class="sm faint" style="margin-top:8px">${courseSortNote(played, key)}<br><br>Tap a course to edit its rating, PR or notes. Seeded from your course sheet — fix anything I guessed wrong.</p>
  </div>

  <h2>Bucket list</h2>
  <div class="card flat">
    ${bucket.length ? bucket.map(c=>`<div class="crs" data-action="edit-course" data-id="${c.id}">
      <span class="nm">${esc(c.name)}<span class="st">${esc(c.st||'')}</span>${
        courseMilesLab(c.name) ? `<span class="mi">${courseMilesLab(c.name)}</span>` : ''}</span><span class="rt">someday</span></div>`).join('') : '<p class="sm">Nothing queued.</p>'}
  </div>

  <h2 id="courseFormAnchor">${editingCourse ? 'Edit course' : 'Add a course'}</h2>
  <div class="card">
    <label>Name</label><input id="coNa" list="courseDbList" placeholder="Start typing — the directory suggests as you go" value="${esc(editingCourse?.name||'')}">
    <datalist id="courseDbList">${(typeof COURSE_DB!=='undefined'?COURSE_DB:[]).map(c=>`<option value="${esc(c.n)}">${esc(c.st)}</option>`).join('')}</datalist>
    <div class="formrow g3">
      <div><label>State</label><input id="coSt" maxlength="14" value="${esc(editingCourse?.st||'')}" placeholder="MA"></div>
      <div><label>Your rating 0–10</label><input id="coRt" inputmode="decimal" value="${editingCourse?.rating ?? ''}" placeholder="7.5"></div>
      <div><label>PR score</label><input id="coPr" inputmode="numeric" value="${editingCourse?.pr ?? ''}" placeholder="82"></div>
    </div>
    <label>Notes (the hole that ate you, local knowledge…)</label>
    <textarea id="coNo" rows="2">${esc(editingCourse?.notes||'')}</textarea>
    <div class="chips"><span class="chip ${editingCourse?.bucket?'grn':''}" id="coBucket">Bucket list</span></div>
    <div style="margin-top:10px">
      <button class="btn" data-action="save-course">${editingCourse?'Save changes':'Add course'}</button>
      ${editingCourse ? `<button class="btn ghost" data-action="cancel-edit-course">Cancel</button>
      <button class="btn burg" data-action="delete-course">Delete</button>` : ''}
    </div>
  </div>`;
}
let editingCourse = null;

// ----- Decisions -----
function decisions(){
  const dl = daysLeft(S.settings.returnDeadline);
  const idx = estIndex();
  const decided = S.clubs.find(c => c.cat==='putter' && c.status==='gaming' && c.flow==='zt');
  const pending = pendingReturn();
  return `
  <button class="backlink" data-action="go" data-view="home">← Home</button>
  <div class="card">
    <h2>The putter call</h2>
    ${decided ? `<p class="sm"><b class="good">DECIDED ✓ — ${esc(decided.name)} is in the bag.</b> ${!pending
        ? 'The equipment half of the left miss is settled. Next: the face-on clip and the 20-ball baseline to confirm the miss is gone.'
        : pending === decided
          ? `Not final though — <b>the gamer itself is still inside its return window</b> (${dl===null?'deadline unknown':dl+' days left'}). Grind it on the numbers and decide on purpose, rather than letting the window lapse or sending it back on a feeling.`
          : `Still open: the return window on the ${esc(pending.name)} (<b>${dl===null?'deadline unknown':dl+' days left'}</b>).`}</p>`
    : `<p class="sm">Exchange for a <b>zero-torque at 34"</b>. Demo → 10-ball test → decide. <b>${dl===null?'Deadline not set':dl+' days left'}.</b></p>`}
  </div>

  <h2>Shortlist · from your fitted top-10</h2>
  <div class="card">
    <table><tr><th>Putter</th><th>Type</th><th>~$</th><th>Demoed</th></tr>
    ${S.shortlist.map((p,i)=>`<tr>
      <td><b>${esc(p.name)}</b></td><td class="sm">${esc(p.type)}</td><td>${p.price}</td>
      <td><span class="chip ${p.demoed?'grn':''}" data-action="toggle-demo" data-i="${i}">${p.demoed?'✓ yes':'not yet'}</span></td></tr>`).join('')}
    </table>
  </div>

  <h2>10-ball 5-footer test</h2>
  <div class="card">
    <p class="sm">Head-to-head vs. the 7.5 control — same green, same putt, full routine. Log every run:</p>
    <div class="formrow g3">
      <div><label>Putter</label><input id="tePutter" list="testPutters" placeholder="Phantom 7.5 (control)"></div>
      <div><label>Makes /10</label><input id="teMakes" inputmode="numeric" placeholder="7"></div>
      <div style="align-self:end"><button class="btn" data-action="save-test">Log run</button></div>
    </div>
    <datalist id="testPutters">
      <option value="Phantom 7.5 (control)">${S.shortlist.map(p=>`<option value="${esc(p.name)}">`).join('')}
    </datalist>
    <label>Miss pattern / feel notes</label><input id="teNote" placeholder="e.g. both misses right — no more left!">
    ${S.tests.length ? `<table style="margin-top:12px"><tr><th>Date</th><th>Putter</th><th>Makes</th><th>Notes</th></tr>
      ${S.tests.slice().reverse().map(t=>`<tr><td>${fmtDate(t.date)}</td><td><b>${esc(t.putter)}</b></td><td><b>${esc(t.makes)}</b>/10</td><td class="sm">${esc(t.note||'')}</td></tr>`).join('')}</table>` : ''}
    <div class="tipcard" style="margin-top:12px"><div class="src">Decision rule</div>
      <p class="sm">The winner needs the left miss to visibly dry up vs. the control — then give it 2–3 weeks before final judgment. Get the lie set flat at pickup.</p></div>
  </div>`;
}

// ----- Scores: history, analytics, tips -----
// Rounds arrive two ways: logged in-app (a total only) and pushed through the
// coach feed with hole-by-hole detail. Every analytic below degrades to nothing
// when `holes` is missing, so old score-only rounds never break the page.
function withHoles(){ return S.rounds.filter(r => Array.isArray(r.holes) && r.holes.length); }
function roundPar(r){
  if(r.par != null) return r.par;
  if(Array.isArray(r.holes)) return r.holes.reduce((a,h) => a + (h.par || 0), 0);
  return null;
}
function roundVsPar(r){ const p = roundPar(r); return (p != null && r.score != null) ? r.score - p : null; }
// USGA score differential. On a 9-hole card the 9-hole rating/slope give a
// 9-hole differential — doubling it is the 18-hole equivalent.
function roundDiff(r){
  if(r.rating == null || !r.slope || r.score == null) return null;
  const d = (113 / r.slope) * (r.score - r.rating);
  return (r.holes && r.holes.length <= 9) ? d * 2 : d;
}

// Stat snapshots pasted in from whatever app produced them (GHIN, older trackers).
// Stored as a list so an old baseline and a current read can sit side by side —
// the delta between them is worth more than either one alone. Snapshots carry
// their own sample sizes, and everything here degrades when a field is absent.
// The gamer putter's in-play date, so the app can tell which data predates it.
function putterSince(){
  const p = S.clubs.find(c => c.cat === 'putter' && c.status === 'gaming' && c.since);
  return p ? p.since : null;
}
// Whatever is currently sittable-in-a-return-window. The flag lives on the club so the
// countdown follows the gear rather than one hardcoded head — the gamer itself can be
// the thing on the clock, which is exactly the case the old Phantom-only check missed.
function pendingReturn(){
  return S.clubs.find(c => c.returnWindow && c.status !== 'returned') || null;
}
// A snapshot's `coversThrough` is the last round it includes — NOT the day it was
// read off the phone, which is why the read date can't be used for this.
function statsCoverPutter(){
  const since = putterSince();
  if(!since) return true;
  return S.stats.some(s => (s.coversThrough || '') >= since)
      || S.rounds.some(r => (r.date || '') >= since);
}

function latestStats(){ return S.stats && S.stats.length ? S.stats[S.stats.length-1] : null; }
function baselineStats(){ return S.stats && S.stats.length > 1 ? S.stats[0] : null; }
function parOrBetter(g){ const s = g && g.scoring; return s ? (s.birdie||0) + (s.par||0) : null; }
// These are sums of pasted percentages, so they arrive with float dust on them
// (40.699999999999996). Never print one raw.
const pc1 = v => v == null ? '—' : `${(+v).toFixed(1)}%`;
function blowUps(g){ const s = g && g.scoring; return s ? (s.double||0) + (s.triple||0) : null; }
// Up-and-down rate: some sources give a percentage, GHIN gives a per-round count
// that only means something against how many greens were missed.
function upDownPct(g){
  if(!g) return null;
  if(g.upDownPct != null) return g.upDownPct;
  if(g.upDownsPerRound != null && g.gir != null){
    const missed = 18 * (1 - g.gir / 100);
    return missed > 0 ? (g.upDownsPerRound / missed) * 100 : null;
  }
  return null;
}

// `live` names the areas where hole-by-hole cards now carry a bigger, better-measured
// sample than this pasted snapshot does. Film is king; by the same rule, a hole you
// recorded beats a season average somebody else computed — so those tips stand down and
// the live ones on the Scores page speak instead.
function statTips(live){
  const g = latestStats(), b = baselineStats();
  const t = [];
  if(!g) return t;
  live = live || {};
  const a = g.approach, p = g.putting, ap = g.avgByPar || {}, d = g.driving;
  const nAdv = g.roundsAdvanced || g.rounds || 0, nSc = g.roundsScoring || g.rounds || 0;
  const thin = n => n < 5 ? ` (only ${n} round${n===1?'':'s'} behind this — indicative, not settled)` : '';

  // The headline when there's a baseline: where the strokes actually moved.
  if(b){
    const dPutts = (b.putts != null && g.putts != null) ? b.putts - g.putts : null;
    const dGir = (b.gir != null && g.gir != null) ? g.gir - b.gir : null;
    if(dPutts != null && dPutts >= 1.5 && dGir != null && dGir <= -3)
      t.push({ ev:'snapshot', s:'warn', src:`Then vs now · ${b.rounds || b.roundsScoring} rds → ${nSc} rds`, h:'The leak is tee-to-green',
        b:`Putts per round are DOWN ${dPutts.toFixed(1)} (${b.putts.toFixed(1)} → ${g.putts.toFixed(1)}), but greens in regulation fell ${Math.abs(dGir).toFixed(1)} points (${b.gir}% → ${g.gir}%)${b.driving && d ? ` and fairways ${b.driving.fairway}% → ${d.fairway}%` : ''}, and scoring barely moved: par-or-better ${pc1(parOrBetter(b))} → ${pc1(parOrBetter(g))}, doubles ${pc1(blowUps(b))} → ${pc1(blowUps(g))}. Whatever you saved on the greens you handed back before you got there. The strokes are tee-to-green.` });
    const dOne = (b.putting && p && b.putting.one != null && p.one != null) ? p.one - b.putting.one : null;
    if(dPutts != null && dPutts >= 1.5 && dOne != null && Math.abs(dOne) <= 2)
      t.push({ ev:'snapshot', s:'mid', src:'Read this one carefully', h:'The putting gain is partly an artefact',
        b:`Putts per round dropped ${dPutts.toFixed(1)}, but the one-putt rate is flat (${b.putting.one}% → ${p.one}%). Missing more greens mechanically lowers putts per round — you chip on and putt once instead of lagging from forty feet. So the drop is at least partly fewer greens hit, not a better stroke.` });
  }

  if(!statsCoverPutter()){
    const pn = (S.clubs.find(c => c.cat === 'putter' && c.status === 'gaming') || {}).name || 'the current putter';
    t.push({ ev:'snapshot', s:'warn', src:'Nothing measured yet', h:`No round data covers ${pn}`,
      b:`Every stat here — and every round logged — predates it. The mat tests and the stroke film are promising, but they are not scoring. Until a round is played and logged with it, its effect on your score is unmeasured, and nothing in this list should be read as a verdict on it either way. Play one, log the putts, and it becomes answerable.` });
  }

  if(a && a.short != null && !live.approach){
    const sides = (a.left || 0) + (a.right || 0);
    if(a.short >= 30 && a.short >= sides)
      t.push({ ev:'snapshot', s:'warn', src:`Approach · ${nAdv} rounds`, h:'You miss short, not sideways',
        b:`${a.short}% of approaches finish SHORT against ${a.left||0}% left, ${a.right||0}% right and ${a.long||0}% long. That is not dispersion — a scattergun misses every direction. A miss that only ever goes one way is a DISTANCE problem: the number you're clubbing to is longer than the club actually carries. Club up one when between clubs, and re-baseline your ladder to AVERAGE carry rather than your best strike. A yardage set built from your purest 7-iron comes up short all day${thin(nAdv)}.` });
  }
  const ud = upDownPct(g), udB = upDownPct(b);
  if(ud != null && ud < 30)
    t.push({ ev:'snapshot', s:'warn', src:`Short game · ${nAdv} rounds`, h:`Scrambling around ${Math.round(ud)}%`,
      b:`${g.gir != null ? `At ${g.gir}% greens you're missing about ${(18*(1-g.gir/100)).toFixed(0)} a round. ` : ''}Every miss you don't convert is a bogey at best.${udB != null ? ` And this isn't new — it was ${udB.toFixed(0)}% in the older data too, so it's a standing weakness rather than a bad patch.` : ''} With greens hit this low, up-and-down rate moves your score more than ball-striking does, and it's the cheapest thing here to practise${thin(nAdv)}.` });
  if(p && p.three != null && p.three >= 10 && !live.putting)
    t.push({ ev:'snapshot', s:'warn', src:`Putting · ${nAdv} rounds`, h:`${p.three}% three-putts or worse`,
      b:`Roughly ${(p.three/100*18).toFixed(1)} a round, against ${p.one||0}% one-putts. Three-putts are a PACE fault, not a line fault — the first putt is finishing outside gimme range. Same signature as the lag work already on your card${thin(nAdv)}.` });
  if(ap[5] != null && ap[4] != null && (ap[5] - 5) >= 0.6)
    t.push({ ev:'snapshot', s:'mid', src:`Scoring · ${nSc} rounds`, h:'Par 5s give you nothing',
      b:`Averaging ${ap[5].toFixed(2)} on par 5s — barely better relative to par than your ${ap[4].toFixed(2)} on par 4s. The textbook line is that a par 5 is where a mid-handicap gets a free run at birdie — that is general advice about mid-handicaps, not a reading of your card; the average above is yours. Decide the lay-up off your wedge ladder so the third shot is a number you own.` });
  const blow = blowUps(g);
  if(blow != null && blow >= 15)
    t.push({ ev:'snapshot', s:'warn', src:`Scoring · ${nSc} rounds`, h:`${blow}% of holes are double or worse`,
      b:`Across ${nSc} rounds, so this is the baseline rather than one bad week. Against ${g.scoring.birdie||0}% birdies, your score is decided by the bad holes, not the good ones. Taking the punch-out instead of the hero shot is worth more strokes than any swing change.` });
  return t;
}

function statsCard(){
  const g = latestStats(), b = baselineStats();
  if(!g) return '';
  const pc = v => v == null ? '—' : `${(+v).toFixed(v % 1 ? 1 : 0)}%`;
  const nm = v => v == null ? '—' : (+v).toFixed(v % 1 ? 2 : 1);
  const rows = [
    ['Par or better', parOrBetter(b), parOrBetter(g), pc, 'up'],
    ['Double or worse', blowUps(b), blowUps(g), pc, 'down'],
    ['Birdies', b && b.scoring && b.scoring.birdie, g.scoring && g.scoring.birdie, pc, 'up'],
    ['Avg · par 3', b && b.avgByPar && b.avgByPar[3], g.avgByPar && g.avgByPar[3], nm, 'down'],
    ['Avg · par 4', b && b.avgByPar && b.avgByPar[4], g.avgByPar && g.avgByPar[4], nm, 'down'],
    ['Avg · par 5', b && b.avgByPar && b.avgByPar[5], g.avgByPar && g.avgByPar[5], nm, 'down'],
    ['Greens in reg.', b && b.gir, g.gir, pc, 'up'],
    ['Fairways hit', b && b.driving && b.driving.fairway, g.driving && g.driving.fairway, pc, 'up'],
    ['Putts / round', b && b.putts, g.putts, nm, 'down'],
    ['One-putts', b && b.putting && b.putting.one, g.putting && g.putting.one, pc, 'up'],
    ['Up & down', upDownPct(b), upDownPct(g), pc, 'up'],
  ].filter(r => r[2] != null);
  const arrow = (was, now, dir) => {
    if(was == null || now == null) return '';
    const d = now - was;
    if(Math.abs(d) < 0.05) return '<span class="faint">—</span>';
    const good = dir === 'up' ? d > 0 : d < 0;
    return `<b style="color:${good ? 'var(--green)' : 'var(--burg)'}">${d > 0 ? '+' : ''}${d.toFixed(Math.abs(d) < 10 ? 1 : 0)}</b>`;
  };
  const a = g.approach;
  return `
  <h2>Tracked stats</h2>
  <div class="card">
    <table><tr><th>Metric</th>${b ? `<th>${esc(b.label || 'Then')}</th>` : ''}<th>${esc(g.label || 'Now')}</th>${b ? '<th>Δ</th>' : ''}</tr>
      ${rows.map(([k, was, now, fmt, dir]) => `<tr><td class="sm"><b>${k}</b></td>
        ${b ? `<td class="sm faint">${fmt(was)}</td>` : ''}<td><b>${fmt(now)}</b></td>
        ${b ? `<td class="sm">${arrow(was, now, dir)}</td>` : ''}</tr>`).join('')}
    </table>
    ${a && a.short != null ? `<p class="sm" style="margin-top:8px">Approach misses: <b class="warn">${a.short}% short</b> · ${a.left||0}% left · ${a.right||0}% right · ${a.long||0}% long.</p>` : ''}
    <p class="sm faint" style="margin-top:8px">
      ${b ? `<b>${esc(b.label||'Then')}</b> — ${b.rounds || b.roundsScoring} rounds${b.avgScore ? `, averaging ${b.avgScore}` : ''}. ` : ''}
      <b>${esc(g.label||'Now')}</b> — ${g.roundsScoring || g.rounds} rounds of scoring${g.roundsAdvanced && g.roundsAdvanced !== (g.roundsScoring || g.rounds) ? `, but only ${g.roundsAdvanced} with the shot-level detail, so treat greens, fairways and putts as indicative` : ''}.</p>
  </div>
  ${statsTrend()}`;
}

// Every snapshot in date order. The Then/Now table only ever shows the oldest and the
// newest, so a season that sits between them is invisible without this.
function statsTrend(){
  const list = (S.stats || []).filter(s => s.scoring || s.avgByPar);
  if(list.length < 3) return '';
  const pc = v => v == null ? '—' : `${(+v).toFixed(v % 1 ? 1 : 0)}%`;
  const nm = v => v == null ? '—' : (+v).toFixed(2);
  const ap = (s, n) => s.avgByPar && s.avgByPar[n];
  return `
  <h2>Year by year</h2>
  <div class="card">
    <table><tr><th>Span</th><th>Par+</th><th>Dbl+</th><th>P3</th><th>P4</th><th>P5</th></tr>
      ${list.map(s => `<tr>
        <td class="sm"><b>${esc(s.label || fmtDate(s.date))}</b><br><span class="faint">${s.roundsScoring || s.rounds || '—'} rds</span></td>
        <td><b>${pc(parOrBetter(s))}</b></td>
        <td><b>${pc(blowUps(s))}</b></td>
        <td class="sm">${nm(ap(s, 3))}</td>
        <td class="sm">${nm(ap(s, 4))}</td>
        <td class="sm">${nm(ap(s, 5))}</td></tr>`).join('')}
    </table>
    ${(() => {
      // Posted scores are a wider net than the scoring summary — GHIN's donut only counts
      // rounds entered hole-by-hole, so the two round counts rarely agree.
      const posted = list.filter(s => s.avgScore != null);
      return posted.length ? `<p class="sm">Posted scores — ${posted.map(s =>
        `<b>${esc(s.label || fmtDate(s.date))}</b>: ${s.roundsPosted || s.roundsScoring || s.rounds || '—'} rds, avg ${s.avgScore}${
          s.lowScore != null && s.highScore != null ? ` (${s.lowScore}–${s.highScore})` : ''}`).join(' · ')}.</p>` : '';
    })()}
    <p class="sm faint">Par+ = par or better · Dbl+ = double or worse · P3/P4/P5 = scoring average by par.
    Sample sizes and course difficulty differ year to year, so read the direction rather than the decimals.</p>
  </div>`;
}

// Best 40% of score differentials, the way a handicap index is built. Needs a few
// rounds behind it before it means anything, so it stays null until then.
function estIndex(){
  const d = S.rounds.map(roundDiff).filter(v => v != null).sort((a,b) => a - b);
  if(d.length < 3) return null;
  const n = Math.max(1, Math.round(d.length * 0.4));
  return d.slice(0, n).reduce((a,b) => a + b, 0) / n;
}

function scoreStats(rounds){
  const rs = rounds || withHoles();
  const mix = { eagle:0, birdie:0, par:0, bogey:0, double:0, triple:0 };
  const byPar = { 3:{n:0,over:0,red:0}, 4:{n:0,over:0,red:0}, 5:{n:0,over:0,red:0} };
  const opening = { n:0, over:0 };
  const spots = new Map();
  const tee = new Map(), app = new Map();
  // `saved` / `bogey` are the SCRAMBLE numbers (Jack's word, Aug 30 2026): of the tee shots
  // that missed the fairway, how many still scored par or better, and how many still scored
  // bogey or better. His own definition, and deliberately the mirror of up & down — that one
  // asks whether he saved the hole from off the GREEN, this asks whether he saved it from
  // off the FAIRWAY. Counted here rather than anywhere else so no second pass over the holes
  // can ever disagree with the fairway percentage sitting beside it.
  const fw = { n:0, hit:0, saved:0, bogey:0, miss:{} }, green = { n:0, hit:0, miss:{}, noshot:0 };
  const putts = { holes:0, total:0, one:0, three:0, dist:new Map(), distN:0 };
  // How much of this sample Jack logged himself, on the hole. It decides which evidence
  // badge the findings below carry and when the pasted GHIN claims stand down — see
  // EV_RANK. Counted per hole rather than per round, because a nine and an eighteen are
  // not the same amount of evidence.
  const live = { rounds:0, holes:0, fw:0, green:0, putts:0, pd:0 };
  let holes = 0, over = 0;
  rs.forEach(r => { if(r.live) live.rounds++; });
  rs.forEach(r => r.holes.forEach((h, i) => {
    if(h.s == null || h.par == null) return;
    const L = !!r.live;
    const d = h.s - h.par;
    holes++; over += d;
    if(L) live.holes++;
    if(d <= -2) mix.eagle++; else if(d === -1) mix.birdie++; else if(d === 0) mix.par++;
    else if(d === 1) mix.bogey++; else if(d === 2) mix.double++; else mix.triple++;
    const p = byPar[h.par];
    if(p){ p.n++; p.over += d; if(d < 0) p.red++; }
    if(i === 0){ opening.n++; opening.over += d; }
    const n = h.n ?? i + 1;
    const k = `${r.course}|${n}`;
    const e = spots.get(k) || { course:r.course, hole:n, par:h.par, n:0, over:0, notes:[] };
    e.n++; e.over += d;
    // Carried, not counted. The worst-hole finding is arithmetic; what he wrote standing
    // on the hole is the only record of why it keeps happening, and it rides along so the
    // finding can quote it rather than leave him to remember.
    if(h.note) e.notes.push({ text:h.note, date:r.date, over:d });
    spots.set(k, e);
    // Shot detail. Recorded per hole since the live logger existed; absent on the older
    // score-only cards, which is why every consumer below gates on its own sample size.
    if(h.putts != null){
      putts.holes++; putts.total += h.putts;
      if(L) live.putts++;
      if(h.putts <= 1) putts.one++; else if(h.putts >= 3) putts.three++;
      if(puttFirstK(h) || puttMadeK(h)){ bagPutt(putts.dist, h); putts.distN++; if(L) live.pd = (live.pd || 0) + 1; }
    }
    if(h.gir != null){
      green.n++;
      if(L) live.green++;
      if(h.gir) green.hit++;
      else if(h.noshot) green.noshot++;      // charged to the tee, not the approach
      else { const g = h.gmiss || 'X'; green.miss[g] = (green.miss[g] || 0) + 1; }
    }
    if(h.fw != null){
      fw.n++;
      if(L) live.fw++;
      if(h.fw) fw.hit++;
      else {
        const g = h.fmiss || 'X'; fw.miss[g] = (fw.miss[g] || 0) + 1;
        // `d` is this hole against par, and the loop has already returned on a hole with no
        // score, so every missed fairway counted here has one. Nested, not two conditions:
        // par-or-better is a subset of bogey-or-better, and they must never drift apart.
        if(d <= 1){ fw.bogey++; if(d <= 0) fw.saved++; }
      }
    }
    if(h.tee) bagShot(tee, h.tee, h, d, TEE_OWNS(h));
    if(h.app) bagShot(app, h.app, h, d, APP_OWNS);
  }));
  const worst = [...spots.values()].filter(e => e.n >= 2)
    .sort((a,b) => (b.over / b.n) - (a.over / a.n)).slice(0, 5);
  return { rs, mix, byPar, opening, worst, holes, over, tee, app, fw, green, putts, live };
}

// Which badge a finding computed off the hole sample should wear. `live` is claimed only
// when his own live cards actually carry the sample — a round's worth of them, and at
// least half of everything counted — because a badge that says "you logged this live" over
// a number mostly made of fed-in rounds would be exactly the kind of laundering the
// evidence ranks exist to prevent.
function evOf(liveHoles, allHoles){
  return liveHoles >= 18 && liveHoles >= allHoles * 0.5 ? 'live' : 'round';
}

// Every finding carries WHERE IT CAME FROM, and the strength of that source decides the
// order it's read in. Rounds Jack logged hole by hole are the strongest thing he owns:
// he was there, he recorded it, and it is his own current game. A pasted GHIN summary is
// somebody else's arithmetic over a season that may predate the bag he's playing — still
// worth having, but it goes last. Same rule as "film is king", applied to the numbers.
// `self` is the weakest rank on purpose: a debrief is Jack telling us how the round felt,
// which is the mental tab's only available witness for anything a scorecard can't see —
// and still the first thing to give way when a card disagrees with it.
//
// `live` sits ABOVE `round` (standing instruction, Aug 19 2026). A card logged in the live
// logger was recorded ON the hole, between shots, with the bag he is playing today —
// nothing sits between the shot and the record. Everything else, however good, is one
// remove further away: typed up afterwards from memory, or fed in from a summary. So as
// soon as his live cards carry a question, they are what the app answers it from, and the
// weaker sources stand down rather than being averaged in beside them.
const EV_RANK = { live:0, round:1, measured:2, snapshot:3, self:4 };
const EV_LAB = { live:'you logged this live', round:'from your rounds', measured:'measured',
  snapshot:'GHIN summary', self:'your own read' };
const evTag = ev => ev ? ` <span class="ev ${ev}">${EV_LAB[ev]}</span>` : '';

// ----- The evidence disclosure (Aug 27 2026) -----
// Every finding already says where it came from; this is the door behind that badge.
// Tapping the tier chip opens EVIDENCE USED: what was counted, what it was read off, and —
// the part that matters — what this source CANNOT tell you. The first two come from the
// finding itself (its own `src` is the sample it fired on); the third is written down PER
// TIER rather than per finding, because it is a property of the source and not of the
// number: a scorecard cannot see a stroke however many holes of it there are, and a season
// summary cannot be broken back down to a hole. Nothing here is invented about a specific
// finding — a made-up limitation reads exactly like a real one, which is the whole failure
// the tier ladder exists to prevent.
//
// It is ONE `<details id=…>`, deliberately: render() reopens any open <details> carrying an
// id after a rerender(), so the open state costs no store and cannot drift out of sync.
// Reuse it wherever a finding renders — Today, the labs, the round card — so a tier is
// never explained two different ways on two screens.
const EV_SOURCE = {
  live:'Cards you logged hole by hole in the live logger — recorded on the hole, between shots, with the bag you are playing today.',
  round:'Your own scorecards, typed up after the round rather than tapped in on the hole.',
  measured:'A measurement — film of the stroke, or a scored test.',
  snapshot:'A season summary somebody else computed, pasted in.',
  self:'Your own account of a round, written afterwards.' };
const EV_BLIND = {
  live:'A card records WHAT happened, never why. Nothing on it measures the stroke that produced it, and nothing reads the notes you wrote on it.',
  round:'One remove from the shot — written up after the round, so a hole detail is only as good as the memory of it. And a scorecard still cannot see a stroke.',
  measured:'Measured in one place on one day. Whether it holds up on the course is a different question, and this is not it.',
  snapshot:'It cannot be broken back down to a hole, and it may predate the bag you are playing. It is an average, not an event.',
  self:'Not a measurement. Nothing on a card confirms or contradicts it — it is the only witness for what a scorecard cannot see, and it is still a feel.' };
// id     unique and STABLE — the key the reopen-after-rerender works off
// label  the header text left of the chip
// ev     the tier, one of the five
// sample what was counted — pass the finding's own `src`, never a number you invented
// more   optional extra sentence about what THIS finding leaves unmeasured
function evDrawer(id, label, ev, sample, more){
  const tier = ev || 'snapshot';
  return `<details class="evdis" id="${esc(id)}">
    <summary><span class="evdl">${esc(label)}</span><span class="ev ${tier}">${esc(EV_LAB[tier] || tier)}</span></summary>
    <div class="evpanel"><b>Evidence used</b>
      <dl>${sample ? `<dt>Sample</dt><dd>${esc(sample)}</dd>` : ''}
        <dt>Source</dt><dd>${esc(EV_SOURCE[tier] || '')}</dd>
        <dt>Not measured</dt><dd>${esc(EV_BLIND[tier] || '')}${more ? ' ' + esc(more) : ''}</dd></dl>
    </div>
  </details>`;
}

// Tips fire off thresholds in the data, so they only appear once there's
// enough of it to mean anything. Each one carries the number that triggered it.
// Every finding this page can make out of hole data, computed over whatever set of cards
// it is handed and badged with where they came from. Each one carries a stable `key` so
// the same finding computed two ways can be recognised as the same finding — which is
// what lets the live-card version of it replace the all-cards version below.
function holeTips(st, EV){
  const t = [];

  // The tee-club verdict. This is the question a bag with both a driver and a mini
  // driver in it exists to answer, and it needs both clubs to have had a real run.
  const teeRun = [...st.tee.values()].filter(e => e.fwN >= 8);
  if(teeRun.length >= 2){
    const rate = e => e.fwHit / e.fwN * 100;
    const rank = teeRun.slice().sort((x, y) => rate(y) - rate(x));
    const straight = rank[0], wild = rank[rank.length - 1];
    if(rate(straight) - rate(wild) >= 15){
      const sPer = straight.over / straight.n, wPer = wild.over / wild.n;
      const scoresBetter = wPer < sPer - 0.1;
      t.push({ key:'tee-club', ev:EV, s: scoresBetter ? 'mid' : 'warn', src:`Off the tee · ${straight.fwN + wild.fwN} tee shots`,
        h:`${clubName(straight.key)} finds ${Math.round(rate(straight))}% of fairways · ${clubName(wild.key)} ${Math.round(rate(wild))}%`,
        b:`Across ${straight.fwN} and ${wild.fwN} recorded tee shots. The holes score ${sPer > 0 ? '+' : ''}${sPer.toFixed(2)} a hole with the ${clubName(straight.key)} against ${wPer > 0 ? '+' : ''}${wPer.toFixed(2)} with the ${clubName(wild.key)}. ${scoresBetter
          ? `So the wilder club is still the one that scores — the extra length is paying for the misses. Keep hitting it; this is the case AGAINST clubbing down out of fear.`
          : `So the ${clubName(wild.key)} is costing you position and buying nothing back. On the tight holes that is a free ${(wPer - sPer).toFixed(2)} a hole for taking the ${clubName(straight.key)} instead — the fairway-finder earning its slot in the bag.`}` });
    }
  }

  // The hole-measured twin of the snapshot's "you miss short". This one counts greens
  // you recorded yourself rather than an average computed elsewhere — and only the ones
  // you had a play at, because a green the drive took away can't answer a club question.
  if(st.green.n >= 18){
    const missed = st.green.n - st.green.hit;
    const real = missed - st.green.noshot;
    const top = topDir(st.green.miss);
    if(real >= 8 && top && top[1] / real >= 0.4)
      t.push({ key:'approach-dir', ev:EV, s:'warn', src:`Approach · ${real} playable misses`, h:`${Math.round(top[1] / real * 100)}% of your playable green misses go ${MISS_LAB[top[0]] || top[0]}`,
        b:`${top[1]} of ${real}${st.green.noshot ? `, after setting aside ${st.green.noshot} green${st.green.noshot === 1 ? '' : 's'} the tee shot took away` : ''}, off ${st.green.hit}/${st.green.n} greens hit. A miss that only ever goes one way is not dispersion — dispersion sprays every direction. ${top[0] === 'S'
          ? 'Short is a DISTANCE fault: the number you are clubbing to is longer than the club actually carries. Club to cover the middle-to-back of the green, and re-baseline the ladder to average carry rather than your purest strike.'
          : top[0] === 'Lg' ? 'Long is usually adrenaline or an overcorrection off a run of short ones — worth checking whether these follow your good drives.'
          : 'A one-sided miss this consistent is face-and-path, not club selection. That one belongs in the Swing lab.'}` });

    // The other half of the split: when enough greens are conceded at the tee, the
    // approach numbers are a symptom and the driving is the disease.
    if(st.green.noshot >= 4 && st.green.noshot / missed >= 0.25){
      const worst = [...st.tee.values()].filter(e => e.noshot).sort((x, y) => y.noshot - x.noshot)[0];
      t.push({ key:'greens-lost-at-tee', ev:EV, s:'warn', src:`Off the tee · ${st.green.noshot} of ${missed} green misses`, h:`${Math.round(st.green.noshot / missed * 100)}% of your green misses were lost at the tee`,
        b:`${st.green.noshot} of ${missed} missed greens came from holes where you had no realistic play once you reached the ball — the stroke was gone before the approach club came out of the bag. Approach practice cannot touch these${worst ? `, and ${clubName(worst.key)} accounts for ${worst.noshot} of them across ${worst.n} tee shots` : ''}. Compare that against the fairway percentages above: finding the short grass matters less than never being dead, and those are different bets.` });
    }
  }

  if(st.putts.holes >= 36){
    const rate = st.putts.three / st.putts.holes;
    if(rate >= 0.08)
      t.push({ key:'three-putts', ev:EV, s:'warn', src:`Putting · ${st.putts.holes} holes recorded`, h:`${st.putts.three} three-putts in ${st.putts.holes} holes`,
        b:`${(rate * 18).toFixed(1)} a round, against ${st.putts.one} one-putts and ${(st.putts.total / st.putts.holes).toFixed(2)} putts a hole overall. Three-putts are a PACE fault, not a line fault — the first putt is finishing outside gimme range. This is the live-round evidence for the standing distance-control priority, and the 30-ft ladder is what turns it into a number you can move.` });
  }

  // Out of bounds is the one miss with a fixed price on it, so it is the one finding on
  // this page that needs no interpretation at all: count them, multiply by two.
  const obT = st.fw.miss.OB || 0, obG = st.green.miss.OB || 0, obN = obT + obG;
  if(obN >= 2 && st.holes >= 18)
    t.push({ key:'ob', ev:EV, s:'warn', src:`Out of bounds · ${obN} shot${obN === 1 ? '' : 's'}`,
      h:`OB has cost you ${obN * 2} strokes across ${st.holes} holes`,
      b:`${obT ? `${obT} off the tee` : ''}${obT && obG ? ' and ' : ''}${obG ? `${obG} on a shot at the green` : ''}. Out of bounds is stroke and distance — one penalty plus replaying the shot, so every one of these is two strokes before you have a ball in play, and it does not appear anywhere in your fairway or green percentages as anything worse than an ordinary miss. That is ${(obN * 2 / st.holes * 18).toFixed(1)} strokes a round of pure penalty. The fix is never a swing fix on the day: it is the club and the start line on the holes where OB is actually in play, decided on the tee before the swing rather than after it.` });

  // ---- What the first-putt distance answers that a putt count never could ----
  if(st.putts.distN >= 18){
    const P = st.putts.dist;
    const shortB = P.get('s');            // 4–6 ft: the scoring zone, and his signature miss
    if(shortB && shortB.att >= 8){
      const made = Math.round(shortB.made / shortB.att * 100);
      const test = latestFiveFt(), ts = test ? fiveFtScore(test) : null;
      t.push({ key:'putt-short', ev:EV, s: made >= 60 ? 'good' : 'warn',
        src:`Putting · ${shortB.att} putts from 4–6 ft`,
        h:`${made}% from the scoring zone — ${shortB.made} of ${shortB.att}`,
        b:`${made >= 60 ? 'That holds up' : 'This is the range the whole putter search has been about'}, and it is the first time it has been measured ON A GREEN rather than on a mat.${
          ts ? ` Your last 5-ft test was ${ts.makes}/${ts.total} (${Math.round(ts.makes / ts.total * 100)}%) — ${
            Math.abs(made - Math.round(ts.makes / ts.total * 100)) <= 10
              ? 'the two agree, so the mat number is telling you the truth about the course.'
              : made < Math.round(ts.makes / ts.total * 100)
                ? 'the course number is the lower one, which is what slope, grain and a real first putt do to a stroke that works flat. Practise these on a green with break, not on the mat.'
                : 'the course number is the HIGHER one, so the mat is being harder on you than the golf course is.'}` : ''}${
          shortB.gim ? ` ${shortB.gim} more from this range ${shortB.gim === 1 ? 'was' : 'were'} given, and they are not in that number — a conceded putt is an unplayed one, and this is the last statistic in the app that should be flattered.` : ''} The standing read is that the miss is an AIM error rather than a delivery one, and the barely-open face is the fix — this number is how you find out whether it worked.` });
    }
    const lag = puttRoll(P, ['xl', 'xxl']);   // 21 ft and out — where pace decides the hole
    // A lag that got conceded finished inside gimme range. Nothing else on a scorecard
    // says how CLOSE a long putt finished, which is the whole distance-control question.
    const near = lag.lagIn ? ` And ${lag.lagIn} of them finished inside gimme range — ${Math.round(lag.lagIn / lag.first * 100)}% lagged to a putt nobody made you hit, which is the only proximity number this card can produce and the one worth watching alongside the three-putts.` : '';
    if(lag.first >= 8){
      const rate = lag.three / lag.first;
      t.push({ key:'putt-lag', ev:EV, s: rate >= 0.15 ? 'warn' : 'good',
        src:`Putting · ${lag.first} first putts from 21 ft +`,
        h: rate >= 0.15 ? `${lag.three} three-putts from long range — ${Math.round(rate * 100)}% of them`
          : `${Math.round((1 - rate) * 100)}% of your long putts finish in two`,
        b:`${rate >= 0.15
          ? `Distance control is the open fault and this is it with a number on it at last: from past twenty feet you are failing to two-putt one hole in ${(1 / rate).toFixed(1)}. A three-putt from here is pace, not line — the first putt is finishing outside gimme range and the second one is a real putt. The 30-ft ladder is the drill that moves this: log shorts, spread and green speed, and watch this row rather than your total putts.`
          : `From past twenty feet you are two-putting all but ${lag.three} of ${lag.first}, which is what good pace looks like on a scorecard. Distance control has been the open fault on feel alone; this is the first evidence either way, and it is pointing the other way.`}${near} Keep tapping the distance in — this row is the measurement the ladder drill has been waiting for.` });
    }
    const tap = P.get('t');
    if(tap && tap.att >= 6 && tap.made < tap.att)
      t.push({ key:'putt-tap', ev:EV, s:'warn', src:`Putting · inside 3 ft`,
        h:`${tap.att - tap.made} missed from inside three feet`,
        b:`${tap.made} of ${tap.att} actually struck${tap.gim ? `, with ${tap.gim} more given` : ''}. At this range a miss is not variance, it is the stroke or the routine — and each one is a whole stroke off the card for a putt you were expected to hole. Worth checking whether these came after a long lag, which would make them a pace problem wearing a short-putt mask.` });
  }

  const blowN = st.mix.double + st.mix.triple;
  const blowShots = st.mix.double * 2 + st.mix.triple * 3;
  const share = st.over > 0 ? blowShots / st.over : 0;
  if(blowN && share >= 0.25) t.push({ key:'doubles', ev:EV, s:'warn', src:'Biggest single lever', h:'Doubles are your gap',
    b:`${blowN} holes of double bogey or worse across ${st.holes} played — that's ${blowShots} strokes, ${Math.round(share*100)}% of everything you've lost to par. Eliminating blow-ups is worth more than any extra birdies: par golf with zero doubles beats birdie golf with four. On a hole that starts badly, take the punch-out and the bogey instead of the hero shot.` });
  if(st.opening.n >= 3){
    const avg = st.opening.over / st.opening.n;
    if(avg >= 0.8) t.push({ key:'opening', ev:EV, s:'warn', src:'Cheapest fix on the list', h:'Your opening hole is a leak',
      b:`${st.opening.over > 0 ? '+' : ''}${st.opening.over} across ${st.opening.n} opening holes — ${avg.toFixed(1)} a hole before you've settled. That's a warm-up problem, not a swing problem. Prime the feel before the first tee (slow one-handed reps, then blend to two hands) rather than hunting for it on the 4th.` });
  }
  const p3 = st.byPar[3], p4 = st.byPar[4], p5 = st.byPar[5];
  // A par 3 takes the driver out of your hands, so it should be clearly your best
  // scoring hole. Parity with the par 4s is itself the finding.
  // A handful of par 3s at one course must not outvote a season of them.
  const bp = (latestStats() || {}).avgByPar;
  const bigSampleSaysFine = bp && bp[3] != null && bp[4] != null && (bp[3] - 3) < (bp[4] - 4) * 0.9;
  if(!bigSampleSaysFine && p3.n >= 6 && p4.n >= 6 && (p3.over / p3.n) >= (p4.over / p4.n) * 0.9) t.push({ key:'par-3s', ev:EV, s:'warn', src:'Where it points', h:'Par 3s are no better than your par 4s',
    b:`+${(p3.over/p3.n).toFixed(2)} a hole on par 3s against +${(p4.over/p4.n).toFixed(2)} on par 4s. There's no driver on a par 3 and no second shot to recover with, so it should be comfortably your best hole type — level with the par 4s means the tee shot itself isn't finding greens. That's iron control, not driving. Club to cover the front edge rather than to reach the pin.` });
  if(p5.n >= 4 && p5.red === 0) t.push({ key:'par-5s', ev:EV, s:'mid', src:'Missing offense', h:'No birdies on par 5s',
    b:`${p5.n} par-5 holes played, zero under par. The textbook line is that par 5s are where a mid-handicap makes his money — general advice about mid-handicaps, not something read off your holes; the count above is yours. Decide the lay-up off your wedge ladder so the third shot is a NUMBER you own rather than whatever's left — 60°→80 · 56°→95 · 50°→108 · PW→122.` });
  const w = st.worst[0];
  if(w && (w.over / w.n) >= 1.5) t.push({ key:'worst-hole', ev:EV, s:'warn', src:'One hole', h:`${esc(w.course)} hole ${w.hole} is eating you`,
    b:`+${w.over} across ${w.n} plays on a par ${w.par} — ${(w.over/w.n).toFixed(1)} a go. One hole played a handful of times shouldn't cost this much. Next time you see it, play it as a bogey hole on purpose and take the trouble out of the equation.${
      (w.notes || []).length ? ` You wrote on it: ${w.notes.slice(-2).map(x => `&ldquo;${esc(x.text)}&rdquo; <span class="faint">${fmtDate(x.date)}</span>`).join(' · ')} — that is the part the number can't tell you.` : ''}` });
  const parRate = (st.mix.par + st.mix.birdie + st.mix.eagle) / st.holes;
  if(parRate >= 0.4) t.push({ key:'pars', ev:EV, s:'good', src:'Protect this', h:'You make a lot of pars',
    b:`${Math.round(parRate*100)}% of holes played at par or better. The base game is there — the scoring gap is the tail, not the average.` });
  return t;
}

// LIVE CARDS TAKE PRECEDENCE (standing instruction, Aug 19 2026). Where the rounds Jack
// logged on the course can make a finding on their own, that finding is computed FROM
// THEM — not from them averaged in with cards typed up afterwards — and it replaces the
// all-cards version of the same finding rather than sitting next to it. Where they can't
// yet, the full sample still speaks and the badge says so, so nothing is ever lost by
// preferring the better evidence: the worst case is the answer he had before.
//
// Below the hole findings sit the GHIN summaries, and those stand down entirely on the
// two questions his own holes now answer better.
function scoreTips(st){
  // Two rounds' worth of recorded greens/putts is enough to outrank a pasted average —
  // and MOST OF ONE ROUND is enough when he logged it live, because that card was recorded
  // on the hole with the bag he is playing now, which is more than a season average can
  // claim however many rounds are behind it.
  const t = statTips({ approach: st.green.n >= 36 || st.live.green >= 14,
                       putting: st.putts.holes >= 36 || st.live.putts >= 14 });
  if(!st.holes) return t;
  const all = holeTips(st, 'round');
  // One live round is not a season, but it is enough for the findings whose own gates it
  // clears — and those gates are what stop a thin sample speaking in the first place.
  const lv = st.live.holes >= 18 && st.live.holes < st.holes
    ? holeTips(scoreStats(st.rs.filter(r => r.live)), 'live') : null;
  if(lv){
    const spoken = new Set(lv.map(x => x.key));
    t.push(...lv, ...all.filter(x => !spoken.has(x.key)));
  } else {
    // No separate live read to make — either the live cards are too thin to clear any gate
    // on their own, or they ARE every card, in which case the whole page is live evidence.
    const ev = evOf(st.live.holes, st.holes);
    t.push(...(ev === 'live' ? all.map(x => Object.assign({}, x, { ev })) : all));
  }
  return t.sort((a, b) => EV_RANK[a.ev || 'snapshot'] - EV_RANK[b.ev || 'snapshot']);
}

const missSplit = m => Object.entries(m).sort((x, y) => y[1] - x[1])
  .map(([k, v]) => `${v} ${MISS_LAB[k] || k}`).join(' · ');

// The club tables. These are the sections the live logger exists to fill: they stay
// invisible until a round has actually been logged with the club recorded, and the
// approach table waits for a bigger sample because that row is optional to fill in.
function clubTables(st){
  const tee = [...st.tee.values()].sort((a, b) => b.n - a.n);
  const app = [...st.app.values()].filter(e => e.girN).sort((a, b) => b.n - a.n);
  const appTotal = app.reduce((a, e) => a + e.n, 0);
  const pct = (n, d) => d ? `${Math.round(n / d * 100)}%` : '—';
  return `
  ${tee.length ? `<h2>Off the tee · by club</h2>
  <div class="card">
    <table><tr><th>Club</th><th>Tees</th><th>Found it</th><th>Dead</th><th>OB</th><th>Per hole</th></tr>
      ${tee.map(e => {
        // Par 3s have no fairway to hit, so the green is that tee shot's own result.
        const par3 = !e.fwN && e.girN;
        const n = par3 ? e.girN : e.fwN, hit = par3 ? e.girHit : e.fwHit;
        return `<tr>
        <td class="sm"><b>${esc(clubName(e.key))}</b>${par3 ? '<br><span class="sm faint">par 3s</span>' : ''}
          ${(m => m ? `<br><span class="sm faint">${m}</span>` : '')(missSplit(par3 ? e.girMiss : e.fwMiss))}</td>
        <td>${e.n}</td>
        <td>${n ? `<b>${pct(hit, n)}</b><span class="sm faint"> ${hit}/${n}${par3 ? ' grn' : ''}</span>` : '<span class="faint">—</span>'}</td>
        <td>${e.noshot ? `<b style="color:var(--burg)">${e.noshot}</b><span class="sm faint"> ${pct(e.noshot, e.n)}</span>` : '<span class="faint">—</span>'}</td>
        ${(ob => `<td>${ob ? `<b style="color:var(--burg)">${ob}</b><span class="sm faint"> ${ob * 2} str</span>` : '<span class="faint">—</span>'}</td>`)((e.fwMiss.OB || 0) + (e.girMiss.OB || 0))}
        <td><b style="color:${e.over / e.n >= 1 ? 'var(--burg)' : e.over / e.n <= 0.5 ? 'var(--green)' : 'var(--ink)'}">${e.over > 0 ? '+' : ''}${(e.over / e.n).toFixed(2)}</b></td></tr>`;
      }).join('')}
    </table>
    <p class="sm faint" style="margin-top:8px">"Found it" is fairways for a club hit off a par 4 or 5, and greens for one hit off a par 3 — on a par 3 the tee shot is the approach, so the green is its own result. <b>"Dead"</b> is the holes it left you no play at the green, which convicts a club far better than a fairway percentage: most rough is playable and none of these were. <b>"OB"</b> is out of bounds with that club and what it cost — two strokes each, stroke and distance — because a club that finds the fairway two thirds of the time and goes OB with the rest is not the club the percentage makes it look like. "Per hole" is your score against par on the holes you hit that club — a club that finds more fairways but scores no better is not saving you anything, and that comparison is the whole point of this table.</p>
  </div>` : ''}

  ${appTotal >= 10 ? `<h2>Into the green · by club</h2>
  <div class="card">
    <table><tr><th>Club</th><th>Shots</th><th>Greens</th><th>Misses</th><th>Per hole</th></tr>
      ${app.map(e => `<tr>
        <td class="sm"><b>${esc(clubName(e.key))}</b></td>
        <td>${e.n}</td>
        <td><b>${pct(e.girHit, e.girN)}</b><span class="sm faint"> ${e.girHit}/${e.girN}</span></td>
        <td class="sm">${missSplit(e.girMiss) || '—'}</td>
        <td><b>${e.over > 0 ? '+' : ''}${(e.over / e.n).toFixed(2)}</b></td></tr>`).join('')}
    </table>
    <p class="sm faint" style="margin-top:8px">Approach club is the optional row in the live logger, so this counts only the shots where you tapped it in.</p>
  </div>` : ''}`;
}

// Putting by distance. Two questions share the rows because they share an axis, and they
// are counted over different things on purpose: PUTTS/MADE are individual putts struck
// from that range — a real conversion rate, available because a two-putt hole records one
// putt he missed and one he holed — while 1ST PUTTS/3-PUTTS are holes that STARTED there,
// which is the pace question and is only meaningful about a first putt. Makes falling off
// with distance is true of everyone; where the three-putts start is the whole question.
function puttDistTable(P, note){
  const rows = puttRows(P.dist);
  if(!rows.length) return '';
  const pct = (n, d) => d ? `${Math.round(n / d * 100)}%` : '—';
  return `
  <h2>Putting · by distance</h2>
  <div class="card">
    <table><tr><th>From</th><th>Putts</th><th>Made</th><th>1st putts</th><th>3-putts</th></tr>
      ${rows.map(e => `<tr>
        <td class="sm"><b>${esc(PD[e.k].lab)}</b><span class="sm faint"> ft</span>${
          e.gim ? `<br><span class="sm faint">${e.gim} given</span>` : ''}</td>
        <td>${e.att || '<span class="faint">—</span>'}</td>
        <td>${e.att ? `<b>${pct(e.made, e.att)}</b><span class="sm faint"> ${e.made}/${e.att}</span>`
          : '<span class="faint">—</span>'}</td>
        <td class="sm">${e.first || '<span class="faint">—</span>'}</td>
        <td>${e.three ? `<b style="color:var(--burg)">${e.three}</b><span class="sm faint"> ${pct(e.three, e.first)}</span>` : '<span class="faint">—</span>'}</td></tr>`).join('')}
    </table>
    ${(() => {
      const sh = puttRoll(P.dist, PD_SHORT), lag = puttRoll(P.dist, PD_LAG);
      const bits = [];
      if(sh.att) bits.push(`Inside six feet you have holed <b>${sh.made} of ${sh.att}</b> (${pct(sh.made, sh.att)})`);
      if(lag.first) bits.push(`from past thirteen you have three-putted <b>${lag.three} of ${lag.first}</b> (${pct(lag.three, lag.first)})`);
      return bits.length ? `<p class="sm" style="margin-top:8px">${bits.join(' · ')}. Those are the two questions the putting plans are sliced by — holing the short ones, and leaving the long ones close.</p>` : '';
    })()}
    ${(() => {
      const all = puttRows(P.dist).reduce((a, e) => ({ gim:a.gim + e.gim, lagIn:a.lagIn + e.lagIn }), { gim:0, lagIn:0 });
      const lag = puttRoll(P.dist, PD_LAG);
      if(!all.gim && !all.lagIn) return '';
      return `<p class="sm" style="margin-top:8px">${all.lagIn ? `<b>${all.lagIn} lag${all.lagIn === 1 ? '' : 's'} finished inside gimme range</b>${
        lag.first ? ` — ${pct(all.lagIn, lag.first)} of your putts from past thirteen feet` : ''}. That is the closest thing this card has to a proximity measurement, and it is a straight read on distance control. ` : ''}${
        all.gim ? `<b>${all.gim} first putt${all.gim === 1 ? ' was' : 's were'} given.</b> Those are out of the Made column entirely rather than counted as holed — a putt nobody made you hit is not a putt you made, and the one number this project cannot afford to flatter is the short one.` : ''}</p>`;
    })()}
    <p class="sm faint" style="margin-top:8px">${note || '<b>Putts</b> and <b>Made</b> count individual putts struck from that range — a real conversion rate, because the one you holed and the one you missed are both on the card. <b>1st putts</b> and <b>3-putts</b> count HOLES that started from there, which is the pace question and only makes sense about a first putt.'}</p>
  </div>`;
}

// The quick-entry card. It lives at the BOTTOM of Scores — rounds are the input to this
// page, so the form belongs with them rather than in Coach, which reads them. Shared with
// the empty state, because a page that has no rounds is exactly where the form matters most.
function logRoundCard(){
  return `
  <h2>Log a round · 60 seconds</h2>
  <div class="card">
    <div class="formrow g3">
      <div><label>Score</label><input id="rdScore" inputmode="numeric" placeholder="84"></div>
      <div><label>Putts</label><input id="rdPutts" inputmode="numeric" placeholder="34"></div>
      <div><label>Date</label><input id="rdDate" type="date" value="${today()}"></div>
    </div>
    <label>Course</label>
    <input id="rdCourse" list="courseList" placeholder="Start typing…">
    <datalist id="courseList">${S.courses.map(c=>`<option value="${esc(c.name)}">`).join('')}</datalist>
    <label>What gave you trouble? (tap all that apply)</label>
    <div class="chips" id="troubleChips">
      ${TROUBLES.map(([k,lab])=>`<span class="chip" data-trouble="${k}">${lab}</span>`).join('')}
    </div>
    <label>Anything else</label>
    <textarea id="rdNote" rows="2" placeholder='"Wind got me on the back nine…"'></textarea>
    <div style="margin-top:10px"><button class="btn" data-action="save-round">Save round → Coach updates</button></div>
    <p class="sm faint" style="margin-top:8px">Hole-by-hole detail is what powers everything on this page — send Claude a GHIN round summary and it lands with every hole.</p>
    <div class="linkrow" data-action="live-new" style="border-bottom:none">
      <span class="sm"><b>${S.live ? 'Resume your live round' : 'Or play it live, hole by hole'}</b> — every detail, no typing</span><span class="arr">→</span></div>
  </div>`;
}

function scores(){
  const all = S.rounds.slice().sort((a,b) => (a.date || '').localeCompare(b.date || ''));
  if(!all.length) return `
  <div class="card">
    <h2>No rounds yet</h2>
    <p class="sm">Log one below, or send Claude your GHIN round summaries and they'll land here with the hole-by-hole detail — which is what unlocks the analytics: scoring mix, par-3/4/5 splits, your worst holes, and tips built from your own numbers.</p>
  </div>
  ${logRoundCard()}`;
  const st = scoreStats();
  const tips = scoreTips(st);
  const idx = estIndex();
  const vs = all.map(roundVsPar).filter(v => v != null);
  const best = all.filter(r => roundVsPar(r) != null).sort((a,b) => roundVsPar(a) - roundVsPar(b))[0];
  const pct = n => st.holes ? (n / st.holes * 100) : 0;
  const bar = [['birdie','Birdie or better',st.mix.eagle+st.mix.birdie],['par','Par',st.mix.par],
               ['bogey','Bogey',st.mix.bogey],['double','Double+',st.mix.double+st.mix.triple]];
  return `
  <div class="rowgrid g3">
    <div class="stat"><div class="v">${all.length}</div><div class="l">Rounds</div></div>
    <div class="stat"><div class="v">${st.holes || '—'}</div><div class="l">Holes analysed</div></div>
    <div class="stat"><div class="v">${idx != null ? idx.toFixed(1) : '—'}</div><div class="l">Est. index</div></div>
  </div>

  ${vs.length > 1 ? `<div class="card">
    <div class="charttile"><div class="lab">Score vs par · by round</div>
      <div style="color:var(--gtext)">${spark(all.map(roundVsPar).filter(v => v != null))}</div>
      <div class="sub">${best ? `Best: ${esc(best.course || 'round')} ${best.score} (${roundVsPar(best) > 0 ? '+' : ''}${roundVsPar(best)}) · ${fmtDate(best.date)}` : ''}</div></div>
  </div>` : ''}

  ${st.holes ? `
  <h2>Scoring mix · ${st.holes} holes</h2>
  <div class="card">
    <div class="mixbar">${bar.filter(b => b[2]).map(b => `<span class="${b[0]}" style="width:${pct(b[2])}%"></span>`).join('')}</div>
    <table style="margin-top:10px"><tr><th>Result</th><th>Holes</th><th>Share</th></tr>
      ${bar.map(b => `<tr><td class="sm"><b>${b[1]}</b></td><td>${b[2]}</td><td class="sm">${pct(b[2]).toFixed(0)}%</td></tr>`).join('')}
    </table>
    <p class="sm faint" style="margin-top:8px">Total ${st.over > 0 ? '+' : ''}${st.over} over ${st.holes} holes · ${(st.over/st.holes).toFixed(2)} a hole.</p>
  </div>

  <h2>By par</h2>
  <div class="card">
    <table><tr><th>Par</th><th>Holes</th><th>Over</th><th>Per hole</th><th>Under</th></tr>
      ${[3,4,5].filter(p => st.byPar[p].n).map(p => { const d = st.byPar[p]; return `<tr>
        <td><b>Par ${p}</b></td><td>${d.n}</td><td>${d.over > 0 ? '+' : ''}${d.over}</td>
        <td><b style="color:${d.over/d.n >= 1 ? 'var(--burg)' : d.over/d.n <= 0.5 ? 'var(--green)' : 'var(--ink)'}">${(d.over/d.n).toFixed(2)}</b></td>
        <td class="sm">${d.red || '—'}</td></tr>`; }).join('')}
    </table>
    ${st.opening.n >= 2 ? `<p class="sm" style="margin-top:8px">Opening hole of each round: <b>${st.opening.over > 0 ? '+' : ''}${st.opening.over}</b> across ${st.opening.n} starts · ${(st.opening.over/st.opening.n).toFixed(1)} a hole.</p>` : ''}
  </div>` : `<div class="card"><p class="sm faint">Hole-by-hole detail unlocks the scoring mix, the par splits and the tips. Send Claude your GHIN round summaries and they'll be filled in.</p></div>`}

  ${clubTables(st)}

  ${st.green.n || st.fw.n || st.putts.holes ? `<h2>Where the misses go</h2>
  <div class="card">
    <table><tr><th>Recorded</th><th>Hit</th><th>Rate</th><th>Misses</th></tr>
      ${st.fw.n ? `<tr><td class="sm"><b>Fairways</b></td><td>${st.fw.hit}/${st.fw.n}</td>
        <td><b>${Math.round(st.fw.hit / st.fw.n * 100)}%</b></td>
        <td class="sm">${missSplit(st.fw.miss) || '—'}</td></tr>` : ''}
      ${st.green.n ? `<tr><td class="sm"><b>Greens</b></td><td>${st.green.hit}/${st.green.n}</td>
        <td><b>${Math.round(st.green.hit / st.green.n * 100)}%</b></td>
        <td class="sm">${missSplit(st.green.miss) || '—'}</td></tr>` : ''}
    </table>
    ${st.green.noshot ? `<p class="sm" style="margin-top:8px"><b>${st.green.noshot} of the ${st.green.n - st.green.hit} missed greens were conceded at the tee</b> — no play at the green by the time you reached the ball. They're left out of the miss directions above, because they answer a driving question rather than a club one.</p>` : ''}
    ${st.putts.holes ? `<p class="sm" style="margin-top:8px"><b>Putting</b> — ${st.putts.one} one-putts and ${st.putts.three} three-putts across ${st.putts.holes} recorded holes · ${(st.putts.total / st.putts.holes).toFixed(2)} a hole, ${(st.putts.total / st.putts.holes * 18).toFixed(1)} a round.</p>` : ''}
    <p class="sm faint" style="margin-top:8px">Counted hole by hole from your own cards — not an average computed somewhere else.</p>
  </div>` : ''}

  ${puttDistTable(st.putts)}

  ${st.worst.length ? `<h2>Holes that cost you most</h2>
  <div class="card">
    <table><tr><th>Course</th><th>Hole</th><th>Par</th><th>Plays</th><th>Avg</th></tr>
      ${st.worst.map(w => `<tr><td class="sm">${esc(w.course || '—')}</td><td><b>${w.hole}</b></td><td>${w.par}</td><td>${w.n}</td>
        <td><b style="color:var(--burg)">+${(w.over/w.n).toFixed(1)}</b></td></tr>`).join('')}
    </table>
    <p class="sm faint" style="margin-top:8px">Holes played at least twice, worst average first.</p>
  </div>` : ''}

  ${tips.length ? `<h2>How to improve</h2>
  <div class="card">
    ${tips.map(t => `<div class="tipcard ${t.s === 'good' ? 'green' : ''}">
      <div class="src">${esc(t.src)}${evTag(t.ev)}</div><h4>${t.h}</h4><p class="sm">${t.b}</p></div>`).join('')}
    <p class="sm faint">Strongest evidence first: the rounds you logged live on the course, then the rest of your cards, then the GHIN summaries — and a summary claim stands down entirely once your own holes can answer it. These change as the data does.</p>
  </div>` : ''}

  ${statsCard()}

  <h2>Every round</h2>
  <div class="card">
    <table><tr><th>Date</th><th>Course</th><th>Tees</th><th>Score</th><th>vs par</th><th>Putts</th></tr>
      ${all.slice().reverse().map(r => { const v = roundVsPar(r); return `<tr data-action="open-round" data-i="${S.rounds.indexOf(r)}" style="cursor:pointer">
        <td style="white-space:nowrap">${fmtDate(r.date)} <span class="faint">▸</span></td>
        <td class="sm">${esc(r.course || '—')}${r.nine ? ` <span class="faint">${r.nine === 'F' ? 'front' : 'back'}</span>` : ''}${
          r.live ? ' <span class="ev live">live</span>' : ''}</td>
        <td class="sm">${esc(r.tees || '—')}</td>
        <td><b>${esc(r.score ?? '—')}</b></td>
        <td class="sm">${v == null ? '—' : `<b style="color:${v > 5 ? 'var(--burg)' : v <= 2 ? 'var(--green)' : 'var(--ink)'}">${v > 0 ? '+' : ''}${v}</b>`}</td>
        <td class="sm">${esc(r.putts ?? '—')}</td></tr>`; }).join('')}
    </table>
    <p class="sm faint" style="margin-top:8px">Tap any round for the hole-by-hole card and its own breakdown.${
      st.live.rounds ? ` <b>${st.live.rounds}</b> of these you logged live, hole by hole — ${st.live.holes} of the ${st.holes} holes analysed above. Those are the cards everything here speaks from first.` : ''}${
      all.some(r => r.note) ? ` Latest note: "${esc(all.filter(r=>r.note).slice(-1)[0].note)}"` : ''}</p>
  </div>

  ${(() => {
    // EVERY note he has written, newest first. Until now a note was only visible inside
    // the round card it was written on, which made the one field that records WHY the
    // hardest thing on the page to find. They are quoted, never parsed: free text reaches
    // the app's logic by being handed back where it applies — this list, the finding it
    // belongs to, and the tee box he wrote it on — not by being scanned for keywords,
    // which would be inference wearing a measurement's badge.
    const notes = [];
    S.rounds.forEach((r, i) => (Array.isArray(r.holes) ? r.holes : []).forEach(h => {
      if(h && h.note) notes.push({ r, i, n:h.n, text:h.note });
    }));
    if(!notes.length) return '';
    notes.sort((a, b) => (b.r.date || '').localeCompare(a.r.date || '') || b.i - a.i);
    const show = notes.slice(0, 12);
    return `<h2>What you wrote on the course</h2>
    <div class="card">
      <dl class="holenotes">${show.map(x => `<dt data-action="open-round" data-i="${x.i}" style="cursor:pointer">${esc(x.n)}</dt>
        <dd data-action="open-round" data-i="${x.i}" style="cursor:pointer">${esc(x.text)}
          <span class="sm faint">— ${esc(x.r.course || 'your round')}${x.r.nine ? ` ${x.r.nine === 'F' ? 'front' : 'back'}` : ''} · ${fmtDate(x.r.date)}</span></dd>`).join('')}</dl>
      <p class="sm faint" style="margin-top:8px">${notes.length > show.length ? `The newest ${show.length} of ${notes.length}. ` : ''}Written on the hole itself, while you could still see the shot — the only part of a card that remembers <b>why</b>. Tap one to open its round. Play that hole again and the note comes back to you on the tee.</p>
    </div>` ;
  })()}

  ${logRoundCard()}`;
}

// ----- The prep loop, closed (Aug 20 2026) -----
// A course plan's per-hole notes only ever travelled ONE WAY: onto the tee, through the
// live logger. Nothing ever came back afterwards to ask whether the call was taken or
// whether it worked — which made the per-hole research the single biggest write-only file
// in the app. The record fed the plan (`holeRecord()` prints his history on the hole card);
// the plan never fed the record.
//
// This joins a played card to the plan covering that course, hole by hole: what the plan
// called, what he actually hit, where the ball finished, what it scored.
//
// It counts only STRUCTURED fields — `club` (carry-ladder keys the call names) and
// `avoidDir` (a DIRS code) — and never the prose. The prose is quoted BESIDE the result,
// which needs no interpretation, but "the plan said avoid right" is a claim and a claim
// gets a field. The existing plans prove why: `avoid` reads "*Right*. That is where you
// had no play" on one hole and "The long second" on another, and only one of those two
// words is a direction. Same rule as a hole note — carried, not parsed.
// A plan's authoring date lives in its feed id, same as everywhere else in the app.
const planWritten = b => { const m = /(20\d{2})(\d{2})(\d{2})/.exec((b && b.id) || '');
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null; };
function planHeld(r){
  const plan = liveBriefing(r);
  if(!plan || !Array.isArray(plan.holes) || !plan.holes.length) return null;
  const rows = [];
  (Array.isArray(r.holes) ? r.holes : []).forEach(h => {
    const hn = h && h.s != null && h.par != null ? briefHole(plan, h.n) : null;
    if(!hn) return;
    const warned = DIRS.includes(hn.avoidDir) ? hn.avoidDir : null;
    rows.push({ h, hn, lab: hn.playAs || 'Tee', call: hn.play || hn.note || '',
      // Was the call taken? Answerable only where the plan names the clubs it meant.
      onPlan: Array.isArray(hn.club) && hn.club.length && h.tee ? hn.club.includes(h.tee) : null,
      // Did the warned miss actually happen? Only where the plan names a direction.
      // `avoidOn` scopes the warning to the shot it was about — a tree down the right of
      // the fairway and a bunker short of the green are different warnings, and counting
      // either finish against either warning would inflate the hit rate. Omitted = either.
      warned, hit: !warned ? null
        : hn.avoidOn === 'tee' ? h.fmiss === warned
        : hn.avoidOn === 'green' ? h.gmiss === warned
        : (h.fmiss === warned || h.gmiss === warned),
      d: h.s - h.par });
  });
  if(!rows.length) return null;
  const took = rows.filter(x => x.onPlan !== null), warn = rows.filter(x => x.warned);
  const onN = took.filter(x => x.onPlan).length;
  const sum = { n:rows.length, took:took.length, onN,
    onOver: took.filter(x => x.onPlan).reduce((a, x) => a + x.d, 0),
    offOver: took.filter(x => !x.onPlan).reduce((a, x) => a + x.d, 0),
    warn:warn.length, warnHit: warn.filter(x => x.hit).length,
    over: rows.reduce((a, x) => a + x.d, 0) };
  // A plan only TESTS a round it predates. The Sterling Farms plan was written the same
  // day off this very card — it describes the round, it did not predict it, and calling
  // that "the plan held up" would be marking my own homework. The block says which it is.
  const w = planWritten(plan);
  return { plan, rows, sum, retro: !w || !r.date || w >= r.date, written:w };
}

// ----- Single round deep dive -----
// Rounds arrive with wildly different detail. The early cards are par-and-score only;
// the Aug 12 card is the first carrying a putt count, a green result and a tee result
// on every hole. Everything below is computed from whatever a round actually has, and
// each block hides itself when the data behind it isn't there — so a 60-second logged
// round still opens, it just shows less.
// `OB` is deliberately in here alongside the directions even though it is not one: it is
// where the ball FINISHED, which is what this map is for, and it renders in the miss
// splits and on the card exactly like the rest. What it is not is a dispersion reading —
// every place that asks "which way does the miss go" filters it out through DIRS below,
// because "40% of your misses go OB" answers a penalty question, not an aim one.
const MISS_LAB = { S:'short', L:'left', R:'right', Lg:'long', OB:'OB', X:'other' };
const MISS_KEY = { S:'short', L:'left', R:'right', Lg:'long' };  // → the stats-baseline field
// The finishes that are a direction. Sorting a miss map for a pattern goes through this.
const DIRS = ['S', 'L', 'R', 'Lg', 'X'];
const topDir = m => Object.entries(m).filter(([k]) => DIRS.includes(k)).sort((x, y) => y[1] - x[1])[0];
// OB is stroke and distance: the penalty plus replaying the shot. Two strokes every time,
// before he has a ball in play — which is why it gets counted rather than filed as a bad
// drive, and why nothing here reads it as a direction.

// One first putt's worth of record. `one` is a hole where that putt went in, `three` a
// hole it took three or more from there — which is the pace fault stated as a number for
// the first time, because it now carries the distance it happened FROM.
// One distance's record. Two different questions live in one row and they are counted
// separately on purpose:
//   `att` / `made`  — PUTTS struck from this range and how many went in. A real make rate,
//                     because both a miss and a make from the same range are recorded.
//   `first` / `three` — HOLES whose first putt started here, and how many took three. That
//                     is the pace column, and it only makes sense against the first putt.
const puttCell = () => ({ att:0, made:0, first:0, one:0, three:0, gim:0, lagIn:0 });
function bagPutt(map, h){
  const get = k => { let e = map.get(k); if(!e){ e = puttCell(); e.k = k; map.set(k, e); } return e; };
  puttAttempts(h).forEach(a => { const e = get(a.k); e.att++; if(a.made) e.made++; });
  const f = puttFirstK(h);
  if(f){
    const e = get(f);
    e.first++;
    if(h.putts <= 1) e.one++; else if(h.putts >= 3) e.three++;
    // Given from here: on a one-putt hole a make he never hit, on a longer one a lag that
    // finished inside the circle. Opposite meanings, so they are never added together.
    if(conceded(h)) e.gim++;
    if(lagGiven(h)) e.lagIn++;
  }
}
// In table order rather than in the order they turned up, because these are a ladder.
const puttRows = map => PUTT_DIST.map(d => map.get(d.k)).filter(Boolean);
// Roll a set of buckets into one line: makes, holes, three-putts.
const puttRoll = (map, keys) => keys.reduce((a, k) => {
  const e = map.get(k);
  if(e) Object.keys(a).forEach(f => { a[f] += e[f]; });
  return a;
}, puttCell());

// One shot's worth of club record, shared by the per-round card and the season roll-up so
// the two can never disagree about what a club did. `over` is strokes against par on the
// holes that club was hit — a fairway finder that scores no better is worth knowing about.
//
// A club only gets credited with the results it actually produced: the fairway belongs to
// the tee shot, and the green belongs to whatever hit at it — which is the approach club,
// except on a par 3, where the tee shot IS the approach. Crediting a driver with the green
// its 7-iron hit would make every tee-club number meaningless.
function bagShot(map, key, h, d, own){
  let e = map.get(key);
  if(!e){ e = { key, n:0, over:0, fwN:0, fwHit:0, fwMiss:{}, girN:0, girHit:0, girMiss:{}, noshot:0 }; map.set(key, e); }
  e.n++;
  if(d != null) e.over += d;
  if(own.fw && h.fw != null){
    e.fwN++;
    if(h.fw) e.fwHit++; else { const k = h.fmiss || 'X'; e.fwMiss[k] = (e.fwMiss[k] || 0) + 1; }
  }
  if(own.green && h.gir != null){
    e.girN++;
    if(h.gir) e.girHit++; else { const k = h.gmiss || 'X'; e.girMiss[k] = (e.girMiss[k] || 0) + 1; }
  }
  // Leaving no play at the green is the tee shot's doing, so it lands on the tee club —
  // and it convicts a club far better than a fairway percentage does, because plenty of
  // rough is perfectly playable and none of this is.
  if(own.tee && h.noshot) e.noshot++;
  return e;
}
const TEE_OWNS = h => ({ fw:true, green: h.par === 3, tee:true });
const APP_OWNS = { fw:false, green:true, tee:false };

function roundAnalysis(r){
  const H = (Array.isArray(r.holes) ? r.holes : []).filter(h => h && h.par != null && h.s != null);
  const a = { holes:H, par:roundPar(r), score:r.score ?? null, vs:roundVsPar(r),
    mix:{ eagle:0, birdie:0, par:0, bogey:0, double:0, triple:0 },
    byPar:{ 3:{n:0,over:0}, 4:{n:0,over:0}, 5:{n:0,over:0} },
    putts:{ n:0, total:0, one:0, two:0, three:0, girN:0, girTot:0, offN:0, offTot:0, threes:[],
      dist:new Map(), distN:0 },
    gir:{ n:0, hit:0, miss:{}, noshot:0, noshotHoles:[] }, fw:{ n:0, hit:0, miss:{} },
    tee:new Map(), app:new Map(),
    scramble:{ chances:0, saved:0 }, blowups:[], nines:[] };
  H.forEach(h => {
    const d = h.s - h.par;
    if(d <= -2) a.mix.eagle++; else if(d === -1) a.mix.birdie++; else if(d === 0) a.mix.par++;
    else if(d === 1) a.mix.bogey++; else if(d === 2) a.mix.double++; else a.mix.triple++;
    if(a.byPar[h.par]){ a.byPar[h.par].n++; a.byPar[h.par].over += d; }
    if(d >= 2) a.blowups.push(h);
    if(h.putts != null){
      a.putts.n++; a.putts.total += h.putts;
      if(h.putts <= 1) a.putts.one++; else if(h.putts === 2) a.putts.two++;
      else { a.putts.three++; a.putts.threes.push(h); }
      if(h.gir === true){ a.putts.girN++; a.putts.girTot += h.putts; }
      else if(h.gir === false){ a.putts.offN++; a.putts.offTot += h.putts; }
      if(puttFirstK(h) || puttMadeK(h)){ bagPutt(a.putts.dist, h); a.putts.distN++; }
    }
    if(h.gir != null){
      a.gir.n++;
      if(h.gir) a.gir.hit++;
      else {
        // Two different faults wear the same result. A green missed from a playable
        // position asks a club question; a green the tee shot already took away asks a
        // driving one. Only the first belongs in the miss-direction read — but BOTH stay
        // in gir.n, because a miss is a miss and the flag explains it, it doesn't erase it.
        if(h.noshot){ a.gir.noshot++; a.gir.noshotHoles.push(h.n); }
        else { const k = h.gmiss || 'X'; a.gir.miss[k] = (a.gir.miss[k] || 0) + 1; }
        // A missed green is an up-and-down chance however you got there, so every miss
        // counts here: you scramble from where the ball is, not from where you meant to be.
        a.scramble.chances++; if(d <= 0) a.scramble.saved++;
      }
    }
    if(h.fw != null){
      a.fw.n++;
      if(h.fw) a.fw.hit++;
      else { const k = h.fmiss || 'X'; a.fw.miss[k] = (a.fw.miss[k] || 0) + 1; }
    }
    if(h.tee) bagShot(a.tee, h.tee, h, d, TEE_OWNS(h));
    if(h.app) bagShot(a.app, h.app, h, d, APP_OWNS);
  });
  if(!a.putts.n && r.putts != null) a.putts.total = r.putts;   // round-level count only
  if(H.length > 9) [['Out',0,9],['In',9,18]].forEach(([lab,s,e]) => {
    const seg = H.slice(s,e); if(!seg.length) return;
    a.nines.push({ lab, par:seg.reduce((x,h)=>x+h.par,0), score:seg.reduce((x,h)=>x+h.s,0),
      putts: seg.every(h => h.putts != null) ? seg.reduce((x,h)=>x+h.putts,0) : null,
      gir: seg.filter(h => h.gir === true).length,
      girN: seg.filter(h => h.gir != null).length,
      fw: seg.filter(h => h.fw === true).length,
      fwN: seg.filter(h => h.fw != null).length });
  });
  a.blowups.sort((x,y) => (y.s - y.par) - (x.s - x.par));
  return a;
}

// Round-scoped coaching. Same rule as the season tips: every card carries the number
// that triggered it, and nothing fires without enough data behind it to mean something.
function roundTips(r, a){
  const t = [];
  const g = latestStats() || {};
  const pct = (n, d) => d ? Math.round(n / d * 100) : null;
  const missed = a.gir.n - a.gir.hit;

  // Only greens you had a real play at can answer a club question.
  const real = missed - a.gir.noshot;
  if(a.gir.noshot >= 2)
    t.push({ s:'warn', src:'Off the tee → approach', h:`${a.gir.noshot} green${a.gir.noshot === 1 ? '' : 's'} the drive took away`,
      b:`Hole${a.gir.noshot === 1 ? '' : 's'} ${a.gir.noshotHoles.join(', ')} — no realistic play at the green once you got to the ball. These are NOT approach misses, whatever the shot that followed them looked like: the stroke was lost at the tee and only showed up one shot later. They stay out of the miss-direction read below${real ? `, which is computed over the ${real} green${real === 1 ? '' : 's'} you did have a shot at` : ''}. If this keeps recurring, the fix is a club off the tee that leaves you playing, not a different number into the green.` });

  const gm = topDir(a.gir.miss);
  if(gm && real >= 4 && gm[1] / real >= 0.4 && gm[1] >= 3){
    const [dir, n] = gm;
    const base = g.approach && MISS_KEY[dir] ? g.approach[MISS_KEY[dir]] : null;
    const holes = a.holes.filter(h => h.gir === false && !h.noshot && (h.gmiss || 'X') === dir).map(h => h.n).join(', ');
    t.push({ s:'warn', src:'Approach', h:`${n} of your ${real} playable green misses went ${MISS_LAB[dir] || dir}`,
      b: `Holes ${holes}.${base != null ? ` Your tracked average is ${base}% ${MISS_LAB[dir]}, so this is the pattern rather than a bad day.` : ''} ${
        dir === 'S' ? 'Short is the one miss that can never finish close — it is where the bunkers and the false fronts live. Club to cover the BACK of the green: take the number to the flag, add the flag-to-back yardage, and pick the club that carries the middle of that window. And stop clubbing off your best strike — the ladder numbers are carries, and a three-quarter strike out of rough is 8–10 short of them.'
        : dir === 'Lg' ? 'Long is usually a club-selection overcorrection or an adrenaline strike. Note whether these were the holes you had a good drive on.'
        : 'A one-sided miss on this many greens is a face-and-path pattern, not bad luck. It is a swing item — take it to the Swing lab rather than to club selection.' }` });
  }

  const obHoles = a.holes.filter(h => h.fmiss === 'OB' || h.gmiss === 'OB');
  if(obHoles.length)
    t.push({ s:'warn', src:`Out of bounds · ${obHoles.length} shot${obHoles.length === 1 ? '' : 's'}`,
      h:`${obHoles.length * 2} strokes of penalty on hole${obHoles.length === 1 ? '' : 's'} ${obHoles.map(h => h.n).join(', ')}`,
      b:`Stroke and distance: the penalty plus replaying the shot. ${obHoles.length * 2} strokes${a.vs != null ? ` of the ${a.vs > 0 ? '+' : ''}${a.vs} you finished on` : ''}, and none of them a golf shot. These sit inside the miss counts above as ordinary misses, which understates them — read this line first.` });

  const fm = topDir(a.fw.miss);
  const fwMissed = a.fw.n - a.fw.hit;
  if(fm && fwMissed >= 4 && fm[1] / fwMissed >= 0.5 && fm[1] >= 3)
    t.push({ s:'warn', src:'Off the tee', h:`${fm[1]} of your ${fwMissed} tee misses went ${MISS_LAB[fm[0]] || fm[0]}`,
      b:`${a.fw.hit} of ${a.fw.n} fairways${g.driving && g.driving.fairway != null ? ` against a tracked ${g.driving.fairway}%` : ''}. A miss that repeats to one side is a start-line pattern you can aim around for a round and fix in practice — set the tee shot up to bring the ${MISS_LAB[fm[0]] === 'left' ? 'left' : 'right'} side into play and let the miss finish in the short grass.` });

  // Two clubs off the tee on the same card is a controlled comparison: same day, same
  // wind, same swing. It only speaks when both got a real run at it.
  const teeRun = [...a.tee.values()].filter(e => e.fwN >= 3).sort((x, y) => y.fwHit / y.fwN - x.fwHit / x.fwN);
  if(teeRun.length >= 2){
    const best = teeRun[0], worst = teeRun[teeRun.length - 1];
    const rate = e => Math.round(e.fwHit / e.fwN * 100);
    if(rate(best) - rate(worst) >= 25)
      t.push({ s:'mid', src:'Off the tee · this card', h:`${clubName(best.key)} found ${best.fwHit}/${best.fwN} fairways · ${clubName(worst.key)} ${worst.fwHit}/${worst.fwN}`,
        b:`On the same day, in the same wind. ${clubName(worst.key)} holes played to ${worst.over > 0 ? '+' : ''}${(worst.over / worst.n).toFixed(1)} a hole against ${best.over > 0 ? '+' : ''}${(best.over / best.n).toFixed(1)} with the ${clubName(best.key)}${
          worst.over / worst.n > best.over / best.n ? ' — so the extra length bought nothing here' : ' — so the misses cost less than the position gained, which is the case FOR keeping it in hand'}. One round is one round; the season table on Scores is where this either holds up or dissolves.` });
  }

  if(a.putts.three >= 2)
    t.push({ s:'warn', src:'Putting · pace', h:`${a.putts.three} three-putts — ${a.putts.three} strokes`,
      b:`Holes ${a.putts.threes.map(h => h.n + (h.pd ? ` (from ${pdName(h.pd)})` : '')).join(', ')}.${
        a.putts.threes.some(h => h.gir === true) ? ' At least one came from a green hit in regulation, which is a par turned into a bogey by pace alone.' : ''} This is distance control, the open fault, and it is what the 30-ft ladder exists to measure.${
        a.putts.threes.every(h => h.pd) ? ` The distances are the useful part: a three-putt from long range is pace, and one from inside twelve feet is two bad putts in a row.` : ' A round gives you the total; without the first-putt distance it cannot say whether that was pace or stroke.'}` });

  if(a.putts.girN >= 3 && a.putts.offN >= 3){
    const on = a.putts.girTot / a.putts.girN, off = a.putts.offTot / a.putts.offN;
    t.push({ s: on > 2.05 ? 'warn' : 'good', src:'Putting · split', h:`${on.toFixed(2)} putts on greens hit · ${off.toFixed(2)} on greens missed`,
      b:`${on > 2.05 ? `Over two putts a green when you hit it in regulation is the putter, not the short game — ${a.putts.girN} greens hit and you did not convert one of them into a one-putt beyond the birdie.`
        : `At or under two putts a green when you hit it, which is where it should be.`} Off the green, ${off.toFixed(2)} means your chips are finishing at two-putt range rather than tap-in range — every tenth you take off that number is a shot a round.` });
  }

  if(a.putts.n >= 9){
    const onePc = pct(a.putts.one, a.putts.n), base = g.putting && g.putting.one;
    t.push({ s: a.putts.one <= 1 ? 'mid' : 'good', src:'Putting · conversion', h:`${a.putts.one} one-putt${a.putts.one === 1 ? '' : 's'} in ${a.putts.n} holes`,
      b:`${onePc}% of holes${base != null ? ` against a tracked ${base}%` : ''}. ${a.putts.one <= 1
        ? `Holing out is where the strokes are: two-putting everything from everywhere still costs you the round. If the come-backers are going in but nothing from range is, that is a pace-and-read problem, not a stroke problem — and it matches "not dropping the 10–20 footers".`
        : `Converting at this rate is what keeps a scrambling round respectable.`}` });
  }

  if(a.scramble.chances >= 6){
    const sp = pct(a.scramble.saved, a.scramble.chances);
    const base = g.upDownsPerRound != null && g.gir != null
      ? Math.round(g.upDownsPerRound / (18 * (1 - g.gir / 100)) * 100) : null;
    t.push({ s: sp >= 30 ? 'good' : 'warn', src:'Scrambling', h:`${a.scramble.saved} of ${a.scramble.chances} greens missed and still saved · ${sp}%`,
      b:`With ${a.gir.hit} greens hit, the short game played ${a.scramble.chances} holes of this round${base != null ? `. Your tracked rate is about ${base}%` : ''}. At this green rate, up-and-down percentage moves your score more than ball-striking does — it is the cheapest thing on the list to practise.` });
  }

  if(a.nines.length === 2){
    const [o, i] = a.nines, d = (i.score - i.par) - (o.score - o.par);
    if(Math.abs(d) >= 4) t.push({ s:'mid', src:'Shape of the round', h:`The ${d > 0 ? 'back' : 'front'} nine cost you ${Math.abs(d)} more`,
      b:`Out ${o.score} (${o.score - o.par > 0 ? '+' : ''}${o.score - o.par}) · In ${i.score} (${i.score - i.par > 0 ? '+' : ''}${i.score - i.par}). A gap this size inside one round is usually fitness, focus or a swing thought that drifted — not a different golfer. Worth noting what changed at the turn.` });
  }

  if(a.blowups.length){
    const cost = a.blowups.reduce((x,h) => x + (h.s - h.par - 1), 0);
    t.push({ s:'warn', src:'Biggest single lever', h:`${a.blowups.length} hole${a.blowups.length === 1 ? '' : 's'} of double or worse · ${cost} stroke${cost === 1 ? '' : 's'} over bogey`,
      b:`${a.blowups.map(h => `hole ${h.n} (par ${h.par}, ${h.s})${h.note ? ` — &ldquo;${esc(h.note)}&rdquo;` : ''}`).join(' · ')}. Turning each of these into a bogey is ${cost} shots without hitting one better shot. On a hole that starts badly, take the punch-out.` });
  }

  // Stroke index tiers. A card where the easy holes cost as much as the hard ones is
  // a scoring problem rather than a ball-striking one — the course offered and you passed.
  if(a.holes.length >= 18 && a.holes.every(h => h.si)){
    const tier = lo => a.holes.filter(h => h.si >= lo && h.si <= lo + 5)
      .reduce((x,h) => x + (h.s - h.par), 0);
    const hard = tier(1), mid = tier(7), easy = tier(13);
    t.push({ s: easy >= hard ? 'warn' : 'mid', src:'By stroke index',
      h:`Hardest six +${hard} · middle six +${mid} · easiest six +${easy}`,
      b:`${easy >= hard
        ? `The six holes the card says are easiest cost you as much as the six hardest. That is not ball-striking — the hard holes are being played about as well as they can be. It is scoring: the give-away holes are not giving anything back, and those are where a round gets better without a better swing.`
        : `The gradient runs the right way — the easy holes are cheaper than the hard ones, which is what a stroke index is supposed to produce.`} On the six easiest, the plan is a fairway, a middle-of-the-green number and a two-putt; there is nothing to attack.` });
  }

  const good = a.mix.par + a.mix.birdie + a.mix.eagle;
  if(a.holes.length >= 9 && good / a.holes.length >= 0.28)
    t.push({ s:'good', src:'Protect this', h:`${good} holes at par or better`,
      b:`${Math.round(good / a.holes.length * 100)}% of the card${a.mix.birdie + a.mix.eagle ? `, including ${a.mix.birdie + a.mix.eagle} under par` : ''}. The base game showed up — the gap in this round is the tail, not the average.` });

  const order = { warn:0, mid:1, good:2 };
  return t.sort((x,y) => order[x.s] - order[y.s]);
}

// This round's rates against whatever tracked baseline exists, so a number has
// something to be good or bad against.
function roundVsBaseline(a){
  const g = latestStats();
  if(!g) return '';
  const pct = (n, d) => d ? n / d * 100 : null;
  const rows = [
    ['Greens in reg.', a.gir.n ? pct(a.gir.hit, a.gir.n) : null, g.gir, 'up'],
    ['Fairways hit', a.fw.n ? pct(a.fw.hit, a.fw.n) : null, g.driving && g.driving.fairway, 'up'],
    ['Putts', a.putts.total || null, g.putts, 'down'],
    ['One-putts', a.putts.n ? pct(a.putts.one, a.putts.n) : null, g.putting && g.putting.one, 'up'],
    ['Three-putts', a.putts.n ? pct(a.putts.three, a.putts.n) : null, g.putting && g.putting.three, 'down'],
    ['Par or better', a.holes.length ? pct(a.mix.par + a.mix.birdie + a.mix.eagle, a.holes.length) : null, parOrBetter(g), 'up'],
    ['Double or worse', a.holes.length ? pct(a.mix.double + a.mix.triple, a.holes.length) : null, blowUps(g), 'down'],
  ].filter(r => r[1] != null && r[2] != null);
  if(rows.length < 3) return '';
  const fmt = (k, v) => k === 'Putts' ? (+v).toFixed(v % 1 ? 1 : 0) : `${(+v).toFixed(0)}%`;
  return `
  <h2>This round vs your baseline</h2>
  <div class="card">
    <table><tr><th>Metric</th><th>This round</th><th>${esc(g.label || 'Tracked')}</th><th>Δ</th></tr>
      ${rows.map(([k, now, was, dir]) => {
        const d = now - was, better = dir === 'up' ? d > 0 : d < 0;
        return `<tr><td class="sm"><b>${k}</b></td><td><b>${fmt(k, now)}</b></td>
          <td class="sm faint">${fmt(k, was)}</td>
          <td class="sm"><b style="color:${Math.abs(d) < 0.5 ? 'var(--faint)' : better ? 'var(--green)' : 'var(--burg)'}">${
            Math.abs(d) < 0.5 ? '—' : `${d > 0 ? '+' : ''}${d.toFixed(Math.abs(d) < 10 ? 1 : 0)}`}</b></td></tr>`;
      }).join('')}
    </table>
    <p class="sm faint" style="margin-top:8px">One round against ${g.roundsScoring || g.rounds || 'the'} tracked rounds — read the direction, not the decimals.</p>
  </div>`;
}

// ----- The round card, drawn as a card (Aug 27 2026, Jack's redesign) -----
// Everything below this line is PRESENTATION over `roundAnalysis()` — it counts nothing of
// its own, on purpose. Two numbers disagreeing about the same round would be worse than no
// numbers, so a new block here is always a reader over `a`, never a fourth place that walks
// the hole array. Same rule `gameAreas()` follows on Coach.

// Scorecard convention, and the only place in the app that draws it: circle under par,
// square over, doubled for two or more either way. `mark()` inside roundView() draws the
// same four states for the detail table — one vocabulary, two sizes.
const SC_MARK = h => { const d = h.s - h.par;
  return d <= -2 ? 'eag' : d === -1 ? 'bird' : d === 0 ? 'par' : d === 1 ? 'bog' : 'dbl'; };

// One nine, as a scorecard: five rows sharing one set of column widths, so HOLE, PAR, SI,
// SCORE and PUTTS line up under each other the way they do on paper. Each row hides itself
// when the card never carried it — a score-only round still draws, it just draws less.
function cardBlock(hs, lab){
  const anySI = hs.some(h => h.si != null), anyPutt = hs.some(h => h.putts != null);
  const allPutt = hs.every(h => h.putts != null);
  const cells = (cls, f) => hs.map(h => `<div class="scc ${cls}">${esc(f(h))}</div>`).join('');
  const tot = f => hs.reduce((x, h) => x + (f(h) || 0), 0);
  return `<div class="scblk">
    <div class="scr"><div class="sck">HOLE</div>${cells('n', h => h.n ?? '')}<div class="sct lab">${esc(lab)}</div></div>
    <div class="scr"><div class="sck">PAR</div>${cells('p', h => h.par)}<div class="sct">${tot(h => h.par)}</div></div>
    ${anySI ? `<div class="scr"><div class="sck">SI</div>${cells('si', h => h.si ?? '')}<div class="sct"></div></div>` : ''}
    <div class="scr"><div class="sck">SCORE</div>${hs.map(h =>
      `<div class="scc"><span class="scm ${SC_MARK(h)}">${h.s}</span></div>`).join('')}<div class="sct big">${tot(h => h.s)}</div></div>
    ${anyPutt ? `<div class="scr"><div class="sck">PUTTS</div>${cells('pu', h => h.putts ?? '')}<div class="sct">${
      allPutt ? tot(h => h.putts) : ''}</div></div>` : ''}
  </div>`;
}
// The round in eighteen bars. They grow from a FIXED 48px track rather than being scaled
// to fill one, so every bar on the card shares a baseline and the score row underneath
// reads as a row — the whole point of the graphic is the shape of the round at a glance.
function roundBars(a){
  if(!a.holes.length) return '';
  const max = Math.max(...a.holes.map(h => h.s));
  return `<div class="rdbars">${a.holes.map(h => `<div class="rdb">
    <div class="n">${h.n ?? ''}</div>
    <div class="tr"><i class="${SC_MARK(h)}" style="height:${Math.max(8, Math.round(h.s / max * 100))}%"></i></div>
    <div class="s">${h.s}</div></div>`).join('')}</div>`;
}
// Where the greens went, as a picture. DIRECTIONS ONLY — `topDir()`'s rule, drawn: OB is
// where a ball finished but it is not a way to miss, so it is priced in the caption in
// strokes instead of taking a cell, and a green the drive already took away is counted
// beside the map rather than inside it, because it asks a driving question and not a club
// one. Both of those are the same distinctions the round's own findings draw.
function missMap(a){
  if(!a.gir.n) return '';
  const m = a.gir.miss, at = k => m[k] || 0;
  const peak = Math.max(1, ...DIRS.map(at));
  const lvl = v => !v ? 0 : v >= peak ? 3 : v >= peak / 2 ? 2 : 1;
  const cell = k => !k ? '<div class="mmc off"></div>'
    : k === 'H' ? `<div class="mmc hit"><b>${a.gir.hit}</b><i>hit</i></div>`
    : `<div class="mmc l${lvl(at(k))}"><b>${at(k) || '·'}</b><i>${esc(MISS_LAB[k])}</i></div>`;
  const ob = (a.holes.filter(h => h.gmiss === 'OB').length);
  const foot = [`Centre is a green hit`,
    a.gir.noshot ? `${a.gir.noshot} the drive left no play at` : '',
    ob ? `${ob} out of bounds · ${ob * 2} strokes` : '',
    at('X') ? `${at('X')} recorded without a direction` : ''].filter(Boolean).join(' · ');
  return `<div class="card mmap">
    <div class="rdl">Miss map</div>
    <div class="mmg">${['', 'Lg', '', 'L', 'H', 'R', '', 'S', ''].map(cell).join('')}</div>
    <p class="rdf">${esc(foot)}. Directions only — out of bounds is a price, not a way to miss.</p>
  </div>`;
}
// The distances he actually holed from, which is the question "how many putts" cannot ask.
// Reads `puttAttempts()`'s made column through the same map the by-distance table uses, so
// the two can never disagree; the longest one is called out because it is the ceiling of
// the day and a single number he will remember.
function madeFrom(P){
  const rows = puttRows(P.dist);
  const made = rows.filter(e => e.made);
  if(!made.length) return '';
  const peak = Math.max(...made.map(e => e.made));
  const longest = made[made.length - 1];
  return `<div class="card mfrom">
    <div class="rdl">Putts made from</div>
    <div class="mfl">${made.map(e => `<div class="mfr">
      <span class="d">${esc(PD[e.k].lab)}′</span>
      <span class="b"><i style="width:${Math.round(e.made / peak * 100)}%"></i></span>
      <span class="n">${e.made}</span></div>`).join('')}</div>
    <p class="rdf">Longest holed · ${esc(PD[longest.k].lab)} ft${
      longest.k === PUTT_DIST[PUTT_DIST.length - 1].k ? '' : ` · nothing dropped beyond it`}.</p>
  </div>`;
}
// By club, on this card alone. "In play" is fairways for a club hit off a par 4 or 5 and
// greens for one hit off a par 3 — on a par 3 the tee shot IS the approach — which is the
// same split `clubTables()` makes for the season, computed off the same `bagShot()` record.
function roundClubs(a){
  const tee = [...a.tee.values()].sort((x, y) => y.n - x.n);
  const app = [...a.app.values()].filter(e => e.girN).sort((x, y) => y.n - x.n);
  if(!tee.length && !app.length) return '';
  const pct = (n, d) => d ? `${Math.round(n / d * 100)}%` : '—';
  const row = (e, kind) => {
    const par3 = kind === 'tee' && !e.fwN && e.girN;
    const n = kind === 'app' || par3 ? e.girN : e.fwN;
    const hit = kind === 'app' || par3 ? e.girHit : e.fwHit;
    const miss = kind === 'app' || par3 ? e.girMiss : e.fwMiss;
    const top = topDir(miss);
    const bad = [e.noshot ? `${e.noshot} dead` : '',
      (miss.OB || 0) ? `${miss.OB} OB` : ''].filter(Boolean).join(' · ');
    return `<div class="rcr">
      <span class="c">${esc(clubName(e.key))}${par3 ? '<i> par 3s</i>' : ''}</span>
      <span class="n">${e.n}</span>
      <span class="p">${n ? `${pct(hit, n)} <i>${hit}/${n}</i>` : '—'}</span>
      <span class="t">${top ? `${top[1]} ${esc(MISS_LAB[top[0]] || top[0])}` : '—'}${
        bad ? ` <b>${esc(bad)}</b>` : ''}</span></div>`;
  };
  return `${tee.length ? `<div class="rchead"><span class="c">Off the tee</span><span class="n">shots</span>
      <span class="p">in play</span><span class="t">tendency</span></div>
    ${tee.map(e => row(e, 'tee')).join('')}` : ''}
  ${app.length ? `<div class="rchead" style="margin-top:10px"><span class="c">Into the green</span><span class="n">shots</span>
      <span class="p">greens</span><span class="t">tendency</span></div>
    ${app.map(e => row(e, 'app')).join('')}` : ''}
  <p class="rdf">"In play" is the fairway for a club hit off a par 4 or 5 and the green for one
    hit off a par 3. <b>Dead</b> is a tee shot that left no play at the green; <b>OB</b> is two
    strokes each. This card only — the season version is on Cards.</p>`;
}

function roundView(i){
  const r = S.rounds[+i];
  if(!r) return scores();
  const a = roundAnalysis(r);
  const tips = roundTips(r, a);
  const played = S.courses.find(c => (c.name || '').toLowerCase() === (r.course || '').toLowerCase());
  // Traditional card markers: circle under par, square over.
  const mark = h => {
    const d = h.s - h.par;
    const cls = d <= -2 ? 'eag' : d === -1 ? 'bird' : d === 0 ? 'par' : d === 1 ? 'bog' : 'dbl';
    return `<span class="mark ${cls}">${h.s}</span>`;
  };
  // The club sits under the result, so one column answers both "what did you hit" and
  // "where did it finish" without a sixth column on a phone-width card.
  const res = (v, missKey, club, noshot) => {
    const out = v === true ? '<span class="res ok">✓</span>'
      // On a conceded green the direction is beside the point — the headline fact about
      // the hole is that the tee shot ended it.
      : v === false ? `<span class="res no${noshot ? ' ns' : ''}">${noshot ? 'no shot' : (MISS_LAB[missKey] || '✗')}</span>`
      : '<span class="faint">·</span>';
    return club ? `${out}<span class="cl">${esc(clubTag(club))}</span>` : out;
  };
  const subRow = n => `<tr class="sub"><td>${n.lab}</td><td>${n.par}</td><td>${n.score}</td>
    <td>${n.putts ?? ''}</td><td>${n.girN ? n.gir : ''}</td><td>${n.fwN ? n.fw : ''}</td></tr>`;
  const rows = [];
  a.holes.forEach((h, idx) => {
    rows.push(`<tr><td><b>${h.n ?? idx + 1}</b>${h.si ? `<span class="si"> ${h.si}</span>` : ''}${
      h.note ? '<span class="nmark" title="You left a note on this hole">✎</span>' : ''}</td>
      <td class="sm">${h.par}</td><td>${mark(h)}</td>
      ${(() => {
        const m = puttMadeK(h), f = puttFirstK(h);
        // Made from, and where it started when that is a different putt.
        const tag = [m && PD[m] ? `${PD[m].lab}′` : (h.gimme ? 'given' : ''),
          f && f !== m && PD[f] ? `from ${PD[f].lab}′` : ''].filter(Boolean).join(' · ');
        return `<td class="sm">${h.putts ?? '·'}${tag ? `<span class="cl">${esc(tag)}</span>` : ''}</td>`;
      })()}
      <td>${res(h.gir, h.gmiss, h.par === 3 ? null : h.app, h.noshot)}</td>
      <td>${res(h.fw, h.fmiss, h.tee)}</td></tr>`);
    if(a.nines.length === 2 && idx === 8) rows.push(subRow(a.nines[0]));
  });
  if(a.nines.length === 2) rows.push(subRow(a.nines[1]));
  const bar = [['birdie','Birdie or better',a.mix.eagle+a.mix.birdie],['par','Par',a.mix.par],
               ['bogey','Bogey',a.mix.bogey],['double','Double+',a.mix.double+a.mix.triple]];
  // The score and its to-par are the headline in the header, so the strip carries the four
  // things underneath them — and only the ones this card actually recorded.
  const tiles = [['Putts', a.putts.total || '—']];
  if(a.gir.n) tiles.push(['Greens', `${a.gir.hit}/${a.gir.n}`]);
  if(a.fw.n) tiles.push(['Fairways', `${a.fw.hit}/${a.fw.n}`]);
  if(a.scramble.chances) tiles.push(['Up & down', `${a.scramble.saved}/${a.scramble.chances}`]);
  if(tiles.length < 4) tiles.push(['Holes', a.holes.length || '—']);
  if(tiles.length < 4) tiles.unshift(['vs par', a.vs == null ? '—' : `${a.vs > 0 ? '+' : ''}${a.vs}`]);
  // The tees are named on the scorecard header only where the card actually carries them —
  // a round logged without them gets no invented set, same rule as the rating and slope.
  const pub = publishedCard(r.course, r.nine);
  const ev = r.live ? 'live' : 'round';
  return `
  <button class="backlink" data-action="go" data-view="rounds" data-seg="cards">← Rounds</button>
  <div class="card rdhead">
    <div class="rdtop">
      <div class="rdid">
        <div class="rdd">${esc(fmtDate(r.date))}${r.tees ? ` · ${esc(r.tees)}` : ''}${
          r.nine ? ` · ${r.nine === 'F' ? 'front' : 'back'} nine` : ''}</div>
        <h2>${esc(r.course || 'Round')}</h2>
        <div class="sm faint">${a.par != null ? `par ${a.par}` : ''}${
          r.rating != null && r.slope ? ` · ${r.rating}/${r.slope}` : ''}${
          r.live ? ' · <span class="ev live">you logged this live</span>' : ''}</div>
      </div>
      <div class="rdsc">${esc(a.score ?? '—')}<i>${a.vs == null ? '' : `${a.vs > 0 ? '+' : ''}${a.vs}`}</i></div>
    </div>
    ${roundBars(a)}
    <div class="rdstats">
      ${tiles.slice(0, 4).map(([l, v]) => `<div class="rds"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('')}
    </div>
    ${r.note ? `<p class="sm" style="margin-top:8px">"${esc(r.note)}"</p>` : ''}
    ${r.troubles && r.troubles.length ? `<div class="chips">${r.troubles.map(k => {
      const lab = (TROUBLES.find(t => t[0] === k) || [null, k])[1];
      return `<span class="chip static on">${esc(lab)}</span>`; }).join('')}</div>` : ''}
    ${played ? `<div class="linkrow" data-action="edit-course" data-id="${played.id}">
      <span class="sm"><b>${played.rating ? `You rated this course ${played.rating}/10` : 'Rate this course'}</b></span><span class="arr">→</span></div>` : ''}
  </div>

  ${a.holes.length ? `
  <div class="card">
    ${fold(`rd-card-${i}`, 'Full scorecard',
      `${r.tees ? `${String(r.tees).toUpperCase()} TEES · ` : ''}TAP TO COLLAPSE`,
      `${(a.holes.length > 9
          ? [cardBlock(a.holes.slice(0, 9), 'OUT'), cardBlock(a.holes.slice(9), 'IN')]
          : [cardBlock(a.holes, 'TOT')]).join('')}
      <div class="sclegend">
        <span><i class="scm bird"></i>Birdie</span><span><i class="scm eag"></i>Eagle</span>
        <span><i class="scm bog"></i>Bogey</span><span><i class="scm dbl"></i>Double +</span>
      </div>
      <p class="rdf">${a.holes.some(h => h.si != null)
        ? `SI is the stroke index recorded on this card.${pub ? ` The published card on file for this course is ${esc(pub.src)}.` : ''}`
        : `No stroke index on this card, so that row is left off rather than filled in.`}</p>`)}
    ${fold(`rd-holes-${i}`, 'Hole by hole', 'GREEN · TEE · CLUB', `
      <table class="scard">
        <tr><th>Hole</th><th>Par</th><th>Score</th><th>Putts</th><th>Green</th><th>Tee</th></tr>
        ${rows.join('')}
      </table>
      <p class="rdf">Small grey number is the stroke index.
      ${a.putts.distN ? 'Under the putt count is how long the putt you holed was, and where the first one started when that was a different putt.' : ''}
      ${a.gir.n ? 'Green and Tee show where the shot finished, where it was recorded; a dot means it was not. <b>OB</b> is out of bounds — two strokes each.' : ''}
      ${a.tee.size ? 'The club under each result is what you hit.' : ''}
      ${a.holes.some(h => h.note) ? '✎ marks a hole you wrote a note on — they are below.' : ''}</p>`, false)}
  </div>

  ${(notes => notes.length ? `<div class="card notecard">
    ${fold(`rd-note-${i}`, 'What you wrote on the course',
      `${notes.length} HOLE${notes.length === 1 ? '' : 'S'}`,
      `<dl class="holenotes big">${notes.map(h => `<dt>${h.n}</dt><dd>${esc(h.note)}</dd>`).join('')}</dl>
      <p class="rdf">Logged on the hole itself, while you could still see the shot. This is the only
      part of the card that remembers WHY — everything else records what.
      <b>Delivered back, not counted. No finding derives from this.</b></p>`)}
  </div>` : '')(a.holes.filter(h => h.note))}

  ${(P => !P ? '' : `<h2>How the plan held up</h2>
  <div class="card">
    <p class="sm">${P.retro
      ? `The <b>${esc(P.plan.course || 'course')}</b> plan was written ${P.written ? `on ${fmtDate(P.written)}, ` : ''}from this round among others — so this is what it was built ON, not a test of it. It becomes a test the next time you play here.`
      : `The <b>${esc(P.plan.course || 'course')}</b> plan${P.written ? ` (written ${fmtDate(P.written)})` : ''} covered <b>${P.sum.n}</b> of these holes${P.sum.n ? `, and they played ${P.sum.over > 0 ? '+' : ''}${P.sum.over}` : ''}.`}</p>
    ${P.sum.took || P.sum.warn ? `<ul class="hi-why" style="margin-top:6px">
      ${P.sum.took ? `<li><b>You took the call on ${P.sum.onN} of ${P.sum.took}</b> holes where the plan named a club${
        P.sum.onN && P.sum.took - P.sum.onN ? ` — those played ${P.sum.onOver > 0 ? '+' : ''}${(P.sum.onOver / P.sum.onN).toFixed(2)} a hole against ${P.sum.offOver > 0 ? '+' : ''}${(P.sum.offOver / (P.sum.took - P.sum.onN)).toFixed(2)} on the ones you didn't` : ''}.</li>` : ''}
      ${P.sum.warn ? `<li><b>The warned miss happened on ${P.sum.warnHit} of ${P.sum.warn}</b> holes where the plan named a direction to avoid.</li>` : ''}
    </ul>` : ''}
    <table class="scard" style="margin-top:8px">
      <tr><th>Hole</th><th>The plan said</th><th>You hit</th><th>Finished</th><th>Score</th></tr>
      ${P.rows.map(x => `<tr>
        <td><b>${x.h.n}</b></td>
        <td class="sm pv-said">${emph(x.call)}${x.hn.avoid ? `<br><span class="faint">Avoid: ${emph(x.hn.avoid)}</span>` : ''}</td>
        <td class="sm">${x.h.tee ? `${esc(clubTag(x.h.tee))}${x.onPlan === true ? ' <b class="pv-ok">✓</b>' : x.onPlan === false ? ' <b class="pv-no">✗</b>' : ''}` : '<span class="faint">—</span>'}</td>
        ${(() => {
          // BOTH finishes, because a warning is about one shot or the other: a tree down
          // the right of the fairway is answered by the tee line, a bunker short of the
          // green by the approach line. Marking only the green lost the tee warnings —
          // including the three holes the drive left him no play on, which are exactly the
          // ones the plan was loudest about.
          const flag = on => x.hit && (x.hn.avoidOn === on
            || (!x.hn.avoidOn && (on === 'tee' ? x.h.fmiss : x.h.gmiss) === x.warned))
            ? ' <b class="pv-no">← warned</b>' : '';
          const t = x.h.fw === true ? 'fairway' : x.h.fw === false ? (MISS_LAB[x.h.fmiss] || 'missed') : null;
          const g = x.h.noshot ? '<b class="pv-no">no play at it</b>'
            : x.h.gir === true ? 'hit' : x.h.gir === false ? (MISS_LAB[x.h.gmiss] || 'missed') : null;
          const lines = [t ? `<span class="faint">tee</span> ${esc(t)}${flag('tee')}` : '',
                         g ? `<span class="faint">green</span> ${g}${flag('green')}` : '']
            .filter(Boolean);
          return `<td class="sm">${lines.length ? lines.join('<br>') : '<span class="faint">—</span>'}</td>`;
        })()}
        <td class="sm"><b>${x.h.s}</b> <span class="faint">${x.d > 0 ? '+' + x.d : x.d === 0 ? 'par' : x.d}</span></td></tr>`).join('')}
    </table>
    <p class="sm faint" style="margin-top:8px">The plan's words are quoted, never scored — only the holes where it named a <b>club</b> or a <b>direction</b> are counted, because those are the parts it stated plainly enough to be wrong about. Everything else here is your card.</p>
  </div>`)(planHeld(r))}

  <h2>Scoring mix</h2>
  <div class="card">
    <div class="mixbar">${bar.filter(b => b[2]).map(b =>
      `<span class="${b[0]}" style="width:${b[2] / a.holes.length * 100}%"></span>`).join('')}</div>
    <table style="margin-top:10px"><tr><th>Result</th><th>Holes</th><th>Share</th></tr>
      ${bar.map(b => `<tr><td class="sm"><b>${b[1]}</b></td><td>${b[2]}</td>
        <td class="sm">${Math.round(b[2] / a.holes.length * 100)}%</td></tr>`).join('')}
    </table>
    ${[3,4,5].some(p => a.byPar[p].n) ? `<table style="margin-top:10px"><tr><th>Par</th><th>Holes</th><th>Over</th><th>Per hole</th></tr>
      ${[3,4,5].filter(p => a.byPar[p].n).map(p => { const d = a.byPar[p]; return `<tr>
        <td><b>Par ${p}</b></td><td>${d.n}</td><td>${d.over > 0 ? '+' : ''}${d.over}</td>
        <td><b style="color:${d.over/d.n >= 1 ? 'var(--burg)' : d.over/d.n <= 0.5 ? 'var(--green)' : 'var(--ink)'}">${(d.over/d.n).toFixed(2)}</b></td></tr>`; }).join('')}
    </table>` : ''}
    ${a.nines.length === 2 ? `<p class="sm" style="margin-top:8px">Out <b>${a.nines[0].score}</b> · In <b>${a.nines[1].score}</b>${
      a.nines[0].putts != null ? ` · putts ${a.nines[0].putts}/${a.nines[1].putts}` : ''}.</p>` : ''}
  </div>` : `<div class="card"><p class="sm faint">No hole-by-hole detail on this round — send Claude the card and it lands here with every hole, which is what fills in everything below.</p></div>`}

  ${a.gir.n || a.fw.n || a.putts.distN ? `
  <h2>Miss map &amp; putting</h2>
  <div class="rdsplit">${missMap(a)}${madeFrom(a.putts)}</div>
  ${puttDistTable(a.putts, 'How long the putt you holed was and where the first one started, tapped in on each hole as you played.')}
  ${(a.gir.n && a.gir.hit < a.gir.n) || (a.fw.n && a.fw.hit < a.fw.n) ? `<div class="card">
    ${a.gir.n ? `<p class="sm"><b>Greens</b> — ${a.gir.hit} of ${a.gir.n} hit${
      a.gir.hit < a.gir.n ? `. Misses: ${missSplit(a.gir.miss) || '—'}${
        a.gir.noshot ? `, plus <b class="warn">${a.gir.noshot} with no shot at it</b> (hole${a.gir.noshot === 1 ? '' : 's'} ${a.gir.noshotHoles.join(', ')})` : ''}.` : '.'}</p>` : ''}
    ${a.fw.n ? `<p class="sm" style="margin-top:6px"><b>Fairways</b> — ${a.fw.hit} of ${a.fw.n} hit${
      a.fw.hit < a.fw.n ? `. Misses: ${missSplit(a.fw.miss)}.` : '.'}</p>` : ''}
    ${a.putts.n ? `<p class="sm" style="margin-top:6px"><b>Putting</b> — ${a.putts.one} one-putt${
      a.putts.one === 1 ? '' : 's'} · ${a.putts.two} two-putts · ${a.putts.three} three-putt${
      a.putts.three === 1 ? '' : 's'} · ${(a.putts.total / a.putts.n).toFixed(2)} a hole.</p>` : ''}
  </div>` : ''}` : ''}

  ${(c => c ? `<div class="card">${fold(`rd-club-${i}`, 'By club', 'SHOTS · IN PLAY · TENDENCY', c)}</div>` : '')(roundClubs(a))}

  ${tips.length ? `<h2>What this round says</h2>
  <div class="card">
    ${tips.map((t, n) => `<div class="tipcard ${t.s === 'good' ? 'green' : ''}${rail(ev)}">
      ${evDrawer(`ev-rd${i}-${n}`, t.src, ev,
        `${a.holes.length} hole${a.holes.length === 1 ? '' : 's'} on this card${
          r.course ? ` — ${r.course}` : ''}${r.date ? `, ${fmtDate(r.date)}` : ''}`)}
      <div class="tipn">${a.holes.length} hole${a.holes.length === 1 ? '' : 's'} on this card</div>
      <h4>${t.h}</h4>${expandable(t.b)}</div>`).join('')}
    <p class="sm faint">Computed from this card alone — every line carries the number that
      triggered it, and the badge says what that card is worth as evidence.</p>
  </div>` : ''}

  ${roundVsBaseline(a)}`;
}

// ---------- Live round: log it on the course, hole by hole ----------
// Thumbs only, between shots: every control is a chip, nothing needs the keyboard, and
// S.live is written to localStorage on EVERY tap because iOS kills suspended PWAs without
// warning. A round in progress is losable only by an explicit discard.
//
// The output is an ordinary round object — the documented hole schema plus `tee`/`app` —
// so the moment it saves, roundView, the season analytics and the coaching all read it
// with no glue at all.

// The most recent cards played here, folded into a par/SI layout keyed by hole number so
// a repeat course needs no typing. Newest card wins per hole; older ones fill anything it
// didn't cover, which is how two nines played on different days add up to a full 18.
// Rating/slope only carry from a card covering the SAME number of holes — a nine-hole
// rating on an eighteen-hole round would poison the handicap differential.
// Newest card first, and on the same date the one he logged live wins. Two cards can
// describe one round — one he tapped in on the course, one fed in afterwards — and the
// pars, stroke indexes and tee clubs the logger prefills from should come off the card he
// was standing on the hole for.
const newestLiveFirst = (a, b) =>
  (b.date || '').localeCompare(a.date || '') || ((b.live ? 1 : 0) - (a.live ? 1 : 0));

function priorLayout(course, nine){
  const key = (course || '').trim().toLowerCase();
  if(!key) return null;
  const cards = S.rounds.filter(r => (r.course || '').trim().toLowerCase() === key
      && Array.isArray(r.holes) && r.holes.some(h => h && h.par))
    .sort(newestLiveFirst);
  if(!cards.length) return null;
  const by = new Map();
  cards.slice().reverse().forEach(r => r.holes.forEach((h, i) => {
    if(!h || !h.par) return;
    by.set(h.n ?? (r.nine === 'B' ? i + 10 : i + 1), { par:h.par, si:h.si ?? null });
  }));
  const want = nine ? 9 : 18;
  const exact = cards.find(r => r.holes.length === want && (!nine || (r.nine || 'F') === nine));
  return { by, from:cards[0].date, tees:cards[0].tees || '',
    rating: exact ? (exact.rating ?? null) : null,
    slope: exact ? (exact.slope ?? null) : null };
}
// ---- Published scorecards ----
// The layout question has three possible answers and they are NOT equally good, so the
// app keeps them apart and says which one it used. Jack's own card at that course is the
// strongest — he stood on the hole and wrote the par down. A published scorecard is next:
// sourced, but somebody else's transcription, and courses get renovated. A guess is last
// and is the one that caused this: eighteen par 4s that LOOKED like a prefilled card.
// Same evidence ranking the rest of the app runs on, applied to course knowledge.
function publishedCard(course, nine){
  const key = (course || '').trim().toLowerCase();
  if(!key) return null;
  const hit = c => (c.course || c.n || '').trim().toLowerCase() === key
    && (!c.nine || !nine || c.nine === nine);
  // Feed first: a `layout` entry is how a card gets corrected without a build, so it has
  // to outrank the file it is correcting.
  const fed = (S.layouts || []).filter(hit).pop();
  const base = typeof COURSE_CARDS_OK !== 'undefined' ? COURSE_CARDS_OK.find(hit) : null;
  const c = fed || base;
  if(!c || !Array.isArray(c.par)) return null;
  // A 9-long card fills the nine it names; an 18-long one is read straight.
  const first = c.par.length === 9 ? (c.nine === 'B' ? 10 : 1) : 1;
  const by = new Map();
  c.par.forEach((p, i) => by.set(first + i, { par:p, si: c.si ? c.si[i] : null }));
  // `ver` separates a card somebody READ from one assembled out of published data that
  // reconciles. Both beat a guess; only one is a transcription, and the card-check screen
  // says which — see the header of course-cards.js.
  return { by, src: c.src || 'a published scorecard', fed: !!fed, ver: c.ver || 'reconciled' };
}

function coursesWithLayout(){
  const seen = new Map();
  S.rounds.forEach(r => {
    if(!r.course || !Array.isArray(r.holes) || !r.holes.some(h => h && h.par)) return;
    seen.set(r.course, Math.max(seen.get(r.course) || 0, r.holes.length));
  });
  (S.layouts || []).forEach(c => c.course && seen.set(c.course, 18));
  if(typeof COURSE_CARDS_OK !== 'undefined') COURSE_CARDS_OK.forEach(c => seen.set(c.n, 18));
  return [...seen.keys()];
}

// ----- Round prep, on the hole you're standing on -----
// A briefing is worth most with a club in your hand, not the night before, so the live
// logger carries it onto the course: the one-line focus and the "read nothing else" rules
// on every hole, plus whatever the plan says about THIS hole.
// Briefing course names sometimes carry an event suffix ("Beekman Golf Course — Scramble")
// while the round gets logged under the plain name, so the match tolerates that.
function courseMatches(a, b){
  const base = s => (s || '').trim().toLowerCase().replace(/\s+[—–]\s+.*$/, '');
  return (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase() || base(a) === base(b);
}
// ----- How far away a course is -----
// Course locations arrive by feed (`geo` entries), same as scorecards do, and for the same
// reason: a coordinate is a researched fact about the world, so it carries where it came
// from and how precise it is rather than being guessed at in the app.
function courseGeo(name){
  return (S.geo || []).find(g => g.course && courseMatches(g.course, name)) || null;
}
// Great-circle miles. This is the distance a crow flies, NOT a drive time — an hour up the
// Merritt and an hour out to the Cape are not the same hour, and nothing here pretends
// otherwise. It is enough to order a list, which is all it is asked to do.
function milesBetween(a, b){
  const R = 3958.8, rad = d => d * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat/2)**2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon/2)**2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
// null means "cannot say" — no fix, or no location on file for that course. Every caller
// has to handle it, because a course with no coordinate must never sort as if it were at
// the centre of the earth.
function courseMiles(name){
  const g = courseGeo(name);
  if(!g || !S.here) return null;
  return milesBetween(S.here, g);
}
const milesLab = m => m == null ? '' : m < 10 ? `${m.toFixed(1)} mi` : `${Math.round(m)} mi`;
// A coordinate that is really the town's, not the club's, is worth a mile or two of error
// and the label says so — a "≈" is the difference between a measurement and a placement.
function courseMilesLab(name){
  const m = courseMiles(name);
  if(m == null) return '';
  const g = courseGeo(name);
  return (g && g.prec && g.prec !== 'exact' ? '≈ ' : '') + milesLab(m);
}

function liveBriefing(L){
  const all = S.briefings.filter(b => b.course && courseMatches(b.course, L.course));
  if(!all.length) return null;
  const dated = all.filter(b => b.date).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return dated.find(b => b.date === L.date) || dated[0] || all.find(b => !b.date) || null;
}
// A hole note is a DECISION plus its reasons: `play` is the one line to act on, `why[]`
// the bullets under it. Prose `note` still renders, so older plans don't break.
function briefHole(b, n){
  const h = b && Array.isArray(b.holes) ? b.holes.find(x => x && x.n === n) : null;
  return h && (h.play || h.note || (h.why || []).length) ? h : null;
}
// Emphasis inside a note: *like this*. Applied AFTER escaping, so nothing in the source
// can inject markup — only the asterisk pairs the author actually wrote become tags.
const emph = s => esc(s).replace(/\*([^*]+)\*/g, '<b>$1</b>');
// What his own card says about this hole — course knowledge he generated himself, and
// the only kind available at a course nobody has written a briefing for.
function holeRecord(course, n){
  const key = (course || '').trim().toLowerCase();
  const plays = [];
  S.rounds.forEach(r => {
    if((r.course || '').trim().toLowerCase() !== key || !Array.isArray(r.holes)) return;
    const h = r.holes.find(x => x && x.n === n && x.s != null && x.par != null);
    if(h) plays.push({ d:h.s - h.par, s:h.s, tee:h.tee, note:h.note, date:r.date });
  });
  if(!plays.length) return null;
  const over = plays.reduce((a, p) => a + p.d, 0);
  const clubs = [...new Set(plays.map(p => p.tee).filter(Boolean))];
  // WHAT HE WROTE, HANDED BACK ON THE HOLE HE WROTE IT ABOUT. A note is free text, so it
  // can never be counted the way a chip can — and it is the only field on a card that
  // records WHY the hole played the way it did. So it is never parsed into a finding;
  // it is returned where it answers something, which is standing on that tee again.
  // Newest first, and only two: this renders on a phone between shots.
  const notes = plays.filter(p => p.note)
    .sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 2);
  return { n:plays.length, over, avg:over / plays.length,
    best:plays.reduce((a, p) => Math.min(a, p.s), Infinity), clubs, notes };
}

// ----- Cutting the tee tap -----
// The club off a given tee is one of the most predictable things in a round: the same
// hole asks the same question every time, and inside one round he tends to keep reaching
// for the same club. So the logger suggests one — but it never pretends the suggestion is
// a record. A suggested chip renders differently from a confirmed one, and the whole
// driver-vs-mini comparison depends on that distinction being real: a blanket "driver"
// default would quietly swallow every hole he actually hit the mini on, which is exactly
// the question the table exists to answer.
function priorTee(course, n){
  const key = (course || '').trim().toLowerCase();
  const cards = S.rounds.filter(r => (r.course || '').trim().toLowerCase() === key && Array.isArray(r.holes))
    .sort(newestLiveFirst);
  for(const r of cards){
    const h = r.holes.find(x => x && x.n === n && x.tee);
    if(h) return h.tee;
  }
  return null;
}
function teeSuggestion(L, h){
  // What he hit off this exact hole here last time — the strongest guess available.
  const prior = priorTee(L.course, h.n);
  if(prior) return prior;
  // A par 3's club is a property of that hole; carrying another hole's club to it is noise.
  if(h.par === 3) return null;
  // Otherwise: whatever he's been hitting off the tee so far this round.
  for(let i = L.cur - 1; i >= 0; i--){
    const x = L.holes[i];
    if(x.par !== 3 && x.tee) return x.tee;
  }
  return null;
}
// Lands when he arrives at a hole, never on a hole he's already had his hands on.
function suggestTee(L){
  const h = L.holes[L.cur];
  if(!h || h.tee || h.teeTouched) return;
  const key = teeSuggestion(L, h);
  const club = key && clubBy(key);
  if(!club) return;
  if(club.wedge && h.par !== 3) return;   // wedges aren't offered off a par 4/5 tee
  h.tee = key; h.teeAuto = true;
}

// Changing a hole's par changes which questions the hole HAS, so it is one function and
// never two: a par 3 has no fairway, no separate approach and always a shot at the green,
// and a tee-club suggestion made for a par 4 is not valid for it.
function setHolePar(L, h, p){
  h.par = p;
  // Touching a par settles it: it is his number now, not a placeholder.
  delete h.parAuto; h.parFrom = 'mine';
  if(h.par === 3){ delete h.fw; delete h.fmiss; delete h.app; delete h.noshot; }
  if(h.teeAuto){ delete h.tee; delete h.teeAuto; suggestTee(L); }
  // The par decides which rows exist, so the open one is re-derived too.
  delete h.qOpen;
}

// The open note lives in the DOM between keystrokes, so anything that leaves the hole
// pulls it back onto the draft first. iOS can kill a suspended PWA mid-sentence.
function syncHoleNote(){
  const L = S.live, box = document.getElementById('lvHoleNote');
  if(!L || !box) return;
  const h = L.holes[L.cur]; if(!h) return;
  const v = box.value.trim();
  if(v) h.note = v; else { delete h.note; delete h.noteOpen; }
}

function liveThru(L){
  const played = L.holes.filter(h => h.s != null);
  return { n:played.length,
    over: played.reduce((a, h) => a + (h.s - h.par), 0),
    score: played.reduce((a, h) => a + h.s, 0),
    putts: played.length && played.every(h => h.putts != null)
      ? played.reduce((a, h) => a + h.putts, 0) : null };
}

// Draft → the documented round shape. Holes with no score never happened: they are
// dropped rather than counted as par, so quitting after twelve logs a twelve-hole card.
function liveRound(L){
  const holes = L.holes.filter(h => h.s != null).map(h => {
    const o = { n:h.n, par:h.par, s:h.s };
    if(h.si != null) o.si = h.si;
    if(h.putts != null) o.putts = h.putts;
    if(h.putts){
      if(h.pm && !h.gimme) o.pm = h.pm;
      if(h.pd && h.putts >= 2) o.pd = h.pd;
      if(h.gimme) o.gimme = true;
    }
    if(h.tee) o.tee = h.tee;
    if(h.gir != null){ o.gir = h.gir; if(h.gir === false && h.gmiss) o.gmiss = h.gmiss; }
    // A par 3 carries no fairway and no separate approach — the tee shot IS the approach.
    if(h.par !== 3){
      if(h.fw != null){ o.fw = h.fw; if(h.fw === false && h.fmiss) o.fmiss = h.fmiss; }
      if(h.app) o.app = h.app;
      if(h.noshot) o.noshot = true;
    }
    // Written on the hole, which is the only place the detail still exists. `noteOpen` is
    // UI state and stays behind on S.live — only the text he typed reaches the card.
    if(h.note) o.note = h.note;
    return o;
  });
  const r = { date:L.date, course:L.course, live:true,
    par: holes.reduce((a, h) => a + h.par, 0),
    score: holes.reduce((a, h) => a + h.s, 0),
    // A partial putt count would read as a real one in the rounds table, so it's all or nothing.
    putts: holes.length && holes.every(h => h.putts != null)
      ? holes.reduce((a, h) => a + h.putts, 0) : null,
    troubles: L.troubles || [], note: L.note || '', holes };
  if(L.tees) r.tees = L.tees;
  if(L.nine && holes.length <= 9) r.nine = L.nine;
  return r;
}

// A handicap differential needs a whole nine or eighteen behind it.
function fullCard(r){ return r.holes.length === 9 || r.holes.length === 18; }

// The finish screen pre-lights these from what the card actually says, rather than asking
// Jack to remember. They drive lesson matching, so they use the TROUBLES keys exactly.
function liveTroubles(a){
  const out = [];
  if(a.putts.three >= 2) out.push('three-putts');
  // One OB is enough to pre-tick the tee: two strokes gone is not a marginal round.
  if((a.fw.n >= 6 && a.fw.hit / a.fw.n < 0.45) || a.gir.noshot >= 2 || (a.fw.miss.OB || 0) >= 1) out.push('off-tee');
  const real = a.gir.n - a.gir.hit - a.gir.noshot;
  if((real >= 4 && (a.gir.miss.S || 0) / real >= 0.4) || (a.gir.miss.OB || 0) >= 1) out.push('approach');
  return out;
}

// (The round-in-progress banner folded into Today's start-round button on Aug 27 2026 —
// one affordance for one intention, and the same one the TEE tab carries.)

function live(){
  const L = S.live;
  if(!L) return liveStart();
  if(L.stage === 'card') return liveCard(L);
  return L.stage === 'finish' ? liveFinish(L) : livePlay(L);
}

// The card check — one screen, before the first tee. It exists because the wrong par is
// not a cosmetic error: it moves every hole's score-vs-par, the birdie/par/bogey chips,
// the scoring mix and the par splits, and nothing downstream can detect it afterwards.
// The total is the detector — a course that should be 71 reading 72 is one glance.
function liveCard(L){
  const tot = L.holes.reduce((a, h) => a + h.par, 0);
  const half = n => L.holes.filter(h => h.n <= 9 === (n === 'out')).reduce((a, h) => a + h.par, 0);
  const guesses = L.holes.filter(h => h.parAuto).length;
  const SRC = {
    mine: { lab:'From your own card', cls:'f-ok',
      b:`Par and stroke index carried over from the round you logged here on ${esc(L.cardFrom)}. You wrote these down standing on the holes, so they are the best record there is — but check the total anyway.` },
    card: { lab:'From the published scorecard', cls:'f-new',
      b:`Par and stroke index read off ${esc(L.cardFrom)}. Sourced, but it is somebody else's transcription and courses get renovated — the total below is the quickest way to catch it.` },
    // Assembled rather than read. It survives the checks a wrong card fails, and that is
    // still not the same as having seen the card, so it says so and asks for a glance.
    soft: { lab:'Pieced together — worth a glance', cls:'f-new',
      b:`No scorecard could be opened for here, so this was assembled from ${esc(L.cardFrom)}. It passes the checks a wrong card would fail — the pars add up to the published total and the stroke indexes run clean — but nobody has read it off the real card. Check it against the one in your hand and fix anything that is off.` },
    guess: { lab:'Not on file — these are guesses', cls:'f-warn',
      b:'No card of yours here and no published scorecard on file, so every hole below is a placeholder par 4. Tap the ones that are wrong. This screen exists because a round logged against eighteen guessed par 4s puts the wrong number on every hole and nothing afterwards can tell.' },
    // A round already under way when this screen shipped has no recorded source.
  }[L.cardSrc] || { lab:'The card as it stands', cls:'f-new',
      b:'This round was already under way, so where its pars came from was never recorded. Check them against the card in your hand — anything you change here applies to the holes you have not played yet as well.' };
  const cell = (h, i) => `<span class="pcell${h.parAuto ? ' guess' : ''}"
    data-action="live-card-par" data-i="${i}"><i>${h.n}</i><b>${h.par}</b></span>`;
  const rows = [];
  for(let i = 0; i < L.holes.length; i += 9)
    rows.push(`<div class="pgrid">${L.holes.slice(i, i + 9)
      .map((h, j) => cell(h, i + j)).join('')}</div>`);

  return `
  <button class="backlink" data-action="live-discard">← Not this course</button>
  <div class="card">
    <h2 style="margin-top:0">Check the card</h2>
    <h3>${esc(L.course)}</h3>
    <p class="sm faint">${fmtDate(L.date)}${L.nine ? ` · ${L.nine === 'F' ? 'front' : 'back'} nine` : ' · full 18'}</p>
    <span class="flag ${SRC.cls || 'f-new'}" style="position:static;display:inline-block;margin-top:8px">${SRC.lab || ''}</span>
    <p class="sm" style="margin-top:8px">${SRC.b || ''}</p>
  </div>

  <div class="card">
    <div class="ptot">
      <div><b>${tot}</b><span>Par</span></div>
      ${L.nine ? '' : `<div><b>${half('out')}</b><span>Out</span></div>
      <div><b>${half('in')}</b><span>In</span></div>`}
      ${guesses ? `<div class="warnbox"><b>${guesses}</b><span>guessed</span></div>` : ''}
    </div>
    ${rows.join('')}
    <p class="sm faint" style="margin-top:10px">Tap any hole to change its par — it cycles 3 · 4 · 5. ${
      guesses ? 'The <b>dashed</b> ones are placeholders nobody has confirmed.' : 'Nothing here is a guess.'}</p>
  </div>

  <button class="btn" style="width:100%;padding:14px" data-action="live-card-play">${
    guesses ? 'Pars are right — play →' : 'Play →'}</button>
  <p class="sm faint" style="margin-top:10px">You can still change a hole's par while you play it — the card is on the hole screen too. This screen is here so a wrong one gets caught on the first tee instead of on the last.</p>`;
}

// ----- The course box offers what he has already prepped -----
// A course with a plan written for it is far and away the likeliest thing he is about to
// tap on the first tee, and the native datalist only opens once you type — which means
// remembering the spelling, one-handed, in the sun. So the box opens its own list.
//
// The name on a plan is not always the name that goes on the card ("Beekman Golf Course —
// Scramble" is a plan for Beekman), and course name is the join key for layouts, the
// worst-holes table and a briefing's history link. So a pick resolves to the spelling
// already on record wherever there is one, and to the plain name otherwise.
function planPlayName(b){
  const raw = (b.course || '').trim();
  const known = [...S.courses.map(c => c.name), ...S.rounds.map(r => r.course)]
    .find(n => n && courseMatches(raw, n));
  return known || raw.replace(/\s+[—–]\s+.*$/, '');
}
// Two groups, in the order a tee box asks for them: what has a plan, then every other
// course on his list. The second group is what stops the list dead-ending — a course with
// no plan must still offer its own spelling rather than falling off the page — and it is
// deliberately NOT called "played before": half of it is courses he has only rated.
function livePicks(){
  const p = coursePlans();
  const seen = new Set();
  const prepped = [];
  const take = (list, tag) => list.forEach(b => {
    const name = planPlayName(b);
    if(!name || seen.has(name.toLowerCase())) return;
    seen.add(name.toLowerCase());
    const holes = (b.holes || []).filter(h => h && (h.play || h.note || (h.why || []).length)).length;
    prepped.push({ name, tag:[tag(b), holes ? `${holes} hole notes` : ''].filter(Boolean).join(' · ') });
  });
  take(p.up, b => fmtDate(b.date));
  take(p.standing, () => 'standing plan');
  take(p.past, b => `played ${fmtDate(b.date)}`);
  const cards = new Set(coursesWithLayout().map(n => n.toLowerCase()));
  const rest = [...S.courses.map(c => c.name), ...S.rounds.map(r => r.course)]
    .filter(Boolean)
    .filter(n => { const k = n.toLowerCase(); if(seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => a.localeCompare(b))
    .map(n => ({ name:n, tag: cards.has(n.toLowerCase()) ? 'card on file' : '' }));
  return { prepped, rest };
}
function livePicker(){
  const g = livePicks();
  if(!g.prepped.length && !g.rest.length) return '';
  const row = c => `<div class="pkrow" data-action="live-pick" data-course="${esc(c.name)}" data-q="${
    esc(c.name.toLowerCase())}"><span class="pkn">${esc(c.name)}</span>${
    c.tag ? `<span class="pkt">${esc(c.tag)}</span>` : ''}</div>`;
  const grp = (title, list) => !list.length ? '' :
    `<div class="pkgrp" data-grp>${title}</div>${list.map(row).join('')}`;
  return `<div class="picker" id="lvPick" hidden>
    ${grp('Prepped — a plan is written', g.prepped)}
    ${grp('Your courses — no plan yet', g.rest)}
    <div class="pkgrp pknone" hidden>Nothing on file by that name — keep typing and it starts a new course.</div>
  </div>`;
}
// Filter as he types, and never leave a group heading standing over nothing.
function pickFilter(q){
  const p = document.getElementById('lvPick'); if(!p) return;
  const s = (q || '').trim().toLowerCase();
  let any = 0;
  p.querySelectorAll('.pkrow').forEach(r => {
    const hit = !s || (r.dataset.q || '').includes(s);
    r.hidden = !hit; if(hit) any++;
  });
  p.querySelectorAll('.pkgrp[data-grp]').forEach(g => {
    let n = 0;
    for(let el = g.nextElementSibling; el && el.classList.contains('pkrow'); el = el.nextElementSibling)
      if(!el.hidden) n++;
    g.hidden = !n;
  });
  const none = p.querySelector('.pknone'); if(none) none.hidden = !!any;
}
function showPicks(on){
  const p = document.getElementById('lvPick'); if(!p) return;
  if(on) pickFilter(document.getElementById('lvCourse')?.value || '');
  p.hidden = !on;
}

function liveStart(){
  const d = today();
  const soon = S.briefings.filter(b => b.date && b.date >= d)
    .sort((a, b) => (a.date || '').localeCompare(b.date || '')).slice(0, 3);
  const known = coursesWithLayout();
  return `
  <button class="backlink" data-action="go" data-view="home">← Home</button>
  <div class="card">
    <h2>Start a live round</h2>
    <p class="sm">One screen per hole — tee club, fairway, green, putts, score. It saves after every tap, so you can lock the phone between shots and pick it up on the next tee. Nothing here needs the keyboard once you've started.</p>
    <label>Course</label>
    <input id="lvCourse" placeholder="Tap for your courses — or type…" autocomplete="off">
    ${livePicker()}
    ${soon.length ? `<div class="chips">${soon.map(b =>
      `<span class="chip" data-action="live-pick" data-course="${esc(planPlayName(b))}">${
        esc(planPlayName(b))} · ${fmtDate(b.date)}</span>`).join('')}</div>` : ''}
    <div class="formrow">
      <div><label>Date</label><input id="lvDate" type="date" value="${d}"></div>
      <div><label>Holes</label><select id="lvNine">
        <option value="">Full 18</option><option value="F">Front 9</option><option value="B">Back 9</option>
      </select></div>
    </div>
    <div style="margin-top:12px"><button class="btn" data-action="live-start">Start the round →</button></div>
    ${known.length ? `<p class="sm faint" style="margin-top:10px">Par and stroke index prefill automatically at ${known.map(esc).join(' · ')} — you've played them with a full card before.</p>` : ''}
  </div>

  <div class="card flat">
    <p class="sm"><b>What it records.</b> Which club you hit off every tee (and optionally into every green), whether you found the fairway and the green and where the miss went, putts, and the score. That's the input side of every number on the Rounds page — and the tee-club table can't exist without it.</p>
  </div>`;
}

// ---- Quick view: the whole hole as one-line rows, the open row full-size ----
// The row order IS the logging order — tee shot through score, note last. A par 3 has no
// fairway and no separate approach, and the putting detail rows follow the total the same
// way the full card gates them: Putt made needs a putt, First putt needs two or more.
// The fairway waits for a tee club (Aug 27 2026): where the ball finished is not a
// question until there is a shot to ask it about. A par 3 has neither a fairway nor a
// separate approach either way — there the tee shot IS the shot at the green.
function qRows(h){
  return ['tee', h.par === 3 || !h.tee ? null : 'fw', h.par === 3 ? null : 'app',
    'green', 'putts',
    h.putts ? 'pm' : null, h.putts >= 2 ? 'pd' : null, 's', 'note'].filter(Boolean);
}
// A carried-over tee suggestion is NOT an answer — the row opens so he confirms it with
// the same tap the full card asks for, just on a bigger chip. Given IS an answer to the
// made-putt row: it either went in from somewhere, or nobody made him hit it.
function qAnswered(h, r){
  if(r === 'tee') return !!h.tee && !h.teeAuto;
  if(r === 'fw') return h.fw != null;
  if(r === 'app') return !!h.app;
  if(r === 'green') return h.gir != null;
  if(r === 'putts') return h.putts != null;
  if(r === 'pm') return !!h.pm || !!h.gimme;
  if(r === 'pd') return !!h.pd;
  if(r === 's') return h.s != null;
  if(r === 'note') return !!h.note;
  return false;
}
// Which row is open. Arriving at a hole derives it — first unanswered, skipping the note
// (a keyboard must never open itself) — and after that his taps own it. `qOpen` is UI
// state on S.live and never reaches the saved card.
function qOpenRow(h){
  if(h.qOpen !== undefined) return h.qOpen;
  return qRows(h).find(r => r !== 'note' && !qAnswered(h, r)) || '';
}
// Answering a row opens the NEXT unanswered one, forward only — auto-advance that jumped
// back up to a row he chose to skip would spend the taps this view exists to save.
function qAdvance(h, from){
  const rows = qRows(h);
  h.qOpen = rows.slice(rows.indexOf(from) + 1).find(r => r !== 'note' && !qAnswered(h, r)) || '';
}

// Which hole the screen last drew, and which of its sections were on it. Pure UI state,
// and deliberately module-scoped rather than parked on S.live: nothing about an animation
// belongs in the round, and this way it cannot reach the saved card even by accident.
let lvHoleSeen = null, lvSeen = new Set();

function livePlay(L){
  const h = L.holes[L.cur];
  const t = liveThru(L);
  const par3 = h.par === 3;
  const clubs = bagClubs();
  // Nobody tees off a par 4 with a 56°, but a short par 3 is exactly a wedge — so the
  // tee row carries the whole bag only where that's a real shot.
  const teeClubs = par3 ? clubs : clubs.filter(c => !c.wedge);
  // A chip is 44px tall whatever is in it, and lights in ONE of two accents: green for a
  // neutral or good outcome, burgundy for the ones that cost strokes — OB, a penalty, a
  // green the drive took away, a conceded putt and every miss direction. `bad` is the class
  // that says which, so the colour is a property of the answer rather than of the row.
  const chip = (k, v, lab, on, cls) =>
    `<span class="chip big${cls ? ' ' + cls : ''}${on ? ' on' : ''}" data-action="live-set" data-k="${k}" data-v="${esc(v)}">${lab}</span>`;
  const clubRow = (k, list, cols) => `<div class="lvgrid g${cols}">${list.map(c => {
    const on = h[k] === c.key;
    const auto = on && k === 'tee' && h.teeAuto;
    return `<span class="chip big${on ? (auto ? ' on auto' : ' on') : ''}" data-action="live-set" data-k="${k}" data-v="${c.key}">${esc(c.abbr)}</span>`;
  }).join('')}</div>`;

  const SC = { '-1':'Birdie', 0:'Par', 1:'Bogey', 2:'Double', 3:'Triple' };
  const scores = [-1, 0, 1, 2, 3].map(d => {
    const v = h.par + d;
    return `<span class="chip big sc${h.s === v ? ' on' : ''}" data-action="live-set" data-k="s" data-v="${v}">
      <b>${v}</b><i>${SC[d]}</i></span>`;
  }).join('');
  const outlier = h.s != null && (h.s < h.par - 1 || h.s > h.par + 3)
    ? `<span class="chip big sc on" data-action="live-set" data-k="s" data-v="${h.s}"><b>${h.s}</b><i>${h.s - h.par > 0 ? '+' + (h.s - h.par) : h.s - h.par}</i></span>` : '';

  const last = L.cur === L.holes.length - 1;

  // One body per row, shared verbatim by both layouts — same chips, same data-actions,
  // so the full card and quick view can never drift apart on what a tap records.
  const bodies = {
    tee: clubRow('tee', teeClubs, 4),
    fw: `<div class="lvgrid g5">
      ${chip('fw', 'hit', 'Hit', h.fw === true)}
      ${chip('fw', 'L', 'Left', h.fw === false && h.fmiss === 'L', 'bad')}
      ${chip('fw', 'R', 'Right', h.fw === false && h.fmiss === 'R', 'bad')}
      ${chip('fw', 'X', 'Other', h.fw === false && !h.fmiss, 'bad')}
      ${chip('fw', 'OB', 'OB', h.fw === false && h.fmiss === 'OB', 'ob')}</div>`,
    app: clubRow('app', clubs, 5),
    green: `<div class="lvgrid g3">
      ${chip('green', 'hit', 'Hit', h.gir === true)}
      ${chip('green', 'S', 'Short', h.gir === false && h.gmiss === 'S', 'bad')}
      ${chip('green', 'L', 'Left', h.gir === false && h.gmiss === 'L', 'bad')}
      ${chip('green', 'R', 'Right', h.gir === false && h.gmiss === 'R', 'bad')}
      ${chip('green', 'Lg', 'Long', h.gir === false && h.gmiss === 'Lg', 'bad')}
      ${chip('green', 'OB', 'OB', h.gir === false && h.gmiss === 'OB', 'ob')}</div>${
      // Separate toggle, not a sixth direction: a short one you had no play at is both
      // short AND conceded, and only the second fact tells you which club to blame.
      par3 ? '' : `<div class="lvgrid g1"><span class="chip big ns${h.noshot ? ' on' : ''}"
        data-action="live-set" data-k="noshot" data-v="1">No shot at it</span></div>`}`,
    putts: `<div class="lvgrid g6">${[0,1,2,3,4,5].map(p =>
      chip('putts', p, p === 5 ? '5+' : p, h.putts === p)).join('')}</div>`,
    pm: `<div class="lvgrid g6">${PUTT_DIST.map(d =>
      chip('pm', d.k, d.lab, h.pm === d.k && !h.gimme)).join('')}
      ${chip('gimme', '1', 'Given', !!h.gimme, 'ns span')}</div>`,
    pd: `<div class="lvgrid g6">${PUTT_DIST.map(d =>
      chip('pd', d.k, d.lab, h.pd === d.k)).join('')}</div>`,
    s: `<div class="lvgrid g5">${scores}</div>
      <div class="lvgrid g3 lvsub">${outlier}
      <span class="chip big" data-action="live-bump" data-d="1">+1</span>
      <span class="chip big" data-action="live-bump" data-d="-1">−1</span></div>`,
    // The one thing on this screen that wants a keyboard, and the only field that records
    // WHY. Carried, never parsed — nothing in the app reads it, and the header says so.
    note: (h.note || h.noteOpen)
      ? `<textarea id="lvHoleNote" class="lvnote" rows="2"
          placeholder="Quoted back to you on this hole. Nothing reads it.">${esc(h.note || '')}</textarea>`
      : `<div class="lvgrid g1"><span class="chip big note" data-action="live-note">＋ Add a note</span></div>`,
  };

  const quick = !!S.settings.liveQuick;
  const scName = d => ({ '-2':'Eagle', '-1':'Birdie', 0:'Par', 1:'Bogey', 2:'Double', 3:'Triple' })[d]
    || (d > 0 ? '+' + d : String(d));
  const dirLab = m => m === 'OB' ? 'OB'
    : (MISS_LAB[m] ? MISS_LAB[m][0].toUpperCase() + MISS_LAB[m].slice(1) : m);
  // The value column: what the row already says, so a shut row still reads. Null = blank.
  const qVal = r => {
    if(r === 'tee') return h.tee ? { txt: esc(clubTag(h.tee)), carry: !!h.teeAuto } : null;
    if(r === 'fw') return h.fw == null ? null
      : { txt: h.fw ? 'Hit' : (h.fmiss ? dirLab(h.fmiss) : 'Other') };
    if(r === 'app') return h.app ? { txt: esc(clubTag(h.app)) } : null;
    if(r === 'green') return h.gir == null ? null
      : { txt: (h.gir ? 'Hit' : (h.gmiss ? dirLab(h.gmiss) : 'Miss')) + (h.noshot ? ' · no shot' : '') };
    if(r === 'putts') return h.putts == null ? null : { txt: String(h.putts) };
    if(r === 'pm') return h.gimme ? { txt: 'given' }
      : (h.pm ? { txt: PD[h.pm].lab + ' ft' } : null);
    if(r === 'pd') return h.pd ? { txt: PD[h.pd].lab + ' ft' } : null;
    if(r === 's') return h.s == null ? null : { txt: h.s + ' · ' + scName(h.s - h.par) };
    if(r === 'note') return h.note ? { txt: '✎' } : null;
    return null;
  };
  // One label and one hint per row, shared by both layouts — a row can't be called two
  // things on two screens. On a par 3 the tee shot IS the approach, so the green section
  // says so rather than sitting there looking like a second shot he never hit.
  const QLAB = { tee:'Tee club', fw:'Fairway', app:'Club in',
    green: par3 ? 'Green · from the tee' : 'Green',
    putts:'Putts', pm:'Putt made', pd:'First putt', s:'Score', note:'Note' };
  const QHINT = { tee: h.teeAuto ? `LAST TIME: ${clubName(h.tee)}` : '',
    fw:'OB is two strokes — tap it and the app counts them', app:'optional',
    green: par3 ? '' : 'the drive left you nothing', putts:'the total',
    pm:'feet — how long the one you holed was', pd:'feet — where you started from',
    note:'CARRIED · NEVER PARSED' };
  const open = qOpenRow(h);
  const quickCard = `<div class="card lvcard qcard">
    ${qRows(h).map(r => {
      const v = qVal(r), on = open === r;
      return `<div class="qrow${on ? ' open' : ''}">
        <div class="qhead" data-action="live-qrow" data-r="${r}">
          <span class="qlab">${QLAB[r]}</span>
          <span class="qval${v ? (v.carry ? ' carry' : '') : ' none'}">${v ? v.txt : '—'}</span>
        </div>
        ${on ? `<div class="qbody">${QHINT[r] ? `<div class="qhint">${QHINT[r]}</div>` : ''}${bodies[r]}</div>` : ''}
      </div>`;
    }).join('')}
  </div>`;

  // ---- Progressive disclosure: a section exists only once it CAN be answered ----
  // Most of this the logger already did (a par 3 has no fairway and no separate approach;
  // the made-putt row needs a putt and the first-putt row needs two). The one addition is
  // the fairway, which now waits for a tee club: "where did that go" is not a question
  // until there is a shot to ask it about, and the tee section carries the line that says
  // so, so the row can never look like something the app forgot to show.
  const secs = qRows(h).map(k => ({ k, lab:QLAB[k], hint:QHINT[k], body:bodies[k] }));
  // Only sections that have JUST appeared animate. Which ones were on screen last draw is
  // a property of the screen and not of the round, so it is a module variable — it never
  // touches S.live and so can never reach the saved card. Arriving at a hole resets it:
  // there the whole hole slides in and animating nine sections on top of that would be a
  // fairground, not a reveal.
  const arrived = lvHoleSeen !== L.cur;
  if(arrived){ lvHoleSeen = L.cur; lvSeen = new Set(secs.map(s => s.k)); }
  secs.forEach(s => { if(!lvSeen.has(s.k)){ s.rev = true; lvSeen.add(s.k); } });
  const section = s => `<section class="card lvsec${s.rev ? ' rev' : ''}" data-sec="${s.k}">
    <div class="lvsl">${esc(s.lab)}${s.hint
      ? `<span${s.k === 'tee' && h.teeAuto ? ' class="lit"' : ''}>${esc(s.hint)}</span>` : ''}</div>
    ${s.body}${s.k === 'tee' && !par3 && !h.tee
      ? '<p class="lvwait">Pick the club and the fairway opens underneath.</p>' : ''}
  </section>`;
  const fullCard = secs.map(section).join('');

  // The hole's prep is built here and rendered BELOW the scoring card (Jack's call,
  // Aug 20): on the hole he wants the next-hole button and the chips at the top of
  // the screen and the plan underneath them. It still opens on arrival at every hole
  // and still leads with the one line to act on — only its position changed.
  const prep = (() => {
    const hn = briefHole(liveBriefing(L), h.n);
    const rec = holeRecord(L.course, h.n);
    if(!hn && !rec) return '';
    // One phrasing for both slots: the header already says whose record it is, so the
    // line never has to repeat "here" after a label that just said it.
    const line = !rec ? '' : (rec.n === 1
      ? `<b>${rec.best}</b> (${rec.over > 0 ? '+' : ''}${rec.over}) · 1 play`
      : `<b>${rec.n} plays</b> · ${rec.avg > 0 ? '+' : ''}${rec.avg.toFixed(1)} a hole · best ${rec.best}`)
      + (rec.clubs.length === 1 ? ` · ${esc(clubName(rec.clubs[0]))} off the tee` : '');
    const eating = rec && rec.n >= 2 && rec.avg >= 1.5;
    const why = hn && Array.isArray(hn.why) ? hn.why : [];
    // With a plan, the record is a quiet footer. Without one it IS the content, so it
    // becomes the bullets rather than a footnote to nothing.
    const head = ['Hole ' + h.n]
      .concat(hn && hn.yds ? [hn.yds + ' yds'] : [])
      .concat(hn ? ['from your prep'] : ['your record']);
    // STARTS COLLAPSED (Jack's call, Aug 20) and opens with one tap. That only works
    // because shut is not empty: the header keeps the ONE line to act on, so the default
    // state still delivers the decision and it is the reasoning behind it that costs a tap.
    // Per hole, and deliberately not sticky — the next hole has its own plan.
    // `intelOpen` is UI state on S.live and never reaches the saved card.
    const shut = !h.intelOpen;
    const gist = hn && hn.play ? emph(hn.play) : (hn && hn.note ? emph(hn.note) : line);
    return `<div class="card flat holeintel${shut ? ' shut' : ''}">
      <div class="lvlab hi-head" data-action="live-intel">${head.join(' · ')}
        <b class="hi-tog">${shut ? '▸' : '▾'}</b></div>
      ${shut ? (gist ? `<p class="hi-gist" data-action="live-intel">${gist}</p>` : '') : `
      ${hn && !hn.play && hn.note ? `<p class="sm" style="margin-top:2px">${emph(hn.note)}</p>` : ''}
      ${(() => {
        // Fixed labels in a fixed order, each one rendered only if the hole has it. The
        // value is that LEAVES is always in the same place on every hole that has one —
        // which is exactly what a four-slot template gets right and a paragraph doesn't.
        // The decision is the first row rather than a headline: same grid, read first.
        if(!hn) return '';
        const rows = [[hn.playAs || 'Tee', hn.play], ['Leaves', hn.leaves],
                      ['Green', hn.green], ['Avoid', hn.avoid]].filter(r => r[1]);
        if(!rows.length && !rec) return '';
        return `<dl class="hi-grid">
          ${rows.map(([k, v], i) => `<dt>${esc(k)}</dt><dd class="${
            k === 'Avoid' ? 'hot' : i === 0 && hn.play ? 'lead' : ''}">${emph(v)}</dd>`).join('')}
          ${rec ? `${rows.length ? '<div class="hi-sep"></div>' : ''}
            <dt class="was">Last</dt><dd class="was">${line}${
            eating ? ' — <b class="hot">play it as a bogey hole</b>' : ''}</dd>
            ${rec.notes.map(p => `<dt class="was">Wrote</dt>
              <dd class="was">&ldquo;${esc(p.note)}&rdquo; <span class="faint">${fmtDate(p.date)}</span></dd>`).join('')}` : ''}
        </dl>`;
      })()}
      ${why.length || !hn ? `<ul class="hi-why">
        ${why.map(w => `<li>${emph(w)}</li>`).join('')}
        ${!hn && rec ? `<li>${line}</li>` : ''}
        ${!hn ? (rec ? rec.notes : []).map(p => `<li>You wrote here ${fmtDate(p.date)}: &ldquo;${esc(p.note)}&rdquo;</li>`).join('') : ''}
        ${!hn && eating ? `<li class="hot"><b>This one has been eating you</b> — play it as a bogey hole on purpose</li>` : ''}
      </ul>` : ''}`}
    </div>`;
  })();

  // ---- The hole strip: eighteen bars, the round at a glance and a way to any hole ----
  // Solid = where you are. Filled at 72% = played, at or under par. At 40% = played, over.
  // At 16% = not played. It is deliberately NOT a scorecard: it is a progress bar you can
  // tap, and the number it carries is "how is this going" rather than a score per hole.
  // Eighteen targets across one phone cannot each be 44px wide — no arrangement of them
  // can — so the strip is a shortcut with a 30px-tall hit area, and the 44px+ Back / Next
  // buttons in the footer remain the primary way between holes.
  const bar = (x, i) => `<span class="lvbar${i === L.cur ? ' cur'
    : x.s == null ? '' : x.s <= x.par ? ' ok' : ' over'}${x.note ? ' noted' : ''}"
    data-action="live-goto" data-i="${i}" title="Hole ${x.n}"></span>`;

  return `
  <div class="lvhead">
    <div class="lvhe">LIVE · ${esc((L.course || '').toUpperCase())}${
      L.tees ? ` · ${esc(String(L.tees).toUpperCase())}` : ''}</div>
    <div class="lvhr">
      <div class="lvhn">Hole ${h.n}<span class="lvhs">
        <button class="lvpar${h.parAuto ? ' auto' : ''}" data-action="live-par">PAR ${h.par}</button>${
        // A par nobody has confirmed renders HALF-LIT — dashed, the same "this is not a
        // record" language the guessed cells on the card check use — so a placeholder can
        // never sit there looking like a scorecard. One tap cycles 3 · 4 · 5, which is the
        // whole card check in miniature; the Card button opens all eighteen.
        h.si ? `<i>SI ${h.si}</i>` : ''}</span></div>
      <div class="lvhb">
        <button class="lvfin ghost" data-action="live-card-open">Card</button>
        <button class="lvfin" data-action="live-finish">Finish</button>
      </div>
    </div>
    <div class="lvbars">${L.holes.map(bar).join('')}</div>
    <div class="lvhf"><span>${t.n ? `THRU ${t.n} · ${t.over > 0 ? '+' : ''}${t.over}` : 'NOT STARTED'}</span>
      <span class="lvsaved">● SAVED</span></div>
  </div>

  <div class="lvseg">
    <span class="${quick ? '' : 'on'}" data-action="live-view" data-v="">Full card</span>
    <span class="${quick ? 'on' : ''}" data-action="live-view" data-v="1">⚡ Quick view</span>
  </div>

  <div class="lvwrap${arrived ? ' slide' : ''}">
    ${quick ? quickCard : fullCard}
  </div>

  ${prep}
  <p class="sm faint" style="margin-top:10px">Everything except the score is optional — skip a row and it simply isn't recorded, rather than being guessed. Tap a lit chip again to clear it. A <b>half-lit</b> tee club is one carried over from the last time you played this hole, or from earlier in this round: leave it if it's right, tap another club if it isn't.</p>

  <div class="lvfoot">
    <button class="lvback"${L.cur === 0 ? ' disabled' : ''} data-action="live-nav" data-d="-1">‹</button>
    <button class="lvnext" data-action="live-nav" data-d="1">${
      last ? 'Finish card' : `Hole ${L.holes[L.cur + 1].n}`} ›</button>
  </div>
  <div class="formrow" style="margin-top:6px">
    <button class="btn ghost tiny" data-action="go" data-view="home">Pause · back to Home</button>
    <button class="btn ghost tiny" data-action="live-discard">Discard round</button>
  </div>`;
}

function liveFinish(L){
  const r = liveRound(L);
  const a = roundAnalysis(r);
  const t = liveThru(L);
  const lit = new Set(L.troubles || []);
  const skipped = L.holes.length - r.holes.length;
  return `
  <button class="backlink" data-action="live-nav" data-d="-1">← Back to the card</button>
  <div class="card">
    <h2>${esc(L.course)}</h2>
    <p class="sm faint">${fmtDate(L.date)}${L.nine ? ` · ${L.nine === 'F' ? 'front' : 'back'} nine` : ''} · ${r.holes.length} holes${
      skipped ? ` · ${skipped} not scored, they won't be counted` : ''}</p>
    <div class="rowgrid g3" style="margin-bottom:4px">
      <div class="stat"><div class="v">${r.score || '—'}</div><div class="l">Score</div></div>
      <div class="stat"><div class="v">${t.over > 0 ? '+' : ''}${t.over}</div><div class="l">vs par</div></div>
      <div class="stat"><div class="v">${r.putts ?? '—'}</div><div class="l">Putts</div></div>
    </div>
    ${a.nines.length === 2 ? `<p class="sm">Out <b>${a.nines[0].score}</b> · In <b>${a.nines[1].score}</b>.</p>` : ''}
    ${a.gir.n || a.fw.n ? `<p class="sm">${a.gir.n ? `Greens <b>${a.gir.hit}/${a.gir.n}</b>` : ''}${
      a.gir.n && a.fw.n ? ' · ' : ''}${a.fw.n ? `Fairways <b>${a.fw.hit}/${a.fw.n}</b>` : ''}.</p>` : ''}
    ${(ob => ob ? `<p class="sm"><b class="warn">${ob} out of bounds</b> — ${ob * 2} strokes of penalty on the card.</p>` : '')(
      (a.fw.miss.OB || 0) + (a.gir.miss.OB || 0))}
  </div>

  ${(notes => notes.length ? `<div class="card">
    <h2 style="margin-top:0">Your notes</h2>
    <dl class="holenotes">${notes.map(h => `<dt>${h.n}</dt><dd>${esc(h.note)}</dd>`).join('')}</dl>
    <p class="sm faint">Written on the hole. They save with the card and open with it — go back and edit any of them before you save.</p>
  </div>` : '')(r.holes.filter(h => h.note))}

  <div class="card">
    ${fullCard(r) ? `<div class="formrow g3">
      <div><label>Tees</label><input id="lvTees" value="${esc(L.tees || '')}" placeholder="Blue"></div>
      <div><label>Rating</label><input id="lvRating" inputmode="decimal" value="${L.rating ?? ''}" placeholder="—"></div>
      <div><label>Slope</label><input id="lvSlope" inputmode="numeric" value="${L.slope ?? ''}" placeholder="—"></div>
    </div>
    <p class="sm faint">Rating and slope are what turn this into a handicap differential. Both or neither — leave them blank and Claude can backfill them later.</p>`
    : `<div><label>Tees</label><input id="lvTees" value="${esc(L.tees || '')}" placeholder="Blue"></div>
    <p class="sm faint" style="margin-top:8px">${r.holes.length} holes isn't a full nine or eighteen, so this card gets no course rating — a part-round can't produce a handicap differential, and forcing one would drag your estimated index somewhere false. Everything else about it still counts.</p>`}
    <label>What gave you trouble? (pre-ticked from your card — adjust it)</label>
    <div class="chips" id="troubleChips">
      ${TROUBLES.map(([k, lab]) => `<span class="chip${lit.has(k) ? ' on' : ''}" data-trouble="${k}">${lab}</span>`).join('')}
    </div>
    <label>Anything else</label>
    <textarea id="lvNote" rows="2" placeholder='"Wind got me on the back nine…"'>${esc(L.note || '')}</textarea>
    <div style="margin-top:12px"><button class="btn" data-action="live-save">Save round → see the breakdown</button></div>
  </div>

  <div class="card flat">
    <p class="sm">Saving drops you straight into this round's own card, where the hole-by-hole detail you just logged turns into the miss patterns, the scrambling rate and the coaching. Everything also folds into the season numbers on <b>Rounds</b>.</p>
    <button class="btn ghost tiny" data-action="live-discard" style="margin-top:8px">Discard this round</button>
  </div>`;
}

// ----- Data / backup -----
function dataView(){
  return `
  <button class="backlink" data-action="go" data-view="home">← Home</button>
  <div class="card">
    <h2>Backup</h2>
    <p class="sm">Everything lives in this browser. Export a JSON backup any time; import it on a new phone to restore.</p>
    <div class="formrow" style="margin-top:10px">
      <button class="btn" data-action="export">Export backup</button>
      <button class="btn ghost" data-action="import">Import backup</button>
    </div>
    <input type="file" id="importFile" accept=".json" style="display:none">
  </div>
  <div class="card">
    <h2>Profile</h2>
    <div class="formrow">
      <div><label>Handicap</label><input id="pfHcp" inputmode="decimal" value="${esc(S.profile.handicap)}"></div>
      <div style="align-self:end"><button class="btn ghost" data-action="save-profile">Save</button></div>
    </div>
  </div>
  <div class="card">
    <h2>This version</h2>
    <p class="sm">Running build <b>${BUILD}</b>. The app checks for a new one every time you
    open it and refreshes itself when it finds one — if this number is behind what Claude
    just shipped, that's worth saying, because it means the update didn't land.</p>
    <button class="btn ghost tiny" data-action="check-update" style="margin-top:8px">Check for an update</button>
  </div>
  <div class="card">
    <h2>Danger zone</h2>
    <p class="sm">Reset wipes all logged data and restores the original seed.</p>
    <button class="btn burg" data-action="reset" style="margin-top:8px">Reset app</button>
  </div>`;
}

// Wear advances once per round played, whichever way the round was logged.
function bumpGearCounters(){
  S.settings.gripRounds++;
  S.clubs.forEach(c => { if(c.cat === 'wedge' && c.status === 'gaming') c.rounds = (c.rounds || 0) + 1; });
}

// ---------- Actions ----------
const ACTIONS = {
  // `data-seg` is how a link asks for one FACE of a multi-segment view (Rounds). Every
  // other view ignores it, so one action still covers every link in the app.
  'go': el => { editingCourse = null; render(el.dataset.view, el.dataset.seg); },
  // Switching segment is not going anywhere — it is the same tab showing a different face
  // of the same subject — so it redraws in place and keeps the scroll. current.arg has to
  // move with it, or the next rerender() (a chip tap, a saved course) would snap back.
  'rounds-seg': el => { roundsSeg = el.dataset.k; current.arg = roundsSeg; rerender(); },
  // Same rule for the labs hub: picking a lab is the page showing a different face of
  // itself, so it redraws in place. Tapping the lab that is already selected OPENS it,
  // which is a navigation and goes through `go`.
  'game-lab': el => { gameLab = el.dataset.disc; rerender(); },
  'open-round': el => render('round', +el.dataset.i),

  // ----- Live round -----
  'live-new': () => render('live'),
  'live-pick': el => { const i = $('#lvCourse'); if(i) i.value = el.dataset.course; showPicks(false); },
  'live-start': () => {
    const typed = $('#lvCourse').value.trim();
    if(!typed) return toast('Name the course first');
    // Snap to the spelling already on record. Course name is the join key for prior
    // layouts, the worst-holes table and a briefing's history link, so "sterling farms"
    // thumbed in on the first tee must not fork off from "Sterling Farms Golf Course".
    const known = [...S.courses.map(c => c.name), ...S.rounds.map(r => r.course)]
      .find(n => n && n.toLowerCase() === typed.toLowerCase());
    const course = known || typed;
    const date = $('#lvDate').value || today();
    const nine = $('#lvNine').value || null;
    const prior = priorLayout(course, nine);
    const pub = publishedCard(course, nine);
    const first = nine === 'B' ? 10 : 1;
    const holes = [];
    for(let i = 0; i < (nine ? 9 : 18); i++){
      const n = first + i;
      const mine = prior && prior.by.get(n);
      const card = pub && pub.by.get(n);
      // His own card, then the published one, then a guess that ADMITS it is a guess.
      const src = mine ? 'mine' : card ? 'card' : 'guess';
      const h = { n, par: mine ? mine.par : card ? card.par : 4,
        si: (mine && mine.si) ?? (card && card.si) ?? null, s:null, parFrom:src };
      // The flag is the whole fix: a guessed par renders half-lit everywhere, exactly
      // like a carried-over tee club, so it can never pass for a prefilled scorecard.
      if(src === 'guess') h.parAuto = true;
      holes.push(h);
    }
    // He's playing it, so it belongs in Courses whether or not he's rated it yet.
    if(!S.courses.some(c => (c.name || '').toLowerCase() === course.toLowerCase())){
      const db = typeof COURSE_DB !== 'undefined'
        ? COURSE_DB.find(c => c.n.toLowerCase() === course.toLowerCase()) : null;
      S.courses.push({ id:uid(), name:course, st: db ? db.st : '', rating:null, pr:null, bucket:false, notes:'' });
    }
    // Straight to the card check rather than to hole 1. One glance at eighteen pars and a
    // total costs a couple of seconds on the first tee; discovering on the 14th that the
    // card has been wrong all day costs the round's data, which is what happened Aug 20.
    S.live = { date, course, nine, cur:0, holes, stage:'card', prevLayout: !!prior,
      cardSrc: prior ? 'mine' : pub ? (pub.ver === 'read' ? 'card' : 'soft') : 'guess',
      cardFrom: prior ? fmtDate(prior.from) : pub ? pub.src : '',
      tees: prior ? prior.tees : '', rating: prior ? prior.rating : null,
      slope: prior ? prior.slope : null, troubles:[], note:'' };
    save(); render('live');
  },
  // Tap a hole on the card check to cycle its par. Same 3/4/5 the hole screen offers, and
  // touching one confirms it: a par he has looked at is no longer a guess.
  'live-card-par': el => {
    const L = S.live; if(!L) return;
    const h = L.holes[+el.dataset.i]; if(!h) return;
    h.par = h.par >= 5 ? 3 : h.par + 1;
    delete h.parAuto; h.parFrom = 'mine';
    save(); rerender();
  },
  'live-card-play': () => {
    const L = S.live; if(!L) return;
    // Confirming the card is a claim about the course, so it clears every guess flag at
    // once — he has now seen the pars, which is exactly what the screen is for.
    L.holes.forEach(h => { delete h.parAuto; if(h.parFrom === 'guess') h.parFrom = 'mine'; });
    L.stage = 'play'; L.cardOK = true;
    suggestTee(L);
    save(); render('live');
    toast('Round started — good luck');
  },
  // Finish from the header, on whatever hole he is standing on — a nine that stops at the
  // seventh, a match conceded on 15. Same route the last hole's Next button takes, so the
  // troubles come pre-ticked off the card either way.
  'live-finish': () => {
    const L = S.live; if(!L) return;
    syncHoleNote();
    L.stage = 'finish';
    L.troubles = liveTroubles(roundAnalysis(liveRound(L)));
    save(); render('live');
  },
  'live-card-open': () => {
    const L = S.live; if(!L) return;
    syncHoleNote();
    L.stage = 'card'; save(); render('live');
  },
  // Par, on the hole he is standing on: one tap cycles 3 · 4 · 5. It is one control rather
  // than three chips because the header is sticky — every pixel it takes it takes for all
  // eighteen holes — and the Card button beside it opens the full eighteen-par check.
  'live-par': () => {
    const L = S.live, h = L && L.holes[L.cur];
    if(!h) return;
    setHolePar(L, h, h.par >= 5 ? 3 : h.par + 1);
    save(); rerender();
  },
  'live-set': el => {
    const L = S.live, h = L && L.holes[L.cur];
    if(!h) return;
    const k = el.dataset.k, v = el.dataset.v;
    const lit = el.classList.contains('on');   // re-tapping a lit chip clears it
    if(k === 'par'){ setHolePar(L, h, +v); }
    else if(k === 'tee'){
      // Tapping the suggested club CONFIRMS it rather than clearing it — clearing a chip
      // he never chose would be a confusing way to spend the tap this feature just saved.
      const confirming = h.teeAuto && h.tee === v;
      h.teeTouched = true; delete h.teeAuto;
      if(confirming){ /* keep h.tee */ }
      else if(lit) delete h.tee;
      else h.tee = v;
    }
    else if(k === 'app'){ if(lit) delete h[k]; else h[k] = v; }
    else if(k === 'fw'){
      if(lit){ delete h.fw; delete h.fmiss; }
      else if(v === 'hit'){ h.fw = true; delete h.fmiss; }
      else { h.fw = false; if(v === 'X') delete h.fmiss; else h.fmiss = v; }
    }
    else if(k === 'green'){
      if(lit){ delete h.gir; delete h.gmiss; }
      else if(v === 'hit'){ h.gir = true; delete h.gmiss; delete h.noshot; }  // on it = you had a shot
      else { h.gir = false; h.gmiss = v; }
    }
    else if(k === 'noshot'){
      if(lit) delete h.noshot;
      // You cannot have no play at the green and still hit it in regulation, so this
      // settles the green result too — but it leaves any direction alone, because a
      // conceded green can still be a factual "finished short".
      else { h.noshot = true; if(h.gir !== false){ h.gir = false; delete h.gmiss; } }
    }
    else if(k === 'putts'){
      if(lit) delete h.putts;
      // Chipped in, or holed from off the green: no putt to measure and nothing anybody
      // could have conceded. And on a ONE-putt hole the first putt and the made putt are
      // the same putt, so the separate starting point stops applying.
      else {
        h.putts = +v;
        if(h.putts === 0){ delete h.pm; delete h.pd; delete h.gimme; }
        else if(h.putts === 1) delete h.pd;
      }
    }
    else if(k === 'pm'){ if(lit) delete h.pm; else { h.pm = v; delete h.gimme; } }
    else if(k === 'pd'){ if(lit) delete h.pd; else h.pd = v; }
    // Given and a made distance are the same slot: it either went in from somewhere, or
    // nobody made him hit it.
    else if(k === 'gimme'){ if(lit) delete h.gimme; else { h.gimme = true; delete h.pm; } }
    else if(k === 's'){ h.s = lit ? null : +v; }
    // Quick view: answering the open row opens the next unanswered one, forward only.
    // The no-shot qualifier doesn't advance — it refines the answer already given — but
    // Given does: it fills the made-putt slot the same way a distance would. Clearing a
    // chip leaves the row open, because an empty row is not answered.
    if(S.settings.liveQuick && k !== 'par'){
      const ROW = { tee:'tee', fw:'fw', app:'app', green:'green', putts:'putts',
        pm:'pm', gimme:'pm', pd:'pd', s:'s' };
      const r = ROW[k];
      if(r && r === qOpenRow(h) && qAnswered(h, r)) qAdvance(h, r);
    }
    save(); rerender();
  },
  // The Full card / Quick view switch under the hole's prep. Sticky on purpose — unlike
  // the prep collapse it hides nothing, it's the same taps on a different layout.
  'live-view': el => {
    syncHoleNote();
    if(el.dataset.v) S.settings.liveQuick = true; else delete S.settings.liveQuick;
    save(); rerender();
  },
  // Tap a quick-view row to open it (or close it again) — fixing an earlier answer is
  // one tap on its row, and skipping a row is simply never opening it.
  'live-qrow': el => {
    const L = S.live, h = L && L.holes[L.cur];
    if(!h) return;
    syncHoleNote();
    h.qOpen = qOpenRow(h) === el.dataset.r ? '' : el.dataset.r;
    // Opening the Note row already says "I want to write" — show the box, not a chip
    // asking again. The keyboard still waits for a tap on the box itself.
    if(h.qOpen === 'note') h.noteOpen = true;
    save(); rerender();
  },
  // Open the hole's prep. It arrives folded so the scoring rows are up the screen, and the
  // one line to act on is showing either way — this tap is for the reasoning under it.
  'live-intel': () => {
    const L = S.live, h = L && L.holes[L.cur];
    if(!h) return;
    if(h.intelOpen) delete h.intelOpen; else h.intelOpen = true;
    save(); rerender();
  },
  // The keyboard is opt-in. Everything else on this screen is a chip, and it stays that
  // way — the note row is one tap until he actually wants to type.
  'live-note': () => {
    const L = S.live, h = L && L.holes[L.cur];
    if(!h) return;
    h.noteOpen = true; save(); rerender();
    const box = document.getElementById('lvHoleNote');
    if(box){ box.focus(); box.setSelectionRange(box.value.length, box.value.length); }
  },
  'live-bump': el => {
    const L = S.live, h = L && L.holes[L.cur];
    if(!h) return;
    h.s = Math.max(1, (h.s ?? h.par) + (+el.dataset.d));
    save(); rerender();
  },
  // Changing hole IS a navigation — that one should land at the top of the new hole.
  'live-goto': el => { if(S.live){ syncHoleNote(); S.live.cur = +el.dataset.i;
    suggestTee(S.live); save(); render('live'); } },
  'live-nav': el => {
    const L = S.live; if(!L) return;
    syncHoleNote();
    const to = L.cur + (+el.dataset.d);
    if(L.stage === 'finish'){ L.stage = 'play'; save(); return render('live'); }
    if(to < 0) return;
    if(to >= L.holes.length){
      L.stage = 'finish';
      L.troubles = liveTroubles(roundAnalysis(liveRound(L)));
      save(); return render('live');
    }
    L.cur = to; suggestTee(L); save(); render('live');
  },
  'live-save': () => {
    const L = S.live; if(!L) return;
    syncHoleNote();
    const r = liveRound(L);
    if(!r.holes.length) return toast('Score at least one hole first');
    const tees = $('#lvTees').value.trim();
    if(tees) r.tees = tees;
    // A course rating covers a whole nine or eighteen. On a card that stops early it
    // would produce a wildly wrong differential and drag the estimated index with it, so
    // a part-round gets no rating at all — see the note on the review screen.
    const rt = parseFloat($('#lvRating')?.value), sl = parseInt($('#lvSlope')?.value, 10);
    if(fullCard(r) && !isNaN(rt) && !isNaN(sl)){ r.rating = rt; r.slope = sl; }
    r.note = $('#lvNote').value.trim();
    r.troubles = [...document.querySelectorAll('#troubleChips .chip.on')].map(c => c.dataset.trouble);
    S.rounds.push(r);
    bumpGearCounters();
    S.live = null; save();
    render('round', S.rounds.length - 1);
    toast('Round saved — this is your card');
  },
  'live-discard': () => {
    if(!S.live) return;
    if(!confirm(`Discard the live round at ${S.live.course}? Everything logged for it is lost.`)) return;
    S.live = null; save(); render('home'); toast('Live round discarded');
  },

  'save-deadline': () => {
    const v = $('#deadlineInput').value;
    if(!v) return toast('Pick a date first');
    S.settings.returnDeadline = v; S.settings.deadlineEstimated = false; save(); rerender(); toast('Deadline saved');
  },
  'toggle-action': el => {
    const a = S.actions.find(x=>x.id===el.dataset.id);
    if(a){ a.done = !a.done; save(); rerender(); }
  },
  'add-action': () => {
    const v = $('#newAction').value.trim(); if(!v) return;
    S.actions.push({ id:uid(), text:v, done:false, pri:false }); save(); rerender(); toast('Added');
  },
  'show-add-club': () => { $('#addClubForm').style.display='block'; $('#clNa').focus(); },
  'add-club': () => {
    const name = $('#clNa').value.trim(); if(!name) return toast('Name it first');
    S.clubs.push({ id:uid(), name, cat:$('#clCat').value, status:$('#clSt').value,
      spec:$('#clSp').value.trim(), note:$('#clNo').value.trim(), rounds:0,
      loft: $('#clCat').value==='wedge' ? parseInt(($('#clSp').value.match(/\d{2}/)||[])[0]) || undefined : undefined });
    save(); rerender(); toast('Club added');
  },
  'save-carries': () => {
    document.querySelectorAll('[data-carry]').forEach(inp => {
      S.carries[+inp.dataset.carry].carry = inp.value ? parseInt(inp.value) : null;
    });
    S.carriesCalibrated = true;
    syncWedgeCarries('ladder');
    save(); rerender(); toast('Carries saved everywhere');
  },
  'save-matrix': () => {
    document.querySelectorAll('[data-matrix]').forEach(inp => {
      const [L,k] = inp.dataset.matrix.split('.');
      S.matrix[L][k] = inp.value ? parseInt(inp.value) : null;
    });
    if(Object.values(S.matrix).some(m => m.f != null)) S.carriesCalibrated = true;
    syncWedgeCarries('matrix');
    save(); rerender(); toast('Carries saved everywhere');
  },
  'add-history': () => {
    const v = $('#newHist').value.trim(); if(!v) return;
    S.bagHistory.unshift({ date: today().slice(0,7).replace('-','–'), text:v }); save(); rerender(); toast('Logged');
  },
  'save-fiveft': () => {
    const results = [...document.querySelectorAll('[data-tap]')].map(t=>t.dataset.state);
    if(!results.some(r=>r)) return toast('Tap some balls first');
    S.fiveFt.push({ date: today(), results }); save(); rerender();
    const s = fiveFtScore({results});
    toast(`Saved: ${s.makes}/${s.total} from 5 ft`);
  },
  'drill-done': () => {
    const d = today();
    if(!S.drillDays.includes(d)) S.drillDays.push(d);
    save(); rerender(); toast('Streak alive 🔥');
  },
  // Logging a SPECIFIC drill. Keeps the streak too — the day's work happened either way,
  // and making him tap two buttons for one session is how a log stops being kept.
  'log-drill': el => {
    const id = el.dataset.id;
    const box = $(`#dres-${CSS.escape(id)}`);
    const v = box ? box.value.trim() : '';
    S.drillLog.push({ id, date: today(), v });
    if(!S.drillDays.includes(today())) S.drillDays.push(today());
    save(); rerender();
    toast(v ? `Logged · ${v} 🔥` : 'Logged 🔥');
  },
  // Sent here from a lab's diagnosis card: show only what trains that fault.
  'drills-for': el => {
    drillTag = el.dataset.tag || null;
    S.settings.drillPlace = 'all';   // a fault is trained wherever it is trained
    save(); render('drills');        // render() only clears the tag when leaving the bench
  },
  'clear-drill-tag': () => { drillTag = null; rerender(); },
  // ----- Mental game -----
  'mental-focus': el => {
    const on = el.classList.contains('grn');
    document.querySelectorAll('#mtFocus .chip').forEach(c => c.classList.remove('grn'));
    if(!on) el.classList.add('grn');   // tapping the picked one clears it
  },
  'save-debrief': () => {
    const pick = sel => [...document.querySelectorAll(sel)].filter(c => c.classList.contains('on'));
    const triggers = pick('#mtTriggers .chip').map(c => c.dataset.trig);
    const when = pick('#mtWhen .chip').map(c => c.dataset.when);
    const f = document.querySelector('#mtFocus .chip.grn');
    const note = $('#mtNote').value.trim(), nx = $('#mtNext').value.trim();
    if(!f && !triggers.length && !note && !nx) return toast('Nothing to save yet');
    const ri = $('#mtRound').value;
    const rounds = S.rounds.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 10);
    const r = ri === '' ? null : rounds[+ri];
    S.mental.push({ id:uid(), date: $('#mtDate').value || today(),
      round: r ? { course:r.course, date:r.date, nine:r.nine || null } : null,
      focus: f ? +f.dataset.focus : null, triggers, when, note, next:nx });
    save(); rerender(); toast('Debrief saved');
  },
  'del-debrief': el => {
    S.mental = S.mental.filter(d => d.id !== el.dataset.id);
    save(); rerender(); toast('Deleted');
  },

  'add-session': () => {
    const setup = $('#sesSetup').value.trim(), finding = $('#sesFind').value.trim();
    if(!setup && !finding) return toast('Fill in the session first');
    S.sessions.push({ date: today(), setup, finding }); save(); rerender(); toast('Session logged');
  },
  'save-round': () => {
    const troubles = [...document.querySelectorAll('#troubleChips .chip.on')].map(c=>c.dataset.trouble);
    const r = { date: $('#rdDate').value || today(), course: $('#rdCourse').value.trim(),
      score: $('#rdScore').value ? parseInt($('#rdScore').value) : null,
      putts: $('#rdPutts').value ? parseInt($('#rdPutts').value) : null,
      troubles, note: $('#rdNote').value.trim() };
    if(r.score===null && !r.course && !troubles.length && !r.note) return toast('Log something first');
    S.rounds.push(r);
    bumpGearCounters();
    save(); rerender(); toast('Round saved — Coach updated');
  },
  'toggle-sections': el => {
    const box = el.closest('.card');
    const secs = [...box.querySelectorAll('details.sect')];
    const opening = secs.some(d => !d.open);
    secs.forEach(d => { d.open = opening; });
    el.textContent = opening ? 'Collapse all' : 'Expand all';
  },
  'open-session': el => render('session', el.dataset.i),
  'open-briefing': el => render('briefing', el.dataset.id),
  'open-shelf': el => render('shelf', el.dataset.shelf),
  // Kit and place are filters on a list, so they redraw in place — jumping to the top of
  // the page every time you tap a chip is exactly what rerender() exists to prevent.
  'toggle-kit': el => {
    const k = el.dataset.kit;
    S.kit = haveKit(k) ? S.kit.filter(x => x !== k) : S.kit.concat(k);
    save(); rerender();
  },
  'pick-place': el => { S.settings.drillPlace = el.dataset.place; save(); rerender(); },
  'open-lesson': el => render('lesson', el.dataset.id),
  'edit-course': el => {
    editingCourse = S.courses.find(c=>c.id===el.dataset.id) || null;
    render('courses');   // reachable from the round view too, so go there rather than rerender
    $('#courseFormAnchor')?.scrollIntoView({behavior:'smooth'});
  },
  'cancel-edit-course': () => { editingCourse = null; rerender(); },
  'save-course': () => {
    const name = $('#coNa').value.trim(); if(!name) return toast('Name the course');
    const data = { name, st:$('#coSt').value.trim(),
      rating: $('#coRt').value ? parseFloat($('#coRt').value) : null,
      pr: $('#coPr').value ? parseInt($('#coPr').value) : null,
      notes: $('#coNo').value.trim(), bucket: $('#coBucket').classList.contains('grn') };
    if(editingCourse) Object.assign(editingCourse, data);
    else S.courses.push({ id:uid(), ...data });
    editingCourse = null; save(); rerender(); toast('Course saved');
  },
  'delete-course': () => {
    if(editingCourse){ S.courses = S.courses.filter(c=>c!==editingCourse); editingCourse=null; save(); rerender(); toast('Deleted'); }
  },
  'toggle-demo': el => { const p = S.shortlist[+el.dataset.i]; p.demoed = !p.demoed; save(); rerender(); },
  'save-test': () => {
    const putter = $('#tePutter').value.trim(), makes = $('#teMakes').value;
    if(!putter || makes==='') return toast('Putter + makes needed');
    S.tests.push({ date: today(), putter, makes: parseInt(makes), note: $('#teNote').value.trim() });
    save(); rerender(); toast('Test logged');
  },
  'export': () => {
    const blob = new Blob([JSON.stringify(S, null, 1)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `caddiehq-backup-${today()}.json`;
    a.click(); URL.revokeObjectURL(a.href);
  },
  'import': () => {
    const f = $('#importFile');
    f.onchange = () => {
      const file = f.files[0]; if(!file) return;
      file.text().then(txt => {
        try { const obj = JSON.parse(txt); if(!obj.v) throw 0; S = obj; save(); rerender(); toast('Backup restored'); }
        catch(e){ toast('Not a Caddie HQ backup'); }
      });
    };
    f.click();
  },
  'save-profile': () => { S.profile.handicap = parseFloat($('#pfHcp').value) || S.profile.handicap; save(); rerender(); toast('Saved'); },
  'reset': () => {
    if(confirm('Wipe all logged data and restore the original seed?')){ S = seed(); save(); render('home'); toast('Reset done'); }
  },
  'toggle-theme': () => {
    S.settings.theme = S.settings.theme === 'night' ? 'heritage' : 'night';
    applyTheme(); save();
    toast(S.settings.theme === 'night' ? 'Night mode ☾' : 'Heritage mode ☀');
  },
  'get-weather': () => fetchWeather(true),
  'locate': () => fetchHere(true),
  // Picking Nearest with no fix on file asks for one there and then: the chip is the
  // request. fetchHere() re-renders on its own if the phone answers, and toasts if it
  // doesn't — either way the list stays in its rating order until there's a fix to use.
  'course-sort': el => {
    S.settings.courseSort = el.dataset.k; save();
    if(el.dataset.k === 'dist' && !S.here) fetchHere(true);
    rerender();
  },
  'cheat-open': el => openCheat(el.dataset.disc, el.dataset.id),
  'cheat-close': () => closeCheat(),
  // A manual version of what visibilitychange does, for when you want to force it.
  // A found update reloads the page on its own (see index.html), so the "up to date"
  // toast only ever shows when there genuinely wasn't one.
  'check-update': () => {
    if(!navigator.serviceWorker){ toast('No updater on this browser'); return; }
    navigator.serviceWorker.getRegistration()
      .then(r => r ? r.update().then(() => toast(`Up to date · ${BUILD}`)) : toast('Not installed yet'))
      .catch(() => toast('Update check failed — offline?'));
  },
};

function applyTheme(){
  document.body.classList.toggle('night', S.settings.theme === 'night');
  const b = document.querySelector('.themebtn');
  if(b) b.textContent = S.settings.theme === 'night' ? '☀' : '☾';
}

// ----- Where he is -----
// The weather fetch has always asked the phone for a position and then thrown it away.
// Keeping it costs nothing and answers a second question — which of his course plans is
// the nearest — so the fix is now stored in its own place rather than inside S.weather:
// it outlives a weather refresh, and it is the thing a distance sort actually depends on.
//
// It stays on the phone. Sorting by distance is arithmetic, not a lookup — nothing about
// where he is leaves the device for it. (The weather call itself does send coordinates to
// open-meteo, exactly as it always has.) Rounded to three decimals, ~100 m, which is far
// finer than a mile-scale sort needs.
function setHere(pos){
  const { latitude, longitude } = pos.coords;
  S.here = { lat:+latitude.toFixed(3), lon:+longitude.toFixed(3), ts:Date.now() };
  save();
  return S.here;
}
// Asking for a position on its own, for the sort, without pulling the weather down too.
function fetchHere(manual){
  if(!navigator.geolocation){ if(manual) toast('No location on this device'); return; }
  navigator.geolocation.getCurrentPosition(pos => { setHere(pos); rerender(); },
    () => { if(manual) toast('Location permission needed to sort by distance'); },
    { timeout:8000, maximumAge:600000 });
}

function fetchWeather(manual){
  if(!manual && S.weather && Date.now() - S.weather.ts < 30*60*1000) return;
  if(!navigator.geolocation){ if(manual) toast('No location on this device'); return; }
  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude, longitude } = pos.coords;
    setHere(pos);   // free — the phone has just told us, and the sort wants it
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude.toFixed(3)}&longitude=${longitude.toFixed(3)}&current=temperature_2m,wind_speed_10m,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph`)
      .then(r => r.json())
      .then(j => {
        const c = j.current || {};
        S.weather = { t:c.temperature_2m, wind:c.wind_speed_10m, code:c.weather_code ?? 0, ts:Date.now() };
        save(); rerender();
      })
      .catch(() => { if(manual) toast('Weather unavailable — offline?'); });
  }, () => { if(manual) toast('Location permission needed for weather'); }, { timeout:8000, maximumAge:600000 });
}

document.addEventListener('click', e => {
  // The course picker on "Start a live round" closes on a tap anywhere outside it. A tap
  // in the box itself re-opens it, so closing it by mistake costs one tap, not a re-entry.
  if(!e.target.closest('#lvPick')) showPicks(e.target.id === 'lvCourse');
  // in-page section jump
  const jump = e.target.closest('[data-jump]');
  if(jump){
    document.getElementById(jump.dataset.jump)
      ?.scrollIntoView({ behavior:'smooth', block:'start' });
    return;
  }
  // 5-ft tap grid
  const tap = e.target.closest('[data-tap]');
  if(tap){
    const next = MISS_CYCLE[(MISS_CYCLE.indexOf(tap.dataset.state)+1) % MISS_CYCLE.length];
    tap.dataset.state = next;
    tap.className = 'tap' + (next==='make' ? ' make' : next ? ' miss' : '');
    tap.textContent = next==='make' ? '✓' : next || (+tap.dataset.tap + 1);
    return;
  }
  // trouble chips, the bucket chip and any [data-multi] chip row toggle themselves —
  // they're read back off the DOM when the form around them is saved.
  const chip = e.target.closest('#troubleChips .chip, #coBucket, [data-multi] .chip');
  if(chip){ chip.classList.toggle(chip.id==='coBucket' ? 'grn' : 'on'); return; }
  const el = e.target.closest('[data-action]');
  if(el && ACTIONS[el.dataset.action]) ACTIONS[el.dataset.action](el);
});

// A hole note is written to localStorage as it is typed, for the same reason every chip
// tap is: iOS kills a suspended PWA without warning, and a note that only existed in the
// textarea would go with it. No re-render — that would take the keyboard away mid-word.
document.addEventListener('input', e => {
  if(e.target.id !== 'lvHoleNote' || !S.live) return;
  const h = S.live.holes[S.live.cur];
  if(!h) return;
  const v = e.target.value.trim();
  if(v) h.note = v; else delete h.note;
  save();
});

// The course picker: opens on focus, filters on every keystroke. A row is picked on
// mousedown-prevented default so the input never blurs — losing focus closes the iOS
// keyboard, which reflows the page out from under the finger mid-tap.
document.addEventListener('focusin', e => { if(e.target.id === 'lvCourse') showPicks(true); });
document.addEventListener('input', e => { if(e.target.id === 'lvCourse') pickFilter(e.target.value); });
document.addEventListener('mousedown', e => { if(e.target.closest('.pkrow')) e.preventDefault(); });

// Course directory autofill: picking/typing a known course fills its state.
document.addEventListener('input', e => {
  if(e.target.id !== 'coNa' || typeof COURSE_DB === 'undefined') return;
  const hit = COURSE_DB.find(c => c.n.toLowerCase() === e.target.value.trim().toLowerCase());
  const st = document.getElementById('coSt');
  if(hit && st && !st.value) st.value = hit.st;
});

document.getElementById('nav').addEventListener('click', e => {
  const b = e.target.closest('button');
  if(b){ editingCourse = null; render(b.dataset.view); }
});


// Wedge full carries live in both the matrix (full column) and the distance
// ladder — one save updates both, whichever side was edited.
function syncWedgeCarries(source){
  Object.keys(S.matrix).forEach(L => {
    const row = S.carries.find(c => c.club === L + '° wedge');
    if(!row) return;
    if(source === 'matrix' && S.matrix[L].f != null) row.carry = S.matrix[L].f;
    if(source === 'ladder' && row.carry != null) S.matrix[L].f = row.carry;
  });
}

// ---------- Coach feed ----------
// Claude analyzes filmed sessions and pushes findings to coach-feed.json in the
// repo; the app merges any entries it hasn't applied yet. Jack's own logs stay
// local — this is a one-way inbox for coaching updates.
// Same date, same course, same nine = the same round, however it got here.
function sameRound(list, r){
  const key = (r.course || '').trim().toLowerCase();
  return list.find(x => x.date === r.date
    && (x.course || '').trim().toLowerCase() === key
    && (x.nine || null) === (r.nine || null)) || null;
}
// ---------- What's new: the log of everything that has changed ----------
// Every feed entry is a change somebody made to his app, and until now the only sign one
// had landed was a toast that disappeared. This turns each of them into one line of plain
// English plus the place it landed, so Home can say what is different since he last looked.
//
// Anything this doesn't recognise still gets a line: a change he cannot see is worse than
// one described vaguely, so the fallback names the entry type rather than dropping it.
const LAB_VIEW = { swing:'swing', 'short-game':'shortgame', putting:'putting', mental:'mental',
  'full-swing':'swing' };
// A film session's changelog row has to point at the lab the session actually landed in.
// sessionDiscipline() reads the setup text, which `session` entries always carry and most
// `session-remove` entries do; a `session-update` patching only the finding carries none,
// so fall back to the session it targets — recordUpdate() runs AFTER the entry is applied,
// so that row is already in S.sessions. A remove by bare feed id has neither, because the
// row is gone by then, so reuse the lab its own "Film ·" line was filed under.
function sessionLabView(e){
  const known = S.sessions.find(x => x._fid === (e.target || e.id));
  const setup = e.setup || e.setupMatch || (known && known.setup) || '';
  if(!setup && e.target){
    const prior = (S.updates || []).find(u => u.id === e.target && u.act && u.act.v);
    if(prior) return prior.act.v;
  }
  return LAB_VIEW[sessionDiscipline({ setup })] || 'putting';
}
// Text here is RAW — whatsNew() escapes when it renders, so nothing in the feed can
// inject markup and nothing gets double-escaped on the way through localStorage.
function updateLine(e){
  const go = v => ({ a:'go', v });
  const nm = o => (o && o.name) || '';
  const clip = (t, n) => { t = (t || '').replace(/\s+/g, ' ').trim();
    return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t; };
  const club = e.club || {}, br = e.briefing || {}, ls = e.lesson || {}, rd = e.round || {};
  switch(e.type){
    case 'club-add':      return { h:`New club · ${nm(club) || 'in the bag'}`, s:clip(club.spec || club.note, 96), act:go('bag') };
    case 'club-update':   return { h:`Bag update · ${e.target || 'a club'}`,
      s: club.status ? `now ${club.status}` : clip(club.note || club.spec, 96), act:go('bag') };
    case 'history':       return { h:'Bag history', s:clip(e.text, 96), act:go('bag') };
    case 'history-edit':  return { h:'Bag history corrected', s:clip(e.text, 96), act:go('bag') };
    case 'carry-update':  return { h:`Carry ladder · ${e.target || ''}`,
      s: e.remove ? 'dropped from the ladder — and from the tee chips in the live logger'
        : clip((e.club && e.club.carry != null) ? `${e.club.carry} yds` : 'carry unmeasured', 72), act:go('bag') };
    case 'carries':       return { h:'Carry ladder rebuilt', s:'', act:go('bag') };
    case 'session':       return { h:`Film · ${clip(e.setup, 72)}`, s:clip(e.finding, 104), act:go(sessionLabView(e)) };
    case 'session-update':return { h:'Film session updated', s:clip(e.finding || e.setup, 104), act:go(sessionLabView(e)) };
    case 'session-remove':return { h:'Film session removed', s:clip(e.setupMatch, 96), act:go(sessionLabView(e)) };
    case 'evolution':     return { h:'Stroke evolution grid rebuilt', s:'', act:go('putting') };
    case 'faults':        return { h:`Diagnosis updated · ${e.discipline || 'putting'}`,
      s:`${(e.faults || []).length} fault${(e.faults || []).length === 1 ? '' : 's'} on the board`,
      act:go(LAB_VIEW[e.discipline || 'putting'] || 'putting') };
    case 'action':        return { h:'New to-do', s:clip(e.text, 104), act:go('coach') };
    case 'action-done':   return { h:'To-do closed', s:'', act:go('coach') };
    case 'action-update': return { h:'To-do reworded', s:clip(e.text, 104), act:go('coach') };
    case 'course-add':    return { h:`Course added · ${nm(e.course)}`, s:'Rate it after you play it', act:go('courses') };
    case 'course-remove': return { h:`Course removed · ${e.target || ''}`, s:'', act:go('courses') };
    // Deliberately a CONSTANT headline: a location is supporting data, and a push that puts
    // one on file for forty-five courses is one change, not forty-five. What's new collapses
    // rows sharing a headline on a day, so the batch reads as a single line with its count.
    case 'geo':           return { h:'Course location on file',
      s:[(e.geo && e.geo.course) || '', (e.geo && e.geo.place) || ''].filter(Boolean).join(' · ')
        || 'Courses and Round Prep can sort nearest first', act:go('courses') };
    case 'layout':        return { h:`Scorecard on file · ${(e.layout && e.layout.course) || ''}`,
      s:`Par${e.layout && e.layout.si ? ' and stroke index' : ''} prefills now when you log a live round there`,
      act:go('courses') };
    case 'round':         return { h:`Round · ${rd.course || ''}`,
      s:[rd.date ? fmtDate(rd.date) : '', rd.score != null ? `${rd.score}` : ''].filter(Boolean).join(' · '), act:go('scores') };
    case 'round-update':  return { h:`Round updated · ${rd.course || ''}`,
      s:[rd.date ? fmtDate(rd.date) : '', rd.rating != null ? 'rating and slope backfilled' : ''].filter(Boolean).join(' · '), act:go('scores') };
    case 'stats':         return { h:'Stats snapshot', s:'A new GHIN summary to measure against', act:go('scores') };
    case 'test':          return { h:'Putter test logged', s:clip(e.test && e.test.note, 96), act:go('putting') };
    case 'shortlist':     return { h:'Putter shortlist updated', s:'', act:go('putting') };
    case 'briefing':      return { h:`${br.date ? 'Round prep' : 'Plan'} · ${br.course || ''}`,
      s:clip(br.focus, 104), act:{ a:'open-briefing', id:e.id } };
    case 'briefing-remove': return { h:'Plan retired', s:'', act:go('preps') };
    case 'debrief':       return { h:'Debrief recorded', s:clip(e.debrief && e.debrief.note, 104), act:go('mental') };
    case 'debrief-update':return { h:'Debrief updated', s:'', act:go('mental') };
    case 'lesson-add':    return { h:`New lesson · ${ls.title || ''}`, s:clip(ls.body, 104),
      act: ls.id ? { a:'open-lesson', id:ls.id } : go('coach') };
    case 'lesson-update': return { h:`Lesson updated${ls.title ? ` · ${ls.title}` : ''}`, s:clip(ls.body || ls.drill, 104),
      act: e.target ? { a:'open-lesson', id:e.target } : go('coach') };
    case 'lesson-remove': return { h:'Lesson retired', s:'', act:go('coach') };
    case 'kit':           return { h:'Practice kit marked owned',
      s:[...(e.add || []).map(k => KIT_LAB[k] || k),
         ...(e.remove || []).map(k => `${KIT_LAB[k] || k} removed`)].join(' · '),
      act:go('drills') };
    case 'deadline':      return { h: e.date ? 'Return deadline set' : 'Return deadline cleared', s:'', act:go('decisions') };
    default:              return { h:`Update · ${e.type || 'change'}`, s:'', act:null };
  }
}

// When a change happened. Feed ids carry the date they were appended by convention
// (`plan-short-putts-20260814-v8`), and that is exactly the date a changelog wants — the
// day the change was made. It beats the entry's own `date`, which means different things
// per type: the day a round was played, the day film was shot, or on a briefing the day of
// a round that may not have happened yet. Undated id, no date field: it landed today.
function entryDate(e){
  const m = /(20\d{2})(\d{2})(\d{2})/.exec(e.id || '');
  if(m) return `${m[1]}-${m[2]}-${m[3]}`;
  return e.date || (e.round && e.round.date) || (e.briefing && e.briefing.date) || today();
}

// One row of the log. Newest first, capped — this is a "what changed" list, not an
// archive; the plans, the bag and the cards are where the change itself lives.
// A day's work used to be a handful of entries. Putting a location on file for every
// course he has played is 45 in one push, and at a cap of 40 that one batch would have
// evicted the entire log behind it — the changelog would have recorded the supporting
// data and lost the change it was supporting. The cap exists to stop the list growing
// forever, not to ration a busy day, so it is set well above one.
const UPDATE_CAP = 120;
function recordUpdate(e){
  const l = updateLine(e);
  if(!l) return;
  S.updates.unshift({ id:e.id, t:e.type, d:entryDate(e), h:l.h, s:l.s || '', act:l.act || null });
  if(S.updates.length > UPDATE_CAP) S.updates.length = UPDATE_CAP;
}

// First run on a phone that has already applied the whole feed: without this the block
// would open empty on the one install that has the most history behind it. The feed is
// append-only, so its TAIL is the most recent work — replay that much of it as already
// seen, with no applied-on date, because this device genuinely doesn't know when it
// landed and inventing one would be worse than saying nothing.
function backfillUpdates(feed){
  const entries = (feed.entries || []).filter(e => e.id && S.feedApplied.includes(e.id));
  // Replayed oldest→newest and unshifted, so the newest ends up on top with no reversing.
  // Half the cap, so the first render is a readable recap rather than a wall, and there is
  // room for what arrives next before anything gets pushed off the bottom.
  entries.slice(-Math.floor(UPDATE_CAP / 2)).forEach(recordUpdate);
  // These are not news — they are what he has already been running for weeks. Same for
  // the release notes of builds before this one. So the backfill marks all of it seen,
  // and the "N new" banner on the first render after an upgrade counts only what genuinely
  // is new: this build's notes, plus whatever the feed pushes from here on.
  S.settings.seenUpdates = S.updates.map(u => u.id)
    .concat(RELEASES.filter(r => r.b !== BUILD).map(r => `build:${r.b}`));
  S.updatesInit = true;
}

function applyFeed(feed){
  let changed = false;
  // Building the log for the first time is itself a change worth persisting and redrawing:
  // on a phone that has already applied the whole feed nothing else here will be, and
  // without this the What's new block would stay empty until the next push arrived.
  if(!S.updatesInit){ backfillUpdates(feed); changed = true; }
  (feed.entries || []).forEach(e => {
    if(!e.id || S.feedApplied.includes(e.id)) return;
    if(e.type === 'session') S.sessions.push({ date:e.date, setup:e.setup, finding:e.finding, detail:e.detail, _fid:e.id });
    else if(e.type === 'session-update'){
      const s = S.sessions.find(x => x._fid === e.target) ||
                S.sessions.find(x => e.setupMatch && (x.setup||'').startsWith(e.setupMatch));
      if(s){ if(e.setup) s.setup = e.setup; if(e.finding) s.finding = e.finding; if(e.detail) s.detail = e.detail; }
    }
    // Remove by feed id, or — for seed()'s own baseline sessions, which have no `_fid` —
    // by a `setupMatch` prefix optionally narrowed by `date`. session-update already
    // matches both ways; without the same on remove, the seeded rows could never be
    // deleted at all, which is what the Aug 14 pre-LINK clear-out ran into.
    else if(e.type === 'session-remove'){
      S.sessions = S.sessions.filter(x => {
        if(e.target && x._fid === e.target) return false;
        if(e.setupMatch && (x.setup || '').startsWith(e.setupMatch)
           && (!e.date || x.date === e.date)) return false;
        return true;
      });
    }
    else if(e.type === 'evolution' && e.evolution) S.evolution = e.evolution;
    else if(e.type === 'club-add' && e.club) S.clubs.push({ id:e.id, rounds:0, ...e.club });
    else if(e.type === 'club-update'){
      const c = S.clubs.find(x => x.id === e.target || x.name === e.target);
      if(c) Object.assign(c, e.club || {});
    }
    else if(e.type === 'history') S.bagHistory.unshift({ date:e.date, text:e.text });
    else if(e.type === 'history-edit'){
      const h = S.bagHistory.find(x => e.match && x.text.includes(e.match));
      if(h && e.text) h.text = e.text;
    }
    else if(e.type === 'carries' && Array.isArray(e.carries) && !S.carriesCalibrated) S.carries = e.carries;
    else if(e.type === 'carry-update' && e.target){
      // Row-level, and deliberately NOT gated on carriesCalibrated. The ladder doubles as
      // the club ROSTER — it is what the live logger offers off the tee — so which clubs
      // are in it must stay maintainable after Jack has calibrated the numbers. He owns
      // the carries; what's in the bag is a coaching update. A whole-ladder `carries`
      // entry would silently do nothing here and leave a retired club on the tee chips.
      const i = S.carries.findIndex(c => c.club === e.target);
      if(e.remove){ if(i >= 0) S.carries.splice(i, 1); }
      else if(e.club){
        if(i >= 0) Object.assign(S.carries[i], e.club);
        else {
          const at = e.after ? S.carries.findIndex(c => c.club === e.after) : -1;
          S.carries.splice(at >= 0 ? at + 1 : S.carries.length, 0,
            { club:e.target, loft:'', carry:null, ...e.club });
        }
      }
    }
    else if(e.type === 'course-add' && e.course && !S.courses.some(c => c.name === e.course.name))
      S.courses.push({ id:e.id, rating:null, pr:null, bucket:false, notes:'', ...e.course });
    else if(e.type === 'course-remove') S.courses = S.courses.filter(c => c.name !== e.target);
    // A published scorecard, pushed as data. This is how a card gets added or corrected
    // without shipping a build, so it outranks the course-cards.js baseline — and it is
    // checked on the way in exactly like the baseline is, because a card that doesn't
    // reconcile is a typo and a typo here renders as fact.
    else if(e.type === 'layout' && e.layout && e.layout.course){
      const c = e.layout;
      if(typeof courseCardOK === 'undefined' || courseCardOK(c)){
        S.layouts = (S.layouts || []).filter(x =>
          !(x.course === c.course && (x.nine || null) === (c.nine || null)));
        S.layouts.push({ id:e.id, ...c });
      }
    }
    // Where a course IS. Same shape of thing as a scorecard — a researched fact about the
    // world that the app cannot work out for itself — so it arrives the same way, carries
    // its source and its precision, and replaces any earlier fix for that course.
    else if(e.type === 'geo' && e.geo && e.geo.course
            && typeof e.geo.lat === 'number' && typeof e.geo.lon === 'number'
            && Math.abs(e.geo.lat) <= 90 && Math.abs(e.geo.lon) <= 180){
      S.geo = (S.geo || []).filter(g => !courseMatches(g.course, e.geo.course));
      S.geo.push({ id:e.id, ...e.geo });
    }
    else if(e.type === 'stats' && e.stats){
      if(e.replaces) S.stats = S.stats.filter(x => x.id !== e.replaces);
      if(!S.stats.some(x => x.id === e.id)) S.stats.push({ id:e.id, ...e.stats });
      S.stats.sort((a,b) => (a.date||'').localeCompare(b.date||''));
    }
    else if(e.type === 'round' && e.round){
      // Two guards, because there are two ways to get the same round twice: the same feed
      // entry re-applying, and a round Jack already logged live arriving again as a feed
      // entry. The second one silently double-counts every stat, so it matches on the
      // round itself rather than on the entry id.
      if(!S.rounds.some(r => r.feedId === e.id) && !sameRound(S.rounds, e.round))
        S.rounds.push({ feedId:e.id, troubles:[], putts:null, note:'', ...e.round });
    }
    else if(e.type === 'round-update' && e.round){
      // Backfills a live-logged card with what the phone couldn't know on the course —
      // course rating and slope, most of all, without which there's no differential.
      const r = sameRound(S.rounds, e.round);
      if(r){
        const { holes, force, ...rest } = e.round;
        // Live cards take precedence over anything fed in afterwards: he recorded that
        // card standing on the hole, and a summary arriving later is the weaker witness.
        // So on a live card an update FILLS GAPS — rating, slope, tees, the fields the
        // phone couldn't know — and leaves everything he logged alone. Correcting a value
        // he actually recorded is still possible, but it has to be deliberate:
        // `"force": true` on the entry, which is a decision rather than an accident.
        if(r.live && !force){
          Object.keys(rest).forEach(k => { if(r[k] == null || r[k] === '') r[k] = rest[k]; });
        } else Object.assign(r, rest);
        if(Array.isArray(holes) && Array.isArray(r.holes)){
          holes.forEach(h => {
            const hit = r.holes.find(x => x.n === h.n);
            // A hole he never scored was never played — `liveRound()` drops those on the
            // way in. So an entry naming a hole the card doesn't have only ADDS it if it
            // brings a score with it; otherwise it is a correction to a hole that isn't
            // there and is ignored. Without this, a card-wide par fix sent to a round he
            // walked in from after fourteen holes would append the four he never played
            // and quietly restate the round as a full eighteen.
            if(hit) Object.assign(hit, h);
            else if(h.s != null) r.holes.push(h);
          });
          r.holes.sort((a, b) => a.n - b.n);
          // Correcting a hole has to move the card's total with it, or the header and the
          // hole-by-hole table start telling different stories. An explicit total wins.
          if(rest.score == null && r.holes.every(h => h.s != null))
            r.score = r.holes.reduce((a, h) => a + h.s, 0);
          if(rest.par == null && r.holes.every(h => h.par != null))
            r.par = r.holes.reduce((a, h) => a + h.par, 0);
        }
      }
    }
    else if(e.type === 'test' && e.test) S.tests.push({ date:e.test.date || null, putter:e.test.putter, makes:e.test.makes, note:e.test.note || '' });
    else if(e.type === 'briefing' && e.briefing){
      S.briefings = S.briefings.filter(b => b.id !== e.id && b.id !== e.replaces &&
        // standing plans (undated) are singletons per title — newest wins
        !(!e.briefing.date && !b.date && b.course === e.briefing.course));
      S.briefings.push({ id:e.id, ...e.briefing });
    }
    else if(e.type === 'briefing-remove') S.briefings = S.briefings.filter(b => b.id !== e.target);
    // Coach lessons patch the same way plans do. `lessons.js` stays the frozen baseline;
    // these three are the live layer, so every lesson change carries a dated trail instead
    // of silently overwriting the file. Patches accumulate, so two updates to one lesson
    // both survive. An update naming a lesson that doesn't exist is left unapplied on
    // purpose — a typo'd target does nothing rather than inventing a lesson.
    else if(e.type === 'lesson-update' && e.target && e.lesson){
      const known = (typeof LESSONS !== 'undefined' ? LESSONS : []).some(l => l.id === e.target)
        || (S.lessonAdds || []).some(l => l.id === e.target);
      if(known) S.lessonEdits[e.target] = { ...(S.lessonEdits[e.target] || {}), ...e.lesson };
    }
    else if(e.type === 'lesson-add' && e.lesson && e.lesson.id){
      S.lessonAdds = (S.lessonAdds || []).filter(l => l.id !== e.lesson.id).concat([e.lesson]);
      S.lessonHidden = (S.lessonHidden || []).filter(id => id !== e.lesson.id);
    }
    else if(e.type === 'lesson-remove' && e.target){
      if(!S.lessonHidden.includes(e.target)) S.lessonHidden.push(e.target);
    }
    // Kit through the feed is Jack's own declaration RELAYED — "got this for at home
    // practice" said in chat is him marking the chip, the same as tapping it on the bench.
    // Nothing else may write S.kit: reading a lesson about a yardstick is still not
    // evidence he owns one, and no entry is ever sent on an inference.
    else if(e.type === 'kit'){
      (e.add || []).forEach(k => { if(!S.kit.includes(k)) S.kit.push(k); });
      if(Array.isArray(e.remove)) S.kit = S.kit.filter(k => !e.remove.includes(k));
    }
    // A debrief Jack RECOUNTED rather than typed. Same schema as the in-app form, and the
    // entry id becomes the debrief id so the × still deletes it and an update can find it.
    else if(e.type === 'debrief' && e.debrief){
      if(!S.mental.some(d => d.id === e.id)) S.mental.push({ id:e.id, triggers:[], when:[], ...e.debrief });
    }
    else if(e.type === 'debrief-update'){
      const d = S.mental.find(x => x.id === e.target); if(d && e.debrief) Object.assign(d, e.debrief);
    }
    else if(e.type === 'shortlist' && Array.isArray(e.shortlist)){
      const demoed = new Set(S.shortlist.filter(p=>p.demoed).map(p=>p.name));
      S.shortlist = e.shortlist.map(p => ({ ...p, demoed: demoed.has(p.name) }));
    }
    else if(e.type === 'action') S.actions.push({ id:e.id, text:e.text, done:false, pri:!!e.pri });
    else if(e.type === 'action-done'){ const a = S.actions.find(x => x.id === e.target); if(a) a.done = true; }
    else if(e.type === 'action-update'){ const a = S.actions.find(x => x.id === e.target); if(a && e.text) a.text = e.text; }
    else if(e.type === 'faults' && Array.isArray(e.faults)){
      // A discipline-scoped entry replaces only that discipline's faults, so pushing swing
      // faults can't wipe the putting ones. No discipline = replace everything (old entries).
      const disc = e.discipline;
      const tagged = e.faults.map(f => disc ? { discipline:disc, ...f } : f);
      S.faults = disc ? S.faults.filter(f => faultDisc(f) !== disc).concat(tagged) : tagged;
    }
    else if(e.type === 'deadline'){ S.settings.returnDeadline = e.date; S.settings.deadlineEstimated = false; }
    else return; // unknown type: leave unapplied so a newer app version can pick it up
    S.feedApplied.push(e.id);
    recordUpdate(e);
    changed = true;
  });
  if(changed){ save(); rerender(); toast('Coach update from Claude ⛳'); }
}
function fetchFeed(){
  fetch('./coach-feed.json', { cache:'no-store' })
    .then(r => r.ok ? r.json() : null)
    .then(f => { if(f) applyFeed(f); })
    .catch(()=>{}); // offline — try again next open
}

// ---------- Boot ----------
load(); save();
applyTheme();
render('home');
fetchFeed();
if(S.weather) fetchWeather();  // silent refresh only if previously enabled
// iOS resumes a suspended PWA without reloading the page — re-check the
// coach feed whenever the app comes back to the foreground.
document.addEventListener('visibilitychange', () => {
  if(document.visibilityState !== 'visible') return;
  fetchFeed();
  // Coming back to a suspended app is the one moment it's certain to be running old
  // code, so check for a new BUILD too — the feed only carries data, and a fix to the
  // app itself has no other route onto the phone. index.html reloads once if one lands.
  if(navigator.serviceWorker) navigator.serviceWorker.getRegistration()
    .then(r => r && r.update()).catch(() => {});
});
})();
