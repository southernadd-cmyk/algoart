import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {watercolorSlot} from '../automation/watercolor-slot.mjs';
import {tissueEditionForDate,validateTissueShareUrl} from '../automation/tissue-edition.mjs';
import {makeCaptions,editorArtworkLink} from '../automation/captions.mjs';

const root=path.resolve(new URL('..',import.meta.url).pathname);
const day='2099-02-04'; // New editions must use the seeded Tissue palette.
assert.equal(tissueEditionForDate('2026-10-13').suffix,'&watercolor=1');
assert.equal(tissueEditionForDate('2026-10-14').suffix,'&tissue=6');
assert.equal(tissueEditionForDate('2026-10-15').suffix,'&tissue=7');
assert.equal(tissueEditionForDate(day).suffix,'&tissue=7');
assert.throws(()=>tissueEditionForDate('2026-10-32'));
const historic=new URL('https://southernadd-cmyk.github.io/algoart/?watercolor=1');
assert.equal(validateTissueShareUrl('2026-10-13',historic.href).edition,'historical');
assert.throws(()=>validateTissueShareUrl('2026-10-14',historic.href));
assert.throws(()=>validateTissueShareUrl('2026-10-13','https://southernadd-cmyk.github.io/algoart/?tissue=2'));
assert.equal(watercolorSlot('0').target_time,'09:00');
assert.equal(watercolorSlot('2').target_time,'20:30');
assert.equal(watercolorSlot('build').should_post,false);
for(const slot of ['1','3','-1','15'])assert.throws(()=>watercolorSlot(slot));

const temp=await fs.mkdtemp(path.join(os.tmpdir(),'algoart-watercolor-'));
try{
  const entries=[];
  for(const orientation of ['landscape','portrait']){
    const dir=path.join(temp,'social-output',day,'watercolor',orientation);
    await fs.mkdir(dir,{recursive:true});
    const q=[];
    for(let i=0;i<2;i++){
      const seed='AW'+(orientation==='portrait'?'P':'L')+'-TEST-'+i;
      const id=day+'-'+(orientation==='portrait'?'WP':'WL')+String(i+1).padStart(2,'0');
      const file=id+'.jpg',ig=id+'-instagram.jpg';
      const url=new URL('https://southernadd-cmyk.github.io/algoart/');
      url.searchParams.set('v','8');
      url.searchParams.set('seed',seed);
      url.searchParams.set('mode','organic');
      if(orientation==='portrait')url.searchParams.set('fmt','portrait');
      url.searchParams.set('tissue','7');
      const e={
        id,seed,mode:'organic',series:'Growth Systems',orientation,material:'watercolor',
        imageFile:file,instagramImageFile:ig,rendererVersion:8,shareUrl:url.href,
        settings:{seed,mode:'organic',orientation,phiStrength:92,pen:'fine',palette:'mono'}
      };
      e.copy=makeCaptions(e);
      for(const platform of ['threads','bluesky','instagram']){
        assert(e.copy[platform].includes('/?art='+id));
        assert(e.copy[platform].toLowerCase().includes('tissue & graphite'));
      }
      assert(editorArtworkLink(e).includes('?art='+id));
      assert.equal(new URL(e.shareUrl).searchParams.get('tissue'),'7');
      assert.equal(validateTissueShareUrl(day,e.shareUrl).edition,'seeded');
      await fs.writeFile(path.join(dir,file),'fake-wash-'+id);
      await fs.writeFile(path.join(dir,ig),'fake-instagram-'+id);
      q.push(e);entries.push(e);
    }
    await fs.writeFile(path.join(dir,'queue.json'),JSON.stringify({date:day,orientation,material:'watercolor',entries:q}));
  }
  // The watercolor-specific slots must select one work per orientation,
  // never an afternoon post, with properly padded portrait media.
  function run(file,env,command){
    const out=spawnSync(process.execPath,[path.join(root,file),command],{
      cwd:temp,env:{...process.env,GITHUB_OUTPUT:'',SOCIAL_DATE:day,...env},encoding:'utf8'
    });
    assert.equal(out.status,0,out.stderr);
    return Object.fromEntries(out.stdout.trim().split('\n').map(row=>{
      const index=row.indexOf('=');return [row.slice(0,index),row.slice(index+1)];
    }));
  }
  for(const orientation of ['landscape','portrait']){
    for(const slot of [0,2]){
      const o=run('automation/watercolor-slot.mjs',
        {SOCIAL_ORIENTATION:orientation,SLOT:String(slot)},'select');
      const expected=entries.find(e=>e.orientation===orientation&&e.id.endsWith(String(slot===0?1:2).padStart(2,'0')));
      assert.equal(o.id,expected.id);
      assert.equal(o.asset_name,expected.imageFile);
      assert.equal(o.instagram_asset_name,expected.instagramImageFile);
      assert.equal(o.scheduled_time,slot===0?'09:00':'20:30');
      assert.equal(o.share_url,expected.shareUrl);
    }
  }
  function build(orientation){
    const out=spawnSync(process.execPath,[path.join(root,'automation/build-gallery.mjs')],{
      cwd:temp,env:{...process.env,GALLERY_QUEUE_MATERIAL:'watercolor',
        GALLERY_QUEUE_ORIENTATION:orientation,SOCIAL_DATE:day},encoding:'utf8'
    });
    assert.equal(out.status,0,out.stderr);
  }
  build('portrait');build('landscape');build('portrait');build('landscape');
  const meta=JSON.parse(await fs.readFile(path.join(temp,'gallery',day,'meta.json'),'utf8'));
  assert.equal(meta.entries.length,4);
  assert.equal(meta.entries.filter(x=>x.material==='watercolor').length,4);
  assert.equal(meta.entries.filter(x=>x.orientation==='portrait').length,2);
  assert.equal(meta.entries.filter(x=>x.orientation==='landscape').length,2);
  assert.equal(new Set(meta.entries.map(x=>x.id)).size,4);
  assert.equal(meta.entries[0].orientation,'landscape');
  assert.equal(meta.entries[3].orientation,'portrait');
  const html=await fs.readFile(path.join(temp,'gallery',day,'index.html'),'utf8');
  assert.equal((html.match(/data-material="watercolor"/g)||[]).length,4);
  for(const e of entries)assert(html.includes(e.shareUrl.replaceAll('&','&amp;')));
  // Simulate ten historical marker works: the post-cutoff gallery retains
  // four marker entries and four watercolor entries, with retained bytes stable.
  const dayDir=path.join(temp,'gallery',day);
  const ten=Array.from({length:10},(_,i)=>{
    const portrait=i>=5;
    const id=day+'-'+(portrait?'P':'')+String(i%5+1).padStart(2,'0');
    const seed='MARKER-'+i;
    return {id,seed,mode:'field',series:'Orbital Studies',
      orientation:portrait?'portrait':'landscape',rendererVersion:8,
      imageFile:id+'.jpg',
      settings:{seed,mode:'field',orientation:portrait?'portrait':'landscape',phiStrength:90,pen:'fine',palette:'mono'},
      shareUrl:'https://example.test/?v=8&seed='+seed+'&mode=field',
      altText:'Historical marker artwork'};
  });
  for(const e of ten)await fs.writeFile(path.join(dayDir,e.imageFile),'original-marker-'+e.seed);
  const merged=JSON.parse(await fs.readFile(path.join(dayDir,'meta.json'),'utf8'));
  merged.entries.push(...ten);
  merged.count=merged.entries.length;
  await fs.writeFile(path.join(dayDir,'meta.json'),JSON.stringify(merged));
  build('landscape');build('portrait');
  const full=JSON.parse(await fs.readFile(path.join(dayDir,'meta.json'),'utf8'));
  assert.equal(full.count,8,'Post-17 October archive caps marker and watercolor materials at four each');
  assert.equal(full.entries.filter(e=>e.material==='watercolor').length,4);
  assert.equal(full.entries.filter(e=>e.material!=='watercolor').length,4);
  assert.equal(new Set(full.entries.map(e=>e.id)).size,8);
  assert(full.entries.slice(0,4).every(e=>e.material!=='watercolor'));
  assert(full.entries.slice(4).every(e=>e.material==='watercolor'));
  const retainedMarkers=full.entries.filter(e=>e.material!=='watercolor');
  for(const e of retainedMarkers){
    assert.equal(await fs.readFile(path.join(dayDir,e.imageFile),'utf8'),'original-marker-'+e.seed);
  }
  assert.equal(retainedMarkers.filter(e=>e.orientation==='landscape').length,2);
  assert.equal(retainedMarkers.filter(e=>e.orientation==='portrait').length,2);
  console.log('PASS: capped 8-study mixed archive survives repeated watercolor updates with historical marker image files untouched.');
  console.log('PASS: exactly four watercolor studies (2+2), independent ids, reversible exact links, no afternoon selection, and duplicate-safe gallery.');
}finally{await fs.rm(temp,{recursive:true,force:true})}
