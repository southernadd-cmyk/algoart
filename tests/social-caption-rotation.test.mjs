import test from 'node:test';
import assert from 'node:assert/strict';
import {makeCaptions,captionVariant,editorArtworkLink,socialGraphemes,SOCIAL_CAPTION_LIMITS} from '../automation/captions.mjs';

const materials=['marker','watercolor','watercolour','oil','action'];
const systems=['Orbital Studies','Recursive Divisions','Golden Trajectories','Automatic Marks'];
const examples=materials.flatMap((material,materialIndex)=>Array.from({length:12},(_,i)=>{
  const series=systems[(i+materialIndex)%systems.length];
  const portrait=i%2===0;
  const day=String(i+1).padStart(2,'0');
  const prefix=material==='action'?'AC':material==='oil'?'O':material==='watercolour'?'W':material==='watercolor'?'C':'';
  const orientation=portrait?'P':'L';
  const id='2026-10-'+day+'-'+(prefix?prefix+orientation:'')+'01';
  return {id,series,stats:series+' / Organic',mode:'organic',seed:'TEST-'+material+'-'+i,material,
    settings:{orientation:portrait?'portrait':'landscape',phiStrength:96,pen:'fine',palette:'warm'},
    shareUrl:'https://southernadd-cmyk.github.io/algoart/?mode=organic'};
}));
test('captions change by artwork but are identical on retries',()=>{
  const variants=new Set(),threads=new Set(),instagramTags=new Set(),blueskyTags=new Set();
  for(const item of examples){
    const copy=makeCaptions(item);
    assert.deepEqual(makeCaptions(item),copy,'A retry must use the same copy for '+item.id);
    variants.add(captionVariant(item));
    threads.add(copy.threads.split('\n')[0]);
    instagramTags.add(copy.instagram.split('\n').filter(line=>line.startsWith('#')).join(' '));
    blueskyTags.add(copy.bluesky.split('\n').filter(line=>line.startsWith('#')).join(' '));
    const link=editorArtworkLink(item);
    for(const platform of ['instagram','threads','bluesky']){
      const message=copy[platform];
      assert.ok(message.includes(link),platform+' lost exact artwork link '+item.id);
      assert.equal((message.match(/https:\/\//g)||[]).length,1,'Duplicate link');
    }
    for(const [platform,max] of Object.entries(SOCIAL_CAPTION_LIMITS))
      assert.ok(socialGraphemes(copy[platform])<=max,platform+' caption too long');
    assert.ok((copy.threads.match(/#[a-z]+/g)||[]).length<=1,'Avoid hashtag-stuffed Threads posts');
  }
  assert.ok(variants.size>=4,'At least four caption styles should be exercised');
  assert.ok(threads.size>=8,'Threads openings should not repeat for every artwork');
  assert.ok(instagramTags.size>=4,'Instagram must rotate hashtag sets');
  assert.ok(blueskyTags.size>=4,'Bluesky must rotate hashtag sets');
});
