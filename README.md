# ⛳ Caddie HQ

Jack's personal golf workspace — every club, session, round and coaching insight,
connected. v200 introduces a pine/lime/off-white design, readable system type,
mobile bottom navigation, a desktop rail and a global **Find anything** Explorer.

## What's inside

| Module | What it does |
|---|---|
| **Overview** | Sourced snapshot, recent activity, start/resume round, practice plan, plus the complete numbers, conditions, coaching and update record |
| **Bag** | Scannable club roster + carries, full club history, setup/settings, bench, gapping, yardage matrix and equipment decisions |
| **Progress** | Activity by day, cumulative trends, every club and source; one-tap Swing, Short-game, Putting and Mental labs |
| **Rounds** | Recent rounds, complete course/simulator reviews, scorecards, live logging, course plans and course directory |
| **Course Prep** | Pound Ridge: all 18 holes, seven tees, course map, current bag/range comparisons, editable targets and saved notes; optional Google satellite/3D flyovers |
| **Coach** | Personalized coaching library, drills, progress, practice planner and saved results |
| **Explorer** | Search clubs, dates, rounds, sources, numbers, plans and lessons from any page; Cmd/Ctrl+K on a keyboard |

Data is stored in the browser (localStorage) — no accounts, no backend. Use
**Find anything → Data & backup** to export/import a JSON backup. No storage reset or
data migration is required for v200. The previous app is retained on
`backup/caddie-hq-v199-2026-10-02` for rollback.

## Run it

Open **Rounds → Prepare Pound Ridge** to plan a round. Google satellite and 3D need
a billing-enabled Maps JavaScript API browser key entered under **Google Maps setup**.
See [setup and source details](data/course-prep/README.md). The course map and saved
strategy work without Google and are available offline after the app has loaded.

Open `index.html` in a browser, or serve the folder:

```
npx http-server .
```

## Put it on your phone (GitHub Pages)

1. Merge this branch to `main`
2. The publish workflow verifies the app and mirrors it to the Pages-served `gh-pages` branch
3. Open the published URL on your phone → Share → **Add to Home Screen**

It installs like an app and works offline (service worker caches the shell).

## Repo map

- `index.html` / `styles.css` / `revamp.css` / `app.js` / `explorer.js` / `lessons.js` — the app
- `sw.js` / `manifest.webmanifest` / `icon.svg` — PWA install + offline
- `PROPOSAL.md` — the workshopped concept this build implements
- `design-options/` — the three design candidates + Coach preview (B was approved)
- `mockup/` — the original pre-approval mockup
