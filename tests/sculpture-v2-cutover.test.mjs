import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeGalleryEntry} from '../automation/gallery-entry-template.mjs';

const html=readFileSync('gallery/visit/index.html','utf8');
const deploy=readFileSync('.github/workflows/deploy-pages.yml','utf8');
const builder=readFileSync('automation/build-sculpture-v2-test.mjs','utf8');
const daily=readFileSync('.github/workflows/gallery-daily.yml','utf8');
const follower=readFileSync('.github/workflows/sculpture-v2-postpublish-daily.yml','utf8');
const publisher=readFileSync('automation/publish-sculpture-v2-daily-r2.py','utf8');
const loader=readFileSync('gallery/sculpture-v2-test/v2-pack-loader.mjs','utf8');
test('Production defaults to Gaussian V2 sculptures with an independent V2 mesh rollback',()=>{
  const entry=normalizeGalleryEntry(html);
  assert.match(entry.mesh,/gallery-phi-sculpture-v2-test-bundle\.js\?v=/);
  assert.match(entry.splats,/gallery-phi-splats-bundle\.js\?v=/);
  assert.match(html,/window\.__ppSculptureMode='splats';\s*await import\('\.\/gallery-phi-splats-bundle\.js/);
  assert.match(html,/window\.__ppSculptureMode='mesh';\s*await import\('\.\/gallery-phi-sculpture-v2-test-bundle\.js/);
  assert.match(html,/window\.__ppSculptureMode='mesh-fallback';\s*await import\('\.\/gallery-phi-sculpture-v2-test-bundle\.js/);
  assert.match(entry.html,/<link rel="modulepreload" href="\.\/gallery-phi-sculpture-v2-test-bundle\.js/);
  assert.doesNotMatch(entry.html,/GS6_(HEAD|ENTRY)_|gallery-phi-splats-bundle\.js/);
  assert.doesNotMatch(html,/await import\(useV1|gallery-phi-bundle\.js\?v=classical-aac/);
});
test('Isolated entry rejects inconsistent release selection and missing anchors',()=>{
  assert.throws(()=>normalizeGalleryEntry(html.replace('GS6_HEAD_START','REMOVED_HEAD')),/Exactly one/);
  assert.throws(()=>normalizeGalleryEntry(html.replace(/gallery-phi-splats-bundle\.js\?v=[\w-]+/,'gallery-phi-splats-bundle.js?v=wrong')), /Gaussian release mismatch/);
  assert.throws(()=>normalizeGalleryEntry(html.replace(/gallery-phi-sculpture-v2-test-bundle\.js\?v=[\w-]+/,'gallery-phi-sculpture-v2-test-bundle.js?v=wrong')), /Mesh release mismatch/);
});
test('Release bundle is required and the test mirror retains exact source anchors',()=>{
  assert.match(deploy,/test -s _site\/gallery\/visit\/gallery-phi-sculpture-v2-test-bundle\.js/);
  assert.doesNotMatch(deploy,/Optional Sculpture V2 test tower failed to build/);
  assert.match(builder,/assert\.equal\(rendererReplacements,1/);
  assert.match(builder,/Promise\.resolve\(\{\}\)/);
  assert.match(builder,/Expected exactly one legacy V1 pack request/);
});
test('Future daily editions no longer generate or require V1 sculpture packs',()=>{
  assert.doesNotMatch(daily,/node automation\/build-gallery-sculptures\.mjs/);
  assert.doesNotMatch(daily,/test -s "gallery\/\$DAY\/3d\/sculptures\.json\.gz"/);
  assert.doesNotMatch(follower,/test -s "gallery\/\$DAY\/3d\/sculptures\.json\.gz"/);
  assert.doesNotMatch(follower,/V2_DAILY_V1_PUBLISHED_OK/);
  assert.doesNotMatch(publisher,/v1_path|v1_bytes|v1Sha256/);
  assert.doesNotMatch(loader,/test\(m\.v1Sha256/);
  assert.match(publisher,/metaSha256/);
});
