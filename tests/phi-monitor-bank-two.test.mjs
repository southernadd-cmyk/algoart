import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validateTouchDesignerSixScreen} from '../gallery/visit/phi-touchdesigner-media.mjs';
import {getTouchDesignerHereLines} from '../gallery/visit/phi-touchdesigner-info-row.mjs';
const base=new URL('../gallery/visit/touchdesigner/',import.meta.url);
const second=new URL('bank-two/six-screen.json',base);

test('new film sources, model movie and TouchDesigner project exist',async()=>{
 for(const name of ['phi-net-AA-20261005-03-55769-organic-oil-v6-triptych.webm',
                    'phi-net-AA-20261005-03-55769-scribble-action-v4-triptych.webm',
                    'phi-net-model.webm','phi_net.toe'])
  assert.ok((await stat(new URL(name,base))).size>10000,name+' missing or empty');
 const monitor=await readFile(new URL('../gallery/visit/phi-reception-living-monitor.mjs',import.meta.url),'utf8');
 assert.match(monitor,/phi-net-model\.webm/);
 assert.match(monitor,/phi_net\.toe/);
});

test('the published six-screen atlas has the correct framing and verified bytes',async()=>{
 const manifest=JSON.parse(await readFile(second,'utf8'));
 assert.equal(manifest.atlas.columns,3);
 assert.equal(manifest.atlas.rows,2);
 assert.equal(manifest.atlas.panelWidth,384);
 assert.equal(manifest.atlas.panelHeight,240);
 if(manifest.status==='published'){
  assert.ok(validateTouchDesignerSixScreen(manifest));
  const bytes=await readFile(new URL(manifest.atlas.file,second));
  assert.equal(bytes.length,manifest.atlas.sizeBytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.atlas.sha256);
 }else{
  assert.equal(manifest.status,'unpublished');
  assert.equal(validateTouchDesignerSixScreen(manifest),null);
 }
});

test('both info panels share the original layout and only the phi-net HERE copy differs',async()=>{
 assert.deepEqual(getTouchDesignerHereLines(),[
  'HERE: SOURCE → CONTOURS →',
  'DISPLACEMENT + FEEDBACK'
 ]);
 const custom=['HERE: SCAN → RAISED PHI NET','GOLDEN ANGLE · 1/φ STEPS · 2 VIEWS'];
 assert.deepEqual(getTouchDesignerHereLines(custom),custom);
 const monitor=await readFile(new URL('../gallery/visit/phi-reception-living-monitor.mjs',import.meta.url),'utf8');
 assert.match(monitor,/hereLines:bankId===2/);
 for(const line of custom)assert.ok(monitor.includes(line));
 const info=await readFile(new URL('../gallery/visit/phi-touchdesigner-info-row.mjs',import.meta.url),'utf8');
 assert.equal(info.includes('studyDescription'),false,'No separate design on bank two');
 assert.ok(info.includes("text(c,'WHAT IS TOUCHDESIGNER?',18,39,23"));
 assert.ok(info.includes("text(c,'PROPORTION PIECE · TRANSLATION ROOM',18,225,11"));
});
