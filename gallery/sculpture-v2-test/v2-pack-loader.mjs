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
export async function downloadV2Floor(date,quality,{
  fetcher=fetch,base=new URL('../',location.href).pathname,allowReception=false
}={}){
  if(!(allowReception&&date==='reception')&&
     !/^\d{4}-\d{2}-\d{2}$/.test(date)||!['mobile','desktop'].includes(quality))
    throw Error('Invalid V2 floor request');
  const url=base+(date==='reception'?'':date+'/3d/v2/')+
    'sculptures.'+quality+'.json.gz';
  const response=await fetcher(url);
  if(!response.ok)throw Error('V2 prepared floor '+date+'/'+quality+
    ' not available: HTTP '+response.status);
  if(typeof DecompressionStream==='undefined')
    throw Error('Browser does not support compressed V2 floor packs');
  const compressed=await response.blob();
  const decoded=await new Response(
    compressed.stream().pipeThrough(new DecompressionStream('gzip'))
  ).json();
  if(decoded.schema!=='pp-sculpture-v2-floor'||decoded.version!==2||
    decoded.date!==date||decoded.quality!==quality||!decoded.complete)
    throw Error('V2 prepared floor has an invalid or incomplete manifest');
  if(Object.keys(decoded.studies||{}).length!==decoded.expectedPortraits)
    throw Error('V2 prepared floor portrait count mismatch');
  return decoded;
}

export function downloadV2Reception(quality,{fetcher=fetch}={}){
  const base=new URL('../',location.href).pathname+
    'sculpture-v2-test/reception/';
  return downloadV2Floor('reception',quality,{
    fetcher,base,allowReception:true
  });
}
