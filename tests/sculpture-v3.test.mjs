// Sculpture Lab V3: test source geometry, not just 3D depth.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildSourceFeatures} from '../gallery/sculpture-lab/sculpture-v2-features.mjs';
import {V3_METHODS,buildAnamorphicSculpture,disposeAnamorphicSculpture}
  from '../gallery/sculpture-lab/sculpture-v3-anamorphic.mjs';
const W=108,H=152;
function makePainting(){
  const data=new Uint8ClampedArray(W*H*4);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const k=(y*W+x)*4;
    const painted=Math.abs(x-(37+12*Math.sin(y*.09)))<7&&y>10&&y<140;
    data[k]=painted?149:245;
    data[k+1]=painted?38:240;
    data[k+2]=painted?73:230;
    data[k+3]=255;
  }
  return {width:W,height:H,data};
}
const pixels=makePainting();
const strokes=Array.from({length:12},(_,i)=>({
  sourceIndex:i,score:20-i,width:.015,color:'#952649',
  points:Array.from({length:26},(_,j)=>({
    x:-.48+i*.07+.05*Math.sin(j*.21+i*.1),
    y:-.75+j*.059
  }))
}));
const features=buildSourceFeatures(pixels,{material:'marker',strokes,maxGestures:90});
const tex=new THREE.DataTexture(new Uint8Array(pixels.data),W,H,THREE.RGBAFormat);
tex.needsUpdate=true;tex.colorSpace=THREE.SRGBColorSpace;

test('V3 does not shift the original XY stroke coordinates to create sculpture',()=>{
  for(const method of V3_METHODS){
    const model=buildAnamorphicSculpture(method,{
      pixels,texture:tex,material:'marker',features,strokes,
      quality:'mobile',fidelity:.9,phiPull:.8,depth:.85
    });
    assert.equal(model.userData.engine,'source-anchored-v3');
    assert.equal(model.userData.noImagePlane,true);
    assert.equal(model.userData.preservedOriginalXY,true);
    const original=model.children.filter(x=>x.name.startsWith('Recorded source mark'));
    assert.equal(original.length,strokes.length,method+' source stroke retention');
    for(const mesh of original){
      const index=Number(mesh.name.split(' ').at(-1));
      const actual=mesh.geometry.parameters.path.points;
      const expected=strokes[index].points;
      assert.equal(actual.length,expected.length);
      for(let i=0;i<actual.length;i++){
        assert.ok(Math.abs(actual[i].x-expected[i].x)<.000001,method+' source X shifted');
        assert.ok(Math.abs(actual[i].y-expected[i].y)<.000001,method+' source Y shifted');
      }
    }
    const bounds=new THREE.Box3().setFromObject(model);
    assert.ok(bounds.getSize(new THREE.Vector3()).z>.55,
      method+' did not develop physical depth');
    assert.ok(model.userData.meshCount>=strokes.length);
    assert.ok(model.userData.sourceBody===true || method==='armature'||method==='fold');
    disposeAnamorphicSculpture(model);
  }
  tex.dispose();
});
