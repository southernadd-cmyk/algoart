import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {parseArgs} from 'node:util';
import {getV2R2Catalog,V2_DAILY_FROM} from '../gallery/sculpture-v2-test/v2-pack-loader.mjs';
import {archivePlan,archiveSource,shardPlan,verifiedRecord,emptyRecord,auditRecords,SHARD_COUNT} from './lib/sculpture-splat-backfill.mjs';
import {publishDay,MissingManifest} from './lib/sculpture-splat-daily.mjs';
import {fetcher,getSource as getDailySource,getSplats,verifyBoth,checkExisting,bakeAndPublish} from './lib/sculpture-splat-publication.mjs';

const {values}=parseArgs({options:{shard:{type:'string'},out:{type:'string',default:'.splat-backfill'},audit:{type:'boolean',default:false}}});
const out=resolve(values.out);
await mkdir(out,{recursive:true});
const catalog=await getV2R2Catalog({fetcher});
const entries=archivePlan(catalog);
const getSource=day=>day==='reception'||day<V2_DAILY_FROM?Promise.resolve(archiveSource(catalog,day)):getDailySource(day);
if(values.audit){
 const reports=await Promise.all(Array.from({length:SHARD_COUNT},(_,i)=>readFile(resolve(out,'shard-'+i+'.json'),'utf8').then(JSON.parse)));
 const sources=new Map();
 for(const day of entries)sources.set(day,await getSource(day));
 const report=auditRecords(entries,reports,sources);
 await writeFile(resolve(out,'coverage.json'),JSON.stringify(report,null,2)+'\n');
 console.log('GS5_ARCHIVE_COMPLETE',JSON.stringify({editions:report.editions,floors:report.floors,reception:report.reception,emptyFloors:report.emptyFloors,sculptedFloors:report.sculptedFloors,portraits:report.portraits,packs:report.packs,bytes:report.bytes}));
}else{
 if(process.env.GITHUB_REPOSITORY!=='southernadd-cmyk/algoart'||process.env.GITHUB_REF!=='refs/heads/main'||
 !['push','workflow_dispatch'].includes(process.env.GITHUB_EVENT_NAME)||process.env.SPLAT_PUBLICATION_ARMED!=='true')throw Error('Archive writes require trusted main workflow');
 if(!/^[0-5]$/.test(values.shard||''))throw Error('Specify --shard 0 through 5');
 const shard=Number(values.shard),records=[],errors=[];
 for(const day of shardPlan(entries,shard)){
  let record,lastError;
  for(let attempt=1;attempt<=2;attempt++){
   try{
    const source=await getSource(day);
    if(source.portraits===0){
     try{await getSplats(day);throw Error('Unexpected splat manifest on empty floor '+day);}
     catch(e){if(!(e instanceof MissingManifest))throw e;}
     record=emptyRecord(day,source);break;
    }
    const result=await publishDay(day,{getSource:async()=>source,getSplats,checkExisting,bakeAndPublish,verifyNew:verifyBoth,explicit:true,sourceExpected:true});
    const manifest=await getSplats(day);
    record=verifiedRecord(day,manifest,source,result.state);
    break;
   }catch(e){lastError=e;console.warn('GS5_RETRY',day,attempt,String(e?.message||e));}
  }
  if(record){records.push(record);console.log('GS5_EDITION_VERIFIED',JSON.stringify(record));}
  else errors.push({day,error:String(lastError?.message||lastError)});
 }
 await writeFile(resolve(out,'shard-'+shard+'.json'),JSON.stringify({shard,records,errors},null,2)+'\n');
 if(errors.length)throw Error('Incomplete archive shard '+shard+': '+errors.map(x=>x.day).join(', '));
}
