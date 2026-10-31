// Batch the static box components of archived tower floors into a few
// geometries, one per material. Unlike InstancedMesh with a unit cube, this
// preserves the exact metre-based UVs of each original BoxGeometry, so brick
// and stone textures retain their desktop appearance.
export function appendTowerBoxBatches(THREE, parent, buckets) {
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const basePosition = cube.getAttribute('position');
  const baseNormal = cube.getAttribute('normal');
  const baseUv = cube.getAttribute('uv');
  const baseIndex = cube.getIndex();
  let totalBoxes = 0;
  let batchCount = 0;
  for (const [material, boxes] of buckets) {
    if (!boxes.length) continue;
    const verticesPerBox = basePosition.count;
    const indicesPerBox = baseIndex.count;
    const totalVertices = boxes.length * verticesPerBox;
    const positions = new Float32Array(totalVertices * 3);
    const normals = new Float32Array(totalVertices * 3);
    const uvs = new Float32Array(totalVertices * 2);
    const indices = totalVertices > 65535
      ? new Uint32Array(boxes.length * indicesPerBox)
      : new Uint16Array(boxes.length * indicesPerBox);
    const tile = material.userData?.tileMeters;
    for (let i = 0; i < boxes.length; i++) {
      const [w, h, d, x, y, z] = boxes[i];
      const offset = i * verticesPerBox;
      // Optional world-space yaw for golden-angle archival floors. Existing
      // seven-coordinate callers remain unchanged (rotation defaults to zero).
      const yaw = boxes[i][6] || 0;
      const cs = Math.cos(yaw), sn = Math.sin(yaw);
      const texU = [d, d, w, w, w, w];
      const texV = [h, h, d, d, h, h];
      for (let v = 0; v < verticesPerBox; v++) {
        const p = (offset + v) * 3;
        const uv = (offset + v) * 2;
        const face = Math.floor(v / 4);
        const px = basePosition.getX(v) * w;
        const pz = basePosition.getZ(v) * d;
        const nx = baseNormal.getX(v), nz = baseNormal.getZ(v);
        positions[p] = x + px * cs + pz * sn;
        positions[p + 1] = y + basePosition.getY(v) * h;
        positions[p + 2] = z - px * sn + pz * cs;
        normals[p] = nx * cs + nz * sn;
        normals[p + 1] = baseNormal.getY(v);
        normals[p + 2] = -nx * sn + nz * cs;
        uvs[uv] = baseUv.getX(v) * (tile ? Math.max(.001, texU[face] / tile) : 1);
        uvs[uv + 1] = baseUv.getY(v) * (tile ? Math.max(.001, texV[face] / tile) : 1);
      }
      for (let j = 0; j < indicesPerBox; j++)
        indices[i * indicesPerBox + j] = offset + baseIndex.getX(j);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'archived-tower-static-batch';
    parent.add(mesh);
    totalBoxes += boxes.length;
    batchCount++;
  }
  cube.dispose();
  parent.userData.archivedTowerBatchStats = { totalBoxes, batchCount };
  return { totalBoxes, batchCount };
}
