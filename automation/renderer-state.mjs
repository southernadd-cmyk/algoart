import fs from 'node:fs/promises';
import path from 'node:path';

export const CURRENT_SOCIAL_RENDERER_VERSION=7;
export function socialRendererVersion(value=process.env.SOCIAL_RENDERER_VERSION){
  const version=Number(value||CURRENT_SOCIAL_RENDERER_VERSION);
  if(!Number.isInteger(version)||version<1||version>CURRENT_SOCIAL_RENDERER_VERSION){
    throw new Error('Unsupported social renderer version: '+value);
  }
  return version;
}

// A published day's archive is authoritative. Never replace its image or
// exact state just because the default renderer changed between posting slots.
export async function archivedLandscapeStudy(day,index,{galleryRoot='gallery'}={}){
  const dir=path.resolve(galleryRoot,day);
  let archive;
  try{archive=JSON.parse(await fs.readFile(path.join(dir,'meta.json'),'utf8'));}
  catch(error){if(error.code==='ENOENT')return null;throw error;}
  const id=day+'-'+String(index+1).padStart(2,'0');
  const entry=archive.entries.find(item=>item.id===id&&(item.orientation||item.settings?.orientation||'landscape')==='landscape');
  if(!entry)return null;
  if(!entry.settings||!entry.shareUrl||!entry.rendererVersion)throw new Error('Incomplete archived artwork: '+id);
  const imagePath=path.join(dir,entry.imageFile);
  await fs.access(imagePath); // Fail rather than silently replace a missing archive image.
  return {entry,imagePath};
}
