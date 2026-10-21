// Seeded furniture and visitor v1. WebGL-independent placement followed by
// lightweight geometry; no inaccessible downloaded model required.
import {makeRandom,seedFromString,DOOR_WIDTH} from './layout-v2.mjs';
const near=(a,b,r)=>Math.hypot(a.x-b.x,a.z-b.z)<r;
export function planVisitors(layout,hangs,sculptures,{lowPower=false}={}){
 const rng=makeRandom(seedFromString('PP-VISITORS-v1:'+layout.date));
 const benches=[],people=[],obstacles=[];
 for(const room of layout.rooms){
  const roomHangs=hangs.filter(h=>h.roomIndex===room.index);
  const roomSculptures=sculptures.filter(p=>p.roomIndex===room.index);
  const clear=(x,z,r=0.5)=>{
   const p={x,z};
   if(Math.abs(x-room.x)>room.width/2-r-.55||Math.abs(z-room.z)>room.depth/2-r-.55)return false;
   // Keep both centre aisles and all door approaches unobstructed.
   const safe=DOOR_WIDTH/2+.15+r;
   const dx=x-room.x,dz=z-room.z;
   if(Math.abs(dx)<1.1+r&&Math.abs(dz)<1.1+r)return false;
   if(room.doors.includes('north')&&dz<0&&Math.abs(dx)<safe)return false;
   if(room.doors.includes('south')&&dz>0&&Math.abs(dx)<safe)return false;
   if(room.doors.includes('west')&&dx<0&&Math.abs(dz)<safe)return false;
   if(room.doors.includes('east')&&dx>0&&Math.abs(dz)<safe)return false;
   if(roomSculptures.some(q=>Math.abs(x-q.x)<q.width/2+r+.45&&Math.abs(z-q.z)<q.depth/2+r+.45))return false;
   return !obstacles.some(q=>near(p,q,r+q.radius+.32));
  };
  if(room.index%3===1 && roomHangs.length){
   // Small wall-parallel bench at the edge of an open viewing bay.
   const options=[{x:room.x+room.width/2-1.13,z:room.z+room.depth/2-1.12,rotation:Math.PI/2},
    {x:room.x-room.width/2+1.13,z:room.z-room.depth/2+1.12,rotation:Math.PI/2}];
   for(const b of options){
    if(clear(b.x,b.z,.65)){
     benches.push({...b,y:room.y,roomIndex:room.index});
     obstacles.push({...b,radius:1.25});break;
    }
   }
  }
  const candidates=roomHangs.slice().sort((a,b)=>a.studyId-b.studyId);
  for(const hang of candidates.slice(0,lowPower?1:2)){
   const dx=hang.x-room.x,dz=hang.z-room.z;
   const distance=Math.hypot(dx,dz)||1;
   const x=hang.x-dx/distance*(1.6+rng()*.45);
   const z=hang.z-dz/distance*(1.6+rng()*.45);
   if(!clear(x,z,.38))continue;
   const yaw=Math.atan2(hang.x-x,hang.z-z);
   people.push({x,z,y:room.y,yaw,roomIndex:room.index,variant:Math.floor(rng()*5),bodyType:rng()<.5?'male':'female',scale:.91+rng()*.16});
   obstacles.push({x,z,radius:.45});
  }
 }
 return {benches,people};
}
export function renderVisitors(THREE,scene,plan){
 const wood=new THREE.MeshStandardMaterial({color:'#9b8067',roughness:.85});
 const steel=new THREE.MeshStandardMaterial({color:'#59605d',metalness:.48,roughness:.54});
 const skins=['#bd8a6f','#e1b293','#78533f','#c99c80','#9c6f55'].map(color=>new THREE.MeshStandardMaterial({color,roughness:1}));
 const cloth=['#687984','#9b776b','#808c75','#b5aca0','#49565c'].map(color=>new THREE.MeshStandardMaterial({color,roughness:1}));
 function piece(group,geo,mat,x,y,z){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);group.add(m);return m;}
 for(const b of plan.benches){
  const g=new THREE.Group();g.position.set(b.x,b.y,b.z);g.rotation.y=b.rotation;
  piece(g,new THREE.BoxGeometry(1.65,.11,.52),wood,0,.49,0);
  piece(g,new THREE.BoxGeometry(1.65,.4,.09),wood,0,.74,-.25);
  for(const x of [-.68,.68])for(const z of [-.17,.17])
   piece(g,new THREE.BoxGeometry(.075,.48,.075),steel,x,.24,z);
  scene.add(g);
 }
 const hair=['#38302b','#6c5240','#262b2b','#a07d53','#5b4b42'].map(color=>new THREE.MeshStandardMaterial({color,roughness:1}));
 const trousers=['#3b454c','#625c5b','#52534e','#434f5a','#68685d'].map(color=>new THREE.MeshStandardMaterial({color,roughness:1}));
 const shoes=new THREE.MeshStandardMaterial({color:'#363937',roughness:.92});
 const headShape=new THREE.SphereGeometry(1,12,9);
 const torsoShape=new THREE.CylinderGeometry(1,1,1,10);
 const limbShape=new THREE.CylinderGeometry(1,1,1,8);
 function scaled(group,geometry,material,pos,size,rotation=0){
  const mesh=piece(group,geometry,material,...pos);
  mesh.scale.set(...size);mesh.rotation.z=rotation;return mesh;
 }
 for(const p of plan.people){
  const g=new THREE.Group();
  g.position.set(p.x,p.y,p.z);g.rotation.y=p.yaw;g.scale.setScalar(p.scale);
  const male=p.bodyType==='male',palette=p.variant;
  const skin=skins[palette],shirt=cloth[palette],pants=trousers[palette];
  const stature=male?1.76:1.66;
  const shoulders=male?.255:.218;
  const hips=male?.20:.225;
  // An articulated human silhouette: head, neck, tapered torso, hips,
  // distinct upper/lower limbs, shoes and simple hair.
  scaled(g,torsoShape,shirt,[0,1.21,0],[shoulders,.31,.16]);
  scaled(g,torsoShape,pants,[0,.91,0],[hips,.16,.16]);
  scaled(g,limbShape,skin,[0,1.53,0],[.073,.065,.073]);
  scaled(g,headShape,skin,[0,stature-.17,0],[.135,.18,.12]);
  scaled(g,headShape,hair[palette],[0,stature-.045,-.015],[.141,.096,.122]);
  for(const sign of [-1,1]){
   const legX=sign*(male?.115:.12);
   scaled(g,limbShape,pants,[legX,.60,0],[.090,.23,.099],sign*.025);
   scaled(g,limbShape,pants,[legX,.20,.015],[.074,.20,.085],-sign*.018);
   scaled(g,headShape,shoes,[legX,.055,.075],[.097,.065,.17]);
   const armX=sign*(shoulders+.056);
   scaled(g,limbShape,shirt,[armX,1.205,0],[.076,.205,.084],sign*.085);
   scaled(g,limbShape,skin,[armX+sign*.032,.85,.018],[.061,.16,.068],sign*.10);
  }
  scene.add(g);
 }
}
