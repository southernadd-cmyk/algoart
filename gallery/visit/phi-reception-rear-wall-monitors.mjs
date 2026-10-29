// Two large, wall-filling presentations of MONITOR 3 from the original
// TouchDesigner installations. These share the two original videos/textures:
// never create two extra video players for the neighbouring room.

export function planPhiReceptionRearWallMonitors(wall){
 if(!wall?.fromPhysical||!Number.isFinite(wall.span)||wall.span<2.65)return null;
 // Use virtually the whole uninterrupted physical back wall. Keep panel
 // aspect ratio (384 x 240) to avoid stretched artwork.
 const edge=.13,gap=.14,limitHeight=3.7;
 const screenWidth=Math.min((wall.span-2*edge-gap)/2,limitHeight*384/240);
 const screenHeight=screenWidth*240/384;
 if(screenWidth<.9)return null;
 return {...wall,screenWidth,screenHeight,gap,
  occupiedWidth:2*screenWidth+gap,
  coverage:(2*screenWidth+gap)/wall.span};
}

export function addPhiReceptionRearWallMonitors(THREE,scene,{wall,elevation,camera,sourceScreens}){
 const plan=planPhiReceptionRearWallMonitors(wall);
 if(!plan||sourceScreens?.length!==2||sourceScreens.some(s=>!s))return null;
 const root=new THREE.Group();
 root.name='phi-reception-two-large-rear-wall-monitors';
 root.userData.kind='phi-rear-wall-two-large-monitors';
 root.userData.sourcePanel='third-panel-top-row';
 root.position.set(plan.x,elevation+2.55,plan.z);
 root.rotation.y=plan.yaw;
 const bezelMaterial=new THREE.MeshStandardMaterial({color:0x181a1c,metalness:.34,roughness:.46});
 const screens=[],frames=[];
 sourceScreens.forEach((source,i)=>{
  const unit=new THREE.Group();
  unit.name='large-monitor-'+(i+1);
  unit.position.x=(i-.5)*(plan.screenWidth+plan.gap);
  const bezel=new THREE.Mesh(new THREE.BoxGeometry(plan.screenWidth,plan.screenHeight,.095),bezelMaterial);
  bezel.name='large-monitor-bezel';unit.add(bezel);frames.push(bezel);
  const face=new THREE.Mesh(
   new THREE.PlaneGeometry(plan.screenWidth-.035,plan.screenHeight-.035),
   source.material // borrowed: one VideoTexture / decoder per original installation
  );
  face.name='large-monitor-screen';face.position.z=.052;
  face.userData.sourceBank=i+1;
  face.userData.sourcePanel=3;
  unit.add(face);screens.push(face);root.add(unit);
 });
 scene.add(root);
 const eye=new THREE.Vector3(),screenPosition=new THREE.Vector3();
 const isNearby=()=>camera.getWorldPosition(eye).distanceTo(root.getWorldPosition(screenPosition))<11;
 function sync(){
  screens.forEach((display,i)=>{
   const source=sourceScreens[i];
   if(display.material!==source.material)display.material=source.material;
   const dst=display.geometry.getAttribute('uv'),src=source.geometry.getAttribute('uv');
   if(dst.count!==src.count)return;
   let changed=false;
   for(let j=0;j<dst.count;j++){
    const x=src.getX(j),y=src.getY(j);
    if(dst.getX(j)!==x||dst.getY(j)!==y){dst.setXY(j,x,y);changed=true;}
   }
   if(changed)dst.needsUpdate=true;
  });
 }
 sync();
 let disposed=false,last=0,frameId=0;
 function tick(time){
  if(disposed)return;
  frameId=requestAnimationFrame(tick);
  if(time-last<125)return;
  last=time;
  // Keep the UV crop synchronised as the original bank switches from
  // static canvas fallback to its authentic six-screen WebM.
  if(isNearby())sync();
 }
 frameId=requestAnimationFrame(tick);
 return {root,screenCount:2,isNearby,
  get diagnostics(){return {placed:!disposed,screenCount:2,sourcePanel:3,
    sourceBanks:[1,2],mount:plan,largeScreens:screens.length,
    sharedVideoMaterials:screens.map((s,i)=>s.material===sourceScreens[i].material)};},
  dispose(){
   if(disposed)return;disposed=true;
   cancelAnimationFrame(frameId);scene.remove(root);
   screens.forEach(s=>s.geometry.dispose());frames.forEach(f=>f.geometry.dispose());
   bezelMaterial.dispose();
   // Materials/textures are owned by the original banks, never disposed here.
  }
 };
}
