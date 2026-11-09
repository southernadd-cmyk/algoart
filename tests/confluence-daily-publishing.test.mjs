// Verify the gallery + social publishing contract without live API posts.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {makeGoldenRoster} from '../confluence/golden-roster.js';
import {systems,palettes} from '../confluence/collab.js';
import {defaultSettings} from '../confluence/artist-controls.js';

const mats=['marker','tissue','watercolour','oil','action'];
const catalog={systems,materials:mats,palettes:Object.keys(palettes),defaultSettings};
test('golden rosters are deterministic, varied and preserve imported artists',()=>{
  const allMaterials=new Set(),allSystems=new Set();
  for(let i=0;i<200;i++){
    const seed='CFL-20261109-'+i;
    const a=makeGoldenRoster(seed,catalog);
    assert.deepEqual(a,makeGoldenRoster(seed,catalog));
    assert.equal(a.length,3);
    for(const field of ['system','material','palette'])
      assert.equal(new Set(a.map(x=>x[field])).size,3,field+' must be unique per composition');
    a.forEach(x=>{
      allMaterials.add(x.material);allSystems.add(x.system);
      assert.ok(x.settings.colourCount>=5 && x.settings.colourCount<=10);
    });
  }
  assert.deepEqual([...allMaterials].sort(),[...mats].sort());
  assert.equal(allSystems.size,8);
  const lead={id:1,system:'rects',material:'oil',palette:'mono',
    settings:{...defaultSettings(systems[3]),seed:'original'}};
  const imported=makeGoldenRoster('original',{...catalog,lead});
  assert.strictEqual(imported[0],lead);
  assert.ok(imported.slice(1).every(x=>x.system!==lead.system&&x.material!==lead.material&&x.palette!==lead.palette));
});
test('two scheduled Confluence posts select the correct archived formats without publishing',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pp-confluence-test-'));
  const day='2026-11-09';
  try{
    const gallery=path.join(dir,'gallery',day);
    fs.mkdirSync(gallery,{recursive:true});
    const entries=['portrait','landscape','portrait','landscape'].map((orientation,i)=>{
      const id=day+'-C'+String(i+1).padStart(2,'0');
      const imageFile=id+'.jpg';
      fs.writeFileSync(path.join(gallery,imageFile),Buffer.from([255,216,255,217]));
      return {id,material:'confluence',orientation,imageFile,shareUrl:'https://southernadd-cmyk.github.io/algoart/confluence/?s=abc123',
        artists:[{system:'rects'},{system:'organic'},{system:'spiral'}],
        altText:'Three artists collaborate on a shared painting.'};
    });
    fs.writeFileSync(path.join(gallery,'meta.json'),JSON.stringify({version:1,date:day,count:16,entries}));
    const script=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../automation/select-confluence-social.mjs');
    for(const [slot,expected] of [['0',entries[0]],['2',entries[1]]]){
      const result=spawnSync(process.execPath,[script],{
        cwd:dir,env:{...process.env,SOCIAL_DATE:day,SOCIAL_SLOT:slot,GITHUB_OUTPUT:''},
        encoding:'utf8'});
      assert.equal(result.status,0,result.stderr);
      const record=JSON.parse(result.stdout);
      assert.equal(record.study_id,expected.id);
      assert.equal(record.orientation,expected.orientation);
      assert.match(record.caption,new RegExp(expected.id+'$|'+expected.id+'\\n'));
      assert.ok([...new Intl.Segmenter('en',{granularity:'grapheme'}).segment(record.caption)].length<=300);
    }
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
