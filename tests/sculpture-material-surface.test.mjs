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
    if(Math.abs(c-15)<4&&r>6&&r<75)colour=[197,38,76];
    else if((c-37)**2/70+(r-40)**2/160<1)colour=[36,121,169];
    for(let k=0;k<3;k++)data[index+k]=colour[k];
    data[index+3]=255;
  }
  return {width:W,height:H,data};
}
const pixels=image();
const opts={depth:1,material:'oil',paper:'#f5f0e6',quality:'mobile'};
test('paper stays empty while real pigment supplies rounded volume density',()=>{
  const f=pigmentField(pixels,opts);
  assert.ok(f.cells>100&&f.cells<W*H*.35,f.cells);
  assert.equal(f.occupancy[0],0);
  assert.equal(f.occupancy[40*W+15],1);
  assert.equal(f.occupancy[40*W+37],1);
});
test('individual paint material finish survives in the model',()=>{
  assert.ok(materialFinish('oil').bumpScale>materialFinish('watercolour').bumpScale);
  assert.ok(materialFinish('tissue').roughness>materialFinish('oil').roughness);
});
test('all methods produce one organically rounded actual source-textured isosurface, not two separate sculptures',()=>{
  const texture=new THREE.Texture();
  const backs=[];
  for(const method of ['petal','ribbon','pigment','hybrid']){
    const group=buildMaterialSculpture(method,pixels,texture,opts);
    assert.equal(group.userData.engine,MATERIAL_SURFACE_VERSION);
    assert.equal(group.children.length,1);
    assert.equal(group.userData.separatePaintingOverlay,false);
    assert.equal(group.userData.sourceTextureOnBody,true);
    const mesh=group.children[0];
    assert.equal(mesh.isMesh,true);
    assert.equal(mesh.material.map,texture);
    assert.equal(mesh.material.bumpMap,texture);
    assert.ok(!mesh.material.vertexColors);
    assert.ok(group.userData.curvedSurfaceTriangles>200);
    assert.ok(group.userData.frontIndices>0);
    assert.ok(group.userData.backIndices>0);
    assert.ok(group.userData.wallIndices>0);
    const pos=mesh.geometry.getAttribute('position');
    const uvs=mesh.geometry.getAttribute('uv');
    const normals=mesh.geometry.getAttribute('normal');
    let nFront=0,nBack=0,nSides=0;
    const backXs=[];
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
      assert.ok(Number.isFinite(normals.getX(i)));
      if(z>.06){
        nFront++;
        const origX=(uvs.getX(i)-.5)*1.34;
        const origY=(uvs.getY(i)-.5)*1.88;
        assert.ok(Math.abs(x-origX)<3e-6,
          method+' moved source painting X on front');
        assert.ok(Math.abs(y-origY)<3e-6,
          method+' moved source painting Y on front');
      }
      if(z<-.20){nBack++;backXs.push(x);}
      if(Math.abs(normals.getZ(i))<.50)nSides++;
    }
    assert.ok(nFront>40&&nBack>40&&nSides>40,
      method+' is not genuinely modelled around every side');
    const bounds=new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());
    assert.ok(bounds.z>.5,'no full 360-degree volume');
    backs.push([bounds.z,backXs.reduce((a,b)=>a+b,0)/backXs.length]);
    disposeMaterialSculpture(group);
    assert.equal(group.children.length,0);
  }
  assert.equal(new Set(backs.map(a=>a.join(':'))).size,4,
    'Phi/golden-angle backs must differ by sculpture method');
  texture.dispose();
});
test('depth changes sculptural thickness while source XY remains stable',()=>{
  const texture=new THREE.Texture();
  const a=buildMaterialSculpture('hybrid',pixels,texture,{...opts,depth:.6});
  const b=buildMaterialSculpture('hybrid',pixels,texture,{...opts,depth:1.4});
  const size=g=>new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());
  assert.ok(size(b).z>size(a).z+.45);
  assert.ok(Math.abs(size(b).x-size(a).x)<.05);
  disposeMaterialSculpture(a);disposeMaterialSculpture(b);texture.dispose();
});
