#!/usr/bin/env node
'use strict';
const fs = require('fs');
const src = fs.readFileSync(require('path').join(__dirname, '..', 'app.js'), 'utf8');
const must = [
  "const BUILD = 'v117'",
  "function provBadge(kind)",
  "function numbersCatalog(state)",
  "function searchIndex(state)",
  "function timeline()",
  "data-view=\"numbers\"",
  "Consistency is NOT standard deviation",
  "Try ‘5-wood’, ‘combine’, ‘handicap’",
];
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
console.log('findability static checks ok');
