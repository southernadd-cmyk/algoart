import test from 'node:test';
import assert from 'node:assert/strict';
import {archivePlan,archiveSource,shardPlan,verifiedRecord,auditRecords,SHARD_COUNT} from '../automation/lib/sculpture-splat-backfill.mjs';

const qualities={mobile:{sha256:'a'.repeat(64)},desktop:{sha256:'b'.repeat(64)}};
const source={portraits:6,qualities};
function catalogue(){
 const days={};
 for(let d=Date.parse('2026-10-05T00:00:00Z');d<Date.parse('2026-11-18T00:00:00Z');d+=86400000)
  days[new Date(d).toISOString().slice(0,10)]=source;
 return {days,reception:qualities};
}
function fixture(){
 const catalog=catalogue(),entries=archivePlan(catalog);
 const sources=new Map(entries.map(day=>[day,day==='reception'?archiveSource(catalog,day):source]));
 const reports=Array.from({length:SHARD_COUNT},(_,shard)=>({shard,errors:[],records:shardPlan(entries,shard).map(day=>{
  const s=sources.get(day);
  return verifiedRecord(day,{portraits:s.portraits,qualities:{
   mobile:{sourceSha256:qualities.mobile.sha256,sha256:'c'.repeat(64),bytes:1000},
   desktop:{sourceSha256:qualities.desktop.sha256,sha256:'d'.repeat(64),bytes:2000}
  }},s,'already-published');
 })}));
 return {entries,sources,reports};
}
test('GS5 covers reception and every October 5–November 25 floor exactly once',()=>{
 const catalog=catalogue(),entries=archivePlan(catalog);
 assert.equal(entries.length,53);
 assert.equal(entries[0],'reception');
 assert.equal(entries[1],'2026-10-05');
 assert.equal(entries.at(-1),'2026-11-25');
 const flattened=Array.from({length:SHARD_COUNT},(_,i)=>shardPlan(entries,i)).flat();
 assert.equal(flattened.length,53);
 assert.equal(new Set(flattened).size,53);
 assert.equal(archiveSource(catalog,'reception').portraits,1);
 delete catalog.days['2026-10-15'];
 assert.throws(()=>archivePlan(catalog),/missing or unexpected/);
 assert.throws(()=>shardPlan(entries,6),/Invalid archive shard/);
});
test('GS5 validates complete audit and two independent quality hashes per edition',()=>{
 const {entries,reports,sources}=fixture();
 const audit=auditRecords(entries,reports,sources);
 assert.equal(audit.complete,true);assert.equal(audit.editions,53);assert.equal(audit.floors,52);
 assert.equal(audit.packs,106);assert.equal(audit.portraits,313);assert.equal(audit.bytes,159000);
});
test('GS5 rejects missing batches, gaps, repeated shards, invalid hashes or failed source records',()=>{
 for(const mutate of [
  f=>f.reports.pop(),
  f=>f.reports[0].records.pop(),
  f=>f.reports[1]=structuredClone(f.reports[0]),
  f=>f.reports[0].records[0].qualities.mobile.sourceSha256='f'.repeat(64),
  f=>f.reports[0].records[0].qualities.desktop.pointsPerStudy=12000,
  f=>f.reports[0].errors.push({day:'reception',error:'upload failed'}),
  f=>f.reports[0].records[0].portraits=0
 ]){
  const f=fixture();mutate(f);assert.throws(()=>auditRecords(f.entries,f.reports,f.sources));
 }
});
