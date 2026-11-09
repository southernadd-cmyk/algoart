// Four deterministic shared-canvas studies: two portrait, two landscape.
// Generated alongside (not instead of) the twelve ordinary daily studies.
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {systems, palettes} from '../confluence/collab.js';
import {defaultSettings} from '../confluence/artist-controls.js';
import {makeGoldenRoster} from '../confluence/golden-roster.js';

const SITE='https://southernadd-cmyk.github.io/algoart';
const LOCAL=process.env.ALGOART_LOCAL_URL || 'http://127.0.0.1:4173/';
const day=process.env.SOCIAL_DATE || (() => {
  const fields=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{
    timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(new Date()).map(({type,value})=>[type,value]));
  return fields.year+'-'+fields.month+'-'+fields.day;
})();
if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||day<'2026-11-09')
  throw Error('Confluence daily editions start 2026-11-09; historical galleries are immutable.');

const out=path.resolve('social-output',day,'gallery');
const queuePath=path.join(out,'queue.json');
const queue=JSON.parse(await fs.readFile(queuePath,'utf8'));
if(!Array.isArray(queue.entries) || queue.entries.length!==12 ||
   queue.edition!=='random-12' || queue.entries.some(e=>!/-G\d{2}$/.test(e.id)))
  throw Error('Confluence must append to exactly 12 validated solo gallery studies.');

const materials=['marker','tissue','watercolour','oil','action'];
const formats=['portrait','landscape','portrait','landscape'];
const encoded=record=>Buffer.from(JSON.stringify(record),'utf8').toString('base64url');
const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
const artwork=[];
try {
  const page=await browser.newPage({viewport:{width:1600,height:1200},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(let i=0;i<4;i++){
    // A sparse source engine or unexpectedly heavy native paint combination
    // must not prevent the whole daily gallery reaching publication.
    // Each fallback has a deterministic, separately bookmarkable seed.
    let accepted=false;
    for(let attempt=0;attempt<3;attempt++){
    try{
    errors.length=0;
    const orientation=formats[i];
    const seed='CFL-'+day.replaceAll('-','')+'-'+String(i+1).padStart(2,'0')+
      (attempt?'-A'+attempt:'');
    const artists=makeGoldenRoster(seed,{systems,materials,
      palettes:Object.keys(palettes),defaultSettings});
    const s={
      v:1,seed,orientation,paper:'#f5f0e6',grain:11,
      strength:76,collaborationPull:100,leadIndex:0,totalTurns:34,
      artists:artists.map(a=>({
        system:a.system,palette:a.palette,material:a.material,settings:a.settings
      }))
    };
    const token=encoded(s);
    if(token.length>10000)throw Error('Confluence share state exceeds bookmark limit.');
    const shareUrl=SITE+'/confluence/?s='+token;
    const url=new URL('confluence/?s='+token,LOCAL).href;
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(()=>{
      const counter=document.getElementById('counter')?.textContent||'';
      const match=counter.match(/^(\d+)\s*\/\s*(\d+)\s+turns$/);
      if(document.getElementById('summary')?.textContent==='Could not render this study.')
        throw Error('Confluence shared painter failed');
      return match && Number(match[2])>0 && match[1]===match[2] &&
        document.querySelector('.progress')?.getAttribute('aria-valuenow')==='100';
    },null,{timeout:240000});
    if(errors.length)throw Error('Confluence page error: '+errors.join(' | ').slice(0,700));
    const output=await page.locator('#shared').evaluate(canvas=>{
      const check=document.createElement('canvas');
      check.width=96;check.height=96;
      const ctx=check.getContext('2d',{willReadFrequently:true});
      ctx.drawImage(canvas,0,0,96,96);
      const pixels=ctx.getImageData(0,0,96,96).data;
      let marked=0,min=255,max=0;
      for(let p=0;p<pixels.length;p+=4){
        const r=pixels[p],g=pixels[p+1],b=pixels[p+2];
        const luminance=(r+g+b)/3;
        min=Math.min(min,luminance);max=Math.max(max,luminance);
        if(Math.max(Math.abs(r-245),Math.abs(g-240),Math.abs(b-230))>35)marked++;
      }
      return {
        width:canvas.width,height:canvas.height,
        coverage:marked/9216,contrast:max-min,
        jpeg:canvas.toDataURL('image/jpeg',.86)
      };
    });
    const expected=orientation==='portrait'?[1000,1400]:[1400,1000];
    if(output.width!==expected[0]||output.height!==expected[1])
      throw Error('Wrong Confluence canvas dimensions for '+seed);
    if(output.coverage<.003||output.contrast<30)
      throw Error('Confluence image is too empty to archive ('+seed+'; coverage='+output.coverage.toFixed(4)+')');
    const image=Buffer.from(output.jpeg.split(',')[1],'base64');
    if(image.byteLength<15000)throw Error('Suspiciously empty Confluence image '+seed);
    const id=day+'-C'+String(i+1).padStart(2,'0');
    const imageFile=id+'-'+orientation+'.jpg';
    await fs.writeFile(path.join(out,imageFile),image);
    const systemNames=artists.map(a=>systems.find(s=>s.id===a.system)?.name||a.system);
    const paletteNames=artists.map(a=>palettes[a.palette]);
    const materialNames=artists.map(a=>a.material==='tissue'?'Tissue & Graphite':
      a.material==='action'?'Action Painting':
      a.material==='oil'?'Oil':
      a.material==='watercolour'?'Watercolour':'Marker');
    const altText='PROPORTION PIECE Confluence '+orientation+' study: three procedural artists share a drawing. '+
      systemNames.map((name,j)=>name+' in '+materialNames[j]+' ('+paletteNames[j]+' palette)').join('; ')+'.';
    artwork.push({
      id,orientation,material:'confluence',generatedAt:new Date().toISOString(),
      seed,mode:'confluence',series:'Confluence',imageFile,shareUrl,rendererVersion:10,
      settings:{orientation,phiStrength:76,palette:'Three φ-distributed palettes',
        materials:artists.map(a=>a.material),systems:artists.map(a=>a.system)},
      artists:artists.map(a=>({system:a.system,material:a.material,palette:a.palette})),
      copy:{altText},platforms:{}
    });
    console.log('Confluence '+id+': '+orientation+' / '+artists.map(a=>a.system+':'+a.material+':'+a.palette).join(', '));
    accepted=true;
    break;
    }catch(error){
      console.warn('Confluence study '+(i+1)+' candidate '+(attempt+1)+'/3 failed:',String(error));
      if(attempt===2)throw error;
    }
    }
    if(!accepted)throw Error('Confluence study '+(i+1)+' has no valid rendered candidate.');
  }
}finally {await browser.close();}
if(artwork.length!==4||new Set(artwork.map(a=>a.seed)).size!==4||
  formats.some((orientation,i)=>artwork[i].orientation!==orientation))
  throw Error('Confluence edition must contain four distinct studies, 2 portrait and 2 landscape.');
queue.entries.push(...artwork);
queue.edition='random-12-confluence-4';
await fs.writeFile(queuePath,JSON.stringify(queue,null,2)+'\n');
console.log('Daily gallery now contains 12 solo + 4 Confluence studies.');
