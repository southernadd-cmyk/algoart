// Phase 2: deterministic job contract. A separate ON-DEMAND cloud GPU worker renders TouchDesigner; no personal laptop is required.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=resolve(fileURLToPath(new URL('..',import.meta.url)));
const ISO=/^\d{4}-\d{2}-\d{2}$/;
export const PHASE2_SPEC=Object.freeze({width:1152,height:240,fps:24,frames:480,durationSeconds:20,panelCount:3,panelWidth:384,panelHeight:240,codec:'vp9'});
export function isValidISODate(date){
 if(typeof date!=='string'||!ISO.test(date))return false;
 const x=new Date(date+'T12:00:00.000Z');
 return !Number.isNaN(x.valueOf())&&x.toISOString().slice(0,10)===date;
}
function safeArtwork(e){
 return e&&typeof e.seed==='string'&&/^[A-Za-z0-9-]{6,70}$/.test(e.seed)
   &&typeof e.imageFile==='string'&&/^[A-Za-z0-9._-]+\.jpe?g$/.test(e.imageFile)
   &&typeof e.shareUrl==='string'&&e.shareUrl.startsWith('https://southernadd-cmyk.github.io/algoart/')
   &&e.settings&&typeof e.settings==='object'&&!Array.isArray(e.settings)
   &&Number.isFinite(e.settings.phiStrength);
}
export function selectTouchDesignerStudy(meta){
 if(!isValidISODate(meta?.date)||!Array.isArray(meta.entries))throw Error('Missing dated archive metadata');
 const landscape=meta.entries.filter(e=>e.orientation==='landscape'&&safeArtwork(e));
 if(!landscape.length)throw Error('No usable landscape study in '+meta.date);
 const day=Number(meta.date.replaceAll('-',''));
 const ranked=landscape.map((e,i)=>({
  e,score:(Number(e.settings.phiStrength)||0)*.36+
    (Number(e.settings.goldenAngle)||0)*.14+
    (Number(e.settings.spiralInfluence)||0)*.12+
    (e.series==='Golden Trajectories'?9:0)+
    ((day*17+i*43)%31)
 }));
 ranked.sort((a,b)=>b.score-a.score||a.e.seed.localeCompare(b.e.seed));
 return ranked[0].e;
}
export function createTouchDesignerJob(meta){
 const e=selectTouchDesignerStudy(meta),date=meta.date;
 return {
  version:2,status:'ready-for-touchdesigner',date,
  artwork:{id:e.id,title:e.title,seed:e.seed,series:e.series,material:e.material||'marker',
   orientation:e.orientation,mode:e.mode,sourceImage:'gallery/'+date+'/'+e.imageFile,
   sourceURL:'https://southernadd-cmyk.github.io/algoart/gallery/'+date+'/'+e.imageFile,
   editorURL:e.shareUrl,settings:e.settings},
  render:{...PHASE2_SPEC,panels:['source','translation','emergence']},
  output:{file:'daily/'+date+'.webm',manifest:'daily/'+date+'.json'},
  note:'Render on a provisioned cloud GPU worker with TouchDesigner; verify VP9, frame count, loop and hash before publishing. Never depend on a personal computer.'
 };
}
export async function generateTouchDesignerJob(date,{root=ROOT}={}){
 if(!isValidISODate(date))throw Error('Date must be a real YYYY-MM-DD');
 const meta=JSON.parse(await readFile(join(root,'gallery',date,'meta.json'),'utf8'));
 if(meta.date!==date)throw Error('Archive date mismatch');
 const job=createTouchDesignerJob(meta);
 const dir=join(root,'gallery','visit','touchdesigner');
 await mkdir(join(dir,'jobs'),{recursive:true});
 await writeFile(join(dir,'jobs',date+'.json'),JSON.stringify(job,null,2)+'\n');
 await writeFile(join(dir,'next-study.json'),JSON.stringify(job,null,2)+'\n');
 return job;
}
