// Seeded furniture and visitor v1. WebGL-independent placement followed by
// lightweight geometry; no inaccessible downloaded model required.
import {makeRandom,seedFromString,DOOR_WIDTH} from './layout-v2.mjs';
const near=(a,b,r)=>Math.hypot(a.x-b.x,a.z-b.z)<r;
export function planVisitors(layout,hangs,sculptures,{lowPower=false}={}){
 const rng=makeRandom(seedFromString('PP-VISITORS-v1:'+layout.date));
 const benches=[],people=[],obstacles=[];
 // Sparse museum occupancy, bounded even as editions gain more rooms.
 const MAX_VISITORS=lowPower?3:6;
 const MAX_BENCHES=lowPower?1:3;
 for(const room of layout.rooms){
  const roomHangs=hangs.filter(h=>h.roomIndex===room.index);
  const roomSculptures=sculptures.filter(p=>p.roomIndex===room.index);
  const clear=(x,z,r=0.5)=>{
   const p={x,z};
   // Preserve a full standing clearance around the figure, not just its centre.
   if(Math.abs(x-room.x)>room.width/2-r-1.05||Math.abs(z-room.z)>room.depth/2-r-1.05)return false;
   // Keep both centre aisles and all door approaches unobstructed.
   const safe=DOOR_WIDTH/2+.15+r;
   const dx=x-room.x,dz=z-room.z;
   if(Math.abs(dx)<1.45+r&&Math.abs(dz)<1.45+r)return false;
   if(room.doors.includes('north')&&dz<0&&Math.abs(dx)<safe)return false;
   if(room.doors.includes('south')&&dz>0&&Math.abs(dx)<safe)return false;
   if(room.doors.includes('west')&&dx<0&&Math.abs(dz)<safe)return false;
   if(room.doors.includes('east')&&dx>0&&Math.abs(dz)<safe)return false;
   if(roomSculptures.some(q=>Math.abs(x-q.x)<q.width/2+r+1.1&&Math.abs(z-q.z)<q.depth/2+r+1.1))return false;
   return !obstacles.some(q=>near(p,q,r+q.radius+.32));
  };
  if(roomHangs.length && room.index%2===1 && benches.length<MAX_BENCHES){
   // Try centre-offset viewing bays on each side; never default to a corner.
   const options=[];
   for(const sx of [-1,1])for(const sz of [-1,1]){
    options.push({x:room.x+sx*(room.width/2-1.12),z:room.z+sz*1.55,rotation:Math.PI/2});
    options.push({x:room.x+sx*1.55,z:room.z+sz*(room.depth/2-1.12),rotation:0});
   }
   const first=Math.floor(rng()*options.length);
   for(let i=0;i<options.length;i++){
    const b=options[(i+first)%options.length];
    if(clear(b.x,b.z,.62)){
     benches.push({...b,y:room.y,roomIndex:room.index});
     obstacles.push({...b,radius:1.15});
     if(people.length<MAX_VISITORS && rng()>.65)people.push({x:b.x,z:b.z,y:room.y,yaw:b.rotation,roomIndex:room.index,
      variant:Math.floor(rng()*5),bodyType:rng()<.5?'male':'female',scale:.91+rng()*.13,pose:4,seat:true});
     break;
    }
   }
  }
  const candidates=roomHangs.slice().sort((a,b)=>a.studyId-b.studyId);
  for(const hang of candidates.slice(0,people.length<MAX_VISITORS && room.index%2===0?1:0)){
   const dx=hang.x-room.x,dz=hang.z-room.z;
   const distance=Math.hypot(dx,dz)||1;
   const x=hang.x-dx/distance*(1.6+rng()*.45);
   const z=hang.z-dz/distance*(1.6+rng()*.45);
   if(!clear(x,z,.38))continue;
   const yaw=Math.atan2(hang.x-x,hang.z-z);
   if(people.length>=MAX_VISITORS)break;
   people.push({x,z,y:room.y,yaw,roomIndex:room.index,variant:Math.floor(rng()*5),pose:Math.floor(rng()*4),bodyType:rng()<.5?'male':'female',scale:.91+rng()*.16});
   obstacles.push({x,z,radius:.45});
  }
 }
 return {benches,people:people.slice(0,MAX_VISITORS)};
}

// Actual male/female rig support for the lzyassoul pack only. The source
// rig uses upper_arm.L/R and thigh.L/R, NOT the unrelated DEF-* naming.
// Loading is lazy and optional so the gallery's cold start never depends on it.
let characterAssets=null;
async function loadCharacters(){
 if(!characterAssets)characterAssets=Promise.all([
  import('three/addons/loaders/GLTFLoader.js'),
  import('three/addons/utils/SkeletonUtils.js')
 ]).then(([{GLTFLoader},{clone}])=>new Promise((resolve,reject)=>{
  new GLTFLoader().load('./models/human-male-female-rigged.glb',
   gltf=>resolve({scene:gltf.scene,clone}),undefined,reject);
 })).catch(()=>null);
 return characterAssets;
}
function riggedVisitor(THREE,asset,person){
 // The lzyassoul archive contains exactly two separate skinned characters.
 // Clone skeletons, do not clone only meshes (that breaks joint bindings).
 const copy=asset.clone(asset.scene);
 const meshes=[];
 copy.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
 const groups=new Map();
 for(const mesh of meshes){
  const key=mesh.skeleton?.bones?.[0];
  if(!key)continue;
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(mesh);
 }
 if(groups.size!==2)return null;
 const candidates=[...groups.values()];
 // Source glTF has the shorter and taller character; prefer actual geometric
 // classification rather than assuming the skin order means male or female.
 const sizes=candidates.map(group=>{
  const box=new THREE.Box3();
  for(const mesh of group)box.expandByObject(mesh);
  return {group,height:box.getSize(new THREE.Vector3()).y};
 }).sort((a,b)=>a.height-b.height);
 const selected=(person.bodyType==='female'?sizes[0]:sizes[1]).group;
 for(const mesh of meshes)mesh.visible=selected.includes(mesh);
 const bones=new Set(selected.flatMap(mesh=>mesh.skeleton.bones));
 const named=label=>[...bones].find(b=>b.name.replace(/_\d+$/,'')===label);
 // Bend an arm toward the body in world space using its actual joint positions.
 // This avoids assuming that the skeleton's local X/Y/Z match world axes.
 copy.updateMatrixWorld(true);
 const tmp=new THREE.Vector3();
 for(const side of ['L','R']){
  const shoulder=named('upper_arm.'+side),elbow=named('forearm.'+side);
  if(!shoulder||!elbow)continue;
  const from=elbow.getWorldPosition(new THREE.Vector3())
    .sub(shoulder.getWorldPosition(new THREE.Vector3())).normalize();
  const down=new THREE.Vector3(0,-1,0);
  const delta=new THREE.Quaternion().setFromUnitVectors(from,down);
  // Limit maximum correction so an unusual skeleton cannot twist violently.
  const correction=new THREE.Quaternion().identity().slerp(delta,.78);
  const parentWorld=shoulder.parent.getWorldQuaternion(new THREE.Quaternion());
  const world=shoulder.getWorldQuaternion(new THREE.Quaternion());
  const desired=correction.multiply(world);
  shoulder.quaternion.copy(parentWorld.invert().multiply(desired));
  shoulder.updateMatrixWorld(true);
 }
 copy.updateMatrixWorld(true);
 const box=new THREE.Box3();
 for(const mesh of selected)box.expandByObject(mesh);
 const size=box.getSize(new THREE.Vector3());
 if(!Number.isFinite(size.y)||size.y<.35||size.y>1000)return null;
 const scale=(person.bodyType==='male'?1.76:1.67)*person.scale/size.y;
 const ctr=box.getCenter(new THREE.Vector3());
 copy.scale.setScalar(scale);
 copy.position.set(person.x-ctr.x*scale,person.y-box.min.y*scale,
   person.z-ctr.z*scale);
 copy.rotation.y=person.yaw;
 copy.userData.galleryRiggedVisitor=true;
 return copy;
}

export function renderVisitors(THREE,scene,plan){
 const root=new THREE.Group();scene.add(root);
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
  root.add(g);
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
  if(p.seat){
   // Seated posture, hips at bench height, thighs horizontal and shins down.
   scaled(g,torsoShape,shirt,[0,.92,-.11],[.225,.27,.16],-.08);
   scaled(g,headShape,skin,[0,1.31,-.13],[.137,.17,.12]);
   scaled(g,headShape,hair[palette],[0,1.445,-.145],[.14,.09,.126]);
   for(const sign of [-1,1]){
    const x=sign*.13;
    scaled(g,limbShape,pants,[x,.47,.25],[.095,.095,.33],Math.PI/2);
    scaled(g,limbShape,pants,[x,.245,.53],[.076,.23,.08]);
    scaled(g,headShape,shoes,[x,.06,.62],[.095,.065,.15]);
    scaled(g,limbShape,shirt,[sign*.27,.85,-.06],[.073,.17,.078],sign*.18);
    scaled(g,limbShape,skin,[sign*.26,.64,.13],[.056,.15,.062],Math.PI/3);
   }
   root.add(g);continue;
  }
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
   const legX=sign*(male?.115:.12)+(p.pose===1?.025:-.008);
   scaled(g,limbShape,pants,[legX,.60,0],[.090,.23,.099],sign*.025);
   scaled(g,limbShape,pants,[legX,.20,.015],[.074,.20,.085],-sign*.018);
   scaled(g,headShape,shoes,[legX,.055,.075],[.097,.065,.17]);
   const armX=sign*(shoulders+.056);
   // Relaxed shoulders, weight shift and occasional folded / thoughtful arms.
   const shoulderTilt=p.pose===1?-.12:p.pose===2?.16:.035;
   const forearmTilt=p.pose===2?sign*.54:p.pose===3?-sign*.22:sign*.09;
   scaled(g,limbShape,shirt,[armX,1.205,0],[.076,.205,.084],sign*shoulderTilt);
   const forearm=scaled(g,limbShape,skin,[armX-sign*.018,.865,p.pose===2?-.13:.045],
     [.060,.155,.064],forearmTilt);
   if(p.pose===2)forearm.rotation.x=-.8;
   if(p.pose===3 && sign===1)forearm.rotation.x=-.45;
  }
  root.add(g);
  }
 // Imported standing figures are deliberately optional. No network request
 // is made if the rigged GLB has not been published alongside this gallery.
 if(plan.people.some(p=>!p.seat)){
  fetch('./models/human-male-female-rigged.glb',{method:'HEAD'}).then(response=>{
   if(!response.ok)return;
   return loadCharacters().then(asset=>{
    if(!asset||!root.parent)return;
    const figures=root.children.slice(plan.benches.length,plan.benches.length+plan.people.length);
    for(let i=0;i<plan.people.length;i++){
     const p=plan.people[i];if(p.seat)continue;
     try{
      const candidate=riggedVisitor(THREE,asset,p);
      if(candidate){root.add(candidate);figures[i].visible=false;}
     }catch(error){console.warn('Visitor skeleton failed; keeping fallback',error);}
    }
   });
  }).catch(()=>{});
 }
}
