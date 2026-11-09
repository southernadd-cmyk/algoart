#!/usr/bin/env node
'use strict';
// Read-only migration proposal. NEVER a publication or R2 upload job.
// Inputs: verified local SHA-256 inventory and existing v1 daily metadata.
// Output: isolated v2 manifest previews under STORAGE_AUDIT_DIR.
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const output=process.env.STORAGE_AUDIT_DIR;
if(!output)throw new Error('STORAGE_AUDIT_DIR must point outside the published site');
function hex(input){return crypto.createHash('sha256').update(input).digest('hex');}
function contentType(filename){
 const ext=path.extname(filename).toLowerCase();
 return {'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png',
  '.webp':'image/webp','.gz':'application/gzip'}[ext]||'application/octet-stream';
}
function mediaFile(files,name,role,id){
 const f=files.get(name);
 if(!f)throw new Error('Missing media for '+id+' / '+role+': '+name);
 if(!/^[a-f0-9]{64}$/.test(f.sha256)||!Number.isSafeInteger(f.bytes)||f.bytes<=0)
  throw new Error('Invalid checksum or size for '+name);
 const ext=path.extname(name).toLowerCase();
 // A content-addressed proposed R2 key: immutable by construction.
 return {role,originalPath:name,sha256:f.sha256,bytes:f.bytes,contentType:contentType(name),
  proposedStorageKey:'editions/'+id+'/'+role+'-'+f.sha256+ext,
  dimensions:null}; // Dimensions MUST be measured before live publication.
}
function sourceImagePath(date,imageFile){
 if(typeof imageFile!=='string'||!imageFile)throw new Error('Missing source imageFile');
 if(imageFile.startsWith('https://')){
  const u=new URL(imageFile);
  const expected='/southernadd-cmyk/algoart/releases/download/';
  if(u.hostname!=='github.com'||!u.pathname.startsWith(expected))
   throw new Error('Unapproved legacy image URL '+imageFile);
  return 'gallery/release-art/'+decodeURIComponent(u.pathname.split('/').pop());
 }
 if(path.posix.basename(imageFile)!==imageFile||imageFile.includes('\\'))
  throw new Error('Unsafe imageFile '+imageFile);
 return 'gallery/'+date+'/'+imageFile;
}
function fullConfluenceState(item){
 if(item.material!=='confluence')return null;
 const url=new URL(item.shareUrl);
 const encoded=url.searchParams.get('s');
 if(!encoded)throw new Error('Confluence missing shared composition state: '+item.id);
 const raw=Buffer.from(encoded,'base64url').toString('utf8');
 const state=JSON.parse(raw);
 if(!Array.isArray(state.artists)||state.artists.length!==3||
    state.artists.some(a=>!a.system||!a.material||!a.palette||!a.settings))
  throw new Error('Confluence artist state incomplete: '+item.id);
 if(state.seed!==item.seed)throw new Error('Confluence seed mismatch: '+item.id);
 return {state,sha256:hex(raw),encoding:'base64url-json'};
}
async function main(){
 const inventory=JSON.parse(await fs.readFile(path.join(output,'inventory.json'),'utf8'));
 if(inventory.errors.length)throw new Error('Gallery inventory has errors');
 const files=new Map(inventory.files.map(x=>[x.path,x]));
 const dates=inventory.dates;
 const proposals=[],stats={dates:0,artworks:0,confluence:0,variants:0,missingSculptures:0};
 const proposedKeys=new Map();
 for(const date of dates){
  const meta=JSON.parse(await fs.readFile(path.join(root,'gallery',date,'meta.json'),'utf8'));
  const tex=JSON.parse(await fs.readFile(path.join(root,'gallery',date,'3d','manifest.json'),'utf8'));
  if(meta.date!==date||!Array.isArray(meta.entries)||meta.entries.length===0||
     meta.count!==meta.entries.length)throw new Error('Invalid edition '+date);
  const idSet=new Set();
  const entries=[];
  for(const item of meta.entries){
   if(!item.id||idSet.has(item.id)||!/^[-\w]+$/.test(item.id))
    throw new Error('Duplicate or unsafe artwork id '+date+' '+item.id);
   idSet.add(item.id);
   if(!item.seed||!item.settings||!item.shareUrl||!item.rendererVersion)
    throw new Error('Incomplete original artwork metadata '+date+' '+item.id);
   const originalPath=sourceImagePath(date,item.imageFile);
   const original=mediaFile(files,originalPath,'original',date+'/'+item.id);
   const basename=path.posix.basename(originalPath);
   const versions=tex.images?.[basename]||{};
   const derivatives={};
   for(const size of ['mobile','desktop']){
    if(versions[size]){
     const variant='gallery/'+date+'/'+versions[size];
     derivatives[size]=mediaFile(files,variant,size,date+'/'+item.id);
     stats.variants++;
    }
   }
   const state=fullConfluenceState(item);
   if(state)stats.confluence++;
   entries.push({
    ...item, // Retain EVERY published field, ID, original URL and renderer revision.
    storageProposal:{original,derivatives,
      confluence:state,
      publicAssetUrl:null,
      verifiedForLive:false}
   });
   stats.artworks++;
  }
  const coverPath='gallery/'+date+'/archive-preview.jpg';
  const cover=files.has(coverPath)?mediaFile(files,coverPath,'cover',date):null;
  const sculpturePath='gallery/'+date+'/3d/sculptures.json.gz';
  const sculptures=files.has(sculpturePath)?mediaFile(files,sculpturePath,'sculptures',date):null;
  if(!sculptures)stats.missingSculptures++;
  const proposal={
   schemaVersion:2,proposalOnly:true,readyForPublication:false,
   date,count:meta.count,series:meta.series,entries,
   assets:{cover,sculptures},
   legacyMetadataSource:'gallery/'+date+'/meta.json',
   note:'This is an uncommitted planning artifact, NOT a live manifest; public links are unchanged.'
  };
  for(const entry of entries){
   for(const media of [entry.storageProposal.original,
       ...Object.values(entry.storageProposal.derivatives)]){
    const previous=proposedKeys.get(media.proposedStorageKey);
    if(previous&&previous!==media.sha256)
     throw new Error('Colliding proposed storage key: '+media.proposedStorageKey);
    proposedKeys.set(media.proposedStorageKey,media.sha256);
   }
  }
  proposals.push(proposal);
  stats.dates++;
 }
 const target=path.join(output,'proposed-manifests');
 await fs.mkdir(target,{recursive:true});
 for(const proposal of proposals)
  await fs.writeFile(path.join(target,proposal.date+'.json'),
   JSON.stringify(proposal,null,2)+'\n');
 await fs.writeFile(path.join(output,'MANIFEST-PROPOSALS-SUMMARY.md'),[
  '# Version 2 archive proposal — NO publication',
  '',
  '- Dates: '+stats.dates,
  '- Artwork records: '+stats.artworks,
  '- Confluence artworks in frozen baseline: '+stats.confluence,
  '- Optimized texture variants: '+stats.variants,
  '- Dates with no sculpture pack: '+stats.missingSculptures,
  '- All original entries and share URLs are preserved unmodified.',
  '- Every media record has independently SHA-256-hashed source bytes.',
  '- Image dimensions have NOT been measured; all manifests are marked unpublished.',
  '- Confluence state decoding is enforced for any Confluence entry.',
  '- No files in gallery/ were changed and no R2 objects were uploaded.'
 ].join('\n')+'\n');
 console.log('V2 proposals:',JSON.stringify(stats));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
