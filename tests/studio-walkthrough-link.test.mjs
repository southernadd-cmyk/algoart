import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const studio=readFileSync('js/app.js','utf8');
const editor=readFileSync('index.html','utf8');
const replay=readFileSync('about/step-by-step/index.html','utf8');
const shared=readFileSync('js/settings-url.js','utf8');
const context={window:{}};
vm.runInNewContext(shared,context);
const map=context.window.AlgoArt.PARAM_KEYS;
test('one canonical map drives studio and replay',()=>{
 assert.ok(Object.keys(map).length>=30);
 assert.match(studio,/var PARAM_KEYS=A\.PARAM_KEYS;/);
 assert.match(replay,/const editorKeys=A\.PARAM_KEYS;/);
 assert.match(editor,/js\/settings-url\.js/);
 assert.match(replay,/js\/settings-url\.js/);
 assert.match(studio,/watch\.href=replay\.href/);
});
test('all artwork parameters, version, materials and framing survive the handoff',()=>{
 assert.match(studio,/params\.set\('v'/);
 assert.match(studio,/Object\.keys\(PARAM_KEYS\)/);
 assert.match(studio,/params\.set\('sheet','phi'\)/);
 assert.match(studio,/params\.set\('material'/);
 assert.match(replay,/\.\.\.incomingSettings/);
 assert.match(replay,/SUPPORTED_RENDERER_VERSIONS\.includes/);
 assert.match(replay,/incoming\.get\('sheet'\)==='phi'/);
 assert.match(replay,/originalMaterial/);
 assert.match(replay,/editorURL\.searchParams/);
 assert.match(replay,/Object\.entries\(editorKeys\)/);
 assert.match(replay,/target\.searchParams\.set\(key/);
});

test('action paint replay uses real material layers and blank first stage',()=>{
 assert.match(replay,/action-painting-v1\.js/);
 assert.match(replay,/version===4\?A\.renderActionPaintingV4:version===3\?A\.renderActionPaintingV3:A\.renderActionPainting/);
 assert.match(replay,/save\('The blank page',blank\)/);
 assert.match(replay,/const stepTotal=\(\)=>isAction\(\)\|\|capturedMaterial\(\)/);
 assert.match(replay,/onStage:\(label,canvas\)=>save\(label,canvas\)/);
 assert.match(replay,/materialFromURL/);
 assert.match(replay,/id="replayMaterial"/);
 assert.match(replay,/id="continueEditing"/);
});

