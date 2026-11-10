// AI sculpture comparison — genuine GLB mesh ingestion for generated 3D assets.
// Meshy / Tripo / Hunyuan output is loaded as independent *3D geometry*.
// No image-derived extrusion, painted cards, or source-as-UV fakes.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const MAX_BYTES = 45 * 1024 * 1024;

export function validateSelfContainedGLB(bytes) {
  const data = bytes instanceof Uint8Array ? bytes :
    bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : null;
  if (!data || data.byteLength < 20 || data.byteLength > MAX_BYTES)
    throw new Error('Choose a .glb file below 45 MB');
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67 ||
      view.getUint32(4, true) !== 2 ||
      view.getUint32(8, true) !== data.byteLength)
    throw new Error('Not a valid GLB 2.0 file');
  const jsonLength = view.getUint32(12, true);
  if (view.getUint32(16, true) !== 0x4e4f534a ||
      jsonLength < 2 || 20 + jsonLength > data.byteLength)
    throw new Error('Corrupt GLB JSON chunk');
  let doc;
  try {
    doc = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(
      data.subarray(20, 20 + jsonLength)).replace(/\0+$/, '').trim());
  } catch {throw new Error('Invalid GLB metadata');}
  if (!Array.isArray(doc.meshes) || !doc.meshes.length)
    throw new Error('GLB contains no polygon mesh');
  // This is a standalone viewer; reject broken or external dependencies rather
  // than silently fetching URLs from untrusted GLB material files.
  for (const value of [...(doc.buffers || []), ...(doc.images || [])]) {
    if (value.uri && !/^data:(?:application\/octet-stream|image\/(?:png|jpeg|webp));base64,/i.test(value.uri))
      throw new Error('GLB must embed all textures and geometry; external files are unsupported');
  }
  return {meshes: doc.meshes.length, materials: doc.materials?.length || 0,
    bytes: data.byteLength, generator: doc.asset?.generator || 'unknown'};
}

export async function parseAIModel(buffer) {
  const metadata = validateSelfContainedGLB(buffer);
  const loader = new GLTFLoader();
  const gltf = await loader.parseAsync(buffer, '');
  const root = gltf.scene;
  if (!root) throw new Error('GLB has no rendered scene');
  let count = 0;
  root.traverse(x => {if (x.isMesh) count++;});
  if (!count) throw new Error('GLB has no visible 3D meshes');
  root.userData.aiGeneratedModel = true;
  root.userData.aiSource = metadata;
  return root;
}

export function fitModelToPlinth(root, {
  width = 1.5, height = 1.92, depth = 1.35, floor = -.99
} = {}) {
  root.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) throw new Error('Generated model has no visible geometry');
  const dim = box.getSize(new THREE.Vector3());
  if (![dim.x, dim.y, dim.z].every(Number.isFinite) ||
      Math.max(dim.x, dim.y, dim.z) <= 1e-7)
    throw new Error('Invalid generated model dimensions');
  const scale = Math.min(width / Math.max(dim.x, 1e-6),
    height / Math.max(dim.y, 1e-6), depth / Math.max(dim.z, 1e-6));
  root.scale.multiplyScalar(scale);
  root.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(root);
  const centre = box.getCenter(new THREE.Vector3());
  root.position.x -= centre.x;
  root.position.z -= centre.z;
  root.position.y += floor - box.min.y;
  root.updateMatrixWorld(true);
  return box.getSize(new THREE.Vector3());
}

export function disposeAIModel(root) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  root?.traverse(x => {
    if (x.geometry) geometries.add(x.geometry);
    const used = Array.isArray(x.material) ? x.material : x.material ? [x.material] : [];
    for (const material of used) {
      materials.add(material);
      for (const value of Object.values(material))
        if (value?.isTexture) textures.add(value);
    }
  });
  root?.removeFromParent();
  geometries.forEach(x => x.dispose());
  materials.forEach(x => x.dispose());
  textures.forEach(x => x.dispose());
}
