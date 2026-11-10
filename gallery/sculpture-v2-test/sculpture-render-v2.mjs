// Sculpture V2 candidate: isolated test tower only. Production continues
// importing gallery/visit/sculpture-render-traced.mjs and V1 baked packs.
// This adapter preserves the real tower's createPortraitSculpture contract.
import * as THREE from 'three';
import {downloadV2Floor,reconstructV2Study,disposePreparedV2}
  from './v2-pack-loader.mjs';
import {createHybridSupport,disposeHybridSupport,PLINTH_TOP_LOCAL_Y}
  from '../sculpture-lab/hybrid-supports.mjs';
import {PEDESTAL_WIDTH,PEDESTAL_DEPTH,PEDESTAL_HEIGHT,SCULPTURE_HEIGHT}
  from '../visit/sculptures.mjs';

let pedestalFinish=new THREE.MeshStandardMaterial({color:'#d5d0c4',roughness:.85});
let edgeFinish=new THREE.MeshStandardMaterial({color:'#454c45',roughness:.48,metalness:.38});
export function setSculptureArchitecturalMaterials({plinth,metal}={}){
  if(plinth)pedestalFinish=plinth;
  if(metal)edgeFinish=metal;
}
export const V2_TEST_METHOD='assembly';
const status={
  mode:'test-only-prepared-v2',variant:'v2.0-prepared-archive',
  geometry:'sculpture-lab-v4.2.1',connector:'pin',method:V2_TEST_METHOD,
  attempted:0,complete:0,failed:0,cancelled:0,byDate:{},
  builds:[],modelSource:'audited-historical-v2-packs',
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
// Shared archive requests; only the most recently visited date of each
// quality remains cached, avoiding retained geometry from all 37 floors.
const floors=new Map();
function preparedFloor(date,quality){
  const key=quality+':'+date;
  if(floors.has(key))return floors.get(key);
  for(const k of floors.keys())if(k.startsWith(quality+':'))floors.delete(k);
  const loading=downloadV2Floor(date,quality).catch(error=>{
    if(floors.get(key)===loading)floors.delete(key);
    throw error;
  });
  floors.set(key,loading);
  return loading;
}
function archiveDate(study){
  const idDate=String(study.id||'').slice(0,10);
  if(/^20[0-9]{2}-[0-9]{2}-[0-9]{2}$/.test(idDate))return idDate;
  const segments=new URL(study.image,location.href).pathname.split('/');
  const fromImage=segments.find(x=>/^20[0-9]{2}-[0-9]{2}-[0-9]{2}$/.test(x));
  if(!fromImage)throw Error('Missing date for prepared V2 sculpture '+study.seed);
  return fromImage;
}
function sourceFileOf(study){
  if(study.imageFile)return study.imageFile;
  const filename=String(study.image||'').split('?')[0].split('/').pop();
  if(!filename||!filename.endsWith('.jpg'))
    throw Error('Prepared V2 sculpture lacks its original image file');
  return filename;
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
/** Isolated prepared V2 geometry adapter; live V1 is never imported. */
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
    const date=archiveDate(study),name=sourceFileOf(study);
    const requestedQuality=quality==='desktop'?'desktop':'mobile';
    const floor=await preparedFloor(date,requestedQuality);
    const prepared=floor.studies[name];
    if(!prepared)throw Error('Verified V2 pack omits '+date+'/'+name);
    if(prepared.quality!==requestedQuality||prepared.method!=='assembly'||
       prepared.coverage!==1||prepared.omittedCells!==0)
      throw Error('V2 prepared sculpture has invalid source geometry');
    const image=await sourceImage(study);
    if(pivot.userData.galleryDisposed){count(study,'cancelled');return;}
    const paintingTexture=new THREE.Texture(image);
    paintingTexture.colorSpace=THREE.SRGBColorSpace;
    paintingTexture.needsUpdate=true;
    let body=null,fixture=null,bumpTexture=null,attached=false;
    try{
      ({body,bumpTexture}=reconstructV2Study(prepared,paintingTexture));
      if(body.userData.omittedCells!==0||body.userData.sourceCoverage!==1)
        throw Error('Prepared V2 geometry omitted source pigment');
      const bounds=new THREE.Box3().setFromObject(body);
      const size=bounds.getSize(new THREE.Vector3());
      if(!Number.isFinite(size.x)||!Number.isFinite(size.y)||!Number.isFinite(size.z))
        throw Error('Non-finite V2 sculpture bounds');
      body.position.y=-.34-bounds.min.y;
      body.updateMatrixWorld(true);
      fixture=createHybridSupport(body,'pin');
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
        zLayerExtent:body.userData.zLayerExtent||0,
        sourceFile:prepared.sourceFile,
        pixelFallbackRegions:prepared.pixelFallbackRegions||0,
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
      onComplete?.({strokeCount:0,pigmentCount:stats.regions,prepared:true,v2:true});
    }finally{
      if(!attached){
        if(fixture)disposeHybridSupport(fixture);
        if(body)disposePreparedV2({body,bumpTexture});
        else bumpTexture?.dispose();
        paintingTexture.dispose();
      }
    }
  })().catch(error=>{
    if(pivot.userData.galleryDisposed)return;
    pivot.userData.sculptureV2Error=String(error?.message||error);
    count(study,'failed',{error:pivot.userData.sculptureV2Error});
    console.warn('[V2 prepared test tower] source model failed',study.seed,error);
    onComplete?.({strokeCount:0,pigmentCount:0,prepared:false,v2:false});
  });
  return{pivot,study};
}
