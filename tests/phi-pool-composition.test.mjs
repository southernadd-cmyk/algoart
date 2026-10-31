import test from 'node:test';
import assert from 'node:assert/strict';
import {PHI,POOL_COMPOSITION as pool,planPoolSculptures} from '../gallery/visit/phi-pool-composition.mjs';
function overlaps(a,b,clearance=.35){
 const axes=[a.yaw,b.yaw].flatMap(t=>[[Math.cos(t),-Math.sin(t)],[Math.sin(t),Math.cos(t)]]);
 const corners=o=>[-1,1].flatMap(x=>[-1,1].map(z=>({x:o.x+x*o.width/2*Math.cos(o.yaw)+z*o.depth/2*Math.sin(o.yaw),z:o.z-x*o.width/2*Math.sin(o.yaw)+z*o.depth/2*Math.cos(o.yaw)})));
 return axes.every(([x,z])=>{const p=corners(a).map(v=>v.x*x+v.z*z),q=corners(b).map(v=>v.x*x+v.z*z);return Math.max(...p)+clearance>Math.min(...q)&&Math.max(...q)+clearance>Math.min(...p);});
}
test('pool anchors exact phi radii, golden-angle separation and pool-facing orientations',()=>{
 for(const outward of [{x:0,z:1},{x:0,z:-1},{x:1,z:0},{x:-1,z:0}]){
  const placements=planPoolSculptures({doorway:{x:4,z:-9},outward});
  assert.ok(Math.abs(placements[1].radius/placements[0].radius-PHI)<1e-12);
  assert.ok(Math.abs(placements[1].angle-placements[0].angle-Math.PI*(3-Math.sqrt(5)))<1e-12);
  for(const p of placements){assert.ok(Math.abs(Math.hypot(p.local.x-pool.x,p.local.z-pool.z)-p.radius)<1e-10);}
 }
});
test('full sculpture footprints clear pool, entrance corridor, seating and existing square monuments',()=>{
 const placements=planPoolSculptures({doorway:{x:0,z:0},outward:{x:0,z:1}}).map(p=>({...p,width:5.45,depth:1.9}));
 const obstacles=[{x:pool.x,z:pool.z,width:7.9,depth:5.05,yaw:0},{x:0,z:18,width:3.2,depth:36,yaw:0}];
 for(const x of [-13.8,13.8])for(const z of [8,21])obstacles.push({x,z,width:3.2,depth:3.2/PHI,yaw:0});
 for(const x of [-20,20])for(const z of [10,24])obstacles.push({x,z,width:3.1,depth:1.1,yaw:0});
 for(let i=0;i<7;i++){const theta=-.8+i*.73,r=6*PHI**(theta/(Math.PI/2)+.7),wall=i>=3;obstacles.push({x:3+r*Math.cos(theta),z:18+r*Math.sin(theta),yaw:Math.PI/2-theta,width:wall?5.2:1.8,depth:wall?.34:1.4});}
 for(const p of placements)for(const o of obstacles)assert.equal(overlaps(p,o),false,JSON.stringify({p,o}));
 assert.equal(overlaps(...placements),false);
});
