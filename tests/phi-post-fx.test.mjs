import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {PHI_FX_PRESETS,PHI_FX_CONTROLS,PHI_FX_DEFAULTS,phiFXSettings,phiFXExport,
 phiFXSummary,phiGlowTargets} from '../gallery/visit/phi-post-fx.mjs';

test('three tunable presets and an unprocessed original, with clamped numeric sliders',()=>{
 assert.deepEqual(PHI_FX_PRESETS,['original','architectural','luminous','photographic']);
 assert.equal(PHI_FX_CONTROLS.length,13);
 assert.ok(PHI_FX_DEFAULTS.luminous.bloomIntensity>2,'The luminous default must be visible');
 const result=phiFXSettings('architectural',{bloomIntensity:99,bloomThreshold:-4,contrast:.3333,grain:'not numeric'});
 assert.equal(result.bloomIntensity,5);
 assert.equal(result.bloomThreshold,0);
 assert.ok(Math.abs(result.contrast-.33)<.001);
 assert.equal(result.grain,PHI_FX_DEFAULTS.architectural.grain);
 assert.throws(()=>phiFXSettings('alien'),/Unknown/);
});
test('export contains complete values that the user can paste back into chat',()=>{
 const values=phiFXSettings('photographic',{bokeh:5,aoIntensity:2.5,glowMode:'installations'});
 const payload=JSON.parse(phiFXExport('photographic',values,{pixelRatio:1.6}));
 assert.equal(payload.version,2);assert.equal(payload.preset,'photographic');
 assert.equal(payload.values.bokeh,5);assert.equal(payload.values.aoIntensity,2.5);
 assert.equal(payload.values.glowMode,'installations');
 assert.equal(payload.performance.pixelRatio,1.6);
});
test('controls update live effect values rather than rebuilding for every slider drag',()=>{
 const builder=readFileSync(new URL('../automation/build-phi-test-room-signs.mjs',import.meta.url),'utf8');
 const live=readFileSync(new URL('../gallery/visit/gallery-phi.js',import.meta.url),'utf8');
 const src=readFileSync(new URL('../gallery/visit/phi-post-fx.mjs',import.meta.url),'utf8');
 assert.match(builder,/phiPostFX.render\(dt,null\)/);
 assert.match(builder,/currentInfoExhibit.position:null/);
 assert.doesNotMatch(builder,/phiLightingComparison|createPhiLightingComparison/);
 assert.doesNotMatch(live,/createPhiPostFX|phiPostFX/);
 for(const tag of ['NormalPass','SSAOEffect','SelectiveBloomEffect','BloomEffect','DepthOfFieldEffect','ToneMappingEffect'])
  assert.ok(src.includes('new '+tag),'missing '+tag);
 assert.match(src,/ToneMappingMode.NEUTRAL/);
 assert.match(src,/e.fullBloom/);assert.match(src,/e.ao.intensity/);
 assert.match(src,/inputs.get\(spec.key\)/);
 assert.match(src,/navigator.clipboard.writeText\(value\)/);
 assert.match(src,/exportBox.select\(\)/);
 assert.match(src,/bypass=!bypass/);
});
test('installations-only glow selection excludes artwork',()=>{
 const scene=new THREE.Scene();
 const holo=new THREE.Group();holo.name='phi-reception-tower-hologram';scene.add(holo);
 const line=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial());
 line.name='hologram-architectural-edges';holo.add(line);
 const monitors=new THREE.Group();monitors.name='phi-reception-three-living-monitors';scene.add(monitors);
 const face=new THREE.Mesh(new THREE.PlaneGeometry(),new THREE.MeshBasicMaterial());face.name='monitor-screen';monitors.add(face);
 const art=new THREE.Mesh(new THREE.PlaneGeometry(),new THREE.MeshBasicMaterial());art.name='painting-face';scene.add(art);
 const result=phiGlowTargets(scene);
 assert.ok(result.includes(line));assert.ok(result.includes(face));assert.ok(!result.includes(art));
});
test('performance metrics retain frame spikes',()=>{
 assert.deepEqual(phiFXSummary([...Array(19).fill(16),64,250]),{median:16,p95:64,stalls:2,count:21});
});
