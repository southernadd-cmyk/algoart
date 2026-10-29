import {createTouchDesignerMonitorMedia,TOUCHDESIGNER_SIX_SCREEN_MANIFEST} from './phi-touchdesigner-media.mjs';
import {addTouchDesignerInfoRow} from './phi-touchdesigner-info-row.mjs';
import {addPhiReceptionRearWallMonitors} from './phi-reception-rear-wall-monitors.mjs';

// Two three-monitor rows on the reception backroom's real wall, also used live.
// Coordinates stay in the untransformed phi layout; the gallery transforms
// all newly created scene children after constructing the floor.

export function planPhiReceptionMonitorWall(room, lift, physicalWalls=[]) {
 if(!room || !Number.isFinite(room.width) || !Number.isFinite(room.depth))return null;
 const {x,z,width,depth}=room;
 const sides=[
  {axis:'z',at:z-depth/2,lo:x-width/2,hi:x+width/2,normal:{x:0,z:1},yaw:0},
  {axis:'z',at:z+depth/2,lo:x-width/2,hi:x+width/2,normal:{x:0,z:-1},yaw:Math.PI},
  {axis:'x',at:x-width/2,lo:z-depth/2,hi:z+depth/2,normal:{x:1,z:0},yaw:Math.PI/2},
  {axis:'x',at:x+width/2,lo:z-depth/2,hi:z+depth/2,normal:{x:-1,z:0},yaw:-Math.PI/2}
 ];
 const walls=[];
 for(const side of sides)for(const segment of physicalWalls){
  if(segment.axis!==side.axis || Math.abs(segment.at-side.at)>.26)continue;
  const lo=Math.max(side.lo,segment.lo),hi=Math.min(side.hi,segment.hi);
  if(hi-lo<2.35)continue;
  walls.push({...side,lo,hi,fromPhysical:true});
 }
 // On an unexpected floor plan, still show the installation. Room boundary
 // fallback is preferable to silently creating no screens.
 if(!walls.length)walls.push(...sides.filter(s=>s.hi-s.lo>=2.35).map(s=>({...s,fromPhysical:false})));
 if(!walls.length)return null;
 const dx=(lift?.x??x)-x,dz=(lift?.z??z)-z;
 const length=Math.hypot(dx,dz)||1;
 for(const wall of walls){
  wall.facing=(wall.normal.x*dx+wall.normal.z*dz)/length;
  wall.length=wall.hi-wall.lo;
 }
 // Back wall faces the lift: choose the wall whose INWARD normal points
 // towards the lift, then prefer longer uninterrupted wall segments.
 walls.sort((a,b)=>b.facing-a.facing||b.length-a.length);
 const wall=walls[0],centre=(wall.lo+wall.hi)/2;
 const clearance=.19; // In front of the wall's solid geometry.
 return {
  axis:wall.axis,normal:wall.normal,yaw:wall.yaw,
  x:wall.axis==='z'?centre:wall.at+wall.normal.x*clearance,
  z:wall.axis==='x'?centre:wall.at+wall.normal.z*clearance,
  width:Math.min(1.23,(wall.length-.54-.28)/3),
  gap:.14,span:wall.length,fromPhysical:wall.fromPhysical,
  facing:wall.facing
 };
}

// Keep both banks on the proven solid wall, with a clear central gap.
export function planPhiReceptionMonitorBanks(room,lift,physicalWalls=[]){
 const wall=planPhiReceptionMonitorWall(room,lift,physicalWalls);if(!wall)return [];
 const bankGap=.38,width=Math.min(wall.width,(wall.span-.54-bankGap-4*wall.gap)/6);
 const bankWidth=3*width+2*wall.gap,offset=(bankWidth+bankGap)/2;
 return [-1,1].map(side=>({...wall,width,
  x:wall.x+Math.cos(wall.yaw)*side*offset,
  z:wall.z-Math.sin(wall.yaw)*side*offset}));
}
export function addPhiReceptionLivingMonitor(THREE,scene,options){
 const mounts=planPhiReceptionMonitorBanks(options.room,options.lift,options.physicalWalls);
 if(!mounts.length)return null;
 // Two oversized displays each show BOTH third-column films simultaneously
 // inside φ-proportioned rectangles, reusing existing video atlas textures.
 let rearWall=null;
 const remoteVisitorNearby=()=>rearWall?.isNearby()===true;
 const first=addMonitorBank(THREE,scene,{...options,mount:mounts[0],remoteVisitorNearby});
 const second=addMonitorBank(THREE,scene,{...options,mount:mounts[1],bankId:2,remoteVisitorNearby,
  manifestURL:new URL('./touchdesigner/bank-two/six-screen.json',import.meta.url),
  previewURL:new URL('./touchdesigner/td-network-loop.webp',import.meta.url),
  infoPreviewURL:new URL('./touchdesigner/phi-net-model.webm',import.meta.url),
  projectURL:new URL('./touchdesigner/phi_net.toe?v=2a047229344c7566',import.meta.url)});
 if(!first||!second){first?.dispose();second?.dispose();return null;}
 const rearRoom=options.rearRoom;
 if(rearRoom){
  const rearMount=planPhiReceptionMonitorWall(rearRoom,options.lift,options.physicalWalls);
  rearWall=addPhiReceptionRearWallMonitors(THREE,scene,{
   wall:rearMount,elevation:options.elevation,camera:options.camera,
   sourceScreens:[first.thirdPanelScreen,first.sixthPanelScreen,
                  second.thirdPanelScreen,second.sixthPanelScreen]
  });
 }
 const disposeFirst=first.dispose;
 first.bankCount=2;first.totalScreenCount=first.screenCount+second.screenCount+(rearWall?.screenCount||0);
 first.largeScreenCount=rearWall?.screenCount||0;
 first.banks=[first.root,second.root];
 Object.defineProperty(first,'rearWallDiagnostics',{get:()=>rearWall?.diagnostics||null});
 Object.defineProperty(first,'secondBankDiagnostics',{get:()=>({mount:second.mount,screenCount:second.screenCount,media:second.mediaDiagnostics,info:second.infoDiagnostics})});
 first.dispose=()=>{rearWall?.dispose();disposeFirst();second.dispose();};return first;
}
function addMonitorBank(THREE,scene,{room,lift,physicalWalls=[],elevation,camera,mount,bankId=1,manifestURL=TOUCHDESIGNER_SIX_SCREEN_MANIFEST,previewURL=null,infoPreviewURL,projectURL,remoteVisitorNearby}){
 // phi.world is deliberately NOT required here: it is assigned only after
 // constructPhiGallery returns. Requiring it silently removed every monitor.
 const wall=mount||planPhiReceptionMonitorWall(room,lift,physicalWalls);
 if(!wall)return null;
 const root=new THREE.Group();
 root.name=bankId===1?'phi-reception-three-living-monitors':'phi-reception-monitor-bank-two';
 root.userData.bankId=bankId;
 root.userData.kind='reception-nine-living-monitors';
 root.userData.mount={...wall};
 // Raise the stacked display to fit three full rows within the 5.2m room.
 // The lower information row then stays well clear of the floor.
 root.position.set(wall.x,elevation+2.95,wall.z);
 root.rotation.y=wall.yaw;

 const bezelMaterial=new THREE.MeshStandardMaterial({color:0x181a1c,metalness:.32,roughness:.48});
 const lampMaterial=new THREE.MeshBasicMaterial({color:0x66c59d,toneMapped:false});
 const textures=[],screenMaterials=[],canvases=[],screens=[];
 const width=wall.width,height=width*0.66;
 // Leave the approved original top row at exactly the same position.
 // Add a second row underneath; at typical sizes its bottom edge is
 // about 0.7 m above the floor, with clear space between the bezels.
 const rowPitch=height+.17;
 for(let screenIndex=0;screenIndex<6;screenIndex++){
  const row=Math.floor(screenIndex/3),column=screenIndex%3;
  const unit=new THREE.Group();
  unit.position.x=(column-1)*(width+wall.gap);
  unit.position.y=-row*rowPitch;
  unit.name='living-monitor-'+(screenIndex+1);
  const frame=new THREE.Mesh(new THREE.BoxGeometry(width,height,.075),bezelMaterial);
  frame.name='monitor-bezel';
  unit.add(frame);
  const canvas=document.createElement('canvas');
  canvas.width=384;canvas.height=240;
  const ctx=canvas.getContext('2d',{alpha:false});
  if(!ctx)return null;
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  const displayMaterial=new THREE.MeshBasicMaterial({map:texture,toneMapped:false,side:THREE.DoubleSide});
  const display=new THREE.Mesh(new THREE.PlaneGeometry(width-.065,height-.067),displayMaterial);
  display.position.z=.041;
  display.name='monitor-screen';
  unit.add(display);screens.push(display);
  const indicator=new THREE.Mesh(new THREE.BoxGeometry(.024,.012,.006),lampMaterial);
  indicator.position.set(width/2-.047,-height/2+.014,.042);unit.add(indicator);
  root.add(unit);
  canvases.push(ctx);textures.push(texture);screenMaterials.push(displayMaterial);
 }
 // Third row documents the authoring process and exposes the editable project.
 const infoRow=addTouchDesignerInfoRow(THREE,{root,width,height,gap:wall.gap,rowPitch,camera,
  previewURL:infoPreviewURL,projectURL,showNetworkPreview:false,
  // Same "What is TouchDesigner?" information panel on both banks.
  // Only these two "HERE" lines describe the bank-specific network.
  hereLines:bankId===2?[
   'HERE: SCAN → RAISED PHI NET',
   'GOLDEN ANGLE · 1/φ STEPS · 2 VIEWS'
  ]:null});
 scene.add(root);
 // One 1152x480 atlas preserves both triptychs with one player and texture.
 const media=createTouchDesignerMonitorMedia(THREE,{
  screens,manifestURL,followActiveIndex:false
 });

 // Show the actual, reproducible study on monitor one even before an
 // authentic TouchDesigner export is available. Load only when approached.
 const sourceImageURL=previewURL||new URL('../2026-10-27/2026-10-27-oil-landscape-02-spiral-OL-20261027-02-57201.jpg',import.meta.url);
 let sourceImage=null,sourceRequested=false;
 function loadSource(){
  if(sourceRequested)return;
  sourceRequested=true;
  const image=new Image();
  image.onload=()=>{if(!disposed)sourceImage=image;};
  image.onerror=()=>{sourceImage=null;};
  image.src=sourceImageURL.href;
 }
 const phi=(1+Math.sqrt(5))/2;
 const palette=['#31545c','#ba7453','#aa9b6b','#303b40','#d4ac7d'];
 function draw(ctx,index,seconds){
  // Browser PREVIEW only. Distinct, readily perceptible motion on every
  // screen until a real TouchDesigner triptych has been published.
  const w=384,h=240,t=seconds,spin=t*.85;
  ctx.globalAlpha=1;
  ctx.fillStyle='#f5f0e6';
  ctx.fillRect(0,0,w,h);
  if(previewURL){
   if(sourceImage){
    const scale=Math.min(w/sourceImage.width,h/sourceImage.height),dw=sourceImage.width*scale,dh=sourceImage.height*scale;
    ctx.drawImage(sourceImage,(w-dw)/2,(h-dh)/2,dw,dh);
   }else{
    ctx.fillStyle='#31545c';ctx.font='bold 20px Arial';ctx.fillText('TRANSLATION STUDY II',28,105);
    ctx.font='16px Arial';ctx.fillText('New animations forthcoming',28,137);
   }
   return;
  }
  if(index===0 && sourceImage){
   const scale=Math.min(w/sourceImage.width,h/sourceImage.height);
   const dw=sourceImage.width*scale,dh=sourceImage.height*scale;
   ctx.drawImage(sourceImage,(w-dw)/2,(h-dh)/2,dw,dh);
   // A scanning line signifies the translation taking place, without
   // altering the underlying source artwork.
   const px=((t*.19)%1)*w;
   const gradient=ctx.createLinearGradient(px-40,0,px+40,0);
   gradient.addColorStop(0,'rgba(255,255,255,0)');
   gradient.addColorStop(.5,'rgba(255,255,255,.35)');
   gradient.addColorStop(1,'rgba(255,255,255,0)');
   ctx.fillStyle=gradient;
   ctx.fillRect(px-40,0,80,h);
   ctx.strokeStyle='rgba(49,84,92,.85)';
   ctx.lineWidth=2.5;
   ctx.beginPath();ctx.moveTo(px,8);ctx.lineTo(px,h-10);ctx.stroke();
  }else{
   ctx.lineCap='round';ctx.lineJoin='round';
   const cx=w/2,cy=h/2;
   for(let k=0;k<48;k++){
    const theta=k*2*Math.PI/(phi*phi)+index*.77+spin*(index===1?.7:1.15);
    const radius=12+Math.sqrt(k/48)*106+7*Math.sin(spin*2+k*.49);
    const px=cx+Math.cos(theta)*radius*1.4;
    const py=cy+Math.sin(theta)*radius*.92;
    ctx.beginPath();
    if(index===1){
     const side=(12+(k%7)*5)*(1+.22*Math.sin(spin*1.6+k*.58));
     ctx.rect(px-side/2,py-side/(2*phi),side,side/phi);
    }else{
     const pulse=.68+.3*Math.sin(spin*1.5+k*.45);
     ctx.moveTo(cx+8*Math.sin(spin*.8),cy+8*Math.cos(spin*.8));
     ctx.lineTo(cx+(px-cx)*pulse,cy+(py-cy)*pulse);
    }
    ctx.strokeStyle=palette[(k+index)%palette.length];
    ctx.globalAlpha=.35+.43*(.5+.5*Math.sin(spin*2+k*.35));
    ctx.lineWidth=(index===1?1.7:2.2)+(k%4)*.55;
    ctx.stroke();
   }
  }
  // Shared moving timeline makes animation apparent even from a distance.
  ctx.globalAlpha=1;
  ctx.fillStyle='rgba(49,84,92,.1)';
  ctx.fillRect(12,h-11,w-24,3);
  ctx.fillStyle='#31545c';
  ctx.fillRect(12,h-11,Math.max(4,((t%8)/8)*(w-24)),3);
 }
 // Paint immediately: a new visitor must never see three blank canvases.
 canvases.forEach((ctx,i)=>{draw(ctx,i%3,0);textures[i].needsUpdate=true;});
 let disposed=false,last=0,frameId=0,draws=0;
 const origin=performance.now();
 const cameraPosition=new THREE.Vector3(),monitorPosition=new THREE.Vector3();
 function tick(time){
  if(disposed)return;
  frameId=requestAnimationFrame(tick);
  if(time-last<150)return; // At most 6-7 frames per second.
  // Advance even when exported video is playing or the visitor is elsewhere.
  // Those early returns must not turn proximity/media checks into 60 Hz work.
  last=time;
  root.getWorldPosition(monitorPosition);
  const distance=camera.getWorldPosition(cameraPosition).distanceTo(monitorPosition);
  const active=distance<11||remoteVisitorNearby?.()===true;
  media.update(active);
  infoRow.update(time,distance<11);
  if(active)loadSource();
  if(!active||media.usingExport)return;
  canvases.forEach((ctx,i)=>{
   draw(ctx,i%3,(time-origin)*.001);textures[i].needsUpdate=true;
  });
  draws++;
 }
 frameId=requestAnimationFrame(tick);
 return {root,mount:wall,screenCount:6+infoRow.panelCount,rowCount:3,thirdPanelScreen:screens[2],sixthPanelScreen:screens[5],
  get playbackLoop(){return media.playbackLoop;},get drawCount(){return draws;},
  get infoDiagnostics(){return infoRow.diagnostics;},
  get mediaDiagnostics(){return media.diagnostics();},
  get watercolourDiagnostics(){return media.diagnostics();},
  dispose(){
   if(disposed)return;
   disposed=true;cancelAnimationFrame(frameId);
   media.dispose();infoRow.dispose();scene.remove(root);
   root.traverse(object=>object.geometry?.dispose());
   textures.forEach(texture=>texture.dispose());
   screenMaterials.forEach(material=>material.dispose());
   bezelMaterial.dispose();lampMaterial.dispose();
  }
 };
}

