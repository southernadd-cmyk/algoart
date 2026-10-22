import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { buildLayout, footprintAt, canStand, DOOR_WIDTH, ROOM_HEIGHT, PHI } from './layout-v2.mjs';
import { planGalleryHangs } from './hanging-v3.mjs';
import { planGallerySculptures,clearOfSculptures,validateSculpturePlacement } from './sculptures.mjs';
import { createPortraitSculpture, setSculptureArchitecturalMaterials } from './sculpture-render-traced.mjs?v=portrait-reference-fix-20261022';
import { createArchitecturalMaterials, tiledBoxUvs } from './architectural-materials.mjs';
import { resolveStudyMaterial } from './study-material.mjs';
import { createExteriorLandscape } from './environment-render.mjs?v=hdr-panorama-20261022';
import { planVisitors,renderVisitors,renderPlazaSeatedVisitors } from './visitors.mjs?v=cors-and-textures-20261022';
import {replaceFixtureWithProp} from './polyhaven-props.mjs?v=texture-manifest-20261022';

const $ = (id) => document.getElementById(id);
const canvas = $('world');
const status = $('status');
const welcome = $('welcome');
const errorBox = $('error');
const enter = $('enter');
const pressed = new Set();
const touchPressed = new Set();
const clock = new THREE.Clock();
const artExhibits = [];
const sculpturePlacements=[];
let currentInfoExhibit = null;
let focusCandidate = null;
let focusDuration = 0;
let dismissedExhibit = null;
let lastFocusCheck = 0;
let mapElapsed = 0;
let yaw = Math.PI, pitch = 0;
let exhibitDate = null;
let archiveDates=[];
let towerFloorSignatures=new Map();
let arrival=null;
let liftPosition=null;
let liftWasNear=false;
let liftTravelling=false;
let editionObjects=[];
let deferredGalleryJobs=[];
let deferredGalleryVersion=0;
let deferredGalleryRunning=false;
let liftDoors=[];
let liftDoorClosure=0;
let liftDoorTarget=0;
let liftCabinPosition=null;
let currentFloor=0;
const FLOOR_SPACING=6.2;
let plan = null;
let studyList = [];
let touchPointer = null;
let touchX = 0, touchY = 0;
let xrLiftPanel=null;
let xrFloorChoice=0;
let xrTurnLatched=false;
const xrPickerRay=new THREE.Raycaster();

const scene = new THREE.Scene();
scene.background = new THREE.Color('#c2cbc5');
scene.fog = new THREE.Fog('#c2cbc5', 48, 165);
scene.add(new THREE.HemisphereLight('#f6f7f5', '#92998c', 1.15));
const sun = new THREE.DirectionalLight('#fff9f0', 1.65);
sun.position.set(-18, 30, 12);
scene.add(sun);
const camera = new THREE.PerspectiveCamera(76, 1, 0.07, 210);
camera.rotation.order = 'YXZ';
camera.position.set(0, 1.68, 0);
const rig = new THREE.Group();
scene.add(rig);
rig.add(camera);
rig.rotation.y = yaw;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, matchMedia('(pointer:coarse)').matches ? 1.35 : 1.7));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local-floor');
  const xrButton = VRButton.createButton(renderer);
  $('xr-controls').appendChild(xrButton);
  renderer.xr.addEventListener('sessionstart', () => {
    welcome.hidden=true;resetInspection();$('lift').hidden=true;
  });
  renderer.xr.addEventListener('sessionend',()=>{
    closeXRLift();xrTurnLatched=false;liftWasNear=false;
  });
  for(let i=0;i<2;i++){
    const controller=renderer.xr.getController(i);
    controller.addEventListener('select',()=>selectXRLift(controller));
    rig.add(controller); // Controllers share the headset's locomotion transform.
  }
} catch (err) {
  errorBox.textContent = 'This device cannot initialise a WebGL gallery: ' + err.message;
  errorBox.hidden = false;
}

const galleryFinish=createArchitecturalMaterials(THREE,{
  lowPower:matchMedia('(pointer:coarse), (prefers-reduced-motion: reduce)').matches
});
const wall=galleryFinish.wall;
const floor=galleryFinish.floor;
const timber=galleryFinish.timber;
const stone=galleryFinish.stone;
const join=galleryFinish.trims;
setSculptureArchitecturalMaterials({plinth:galleryFinish.plinth,metal:galleryFinish.trims});
const dark = new THREE.MeshStandardMaterial({color: '#393b35', metalness: .16, roughness: .74});
const bridgeSurface=galleryFinish.stoneBridge;
const frame = new THREE.MeshStandardMaterial({color: '#34322e', roughness: .85});
const roofFinish=galleryFinish.plinth;
const skylightGlass = new THREE.MeshPhysicalMaterial({color:'#d5e1df',metalness:.06,roughness:.22,transparent:true,opacity:.6,side:THREE.DoubleSide,depthWrite:false});

function block(w, h, d, x, y, z, material = wall) {
  const geometry=new THREE.BoxGeometry(w,h,d);
  if(material.userData?.tileMeters)
    tiledBoxUvs(geometry,w,h,d,material.userData.tileMeters);
  const mesh=new THREE.Mesh(geometry,material);
  mesh.position.set(x,y,z);
  scene.add(mesh);
  return mesh;
}
function labelTexture(title, seed) {
  const c = document.createElement('canvas');
  c.width = 900; c.height = 210;
  const g = c.getContext('2d');
  g.fillStyle = '#eeeae0'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#343a36'; g.font = '36px Georgia';
  const display = title.length > 46 ? title.slice(0, 43) + '…' : title;
  g.fillText(display, 45, 93, 820);
  g.font = '24px Arial'; g.fillStyle = '#66675e';
  g.fillText(seed, 46, 147, 820);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Four-sided rooms: each connector creates a genuine portal in its wall.
let exteriorBrick=null;
function addWallWithOpening(room, side) {
  const horizontal = side === 'north' || side === 'south';
  const length = horizontal ? room.width : room.depth;
  const w = .34, y = room.y + ROOM_HEIGHT / 2;
  const fixed = horizontal
    ? room.z + (side === 'north' ? -room.depth / 2 : room.depth / 2)
    : room.x + (side === 'west' ? -room.width / 2 : room.width / 2);
  const segment = (len,offset,height=ROOM_HEIGHT,heightY=y) => {
    if(horizontal)block(len,height,w,room.x+offset,heightY,fixed);
    else block(w,height,len,fixed,heightY,room.z+offset);
    // Brick veneer on the outside face only; inside stays plaster.
    if(exteriorBrick){
      const sign=side==='north'||side==='west'?-1:1;
      const surface=fixed+sign*(w/2+.016);
      if(horizontal)block(len,height,.026,room.x+offset,heightY,surface,exteriorBrick);
      else block(.026,height,len,surface,heightY,room.z+offset,exteriorBrick);
    }
  };
  if(!room.doors.includes(side) && side!==room.liftWall && side!==room.entranceWall) {
    segment(length,0);
    return;
  }
  const opening=side===room.liftWall?1.85:side===room.entranceWall?3.4:DOOR_WIDTH;
  const wing=(length-opening)/2;
  segment(wing,-(opening+wing)/2);
  segment(wing, (opening+wing)/2);
  const doorHeight=side===room.entranceWall?4.15:3.68;
  segment(opening,0,ROOM_HEIGHT-doorHeight,room.y+(ROOM_HEIGHT+doorHeight)/2);
  if(horizontal)block(opening+.09,.045,.43,room.x,room.y+doorHeight,fixed,join);
  else block(.43,.045,opening+.09,fixed,room.y+doorHeight,room.z,join);
}

function addRoom(room, index, count) {
  const ceiling=room.y+ROOM_HEIGHT;
  // One timber chamber in larger editions adds material rhythm while the
  // rest remain neutral and focused on the artwork.
  const surface=(count>=4&&index%5===2)?timber:(count>=5&&index%5===4)?stone:floor;
  block(room.width+.42,.36,room.depth+.42,room.x,room.y-.22,room.z,surface);
  for(const side of ['north','south','east','west'])addWallWithOpening(room,side);
  const roofStrip=(room.width-3.5)/2;
  block(roofStrip,.21,room.depth+.45,room.x-(room.width+3.5)/4,ceiling+.1,room.z,roofFinish);
  block(roofStrip,.21,room.depth+.45,room.x+(room.width+3.5)/4,ceiling+.1,room.z,roofFinish);
  // A continuous glazed skylight seals the centre opening between the roof slabs.
  // Light still reaches the drawings and the sky is visible from inside.
  block(3.5,.085,room.depth+.38,room.x,ceiling+.105,room.z,
    currentFloor===archiveDates.length-1?skylightGlass:roofFinish);
  for(const sx of [-1,1])block(.075,.13,room.depth+.43,room.x+sx*1.755,ceiling+.11,room.z,join);
  for(let i=1;i<4;i++)block(3.57,.13,.067,room.x,ceiling+.11,room.z-room.depth/2+room.depth*i/4,join);
  for(const z of [room.z-room.depth/2,room.z+room.depth/2])
    block(room.width+.47,.2,.37,room.x,ceiling+.15,z,join);
  for(const x of [room.x-room.width/2,room.x+room.width/2])
    block(.37,.2,room.depth+.47,x,ceiling+.15,room.z,join);
  // Slightly irregular phi divisions keep the floor a real composition,
  // rather than leaving a large, featureless rectangle under the paintings.
  const insetX=room.x+(1/PHI-.5)*room.width*.48;
  const insetZ=room.z-(1/PHI-.5)*room.depth*.44;
  block(.023,.02,room.depth-1.15,insetX,room.y+.018,room.z,join);
  block(room.width-1.15,.02,.023,room.x,room.y+.018,insetZ,join);
  // The room fill is deliberately subdued: exhibit fittings provide focus.
  // Ambient and a constant-sized spotlight pool light the occupied rooms.
  // Avoid allocating a separate point light per room.

}
function makeRoomLabel(text) {
  const c = document.createElement('canvas');
  c.width = 640; c.height = 110;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#363b35'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.font = '42px Georgia'; ctx.fillStyle = '#eee8db'; ctx.textAlign = 'center';
  ctx.fillText(text, 320, 71, 600);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(2.9, .5), new THREE.MeshBasicMaterial({map:t, side:THREE.DoubleSide}));
}

function addBridge(hall) {
  const across=hall.axis==='x' ? new THREE.Vector3(0,0,1) : new THREE.Vector3(1,0,0);
  const w=DOOR_WIDTH/2;
  const a=new THREE.Vector3(hall.start.x,hall.start.y,hall.start.z);
  const b=new THREE.Vector3(hall.end.x,hall.end.y,hall.end.z);
  const a0=a.clone().addScaledVector(across,-w);
  const a1=a.clone().addScaledVector(across,w);
  const b0=b.clone().addScaledVector(across,-w);
  const b1=b.clone().addScaledVector(across,w);
  const vertices=new Float32Array([...a0.toArray(),...a1.toArray(),...b0.toArray(),...b1.toArray()]);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(vertices,3));
  const tiles=Math.max(.3,hall.length/2.25);
  geometry.setAttribute('uv',new THREE.BufferAttribute(new Float32Array([
    0,0,0,DOOR_WIDTH/2.25,tiles,0,tiles,DOOR_WIDTH/2.25
  ]),2));
  geometry.setIndex([0,2,1,1,2,3]);
  geometry.computeVertexNormals();
  scene.add(new THREE.Mesh(geometry,bridgeSurface));
  // Open-air links and suspended rails make the changes in floor level visible.
  for(const side of [-1,1]){
    const p0=a.clone().addScaledVector(across,side*(w-.13));
    const p1=b.clone().addScaledVector(across,side*(w-.13));
    p0.y+=.9;p1.y+=.9;
    const dir=p1.clone().sub(p0);
    const rail=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,dir.length(),7),join);
    rail.position.copy(p0).add(p1).multiplyScalar(.5);
    rail.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());
    scene.add(rail);
    for(const p of [p0,p1]){
      block(.075,.85,.075,p.x,p.y-.4,p.z,dark);
    }
  }
}
// Restrict simultaneous downloads/decodes on phones; artwork is never omitted.
const mobileImages=matchMedia('(pointer:coarse)').matches;
const artworkQueue=[];
let artworkActive=0;
function scheduleArtwork(task){
  artworkQueue.push(task);
  const drain=()=>{
    while(artworkActive<(mobileImages?3:8)&&artworkQueue.length){
      const next=artworkQueue.shift();
      artworkActive++;
      Promise.resolve().then(next).finally(()=>{artworkActive--;drain();});
    }
  };
  drain();
}
// Failed image requests are retried after transient network/deployment errors.
// Only current-edition materials may be retried after a tab regains focus.
const failedArtworkLoads=new Map();
window.addEventListener('visibilitychange',()=>{
  if(document.visibilityState!=='visible')return;
  for(const [material,url] of [...failedArtworkLoads]){
    if(material.userData.galleryDisposed){failedArtworkLoads.delete(material);continue;}
    failedArtworkLoads.delete(material);
    loadArtworkTexture(url,material);
  }
});
function loadArtworkTexture(url, material) {
 scheduleArtwork(()=>new Promise(resolve=>{
  let finished=false;
  const finish=()=>{if(!finished){finished=true;resolve();}};
  const source=new URL(url,location.href);
  // Published archive images also exist in the public repository. Try the
  // independently served CDN if Pages returns an error or cannot decode one.
  const galleryPath=source.pathname.match(/\/gallery\/(\d{4}-\d{2}-\d{2}\/[^/]+\.(?:jpe?g|png|webp))$/i);
  const fallback=galleryPath
    ?'https://cdn.jsdelivr.net/gh/southernadd-cmyk/algoart@main/gallery/'+galleryPath[1]
    :null;
  // GitHub Releases reject cross-origin canvas reads. Route release
  // artwork via a CORS-capable image cache instead of retrying github.com.
  const isRelease=source.hostname==='github.com'&&source.pathname.includes('/releases/download/');
  const proxiedRelease=isRelease
    ?'https://wsrv.nl/?url='+encodeURIComponent(source.href)+'&w='+(mobileImages?640:1100)+'&output=jpg'
    :null;
  const requests=isRelease
    ?[proxiedRelease,proxiedRelease+'&q=88']
    :[source.href,source.href+(source.search?'&':'?')+'galleryRetry=1'];
  if(fallback)requests.push(fallback);
  let index=0;
  function attempt(){
   if(material.userData.galleryDisposed){finish();return;}
   if(index>=requests.length){
    material.color.set('#c9ad9b');material.needsUpdate=true;
    failedArtworkLoads.set(material,url);
    console.warn('Artwork failed at Pages and CDN:',url);
    finish();return;
   }
   const candidate=requests[index++];
   const image=new Image();
   image.crossOrigin='anonymous';
   image.decoding='async';
   image.onload=()=>{
    if(material.userData.galleryDisposed){finish();return;}
    try{
     if(!image.naturalWidth||!image.naturalHeight)throw Error('Empty image');
     const maxSize=mobileImages?640:1100;
     const scale=Math.min(1,maxSize/Math.max(image.naturalWidth,image.naturalHeight));
     const canvas=document.createElement('canvas');
     canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));
     canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
     canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
     const texture=new THREE.CanvasTexture(canvas);
     texture.colorSpace=THREE.SRGBColorSpace;
     texture.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),4);
     if(material.map)material.map.dispose();
     material.map=texture;material.color.set('#ffffff');material.needsUpdate=true;
     failedArtworkLoads.delete(material);
     finish();
    }catch(error){
     console.warn('Artwork could not be decoded:',candidate,error);
     setTimeout(attempt,400);
    }
   };
   image.onerror=()=>{console.warn('Artwork request failed:',candidate);setTimeout(attempt,400);};
   image.src=candidate;
  }
  attempt();
 }));
}
// Stage 2: landscape images occupy walls. Portraits become freestanding
// layered engine-specific sculptures, with a clear walking route around them.
// Aim a real exhibition spotlight at its individual exhibit, not a generic wall.
const fittingMaterial=new THREE.MeshStandardMaterial({color:'#484743',metalness:.7,roughness:.32});
const fittingGeometry=new THREE.CylinderGeometry(.115,.16,.22,10);
// These resources persist across editions; other edition-owned assets are disposed.
fittingGeometry.userData.galleryPersistent=true;
for(const material of [...Object.values(galleryFinish),dark,frame,skylightGlass,fittingMaterial]){
  if(material?.isMaterial)material.userData.galleryPersistent=true;
}
const exhibitLightTargets=[];
const exhibitSpotPool=Array.from({length:5},()=>{
  const light=new THREE.SpotLight('#fff6e8',0,9,.42,.76,1.7);
  scene.add(light,light.target);
  return light;
});
function updateExhibitLighting(){
  if(!plan)return;
  const nearest=exhibitLightTargets.slice()
    .sort((a,b)=>a.position.distanceToSquared(rig.position)-b.position.distanceToSquared(rig.position));
  for(let i=0;i<exhibitSpotPool.length;i++){
    const light=exhibitSpotPool[i],fixture=nearest[i];
    if(!fixture){light.intensity=0;continue;}
    light.position.copy(fixture.position);
    light.target.position.copy(fixture.target);
    light.angle=fixture.beam;
    light.intensity=fixture.power;
    light.target.updateMatrixWorld();
  }
}
function exhibitLight(room,position,target,{beam=.38,power=18}={}){
  exhibitLightTargets.push({position:position.clone(),target:target.clone(),beam,power});
  const head=new THREE.Mesh(fittingGeometry,fittingMaterial);
  head.position.copy(position);
  head.quaternion.setFromUnitVectors(new THREE.Vector3(0,-1,0),
    target.clone().sub(position).normalize());
  scene.add(head);
}
function hangArt(room, study, hang) {
  const width = hang.width, height = hang.height;
  const rotation = {
    north: 0, south: Math.PI, west: Math.PI/2, east: -Math.PI/2
  }[hang.surface];
  const normal = new THREE.Vector3(Math.sin(rotation), 0, Math.cos(rotation));
  const base = new THREE.Vector3(hang.x, hang.y, hang.z);
  const surround = new THREE.Mesh(new THREE.BoxGeometry(width + .14, height + .14, .065), frame);
  surround.position.copy(base);
  surround.rotation.y = rotation;
  scene.add(surround);

  const artworkMaterial = new THREE.MeshBasicMaterial({color: '#eae5d9',side: THREE.DoubleSide});
  const artwork = new THREE.Mesh(new THREE.PlaneGeometry(width, height), artworkMaterial);
  artwork.position.copy(base).addScaledVector(normal, .038);
  artwork.rotation.y = rotation;
  artwork.userData.study = study;
  scene.add(artwork);
  artExhibits.push({study,position:artwork.position.clone(),normal:normal.clone()});
  loadArtworkTexture(study.image, artworkMaterial);
  const lamp=base.clone().addScaledVector(normal,1.35);
  lamp.y=Math.min(room.y+ROOM_HEIGHT-.35,hang.y+height*.66+1.25);
  exhibitLight(room,lamp,base,{beam:Math.max(.28,Math.min(.56,Math.atan(width/2/1.45)*1.25)),power:17});

  const labelWidth = Math.min(2.06, Math.max(1.48, width * .73));
  const caption = new THREE.Mesh(
    new THREE.PlaneGeometry(labelWidth, labelWidth * 210 / 900),
    new THREE.MeshBasicMaterial({map: labelTexture(study.title, study.seed), side: THREE.DoubleSide})
  );
  caption.position.copy(base).addScaledVector(normal, .043);
  caption.position.y = hang.y - height / 2 - .30;
  caption.rotation.y = rotation;
  scene.add(caption);
}
function addArchiveLift(room){
  // Separate external cabin behind a real opening in the reserved gallery wall.
  const side=room.liftWall;
  const normal=new THREE.Vector3(side==='east'?-1:side==='west'?1:0,0,
    side==='north'?1:side==='south'?-1:0); // towards room centre
  const tangent=new THREE.Vector3(normal.z,0,-normal.x);
  const offset=(side==='north'||side==='south'?room.depth:room.width)/2-.3;
  const doorCentre=new THREE.Vector3(room.x,room.y,room.z).addScaledVector(normal,-offset-.18);
  const depth=1.9, width=2.3, height=2.65;
  const origin=doorCentre.clone().addScaledVector(normal,-depth*.5);
  const metal=new THREE.MeshStandardMaterial({color:'#a2a9aa',metalness:.72,roughness:.34});
  const brushed=new THREE.MeshStandardMaterial({color:'#c4c8c5',metalness:.64,roughness:.42});
  const rubber=new THREE.MeshStandardMaterial({color:'#343a38',metalness:.06,roughness:.88});
  const glass=new THREE.MeshStandardMaterial({color:'#f3f1e4',emissive:'#fff9e5',emissiveIntensity:.55,roughness:.8});
  const local=(u,v,w)=>origin.clone().addScaledVector(tangent,u).addScaledVector(normal,w).add(new THREE.Vector3(0,v,0));
  const part=(w,h,d,u,v,z,material)=>{
    const p=local(u,v,z);const mesh=block(w,h,d,p.x,p.y,p.z,material);
    mesh.rotation.y=Math.atan2(normal.x,normal.z);
    return mesh;
  };
  // Quiet stone-and-bronze portal with a recessed shadow reveal.
  const portal=new THREE.MeshStandardMaterial({color:'#dedbd1',roughness:.9});
  const bronze=new THREE.MeshStandardMaterial({color:'#555750',metalness:.43,roughness:.45});
  part(width,.14,depth,0,.035,0,rubber);
  part(width,.14,depth,0,height,0,brushed);
  part(width,height,.11,0,height*.5,-depth*.5,brushed);
  for(const u of [-1,1]){
    part(.11,height,depth,u*width*.5,height*.5,0,metal);
    part(.055,.07,depth,u*(width*.5-.1),1.04,0,metal);
  }
  // Surround faces the visitor at the gallery-side threshold.
  const face=depth*.5+.075;
  for(const u of [-1,1]){
    part(.22,3.05,.23,u*(width*.5+.10),1.525,face,portal);
    part(.038,2.62,.08,u*(width*.5-.015),1.31,face+.135,bronze);
  }
  part(width+.48,.24,.28,0,3.05,face,portal);
  part(width+.12,.045,.13,0,2.82,face+.14,bronze);
  part(width+.5,.075,.36,0,3.52,face-.06,bronze);
  // Two independently animated sliding leaves.
  liftDoors=[];
  liftDoorClosure=0;liftDoorTarget=0;
  for(const u of [-1,1]){
    const leaf=part(.92,2.3,.075,u*.47,1.2,depth*.5-.02,metal);
    leaf.userData.closed=leaf.position.clone();
    leaf.userData.open=leaf.position.clone().addScaledVector(tangent,u*.91);
    leaf.position.copy(leaf.userData.open);
    liftDoors.push(leaf);
  }
  part(.85,.065,.58,0,height-.11,0,glass);
  const lamp=new THREE.PointLight('#fff9ed',3.8,4,2);
  lamp.position.copy(local(0,height-.28,0));scene.add(lamp);
  // The controls are positioned on the inside side wall, not floating in space.
  part(.04,.9,.52,width*.5-.07,1.48,-.02,rubber);
  for(let i=0;i<4;i++)part(.055,.055,.055,width*.5-.115,1.7-i*.19,.1,glass);
  liftCabinPosition=local(0,0,0);
  liftPosition=local(0,0,.12);
  // Purpose-made readable signage, centred ABOVE the lintel rather than hidden behind it.
  const signCanvas=document.createElement('canvas');
  signCanvas.width=768;signCanvas.height=192;
  const g=signCanvas.getContext('2d');
  g.fillStyle='#e9e5dc';g.fillRect(0,0,768,192);
  g.fillStyle='#333b39';g.textAlign='center';
  g.font='600 52px Georgia, serif';g.fillText('archive lift',384,81);
  g.font='28px Arial, sans-serif';g.fillText('daily exhibitions',384,139);
  const signTexture=new THREE.CanvasTexture(signCanvas);
  signTexture.colorSpace=THREE.SRGBColorSpace;
  const heading=new THREE.Mesh(new THREE.PlaneGeometry(2.13,.53),
    new THREE.MeshBasicMaterial({map:signTexture,side:THREE.DoubleSide}));
  heading.position.copy(local(0,3.31,face+.17));
  heading.rotation.y=Math.atan2(normal.x,normal.z);
  scene.add(heading);
  // Simple floor-status display and a small call button beside the portal.
  const panel=new THREE.Mesh(new THREE.PlaneGeometry(.22,.31),
    new THREE.MeshBasicMaterial({color:'#303c3d',side:THREE.DoubleSide}));
  panel.position.copy(local(width*.5+.16,2.08,face+.18));
  panel.rotation.y=heading.rotation.y;scene.add(panel);
  const indicator=new THREE.Mesh(new THREE.PlaneGeometry(.10,.10),
    new THREE.MeshBasicMaterial({color:'#cdd9c1',side:THREE.DoubleSide}));
  indicator.position.copy(local(width*.5+.16,2.1,face+.19));
  indicator.rotation.y=heading.rotation.y;scene.add(indicator);
}
function setLiftDoors(closed){
  liftDoorTarget=closed?1:0;
}
function animateLiftDoors(dt){
  const step=Math.min(1,dt*2.1);
  liftDoorClosure+=Math.sign(liftDoorTarget-liftDoorClosure)*Math.min(step,Math.abs(liftDoorTarget-liftDoorClosure));
  for(const leaf of liftDoors)leaf.position.copy(leaf.userData.open).lerp(leaf.userData.closed,liftDoorClosure);
}

function nearLift(){
  if(!liftPosition)return false;
  // In VR the headset can move relative to the locomotion rig.
  const position=renderer?.xr.isPresenting
    ?renderer.xr.getCamera(camera).getWorldPosition(new THREE.Vector3())
    :rig.position;
  return Math.hypot(position.x-liftPosition.x,position.z-liftPosition.z)<1.15;
}
// A controller-operated, world-space lift panel: HTML panels are invisible in VR.
function paintXRLift(message='Point a controller and press the trigger'){
  if(!xrLiftPanel)return;
  const {canvas,texture}=xrLiftPanel;
  const c=canvas.getContext('2d');
  c.fillStyle='#f3efe6';c.fillRect(0,0,840,500);
  c.fillStyle='#26342d';c.font='bold 27px Arial';c.fillText('ARCHIVE LIFT',42,58);
  c.font='24px Arial';c.fillText('Choose an exhibition floor',42,122);
  c.font='45px Georgia';
  c.fillText('Floor '+(xrFloorChoice===0?'G':xrFloorChoice),42,197);
  c.font='23px Arial';c.fillStyle='#4e5b53';
  c.fillText(readableDate(archiveDates[xrFloorChoice]||exhibitDate),42,242);
  c.font='21px Arial';c.fillText(message,42,291);
  const buttons=[
    {name:'Previous',x:35,w:230,disabled:xrFloorChoice<=0},
    {name:xrFloorChoice===currentFloor?'Close':'Travel',x:278,w:280,disabled:false},
    {name:'Next',x:570,w:235,disabled:xrFloorChoice>=archiveDates.length-1}
  ];
  for(const b of buttons){
    c.fillStyle=b.disabled?'#d9dbd5':'#31463b';
    c.fillRect(b.x,341,b.w,98);
    c.fillStyle=b.disabled?'#919992':'#ffffff';
    c.textAlign='center';c.font='bold 26px Arial';
    c.fillText(b.name,b.x+b.w/2,399);
  }
  c.textAlign='left';c.font='19px Arial';c.fillStyle='#4e5b53';
  c.fillText('Move away from the lift to dismiss',40,478);
  texture.needsUpdate=true;
}
function paintXRTravel(index){
  if(!xrLiftPanel)return;
  const {canvas,texture}=xrLiftPanel;
  const c=canvas.getContext('2d');
  c.fillStyle='#293b33';c.fillRect(0,0,840,500);
  c.fillStyle='#f5f2e9';c.font='34px Georgia';c.fillText('Travelling to floor '+(index===0?'G':index),55,182);
  c.font='23px Arial';c.fillText('Loading the exhibition…',55,255);
  texture.needsUpdate=true;
}
function openXRLift(){
  if(xrLiftPanel || !renderer.xr.isPresenting || !archiveDates.length)return;
  xrFloorChoice=Math.max(0,archiveDates.indexOf(exhibitDate));
  const eye=renderer.xr.getCamera(camera);
  const eyePos=eye.getWorldPosition(new THREE.Vector3());
  const forward=eye.getWorldDirection(new THREE.Vector3());
  forward.y=0;if(forward.lengthSq()<.01)forward.set(0,0,-1);
  forward.normalize();
  const canvas=document.createElement('canvas');canvas.width=840;canvas.height=500;
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const material=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,depthTest:false,depthWrite:false});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1.68,1),material);
  mesh.renderOrder=999;
  mesh.position.copy(eyePos).addScaledVector(forward,1.35);
  mesh.position.y-=.05;
  mesh.lookAt(eyePos);
  scene.add(mesh);
  xrLiftPanel={mesh,canvas,texture};
  paintXRLift();
}
function closeXRLift(){
  if(!xrLiftPanel)return;
  const {mesh,texture}=xrLiftPanel;
  scene.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();texture.dispose();
  xrLiftPanel=null;
}
function selectXRLift(controller){
  if(!xrLiftPanel || liftTravelling)return;
  const from=new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld);
  const direction=new THREE.Vector3(0,0,-1).transformDirection(controller.matrixWorld);
  xrPickerRay.set(from,direction);
  let hit=xrPickerRay.intersectObject(xrLiftPanel.mesh,false)[0];
  // Gaze fallback also supports headsets without a tracked pointing controller.
  if(!hit){
    const eye=renderer.xr.getCamera(camera);
    xrPickerRay.set(eye.getWorldPosition(new THREE.Vector3()),
      eye.getWorldDirection(new THREE.Vector3()));
    hit=xrPickerRay.intersectObject(xrLiftPanel.mesh,false)[0];
  }
  if(!hit?.uv)return;
  const x=hit.uv.x*840,y=(1-hit.uv.y)*500;
  if(y<341||y>439)return;
  if(x>=35&&x<=265)xrFloorChoice=Math.max(0,xrFloorChoice-1);
  else if(x>=570&&x<=805)xrFloorChoice=Math.min(archiveDates.length-1,xrFloorChoice+1);
  else if(x>=278&&x<=558){
    if(xrFloorChoice===currentFloor)closeXRLift();
    else travelLift(archiveDates[xrFloorChoice],xrFloorChoice);
    return;
  }
  paintXRLift();
}
function openLift(){
  if(!liftPosition||liftTravelling)return;
  if(renderer.xr.isPresenting){openXRLift();return;}
  document.exitPointerLock?.();
  $('lift').hidden=false;
  renderLiftCalendar();
  $('closeLift').focus();
}
async function travelLift(date,index){
  if(liftTravelling)return;
  liftTravelling=true;
  const xrRide=renderer.xr.isPresenting;
  if(xrRide)paintXRTravel(index);
  $('lift').hidden=true;
  if(!xrRide)document.exitPointerLock?.();
  const overlay=$('liftAnimation');
  if(!xrRide)overlay.hidden=false;
  setLiftDoors(true);
  const current=Math.max(0,archiveDates.indexOf(exhibitDate));
  $('liftDirection').textContent=(index>current?'Ascending':'Descending')+' · '+Math.abs(index-current)+' floors';
  overlay.classList.toggle('descending',index<current);
  overlay.classList.toggle('ascending',index>current);
  $('liftDestination').textContent='Floor '+(index===0?'G':index)+' · '+readableDate(date);
  const begin=performance.now();
  try{
    await loadEdition(date,{viaLift:true});
    // Keep doors closed long enough to make the ride perceptible.
    await new Promise(resolve=>setTimeout(resolve,Math.max(0,1300-(performance.now()-begin))));
    overlay.hidden=true;
    if(xrRide)closeXRLift();
    if(!xrRide){
      $('liftArrival').hidden=false;
      $('liftArrival').textContent='Doors opening · floor '+(index===0?'G':index);
      setTimeout(()=>$('liftArrival').hidden=true,1800);
    }
    setLiftDoors(false);
  }catch(error){
    overlay.hidden=true;setLiftDoors(false);
    errorBox.textContent='Lift could not reach that floor: '+error.message;
    errorBox.hidden=false;
    if(!xrRide)$('lift').hidden=false;
    else {
      if(!xrLiftPanel)openXRLift();
      paintXRLift('This floor did not load. Choose another.');
    }
  }finally{liftTravelling=false;}
}

function renderLiftCalendar(){
  const dates=archiveDates;
  const picker=$('liftMonth');
  const year=Number(picker.value.slice(0,4)),month=Number(picker.value.slice(5,7));
  if(!year||month<1||month>12)return;
  const available=new Set(dates);
  const grid=$('liftDays');
  grid.replaceChildren();
  const first=(new Date(Date.UTC(year,month-1,1)).getUTCDay()+6)%7;
  for(let i=0;i<first;i++)grid.appendChild(document.createElement('span'));
  const limit=new Date(Date.UTC(year,month,0)).getUTCDate();
  for(let day=1;day<=limit;day++){
    const date=picker.value+'-'+String(day).padStart(2,'0');
    const btn=document.createElement('button');
    btn.type='button';btn.textContent=String(day);
    btn.disabled=!available.has(date);
    btn.className=available.has(date)?'lift-available':'';
    if(date===exhibitDate)btn.classList.add('lift-current');
    if(available.has(date)){
      const index=dates.indexOf(date);
      btn.title=date+' — floor '+(index===0?'G':index);
      btn.setAttribute('aria-label',new Date(date+'T12:00:00Z').toLocaleDateString('en-GB',{dateStyle:'full',timeZone:'UTC'})+', floor '+(index===0?'ground':index));
      btn.addEventListener('click',()=>{
        if(date===exhibitDate){$('lift').hidden=true;return;}
        travelLift(date,index);
      });
    }
    grid.appendChild(btn);
  }
  const floor=dates.indexOf(exhibitDate);
  $('liftCurrent').textContent='Current floor '+(floor===0?'G':Math.max(0,floor))+' · '+readableDate(exhibitDate);
}
async function loadArchiveDates(){
  const res=await fetch('../../gallery/',{cache:'no-store'});
  if(!res.ok)throw new Error('Could not load the gallery archive.');
  const doc=new DOMParser().parseFromString(await res.text(),'text/html');
  const discovered=[...doc.querySelectorAll('a[href]')]
    .map(a=>a.getAttribute('href')?.match(/(?:^|\/)\d{4}-\d{2}-\d{2}(?=\/|$)/)?.[0]?.replace(/^\//,''))
    .filter(Boolean);
  const dates=[...new Set(discovered)].sort();
  if(!dates.length)throw new Error('No dated galleries found in archive.');
  return dates;
}
// A real outside approach, opening and architectural threshold at ground level.
function createGalleryArrival(room){
  const side=room.entranceWall;
  const outward=new THREE.Vector3(side==='east'?1:side==='west'?-1:0,0,
    side==='south'?1:side==='north'?-1:0);
  const transverse=new THREE.Vector3(outward.z,0,-outward.x);
  const edge=side==='north'||side==='south'?room.depth/2:room.width/2;
  const doorway=new THREE.Vector3(room.x,room.y,room.z).addScaledVector(outward,edge);
  const pathLength=26;
  const material=galleryFinish.stoneBridge;
  const place=(w,h,d,x,y,z,mat=material)=>{
    const g=new THREE.BoxGeometry(w,h,d);
    if(mat.userData?.tileMeters)tiledBoxUvs(g,w,h,d,mat.userData.tileMeters);
    const o=new THREE.Mesh(g,mat);o.position.set(x,y,z);scene.add(o);return o;
  };
  const midpoint=doorway.clone().addScaledVector(outward,pathLength/2+1);
  if(Math.abs(outward.z)>0)place(7,.19,pathLength+3,midpoint.x,room.y-.16,midpoint.z);
  else place(pathLength+3,.19,7,midpoint.x,room.y-.16,midpoint.z);
  // A substantial stone-framed portal with an illuminated gallery name.
  const crown=doorway.clone().addScaledVector(outward,.48);
  const top=room.y+4.35;
  if(Math.abs(outward.z)>0){
    place(5.1,.38,.95,crown.x,top,crown.z,galleryFinish.plinth);
    for(const dx of [-2.36,2.36])place(.42,4.35,.95,crown.x+dx,room.y+2.175,crown.z,galleryFinish.plinth);
  }else{
    place(.95,.38,5.1,crown.x,top,crown.z,galleryFinish.plinth);
    for(const dz of [-2.36,2.36])place(.95,4.35,.42,crown.x,room.y+2.175,crown.z+dz,galleryFinish.plinth);
  }
  const sign=makeRoomLabel('PROPORTION PIECE');
  sign.position.copy(crown).addScaledVector(outward,.55);
  sign.position.y=top+.55;
  sign.rotation.y=Math.atan2(outward.x,outward.z);
  scene.add(sign);
  // Entrance glass is transparent and leaves the centre walkable.
  for(const direction of [-1,1]){
    const panel=doorway.clone().addScaledVector(outward,.1).addScaledVector(transverse,direction*1.6);
    const glass=new THREE.Mesh(new THREE.BoxGeometry(1.2,3.9,.045),skylightGlass);
    glass.position.copy(panel);glass.position.y=room.y+2.02;
    glass.rotation.y=Math.atan2(outward.x,outward.z);
    scene.add(glass);
  }
  // Twin grounded planter beds and slender entrance lanterns frame the axis
  // without occupying the accessible central walking route.
  const bronze=new THREE.MeshStandardMaterial({color:'#41463f',metalness:.55,roughness:.42});
  const warm=new THREE.MeshStandardMaterial({color:'#fff2d7',emissive:'#f9d69d',emissiveIntensity:.8,roughness:.3});
  for(const sideSign of [-1,1]){
    const bed=doorway.clone().addScaledVector(outward,8).addScaledVector(transverse,sideSign*4.65);
    place(1.75,.56,1.75,bed.x,room.y+.20,bed.z,galleryFinish.stone);
    const shrub=new THREE.Mesh(new THREE.IcosahedronGeometry(.87,1),
      new THREE.MeshStandardMaterial({color:'#526d55',roughness:1,flatShading:true}));
    shrub.position.set(bed.x,room.y+1.02,bed.z);scene.add(shrub);
    const lamp=doorway.clone().addScaledVector(outward,3.2).addScaledVector(transverse,sideSign*3.25);
    place(.12,2.7,.12,lamp.x,room.y+1.35,lamp.z,bronze);
    place(.38,.42,.38,lamp.x,room.y+2.87,lamp.z,warm);
  }
  const start=doorway.clone().addScaledVector(outward,pathLength-2);
  arrival={doorway,outward,pathLength,halfWidth:3.25,baseY:room.y,
    start:new THREE.Vector3(start.x,room.y,start.z)};
}
function onArrivalPath(x,z){
  if(!arrival||currentFloor!==0)return false;
  const dx=x-arrival.doorway.x,dz=z-arrival.doorway.z;
  const along=dx*arrival.outward.x+dz*arrival.outward.z;
  const across=Math.abs(dx*arrival.outward.z-dz*arrival.outward.x);
  // Overlap the room footprint slightly to make crossing the threshold continuous.
  return along>=-1.0&&along<=arrival.pathLength+1.5&&across<=arrival.halfWidth;
}
// Stage costly exhibits across frames so the exterior is usable immediately.
function startDeferredGallery(){
  if(deferredGalleryRunning||!deferredGalleryJobs.length)return;
  deferredGalleryRunning=true;
  const version=deferredGalleryVersion;
  const step=()=>{
    if(version!==deferredGalleryVersion){deferredGalleryRunning=false;return;}
    const job=deferredGalleryJobs.shift();
    if(!job){deferredGalleryRunning=false;updateExhibitLighting();return;}
    try{
      const previous=new Set(scene.children);
      job();
      for(const object of scene.children)if(!previous.has(object))editionObjects.push(object);
    }catch(error){console.warn('Deferred gallery asset failed',error);}
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function constructGallery(layout, studies) {
  const entry=layout.rooms[0];
  // Reserve a complete unoccupied wall for the lift before the curator hangs art.
  entry.liftWall=['north','east','south','west'].find(side=>!entry.doors.includes(side));
  if(!entry.liftWall)throw new Error('No uninterrupted lift wall in entry gallery');
  // The street entrance is a separate free wall, never a footbridge or lift.
  if(currentFloor===0){
    entry.entranceWall=['south','east','west','north'].find(side=>side!==entry.liftWall&&!entry.doors.includes(side));
  }
  const hangs=planGalleryHangs(layout,studies);
  const sculptures=planGallerySculptures(layout,studies);
  validateSculpturePlacement(layout,sculptures);
  sculpturePlacements.push(...sculptures);
  const byId=new Map(studies.map(study=>[study.id,study]));
  const quality=matchMedia('(pointer:coarse)').matches?'mobile':'desktop';
  // Lightweight, locally generated buff brick: no network texture request.
  const brickCanvas=document.createElement('canvas');
  brickCanvas.width=512;brickCanvas.height=512;
  const bc=brickCanvas.getContext('2d');
  bc.fillStyle='#b6ad99';bc.fillRect(0,0,512,512);
  for(let row=0;row<16;row++){
    const top=row*32+2,offset=(row%2)*32;
    for(let col=-1;col<9;col++){
      const x=col*64+offset+2;
      const hash=((row*127+col*61+301)^((row+11)*(col+19)*17))>>>0;
      const light=hash%5;
      bc.fillStyle=['#ad9b80','#baa88b','#c3b396','#a89a83','#b5a78f'][light];
      bc.fillRect(x,top,60,28);
      bc.fillStyle='rgba(255,255,255,.075)';bc.fillRect(x+2,top+2,56,2);
      bc.fillStyle='rgba(65,59,47,.05)';bc.fillRect(x,top+25,60,3);
    }
  }
  const brickTexture=new THREE.CanvasTexture(brickCanvas);
  brickTexture.colorSpace=THREE.SRGBColorSpace;
  brickTexture.wrapS=brickTexture.wrapT=THREE.RepeatWrapping;
  brickTexture.anisotropy=2;
  exteriorBrick=new THREE.MeshStandardMaterial({
    map:brickTexture,color:'#f0e8db',roughness:.94,metalness:0
  });
  exteriorBrick.userData.tileMeters=3.2;
  for(const room of layout.rooms){
    addRoom(room,room.index,layout.rooms.length);
    for(const hanging of hangs.filter(h=>h.roomIndex===room.index))
      deferredGalleryJobs.push(()=>hangArt(room,byId.get(hanging.studyId),hanging));
    for(const placement of sculptures.filter(p=>p.roomIndex===room.index)){
      deferredGalleryJobs.push(()=>{
        const sculptureLamp=new THREE.Vector3(placement.x,room.y+ROOM_HEIGHT-.42,placement.z);
        exhibitLight(room,sculptureLamp,new THREE.Vector3(placement.x,room.y+1.22,placement.z),{beam:.47,power:12});
        createPortraitSculpture({
          scene,study:byId.get(placement.studyId),placement,quality,labelTexture
        });
        artExhibits.push({study:byId.get(placement.studyId),
          position:new THREE.Vector3(placement.x,placement.y+1.52,placement.z)});
      });
    }
  }
  // Decorative props are queued LAST: every painting gets its loader first.
  if(!galleryFinish.lowPower)for(const room of layout.rooms)deferredGalleryJobs.push(()=>{
    const fixtureRoot=new THREE.Group();scene.add(fixtureRoot);
    replaceFixtureWithProp(THREE,{
      id:'modern_ceiling_lamp_01',parent:fixtureRoot,
      position:new THREE.Vector3(room.x,room.y+ROOM_HEIGHT-1.0,room.z),
      width:.48,height:.9,depth:.48
    });
  });
  deferredGalleryJobs.push(()=>renderVisitors(THREE,scene,
    planVisitors(layout,hangs,sculptures,{lowPower:galleryFinish.lowPower})));
  if(hangs.length+sculptures.length!==studies.length)
    throw new Error('An archived study was omitted from the exhibition');
  for(const hall of layout.corridors)addBridge(hall);
  // Compute the entire tower footprint before placing any nearby buildings.
  // Upper-storey projections are protected even where the ground floor is empty.
  const exteriorFloorPlans=[];
  for(let level=0;level<archiveDates.length;level++){
    if(level===currentFloor)continue;
    const date=archiveDates[level],entries=towerFloorSignatures.get(date);
    if(!entries?.length)continue;
    exteriorFloorPlans.push({level,plan:buildLayout(date,entries.length,
      entries.map(([seed,engine])=>({seed,engine})))});
  }
  // The approach clearance is computed from the same front-door geometry.
  const groundLayout=currentFloor===0?layout:exteriorFloorPlans.find(f=>f.level===0)?.plan;
  const groundEntry=groundLayout?.rooms[0];
  const groundEntrance=groundEntry?.entranceWall||
    ['south','east','west','north'].find(side=>side!==['north','east','south','west'].find(s=>!groundEntry?.doors.includes(s))&&!groundEntry?.doors.includes(side));
  const entryApproach=groundEntry&&groundEntrance?(()=>{
    const room=groundEntry,side=groundEntrance;
    const outward={x:side==='east'?1:side==='west'?-1:0,
      z:side==='south'?1:side==='north'?-1:0};
    const edge=(outward.x?room.width:room.depth)/2;
    return {doorway:{x:room.x+outward.x*edge,z:room.z+outward.z*edge},
      outward,pathLength:26,halfWidth:3.5};
  })():null;
  // The civic square is anchored to the one permanent ground-floor entrance.
  const entryPlaza=entryApproach?(()=>{
    const {doorway,outward}=entryApproach;
    return {centre:{x:doorway.x+outward.x*19,z:doorway.z+outward.z*19},
      outward,transverse:{x:outward.z,z:-outward.x},
      halfWidth:23,halfDepth:19,level:groundEntry.y};
  })():null;
  createExteriorLandscape(THREE,scene,layout,studies,{lowPower:galleryFinish.lowPower,
    protectedLayouts:exteriorFloorPlans.map(f=>f.plan),approach:entryApproach,plaza:entryPlaza});
  if(entryPlaza)deferredGalleryJobs.push(()=>renderPlazaSeatedVisitors(THREE,scene,entryPlaza));
  // Rebuild each archived floor from its *own* daily seed signature.
  // Exterior-only geometry: no art, visitors, colliders or per-floor lights.
  const tower=new THREE.Group();
  // Opaque reflective architectural glazing avoids expensive mobile blending.
  const windowGlass=new THREE.MeshStandardMaterial({color:'#839ba1',metalness:.34,roughness:.19,side:THREE.DoubleSide});
  const tintedGlass=new THREE.MeshStandardMaterial({color:'#536d75',metalness:.27,roughness:.25,side:THREE.DoubleSide});
  const exteriorMetal=new THREE.MeshStandardMaterial({color:'#454c49',metalness:.55,roughness:.4});
  const put=(w,h,d,x,y,z,material=wall)=>{
    if(w<=0||h<=0||d<=0)return;
    const geometry=new THREE.BoxGeometry(w,h,d);
    if(material.userData?.tileMeters)tiledBoxUvs(geometry,w,h,d,material.userData.tileMeters);
    const mesh=new THREE.Mesh(geometry,material);
    mesh.position.set(x,y,z);tower.add(mesh);
  };
  for(let level=0;level<archiveDates.length;level++){
    if(level===currentFloor)continue;
    const date=archiveDates[level],entries=towerFloorSignatures.get(date);
    if(!entries?.length)continue; // Missing index data must not invent a layout.
    const floorPlan=exteriorFloorPlans.find(f=>f.level===level)?.plan;
    if(!floorPlan)continue;
    const base=level*FLOOR_SPACING;
    for(const room of floorPlan.rooms){
      const y=base+room.y;
      put(room.width+.42,.35,room.depth+.42,room.x,y-.2,room.z,galleryFinish.floor);
      put(room.width+.45,.24,room.depth+.45,room.x,y+ROOM_HEIGHT+.15,room.z,roofFinish);
      put(room.width+.76,.12,room.depth+.76,room.x,y+ROOM_HEIGHT-.09,room.z,join);
      put(room.width+.94,.17,room.depth+.94,room.x,y+ROOM_HEIGHT+.32,room.z,roofFinish);
      if(level===archiveDates.length-1){
        const edgeY=y+ROOM_HEIGHT+.66;
        for(const sign of [-1,1]){
          put(room.width+1.05,.53,.22,room.x,edgeY,room.z+sign*(room.depth+.87)/2,galleryFinish.plinth);
          put(.22,.53,room.depth+.95,room.x+sign*(room.width+.87)/2,edgeY,room.z,galleryFinish.plinth);
        }
      }
      for(const side of ['north','south','east','west']){
        const horizontal=side==='north'||side==='south';
        const length=horizontal?room.width:room.depth;
        const fixed=horizontal?room.z+(side==='north'?-room.depth/2:room.depth/2):
          room.x+(side==='west'?-room.width/2:room.width/2);
        const wallPart=(lengthPart,heightPart,offset,verticalCentre,material=exteriorBrick)=>{
          if(horizontal)put(lengthPart,heightPart,.34,room.x+offset,verticalCentre,fixed,material);
          else put(.34,heightPart,lengthPart,fixed,verticalCentre,room.z+offset,material);
        };
        const centre=y+ROOM_HEIGHT/2;
        const outside=side==='north'?-1:side==='south'?1:side==='west'?-1:1;
        const face=fixed+outside*.23;
        const trim=(span,height,offset,centreY,material=exteriorMetal)=>{
          if(horizontal)put(span,height,.10,room.x+offset,centreY,face,material);
          else put(.10,height,span,face,centreY,room.z+offset,material);
        };
        for(const bandY of [y+.32,y+ROOM_HEIGHT-.36])trim(length+.13,.085,0,bandY,join);
        if(room.doors.includes(side)){
          const opening=DOOR_WIDTH,wing=(length-opening)/2,doorHeight=3.68;
          wallPart(wing,ROOM_HEIGHT,-(opening+wing)/2,centre);
          wallPart(wing,ROOM_HEIGHT,(opening+wing)/2,centre);
          wallPart(opening,ROOM_HEIGHT-doorHeight,0,y+(ROOM_HEIGHT+doorHeight)/2);
          continue;
        }
        // Two genuine glazed wall openings (not windows painted over solid walls).
        const aperture=1.35,windowBottom=1.45,windowHeight=2.15;
        const positions=[-length*.24,length*.24];
        let previous=-length/2;
        for(const position of positions){
          const left=position-aperture/2,right=position+aperture/2;
          wallPart(left-previous,ROOM_HEIGHT,(previous+left)/2,centre);
          wallPart(aperture,windowBottom,position,y+windowBottom/2);
          const top=ROOM_HEIGHT-windowBottom-windowHeight;
          wallPart(aperture,top,position,y+windowBottom+windowHeight+top/2);
          wallPart(aperture,windowHeight,position,y+windowBottom+windowHeight/2,(level+room.index)%4===0?tintedGlass:windowGlass);
          // Real inset glazing bounded by projecting aluminium casements.
          trim(aperture+.22,.09,position,y+windowBottom);
          trim(aperture+.22,.09,position,y+windowBottom+windowHeight);
          for(const sign of [-1,1])trim(.09,windowHeight+.1,position+sign*(aperture/2+.045),y+windowBottom+windowHeight/2);
          trim(.055,windowHeight,position,y+windowBottom+windowHeight/2);
          trim(aperture+.42,.10,position,y+windowBottom-.16,join);
          trim(aperture+.38,.065,position,y+windowBottom+windowHeight+.16,join);
          previous=right;
        }
        wallPart(length/2-previous,ROOM_HEIGHT,(previous+length/2)/2,centre);
      }
    }
    // The actual corridor endpoints and gradients define each visible footbridge.
    for(const hall of floorPlan.corridors){
      const x1=hall.start.x,x2=hall.end.x,z1=hall.start.z,z2=hall.end.z;
      const y1=base+hall.start.y,y2=base+hall.end.y;
      const length=Math.hypot(x2-x1,z2-z1);
      const deck=new THREE.Mesh(new THREE.BoxGeometry(DOOR_WIDTH,.2,length),bridgeSurface);
      deck.position.set((x1+x2)/2,(y1+y2)/2-.07,(z1+z2)/2);
      deck.rotation.y=Math.atan2(x2-x1,z2-z1);
      deck.rotation.x=Math.atan2(y1-y2,length);
      tower.add(deck);
      for(const side of [-1,1]){
        const lateral=side*(DOOR_WIDTH/2-.13);
        const rail=new THREE.Mesh(new THREE.BoxGeometry(.08,.085,length),join);
        rail.position.set((x1+x2)/2+Math.cos(deck.rotation.y)*lateral,
          (y1+y2)/2+.92,(z1+z2)/2-Math.sin(deck.rotation.y)*lateral);
        rail.rotation.y=deck.rotation.y;rail.rotation.x=deck.rotation.x;
        tower.add(rail);
      }
    }
  }
  scene.add(tower);
  const first=layout.rooms[0];
  if(currentFloor===0 && first.entranceWall)createGalleryArrival(first);
  addArchiveLift(first);
  rig.position.set(first.x,first.y,first.z);
  const initial=layout.rooms[first.neighbours[0]];
  if(initial)yaw=Math.atan2(-(initial.x-first.x),-(initial.z-first.z));
  rig.rotation.y=yaw;
  drawMap();
}
function readArchive(html, url) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return [...doc.querySelectorAll('article.art-card')].map((card, i) => {
    const img=card.querySelector('.art-image-link img');
    const link=card.querySelector('a.remix');
    if (!img || !link) return null;
    const href = new URL(link.getAttribute('href'), url).href;
    const seed = card.querySelector('dd')?.textContent.trim() || new URL(href).searchParams.get('seed') || '';
    return {
      id: i,
      title: card.querySelector('h2')?.textContent.trim() || 'Untitled drawing',
      seed,
      image: (() => {
        const original=new URL(img.getAttribute('src'),url);
        // Release download URLs are blocked for canvas/WebGL by CORS.
        // Gallery release art is mirrored into same-origin Pages assets.
        if(original.hostname==='github.com' && original.pathname.includes('/southernadd-cmyk/algoart/releases/download/')){
          return new URL('../../gallery/release-art/'+original.pathname.split('/').pop(),location.href).href;
        }
        return original.href;
      })(),
      href,
      portrait: card.dataset.orientation === 'portrait' || Number(img.getAttribute('height')) > Number(img.getAttribute('width')),
      aspect: Number(img.getAttribute('width')) / Number(img.getAttribute('height')) || 1.4,
      engine: new URL(href).searchParams.get('mode') || 'field',
      material: resolveStudyMaterial(href,card.dataset.material || 'marker')
    };
  }).filter(Boolean);
}
async function latestDate() {
  const res = await fetch('../../gallery/', {cache:'no-store'});
  if (!res.ok) throw new Error('Could not load the daily archive.');
  const doc = new DOMParser().parseFromString(await res.text(),'text/html');
  const href = doc.querySelector('.day-card a')?.getAttribute('href') || '';
  const found = href.match(/\d{4}-\d{2}-\d{2}/);
  if (!found) throw new Error('No daily editions were found.');
  return found[0];
}
function readableDate(date) {
  return new Intl.DateTimeFormat('en-GB',{dateStyle:'long',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
}
async function loadEdition(date,{viaLift=false}={}) {
  if(!renderer)return;
  const url = new URL('../../gallery/'+date+'/', location.href);
  const res=await fetch(url,{cache:'no-store'});
  if(!res.ok)throw new Error('The edition for '+readableDate(date)+' is not available.');
  const studies=readArchive(await res.text(),res.url);
  if(!studies.length)throw new Error('No artworks for this edition');
  const nextPlan=buildLayout(date,studies.length,studies);
  const nextFloor=archiveDates.indexOf(date);
  if(nextFloor<0)throw new Error('Archive floor missing');
  const elevation=nextFloor*FLOOR_SPACING;
  for(const room of nextPlan.rooms)room.y+=elevation;
  for(const hall of nextPlan.corridors){hall.start.y+=elevation;hall.end.y+=elevation;}
  // Dispose *all* edition-owned GPU resources, including artwork maps and
  // procedural canvas textures, but not materials/geometry shared across floors.
  const staleGeometries=new Set(),staleMaterials=new Set(),staleTextures=new Set();
  for(const object of editionObjects){
    scene.remove(object);
    object.traverse?.(child=>{
      child.userData.galleryDisposed=true;
      if(child.geometry && !child.geometry.userData?.sharedVisitorAsset && !child.geometry.userData?.galleryPersistent)
        staleGeometries.add(child.geometry);
      const materials=Array.isArray(child.material)?child.material:[child.material];
      for(const material of materials){
        if(material?.isMaterial && !material.userData.galleryPersistent)staleMaterials.add(material);
      }
    });
  }
  for(const material of staleMaterials){
    material.userData.galleryDisposed=true;
    for(const value of Object.values(material)){
      if(value?.isTexture)staleTextures.add(value);
    }
    material.dispose();
  }
  for(const texture of staleTextures)texture.dispose();
  for(const geometry of staleGeometries)geometry.dispose();
  failedArtworkLoads.clear();
  deferredGalleryVersion++;deferredGalleryJobs=[];deferredGalleryRunning=false;
  editionObjects=[];artExhibits.length=0;sculpturePlacements.length=0;
  exhibitLightTargets.length=0;
  resetInspection();
  liftPosition=null;liftWasNear=false;liftDoors=[];
  const previous=new Set(scene.children);
  arrival=null;
  exhibitDate=date;studyList=studies;plan=nextPlan;currentFloor=nextFloor;
  camera.far=Math.max(210,elevation+240);camera.updateProjectionMatrix();
  constructGallery(plan,studyList);
  updateExhibitLighting();
  editionObjects=scene.children.filter(object=>!previous.has(object));
  // A lift arrival needs exhibits promptly; street-level visitors first see the exterior.
  if(viaLift||nextFloor!==0)startDeferredGallery();
  if(!viaLift && nextFloor===0 && arrival){
    rig.position.copy(arrival.start);
    // Face the front doors and the tower on first arrival.
    yaw=Math.atan2(arrival.outward.x,arrival.outward.z);
    rig.rotation.y=yaw;pitch=-.16;camera.rotation.x=pitch;
  }
  if(viaLift&&liftCabinPosition){
    rig.position.copy(liftCabinPosition);
    const towards=new THREE.Vector3(plan.rooms[0].x-liftCabinPosition.x,0,plan.rooms[0].z-liftCabinPosition.z);
    yaw=Math.atan2(-towards.x,-towards.z);
    rig.rotation.y=yaw;pitch=0;camera.rotation.x=0;
    liftWasNear=true;welcome.hidden=true;
    history.replaceState(null,'','?date='+date);
  }
  $('liftMonth').value=date.slice(0,7);
  $('edition').value=date;
  $('archiveLink').href='../../gallery/'+date+'/';
  $('welcomeArchive').href='../../gallery/'+date+'/';
  const floorName=nextFloor===0?'Ground floor':'Floor '+nextFloor;
  $('startFloor').textContent=floorName+' · '+readableDate(date);
  $('floorIndicator').textContent=nextFloor===0?'G':String(nextFloor);
  $('floorIndicator').setAttribute('aria-label','Current archive floor: '+floorName);
  status.textContent=floorName+' · '+readableDate(date)+' · '+studies.length+' works · '+sculpturePlacements.length+' sculptures';
  enter.disabled=false;enter.textContent='Enter the gallery';
}
async function load(){
  try{
    archiveDates=await loadArchiveDates();
    // Reuse one compact, cacheable index rather than loading every edition's HTML.
    try{
      const response=await fetch('../../gallery/tower-layouts.json');
      if(response.ok){
        const data=await response.json();
        if(data.version===1&&Array.isArray(data.floors))
          towerFloorSignatures=new Map(data.floors.map(f=>[f.date,f.studies]));
      }
    }catch(error){console.warn('Tower floor index unavailable',error);}

    const qp=new URLSearchParams(location.search).get('date');
    await loadEdition(qp&&archiveDates.includes(qp)?qp:archiveDates[0]);
  }catch(e){
    enter.textContent='Gallery unavailable';errorBox.textContent=e.message;
    errorBox.hidden=false;console.error(e);
  }
}

function resize() {
  if (!renderer) return;
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
}
window.addEventListener('resize',resize);

// Information appears when a visitor pauses facing a nearby exhibit.
// This is not a modal: movement and mouse look continue uninterrupted.
function resetInspection(){
  $('info').hidden=true;
  currentInfoExhibit=null;focusCandidate=null;focusDuration=0;dismissedExhibit=null;
}
function showInfo(exhibit){
  if(!exhibit?.study)return;
  const study=exhibit.study;
  if(currentInfoExhibit!==exhibit){
    $('infoImage').src=study.image;
    $('infoImage').alt=study.title;
    $('infoTitle').textContent=study.title;
    $('infoSeed').textContent=study.seed;
    $('openArt').href=study.href;
  }
  currentInfoExhibit=exhibit;
  $('info').hidden=false;
}
$('closeInfo').addEventListener('click',()=>{
  dismissedExhibit=currentInfoExhibit;
  $('info').hidden=true;
  $('closeInfo').blur();
});
const moveCodes = new Map([
  ['KeyW','forward'],['ArrowUp','forward'],['KeyS','back'],['ArrowDown','back'],
  ['KeyA','left'],['ArrowLeft','left'],['KeyD','right'],['ArrowRight','right']
]);
$('openLift').addEventListener('click',openLift);
$('closeLift').addEventListener('click',()=>{
  $('lift').hidden=true;
  $('closeLift').blur();
});
$('lift').addEventListener('keydown',e=>{
  if(e.key!=='Tab')return;
  const buttons=[...$('lift').querySelectorAll('button:not([disabled]),input:not([disabled])')]
    .filter(element=>element.offsetParent!==null);
  if(!buttons.length)return;
  const first=buttons[0],last=buttons.at(-1);
  if(e.shiftKey && document.activeElement===first){e.preventDefault();last.focus();}
  else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first.focus();}
});
$('liftMonth').addEventListener('change',renderLiftCalendar);
window.addEventListener('keydown',(e)=>{
  if (e.code==='Escape') {
    // First Escape releases mouse lock so the artwork link can be clicked.
    // Only another Escape dismisses the contextual information.
    if(document.pointerLockElement===canvas){
      document.exitPointerLock?.();
      return;
    }
    if(!$('info').hidden)dismissedExhibit=currentInfoExhibit;
    $('info').hidden=true;$('lift').hidden=true;
    if(document.activeElement?.closest?.('#lift'))document.activeElement.blur();
    return;
  }
  if (['INPUT','BUTTON','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) return;
  if (moveCodes.has(e.code)) {e.preventDefault();pressed.add(moveCodes.get(e.code));}
});
window.addEventListener('keyup',(e)=>{if(moveCodes.has(e.code))pressed.delete(moveCodes.get(e.code));});
window.addEventListener('blur',()=>pressed.clear());
window.addEventListener('mousemove',(e)=>{
  if (document.pointerLockElement !== canvas || renderer.xr.isPresenting) return;
  yaw -= e.movementX*.0025;
  pitch=Math.max(-1.35,Math.min(1.35,pitch-e.movementY*.0023));
});
canvas.addEventListener('click',()=>{
  if (welcome.hidden && !renderer.xr.isPresenting && matchMedia('(pointer:fine)').matches && document.pointerLockElement!==canvas) canvas.requestPointerLock?.().catch?.(()=>{});
});
canvas.addEventListener('pointerdown',(e)=>{
  if(e.pointerType!=='touch' || !welcome.hidden) return;
  touchPointer=e.pointerId;touchX=e.clientX;touchY=e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove',(e)=>{
  if(e.pointerId!==touchPointer || !welcome.hidden) return;
  yaw-=(e.clientX-touchX)*.004;
  pitch=Math.max(-1.3,Math.min(1.3,pitch-(e.clientY-touchY)*.003));
  touchX=e.clientX;touchY=e.clientY;
});
canvas.addEventListener('pointerup',(e)=>{if(e.pointerId===touchPointer)touchPointer=null;});
canvas.addEventListener('pointercancel',()=>touchPointer=null);
for (const button of document.querySelectorAll('[data-move]')) {
  const direction=button.dataset.move;
  button.addEventListener('pointerdown',e=>{e.preventDefault();touchPressed.add(direction);button.setPointerCapture(e.pointerId);});
  for (const type of ['pointerup','pointercancel','lostpointercapture']) button.addEventListener(type,()=>touchPressed.delete(direction));
}
enter.addEventListener('click',()=>{
  if (!plan) return;
  welcome.hidden=true;
  startDeferredGallery();
  if (matchMedia('(pointer:fine)').matches) canvas.requestPointerLock?.().catch?.(()=>{});
});
$('goDate').addEventListener('click',()=>{
  const date=$('edition').value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) location.assign('?date='+date);
});
$('edition').addEventListener('keydown',e=>{if(e.key==='Enter')$('goDate').click();});
$('fullscreen').addEventListener('click',()=>{
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.();
});


// Small plan diagram: real rooms, real connecting ramps, real visitor position.
function drawMap(){
  const element=$('floorMap');
  if(!element||!plan)return;
  const ctx=element.getContext('2d');
  const w=element.width,h=element.height;
  ctx.clearRect(0,0,w,h);
  const bounds=plan.rooms.reduce((p,r)=>({
    minX:Math.min(p.minX,r.x-r.width/2),maxX:Math.max(p.maxX,r.x+r.width/2),
    minZ:Math.min(p.minZ,r.z-r.depth/2),maxZ:Math.max(p.maxZ,r.z+r.depth/2)
  }),{minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity});
  const scale=Math.min((w-28)/(bounds.maxX-bounds.minX+2),(h-28)/(bounds.maxZ-bounds.minZ+2));
  const px=x=>(x-(bounds.minX+bounds.maxX)/2)*scale+w/2;
  const pz=z=>(z-(bounds.minZ+bounds.maxZ)/2)*scale+h/2;
  ctx.lineWidth=7;ctx.lineCap='round';ctx.strokeStyle='#999789';
  for(const hall of plan.corridors){
    ctx.beginPath();ctx.moveTo(px(hall.start.x),pz(hall.start.z));
    ctx.lineTo(px(hall.end.x),pz(hall.end.z));ctx.stroke();
  }
  for(const room of plan.rooms){
    const x=px(room.x-room.width/2),y=pz(room.z-room.depth/2);
    ctx.fillStyle='#e6e4d8';ctx.strokeStyle='#474b43';ctx.lineWidth=1.2;
    ctx.fillRect(x,y,room.width*scale,room.depth*scale);
    ctx.strokeRect(x,y,room.width*scale,room.depth*scale);
  }
  ctx.save();
  ctx.translate(px(rig.position.x),pz(rig.position.z));
  ctx.rotate(-yaw);
  ctx.beginPath();ctx.moveTo(0,-9);ctx.lineTo(-5,5);ctx.lineTo(5,5);ctx.closePath();
  ctx.fillStyle='#d25232';ctx.fill();ctx.restore();
}

function updateMovement(dt) {
  if (!plan || !welcome.hidden || !$('lift').hidden || liftTravelling) return;
  let ahead=Number(pressed.has('forward')||touchPressed.has('forward')) - Number(pressed.has('back')||touchPressed.has('back'));
  let side=Number(pressed.has('right')||touchPressed.has('right')) - Number(pressed.has('left')||touchPressed.has('left'));
  if (renderer.xr.isPresenting) {
    ahead=0;side=0;
    const session=renderer.xr.getSession();
    for(const source of session?.inputSources||[]) {
      const axes=source.gamepad?.axes;
      if(!axes)continue;
      if(source.handedness==='left') {
        side+=Math.abs(axes.at(-2))>.16?axes.at(-2):0;
        ahead-=Math.abs(axes.at(-1))>.16?axes.at(-1):0;
      } else if(source.handedness==='right') {
        // Comfortable 30-degree snap turns, one per stick deflection.
        const turn=axes.at(-2)||0;
        if(Math.abs(turn)<.35)xrTurnLatched=false;
        else if(Math.abs(turn)>.75 && !xrTurnLatched){
          yaw-=Math.sign(turn)*Math.PI/6;
          xrTurnLatched=true;
        }
      }
    }
  }
  const length=Math.hypot(ahead,side);
  if(length>0) {
    const speed = pressed.has('ShiftLeft') ? 5.4 : 3.2;
    ahead/=length;side/=length;
    let dx,dz;
    if(renderer.xr.isPresenting){
      // Head-relative locomotion follows where the visitor actually looks.
      const forward=renderer.xr.getCamera(camera).getWorldDirection(new THREE.Vector3());
      forward.y=0;forward.normalize();
      dx=(forward.x*ahead-forward.z*side)*dt*speed;
      dz=(forward.z*ahead+forward.x*side)*dt*speed;
    }else{
      dx=(Math.cos(yaw)*side-Math.sin(yaw)*ahead)*dt*speed;
      dz=(-Math.sin(yaw)*side-Math.cos(yaw)*ahead)*dt*speed;
    }
    if ((canStand(plan,rig.position.x+dx,rig.position.z)||onArrivalPath(rig.position.x+dx,rig.position.z)) && clearOfSculptures(sculpturePlacements,rig.position.x+dx,rig.position.z)) rig.position.x+=dx;
    if ((canStand(plan,rig.position.x,rig.position.z+dz)||onArrivalPath(rig.position.x,rig.position.z+dz)) && clearOfSculptures(sculpturePlacements,rig.position.x,rig.position.z+dz)) rig.position.z+=dz;
  }
  const part=footprintAt(plan,rig.position.x,rig.position.z);
  if(part)rig.position.y=part.y;
  else if(onArrivalPath(rig.position.x,rig.position.z))rig.position.y=arrival.baseY;
  const atLift=Boolean(nearLift());
  if(xrLiftPanel && !atLift)closeXRLift();
  if(atLift&&!liftWasNear&&$('lift').hidden)openLift();
  liftWasNear=atLift;
  rig.rotation.y=yaw;
  camera.rotation.x=renderer.xr.isPresenting?0:pitch;
}
window.addEventListener('keydown',e=>{if(e.code==='ShiftLeft')pressed.add('ShiftLeft');});
window.addEventListener('keyup',e=>{if(e.code==='ShiftLeft')pressed.delete('ShiftLeft');});

function detectArt(elapsed) {
  if (!plan || !welcome.hidden || !$('lift').hidden || liftTravelling || renderer.xr.isPresenting) {
    if(!$('info').hidden)resetInspection();
    return;
  }
  const eye=camera.getWorldPosition(new THREE.Vector3());
  const looking=camera.getWorldDirection(new THREE.Vector3());
  let selected=null,score=-Infinity;
  for(const exhibit of artExhibits){
    const toward=exhibit.position.clone().sub(eye);
    const horizontal=Math.hypot(toward.x,toward.z);
    if(horizontal>3.6 || toward.length()>4.1)continue;
    // Wall works must be approached from inside the room, not through a wall.
    if(exhibit.normal && eye.clone().sub(exhibit.position).dot(exhibit.normal)<.2)continue;
    const alignment=looking.dot(toward.normalize());
    if(alignment<.76)continue;
    const value=alignment*2-horizontal*.13;
    if(value>score){selected=exhibit;score=value;}
  }
  if(selected!==focusCandidate){focusCandidate=selected;focusDuration=0;}
  else focusDuration+=elapsed;
  if(selected && focusDuration>=.36 && selected!==dismissedExhibit && currentInfoExhibit!==selected)
    showInfo(selected);
  if(!selected)resetInspection();
  else if(currentInfoExhibit && currentInfoExhibit!==selected && focusDuration<.36){
    // Preserve the current label for a moment while looking between works.
  }else if(selected===dismissedExhibit || (currentInfoExhibit && currentInfoExhibit!==selected)){
    $('info').hidden=true;
  }
  const current=footprintAt(plan,rig.position.x,rig.position.z)?.room ?? -1;
  const text='Floor '+(currentFloor===0?'G':currentFloor)+(current>=0?' · Gallery '+(current+1):' · Walkway');
  if(status.textContent!==text)status.textContent=text;
}
function tick() {
  if (!renderer) return;
  const dt=Math.min(clock.getDelta(),.055);
  animateLiftDoors(dt);
  if(!$('lift').hidden){renderer.render(scene,camera);return;}
  updateMovement(dt);
  lastFocusCheck+=dt;mapElapsed+=dt;
  if(lastFocusCheck>.18){detectArt(lastFocusCheck);updateExhibitLighting();lastFocusCheck=0;}
  if(mapElapsed>.065){drawMap();mapElapsed=0;}
  renderer.render(scene,camera);
}
if(renderer)renderer.setAnimationLoop(tick);
load();
