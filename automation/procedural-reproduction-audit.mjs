#!/usr/bin/env node
// Read-only preservation audit. NEVER uploads, rewrites, or deletes published art.
// Usage: node automation/procedural-reproduction-audit.mjs --inventory|--pilot|--all
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {chromium} from 'playwright';

const mode=process.argv.find(arg=>['--inventory','--pilot','--all'].includes(arg));
if(!mode)throw Error('Choose --inventory, --pilot, or --all');
const root=path.resolve(process.env.AUDIT_SOURCE_DIR||'.');
const output=path.resolve(process.env.AUDIT_REPORT_DIR||'procedural-reproduction-report');
const base=process.env.AUDIT_LOCAL_URL||'http://127.0.0.1:4173/';
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const isConfluence=item=>item.material==='confluence';
const summary={mode,source:path.basename(root),dates:[],counts:{solo:0,confluence:0},versions:{},materials:{},entries:[],invalid:[],reproduction:[]};
await fs.mkdir(output,{recursive:true});
function error(id,msg){summary.invalid.push({id,error:String(msg)});}
function decodeShared(raw){
  if(!raw || raw.length>10000 || !/^[A-Za-z0-9_-]+$/.test(raw))throw Error('Missing/unsafe Confluence s token');
  const state=JSON.parse(Buffer.from(raw,'base64url').toString('utf8'));
  if(state.v!==1 || !state.seed || !['portrait','landscape'].includes(state.orientation) ||
     !Array.isArray(state.artists) || state.artists.length!==3 ||
     !state.artists.every(a=>a.system&&a.material&&a.palette&&a.settings&&typeof a.settings==='object'))
    throw Error('Incomplete Confluence composition state');
  return state;
}
const dirs=(await fs.readdir(path.join(root,'gallery'),{withFileTypes:true}))
  .filter(f=>f.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(f.name)).map(f=>f.name).sort();
const ids=new Set();
for(const date of dirs){
  const p=path.join(root,'gallery',date,'meta.json');
  let meta;
  try{meta=JSON.parse(await fs.readFile(p,'utf8'))}catch(e){error(date,'Unusable edition metadata: '+e.message);continue;}
  if(!Array.isArray(meta.entries)||!meta.entries.length){error(date,'Edition has no entries');continue;}
  if(meta.count!=null&&meta.count!==meta.entries.length)error(date,'Edition count differs from entries');
  summary.dates.push({date,count:meta.entries.length});
  for(const item of meta.entries){
    const id=item.id||date+'-missing-id';
    try{
      if(ids.has(id))throw Error('Duplicate artwork id');
      ids.add(id);
      if(!item.seed||!item.shareUrl||!item.imageFile||!item.settings||!Number.isInteger(item.rendererVersion))
        throw Error('Incomplete procedural metadata');
      const url=new URL(item.shareUrl);
      if(url.origin!=='https://southernadd-cmyk.github.io'||!url.pathname.startsWith('/algoart/'))
        throw Error('Unexpected archive share URL');
      let stateSha=null;
      if(isConfluence(item)){
        if(url.pathname!=='/algoart/confluence/')throw Error('Confluence URL is not the Confluence editor');
        const state=decodeShared(url.searchParams.get('s'));
        if(state.seed!==item.seed||state.orientation!==item.orientation)throw Error('Confluence state/metadata mismatch');
        if(item.artists?.length===3 && state.artists.some((a,i)=>
          a.material!==item.artists[i].material || a.system!==item.artists[i].system ||
          a.palette!==item.artists[i].palette))
          throw Error('Confluence artist roster mismatch');
        stateSha=hash(Buffer.from(url.searchParams.get('s'),'base64url'));
        summary.counts.confluence++;
      }else{
        if(url.pathname!=='/algoart/')throw Error('Solo URL does not target editor');
        if(url.searchParams.get('seed')!==item.seed)throw Error('Seed/URL mismatch');
        if(Number(url.searchParams.get('v'))!==item.rendererVersion)throw Error('Renderer version/URL mismatch');
        if(item.settings.seed!==item.seed)throw Error('Settings/seed mismatch');
        summary.counts.solo++;
      }
      const key=String(item.rendererVersion);
      summary.versions[key]=(summary.versions[key]||0)+1;
      const material=isConfluence(item)?'confluence':(url.searchParams.get('material')||'marker').replace(/-v\d+[a-z]?$/,'');
      summary.materials[material]=(summary.materials[material]||0)+1;
      const imagePath=path.resolve(root,'gallery',date,item.imageFile);
      const local=!(item.imageFile.startsWith('http://')||item.imageFile.startsWith('https://'));
      if(local && !imagePath.startsWith(path.join(root,'gallery',date)+path.sep))
        throw Error('Unsafe image path');
      const stat=local?await fs.stat(imagePath):null;
      if(stat && stat.size<1000)throw Error('Image unusually small');
      summary.entries.push({id,date,seed:item.seed,version:item.rendererVersion,material,orientation:item.orientation,
        confluence:isConfluence(item),stateSha256:stateSha,shareUrl:item.shareUrl,
        imageFile:item.imageFile,bytes:stat?.size??null});
    }catch(e){error(id,e.message);}
  }
}
const report=path.join(output,'report.json');
function save(){return fs.writeFile(report,JSON.stringify(summary,null,2));}
async function appendSummary(){
  const lines=['### Historical procedural reproduction — '+mode,
    '- Editions: '+summary.dates.length+'; recorded works: '+summary.entries.length+
      ' (solo '+summary.counts.solo+', Confluence '+summary.counts.confluence+')',
    '- Metadata/asset errors: '+summary.invalid.length,
    '- Renderer version counts: '+JSON.stringify(summary.versions)];
  if(mode!=='--inventory'){
    const groups=Object.groupBy(summary.reproduction,r=>r.result);
    lines.push('- Browser results: '+Object.entries(groups).map(([k,v])=>k+' '+v.length).join(', '),
      '- Chromium visual match uses mean channel error <= 2.5 and changed pixels <= 0.8%; repeat renders require identical canvas PNG hash.',
      '- A visual match is NOT proof of byte-identical JPEG re-encoding or lossless recreation.');
  }
  const message=lines.join('\n')+'\n';
  console.log(message);
  if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,message);
}
if(mode==='--inventory'){
  await save();await appendSummary();
  if(summary.invalid.length)process.exitCode=1;
}else{
  // Systematic version/material sampling (oldest AND newest) plus ALL Confluence.
  const selection=[];
  if(mode==='--all')selection.push(...summary.entries);
  else{
    const selected=new Set();
    function include(x){if(x&&!selected.has(x.id)){selection.push(x);selected.add(x.id);}}
    const solos=summary.entries.filter(x=>!x.confluence);
    const groups=new Map();
    for(const entry of solos){
      for(const key of ['v:'+entry.version,'material:'+entry.material,'mix:'+entry.version+'|'+entry.material]){
        if(!groups.has(key))groups.set(key,[]);
        groups.get(key).push(entry);
      }
    }
    for(const [key,group] of groups){
      // First and last validate both early and recently published source.
      include(group[0]);
      if(key.startsWith('v:'))include(group.at(-1));
    }
    for(const entry of summary.entries.filter(x=>x.confluence))include(entry);
  }
  console.log('Auditing '+selection.length+' actual archived artworks ('+selection.filter(x=>x.confluence).length+' Confluence)');
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1600,height:1200}});
  const pageErrors=[];
  page.on('pageerror',e=>pageErrors.push(e.message));
  await page.addInitScript(()=>{localStorage.setItem('algoart-inspector-desktop','open');localStorage.setItem('algoart-intro-seen','1')});
  async function decodeImage(entry){
    if(entry.imageFile.startsWith('https://')){
      const resp=await fetch(entry.imageFile,{signal:AbortSignal.timeout(60000)});
      if(!resp.ok)throw Error('HTTP '+resp.status+' loading original');
      return Buffer.from(await resp.arrayBuffer());
    }
    return fs.readFile(path.join(root,'gallery',entry.date,entry.imageFile));
  }
  async function one(entry,original){
    const url=new URL(entry.shareUrl);
    const local=new URL(base);
    local.pathname=url.pathname.replace(/^\/algoart(?=\/)/,'');
    local.search=url.search;
    pageErrors.length=0;
    await page.goto(local.href,{waitUntil:'load',timeout:60000});
    if(entry.confluence){
      await page.waitForFunction(()=>{
        const c=document.getElementById('counter')?.textContent||'';
        const m=c.match(/(\d+)\s*\/\s*(\d+)\s*turns/);
        return !!m && Number(m[2])>0 && m[1]===m[2] &&
          document.querySelector('#shared')?.width>0 &&
          !document.getElementById('summary')?.textContent.includes('Could not render');
      },null,{timeout:150000});
    }else{
      await page.waitForFunction(()=>window.AlgoArt?.lastRenderMeta&&document.getElementById('art')?.width>0,null,{timeout:90000});
      const state=await page.evaluate(()=>({version:window.AlgoArt.rendererVersion,settings:window.AlgoArt.readSettings()}));
      if(state.version!==entry.version)throw Error('Loaded renderer '+state.version+' instead of '+entry.version);
      // Complete URL-to-editor state parity check.
      const expected=JSON.parse(await fs.readFile(path.join(root,'gallery',entry.date,'meta.json'),'utf8'))
        .entries.find(x=>x.id===entry.id).settings;
      for(const [key,value] of Object.entries(expected)){
        if(key!=='series'&&state.settings[key]!==value)throw Error('Restored setting mismatch: '+key);
      }
    }
    if(pageErrors.length)throw Error('Browser error: '+pageErrors[0]);
    const canvasId=entry.confluence?'shared':'art';
    return page.evaluate(async ({canvasId,bytesBase64})=>{
      const canvas=document.getElementById(canvasId);
      const image=new Image();image.src='data:image/jpeg;base64,'+bytesBase64;await image.decode();
      if(canvas.width!==image.naturalWidth||canvas.height!==image.naturalHeight)
        throw Error('Image dimensions differ: saved '+image.naturalWidth+'x'+image.naturalHeight+
          ' vs recreated '+canvas.width+'x'+canvas.height);
      const fresh=new Image();fresh.src=canvas.toDataURL('image/jpeg',.94);await fresh.decode();
      const w=Math.round(canvas.width/4),h=Math.round(canvas.height/4);
      const raster=img=>{const c=document.createElement('canvas');c.width=w;c.height=h;
        const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,w,h);return ctx.getImageData(0,0,w,h).data;};
      const a=raster(image),b=raster(fresh);
      let error=0,changed=0;
      for(let k=0;k<a.length;k+=4){
        const d=(Math.abs(a[k]-b[k])+Math.abs(a[k+1]-b[k+1])+Math.abs(a[k+2]-b[k+2]))/3;
        error+=d;if(d>24)changed++;
      }
      return {mean:error/(w*h),changed:changed/(w*h),width:canvas.width,height:canvas.height,
        png:canvas.toDataURL('image/png')};
    },{canvasId,bytesBase64:original.toString('base64')});
  }
  try{
    for(const [index,entry] of selection.entries()){
      const row={id:entry.id,date:entry.date,material:entry.material,version:entry.version,
        confluence:entry.confluence,result:'error'};
      try{
        const original=await decodeImage(entry);
        row.originalSha256=hash(original);
        const first=await one(entry,original);
        row.mean=+first.mean.toFixed(4);row.changed=+first.changed.toFixed(6);
        row.dimensions=[first.width,first.height];
        const second=await one(entry,original);
        row.repeatIdentical=hash(first.png)===hash(second.png);
        row.result=!row.repeatIdentical?'non-deterministic':
          first.mean<=2.5&&first.changed<=.008?'visual-pass':'visual-mismatch';
      }catch(e){row.error=e.message;row.result='error';}
      summary.reproduction.push(row);
      console.log('AUDIT '+(index+1)+'/'+selection.length+' '+entry.id+' '+row.result+
        (row.error?' '+row.error:' mean='+row.mean+' changed='+row.changed));
      // Persist partial evidence even if the CI runner reaches its time budget.
      await save();
    }
  }finally{await browser.close();await save();await appendSummary();}
  if(summary.invalid.length||summary.reproduction.some(r=>r.result!=='visual-pass'))process.exitCode=1;
}