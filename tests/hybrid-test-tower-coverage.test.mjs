// Isolated historical coverage of the opt-in hybrid tower; never mutates the
// old gallery contour packs or the live exhibition bundle.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {existsSync} from 'node:fs';
const archive=JSON.parse(await readFile('gallery/archive.json','utf8'));
// Check the original bytes, not a thumbnail or an unrelated fallback.
async function verifyOriginal(date,entry,html,request=fetch){
  const label=date+'/'+entry.imageFile;
  if(entry.media?.original){
    const {original,originalSha256,originalBytes}=entry.media;
    const url=new URL(original);
    assert.equal(url.origin,'https://proportion-piece-media.mr-adam-clement.workers.dev',label+' original origin');
    assert.match(originalSha256,/^[a-f0-9]{64}$/);
    assert.ok(Number.isSafeInteger(originalBytes)&&originalBytes>0,label+' invalid original byte count');
    assert.equal(url.pathname,'/editions/'+date+'/'+entry.id+'/original-'+originalSha256+'.jpg',label+' immutable original key');
    const tags=html.match(/<img\b[^>]*>/g)||[];
    assert.ok(tags.some(tag=>tag.includes('data-image-file="'+entry.imageFile+'"')&&tag.includes(' src="'+original+'"')),label+' HTML source differs from metadata');
    let bytes;
    for(let attempt=0;attempt<3;attempt++){
      try{
        const response=await request(original,{signal:AbortSignal.timeout(15000),redirect:'error'});
        if(!response.ok)throw Error('HTTP '+response.status);
        bytes=Buffer.from(await response.arrayBuffer());break;
      }catch(error){if(attempt===2)throw Error(label+' unavailable: '+error.message,{cause:error});}
    }
    assert.equal(bytes.length,originalBytes,label+' original byte count mismatch');
    assert.equal(createHash('sha256').update(bytes).digest('hex'),originalSha256,label+' original SHA-256 mismatch');
    assert.ok(bytes[0]===0xff&&bytes[1]===0xd8,label+' original is not JPEG');
    return 'r2';
  }
  const bytes=await readFile(join('gallery',date,entry.imageFile));
  assert.ok(bytes.length>0,label+' empty historical source painting');
  return 'local';
}
test('every archive floor has readable artwork and every solo portrait can be re-rendered in hybrid mode',{timeout:240000},async()=>{
  assert.ok(archive.days.length>20,'Historical archive is unexpectedly incomplete');
  let eligible=0,confluences=0,local=0,r2=0;
  const checks=[];
  const report=[];
  for(const {date} of archive.days){
    assert.match(date,/^20\d{2}-\d{2}-\d{2}$/);
    const meta=JSON.parse(await readFile(join('gallery',date,'meta.json'),'utf8'));
    const portraits=meta.entries.filter(e=>e.orientation==='portrait'&&
      e.material!=='confluence'&&!String(e.imageFile).includes('-C0'));
    const html=await readFile(join('gallery',date,'index.html'),'utf8');
    const valid=portraits.length;
    for(const entry of portraits){
      assert.ok(entry.imageFile,'Portrait missing artwork filename '+date);
      checks.push(async()=>{const storage=await verifyOriginal(date,entry,html);if(storage==='r2')r2++;else local++;eligible++;});
    }
    confluences+=meta.entries.filter(e=>e.orientation==='portrait'&&
      (e.material==='confluence'||String(e.imageFile).includes('-C0'))).length;
    report.push({date,eligible:valid});
  }
  // Bound network concurrency and wait for every check before reporting coverage.
  for(let i=0;i<checks.length;i+=8)await Promise.all(checks.slice(i,i+8).map(check=>check()));
  assert.ok(eligible>40,'Expected a substantial archive of solo portrait sculptures');
  console.log('HYBRID_TEST_TOWER_COVERAGE '+JSON.stringify({
    floors:report.length,eligiblePortraits:eligible,
    confluenceExcluded:confluences,localOriginals:local,r2Originals:r2,
    source:'original archival painting JPEGs',
    method:'hybrid',support:'museum pin',
    generation:'test-only, on-demand per-floor re-bake'
  }));
});
test('R2 verification rejects wrong bytes and mismatched HTML',async()=>{
  const bytes=Buffer.from([255,216,255,217]);
  const hash=createHash('sha256').update(bytes).digest('hex');
  const date='2026-11-26',id=date+'-G02',imageFile=id+'-portrait.jpg';
  const original='https://proportion-piece-media.mr-adam-clement.workers.dev/editions/'+date+'/'+id+'/original-'+hash+'.jpg';
  const entry={id,imageFile,media:{original,originalSha256:hash,originalBytes:bytes.length}};
  const html='<img data-image-file="'+imageFile+'" src="'+original+'">';
  assert.equal(await verifyOriginal(date,entry,html,async()=>new Response(bytes)),'r2');
  await assert.rejects(verifyOriginal(date,entry,html,async()=>new Response(Buffer.from([255,216,0,217]))),/SHA-256 mismatch/);
  await assert.rejects(verifyOriginal(date,entry,'',async()=>new Response(bytes)),/HTML source differs/);
  await assert.rejects(verifyOriginal(date,entry,html,async()=>new Response(bytes.subarray(0,2))),/byte count mismatch/);
});
test('test-only page builder never patches the live renderer or the publishing workflow',async()=>{
  const builder=await readFile('automation/build-hybrid-tower-test.mjs','utf8');
  assert.match(builder,/gallery\/visit\/gallery-phi-hybrid-test-bundle\.js/);
  assert.match(builder,/gallery\/visit\/gallery-phi\.js/);
  assert.match(builder,/sculpture-render-traced/);
  const renderer=await readFile('gallery/hybrid-tower-test/sculpture-render-hybrid.mjs','utf8');
  assert.match(renderer,/buildMaterialSculpture\('hybrid'/);
  assert.match(renderer,/createHybridSupport\(body,'pin'/);
  assert.match(renderer,/galleryDisposed/);
  const live=await readFile('gallery/visit/sculpture-render-traced.mjs','utf8');
  assert.doesNotMatch(live,/hybrid-tower-test/);
  assert.doesNotMatch(live,/createHybridSupport/);
  assert.ok(existsSync('automation/build-gallery-sculptures.mjs'));
});
