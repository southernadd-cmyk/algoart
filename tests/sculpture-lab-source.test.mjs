import assert from 'node:assert/strict';
import {test} from 'node:test';
import {archiveImageURL,loadArchiveImage} from '../gallery/sculpture-lab/archive-source.mjs';

const base='https://southernadd-cmyk.github.io/algoart/gallery/sculpture-lab/';
test('R2 editions use their original media URL, preserving the archive filename as identity',()=>{
  const entry={imageFile:'historical-name.jpg',media:{original:
    'https://proportion-piece-media.mr-adam-clement.workers.dev/editions/2026-11-17/G01/original-hash.jpg'}};
  assert.equal(archiveImageURL(entry,'2026-11-17',base),entry.media.original);
  assert.equal(entry.imageFile,'historical-name.jpg');
  assert.throws(()=>archiveImageURL({imageFile:'missing.jpg',media:{}},'2026-11-17',base),
    /missing its original R2 image/);
});
test('pre-migration portraits retain their archived local URL',()=>{
  assert.equal(archiveImageURL({imageFile:'study one.jpg'},'2026-11-10',base),
    'https://southernadd-cmyk.github.io/algoart/gallery/2026-11-10/study%20one.jpg');
});
test('pixel-readable images set anonymous CORS before assigning their source',async()=>{
  const OriginalImage=globalThis.Image;
  const events=[];
  globalThis.Image=class{
    set crossOrigin(value){events.push(['cors',value]);}
    set src(value){events.push(['src',value]);queueMicrotask(()=>this.onload());}
  };
  try{
    await loadArchiveImage('https://example.test/source.jpg');
    assert.deepEqual(events,[['cors','anonymous'],['src','https://example.test/source.jpg']]);
  }finally{globalThis.Image=OriginalImage;}
});
