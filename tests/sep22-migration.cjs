// Exercise Sep 22 bay corrections through the real applyFeed() importer. This models a
// phone that has already applied v147's primary row and v151's separate VG3 row.
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const dummy = { addEventListener(){}, querySelectorAll(){return []}, classList:{add(){},remove(){},toggle(){}}, style:{}, dataset:{} };
function harness() {
  const storage = {};
  const ctx = {
    console, setTimeout(){}, clearTimeout(){}, setInterval(){},
    document:{addEventListener(){},querySelector(){return dummy},querySelectorAll(){return []},getElementById(){return dummy},body:dummy},
    navigator:{}, localStorage:{getItem:k=>storage[k]||null,setItem:(k,v)=>storage[k]=v},
    window:{addEventListener(){},matchMedia:()=>({matches:false,addEventListener(){}})},
  };
  vm.createContext(ctx);
  for (const f of ['lessons.js','courses-db.js','course-cards.js'])
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx);
  let src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  src = src.slice(0, src.indexOf('// ---------- Boot ----------')) + `
    rerender=()=>{}; toast=()=>{}; load();
    window.migrationTest={applyFeed,get:()=>S};
  })();`;
  vm.runInContext(src, ctx);
  return ctx.window.migrationTest;
}

const feed = JSON.parse(fs.readFileSync(path.join(root, 'coach-feed.json'), 'utf8'));
feed.entries.push(...JSON.parse(fs.readFileSync(path.join(root,'corrections-20260922.json'),'utf8')).entries);
const primaryId = 'bay-20260922-range-8i-5i';
const vg3Id = 'bay-20260922-range-5i-vg3';
const correctionId = 'bay-source-correction-20260922-v1';
const removeId = 'bay-source-remove-20260922-vg3-v1';
const correction = feed.entries.find(e => e.id === correctionId);
const removal = feed.entries.find(e => e.id === removeId);
assert.ok(correction, `missing ${correctionId}`);
assert.equal(correction.type, 'bay-update');
assert.equal(correction.target, primaryId);
assert.ok(correction.bay && correction.bay.detail, 'correction must replace complete detail payload');
assert.equal(removal && removal.type, 'bay-remove');
assert.equal(removal && removal.target, vg3Id);

const finalEntries = feed.entries.filter(e => e.id === primaryId || e.id === vg3Id || e.id === correctionId || e.id === removeId);
assert.ok(finalEntries.some(e => e.id === primaryId && e.type === 'bay'), 'full feed must still seed the primary for fresh installs');

function assertCorrected(state) {
  const primary = state.bays.filter(b => b._fid === primaryId);
  assert.equal(primary.length, 1, 'exactly one primary session remains');
  assert.equal(state.bays.some(b => b._fid === vg3Id), false, 'retired VG3 session is removed');
  const detail = primary[0].detail;
  const shots = detail.rangeShots || [];
  const five = shots.find(c => c.club === '5-iron');
  const seven = shots.find(c => c.club === '7-iron');
  assert.ok(five && seven, 'corrected source contains both 5-iron and 7-iron shots');
  assert.equal(five.shots.length, 17);
  assert.equal(seven.shots.length, 16);
  assert.equal(shots.reduce((n, c) => n + c.shots.length, 0), 33);
}

// Existing installation: both old feed ids were consumed, so only new correction ids can
// alter the stored records. Include user-owned unrelated state to guard against broad reset.
const existing = harness();
const oldPrimary = { _fid:primaryId, date:'2026-09-22', setup:'legacy primary', detail:{gist:'old 9-shot 5i',rangeShots:[{club:'5-iron',shots:Array(9).fill({carry:123.2})}]} };
const oldVg3 = { _fid:vg3Id, date:'2026-09-22', setup:'legacy VG3', detail:{gist:'old separate table'} };
const unrelated = { _fid:'user-bay', date:'2026-09-20', setup:'user data', detail:{gist:'keep'} };
existing.get().bays.push(oldPrimary, oldVg3, unrelated);
existing.get().feedApplied.push(primaryId, vg3Id);
existing.applyFeed({ entries:feed.entries.filter(e => e.id === correctionId || e.id === removeId) });
existing.applyFeed({ entries:feed.entries.filter(e => e.id === correctionId || e.id === removeId) });
assertCorrected(existing.get());
assert.equal(existing.get().bays.find(b => b._fid === 'user-bay').detail.gist, 'keep');
assert.equal(existing.get().feedApplied.filter(id => id === correctionId).length, 1);
assert.equal(existing.get().feedApplied.filter(id => id === removeId).length, 1);

// Fresh install: the primary bay add followed by its update must produce the same capture.
const fresh = harness();
fresh.applyFeed(feed);
fresh.applyFeed(feed);
assertCorrected(fresh.get());
assert.equal(fresh.get().bays.filter(b => b._fid === primaryId).length, 1);
assert.equal(fresh.get().bays.some(b => b._fid === vg3Id), false);

const project = b => ({
  date:b.date, setup:b.setup, venue:b.venue, mode:b.mode, ball:b.ball,
  gist:b.detail.gist, caption:b.detail.rangeCaption,
  clubs:(b.detail.rangeShots||[]).map(c => ({club:c.club, shots:c.shots.length})),
});
assert.deepEqual(project(fresh.get().bays.find(b => b._fid === primaryId)), project(existing.get().bays.find(b => b._fid === primaryId)));
console.log('PASS Sep 22 migration: existing and fresh installs converge; corrections are idempotent and preserve unrelated/user bay data.');

const delayed=harness();
delayed.applyFeed({entries:[correction]});
assert.ok(!delayed.get().feedApplied.includes(correctionId),'missing base must leave correction retryable');
delayed.applyFeed(feed);
assertCorrected(delayed.get());
