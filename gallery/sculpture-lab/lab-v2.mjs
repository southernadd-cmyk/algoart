// PROPORTION PIECE — Sculpture Lab V4: local-source inflation compared with V3.
// Production tower, archive bakes, and daily publishing do not import this.
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {resolveStudyMaterial} from '../visit/study-material.mjs';
import {recordOriginalComposition} from './source-bridge.mjs';
import {prepareOriginalStrokes} from './recorded-gestures.mjs';
import {traceVisiblePigmentContours} from './visible-pigment-contours.mjs?v=3-finish-1';
import {createHybridSupport,disposeHybridSupport} from './hybrid-supports.mjs';
import {buildSourceFeatures} from './sculpture-v2-features.mjs';
import {V3_METHODS,buildAnamorphicSculpture,measureFrontSilhouette,disposeAnamorphicSculpture} from './sculpture-v3-anamorphic.mjs?v=3-finish-1';
import {segmentPainting,V4_METHODS} from './sculpture-v4-topology.mjs';
import {buildV4Sculpture,disposeV4Sculpture} from './sculpture-v4-surface.mjs';

const $=id=>document.getElementById(id);
const canvas=$('view'),scene=new THREE.Scene();
scene.background=new THREE.Color('#bcb6a9');
scene.fog=new THREE.Fog('#bcb6a9',19,42);
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.55));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.16;
const camera=new THREE.PerspectiveCamera(49,1,.08,55);
camera.position.set(0,2.24,12.8);
const orbit=new OrbitControls(camera,canvas);
orbit.enableDamping=true;orbit.minDistance=1.8;orbit.maxDistance=25;
orbit.maxPolarAngle=Math.PI*.70;orbit.target.set(0,1.60,0);
orbit.autoRotateSpeed=.55;
function resize(){renderer.setSize(innerWidth,innerHeight,false);
  camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}
addEventListener('resize',resize);resize();
scene.add(new THREE.HemisphereLight('#fff7e9','#72706a',1.65));
for(const [c,p,intensity] of [['#ffeed6',[-5,7,5],2.2],['#c4d7e3',[4,5,-5],1.25]]){
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
const titles={armature:'SOURCE ARMATURE',fold:'FOLDED SURFACE',
  mass:'PIGMENT VOLUME',hybrid:'HYBRID / ANAMORPHIC',
  poisson:'POISSON INFLATION',medial:'MEDIAL AXIS',gesture:'GESTURAL VOLUME',
  assembly:'REGIONAL ASSEMBLY'};
const methods=()=> $('engineMode').value==='v3'?V3_METHODS:V4_METHODS;
const isV4=()=> $('engineMode').value!=='v3';
const labels=[];
function labelMethods(){
  for(let i=0;i<4;i++){
    const map=tagTexture(titles[methods()[i]]);
    labels[i].material.map.dispose();
    labels[i].material.map=map;labels[i].material.needsUpdate=true;
    const name=$('focus').options[i+1];
    if(name)name.textContent=String(i+1).padStart(2,'0')+' · '+
      titles[methods()[i]].toLowerCase();
    const legend=$('legend').children[i];
    if(legend)legend.textContent=String(i+1).padStart(2,'0')+' · '+titles[methods()[i]];
  }
}
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
    new THREE.MeshBasicMaterial({map:tagTexture(titles[V3_METHODS[i]])}));
  label.position.set(x,.43,.774);scene.add(label);labels.push(label);
  const stage=new THREE.Group();stage.position.set(x,1.60,0);scene.add(stage);stages.push(stage);
}
let archive=[],entries=[],currentDate='',selectedImage='';
let loaded=null,ticket=0,currentGraph=null,currentFeatures=null,currentTopology=null;
const status=s=>{$('status').textContent=s;};
function uiOptions(){
  return {
    phiPull:Number($('phi').value)/100,
    fidelity:Number($('fidelity').value)/100,
    depth:Number($('depth').value)/100,
    connection:Number($('connection').value)/100
  };
}
function updateOutputs(){
  for(const key of ['phi','fidelity','depth','connection'])
    $(key+'Value').textContent=$(key).value+'%';
}
function disposeDebug(g){
  if(!g)return;
  g.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
  g.removeFromParent();g.clear();
}
function sourceOverlay(features){
  const group=new THREE.Group();
  const geometry=new THREE.SphereGeometry(.018,7,6);
  const mat=new THREE.MeshBasicMaterial({color:'#e6d2a9',depthTest:false});
  for(const p of features.anchors){
    const dot=new THREE.Mesh(geometry,mat);
    dot.position.set(p.x,p.y,.81);group.add(dot);
  }
  group.userData.sourceAnchors=true;
  return group;
}
function clearCandidate(c,s,g){
  if(s)disposeHybridSupport(s);
  if(c){
    if(c.userData.engine==='region-inflation-v4')disposeV4Sculpture(c);
    else disposeAnamorphicSculpture(c);
  }
  if(g)disposeDebug(g);
}
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
function publishStatus(models,scores,features){
  const methodStats=models.map((m,i)=>{
    const box=new THREE.Box3().setFromObject(m),size=box.getSize(new THREE.Vector3());
    const attr=[];
    m.traverse(o=>{
      if(!o.isMesh||!o.geometry?.attributes?.position)return;
      const p=o.geometry.attributes.position;
      const stride=Math.max(1,Math.floor(p.count/200));
      for(let j=0;j<p.count;j+=stride)attr.push(p.getZ(j));
    });
    return {
      method:methods()[i],meshCount:m.userData.meshCount,
      noImagePlane:m.userData.noImagePlane,
      noSilhouetteExtrusion:m.userData.noSilhouetteExtrusion,
      preservedOriginalXY:m.userData.preservedOriginalXY,
      sourceStrokeCount:m.userData.sourceStrokeCount,
      sourceBody:m.userData.sourceBody,
      foldedSurfaceCount:m.userData.foldedSurfaceCount,
      rearRibCount:m.userData.rearRibCount,
      regionCount:m.userData.regionCount,
      medialRegions:m.userData.medialRegions,
      poissonRegions:m.userData.poissonRegions,
      polygonTriangles:m.userData.polygonTriangles,
      localIndependentSolids:m.userData.localIndependentSolids,
      sourceCoverage:m.userData.sourceCoverage,
      originalShapeCount:m.userData.originalShapeCount,
      extent:[size.x,size.y,size.z],
      sourceOverlap:scores[i],
      front:attr.filter(z=>z>.15).length,
      rear:attr.filter(z=>z<-.15).length,
      support:supports[i]?.userData.variant,
      supportAnchors:supports[i]?.userData.anchorCount
    };
  });
  window.__sculptureLabStatus={
    ready:true,version:isV4()?4:3,
    engine:isV4()?'region-inflation-v4':'source-anchored-v3',
    date:currentDate,imageFile:selectedImage,
    material:features.material,sourceKind:features.sourceKind,
    originalStrokes:loaded?.recordedStrokesCount||0,
    visiblePigmentContours:loaded?.tracedContourCount||0,
    sourcePigmentRegions:features.regions.length,
    reconstructedRegions:currentTopology?.regions?.length||0,
    reconstructedSourceCoverage:currentTopology?
      currentTopology.covered/Math.max(1,currentTopology.pigmented):0,
    methods:methodStats,options:uiOptions()
  };
  return methodStats;
}
function renderSculptures(){
  if(!currentFeatures||!loaded)return;
  const opts=uiOptions(),candidates=[],pins=[],overlays=[],scores=[];
  try{
    for(let i=0;i<4;i++){
      const options={
        features:currentFeatures,topology:currentTopology,
        strokes:loaded.strokes||[],
        pixels:loaded.pixels,texture:loaded.texture,
        paper:loaded.paper,material:loaded.material,
        ...opts,colourMode:$('colourMode').value,
        quality:innerWidth<700?'mobile':'desktop'
      };
      const model=isV4()?
        buildV4Sculpture(V4_METHODS[i],options):
        buildAnamorphicSculpture(V3_METHODS[i],options);
      candidates.push(model);
      // Independent FRONT silhouette readback. Rear geometry is counted as
      // a mismatch if it spills across original negative space.
      let overlap=null;
      try{
        overlap=measureFrontSilhouette(renderer,model,loaded.pixels,{
          material:loaded.material,paper:loaded.paper
        });
      }catch(e){console.warn('Front-view score unavailable:',e.message);}
      scores.push(overlap);
      const bounds=new THREE.Box3().setFromObject(model);
      model.position.y=-.34-bounds.min.y;
      model.updateMatrixWorld(true);
      pins.push(createHybridSupport(model,'pin',{pixels:loaded.pixels}));
      const overlay=sourceOverlay(currentFeatures);
      overlay.position.y=model.position.y;
      overlay.visible=$('showGraph').checked;
      overlays.push(overlay);
    }
    for(let i=0;i<4;i++){
      clearCandidate(active[i],supports[i],debug[i]);
      active[i]=candidates[i];supports[i]=pins[i];debug[i]=overlays[i];
      stages[i].add(candidates[i],pins[i],overlays[i]);
    }
    showSelection();
    const methodStats=publishStatus(candidates,scores,currentFeatures);
    const pct=methodStats.map(m=>m.sourceOverlap?
      Math.round(m.sourceOverlap.iou*100)+'%':'n/a').join(' / ');
    $('frontScore').textContent='Measured front silhouette overlap (IoU): '+pct+
      ' · '+methods().map((x,i)=>String(i+1)+': '+titles[x]).join(' / ');
    status((isV4()?'V4 region inflation · '+
      (currentTopology?.regions?.length||0)+' independent pigment regions':
      'V3 source-anchored')+' · '+(loaded.recordedStrokesCount||0)+
      ' recorded paths / '+(loaded.tracedContourCount||0)+
      ' traced pigment contours · front overlap '+pct);
  }catch(error){
    candidates.forEach((c,i)=>clearCandidate(c,pins[i],overlays[i]));
    status((isV4()?'V4':'V3')+' construction failed: '+error.message);
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
  status('Reading archived source painting…');
  try{
    const url=new URL('../'+encodeURIComponent(currentDate)+'/'+encodeURIComponent(file),location.href).href;
    const image=await loadImage(url);if(me!==ticket)return;
    const pixels=imagePixels(image);
    const mat=resolveStudyMaterial(entry.shareUrl,entry.material||'marker');
    const texture=new THREE.Texture(image);
    texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;
    const previous=loaded;
    const paper=mat.params.paper||'#f5f0e6';
    const traced=traceVisiblePigmentContours(pixels,{
      material:mat.type,paper,maxPaths:70
    });
    currentTopology=segmentPainting(pixels,{
      material:mat.type,paper,maxRegions:32
    });
    loaded={pixels,texture,material:mat.type,paper,
      strokes:traced,recordedStrokesCount:0,tracedContourCount:traced.length};
    currentFeatures=buildSourceFeatures(pixels,{
      material:mat.type,paper,strokes:traced,maxGestures:90,maxRegions:32
    });
    $('thumb').src=url;$('caption').textContent=entry.title||entry.seed;
    $('source').href=entry.shareUrl;
    $('sourceEvidence').textContent=currentTopology.regions.length+
      ' independent pigment regions (Poisson / medial reconstruction) · checking engine paths…';
    renderSculptures();
    if(previous?.texture)previous.texture.dispose();
    const link=new URL(location.href);
    link.searchParams.set('date',currentDate);link.searchParams.set('image',file);
    history.replaceState(null,'',link);
    try{
      const capture=await recordOriginalComposition(entry);
      if(me!==ticket)return;
      const strokes=prepareOriginalStrokes(capture,{
        material:mat.type,imageData:{...pixels,sourceWidth:capture.width,
          sourceHeight:capture.height},maxPaths:165,
        minimumCoverage:mat.type==='marker'?0:.22
      });
      if(strokes.length>=2){
        loaded.strokes=strokes;
        loaded.recordedStrokesCount=strokes.length;
        currentFeatures=buildSourceFeatures(pixels,{
          material:mat.type,paper:loaded.paper,strokes,
          maxRegions:32,maxGestures:90
        });
        renderSculptures();
        $('sourceEvidence').textContent=strokes.length+
          ' actual renderer marks + original pigment · front XY preserved';
      }else{
        $('sourceEvidence').textContent=traced.length+
          ' actual visible-pigment contours (original engine paths not available)';
      }
    }catch(e){
      if(me!==ticket)return;
      $('sourceEvidence').textContent=traced.length+
        ' actual visible-pigment contours · recorder unavailable: '+e.message;
      console.warn(e);
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
for(const key of ['phi','fidelity','depth','connection']){
  $(key).addEventListener('input',updateOutputs);
  $(key).addEventListener('change',renderSculptures);
}
$('colourMode').addEventListener('change',renderSculptures);
$('engineMode').addEventListener('change',()=>{
  labelMethods();renderSculptures();
  const url=new URL(location.href);
  if(isV4())url.searchParams.delete('engine');
  else url.searchParams.set('engine','v3');
  history.replaceState(null,'',url);
});
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
$('engineMode').value=new URLSearchParams(location.search).get('engine')==='v3'?'v3':'v4';
labelMethods();
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
}catch(error){status('Cannot initialise Sculpture Lab: '+error.message);console.error(error);}
