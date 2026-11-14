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
  assert.ok(workflow.includes("ART_ONLY_SOCIAL_READY: 'true'"));
  assert.ok(workflow.includes('"$ART_ONLY_SOCIAL_READY" == true'));
  assert.match(workflow,/MODE=r2-only/);
  assert.match(workflow,/R2_ART_ONLY: \$\{\{ needs\.plan\.outputs\.mode == 'r2-only' \}\}/);
  assert.match(workflow,/MODE=legacy/);
  assert.ok(workflow.includes("ART_ONLY_AUTO_FROM: '2026-11-15'"));
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

test('all five reusable material workflows freeze and restore R2 social images without gallery commits',()=>{
  for(const name of ['portrait','watercolor','watercolour','oil','action']){
    const src=readFileSync('.github/workflows/'+name+'-live.yml','utf8');
    assert.match(src,/name: Detect R2-only gallery publication/);
    assert.match(src,/python3 automation\/social-r2-queue\.py restore/);
    assert.match(src,/python3 automation\/social-r2-queue\.py freeze/);
    assert.match(src,/python3 automation\/social-r2-queue\.py lookup/);
    assert.match(src,/steps\.storage\.outputs\.art_only != 'true' && steps\.gate\.outputs\.should_run/);
    assert.match(src,/R2_SOCIAL_ART_ONLY:/);
    assert.match(src,/gh release upload "\$RELEASE_TAG" "\$DIR\//);
  }
  const helper=readFileSync('automation/social-r2-queue.py','utf8');
  assert.match(helper,/sha256\(data\)/);
  assert.match(helper,/R2_SOCIAL_QUEUE_RESTORED/);
  assert.match(helper,/R2_SOCIAL_QUEUE_FROZEN/);
});

test('skip optional graffiti for R2-only and use the verified Chromium-only runner',()=>{
  assert.match(workflow,/runs-on: ubuntu-24\.04/);
  assert.match(workflow,/npx playwright install --only-shell chromium/);
  assert.match(workflow,/R2_CHROMIUM_SMOKE_OK/);
  assert.doesNotMatch(workflow,/playwright install --with-deps/);
  assert.match(workflow,/Pre-render graffiti atlases for new indoor floor and exterior facade\n        #[^\n]*\n        if: env\.R2_ART_ONLY != 'true'/);
  assert.match(workflow,/Verify saved graffiti atlases\n        if: env\.R2_ART_ONLY != 'true'/);
  assert.match(workflow,/R2_BROWSERS=chromium node tests\/r2-gallery-browser\.mjs/);
  assert.match(workflow,/R2_BROWSERS=chromium node tests\/r2-gallery-browser\.mjs --live/);
  assert.match(workflow,/R2-only commit still contains artwork bytes/);
});

test('R2 integration and sculpture baker avoid apt dependencies',()=>{
  const integration=readFileSync('.github/workflows/r2-publisher-integration.yml','utf8');
  const sculpture=readFileSync('.github/workflows/sculpture-v2-postpublish-daily.yml','utf8');
  for(const src of [integration,sculpture]){
    assert.match(src,/npx playwright install --only-shell chromium/);
    assert.match(src,/R2_CHROMIUM_SMOKE_OK/);
    assert.doesNotMatch(src,/playwright install --with-deps/);
    assert.match(src,/runs-on: ubuntu-24\.04/);
  }
  assert.match(integration,/R2_BROWSERS=chromium node tests\/r2-gallery-browser\.mjs --fixture/);
});

test('R2-only guard rejects all gallery binary updates, not only the daily folder',()=>{
  assert.ok(workflow.includes('grep -E "^gallery/.*'));
  assert.ok(!workflow.includes('grep -E "^gallery/$SOCIAL_DATE/.*'));
  assert.match(workflow,/R2-only commit still contains artwork bytes/);
});

test('R2 social credentials are available only when the rollout is explicitly armed on main',()=>{
  for(const name of ['social','portrait','watercolor','watercolour','oil','action','confluence-social']){
    const path='.github/workflows/'+(name==='social'?'social-live':name==='confluence-social'?'confluence-social':name+'-live')+'.yml';
    const src=readFileSync(path,'utf8');
    const line=src.split('\n').find(text=>text.trim().startsWith('environment:'));
    assert.ok(line,'Missing scoped R2 environment gate: '+path);
    for(const marker of ["github.ref == 'refs/heads/main'",
      "'2026-11-15' != ''",
      "'archive-media-test' || ''",
      "'archive-media-test' || ''"]){
      assert.ok(line.includes(marker),'Missing '+marker+' in '+path);
    }
  }
});

test('armed R2-only date blocks scheduled legacy gallery and gates all social URLs',()=>{
  const wait=readFileSync('.github/actions/wait-for-r2-gallery/action.yml','utf8');
  const manual=workflow.indexOf('elif [[ "$ART_ONLY_REQUESTED" == true ]]');
  const reserved=workflow.indexOf('elif [[ -n "$ART_ONLY_DATE" && "$DAY" == "$ART_ONLY_DATE" ]]; then');
  assert.ok(manual>0 && reserved>manual,'Explicit manual R2-only takes priority over the scheduled hold');
  assert.ok(workflow.includes('R2-only date reserved for manual publication; scheduled legacy build held.'));
  assert.ok(workflow.includes('"$DAY" != "$ART_ONLY_DATE" && "$DAY" > "2026-11-09"'));
  assert.ok(wait.includes('ART_ONLY_DATE: ${{ inputs.art_only_date }}'));
  assert.ok(wait.includes('ART_ONLY_AUTO_FROM: ${{ inputs.art_only_auto_from }}'));
  assert.ok(wait.includes('! "$EDITION_DATE" < "$ART_ONLY_AUTO_FROM"'));
  for(const src of [soloSocial,confluenceSocial]) assert.ok(src.includes("art_only_auto_from: '2026-11-15'"));
  assert.ok(soloSocial.includes('art_only_date: ${{ vars.PP_R2_ART_ONLY_DATE }}'));
  assert.ok(wait.includes('"$EDITION_DATE" == "$ART_ONLY_DATE"'));
  assert.ok(wait.includes('node automation/verify-r2-gallery-ready.mjs "$EDITION_DATE"'));
});

test('a real exact-byte backup must finish before R2-only pruning; repair is manual-only',()=>{
  const make=workflow.indexOf('python3 automation/r2-edition-backup.py create');
  const upload=workflow.indexOf('name: Persist exact-byte painting media backup');
  const v2backup=workflow.indexOf('name: Persist original R2-only Sculpture V2 source packs');
  const prune=workflow.indexOf('node automation/prune-r2-art-only.mjs');
  assert.ok(make>0 && upload>make && v2backup>upload && prune>v2backup);
  assert.ok(workflow.includes('retention-days: 90'));
  assert.ok(workflow.includes("github.event_name == 'workflow_dispatch' && needs.plan.outputs.mode == 'recover' && inputs.r2_restore_run != ''"));
  assert.ok(workflow.includes('python3 automation/r2-edition-backup.py repair'));
  assert.ok(workflow.includes('if: needs.plan.outputs.mode == \'recover\' && inputs.r2_restore_run == \'\''));
});
