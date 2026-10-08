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
  let bridge, root, liveDialog, hole = 1, mode = 'guide', lastMapMode = '3d', overview = false, edit = 'target';
  let epoch = 0, googlePromise, googleKey, googleFailure = '', googleFailureMode = '', maps2d, maps3d, overlays2d = [];
  let googleAuthFailed = false, googleErrorCode = '', googleConsoleObserved = false;
  let showRings = true, framed2d = null, framed3d = null;
  let cameraQueue = Promise.resolve(), cameraRevision = 0;
  const queueCamera = work => (cameraQueue = cameraQueue.catch(() => {}).then(work));
  // Device location is a foreground-only measuring reference, never a saved tee.
  const LOCATION_MAX_AGE = 45000, LOCATION_MAX_ACCURACY = 25;
  let liveFix = null, locationWatch = null, locationEpoch = 0, locationTimer, locationNotice = '';
  let projection = null, imageError = false, animationHandler, animationTimer, bagSnapshot;
  const model = () => clean(bridge.get());
  const currentHole = () => course.holes[hole - 1];
  const teeSet = () => course.tees.find(t => t.id === model().tee);
  const holeKey = () => model().tee + ':' + hole;
  const savedHole = () => model().holes[holeKey()] || {};
  const liveLocation = () => liveFix && Date.now()-liveFix.time < LOCATION_MAX_AGE;
  const teeOrigin = () => pointOK(savedHole().tee) ? savedHole().tee : currentHole().path[0];
  const origin = () => liveLocation() ? liveFix.point : teeOrigin();
  const referenceName = () => liveLocation() ? 'My location' : savedHole().tee ? 'Your tee' : 'Reference tee';
  const green = () => currentHole().path.at(-1);
  const target = () => pointOK(savedHole().target) ? savedHole().target : green();
  const bag = () => bagSnapshot || (bagSnapshot = bridge.bag(model().basis));
  const selected = () => bag().find(c => c.key === bridge.club(hole)) || null;
  const yard = n => Math.round(n).toLocaleString('en-US');
  const targetYardage = () => yard(distance(origin(),target()))+' yd · '+yard(distance(target(),green()))+' yd left';
  function stopLocation(message = '') {
    locationEpoch++;
    if(locationWatch !== null) navigator.geolocation?.clearWatch(locationWatch);
    locationWatch = null; liveFix = null; locationNotice = message;
    clearTimeout(locationTimer);
  }
  function updateMeasurements() {
    if(!root)return;
    readout(); refreshOverlays(); drawControls();
  }
  function useLocation() {
    stopLocation();
    if(!navigator.geolocation) {locationNotice='Location is unavailable in this browser. Use Set tee instead.';updateMeasurements();return;}
    const token=locationEpoch;
    locationNotice='Finding your location…'; edit='target'; updateMeasurements();
    const fail = message => {if(token!==locationEpoch)return;stopLocation(message);updateMeasurements();};
    locationTimer=setTimeout(()=>fail('No fresh location received. Measuring from the tee; tap Use my location to retry.'),15000);
    try {
      locationWatch=navigator.geolocation.watchPosition(position=>{
        if(token!==locationEpoch||!root)return;
        const coords=position.coords, point=[coords.latitude,coords.longitude], age=Date.now()-position.timestamp;
        if(!Number.isFinite(age)||age< -5000||age>=LOCATION_MAX_AGE){locationNotice='Waiting for a fresh location. Measuring from the tee.';liveFix=null;updateMeasurements();return;}
        if(!pointOK(point)){fail('You’re outside Pound Ridge. Measuring from the tee.');return;}
        if(!Number.isFinite(coords.accuracy)||coords.accuracy<0||coords.accuracy>LOCATION_MAX_ACCURACY){
          liveFix=null;locationNotice='GPS accuracy is too low'+(Number.isFinite(coords.accuracy)?' (±'+yard(coords.accuracy/0.9144)+' yd)':'')+'. Measuring from the tee while waiting for a better fix.';updateMeasurements();return;
        }
        liveFix={point,accuracy:coords.accuracy,time:Math.min(Date.now(),position.timestamp)};locationNotice='';
        clearTimeout(locationTimer);
        locationTimer=setTimeout(()=>fail('Location expired. Measuring from the tee; tap Use my location to refresh.'),LOCATION_MAX_AGE-Math.max(0,age)+10);
        updateMeasurements();
      },error=>fail(error.code===1?'Location permission is off. Allow location for this site in your browser settings, or use Set tee.':error.code===3?'Location timed out. Measuring from the tee; tap Use my location to retry.':'Location is unavailable. Measuring from the tee; try again outdoors.'),{enableHighAccuracy:true,maximumAge:0,timeout:12000});
      drawReference();
    } catch {fail('Location could not start. Measuring from the tee; use Set tee instead.');}
  }
  function drawReference() {
    const el=root?.querySelector('#cp-reference');if(!el)return;
    el.hidden=mode==='guide';
    el.innerHTML='<div><span>MEASURING FROM</span><b>'+referenceName()+'</b>'+(liveLocation()?'<small>Live · accuracy ±'+yard(liveFix.accuracy/0.9144)+' yd</small>':'')+'</div><div class="cp-reference-actions">'+
      button('locate',locationWatch!==null?'Refresh location':'Use my location','aria-pressed="'+!!liveLocation()+'"')+
      (locationWatch!==null||liveFix?button('use-tee','Use tee'):'')+'</div>'+
      (locationNotice?'<p role="status">'+esc(locationNotice)+'</p>':'');
  }
  function key() { try { return localStorage.getItem(KEY) || window.CADDIE_GOOGLE_MAPS_KEY || ''; } catch { return window.CADDIE_GOOGLE_MAPS_KEY || ''; } }
  function reconnectGoogle() {
    // Google retains authorization inside its loaded SDK. Start a new page session
    // after changing Cloud settings, keeping the user's current hole and map view.
    try { sessionStorage.setItem(RESUME, JSON.stringify({hole, mode, live: !!liveDialog?.open})); } catch {}
    window.location.reload();
  }
  function resumeAfterReload() {
    let pending;
    try { pending = JSON.parse(sessionStorage.getItem(RESUME) || 'null'); sessionStorage.removeItem(RESUME); } catch { return false; }
    if(!pending || !Number.isInteger(pending.hole) || pending.hole < 1 || pending.hole > 18 || !['route','guide','satellite','3d'].includes(pending.mode)) return false;
    hole = pending.hole; mode = pending.mode;
    if(mode!=='guide'){lastMapMode=mode;if(navigator.onLine===false)mode='route';}
    overview = false;
    return pending.live && bridge.liveHole?.() === hole ? 'live' : true;
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
    return '<details class="cp-setup" id="cp-setup"><summary>Google Maps setup <span>' + (key() ? 'Key saved' : 'Connect overhead & 3D') + '</span></summary>' +
      '<p>Enable Maps JavaScript API and billing in the same Google Cloud project as your key. Choose Websites as the application restriction, including on iPhone, and restrict the key to Maps JavaScript API. ' +
      link('https://console.cloud.google.com/google/maps-apis/credentials', 'Open Google setup ↗') + '</p>' +
      '<label for="cp-api-key">Browser API key</label><div class="cp-key-row"><input id="cp-api-key" type="password" autocomplete="off" spellcheck="false" placeholder="' + (key() ? 'A key is saved · paste to replace' : 'Paste your restricted key') + '">' +
      button('key-save', 'Connect') + (key() ? button('key-clear', 'Disconnect') : '') + '</div>' +
      '<p class="cp-muted">Saved only on this device, outside golf backups. Restrict the website to https://mcdermottj639.github.io/* and set usage limits in Google Cloud. Maps need internet; course routes and your saved notes work offline after loading.</p></details>';
  }
  function mapViews() {
    if(mode==='guide')return '';
    return '<div class="cp-map-views"><div class="cp-imagery-views" role="group" aria-label="Imagery view">'+
      [['3d','3D'],['satellite','Overhead']].map(([k,label])=>button('mode',label,'data-mode="'+k+'" aria-pressed="'+(mode===k)+'"')).join('')+'</div>'+
      button('mode','Simple map','class="cp-simple-view" data-mode="route" aria-pressed="'+(mode==='route')+'"')+'</div>'+
      (mode==='route'?'<p class="cp-map-view-note" role="status">'+(navigator.onLine===false?'You’re offline · using the simple map':'Simple map · works offline')+'</p>':'');
  }
  function mapSurface() {
    return '<div class="cp-modes" role="group" aria-label="Hole view">'+
      button('mode','Hole guide','data-mode="guide" aria-pressed="'+(mode==='guide')+'"')+
      button('mode','Interactive map','data-mode="map" aria-pressed="'+(mode!=='guide')+'"')+'</div>'+mapViews()+
      '<div class="cp-reference" id="cp-reference" hidden></div><div class="cp-map-stage" id="cp-map-stage"></div><div id="cp-map-controls"></div><div class="cp-map-caption" id="cp-map-caption"></div>';
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
      mapSurface() + '</section>' +
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
      button('review-next','Save review & next hole','class="cp-review-next"') +
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
  function redraw() {
    if(!liveDialog?.open)return bridge.refresh();
    // Replace only the popup contents. Rerendering the live page would close it
    // and could disturb an unfinished scorecard edit underneath the dialog.
    bagSnapshot = null;
    const content = document.createElement('div');
    content.className = 'cp-workspace cp-live-map-content';
    content.innerHTML = mapSurface() + setup();
    liveDialog.querySelector('.cp-live-map-content').replaceWith(content);
    mount(content);
  }
  function changeHole(n) { if (!Number.isInteger(n) || n < 1 || n > 18) return; stopFlyover(); hole = n; framed3d = null; mode = 'guide'; imageError = false; overview = false; redraw(); }
  function stopFlyover() {
    if (animationHandler && maps3d) maps3d.removeEventListener('gmp-animationend', animationHandler);
    animationHandler = null;
    clearTimeout(animationTimer);
    cameraRevision++;
    const scene = maps3d;
    return queueCamera(() => scene?.stopCameraAnimation()).catch(() => {});
  }
  function unmount(keepLocation = false) { epoch++; stopFlyover(); closeGuide(); if(!keepLocation)stopLocation(); root = null; }
  function releaseLiveMap(dialog) {
    if(liveDialog !== dialog)return;
    epoch++; stopFlyover(); stopLocation(); root = null; liveDialog = null;
  }
  function closeGuide() {
    const dialog = document.querySelector('dialog.cp-guide-dialog[open]');
    if(!dialog)return;
    releaseLiveMap(dialog);
    dialog.close(); dialog.remove();
  }
  function holeDialog(source, h, id, closeLabel, content) {
    const previous = document.querySelector('dialog.cp-guide-dialog[open]');
    const trigger = previous?.cpReturnFocus || document.activeElement;
    closeGuide();
    const dialog = document.createElement('dialog');
    dialog.cpReturnFocus = trigger;
    dialog.id=id;dialog.className='cp-guide-dialog'+(id==='cp-live-map'?' cp-live-map-dialog':'');
    dialog.setAttribute('aria-labelledby','cp-guide-title');
    dialog.innerHTML='<header><div><p>'+esc(source.name)+'</p><h2 id="cp-guide-title">Hole '+h.n+' <span>· Par '+h.par+'</span></h2></div><button type="button" aria-label="'+closeLabel+'" autofocus>×</button></header>'+content;
    dialog.querySelector('header button').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('click',event=>{
      if(event.target!==dialog)return;
      const r=dialog.getBoundingClientRect();
      if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();
    });
    dialog.addEventListener('close',()=>{
      releaseLiveMap(dialog);
      dialog.remove();
      if(!document.querySelector('dialog.cp-guide-dialog[open]')){
        document.body.classList.remove('cp-guide-open');
        if(trigger?.isConnected)trigger.focus({preventScroll:true});
      }
    },{once:true});
    document.body.appendChild(dialog);document.body.classList.add('cp-guide-open');dialog.showModal();
    return dialog;
  }
  function openGuide(courseId, n) {
    const source = window.CADDIE_PREP_COURSES.find(c => c.id === courseId);
    const h = source?.holes.find(item => item.n === +n && item.guide);
    if(!h)return false;
    const dialog = holeDialog(source,h,'cp-live-guide','Close hole guide',
      (source.id===course.id?'<div class="cp-workspace"><div class="cp-modes" role="group" aria-label="Hole view"><button type="button" aria-pressed="true">Hole guide</button><button type="button" data-live-map aria-pressed="false">Interactive map</button></div></div>':'')+
      '<figure><img src="'+esc(h.guide)+'" alt="Official illustrated guide for '+esc(source.name)+' hole '+h.n+'" referrerpolicy="no-referrer"><div class="cp-guide-dialog-error" hidden><b>The illustration could not load.</b><p>Check your connection or open the club’s guide below.</p></div></figure>'+
      '<footer>Official club illustration · not to scale. '+link(source.tour,'Open course guide ↗')+'</footer>');
    dialog.querySelector('[data-live-map]')?.addEventListener('click',()=>openLiveMap(source.id,h.n));
    dialog.querySelector('img').addEventListener('error',()=>{
      dialog.querySelector('img').hidden=true;dialog.querySelector('.cp-guide-dialog-error').hidden=false;
    });
    return true;
  }
  function openLiveMap(courseId, n, start = '3d') {
    const h = course.id===courseId && course.holes.find(item=>item.n===+n);
    if(!h || !bridge)return false;
    const dialog = holeDialog(course,h,'cp-live-map','Close interactive map','<div class="cp-live-map-content"></div>');
    liveDialog = dialog; hole = h.n; framed3d = null; framed2d = null;
    mode = key() && navigator.onLine!==false && ['3d','satellite','route'].includes(start) ? start : 'route';
    lastMapMode = mode; overview = false; edit = 'target';
    if(!googleAuthFailed && googleFailureMode && googleFailureMode!==mode)googleFailure='';
    redraw();
    return true;
  }
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
      case 'mode': {
        const requested=el.dataset.mode;
        if(!['guide','map','route','satellite','3d'].includes(requested))break;
        if(liveDialog && requested==='guide'){openGuide(course.id,hole);break;}
        stopFlyover();
        mode=requested==='map'?(key()?lastMapMode:'route'):requested;
        if(requested!=='map'&&mode!=='guide')lastMapMode=mode;
        if(mode!=='guide'&&navigator.onLine===false)mode='route';
        if(!googleAuthFailed && googleFailureMode && googleFailureMode !== mode) googleFailure = '';
        if(el.dataset.pickTarget)edit='target';
        overview = false; redraw();
        if(el.dataset.pickTarget)root?.querySelector('#cp-map-stage').scrollIntoView({block:'center',behavior:'smooth'});
        break;
      }
      case 'club': bridge.setClub(hole, el.dataset.club); redraw(); break;
      case 'review-next': {
        saveHole({reviewed:true});
        const m=model(), next=Array.from({length:18},(_,i)=>(hole+i)%18+1).find(n=>!m.holes[m.tee+':'+n]?.reviewed);
        if(next)changeHole(next);else{redraw();bridge.toast('All 18 holes reviewed');} break;
      }
      case 'rings': showRings=!showRings;refreshOverlays();drawControls();break;
      case 'locate': useLocation();break;
      case 'use-tee': stopLocation();updateMeasurements();break;
      case 'frame': Promise.resolve(frameGoogle(el.dataset.focus || 'hole')).catch(()=>bridge.toast('The camera could not move. Try again.'));break;
      case 'shot-plan': root.querySelector('.cp-plan').scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});break;
      case 'overview': overview = !overview; drawView(); break;
      case 'edit': edit = el.dataset.kind; if(edit==='tee')stopLocation();updateMeasurements(); break;
      case 'clear-target': saveHole({target: undefined}); drawView(); readout(); break;
      case 'reset-tee': stopLocation();saveHole({tee: undefined}); drawView(); readout(); break;
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
    if (!root?.querySelector('#cp-club-readout')) return;
    const c = selected(), roll = savedHole().roll || 0;
    const toTarget = distance(origin(), target()), toGreen = distance(target(), green());
    const selectedKey = bridge.club(hole);
    const hasTarget = !!savedHole().target;
    let html = hasTarget
      ? '<div class="cp-distances"><span><b>' + yard(toTarget) + '</b>yd to your target</span><span><b>' + yard(toGreen) + '</b>yd left to green</span></div>'
      : '<div class="cp-target-prompt"><b>Choose your landing target.</b><br>Tap a spot on the interactive map to compare clubs and see the distance left to the green.' + button('mode','Pick a target on the map','data-mode="map" data-pick-target="true"') + '</div>';
    if (c && c.carry > 0) {
      html += '<div class="cp-club-summary"><b>' + esc(c.label) + ' · ' + yard(c.carry) + ' yd carry</b><span>' + esc(c.provenance) + '</span>' +
        (roll ? '<span>' + yard(c.carry + roll) + ' yd with your +' + roll + ' yd rollout assumption</span>' : '<span>Carry only · no rollout assumed</span>') + '</div>';
      if(c.rangeTotal>0) html += '<p class="cp-muted">Same range batch: '+yard(c.rangeTotal)+' yd total. This is measured range context, not predicted rollout here.</p>';
      if(hasTarget){
        const gap = toTarget - c.carry, totalGap = toTarget - c.carry - roll;
        html += '<p class="cp-muted">Carry alone: about ' + yard(Math.abs(gap)) + ' yd ' + (gap >= 0 ? 'short of' : 'past') + ' your target.' + (roll ? ' With your rollout: '+yard(Math.abs(totalGap))+' yd '+(totalGap>=0?'short of':'past')+'.' : '') + ' Measured from '+referenceName().toLowerCase()+'. Check conditions.</p>';
      }
    } else html += '<p class="cp-muted">' + (c ? 'This club has no carry for the selected distance source. Try latest range measurements or set its playing carry in Bag.' : selectedKey ? 'Your saved club is no longer in the active carry ladder. Choose a current club above.' : 'Choose a club to show its carry ring and compare it with your target.') + '</p>';
    if(hasTarget && bag().some(club=>club.carry>0)){
      const matches = d => bag().filter(club=>club.carry>0).sort((a,b)=>Math.abs(a.carry-d)-Math.abs(b.carry-d)).slice(0,3);
      const gapLabel = (carry,d) => {const gap=Math.round(carry-d);return gap===0?'Matches distance':Math.abs(gap)+' yd '+(gap<0?'short':'past');};
      html += '<div class="cp-club-compare"><h4>Compare carries to your target</h4><div class="cp-compare-options">'+matches(toTarget).map(club=>button('club','<b>'+esc(club.label)+'</b><span>'+yard(club.carry)+' yd carry</span><small>'+gapLabel(club.carry,toTarget)+'</small>','data-club="'+esc(club.key)+'" aria-pressed="'+(selectedKey===club.key)+'"')).join('')+'</div><p>Closest by carry distance only. Check the landing area, hazards and conditions.</p>'+
        (toGreen>20?'<div class="cp-approach"><b>From your target: '+yard(toGreen)+' yd left</b><span>'+matches(toGreen).slice(0,2).map(club=>esc(club.label)+' · '+yard(club.carry)+' yd carry ('+gapLabel(club.carry,toGreen)+')').join('<br>')+'</span></div>':'')+'</div>';
    }
    root.querySelector('#cp-club-readout').innerHTML = html;
  }
  function projectFor(all) {
    const points = all ? course.holes.flatMap(h => h.path) : [...currentHole().path, origin(), target()];
    const anchor = all ? course.center : origin(), cosLat = Math.cos(rad(anchor[0]));
    const heading = all ? 0 : bearing(origin(), green()), angle = -rad(heading), co = Math.cos(angle), si = Math.sin(angle);
    const xy = p => {
      const x = (p[1]-anchor[1])*cosLat*111195, y = -(p[0]-anchor[0])*111195;
      return [x*co-y*si,x*si+y*co];
    };
    const stage = root.querySelector('#cp-map-stage'), width = stage.clientWidth || 400, height = stage.clientHeight || 500;
    const projected = points.map(xy), xs = projected.map(p => p[0]), ys = projected.map(p => p[1]);
    const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
    const scale = Math.min((width-90)/Math.max(100,right-left), (height-130)/Math.max(80,bottom-top));
    const mx = (left+right)/2, my = (top+bottom)/2;
    return {scale,width,height,heading,
      to:p=>{const [x,y]=xy(p);return [width/2+(x-mx)*scale,height/2+(y-my)*scale];},
      from:p=>{
        const x=mx+(p[0]-width/2)/scale,y=my+(p[1]-height/2)/scale;
        return [anchor[0]-(-x*si+y*co)/111195,anchor[1]+(x*co+y*si)/(111195*cosLat)];
      }};
  }
  function svgMap() {
    projection = projectFor(overview);
    const {width:w,height:h,heading} = projection;
    const path = pts => pts.map(p => projection.to(p).map(x => x.toFixed(2)).join(',')).join(' ');
    const pnt = (p, kind, label) => {
      const [x,y]=projection.to(p), dy=kind==='tee'?23:kind==='green'&&savedHole().target?23:-17;
      const margin=Math.min(w/2-8,label.length*3.8), labelX=Math.max(margin,Math.min(w-margin,x));
      return '<g class="cp-map-point cp-point-'+kind+'" data-point="'+kind+'"><circle cx="'+x+'" cy="'+y+'" r="7"/><text x="'+labelX+'" y="'+Math.max(45,Math.min(h-40,y+dy))+'" text-anchor="middle" class="cp-map-label">'+label+'</text></g>';
    };
    const polys = course.features.map(f => '<polygon points="'+path(f.path)+'" class="cp-feature cp-feature-'+f.kind+'"/>').join('');
    const lines = (overview ? course.holes : [currentHole()]).map(holeData => {
      const [x,y]=projection.to(holeData.path[0]);
      return '<g data-cp="map-hole" data-n="'+holeData.n+'"'+(overview?' tabindex="0" role="button" aria-label="Explore hole '+holeData.n+'"':'')+'><polyline points="'+path(holeData.path)+'" class="cp-route-line '+(holeData.n===hole?'selected':'')+'"/>'+
        (overview?'<circle cx="'+x+'" cy="'+y+'" r="13" class="cp-hole-dot"/><text x="'+x+'" y="'+(y+4)+'" text-anchor="middle" class="cp-hole-number">'+holeData.n+'</text>':'')+'</g>';
    }).join('');
    let overlay = '', yardages = '';
    if (!overview) {
      const c=selected(), [x,y]=projection.to(origin()), roll=savedHole().roll||0;
      for(let d=100;d<distance(origin(),green())-25;d+=100){
        const arc=Array.from({length:25},(_,i)=>destination(origin(),d,heading-28+i*56/24));
        const [lx,ly]=projection.to(arc[0]);
        yardages += '<polyline points="'+path(arc)+'" class="cp-yardage-arc"/><text x="'+Math.max(13,lx-5)+'" y="'+(ly-6)+'" class="cp-yardage-label">'+d+' yd</text>';
      }
      if (showRings && c && c.carry > 0) {
        overlay += '<circle cx="'+x+'" cy="'+y+'" r="'+(c.carry*0.9144*projection.scale)+'" class="cp-carry-ring"/>';
        if (roll) overlay += '<circle cx="'+x+'" cy="'+y+'" r="'+((c.carry+roll)*0.9144*projection.scale)+'" class="cp-roll-ring"/>';
      }
      if(savedHole().target)overlay += '<polyline points="'+path([origin(),target(),green()])+'" class="cp-aim-line"/>';
      overlay += pnt(origin(),'tee',referenceName()) + pnt(green(),'green',savedHole().target?'Mapped green':'Green · '+yard(distance(origin(),green()))+' yd') +
        (savedHole().target ? pnt(target(),'target',targetYardage()) : '');
    }
    const scaleYards = overview ? 100 : 50, scaleWidth=scaleYards*0.9144*projection.scale;
    return '<svg id="cp-route-map" viewBox="0 0 '+w+' '+h+'" aria-label="Approximate mapped routes for Pound Ridge. '+(overview?'Choose a hole.':'Tee at bottom. Click to set your target or tee.')+'" role="img">'+
      '<defs><pattern id="cp-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#204d3e" stroke-opacity=".035"/></pattern></defs>'+
      '<rect width="'+w+'" height="'+h+'" fill="#eef1e4"/><rect width="'+w+'" height="'+h+'" fill="url(#cp-grid)"/>'+polys+yardages+lines+overlay+
      '<text x="18" y="27" class="cp-map-kicker">'+(overview?'POUND RIDGE · 18 HOLES':liveLocation()?'MY LOCATION → GREEN':'TEE → GREEN')+'</text>'+
      '<g class="cp-map-compass" transform="translate('+(w-27)+' 31)"><text x="0" y="-16" text-anchor="middle">N</text><path d="M0 -10L-4 4L0 1L4 4Z" transform="rotate('+(-heading)+')"/></g>'+
      '<g class="cp-map-scale"><path d="M18 '+(h-24)+'v6h'+scaleWidth+'v-6" fill="none" stroke="currentColor" stroke-width="2"/><text x="18" y="'+(h-31)+'">'+scaleYards+' yd</text></g></svg>';
  }
  function drawControls() {
    if (!root) return;
    drawReference();
    const el = root.querySelector('#cp-map-controls');
    const mapped = mode !== 'guide' && (mode === 'route' || (!!key() && !googleFailure));
    el.innerHTML = (mapped && !overview ? '<div class="cp-map-summary">'+(savedHole().target ? '<span><b>'+yard(distance(origin(),target()))+' yd</b> to your target</span><span><b>'+yard(distance(target(),green()))+' yd</b> left to green</span>' : '<span><b>'+yard(distance(origin(),green()))+' yd</b> '+referenceName().toLowerCase()+' → mapped green</span><span>Tap a landing spot<br>to plan your shot</span>')+'</div>' : '') +
      (mapped && !overview ? '<div class="cp-map-legend"><span><i class="cp-legend-tee">'+(liveLocation()?'●':'T')+'</i> '+(liveLocation()?'You':'Tee')+'</span><span><i class="cp-legend-target">A</i> Aim</span><span><i class="cp-legend-green">G</i> Green</span>'+(selected()?.carry>0?'<span class="cp-map-club">'+esc(selected().label)+' · '+yard(selected().carry)+' yd carry</span>':'')+'</div>':'') + '<div class="cp-map-tools">' + (mode === 'route' && !liveDialog ? button('overview', overview ? 'Focus this hole' : 'All 18 holes') : '') +
      (mapped && !overview ? button('edit','Landing target','data-kind="target" aria-pressed="'+(edit==='target')+'"')+button('edit','Set tee','data-kind="tee" aria-pressed="'+(edit==='tee')+'"') : '') +
      (mapped && !overview && selected()?.carry>0 ? button('rings','Carry rings','aria-pressed="'+showRings+'"'):'')+
      (savedHole().target ? button('clear-target','Clear target'):'') + (savedHole().tee ? button('reset-tee','Reset tee'):'') + '</div>';
    if(mapped && ['satellite','3d'].includes(mode))el.innerHTML+='<div class="cp-map-tools cp-camera-tools">'+(!liveDialog?button('shot-plan','Shot plan ↓'):'')+(mode==='3d'?button('frame','Back to tee','data-focus="tee"'):'')+button('frame','Whole hole','data-focus="hole"')+button('frame','Green close-up','data-focus="green"')+(mode==='3d'?button('fly','Fly this hole')+button('stop','Stop'):'')+'</div>';
    root.querySelector('#cp-map-caption').innerHTML = mode === 'guide'
      ? 'Official club illustration · not to scale. '+link(course.tour,'Open course guide ↗')
      : (['satellite','3d'].includes(mode)?'One finger to move · pinch to zoom. Scroll outside the map to move the page. ':'')+(overview ? '18 mapped routes. Select a hole to plan a shot.' : 'Tap to set your '+(edit==='target'?'landing target':'tee')+'. '+(liveLocation()?'Distances from your current location.':savedHole().tee?'Distances from your tee position.':'Mapped reference tee; set yours before comparing distances.'))+
        '<span>Approximate routes · incomplete hazard coverage · '+link('https://www.openstreetmap.org/copyright','© OpenStreetMap contributors')+'</span>';
  }
  async function drawView() {
    if (!root) return;
    const token=++epoch, stage=root.querySelector('#cp-map-stage');
    stopFlyover();
    stage.dataset.view = mode;
    stage.replaceChildren();
    drawControls();
    if (mode==='guide') {
      stage.innerHTML = '<figure class="cp-guide"><img id="cp-guide-image" src="'+esc(currentHole().guide)+'" alt="Pound Ridge official illustration of hole '+hole+'" referrerpolicy="no-referrer"><figcaption>Hole '+hole+' · Official club guide</figcaption></figure>';
      stage.querySelector('img').addEventListener('error',()=>{
        if(token!==epoch||!root)return; imageError=true;
        stage.innerHTML='<div class="cp-map-message"><b>The club’s image is unavailable here.</b><p>Your course map and saved plan are still ready.</p>'+button('mode','Open simple map','data-mode="route"')+link(course.tour,'Open the club’s guide ↗')+'</div>';
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
      stage.innerHTML='<div class="cp-map-message"><span class="cp-orbit" aria-hidden="true">◎</span><h3>'+ (mode==='3d'?'Explore Pound Ridge in 3D':'Google satellite view') +'</h3><p>Connect your Google Maps key to load this view inside Caddie HQ.</p>'+button('map-setup','Connect Google Maps')+button('mode','Use simple map','data-mode="route"')+link('https://www.google.com/maps/search/?api=1&query=Pound+Ridge+Golf+Club','Open Pound Ridge in Google Maps ↗')+'</div>';
      return;
    }
    if (googleAuthFailed || googleFailure) return mapError(googleFailure, googleFailureMode);
    stage.innerHTML='<div class="cp-map-message" role="status">Loading Google '+(mode==='3d'?'3D':'satellite')+'…</div>';
    let stageName = 'loading Google';
    try {
      await loadGoogle();
      stageName = 'loading the map library';
      if(token!==epoch||!root)return;
      if(mode==='satellite') {
        const [lib]=await Promise.all([google.maps.importLibrary('maps'),google.maps.importLibrary('marker')]);
        if(token!==epoch||!root)return;
        if(!maps2d) {
          const div=document.createElement('div');div.className='cp-google-map';
          maps2d=new lib.Map(div,{center:ll(course.center),zoom:16,mapTypeId:'satellite',gestureHandling:'greedy',streetViewControl:false,mapTypeControl:false,fullscreenControl:true});
          maps2d.addListener('click',e=>{if(e.latLng)choosePoint([e.latLng.lat(),e.latLng.lng()]);});
        }
        stage.replaceChildren(maps2d.getDiv());
        if(framed2d!==hole){frameGoogle('hole');framed2d=hole;}drawGoogle2d();
      } else {
        const lib=await google.maps.importLibrary('maps3d');
        if(token!==epoch||!root)return;
        stageName = 'starting the 3D viewer';
        if(!maps3d) {
          // Map3DElementOptions does not accept CameraOptions.altitudeMode.
          // Terrain-relative altitude belongs to flyCameraTo, never the constructor.
          const {center,range,heading,tilt,roll}=teeCamera();
          maps3d=new lib.Map3DElement({center,range,heading,tilt,roll,mode:'SATELLITE',gestureHandling:'GREEDY'});
          maps3d.className='cp-google-map';
          maps3d.addEventListener('gmp-click',e=>{if(e.position)choosePoint([e.position.lat,e.position.lng]);});
          maps3d.addEventListener('gmp-error',()=>{if(root&&mode==='3d')mapError('3D could not initialize on this device. Try Overhead or the simple map.','3d');});
        }
        stage.replaceChildren(maps3d);
        stageName = 'drawing the 3D hole';
        drawGoogle3d(lib);
        stageName = 'positioning the 3D camera';
        if(framed3d!==hole){await frameGoogle('tee');if(token!==epoch||!root)return;framed3d=hole;}
      }
    } catch {
      if(token===epoch&&root)mapError(googleFailure || (mode==='3d'?'The 3D view':'Satellite')+' could not finish '+stageName+'. Reload and retry, or choose another view.', mode);
    }
  }
  const ll = p => ({lat:p[0],lng:p[1]});
  function teeCamera() {
    // Look along the hole from above/behind its tee, independent of GPS yardages.
    const tee=teeOrigin(), heading=bearing(tee,green());
    const length=distance(tee,green());
    return {center:{...ll(destination(tee,length*0.3,heading)),altitude:0},altitudeMode:'RELATIVE_TO_GROUND',
      range:Math.max(240,length*0.9144*0.95),heading,tilt:58,roll:0};
  }
  function frameGoogle(focus) {
    const stopped=stopFlyover(), revision=cameraRevision;
    const path=[...currentHole().path,origin(),...(savedHole().target?[target()]:[])];
    if(mode==='satellite' && maps2d){
      const bounds=new google.maps.LatLngBounds();
      const points=focus==='green'?[destination(green(),70,0),destination(green(),70,90),destination(green(),70,180),destination(green(),70,270)]:path;
      points.forEach(p=>bounds.extend(ll(p)));maps2d.fitBounds(bounds,45);
    }
    if(mode==='3d' && maps3d){
      const mid=[(Math.min(...path.map(p=>p[0]))+Math.max(...path.map(p=>p[0])))/2,(Math.min(...path.map(p=>p[1]))+Math.max(...path.map(p=>p[1])))/2];
      const radius=Math.max(...path.map(p=>distance(mid,p)))*0.9144;
      const endCamera=focus==='tee'?teeCamera():{center:{...ll(focus==='green'?green():mid),altitude:0},altitudeMode:'RELATIVE_TO_GROUND',range:focus==='green'?190:Math.max(360,radius*3.2),heading:bearing(teeOrigin(),green()),tilt:focus==='green'?20:42,roll:0};
      return stopped.then(()=>moveGoogleCamera(endCamera,0,revision));
    }
  }
  function moveGoogleCamera(endCamera,durationMillis,revision) {
    const scene=maps3d, current=()=>revision===cameraRevision&&root&&mode==='3d'&&maps3d===scene;
    return queueCamera(async()=>{
      if(!current())return false;
      try {
        // Google rejects CLAMP_TO_GROUND for camera animations (including 0 ms).
        // RELATIVE_TO_GROUND + altitude 0 aims at the terrain without an elevation API.
        await scene.flyCameraTo({endCamera,durationMillis});
        return current();
      } catch {
        if(!current())return false;
        // Camera motion is optional: retain imagery, markers and tap yardages.
        // Direct properties use absolute altitude; retain the viewer's observed value.
        const {center,range,heading,tilt,roll=0}=endCamera;
        try {
          const altitude=scene.center?.altitude;
          Object.assign(scene,{center:{lat:center.lat,lng:center.lng,...(Number.isFinite(altitude)?{altitude}:{})},range,heading,tilt,roll});
        } catch {}
        if(durationMillis>0)stopFlyover();
        bridge.toast('Camera animation unavailable. You can still move the map and tap for yardages.');
        return false;
      }
    });
  }
  function choosePoint(p) {
    if(!pointOK(p))return bridge.toast('Choose a point within the Pound Ridge course area');
    saveHole({[edit]:p.map(x=>+x.toFixed(7))});readout();refreshOverlays();drawControls();
  }
  function refreshOverlays() {
    if(!root)return;
    try {
      if(mode==='route')drawView();
      else if(!googleFailure && mode==='satellite'&&maps2d)drawGoogle2d();
      else if(!googleFailure && mode==='3d'&&maps3d)drawGoogle3d(google.maps.maps3d);
    } catch {mapError('This view could not update the yardage markers. Reload and retry, or choose another view.',mode);}
  }
  function googleErrorAdvice() {
    const messages = {
      BillingNotEnabledMapError: 'Enable billing in the Google Cloud project that owns this key.',
      ClientBillingNotEnabledMapError: 'Enable billing in the Google Cloud project that owns this key.',
      ApiNotActivatedMapError: 'Enable Maps JavaScript API in the Google Cloud project that owns this key.',
      ApiTargetBlockedMapError: 'In this key’s API restrictions, allow Maps JavaScript API.',
      RefererNotAllowedMapError: 'In this key’s Website restrictions, add https://mcdermottj639.github.io/* and save.',
      InvalidKeyMapError: 'Google does not recognize this key. Copy the complete key from Google Cloud and reconnect it below.',
      ExpiredKeyMapError: 'Google does not recognize this key yet. Wait a few minutes after creating it, then reload. If it persists, check the key in Google Cloud.',
      MissingKeyMapError: 'Google did not receive an API key. Reconnect your Maps key below.',
      OverQuotaMapError: 'The project’s Maps usage limit has been reached. Check its quota in Google Cloud.',
      ProjectDeniedMapError: 'Google denied this project. Check its Maps API status in Google Cloud.',
      DeletedApiProjectMapError: 'This key belongs to a deleted project. Reconnect a key from your active Maps project.'
    };
    return messages[googleErrorCode] || 'Google rejected the Maps key. Check Maps JavaScript API, billing and website restrictions in the project that owns this key.';
  }
  function rejectGoogle() {
    epoch++; googleAuthFailed = true;
    mapError(googleErrorAdvice());
  }
  function observeGoogleErrors() {
    if (googleConsoleObserved) return;
    googleConsoleObserved = true;
    // Google documents its specific authorization code in the console, while
    // gm_authFailure has no arguments. Retain only that code, never URLs or keys.
    for (const level of ['error','warn']) {
      const original = console[level];
      console[level] = function(...args) {
        original.apply(console, args);
        const message = args.filter(a => typeof a === 'string').join(' ');
        const match = message.match(/Google Maps JavaScript API error:\s*([A-Za-z][A-Za-z0-9]*MapError)\b/);
        if (match) { googleErrorCode = match[1]; rejectGoogle(); }
      };
    }
  }
  function loadGoogle() {
    observeGoogleErrors();
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
      window.gm_authFailure=()=>{rejectGoogle();end(new Error(googleFailure));};
      script.onerror=()=>end(new Error('Maps network error'));
      script.src='https://maps.googleapis.com/maps/api/js?key='+encodeURIComponent(googleKey)+'&loading=async&v=weekly&callback=__caddieMapsReady';
      document.head.appendChild(script);
    });
    return googlePromise;
  }
  function mapError(message, failedMode = '') {
    if(googleAuthFailed) {message=googleErrorAdvice();failedMode='';}
    googleFailure=message;googleFailureMode=failedMode;
    if(!root||!['3d','satellite'].includes(mode))return;
    stopFlyover();
    root.querySelector('#cp-map-stage').innerHTML='<div class="cp-map-message"><h3>Google Maps is unavailable</h3><p>'+esc(message)+'</p>'+(googleErrorCode?'<code class="cp-error-code">'+esc(googleErrorCode)+'</code>':'')+button('retry','Reload & retry')+button('map-setup','Maps setup')+button('mode','Use simple map','data-mode="route"')+'</div>';
    drawControls();
  }
  function drawGoogle2d() {
    overlays2d.forEach(x=>x.setMap(null));overlays2d=[];
    const add=o=>{overlays2d.push(o);return o;};
    add(new google.maps.Polyline({map:maps2d,path:currentHole().path.map(ll),strokeColor:'#c5e78a',strokeWeight:4,clickable:false}));
    if(savedHole().target)add(new google.maps.Polyline({map:maps2d,path:[origin(),target(),green()].map(ll),strokeColor:'#ffb766',strokeWeight:2,clickable:false}));
    [[origin(),liveLocation()?'You':'T','#204d3e'],[green(),'G','#668a43'],...(savedHole().target?[[target(),'A','#b77224']]:[])].forEach(([p,label,color])=>add(new google.maps.Marker({map:maps2d,position:ll(p),label:{text:label,color:'#fff',fontSize:'12px',fontWeight:'700'},icon:{path:google.maps.SymbolPath.CIRCLE,scale:liveLocation()&&label==='You'?15:11,fillColor:color,fillOpacity:1,strokeColor:'#fff',strokeWeight:2},clickable:false})));
    add(new google.maps.Marker({map:maps2d,position:ll(target()),label:{text:savedHole().target?targetYardage():'Green · '+yard(distance(origin(),green()))+' yd',color:'#193e32',fontSize:'12px',fontWeight:'700',className:'cp-google-yardage-label'},icon:{path:google.maps.SymbolPath.CIRCLE,scale:1,fillOpacity:0,strokeOpacity:0,labelOrigin:new google.maps.Point(0,-28)},clickable:false,zIndex:1000}));
    const c=selected(),roll=savedHole().roll||0;
    if(showRings && c && c.carry > 0) {
      add(new google.maps.Circle({map:maps2d,center:ll(origin()),radius:c.carry*0.9144,strokeColor:'#c5e78a',strokeWeight:2,fillOpacity:0,clickable:false}));
      if(roll)add(new google.maps.Circle({map:maps2d,center:ll(origin()),radius:(c.carry+roll)*0.9144,strokeColor:'#ffb766',strokeWeight:2,fillOpacity:0,clickable:false}));
    }
  }
  function drawGoogle3d(lib) {
    if(!lib||!maps3d)return;
    [...maps3d.children].forEach(x=>x.remove());
    const line=(path,color,width)=>new lib.Polyline3DElement({path:path.map(ll),strokeColor:color,strokeWidth:width,altitudeMode:'CLAMP_TO_GROUND',drawsOccludedSegments:true});
    maps3d.append(line(currentHole().path,'#c5e78a',4));
    if(savedHole().target)maps3d.append(line([origin(),target(),green()],'#ffb766',3));
    // Basic 3D markers need only maps3d. Optional PinElement customization must not
    // become a startup dependency: a customization failure must not hide the map.
    if(lib.Marker3DElement)[[origin(),liveLocation()?'You':'Tee'],[green(),savedHole().target?'Green':'Green · '+yard(distance(origin(),green()))+' yd'],...(savedHole().target?[[target(),targetYardage()]]:[])].forEach(([p,label])=>{
      maps3d.append(new lib.Marker3DElement({position:ll(p),label,altitudeMode:'CLAMP_TO_GROUND'}));
    });
    const c=selected(),roll=savedHole().roll||0;
    if(showRings && c && c.carry > 0)for(const [d,color] of [[c.carry,'#c5e78a'],...(roll?[[c.carry+roll,'#ffb766']]:[])]) {
      const circle=Array.from({length:73},(_,i)=>destination(origin(),d,i*5));
      maps3d.append(line(circle,color,3));
    }
  }
  async function flyover() {
    if(mode!=='3d'||!maps3d)return;
    const stopped=stopFlyover(), revision=cameraRevision;
    await stopped;
    if(revision!==cameraRevision||!root||mode!=='3d')return;
    const path=[teeOrigin(),...currentHole().path.slice(1)];
    let i=0;
    const next=()=>{
      if(!root||mode!=='3d'||i>=path.length){stopFlyover();return;}
      const p=path[i],heading=i<path.length-1?bearing(p,path[i+1]):bearing(path[i-1],p);
      i++;
      moveGoogleCamera({center:{...ll(p),altitude:0},altitudeMode:'RELATIVE_TO_GROUND',range:360,tilt:58,heading},window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:2800,revision);
    };
    animationHandler=next;maps3d.addEventListener('gmp-animationend',next);
    animationTimer=setTimeout(stopFlyover,30000);next();
  }
  window.addEventListener('resize',()=>{if(root && mode==='route')drawView();});
  window.addEventListener('offline',()=>{
    if(root&&['satellite','3d'].includes(mode)){stopFlyover();mode='route';overview=false;redraw();}
    else if(root&&mode==='route')redraw();
  });
  window.addEventListener('online',()=>{
    const note=root?.querySelector('.cp-map-view-note');
    if(note)note.textContent='Simple map · works offline';
  });
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden && locationWatch!==null){stopLocation('Location paused while the app was away. Tap Use my location to resume.');updateMeasurements();}
  });
  window.addEventListener('pagehide',()=>stopLocation());
  window.CaddieCoursePrep = Object.freeze({
    init: options => {bridge=options;}, render, mount, unmount, teaser, resumeAfterReload, openGuide, openLiveMap,
    resumeLiveMap: () => openLiveMap(course.id,hole,mode),
    openHole: n => {hole=Number.isInteger(+n)&&+n>=1&&+n<=18?+n:1;framed3d=null;mode='guide';imageError=false;overview=false;},
    courseName: course.name, clean,
    geo: Object.freeze({distance,destination,bearing,pointOK})
  });
})();
