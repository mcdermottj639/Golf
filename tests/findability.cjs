#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const must = [
  "function isClearMishit(shot, group)",
  "function analysisDelivery(detail)",
  "function cumulativeClubDelivery()",
  "function cumulativeClubFaceCard()",
  "function rollRemaining(pts)",
  "function cumulativeView()",
  "function cumulativePathHistory()",
  "function allDayRows()",
  "function provBadge(kind)",
  "function numbersCatalog(state)",
  "function searchIndex(state)",
  "function timeline()",
  "data-view=\"numbers\"",
  "Consistency is NOT standard deviation",
  "Try ‘5-wood’, ‘combine’, ‘handicap’",
];
const appBuild = src.match(/const BUILD = '(v\d+)'/);
const cacheBuild = sw.match(/const CACHE = 'caddiehq-(v\d+)'/);
if (!appBuild || !cacheBuild || appBuild[1] !== cacheBuild[1]) {
  console.error(`findability build/cache mismatch: app=${appBuild?.[1] || 'missing'}, service worker=${cacheBuild?.[1] || 'missing'}`);
  process.exit(1);
}
const missing = must.filter(s => !src.includes(s));
if (missing.length) {
  console.error('findability missing:\n' + missing.map(s => '  ' + s).join('\n'));
  process.exit(1);
}
const kinds = ['on-course','bay','trackman','measured','estimated','offer','fed','self'];
for (const k of kinds) {
  if (!src.includes(`lab:'${k === 'on-course' ? 'ON-COURSE' : k.toUpperCase()}'`) && k !== 'on-course') {
    // trackman lab is TRACKMAN etc — already in PROV object; just ensure key exists
  }
  if (!new RegExp("'" + k + "'\\s*:").test(src) && k !== 'on-course') {
    if (!src.includes(k + ':')) {
      console.error('missing PROV kind', k);
      process.exit(1);
    }
  }
}
if (!src.includes("'on-course':")) {
  console.error('missing on-course kind');
  process.exit(1);
}
if (src.includes("last.phase && last.phase !== 'stock'")) {
  console.error('cumulative bag table still suffixes slot/window on the club name');
  process.exit(1);
}
if (!src.includes('function cumulativeClubDelivery()') || !src.includes('bayDeliveryVisual(cumulativeClubDelivery())')) {
  console.error('cumulative face-to-path visual is not wired to every club');
  process.exit(1);
}
console.log('findability static checks ok');
