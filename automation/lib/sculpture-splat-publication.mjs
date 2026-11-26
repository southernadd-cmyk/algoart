import {execFileSync} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {getV2DailyManifest} from '../../gallery/sculpture-v2-test/v2-pack-loader.mjs';
import {fetchSplatManifest,downloadSplatPack} from '../../gallery/sculpture-splats/r2-loader.mjs';
import {MissingManifest,TIERS} from './sculpture-splat-daily.mjs';

export const fetcher=(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(45000)});
export const manifestFetcher=async(url,options)=>{
 const r=await fetcher(url,options);
 if(r.status===404)throw new MissingManifest('Missing manifest: '+url);
 return r;
};
export const getSource=day=>getV2DailyManifest(day,{fetcher:manifestFetcher});
export const getSplats=day=>fetchSplatManifest(day,{fetcher:manifestFetcher});
export async function verifyBoth(day,manifest,source){
 for(const quality of TIERS){
  const pack=await downloadSplatPack(day,quality,{manifest,sourceSha256:source.qualities[quality].sha256,fetcher});
  if(pack.expectedPortraits!==source.portraits)throw Error('Verified splat roster mismatch: '+day+'/'+quality);
 }
}
export async function checkExisting(day,manifest,source,explicit){
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
export async function bakeAndPublish(day,source){
 const out=await mkdtemp(join(tmpdir(),'pp-splat-'+day+'-'));
 try{
  execFileSync(process.execPath,['automation/build-sculpture-splats.mjs','--date',day,'--quality','both','--out',out],{stdio:'inherit',timeout:240000});
  execFileSync(process.env.SPLAT_PYTHON||'python3',['automation/publish-sculpture-splats-r2.py','--date',day,'--out',out,
   '--source-mobile-sha',source.qualities.mobile.sha256,'--source-desktop-sha',source.qualities.desktop.sha256],{stdio:'inherit',timeout:240000});
 }finally{await rm(out,{recursive:true,force:true});}
}
