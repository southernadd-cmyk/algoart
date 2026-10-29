import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildPhiRendererPlan} from '../gallery/visit/phi-full-engine-adapter.mjs';
import {planPhiReceptionWindow,receptionWindowWallParts} from '../gallery/visit/phi-reception-window.mjs';
const studies=Array.from({length:10},(_,i)=>({id:String(i),portrait:i%3===0,aspect:1.4}));
const p=buildPhiRendererPlan('__phi_reception__',studies);
const window=planPhiReceptionWindow(p.circulation.publicEntrance);
test('front window fits a foyer wall, clears the entrance and retains ground-level collision',()=>{
 const wall=p.physical.walls.find(w=>w.axis==='z'&&Math.abs(w.at-window.at)<.001&&w.lo<window.x-window.width/2&&w.hi>window.x+window.width/2);
 assert.ok(wall,'Window must fit wholly within a real wall');
 const door=p.circulation.publicEntrance;
 assert.ok(Math.abs(window.x-door.centre)>(window.width+door.width)/2+1);
 assert.ok(window.sill>.7&&window.sill+window.height<5.2);
 assert.equal(p.canWalk(window.x,window.at),false,'A visitor cannot walk through the window');
});
test('both wall layers can use an exact aperture without covering its centre',()=>{
 const wall=p.physical.walls.find(w=>w.axis==='z'&&w.at===window.at&&w.lo<window.x&&w.hi>window.x);
 const parts=receptionWindowWallParts(wall,window,5.2);
 assert.equal(parts.length,4);
 const area=parts.reduce((sum,q)=>sum+(q.hi-q.lo)*q.height,0);
 assert.ok(Math.abs(area-((wall.hi-wall.lo)*5.2-window.width*window.height))<1e-8);
 for(const y of [window.sill+.05,window.sill+window.height/2,window.sill+window.height-.05])
  assert.ok(!parts.some(q=>window.x>q.lo&&window.x<q.hi&&y>q.bottom&&y<q.bottom+q.height));
 const plain={axis:'x',at:window.at,lo:-5,hi:5};
 assert.deepEqual(receptionWindowWallParts(plain,window),[{lo:-5,hi:5,bottom:0,height:5.2}]);
 assert.deepEqual(receptionWindowWallParts(wall,null),[{lo:wall.lo,hi:wall.hi,bottom:0,height:5.2}]);
});
test('optimised scan retains attribution, photographic maps and a bounded mesh without a decoder dependency',()=>{
 const b=readFileSync(new URL('../gallery/visit/models/reception-church-window.glb',import.meta.url));
 assert.ok(b.length<1.2*1024*1024);assert.equal(b.readUInt32LE(8),b.length);
 const j=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());
 assert.match(j.asset.extras.author,/MWOgier/);assert.match(j.asset.extras.license,/CC-BY-4.0/);
 assert.equal(j.images.length,2);assert.ok(!j.extensionsRequired?.length);
 const tris=j.meshes.flatMap(m=>m.primitives).reduce((n,q)=>n+j.accessors[q.indices].count/3,0);
 assert.ok(tris<15000&&tris>1000);
 const positions=j.meshes.flatMap(m=>m.primitives).map(q=>j.accessors[q.attributes.POSITION]);
 assert.ok(Math.max(...positions.map(a=>a.max[1]))<=window.height+.0001);
 assert.ok(Math.min(...positions.map(a=>a.min[1]))>=-.0001);
});
