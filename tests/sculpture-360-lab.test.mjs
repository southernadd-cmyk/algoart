import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  PHI, GOLDEN_ANGLE, METHODS, hashSeed, extractPigmentSamples, prepareSourceContours,
  buildSculpture, disposeSculpture
} from '../gallery/sculpture-lab/sculpture-360.mjs';

const W = 90, H = 126;
function painting() {
  const data = new Uint8ClampedArray(W * H * 4);
  const colours = [[190, 43, 35], [26, 103, 127], [48, 113, 70], [175, 107, 31]];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = 4 * (y * W + x);
    let colour = [245, 240, 230];
    const a = Math.sin(x * .28) * 11 + x;
    if (y > 10 && y < 110 && Math.abs(a - 31 - (y % 27) * .4) < 8)
      colour = colours[0];
    else if ((x - 53) ** 2 / 230 + (y - 50) ** 2 / 600 < 1)
      colour = colours[1];
    else if (x > 15 && x < 73 && y > 87 && y < 107)
      colour = colours[2];
    else if (x > 52 && x < 80 && y > 7 && y < 22)
      colour = colours[3];
    data.set([...colour, 255], p);
  }
  return {width: W, height: H, data};
}
const entries = [
  {points: [[-.54, -.69],[-.3, -.61],[-.2, .32],[-.4, .44]], color: '#be2b23', side: '#982b23', kind: 'ink', depth: .07, z: .03},
  {points: [[.07, -.40],[.44, -.2],[.58, .35],[.08, .52]], color: '#1a677f', side: '#12556b', kind: 'paint', depth: .17, z: -.05},
  {points: [[-.37, -.78],[.34, -.74],[.45, -.63],[-.21, -.57]], color: '#307146', side: '#235737', kind: 'paint', depth: .07, z: .04}
];
const study = {
  samples: extractPigmentSamples(painting(), {seed: 'PP-sculpture-test', material: 'oil'}),
  contours: prepareSourceContours(entries),
  seed: 'PP-sculpture-test'
};

test('φ and the golden angle are correctly represented', () => {
  assert.ok(Math.abs(PHI - 1.618033988749895) < 1e-12);
  assert.ok(Math.abs(GOLDEN_ANGLE * 180 / Math.PI - 137.50776405) < 1e-6);
  assert.equal(new Set(METHODS).size, 4);
});
test('pigment data is taken from source pixels and remains deterministic', () => {
  assert.ok(study.samples.length >= 30);
  assert.ok(study.samples.some(s => s.color === '#be2b23'));
  assert.ok(study.samples.some(s => s.color === '#1a677f'));
  assert.deepEqual(study.samples,
    extractPigmentSamples(painting(), {seed: 'PP-sculpture-test', material: 'oil'}));
  assert.notEqual(hashSeed('A'), hashSeed('B'));
  assert.ok(study.samples.every(s => Math.abs(s.x) <= .5 && Math.abs(s.y) <= .5));
});
for (const method of METHODS) {
  test(method + ' produces genuinely three-dimensional geometry', () => {
    const object = buildSculpture(method, study);
    let meshes = 0, triangles = 0;
    object.traverse(child => {
      if (child.isMesh) {
        meshes++;
        const count = child.geometry?.index?.count ?? child.geometry?.attributes?.position?.count ?? 0;
        triangles += Math.floor(count / 3);
      }
    });
    const size = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
    assert.ok(meshes > 1, method + ' must build multiple spatial components');
    assert.ok(triangles > 100, method + ' must generate geometric surfaces');
    assert.ok(size.x > .34 && size.y > .55 && size.z > .34,
      method + ' must occupy meaningful XYZ volume: ' + size.toArray());
    assert.equal(object.userData.method, method);
    assert.equal(object.userData.sculptureVersion, 2);
    if (method === 'hybrid') {
      for (const key of ['petals', 'ribbons', 'pigment'])
        assert.ok(object.userData.elementCounts[key] > 0);
    }
    disposeSculpture(object);
    assert.equal(object.children.length, 0);
  });
}
test('source contour preparation rejects malformed polygons', () => {
  const traced = prepareSourceContours([...entries, {points: [[0, 0], [1, 1], [NaN, 1]]}]);
  assert.equal(traced.length, 3);
  assert.ok(traced.every(x => x.sourceArea > 0));
});
