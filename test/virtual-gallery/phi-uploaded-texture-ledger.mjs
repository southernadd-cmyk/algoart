// TEST ONLY. An upload is reusable only while the SAME texture object, image
// source and renderer state remain valid. Avoid retaining Texture references:
// WeakMaps do not prevent GPU resources from being garbage collected.
// A texture disposed and later reused must be uploaded again, even if its
// version number has not changed. Mark only after a successful upload.
export function createPhiUploadedTextureLedger(){
 let uploaded=new WeakMap();
 const listeners=new WeakSet();
 const counters={marks:0,cacheHits:0,versionInvalidations:0,disposalInvalidations:0,contextInvalidations:0};
 const version=texture=>Number.isFinite(texture?.version)?texture.version:0;
 const sourceVersion=texture=>Number.isFinite(texture?.source?.version)?texture.source.version:0;
 const valid=texture=>texture&&typeof texture==='object'&&
  (typeof texture.addEventListener==='function' || texture.isTexture);
 const mark=texture=>{
  if(!valid(texture))return false;
  uploaded.set(texture,{version:version(texture),sourceVersion:sourceVersion(texture)});
  counters.marks++;
  if(!listeners.has(texture)&&typeof texture.addEventListener==='function'){
   listeners.add(texture);
   texture.addEventListener('dispose',()=>{
    uploaded.delete(texture);
    counters.disposalInvalidations++;
   });
  }
  return true;
 };
 const has=texture=>{
  if(!valid(texture))return false;
  const entry=uploaded.get(texture);
  if(!entry)return false;
  if(entry.version!==version(texture)||entry.sourceVersion!==sourceVersion(texture)){
   uploaded.delete(texture);counters.versionInvalidations++;return false;
  }
  counters.cacheHits++;return true;
 };
 const invalidateAll=()=>{uploaded=new WeakMap();counters.contextInvalidations++;};
 const stats=()=>({...counters});
 return {mark,has,invalidateAll,stats};
}
