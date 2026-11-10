import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import jscad from '@jscad/modeling';
import {
  prepareOriginalStrokes,buildRecordedSculptureLayer,
  buildMaterialContourLayer,disposeRecordedLayer
} from '../gallery/sculpture-lab/recorded-gestures.mjs';
import {
  buildJSCADSculpture,disposeJSCADSculpture
} from '../gallery/sculpture-lab/sculpture-csg.mjs';

const capture={
  seed:'SOURCE-TEST',width:1000,height:1400,version:10,paths:[
    {d:'M 120 230 C 250 200 390 490 620 480',stroke:'#c21f32',
      width:9,opacity:.9,dash:null,dashOffset:0},
    {d:'M 120 530 L 340 610 L 620 560',stroke:'#2747ac',
      width:7,opacity:.75,dash:[120,30],dashOffset:5},
    {d:'M 520 750 L 630 890 L 800 850',stroke:'#2e9b63',
      width:10,opacity:.92},
    {d:'M 220 950 C 350 960 500 1230 730 1200',stroke:'#bf881f',
      width:6,opacity:.88}
  ]
};
const realMark=[
 {x:-.35,y:.45,color:'#c21f32',mass:20,span:.2,breadth:.11,kind:'stroke',angle:0},
 {x:.18,y:.22,color:'#2747ac',mass:18,span:.22,breadth:.12,kind:'stroke',angle:1.2},
 {x:.39,y:-.15,color:'#2e9b63',mass:17,span:.21,breadth:.13,kind:'field',angle:.8},
 {x:-.2,y:-.5,color:'#bf881f',mass:14,span:.2,breadth:.12,kind:'stroke',angle:1.8}
];
test('original SVG Bézier and dashed geometry is traced, not fitted to raster centroids',()=>{
 const prepared=prepareOriginalStrokes(capture,{material:'marker',maxPaths:20});
 assert.ok(prepared.length>=4);
 assert.ok(prepared.some(p=>p.sourceIndex===0));
 assert.ok(prepared.some(p=>p.sourceIndex===1));
 const first=prepared.find(p=>p.sourceIndex===0);
 assert.ok(first.points.length>=5,'Cubic curve should retain its true intermediate points');
 assert.ok(Math.abs(first.points[0].x-((120/1000-.5)*1.34))<1e-6);
 assert.ok(Math.abs(first.points[0].y-((.5-230/1400)*1.88))<1e-6);
 assert.equal(first.sourceColor,'#c21f32');
 const dashed=prepared.filter(p=>p.sourceIndex===1);
 assert.ok(dashed.length>1,'Recorded dashes must preserve gaps');
});
test('material-specific gating does not invent source paint where the archive is paper',()=>{
 const width=100,height=140;
 const data=new Uint8ClampedArray(width*height*4);
 for(let i=0;i<data.length;i+=4){data[i]=245;data[i+1]=240;data[i+2]=230;data[i+3]=255;}
 const empty=prepareOriginalStrokes(capture,{
   material:'watercolour',maxPaths:10,
   imageData:{width,height,data,sourceWidth:1000,sourceHeight:1400}
 });
 assert.equal(empty.length,0,'Paper-only image must not generate painted 3D strokes');
});
test('recorded 3D geometry follows source XY while curving through Z',()=>{
 const selected=prepareOriginalStrokes(capture,{material:'marker',maxPaths:12});
 const group=buildRecordedSculptureLayer(selected,{depth:1.0,fidelity:.9});
 assert.equal(group.userData.engine,'recorded-source-v1');
 assert.ok(group.userData.originalPointCount>12);
 assert.ok(group.userData.recordedFront>=4);
 assert.equal(group.userData.imageSpaceMaxError,0);
 let depth=0;
 group.traverse(x=>{
   if(!x.isMesh)return;
   assert.equal(x.material.map,null);
   const box=new THREE.Box3().setFromObject(x);
   depth=Math.max(depth,box.max.z-box.min.z);
   if(x.userData.sourceFacing){
     assert.equal(x.userData.recorded,true);
     assert.ok(x.userData.originalPoints.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
   }
 });
 assert.ok(depth>.3,'The recorded geometry must make non-planar 3D returns');
 disposeRecordedLayer(group);
 assert.equal(group.children.length,0);
});
test('actual baked material contour polygons generate volumetric round outlines',()=>{
 const layer=buildMaterialContourLayer([
   {kind:'paint',color:'#dd4633',side:'#b0392a',depth:.17,
    points:[[-.5,-.5],[.3,-.5],[.4,.3],[-.5,.3]]},
   {kind:'ink',color:'#27428a',points:[[-.2,.2],[.2,.2],[.2,.3]]}
 ],{depth:1.3,fidelity:.9});
 assert.equal(layer.userData.contours,1);
 const mesh=layer.children[0];
 assert.equal(mesh.userData.materialContour,true);
 assert.ok(new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3()).z>.01);
 assert.ok(!mesh.material.map);
 disposeRecordedLayer(layer);
});
test('JSCAD source override uses true original paths instead of the pixel-guess layer',()=>{
 const strokes=prepareOriginalStrokes(capture,{material:'marker',maxPaths:12});
 const group=buildJSCADSculpture('hybrid',realMark,jscad,{
   depth:.8,fidelity:.85,
   sourceData:{strokes,material:'marker',materialContours:[],quality:'desktop'}
 });
 assert.equal(group.userData.sourceOrigin,'original-engine-recorded');
 assert.ok(group.userData.sourceOriginalPoints>0);
 assert.equal(group.userData.sourceTraceCount,strokes.length);
 assert.ok(group.userData.csgPolygons>20);
 disposeJSCADSculpture(group);
});
