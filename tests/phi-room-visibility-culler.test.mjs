import test from 'node:test';
import assert from 'node:assert/strict';
import {phiSolidWallCoversPiece,phiRoomHiddenBehindSolidWalls,
 createPhiRoomVisibilityCuller} from '../test/virtual-gallery/phi-room-visibility-culler.mjs';

const left={x:-8,z:-4,w:6,h:8,room:0},right={x:8,z:-4,w:6,h:8,room:1};
const fullWall={axis:'x',at:2,lo:-12,hi:12};
const leftPieces=[left],rightPieces=[right];

test('solid wall covering the complete view cone safely hides a distant room',()=>{
 assert.equal(phiSolidWallCoversPiece({x:-4,z:0},right,fullWall),true);
 assert.equal(phiRoomHiddenBehindSolidWalls({x:-4,z:0},rightPieces,[fullWall]),true);
});

test('doorway slit remains visible, even when its corners are blocked',()=>{
 const walls=[{axis:'x',at:2,lo:-12,hi:-1.2},{axis:'x',at:2,lo:1.2,hi:12}];
 assert.equal(phiRoomHiddenBehindSolidWalls({x:-4,z:0},rightPieces,walls),false);
});

test('partially blocking wall, near-wall uncertainty, same-side and grazing view never hide',()=>{
 assert.equal(phiRoomHiddenBehindSolidWalls({x:-4,z:0},rightPieces,
  [{axis:'x',at:2,lo:-1.1,hi:1.1}]),false);
 assert.equal(phiSolidWallCoversPiece({x:2.01,z:0},right,fullWall),false);
 assert.equal(phiSolidWallCoversPiece({x:10,z:0},right,fullWall),false);
 assert.equal(phiSolidWallCoversPiece({x:2,z:0},right,fullWall),false);
 assert.equal(phiSolidWallCoversPiece({x:-4,z:0},right,{...fullWall,hi:2}),false);
});

test('concave merged room: every individual convex piece must be occluded',()=>{
 const near={x:-7,z:4,w:3,h:4,room:1};
 assert.equal(phiRoomHiddenBehindSolidWalls({x:-4,z:0},[right,near],[fullWall]),false);
 const far={x:8,z:5,w:2,h:3,room:1};
 assert.equal(phiRoomHiddenBehindSolidWalls({x:-4,z:0},[right,far],[fullWall]),true);
});

test('visibility is reversible and never changes geometry, materials or transforms',()=>{
 const piece0={...left},piece1={...right};
 const c=createPhiRoomVisibilityCuller({
  enabled:true,pieces:[piece0,piece1],rooms:[{pieces:[piece0]},{pieces:[piece1]}],
  walls:[fullWall]});
 const a={visible:true,parent:{},userData:{},geometry:{id:1},material:{id:11},position:{x:10}};
 const b={visible:false,parent:{},userData:{},geometry:{id:2},material:{id:12}};
 const c0={visible:true,parent:{},userData:{},geometry:{id:3}};
 assert.equal(c.register(1,a),true);
 assert.equal(c.register(1,b),true);
 assert.equal(c.register(0,c0),true);
 let state=c.update({x:-4,z:0});
 assert.deepEqual(state.culledRooms,[1]);
 assert.equal(a.visible,false);assert.equal(b.visible,false);assert.equal(c0.visible,true);
 assert.equal(state.hidden,2);
 c.update({x:10,z:0});
 assert.equal(a.visible,true);assert.equal(b.visible,false);assert.equal(c0.visible,false);
 c.update({x:0,z:0},{safe:false});
 assert.equal(a.visible,true);assert.equal(b.visible,false);assert.equal(c0.visible,true);
 assert.equal(a.geometry.id,1);assert.equal(a.material.id,11);assert.equal(a.position.x,10);
 c.clear();
 assert.equal(c.snapshot().registered,0);
});

test('camera outside rooms or on a glass bridge restores all objects',()=>{
 const c=createPhiRoomVisibilityCuller({
  enabled:true,pieces:[left,right],rooms:[{pieces:[left]},{pieces:[right]}],walls:[fullWall]});
 const painting={visible:true,parent:{},userData:{}};c.register(1,painting);
 c.update({x:-4,z:0});assert.equal(painting.visible,false);
 c.update({x:0,z:20});assert.equal(painting.visible,true);
 assert.equal(c.snapshot().viewer,null);
});

test('disabled mode and cancelled arrival never hide paintings or sculptures',()=>{
 const c=createPhiRoomVisibilityCuller({
  enabled:false,pieces:[left,right],rooms:[{pieces:[left]},{pieces:[right]}],walls:[fullWall]});
 const sculpture={visible:true,parent:{},userData:{}};
 c.register(1,sculpture);
 c.update({x:-4,z:0});assert.equal(sculpture.visible,true);
 c.setEnabled(true);c.update({x:-4,z:0});assert.equal(sculpture.visible,false);
 c.update({x:-4,z:0},{safe:false});assert.equal(sculpture.visible,true);
 c.clear();assert.equal(c.snapshot().hidden,0);
});
