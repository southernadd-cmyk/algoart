import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {candidates,sourceDir,outputDir,flags,readGLB,checkEquivalent} from '../automation/build-gltfpack-pilot.mjs';

test('pilot processes only three allowlisted static assets with fidelity-safe flags',()=>{
 assert.equal(candidates.length,3);
 assert.ok(candidates.every(x=>x.name.endsWith('.glb')));
 assert.deepEqual(flags,['-kn','-km','-ke']);
});
test('staging URL switch is opt-in and production build has no model redirection',()=>{
 const builder=readFileSync(new URL('../automation/build-phi-test-room-signs.mjs',import.meta.url),'utf8');
 const live=readFileSync(new URL('../gallery/visit/gallery-phi.js',import.meta.url),'utf8');
 assert.match(builder,/phiGltfpackPilot/);
 assert.match(builder,/gallery\/visit\/models\/gltfpack\//);
 assert.match(builder,/models'\)==='gltfpack'/);
 assert.doesNotMatch(live,/phiGltfpackPilot|models\/gltfpack/);
});
test('when packed assets exist, their GLB contents remain structurally compatible',()=>{
 for(const entry of candidates){
  const input=resolve(sourceDir,entry.name),output=resolve(outputDir,entry.name);
  if(!existsSync(output))continue; // npm build does not need to run for local unit tests
  const data=readGLB(output);
  assert.ok(data.doc.meshes.length>0);
  if(readFileSync(input).equals(readFileSync(output)))continue; // exact-source fallback
  const check=checkEquivalent(input,output,entry);
  assert.ok(check.sourceImageCount===check.outputImageCount);
 }
});
