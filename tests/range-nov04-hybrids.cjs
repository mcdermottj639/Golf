const assert = require('node:assert/strict');
const feed = require('../range-20261104-feed.json');
const source = require('../data/range-2026-11-04-hybrids.json');

const ids = feed.entries.map(e => e.id);
assert.equal(new Set(ids).size, ids.length, 'apply-once ids must be unique');
assert.deepEqual(feed.entries.map(e => e.type), ['bay', 'bay', 'carry-update', 'carry-update', 'history', 'carry-update', 'carry-update', 'history', 'bay', 'club-update', 'carry-update', 'carry-update', 'history']);

const mains = source.sources.filter(s => s.role === 'main');
assert.deepEqual(mains.map(s => [s.club, s.shots.length]), [['3-hybrid', 32], ['4-hybrid', 12]]);
// Warm-up recordings stay in the source record only (Jack, Nov 4).
const bayShots = feed.entries.filter(e => e.type === 'bay').flatMap(e => e.bay.detail.rangeShots.flatMap(g => g.shots.map(s => s.videoSource.file)));
for (const w of source.sources.filter(s => s.role === 'warm-up')) assert.ok(!bayShots.includes(w.file), 'warm-up not imported');

for (const [i, src] of mains.entries()) {
  // Independent check against the app's own header average.
  const mean = src.shots.reduce((n, s) => n + s.carry, 0) / src.shots.length;
  assert.ok(Math.abs(mean - src.appHeader.carry) < 0.05, `${src.club} carry rows re-average to the app header`);
  for (const s of src.shots) {
    if (s.face != null && s.path != null && s.ftp != null) assert.ok(Math.abs(s.face - s.path - s.ftp) <= 0.11, `${src.club} #${s.shot} face/path/ftp alignment`);
    if (s.cs != null && s.bs != null && s.smash != null) assert.ok(Math.abs(s.bs / s.cs - s.smash) < 0.015, `${src.club} #${s.shot} speed/smash alignment`);
  }
  const bay = feed.entries.filter(e => e.type === 'bay')[i];
  const g = bay.bay.detail.rangeShots[0];
  assert.equal(g.shots.length, src.shots.length);
  const kept = g.shots.filter(s => !s.mishit);
  for (const s of kept) {
    if (s.smash != null) assert.ok(s.smash >= 1.40);
    assert.ok(s.height >= 40);
  }
  const c = bay.bay.detail.clubs[0];
  assert.equal(c.n, kept.length);
  assert.equal(c.held, g.excludedShotNumbers.length);
  assert.ok(Math.abs(c.carry - kept.reduce((n, s) => n + s.carry, 0) / kept.length) < 0.001);
}

const [h3, h4] = feed.entries.filter(e => e.type === 'bay').map(e => e.bay.detail.rangeShots[0]);
// v280 mini driver (TrackMan label '3 Wood'): same Jack rule, same column checks.
const miniSrc = source.sources.find(s => s.role === 'mini');
assert.equal(miniSrc.shots.length, 8);
for (const s of miniSrc.shots) {
  assert.ok(Math.abs(s.face - s.path - s.ftp) <= 0.11, `mini #${s.shot} face/path/ftp`);
  assert.ok(Math.abs(s.bs / s.cs - s.smash) < 0.015, `mini #${s.shot} speed/smash`);
}
const miniBay = feed.entries.find(e => e.id === 'bay-20261104-mini-v1');
assert.deepEqual(miniBay.bay.detail.rangeShots[0].excludedShotNumbers, [1, 2]);
assert.equal(miniBay.bay.detail.clubs[0].n, 6);
assert.equal(feed.entries.find(e => e.id === 'club-minidriver-back-20261104-v1').club.status, 'gaming');
assert.equal(feed.entries.find(e => e.id === 'carry-live-minidriver-20261104-v1').club.carry, 201);
assert.deepEqual(h3.excludedShotNumbers, [1, 2, 5, 6, 7, 9, 11, 12, 15, 18, 19, 20, 21, 22, 23, 24]);
assert.deepEqual(h4.excludedShotNumbers, [1, 2, 4, 5, 9, 12]);

// v278 entries park offers only; v279 entries (Jack's instruction) set the live carry to exactly the offer.
const offers = feed.entries.filter(e => e.type === 'carry-update' && e.club.meas);
const live = feed.entries.filter(e => e.type === 'carry-update' && !e.club.meas);
assert.equal(offers.length, 3); assert.equal(live.length, 3);
for (const e of live) {
  const o = offers.find(x => x.target === e.target);
  assert.ok(o, 'live carry has a matching offer');
  assert.ok(Number.isInteger(e.club.carry) && Math.abs(e.club.carry - o.club.meas.carry) <= 0.5, `${e.target} live carry is its measured offer in whole yards`);
  assert.ok(!('meas' in e.club), 'live patch leaves meas provenance alone');
}
assert.deepEqual(live.map(e => [e.target, e.club.carry]), [['3-hybrid', 187], ['4-hybrid', 178], ['Mini Driver', 201]]);
for (const e of offers) {
  assert.ok(!('carry' in e.club) || e.club.carry === null, 'offer never sets a live carry');
  assert.ok(e.club.meas && e.club.meas.carry > 0 && e.club.meas.n > 0);
}
console.log('PASS Nov4 hybrids: 44 rows, header averages, column alignment, Jack-rule exclusions, offers + live carries (v279), warm-ups held back.');
