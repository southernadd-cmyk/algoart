#!/usr/bin/env node
// Opt-in artifact cleanup, only AFTER verified R2 publication and activation.
// Deletes exactly the new date's originals, desktop/mobile derivatives and cover.
// Never touches historical editions, code or archived metadata.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

const date=process.env.R2_EDITION_DATE;
const stage=process.env.R2_STAGE_OUTPUT;
const root=path.resolve(process.env.R2_STAGE_SOURCE||'.');
if(process.env.R2_ART_ONLY!=='true'||!/^20\d{2}-\d{2}-\d{2}$/.test(date||'')||
   !stage)throw Error('R2-only cleanup requires explicit date, stage, and opt-in');
const prefix='gallery/'+date+'/';
const base=path.join(root,'gallery',date);
const raw=await fs.readFile(path.join(stage,'media-publication.json'));
const manifest=JSON.parse(raw);
const verification=JSON.parse(await fs.readFile(path.join(stage,'upload-verification.json'),'utf8'));
const digest=b=>createHash('sha256').update(b).digest('hex');
if(manifest.date!==date||manifest.stageOnly!==true||
   manifest.pagesFallback!==false||manifest.published!==false||
   verification.date!==date||verification.manifestSha256!==digest(raw)||
   verification.verified!==manifest.mediaAssets?.length ||
   manifest.mediaAssets.length!==manifest.count*3+1)
  throw Error('Cannot prune before complete verified R2 publication');

const sources=new Set();
for(const asset of manifest.mediaAssets){
  if(!['original','desktop','mobile','cover'].includes(asset.role))
    throw Error('Unsupported R2-only media role');
  const source=asset.sourcePath;
  if(typeof source!=='string'||!source.startsWith(prefix)||
     !/^[-\w./]+$/.test(source)||source.includes('..'))
    throw Error('Unsafe source path: '+source);
  const relative=source.slice(prefix.length);
  if(relative.startsWith('/')||!relative||relative.split('/').some(part=>!part||part==='.'||part==='..'))
    throw Error('Unsafe source name');
  if(sources.has(source))throw Error('Duplicate media source: '+source);
  sources.add(source);
  const bytes=await fs.readFile(path.join(root,source));
  if(digest(bytes)!==asset.sha256||bytes.length!==asset.bytes)
    throw Error('Original source no longer matches published R2 bytes: '+source);
}
const meta=JSON.parse(await fs.readFile(path.join(base,'meta.json'),'utf8'));
if(meta.date!==date||meta.entries?.length!==manifest.count||
   meta.entries.some(entry=>!sources.has(prefix+entry.imageFile)||!entry.media?.original))
  throw Error('Staged artwork metadata is not R2-ready');
const page=await fs.readFile(path.join(base,'index.html'),'utf8');
for(const entry of meta.entries){
  if(!page.includes('src="'+entry.media.original+'"'))
    throw Error('Gallery page still needs a local painting: '+entry.imageFile);
}
if(page.includes('this.onerror=null;this.src='))
  throw Error('Gallery still contains a GitHub image fallback');
// All files verified before first deletion. Require explicit execution only.
for(const source of sources)await fs.unlink(path.join(root,source));
for(const source of sources){
  try{await fs.stat(path.join(root,source));throw Error('Failed to prune '+source)}
  catch(e){if(e.code!=='ENOENT')throw e}
}
console.log('R2_ART_ONLY_PRUNE_OK '+JSON.stringify({date,removed:sources.size,
  allMediaVerified:true,metadataPreserved:true}));
