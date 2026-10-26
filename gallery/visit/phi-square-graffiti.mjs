// Reception-only writing surfaces. The latest approved broad-nib engine supplies
// the letters and sprayed atlas; the lowercase symbol keeps its own descender.
import {makeTowerFamilyTag,TOWER_LETTERING_REVISION} from './tower-family-lettering.mjs';
import {createTowerGraffiti} from './exterior-graffiti.mjs';
import {tiledBoxUvs} from './architectural-materials.mjs';
export const PHI_SQUARE_REVISION='phi-square-v1|'+TOWER_LETTERING_REVISION;
export function makeSquareTag(text,seed,ink){
 const tag=makeTowerFamilyTag(text,{hand:'F',seed,ink,finish:'spray',paintWidth:2});
 if(text==='φ'){
  tag.text=tag.plan.word='φ';tag.plan.shared=[];
  tag.plan.letters[0].ch='φ';tag.plan.letters[0].shapes=[
   {kind:'stroke',role:'structure',d:'M 14 49 C 26 31 64 19 81 40 C 102 66 86 91 57 93 C 27 94 7 76 14 49'},
   {kind:'stroke',role:'structure',d:'M 60 12 C 48 44 45 93 37 131'}
  ];tag.construction.letters[0].char='φ';
 }
 return tag;
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
export function planSquareTags(objects=planPhiSquare()){
 const inks=['#843b37','#245965','#303a32','#99763d','#4a4671'],marks=[];
 for(const object of objects){
  const faces=[{x:0,z:1,length:object.width},{x:0,z:-1,length:object.width},
   ...(object.kind==='monument'?[{x:1,z:0,length:object.depth},{x:-1,z:0,length:object.depth}]:[])];
  for(const [side,face] of faces.entries()){
   const n=rotate(face.x,face.z,object.yaw),right={x:n.z,z:-n.x};
   const half=face.x?object.width/2:object.depth/2;
   const centre={x:object.x+n.x*half,z:object.z+n.z*half};
   const columns=object.kind==='wall'?3:1;
   for(let row=0;row<2;row++)for(let col=0;col<columns;col++){
    const slot=marks.length,phrase=(row+col+side)%2?'φ':'PHI',seed=PHI_SQUARE_REVISION+'|'+object.id+'|'+side+'|'+row+'|'+col;
    const ink=inks[slot%inks.length],tag=makeSquareTag(phrase,seed,ink);
    const cell=face.length/columns,width=Math.min(cell-.14,phrase==='φ'?1.05:1.95);
    const height=Math.min(width*tag.bounds.height/tag.bounds.width,object.kind==='wall'?1.08:1.4);
    const actualWidth=height*tag.bounds.width/tag.bounds.height;
    const shift=(col-(columns-1)/2)*cell;
    marks.push({id:seed,date:'__phi_reception__',level:0,slot,surface:'square',phrase,text:tag.text,hand:tag.hand,form:tag.form,ink,seed:tag.seed,
     face:{id:object.id+':'+side,centre,length:face.length,roomY:0},width:actualWidth,height,rotation:(slot%3-1)*.045,
     normal:{...n,y:0},position:{x:centre.x+right.x*shift-n.x*.197,y:row===0?object.height*.29:object.height*.73,z:centre.z+right.z*shift-n.z*.197},
     bounds:{...tag.bounds},tag});
   }
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
 const objects=planPhiSquare(),managers=['brick','concrete'].map(material=>createTowerGraffiti(THREE,{
  brick:material==='brick'?brick:concrete,lowPower,kind:'exterior',
  keyFor:()=>PHI_SQUARE_REVISION+'|'+material,
  planner:()=>planSquareTags(objects.filter(o=>o.material===material))
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
   return {root,obstacles,walls:4,monuments:3,tags:72};
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
