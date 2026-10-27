import {createTouchDesignerMonitorMedia} from './phi-touchdesigner-media.mjs';

// Test-only three-monitor installation for the ground-floor reception.
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

export function addPhiReceptionLivingMonitor(THREE,scene,{room,lift,physicalWalls=[],elevation,camera}){
 // phi.world is deliberately NOT required here: it is assigned only after
 // constructPhiGallery returns. Requiring it silently removed every monitor.
 const wall=planPhiReceptionMonitorWall(room,lift,physicalWalls);
 if(!wall)return null;
 const root=new THREE.Group();
 root.name='phi-reception-three-living-monitors';
 root.userData.kind='reception-three-living-monitors';
 root.userData.mount={...wall};
 root.position.set(wall.x,elevation+2.08,wall.z);
 root.rotation.y=wall.yaw;

 const bezelMaterial=new THREE.MeshStandardMaterial({color:0x181a1c,metalness:.32,roughness:.48});
 const lampMaterial=new THREE.MeshBasicMaterial({color:0x66c59d,toneMapped:false});
 const textures=[],screenMaterials=[],canvases=[],screens=[];
 const width=wall.width,height=width*0.66;
 for(let screenIndex=0;screenIndex<3;screenIndex++){
  const unit=new THREE.Group();
  unit.position.x=(screenIndex-1)*(width+wall.gap);
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
 scene.add(root);
 // A single 1152x240 TouchDesigner WebM can feed all three panels.
 // Until an authentic export is published, use the existing procedural canvases.
 const media=createTouchDesignerMonitorMedia(THREE,{screens});

 // Show the actual, reproducible study on monitor one even before an
 // authentic TouchDesigner export is available. Load only when approached.
 const sourceImageURL=new URL('../2026-10-27/2026-10-27-oil-landscape-02-spiral-OL-20261027-02-57201.jpg',import.meta.url);
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
 function draw(ctx,index,time){
  const w=384,h=240;
  ctx.globalAlpha=1;
  ctx.fillStyle='#f5f0e6';ctx.fillRect(0,0,w,h);
  if(index===0 && sourceImage){
   // Contain instead of stretching or cropping the original composition.
   const scale=Math.min(w/sourceImage.width,h/sourceImage.height);
   const dw=sourceImage.width*scale,dh=sourceImage.height*scale;
   ctx.drawImage(sourceImage,(w-dw)/2,(h-dh)/2,dw,dh);
   return;
  }
  ctx.lineCap='round';ctx.lineJoin='round';
  for(let k=0;k<34;k++){
   const theta=k*2*Math.PI/(phi*phi)+index*.77+time*(.24+index*.12);
   const radius=12+Math.sqrt(k/34)*95;
   const px=w/2+Math.cos(theta)*radius*1.45;
   const py=h/2+Math.sin(theta)*radius*.90;
   const a=theta+time*.24;
   ctx.beginPath();
   if(index===0){
    ctx.moveTo(px,py);
    ctx.bezierCurveTo(px+Math.cos(a+1)*34,py+Math.sin(a+1)*34,
      px+Math.cos(a+2)*52,py+Math.sin(a+2)*43,
      px+Math.cos(a+2.4)*70,py+Math.sin(a+2.4)*51);
   }else if(index===1){
    const side=12+(k%7)*5;
    ctx.rect(px-side/2,py-side/(2*phi),side,side/phi);
   }else{
    ctx.moveTo(w/2,h/2);
    ctx.lineTo(px,py);
   }
   ctx.strokeStyle=palette[(k+index)%palette.length];
   ctx.globalAlpha=.48+.24*Math.sin(k*.3+time);
   ctx.lineWidth=1.2+(k%5)*.42;ctx.stroke();
  }
  ctx.globalAlpha=1;
 }
 // Paint immediately: a new visitor must never see three blank canvases.
 canvases.forEach((ctx,i)=>{draw(ctx,i,0);textures[i].needsUpdate=true;});
 let disposed=false,last=0,frameId=0,draws=0;
 const origin=performance.now();
 const cameraPosition=new THREE.Vector3(),monitorPosition=new THREE.Vector3();
 function tick(time){
  if(disposed)return;
  frameId=requestAnimationFrame(tick);
  if(time-last<150)return; // At most 6-7 frames per second.
  root.getWorldPosition(monitorPosition);
  const distance=camera.getWorldPosition(cameraPosition).distanceTo(monitorPosition);
  media.update(distance<11);
  if(distance<11)loadSource();
  if(distance>11||media.usingExport)return;
  last=time;
  canvases.forEach((ctx,i)=>{draw(ctx,i,(time-origin)*.00018);textures[i].needsUpdate=true;});
  draws++;
 }
 frameId=requestAnimationFrame(tick);
 return {root,mount:wall,screenCount:3,get drawCount(){return draws;},
  get mediaDiagnostics(){return media.diagnostics();},
  dispose(){
   if(disposed)return;
   disposed=true;cancelAnimationFrame(frameId);media.dispose();scene.remove(root);
   root.traverse(object=>object.geometry?.dispose());
   textures.forEach(texture=>texture.dispose());
   screenMaterials.forEach(material=>material.dispose());
   bezelMaterial.dispose();lampMaterial.dispose();
  }
 };
}
