import test from 'node:test';
import assert from 'node:assert/strict';
import {decidePagesBuild, isIsolatedStatic} from '../automation/pages-build-scope.mjs';
const sha='a'.repeat(40);
const valid = paths => ({eventName:'push', before:sha, parent:sha, head:'b'.repeat(40), paths});

test('an isolated Sculpture Lab change avoids recompiling the virtual gallery',()=>{
  assert.equal(decidePagesBuild(valid(['gallery/sculpture-lab/index.html','gallery/sculpture-lab/lab-v2.mjs'])).rebuild,false);
});
test('isolated site design, press and about changes use the static path',()=>{
  assert.equal(decidePagesBuild(valid(['index.html','css/style.css','about/index.html','press/press-kit.pdf','test/tissue-v8/index.html'])).rebuild,false);
});
test('gallery date and archive changes always run all release checks, protecting R2 canary',()=>{
  assert.equal(decidePagesBuild(valid(['gallery/2026-11-11/index.html'])).rebuild,true);
  assert.equal(decidePagesBuild(valid(['gallery/archive.json'])).rebuild,true);
});
test('gallery engine, shared editor, bundle source and dependencies force full build',()=>{
  for(const p of ['gallery/visit/gallery-phi.js','gallery/visit/study-material.mjs','js/generator.js','confluence/engine/foo.js','automation/build-gallery.mjs','package-lock.json','test/virtual-gallery/gallery-phi.js'])
    assert.equal(decidePagesBuild(valid([p])).rebuild,true,p);
});
test('mixed changes never take fast path',()=>{
  assert.equal(decidePagesBuild(valid(['gallery/sculpture-lab/index.html','gallery/visit/gallery-phi.js'])).rebuild,true);
});
test('manual, upstream workflow and ambiguous pushes always fully rebuild',()=>{
  assert.equal(decidePagesBuild({...valid(['index.html']),eventName:'workflow_dispatch'}).rebuild,true);
  assert.equal(decidePagesBuild({...valid(['index.html']),eventName:'workflow_run'}).rebuild,true);
  assert.equal(decidePagesBuild({...valid(['index.html']),parent:'c'.repeat(40)}).rebuild,true);
  assert.equal(decidePagesBuild({...valid(['index.html']),before:'0'.repeat(40),parent:'0'.repeat(40)}).rebuild,true);
  assert.equal(decidePagesBuild({...valid(['index.html']),paths:[]}).rebuild,true);
});
test('internal and test files do not bypass gallery validation',()=>{
  assert.equal(isIsolatedStatic('.github/workflows/deploy-pages.yml'),false);
  assert.equal(isIsolatedStatic('test/virtual-gallery/index.html'),false);
  assert.equal(isIsolatedStatic('gallery/hybrid-tower-test/index.html'),false);
});
