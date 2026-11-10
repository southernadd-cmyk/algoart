// Integrity gate for the isolated tower. Does not mutate archives.
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const sha=b=>createHash('sha256').update(b).digest('hex');
const root='gallery/visit/test-sculpture-packs';
const manifest=JSON.parse(await fs.readFile(path.join(root,'manifest.json'),'utf8'));
assert.equal(manifest.version,2);
assert.equal(manifest.method,'hybrid');
assert.equal(manifest.mount,'museum-pin');
const dates=(await fs.readdir('gallery',{withFileTypes:true}))
 .filter(d=>d.isDirectory()&&/^\d{4}-\d{2}-\d{2}$/.test(d.name))
 .map(d=>d.name).sort();
assert.deepEqual(Object.keys(manifest.dates).sort(),dates,
 'Every archived tower date must have a checked test pack');
let expected=0,totalVariant=0,totalCompressed=0;
for(const date of dates){
 const dir='gallery/'+date;
 const data=await fs.readFile(path.join(root,date+'.json.gz'));
 const descriptor=manifest.dates[date];
 assert.equal(descriptor.sha256,sha(data),'Changed untracked bake data '+date);
 assert.equal(data.length,descriptor.compressedBytes);
 const pack=JSON.parse(zlib.gunzipSync(data));
 assert.equal(pack.version,2);
 assert.equal(pack.date,date);
 assert.equal(pack.method,'hybrid');
 assert.equal(pack.mount,'museum-pin');
 assert.equal(pack.format,'hybrid-indexed-13b-u32-v2');
 const html=await fs.readFile(path.join(dir,'index.html'),'utf8');
 const meta=JSON.parse(await fs.readFile(path.join(dir,'meta.json'),'utf8'));
 const cards=[...html.matchAll(/<article\b[^>]*class="[^"]*\bart-card\b[^"]*"[^>]*>[\s\S]*?<\/article>/gi)];
 assert.equal(cards.length,meta.entries.length,'Gallery metadata/card parity '+date);
 const portraits=new Set();
 for(const [card] of cards){
  const tag=card.match(/<article\b[^>]*>/i)?.[0]||'';
  const image=card.match(/<img\b[^>]*>/i)?.[0]||'';
  const w=Number(image.match(/\bwidth="(\d+)"/i)?.[1]||0);
  const h=Number(image.match(/\bheight="(\d+)"/i)?.[1]||0);
  if(tag.match(/\bdata-orientation="([^"]+)"/i)?.[1]!=='portrait'&&h<=w)continue;
  const src=image.match(/\bsrc="([^"]+)"/i)?.[1]||'';
  const filename=decodeURIComponent(src.split('/').pop().split('?')[0]);
  const entry=meta.entries.find(e=>e.imageFile===filename);
  assert.ok(entry,'Portrait metadata missing '+date+'/'+filename);
  if(entry.material==='confluence'||/\/confluence\//.test(entry.shareUrl||''))continue;
  portraits.add(filename);
 }
 assert.deepEqual(Object.keys(pack.studies).sort(),[...portraits].sort(),
  'Historical portrait selection differs from live tower: '+date);
 assert.equal(pack.portraitCount,portraits.size);
 for(const [filename,variants] of Object.entries(pack.studies)){
  const source=await fs.readFile(path.join(dir,filename));
  assert.equal(variants.sourceSha256,sha(source),
   'A source painting changed since the experimental bake');
  for(const quality of ['mobile','desktop']){
   const obj=variants[quality];
   assert.equal(obj.quality,quality);
   assert.equal(obj.method,'hybrid');
   assert.equal(obj.mount,'museum-pin');
   assert.equal(obj.sourceImage,filename);
   assert.equal(obj.format,pack.format);
   assert.ok(obj.hasFront&&obj.hasBack&&obj.hasSides);
   assert.equal(obj.triangles*3,obj.indices);
   assert.ok(obj.vertices>=150&&obj.vertices<=220000,
    'No actual sculptural mesh in '+date+'/'+filename);
   const raw=Buffer.from(obj.packed,'base64');
   assert.equal(raw.length,obj.vertices*13,'Broken vertex byte packing');
   const indices=Buffer.from(obj.indexPacked||'','base64');
   assert.equal(indices.length,obj.indices*4,'Broken indexed triangle stream');
   for(let i=0;i<indices.length;i+=4)
    assert.ok(indices.readUInt32LE(i)<obj.vertices,'Index outside vertex count');
   assert.ok(obj.max[2]-obj.min[2]>.10,'Baked geometry has no 3D depth');
   totalVariant++;
  }
 }
 assert.equal(descriptor.portraits,portraits.size);
 expected+=portraits.size;
 totalCompressed+=data.length;
}
assert.equal(expected,manifest.totalPortraits);
assert.equal(totalVariant,manifest.totalVariants);
assert.equal(totalVariant,expected*2);
assert.equal(totalCompressed,manifest.totalCompressedBytes);
assert.ok(expected>=25,'Historical archive rebake unexpectedly sparse');
assert.ok(totalCompressed<190*1024*1024,
 'Refusing huge test packs that could break GitHub Pages');
console.log('TEST_TOWER_GEOMETRY_ARCHIVE_VALID',JSON.stringify({
 days:dates.length,portraits:expected,variants:totalVariant,
 compressedMiB:Math.round(totalCompressed/1048576*100)/100,
 liveArchivePacksModified:false
}));
