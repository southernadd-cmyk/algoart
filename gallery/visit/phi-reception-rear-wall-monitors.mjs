// PROPORTION PIECE — second backroom, two large split-screen monitors.
// Each displays the rightmost video of BOTH rows in its original monitor bank.
// Golden-section (1/φ) layout: two borderless φ-aspect video panes, one
// large and one small, with seamlessly abutting recursive copies in the gaps.
// Source footage is center-cropped by <1.2% to fit each golden main pane.
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
  // Match each face to its entire golden rectangle. The source UVs are
  // center-cropped in sync(), not letterboxed or distorted.
  const w=Math.min(columnW,(height-2*margin)*MONITOR_PHI);
  const h=w/MONITOR_PHI;
  const videoWidth=w,videoHeight=h;
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


/**
 * Partition every unused part of the display with progressive φ subdivisions.
 * All tiles are calculated at mount time; this function never touches video
 * playback or creates any Three.js resources.
 */
export function planPhiRecursiveVideoFill(width,height,panes,{maxDepth=5,maxTiles=96,minSide=.13}={}){
 if(!(width>0&&height>0)||!Array.isArray(panes))return [];
 const rect=(x0,y0,x1,y1)=>({x0,y0,x1,y1});
 let unused=[rect(-width/2,-height/2,width/2,height/2)];
 for(const pane of panes){
  if(!pane||!(pane.width>0&&pane.height>0))return [];
  const cut=rect(pane.x-pane.width/2,pane.y-pane.height/2,
                 pane.x+pane.width/2,pane.y+pane.height/2);
  const remaining=[];
  for(const r of unused){
   const x0=Math.max(r.x0,cut.x0),y0=Math.max(r.y0,cut.y0);
   const x1=Math.min(r.x1,cut.x1),y1=Math.min(r.y1,cut.y1);
   if(x1<=x0||y1<=y0){remaining.push(r);continue;}
   if(y0>r.y0)remaining.push(rect(r.x0,r.y0,r.x1,y0));
   if(y1<r.y1)remaining.push(rect(r.x0,y1,r.x1,r.y1));
   if(x0>r.x0)remaining.push(rect(r.x0,y0,x0,y1));
   if(x1<r.x1)remaining.push(rect(x1,y0,r.x1,y1));
  }
  unused=remaining;
 }
 const tiles=[];
 const visit=(r,depth,reverse)=>{
  const w=r.x1-r.x0,h=r.y1-r.y0;
  if(w<=0||h<=0)return;
  // A bounded tessellation: split the longest edge at 1/φ and stop before
  // screen-space fragments turn into unnecessary geometry.
  if(depth>=maxDepth||Math.min(w,h)<minSide||tiles.length+2*(maxDepth-depth)>=maxTiles){
   tiles.push({x:(r.x0+r.x1)/2,y:(r.y0+r.y1)/2,width:w,height:h,depth});
   return;
  }
  if(w>=h){
   const split=r.x0+w*(reverse?1-MONITOR_INV_PHI:MONITOR_INV_PHI);
   visit(rect(r.x0,r.y0,split,r.y1),depth+1,!reverse);
   visit(rect(split,r.y0,r.x1,r.y1),depth+1,reverse);
  }else{
   const split=r.y0+h*(reverse?1-MONITOR_INV_PHI:MONITOR_INV_PHI);
   visit(rect(r.x0,r.y0,r.x1,split),depth+1,!reverse);
   visit(rect(r.x0,split,r.x1,r.y1),depth+1,reverse);
  }
 };
 unused.forEach((r,i)=>visit(r,0,i%2===1));
 return tiles;
}

// Fit a 384×240 panel into any rectangular tile without stretching, and stay
// half a source pixel inside its atlas cell to avoid neighbouring-panel bleed.
function coverPanelUV(original,aspect){
 let minU=Infinity,maxU=-Infinity,minV=Infinity,maxV=-Infinity;
 for(let j=0;j<original.count;j++){
  minU=Math.min(minU,original.getX(j));maxU=Math.max(maxU,original.getX(j));
  minV=Math.min(minV,original.getY(j));maxV=Math.max(maxV,original.getY(j));
 }
 if(!(maxU>minU&&maxV>minV))return null;
 const rangeU=maxU-minU,rangeV=maxV-minV;
 let u0=0,u1=1,v0=0,v1=1;
 if(aspect>VIDEO_ASPECT){const f=VIDEO_ASPECT/aspect;v0=(1-f)/2;v1=1-v0;}
 else {const f=aspect/VIDEO_ASPECT;u0=(1-f)/2;u1=1-u0;}
 // One half-pixel from a 384 × 240 panel, independent of atlas size.
 const edgeU=rangeU/(2*384),edgeV=rangeV/(2*240);
 const left=minU+u0*rangeU+edgeU,right=minU+u1*rangeU-edgeU;
 const bottom=minV+v0*rangeV+edgeV,top=minV+v1*rangeV-edgeV;
 return {minU,maxU,minV,maxV,left,right,bottom,top,key:[minU,maxU,minV,maxV].join(',')};
}

export function planPhiReceptionRearWallMonitors(wall){
 if(!wall?.fromPhysical||!Number.isFinite(wall.span)||wall.span<2.65)return null;
 // Give the pair room to breathe: around 45 cm of exposed wall on
 // either side and 26 cm between screens on a typical 5.5 m wall.
 // Scale the clearances on unusually narrow walls instead of removing them.
 const edge=Math.min(.45,wall.span*.085);
 const gap=Math.min(.26,wall.span*.052);
 const limitHeight=3.7;
 const screenWidth=Math.min((wall.span-2*edge-gap)/2,limitHeight*VIDEO_ASPECT);
 const screenHeight=screenWidth/VIDEO_ASPECT;
 if(screenWidth<.9)return null;
 const occupiedWidth=2*screenWidth+gap;
 return {...wall,screenWidth,screenHeight,gap,
  occupiedWidth,sideClearance:(wall.span-occupiedWidth)/2,
  coverage:occupiedWidth/wall.span};
}

export function addPhiReceptionRearWallMonitors(THREE,scene,{wall,elevation,camera,sourceScreens}){
 const plan=planPhiReceptionRearWallMonitors(wall);
 if(!plan||sourceScreens?.length!==4||sourceScreens.some(s=>!s))return null;
 // Bank 1: panels 3 & 6. Bank 2: panels 3 & 6.
 const pairs=[[sourceScreens[0],sourceScreens[1]],[sourceScreens[2],sourceScreens[3]]];
 const composition=planPhiGoldenScreenSplit(plan.screenWidth-.034,plan.screenHeight-.034);
 if(!composition)return null;
 const recursiveTiles=planPhiRecursiveVideoFill(plan.screenWidth-.034,plan.screenHeight-.034,composition.panes);
 const root=new THREE.Group();
 root.name='phi-reception-two-large-rear-wall-monitors';
 root.userData.kind='phi-rear-wall-two-large-monitors';
 root.userData.sourcePanels=[3,6];
 root.userData.layout='simultaneous golden rectangles and progressive video recursion';
 root.position.set(plan.x,elevation+2.55,plan.z);
 root.rotation.y=plan.yaw;
 const bezelMaterial=new THREE.MeshStandardMaterial({color:0x181a1c,metalness:.34,roughness:.46});
 const matteMaterial=new THREE.MeshBasicMaterial({color:0x101819,toneMapped:false,side:THREE.DoubleSide});
 const videoFaces=[],mosaics=[],ownedGeometry=[];
 pairs.forEach((pair,bankIndex)=>{
  const unit=new THREE.Group();unit.name='large-monitor-'+(bankIndex+1);
  unit.position.x=(bankIndex-.5)*(plan.screenWidth+plan.gap);
  const bezel=new THREE.Mesh(new THREE.BoxGeometry(plan.screenWidth,plan.screenHeight,.095),bezelMaterial);
  bezel.name='large-monitor-bezel';unit.add(bezel);ownedGeometry.push(bezel.geometry);
  const base=new THREE.Mesh(new THREE.PlaneGeometry(plan.screenWidth-.024,plan.screenHeight-.024),matteMaterial);
  base.name='golden-split-matte';base.position.z=.050;unit.add(base);ownedGeometry.push(base.geometry);

  // One batched mesh per display for every small video copy. The source is
  // panel 6 of the same existing atlas, so this adds NO decoder or texture.
  const positions=[];
  for(const tile of recursiveTiles){
   // Slight overscan prevents subpixel cracks from exposing the dark matte
   // when antialiasing rounds neighbouring triangle edges differently.
   const bleed=.001;
   const x0=tile.x-tile.width/2-bleed,x1=tile.x+tile.width/2+bleed;
   const y0=tile.y-tile.height/2-bleed,y1=tile.y+tile.height/2+bleed;
   // Two front-facing triangles (top-left, bottom-left, top-right, etc).
   positions.push(x0,y1,0,x0,y0,0,x1,y1,0,
                  x0,y0,0,x1,y0,0,x1,y1,0);
  }
  const mosaicGeometry=new THREE.BufferGeometry();
  mosaicGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  mosaicGeometry.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(recursiveTiles.length*12),2));
  const mosaic=new THREE.Mesh(mosaicGeometry,pair[1].material);
  mosaic.name='recursive-smallest-video-mosaic';
  mosaic.position.z=.052; // Behind both full-bleed main videos; in front of matte.
  mosaic.userData.sourcePanel=6;
  mosaic.userData.tileCount=recursiveTiles.length;
  unit.add(mosaic);ownedGeometry.push(mosaicGeometry);
  mosaics.push({face:mosaic,source:pair[1],uvKey:''});
  composition.panes.forEach((pane,rowIndex)=>{
   // Full-bleed golden video plane: no coloured frame, letterbox or inset.
   // Each source mesh has its live UV crop within the shared 3×2 atlas.
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
  for(const entry of videoFaces){
   const {face,source}=entry;
   if(face.material!==source.material)face.material=source.material;
   const dest=face.geometry.getAttribute('uv'),original=source.geometry.getAttribute('uv');
   if(dest.count!==original.count)continue;
   // Playback changes pixels, not atlas coordinates. Recalculate the exact
   // same crop only when the source attribute is replaced or updated.
   if(entry.uvSource===original&&entry.uvVersion===original.version)continue;
   const targetAspect=face.geometry.parameters.width/face.geometry.parameters.height;
   const bounds=coverPanelUV(original,targetAspect);
   if(!bounds)continue;
   entry.uvSource=original;entry.uvVersion=original.version;
   let changed=false;
   for(let i=0;i<dest.count;i++){
    const u=(original.getX(i)-bounds.minU)/(bounds.maxU-bounds.minU);
    const v=(original.getY(i)-bounds.minV)/(bounds.maxV-bounds.minV);
    const x=bounds.left+(bounds.right-bounds.left)*u;
    const y=bounds.bottom+(bounds.top-bounds.bottom)*v;
    if(Math.abs(dest.getX(i)-x)>1e-7||Math.abs(dest.getY(i)-y)>1e-7){dest.setXY(i,x,y);changed=true;}
   }
   if(changed)dest.needsUpdate=true;
  }

  // Source UV coordinates change once the asynchronously loaded video atlas
  // replaces the fallback canvas. Only rewrite the merged geometry at that
  // transition: never upload 68 sets of UVs every animation frame.
  for(const mosaic of mosaics){
   const {face,source}=mosaic;
   if(face.material!==source.material)face.material=source.material;
   const sourceUV=source.geometry.getAttribute('uv');
   if(!sourceUV||sourceUV.count<4)continue;
   const initial=coverPanelUV(sourceUV,VIDEO_ASPECT);
   if(!initial||initial.key===mosaic.uvKey)continue;
   mosaic.uvKey=initial.key;
   const dest=face.geometry.getAttribute('uv');
   for(let i=0;i<recursiveTiles.length;i++){
    const tile=recursiveTiles[i],aspect=tile.width/tile.height;
    // Each repeat fills its tile without aspect distortion or atlas bleed.
    const {left,right,bottom,top}=coverPanelUV(sourceUV,aspect);
    const j=i*6;
    dest.setXY(j,left,top);dest.setXY(j+1,left,bottom);
    dest.setXY(j+2,right,top);dest.setXY(j+3,left,bottom);
    dest.setXY(j+4,right,bottom);dest.setXY(j+5,right,top);
   }
   dest.needsUpdate=true;
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
 return {root,screenCount:2,videoPaneCount:4,recursiveTilesPerScreen:recursiveTiles.length,isNearby,
  get diagnostics(){return {placed:!disposed,screenCount:2,videoPaneCount:4,
   sourcePanels:[3,6],sourceBanks:[1,2],layout:'progressive golden video recursion',
   recursiveTilesPerScreen:recursiveTiles.length,recursiveVideoTiles:2*recursiveTiles.length,
   recursiveMeshCount:mosaics.length,recursiveSourcePanel:6,
   seamlessTiles:true,visibleVideoBorders:false,
   ratio:composition.ratio,split:composition.split,
   paneSizes:composition.panes.map(p=>({width:p.width,height:p.height,
    sourcePanel:p.sourcePanel})),
   mount:plan,sharedVideoMaterials:videoFaces.map(p=>p.face.material===p.source.material),
   sharedRecursiveMaterials:mosaics.map(p=>p.face.material===p.source.material)};},
  dispose(){
   if(disposed)return;
   disposed=true;cancelAnimationFrame(frameId);scene.remove(root);
   ownedGeometry.forEach(g=>g.dispose());
   bezelMaterial.dispose();matteMaterial.dispose();
   // Borrowed video materials / video textures belong to the original banks.
  }
 };
}

