import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveStudyMaterial,materialProfile} from '../../gallery/visit/study-material.mjs';

test('Replays each of the five material families and their exact archive versions',()=>{
  const cases=[
    ['?v=9&seed=M1&mode=rects','marker','marker','marker'],
    ['?v=8&seed=T1&tissue=7','watercolor','tissue','tissue-7'],
    ['?v=9&seed=W1&material=watercolour-v2s&fit=0&sheet=phi','watercolour','watercolour','watercolour-v2s'],
    ['?v=9&seed=O1&material=oil-v4','oil','oil','oil-v4'],
    ['?v=9&seed=A1&material=action-v2','action','action','action-v2']
  ];
  for(const [href,archiveLabel,type,revision] of cases){
    const metadata=resolveStudyMaterial(href,archiveLabel);
    assert.equal(metadata.type,type);
    assert.equal(metadata.revision,revision);
    assert.equal(metadata.profile,materialProfile(type));
    assert.ok(metadata.seed);
    assert.ok(metadata.rendererVersion>=8);
    assert.equal(metadata.exactMaterialShapesAvailableFromSvg,type==='marker');
  }
});
test('Preserves historical material and framing behaviour',()=>{
  const old=resolveStudyMaterial('?v=6&seed=OLD&tissue=2&fmt=portrait','watercolor');
  assert.equal(old.type,'tissue');
  assert.equal(old.revision,'tissue-2');
  assert.equal(old.orientation,'portrait');
  assert.equal(old.rendererVersion,6);
  const legacy=resolveStudyMaterial('?v=8&seed=WC&material=watercolour-v2s&fit=1','watercolour');
  assert.equal(legacy.legacyMaterialFit,true);
  assert.equal(legacy.phiSheetFraming,false);
  const shared=resolveStudyMaterial('?v=9&seed=WC&material=watercolour-v2t&fit=0&sheet=phi','watercolour');
  assert.equal(shared.phiSheetFraming,true);
  assert.equal(shared.legacyMaterialFit,false);
});
test('SVG alone is not assumed to describe material-dependent paint geometry',()=>{
  for(const material of ['tissue','watercolour','oil','action']){
    const profile=materialProfile(material);
    assert.notEqual(profile.geometry,'recorded-strokes');
    assert.ok(profile.note.length>20);
  }
  assert.equal(materialProfile('marker').geometry,'recorded-strokes');
});
