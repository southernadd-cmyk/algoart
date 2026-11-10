// Minimal self-contained box for testing the real GLB import pipeline.
// This is a TEST FIXTURE, never a generated sculpture shown as a Meshy output.
import * as THREE from 'three';

export function testCubeGLB({externalImage = false} = {}) {
  const geometry = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
  const floats = geometry.getAttribute('position').array;
  const binary = new Uint8Array(floats.buffer.slice(floats.byteOffset, floats.byteOffset + floats.byteLength));
  geometry.dispose();
  const manifest = {
    asset: {version: '2.0', generator: 'PROPORTION PIECE TEST FIXTURE'},
    scene: 0,
    scenes: [{nodes: [0]}],
    nodes: [{mesh: 0}],
    meshes: [{primitives: [{attributes: {POSITION: 0}, material: 0}]}],
    materials: [{pbrMetallicRoughness: {baseColorFactor: [.2, .7, .65, 1], metallicFactor: 0, roughnessFactor: .65}}],
    buffers: [{byteLength: binary.byteLength}],
    bufferViews: [{buffer: 0, byteOffset: 0, byteLength: binary.byteLength, target: 34962}],
    accessors: [{bufferView: 0, componentType: 5126, count: floats.length / 3,
      type: 'VEC3', min: [-.5, -.5, -.5], max: [.5, .5, .5]}]
  };
  if (externalImage) manifest.images = [{uri: 'https://example.com/external.jpg'}];
  const json = new TextEncoder().encode(JSON.stringify(manifest));
  const jsonLen = Math.ceil(json.byteLength / 4) * 4;
  const binLen = Math.ceil(binary.byteLength / 4) * 4;
  const length = 12 + 8 + jsonLen + 8 + binLen;
  const output = new Uint8Array(length);
  const view = new DataView(output.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, length, true);
  view.setUint32(12, jsonLen, true);
  view.setUint32(16, 0x4e4f534a, true);
  output.fill(0x20, 20, 20 + jsonLen);
  output.set(json, 20);
  const binaryHead = 20 + jsonLen;
  view.setUint32(binaryHead, binLen, true);
  view.setUint32(binaryHead + 4, 0x004e4942, true);
  output.set(binary, binaryHead + 8);
  return output;
}
