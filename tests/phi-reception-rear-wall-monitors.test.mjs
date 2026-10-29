import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildPhiRendererPlan} from '../gallery/visit/phi-full-engine-adapter.mjs';
import {planPhiReception} from '../gallery/visit/phi-reception-layout.mjs';
import {planPhiReceptionMonitorWall} from '../gallery/visit/phi-reception-living-monitor.mjs';
import {planPhiReceptionRearWallMonitors} from '../gallery/visit/phi-reception-rear-wall-monitors.mjs';

test('two large 16:10 screens occupy most of a solid back wall, with no second bank',()=>{
 const mount={fromPhysical:true,span:5.5,x:1,z:2,yaw:Math.PI,width:1,gap:.14};
 const p=planPhiReceptionRearWallMonitors(mount);
 assert.ok(p);assert.ok(p.coverage>.90);
 assert.equal(p.screenHeight/p.screenWidth,240/384);
 assert.ok(p.occupiedWidth<=p.span-.24);
 assert.equal(planPhiReceptionRearWallMonitors({...mount,fromPhysical:false}),null);
 assert.equal(planPhiReceptionRearWallMonitors({...mount,span:2}),null);
});

test('rear wall displays only original monitor-three animations through shared textures',async()=>{
 const source=await readFile(new URL('../gallery/visit/phi-reception-living-monitor.mjs',import.meta.url),'utf8');
 const rear=await readFile(new URL('../gallery/visit/phi-reception-rear-wall-monitors.mjs',import.meta.url),'utf8');
 assert.match(source,/thirdPanelScreen:screens\[2\]/);
 assert.match(source,/sourceScreens:\[first.thirdPanelScreen,second.thirdPanelScreen\]/);
 assert.match(source,/remoteVisitorNearby/);
 assert.match(rear,/source\.material/);
 assert.doesNotMatch(rear,/createTouchDesignerMonitorMedia|new THREE\.VideoTexture/);
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
