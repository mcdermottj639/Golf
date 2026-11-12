const assert = require('node:assert/strict');
const feed = require('../range-20261111-feed.json');
const source = require('../data/range-2026-11-11-sim.json');
const nov4 = require('../range-20261104-feed.json');

const ids = feed.entries.map(e => e.id);
assert.equal(new Set(ids).size, ids.length, 'apply-once ids must be unique');
for (const id of ids) assert.ok(!nov4.entries.some(e => e.id === id), `${id} must not reuse a Nov 4 id`);
assert.deepEqual(feed.entries.map(e => e.type), ['bay', 'bay', 'bay', 'carry-update', 'carry-update', 'carry-update', 'history']);
assert.deepEqual(source.sources.map(s => [s.club, s.shots.length]), [['Mini Driver', 15], ['3-hybrid', 26], ['4-hybrid', 6]]);

const cols = { cs: 'cs', aoa: 'aoa', path: 'path', face: 'face', ftp: 'ftp', bs: 'bs', la: 'la', ld: 'ld', spin: 'spin', carry: 'carry', total: 'total', height: 'apex', smashIndex: 'smashIndex' };
const bays = feed.entries.filter(e => e.type === 'bay');
for (const [i, src] of source.sources.entries()) {
  // Independent check: every column re-averages to the app's own Avg row (rounded as the app shows it).
  for (const [k, hk] of Object.entries(cols)) {
    const xs = src.shots.map(s => s[k]).filter(v => v != null);
    const mean = xs.reduce((n, v) => n + v, 0) / xs.length;
    const tol = (k === 'spin' || k === 'height' || k === 'smashIndex') ? 0.51 : 0.07;
    assert.ok(Math.abs(mean - src.appHeader[hk]) <= tol, `${src.club} ${k} rows re-average to the app header (${mean} vs ${src.appHeader[hk]})`);
  }
  for (const s of src.shots) {
    if (s.face != null && s.path != null && s.ftp != null) assert.ok(Math.abs(s.face - s.path - s.ftp) <= 0.11, `${src.club} #${s.shot} face/path/ftp alignment`);
    if (s.cs != null && s.bs != null) assert.ok(Math.abs(s.bs / s.cs - s.smash) < 0.006, `${src.club} #${s.shot} smash is ball ÷ club`);
  }
  const g = bays[i].bay.detail.rangeShots[0];
  assert.equal(g.shots.length, src.shots.length);
  const kept = g.shots.filter(s => !s.mishit);
  for (const s of kept) { assert.ok(s.cs != null && s.smash >= 1.40 && s.height >= 40, `${src.club} #${s.shot} kept row passes the Nov 4 rule`); }
  for (const s of g.shots.filter(s => s.mishit)) assert.ok(s.mishitReason, 'held rows say why');
  const c = bays[i].bay.detail.clubs[0];
  assert.equal(c.n, kept.length);
  assert.equal(c.held, g.excludedShotNumbers.length);
  assert.ok(Math.abs(c.carry - kept.reduce((n, s) => n + s.carry, 0) / kept.length) < 0.001);
  assert.equal(bays[i].bay.date, '2026-11-11');
  assert.match(bays[i].bay.setup, /off the deck/);
}
assert.deepEqual(bays.map(b => b.bay.detail.rangeShots[0].excludedShotNumbers), [
  [1, 2, 4, 9, 10, 12, 13, 15],
  [1, 2, 3, 4, 9, 10, 11, 14, 17, 19, 21, 22, 23, 24, 26],
  [4, 6],
]);
assert.deepEqual(bays.map(b => [b.bay.detail.clubs[0].n, Math.round(b.bay.detail.clubs[0].carry * 10) / 10]), [[7, 195.6], [11, 190.4], [4, 177.6]]);

// Offers only: no entry in this feed sets a live playing carry.
const cu = feed.entries.filter(e => e.type === 'carry-update');
assert.deepEqual(cu.map(e => e.target), ['Mini Driver', '3-hybrid', '4-hybrid']);
for (const e of cu) {
  assert.ok(!('carry' in e.club) && !e.force, `${e.id} must not touch the live carry`);
  assert.equal(e.club.meas.date, '2026-11-11');
  assert.match(e.club.meas.how, /off the deck/);
}
assert.deepEqual(cu.map(e => [e.club.meas.carry, e.club.meas.n]), [[195.6, 7], [190.4, 11], [177.6, 4]]);
console.log('range-nov11-sim ok');
