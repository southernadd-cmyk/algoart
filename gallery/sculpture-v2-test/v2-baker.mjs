// Sculpture V2 mesh baker — isolated and pinned to the artist-approved renderer.
// No WebGL is required. This constructs the identical 108×152-source geometry
// that the V2 test tower used, then serializes only reusable meshes/metadata.
import * as THREE from 'three';
import {segmentPainting} from './engine/v4-topology.mjs';
import {buildV4Sculpture,disposeV4Sculpture} from './engine/v4-surface.mjs';
import {resolveStudyMaterial} from '../visit/study-material.mjs';

const SCALE={position:100000,normal:10000,uv:100000};
const quantize=(attr,scale)=>{
  if(!attr)return null;
  const out=new Array(attr.count*attr.itemSize);
  for(let i=0;i<attr.count;i++)for(let k=0;k<attr.itemSize;k++){
    const n=attr.array[i*attr.itemSize+k]*scale;
    if(!Number.isFinite(n))throw Error('Sculpture mesh contains non-finite coordinates');
    out[i*attr.itemSize+k]=Math.round(n);
  }
  return out;
};
const pictureUrl=(date,name)=>new URL('../'+date+'/'+name.split('/').map(encodeURIComponent).join('/'),location.href).href;
async function imageFromArchive(url){
  const image=new Image();
  image.crossOrigin='anonymous';
  image.decoding='async';
  await new Promise((resolve,reject)=>{
    image.onload=resolve;
    image.onerror=()=>reject(Error('Could not load source painting '+url));
    image.src=url;
  });
  return image;
}
function samplePixels(image){
  const canvas=document.createElement('canvas');
  canvas.width=108;canvas.height=152;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(!ctx)throw Error('Canvas image sampling unavailable');
  ctx.drawImage(image,0,0,108,152);
  return ctx.getImageData(0,0,108,152);
}
function bumpData(field){
  // The full painting texture stays in the existing gallery archive.
  // Only the 108×152 density field is stored as a compact grayscale map.
  const bytes=new Uint8Array(field.length);
  for(let i=0;i<field.length;i++)
    bytes[i]=Math.round(Math.max(0,Math.min(1,field[i]))*255);
  let binary='';
  for(let i=0;i<bytes.length;i+=4096)
    binary+=String.fromCharCode(...bytes.subarray(i,i+4096));
  return btoa(binary);
}
function paintDescriptor(material,texture,bumpTexture){
  return{
    color:'#'+material.color.getHexString(),
    roughness:material.roughness,
    metalness:material.metalness,
    opacity:material.opacity,
    transparent:material.transparent,
    side:material.side,
    map:material.map===texture?'source':null,
    bumpMap:material.bumpMap===bumpTexture?'ink':null,
    bumpScale:material.bumpScale||0
  };
}
function encodeMesh(mesh,texture,bumpTexture){
  const geometry=mesh.geometry;
  const p=geometry.getAttribute('position');
  const normals=geometry.getAttribute('normal');
  const uv=geometry.getAttribute('uv');
  if(!p||!normals||!uv||!geometry.index)
    throw Error('V2 mesh lacks indexed positions, normals or UVs');
  if(p.count<3||geometry.index.count<3||geometry.index.count%3)
    throw Error('V2 mesh contains no valid indexed triangles');
  const indices=Array.from(geometry.index.array);
  if(indices.some(i=>!Number.isInteger(i)||i<0||i>=p.count))
    throw Error('V2 mesh index refers outside vertex buffer');
  const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  return{
    name:mesh.name,
    regionId:Number.isInteger(mesh.userData?.regionId)?mesh.userData.regionId:null,
    geometry:{
      position:quantize(p,SCALE.position),
      normal:quantize(normals,SCALE.normal),
      uv:quantize(uv,SCALE.uv),
      index:indices,
      groups:(geometry.groups.length?geometry.groups:[{
        start:0,count:geometry.index.count,materialIndex:0
      }]).map(g=>({start:g.start,count:g.count,materialIndex:g.materialIndex}))
    },
    materials:materials.map(m=>paintDescriptor(m,texture,bumpTexture)),
    position:mesh.position.toArray(),
    rotation:[mesh.rotation.x,mesh.rotation.y,mesh.rotation.z],
    scale:mesh.scale.toArray(),
    castShadow:mesh.castShadow,
    receiveShadow:mesh.receiveShadow
  };
}
export async function bakeV2Study({item,date,quality='desktop',method='assembly'}={}){
  const reception=item?.receptionOnly===true;
  if(!(reception?date==='reception':/^\d{4}-\d{2}-\d{2}$/.test(date||'')))
    throw Error('Invalid V2 study date');
  if(!['desktop','mobile'].includes(quality))throw Error('Invalid quality');
  if(method!=='assembly')throw Error('V2 historical packs are pinned to assembly');
  if(item.material==='confluence')throw Error('Confluence excluded from V2 sculpture bake');
  if(item.orientation!=='portrait')throw Error('Only solo portrait paintings become sculptures');
  if(!item.imageFile||!item.seed)throw Error('Invalid archived study metadata');
  if(reception&&(item.imageFile!=='reception-growth-systems.png'||
     item.material!=='oil'||item.seed!=='AA-20261005-03-55769'))
    throw Error('Reception source must use the approved original study');
  const sourceFile=item.sourceFile||item.imageFile;
  const sourceUrl=reception
    ?new URL('../visit/data/reception-growth-systems.png',location.href).href
    :pictureUrl(date,sourceFile);
  const image=await imageFromArchive(sourceUrl);
  const pixels=samplePixels(image);
  const profile=resolveStudyMaterial(item.shareUrl||'',item.material||'marker');
  const material=profile.type||'marker';
  const paper=profile.params?.paper||'#f5f0e6';
  const topology=segmentPainting(pixels,{
    material,paper,maxRegions:quality==='desktop'?72:48
  });
  if(!topology.regions.length)throw Error('No source pigment regions: '+item.imageFile);
  if(topology.omittedCells!==0)
    throw Error('Unrepresented pigment cells: '+item.imageFile+' '+topology.omittedCells);
  const texture=new THREE.Texture(image);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.needsUpdate=true;
  const grayscale=bumpData(topology.pigmentInk);
  const colors=new Uint8Array(topology.width*topology.height*4);
  for(let i=0;i<topology.pigmentInk.length;i++){
    const n=Math.round(Math.min(1,Math.max(0,topology.pigmentInk[i]))*255);
    const at=i*4;colors[at]=colors[at+1]=colors[at+2]=n;colors[at+3]=255;
  }
  const bumpTexture=new THREE.DataTexture(colors,
    topology.width,topology.height,THREE.RGBAFormat);
  bumpTexture.colorSpace=THREE.NoColorSpace;
  bumpTexture.flipY=true;
  bumpTexture.needsUpdate=true;
  let sculpture=null;
  try{
    try{
      sculpture=buildV4Sculpture(method,{
        topology,texture,bumpTexture,material,paper,
        quality,depth:.85,phiPull:.8,fidelity:.9,connection:.65,strokes:[]
      });
    }catch(error){
      throw Error('V2 geometry '+date+'/'+item.imageFile+'/'+quality+
        ': '+error.message,{cause:error});
    }
    if(sculpture.userData.omittedCells!==0)
      throw Error('V2 geometry failed source coverage: '+item.imageFile);
    const meshes=[];
    sculpture.traverse(o=>{
      if(o.isMesh)meshes.push(encodeMesh(o,texture,bumpTexture));
    });
    if(meshes.length<topology.regions.length)
      throw Error('Region mesh count less than actual pigment regions');
    const box=new THREE.Box3().setFromObject(sculpture);
    const dimensions=box.getSize(new THREE.Vector3()).toArray();
    if(dimensions.some(v=>!Number.isFinite(v)||v<=0))
      throw Error('Invalid V2 model dimensions');
    const result={
      schema:'pp-sculpture-v2-study',
      version:2,
      geometryRevision:'v4.2.1-v2-pigment-island-fix',
      imageFile:item.imageFile,
      sourceFile,
      seed:item.seed,
      method,
      material,
      quality,
      regionCount:topology.regions.length,
      groupedSmallIslands:topology.groupedSmallIslands||0,
      pixelFallbackRegions:sculpture.userData.pixelFallbackRegions||0,
      omittedCells:topology.omittedCells,
      coverage:topology.covered/Math.max(1,topology.pigmented),
      triangleCount:meshes.reduce((n,m)=>n+m.geometry.index.length/3,0),
      dimensions,
      quantization:SCALE,
      ink:{width:topology.width,height:topology.height,format:'l8-base64',data:grayscale},
      meshes
    };
    if(result.coverage!==1)throw Error('Incomplete source pigment coverage');
    return result;
  }finally{
    if(sculpture)disposeV4Sculpture(sculpture);
    texture.dispose();bumpTexture.dispose();
  }
}
if(typeof window!=='undefined'){
  window.bakeV2Study=bakeV2Study;
  window.bakeV2Ready=true;
}
