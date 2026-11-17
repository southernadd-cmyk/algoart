import assert from 'node:assert/strict';
import {test} from 'node:test';
import {sculpturePreset} from '../gallery/sculpture-v2-test/sculpture-presets.mjs';

test('the selected Regional Assembly preset exactly matches the artist settings',()=>{
 const preset=sculpturePreset('assembly-100-100-40-95');
 assert.deepEqual(preset.parameters,{phiPull:1,fidelity:1,depth:.4,connection:.95});
 assert.equal(preset.originalSources,true);
 assert.equal(preset.release,'assembly-20261117');
 assert.throws(()=>sculpturePreset('unapproved'),/Unknown sculpture preset/);
});
