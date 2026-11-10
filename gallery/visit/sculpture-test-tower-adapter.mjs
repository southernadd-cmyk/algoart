// Exhibition tower TEST-ONLY sculpture adapter.
// Drop-in replacement for createPortraitSculpture, used ONLY by the
// independently bundled sculpture-test-tower page. NEVER imported by live.
import * as THREE from 'three';
import {resolveStudyMaterial} from './study-material.mjs';
import {PEDESTAL_WIDTH,PEDESTAL_DEPTH,PEDESTAL_HEIGHT} from './sculptures.mjs';
import {materialFinish,pigmentField} from '../sculpture-lab/material-surface.mjs';
import {createHybridSupport,PLINTH_TOP_LOCAL_Y} from '../sculpture-lab/hybrid-supports.mjs';

const PACK_VERSION=2,PACK_FORMAT='hybrid-13b-pos16-normal8-uv16-le';
const packCache=new Map(),stats={
 mode:'isolated-hybrid-museum-pin-v1',
 loaded:0,failed:0,packsLoaded:0,sculptures:new Set(),errors:[]
};
globalThis.__PP_TEST_TOWER_SCULPTURES__=stats;
let architecturalPlinth=new THREE.MeshStandardMaterial({color:'#ae9a80',roughness:.81});
let architecturalMetal=new THREE.MeshStandardMaterial({
 color:'#444943',metalness:.33,roughness:.56
});
export function setSculptureArchitecturalMaterials({plinth,metal}={}){
 if(plinth)architecturalPlinth=plinth;
 if(metal)architecturalMetal=metal;
}
function archiveDate(study){
 const date=String(study.image||'').match(/\/gallery\/(\d{4}-\d{2}-\d{2})\//)?.[1]||
  String(study.imageFile||'').match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
 if(!date)throw Error('Could not identify dated archive portrait: '+study.seed);
 return date;
}
async function geometryPack(date){
 if(!packCache.has(date))packCache.set(date,(async()=>{
  if(typeof DecompressionStream!=='function')
   throw Error('This browser cannot open compressed hybrid sculpture packs');
  const uri=new URL('./test-sculpture-packs/'+date+'.json.gz',import.meta.url);
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),18000);
  try{
   const response=await fetch(uri,{signal:controller.signal,cache:'force-cache'});
   if(!response.ok||!response.body)
    throw Error('Unbaked test sculpture floor '+date+' (HTTP '+response.status+')');
   const text=await new Response(response.body.pipeThrough(
    new DecompressionStream('gzip'))).text();
   const pack=JSON.parse(text);
   if(pack.version!==PACK_VERSION||pack.date!==date||
      pack.method!=='hybrid'||pack.mount!=='museum-pin'||
      pack.format!==PACK_FORMAT||!pack.studies)
    throw Error('Unsupported test sculpture pack '+date);
   if(Object.keys(pack.studies).length!==pack.portraitCount)
    throw Error('Incomplete prebaked sculpture pack '+date);
   stats.packsLoaded++;
   return pack.studies;
  }finally{clearTimeout(timer);}
 })());
 return packCache.get(date);
}
function decodeBakedGeometry(entry){
 if(entry?.format!==PACK_FORMAT||entry.method!=='hybrid'||
    entry.mount!=='museum-pin'||entry.vertices<150||
    entry.vertices>450000||entry.vertices%3!==0)
  throw Error('Unexpected or corrupt baked hybrid geometry');
 const raw=atob(entry.packed||'');
 if(raw.length!==entry.vertices*13)
  throw Error('Baked hybrid vertex stream truncated');
 const bytes=new Uint8Array(raw.length);
 for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
 const view=new DataView(bytes.buffer);
 const pos=new Float32Array(entry.vertices*3);
 const norms=new Float32Array(entry.vertices*3);
 const uv=new Float32Array(entry.vertices*2);
 for(let i=0;i<entry.vertices;i++){
  const k=i*13,p=i*3,t=i*2;
  for(let a=0;a<3;a++){
   pos[p+a]=view.getInt16(k+a*2,true)/16384;
   norms[p+a]=view.getInt8(k+6+a)/127;
  }
  uv[t]=view.getUint16(k+9,true)/65535;
  uv[t+1]=view.getUint16(k+11,true)/65535;
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
 geo.setAttribute('normal',new THREE.BufferAttribute(norms,3));
 geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));
 geo.computeBoundingBox();
 const size=geo.boundingBox.getSize(new THREE.Vector3());
 if(size.x<.02||size.y<.02||size.z<.1)
  throw Error('Hybrid sculpted form has no genuine 3D extent');
 return geo;
}
function imageFromSource(url){
 return new Promise((resolve,reject)=>{
  const img=new Image();
  img.decoding='async';
  img.onload=()=>resolve(img);
  img.onerror=()=>reject(Error('Archived image unavailable for material: '+url));
  img.src=url;
 });
}
function paintingSourcePixels(img){
 const canvas=document.createElement('canvas');
 canvas.width=108;canvas.height=152;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});
 ctx.drawImage(img,0,0,108,152);
 return ctx.getImageData(0,0,108,152);
}
function bleedingPigmentTexture(pixels,type,paper){
 // Identical local pigment continuation rule to the approved Sculpture Lab.
 const field=pigmentField(pixels,{material:type,paper});
 const w=pixels.width,h=pixels.height,n=w*h,
  nearest=new Int32Array(n).fill(-1),queue=new Int32Array(n);
 let head=0,tail=0;
 for(let i=0;i<n;i++)if(field.ink[i]>.30){
  nearest[i]=i;queue[tail++]=i;
 }
 if(!tail)for(let i=0;i<n;i++)if(field.ink[i]>.07){
  nearest[i]=i;queue[tail++]=i;
 }
 while(head<tail){
  const i=queue[head++],x=i%w,y=(i/w)|0;
  for(const j of [x>0?i-1:-1,x+1<w?i+1:-1,
    y>0?i-w:-1,y+1<h?i+w:-1]){
   if(j<0||nearest[j]>=0)continue;
   nearest[j]=nearest[i];queue[tail++]=j;
  }
 }
 const canvas=document.createElement('canvas');
 canvas.width=w;canvas.height=h;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});
 const result=ctx.createImageData(w,h);
 for(let i=0;i<n;i++){
  const d=i*4,origin=Math.max(0,nearest[i])*4;
  for(let c=0;c<3;c++)
   result.data[d+c]=field.ink[i]>.48?pixels.data[d+c]:pixels.data[origin+c];
  result.data[d+3]=255;
 }
 ctx.putImageData(result,0,0);
 const texture=new THREE.CanvasTexture(canvas);
 texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;
 return texture;
}
function createPaintingMaterial(img,pixels,study,finishType){
 const paintTex=new THREE.Texture(img);
 paintTex.colorSpace=THREE.SRGBColorSpace;
 paintTex.anisotropy=4;
 paintTex.needsUpdate=true;
 const paper=study.material?.params?.paper||'#f5f0e6';
 const sideTex=bleedingPigmentTexture(pixels,finishType,paper);
 const finish=materialFinish(finishType);
 const material=new THREE.MeshStandardMaterial({
  map:paintTex,bumpMap:paintTex,bumpScale:finish.bumpScale,
  roughness:finish.roughness,metalness:finish.metalness,
  side:THREE.DoubleSide
 });
 material.onBeforeCompile=shader=>{
  shader.uniforms.ppSculptureSideTexture={value:sideTex};
  shader.vertexShader=shader.vertexShader
   .replace('#include <common>',
    '#include <common>\nvarying float vPPOriginalFrontness;')
   .replace('#include <begin_vertex>',
    '#include <begin_vertex>\nvPPOriginalFrontness = normal.z;');
  shader.fragmentShader=shader.fragmentShader
   .replace('#include <common>',
    '#include <common>\nvarying float vPPOriginalFrontness;\nuniform sampler2D ppSculptureSideTexture;')
   .replace('#include <map_fragment>',[
     '#include <map_fragment>',
     '#ifdef USE_MAP',
     'vec4 ppLocalPigment = texture2D(ppSculptureSideTexture, vMapUv);',
     'float ppAround = 1.0 - smoothstep(0.22, 0.78, vPPOriginalFrontness);',
     'diffuseColor.rgb = mix(diffuseColor.rgb, ppLocalPigment.rgb, ppAround);',
     '#endif'
   ].join('\n'));
 };
 material.customProgramCacheKey=()=>'pp-test-tower-hybrid-paint-v1';
 material.userData.sideTexture=sideTex;
 // The tower disposal loop introspects material fields to free textures.
 // Expose the second GPU sampler as an owned material property.
 material.userData.galleryOwnedSideTexture=true;
 material.ppSideTexture=sideTex;
 return material;
}
function pedestal(pivot,study,labelTexture){
 const block=new THREE.Mesh(new THREE.BoxGeometry(
  PEDESTAL_WIDTH,PEDESTAL_HEIGHT,PEDESTAL_DEPTH),architecturalPlinth);
 block.position.y=PEDESTAL_HEIGHT/2;block.castShadow=true;
 pivot.add(block);
 const lip=new THREE.Mesh(new THREE.BoxGeometry(
  PEDESTAL_WIDTH+.03,.025,PEDESTAL_DEPTH+.03),architecturalMetal);
 lip.position.y=PEDESTAL_HEIGHT+.011;
 pivot.add(lip);
 const caption=new THREE.Mesh(new THREE.PlaneGeometry(1.15,.27),
  new THREE.MeshBasicMaterial({map:labelTexture(study.title,study.seed)}));
 caption.position.set(0,.38,PEDESTAL_DEPTH/2+.004);pivot.add(caption);
}
export function createPortraitSculpture({
 scene,study,placement,quality='desktop',labelTexture,onArtworkMesh,onComplete
}){
 const pivot=new THREE.Group();
 pivot.name='TEST / prebaked hybrid painting / museum pin / '+study.seed;
 pivot.position.set(placement.x,placement.y,placement.z);
 pivot.rotation.y=placement.yaw||0;
 pivot.userData.testSculptureStatus='loading';
 scene.add(pivot);
 pedestal(pivot,study,labelTexture);
 const date=archiveDate(study),imageFile=study.imageFile;
 if(!imageFile)throw Error('Tower portrait has no archive filename');
 // Return immediately. The real gallery's lift/staging/deferred logic
 // continues without blocking a frame on image decoding.
 Promise.all([
  geometryPack(date),
  imageFromSource(study.image)
 ]).then(([studies,img])=>{
  if(pivot.userData.galleryDisposed)return;
  const data=studies[imageFile]?.[quality];
  if(!data)throw Error('Not baked: '+date+'/'+imageFile+'/'+quality);
  if(data.sourceImage!==imageFile||data.seed!==study.seed)
   throw Error('Incorrect source image in rebaked sculpture '+study.seed);
  const geom=decodeBakedGeometry(data);
  const pixels=paintingSourcePixels(img);
  const type=study.material?.type||
   resolveStudyMaterial(study.href,study.material||'marker').type;
  const material=createPaintingMaterial(img,pixels,study,type);
  const hybridMesh=new THREE.Mesh(geom,material);
  hybridMesh.name='REBaked actual HYBRID pigment with archived oil/tissue texture';
  hybridMesh.castShadow=false;
  const artwork=new THREE.Group();artwork.add(hybridMesh);
  // Match the approved Sculpture Lab: source 3D geometry, lifted into a
  // true gallery support position, NOT overlaid on another pale sculpture.
  const bounds=new THREE.Box3().setFromObject(artwork);
  artwork.position.y=-.34-bounds.min.y;
  artwork.updateMatrixWorld(true);
  const museumPin=createHybridSupport(artwork,'pin');
  // Real gallery pedestal top is .7325m (including its bronze lip).
  // Support helper was built against a local -0.8175m plinth top.
  const mount=new THREE.Group();
  mount.position.y=PEDESTAL_HEIGHT+.0125-PLINTH_TOP_LOCAL_Y;
  mount.add(artwork,museumPin);
  pivot.add(mount);
  onArtworkMesh?.(hybridMesh);
  pivot.userData.testSculptureStatus='rebaked';
  pivot.userData.testSculptureGeometry={
   source:imageFile,quality,vertices:data.vertices,
   triangles:data.triangles,material:type,mount:'museum-pin',
   sculptureMethod:'hybrid'
  };
  stats.loaded++;
  stats.sculptures.add(date+'/'+imageFile+'/'+quality);
  onComplete?.({strokeCount:0,pigmentCount:data.triangles,prepared:true});
 }).catch(error=>{
  if(pivot.userData.galleryDisposed)return;
  pivot.userData.testSculptureStatus='error';
  pivot.userData.testSculptureError=error.message;
  stats.failed++;
  stats.errors.push({date,imageFile,quality,error:error.message});
  console.error('[TEST TOWER] Sculpture rebake unavailable',date,imageFile,error);
  onComplete?.({strokeCount:0,pigmentCount:0,prepared:false});
 });
 return {pivot,study};
}
