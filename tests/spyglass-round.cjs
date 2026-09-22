const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const R = require('../round-review.js');
const entry = require('../data/spyglass-2026-09-15.json');
const feed = JSON.parse(fs.readFileSync(path.join(__dirname, '../coach-feed.json'), 'utf8'));
const r = entry.round;

assert.equal(r.sim, true);
assert.equal(r.course, 'Spyglass Hill');
assert.equal(r.date, '2026-09-15');
assert.equal(r.score, 85);
assert.equal(r.par, 72);
assert.equal(r.holes.length, 18);
assert.equal(r.holes.reduce((a, h) => a + h.s, 0), 85);
assert.equal(r.holes.reduce((a, h) => a + h.par, 0), 72);
assert.equal(r.holes.reduce((a, h) => a + h.putts, 0), 29);
assert.equal(r.putts, 29);
assert.equal(r.review.trackman.putts, 28);
assert.equal(r.review.shots.length, 56);
assert.equal(new Set(r.review.shots.map(s => s.id)).size, 56);
assert.equal(new Set(r.review.shots.map(s => s.hole)).size, 18);
assert.equal(r.holes.filter(h => h.par !== 3).length, 14);
assert.equal(r.holes.filter(h => h.fw === true).length, 7);
assert.equal(r.review.trackman.fairways[0], 8);
assert.equal(r.holes.filter(h => h.gir).length, 1);
assert.equal(r.holes.find(h => h.n === 1).gir, true);
assert.equal(r.holes.find(h => h.n === 18).fw, true);
assert.equal(r.holes.find(h => h.n === 18).tee, '3-wood');

const h1a = r.review.shots.find(s => s.id === 'h1-a');
assert.equal(h1a.loft, 9.4);
assert.equal(h1a.smash, 1.47);
assert.equal(h1a.carry, 189.4);

const h5b = r.review.shots.find(s => s.id === 'h5-b');
assert.equal(h5b.carry, 14.8);
assert.equal(h5b.path, undefined);
assert.equal(h5b.smash, undefined);
assert.equal(h5b.loft, undefined);

assert.equal(feed.entries.filter(e => e.id === entry.id).length, 1);
assert.deepEqual(
  feed.entries.find(e => e.id === entry.id),
  entry,
);

const html = R.render(r, { rounds: [r], bays: [] });
assert.ok(html.includes('Spyglass') || html.includes('3-wood'));
assert.ok(html.includes('Bag this round'));
assert.ok(!html.includes('Mini Driver'));
assert.ok(!html.includes('average drive 217'));
assert.ok(html.includes('9.4') || html.includes('189.4'));
assert.equal(R.profiles(r, []).length, 6);
assert.equal(R.profiles(r, []).every(p => p.bay === undefined), true);

const bays = feed.entries.filter(e => e.type === 'bay').map(e => ({ ...e.bay, _fid: e.id }));
assert.equal(R.profiles(r, bays).every(p => p.bay === undefined), true);

assert.equal(R.render({ sim: false, review: r.review }, {}), '');
const unsafe = structuredClone(r);
unsafe.review.shots[0].source = '<script>alert(1)</script>';
assert.ok(!R.render(unsafe, { rounds: [], bays: [] }).includes('<script>'));

console.log('PASS: Spyglass 85, 56 shots, sim-quarantined, dyn loft stored, no bay mix, feed integrity.');
