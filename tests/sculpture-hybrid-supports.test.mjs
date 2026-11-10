import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildMaterialSculpture,disposeMaterialSculpture} from
  '../gallery/sculpture-lab/material-surface.mjs';
import {SUPPORT_VARIANTS,PLINTH_TOP_LOCAL_Y,chooseSupportAnchors,
  createHybridSupport,disposeHybridSupport} from
  '../gallery/sculpture-lab/hybrid-supports.mjs';

const W=56,H=84;
const data=new Uint8ClampedArray(W*H*4);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const p=4*(y*W+x);
  const mark=((x-22)**2/110+(y-52)**2/145<1)||
    (Math.abs(x-31)<5&&Math.abs(y-28)<15)||
    ((x-13)**2/44+(y-37)**2/75<1);
  const colour=mark?[46+Math.round(x/3),116,170]:[245,240,230];
  for(let i=0;i<3;i++)data[p+i]=colour[i];
  data[p+3]=255;
}
const pixels={width:W,height:H,data};
const tex=new THREE.Texture();

function candidate(){
  const body=buildMaterialSculpture('hybrid',pixels,tex,{
    depth:1,material:'oil',quality:'mobile'
  });
  const bounds=new THREE.Box3().setFromObject(body);
  body.position.y=-.34-bounds.min.y;
  body.updateMatrixWorld(true);
  return body;
}
test('four explicitly different connector setups are named and deterministic',()=>{
  assert.deepEqual(SUPPORT_VARIANTS.map(x=>x.id),
    ['pin','stem','twin','root']);
  assert.ok(Math.abs(PLINTH_TOP_LOCAL_Y+.8175)<1e-6);
});
test('four hybrid sculptures have identical geometry and paint while their stands vary',()=>{
  const sculptureGroups=[],supportGroups=[];
  for(const variant of SUPPORT_VARIANTS){
    const sculpt=candidate();
    const stand=createHybridSupport(sculpt,variant.id,{pixels});
    sculptureGroups.push(sculpt);supportGroups.push(stand);
    assert.equal(sculpt.children.length,1,
      'Do not add a detached decoration to the painted body');
    assert.equal(sculpt.children[0].material.map,tex);
    assert.equal(sculpt.userData.method,'hybrid');
    assert.equal(stand.userData.variant,variant.id);
    assert.equal(stand.userData.ppSupport,true);
    assert.equal(stand.userData.attachedToActualMesh,true);
    assert.ok(stand.userData.anchorCount>=1);
    assert.ok(stand.userData.supportMeshes>=2);
    for(const [x,y,z] of stand.userData.plinthPoints){
      assert.ok(Math.abs(y-PLINTH_TOP_LOCAL_Y)<1e-6,
        'Connector foot is not physically planted on the plinth');
      assert.ok(Math.abs(x)<.5&&Math.abs(z)<.5,
        'Connector foot has missed the plinth');
    }
    // Every declared attachment point coincides with a REAL source-derived
    // sculpture vertex, even for multi-prong and branched supports.
    const anchors=chooseSupportAnchors(sculpt);
    const valid=[anchors.central,anchors.left,anchors.right,anchors.secondary];
    for(const p of stand.userData.anchorPoints){
      const point=new THREE.Vector3(...p);
      assert.ok(valid.some(q=>q.distanceTo(point)<1e-5),
        variant.id+': declared support anchor is not on the painting mesh');
      assert.ok(point.y>PLINTH_TOP_LOCAL_Y+.1,
        variant.id+': attachment overlaps the plinth');
    }
    stand.traverse(o=>{
      if(!o.isMesh)return;
      assert.ok(!o.material.map,
        'Support should not replace the original painting material');
    });
  }
  const ref=sculptureGroups[0].children[0].geometry.attributes.position;
  for(const g of sculptureGroups.slice(1)){
    const attr=g.children[0].geometry.attributes.position;
    assert.equal(attr.count,ref.count);
    for(const i of [0,101,Math.floor(ref.count/2),ref.count-1]){
      for(const c of ['X','Y','Z'])
        assert.ok(Math.abs(attr['get'+c](i)-ref['get'+c](i))<1e-6,
          'Different support changed the sculpture itself');
    }
  }
  assert.equal(supportGroups[0].userData.anchorCount,1);
  assert.equal(supportGroups[1].userData.anchorCount,1);
  assert.equal(supportGroups[2].userData.anchorCount,2);
  assert.ok(supportGroups[3].userData.supportMeshes>=3);
  for(const s of supportGroups){disposeHybridSupport(s);assert.equal(s.children.length,0);}
  for(const g of sculptureGroups){disposeMaterialSculpture(g);assert.equal(g.children.length,0);}
  tex.dispose();
});
test('plinth support rebuild and disposal cannot leak support meshes',()=>{
  for(let i=0;i<3;i++){
    const sculpture=candidate();
    const support=createHybridSupport(sculpture,'twin',{pixels});
    const stage=new THREE.Group();
    stage.add(sculpture,support);
    assert.equal(stage.children.length,2);
    disposeHybridSupport(support);
    assert.equal(stage.children.length,1);
    disposeMaterialSculpture(sculpture);
    assert.equal(stage.children.length,0);
  }
});
