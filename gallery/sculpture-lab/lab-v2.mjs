// PROPORTION PIECE — Sculpture Lab v2. Full replacement of v1 LAB UI only.
// Production tower, archive bakes, and daily publishing do not import this.
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {resolveStudyMaterial} from '../visit/study-material.mjs';
import {recordOriginalComposition} from './source-bridge.mjs';
import {prepareOriginalStrokes} from './recorded-gestures.mjs';
import {createHybridSupport,disposeHybridSupport} from './hybrid-supports.mjs';
import {buildSourceFeatures} from './sculpture-v2-features.mjs';
import {buildSpatialGraph} from './sculpture-v2-graph.mjs';
import {ENGINE_TYPES,buildSculptureEngine,disposeSculptureV2} from './sculpture-v2-engines.mjs';

const $=id=>document.getElementById(id);
const canvas=$('view'),scene=new THREE.Scene();
scene.background=new THREE.Color('#bcb6a9');
scene.fog=new THREE.Fog('#bcb6a9',19,42);
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.55));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.33;
const camera=new THREE.PerspectiveCamera(49,1,.08,55);
camera.position.set(0,2.24,12.8);
const orbit=new OrbitControls(camera,canvas);
orbit.enableDamping=true;orbit.minDistance=1.8;orbit.maxDistance=25;
orbit.maxPolarAngle=Math.PI*.70;orbit.target.set(0,1.60,0);
orbit.autoRotateSpeed=.55;
function resize(){renderer.setSize(innerWidth,innerHeight,false);
  camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}
addEventListener('resize',resize);resize();
scene.add(new THREE.HemisphereLight('#fff7e9','#72706a',2.5));
for(const [c,p,intensity] of [['#ffeed6',[-5,7,5],3],['#c4d7e3',[4,5,-5],2]]){
  const light=new THREE.DirectionalLight(c,intensity);light.position.set(...p);scene.add(light);
}
function block(w,h,d,x,y,z,col,metalness=0){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),
    new THREE.MeshStandardMaterial({color:col,roughness:.79,metalness}));
  mesh.position.set(x,y,z);scene.add(mesh);return mesh;
}
block(18,.24,15,0,-.12,0,'#715944',.17);
const backWall=block(18,6,.20,0,3,-7,'#d4c9b7');
block(.2,6,15,-8.7,3,0,'#c9bfad');
const sideWall=block(.2,6,15,8.7,3,0,'#c9bfad');
const centres=[-5.1,-1.7,1.7,5.1],stages=[],active=[],supports=[],debug=[];
const titles={strand:'STRAND / ORBITAL',ribbon:'FOLDED / RIBBON',
  mass:'MASS / STRATA',hybrid:'HYBRID / CONFLUENCE'};
function tagTexture(text){
  const c=document.createElement('canvas');c.width=512;c.height=128;
  const ctx=c.getContext('2d');ctx.fillStyle='#283129';ctx.fillRect(0,0,512,128);
  ctx.strokeStyle='#aa9067';ctx.strokeRect(5,5,502,118);
  ctx.fillStyle='#ead8b7';ctx.font='bold 26px Arial';ctx.textAlign='center';
  ctx.fillText(text,256,61);
  ctx.font='19px Arial';ctx.fillStyle='#b9a789';
  ctx.fillText('SCULPTURE · XYZ / φ',256,97);
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;return tex;
}
for(let i=0;i<4;i++){
  const x=centres[i];
  block(1.64,.75,1.48,x,.375,0,'#d1c8b9');
  block(1.69,.045,1.54,x,.76,0,'#38463d',.3);
  const label=new THREE.Mesh(new THREE.PlaneGeometry(1.44,.35),
    new THREE.MeshBasicMaterial({map:tagTexture(titles[ENGINE_TYPES[i]])}));
  label.position.set(x,.43,.774);scene.add(label);
  const stage=new THREE.Group();stage.position.set(x,1.60,0);scene.add(stage);stages.push(stage);
}
let archive=[],entries=[],currentDate='',selectedImage='';
let loaded=null,ticket=0,currentGraph=null,currentFeatures=null;
const status=s=>{$('status').textContent=s;};
function uiOptions(){
  return {phiPull:Number($('phi').value)/100,
    abstraction:Number($('abstraction').value)/100,
    depth:Number($('depth').value)/100,
    connection:Number($('connection').value)/100};
}
function updateOutputs(){
  for(const key of ['phi','abstraction','depth','connection'])
    $(key+'Value').textContent=$(key).value+'%';
}
function disposeDebug(g){
  if(!g)return;
  g.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
  g.removeFromParent();g.clear();
}
function graphOverlay(graph){
  const group=new THREE.Group(),sphere=new THREE.SphereGeometry(.021,8,6);
  const material=new THREE.MeshBasicMaterial({color:'#dceacc',depthTest:false});
  const lineMat=new THREE.LineBasicMaterial({color:'#bf9a61',transparent:true,opacity:.7});
  const byId=new Map(graph.nodes.map(n=>[n.id,n.position]));
  for(const n of graph.nodes){
    const m=new THREE.Mesh(sphere,material);m.position.set(n.position.x,n.position.y,n.position.z);
    group.add(m);
  }
  const coords=[];
  for(const l of graph.links){
    const a=byId.get(l.from),b=byId.get(l.to);
    if(a&&b)coords.push(a.x,a.y,a.z,b.x,b.y,b.z);
  }
  const lines=new THREE.BufferGeometry();
  lines.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));
  group.add(new THREE.LineSegments(lines,lineMat));
  return group;
}
function clearCandidate(c,s,g){if(s)disposeHybridSupport(s);
  if(c)disposeSculptureV2(c);if(g)disposeDebug(g);}
function showSelection(){
  const selected=$('focus').value;
  for(let i=0;i<4;i++)stages[i].visible=selected==='all'||selected===String(i);
}
function focus(view='threequarter'){
  const selected=$('focus').value;
  const all=selected==='all',x=all?0:centres[Number(selected)];
  const dist=all?12.6:3.3,y=all?1.58:1.62;
  orbit.autoRotate=false;$('autoRotate').setAttribute('aria-pressed','false');
  $('autoRotate').textContent='Auto orbit';
  orbit.target.set(x,y,0);
  const p={
    front:[x,y,dist],side:all?[7.7,y+.5,10.8]:[x+dist,y,0],
    back:[x,y,-dist],
    threequarter:all?[6.0,y+.95,11.4]:[x+dist*.72,y+.55,dist*.72]
  }[view];
  camera.position.set(...p);orbit.update();
}
function publishStatus(models,graph,features){
  window.__sculptureLabStatus={
    ready:true,version:2,engine:'spatial-v2',sourceKind:features.sourceKind,
    date:currentDate,imageFile:selectedImage,
    graphNodes:graph.nodes.length,graphLinks:graph.links.length,
    graphGestures:graph.gestures.length,
    methods:models.map((m,i)=>{
      const box=new THREE.Box3().setFromObject(m),size=box.getSize(new THREE.Vector3());
      const positions=[];
      m.traverse(obj=>{
        const attr=obj.geometry?.attributes?.position;
        if(!obj.isMesh||!attr)return;
        const stride=Math.max(1,Math.floor(attr.count/1200));
        obj.updateMatrixWorld(true);
        const p=new THREE.Vector3();
        for(let j=0;j<attr.count;j+=stride){
          p.fromBufferAttribute(attr,j).applyMatrix4(obj.matrixWorld);
          positions.push([p.x-centres[i],p.y-1.60,p.z]);
        }
      });
      let front=0,rear=0,spatial=0;
      for(const p of positions){
        if(p[2]>.16)front++;if(p[2]<-.16)rear++;
        if(Math.abs(p[2])>.35)spatial++;
      }
      return {
        method:ENGINE_TYPES[i],meshCount:m.userData.meshCount,
        noImagePlane:m.userData.noImagePlane,
        noSilhouetteExtrusion:m.userData.noSilhouetteExtrusion,
        extent:[size.x,size.y,size.z],
        sampledVertices:positions.length,front,rear,spatial,
        support:supports[i]?.userData.variant,
        supportAnchors:supports[i]?.userData.anchorCount
      };
    }),options:uiOptions(),material:features.material
  };
}
function renderSculptures(){
  if(!currentFeatures)return;
  const graph=buildSpatialGraph(currentFeatures,uiOptions());
  const candidates=[],pins=[],overlays=[];
  try{
    for(let i=0;i<4;i++){
      const model=buildSculptureEngine(ENGINE_TYPES[i],graph,currentFeatures,{
        colourMode:$('colourMode').value
      });
      const bounds=new THREE.Box3().setFromObject(model);
      model.position.y=-.34-bounds.min.y;
      model.updateMatrixWorld(true);
      candidates.push(model);
      const pin=createHybridSupport(model,'pin',{pixels:loaded?.pixels});
      pins.push(pin);
      const overlay=graphOverlay(graph);
      overlay.position.y=model.position.y;
      overlay.scale.copy(model.scale);
      overlay.visible=$('showGraph').checked;
      overlays.push(overlay);
    }
    for(let i=0;i<4;i++){
      clearCandidate(active[i],supports[i],debug[i]);
      active[i]=candidates[i];supports[i]=pins[i];debug[i]=overlays[i];
      stages[i].add(candidates[i],pins[i],overlays[i]);
    }
    currentGraph=graph;
    showSelection();publishStatus(candidates,graph,currentFeatures);
    status('Four genuine XYZ engines · '+graph.gestures.length+
      ' gestures · '+graph.nodes.length+' pigment masses · '+currentFeatures.sourceKind);
  }catch(error){
    candidates.forEach((c,i)=>clearCandidate(c,pins[i],overlays[i]));
    status('3D construction failed: '+error.message);
    window.__sculptureLabStatus={ready:false,error:error.message};
    console.error(error);
  }
}
function imagePixels(image){
  const c=document.createElement('canvas');c.width=108;c.height=152;
  const cx=c.getContext('2d',{willReadFrequently:true});
  cx.drawImage(image,0,0,c.width,c.height);
  return cx.getImageData(0,0,c.width,c.height);
}
function loadImage(url){
  return new Promise((resolve,reject)=>{
    const im=new Image();im.onload=()=>resolve(im);
    im.onerror=()=>reject(Error('Unable to read archived source image'));
    im.src=url;
  });
}
async function choosePainting(file){
  selectedImage=file;const me=++ticket,entry=entries.find(e=>e.imageFile===file);
  if(!entry)return;
  status('Reading archived painting…');
  try{
    const url=new URL('../'+encodeURIComponent(currentDate)+'/'+encodeURIComponent(file),location.href).href;
    const image=await loadImage(url);if(me!==ticket)return;
    const pixels=imagePixels(image);
    const mat=resolveStudyMaterial(entry.shareUrl,entry.material||'marker');
    loaded={pixels,material:mat.type,paper:mat.params.paper||'#f5f0e6'};
    currentFeatures=buildSourceFeatures(pixels,{material:mat.type,paper:loaded.paper});
    $('thumb').src=url;$('caption').textContent=entry.title||entry.seed;
    $('source').href=entry.shareUrl;
    $('sourceEvidence').textContent='Analysing original generator paths…';
    renderSculptures();
    const link=new URL(location.href);
    link.searchParams.set('date',currentDate);link.searchParams.set('image',file);
    history.replaceState(null,'',link);
    // Render an immediate useful pigment-derived sculpture. Upgrade the SAME
    // source graph when the original renderer recording becomes available.
    try{
      const capture=await recordOriginalComposition(entry);
      if(me!==ticket)return;
      const strokes=prepareOriginalStrokes(capture,{
        material:mat.type,imageData:{...pixels,sourceWidth:capture.width,
          sourceHeight:capture.height},maxPaths:65,
        minimumCoverage:mat.type==='marker'?0:.24
      });
      if(strokes.length>=3){
        currentFeatures=buildSourceFeatures(pixels,{
          material:mat.type,paper:loaded.paper,strokes
        });
        renderSculptures();
        $('sourceEvidence').textContent=strokes.length+
          ' original recorded gestures + source pigment';
      }else{
        $('sourceEvidence').textContent='Source pigment regions (no usable vector paths)';
      }
    }catch(e){
      if(me!==ticket)return;
      $('sourceEvidence').textContent='Pigment-based fallback · '+e.message;
    }
  }catch(error){
    if(me!==ticket)return;
    window.__sculptureLabStatus={ready:false,error:error.message};
    status(error.message);console.error(error);
  }
}
async function chooseDate(day){
  currentDate=day;++ticket;const expected=ticket;
  status('Loading portrait archive '+day+'…');
  try{
    const response=await fetch('../'+day+'/meta.json');
    if(!response.ok)throw Error('Missing archive metadata');
    const meta=await response.json();
    if(expected!==ticket)return;
    entries=meta.entries.filter(e=>e.orientation==='portrait'&&
      e.material!=='confluence'&&e.shareUrl);
    if(!entries.length)throw Error('No archived solo portraits');
    $('painting').replaceChildren();
    for(const e of entries)$('painting').add(new Option(e.title||e.seed,e.imageFile));
    if(!entries.some(e=>e.imageFile===selectedImage))selectedImage=entries[0].imageFile;
    $('painting').value=selectedImage;
    await choosePainting(selectedImage);
  }catch(error){if(expected===ticket)status(error.message);}
}
$('day').addEventListener('change',()=>{selectedImage='';chooseDate($('day').value);});
$('painting').addEventListener('change',()=>choosePainting($('painting').value));
$('focus').addEventListener('change',()=>{showSelection();focus('threequarter');});
for(const key of ['phi','abstraction','depth','connection']){
  $(key).addEventListener('input',updateOutputs);
  $(key).addEventListener('change',renderSculptures);
}
$('colourMode').addEventListener('change',renderSculptures);
$('showGraph').addEventListener('change',()=>{
  for(const group of debug)if(group)group.visible=$('showGraph').checked;
});
$('settingsToggle').addEventListener('click',()=>{
  const open=$('controlsPanel').classList.toggle('expanded');
  $('settingsToggle').setAttribute('aria-expanded',String(open));
  $('settingsToggle').textContent=open?'Hide controls':'Sculpture controls';
});
for(const view of ['front','side','back','threequarter'])
  $(view).addEventListener('click',()=>focus(view));
$('autoRotate').addEventListener('click',()=>{
  orbit.autoRotate=!orbit.autoRotate;
  $('autoRotate').textContent=orbit.autoRotate?'Stop orbit':'Auto orbit';
  $('autoRotate').setAttribute('aria-pressed',String(orbit.autoRotate));
});
const keys=new Set();addEventListener('keydown',e=>{
  if(e.target?.matches('button,select,input,textarea'))return;keys.add(e.key.toLowerCase());
});
addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
addEventListener('blur',()=>keys.clear());
let last=performance.now();
function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min(.05,(now-last)/1000);last=now;
  const step=2.5*dt;
  const move=new THREE.Vector3((keys.has('d')?1:0)-(keys.has('a')?1:0),0,
    (keys.has('s')?1:0)-(keys.has('w')?1:0)).multiplyScalar(step);
  if(move.lengthSq()){
    const dir=Math.atan2(camera.position.x-orbit.target.x,camera.position.z-orbit.target.z);
    move.applyAxisAngle(new THREE.Vector3(0,1,0),dir);
    camera.position.add(move);orbit.target.add(move);
  }
  if(keys.has('q')||keys.has('e')){
    const angle=(keys.has('q')?1:-1)*dt;
    camera.position.sub(orbit.target).applyAxisAngle(new THREE.Vector3(0,1,0),angle)
      .add(orbit.target);
  }
  backWall.visible=camera.position.z>-6.8;
  sideWall.visible=camera.position.x<8.5;
  orbit.update();renderer.render(scene,camera);
}
requestAnimationFrame(frame);
updateOutputs();
try{
  const response=await fetch('../archive.json');
  if(!response.ok)throw Error('Gallery archive missing');
  const json=await response.json();
  archive=json.days.map(d=>d.date).filter(s=>/^\d{4}-\d{2}-\d{2}$/.test(s));
  for(const date of archive)$('day').add(new Option(date,date));
  const params=new URLSearchParams(location.search);
  const date=archive.includes(params.get('date'))?params.get('date'):archive[0];
  selectedImage=params.get('image')||'';
  $('day').value=date;
  await chooseDate(date);
  if(innerWidth<740&&window.__sculptureLabStatus?.ready){
    $('focus').value='0';showSelection();focus('threequarter');
  }else focus('threequarter');
}catch(error){status('Cannot initialise Sculpture Lab v2: '+error.message);console.error(error);}
