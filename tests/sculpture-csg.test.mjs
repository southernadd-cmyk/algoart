import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import jscad from '@jscad/modeling';
import {selectCSGMarks,buildJSCADSculpture,disposeJSCADSculpture}
  from '../gallery/sculpture-lab/sculpture-csg.mjs';

const marks=[
  {x:-.47,y:.52,span:.26,breadth:.13,color:'#ab3228',mass:28,kind:'stroke'},
  {x:-.36,y:.38,span:.14,breadth:.11,color:'#b43b21',mass:15,kind:'stroke'},
  {x:-.11,y:.66,span:.17,breadth:.18,color:'#a92618',mass:19,kind:'spot'},
  {x:.21,y:.40,span:.20,breadth:.19,color:'#3561a2',mass:20,kind:'field'},
  {x:.38,y:.49,span:.24,breadth:.12,color:'#2f6ba9',mass:24,kind:'stroke'},
  {x:.43,y:.05,span:.16,breadth:.10,color:'#2184b0',mass:13,kind:'spot'},
  {x:-.30,y:-.19,span:.18,breadth:.15,color:'#76993e',mass:17,kind:'field'},
  {x:-.42,y:-.47,span:.12,breadth:.17,color:'#618a38',mass:14,kind:'spot'},
  {x:.09,y:-.44,span:.31,breadth:.12,color:'#aa6734',mass:27,kind:'stroke'},
  {x:.34,y:-.62,span:.19,breadth:.16,color:'#bd563d',mass:16,kind:'field'},
  {x:-.16,y:-.69,span:.20,breadth:.13,color:'#6f5631',mass:12,kind:'stroke'},
  {x:.00,y:-.04,span:.13,breadth:.14,color:'#584d43',mass:12,kind:'spot'}
];
test('feature selection preserves original XY, colour and multiple regions',()=>{
  const chosen=selectCSGMarks(marks,10);
  assert.equal(chosen.length,10);
  assert.ok(chosen.some(m=>m.color==='#ab3228'));
  assert.ok(chosen.some(m=>m.color==='#bd563d'));
  assert.ok(chosen.every(m=>marks.includes(m)));
  assert.deepEqual(chosen,selectCSGMarks(marks,10));
});
for(const method of ['petal','ribbon','pigment','hybrid']){
  test('JSCAD '+method+' uses hull/union solids with genuine XYZ depth',()=>{
    const sculpture=buildJSCADSculpture(method,marks,jscad,{depth:.9});
    assert.equal(sculpture.userData.engine,'jscad-csg-v1');
    assert.equal(sculpture.userData.noImageExtrusion,true);
    assert.equal(sculpture.userData.noModelInference,true);
    assert.ok(sculpture.userData.csgFragments>=2);
    assert.ok(sculpture.userData.inputVolume>.005);
    assert.ok(sculpture.userData.csgPolygons>50);
    assert.ok(sculpture.userData.sourceAnchors.length>2);
    const bounds=new THREE.Box3().setFromObject(sculpture).getSize(new THREE.Vector3());
    assert.ok(bounds.x>.2&&bounds.y>.2&&bounds.z>.5,JSON.stringify(bounds));
    const mesh=sculpture.children[0];
    assert.equal(mesh.isMesh,true);
    assert.ok(mesh.geometry.attributes.color.count>50);
    assert.ok(!mesh.material.map,'Source must not be a flat image mapped on the geometry');
    assert.equal(mesh.material.vertexColors,true);
    assert.equal(sculpture.userData.subtractApplied,true,'A real 3D void must have been carved');
    assert.ok(sculpture.userData.outputVolume<sculpture.userData.inputVolume);
    disposeJSCADSculpture(sculpture);
    assert.equal(sculpture.children.length,0);
  });
}
test('depth changes Z but not source-mark selection',()=>{
  const low=buildJSCADSculpture('petal',marks,jscad,{depth:.55});
  const high=buildJSCADSculpture('petal',marks,jscad,{depth:1.4});
  const a=new THREE.Box3().setFromObject(low).getSize(new THREE.Vector3());
  const b=new THREE.Box3().setFromObject(high).getSize(new THREE.Vector3());
  assert.ok(b.z>a.z+.35);
  assert.deepEqual(low.userData.sourceAnchors,high.userData.sourceAnchors);
  disposeJSCADSculpture(low);disposeJSCADSculpture(high);
});
