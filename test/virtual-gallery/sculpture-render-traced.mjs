import * as THREE from 'three';
import {vectorForStudy} from './vector-bridge.mjs';
import {selectRecordedPaths,strokeSections,strokeOutline,portraitCoords} from './vector-geometry.mjs';
import {pigmentGrid,tracePigmentRegions} from './pigment-regions.mjs';
import {paperRGB,estimatePaper,pigmentOpacity,maskPaper} from './paper-isolation.mjs';
import {makeRandom,seedFromString} from './layout-v2.mjs';
import {
  SCULPTURE_WIDTH as W,SCULPTURE_HEIGHT as H,
  PEDESTAL_WIDTH,PEDESTAL_DEPTH,PEDESTAL_HEIGHT
} from './sculptures.mjs';

// The objects below are actual traced source strokes and paint boundaries.
// No golden-section shards, random polygons or full-image picture planes.
const baseMaterial=new THREE.MeshStandardMaterial({color:'#d5d0c4',roughness:.85});
const metalMaterial=new THREE.MeshStandardMaterial({color:'#454c45',metalness:.38,roughness:.48});
const transientMaterial=new THREE.MeshStandardMaterial({color:'#555b52',metalness:.15,roughness:.79});
const thicknessProfiles={
  marker:{ink:.065,pigment:.02,amplify:1.8,roughness:.75,painted:false,opacity:1},
  tissue:{ink:.018,pigment:.028,amplify:2.3,roughness:.94,painted:true,opacity:.84},
  watercolour:{ink:.012,pigment:.035,amplify:3,roughness:.97,painted:true,opacity:.87},
  oil:{ink:.16,pigment:.23,amplify:3.8,roughness:.42,painted:true,opacity:1},
  action:{ink:.15,pigment:.20,amplify:3.2,roughness:.51,painted:true,opacity:1}
};
function getImage(img,quality){
  const canvas=document.createElement('canvas');
  const cap=quality==='mobile'?480:quality==='vr'?600:850;
  const scale=Math.min(1,cap/Math.max(img.naturalWidth,img.naturalHeight));
  canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
  canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(img,0,0,canvas.width,canvas.height);
  return {canvas,pixels:ctx.getImageData(0,0,canvas.width,canvas.height)};
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
    const reference=Math.min(W/source.width,H/source.height);
    const radius=Math.max(.008,Math.min(.075,stroke.width*reference*profile.amplify));
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
export function createPortraitSculpture({scene,study,placement,quality,labelTexture,onArtworkMesh}){
  const pivot=new THREE.Group();
  pivot.name='Traced material sculpture: '+study.seed;
  pivot.position.set(placement.x,placement.y,placement.z);
  pivot.rotation.y=placement.yaw;
  scene.add(pivot);
  const pedestal=new THREE.Mesh(new THREE.BoxGeometry(
    PEDESTAL_WIDTH,PEDESTAL_HEIGHT,PEDESTAL_DEPTH),baseMaterial);
  pedestal.position.y=PEDESTAL_HEIGHT/2;
  pivot.add(pedestal);
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
  const materials=new Map();
  const img=new Image();img.decoding='async';
  const bitmap=new Promise((resolve,reject)=>{
    img.onload=()=>{try{resolve(getImage(img,quality))}catch(err){reject(err)}};
    img.onerror=()=>reject(Error('Could not load the actual archived portrait image'));
    img.src=study.image;
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
    if(type==='marker')return data;
    try {pigmentCount=buildMaterialReliefs(data,study,quality,core,onArtworkMesh);}
    catch(e){console.warn('Material boundary extraction failed',study.seed,e);}
    showIfReady();
    return data;
  }).catch(err=>{console.warn('Material image unavailable',study.seed,err);return null;});
  const strokes=lines.then(async vector=>{
    // Material-specific images complete independently, then gate the source
    // lines. This avoids displaying underlying marker scaffolding as beige
    // plastic when the finished material only contains pigment elsewhere.
    const reference=await paints;
    try {strokeCount=buildPathReliefs(vector,study,quality,core,onArtworkMesh,materials,reference);}
    catch(e){console.warn('Vector relief failed',study.seed,e);}
    showIfReady();
  }).catch(err=>{console.warn('Source vector unavailable',study.seed,err);});
  Promise.all([paints,strokes]).then(([raster])=>{
    if(!strokeCount && !pigmentCount && raster){
      try{pigmentCount=buildMaterialReliefs(raster,study,quality,core,onArtworkMesh);}
      catch(e){console.warn('Raster contour fallback failed',study.seed,e);}
      showIfReady();
    }
    if(!strokeCount && !pigmentCount)
      console.warn('No traceable source geometry for',study.seed);
  });
  return {pivot,study};
}
