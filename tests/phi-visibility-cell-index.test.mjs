import test from 'node:test';
import assert from 'node:assert/strict';
import {compilePhiVisibilityCells} from '../test/virtual-gallery/phi-visibility-cell-index.mjs';
import {phiRoomHiddenBehindSolidWalls,createPhiRoomVisibilityCuller}
 from '../test/virtual-gallery/phi-room-visibility-culler.mjs';

const left={x:-9,z:-3,w:6,h:6,room:0};
const right={x:7,z:-3,w:6,h:6,room:1};
const rooms=[{pieces:[left]},{pieces:[right]}],pieces=[left,right];
const closed=[{axis:'x',at:1,lo:-12,hi:12}];
const compile=(walls=closed)=>compilePhiVisibilityCells({
 pieces,rooms,walls,cellSize:2,now:()=>0
});

test('a single solid wall compiles reusable conservative visibility cells',()=>{
 const pvs=compile();
 assert.equal(pvs.enabled,true);
 assert.ok(pvs.cellCount>0);
 assert.ok(pvs.stats().safeHidden>0);
 assert.deepEqual(pvs.hiddenRooms({x:-5,z:0},0),[1]);
 assert.deepEqual(pvs.hiddenRooms({x:9,z:0},1),[0]);
 assert.equal(pvs.hiddenRooms({x:-9,z:-3},0),null); // uncertain cell edge
 assert.ok(pvs.stats().hits>=2);
});

test('for every compiled cell, the result is a subset of exact dynamic culling',()=>{
 const pvs=compile();
 for(const cell of pvs.cells)for(const u of [.01,.3,.65,.99])
  for(const v of [.01,.4,.7,.99]){
   const observer={x:cell.x0+(cell.x1-cell.x0)*u,
    z:cell.z0+(cell.z1-cell.z0)*v};
   const hidden=pvs.hiddenRooms(observer,cell.room);
   assert.ok(hidden!==null);
   for(const target of hidden)
    assert.equal(phiRoomHiddenBehindSolidWalls(observer,rooms[target].pieces,closed),true,
     'A compiled cell must never hide a room visible from any sampled position');
  }
});

test('a doorway or uncertain observer position cannot incorrectly hide a room',()=>{
 const doorway=[{axis:'x',at:1,lo:-12,hi:-.8},{axis:'x',at:1,lo:.8,hi:12}];
 const pvs=compile(doorway);
 assert.equal(pvs.enabled,true);
 assert.deepEqual(pvs.hiddenRooms({x:-5,z:0},0),[]);
 assert.equal(pvs.hiddenRooms({x:0,z:15},-1),null);
});

test('the opt-in compiled lookup preserves baseline object identity and restoration',()=>{
 const pvs=compile();
 const c=createPhiRoomVisibilityCuller({enabled:true,pieces,rooms,walls:closed,visibilityCells:pvs});
 const mesh={visible:true,userData:{},parent:{},geometry:{id:'original'},material:{id:'original'}};
 c.register(1,mesh);
 assert.equal(c.update({x:-5,z:0}).hidden,1);
 assert.equal(mesh.visible,false);
 c.update({x:9,z:0});
 assert.equal(mesh.visible,true);
 c.update({x:0,z:20},{safe:false});
 assert.equal(mesh.visible,true);
 assert.equal(mesh.geometry.id,'original');
 assert.equal(mesh.material.id,'original');
 c.clear();
 assert.equal(mesh.visible,true);
});

test('excessively detailed floor plans fall back instead of blocking startup',()=>{
 const pvs=compilePhiVisibilityCells({pieces,rooms,walls:closed,cellSize:.3,maxCells:3,now:()=>0});
 assert.equal(pvs.enabled,false);
 assert.equal(pvs.hiddenRooms({x:-5,z:0},0),null);
});
