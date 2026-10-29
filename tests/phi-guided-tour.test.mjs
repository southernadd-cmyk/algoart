import test from 'node:test';
import assert from 'node:assert/strict';
import {clearTourLine,findTourPath,tourWorldBounds} from '../test/virtual-gallery/guided-tour.mjs';

test('route walks through a door rather than through a separating wall',()=>{
 const root={x:0,z:0,w:10,h:8};
 const safe=(x,z)=>x>.4&&x<9.6&&z>.4&&z<7.6&&
   !(Math.abs(x-5)<.43&&(z<3.0||z>5.0));
 const start={x:1,z:1},end={x:9,z:1};
 assert.equal(clearTourLine(start,end,safe),false);
 const path=findTourPath(start,end,safe,root);
 assert.ok(path&&path.length>2,'should find a route around the solid wall sections');
 for(let i=1;i<path.length;i++)assert.ok(clearTourLine(path[i-1],path[i],safe), 'no leg crosses a wall');
 assert.ok(path.some(p=>p.z>3&&p.z<5),'route goes through the available door');
});
test('unreachable artworks are excluded safely',()=>{
 const root={x:0,z:0,w:10,h:8};
 const safe=(x,z)=>x>.4&&x<9.6&&z>.4&&z<7.6&&Math.abs(x-5)>.43;
 assert.equal(findTourPath({x:1,z:1},{x:9,z:1},safe,root),null);
});
test('golden-angle floor bounds are calculated in rotated world coordinates',()=>{
 const phi={floor:{root:{x:-8,z:-3,w:16,h:6}},world:{toWorld:(x,z)=>({x:-z+2,z:x+5})}};
 assert.deepEqual(tourWorldBounds(phi),{x:-3,z:-3,w:6,h:16});
});
