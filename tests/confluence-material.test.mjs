import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('Confluence tissue/watercolour renderer reuses released solo material internals',()=>{
 const html=read('../confluence/index.html');
 const materials=read('../confluence/materials.js');
 const bridge=read('../confluence/native-material.js');
 assert.match(html,/js\/oil-render\.js/);
 assert.match(html,/js\/oil-surface\.js/);
 assert.match(materials,/renderNativeDeposit/);
 assert.match(bridge,/A\.oilMaterial\(/);
 assert.match(bridge,/A\.watercolourV2sMaterial\(/);
 assert.match(bridge,/A\.tissueKitFromPaths/);
 assert.match(bridge,/fitToSheet=false/);
 assert.match(bridge,/sourceRGB/);
 assert.doesNotMatch(bridge,/createLinearGradient|filter.*blur/);
});
test('Confluence still uses genuine oil V8 brush, and Action V4 fling',()=>{
 const materials=read('../confluence/materials.js');
 const action=read('../confluence/engine/materials/action-painting-v4.js');
 assert.match(materials,/drawContactBrushV8/);
 assert.match(materials,/collabOilRelief/);
 assert.match(action,/A\.collabAction/);
 assert.match(action,/fling\(ctx,r/);
});

test('Confluence offers only official palettes and defaults to Full Spectrum',async()=>{
 const {palettes}=await import('../confluence/collab.js');
 const ui=read('../confluence/ui.js');
 assert.deepEqual(Object.keys(palettes),['spectrum','golden','marker','cmyk','primary',
   'neon','pastel','earth','warm','cold','mono']);
 assert.ok(ui.includes("palette: 'spectrum'"));
 assert.doesNotMatch(read('../confluence/collab.js'),/Signature ink|palette === 'signature'/);
});
test('Native material layers taper at cropped tiles, not at true paper edges',async()=>{
 const {cropEdgeFeather}=await import('../confluence/native-material.js');
 const paper={width:1400,height:1000};
 const region={x:100,y:120,w:440,h:420};
 for(const pos of [[0,210],[439,210],[220,0],[220,419]]){
   assert.equal(cropEdgeFeather(...pos,440,420,region,paper),0,
     'Artificial crop boundaries must be transparent');
 }
 assert.equal(cropEdgeFeather(220,210,440,420,region,paper),1);
 assert.ok(cropEdgeFeather(25,210,440,420,region,paper)>0);
 assert.ok(cropEdgeFeather(25,210,440,420,region,paper)<1);
 // If the artist draws on the actual sheet edge, the material must remain.
 const paperEdge={x:0,y:0,w:440,h:420};
 assert.equal(cropEdgeFeather(0,210,440,420,paperEdge,paper),1);
 assert.equal(cropEdgeFeather(220,0,440,420,paperEdge,paper),1);
});

test('Tissue accumulates responsive groups and renders just once per full-sheet artist layer',()=>{
 const renderer=read('../confluence/materials.js');
 const ui=read('../confluence/ui.js');
 const lab=read('../confluence/engine/materials/oil-material.js');
 const native=read('../confluence/native-material.js');
 assert.match(renderer,/const tissueMarks = \[\]/);
 assert.match(renderer,/tissueMarks\.push\(\{\.\.\.trace,ink:artistInk/);
 assert.match(renderer,/const bounds=\{x:0,y:0,w:sheet\.width,h:sheet\.height\}/);
 assert.match(renderer,/deposit\.finalize = function finalizeTissue/);
 assert.match(ui,/state\.paintShared\.finalize\?\.\(\)/);
 assert.match(ui,/state\.paintBaseline\.finalize\?\.\(\)/);
 assert.match(lab,/kit\.revision>=7&&A\.confluenceTissueGraphite/);
 assert.match(native,/A\.confluenceTissueGraphite=true/);
 assert.doesNotMatch(read('../js/oil-material.js'),/confluenceTissueGraphite/,
    'The main solo renderer must remain untouched');
});

test('One tissue surface preserves all artists palettes without duplicating atmosphere',()=>{
 const renderer=read('../confluence/materials.js');
 const native=read('../confluence/native-material.js');
 assert.match(renderer,/tissueMarks\.map\(trace=>trace\.ink\)/);
 assert.match(renderer,/all-tissue-voices/);
 assert.match(native,/t\.ink \|\| artist\.inks/);
 assert.doesNotMatch(renderer,/tissueArtists = new Map/);
 assert.doesNotMatch(renderer,/for\(const \{artist,traces,gain,marks\} of tissueArtists/);
});

test('Tissue is deposited progressively on the shared full-size surface',()=>{
 const material=read('../confluence/materials.js');
 assert.match(material,/const tissueLive = layer\(true\)/);
 assert.match(material,/function progressiveTissue\(/);
 assert.match(material,/progressiveTissue\(traces,artist,action\)/);
 assert.match(material,/avoidForeignMarks\(tissueTurn\)/);
 assert.match(material,/protectGeometry\(group\.traces/);
 assert.match(material,/protectRaster\(pigment,area\)/);
 assert.match(material,/full\.drawImage\(tissueLive\.canvas,0,0\)/);
 assert.match(material,/output\.globalAlpha=\.36/);
});
