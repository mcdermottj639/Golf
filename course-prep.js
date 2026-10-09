/* Course Prep: local plans + sourced routes; Google imagery is optional and lazy. */
(function () {
  'use strict';
  const courses = window.CADDIE_PREP_COURSES;
  const packs = window.CaddieCoursePacks;
  const packReady = () => !packs || packs.ready(course.id);
  const loadErrors = new Map();
  let dialogRequest = 0;
  const normalize = value => String(value || '').trim().toLowerCase().replace(/\s+/g,' ');
  const findCourse = value => courses.find(c => [c.id,c.name,...(c.aliases || [])].some(name => normalize(name) === normalize(value)));
  let course = courses[0];
  const KEY = 'caddiehq_google_maps_key_v1';
  const RESUME = 'caddiehq_course_prep_resume_v1';
  const rad = x => x * Math.PI / 180;
  const deg = x => x * 180 / Math.PI;
  const esc = x => String(x == null ? '' : x).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pointFor = (p, source) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) &&
    p[0] > source.bounds[0] && p[0] < source.bounds[2] && p[1] > source.bounds[1] && p[1] < source.bounds[3];
  const pointOK = p => pointFor(p,course);
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
  function clean(input, courseId = course.id) {
    const source = findCourse(courseId) || course;
    const src = input && typeof input === 'object' ? input : {};
    const out = { tee: source.tees.some(t => t.id === src.tee) ? src.tee : source.defaultTee,
      basis: src.basis === 'range' ? 'range' : 'playing', holes: {} };
    for (const t of source.tees) for (const {n} of source.holes) {
      const k = t.id + ':' + n, h = src.holes && src.holes[k];
      if (!h || typeof h !== 'object') continue;
      out.holes[k] = {
        note: typeof h.note === 'string' ? h.note.slice(0, 1800) : '',
        roll: Number.isFinite(+h.roll) ? Math.max(0, Math.min(60, +h.roll)) : 0,
        reviewed: h.reviewed === true,
        ...(pointFor(h.tee,source) ? {tee: h.tee.slice()} : {}),
        ...(pointFor(h.target,source) ? {target: h.target.slice()} : {})
      };
    }
    return out;
  }
  let bridge, root, liveDialog, hole = 1, mode = 'guide', lastMapMode = '3d', overview = false, edit = 'target';
  let epoch = 0, googlePromise, googleKey, googleFailure = '', googleFailureMode = '', maps3d;
  let lines3d = [], markers3d = [];
  let googleAuthFailed = false, googleErrorCode = '', googleConsoleObserved = false;
  let showRings = true, framed3d = null;
  let cameraQueue = Promise.resolve(), cameraRevision = 0;
  const queueCamera = work => (cameraQueue = cameraQueue.catch(() => {}).then(work));
  // Device location is a foreground-only measuring reference, never a saved tee.
  const LOCATION_MAX_AGE = 45000, LOCATION_MAX_ACCURACY = 25;
  let liveFix = null, locationWatch = null, locationEpoch = 0, locationTimer, locationNotice = '';
  let projection = null, imageError = false, animationHandler, animationTimer, bagSnapshot;
  let guideLoad = null, guideStyle = 'auto';
  const canDrawGuide = (source,h) => !!window.CaddieHoleGuide && h?.mapReady!==false && h?.path?.length>1;
  const hasGuide = (source,h) => !!h && (!!h.guide || h.mappedGuide || canDrawGuide(source,h));
  const usesArt = (source,h) => canDrawGuide(source,h) && (guideStyle==='caddie' || !h.guide || navigator.onLine===false);
  const guideChoices = (source,h) => h.guide && canDrawGuide(source,h) ? '<div class="cp-guide-styles" role="group" aria-label="Guide style">'+button('guide-style','Club illustration','data-style="club" aria-pressed="'+!usesArt(source,h)+'"')+button('guide-style','Caddie HQ guide','data-style="caddie" aria-pressed="'+usesArt(source,h)+'"')+'</div>' : '';
  const guideCaption = (source,h) => usesArt(source,h) ? 'Illustrated overview · not to scale · incomplete hazard coverage. '+link('https://www.openstreetmap.org/copyright','© OpenStreetMap contributors') : 'Official club illustration · not to scale. '+link(source.tour,'Open course guide ↗');
  const guideContent = (source,h,live=false) => '<div class="cp-guide-zoom" style="--guide-scale:1"><div class="cp-guide-zoom-tools" role="group" aria-label="Hole guide zoom"><button type="button" data-guide-zoom="out" aria-label="Zoom out hole guide" disabled>−</button><output aria-live="polite">100%</output><button type="button" data-guide-zoom="in" aria-label="Zoom in hole guide">+</button><button type="button" data-guide-zoom="full">Full hole</button><span>Zoom for detail</span></div><div class="cp-guide-viewport" tabindex="0" aria-label="Full hole guide"><div class="cp-guide-zoom-content">'+(usesArt(source,h) ? window.CaddieHoleGuide.render(source,h) : guideFigure(source,h,live))+'</div></div>'+guideChoices(source,h)+'</div>';
  function setupGuideZoom(container) {
    const wrap=container.querySelector('.cp-guide-zoom');if(!wrap)return;
    const viewport=wrap.querySelector('.cp-guide-viewport');let zoom=1;
    function apply(next,initial=false){
      const x=initial ? .5 : (viewport.scrollLeft+viewport.clientWidth/2)/viewport.scrollWidth;
      const y=initial ? .5 : (viewport.scrollTop+viewport.clientHeight/2)/viewport.scrollHeight;
      zoom=Math.max(1,Math.min(2.4,Math.round(next*10)/10));
      wrap.style.setProperty('--guide-scale',zoom);
      wrap.querySelector('output').textContent=Math.round(zoom*100)+'%';
      wrap.querySelector('[data-guide-zoom="out"]').disabled=zoom===1;
      wrap.querySelector('[data-guide-zoom="in"]').disabled=zoom===2.4;
      wrap.querySelector('.cp-guide-zoom-tools span').textContent=zoom===1?'Zoom for detail':'Scroll to explore';
      viewport.setAttribute('aria-label',zoom===1?'Full hole guide':'Zoomed hole guide; scroll to explore');
      viewport.scrollLeft=x*viewport.scrollWidth-viewport.clientWidth/2;
      viewport.scrollTop=y*viewport.scrollHeight-viewport.clientHeight/2;
    }
    wrap.addEventListener('click',event=>{
      const control=event.target.closest('[data-guide-zoom]');if(!control)return;
      event.stopPropagation();
      apply(control.dataset.guideZoom==='full'?1:zoom+(control.dataset.guideZoom==='in' ? .2 : -.2));
    });
    apply(zoom,true);
  }
  const model = () => clean(bridge.get(course.id));
  const currentHole = () => course.holes[hole - 1];
  const mappedHoles = () => course.holes.filter(h=>h.mapReady!==false);
  const mapReady = () => currentHole().mapReady!==false;
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
  // Suggestions are derived for the view only. Only an explicit club change writes a plan.
  const teePreviewReady = () => packReady() && mapReady() && [4,5].includes(currentHole().par) && !liveLocation();
  const measuredClubs = () => bag().filter(c=>Number.isFinite(c.carry)&&c.carry>0);
  function teeClub() {
    const saved=bridge.club(course.id,hole);
    if(saved)return {club:bag().find(c=>c.key===saved)||null,source:'Your tee club'};
    if(!teePreviewReady())return {club:null};
    const clubs=measuredClubs(),planned=clubs.find(c=>c.key===bridge.recommendedClub?.(course.id,hole));
    if(planned)return {club:planned,source:'Plan recommendation'};
    const ranked=clubs.slice().sort((a,b)=>b.carry-a.carry);
    // A distance-based starting point, not a claim of hazard clearance or an optimal line.
    const limit=distance(teeOrigin(),savedHole().target||green())-(savedHole().target?0:30);
    return {club:ranked.find(c=>c.carry<=limit)||ranked.at(-1)||null,source:'Suggested tee club'};
  }
  const selected = () => teeClub().club;
  function teePreview() {
    if(!teePreviewReady())return null;
    const {club,source}=teeClub();if(!club||!Number.isFinite(club.carry)||club.carry<=0)return null;
    const tee=teeOrigin();let aim=savedHole().target;
    if(!aim){
      // Intersect the carry radius with the routed centerline. Do not count a dogleg
      // as a curved ball flight or snap to a supposed safe fairway point.
      const path=[tee,...currentHole().path.slice(1)];
      aim=green();
      for(let i=1;i<path.length;i++)if(distance(tee,path[i])>=club.carry){
        let lo=path[i-1],hi=path[i];
        for(let j=0;j<28;j++){const mid=[(lo[0]+hi[0])/2,(lo[1]+hi[1])/2];if(distance(tee,mid)<club.carry)lo=mid;else hi=mid;}
        aim=hi;break;
      }
    }
    const landing=destination(tee,club.carry,bearing(tee,aim));
    return {club,source,tee,landing,left:distance(landing,green())};
  }
  const landingLabel = preview => preview.club.label+' · '+yard(preview.club.carry)+' yd carry';
  function drawTeePreview() {
    const el=root?.querySelector('#cp-tee-preview');if(!el)return;
    const preview=mode!=='guide'&&!overview&&(mode!=='3d'||!googleFailure)?teePreview():null;
    el.hidden=!preview;if(!preview){el.innerHTML='';return;}
    el.innerHTML='<div><select id="cp-map-club" aria-label="Tee shot club and carry distance" title="'+esc(preview.source)+' · carry distance">'+measuredClubs().map(c=>'<option value="'+esc(c.key)+'" '+(c.key===preview.club.key?'selected':'')+'>'+esc(c.label)+' · '+yard(c.carry)+' yd</option>').join('')+'</select></div>';
  }
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
        if(!pointOK(point)){fail('You’re outside '+course.shortName+'. Measuring from the tee.');return;}
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
    try { sessionStorage.setItem(RESUME, JSON.stringify({courseId:course.id,hole, mode, live: !!liveDialog?.open})); } catch {}
    window.location.reload();
  }
  function resumeAfterReload() {
    let pending;
    try { pending = JSON.parse(sessionStorage.getItem(RESUME) || 'null'); sessionStorage.removeItem(RESUME); } catch { return false; }
    if(pending?.mode==='satellite')pending.mode='3d'; // migrate a pre-v224 resume
    const source = pending && findCourse(pending.courseId || courses[0].id);
    if(!source || !source.holes.some(h => h.n === pending.hole) || !['route','guide','3d'].includes(pending.mode)) return false;
    selectCourse(source.id);
    hole = pending.hole; mode = pending.mode==='guide'&&!hasGuide(course,currentHole()) ? initialMode() : pending.mode;
    if(mode!=='guide'){lastMapMode=mode;if(navigator.onLine===false)mode='route';}
    overview = false;
    return pending.live && bridge.liveHole?.(course.id) === hole ? 'live' : true;
  }
  function saveHole(patch) {
    const next = model(), k = holeKey();
    next.holes[k] = {...(next.holes[k] || {}), ...patch};
    bridge.save(course.id,clean(next));
    status('Saved on this device');
    const row = root?.querySelector('.cp-plan-table [data-n="' + hole + '"] > span:last-child');
    if (row) row.textContent = next.holes[k].note || (next.holes[k].reviewed ? 'Reviewed' : 'Add a plan');
  }
  function status(text) { const el = root && root.querySelector('#cp-save-status'); if (el) el.textContent = text; }
  const button = (action, label, extra) => '<button type="button" data-cp="' + action + '" ' + (extra || '') + '>' + label + '</button>';
  const link = (url, label) => '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + label + '</a>';
  function guideFigure(source, h, live = false) {
    return '<figure class="cp-guide" data-guide-state="loading" aria-busy="true">'+
      '<img '+(live?'':'id="cp-guide-image" ')+'alt="Official illustrated guide for '+esc(source.name)+' hole '+h.n+'" referrerpolicy="no-referrer" decoding="async" hidden>'+
      '<div class="cp-guide-loading" role="status">Loading hole guide…</div>'+
      '<div class="cp-guide-dialog-error" role="status" hidden><b>The illustration could not load.</b><p>Check your connection and try again.</p><button type="button" data-guide-retry>Retry image</button></div>'+
      (live?'':'<figcaption>Hole '+h.n+' · Official club guide</figcaption>')+'</figure>';
  }
  function stopGuideLoad(within) {
    if(guideLoad && (!within || within.contains(guideLoad.figure))){guideLoad.cancel();guideLoad=null;}
  }
  function loadGuide(figure, source) {
    stopGuideLoad();
    const img=figure.querySelector('img'), loading=figure.querySelector('.cp-guide-loading');
    const failure=figure.querySelector('.cp-guide-dialog-error'), retry=figure.querySelector('[data-guide-retry]');
    let disposed=false, revision=0, timer, retried=false;
    function start(fresh=false) {
      const token=++revision;
      clearTimeout(timer);
      figure.dataset.guideState='loading';figure.setAttribute('aria-busy','true');
      img.hidden=true;loading.hidden=false;failure.hidden=true;
      const active=()=>!disposed && token===revision && figure.isConnected && figure.dataset.guideState==='loading';
      const fail=()=>{
        if(!active())return;
        clearTimeout(timer);
        if(!retried && navigator.onLine!==false){retried=true;start(true);return;}
        figure.dataset.guideState='error';figure.setAttribute('aria-busy','false');
        loading.hidden=true;failure.hidden=false;
        img.onload=img.onerror=null;img.removeAttribute('src');
      };
      img.onload=async()=>{
        try {
          // A streaming JPEG can paint only its first rows while naturalWidth is
          // already populated. Reveal it only after the full response decodes.
          if(img.decode)await img.decode();
          if(!active())return;
          if(!img.complete || !img.naturalWidth || !img.naturalHeight)return fail();
          clearTimeout(timer);figure.dataset.guideState='ready';figure.setAttribute('aria-busy','false');
          img.hidden=false;loading.hidden=true;
        } catch {fail();}
      };
      img.onerror=fail;
      timer=setTimeout(fail,12000);
      const url=new URL(source,document.baseURI);
      if(fresh)url.searchParams.set('caddie-guide-retry',Date.now()+'-'+token);
      img.src=url.href;
    }
    const again=()=>{retried=false;start(true);};
    retry.addEventListener('click',again);
    guideLoad={figure,cancel:()=>{disposed=true;revision++;clearTimeout(timer);img.onload=img.onerror=null;retry.removeEventListener('click',again);img.removeAttribute('src');}};
    start();
  }
  function teaser(courseId) {
    const source = findCourse(courseId);
    if(source)return '<section class="cp-entry"><div><span class="cp-eyebrow">COURSE PREP · '+source.holes.length+' HOLES</span><h2 data-no-fold>'+esc(source.shortName)+', before the first tee.</h2><p>Your bag, targets and hole notes.</p></div><button class="hq-btn" data-action="open-course-prep" data-course="'+source.id+'">Prepare '+esc(source.shortName)+' ↗</button></section>';
    return '<section class="cp-entry"><div><span class="cp-eyebrow">COURSE PREP · '+courses.length+' COURSES</span><h2 data-no-fold>Your courses, before the first tee.</h2><p>Explore every hole. Put your bag on the map. Save your plan.</p></div>' +
      '<button class="hq-btn" data-action="open-course-prep">Explore courses <span aria-hidden="true">↗</span></button></section>';
  }
  function setup() {
    return '<details class="cp-setup" id="cp-setup"><summary>Google Maps setup <span>' + (key() ? 'Key saved' : 'Connect 3D') + '</span></summary>' +
      '<p>Enable Maps JavaScript API and billing in the same Google Cloud project as your key. Choose Websites as the application restriction, including on iPhone, and restrict the key to Maps JavaScript API. ' +
      link('https://console.cloud.google.com/google/maps-apis/credentials', 'Open Google setup ↗') + '</p>' +
      '<label for="cp-api-key">Browser API key</label><div class="cp-key-row"><input id="cp-api-key" type="password" autocomplete="off" spellcheck="false" placeholder="' + (key() ? 'A key is saved · paste to replace' : 'Paste your restricted key') + '">' +
      button('key-save', 'Connect') + (key() ? button('key-clear', 'Disconnect') : '') + '</div>' +
      '<p class="cp-muted">Saved only on this device, outside golf backups. Restrict the website to https://mcdermottj639.github.io/* and set usage limits in Google Cloud. Maps need internet; course routes and your saved notes work offline after loading.</p></details>';
  }
  function mapViews() {
    if(mode==='guide')return '';
    return '<div class="cp-map-views"><div class="cp-imagery-views" role="group" aria-label="Imagery view">'+
      [['3d','3D']].map(([k,label])=>button('mode',label,'data-mode="'+k+'" aria-pressed="'+(mode===k)+'"')).join('')+'</div>'+
      button('mode','Simple map','class="cp-simple-view" data-mode="route" aria-pressed="'+(mode==='route')+'"')+button('reset-view','Reset view','title="Return to the starting hole view"')+'</div>'+
      (mode==='route'?'<p class="cp-map-view-note" role="status">'+(navigator.onLine===false?'You’re offline · using the simple map':'Simple map · works offline')+'</p>':'');
  }
  function mapSurface() {
    if(!packReady())return '<div class="cp-pack-loading" role="status"><h3>Course map</h3><p>'+esc(loadErrors.get(course.id)||'Loading your course…')+'</p><p>Your saved notes and club choices remain available below.</p>'+(loadErrors.has(course.id)?button('retry-pack','Retry download'):'')+'</div>';

    return '<div class="cp-modes'+(hasGuide(course,currentHole())?'':' cp-map-only')+'" role="group" aria-label="Hole view">'+
      (hasGuide(course,currentHole()) ? button('mode','Hole guide','data-mode="guide" aria-pressed="'+(mode==='guide')+'"') : '')+
      button('mode','Interactive map','data-mode="map" aria-pressed="'+(mode!=='guide')+'"')+'</div>'+mapViews()+
      '<div class="cp-map-canvas"><div class="cp-map-stage" id="cp-map-stage"></div><div id="cp-tee-preview" class="cp-tee-preview" hidden></div></div><div class="cp-reference" id="cp-reference" hidden></div><div id="cp-map-controls"></div><div class="cp-map-caption" id="cp-map-caption"></div>';
  }
  function nearbyCourses() {
    const here=bridge?.here?.();
    const valid=here && Number.isFinite(here.lat) && Number.isFinite(here.lon);
    return courses.map(c=>({course:c,miles:valid&&c.center?.every(Number.isFinite)?distance([here.lat,here.lon],c.center)/1760:null}))
      .sort((a,b)=>(a.miles??Infinity)-(b.miles??Infinity));
  }
  function coursePicker() {
    return '<div class="cp-course-picker"><label for="cp-courses">Course</label><select id="cp-courses">'+nearbyCourses().map(({course:c,miles})=>'<option value="'+c.id+'" '+(c.id===course.id?'selected':'')+'>'+esc(c.shortName)+(miles===null?'':' · '+(miles<10?miles.toFixed(1):Math.round(miles))+' mi')+'</option>').join('')+'</select>'+button('nearby','Locate','title="Use my location to open the nearest course" aria-label="Use my location"')+'</div>';
  }
  function downloads() {
    return '<details class="cp-downloads" id="cp-downloads"><summary>Downloads & offline access <span id="cp-download-status" role="status">Checking offline availability…</span></summary><p><strong>'+esc(course.shortName)+' on this device</strong></p><div class="cp-download-actions">'+button('favorite',packs?.favorite(course.id)?'★ Favorite':'☆ Favorite','aria-pressed="'+!!packs?.favorite(course.id)+'"')+button('download','Download for offline')+'</div><p>Favorites stay downloaded, plus five recent courses up to 30 MB. Offline includes mapped Caddie HQ guides and simple maps; Google imagery and club artwork need internet.</p><div id="cp-download-list"></div>'+button('remove-download','Remove this download')+'<p>Removing a download also removes its favorite status. Your rounds, notes and targets stay saved.</p></details>';
  }
  async function downloadStatus() {
    if(!packs||!root)return;
    const node=root,id=course.id,el=node.querySelector('#cp-download-status');if(!el)return;
    const s=await packs.status(id);if(root!==node||course.id!==id)return;
    el.textContent=(s.busy?'Downloading…':s.available?'Available offline · '+(s.bytes/1024/1024).toFixed(2)+' MB'+(s.current?'':' · previous version'):'Not downloaded')+(s.error?' · '+s.error:'');
    node.querySelector('[data-cp="download"]').textContent=s.available?'Update download':'Download for offline';
    node.querySelector('[data-cp="download"]').disabled=s.busy;
    const fav=node.querySelector('[data-cp="favorite"]');fav.textContent=s.favorite?'★ Favorite':'☆ Favorite';fav.setAttribute('aria-pressed',s.favorite);
    const list=node.querySelector('#cp-download-list');
    const all=await Promise.all(courses.map(async c=>({c,s:await packs.status(c.id)})));if(root!==node)return;
    list.innerHTML=all.filter(({s})=>s.favorite||s.available).map(({c,s})=>'<div><b>'+esc(c.shortName)+'</b><span>'+(s.busy?'Downloading…':s.available?'Available offline':'Needs download')+(s.favorite?' · Favorite':'')+'</span></div>').join('');
  }
  function render() {
    bagSnapshot = null;
    const m = model(), t = teeSet(), h = currentHole(), hs = savedHole();
    const count = course.holes.filter(x => m.holes[m.tee + ':' + x.n]?.reviewed).length;
    return '<div class="cp-workspace" id="course-prep">' +
      coursePicker()+
      '<div class="cp-grid"><div class="cp-map-column"><section class="cp-map-panel" aria-label="Hole guide and map"><header class="cp-hole-heading"><div><span class="cp-eyebrow">' + esc(t.name) + ' TEES</span><h3>Hole ' + hole + '<small>Par ' + h.par + ' · ' + yard(t.yards[hole - 1]) + ' yd' + (h.si ? ' · Hcp '+h.si : '') + '</small></h3></div><div id="cp-header-camera"></div><div class="cp-arrows">' +
      button('previous', '←', 'aria-label="Previous hole" ' + (hole === 1 ? 'disabled' : '')) + button('next', '→', 'aria-label="Next hole" ' + (hole === course.holes.length ? 'disabled' : '')) + '</div></header>' +
      mapSurface() + '</section>' +
      '<section class="cp-hole-browser" aria-label="Explore holes"><div class="cp-progress"><span><b id="cp-reviewed-count">' + count + '/'+course.holes.length+'</b> holes reviewed</span><span id="cp-save-status" role="status" aria-live="polite">Plans saved on this device</span></div>' +
      (course.nines ? '<div class="cp-nines" role="group" aria-label="Choose a nine">'+course.nines.map(n=>button('nine',esc(n.name)+'<span>'+n.holes[0]+'–'+n.holes.at(-1)+'</span>','data-n="'+n.holes[0]+'" aria-pressed="'+n.holes.includes(hole)+'"')).join('')+'</div>' : '')+
      '<div class="cp-holes" role="group" aria-label="Choose a hole">' + course.holes.filter(x=>!course.nines || course.nines.find(n=>n.holes.includes(hole)).holes.includes(x.n)).map(x => '<button type="button" data-cp="hole" data-n="' + x.n + '" aria-label="Hole ' + x.n + ', par ' + x.par + '" ' + (x.n === hole ? 'aria-current="step"' : '') + ' class="' + (m.holes[m.tee + ':' + x.n]?.reviewed ? 'reviewed' : '') + '"><b>' + x.n + '</b><span>Par ' + x.par + '</span></button>').join('') + '</div></section></div>' +
      '<aside class="cp-plan"><section class="cp-course-settings"><h3>Course & tees</h3><p>'+esc(course.shortName)+' · '+course.holes.length+' holes · Par '+course.par+'<br>'+esc(course.place)+'</p>'+(mappedHoles().length<course.holes.length?'<p class="cp-coverage">'+mappedHoles().length+' of '+course.holes.length+' interactive hole maps ready</p>':'')+
      '<div class="cp-tee-control"><label for="cp-tees">Explore from</label><select id="cp-tees">' + course.tees.map(x => '<option value="' + x.id + '" ' + (x.id === t.id ? 'selected' : '') + '>' + x.name + ' · ' + yard(x.total) + ' yd</option>').join('') +
      '</select><span>' + (t.rating ? t.rating.toFixed(1) + ' rating · ' + t.slope + ' slope · men' : 'Rating not verified for this tee') + '</span></div></section>' +
      '<section class="cp-plan-card"><span class="cp-eyebrow">HOLE '+hole+' · YOUR SHOT PLAN</span><h3>' + (h.par === 3 ? 'Choose the carry.' : h.par === 5 ? 'Build it shot by shot.' : 'Pick your landing area.') + '</h3><p class="cp-prompt">' + esc(h.prompt) + '</p>' +
      '<label for="cp-basis">Distance source</label><select id="cp-basis"><option value="playing" '+(m.basis==='playing'?'selected':'')+'>Saved playing carries</option><option value="range" '+(m.basis==='range'?'selected':'')+'>Latest range measurements</option></select>' +
      '<p class="cp-muted">'+(m.basis==='range'?'Range conditions and club settings may differ from this round. These are planning references; your Bag stays unchanged.':'Switch to range measurements to compare clubs whose playing carry is still unset.')+'</p>' +
      '<label>Your tee club</label><div class="cp-clubs" role="group" aria-label="Choose your tee club">' + bag().map(c => button('club', '<b>' + esc(c.label) + '</b><span>' + (c.carry>0?yard(c.carry)+' yd':'Unset') + '</span>', 'data-club="' + esc(c.key) + '" aria-pressed="' + (selected()?.key === c.key) + '"')).join('') + '</div>' +
      (!bag().length ? '<p>Add a playing carry in your Bag to place a club on the map.</p>' : '') +
      '<div id="cp-club-readout"></div>' +
      '<label for="cp-roll">Rollout assumption <span id="cp-roll-label">' + (hs.roll || 0) + ' yd</span></label><input id="cp-roll" type="range" min="0" max="60" step="1" value="' + (hs.roll || 0) + '">' +
      '<p class="cp-muted">Added rollout is your scenario, not a prediction of these fairways. Carry rings show distance, not shot dispersion.</p></section>' +
      '<section class="cp-plan-card"><h3>Your hole note</h3><label class="cp-muted" for="cp-note">Target, miss to avoid, or next-shot idea</label><textarea id="cp-note" rows="3" maxlength="1800" placeholder="e.g. 5W to the open side; check the front-edge carry…">' + esc(hs.note || '') + '</textarea>' +
      '<label class="cp-reviewed"><input type="checkbox" id="cp-reviewed" ' + (hs.reviewed ? 'checked' : '') + '> I’ve reviewed this hole</label>' +
      button('review-next','Save review & next hole','class="cp-review-next"') +
      '<p class="cp-muted">Your tee-club choice and note also appear in the live-round prep for '+esc(course.shortName)+'.</p></section></aside></div>' +
      '<details class="cp-round-plan" id="cp-round-plan"><summary>Your '+course.holes.length+'-hole plan <span>Club choices & notes</span></summary><div class="cp-plan-table">' +
      course.holes.map(x => {
        const s = m.holes[m.tee + ':' + x.n] || {}, c = bag().find(y => y.key === bridge.club(course.id,x.n));
        return '<button type="button" data-cp="hole" data-n="' + x.n + '"><b>' + x.n + '</b><span>Par ' + x.par + ' · ' + t.yards[x.n - 1] + ' yd</span><strong>' + esc(c?.label || 'Choose club') + '</strong><span>' + esc(s.note || (s.reviewed ? 'Reviewed' : 'Add a plan')) + '</span></button>';
      }).join('') + '</div></details>' +
      downloads() + setup() +
      '<details class="cp-sources" id="cp-sources"><summary>Sources & map accuracy</summary><p>'+esc(course.cardNote)+' Tee selection changes the scorecard yardage; the route starts at an unspecified mapped tee until you set your own tee position.</p>' +
      '<p>Map distances are approximate horizontal measurements, not laser yardages or slope-adjusted plays-like distances. The map is incomplete: unmarked areas may contain hazards. Google 3D detail varies by location; it does not show today’s pins or putting contours.</p>' +
      '<p>' + link(course.source, course.sourceLabel || 'Scorecard source') + (course.tour ? ' · ' + link(course.tour, 'Official course tour') : '') + ' · ' + link('https://www.openstreetmap.org/copyright', '© OpenStreetMap contributors · ODbL') + ' · <a href="./data/course-prep/'+course.id+'-osm.json" download>Map source data</a></p></details></div>';
  }
  function redraw() {
    if(!liveDialog?.open)return bridge.refresh();
    // Replace only the popup contents. Rerendering the live page would close it
    // and could disturb an unfinished scorecard edit underneath the dialog.
    bagSnapshot = null;
    const content = document.createElement('div');
    content.className = 'cp-workspace cp-live-map-content';
    content.innerHTML = mapSurface() + setup();
    clearGoogle3d();
    liveDialog.querySelector('.cp-live-map-content').replaceWith(content);
    mount(content);
  }
  const initialMode = () => hasGuide(course,currentHole()) ? 'guide' : key() && navigator.onLine !== false ? '3d' : 'route';
  function selectCourse(id) {
    const next=findCourse(id);if(!next)return false;
    if(next.id!==course.id){
      epoch++;stopFlyover();stopGuideLoad();clearGoogle3d();stopLocation();
      course=next;hole=1;bagSnapshot=null;framed3d=null;
      projection=null;overview=false;edit='target';guideStyle='auto';lastMapMode='3d';mode=initialMode();
      if(!googleAuthFailed){googleFailure='';googleFailureMode='';}
    }
    return true;
  }
  function changeHole(n) {
    if (!course.holes.some(h=>h.n===n)) return;
    stopFlyover();hole=n;if(!mapReady())stopLocation();framed3d=null;
    // Keep the chosen guide/map view and imagery style while browsing holes.
    if(mode==='guide'&&!hasGuide(course,currentHole()))mode=key()&&navigator.onLine!==false?lastMapMode:'route';
    imageError=false;overview=false;redraw();
  }
  function stopFlyover() {
    if (animationHandler && maps3d) maps3d.removeEventListener('gmp-animationend', animationHandler);
    animationHandler = null;
    clearTimeout(animationTimer);
    cameraRevision++;
    const scene = maps3d;
    return queueCamera(() => scene?.stopCameraAnimation()).catch(() => {});
  }
  function unmount(keepLocation = false) { dialogRequest++; epoch++; stopFlyover(); clearGoogle3d(); stopGuideLoad(); closeGuide(); if(!keepLocation)stopLocation(); root = null; }
  function releaseLiveMap(dialog) {
    if(liveDialog !== dialog)return;
    epoch++; stopFlyover(); clearGoogle3d(); stopLocation(); root = null; liveDialog = null;
  }
  function closeGuide() {
    const dialog = document.querySelector('dialog.cp-guide-dialog[open]');
    if(!dialog)return;
    stopGuideLoad(dialog);
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
      stopGuideLoad(dialog);
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
  function loadDialog(courseId,n,kind,start) {
    const source=findCourse(courseId),h=source?.holes.find(h=>h.n===+n);if(!h)return false;
    if(kind==='map'&&h.mapReady===false)return false;
    const dialog=holeDialog(source,h,'cp-pack-dialog','Close course download','<div class="cp-pack-loading" role="status">Loading your course…</div>');
    const request=++dialogRequest;
    packs.ensure(source.id).then(()=>{
      if(request!==dialogRequest||!dialog.open)return;
      if(kind==='guide')openGuide(courseId,n);else openLiveMap(courseId,n,start);
    }).catch(()=>{if(dialog.open)dialog.querySelector('.cp-pack-loading').textContent='Course not downloaded. Connect to download it, then reopen this hole.';});
    return true;
  }
  function openGuide(courseId, n) {
    if(packs&&!packs.ready(findCourse(courseId)?.id))return loadDialog(courseId,n,'guide');
    const source = findCourse(courseId);
    const h = source?.holes.find(item => item.n === +n && hasGuide(source,item));
    if(!h)return false;
    const dialog = holeDialog(source,h,'cp-live-guide','Close hole guide',
      (h.mapReady!==false?'<div class="cp-workspace"><div class="cp-modes" role="group" aria-label="Hole view"><button type="button" aria-pressed="true">Hole guide</button><button type="button" data-live-map aria-pressed="false">Interactive map</button></div></div>':'')+
      '<div class="cp-live-guide-body cp-workspace">'+guideContent(source,h,true)+'</div>'+
      '<footer>'+guideCaption(source,h)+'</footer>');
    dialog.querySelector('[data-live-map]')?.addEventListener('click',()=>openLiveMap(source.id,h.n));
    dialog.querySelectorAll('[data-cp="guide-style"]').forEach(el=>el.addEventListener('click',()=>{guideStyle=el.dataset.style;openGuide(source.id,h.n);}));
    setupGuideZoom(dialog);
    if(!usesArt(source,h))loadGuide(dialog.querySelector('.cp-guide'),h.guide);
    return true;
  }
  function openLiveMap(courseId, n, start = '3d') {
    if(packs&&!packs.ready(findCourse(courseId)?.id))return loadDialog(courseId,n,'map',start);
    if(start==='satellite')start='3d'; // legacy callers resume in 3D
    const source=findCourse(courseId), h=source?.holes.find(item=>item.n===+n);
    if(!h || h.mapReady===false || !bridge)return false;
    closeGuide();selectCourse(source.id);
    const dialog = holeDialog(course,h,'cp-live-map','Close interactive map','<div class="cp-live-map-content"></div>');
    liveDialog = dialog; hole = h.n; framed3d = null;
    mode = key() && navigator.onLine!==false && ['3d','route'].includes(start) ? start : 'route';
    lastMapMode = mode; overview = false; edit = 'target';
    if(!googleAuthFailed && googleFailureMode && googleFailureMode!==mode)googleFailure='';
    redraw();
    return true;
  }
  function mount(node) {
    root = node;
    if (!root) return;
    root.addEventListener('dblclick', e=>{if(e.target.closest('#cp-map-stage')){e.preventDefault();e.stopPropagation();}},true);
    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    root.addEventListener('change', onChange);
    root.addEventListener('keydown', e => {
      const el = e.target.closest('[data-cp="map-hole"]');
      if (el && ['Enter',' '].includes(e.key)) { e.preventDefault(); changeHole(+el.dataset.n); }
    });
    downloadStatus();
    if(!packReady()){
      readout();
      const id=course.id,node=root;
      if(!loadErrors.has(id))packs.ensure(id).then(()=>{if(root===node&&course.id===id)redraw();}).catch(()=>{
        loadErrors.set(id,'This course is not downloaded. Connect to the internet and retry.');
        if(root===node&&course.id===id)redraw();
      });
      return;
    }
    packs?.ensure(course.id).catch(()=>{});
    drawView();
    readout();
  }
  function onClick(e) {
    const el = e.target.closest('[data-cp]');
    if (!el || !root?.contains(el)) return;
    switch (el.dataset.cp) {
      case 'nearby': {
        const node=root,id=course.id,n=hole;
        bridge.locate?.(()=>{if(root!==node||course.id!==id||hole!==n)return;selectCourse(nearbyCourses()[0].course.id);redraw();});
        break;
      }
      case 'retry-pack': loadErrors.delete(course.id);redraw();break;
      case 'favorite': packs.pin(course.id,!packs.favorite(course.id)).catch(()=>bridge.toast('Download incomplete. Connect and retry.'));break;
      case 'download': {
        const id=course.id;
        packs.pin(id,true).then(()=>{loadErrors.delete(id);if(course.id===id&&!packReady())redraw();}).catch(()=>bridge.toast('Download incomplete. Connect and retry.'));break;
      }
      case 'remove-download': packs.remove(course.id).catch(()=>bridge.toast('Could not remove this download.'));break;
      case 'guide-style': guideStyle=el.dataset.style;redraw();root?.querySelector('.cp-map-panel')?.scrollIntoView({block:'start'});break;
      case 'nine': case 'hole': case 'map-hole': changeHole(+el.dataset.n);root?.querySelector('.cp-map-panel')?.scrollIntoView({block:'start'});break;
      case 'previous': changeHole(hole - 1); break;
      case 'next': changeHole(hole + 1); break;
      case 'mode': {
        const requested=el.dataset.mode;
        if(!['guide','map','route','3d'].includes(requested))break;
        if(requested==='guide'&&!hasGuide(course,currentHole()))break;
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
      case 'club': bridge.setClub(course.id,hole, el.dataset.club); redraw(); break;
      case 'review-next': {
        saveHole({reviewed:true});
        const m=model(), next=Array.from({length:course.holes.length},(_,i)=>(hole+i)%course.holes.length+1).find(n=>!m.holes[m.tee+':'+n]?.reviewed);
        if(next){changeHole(next);root?.querySelector('.cp-map-panel')?.scrollIntoView({block:'start'});}else{redraw();bridge.toast('All '+course.holes.length+' holes reviewed');} break;
      }
      case 'rings': showRings=!showRings;refreshOverlays();drawControls();break;
      case 'locate': useLocation();break;
      case 'use-tee': stopLocation();updateMeasurements();break;
      case 'reset-view': overview=false;if(mode==='3d')Promise.resolve(frameGoogle('tee')).catch(()=>bridge.toast('The camera could not move. Try again.'));else drawView();break;
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
    if(e.target.id==='cp-map-club'){bridge.setClub(course.id,hole,e.target.value);redraw();return;}
    if (e.target.id === 'cp-courses') { if(selectCourse(e.target.value))redraw();return; }
    if (e.target.id === 'cp-tees') { const m = model(); m.tee = e.target.value; bridge.save(course.id,clean(m)); redraw(); }
    if (e.target.id === 'cp-basis') { const m = model(); m.basis = e.target.value; bridge.save(course.id,clean(m)); redraw(); }
    if (e.target.id === 'cp-reviewed') {
      saveHole({reviewed: e.target.checked});
      const m = model(), count = course.holes.filter(h => m.holes[m.tee + ':' + h.n]?.reviewed).length;
      root.querySelector('#cp-reviewed-count').textContent = count + '/'+course.holes.length;
      root.querySelector('.cp-holes [data-n="' + hole + '"]').classList.toggle('reviewed', e.target.checked);
    }
  }
  function readout() {
    if (!root?.querySelector('#cp-club-readout')) return;
    if(!packReady()){root.querySelector('#cp-club-readout').textContent='Download the course to compare map yardages. Your plan stays saved.';return;}
    if(!mapReady()){root.querySelector('#cp-club-readout').innerHTML='<p class="cp-muted">Save your club choice and note for this hole. Map yardages are unavailable while its positions are checked.</p>';return;}
    const c = selected(), roll = savedHole().roll || 0;
    const toTarget = distance(origin(), target()), toGreen = distance(target(), green());
    const selectedKey = bridge.club(course.id,hole);
    const preview=teePreview();
    const hasTarget = !!savedHole().target;
    let html = hasTarget
      ? '<div class="cp-distances"><span><b>' + yard(toTarget) + '</b>yd to your target</span><span><b>' + yard(toGreen) + '</b>yd left to green</span></div>'
      : preview ? '<div class="cp-distances"><span><b>'+yard(preview.club.carry)+'</b>yd projected carry</span><span><b>'+yard(preview.left)+'</b>yd left to green</span></div><p class="cp-muted">'+esc(preview.source)+(preview.source==='Suggested tee club'?' · based on carry distance':'')+'. Projection follows your aim or the mapped route; check hazards and your actual tee. Tap the map to set your own target.</p>'
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
    const points = all ? mappedHoles().flatMap(h => h.path) : [...currentHole().path, origin(), target(),...(teePreview()?[teePreview().landing]:[])];
    const anchor = all ? course.center : origin(), cosLat = Math.cos(rad(anchor[0]));
    const heading = all ? 0 : bearing(origin(), green()), angle = -rad(heading), co = Math.cos(angle), si = Math.sin(angle);
    const xy = p => {
      const x = (p[1]-anchor[1])*cosLat*111195, y = -(p[0]-anchor[0])*111195;
      return [x*co-y*si,x*si+y*co];
    };
    const stage = root.querySelector('#cp-map-stage'), width = stage.clientWidth || 400, height = stage.clientHeight || 500;
    const projected = points.map(xy), xs = projected.map(p => p[0]), ys = projected.map(p => p[1]);
    const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
    const padTop=!all&&teePreview()?90:65,centerY=(padTop+height-65)/2;
    const scale = Math.min((width-90)/Math.max(100,right-left), (height-padTop-65)/Math.max(80,bottom-top));
    const mx = (left+right)/2, my = (top+bottom)/2;
    return {scale,width,height,heading,
      to:p=>{const [x,y]=xy(p);return [width/2+(x-mx)*scale,centerY+(y-my)*scale];},
      from:p=>{
        const x=mx+(p[0]-width/2)/scale,y=my+(p[1]-centerY)/scale;
        return [anchor[0]-(-x*si+y*co)/111195,anchor[1]+(x*co+y*si)/(111195*cosLat)];
      }};
  }
  // Static SVG templates work with maps3d without loading the optional marker library.
  function mapIcon(kind) {
    const shape=kind==='green'
      ? '<path d="M10 30h20" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M15 29V8" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M17 8l14 6-14 6z" fill="#d9f58d"/>'
      : kind==='you'
      ? '<circle cx="20" cy="20" r="7" style="fill:#fff;stroke:none"/>'
      : '<path d="M12 12h16M20 12v17" stroke="#fff" stroke-width="4" stroke-linecap="round"/>';
    return '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="40" viewBox="0 0 40 44"><path d="M15 35l5 7 5-7" fill="'+(kind==='green'?'#245d43':'#176b9b')+'"/><circle cx="20" cy="20" r="18" style="fill:'+(kind==='green'?'#245d43':'#176b9b')+';stroke:#fff;stroke-width:2"/>'+shape+'</svg>';
  }
  function decorateMapMarker(marker,kind) {
    if(marker.dataset.iconKind===kind)return;
    try {
      marker.replaceChildren();
      if(kind!=='target') {
        const template=document.createElement('template');
        template.innerHTML=mapIcon(kind);
        marker.append(template);
      }
      marker.dataset.iconKind=kind;
    } catch (_) { /* An optional icon must never prevent the map from opening. */ }
  }
  function svgMap() {
    projection = projectFor(overview);
    const {width:w,height:h,heading} = projection;
    const path = pts => pts.map(p => projection.to(p).map(x => x.toFixed(2)).join(',')).join(' ');
    const pnt = (p, kind, label) => {
      const [x,y]=projection.to(p), dy=kind==='tee'?23:kind==='green'&&savedHole().target?23:-37;
      const margin=Math.min(w/2-8,label.length*3.8), labelX=Math.max(margin,Math.min(w-margin,x));
      const iconKind=kind==='tee'?(liveLocation()?'you':'tee'):kind;
      const icon=kind==='tee'||kind==='green'
        ? '<g pointer-events="none" transform="translate('+(x-14.4)+','+(y-32)+') scale(.8)">'+mapIcon(iconKind)+'</g>'
        : '<path d="M0 0C-3-5-10-12-10-19a10 10 0 1 1 20 0C10-12 3-5 0 0Z" transform="translate('+x+','+y+')" fill="#e53935" stroke="#fff" stroke-width="1.5"/>';
      return '<g class="cp-map-point cp-point-'+kind+'" data-point="'+kind+'"><circle cx="'+x+'" cy="'+y+'" r="7" style="fill:transparent;stroke:none"/>'+icon+'<text x="'+labelX+'" y="'+Math.max(45,Math.min(h-40,y+dy))+'" text-anchor="middle" class="cp-map-label">'+label+'</text></g>';
    };
    const polys = course.features.filter(f=>['fairway','green','bunker','water'].includes(f.kind)).map(f => '<polygon points="'+path(f.path)+'" class="cp-feature cp-feature-'+f.kind+'"/>').join('');
    const lines = (overview ? mappedHoles() : [currentHole()]).map(holeData => {
      const [x,y]=projection.to(holeData.path[0]);
      return '<g data-cp="map-hole" data-n="'+holeData.n+'"'+(overview?' tabindex="0" role="button" aria-label="Explore hole '+holeData.n+'"':'')+'><polyline points="'+path(holeData.path)+'" class="cp-route-line '+(holeData.n===hole?'selected':'')+'"/>'+
        (overview?'<circle cx="'+x+'" cy="'+y+'" r="13" class="cp-hole-dot"/><text x="'+x+'" y="'+(y+4)+'" text-anchor="middle" class="cp-hole-number">'+holeData.n+'</text>':'')+'</g>';
    }).join('');
    let overlay = '', yardages = '';
    if (!overview) {
      const c=selected(), preview=teePreview(), [x,y]=projection.to(origin()), roll=savedHole().roll||0;
      for(let d=100;d<distance(origin(),green())-25;d+=100){
        const arc=Array.from({length:25},(_,i)=>destination(origin(),d,heading-28+i*56/24));
        const [lx,ly]=projection.to(arc[0]);
        yardages += '<polyline points="'+path(arc)+'" class="cp-yardage-arc"/><text x="'+Math.max(13,lx-5)+'" y="'+(ly-6)+'" class="cp-yardage-label">'+d+' yd</text>';
      }
      if (showRings && c && c.carry > 0) {
        overlay += '<circle cx="'+x+'" cy="'+y+'" r="'+(c.carry*0.9144*projection.scale)+'" class="cp-carry-ring"/>';
        if (roll) overlay += '<circle cx="'+x+'" cy="'+y+'" r="'+((c.carry+roll)*0.9144*projection.scale)+'" class="cp-roll-ring"/>';
      }
      if(preview)overlay += '<polyline points="'+path([preview.tee,preview.landing])+'" class="cp-tee-line"/>'+pnt(preview.landing,'landing',esc(landingLabel(preview)));
      if(savedHole().target&&!preview)overlay += '<polyline points="'+path([origin(),target(),green()])+'" class="cp-aim-line"/>';
      overlay += pnt(origin(),'tee',referenceName()) + pnt(green(),'green',savedHole().target?'Mapped green':'Green · '+yard(distance(origin(),green()))+' yd') +
        (savedHole().target&&!preview ? pnt(target(),'target',targetYardage()) : '');
    }
    const scaleYards = overview ? 100 : 50, scaleWidth=scaleYards*0.9144*projection.scale;
    return '<svg id="cp-route-map" viewBox="0 0 '+w+' '+h+'" aria-label="Approximate mapped routes for '+esc(course.shortName)+'. '+(overview?'Choose a hole.':'Tee at bottom. Click to set your target or tee.')+'" role="img">'+
      '<defs><pattern id="cp-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="#204d3e" stroke-opacity=".035"/></pattern></defs>'+
      '<rect width="'+w+'" height="'+h+'" fill="#eef1e4"/><rect width="'+w+'" height="'+h+'" fill="url(#cp-grid)"/>'+polys+yardages+lines+overlay+
      '<text x="18" y="27" class="cp-map-kicker">'+(!overview&&teePreview()?'':overview?esc(course.shortName.toUpperCase())+' · '+mappedHoles().length+' MAPPED HOLES':liveLocation()?'MY LOCATION → GREEN':'TEE → GREEN')+'</text>'+
      '<g class="cp-map-compass" transform="translate('+(w-27)+' 31)"><text x="0" y="-16" text-anchor="middle">N</text><path d="M0 -10L-4 4L0 1L4 4Z" transform="rotate('+(-heading)+')"/></g>'+
      '<g class="cp-map-scale"><path d="M18 '+(h-24)+'v6h'+scaleWidth+'v-6" fill="none" stroke="currentColor" stroke-width="2"/><text x="18" y="'+(h-31)+'">'+scaleYards+' yd</text></g></svg>';
  }
  function drawControls() {
    requestAnimationFrame(fitPrepMap);
    if (!root) return;
    drawTeePreview();
    const headerCamera=root.querySelector('#cp-header-camera');
    if(headerCamera)headerCamera.innerHTML='';
    if(mode==='guide'){
      root.querySelector('#cp-reference').hidden=true;root.querySelector('#cp-map-controls').innerHTML='';
      root.querySelector('#cp-map-caption').innerHTML=guideCaption(course,currentHole());return;
    }
    if(!mapReady()){
      root.querySelector('#cp-reference').hidden=true;root.querySelector('#cp-map-controls').innerHTML='';
      root.querySelector('#cp-map-caption').textContent='Your hole plan is available. Mapped yardages are awaiting a position check.';return;
    }
    drawReference();
    const el = root.querySelector('#cp-map-controls');
    const mapped = mode !== 'guide' && (mode === 'route' || (!!key() && !googleFailure));
    el.innerHTML = (mapped && !overview ? '<div class="cp-map-summary">'+(savedHole().target&&!teePreview() ? '<span><b>'+yard(distance(origin(),target()))+' yd</b> to your target</span><span><b>'+yard(distance(target(),green()))+' yd</b> left to green</span>' : teePreview()?'<span><b>'+esc(selected().label)+' · '+yard(selected().carry)+' yd</b>projected carry from '+referenceName().toLowerCase()+'</span><span><b>'+yard(teePreview().left)+' yd</b>left from projected landing</span>' : '<span><b>'+yard(distance(origin(),green()))+' yd</b> '+referenceName().toLowerCase()+' → mapped green</span><span>Tap a landing spot<br>to plan your shot</span>')+'</div>' : '') +
      (mapped && !overview ? '<div class="cp-map-legend"><span><i class="cp-legend-tee">'+(liveLocation()?'●':'T')+'</i> '+(liveLocation()?'You':'Tee')+'</span><span><i class="cp-legend-target">A</i> Aim</span><span><i class="cp-legend-green">G</i> Green</span>'+(selected()?.carry>0?'<span class="cp-map-club">'+esc(selected().label)+' · '+yard(selected().carry)+' yd carry</span>':'')+'</div>':'') + '<div class="cp-map-tools">' + (mode === 'route' && !liveDialog ? button('overview', overview ? 'Focus this hole' : 'All '+course.holes.length+' holes') : '') +
      (mapped && !overview ? button('edit','Landing target','data-kind="target" aria-pressed="'+(edit==='target')+'"')+button('edit','Set tee','data-kind="tee" aria-pressed="'+(edit==='tee')+'"') : '') +
      (mapped && !overview && selected()?.carry>0 ? button('rings','Carry rings','aria-pressed="'+showRings+'"'):'')+
      (savedHole().target ? button('clear-target','Clear target'):'') + (mapped && mode==='3d' ? button('stop','Stop'):'') + (savedHole().tee ? button('reset-tee','Reset tee'):'') + '</div>';
    if(mapped && mode==='3d') {
      const controls='<div class="cp-map-tools cp-camera-tools">'+(!liveDialog?button('shot-plan','Shot plan ↓'):'')+button('frame','Whole hole','data-focus="hole"')+button('frame','Green','data-focus="green" aria-label="Green close-up"')+button('fly','Fly hole','aria-label="Fly this hole"')+'</div>';
      if(headerCamera)headerCamera.innerHTML=controls;
      else el.innerHTML+=controls;
    }
    root.querySelector('#cp-map-caption').innerHTML = mode === 'guide'
      ? 'Official club illustration · not to scale. '+link(course.tour,'Open course guide ↗')
      : ((mode==='3d')?'One finger to move · pinch to zoom. Scroll outside the map to move the page. ':'')+(overview ? mappedHoles().length+' mapped routes. Select a hole to plan a shot.' : 'Tap to set your '+(edit==='target'?'landing target':'tee')+'. '+(liveLocation()?'Distances from your current location.':savedHole().tee?'Distances from your tee position.':'Mapped reference tee; set yours before comparing distances.'))+
        (teePreview()?'<span>Carry projection only · no rollout or dispersion assumed. Check hazards and actual tee position.</span>':'')+'<span>Approximate routes · incomplete hazard coverage · '+link('https://www.openstreetmap.org/copyright','© OpenStreetMap contributors')+'</span>';
  }
  // Fit the entire opening visual above the bottom navigation, including iOS safe areas.
  // Use document position so scrolling to the shot plan never grows/shrinks the map.
  function fitPrepMap() {
    if(!root || liveDialog || window.visualViewport?.scale>1)return;
    const stage=root.querySelector('#cp-map-stage');if(!stage)return;
    const viewport=window.visualViewport;
    const bottom=(viewport?.height || innerHeight)+(viewport?.offsetTop || 0);
    const nav=document.querySelector('#nav')?.getBoundingClientRect();
    const edge=nav && nav.width>innerWidth*.7 ? Math.min(bottom,nav.top) : bottom;
    const top=stage.getBoundingClientRect().top+scrollY;
    const available=Math.max(80,Math.floor(edge-top-8));
    stage.style.minHeight='0';
    if(mode==='guide') {
      stage.style.height='auto';
      const wrap=stage.querySelector('.cp-guide-zoom');
      if(wrap) {
        const controls=wrap.querySelector('.cp-guide-zoom-tools').getBoundingClientRect().height;
        const choices=wrap.querySelector('.cp-guide-styles')?.getBoundingClientRect().height || 0;
        wrap.style.setProperty('--guide-height',Math.max(40,available-controls-choices)+'px');
      }
    } else stage.style.height=available+'px';
  }
  async function drawView() {
    if (!root || !packReady()) return;
    const token=++epoch, stage=root.querySelector('#cp-map-stage');
    stopFlyover();
    stopGuideLoad();
    clearGoogle3d();
    stage.dataset.view = mode;
    stage.replaceChildren();
    drawControls();
    fitPrepMap();
    if (mode==='guide' && hasGuide(course,currentHole())) {
      stage.innerHTML = guideContent(course,currentHole());
      fitPrepMap();
      setupGuideZoom(stage);
      stage.dataset.art = usesArt(course,currentHole()) ? 'true' : 'false';
      if(!usesArt(course,currentHole())){
        const failure=stage.querySelector('.cp-guide-dialog-error');
        failure.insertAdjacentHTML('beforeend',(canDrawGuide(course,currentHole())?button('guide-style','Use Caddie HQ guide','data-style="caddie"'):mapReady()?button('mode','Open simple map','data-mode="route"'):'')+link(course.tour,'Open the club’s guide ↗'));
        loadGuide(stage.querySelector('.cp-guide'),currentHole().guide);
      }
      return;
    }
    if(!mapReady()){
      stage.innerHTML='<div class="cp-map-message"><span class="cp-eyebrow">HOLE '+hole+'</span><h3>Map under review</h3><p>'+esc(currentHole().mapNote || 'The mapped positions for this hole need checking.')+'</p>'+(hasGuide(course,currentHole())?button('mode','View hole guide','data-mode="guide"'):'')+link(course.source,'View the published scorecard ↗')+'</div>';return;
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
      stage.innerHTML='<div class="cp-map-message"><span class="cp-orbit" aria-hidden="true">◎</span><h3>'+ ('Explore '+esc(course.shortName)+' in 3D') +'</h3><p>Connect your Google Maps key to load this view inside Caddie HQ.</p>'+button('map-setup','Connect Google Maps')+button('mode','Use simple map','data-mode="route"')+link('https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(course.name+' '+course.place),'Open '+esc(course.shortName)+' in Google Maps ↗')+'</div>';
      return;
    }
    if (googleAuthFailed || googleFailure) return mapError(googleFailure, googleFailureMode);
    stage.innerHTML='<div class="cp-map-message" role="status">Loading Google '+'3D'+'…</div>';
    let stageName = 'loading Google';
    try {
      await loadGoogle();
      stageName = 'loading the map library';
      if(token!==epoch||!root)return;
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
          maps3d.addEventListener('gmp-error',()=>{if(root&&mode==='3d')mapError('3D could not initialize on this device. Try the simple map.','3d');});
        }
        stage.replaceChildren(maps3d);
        stageName = 'drawing the 3D hole';
        drawGoogle3d(lib);
        stageName = 'positioning the 3D camera';
        if(framed3d!==hole){await frameGoogle('tee');if(token!==epoch||!root)return;framed3d=hole;}
    } catch {
      if(token===epoch&&root)mapError(googleFailure || 'The 3D view'+' could not finish '+stageName+'. Reload and retry, or choose another view.', mode);
    }
  }
  const ll = p => ({lat:p[0],lng:p[1]});
  function teeCamera() {
    // Look along the hole from above/behind its tee, independent of GPS yardages.
    const tee=teeOrigin(), preview=teePreview(), heading=bearing(tee,preview?.landing||green());
    const length=distance(tee,preview?.landing||green());
    return {center:{...ll(destination(tee,length*(preview?.landing?0.5:0.3),heading)),altitude:0},altitudeMode:'RELATIVE_TO_GROUND',
      range:Math.max(240,length*0.9144*(preview?1.4:0.95)),heading,tilt:58,roll:0};
  }
  function frameGoogle(focus) {
    const stopped=stopFlyover(), revision=cameraRevision;
    const path=[...currentHole().path,origin(),...(savedHole().target?[target()]:[])];
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
    if(!pointOK(p))return bridge.toast('Choose a point within the '+course.shortName+' course area');
    saveHole({[edit]:p.map(x=>+x.toFixed(7))});readout();refreshOverlays();drawControls();
  }
  function refreshOverlays() {
    if(!root)return;
    try {
      if(mode==='route')drawView();
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
    if(!root||mode!=='3d')return;
    stopFlyover();
    clearGoogle3d();
    root.querySelector('#cp-map-stage').innerHTML='<div class="cp-map-message"><h3>Google Maps is unavailable</h3><p>'+esc(message)+'</p>'+(googleErrorCode?'<code class="cp-error-code">'+esc(googleErrorCode)+'</code>':'')+button('retry','Reload & retry')+button('map-setup','Maps setup')+button('mode','Use simple map','data-mode="route"')+'</div>';
    drawControls();
  }
  function clearGoogle3d() {
    // Remove our overlays while the map is still attached. Detaching the map
    // first disposes Google's renderer before its markers can unregister.
    lines3d.splice(0).forEach(line=>line.remove());
    markers3d.forEach(marker=>{marker.position=null;marker.label=null;marker.remove();});
  }
  function drawGoogle3d(lib) {
    if(!lib||!maps3d)return;
    lines3d.splice(0).forEach(line=>line.remove());
    const addLine=element=>{lines3d.push(element);maps3d.append(element);};
    const line=(path,color,width)=>new lib.Polyline3DElement({path:path.map(ll),strokeColor:color,strokeWidth:width,altitudeMode:'CLAMP_TO_GROUND',drawsOccludedSegments:true});
    addLine(line(currentHole().path,'#c5e78a',4));
    const preview=teePreview();
    if(preview)addLine(line([preview.tee,preview.landing],'#49d4d0',4));
    if(savedHole().target&&!preview)addLine(line([origin(),target(),green()],'#ffb766',3));
    // Basic 3D markers need only maps3d. Optional PinElement customization must not
    // become a startup dependency: a customization failure must not hide the map.
    const points=[[origin(),liveLocation()?'You':'Tee',liveLocation()?'you':'tee'],[green(),savedHole().target?'Green':'Green · '+yard(distance(origin(),green()))+' yd','green'],...(savedHole().target&&!preview?[[target(),targetYardage()]]:[]),...(preview?[[preview.landing,landingLabel(preview)]]:[])];
    if(lib.Marker3DElement)points.forEach(([p,label,kind='target'],i)=>{
      // Keep at most three stable marker identities. GPS/target updates and hole
      // changes move these pins instead of accumulating asynchronous pin renders.
      const marker=markers3d[i] || (markers3d[i]=new lib.Marker3DElement({altitudeMode:'CLAMP_TO_GROUND'}));
      decorateMapMarker(marker,kind);
      marker.position=ll(p);marker.label=label;
      if(marker.parentNode!==maps3d)maps3d.append(marker);
    });
    markers3d.slice(points.length).forEach(marker=>{marker.position=null;marker.label=null;marker.remove();});
    const c=selected(),roll=savedHole().roll||0;
    if(showRings && c && c.carry > 0)for(const [d,color] of [[c.carry,'#c5e78a'],...(roll?[[c.carry+roll,'#ffb766']]:[])]) {
      const circle=Array.from({length:73},(_,i)=>destination(origin(),d,i*5));
      addLine(line(circle,color,3));
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
      moveGoogleCamera({center:{...ll(p),altitude:0},altitudeMode:'RELATIVE_TO_GROUND',range:200,tilt:58,heading},window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:2800,revision);
    };
    animationHandler=next;maps3d.addEventListener('gmp-animationend',next);
    animationTimer=setTimeout(stopFlyover,30000);next();
  }
  window.addEventListener('course-downloads-change',downloadStatus);
  function resizePrepMap() {
    fitPrepMap();
    if(root && !liveDialog && mode==='route') {
      const svg=root.querySelector('#cp-route-map');
      if(svg)drawView();
    }
  }
  window.addEventListener('resize',resizePrepMap);
  window.visualViewport?.addEventListener('resize',resizePrepMap);
  document.fonts?.ready.then(fitPrepMap);
  window.addEventListener('offline',()=>{
    if(root&&(mode==='3d')){stopFlyover();mode='route';overview=false;redraw();}
    else if(root&&mode==='route')redraw();
    else if(root&&mode==='guide'&&packReady())redraw();
  });
  window.addEventListener('online',()=>{
    const note=root?.querySelector('.cp-map-view-note');
    if(note)note.textContent='Simple map · works offline';
  });
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden)downloadStatus();
    if(document.hidden && locationWatch!==null){stopLocation('Location paused while the app was away. Tap Use my location to resume.');updateMeasurements();}
  });
  window.addEventListener('pagehide',()=>stopLocation());
  window.CaddieCoursePrep = Object.freeze({
    init: options => {bridge=options;packs?.start();}, render, mount, unmount, teaser, resumeAfterReload, openGuide, openLiveMap,
    openNearest: () => selectCourse(nearbyCourses()[0].course.id),
    resumeLiveMap: () => openLiveMap(course.id,hole,mode),
    openHole: (n,courseId) => {if(courseId&&!selectCourse(courseId))return false;hole=course.holes.some(h=>h.n===+n)?+n:1;framed3d=null;mode=initialMode();imageError=false;overview=false;return true;},
    get courseName(){return course.name;}, get courseId(){return course.id;}, findCourse, clean, hasGuide,
    geo: Object.freeze({distance,destination,bearing,pointOK})
  });
})();
