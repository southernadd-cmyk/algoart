import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildCompositionShell, setCompositionShellBlend} from '../gallery/sculpture-lab/source-composition.mjs';
import {
  PHI, GOLDEN_ANGLE, METHODS, hashSeed, extractPigmentSamples, prepareSourceContours,
  buildSculpture, disposeSculpture, applyPaintingTexture, updatePaintingStrength
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
    assert.equal(object.userData.sculptureVersion, 3);
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

test('archived painting wraps all three generators and the hybrid without flattening meshes', () => {
  const texture = new THREE.Texture();
  const results = [];
  for (const method of METHODS) {
    const object = buildSculpture(method, {...study, paintTexture: texture, paintStrength: .73});
    assert.ok(object.userData.texturedMeshes > 0, method + ' has no painted surfaces');
    const painted = [];
    object.traverse(mesh => {
      if (mesh.userData.paintable) {
        assert.ok(mesh.material.map === texture, 'Archived texture not attached');
        assert.ok(mesh.material.userData.paintBlendUniform);
        painted.push(mesh.material);
      }
    });
    assert.ok(painted.length > 0);
    const mat = painted[0];
    const shader = {
      uniforms: {},
      vertexShader: '#include <common>\n#include <begin_vertex>',
      fragmentShader: '#include <common>\n#include <map_fragment>\n#include <color_fragment>'
    };
    mat.onBeforeCompile(shader);
    assert.match(shader.vertexShader, /vPPPaintPosition = position/);
    assert.match(shader.vertexShader, /instanceMatrix/);
    assert.match(shader.fragmentShader, /vPPPaintPosition.x \/ 1\.34/);
    assert.match(shader.fragmentShader, /diffuseColor.rgb = mix/);
    assert.ok(!shader.fragmentShader.includes('#include <map_fragment>'));
    assert.strictEqual(shader.uniforms.ppPaintBlend, mat.userData.paintBlendUniform);
    updatePaintingStrength(object, 0);
    assert.equal(mat.userData.paintBlendUniform.value, 0, 'plain colour toggle');
    updatePaintingStrength(object, .92);
    assert.equal(mat.userData.paintBlendUniform.value, .92, 'real-time painting intensity');
    assert.ok(object.userData.textureBlend === .92);
    results.push(object.userData.texturedMeshes);
    disposeSculpture(object);
  }
  assert.equal(results.length, 4);
  texture.dispose();
});


function sampleMaskedPainting() {
  const image = painting();
  for (let i = 0; i < W * H; i++) {
    const k = i * 4;
    const isPaper = image.data[k] === 245 && image.data[k + 1] === 240 && image.data[k + 2] === 230;
    image.data[k + 3] = isPaper ? 0 : 255;
  }
  return image;
}
test('every 3D method preserves the original painting location at each front-surface vertex', () => {
  const mask = sampleMaskedPainting();
  const paintingTexture = new THREE.Texture();
  const expected = mask.data.reduce((n, b, i) => n + (i % 4 === 3 && b >= 6 ? 1 : 0), 0);
  for (const method of METHODS) {
    const shell = buildCompositionShell(mask, paintingTexture, method);
    assert.ok(shell, method + ': no composition geometry');
    assert.equal(shell.userData.paintedCells, expected);
    assert.ok(expected < mask.width * mask.height, 'paper must be empty space');
    assert.ok(shell.userData.depth > 1, 'sculpture needs an actual back and depth');
    assert.equal(shell.material[0].map, paintingTexture);
    const positions = shell.geometry.attributes.position;
    const texcoords = shell.geometry.attributes.uv;
    for (let cell = 0; cell < expected; cell++) {
      for (let corner = 0; corner < 4; corner++) {
        const ix = cell * 8 + corner;
        const x = positions.getX(ix), y = positions.getY(ix);
        const u = texcoords.getX(ix), v = texcoords.getY(ix);
        assert.ok(Math.abs(x - (u - .5) * 1.34) < 2e-6,
          method + ' lost the source horizontal composition');
        assert.ok(Math.abs(y - (v - .5) * 1.88) < 2e-6,
          method + ' lost the source vertical composition');
        assert.ok(positions.getZ(ix) > .45,
          method + ' has no sculpted front surface');
      }
      for (let corner = 4; corner < 8; corner++) {
        assert.ok(positions.getZ(cell * 8 + corner) < -.5,
          method + ' has no physically developed backside');
      }
    }
    const originalBack = shell.geometry.attributes.position.getX(4);
    assert.notEqual(originalBack, shell.geometry.attributes.position.getX(0),
      method + ' should taper/twist the back, not extrude the original');
    const root = new THREE.Group();
    root.add(shell);
    setCompositionShellBlend(root, 0);
    assert.equal(shell.visible, false, 'plain mode must hide the source painting skin');
    setCompositionShellBlend(root, .76);
    assert.equal(shell.visible, true);
    assert.ok(shell.material[0].opacity >= .98);
    root.remove(shell);
    shell.material.forEach(material => material.dispose());
    shell.geometry.dispose();
  }
  paintingTexture.dispose();
});

test('source-anchored sculpture has a real sculpted back but no distracting free-form geometry from the front', () => {
  const texture = new THREE.Texture();
  const data = {...study, paintTexture: texture, paintMask: sampleMaskedPainting(), paintStrength: .76};
  for (const method of METHODS) {
    const group = buildSculpture(method, data);
    assert.equal(group.userData.sourceAnchored, true);
    assert.equal(group.userData.structuralBacking.visible, false);
    const shell = group.children.find(c => c.userData.compositionShell);
    assert.ok(shell, method + ': no source paint body');
    assert.ok(shell.geometry.boundingBox.max.z - shell.geometry.boundingBox.min.z > 1);
    updatePaintingStrength(group, 0);
    assert.equal(shell.visible, false);
    assert.equal(group.userData.structuralBacking.visible, true);
    updatePaintingStrength(group, .92);
    assert.equal(shell.visible, true);
    assert.equal(group.userData.structuralBacking.visible, false);
    disposeSculpture(group);
  }
  texture.dispose();
});
