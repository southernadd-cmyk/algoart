// Sculpture Lab 360° browser harness — isolated from the daily publishing tower.
// The four plinths receive the SAME archived portrait source and traced polygons.
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {resolveStudyMaterial} from '../visit/study-material.mjs';
import {maskPaper} from '../visit/paper-isolation.mjs';
import {
  METHODS, GOLDEN_ANGLE, PHI, extractPigmentSamples, prepareSourceContours,
  buildSculpture, disposeSculpture, updatePaintingStrength
} from './sculpture-360.mjs';

const el = id => document.getElementById(id);
const report = message => { el('info').textContent = message; };
const renderer = new THREE.WebGLRenderer({
  canvas: el('view'), antialias: true, powerPreference: 'high-performance'
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.53;
renderer.setPixelRatio(Math.min(1.65, window.devicePixelRatio || 1));
const scene = new THREE.Scene();
scene.background = new THREE.Color('#c1b6a6');
scene.fog = new THREE.Fog('#c1b6a6', 20, 40);
const camera = new THREE.PerspectiveCamera(51, 1, .08, 70);
camera.position.set(0, 3.65, 14.3);
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.target.set(0, 1.65, 0);
orbit.enableDamping = true; orbit.dampingFactor = .09;
orbit.minDistance = 1.65; orbit.maxDistance = 25;
orbit.maxPolarAngle = Math.PI * .53;
orbit.autoRotate = false; orbit.autoRotateSpeed = .75;

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

scene.add(new THREE.HemisphereLight('#faf3e7', '#685944', 2.25));
for (const [point, intensity, colour] of [
  [[-4, 7, 5], 2.8, '#fff2d8'],
  [[6, 6, -4], 1.35, '#b8d0dc']
]) {
  const light = new THREE.DirectionalLight(colour, intensity);
  light.position.set(...point); scene.add(light);
}
function architecturalBlock(w, h, d, x, y, z, colour, metalness = 0) {
  const cube = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({color: colour, roughness: .81, metalness}));
  cube.position.set(x, y, z); scene.add(cube);
  return cube;
}
architecturalBlock(18, .3, 16, 0, -.16, 0, '#65513e', .15);
architecturalBlock(18, 6, .25, 0, 3, -7.2, '#d4c7b3');
architecturalBlock(.25, 6, 16, -8.8, 3, 0, '#d0c1ac');
architecturalBlock(.25, 6, 16, 8.8, 3, 0, '#d0c1ac');
const floorGrid = new THREE.GridHelper(18, 18, '#957b59', '#957b59');
floorGrid.position.y = .008;
if (floorGrid.material) { floorGrid.material.transparent = true; floorGrid.material.opacity = .24; }
scene.add(floorGrid);

const centres = [-5.1, -1.7, 1.7, 5.1];
const names = ['GOLDEN-ANGLE PETALS', 'PHI RIBBONS', 'PIGMENT FIELD', 'COMBINED / HYBRID'];
const stages = [];
const active = [];
let activePaintTexture = null;
function plaqueTexture(title) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 144;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#26312e'; ctx.fillRect(0, 0, 512, 144);
  ctx.strokeStyle = '#af9973'; ctx.lineWidth = 4; ctx.strokeRect(4, 4, 504, 136);
  ctx.font = 'bold 27px Arial'; ctx.fillStyle = '#efdbb8'; ctx.textAlign = 'center';
  ctx.fillText(title, 256, 74);
  ctx.font = '18px Arial'; ctx.fillStyle = '#c8bda7';
  ctx.fillText('φ · 1.618    /    137.5°', 256, 107);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
for (let i = 0; i < 4; i++) {
  const x = centres[i];
  architecturalBlock(1.66, .72, 1.45, x, .36, 0, '#d1c7b7');
  architecturalBlock(1.72, .04, 1.49, x, .74, 0, '#3a4541', .35);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.46, .41),
    new THREE.MeshBasicMaterial({map: plaqueTexture(names[i])}));
  sign.position.set(x, .41, .75); scene.add(sign);
  const spotlight = new THREE.SpotLight('#fff2d8', 14, 9, .64, .55, 1.5);
  spotlight.position.set(x, 5.9, 3.2);
  spotlight.target.position.set(x, 1.35, 0);
  scene.add(spotlight, spotlight.target);
  const stage = new THREE.Group();
  stage.position.set(x, .85 + 1.88 / 2, 0);
  stage.name = names[i];
  scene.add(stage); stages.push(stage);
}

let date = '', archivePack = null, portraits = [], selected = '';
let dateGeneration = 0, paintingGeneration = 0;
function paintingSurfaceTexture(image, material) {
  // Cap texture resolution for mobile, preserving exact original paint appearance.
  const longest = matchMedia('(max-width: 740px)').matches ? 560 : 900;
  const factor = Math.min(1, longest / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * factor));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * factor));
  const context = canvas.getContext('2d', {willReadFrequently: true});
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  // Cut out the paper from the painted OVERLAY, not the 3D surface geometry.
  maskPaper(pixels, material.type, material.params.paper || '#f5f0e6');
  context.putImageData(pixels, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping; // join the wrap at the back seam
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  texture.needsUpdate = true;
  return texture;
}
function configuredBlend() {
  return el('textureMode').value === 'painted' ?
    Number(el('textureStrength').value) / 100 : 0;
}
function setTextureControls() {
  const strength = configuredBlend();
  for (const group of active) updatePaintingStrength(group, strength);
  el('textureStrengthValue').textContent = el('textureStrength').value + '%';
  el('textureStrength').disabled = el('textureMode').value !== 'painted';
  if (window.__sculptureLabStatus?.ready)
    window.__sculptureLabStatus.texture = {
      mode: el('textureMode').value, blend: strength,
      paintedMeshes: active.map(g => g?.userData.texturedMeshes || 0)
    };
}
function dataFromImage(image, entry, contours) {
  const material = resolveStudyMaterial(entry.shareUrl, entry.material || 'marker');
  const canvas = document.createElement('canvas');
  canvas.width = 90; canvas.height = 126;
  const ctx = canvas.getContext('2d', {willReadFrequently: true});
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const samples = extractPigmentSamples(pixels, {
    seed: entry.seed,
    material: material.type,
    paper: material.params.paper || '#f5f0e6',
    limit: 230
  });
  return {samples, contours: prepareSourceContours(contours, 145), seed: entry.seed,
    paintTexture: paintingSurfaceTexture(image, material), paintStrength: configuredBlend()};
}
function imageFrom(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Archived painting image unavailable'));
    img.src = url;
  });
}
async function readPack(day) {
  const r = await fetch('../' + encodeURIComponent(day) + '/3d/sculptures.json.gz');
  if (!r.ok) throw new Error('Prepared sculpture contours unavailable for ' + day);
  if (!('DecompressionStream' in window)) throw new Error('This browser cannot unpack prepared sculptures');
  const pack = await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).json();
  if (pack.date !== day || !pack.studies) throw new Error('Invalid prepared sculpture archive');
  return pack;
}
async function chooseDay(day) {
  date = day;
  const serial = ++dateGeneration;
  ++paintingGeneration;
  report('Loading ' + day + ' paintings and prepared contours…');
  try {
    const [meta, pack] = await Promise.all([
      fetch('../' + day + '/meta.json').then(r => {
        if (!r.ok) throw new Error('Archive metadata missing');
        return r.json();
      }),
      readPack(day)
    ]);
    if (serial !== dateGeneration) return;
    archivePack = pack;
    // The Confluence portrait-to-sculpture route is intentionally disabled
    // until its separate three-artist raster treatment is rebuilt.
    portraits = meta.entries.filter(e => e.orientation === 'portrait' &&
      e.material !== 'confluence' && pack.studies[e.imageFile]?.desktop?.length);
    if (!portraits.length) throw new Error('No prepared solo portrait sculptures on this date');
    el('painting').replaceChildren();
    portraits.forEach(e => el('painting').add(new Option(e.title || e.seed, e.imageFile)));
    if (!portraits.some(e => e.imageFile === selected)) selected = portraits[0].imageFile;
    el('painting').value = selected;
    await choosePainting(selected);
  } catch (error) {
    if (serial === dateGeneration) report('Could not prepare room: ' + error.message);
    console.error(error);
  }
}
async function choosePainting(filename) {
  selected = filename;
  const serial = ++paintingGeneration;
  const daySerial = dateGeneration;
  const entry = portraits.find(e => e.imageFile === filename);
  if (!entry) return;
  const imageURL = new URL('../' + encodeURIComponent(date) + '/' +
    encodeURIComponent(entry.imageFile), location.href).href;
  report('Constructing all four 360° sculptures from ' + entry.seed + '…');
  try {
    const image = await imageFrom(imageURL);
    if (serial !== paintingGeneration || daySerial !== dateGeneration) return;
    const data = dataFromImage(image, entry, archivePack.studies[entry.imageFile].desktop);
    // Build off-scene; never leave half a sculpture visible on a method failure.
    let candidates = [];
    try {
      candidates = METHODS.map(method => buildSculpture(method, data));
    } catch (error) {
      candidates.forEach(disposeSculpture);
      data.paintTexture.dispose();
      throw error;
    }
    if (serial !== paintingGeneration || daySerial !== dateGeneration) {
      candidates.forEach(disposeSculpture);
      data.paintTexture.dispose();
      return;
    }
    const oldPaintTexture = activePaintTexture;
    for (let i = 0; i < 4; i++) {
      if (active[i]) { stages[i].remove(active[i]); disposeSculpture(active[i]); }
      active[i] = candidates[i];
      stages[i].add(candidates[i]);
    }
    activePaintTexture = data.paintTexture;
    oldPaintTexture?.dispose();
    el('thumb').src = imageURL;
    el('caption').textContent = entry.title || entry.seed;
    el('source').href = entry.shareUrl;
    const current = new URL(location.href);
    current.searchParams.set('date', date);
    current.searchParams.set('image', filename);
    history.replaceState(null, '', current);
    const summary = candidates.map((item, i) =>
      names[i].split(' ')[0] + ': ' + Object.entries(item.userData.elementCounts)
        .map(([name, count]) => count + ' ' + name).join(' + ')).join(' · ');
    report('360° study ready · ' + summary);
    window.__sculptureLabStatus = {
      ready: true, date, seed: entry.seed,
      texture: {mode: el('textureMode').value, blend: configuredBlend(),
        paintedMeshes: candidates.map(g => g.userData.texturedMeshes)},
      methods: candidates.map(c => ({
        method: c.userData.method, elements: c.userData.elementCounts,
        meshes: (() => { let n = 0; c.traverse(o => { if (o.isMesh) n++; }); return n; })()
      }))
    };
  } catch (error) {
    report('Sculpture generation failed: ' + error.message);
    window.__sculptureLabStatus = {ready: false, error: error.message};
    console.error(error);
  }
}
function focusSculpture() {
  const n = el('focus').value;
  return n === 'all' ? null : Number(n);
}
function cameraView(side = 'front') {
  const focus = focusSculpture();
  const x = focus === null ? 0 : centres[focus];
  const distance = focus === null ? 13.4 : 4.4;
  const target = new THREE.Vector3(x, focus === null ? 1.57 : 1.67, 0);
  const positions = {
    front: new THREE.Vector3(x, focus === null ? 3.45 : 2.3, distance),
    side: new THREE.Vector3(x + distance, 2.35, 0),
    back: new THREE.Vector3(x, 2.35, -distance)
  };
  const oldAutoRotate = orbit.autoRotate;
  orbit.autoRotate = false;
  orbit.target.copy(target);
  camera.position.copy(positions[side] || positions.front);
  orbit.update();
  orbit.autoRotate = oldAutoRotate;
}
el('day').addEventListener('change', () => { selected = ''; chooseDay(el('day').value); });
el('painting').addEventListener('change', () => choosePainting(el('painting').value));
el('textureMode').addEventListener('change', setTextureControls);
el('textureStrength').addEventListener('input', setTextureControls);
el('focus').addEventListener('change', () => cameraView('front'));
for (const direction of ['front', 'side', 'back'])
  el(direction).addEventListener('click', () => cameraView(direction));
el('orbitToggle').addEventListener('click', () => {
  orbit.autoRotate = !orbit.autoRotate;
  el('orbitToggle').textContent = orbit.autoRotate ? 'Stop rotation' : 'Auto rotate';
  el('orbitToggle').setAttribute('aria-pressed', String(orbit.autoRotate));
});
const keys = new Set();
addEventListener('keydown', e => {
  if (e.target?.matches('select,button,input,textarea')) return;
  keys.add(e.key.toLowerCase());
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());
const clock = new THREE.Clock(), up = new THREE.Vector3(0, 1, 0);
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, clock.getDelta()), step = dt * (keys.has('shift') ? 4.3 : 2.5);
  const move = new THREE.Vector3();
  if (keys.has('w')) move.z -= step;
  if (keys.has('s')) move.z += step;
  if (keys.has('a')) move.x -= step;
  if (keys.has('d')) move.x += step;
  if (move.lengthSq()) {
    move.applyAxisAngle(up, Math.atan2(camera.position.x - orbit.target.x,
      camera.position.z - orbit.target.z));
    const clamped = orbit.target.clone().add(move);
    clamped.x = THREE.MathUtils.clamp(clamped.x, -7, 7);
    clamped.z = THREE.MathUtils.clamp(clamped.z, -5.5, 5.5);
    const applied = clamped.sub(orbit.target);
    orbit.target.add(applied); camera.position.add(applied);
  }
  if (keys.has('q') || keys.has('e')) {
    const offset = camera.position.clone().sub(orbit.target)
      .applyAxisAngle(up, (keys.has('q') ? 1 : -1) * dt);
    camera.position.copy(orbit.target).add(offset);
  }
  orbit.update(); renderer.render(scene, camera);
}
frame();
setTextureControls();
try {
  const archive = await fetch('../archive.json').then(r => {
    if (!r.ok) throw new Error('Gallery day index unavailable');
    return r.json();
  });
  const days = archive.days.map(d => d.date).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d));
  if (!days.length) throw new Error('No archived gallery days');
  days.forEach(d => el('day').add(new Option(d, d)));
  const query = new URLSearchParams(location.search);
  selected = query.get('image') || '';
  date = days.includes(query.get('date')) ? query.get('date') : days[0];
  el('day').value = date;
  await chooseDay(date);
} catch (error) {
  report('Sculpture lab could not open: ' + error.message);
  console.error(error);
}
