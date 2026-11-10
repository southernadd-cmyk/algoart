import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {segmentPainting,regionElevation,V4_METHODS} from
  '../gallery/sculpture-lab/sculpture-v4-topology.mjs';
import {buildV4Sculpture,disposeV4Sculpture} from
  '../gallery/sculpture-lab/sculpture-v4-surface.mjs';
const W=108,H=152;
function painting(kind){
  const data=new Uint8ClampedArray(W*H*4);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const xx=x-54,yy=y-76,rad=Math.hypot(xx,yy);
    let ink=false;
    if(kind==='circle')ink=rad<=24;
    if(kind==='ring')ink=rad<=27&&rad>=12;
    if(kind==='crescent')ink=rad<=29&&Math.hypot(xx-11,yy-5)>=25;
    if(kind==='branch'){
      ink=(Math.abs(xx)<4&&yy>=-1&&yy<34)||
        (yy<3&&yy>=-30&&Math.abs(Math.abs(xx)-(-yy*.65))<=4);
    }
    if(kind==='islands')ink=Math.hypot(xx+26,yy-5)<11||
      Math.hypot(xx-25,yy+8)<15;
    const i=(y*W+x)*4;
    data[i]=ink?172:245;data[i+1]=ink?68:240;
    data[i+2]=ink?79:230;data[i+3]=255;
  }
  return {width:W,height:H,data};
}
function texture(pixels){
  const t=new THREE.DataTexture(new Uint8Array(pixels.data),W,H,THREE.RGBAFormat);
  t.needsUpdate=true;t.colorSpace=THREE.SRGBColorSpace;return t;
}
function edgeIncidence(geometry){
  const ix=geometry.index.array,edges=new Map();
  for(let i=0;i<ix.length;i+=3)for(const [a,b] of
    [[ix[i],ix[i+1]],[ix[i+1],ix[i+2]],[ix[i+2],ix[i]]]){
    const key=a<b?a+':'+b:b+':'+a;
    edges.set(key,(edges.get(key)||0)+1);
  }
  return [...edges.values()];
}
for(const kind of ['circle','ring','crescent','branch','islands']){
  test('Poisson source topology: '+kind,()=>{
    const pixels=painting(kind),topo=segmentPainting(pixels,{material:'marker'});
    assert.ok(topo.regions.length>=1,'no source region');
    assert.ok(topo.covered/topo.pigmented>.65,'too many source marks omitted');
    const r=topo.regions[0];
    assert.ok(r.maxPotential>=0);
    assert.ok(r.maxDistance>=1);
    if(kind==='circle'){
      assert.ok(r.maxPotential>10,'circle should have a strongly inflated centre');
      const at=regionElevation(r,54,76,'poisson');
      const near=regionElevation(r,76,76,'poisson');
      assert.ok(at>near*2,'Poisson height must follow local boundary distance');
    }
    if(kind==='ring'){
      const mid=(76-r.minY)*r.rw+54-r.minX;
      assert.equal(r.mask[mid],0,'ring hole must remain unpainted');
    }
    if(kind==='islands'){
      assert.ok(topo.regions.length>=2,'separate painted islands merged together');
    }
    const tex=texture(pixels);
    try{
      for(const method of V4_METHODS){
        const model=buildV4Sculpture(method,{
          topology:topo,texture:tex,material:'marker',depth:.85,quality:'desktop'
        });
        assert.equal(model.userData.engine,'region-inflation-v4');
        assert.equal(model.userData.localIndependentSolids,true);
        assert.equal(model.userData.noImagePlane,true);
        assert.ok(model.userData.regionCount>=1);
        assert.ok(model.userData.polygonTriangles>0);
        const bounds=new THREE.Box3().setFromObject(model);
        assert.ok(bounds.getSize(new THREE.Vector3()).z>.015);
        for(const m of model.children.filter(o=>o.userData.regionId!==undefined)){
          const counts=edgeIncidence(m.geometry);
          assert.ok(counts.length>0);
          assert.ok(counts.every(n=>n===2),
            kind+' '+method+' has open/nonmanifold mesh edges');
        }
        disposeV4Sculpture(model);
      }
    }finally{tex.dispose()}
  });
}
test('A traced boundary must never masquerade as a recorded gesture',()=>{
  const p=painting('circle'),topology=segmentPainting(p);
  const t=texture(p);
  try{
    const fake={sourceKind:'pigment-contour',points:[
      {x:0,y:0},{x:.1,y:0},{x:.1,y:.1}],color:'#ff0000'};
    const model=buildV4Sculpture('gesture',{
      topology,texture:t,strokes:[fake],material:'marker'
    });
    assert.equal(model.userData.sourceStrokeCount,0);
    disposeV4Sculpture(model);
    const real={...fake,sourceKind:'recorded-engine-stroke'};
    const second=buildV4Sculpture('gesture',{
      topology,texture:t,strokes:[real],material:'marker'
    });
    assert.equal(second.userData.sourceStrokeCount,1);
    disposeV4Sculpture(second);
  }finally{t.dispose()}
});
