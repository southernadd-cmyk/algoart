// ISOLATED HYBRID TOWER TEST — not used by daily publishing or live gallery.
// Reconstruct the current hybrid painting volume on EVERY eligible portrait
// floor using the original archive JPEG and the approved museum-pin fixture.
// This is an on-demand mesh bake at floor entry; the historical production
// contour packs are left intact. The module is bundled ONLY in the test tower.
import * as THREE from 'three';
import {buildMaterialSculpture,pigmentField}
  from '../sculpture-lab/material-surface.mjs';
import {createHybridSupport,PLINTH_TOP_LOCAL_Y}
  from '../sculpture-lab/hybrid-supports.mjs';
import {PEDESTAL_WIDTH,PEDESTAL_DEPTH,PEDESTAL_HEIGHT,SCULPTURE_HEIGHT}
  from '../visit/sculptures.mjs';
import {resolveStudyMaterial} from '../visit/study-material.mjs';

let pedestalFinish=new THREE.MeshStandardMaterial({color:'#d5d0c4',roughness:.85});
let edgeFinish=new THREE.MeshStandardMaterial({color:'#454c45',roughness:.48,metalness:.38});
export function setSculptureArchitecturalMaterials({plinth,metal}={}){
  if(plinth)pedestalFinish=plinth;
  if(metal)edgeFinish=metal;
}
const timeline={
  mode:'test-only-dynamic-hybrid-bake',
  variant:'hybrid',connector:'pin',attempted:0,complete:0,
  failed:0,byDate:{}
};
if(typeof window!=='undefined')window.__hybridTowerStatus=timeline;
const progress=(study,stage)=>{
  const key=study.date||'current';
  const stats=timeline.byDate[key]||(timeline.byDate[key]={attempted:0,complete:0,failed:0});
  if(!stats[stage])stats[stage]=0;
  stats[stage]++;
  timeline[stage]++;
};
function sourceImage(study){
  return new Promise((resolve,reject)=>{
    const urls=[study.imageOptimized,study.image].filter(Boolean);
    const img=new Image();
    img.crossOrigin='anonymous';img.decoding='async';
    let at=0;
    img.onload=()=>resolve(img);
    img.onerror=()=>{
      if(at>=urls.length)return reject(Error('Archived portrait unavailable'));
      img.src=urls[at++];
    };
    if(!urls.length)return reject(Error('No archived portrait source'));
    img.src=urls[at++];
  });
}
function sampledPixels(image){
  const canvas=document.createElement('canvas');
  canvas.width=108;canvas.height=152;
  const context=canvas.getContext('2d',{willReadFrequently:true});
  context.drawImage(image,0,0,canvas.width,canvas.height);
  return context.getImageData(0,0,canvas.width,canvas.height);
}
// Continue local pigment into the curved edges; otherwise sparse paintings
// sample the JPEG's PAPER on their sides and turn into off-white slabs.
function pigmentContinuation(pixels,material,paper){
  const field=pigmentField(pixels,{material,paper});
  const w=pixels.width,h=pixels.height,total=w*h;
  const seeds=new Int32Array(total).fill(-1);
  const queue=new Int32Array(total);
  let read=0,write=0;
  for(let i=0;i<total;i++)if(field.ink[i]>.3){
    seeds[i]=i;queue[write++]=i;
  }
  if(!write)for(let i=0;i<total;i++)if(field.ink[i]>.07){
    seeds[i]=i;queue[write++]=i;
  }
  while(read<write){
    const i=queue[read++],x=i%w,y=Math.floor(i/w);
    for(const neighbor of [x>0?i-1:-1,x+1<w?i+1:-1,
      y>0?i-w:-1,y+1<h?i+w:-1]){
      if(neighbor<0||seeds[neighbor]>=0)continue;
      seeds[neighbor]=seeds[i];queue[write++]=neighbor;
    }
  }
  const canvas=document.createElement('canvas');
  canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d');
  const tinted=ctx.createImageData(w,h);
  for(let i=0;i<total;i++){
    const from=(field.ink[i]>.48?i:Math.max(0,seeds[i]))*4;
    const to=i*4;
    for(let c=0;c<3;c++)tinted.data[to+c]=pixels.data[from+c];
    tinted.data[to+3]=255;
  }
  ctx.putImageData(tinted,0,0);
  const tex=new THREE.CanvasTexture(canvas);
  tex.colorSpace=THREE.SRGBColorSpace;
  return tex;
}
function addPedestal(pivot,study,labelTexture){
  const pedestal=new THREE.Mesh(
    new THREE.BoxGeometry(PEDESTAL_WIDTH,PEDESTAL_HEIGHT,PEDESTAL_DEPTH),
    pedestalFinish);
  pedestal.position.y=PEDESTAL_HEIGHT/2;
  pedestal.castShadow=true;pivot.add(pedestal);
  const lip=new THREE.Mesh(
    new THREE.BoxGeometry(PEDESTAL_WIDTH+.03,.025,PEDESTAL_DEPTH+.03),
    edgeFinish);
  lip.position.y=PEDESTAL_HEIGHT+.011;
  pivot.add(lip);
  if(labelTexture){
    const card=new THREE.Mesh(new THREE.PlaneGeometry(1.15,.27),
      new THREE.MeshBasicMaterial({map:labelTexture(study.title,study.seed)}));
    card.position.set(0,.38,PEDESTAL_DEPTH/2+.004);
    pivot.add(card);
  }
}
/**
 * Exact gallery renderer interface. Returns immediately so lift staging
 * remains incremental, while the costly hybrid mesh is built when its JPEG
 * finishes decoding. No legacy extrusions and no unrelated backing sculpture.
 */
export function createPortraitSculpture({
  scene,study,placement,quality='desktop',labelTexture,onArtworkMesh,onComplete
}={}){
  const pivot=new THREE.Group();
  pivot.name='TEST hybrid painted sculpture / museum pin / '+study.seed;
  pivot.position.set(placement.x,placement.y,placement.z);
  pivot.rotation.y=placement.yaw||0;
  pivot.userData.hybridTowerCandidate=true;
  scene.add(pivot);
  addPedestal(pivot,study,labelTexture);
  const base=new THREE.Group();
  base.position.y=PEDESTAL_HEIGHT+.15+SCULPTURE_HEIGHT/2;
  pivot.add(base);
  const placeholder=new THREE.Mesh(new THREE.CylinderGeometry(.013,.013,.30,8),
    new THREE.MeshBasicMaterial({color:'#8e8066'}));
  placeholder.position.y=-.55;
  base.add(placeholder);
  const material=resolveStudyMaterial(study.shareUrl||'',study.material?.type||study.material||'marker');
  const type=material.type||'marker';
  const paper=material.params?.paper||'#f5f0e6';
  progress(study,'attempted');
  (async()=>{
    const img=await sourceImage(study);
    if(pivot.userData.galleryDisposed)return;
    const pixels=sampledPixels(img);
    // High resolution is ONLY used by GPU texture sampling; volume meshing
    // uses the fixed deterministic 108x152 pigment source and mobile budget.
    const tex=new THREE.Texture(img);
    tex.colorSpace=THREE.SRGBColorSpace;
    tex.needsUpdate=true;
    const side= pigmentContinuation(pixels,type,paper);
    let body,fixture;
    try{
      body=buildMaterialSculpture('hybrid',pixels,tex,{
        material:type,paper,quality:quality==='desktop'?'desktop':'mobile',
        sideTexture:side,depth:1
      });
      const bounds=new THREE.Box3().setFromObject(body);
      body.position.y=-.34-bounds.min.y;
      body.updateMatrixWorld(true);
      fixture=createHybridSupport(body,'pin',{pixels});
      // The laboratory's plinth origin differs from the tower's by 0.26m.
      // Transform body AND support together so real mesh anchors stay joined.
      const mount=new THREE.Group();
      mount.position.y=PEDESTAL_HEIGHT+.0125-base.position.y-PLINTH_TOP_LOCAL_Y;
      mount.add(body,fixture);
      mount.name='Hybrid material volume with physical museum-pin joint';
      if(pivot.userData.galleryDisposed){
        // Pivot teardown owns all materials and textures after disposal.
        tex.dispose();side.dispose();
        return;
      }
      base.remove(placeholder);
      placeholder.geometry.dispose();placeholder.material.dispose();
      base.add(mount);
      onArtworkMesh?.(body.children[0]);
      pivot.userData.hybridTowerReady=true;
      pivot.userData.hybridTowerConnector='pin';
      pivot.userData.hybridTowerPaintTexture=true;
      pivot.userData.hybridTowerBodyMethod='hybrid';
      pivot.userData.hybridTowerMounted=true;
      progress(study,'complete');
      onComplete?.({strokeCount:0,pigmentCount:1,prepared:true,hybrid:true});
    }catch(e){
      body?.traverse(o=>{
        o.geometry?.dispose();
        if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();
      });
      fixture?.traverse(o=>{
        o.geometry?.dispose();
        if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();
      });
      tex.dispose();side.dispose();
      throw e;
    }
  })().catch(error=>{
    if(pivot.userData.galleryDisposed)return;
    progress(study,'failed');
    pivot.userData.hybridTowerError=error.message;
    console.warn('[Hybrid tower test] Could not rebuild sculpture',study.seed,error);
    onComplete?.({strokeCount:0,pigmentCount:0,prepared:false,hybrid:false});
  });
  return {pivot,study};
}
