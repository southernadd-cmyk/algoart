import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFile} from 'node:fs/promises';
import {architectureFaces,remainingArchitectureIndices} from '../gallery/gaussian-splat-lab/live-preview.mjs';

test('actual world-space box face sampling preserves orientation and dimensions',()=>{
 const scene=new THREE.Scene(),mesh=new THREE.Mesh(new THREE.BoxGeometry(6,4,.19),new THREE.MeshStandardMaterial());
 scene.add(mesh);mesh.position.set(1,2,3);mesh.rotation.y=Math.PI/3;
 const eye=mesh.localToWorld(new THREE.Vector3(0,0,3));
 const faces=architectureFaces(THREE,[mesh],eye);
 assert.equal(faces.length,1);const face=faces[0];
 assert.ok(Math.abs(face.width*face.height-24)<1e-6);
 assert.ok(face.n.dot(eye.clone().sub(face.centre))>0);
 assert.ok(Math.abs(face.u.clone().cross(face.v).dot(face.n)-1)<1e-6);
 const original=mesh.geometry.index;const remaining=remainingArchitectureIndices(original,new Set([face.at]));
 assert.equal(remaining.length,30);assert.equal(original.count,36);
 assert.deepEqual(remaining,Array.from(original.array).filter((_,i)=>i<face.at||i>=face.at+6));
});
test('only opaque parented production geometry is sampled',()=>{
 const scene=new THREE.Scene();
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(4,4,1),new THREE.MeshStandardMaterial({transparent:true,opacity:.5}));
 scene.add(mesh);assert.equal(architectureFaces(THREE,[mesh],new THREE.Vector3(0,0,3)).length,0);
});
test('the full tower is built with isolated source injection and one Three runtime',async()=>{
 const build=await readFile(new URL('../automation/build-sculpture-v2-test.mjs',import.meta.url),'utf8');
 assert.match(build,/entryPoints:\['gallery\/visit\/gallery-phi\.js'\]/);
 assert.match(build,/gallery-phi-gaussian-preview-bundle\.js/);
 assert.match(build,/createGaussianLivePreview/);
 assert.match(build,/gaussianLab\?\.setArchitecture/);
 assert.match(build,/external:\['three','three\/\*','@sparkjsdev\/spark'\]/);
 const preview=await readFile(new URL('../gallery/gaussian-splat-lab/live-preview.mjs',import.meta.url),'utf8');
 assert.match(preview,/renderer\.render\(scene,view\)/);
 assert.match(preview,/renderer\.readRenderTargetPixels/);
 assert.match(preview,/p\.mesh\.geometry=p\.original/);
});

test('generated preview contains two persistent labelled mode buttons and automatically captures splats',async()=>{
 const build=await readFile(new URL('../automation/build-sculpture-v2-test.mjs',import.meta.url),'utf8');
 const preview=await readFile(new URL('../gallery/gaussian-splat-lab/live-preview.mjs',import.meta.url),'utf8');
 const line=build.split('\n').find(line=>line.trim().startsWith('const gaussianControls='));
 assert.ok(line,'Expected statically generated control markup');
 const markup=JSON.parse(line.trim().slice('const gaussianControls='.length,-1));
 assert.match(markup,/<button id="spark-triangles"[^>]*>Triangles<\/button>/);
 assert.match(markup,/<button id="spark-splats"[^>]*>Full-floor hybrid<\/button>/);
 assert.ok(markup.includes('data-ready="false"'));
 assert.ok(markup.includes('role="status"'));
 assert.ok(preview.includes("else if(getReady())void capture(true)"));
 assert.ok(preview.includes("if(activate&&splat&&ticket===generation)show()"));
 assert.ok(preview.includes("panel.dataset.mode=active?'splats':'triangles'"));
 assert.ok(preview.includes("panel.dataset.ready='true'"));
 assert.doesNotMatch(preview,/spark-mode/);
});

import {summarizeFrameTimes,pairedComparison,benchmarkViewMatches} from '../gallery/gaussian-splat-lab/benchmark.mjs';
test('benchmark measures real elapsed frames rather than averages of instantaneous FPS',()=>{
 const stats=summarizeFrameTimes([...Array(19).fill(16),64]);
 assert.equal(stats.frames,20);assert.equal(stats.meanMs,18.4);
 assert.equal(stats.medianMs,16);assert.equal(stats.p95Ms,16);assert.equal(stats.p99Ms,64);assert.equal(stats.stalls50ms,1);
 assert.equal(stats.fps,1000/18.4);
 assert.throws(()=>summarizeFrameTimes([0,16]));
 assert.throws(()=>summarizeFrameTimes(Array(10).fill(NaN)));
 const paired=pairedComparison({meanMs:20},{meanMs:24},{meanMs:11});
 assert.equal(paired.fpsGainPct,100);assert.equal(paired.frameTimeReductionPct,50);assert.equal(paired.baselineDriftPct,20);
});
test('benchmark rejects motion, floor changes, resizing and pixel ratio changes',()=>{
 const view={date:'2026-11-26',position:[1,2,3],quaternion:[0,0,0,1],width:1920,height:1080,pixelRatio:1};
 assert.ok(benchmarkViewMatches(view,{...view,quaternion:[0,0,0,-1]}));
 assert.ok(!benchmarkViewMatches(view,{...view,position:[1.2,2,3]}));
 assert.ok(!benchmarkViewMatches(view,{...view,quaternion:[0,.1,0,Math.sqrt(.99)]}));
 assert.ok(!benchmarkViewMatches(view,{...view,date:'reception'}));
 assert.ok(!benchmarkViewMatches(view,{...view,width:1600}));
 assert.ok(!benchmarkViewMatches(view,{...view,pixelRatio:2}));
});
test('benchmark observes completed post-FX frames and validates active conversion',async()=>{
 const build=await readFile(new URL('../automation/build-sculpture-v2-test.mjs',import.meta.url),'utf8');
 const preview=await readFile(new URL('../gallery/gaussian-splat-lab/live-preview.mjs',import.meta.url),'utf8');
 assert.ok(build.includes('gaussianLab?.afterRender()'));
 assert.ok(preview.includes("if(!active||!captureCount)throw Error"));
 assert.ok(preview.includes("Triangles (before)"));
 assert.ok(preview.includes("Triangles (after)"));
 assert.ok(preview.includes("['12','Low'],['24','Medium'],['40','High']"));
 assert.ok(preview.includes('validateRun(m.run)'));
 assert.ok(preview.includes('benchmarkViewMatches(run.reference,view())'));
});

import {planFloorSamples} from '../gallery/gaussian-splat-lab/floor-plan.mjs';
test('whole-floor enumeration includes distant rooms and both sides regardless of viewpoint',()=>{
 const scene=new THREE.Scene(),material=new THREE.MeshStandardMaterial();
 const meshes=Array.from({length:12},(_,i)=>{
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(8,4,.19),material);
  mesh.position.set(i*25,2,0);scene.add(mesh);return mesh;
 });
 const all=architectureFaces(THREE,meshes);
 assert.equal(all.length,24);
 assert.equal(new Set(all.map(f=>f.mesh)).size,12);
 assert.equal(all.filter(f=>f.n.z>.99).length,12);
 assert.equal(all.filter(f=>f.n.z<-.99).length,12);
 assert.ok(architectureFaces(THREE,meshes,new THREE.Vector3(0,2,3)).length<all.length);
 const plan=planFloorSamples(all,40,25000);
 assert.equal(plan.items.length,all.length);
 assert.ok(plan.total<=25000);
 assert.ok(plan.effectiveDensity<40);
 assert.ok(plan.items.every(p=>p.px>=4&&p.py>=4));
 assert.deepEqual(planFloorSamples(all,40,25000),plan);
 assert.throws(()=>planFloorSamples(all,40,100),/coverage budget/);
});
test('full hybrid has no camera-distance cutoff or skipped faces and carries across editions',async()=>{
 const src=await readFile(new URL('../gallery/gaussian-splat-lab/live-preview.mjs',import.meta.url),'utf8');
 const build=await readFile(new URL('../automation/build-sculpture-v2-test.mjs',import.meta.url),'utf8');
 assert.ok(src.includes('const faces=architectureFaces(THREE,sources);'));
 assert.ok(src.includes('for(const {face,px,py} of floor.items)'));
 assert.ok(src.includes("if(!bytes)throw Error('Incomplete floor bake"));
 assert.ok(src.includes('wantHybrid&&!active&&!busy&&!benchmark'));
 assert.ok(src.includes('pos.copy(centre).sub(origin)'));
 assert.ok(!src.includes('eye.distanceTo(camera.getWorldPosition'));
 assert.ok(build.includes('selectBakeLights:position=>'));
 assert.ok(build.includes('sculpture-comparison-01'));
});

test('fixed comparison starts on one published floor, prepares hybrid before revealing it, and bypasses lift',async()=>{
 const build=await readFile(new URL('../automation/build-sculpture-v2-test.mjs',import.meta.url),'utf8');
 const preview=await readFile(new URL('../gallery/gaussian-splat-lab/live-preview.mjs',import.meta.url),'utf8');
 assert.ok(build.includes("const comparisonDate='2026-11-26'"));
 assert.ok(build.includes('await loadEdition(comparisonDate)'));
 assert.ok(build.indexOf('await loadEdition(comparisonDate)')<build.indexOf('await gaussianLab?.prepareComparison()'));
 assert.ok(build.indexOf('await gaussianLab?.prepareComparison()')<build.indexOf('enter.disabled=false;welcome.hidden=true'));
 assert.ok(build.includes("inject('function openLift(){','function openLift(){return;')"));
 assert.ok(build.includes('phi.canWalk(p.x,p.z)'));
 assert.ok(build.includes('clearOfSculptures(sculpturePlacements,p.x,p.z)'));
 assert.ok(preview.includes('async prepareComparison(){wantHybrid=true;await capture(true);return active;}'));
 const meta=JSON.parse(await readFile(new URL('../gallery/2026-11-26/meta.json',import.meta.url),'utf8'));
 assert.equal(meta.date,'2026-11-26');
 assert.ok(meta.entries.length>0);
});

import {buildSculptureAlternatives,simplifyRegion} from '../gallery/gaussian-splat-lab/sculpture-assets.mjs';
test('sculpture alternatives use real indexed source triangles and preserve material regions',()=>{
 const mesh={position:[1,2,3],rotation:[0,0,0,'XYZ'],scale:[1,1,1],geometry:{
 position:[0,0,0,100000,0,0,0,100000,0,0,0,0],normal:[0,0,10000,0,0,10000,0,0,10000,0,0,10000],uv:[0,0,100000,0,0,100000,0,0],
 index:[0,1,2,3,1,2],groups:[{start:0,count:6,materialIndex:0}]
 }};
 const study={seed:'test',sourceFile:'test.jpg',meshes:[mesh]};
 const alt=buildSculptureAlternatives(study,128);
 assert.equal(alt.originalTriangles,2);assert.equal(alt.simpleTriangles,1);
 assert.equal(alt.pointCount,128);assert.equal(alt.points.length,128*11);
 assert.deepEqual(alt,buildSculptureAlternatives(study,128));
 for(let i=0;i<alt.points.length;i+=11){
  const [x,y,z,nx,ny,nz,u,v,radius,mi,material]=alt.points.slice(i,i+11);
  assert.ok(x>=1&&y>=2&&x+y<=4.000001);assert.equal(z,3);assert.equal(nz,1);
  assert.ok(u>=0&&v>=0&&u+v<=1.000001&&radius>0);assert.equal(mi,0);assert.equal(material,0);
 }
 assert.equal(simplifyRegion(mesh).groups[0].count,3);
});
test('sculpture-only test does not replace architecture and requires prepared source assets',async()=>{
 const preview=await readFile(new URL('../gallery/gaussian-splat-lab/sculpture-preview.mjs',import.meta.url),'utf8');
 const build=await readFile(new URL('../automation/build-sculpture-v2-test.mjs',import.meta.url),'utf8');
 assert.ok(preview.includes('setArchitecture(){}'));
 assert.ok(preview.includes('asset.originalTriangles!==body.userData.polygonTriangles'));
 assert.ok(preview.includes("['triangles','simplified','splats','triangles']"));
 assert.ok(build.includes('sculptureComparison?createSculpturePreview:createGaussianLivePreview'));
 assert.ok(!preview.includes('readRenderTargetPixels'));
});
