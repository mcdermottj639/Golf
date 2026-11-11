# Caddie HQ — research-based UX continuation

November 11, 2026. v290 built on the latest verified `main` 310024cc
(v289 source geometry). This is a UI-only release, not golf model, bag, round or
course geometry authority.

## Research and coordination

- Shared research and procedure: https://github.com/mcdermottj639/Ebay/blob/main/UX_REVIEW.md
- Portfolio preservation reference: https://github.com/mcdermottj639/portfolio-dashboard/blob/main/UX_REVIEW.md
- Claudex: https://docs.google.com/document/d/1oyJS2uyoBF8-TET3fLxU-hvlke9U805GXNhFjMb4k8Q/edit
- Caddie handoff: https://docs.google.com/document/d/10TzWts8Im5hGWAcYKpHSUhuiOwJYrUii2g2TLiZtShc/edit
- Jarvis handoff: https://docs.google.com/document/d/1rS1uTgGb3GvaiADqUaqbKajcztb29WMJUzDlM1Qii-E/edit

The installed Improve App UI & UX skill was not available in this session;
the linked research and continuation guide supplied the working requirements.
Do not copy the visual identity of other apps.

## Implemented scope

- `app.js` adds a compact five-step **Courses → Prep → Hole guide → Score →
  Recap** navigation rail only on the relevant screens. Existing menu,
  course browser, maps, hole guides, full scoring and recap remain available.
  The rail stays off the active live-score tap surface. Recap uses the most
  recently dated recorded round; when none exists, it is disabled rather than
  displaying an invented result. Scoring is not automatically started.
- Browser Back/Forward records whitelisted **UI view and subview only** in
  same-URL history state. Refresh restores that view. Existing Caddie in-page
  trail still provides a fallback. No account, coordinate, course name or golf
  record is placed in the URL.
- Rounds tab remembers Cards / Prep / Courses in a UI-only preference.
  `course-prep.js` saves only selected course ID, hole and presentation mode
  to **sessionStorage**; validates before restoring and degrades to the
  offline route when Google imagery is unavailable. The separate one-time
  live-map reload path continues to take priority.
- The Score journey step only pre-fills the *new-round setup* with the chosen
  course; it does **not** create/start/finish/edit a round. It will not alter
  an active saved round.
- `ux-journey.css` and `index.html`: small 44px hit targets, compact
  responsive 320/390/wider layout, dark/light styles, visible keyboard focus.
  `sw.js`: version/cache synced to v290 and stylesheet cached offline.

## Preserved boundaries

No edits to the course catalog or GPS coordinates, supported/par/yardage
authority, user-owned bag or calibrated carry data, live-round mutations,
round analysis, maps/scene/Links engine, course packs, feed imports, service
worker external-image handling, or location consent. Never infer missing
hole maps. Existing `S` local golf state and storage keys are unchanged.
Open Links PR #96 and its SKIP decision are out of scope.

## Verification

- `tests/ux-journey.cjs`: read-only/fixture contract of five steps,
  latest-recap selection, route privacy, live-play obstruction guard, course
  preference privacy and offline shell inclusion.
- `tests/ux-journey-browser.cjs`: isolated local browser storage at
  320, 390, 1280px; light/night, source-backed guide, hole selection,
  Back/Forward, reload, expanded offline controls, offline shell smoke.
  Never use actual owner round data or score-writing actions.
- `.github/workflows/ux-journey.yml`: Node 22 preservation suites plus
  Playwright Chromium with screenshots retained as CI artifacts.
- PR, CI, publish and served-site evidence are tracked in the Caddie handoff;
  do **not** equate test code or successful GitHub file commits with a passed
  test, completed deployment or physical-device check.
- Remaining: actual iPhone/Steam Deck usability and native installed-PWA
  location/map behavior require physical devices. Quail Village's source gaps
  (holes 14–18) remain explicitly unfilled; external Google imagery requires
  network and authorization.

## Next app

Jarvis last: needs attention → evidence → complete/dismiss/revisit. Preserve
permissions, confirmation, stable alert IDs and source timestamps; do not make
it a reasoning engine (Claude Duet is the reasoning/analysis recipient).
Verify own current main/artifact and active handoff before edits and preserve
newer work. After completing Jarvis, report cross-app completion and remaining
Card Vault / Portfolio / physical-device dependencies, not another app prompt.
