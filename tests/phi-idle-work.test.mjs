import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {addPhiReceptionRearWallMonitors} from '../gallery/visit/phi-reception-rear-wall-monitors.mjs';
const read=name=>readFileSync(new URL('../gallery/visit/'+name,import.meta.url),'utf8');

test('monitor checks stay throttled with exported video, fallback and distant visitors',()=>{
 const source=read('phi-reception-living-monitor.mjs');
 const body=source.match(/ function tick\(time\)\{([\s\S]*?)\n \}\n frameId=requestAnimationFrame/)[1];
 for(const [active,usingExport] of [[true,true],[false,false],[true,false]]){
  let checks=0,draws=0;
  const env={disposed:false,last:0,frameId:0,origin:0,draws:0,
   requestAnimationFrame:()=>1,remoteVisitorNearby:()=>false,
   root:{getWorldPosition(){}},camera:{getWorldPosition:()=>({distanceTo:()=>active?2:20})},
   monitorPosition:{},cameraPosition:{},media:{usingExport,update(){checks++;}},
   infoRow:{update(){}},loadSource(){},canvases:[{}, {}, {}],textures:[{}, {}, {}],draw(){draws++;}};
  const tick=new Function('env','with(env){return function tick(time){'+body+'}}')(env);
  for(let frame=0;frame<=60;frame++)tick(frame*1000/60);
  assert.ok(checks>=6&&checks<=7,`checks=${checks}, active=${active}, export=${usingExport}`);
  assert.equal(draws,active&&!usingExport?checks*3:0);
 }
});

test('map redraws only on changes and responds to movement, turning, floor, mode and resize',()=>{
 const source=read('gallery-phi.js');
 const body=source.slice(source.indexOf('let lastMapView=null;'),source.indexOf('\nfunction onPhiPlaza'));
 let paints=0;const canvas={width:200,height:160};
 const env={plan:{phi:{world:{}}},phiMapMode:'physical',rig:{position:{x:0,z:0}},yaw:0,
  exhibitDate:'reception',currentFloor:0,liftPosition:{x:0,z:0},$:()=>canvas,drawPhiMap(){paints++;}};
 const draw=new Function('env','with(env){'+body+';return drawMap;}')(env);
 for(let i=0;i<100;i++)draw();assert.equal(paints,1);
 for(const mutate of [()=>env.rig.position.x++,()=>env.yaw+=.1,()=>env.currentFloor++,
  ()=>env.phiMapMode='merged',()=>canvas.width++,()=>env.plan={phi:{world:{}}}]){
  const before=paints;mutate();draw();draw();assert.equal(paints,before+1);
 }
});

test('large screen crop is cached until its source UV changes, preserving the resulting coordinates',()=>{
 const oldRAF=globalThis.requestAnimationFrame,oldCancel=globalThis.cancelAnimationFrame;
 let callback;globalThis.requestAnimationFrame=fn=>{callback=fn;return 1;};globalThis.cancelAnimationFrame=()=>{};
 let installation;
 try{
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();
  const sources=Array.from({length:4},()=>new THREE.Mesh(new THREE.PlaneGeometry(1.6,1),new THREE.MeshBasicMaterial()));
  installation=addPhiReceptionRearWallMonitors(THREE,scene,{wall:{fromPhysical:true,x:0,z:0,yaw:0,span:10,width:1.2},elevation:0,camera,sourceScreens:sources});
  assert.ok(installation);
  const uv=sources[0].geometry.getAttribute('uv'),getX=uv.getX.bind(uv);let reads=0;
  uv.getX=i=>{reads++;return getX(i);};
  for(let time=125;time<=1000;time+=125)callback(time);
  assert.equal(reads,0,'unchanged main pane must skip all crop calculations');
  const faces=[];installation.root.traverse(o=>{if(o.material===sources[0].material&&o.isMesh)faces.push(o);});
  const before=Array.from(faces[0].geometry.getAttribute('uv').array);
  uv.needsUpdate=true;callback(1125);assert.ok(reads>0);
  assert.deepEqual(Array.from(faces[0].geometry.getAttribute('uv').array),before);
  for(let i=0;i<uv.count;i++)uv.setXY(i,getX(i)/3,uv.getY(i)/2);
  uv.needsUpdate=true;callback(1250);
  assert.notDeepEqual(Array.from(faces[0].geometry.getAttribute('uv').array),before,'atlas transition refreshes the crop');
 }finally{installation?.dispose();globalThis.requestAnimationFrame=oldRAF;globalThis.cancelAnimationFrame=oldCancel;}
});
