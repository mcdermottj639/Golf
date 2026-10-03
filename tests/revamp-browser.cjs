#!/usr/bin/env node
'use strict';

// Exercise the actual redesigned shell using clicks and typing. No private app
// functions, manufactured DOM controls or test-only navigation are required.
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES + '/playwright');
const { LS_KEY, feedFiles, baselineState, personalizedState, sameState } = require('./revamp-preservation.cjs');
const root = path.join(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = http.createServer((request, response) => {
  const route = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + (route === '/' ? '/index.html' : route));
  if (!file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
  fs.readFile(file, (error, data) => {
    response.writeHead(error ? 404 : 200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    response.end(error ? '' : data);
  });
});

const clone = value => JSON.parse(JSON.stringify(value));
const screenshotDir = process.env.CADDIE_QA_DIR || '/tmp/caddie-revamp-qa';

async function stateOf(page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)), LS_KEY);
}
async function ready(page) {
  await page.waitForFunction(() => {
    const state = JSON.parse(localStorage.getItem('caddiehq_v1') || '{}');
    return state.feedApplied?.includes('oct01-map-20261001-retire-split-5w-v1') &&
      state.rounds?.some(round => round.feedId === 'round-tm-20261001-v1') &&
      window.CaddieHQ && window.CaddieExplorer;
  });
  await page.locator('.hq-dashboard').waitFor();
}
async function openExplorer(page) {
  await page.locator('.hq-search-trigger:visible').first().click();
  await page.locator('#hq-explorer[open]').waitFor();
  await page.locator('.hq-explorer-link').first().waitFor();
}
async function exploreTo(page, selector, query) {
  await openExplorer(page);
  if (query) {
    await page.locator('.hq-explorer-input').fill(query);
    await page.waitForFunction(value => document.getElementById('hq-explorer-status').textContent.includes(`“${value}”`), query);
  }
  const result = page.locator('.hq-explorer-link' + selector).first();
  await result.waitFor();
  await result.click();
  assert.equal(await page.locator('#hq-explorer').getAttribute('open'), null, 'Explorer closes on navigation');
}
async function overflowCheck(page, label) {
  const layout = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth }));
  assert.ok(layout.content <= layout.width + 1, `${label}: page overflow ${layout.content} > ${layout.width}`);
}
async function run() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;
  const executablePath = process.env.CADDIE_CHROMIUM || (fs.existsSync('/tmp/chromium') ? '/tmp/chromium' : undefined);
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}), args: ['--no-sandbox'] });
  fs.mkdirSync(screenshotDir, { recursive: true });
  const errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', acceptDownloads: true });
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await ready(page);
    const initial = await stateOf(page);
    assert.equal(initial.bays.length, 12);
    assert.equal(initial.rounds.length, 11);
    assert.equal(initial.sessions.length, 10);
    assert.equal(await page.locator('#nav button[data-view]').count(), 5);
    assert.equal(await page.locator('.hq-dashboard').count(), 1);

    // Every primary page remains navigable and fits narrow phones through desktop.
    for (const width of [320, 360, 390, 430, 1000, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      for (const view of ['home', 'bag', 'game', 'rounds', 'coach']) {
        await page.locator(`#nav [data-view="${view}"]`).click();
        assert.equal(await page.locator('#view').getAttribute('data-page'), view);
        assert.equal(await page.locator('#nav button.on').count(), 1);
        assert.equal(await page.locator('#nav button.on').getAttribute('data-view'), view);
        await overflowCheck(page, `${view} at ${width}px`);
        assert.ok(await page.locator('#nav .nl').evaluateAll(labels => labels.every(label => label.scrollWidth <= label.clientWidth + 1)), `navigation labels fit at ${width}px`);
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#nav [data-view="home"]').click();
    await page.screenshot({ path: path.join(screenshotDir, 'overview-390.png') });

    // Global search is usable from the keyboard, safely escapes input and restores focus.
    const trigger = page.locator('.hq-search-trigger:visible').first();
    await trigger.focus();
    await page.keyboard.press('Control+k');
    await page.locator('#hq-explorer[open]').waitFor();
    assert.equal(await page.locator('.hq-explorer-input').evaluate(input => input === document.activeElement), true);
    assert.ok(await page.locator('.hq-explorer-group').count() >= 3);
    const unavailable = '<img src=x onerror="window.__searchInjected=1"> definitely-absent';
    await page.locator('.hq-explorer-input').fill(unavailable);
    await page.locator('.hq-explorer-empty').waitFor();
    assert.match(await page.locator('#hq-explorer-status').innerText(), /No results/);
    assert.equal(await page.locator('.hq-explorer img').count(), 0);
    assert.equal(await page.evaluate(() => window.__searchInjected), undefined);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#hq-explorer').getAttribute('open'), null);
    assert.equal(await trigger.evaluate(element => element === document.activeElement), true);
    await openExplorer(page);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#view').getAttribute('data-page'), 'bag', 'keyboard selection opens one real destination');
    assert.equal(await page.locator('#hq-explorer').getAttribute('open'), null);
    await openExplorer(page);
    await page.locator('.hq-explorer-input').fill('5W');
    await page.locator('.hq-explorer-link[data-action="club-history"][data-club="5W"]').waitFor();
    assert.match(await page.locator('#hq-explorer-status').innerText(), /for “5W”/);
    await page.screenshot({ path: path.join(screenshotDir, 'explorer-390.png') });
    await page.keyboard.press('Escape');

    // A day entry still points at the source-array index after grouping and sorting.
    await exploreTo(page, '[data-action="session-category"][data-kind="days"]');
    const dayRowCount = await page.locator('.session-row').count();
    const october = page.locator('.session-row[data-action="open-bay"]').filter({ has: page.locator('.session-date', { hasText: 'Oct 1' }) });
    assert.equal(await october.count(), 1);
    assert.match(await october.innerText(), /146 usable shots · 13 clubs · 3 source sessions/);
    await october.click();
    assert.match(await page.locator('.bay-takeaways > p').first().innerText(), /146 usable shots/);
    assert.ok(await page.locator('.bt-card, .bay-takeaways article').count() > 0, 'range day retains takeaways');
    await page.locator('#day-sources > summary').click();
    assert.equal(await page.locator('[data-action="open-bay-source"]').count(), 3);
    const indices = await page.locator('[data-action="open-bay-source"]').evaluateAll(buttons => buttons.map(button => Number(button.dataset.i)));
    assert.ok(indices.every(index => initial.bays[index].date === '2026-10-01'));
    await page.locator('[data-action="open-bay-source"]').filter({ hasText: 'Map My Bag' }).click();
    assert.equal(await page.locator('.bay-takeaways').count(), 0, 'original source is not another daily aggregate');
    assert.match(await page.locator('#view').innerText(), /72 reported shots/);
    await page.locator('[data-action="open-bay"]').filter({ hasText: 'Open full range day' }).click();
    assert.match(await page.locator('.bay-takeaways > p').first().innerText(), /146 usable shots/);
    await overflowCheck(page, 'full daily range view');

    // Search takes us to the actual Granite card and preserves its 51 observations.
    const graniteIndex = initial.rounds.findIndex(round => round.feedId === 'round-tm-20261001-v1');
    await exploreTo(page, `[data-action="open-round"][data-i="${graniteIndex}"]`, 'Granite');
    assert.match(await page.locator('.rr').innerText(), /51 shot observations/);
    assert.ok(await page.locator('.rt-card').count() > 0, 'round takeaways survive');
    const holeLink = page.locator('.rt-links [data-action="review-hole"]').first();
    const hole = await holeLink.getAttribute('data-hole');
    await holeLink.click();
    assert.ok(await page.locator(`details[data-review-hole="${hole}"]`).evaluate(element => element.open));
    await overflowCheck(page, 'Granite shot ledger');

    // The original whole-club history and every metric remain accessible from Bag.
    await page.locator('#nav [data-view="bag"]').click();
    const club = page.locator('.bag-item').filter({ has: page.locator('[data-action="club-history"][data-club="5W"]') });
    assert.equal(await club.count(), 1);
    await club.locator('summary').click();
    await club.locator('[data-action="club-history"]').click();
    assert.equal(await page.locator('.swing-evo-club').getAttribute('data-club'), '5W');
    assert.ok(await page.locator('.swing-evo-record').count() > 3);
    assert.ok(await page.locator('.club-trend').count() > 8);
    await page.locator('.club-trend-row').first().click();
    assert.equal(await page.locator('#view').getAttribute('data-page'), 'bay');
    await exploreTo(page, '[data-action="session-category"][data-kind="cumulative"]');
    assert.ok(await page.locator('.cum-club').count() >= 13);
    await overflowCheck(page, 'Cumulative club evidence');

    // Former side doors are first-class Explorer destinations, with their real UI.
    for (const view of ['swing', 'shortgame', 'putting', 'mental', 'drills', 'decisions', 'numbers', 'timeline']) {
      await exploreTo(page, `[data-action="go"][data-view="${view}"]`);
      assert.equal(await page.locator('#view').getAttribute('data-page'), view);
      assert.ok(await page.locator('#view').innerText().then(text => text.length > 100), `${view} has retained content`);
      await overflowCheck(page, view);
    }
    await exploreTo(page, '[data-action="go"][data-view="numbers"]');
    assert.ok(await page.locator('.numrow').count() > 20);
    await page.locator('.numrow').first().click();
    assert.ok(await page.locator('.sheetveil').isVisible(), 'metric meaning and provenance still open');
    await page.keyboard.press('Escape');
    // The app's sheet close control is available if Escape is not the legacy close gesture.
    if (await page.locator('.sheetveil').count()) await page.locator('[data-action="cheat-close"]').first().click();
    await exploreTo(page, '[data-action="live-new"]');
    assert.ok(await page.locator('#lvCourse').isVisible(), 'new round entry remains reachable');
    sameState(await stateOf(page), initial, 'read-only navigation does not modify the golf record');

    // Coach generation, a scored zero, and rebuilding/archiving work in the new shell.
    await page.locator('#nav [data-view="coach"]').click();
    await page.locator('[data-action="build-sim-practice"]').click();
    assert.equal(await page.locator('.sim-practice-block').count(), 5);
    const plan = (await stateOf(page)).simPracticePlan;
    assert.equal(plan.usable, 146);
    const scoredBlock = page.locator('.sim-practice-block').filter({ has: page.locator('[data-sim-field="count"]') }).first();
    const resultIndex = Number(await scoredBlock.locator('[data-action="save-sim-practice"]').getAttribute('data-i'));
    await scoredBlock.locator('[data-sim-field="count"]').fill('0');
    await scoredBlock.locator('[data-action="save-sim-practice"]').click();
    assert.equal((await stateOf(page)).simPracticePlan.blocks[resultIndex].result.count, 0);
    await page.reload(); await ready(page);
    await page.locator('#nav [data-view="coach"]').click();
    assert.equal((await stateOf(page)).simPracticePlan.blocks[resultIndex].result.count, 0);
    await page.locator('[data-action="build-sim-practice"]').click();
    assert.equal((await stateOf(page)).simPracticeHistory.at(-1).blocks[resultIndex].result.count, 0);
    const afterPractice = await stateOf(page);
    delete afterPractice.simPracticePlan; delete afterPractice.simPracticeHistory;
    sameState(afterPractice, initial, 'practice only adds its plan and result history');

    // Bulk/individual section preferences stay UI-only and survive navigation/reload.
    await page.locator('#nav [data-view="bag"]').click();
    const fold = page.locator('.section-fold-toggle').first();
    const foldKey = await fold.getAttribute('data-fold-key');
    await fold.click();
    const folded = await fold.getAttribute('aria-expanded');
    await page.locator('#nav [data-view="home"]').click();
    await page.locator('#nav [data-view="bag"]').click();
    assert.equal(await page.locator(`[data-fold-key="${foldKey}"]`).getAttribute('aria-expanded'), folded);
    await page.reload(); await ready(page);
    await page.locator('#nav [data-view="bag"]').click();
    assert.equal(await page.locator(`[data-fold-key="${foldKey}"]`).getAttribute('aria-expanded'), folded);
    await page.locator('.section-menu > summary').click();
    await page.getByRole('button', { name: 'Expand all', exact: true }).click();
    assert.equal(await page.locator('.section-fold-toggle[aria-expanded="false"]').count(), 0);
    assert.equal(await page.locator('details[data-section-key]:not([open])').count(), 0);

    // Verify a real existing installation, including live-round resume and backup round trip.
    const personalized = personalizedState(baselineState());
    const existingContext = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', acceptDownloads: true });
    await existingContext.addInitScript(({ key, state }) => {
      if (!localStorage.getItem('caddiehq_qa_seeded')) {
        localStorage.setItem(key, JSON.stringify(state));
        localStorage.setItem('caddiehq_qa_seeded', '1');
      }
    }, { key: LS_KEY, state: personalized });
    const existing = await existingContext.newPage();
    existing.setDefaultTimeout(12000);
    existing.on('pageerror', error => errors.push(error.message));
    await existing.goto(url); await ready(existing);
    // The longstanding What's New view marks rendered release notices as read.
    // Permit only those presentation receipts, then compare every other field.
    const loadedPersonal = await stateOf(existing);
    personalized.settings.seenUpdates = clone(loadedPersonal.settings.seenUpdates);
    sameState(loadedPersonal, personalized, 'existing phone opens without a migration or reset');
    await exploreTo(existing, '[data-action="live-new"]');
    assert.match(await existing.locator('.lvhe').innerText(), /MY LOCAL COURSE/);
    assert.match(await existing.locator('.lvhn').innerText(), /Hole 1/);
    assert.equal(await existing.locator('#lvHoleNote').inputValue(), 'Hit 5W');
    await existing.locator('[data-action="go"][data-view="home"]').first().click();
    sameState(await stateOf(existing), personalized, 'resuming then pausing preserves every recorded tap');
    await exploreTo(existing, '[data-action="go"][data-view="data"]');
    const [download] = await Promise.all([
      existing.waitForEvent('download'),
      existing.locator('[data-action="export"]').click(),
    ]);
    assert.match(download.suggestedFilename(), /^caddiehq-backup-.*\.json$/);
    const exported = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
    sameState(exported, personalized, 'export includes every personal value and unknown field');
    const restored = clone(exported);
    restored.futureCustomData.backupRoundTrip = 'Verified in the redesigned app';
    const [chooser] = await Promise.all([
      existing.waitForEvent('filechooser'),
      existing.locator('[data-action="import"]').click(),
    ]);
    await chooser.setFiles({ name: 'caddiehq-qa-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(restored)) });
    await existing.waitForFunction(() => JSON.parse(localStorage.getItem('caddiehq_v1')).futureCustomData?.backupRoundTrip);
    sameState(await stateOf(existing), restored, 'backup import restores the complete exported record');
    await existing.reload(); await ready(existing);
    sameState(await stateOf(existing), restored, 'restored data survives app restart and feed refresh');
    await existing.screenshot({ path: path.join(screenshotDir, 'existing-install-night-390.png') });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator('#nav [data-view="home"]').click();
    await page.screenshot({ path: path.join(screenshotDir, 'overview-1440.png') });

    // Installed/offline use loads the new CSS and Explorer from the real worker.
    const offlineContext = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'allow' });
    const offlinePage = await offlineContext.newPage();
    offlinePage.setDefaultTimeout(12000);
    offlinePage.on('pageerror', error => errors.push(error.message));
    await offlinePage.goto(url); await ready(offlinePage);
    await offlinePage.evaluate(async () => { await navigator.serviceWorker.ready; });
    await offlinePage.waitForFunction(() => !!navigator.serviceWorker.controller);
    await offlinePage.reload(); await ready(offlinePage);
    await offlinePage.waitForFunction(async names => {
      const build = document.getElementById('buildTag').textContent;
      const cache = await caches.open('caddiehq-' + build);
      const assets = ['./revamp.css', './explorer.js', ...names.map(name => `./${name}?build=${encodeURIComponent(build)}`)];
      const found = await Promise.all(assets.map(asset => cache.match(new URL(asset, location.href))));
      return found.every(Boolean);
    }, feedFiles);
    const offlineBefore = await stateOf(offlinePage);
    await offlineContext.setOffline(true);
    await offlinePage.reload(); await ready(offlinePage);
    assert.equal(await offlinePage.locator('.hq-dashboard').count(), 1);
    await exploreTo(offlinePage, '[data-action="session-category"][data-kind="days"]');
    assert.equal(await offlinePage.locator('.session-row').count(), dayRowCount, 'offline activity log keeps all grouped records');
    sameState(await stateOf(offlinePage), offlineBefore, 'offline restart and navigation preserve the full record');
    await overflowCheck(offlinePage, 'offline activity');
    assert.deepEqual(errors, [], 'no JavaScript errors across fresh or existing installation');
    console.log('PASS revamp browser: 320–1920px primary routes, Explorer keyboard/search/escaping, 146-shot day + original sources, Granite + hole ledger, full club history, all labs/numbers/evidence, practice zero/reload/archive, section memory, live-round resume, exact backup export/import, fresh/existing data parity, real service-worker offline use and no runtime errors.');
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
