// PROPORTION PIECE — second backroom, two large split-screen monitors.
// Each displays the rightmost video of BOTH rows in its original monitor bank.
// Golden-section (1/φ) layout: two truly φ-aspect rectangular frames, one
// large and one small, in an asymmetric composition. The 384×240 videos are
// fitted inside their golden frames without cropping or distorting the art.
// Both original six-panel video atlases/textures remain the only decoders.
export const MONITOR_PHI=(1+Math.sqrt(5))/2;
export const MONITOR_INV_PHI=1/MONITOR_PHI;
const VIDEO_ASPECT=384/240;

export function planPhiGoldenScreenSplit(width,height){
 if(!(width>0&&height>0))return null;
 const margin=Math.min(.035,width*.025,height*.04),gutter=Math.max(.026,Math.min(.055,width*.024));
 const usableWidth=width-2*margin-gutter;
 if(usableWidth<=.2)return null;
 const leftColumn=usableWidth*MONITOR_INV_PHI;
 const rightColumn=usableWidth-leftColumn;
 const pane=(side,columnW)=>{
  // A golden rectangle is φ times as wide as high, and both fit the
  // monitor's usable bounds. Keep the underlying video in its native 8:5.
  const w=Math.min(columnW,(height-2*margin)*MONITOR_PHI);
  const h=w/MONITOR_PHI;
  const inset=Math.min(.018,w*.036);
  const videoWidth=Math.min(w-2*inset,(h-2*inset)*VIDEO_ASPECT);
  const videoHeight=videoWidth/VIDEO_ASPECT;
  const x=side===0
   ?-width/2+margin+leftColumn/2
   : width/2-margin-rightColumn/2;
  // Large golden frame sits at the top-left; smaller at bottom-right.
  const y=side===0 ?height/2-margin-h/2:-height/2+margin+h/2;
  return {x,y,width:w,height:h,videoWidth,videoHeight,sourcePanel:side===0?3:6};
 };
 return {ratio:MONITOR_PHI,split:MONITOR_INV_PHI,margin,gutter,
  panes:[pane(0,leftColumn),pane(1,rightColumn)]};
}

export function planPhiReceptionRearWallMonitors(wall){
 if(!wall?.fromPhysical||!Number.isFinite(wall.span)||wall.span<2.65)return null;
 const edge=.13,gap=.14,limitHeight=3.7;
 const screenWidth=Math.min((wall.span-2*edge-gap)/2,limitHeight*VIDEO_ASPECT);
 const screenHeight=screenWidth/VIDEO_ASPECT;
 if(screenWidth<.9)return null;
 return {...wall,screenWidth,screenHeight,gap,
  occupiedWidth:2*screenWidth+gap,
  coverage:(2*screenWidth+gap)/wall.span};
}

export function addPhiReceptionRearWallMonitors(THREE,scene,{wall,elevation,camera,sourceScreens}){
 const plan=planPhiReceptionRearWallMonitors(wall);
 if(!plan||sourceScreens?.length!==4||sourceScreens.some(s=>!s))return null;
 // Bank 1: panels 3 & 6. Bank 2: panels 3 & 6.
 const pairs=[[sourceScreens[0],sourceScreens[1]],[sourceScreens[2],sourceScreens[3]]];
 const composition=planPhiGoldenScreenSplit(plan.screenWidth-.034,plan.screenHeight-.034);
 if(!composition)return null;
 const root=new THREE.Group();
 root.name='phi-reception-two-large-rear-wall-monitors';
 root.userData.kind='phi-rear-wall-two-large-monitors';
 root.userData.sourcePanels=[3,6];
 root.userData.layout='simultaneous golden rectangles';
 root.position.set(plan.x,elevation+2.55,plan.z);
 root.rotation.y=plan.yaw;
 const bezelMaterial=new THREE.MeshStandardMaterial({color:0x181a1c,metalness:.34,roughness:.46});
 const matteMaterial=new THREE.MeshBasicMaterial({color:0x101819,toneMapped:false,side:THREE.DoubleSide});
 const trimMaterial=new THREE.MeshBasicMaterial({color:0xbca36c,toneMapped:false,side:THREE.DoubleSide});
 const videoFaces=[],ownedGeometry=[];
 pairs.forEach((pair,bankIndex)=>{
  const unit=new THREE.Group();unit.name='large-monitor-'+(bankIndex+1);
  unit.position.x=(bankIndex-.5)*(plan.screenWidth+plan.gap);
  const bezel=new THREE.Mesh(new THREE.BoxGeometry(plan.screenWidth,plan.screenHeight,.095),bezelMaterial);
  bezel.name='large-monitor-bezel';unit.add(bezel);ownedGeometry.push(bezel.geometry);
  const base=new THREE.Mesh(new THREE.PlaneGeometry(plan.screenWidth-.024,plan.screenHeight-.024),matteMaterial);
  base.name='golden-split-matte';base.position.z=.050;unit.add(base);ownedGeometry.push(base.geometry);
  composition.panes.forEach((pane,rowIndex)=>{
   const frame=new THREE.Mesh(new THREE.PlaneGeometry(pane.width,pane.height),trimMaterial);
   frame.position.set(pane.x,pane.y,.053);frame.name='golden-video-frame';
   unit.add(frame);ownedGeometry.push(frame.geometry);
   // Each source mesh has its own live UV crop (top-right or middle-right)
   // within the shared 3×2 WebM atlas. Borrow the original material and UVs.
   const face=new THREE.Mesh(new THREE.PlaneGeometry(pane.videoWidth,pane.videoHeight),pair[rowIndex].material);
   face.name='large-monitor-video-pane';
   face.position.set(pane.x,pane.y,.057);
   face.userData.sourceBank=bankIndex+1;
   face.userData.sourcePanel=pane.sourcePanel;
   face.userData.goldenRectangle={width:pane.width,height:pane.height};
   unit.add(face);ownedGeometry.push(face.geometry);
   videoFaces.push({face,source:pair[rowIndex]});
  });
  root.add(unit);
 });
 scene.add(root);
 const eye=new THREE.Vector3(),screenPosition=new THREE.Vector3();
 const isNearby=()=>camera.getWorldPosition(eye).distanceTo(root.getWorldPosition(screenPosition))<11;
 function sync(){
  for(const {face,source} of videoFaces){
   if(face.material!==source.material)face.material=source.material;
   const dest=face.geometry.getAttribute('uv'),original=source.geometry.getAttribute('uv');
   if(dest.count!==original.count)continue;
   let changed=false;
   for(let i=0;i<dest.count;i++){
    const x=original.getX(i),y=original.getY(i);
    if(dest.getX(i)!==x||dest.getY(i)!==y){dest.setXY(i,x,y);changed=true;}
   }
   if(changed)dest.needsUpdate=true;
  }
 }
 sync();
 let disposed=false,last=0,frameId=0;
 function tick(time){
  if(disposed)return;
  frameId=requestAnimationFrame(tick);
  if(time-last<125)return;
  last=time;
  // The original banks preload and play when this room is approached.
  // Refresh borrowed materials after their async switch to video textures.
  if(isNearby())sync();
 }
 frameId=requestAnimationFrame(tick);
 return {root,screenCount:2,videoPaneCount:4,isNearby,
  get diagnostics(){return {placed:!disposed,screenCount:2,videoPaneCount:4,
   sourcePanels:[3,6],sourceBanks:[1,2],layout:'simultaneous golden rectangles',
   ratio:composition.ratio,split:composition.split,
   paneSizes:composition.panes.map(p=>({width:p.width,height:p.height,
    sourcePanel:p.sourcePanel})),
   mount:plan,sharedVideoMaterials:videoFaces.map(p=>p.face.material===p.source.material)};},
  dispose(){
   if(disposed)return;
   disposed=true;cancelAnimationFrame(frameId);scene.remove(root);
   ownedGeometry.forEach(g=>g.dispose());
   bezelMaterial.dispose();matteMaterial.dispose();trimMaterial.dispose();
   // Borrowed video materials / video textures belong to the original banks.
  }
 };
}
