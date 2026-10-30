import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {installReceptionPenroseInlay} from '../gallery/visit/reception-penrose-inlay.mjs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('approved Penrose inlay loads on live and test reception using one shared implementation',()=>{
 const production=read('../gallery/visit/gallery-phi.js');
 const builder=read('../automation/build-phi-test-room-signs.mjs');
 const live=read('../gallery/visit/index.html');
 const staging=read('../test/virtual-gallery/full-engine.html');
 assert.match(production,/import \{installReceptionPenroseInlay\} from '.\/reception-penrose-inlay.mjs'/);
 assert.match(production,/if\(exhibitDate===RECEPTION&&receptionTilePreview\)installReceptionPenroseInlay/);
 assert.match(live,/__phiReceptionTilePreview=true/);
 assert.match(staging,/__phiReceptionTilePreview=true/);
 assert.doesNotMatch(builder,/replace\("if\(globalThis\.__phiReceptionTilePreview/);
});
test('the 5-grid rhombs have the expected golden-frequency limit',()=>{
 const svg=read('../gallery/visit/textures/reception-penrose-inlay.svg');
 const thick=(svg.match(/class="thick"/g)||[]).length,thin=(svg.match(/class="thin"/g)||[]).length;
 assert.ok(thick>200&&thin>120);
 assert.ok(Math.abs(thick/thin-(1+Math.sqrt(5))/2)<0.15);
 assert.match(svg,/viewBox="-16 -16 32 32"/);
 assert.ok(svg.includes('stroke-width=".095"'));
 assert.ok(svg.includes('stroke-width=".033"'));
 assert.match(svg,/stroke="#29221a"/);
 assert.match(svg,/stroke="#e6b965"/);
});
test('shader preserves the base material and overlays across adjoining slabs',()=>{
 class Vector2{constructor(x,y){this.x=x;this.y=y;}}
 class TextureLoader{load(){return {userData:{}};}}
 const THREE={Vector2,TextureLoader,SRGBColorSpace:'srgb',ClampToEdgeWrapping:1001};
 const material={userData:{tileMeters:1.8},needsUpdate:false};
 const pieces=[{x:0,z:0,w:20,h:15}];
 assert.equal(installReceptionPenroseInlay(THREE,material,pieces),material);
 assert.equal(material.userData.penroseInlayInstalled,true);
 const shader={uniforms:{},fragmentShader:'void main() {\n#include <map_fragment>\n}'};
 material.onBeforeCompile(shader);
 assert.match(shader.fragmentShader,/texture2D\(receptionPenroseMap,inlayUV\)/);
 assert.match(shader.fragmentShader,/#ifdef USE_MAP/);
 assert.match(shader.fragmentShader,/adaptiveInlay/);
 assert.equal(material.userData.penroseInlay.status,'loading');
 assert.equal(shader.uniforms.receptionPenroseSpan.value,22);
 assert.equal(material.userData.tileMeters,1.8);
 assert.equal(installReceptionPenroseInlay(THREE,material,pieces),material);
});
