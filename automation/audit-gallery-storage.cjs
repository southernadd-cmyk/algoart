#!/usr/bin/env node
'use strict';
// Read-only release A audit. Outputs only to .git/archive-storage-audit.
// Does NOT perform external backups, rewrite files, publish or change branches.
const fs=require('node:fs');
const fsp=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const git=(args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const sha=git(['rev-parse','HEAD']);
const storageRoot=path.resolve(root,git(['rev-parse','--git-path','archive-storage-audit']));
const out=path.resolve(process.env.STORAGE_AUDIT_DIR||path.join(storageRoot,sha.slice(0,12)));
const paths=execFileSync('git',['ls-files','-z','--','gallery'],{cwd:root})
  .toString('utf8').split('\0').filter(Boolean).sort();
const all=new Set(paths);
const media=/\.(?:jpg|jpeg|png|webp|ktx2|basis|avif|gif)$/i;
const datePath=/^gallery\/(\d{4}-\d{2}-\d{2})\//;
const errors=[],warnings=[],refs=[],files=[],days={};
function note(type,data,serious=true){(serious?errors:warnings).push({type,...data});}
async function hashFile(filename){
 return new Promise((resolve,reject)=>{
  const hash=crypto.createHash('sha256'),stream=fs.createReadStream(path.join(root,filename));
  stream.on('data',data=>hash.update(data));
  stream.on('error',reject);
  stream.on('end',()=>resolve(hash.digest('hex')));
 });
}
async function readJson(name){
 try{return JSON.parse(await fsp.readFile(path.join(root,name),'utf8'));}
 catch(e){note('cannot-read-json',{name,error:e.message});return null;}
}
function imageRef(date,value){
 if(typeof value!=='string'||!value)return {type:'invalid',value};
 if(/^https?:\/\//.test(value)){
  try{
   const u=new URL(value),prefix='/southernadd-cmyk/algoart/releases/download/';
   if(u.hostname==='github.com'&&u.pathname.startsWith(prefix))
    return {type:'release-url',value,local:'gallery/release-art/'+decodeURIComponent(u.pathname.split('/').pop())};
   return {type:'external-url',value};
  }catch{return {type:'invalid',value};}
 }
 if(path.posix.basename(value)!==value)return {type:'invalid',value};
 return {type:'local',value,local:'gallery/'+date+'/'+value};
}
async function inspect(date){
 const prefix='gallery/'+date+'/',meta=await readJson(prefix+'meta.json');
 if(!meta||!Array.isArray(meta.entries)||!meta.entries.length){note('invalid-edition',{date});return;}
 const ids=new Set();
 const day={count:meta.entries.length,portrait:0,landscape:0,confluence:0,originals:0,missing:0,releaseReferences:0,textures:0};
 if(meta.date!==date)note('date-mismatch',{date,recorded:meta.date});
 if(meta.count!==undefined&&meta.count!==meta.entries.length)
  note('count-mismatch',{date,actual:meta.entries.length,declared:meta.count});
 for(const entry of meta.entries){
  if(!entry.id||ids.has(entry.id))note('duplicate-id',{date,id:entry.id});
  ids.add(entry.id);
  if(entry.orientation==='portrait')day.portrait++;
  if(entry.orientation==='landscape')day.landscape++;
  if(entry.material==='confluence'){
   day.confluence++;
   try{if(!new URL(entry.shareUrl).searchParams.has('s'))note('confluence-share-state-missing',{date,id:entry.id});}
   catch{note('confluence-link-invalid',{date,id:entry.id});}
  }
  if(!entry.settings||!entry.seed||!entry.rendererVersion||!entry.shareUrl)
   note('incomplete-metadata',{date,id:entry.id});
  const ref=imageRef(date,entry.imageFile);
  refs.push({date,id:entry.id,source:'meta.json',...ref});
  if(ref.type==='release-url')day.releaseReferences++;
  if(ref.type==='invalid')note('invalid-image-ref',{date,id:entry.id,ref});
  if(ref.local){day.originals++;if(!all.has(ref.local)){
   day.missing++;note('image-not-in-tracked-tree',{date,id:entry.id,ref});
  }}
 }
 const texturePath=prefix+'3d/manifest.json';
 if(all.has(texturePath)){
  const manifest=await readJson(texturePath);
  for(const [name,variants] of Object.entries(manifest?.images||{}))
   for(const key of ['desktop','mobile'])if(variants[key]){
    const destination=prefix+variants[key];
    if(!all.has(destination))note('missing-texture',{date,name,key,destination});
    else day.textures++;
   }
 }else note('missing-texture-manifest',{date},false);
 const socialPath=prefix+'social-meta.json';
 if(all.has(socialPath)){
  const metaSocial=await readJson(socialPath);
  for(const item of metaSocial?.entries||[]){
   const ref=imageRef(date,item.imageFile);
   refs.push({date,id:item.id,source:'social-meta.json',...ref});
   if(ref.local&&!all.has(ref.local))note('missing-social-image',{date,id:item.id,ref});
  }
 }
 if(!all.has(prefix+'3d/sculptures.json.gz'))note('missing-sculpture-pack',{date},false);
 days[date]=day;
}
async function main(){
 for(const name of paths){
  const stat=await fsp.stat(path.join(root,name));
  if(!stat.isFile())continue;
  const category=datePath.test(name)?'dated-archive':
   name.startsWith('gallery/release-art/')?'release-mirror':
   name.startsWith('gallery/visit/')?'3d-runtime':'other-gallery';
  files.push({path:name,bytes:stat.size,sha256:await hashFile(name),category,media:media.test(name)});
 }
 const dates=[...new Set(paths.map(x=>x.match(datePath)?.[1]).filter(Boolean))].sort();
 for(const date of dates)await inspect(date);
 const categories={};
 for(const x of files){
  const c=categories[x.category]||(categories[x.category]={files:0,bytes:0,mediaFiles:0,mediaBytes:0});
  c.files++;c.bytes+=x.bytes;
  if(x.media){c.mediaFiles++;c.mediaBytes+=x.bytes;}
 }
 const output={
  schemaVersion:1,commit:sha,repository:'southernadd-cmyk/algoart',
  generatedAt:new Date().toISOString(),dates,days,categories,files,refs,errors,warnings,
  notice:'Byte SHA-256 values are from the local checkout. NOT an independent backup. Remote Release and KV assets require separate audits.'
 };
 await fsp.mkdir(out,{recursive:true});
 await fsp.writeFile(path.join(out,'inventory.json'),JSON.stringify(output,null,2)+'\n');
 await fsp.writeFile(path.join(out,'gallery.sha256'),
  files.map(x=>x.sha256+'  '+x.path).join('\n')+'\n');
 const summary=[
  '# Gallery archive — verified local checkout inventory',
  '', 'Commit: '+sha, 'Date directories: '+dates.length,
  'Tracked gallery files: '+files.length,
  'Gallery bytes: '+files.reduce((s,x)=>s+x.bytes,0),
  'Errors: '+errors.length,'Warnings: '+warnings.length,'',
  '## Categories',...Object.entries(categories).map(([k,v])=>'- '+k+': '+JSON.stringify(v)),
  '', '## Errors',...errors.map(x=>'- '+JSON.stringify(x)),
  '', '## Warnings',...warnings.map(x=>'- '+JSON.stringify(x)),
  '', '## Known limits',
  '- This is an inventory, not a backup or a recovery drill.',
  '- No external GitHub Release or Cloudflare Workers KV contents are downloaded.',
  '- Untracked files, historical Git objects and storage-account state are not captured.'
 ];
 await fsp.writeFile(path.join(out,'SUMMARY.md'),summary.join('\n')+'\n');
 console.log('Read-only gallery inventory:',out);
 console.log('Commit:',sha,'dates:',dates.length,'files:',files.length,
  'errors:',errors.length,'warnings:',warnings.length);
 if(errors.length)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=2;});
