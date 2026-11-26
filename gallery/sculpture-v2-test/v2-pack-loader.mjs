// Prepared Sculpture V2 geometry reader (no painting segmentation at runtime).
// Compatible with the isolated test tower; production V1 remains untouched.
import * as THREE from 'three';
const valid=(x)=>Number.isFinite(x);
function attribute(data,components,scale,expectedCount=null){
  if(!Array.isArray(data)||data.length%components)
    throw Error('Malformed V2 mesh attribute');
  const count=data.length/components;
  if(expectedCount!==null&&count!==expectedCount)
    throw Error('Mismatched V2 attribute vertex counts');
  const out=new Float32Array(data.length);
  for(let i=0;i<data.length;i++){
    if(!Number.isInteger(data[i]))throw Error('Invalid quantized V2 vertex');
    out[i]=data[i]/scale;
    if(!valid(out[i]))throw Error('V2 coordinate overflow');
  }
  return new THREE.BufferAttribute(out,components);
}
function bumpFromEncodedInk(ink){
  if(!ink||ink.format!=='l8-base64'||ink.width!==108||ink.height!==152)
    throw Error('Unsupported V2 pigment bump map');
  const binary=atob(ink.data);
  if(binary.length!==ink.width*ink.height)
    throw Error('Invalid V2 pigment density size');
  const rgba=new Uint8Array(binary.length*4);
  for(let i=0;i<binary.length;i++){
    const at=i*4,n=binary.charCodeAt(i);
    rgba[at]=rgba[at+1]=rgba[at+2]=n;rgba[at+3]=255;
  }
  const texture=new THREE.DataTexture(rgba,ink.width,ink.height,THREE.RGBAFormat);
  texture.colorSpace=THREE.NoColorSpace;texture.flipY=true;
  texture.needsUpdate=true;
  return texture;
}
function meshMaterials(mesh,paintingTexture,bumpTexture){
  if(!mesh.materials?.length)throw Error('V2 material data missing');
  return mesh.materials.map(desc=>{
    if(!/^#[0-9a-f]{6}$/i.test(desc.color))throw Error('Invalid source pigment colour');
    if(!['source',null].includes(desc.map))
      throw Error('Unrecognized V2 painting texture reference');
    if(!['ink',null].includes(desc.bumpMap))
      throw Error('Unrecognized V2 density texture reference');
    return new THREE.MeshStandardMaterial({
      color:desc.color,
      roughness:desc.roughness,
      metalness:desc.metalness,
      opacity:desc.opacity,
      transparent:desc.transparent,
      side:desc.side,
      ...(desc.map==='source'?{map:paintingTexture}:{}),
      ...(desc.bumpMap==='ink'?{bumpMap:bumpTexture,bumpScale:desc.bumpScale}:{})
    });
  });
}
export function reconstructV2Study(data,paintingTexture){
  if(!data||data.schema!=='pp-sculpture-v2-study'||data.version!==2)
    throw Error('Unknown V2 study format');
  if(data.omittedCells!==0||data.coverage!==1||!data.regionCount)
    throw Error('V2 study has incomplete source pigment');
  if(data.geometryRevision!=='v4.2.1-v2-pigment-island-fix')
    throw Error('V2 geometry version does not match approved renderer');
  if(!paintingTexture?.isTexture)throw Error('Missing archived painting texture');
  const Q=data.quantization;
  if(Q?.position!==100000||Q?.normal!==10000||Q?.uv!==100000)
    throw Error('Unknown V2 vertex precision');
  if(!Array.isArray(data.meshes)||data.meshes.length<data.regionCount)
    throw Error('V2 region mesh count is incomplete');
  const bumpTexture=bumpFromEncodedInk(data.ink);
  const body=new THREE.Group();
  body.name='V2 prepared source geometry / '+data.seed;
  let faces=0;
  try{
    for(const obj of data.meshes){
      const g=obj.geometry;
      if(!g||!Array.isArray(g.index)||!g.index.length||g.index.length%3)
        throw Error('V2 prepared mesh lacks indexed geometry');
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',attribute(g.position,3,Q.position));
      const n=geometry.getAttribute('position').count;
      geometry.setAttribute('normal',attribute(g.normal,3,Q.normal,n));
      geometry.setAttribute('uv',attribute(g.uv,2,Q.uv,n));
      const ids=g.index;
      if(ids.some(i=>!Number.isInteger(i)||i<0||i>=n))
        throw Error('Out of bounds V2 mesh indices');
      geometry.setIndex(ids);
      let drawn=0;
      for(const group of g.groups){
        const {start,count,materialIndex}=group;
        if(!Number.isInteger(start)||!Number.isInteger(count)||
          start<0||count<=0||start+count>ids.length||count%3||
          !Number.isInteger(materialIndex)||materialIndex<0||
          materialIndex>=obj.materials.length)
          throw Error('Invalid V2 material region');
        geometry.addGroup(start,count,materialIndex);drawn+=count;
      }
      if(drawn!==ids.length)throw Error('Incomplete V2 surface material groups');
      const materials=meshMaterials(obj,paintingTexture,bumpTexture);
      const mesh=new THREE.Mesh(geometry,materials);
      mesh.name=obj.name||'Source pigment volume';
      mesh.castShadow=!!obj.castShadow;
      mesh.receiveShadow=!!obj.receiveShadow;
      mesh.position.fromArray(obj.position);
      mesh.rotation.set(...obj.rotation);
      mesh.scale.fromArray(obj.scale);
      if(Number.isInteger(obj.regionId))mesh.userData.regionId=obj.regionId;
      body.add(mesh);
      faces+=ids.length/3;
    }
    if(faces!==data.triangleCount)throw Error('V2 geometric triangle count mismatch');
    body.userData={
      version:2,geometryRevision:data.geometryRevision,
      prepared:true,sourceImage:data.imageFile,
      regionCount:data.regionCount,omittedCells:0,
      polygonTriangles:faces,quality:data.quality,
      method:data.method,sourceCoverage:1
    };
    return {body,bumpTexture};
  }catch(error){
    for(const child of body.children){
      child.geometry?.dispose();
      for(const material of Array.isArray(child.material)?child.material:[child.material])
        material.dispose();
    }
    bumpTexture.dispose();
    throw error;
  }
}
export function disposePreparedV2({body,bumpTexture}){
  if(body){
    body.traverse(obj=>{
      obj.geometry?.dispose();
      if(obj.material)for(const m of Array.isArray(obj.material)?obj.material:[obj.material])
        m.dispose();
    });
    body.removeFromParent();
    body.clear();
  }
  bumpTexture?.dispose();
}
// Isolated V2 only: SHA-verified immutable R2 meshes, never Pages geometry.
// A missing or corrupt R2 object fails closed; production V1 is untouched.
// Regional Assembly 100/100/40/95 release (run 44153970005): every published
// floor from 2026-10-05 to 2026-11-17 plus reception, rebuilt from originals.
// Rollback is a revert to the v4.2.1-20261110 catalog, which stays in R2.
const V2_RELEASE='assembly-20261117';
const V2_PRESET_ID='assembly-100-100-40-95';
const CATALOG_DAYS=44;
// Days after the catalog come from the daily publisher under the same preset.
export const V2_DAILY_FROM='2026-11-18';
export const V2_R2_CATALOG_URL=
  'https://proportion-piece-sculpture-v2.mr-adam-clement.workers.dev/'+
  'sculptures-v2/'+V2_RELEASE+'/catalog/'+
  '35708a93df2c399e095687e975d38903ba1c0b3b9fda4ad216d17dcedaaad900.json';
const CATALOG_SHA='35708a93df2c399e095687e975d38903ba1c0b3b9fda4ad216d17dcedaaad900';
const R2_ORIGIN='https://proportion-piece-sculpture-v2.mr-adam-clement.workers.dev';
const R2_PREFIX='/sculptures-v2/'+V2_RELEASE+'/';
const hex=bytes=>Array.from(new Uint8Array(bytes),
  byte=>byte.toString(16).padStart(2,'0')).join('');
async function verifiedBytes(response,expected,desc){
  if(!response.ok)throw Error(desc+' HTTP '+response.status);
  if(!/^[a-f0-9]{64}$/.test(expected))throw Error('Missing V2 SHA-256');
  if(!globalThis.crypto?.subtle)throw Error('Cannot verify R2 SHA-256 in this browser');
  const bytes=await response.arrayBuffer();
  const actual=hex(await globalThis.crypto.subtle.digest('SHA-256',bytes));
  if(actual!==expected)throw Error('V2 R2 SHA-256 mismatch: '+desc);
  return bytes;
}
async function decodeFloor(compressed,date,quality){
  if(typeof DecompressionStream==='undefined')
    throw Error('Browser does not support compressed V2 packs');
  const decoded=await new Response(
    new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))
  ).json();
  if(decoded.schema!=='pp-sculpture-v2-floor'||decoded.version!==2||
    decoded.date!==date||decoded.quality!==quality||!decoded.complete||
    decoded.method!=='assembly'||
    decoded.geometryRevision!=='v4.2.1-v2-pigment-island-fix')
    throw Error('V2 prepared floor has an invalid or incomplete manifest');
  if(Object.keys(decoded.studies||{}).length!==decoded.expectedPortraits)
    throw Error('V2 prepared floor portrait count mismatch');
  return decoded;
}
let canonicalCatalog=null;
let canonicalCatalogRequest=null;
export async function getV2R2Catalog({fetcher=fetch}={}){
  // Only cache the real browser fetch. Injected fetchers in tests are isolated.
  const shared=fetcher===fetch;
  if(shared&&canonicalCatalog)return canonicalCatalog;
  if(shared&&canonicalCatalogRequest)return canonicalCatalogRequest;
  const task=(async()=>{
    const response=await fetcher(V2_R2_CATALOG_URL);
    const bytes=await verifiedBytes(response,CATALOG_SHA,'immutable catalog');
    const catalog=JSON.parse(new TextDecoder().decode(bytes));
    if(catalog.schema!=='pp-sculpture-v2-r2-catalog'||catalog.version!==1||
      catalog.release!==V2_RELEASE||catalog.presetId!==V2_PRESET_ID||
      catalog.worker!==R2_ORIGIN||
      Object.keys(catalog.days||{}).length!==CATALOG_DAYS)
      throw Error('Unapproved V2 R2 catalog');
    if(shared)canonicalCatalog=catalog;
    return catalog;
  })();
  if(shared)canonicalCatalogRequest=task;
  try{return await task}
  finally{if(shared&&canonicalCatalogRequest===task)canonicalCatalogRequest=null}
}
const DAILY_V2_PREFIX='/sculptures-v2/daily/'+V2_RELEASE+'/';
const dailyRequests=new Map();
export async function getV2DailyManifest(date,{fetcher=fetch}={}){
  if(!/^20\d\d-\d\d-\d\d$/.test(date)||date<V2_DAILY_FROM)
    throw Error('Invalid daily V2 date');
  const url=R2_ORIGIN+DAILY_V2_PREFIX+date+'/manifest.json';
  const shared=fetcher===fetch;
  if(shared&&dailyRequests.has(date))return dailyRequests.get(date);
  const task=(async()=>{
    const response=await fetcher(url);
    if(!response.ok)throw Error('Daily V2 manifest '+date+' HTTP '+response.status);
    const m=await response.json();
    if(m.schema!=='pp-sculpture-v2-daily-r2-manifest'||
       m.version!==1||m.date!==date||
       m.revision!=='v4.2.1-v2-pigment-island-fix'||
       m.presetId!==V2_PRESET_ID||
       m.worker!==R2_ORIGIN||m.ready!==true||
       m.confluenceExcluded!==true||
       !Number.isInteger(m.portraits)||m.portraits<=0||
       !/^[a-f0-9]{64}$/.test(m.metaSha256||'')||
       !m.qualities||Object.keys(m.qualities).sort().join(',')!=='desktop,mobile')
      throw Error('Unapproved daily V2 manifest');
    for(const quality of ['desktop','mobile']){
      const item=m.qualities[quality];
      if(!item||!/^[a-f0-9]{64}$/.test(item.sha256||'')||
          !Number.isSafeInteger(item.bytes)||item.bytes<1000||
          item.bytes>45*1048576||
          item.url!==R2_ORIGIN+DAILY_V2_PREFIX+date+'/'+quality+'/'+
            item.sha256+'.json.gz')
        throw Error('Daily V2 manifest has invalid '+quality+' link');
    }
    return m;
  })();
  if(shared){
    dailyRequests.set(date,task);
    for(const other of dailyRequests.keys())
      if(other!==date)dailyRequests.delete(other);
  }
  try{return await task}
  catch(error){
    if(shared&&dailyRequests.get(date)===task)dailyRequests.delete(date);
    throw error;
  }
}
async function readR2Pack(date,quality,{fetcher=fetch}={}){
  const isReception=date==='reception';
  const isDaily=!isReception&&date>=V2_DAILY_FROM;
  let spec,portraitCount;
  if(isDaily){
    const daily=await getV2DailyManifest(date,{fetcher});
    spec=daily.qualities[quality];
    portraitCount=daily.portraits;
  }else{
    const catalog=await getV2R2Catalog({fetcher});
    spec=isReception?catalog.reception?.[quality]:
      catalog.days?.[date]?.qualities?.[quality];
    portraitCount=isReception?1:catalog.days?.[date]?.portraits;
  }
  if(!spec)throw Error('R2 catalog does not contain '+date+'/'+quality);
  if(!Number.isSafeInteger(spec.bytes)||spec.bytes<1000||spec.bytes>45*1048576)
    throw Error('Invalid R2 pack size');
  const url=new URL(spec.url);
  const required=isDaily
    ?DAILY_V2_PREFIX+date+'/'+quality+'/'+spec.sha256+'.json.gz'
    :null;
  if(url.origin!==R2_ORIGIN||
     !(isDaily?url.pathname===required:url.pathname.startsWith(R2_PREFIX))||
     !url.pathname.endsWith('.json.gz')||url.search||url.hash)
    throw Error('R2 catalog contains an unexpected pack URL');
  const started=performance.now();
  const response=await fetcher(url.href);
  const bytes=await verifiedBytes(response,spec.sha256,date+'/'+quality);
  if(bytes.byteLength!==spec.bytes)throw Error('V2 R2 pack length mismatch');
  const pack=await decodeFloor(bytes,date,quality);
  if(pack.expectedPortraits!==portraitCount)
    throw Error('V2 R2 catalog portrait count mismatch');
  Object.defineProperty(pack,'__v2Transport',{enumerable:false,value:{
    source:'r2',fallback:false,
    downloadMs:Math.round(performance.now()-started),bytes:bytes.byteLength,sha256:spec.sha256
  }});
  return pack;
}
/** Isolated V2 requires SHA-verified R2. No local Pages mesh path exists. */
export async function downloadV2Prepared(date,quality,{
  fetcher=fetch,mode='r2-only'
}={}){
  if(!(/^\d{4}-\d{2}-\d{2}$/.test(date)||date==='reception')||
      !['mobile','desktop'].includes(quality))
    throw Error('Invalid V2 prepared request');
  // "r2" is a backwards-compatible strict alias for existing test links.
  if(!['r2','r2-only'].includes(mode))
    throw Error('Pages V2 source retired; R2 is required');
  return readR2Pack(date,quality,{fetcher});
}
