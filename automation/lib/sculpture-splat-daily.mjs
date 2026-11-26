import {validEdition} from '../../gallery/sculpture-splats/format.mjs';
import {V2_DAILY_FROM} from '../../gallery/sculpture-v2-test/v2-pack-loader.mjs';

export const AUTO_FROM='2026-11-26';
export const CATCHUP_DAYS=7;
export const TIERS=['mobile','desktop'];
export class MissingManifest extends Error{}
export function londonDay(now=new Date()){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(x=>[x.type,x.value]));
 return p.year+'-'+p.month+'-'+p.day;
}
export function targetDays({today=londonDay(),requested=''}={}){
 if(!validEdition(today)||today==='reception')throw Error('Invalid current date');
 if(requested){
  if(!validEdition(requested)||requested==='reception'||requested<V2_DAILY_FROM||requested>today)throw Error('Recovery date must be a published daily V2 edition, not a future or catalogue date');
  return [requested];
 }
 const days=[];
 for(let i=0;i<CATCHUP_DAYS;i++){
  const day=new Date(Date.parse(today+'T00:00:00Z')-i*86400000).toISOString().slice(0,10);
  if(day>=AUTO_FROM)days.push(day);
 }
 return days;
}
export function checkIdentity(manifest,source){
 if(manifest.portraits!==source.portraits||TIERS.some(q=>manifest.qualities[q].sourceSha256!==source.qualities[q].sha256))
  throw Error('Existing splat manifest conflicts with verified V2 source');
}
export async function publishDay(day,{getSource,getSplats,checkExisting,bakeAndPublish,verifyNew,explicit=false,sourceExpected=false}){
 let source;
 try{source=await getSource(day);}catch(e){
  if(e instanceof MissingManifest&&!explicit&&!sourceExpected)return {day,state:'waiting-for-v2'};
  throw e;
 }
 let splats;
 try{splats=await getSplats(day);}catch(e){if(!(e instanceof MissingManifest))throw e;}
 if(splats){
  checkIdentity(splats,source);
  await checkExisting(day,splats,source,explicit);
  return {day,state:'already-published',portraits:source.portraits};
 }
 await bakeAndPublish(day,source);
 splats=await getSplats(day);
 checkIdentity(splats,source);
 await verifyNew(day,splats,source);
 return {day,state:'published',portraits:source.portraits};
}
