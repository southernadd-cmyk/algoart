// Sculpture V2 test tower: archive coverage and strict production isolation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
const read=async file=>readFile(file,'utf8');
test('all eligible historical portrait studies have source paintings',async()=>{
  const archive=JSON.parse(await read('gallery/archive.json'));
  assert.ok(archive.days.length>=30,'Historical floor count unexpectedly small');
  const perDate=[];
  let eligible=0,confluence=0;
  for(const {date} of archive.days){
    const meta=JSON.parse(await read(join('gallery',date,'meta.json')));
    assert.equal(meta.date,date);
    let count=0;
    for(const item of meta.entries){
      if(item.orientation!=='portrait')continue;
      if(item.material==='confluence'){
        confluence++;continue;
      }
      assert.ok(item.seed&&item.imageFile, date+' source metadata incomplete');
      assert.ok(existsSync(join('gallery',date,item.imageFile)),
        date+' missing '+item.imageFile);
      eligible++;count++;
    }
    perDate.push({date,eligible:count});
  }
  assert.ok(eligible>40,'No representative portrait sculpture archive');
  console.log('V2_PREVIEW_ARCHIVE_COVERAGE '+JSON.stringify({
    floors:perDate.length,eligible,confluenceExcluded:confluence,
    allOriginalPaintingsPreserved:true,perDate
  }));
});
test('V2 adapter preserves public renderer contract without publishing',async()=>{
  const source=await read('gallery/sculpture-v2-test/sculpture-render-v2.mjs');
  const builder=await read('automation/build-sculpture-v2-test.mjs');
  const v1=await read('gallery/visit/sculpture-render-traced.mjs');
  const daily=await read('automation/build-gallery-sculptures.mjs');
  assert.match(source,/export function createPortraitSculpture/);
  assert.match(source,/export function setSculptureArchitecturalMaterials/);
  assert.match(source,/downloadV2Prepared/);
  const loader=await read('gallery/sculpture-v2-test/v2-pack-loader.mjs');
  assert.match(loader,/getV2R2Catalog/);
  assert.match(loader,/SHA-256 mismatch/);
  assert.match(loader,/source:'pages',fallback:/);
  assert.match(source,/reconstructV2Study/);
  assert.doesNotMatch(source,/segmentPainting\(/);
  assert.match(source,/createHybridSupport\(body,'pin'/);
  assert.match(source,/galleryDisposed/);
  assert.match(source,/refuseConfluence/);
  assert.match(source,/onComplete/);
  assert.match(source,/omittedCells/);
  assert.match(builder,/gallery-phi-sculpture-v2-test-bundle\.js/);
  assert.match(builder,/gallery\/visit\/gallery-phi\.js/);
  assert.match(builder,/sculpture-render-traced/);
  assert.match(builder,/replaced exactly once|rendererReplacements,1/);
  assert.doesNotMatch(v1,/sculpture-v2-test/);
  assert.doesNotMatch(daily,/sculpture-v2-test/);
});
test('frozen V2 topology retains even isolated micro-islands',async()=>{
  const {segmentPainting}=await import(
    '../gallery/sculpture-v2-test/engine/v4-topology.mjs');
  const w=108,h=152,data=new Uint8ClampedArray(w*h*4);
  for(let i=0;i<w*h;i++){
    data[i*4]=245;data[i*4+1]=240;data[i*4+2]=230;data[i*4+3]=255;
  }
  for(let y=10;y<140;y+=9)for(let x=8;x<100;x+=9){
    const j=(y*w+x)*4;
    data[j]=94;data[j+1]=38;data[j+2]=132;
  }
  const {extractContours}=await import(
    '../gallery/sculpture-v2-test/engine/v4-contours.mjs');
  for(const maxRegions of [48,72]){
    const topology=segmentPainting({width:w,height:h,data},{
      material:'marker',maxRegions});
    assert.ok(topology.pigmented>60,'Missing pigment-island test cells');
    assert.equal(topology.omittedCells,0);
    assert.equal(topology.covered,topology.pigmented);
    assert.ok(topology.regions.length<=maxRegions);
    assert.equal(topology.omittedRegions,0);
    assert.ok(topology.groupedSmallIslands>0,
      'Expected grouped, not silently discarded, small islands');
    for(const region of topology.regions){
      const rings=extractContours(region,.75);
      assert.ok(rings.length>0,
        'Original pigment region must reconstruct a physical contour');
    }
  }
});
test('single-pixel pigment islands can produce actual closed sculpture geometry',async()=>{
  const THREE=await import('three');
  const {segmentPainting}=await import(
    '../gallery/sculpture-v2-test/engine/v4-topology.mjs');
  const {buildV4Sculpture,disposeV4Sculpture}=await import(
    '../gallery/sculpture-v2-test/engine/v4-surface.mjs');
  const w=108,h=152,data=new Uint8ClampedArray(w*h*4);
  for(let i=0;i<w*h;i++){
    data[i*4]=245;data[i*4+1]=240;data[i*4+2]=230;data[i*4+3]=255;
  }
  for(const [x,y] of [[12,12],[54,76],[90,130],[18,122],[92,24]]){
    const k=(y*w+x)*4;
    data[k]=30;data[k+1]=42;data[k+2]=156;
  }
  const pixels={width:w,height:h,data};
  const topo=segmentPainting(pixels,{material:'marker',maxRegions:48});
  assert.equal(topo.omittedCells,0);
  const texture=new THREE.DataTexture(new Uint8Array(data),w,h,THREE.RGBAFormat);
  texture.needsUpdate=true;
  try{
    const group=buildV4Sculpture('medial',{
      topology:topo,texture,quality:'mobile',material:'marker'
    });
    assert.ok(group.userData.polygonTriangles>0);
    assert.equal(group.userData.omittedCells,0);
    assert.equal(group.userData.regionCount,topo.regions.length);
    disposeV4Sculpture(group);
  }finally{texture.dispose();}
});
test('V1 geometry packs are not overwritten by the V2 preview build',async()=>{
  const archive=JSON.parse(await read('gallery/archive.json'));
  const available=archive.days.filter(({date})=>
    existsSync(join('gallery',date,'3d','sculptures.json.gz')));
  assert.ok(available.length>20,'Existing V1 data disappeared');
  const builder=await read('automation/build-sculpture-v2-test.mjs');
  assert.doesNotMatch(builder,/writeFile\([^)]*sculptures\.json\.gz/);
  const live=await read('gallery/visit/index.html');
  assert.match(live,/gallery-phi-bundle\.js\?v=/);
  assert.doesNotMatch(live,/sculpture-v2-test-bundle/);
});
