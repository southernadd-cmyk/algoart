import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync('gallery/visit/index.html','utf8');
const deploy=readFileSync('.github/workflows/deploy-pages.yml','utf8');
const builder=readFileSync('automation/build-sculpture-v2-test.mjs','utf8');
const daily=readFileSync('.github/workflows/gallery-daily.yml','utf8');
const follower=readFileSync('.github/workflows/sculpture-v2-postpublish-daily.yml','utf8');
const publisher=readFileSync('automation/publish-sculpture-v2-daily-r2.py','utf8');
const loader=readFileSync('gallery/sculpture-v2-test/v2-pack-loader.mjs','utf8');
test('Production uses V2 exclusively, not a permanent V1 fallback',()=>{
  assert.equal(html.split('./gallery-phi-sculpture-v2-test-bundle.js?v=sculpture-v2-20261111').length-1,2);
  assert.doesNotMatch(html,/get\('sculptures'\)|await import\(useV1/);
  assert.doesNotMatch(html,/gallery-phi-bundle\.js\?v=classical-aac/);
});
test('Release bundle is required and the test mirror retains exact source anchors',()=>{
  assert.match(deploy,/test -s _site\/gallery\/visit\/gallery-phi-sculpture-v2-test-bundle\.js/);
  assert.doesNotMatch(deploy,/Optional Sculpture V2 test tower failed to build/);
  assert.match(builder,/assert\.equal\(rendererReplacements,1/);
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
