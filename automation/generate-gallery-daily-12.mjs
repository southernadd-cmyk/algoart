// PROPORTION PIECE: twelve independently selected gallery studies per day.
// Starts 9 November 2026; never changes the social schedule or historical floors.
// Daily seed + per-study salt keep each edition random-looking but reproducible.
// Delegate real rendering, material physics and quality gates to the existing
// social generator; NONE of the generated gallery studies are posted to socials.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {MODES} from './config.mjs';
import {makeCaptions} from './captions.mjs';

const day=process.env.SOCIAL_DATE||new Intl.DateTimeFormat('en-CA',{
  timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'
}).format(new Date());
if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||day<'2026-11-09')
  throw Error('The twelve-study gallery starts on 2026-11-09; do not rewrite earlier floors.');
const materials=['marker','watercolor','watercolour','oil','action'];
const modes=MODES.map(([code])=>code);
function hash(value){let h=2166136261;for(const x of String(value))h=Math.imul(h^x.charCodeAt(0),16777619);return h>>>0}
let state=hash(day+'|PROPORTION-PIECE|DAILY-12|V1');
function random(){state=(state+0x6d2b79f5)|0;let t=Math.imul(state^(state>>>15),1|state);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296}
const pick=choices=>choices[Math.floor(random()*choices.length)];
// Keep a usable wall/sculpture balance in the 3D floor, while shuffling
// which of the twelve random studies is portrait. Materials and systems are
// still sampled independently, without fixed quotas.
const formats=[...Array(6).fill('portrait'),...Array(6).fill('landscape')];
for(let i=formats.length-1;i>0;i--){
  const j=Math.floor(random()*(i+1));
  [formats[i],formats[j]]=[formats[j],formats[i]];
}
const target=path.resolve('social-output',day,'gallery');
await fs.mkdir(target,{recursive:true});
const entries=[];
for(let i=0;i<12;i++){
  const material=pick(materials),orientation=formats[i],mode=pick(modes);
  const salt='GALLERY12|'+day+'|'+i+'|'+Math.floor(random()*4294967296).toString(16);
  const env={...process.env,SOCIAL_DATE:day,SOCIAL_COUNT:'1',
    SOCIAL_MATERIAL:material,SOCIAL_ORIENTATION:orientation,
    SOCIAL_SEED_SALT:salt,SOCIAL_FORCE_MODE:mode,
    SOCIAL_RENDERER_VERSION:'10'};
  // A separate subprocess keeps the already released material generator intact
  // and allows each drawing to choose its material and orientation independently.
  const result=spawnSync(process.execPath,['automation/generate-social.mjs'],{
    env,encoding:'utf8',timeout:240000,maxBuffer:16*1024*1024
  });
  if(result.status!==0)
    throw Error('Gallery study '+(i+1)+' ('+material+', '+mode+') failed: '+
      (result.stderr||result.stdout||'').slice(-3000));
  const dir=path.resolve('social-output',day,...(material==='marker'?
    (orientation==='portrait'?['portrait']:[]):[material,orientation]));
  const queue=JSON.parse(await fs.readFile(path.join(dir,'queue.json'),'utf8'));
  const original=queue.entries[0];
  if(!original||original.rendererVersion!==10||
      new URL(original.shareUrl).searchParams.get('v')!=='10')
    throw Error('Study '+(i+1)+' did not use renderer V10');
  const id=day+'-G'+String(i+1).padStart(2,'0');
  const filename=id+'-'+material+'-'+mode+'-'+orientation+'.jpg';
  await fs.copyFile(path.join(dir,original.imageFile),path.join(target,filename));
  const entry={...original,id,imageFile:filename,orientation,material};
  delete entry.instagramImageFile; // gallery-only; never publish this study
  entry.copy=makeCaptions(entry);
  entries.push(entry);
  console.log(id+': '+material+' / '+mode+' / '+orientation+' / '+entry.seed+' / V10');
}
if(new Set(entries.map(e=>e.seed)).size!==12)
  throw Error('Repeated seed in independent twelve-study gallery edition');
if(new Set(entries.map(e=>e.id)).size!==12)
  throw Error('Repeated archive ID in daily gallery');
const queue={version:1,edition:'random-12',date:day,
  generatedAt:new Date().toISOString(),publishingEnabled:false,entries};
await fs.writeFile(path.join(target,'queue.json'),JSON.stringify(queue,null,2));
console.log('Generated 12 independently selected gallery-only studies for '+day);
