import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { buildLayout, footprintAt, canStand, DOOR_WIDTH, ROOM_HEIGHT, PHI } from './layout.mjs';

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
scene.add(new THREE.HemisphereLight('#ffffff', '#8e9891', 2.7));
const sun = new THREE.DirectionalLight('#fff5df', 2.5);
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
  renderer.toneMappingExposure = 1.2;
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local-floor');
  const xrButton = VRButton.createButton(renderer);
  $('xr-controls').appendChild(xrButton);
  renderer.xr.addEventListener('sessionstart', () => { welcome.hidden = true; $('info').hidden = true; });
} catch (err) {
  errorBox.textContent = 'This device cannot initialise a WebGL gallery: ' + err.message;
  errorBox.hidden = false;
}

const wall = new THREE.MeshStandardMaterial({color: '#e5e3d9', roughness: .96});
const floor = new THREE.MeshStandardMaterial({color: '#bdb6a8', roughness: .96});
const join = new THREE.MeshStandardMaterial({color: '#756f61', metalness: .22, roughness: .77});
const dark = new THREE.MeshStandardMaterial({color: '#393b35', metalness: .16, roughness: .74});
const bridgeSurface = new THREE.MeshStandardMaterial({color: '#b8a994', side: THREE.DoubleSide, roughness: .9});
const frame = new THREE.MeshStandardMaterial({color: '#34322e', roughness: .85});

function block(w, h, d, x, y, z, material = wall) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
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

function addWallWithOpening(room, z) {
  const sideWidth = (room.width - DOOR_WIDTH) / 2;
  const y = room.y + ROOM_HEIGHT / 2;
  block(sideWidth, ROOM_HEIGHT, .34, room.x - DOOR_WIDTH / 2 - sideWidth / 2, y, z);
  block(sideWidth, ROOM_HEIGHT, .34, room.x + DOOR_WIDTH / 2 + sideWidth / 2, y, z);
  const doorHeight = 3.65;
  block(DOOR_WIDTH, ROOM_HEIGHT - doorHeight, .34, room.x, room.y + (ROOM_HEIGHT + doorHeight) / 2, z);
  block(DOOR_WIDTH + .12, .055, .45, room.x, room.y + doorHeight, z, join);
}

function addRoom(room, index, count) {
  const midZ = (room.z0 + room.z1) / 2;
  const ceiling = room.y + ROOM_HEIGHT;
  block(room.width + .65, .45, room.depth + .5, room.x, room.y - .28, midZ, floor);
  block(.36, ROOM_HEIGHT, room.depth + .4, room.x - room.width / 2, room.y + ROOM_HEIGHT / 2, midZ);
  block(.36, ROOM_HEIGHT, room.depth + .4, room.x + room.width / 2, room.y + ROOM_HEIGHT / 2, midZ);
  addWallWithOpening(room, room.z0);
  addWallWithOpening(room, room.z1);
  // Roof is deliberately open along the axis, so daylight follows the promenade.
  const roofWidth = (room.width - 5) / 2;
  block(roofWidth, .22, room.depth + .5, room.x - (room.width + 5) / 4, ceiling + .12, midZ);
  block(roofWidth, .22, room.depth + .5, room.x + (room.width + 5) / 4, ceiling + .12, midZ);
  for (const z of [room.z0, room.z1]) {
    block(room.width + .8, .36, .48, room.x, ceiling + .17, z, join);
  }
  for (const xSide of [-1, 1]) {
    const x = room.x + xSide * (room.width / 2 - .34);
    block(.055, .07, room.depth - 1.2, x, room.y + .22, midZ, join);
    block(.065, .07, room.depth - 1.2, x, ceiling - .45, midZ, join);
  }
  const light = new THREE.PointLight('#fff4db', 30, 21);
  light.position.set(room.x, ceiling - .8, midZ);
  scene.add(light);
  // A phi-spaced floor inlay gives the room a quiet geometric signature.
  const lineX = room.x + (room.width * (1 / PHI - .5)) * .6;
  block(.025, .022, room.depth - 1, lineX, room.y + .012, midZ, join);
  const levelTag = makeRoomLabel('Gallery ' + (index + 1) + ' / ' + count);
  levelTag.position.set(room.x, room.y + 4.18, room.z0 + .26);
  levelTag.rotation.y = Math.PI;
  scene.add(levelTag);
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

function addBridge(a, b) {
  const half = DOOR_WIDTH / 2;
  const v = new Float32Array([
    a.x - half, a.y, a.z1,
    a.x + half, a.y, a.z1,
    b.x - half, b.y, b.z0,
    b.x + half, b.y, b.z0
  ]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(v, 3));
  g.setIndex([0, 2, 1, 1, 2, 3]);
  g.computeVertexNormals();
  scene.add(new THREE.Mesh(g, bridgeSurface));

  for (const side of [-1, 1]) {
    const p0 = new THREE.Vector3(a.x + side * (half - .1), a.y + .9, a.z1);
    const p1 = new THREE.Vector3(b.x + side * (half - .1), b.y + .9, b.z0);
    const dir = new THREE.Vector3().subVectors(p1, p0);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(.042, .042, dir.length(), 7), join);
    mesh.position.copy(p0).add(p1).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir.normalize());
    scene.add(mesh);
    for (const p of [p0, p1]) {
      block(.085, .92, .085, p.x, p.y - .43, p.z, dark);
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
function hangArt(room, study, position, roomIndex) {
  const left = position % 2 === 0;
  const sign = left ? -1 : 1;
  const x = room.x + sign * (room.width / 2 - .24);
  const biases = {spiral:.035, organic:-.028, burst:.02, network:-.018, geometric:.012, scribble:-.013};
  const z = room.z0 + room.depth * (.19 + .31 * position + (biases[study.engine] || 0));
  const portrait = study.portrait;
  const width = portrait ? 1.77 : 2.82;
  const height = portrait ? 2.48 : 2.03;
  const y = room.y + 2.36;
  const rot = left ? Math.PI / 2 : -Math.PI / 2;
  const inner = -sign;
  const surround = new THREE.Mesh(new THREE.PlaneGeometry(width+.20,height+.20),frame);
  surround.position.set(x - inner * .012,y,z);
  surround.rotation.y = rot;
  scene.add(surround);
  const artworkMaterial = new THREE.MeshBasicMaterial({color:'#e6e1d5', side:THREE.DoubleSide});
  const artwork = new THREE.Mesh(new THREE.PlaneGeometry(width,height), artworkMaterial);
  artwork.position.set(x + inner * .02, y, z);
  artwork.rotation.y = rot;
  artwork.userData.study = study;
  scene.add(artwork);
  artPlanes.push(artwork);
  loadArtworkTexture(study.image, artworkMaterial);

  const caption = new THREE.Mesh(
    new THREE.PlaneGeometry(2.68,.63),
    new THREE.MeshBasicMaterial({map:labelTexture(study.title, study.seed), side: THREE.DoubleSide})
  );
  caption.position.set(x + inner * .026,room.y+.58,z);
  caption.rotation.y = rot;
  scene.add(caption);
}
function constructGallery(layout, studies) {
  for (const room of layout.rooms) {
    addRoom(room, room.index, layout.rooms.length);
    studies.slice(room.artStart,room.artEnd).forEach((study, i) => hangArt(room, study, i, room.index));
  }
  for (let i=0;i<layout.rooms.length-1;i++) addBridge(layout.rooms[i],layout.rooms[i+1]);
  const base = layout.rooms[0].y > 0 ? -.65 : -1.0;
  block(250,.45,230,0,base, (layout.rooms.at(-1).z1)/2, new THREE.MeshStandardMaterial({color:'#929d96',roughness:1}));
  const first = layout.rooms[0];
  rig.position.set(first.x,first.y,first.z0+2.6);
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
      engine: new URL(href).searchParams.get('mode') || 'field'
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
    status.textContent=readableDate(date)+' · '+studyList.length+' drawings';
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
    if (canStand(plan,rig.position.x+dx,rig.position.z)) rig.position.x+=dx;
    if (canStand(plan,rig.position.x,rig.position.z+dz)) rig.position.z+=dz;
  }
  const part=footprintAt(plan,rig.position.z);
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
  const current=plan.rooms.findIndex(room=>rig.position.z>=room.z0&&rig.position.z<=room.z1);
  status.textContent=readableDate(exhibitDate)+' · '+studyList.length+' drawings'+(current>=0?' · Gallery '+(current+1):' · Walkway')+text;
}
function tick() {
  if (!renderer) return;
  const dt=Math.min(clock.getDelta(),.055);
  updateMovement(dt);
  lastFocusCheck+=dt;
  if(lastFocusCheck>.18){detectArt();lastFocusCheck=0;}
  renderer.render(scene,camera);
}
if(renderer)renderer.setAnimationLoop(tick);
load();
