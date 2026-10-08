/* Course Prep: local plans + sourced routes; Google imagery is optional and lazy. */
(function () {
  'use strict';
  const course = window.CADDIE_PREP_COURSES[0];
  const KEY = 'caddiehq_google_maps_key_v1';
  const RESUME = 'caddiehq_course_prep_resume_v1';
  const rad = x => x * Math.PI / 180;
  const deg = x => x * 180 / Math.PI;
  const esc = x => String(x == null ? '' : x).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pointOK = p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) &&
    p[0] > 41.165 && p[0] < 41.185 && p[1] > -73.585 && p[1] < -73.555;
  function distance(a, b) {
    const h = Math.sin(rad(b[0] - a[0]) / 2) ** 2 +
      Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(rad(b[1] - a[1]) / 2) ** 2;
    return 6371008.8 * 2 * Math.asin(Math.min(1, Math.sqrt(h))) / 0.9144;
  }
  function bearing(a, b) {
    const d = rad(b[1] - a[1]);
    return (deg(Math.atan2(Math.sin(d) * Math.cos(rad(b[0])),
      Math.cos(rad(a[0])) * Math.sin(rad(b[0])) - Math.sin(rad(a[0])) * Math.cos(rad(b[0])) * Math.cos(d))) + 360) % 360;
  }
  function destination(a, yards, heading) {
    const d = yards * 0.9144 / 6371008.8, h = rad(heading), lat = rad(a[0]), lng = rad(a[1]);
    const endLat = Math.asin(Math.sin(lat) * Math.cos(d) + Math.cos(lat) * Math.sin(d) * Math.cos(h));
    return [deg(endLat), deg(lng + Math.atan2(Math.sin(h) * Math.sin(d) * Math.cos(lat), Math.cos(d) - Math.sin(lat) * Math.sin(endLat)))];
  }
  function clean(input) {
    const src = input && typeof input === 'object' ? input : {};
    const out = { tee: course.tees.some(t => t.id === src.tee) ? src.tee : course.defaultTee,
      basis: src.basis === 'range' ? 'range' : 'playing', holes: {} };
    for (const t of course.tees) for (let n = 1; n <= 18; n++) {
      const k = t.id + ':' + n, h = src.holes && src.holes[k];
      if (!h || typeof h !== 'object') continue;
      out.holes[k] = {
        note: typeof h.note === 'string' ? h.note.slice(0, 1800) : '',
        roll: Number.isFinite(+h.roll) ? Math.max(0, Math.min(60, +h.roll)) : 0,
        reviewed: h.reviewed === true,
        ...(pointOK(h.tee) ? {tee: h.tee.slice()} : {}),
        ...(pointOK(h.target) ? {target: h.target.slice()} : {})
      };
    }
    return out;
  }
  let bridge, root, hole = 1, mode = 'route', overview = false, edit = 'target';
  let epoch = 0, googlePromise, googleKey, googleFailure = '', googleFailureMode = '', maps2d, maps3d, overlays2d = [];
  let googleAuthFailed = false;
  let projection = null, imageError = false, animationHandler, animationTimer, bagSnapshot;
  const model = () => clean(bridge.get());
  const currentHole = () => course.holes[hole - 1];
  const teeSet = () => course.tees.find(t => t.id === model().tee);
  const holeKey = () => model().tee + ':' + hole;
  const savedHole = () => model().holes[holeKey()] || {};
  const origin = () => pointOK(savedHole().tee) ? savedHole().tee : currentHole().path[0];
  const green = () => currentHole().path.at(-1);
  const target = () => pointOK(savedHole().target) ? savedHole().target : green();
  const bag = () => bagSnapshot || (bagSnapshot = bridge.bag(model().basis));
  const selected = () => bag().find(c => c.key === bridge.club(hole)) || null;
  const yard = n => Math.round(n).toLocaleString('en-US');
  function key() { try { return localStorage.getItem(KEY) || window.CADDIE_GOOGLE_MAPS_KEY || ''; } catch { return window.CADDIE_GOOGLE_MAPS_KEY || ''; } }
  function reconnectGoogle() {
    // Google retains authorization inside its loaded SDK. Start a new page session
    // after changing Cloud settings, keeping the user's current hole and map view.
    try { sessionStorage.setItem(RESUME, JSON.stringify({hole, mode})); } catch {}
    window.location.reload();
  }
  function resumeAfterReload() {
    let pending;
    try { pending = JSON.parse(sessionStorage.getItem(RESUME) || 'null'); sessionStorage.removeItem(RESUME); } catch { return false; }
    if(!pending || !Number.isInteger(pending.hole) || pending.hole < 1 || pending.hole > 18 || !['route','guide','satellite','3d'].includes(pending.mode)) return false;
    hole = pending.hole; mode = pending.mode; overview = false; return true;
  }
  function saveHole(patch) {
    const next = model(), k = holeKey();
    next.holes[k] = {...(next.holes[k] || {}), ...patch};
    bridge.save(clean(next));
    status('Saved on this device');
    const row = root?.querySelector('.cp-plan-table [data-n="' + hole + '"] > span:last-child');
    if (row) row.textContent = next.holes[k].note || (next.holes[k].reviewed ? 'Reviewed' : 'Add a plan');
  }
  function status(text) { const el = root && root.querySelector('#cp-save-status'); if (el) el.textContent = text; }
  const button = (action, label, extra) => '<button type="button" data-cp="' + action + '" ' + (extra || '') + '>' + label + '</button>';
  const link = (url, label) => '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + label + '</a>';
  function teaser() {
    return '<section class="cp-entry"><div><span class="cp-eyebrow">COURSE PREP · 18 HOLES</span><h2 data-no-fold>Pound Ridge, before the first tee.</h2><p>Explore every hole. Put your bag on the map. Save your plan.</p></div>' +
      '<button class="hq-btn" data-action="open-course-prep">Prepare Pound Ridge <span aria-hidden="true">↗</span></button></section>';
  }
  function setup() {
    return '<details class="cp-setup" id="cp-setup"><summary>Google Maps setup <span>' + (key() ? 'Key saved' : 'Connect satellite & 3D') + '</span></summary>' +
      '<p>Enable Maps JavaScript API and billing in the same Google Cloud project as your key. Choose Websites as the application restriction, including on iPhone, and restrict the key to Maps JavaScript API. ' +
      link('https://console.cloud.google.com/google/maps-apis/credentials', 'Open Google setup ↗') + '</p>' +
      '<label for="cp-api-key">Browser API key</label><div class="cp-key-row"><input id="cp-api-key" type="password" autocomplete="off" spellcheck="false" placeholder="' + (key() ? 'A key is saved · paste to replace' : 'Paste your restricted key') + '">' +
      button('key-save', 'Connect') + (key() ? button('key-clear', 'Disconnect') : '') + '</div>' +
      '<p class="cp-muted">Saved only on this device, outside golf backups. Restrict the website to https://mcdermottj639.github.io/* and set usage limits in Google Cloud. Maps need internet; course routes and your saved notes work offline after loading.</p></details>';
  }
  function render() {
    bagSnapshot = null;
    const m = model(), t = teeSet(), h = currentHole(), hs = savedHole();
    const count = course.holes.filter(x => m.holes[m.tee + ':' + x.n]?.reviewed).length;
    return '<div class="cp-workspace" id="course-prep"><button class="backlink" data-action="go" data-view="rounds" data-seg="prep">← All round prep</button>' +
      '<section class="cp-hero"><div><span class="cp-eyebrow">YOUR NEXT COURSE</span><h2 data-no-fold>Pound Ridge<span>Know the shot before you play it.</span></h2><p>18 holes · Par 72 · Pound Ridge, NY</p></div>' +
      '<div class="cp-tee-control"><label for="cp-tees">Explore from</label><select id="cp-tees">' + course.tees.map(x => '<option value="' + x.id + '" ' + (x.id === t.id ? 'selected' : '') + '>' + x.name + ' · ' + yard(x.total) + ' yd</option>').join('') +
      '</select><span>' + (t.rating ? t.rating.toFixed(1) + ' rating · ' + t.slope + ' slope · men' : 'Men’s rating not on the published card') + '</span></div></section>' +
      '<div class="cp-progress"><span><b id="cp-reviewed-count">' + count + '/18</b> holes reviewed</span><span id="cp-save-status" role="status" aria-live="polite">Plans saved on this device</span></div>' +
      '<div class="cp-holes" role="group" aria-label="Choose a hole">' + course.holes.map(x => '<button type="button" data-cp="hole" data-n="' + x.n + '" aria-label="Hole ' + x.n + ', par ' + x.par + '" ' + (x.n === hole ? 'aria-current="step"' : '') + ' class="' + (m.holes[m.tee + ':' + x.n]?.reviewed ? 'reviewed' : '') + '"><b>' + x.n + '</b><span>Par ' + x.par + '</span></button>').join('') + '</div>' +
      '<div class="cp-grid"><section class="cp-map-panel"><header class="cp-hole-heading"><div><span class="cp-eyebrow">' + esc(t.name) + ' TEES</span><h3>Hole ' + hole + '<small>Par ' + h.par + ' · ' + yard(t.yards[hole - 1]) + ' yd · Hcp ' + h.si + '</small></h3></div><div class="cp-arrows">' +
      button('previous', '←', 'aria-label="Previous hole" ' + (hole === 1 ? 'disabled' : '')) + button('next', '→', 'aria-label="Next hole" ' + (hole === 18 ? 'disabled' : '')) + '</div></header>' +
      '<div class="cp-modes" role="group" aria-label="Map view">' + [['guide','Hole guide'],['route','Course map'],['satellite','Satellite'],['3d','Google 3D']].map(([k,v]) => button('mode', v, 'data-mode="' + k + '" aria-pressed="' + (mode === k) + '"')).join('') + '</div>' +
      '<div class="cp-map-stage" id="cp-map-stage"></div><div id="cp-map-controls"></div><div class="cp-map-caption" id="cp-map-caption"></div></section>' +
      '<aside class="cp-plan"><section class="cp-plan-card"><span class="cp-eyebrow">THE PLAN</span><h3>' + (h.par === 3 ? 'Choose the carry.' : h.par === 5 ? 'Build it shot by shot.' : 'Pick your landing area.') + '</h3><p class="cp-prompt">' + esc(h.prompt) + '</p>' +
      '<label for="cp-basis">Distance source</label><select id="cp-basis"><option value="playing" '+(m.basis==='playing'?'selected':'')+'>Saved playing carries</option><option value="range" '+(m.basis==='range'?'selected':'')+'>Latest range measurements</option></select>' +
      '<p class="cp-muted">'+(m.basis==='range'?'Range conditions and club settings may differ from this round. These are planning references; your Bag stays unchanged.':'Switch to range measurements to compare clubs whose playing carry is still unset.')+'</p>' +
      '<label>Your tee club</label><div class="cp-clubs" role="group" aria-label="Choose your tee club">' + bag().map(c => button('club', '<b>' + esc(c.label) + '</b><span>' + (c.carry>0?yard(c.carry)+' yd':'Unset') + '</span>', 'data-club="' + esc(c.key) + '" aria-pressed="' + (bridge.club(hole) === c.key) + '"')).join('') + '</div>' +
      (!bag().length ? '<p>Add a playing carry in your Bag to place a club on the map.</p>' : '') +
      '<div id="cp-club-readout"></div>' +
      '<label for="cp-roll">Rollout assumption <span id="cp-roll-label">' + (hs.roll || 0) + ' yd</span></label><input id="cp-roll" type="range" min="0" max="60" step="1" value="' + (hs.roll || 0) + '">' +
      '<p class="cp-muted">Added rollout is your scenario, not a prediction of these fairways. Carry rings show distance, not shot dispersion.</p></section>' +
      '<section class="cp-plan-card"><h3>Your hole note</h3><label class="cp-muted" for="cp-note">Target, miss to avoid, or next-shot idea</label><textarea id="cp-note" rows="3" maxlength="1800" placeholder="e.g. 5W to the open side; check the front-edge carry…">' + esc(hs.note || '') + '</textarea>' +
      '<label class="cp-reviewed"><input type="checkbox" id="cp-reviewed" ' + (hs.reviewed ? 'checked' : '') + '> I’ve reviewed this hole</label>' +
      '<p class="cp-muted">Your tee-club choice and note also appear in the live-round prep for Pound Ridge.</p></section></aside></div>' +
      '<details class="cp-round-plan" id="cp-round-plan"><summary>Your 18-hole plan <span>Club choices & notes</span></summary><div class="cp-plan-table">' +
      course.holes.map(x => {
        const s = m.holes[m.tee + ':' + x.n] || {}, c = bag().find(y => y.key === bridge.club(x.n));
        return '<button type="button" data-cp="hole" data-n="' + x.n + '"><b>' + x.n + '</b><span>Par ' + x.par + ' · ' + t.yards[x.n - 1] + ' yd</span><strong>' + esc(c?.label || 'Choose club') + '</strong><span>' + esc(s.note || (s.reviewed ? 'Reviewed' : 'Add a plan')) + '</span></button>';
      }).join('') + '</div></details>' +
      setup() +
      '<details class="cp-sources" id="cp-sources"><summary>Sources & map accuracy</summary><p>Yardages and men’s ratings were read from the club’s scorecard (printed 01/24), checked October 8, 2026. Tee selection changes the scorecard yardage; the route starts at an unspecified mapped tee until you set your own tee position.</p>' +
      '<p>Map distances are approximate horizontal measurements, not laser yardages or slope-adjusted plays-like distances. The map is incomplete: unmarked areas may contain hazards. Google 3D detail varies by location; it does not show today’s pins or putting contours.</p>' +
      '<p>' + link(course.source, 'Official scorecard') + ' · ' + link(course.tour, 'Official hole guides') + ' · ' + link('https://www.openstreetmap.org/copyright', '© OpenStreetMap contributors · ODbL') + ' · <a href="./data/course-prep/pound-ridge-osm.json" download>Map source data</a></p></details></div>';
  }
  function redraw() { bridge.refresh(); }
  function changeHole(n) { if (!Number.isInteger(n) || n < 1 || n > 18) return; stopFlyover(); hole = n; imageError = false; overview = false; redraw(); }
  function stopFlyover() {
    if (animationHandler && maps3d) maps3d.removeEventListener('gmp-animationend', animationHandler);
    animationHandler = null;
    clearTimeout(animationTimer);
    try { maps3d?.stopCameraAnimation(); } catch {}
  }
  function unmount() { epoch++; stopFlyover(); root = null; }
  function mount(node) {
    root = node;
    if (!root) return;
    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    root.addEventListener('change', onChange);
    root.addEventListener('keydown', e => {
      const el = e.target.closest('[data-cp="map-hole"]');
      if (el && ['Enter',' '].includes(e.key)) { e.preventDefault(); changeHole(+el.dataset.n); }
    });
    drawView();
    readout();
  }
  function onClick(e) {
    const el = e.target.closest('[data-cp]');
    if (!el || !root?.contains(el)) return;
    switch (el.dataset.cp) {
      case 'hole': case 'map-hole': changeHole(+el.dataset.n); break;
      case 'previous': changeHole(hole - 1); break;
      case 'next': changeHole(hole + 1); break;
      case 'mode':
        stopFlyover(); mode = el.dataset.mode;
        if(googleFailureMode && googleFailureMode !== mode) googleFailure = '';
        overview = false; redraw(); break;
      case 'club': bridge.setClub(hole, el.dataset.club); redraw(); break;
      case 'overview': overview = !overview; drawView(); break;
      case 'edit': edit = el.dataset.kind; drawControls(); break;
      case 'clear-target': saveHole({target: undefined}); drawView(); readout(); break;
      case 'reset-tee': saveHole({tee: undefined}); drawView(); readout(); break;
      case 'map-setup': root.querySelector('#cp-setup').open = true; root.querySelector('#cp-api-key').focus(); break;
      case 'key-save': {
        const value = root.querySelector('#cp-api-key').value.trim();
        if (!/^AIza[0-9A-Za-z_-]{20,}$/.test(value)) return bridge.toast('Paste a valid Google Maps browser key');
        try { localStorage.setItem(KEY, value); } catch { return bridge.toast('Could not save the key on this device'); }
        if (googleKey && (googleKey !== value || googleAuthFailed)) { reconnectGoogle(); return; }
        googleFailure = ''; googlePromise = undefined; redraw(); bridge.toast('Maps key saved'); break;
      }
      case 'key-clear':
        try { localStorage.removeItem(KEY); } catch {}
        mode = 'route'; googleFailure = ''; redraw(); bridge.toast('Saved Maps key removed'); break;
      case 'retry': reconnectGoogle(); break;
      case 'fly': flyover(); break;
      case 'stop': stopFlyover(); break;
      case 'zoom-in': if (maps3d && mode === '3d') maps3d.range = Math.max(100, maps3d.range * 0.7); break;
      case 'zoom-out': if (maps3d && mode === '3d') maps3d.range = Math.min(5000, maps3d.range / 0.7); break;
    }
  }
  function onInput(e) {
    if (e.target.id === 'cp-note') saveHole({note: e.target.value});
    if (e.target.id === 'cp-roll') {
      saveHole({roll: +e.target.value});
      root.querySelector('#cp-roll-label').textContent = e.target.value + ' yd';
      readout(); refreshOverlays();
    }
  }
  function onChange(e) {
    if (e.target.id === 'cp-tees') { const m = model(); m.tee = e.target.value; bridge.save(clean(m)); redraw(); }
    if (e.target.id === 'cp-basis') { const m = model(); m.basis = e.target.value; bridge.save(clean(m)); redraw(); }
    if (e.target.id === 'cp-reviewed') {
      saveHole({reviewed: e.target.checked});
      const m = model(), count = course.holes.filter(h => m.holes[m.tee + ':' + h.n]?.reviewed).length;
      root.querySelector('#cp-reviewed-count').textContent = count + '/18';
      root.querySelector('.cp-holes [data-n="' + hole + '"]').classList.toggle('reviewed', e.target.checked);
    }
  }
  function readout() {
    if (!root) return;
    const c = selected(), roll = savedHole().roll || 0;
    const toTarget = distance(origin(), target()), toGreen = distance(target(), green());
    const selectedKey = bridge.club(hole);
    let html = '<div class="cp-distances"><span><b>' + yard(toTarget) + '</b>yd to ' + (savedHole().target ? 'your target' : 'mapped green') + '</span><span><b>' + yard(toGreen) + '</b>yd target → green</span></div>';
    if (c && c.carry > 0) {
      html += '<div class="cp-club-summary"><b>' + esc(c.label) + ' · ' + yard(c.carry) + ' yd carry</b><span>' + esc(c.provenance) + '</span>' +
        (roll ? '<span>' + yard(c.carry + roll) + ' yd with your +' + roll + ' yd rollout assumption</span>' : '<span>Carry only · no rollout assumed</span>') + '</div>';
      if(c.rangeTotal>0) html += '<p class="cp-muted">Same range batch: '+yard(c.rangeTotal)+' yd total. This is measured range context, not predicted rollout here.</p>';
      const gap = toTarget - c.carry;
      html += '<p class="cp-muted">At this mapped distance, your carry is about ' + yard(Math.abs(gap)) + ' yd ' + (gap >= 0 ? 'short of' : 'past') + ' the target. Check the tee position and conditions at the course.</p>';
    } else html += '<p class="cp-muted">' + (c ? 'This club has no carry for the selected distance source. Try latest range measurements or set its playing carry in Bag.' : selectedKey ? 'Your saved club is no longer in the active carry ladder. Choose a current club above.' : 'Choose a club to show its carry ring and compare it with your target.') + '</p>';
    root.querySelector('#cp-club-readout').innerHTML = html;
  }
  function projectFor(all) {
    const points = all ? course.holes.flatMap(h => h.path) : [...currentHole().path, origin(), target()];
    const clat = points.reduce((s,p) => s + p[0],0) / points.length;
    const xy = p => [p[1] * Math.cos(rad(clat)) * 111195, -p[0] * 111195];
    const projected = points.map(xy), xs = projected.map(p => p[0]), ys = projected.map(p => p[1]);
    let left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
    const padding = all ? 80 : 55;
    left -= padding; right += padding; top -= padding; bottom += padding;
    const scale = Math.min(600 / (right-left), 500 / (bottom-top));
    const mx = (left+right)/2, my = (top+bottom)/2;
    return {scale, to:p=>{const [x,y]=xy(p);return [300+(x-mx)*scale,250+(y-my)*scale];},
      from:p=>[-(my+(p[1]-250)/scale)/111195,(mx+(p[0]-300)/scale)/(111195*Math.cos(rad(clat)))]};
  }
  function svgMap() {
    projection = projectFor(overview);
    const path = pts => pts.map(p => projection.to(p).map(x => x.toFixed(2)).join(',')).join(' ');
    const pnt = (p, color, label) => {
      const [x,y]=projection.to(p);
      return '<g><circle cx="'+x+'" cy="'+y+'" r="8" fill="'+color+'" stroke="#fff" stroke-width="3"/><text x="'+(x+12)+'" y="'+(y+5)+'" class="cp-map-label">'+label+'</text></g>';
    };
    const polys = course.features.map(f => '<polygon points="'+path(f.path)+'" class="cp-feature cp-feature-'+f.kind+'"/>').join('');
    const lines = course.holes.map(h => {
      const [x,y]=projection.to(h.path[0]);
      return '<g data-cp="map-hole" data-n="'+h.n+'"'+(overview?' tabindex="0" role="button" aria-label="Explore hole '+h.n+'"':'')+'><polyline points="'+path(h.path)+'" class="cp-route-line '+(h.n===hole?'selected':'')+'"/>'+
        (overview?'<circle cx="'+x+'" cy="'+y+'" r="14" class="cp-hole-dot"/><text x="'+x+'" y="'+(y+5)+'" text-anchor="middle" class="cp-hole-number">'+h.n+'</text>':'')+'</g>';
    }).join('');
    let overlay = '';
    if (!overview) {
      const c=selected(), [x,y]=projection.to(origin()), roll=savedHole().roll||0;
      if (c && c.carry > 0) {
        overlay += '<circle cx="'+x+'" cy="'+y+'" r="'+(c.carry*0.9144*projection.scale)+'" class="cp-carry-ring"/>';
        if (roll) overlay += '<circle cx="'+x+'" cy="'+y+'" r="'+((c.carry+roll)*0.9144*projection.scale)+'" class="cp-roll-ring"/>';
      }
      overlay += '<polyline points="'+path([origin(),target(),green()])+'" class="cp-aim-line"/>' +
        pnt(origin(),'#bbd67d','Tee') + pnt(green(),'#e8e4ca','Green') +
        (savedHole().target ? pnt(target(),'#e39b4e','Target') : '');
    }
    const scaleYards = overview ? 200 : 50, scaleWidth=scaleYards*0.9144*projection.scale;
    return '<svg id="cp-route-map" viewBox="0 0 600 500" preserveAspectRatio="xMidYMid meet" aria-label="Approximate mapped routes for Pound Ridge. '+(overview?'Choose a hole.':'Click to set your target or tee.')+'" role="img">'+
      '<defs><pattern id="cp-grid" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M30 0H0V30" fill="none" stroke="#ffffff" stroke-opacity=".04"/></pattern></defs>'+
      '<rect width="600" height="500" fill="#163f34"/><rect width="600" height="500" fill="url(#cp-grid)"/>'+polys+lines+overlay+
      '<g class="cp-map-scale"><path d="M25 462v8h'+scaleWidth+'v-8" fill="none" stroke="currentColor" stroke-width="2"/><text x="25" y="452">'+scaleYards+' yd</text><text x="562" y="35">N ↑</text></g></svg>';
  }
  function drawControls() {
    if (!root) return;
    const el = root.querySelector('#cp-map-controls');
    const mapped = mode !== 'guide' && (mode === 'route' || (!!key() && !googleFailure));
    el.innerHTML = '<div class="cp-map-tools">' + (mode === 'route' ? button('overview', overview ? 'Focus this hole' : 'All 18 holes') : '') +
      (mapped && !overview ? button('edit','Set target','data-kind="target" aria-pressed="'+(edit==='target')+'"')+button('edit','Set tee','data-kind="tee" aria-pressed="'+(edit==='tee')+'"') : '') +
      (mode === '3d' && mapped ? button('fly','Fly this hole')+button('stop','Stop')+button('zoom-in','＋','aria-label="Zoom in"')+button('zoom-out','−','aria-label="Zoom out"'):'') +
      (savedHole().target ? button('clear-target','Clear target'):'') + (savedHole().tee ? button('reset-tee','Reset tee'):'') + '</div>';
    root.querySelector('#cp-map-caption').innerHTML = mode === 'guide'
      ? 'Official club illustration · not to scale. '+link(course.tour,'Open course guide ↗')
      : (overview ? '18 mapped routes. Select a hole to plan a shot.' : 'Tap to set your '+edit+'. '+(savedHole().tee?'Your tee position.':'Mapped reference tee; set yours before comparing distances.'))+
        '<span>Approximate routes · incomplete hazard coverage · '+link('https://www.openstreetmap.org/copyright','© OpenStreetMap contributors')+'</span>';
  }
  async function drawView() {
    if (!root) return;
    const token=++epoch, stage=root.querySelector('#cp-map-stage');
    stopFlyover();
    stage.replaceChildren();
    drawControls();
    if (mode==='guide') {
      stage.innerHTML = '<figure class="cp-guide"><img id="cp-guide-image" src="'+esc(currentHole().guide)+'" alt="Pound Ridge official illustration of hole '+hole+'" referrerpolicy="no-referrer"><figcaption>Hole '+hole+' · Official club guide</figcaption></figure>';
      stage.querySelector('img').addEventListener('error',()=>{
        if(token!==epoch||!root)return; imageError=true;
        stage.innerHTML='<div class="cp-map-message"><b>The club’s image is unavailable here.</b><p>Your course map and saved plan are still ready.</p>'+button('mode','Open course map','data-mode="route"')+link(course.tour,'Open the club’s guide ↗')+'</div>';
      });
      return;
    }
    if (mode==='route') {
      stage.innerHTML=svgMap();
      stage.querySelector('svg').addEventListener('click',e=>{
        if(overview)return;
        // A route line is background while planning, not a hole-navigation target.
        e.stopPropagation();
        const svg=e.currentTarget, p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;
        const at=p.matrixTransform(svg.getScreenCTM().inverse());
        choosePoint(projection.from([at.x,at.y]));
      });
      return;
    }
    if (!key()) {
      stage.innerHTML='<div class="cp-map-message"><span class="cp-orbit" aria-hidden="true">◎</span><h3>'+ (mode==='3d'?'Explore Pound Ridge in 3D':'Google satellite view') +'</h3><p>Connect your Google Maps key to load this view inside Caddie HQ.</p>'+button('map-setup','Connect Google Maps')+button('mode','Use the course map','data-mode="route"')+link('https://www.google.com/maps/search/?api=1&query=Pound+Ridge+Golf+Club','Open Pound Ridge in Google Maps ↗')+'</div>';
      return;
    }
    if (googleFailure) return mapError(googleFailure, googleFailureMode);
    stage.innerHTML='<div class="cp-map-message" role="status">Loading Google '+(mode==='3d'?'3D':'satellite')+'…</div>';
    try {
      await loadGoogle();
      if(token!==epoch||!root)return;
      if(mode==='satellite') {
        const [lib]=await Promise.all([google.maps.importLibrary('maps'),google.maps.importLibrary('marker')]);
        if(token!==epoch||!root)return;
        if(!maps2d) {
          const div=document.createElement('div');div.className='cp-google-map';
          maps2d=new lib.Map(div,{center:ll(course.center),zoom:16,mapTypeId:'satellite',gestureHandling:'cooperative',streetViewControl:false,mapTypeControl:false,fullscreenControl:false});
          maps2d.addListener('click',e=>{if(e.latLng)choosePoint([e.latLng.lat(),e.latLng.lng()]);});
        }
        stage.replaceChildren(maps2d.getDiv());
        const bounds=new google.maps.LatLngBounds();[...currentHole().path,origin(),target()].forEach(p=>bounds.extend(ll(p)));
        maps2d.fitBounds(bounds,55);drawGoogle2d();
      } else {
        const lib=await google.maps.importLibrary('maps3d');
        if(token!==epoch||!root)return;
        if(!maps3d) {
          maps3d=new lib.Map3DElement({center:ll(course.center),range:1600,tilt:55,mode:'SATELLITE',gestureHandling:'COOPERATIVE'});
          maps3d.className='cp-google-map';
          maps3d.addEventListener('gmp-click',e=>{if(e.position)choosePoint([e.position.lat,e.position.lng]);});
          maps3d.addEventListener('gmp-error',()=>{if(root&&mode==='3d')mapError('3D could not initialize on this device. Try Satellite or the course map.','3d');});
        }
        stage.replaceChildren(maps3d);
        const path=currentHole().path, mid=path[Math.floor(path.length/2)];
        // Clamp the camera target to terrain without guessing an absolute elevation.
        maps3d.flyCameraTo({endCamera:{center:ll(mid),altitudeMode:'CLAMP_TO_GROUND',
          range:Math.max(750,distance(path[0],path.at(-1))*1.8),heading:bearing(path[0],path.at(-1)),tilt:55},durationMillis:0});
        drawGoogle3d(lib);
      }
    } catch { if(token===epoch&&root)mapError(googleFailure||'Google Maps could not load. Check the key, billing, website restrictions and internet connection.'); }
  }
  const ll = p => ({lat:p[0],lng:p[1]});
  function choosePoint(p) {
    if(!pointOK(p))return bridge.toast('Choose a point within the Pound Ridge course area');
    saveHole({[edit]:p.map(x=>+x.toFixed(7))});readout();refreshOverlays();drawControls();
  }
  function refreshOverlays() {
    if(!root)return;
    if(mode==='route')drawView();
    else if(mode==='satellite'&&maps2d)drawGoogle2d();
    else if(mode==='3d'&&maps3d)drawGoogle3d(google.maps.maps3d);
  }
  function loadGoogle() {
    if(window.google?.maps?.importLibrary)return Promise.resolve();
    if(googlePromise)return googlePromise;
    googleKey=key();
    googlePromise=new Promise((resolve,reject)=>{
      const old=document.getElementById('cp-google-script');if(old)old.remove();
      const script=document.createElement('script');script.id='cp-google-script';script.async=true;
      let done=false;
      const end=(error)=>{if(done)return;done=true;clearTimeout(timer);if(error){googlePromise=undefined;reject(error);}else resolve();};
      const timer=setTimeout(()=>end(new Error('Maps timeout')),15000);
      window.__caddieMapsReady=()=>end();
      window.gm_authFailure=()=>{epoch++;googleAuthFailed=true;googleFailure='Google rejected the Maps key. Check Maps JavaScript API, billing and website restrictions.';end(new Error(googleFailure));mapError(googleFailure);};
      script.onerror=()=>end(new Error('Maps network error'));
      script.src='https://maps.googleapis.com/maps/api/js?key='+encodeURIComponent(googleKey)+'&loading=async&v=weekly&callback=__caddieMapsReady';
      document.head.appendChild(script);
    });
    return googlePromise;
  }
  function mapError(message, failedMode = '') {
    googleFailure=message;googleFailureMode=failedMode;
    if(!root||!['3d','satellite'].includes(mode))return;
    stopFlyover();
    root.querySelector('#cp-map-stage').innerHTML='<div class="cp-map-message"><h3>Google Maps is unavailable</h3><p>'+esc(message)+'</p>'+button('mode','Use the course map','data-mode="route"')+button('retry','Reload & retry')+button('map-setup','Maps setup')+'</div>';
    drawControls();
  }
  function drawGoogle2d() {
    overlays2d.forEach(x=>x.setMap(null));overlays2d=[];
    const add=o=>{overlays2d.push(o);return o;};
    add(new google.maps.Polyline({map:maps2d,path:currentHole().path.map(ll),strokeColor:'#c5e78a',strokeWeight:4,clickable:false}));
    add(new google.maps.Polyline({map:maps2d,path:[origin(),target(),green()].map(ll),strokeColor:'#ffb766',strokeWeight:2,clickable:false}));
    [[origin(),'T'],[green(),'G'],...(savedHole().target?[[target(),'Aim']]:[])].forEach(([p,label])=>add(new google.maps.Marker({map:maps2d,position:ll(p),label,clickable:false})));
    const c=selected(),roll=savedHole().roll||0;
    if(c && c.carry > 0) {
      add(new google.maps.Circle({map:maps2d,center:ll(origin()),radius:c.carry*0.9144,strokeColor:'#c5e78a',strokeWeight:2,fillOpacity:0,clickable:false}));
      if(roll)add(new google.maps.Circle({map:maps2d,center:ll(origin()),radius:(c.carry+roll)*0.9144,strokeColor:'#ffb766',strokeWeight:2,fillOpacity:0,clickable:false}));
    }
  }
  function drawGoogle3d(lib) {
    if(!lib||!maps3d)return;
    [...maps3d.children].forEach(x=>x.remove());
    const line=(path,color,width)=>new lib.Polyline3DElement({coordinates:path.map(ll),strokeColor:color,strokeWidth:width,altitudeMode:'CLAMP_TO_GROUND',drawsOccludedSegments:true});
    maps3d.append(line(currentHole().path,'#c5e78a',5),line([origin(),target(),green()],'#ffb766',3));
    if(lib.Marker3DElement)[[origin(),'Your tee'],[green(),'Mapped green'],...(savedHole().target?[[target(),'Your target']]:[])].forEach(([p,label])=>{
      maps3d.append(new lib.Marker3DElement({position:ll(p),label,altitudeMode:'CLAMP_TO_GROUND'}));
    });
    const c=selected(),roll=savedHole().roll||0;
    if(c && c.carry > 0)for(const [d,color] of [[c.carry,'#c5e78a'],...(roll?[[c.carry+roll,'#ffb766']]:[])]) {
      const circle=Array.from({length:73},(_,i)=>destination(origin(),d,i*5));
      maps3d.append(line(circle,color,3));
    }
  }
  function flyover() {
    if(mode!=='3d'||!maps3d)return;
    stopFlyover();
    const path=[origin(),...currentHole().path.slice(1)];
    let i=0;
    const next=()=>{
      if(!root||mode!=='3d'||i>=path.length){stopFlyover();return;}
      const p=path[i],heading=bearing(p,path[Math.min(i+1,path.length-1)]);
      i++;
      maps3d.flyCameraTo({endCamera:{center:ll(p),altitudeMode:'CLAMP_TO_GROUND',range:360,tilt:58,heading},durationMillis:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:2800});
    };
    animationHandler=next;maps3d.addEventListener('gmp-animationend',next);
    animationTimer=setTimeout(stopFlyover,30000);next();
  }
  window.CaddieCoursePrep = Object.freeze({
    init: options => {bridge=options;}, render, mount, unmount, teaser, resumeAfterReload,
    openHole: n => {hole=Number.isInteger(+n)&&+n>=1&&+n<=18?+n:1;overview=false;},
    courseName: course.name, clean,
    geo: Object.freeze({distance,destination,bearing,pointOK})
  });
})();
