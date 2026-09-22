import fs from "node:fs";

const CLUB = {
  "3w": "3-wood",
  "5w": "5-wood",
  "5i": "5-iron",
  "7i": "7-iron",
  "9i": "9-iron",
  "56°": "56°",
};
const BAG = ["3-wood", "5-wood", "5-iron", "7-iron", "9-iron", "56°"];

function isNum(v) {
  return typeof v === "number" && Number.isFinite(v);
}
function roundTo(v, d) {
  if (v == null) return null;
  const f = 10 ** d;
  return Math.round(v * f) / f;
}
function meanKeyed(shots, key) {
  const xs = shots.map((s) => s[key]).filter(isNum);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}
function normalize(raw, i) {
  const out = { shot: i + 1, mishit: false };
  for (const [k, v] of Object.entries(raw)) {
    if (k === "club") continue;
    if (v != null) out[k] = v;
  }
  if (out.face == null && isNum(out.path) && isNum(out.ftp)) {
    out.face = roundTo(out.path + out.ftp, 1);
  }
  return out;
}
function meansOf(shots) {
  if (!shots.length) return null;
  const path = roundTo(meanKeyed(shots, "path"), 1);
  const ftp = roundTo(meanKeyed(shots, "ftp"), 1);
  const faceMean = roundTo(meanKeyed(shots, "face"), 1);
  const face = faceMean ?? (path != null && ftp != null ? roundTo(path + ftp, 1) : null);
  return {
    n: shots.length,
    of: shots.length,
    carry: roundTo(meanKeyed(shots, "carry"), 1),
    total: roundTo(meanKeyed(shots, "total"), 1),
    path,
    face,
    ftp,
    smash: roundTo(meanKeyed(shots, "smash"), 2),
    bs: roundTo(meanKeyed(shots, "bs"), 1),
    cs: roundTo(meanKeyed(shots, "cs"), 1),
    la: roundTo(meanKeyed(shots, "la"), 1),
    spin: roundTo(meanKeyed(shots, "spin"), 0),
    aoa: roundTo(meanKeyed(shots, "aoa"), 1),
    ld: roundTo(meanKeyed(shots, "ld"), 1),
    dynLoft: roundTo(meanKeyed(shots, "dynLoft"), 1),
    spinLoft: roundTo(meanKeyed(shots, "spinLoft"), 1),
  };
}
function premier(shots) {
  const n = shots.length >= 5 ? 5 : shots.length >= 3 ? 3 : 0;
  if (!n) return null;
  const top = shots.slice().sort((a, b) => (b.carry ?? 0) - (a.carry ?? 0)).slice(0, n);
  const m = meansOf(top);
  if (m) {
    m.of = shots.length;
    m.nBest = top.length;
  }
  return m;
}

const RAW = [
  { hole: 1, club: "3w", dest: "rough", planYds: 248, restYds: 300, carry: 189.4, path: 3.0, spin: 1870, ftp: 0.7, smash: 1.47, dynLoft: 9.4 },
  { hole: 1, club: "3w", dest: "rough", planYds: 182, restYds: 77, carry: 159.5, path: -2.7, spin: 3527, ftp: 3.6, smash: 1.35, dynLoft: 15.3 },
  { hole: 1, club: "56°", dest: "green", planYds: 75, pin: "57ft 7in", carry: 67.7, path: -2.2, spin: 4155, ftp: 0.1, smash: 1.04, dynLoft: 41.4 },
  { hole: 2, club: "5w", dest: "rough", planYds: 181, restYds: 134, carry: 167.3, path: -5.6, spin: 2967, ftp: 5.2, smash: 1.42, dynLoft: 13.7 },
  { hole: 2, club: "9i", dest: "rough", planYds: 95, restYds: 34, carry: 90.4, path: -2.2, spin: 5676, ftp: -0.3, smash: 1.27, dynLoft: 27.4 },
  { hole: 2, club: "56°", dest: "green", planYds: 29, pin: "6ft 1in", carry: 21.3, path: -2.4, spin: 1945, ftp: 4.8, smash: 1.19, dynLoft: 33.1 },
  { hole: 3, club: "9i", dest: "rough", planYds: 147, restYds: 11, carry: 147.5, path: -8.8, spin: 6536, ftp: 5.1, smash: 1.31, dynLoft: 24.7 },
  { hole: 3, club: "56°", dest: "green", planYds: 17, pin: "20ft 5in", carry: 5.5, path: 5.1, spin: 1720, ftp: -3.1, smash: 1.29, dynLoft: 29.1 },
  { hole: 4, club: "5w", dest: "fairway", planYds: 215, restYds: 145, carry: 177.2, path: -4.3, spin: 3341, ftp: -4.0, smash: 1.44, dynLoft: 10.6 },
  { hole: 4, club: "9i", dest: "semi rough", planYds: 150, restYds: 15, carry: 137.7, path: -6.1, spin: 6285, ftp: 3.4, smash: 1.31, dynLoft: 25.4 },
  { hole: 4, club: "56°", dest: "green", planYds: 18, pin: "14ft 9in", carry: 7.4, path: -3.5, spin: 1805, ftp: 3.0, smash: 1.25, dynLoft: 36.4 },
  { hole: 5, club: "7i", dest: "rough", planYds: 163, carry: 154.3, path: -3.5, spin: 6396, ftp: 3.4, smash: 1.34, dynLoft: 21.7 },
  { hole: 5, club: "56°", dest: "green", planYds: 18, pin: "16ft 8in", carry: 14.8, spin: 1915 },
  { hole: 6, club: "3w", dest: "fairway", planYds: 203, restYds: 211, carry: 175.7, path: -4.3, spin: 1909, ftp: 4.5, smash: 1.36, dynLoft: 17.3 },
  { hole: 6, club: "5w", dest: "sand", planYds: 185, restYds: 22, carry: 162.5, path: 2.8, spin: 4016, ftp: 0.8, smash: 1.37, dynLoft: 12.2 },
  { hole: 6, club: "56°", dest: "green", planYds: 21, pin: "8ft 10in", carry: 26.9, path: -6.7, spin: 3032, ftp: 7.3, smash: 1.1, dynLoft: 47.9 },
  { hole: 7, club: "3w", dest: "rough", planYds: 166, restYds: 268, carry: 178.4, path: 1.4, spin: 3441, ftp: 1.1, smash: 1.45, dynLoft: 8.0 },
  { hole: 7, club: "3w", dest: "semi rough", planYds: 187, restYds: 83, carry: 175.3, path: 4.7, spin: 2680, ftp: -2.4, smash: 1.42, dynLoft: 10.7 },
  { hole: 7, club: "9i", dest: "rough", planYds: 80, carry: 73.4, path: -2.3, spin: 5416, ftp: 5.2, smash: 1.17, dynLoft: 30.0 },
  { hole: 7, club: "56°", dest: "green", planYds: 16, carry: 8.8, path: 0.1, spin: 1801, ftp: 4.4, smash: 1.16, dynLoft: 35.6 },
  { hole: 8, club: "3w", dest: "fairway", planYds: 219, restYds: 160, carry: 206.2, path: -2.1, spin: 2911, ftp: 0.8, smash: 1.48, dynLoft: 14.0 },
  { hole: 8, club: "7i", dest: "fairway", planYds: 33, restYds: 126, carry: 31.1, path: -6.5, spin: 3658, ftp: 6.3, smash: 0.95, dynLoft: 34.6 },
  { hole: 8, club: "9i", dest: "green", planYds: 117, pin: "4ft 8in", carry: 114.6, path: -2.3, spin: 5933, ftp: 0.7, smash: 1.32, dynLoft: 24.2 },
  { hole: 9, club: "3w", dest: "fairway", planYds: 204, restYds: 216, carry: 192.0, path: -3.0, spin: 2806, ftp: 3.3, smash: 1.47, dynLoft: 10.3 },
  { hole: 9, club: "5w", dest: "semi rough", planYds: 218, restYds: 10, carry: 198.8, path: 0.5, spin: 3611, ftp: -1.8, smash: 1.47, dynLoft: 10.1 },
  { hole: 9, club: "56°", dest: "green", planYds: 14, pin: "12ft 7in", carry: 4.0, path: 2.9, spin: 1838, ftp: 7.1, smash: 1.03, dynLoft: 38.6 },
  { hole: 10, club: "5w", dest: "rough", planYds: 235, restYds: 33, carry: 208.1, path: 3.5, spin: 2298, ftp: 2.8, smash: 1.43, dynLoft: 16.7 },
  { hole: 10, club: "56°", dest: "sand", planYds: 21, restYds: 13, carry: 18.4, path: 0.4, spin: 1374, ftp: 4.8, smash: 1.29, dynLoft: 26.1 },
  { hole: 10, club: "56°", dest: "green", planYds: 14, pin: "5ft 3in", carry: 12.2, path: -8.0, spin: 1826, ftp: 9.0, smash: 0.86, dynLoft: 47.1 },
  { hole: 11, club: "3w", dest: "fairway", planYds: 251, restYds: 249, carry: 237.4, path: -2.6, spin: 2707, ftp: 2.5, smash: 1.5, dynLoft: 10.7 },
  { hole: 11, club: "3w", dest: "sand", planYds: 211, restYds: 38, carry: 202.2, path: 1.4, spin: 3140, ftp: 1.6, smash: 1.47, dynLoft: 14.8 },
  { hole: 11, club: "56°", dest: "rough", planYds: 19, restYds: 17, carry: 12.0, path: 4.5, spin: 1490, ftp: 2.8, smash: 1.27, dynLoft: 28.9 },
  { hole: 11, club: "56°", dest: "green", planYds: 16, pin: "4ft 9in", carry: 7.9, path: 0.6, spin: 1995, ftp: 9.1, smash: 1.07, dynLoft: 43.1 },
  { hole: 12, club: "5i", dest: "rough", planYds: 153, restYds: 23, carry: 139.2, path: -7.3, spin: 4499, ftp: 6.8, smash: 1.35, dynLoft: 19.3 },
  { hole: 12, club: "56°", dest: "semi rough", planYds: 34, restYds: 10, carry: 23.3, path: -8.3, spin: 2608, ftp: 10.5, smash: 0.86, dynLoft: 52.2 },
  { hole: 12, club: "56°", dest: "green", planYds: 11, pin: "2ft 8in", carry: 7.6, path: 0.7, spin: 2163, ftp: 0.7, smash: 1.22, dynLoft: 33.2 },
  { hole: 13, club: "3w", dest: "fairway", planYds: 165, restYds: 268, carry: 137.8, path: 1.4, spin: 1847, ftp: 5.0, smash: 1.27, dynLoft: 20.1 },
  { hole: 13, club: "3w", dest: "fairway", planYds: 217, restYds: 41, carry: 197.9, path: -1.3, spin: 3223, ftp: -0.2, smash: 1.46, dynLoft: 10.1 },
  { hole: 13, club: "56°", dest: "green", planYds: 28, pin: "31ft 8in", carry: 20.1, path: 3.3, spin: 1892, ftp: 1.3, smash: 1.24, dynLoft: 31.3 },
  { hole: 14, club: "3w", dest: "deep rough", planYds: 214, restYds: 314, carry: 186.9, path: -4.4, spin: 1920, ftp: -0.4, smash: 1.43, dynLoft: 12.4 },
  { hole: 14, club: "9i", dest: "fairway", planYds: 150, restYds: 167, carry: 147.2, path: 1.7, spin: 5919, ftp: 1.2, smash: 1.32, dynLoft: 24.4 },
  { hole: 14, club: "7i", dest: "fairway", planYds: 157, restYds: 8, carry: 150.0, path: -7.6, spin: 6240, ftp: 5.9, smash: 1.34, dynLoft: 21.5 },
  { hole: 14, club: "56°", dest: "green", planYds: 7, pin: "2ft 4in", carry: 8.1, path: 2.6, spin: 1923, ftp: 0.7, smash: 1.28, dynLoft: 31.0 },
  { hole: 15, club: "9i", dest: "deep rough", planYds: 110, restYds: 9, carry: 98.4, path: -1.7, spin: 6729, ftp: 3.2, smash: 1.24, dynLoft: 27.2 },
  { hole: 15, club: "56°", dest: "green", planYds: 6, pin: "7ft 7in", carry: 3.3, path: 5.3, spin: 1533, ftp: 0.8, smash: 1.24, dynLoft: 40.3 },
  { hole: 16, club: "3w", dest: "rough", planYds: 257, carry: 231.7, path: -1.9, spin: 2560, ftp: 3.3, smash: 1.47, dynLoft: 11.6 },
  { hole: 16, club: "5w", dest: "rough", planYds: 166, restYds: 43, carry: 161.7, path: 3.5, spin: 1583, ftp: 2.5, smash: 1.31, dynLoft: 20.2 },
  { hole: 16, club: "56°", dest: "rough", planYds: 24, restYds: 16, carry: 21.7, path: -6.0, spin: 1867, ftp: 7.7, smash: 1.21, dynLoft: 35.7 },
  { hole: 16, club: "56°", dest: "green", planYds: 26, pin: "42ft 8in", carry: 13.0, path: 0.7, spin: 2787, ftp: 2.0, smash: 1.25, dynLoft: 37.0 },
  { hole: 17, club: "5w", dest: "semi rough", planYds: 225, restYds: 104, carry: 199.2, path: -2.5, spin: 2838, ftp: 1.7, smash: 1.47, dynLoft: 12.2 },
  { hole: 17, club: "56°", dest: "rough", planYds: 86, restYds: 11, carry: 92.4, path: -0.1, spin: 5661, ftp: -1.2, smash: 1.03, dynLoft: 35.0 },
  { hole: 17, club: "56°", dest: "green", planYds: 9, pin: "3ft 3in", carry: 4.2, path: 1.5, spin: 1736, ftp: 3.1, smash: 1.21, dynLoft: 37.8 },
  { hole: 18, club: "3w", dest: "fairway", planYds: 218, restYds: 162, carry: 207.7, path: -3.1, spin: 3145, ftp: 3.8, smash: 1.46, dynLoft: 11.7 },
  { hole: 18, club: "7i", dest: "rough", planYds: 139, restYds: 34, carry: 131.5, path: -4.1, spin: 7248, ftp: 7.6, smash: 1.33, dynLoft: 22.2 },
  { hole: 18, club: "56°", dest: "sand", planYds: 15, restYds: 18, carry: 8.8, path: -4.3, spin: 2219, ftp: 6.8, smash: 0.8, dynLoft: 47.0 },
  { hole: 18, club: "56°", dest: "green", planYds: 15, pin: "8ft 8in", carry: 18.4, path: -2.9, spin: 3020, ftp: 8.1, smash: 0.87, dynLoft: 45.2 },
];

const HOLES = [
  { hole: 1, par: 5, hcp: 3, yards: 564, score: 5, putts: 2 },
  { hole: 2, par: 4, hcp: 13, yards: 322, score: 4, putts: 1 },
  { hole: 3, par: 3, hcp: 17, yards: 150, score: 4, putts: 2 },
  { hole: 4, par: 4, hcp: 9, yards: 358, score: 5, putts: 2 },
  { hole: 5, par: 3, hcp: 15, yards: 170, score: 4, putts: 2 },
  { hole: 6, par: 4, hcp: 7, yards: 413, score: 5, putts: 2 },
  { hole: 7, par: 5, hcp: 11, yards: 513, score: 6, putts: 2 },
  { hole: 8, par: 4, hcp: 1, yards: 375, score: 4, putts: 1 },
  { hole: 9, par: 4, hcp: 5, yards: 414, score: 5, putts: 2 },
  { hole: 10, par: 4, hcp: 12, yards: 377, score: 5, putts: 2 },
  { hole: 11, par: 5, hcp: 10, yards: 491, score: 5, putts: 1 },
  { hole: 12, par: 3, hcp: 16, yards: 160, score: 4, putts: 1 },
  { hole: 13, par: 4, hcp: 4, yards: 435, score: 5, putts: 2 },
  { hole: 14, par: 5, hcp: 6, yards: 525, score: 5, putts: 1 },
  { hole: 15, par: 3, hcp: 18, yards: 120, score: 3, putts: 1 },
  { hole: 16, par: 4, hcp: 2, yards: 454, score: 6, putts: 2 },
  { hole: 17, par: 4, hcp: 14, yards: 312, score: 4, putts: 1 },
  { hole: 18, par: 4, hcp: 8, yards: 387, score: 6, putts: 2 },
];

const byClub = new Map();
RAW.forEach((row, idx) => {
  const club = CLUB[row.club];
  const list = byClub.get(club) ?? [];
  list.push(normalize({ ...row, seq: idx + 1 }, list.length));
  byClub.set(club, list);
});

const clubs = BAG.filter((c) => byClub.has(c)).map((club) => {
  const shots = byClub.get(club);
  const remaining = meansOf(shots);
  const best = premier(shots);
  return {
    club,
    label: club,
    block: "on-course",
    source: "shots",
    held: 0,
    remaining,
    best,
    shots,
  };
});

const recap = {
  course: "Spyglass Hill",
  location: "Pebble Beach",
  score: 85,
  par: 72,
  out: 42,
  in: 43,
  firHit: 8,
  firOf: 14,
  girHit: 1,
  girOf: 18,
  putts: 28,
  puttsPerHole: 1.6,
  scramblingPct: 35,
  drivingAvg: 232,
  drivingLong: 254,
  approachFt: 32,
  holes: HOLES,
};

const session = {
  id: "round-20260915-spyglass",
  date: "2026-09-15",
  venue: "Spyglass Hill · Pebble Beach",
  mode: "On-course round",
  kind: "on-course",
  setup: "18 holes · 85 (+13) · TrackMan Golf",
  finding:
    "On-course at Spyglass, not a range day. Chips, sand, and rough stay on this round — they do not roll into cumulative pure-hit averages. 56 shots stored with carry, path, face-to-path, smash, spin, dynamic loft, and remaining-to-hole from the shot list. Play order is the hole list, not bag order. Hole 5 56° had dashes for path/face/smash/loft — not invented. Remaining-to-hole left blank on four shots the list never showed (H5 7i, H7 9i, H7 56°, H16 3w). 18 tee was to fairway. Club speed and ball speed were on one driving overlay only and are not attached to a hole.",
  gist: "85 at Spyglass. FIR 8/14, GIR 1/18, 28 putts, scramble 35%. Path still left on a lot of the irons; 3-wood had the hot ones (H11 237.4 carry, smash 1.50).",
  round: recap,
  clubs,
};

fs.writeFileSync(
  "src/data/round-2026-09-15-spyglass.json",
  `${JSON.stringify({ recap, shots: RAW }, null, 2)}\n`,
);

const seed = JSON.parse(fs.readFileSync("src/data/sessions.json", "utf8"));
seed.sessions = seed.sessions.filter((s) => s.id !== session.id);
const after = seed.sessions.findIndex((s) => s.id === "bay-20260915-range-54");
if (after >= 0) seed.sessions.splice(after + 1, 0, session);
else seed.sessions.push(session);
fs.writeFileSync("src/data/sessions.json", `${JSON.stringify(seed, null, 2)}\n`);

console.log("shots", RAW.length, "score", HOLES.reduce((s, h) => s + h.score, 0));
for (const c of clubs) {
  console.log(c.club, "n", c.remaining.n, "carry", c.remaining.carry, "path", c.remaining.path, "dyn", c.remaining.dynLoft, "smash", c.remaining.smash);
}
