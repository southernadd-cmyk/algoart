// Sculpture V2 candidate: isolated test tower only. Production continues
// importing gallery/visit/sculpture-render-traced.mjs and V1 baked packs.
// This adapter preserves the real tower's createPortraitSculpture contract.
import * as THREE from 'three';
import {segmentPainting,V4_METHODS} from './engine/v4-topology.mjs';
import {buildV4Sculpture,disposeV4Sculpture} from './engine/v4-surface.mjs';
import {createHybridSupport,disposeHybridSupport,PLINTH_TOP_LOCAL_Y}
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
const methodParam=typeof location!=='undefined'
  ?new URLSearchParams(location.search).get('v2method'):null;
export const V2_TEST_METHOD=V4_METHODS.includes(methodParam)?methodParam:'assembly';
const status={
  mode:'test-only-dynamic-v2',variant:'v2.0-candidate',
  geometry:'sculpture-lab-v4.2.1',connector:'pin',method:V2_TEST_METHOD,
  attempted:0,complete:0,failed:0,cancelled:0,byDate:{},
  builds:[],modelSource:'archived-raster-108x152',
  productionUnchanged:true
};
if(typeof window!=='undefined')window.__sculptureV2TowerStatus=status;
function count(study,state,details={}){
  const fromId=typeof study.id==='string'?
    study.id.match(/^20\d{2}-\d{2}-\d{2}/)?.[0]:null;
  const fromImage=String(study.image||'')
    .match(/\/gallery\/(20\d{2}-\d{2}-\d{2})\//)?.[1];
  const date=study.date||fromId||fromImage||
    (typeof location!=='undefined'?new URLSearchParams(location.search).get('date'):null)||
    'reception';
  if(!status.byDate[date])
    status.byDate[date]={attempted:0,complete:0,failed:0,cancelled:0};
  status[state]++;status.byDate[date][state]++;
  if(state!=='attempted')status.builds.push({
    date,seed:study.seed,state,method:V2_TEST_METHOD,...details
  });
}
function sourceImage(study){
  return new Promise((resolve,reject)=>{
    const urls=[study.imageOptimized,study.image].filter(Boolean);
    if(!urls.length)return reject(Error('No archived source painting URL'));
    const img=new Image();
    img.crossOrigin='anonymous';img.decoding='async';
    let next=0;
    img.onload=()=>resolve(img);
    img.onerror=()=>{
      if(next>=urls.length)return reject(Error('Source image unavailable'));
      img.src=urls[next++];
    };
    img.src=urls[next++];
  });
}
function sampledPixels(image){
  const canvas=document.createElement('canvas');
  canvas.width=108;canvas.height=152;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(!ctx)throw Error('Painting pixel readback unavailable');
  ctx.drawImage(image,0,0,canvas.width,canvas.height);
  return ctx.getImageData(0,0,canvas.width,canvas.height);
}
function bumpFromInk(topology){
  const w=topology.width,h=topology.height;
  const rgba=new Uint8Array(w*h*4);
  for(let i=0;i<w*h;i++){
    const n=Math.round(Math.max(0,Math.min(1,topology.pigmentInk[i]))*255);
    const p=i*4;rgba[p]=rgba[p+1]=rgba[p+2]=n;rgba[p+3]=255;
  }
  const tex=new THREE.DataTexture(rgba,w,h,THREE.RGBAFormat);
  tex.colorSpace=THREE.NoColorSpace;
  tex.flipY=true;tex.needsUpdate=true;return tex;
}
function addPedestal(pivot,study,labelTexture){
  const pedestal=new THREE.Mesh(
    new THREE.BoxGeometry(PEDESTAL_WIDTH,PEDESTAL_HEIGHT,PEDESTAL_DEPTH),
    pedestalFinish);
  pedestal.position.y=PEDESTAL_HEIGHT/2;
  pedestal.castShadow=true;pedestal.receiveShadow=true;pivot.add(pedestal);
  const lip=new THREE.Mesh(
    new THREE.BoxGeometry(PEDESTAL_WIDTH+.03,.025,PEDESTAL_DEPTH+.03),
    edgeFinish);
  lip.position.y=PEDESTAL_HEIGHT+.011;lip.receiveShadow=true;pivot.add(lip);
  if(labelTexture){
    const label=new THREE.Mesh(new THREE.PlaneGeometry(1.15,.27),
      new THREE.MeshBasicMaterial({map:labelTexture(study.title,study.seed)}));
    label.position.set(0,.38,PEDESTAL_DEPTH/2+.004);
    pivot.add(label);
  }
}
function refuseConfluence(study){
  return study.material==='confluence'||study.material?.type==='confluence';
}
/** Exact public renderer interface. Constructs incrementally after image decode.
 * No V1 packs are overwritten. Phase 3 will replace this on-demand test bake
 * with prepared V2 mesh assets for production performance.
 */
export function createPortraitSculpture({
  scene,study,placement,quality='desktop',labelTexture,onArtworkMesh,onComplete
}={}){
  if(!scene||!study||!placement)throw Error('V2 tower sculpture requires study and placement');
  if(refuseConfluence(study))throw Error('Confluence cannot become a V2 sculpture');
  const pivot=new THREE.Group();
  pivot.name='SCULPTURE V2 TEST / '+String(study.seed);
  pivot.position.set(placement.x,placement.y,placement.z);
  pivot.rotation.y=placement.yaw||0;
  pivot.userData.sculptureV2Test=true;
  scene.add(pivot);
  addPedestal(pivot,study,labelTexture);

  const stage=new THREE.Group();
  stage.position.y=PEDESTAL_HEIGHT+.15+SCULPTURE_HEIGHT/2;
  pivot.add(stage);
  const placeholder=new THREE.Mesh(new THREE.CylinderGeometry(.013,.013,.3,8),
    new THREE.MeshStandardMaterial({color:'#8e8066'}));
  placeholder.name='Waiting for V2 painting geometry';
  placeholder.position.y=-.55;stage.add(placeholder);
  count(study,'attempted');
  (async()=>{
    const start=performance.now();
    const image=await sourceImage(study);
    if(pivot.userData.galleryDisposed){
      count(study,'cancelled');return;
    }
    const pixels=sampledPixels(image);
    const value=study.material?.type||study.material||'marker';
    const materialInfo=resolveStudyMaterial(study.href||study.shareUrl||'',value);
    const material=materialInfo.type||'marker';
    const paper=materialInfo.params?.paper||'#f5f0e6';
    const topology=segmentPainting(pixels,{material,paper,
      maxRegions:quality==='desktop'?72:48});
    if(!topology.regions.length)throw Error('V2 source has no pigment regions');
    if(topology.omittedCells>0)throw Error('V2 source omitted '+topology.omittedCells+' pigment pixels');

    const paintingTexture=new THREE.Texture(image);
    paintingTexture.colorSpace=THREE.SRGBColorSpace;
    paintingTexture.needsUpdate=true;
    const bumpTexture=bumpFromInk(topology);
    let body=null,fixture=null,attached=false;
    try{
      body=buildV4Sculpture(V2_TEST_METHOD,{
        topology,texture:paintingTexture,bumpTexture,
        material,paper,quality:quality==='desktop'?'desktop':'mobile',
        depth:.85,phiPull:.8,fidelity:.9,connection:.65,strokes:[]
      });
      if(body.userData.omittedCells!==0)throw Error('V2 build dropped pigment regions');
      const bounds=new THREE.Box3().setFromObject(body);
      const size=bounds.getSize(new THREE.Vector3());
      if(!Number.isFinite(size.x)||!Number.isFinite(size.y)||!Number.isFinite(size.z))
        throw Error('Non-finite V2 sculpture bounds');
      body.position.y=-.34-bounds.min.y;
      body.updateMatrixWorld(true);
      fixture=createHybridSupport(body,'pin',{pixels});
      const mount=new THREE.Group();
      // Exact proven museum-pin offset from the isolated hybrid tower.
      mount.position.y=PEDESTAL_HEIGHT+.0125-stage.position.y-PLINTH_TOP_LOCAL_Y;
      mount.name='V2 pigment geometry + physically attached museum pin';
      mount.add(body,fixture);
      if(pivot.userData.galleryDisposed){
        count(study,'cancelled');return;
      }
      stage.remove(placeholder);
      placeholder.geometry.dispose();placeholder.material.dispose();
      stage.add(mount);
      attached=true;
      for(const mesh of body.children)if(mesh.isMesh)onArtworkMesh?.(mesh);
      const stats={
        regions:body.userData.regionCount,
        omittedCells:body.userData.omittedCells,
        triangles:body.userData.polygonTriangles,
        extent:[size.x,size.y,size.z],
        zLayerExtent:body.userData.zLayerExtent,
        sourceCoverage:body.userData.sourceCoverage,
        elapsedMs:Math.round(performance.now()-start),
        anchors:fixture.userData.anchorCount,
        method:V2_TEST_METHOD
      };
      Object.assign(pivot.userData,{
        sculptureV2Ready:true,sculptureV2Mounted:true,
        sculptureV2Connector:'pin',sculptureV2Metrics:stats,
        sculptureV2Texture:true
      });
      count(study,'complete',stats);
      onComplete?.({strokeCount:0,pigmentCount:stats.regions,prepared:false,v2:true});
    }finally{
      if(!attached){
        if(fixture)disposeHybridSupport(fixture);
        if(body)disposeV4Sculpture(body);
        paintingTexture.dispose();bumpTexture.dispose();
      }
    }
  })().catch(error=>{
    if(pivot.userData.galleryDisposed)return;
    pivot.userData.sculptureV2Error=String(error?.message||error);
    count(study,'failed',{error:pivot.userData.sculptureV2Error});
    console.warn('[V2 test tower] source model failed',study.seed,error);
    onComplete?.({strokeCount:0,pigmentCount:0,prepared:false,v2:false});
  });
  return{pivot,study};
}
