// Publish a verified daily TouchDesigner export from a LOCAL Git checkout.
// This script prepares files; it never commits/pushes or changes the live tower.
import {readFile,writeFile,copyFile,mkdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,resolve,dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {isValidISODate,PHASE2_SPEC} from './touchdesigner-daily.mjs';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const args=process.argv.slice(2);
function arg(flag){const i=args.indexOf(flag);return i<0?null:args[i+1];}
const date=arg('--date'),file=arg('--video'),ffprobe=arg('--ffprobe')||'ffprobe';
if(!isValidISODate(date)||!file){
 console.error('Usage: node automation/publish-touchdesigner-daily.mjs --date YYYY-MM-DD --video "C:\\path\\clip.webm" [--ffprobe "C:\\path\\ffprobe.exe"]');
 process.exit(2);
}
const dir=join(root,'gallery','visit','touchdesigner');
const job=JSON.parse(await readFile(join(dir,'jobs',date+'.json'),'utf8'));
if(job.date!==date||job.status!=='ready-for-touchdesigner'||job.version!==2||
   job.output?.file!=='daily/'+date+'.webm'||
   job.output?.manifest!=='daily/'+date+'.json'||
   job.render?.width!==PHASE2_SPEC.width||job.render?.height!==PHASE2_SPEC.height)
 throw Error('Daily artwork job has unexpected or incompatible fields');
const bytes=await readFile(resolve(file));
if(bytes.length<200000||bytes.length>20_000_000||bytes.subarray(0,4).toString('hex')!=='1a45dfa3')
 throw Error('Refusing invalid or unusually sized WebM file');
const result=spawnSync(ffprobe,[
 '-v','error','-count_frames','-show_entries',
 'stream=codec_type,codec_name,width,height,avg_frame_rate,nb_read_frames:format=duration',
 '-of','json',resolve(file)
],{encoding:'utf8',maxBuffer:1024*1024,timeout:60000});
if(result.error||result.status!==0)
 throw Error('ffprobe failed; provide --ffprobe pointing at TouchDesigner bin/ffprobe.exe. '+String(result.error||result.stderr));
let probe;
try{probe=JSON.parse(result.stdout)}catch{throw Error('Invalid ffprobe JSON output');}
const streams=probe.streams||[],vid=streams.filter(s=>s.codec_type==='video');
if(streams.length!==1||vid.length!==1)throw Error('Expected one silent video stream');
const v=vid[0];
if(v.codec_name!=='vp9'||v.width!==1152||v.height!==240||
   v.avg_frame_rate!=='24/1'||Number(v.nb_read_frames)!==480||
   Math.abs(Number(probe.format?.duration)-20)>.02)
 throw Error('Incorrect VP9 export: '+JSON.stringify({codec:v.codec_name,width:v.width,height:v.height,fps:v.avg_frame_rate,frames:v.nb_read_frames,duration:probe.format?.duration}));
const sha256=createHash('sha256').update(bytes).digest('hex');
const activePath=join(dir,'active.json');
const previous=JSON.parse(await readFile(activePath,'utf8'));
if(previous.version!==1)throw Error('Unknown active manifest version');
if(isValidISODate(previous.date)&&previous.date>date)
 throw Error('Refusing to roll the displayed artwork back from '+previous.date+' to '+date);
const targetDir=join(dir,'daily'),target=join(targetDir,date+'.webm');
await mkdir(targetDir,{recursive:true});
try{
 const existing=await readFile(target);
 if(createHash('sha256').update(existing).digest('hex')!==sha256)
  throw Error('A different video was already published for '+date+'; do not overwrite an immutable export');
}catch(e){if(e.code!=='ENOENT')throw e;}
await copyFile(resolve(file),target);
const manifest={
 version:1,status:'published',date,
 artwork:job.artwork,
 triptych:{
  file:date+'.webm',codec:'vp9',layout:'horizontal',
  panelCount:3,panelWidth:384,panelHeight:240,width:1152,height:240,
  fps:24,durationSeconds:20,sha256,sizeBytes:bytes.length
 },
 panels:['source','translation','emergence'],
 credits:'Generated using TouchDesigner from a daily PROPORTION PIECE study.'
};
await writeFile(join(targetDir,date+'.json'),JSON.stringify(manifest,null,2)+'\n');
await writeFile(activePath,JSON.stringify({
 version:1,manifest:'daily/'+date+'.json',date,
 reason:'Promoted only after the local TouchDesigner export passed frame, format, duration and hash verification.'
},null,2)+'\n');
console.log('Prepared verified '+date+' triptych: '+bytes.length+' bytes; sha256 '+sha256);
console.log('Now review, commit and push these THREE files TOGETHER:');
console.log('  gallery/visit/touchdesigner/daily/'+date+'.webm');
console.log('  gallery/visit/touchdesigner/daily/'+date+'.json');
console.log('  gallery/visit/touchdesigner/active.json');
console.log('Never push active.json by itself. The live tower is not enabled for this installation.');
