import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateTouchDesignerTriptych,TOUCHDESIGNER_TRIPTYCH_MANIFEST} from '../gallery/visit/phi-touchdesigner-media.mjs';

const manifest=JSON.parse(await readFile(new URL('../gallery/visit/touchdesigner/phase-one.json',import.meta.url),'utf8'));
const gallery=JSON.parse(await readFile(new URL('../gallery/2026-10-27/meta.json',import.meta.url),'utf8'));

test('TouchDesigner Phase 1 starts safely unpublished, with no fictional video asset',()=>{
 assert.equal(manifest.status,'awaiting-touchdesigner-export');
 assert.equal(validateTouchDesignerTriptych(manifest),null);
 assert.equal(manifest.triptych.file,'phase-one-triptych.webm');
 assert.equal(TOUCHDESIGNER_TRIPTYCH_MANIFEST.pathname.endsWith('/touchdesigner/phase-one.json'),true);
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
