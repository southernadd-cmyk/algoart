import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { buildLayout, footprintAt, canStand, DOOR_WIDTH, ROOM_HEIGHT, PHI } from './layout-v2.mjs';
import { planGalleryHangs } from './hanging-v3.mjs';
import { planGallerySculptures,clearOfSculptures,validateSculpturePlacement } from './sculptures.mjs';
import { createPortraitSculpture, setSculptureArchitecturalMaterials } from './sculpture-render-traced.mjs?v=texture-pass-20261021';
import { createArchitecturalMaterials, tiledBoxUvs } from './architectural-materials.mjs';
import { resolveStudyMaterial } from './study-material.mjs';
import { createExteriorLandscape } from './environment-render.mjs';
import { planVisitors,renderVisitors } from './visitors.mjs';

const $ = (id) => document.getElementById(id);
const canvas = $('world');
const status = $('status');
const welcome = $('welcome');
const errorBox = $('error');
const enter = $('enter');
const pressed = new Set();
const touchPressed = new Set();
const ray = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const clock = new THREE.Clock();
const artPlanes = [];
const sculpturePlacements=[];
let focused = null;
let lastFocusCheck = 0;
let yaw = Math.PI, pitch = 0;
let exhibitDate = null;
let archiveDates=[];
let liftPosition=null;
let liftWasNear=false;
let liftTravelling=false;
let editionObjects=[];
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
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local-floor');
  const xrButton = VRButton.createButton(renderer);
  $('xr-controls').appendChild(xrButton);
  renderer.xr.addEventListener('sessionstart', () => { welcome.hidden = true; $('info').hidden = true; });
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
  mesh.receiveShadow=material===floor||material===timber||material===stone;
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
  };
  if(!room.doors.includes(side)) {
    segment(length,0);
    return;
  }
  const wing=(length-DOOR_WIDTH)/2;
  segment(wing,-(DOOR_WIDTH+wing)/2);
  segment(wing, (DOOR_WIDTH+wing)/2);
  const doorHeight=3.68;
  segment(DOOR_WIDTH,0,ROOM_HEIGHT-doorHeight,room.y+(ROOM_HEIGHT+doorHeight)/2);
  if(horizontal)block(DOOR_WIDTH+.09,.045,.43,room.x,room.y+doorHeight,fixed,join);
  else block(.43,.045,DOOR_WIDTH+.09,fixed,room.y+doorHeight,room.z,join);
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
  block(roofStrip,.21,room.depth+.45,room.x+(room.width+3.5)/4,ceiling+.1,room.z);
  // A continuous glazed skylight seals the centre opening between the roof slabs.
  // Light still reaches the drawings and the sky is visible from inside.
  block(3.5,.085,room.depth+.38,room.x,ceiling+.105,room.z,skylightGlass);
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
  const fill=new THREE.PointLight('#fff5ec',2.3,11,2);
  fill.position.set(room.x,ceiling-.82,room.z);
  scene.add(fill);

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
function loadArtworkTexture(url, material) {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.onload = () => {
    const maxSize = matchMedia('(pointer:coarse)').matches ? 800 : 1100;
    const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(image.naturalWidth * scale));
    c.height = Math.max(1, Math.round(image.naturalHeight * scale));
    c.getContext('2d').drawImage(image, 0, 0, c.width, c.height);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
    material.map = tex;
    material.color.set('#ffffff');
    material.needsUpdate = true;
  };
  image.onerror = () => { status.textContent = 'One artwork could not be loaded; other works remain available.'; };
  image.src = url;
}
// Stage 2: landscape images occupy walls. Portraits become freestanding
// layered engine-specific sculptures, with a clear walking route around them.
// Aim a real exhibition spotlight at its individual exhibit, not a generic wall.
const fittingMaterial=new THREE.MeshStandardMaterial({color:'#484743',metalness:.7,roughness:.32});
const fittingGeometry=new THREE.CylinderGeometry(.115,.16,.22,10);
function exhibitLight(room,position,target,{beam=.38,power=18}={}){
  const spot=new THREE.SpotLight('#fff6e8',power,8,beam,.76,1.7);
  spot.position.copy(position);
  spot.target.position.copy(target);
  scene.add(spot,spot.target);
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

  const artworkMaterial = new THREE.MeshStandardMaterial({color: '#e6e1d5',roughness:1,metalness:0,side: THREE.DoubleSide,emissive:'#ffffff',emissiveIntensity:.12});
  const artwork = new THREE.Mesh(new THREE.PlaneGeometry(width, height), artworkMaterial);
  artwork.position.copy(base).addScaledVector(normal, .038);
  artwork.rotation.y = rotation;
  artwork.userData.study = study;
  scene.add(artwork);
  artPlanes.push(artwork);
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
  // Cabin is built INTO the gallery, with visible interior surfaces and
  // a clear approach on a wall reserved by the hanging curator.
  const side=room.liftWall;
  const normal=new THREE.Vector3(side==='east'?-1:side==='west'?1:0,0,
    side==='north'?1:side==='south'?-1:0); // towards room centre
  const tangent=new THREE.Vector3(normal.z,0,-normal.x);
  const offset=(side==='north'||side==='south'?room.depth:room.width)/2-.3;
  const doorCentre=new THREE.Vector3(room.x,room.y,room.z).addScaledVector(normal,-offset);
  const depth=1.9, width=2.3, height=2.65;
  const origin=doorCentre.clone().addScaledVector(normal,depth*.5);
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
  part(width,.14,depth,0,.035,0,rubber);
  part(width,.14,depth,0,height,0,brushed);
  part(width,.15,.12,0,height+.08,-depth*.5,metal);
  part(width, height,.11,0,height*.5,-depth*.5,brushed);
  for(const u of [-1,1]){
    part(.11,height,depth,u*width*.5,height*.5,0,metal);
    part(.055,.07,depth,u*(width*.5-.1),1.04,0,metal);
  }
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
  const heading=new THREE.Mesh(new THREE.PlaneGeometry(1.8,.36),
    new THREE.MeshBasicMaterial({map:labelTexture('ARCHIVE LIFT','SELECT FLOOR'),side:THREE.DoubleSide}));
  heading.position.copy(local(0,2.91,depth*.5-.03));
  heading.rotation.y=Math.atan2(normal.x,normal.z);
  scene.add(heading);
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
  return liftPosition&&Math.hypot(rig.position.x-liftPosition.x,rig.position.z-liftPosition.z)<1.15;
}
function openLift(){
  if(!welcome.hidden||!liftPosition||liftTravelling)return;
  document.exitPointerLock?.();
  $('lift').hidden=false;
  renderLiftCalendar();
}
async function travelLift(date,index){
  if(liftTravelling)return;
  liftTravelling=true;
  $('lift').hidden=true;
  document.exitPointerLock?.();
  const overlay=$('liftAnimation');
  overlay.hidden=false;
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
    $('liftArrival').hidden=false;
    $('liftArrival').textContent='Doors opening · floor '+(index===0?'G':index);
    setLiftDoors(false);
    setTimeout(()=>$('liftArrival').hidden=true,1800);
  }catch(error){
    overlay.hidden=true;setLiftDoors(false);
    errorBox.textContent='Lift could not reach that floor: '+error.message;
    errorBox.hidden=false;
    $('lift').hidden=false;
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
function constructGallery(layout, studies) {
  const entry=layout.rooms[0];
  // Reserve a complete unoccupied wall for the lift before the curator hangs art.
  entry.liftWall=['north','east','south','west'].find(side=>!entry.doors.includes(side));
  if(!entry.liftWall)throw new Error('No uninterrupted lift wall in entry gallery');
  const hangs=planGalleryHangs(layout,studies);
  const sculptures=planGallerySculptures(layout,studies);
  validateSculpturePlacement(layout,sculptures);
  sculpturePlacements.push(...sculptures);
  const byId=new Map(studies.map(study=>[study.id,study]));
  const quality=matchMedia('(pointer:coarse)').matches?'mobile':'desktop';
  for(const room of layout.rooms){
    addRoom(room,room.index,layout.rooms.length);
    for(const hanging of hangs.filter(h=>h.roomIndex===room.index))
      hangArt(room,byId.get(hanging.studyId),hanging);
    for(const placement of sculptures.filter(p=>p.roomIndex===room.index)){
      const sculptureLamp=new THREE.Vector3(placement.x,room.y+ROOM_HEIGHT-.42,placement.z);
      exhibitLight(room,sculptureLamp,new THREE.Vector3(placement.x,room.y+1.22,placement.z),{beam:.47,power:12});
      createPortraitSculpture({
        scene,study:byId.get(placement.studyId),placement,quality,labelTexture,
        onArtworkMesh(mesh){ artPlanes.push(mesh); }
      });
    }
  }
  renderVisitors(THREE,scene,planVisitors(layout,hangs,sculptures,{lowPower:galleryFinish.lowPower}));
  if(hangs.length+sculptures.length!==studies.length)
    throw new Error('An archived study was omitted from the exhibition');
  for(const hall of layout.corridors)addBridge(hall);
  // The daily landscape follows this exhibition's date and artwork seed;
  // it never occupies rooms, walkways or the visitor collision footprint.
  createExteriorLandscape(THREE,scene,layout,studies,{lowPower:galleryFinish.lowPower});
  // Previous floors remain below the current exhibition as a stacked tower.
  if(currentFloor>0){
    const tower=new THREE.Group();
    const bodyMaterial=new THREE.MeshStandardMaterial({color:'#a9aea9',roughness:.88});
    const bandMaterial=new THREE.MeshStandardMaterial({color:'#4e5755',metalness:.45,roughness:.5});
    const height=currentFloor*FLOOR_SPACING;
    // Repeat lightweight supporting volumes below every gallery wing, not
    // only beneath the entrance room, so the upper gallery is not suspended.
    for(const room of layout.rooms){
      const shell=new THREE.Mesh(new THREE.BoxGeometry(room.width+.35,height,room.depth+.35),bodyMaterial);
      shell.position.set(room.x,height/2-.26,room.z);
      tower.add(shell);
    }
    const bands=new THREE.InstancedMesh(new THREE.BoxGeometry(1,.13,1),bandMaterial,currentFloor*layout.rooms.length);
    const transform=new THREE.Object3D();let n=0;
    for(const room of layout.rooms)for(let i=0;i<currentFloor;i++){
      transform.position.set(room.x,(i+1)*FLOOR_SPACING-.18,room.z);
      transform.scale.set(room.width+.48,1,room.depth+.48);
      transform.updateMatrix();bands.setMatrixAt(n++,transform.matrix);
    }
    bands.instanceMatrix.needsUpdate=true;tower.add(bands);
    scene.add(tower);
  }
  const first=layout.rooms[0];
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
      image: new URL(img.getAttribute('src'),url).href,
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
  // Snapshot persistent scene content so only this edition gets removed.
  for(const object of editionObjects){scene.remove(object);object.traverse?.(child=>child.geometry?.dispose());}
  editionObjects=[];artPlanes.length=0;sculpturePlacements.length=0;
  liftPosition=null;liftWasNear=false;liftDoors=[];
  const previous=new Set(scene.children);
  exhibitDate=date;studyList=studies;plan=nextPlan;currentFloor=nextFloor;
  camera.far=Math.max(210,elevation+240);camera.updateProjectionMatrix();
  constructGallery(plan,studyList);
  editionObjects=scene.children.filter(object=>!previous.has(object));
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
    const qp=new URLSearchParams(location.search).get('date');
    await loadEdition(qp&&archiveDates.includes(qp)?qp:archiveDates.at(-1));
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

function showInfo(study) {
  if (!study) return;
  if (document.pointerLockElement) document.exitPointerLock();
  $('infoImage').src=study.image;
  $('infoImage').alt=study.title;
  $('infoTitle').textContent=study.title;
  $('infoSeed').textContent=study.seed;
  $('openArt').href=study.href;
  $('info').hidden=false;
}
$('closeInfo').addEventListener('click',() => $('info').hidden=true);
$('inspectTouch').addEventListener('click',() => showInfo(focused?.userData.study));
const moveCodes = new Map([
  ['KeyW','forward'],['ArrowUp','forward'],['KeyS','back'],['ArrowDown','back'],
  ['KeyA','left'],['ArrowLeft','left'],['KeyD','right'],['ArrowRight','right']
]);
$('openLift').addEventListener('click',openLift);
$('closeLift').addEventListener('click',()=>{$('lift').hidden=true;});
$('liftMonth').addEventListener('change',renderLiftCalendar);
window.addEventListener('keydown',(e)=>{
  if (['INPUT','BUTTON','TEXTAREA'].includes(document.activeElement?.tagName)) return;
  if (moveCodes.has(e.code)) {e.preventDefault();pressed.add(moveCodes.get(e.code));}
  if (e.code==='KeyE' && !e.repeat) showInfo(focused?.userData.study);
  if (e.code==='Escape') {$('info').hidden=true;$('lift').hidden=true;}
});
window.addEventListener('keyup',(e)=>{if(moveCodes.has(e.code))pressed.delete(moveCodes.get(e.code));});
window.addEventListener('blur',()=>pressed.clear());
window.addEventListener('mousemove',(e)=>{
  if (document.pointerLockElement !== canvas || renderer.xr.isPresenting) return;
  yaw -= e.movementX*.0025;
  pitch=Math.max(-1.35,Math.min(1.35,pitch-e.movementY*.0023));
});
canvas.addEventListener('click',()=>{
  if (welcome.hidden && $('info').hidden && !renderer.xr.isPresenting && matchMedia('(pointer:fine)').matches && document.pointerLockElement!==canvas) canvas.requestPointerLock?.();
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
  if (matchMedia('(pointer:fine)').matches) canvas.requestPointerLock?.();
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
  if (!plan || !welcome.hidden || !$('info').hidden || !$('lift').hidden || liftTravelling) return;
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
      } else if(source.handedness==='right' && Math.abs(axes.at(-2))>.75) {
        yaw-=Math.sign(axes.at(-2))*dt*1.5;
      }
    }
  }
  const length=Math.hypot(ahead,side);
  if(length>0) {
    const speed = pressed.has('ShiftLeft') ? 5.4 : 3.2;
    ahead/=length;side/=length;
    const dx=(Math.cos(yaw)*side-Math.sin(yaw)*ahead)*dt*speed;
    const dz=(-Math.sin(yaw)*side-Math.cos(yaw)*ahead)*dt*speed;
    if (canStand(plan,rig.position.x+dx,rig.position.z) && clearOfSculptures(sculpturePlacements,rig.position.x+dx,rig.position.z)) rig.position.x+=dx;
    if (canStand(plan,rig.position.x,rig.position.z+dz) && clearOfSculptures(sculpturePlacements,rig.position.x,rig.position.z+dz)) rig.position.z+=dz;
  }
  const part=footprintAt(plan,rig.position.x,rig.position.z);
  if(part)rig.position.y=part.y;
  const atLift=Boolean(nearLift());
  if(atLift&&!liftWasNear&&$('lift').hidden)openLift();
  liftWasNear=atLift;
  rig.rotation.y=yaw;
  camera.rotation.x=renderer.xr.isPresenting?0:pitch;
}
window.addEventListener('keydown',e=>{if(e.code==='ShiftLeft')pressed.add('ShiftLeft');});
window.addEventListener('keyup',e=>{if(e.code==='ShiftLeft')pressed.delete('ShiftLeft');});

function detectArt() {
  if (!plan || !welcome.hidden || !$('lift').hidden || renderer.xr.isPresenting) return;
  ray.setFromCamera(pointer,camera);
  const hit=ray.intersectObjects(artPlanes,false).find(x=>x.distance<6.3);
  focused=hit?.object||null;
  const text=nearLift()?' · Archive lift':(focused ? ' · E to inspect this drawing' : '');
  const current=footprintAt(plan,rig.position.x,rig.position.z)?.room ?? -1;
  status.textContent='Floor '+(currentFloor===0?'G':currentFloor)+' · '+readableDate(exhibitDate)+' · '+studyList.length+' works · '+sculpturePlacements.length+' sculptures'+(current>=0?' · Gallery '+(current+1):' · Walkway')+text;
}
function tick() {
  if (!renderer) return;
  const dt=Math.min(clock.getDelta(),.055);
  animateLiftDoors(dt);
  if(!$('lift').hidden){renderer.render(scene,camera);return;}
  updateMovement(dt);
  lastFocusCheck+=dt;
  if(lastFocusCheck>.18){detectArt();drawMap();lastFocusCheck=0;}
  renderer.render(scene,camera);
}
if(renderer)renderer.setAnimationLoop(tick);
load();
