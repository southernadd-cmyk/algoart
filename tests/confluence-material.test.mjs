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

test('Every tissue turn uses actual full-sheet V7 rather than a marker-like shim',()=>{
 const renderer=read('../confluence/materials.js');
 const bridge=read('../confluence/native-material.js');
 const ui=read('../confluence/ui.js');
 assert.match(renderer,/function renderActualTissue\(/);
 assert.match(renderer,/renderNativeDeposit\(tissueSurface,'tissue',tissueMarks/);
 assert.match(renderer,/renderActualTissue\(\)/);
 assert.match(renderer,/tissueMarks\.push\(\{\.\.\.trace,ink:artistInk/);
 assert.doesNotMatch(renderer,/collabTissue\(/);
 assert.doesNotMatch(renderer,/globalAlpha=\.36/);
 assert.match(renderer,/deposit\.finalize=\(\)=>\{\}/);
 assert.match(bridge,/A\.oilMaterial\(ctx/);
 assert.match(ui,/state\.paintShared\.finalize\?\.\(\)/);
 assert.doesNotMatch(read('../js/oil-material.js'),/confluenceTissueGraphite/);
});
test('One tissue surface preserves all artists palettes without duplicating atmosphere',()=>{
 const renderer=read('../confluence/materials.js');
 const native=read('../confluence/native-material.js');
 assert.match(renderer,/tissueMarks\.map\((?:trace|t)=>(?:trace|t)\.ink\)/);
 assert.match(renderer,/all-tissue-voices/);
 assert.match(native,/t\.ink \|\| artist\.inks/);
 assert.doesNotMatch(renderer,/tissueArtists = new Map/);
 assert.doesNotMatch(renderer,/for\(const \{artist,traces,gain,marks\} of tissueArtists/);
});

test('Tissue can develop without repainting foreign material over wrong paper',()=>{
 const renderer=read('../confluence/materials.js');
 assert.match(renderer,/paintingWithoutTissue\.drawImage\(output\.canvas,0,0\)/);
 assert.match(renderer,/paint\(paintingWithoutTissue, action\)/);
 assert.match(renderer,/paintingWithoutTissue\.globalCompositeOperation=material/);
 assert.match(renderer,/output\.drawImage\(tissueSurface\.canvas,0,0\)/);
 assert.match(renderer,/avoidForeignMarks\(tissueSurface\)/);
 assert.match(renderer,/protectRaster\(pigment,area\)/);
});

test('Watercolour uses native source-hue V2S on one cumulative full-paper surface',()=>{
 const renderer=read('../confluence/materials.js');
 const bridge=read('../confluence/native-material.js');
 const solo=read('../js/watercolour-v2s.js');
 assert.match(renderer,/const watercolourMarks=\[\]/);
 assert.match(renderer,/function renderActualWatercolour\(/);
 assert.match(renderer,/renderNativeDeposit\(watercolourSurface,'watercolour',watercolourMarks/);
 assert.match(renderer,/watercolourMarks\.push\(\{\.\.\.trace,ink:artistInk/);
 assert.match(renderer,/renderActualWatercolour\(\)/);
 assert.match(renderer,/globalCompositeOperation='multiply'/);
 assert.match(renderer,/watercolourFootprint\(\)/);
 assert.match(renderer,/previousWatercolourCoverage/);
 assert.match(renderer,/avoidForeignMarks\(watercolourSurface,watercolourForeignInk\)/);
 assert.doesNotMatch(renderer,/renderNativeDeposit\(pigment,material/);
 assert.doesNotMatch(renderer,/A\.collabWatercolour\(/);
 assert.match(bridge,/A\.watercolourV2sMaterial\(/);
 assert.match(bridge,/fitToSheet=false/);
 assert.match(solo,/fidelity:true,fitToSheet:true/);
});
