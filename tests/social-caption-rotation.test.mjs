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

// Public-facing oil medium name never contains a renderer version.
// Archive and share URLs still retain exact historical material=oil-vN codes.
test('all Oil versions display simply Oil on every automated caption platform',()=>{
 for(const version of [1,2,3,4,5,6,7,8,9]){
  for(const orientation of ['portrait','landscape']){
   const id='2026-11-08-'+(orientation==='portrait'?'OP01':'OL01');
   const item={id,material:'oil',orientation,mode:'organic',series:'Growth Systems',
     seed:'OIL-PUBLIC-NAME',stats:'Growth Systems / Growth',
     settings:{orientation,phiStrength:61.8,palette:'warm',pen:'fine'},
     shareUrl:'https://southernadd-cmyk.github.io/algoart/?v=9&material=oil-v'+version};
   const copy=makeCaptions(item);
   assert.match(copy.instagram,/\/ OIL\n/,'Instagram heading must use Oil');
   for(const platform of ['instagram','threads','bluesky']){
    assert.match(copy[platform],/\/ OIL(?:\n|$)/,platform+' heading must use Oil at v'+version);
    assert.doesNotMatch(copy[platform],/\bOIL(?: PAINT)? V\d+\b/i,platform+' must not expose the Oil revision');
    assert.ok(copy[platform].includes(editorArtworkLink(item)),platform+' must retain the exact artwork link');
   }
   assert.doesNotMatch(copy.altText,/\bOIL(?: PAINT)? V\d+\b/i,'Alt text must omit Oil revision');
   assert.equal(new URL(item.shareUrl).searchParams.get('material'),'oil-v'+version,
     'Underlying reproducible renderer identity must remain intact');
  }
 }
});
