import fs from 'node:fs';
// Dry-run-only regression for frozen social queues. No publishing or archive writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {validateActionItem} from '../automation/action-slot.mjs';
import {validateOilItem} from '../automation/oil-slot.mjs';
import {validateWatercolourItem} from '../automation/watercolour-slot.mjs';
import {oilVersionForDate} from '../automation/oil-edition.mjs';
import {CURRENT_SOCIAL_RENDERER_VERSION,isSupportedSocialPublisherVersion} from '../automation/renderer-state.mjs';

const kinds=[
  {name:'Action',validate:validateActionItem,material:'action',
    prefix:{portrait:'ACP',landscape:'ACL'},revision:()=> 'action-v4'},
  {name:'Oil',validate:validateOilItem,material:'oil',
    prefix:{portrait:'OP',landscape:'OL'},revision:oilVersionForDate},
  {name:'Watercolour V2S',validate:validateWatercolourItem,material:'watercolour',
    prefix:{portrait:'CP',landscape:'CL'},revision:()=> 'watercolour-v2s'}
];

function artwork(kind,date,orientation,version){
  const seed='PP-TEST-'+kind.material+'-'+orientation;
  const mode='network';
  const url=new URL('https://southernadd-cmyk.github.io/algoart/');
  url.searchParams.set('v',String(version));
  url.searchParams.set('seed',seed);
  url.searchParams.set('mode',mode);
  url.searchParams.set('material',kind.revision(date));
  if(orientation==='portrait')url.searchParams.set('fmt','portrait');
  if(kind.material==='watercolour')url.searchParams.set('fit','0');
  return {id:date+'-'+kind.prefix[orientation]+'01',seed,mode,
    material:kind.material,orientation,rendererVersion:version,shareUrl:url.href};
}

test('publisher accepts both archived V9 and current V10, in both formats and all three materials',()=>{
  assert.equal(CURRENT_SOCIAL_RENDERER_VERSION,10);
  for(const [date,version] of [['2026-10-28',9],['2026-11-10',10]]){
    assert.equal(isSupportedSocialPublisherVersion(version),true);
    for(const kind of kinds)for(const orientation of ['portrait','landscape']){
      const item=artwork(kind,date,orientation,version);
      assert.doesNotThrow(()=>kind.validate(item,date,orientation),
        kind.name+' '+orientation+' V'+version);
      assert.equal(new URL(item.shareUrl).searchParams.get('v'),String(item.rendererVersion));
    }
  }
});

test('publisher rejects unsupported renderer versions rather than trusting URL claims',()=>{
  for(const bad of [0,8,11,10.5,'10',null,undefined]){
    assert.equal(isSupportedSocialPublisherVersion(bad),false);
    for(const kind of kinds){
      const item=artwork(kind,'2026-11-10','portrait',bad);
      assert.throws(()=>kind.validate(item,'2026-11-10','portrait'),
        /Invalid .* artwork identity/,kind.name+' unexpectedly accepted '+String(bad));
    }
  }
});

test('publisher rejects link-version mismatch even if both versions are individually supported',()=>{
  for(const kind of kinds)for(const version of [9,10]){
    const item=artwork(kind,'2026-11-10','landscape',version);
    const url=new URL(item.shareUrl);
    url.searchParams.set('v',String(version===9?10:9));
    item.shareUrl=url.href;
    assert.throws(()=>kind.validate(item,'2026-11-10','landscape'),
      /share URL does not reproduce saved artwork/i,kind.name+' mismatched URL');
  }
});

test('publisher retains seed, material, format and identity guards',()=>{
  for(const kind of kinds)for(const orientation of ['portrait','landscape']){
    const date='2026-11-10';
    const item=artwork(kind,date,orientation,10);
    const badId={...item,id:item.id.replace('01','02')};
    assert.throws(()=>kind.validate(badId,date,orientation),/Invalid .* artwork identity/);
    for(const [parameter,value] of [['seed','wrong-seed'],['material','marker'],['mode','wrong-mode'],
      ['fmt',orientation==='portrait'?'landscape':'portrait']]){
      const corrupted={...item};
      const url=new URL(corrupted.shareUrl);
      url.searchParams.set(parameter,value);
      corrupted.shareUrl=url.href;
      assert.throws(()=>kind.validate(corrupted,date,orientation),
        /share URL does not reproduce saved artwork/i,kind.name+' '+parameter);
    }
    if(kind.material==='watercolour'){
      const corrupted={...item,shareUrl:item.shareUrl.replace('fit=0','fit=1')};
      assert.throws(()=>kind.validate(corrupted,date,orientation),
        /share URL does not reproduce saved artwork/i);
    }
  }
});

test('historical Watercolour recovery uses a dated frozen queue and cannot regenerate',()=>{
  const text=fs.readFileSync('.github/workflows/watercolour-live.yml','utf8');
  assert.match(text,/Recovery only: frozen historical London edition date/);
  assert.match(text,/Reject unsafe backdated live dispatches/);
  assert.match(text,/Require frozen media for a backdated live recovery/);
  assert.match(text,/steps\.cached\.outputs\.ready/);
  assert.match(text,/refusing regeneration on recovery/);
  assert.match(text,/TODAY=.*TZ=Europe\/London date \+%F/);
  assert.match(text,/steps\.gate\.outputs\.date/);
  assert.match(text,/id: historical/);
  for(const name of [
    "Generate today's artwork batch",
    "Freeze the complete single-artwork daily watercolour batch",
    "Build daily gallery and SEO pages",
    "Publish gallery update to GitHub Pages source",
    "Explicitly trigger Pages deployment after gallery commit"
  ]){
    const found=text.split('      - name: '+name+'\\n')[1];
    assert.ok(found,'Missing workflow step: '+name);
    const condition=found.split('\\n').find(line=>line.trim().startsWith('if: '));
    assert.match(condition,/steps\\.historical\\.outputs\\.backdated != 'true'/,
      name+' must be suppressed during backdated social-only replay');
  }
});
