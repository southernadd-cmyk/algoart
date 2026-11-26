import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {parseArgs} from 'node:util';
import {getV2DailyManifest} from '../gallery/sculpture-v2-test/v2-pack-loader.mjs';
import {fetchSplatManifest,downloadSplatPack} from '../gallery/sculpture-splats/r2-loader.mjs';
import {londonDay,targetDays,publishDay,MissingManifest,TIERS} from './lib/sculpture-splat-daily.mjs';

const {values}=parseArgs({options:{date:{type:'string',default:''}}});
const today=londonDay(),requested=values.date;
if(process.env.GITHUB_REPOSITORY!=='southernadd-cmyk/algoart'||process.env.GITHUB_REF!=='refs/heads/main'||
 !['workflow_run','workflow_dispatch','schedule'].includes(process.env.GITHUB_EVENT_NAME)||process.env.SPLAT_PUBLICATION_ARMED!=='true')
 throw Error('Daily splat publication requires trusted main workflow');
const fetcher=(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(45000)});
const manifestFetcher=async(url,options)=>{
 const r=await fetcher(url,options);
 if(r.status===404)throw new MissingManifest('Missing manifest: '+url);
 return r;
};
const getSource=day=>getV2DailyManifest(day,{fetcher:manifestFetcher});
const getSplats=day=>fetchSplatManifest(day,{fetcher:manifestFetcher});
async function verifyBoth(day,manifest,source){
 for(const quality of TIERS){
  const pack=await downloadSplatPack(day,quality,{manifest,sourceSha256:source.qualities[quality].sha256,fetcher});
  if(pack.expectedPortraits!==source.portraits)throw Error('Verified splat roster mismatch: '+day+'/'+quality);
 }
}
async function checkExisting(day,manifest,source,explicit){
 // Initial publication has already performed full readback. Ordinary catchup
 // scans check identity, public availability and length without re-downloading.
 // Explicit recovery and new publication always perform full SHA verification.
 if(explicit)return verifyBoth(day,manifest,source);
 for(const quality of TIERS){
  const spec=manifest.qualities[quality],r=await fetcher(spec.url,{method:'HEAD',headers:{Origin:'https://southernadd-cmyk.github.io'}});
  if(!r.ok||Number(r.headers.get('content-length'))!==spec.bytes||
     r.headers.get('content-type')!=='application/gzip'||
     r.headers.get('access-control-allow-origin')!=='https://southernadd-cmyk.github.io')
   throw Error('Previously published splat object unavailable: '+day+'/'+quality);
 }
}
async function bakeAndPublish(day,source){
 const out=await mkdtemp(join(tmpdir(),'pp-splat-'+day+'-'));
 try{
  execFileSync(process.execPath,['automation/build-sculpture-splats.mjs','--date',day,'--quality','both','--out',out],{stdio:'inherit',timeout:240000});
  execFileSync(process.env.SPLAT_PYTHON||'python3',['automation/publish-sculpture-splats-r2.py','--date',day,'--out',out,
   '--source-mobile-sha',source.qualities.mobile.sha256,'--source-desktop-sha',source.qualities.desktop.sha256],{stdio:'inherit',timeout:240000});
 }finally{await rm(out,{recursive:true,force:true});}
}
const results=[],errors=[];
for(const day of targetDays({today,requested})){
 // A historical date with committed metadata should have a V2 publication.
 // Today may still be baking: the independent scheduled retries will catch it.
 const sourceExpected=day<today&&existsSync('gallery/'+day+'/meta.json');
 let result=null,lastError;
 for(let attempt=1;attempt<=2;attempt++){
  try{
   result=await publishDay(day,{getSource,getSplats,checkExisting,bakeAndPublish,verifyNew:verifyBoth,explicit:!!requested,sourceExpected});
   break;
  }catch(e){lastError=e;console.warn('GS4_ATTEMPT_FAILED',day,attempt,String(e?.message||e));}
 }
 if(result){results.push(result);console.log('GS4_DAILY_EDITION',JSON.stringify(result));}
 else errors.push({day,error:String(lastError?.message||lastError)});
}
console.log('GS4_DAILY_SUMMARY',JSON.stringify({today,requested,results,errors}));
if(errors.length)throw Error('Daily splat publication failed for '+errors.map(x=>x.day).join(', '));
