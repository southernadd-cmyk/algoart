import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync('gallery/visit/index.html','utf8');
const deploy=readFileSync('.github/workflows/deploy-pages.yml','utf8');
const builder=readFileSync('automation/build-sculpture-v2-test.mjs','utf8');
test('V2 default is explicit and V1 is a reversible URL override',()=>{
  assert.match(html,/get\('sculptures'\)==='v1'/);
  assert.match(html,/await import\(useV1[\s\S]*?gallery-phi-bundle\.js\?v=classical-aac-20261107[\s\S]*?: '\.\/gallery-phi-sculpture-v2-test-bundle\.js\?v=sculpture-v2-preview-01'/);
  assert.equal(html.split('./gallery-phi-bundle.js?v=classical-aac-20261107').length-1,2,
    'Preview mirror builder requires precisely two V1 bundle anchors');
});
test('Pages keeps BOTH bundles and blocks cutover without V2',()=>{
  assert.match(deploy,/node automation\/build-sculpture-v2-test\.mjs/);
  assert.match(deploy,/test -s _site\/gallery\/visit\/gallery-phi-bundle\.js/);
  assert.match(deploy,/test -s _site\/gallery\/visit\/gallery-phi-sculpture-v2-test-bundle\.js/);
  assert.doesNotMatch(deploy,/Optional Sculpture V2 test tower failed to build/);
  assert.match(builder,/assert\.equal\(rendererReplacements,1/);
});
