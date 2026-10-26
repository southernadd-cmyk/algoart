// Reception-only writing uses all eight lettering forms and independently
// varied writer profiles. Golden-angle spirals replace repeated rows.
import {createTag,LETTERING_FORMS,HANDS,VERSION,PHI} from '../../test/graffiti/tag-engine.mjs?v=sprayed-throwups-v7';
import {createTowerGraffiti} from './exterior-graffiti.mjs?v=exterior-writing-20261025';
import {tiledBoxUvs} from './architectural-materials.mjs?v=ambientcg-ceiling-20261022';
export const PHI_SQUARE_REVISION=(globalThis.__phiReceptionTestRefresh?'phi-square-spiral-pool-v3-ph-i':'phi-square-golden-eight-v6-ph-i')+'|sprayed-throwups-v'+VERSION;
export const SQUARE_TAG_COUNTS=Object.freeze([1,3,5,8]);
export const SQUARE_TAG_FORMS=Object.freeze(Object.keys(LETTERING_FORMS));
export const GOLDEN_ANGLE=Math.PI*(3-Math.sqrt(5));
// Temporarily omit the Loop profile reported as broken. Preserve all other
// writer slots so excluding one hand does not reshuffle the whole square.
export const SQUARE_DISABLED_HANDS=Object.freeze(['loop']);
const writers=Object.keys(HANDS).map(hand=>SQUARE_DISABLED_HANDS.includes(hand)?'rush':hand);
export function makeSquareTag(text,seed,ink,{form='handstyle',hand='rush'}={}){
 if(SQUARE_DISABLED_HANDS.includes(hand))throw new RangeError('Square handwriting temporarily disabled: '+hand);
 return createTag(text,{seed,ink,form,hand,paintWidth:1.35});
}
export function planPhiSquare(){
 if(globalThis.__phiReceptionTestRefresh){
  // True logarithmic golden spiral: radius grows by φ every quarter-turn.
  // Core is off the direct entrance axis so the public approach stays clear.
  const core={x:3,z:18},phi=(1+Math.sqrt(5))/2;
  return Array.from({length:7},(_,i)=>{
   const theta=-.8+i*.73,r=6*Math.pow(phi,theta/(Math.PI/2)+.7);
   const x=core.x+r*Math.cos(theta),z=core.z+r*Math.sin(theta);
   const wall=i>=3;
   return {id:'spiral-'+i,kind:wall?'wall':'monument',
    material:wall?'brick':'concrete',x,z,yaw:Math.PI/2-theta,
    width:wall?5.2:1.8,height:wall?2.4:3.1+i*.22,depth:wall?.34:1.4};
  });
 }
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
    const slot=marks.length,phrase=(index+faceIndex)%3===1?'φ':'ph-i',seed=PHI_SQUARE_REVISION+'|'+object.id+'|'+side+'|'+index;
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
  atlasBase:globalThis.__phiReceptionTestRefresh?'square/'+material:null,
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
   // Test-square architectural refresh: all finishes come from the existing material bank.
   // Local square axes: x spans the frontage, positive z points into the public square.
   if(globalThis.__phiReceptionTestRefresh){
    const paving=concrete,brickwork=brick;
    const add=(w,h,d,x,y,z,mat,name)=>{
     const geometry=tiledBoxUvs(new THREE.BoxGeometry(w,h,d),w,h,d,mat.userData.tileMeters||2);
     const mesh=new THREE.Mesh(geometry,mat);mesh.position.set(x,y,z);mesh.name=name;root.add(mesh);return mesh;
    };
    // A shallow reflecting pool at the golden-spiral core. No extra texture downloads.
    // The basin is offset from the entrance sightline, with a continuous solid rim.
    const cx=3,cz=18,w=7.4,d=w/((1+Math.sqrt(5))/2);
    const water=new THREE.MeshStandardMaterial({color:'#668e99',roughness:.19,metalness:.18,transparent:true,opacity:.83,depthWrite:false});
    const bottom=new THREE.MeshStandardMaterial({color:'#3b5557',roughness:.95});
    add(w,.15,d,cx,-.14,cz,bottom,'phi-spiral-pool-bottom');
    const waterSurface=new THREE.Mesh(new THREE.PlaneGeometry(w-.44,d-.44),water);
    waterSurface.rotation.x=-Math.PI/2;waterSurface.position.set(cx,.013,cz);
    waterSurface.name='phi-spiral-reflecting-water';root.add(waterSurface);
    for(const sign of [-1,1]){
     add(w+.22,.2,.24,cx,.10,cz+sign*d/2,paving,'phi-spiral-pool-rim');
     add(.24,.2,d+.22,cx+sign*w/2,.10,cz,paving,'phi-spiral-pool-rim');
    }
    // A pair of low plinths create public seating at the wide outer edges.
    // Reuse existing stone and brick maps; keep the centre line fully clear.
    for(const x of [-20,20])for(const z of [10,24]){
     add(3.1,.43,1.1,x,.215,z,paving,'phi-square-perimeter-seat');
     add(2.8,.075,.88,x,.475,z,brickwork,'phi-square-perimeter-seat-cap');
    }
    // Slim illuminated markers define the forecourt at night. Emissive materials
    // avoid extra real-time point lights, textures or draw-heavy shadow passes.
    const darkMetal=new THREE.MeshStandardMaterial({color:'#444b46',roughness:.65,metalness:.35});
    const warmGlass=new THREE.MeshStandardMaterial({color:'#eedcb8',emissive:'#e8c78a',emissiveIntensity:.8,roughness:.48});
    for(const x of [-22,22])for(const z of [5,16,27]){
     add(.12,1.06,.12,x,.53,z,darkMetal,'phi-square-wayfinding-post');
     add(.16,.3,.16,x,1.15,z,warmGlass,'phi-square-wayfinding-lantern');
    }
    // Low flush bands create rhythm without making the walking surface uneven.
    for(const z of [5.5,10.5,15.5,20.5,25.5]){
     add(28,.025,.22,0,-.038,z,brickwork,'phi-square-paving-band');
    }
    for(const x of [-13.8,13.8]){
     add(.22,.028,27,x,-.036,14,brickwork,'phi-square-paving-edge');
     // Raised beds and masonry seating stay clear of the central arrival route.
     for(const z of [8,21]){
      const group=new THREE.Group();group.position.set(x,0,z);group.name='phi-square-planted-seat';root.add(group);
      const piece=(w,h,d,px,py,pz,m)=>{
       const mesh=new THREE.Mesh(tiledBoxUvs(new THREE.BoxGeometry(w,h,d),w,h,d,m.userData.tileMeters||2),m);
       mesh.position.set(px,py,pz);group.add(mesh);
      };
      piece(3.2,.44,1.5,0,.22,0,paving);
      piece(2.78,.07,1.12,0,.47,0,brickwork);
      piece(3.15,.11,.42,0,.52,-.65,paving);
      // Sculptural shrub silhouettes avoid new geometry downloads or alpha sorting.
      const green=new THREE.MeshStandardMaterial({color:'#64765b',roughness:1});
      for(const dx of [-.83,0,.83]){
       const shrub=new THREE.Mesh(new THREE.IcosahedronGeometry(.43,1),green);
       shrub.position.set(dx,.93,.12);group.add(shrub);
      }
     }
    }
   }
   for(const manager of managers)manager.addTo(root,[],0);
   parent.add(root);activeRoot=root;
   const obstacles=objects.map(o=>{const p=rotate(o.x,o.z,root.rotation.y);return {...o,x:p.x+doorway.x,z:p.z+doorway.z,yaw:o.yaw+root.rotation.y};});
   if(globalThis.__phiReceptionTestRefresh){
    for(const x of [-13.8,13.8])for(const z of [8,21]){
     const p=rotate(x,z,root.rotation.y);
     obstacles.push({x:p.x+doorway.x,z:p.z+doorway.z,yaw:root.rotation.y,width:3.2,depth:1.5,kind:'planted-seat'});
    }
   }
   if(globalThis.__phiReceptionTestRefresh)obstacles.push({x:doorway.x+3*Math.cos(root.rotation.y)+18*Math.sin(root.rotation.y),z:doorway.z-3*Math.sin(root.rotation.y)+18*Math.cos(root.rotation.y),yaw:root.rotation.y,width:7.9,depth:5.05,kind:'reflecting-pool'});
   if(globalThis.__phiReceptionTestRefresh)for(const x of [-20,20])for(const z of [10,24]){
    const p=rotate(x,z,root.rotation.y);
    obstacles.push({x:p.x+doorway.x,z:p.z+doorway.z,yaw:root.rotation.y,width:3.1,depth:1.1,kind:'perimeter-seat'});
   }
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
