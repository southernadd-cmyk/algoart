import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSelfContainedGLB, fitModelToPlinth, disposeAIModel} from '../gallery/sculpture-lab/ai-glb.mjs';
import {testCubeGLB} from './fixtures/sculpture-ai-cube-glb.mjs';
import * as THREE from 'three';

test('accepts standalone GLB geometry (not simulated extrusions)', () => {
  const bytes = testCubeGLB();
  const m = validateSelfContainedGLB(bytes);
  assert.equal(m.meshes, 1);
  assert.match(m.generator, /TEST FIXTURE/);
  assert.ok(m.bytes > 200);
});

test('rejects malformed and externally linked GLBs', () => {
  const bytes = testCubeGLB();
  assert.throws(() => validateSelfContainedGLB(bytes.slice(0, 12)), /45 MB|Choose/);
  assert.throws(() => validateSelfContainedGLB(new Uint8Array(100)), /Not a valid/);
  assert.throws(() => validateSelfContainedGLB(testCubeGLB({externalImage: true})), /embed all textures/);
});

test('fits an independent 3D mesh to a plinth without flattening any axis', () => {
  const model = new THREE.Group();
  const cube = new THREE.Mesh(new THREE.BoxGeometry(3, 5, 3),
    new THREE.MeshStandardMaterial());
  model.add(cube);
  const size = fitModelToPlinth(model);
  const result = new THREE.Box3().setFromObject(model);
  assert.ok(size.x > .1 && size.y > .1 && size.z > .1);
  assert.ok(result.getSize(new THREE.Vector3()).x <= 1.501);
  assert.ok(result.getSize(new THREE.Vector3()).z <= 1.351);
  assert.ok(Math.abs(result.min.y - -.99) < 1e-4);
  disposeAIModel(model);
  assert.equal(model.parent, null);
});
