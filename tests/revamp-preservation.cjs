#!/usr/bin/env node
'use strict';

// The v199 tree is the rollback point agreed before the redesign. Comparing the
// real importers against it protects information, not a particular page layout.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const root = path.join(__dirname, '..');
const BASELINE = '8934e202bfdb8d9fa61ede53428588ead65c04ee';
const LS_KEY = 'caddiehq_v1';
const feedFiles = [
  'coach-feed.json', 'front9-feed.json', 'path-feed.json',
  'corrections-20260922.json', 'range-20260922-feed.json',
  'futurefit-feed.json', 'range-20260925-feed.json',
  'bag-20261001-feed.json', 'range-20261001-feed.json',
  'round-20261001-feed.json',
];
const clone = value => JSON.parse(JSON.stringify(value));
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const baseline = name => execFileSync('git', ['show', `${BASELINE}:${name}`], {
  cwd: root, maxBuffer: 32 * 1024 * 1024,
});
const hash = data => createHash('sha256').update(data).digest('hex');

function firstDifference(a, b, at = 'state') {
  if (Object.is(a, b)) return null;
  if (a == null || b == null || typeof a !== 'object' || typeof b !== 'object') return at;
  if (Array.isArray(a) !== Array.isArray(b)) return at;
  const ak = Object.keys(a), bk = Object.keys(b);
  if (ak.length !== bk.length) return `${at} keys (${ak.length} vs ${bk.length})`;
  for (const key of ak) {
    if (!Object.hasOwn(b, key)) return `${at}.${key} missing`;
    const different = firstDifference(a[key], b[key], `${at}.${key}`);
    if (different) return different;
  }
  return null;
}
function sameState(actual, expected, label) {
  const difference = firstDifference(clone(actual), clone(expected));
  assert.equal(difference, null, `${label}: first changed field ${difference}`);
}

function makeHarness(source, existing) {
  const storage = existing ? { [LS_KEY]: JSON.stringify(existing) } : {};
  const dummy = {
    addEventListener() {}, removeEventListener() {}, querySelectorAll() { return []; },
    querySelector() { return this; }, setAttribute() {}, getAttribute() { return null; },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    style: {}, dataset: {},
  };
  // Fixed clock and deterministic identifiers make baseline/current diffs exact.
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : ['2026-10-02T23:48:00.000Z'])); }
    static now() { return new Date('2026-10-02T23:48:00.000Z').valueOf(); }
  }
  let randomSeed = 31;
  const math = Object.create(Math);
  math.random = () => ((randomSeed = (randomSeed * 16807) % 2147483647) / 2147483647);
  const context = {
    console, Date: FixedDate, Math: math,
    setTimeout() {}, clearTimeout() {}, setInterval() {}, clearInterval() {},
    document: {
      addEventListener() {}, querySelector() { return dummy; },
      querySelectorAll() { return []; }, getElementById() { return dummy; },
      body: dummy, documentElement: dummy,
    },
    navigator: {}, localStorage: {
      getItem: key => storage[key] || null,
      setItem: (key, value) => { storage[key] = String(value); },
      removeItem: key => { delete storage[key]; },
    },
    window: {
      addEventListener() {}, dispatchEvent() {},
      matchMedia: () => ({ matches: false, addEventListener() {} }),
      CaddieReview: require('../round-review.js'),
      CaddieBayTakeaways: require('../bay-takeaways.js'),
      CaddieTakeaways: require('../round-takeaways.js'),
    },
  };
  vm.createContext(context);
  for (const name of ['lessons.js', 'courses-db.js', 'course-cards.js']) {
    vm.runInContext(read(name), context, { filename: name });
  }
  const boot = source.indexOf('// ---------- Boot ----------');
  assert.ok(boot > 0, 'real application boot marker remains available');
  vm.runInContext(source.slice(0, boot) + `
    rerender=()=>{};toast=()=>{};load();save();
    window.preservationTest={get:()=>S,save,applyFeed,allDayRows,bayDayData,
      analysisClubs,analysisDelivery,roundDiff,realRounds,numbersCatalog,
      lessons,searchIndex,generateSimPracticePlan,SEG_OF,ACTIONS,
      bayView,roundView,clubHistoryView,sessionLibrary};
  })();`, context, { filename: 'app.js' });
  return { api: context.window.preservationTest, storage, context };
}

function importAll(harness) {
  for (const name of feedFiles) harness.api.applyFeed(JSON.parse(read(name)));
  return clone(harness.api.get());
}
function baselineState() {
  return importAll(makeHarness(baseline('app.js').toString()));
}

// A personalized existing install deliberately contains zeroes, nulls, decimals,
// unicode notes, local identity overrides, a live round and unknown future data.
function personalizedState(input) {
  const state = clone(input);
  state.profile.handicap = 10.7;
  state.profile.privateNote = 'Keep my goal: calm on 18 ⛳';
  state.carriesCalibrated = true;
  state.carries.find(c => c.club === '5 wood').carry = 207.3;
  state.clubs.push({ id: 'local-bench-7w', name: 'Personal 7-wood', status: 'backup', cat: 'wood', note: 'Never replace this locally added club.' });
  state.bagHistory.push({ date: '2026-10-02', text: 'Personal equipment note' });
  state.courses.push({ id: 'local-course', name: 'My local course', st: 'CT', notes: 'First tee marker moved', rating: 4.5, pr: 76, bucket: false });
  state.rounds.push({
    id: 'local-live-card', live: true, date: '2026-10-02', course: 'My local course',
    score: 40, par: 36, nine: 'F', putts: 15, note: 'Kept my rhythm',
    holes: Array.from({ length: 9 }, (_, i) => ({ n: i + 1, par: 4, s: i < 4 ? 5 : 4,
      p: i < 6 ? 2 : 1, fw: i % 2 ? 'R' : 'Y', gir: i % 2 === 0,
      note: i === 8 ? 'No numbers or words lost here' : '' })),
    troubles: ['approach'],
  });
  state.live = {
    date: '2026-10-02', course: 'My local course', nine: 'F', cur: 0,
    stage: 'play', cardOK: true, tees: 'Blue', rating: null, slope: null,
    troubles: [], note: 'In progress — preserve every tap',
    holes: Array.from({ length: 9 }, (_, i) => ({ n: i + 1, par: 4, si: i + 1,
      parFrom: 'mine', s: i === 0 ? 4 : null, ...(i === 0 ? { p: 2, note: 'Hit 5W', fw: 'Y', gir: true } : {}) })),
  };
  state.tests.push({ date: '2026-10-02', putter: 'My putter', makes: 0, note: 'A zero is a result' });
  state.drillDays.push('2026-10-02');
  state.drillLog.push({ id: 'local-drill', date: '2026-10-02', v: '7/10' });
  state.fiveFt.push({ date: '2026-10-02', results: Array(20).fill('make') });
  state.mental.push({ id: 'local-debrief', date: '2026-10-02', focus: 4, note: 'Breathe before the putt', next: 'Commit to the line', triggers: [], when: [] });
  state.lessonsRead.push('local-read-marker');
  state.planCalls = { ...state.planCalls, 'local-plan': { 1: { club: ['5W'], ts: '2026-10-02' } } };
  state.reviewClubOverrides = { ...state.reviewClubOverrides, 'round-tm-20261001-v1:h5-s1': { actualClub: '4-hybrid', intent: 'full' } };
  state.reviewTests = [{ testId: 'local-test', date: '2026-10-02', a: 0, b: 10, conditions: 'Known zero outcome' }];
  state.settings.seenBuild = 'v199';
  state.settings.theme = 'night';
  state.weather = null;
  state.here = null;
  state.futureCustomData = { nested: [{ zero: 0, missing: null, precise: 1.4597, note: 'único < & >' }] };
  return state;
}

function run() {
  const files = execFileSync('git', ['ls-tree', '-r', '--name-only', BASELINE], { cwd: root, encoding: 'utf8' })
    .trim().split('\n').filter(name => name.startsWith('data/') || feedFiles.includes(name) ||
      ['lessons.js', 'course-cards.js', 'courses-db.js', 'bay-takeaways.js', 'round-takeaways.js', 'round-review.js', 'futurefit33-rh.jpg'].includes(name));
  for (const name of files) {
    assert.ok(fs.existsSync(path.join(root, name)), `Source archive still exists: ${name}`);
    assert.equal(hash(fs.readFileSync(path.join(root, name))), hash(baseline(name)), `v199 source archive unchanged: ${name}`);
  }

  const old = makeHarness(baseline('app.js').toString());
  const current = makeHarness(read('app.js'));
  const expected = importAll(old), actual = importAll(current);
  // The only fresh-install difference allowed here is release read receipts.
  // Those are presentation metadata; all source and personal data must match.
  for (const state of [actual, expected]) {
    state.settings.seenUpdates = state.settings.seenUpdates.filter(id => !String(id).startsWith('build:'));
  }
  sameState(actual, expected, 'fresh install is identical to v199');
  const stable = clone(current.api.get());
  importAll(current);
  sameState(current.api.get(), stable, 'all feeds remain idempotent');

  const custom = personalizedState(expected);
  const upgraded = makeHarness(read('app.js'), custom);
  sameState(upgraded.api.get(), custom, 'upgrade preserves complete localStorage state');
  importAll(upgraded);
  sameState(upgraded.api.get(), custom, 'refresh preserves every personalized field');
  sameState(JSON.parse(upgraded.storage[LS_KEY]), custom, 'persisted backup contains the full record');

  const T = current.api, S = T.get();
  sameState(T.allDayRows(), old.api.allDayRows(), 'daily entries keep their original source indices');
  sameState(T.numbersCatalog(S), old.api.numbersCatalog(old.api.get()), 'every indexed number and provenance is retained');
  sameState(T.lessons(), old.api.lessons(), 'every lesson, edit and insight is retained');
  sameState(T.generateSimPracticePlan(), old.api.generateSimPracticePlan(), 'practice priorities still use the same golf evidence');
  sameState(T.SEG_OF, old.api.SEG_OF, 'saved legacy route aliases stay valid');
  const oldActions = Object.keys(old.api.ACTIONS);
  for (const action of oldActions) assert.equal(typeof T.ACTIONS[action], 'function', `legacy action ${action} is available`);

  const october = T.allDayRows().filter(row => row.kind === 'range' && row.date === '2026-10-01');
  assert.equal(october.length, 1, 'one October 1 range day');
  assert.match(october[0].sub, /146 usable shots · 13 clubs · 3 source sessions/);
  const bay = S.bays[october[0].i];
  const day = T.bayDayData(bay);
  assert.equal(day.raw, 162); assert.equal(day.usable, 146); assert.equal(day.held, 16);
  for (const row of T.allDayRows()) {
    if (row.action === 'open-bay') assert.equal(S.bays[row.i].date, row.date, 'bay index stays a source-array index');
    if (row.action === 'open-round') assert.equal(S.rounds[row.i].date, row.date, 'round index stays a source-array index');
    if (row.action === 'open-session') assert.equal(S.sessions[row.i].date, row.date, 'film index stays a source-array index');
  }
  const granite = S.rounds.find(round => round.feedId === 'round-tm-20261001-v1');
  assert.ok(granite.sim); assert.equal(granite.score, 80); assert.equal(granite.review.shots.length, 51);
  assert.equal(T.roundDiff(granite), null, 'indoor round never changes outdoor handicap');
  assert.ok(!T.realRounds().some(round => round.feedId === granite.feedId));
  for (const source of S.bays.filter(item => item.date === '2026-10-01')) {
    const markup = T.bayView('source:' + S.bays.indexOf(source));
    assert.doesNotMatch(markup, /Full-day range review|146 usable shots/, 'source route opens only its original capture');
  }

  console.log(`PASS v199 preservation: ${files.length} byte-identical source/archive files; full fresh-install and personalized upgrade parity; ${S.feedApplied.length} applied entries; ${S.bays.length} bays, ${S.rounds.length} rounds, ${S.sessions.length} films, ${T.lessons().length} lessons; original indices/routes/actions; 146-shot day and separate Granite round.`);
}

module.exports = { BASELINE, LS_KEY, feedFiles, baselineState, personalizedState, makeHarness, importAll, sameState };
if (require.main === module) run();
