import * as THREE from 'three';
import {vectorForStudy} from './vector-bridge.mjs';
import {selectRecordedPaths,strokeSections,strokeOutline,portraitCoords} from './vector-geometry.mjs';
import {pigmentGrid,tracePigmentRegions} from './pigment-regions.mjs?v=paperless-20261021';
import {paperRGB,estimatePaper,pigmentOpacity,maskPaper} from './paper-isolation.mjs?v=paperless-20261021';
import {makeRandom,seedFromString} from './layout-v2.mjs';
import {
  SCULPTURE_WIDTH as W,SCULPTURE_HEIGHT as H,
  PEDESTAL_WIDTH,PEDESTAL_DEPTH,PEDESTAL_HEIGHT
} from './sculptures.mjs';

// The objects below are actual traced source strokes and paint boundaries.
// No golden-section shards, random polygons or full-image picture planes.
let baseMaterial=new THREE.MeshStandardMaterial({color:'#d5d0c4',roughness:.85});
let metalMaterial=new THREE.MeshStandardMaterial({color:'#454c45',metalness:.38,roughness:.48});
export function setSculptureArchitecturalMaterials({plinth,metal}={}){
  if(plinth)baseMaterial=plinth;
  if(metal)metalMaterial=metal;
}
const transientMaterial=new THREE.MeshStandardMaterial({color:'#555b52',metalness:.15,roughness:.79});
transientMaterial.userData.galleryPersistent=true;
const thicknessProfiles={
  marker:{ink:.065,pigment:.02,amplify:1.8,roughness:.75,painted:false,opacity:1},
  tissue:{ink:.018,pigment:.028,amplify:2.3,roughness:.94,painted:true,opacity:.84},
  watercolour:{ink:.012,pigment:.035,amplify:3,roughness:.97,painted:true,opacity:.87},
  oil:{ink:.16,pigment:.23,amplify:3.8,roughness:.42,painted:true,opacity:1},
  action:{ink:.15,pigment:.20,amplify:3.2,roughness:.51,painted:true,opacity:1}
};
async function getImage(img,quality){
  const cap=quality==='mobile'?480:quality==='vr'?600:850;
  const scale=Math.min(1,cap/Math.max(img.naturalWidth,img.naturalHeight));
  const width=Math.max(1,Math.round(img.naturalWidth*scale));
  const height=Math.max(1,Math.round(img.naturalHeight*scale));
  // The source image is already a pre-sized WebP when published. Any final
  // sculpture-resolution resize can happen off-thread, leaving only the
  // required pigment pixel readback on the main thread.
  let bitmap=null;
  if(scale<1 && typeof createImageBitmap==='function'){
    try{
      bitmap=await createImageBitmap(img,{
        resizeWidth:width,resizeHeight:height,resizeQuality:'high'
      });
    }catch{ /* Older browsers can use the standard canvas fallback. */ }
  }
  const canvas=document.createElement('canvas');
  canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  try{
    ctx.drawImage(bitmap||img,0,0,width,height);
    return {canvas,pixels:ctx.getImageData(0,0,width,height)};
  }finally{
    bitmap?.close?.();
  }
}
function colouredMaterial(stroke,type,cache){
  const color=String(stroke.stroke||'#313632');
  const opacity=Math.min(1,Math.max(.58,Number(stroke.opacity)||.8));
  const key=color+'|'+Math.round(opacity*5)+'|'+type;
  if(cache.has(key))return cache.get(key);
  const roughness=thicknessProfiles[type].roughness;
  let paint;
  try{paint=new THREE.Color(color);}catch{paint=new THREE.Color('#404541');}
  const mat=new THREE.MeshStandardMaterial({
    color:paint,roughness,metalness:type==='oil'?.07:0,
    transparent:type==='tissue'||type==='watercolour',opacity:
      (type==='tissue'||type==='watercolour')?opacity*.85:1,
    side:THREE.DoubleSide
  });
  cache.set(key,mat);
  return mat;
}
function paperLikeStroke(stroke,study){
  // Off-white recorded strokes must not turn paper grain into opaque beams.
  let color;
  try{color=new THREE.Color(stroke.stroke||'#343434').getHex();}
  catch{return false;}
  const rgb=[(color>>16)&255,(color>>8)&255,color&255];
  return pigmentOpacity(...rgb,
    paperRGB(study.material?.params?.paper||'#f5f0e6'),
    study.material?.type||'marker')<.16;
}
function makeShape(vertices){
  if(vertices.length<3)return null;
  const shape=new THREE.Shape();
  shape.moveTo(vertices[0].x,vertices[0].y);
  for(let i=1;i<vertices.length;i++)shape.lineTo(vertices[i].x,vertices[i].y);
  shape.closePath();
  return shape;
}
function solid(shape,depth,capMaterial,sideMaterial,z,source){
  const geo=new THREE.ExtrudeGeometry(shape,{
    depth,steps:1,bevelEnabled:depth>.06,
    bevelThickness:Math.min(.009,depth*.12),bevelSize:.004,
    bevelSegments:1,curveSegments:4
  });
  // Exact source-to-UV alignment: the cap maps to its matching position in
  // the archived portrait, not a repeated copy of the whole jpeg.
  const uv=geo.getAttribute('uv');
  const position=geo.getAttribute('position');
  for(let i=0;i<uv.count;i++){
    uv.setXY(i,position.getX(i)/W+.5,position.getY(i)/H+.5);
  }
  uv.needsUpdate=true;
  const mesh=new THREE.Mesh(geo,[capMaterial,sideMaterial]);
  mesh.position.z=z-depth/2;
  mesh.userData.study=source;
  return mesh;
}
function visibleSourceSegment(points,source,reference,imgPaper,type){
  if(!reference||type==='marker')return true;
  const {pixels}=reference;
  let marked=0,sampled=0;
  const steps=Math.min(12,points.length);
  for(let i=0;i<steps;i++){
    const p=points[Math.min(points.length-1,Math.floor(i*(points.length-1)/Math.max(1,steps-1)))];
    const x=Math.max(0,Math.min(pixels.width-1,Math.floor(p.x/source.width*pixels.width)));
    const y=Math.max(0,Math.min(pixels.height-1,Math.floor(p.y/source.height*pixels.height)));
    const k=(y*pixels.width+x)*4,d=pixels.data;
    sampled++;
    if(pigmentOpacity(d[k],d[k+1],d[k+2],imgPaper,type)>.24)marked++;
  }
  // Source paths belong in the finished sculpture only if the material
  // renderer actually made a visible mark at their original positions.
  return sampled>0 && marked/sampled>=.35;
}
function buildPathReliefs(source,study,quality,core,onArtworkMesh,materialCache,reference){
  const type=study.material?.type||'marker';
  const profile=thicknessProfiles[type];
  const options={
    marker:{desktop:150,mobile:65,vr:85},
    tissue:{desktop:58,mobile:27,vr:36},
    watercolour:{desktop:28,mobile:15,vr:19},
    oil:{desktop:34,mobile:16,vr:22},
    action:{desktop:36,mobile:17,vr:24}
  };
  const cap=options[type][quality]||65;
  const paths=selectRecordedPaths(source,quality).sort((a,b)=>b.score-a.score).slice(0,cap);
  const rng=makeRandom(seedFromString('PP-TRUE-LINE-DEPTH:'+study.seed+':'+type));
  let added=0;
  const totalBudget=quality==='mobile'?95:quality==='vr'?125:230;
  const paper=study.material?.params?.paper||'#f5f0e6';
  const imgPaper=reference?estimatePaper(reference.pixels,paper):null;
  for(const stroke of paths){
    if(added>=totalBudget)break;
    if(paperLikeStroke(stroke,study))continue;
    const material=colouredMaterial(stroke,type,materialCache);
    // Original recorded width is used as the physical reference. A minimum
    // relief thickness allows pencil lines to survive mobile perspective.
    const scaleReference=Math.min(W/source.width,H/source.height);
    const radius=Math.max(.008,Math.min(.075,stroke.width*scaleReference*profile.amplify));
    const height=profile.ink*(.73+rng()*.58);
    const z=(rng()-.5)*(type==='marker'?.16:.25);
    for(const section of strokeSections(stroke)){
      if(added>=totalBudget)break;
      if(!visibleSourceSegment(section,source,reference,imgPaper,type))continue;
      const coords=portraitCoords(section,source.width,source.height,W,H);
      const polygon=strokeOutline(coords,radius);
      if(polygon.length<4)continue;
      const shape=makeShape(polygon);
      if(!shape)continue;
      const object=solid(shape,height,material,material,z,study);
      core.add(object);
      onArtworkMesh?.(object);
      added++;
    }
  }
  return added;
}
function paintTexture(canvas,type,paper){
  // CanvasTexture RGBA alpha, NOT alphaMap (which would read green).
  const isolated=document.createElement('canvas');
  isolated.width=canvas.width;isolated.height=canvas.height;
  const context=isolated.getContext('2d',{willReadFrequently:true});
  context.drawImage(canvas,0,0,isolated.width,isolated.height);
  const pixels=context.getImageData(0,0,isolated.width,isolated.height);
  maskPaper(pixels,type,paper);
  context.putImageData(pixels,0,0);
  const texture=new THREE.CanvasTexture(isolated);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=2;
  return texture;
}
function buildMaterialReliefs(image,study,quality,core,onArtworkMesh){
  const type=study.material?.type||'marker';
  const {canvas,pixels}=image;
  // Marker strokes come directly from SVG; raster regions are only a fallback.
  const scale=quality==='mobile'?.24:quality==='vr'?.29:.38;
  const sw=Math.max(20,Math.round(canvas.width*scale));
  const sh=Math.max(24,Math.round(canvas.height*scale));
  const down=document.createElement('canvas');
  down.width=sw;down.height=sh;
  const ctx=down.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(canvas,0,0,sw,sh);
  const data=ctx.getImageData(0,0,sw,sh);
  const paper=study.material?.params?.paper||'#f5f0e6';
  const grid=pigmentGrid(data,type,paper);
  const regions=tracePigmentRegions(grid,type,quality);
  const profile=thicknessProfiles[type];
  const atlas=paintTexture(canvas,type,paper);
  const pigment=new THREE.MeshStandardMaterial({
    map:atlas,roughness:profile.roughness,metalness:type==='oil'?.035:0,
    transparent:true,opacity:profile.opacity,alphaTest:.14,
    depthWrite:type==='oil'||type==='action',side:THREE.DoubleSide
  });
  // Side faces take the colour of the *pigment component* itself, not paper.
  const sideCache=new Map();
  function sideFor(region){
    const x=Math.max(0,Math.min(pixels.width-1,Math.floor(region.centroid.x*pixels.width)));
    const y=Math.max(0,Math.min(pixels.height-1,Math.floor(region.centroid.y*pixels.height)));
    const k=(y*pixels.width+x)*4,d=pixels.data;
    const rgb=[d[k],d[k+1],d[k+2]];
    const key=rgb.map(v=>Math.round(v/20)).join(',');
    if(sideCache.has(key))return sideCache.get(key);
    const color=new THREE.Color().setRGB(rgb[0]/255,rgb[1]/255,rgb[2]/255,THREE.SRGBColorSpace);
    color.multiplyScalar(type==='oil'?.75:.82);
    const material=new THREE.MeshStandardMaterial({
      color,roughness:profile.roughness,metalness:0,
      transparent:type==='tissue'||type==='watercolour',
      opacity:type==='tissue'?.68:type==='watercolour'?.83:1
    });
    sideCache.set(key,material);return material;
  }
  const rng=makeRandom(seedFromString('PP-PAINT-RELIEF:'+study.seed+':'+type));
  let created=0;
  for(const region of regions){
    const points=region.points.map(p=>({x:(p.x-.5)*W,y:(.5-p.y)*H}));
    if(points.length<3)continue;
    const shape=makeShape(points);
    const areaScale=Math.min(1,region.coverage*24);
    const depth=profile.pigment*(.65+.55*areaScale+.3*rng());
    const z=.02+(rng()-.5)*profile.pigment*1.3;
    const object=solid(shape,depth,pigment,sideFor(region),z,study);
    core.add(object);
    onArtworkMesh?.(object);
    created++;
  }
  return created;
}
// Publishing-time sculpture packs contain the ACTUAL traced polygons, depths
// and source colours from this renderer. No browser SVG regeneration, connected
// component search, or silhouette tracing is needed when a pack is present.
async function renderPreparedReliefs({entries,core,study,onArtworkMesh,onFirstMesh}){
  if(!Array.isArray(entries)||!entries.length)return false;
  const type=study.material?.type||'marker';
  const profile=thicknessProfiles[type];
  const needPaint=entries.some(entry=>entry.kind==='paint');
  let paint=null,sideCache=new Map(),inkCache=new Map();
  if(needPaint){
    const source=study.imageOptimized||study.image;
    const image=await new Promise((resolve,reject)=>{
      const img=new Image();img.crossOrigin='anonymous';img.decoding='async';
      img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Prepared pigment texture unavailable'));
      img.src=source;
    });
    // A cancelled lift may have disposed this off-screen sculpture while
    // its pigment image was still downloading. Do not build into that pivot.
    if(core.parent?.userData.galleryDisposed)return false;
    const canvas=document.createElement('canvas');
    canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
    canvas.getContext('2d',{willReadFrequently:true}).drawImage(image,0,0);
    const paper=study.material?.params?.paper||'#f5f0e6';
    const atlas=paintTexture(canvas,type,paper);
    paint=new THREE.MeshStandardMaterial({
      map:atlas,roughness:profile.roughness,metalness:type==='oil'?.035:0,
      transparent:true,opacity:profile.opacity,alphaTest:.14,
      depthWrite:type==='oil'||type==='action',side:THREE.DoubleSide
    });
  }
  if(core.parent?.userData.galleryDisposed)return false;
  let created=0;
  for(const entry of entries){
    if(!Array.isArray(entry.points)||entry.points.length<3 ||
       entry.points.length>500 || !Number.isFinite(entry.depth)||!Number.isFinite(entry.z))continue;
    const shape=makeShape(entry.points.map(p=>({x:p[0],y:p[1]})));
    if(!shape)continue;
    let cap,side;
    if(entry.kind==='paint'){
      if(!paint)continue;
      cap=paint;
      if(!sideCache.has(entry.side)){
        sideCache.set(entry.side,new THREE.MeshStandardMaterial({
          color:entry.side,roughness:profile.roughness,metalness:0,
          transparent:type==='tissue'||type==='watercolour',
          opacity:type==='tissue'?.68:type==='watercolour'?.83:1
        }));
      }
      side=sideCache.get(entry.side);
    }else{
      const key=entry.color+'|'+entry.opacity;
      if(!inkCache.has(key))inkCache.set(key,new THREE.MeshStandardMaterial({
        color:entry.color,roughness:profile.roughness,
        metalness:type==='oil'?.07:0,
        transparent:type==='tissue'||type==='watercolour',
        opacity:entry.opacity,side:THREE.DoubleSide
      }));
      cap=side=inkCache.get(key);
    }
    const obj=solid(shape,entry.depth,cap,side,entry.z,study);
    core.add(obj);onArtworkMesh?.(obj);created++;
    if(created===1)onFirstMesh?.();
    // Even precomputed polygon extrusion needs work; amortise it over frames.
    if(created%8===0)await new Promise(requestAnimationFrame);
    if(core.parent?.userData.galleryDisposed)return true;
  }
  return created>0;
}
export function createPortraitSculpture({scene,study,placement,quality,labelTexture,onArtworkMesh,onComplete}){
  const pivot=new THREE.Group();
  pivot.name='Traced material sculpture: '+study.seed;
  pivot.position.set(placement.x,placement.y,placement.z);
  pivot.rotation.y=placement.yaw;
  scene.add(pivot);
  const pedestal=new THREE.Mesh(new THREE.BoxGeometry(
    PEDESTAL_WIDTH,PEDESTAL_HEIGHT,PEDESTAL_DEPTH),baseMaterial);
  pedestal.position.y=PEDESTAL_HEIGHT/2;
  pedestal.castShadow=true;
  pivot.add(pedestal);
  // A lightweight contact shadow anchors the plinth without expensive
  // per-fragment WebGL shadow passes (important with hundreds of real strokes).
  const shadowCanvas=document.createElement('canvas');
  shadowCanvas.width=96;shadowCanvas.height=96;
  const shadeContext=shadowCanvas.getContext('2d');
  const shade=shadeContext.createRadialGradient(48,48,10,48,48,47);
  shade.addColorStop(0,'rgba(30,29,26,.30)');
  shade.addColorStop(.6,'rgba(30,29,26,.17)');
  shade.addColorStop(1,'rgba(30,29,26,0)');
  shadeContext.fillStyle=shade;shadeContext.fillRect(0,0,96,96);
  const shadowTex=new THREE.CanvasTexture(shadowCanvas);
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(2.35,2.05),
    new THREE.MeshBasicMaterial({map:shadowTex,transparent:true,depthWrite:false}));
  shadow.rotation.x=-Math.PI/2;
  shadow.position.y=.018;
  pivot.add(shadow);
  const lip=new THREE.Mesh(new THREE.BoxGeometry(
    PEDESTAL_WIDTH+.03,.025,PEDESTAL_DEPTH+.03),metalMaterial);
  lip.position.y=PEDESTAL_HEIGHT+.011;pivot.add(lip);
  const caption=new THREE.Mesh(new THREE.PlaneGeometry(1.15,.27),
    new THREE.MeshBasicMaterial({map:labelTexture(study.title,study.seed)}));
  caption.position.set(0,.38,PEDESTAL_DEPTH/2+.004);
  pivot.add(caption);
  const core=new THREE.Group();
  core.position.y=PEDESTAL_HEIGHT+.15+H/2;
  pivot.add(core);
  const placeholder=new THREE.Mesh(new THREE.BoxGeometry(.045,1.24,.045),transientMaterial);
  core.add(placeholder);
  const buildLive=()=>{
  const materials=new Map();
  const img=new Image();img.crossOrigin='anonymous';img.decoding='async';
  const bitmap=new Promise((resolve,reject)=>{
    const sources=[study.imageOptimized,study.image].filter(Boolean);
    let index=0;
    img.onload=async()=>{
      if(pivot.userData.galleryDisposed){resolve(null);return;}
      try{resolve(await getImage(img,quality));}catch(err){reject(err);}
    };
    img.onerror=()=>{
      if(index<sources.length)img.src=sources[index++];
      else reject(Error('Could not load the archived portrait image'));
    };
    img.src=sources[index++];
  });
  const lines=vectorForStudy(study);
  let pigmentCount=0,strokeCount=0,loaded=0,removed=false;
  const type=study.material?.type||'marker';
  function showIfReady(){
    if(!removed && pigmentCount+strokeCount>0){
      removed=true;core.remove(placeholder);placeholder.geometry.dispose();
    }
  }
  // Material contours can appear immediately while the exact SVG generation
  // is queued in a separate isolated frame.
  const paints=bitmap.then(data=>{
    if(!data || pivot.userData.galleryDisposed)return null;
    if(type==='marker')return data;
    try {pigmentCount=buildMaterialReliefs(data,study,quality,core,onArtworkMesh);}
    catch(e){console.warn('Material boundary extraction failed',study.seed,e);}
    showIfReady();
    return data;
  }).catch(err=>{console.warn('Material image unavailable',study.seed,err);return null;});
  const strokes=lines.then(async vector=>{
    if(pivot.userData.galleryDisposed)return;
    // Material-specific images complete independently, then gate the source
    // lines. This avoids displaying underlying marker scaffolding as beige
    // plastic when the finished material only contains pigment elsewhere.
    const reference=await paints;
    if(pivot.userData.galleryDisposed)return;
    try {strokeCount=buildPathReliefs(vector,study,quality,core,onArtworkMesh,materials,reference);}
    catch(e){console.warn('Vector relief failed',study.seed,e);}
    showIfReady();
  }).catch(err=>{console.warn('Source vector unavailable',study.seed,err);});
  Promise.all([paints,strokes]).then(([raster])=>{
    if(pivot.userData.galleryDisposed)return;
    if(!strokeCount && !pigmentCount && raster){
      try{pigmentCount=buildMaterialReliefs(raster,study,quality,core,onArtworkMesh);}
      catch(e){console.warn('Raster contour fallback failed',study.seed,e);}
      showIfReady();
    }
    if(!strokeCount && !pigmentCount)
      console.warn('No traceable source geometry for',study.seed);
    onComplete?.({strokeCount,pigmentCount,prepared:false});
  });
  };
  const prepared=study.prebuilt?.[quality];
  if(Array.isArray(prepared)&&prepared.length){
    renderPreparedReliefs({
      entries:prepared,core,study,onArtworkMesh,onFirstMesh:()=>{
        core.remove(placeholder);placeholder.geometry.dispose();
      }
    }).then(success=>{
      if(!success && !pivot.userData.galleryDisposed)buildLive();
      else if(success && !pivot.userData.galleryDisposed)
        onComplete?.({strokeCount:0,pigmentCount:prepared.length,prepared:true});
    }).catch(error=>{
      console.warn('Prepared sculpture failed; regenerating from source',study.seed,error);
      if(!pivot.userData.galleryDisposed)buildLive();
    });
  }else buildLive();
  return {pivot,study};
}
