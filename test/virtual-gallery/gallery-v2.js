import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { buildLayout, footprintAt, canStand, DOOR_WIDTH, ROOM_HEIGHT, PHI } from './layout-v2.mjs';
import { planGalleryHangs } from './hanging-v3.mjs';
import { planGallerySculptures,clearOfSculptures,validateSculpturePlacement } from './sculptures.mjs';
import { createPortraitSculpture, setSculptureArchitecturalMaterials } from './sculpture-render-traced.mjs?v=texture-pass-20261021';
import { createArchitecturalMaterials, tiledBoxUvs } from './architectural-materials.mjs';
import { resolveStudyMaterial } from './study-material.mjs';

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
let plan = null;
let studyList = [];
let touchPointer = null;
let touchX = 0, touchY = 0;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#c2cbc5');
scene.fog = new THREE.Fog('#c2cbc5', 48, 165);
scene.add(new THREE.HemisphereLight('#ffffff', '#92998c', 1.95));
const sun = new THREE.DirectionalLight('#fff7ec', 2.2);
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
  renderer.toneMappingExposure = 1.12;
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
const join=galleryFinish.trims;
setSculptureArchitecturalMaterials({plinth:galleryFinish.plinth,metal:galleryFinish.trims});
const dark = new THREE.MeshStandardMaterial({color: '#393b35', metalness: .16, roughness: .74});
const bridgeSurface=galleryFinish.stoneBridge;
const frame = new THREE.MeshStandardMaterial({color: '#34322e', roughness: .85});

function block(w, h, d, x, y, z, material = wall) {
  const geometry=new THREE.BoxGeometry(w,h,d);
  if(material.userData?.tileMeters)
    tiledBoxUvs(geometry,w,h,d,material.userData.tileMeters);
  const mesh=new THREE.Mesh(geometry,material);
  mesh.position.set(x,y,z);
  mesh.receiveShadow=material===floor||material===timber;
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
  const surface=(count>=4&&index%5===2)?timber:floor;
  block(room.width+.42,.36,room.depth+.42,room.x,room.y-.22,room.z,surface);
  for(const side of ['north','south','east','west'])addWallWithOpening(room,side);
  const roofStrip=(room.width-3.5)/2;
  block(roofStrip,.21,room.depth+.45,room.x-(room.width+3.5)/4,ceiling+.1,room.z);
  block(roofStrip,.21,room.depth+.45,room.x+(room.width+3.5)/4,ceiling+.1,room.z);
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
  const light=new THREE.PointLight('#fff5e8',17,13);
  light.position.set(room.x,ceiling-.55,room.z);
  scene.add(light);
  // Signs hang above the entrance junction, not in the picture field.
  const sign=makeRoomLabel('Gallery '+(index+1));
  const door=room.doors.includes('south') ? 'south' : room.doors.includes('west')?'west':room.doors.includes('north')?'north':'east';
  const r={north:0,south:Math.PI,west:Math.PI/2,east:-Math.PI/2}[door];
  const inDir=new THREE.Vector3(Math.sin(r),0,Math.cos(r));
  sign.position.set(room.x,room.y+4.28,room.z);
  sign.position.addScaledVector(inDir,2.75);
  sign.rotation.y=r;
  scene.add(sign);
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

  const artworkMaterial = new THREE.MeshBasicMaterial({color: '#e6e1d5', side: THREE.DoubleSide});
  const artwork = new THREE.Mesh(new THREE.PlaneGeometry(width, height), artworkMaterial);
  artwork.position.copy(base).addScaledVector(normal, .038);
  artwork.rotation.y = rotation;
  artwork.userData.study = study;
  scene.add(artwork);
  artPlanes.push(artwork);
  loadArtworkTexture(study.image, artworkMaterial);

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
function constructGallery(layout, studies) {
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
      createPortraitSculpture({
        scene,study:byId.get(placement.studyId),placement,quality,labelTexture,
        onArtworkMesh(mesh){ artPlanes.push(mesh); }
      });
    }
  }
  if(hangs.length+sculptures.length!==studies.length)
    throw new Error('An archived study was omitted from the exhibition');
  for(const hall of layout.corridors)addBridge(hall);
  // Ground is an understated field underneath the branched architecture.
  block(250,.4,250,0,-1.15,0,new THREE.MeshStandardMaterial({color:'#9aa69f',roughness:1}));
  const first=layout.rooms[0];
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
async function load() {
  try {
    if (!renderer) return;
    const qp = new URLSearchParams(location.search).get('date');
    const date = qp && /^\d{4}-\d{2}-\d{2}$/.test(qp) ? qp : await latestDate();
    exhibitDate = date;
    $('edition').value=date;
    $('archiveLink').href='../../gallery/'+date+'/';
    $('welcomeArchive').href='../../gallery/'+date+'/';
    const url = new URL('../../gallery/'+date+'/', location.href);
    const res=await fetch(url,{cache:'no-store'});
    if (!res.ok) throw new Error('The edition for '+readableDate(date)+' is not available.');
    studyList=readArchive(await res.text(),res.url);
    if (!studyList.length) throw new Error('No artwork records found for this edition.');
    plan=buildLayout(date,studyList.length,studyList);
    constructGallery(plan,studyList);
    status.textContent=readableDate(date)+' · '+studyList.length+' works · '+sculpturePlacements.length+' sculptures';
    enter.disabled=false;
    enter.textContent='Enter the gallery';
    camera.updateProjectionMatrix();
  } catch (e) {
    enter.textContent='Gallery unavailable';
    errorBox.textContent = e.message;
    errorBox.hidden = false;
    status.textContent='Unable to build exhibition';
    console.error(e);
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
window.addEventListener('keydown',(e)=>{
  if (['INPUT','BUTTON','TEXTAREA'].includes(document.activeElement?.tagName)) return;
  if (moveCodes.has(e.code)) {e.preventDefault();pressed.add(moveCodes.get(e.code));}
  if (e.code==='KeyE' && !e.repeat) showInfo(focused?.userData.study);
  if (e.code==='Escape') $('info').hidden=true;
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
  if (!plan || !welcome.hidden || !$('info').hidden) return;
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
  rig.rotation.y=yaw;
  camera.rotation.x=renderer.xr.isPresenting?0:pitch;
}
window.addEventListener('keydown',e=>{if(e.code==='ShiftLeft')pressed.add('ShiftLeft');});
window.addEventListener('keyup',e=>{if(e.code==='ShiftLeft')pressed.delete('ShiftLeft');});

function detectArt() {
  if (!plan || !welcome.hidden || renderer.xr.isPresenting) return;
  ray.setFromCamera(pointer,camera);
  const hit=ray.intersectObjects(artPlanes,false).find(x=>x.distance<6.3);
  focused=hit?.object||null;
  const text=focused ? ' · E to inspect this drawing' : '';
  const current=footprintAt(plan,rig.position.x,rig.position.z)?.room ?? -1;
  status.textContent=readableDate(exhibitDate)+' · '+studyList.length+' works · '+sculpturePlacements.length+' sculptures'+(current>=0?' · Gallery '+(current+1):' · Walkway')+text;
}
function tick() {
  if (!renderer) return;
  const dt=Math.min(clock.getDelta(),.055);
  updateMovement(dt);
  lastFocusCheck+=dt;
  if(lastFocusCheck>.18){detectArt();drawMap();lastFocusCheck=0;}
  renderer.render(scene,camera);
}
if(renderer)renderer.setAnimationLoop(tick);
load();
