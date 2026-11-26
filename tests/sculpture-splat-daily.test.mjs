import test from 'node:test';
import assert from 'node:assert/strict';
import {londonDay,targetDays,publishDay,MissingManifest} from '../automation/lib/sculpture-splat-daily.mjs';

const day='2026-11-26',source={portraits:6,qualities:{mobile:{sha256:'a'.repeat(64)},desktop:{sha256:'b'.repeat(64)}}};
function fixture({missingSource=false,missingSplats=false,stale=false,invalid=false,failBake=false}={}){
 const calls=[];
 let published=!missingSplats;
 const manifest={portraits:6,qualities:{mobile:{sourceSha256:stale?'c'.repeat(64):source.qualities.mobile.sha256},desktop:{sourceSha256:source.qualities.desktop.sha256}}};
 return {calls,deps:{
  getSource:async()=>{calls.push('source');if(missingSource)throw new MissingManifest();return source;},
  getSplats:async()=>{calls.push('manifest');if(invalid)throw Error('Corrupt manifest');if(!published)throw new MissingManifest();return manifest;},
  checkExisting:async(d,m,s,explicit)=>{calls.push(explicit?'full-verify':'head-verify');},
  bakeAndPublish:async()=>{calls.push('bake-publish');if(failBake)throw Error('Upload failed');published=true;},
  verifyNew:async()=>{calls.push('new-full-verify');}
 }};
}
test('GS4 chooses recent dates in London calendar with bounded explicit recovery',()=>{
 assert.equal(londonDay(new Date('2027-07-01T23:30:00Z')),'2027-07-02');
 assert.deepEqual(targetDays({today:'2026-11-26'}),[day]);
 assert.deepEqual(targetDays({today:'2026-12-02'}),['2026-12-02','2026-12-01','2026-11-30','2026-11-29','2026-11-28','2026-11-27',day]);
 assert.equal(targetDays({today:'2026-12-20'}).length,7);
 assert.deepEqual(targetDays({today:'2026-12-20',requested:'2026-11-18'}),['2026-11-18']);
 for(const requested of ['2026-11-17','2026-12-21','reception','2026-11-31','../secret'])assert.throws(()=>targetDays({today:'2026-12-20',requested}));
});
test('GS4 waits on a not-yet-published V2 source but explicit or overdue recovery fails',async()=>{
 const f=fixture({missingSource:true});
 assert.equal((await publishDay(day,f.deps)).state,'waiting-for-v2');
 assert.deepEqual(f.calls,['source']);
 await assert.rejects(publishDay(day,{...f.deps,explicit:true}),MissingManifest);
 await assert.rejects(publishDay(day,{...f.deps,sourceExpected:true}),MissingManifest);
});
test('GS4 creates only missing splats; retry reuses existing verified publication',async()=>{
 const f=fixture({missingSplats:true});
 assert.equal((await publishDay(day,f.deps)).state,'published');
 assert.deepEqual(f.calls,['source','manifest','bake-publish','manifest','new-full-verify']);
 f.calls.length=0;
 assert.equal((await publishDay(day,f.deps)).state,'already-published');
 assert.deepEqual(f.calls,['source','manifest','head-verify']);
 f.calls.length=0;
 await publishDay(day,{...f.deps,explicit:true});
 assert.deepEqual(f.calls,['source','manifest','full-verify']);
});
test('GS4 refuses conflicting or malformed manifests and propagates publication errors',async()=>{
 for(const config of [{stale:true},{invalid:true}]){
  const f=fixture(config);
  await assert.rejects(publishDay(day,f.deps));
  assert.ok(!f.calls.includes('bake-publish'));
 }
 const f=fixture({missingSplats:true,failBake:true});
 await assert.rejects(publishDay(day,f.deps),/Upload failed/);
 assert.ok(!f.calls.includes('new-full-verify'));
});
