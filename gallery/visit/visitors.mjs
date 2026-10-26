// Seeded furniture and visitor v1. WebGL-independent placement followed by
// lightweight geometry; no inaccessible downloaded model required.
import {makeRandom,seedFromString,DOOR_WIDTH} from './layout-v2.mjs';
import {replaceFixtureWithProp} from './polyhaven-props.mjs?v=texture-manifest-20261022';
import {stabiliseMaleTorsoSkinning} from './visitor-skin-repair.mjs?v=measured-torso-v3-20261022';
const near=(a,b,r)=>Math.hypot(a.x-b.x,a.z-b.z)<r;
export function planVisitors(layout,hangs,sculptures,{lowPower=false}={}){
 const rng=makeRandom(seedFromString('PP-VISITORS-v1:'+layout.date));
 const benches=[],people=[],obstacles=[];
 // Sparse museum occupancy, bounded even as editions gain more rooms.
 const MAX_VISITORS=lowPower?2:3;
 const MAX_BENCHES=lowPower?2:4;
 // Guarantee room for standing visitors instead of allowing bench occupancy
 // to use all available character slots.
 const MAX_SEATED=1;
 const standingClear=(room,roomSculptures,x,z,r=.5)=>{
   const p={x,z};
   if(Math.abs(x-room.x)>room.width/2-r-1.05||
      Math.abs(z-room.z)>room.depth/2-r-1.05)return false;
   const safe=DOOR_WIDTH/2+.15+r;
   const dx=x-room.x,dz=z-room.z;
   if(Math.abs(dx)<1.45+r&&Math.abs(dz)<1.45+r)return false;
   if(room.doors.includes('north')&&dz<0&&Math.abs(dx)<safe)return false;
   if(room.doors.includes('south')&&dz>0&&Math.abs(dx)<safe)return false;
   if(room.doors.includes('west')&&dx<0&&Math.abs(dz)<safe)return false;
   if(room.doors.includes('east')&&dx>0&&Math.abs(dz)<safe)return false;
   if(roomSculptures.some(q=>Math.abs(x-q.x)<q.width/2+r+1.1&&
       Math.abs(z-q.z)<q.depth/2+r+1.1))return false;
   return !obstacles.some(q=>near(p,q,r+q.radius+.32));
 };
 for(const room of layout.rooms){
  const roomHangs=hangs.filter(h=>h.roomIndex===room.index);
  const roomSculptures=sculptures.filter(p=>p.roomIndex===room.index);
  const clear=(x,z,r=.5)=>standingClear(room,roomSculptures,x,z,r);
  if(layout.rooms.length>=3&&room.index>0 && roomHangs.length && benches.length<MAX_BENCHES){
   // Viewing benches are curated around actual hanging artworks, not placed
   // at arbitrary room corners. Prefer a substantial focal/hero piece.
   const curated=roomHangs.slice().sort((a,b)=>
     Number(b.role==='hero')-Number(a.role==='hero') ||
     b.width-a.width || a.studyId-b.studyId);
   const inward={
     north:{x:0,z:1},south:{x:0,z:-1},
     east:{x:-1,z:0},west:{x:1,z:0}
   };
   let chosen=null;
   for(const art of curated){
    const normal=inward[art.surface];
    if(!normal)continue;
    const lateral={x:-normal.z,z:normal.x};
    // Preserve a direct view of the target, rather than looking through a
    // freestanding sculpture. Sample the centre of the sightline in plan.
    const visible=(x,z)=>{
     for(let t=.2;t<.9;t+=.12){
      const qx=x+(art.x-x)*t,qz=z+(art.z-z)*t;
      if(roomSculptures.some(p=>Math.abs(qx-p.x)<p.width/2+.35&&
          Math.abs(qz-p.z)<p.depth/2+.35))return false;
     }
     return true;
    };
    // 1.75–2.7 m viewing distance; small offsets allow artwork on a portal
    // wing to be seen without obstructing the central through-route.
    for(const distance of [2.1,1.8,2.45,2.7,1.65]){
     for(const offset of [0,-.45,.45,-.85,.85]){
      const x=art.x+normal.x*distance+lateral.x*offset;
      const z=art.z+normal.z*distance+lateral.z*offset;
      if(!clear(x,z,.70)||!visible(x,z))continue;
      const dx=art.x-x,dz=art.z-z;
      // At most ~25 degrees from a square-on view of the painting.
      const mag=Math.hypot(dx,dz);
      if((dx*(-normal.x)+dz*(-normal.z))/mag<.91)continue;
      chosen={x,z,y:room.y,roomIndex:room.index,
       rotation:Math.atan2(dx,dz),targetX:art.x,targetZ:art.z,studyId:art.studyId};
      break;
     }
     if(chosen)break;
    }
    if(chosen)break;
   }
   if(chosen){
    benches.push(chosen);
    obstacles.push({x:chosen.x,z:chosen.z,radius:1.15});
    if(people.length<MAX_VISITORS && people.filter(p=>p.seat).length<MAX_SEATED && rng()>.8)
     people.push({x:chosen.x,z:chosen.z,y:room.y,yaw:chosen.rotation,
      roomIndex:room.index,variant:Math.floor(rng()*5),
      bodyType:rng()<.5?'male':'female',scale:.91+rng()*.13,pose:4,seat:true});
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
 // A single centred sample frequently lands in a doorway or sculpture
 // exclusion zone. Try several genuine viewing positions beside each
 // hanging picture before deciding this floor has no standing visitors.
 const targetStanding=lowPower?1:2;
 const roomCandidates=layout.rooms.slice().sort((a,b)=>{
   const aArt=hangs.filter(h=>h.roomIndex===a.index).length;
   const bArt=hangs.filter(h=>h.roomIndex===b.index).length;
   return bArt-aArt || a.index-b.index;
 });
 const inward={
   north:{x:0,z:1},south:{x:0,z:-1},
   east:{x:-1,z:0},west:{x:1,z:0}
 };
 for(const room of roomCandidates){
   if(people.length>=MAX_VISITORS||
      people.filter(p=>!p.seat).length>=targetStanding)break;
   if(people.some(p=>p.roomIndex===room.index))continue;
   const roomSculptures=sculptures.filter(p=>p.roomIndex===room.index);
   const roomHangs=hangs.filter(h=>h.roomIndex===room.index)
     .slice().sort((a,b)=>a.studyId-b.studyId);
   let placed=false;
   for(const art of roomHangs){
     const normal=inward[art.surface];
     if(!normal)continue;
     const lateral={x:-normal.z,z:normal.x};
     for(const distance of [1.45,1.8,2.15,2.5]){
       for(const offset of [-1.35,1.35,-.8,.8,-2.0,2.0,0]){
         const x=art.x+normal.x*distance+lateral.x*offset;
         const z=art.z+normal.z*distance+lateral.z*offset;
         if(!standingClear(room,roomSculptures,x,z,.50))continue;
         if(people.some(p=>Math.hypot(x-p.x,z-p.z)<2.35))continue;
         const yaw=Math.atan2(art.x-x,art.z-z);
         people.push({x,z,y:room.y,yaw,roomIndex:room.index,
           variant:Math.floor(rng()*5),pose:Math.floor(rng()*4),
           bodyType:rng()<.5?'male':'female',scale:.91+rng()*.16});
         obstacles.push({x,z,radius:.45});
         placed=true;
         break;
       }
       if(placed)break;
     }
     if(placed)break;
   }
 }
 // For very tight historic layouts, all painting-centred candidates can
 // be blocked despite there being legal standing space elsewhere in the room.
 // Sweep a sparse grid and face the nearest artwork/sculpture instead of
 // leaving the whole exhibition without any standing visitors.
 if(people.filter(p=>!p.seat).length<targetStanding){
   const steps=[-3.2,-2.8,-2.3,-1.8,-1,0,1,1.8,2.3,2.8,3.2];
   for(const room of roomCandidates){
     if(people.length>=MAX_VISITORS||
        people.filter(p=>!p.seat).length>=targetStanding)break;
     if(people.some(p=>p.roomIndex===room.index))continue;
     const roomSculptures=sculptures.filter(p=>p.roomIndex===room.index);
     const focus=hangs.filter(h=>h.roomIndex===room.index)
       .concat(roomSculptures.map(p=>({x:p.x,z:p.z})));
     if(!focus.length)continue;
     let best=null;
     for(const dx of steps)for(const dz of steps){
       const x=room.x+dx,z=room.z+dz;
       if(!standingClear(room,roomSculptures,x,z,.50))continue;
       if(people.some(p=>Math.hypot(x-p.x,z-p.z)<2.35))continue;
       for(const art of focus){
         const distance=Math.hypot(x-art.x,z-art.z);
         if(distance<1.4||distance>5.1)continue;
         const score=Math.abs(distance-2.25)+.02*(Math.abs(dx)+Math.abs(dz));
         if(!best||score<best.score)best={x,z,art,score};
       }
     }
     if(!best)continue;
     people.push({x:best.x,z:best.z,y:room.y,
       yaw:Math.atan2(best.art.x-best.x,best.art.z-best.z),
       roomIndex:room.index,variant:Math.floor(rng()*5),
       pose:Math.floor(rng()*4),bodyType:rng()<.5?'male':'female',
       scale:.91+rng()*.16});
     obstacles.push({x:best.x,z:best.z,radius:.45});
   }
 }
 // The seed still determines the room, pose, clothes and body-type order,
 // but never produces an all-male or all-female two-person exhibition.
 // On desktop both standing models differ; on mobile one standing visitor
 // and one seated visitor differ if the second character is present.
 const standing=people.filter(person=>!person.seat);
 if(standing.length>=2){
   const first=rng()<.5?'male':'female';
   standing[0].bodyType=first;
   standing[1].bodyType=first==='male'?'female':'male';
 }else if(people.length>=2){
   const first=rng()<.5?'male':'female';
   people[0].bodyType=first;
   people[1].bodyType=first==='male'?'female':'male';
 }
 return {benches,people:people.slice(0,MAX_VISITORS)};
}

// Actual male/female rig support for the lzyassoul pack only. The imported
// glTF renames e.g. upper_armL_91/forearmL_90/handL_151, not upper_arm.L.
// Loading is lazy and optional so the gallery's cold start never depends on it.
const rigMode=new URLSearchParams(location.search).get('rig')||'fixed';
let characterAssets=null;
async function loadCharacters(){
 if(!characterAssets)characterAssets=Promise.all([
  import('three/addons/loaders/GLTFLoader.js'),
  import('three/addons/utils/SkeletonUtils.js'),
  import('three/addons/libs/meshopt_decoder.module.js')
 ]).then(([{GLTFLoader},{clone},{MeshoptDecoder}])=>Promise.all(['male','female'].map(sex=>new Promise((resolve,reject)=>{
  new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load('./models/quaternius-'+sex+'-meshopt.glb',gltf=>resolve(gltf.scene),undefined,reject);
 }))).then(([male,female])=>({quaternius:true,male,female,clone}))).catch(async error=>{
 console.warn('Quaternius visitors unavailable; attempting previous GLB',error);
 const [{GLTFLoader},{clone},{MeshoptDecoder}]=await Promise.all([import('three/addons/loaders/GLTFLoader.js'),import('three/addons/utils/SkeletonUtils.js'),import('three/addons/libs/meshopt_decoder.module.js')]);
 return new Promise((resolve,reject)=>{
  new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load('./models/human-male-female-rigged-optimized.glb',gltf=>{
    if(rigMode!=='bind'&&rigMode!=='raw'){
      const repair=stabiliseMaleTorsoSkinning(gltf.scene);
      if(repair.reason)console.warn('Male visitor skin repair skipped:',repair.reason);
      else console.info('Male visitor skin repaired:',repair.repaired,'vertices');
    }else console.info('Rig diagnostic, original skin:',rigMode);
    // Every visitor instance reuses the same geometry. Scene swaps must not
    // dispose it, otherwise later lift floors get invisible characters.
    gltf.scene.traverse(node=>{
      if(node.isMesh&&node.geometry)node.geometry.userData.sharedVisitorAsset=true;
    });
    resolve({scene:gltf.scene,clone});
  },undefined,reject);
 });
 }).catch(error=>{console.warn('Rigged visitors unavailable:',error);return null;});
 return characterAssets;
}
// A continuous, seeded colour space rather than a fixed palette. Each
// visitor keeps the same shade when their daily gallery is revisited.
function quaterniusVisitorTone(person){
 let hash=2166136261;
 const identity=[person.bodyType,Math.round(person.x*100),Math.round(person.y*100),
  Math.round(person.z*100),Math.round(person.yaw*1000)].join(':');
 for(let i=0;i<identity.length;i++){
  hash=Math.imul(hash^identity.charCodeAt(i),16777619);
 }
 const unit=()=>{hash^=hash<<13;hash^=hash>>>17;hash^=hash<<5;return (hash>>>0)/4294967296;};
 // Earthy, restrained tones in HSL: many possible combinations, none neon.
 const hue=unit(),saturation=.13+unit()*.23,lightness=.30+unit()*.27;
 return {hue,saturation,lightness};
}
function quaterniusVisitor(THREE,asset,person,{relaxed=true,raiseRightArm=false,seated=false,seatHipHeight=.61}={}){
 const copy=asset.clone(asset[person.bodyType]);
 const bones={};let skinned=0;
 // Each character is one uniformly shaded sculpture, without skin/clothing
 // vertex colours, eye textures, or partial texture maps.
 const tone=quaterniusVisitorTone(person);
 const material=new THREE.MeshStandardMaterial({
  color:new THREE.Color().setHSL(tone.hue,tone.saturation,tone.lightness),
  roughness:.92,metalness:0,
  vertexColors:false,flatShading:false,side:THREE.DoubleSide
 });
 copy.traverse(node=>{
  if(node.isBone)bones[node.name]=node;
  if(node.isSkinnedMesh){
   skinned++;node.frustumCulled=false;
   node.geometry.userData.sharedVisitorAsset=true;
   node.material=material;
  }else if(node.isMesh){
   node.material=material;
  }
 });
 if(!skinned||!bones.upperarm_l||!bones.upperarm_r)throw Error('Quaternius rig incomplete: '+person.bodyType);
 const rotate=(name,axis,deg)=>{const bone=bones[name];if(!bone)return;bone.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(axis==='x'?1:0,axis==='y'?1:0,axis==='z'?1:0),THREE.MathUtils.degToRad(deg)))};
 if(relaxed){rotate('upperarm_l','z',-65);rotate('upperarm_r','z',65);}
 if(raiseRightArm){rotate('upperarm_r','z',-100);rotate('upperarm_r','x',-25);}
 if(seated){rotate('pelvis','x',-9);rotate('spine_01','x',10);for(const side of ['l','r']){rotate('thigh_'+side,'x',-82);rotate('calf_'+side,'x',80);}}
 copy.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(copy,true);
 const size=bounds.getSize(new THREE.Vector3()),centre=bounds.getCenter(new THREE.Vector3());
 if(!Number.isFinite(size.y)||size.y<.1)throw Error('Invalid Quaternius bounds');
 const scale=(person.bodyType==='male'?1.76:1.67)*person.scale/size.y;
 const holder=new THREE.Group();
 holder.position.set(person.x,person.y,person.z);holder.rotation.y=person.yaw;
 copy.scale.setScalar(scale);
 copy.position.set(-centre.x*scale,-bounds.min.y*scale,-centre.z*scale);
 if(seated && bones.pelvis){
  copy.updateMatrixWorld(true);
  const hip=bones.pelvis.getWorldPosition(new THREE.Vector3());
  // Correct for holder coordinates and place hips at the bench cushion.
  copy.position.y+=seatHipHeight-hip.y;
  copy.position.z+=.42-hip.z;
 }
 holder.add(copy);
 holder.userData.galleryRiggedVisitor=true;
 holder.userData.galleryRigPose=seated?'seated':raiseRightArm?'arm-raised':'relaxed';
 holder.userData.galleryRigMetrics={bodyType:person.bodyType,sourceSkinnedMeshes:skinned,visibleSkinnedMeshes:skinned,originalStaticMeshesHidden:0,arms:[],seating:[],heightMetres:size.y*scale};
 return holder;
}
function riggedVisitor(THREE,asset,person,{relaxed=true,raiseRightArm=false,seated=false,seatHipHeight=.61}={}){
 if(asset.quaternius)return quaterniusVisitor(THREE,asset,person,{relaxed,raiseRightArm,seated,seatHipHeight});
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
   const orient=(joint,child,target,bend=1)=>{
     copy.updateMatrixWorld(true);
     const from=child.getWorldPosition(new THREE.Vector3())
       .sub(joint.getWorldPosition(new THREE.Vector3())).normalize();
     const to=target.clone().normalize();
     if(from.lengthSq()<.1)throw Error('Degenerate limb vector '+joint.name);
     const delta=new THREE.Quaternion().setFromUnitVectors(from,to);
     const parent=joint.parent.getWorldQuaternion(new THREE.Quaternion());
     const world=joint.getWorldQuaternion(new THREE.Quaternion());
     // A full ninety-degree rotation at the thigh can pull skin-weighted
     // vertices into the abdomen and pinch the waist. Blend just the hip
     // bend; shoulder and knee targets retain their original strength.
     const requested=parent.invert().multiply(delta).multiply(world);
     joint.quaternion.slerp(requested,bend);
     copy.updateMatrixWorld(true);
     const result=child.getWorldPosition(new THREE.Vector3())
       .sub(joint.getWorldPosition(new THREE.Vector3())).normalize();
     return result.dot(to);
   };
   for(const side of ['L','R']){
     // Bring hands forward to rest near the knees rather than hanging vertically.
     const shoulder=named('upper_arm.'+side),elbow=named('forearm.'+side),hand=named('hand.'+side);
     if(shoulder&&elbow&&hand){
       // Keep elbows slightly forward and wrists above the thighs, rather
       // than allowing the hands to intersect the bench beside the hips.
       orient(shoulder,elbow,new THREE.Vector3(side==='L'?.12:-.12,-.18,.98));
       orient(elbow,hand,new THREE.Vector3(0,-.35,.94));
     }
     const thigh=matching(side,[/thigh/,/upleg/,/upperleg/]);
     const shin=matching(side,[/shin/,/calf/,/lowerleg/,/^leg/]);
     const foot=matching(side,[/foot/,/ankle/]);
     if(!thigh||!shin||!foot){
       fail('seated bone lookup',side+' thigh/shin/foot absent; candidates: '+
         bones.map(b=>b.name).filter(n=>/thigh|shin|calf|leg|foot/i.test(n)).join(', '));
     }
     // A little downward thigh angle plus a partial hip rotation avoids
     // the unnaturally sharp pinch at the pelvis of these imported rigs.
     const hipAccuracy=orient(thigh,shin,new THREE.Vector3(0,-.27,.96),.84);
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
     // Align the hips relative to this floor (the holder supplies person.y).
     copy.position.y+=seatHipHeight-pelvis.y;
     // Advance hips past the backrest onto the actual seating surface.
     copy.position.z+=-.18-pelvis.z;
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
 const placeholders=new Map();
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
  // Actual Poly Haven model is an optional cosmetic upgrade. Keep the
  // validated local bench footprint and sitter positioning unchanged.
  if(!matchMedia('(pointer:coarse)').matches)replaceFixtureWithProp(THREE,{
    id:'painted_wooden_bench',parent:root,placeholder:g,
    position:new THREE.Vector3(b.x,b.y,b.z),rotation:b.rotation,
    width:1.65,height:.88,depth:.52
  });
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
   // Do not show a disconnected primitive seated figure. The validated
   // rigged sitting pose is loaded below; failures leave an empty bench.
   root.add(g);g.visible=false;placeholders.set(p,g);continue;
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
  placeholders.set(p,g);
  }
 // Rigged models replace standing placeholders and supply all seated people.
 // Delayed model loads must never populate a disposed/previous exhibition.
 if(plan.people.length)loadCharacters().then(asset=>{
   if(!asset||!root.parent)return;
   for(let i=0;i<plan.people.length;i++){
     const p=plan.people[i];
     try{
       if(p.seat){
         // Cushion surface is ~0.55m; place the hip joint just above it.
         const seated=riggedVisitor(THREE,asset,{...p,scale:1},{seated:true,seatHipHeight:.61});
         // The model faces local +Z; negative Z moves its hips into the bench.
         // Previous positive offsets pushed sitters away from the seat.
         const forward=-.39;
         const shift=new THREE.Vector3(0,0,forward)
           .applyAxisAngle(new THREE.Vector3(0,1,0),p.yaw);
         seated.position.add(shift);
         root.add(seated);
       }else{
         const posed=riggedVisitor(THREE,asset,p,{relaxed:rigMode!=='bind'});
         if(posed){root.add(posed);placeholders.get(p).visible=false;}
       }
     }catch(error){console.warn('Rigged visitor unavailable',p.bodyType,error);}
   }
 });
}

// Used by the isolated asset validation view; gallery visitors call the same code.
export {loadCharacters as loadRiggedCharacterAsset,riggedVisitor as createRiggedCharacter};

/**
 * Place two calibrated real rigged visitors on separate plaza benches.
 * Called after entry to avoid delaying the first outdoor render.
 */
export function renderPlazaSeatedVisitors(THREE,scene,plaza){
 if(!plaza)return null;
 const group=new THREE.Group();scene.add(group);
 const positions=[
  {type:'male',along:-9,side:-1,forward:-.39},
  {type:'female',along:6,side:1,forward:-.39}
 ];
 loadCharacters().then(asset=>{
  if(!asset||!group.parent)return;
  for(const p of positions){
   const across=p.side*(plaza.halfWidth-2.2);
   const x=plaza.centre.x+plaza.outward.x*p.along+plaza.transverse.x*across;
   const z=plaza.centre.z+plaza.outward.z*p.along+plaza.transverse.z*across;
   const facing=new THREE.Vector3(-plaza.transverse.x*p.side,0,-plaza.transverse.z*p.side);
   const yaw=Math.atan2(facing.x,facing.z);
   try{
    const person={bodyType:p.type,x,z,y:plaza.level,yaw,scale:1};
    // Plaza bench cushion surface is ~0.615m; hips sit just above it.
    const figure=riggedVisitor(THREE,asset,person,{seated:true,seatHipHeight:.68});
    const local=new THREE.Vector3(0,0,p.forward).applyAxisAngle(new THREE.Vector3(0,1,0),yaw);
    figure.position.add(local);
    group.add(figure);
   }catch(error){console.warn('Plaza seated visitor unavailable',p.type,error);}
  }
 });
 return group;
}
