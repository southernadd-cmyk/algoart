import {planPhiReceptionWindow,receptionWindowWallParts,addPhiReceptionWindow} from './phi-reception-window.mjs';
import {advanceLiftDoor} from './phi-lift-motion.mjs';
import {addPhiDeskHologram} from './phi-desk-hologram.mjs';
import {trackGalleryLoading,waitForGalleryEntry,warmGalleryEntry} from './gallery-entry-preparation.mjs';
let phiReceptionLivingMonitor=null;
import {addPhiReceptionLivingMonitor,planPhiReceptionMonitorWall} from './phi-reception-living-monitor.mjs';
import {addPhiTranslationAreaSign,addPhiTowerLiftSign,addPhiLargeMonitorDoorSign} from './phi-translation-area-sign.mjs';
import {createReceptionWallMaterial} from './reception-wall-material.mjs';
import {batchPhiStaticArchitecture} from './phi-static-architecture.mjs';
import {createPhiGalleryMusic} from './gallery-music.mjs?v=music-controls-only-20261027';
import {createReceptionTileMaterial,alignReceptionTileUvs} from './reception-tile-preview.mjs?v=cube-tiles-20261027';
import {installReceptionPenroseInlay} from './reception-penrose-inlay.mjs';
import {planGallerySpeakers,addGalleryCeilingSpeaker} from './gallery-speakers.mjs?v=distributed-record-20261027';
import {addPhiReceptionGramophone} from './phi-reception-gramophone.mjs?v=distributed-record-20261027';
import {addPhiReceptionMetalRoof} from './phi-reception-metal-roof.mjs';
import {deferPhiInteriorAssetsUntil} from './phi-model-assets.mjs';
import {createPhiShellChunkController} from './phi-shell-cache.mjs?v=persistent-shell-20261026';
import {createPhiArtworkPreloader} from './phi-artwork-preload.mjs?v=lift-preload-20261026';
import {addPhiReceptionDesk} from './phi-reception-desk.mjs?v=gallery-reception-20261027';
import {addPhiOutdoorPlants} from './phi-outdoor-plants.mjs?v=plant-rows-20261027';
import {createPhiSquare,clearOfPhiSquare} from './phi-square-graffiti.mjs?v=entry-performance-20261027';
import {phiLiftIndicatorState,paintPhiLiftIndicator} from './phi-lift-indicator.mjs?v=live-marker-20261026';
import {planPhiLiftShaft} from './phi-lift-shaft.mjs?v=clear-landings-20261026';
import {planPhiReception} from './phi-reception-layout.mjs?v=gallery-reception-20261027';
import {addPhiReceptionDecor,addPhiReceptionCredits,createPhiGothicEntrance,renderPhiFurniture,addPhiFrontage,addPhiReceptionMap} from './phi-reception-decor.mjs?v=baked-radiant-painting-20261027';
import {planPhiFurnishings} from './phi-furnishings.mjs?v=larger-reception-desk-20261026';
import {buildPhiRendererPlan} from './phi-full-engine-adapter.mjs?v=public-adapter-20261026';
import {addHangingRoomSigns} from './phi-room-hanging-signs.mjs';
import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { buildLayout, footprintAt, canStand, DOOR_WIDTH, DOOR_HEIGHT, ROOM_HEIGHT, PHI } from './layout-v2.mjs';
import { planGalleryHangs } from './hanging-v3.mjs?v=reserve-glazed-door-walls-20261022';
import { planGallerySculptures,clearOfSculptures,validateSculpturePlacement } from './sculptures.mjs';
import {addPermanentPlazaSculptures} from './plaza-monuments.mjs';
import { createPortraitSculpture, setSculptureArchitecturalMaterials } from './sculpture-render-traced.mjs?v=prebaked-sculptures-20261023';
import { createPhiSculptureStager } from './phi-sculpture-stage.mjs?v=lift-stage-20261026';
import { createArchitecturalMaterials, tiledBoxUvs } from './architectural-materials.mjs?v=ambientcg-ceiling-20261022';
import {placeTwinSpotlight} from './twin-spotlight-fixture.mjs?v=innerscene-twin-v1-20261022';
import {placeCastIronStreetLamp,enableDetailedStreetLamps} from './cast-iron-street-lamps.mjs?v=deferred-download-20261022';
import { appendTowerBoxBatches } from './tower-box-batches.mjs?v=preserve-metre-uv-20261022';
import {createTowerGraffiti} from './exterior-graffiti.mjs?v=atlas-first-20261027';
import {planInteriorGraffiti,interiorGraffitiKey} from './interior-graffiti-plan.mjs';
import { resolveStudyMaterial } from './study-material.mjs';
import { createExteriorLandscape } from './environment-render.mjs?v=daytime-restored-20261027';
import {planVisitors,renderVisitors,renderPlazaSeatedVisitors} from './visitors.mjs?v=arms-forward-v10-20261022';
import {createWalkwayGlassMaterials,createGlassWalkway} from './walkway-glass.mjs?v=doorway-aligned-glass-20261022';
import {createEntranceDoors} from './entrance-doors.mjs?v=working-double-doors-20261022';
import {loadGameReadyElevator,fitGameReadyElevator} from './sketchfab-elevator.mjs?v=model-fit-20261022';

const GALLERY_DEBUG=new URLSearchParams(location.search).has('debug');
// Approved three-floor batching of opaque archived exterior geometry; keep glass individually sorted.
const PHI_BATCH_SHELL=true;
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
let releaseInteriorAssets;
deferPhiInteriorAssetsUntil(new Promise(resolve=>releaseInteriorAssets=resolve));
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
let phiTowerShellCache=null; // Persistent across archive floor swaps.
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
let liftArrivalOpening=false;
let liftPickerConsumed=false;
let phiMovingCabin=null;
let phiLiftCabin=null;
let phiLiftIndicator=null;
let phiLiftTarget=null;
let phiReceptionProps=[];
let phiOutdoorPlants=[];
let phiReceptionMap=null;
let phiReceptionDesk=null;
let phiReceptionGramophone=null;
let phiGalleryMusic=null;
let phiSpeakerEmitters=[];
let phiFurnishingObstacles=[];
let phiSquareObstacles=[];
let phiRideState=null;
let phiRideHidden=[];
let phiLiftPanelPosition=null;
let liftCabinPosition=null;
let liftDoorThreshold=null;
let currentFloor=0;
const FLOOR_SPACING=6.2;
const RECEPTION='__phi_reception__';
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
// Contrast-balanced, shadow-map-free daylight. Keep the existing two lights:
// no extra draw calls, lights, shadow render targets or post-processing passes.
scene.add(new THREE.HemisphereLight('#eaf1ff', '#72796f', 1.08));
const sun = new THREE.DirectionalLight('#fff5e5', 2.20);
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
  renderer.toneMappingExposure = 1.08;
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

const phiStartupLoading=trackGalleryLoading(THREE.DefaultLoadingManager);
const galleryFinish=createArchitecturalMaterials(THREE,{
  lowPower:matchMedia('(pointer:coarse), (prefers-reduced-motion: reduce)').matches,
  startAfter:window.__galleryEarly?.tower
});
const wall=galleryFinish.wall;
let receptionTilePreview=null;
let receptionWallMaterial=null;
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
const phiSquare=createPhiSquare(THREE,{brick:galleryFinish.exteriorBrick,concrete:galleryFinish.floor,lowPower:galleryFinish.lowPower});
if(GALLERY_DEBUG)window.__phiSquareGraffiti={diagnostics:()=>phiSquare.diagnostics(),marks:()=>phiSquare.marks(),
 preview(){const frame=phiSquare.viewpoint();if(!frame)return;const view=new THREE.PerspectiveCamera(55,camera.aspect,.07,210);view.position.copy(frame.position);view.lookAt(frame.target);renderer.setAnimationLoop(null);renderer.render(scene,view);},
 resume(){renderer.setAnimationLoop(tick);}};
if(GALLERY_DEBUG)window.__phiReceptionPreview={
 hologram(){const object=phiReceptionDesk?.root;if(!object?.parent)return;
  object.updateWorldMatrix(true,true);const view=new THREE.PerspectiveCamera(48,camera.aspect,.02,210);
  view.position.copy(object.localToWorld(new THREE.Vector3(1.55,1.95,-2.40)));
  view.lookAt(object.localToWorld(new THREE.Vector3(1.55,1.62,-.40)));
  renderer.setAnimationLoop(null);renderer.render(scene,view);},
 speaker(kind='room'){const object=kind==='lift'?window.__phiCeilingSpeakers?.lift:window.__phiCeilingSpeakers?.rooms[0];if(!object?.parent)return;
  const view=new THREE.PerspectiveCamera(50,camera.aspect,.02,50);object.updateWorldMatrix(true,false);
  view.position.copy(object.localToWorld(new THREE.Vector3(.45,-.6,.45)));view.lookAt(object.getWorldPosition(new THREE.Vector3()));
  renderer.setAnimationLoop(null);renderer.render(scene,view);},
 overview(){const view=new THREE.PerspectiveCamera(55,camera.aspect,.1,500);view.position.set(98,74,-130);view.lookAt(4,67,0);renderer.setAnimationLoop(null);renderer.render(scene,view);},
 show(kind){const object=kind==='map'?phiReceptionMap:kind==='desk'?phiReceptionDesk?.root:kind==='gramophone'?phiReceptionGramophone?.root:phiOutdoorPlants[0];if(!object?.parent)return;
  object.updateWorldMatrix(true,false);const view=new THREE.PerspectiveCamera(55,camera.aspect,.07,210);
  const offset=kind==='map'?new THREE.Vector3(0,0,5.7):kind==='desk'?new THREE.Vector3(0,2.3,-6.8):kind==='gramophone'?new THREE.Vector3(-1.5,1.55,-2):new THREE.Vector3(2,1.4,2.7);
  view.position.copy(object.localToWorld(offset));view.lookAt(object.localToWorld(new THREE.Vector3(0,kind==='map'?0:kind==='desk'?.8:kind==='gramophone'?1.1:.6,0)));
  renderer.setAnimationLoop(null);renderer.render(scene,view);},
 credits(){const art=artExhibits.find(a=>a.study?.title==='Scene models');if(!art)return;
  const view=new THREE.PerspectiveCamera(55,camera.aspect,.07,210);view.position.copy(art.position).addScaledVector(art.normal,5.1);view.position.y=2.6;view.lookAt(art.position.x,2.6,art.position.z);renderer.setAnimationLoop(null);renderer.render(scene,view);},
 resume(){renderer.setAnimationLoop(tick);}
};
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
// Sculptures for the next floor are created off-scene while the lift travels.
// Detached geometry is handed to the active floor before the doors open.
const phiSculptureWorkshop=new THREE.Group();
const phiSculptureStage=createPhiSculptureStager({
 schedule:callback=>requestAnimationFrame(callback),
 create:({study,placement})=>createPortraitSculpture({
  scene:phiSculptureWorkshop,study,placement,
  quality:mobileImages?'mobile':'desktop',labelTexture
 }),
 dispose:({pivot})=>{
  if(!pivot)return;
  const geometries=new Set(),materials=new Set(),textures=new Set();
  pivot.traverse(object=>{
   object.userData.galleryDisposed=true;
   if(object.geometry && !object.geometry.userData?.galleryPersistent)geometries.add(object.geometry);
   const assigned=Array.isArray(object.material)?object.material:[object.material];
   for(const material of assigned){
    if(material?.isMaterial && !material.userData.galleryPersistent &&
       material!==galleryFinish.plinth && material!==galleryFinish.trims)
      materials.add(material);
   }
  });
  pivot.parent?.remove(pivot);
  for(const material of materials){
   for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
   material.dispose();
  }
  for(const texture of textures){texture.dispose();texture.userData.galleryBitmap?.close?.();}
  for(const geometry of geometries)geometry.dispose();
 }
});
if(GALLERY_DEBUG)window.__phiSculptureStage=()=>phiSculptureStage.stats();
// Prepare only the destination floor's paintings while the lift travels.
const phiArtworkPreloader=createPhiArtworkPreloader(undefined,{concurrency:mobileImages?2:4});
if(GALLERY_DEBUG)window.__phiArtworkPreload=()=>phiArtworkPreloader.stats();
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
  // Original production door actuator and approach hysteresis.
  // The destination opening is held until the physical leaves are open.
  if(liftArrivalOpening){
    liftDoorTarget=0;
    if(liftDoorClosure<.025){
      liftArrivalOpening=false;
      if(window.__phiLiftRide?.status==='opening')window.__phiLiftRide.status='ready';
    }
  }else if(liftDoorThreshold&&liftDoors.length&&!liftTravelling){
    const person=renderer?.xr.isPresenting
      ?renderer.xr.getCamera(camera).getWorldPosition(new THREE.Vector3())
      :rig.position;
    const distance=Math.hypot(person.x-liftDoorThreshold.x,person.z-liftDoorThreshold.z);
    if(distance<3.3)liftDoorTarget=0;
    else if(distance>3.8)liftDoorTarget=1;
  }else if(liftTravelling)liftDoorTarget=1;
  // Frame-rate independent easing; a delayed preparation frame must not snap the leaves.
  liftDoorClosure=advanceLiftDoor(liftDoorClosure,liftDoorTarget,dt);
  for(const leaf of liftDoors)
    leaf.position.copy(leaf.userData.open).lerp(leaf.userData.closed,liftDoorClosure);
}
function nearLift(){
  if(!liftPosition)return false;
  // In VR the headset can move relative to the locomotion rig.
  const position=renderer?.xr.isPresenting
    ?renderer.xr.getCamera(camera).getWorldPosition(new THREE.Vector3())
    :rig.position;
  return !!phiLiftPanelPosition && Math.hypot(position.x-phiLiftPanelPosition.x,position.z-phiLiftPanelPosition.z)<1.3 &&
    Math.hypot(position.x-liftPosition.x,position.z-liftPosition.z)<1.95;
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
  if(!liftPosition||liftTravelling||!$('lift').hidden)return;
  liftPickerConsumed=true;
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
// The φ tower has one real, shared vertical shaft at world x=z=0.
// Unlike the legacy cutscene, this temporary cabin and the player's rig move
// continuously through the world while the neighbouring floors stay rendered.
function startPhiCabinRide(targetFloor){
 const startY=rig.position.y;
 const endY=targetFloor*FLOOR_SPACING;
 // Travel in the same furnished cabin, with its calendar and real doors.
 // The floor's golden-angle orientation is reached gradually during travel.
 phiMovingCabin=phiLiftCabin;
 // Hide only the active exhibition, not the cached architectural tower.
 // The shaft's reserved opening allows the other floors to whizz past.
 phiRideHidden=[];
 for(const object of editionObjects){
  if(object===phiMovingCabin)continue;
  if(object.visible){object.visible=false;phiRideHidden.push(object);}
 }
 const startTheta=phiLiftCabin.rotation.y;
 const targetTheta=targetFloor*(2*Math.PI/(PHI*PHI));
 const turn=Math.atan2(Math.sin(targetTheta-startTheta),Math.cos(targetTheta-startTheta));
 const duration=Math.max(1.8,Math.min(9,Math.abs(endY-startY)/7.0+1));
 phiRideState={startY,endY,startTheta,turn,lastTheta:startTheta,started:performance.now(),elapsed:0,duration,resolve:null};
 window.__phiLiftRide={from:startY,to:endY,progress:0,status:'moving'};
 return new Promise(resolve=>{phiRideState.resolve=resolve;});
}
function updatePhiCabinRide(dt){
 if(!phiRideState)return;
 const ride=phiRideState;
 // Navigation clamps long frames to prevent walking through walls. The lift
 // uses elapsed time so a low frame rate cannot stretch a nine-second ride.
 ride.elapsed=Math.min(ride.duration,(performance.now()-ride.started)/1000);
 const p=ride.elapsed/ride.duration;
 // Accelerate and brake smoothly rather than jumping to a new elevation.
 const smooth=p*p*(3-2*p);
 const y=ride.startY+(ride.endY-ride.startY)*smooth;
 rig.position.y=y;
 if(phiMovingCabin){
  phiMovingCabin.position.y=y;
  const theta=ride.startTheta+ride.turn*smooth;
  phiMovingCabin.rotation.y=theta;
  yaw+=theta-ride.lastTheta;ride.lastTheta=theta;
 }
 if(window.__phiLiftRide)window.__phiLiftRide.progress=p;
 if(p>=1){
  phiRideState=null;
  if(window.__phiLiftRide)window.__phiLiftRide.status='arrived';
  ride.resolve();
 }
}
function clearPhiMovingCabin(){
 // Restore only still-mounted objects: departure objects are disposed on arrival.
 for(const object of phiRideHidden)if(object.parent)object.visible=true;
 phiRideHidden=[];
 phiMovingCabin=null;
}
async function travelLift(date,index){
 if(liftTravelling)return;
 liftTravelling=true;
 phiLiftTarget=index;
 const xrRide=renderer.xr.isPresenting;
 $('lift').hidden=true;
 liftPickerConsumed=true;
 liftArrivalOpening=false;
 window.__phiLiftError=null;
 errorBox.hidden=true;
 const departure={date:exhibitDate,position:rig.position.clone(),yaw,pitch};
 window.__phiLiftRide={from:rig.position.y,to:index*FLOOR_SPACING,progress:0,status:'preparing'};
 // Header/keyboard access boards the same physical cabin as wall proximity.
 if(plan?.phi&&liftCabinPosition){
  const boarding=Math.hypot(rig.position.x-liftCabinPosition.x,rig.position.z-liftCabinPosition.z)>2;
  rig.position.copy(liftCabinPosition);
  if(boarding){yaw=plan.phi.world.theta-Math.PI/2;rig.rotation.y=yaw;}
 }
 if(!xrRide)document.exitPointerLock?.();
 canvas.focus({preventScroll:true});
 pressed.clear();touchPressed.clear();lookPressed.clear();
 if(xrRide)paintXRTravel(index);
 // The actual doors shut while the visitor remains in the cabin.
 setLiftDoors(true);
 try{
  // Fetch and validate while still at the departure floor. A failed request
  // must never strand the visitor at an elevation with the old floor loaded.
  const prepared=await preparePhiEdition(date);
  // Begin downloads after metadata validation, before the physical journey.
  const byId=new Map(prepared.studies.map(study=>[study.id,study]));
  phiArtworkPreloader.start(date,prepared.nextPlan.phi.exhibition.paintings
   .map(p=>byId.get(p.studyId)).filter(Boolean)
   .map(study=>study.imageOptimized||study.image).filter(Boolean));
  // Prepare a detached pedestal and traced portrait relief each animation
  // frame while the lift is closing and moving. This is never in the live
  // scene until the destination has been constructed and rotated.
  phiSculptureStage.start(date,prepared.nextPlan.phi.exhibition.sculptures
   .map(p=>({id:p.studyId,study:byId.get(p.studyId),
    placement:{...p,y:prepared.elevation,yaw:0}}))
   .filter(item=>item.study));
  while(liftDoorClosure<.998)await new Promise(resolve=>setTimeout(resolve,30));
  if(plan?.phi){
   await startPhiCabinRide(index);
   // The shared shaft and the other levels remain in the 3D scene for the ride.
   // Replace detailed room contents only after the cabin reaches its landing.
   await loadEdition(date,{viaLift:true,prepared});
  }else{
   await loadEdition(date,{viaLift:true,prepared});
  }
  clearPhiMovingCabin();
  // Build queued exhibits and warm the destination GPU resources with the
  // physical doors still shut. Opening must not be the first render/upload.
  // Bound optional artwork downloads so a slow network cannot hold the lift.
  const preparation=await waitForGalleryEntry({
   loading:{pending:0},timeout:4000,
   isBusy:()=>deferredGalleryJobs.length>0||artworkQueue.length+artworkActive>0||
    towerGraffiti.diagnostics.pending||interiorGraffiti.diagnostics.pending||phiSquare.diagnostics().pending,
   pump:processDeferredGallery
  });
  const warmed=await warmGalleryEntry({renderer,scene,camera});
  if(GALLERY_DEBUG)window.__phiLiftPreparation={...preparation,...warmed,date};
  if(xrRide)closeXRLift();
  else{
   liftReturnFocus=null;canvas.focus({preventScroll:true});
   $('liftArrival').textContent=(date===RECEPTION?'Reception':shortDate(date)+' · Floor '+index)+' · doors opening';
   $('liftArrival').hidden=false;
   setTimeout(()=>$('liftArrival').hidden=true,1550);
  }
  liftTravelling=false;
  liftArrivalOpening=true;
  liftWasNear=true;
  liftPickerConsumed=true;
  setLiftDoors(false);
  if(window.__phiLiftRide)window.__phiLiftRide.status='opening';
 }catch(error){
  phiArtworkPreloader.clear();
  phiSculptureStage.clear();
  if(exhibitDate!==departure.date){
   try{await loadEdition(departure.date,{rollback:true});}
   catch(recoveryError){console.error('[Phi lift] departure recovery failed',recoveryError);}
  }
  rig.position.copy(departure.position);yaw=departure.yaw;pitch=departure.pitch;
  rig.rotation.y=yaw;camera.rotation.x=pitch;
  if(phiLiftCabin){phiLiftCabin.position.y=currentFloor*FLOOR_SPACING;phiLiftCabin.rotation.y=plan.phi.world.theta;}
  clearPhiMovingCabin();
  liftTravelling=false;
  liftArrivalOpening=true;
  setLiftDoors(false);
  console.error('[Phi lift] destination failure', {date,index,atFloor:currentFloor,ride:window.__phiLiftRide},error);
  window.__phiLiftError={message:String(error?.message||error),stack:String(error?.stack||''),date,index};
  window.__phiLiftRide.status='failed';
  errorBox.textContent='The lift could not reach that floor: '+error.message;
  errorBox.hidden=false;
  if(!xrRide){$('lift').hidden=false;$('closeLift').focus({preventScroll:true});}
  else{if(!xrLiftPanel)openXRLift();paintXRLift('Please choose another floor.');}
 }
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
  // Two baked planter-contact shadows share one texture and ONE draw call.
  // Kept separate from expensive real-time shadow maps and sculpture shadows.
  const shadowPositions=[],shadowUvs=[];
  const addPlanterShadow=(x,z)=>{
    const radius=1.48,y=room.y+.008;
    const corners=[[-1,-1],[1,-1],[1,1],[-1,-1],[1,1],[-1,1]];
    for(const [u,v] of corners){
      shadowPositions.push(x+u*radius,y,z+v*radius);
      shadowUvs.push((u+1)/2,(v+1)/2);
    }
  };
  for(const sideSign of [-1,1]){
    const bed=doorway.clone().addScaledVector(outward,8).addScaledVector(transverse,sideSign*4.65);
    place(1.75,.56,1.75,bed.x,room.y+.20,bed.z,galleryFinish.stone);
    addPlanterShadow(bed.x,bed.z);
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
  if(shadowPositions.length){
    const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;
    const ctx=canvas.getContext('2d');
    const gradient=ctx.createRadialGradient(32,32,6,32,32,32);
    gradient.addColorStop(0,'rgba(26,25,22,.30)');
    gradient.addColorStop(.56,'rgba(26,25,22,.16)');
    gradient.addColorStop(1,'rgba(26,25,22,0)');
    ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(shadowPositions,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(shadowUvs,2));
    geometry.computeVertexNormals();
    const texture=new THREE.CanvasTexture(canvas);
    const shadow=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({
      map:texture,transparent:true,depthWrite:false,polygonOffset:true,
      polygonOffsetFactor:-1,side:THREE.DoubleSide
    }));
    shadow.renderOrder=2;
    scene.add(shadow);
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
  releaseInteriorAssets();
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

// One canonical horizontal transform for exterior, live gallery, navigation and map.
function phiFloorTransform(level,lift){
 const theta=level*(2*Math.PI/(((1+Math.sqrt(5))/2)**2));
 const radius=1.6*(1-Math.pow(2/(1+Math.sqrt(5)),level));
 const dx=radius*Math.cos(theta),dz=radius*Math.sin(theta);
 const cs=Math.cos(theta),sn=Math.sin(theta);
 // Lock every landing to one vertical world-space shaft. Rotations still
 // stagger the silhouettes; offsets must be expressed in connector bridges.
 const tx=-(lift.x*cs+lift.z*sn),tz=-(-lift.x*sn+lift.z*cs);
 return {
  theta,dx,dz,tx,tz,
  toWorld:(x,z)=>({x:x*cs+z*sn+tx,z:-x*sn+z*cs+tz}),
  toLocal:(x,z)=>({x:(x-tx)*cs-(z-tz)*sn,z:(x-tx)*sn+(z-tz)*cs})
 };
}
function transformPhiActiveFloor(before){
 const phi=plan.phi,world=phiFloorTransform(currentFloor,phi.circulation.lift);
 phi.world=world;
 const rotate=(v)=>{if(!v)return;const p=world.toWorld(v.x,v.z);v.x=p.x;v.z=p.z;};
 for(const object of scene.children){
  if(before.has(object))continue;
  const pos=world.toWorld(object.position.x,object.position.z);
  object.position.x=pos.x;object.position.z=pos.z;
  object.rotation.y+=world.theta;
 }
 for(const p of sculpturePlacements)rotate(p);
 for(const p of phiSquareObstacles){rotate(p);p.yaw+=world.theta;}
 for(const a of artExhibits){
  rotate(a.position);
  a.normal?.applyAxisAngle(new THREE.Vector3(0,1,0),world.theta);
 }
 rotate(liftPosition);rotate(liftCabinPosition);rotate(liftDoorThreshold);rotate(phiLiftPanelPosition);
 // Moving the meshes alone would leave door-animation endpoints behind
 // when this exhibition level is rotated about the shared lift core.
 for(const leaf of liftDoors){
   if(leaf.parent===scene){rotate(leaf.userData.closed);rotate(leaf.userData.open);}
 }
 rotate(rig.position);
 // The forecourt and entrance are data as well as meshes. Move their
 // navigation coordinates by precisely the same transform as their paving.
 if(phi.plaza){
   rotate(phi.plaza.centre);rotate(phi.arrivalDoor);
   const direction=v=>{const x=v.x,z=v.z;v.x=x*Math.cos(world.theta)+z*Math.sin(world.theta);v.z=-x*Math.sin(world.theta)+z*Math.cos(world.theta);};
   direction(phi.plaza.outward);direction(phi.plaza.transverse);
   if(window.__phiPlaza)window.__phiPlaza.centre={...phi.plaza.centre};
 }
 const original=phi.canWalk;
 phi.canWalk=(x,z)=>{const p=world.toLocal(x,z);return original(p.x,p.z);};
}
// Exterior shell: one lightweight set of walls per archived date. Every floor
// uses its own deterministic phi plan; artwork, lighting and occupants belong
// only to the active floor. No old rectangular tower meshes are used.
function constructPhiTowerShell(){
 const signature=archiveDates.map(date=>date+':'+(towerFloorSignatures.get(date)?.length||0)).join('|');
 if(phiTowerShellCache?.signature===signature && phiTowerShellCache.shell.parent===scene){
  phiTowerShellCache.controller.activate(currentFloor);
  updatePhiShellDiagnostics();
  return;
 }
 // An archive update may invalidate the shell. Dispose its geometry only;
 // architectural textures and materials are shared with the active exhibition.
 if(phiTowerShellCache){
  const old=phiTowerShellCache;
  old.shell.parent?.remove(old.shell);
  const geometries=new Set();
  old.shell.traverse(object=>{if(object.geometry)geometries.add(object.geometry);});
  for(const geometry of geometries)geometry.dispose();
  for(const material of old.ownedMaterials)material.dispose();
  phiTowerShellCache=null;
 }
 const shell=new THREE.Group();shell.name='phi-complete-tower-exterior';
 const masonry=galleryFinish.exteriorBrick||wall;
 const cap=roofFinish;
 // Three-floor geometry chunks preserve frustum culling between tower sections
 // while collapsing thousands of individual meshes into material batches.
 const glassFloors=[];
 const hologramFloors=[];
 const opaqueFloors=[];
 let floorGroup=null,currentBatch=null,shellTransform=null,staticBoxes=0;
 const append=(w,h,d,x,y,z,mat)=>{
  if(w<=0||h<=0||d<=0)return;
  const hologramPosition=shellTransform.toWorld(x,z);
  hologramFloors.at(-1).push([w,h,d,hologramPosition.x,y,hologramPosition.z,shellTransform.theta]);
  staticBoxes++;
  // Transparent panes stay as individually sorted meshes, as in the
  // original renderer; only opaque boxes enter combined buffer geometries.
  if(PHI_BATCH_SHELL&&!mat.transparent){
   const p=shellTransform.toWorld(x,z);
   if(!currentBatch.has(mat))currentBatch.set(mat,[]);
   currentBatch.get(mat).push([w,h,d,p.x,y,p.z,shellTransform.theta]);
   return;
  }
  const geo=new THREE.BoxGeometry(w,h,d);
  if(mat.userData?.tileMeters)tiledBoxUvs(geo,w,h,d,mat.userData.tileMeters);
  const mesh=new THREE.Mesh(geo,mat);
  mesh.position.set(x,y,z);floorGroup.add(mesh);
 };
 // Faceted glass enclosure with a real opening at every rotated landing.
 const shaft=planPhiLiftShaft(archiveDates.length,FLOOR_SPACING);
 const shaftGlass=new THREE.MeshStandardMaterial({color:0xa6ccc8,transparent:true,
  opacity:.14,metalness:.09,roughness:.16,depthWrite:false,side:THREE.DoubleSide});
 const vertices=[],edges=[];
 for(const p of shaft.panels){
  const a=[p.a.x,p.y0,p.a.z],b=[p.b.x,p.y0,p.b.z],c=[p.b.x,p.y1,p.b.z],d=[p.a.x,p.y1,p.a.z];
  vertices.push(...a,...b,...c,...a,...c,...d);
  edges.push(...a,...d,...b,...c);
 }
 const glazing=new THREE.BufferGeometry();glazing.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));glazing.computeVertexNormals();
 const pane=new THREE.Mesh(glazing,shaftGlass);pane.name='phi-open-landing-shaft-glass';shell.add(pane);
 const edgeGeometry=new THREE.BufferGeometry();edgeGeometry.setAttribute('position',new THREE.Float32BufferAttribute(edges,3));
 const shaftEdgesMaterial=new THREE.LineBasicMaterial({color:'#596961',transparent:true,opacity:.55});
 shell.add(new THREE.LineSegments(edgeGeometry,shaftEdgesMaterial));
 const ring=new THREE.TorusGeometry(shaft.radius,.045,4,32);
 for(let level=0;level<archiveDates.length;level++){
  const beam=new THREE.Mesh(ring,join);beam.rotation.x=Math.PI/2;beam.position.y=level*FLOOR_SPACING-.18;shell.add(beam);
 }
 window.__phiLiftShaft={radius:shaft.radius,openings:shaft.openings};
 let count=0;
 for(let level=0;level<archiveDates.length;level++){
  const date=archiveDates[level];
  const archived=towerFloorSignatures.get(date);
  const number=date===RECEPTION?10:(archived?.length||18);
  const stubs=Array.from({length:number},(_,i)=>({id:date+'-'+i,portrait:i%3===0,aspect:i%3===0?.75:1.4}));
  const planned=buildPhiRendererPlan(date===RECEPTION?RECEPTION:date,stubs);
  const wt=phiFloorTransform(level,planned.circulation.lift);
  const y=level*FLOOR_SPACING;
  floorGroup=new THREE.Group();floorGroup.name='phi-archived-floor-glass-'+level;
  shell.add(floorGroup);glassFloors.push(floorGroup);
  currentBatch=new Map();opaqueFloors.push(currentBatch);
  hologramFloors.push([]);
  shellTransform=wt;
  for(const p of planned.pieces)append(p.w,.25,p.h,p.x+p.w/2,y-.16,p.z+p.h/2,floor);
  const shellWindow=date===RECEPTION?planPhiReceptionWindow(planned.circulation.publicEntrance):null;
  for(const w of planned.physical.walls)for(const part of receptionWindowWallParts(w,shellWindow,ROOM_HEIGHT)){
   const len=part.hi-part.lo;if(len<.03)continue;
   const height=part.height,centreY=y+part.bottom+height/2,c=(part.lo+part.hi)/2;
   if(w.axis==='x')append(.20,height,len,w.at,centreY,c,masonry);
   else append(len,height,.20,c,centreY,w.at,masonry);
  }
  if(shellWindow)addPhiReceptionWindow(THREE,floorGroup,{opening:shellWindow,elevation:y,brick:masonry});
  for(const p of planned.pieces)append(p.w,.18,p.h,p.x+p.w/2,y+ROOM_HEIGHT+.09,p.z+p.h/2,cap);
  for(const b of planned.bridges){
   const mid=(b.from+b.to)/2;
   append(b.axis==='x'?b.length:b.width,.16,b.axis==='z'?b.length:b.width,
      b.axis==='x'?mid:b.centre,y-.06,b.axis==='z'?mid:b.centre,bridgeSurface);
   for(const side of [-1,1])append(b.axis==='x'?b.length:.045,2.95,b.axis==='z'?b.length:.045,
      b.axis==='x'?mid:b.centre+side*b.width/2,y+1.6,
      b.axis==='z'?mid:b.centre+side*b.width/2,walkwayGlassMaterials.glass);
   append(b.axis==='x'?b.length:b.width,.045,b.axis==='z'?b.length:b.width,
      b.axis==='x'?mid:b.centre,y+3.1,b.axis==='z'?mid:b.centre,walkwayGlassMaterials.glass);
  }
  // Individual glass panes stay sorted and are hidden on the active floor.
  for(const object of floorGroup.children){
   const p=wt.toWorld(object.position.x,object.position.z);
   object.position.x=p.x;object.position.z=p.z;object.rotation.y+=wt.theta;
  }
  count++;
 }
 const chunkRoot=new THREE.Group();chunkRoot.name='phi-archived-three-floor-batches';
 shell.add(chunkRoot);
 const createView=(start,floors,omitted)=>{
  const buckets=new Map();
  for(const level of floors){
   if(level===omitted)continue;
   for(const [material,boxes] of opaqueFloors[level]){
    if(!buckets.has(material))buckets.set(material,[]);
    buckets.get(material).push(...boxes);
   }
  }
  const view=new THREE.Group();
  view.name='phi-cached-batch-'+start+'-excluding-'+omitted;
  appendTowerBoxBatches(THREE,view,buckets);
  chunkRoot.add(view);
  return view;
 };
 const disposeView=view=>{
  view.parent?.remove(view);
  view.traverse(object=>object.geometry?.dispose());
 };
 const controller=createPhiShellChunkController({
  floorCount:archiveDates.length,chunkSize:3,createView,disposeView,
  toggleFloor:(active,previous)=>{
   if(previous!==null)glassFloors[previous].visible=true;
   glassFloors[active].visible=false;
  }
 });
 scene.add(shell);
 phiTowerShellCache={signature,shell,controller,chunkRoot,glassFloors,hologramFloors,shaftGeometry:glazing,
  staticBoxes,ownedMaterials:[shaftGlass,shaftEdgesMaterial]};
 controller.activate(currentFloor);
 updatePhiShellDiagnostics();
}
function updatePhiShellDiagnostics(){
 const cache=phiTowerShellCache;
 if(!cache)return;
 const batches=cache.chunkRoot.children.filter(view=>view.visible)
  .reduce((n,view)=>n+(view.userData.archivedTowerBatchStats?.batchCount||0),0);
 window.__phiTowerExterior={
  otherFloors:archiveDates.length-1,wallMeshes:cache.shell.children.length,
  staticBoxes:cache.staticBoxes,staticBatches:batches,
  batching:'persistent opaque three-floor chunks',
  cache:cache.controller.stats()
 };
}
function queuePhiFurnishings(phi,furnishings,elevation){
 window.__phiFurnishings={benches:furnishings.benches.length,standing:furnishings.people.filter(p=>!p.seat).length,seated:furnishings.people.filter(p=>p.seat).length};
 deferredGalleryJobs.unshift(()=>{
  const convert=p=>({...p,...phi.world.toWorld(p.x,p.z),rotation:(p.rotation||0)+phi.world.theta,yaw:(p.yaw||0)+phi.world.theta});
  const furniture={benches:furnishings.benches.map(convert),people:furnishings.people.map(convert)};
  renderPhiFurniture(THREE,scene,furniture,{concrete:galleryFinish.stone,timber},elevation);
  const cs=Math.abs(Math.cos(phi.world.theta)),sn=Math.abs(Math.sin(phi.world.theta));
  phiFurnishingObstacles=furnishings.obstacles.map(p=>({...convert(p),width:p.width*cs+p.depth*sn,depth:p.width*sn+p.depth*cs}));
 });
}
function constructPhiGallery(layout,studies){
 const phi=layout.phi,elevation=currentFloor*FLOOR_SPACING;
 const staticArchitecture=[];
 const staticBlock=(...args)=>{const mesh=block(...args);staticArchitecture.push(mesh);return mesh;};
 if(globalThis.__phiReceptionTilePreview&&!receptionTilePreview)receptionTilePreview=createReceptionTileMaterial(THREE,{lowPower:galleryFinish.lowPower});
 if(exhibitDate===RECEPTION&&receptionTilePreview)installReceptionPenroseInlay(THREE,receptionTilePreview,phi.pieces,{lowPower:galleryFinish.lowPower});
 const roomFloor=(exhibitDate===RECEPTION&&receptionTilePreview)||galleryFinish.floor;
 if(GALLERY_DEBUG)window.__phiReceptionTiles=roomFloor===receptionTilePreview?receptionTilePreview:null;
 if(!phiGalleryMusic)phiGalleryMusic=createPhiGalleryMusic(THREE,{canvas,debug:GALLERY_DEBUG});
 const speakers=planGallerySpeakers(phi.floor.mergedRooms,{elevation,ceilingHeight:ROOM_HEIGHT});
 phiSpeakerEmitters=speakers.map(p=>addGalleryCeilingSpeaker(THREE,scene,p));
 if(GALLERY_DEBUG)window.__phiCeilingSpeakers={roomCount:speakers.length,rooms:phiSpeakerEmitters.slice(),lift:null};
 window.__phiFullEngine={date:exhibitDate,roomCount:phi.floor.mergedRooms.length,wallCount:phi.physical.walls.length,artworks:studies.length,paintings:phi.exhibition.paintings.length,sculptures:phi.exhibition.sculptures.length,unplaced:phi.exhibition.unplaced.length,paintingSizes:phi.exhibition.paintings.map(p=>({width:p.width,height:p.height})),paintingsLoaded:0};
 // Every floor, enclosure and collision surface comes from the same phi plan.
 const plaster=galleryFinish?.interiorWall||wall;
 if(exhibitDate===RECEPTION&&!receptionWallMaterial)receptionWallMaterial=createReceptionWallMaterial(THREE,{lowPower:galleryFinish.lowPower});
 // Reuse the exact charcoal Bricks055 material already loaded for the tower exterior.
  const receptionBlackBrickMaterial=galleryFinish.exteriorBrick;
 const roomWall=exhibitDate===RECEPTION?receptionWallMaterial:plaster;
 const receptionWindow=exhibitDate===RECEPTION?planPhiReceptionWindow(phi.circulation.publicEntrance):null;
 if(receptionWindow)addPhiReceptionWindow(THREE,scene,{opening:receptionWindow,elevation,brick:galleryFinish.exteriorBrick});
 // The main foyer's rear wall faces the wallpapered entrance wall.
 // Follow its physical segments so door openings and the outer brick stay intact.
 const foyer=exhibitDate===RECEPTION?[...phi.floor.mergedRooms].sort((a,b)=>b.area-a.area)[0]:null;
 const rearWallAt=foyer?Math.max(...foyer.pieces.map(p=>p.z+p.h)):null;
 for(const p of phi.pieces){
   const slab=staticBlock(p.w,.28,p.h,p.x+p.w/2,elevation-.17,p.z+p.h/2,roomFloor);
   if(roomFloor===receptionTilePreview)alignReceptionTileUvs(slab);
 }
 for(const w of phi.physical.walls)for(const part of receptionWindowWallParts(w,receptionWindow,ROOM_HEIGHT)){
  const len=part.hi-part.lo;if(len<.04)continue;
  const centre=(part.lo+part.hi)/2,centreY=elevation+part.bottom+part.height/2;
  const finish=foyer&&w.axis==='z'&&Math.abs(w.at-rearWallAt)<.001&&foyer.pieces.some(p=>Math.abs(p.z+p.h-w.at)<.001&&w.hi>p.x&&w.lo<p.x+p.w)?receptionBlackBrickMaterial:roomWall;
  const mesh=w.axis==='x'
   ?staticBlock(.19,part.height,len,w.at,centreY,centre,finish)
   :staticBlock(len,part.height,.19,centre,centreY,w.at,finish);
  if(exhibitDate===RECEPTION&&finish===receptionWallMaterial){
   // Explicit reception wall faces. BoxGeometry material order:
   // +X, -X, +Y, -Y, +Z, -Z. The blue wallpaper is retained
   // on -X and +Z; the opposite +X and -Z faces receive
   // charcoal-black brick. Never infer finishes from lights.
   // Reuse the existing mesh/groups rather than cloning geometry or
   // layering coplanar meshes (avoids z-fighting and extra geometry).
   mesh.material=[
    receptionBlackBrickMaterial,receptionWallMaterial,
    receptionWallMaterial,receptionWallMaterial,
    receptionWallMaterial,receptionBlackBrickMaterial
   ];
  }
 }
 // Baked architectural contact occlusion: one vertex-colour mesh for the
 // complete active floor, not one new light or draw call per wall.
 // Transparent gradients hug solid wall segments without crossing doorways.
 {
  const vertices=[],colours=[];
  const addTri=(a,b,c,alphaA,alphaB,alphaC)=>{
   for(const [p,alpha] of [[a,alphaA],[b,alphaB],[c,alphaC]]){
    vertices.push(...p);colours.push(.085,.081,.072,alpha);
   }
  };
  const quad=(a,b,c,d)=>{
   addTri(a,b,c,.22,.22,0);addTri(a,c,d,.22,0,0);
  };
  const y=elevation+.012,reach=.34;
  for(const w of phi.physical.walls){
   if(w.hi-w.lo<.10)continue;
   for(const sign of [-1,1]){
    if(w.axis==='x'){
     const inner=w.at+sign*.102,outer=inner+sign*reach;
     quad([inner,y,w.lo],[inner,y,w.hi],[outer,y,w.hi],[outer,y,w.lo]);
    }else{
     const inner=w.at+sign*.102,outer=inner+sign*reach;
     quad([w.lo,y,inner],[w.hi,y,inner],[w.hi,y,outer],[w.lo,y,outer]);
    }
   }
  }
  if(vertices.length){
   const geo=new THREE.BufferGeometry();
   geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
   geo.setAttribute('color',new THREE.Float32BufferAttribute(colours,4));
   const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({
    vertexColors:true,transparent:true,depthWrite:false,
    side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1
   }));
   mesh.name='phi-baked-architectural-floor-occlusion';
   mesh.renderOrder=1;
   scene.add(mesh);
  }
 }
 // Architectural plaster inside; metre-tiled brick veneer only on exterior faces.
 const inCell=(x,z)=>phi.pieces.some(p=>x>=p.x-.0001&&x<=p.x+p.w+.0001&&z>=p.z-.0001&&z<=p.z+p.h+.0001);
 for(const w of phi.physical.walls)for(const part of receptionWindowWallParts(w,receptionWindow,ROOM_HEIGHT)){
  const len=part.hi-part.lo;if(len<.05)continue;
  const c=(part.lo+part.hi)/2,offset=.24,centreY=elevation+part.bottom+part.height/2;
  if(w.axis==='x'){
   const left=inCell(w.at-offset,c),right=inCell(w.at+offset,c);
   if(left===right)continue;
   const side=left?1:-1;
   staticBlock(.035,part.height,len,w.at+side*.113,centreY,c,galleryFinish.exteriorBrick);
  }else{
   const north=inCell(c,w.at-offset),south=inCell(c,w.at+offset);
   if(north===south)continue;
   const side=north?1:-1;
   staticBlock(len,part.height,.035,c,centreY,w.at+side*.113,galleryFinish.exteriorBrick);
  }
 }
 // Architectural finish follows the actual phi rooms. Keep the office
 // ceiling photographic texture, with trim only at true physical boundaries:
 // subdivided internal cells should not look like a ceiling grid.
 for(const p of phi.pieces)
  staticBlock(p.w,.18,p.h,p.x+p.w/2,elevation+ROOM_HEIGHT+.10,p.z+p.h/2,plaster);
 for(const w of phi.physical.walls){
  const len=w.hi-w.lo;if(len<.45)continue;
  if(w.axis==='x'){
   staticBlock(.13,.16,len,w.at,elevation+ROOM_HEIGHT-.035,(w.lo+w.hi)/2,join);
   staticBlock(.065,.13,len,w.at,elevation+.14,(w.lo+w.hi)/2,galleryFinish.plinth);
  }else{
   staticBlock(len,.16,.13,(w.lo+w.hi)/2,elevation+ROOM_HEIGHT-.035,w.at,join);
   staticBlock(len,.13,.065,(w.lo+w.hi)/2,elevation+.14,w.at,galleryFinish.plinth);
  }
 }
 window.__phiArchitectureBatches=batchPhiStaticArchitecture(THREE,scene,staticArchitecture);
 // Share the production spotlight fixture loader, limiting fixtures to
 // larger merged rooms rather than the many phi subdivision cells.
 const lightRooms=phi.floor.mergedRooms.filter(r=>r.pieces?.length);
 for(const room of lightRooms.slice(0,galleryFinish.lowPower?3:7)){
  const cell=[...room.pieces].sort((a,b)=>b.w*b.h-a.w*a.h)[0];
  if(!cell||cell.w<3||cell.h<3)continue;
  const centre=new THREE.Vector3(cell.x+cell.w/2,elevation+ROOM_HEIGHT-.035,cell.z+cell.h/2);
  const mount=new THREE.Group();mount.position.copy(centre);scene.add(mount);
  const fallback=block(.66,.12,.28,centre.x,centre.y-.1,centre.z,join);
  placeTwinSpotlight(THREE,mount,new THREE.Vector3(centre.x,elevation+1.45,centre.z),fallback);
  const light=new THREE.SpotLight(0xfff3df,12,12,.66,.8,1.5);
  light.position.set(centre.x,elevation+ROOM_HEIGHT-.2,centre.z);
  light.target.position.set(centre.x,elevation+1.1,centre.z);
  scene.add(light,light.target);
 }
 // Put visible portal frames on the exact holes created in the collision walls.
 for(const d of [...phi.circulation.doors,...phi.circulation.bridgePortals]){
  if(d.public)continue;
  const half=d.width/2,head=elevation+3.1;
  if(d.axis==='x'){
   for(const side of [-1,1])block(.21,3.1,.17,d.at,elevation+1.55,d.centre+side*half,join);
   block(.21,.23,d.width+.18,d.at,head,d.centre,join);
  }else{
   for(const side of [-1,1])block(.17,3.1,.21,d.centre+side*half,elevation+1.55,d.at,join);
   block(d.width+.18,.23,.21,d.centre,head,d.at,join);
  }
 }
 for(const b of phi.bridges){
  const mid=(b.from+b.to)/2;
  block(b.axis==='x'?b.length:b.width,.16,b.axis==='z'?b.length:b.width,
    b.axis==='x'?mid:b.centre,elevation-.08,b.axis==='z'?mid:b.centre,bridgeSurface);
  // Open ends meet the actual doorways; glazed sides and a roof enclose
  // the walk without adding a pane across its route.
  for(const side of [-1,1]){
   const x=b.axis==='x'?mid:b.centre+side*b.width/2;
   const z=b.axis==='z'?mid:b.centre+side*b.width/2;
   block(b.axis==='x'?b.length:.045,2.95,b.axis==='z'?b.length:.045,x,elevation+1.6,z,walkwayGlassMaterials.glass);
   for(const height of [.18,3.08])block(b.axis==='x'?b.length:.055,.055,b.axis==='z'?b.length:.055,x,elevation+height,z,join);
   for(const end of [b.from,b.to])block(.06,3.0,.06,b.axis==='x'?end:x,elevation+1.6,b.axis==='z'?end:z,join);
  }
  block(b.axis==='x'?b.length:b.width,.045,b.axis==='z'?b.length:b.width,
    b.axis==='x'?mid:b.centre,elevation+3.1,b.axis==='z'?mid:b.centre,walkwayGlassMaterials.glass);
 }
 // Curator-selected double-sided hanging titles belong to the exhibition,
 // not the reception. Add in floor-local space before the floor's golden
 // rotation is applied to new scene objects.
 window.__phiRoomSigns=exhibitDate===RECEPTION?[]
  :addHangingRoomSigns(THREE,scene,phi,elevation,ROOM_HEIGHT);
 const byId=new Map(studies.map(study=>[study.id,study]));
 const loader=new THREE.TextureLoader();
 for(const p of phi.exhibition.paintings){
  const study=byId.get(p.studyId);if(!study)continue;
  const height=p.height,centreY=elevation+p.y;
  block(p.axis==='x'?.08:p.width+.10,height+.10,p.axis==='x'?p.width+.10:.08,
    p.x-p.normal.x*.06,centreY,p.z-p.normal.z*.06,join);
  const face=new THREE.Mesh(new THREE.PlaneGeometry(p.width,height),
    new THREE.MeshBasicMaterial({color:0xdedacf,side:THREE.FrontSide}));
  face.position.set(p.x,centreY,p.z);
  if(p.axis==='x')face.rotation.y=p.normal.x>0?Math.PI/2:-Math.PI/2;
  else if(p.normal.z<0)face.rotation.y=Math.PI;
  scene.add(face);
  const caption=new THREE.Mesh(new THREE.PlaneGeometry(1.12,.26),
    new THREE.MeshBasicMaterial({map:labelTexture(study.title,study.seed),side:THREE.FrontSide}));
  caption.position.set(p.x,centreY-height/2-.24,p.z);
  caption.rotation.copy(face.rotation);scene.add(caption);
  const url=study.imageOptimized||study.image;
  if(url)deferredGalleryJobs.push(()=>{
   const apply=texture=>{
    if(!face.parent||face.userData.galleryDisposed){texture.dispose();return;}
    texture.colorSpace=THREE.SRGBColorSpace;
    face.material.dispose();
    face.material=new THREE.MeshBasicMaterial({map:texture,side:THREE.FrontSide});
    window.__phiFullEngine.paintingsLoaded++;
   };
   const fallback=source=>{
    if(!face.parent||face.userData.galleryDisposed)return;
    loader.load(source,apply,undefined,error=>console.warn('Phi painting failed to load',study.id,error));
   };
   // Reuse the decoded lift image instead of issuing another image request.
   const warmed=phiArtworkPreloader.take(exhibitDate,url);
   if(warmed)warmed.then(image=>{
    if(!face.parent||face.userData.galleryDisposed)return;
    if(!image){fallback(study.image||url);return;}
    const texture=new THREE.Texture(image);
    texture.needsUpdate=true;
    apply(texture);
   });
   else fallback(url); // Direct links and cold starts work as before.
  });
  artExhibits.push({study,position:face.position.clone(),normal:new THREE.Vector3(p.normal.x,0,p.normal.z)});
 }
 for(const p of phi.exhibition.sculptures){
  const study=byId.get(p.studyId);if(!study)continue;
  const placement={...p,y:elevation,yaw:0};
  sculpturePlacements.push(placement);
  const staged=phiSculptureStage.take(exhibitDate,study.id);
  if(staged?.pivot){
   // Pivot remains in floor-local coordinates here. The existing
   // transformPhiActiveFloor rotates it with the rest of the exhibition.
   scene.add(staged.pivot);
  }else{
   // Direct date links, slow background tabs and failed preparations still
   // use the original reliable incremental construction path.
   deferredGalleryJobs.push(()=>{
    // Deferred fallback is constructed after the active floor was rotated.
    // Its position and yaw must therefore use the final world coordinates.
    const world=plan?.phi?.world;
    const location=world
     ?{...placement,...world.toWorld(p.x,p.z),yaw:world.theta}
     :placement;
    createPortraitSculpture({
     scene,study,placement:location,quality:mobileImages?'mobile':'desktop',labelTexture
    });
   });
  }
  artExhibits.push({study,position:new THREE.Vector3(p.x,elevation+1.5,p.z)});
 }
 // The shaft landing is an actual collision surface; the full gallery lift UI
 // continues to use liftPosition and liftCabinPosition unchanged.
 const l=phi.circulation.lift;
 const cabin=new THREE.Group();cabin.name='phi-archive-lift-cabin';
 cabin.position.set(l.x,elevation,l.z);scene.add(cabin);phiLiftCabin=cabin;
 const liftSpeaker=addGalleryCeilingSpeaker(THREE,cabin,{x:.68,y:2.962,z:-.68,diameter:.25,name:'lift-ceiling-speaker'});
 phiSpeakerEmitters.push(liftSpeaker);
 if(GALLERY_DEBUG)window.__phiCeilingSpeakers.lift=liftSpeaker;
 const cabinObject=object=>{
  object.position.sub(cabin.position);cabin.add(object);return object;
 };
 const cabinBlock=(...args)=>cabinObject(block(...args));
 block(2.9,.2,2.9,l.x,elevation-.09,l.z,galleryFinish.floor);

 // Enclosed exterior arrival lobby. The east-facing doorway to the gallery
 // stays open, as does the lift-facing approach in the cabin's west end.
 const outerWest=l.x+1.43,innerEast=l.portal.at,depth=2.4;
 phiLiftPanelPosition=new THREE.Vector3(l.x,elevation,l.z+1.10);
 // The short passage from the reception landing door to the moving cabin
 // must be enclosed. Transparent side panes exposed the plaza/shaft through
 // what should read as continuous masonry beside the doorway.
 for(const side of [-1,1])
  block(Math.max(.06,innerEast-outerWest+.12),3.2,.17,
   (outerWest+innerEast)/2,elevation+1.6,l.z+side*depth/2,galleryFinish.stone);
 block(innerEast-outerWest,.14,depth,(outerWest+innerEast)/2,elevation+3.27,l.z,ceilingFinish);
 block(innerEast-outerWest,.16,depth,(outerWest+innerEast)/2,elevation-.08,l.z,galleryFinish.floor);
 // Door opening coincides exactly with the reserved physical portal.
 const openingHalf=l.portal.width/2;
 for(const side of [-1,1])
   block(.17,3.2,.16,innerEast,elevation+1.6,l.z+side*openingHalf,join);
 block(.17,.2,l.portal.width+.15,innerEast,elevation+3.23,l.z,join);
 for(const sx of [-1,1])for(const sz of [-1,1])block(.12,ROOM_HEIGHT,.12,l.x+sx*1.38,elevation+ROOM_HEIGHT/2,l.z+sz*1.38,join);
 block(Math.max(2.4,Math.abs((l.portal?.at??l.x+2.25)-l.x)+.5),.16,2.3,(l.x+(l.portal?.at??l.x+2.25))/2,elevation-.08,l.z,galleryFinish.floor);
 const liftLight=new THREE.PointLight(0xfff4d8,8,12,2);liftLight.position.set(l.x,elevation+2.8,l.z);cabinObject(liftLight);
 // Same procedural brushed-steel texture as the production archive lift.
 const steelCanvas=document.createElement('canvas');steelCanvas.width=128;steelCanvas.height=128;
 const brush=steelCanvas.getContext('2d'),pixels=brush.createImageData(128,128);
 for(let x=0;x<128;x++)for(let y=0;y<128;y++){
  const h=((x*1213+y*197)^((x+41)*8309))>>>0;
  const v=Math.max(214,Math.min(250,Math.round(234+4*Math.sin(x*.22)+3*Math.sin(x*.73)+(h%7)-3)));
  const i=(y*128+x)*4;pixels.data[i]=v;pixels.data[i+1]=Math.min(255,v+2);
  pixels.data[i+2]=Math.min(255,v+2);pixels.data[i+3]=255;
 }
 brush.putImageData(pixels,0,0);
 const brushed=new THREE.MeshStandardMaterial({color:'#bdc3c0',metalness:.57,roughness:.49,
   map:new THREE.CanvasTexture(steelCanvas)});
 brushed.map.colorSpace=THREE.SRGBColorSpace;
 const bronze=new THREE.MeshStandardMaterial({color:'#424b47',metalness:.58,roughness:.43});
 const rubber=new THREE.MeshStandardMaterial({color:'#303937',roughness:.88});
 cabinBlock(2.65,.055,2.65,l.x,elevation+.02,l.z,rubber);
 // Rear wall only. The forward (+X) face must remain a real opening:
 // previously the generic loop built a full-height opaque steel wall across it.
 cabinBlock(.065,2.75,2.55,l.x-1.31,elevation+1.43,l.z,brushed);
 for(const side of [-1,1]){
  cabinBlock(2.55,2.75,.065,l.x,elevation+1.43,l.z+side*1.31,brushed);
  cabinBlock(2.6,.08,.085,l.x,elevation+2.92,l.z+side*1.25,bronze);
  cabinBlock(2.4,.045,.055,l.x,elevation+.93,l.z+side*1.22,bronze);
 }
 cabinBlock(2.6,.1,2.6,l.x,elevation+3.02,l.z,brushed);
 // Portal surrounds reproduce the existing archive lift's bronze/metal trim.
 for(const side of [-1,1])block(.07,2.7,.16,l.portal.at-.12,elevation+1.38,l.z+side*1.12,bronze);
 block(.12,.23,2.5,l.portal.at-.12,elevation+2.93,l.z,brushed);

 if(currentFloor===0){
  // Reuse the production square, furnishings, monuments and seated visitors.
  // Its approach is westward from the new external vestibule entrance.
  const entrance=phi.circulation.publicEntrance;
  const outward=entrance?{x:0,z:-1}:{x:-1,z:0};
  const transverse={x:outward.z,z:-outward.x};
  const doorway=entrance?{x:entrance.centre,z:entrance.at}:{x:l.x-1.45,z:l.z};
  entranceDoor=createPhiGothicEntrance(THREE,{doorway,outward,level:elevation,surroundMaterial:galleryFinish.stone});scene.add(entranceDoor.root);
  // A true exterior roof cap fitted to the full ground-floor footprint,
  // not a canopy hanging off the doorway. This is transformed together with
  // the active floor, while the original interior ceiling remains untouched.
  const roofBounds={
   minX:Math.min(...phi.pieces.map(p=>p.x)),
   maxX:Math.max(...phi.pieces.map(p=>p.x+p.w)),
   minZ:Math.min(...phi.pieces.map(p=>p.z)),
   maxZ:Math.max(...phi.pieces.map(p=>p.z+p.h))
  };
  addPhiReceptionMetalRoof(THREE,scene,{bounds:roofBounds,elevation,ceilingHeight:ROOM_HEIGHT,brick:galleryFinish.exteriorBrick});
  addPhiFrontage(THREE,entranceDoor.root,{concrete:galleryFinish.stone,timber,metal:join,defer:deferredGalleryJobs});
  const plaza={centre:{x:doorway.x+outward.x*12,z:doorway.z+outward.z*12},outward,transverse,
    halfWidth:30,halfDepth:29,level:elevation};
  const approach={doorway,outward,pathLength:42,halfWidth:3.25};
  const beforeLandscape=new Set(scene.children);
  const exterior=createExteriorLandscape(THREE,scene,layout,studies,{
    lowPower:galleryFinish.lowPower,protectedLayouts:[],approach,plaza});
  const outdoor=addPhiOutdoorPlants(THREE,scene,exterior.plaza||plaza,scene.children.filter(o=>!beforeLandscape.has(o)));
  phiOutdoorPlants=outdoor.holders;phiSquareObstacles.push(...outdoor.obstacles);
  // The two original roof landmarks now stand on the paved forecourt in
  // front of the long south-facing brick façade, to one side of the public
  // entrance. They face arriving visitors and leave the doorway approach clear.
  if(currentFloor===0){
   const monuments=addPermanentPlazaSculptures(scene,plaza);
   const offsets=[6.9,14.1]; // Metres along the frontage, away from the door
   const facadeDistance=4.7; // Metres outward onto the paving, not roof height
   const face=Math.atan2(outward.x,outward.z);
   monuments.forEach((m,i)=>{
    const x=doorway.x+transverse.x*offsets[i]+outward.x*facadeDistance;
    const z=doorway.z+transverse.z*offsets[i]+outward.z*facadeDistance;
    m.position.set(x,elevation,z);
    m.rotation.y=face+(i===0?.10:-.10);
    // These are wide, fixed ground-level works. Use normal rectangular
    // collision bounds rather than letting visitors walk through the frames.
    // Preserve a generous corridor in front of the reception doorway.
    phiSquareObstacles.push({x,z,yaw:m.rotation.y,width:5.45,depth:1.9,
     kind:'plaza-sculpture'});
   });
   window.__phiPlazaMonumentPositions=monuments.map(m=>({
    x:m.position.x,y:m.position.y,z:m.position.z,yaw:m.rotation.y
   }));
   window.__phiPlazaMonuments=monuments.length;
  }
  deferredGalleryJobs.push(()=>renderPlazaSeatedVisitors(THREE,scene,plaza));
  const square=phiSquare.addTo(scene,{doorway,outward,elevation});phiSquareObstacles.push(...square.obstacles);
  window.__phiPlaza={centre:plaza.centre,benchCount:8,monumentCount:2,visitorSlots:2,tagWalls:square.walls,squareMonumentCount:square.monuments,tags:square.tags};
  // Exterior marker-font sign, mounted above the public doorway on the
  // reception facade and transformed with the rest of the ground floor.
  if(entrance){
   const plaque=document.createElement('canvas');plaque.width=1536;plaque.height=176;
   const lettering=plaque.getContext('2d');
   lettering.fillStyle='#303f39';lettering.fillRect(0,0,1536,176);
   lettering.fillStyle='#f2efe3';lettering.textAlign='center';
   lettering.font='120px "AlgoArt Marker", Georgia, serif';
   lettering.fillText('PROPORTION PIECE',768,128,1440);
   const map=new THREE.CanvasTexture(plaque);map.colorSpace=THREE.SRGBColorSpace;
   const markerSign=new THREE.Mesh(new THREE.PlaneGeometry(7.4,.85),
    new THREE.MeshBasicMaterial({map,side:THREE.DoubleSide}));
   markerSign.position.set(doorway.x,elevation+ROOM_HEIGHT+.15,doorway.z-.14);
   markerSign.rotation.y=Math.PI; // Canvas front must face south towards the square.
   markerSign.name='phi-exterior-marker-sign';
   scene.add(markerSign);
   window.__phiExteriorSign=true;
  }
  // Permit visitors to exit the lobby onto the open paved square.
  phi.plaza=plaza;
  phi.arrivalDoor=doorway;
 }
 liftCabinPosition=new THREE.Vector3(l.x,elevation,l.z);
 liftPosition=liftCabinPosition.clone();
 liftDoorThreshold=liftCabinPosition.clone();
 if(exhibitDate===RECEPTION){
  const furnishing=planPhiReception(phi.floor,phi.circulation,phi.physical);
  const towerLiftSign=addPhiTowerLiftSign(THREE,scene,{
   lift:l,entrance:phi.circulation.publicEntrance,elevation
  });
  if(towerLiftSign)phiSquareObstacles.push({
   x:towerLiftSign.placement.x,z:towerLiftSign.placement.z,
   width:.42*towerLiftSign.placement.scale+.08,
   depth:.34*towerLiftSign.placement.scale+.08,
   yaw:towerLiftSign.placement.yaw,kind:'daily-tower-lift-chalkboard'
  });
  phiReceptionDesk=addPhiReceptionDesk(THREE,scene,furnishing,elevation,{concrete:galleryFinish.stone,timber:galleryFinish.timberSmoked,trims:galleryFinish.trims});
  if(phiReceptionDesk)phiSquareObstacles.push(...phiReceptionDesk.obstacles);
  if(globalThis.__phiReceptionTestRefresh&&furnishing.desk){
   phiReceptionGramophone=addPhiReceptionGramophone(THREE,scene,{furnishing,elevation,camera,canvas,timber:galleryFinish.timberSmoked||galleryFinish.timber,trims:galleryFinish.trims,music:phiGalleryMusic,debug:GALLERY_DEBUG});
   phiSquareObstacles.push(phiReceptionGramophone.obstacle);
   phiSpeakerEmitters.push(phiReceptionGramophone.emitter);
  }
  const captions=[
   ['PROPORTION PIECE','An algorithmically generated gallery','exhibiting algorithmically generated art.'],
   ['THE GROWING TOWER','A new floor of art is added daily.','Choose an exhibition in the archive lift.']
  ];
  for(const [i,item] of furnishing.signage.entries()){
   const paper=document.createElement('canvas');paper.width=1024;paper.height=512;
   const g=paper.getContext('2d');g.fillStyle='#f0ece3';g.fillRect(0,0,1024,512);
   g.fillStyle='#2e3e33';g.font='60px "AlgoArt Marker", Georgia';g.fillText(captions[i][0],40,105,945);
   g.font='36px "AlgoArt Marker", Georgia';captions[i].slice(1).forEach((line,n)=>g.fillText(line,40,208+n*83,950));
   const texture=new THREE.CanvasTexture(paper);texture.colorSpace=THREE.SRGBColorSpace;
   const board=new THREE.Mesh(new THREE.PlaneGeometry(item.width,item.height||1.65),
      new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));
   board.position.set(item.x,elevation+(item.centreY||1.85),item.z);
   board.rotation.y=item.axis==='x'?(item.normal.x>0?Math.PI/2:-Math.PI/2):(item.normal.z>0?0:Math.PI);
   scene.add(board);
  }
  const plantMaterial=new THREE.MeshStandardMaterial({color:'#56705b',roughness:1,flatShading:true});
  const leafLight=new THREE.MeshStandardMaterial({color:'#819477',roughness:1,flatShading:true});
  queuePhiFurnishings(phi,planPhiFurnishings(phi,{reception:furnishing,lowPower:galleryFinish.lowPower}),elevation);
  phiReceptionProps=addPhiReceptionDecor(THREE,scene,furnishing,elevation);
  if(globalThis.__phiLivingMonitorTest){
   // A monitor should not disappear just because the furniture planner found
   // no compact storage room. Use the smallest non-foyer room cell as fallback.
   const fallback=phi.floor.mergedRooms.flatMap((room,i)=>room.pieces.map(p=>({
    x:p.x+p.w/2,z:p.z+p.h/2,width:p.w,depth:p.h,area:p.w*p.h,room:i
   }))).filter(p=>p.width>=2.5&&p.depth>=2.5&&(!foyer||p.room!==phi.floor.mergedRooms.indexOf(foyer)))
     .sort((a,b)=>a.area-b.area)[0];
   const monitorRoom=furnishing.backrooms?.[0]||fallback;
   // A separate, genuinely different room gets only TWO large screens,
   // reproducing the rightmost animation from each existing 3×3 bank.
   // Prefer the other reception backroom with its own uninterrupted solid wall.
   const rearRoom=(furnishing.backrooms||[]).find(candidate=>
    candidate!==monitorRoom &&
    Math.hypot(candidate.x-monitorRoom.x,candidate.z-monitorRoom.z)>
      Math.max(2.2,Math.min(candidate.width,candidate.depth)) &&
    planPhiReceptionMonitorWall(candidate,furnishing.lift,phi.physical.walls)?.fromPhysical);
   if(monitorRoom)phiReceptionLivingMonitor=addPhiReceptionLivingMonitor(THREE,scene,{
    room:monitorRoom,rearRoom:rearRoom||null,lift:furnishing.lift,
    physicalWalls:phi.physical.walls,elevation,camera
   });
   // Place the matching A-frame in the MAIN reception outside the actual
   // doorway leading to the second backroom, not inside either monitor room.
   const monitorDoorSign=addPhiLargeMonitorDoorSign(THREE,scene,{
    rearRoom:rearRoom||null,foyerRoomIndex:furnishing.desk?.room??phi.floor.mergedRooms.indexOf(foyer),
    doors:phi.circulation.doors,floor:phi.floor,
    physicalWalls:phi.physical.walls,elevation
   });
   if(monitorDoorSign)phiSquareObstacles.push({
    x:monitorDoorSign.placement.x,z:monitorDoorSign.placement.z,
    width:.42*monitorDoorSign.placement.scale+.08,
    depth:.34*monitorDoorSign.placement.scale+.08,
    yaw:monitorDoorSign.placement.yaw,kind:'large-monitor-room-translation-sign'
   });
   window.__phiLargeMonitorEntranceSignDiagnostics={
    rearRoom:rearRoom||null,placed:!!monitorDoorSign,
    placement:monitorDoorSign?.placement||null,
    meshFaces:monitorDoorSign?.meshFaces||0,
    get visible(){return !!scene.getObjectByName('phi-translation-area-large-monitor-entrance-sign');}
   };
   // Always expose placement diagnostics on test; this needs to be
   // verifiable even when debug mode is disabled.
   window.__phiLivingMonitorDiagnostics={
    selectedRoom:monitorRoom||null,placed:!!phiReceptionLivingMonitor,
    screenCount:phiReceptionLivingMonitor?.screenCount||0,
    bankCount:phiReceptionLivingMonitor?.bankCount||0,
    totalScreenCount:phiReceptionLivingMonitor?.totalScreenCount||0,
    get secondBank(){return phiReceptionLivingMonitor?.secondBankDiagnostics||null;},
    get rearWall(){return phiReceptionLivingMonitor?.rearWallDiagnostics||null;},
    largeScreenCount:phiReceptionLivingMonitor?.largeScreenCount||0,
    rowCount:phiReceptionLivingMonitor?.rowCount||0,
    wall:phiReceptionLivingMonitor?.mount||null,
    localPosition:phiReceptionLivingMonitor?.root.position.toArray()||null,
    get media(){return phiReceptionLivingMonitor?.mediaDiagnostics||{state:'no-monitor'};},
    get mediaWatercolour(){return phiReceptionLivingMonitor?.watercolourDiagnostics||{state:'no-monitor'};},
    get info(){return phiReceptionLivingMonitor?.infoDiagnostics||{state:'no-monitor'};}
   };
  }
  {
   // Use the interior glass doorway by the gramophone, never the main entrance.
   const gramophone=phiReceptionGramophone?.obstacle;
   const interiorDoors=(phi.circulation.doors||[]).filter(d=>
    (d.axis==='x'||d.axis==='z')&&Number.isFinite(d.at)&&Number.isFinite(d.centre));
   const doorDistance=d=>Math.hypot(
    (d.axis==='x'?d.at:d.centre)-gramophone.x,
    (d.axis==='z'?d.at:d.centre)-gramophone.z);
   const translationDoor=gramophone?interiorDoors.sort((a,b)=>doorDistance(a)-doorDistance(b))[0]:null;
   const installation=addPhiTranslationAreaSign(THREE,scene,{
    entrance:translationDoor,
    gramophone,
    elevation
   });
   if(installation){
    // Keep the larger sign solid without closing the actual glass doorway.
    phiSquareObstacles.push({
     x:installation.placement.x,z:installation.placement.z,
     width:.42*installation.placement.scale+.08,
     depth:.34*installation.placement.scale+.08,
     yaw:installation.placement.yaw,kind:'translation-area-chalkboard'
    });
   }
   window.__phiTranslationAreaSignDiagnostics={
    inputs:{entrance:translationDoor,gramophone:gramophone||null},
    placed:!!installation,placement:installation?.placement||null,
    modelFaces:installation?.meshFaces||0,
    get visible(){return !!scene.getObjectByName('phi-translation-area-doorway-sign');}
   };
  }
  // Permanent reception installation: two pre-baked Growth Systems sculptures
  // at the visitor-approved exact local coordinates. Do not involve any
  // curator, door, furniture or collision placement rules.
  if(exhibitDate===RECEPTION){
   const placements=[
    {x:4.411915702544714,z:-0.6555802049181754,yawOffset:0},
    {x:0.30772021302065866,z:-2.943824927389186,yawOffset:Math.PI/2}
   ];
   fetch(new URL('./data/reception-growth-systems.json',import.meta.url))
    .then(response=>{
     if(!response.ok)throw Error('Offline sculpture bake missing');
     return response.json();
    })
    .then(bake=>{
     // The download is asynchronous; don't attach a reception statue to
     // whichever exhibition has replaced reception in the meantime.
     if(exhibitDate!==RECEPTION||plan?.phi!==phi||
        !bake.qualities?.desktop?.length)return;
     const study={
      seed:bake.seed,title:'Growth Systems',href:bake.href,
      material:{type:'oil',params:{paper:'#f5f0e6'}},
      image:new URL('./data/reception-growth-systems.png',import.meta.url).href,
      prebuilt:{desktop:bake.qualities.desktop,mobile:bake.qualities.mobile}
     };
     // All copies share the first copy's facing, with the second exactly
     // 90 degrees counter-clockwise; world theta applies to both equally.
     const world=phi.world;
     const baseYaw=Math.atan2(
      furnishing.entrance.x-placements[0].x,
      furnishing.entrance.z-placements[0].z
     )+(world?.theta||0);
     const copies=placements.map((place,index)=>{
      const position=world?.toWorld(place.x,place.z)||place;
      const built=createPortraitSculpture({
       scene,study,quality:mobileImages?'mobile':'desktop',
       placement:{x:position.x,y:elevation,z:position.z,
        yaw:baseYaw+place.yawOffset},
       labelTexture
      });
      built.pivot.name='phi-reception-growth-systems-'+(index+1);
      built.pivot.scale.setScalar(1.4);
      phiReceptionProps.push(built.pivot);
      return {name:built.pivot.name,local:{x:place.x,z:place.z},
       world:{x:position.x,z:position.z},yaw:built.pivot.rotation.y};
     });
     // Diagnostic only. This does not influence placement or movement.
     window.__phiReceptionHeroTest={loaded:true,copies,collision:false,manual:false};
    })
    .catch(error=>console.warn('Reception sculpture installation unavailable',error));
  }

  phiReceptionMap=addPhiReceptionMap(THREE,scene,furnishing.worldMap,elevation);
  const credits=addPhiReceptionCredits(THREE,scene,furnishing.credits,elevation);
  artExhibits.push(...credits);window.__phiReceptionCredits={count:credits.length,placement:furnishing.credits};
  window.__phiReception={growingPoster:furnishing.signage[1],creditPlacement:furnishing.credits,worldMap:furnishing.worldMap,desk:!!furnishing.desk,information:furnishing.signage.length>0,
    signCount:furnishing.signage.length,plantCount:furnishing.plants.length,credits:credits.length,clearance:furnishing.checks};
 }
 if(exhibitDate!==RECEPTION)queuePhiFurnishings(phi,planPhiFurnishings(phi,{lowPower:galleryFinish.lowPower}),elevation);
 // Gallery-side lift doors: frame and leaves kept distinct from walking collision.
 const liftFace=l.x+1.30;
 // Two animated steel landing leaves, aligned to the physical portal.
 liftDoors=[];
 for(const side of [-1,1]){
  const leaf=cabinBlock(.105,2.8,l.portal.width/2-.045,liftFace-.10,
    elevation+1.42,l.z+side*(l.portal.width/4),brushed);
  leaf.userData.closed=leaf.position.clone();
  leaf.userData.open=leaf.position.clone().add(new THREE.Vector3(0,0,side*(l.portal.width/2-.055)));
  liftDoors.push(leaf);
 }
 liftDoorClosure=0;liftDoorTarget=0;
 // Physical calendar plaque on the inner cabin wall. Approaching this
 // plaque opens the interactive month/date picker once, like artwork inspection.
 const calendarCanvas=document.createElement('canvas');calendarCanvas.width=512;calendarCanvas.height=640;
 const cg=calendarCanvas.getContext('2d');
 cg.fillStyle='#263831';cg.fillRect(0,0,512,640);
 cg.strokeStyle='#bdad7a';cg.lineWidth=12;cg.strokeRect(16,16,480,608);
 cg.fillStyle='#f0ede2';cg.textAlign='center';
 cg.font='48px "AlgoArt Marker", Georgia';cg.fillText('Exhibitions',256,89);
 const calendarDate=exhibitDate===RECEPTION?archiveDates.at(-1):exhibitDate;
 const month=calendarDate.slice(0,7),year=Number(month.slice(0,4)),monthNumber=Number(month.slice(5,7));
 cg.font='30px Georgia';cg.fillText(new Date(calendarDate+'T12:00:00Z').toLocaleDateString('en-GB',{month:'long',year:'numeric',timeZone:'UTC'}),256,146);
 cg.font='21px Arial';
 ['M','T','W','T','F','S','S'].forEach((d,i)=>cg.fillText(d,64+i*64,208));
 const first=(new Date(Date.UTC(year,monthNumber-1,1)).getUTCDay()+6)%7;
 const days=new Date(Date.UTC(year,monthNumber,0)).getUTCDate();
 for(let day=1;day<=days;day++){
  const slot=first+day-1,x=64+slot%7*64,y=254+Math.floor(slot/7)*51;
  const date=month+'-'+String(day).padStart(2,'0'),available=archiveDates.includes(date);
  if(date===exhibitDate){cg.fillStyle='#b8c6a7';cg.fillRect(x-23,y-28,46,43);}
  cg.fillStyle=available?(date===exhibitDate?'#263831':'#f0ede2'):'#738177';
  cg.font=available?'bold 27px Arial':'25px Arial';cg.fillText(String(day),x,y);
 }
 cg.fillStyle='#f0ede2';cg.font='24px Georgia';cg.fillText(currentFloor===0?'Ground floor · Reception':'Floor '+currentFloor+' · '+shortDate(exhibitDate),256,551);cg.fillText('Approach to choose a date',256,599);
 const calendarTexture=new THREE.CanvasTexture(calendarCanvas);
 calendarTexture.colorSpace=THREE.SRGBColorSpace;
 const controlBoard=new THREE.Mesh(new THREE.PlaneGeometry(.89,1.12),
  new THREE.MeshBasicMaterial({map:calendarTexture,side:THREE.DoubleSide}));
 controlBoard.position.set(l.x,elevation+1.65,l.z+1.19);
 controlBoard.rotation.y=Math.PI; // Face inward from the +Z cabin wall.
 controlBoard.name='phi-lift-wall-calendar';cabinObject(controlBoard);
  // Brushed cabin door and illuminated floor indicator.
 const indicator=document.createElement('canvas');indicator.width=768;indicator.height=192;
 const ink=indicator.getContext('2d');
 const tex=new THREE.CanvasTexture(indicator);tex.colorSpace=THREE.SRGBColorSpace;
 phiLiftIndicator={canvas:indicator,context:ink,texture:tex,last:null};
 paintPhiLiftIndicator(phiLiftIndicator,phiLiftIndicatorState({height:elevation,dates:archiveDates,currentFloor}));
 const sign=new THREE.Mesh(new THREE.PlaneGeometry(1.9,.48),new THREE.MeshBasicMaterial({map:tex,side:THREE.FrontSide}));
 sign.position.set(liftFace-.16,elevation+2.78,l.z);sign.rotation.y=-Math.PI/2;cabinObject(sign);
 const landingSign=new THREE.Mesh(new THREE.PlaneGeometry(1.9,.48),sign.material);
 landingSign.position.set(l.portal.at+.13,elevation+3.55,l.z);landingSign.rotation.y=Math.PI/2;scene.add(landingSign);
 for(const side of [-1,1])cabinBlock(.16,3.1,.17,liftFace,elevation+1.55,l.z+side*1.22,join);
 cabinBlock(.19,.24,2.55,liftFace,elevation+3.15,l.z,join);
 rig.position.copy(liftCabinPosition);
 arrival=null;
 if(phi.exhibition.paintings.length+phi.exhibition.sculptures.length!==studies.length)
   throw Error('Phi curator omitted artworks');
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
  if(date===RECEPTION)return 'Reception';
  return new Intl.DateTimeFormat('en-GB',{dateStyle:'long',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
}
function shortDate(date){
  if(date===RECEPTION)return 'Reception';
  return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
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
async function preparePhiEdition(date) {
  const reception=date===RECEPTION;
  const url = new URL('../'+(reception?archiveDates[1]:date)+'/', document.baseURI);
  // Previous daily editions never change; allow normal browser caching.
  // Today's edition can still be updated by the publishing job.
  const today=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/London'});
  // Fetch the per-floor texture manifest alongside the dated HTML; older
  // archive floors have no manifest yet and continue working unchanged.
  const cache=date===today?'no-cache':'force-cache';
  const [res,textureManifest,sculpturePack]=reception?[{ok:true,text:'',url:url.href},{},{}]:await Promise.all([
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
  const studies=reception?[]:readArchive(res.text,res.url,textureManifest);
  for(const study of studies){
    if(study.portrait&&sculpturePack[study.imageFile]){
      study.prebuilt=sculpturePack[study.imageFile];
    }
  }
  if(!reception&&!studies.length)throw new Error('No artworks for this edition');
  const phi=reception?buildPhiRendererPlan(RECEPTION,Array.from({length:10},(_,i)=>({id:'foyer-placeholder-'+i,portrait:i%3===0,aspect:i%3===0?.75:1.4}))):buildPhiRendererPlan(date,studies);
  if(reception){phi.exhibition.paintings=[];phi.exhibition.sculptures=[];phi.exhibition.unplaced=[];phi.checks.unplaced=0;}
  if(!phi.checks.connected||(!reception&&!phi.checks.count)||!phi.checks.unique||
     !phi.checks.inwardFacing||!phi.checks.clearances||phi.checks.unplaced)
    throw new Error('Invalid phi exhibition plan: '+JSON.stringify(phi.checks));
  const nextPlan={
    date,artworkCount:studies.length,phi,
    rooms:phi.pieces.map((p,i)=>({index:i,x:p.x+p.w/2,z:p.z+p.h/2,width:p.w,depth:p.h,y:0,doors:[],neighbours:[]})),
    corridors:[]
  };
  const nextFloor=archiveDates.indexOf(date);
  if(nextFloor<0)throw new Error('Archive floor missing');
  const elevation=nextFloor*FLOOR_SPACING;
  for(const room of nextPlan.rooms)room.y+=elevation;
  for(const hall of nextPlan.corridors){hall.start.y+=elevation;hall.end.y+=elevation;}
  return {studies,nextPlan,nextFloor,elevation,reception};
}
async function loadEdition(date,{viaLift=false,rollback=false,prepared=null}={}) {
  // Destination data is fully checked before any current scene is removed.
  const previousDate=exhibitDate;
  const previousPosition=rig?.position?.clone();
  const previousYaw=yaw,previousPitch=pitch;
  if(!renderer)return;
  const editionStart=performance.now();
  const {studies,nextPlan,nextFloor,elevation,reception}=prepared||await preparePhiEdition(date);
  // Dispose *all* edition-owned GPU resources, including artwork maps and
  // procedural canvas textures, but not materials/geometry shared across floors.
  phiReceptionGramophone?.dispose();phiReceptionGramophone=null;
  phiReceptionLivingMonitor?.dispose();phiReceptionLivingMonitor=null;
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
  liftPosition=null;liftDoorThreshold=null;phiLiftPanelPosition=null;liftWasNear=false;liftDoors=[];
  phiReceptionProps=[];phiOutdoorPlants=[];phiReceptionMap=null;phiReceptionDesk=null;phiFurnishingObstacles=[];phiSquareObstacles=[];phiLiftIndicator=null;
  window.__phiDeskHologram=null;
  liftPickerConsumed=false;
  const previous=new Set(scene.children);
  arrival=null;entranceDoor=null;
  exhibitDate=date;studyList=studies;plan=nextPlan;currentFloor=nextFloor;
  camera.far=Math.max(210,elevation+240);camera.updateProjectionMatrix();
  const constructionStart=performance.now();
  const sceneBeforeConstruction=new Set(scene.children);
  try{
    constructPhiGallery(plan,studyList);
    if(plan.phi)transformPhiActiveFloor(sceneBeforeConstruction);
    phiGalleryMusic.setEmitters(phiSpeakerEmitters);
  }catch(error){
    // Remove partially constructed destination objects before recovery.
    // Otherwise a failed construction leaves orphaned meshes in the scene.
    editionObjects=scene.children.filter(object=>!sceneBeforeConstruction.has(object)&&object!==phiTowerShellCache?.shell);
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
  GALLERY_DEBUG&&console.info('[Gallery performance] scene construction',Math.round(performance.now()-constructionStart)+'ms','floors',archiveDates.length);
  // All staged sculpture pivots have either been attached or replaced by
  // deferred fallbacks. Dispose any unused detached objects now.
  if(viaLift)phiSculptureStage.clear();
  if(plan.phi)constructPhiTowerShell();
  if(currentFloor===0&&phiReceptionDesk&&phiTowerShellCache){
    const cache=phiTowerShellCache;
    phiReceptionDesk.hologram=addPhiDeskHologram(THREE,phiReceptionDesk.root,{
      floorBoxes:cache.hologramFloors,shaftGeometry:cache.shaftGeometry,signature:cache.signature
    });
    window.__phiDeskHologram=phiReceptionDesk.hologram?.diagnostics||null;
  }
  // Give the optimised entrance lamps priority over deferred artworks/visitors.
  if(currentFloor===0)enableDetailedStreetLamps();
  updateExhibitLighting();
  editionObjects=scene.children.filter(object=>!previous.has(object)&&object!==phiTowerShellCache?.shell);
  // A lift arrival needs exhibits promptly; street-level visitors first see the exterior.
  startDeferredGallery();
  if(!viaLift && nextFloor===0 && plan.phi?.plaza){
    const door=plan.phi.arrivalDoor;
    const out=plan.phi.plaza.outward;
    rig.position.set(door.x+out.x*9.8,0,door.z+out.z*9.8);
    yaw=Math.atan2(out.x,out.z);pitch=.14;rig.rotation.y=yaw;camera.rotation.x=pitch;
  }
  if(!viaLift && nextFloor===0 && arrival){
    rig.position.copy(arrival.start);
    yaw=Math.atan2(arrival.outward.x,arrival.outward.z);
    rig.rotation.y=yaw;pitch=-.16;camera.rotation.x=pitch;
  }
  if(viaLift&&liftCabinPosition){
    rig.position.copy(liftCabinPosition);
    const towards=plan.phi?new THREE.Vector3(Math.cos(plan.phi.world?.theta||0),0,-Math.sin(plan.phi.world?.theta||0)):new THREE.Vector3(plan.rooms[0].x-liftCabinPosition.x,0,plan.rooms[0].z-liftCabinPosition.z);
    if(!plan.phi){yaw=Math.atan2(-towards.x,-towards.z);pitch=0;}
    rig.rotation.y=yaw;camera.rotation.x=pitch;
    liftWasNear=true;liftPickerConsumed=true;welcome.hidden=true;
    liftDoorClosure=1;liftDoorTarget=1;
    for(const leaf of liftDoors)leaf.position.copy(leaf.userData.closed);
    history.replaceState(null,'',date===RECEPTION?location.pathname:'?date='+date);
  }
  $('liftMonth').value=(reception?archiveDates[1]:date).slice(0,7);
  $('archiveLink').href='../'+(reception?archiveDates[1]:date)+'/';
  $('welcomeArchive').href='../'+(reception?archiveDates[1]:date)+'/';
  const floorName=nextFloor===0?'Ground floor':'Floor '+nextFloor;
  $('startFloor').textContent=floorName+' · '+readableDate(date);
  $('floorIndicator').textContent=nextFloor===0?'G · Reception':shortDate(date)+' · Floor '+nextFloor;
  $('floorIndicator').setAttribute('aria-label','Current archive floor: '+floorName);
  status.textContent=reception?'Ground floor · reception and visitor information':floorName+' · '+readableDate(date)+' · '+studies.length+' works · '+sculpturePlacements.length+' sculptures';
  if(!viaLift&&!welcome.hidden){
    enter.textContent='Preparing gallery…';
    const prepared=await waitForGalleryEntry({
      loading:phiStartupLoading,
      isBusy:()=>deferredGalleryJobs.length>0||artworkQueue.length+artworkActive>0||
        towerGraffiti.diagnostics.pending||interiorGraffiti.diagnostics.pending||phiSquare.diagnostics().pending,
      pump:processDeferredGallery
    });
    const warmed=await warmGalleryEntry({renderer,scene,camera});
    if(GALLERY_DEBUG)window.__phiEntryPreparation={...prepared,...warmed,pending:phiStartupLoading.pending,complete:true};
    phiStartupLoading.dispose();
  }
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
    // The phi shell is built from archive metadata; legacy baked geometry is not used.
    const cacheDay=window.__galleryEarly?.day||new Date().toLocaleDateString('en-CA',{timeZone:'Europe/London'});
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
    towerFloorSignatures=await towerIndexPromise;
    progress('Building exhibition…');
    GALLERY_DEBUG&&console.info('[Gallery performance] archive metadata fetched',Math.round(performance.now()-startupStart)+'ms');
    archiveDates=towerFloorSignatures.size
      ?[...towerFloorSignatures.keys()].sort()
      :await loadArchiveDates();
    archiveDates.unshift(RECEPTION);
    const qp=new URLSearchParams(location.search).get('date');
    await loadEdition(qp&&archiveDates.includes(qp)?qp:RECEPTION);
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
  if(study.credits){
    $('infoImage').src=study.image;$('infoImage').alt=study.title;
    $('infoTitle').textContent=study.title;$('infoMeta').textContent='Models, materials and licences';
    $('infoSeed').textContent=study.credits;$('openArt').href=study.href;$('openArt').textContent='Full credits and source links';
    currentInfoExhibit=exhibit;$('info').hidden=false;return;
  }
  $('openArt').textContent='Explore this drawing';
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
$('liftReception').addEventListener('click',()=>{
  if(exhibitDate===RECEPTION)closeLift({returnToCanvas:true});
  else travelLift(RECEPTION,0);
});
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
  if(!plan||!welcome.hidden||!$('lift').hidden||renderer.xr.isPresenting||isInteractiveFocus())return;
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
  if(document.hidden){pressed.clear();lookPressed.clear();phiFrameLast=0;}
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
  // Spawning inside a dated floor's lift is not a new walk-in event.
  // Re-arm proximity only after the visitor leaves the cabin.
  liftWasNear=Boolean(nearLift());
  if(liftWasNear)liftPickerConsumed=true;
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
let phiMapMode='physical';
window.setPhiMapMode=mode=>{if(['physical','merged','subdivision'].includes(mode)){phiMapMode=mode;drawMap();}};
function drawPhiMap(){
 const canvas=$('floorMap'),phi=plan.phi;if(!canvas||!phi)return;
 const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
 ctx.clearRect(0,0,w,h);
 const shapes=phi.floor.rooms;
 const localVisitor=phi.world?phi.world.toLocal(rig.position.x,rig.position.z):{x:rig.position.x,z:rig.position.z};
 // The reception is a public foyer, not an art floor.
 const reception=exhibitDate===RECEPTION;
 const all=[...shapes.flatMap(p=>[[p.x,p.z],[p.x+p.w,p.z+p.h]]),[phi.circulation.lift.x,phi.circulation.lift.z],[localVisitor.x,localVisitor.z]];
 const minX=Math.min(...all.map(p=>p[0]))-3,maxX=Math.max(...all.map(p=>p[0]))+3;
 const minZ=Math.min(...all.map(p=>p[1]))-3,maxZ=Math.max(...all.map(p=>p[1]))+3;
 const scale=Math.min((w-24)/(maxX-minX),(h-24)/(maxZ-minZ));
 const X=x=>(x-(minX+maxX)/2)*scale+w/2,Z=z=>(z-(minZ+maxZ)/2)*scale+h/2;
 const rect=(p,fill,stroke)=>{ctx.fillStyle=fill;ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.fillRect(X(p.x),Z(p.z),p.w*scale,p.h*scale);ctx.strokeRect(X(p.x),Z(p.z),p.w*scale,p.h*scale);};
 if(phiMapMode==='subdivision'){for(const p of shapes)rect(p,'#e5e2d5','#a39f8e');}
 else{
  for(const [i,room] of phi.floor.mergedRooms.entries())for(const p of room.pieces)rect(p,['#ebe8db','#dce5df','#e6dfd9','#dedfe8'][i%4],'#b1b1a4');
  if(phiMapMode==='physical'){
   for(const b of phi.bridges){const p=b.axis==='x'?{x:Math.min(b.from,b.to),z:b.centre-b.width/2,w:b.length,h:b.width}:{x:b.centre-b.width/2,z:Math.min(b.from,b.to),w:b.width,h:b.length};rect(p,'#a9d4d4','#56898a');}
   ctx.strokeStyle='#39463f';ctx.lineWidth=2;
   for(const wall of phi.physical.walls){ctx.beginPath();if(wall.axis==='x'){ctx.moveTo(X(wall.at),Z(wall.lo));ctx.lineTo(X(wall.at),Z(wall.hi));}else{ctx.moveTo(X(wall.lo),Z(wall.at));ctx.lineTo(X(wall.hi),Z(wall.at));}ctx.stroke();}
   for(const d of [...phi.circulation.doors,...phi.circulation.bridgePortals]){ctx.strokeStyle='#d0a16e';ctx.lineWidth=3.5;ctx.beginPath();if(d.axis==='x'){ctx.moveTo(X(d.at),Z(d.centre-d.width/2));ctx.lineTo(X(d.at),Z(d.centre+d.width/2));}else{ctx.moveTo(X(d.centre-d.width/2),Z(d.at));ctx.lineTo(X(d.centre+d.width/2),Z(d.at));}ctx.stroke();}
  }
 }
 if(reception){
   const door=phi.circulation.publicEntrance;
   if(door){ctx.fillStyle='#376a55';ctx.fillRect(X(door.centre)-12,Z(door.at)-5,24,7);}
   const p=phi.floor.rooms[0];ctx.fillStyle='#3e5147';ctx.font='bold 10px sans-serif';
   ctx.fillText('RECEPTION',X(p.x+p.w/2)-27,Z(p.z+p.h/2));
 }
 const l=phi.circulation.lift;
 ctx.fillStyle='#d9c68c';ctx.fillRect(X(l.x)-6,Z(l.z)-6,12,12);ctx.fillStyle='#27352e';ctx.font='bold 10px sans-serif';ctx.fillText('L',X(l.x)-3,Z(l.z)+4);
 ctx.fillStyle='#d25436';ctx.save();ctx.translate(X(localVisitor.x),Z(localVisitor.z));ctx.rotate(-yaw+(phi.world?.theta||0));ctx.beginPath();ctx.moveTo(0,-9);ctx.lineTo(-6,5);ctx.lineTo(6,5);ctx.closePath();ctx.fill();ctx.restore();
}
let lastMapView=null;
function drawMap(){
  const mapCanvas=$('floorMap');
  if(!plan||!mapCanvas)return;
  // Preserve the exact map while stationary. Invalidate on every real view,
  // floor, mode or canvas-size change, including lift travel and resize.
  const view=[plan,plan.phi?.world,phiMapMode,mapCanvas.width,mapCanvas.height,
    rig.position.x,rig.position.z,yaw,exhibitDate,currentFloor,liftPosition?.x,liftPosition?.z];
  if(lastMapView&&view.every((value,i)=>value===lastMapView[i]))return;
  lastMapView=view;
  if(plan?.phi)return drawPhiMap();
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

function onPhiPlaza(x,z){
 const phi=plan?.phi,p=phi?.plaza;if(!p||currentFloor!==0)return false;
 const dx=x-p.centre.x,dz=z-p.centre.z;
 const along=dx*p.outward.x+dz*p.outward.z;
 const across=dx*p.transverse.x+dz*p.transverse.z;
 if(Math.abs(along)>p.halfDepth-.4||Math.abs(across)>p.halfWidth-.4)return false;
 // The paved square extends beneath the tower; never make solid walls
 // traversable merely because pavement is visible on the other side.
 const point=phi.world?phi.world.toLocal(x,z):{x,z};
 if(phi.pieces.some(c=>point.x>=c.x-.4&&point.x<=c.x+c.w+.4&&point.z>=c.z-.4&&point.z<=c.z+c.h+.4))
   return phi.canWalk(x,z);
 // Entrance threshold connects the square to the enclosed lift foyer.
 const door=phi.arrivalDoor;
 return ((x-door.x)*p.outward.x+(z-door.z)*p.outward.z)>-.5 || phi.canWalk(x,z);
}
function phiDoorBlocked(x,z){
 if(!plan?.phi)return false;
 const p=plan.phi.world.toLocal(x,z),l=plan.phi.circulation.lift;
 if(liftDoorClosure>=.12&&Math.abs(p.x-(l.x+1.20))<.43&&Math.abs(p.z-l.z)<1.27)return true;
 const entrance=plan.phi.circulation.publicEntrance;
 return currentFloor===0&&entrance&&Math.abs(p.z-entrance.at)<.45&&
   Math.abs(p.x-entrance.centre)>.63&&Math.abs(p.x-entrance.centre)<1.8;
}
function updateMovement(dt) {
  if (!plan || !welcome.hidden || !$('lift').hidden) return;
  // Look remains responsive during physical travel; only translation is locked.
  // Never snap the rig back to the old floor while its cabin is moving.
  if(liftTravelling){
    if(!renderer.xr.isPresenting){
      const lookRate=1.65;
      yaw+=(Number(lookPressed.has('turnLeft'))-Number(lookPressed.has('turnRight')))*lookRate*dt;
      pitch=Math.max(-1.35,Math.min(1.35,pitch+
        (Number(lookPressed.has('lookUp'))-Number(lookPressed.has('lookDown')))*lookRate*.8*dt));
    }
    rig.rotation.y=yaw;
    camera.rotation.x=renderer.xr.isPresenting?0:pitch;
    return;
  }
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
    if (((plan.phi?(plan.phi.canWalk(rig.position.x+dx,rig.position.z)||onPhiPlaza(rig.position.x+dx,rig.position.z)):canStand(plan,rig.position.x+dx,rig.position.z))||(plan.phi?false:onArrivalPath(rig.position.x+dx,rig.position.z))) && clearOfPhiSquare(phiSquareObstacles,rig.position.x+dx,rig.position.z) && !phiDoorBlocked(rig.position.x+dx,rig.position.z) && clearOfSculptures(phiFurnishingObstacles,rig.position.x+dx,rig.position.z) && clearOfSculptures(sculpturePlacements,rig.position.x+dx,rig.position.z)) rig.position.x+=dx;
    if (((plan.phi?(plan.phi.canWalk(rig.position.x,rig.position.z+dz)||onPhiPlaza(rig.position.x,rig.position.z+dz)):canStand(plan,rig.position.x,rig.position.z+dz))||(plan.phi?false:onArrivalPath(rig.position.x,rig.position.z+dz))) && clearOfPhiSquare(phiSquareObstacles,rig.position.x,rig.position.z+dz) && !phiDoorBlocked(rig.position.x,rig.position.z+dz) && clearOfSculptures(phiFurnishingObstacles,rig.position.x,rig.position.z+dz) && clearOfSculptures(sculpturePlacements,rig.position.x,rig.position.z+dz)) rig.position.z+=dz;
  }
  const part=plan.phi?((plan.phi.canWalk(rig.position.x,rig.position.z)||onPhiPlaza(rig.position.x,rig.position.z))?{y:currentFloor*FLOOR_SPACING,zone:'room'}:null):footprintAt(plan,rig.position.x,rig.position.z);
  if(part)rig.position.y=part.y;
  else if(onArrivalPath(rig.position.x,rig.position.z))rig.position.y=arrival.baseY;
  const atLift=Boolean(nearLift());
  if(xrLiftPanel && !atLift)closeXRLift();
  // Doors react at the threshold; the calendar opens exactly once after
  // stepping into the cabin. Re-arm only after leaving the entire lift area.
  if(!atLift && liftPosition &&
     Math.hypot(rig.position.x-liftPosition.x,rig.position.z-liftPosition.z)>3.3)
    liftPickerConsumed=false;
  if(atLift&&!liftWasNear&&!liftPickerConsumed&&$('lift').hidden)openLift();
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
  let locationLabel;
  if(plan.phi){
    const local=plan.phi.world.toLocal(rig.position.x,rig.position.z);
    const room=plan.phi.floor.mergedRooms.findIndex(r=>r.pieces.some(p=>
      local.x>=p.x&&local.x<=p.x+p.w&&local.z>=p.z&&local.z<=p.z+p.h));
    locationLabel=Math.hypot(rig.position.x,rig.position.z)<2.1?'Archive lift':
      currentFloor===0?(room>=0?'Reception':'Public square'):
      room>=0?'Gallery '+(room+1):'Glass walkway';
  }else{
    const current=footprintAt(plan,rig.position.x,rig.position.z)?.room??-1;
    locationLabel=current>=0?'Gallery '+(current+1):'Walkway';
  }
  const text=(currentFloor===0?'Ground floor':shortDate(exhibitDate)+' · Floor '+currentFloor)+' · '+locationLabel;
  if(status.textContent!==text)status.textContent=text;
}
// Frame diagnostics only: keep the original pixel density and VR scaling.
const phiPerformanceTest=!!globalThis.__phiReceptionTestRefresh;
const phiPerf={samples:[],lastPublish:0,lastAdjustment:0,pixelRatio:0,quality:'default'};
let phiFrameLast=0;
const phiBaseRatio=Math.min(window.devicePixelRatio||1,matchMedia('(pointer:coarse)').matches?1.35:1.7);
if(phiPerformanceTest)window.__phiPerformance=phiPerf;
function measurePhiPerformance(now){
 if(!phiPerformanceTest||!renderer||renderer.xr.isPresenting)return;
 if(phiFrameLast){
  const ms=now-phiFrameLast;
  // Keep long stalls in the diagnostics: filtering them out hid the very
  // stutters this display is meant to measure. Tab suspension is excluded.
  if(ms>0&&!document.hidden){phiPerf.samples.push(ms);if(phiPerf.samples.length>90)phiPerf.samples.shift();}
 }
 phiFrameLast=now;
 if(now-phiPerf.lastPublish>1200&&phiPerf.samples.length>=30){
  const ordered=[...phiPerf.samples].sort((a,b)=>a-b);
  const median=ordered[Math.floor(ordered.length/2)];
  const p95=ordered[Math.floor(ordered.length*.95)];
  const current=renderer.getPixelRatio();
  Object.assign(phiPerf,{medianFrameMs:+median.toFixed(1),p95FrameMs:+p95.toFixed(1),
   fps:Math.round(1000/median),pixelRatio:renderer.getPixelRatio(),
   maxFrameMs:+ordered.at(-1).toFixed(1),framesOver50ms:ordered.filter(ms=>ms>50).length,
   quality:renderer.getPixelRatio()<phiBaseRatio?'adaptive':'full',
   drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,
   geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,
   pool:globalThis.__phiPoolPerf||null});
  phiPerf.lastPublish=now;
 }
}
let phiFrameSerial=0;
function tick() {
 measurePhiPerformance(performance.now());
  if (!renderer) return;
  const elapsed=clock.getDelta(),dt=Math.min(elapsed,.055);
  const paintSlot=phiFrameSerial++%3;
  const doorsMoving=liftArrivalOpening||Math.abs(liftDoorTarget-liftDoorClosure)>.002;
  // Canvas painting and its texture uploads compete with the door animation.
  // Resume them once the leaves stop, including ordinary approach openings.
  if(!doorsMoving){
   if(paintSlot===0&&towerGraffiti.diagnostics.pending)towerGraffiti.paintNext();
   else if(paintSlot===1&&interiorGraffiti.diagnostics.pending)interiorGraffiti.paintNext();
   else phiSquare.paintNext();
  }
  // Finish lift motion before building expensive portrait geometry. In XR
  // this same renderer loop still owns all deferred artwork construction.
  if(!liftTravelling&&!doorsMoving&&(dt<.030||phiFrameSerial%8===0))processDeferredGallery();
  animateLiftDoors(elapsed);
  updatePhiCabinRide(dt);
  if(phiLiftIndicator)paintPhiLiftIndicator(phiLiftIndicator,phiLiftIndicatorState({
    height:rig.position.y,spacing:FLOOR_SPACING,dates:archiveDates,currentFloor,
    targetFloor:phiLiftTarget,phase:phiRideState||window.__phiLiftRide?.status==='arrived'?'moving':liftTravelling?'preparing':'idle'
  }));
  entranceDoor?.update(dt,rig.position);
  phiGalleryMusic?.update(rig.position);
  phiReceptionDesk?.hologram?.update(clock.elapsedTime);
  if(!$('lift').hidden){renderer.render(scene,camera);return;}
  updateMovement(dt);
  if(GALLERY_DEBUG)window.__phiLiftState={
    floor:currentFloor,date:exhibitDate,travelling:liftTravelling,
    x:rig.position.x,y:rig.position.y,z:rig.position.z,yaw,pitch,
    doorClosure:liftDoorClosure,cabinY:phiLiftCabin?.position.y,
    calendarCount:phiLiftCabin?.children.filter(o=>o.name==='phi-lift-wall-calendar').length,
    doorCount:liftDoors.length,threeRevision:THREE.REVISION,
    entranceModelLoaded:!!entranceDoor?.root.userData.modelLoaded,
    propsLoaded:phiReceptionProps.filter(o=>o.userData.modelLoaded).length,
    deskPropsLoaded:phiReceptionDesk?.root.userData.propsLoaded||0,
    worldMapLoaded:!!phiReceptionMap?.userData.modelLoaded,
    outdoorPlantsLoaded:phiOutdoorPlants.filter(o=>o.userData.modelLoaded).length,
    outdoorPlantsReplaced:phiOutdoorPlants.reduce((n,o)=>n+(o.userData.replaced||0),0),
    indicator:phiLiftIndicator?.last,indicatorFont:phiLiftIndicator?.context.font
  };
  lastFocusCheck+=dt;mapElapsed+=dt;
  if(lastFocusCheck>.18){detectArt(lastFocusCheck);updateExhibitLighting();lastFocusCheck=0;}
  if(mapElapsed>.065){drawMap();mapElapsed=0;}
  // Keep the preparation overlay responsive without repeatedly drawing the
  // hidden tower while its loaders, shaders and textures are being prepared.
  if(!welcome.hidden&&enter.disabled)return;
  renderer.render(scene,camera);
  if(GALLERY_DEBUG)window.__phiGraffitiStats={tower:towerGraffiti.diagnostics,interior:interiorGraffiti.diagnostics,square:phiSquare.diagnostics()};
  if(GALLERY_DEBUG)window.__phiRenderStats={calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures};
}
if(renderer)renderer.setAnimationLoop(tick);
// Ensure canvas-rendered entrance and lift signs use the actual marker font.
// The font is local; do not hold startup indefinitely if it cannot load.
Promise.race([
  document.fonts.load('42px "AlgoArt Marker"'),
  new Promise(resolve=>setTimeout(resolve,1600))
]).catch(error=>console.warn('Marker font fallback:',error)).finally(load);




