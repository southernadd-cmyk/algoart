// Synthetic future-date integration test: 12 solo studies, a Confluence pair and an independent social archive.
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
// The 09:00 social run may precede a delayed scheduled gallery run.
// It must remain accessible after the 12-gallery format replaces the page.
run('automation/generate-social.mjs',{
 SOCIAL_COUNT:'1',SOCIAL_MATERIAL:'marker',SOCIAL_ORIENTATION:'landscape'
});
const morning=JSON.parse(fs.readFileSync(path.join('social-output',day,'queue.json')));
run('automation/build-gallery.mjs',{GALLERY_QUEUE_MATERIAL:'marker'});
assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'meta.json'))).entries.length,1);
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
run('automation/generate-gallery-confluence.mjs');
run('automation/build-gallery.mjs',{GALLERY_QUEUE_MATERIAL:'random'});
const m=JSON.parse(fs.readFileSync(path.join(dir,'meta.json')));
assert.equal(m.count,14);
assert.equal(m.entries.length,14);
const confluence=m.entries.filter(entry=>entry.material==='confluence');
assert.deepEqual(confluence.map(entry=>entry.orientation).sort(),['landscape','portrait']);
assert(confluence.every(entry=>new URL(entry.shareUrl).searchParams.has('s')),
 'Each Confluence work needs its full shared-canvas state');
assert(fs.existsSync(path.join(dir,'random-edition.json')));
const migrated=JSON.parse(fs.readFileSync(path.join(dir,'social-meta.json')));
assert(migrated.entries.some(e=>e.id===morning.entries[0].id),
 'Early social artwork was not migrated before replacing the gallery');
assert(fs.existsSync(path.join(dir,morning.entries[0].imageFile)),
 'Early social JPEG was lost during daily gallery migration');
for(const e of m.entries){
 const jpeg=fs.readFileSync(path.join('social-output',day,'gallery',e.imageFile));
 assert.deepEqual(fs.readFileSync(path.join(dir,e.imageFile)),jpeg,'Gallery binary mismatch');
}
const galleryBefore=fs.readFileSync(path.join(dir,'meta.json'));
const imageBefore=new Map(m.entries.map(e=>[e.id,fs.readFileSync(path.join(dir,e.imageFile))]));
// Simulate a later social-only job; it must not change the published edition.
run('automation/generate-social.mjs',{
 SOCIAL_COUNT:'1',SOCIAL_MATERIAL:'oil',SOCIAL_ORIENTATION:'landscape'
});
const social=JSON.parse(fs.readFileSync(path.join('social-output',day,'oil','landscape','queue.json')));
run('automation/build-gallery.mjs',{
 GALLERY_QUEUE_MATERIAL:'oil',GALLERY_QUEUE_ORIENTATION:'landscape'
});
assert.deepEqual(fs.readFileSync(path.join(dir,'meta.json')),galleryBefore,
 'Social archiving changed the published edition');
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
console.log('PASS: twelve distinct solo V10 studies, one Confluence pair, immutable JPEGs and independent social links.');
