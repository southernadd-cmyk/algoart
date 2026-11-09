import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium, firefox, webkit} from 'playwright';
import {GALLERY, MEDIA, PAGES} from '../automation/r2-gallery-media.mjs';

const date = process.env.R2_EDITION_DATE;
assert.match(date || '', /^\d{4}-\d{2}-\d{2}$/);
const live = process.argv.includes('--live');
const fixture = process.argv.includes('--fixture');
assert(!(fixture && live), 'A live test cannot substitute media');
const stage = process.env.R2_STAGE_OUTPUT;
const dayUrl = GALLERY + date + '/';
const meta = live
  ? await (await fetch(dayUrl + 'meta.json')).json()
  : JSON.parse(await fs.readFile(path.join(stage, 'gallery', date, 'meta.json'), 'utf8'));
const manifest = live ? null : JSON.parse(await fs.readFile(path.join(stage, 'media-publication.json'), 'utf8'));
const expectedSculptures = meta.entries.filter(entry => entry.orientation === 'portrait' && entry.material !== 'confluence').length;

async function serveCheckout(route) {
  const relative = decodeURIComponent(new URL(route.request().url()).pathname).slice('/algoart/'.length);
  const file = relative.endsWith('/') || !relative ? relative + 'index.html' : relative;
  for (const directory of [stage, process.cwd()]) {
    const target = path.resolve(directory, file);
    if (!target.startsWith(path.resolve(directory) + path.sep)) break;
    const stat = await fs.stat(target).catch(() => null);
    if (stat?.isFile()) return route.fulfill({path: target});
  }
  return route.fulfill({status: 404, body: 'Missing checkout file: ' + file});
}

for (const name of (process.env.R2_BROWSERS || 'chromium,webkit').split(',')) {
  const runtime = {chromium, firefox, webkit}[name];
  assert(runtime, 'Unknown browser ' + name);
  const executablePath = name === 'chromium' ? process.env.CHROMIUM_EXECUTABLE : undefined;
  const browser = await runtime.launch({headless: true, executablePath});
  try {
    const context = await browser.newContext({viewport: {width: 1440, height: 900}});
    if (!live) await context.route(PAGES + '/algoart/**', serveCheckout);
    if (fixture) {
      const assets = new Map(manifest.mediaAssets.map(asset => [asset.url, asset]));
      await context.route(MEDIA + '/**', route => {
        const asset = assets.get(route.request().url());
        if (!asset) return route.fulfill({status: 404});
        return route.fulfill({path: asset.sourcePath, contentType: asset.contentType,
          headers: {'access-control-allow-origin': PAGES}});
      });
    }
    const page = await context.newPage();
    const errors = [];
    const failedMedia = [];
    const textures = new Set();
    page.on('pageerror', error => errors.push(error.message));
    page.on('requestfailed', request => {
      if (request.url().startsWith(MEDIA)) failedMedia.push(request.url());
    });
    page.on('response', response => {
      if (!response.url().startsWith(MEDIA)) return;
      if (!response.ok()) failedMedia.push(response.url());
      if (response.ok() && response.url().endsWith('.webp')) textures.add(response.url());
    });
    assert((await page.goto(dayUrl, {waitUntil: 'domcontentloaded'})).ok());
    await page.evaluate(async entries => {
      const cards = [...document.querySelectorAll('article.art-card')];
      if (cards.length !== entries.length) throw Error('Incomplete 2D gallery');
      for (const [i, card] of cards.entries()) {
        const entry = entries[i];
        const img = card.querySelector('img');
        if (img.dataset.imageFile !== entry.imageFile || img.src !== entry.media.original ||
            card.querySelector('a.remix').href !== entry.shareUrl) {
          throw Error('Wrong image or share state for ' + entry.id);
        }
        const probe = new Image();
        probe.crossOrigin = 'anonymous';
        probe.src = img.src;
        await probe.decode();
        if (probe.naturalWidth < 100 || probe.naturalHeight < 100) throw Error('Empty image');
      }
    }, meta.entries);
    assert.equal(await page.locator('meta[property="og:image"]').getAttribute('content'),
      meta.entries[0].media.original);
    assert((await page.goto(GALLERY, {waitUntil: 'domcontentloaded'})).ok());
    await page.evaluate(async cover => {
      const img = [...document.querySelectorAll('.day-card img')].find(candidate => candidate.src === cover);
      if (!img) throw Error('Missing archive cover');
      const probe = new Image();
      probe.crossOrigin = 'anonymous';
      probe.src = cover;
      await probe.decode();
      if (probe.naturalWidth !== 840 || probe.naturalHeight !== 600) throw Error('Wrong cover dimensions');
    }, meta.mediaCover);
    assert((await page.goto(GALLERY + 'visit/?debug=1&date=' + date, {
      waitUntil: 'domcontentloaded', timeout: 60_000
    })).ok());
    await page.waitForFunction(({date, count}) => {
      const state = window.__phiFullEngine;
      return state?.date === date && state.artworks === count && state.paintings > 0 &&
        state.paintingsLoaded === state.paintings && !document.getElementById('enter')?.disabled;
    }, {date, count: meta.count}, {timeout: 150_000});
    const state = await page.evaluate(() => {
      const {paintings, sculptures, unplaced} = window.__phiFullEngine;
      return {paintings, sculptures, unplaced, errorVisible: !document.getElementById('error')?.hidden};
    });
    assert.deepEqual(state, {paintings: meta.count - expectedSculptures,
      sculptures: expectedSculptures, unplaced: 0, errorVisible: false});
    assert(textures.size >= state.paintings, 'The real tower did not fetch the R2 textures');
    assert.deepEqual(failedMedia, []);
    assert.deepEqual(errors, []);
    console.log(name, date, meta.count, 'artworks,', textures.size, 'R2 textures,', state.sculptures, 'sculptures');
  } finally {
    await browser.close();
  }
}
