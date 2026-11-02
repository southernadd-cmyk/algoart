import assert from 'node:assert/strict';
import test from 'node:test';
import {phiRealTimeShadowsEnabled,configurePhiRealTimeShadows} from '../test/virtual-gallery/phi-shadow-comparison.mjs';

test('ordinary test tower retains existing real-time shadows',()=>{
 assert.equal(phiRealTimeShadowsEnabled(''),true);
 assert.equal(phiRealTimeShadowsEnabled('?shadows=1&shaderreuse=0'),true);
});
test('shadows=0 disables only shadow mapping, not phi light appearance',()=>{
 assert.equal(phiRealTimeShadowsEnabled('?earlycompile=0&shadows=0'),false);
 const renderer={shadowMap:{enabled:true,type:'original'}};
 const sun={castShadow:true,position:{x:1,y:2,z:3},intensity:2.35,color:'#fff5e5'};
 const result=configurePhiRealTimeShadows(renderer,sun,{enabled:false,shadowType:'PCF'});
 assert.deepEqual(result,{enabled:false,shadowMaps:0});
 assert.equal(renderer.shadowMap.enabled,false);
 assert.equal(renderer.shadowMap.type,'original');
 assert.equal(sun.castShadow,false);
 assert.deepEqual(sun.position,{x:1,y:2,z:3});
 assert.equal(sun.intensity,2.35);
 assert.equal(sun.color,'#fff5e5');
});
test('baseline maps and caster are restored on the control path',()=>{
 const renderer={shadowMap:{enabled:false,type:'original'}};
 const sun={castShadow:false};
 assert.deepEqual(configurePhiRealTimeShadows(renderer,sun,{enabled:true,shadowType:'PCF'}),{enabled:true,shadowMaps:2});
 assert.equal(renderer.shadowMap.enabled,true);
 assert.equal(renderer.shadowMap.type,'PCF');
 assert.equal(sun.castShadow,true);
});
