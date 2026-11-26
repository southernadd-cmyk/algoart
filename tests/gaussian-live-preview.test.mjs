import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFile} from 'node:fs/promises';
import {architectureFaces,remainingArchitectureIndices} from '../gallery/gaussian-splat-lab/live-preview.mjs';

test('actual world-space box face sampling preserves orientation and dimensions',()=>{
 const scene=new THREE.Scene(),mesh=new THREE.Mesh(new THREE.BoxGeometry(6,4,.19),new THREE.MeshStandardMaterial());
 scene.add(mesh);mesh.position.set(1,2,3);mesh.rotation.y=Math.PI/3;
 const eye=mesh.localToWorld(new THREE.Vector3(0,0,3));
 const faces=architectureFaces(THREE,[mesh],eye);
 assert.equal(faces.length,1);const face=faces[0];
 assert.ok(Math.abs(face.width*face.height-24)<1e-6);
 assert.ok(face.n.dot(eye.clone().sub(face.centre))>0);
 assert.ok(Math.abs(face.u.clone().cross(face.v).dot(face.n)-1)<1e-6);
 const original=mesh.geometry.index;const remaining=remainingArchitectureIndices(original,new Set([face.at]));
 assert.equal(remaining.length,30);assert.equal(original.count,36);
 assert.deepEqual(remaining,Array.from(original.array).filter((_,i)=>i<face.at||i>=face.at+6));
});
test('only opaque parented production geometry is sampled',()=>{
 const scene=new THREE.Scene();
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(4,4,1),new THREE.MeshStandardMaterial({transparent:true,opacity:.5}));
 scene.add(mesh);assert.equal(architectureFaces(THREE,[mesh],new THREE.Vector3(0,0,3)).length,0);
});
test('the full tower is built with isolated source injection and one Three runtime',async()=>{
 const build=await readFile(new URL('../automation/build-sculpture-v2-test.mjs',import.meta.url),'utf8');
 assert.match(build,/entryPoints:\['gallery\/visit\/gallery-phi\.js'\]/);
 assert.match(build,/gallery-phi-gaussian-preview-bundle\.js/);
 assert.match(build,/createGaussianLivePreview/);
 assert.match(build,/gaussianLab\?\.setArchitecture/);
 assert.match(build,/external:\['three','three\/\*','@sparkjsdev\/spark'\]/);
 const preview=await readFile(new URL('../gallery/gaussian-splat-lab/live-preview.mjs',import.meta.url),'utf8');
 assert.match(preview,/renderer\.render\(scene,view\)/);
 assert.match(preview,/renderer\.readRenderTargetPixels/);
 assert.match(preview,/p\.mesh\.geometry=p\.original/);
});
