// Reception-only writing uses all eight lettering forms and independently
// varied writer profiles. Golden-angle spirals replace repeated rows.
import {createTag,LETTERING_FORMS,HANDS,VERSION,PHI} from '../../test/graffiti/tag-engine.mjs?v=sprayed-throwups-v7';
import {createTowerGraffiti} from './exterior-graffiti.mjs?v=exterior-writing-20261025';
import {tiledBoxUvs} from './architectural-materials.mjs?v=ambientcg-ceiling-20261022';
export const PHI_SQUARE_REVISION='phi-square-golden-eight-v3|sprayed-throwups-v'+VERSION;
export const SQUARE_TAG_COUNTS=Object.freeze([1,3,5,8]);
export const SQUARE_TAG_FORMS=Object.freeze(Object.keys(LETTERING_FORMS));
export const GOLDEN_ANGLE=Math.PI*(3-Math.sqrt(5));
const writers=Object.keys(HANDS);
export function makeSquareTag(text,seed,ink,{form='handstyle',hand='loop'}={}){
 return createTag(text,{seed,ink,form,hand,paintWidth:1.35});
}
export function planPhiSquare(){
 return [
  {id:'near-west',kind:'wall',material:'brick',x:-11.5,z:1.2,yaw:.12,width:6,height:2.4,depth:.34},
  {id:'near-east',kind:'wall',material:'brick',x:11.5,z:1.2,yaw:-.12,width:6,height:2.4,depth:.34},
  {id:'far-west',kind:'wall',material:'brick',x:-16,z:24,yaw:-.35,width:6,height:2.4,depth:.34},
  {id:'far-east',kind:'wall',material:'brick',x:16,z:24,yaw:.35,width:6,height:2.4,depth:.34},
  {id:'monolith-west',kind:'monument',material:'concrete',x:-8.5,z:15,yaw:-.2,width:1.65,height:3.2,depth:1.35},
  {id:'monolith-east',kind:'monument',material:'concrete',x:8.5,z:19,yaw:.3,width:1.7,height:3.8,depth:1.4},
  {id:'monolith-far',kind:'monument',material:'concrete',x:0,z:30,yaw:.15,width:2,height:3.3,depth:1.5}
 ];
}
function rotate(x,z,yaw){return {x:x*Math.cos(yaw)+z*Math.sin(yaw),z:-x*Math.sin(yaw)+z*Math.cos(yaw)};}
export function goldenSquarePlacement({bounds,length,wallHeight,count,index,phase=0}){
 const angle=(index+phase)*GOLDEN_ANGLE,radius=count===1?0:Math.sqrt((index+.5)/count);
 const rotation=Math.atan2(Math.sin(angle),Math.cos(angle))/PHI**5;
 const c=Math.abs(Math.cos(rotation)),sn=Math.abs(Math.sin(rotation)),aspect=bounds.width/bounds.height;
 const availableWidth=length-.24,availableHeight=wallHeight-.24;
 const scale=[.82,.53,.43,.35][SQUARE_TAG_COUNTS.indexOf(count)]/PHI**(((index+phase)%3)*.22);
 let height=availableHeight*scale,width=height*aspect;
 const fit=Math.min(1,availableWidth/(width*c+height*sn),availableHeight/(height*c+width*sn));
 width*=fit;height*=fit;
 const halfAlong=(width*c+height*sn)/2,halfUp=(height*c+width*sn)/2;
 return {width,height,rotation,u:Math.cos(angle)*radius*(availableWidth/2-halfAlong),
  y:wallHeight/2+Math.sin(angle)*radius*(availableHeight/2-halfUp),
  phi:{angle,radius,index,phase,count,goldenAngle:GOLDEN_ANGLE}};
}
export function planSquareTags(objects=planPhiSquare()){
 const inks=['#843b37','#245965','#303a32','#99763d','#4a4671'],marks=[];
 let faceIndex=0;
 for(const object of objects){
  const faces=[{x:0,z:1,length:object.width},{x:0,z:-1,length:object.width},
   ...(object.kind==='monument'?[{x:1,z:0,length:object.depth},{x:-1,z:0,length:object.depth}]:[])];
  for(const [side,face] of faces.entries()){
   const n=rotate(face.x,face.z,object.yaw),right={x:n.z,z:-n.x};
   const half=face.x?object.width/2:object.depth/2;
   const centre={x:object.x+n.x*half,z:object.z+n.z*half};
   const count=SQUARE_TAG_COUNTS[faceIndex%4],phase=faceIndex*3;
   for(let index=0;index<count;index++){
    const slot=marks.length,phrase=(index+faceIndex)%3===1?'φ':'PHI',seed=PHI_SQUARE_REVISION+'|'+object.id+'|'+side+'|'+index;
    const ink=inks[(slot+faceIndex)%inks.length],form=SQUARE_TAG_FORMS[(slot*5+faceIndex*3)%SQUARE_TAG_FORMS.length];
    const hand=writers[(slot*7+faceIndex*11)%writers.length],tag=makeSquareTag(phrase,seed,ink,{form,hand});
    const p=goldenSquarePlacement({bounds:tag.bounds,length:face.length,wallHeight:object.height,count,index,phase});
    marks.push({id:seed,date:'__phi_reception__',level:0,slot,surface:'square',material:object.material,phrase,text:tag.text,hand:tag.hand,form:tag.form,ink,seed:tag.seed,
     face:{id:object.id+':'+side,centre,length:face.length,roomY:0},width:p.width,height:p.height,rotation:p.rotation,phi:p.phi,
     normal:{...n,y:0},position:{x:centre.x+right.x*p.u-n.x*.197,y:p.y,z:centre.z+right.z*p.u-n.z*.197},
     bounds:{...tag.bounds},tag});
   }
   faceIndex++;
  }
 }
 return marks;
}
export function clearOfPhiSquare(obstacles,x,z,radius=.38){
 return obstacles.every(p=>{const local=rotate(x-p.x,z-p.z,-p.yaw);
  return Math.abs(local.x)>p.width/2+radius||Math.abs(local.z)>p.depth/2+radius;
 });
}
export function createPhiSquare(THREE,{brick,concrete,lowPower=false}){
 const objects=planPhiSquare(),marks=planSquareTags(objects),managers=['brick','concrete'].map(material=>createTowerGraffiti(THREE,{
  brick:material==='brick'?brick:concrete,lowPower,kind:'exterior',
  keyFor:()=>PHI_SQUARE_REVISION+'|'+material,
  planner:()=>marks.filter(m=>m.material===material)
 }));
 let serial=0,activeRoot=null;
 return {
  addTo(parent,{doorway,outward,elevation=0}){
   const root=new THREE.Group();root.name='phi-tagged-square';root.position.set(doorway.x,elevation,doorway.z);
   root.rotation.y=Math.atan2(outward.x,outward.z);
   for(const o of objects){
    const material=o.material==='brick'?brick:concrete;
    const mesh=new THREE.Mesh(tiledBoxUvs(new THREE.BoxGeometry(o.width,o.height,o.depth),o.width,o.height,o.depth,material.userData.tileMeters||2),material);
    mesh.position.set(o.x,o.height/2,o.z);mesh.rotation.y=o.yaw;mesh.name='phi-square-'+o.id;root.add(mesh);
   }
   for(const manager of managers)manager.addTo(root,[],0);
   parent.add(root);activeRoot=root;
   const obstacles=objects.map(o=>{const p=rotate(o.x,o.z,root.rotation.y);return {...o,x:p.x+doorway.x,z:p.z+doorway.z,yaw:o.yaw+root.rotation.y};});
   return {root,obstacles,walls:4,monuments:3,tags:marks.length};
  },
  viewpoint(){
   if(!activeRoot)return null;activeRoot.updateWorldMatrix(true,false);
   return {position:activeRoot.localToWorld(new THREE.Vector3(19,7,33)),target:activeRoot.localToWorld(new THREE.Vector3(0,1.3,8))};
  },
  paintNext(){const first=serial++%2;managers[first].paintNext();if(!managers[first].diagnostics.pending)managers[1-first].paintNext();},
  diagnostics(){const d=managers.map(m=>m.diagnostics);return {revision:PHI_SQUARE_REVISION,marks:d.reduce((n,v)=>n+v.marks,0),painted:d.reduce((n,v)=>n+v.painted,0),pending:d.reduce((n,v)=>n+v.pending,0),errors:d.flatMap(v=>v.errors)};},
  marks(){return managers.flatMap(m=>m.snapshot(0));}
 };
}
