import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflow=readFileSync('.github/workflows/gallery-daily.yml','utf8');
const v2=readFileSync('.github/workflows/sculpture-v2-postpublish-daily.yml','utf8');
const publisher=readFileSync('automation/prepare-r2-daily.mjs','utf8');
const cleanup=readFileSync('automation/prune-r2-art-only.mjs','utf8');
const soloSocial=readFileSync('.github/workflows/social-live.yml','utf8');
const confluenceSocial=readFileSync('.github/workflows/confluence-social.yml','utf8');

test('R2-only rollout is explicit and manual, never scheduled by default',()=>{
  assert.match(workflow,/r2_art_only:/);
  assert.match(workflow,/ART_ONLY_REQUESTED: \$\{\{ inputs\.r2_art_only \}\}/);
  assert.match(workflow,/ART_ONLY_DATE: \$\{\{ vars\.PP_R2_ART_ONLY_DATE \}\}/);
  assert.match(workflow,/\$GITHUB_EVENT_NAME" == workflow_dispatch/);
  assert.ok(workflow.includes('ART_ONLY_SOCIAL_READY: ${{ vars.PP_R2_ART_ONLY_SOCIAL_READY }}'));
  assert.ok(workflow.includes('"$ART_ONLY_SOCIAL_READY" == true'));
  assert.match(workflow,/MODE=r2-only/);
  assert.match(workflow,/R2_ART_ONLY: \$\{\{ needs\.plan\.outputs\.mode == 'r2-only' \}\}/);
  assert.match(workflow,/MODE=legacy/);
  assert.doesNotMatch(workflow,/if \[\[ "\$GITHUB_EVENT_NAME" == schedule \]\]; then\s+MODE=r2-only/);
});
test('R2 uploads verify before removing artwork from Git index',()=>{
  const upload=workflow.indexOf('python3 automation/r2-daily-media.py upload');
  const activate=workflow.indexOf('node automation/activate-r2-daily.mjs',upload);
  const prune=workflow.indexOf('node automation/prune-r2-art-only.mjs',activate);
  const commit=workflow.indexOf('git add -A gallery sitemap.xml robots.txt',prune);
  assert.ok(upload>0 && activate>upload && prune>activate && commit>prune);
  assert.match(cleanup,/verification\.manifestSha256!==digest\(raw\)/);
  assert.match(cleanup,/verification\.verified!==manifest\.mediaAssets\?\.length/);
  assert.match(cleanup,/this\.onerror=null;this\.src=/);
  assert.match(publisher,/const artOnly = process\.env\.R2_ART_ONLY === "true"/);
});
test('V2 post-publishing rehydrates R2-only paintings before roster and bake',()=>{
  assert.ok(v2.indexOf('Restore R2-only painting sources')<
    v2.indexOf('Verify published gallery date and solo portrait roster'));
  assert.match(v2,/automation\/r2-daily-media\.py restore/);
  assert.match(v2,/V2_SOURCE_R2_ONLY_RESTORED/);
});

test('social artwork is R2-only and never recommitted by main social job',()=>{
  assert.match(soloSocial,/name: Identify verified R2-only artwork edition/);
  assert.match(soloSocial,/steps\.storage\.outputs\.art_only != 'true'/);
  assert.match(soloSocial,/python3 automation\/publish-social-r2\.py/);
  assert.match(soloSocial,/R2_SOCIAL_ART_ONLY:/);
  assert.match(confluenceSocial,/name: Identify verified R2-only Confluence edition/);
  assert.match(confluenceSocial,/python3 automation\/publish-social-r2\.py/);
  assert.match(confluenceSocial,/original=\$R2_MEDIA_URL/);
});
test('R2-only gallery commit requires verified painting and both sculpture qualities',()=>{
  assert.match(workflow,/Prepare and verify R2-only V2 sculptures before publishing gallery/);
  assert.match(workflow,/--quality both/);
  assert.match(workflow,/automation\/publish-sculpture-v2-daily-r2\.py/);
  assert.ok(workflow.indexOf('Prepare and verify R2-only V2 sculptures before publishing gallery')<
    workflow.indexOf('Persist gallery archive'));
  assert.match(workflow,/R2-only commit still contains artwork bytes/);
});
