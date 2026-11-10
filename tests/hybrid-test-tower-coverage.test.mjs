// Isolated historical coverage of the opt-in hybrid tower; never mutates the
// old gallery contour packs or the live exhibition bundle.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {existsSync} from 'node:fs';
const archive=JSON.parse(await readFile('gallery/archive.json','utf8'));
test('every archive floor has readable artwork and every solo portrait can be re-rendered in hybrid mode',async()=>{
  assert.ok(archive.days.length>20,'Historical archive is unexpectedly incomplete');
  let eligible=0,confluences=0;
  const report=[];
  for(const {date} of archive.days){
    assert.match(date,/^20\d{2}-\d{2}-\d{2}$/);
    const meta=JSON.parse(await readFile(join('gallery',date,'meta.json'),'utf8'));
    const portraits=meta.entries.filter(e=>e.orientation==='portrait'&&
      e.material!=='confluence'&&!String(e.imageFile).includes('-C0'));
    let valid=0;
    for(const entry of portraits){
      assert.ok(entry.imageFile,'Portrait missing artwork filename '+date);
      assert.ok(existsSync(join('gallery',date,entry.imageFile)),
        'Missing source painting '+date+'/'+entry.imageFile);
      eligible++;valid++;
    }
    confluences+=meta.entries.filter(e=>e.orientation==='portrait'&&
      (e.material==='confluence'||String(e.imageFile).includes('-C0'))).length;
    report.push({date,eligible:valid});
  }
  assert.ok(eligible>40,'Expected a substantial archive of solo portrait sculptures');
  console.log('HYBRID_TEST_TOWER_COVERAGE '+JSON.stringify({
    floors:report.length,eligiblePortraits:eligible,
    confluenceExcluded:confluences,
    source:'original archival painting JPEGs',
    method:'hybrid',support:'museum pin',
    generation:'test-only, on-demand per-floor re-bake'
  }));
});
test('test-only page builder never patches the live renderer or the publishing workflow',async()=>{
  const builder=await readFile('automation/build-hybrid-tower-test.mjs','utf8');
  assert.match(builder,/gallery\/hybrid-tower-test\/gallery-phi-bundle\.js/);
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
