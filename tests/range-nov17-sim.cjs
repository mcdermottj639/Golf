#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const feed=JSON.parse(fs.readFileSync(path.join(root,'range-20261117-feed.json'),'utf8'));
const bays=feed.entries.filter(e=>e.type==='bay');
assert.equal(bays.length,3);
assert.ok(!feed.entries.some(e=>/carry/.test(e.type)),'no carry changes');
const shots=bays.flatMap(e=>e.bay.detail.rangeShots.flatMap(r=>r.shots));
assert.equal(shots.length,110);
const clean=e=>e.bay.detail.rangeShots.flatMap(r=>r.shots).filter(s=>!s.mishit).length;
assert.deepEqual(bays.map(clean),[33,5,28]);
assert.ok(bays.every(e=>e.bay.date==='2026-11-17'&&e.bay.discipline==='swing'));
const b1=bays[0].bay.detail.clubs.find(c=>c.club==='6-iron');
assert.equal(Math.round(b1.carry*10)/10,139.5);
const app=fs.readFileSync(path.join(root,'app.js'),'utf8'),sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
assert.ok(app.includes("'range-20261117-feed.json'")&&sw.includes("./range-20261117-feed.json"));
console.log('range-nov17-sim: OK — 3 bays, 110 shots, clean 33/5/28');
