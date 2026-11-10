// End-to-end smoke test for the archived-painting 360-degree sculpture room.
// Run from repository root with an HTTP server on port 4173.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser = await chromium.launch({
  headless: true,
  args: ['--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']
});
try {
  const page = await browser.newPage({viewport: {width: 1400, height: 900}});
  const pageErrors = [], consoleErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', event => {
    if (event.type() === 'error') { consoleErrors.push(event.text()); console.error('[Browser]', event.text().slice(0, 350)); }
  });
  await page.goto('http://127.0.0.1:4173/gallery/sculpture-lab/', {
    waitUntil: 'domcontentloaded', timeout: 45000
  });
  await page.waitForFunction(() => window.__sculptureLabStatus?.ready ||
    window.__sculptureLabStatus?.error, {timeout: 90000});
  let lab = await page.evaluate(() => window.__sculptureLabStatus);
  assert.equal(lab.ready, true, 'Lab did not construct four sculptures: ' + JSON.stringify(lab));
  assert.deepEqual(lab.methods.map(e => e.method), ['petal','ribbon','pigment','hybrid']);
  assert.ok(lab.methods.every(e => e.meshes > 1));
  assert.equal(lab.texture.mode, 'painted');
  assert.ok(lab.texture.paintedMeshes.every(n => n > 0), 'Not all four sculptures textured');
  assert.ok(lab.composition.sourceAnchored.every(Boolean), 'The painting is not composition-anchored on all four plinths');
  assert.ok(lab.composition.backingVisible.every(v => v === false), 'Free-form clutter remains visible through the painted front');
  assert.ok(lab.composition.paintCells.every(n => n > 10), 'Source pigment geometry missing');
  assert.ok(lab.composition.frontXYError.every(n => n === 0), 'The image composition is spatially distorted');
  assert.equal(lab.texture.blend, .76);
  await page.locator('#textureMode').selectOption('plain');
  assert.equal((await page.evaluate(() => window.__sculptureLabStatus)).texture.blend, 0);
  assert.ok((await page.evaluate(() => window.__sculptureLabStatus)).composition.backingVisible.every(Boolean));
  await page.locator('#textureMode').selectOption('painted');
  assert.ok((await page.evaluate(() => window.__sculptureLabStatus)).composition.backingVisible.every(v => v === false));
  await page.locator('#textureStrength').fill('92');
  assert.equal((await page.evaluate(() => window.__sculptureLabStatus)).texture.blend, .92);
  assert.equal(lab.methods[3].elements.petals > 0, true);
  assert.equal(lab.methods[3].elements.ribbons > 0, true);
  assert.equal(lab.methods[3].elements.pigment > 0, true);
  assert.equal(await page.locator('#legend span').count(), 4);
  await page.locator('#focus').selectOption('3');
  await page.locator('#front').click();
  await page.screenshot({path: '/tmp/sculpture-lab-360-source-front.png', fullPage: true, timeout: 90000});
  await page.locator('#side').click();
  await page.locator('#back').click();
  await page.waitForTimeout(200);
  await page.locator('#orbitToggle').click();
  assert.equal(await page.locator('#orbitToggle').textContent(), 'Stop rotation');
  await page.locator('#orbitToggle').click(); // freeze before capture in software WebGL
  await page.screenshot({path: '/tmp/sculpture-lab-360-desktop.png', fullPage: true, timeout: 90000});
  const paintings = await page.locator('#painting option').count();
  if (paintings >= 2) {
    const firstSeed = lab.seed;
    await page.locator('#painting').selectOption({index: 1});
    await page.waitForFunction(previous =>
      window.__sculptureLabStatus?.ready && window.__sculptureLabStatus.seed !== previous,
      firstSeed, {timeout: 90000});
    lab = await page.evaluate(() => window.__sculptureLabStatus);
    assert.ok(lab.methods.every(e => e.meshes > 1), 'Re-selection lost a sculpture');
  }
  await page.setViewportSize({width: 390, height: 844});
  await page.reload({waitUntil: 'domcontentloaded'});
  await page.waitForFunction(() => window.__sculptureLabStatus?.ready ||
    window.__sculptureLabStatus?.error, {timeout: 90000});
  const mobile = await page.evaluate(() => window.__sculptureLabStatus);
  assert.equal(mobile.ready, true, 'Mobile render failed: ' + JSON.stringify(mobile));
  assert.ok(mobile.texture.paintedMeshes.every(n => n > 0), 'No textured mobile materials');
  assert.ok(mobile.composition.sourceAnchored.every(Boolean), 'Mobile source image positions changed');
  assert.equal(await page.locator('#textureMode').isVisible(), true);
  assert.equal(await page.locator('#back').isVisible(), true);
  await page.screenshot({path: '/tmp/sculpture-lab-360-mobile.png', fullPage: true, timeout: 90000});
  assert.deepEqual(pageErrors, [], 'Browser JS errors: ' + pageErrors.join('; '));
  assert.equal(consoleErrors.filter(e => /shader error|webglprogram|shader compilation/i.test(e)).length, 0,
    'Texture shader compilation errors: ' + consoleErrors.join('; '));
  console.log('360 sculpture lab smoke passed:', lab.date, lab.seed,
    lab.methods.map(e => e.method + ':' + e.meshes).join(' '));
} finally {
  await browser.close();
}
