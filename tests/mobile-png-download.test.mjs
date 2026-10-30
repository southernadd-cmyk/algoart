import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Exercise the editor's real export lifecycle without repainting the artwork.
const source = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const exportCode = source.slice(source.indexOf('var exportBusy=false,'), source.indexOf('\nfunction saveSVG()'));
const elements = new Map(), timers = [], revoked = [], pending = [];
class Element {
  constructor(id) { this.attrs = { id }; this.style = {}; this.hidden = false; elements.set(id, this); }
  get href() { return this.attrs.href; }
  set href(value) { this.attrs.href = value; }
  get download() { return this.attrs.download; }
  set download(value) { this.attrs.download = value; }
  removeAttribute(name) { delete this.attrs[name]; }
  setAttribute(name, value) { this.attrs[name] = value; }
  addEventListener() {}
  cloneNode() { const copy = Object.create(Element.prototype); Object.assign(copy, this, { attrs: { ...this.attrs }, style: {} }); return copy; }
  replaceWith(next) { elements.set(this.attrs.id, next); this.connected = false; next.connected = true; }
  remove() { this.connected = false; }
}
for (const id of ['pngReady', 'pngDownload', 'pngOpen', 'exportStatus', 'exportScale', 'savePanel']) new Element(id);
elements.get('exportScale').value = '1';
let serial = 0, seed = 'first';
const context = vm.createContext({
  $: id => elements.get(id),
  document: { body: { appendChild: node => { node.connected = true; } } },
  URL: { createObjectURL: () => 'blob:test-' + ++serial, revokeObjectURL: url => revoked.push(url) },
  setTimeout: (fn, delay) => { assert.equal(delay, 60000); timers.push(fn); },
  mobileQuery: { matches: true },
  A: {
    readSettings: () => ({ seed }),
    preparePNG: settings => new Promise((resolve, reject) => pending.push({ settings, resolve, reject }))
  },
  actionPaintingEnabled: () => false, oilEnabled: () => false, oilPaintEnabled: () => false,
  oilPaintV6Enabled: () => false, oilPaintV5Enabled: () => false, oilPaintV4Enabled: () => false,
  oilPaintV3Enabled: () => false, oilPaintV2Enabled: () => false, watercolourEnabled: () => false,
  actionPaintingRevision: 4, watercolourMaterialRevision: 'v2s', watercolourFitToSheet: false,
  tissuePaletteVersion: 7
});
vm.runInContext(exportCode, context);
const flush = () => new Promise(setImmediate);
const prepare = () => vm.runInContext('savePNG()', context);
const clear = () => vm.runInContext('clearPreparedPNG()', context);
const ready = () => pending.shift().resolve({ blob: {}, filename: 'art.png' });
const button = elements.get('savePanel');
const retired = [];
for (const nextSeed of ['first', 'second', 'third']) {
  seed = nextSeed;
  clear(); // A changed artwork invalidates the previous PNG.
  assert.equal(elements.get('pngReady').hidden, true);
  assert.equal(elements.get('pngDownload').href, undefined);
  prepare();
  assert.equal(button.disabled, true);
  assert.equal(pending[0].settings.seed, nextSeed);
  ready(); await flush();
  const link = elements.get('pngDownload');
  assert.equal(elements.get('pngReady').hidden, false);
  assert.equal(button.disabled, false);
  assert.equal(link.href, 'blob:test-' + serial);
  assert.equal(elements.get('pngOpen').href, link.href);
  assert.equal(link.download, serial === 1 ? 'art.png' : 'art-' + serial + '.png');
  for (const old of retired) {
    assert.notEqual(link, old.node);
    assert.equal(old.node.href, old.href); // Never strip a pending download's URL.
    assert.equal(old.node.connected, true);
  }
  retired.push({ node: link, href: link.href });
}
assert.deepEqual(revoked, []);
timers.splice(0).forEach(fn => fn());
assert.deepEqual(revoked, ['blob:test-1', 'blob:test-2']);
assert.equal(retired[0].node.connected, false);
assert.equal(elements.get('pngDownload').href, 'blob:test-3');

// Changing the artwork during encoding must not expose the stale file.
clear(); prepare(); clear(); ready(); await flush();
assert.equal(elements.get('pngReady').hidden, true);
assert.equal(elements.get('pngDownload').href, undefined);
assert.equal(button.disabled, false);

// A failed encoding must leave Prepare usable for the next attempt.
prepare(); pending.shift().reject(new Error('encoding failed')); await flush();
assert.match(elements.get('exportStatus').textContent, /encoding failed/);
assert.equal(button.disabled, false);
prepare(); ready(); await flush();
assert.equal(elements.get('pngReady').hidden, false);
assert.equal(elements.get('pngDownload').href, 'blob:test-4');
console.log('Mobile PNG lifecycle passed: repeat exports, retained links, stale encoding, retry.');
