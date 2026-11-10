// PROPORTION PIECE — source-anchored pigment sculpture.
import * as THREE from 'three';

const PHI = (1 + Math.sqrt(5)) / 2;
const TAU = Math.PI * 2;
const FRAME_WIDTH = 1.34;
const FRAME_HEIGHT = 1.88;

/**
 * One source pigment cell becomes a curved, fully enclosed piece of a 3D skin.
 * The visible front remains at EXACTLY its archived X/Y position and UV.
 * The sides taper and twist to a φ-governed back; this is not a flat image card.
 *
 * The four methods keep the same front painting, but use different backside
 * translations and underlying armatures. Empty paper is genuinely absent.
 * Every geometry edge exposed by negative space is a physical sidewall.
 */
export function buildCompositionShell(mask, paintTexture, method) {
  if (!mask || !paintTexture?.isTexture) return null;
  const {width, height, data} = mask;
  if (width < 2 || height < 2 || !data || data.length < width * height * 4)
    throw new Error('The composition shell requires a masked archived painting');
  const threshold = 6; // retain fine strokes after downsampling the transparent paint
  const occupied = new Uint8Array(width * height);
  let paintedCells = 0;
  for (let i = 0; i < width * height; i++) {
    const alpha = data[i * 4 + 3];
    if (alpha >= threshold) {occupied[i] = 1; paintedCells++;}
  }
  if (paintedCells < 4) return null;
  const vertices = [], uvs = [], colours = [], frontIndices = [], sideIndices = [];
  const at = (c, r) => occupied[r * width + c] === 1;
  const front = (x, y, c, r) => {
    const f = .72 + .105 * Math.sin(x * 2.1 * PHI + y * 1.6)
      + .092 * Math.cos(y * 2.7 * PHI - x)
      + .047 * Math.sin((c / width + r / height) * TAU * PHI);
    return [x, y, f];
  };
  const back = (x, y, c, r) => {
    const t = y / FRAME_HEIGHT + .5;
    const turn = t * TAU / PHI + (c / width) * Math.PI / PHI;
    const modes = {
      petal: [.71, .115, .74],
      ribbon: [.56, .205, .83],
      pigment: [.43, .165, .96],
      hybrid: [.59, .185, .88]
    };
    const [shrink, twist, depth] = modes[method] || modes.hybrid;
    const xx = shrink * x + twist * Math.sin(turn);
    const yy = y * (.84 + .08 / PHI) + .09 * Math.sin(turn / PHI + x);
    const zz = -depth + .095 * Math.cos(turn * PHI);
    return [xx, yy, zz];
  };
  // Emitted UVs map the original painting pixel positions to physical XYZ.
  // CSS/image-space top corresponds to THREE's v=1 texture convention.
  const append = (point, u, v, colour) => {
    vertices.push(point[0], point[1], point[2]);
    uvs.push(u, v);
    colours.push(colour.r, colour.g, colour.b);
  };
  for (let r = 0; r < height; r++) for (let c = 0; c < width; c++) {
    if (!at(c, r)) continue;
    const u0 = c / width, u1 = (c + 1) / width;
    const v0 = 1 - r / height, v1 = 1 - (r + 1) / height;
    const x0 = (u0 - .5) * FRAME_WIDTH;
    const x1 = (u1 - .5) * FRAME_WIDTH;
    const y0 = (v0 - .5) * FRAME_HEIGHT;
    const y1 = (v1 - .5) * FRAME_HEIGHT;
    const corners = [
      [x0, y0, u0, v0, c, r],
      [x1, y0, u1, v0, c + 1, r],
      [x1, y1, u1, v1, c + 1, r + 1],
      [x0, y1, u0, v1, c, r + 1]
    ];
    const begin = vertices.length / 3;
    const k = (r * width + c) * 4;
    const colour = new THREE.Color().setRGB(
      data[k] / 255, data[k + 1] / 255, data[k + 2] / 255, THREE.SRGBColorSpace
    );
    for (const [x, y, u, v, col, row] of corners)
      append(front(x, y, col, row), u, v, colour);
    for (const [x, y, u, v, col, row] of corners)
      append(back(x, y, col, row), u, v, colour);
    // Front + rear: full 3D solid surfaces, correctly oriented toward ±Z.
    frontIndices.push(begin, begin + 2, begin + 1, begin, begin + 3, begin + 2);
    sideIndices.push(begin + 4, begin + 5, begin + 6, begin + 4, begin + 6, begin + 7);
    const edge = (a, b) => {
      const next = begin + a, after = begin + b, backA = begin + a + 4, backB = begin + b + 4;
      sideIndices.push(next, after, backB, next, backB, backA);
    };
    // Close all outer boundaries and pigment/paper holes; interior grid edges
    // do not form cross-walls.
    if (r === 0 || !at(c, r - 1)) edge(0, 1);
    if (c === width - 1 || !at(c + 1, r)) edge(1, 2);
    if (r === height - 1 || !at(c, r + 1)) edge(2, 3);
    if (c === 0 || !at(c - 1, r)) edge(3, 0);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  geometry.setIndex([...frontIndices, ...sideIndices]);
  // Only two draw calls: the front wears the actual painting; physically
  // sculpted sides/back get a *local* paint colour, not 1-pixel rainbow bands.
  geometry.addGroup(0, frontIndices.length, 0);
  geometry.addGroup(frontIndices.length, sideIndices.length, 1);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  const material = new THREE.MeshStandardMaterial({
    map: paintTexture,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 1,
    alphaTest: .025, // fine pigment marks must survive the physical mask
    roughness: .75,
    metalness: .02,
    emissive: '#4c4c4c',
    emissiveMap: paintTexture,
    emissiveIntensity: .30,
    depthWrite: true
  });
  material.userData.sculptureOwned = true;
  const bodyMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    roughness: .67,
    metalness: .05,
    transparent: true,
    opacity: 1
  });
  bodyMaterial.userData.sculptureOwned = true;
  const mesh = new THREE.Mesh(geometry, [material, bodyMaterial]);
  mesh.name = 'Archived painting in place — curved volumetric pigment islands';
  mesh.renderOrder = 5;
  mesh.userData = {
    sculptureOwned: true,
    compositionShell: true,
    sourceAnchored: true,
    paintedCells,
    frontXYError: 0,
    frontUVError: 0,
    depth: geometry.boundingBox.max.z - geometry.boundingBox.min.z,
    sourceWidth: width,
    sourceHeight: height
  };
  return mesh;
}

export function setCompositionShellBlend(group, strength) {
  if (!group) return;
  const opacity = Math.max(0, Math.min(1, Number(strength) || 0));
  group.traverse(child => {
    if (!child.userData.compositionShell) return;
    child.visible = opacity > .008;
    for (const material of Array.isArray(child.material) ? child.material : [child.material])
      material.opacity = Math.min(1, opacity * 1.3);
  });
}
