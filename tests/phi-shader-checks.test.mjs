import test from 'node:test';
import assert from 'node:assert/strict';
import {configurePhiShaderErrorChecks} from '../test/virtual-gallery/phi-shader-checks.mjs';

test('TEST tower disables expensive shader diagnostic syncs by default',()=>{
 const renderer={debug:{checkShaderErrors:true}};
 assert.equal(configurePhiShaderErrorChecks(renderer,''),false);
 assert.equal(renderer.debug.checkShaderErrors,false);
});
test('query flag restores original shader validation for A/B comparison',()=>{
 const renderer={debug:{checkShaderErrors:true}};
 assert.equal(configurePhiShaderErrorChecks(renderer,'?gltrace=1&shaderchecks=1'),true);
 assert.equal(renderer.debug.checkShaderErrors,true);
});
test('test setting does not alter renderer materials, effects or presets',()=>{
 const material={name:'original'};
 const renderer={debug:{checkShaderErrors:true},material};
 configurePhiShaderErrorChecks(renderer,'?shaderchecks=0');
 assert.equal(renderer.material,material);
});
