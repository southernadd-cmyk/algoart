import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {pickStaggerMinutes,STAGGER_MINUTES_MIN,STAGGER_MINUTES_MAX} from '../automation/social-stagger.mjs';

test('random stagger is inclusive and bounded to 5–20 minutes',()=>{
  assert.equal(STAGGER_MINUTES_MIN,5);
  assert.equal(STAGGER_MINUTES_MAX,20);
  assert.equal(pickStaggerMinutes((min,max)=>{assert.equal(min,5);assert.equal(max,21);return min;}),5);
  assert.equal(pickStaggerMinutes((min,max)=>max-1),20);
  assert.throws(()=>pickStaggerMinutes(()=>0));
  assert.throws(()=>pickStaggerMinutes(()=>21));
  const run=spawnSync(process.execPath,['automation/social-stagger.mjs','--dry-run'],
    {cwd:process.cwd(),encoding:'utf8',timeout:15000});
  assert.equal(run.status,0,run.stderr);
  assert.match(run.stdout,/(?:[5-9]|1\d|20) minutes/);
});

test('every social publication job staggers after hosting and before publishing',()=>{
  const workflows=['social-live','portrait-live','action-live','watercolor-live','watercolour-live','oil-live'];
  for(const name of workflows){
    const source=readFileSync('.github/workflows/'+name+'.yml','utf8');
    const host=source.indexOf('      - name: Host image publicly');
    const stagger=source.indexOf('      - name: Stagger social publication (5–20 minutes)');
    const publish=source.indexOf('      - name: Publish to Instagram');
    assert.ok(host>=0&&stagger>host&&publish>stagger,
      name+' must host first, stagger second, then publish');
    assert.match(source,/timeout-minutes: 60/,'Allow enough time for the real delay');
    const step=source.slice(stagger,publish);
    assert.match(step,/run: node automation\/social-stagger\.mjs/);
    assert.match(step,/should_post == 'true'/);
    assert.match(step,/threads_done != 'true'/);
    if(name!=='social-live') {
      assert.match(step,/inputs.live == true/,'Dry run must not sleep or publish');
      assert.match(step,/refs\/heads\/main/,'Feature branches must remain safe');
    }
  }
});
