import {existsSync} from 'node:fs';
import {parseArgs} from 'node:util';
import {londonDay,targetDays,publishDay} from './lib/sculpture-splat-daily.mjs';
import {getSource,getSplats,checkExisting,bakeAndPublish,verifyBoth} from './lib/sculpture-splat-publication.mjs';

const {values}=parseArgs({options:{date:{type:'string',default:''}}});
const today=londonDay(),requested=values.date;
if(process.env.GITHUB_REPOSITORY!=='southernadd-cmyk/algoart'||process.env.GITHUB_REF!=='refs/heads/main'||
 !['workflow_run','workflow_dispatch','schedule'].includes(process.env.GITHUB_EVENT_NAME)||process.env.SPLAT_PUBLICATION_ARMED!=='true')
 throw Error('Daily splat publication requires trusted main workflow');
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
