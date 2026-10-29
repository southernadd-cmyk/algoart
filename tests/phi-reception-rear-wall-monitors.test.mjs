import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildPhiRendererPlan} from '../gallery/visit/phi-full-engine-adapter.mjs';
import {planPhiReception} from '../gallery/visit/phi-reception-layout.mjs';
import {planPhiReceptionMonitorWall} from '../gallery/visit/phi-reception-living-monitor.mjs';
import {planPhiReceptionRearWallMonitors,planPhiGoldenScreenSplit,MONITOR_PHI,MONITOR_INV_PHI} from '../gallery/visit/phi-reception-rear-wall-monitors.mjs';

test('two large 16:10 screens occupy most of a solid back wall, with no second bank',()=>{
 const mount={fromPhysical:true,span:5.5,x:1,z:2,yaw:Math.PI,width:1,gap:.14};
 const p=planPhiReceptionRearWallMonitors(mount);
 assert.ok(p);assert.ok(p.coverage>.90);
 assert.equal(p.screenHeight/p.screenWidth,240/384);
 assert.ok(p.occupiedWidth<=p.span-.24);
 assert.equal(planPhiReceptionRearWallMonitors({...mount,fromPhysical:false}),null);
 assert.equal(planPhiReceptionRearWallMonitors({...mount,span:2}),null);
});

test('two φ-shaped panes fit in each screen and present uncropped 8:5 videos',()=>{
 const layout=planPhiGoldenScreenSplit(3.1,3.1/1.6);
 assert.ok(layout);
 assert.ok(Math.abs(layout.split-MONITOR_INV_PHI)<1e-12);
 assert.equal(layout.panes.length,2);
 for(const p of layout.panes){
  assert.ok(Math.abs(p.width/p.height-MONITOR_PHI)<1e-10);
  assert.ok(Math.abs(p.videoWidth/p.videoHeight-384/240)<1e-10);
  assert.ok(p.videoWidth<=p.width&&p.videoHeight<=p.height);
  assert.ok(Math.abs(p.x)+p.width/2<=3.1/2);
  assert.ok(Math.abs(p.y)+p.height/2<=3.1/1.6/2);
 }
 const [left,right]=layout.panes;
 assert.equal(left.sourcePanel,3);
 assert.equal(right.sourcePanel,6);
 assert.ok(left.width>right.width);
 assert.ok(left.x+left.width/2<right.x-right.width/2);
 assert.ok(left.y>right.y);
 assert.equal(planPhiGoldenScreenSplit(-1,2),null);
});

test('four simultaneous live video panes borrow both existing TouchDesigner atlases',async()=>{
 const source=await readFile(new URL('../gallery/visit/phi-reception-living-monitor.mjs',import.meta.url),'utf8');
 const rear=await readFile(new URL('../gallery/visit/phi-reception-rear-wall-monitors.mjs',import.meta.url),'utf8');
 assert.ok(source.includes('thirdPanelScreen:screens[2],sixthPanelScreen:screens[5]'));
 assert.ok(source.includes('first.thirdPanelScreen,first.sixthPanelScreen'));
 assert.ok(source.includes('second.thirdPanelScreen,second.sixthPanelScreen'));
 assert.ok(!source.includes('playbackLoops:['));
 assert.ok(source.includes('remoteVisitorNearby'));
 assert.ok(rear.includes('pairs=[[sourceScreens[0],sourceScreens[1]],[sourceScreens[2],sourceScreens[3]]]'));
 assert.ok(rear.includes('composition.panes.forEach'));
 assert.ok(rear.includes('pair[rowIndex].material'));
 assert.ok(rear.includes('videoPaneCount:4'));
 assert.ok(!rear.includes('selectPhiRearWallSource'));
 assert.ok(!rear.includes('new THREE.VideoTexture'));
 assert.ok(!rear.includes("createElement('video'"));
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
