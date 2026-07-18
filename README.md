# ⛳ Caddie HQ

Jack's golf command center — bag, stroke, coach, and courses in one app. Built in the
**Scorecard Heritage** design (cream scorecard paper, Masters green, burgundy).

## What's inside

| Module | What it does |
|---|---|
| **Home** | Return-window countdown, today's coached lesson, gear alerts, open actions |
| **My Bag** | Every club + specs, mismatch flags, wedge gapping ladder, yardage matrix, change history, groove-life tracking |
| **Putting Lab** | The left-miss diagnosis, tap-to-log 20-ball 5-footer tests with miss direction, drill streaks, filmed session log |
| **Coach** | 22-lesson library across 6 shelves, lessons picked from what you actually log, 60-second round entry with trouble tagging |
| **Courses** | Personal ratings + PR score per course, states count, bucket list, course notes |
| **Decisions** | Zero-torque putter shortlist with demo tracking, 10-ball head-to-head test log |

Data is stored in the browser (localStorage) — no accounts, no backend. Use
**Home → Data & backup** to export/import a JSON backup.

## Run it

Open `index.html` in a browser, or serve the folder:

```
npx http-server .
```

## Put it on your phone (GitHub Pages)

1. Merge this branch to `main`
2. Repo **Settings → Pages → Source: Deploy from a branch → `main` / root**
3. Open the published URL on your phone → Share → **Add to Home Screen**

It installs like an app and works offline (service worker caches the shell).

## Repo map

- `index.html` / `styles.css` / `app.js` / `lessons.js` — the app
- `sw.js` / `manifest.webmanifest` / `icon.svg` — PWA install + offline
- `PROPOSAL.md` — the workshopped concept this build implements
- `design-options/` — the three design candidates + Coach preview (B was approved)
- `mockup/` — the original pre-approval mockup
