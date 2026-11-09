import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import path from "node:path";
import {test} from "node:test";

const root=process.env.R2_STAGE_SOURCE || "live-snapshot";
const staged=process.env.R2_STAGE_OUTPUT || "/tmp/pp-r2-daily-stage";
const date=process.env.R2_EDITION_DATE || "2026-11-09";
const g="gallery/"+date+"/";
const worker="https://proportion-piece-media.mr-adam-clement.workers.dev";
const read=(base,file)=>readFileSync(path.join(base,file),"utf8");
const json=(base,file)=>JSON.parse(read(base,file));
const original=json(root,g+"meta.json");
const meta=json(staged,g+"meta.json");
const originalArchive=json(root,"gallery/archive.json");
const archive=json(staged,"gallery/archive.json");
const pub=json(staged,"media-publication.json");
const originalTextures=json(root,g+"3d/manifest.json");
const textures=json(staged,g+"3d/manifest.json");
const dayPage=read(staged,g+"index.html");
const dailyIndex=read(staged,"gallery/index.html");
const originalDayPage=read(root,g+"index.html");
const count=(s,needle)=>s.split(needle).length-1;

test("staging is complete and strictly outside the production root",()=>{
  assert.equal(pub.date,date);
  assert.equal(pub.workerBase,worker);
  assert.equal(pub.bucket,"proportion-piece-media-test");
  assert.equal(pub.stageOnly,true);
  assert.equal(pub.published,false);
  assert.equal(pub.count,original.count);
  assert.equal(pub.mediaAssets.length,original.count*3+2);
  assert.equal(meta.mediaCover,pub.mediaAssets.find(a=>a.role==="cover").url);
});
test("every original immutable source file has a unique correctly hashed R2 target",()=>{
  const keys=new Set();
  for(const item of pub.mediaAssets){
    assert.match(item.sha256,/^[a-f0-9]{64}$/);
    assert.match(item.key,/^editions\/\d{4}-\d{2}-\d{2}\/(?:[\w-]+\/(?:original|desktop|mobile)-[a-f0-9]{64}\.(?:jpg|webp)|(?:cover-[a-f0-9]{64}\.jpg|sculptures-[a-f0-9]{64}\.json\.gz))$/);
    assert.equal(item.url,worker+"/"+item.key);
    assert(!keys.has(item.key));
    keys.add(item.key);
    assert(item.bytes>=1000);
  }
});
test("all seeds, exact share links, options, renderer revisions and Confluence states remain unchanged",()=>{
  assert.equal(meta.count,original.count);
  assert.equal(meta.date,original.date);
  for(let i=0;i<meta.entries.length;i++){
    const {media,...entry}=meta.entries[i];
    assert.deepEqual(entry,original.entries[i]);
    assert(media.original.startsWith(worker+"/editions/"+date+"/"));
    assert(media.desktop.includes("/desktop-"));
    assert(media.mobile.includes("/mobile-"));
    assert(dayPage.includes('href="'+entry.shareUrl.replaceAll("&","&amp;")+'"') ||
      originalDayPage.includes('href="'+entry.shareUrl.replaceAll("&","&amp;")+'"') === false);
    if(entry.material==="confluence")assert(new URL(entry.shareUrl).searchParams.get("s"));
  }
});
test("every gallery image uses the Worker but retains original JPEG filename for the 3D tower",()=>{
  for(const e of original.entries){
    const img=pub.mediaAssets.find(a=>a.role==="original"&&a.artworkId===e.id);
    assert.equal(count(dayPage,'data-image-file="'+e.imageFile+'" src="'+img.url+'"'),1);
    assert.equal(count(dayPage,'src="'+e.imageFile+'"'),0);
    assert.equal(count(dayPage,'src="'+img.url+'"'),1);
    assert.equal(textures.images[e.imageFile].desktop,meta.entries.find(x=>x.id===e.id).media.desktop);
    assert.equal(textures.images[e.imageFile].mobile,meta.entries.find(x=>x.id===e.id).media.mobile);
  }
  assert.equal(count(dayPage,"data-image-file="),original.count);
  assert.deepEqual(Object.keys(textures.images),Object.keys(originalTextures.images));
});
test("original archive editions and image paths remain untouched",()=>{
  for(const old of originalArchive.days){
    if(old.date===date)continue;
    assert.deepEqual(archive.days.find(d=>d.date===old.date),old);
  }
  assert.equal(archive.days.length,originalArchive.days.length);
  const current=archive.days.find(d=>d.date===date);
  assert.equal(current.cover,originalArchive.days.find(d=>d.date===date).cover);
  assert.equal(current.mediaCover,pub.mediaAssets.find(a=>a.role==="cover").url);
  assert.equal(current.mediaCoverFallback,pub.mediaAssets.find(a=>a.role==="original").url);
});
test("new archive cover and fallback point to R2, legacy days remain local",()=>{
  assert(dailyIndex.includes(archive.days.find(d=>d.date===date).mediaCover));
  assert(dailyIndex.includes(archive.days.find(d=>d.date===date).mediaCoverFallback));
  const old=originalArchive.days.find(d=>d.date!==date);
  assert(dailyIndex.includes("./"+old.date+"/archive-preview.jpg?"));
  assert(dayPage.includes('property="og:image" content="'+meta.entries[0].media.original+'"'));
  assert(dailyIndex.includes('property="og:image" content="'+meta.entries[0].media.original+'"'));
});
test("both tower implementations and subsequent gallery index regeneration preserve R2 file identity",()=>{
  for(const filename of ["gallery/visit/gallery-v2.js","gallery/visit/gallery-phi.js"]){
    assert(read(".",filename).includes("img.getAttribute('data-image-file')"));
  }
  const builder=read(".","automation/build-gallery.mjs");
  assert(builder.includes("day.mediaCover ||"));
  assert(builder.includes("day.mediaCoverFallback ||"));
  assert(builder.includes("latest.mediaCoverFallback ||"));
});
