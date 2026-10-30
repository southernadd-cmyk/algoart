import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {PHI_FX_PRESETS,phiFXSummary,phiGlowTargets} from '../gallery/visit/phi-post-fx.mjs';

test('all three treatments are opt-in and remain confined to the test bundle',()=>{
 assert.deepEqual(PHI_FX_PRESETS,['original','architectural','luminous','photographic']);
 const staging=readFileSync(new URL('../automation/build-phi-test-room-signs.mjs',import.meta.url),'utf8');
 const production=readFileSync(new URL('../gallery/visit/gallery-phi.js',import.meta.url),'utf8');
 const post=readFileSync(new URL('../gallery/visit/phi-post-fx.mjs',import.meta.url),'utf8');
 assert.match(staging,/phiPostFX\.render\(dt,null\)/);
 assert.match(staging,/currentInfoExhibit\.position:null/);
 assert.doesNotMatch(staging,/phiLightingComparison|createPhiLightingComparison/);
 assert.doesNotMatch(production,/createPhiPostFX|phiPostFX/);
 for(const cls of ['SSAOEffect','SelectiveBloomEffect','DepthOfFieldEffect','ToneMappingEffect']){
  assert.ok(post.includes('new '+cls),'Missing actual effect '+cls);
 }
 assert.match(post,/ToneMappingMode\.NEUTRAL/);
 assert.match(post,/newDOFPass\.enabled=false/);
 assert.match(post,/dofPass\.enabled=active/);
 assert.match(post,/bloom\.ignoreBackground=true/);
});
test('bloom selection includes only holograms and real TouchDesigner panels',()=>{
 const scene=new THREE.Scene();
 const holo=new THREE.Group();holo.name='phi-reception-tower-hologram';scene.add(holo);
 const line=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial());
 line.name='hologram-architectural-edges';holo.add(line);
 const bank=new THREE.Group();bank.name='phi-reception-three-living-monitors';scene.add(bank);
 const face=new THREE.Mesh(new THREE.PlaneGeometry(),new THREE.MeshBasicMaterial());
 face.name='monitor-screen';bank.add(face);
 const art=new THREE.Mesh(new THREE.PlaneGeometry(),new THREE.MeshBasicMaterial());
 art.name='painting-face';scene.add(art);
 const selected=phiGlowTargets(scene);
 assert.ok(selected.includes(line));assert.ok(selected.includes(face));
 assert.ok(!selected.includes(art));
});
test('per-preset frame statistics retain spikes for performance comparison',()=>{
 const s=phiFXSummary([...Array(19).fill(16),64,250]);
 assert.deepEqual(s,{median:16,p95:64,stalls:2,count:21});
});
