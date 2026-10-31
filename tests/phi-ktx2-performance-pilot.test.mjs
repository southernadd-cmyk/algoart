import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {isPhiShadowSurface} from '../test/virtual-gallery/phi-room-lighting-renderer.mjs';

const source=readFileSync('test/virtual-gallery/gallery-phi.js','utf8');
const materials=readFileSync('test/virtual-gallery/architectural-materials.mjs','utf8');
const live=readFileSync('gallery/visit/gallery-phi.js','utf8');
const liveMaterials=readFileSync('gallery/visit/architectural-materials.mjs','utf8');

test('live and test movement and artwork focus reuse hotpath scratch vectors',()=>{
 assert.match(source,/const phiFrameVectors=/);
 assert.match(source,/const eye=camera\.getWorldPosition\(phiFrameVectors\.eye\)/);
 assert.match(source,/const toward=phiFrameVectors\.exhibitDirection\.copy\(exhibit\.position\)\.sub\(eye\)/);
 assert.match(source,/const forward=phiFrameVectors\.xrForward\.set\(0,0,-1\)/);
 assert.doesNotMatch(source,/const toward=exhibit\.position\.clone\(\)\.sub\(eye\)/);
});

test('test-only KTX2 pilot is opt-in and can fall back to the source JPEG',()=>{
 assert.match(materials,/get\('ktx2'\)==='1'/);
 assert.match(materials,/brick-normal-ktx2-pilot/);
 assert.match(materials,/fallback-jpg/);
 assert.match(materials,/normal\('brick-normal',MATERIAL_SOURCES\.brick\.normal,\[exteriorBrick\],\.19\)/);
 assert.match(live,/const phiFrameVectors=/);
 assert.doesNotMatch(liveMaterials,/__phiKTX2Pilot/);
});

test('shadow material safety matches prior transparent/opaque behaviour',()=>{
 const surface=material=>({isMesh:true,isReflector:false,name:'wall',material});
 const opaque={isMeshStandardMaterial:true,transparent:false};
 const cutout={isMeshStandardMaterial:true,transparent:true,alphaTest:.5};
 const glass={isMeshStandardMaterial:true,transparent:true,alphaTest:0};
 assert.equal(isPhiShadowSurface(surface(opaque)),true);
 assert.equal(isPhiShadowSurface(surface([opaque,cutout])),true);
 assert.equal(isPhiShadowSurface(surface([opaque,glass])),false);
 assert.equal(isPhiShadowSurface(surface(glass)),false);
 assert.equal(isPhiShadowSurface(surface([])),false);
 assert.equal(isPhiShadowSurface({isMesh:false}),false);
});

test('generated pilot KTX2 has a valid container header when present',()=>{
 const path='test/virtual-gallery/textures/Bricks055_NormalGL.ktx2';
 if(!existsSync(path))return;
 const buf=readFileSync(path);
 assert.ok(buf.length>256);
 assert.equal(buf.subarray(0,12).toString('hex'),'ab4b5458203230bb0d0a1a0a');
});
