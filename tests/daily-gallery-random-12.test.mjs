// Synthetic future-date integration test: 12 gallery artworks and social archive.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {editorArtworkLink} from '../automation/captions.mjs';
const day='2099-11-10';
const root=process.cwd();
const dir=path.join(root,'gallery',day);
const nov8=fs.readFileSync('gallery/2026-11-08/meta.json');
assert.equal(JSON.parse(nov8).entries.length,18,'8 November archive must remain 18');
assert(!fs.existsSync(dir),'Synthetic gallery date already in use');
function run(script,env={}){
 const res=spawnSync(process.execPath,[script],{
   cwd:root,encoding:'utf8',timeout:360000,maxBuffer:16*1024*1024,
   env:{...process.env,SOCIAL_DATE:day,...env}
 });
 assert.equal(res.status,0,'Failed '+script+':\n'+res.stdout.slice(-2400)+'\n'+res.stderr.slice(-2400));
}
run('automation/generate-gallery-daily-12.mjs');
const q=JSON.parse(fs.readFileSync(path.join('social-output',day,'gallery','queue.json')));
assert.equal(q.edition,'random-12');
assert.equal(q.publishingEnabled,false);
assert.equal(q.entries.length,12);
assert.equal(new Set(q.entries.map(e=>e.seed)).size,12);
assert.equal(new Set(q.entries.map(e=>e.id)).size,12);
assert.equal(q.entries.filter(e=>e.orientation==='portrait').length,6);
assert.equal(q.entries.filter(e=>e.orientation==='landscape').length,6);
for(const e of q.entries){
 assert.match(e.id,/^2099-11-10-G\d{2}$/);
 assert.equal(e.rendererVersion,10,'Gallery art uses V10');
 assert.equal(new URL(e.shareUrl).searchParams.get('v'),'10');
 assert(e.settings.mode,'Missing engine');
 assert(e.settings.palette,'Missing palette');
 assert(e.settings.seed,'Missing source seed');
 assert(['marker','watercolor','watercolour','oil','action'].includes(e.material),'Invalid gallery material');
 assert.equal(editorArtworkLink(e),'https://southernadd-cmyk.github.io/algoart/?art='+e.id);
 assert(fs.statSync(path.join('social-output',day,'gallery',e.imageFile)).size>10000,'No rendered art');
}
run('automation/build-gallery.mjs',{GALLERY_QUEUE_MATERIAL:'random'});
const m=JSON.parse(fs.readFileSync(path.join(dir,'meta.json')));
assert.equal(m.count,12);
assert.equal(m.entries.length,12);
assert(fs.existsSync(path.join(dir,'random-edition.json')));
for(const e of m.entries){
 const jpeg=fs.readFileSync(path.join('social-output',day,'gallery',e.imageFile));
 assert.deepEqual(fs.readFileSync(path.join(dir,e.imageFile)),jpeg,'Gallery binary mismatch');
}
const galleryBefore=fs.readFileSync(path.join(dir,'meta.json'));
const imageBefore=new Map(m.entries.map(e=>[e.id,fs.readFileSync(path.join(dir,e.imageFile))]));
// Simulate a later social-only job; it must not change the gallery twelve.
run('automation/generate-social.mjs',{
 SOCIAL_COUNT:'1',SOCIAL_MATERIAL:'oil',SOCIAL_ORIENTATION:'landscape'
});
const social=JSON.parse(fs.readFileSync(path.join('social-output',day,'oil','landscape','queue.json')));
run('automation/build-gallery.mjs',{
 GALLERY_QUEUE_MATERIAL:'oil',GALLERY_QUEUE_ORIENTATION:'landscape'
});
assert.deepEqual(fs.readFileSync(path.join(dir,'meta.json')),galleryBefore,
 'Social archiving changed the twelve-study gallery');
const savedSocial=JSON.parse(fs.readFileSync(path.join(dir,'social-meta.json')));
for(const item of social.entries){
 const e=savedSocial.entries.find(x=>x.id===item.id);
 assert(e,'Lost social artwork link');
 assert.equal(e.shareUrl,item.shareUrl);
 assert.equal(e.rendererVersion,10);
 assert(fs.existsSync(path.join(dir,e.imageFile)),'Social-only JPEG missing');
}
for(const e of m.entries)assert.deepEqual(fs.readFileSync(path.join(dir,e.imageFile)),
 imageBefore.get(e.id),'Social job repainted gallery work');
run('automation/build-gallery.mjs',{GALLERY_QUEUE_MATERIAL:'random'});
const latest=JSON.parse(fs.readFileSync(path.join(dir,'meta.json')));
assert.deepEqual(latest.entries,m.entries,'Gallery replay changed the chosen artworks');
assert.deepEqual(fs.readFileSync('gallery/2026-11-08/meta.json'),nov8,
 'New gallery edition rewrote 8 November history');
console.log('PASS: twelve distinct V10 studies, six of each format, immutable JPEGs and independent social links.');
