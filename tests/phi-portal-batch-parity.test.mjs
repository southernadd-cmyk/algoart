import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {batchPhiStaticArchitecture} from '../test/virtual-gallery/phi-static-architecture.mjs';

const EPS=0.000005;
const makeMesh=(w,h,d,x,y,z,material)=>{
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
 mesh.position.set(x,y,z);return mesh;
};
function pairs(geometry,transform=new THREE.Matrix4()){
 const pos=geometry.getAttribute('position');
 const nor=geometry.getAttribute('normal');
 const uv=geometry.getAttribute('uv');
 const normalMatrix=new THREE.Matrix3().getNormalMatrix(transform);
 const p=new THREE.Vector3(),n=new THREE.Vector3();
 return Array.from({length:pos.count},(_,i)=>{
  p.fromBufferAttribute(pos,i).applyMatrix4(transform);
  n.fromBufferAttribute(nor,i).applyMatrix3(normalMatrix);
  return [p.x,p.y,p.z,n.x,n.y,n.z,uv.getX(i),uv.getY(i)];
 });
}
test('portal surround batching preserves original coordinates/normals/UVs without touching materials',()=>{
 const material=new THREE.MeshStandardMaterial({color:'#917864',roughness:.66});
 const scene=new THREE.Scene();
 const sources=[
  makeMesh(.21,3.1,.17,1,2.5,4,material),
  makeMesh(.21,3.1,.17,1,2.5,5,material),
  makeMesh(.21,.23,1.42,1,4.1,4.5,material),
  makeMesh(.17,3.1,.21,5,2.5,6,material),
  makeMesh(1.42,.23,.21,5,4.1,6,material)
 ];
 sources.forEach(m=>scene.add(m));
 const expected=sources.flatMap(m=>{m.updateMatrix();return pairs(m.geometry,m.matrix);});
 const stats=batchPhiStaticArchitecture(THREE,scene,sources);
 assert.deepEqual(stats,{originalMeshes:5,batches:1,savedDrawCalls:4});
 assert.equal(scene.children.length,1);
 const merged=scene.children[0];
 assert.equal(merged.name,'phi-static-architecture-batch');
 assert.equal(merged.material,material);
 assert.equal(merged.geometry.getAttribute('uv').count,expected.length);
 const actual=pairs(merged.geometry);
 assert.equal(actual.length,expected.length);
 for(let i=0;i<actual.length;i++)for(let j=0;j<8;j++)
  assert.ok(Math.abs(actual[i][j]-expected[i][j])<EPS,'vertex '+i+' field '+j);
 assert.equal(merged.geometry.getIndex()?.count,5*36);
 merged.geometry.dispose();material.dispose();
});
test('unsupported transparency or unrelated material is not merged',()=>{
 const scene=new THREE.Scene();
 const clear=new THREE.MeshStandardMaterial({color:'#ffffff',transparent:true,opacity:.8});
 const stable=new THREE.MeshStandardMaterial({color:'#555555'});
 const items=[
  makeMesh(.1,1,.1,0,0,0,clear),
  makeMesh(.1,1,.1,1,0,0,clear),
  makeMesh(.1,1,.1,2,0,0,stable)
 ];
 items.forEach(m=>scene.add(m));
 const result=batchPhiStaticArchitecture(THREE,scene,items);
 assert.deepEqual(result,{originalMeshes:0,batches:0,savedDrawCalls:0});
 assert.equal(scene.children.length,3);
 for(const m of items)m.geometry.dispose();
 clear.dispose();stable.dispose();
});
