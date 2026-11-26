import {validEdition,SPLAT_BUDGETS} from '../../gallery/sculpture-splats/format.mjs';
import {V2_DAILY_FROM} from '../../gallery/sculpture-v2-test/v2-pack-loader.mjs';
import {AUTO_FROM,checkIdentity,TIERS} from './sculpture-splat-daily.mjs';

export const ARCHIVE_START='2026-10-05';
export const SHARD_COUNT=6;
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const require=(ok,message)=>{if(!ok)throw Error(message);};
function datesBetween(start,endExclusive){
 const dates=[];
 for(let t=Date.parse(start+'T00:00:00Z');t<Date.parse(endExclusive+'T00:00:00Z');t+=86400000)
  dates.push(new Date(t).toISOString().slice(0,10));
 return dates;
}
export function archivePlan(catalog){
 const expected=datesBetween(ARCHIVE_START,V2_DAILY_FROM);
 require(Object.keys(catalog?.days||{}).sort().join(',')===expected.join(','),'Historical V2 catalogue has a missing or unexpected floor');
 const entries=['reception',...expected,...datesBetween(V2_DAILY_FROM,AUTO_FROM)];
 return entries;
}
export function shardPlan(entries,shard){
 require(Number.isInteger(shard)&&shard>=0&&shard<SHARD_COUNT,'Invalid archive shard');
 return entries.filter((_,index)=>index%SHARD_COUNT===shard);
}
export function archiveSource(catalog,day){
 require(day==='reception'||(validEdition(day)&&day>=ARCHIVE_START&&day<V2_DAILY_FROM),'Not a catalogue edition');
 const source=day==='reception'?{portraits:1,qualities:{mobile:catalog.reception?.mobile,desktop:catalog.reception?.desktop}}:catalog.days?.[day];
 require(Number.isSafeInteger(source?.portraits)&&source.portraits>0&&TIERS.every(q=>hash(source.qualities?.[q]?.sha256)),'Missing verified catalogue source '+day);
 return source;
}
export function verifiedRecord(day,manifest,source,state){
 checkIdentity(manifest,source);
 require(['published','already-published'].includes(state),'Edition not fully verified: '+day);
 return {day,state,portraits:source.portraits,qualities:Object.fromEntries(TIERS.map(q=>[q,{
  sourceSha256:source.qualities[q].sha256,sha256:manifest.qualities[q].sha256,bytes:manifest.qualities[q].bytes,
  pointsPerStudy:SPLAT_BUDGETS[q]
 }]))};
}
export function auditRecords(entries,reports,sources){
 require(reports.length===SHARD_COUNT,'Missing archive shard report');
 const all=new Map();
 for(const report of reports){
  require(Number.isInteger(report.shard)&&report.shard>=0&&report.shard<SHARD_COUNT,'Invalid report shard');
  require(!report.errors?.length,'Backfill shard reported failures');
  const planned=shardPlan(entries,report.shard);
  require(Array.isArray(report.records)&&report.records.map(r=>r.day).join(',')===planned.join(','),'Shard coverage differs from plan');
  for(const r of report.records){
   require(!all.has(r.day),'Duplicate verified edition '+r.day);
   const source=sources.get(r.day);
   require(source&&r.portraits===source.portraits&&['published','already-published'].includes(r.state),'Wrong source roster or state '+r.day);
   for(const q of TIERS){
    const spec=r.qualities?.[q];
    require(spec&&spec.sourceSha256===source.qualities[q].sha256&&hash(spec.sha256)&&Number.isSafeInteger(spec.bytes)&&spec.bytes>0&&spec.pointsPerStudy===SPLAT_BUDGETS[q],'Invalid verified quality '+r.day+'/'+q);
   }
   all.set(r.day,r);
  }
 }
 require(all.size===entries.length&&entries.every(d=>all.has(d)),'Archive coverage incomplete');
 const records=entries.map(d=>all.get(d));
 return {complete:true,editions:records.length,floors:records.length-1,reception:true,portraits:records.reduce((n,r)=>n+r.portraits,0),
  packs:records.length*2,bytes:records.reduce((n,r)=>n+TIERS.reduce((s,q)=>s+r.qualities[q].bytes,0),0),records};
}
