import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildPhiRendererPlan} from '../gallery/visit/phi-full-engine-adapter.mjs';
import {planPhiReception} from '../gallery/visit/phi-reception-layout.mjs';
import {planPhiReceptionMonitorWall} from '../gallery/visit/phi-reception-living-monitor.mjs';
import {planPhiReceptionRearWallMonitors,selectPhiRearWallSource} from '../gallery/visit/phi-reception-rear-wall-monitors.mjs';
import {hasTouchDesignerVideoLooped} from '../gallery/visit/phi-touchdesigner-media.mjs';

test('two large 16:10 screens occupy most of a solid back wall, with no second bank',()=>{
 const mount={fromPhysical:true,span:5.5,x:1,z:2,yaw:Math.PI,width:1,gap:.14};
 const p=planPhiReceptionRearWallMonitors(mount);
 assert.ok(p);assert.ok(p.coverage>.90);
 assert.equal(p.screenHeight/p.screenWidth,240/384);
 assert.ok(p.occupiedWidth<=p.span-.24);
 assert.equal(planPhiReceptionRearWallMonitors({...mount,fromPhysical:false}),null);
 assert.equal(planPhiReceptionRearWallMonitors({...mount,span:2}),null);
});

test('four rightmost animations cycle across two large screens via existing atlas playback',async()=>{
 const source=await readFile(new URL('../gallery/visit/phi-reception-living-monitor.mjs',import.meta.url),'utf8');
 const rear=await readFile(new URL('../gallery/visit/phi-reception-rear-wall-monitors.mjs',import.meta.url),'utf8');
 assert.match(source,/thirdPanelScreen:screens\\[2\\],sixthPanelScreen:screens\\[5\\]/);
 assert.match(source,/first.thirdPanelScreen,first.sixthPanelScreen/);
 assert.match(source,/second.thirdPanelScreen,second.sixthPanelScreen/);
 assert.match(source,/playbackLoops:/);
 assert.match(source,/remoteVisitorNearby/);
 assert.match(rear,/pairs=\\[\\[sourceScreens\\[0\\],sourceScreens\\[1\\]\\],\\[sourceScreens\\[2\\],sourceScreens\\[3\\]\\]\\]/);
 assert.match(rear,/selectedSource/);
 assert.doesNotMatch(rear,/createTouchDesignerMonitorMedia|new THREE\\.VideoTexture|createElement\\(['"]video/);
});
test('two films in each bank alternate only at full video loop boundaries',()=>{
 assert.deepEqual(Array.from({length:6},(_,i)=>selectPhiRearWallSource(i)),[0,1,0,1,0,1]);
 assert.equal(hasTouchDesignerVideoLooped(19.96,0.04),true);
 assert.equal(hasTouchDesignerVideoLooped(8.8,8.7),false);
 assert.equal(hasTouchDesignerVideoLooped(12.0,12.1),false);
 assert.equal(hasTouchDesignerVideoLooped(NaN,0),false);
 assert.equal(selectPhiRearWallSource(NaN),0);
});

test('second room is distinct from existing monitor wall in the reception plan',()=>{
 globalThis.__phiReceptionTestRefresh=true;
 try{
  const p=buildPhiRendererPlan('__phi_reception__',
   Array.from({length:10},(_,i)=>({id:String(i),portrait:false,aspect:1.4})));
  const furnishing=planPhiReception(p.floor,p.circulation,p.physical);
  const first=furnishing.backrooms[0];
  const others=furnishing.backrooms.filter(room=>room!==first &&
   Math.hypot(room.x-first.x,room.z-first.z)>
    Math.max(2.2,Math.min(room.width,room.depth)));
  const suitable=others.map(room=>planPhiReceptionMonitorWall(room,furnishing.lift,p.physical.walls))
   .map(planPhiReceptionRearWallMonitors).filter(Boolean);
  assert.ok(suitable.length>0,'Reception should provide another backroom with a solid full wall');
 }finally{delete globalThis.__phiReceptionTestRefresh;}
});
