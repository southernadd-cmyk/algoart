// PROPORTION PIECE — sculpture laboratory v2.
// Generative sculptures in the round, not paintings extruded along Z.
// The archived painting is sampled for pigment colour, location and intensity;
// the existing baked source contours provide the ribbon topology.
// All angular placement and proportional hierarchy is reproducibly seed-driven.
// This module is laboratory-only; it does not modify production tower geometry.
import * as THREE from 'three';
import {estimatePaper, pigmentOpacity} from '../visit/paper-isolation.mjs';
import {buildCompositionShell, setCompositionShellBlend} from './source-composition.mjs';

export const PHI = (1 + Math.sqrt(5)) / 2;
export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // 137.507764°
export const METHODS = Object.freeze(['petal', 'ribbon', 'pigment', 'hybrid']);
const TAU = 2 * Math.PI;
const Y = new THREE.Vector3(0, 1, 0);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const rad = a => new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
const tang = a => new THREE.Vector3(Math.cos(a), 0, -Math.sin(a));

export function hashSeed(seed) {
  let h = 2166136261;
  for (const c of String(seed)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function seededRandom(seed) {
  let state = hashSeed(seed) || 1;
  return () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hex = (r, g, b) => '#' + [r, g, b].map(n => Math.round(n).toString(16).padStart(2, '0')).join('');

/**
 * Returns painting-derived, spatially distributed colour samples.
 * imageData is a small downsample of the archived JPEG, not a re-render of its seed.
 * Each eligible image tile contributes at most one sample, preventing a dark patch
 * from claiming all the sculpture's elements.
 */
export function extractPigmentSamples(imageData, {seed = '', material = 'marker', paper = '#f5f0e6', limit = 240} = {}) {
  const {width, height, data} = imageData;
  if (!width || !height || !data || data.length < width * height * 4)
    throw new Error('Missing painting pixels for sculpture study');
  const background = estimatePaper(imageData, paper);
  const nx = 15, ny = 22;
  const tiles = new Map();
  const rng = seededRandom(seed + ':pigment-extraction-v2');
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const k = 4 * (y * width + x);
    const r = data[k], g = data[k + 1], b = data[k + 2];
    const ink = pigmentOpacity(r, g, b, background, material);
    if (ink < .32) continue;
    const tileX = Math.min(nx - 1, Math.floor(x / width * nx));
    const tileY = Math.min(ny - 1, Math.floor(y / height * ny));
    const key = tileY * nx + tileX;
    const score = ink * (.85 + rng() * .3);
    if (!tiles.has(key) || score > tiles.get(key).score) {
      tiles.set(key, {
        x: (x + .5) / width - .5, y: .5 - (y + .5) / height,
        color: hex(r, g, b), opacity: ink, score,
        tileX, tileY
      });
    }
  }
  const candidates = [...tiles.values()].sort((a, b) => b.score - a.score);
  // Prefer visible pigment yet keep a good cross-section of the original sheet.
  const chosen = candidates.slice(0, limit);
  if (!chosen.length) throw new Error('Painting contains no distinguishable pigment');
  for (let i = chosen.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [chosen[i], chosen[j]] = [chosen[j], chosen[i]];
  }
  return chosen;
}

export function prepareSourceContours(entries, limit = 140) {
  if (!Array.isArray(entries)) return [];
  return entries.filter(e => Array.isArray(e?.points) && e.points.length >= 3 &&
      e.points.length <= 500 && e.points.every(p => Array.isArray(p) &&
      Number.isFinite(p[0]) && Number.isFinite(p[1])))
    .map(e => {
      let area = 0;
      for (let i = 0; i < e.points.length; i++) {
        const p = e.points[i], q = e.points[(i + 1) % e.points.length];
        area += p[0] * q[1] - q[0] * p[1];
      }
      return {...e, sourceArea: Math.abs(area / 2)};
    })
    .sort((a, b) => b.sourceArea - a.sourceArea).slice(0, limit);
}

// Preserve the 3D geometry and the local paint colour, then lay the original
// archived pigment over the physical surface. A cylindrical wrap lets the
// painting continue right round the back instead of appearing on one flat face.
// Paper alpha becomes blend strength, NOT mesh transparency.
export function applyPaintingTexture(group, texture, strength = .76) {
  if (!texture?.isTexture) return 0;
  let count = 0;
  group.traverse(mesh => {
    if (!mesh.isMesh || mesh.userData.paintable !== true) return;
    const material = mesh.material;
    if (!material?.isMeshStandardMaterial) return;
    const blend = {value: clamp(strength, 0, 1)};
    material.map = texture;
    material.userData.paintBlendUniform = blend;
    material.onBeforeCompile = shader => {
      shader.uniforms.ppPaintBlend = blend;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vPPPaintPosition;'
      ).replace(
        '#include <begin_vertex>',
        [
          '#include <begin_vertex>',
          'vPPPaintPosition = position;',
          '#ifdef USE_INSTANCING',
          'vPPPaintPosition = (instanceMatrix * vec4(position, 1.0)).xyz;',
          '#endif'
        ].join('\n')
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vPPPaintPosition;\nuniform float ppPaintBlend;'
      ).replace(
        '#include <map_fragment>', // no UV image-plane mapping; the projection is 360°
        ''
      ).replace(
        '#include <color_fragment>',
        [
          '#include <color_fragment>', // maintain per-instance pigment colours first
          '#ifdef USE_MAP',
          '// Project pigment to original painting X/Y; NEVER randomise its image-space location.',
          'vec2 ppUV = vec2(clamp(vPPPaintPosition.x / 1.34 + 0.5, 0.001, 0.999),',
          '  clamp(vPPPaintPosition.y / 1.88 + 0.5, 0.001, 0.999));',
          'vec4 ppSwatch = texture2D(map, ppUV);',
          'diffuseColor.rgb = mix(diffuseColor.rgb, ppSwatch.rgb,',
          '  clamp(ppSwatch.a * ppPaintBlend, 0.0, 1.0));',
          '#endif'
        ].join('\n')
      );
    };
    material.customProgramCacheKey = () => 'PP360-source-projected-v2';
    material.needsUpdate = true;
    count++;
  });
  group.userData.texturedMeshes = count;
  group.userData.textureBlend = clamp(strength, 0, 1);
  return count;
}

// Switching between painted and unpainted surfaces updates a uniform without
// re-baking the sculpture or re-compiling the shader.
export function updatePaintingStrength(group, strength) {
  if (!group) return;
  const next = clamp(Number(strength) || 0, 0, 1);
  group.traverse(obj => {
    const mat = obj.material;
    if (mat?.userData?.paintBlendUniform) mat.userData.paintBlendUniform.value = next;
  });
  group.userData.textureBlend = next;
  setCompositionShellBlend(group, next);
}

function ownedMaterial(color, opts = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color, metalness: .10, roughness: .57, side: THREE.DoubleSide, ...opts
  });
  mat.userData.sculptureOwned = true;
  return mat;
}

function appendStripFaces(indices, stride, count) {
  // Paired front/back layers of a strip have four vertices per length step:
  // front-left, front-right, back-left, back-right.
  for (let i = 0; i < count - 1; i++) {
    const a = stride * i, b = stride * (i + 1);
    const q = (x, y, z, w) => indices.push(x, y, z, x, z, w);
    q(a, a + 1, b + 1, b);           // front
    q(b + 2, b + 3, a + 3, a + 2); // back
    q(a + 2, a, b, b + 2);         // left edge
    q(a + 1, a + 3, b + 3, b + 1); // right edge
  }
  indices.push(0, 2, 3, 0, 3, 1);
  const end = stride * (count - 1);
  indices.push(end, end + 1, end + 3, end, end + 3, end + 2);
}

function meshFromVertices(vertices, indices, material) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, material);
}
function cylinderFromTo(a, b, radius, material, radialSegments = 6) {
  const d = new THREE.Vector3().subVectors(b, a);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, d.length(), radialSegments), material);
  mesh.position.copy(a).add(b).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(Y, d.normalize());
  return mesh;
}
function addGoldenSpine(group, samples, {height = 1.95, radius = .105, turns = PHI * .82} = {}) {
  const points = [];
  for (let i = 0; i <= 100; i++) {
    const u = i / 100, a = u * TAU * turns;
    const r = radius * (1 + .28 * Math.sin(u * Math.PI));
    points.push(new THREE.Vector3(Math.sin(a) * r, (u - .5) * height, Math.cos(a) * r));
  }
  const c = new THREE.CatmullRomCurve3(points);
  const body = new THREE.Mesh(new THREE.TubeGeometry(c, 105, .027, 6, false),
    ownedMaterial(samples[0]?.color || '#847d70', {roughness: .45, metalness: .23}));
  group.add(body);
}

/** Thick curved leaves radially arranged about the vertical axis. Both sides
 * are geometrically modelled; each leaf has closed ends and a solid edge. */
function petalGeometry({angle, baseY, length, width, thickness, arc}) {
  const vertices = [], indices = [], along = 12, across = 7;
  // Each small leaf section is constructed as a volumetric strip.
  // Continuously twisting local basis makes its lateral edge visible from
  // front, sides and back rather than an image plane on one axis.
  for (let i = 0; i < along; i++) {
    const u0 = i / (along - 1);
    for (let j = 0; j < across - 1; j++) {
      const coords = [];
      for (const [u, s] of [[u0, j / (across - 1) * 2 - 1],
          [u0, (j + 1) / (across - 1) * 2 - 1],
          [(i + 1) / (along - 1), (j + 1) / (across - 1) * 2 - 1],
          [(i + 1) / (along - 1), j / (across - 1) * 2 - 1]]) {
        const a = angle + arc * u + .17 * Math.sin(Math.PI * u);
        const envelope = Math.pow(Math.max(.003, Math.sin(Math.PI * (.015 + .97 * u))), .65);
        const r = .19 + length * (.30 + u * .46);
        const shell = rad(a), side = tang(a);
        const p = shell.multiplyScalar(r)
          .addScaledVector(side, s * width * envelope / 2)
          .addScaledVector(Y, baseY + length * (u - .27) +
            .06 * (1 - s * s) * Math.sin(Math.PI * u));
        coords.push({p, normal: rad(a).addScaledVector(side, .35 * s).normalize()});
      }
      const start = vertices.length / 3;
      for (const c of coords) {
        const off = c.normal.clone().multiplyScalar(thickness / 2);
        const front = c.p.clone().add(off), back = c.p.clone().sub(off);
        vertices.push(...front, ...back);
      }
      // The 4 corner pairs form a watertight, bevel-free wedge (8 vertices).
      const quads = [[0, 2, 4, 6], [7, 5, 3, 1], [1, 3, 2, 0],
        [3, 5, 4, 2], [5, 7, 6, 4], [7, 1, 0, 6]];
      for (const [a, b, c, d] of quads)
        indices.push(start + a, start + b, start + c, start + a, start + c, start + d);
    }
  }
  return meshFromVertices(vertices, indices, null).geometry;
}

function petals(data, group, {count = 50, scale = 1, stems = true} = {}) {
  const samples = data.samples;
  const n = Math.min(count, samples.length * 2);
  if (!n) return 0;
  const stemMaterial = ownedMaterial('#655a4c', {metalness: .22, roughness: .63});
  let produced = 0;
  for (let i = 0; i < n; i++) {
    const s = samples[Math.floor(i * samples.length / n) % samples.length];
    const angle = i * GOLDEN_ANGLE + s.x * .52;
    const level = i % 4, hierarchy = Math.pow(1 / PHI, level * .48);
    const length = (.43 + s.opacity * .44) * hierarchy * scale;
    const width = (.18 + .19 * hierarchy) * scale;
    const thickness = (.028 + s.opacity * .055) * hierarchy * scale;
    const baseY = clamp(s.y * 1.43, -.7, .67);
    const leaf = new THREE.Mesh(petalGeometry({
      angle, baseY, length, width, thickness,
      arc: (i % 2 ? -1 : 1) * GOLDEN_ANGLE / (PHI * 2.7)
    }), ownedMaterial(s.color, {roughness: .48 + .14 * (i % 3) / 3}));
    leaf.userData.sculptureAngle = i * GOLDEN_ANGLE;
    leaf.userData.paintable = true;
    group.add(leaf);
    if (stems && i % 3 === 0) {
      const end = rad(angle).multiplyScalar(.22).addScaledVector(Y, baseY - length * .2);
      const start = new THREE.Vector3(.06 * Math.sin(angle), baseY - .14, .06 * Math.cos(angle));
      group.add(cylinderFromTo(start, end, .0105 * scale, stemMaterial));
    }
    produced++;
  }
  if (stems) addGoldenSpine(group, samples);
  return produced;
}

function solidRibbonGeometry(curve, width, thickness, segments = 56) {
  const vertices = [], indices = [];
  for (let i = 0; i <= segments; i++) {
    const u = i / segments, center = curve.getPointAt(u);
    const direction = curve.getTangentAt(u).normalize();
    let radial = new THREE.Vector3(center.x, 0, center.z).normalize();
    if (radial.lengthSq() < .001) radial = new THREE.Vector3(0, 0, 1);
    let across = new THREE.Vector3().crossVectors(direction, radial).normalize();
    if (across.lengthSq() < .001) across = Y.clone();
    const taper = .52 + .48 * Math.pow(Math.sin(Math.PI * u), .4);
    const w = width * taper / 2, d = thickness / 2;
    const left = center.clone().addScaledVector(across, -w);
    const right = center.clone().addScaledVector(across, w);
    for (const p of [left.clone().addScaledVector(radial, d), right.clone().addScaledVector(radial, d),
      left.addScaledVector(radial, -d), right.addScaledVector(radial, -d)]) vertices.push(...p);
  }
  appendStripFaces(indices, 4, segments + 1);
  return meshFromVertices(vertices, indices, null).geometry;
}

/** Real 3D continuous bands. Source contour coordinates modulate radius,
 * height, turn and colour; source regions wrap around the full circumference. */
function ribbons(data, group, {count = 27, scale = 1, spine = true} = {}) {
  const traces = data.contours;
  if (!traces.length) return 0;
  const n = Math.min(count, traces.length);
  let built = 0;
  for (let i = 0; i < n; i++) {
    const entry = traces[Math.floor(i * traces.length / n)];
    const pts = entry.points;
    const nPts = Math.min(36, Math.max(8, pts.length));
    const controls = [];
    const start = i * GOLDEN_ANGLE;
    const turns = .84 + (i % 4) / PHI / 3;
    for (let j = 0; j < nPts; j++) {
      const u = j / (nPts - 1), p = pts[Math.floor(u * (pts.length - 1))];
      const a = start + u * TAU * turns + p[0] * .9;
      const r = (.36 + (p[0] / 1.34 + .5) * .28 +
        Math.sin(Math.PI * u) * .1) * scale;
      const y = clamp(p[1] * .83 + .13 * Math.sin(TAU * u + start) +
        (u - .5) * .22, -.92, .92) * scale;
      controls.push(new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r));
    }
    if (controls.length < 4) continue;
    const curve = new THREE.CatmullRomCurve3(controls, false, 'centripetal');
    const hierarchy = Math.pow(1 / PHI, (i % 4) * .31);
    const shape = solidRibbonGeometry(curve, (.075 + .10 * hierarchy) * scale,
      (.018 + .023 * hierarchy) * scale);
    const color = entry.color || entry.side || data.samples[i % data.samples.length]?.color || '#716b60';
    const mesh = new THREE.Mesh(shape, ownedMaterial(color, {roughness: .49, metalness: .13}));
    mesh.userData.sculptureAngle = start;
    mesh.userData.paintable = true;
    group.add(mesh);built++;
  }
  if (spine) addGoldenSpine(group, data.samples, {radius: .13, turns: PHI});
  return built;
}

/** Painting-pigment volumes: colour is taken directly from real pixels.
 * Instances occupy nested φ-scaled radial shells with golden-angle azimuth.
 * This uses volumetric, coloured icosahedra, not cards/planes or voxel tiles. */
function pigment(data, group, {count = 175, scale = 1, connective = true} = {}) {
  const samples = data.samples;
  const n = Math.min(count, samples.length);
  if (!n) return 0;
  const geometry = new THREE.IcosahedronGeometry(1, 1);
  const material = ownedMaterial('#ffffff', {roughness: .63, metalness: .06, flatShading: true});
  const mesh = new THREE.InstancedMesh(geometry, material, n);
  mesh.name = 'Painting-derived coloured 3D pigment volumes';
  mesh.userData.paintable = true;
  const dummy = new THREE.Object3D(), c = new THREE.Color();
  const positions = [];
  for (let i = 0; i < n; i++) {
    const s = samples[Math.floor(i * samples.length / n)];
    const a = i * GOLDEN_ANGLE + s.x * .61;
    const shell = [1, 1 / PHI, 1 / (PHI * PHI)][i % 3];
    const radius = (.24 + shell * .56 + Math.abs(s.x) * .17) * scale;
    const height = clamp(s.y * 1.71 + Math.sin(a * PHI) * .08, -.92, .92) * scale;
    const pos = new THREE.Vector3(Math.sin(a) * radius, height, Math.cos(a) * radius);
    const size = (.076 + .096 * s.opacity) * (i % 5 ? 1 : PHI) * scale;
    dummy.position.copy(pos);
    dummy.rotation.set(a / PHI, i * GOLDEN_ANGLE / PHI, a);
    dummy.scale.set(size * (.8 + shell * .5), size * (1.25 + .3 * s.opacity),
      size * (1.05 + .25 * (i % 3)));
    dummy.updateMatrix();mesh.setMatrixAt(i, dummy.matrix);
    c.set(s.color);mesh.setColorAt(i, c);
    positions.push(pos);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;
  mesh.userData.sculptureOwned = true;
  group.add(mesh);
  if (connective) {
    const linkMaterial = ownedMaterial('#605c52', {transparent: true, opacity: .65, metalness: .23});
    for (let i = 2; i < positions.length; i += 6) {
      // Link discrete clusters to an internal structural armature.
      const p = positions[i];
      const inside = p.clone().multiply(new THREE.Vector3(.25, 1, .25));
      group.add(cylinderFromTo(inside, p, .009 * scale, linkMaterial, 5));
    }
    addGoldenSpine(group, samples, {height: 1.72 * scale, radius: .09 * scale});
  }
  return n;
}

/** Deliberate 60/25/15 visual hierarchy: petal silhouette, flowing line and
 * smaller pigment accents. This is not a stack of three full-density copies. */
function hybrid(data, group) {
  const petalGroup = new THREE.Group(), ribbonGroup = new THREE.Group(), pigmentGroup = new THREE.Group();
  petalGroup.name = 'Petal armature (dominant)';
  ribbonGroup.name = 'Ribbon connections (secondary)';
  pigmentGroup.name = 'Pigment accents (tertiary)';
  group.add(petalGroup, ribbonGroup, pigmentGroup);
  const p = petals(data, petalGroup, {count: 28, scale: .94, stems: true});
  const r = ribbons(data, ribbonGroup, {count: 13, scale: 1.05, spine: false});
  const c = pigment(data, pigmentGroup, {count: 55, scale: .72, connective: false});
  return {petals: p, ribbons: r, pigment: c};
}

export function buildSculpture(method, data) {
  if (!METHODS.includes(method)) throw new Error('Unknown 3D sculpture method: ' + method);
  if (!data || !Array.isArray(data.samples) || !data.samples.length)
    throw new Error('A sculpture needs sampled source painting pigment');
  if (!Array.isArray(data.contours)) data = {...data, contours: []};
  const group = new THREE.Group();
  group.name = 'PROPORTION PIECE 360° / ' + method;
  let result;
  if (method === 'petal') result = {petals: petals(data, group)};
  if (method === 'ribbon') result = {ribbons: ribbons(data, group)};
  if (method === 'pigment') result = {pigment: pigment(data, group)};
  if (method === 'hybrid') result = hybrid(data, group);
  group.userData.method = method;
  group.userData.elementCounts = result;
  group.userData.sculptureVersion = 3;
  if (data.paintTexture) {
    // The original generators create genuine rear, side and inner volumes.
    // Move the former all-around elements BEHIND the source-facing skin,
    // without changing their individual geometry, scale or orientation.
    const backing = new THREE.Group();
    backing.name = method + ' — phi-governed three-dimensional rear';
    for (const child of [...group.children]) backing.add(child);
    backing.position.z = -1.13;
    group.add(backing);
    applyPaintingTexture(group, data.paintTexture, data.paintStrength ?? .76);
    // The physical pigment islands preserve the original painting's exact
    // X/Y placement and texture UV on the front, while their tapered back is
    // different in each of the four methods.
    const shell = buildCompositionShell(data.paintMask, data.paintTexture, method);
    if (shell) {
      group.add(shell);
      group.userData.compositionShells = 1;
      group.userData.sourceAnchored = true;
      group.userData.anchorCells = shell.userData.paintedCells;
      group.userData.frontXYError = shell.userData.frontXYError;
      setCompositionShellBlend(group, data.paintStrength ?? .76);
    }
  }
  return group;
}

export function disposeSculpture(group) {
  if (!group) return;
  const geometries = new Set(), materials = new Set();
  group.traverse(obj => {
    if (obj.geometry) geometries.add(obj.geometry);
    for (const mat of obj.material ? (Array.isArray(obj.material) ? obj.material : [obj.material]) : [])
      if (mat.userData?.sculptureOwned) materials.add(mat);
  });
  group.clear();
  geometries.forEach(geo => geo.dispose());
  materials.forEach(mat => mat.dispose());
}
