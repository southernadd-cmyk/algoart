import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createPhiStablePointLightPool,countVisibleRealPhiPointLights,PHI_STABLE_POINT_COUNT} from '../test/virtual-gallery/phi-stable-point-lights.mjs';

function mount(scene,count){
 return Array.from({length:count},(_,index)=>{
  const light=new THREE.PointLight('#ffeedd',index+2,5,2);
  light.position.set(index+1,2,3);
  scene.add(light);return light;
 });
}
test('fixed point-light count remains 7 across reception-to-floor cleanup',()=>{
 const scene=new THREE.Scene(),actual=mount(scene,5);
 const study=createPhiStablePointLightPool({THREE,scene,enabled:true});
 assert.equal(PHI_STABLE_POINT_COUNT,7);
 let status=study.sync();
 assert.deepEqual({real:status.real,spares:status.spares,total:status.total},{real:5,spares:2,total:7});
 // Arrival builds the destination while reception remains attached.
 const departing=mount(scene,2);
 status=study.sync();
 assert.deepEqual({real:status.real,spares:status.spares,total:status.total},{real:7,spares:0,total:7});
 for(const light of departing)scene.remove(light);
 status=study.sync();
 assert.deepEqual({real:status.real,spares:status.spares,total:status.total},{real:5,spares:2,total:7});
 assert.equal(study.stats.stable,true);
 assert.equal(scene.children.filter(x=>x.isPointLight).length,7);
 for(const light of actual)assert.equal(light.intensity,actual.indexOf(light)+2);
 for(const light of study.spares){
  assert.equal(light.intensity,0);
  assert.equal(light.castShadow,false);
  assert.equal(light.visible,true);
 }
});
test('pool never moves, hides, changes shadow flags or modifies existing lights',()=>{
 const scene=new THREE.Scene(),real=mount(scene,4);
 real[0].castShadow=true;
 const before=real.map(x=>({power:x.intensity,xyz:x.position.toArray(),shadow:x.castShadow,visible:x.visible}));
 const pool=createPhiStablePointLightPool({THREE,scene,enabled:true});
 pool.sync();
 assert.deepEqual(real.map(x=>({power:x.intensity,xyz:x.position.toArray(),shadow:x.castShadow,visible:x.visible})),before);
 assert.equal(pool.stats.spares,3);
});
test('nonvisible parent lights do not contribute; spares never double-count',()=>{
 const scene=new THREE.Scene(),group=new THREE.Group();
 scene.add(group);group.visible=false;
 group.add(new THREE.PointLight(0xffffff,10));
 mount(scene,2);
 const pool=createPhiStablePointLightPool({THREE,scene,enabled:true});
 assert.equal(countVisibleRealPhiPointLights(scene),2);
 pool.sync();
 assert.equal(countVisibleRealPhiPointLights(scene,pool.spares),2);
 assert.equal(pool.stats.total,7);
 assert.equal(scene.children.filter(x=>x.isPointLight).length,7);
});
test('overflow is reported, never silently removes a real light',()=>{
 const scene=new THREE.Scene();mount(scene,8);
 const pool=createPhiStablePointLightPool({THREE,scene,enabled:true});
 const status=pool.sync();
 assert.equal(status.overCapacity,1);
 assert.equal(status.stable,false);
 assert.equal(status.total,8);
 assert.equal(scene.children.filter(x=>x.isPointLight).length,8);
});
test('explicit off mode leaves the scene unchanged',()=>{
 const scene=new THREE.Scene();mount(scene,5);
 const pool=createPhiStablePointLightPool({THREE,scene,enabled:false});
 pool.sync();
 assert.equal(scene.children.length,5);
 assert.equal(pool.spares.length,0);
});
test('target is validated',()=>{
 const scene=new THREE.Scene();
 assert.throws(()=>createPhiStablePointLightPool({THREE,scene,enabled:true,target:-1}),RangeError);
 assert.throws(()=>createPhiStablePointLightPool({THREE,scene,enabled:true,target:1.3}),RangeError);
});

test('a new real point light added after a floor sync is compensated before rendering',()=>{
 const scene=new THREE.Scene();
 const real=mount(scene,4);
 const pool=createPhiStablePointLightPool({THREE,scene,enabled:true});
 pool.sync('constructed');
 assert.equal(scene.children.filter(x=>x.isPointLight).length,7);
 const late=new THREE.PointLight('#eeeecc',3,6,2);
 late.name='late-loaded-architectural-light';
 scene.add(late);
 // Without a new sync Three.js would compile a fresh 8-light shader.
 assert.equal(scene.children.filter(x=>x.isPointLight).length,8);
 const result=pool.sync('pre-render-doors-opening');
 assert.equal(result.real,5);
 assert.equal(result.spares,2);
 assert.equal(result.total,7);
 assert.equal(scene.children.filter(x=>x.isPointLight).length,7);
 assert.equal(late.intensity,3);
 assert.equal(pool.stats.peakReal,5);
 assert.ok(pool.stats.lightChanges.some(x=>
  x.reason==='pre-render-doors-opening'&&x.before===8&&x.after===7));
 scene.remove(late);
 const restored=pool.sync('pre-render-doors-opening');
 assert.equal(restored.spares,3);
 assert.equal(restored.total,7);
 assert.equal(real.length,4);
});
