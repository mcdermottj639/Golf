/* Simulator review: source-labelled observations, never outdoor statistics or carry authority. */
(function(root){
  'use strict';
  const finite = x => typeof x === 'number' && Number.isFinite(x);
  function esc(x){
    return String(x == null ? '' : x)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  const num = x => finite(x) ? x.toFixed(1) : '—';
  const mean = xs => xs.length ? xs.reduce((a,b)=>a+b,0)/xs.length : null;
  const label = k => ({
    driver:'Driver',
    '3-wood':'3-wood',
    '5-wood':'5-wood',
    '2-iron':'2-iron',
    '5-iron':'5-iron',
    '6-iron':'6-iron',
    '7-iron':'7-iron',
    '9-iron':'9-iron',
    '56-wedge':'56°',
    '60-wedge':'60°'
  }[k] || k);
  const bayKey = k => ({'Driver':'driver','5 wood':'5-wood','56° wedge':'56-wedge'}[k] || k);
  function observations(r){ return Array.isArray(r?.review?.shots) ? r.review.shots : []; }
  function profiles(r,bays){
    const clubMap=r.review?.clubMap||{}, intentByShot=r.review?.intentByShot||{};
    const shots=observations(r).map(s=>({...s,
      actualClub:s.actualClub||clubMap[s.club]||null,
      intent:s.intent||intentByShot[s.id]||'unknown'}));
    return (r.review?.availableClubs || [...new Set(shots.map(s=>s.actualClub).filter(Boolean))]).map(club=>{
      const ss=shots.filter(s=>s.actualClub===club), full=ss.filter(s=>s.intent==='full' && !s.flag);
      const path=full.map(s=>s.path).filter(finite);
      // A recorded comparison stays attached to its source; a newer range import must
      // not silently change the round's baseline or mix two range dates in one table.
      // noBay: this card's clubs are not the same heads as the latest bay of the same name
      // (Spyglass 3-wood vs a Mini labelled 3w, etc.) — leave the bay column blank.
      const latest=r.review?.noBay ? undefined
        : r.review?.bayId ? (bays||[]).find(b=>b._fid===r.review.bayId)
        : (bays||[]).filter(b=>b.date<=r.date && b.detail?.clubs?.some(c=>bayKey(c.club)===club)).sort((a,b)=>b.date.localeCompare(a.date))[0];
      const bay=latest?.detail.clubs.find(c=>bayKey(c.club)===club);
      return {club,ss,full,n:full.length,path:mean(path),pathN:path.length,bay,bayDate:latest?.date,
        distance:mean(full.map(s=>s.distance).filter(finite))};
    });
  }
  function findings(r){
    const holes=Array.isArray(r.holes)?r.holes:[], doubles=holes.filter(h=>finite(h.s)&&finite(h.par)&&h.s-h.par>=2);
    const shots=observations(r), paths=shots.filter(s=>!s.flag&&finite(s.path));
    const neg=paths.filter(s=>s.path<0).length, pos=paths.filter(s=>s.path>0).length;
    const gir=r.review?.trackman?.gir;
    const unconfirmed = !r.review?.bagConfirmed;
    return [
      {title:`${doubles.length} double-bogey-or-worse holes`,body:`Review holes ${doubles.map(h=>h.n).join(', ') || 'not recorded'}. These identify where scoring became expensive; the card alone cannot tell us whether the cause was contact, strategy or recovery.`,holes:doubles.map(h=>h.n)},
      {title:gir?`${gir[0]}/${gir[1]} greens in regulation`:'Approach evidence is incomplete',body:'Compare the tee result with the next shot before blaming iron play. A shot from deep rough is not a fair comparison with a range shot. No shot-by-shot strokes-gained estimate is invented.',holes:[]},
      {title:'Delivery is not one fixed pattern',body:`Among ${paths.length} unflagged captured path readings: ${neg} negative, ${pos} positive, ${paths.length-neg-pos} neutral. This mixes short and long shots and is not a full-swing diagnosis.${unconfirmed ? ' Actual clubs and swing intent remain unconfirmed.' : ''} Judge delivery alongside the result; these readings cannot establish a body-mechanics cause.`,holes:[...new Set(paths.map(s=>s.hole))]}
    ];
  }
  function hub(rounds){
    const rr=(rounds||[]).map((r,i)=>({r,i})).filter(x=>x.r.sim&&x.r.review).sort((a,b)=>b.r.date.localeCompare(a.r.date));
    if(!rr.length)return '';
    return `<h2>Simulator Round Review</h2><div class="card"><p class="sm">Your scoring, shot evidence and next-session test. Separate from outdoor records.</p>${rr.map(({r,i})=>`<button class="linkrow rr-link" data-action="open-round" data-i="${i}"><span><b>${esc(r.course)} · ${esc(r.score)}</b><br><span class="sm faint">${esc(r.date)} · Round Review → club profiles → practice</span></span><span>→</span></button>`).join('')}</div>`;
  }
  function render(r,ctx){
    if(!r.sim||!r.review)return '';
    const clubMap=r.review.clubMap||{}, intentByShot=r.review.intentByShot||{};
    r={...r,review:{...r.review,shots:observations(r).map(s=>({
      ...s,
      actualClub:s.actualClub||clubMap[s.club]||null,
      intent:s.intent||intentByShot[s.id]||'unknown',
      ...(ctx.identities||{})[`${r.feedId}:${s.id}`]
    }))}};
    const q=r.review, shots=observations(r), ps=profiles(r,ctx.bays), tm=q.trackman||{};
    const metric=(v,unit='')=>finite(v)?esc(v)+unit:'—';
    const f=findings(r);
    const fmtPair=x=>Array.isArray(x)?`${x[0]}/${x[1]}`:'—';
    const key=q.testId||'sim-approach-20';
    const tests=(ctx.tests||[]).filter(t=>t.testId===key);
    const bayIndex=(ctx.bays||[]).findIndex(b=>b._fid===q.bayId);
    const bagP = q.bagLine
      ? `<p class="sm"><b>Bag this round:</b> ${esc(q.bagLine)}</p>`
      : `<p class="sm"><b>Actual bag this round:</b> Driver, Mini Driver, 5-wood, 6-iron, 9-iron, 56°. You reported that selected club labels were sometimes left unchanged. Each shot retains its displayed label; actual club remains unconfirmed unless independently identified.</p>`;
    const puttP = q.puttingNote
      ? `<p class="sm faint">${esc(q.puttingNote)}</p>`
      : `<p class="sm faint">Auto-putting reported; approximately 12-foot gimme setting unconfirmed. Putting skill is not evaluated. Ball, normalization, tees and simulator conditions for this round are unconfirmed.</p>`;
    const srcP = q.sources
      ? `<p class="sm">${esc(q.sources)}</p>`
      : `<p class="sm">TrackMan: average drive 217 yd, longest 245 yd, scrambling 13%, assigned putts 29. Companion-app recording: driving distance 224.34 (unit not visible in captured panel), scrambling 66.67% (10/15), total strokes gained −29.76 with benchmark unconfirmed. These are source reports, not reconciled statistics; no combined strokes-gained diagnosis is made.</p>`;
    const holeIntro = q.bagConfirmed
      ? 'Club names below are the shot-list labels. Distance follows each source record; the carry tile is shown separately where available. Missing tiles stay blank. A flag excludes a reading from club summaries.'
      : 'Club names below are selected TrackMan labels, NOT confirmed actual clubs. Distance is the displayed shot distance, not confirmed carry. Face-to-path is calculated as face minus path when both are present. Source times are approximate positions in supplied recordings. A flag excludes a reading from club summaries.';
    const bayFoot = q.noBay
      ? 'Bay comparison is off for this card so a Mini labelled 3w cannot land on a 3-wood row. Full-shot n is this round only.'
      : 'Bay: latest matching club on or before this round. Round profiles require confirmed actual club and full-swing intent. Zero means no eligible identified shots—not no shots hit. TrackMan 3w is not automatically mapped to Mini Driver because labels were sometimes stale.';
    return `<section class="rr" aria-label="Simulator Round Review">
      <h2>Round Review · what to do next</h2>
      ${ctx.bayVisuals||''}
      <div class="card"><div class="rowgrid g3"><div class="stat"><div class="v">${fmtPair(tm.fairways)}</div><div class="l">Fairways · TrackMan</div></div><div class="stat"><div class="v">${fmtPair(tm.gir)}</div><div class="l">Greens · TrackMan</div></div><div class="stat"><div class="v">${metric(tm.averageDrive)}</div><div class="l">Average drive · yd</div></div></div>
      <p class="sm">${shots.length} shot observations across ${new Set(shots.map(s=>s.hole)).size} holes; ${(r.holes||[]).filter(h=>h.s!=null).length} holes have recorded scores. Coverage and unresolved readings are listed below.</p>
      ${q.verificationNote ? `<p class="sm"><b>Source check:</b> ${esc(q.verificationNote)}</p>` : ''}
      ${bagP}
      ${puttP}
      ${bayIndex>=0&&!ctx.bayVisuals&&!q.noBay?`<button class="btn" data-action="open-bay" data-i="${bayIndex}">Compare with Sep 14 Bay session</button>`:''}
      <button class="btn" data-action="go" data-view="bag">Open Bag & playing carries</button></div>
      <h2>Three takeaways · evidence first</h2>${f.map(x=>`<div class="card"><h3>${esc(x.title)}</h3><p class="sm">${esc(x.body)}</p></div>`).join('')}
      <h2>Club profiles · range versus round</h2><div class="card"><p class="sm">Range carry and round shot distance are different fields. No carry-gap arithmetic or playing-yardage updates are made from this comparison. Only explicitly identified full shots enter the round summary; unknown-intent and short shots stay in the ledger.</p>
      <div class="tscroll"><table><thead><tr><th>Club</th><th>Bay carry yd</th><th>Bay path °</th><th>Round distance yd</th><th>Round path °</th><th>Full-shot n</th></tr></thead><tbody>${ps.map(p=>`<tr><td>${esc(label(p.club))}</td><td>${num(p.bay?.carry)}</td><td>${num(p.bay?.path)}</td><td>${num(p.distance)}</td><td>${num(p.path)} <small>(n=${p.pathN})</small></td><td>${p.n}</td></tr>`).join('')}</tbody></table></div>
      <p class="sm faint">${esc(bayFoot)}</p></div>
      ${q.bagConfirmed?'':`<details class="card"><summary>Optional · identify a shot's actual club</summary><p class="sm">Only correct shots you remember. Your correction is saved separately from the imported label and survives feed updates. Leave the rest unknown.</p><div class="rr-form"><label>Shot<select id="rrshot">${shots.map(s=>`<option value="${esc(s.id)}">H${s.hole} · ${esc(s.club)} label · ${metric(s.distance)} yd · actual ${esc(s.actualClub||'unknown')}</option>`).join('')}</select></label><label>Actual club<select id="rrclub"><option value="">Unknown / clear correction</option>${(q.availableClubs||[]).map(c=>`<option value="${esc(c)}">${esc(label(c))}</option>`).join('')}</select></label><label>Swing intent<select id="rrintent"><option value="unknown">Unknown</option><option value="full">Full swing</option><option value="partial">Partial / chip</option><option value="recovery">Recovery</option></select></label><button class="btn" data-action="save-review-identity" data-round="${esc(r.feedId)}">Save shot identity</button></div></details>`}
      <h2>Hole evidence · inspect the shots</h2><div class="card"><p class="sm faint">${esc(holeIntro)}</p>
      ${(r.holes||[]).map(h=>`<details class="sect"><summary><b>Hole ${h.n} · ${h.s} on par ${h.par ?? '—'}</b><span class="gist">${shots.filter(s=>s.hole===h.n).length} captured observations</span></summary>${shots.filter(s=>s.hole===h.n).map(s=>`<article class="rr-shot"><h3>${esc(label(s.club))} · ${metric(s.distance,' yd')} → ${esc(s.lie||'lie not shown')}</h3><p class="sm">${esc(s.intent||'unknown')} swing intent${s.proximity?` · finishes ${esc(s.proximity)} from hole`:''}${s.restYds!=null?` · ${esc(s.restYds)} yds to hole`:''}</p>${[s.spin,s.carry,s.ftp,s.smash,s.face,s.bs].some(finite)?`<div class="tscroll"><table><thead><tr><th>Spin rpm</th><th>Carry yd</th><th>Face–path °</th><th>Smash</th><th>Face °</th><th>Ball mph</th></tr></thead><tbody><tr>${[s.spin,s.carry,s.ftp,s.smash,s.face,s.bs].map(x=>`<td>${num(x)}</td>`).join('')}</tr></tbody></table></div>`:''}<div class="tscroll"><table><thead><tr><th>Club mph</th><th>Attack °</th><th>Path °</th><th>Face °</th><th>F–P °</th><th>Dynamic loft °</th><th>Spin loft °</th></tr></thead><tbody><tr>${[s.cs,s.aoa,s.path,s.face,finite(s.face)&&finite(s.path)?s.face-s.path:null,s.loft,s.spinLoft].map(x=>`<td>${num(x)}</td>`).join('')}</tr></tbody></table></div>${s.flag?`<p class="sm"><b>Check reading:</b> ${esc(s.flag)}</p>`:''}<p class="sm faint">${esc(s.source)}</p></article>`).join('')||'<p class="sm">Score captured; no verified shot observation imported for this hole yet.</p>'}</details>`).join('')}</div>
      <h2>Next-session test · establish a baseline</h2><div class="card"><h3>20 balls · approach repeatability</h3><p class="sm">10 shots to a 125-yard target and 10 to a 150-yard target. Keep the ball, normalization, target, lie and chosen club for each target the same when repeating. Count shots finishing within 15 yards of each target. Record every attempt; this is a new baseline, not a promised score improvement.</p><button class="btn" data-action="open-lesson" data-id="sim-approach-repeatability">Open practice lesson</button>
      <div class="rr-form"><label>125 yd · successes / 10<input id="rr125" type="number" min="0" max="10" step="1" inputmode="numeric"></label><label>150 yd · successes / 10<input id="rr150" type="number" min="0" max="10" step="1" inputmode="numeric"></label><label>Clubs & conditions<input id="rrconditions" maxlength="200" placeholder="Clubs, ball, normalization, lie"></label><button class="btn" data-action="save-review-test" data-test="${esc(key)}">Save test result</button></div><p class="sm" id="rr-error" role="status"></p>
      ${tests.length?`<div class="tscroll"><table><thead><tr><th>Date</th><th>125 yd</th><th>150 yd</th><th>Conditions</th></tr></thead><tbody>${tests.map(t=>`<tr><td>${esc(t.date)}</td><td>${t.a}/10</td><td>${t.b}/10</td><td>${esc(t.conditions)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="sm faint">No tests logged yet. Repeated tests belong here; reading the lesson is not completing the test.</p>'}</div>
      <h2>Simulator progress · separate record</h2><div class="card"><div class="tscroll"><table><thead><tr><th>Date / course</th><th>Score</th><th>Double+</th><th>FW</th><th>GIR</th></tr></thead><tbody>${(ctx.rounds||[]).filter(x=>x.sim&&x.review).sort((a,b)=>a.date.localeCompare(b.date)).map(x=>`<tr><td>${esc(x.date)} · ${esc(x.course)}</td><td>${x.score}</td><td>${(x.holes||[]).filter(h=>h.s-h.par>=2).length}</td><td>${fmtPair(x.review.trackman?.fairways)}</td><td>${fmtPair(x.review.trackman?.gir)}</td></tr>`).join('')}</tbody></table></div><p class="sm faint">One round is a baseline, not a trend. Different courses and settings are not directly comparable. Test results above use a fixed protocol; confirm matching conditions before comparing.</p></div>
      <details class="card"><summary>Sources & unresolved differences</summary>${srcP}<p class="sm">${esc(q.coverage||'')}</p></details>
    </section>`;
  }
  root.CaddieReview={observations,profiles,findings,hub,render};
  if(typeof module!=='undefined')module.exports=root.CaddieReview;
})(typeof window!=='undefined'?window:globalThis);
