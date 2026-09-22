const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const R = require('../round-review.js');
const entry = require('../data/hazeltine-imported.json');
const feed = JSON.parse(fs.readFileSync(path.join(__dirname, '../coach-feed.json'), 'utf8'));
const r = entry.round;

assert.equal(r.sim, true);
assert.equal(r.course, 'Hazeltine National');
assert.equal(r.score, 80);
assert.equal(r.par, 72);
assert.equal(r.holes.length, 9);
assert.equal(r.holes.reduce((a, h) => a + h.s, 0), 40);
assert.equal(r.holes[0].n, 10);
assert.equal(r.holes[8].n, 18);
assert.equal(r.putts, undefined);
assert.ok(/import day/.test(r.note));
assert.ok(/not invented/.test(r.note));
assert.equal(r.review, undefined);
assert.equal(R.render(r, { rounds: [r], bays: [] }), '');
assert.equal(feed.entries.filter(e => e.id === entry.id).length, 1);
assert.deepEqual(feed.entries.find(e => e.id === entry.id), entry);

console.log('PASS: Hazeltine 80 recap parked, back nine only, no invented front nine, sim-quarantined.');
