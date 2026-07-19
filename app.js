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
  if(!s.faults) s.faults = [
    { tag:'early-lift', why:'fault #1 in your filmed stroke sessions' },
    { tag:'tempo', why:'your filmed tempo runs ~1:1 (target 2:1)' },
  ];
  if(!s.carries){ const fresh = seed(); s.carries = fresh.carries; s.carriesCalibrated = false; }
  if(!s.briefings) s.briefings = [];
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
  putting:['Putting Lab','The left-miss project — tracked until it’s dead.'],
  coach:['Coach','Lessons that follow your game — not generic tips.'],
  courses:['Courses','Everywhere you’ve played, rated and remembered.'],
  decisions:['Decisions','Equipment calls made with data, not vibes.'],
  data:['Data & Backup','Your data lives on this device — export it anywhere.'],
  session:['Film Breakdown','Frame-by-frame findings from this session.'],
  briefing:['Round Prep','Course knowledge, tuned to your game.'],
};

function render(view, arg){
  current = { view, arg };
  const [title, tag] = TITLES[view] || TITLES.home;
  $('#pageTitle').textContent = title;
  $('#pageTag').textContent = tag;
  document.querySelectorAll('#nav button').forEach(b =>
    b.classList.toggle('on', b.dataset.view === view));
  const R = { home, bag, putting, coach, courses, decisions, data:dataView, shelf, lesson, session:sessionView, briefing }[view] || home;
  $('#view').innerHTML = R(arg);
  window.scrollTo(0,0);
}
let current = { view:'home' };
function rerender(){ render(current.view, current.arg); }

// ----- Home -----
function home(){
  const dl = daysLeft(S.settings.returnDeadline);
  const last = latestFiveFt();
  const sc = last ? fiveFtScore(last) : null;
  const picks = pickedLessons().slice(0,1);
  const wedges = S.clubs.filter(c => c.cat==='wedge' && c.status==='gaming');
  const worstWedge = wedges.sort((a,b)=>groovePct(a)-groovePct(b))[0];
  return `
  <div class="rowgrid">
    <div class="stat"><div class="v">${esc(S.profile.handicap)}</div><div class="l">Handicap</div></div>
    <div class="stat"><div class="v">${S.courses.filter(c=>!c.bucket).length}</div><div class="l">Courses</div></div>
    <div class="stat"><div class="v">${sc ? sc.makes+'/'+sc.total : '—'}</div><div class="l">5-ft makes</div></div>
    <div class="stat ${dl!==null && dl<21 ? 'alert':''}"><div class="v">${dl===null?'—':dl+'d'}</div><div class="l">Return win.</div></div>
  </div>

  <div class="card">
    <h2>Putter return window</h2>
    <h3>${dl===null ? 'No deadline set' : dl + ' days left on the Phantom 7.5'}</h3>
    <p class="sm">${S.settings.deadlineEstimated ? '<span class="warn">Estimated deadline</span> — confirm the real one with the shop and update it below.' : 'Deadline confirmed.'}</p>
    <div class="formrow" style="margin-top:8px">
      <div><label>Deadline</label><input type="date" id="deadlineInput" value="${esc(S.settings.returnDeadline||'')}"></div>
      <div style="align-self:end"><button class="btn ghost" data-action="save-deadline">Save deadline</button></div>
    </div>
    <p class="sm" style="margin-top:8px"><button class="btn tiny burg" data-action="go" data-view="decisions">Open the decision tracker →</button></p>
  </div>

  ${(() => {
    const today10 = today();
    const up = S.briefings.filter(b => !b.date || b.date >= today10).sort((a,b) => (a.date||'').localeCompare(b.date||''));
    const recent = S.briefings.filter(b => b.date && b.date < today10).slice(-1);
    const b = up[0] || recent[0];
    return `<div class="card">
      <h2>Round prep</h2>
      ${b ? `<div class="linkrow" data-action="open-briefing" data-id="${b.id}">
        <span><b>${esc(b.course)}</b><span class="sm faint"> · ${fmtDate(b.date)}${up[0] ? '' : ' (played)'}</span><br>
        <span class="sm">${esc(b.focus || 'Course briefing ready')}</span></span><span class="arr">→</span></div>`
      : `<p class="sm">Playing somewhere soon? Tell Claude the course and day — a briefing built for <i>your</i> game (tee strategy, key holes, lay-up numbers off your ladder, greens notes) lands here before the round.</p>`}
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
  const lineup = S.clubs.filter(c => c.status==='gaming' || c.status==='ordered');
  const bullpen = S.clubs.filter(c => c.status==='backup');
  const wishlist = S.clubs.filter(c => c.status==='wishlist');
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
function putting(){
  const entries = S.fiveFt.slice(-6);
  const mc = missCounts();
  const streak = weekStreak();
  return `
  <div class="card">
    <h2>The diagnosis</h2>
    <p class="sm"><b>Two levers behind the left miss:</b> (1) equipment — max-toe-flow putter + toe-up lie on a confirmed <b>straight SBST stroke</b>; (2) mechanics — face closes through impact, timing-dependent. Fix: zero-torque head at 34" + lie set flat + the two drills below.</p>
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
  </div>

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
    ${S.sessions.map((s,i) => `<tr data-action="open-session" data-i="${i}" style="cursor:pointer"><td style="white-space:nowrap">${fmtDate(s.date)} ${s.detail?'<span class="faint">▸</span>':''}</td><td class="sm">${esc(s.setup)}</td><td class="sm">${esc(s.finding)}</td></tr>`).join('')}
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
  </div>`;
}

// ----- Coach -----
function coach(){
  const picks = pickedLessons();
  const tags = struggles();
  const counts = shelfCounts();
  const streak = weekStreak();
  return `
  <div class="card">
    <h2>Reading your game</h2>
    <p class="sm">Your logs decide what shows up here. Currently working on:</p>
    <div class="chips">${[...tags.keys()].slice(0,5).map(t => {
      const lab = (TROUBLES.find(x=>x[0]===t)||[])[1] || ({'early-lift':'Early lift (putting)','tempo':'Tempo 1:1'}[t]) || t;
      return `<span class="chip on static">${esc(lab)}</span>`; }).join('')}</div>
  </div>

  <h2>Today's lessons · picked for you</h2>
  <div class="card">
    ${picks.length ? picks.map(tipHTML).join('') : '<p class="sm">Log a round below and lessons will appear here.</p>'}
    <button class="btn" data-action="drill-done">Mark today's work done · keep streak</button>
    <div class="streak">${streak.map(d=>`<div class="day ${d.hit?'hit':''}">${d.lab}</div>`).join('')}</div>
  </div>

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
  </div>

  ${S.rounds.length ? `<h2>Recent rounds</h2>
  <div class="card">
    <table><tr><th>Date</th><th>Course</th><th>Score</th><th>Putts</th></tr>
    ${S.rounds.slice(-5).reverse().map(r=>`<tr><td>${fmtDate(r.date)}</td><td>${esc(r.course||'—')}</td><td><b>${esc(r.score??'—')}</b></td><td>${esc(r.putts??'—')}</td></tr>`).join('')}
    </table>
    ${S.rounds.slice(-1).map(r => r.note ? `<div class="note-preview">"${esc(r.note)}"</div>` : '').join('')}
  </div>` : ''}

  <h2>The library · always open</h2>
  <div class="shelf-grid">
    ${Object.entries(counts).map(([name,c]) => `
      <div class="shelf" data-action="open-shelf" data-shelf="${esc(name)}">
        <div class="nm">${esc(name)}</div>
        <div class="ct">${c.n} lessons</div>
        ${c.forYou ? `<span class="new">${c.forYou} FOR YOU</span>` : ''}
      </div>`).join('')}
  </div>
  <p class="sm" style="margin:10px 0">Every lesson is tagged to struggles — log a bad bunker day and the bunker shelf queues the right lesson.</p>`;
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
  return `
  <button class="backlink" data-action="go" data-view="putting">← Putting Lab</button>
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
    <p class="lesson-body">${esc(d.story)}</p>
    ${d.compare ? `<h2>Versus prior sessions</h2><p class="lesson-body">${esc(d.compare)}</p>` : ''}
    ${d.limits ? `<div class="tipcard"><div class="src">What this angle couldn't see</div><p class="sm">${esc(d.limits)}</p></div>` : ''}
    `}
  </div>`;
}

// ----- Round-prep briefing -----
function briefing(id){
  const b = S.briefings.find(x => x.id === id);
  if(!b) return home();
  const played = S.courses.find(c => c.name.toLowerCase() === b.course.toLowerCase());
  const wx = playsFactor();
  return `
  <button class="backlink" data-action="go" data-view="home">← Home</button>
  <div class="card">
    <h2>Round prep · ${fmtDate(b.date)}</h2>
    <h3 style="font-size:19px">${esc(b.course)}</h3>
    ${b.focus ? `<p class="sm" style="margin-top:4px"><b class="warn">Today's one focus:</b> ${esc(b.focus)}</p>` : ''}
    ${played ? `<p class="sm faint" style="margin-top:6px">Your history: ${played.rating != null ? 'rated ' + Number(played.rating).toFixed(2) : 'unrated'}${played.pr != null ? ' · PR ' + esc(played.pr) : ''}${played.notes ? ' · "' + esc(played.notes) + '"' : ''}</p>` : ''}
    ${wx ? `<p class="sm faint">Conditions now: ${Math.round(S.weather.t)}°F — carries play ${wx>1?'+':''}${((wx-1)*100).toFixed(1)}% (see the ladder's Today column).</p>` : ''}
  </div>
  ${(b.sections || []).map(s => `<div class="card">
    <h2>${esc(s.t)}</h2>
    <p class="lesson-body">${esc(s.b)}</p>
  </div>`).join('')}
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
  const decided = S.clubs.find(c => c.cat==='putter' && c.status==='gaming' && c.flow==='zt');
  return `
  <button class="backlink" data-action="go" data-view="home">← Home</button>
  <div class="card">
    <h2>The putter call</h2>
    ${decided ? `<p class="sm"><b class="good">DECIDED ✓ — ${esc(decided.name)} is in the bag.</b> Remaining: return the Phantom 7.5 before the window closes (<b>${dl===null?'deadline not set':dl+' days left'}</b>), then film Session 5 and run the 20-ball baseline to confirm the left miss is gone.</p>`
    : `<p class="sm">Exchange the Phantom 7.5 for a <b>zero-torque at 34"</b>. Demo → 10-ball test → decide. <b>${dl===null?'Deadline not set':dl+' days left'}.</b></p>`}
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

// ---------- Actions ----------
const ACTIONS = {
  'go': el => { editingCourse = null; render(el.dataset.view); },
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
    save(); rerender(); toast('Carries saved');
  },
  'save-matrix': () => {
    document.querySelectorAll('[data-matrix]').forEach(inp => {
      const [L,k] = inp.dataset.matrix.split('.');
      S.matrix[L][k] = inp.value ? parseInt(inp.value) : null;
    });
    save(); toast('Carries saved');
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
    // advance gear counters
    S.settings.gripRounds++;
    S.clubs.forEach(c => { if(c.cat==='wedge' && c.status==='gaming') c.rounds = (c.rounds||0)+1; });
    save(); rerender(); toast('Round saved — Coach updated');
  },
  'open-session': el => render('session', el.dataset.i),
  'open-briefing': el => render('briefing', el.dataset.id),
  'open-shelf': el => render('shelf', el.dataset.shelf),
  'open-lesson': el => render('lesson', el.dataset.id),
  'edit-course': el => {
    editingCourse = S.courses.find(c=>c.id===el.dataset.id) || null;
    rerender();
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

// ---------- Coach feed ----------
// Claude analyzes filmed sessions and pushes findings to coach-feed.json in the
// repo; the app merges any entries it hasn't applied yet. Jack's own logs stay
// local — this is a one-way inbox for coaching updates.
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
    else if(e.type === 'course-add' && e.course && !S.courses.some(c => c.name === e.course.name))
      S.courses.push({ id:e.id, rating:null, pr:null, bucket:false, notes:'', ...e.course });
    else if(e.type === 'course-remove') S.courses = S.courses.filter(c => c.name !== e.target);
    else if(e.type === 'briefing' && e.briefing){
      S.briefings = S.briefings.filter(b => b.id !== e.id);
      S.briefings.push({ id:e.id, ...e.briefing });
    }
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
