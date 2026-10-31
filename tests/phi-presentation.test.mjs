import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import * as THREE from 'three';
import {buildPhiRendererPlan} from '../test/virtual-gallery/phi-full-engine-adapter.mjs';
import {planPhiFurnishings} from '../gallery/visit/phi-furnishings.mjs';
import {planPhiLiftShaft} from '../gallery/visit/phi-lift-shaft.mjs';
import {createGothicSurroundShape} from '../gallery/visit/phi-gothic-door-profile.mjs';
test('the stone surround fits the real pointed arch without filling the walking aperture',()=>{
 const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(createGothicSurroundShape(THREE),{depth:.26,bevelEnabled:false}),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.updateMatrixWorld(true);
 const hit=(x,y)=>new THREE.Raycaster(new THREE.Vector3(x,y,2),new THREE.Vector3(0,0,-1)).intersectObject(mesh).length;
 assert.equal(hit(0,1.68),0);assert.equal(hit(0,4.35),0);assert.ok(hit(1.2,1.68)>0);assert.ok(hit(.8,3.9)>0);
});
test('all shaft openings clear the actual exit path as floors rotate',()=>{
 const shaft=planPhiLiftShaft(32);
 for(const opening of shaft.openings)for(const offset of [-.59,0,.59]){
  const a=opening.angle+offset,ray=new THREE.Vector2(Math.cos(a),Math.sin(a));
  for(const p of shaft.panels.filter(p=>p.level===opening.level&&p.landing)){
   const edge=new THREE.Vector2(p.b.x-p.a.x,p.b.z-p.a.z),start=new THREE.Vector2(p.a.x,p.a.z),cross=ray.x*edge.y-ray.y*edge.x;
   if(Math.abs(cross)<1e-6)continue;
   const t=(start.x*edge.y-start.y*edge.x)/cross,u=(start.x*ray.y-start.y*ray.x)/cross;
   assert.ok(!(t>0&&u>=0&&u<=1),'Shaft pane crosses floor '+opening.level+' exit at '+offset);
  }
 }
});
test('real archive floors retain standing visitors, seating and a bounded population',()=>{
 const archive=JSON.parse(readFileSync(new URL('../gallery/tower-layouts.json',import.meta.url)));
 for(const {date} of archive.floors){
  const meta=JSON.parse(readFileSync(new URL('../gallery/'+date+'/meta.json',import.meta.url)));
  const studies=meta.entries.map((s,id)=>({id,portrait:s.orientation==='portrait',aspect:s.orientation==='portrait'?1/1.4:1.4}));
  const phi=buildPhiRendererPlan(date,studies);
  for(const lowPower of [false,true]){
   const a=planPhiFurnishings(phi,{lowPower});assert.deepEqual(a,planPhiFurnishings(phi,{lowPower}));
   assert.ok(a.benches.length>=1,date+' has no gallery bench');assert.ok(a.people.some(p=>!p.seat),date+' has no standing visitor');
   assert.ok(a.people.length<=(lowPower?2:3));assert.ok(a.people.filter(p=>p.seat).length<=1);
   for(const person of a.people)assert.ok(phi.canWalk(person.x,person.z),date+' visitor is outside the usable room');
  }
 }
});

// Exercise the same planner, painter state and obstacle coordinates used in the scene.
import {phiLiftIndicatorState,paintPhiLiftIndicator} from '../gallery/visit/phi-lift-indicator.mjs';
import {planPhiSquare,planSquareTags,clearOfPhiSquare,GOLDEN_ANGLE,SQUARE_TAG_COUNTS,SQUARE_TAG_FORMS,SQUARE_DISABLED_HANDS,makeSquareTag} from '../gallery/visit/phi-square-graffiti.mjs';
test('lift indicator follows physical floors in both directions and retains archive dates',()=>{
 const dates=['__phi_reception__','2026-10-05','2026-10-06','2026-10-07'];
 const up=[0,6.2,12.4,18.6].map(height=>phiLiftIndicatorState({height,dates,currentFloor:0,targetFloor:3,phase:'moving'}));
 assert.deepEqual(up.map(s=>s.floor),[0,1,2,3]);assert.match(up[1].primary,/1 · 5 Oct/);assert.match(up[1].secondary,/Ascending to 7 Oct · Floor 3/);
 const down=[18.6,12.4,6.2,0].map(height=>phiLiftIndicatorState({height,dates,currentFloor:3,targetFloor:0,phase:'moving'}));
 assert.deepEqual(down.map(s=>s.floor),[3,2,1,0]);assert.match(down[2].secondary,/Descending to Reception/);
 const idle=phiLiftIndicatorState({height:18.6,dates,currentFloor:3});assert.equal(idle.primary,'3 · 7 Oct');assert.equal(idle.secondary,'Archive lift');
 const drawing=[],context={clearRect(){},fillRect(){},fillText(text){drawing.push({text,font:this.font});}},display={canvas:{width:768,height:192},context,texture:{needsUpdate:false}};
 assert.equal(paintPhiLiftIndicator(display,up[1]),true);assert.ok(drawing.every(d=>d.font.includes('AlgoArt Marker')));assert.equal(display.texture.needsUpdate,true);
 assert.equal(paintPhiLiftIndicator(display,up[1]),false);assert.equal(paintPhiLiftIndicator(display,up[2]),true);
});
test('square writing mixes eight lettering forms, independent hands and lowercase phi in golden-angle groups',()=>{
 const objects=planPhiSquare(),marks=planSquareTags(objects);
 assert.equal(objects.filter(o=>o.kind==='wall').length,4);assert.equal(objects.filter(o=>o.kind==='monument').length,3);assert.equal(marks.length,187);
 assert.deepEqual(planSquareTags(objects),marks);assert.deepEqual(new Set(marks.map(m=>m.phrase)),new Set(['φ']));
 assert.deepEqual(new Set(marks.map(m=>m.form)),new Set(SQUARE_TAG_FORMS));assert.equal(SQUARE_TAG_FORMS.length,8);
 assert.ok(new Set(marks.map(m=>m.hand)).size>=25,'Writer identities are repeating');
 for(const hand of SQUARE_DISABLED_HANDS){assert.ok(!marks.some(m=>m.hand===hand),'Disabled handwriting returned');assert.throws(()=>makeSquareTag('φ','test','#000',{hand}),/temporarily disabled/);}
 const faces=new Map();for(const m of marks){if(!faces.has(m.face.id))faces.set(m.face.id,[]);faces.get(m.face.id).push(m);}
 assert.deepEqual(new Set([...faces.values()].map(ms=>ms.length)),new Set([...SQUARE_TAG_COUNTS,17]));
 for(const group of faces.values()){
  if(group.length>=3){assert.ok(new Set(group.map(m=>m.form)).size>=3);assert.deepEqual(new Set(group.map(m=>m.phrase)),new Set(['φ']));}
  for(let i=1;i<group.length;i++)assert.ok(Math.abs(group[i].phi.angle-group[i-1].phi.angle-GOLDEN_ANGLE)<1e-12);
 }
 for(const m of marks){
  assert.equal(m.tag.version,7);const renderedText=m.phrase==='φ'?'φ':m.phrase.toUpperCase();assert.equal(m.text,renderedText);assert.equal(m.tag.text,renderedText);
  if(m.phrase==='φ')assert.equal(m.tag.construction.letters[0].character,'φ');
  const object=objects.find(o=>m.face.id.startsWith(o.id+':'));
  const hh=(Math.abs(m.height*Math.cos(m.rotation))+Math.abs(m.width*Math.sin(m.rotation)))/2;
  const hw=(Math.abs(m.width*Math.cos(m.rotation))+Math.abs(m.height*Math.sin(m.rotation)))/2;
  const right={x:m.normal.z,z:-m.normal.x};
  const u=(m.position.x-m.face.centre.x)*right.x+(m.position.z-m.face.centre.z)*right.z;
  assert.ok(m.position.y-hh>.05&&m.position.y+hh<object.height,'Paint leaves its wall vertically');
  assert.ok(Math.abs(u)+hw<m.face.length/2,'Paint leaves its wall horizontally');
 }
});
test('square objects leave the entrance, frontage benches and central route clear with rotated collisions',()=>{
 const objects=planPhiSquare();
 for(let z=-2;z<=25;z+=.25)for(const x of [-2,0,2])assert.ok(clearOfPhiSquare(objects,x,z),'Main route obstructed at '+x+','+z);
 for(const x of [-5.2,5.2])assert.ok(clearOfPhiSquare(objects,x,3.1,1.4),'Frontage seating obstructed');
 for(const p of objects){assert.equal(clearOfPhiSquare([p],p.x,p.z),false);assert.ok(Math.abs(p.x)<30&&p.z<41);}
 const diagonal={x:0,z:0,yaw:Math.PI/4,width:6,depth:.34};
 assert.equal(clearOfPhiSquare([diagonal],1,-1),false);assert.equal(clearOfPhiSquare([diagonal],1,1),true);
});

import {planPhiOutdoorPlants,addPhiOutdoorPlants,PHI_EXTERIOR_PLANTING_ENABLED} from '../gallery/visit/phi-outdoor-plants.mjs';
import {planPhiReception} from '../gallery/visit/phi-reception-layout.mjs';
import {fitPhiWallModel} from '../gallery/visit/phi-model-assets.mjs';
import {planCuratedPhiArtwork} from '../gallery/visit/phi-curator.mjs';
function glbMetadata(name){const b=readFileSync(new URL('../gallery/visit/models/'+name,import.meta.url));assert.equal(b.readUInt32LE(8),b.length);return {bytes:b.length,doc:JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString())};}
test('exterior plant assets remain reusable and active planting switch is respected',async()=>{
 const asset=glbMetadata('plants-scene-gallery-optimized.glb');assert.ok(asset.bytes<6000000);assert.match(asset.doc.asset.extras.author,/Nicholas-3D/);assert.match(asset.doc.asset.extras.license,/CC-BY-4.0/);
 assert.ok(asset.doc.meshes.reduce((n,m)=>n+m.primitives.reduce((a,p)=>a+asset.doc.accessors[p.indices].count/3,0),0)<50000);
 const plaza={centre:{x:0,z:0},outward:{x:0,z:1},transverse:{x:1,z:0},halfWidth:30,level:0};
 const scene=new THREE.Scene(),landscape=new THREE.Group();scene.add(landscape);
 const placements=planPhiOutdoorPlants(plaza),originals=[];assert.equal(placements.length,8);
 for(const p of placements){
  assert.ok(Math.abs(p.x)>10,'Plant blocks the main square');
  for(const g of [new THREE.BoxGeometry(1.75,.69,1.75),...Array.from({length:3},()=>new THREE.IcosahedronGeometry(.5,1))]){
   const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial());m.position.set(p.x,.5,p.z);landscape.add(m);originals.push(m);
  }
 }
 const bench=new THREE.Mesh(new THREE.BoxGeometry(1.2,.57,2.7),new THREE.MeshBasicMaterial());bench.position.set(placements[0].x,.2,placements[0].z);landscape.add(bench);
 const source=new THREE.Group();source.add(new THREE.Mesh(new THREE.BoxGeometry(1,2,1),new THREE.MeshBasicMaterial()));
 const result=addPhiOutdoorPlants(THREE,scene,plaza,[landscape],{loadModel:()=>Promise.resolve(source)});await result.ready;
 if(!PHI_EXTERIOR_PLANTING_ENABLED){
  assert.deepEqual(result.holders,[]);
  assert.deepEqual(result.obstacles,[]);
  assert.equal(scene.children.length,1,'No exterior plant holders are introduced');
  assert.equal(bench.visible,true,'Original seating is retained');
  return;
 }
 assert.ok(originals.every(o=>!o.visible));assert.equal(bench.visible,true);assert.ok(result.holders.every(o=>o.userData.modelLoaded&&o.userData.replaced===4));
 scene.updateMatrixWorld(true);
 for(const holder of result.holders){
  const planter=holder.getObjectByName('phi-golden-rectangle-planter'),soil=holder.getObjectByName('phi-planter-soil'),plant=holder.getObjectByName('phi-individual-source-plant');
  assert.ok(planter&&soil&&plant,'Every individual model needs a planter');
  assert.ok(Math.abs(planter.geometry.parameters.width/planter.geometry.parameters.depth-(1+Math.sqrt(5))/2)<1e-10);
  const bounds=new THREE.Box3().setFromObject(plant),pot=new THREE.Box3().setFromObject(planter);
  assert.ok(Math.abs(bounds.min.y-(holder.position.y+soil.position.y))<1e-5,'Plant must meet the soil');
  assert.ok(bounds.min.x>=pot.min.x&&bounds.max.x<=pot.max.x&&bounds.min.z>=pot.min.z&&bounds.max.z<=pot.max.z,'Plant leaves must fit its planter');
 }
 for(const side of [-1,1]){
  const row=placements.filter(p=>Math.sign(p.x)===side);
  assert.equal(new Set(row.map(p=>p.x)).size,1,'Planters must form straight rows');
  assert.deepEqual(row.map(p=>p.z),[-13,-4,5,14]);
 }
 const grouped=new THREE.Group(),sourceRoot=new THREE.Group();sourceRoot.name='GLTF_SceneRootNode';grouped.add(sourceRoot);
 for(const name of ['SmallPlantStem_1','SmallPlantStem.001_2','YellowPlantStem_3','YellowPlantStem.001_4']){
  const stem=new THREE.Group();stem.name=name;stem.position.x=sourceRoot.children.length*4;
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(2,3,2),new THREE.MeshBasicMaterial());mesh.position.y=1.5;stem.add(mesh);sourceRoot.add(stem);
 }
 const separate=addPhiOutdoorPlants(THREE,scene,plaza,[],{loadModel:()=>Promise.resolve(grouped)});await separate.ready;
 scene.updateMatrixWorld(true);
 for(const holder of separate.holders){
  assert.equal(holder.getObjectByName('GLTF_SceneRootNode').children.length,1,'Source scene spacing must not duplicate loose plants');
  const bounds=new THREE.Box3().setFromObject(holder.getObjectByName('phi-individual-source-plant'));
  assert.ok(Math.abs(bounds.min.y-holder.position.y-.443)<1e-5);
 }

 let resolve;const late=addPhiOutdoorPlants(THREE,scene,plaza,[],{loadModel:()=>new Promise(r=>resolve=r)});const initialChildren=late.holders.map(h=>[...h.children]);for(const h of late.holders)scene.remove(h);resolve(source);await late.ready;for(const [i,h] of late.holders.entries()){assert.deepEqual(h.children,initialChildren[i],'Late model attached to an old floor');assert.equal(h.userData.modelLoaded,undefined);}
});
test('the reception wall displays a compact baked watercolour in place of the world map',()=>{
 const phi=buildPhiRendererPlan('__phi_reception__',[]),reception=planPhiReception(phi.floor,phi.circulation,phi.physical),map=reception.worldMap;
 assert.ok(map.width>=6&&map.height>=4);assert.ok(map.centreY-map.height/2>.5&&map.centreY+map.height/2<4.9);
 assert.equal(reception.signage.length,2);assert.ok(reception.signage.every(s=>s.axis!==map.axis||Math.abs((s.axis==='x'?s.x:s.z)-(map.axis==='x'?map.x:map.z))>.3));
 const baked=readFileSync(new URL('../gallery/visit/assets/reception-radiant-watercolour.webp',import.meta.url));
 assert.ok(baked.length>10000&&baked.length<200000,'Prebaked reception texture should stay small');
 const decor=readFileSync(new URL('../gallery/visit/phi-reception-decor.mjs',import.meta.url),'utf8');
 assert.match(decor,/reception-radiant-watercolour.webp/);assert.doesNotMatch(decor,/vintage-world-map.glb/);
 const credits=readFileSync(new URL('../gallery/visit/credits.html',import.meta.url),'utf8');
 assert.match(credits,/Radiant Systems, watercolour/);assert.doesNotMatch(credits,/My Name Is This/);
});
test('paintings grow into available wall space without losing aspect, room boundaries or neighbouring gaps',()=>{
 const archive=JSON.parse(readFileSync(new URL('../gallery/tower-layouts.json',import.meta.url)));
 for(const {date} of archive.floors){
  const meta=JSON.parse(readFileSync(new URL('../gallery/'+date+'/meta.json',import.meta.url)));
  const studies=meta.entries.map((s,id)=>({id,portrait:s.orientation==='portrait',aspect:s.orientation==='portrait'?1/1.4:1.4}));
  const phi=buildPhiRendererPlan(date,studies),baseline=planCuratedPhiArtwork(phi.floor,phi.circulation,phi.physical,studies);
  for(const p of phi.exhibition.paintings){
   const prior=baseline.paintings.find(b=>b.studyId===p.studyId),wall=phi.exhibition.surfaces.find(w=>w.id===p.surfaceId);
   assert.ok(p.width>=prior.width-1e-6);assert.ok(Math.abs(p.width/p.height-1.4)<1e-6);
   assert.ok(p.u-p.width/2>=wall.lo-1e-6&&p.u+p.width/2<=wall.hi+1e-6,date+' frame crosses an opening or corner');
   assert.ok(p.y-p.height/2>.5&&p.y+p.height/2<4.7);
   for(const other of phi.exhibition.paintings.filter(q=>q!==p&&q.surfaceId===p.surfaceId))assert.ok(Math.abs(p.u-other.u)-(p.width+other.width)/2>=.42-1e-6,date+' frames overlap');
  }
  if(date==='2026-10-07')assert.ok(phi.exhibition.paintings.filter(p=>p.width>=4.5).length>=3,'Sparse 7 October walls did not get larger paintings');
 }
});

import {DESK_PAPERS,fitPhiDesktopModel} from '../gallery/visit/phi-reception-desk.mjs';
test('reception desk props fit their surfaces and the tower poster sits above the credits',()=>{
 const phi=buildPhiRendererPlan('__phi_reception__',[]),reception=planPhiReception(phi.floor,phi.circulation,phi.physical),poster=reception.signage[1];
 assert.ok(Math.abs(poster.x-reception.credits.x)<.01&&Math.abs(poster.z-reception.credits.z)<.01);assert.ok(poster.centreY-poster.height/2>2.3);
 assert.ok(phi.canWalk(reception.cabinet.x,reception.cabinet.z));assert.ok(Math.hypot(reception.cabinet.x-reception.desk.x,reception.cabinet.z-reception.desk.z)>2);
 for(const [filename,author,maximum] of [['magazine-cabinet.glb','JFN',1000000],['paper-clutter.glb','Sousinho',500000]]){
  const asset=glbMetadata(filename);assert.ok(asset.bytes<maximum,filename+' too large');assert.match(asset.doc.asset.extras.author,new RegExp(author));assert.match(asset.doc.asset.extras.license,/CC-BY-4.0/);
  assert.ok(asset.doc.meshes.every(m=>m.primitives.every(p=>!Object.keys(p.attributes).some(k=>/^TEXCOORD_[1-9]/.test(k)))),'Unused UV sets remain');
 }
 const model=new THREE.Group(),sheet=new THREE.Mesh(new THREE.BoxGeometry(27,3,18),new THREE.MeshBasicMaterial());sheet.position.set(4,8,12);model.add(sheet);
 const fitted=fitPhiDesktopModel(THREE,model,.3),box=new THREE.Box3().setFromObject(fitted),size=box.getSize(new THREE.Vector3());assert.ok(Math.abs(Math.max(size.x,size.z)-.3)<1e-5);assert.ok(Math.abs(box.min.y)<1e-5);
 assert.ok(DESK_PAPERS.filter(p=>p.y>1).every(p=>Math.abs(p.x)+p.width/2<1.95&&Math.abs(p.z)+p.width/2<.75),'Papers extend off the worktop');
});
