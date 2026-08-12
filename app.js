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
    briefings: [],        // {id, course, date, focus, sections:[{t,b}]} — pushed by Claude pre-round
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
  if(s.live === undefined) s.live = null;   // a round being logged hole-by-hole
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
// Lead sentence up front, the rest one tap away.
function expandable(t, cls){
  const [lead, rest] = splitLead(t);
  const c = cls || 'sm';
  return rest ? `<p class="${c}">${esc(lead)}</p>
    <details class="more"><summary>Read the rest</summary>${prose(rest, c)}</details>`
    : `<p class="${c}">${esc(lead)}</p>`;
}
function readMins(b){
  const w = (b.sections || []).reduce((n, s) => n + String(s.b || '').split(/\s+/).length, 0);
  return Math.max(1, Math.round(w / 220));
}
function today(){ return new Date().toISOString().slice(0,10); }
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
  S.rounds.slice(-3).forEach(r => r.troubles.forEach(t =>
    tags.set(t, `logged at ${r.course || 'your round'} on ${fmtDate(r.date)}`)));
  const mc = missCounts();
  if (mc.L > mc.R) tags.set('short-putts', `${mc.L} left misses in your 5-ft logs`);
  S.faults.forEach(f => tags.set(f.tag, f.why));
  return tags;
}
function pickedLessons(){
  const tags = struggles();
  return LESSONS
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
  LESSONS.forEach(l => {
    by[l.shelf] = by[l.shelf] || { n:0, forYou:0 };
    by[l.shelf].n++;
    if (l.tags.some(t => tags.has(t)) && !S.lessonsRead.includes(l.id)) by[l.shelf].forYou++;
  });
  return by;
}
// ----- The playable club list -----
// This comes from the CARRY LADDER, not S.clubs: the bag holds the irons as a single
// "KING TEC 4–PW" entry, so it can't name the club that actually hit a shot. The ladder
// is the real 13-club list and is already ordered longest to shortest. A hole stores the
// key, never the label, so renaming a ladder row can't orphan old cards — an unknown key
// falls back to printing itself.
function clubKey(name){
  return String(name).toLowerCase().replace(/\(.*?\)/g, '').replace(/°/g, '')
    .trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
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
    return { lab, hit: S.drillDays.includes(d.toISOString().slice(0,10)) };
  });
}

// ---------- Renderers ----------
const TITLES = {
  home:['Caddie HQ','Your bag, your stroke, your game — one book.'],
  bag:['My Bag','Every club, every spec, and the story of every change.'],
  swing:['Swing Lab','Driver to wedge — film, plans, and speed work.'],
  positions:['Swing Positions','Where the body goes, address to finish.'],
  putting:['Putting Lab','The left-miss project — tracked until it’s dead.'],
  coach:['Coach','Lessons that follow your game — not generic tips.'],
  courses:['Courses','Everywhere you’ve played, rated and remembered.'],
  decisions:['Decisions','Equipment calls made with data, not vibes.'],
  scores:['Scores','Every round, what it cost you, and what to fix.'],
  data:['Data & Backup','Your data lives on this device — export it anywhere.'],
  session:['Film Breakdown','Frame-by-frame findings from this session.'],
  briefing:['Round Prep','Course knowledge, tuned to your game.'],
  round:['Round Detail','One card, hole by hole, and what it cost you.'],
  live:['Live Round','Tap it in as you play — it scores itself.'],
  preps:['Round Prep','Every course plan, kept for the next time.'],
};

function render(view, arg, keepScroll){
  current = { view, arg };
  const [title, tag] = TITLES[view] || TITLES.home;
  $('#pageTitle').textContent = title;
  $('#pageTag').textContent = tag;
  document.querySelectorAll('#nav button').forEach(b =>
    b.classList.toggle('on', b.dataset.view === view));
  const R = { home, bag, swing, positions:swingPositions, putting, coach, courses, decisions, scores, data:dataView, shelf, lesson, session:sessionView, briefing, round:roundView, live, preps }[view] || home;
  $('#view').innerHTML = R(arg);
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
  view.prepend(bar);
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
    standing: S.briefings.filter(b => !b.date && b.course && known.some(n => courseMatches(b.course, n))),
    past: S.briefings.filter(b => b.date && b.date < t)
      .sort((a, b) => (b.date || '').localeCompare(a.date || '')),
  };
}
function planRow(b){
  const t = today();
  const tag = !b.date ? 'standing plan' : b.date < t ? `played · ${fmtDate(b.date)}` : fmtDate(b.date);
  const holes = (b.holes || []).filter(h => h && (h.play || h.note || (h.why || []).length)).length;
  return `<div class="linkrow" data-action="open-briefing" data-id="${b.id}">
    <span><b>${esc(b.course)}</b><span class="sm faint"> · ${tag}${holes ? ` · ${holes} hole notes` : ''}</span><br>
    <span class="sm clip2">${esc(b.focus || 'Briefing ready')}</span></span><span class="arr">→</span></div>`;
}
function preps(){
  const p = coursePlans();
  const block = (title, list, note) => !list.length ? '' : `
    <h2>${title}</h2>
    <div class="card">${list.map(planRow).join('')}
      ${note ? `<p class="sm faint" style="margin-top:8px">${note}</p>` : ''}</div>`;
  const any = p.up.length + p.standing.length + p.past.length;
  return `
  <button class="backlink" data-action="go" data-view="home">← Home</button>
  ${!any ? `<div class="card"><p class="sm">No course plans yet. Tell Claude where you're playing and one lands here — tee strategy, the holes that cost you, lay-up numbers off your ladder, and a note on every hole the research can support.</p></div>` : ''}
  ${block('Coming up', p.up)}
  ${block('Standing course plans', p.standing,
    "These don't expire — course knowledge keeps. Each one's hole notes surface on that hole while you're logging a live round there.")}
  ${block('Played', p.past, 'Kept for the next time you go back.')}`;
}

// ----- Home -----
function home(){
  const dl = daysLeft(S.settings.returnDeadline);
  const idx = estIndex();
  const pending = pendingReturn();
  const last = latestFiveFt();
  const sc = last ? fiveFtScore(last) : null;
  const picks = pickedLessons().slice(0,1);
  const wedges = S.clubs.filter(c => c.cat==='wedge' && c.status==='gaming');
  const worstWedge = wedges.sort((a,b)=>groovePct(a)-groovePct(b))[0];
  return `
  ${liveBanner()}
  <div class="rowgrid">
    <div class="stat"><div class="v">${esc(S.profile.handicap)}</div><div class="l">Handicap</div></div>
    <div class="stat"><div class="v">${S.courses.filter(c=>!c.bucket).length}</div><div class="l">Courses</div></div>
    <div class="stat"><div class="v">${sc ? sc.makes+'/'+sc.total : '—'}</div><div class="l">5-ft makes</div></div>
    <div class="stat"><div class="v">${idx != null ? idx.toFixed(1) : '—'}</div><div class="l">Est. index</div></div>
  </div>



  ${(() => {
    const p = coursePlans();
    const next = [...p.up, ...p.standing, ...p.past][0];
    const rest = p.up.length + p.standing.length + p.past.length - (next ? 1 : 0);
    return `<div class="card">
      <h2>Round prep</h2>
      ${next ? planRow(next)
      : `<p class="sm">Playing somewhere soon? Tell Claude the course and day — a briefing built for <i>your</i> game (tee strategy, key holes, lay-up numbers off your ladder, greens notes) lands here before the round. Your standing plans (Swing Focus, Golf Mind, Miracle 201) live in the <b>Swing</b> lab.</p>`}
      ${rest > 0 ? `<div class="linkrow" data-action="go" data-view="preps">
        <span class="sm"><b>All round prep</b> · ${rest} more plan${rest === 1 ? '' : 's'} on file</span><span class="arr">→</span></div>` : ''}
      ${S.live ? '' : `<div class="linkrow" data-action="live-new" style="border-bottom:none;padding-bottom:0">
        <span><b>Play a live round</b><br><span class="sm">Tap each hole in as you go — clubs, fairways, greens, putts</span></span><span class="arr">→</span></div>`}
    </div>`;
  })()}

  <h2>The numbers</h2>
  <div class="rowgrid g2">
    <div class="charttile"><div class="lab">5-ft makes · trend</div>
      <div class="big">${sc ? sc.makes+'/'+sc.total : '—'}</div>
      <div style="color:var(--gtext)">${spark(S.fiveFt.map(e=>fiveFtScore(e).makes))}</div>
      <div class="sub">goal: 17/20</div></div>
    <div class="charttile"><div class="lab">Round scores</div>
      <div class="big">${S.rounds.length ? (S.rounds.filter(r=>r.score).slice(-1)[0]?.score ?? '—') : '—'}</div>
      <div style="color:var(--btext)">${spark(S.rounds.map(r=>r.score).filter(Boolean))}</div>
      <div class="sub">${S.rounds.length} logged</div></div>
    <div class="charttile"><div class="lab">Carry ladder</div>
      <div class="big">${S.carries[0]?.carry ?? '—'}<span style="font-size:11px"> yd top</span></div>
      <div style="color:var(--gtext)">${spark(S.carries.map(c=>c.carry).filter(Boolean))}</div>
      <div class="sub">${S.carriesCalibrated ? 'calibrated' : 'estimated'} · 13 clubs</div></div>
    <div class="charttile" data-action="get-weather" style="cursor:pointer"><div class="lab">Conditions</div>
      ${S.weather && playsFactor() ? `
      <div class="big">${WX_ICON(S.weather.code)} ${Math.round(S.weather.t)}°F</div>
      <div class="sub">wind ${Math.round(S.weather.wind)} mph</div>
      <div class="sub" style="margin-top:4px;color:var(--btext);font-weight:700">150 plays ~${Math.round(150/playsFactor())}</div>`
      : `<div class="big">—</div><div class="sub">tap to load local weather<br>+ "plays like" carries</div>`}
    </div>
  </div>

  ${picks.length ? `<div class="card">
    <h2>From your coach today</h2>
    ${picks.map(p => tipHTML(p)).join('')}
    <button class="btn ghost tiny" data-action="go" data-view="coach">All lessons →</button>
  </div>` : ''}

  ${worstWedge ? `<div class="card">
    <h2>Gear intelligence</h2>
    <h3>${esc(worstWedge.name)} grooves at ${groovePct(worstWedge)}% life</h3>
    <div class="meter grn"><span style="width:${groovePct(worstWedge)}%"></span></div>
    <p class="sm">Spin drops noticeably below ~50% (${GROOVE_LIFE}-round life). Grips: round ${S.settings.gripRounds} of ~${GRIP_LIFE} before regrip. Both counters advance automatically when you log rounds.</p>
  </div>` : ''}

  <div class="card">
    <h2>Open actions</h2>
    <ul class="check">
      ${S.actions.map(a => `<li class="${a.done?'done':''}" data-action="toggle-action" data-id="${a.id}">
        <span class="box"></span><span class="txt">${esc(a.text)}${a.pri && !a.done ? '<span class="pri">HIGH</span>':''}</span></li>`).join('')}
    </ul>
    <div class="formrow" style="margin-top:10px">
      <input id="newAction" placeholder="Add an action item…">
      <button class="btn ghost" data-action="add-action">Add</button>
    </div>
  </div>

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
function bag(){
  // Order the bag the way it sits in real life: driver → woods → hybrids →
  // irons → wedges → putter, then by loft within each category.
  const CAT_RANK = { wood:0, hybrid:1, iron:2, wedge:3, putter:4, ball:5, other:6 };
  const clubLoft = c => {
    if(typeof c.loft === 'number') return c.loft;
    const deg = ((c.spec||'') + ' ' + (c.name||'')).match(/(\d+(?:\.\d+)?)\s*°/);
    if(deg) return parseFloat(deg[1]);
    const iron = (c.name||'').match(/(\d+)\s*-?\s*iron/i);   // "2-iron" sorts ahead of the 4–PW set
    if(iron) return 15 + parseInt(iron[1],10) * 3.5;
    return 999;
  };
  const bagSort = (a,b) => (CAT_RANK[a.cat] ?? 5) - (CAT_RANK[b.cat] ?? 5) || clubLoft(a) - clubLoft(b);
  const lineup = S.clubs.filter(c => c.status==='gaming' || c.status==='ordered').sort(bagSort);
  const bullpen = S.clubs.filter(c => c.status==='backup').sort(bagSort);
  const wishlist = S.clubs.filter(c => c.status==='wishlist').sort(bagSort);
  const wedges = S.clubs.filter(c=>c.cat==='wedge' && c.loft).sort((a,b)=>a.loft-b.loft);
  return `
  <h2>The starting lineup · in the bag now</h2>
  ${lineup.length ? lineup.map(clubCard).join('') : '<p class="sm faint">Nothing gaming yet.</p>'}
  ${bullpen.length ? `<h2>The bullpen · owned, not in the 14</h2>
  ${bullpen.map(clubCard).join('')}` : ''}
  ${wishlist.length ? `<h2>Scouting list</h2>
  ${wishlist.map(clubCard).join('')}` : ''}
  <div class="formrow" style="margin-top:6px">
    <button class="btn" data-action="show-add-club">+ Add a club</button>
  </div>
  <div id="addClubForm" class="card" style="display:none">
    <h2>New club</h2>
    <label>Name</label><input id="clNa" placeholder="e.g. TaylorMade Qi35 driver">
    <div class="formrow">
      <div><label>Category</label><select id="clCat"><option value="wood">Driver / wood</option><option value="hybrid">Hybrid</option><option value="iron">Irons</option><option value="wedge">Wedge</option><option value="putter">Putter</option><option value="ball">Ball</option><option value="other">Other</option></select></div>
      <div><label>Status</label><select id="clSt"><option value="gaming">Starting lineup</option><option value="ordered">On order</option><option value="backup">Bullpen</option><option value="wishlist">Scouting list</option></select></div>
    </div>
    <label>Specs (loft, shaft, flex…)</label><input id="clSp" placeholder="e.g. 9° · Ventus Blue 6S">
    <label>Notes</label><input id="clNo" placeholder="Why it's in the bag">
    <div style="margin-top:10px"><button class="btn" data-action="add-club">Save club</button></div>
  </div>

  <h2>Full-bag distance ladder</h2>
  <div class="card">
    ${S.carriesCalibrated ? '' : `<p class="sm"><span class="warn">Estimated</span> for your game until you calibrate — edit any number as real carries come in from the range or course.</p>`}
    <table><tr><th>Club</th><th>Loft</th><th>Carry</th>${playsFactor() ? '<th>Today</th>' : ''}<th>Gap</th></tr>
      ${S.carries.map((c,i) => {
        const next = S.carries[i+1];
        const gap = next && c.carry && next.carry ? c.carry - next.carry : null;
        const pf = playsFactor();
        return `<tr><td><b>${esc(c.club)}</b></td><td class="sm faint">${esc(c.loft)}</td>
          <td><input data-carry="${i}" inputmode="numeric" style="width:58px;text-align:center;padding:5px 4px" value="${c.carry ?? ''}"></td>
          ${pf ? `<td class="sm" style="color:var(--btext);font-weight:700">${c.carry ? Math.round(c.carry*pf) : '—'}</td>` : ''}
          <td class="sm ${gap!==null && (gap>=20||gap<=5) ? 'warn':'faint'}">${gap!==null ? gap+' yd' : '—'}</td></tr>`;
      }).join('')}
    </table>
    ${playsFactor() ? `<p class="sm faint">"Today" = carry adjusted for ${Math.round(S.weather.t)}°F air (${playsFactor()>1?'+':''}${((playsFactor()-1)*100).toFixed(1)}%).</p>` : ''}
    <button class="btn ghost tiny" data-action="save-carries">Save carries</button>
    <p class="sm faint" style="margin-top:8px">Gap flags: over 20 yd = a hole in the bag · 5 yd or less = two clubs fighting for one number. Watch the mini → 2-iron → 4-iron stack.</p>
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

  <h2>Change history</h2>
  <div class="card">
    <table><tr><th>When</th><th>What & why</th></tr>
    ${S.bagHistory.map(h => `<tr><td style="white-space:nowrap">${esc(h.date)}</td><td>${esc(h.text)}</td></tr>`).join('')}
    </table>
    <div class="formrow" style="margin-top:8px">
      <input id="newHist" placeholder="Log a change (what & why)…">
      <button class="btn ghost" data-action="add-history">Log it</button>
    </div>
  </div>`;
}

function clubCard(c){
  const flags = { gaming:['GAMING','f-ok'], ordered:['ON ORDER','f-new'], backup:['BACKUP','f-warn'], wishlist:['WISHLIST','f-new'] };
  const mismatch = c.cat==='putter' && c.flow==='toe' && S.profile.stroke==='SBST';
  const [txt, cls] = mismatch ? ['MISMATCH','f-burg'] : (flags[c.status]||['','f-ok']);
  const groove = c.cat==='wedge' && c.status==='gaming'
    ? `<div class="meter grn" title="groove life"><span style="width:${groovePct(c)}%"></span></div>
       <div class="sm faint">Groove life ${groovePct(c)}% · ${c.rounds||0} rounds</div>` : '';
  return `<div class="clubcard"><div class="flag ${cls}">${txt}</div>
    <div class="name">${esc(c.name)}</div>
    <div class="spec">${esc(c.spec||'')}</div>
    ${c.note ? `<div class="note">${esc(c.note)}</div>` : ''}
    ${mismatch ? `<div class="note warn">Toe-flow head on your straight (SBST) stroke — see Decisions.</div>` : ''}
    ${groove}
  </div>`;
}

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
  return /full[\s-]?swing|driver|\biron\b|\bwedge\b|mini/i.test(s.setup || '') ? 'swing' : 'putting';
}

// ----- Lab plan blocks -----
// Pre-shot routines head every lab: they're what you read standing on the first tee,
// so they sit above the diagnosis and the drills rather than buried under them.
const isRoutine = b => /routine/i.test(b.course || '');
function planLinks(list){
  return list.map(b => `<div class="linkrow" data-action="open-briefing" data-id="${b.id}">
      <span><b>${esc(b.course)}</b><br><span class="sm clip2">${esc(b.focus || 'Plan ready')}</span></span><span class="arr">→</span></div>`).join('');
}
function routineBlock(plans){
  const r = plans.filter(isRoutine);
  return r.length ? `<h2>Pre-round · routine</h2>
  <div class="card">${planLinks(r)}</div>` : '';
}

// ----- Swing Lab -----
function swing(){
  const sessions = S.sessions.map((s,i) => ({ s, i })).filter(o => sessionDiscipline(o.s) === 'swing').reverse();
  const plans = S.briefings.filter(b => !b.date && (b.discipline || 'swing') !== 'putting');
  const other = plans.filter(b => !isRoutine(b));
  return `
  ${routineBlock(plans)}

  <div class="card flat"><div class="linkrow" data-action="go" data-view="positions">
    <span><b>📐 Swing Positions · visual guide</b><br><span class="sm">Body checkpoints, address → finish, with a slide-vs-clear hip diagram</span></span><span class="arr">→</span></div></div>

  ${other.length ? `<h2>Plans &amp; training</h2>
  <div class="card">
    ${planLinks(other)}
  </div>` : ''}

  <h2>Film room</h2>
  <div class="card">
    ${sessions.length ? `<p class="sm faint" style="margin-bottom:4px">Tap a session for the full breakdown.</p>
    <table><tr><th>Date</th><th>Setup</th><th>Finding</th></tr>
    ${sessions.map(({s,i}) => `<tr data-action="open-session" data-i="${i}" style="cursor:pointer"><td style="white-space:nowrap">${fmtDate(s.date)} ${s.detail?'<span class="faint">▸</span>':''}</td><td class="sm">${esc(s.setup)}</td><td class="sm">${esc(s.finding)}</td></tr>`).join('')}
    </table>` : '<p class="sm">No swing sessions logged yet. Send Claude swing clips — down-the-line and face-on — and the breakdowns land here.</p>'}
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
    <p class="sm" style="margin-top:8px">Your tendency is <b class="warn">across the line</b> — at the top the shaft points right of the target. The fix is Fix 1: feel the <b>trail elbow lead down</b> and the shaft drops back <b style="color:var(--gtext)">on line</b>. The one-handed Miracle 201 drop trains this directly.</p>
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
  const streak = weekStreak();
  const plans = S.briefings.filter(b => !b.date && b.discipline === 'putting');
  const other = plans.filter(b => !isRoutine(b));
  return `
  ${routineBlock(plans)}

  <div class="card">
    <h2>The diagnosis</h2>
    <p class="sm"><b>Two levers behind the left miss:</b> (1) equipment — max-toe-flow putter + toe-up lie on a confirmed <b>straight SBST stroke</b>; (2) mechanics — face closes through impact, timing-dependent. Fix: zero-torque head at 34" + lie set flat + the two drills below.</p>
  </div>

  ${other.length ? `<h2>Plans</h2><div class="card">${planLinks(other)}</div>` : ''}

  <h2>Drills · this week</h2>
  <div class="card">
    <div class="tipcard green"><div class="src">Fixes tempo</div><h4>"One-Two" tempo drill</h4>
      <p class="sm">Steady count — backswing longer & slower. Metronome ~70–76 bpm. Target 2:1.</p></div>
    <div class="tipcard green"><div class="src">Fixes lift + face</div><h4>Low-follow-through gate</h4>
      <p class="sm">Tee 6" ahead on the line — chase past it low. Kills the lift, quiets the toe-over.</p></div>
    <button class="btn" data-action="drill-done">Mark today's drill done</button>
    <div class="streak">${streak.map(d=>`<div class="day ${d.hit?'hit':''}">${d.lab}</div>`).join('')}</div>
  </div>

  <h2>Stroke evolution · every session, one view</h2>
  <div class="card">
    <table><tr><th></th>${S.evolution.sessions.map(x=>`<th style="text-align:center">${esc(x)}</th>`).join('')}</tr>
    ${S.evolution.metrics.map(m => `<tr><td class="sm" style="white-space:nowrap"><b>${esc(m.name)}</b></td>
      ${m.marks.map(mk => `<td style="text-align:center;font-weight:800;color:${mk==='✓'?'var(--green)':mk==='✗'?'var(--burg)':'var(--faint)'}">${esc(mk)}</td>`).join('')}</tr>`).join('')}
    </table>
    ${S.evolution.metrics.map(m => `<p class="sm" style="margin-top:7px"><b style="color:${m.s==='good'?'var(--green)':m.s==='warn'?'var(--burg)':'var(--ink)'}">${esc(m.name)}:</b> ${esc(m.verdict)}</p>`).join('')}
    <p class="sm faint" style="margin-top:8px">✓ good · ✗ fault · ~ partial · ? that angle couldn't see it · — not assessed. BL = baseline re-analysis of the old clips.</p>
  </div>

  <h2>Stroke session log</h2>
  <div class="card">
    <p class="sm faint" style="margin-bottom:4px">Tap a session for the full film breakdown.</p>
    <table><tr><th>Date</th><th>Setup</th><th>Finding</th></tr>
    ${S.sessions.map((s,i) => ({s,i})).filter(o => sessionDiscipline(o.s) === 'putting').map(({s,i}) => `<tr data-action="open-session" data-i="${i}" style="cursor:pointer"><td style="white-space:nowrap">${fmtDate(s.date)} ${s.detail?'<span class="faint">▸</span>':''}</td><td class="sm">${esc(s.setup)}</td><td class="sm">${esc(s.finding)}</td></tr>`).join('')}
    </table>
    <details><summary>+ Log a session</summary>
      <label>Setup (angle · strokes)</label><input id="sesSetup" placeholder="e.g. 5 strokes · overhead, zero-torque demo">
      <label>Finding</label><input id="sesFind" placeholder="What the film showed">
      <div style="margin-top:10px"><button class="btn" data-action="add-session">Save session</button></div>
    </details>
  </div>

  <h2>Filming guide</h2>
  <div class="card flat">
    <p class="sm"><b>1 · Overhead</b> — the gold standard for path (this is what settled SBST).<br>
    <b>2 · Down-the-line</b> — behind the ball at hip height: start line, face at address.<br>
    <b>3 · Face-on</b> — waist height: posture, eyeline, tempo.<br>
    Film 3–5 strokes per angle so rep-to-rep patterns show.</p>
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
  const out = scoreTips(st).map(t => ({ sev:t.s, src:t.src, h:t.h, b:t.b, ev:t.ev, link:null }));
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
  S.faults.forEach(f => out.push({ sev:'mid', src:'Open fault', ev:'measured',
    h:f.tag.replace(/-/g,' ').replace(/^./, c => c.toUpperCase()), b:f.why,
    link:{ a:'go', view:'putting', lab:'Putting lab' } }));
  // Severity decides the band, evidence decides the order inside it — so the warnings
  // still lead, but within them his own rounds speak before a pasted season average.
  // Array.sort is stable, so scoreTips' evidence order survives this pass.
  const order = { warn:0, mid:1, good:2 };
  return out.sort((a,b) => order[a.sev] - order[b.sev]
    || EV_RANK[a.ev || 'snapshot'] - EV_RANK[b.ev || 'snapshot']);
}

function coach(){
  const st = scoreStats();
  const sig = coachSignals();
  const picks = pickedLessons();
  const counts = shelfCounts();
  const streak = weekStreak();
  const open = S.actions.filter(a => !a.done);
  const blow = st.mix.double * 2 + st.mix.triple * 3;
  const read = [];
  if(st.holes) read.push(`<b>${st.holes} holes</b> on record at ${(st.over/st.holes).toFixed(2)} a hole over par`);
  if(st.over > 0 && blow) read.push(`doubles and worse are <b>${Math.round(blow/st.over*100)}%</b> of everything you've lost`);
  const lf = latestFiveFt();
  if(lf) read.push(`<b>${fiveFtScore(lf).makes}/${fiveFtScore(lf).total}</b> from 5 feet last test`);
  const plans = S.briefings.filter(b => !b.date).sort((a,b) => (isRoutine(b) ? 1 : 0) - (isRoutine(a) ? 1 : 0));
  const linkFor = l => !l ? '' :
    `<div class="linkrow" data-action="${l.a}"${l.id ? ` data-id="${esc(l.id)}"` : ''}${l.view ? ` data-view="${l.view}"` : ''}>
       <span class="sm"><b>${esc(l.lab)}</b></span><span class="arr">→</span></div>`;
  return `
  <div class="card">
    <h2>The read</h2>
    ${read.length ? `<p class="sm">${read.join(' · ')}.</p>`
      : `<p class="sm">Nothing measured yet. Log a round below, or send Claude your GHIN summaries — the coaching on this page is built from your own numbers, so it stays blank until there are some.</p>`}
  </div>

  ${sig.length ? `<h2>Work on this · ranked</h2>
  <div class="card">
    ${sig.slice(0,6).map(t => `<div class="tipcard ${t.sev === 'good' ? 'green' : ''}">
      <div class="src">${esc(t.src)}${evTag(t.ev)}</div><h4>${t.h}</h4>${expandable(t.b)}
      ${linkFor(t.link)}</div>`).join('')}
    <p class="sm faint">Ranked by how good the evidence is: rounds you logged hole by hole lead, then what you've measured, then the GHIN summaries — those are somebody else's arithmetic over a season, so they speak last. Within that, the warnings come first.</p>
  </div>` : ''}

  ${open.length ? `<h2>Next actions</h2>
  <div class="card">
    <ul class="check">
      ${open.slice(0,6).map(a => `<li data-action="toggle-action" data-id="${a.id}">
        <span class="box"></span><span class="txt">${esc(a.text)}${a.pri ? '<span class="pri">HIGH</span>' : ''}</span></li>`).join('')}
    </ul>
  </div>` : ''}

  ${plans.length ? `<h2>Your plans</h2>
  <div class="card">
    ${plans.map(b => `<div class="linkrow" data-action="open-briefing" data-id="${b.id}">
      <span><b>${esc(b.course)}</b><br><span class="sm clip2">${esc(b.focus || 'Plan ready')}</span></span><span class="arr">→</span></div>`).join('')}
  </div>` : ''}

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
    <p class="sm faint" style="margin-top:8px">Hole-by-hole detail is what powers the ranking above — send Claude a GHIN round summary and it lands with every hole.</p>
    <div class="linkrow" data-action="live-new" style="border-bottom:none">
      <span class="sm"><b>${S.live ? 'Resume your live round' : 'Or play it live, hole by hole'}</b> — every detail, no typing</span><span class="arr">→</span></div>
  </div>

  ${S.rounds.length ? `<div class="card flat"><div class="linkrow" data-action="go" data-view="scores">
    <span><b>Score history &amp; analytics</b><br><span class="sm">${S.rounds.length} rounds · scoring mix, par splits, worst holes</span></span><span class="arr">→</span></div></div>` : ''}

  <h2>Keep the streak</h2>
  <div class="card">
    ${picks.length ? picks.map(tipHTML).join('') : '<p class="sm">Lessons matched to your struggles appear here as you log rounds.</p>'}
    <button class="btn" data-action="drill-done">Mark today's work done · keep streak</button>
    <div class="streak">${streak.map(d=>`<div class="day ${d.hit?'hit':''}">${d.lab}</div>`).join('')}</div>
  </div>

  <h2>The library · always open</h2>
  <div class="shelf-grid">
    ${Object.entries(counts).map(([name,c]) => `
      <div class="shelf" data-action="open-shelf" data-shelf="${esc(name)}">
        <div class="nm">${esc(name)}</div>
        <div class="ct">${c.n} lessons</div>
        ${c.forYou ? `<span class="new">${c.forYou} FOR YOU</span>` : ''}
      </div>`).join('')}
  </div>`;
}

function shelf(name){
  const tags = struggles();
  const items = LESSONS.filter(l => l.shelf === name);
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
  const l = LESSONS.find(x=>x.id===id);
  if(!l) return coach();
  if(!S.lessonsRead.includes(id)){ S.lessonsRead.push(id); save(); }
  return `
  <button class="backlink" data-action="open-shelf" data-shelf="${esc(l.shelf)}">← ${esc(l.shelf)}</button>
  <div class="card">
    <h2>${esc(l.shelf)} · ${l.min} min</h2>
    <h3 style="font-size:19px">${esc(l.title)}</h3>
    <p class="lesson-body">${esc(l.body)}</p>
    ${l.drill ? `<div class="lesson-drill"><b>Drill:</b> ${esc(l.drill)}</div>` : ''}
    <div style="margin-top:12px"><button class="btn" data-action="drill-done">Did the work · keep streak</button></div>
  </div>`;
}

// ----- Session deep-dive -----
function sessionView(i){
  const s = S.sessions[+i];
  if(!s) return putting();
  const d = s.detail;
  const sc = { good:'var(--green)', warn:'var(--burg)', mid:'var(--ink)' };
  const disc = sessionDiscipline(s);
  return `
  <button class="backlink" data-action="go" data-view="${disc==='swing'?'swing':'putting'}">← ${disc==='swing'?'Swing Lab':'Putting Lab'}</button>
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
  const backView = b.date || isCourse ? 'preps' : (b.discipline === 'putting' ? 'putting' : 'swing');
  const backLabel = b.date || isCourse ? 'Round Prep' : (b.discipline === 'putting' ? 'Putting Lab' : 'Swing Lab');
  return `
  <button class="backlink" data-action="go" data-view="${backView}">← ${backLabel}</button>
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

// ----- Courses -----
function courses(){
  const played = S.courses.filter(c=>!c.bucket);
  const bucket = S.courses.filter(c=>c.bucket);
  const states = new Set(played.map(c=>c.st).filter(Boolean));
  const rated = played.filter(c=>c.rating!=null);
  const avg = rated.length ? (rated.reduce((s,c)=>s+ +c.rating,0)/rated.length).toFixed(1) : '—';
  const sorted = [...played].sort((a,b)=>(b.rating??-1)-(a.rating??-1));
  return `
  <div class="rowgrid g3">
    <div class="stat"><div class="v">${played.length}</div><div class="l">Played</div></div>
    <div class="stat"><div class="v">${states.size}</div><div class="l">States/Countries</div></div>
    <div class="stat"><div class="v">${avg}</div><div class="l">Avg rating</div></div>
  </div>

  <h2>The rankings</h2>
  <div class="card">
    ${sorted.length ? sorted.map(c=>`<div class="crs" data-action="edit-course" data-id="${c.id}">
      <span class="nm">${esc(c.name)}<span class="st">${esc(c.st||'')}</span></span>
      <span class="rt">${c.rating!=null? Number(c.rating).toFixed(2) : '—'}${c.pr!=null?' · PR '+esc(c.pr):''}</span>
    </div>`).join('') : '<p class="sm">No courses yet — add your first below.</p>'}
    <p class="sm faint" style="margin-top:8px">Tap a course to edit its rating, PR or notes. Seeded from your course sheet — fix anything I guessed wrong.</p>
  </div>

  <h2>Bucket list</h2>
  <div class="card flat">
    ${bucket.length ? bucket.map(c=>`<div class="crs" data-action="edit-course" data-id="${c.id}">
      <span class="nm">${esc(c.name)}<span class="st">${esc(c.st||'')}</span></span><span class="rt">someday</span></div>`).join('') : '<p class="sm">Nothing queued.</p>'}
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
        b:`Putts per round are DOWN ${dPutts.toFixed(1)} (${b.putts.toFixed(1)} → ${g.putts.toFixed(1)}), but greens in regulation fell ${Math.abs(dGir).toFixed(1)} points (${b.gir}% → ${g.gir}%)${b.driving && d ? ` and fairways ${b.driving.fairway}% → ${d.fairway}%` : ''}, and scoring barely moved: par-or-better ${parOrBetter(b)}% → ${parOrBetter(g)}%, doubles ${blowUps(b)}% → ${blowUps(g)}%. Whatever you saved on the greens you handed back before you got there. The strokes are tee-to-green.` });
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
      b:`Averaging ${ap[5].toFixed(2)} on par 5s — barely better relative to par than your ${ap[4].toFixed(2)} on par 4s. A par 5 is the one hole where a mid-handicap gets a free run at birdie. Decide the lay-up off your wedge ladder so the third shot is a number you own.` });
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

function scoreStats(){
  const rs = withHoles();
  const mix = { eagle:0, birdie:0, par:0, bogey:0, double:0, triple:0 };
  const byPar = { 3:{n:0,over:0,red:0}, 4:{n:0,over:0,red:0}, 5:{n:0,over:0,red:0} };
  const opening = { n:0, over:0 };
  const spots = new Map();
  const tee = new Map(), app = new Map();
  const fw = { n:0, hit:0, miss:{} }, green = { n:0, hit:0, miss:{}, noshot:0 };
  const putts = { holes:0, total:0, one:0, three:0 };
  let holes = 0, over = 0;
  rs.forEach(r => r.holes.forEach((h, i) => {
    if(h.s == null || h.par == null) return;
    const d = h.s - h.par;
    holes++; over += d;
    if(d <= -2) mix.eagle++; else if(d === -1) mix.birdie++; else if(d === 0) mix.par++;
    else if(d === 1) mix.bogey++; else if(d === 2) mix.double++; else mix.triple++;
    const p = byPar[h.par];
    if(p){ p.n++; p.over += d; if(d < 0) p.red++; }
    if(i === 0){ opening.n++; opening.over += d; }
    const n = h.n ?? i + 1;
    const k = `${r.course}|${n}`;
    const e = spots.get(k) || { course:r.course, hole:n, par:h.par, n:0, over:0 };
    e.n++; e.over += d; spots.set(k, e);
    // Shot detail. Recorded per hole since the live logger existed; absent on the older
    // score-only cards, which is why every consumer below gates on its own sample size.
    if(h.putts != null){
      putts.holes++; putts.total += h.putts;
      if(h.putts <= 1) putts.one++; else if(h.putts >= 3) putts.three++;
    }
    if(h.gir != null){
      green.n++;
      if(h.gir) green.hit++;
      else if(h.noshot) green.noshot++;      // charged to the tee, not the approach
      else { const g = h.gmiss || 'X'; green.miss[g] = (green.miss[g] || 0) + 1; }
    }
    if(h.fw != null){
      fw.n++;
      if(h.fw) fw.hit++;
      else { const g = h.fmiss || 'X'; fw.miss[g] = (fw.miss[g] || 0) + 1; }
    }
    if(h.tee) bagShot(tee, h.tee, h, d, TEE_OWNS(h));
    if(h.app) bagShot(app, h.app, h, d, APP_OWNS);
  }));
  const worst = [...spots.values()].filter(e => e.n >= 2)
    .sort((a,b) => (b.over / b.n) - (a.over / a.n)).slice(0, 5);
  return { rs, mix, byPar, opening, worst, holes, over, tee, app, fw, green, putts };
}

// Every finding carries WHERE IT CAME FROM, and the strength of that source decides the
// order it's read in. Rounds Jack logged hole by hole are the strongest thing he owns:
// he was there, he recorded it, and it is his own current game. A pasted GHIN summary is
// somebody else's arithmetic over a season that may predate the bag he's playing — still
// worth having, but it goes last. Same rule as "film is king", applied to the numbers.
const EV_RANK = { round:0, measured:1, snapshot:2 };
const EV_LAB = { round:'from your rounds', measured:'measured', snapshot:'GHIN summary' };
const evTag = ev => ev ? ` <span class="ev ${ev}">${EV_LAB[ev]}</span>` : '';

// Tips fire off thresholds in the data, so they only appear once there's
// enough of it to mean anything. Each one carries the number that triggered it.
function scoreTips(st){
  // Two rounds' worth of recorded greens/putts is enough to outrank a pasted average.
  const t = statTips({ approach: st.green.n >= 36, putting: st.putts.holes >= 36 });
  if(!st.holes) return t;

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
      t.push({ ev:'round', s: scoresBetter ? 'mid' : 'warn', src:`Off the tee · ${straight.fwN + wild.fwN} tee shots`,
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
    const top = Object.entries(st.green.miss).sort((x, y) => y[1] - x[1])[0];
    if(real >= 8 && top && top[1] / real >= 0.4)
      t.push({ ev:'round', s:'warn', src:`Approach · ${real} playable misses`, h:`${Math.round(top[1] / real * 100)}% of your playable green misses go ${MISS_LAB[top[0]] || top[0]}`,
        b:`${top[1]} of ${real}${st.green.noshot ? `, after setting aside ${st.green.noshot} green${st.green.noshot === 1 ? '' : 's'} the tee shot took away` : ''}, off ${st.green.hit}/${st.green.n} greens hit. A miss that only ever goes one way is not dispersion — dispersion sprays every direction. ${top[0] === 'S'
          ? 'Short is a DISTANCE fault: the number you are clubbing to is longer than the club actually carries. Club to cover the middle-to-back of the green, and re-baseline the ladder to average carry rather than your purest strike.'
          : top[0] === 'Lg' ? 'Long is usually adrenaline or an overcorrection off a run of short ones — worth checking whether these follow your good drives.'
          : 'A one-sided miss this consistent is face-and-path, not club selection. That one belongs in the Swing lab.'}` });

    // The other half of the split: when enough greens are conceded at the tee, the
    // approach numbers are a symptom and the driving is the disease.
    if(st.green.noshot >= 4 && st.green.noshot / missed >= 0.25){
      const worst = [...st.tee.values()].filter(e => e.noshot).sort((x, y) => y.noshot - x.noshot)[0];
      t.push({ ev:'round', s:'warn', src:`Off the tee · ${st.green.noshot} of ${missed} green misses`, h:`${Math.round(st.green.noshot / missed * 100)}% of your green misses were lost at the tee`,
        b:`${st.green.noshot} of ${missed} missed greens came from holes where you had no realistic play once you reached the ball — the stroke was gone before the approach club came out of the bag. Approach practice cannot touch these${worst ? `, and ${clubName(worst.key)} accounts for ${worst.noshot} of them across ${worst.n} tee shots` : ''}. Compare that against the fairway percentages above: finding the short grass matters less than never being dead, and those are different bets.` });
    }
  }

  if(st.putts.holes >= 36){
    const rate = st.putts.three / st.putts.holes;
    if(rate >= 0.08)
      t.push({ ev:'round', s:'warn', src:`Putting · ${st.putts.holes} holes recorded`, h:`${st.putts.three} three-putts in ${st.putts.holes} holes`,
        b:`${(rate * 18).toFixed(1)} a round, against ${st.putts.one} one-putts and ${(st.putts.total / st.putts.holes).toFixed(2)} putts a hole overall. Three-putts are a PACE fault, not a line fault — the first putt is finishing outside gimme range. This is the live-round evidence for the standing distance-control priority, and the 30-ft ladder is what turns it into a number you can move.` });
  }

  const blowN = st.mix.double + st.mix.triple;
  const blowShots = st.mix.double * 2 + st.mix.triple * 3;
  const share = st.over > 0 ? blowShots / st.over : 0;
  if(blowN && share >= 0.25) t.push({ ev:'round', s:'warn', src:'Biggest single lever', h:'Doubles are your gap',
    b:`${blowN} holes of double bogey or worse across ${st.holes} played — that's ${blowShots} strokes, ${Math.round(share*100)}% of everything you've lost to par. Eliminating blow-ups is worth more than any extra birdies: par golf with zero doubles beats birdie golf with four. On a hole that starts badly, take the punch-out and the bogey instead of the hero shot.` });
  if(st.opening.n >= 3){
    const avg = st.opening.over / st.opening.n;
    if(avg >= 0.8) t.push({ ev:'round', s:'warn', src:'Cheapest fix on the list', h:'Your opening hole is a leak',
      b:`${st.opening.over > 0 ? '+' : ''}${st.opening.over} across ${st.opening.n} opening holes — ${avg.toFixed(1)} a hole before you've settled. That's a warm-up problem, not a swing problem. Prime the feel before the first tee (slow one-handed reps, then blend to two hands) rather than hunting for it on the 4th.` });
  }
  const p3 = st.byPar[3], p4 = st.byPar[4], p5 = st.byPar[5];
  // A par 3 takes the driver out of your hands, so it should be clearly your best
  // scoring hole. Parity with the par 4s is itself the finding.
  // A handful of par 3s at one course must not outvote a season of them.
  const bp = (latestStats() || {}).avgByPar;
  const bigSampleSaysFine = bp && bp[3] != null && bp[4] != null && (bp[3] - 3) < (bp[4] - 4) * 0.9;
  if(!bigSampleSaysFine && p3.n >= 6 && p4.n >= 6 && (p3.over / p3.n) >= (p4.over / p4.n) * 0.9) t.push({ ev:'round', s:'warn', src:'Where it points', h:'Par 3s are no better than your par 4s',
    b:`+${(p3.over/p3.n).toFixed(2)} a hole on par 3s against +${(p4.over/p4.n).toFixed(2)} on par 4s. There's no driver on a par 3 and no second shot to recover with, so it should be comfortably your best hole type — level with the par 4s means the tee shot itself isn't finding greens. That's iron control, not driving. Club to cover the front edge rather than to reach the pin.` });
  if(p5.n >= 4 && p5.red === 0) t.push({ ev:'round', s:'mid', src:'Missing offense', h:'No birdies on par 5s',
    b:`${p5.n} par-5 holes played, zero under par. Par 5s are where a mid-handicap makes his money. Decide the lay-up off your wedge ladder so the third shot is a NUMBER you own rather than whatever's left — 60°→80 · 56°→95 · 50°→108 · PW→122.` });
  const w = st.worst[0];
  if(w && (w.over / w.n) >= 1.5) t.push({ ev:'round', s:'warn', src:'One hole', h:`${esc(w.course)} hole ${w.hole} is eating you`,
    b:`+${w.over} across ${w.n} plays on a par ${w.par} — ${(w.over/w.n).toFixed(1)} a go. One hole played a handful of times shouldn't cost this much. Next time you see it, play it as a bogey hole on purpose and take the trouble out of the equation.` });
  const parRate = (st.mix.par + st.mix.birdie + st.mix.eagle) / st.holes;
  if(parRate >= 0.4) t.push({ ev:'round', s:'good', src:'Protect this', h:'You make a lot of pars',
    b:`${Math.round(parRate*100)}% of holes played at par or better. The base game is there — the scoring gap is the tail, not the average.` });
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
    <table><tr><th>Club</th><th>Tees</th><th>Found it</th><th>Dead</th><th>Per hole</th></tr>
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
        <td><b style="color:${e.over / e.n >= 1 ? 'var(--burg)' : e.over / e.n <= 0.5 ? 'var(--green)' : 'var(--ink)'}">${e.over > 0 ? '+' : ''}${(e.over / e.n).toFixed(2)}</b></td></tr>`;
      }).join('')}
    </table>
    <p class="sm faint" style="margin-top:8px">"Found it" is fairways for a club hit off a par 4 or 5, and greens for one hit off a par 3 — on a par 3 the tee shot is the approach, so the green is its own result. <b>"Dead"</b> is the holes it left you no play at the green, which convicts a club far better than a fairway percentage: most rough is playable and none of these were. "Per hole" is your score against par on the holes you hit that club — a club that finds more fairways but scores no better is not saving you anything, and that comparison is the whole point of this table.</p>
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

function scores(){
  const all = S.rounds.slice().sort((a,b) => (a.date || '').localeCompare(b.date || ''));
  if(!all.length) return `
  <div class="card">
    <h2>No rounds yet</h2>
    <p class="sm">Log a round on the <b>Home</b> page, or send Claude your GHIN round summaries and they'll land here with the hole-by-hole detail — which is what unlocks the analytics below: scoring mix, par-3/4/5 splits, your worst holes, and tips built from your own numbers.</p>
  </div>`;
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
    <p class="sm faint">Strongest evidence first: what your own logged rounds say, then the GHIN summaries. These change as the data does.</p>
  </div>` : ''}

  ${statsCard()}

  <h2>Every round</h2>
  <div class="card">
    <table><tr><th>Date</th><th>Course</th><th>Tees</th><th>Score</th><th>vs par</th><th>Putts</th></tr>
      ${all.slice().reverse().map(r => { const v = roundVsPar(r); return `<tr data-action="open-round" data-i="${S.rounds.indexOf(r)}" style="cursor:pointer">
        <td style="white-space:nowrap">${fmtDate(r.date)} <span class="faint">▸</span></td>
        <td class="sm">${esc(r.course || '—')}${r.nine ? ` <span class="faint">${r.nine === 'F' ? 'front' : 'back'}</span>` : ''}</td>
        <td class="sm">${esc(r.tees || '—')}</td>
        <td><b>${esc(r.score ?? '—')}</b></td>
        <td class="sm">${v == null ? '—' : `<b style="color:${v > 5 ? 'var(--burg)' : v <= 2 ? 'var(--green)' : 'var(--ink)'}">${v > 0 ? '+' : ''}${v}</b>`}</td>
        <td class="sm">${esc(r.putts ?? '—')}</td></tr>`; }).join('')}
    </table>
    <p class="sm faint" style="margin-top:8px">Tap any round for the hole-by-hole card and its own breakdown.${
      all.some(r => r.note) ? ` Latest note: "${esc(all.filter(r=>r.note).slice(-1)[0].note)}"` : ''}</p>
  </div>`;
}

// ----- Single round deep dive -----
// Rounds arrive with wildly different detail. The early cards are par-and-score only;
// the Aug 12 card is the first carrying a putt count, a green result and a tee result
// on every hole. Everything below is computed from whatever a round actually has, and
// each block hides itself when the data behind it isn't there — so a 60-second logged
// round still opens, it just shows less.
const MISS_LAB = { S:'short', L:'left', R:'right', Lg:'long', X:'other' };
const MISS_KEY = { S:'short', L:'left', R:'right', Lg:'long' };  // → the stats-baseline field

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
    putts:{ n:0, total:0, one:0, two:0, three:0, girN:0, girTot:0, offN:0, offTot:0, threes:[] },
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

  const gm = Object.entries(a.gir.miss).sort((x,y) => y[1] - x[1])[0];
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

  const fm = Object.entries(a.fw.miss).sort((x,y) => y[1] - x[1])[0];
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
      b:`Holes ${a.putts.threes.map(h => h.n).join(', ')}.${a.putts.threes.some(h => h.gir === true) ? ' At least one came from a green hit in regulation, which is a par turned into a bogey by pace alone.' : ''} This is distance control, the open fault, and it is what the 30-ft ladder exists to measure. A round gives you the total; it cannot give you the spread or the green speed.` });

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
      b:`${a.blowups.map(h => `hole ${h.n} (par ${h.par}, ${h.s})`).join(' · ')}. Turning each of these into a bogey is ${cost} shots without hitting one better shot. On a hole that starts badly, take the punch-out.` });
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
    rows.push(`<tr><td><b>${h.n ?? idx + 1}</b>${h.si ? `<span class="si"> ${h.si}</span>` : ''}</td>
      <td class="sm">${h.par}</td><td>${mark(h)}</td>
      <td class="sm">${h.putts ?? '·'}</td>
      <td>${res(h.gir, h.gmiss, h.par === 3 ? null : h.app, h.noshot)}</td>
      <td>${res(h.fw, h.fmiss, h.tee)}</td></tr>`);
    if(a.nines.length === 2 && idx === 8) rows.push(subRow(a.nines[0]));
  });
  if(a.nines.length === 2) rows.push(subRow(a.nines[1]));
  const bar = [['birdie','Birdie or better',a.mix.eagle+a.mix.birdie],['par','Par',a.mix.par],
               ['bogey','Bogey',a.mix.bogey],['double','Double+',a.mix.double+a.mix.triple]];
  const tiles = [
    ['Score', a.score ?? '—'],
    ['vs par', a.vs == null ? '—' : `${a.vs > 0 ? '+' : ''}${a.vs}`],
    ['Putts', a.putts.total || '—'],
  ];
  if(a.gir.n) tiles.push(['Greens', `${a.gir.hit}/${a.gir.n}`]);
  if(a.fw.n) tiles.push(['Fairways', `${a.fw.hit}/${a.fw.n}`]);
  if(a.scramble.chances) tiles.push(['Up & down', `${a.scramble.saved}/${a.scramble.chances}`]);
  return `
  <button class="backlink" data-action="go" data-view="scores">← Scores</button>
  <div class="card">
    <h2>${esc(r.course || 'Round')}</h2>
    <p class="sm faint">${fmtDate(r.date)}${r.tees ? ` · ${esc(r.tees)} tees` : ''}${
      r.nine ? ` · ${r.nine === 'F' ? 'front' : 'back'} nine` : ''}${
      a.par != null ? ` · par ${a.par}` : ''}${r.rating != null && r.slope ? ` · ${r.rating}/${r.slope}` : ''}</p>
    <div class="rowgrid ${tiles.length === 4 ? '' : 'g3'}" style="margin-bottom:4px">
      ${tiles.map(([l,v]) => `<div class="stat"><div class="v">${esc(v)}</div><div class="l">${l}</div></div>`).join('')}
    </div>
    ${r.note ? `<p class="sm" style="margin-top:8px">"${esc(r.note)}"</p>` : ''}
    ${r.troubles && r.troubles.length ? `<div class="chips">${r.troubles.map(k => {
      const lab = (TROUBLES.find(t => t[0] === k) || [null, k])[1];
      return `<span class="chip static on">${esc(lab)}</span>`; }).join('')}</div>` : ''}
    ${played ? `<div class="linkrow" data-action="edit-course" data-id="${played.id}">
      <span class="sm"><b>${played.rating ? `You rated this course ${played.rating}/10` : 'Rate this course'}</b></span><span class="arr">→</span></div>` : ''}
  </div>

  ${a.holes.length ? `
  <h2>Hole by hole</h2>
  <div class="card">
    <table class="scard">
      <tr><th>Hole</th><th>Par</th><th>Score</th><th>Putts</th><th>Green</th><th>Tee</th></tr>
      ${rows.join('')}
    </table>
    <p class="sm faint">Small grey number is the stroke index. Circle = under par, square = over.
    ${a.gir.n ? 'Green and Tee show the miss direction where it was recorded; a dot means it was not.' : ''}
    ${a.tee.size ? 'The club under each result is what you hit.' : ''}</p>
  </div>

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

  ${(a.gir.n && a.gir.hit < a.gir.n) || (a.fw.n && a.fw.hit < a.fw.n) ? `
  <h2>Where the misses went</h2>
  <div class="card">
    ${a.gir.n ? `<p class="sm"><b>Greens</b> — ${a.gir.hit} of ${a.gir.n} hit${
      a.gir.hit < a.gir.n ? `. Misses: ${missSplit(a.gir.miss) || '—'}${
        a.gir.noshot ? `, plus <b class="warn">${a.gir.noshot} with no shot at it</b> (hole${a.gir.noshot === 1 ? '' : 's'} ${a.gir.noshotHoles.join(', ')})` : ''}.` : '.'}</p>` : ''}
    ${a.fw.n ? `<p class="sm" style="margin-top:6px"><b>Fairways</b> — ${a.fw.hit} of ${a.fw.n} hit${
      a.fw.hit < a.fw.n ? `. Misses: ${missSplit(a.fw.miss)}.` : '.'}</p>` : ''}
    ${a.putts.n ? `<p class="sm" style="margin-top:6px"><b>Putting</b> — ${a.putts.one} one-putt${
      a.putts.one === 1 ? '' : 's'} · ${a.putts.two} two-putts · ${a.putts.three} three-putt${
      a.putts.three === 1 ? '' : 's'} · ${(a.putts.total / a.putts.n).toFixed(2)} a hole.</p>` : ''}
  </div>` : ''}

  ${tips.length ? `<h2>What this round says</h2>
  <div class="card">
    ${tips.map(t => `<div class="tipcard ${t.s === 'good' ? 'green' : ''}">
      <div class="src">${esc(t.src)}</div><h4>${t.h}</h4>${expandable(t.b)}</div>`).join('')}
    <p class="sm faint">Computed from this card alone — every line carries the number that triggered it.</p>
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
function priorLayout(course, nine){
  const key = (course || '').trim().toLowerCase();
  if(!key) return null;
  const cards = S.rounds.filter(r => (r.course || '').trim().toLowerCase() === key
      && Array.isArray(r.holes) && r.holes.some(h => h && h.par))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
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
function coursesWithLayout(){
  const seen = new Map();
  S.rounds.forEach(r => {
    if(!r.course || !Array.isArray(r.holes) || !r.holes.some(h => h && h.par)) return;
    seen.set(r.course, Math.max(seen.get(r.course) || 0, r.holes.length));
  });
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
    if(h) plays.push({ d:h.s - h.par, s:h.s, tee:h.tee });
  });
  if(!plays.length) return null;
  const over = plays.reduce((a, p) => a + p.d, 0);
  const clubs = [...new Set(plays.map(p => p.tee).filter(Boolean))];
  return { n:plays.length, over, avg:over / plays.length,
    best:plays.reduce((a, p) => Math.min(a, p.s), Infinity), clubs };
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
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
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
    if(h.tee) o.tee = h.tee;
    if(h.gir != null){ o.gir = h.gir; if(h.gir === false && h.gmiss) o.gmiss = h.gmiss; }
    // A par 3 carries no fairway and no separate approach — the tee shot IS the approach.
    if(h.par !== 3){
      if(h.fw != null){ o.fw = h.fw; if(h.fw === false && h.fmiss) o.fmiss = h.fmiss; }
      if(h.app) o.app = h.app;
      if(h.noshot) o.noshot = true;
    }
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
  if((a.fw.n >= 6 && a.fw.hit / a.fw.n < 0.45) || a.gir.noshot >= 2) out.push('off-tee');
  const real = a.gir.n - a.gir.hit - a.gir.noshot;
  if(real >= 4 && (a.gir.miss.S || 0) / real >= 0.4) out.push('approach');
  return out;
}

function liveBanner(){
  const L = S.live;
  if(!L) return '';
  const t = liveThru(L);
  return `<div class="card livebar">
    <div class="lvtag">Round in progress</div>
    <h3>${esc(L.course)}</h3>
    <p class="sm">${t.n ? `${t.over > 0 ? '+' : ''}${t.over} thru ${t.n}` : 'Nothing scored yet'} · on hole ${L.holes[L.cur] ? L.holes[L.cur].n : 1}</p>
    <div class="formrow" style="margin-top:10px">
      <button class="btn" data-action="live-new">Resume →</button>
      <button class="btn ghost" data-action="live-discard">Discard</button>
    </div>
  </div>`;
}

function live(){
  const L = S.live;
  if(!L) return liveStart();
  return L.stage === 'finish' ? liveFinish(L) : livePlay(L);
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
    <input id="lvCourse" list="courseList" placeholder="Start typing…">
    <datalist id="courseList">${S.courses.map(c => `<option value="${esc(c.name)}">`).join('')}</datalist>
    ${soon.length ? `<div class="chips">${soon.map(b =>
      `<span class="chip" data-action="live-pick" data-course="${esc(b.course)}">${esc(b.course)} · ${fmtDate(b.date)}</span>`).join('')}</div>` : ''}
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
    <p class="sm"><b>What it records.</b> Which club you hit off every tee (and optionally into every green), whether you found the fairway and the green and where the miss went, putts, and the score. That's the input side of every number on the Scores page — and the tee-club table can't exist without it.</p>
  </div>`;
}

function livePlay(L){
  const h = L.holes[L.cur];
  const t = liveThru(L);
  const par3 = h.par === 3;
  const clubs = bagClubs();
  // Nobody tees off a par 4 with a 56°, but a short par 3 is exactly a wedge — so the
  // tee row carries the whole bag only where that's a real shot.
  const teeClubs = par3 ? clubs : clubs.filter(c => !c.wedge);
  const chip = (k, v, lab, on) =>
    `<span class="chip big${on ? ' on' : ''}" data-action="live-set" data-k="${k}" data-v="${esc(v)}">${lab}</span>`;
  const row = (lab, body, hint) => `<div class="lvrow"><div class="lvlab">${lab}${
    hint ? `<span>${hint}</span>` : ''}</div>${body}</div>`;
  const clubRow = (k, list) => `<div class="clubgrid">${list.map(c => {
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
  return `
  <div class="lvhead">
    <div class="lvh1">Hole ${h.n}<span> · par ${h.par}${h.si ? ` · SI ${h.si}` : ''}</span></div>
    <div class="lvh2">${t.n ? `<b>${t.over > 0 ? '+' : ''}${t.over}</b> thru ${t.n}` : esc(L.course)}</div>
    <div class="parpick"><em>Par</em>${[3,4,5].map(p => chip('par', p, p, h.par === p)).join('')}</div>
  </div>
  <div class="hstriprow">${L.holes.map((x, i) =>
    `<span class="hstrip${i === L.cur ? ' cur' : ''}${x.s != null ? ' done' : ''}" data-action="live-goto" data-i="${i}">${x.n}</span>`).join('')}</div>

  ${(() => {
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
    return `<div class="card flat holeintel">
      <div class="lvlab">${head.join(' · ')}</div>
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
            eating ? ' — <b class="hot">play it as a bogey hole</b>' : ''}</dd>` : ''}
        </dl>`;
      })()}
      ${why.length || !hn ? `<ul class="hi-why">
        ${why.map(w => `<li>${emph(w)}</li>`).join('')}
        ${!hn && rec ? `<li>${line}</li>` : ''}
        ${!hn && eating ? `<li class="hot"><b>This one has been eating you</b> — play it as a bogey hole on purpose</li>` : ''}
      </ul>` : ''}
    </div>`;
  })()}

  <div class="card lvcard">
    ${row('Off the tee', clubRow('tee', teeClubs),
      h.teeAuto ? 'carried over — tap to keep or change' : '')}
    ${par3 ? '' : row('Fairway', `<div class="chips">
      ${chip('fw', 'hit', 'Hit', h.fw === true)}
      ${chip('fw', 'L', 'Left', h.fw === false && h.fmiss === 'L')}
      ${chip('fw', 'R', 'Right', h.fw === false && h.fmiss === 'R')}
      ${chip('fw', 'X', 'Other', h.fw === false && !h.fmiss)}</div>`,
      'a topped one or a penalty is "other"')}
    ${par3 ? '' : row('Into the green', clubRow('app', clubs), 'optional')}
    ${row('Green', `<div class="chips">
      ${chip('green', 'hit', 'Hit', h.gir === true)}
      ${chip('green', 'S', 'Short', h.gir === false && h.gmiss === 'S')}
      ${chip('green', 'L', 'Left', h.gir === false && h.gmiss === 'L')}
      ${chip('green', 'R', 'Right', h.gir === false && h.gmiss === 'R')}
      ${chip('green', 'Lg', 'Long', h.gir === false && h.gmiss === 'Lg')}</div>${
      // Separate toggle, not a sixth direction: a short one you had no play at is both
      // short AND conceded, and only the second fact tells you which club to blame.
      par3 ? '' : `<div class="chips"><span class="chip big ns${h.noshot ? ' on' : ''}"
        data-action="live-set" data-k="noshot" data-v="1">No shot at it</span></div>`}`,
      par3 ? '' : 'the drive left you nothing')}
    ${row('Putts', `<div class="chips">${[0,1,2,3,4,5].map(p =>
      chip('putts', p, p === 5 ? '5+' : p, h.putts === p)).join('')}</div>`)}
    ${row('Score', `<div class="chips">${scores}${outlier}
      <span class="chip big" data-action="live-bump" data-d="1">+1</span>
      <span class="chip big" data-action="live-bump" data-d="-1">−1</span></div>`)}
  </div>

  <div class="formrow">
    <button class="btn ghost"${L.cur === 0 ? ' disabled' : ''} data-action="live-nav" data-d="-1">← ${L.cur === 0 ? 'Start' : 'Hole ' + L.holes[L.cur - 1].n}</button>
    <button class="btn" data-action="live-nav" data-d="1">${last ? 'Finish round →' : 'Hole ' + L.holes[L.cur + 1].n + ' →'}</button>
  </div>
  <p class="sm faint" style="margin-top:10px">Everything except the score is optional — skip a row and it simply isn't recorded, rather than being guessed. Tap a lit chip again to clear it. A <b>half-lit</b> tee club is one carried over from the last time you played this hole, or from earlier in this round: leave it if it's right, tap another club if it isn't.</p>
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
  </div>

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
    <p class="sm">Saving drops you straight into this round's own card, where the hole-by-hole detail you just logged turns into the miss patterns, the scrambling rate and the coaching. Everything also folds into the season numbers on <b>Scores</b>.</p>
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
  'go': el => { editingCourse = null; render(el.dataset.view); },
  'open-round': el => render('round', +el.dataset.i),

  // ----- Live round -----
  'live-new': () => render('live'),
  'live-pick': el => { const i = $('#lvCourse'); if(i) i.value = el.dataset.course; },
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
    const first = nine === 'B' ? 10 : 1;
    const holes = [];
    for(let i = 0; i < (nine ? 9 : 18); i++){
      const n = first + i;
      const p = prior && prior.by.get(n);
      holes.push({ n, par: p ? p.par : 4, si: p ? p.si : null, s:null });
    }
    // He's playing it, so it belongs in Courses whether or not he's rated it yet.
    if(!S.courses.some(c => (c.name || '').toLowerCase() === course.toLowerCase())){
      const db = typeof COURSE_DB !== 'undefined'
        ? COURSE_DB.find(c => c.n.toLowerCase() === course.toLowerCase()) : null;
      S.courses.push({ id:uid(), name:course, st: db ? db.st : '', rating:null, pr:null, bucket:false, notes:'' });
    }
    S.live = { date, course, nine, cur:0, holes, stage:'play', prevLayout: !!prior,
      tees: prior ? prior.tees : '', rating: prior ? prior.rating : null,
      slope: prior ? prior.slope : null, troubles:[], note:'' };
    suggestTee(S.live);
    save(); render('live');
    toast(prior ? `Card prefilled from ${fmtDate(prior.from)}` : 'Round started — good luck');
  },
  'live-set': el => {
    const L = S.live, h = L && L.holes[L.cur];
    if(!h) return;
    const k = el.dataset.k, v = el.dataset.v;
    const lit = el.classList.contains('on');   // re-tapping a lit chip clears it
    if(k === 'par'){
      h.par = +v;
      // A par 3 has no fairway, no separate approach, and always a shot at the green.
      if(h.par === 3){ delete h.fw; delete h.fmiss; delete h.app; delete h.noshot; }
      // A suggestion made for a par 4 isn't valid for a par 3, so re-derive it.
      if(h.teeAuto){ delete h.tee; delete h.teeAuto; suggestTee(L); }
    }
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
    else if(k === 'putts'){ if(lit) delete h.putts; else h.putts = +v; }
    else if(k === 's'){ h.s = lit ? null : +v; }
    save(); rerender();
  },
  'live-bump': el => {
    const L = S.live, h = L && L.holes[L.cur];
    if(!h) return;
    h.s = Math.max(1, (h.s ?? h.par) + (+el.dataset.d));
    save(); rerender();
  },
  // Changing hole IS a navigation — that one should land at the top of the new hole.
  'live-goto': el => { if(S.live){ S.live.cur = +el.dataset.i; suggestTee(S.live); save(); render('live'); } },
  'live-nav': el => {
    const L = S.live; if(!L) return;
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
};

function applyTheme(){
  document.body.classList.toggle('night', S.settings.theme === 'night');
  const b = document.querySelector('.themebtn');
  if(b) b.textContent = S.settings.theme === 'night' ? '☀' : '☾';
}

function fetchWeather(manual){
  if(!manual && S.weather && Date.now() - S.weather.ts < 30*60*1000) return;
  if(!navigator.geolocation){ if(manual) toast('No location on this device'); return; }
  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude, longitude } = pos.coords;
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
  // trouble chips + bucket chip toggle themselves
  const chip = e.target.closest('#troubleChips .chip, #coBucket');
  if(chip){ chip.classList.toggle(chip.id==='coBucket' ? 'grn' : 'on'); return; }
  const el = e.target.closest('[data-action]');
  if(el && ACTIONS[el.dataset.action]) ACTIONS[el.dataset.action](el);
});

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
function applyFeed(feed){
  let changed = false;
  (feed.entries || []).forEach(e => {
    if(!e.id || S.feedApplied.includes(e.id)) return;
    if(e.type === 'session') S.sessions.push({ date:e.date, setup:e.setup, finding:e.finding, detail:e.detail, _fid:e.id });
    else if(e.type === 'session-update'){
      const s = S.sessions.find(x => x._fid === e.target) ||
                S.sessions.find(x => e.setupMatch && (x.setup||'').startsWith(e.setupMatch));
      if(s){ if(e.setup) s.setup = e.setup; if(e.finding) s.finding = e.finding; if(e.detail) s.detail = e.detail; }
    }
    else if(e.type === 'session-remove') S.sessions = S.sessions.filter(x => x._fid !== e.target);
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
        const { holes, ...rest } = e.round;
        Object.assign(r, rest);
        if(Array.isArray(holes) && Array.isArray(r.holes)){
          holes.forEach(h => {
            const hit = r.holes.find(x => x.n === h.n);
            if(hit) Object.assign(hit, h); else r.holes.push(h);
          });
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
    else if(e.type === 'shortlist' && Array.isArray(e.shortlist)){
      const demoed = new Set(S.shortlist.filter(p=>p.demoed).map(p=>p.name));
      S.shortlist = e.shortlist.map(p => ({ ...p, demoed: demoed.has(p.name) }));
    }
    else if(e.type === 'action') S.actions.push({ id:e.id, text:e.text, done:false, pri:!!e.pri });
    else if(e.type === 'action-done'){ const a = S.actions.find(x => x.id === e.target); if(a) a.done = true; }
    else if(e.type === 'action-update'){ const a = S.actions.find(x => x.id === e.target); if(a && e.text) a.text = e.text; }
    else if(e.type === 'faults' && Array.isArray(e.faults)) S.faults = e.faults;
    else if(e.type === 'deadline'){ S.settings.returnDeadline = e.date; S.settings.deadlineEstimated = false; }
    else return; // unknown type: leave unapplied so a newer app version can pick it up
    S.feedApplied.push(e.id);
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
  if(document.visibilityState === 'visible') fetchFeed();
});
})();
