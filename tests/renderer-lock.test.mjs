// CI immutability guard: published V8 links must continue to render the
// same canvas operations, Reveal metadata, and SVG pen geometry.
// Compare the pinned V8 source and the proposed code in ONE Node runtime;
// absolute stored pixel hashes are not portable across JS/platform builds.
// The baseline ref is permanent. Do not move it when editing V8.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';

const PUBLISHED_V8_BASELINE = '395e473a826d7c481fde2e0198f753467332b04b';
const scripts = [
  'js/random.js', 'js/phi.js', 'js/palettes.js', 'js/marker.js', 'js/generator.js'
];

function baselineSources() {
  try {
    execFileSync('git', ['cat-file', '-e', PUBLISHED_V8_BASELINE + '^{commit}'], { stdio: 'pipe' });
  } catch {
    execFileSync('git', ['fetch', '--no-tags', '--depth=1', 'origin', PUBLISHED_V8_BASELINE], { stdio: 'pipe' });
  }
  return scripts.map(file =>
    execFileSync('git', ['show', PUBLISHED_V8_BASELINE + ':' + file], { encoding: 'utf8' }));
}
function engine(sources) {
  const sandbox = { window: { AlgoArt: {} } };
  scripts.forEach((file, i) =>
    runInNewContext(sources[i], sandbox, { filename: file }));
  return sandbox.window.AlgoArt;
}
function settings(mode, orientation, seed, preset) {
  const s = {
    mode, orientation, seed,
    elements: 25, density: 32, complexity: 71, negativeSpace: 82,
    phiStrength: 95, recursion: 4, spiralInfluence: 63, goldenAngle: 93,
    nesting: 44, pen: 'felt', thickness: 12, wobble: 18, overdraw: 1,
    opacity: 92, pressure: 25, dryness: 0, curveBias: 60,
    shapeAmount: 50, overlap: 40, rotation: 35, lines: true,
    circles: true, rectangles: true, polygons: true, arcs: true,
    palette: 'mono', colourCount: 1, saturation: 75, brightness: 50,
    paper: '#ffffff', grain: 0
  };
  if (preset === 1) Object.assign(s, {
    elements: 36, density: 67, complexity: 87, negativeSpace: 0,
    recursion: 5, nesting: 78, curveBias: 91, overdraw: 2,
    colourCount: 5, palette: 'earth', thickness: 5
  });
  if (preset === 2) Object.assign(s, {
    elements: 19, density: 85, complexity: 40, negativeSpace: 100,
    phiStrength: 38, goldenAngle: 24, rotation: 91, shapeAmount: 96,
    overdraw: 3, wobble: 51, dryness: 28, pen: 'fine',
    palette: 'mono', paper: '#f4f0e6'
  });
  return s;
}
function fingerprint(A, s) {
  let hash = 2166136261 >>> 0, operations = 0;
  function record(value) {
    for (const ch of JSON.stringify(value)) {
      hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619) >>> 0;
    }
    operations++;
  }
  const ctx = new Proxy({}, {
    get(obj, key) {
      if (!(key in obj)) obj[key] = (...args) => record([key, ...args]);
      return obj[key];
    },
    set(obj, key, value) { record([key, value]); obj[key] = value; return true; }
  });
  const canvas = { width: 0, height: 0, getContext: () => ctx };
  A.rendererVersion = 8;
  A.svgRecorder = { precise: true, paths: [], paperMarks: [] };
  const meta = A.render(canvas, s, 1, false);
  const snapshot = {
    canvas: { width: canvas.width, height: canvas.height, hash, operations },
    meta,
    vectors: A.svgRecorder.paths,
    paperMarks: A.svgRecorder.paperMarks
  };
  A.svgRecorder = null;
  return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}

const pinned = engine(baselineSources());
const proposed = engine(scripts.map(file => readFileSync(new URL('../' + file, import.meta.url), 'utf8')));
const modes = ['field', 'spiral', 'rects', 'burst', 'network', 'organic', 'geometric', 'scribble'];
let checked = 0;
for (const mode of modes) for (const orientation of ['landscape', 'portrait']) {
  for (let preset = 0; preset < 3; preset++) for (let index = 0; index < 3; index++) {
    const seed = 'PUBLISHED-V8-' + index + '-' + preset + '-' + mode;
    const state = settings(mode, orientation, seed, preset);
    assert.equal(
      fingerprint(proposed, state), fingerprint(pinned, state),
      'Published V8 changed: ' + mode + ' / ' + orientation +
      ' / preset ' + preset + ' / seed ' + seed +
      '. Publish changed marks under V9, and leave V8 untouched.'
    );
    checked++;
  }
}
assert.equal(checked, 144);
console.log('PASS: V8 renderer locked to ' + PUBLISHED_V8_BASELINE +
  '; 144 canvas/Reveal/SVG comparisons across eight engines and both orientations.');
