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
