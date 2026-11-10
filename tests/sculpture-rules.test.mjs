import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {PHI,GOLDEN_ANGLE,METHODS,extractRuleMarks,buildRuleSculpture,
  disposeRuleSculpture} from '../gallery/sculpture-lab/sculpture-rules.mjs';

const W=108,H=152,WHITE=[245,240,230];
function painting(){
  const bytes=new Uint8ClampedArray(W*H*4);
  for(let y=0;y<H;y++) for(let x=0;x<W;x++) {
    let color=WHITE;
    if(y>12&&y<132&&Math.abs(x-23-.25*y)<8)color=[200,38,24]; // diagonal red gesture
    if(((x-78)/18)**2+((y-49)/25)**2<1)color=[23,80,199]; // blue paint mass
    if(x>37&&x<88&&y>111&&y<125)color=[32,161,78]; // green rectangular field
    bytes.set([...color,255],4*(y*W+x));
  }
  return {width:W,height:H,data:bytes};
}
const markData=extractRuleMarks(painting(),{seed:'example',material:'marker'});
test('phi and golden angle are mathematical constants and methods are distinct',()=>{
  assert.ok(Math.abs(PHI-1.618033988749895)<1e-12);
  assert.ok(Math.abs(GOLDEN_ANGLE*180/Math.PI-137.507764)<.00001);
  assert.deepEqual(METHODS,['petal','ribbon','pigment','hybrid']);
});
test('deterministic image segmentation identifies visible source pigment in its actual XY',()=>{
  const other=extractRuleMarks(painting(),{material:'marker'});
  assert.deepEqual(other,markData);
  assert.ok(markData.length>=3);
  assert.ok(markData.some(m=>m.color==='#c82618'));
  assert.ok(markData.some(m=>m.color==='#1750c7'));
  assert.ok(markData.some(m=>m.color==='#20a14e'));
  assert.ok(markData.every(m=>m.x>=-.67&&m.x<=.67&&m.y>=-.94&&m.y<=.94));
  assert.ok(markData.some(m=>m.kind==='stroke'));
});
test('paper-only images cannot masquerade as art',()=>{
  const p=painting();
  for(let i=0;i<p.data.length;i+=4)p.data.set([...WHITE,255],i);
  assert.throws(()=>extractRuleMarks(p),/No distinguishable pigment/);
});
for(const mode of METHODS){
  test(mode+' is a true solid XYZ sculpture with front anchors retained',()=>{
    const group=buildRuleSculpture(mode,markData);
    const dims=new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());
    assert.ok(dims.x>.25&&dims.y>.2&&dims.z>.6,
      'Sculpture must have substantial XYZ depth '+JSON.stringify(dims));
    assert.equal(group.userData.engine,'rules-v1');
    assert.equal(group.userData.noModelInference,true);
    assert.equal(group.userData.noImageExtrusion,true);
    assert.equal(group.userData.sourceAnchors.length,Math.min(markData.length,
      {petal:42,ribbon:48,pigment:52,hybrid:56}[mode]));
    let meshCount=0,triangles=0,closedDepth=false;
    group.traverse(child=>{
      if(!child.isMesh)return;
      meshCount++;
      if(child.geometry?.index)triangles+=child.geometry.index.count/3;
      const box=new THREE.Box3().setFromObject(child);
      if(box.getSize(new THREE.Vector3()).z>.2)closedDepth=true;
      assert.ok(!child.material?.map,'No image-texture card is permitted');
      assert.ok(child.geometry?.attributes?.normal,'Every mesh needs 3D normals');
    });
    assert.ok(meshCount>=4&&triangles>150);
    assert.ok(closedDepth,'Real 3D bodies required');
    const again=buildRuleSculpture(mode,markData);
    assert.deepEqual(again.userData.sourceAnchors,group.userData.sourceAnchors);
    disposeRuleSculpture(group);disposeRuleSculpture(again);
    assert.equal(group.children.length,0);
  });
}
test('changing depth changes the 3D extent without moving anchors',()=>{
  const shallow=buildRuleSculpture('petal',markData,{depth:.55});
  const deep=buildRuleSculpture('petal',markData,{depth:1.5});
  const a=new THREE.Box3().setFromObject(shallow).getSize(new THREE.Vector3());
  const b=new THREE.Box3().setFromObject(deep).getSize(new THREE.Vector3());
  assert.ok(b.z>a.z+.5,'Depth slider must change sculptural volume');
  assert.deepEqual(shallow.userData.sourceAnchors,deep.userData.sourceAnchors);
  disposeRuleSculpture(shallow);disposeRuleSculpture(deep);
});
