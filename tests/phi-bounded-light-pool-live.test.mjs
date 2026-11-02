import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {PHI_ROOM_POOL_SIZE,PHI_ART_POOL_SIZE,chooseNearestPhiRoomAnchors} from '../gallery/visit/phi-bounded-light-pool.mjs';
const live=readFileSync(new URL('../gallery/visit/gallery-phi.js',import.meta.url),'utf8');
const testTower=readFileSync(new URL('../test/virtual-gallery/gallery-phi.js',import.meta.url),'utf8');

test('production uses the approved 3+3 bounded spotlight pool by default',()=>{
 assert.equal(PHI_ROOM_POOL_SIZE,3);
 assert.equal(PHI_ART_POOL_SIZE,3);
 assert.match(live,/const phiBoundedLightPoolEnabled=new URLSearchParams\(location\.search\)\.get\('lightpool'\)!=='0'/);
 assert.match(live,/Array\.from\(\{length:PHI_ROOM_POOL_SIZE\}/);
 assert.match(live,/Array\.from\(\{length:phiBoundedLightPoolEnabled\?PHI_ART_POOL_SIZE:5\}/);
 assert.match(live,/phiBoundedRoomAnchors\.push\(\{mount,fallback,cell:/);
 assert.match(live,/preparePhiBoundedRoomLights\(plan\.phi,elevation\)/);
 assert.match(live,/updatePhiBoundedRoomLights\(\)/);
});
test('the original per-room lighting is retained as an explicit emergency fallback',()=>{
 assert.match(live,/else applyRefinedPhiRoomLighting\(phiRoomLightEntries,plan\.phi\)/);
 assert.match(live,/if\(phiBoundedLightPoolEnabled\)\{/);
 assert.match(live,/else\{\s*const light=new THREE\.SpotLight/);
});
test('same phi placement logic in approved test and production',()=>{
 const start=s=>s.indexOf('function preparePhiBoundedRoomLights(');
 const end=(s,n)=>s.indexOf('function updateExhibitLighting(',n);
 const a=live.slice(start(live),end(live,start(live)));
 const b=testTower.slice(start(testTower),end(testTower,start(testTower)));
 assert.ok(a.length>1500);
 assert.equal(a,b);
});
test('nearest fixture selection remains bounded and stable',()=>{
 const anchors=[0,5,10,15,20].map((x,i)=>({position:{x,z:0},roomIndex:i,power:12}));
 const nearest=chooseNearestPhiRoomAnchors(anchors,{x:17,z:0});
 assert.deepEqual(nearest.map(x=>x.roomIndex),[3,4,2]);
 assert.equal(nearest.length,PHI_ROOM_POOL_SIZE);
});
test('existing real-time shadow lighting remains active in production',()=>{
 const renderer=readFileSync(new URL('../gallery/visit/phi-room-lighting-renderer.mjs',import.meta.url),'utf8');
 assert.match(renderer,/renderer\.shadowMap\.enabled=true/);
 assert.match(renderer,/sun\.castShadow=true/);
});
