// PROPORTION PIECE — deterministic rules-only Sculpture Lab.
// Original painting pixels -> connected mark features -> solid sculptures.
// Pure JavaScript; no neural model, inference endpoint, key or API call.
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {resolveStudyMaterial} from '../visit/study-material.mjs';
import {METHODS,PHI,GOLDEN_ANGLE,extractRuleMarks,buildRuleSculpture,disposeRuleSculpture} from './sculpture-rules.mjs';
import {buildJSCADSculpture,disposeJSCADSculpture} from './sculpture-csg.mjs';
import {recordOriginalComposition} from './source-bridge.mjs';
import {prepareOriginalStrokes} from './recorded-gestures.mjs';
import {MATERIAL_SURFACE_VERSION,pigmentField,buildMaterialSculpture,disposeMaterialSculpture} from './material-surface.mjs';
import {SUPPORT_VARIANTS,createHybridSupport,disposeHybridSupport} from './hybrid-supports.mjs';

const $=id=>document.getElementById(id);
const scene=new THREE.Scene();
scene.background=new THREE.Color('#c6bdaf');
scene.fog=new THREE.Fog('#c6bdaf',18,42);
const canvas=$('view');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.3;
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.65));
const camera=new THREE.PerspectiveCamera(50,1,.08,60);
const controls=new OrbitControls(camera,canvas);
controls.target.set(0,1.57,0);
controls.enableDamping=true;controls.minDistance=1.6;controls.maxDistance=24;
controls.maxPolarAngle=Math.PI*.63;
controls.autoRotateSpeed=.70;
camera.position.set(0,2.2,13.3);
function resize(){
  renderer.setSize(innerWidth,innerHeight,false);
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize',resize);resize();
scene.add(new THREE.HemisphereLight('#fff8e9','#6f695c',2.4));
for(const [pos,intensity,color] of [
  [[-5,7,4],3.0,'#fff0db'],[[4,6,-6],2.0,'#c6d5e0']
]){
  const light=new THREE.DirectionalLight(color,intensity);
  light.position.set(...pos);scene.add(light);
}
function block(w,h,d,x,y,z,color,metalness=0) {
  const obj=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),
    new THREE.MeshStandardMaterial({color,roughness:.77,metalness}));
  obj.position.set(x,y,z);scene.add(obj);
  return obj;
}
block(18,.24,15,0,-.12,0,'#735d47',.16);
const rearWall=block(18,6,.2,0,3,-7,'#d9ccba');
block(.2,6,15,-8.7,3,0,'#d3c4b1');
const rightWall=block(.2,6,15,8.7,3,0,'#d3c4b1');
const centres=[-5.1,-1.7,1.7,5.1];
const titles=SUPPORT_VARIANTS.map(s=>'HYBRID · '+s.title.toUpperCase());
function labelTexture(title){
  const el=document.createElement('canvas');
  el.width=512;el.height=128;
  const c=el.getContext('2d');
  c.fillStyle='#26302b';c.fillRect(0,0,512,128);
  c.strokeStyle='#ac8e5a';c.strokeRect(4,4,504,120);
  c.fillStyle='#f6dfad';c.font='bold 27px Arial';c.textAlign='center';c.fillText(title,256,58);
  c.fillStyle='#c0b5a0';c.font='19px Arial';c.fillText('φ : 1.618     ·     137.5°',256,93);
  const t=new THREE.CanvasTexture(el);t.colorSpace=THREE.SRGBColorSpace;return t;
}
const stages=[],active=[],supports=[];
let pendingRender=0;
let currentEngine='';
const jscad=window.jscadModeling;
for(let i=0;i<4;i++){
  const x=centres[i];
  block(1.64,.75,1.48,x,.375,0,'#d1c7b6');
  block(1.69,.045,1.54,x,.76,0,'#36423a',.35);
  const tag=new THREE.Mesh(new THREE.PlaneGeometry(1.43,.35),
    new THREE.MeshBasicMaterial({map:labelTexture(titles[i])}));
  tag.position.set(x,.4,.755);scene.add(tag);
  const stage=new THREE.Group();
  stage.position.set(x,1.60,0);
  stage.name=titles[i];
  scene.add(stage);stages.push(stage);
}
let currentDate='',chosenImage='',archive=null,entries=[];
let dateTicket=0,imageTicket=0,currentSourceData=null;
let archivedMaterialPack=null,packDay='';
let currentArtworkTexture=null,currentSideTexture=null;
async function materialContoursFor(day,imageFile,quality='desktop'){
  if(packDay!==day){
    packDay=day;archivedMaterialPack=null;
    try {
      const response=await fetch('../'+day+'/3d/sculptures.json.gz');
      if(!response.ok)throw Error('No material contour pack');
      const bytes=new Uint8Array(await response.arrayBuffer());
      const stream=new Blob([bytes]).stream();
      const decoded=bytes[0]===0x1f&&bytes[1]===0x8b?
        stream.pipeThrough(new DecompressionStream('gzip')):stream;
      archivedMaterialPack=await new Response(decoded).json();
    }catch(error){
      console.info('Archived pigment contour pack unavailable; source recording remains available',error.message);
    }
  }
  return archivedMaterialPack?.studies?.[imageFile]?.[quality]||
    archivedMaterialPack?.studies?.[imageFile]?.desktop||[];
}
const status=message=>{$('info').textContent=message;};
async function loadImage(url){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>resolve(img);
    img.onerror=()=>reject(new Error('Archived source image could not be loaded'));
    img.src=url;
  });
}
function localPigmentTexture(pixels,material,paper){
  // Propagate the actual source pigment into the edge of each mark. Sampling
  // the JPEG directly on a curved boundary samples PAPER, producing white
  // ribbons from the side. The front still gets the untouched archive JPEG.
  const field=pigmentField(pixels,{material,paper});
  const {width:w,height:h,data}=pixels,n=w*h;
  const nearest=new Int32Array(n).fill(-1);
  const queue=new Int32Array(n);
  let head=0,tail=0;
  for(let i=0;i<n;i++)if(field.ink[i]>.30){
    nearest[i]=i;queue[tail++]=i;
  }
  if(!tail)for(let i=0;i<n;i++)if(field.ink[i]>.07){
    nearest[i]=i;queue[tail++]=i;
  }
  while(head<tail){
    const i=queue[head++],x=i%w,y=(i/w)|0;
    const neighbours=[];
    if(x>0)neighbours.push(i-1);
    if(x+1<w)neighbours.push(i+1);
    if(y>0)neighbours.push(i-w);
    if(y+1<h)neighbours.push(i+w);
    for(const j of neighbours)if(nearest[j]<0){
      nearest[j]=nearest[i];queue[tail++]=j;
    }
  }
  const canvas=document.createElement('canvas');
  canvas.width=w;canvas.height=h;
  const cx=canvas.getContext('2d',{willReadFrequently:true});
  const finished=cx.createImageData(w,h);
  for(let i=0;i<n;i++){
    const dest=i*4;
    const source=Math.max(0,nearest[i])*4;
    const original=field.ink[i]>.48;
    for(let c=0;c<3;c++)
      finished.data[dest+c]=original?data[dest+c]:data[source+c];
    finished.data[dest+3]=255;
  }
  cx.putImageData(finished,0,0);
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=THREE.ClampToEdgeWrapping;
  texture.wrapT=THREE.ClampToEdgeWrapping;
  texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
  texture.needsUpdate=true;
  return texture;
}
function featuresFromImage(image,entry) {
  const width=108,height=152;
  const off=document.createElement('canvas');off.width=width;off.height=height;
  const cx=off.getContext('2d',{willReadFrequently:true});
  cx.drawImage(image,0,0,width,height);
  const pixels=cx.getImageData(0,0,width,height);
  const mat=resolveStudyMaterial(entry.shareUrl,entry.material||'marker');
  const marks=extractRuleMarks(pixels,{
    material:mat.type,
    paper:mat.params.paper||'#f5f0e6'
  });
  return {marks,pixels,material:mat.type,paper:mat.params.paper||'#f5f0e6'};

}
function focus(side='front'){
  const i=$('focus').value;
  const x=i==='all'?0:centres[Number(i)];
  const dist=i==='all'?13.0:3.5;
  const y=i==='all'?1.57:1.62;
  controls.autoRotate=false;
  $('orbitToggle').textContent='Auto rotate';
  $('orbitToggle').setAttribute('aria-pressed','false');
  controls.target.set(x,y,0);
  const positions={
    front:[x,y,dist],
    // Full room: three-quarter view keeps all four mountings visible.
    side:i==='all'?[7.4,y+.70,11.2]:[x+dist,y,0],
    back:[x,y,-dist]
  };
  camera.position.set(...(positions[side]||positions.front));
  controls.update();
}
function renderMode(){
  return $('geometryMode').value;
}
function disposeAny(group){
  if(!group)return;
  if(group.userData.engine===MATERIAL_SURFACE_VERSION)disposeMaterialSculpture(group);
  else if(group.userData.engine==='jscad-csg-v1')disposeJSCADSculpture(group);
  else disposeRuleSculpture(group);
}
function replaceSculptures(marks,entry){
  const mode=renderMode();
  if(mode==='jscad'&&!jscad)throw new Error(
    'JSCAD did not load. The rule-only version remains available from the Geometry selector.'
  );
  const depth=Number($('depth').value)/100;
  const candidates=[],newSupports=[];
  try{
    for(const variant of SUPPORT_VARIANTS){
      const method='hybrid';
      const obj=mode==='surface'
        ?buildMaterialSculpture(method,currentSourceData.pixels,
          currentSourceData.paintTexture,{
          depth,material:currentSourceData.material,paper:currentSourceData.paper,
          quality:currentSourceData.quality,sideTexture:currentSourceData.sideTexture
        })
        :mode==='jscad'
        ?buildJSCADSculpture(method,marks,jscad,{
          depth,fidelity:Number($('resemblance').value)/100,
          sourceData:$('sourceMode').value==='original'?currentSourceData:null
        })
        :buildRuleSculpture(method,marks,{depth});
      // Every plinth holds the EXACT SAME painted hybrid; translate it only
      // as a whole to create a visually inspectable support gap.
      const bounds=new THREE.Box3().setFromObject(obj);
      obj.position.y=-.34-bounds.min.y;
      obj.updateMatrixWorld(true);
      candidates.push(obj);
      newSupports.push(createHybridSupport(obj,variant.id,{
        pixels:currentSourceData?.pixels||null
      }));
    }
  }catch(e){
    newSupports.forEach(disposeHybridSupport);
    candidates.forEach(disposeAny);
    throw e;
  }
  for(let i=0;i<4;i++){
    if(supports[i])disposeHybridSupport(supports[i]);
    if(active[i])disposeAny(active[i]);
    active[i]=candidates[i];
    supports[i]=newSupports[i];
    stages[i].add(candidates[i],newSupports[i]);
  }
  currentEngine=mode==='surface'?MATERIAL_SURFACE_VERSION:
    mode==='jscad'?'jscad-csg-v1':'rules-v1';
  window.__sculptureLabStatus={
    ready:true,
    engine:currentEngine,
    usesModel:false,
    usesExtrusion:false,
    usesJSCAD:mode==='jscad',
    usesActualPaintTexture:mode==='surface',
    identicalHybridOnAllPlinths:true,
    supportVariants:SUPPORT_VARIANTS.map(v=>v.id),
    supports:newSupports.map(s=>({variant:s.userData.variant,
      anchors:s.userData.anchorPoints,feet:s.userData.plinthPoints,
      plinthTopY:s.userData.plinthTopY,
      anchorCount:s.userData.anchorCount,
      supportMeshes:s.userData.supportMeshes,
      attachedToActualMesh:s.userData.attachedToActualMesh})),
    separatePaintingOverlay:false,
    paintingFinish:currentSourceData?.material||null,
    date:currentDate,
    imageFile:chosenImage,
    seed:entry.seed,
    sourceMarks:marks.map(m=>({x:m.x,y:m.y,kind:m.kind})),
    depth,
    resemblance:Number($('resemblance').value)/100,
    sourceMode:$('sourceMode').value,
    sourceEvidence:{
      kind:currentSourceData?.captureKind||'not-recorded',
      originalPaths:currentSourceData?.pathCount||0,
      visiblePaths:currentSourceData?.strokes?.length||0,
      archivedMaterialContours:currentSourceData?.materialContours?.length||0,
      material:currentSourceData?.material||null,
      error:currentSourceData?.captureError||null
    },
    methods:candidates.map((c,i)=>{
      const box=new THREE.Box3().setFromObject(c);
      const size=box.getSize(new THREE.Vector3());
      let meshes=0,polys=0;
      c.traverse(o=>{
        if(o.isMesh){
          meshes++;
          polys+=(o.geometry?.index?.count||o.geometry?.attributes?.position?.count||0)/3;
        }
      });
      return {
        method:c.userData.method,meshes,polys,
        supportVariant:SUPPORT_VARIANTS[i].id,
        elementCounts:c.userData.elementCounts||null,
        sourceAnchors:c.userData.sourceAnchors,
        extent:[size.x,size.y,size.z],
        sourceTraceCount:c.userData.sourceTraceCount||0,
        sourceOrigin:c.userData.sourceOrigin||null,
        originalPointCount:c.userData.sourceOriginalPoints||0,
        fineLinePaths:c.userData.fineLinePaths||0,
        materialContours:c.userData.materialContours||0,
        sourceDetailAnchors:c.userData.sourceDetailAnchors||[],
        csgPolygons:c.userData.csgPolygons||0,
        sourceTextureOnBody:c.userData.sourceTextureOnBody===true,
        sideTextureOnBody:c.userData.sideTextureOnBody===true,
        separatePaintingOverlay:c.userData.separatePaintingOverlay===true,
        paintedCells:c.userData.paintedCells||0,
        frontIndices:c.userData.frontIndices||0,
        backIndices:c.userData.backIndices||0,
        wallIndices:c.userData.wallIndices||0,
        materialRoughness:c.userData.materialRoughness||null,
        materialBumpScale:c.userData.materialBumpScale||null,
        subtractApplied:c.userData.subtractApplied||false,
        inputVolume:c.userData.inputVolume||0,
        outputVolume:c.userData.outputVolume||0
      };
    })
  };
}
let currentMarks=null;
function rebuild(){
  if(!currentMarks)return;
  const entry=entries.find(e=>e.imageFile===chosenImage);
  if(!entry)return;
  try{
    status('Constructing '+(renderMode()==='surface'?'source-painted 360° volumes':renderMode()==='jscad'?'fused JSCAD solids':'individual rule solids')+'…');
    replaceSculptures(currentMarks,entry);
    status((renderMode()==='surface'?'Four painted hybrid sculptures / four mounting studies':renderMode()==='jscad'?'Four JSCAD hybrid mounts':'Four rule-built hybrid mounts')+
      ' • '+currentMarks.length+' marks • '+(window.__sculptureLabStatus.methods[0].sourceTraceCount||0)+' sculpted source traces');
  }catch(error){
    status('Cannot build '+renderMode()+' sculpture: '+error.message);
    console.error(error);
  }
}
async function choosePainting(filename){
  chosenImage=filename;
  const ticket=++imageTicket;
  const d=dateTicket;
  const entry=entries.find(e=>e.imageFile===filename);
  if(!entry)return;
  status('Reading pigment marks from '+entry.seed+'…');
  try {
    const url=new URL('../'+encodeURIComponent(currentDate)+'/'+encodeURIComponent(filename),location.href).href;
    const image=await loadImage(url);
    if(ticket!==imageTicket||d!==dateTicket)return;
    const {marks,pixels,material,paper}=featuresFromImage(image,entry);
    const quality=innerWidth<740?'mobile':'desktop';
    let capture=null,captureError=null,materialContours=[];
    // The original generator records compositional strokes. For oil and
    // watercolour these are validated against final visible pigment, while
    // the archival contour bake supplies the material-specific shapes.
    try {
      [capture,materialContours]=await Promise.all([
        recordOriginalComposition(entry),
        material==='marker'?Promise.resolve([]):
          materialContoursFor(currentDate,filename,quality)
      ]);
    } catch(error) {
      captureError=error.message;
      console.warn('Original recording unavailable; retaining deterministic raster fallback',error);
      if(material!=='marker')
        materialContours=await materialContoursFor(currentDate,filename,quality);
    }
    if(ticket!==imageTicket||d!==dateTicket)return;
    let strokes=[];
    if(capture){
      try{
        strokes=prepareOriginalStrokes(capture,{
          material,imageData:{...pixels,
            sourceWidth:capture.width,sourceHeight:capture.height},
          maxPaths:quality==='mobile'?130:230,
          minimumCoverage:material==='marker'?0:.27
        });
      }catch(error){captureError=error.message;console.warn(error);}
    }
    const paintTexture=new THREE.Texture(image);
    paintTexture.colorSpace=THREE.SRGBColorSpace;
    paintTexture.wrapS=THREE.ClampToEdgeWrapping;
    paintTexture.wrapT=THREE.ClampToEdgeWrapping;
    paintTexture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
    paintTexture.needsUpdate=true;
    const sideTexture=localPigmentTexture(pixels,material,paper);
    const previousSource=currentSourceData;
    currentSourceData={
      strokes,materialContours,material,paper,pixels,paintTexture,sideTexture,quality,
      captureKind:capture?'recorded-original-v'+capture.version:'unavailable',
      pathCount:capture?.paths?.length||0,
      captureError
    };
    try {replaceSculptures(marks,entry);}
    catch(error) {
      currentSourceData=previousSource;
      paintTexture.dispose();sideTexture.dispose();
      throw error;
    }
    currentArtworkTexture?.dispose();
    currentSideTexture?.dispose();
    currentArtworkTexture=paintTexture;
    currentSideTexture=sideTexture;
    currentMarks=marks;
    $('thumb').src=url;
    $('caption').textContent=entry.title||entry.seed;
    $('source').href=entry.shareUrl;
    const q=new URL(location.href);
    q.searchParams.set('date',currentDate);q.searchParams.set('image',filename);
    history.replaceState(null,'',q);
    status((renderMode()==='surface'?'Four identical painted hybrids with four physical mounts':renderMode()==='jscad'?'JSCAD hybrid supports':'Rule hybrid supports')+
      ' • '+marks.length+' pigment regions · '+(window.__sculptureLabStatus.methods[0].sourceTraceCount||0)+
      ' sculpted strokes · '+window.__sculptureLabStatus.methods[0].sourceOrigin);
  } catch(e) {
    window.__sculptureLabStatus={ready:false,error:e.message};
    status('Could not construct sculpture: '+e.message);
    console.error(e);
  }
}
async function chooseDate(day){
  currentDate=day;
  const ticket=++dateTicket;
  ++imageTicket;currentMarks=null;currentSourceData=null;
  status('Loading gallery portraits from '+day+'…');
  try{
    const response=await fetch('../'+day+'/meta.json');
    if(!response.ok)throw Error('Missing archive metadata for '+day);
    const meta=await response.json();
    if(ticket!==dateTicket)return;
    entries=meta.entries.filter(e=>e.orientation==='portrait'&&e.material!=='confluence');
    if(!entries.length)throw Error('No solo portraits for this date');
    $('painting').replaceChildren();
    for(const e of entries)$('painting').add(new Option(e.title||e.seed,e.imageFile));
    if(!entries.some(e=>e.imageFile===chosenImage))chosenImage=entries[0].imageFile;
    $('painting').value=chosenImage;
    await choosePainting(chosenImage);
  }catch(e){if(ticket===dateTicket){status(e.message);console.error(e);}}
}
$('day').addEventListener('change',()=>{chosenImage='';chooseDate($('day').value);});
$('painting').addEventListener('change',()=>choosePainting($('painting').value));
$('focus').addEventListener('change',()=>focus());
for(const side of ['front','side','back'])$(side).addEventListener('click',()=>focus(side));
$('orbitToggle').addEventListener('click',()=>{
  controls.autoRotate=!controls.autoRotate;
  $('orbitToggle').textContent=controls.autoRotate?'Stop rotation':'Auto rotate';
  $('orbitToggle').setAttribute('aria-pressed',String(controls.autoRotate));
});
$('depth').addEventListener('input',()=>{$('depthValue').textContent=$('depth').value+'%';});
$('depth').addEventListener('change',rebuild);
$('geometryMode').addEventListener('change',()=>{
  $('resemblance').disabled=renderMode()==='surface';
  $('sourceMode').disabled=renderMode()==='surface';
  rebuild();
});
$('sourceMode').addEventListener('change',rebuild);
$('settingsToggle').addEventListener('click',()=>{
  const open=$('depth-controls').classList.toggle('expanded');
  $('settingsToggle').setAttribute('aria-expanded',String(open));
  $('settingsToggle').textContent=open?'Hide sculpture settings':'Sculpture settings';
});
$('resemblance').addEventListener('input',()=>{
  $('resemblanceValue').textContent=$('resemblance').value+'%';
});
$('resemblance').addEventListener('change',rebuild);
const keys=new Set();
addEventListener('keydown',e=>{if(e.target?.matches('select,button,input,textarea'))return;keys.add(e.key.toLowerCase());});
addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
addEventListener('blur',()=>keys.clear());
let last=performance.now();
function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min(.05,(now-last)/1000);last=now;
  const step=(keys.has('shift')?4.5:2.7)*dt;
  const move=new THREE.Vector3((keys.has('d')?1:0)-(keys.has('a')?1:0),0,
    (keys.has('s')?1:0)-(keys.has('w')?1:0)).multiplyScalar(step);
  if(move.lengthSq()){
    const dir=Math.atan2(camera.position.x-controls.target.x,camera.position.z-controls.target.z);
    move.applyAxisAngle(new THREE.Vector3(0,1,0),dir);
    controls.target.add(move);camera.position.add(move);
  }
  if(keys.has('q')||keys.has('e')){
    const stepAngle=(keys.has('q')?1:-1)*dt;
    camera.position.sub(controls.target).applyAxisAngle(new THREE.Vector3(0,1,0),stepAngle).add(controls.target);
  }
  // Outside viewpoints must not look into the OPAQUE backs of the room.
  // Restore the walls automatically as soon as the camera moves inside.
  rightWall.visible=camera.position.x<8.55;
  rearWall.visible=camera.position.z>-6.84;
  controls.update();renderer.render(scene,camera);
}
requestAnimationFrame(frame);
$('resemblance').disabled=renderMode()==='surface';
$('sourceMode').disabled=renderMode()==='surface';
try{
  const response=await fetch('../archive.json');
  if(!response.ok)throw Error('Gallery archive index missing');
  archive=await response.json();
  const dates=archive.days.map(d=>d.date).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d));
  for(const d of dates)$('day').add(new Option(d,d));
  const q=new URLSearchParams(location.search);
  const date=dates.includes(q.get('date'))?q.get('date'):dates[0];
  chosenImage=q.get('image')||'';
  $('day').value=date;
  await chooseDate(date);
  if(innerWidth<740&&window.__sculptureLabStatus?.ready){
    $('focus').value='0';focus('front');
  }
}catch(e){status('Cannot open rules-only sculpture lab: '+e.message);console.error(e);}
