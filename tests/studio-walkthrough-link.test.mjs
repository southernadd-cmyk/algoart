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
 assert.match(replay,/target\.searchParams\.set\('seed'/);
});

test('action paint replay uses real material layers and blank first stage',()=>{
 assert.match(replay,/action-painting-v1\.js/);
 assert.match(replay,/A\.actionPaintingFromPaths\(painting,paths,s,\.75/);
 assert.match(replay,/if\(layers===0\)/);
 assert.match(replay,/const stepTotal=\(\)=>isAction\(\)\?actionLayerCount:paths\.length/);
 assert.match(replay,/materialFromURL/);
 assert.match(replay,/id="replayMaterial"/);
 assert.match(replay,/id="continueEditing"/);
});
