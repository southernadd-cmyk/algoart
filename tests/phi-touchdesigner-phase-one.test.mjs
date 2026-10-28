import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validateTouchDesignerTriptych,TOUCHDESIGNER_TRIPTYCH_MANIFEST} from '../gallery/visit/phi-touchdesigner-media.mjs';

const manifest=JSON.parse(await readFile(new URL('../gallery/visit/touchdesigner/phase-one.json',import.meta.url),'utf8'));
const gallery=JSON.parse(await readFile(new URL('../gallery/2026-10-27/meta.json',import.meta.url),'utf8'));

test('TouchDesigner Phase 1 is unpublished until the exact verified video is committed',async()=>{
 assert.equal(manifest.triptych.file,'phase-one-triptych.webm');
 assert.equal(TOUCHDESIGNER_TRIPTYCH_MANIFEST.pathname.endsWith('/touchdesigner/phase-one.json'),true);
 if(manifest.status==='awaiting-touchdesigner-export'){
  assert.equal(validateTouchDesignerTriptych(manifest),null);
  return;
 }
 assert.equal(manifest.status,'published');
 assert.ok(validateTouchDesignerTriptych(manifest));
 const video=await readFile(new URL('../gallery/visit/touchdesigner/phase-one-triptych.webm',import.meta.url));
 const sha=createHash('sha256').update(video).digest('hex');
 assert.equal(video.length,3384087,'Unexpected TouchDesigner media size');
 assert.equal(sha,'d64dd7eda6c7bbb62ce90a19c8543791b455d16989a875fa4b7a72914c0ff9d0',
  'TouchDesigner movie must be the verified source file');
 assert.equal(manifest.triptych.sha256,sha);
 assert.equal(manifest.triptych.sizeBytes,video.length);
});

test('TouchDesigner source points to an authentic reproducible daily study',()=>{
 const study=gallery.entries.find(x=>x.seed===manifest.artwork.seed);
 assert.ok(study);
 assert.equal(study.series,'Golden Trajectories');
 assert.equal(manifest.artwork.title,study.title);
 assert.equal(manifest.artwork.editorUrl,study.shareUrl);
 assert.equal(manifest.artwork.settings.phiStrength,study.settings.phiStrength);
 assert.equal(manifest.artwork.settings.goldenAngle,study.settings.goldenAngle);
 assert.equal(manifest.artwork.settings.spiralInfluence,study.settings.spiralInfluence);
 const target=new URL(manifest.artwork.sourceImage,TOUCHDESIGNER_TRIPTYCH_MANIFEST);
 assert.equal(target.pathname.endsWith('/gallery/2026-10-27/'+study.imageFile),true);
});

test('Published triptych requires three correctly sized panels and a safe media filename',()=>{
 const enabled={...manifest,status:'published'};
 assert.deepEqual(validateTouchDesignerTriptych(enabled),{
  file:'phase-one-triptych.webm',width:1152,height:240,panelWidth:384,panelHeight:240
 });
 assert.equal(validateTouchDesignerTriptych({...enabled,triptych:{...manifest.triptych,file:'../../secret.mp4'}}),null);
 assert.equal(validateTouchDesignerTriptych({...enabled,triptych:{...manifest.triptych,panelCount:2}}),null);
 assert.equal(validateTouchDesignerTriptych({...enabled,triptych:{...manifest.triptych,width:1153}}),null);
 assert.equal(validateTouchDesignerTriptych({...enabled,triptych:{...manifest.triptych,fps:120}}),null);
});

test('Watercolour triptych is independently verified and never replaces the original source',async()=>{
 const wc=JSON.parse(await readFile(new URL('../gallery/visit/touchdesigner/watercolour-burst.json',import.meta.url),'utf8'));
 assert.equal(wc.status,'published');
 assert.equal(wc.artwork.seed,'AA-20261005-03-55769');
 assert.equal(wc.artwork.material,'watercolour-v2s');
 assert.equal(wc.artwork.settings.phiStrength,91);
 assert.equal(wc.artwork.settings.goldenAngle,93);
 assert.equal(wc.artwork.settings.spiralInfluence,63);
 assert.ok(validateTouchDesignerTriptych(wc),'Watercolour manifest must pass validated VP9 contract');
 assert.equal(wc.triptych.file,'watercolour-burst-AA-20261005-03-55769-triptych.webm');
 const bytes=await readFile(new URL('../gallery/visit/touchdesigner/'+wc.triptych.file,import.meta.url));
 const hash=createHash('sha256').update(bytes).digest('hex');
 assert.equal(bytes.length,4867895,'Unexpected watercolour video size');
 assert.equal(hash,'dfba634571fd77cbf7c7e8666b73cfb6aa16b29f33c88ad77bb1019a59a884da');
 assert.equal(wc.triptych.sha256,hash);
 assert.equal(wc.triptych.sizeBytes,bytes.length);
 assert.equal(manifest.triptych.file,'phase-one-triptych.webm','Original video remains the first row');
});
