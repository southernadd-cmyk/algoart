// Seeded furniture and visitor v1. WebGL-independent placement followed by
// lightweight geometry; no inaccessible downloaded model required.
import {makeRandom,seedFromString,DOOR_WIDTH} from './layout-v2.mjs';
const near=(a,b,r)=>Math.hypot(a.x-b.x,a.z-b.z)<r;
export function planVisitors(layout,hangs,sculptures,{lowPower=false}={}){
 const rng=makeRandom(seedFromString('PP-VISITORS-v1:'+layout.date));
 const benches=[],people=[],obstacles=[];
 // Sparse museum occupancy, bounded even as editions gain more rooms.
 const MAX_VISITORS=lowPower?2:3;
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
     if(people.length<MAX_VISITORS && rng()>.8)people.push({x:b.x,z:b.z,y:room.y,yaw:b.rotation,roomIndex:room.index,
      variant:Math.floor(rng()*5),bodyType:rng()<.5?'male':'female',scale:.91+rng()*.13,pose:4,seat:true});
     break;
    }
   }
  }
  const candidates=roomHangs.slice().sort((a,b)=>a.studyId-b.studyId);
  for(const hang of candidates.slice(0,people.length<MAX_VISITORS && room.index%3===0 && !people.some(p=>p.roomIndex===room.index)?1:0)){
   const dx=hang.x-room.x,dz=hang.z-room.z;
   const distance=Math.hypot(dx,dz)||1;
   const x=hang.x-dx/distance*(1.6+rng()*.45);
   const z=hang.z-dz/distance*(1.6+rng()*.45);
   if(!clear(x,z,.55))continue;
   if(people.some(p=>p.roomIndex===room.index || Math.hypot(x-p.x,z-p.z)<3.3))continue;
   const yaw=Math.atan2(hang.x-x,hang.z-z);
   if(people.length>=MAX_VISITORS)break;
   people.push({x,z,y:room.y,yaw,roomIndex:room.index,variant:Math.floor(rng()*5),pose:Math.floor(rng()*4),bodyType:rng()<.5?'male':'female',scale:.91+rng()*.16});
   obstacles.push({x,z,radius:.45});
  }
 }
 return {benches,people:people.slice(0,MAX_VISITORS)};
}

// Actual male/female rig support for the lzyassoul pack only. The imported
// glTF renames e.g. upper_armL_91/forearmL_90/handL_151, not upper_arm.L.
// Loading is lazy and optional so the gallery's cold start never depends on it.
let characterAssets=null;
async function loadCharacters(){
 if(!characterAssets)characterAssets=Promise.all([
  import('three/addons/loaders/GLTFLoader.js'),
  import('three/addons/utils/SkeletonUtils.js')
 ]).then(([{GLTFLoader},{clone}])=>new Promise((resolve,reject)=>{
  new GLTFLoader().load('./models/human-male-female-rigged.glb',gltf=>{
    // Every visitor instance reuses the same geometry. Scene swaps must not
    // dispose it, otherwise later lift floors get invisible characters.
    gltf.scene.traverse(node=>{
      if(node.isMesh&&node.geometry)node.geometry.userData.sharedVisitorAsset=true;
    });
    resolve({scene:gltf.scene,clone});
  },undefined,reject);
 })).catch(error=>{console.warn('Rigged visitors unavailable:',error);return null;});
 return characterAssets;
}
function riggedVisitor(THREE,asset,person,{relaxed=true,raiseRightArm=false,seated=false}={}){
 const fail=(stage,detail)=>{throw new Error(person.bodyType+' '+stage+': '+detail);};
 const copy=asset.clone(asset.scene);
 const allMeshes=[],skinned=[];
 copy.traverse(node=>{
   if(node.isMesh)allMeshes.push(node);
   if(node.isSkinnedMesh)skinned.push(node);
 });
 // This file contains two skin meshes and five STATIC mesh objects. Select
 // the actual rig by both the known mesh and its own skeleton, never by height.
 const expected=person.bodyType==='male'?'Object_7':'Object_166';
 let selected=skinned.find(mesh=>mesh.name===expected);
 if(!selected){
   // Three.js may uniquify mesh names; skin-root identity is a fallback.
   const root=person.bodyType==='male'?'GLTF_created_0_rootJoint':'GLTF_created_1_rootJoint';
   selected=skinned.find(mesh=>mesh.skeleton?.bones?.[0]?.name?.startsWith(root));
 }
 if(!selected)fail('mesh selection','expected '+expected+'; found '+skinned.map(m=>m.name).join(', '));
 const bones=selected.skeleton?.bones;
 if(!bones?.length)fail('skeleton','skinned mesh has no bones');
 // The glTF import strips Blender's side separator and adds numeric ids:
 // upper_armL_91, forearmL_90, handL_151 (female uses different ids).
 // Normalize semantic names, never rely on character-specific numeric ids.
 const canonicalBoneName=name=>name.replace(/_\d+$/,'')
   .replace(/^(upper_arm|forearm|hand)([LR])$/,(_all,part,side)=>part+'.'+side);
 const named=name=>bones.find(b=>canonicalBoneName(b.name)===name);
 for(const name of ['upper_arm.L','upper_arm.R','forearm.L','forearm.R','hand.L','hand.R']){
   if(!named(name))fail('bone lookup',name+' absent; names: '+bones.map(b=>b.name).filter(n=>/arm|hand/.test(n)).join(', '));
 }
 // Hide every nonselected mesh, not merely the other skinned mesh. The
 // original glTF includes static copies of the two T-posed characters.
 for(const mesh of allMeshes)mesh.visible=mesh===selected;
 selected.frustumCulled=false;
 copy.updateMatrixWorld(true);
 // Source-model defect: left hand is parented to the skeleton root, not
 // forearm.L. Attach() preserves its existing world transform.
 const leftHand=named('hand.L'),leftForearm=named('forearm.L');
 if(leftHand.parent!==leftForearm)leftForearm.attach(leftHand);
 copy.updateMatrixWorld(true);
 const measures=[];
 if(relaxed){
   for(const side of ['L','R']){
     const shoulder=named('upper_arm.'+side),elbow=named('forearm.'+side),wrist=named('hand.'+side);
     const beforeShoulder=shoulder.getWorldPosition(new THREE.Vector3());
     const beforeElbow=elbow.getWorldPosition(new THREE.Vector3());
     const arm=beforeElbow.sub(beforeShoulder).normalize();
     if(!Number.isFinite(arm.y))fail('bone coordinates',side+' arm vector is not finite');
     const target=side==='R'&&raiseRightArm
       ?new THREE.Vector3(-.96,.27,.12).normalize()
       :new THREE.Vector3(side==='L'?.11:-.11,-.992,.06).normalize();
     const delta=new THREE.Quaternion().setFromUnitVectors(arm,target);
     const parentWorld=shoulder.parent.getWorldQuaternion(new THREE.Quaternion());
     const shoulderWorld=shoulder.getWorldQuaternion(new THREE.Quaternion());
     shoulder.quaternion.copy(parentWorld.invert().multiply(delta).multiply(shoulderWorld));
     shoulder.updateMatrixWorld(true);
     const shoulderPos=shoulder.getWorldPosition(new THREE.Vector3());
     const elbowPos=elbow.getWorldPosition(new THREE.Vector3());
     const wristPos=wrist.getWorldPosition(new THREE.Vector3());
     const actual=elbowPos.clone().sub(shoulderPos).normalize();
     const accuracy=actual.dot(target);
     const wristBelowElbow=wristPos.y<elbowPos.y;
     const wristSideDistance=Math.abs(wristPos.x-shoulderPos.x);
     if(!Number.isFinite(accuracy)||accuracy<.95)
       fail('shoulder transform',side+' target dot='+accuracy);
     // Wrist measurements are useful diagnostics, but do not reject the
     // whole rig based on arbitrary orientation thresholds.
     measures.push({side,shoulder:shoulder.name,elbow:elbow.name,wrist:wrist.name,
       targetAccuracy:+accuracy.toFixed(4),wristBelowElbow,
       wristSideDistance:+wristSideDistance.toFixed(3)});
   }
 }
 // Experimental articulated seated pose on the REAL glTF skeleton.
 // Targets are expressed in world space, independent of imported bone axes.
 const seatingMetrics=[];
 if(seated){
   const matching=(side,patterns)=>bones.find(b=>{
     const name=b.name.replace(/_\\d+$/,'').toLowerCase();
     return patterns.some(pattern=>pattern.test(name)) &&
       (name.endsWith(side.toLowerCase())||name.endsWith('.'+side.toLowerCase())||
        name.includes('_'+side.toLowerCase())||name.includes(side.toLowerCase()+'_'));
   });
   const orient=(joint,child,target)=>{
     copy.updateMatrixWorld(true);
     const from=child.getWorldPosition(new THREE.Vector3())
       .sub(joint.getWorldPosition(new THREE.Vector3())).normalize();
     const to=target.clone().normalize();
     if(from.lengthSq()<.1)throw Error('Degenerate limb vector '+joint.name);
     const delta=new THREE.Quaternion().setFromUnitVectors(from,to);
     const parent=joint.parent.getWorldQuaternion(new THREE.Quaternion());
     const world=joint.getWorldQuaternion(new THREE.Quaternion());
     joint.quaternion.copy(parent.invert().multiply(delta).multiply(world));
     copy.updateMatrixWorld(true);
     const result=child.getWorldPosition(new THREE.Vector3())
       .sub(joint.getWorldPosition(new THREE.Vector3())).normalize();
     return result.dot(to);
   };
   for(const side of ['L','R']){
     const thigh=matching(side,[/thigh/,/upleg/,/upperleg/]);
     const shin=matching(side,[/shin/,/calf/,/lowerleg/,/^leg/]);
     const foot=matching(side,[/foot/,/ankle/]);
     if(!thigh||!shin||!foot){
       fail('seated bone lookup',side+' thigh/shin/foot absent; candidates: '+
         bones.map(b=>b.name).filter(n=>/thigh|shin|calf|leg|foot/i.test(n)).join(', '));
     }
     const hipAccuracy=orient(thigh,shin,new THREE.Vector3(0,-.05,1));
     const kneeAccuracy=orient(shin,foot,new THREE.Vector3(0,-1,.12));
     seatingMetrics.push({side,thigh:thigh.name,shin:shin.name,foot:foot.name,
       hipAccuracy:+hipAccuracy.toFixed(3),kneeAccuracy:+kneeAccuracy.toFixed(3)});
   }
 }
 copy.updateMatrixWorld(true);
 const box=new THREE.Box3().setFromObject(selected,true);
 const size=box.getSize(new THREE.Vector3());
 if(!Number.isFinite(size.y)||size.y<.1||size.y>30)
   fail('bounding box','height='+size.y);
 const centre=box.getCenter(new THREE.Vector3());
 const height=person.bodyType==='male'?1.76:1.67;
 const scale=person.scale*height/size.y;
 const holder=new THREE.Group();
 holder.position.set(person.x,person.y,person.z);
 holder.rotation.y=person.yaw;
 copy.scale.setScalar(scale);
 copy.position.set(-centre.x*scale,-box.min.y*scale,-centre.z*scale);
 if(seated){
   // Position from the actual hip joints, not the posed bounding-box bottom.
   // The knee / foot geometry extends well below a seated person's pelvis.
   const hips=bones.filter(b=>/^(thigh|upleg|upperleg)[._]?[lr](?:_\\d+)?$/i.test(b.name));
   if(hips.length===2){
     copy.updateMatrixWorld(true);
     const localHips=hips.map(b=>b.getWorldPosition(new THREE.Vector3()));
     const pelvis=localHips[0].add(localHips[1]).multiplyScalar(.5);
     // Seat top is y=.52, with the pelvis just above it.
     copy.position.y+=.57-pelvis.y*scale;
     // Bring hips forward of the bench backrest and towards seat centre.
     copy.position.z+=.04-pelvis.z*scale;
   }
 }
 holder.add(copy);
 holder.userData.galleryRiggedVisitor=true;
 holder.userData.galleryRigPose=seated?'seated-test':!relaxed?'original':raiseRightArm?'arm-raised':'relaxed';
 holder.userData.galleryRigMetrics={
    bodyType:person.bodyType,selectedMesh:selected.name,
    sourceSkinnedMeshes:skinned.length,visibleSkinnedMeshes:1,
    originalStaticMeshesHidden:allMeshes.length-1,
    arms:measures,seating:seatingMetrics,heightMetres:+(size.y*scale).toFixed(3)
 };
 return holder;
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
 // Load after the initial room is usable. Only standing visitors are
 // substituted; seated poses remain procedural until hip/knee testing.
 if(plan.people.some(p=>!p.seat))loadCharacters().then(asset=>{
   if(!asset||!root.parent)return;
   const figures=root.children.slice(plan.benches.length,plan.benches.length+plan.people.length);
   for(let i=0;i<plan.people.length;i++){
     const p=plan.people[i];
     if(p.seat)continue;
     try{
       const posed=riggedVisitor(THREE,asset,p);
       if(posed){root.add(posed);figures[i].visible=false;}
     }catch(error){console.warn('Visitor pose failed, retaining fallback',error);}
   }
 });
}

// Used by the isolated asset validation view; gallery visitors call the same code.
export {loadCharacters as loadRiggedCharacterAsset,riggedVisitor as createRiggedCharacter};
