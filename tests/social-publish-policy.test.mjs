import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {PLATFORM_TARGETS,SLOT_CANDIDATES,selectedSocialJobs,socialPublishDecision} from '../automation/social-publish-policy.mjs';

const JOB_WORKFLOWS={
  'marker-landscape':'social-live',
  'marker-portrait':'portrait-live',
  'action-landscape':'action-live',
  'action-portrait':'action-live',
  'tissue-landscape':'watercolor-live',
  'tissue-portrait':'watercolor-live',
  'watercolour-landscape':'watercolour-live',
  'watercolour-portrait':'watercolour-live',
  'oil-landscape':'oil-live',
  'oil-portrait':'oil-live'
};
const slots=[0,1,2],platforms=['threads','instagram','bluesky','pinterest'];
const expected={threads:[1,0,1],instagram:[1,2,1],
                bluesky:[1,2,1],pinterest:[1,1,1]};

test('seven day platform quotas are exactly 2/4/4/3 per day with five-material rotation',()=>{
  const weekly=Object.fromEntries(platforms.map(platform=>[platform,0]));
  const materials=new Set(),orientations=new Set();
  for(let d=0;d<14;d++){
    const date=new Date(Date.UTC(2026,9,23+d)).toISOString().slice(0,10);
    for(const slot of slots){
      for(const platform of platforms){
        const selected=selectedSocialJobs(date,slot,platform);
        assert.equal(selected.length,expected[platform][slot],
          date+' slot '+slot+' '+platform+' quota');
        assert.equal(new Set(selected).size,selected.length,'No duplicate job in same slot');
        assert.ok(selected.every(job=>SLOT_CANDIDATES[slot].includes(job)),
          'No artwork outside its scheduled slot');
        weekly[platform]+=selected.length;
        selected.forEach(job=>{
          materials.add(job.split('-')[0]);
          orientations.add(job.split('-').at(-1));
          const flags=socialPublishDecision({date,slot:String(slot),job});
          assert.equal(flags[platform],true,platform+' flag should select '+job);
        });
      }
    }
  }
  assert.deepEqual(weekly,{threads:28,instagram:56,bluesky:56,pinterest:42});
  assert.deepEqual([...materials].sort(),['action','marker','oil','tissue','watercolour']);
  assert.deepEqual([...orientations].sort(),['landscape','portrait']);
  assert.equal(selectedSocialJobs('2026-10-23','1','threads').length,0,
    'No afternoon Threads posts');
  for(const platform of platforms) assert.deepEqual(selectedSocialJobs('2026-10-23','3',platform),[]);
  assert.throws(()=>selectedSocialJobs('invalid','0','threads'));
  assert.throws(()=>socialPublishDecision({date:'2026-10-23',slot:'0',job:'oil-landscape'}));
});

test('every publisher applies the same policy to both publish and completion markers',()=>{
  for(const [job,workflow] of Object.entries(JOB_WORKFLOWS)){
    const text=readFileSync('.github/workflows/'+workflow+'.yml','utf8');
    assert.ok(text.includes("id: policy"),workflow+' must have a policy step');
    const identity=workflow==='social-live'?'marker-landscape':
      workflow==='portrait-live'?'marker-portrait':
      job.split('-')[0]+'-\${{ inputs.orientation }}';
    assert.ok(text.includes("SOCIAL_PUBLISH_JOB: '"+identity+"'"),
      workflow+' policy must identify its material/orientation');
    for(const platform of platforms){
      const fragment="steps.policy.outputs."+platform+" == 'true'";
      assert.ok((text.split(fragment).length-1)>=3,
        workflow+' must gate posting, marker and stagger for '+platform);
    }
    // Gallery generation is NOT conditional on the daily publishing choice.
    const generation=text.match(/      - name: Generate today's artwork batch\n([\s\S]*?)(?=\n      - name: |\Z)/);
    assert.ok(generation,workflow+' must generate unchanged archive');
    assert.doesNotMatch(generation[1],/steps.policy.outputs/,
      workflow+' must not suppress artwork generation');
  }
});

test('policy command prints only safe positive decisions, with no publishing calls',()=>{
  const args={SOCIAL_DATE:'2026-10-23',SOCIAL_SLOT:'0',SOCIAL_PUBLISH_JOB:'marker-landscape'};
  const stdout=execFileSync(process.execPath,['automation/social-publish-policy.mjs'],
    {env:{...process.env,...args},encoding:'utf8'});
  for(const platform of platforms)assert.match(stdout,new RegExp(platform+'=(?:true|false)'));
  assert.doesNotMatch(stdout,/access.token|threads_publish|https:\/\/graph\./);
});
