// Verify the gallery + social publishing contract without live API posts.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {makeGoldenRoster} from '../confluence/golden-roster.js';
import {makeDailyConfluencePlan,DAILY_VARIATION_START} from '../automation/confluence-daily-variation.mjs';
import {systems,palettes} from '../confluence/collab.js';
import {defaultSettings} from '../confluence/artist-controls.js';
import {validateRandomGalleryEdition} from '../automation/confluence-edition.mjs';

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
for(const [day,formats] of [
  ['2026-11-09',['portrait','landscape','portrait','landscape']],
  ['2026-11-10',['portrait','landscape']]
]) test(`the ${day} edition supplies the two scheduled Confluence formats`,()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pp-confluence-test-'));
  try{
    const gallery=path.join(dir,'gallery',day);
    fs.mkdirSync(gallery,{recursive:true});
    const entries=formats.map((orientation,i)=>{
      const id=day+'-C'+String(i+1).padStart(2,'0');
      const imageFile=id+'.jpg';
      fs.writeFileSync(path.join(gallery,imageFile),Buffer.from([255,216,255,217]));
      return {id,seed:id,rendererVersion:10,material:'confluence',orientation,imageFile,shareUrl:'https://southernadd-cmyk.github.io/algoart/confluence/?s=abc123',
        artists:[{system:'rects'},{system:'organic'},{system:'spiral'}],
        altText:'Three artists collaborate on a shared painting.'};
    });
    const solo=Array.from({length:12},(_,i)=>{
      const id=day+'-G'+String(i+1).padStart(2,'0');
      return {id,seed:id,rendererVersion:10,shareUrl:'https://southernadd-cmyk.github.io/algoart/?v=10'};
    });
    const edition=[...solo,...entries];
    validateRandomGalleryEdition(day,edition);
    const metaFile=path.join(gallery,'meta.json');
    fs.writeFileSync(metaFile,JSON.stringify({version:1,date:day,count:edition.length,entries:edition}));
    const script=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../automation/select-confluence-social.mjs');
    const select=slot=>spawnSync(process.execPath,[script],{
        cwd:dir,env:{...process.env,SOCIAL_DATE:day,SOCIAL_SLOT:slot,GITHUB_OUTPUT:''},
        encoding:'utf8'});
    for(const [slot,expected] of [['0',entries[0]],['2',entries[1]]]){
      const result=select(slot);
      assert.equal(result.status,0,result.stderr);
      const record=JSON.parse(result.stdout);
      assert.equal(record.study_id,expected.id);
      assert.equal(record.orientation,expected.orientation);
      assert.match(record.caption,new RegExp(expected.id+'$|'+expected.id+'\\n'));
      assert.ok([...new Intl.Segmenter('en',{granularity:'grapheme'}).segment(record.caption)].length<=300);
    }
    const incomplete=edition.filter(entry=>entry!==entries[1]);
    assert.throws(()=>validateRandomGalleryEdition(day,incomplete),/Confluence pair/);
    fs.writeFileSync(metaFile,JSON.stringify({version:1,date:day,count:incomplete.length,entries:incomplete}));
    assert.match(select('0').stderr,/archive is incomplete/);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test('old dated Confluence studies retain their exact previous random roster and fixed sheet settings',()=>{
  assert.equal(DAILY_VARIATION_START,'2026-11-11');
  for(const day of ['2026-11-09','2026-11-10'])for(let i=0;i<4;i++){
    const seed='CFL-'+day.replaceAll('-','')+'-'+String(i+1).padStart(2,'0');
    const plan=makeDailyConfluencePlan(day,seed,catalog);
    assert.deepEqual(plan.artists,makeGoldenRoster(seed,catalog));
    assert.deepEqual({grain:plan.grain,strength:plan.strength,
      collaborationPull:plan.collaborationPull,leadIndex:plan.leadIndex},
      {grain:11,strength:76,collaborationPull:100,leadIndex:0});
  }
});

test('new daily Confluence studies randomise three distinct engines, media and palettes and 22 controlled parameters',()=>{
  const studied=new Set(),materials=new Set(),paletteChoices=new Set();
  const globalVariations={grain:new Set(),strength:new Set(),collaborationPull:new Set(),leadIndex:new Set()};
  const fields={
    recursion:[2,7],spiralInfluence:[42,95],nesting:[16,68],
    thickness:[4,16],overdraw:[1,3],opacity:[65,94],
    pressure:[26,69],dryness:[5,31],curveBias:[26,78],
    shapeAmount:[40,86],overlap:[31,76],rotation:[34,94]
  };
  const varied=Object.fromEntries(Object.keys(fields).map(k=>[k,new Set()]));
  let studyPairs=0;
  for(let index=0;index<35;index++){
    const day=new Date(Date.UTC(2026,10,11+index)).toISOString().slice(0,10);
    const signatures=[];
    for(let i=0;i<2;i++){
      const seed='CFL-'+day.replaceAll('-','')+'-'+String(i+1).padStart(2,'0');
      const a=makeDailyConfluencePlan(day,seed,catalog);
      assert.deepEqual(a,makeDailyConfluencePlan(day,seed,catalog));
      assert.equal(a.artists.length,3);
      for(const key of ['system','material','palette'])
        assert.equal(new Set(a.artists.map(x=>x[key])).size,3,day+' '+key);
      for(const artist of a.artists){
        assert(systems.some(s=>s.id===artist.system));
        assert(mats.includes(artist.material));
        assert(Object.hasOwn(palettes,artist.palette));
        assert.equal(Object.keys(artist.settings).length<=45,true);
        studied.add(artist.system);materials.add(artist.material);
        paletteChoices.add(artist.palette);
        for(const [key,[min,max]] of Object.entries(fields)){
          const value=artist.settings[key];
          assert(Number.isInteger(value)&&value>=min&&value<=max,
            seed+' '+artist.system+' '+key+' out of range: '+value);
          varied[key].add(value);
        }
      }
      for(const [key,values] of Object.entries(globalVariations)){
        const bounds={grain:[7,21],strength:[65,88],
          collaborationPull:[78,100],leadIndex:[0,2]}[key];
        assert(Number.isInteger(a[key])&&a[key]>=bounds[0]&&a[key]<=bounds[1]);
        values.add(a[key]);
      }
      // Both studies must be recognisably independent, not the same preset
      // with the canvas format changed.
      signatures.push(JSON.stringify(a.artists.map(x=>[x.system,x.material,x.palette,x.settings])));
    }
    if(signatures[0]!==signatures[1])studyPairs++;
  }
  assert.equal(studied.size,8,'Each engine must appear across daily studies');
  assert.equal(materials.size,5,'All five materials must appear across daily studies');
  assert(paletteChoices.size>=8,'Daily studies must rotate across the palette catalogue');
  for(const [key,values] of Object.entries(varied))
    assert(values.size>=3,'Daily '+key+' parameter is stuck at a default');
  for(const [key,values] of Object.entries(globalVariations))
    assert(values.size>=2,'Shared '+key+' parameter is stuck');
  assert.equal(studyPairs,35);
});

test('daily Confluence generator takes the seeded plan and preserves archived share state',()=>{
  const source=fs.readFileSync(new URL('../automation/generate-gallery-confluence.mjs',import.meta.url),'utf8');
  assert.match(source,/makeDailyConfluencePlan\(day,seed,/);
  assert.match(source,/strength:plan\.strength/);
  assert.match(source,/collaborationPull:plan\.collaborationPull/);
  assert.match(source,/leadIndex:plan\.leadIndex/);
  assert.match(source,/grain:plan\.grain/);
  assert.match(source,/confluenceRenderer=day>='2026-11-11'\?2:1/);
  assert.match(source,/artists:artists\.map\(a=>\(\{/);
});
