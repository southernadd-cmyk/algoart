import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('Confluence tissue/watercolour renderer reuses released solo material internals',()=>{
 const html=read('../confluence/index.html');
 const materials=read('../confluence/materials.js');
 const bridge=read('../confluence/native-material.js');
 assert.match(html,/engine\/materials\/oil-render\.js/);
 assert.match(html,/js\/oil-surface\.js/);
 assert.match(materials,/renderNativeDeposit/);
 assert.match(bridge,/A\.oilMaterial\(/);
 assert.match(bridge,/A\.watercolourV2sMaterial\(/);
 assert.match(bridge,/A\.tissueKitFromPaths/);
 assert.match(bridge,/fitToSheet=false/);
 assert.match(bridge,/A\.confluenceSoloSkeleton\(paths/);
 assert.doesNotMatch(bridge,/createLinearGradient|filter.*blur/);
});
test('Confluence uses full Oil V8 and Action V4 algorithms, not shortcuts',()=>{
 const materials=read('../confluence/materials.js');
 const oil=read('../confluence/engine/materials/oil-paint-v8.js');
 const action=read('../confluence/engine/materials/action-painting-v4.js');
 assert.match(materials,/A\.renderOilPaintV8\(oilTurnSurface\.canvas/);
 assert.match(materials,/A\.actionPaintingFromPathsV4\(actionTurnSurface\.canvas/);
 assert.match(oil,/drawContactBrushV8/);
 assert.match(oil,/oilColourField/);
 assert.match(action,/fling\(ctx,r/);
 assert.match(action,/var passes=layers\*3/);
 assert.doesNotMatch(materials,/collabOilRelief|A\.collabAction\(/);
});

test('Each Action turn appends real V4 throws without regenerating the composition',()=>{
 const renderer=read('../confluence/materials.js');
 const engine=read('../confluence/engine/materials/action-painting-v4.js');
 assert.match(renderer,/renderActualAction\(entry,artist\)/);
 assert.match(renderer,/append:true/);
 assert.match(renderer,/passes:1,gesturesPerPass:/);
 assert.match(renderer,/variant:artist\.id/);
 assert.doesNotMatch(renderer,/sourcePaths\(actionMarks\)/);
 assert.match(engine,/if\(!options\.append\|\|target\.width!==targetW/);
 assert.match(engine,/if\(Number\.isFinite\(options\.passes\)\)/);
 assert.match(engine,/fling\(ctx,r,a,b,colour/);
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
 assert.match(renderer,/renderNativeDeposit\(tissueTurn,'tissue',newMarks/);
 assert.match(renderer,/renderActualTissue\(fresh,artist\)/);
 assert.match(renderer,/tissueMarks\.push\(\.\.\.fresh\)/);
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
 assert.match(native,/trace\.ink\|\|artist\.inks/);
 assert.doesNotMatch(renderer,/tissueArtists = new Map/);
 assert.doesNotMatch(renderer,/for\(const \{artist,traces,gain,marks\} of tissueArtists/);
});

test('All materials deposit on one persistent sheet in chronological order',()=>{
 const renderer=read('../confluence/materials.js');
 assert.match(renderer,/paint\(output, action\)/);
 assert.match(renderer,/layTurn\(tissueSurface,tissueTurn\)/);
 assert.match(renderer,/layTurn\(watercolourSurface,watercolourTurn,'multiply'\)/);
 assert.match(renderer,/layTurn\(oilSurface,oilTurnSurface\)/);
 assert.match(renderer,/layTurn\(actionSurface,actionTurnSurface\)/);
 assert.match(renderer,/output\.drawImage\(turn\.canvas,0,0\)/);
 assert.doesNotMatch(renderer,/output\.clearRect\(/);
 assert.doesNotMatch(renderer,/showSheet\(/);
 assert.doesNotMatch(renderer,/sourcePaths\(oilMarks\)/);
 assert.doesNotMatch(renderer,/renderNativeDeposit\(tissueSurface/);
 assert.doesNotMatch(renderer,/renderNativeDeposit\(watercolourSurface/);
});

test('Watercolour uses native source-hue V2S on one cumulative full-paper surface',()=>{
 const renderer=read('../confluence/materials.js');
 const bridge=read('../confluence/native-material.js');
 const solo=read('../js/watercolour-v2s.js');
 assert.match(renderer,/const tissueMarks=\[\],watercolourMarks=\[\]/);
 assert.match(renderer,/function renderActualWatercolour\(/);
 assert.match(renderer,/renderNativeDeposit\(watercolourTurn,'watercolour',newMarks/);
 assert.match(renderer,/watercolourMarks\.push\(\.\.\.fresh\)/);
 assert.match(renderer,/renderActualWatercolour\(fresh,artist\)/);
 assert.match(renderer,/layTurn\(watercolourSurface,watercolourTurn,'multiply'\)/);
 assert.match(renderer,/materialFootprint\('watercolour',watercolourSurface\)/);
 assert.match(renderer,/coverageHistory=\{watercolour:null,oil:null,action:null\}/);
 assert.doesNotMatch(renderer,/avoidForeignMarks\(/);
 assert.doesNotMatch(renderer,/renderNativeDeposit\(pigment,material/);
 assert.doesNotMatch(renderer,/A\.collabWatercolour\(/);
 assert.match(bridge,/A\.watercolourV2sMaterial\(/);
 assert.match(bridge,/fitToSheet=false/);
 assert.match(solo,/fidelity:true,fitToSheet:true/);
});

test('Confluence runs each released material engine on an actual shared full sheet',()=>{
  const index=read('../confluence/index.html');
  const renderer=read('../confluence/materials.js');
  const bridge=read('../confluence/native-material.js');
  const brush=read('../confluence/engine/materials/oil-paint-v8.js');
  const action=read('../confluence/engine/materials/action-painting-v4.js');
  const skeleton=read('../confluence/engine/materials/oil-render.js');
  assert.match(index,/js\/oil-v1-core-a\.js/);
  assert.match(index,/js\/oil-v1-core-b\.js/);
  assert.match(index,/js\/oil-v1-core-c\.js/);
  assert.match(index,/engine\/materials\/oil-paint-v8\.js/);
  assert.match(renderer,/A\.renderOilPaintV8\(oilTurnSurface\.canvas/);
  assert.match(renderer,/A\.actionPaintingFromPathsV4\(actionTurnSurface\.canvas/);
  assert.match(brush,/options\.sourceCapture\|\|A\.captureCompositionV5/);
  assert.match(brush,/options\.transparentSheet!==true/);
  assert.match(action,/options\.sourceInks\?\.length/);
  assert.match(action,/options\.transparentSheet!==true/);
  assert.match(skeleton,/A\.confluenceSoloSkeleton=skeleton/);
  assert.match(bridge,/A\.confluenceSoloSkeleton\(paths/);
  assert.match(bridge,/options\.directPaper===true/);
  assert.match(renderer,/sourcePaths=traces=>/);
  assert.doesNotMatch(renderer,/A\.collabAction\(/);
  assert.doesNotMatch(renderer,/A\.collabWatercolour\(/);
  assert.doesNotMatch(renderer,/A\.collabTissue\(/);
  assert.doesNotMatch(renderer,/A\.collabOilRelief\(/);
  assert.doesNotMatch(renderer,/function box\(/);
  assert.match(renderer,/paint\(output, action\)/);
});
