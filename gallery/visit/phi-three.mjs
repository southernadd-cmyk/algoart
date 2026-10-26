// Genuine Three.js geometry for the isolated phi architecture prototype.
// Deliberately separate from the public exhibition renderer.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
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
 let focus=new THREE.Vector3(),distance=95,yaw=-.78,pitch=.72,drag=null;
 function block(x,y,z,w,h,d,mat){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);root.add(m);return m;
 }
 function setModel({floor,circulation,physical}){
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
  for(const s of physical.sculptures)block(s.x,.43,s.z,s.width,.86,s.depth,plinth);
  const lift=circulation.lift;
  const pad=block(lift.x,.045,lift.z,2.2,.09,2.2,frame);pad.renderOrder=1;
  focus.set(floor.root.x+floor.root.w/2,0,floor.root.z+floor.root.h/2);
  distance=Math.max(floor.root.w,floor.root.h)*1.55;
  render();
 }
 function render(){
  const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);
  renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
  camera.position.set(focus.x+distance*Math.sin(yaw)*Math.cos(pitch),focus.y+distance*Math.sin(pitch),focus.z+distance*Math.cos(yaw)*Math.cos(pitch));
  camera.lookAt(focus);renderer.render(scene,camera);
 }
 canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId)});
 canvas.addEventListener('pointermove',e=>{if(!drag)return;yaw+=(e.clientX-drag.x)*.009;pitch=Math.max(.17,Math.min(1.46,pitch+(e.clientY-drag.y)*.006));drag={x:e.clientX,y:e.clientY};render()});
 canvas.addEventListener('pointerup',()=>drag=null);canvas.addEventListener('pointercancel',()=>drag=null);
 canvas.addEventListener('wheel',e=>{e.preventDefault();distance=Math.max(15,Math.min(200,distance*Math.exp(e.deltaY*.001)));render()},{passive:false});
 window.addEventListener('resize',render);
 return {setModel,render};
}
