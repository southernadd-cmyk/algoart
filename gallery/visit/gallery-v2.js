import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { buildLayout, footprintAt, canStand, DOOR_WIDTH, DOOR_HEIGHT, ROOM_HEIGHT, PHI } from './layout-v2.mjs';
import { planGalleryHangs } from './hanging-v3.mjs?v=reserve-glazed-door-walls-20261022';
import { planGallerySculptures,clearOfSculptures,validateSculpturePlacement } from './sculptures.mjs';
import {addPermanentPlazaSculptures} from './plaza-monuments.mjs';
import { createPortraitSculpture, setSculptureArchitecturalMaterials } from './sculpture-render-traced.mjs?v=prebaked-sculptures-20261023';
import { createArchitecturalMaterials, tiledBoxUvs } from './architectural-materials.mjs?v=ambientcg-ceiling-20261022';
import {placeTwinSpotlight} from './twin-spotlight-fixture.mjs?v=innerscene-twin-v1-20261022';
import {placeCastIronStreetLamp,enableDetailedStreetLamps} from './cast-iron-street-lamps.mjs?v=deferred-download-20261022';
import { appendTowerBoxBatches } from './tower-box-batches.mjs?v=preserve-metre-uv-20261022';
import {loadPrebuiltTower,prebuiltTowerMatches,renderPrebuiltTower} from './prebuilt-tower.mjs?v=solid-facades-v2-20261022';
import {createTowerGraffiti} from './exterior-graffiti.mjs?v=atlas-first-20261027';
import {planInteriorGraffiti,interiorGraffitiKey} from './interior-graffiti-plan.mjs';
import { resolveStudyMaterial } from './study-material.mjs';
import { createExteriorLandscape } from './environment-render.mjs?v=daytime-restored-20261027';
import {planVisitors,renderVisitors,renderPlazaSeatedVisitors} from './visitors.mjs?v=arms-forward-v10-20261022';
import {createWalkwayGlassMaterials,createGlassWalkway} from './walkway-glass.mjs?v=doorway-aligned-glass-20261022';
import {createEntranceDoors} from './entrance-doors.mjs?v=working-double-doors-20261022';
import {loadGameReadyElevator,fitGameReadyElevator} from './sketchfab-elevator.mjs?v=model-fit-20261022';

const GALLERY_DEBUG=new URLSearchParams(location.search).has('debug');
if(GALLERY_DEBUG)console.info('[Gallery performance] initial JavaScript module evaluated',Math.round(performance.now())+'ms since navigation');
const $ = (id) => document.getElementById(id);
const canvas = $('world');
const status = $('status');
const welcome = $('welcome');
const errorBox = $('error');
const enter = $('enter');
const pressed = new Set();
const touchPressed = new Set();
const lookPressed = new Set();
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
let prebuiltTower=null;
let arrival=null;
let entranceDoor=null;
let liftPosition=null;
let liftWasNear=false;
let liftTravelling=false;
let liftReturnFocus=null;
let editionObjects=[];
let deferredGalleryJobs=[];
let deferredGalleryRunning=false;
let liftDoors=[];
let liftDoorClosure=0;
let liftDoorTarget=0;
let liftCabinPosition=null;
let liftDoorThreshold=null;
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
const camera = new THREE.PerspectiveCamera(76, window.innerWidth / Math.max(1, window.innerHeight), 0.07, 210);
camera.rotation.order = 'YXZ';
camera.position.set(0, 1.68, 0);
const rig = new THREE.Group();
scene.add(rig);
rig.add(camera);
rig.rotation.y = yaw;
if(new URLSearchParams(location.search).has('svg-export'))window.__PP_EXPORT_SCENE__={scene,camera,rig,THREE:{Vector3:THREE.Vector3,Matrix4:THREE.Matrix4,Box3:THREE.Box3}};

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
    startDeferredGallery();
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
  console.error('[Gallery startup] WebGL unavailable',err);
  errorBox.textContent = 'The virtual gallery cannot run on this device. Please use the 2D gallery below.';
  errorBox.hidden = false;
}

const galleryFinish=createArchitecturalMaterials(THREE,{
  lowPower:matchMedia('(pointer:coarse), (prefers-reduced-motion: reduce)').matches,
  startAfter:window.__galleryEarly?.tower
});
const wall=galleryFinish.wall;
const towerGraffiti=createTowerGraffiti(THREE,{brick:galleryFinish.exteriorBrick,lowPower:galleryFinish.lowPower});
const interiorGraffiti=createTowerGraffiti(THREE,{brick:galleryFinish.wall,lowPower:galleryFinish.lowPower,
 planner:planInteriorGraffiti,keyFor:interiorGraffitiKey,kind:'interior'});
if(GALLERY_DEBUG){const debugWriting=(manager,inside=false)=>({
 diagnostics:()=>manager.diagnostics,
 marks:()=>manager.snapshot(currentFloor),
 preview(index){
  const mark=manager.snapshot(currentFloor)[index];if(!mark)return;
  const view=new THREE.PerspectiveCamera(55,camera.aspect,.07,210),p=mark.position,n=mark.normal;
  const distance=inside?Math.max(2,mark.width*1.8):Math.max(3.8,mark.width*1.2);
  view.position.set(p.x+n.x*distance,p.y+.12,p.z+n.z*distance);view.lookAt(p.x,p.y,p.z);
  renderer.setAnimationLoop(null);renderer.render(scene,view);
 }
});window.__galleryGraffiti=debugWriting(towerGraffiti);window.__galleryInteriorGraffiti=debugWriting(interiorGraffiti,true);}
const floor=galleryFinish.floor;
const timber=galleryFinish.timber;
const stone=galleryFinish.stone;
const join=galleryFinish.trims;
setSculptureArchitecturalMaterials({plinth:galleryFinish.plinth,metal:galleryFinish.trims});
const dark = new THREE.MeshStandardMaterial({color: '#393b35', metalness: .16, roughness: .74});
const bridgeSurface=galleryFinish.stoneBridge;
const walkwayGlassMaterials=createWalkwayGlassMaterials(THREE,{lowPower:galleryFinish.lowPower});
const frame = new THREE.MeshStandardMaterial({color: '#34322e', roughness: .85});
const roofFinish=galleryFinish.plinth;
const ceilingFinish=galleryFinish.ceiling;
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
  const doorHeight=side===room.entranceWall?4.15:DOOR_HEIGHT;
  segment(opening,0,ROOM_HEIGHT-doorHeight,room.y+(ROOM_HEIGHT+doorHeight)/2);
  if(horizontal)block(opening+.09,.045,.43,room.x,room.y+doorHeight,fixed,join);
  else block(.43,.045,opening+.09,fixed,room.y+doorHeight,room.z,join);
}

function addRoom(room, index, count) {
  const ceiling=room.y+ROOM_HEIGHT;
  // Deterministic material rhythm without altering the exhibition layout.
  // Photographic wood varies between three low-contrast tones by room seed.
  const surface=galleryFinish.floorForRoom(exhibitDate,index,count);
  block(room.width+.42,.36,room.depth+.42,room.x,room.y-.22,room.z,surface);
  for(const side of ['north','south','east','west'])addWallWithOpening(room,side);
  const roofStrip=(room.width-3.5)/2;
  block(roofStrip,.21,room.depth+.45,room.x-(room.width+3.5)/4,ceiling+.1,room.z,ceilingFinish);
  block(roofStrip,.21,room.depth+.45,room.x+(room.width+3.5)/4,ceiling+.1,room.z,ceilingFinish);
  // A continuous glazed skylight seals the centre opening between the roof slabs.
  // Light still reaches the drawings and the sky is visible from inside.
  block(3.5,.085,room.depth+.38,room.x,ceiling+.105,room.z,
    currentFloor===archiveDates.length-1?skylightGlass:ceilingFinish);
  for(const sx of [-1,1])block(.075,.13,room.depth+.43,room.x+sx*1.755,ceiling+.11,room.z,join);
  for(let i=1;i<4;i++)block(3.57,.13,.067,room.x,ceiling+.11,room.z-room.depth/2+room.depth*i/4,join);
  for(const z of [room.z-room.depth/2,room.z+room.depth/2])
    block(room.width+.47,.2,.37,room.x,ceiling+.15,z,join);
  for(const x of [room.x-room.width/2,room.x+room.width/2])
    block(.37,.2,room.depth+.47,x,ceiling+.15,room.z,join);
  // Leave the exhibition floor unobstructed; the former raised phi divider
  // strips looked like stray dark lines across the entrance and galleries.
  // The room fill is deliberately subdued: exhibit fittings provide focus.
  // Ambient and a constant-sized spotlight pool light the occupied rooms.
  // Avoid allocating a separate point light per room.

}
function makeRoomLabel(text) {
  const c = document.createElement('canvas');
  c.width = 640; c.height = 110;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#363b35'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.font = '42px "AlgoArt Marker", Georgia, serif'; ctx.fillStyle = '#eee8db'; ctx.textAlign = 'center';
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
  // Glass sides and roof follow the inclined bridge; both room ends stay open.
  scene.add(createGlassWalkway(THREE,hall.start,hall.end,DOOR_WIDTH,
    walkwayGlassMaterials,{lowPower:galleryFinish.lowPower}));
}
// Restrict simultaneous downloads/decodes on phones; artwork is never omitted.
const mobileImages=matchMedia('(pointer:coarse)').matches;
const artworkQueue=[];
let artworkActive=0;
function scheduleArtwork(task,material){
 artworkQueue.push({task,material});
 const drain=()=>{
  while(artworkActive<(mobileImages?3:8)&&artworkQueue.length){
   let best=0,distance=Infinity;
   for(let i=0;i<artworkQueue.length;i++){
    const item=artworkQueue[i],p=item.material.userData.galleryPosition;
    if(item.material.userData.galleryDisposed)continue;
    const d=p?rig.position.distanceToSquared(p):Infinity;
    if(d<distance){distance=d;best=i;}
   }
   const next=artworkQueue.splice(best,1)[0];
   artworkActive++;
   Promise.resolve().then(next.task).finally(()=>{artworkActive--;drain();});
  }
 };
 drain();
}
// Failed image requests are retried after transient network/deployment errors.
// Only current-edition materials may be retried after a tab regains focus.
const failedArtworkLoads=new Map();
window.addEventListener('visibilitychange',()=>{
  if(document.visibilityState!=='visible')return;
  for(const [material,request] of [...failedArtworkLoads]){
    if(material.userData.galleryDisposed){failedArtworkLoads.delete(material);continue;}
    failedArtworkLoads.delete(material);
    loadArtworkTexture(request.url,material,{preferred:request.preferred});
  }
});
function loadArtworkTexture(url,material,{preferred=null}={}){
  scheduleArtwork(()=>new Promise(resolve=>{
    let finished=false;
    const finish=()=>{if(!finished){finished=true;resolve();}};
    const source=new URL(url,document.baseURI);
    // Use 1100px desktop / 640px mobile images from the dated floor's
    // manifest. The source JPEG remains the fallback for older exhibitions.
    const galleryPath=source.pathname.match(/\/gallery\/(\d{4}-\d{2}-\d{2}\/[^/]+\.(?:jpe?g|png|webp))$/i);
    const cdnFallback=galleryPath
      ?'https://cdn.jsdelivr.net/gh/southernadd-cmyk/algoart@main/gallery/'+galleryPath[1]
      :null;
    const isRelease=source.hostname==='github.com'&&source.pathname.includes('/releases/download/');
    const releaseProxy=isRelease
      ?'https://wsrv.nl/?url='+encodeURIComponent(source.href)+'&w='+(mobileImages?640:1100)+'&output=jpg'
      :null;
    const requests=[
      ...(preferred?[preferred]:[]),
      ...(isRelease?[releaseProxy]:[source.href]),
      ...(isRelease?[releaseProxy+'&q=88']:[source.href+(source.search?'&':'?')+'galleryRetry=1']),
      ...(cdnFallback?[cdnFallback]:[])
    ];
    let index=0;
    function attempt(){
      if(material.userData.galleryDisposed){finish();return;}
      if(index>=requests.length){
        material.color.set('#c9ad9b');material.needsUpdate=true;
        failedArtworkLoads.set(material,{url,preferred});
        console.warn('Artwork could not be loaded:',url);
        finish();return;
      }
      const candidate=requests[index++];
      const image=new Image();
      image.crossOrigin='anonymous';
      image.decoding='async';
      image.onload=async()=>{
        if(material.userData.galleryDisposed){finish();return;}
        let bitmap=null;
        try{
          if(!image.naturalWidth||!image.naturalHeight)throw Error('Empty image');
          const maxSize=mobileImages?640:1100;
          // Published WebPs are already at the correct size: no main-thread
          // canvas allocation or drawImage operation is needed for the wall.
          // On historical floors, try off-thread ImageBitmap resizing before
          // falling back to an unresized GPU texture on older browsers.
          if(candidate!==preferred &&
             Math.max(image.naturalWidth,image.naturalHeight)>maxSize &&
             typeof createImageBitmap==='function'){
            const scale=maxSize/Math.max(image.naturalWidth,image.naturalHeight);
            try{
              bitmap=await createImageBitmap(image,{
                resizeWidth:Math.max(1,Math.round(image.naturalWidth*scale)),
                resizeHeight:Math.max(1,Math.round(image.naturalHeight*scale)),
                resizeQuality:'high'
              });
            }catch(error){
              if(GALLERY_DEBUG)console.warn('ImageBitmap resize unavailable',error);
            }
          }
          if(material.userData.galleryDisposed){
            bitmap?.close?.();finish();return;
          }
          const texture=new THREE.Texture(bitmap||image);
          if(bitmap)texture.userData.galleryBitmap=bitmap;
          texture.colorSpace=THREE.SRGBColorSpace;
          texture.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),4);
          texture.needsUpdate=true;
          if(material.map){
            material.map.dispose();
            material.map.userData.galleryBitmap?.close?.();
          }
          material.map=texture;material.color.set('#ffffff');material.needsUpdate=true;
          failedArtworkLoads.delete(material);
          finish();
        }catch(error){
          bitmap?.close?.();
          console.warn('Artwork could not be decoded:',candidate,error);
          setTimeout(attempt,400);
        }
      };
      image.onerror=()=>{if(GALLERY_DEBUG)console.warn('Artwork request failed:',candidate);setTimeout(attempt,400);};
      image.src=candidate;
    }
    attempt();
  }),material);
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
  // Attach each real fixture to the solid ceiling, never the glazed strip.
  // Lighting and mesh loading remain separate: the exhibition light works
  // immediately, while the optional 250KB Innerscene model loads after entry.
  const dx=position.x-room.x;
  const x=Math.max(room.x-room.width/2+.48,
    Math.min(room.x+room.width/2-.48,
      Math.abs(dx)<1.89?room.x+(dx<0?-1:1)*2.02:position.x));
  const z=Math.max(room.z-room.depth/2+.48,
    Math.min(room.z+room.depth/2-.48,position.z));
  const mount=new THREE.Group();
  mount.position.set(x,room.y+ROOM_HEIGHT-.015,z);
  mount.name='gallery-twin-ceiling-spotlight';
  scene.add(mount);
  const direction=target.clone().sub(mount.position).normalize();
  const fallback=new THREE.Mesh(fittingGeometry,fittingMaterial);
  fallback.position.y=-.125;
  fallback.quaternion.setFromUnitVectors(new THREE.Vector3(0,-1,0),direction);
  mount.add(fallback);
  exhibitLightTargets.push({
    position:mount.position.clone().add(new THREE.Vector3(0,-.15,0)),
    target:target.clone(),beam,power
  });
  placeTwinSpotlight(THREE,mount,target,fallback);
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
  artworkMaterial.userData.galleryPosition=artwork.position.clone();
   loadArtworkTexture(study.image, artworkMaterial,{preferred:study.imageOptimized});
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
  // Restrained architectural metalwork. The supplied Sketchfab GLB is under
  // Free Standard terms, so it is NOT redistributed on public GitHub Pages.
  // Instead these low-poly panels give the cabin its own distinct finish.
  const metal=new THREE.MeshStandardMaterial({color:'#6b7675',metalness:.72,roughness:.39});
  const brushed=new THREE.MeshStandardMaterial({color:'#bdc3c0',metalness:.57,roughness:.49});
  const rubber=new THREE.MeshStandardMaterial({color:'#303937',metalness:.07,roughness:.88});
  const glass=new THREE.MeshStandardMaterial({color:'#e9f0e6',emissive:'#f7ffed',emissiveIntensity:.45,roughness:.78});
  const inset=new THREE.MeshStandardMaterial({color:'#939d9a',metalness:.66,roughness:.47});
  const seam=new THREE.MeshStandardMaterial({color:'#333d3b',metalness:.29,roughness:.6});
  // Tiny vertical brushed highlights, generated once per gallery floor.
  // No downloaded materials, heavy textures or expensive reflective passes.
  const brushCanvas=document.createElement('canvas');
  brushCanvas.width=128;brushCanvas.height=128;
  const brushContext=brushCanvas.getContext('2d');
  const brushData=brushContext.createImageData(128,128);
  for(let x=0;x<128;x++)for(let y=0;y<128;y++){
    const h=((x*1213+y*197)^((x+41)*8309))>>>0;
    const v=Math.max(214,Math.min(250,
      Math.round(234+4*Math.sin(x*.22)+3*Math.sin(x*.73)+(h%7)-3)));
    const i=(y*128+x)*4;
    brushData.data[i]=v;
    brushData.data[i+1]=Math.min(255,v+2);
    brushData.data[i+2]=Math.min(255,v+2);
    brushData.data[i+3]=255;
  }
  brushContext.putImageData(brushData,0,0);
  const brushTexture=new THREE.CanvasTexture(brushCanvas);
  brushTexture.colorSpace=THREE.SRGBColorSpace;
  brushed.map=brushTexture;
  const local=(u,v,w)=>origin.clone().addScaledVector(tangent,u).addScaledVector(normal,w).add(new THREE.Vector3(0,v,0));
  // All fallback cabin objects belong to one root; installing the licensed
  // model can hide that root without obscuring the newly imported elevator.
  const fallbackCabin=new THREE.Group();
  fallbackCabin.name='procedural-lift-backup';
  scene.add(fallbackCabin);
  // Unlike the interchangeable cabin, this masonry/metal portal must remain
  // in place when the detailed GLB becomes visible. Hiding the whole old
  // cabin previously removed the header and exposed a gap above the model.
  const permanentSurround=new THREE.Group();
  permanentSurround.name='archive-lift-permanent-surround';
  scene.add(permanentSurround);
  const part=(w,h,d,u,v,z,material,parent=fallbackCabin)=>{
    const p=local(u,v,z);
    const geometry=new THREE.BoxGeometry(w,h,d);
    const mesh=new THREE.Mesh(geometry,material);
    mesh.position.copy(p);
    mesh.rotation.y=Math.atan2(normal.x,normal.z);
    parent.add(mesh);
    return mesh;
  };
  // Quiet stone-and-bronze portal with a recessed shadow reveal.
  const portal=new THREE.MeshStandardMaterial({color:'#d4d2ca',roughness:.89});
  const bronze=new THREE.MeshStandardMaterial({color:'#424b47',metalness:.58,roughness:.43});
  part(width,.14,depth,0,.035,0,rubber);
  part(width,.14,depth,0,height,0,brushed);
  part(width,height,.11,0,height*.5,-depth*.5,brushed);
  for(const u of [-1,1]){
    part(.11,height,depth,u*width*.5,height*.5,0,metal);
    part(.055,.07,depth,u*(width*.5-.1),1.04,0,metal);
  }
  // The surround faces the visitor at the gallery-side threshold. It is
  // independent of the optional model and must always bridge the vertical
  // difference between the 2.65m model and the taller masonry opening.
  const face=depth*.5+.075;
  for(const u of [-1,1]){
    part(.22,3.05,.23,u*(width*.5+.10),1.525,face,portal,permanentSurround);
    part(.038,2.62,.08,u*(width*.5-.015),1.31,face+.135,bronze,permanentSurround);
  }
  // Continuous brushed-metal infill: 2.65m model roof to 3.05m lintel.
  // It is shallow and mounted ahead of the cabin, so it cannot obstruct
  // the sliding leaves, floor controls or the player's doorway clearance.
  const headerBottom=height-.015;
  const headerTop=3.045;
  part(width+.08,headerTop-headerBottom,.15,0,
    (headerBottom+headerTop)/2,face+.065,brushed,permanentSurround);
  part(width+.48,.24,.28,0,3.05,face,portal,permanentSurround);
  part(width+.12,.045,.13,0,2.82,face+.14,bronze,permanentSurround);
  part(width+.5,.075,.36,0,3.52,face-.06,bronze,permanentSurround);
  // Two distinct, detailed sliding leaves. Keep a single transform per leaf
  // so every inset, lip and vertical seam travels with its metal door.
  // Destination-floor doors start CLOSED while the lift is in transit.
  liftDoors=[];
  liftDoorClosure=1;liftDoorTarget=1;
  for(const u of [-1,1]){
    const leaf=new THREE.Group();
    leaf.name=u<0?'lift-door-left':'lift-door-right';
    leaf.position.copy(local(u*.47,1.2,depth*.5-.02));
    leaf.rotation.y=Math.atan2(normal.x,normal.z);
    const face=(w,h,d,x,y,z,material)=>{
      const item=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
      item.position.set(x,y,z);
      leaf.add(item);
    };
    face(.92,2.35,.085,0,0,0,brushed);
    face(.79,2.20,.006,0,.025,.048,inset);
    // Vertical brushing ribs plus separate top and kick plates.
    face(.045,2.34,.047,u*.435,0,.055,metal);
    face(.023,2.31,.053,-u*.445,0,.06,seam);
    face(.77,.06,.029,0,1.065,.07,metal);
    face(.77,.15,.029,0,-1.025,.07,metal);
    face(.018,1.83,.017,u*.30,.055,.057,brushed);
    // Machine profile: no handles, since these are sensor-operated sliders.
    leaf.userData.closed=leaf.position.clone();
    leaf.userData.open=leaf.position.clone().addScaledVector(tangent,u*.91);
    fallbackCabin.add(leaf);
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
  liftDoorThreshold=local(0,0,depth*.5-.02);
  // Purpose-made readable signage, centred ABOVE the lintel rather than hidden behind it.
  const signCanvas=document.createElement('canvas');
  signCanvas.width=768;signCanvas.height=192;
  const g=signCanvas.getContext('2d');
  g.fillStyle='#e9e5dc';g.fillRect(0,0,768,192);
  g.fillStyle='#333b39';g.textAlign='center';
  g.font='52px "AlgoArt Marker", Georgia, serif';g.fillText('ARCHIVE LIFT',384,81);
  g.font='28px Georgia, serif';g.fillText('daily exhibitions',384,139);
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
  // Non-blocking optional upgrade. Keep the proven walkable cabin and doors
  // until the exact downloaded model has loaded and both door nodes validate.
  loadGameReadyElevator(THREE).then(source=>{
    if(!source||!fallbackCabin.parent)return;
    try{
      const fitted=fitGameReadyElevator(THREE,source,{
        origin,rotation:Math.atan2(normal.x,normal.z),
        width,height,depth,closure:liftDoorClosure
      });
      scene.add(fitted.holder);
      // Register the late-loaded shell with the current edition cleanup.
      // The asset loader is shared; a floor change must remove its instance.
      editionObjects.push(fitted.holder);
      fallbackCabin.visible=false;
      liftDoors=fitted.doors;
    }catch(error){console.warn('Sketchfab elevator fitting failed',error);}
  });
}
function setLiftDoors(closed){
  liftDoorTarget=closed?1:0;
}
function animateLiftDoors(dt){
  // Proximity sensor works on both sides of the doorway, just like the
  // gallery entrance. Never reopen doors during a lift journey.
  if(liftDoorThreshold && liftDoors.length && !liftTravelling){
    const person=renderer?.xr.isPresenting
      ?renderer.xr.getCamera(camera).getWorldPosition(new THREE.Vector3())
      :rig.position;
    const distance=Math.hypot(person.x-liftDoorThreshold.x,
      person.z-liftDoorThreshold.z);
    // Hysteresis keeps leaves from chattering at the activation boundary.
    if(distance<2.6)liftDoorTarget=0;
    else if(distance>3.05)liftDoorTarget=1;
  }else if(liftTravelling)liftDoorTarget=1;
  // Smooth, framerate-independent sliding movement.
  liftDoorClosure+=(liftDoorTarget-liftDoorClosure)*Math.min(1,dt*3.5);
  if(Math.abs(liftDoorTarget-liftDoorClosure)<.002)
    liftDoorClosure=liftDoorTarget;
  for(const leaf of liftDoors)
    leaf.position.copy(leaf.userData.open).lerp(leaf.userData.closed,liftDoorClosure);
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
  liftReturnFocus=document.activeElement;
  pressed.clear();lookPressed.clear();
  document.exitPointerLock?.();
  $('lift').hidden=false;
  renderLiftCalendar();
  $('closeLift').focus();
}
function closeLift({returnToCanvas=false}={}){
  $('lift').hidden=true;
  pressed.clear();lookPressed.clear();
  const target=returnToCanvas ? canvas
    :liftReturnFocus?.isConnected ? liftReturnFocus : $('openLift');
  liftReturnFocus=null;
  target.focus({preventScroll:true});
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
      liftReturnFocus=null;
      canvas.focus({preventScroll:true});
      $('liftArrival').hidden=false;
      $('liftArrival').textContent='Doors opening · floor '+(index===0?'G':index);
      setTimeout(()=>$('liftArrival').hidden=true,1800);
    }
    setLiftDoors(false);
  }catch(error){
    overlay.hidden=true;setLiftDoors(false);
    errorBox.textContent='Lift could not reach that floor: '+error.message;
    errorBox.hidden=false;
    if(!xrRide){
      $('lift').hidden=false;
      $('closeLift').focus({preventScroll:true});
    }else {
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
        if(date===exhibitDate){closeLift();return;}
        travelLift(date,index);
      });
    }
    grid.appendChild(btn);
  }
  const floor=dates.indexOf(exhibitDate);
  $('liftCurrent').textContent='Current floor '+(floor===0?'G':Math.max(0,floor))+' · '+readableDate(exhibitDate);
}
// Bound all startup and lift fetches, including the response body download.
 // A mobile network that stops responding must show an error, not an
 // indefinitely disabled "Preparing exhibition" button or lift overlay.
async function fetchGalleryText(url,{timeoutMs=18000,...options}={}){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetch(url,{...options,signal:controller.signal});
    return {ok:response.ok,url:response.url,text:response.ok?await response.text():''};
  }catch(error){
    if(error?.name==='AbortError')throw new Error('Gallery loading timed out. Check your connection and reload.');
    throw error;
  }finally{clearTimeout(timeout);}
}
async function loadArchiveDates(){
  // Never scrape dated links from the human-facing gallery index.
  const res=await fetchGalleryText('../archive.json',{cache:'no-store'});
  if(!res.ok)throw new Error('Could not load the gallery archive.');
  const archive=JSON.parse(res.text);
  const dates=[...new Set((archive.days||[]).map(day=>day.date)
    .filter(date=>/^\d{4}-\d{2}-\d{2}$/.test(date)))].sort();
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
  // The civic plaza spans the whole 26m entrance approach (0–38m from the
  // doorway). Do not overlay a separate stone slab: it was slightly higher
  // than the paving and left a conspicuous centre stripe even after the
  // decorative plaza strip was removed. onArrivalPath still marks the entire
  // route as walkable, and the plaza itself provides the visible surface.
  const material=galleryFinish.stone;
  const place=(w,h,d,x,y,z,mat=material)=>{
    const g=new THREE.BoxGeometry(w,h,d);
    if(mat.userData?.tileMeters)tiledBoxUvs(g,w,h,d,mat.userData.tileMeters);
    const o=new THREE.Mesh(g,mat);o.position.set(x,y,z);scene.add(o);return o;
  };
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
  // Human-scale hinged door pair, full-height sidelights and transom. The
  // model can be swapped later without replacing the proximity controller.
  entranceDoor=createEntranceDoors(THREE,{doorway,outward,level:room.y});
  scene.add(entranceDoor.root);
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
    // Retain these two simple meshes only until the shared detailed GLB
    // arrives; fit the new cast-iron model to the actual entrance floor.
    const backup=new THREE.Group();
    backup.add(place(.12,2.7,.12,lamp.x,room.y+1.35,lamp.z,bronze));
    backup.add(place(.38,.42,.38,lamp.x,room.y+2.87,lamp.z,warm));
    scene.add(backup);
    placeCastIronStreetLamp(THREE,scene,
      new THREE.Vector3(lamp.x,room.y,lamp.z),backup,
      {scale:.84,rotation:Math.atan2(outward.x,outward.z)});
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
  // The public plaza is 46m across and 38m deep, not merely the entrance route.
  // Retain the narrower threshold overlap so visitors cannot cross solid facade walls.
  const doorway=along>=-1.0&&along<=1.0&&across<=1.45;
  // Exterior paving does not make the solid gallery walls walkable.
  const blocked=plan.rooms.some(room=>
    Math.abs(x-room.x)<room.width/2+.48&&
    Math.abs(z-room.z)<room.depth/2+.48&&!doorway);
  const plaza=along>=0&&along<=37.55&&across<=22.55&&!blocked;
  return plaza||doorway;
}
// Stage costly exhibits across frames so the exterior is usable immediately.
function startDeferredGallery(){
  if(deferredGalleryRunning||!deferredGalleryJobs.length)return;
  deferredGalleryRunning=true;
}
function processDeferredGallery(){
  if(!deferredGalleryRunning)return;
  const job=deferredGalleryJobs.shift();
  if(!job){deferredGalleryRunning=false;updateExhibitLighting();return;}
  try{
    const previous=new Set(scene.children);
    job();
    for(const object of scene.children)if(!previous.has(object))editionObjects.push(object);
  }catch(error){console.warn('Deferred gallery asset failed',error);}
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
  if(GALLERY_DEBUG)window.__galleryInteriorGraffiti.artWalls=hangs.map(h=>({roomIndex:h.roomIndex,surface:h.surface}));
  const sculptures=planGallerySculptures(layout,studies);
  validateSculpturePlacement(layout,sculptures);
  sculpturePlacements.push(...sculptures);
  const byId=new Map(studies.map(study=>[study.id,study]));
  const quality=matchMedia('(pointer:coarse)').matches?'mobile':'desktop';
  // Lightweight, locally generated buff brick: no network texture request.
  // Shared CC0 1K scan: reuse the existing material across all wall faces.
  exteriorBrick=galleryFinish.exteriorBrick;
  const occupiedArchitecture=new THREE.Box3();
  for(const room of layout.rooms){
    const firstRoomObject=scene.children.length;
    addRoom(room,room.index,layout.rooms.length);
    for(const object of scene.children.slice(firstRoomObject))occupiedArchitecture.expandByObject(object);
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
  // Exhibition spotlights are fitted per artwork. No extra central prop:
  // the previous generic ceiling lamp doubled fixtures and loaded a second CDN.
  deferredGalleryJobs.push(()=>renderVisitors(THREE,scene,
    planVisitors(layout,hangs,sculptures,{lowPower:galleryFinish.lowPower})));
  if(hangs.length+sculptures.length!==studies.length)
    throw new Error('An archived study was omitted from the exhibition');
  // The complete hanging plan is available before deferred images load.
  // Exclude every wall face with a planned painting, then add small signatures
  // only on this occupied floor's inward-facing plaster surfaces.
  const writingLayout={...layout,rooms:layout.rooms.map(room=>({...room,y:Math.round((room.y-currentFloor*FLOOR_SPACING)*1e6)/1e6}))};
  interiorGraffiti.addTo(scene,{layout:writingLayout,hangs,level:currentFloor},currentFloor);
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
  const exteriorPlan=createExteriorLandscape(THREE,scene,layout,studies,{lowPower:galleryFinish.lowPower,
    protectedLayouts:exteriorFloorPlans.map(f=>f.plan),approach:entryApproach,plaza:entryPlaza});
  if(GALLERY_DEBUG)window.__galleryBackdrop={...exteriorPlan.backdrop};
  // Safety invariant: the exterior is a single paved square. No narrow,
  // longitudinal deck/stripe may overlay the centre of the entrance approach.
  // This catches both the former 29m approach slab and the 38m centre-strip
  // variant regardless of which path generated it, but leaves the much wider
  // 46m plaza slab and regular short paving joints alone.
  if(entryApproach){
    const {doorway,outward}=entryApproach,across={x:outward.z,z:-outward.x};
    const discarded=[];
    for(const mesh of [...scene.children]){
      if(!mesh.isMesh||!mesh.geometry?.isBoxGeometry)continue;
      const bounds=new THREE.Box3().setFromObject(mesh);
      const dim=bounds.getSize(new THREE.Vector3());
      const along= Math.abs(outward.x)*dim.x+Math.abs(outward.z)*dim.z;
      const cross= Math.abs(across.x)*dim.x+Math.abs(across.z)*dim.z;
      const centre=bounds.getCenter(new THREE.Vector3());
      const depth=(centre.x-doorway.x)*outward.x+(centre.z-doorway.z)*outward.z;
      const lateral=Math.abs((centre.x-doorway.x)*across.x+(centre.z-doorway.z)*across.z);
      if(along>18 && cross>0.7 && cross<9 && depth>0 && depth<38 &&
         lateral<1.5 && bounds.max.y<groundEntry.y+.3){
        scene.remove(mesh);discarded.push({along,cross,depth});
      }
    }
    if(discarded.length&&GALLERY_DEBUG)console.info('Removed entrance overlay strip',discarded);
  }
  if(entryPlaza)addPermanentPlazaSculptures(scene,entryPlaza);
  if(entryPlaza)deferredGalleryJobs.push(()=>renderPlazaSeatedVisitors(THREE,scene,entryPlaza));
  // Prefer the meshes baked during the daily publishing workflow. They carry
  // the same per-floor architecture and metre-scaled texture coordinates but
  // avoid re-running geometry generation in every visitor's browser.
  // An absent, mismatched or damaged pack falls back to the existing builder.
  const baked=prebuiltTowerMatches(prebuiltTower,archiveDates,towerFloorSignatures);
  // Rebuild each archived floor from its *own* daily seed signature.
  // Exterior-only geometry: no art, visitors, colliders or per-floor lights.
  const tower=new THREE.Group();
  // Archived galleries have solid walls, just like the walkable interiors.
  // The only glass belongs on bridges and the uppermost skylights.
  let usingBaked=false;
  if(baked){
    try{
      const t0=performance.now(),rendered=renderPrebuiltTower(THREE,tower,prebuiltTower,{
        wall, floor:galleryFinish.floor,roof:roofFinish,join,
        plinth:galleryFinish.plinth,brick:exteriorBrick,skylight:skylightGlass
      },currentFloor);
      for(const bridge of rendered.bridges){
        const {start,end}=bridge;
        const dx=end.x-start.x,dz=end.z-start.z;
        const distance=Math.hypot(dx,dz);
        const deck=new THREE.Mesh(
          tiledBoxUvs(new THREE.BoxGeometry(DOOR_WIDTH,.2,distance),
            DOOR_WIDTH,.2,distance,bridgeSurface.userData.tileMeters),
          bridgeSurface);
        deck.position.set((start.x+end.x)/2,(start.y+end.y)/2-.07,(start.z+end.z)/2);
        deck.rotation.y=Math.atan2(dx,dz);
        deck.rotation.x=Math.atan2(start.y-end.y,distance);
        tower.add(deck);
        tower.add(createGlassWalkway(THREE,start,end,DOOR_WIDTH,
          walkwayGlassMaterials,{lowPower:galleryFinish.lowPower}));
      }
      usingBaked=true;
      GALLERY_DEBUG&&console.info('Prepared tower loaded',{
        batches:rendered.batchCount,bridges:rendered.bridges.length,
        elapsedMs:Math.round(performance.now()-t0)
      });
    }catch(error){
      console.warn('Prepared tower rejected; falling back to procedural build:',error);
      tower.clear();
    }
  }
  if(!usingBaked){
  // Collect identical-material solid wall/roof pieces instead of allocating
  // thousands of separate draw calls. Their per-face UVs are retained when
  // combined, so the completed tower looks the same as the desktop version.
  const towerBuildStart=performance.now();
  const towerBoxes=new Map();
  const put=(w,h,d,x,y,z,material=wall)=>{
    if(w<=0||h<=0||d<=0)return;
    if(!towerBoxes.has(material))towerBoxes.set(material,[]);
    towerBoxes.get(material).push([w,h,d,x,y,z]);
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
      if(level===archiveDates.length-1){
        // The highest floor has the same central glazed skylight as the
        // walkable room. Do not cover it with a full solid roof slab.
        const strip=(room.width-3.5)/2;
        for(const sign of [-1,1]){
          put(strip,.24,room.depth+.45,
            room.x+sign*(room.width+3.5)/4,y+ROOM_HEIGHT+.15,room.z,roofFinish);
          put(strip,.17,room.depth+.94,
            room.x+sign*(room.width+3.5)/4,y+ROOM_HEIGHT+.32,room.z,roofFinish);
        }
        put(3.5,.085,room.depth+.38,room.x,y+ROOM_HEIGHT+.105,room.z,skylightGlass);
      }else{
        put(room.width+.45,.24,room.depth+.45,room.x,y+ROOM_HEIGHT+.15,room.z,roofFinish);
        put(room.width+.94,.17,room.depth+.94,room.x,y+ROOM_HEIGHT+.32,room.z,roofFinish);
      }
      put(room.width+.76,.12,room.depth+.76,room.x,y+ROOM_HEIGHT-.09,room.z,join);
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
        // Preserve the original roofline band; no exterior window trim.
        if(horizontal){
          put(length+.13,.085,.10,room.x,y+.32,fixed,join);
          put(length+.13,.085,.10,room.x,y+ROOM_HEIGHT-.36,fixed,join);
        }else{
          put(.10,.085,length+.13,fixed,y+.32,room.z,join);
          put(.10,.085,length+.13,fixed,y+ROOM_HEIGHT-.36,room.z,join);
        }
        if(room.doors.includes(side)){
          const opening=DOOR_WIDTH,wing=(length-opening)/2,doorHeight=DOOR_HEIGHT;
          wallPart(wing,ROOM_HEIGHT,-(opening+wing)/2,centre);
          wallPart(wing,ROOM_HEIGHT,(opening+wing)/2,centre);
          wallPart(opening,ROOM_HEIGHT-doorHeight,0,y+(ROOM_HEIGHT+doorHeight)/2);
          continue;
        }
        // No windows here: the inside of this gallery has a solid wall.
        // The glazed walkway attached to each doorway is built separately.
        wallPart(length,ROOM_HEIGHT,0,centre);
      }
    }
    // The actual corridor endpoints and gradients define each visible footbridge.
    for(const hall of floorPlan.corridors){
      const x1=hall.start.x,x2=hall.end.x,z1=hall.start.z,z2=hall.end.z;
      const y1=base+hall.start.y,y2=base+hall.end.y;
      const length=Math.hypot(x2-x1,z2-z1);
      const deck=new THREE.Mesh(tiledBoxUvs(new THREE.BoxGeometry(DOOR_WIDTH,.2,length),DOOR_WIDTH,.2,length,bridgeSurface.userData.tileMeters),bridgeSurface);
      deck.position.set((x1+x2)/2,(y1+y2)/2-.07,(z1+z2)/2);
      deck.rotation.y=Math.atan2(x2-x1,z2-z1);
      deck.rotation.x=Math.atan2(y1-y2,length);
      tower.add(deck);
      // Archived bridges receive the same glazed shell as the current floor.
      tower.add(createGlassWalkway(THREE,
        {x:x1,y:y1,z:z1},{x:x2,y:y2,z:z2},DOOR_WIDTH,
        walkwayGlassMaterials,{lowPower:galleryFinish.lowPower}));
    }
  }
  const towerStats=appendTowerBoxBatches(THREE,tower,towerBoxes);
  GALLERY_DEBUG&&console.info('Archived tower prepared',{
    boxes:towerStats.totalBoxes,batches:towerStats.batchCount,
    elapsedMs:Math.round(performance.now()-towerBuildStart)
  });
  }
  // The same exterior placement is used for the occupied room geometry,
  // the prepared archive and its procedural fallback. Current-floor room
  // heights are normalised before planning, so lift travel cannot reshuffle it.
  const graffitiFloors=[...exteriorFloorPlans,{level:currentFloor,plan:{...layout,
    rooms:layout.rooms.map(room=>({...room,y:Math.round((room.y-currentFloor*FLOOR_SPACING)*1e6)/1e6}))}}].sort((a,b)=>a.level-b.level);
  try{towerGraffiti.addTo(tower,graffitiFloors,currentFloor);}
  catch(error){console.warn('Exterior writing could not be prepared',error);}
  scene.add(tower);
  // Verify the full exterior tower exists in the scene before exposing Enter.
  // This reports missing geometry separately from a camera/framing problem.
  tower.updateMatrixWorld(true);
  const towerBounds=new THREE.Box3().setFromObject(tower);
  // The occupied floor is built separately from the archived tower batch.
  // Include its actual shell when checking the roofline, especially when
  // visiting the highest floor without any upper-storey paint overlays.
  towerBounds.union(occupiedArchitecture);
  const expectedTop=(archiveDates.length-1)*FLOOR_SPACING+ROOM_HEIGHT;
  const actualTop=towerBounds.max.y;
  const towerSummary={
    floors:archiveDates.length,
    method:usingBaked?'prebuilt':'procedural',
    meshes:(()=>{let n=0;tower.traverse(o=>{if(o.isMesh)n++;});return n;})(),
    minimumY:Math.round(towerBounds.min.y*10)/10,
    maximumY:Math.round(actualTop*10)/10,
    expectedMaximumY:Math.round(expectedTop*10)/10
  };
  GALLERY_DEBUG&&console.info('[Gallery tower geometry]',towerSummary);
  if(towerBounds.isEmpty()||actualTop<expectedTop-2){
    console.error('[Gallery tower geometry] Missing upper floors',towerSummary);
    status.textContent='Part of the gallery tower could not be prepared.';
  }
  const first=layout.rooms[0];
  if(currentFloor===0 && first.entranceWall)createGalleryArrival(first);
  addArchiveLift(first);
  rig.position.set(first.x,first.y,first.z);
  const initial=layout.rooms[first.neighbours[0]];
  if(initial)yaw=Math.atan2(-(initial.x-first.x),-(initial.z-first.z));
  rig.rotation.y=yaw;
  drawMap();
}
function readArchive(html, url, textureManifest={}) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return [...doc.querySelectorAll('article.art-card')].map((card, i) => {
    const img=card.querySelector('.art-image-link img');
    const link=card.querySelector('a.remix');
    if (!img || !link) return null;
    const href = new URL(link.getAttribute('href'), url).href;
    const seed = card.querySelector('dd')?.textContent.trim() || new URL(href).searchParams.get('seed') || '';
    const filename=decodeURIComponent(new URL(img.getAttribute('src'),url).pathname.split('/').pop());
    const variant=textureManifest[filename]?.[mobileImages?'mobile':'desktop'];
    return {
      id: i,
      title: card.querySelector('h2')?.textContent.trim() || 'Untitled drawing',
      seed,
      imageFile:filename,
      imageOptimized:variant?new URL(variant,url).href:null,
      image: (() => {
        const original=new URL(img.getAttribute('src'),url);
        // Release download URLs are blocked for canvas/WebGL by CORS.
        // Gallery release art is mirrored into same-origin Pages assets.
        if(original.hostname==='github.com' && original.pathname.includes('/southernadd-cmyk/algoart/releases/download/')){
          return new URL('../release-art/'+original.pathname.split('/').pop(),document.baseURI).href;
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
  const dates=await loadArchiveDates();
  return dates.at(-1);
}
function readableDate(date) {
  return new Intl.DateTimeFormat('en-GB',{dateStyle:'long',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
}
// One compressed polygon pack per edition. A missing/corrupt pack is safe:
// the original portrait generator remains available as the fallback.
async function loadSculpturePack(date,cache){
  if(typeof DecompressionStream!=='function')return {};
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),7000);
  try{
    const url=new URL('../'+date+'/3d/sculptures.json.gz',document.baseURI);
    const response=await fetch(url,{cache,signal:controller.signal});
    if(!response.ok||!response.body)return {};
    const inflated=response.body.pipeThrough(new DecompressionStream('gzip'));
    const parsed=JSON.parse(await Promise.race([
      new Response(inflated).text(),
      new Promise((_,reject)=>controller.signal.addEventListener('abort',()=>reject(new DOMException('Sculpture pack timeout','AbortError')),{once:true}))
    ]));
    return parsed.version===1&&parsed.date===date&&parsed.studies&&
      typeof parsed.studies==='object'?parsed.studies:{};
  }catch(error){
    if(GALLERY_DEBUG)console.warn('Offline sculpture pack unavailable',date,error);
    return {};
  }finally{clearTimeout(timer);}
}
async function loadEdition(date,{viaLift=false,rollback=false}={}) {
  // Preserve the last valid edition so a failed floor construction can be
  // rebuilt instead of leaving the visitor inside an empty scene.
  const previousDate=exhibitDate;
  const previousPosition=rig?.position?.clone();
  const previousYaw=yaw,previousPitch=pitch;
  if(!renderer)return;
  const editionStart=performance.now();
  const url = new URL('../'+date+'/', document.baseURI);
  // Previous daily editions never change; allow normal browser caching.
  // Today's edition can still be updated by the publishing job.
  const today=new Date().toISOString().slice(0,10);
  // Fetch the per-floor texture manifest alongside the dated HTML; older
  // archive floors have no manifest yet and continue working unchanged.
  const cache=date===today?'no-cache':'force-cache';
  const [res,textureManifest,sculpturePack]=await Promise.all([
    fetchGalleryText(url,{cache}),
    fetchGalleryText(new URL('3d/manifest.json',url),{cache,timeoutMs:5000})
      .then(response=>{
        if(!response.ok)return {};
        const parsed=JSON.parse(response.text);
        return parsed.version===1 && parsed.images && typeof parsed.images==='object'
          ?parsed.images:{};
      }).catch(error=>{
        if(GALLERY_DEBUG)console.warn('3D texture manifest unavailable:',date,error);
        return {};
      }),
    loadSculpturePack(date,cache)
  ]);
  if(!res.ok)throw new Error('The edition for '+readableDate(date)+' is not available.');
  const studies=readArchive(res.text,res.url,textureManifest);
  for(const study of studies){
    if(study.portrait&&sculpturePack[study.imageFile]){
      study.prebuilt=sculpturePack[study.imageFile];
    }
  }
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
  for(const texture of staleTextures){texture.dispose();texture.userData.galleryBitmap?.close?.();}
  for(const geometry of staleGeometries)geometry.dispose();
  failedArtworkLoads.clear();
  deferredGalleryJobs=[];deferredGalleryRunning=false;
  editionObjects=[];artExhibits.length=0;sculpturePlacements.length=0;
  exhibitLightTargets.length=0;
  resetInspection();
  liftPosition=null;liftDoorThreshold=null;liftWasNear=false;liftDoors=[];
  const previous=new Set(scene.children);
  arrival=null;entranceDoor=null;
  exhibitDate=date;studyList=studies;plan=nextPlan;currentFloor=nextFloor;
  camera.far=Math.max(210,elevation+240);camera.updateProjectionMatrix();
  const constructionStart=performance.now();
  const sceneBeforeConstruction=new Set(scene.children);
  try{
    constructGallery(plan,studyList);
  }catch(error){
    // Remove partially constructed destination objects before recovery.
    // Otherwise a failed construction leaves orphaned meshes in the scene.
    editionObjects=scene.children.filter(object=>!sceneBeforeConstruction.has(object));
    if(!rollback && previousDate && previousDate!==date){
      console.error('Gallery floor construction failed; restoring previous edition',date,error);
      try{
        await loadEdition(previousDate,{rollback:true});
        if(previousPosition){
          rig.position.copy(previousPosition);
          yaw=previousYaw;pitch=previousPitch;
          rig.rotation.y=yaw;camera.rotation.x=pitch;
        }
        setLiftDoors(false);
      }catch(recoveryError){
        console.error('Previous gallery edition could not be restored',recoveryError);
      }
    }
    throw error;
  }
  GALLERY_DEBUG&&console.info('[Gallery performance] scene construction',Math.round(performance.now()-constructionStart)+'ms','floors',archiveDates.length,'prebuilt',!!prebuiltTowerMatches(prebuiltTower,archiveDates,towerFloorSignatures));
  // Give the optimised entrance lamps priority over deferred artworks/visitors.
  if(currentFloor===0)enableDetailedStreetLamps();
  updateExhibitLighting();
  editionObjects=scene.children.filter(object=>!previous.has(object));
  // A lift arrival needs exhibits promptly; street-level visitors first see the exterior.
  if(viaLift||nextFloor!==0||welcome.hidden)startDeferredGallery();
  if(!viaLift && nextFloor===0 && arrival){
    rig.position.copy(arrival.start);
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
  $('archiveLink').href='../'+date+'/';
  $('welcomeArchive').href='../'+date+'/';
  const floorName=nextFloor===0?'Ground floor':'Floor '+nextFloor;
  $('startFloor').textContent=floorName+' · '+readableDate(date);
  $('floorIndicator').textContent=nextFloor===0?'G':String(nextFloor);
  $('floorIndicator').setAttribute('aria-label','Current archive floor: '+floorName);
  status.textContent=floorName+' · '+readableDate(date)+' · '+studies.length+' works · '+sculpturePlacements.length+' sculptures';
  enter.disabled=false;enter.textContent='Enter the gallery';
  GALLERY_DEBUG&&console.info('[Gallery performance] edition ready',Math.round(performance.now()-editionStart)+'ms',date);
}
async function load(){
  const startupStart=performance.now();
  const progress=message=>{
    if(enter.disabled)enter.textContent=message;
    if(GALLERY_DEBUG)console.info('[Gallery startup]',message,Math.round(performance.now()-startupStart)+'ms');
  };
  try{
    progress('Loading tower data…');
    // The tower index already lists every published date. Avoid downloading and
    // parsing the gallery landing page on every cold start.
    // Retain HTML discovery only as a fallback for an unavailable index.
    // Fetch tower index and prepared geometry together.
    const cacheDay=window.__galleryEarly?.day||new Date().toLocaleDateString('en-CA',{timeZone:'Europe/London'});
    const bakedPromise=loadPrebuiltTower(
      '../tower-geometry.bin.gz?schema=2&day='+cacheDay,window.__galleryEarly?.tower);
    const towerIndexPromise=(window.__galleryEarly?.index
      ?window.__galleryEarly.index.then(async response=>({ok:response.ok,text:response.ok?await response.text():''}))
      :fetchGalleryText('../tower-layouts.json?day='+cacheDay,{timeoutMs:7000}))
      .then(response=>{
        if(!response.ok)return new Map();
        const data=JSON.parse(response.text);
        return data.version===1&&Array.isArray(data.floors)
          ?new Map(data.floors.filter(f=>/^\d{4}-\d{2}-\d{2}$/.test(f.date)&&Array.isArray(f.studies))
            .map(f=>[f.date,f.studies]))
          :new Map();
      }).catch(error=>{console.warn('Tower floor index unavailable',error);return new Map();});
    [towerFloorSignatures,prebuiltTower]=await Promise.all([
      towerIndexPromise,bakedPromise
    ]);
    progress('Building exhibition…');
    GALLERY_DEBUG&&console.info('[Gallery performance] tower metadata and geometry fetched',Math.round(performance.now()-startupStart)+'ms','prebuilt',!!prebuiltTower);
    archiveDates=towerFloorSignatures.size
      ?[...towerFloorSignatures.keys()].sort()
      :await loadArchiveDates();
    const qp=new URLSearchParams(location.search).get('date');
    await loadEdition(qp&&archiveDates.includes(qp)?qp:archiveDates[0]);
    GALLERY_DEBUG&&console.info('[Gallery performance] enter available',Math.round(performance.now()-startupStart)+'ms');
  }catch(e){
    console.error('[Gallery startup] Failed to prepare exhibition',e);
    enter.textContent='Gallery unavailable';
    errorBox.textContent='The virtual gallery could not load. Please reload or continue in the 2D gallery below.';
    errorBox.hidden=false;
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
    const medium=({marker:'Marker',tissue:'Tissue & graphite',watercolour:'Watercolour',oil:'Oil paint',action:'Action painting'})[study.material?.type]||'Drawing';
    const composition=(study.engine||'composition').replace(/[-_]/g,' ');
    $('infoMeta').textContent=[medium,composition,study.portrait?'portrait sculpture':'landscape study'].join(' · ');
    $('infoSeed').textContent='Seed '+study.seed;
    $('openArt').href=study.href;
  }
  currentInfoExhibit=exhibit;
  $('info').hidden=false;
}
$('closeInfo').addEventListener('click',()=>{
  dismissedExhibit=currentInfoExhibit;
  $('info').hidden=true;
  canvas.focus({preventScroll:true});
});
// Keep walking and looking on separate keys so neither requires a mouse.
const moveCodes = new Map([
  ['KeyW','forward'],['KeyS','back'],['KeyA','left'],['KeyD','right']
]);
const lookCodes = new Map([
  ['ArrowLeft','turnLeft'],['ArrowRight','turnRight'],
  ['ArrowUp','lookUp'],['ArrowDown','lookDown']
]);
const isInteractiveFocus=()=>Boolean(document.activeElement?.closest?.(
  'button,a,input,textarea,select,[contenteditable="true"],[role="textbox"]'
));
$('openLift').addEventListener('click',openLift);
$('closeLift').addEventListener('click',()=>closeLift());
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
  if(e.code==='Escape'){
    // Preserve the mouse user's first-Escape-to-unlock behaviour.
    if(document.pointerLockElement===canvas){
      document.exitPointerLock?.();
      return;
    }
    if(!$('lift').hidden){
      e.preventDefault();closeLift();return;
    }
    if(!$('info').hidden){
      e.preventDefault();
      dismissedExhibit=currentInfoExhibit;
      $('info').hidden=true;
      if($('info').contains(document.activeElement))canvas.focus({preventScroll:true});
    }
    return;
  }
  if(e.code==='Tab'){
    pressed.clear();lookPressed.clear();
    return; // Standard keyboard navigation must remain available.
  }
  if(!plan||!welcome.hidden||liftTravelling||!$('lift').hidden||renderer.xr.isPresenting||isInteractiveFocus())return;
  if(e.code==='ShiftLeft'||e.code==='ShiftRight'){
    pressed.add(e.code);
    return;
  }
  if(e.code==='KeyL'){
    e.preventDefault();
    if(!e.repeat)openLift();
    return;
  }
  if(e.code==='KeyE'){
    e.preventDefault();
    if(!e.repeat){
      const exhibit=focusCandidate||currentInfoExhibit;
      if(exhibit){
        showInfo(exhibit);
        $('closeInfo').focus({preventScroll:true});
      }
    }
    return;
  }
  if(moveCodes.has(e.code)){
    e.preventDefault();
    pressed.add(moveCodes.get(e.code));
  }else if(lookCodes.has(e.code)){
    e.preventDefault();
    lookPressed.add(lookCodes.get(e.code));
  }
});
window.addEventListener('keyup',(e)=>{
  if(moveCodes.has(e.code))pressed.delete(moveCodes.get(e.code));
  if(lookCodes.has(e.code))lookPressed.delete(lookCodes.get(e.code));
  if(e.code==='ShiftLeft'||e.code==='ShiftRight')pressed.delete(e.code);
});
window.addEventListener('blur',()=>{pressed.clear();lookPressed.clear();});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){pressed.clear();lookPressed.clear();}
});
window.addEventListener('mousemove',(e)=>{
  if (!renderer || document.pointerLockElement !== canvas || renderer.xr.isPresenting) return;
  yaw -= e.movementX*.0025;
  pitch=Math.max(-1.35,Math.min(1.35,pitch-e.movementY*.0023));
});
canvas.addEventListener('click',(event)=>{
  // Synthetic keyboard clicks are not consent to pointer lock.
  if (event.detail>0 && renderer && welcome.hidden && !renderer.xr.isPresenting && matchMedia('(pointer:fine)').matches && document.pointerLockElement!==canvas) canvas.requestPointerLock?.().catch?.(()=>{});
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
enter.addEventListener('click',(event)=>{
  if (!plan) return;
  welcome.hidden=true;
  startDeferredGallery();
  canvas.focus({preventScroll:true});
  // Enter/Space activation must never force mouse-only pointer lock.
  if (event.detail>0 && matchMedia('(pointer:fine)').matches)
    canvas.requestPointerLock?.().catch?.(()=>{});
});
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
  const visitorX=rig.position.x,visitorZ=rig.position.z;
  ctx.clearRect(0,0,w,h);
  // Rotate the floor plan around the viewer, but fit the visible architecture
  // rather than reserving half the map for the viewer's position.
  const rotation=yaw,cs=Math.cos(rotation),sn=Math.sin(rotation);
  const project=(x,z)=>{
    const dx=x-visitorX,dz=z-visitorZ;
    return {x:dx*cs-dz*sn,y:dx*sn+dz*cs};
  };
  const vertices=[];
  for(const room of plan.rooms){
    const x0=room.x-room.width/2,x1=room.x+room.width/2;
    const z0=room.z-room.depth/2,z1=room.z+room.depth/2;
    for(const x of [x0,x1])for(const z of [z0,z1])vertices.push(project(x,z));
  }
  for(const hall of plan.corridors){
    vertices.push(project(hall.start.x,hall.start.z),project(hall.end.x,hall.end.z));
  }
  // The lift cabin is outside its gallery wall. Include it in the fitted
  // footprint so its symbol cannot be clipped when the plan rotates.
  if(liftPosition)vertices.push(project(liftPosition.x,liftPosition.z));
  if(!vertices.length)return;
  const minX=Math.min(...vertices.map(p=>p.x)),maxX=Math.max(...vertices.map(p=>p.x));
  const minY=Math.min(...vertices.map(p=>p.y)),maxY=Math.max(...vertices.map(p=>p.y));
  const padding=12;
  const scale=Math.min((w-2*padding)/Math.max(1,maxX-minX),(h-2*padding)/Math.max(1,maxY-minY));
  const offsetX=w/2-(minX+maxX)*scale/2,offsetY=h/2-(minY+maxY)*scale/2;
  const point=(x,z)=>{const p=project(x,z);return {x:offsetX+p.x*scale,y:offsetY+p.y*scale};};
  ctx.lineWidth=7;ctx.lineCap='round';ctx.strokeStyle='#999789';
  for(const hall of plan.corridors){
    const start=point(hall.start.x,hall.start.z),end=point(hall.end.x,hall.end.z);
    ctx.beginPath();ctx.moveTo(start.x,start.y);
    ctx.lineTo(end.x,end.y);ctx.stroke();
  }
  for(const room of plan.rooms){
    const x0=room.x-room.width/2,x1=room.x+room.width/2;
    const z0=room.z-room.depth/2,z1=room.z+room.depth/2;
    const corners=[[x0,z0],[x1,z0],[x1,z1],[x0,z1]].map(([x,z])=>point(x,z));
    ctx.beginPath();ctx.moveTo(corners[0].x,corners[0].y);
    for(let i=1;i<corners.length;i++)ctx.lineTo(corners[i].x,corners[i].y);
    ctx.closePath();ctx.fillStyle='#e6e4d8';ctx.strokeStyle='#474b43';
    ctx.lineWidth=1.2;ctx.fill();ctx.stroke();
  }
  const marker=point(visitorX,visitorZ);
  ctx.beginPath();ctx.moveTo(marker.x,marker.y-9);ctx.lineTo(marker.x-5,marker.y+5);
  ctx.lineTo(marker.x+5,marker.y+5);ctx.closePath();
  ctx.fillStyle='#d25232';ctx.fill();
  // Draw the lift using its placed world position, not the room plan: the
  // lift is constructed after the rooms and can move between editions.
  if(liftPosition){
    const lift=point(liftPosition.x,liftPosition.z);
    // A compact outlined square remains legible on mobile without changing
    // the map's size or its viewer-relative orientation.
    ctx.save();
    ctx.fillStyle='#f6d77d';
    ctx.strokeStyle='#303a35';
    ctx.lineWidth=1.8;
    ctx.fillRect(lift.x-5,lift.y-5,10,10);
    ctx.strokeRect(lift.x-5,lift.y-5,10,10);
    ctx.fillStyle='#303a35';
    ctx.font='bold 9px sans-serif';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('L',lift.x,lift.y+.5);
    ctx.restore();
  }
}

function updateMovement(dt) {
  if (!plan || !welcome.hidden || !$('lift').hidden || liftTravelling) return;
  if(!renderer.xr.isPresenting){
    // Continuous, frame-rate-independent keyboard look; arrow keys never walk.
    const lookRate=1.65;
    yaw+=(Number(lookPressed.has('turnLeft'))-Number(lookPressed.has('turnRight')))*lookRate*dt;
    pitch=Math.max(-1.35,Math.min(1.35,pitch+
      (Number(lookPressed.has('lookUp'))-Number(lookPressed.has('lookDown')))*lookRate*.8*dt));
  }
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
    const speed = (pressed.has('ShiftLeft')||pressed.has('ShiftRight')) ? 5.4 : 3.2;
    ahead/=length;side/=length;
    let dx,dz;
    if(renderer.xr.isPresenting){
      // Head-relative locomotion follows where the visitor actually looks.
      // The XR camera has no rig parent. Its world-direction getter rebuilds
      // its matrix without our locomotion rotation, making forward sideways
      // on rotated entrances. Rotate its local headset direction by our yaw.
      const forward=new THREE.Vector3(0,0,-1)
        .transformDirection(renderer.xr.getCamera(camera).matrix)
        .applyAxisAngle(new THREE.Vector3(0,1,0),yaw);
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
function detectArt(elapsed) {
  if (!plan || !welcome.hidden || !$('lift').hidden || liftTravelling || renderer.xr.isPresenting) {
    if(!$('info').hidden)resetInspection();
    return;
  }
  const eye=camera.getWorldPosition(new THREE.Vector3());
  if(dismissedExhibit && eye.distanceTo(dismissedExhibit.position)>4.5) dismissedExhibit=null;
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
  if(!selected){
    $('info').hidden=true;
    currentInfoExhibit=null;focusCandidate=null;focusDuration=0;
  }
  else if(currentInfoExhibit && currentInfoExhibit!==selected && focusDuration<.36){
    // Preserve the current label for a moment while looking between works.
  }else if(selected===dismissedExhibit || (currentInfoExhibit && currentInfoExhibit!==selected)){
    $('info').hidden=true;
  }
  const current=footprintAt(plan,rig.position.x,rig.position.z)?.room ?? -1;
  const text='Floor '+(currentFloor===0?'G':currentFloor)+(current>=0?' · Gallery '+(current+1):' · Walkway');
  if(status.textContent!==text)status.textContent=text;
}
let frameSerial=0;
function tick() {
  if (!renderer) return;
  const frameDebug=typeof GALLERY_DEBUG!=='undefined'&&GALLERY_DEBUG;
  const frameStart=frameDebug?performance.now():0;
  const rawDelta=clock.getDelta();
  const dt=Math.min(rawDelta,.055);
  // Spread canvas painting across frames. This avoids pairing two costly
  // graffiti atlas writes with artwork geometry construction in one tick.
  if((frameSerial++&1)===0)towerGraffiti.paintNext();
  else interiorGraffiti.paintNext();
  // Only construct a deferred exhibit on frames that were already inexpensive.
  // XR still uses this animation loop, rather than window requestAnimationFrame.
  if(dt<.030||(frameSerial%8===0))processDeferredGallery();
  animateLiftDoors(dt);
  entranceDoor?.update(dt,rig.position);
  if(!$('lift').hidden){renderer.render(scene,camera);return;}
  updateMovement(dt);
  lastFocusCheck+=dt;mapElapsed+=dt;
  if(lastFocusCheck>.18){detectArt(lastFocusCheck);updateExhibitLighting();lastFocusCheck=0;}
  if(mapElapsed>.065){drawMap();mapElapsed=0;}
  renderer.render(scene,camera);
  if(frameDebug){
    const spent=performance.now()-frameStart;
    if(spent>34){
      window.__galleryFrameSpikes??=[];
      window.__galleryFrameSpikes.push({ms:Math.round(spent),deltaMs:Math.round(rawDelta*1000),deferred:deferredGalleryJobs.length,frame:frameSerial});
      if(window.__galleryFrameSpikes.length>60)window.__galleryFrameSpikes.shift();
    }
  }
}
if(renderer)renderer.setAnimationLoop(tick);
// Ensure canvas-rendered entrance and lift signs use the actual marker font.
// The font is local; do not hold startup indefinitely if it cannot load.
Promise.race([
  document.fonts.load('42px "AlgoArt Marker"'),
  new Promise(resolve=>setTimeout(resolve,1600))
]).catch(error=>console.warn('Marker font fallback:',error)).finally(load);


