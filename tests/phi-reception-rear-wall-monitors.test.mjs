import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildPhiRendererPlan} from '../gallery/visit/phi-full-engine-adapter.mjs';
import {planPhiReception} from '../gallery/visit/phi-reception-layout.mjs';
import {planPhiReceptionMonitorWall} from '../gallery/visit/phi-reception-living-monitor.mjs';
import {planPhiReceptionRearWallMonitors,planPhiGoldenScreenSplit,planPhiRecursiveVideoFill,MONITOR_PHI,MONITOR_INV_PHI} from '../gallery/visit/phi-reception-rear-wall-monitors.mjs';

test('two large 16:10 screens occupy most of a solid back wall, with no second bank',()=>{
 const mount={fromPhysical:true,span:5.5,x:1,z:2,yaw:Math.PI,width:1,gap:.14};
 const p=planPhiReceptionRearWallMonitors(mount);
 assert.ok(p);assert.ok(p.coverage>.90);
 assert.ok(Math.abs(p.screenHeight/p.screenWidth-240/384)<1e-10);
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


test('progressive φ regressions cover unused screen area without colliding with the two large videos',()=>{
 const width=3.1,height=width/1.6;
 const panes=planPhiGoldenScreenSplit(width,height).panes;
 const small=planPhiRecursiveVideoFill(width,height,panes);
 assert.ok(small.length>=40,'should create many progressively smaller copies');
 assert.ok(small.length<=96,'cap the geometry and UV update cost');
 assert.ok(new Set(small.map(p=>p.depth)).size>=3,'multiple regression sizes');
 const overlap=(a,b)=>{
  return Math.min(a.x+a.width/2,b.x+b.width/2)-
   Math.max(a.x-a.width/2,b.x-b.width/2)>1e-8 &&
   Math.min(a.y+a.height/2,b.y+b.height/2)-
   Math.max(a.y-a.height/2,b.y-b.height/2)>1e-8;
 };
 for(let i=0;i<small.length;i++){
  const rect=small[i];
  assert.ok(rect.width>0&&rect.height>0);
  assert.ok(Math.abs(rect.x)+rect.width/2<=width/2+1e-8);
  assert.ok(Math.abs(rect.y)+rect.height/2<=height/2+1e-8);
  for(const pane of panes)assert.equal(overlap(rect,pane),false,'main art must remain unobscured');
  for(let j=0;j<i;j++)assert.equal(overlap(rect,small[j]),false,'video tiles must not overlap');
 }
 const freeArea=width*height-panes.reduce((area,p)=>area+p.width*p.height,0);
 const filledArea=small.reduce((area,p)=>area+p.width*p.height,0);
 assert.ok(Math.abs(filledArea-freeArea)<1e-8,'every free rectangular gap is covered');
 assert.deepEqual(planPhiRecursiveVideoFill(-1,1,panes),[]);
});

test('repeated video panels are batched into two meshes and reuse panel six texture',async()=>{
 const src=await readFile(new URL('../gallery/visit/phi-reception-rear-wall-monitors.mjs',import.meta.url),'utf8');
 assert.match(src,/recursive-smallest-video-mosaic/);
 assert.match(src,/new THREE.BufferGeometry\(\)/);
 assert.match(src,/new THREE.Float32BufferAttribute\(positions,3\)/);
 assert.match(src,/mosaic\.userData\.sourcePanel=6/);
 assert.match(src,/new THREE.Mesh\(mosaicGeometry,pair\[1\]\.material\)/);
 assert.match(src,/mosaics\.push\(\{face:mosaic,source:pair\[1\]/);
 assert.match(src,/if\(key===mosaic\.uvKey\)continue/);
 assert.ok(!src.includes("new THREE.VideoTexture"));
 assert.ok(!src.includes("createElement('video'"));
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
