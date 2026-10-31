import test from 'node:test';
import assert from 'node:assert/strict';
import {
 traceRecordedPath,selectRecordedPaths,strokeSections,
 strokeOutline,portraitCoords
} from '../../gallery/visit/vector-geometry.mjs';
import {pigmentGrid,tracePigmentRegions} from '../../gallery/visit/pigment-regions.mjs';

test('Recorded real M/L/C strokes retain the source coordinates and curve',()=>{
 const straight=traceRecordedPath({d:'M 100 200 L 110 200 L 120 210'});
 assert.deepEqual(straight,[{x:100,y:200},{x:110,y:200},{x:120,y:210}]);
 const curve=traceRecordedPath({d:'M 10 10 C 20 30 40 30 50 10'});
 assert.ok(curve.length>=6);
 assert.deepEqual(curve[0],{x:10,y:10});
 const end=curve.at(-1);
 assert.ok(Math.abs(end.x-50)<.01&&Math.abs(end.y-10)<.01);
 const transformed=traceRecordedPath({
  d:'M 100 200 L 150 250',transform:'matrix(0 1 -1 0 1000 0)'
 });
 assert.deepEqual(transformed,[{x:800,y:100},{x:750,y:150}]);
});

test('Dry-pen dash pattern causes real voids, rather than solid full image strips',()=>{
 const points=traceRecordedPath({d:'M 0 0 L 100 0'});
 const solid=strokeSections({points,dash:[],width:8});
 const dashed=strokeSections({points,dash:[10,10],dashOffset:0,width:8});
 assert.equal(solid.length,1);
 assert.ok(dashed.length>=4);
 assert.ok(dashed.every(s=>s[0].x<s.at(-1).x));
 const coverage=dashed.reduce((total,section)=>
  total+section.at(-1).x-section[0].x,0);
 assert.ok(coverage<=55&&coverage>=45);
});
test('Physical ribbons faithfully follow a polyline, with bounded width',()=>{
 const p=portraitCoords([{x:0,y:0},{x:500,y:700},{x:1000,y:1400}]);
 assert.ok(p[0].x<0&&p[0].y>0);
 assert.ok(Math.abs(p[1].x)<1e-6&&Math.abs(p[1].y)<1e-6);
 const outline=strokeOutline(p,.04);
 assert.equal(outline.length,6);
 assert.ok(outline.every(v=>Number.isFinite(v.x)&&Number.isFinite(v.y)));
});
test('A material image creates traceable regions matching its actual pigment',()=>{
 const w=80,h=100,d=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const k=(y*w+x)*4,paint=(x>=20&&x<50&&y>=24&&y<72);
  d[k]=paint?210:245;d[k+1]=paint?50:240;d[k+2]=paint?75:230;d[k+3]=255;
 }
 const imageData={width:w,height:h,data:d};
 const grid=pigmentGrid(imageData,'oil','#f5f0e6');
 assert.ok(grid.coverage>.15&&grid.coverage<.22);
 const regions=tracePigmentRegions(grid,'oil','desktop');
 assert.ok(regions.length>0);
 assert.ok(regions.some(r=>r.area>=1400));
 const main=regions.find(r=>r.area>=1400);
 assert.ok(main.points.every(p=>p.x>=.2&&p.x<=.7&&p.y>=.2&&p.y<=.8));
});
test('The selected source paths are from source data, never procedural fragments',()=>{
 const paths=Array.from({length:300},(_,i)=>({
  d:'M '+i+' 10 L '+(i+60)+' 25',width:1+i%8,
  opacity:.6,stroke:i%2?'#f44243':'#212421'
 }));
 const list=selectRecordedPaths({paths},'mobile');
 assert.ok(list.length<=80);
 assert.ok(list.length>40);
 assert.ok(list.every(p=>paths[p.i].stroke===p.stroke));
});
