import {chromium,firefox,webkit} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import {ARTWORK_JPEG_QUALITY} from '../automation/config.mjs';

const engine=process.env.ARCHIVE_BROWSER||'chromium';
const runtime={chromium,firefox,webkit}[engine];
if(!runtime)throw Error('Unknown browser '+engine);
const base=process.env.ALGOART_LOCAL_URL||'http://127.0.0.1:4173/';
const output=path.resolve(process.env.ARCHIVE_REPORT_DIR||'archive-check-results',engine);
await fs.mkdir(output,{recursive:true});
const limits=engine==='chromium'?{mean:2.5,changed:.008}:{mean:4,changed:.02};
const queueIndex=process.argv.indexOf('--queue');
const sources=[];
if(queueIndex>=0){
  const file=path.resolve(process.argv[queueIndex+1]);
  sources.push({file,images:path.dirname(file)});
}else{
  for(const day of (await fs.readdir('gallery')).sort()){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(day))continue;
    sources.push({file:path.resolve('gallery',day,'meta.json'),images:path.resolve('gallery',day)});
  }
}

// PR smoke coverage: choose representative archived artworks across every
// material and composition engine, with both orientations where available.
// Full archive validation remains available with --all (and workflow_dispatch).
const representative=process.argv.includes('--representative');
const archiveItems=[];
for(const source of sources){
  const metadata=JSON.parse(await fs.readFile(source.file,'utf8'));
  for(const item of metadata.entries||[])archiveItems.push({source,item});
}
const materialOf=item=>{
  const u=new URL(item.shareUrl);
  const m=u.searchParams.get('material')||item.material||'marker';
  return m.startsWith('watercolour')?'watercolour':
    m.startsWith('watercolor')||m.startsWith('tissue')?'tissue':
    m.startsWith('oil')?'oil':m.startsWith('action')?'action':'marker';
};
const selectedIds=new Set();
if(representative){
  const groups=new Map();
  // Include materials, engines, and orientations, prefer newest editions.
  for(const {item} of [...archiveItems].reverse()){
    const mat=materialOf(item),mode=item.settings?.mode||new URL(item.shareUrl).searchParams.get('mode');
    const orientation=item.settings?.orientation||new URL(item.shareUrl).searchParams.get('fmt')||'landscape';
    for(const key of ['material:'+mat,'mode:'+mode,'orientation:'+orientation,
                      'combination:'+mat+'|'+mode]){
      if(!groups.has(key))groups.set(key,item.id);
    }
  }
  for(const id of groups.values())selectedIds.add(id);
  console.log('Representative archive selection: '+selectedIds.size+' artworks; '+groups.size+' covered categories');
}

if(!sources.length)throw Error('No archive metadata found');
const report={browser:engine,limits,entries:[],failures:0};
const browser=await runtime.launch({headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1200}});
await page.addInitScript(()=>{localStorage.setItem('algoart-inspector-desktop','open');localStorage.setItem('algoart-intro-seen','1')});
async function bytesFor(source,item){
  if(/^https?:/.test(item.imageFile)){
    const response=await fetch(item.imageFile,{signal:AbortSignal.timeout(60000)});
    if(!response.ok)throw Error('Missing archived image: HTTP '+response.status);
    return Buffer.from(await response.arrayBuffer());
  }
  const image=path.resolve(source.images,item.imageFile);
  if(!image.startsWith(source.images+path.sep))throw Error('Image path escapes archive');
  return fs.readFile(image);
}
async function compare(item,bytes,overrideVersion){
  const original=new URL(item.shareUrl);
  if(overrideVersion)original.searchParams.set('v',String(overrideVersion));
  const local=new URL(base);
  local.search=original.search;
  await page.goto(local.href,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.AlgoArt?.lastRenderMeta&&document.getElementById('art')?.width>0);
  return page.evaluate(async ({data,expected,limits,overrideVersion,jpegQuality})=>{
    const A=window.AlgoArt,art=document.getElementById('art');
    if(!overrideVersion&&A.rendererVersion!==expected.rendererVersion)throw Error('Actual renderer version does not match recorded version');
    const actual=A.readSettings();
    if(!overrideVersion)for(const [key,value] of Object.entries(expected.settings)){
      if(key==='series')continue;
      if(actual[key]!==value)throw Error('Share URL settings disagree with metadata: '+key);
    }
    const img=new Image();
    img.src='data:image/jpeg;base64,'+data;
    await img.decode();
    if(img.naturalWidth!==art.width||img.naturalHeight!==art.height)throw Error('Archived/rendered dimensions disagree');
    // Compare two equivalent JPEG exports. Comparing the archived JPEG with
    // raw canvas pixels measures chroma subsampling/compression as a render
    // regression (2026-10-12-P03), even when the exported bytes are identical.
    const renderedImage=new Image();
    renderedImage.src=art.toDataURL('image/jpeg',jpegQuality);
    await renderedImage.decode();
    const w=Math.round(art.width/4),h=Math.round(art.height/4);
    const small=()=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
    const old=small(),fresh=small(),diff=small();
    old.getContext('2d').drawImage(img,0,0,w,h);
    fresh.getContext('2d').drawImage(renderedImage,0,0,w,h);
    const a=old.getContext('2d').getImageData(0,0,w,h).data;
    const b=fresh.getContext('2d').getImageData(0,0,w,h).data;
    const ctx=diff.getContext('2d'),heat=ctx.createImageData(w,h);
    let error=0,changed=0;
    for(let i=0;i<a.length;i+=4){
      const d=(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]))/3;
      error+=d;if(d>24)changed++;
      heat.data[i]=Math.min(255,d*8);heat.data[i+3]=255;
    }
    ctx.putImageData(heat,0,0);
    const mean=error/(w*h),ratio=changed/(w*h);
    return {mean,changed:ratio,passed:mean<=limits.mean&&ratio<=limits.changed,
      actualVersion:A.rendererVersion,width:art.width,height:art.height,
      render:art.toDataURL('image/png'),diff:diff.toDataURL('image/png')};
  },{data:bytes.toString('base64'),expected:item,limits,overrideVersion,jpegQuality:ARTWORK_JPEG_QUALITY});
}
try{
  const allIds=new Set();
  for(const source of sources){
    const meta=JSON.parse(await fs.readFile(source.file,'utf8'));
    if(!Array.isArray(meta.entries)||!meta.entries.length)throw Error('Empty archive '+source.file);
    if(meta.count!==undefined&&meta.count!==meta.entries.length)throw Error('Archive count disagrees '+source.file);
    for(const item of meta.entries){
      if(representative&&!selectedIds.has(item.id))continue;
      const row={id:item.id,seed:item.seed,url:item.shareUrl,version:item.rendererVersion};
      let bytes,result;
      try{
        if(!item.id||allIds.has(item.id))throw Error('Missing or duplicate artwork ID '+item.id);
        allIds.add(item.id);
        if(!item.imageFile||!item.settings||!item.shareUrl)throw Error('Incomplete archived state');
        const url=new URL(item.shareUrl);
        if(Number(url.searchParams.get('v'))!==item.rendererVersion)throw Error('URL/metadata version mismatch');
        if(url.searchParams.get('seed')!==item.seed||item.settings.seed!==item.seed)throw Error('URL/metadata seed mismatch');
        bytes=await bytesFor(source,item);
        result=await compare(item,bytes);
        row.metrics={mean:result.mean,meanPercentOfChannelRange:+(result.mean/255*100).toFixed(3),changed:result.changed};
        if(!result.passed){
          // Diagnose a borderline cross-browser archive mismatch without
          // changing the published reference or relaxing either threshold.
          const originalPng=result.render;
          await page.reload({waitUntil:'networkidle'});
          await page.waitForFunction(()=>window.AlgoArt?.lastRenderMeta&&document.getElementById('art')?.width>0);
          const repeat=await page.evaluate(async previous=>{
            const first=new Image();first.src=previous;await first.decode();
            const art=document.getElementById('art');
            const c=document.createElement('canvas');c.width=art.width;c.height=art.height;
            const ctx=c.getContext('2d');ctx.drawImage(first,0,0);
            const a=ctx.getImageData(0,0,c.width,c.height).data;
            const b=art.getContext('2d').getImageData(0,0,c.width,c.height).data;
            let changedChannels=0,maxDelta=0;
            for(let i=0;i<a.length;i++)if(a[i]!==b[i]){changedChannels++;maxDelta=Math.max(maxDelta,Math.abs(a[i]-b[i]));}
            return {changedChannels,maxDelta};
          },originalPng);
          row.repeatRender=repeat;
          console.error('REPEAT_RENDER '+row.id+' '+JSON.stringify(repeat));
          throw Error('Pixel comparison failed');
        }
        row.passed=true;
        // Prove these tolerances reject the known wrong-version regression.
        if(queueIndex<0&&item.seed==='AA-20261006-01-92180'){
          const wrong=await compare(item,bytes,5);
          report.wrongVersionProbe={id:item.id,mean:wrong.mean,changed:wrong.changed,rejected:!wrong.passed};
          console.log('Wrong-version probe '+JSON.stringify(report.wrongVersionProbe));
          if(wrong.passed)throw Error('Tolerance failed to detect Study 06 V5 regression');
        }
      }catch(error){
        row.passed=false;row.error=error.message;report.failures++;
        const name=String(item.id||'missing-id').replace(/[^a-zA-Z0-9-]/g,'_');
        if(bytes)await fs.writeFile(path.join(output,name+'-archived.jpg'),bytes);
        if(result){
          for(const key of ['render','diff'])await fs.writeFile(path.join(output,name+'-'+key+'.png'),Buffer.from(result[key].split(',')[1],'base64'));
        }
        console.error('FAIL '+row.id+' '+row.error+' '+JSON.stringify(row.metrics||{}));
      }
      report.entries.push(row);
      console.log((row.passed?'PASS ':'FAIL ')+row.id+' '+JSON.stringify(row.metrics||{}));
    }
  }
}finally{
  await browser.close();
  await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
  const summary='Archive check / '+engine+': '+report.entries.length+' entries, '+report.failures+' failures. Limits: '+JSON.stringify(limits);
  console.log(summary);
  if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,summary+'\n');
}
if(report.failures)process.exitCode=1;
