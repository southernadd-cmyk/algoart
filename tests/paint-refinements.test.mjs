import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const sandbox={window:{AlgoArt:{}}},A=sandbox.window.AlgoArt;
const load=path=>vm.runInNewContext(readFileSync(path,'utf8'),sandbox);
load('js/action-painting-v4.js');
const pour=A.actionPaintingV4Test.structuralPour;
const plain=v=>JSON.parse(JSON.stringify(v));
// The previous floor((n-1)/phi) midpoint was the start for a two-point line.
for(const [a,b] of [[{x:0,y:0},{x:1000,y:0}],[{x:20,y:10},{x:20,y:1010}],[{x:900,y:20},{x:20,y:700}]]){
 const p=pour([a,b]);assert(p.straight);assert.equal(p.a,a);assert.equal(p.b,b);
 assert(Math.abs(Math.hypot(p.via.x-a.x,p.via.y-a.y)/Math.hypot(b.x-a.x,b.y-a.y)-.61803398875)<1e-10);
}
const sampled=pour([{x:0,y:0},{x:10,y:0},{x:1000,y:0}]);
assert(Math.abs(sampled.via.x-618.03398875)<1e-7,'Golden point follows arc distance rather than sample index');
assert(!pour([{x:0,y:0},{x:500,y:400},{x:1000,y:0}]).straight,'Retain already curved source gestures');
assert(!pour([{x:0,y:0},{x:1000,y:0},{x:0,y:0}]).straight,'Closed source paths are not forced into a bow');
assert(!pour([{x:0,y:0},{x:10,y:0}]).straight,'Short marks retain existing treatment');
// V6 restores its opt-in on normal and exceptional exits, including nesting.
A.renderOilPaintV5=()=>{assert.equal(A.oilOpaqueConnections,true);return {version:'oil-paint-v5',work:{contact:12}}};
load('js/oil-paint-v6.js');
assert.deepEqual(plain(A.renderOilPaintV6({},{})),{version:'oil-paint-v6',work:{contact:12}});
assert(!Object.hasOwn(A,'oilOpaqueConnections'));
A.oilOpaqueConnections='prior';A.renderOilPaintV6({},{});assert.equal(A.oilOpaqueConnections,'prior');
A.renderOilPaintV5=()=>{throw Error('paint failure')};
assert.throws(()=>A.renderOilPaintV6({},{}),/paint failure/);assert.equal(A.oilOpaqueConnections,'prior');
delete A.oilOpaqueConnections;
assert.throws(()=>A.renderOilPaintV6({},{}),/paint failure/);assert(!Object.hasOwn(A,'oilOpaqueConnections'));
console.log('PASS two-point and sampled structural pours; existing curves; V6 coverage scope on success and failure.');
