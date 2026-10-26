// Genuine Three.js geometry for the isolated phi architecture prototype.
// Deliberately separate from the public exhibition renderer.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import {createPortraitSculpture} from './sculpture-render-traced.mjs?v=prebaked-sculptures-20261023';
export function mountPhiThree(canvas){
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});
 renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
 renderer.setClearColor(0xf5f2e9);
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(48,1,.1,350);
 scene.add(new THREE.HemisphereLight(0xffffff,0x86847b,2.1));
 const sun=new THREE.DirectionalLight(0xffffff,2.2);sun.position.set(-22,52,30);scene.add(sun);
 const root=new THREE.Group();scene.add(root);
 const stone=new THREE.MeshStandardMaterial({color:0xd8d3c5,roughness:.88,side:THREE.DoubleSide});
 const walls=new THREE.MeshStandardMaterial({color:0xd2d0c8,roughness:.93,side:THREE.DoubleSide});
 const frame=new THREE.MeshStandardMaterial({color:0x5c6e73,metalness:.62,roughness:.32});
 const glass=new THREE.MeshPhysicalMaterial({color:0x8dc7d0,metalness:.1,roughness:.12,transparent:true,opacity:.34,depthWrite:false,side:THREE.DoubleSide});
 const plinth=new THREE.MeshStandardMaterial({color:0xa48370,roughness:.66});
 let focus=new THREE.Vector3(),distance=95,yaw=-.78,pitch=.72,drag=null,mode='orbit',current=null;
 const walker=new THREE.Vector3(),keys=new Set(),touchKeys=new Set();let last=0;
 function setWalkMode(enabled){mode=enabled?'walk':'orbit';keys.clear();touchKeys.clear();if(enabled&&current){const l=current.circulation.lift;walker.set(l.x,1.62,l.z);yaw=0;pitch=.05;}render();return mode;}
 function block(x,y,z,w,h,d,mat){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);root.add(m);return m;
 }
 function setModel({floor,circulation,physical,artwork,studies=[]}){
  current={floor,circulation,physical};
  while(root.children.length){const child=root.children[0];root.remove(child);child.geometry?.dispose();}
  // Draw floor cells individually; missing cells are open atrium voids.
  for(const cell of floor.rooms)block(cell.x+cell.w/2,-.12,cell.z+cell.h/2,cell.w,.24,cell.h,stone);
  const height=3.25,thick=.16;
  // Real doorway openings exist because the physical planner has split wall segments.
  for(const wall of physical.walls){
   const len=wall.hi-wall.lo;
   if(len<.02)continue;
   if(wall.axis==='x')block(wall.at,height/2,(wall.lo+wall.hi)/2,thick,height,len,walls);
   else block((wall.lo+wall.hi)/2,height/2,wall.at,len,height,thick,walls);
  }
  for(const b of circulation.bridges||[]){
   const long=b.length,wide=b.width,c=(b.from+b.to)/2;
   const x=b.axis==='x'?c:b.centre,z=b.axis==='z'?c:b.centre;
   const deck=block(x,.07,z,b.axis==='x'?long:wide,.13,b.axis==='z'?long:wide,glass);
   deck.renderOrder=2;
   for(const side of [-1,1]){
    const bx=x+(b.axis==='z'?side*wide/2:0),bz=z+(b.axis==='x'?side*wide/2:0);
    const pane=block(bx,.83,bz,b.axis==='x'?long:.055,1.42,b.axis==='z'?long:.055,glass);pane.renderOrder=3;
    if(b.axis==='x')block(bx,1.58,bz,long,.065,.065,frame);
    else block(bx,1.58,bz,.065,.065,long,frame);
    for(const t of [-.48,.48]){
     if(b.axis==='x')block(x+long*t,.80,bz,.055,1.55,.055,frame);
     else block(bx,.80,z+long*t,.055,1.55,.055,frame);
    }
   }
  }
  if(artwork){
   const labelTexture=(title,seed)=>{const c=document.createElement('canvas');c.width=512;c.height=128;const g=c.getContext('2d');g.fillStyle='#eee8da';g.fillRect(0,0,512,128);g.fillStyle='#343c36';g.font='21px Georgia';g.fillText(String(title).slice(0,33),18,48);g.font='15px Georgia';g.fillText(String(seed).slice(0,42),18,79);return new THREE.CanvasTexture(c);};
   const canvasMaterial=new THREE.MeshStandardMaterial({color:0xf4f0e5,roughness:.85,side:THREE.DoubleSide});
   const byId=new Map(studies.map(v=>[v.id,v]));
   for(const a of artwork.paintings){const tall=Math.min(1.6,a.height);const panel=a.axis==='x'?block(a.at,1.73,a.u,.10,tall,a.width,canvasMaterial):block(a.u,1.73,a.at,a.width,tall,.10,canvasMaterial);
    const study=byId.get(a.studyId);if(!study?.image)continue;
    new THREE.TextureLoader().load(study.image,texture=>{if(!root.children.includes(panel)){texture.dispose();return;}texture.colorSpace=THREE.SRGBColorSpace;const mat=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide});const mesh=new THREE.Mesh(new THREE.PlaneGeometry(a.width,tall),mat);const nx=a.normal?.x??(a.axis==='x'?1:0),nz=a.normal?.z??(a.axis==='z'?1:0);mesh.position.set(a.axis==='x'?a.at+nx*.09:a.u,1.73,a.axis==='x'?a.u:a.at+nz*.09);if(a.axis==='x')mesh.rotation.y=nx>0?Math.PI/2:-Math.PI/2;else if(nz<0)mesh.rotation.y=Math.PI;root.add(mesh);render();});
   }
   for(const a of artwork.sculptures){const study=byId.get(a.studyId);if(!study)continue;
    const material=study.material?.type?study.material:{type:study.material||'marker'};
    const instance=createPortraitSculpture({scene:root,study:{...study,material},placement:{x:a.x,y:0,z:a.z,yaw:0},quality:'mobile',labelTexture,onComplete:({strokeCount,pigmentCount,prepared})=>{
     if(strokeCount+pigmentCount>0){instance.pivot.userData.sculptureStatus=prepared?'prepared':'rendered';render();return;}
     console.warn('[Phi rehearsal] Sculpture source could not be traced:',study.id,study.seed);
     instance.pivot.userData.sculptureStatus='image-fallback';
     const fallback=new THREE.Group();fallback.name='Portrait sculpture recovery: '+study.id;
     const relief=new THREE.Mesh(new THREE.BoxGeometry(1.05,1.25,.085),new THREE.MeshStandardMaterial({color:'#e6e1d6',roughness:.82}));
     relief.position.y=1.65;fallback.add(relief);
     const label=new THREE.Mesh(new THREE.PlaneGeometry(1.0,1.18),new THREE.MeshBasicMaterial({color:'#dfd9c9',side:THREE.DoubleSide}));
     label.position.set(0,1.65,.048);fallback.add(label);
     if(study.image){new THREE.TextureLoader().load(study.image,texture=>{
       if(instance.pivot.userData.galleryDisposed){texture.dispose();return;}
       texture.colorSpace=THREE.SRGBColorSpace;label.material.dispose();
       label.material=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide});render();
     },undefined,error=>console.warn('[Phi rehearsal] Portrait image unavailable:',study.id,error));}
     instance.pivot.add(fallback);render();
    }});
    instance.pivot.userData.studyId=a.studyId;
   }
  }else for(const s of physical.sculptures)block(s.x,.43,s.z,s.width,.86,s.depth,plinth);
  const lift=circulation.lift;
  const pad=block(lift.x,.045,lift.z,2.2,.09,2.2,frame);pad.renderOrder=1;
  focus.set(floor.root.x+floor.root.w/2,0,floor.root.z+floor.root.h/2);
  distance=Math.max(floor.root.w,floor.root.h)*1.55;
  if(mode==='walk')setWalkMode(true);else render();
 }
 function render(){
  const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);
  renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
  if(mode==='walk'){
   camera.position.copy(walker);
   camera.lookAt(walker.x+Math.sin(yaw)*Math.cos(pitch),walker.y+Math.sin(pitch),walker.z-Math.cos(yaw)*Math.cos(pitch));
  }else{
   camera.position.set(focus.x+distance*Math.sin(yaw)*Math.cos(pitch),focus.y+distance*Math.sin(pitch),focus.z+distance*Math.cos(yaw)*Math.cos(pitch));
   camera.lookAt(focus);
  }
  renderer.render(scene,camera);
 }
 canvas.style.touchAction='none';
 let activePointer=null,touchGesture=null;
 const rotate=(dx,dy)=>{yaw+=dx*.009;pitch=Math.max(mode==='walk'?-.8:.17,Math.min(mode==='walk'?.8:1.46,pitch+dy*.006));render();};
 canvas.addEventListener('pointerdown',e=>{
  if(e.pointerType==='touch')return;
  if(e.cancelable)e.preventDefault();
  activePointer=e.pointerId;drag={x:e.clientX,y:e.clientY};
  canvas.setPointerCapture(e.pointerId);canvas.focus();
 });
 canvas.addEventListener('pointermove',e=>{
  if(e.pointerType==='touch'||!drag||activePointer!==e.pointerId)return;
  rotate(e.clientX-drag.x,e.clientY-drag.y);
  drag={x:e.clientX,y:e.clientY};
 });
 const endPointer=e=>{if(activePointer===e.pointerId){drag=null;activePointer=null;}};
 canvas.addEventListener('pointerup',endPointer);
 canvas.addEventListener('pointercancel',endPointer);
 // Explicit touch handling also covers mobile WebViews that cancel pointer drags.
 canvas.addEventListener('touchstart',e=>{
  if(e.cancelable)e.preventDefault();
  const touches=[...e.touches];
  if(touches.length===1)touchGesture={x:touches[0].clientX,y:touches[0].clientY,pinch:null};
  else if(touches.length>=2)touchGesture={x:(touches[0].clientX+touches[1].clientX)/2,y:(touches[0].clientY+touches[1].clientY)/2,
    pinch:Math.hypot(touches[0].clientX-touches[1].clientX,touches[0].clientY-touches[1].clientY)};
 },{passive:false});
 canvas.addEventListener('touchmove',e=>{
  if(e.cancelable)e.preventDefault();if(!touchGesture)return;
  const touches=[...e.touches];if(!touches.length)return;
  const x=touches.length===1?touches[0].clientX:(touches[0].clientX+touches[1].clientX)/2;
  const y=touches.length===1?touches[0].clientY:(touches[0].clientY+touches[1].clientY)/2;
  if(touches.length===1&&touchGesture.pinch===null)rotate(x-touchGesture.x,y-touchGesture.y);
  if(touches.length>=2){
   const pinch=Math.hypot(touches[0].clientX-touches[1].clientX,touches[0].clientY-touches[1].clientY);
   if(touchGesture.pinch){if(mode!=='walk')distance=Math.max(15,Math.min(200,distance*touchGesture.pinch/pinch));render();}
   touchGesture.pinch=pinch;
  }
  touchGesture.x=x;touchGesture.y=y;
 },{passive:false});
 canvas.addEventListener('touchend',e=>{touchGesture=null;});
 canvas.addEventListener('touchcancel',()=>{touchGesture=null;});
 canvas.addEventListener('wheel',e=>{if(mode==='walk')return;e.preventDefault();distance=Math.max(15,Math.min(200,distance*Math.exp(e.deltaY*.001)));render()},{passive:false});
 canvas.tabIndex=0;
 canvas.addEventListener('keydown',e=>{if(mode==='walk'&&['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(e.key.toLowerCase())){keys.add(e.key.toLowerCase());e.preventDefault();}});
 canvas.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));canvas.addEventListener('blur',()=>keys.clear());
 function tick(ms){const dt=Math.min(.05,Math.max(0,(ms-last)/1000));last=ms;
  if(mode==='walk'&&current&&(keys.size||touchKeys.size)){const pressed=k=>keys.has(k)||touchKeys.has(k);
   const ahead=Number(pressed('w')||pressed('arrowup'))-Number(pressed('s')||pressed('arrowdown'));
   const side=Number(pressed('d')||pressed('arrowright'))-Number(pressed('a')||pressed('arrowleft'));
   const length=Math.hypot(ahead,side)||1,step=4.1*dt/length;
   const dx=(Math.sin(yaw)*ahead+Math.cos(yaw)*side)*step,dz=(-Math.cos(yaw)*ahead+Math.sin(yaw)*side)*step;
   if(current.physical.walkable(walker.x+dx,walker.z))walker.x+=dx;
   if(current.physical.walkable(walker.x,walker.z+dz))walker.z+=dz;
   render();}requestAnimationFrame(tick);
 }requestAnimationFrame(tick);
 window.addEventListener('resize',render);
 return {setModel,render,setWalkMode,setTouchDirection:(direction,pressed)=>{if(pressed)touchKeys.add(direction);else touchKeys.delete(direction);},clearTouchDirections:()=>touchKeys.clear()};
}
