import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {pigmentField,materialFinish,buildMaterialSculpture,disposeMaterialSculpture,
  MATERIAL_SURFACE_VERSION} from '../gallery/sculpture-lab/material-surface.mjs';

const W=56,H=84;
function image(){
  const data=new Uint8ClampedArray(W*H*4);
  for(let r=0;r<H;r++)for(let c=0;c<W;c++){
    const index=(r*W+c)*4;
    let colour=[245,240,230];
    // Two separate marks with their own source colour and negative space.
    if(Math.abs(c-15)<4&&r>6&&r<75)colour=[197,38,76];
    else if((c-37)**2/70+(r-40)**2/160<1)colour=[36,121,169];
    for(let k=0;k<3;k++)data[index+k]=colour[k];
    data[index+3]=255;
  }
  return {width:W,height:H,data};
}
const pixels=image();
const opts={depth:1,material:'oil',paper:'#f5f0e6'};
test('paper stays genuinely empty while real pigment forms the 3D object',()=>{
  const field=pigmentField(pixels,opts);
  assert.ok(field.cells>100&&field.cells<W*H*.35,field.cells);
  assert.equal(field.occupancy[0],0);
  assert.equal(field.occupancy[40*W+15],1);
  assert.equal(field.occupancy[40*W+37],1);
});
test('each material retains an individual physical finish',()=>{
  assert.ok(materialFinish('oil').bumpScale>materialFinish('watercolour').bumpScale);
  assert.ok(materialFinish('tissue').roughness>materialFinish('oil').roughness);
  assert.ok(materialFinish('oil').metalness>=0);
});
test('all four forms are one actual image-textured closed mesh, not a drawing over a pale object',()=>{
  const texture=new THREE.Texture();
  const methods=['petal','ribbon','pigment','hybrid'];
  const backs=[];
  for(const method of methods){
    const group=buildMaterialSculpture(method,pixels,texture,opts);
    assert.equal(group.userData.engine,MATERIAL_SURFACE_VERSION);
    assert.equal(group.children.length,1);
    assert.equal(group.userData.separatePaintingOverlay,false);
    assert.equal(group.userData.sourceTextureOnBody,true);
    const mesh=group.children[0];
    assert.equal(mesh.isMesh,true);
    assert.equal(mesh.material[0].map,texture);
    assert.equal(mesh.material[0].bumpMap,texture);
    assert.equal(mesh.material[1].vertexColors,true);
    assert.equal(mesh.geometry.groups.length,2);
    assert.ok(mesh.geometry.index.count>300);
    assert.ok(group.userData.frontIndices>0);
    assert.equal(group.userData.frontIndices,group.userData.backIndices);
    assert.ok(group.userData.wallIndices>0);
    const pos=mesh.geometry.getAttribute('position');
    const uv=mesh.geometry.getAttribute('uv');
    const n=(W+1)*(H+1);
    for(let i of [0,Math.floor(n/3),Math.floor(n*.7),n-1]){
      const originalX=(uv.getX(i)-.5)*1.34;
      const originalY=(uv.getY(i)-.5)*1.88;
      assert.ok(Math.abs(pos.getX(i)-originalX)<2e-6,
        method+': painting x shifted');
      assert.ok(Math.abs(pos.getY(i)-originalY)<2e-6,
        method+': painting y shifted');
      assert.ok(pos.getZ(i)>0,'front has lost sculpted depth');
      assert.ok(pos.getZ(i+n)<0,'back was not developed in 3D');
    }
    const box=new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());
    assert.ok(box.z>.5,'paint is an image plane instead of a true volume');
    backs.push([pos.getX(n+Math.floor(n*.25)),pos.getY(n+Math.floor(n*.25)),
      pos.getZ(n+Math.floor(n*.25))]);
    disposeMaterialSculpture(group);
    assert.equal(group.children.length,0);
  }
  assert.equal(new Set(backs.map(a=>a.join(':'))).size,4,
    'The 3D backs should differ between sculpture methods');
  texture.dispose();
});
test('depth controls a genuine 3D return, not a source-painting overlay offset',()=>{
  const texture=new THREE.Texture();
  const a=buildMaterialSculpture('hybrid',pixels,texture,{...opts,depth:.6});
  const b=buildMaterialSculpture('hybrid',pixels,texture,{...opts,depth:1.4});
  const size=g=>new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());
  assert.ok(size(b).z>size(a).z+.45);
  assert.ok(Math.abs(size(b).x-size(a).x)<.0001);
  disposeMaterialSculpture(a);disposeMaterialSculpture(b);texture.dispose();
});
