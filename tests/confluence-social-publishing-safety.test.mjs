import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const confluence=readFileSync('.github/workflows/confluence-social.yml','utf8');
const social=readFileSync('.github/workflows/social-live.yml','utf8');

test('Confluence refreshes main and checks the complete daily archive before selecting a study',()=>{
  const ready=confluence.indexOf('name: Refresh and require the complete daily Confluence archive');
  const select=confluence.indexOf('name: Select exact archived Confluence study');
  assert.ok(ready>=0 && select>ready,'Never select a Confluence study from an incomplete archive');
  const gate=confluence.slice(ready,select);
  assert.match(gate,/git fetch --quiet origin main/);
  assert.match(gate,/git checkout -q -B main origin\/main/);
  assert.match(gate,/test -s "gallery\/\$SOCIAL_DATE\/meta\.json"/);
  assert.match(gate,/hasConfluencePairs/);
  assert.match(gate,/ATTEMPT < 6/);
  assert.match(gate,/exit 1/);
});

test('Missed morning Confluence portrait can be recovered at the existing afternoon slot',()=>{
  const recovery=social.match(/  confluence-portrait-recovery:\n([\s\S]*?)(?=\n  [a-z][a-z\d-]*:|$)/)?.[1];
  assert.ok(recovery,'Missing bounded portrait recovery job');
  assert.match(recovery,/needs\.portrait-plan\.outputs\.slot == '1'/);
  assert.match(recovery,/uses: \.\/\.github\/workflows\/confluence-social\.yml/);
  assert.match(recovery,/slot: '0'/);
  assert.match(recovery,/date: \$\{\{ needs\.portrait-plan\.outputs\.date \}\}/);
});

test('Already-completed Confluence platforms skip preparation and avoid duplicate posting',()=>{
  assert.match(confluence,/echo "needs_post=\$NEEDS_POST" >> "\$GITHUB_OUTPUT"/);
  for(const name of [
    'Install image preparation runtime',
    'Prepare noncropped Meta and compressed Bluesky JPEGs',
    'Host verified artwork on existing monthly release',
  ]){
    const start=confluence.indexOf('      - name: '+name);
    assert.ok(start>=0,'Missing step: '+name);
    assert.match(confluence.slice(start,start+230),/if: steps\.markers\.outputs\.needs_post == 'true'/);
  }
  assert.match(confluence,/steps\.markers\.outputs\.instagram_done != 'true'/);
  assert.match(confluence,/steps\.markers\.outputs\.threads_done != 'true'/);
  assert.match(confluence,/steps\.markers\.outputs\.bluesky_done != 'true'/);
});

test('Final release marker verification retries API visibility, never republishes',()=>{
  const start=confluence.indexOf('      - name: Verify every configured destination was published or previously completed');
  assert.ok(start>=0);
  const verify=confluence.slice(start);
  assert.match(verify,/always\(\) && steps\.select\.outcome == 'success'/);
  assert.match(verify,/for ATTEMPT in 1 2 3 4 5 6/);
  assert.match(verify,/gh release view "\$RELEASE_TAG" --json assets/);
  assert.match(verify,/sleep 3/);
  assert.match(verify,/completion marker missing .* after verification retries/);
  assert.doesNotMatch(verify,/publish-(?:threads|instagram|bluesky|pinterest)/);
});
