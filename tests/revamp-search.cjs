#!/usr/bin/env node
'use strict';

// Search should take Jack to the intended club, day or original source without
// confusing a digit in a yardage with a club label or making duplicate records.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeHarness, importAll, sameState } = require('./revamp-preservation.cjs');
const original = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const source = original.replace('// ---------- Boot ----------',
  'window.searchAcceptance={search:hqSearch,explore:hqExplore};\n// ---------- Boot ----------');
const harness = makeHarness(source);
const initial = importAll(harness);
const { search, explore } = harness.context.window.searchAcceptance;
const compact = rows => JSON.parse(JSON.stringify(rows.map(row => ({ label: row.label, act: row.act }))));

const woods = search('5W');
assert.ok(woods.length > 0);
assert.equal(woods[0].act.a, 'club-history');
assert.equal(woods[0].act.club, '5W', 'the whole-club record is first');
for (const alias of ['5-wood', '5 wood', '5w']) {
  assert.deepEqual(compact(search(alias)), compact(woods), `${alias} means the same club`);
}
assert.ok(woods.some(row => row.label === '5 wood bay offer'));
assert.ok(!woods.some(row => row.label === '3 wood bay offer'), '5 in another yardage is not a 5-wood match');

for (const alias of ['4H', '4-hybrid', '4 hybrid']) {
  const rows = search(alias);
  assert.equal(rows[0].act.a, 'club-history');
  assert.equal(rows[0].act.club, '4H');
  assert.ok(rows.some(row => row.label.includes('PING G440')), 'current hybrid remains findable');
}

const date = '2026-10-01';
const dayRows = search(date);
assert.equal(dayRows.length, 5, 'one round, one full range day and three original range sources');
for (const row of dayRows) {
  const collection = row.act.a === 'open-round' ? initial.rounds : initial.bays;
  assert.equal(collection[row.act.i]?.date, date, 'date searches use the date on the record');
}
assert.ok(dayRows.some(row => row.act.a === 'open-bay'), 'full-day review remains distinct');
assert.equal(dayRows.filter(row => row.act.a === 'open-bay-source').length, 3);

const graniteIndex = initial.rounds.findIndex(round => round.feedId === 'round-tm-20261001-v1');
assert.equal(search('Granite').filter(row => row.act.a === 'open-round' && row.act.i === graniteIndex).length, 1,
  'the same round appears once with its date');
const map = search('Map My Bag').find(row => row.act.a === 'open-bay-source' && initial.bays[row.act.i]?.date === date);
assert.ok(map, 'a named original capture opens the original source, not the combined day');
assert.match(map.description, /original source/);

const handicap = search('handicap').find(row => row.label === 'Handicap');
assert.equal(handicap.act.a, 'open-number');
assert.equal(handicap.act.metric, 'handicap');
assert.equal(handicap.act.view, 'home');
const planner = explore().find(row => row.label === 'Practice planner');
assert.equal(planner.act.target, 'sim-practice');
const library = explore().find(row => row.label === 'Coaching library');
assert.equal(library.act.target, 'coach-library');
assert.equal(search('not-a-real-record-unique-9471551').length, 0);
assert.ok(search('film').every(row => row.label.length <= 130), 'long source paragraphs are concise menu titles');
sameState(harness.api.get(), initial, 'search and menu traversal do not change golf data');
console.log('PASS Explorer search: club aliases, numeric boundaries, date membership, unique rounds, original sources, section destinations and unchanged state.');
