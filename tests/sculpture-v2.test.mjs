// New sculpture lab acceptance checks: deterministic 3D source translation.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildSourceFeatures,GOLDEN_ANGLE,PHI} from '../gallery/sculpture-lab/sculpture-v2-features.mjs';
import {buildSpatialGraph} from '../gallery/sculpture-lab/sculpture-v2-graph.mjs';
import {ENGINE_TYPES,buildSculptureEngine,disposeSculptureV2} from '../gallery/sculpture-lab/sculpture-v2-engines.mjs';
import {createHybridSupport,disposeHybridSupport} from '../gallery/sculpture-lab/hybrid-supports.mjs';

const W=108,H=152;
function example(){
  const data=new Uint8ClampedArray(W*H*4);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    let c=[245,240,230];
    const waves=Math.abs(x-(30+12*Math.sin(y*.10)))<6&&y>12&&y<140;
    const spot=(x-73)**2/240+(y-54)**2/480<1;
    const sweep=Math.abs(y-116-.4*(x-60))<6&&x>20&&x<95;
    if(waves)c=[194,45,76];if(spot)c=[42,124,169];
    if(sweep)c=[184,126,35];
    const n=4*(y*W+x);
    for(let j=0;j<3;j++)data[n+j]=c[j];data[n+3]=255;
  }
  return {width:W,height:H,data};
}
const pixels=example(),features=buildSourceFeatures(pixels,{material:'oil'});
test('features contain real pigment regions, 3D-ready gestures, hierarchy and material',()=>{
  assert.equal(features.version,2);
  assert.equal(features.material,'oil');
  assert.ok(features.regions.length>=7);
  assert.ok(features.gestures.length>=3);
  assert.ok(features.regions.some(r=>r.role==='primary'));
  assert.ok(features.regions.every(r=>/^#[0-9a-f]{6}$/i.test(r.color)));
});
test('original recorded source trajectories override fallback region gestures',()=>{
  const strokes=Array.from({length:8},(_,i)=>({
    points:[{x:-.6+i*.12,y:-.58},{x:-.35+i*.1,y:.15},
      {x:-.4+i*.10,y:.65}],color:'#ab3b56',
    score:12+i,coverage:1,width:.024,sourceIndex:i
  }));
  const f=buildSourceFeatures(pixels,{material:'oil',strokes});
  assert.equal(f.sourceKind,'recorded-gestures-and-pigment');
  assert.ok(f.gestures.some(g=>g.source==='actual-recording'));
  assert.ok(f.gestures.every(g=>g.points.length>1));
});
test('φ and golden angle form a nonplanar, deterministic spatial graph',()=>{
  assert.ok(Math.abs(PHI-1.618)<.001);
  assert.ok(Math.abs(GOLDEN_ANGLE*180/Math.PI-137.507)<.01);
  const g=buildSpatialGraph(features);
  assert.deepEqual(g,buildSpatialGraph(features));
  const zs=[...g.nodes.map(n=>n.position.z),
    ...g.gestures.flatMap(m=>m.paths.map(p=>p.z)),
    ...g.gestures.flatMap(m=>m.returnPath.map(p=>p.z))];
  assert.ok(Math.max(...zs)-Math.min(...zs)>.8);
  assert.ok(zs.some(z=>z<-.3)&&zs.some(z=>z>.3));
  assert.equal(g.links.length,g.nodes.length-1);
  const different=buildSpatialGraph(features,{phiPull:0,depth:.40});
  assert.notDeepEqual(g.nodes.map(n=>n.position),different.nodes.map(n=>n.position));
});
test('four genuinely distinct 3D engines use pigment and actual museum-pin attachment',()=>{
  const graph=buildSpatialGraph(features),meshes=[],depths=[];
  for(const kind of ENGINE_TYPES){
    const sculpture=buildSculptureEngine(kind,graph,features);
    assert.equal(sculpture.userData.engine,'spatial-v2');
    assert.equal(sculpture.userData.noImagePlane,true);
    assert.equal(sculpture.userData.noSilhouetteExtrusion,true);
    assert.ok(sculpture.userData.meshCount>0);
    const box=new THREE.Box3().setFromObject(sculpture);
    const size=box.getSize(new THREE.Vector3());
    assert.ok(size.z>.40,kind+' collapsed into shallow image geometry');
    assert.ok(size.y>.30,kind+' has no readable vertical sculpture');
    const b=box.min.y;sculpture.position.y=-.34-b;sculpture.updateMatrixWorld(true);
    const pin=createHybridSupport(sculpture,'pin',{pixels});
    assert.equal(pin.userData.variant,'pin');
    assert.equal(pin.userData.attachedToActualMesh,true);
    assert.equal(pin.userData.anchorCount,1);
    assert.ok(pin.userData.anchorPoints[0][1]>pin.userData.plinthTopY+.09);
    meshes.push(sculpture.userData.meshCount);depths.push(size.z);
    disposeHybridSupport(pin);disposeSculptureV2(sculpture);
  }
  assert.ok(new Set(meshes).size>=3,'All four engines were equivalent geometry');
  assert.ok(depths.every(z=>z>.4));
});
