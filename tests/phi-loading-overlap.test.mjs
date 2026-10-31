import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {warmGalleryEntry} from '../test/virtual-gallery/gallery-entry-preparation.mjs';
import {createPhiArtworkPreloader} from '../test/virtual-gallery/phi-artwork-preload.mjs';

test('staged gallery warm-up still compiles and uploads exact textures, but skips the duplicate render', async()=>{
 const ops=[],map={isTexture:true,image:{width:64,height:64}};
 const scene={traverse:cb=>cb({material:{map}})};
 const renderer={
  async compileAsync(){ops.push('compile');},
  initTexture(texture){assert.equal(texture,map);ops.push('upload');},
  render(){ops.push('render');}
 };
 const stages=[];
 await warmGalleryEntry({renderer,scene,camera:{},
  skipFinalRender:true,nextFrame:async()=>ops.push('frame'),
  onStage:(name,value)=>stages.push({name,...value})});
 assert.deepEqual(ops,['compile','frame','upload','frame']);
 assert.equal(stages[0].skipFinalRender,true);
 assert.equal(stages[0].attemptedUploads,1);
 const normal=[];
 await warmGalleryEntry({
  renderer:{...renderer,render(){normal.push('render');}},
  scene,camera:{},nextFrame:async()=>{}
 });
 assert.deepEqual(normal,['render']);
});

test('download slots can be released after image decode while serialized GPU work is pending',async()=>{
 async function run(releaseAfterDecode){
  const downloads=[],preparations=[],release=new Map();
  const loader=createPhiArtworkPreloader(async url=>{
   downloads.push(url);return {url};
  },{concurrency:1,releaseAfterDecode,
    prepare:image=>new Promise(resolve=>{preparations.push(image.url);release.set(image.url,resolve);})});
  loader.start('date',['one.jpg','two.jpg']);
  for(let i=0;i<12;i++)await Promise.resolve();
  const before=[...downloads];
  release.get('one.jpg')({name:'one'});
  for(let i=0;i<12;i++)await Promise.resolve();
  release.get('two.jpg')?.({name:'two'});
  await Promise.resolve();
  loader.clear();
  return before;
 }
 assert.deepEqual(await run(false),['one.jpg']);
 assert.deepEqual(await run(true),['one.jpg','two.jpg']);
});

test('loading changes are isolated to test, retain A/B switches and preload identical module URL',()=>{
 const source=readFileSync(new URL('../test/virtual-gallery/gallery-phi.js',import.meta.url),'utf8');
 assert.match(source,/get\('liftpipeline'\)!=='0'/);
 assert.match(source,/get\('liftwarmrender'\)!=='1'/);
 assert.match(source,/phiPaintingGate\.wait/);
 const page=readFileSync(new URL('../test/virtual-gallery/full-engine.html',import.meta.url),'utf8');
 const preload=page.match(/<link rel="modulepreload" href="([^"]+)"/)?.[1];
 const imported=page.match(/await import\('([^']+)'\)/)?.[1];
 assert.equal(preload,imported);
});
