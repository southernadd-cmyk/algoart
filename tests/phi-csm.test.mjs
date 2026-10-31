import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {createPhiFrameStudyMaterial,PHI_FRAME_FRAGMENT} from '../test/virtual-gallery/phi-csm-material.mjs';
test('CSM extends standard PBR with the identical approved base colour and physical values',()=>{
 const custom=createPhiFrameStudyMaterial(THREE),base=createPhiFrameStudyMaterial(THREE,{enabled:false});
 assert.equal(custom.isMeshStandardMaterial,true);assert.equal(base.isMeshStandardMaterial,true);
 assert.ok(custom.color.equals(base.color));assert.equal(custom.roughness,base.roughness);assert.equal(custom.metalness,base.metalness);
 const shader={vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader,uniforms:THREE.UniformsUtils.clone(THREE.ShaderLib.standard.uniforms)};
 custom.onBeforeCompile(shader,{});
 assert.match(shader.fragmentShader,/vPhiFramePosition/);
 assert.match(shader.fragmentShader,/lights_fragment_begin/);
 assert.match(shader.fragmentShader,/shadowmap_pars_fragment/);
 assert.match(shader.fragmentShader,/roughnessFactor/);
 assert.match(PHI_FRAME_FRAGMENT,/fwidth/);assert.doesNotMatch(PHI_FRAME_FRAGMENT,/uniform float.*time|csm_FragColor|discard/);
});
test('live is isolated; baseline switch is scoped to the existing frame-study room',()=>{
 const live=readFileSync('gallery/visit/gallery-phi.js','utf8'),builder=readFileSync('automation/build-phi-test-room-signs.mjs','utf8');
 assert.doesNotMatch(live,/createPhiFrameStudyMaterial|phiCSMEnabled/);
 assert.match(builder,/get\('csm'\)!=='0'/);
 assert.match(builder,/p.room===frameStudyRoom\?architecturalFrameStudy:join/);
});
