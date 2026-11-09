#!/usr/bin/env node
'use strict';
// Read-only inventory of GitHub Releases used by PROPORTION PIECE.
// No downloads, uploads, release mutations or secret-value logging.
const fs=require('node:fs/promises');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const repo=process.env.GITHUB_REPOSITORY||'southernadd-cmyk/algoart';
const out=process.env.STORAGE_AUDIT_DIR;
if(!out)throw new Error('Set STORAGE_AUDIT_DIR to an external CI workspace');
if(!/^[-\w]+\/[-\w.]+$/.test(repo))throw new Error('Invalid repository id');
if(!process.env.GH_TOKEN)throw new Error('GH_TOKEN required (read-only contents permission)');
function gh(url){
 const data=execFileSync('gh',['api','--method','GET',url],{
  cwd:root,encoding:'utf8',maxBuffer:24*1024*1024,timeout:60000});
 return JSON.parse(data);
}
function pages(route){
 let all=[];
 for(let page=1;page<100;page++){
  const list=gh(route+(route.includes('?')?'&':'?')+'per_page=100&page='+page);
  if(!Array.isArray(list))throw new Error('API did not return array: '+route);
  all.push(...list);
  if(list.length<100)return all;
 }
 throw new Error('Exceeded pagination limit for '+route);
}
const exts={};
function ext(name){const m=name.match(/\.([a-z0-9]+)$/i);return m?m[1].toLowerCase():'none';}
function reportCategory(asset){
 const e=ext(asset.name);
 if(['jpg','jpeg','png','webp','gif','avif','ktx2'].includes(e))return 'image';
 if(['zip','tar','gz','7z'].includes(e))return 'archive';
 if(e==='txt'&&/^done-/.test(asset.name))return 'completion-marker';
 return 'other';
}
async function main(){
 const releaseData=pages('repos/'+repo+'/releases').map(r=>({id:r.id,tag:r.tag_name,date:r.published_at}));
 const releases=[],assets=[],lookup=new Set();
 for(const release of releaseData){
  const raw=pages('repos/'+repo+'/releases/'+release.id+'/assets');
  const summary={...release,assetCount:raw.length,bytes:0,categories:{},extensions:{}};
  for(const x of raw){
   const category=reportCategory(x);
   const item={release:release.tag,id:x.id,name:x.name,size:x.size,
    digest:x.digest||null,created_at:x.created_at,updated_at:x.updated_at,
    content_type:x.content_type,download_url:x.browser_download_url,category};
   assets.push(item);
   lookup.add(release.tag+'/'+x.name);
   summary.bytes+=x.size;
   const c=summary.categories[category]||(summary.categories[category]={count:0,bytes:0});
   c.count++;c.bytes+=x.size;
   const extension=ext(x.name);
   summary.extensions[extension]=(summary.extensions[extension]||0)+1;
  }
  releases.push(summary);
 }
 const galleryRoot=path.join(root,'gallery');
 const dirs=(await fs.readdir(galleryRoot,{withFileTypes:true}))
  .filter(x=>x.isDirectory()&&/^\d{4}-\d{2}-\d{2}$/.test(x.name)).map(x=>x.name).sort();
 const releaseRefs=[],missing=[];
 for(const day of dirs){
  for(const name of ['meta.json','social-meta.json']){
   let data;
   try{data=JSON.parse(await fs.readFile(path.join(galleryRoot,day,name),'utf8'));}
   catch(e){if(e.code==='ENOENT')continue;throw e;}
   for(const entry of data.entries||[]){
    const image=entry.imageFile;
    if(typeof image!=='string'||!image.startsWith('https://github.com/'))continue;
    const url=new URL(image),parts=url.pathname.split('/').filter(Boolean);
    if(parts[0]!=='southernadd-cmyk'||parts[1]!=='algoart'||
      parts[2]!=='releases'||parts[3]!=='download')continue;
    const key=decodeURIComponent(parts[4])+'/'+decodeURIComponent(parts.slice(5).join('/'));
    const item={date:day,id:entry.id,source:name,key,url:image,found:lookup.has(key)};
    releaseRefs.push(item);
    if(!item.found)missing.push(item);
   }
  }
 }
 const output={schemaVersion:1,generatedAt:new Date().toISOString(),repo,
  releaseCount:releases.length,totalAssets:assets.length,
  totalBytes:assets.reduce((s,a)=>s+a.size,0),releases,assets,
  releaseRefs,missing,
  notice:'Read-only Release metadata only; remote file bytes not downloaded or SHA-256 verified. Cloudflare KV requires separate credentials and inventory.'};
 await fs.mkdir(out,{recursive:true});
 await fs.writeFile(path.join(out,'releases.json'),JSON.stringify(output,null,2)+'\n');
 const summary=[
  '# Public GitHub Releases — read-only asset inventory',
  '',
  '- Releases: '+releases.length,
  '- Asset metadata entries: '+assets.length,
  '- Reported bytes: '+output.totalBytes,
  '- Dated gallery Release references: '+releaseRefs.length,
  '- Missing referenced assets: '+missing.length,
  ...releases.map(x=>'- '+x.tag+': '+x.assetCount+' assets / '+x.bytes+' bytes, '+JSON.stringify(x.categories)),
  '', 'Missing references:',...(missing.length?missing.map(x=>'- '+JSON.stringify(x)):['None']),
  '',
  'This is NOT an independent offsite backup, and no remote binary content was hashed.',
  'Cloudflare social-preview KV is not part of these GitHub Releases.'
 ];
 await fs.writeFile(path.join(out,'RELEASES-SUMMARY.md'),summary.join('\n')+'\n');
 console.log('External release inventory:',releases.length,'releases /',assets.length,'assets /',
  output.totalBytes,'bytes; referenced:',releaseRefs.length,'missing:',missing.length);
 if(missing.length)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=2;});
