import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(file)=>readFileSync(new URL(file,import.meta.url),'utf8');
test('live and test towers show only the right-hand controls in their information bars',()=>{
 for(const file of ['../gallery/visit/index.html','../test/virtual-gallery/full-engine.html']){
  const html=read(file);
  const bar=html.match(/<div class="topbar"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/);
  assert.ok(bar,'toolbar exists in '+file);
  assert.ok(!bar[0].includes('class="identity"'),'no left-hand heading in '+file);
  assert.ok(!bar[0].includes('floorIndicator'),'no floor badge inside toolbar in '+file);
  for(const id of ['openLift','archiveLink','fullscreen','xr-controls'])
   assert.ok(bar[0].includes('id="'+id+'"'),id+' control retained in '+file);
  assert.match(html,/<span id="floorIndicator" hidden><\/span>/,'existing floor-script target preserved but hidden');
  assert.equal((html.match(/id="floorIndicator"/g)||[]).length,1,'floor-script target is unique');
 }
});
test('toolbar controls align to the right without a left-hand title',()=>{
 const css=read('../gallery/visit/gallery.css');
 assert.match(css,/\.topbar\{[\s\S]*?justify-content:flex-end/);
 assert.match(css,/\.topbar \.top-actions\{flex-wrap:nowrap;margin-left:auto\}/);
});
