import test from 'node:test';
import assert from 'node:assert/strict';
import {createPhiArtworkPreloader} from '../gallery/visit/phi-artwork-preload.mjs';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('capped, deduplicated downloads share decoded image',async()=>{
 let active=0,max=0;const pending=new Map();
 const preload=createPhiArtworkPreloader(url=>new Promise(resolve=>{
  active++;max=Math.max(max,active);pending.set(url,image=>{active--;resolve(image);});
 }),{concurrency:2});
 preload.start('2026-10-25',['a','b','a','c']);
 await flush();assert.deepEqual([...pending.keys()],['a','b']);
 const image={decoded:true},reuse=preload.take('2026-10-25','a');
 pending.get('a')(image);assert.equal(await reuse,image);
 await flush();assert.equal(pending.has('c'),true);
 pending.get('b')({});pending.get('c')({});
 await preload.take('2026-10-25','c');
 assert.ok(max<=2);assert.equal(preload.stats().total,3);
});
test('switching date cancels queued work',async()=>{
 const pending=new Map();
 const preload=createPhiArtworkPreloader(url=>new Promise(resolve=>pending.set(url,resolve)),{concurrency:1});
 preload.start('old',['old1','old2']);await flush();
 preload.start('new',['new']);await flush();
 assert.equal(preload.take('old','old2'),null);
 pending.get('old1')({});pending.get('new')({new:true});
 assert.deepEqual(await preload.take('new','new'),{new:true});
 assert.equal(pending.has('old2'),false);
});
test('failed image does not hold the next image',async()=>{
 const preload=createPhiArtworkPreloader(url=>url==='bad'?Promise.reject(Error('offline')):Promise.resolve({url}),{concurrency:1});
 preload.start('today',['bad','good']);
 assert.equal(await preload.take('today','bad'),null);
 assert.deepEqual(await preload.take('today','good'),{url:'good'});
 preload.clear();assert.equal(preload.stats().total,0);
});
