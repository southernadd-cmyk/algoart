import {mkdir,writeFile,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {parseArgs} from 'node:util';
import {downloadV2Prepared,getV2R2Catalog,getV2DailyManifest,V2_DAILY_FROM} from '../gallery/sculpture-v2-test/v2-pack-loader.mjs';
import {buildSplatPack} from './lib/sculpture-splat-pack.mjs';
import {validEdition} from '../gallery/sculpture-splats/format.mjs';

const {values}=parseArgs({options:{date:{type:'string'},quality:{type:'string',default:'both'},out:{type:'string',default:'.splat-staging'}}});
const {date,quality,out}=values;
if(!validEdition(date)||!['mobile','desktop','both'].includes(quality))
 throw Error('Usage: node automation/build-sculpture-splats.mjs --date YYYY-MM-DD|reception --quality mobile|desktop|both --out DIRECTORY');
const dir=resolve(out);await mkdir(dir,{recursive:true});
const fetcher=(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(45000)});
const manifest=date!=='reception'&&date>=V2_DAILY_FROM
 ?await getV2DailyManifest(date,{fetcher}):await getV2R2Catalog({fetcher});
for(const tier of quality==='both'?['mobile','desktop']:[quality]){
 const spec=date==='reception'?manifest.reception?.[tier]:date>=V2_DAILY_FROM?manifest.qualities?.[tier]:manifest.days?.[date]?.qualities?.[tier];
 if(!spec)throw Error('Missing verified source '+date+'/'+tier);
 // Pin the source manifest for this run: the verified loader must read the
 // exact pack recorded by the initial manifest, even during daily republish.
 const source=await downloadV2Prepared(date,tier,{fetcher:async(url,options)=>{
  if(String(url).endsWith('.json.gz')&&String(url)!==spec.url)throw Error('Source pack changed during bake');
  return fetcher(url,options);
 }});
 const result=buildSplatPack(source,{date,quality:tier,sourceSha256:spec.sha256});
 const file=resolve(dir,date+'-'+tier+'-'+result.sha256+'.json.gz');
 await writeFile(file+'.tmp',result.bytes);await rename(file+'.tmp',file);
 console.log(JSON.stringify({date,quality:tier,file,sha256:result.sha256,bytes:result.bytes.length,sourceSha256:spec.sha256,studies:result.pack.expectedPortraits,points:Object.values(result.pack.studies).reduce((n,s)=>n+s.pointCount,0)}));
}
