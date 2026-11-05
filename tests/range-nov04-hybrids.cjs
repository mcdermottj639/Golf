const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const feed = require('../range-20261104-feed.json');
const source = require('../data/range-2026-11-04-hybrids.json');

const ids = feed.entries.map(e => e.id);
assert.equal(new Set(ids).size, ids.length, 'apply-once ids must be unique');
assert.deepEqual(feed.entries.map(e => e.type), ['bay', 'bay', 'carry-update', 'carry-update', 'history', 'carry-update', 'carry-update', 'history', 'bay', 'club-update', 'carry-update', 'carry-update', 'history', 'bay-update', 'bay-update', 'bay-update', 'carry-update', 'carry-update', 'carry-update', 'club-update', 'history', 'bay-update', 'bay-update', 'bay-update', 'carry-update', 'club-update', 'history', 'bay-update', 'club-update', 'history', 'bay', 'club-update', 'history']);

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
const offers = feed.entries.filter(e => e.type === 'carry-update' && e.club.meas && !e.id.startsWith('carry-offdeck-'));
const live = feed.entries.filter(e => e.type === 'carry-update' && !e.club.meas && 'carry' in e.club);
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

// v281: off the deck. Labels only — no live carry moves, every bay says so.
const deckBays = feed.entries.filter(e => e.type === 'bay-update' && e.id.startsWith('bay-offdeck-'));
assert.equal(deckBays.length, 3);
for (const e of deckBays) { assert.ok(e.bay.setup.endsWith('· off the deck')); assert.ok(e.bay.detail.limits.startsWith('Hit off the deck')); assert.ok(feed.entries.some(b => b.id === e.target)); }
const deckRows = feed.entries.filter(e => e.id.startsWith('carry-offdeck-'));
assert.deepEqual(deckRows.map(e => e.target), ['3-hybrid', '4-hybrid', 'Mini Driver']);
for (const e of deckRows) { assert.ok(!('carry' in e.club), 'off-deck label never sets a live carry'); assert.ok(e.club.meas.how.startsWith('off the deck')); }
console.log('off-deck labels ok');

// v282: Sep 14 / Sep 15 mini groups (TrackMan "3w") relabelled to the mini; loft 13.5°.
const lab = feed.entries.filter(e => e.id.startsWith('bay-minilabel-'));
assert.deepEqual(lab.map(e => e.target), ['bay-20260914-gl18-map-my-bag', 'bay-20260915-range-54']);
for (const e of lab) { const js = JSON.stringify(e.bay.detail); assert.ok(!js.includes('3w · TrackMan label')); assert.ok(js.includes('Mini Driver · TrackMan 3w label · 15.5°')); }
const c14 = lab[0].bay.detail.clubs.find(c => c.club.startsWith('Mini')); assert.equal(c14.carry, 182.4);
assert.equal(lab[0].bay.detail.clubs.length, 13); assert.equal(lab[1].bay.detail.rangeShots.length, 6);
assert.equal(feed.entries.find(e => e.id === 'carry-minidriver-loft-20261104-v1').club.loft, '13.5°');
assert.ok(!('carry' in feed.entries.find(e => e.id === 'carry-minidriver-loft-20261104-v1').club));
console.log('mini history relabel ok');

// v283: Sep 15 mini table from Jack's recordings — header averages, alignment, same Nov 4 rule.
const sep = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data/range-2026-09-15-mini.json'), 'utf8'));
const avgOf = k => { const v = sep.shots.map(s => s[k]).filter(x => x != null); return v.reduce((a, b) => a + b, 0) / v.length; };
for (const [k, h] of Object.entries(sep.appHeader)) assert.ok(Math.abs(avgOf(k) - h) <= (k === 'spin' ? 1 : k === 'apex' ? 0.5 : 0.051), `sep15 ${k} re-averages to the header`);
const g15 = feed.entries.find(e => e.id === 'bay-minishots-20260915-20261104-v1').bay.detail.rangeShots.find(g => g.club.startsWith('Mini'));
assert.equal(g15.shots.length, 10); assert.deepEqual(g15.excludedShotNumbers, [3, 4, 6, 8, 9, 10]);
const k15 = g15.shots.filter(s => !s.mishit); assert.equal(+(k15.reduce((a, s) => a + s.carry, 0) / k15.length).toFixed(1), 173.5);
console.log('sep15 mini table ok');

// v284: second Sep 15 mini table — 7 rows, header averages, Nov 4 rule.
const sepB = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data/range-2026-09-15-mini-b.json'), 'utf8'));
for (const [k, h] of Object.entries(sepB.appHeader)) { const v = sepB.shots.map(s => s[k]); const m = v.reduce((a, b) => a + b, 0) / v.length; assert.ok(Math.abs(m - h) <= (k === 'spin' ? 1 : k === 'height' ? 0.5 : 0.1), `sep15b ${k}`); }
for (const s of sepB.shots) { assert.ok(Math.abs(s.face - s.path - s.ftp) <= 0.11); assert.ok(Math.abs(s.bs / s.cs - s.smash) < 0.015); }
const bB = feed.entries.find(e => e.id === 'bay-20260915-mini-b-v1').bay;
assert.equal(bB.date, '2026-09-15'); assert.deepEqual(bB.detail.rangeShots[0].excludedShotNumbers, [2, 5]);
assert.equal(+bB.detail.clubs[0].carry.toFixed(1), 179.9); assert.ok(bB.detail.rangeShots[0].club.startsWith('Mini Driver'));
console.log('sep15 second mini table ok');
