// Correct the original lzyassoul male model's torso skin weights before
// applying relaxed arm rotations. In the source GLB, central chest/waist
// vertices have up to ~60% influence from arm bones, which caves the waist in
// when the arms move down. This edits no positions, binds, or female geometry.
// The testable geometry helper is separate from the gallery and runs once
// on the single shared GLTF asset before any SkeletonUtils clones are made.
export function stabiliseMaleTorsoSkinning(scene){
 let mesh=null;
 scene.traverse(node=>{if(node.isSkinnedMesh&&node.name==='Object_7')mesh=node;});
 if(!mesh)return {repaired:0,reason:'male skin mesh not found'};
 const geometry=mesh.geometry, bones=mesh.skeleton?.bones || [];
 const positions=geometry?.getAttribute('position');
 const joints=geometry?.getAttribute('skinIndex');
 const weights=geometry?.getAttribute('skinWeight');
 if(!positions||!joints||!weights||!bones.length)
   return {repaired:0,reason:'required skin attributes absent'};
 if(geometry.userData.galleryTorsoSkinRepaired)
   return {repaired:geometry.userData.galleryTorsoSkinRepaired,cached:true};
 const armIndices=new Set(bones.map((bone,index)=>
   /^(?:upper_arm|forearm)\.[LR]_\d+$/.test(bone.name)?index:-1).filter(index=>index>=0));
 const spineIndices=['spine_','spine.001_','spine.002_','spine.003_']
   .map(prefix=>bones.findIndex(bone=>bone.name.startsWith(prefix)));
 if(armIndices.size!==4||spineIndices.some(i=>i<0))
   return {repaired:0,reason:'known source bone names did not match'};
 geometry.computeBoundingBox();
 const centreX=(geometry.boundingBox.min.x+geometry.boundingBox.max.x)/2;
 const clamp=x=>Math.max(0,Math.min(1,x));
 let repaired=0;
 for(let vertex=0;vertex<positions.count;vertex++){
   const y=positions.getY(vertex);
   const x=Math.abs(positions.getX(vertex)-centreX);
   // Restrict changes to the central torso and blend to zero before the
   // shoulder and outer sleeve, preserving arm articulation and silhouette.
   // The original mask only protected the centre 0.49m of the torso.
   // The male chest extends farther laterally; those uncorrected weights
   // still collapse when the shoulders rotate from the source T-pose.
   // Blend out before the actual arm mesh, rather than at the ribcage edge.
   // Measured directly from the source GLB: the torso extends to about
   // 0.55m from the character centre at y=2.0-2.5, while arm vertices
   // dominate outside ~0.75m. The previous cutoff of 0.47m fully
   // protected only the innermost chest, producing an artificial pinch.
   // Keep the whole central trunk anchored to spine and blend the shoulder
   // sleeve influence in the 0.56-0.80m transition zone.
   const protect=clamp((.80-x)/.24)*
     clamp((y-1.54)/.20)*clamp((3.02-y)/.22);
   if(protect<.001)continue;
   const spine=spineIndices[y<1.86?0:y<2.19?1:y<2.45?2:3];
   const influences=new Map();
   let transferred=0;
   for(let slot=0;slot<4;slot++){
     const joint=joints.getComponent(vertex,slot);
     const weight=weights.getComponent(vertex,slot);
     if(weight<=0)continue;
     if(armIndices.has(joint)){
       const removed=weight*protect;
       transferred+=removed;
       influences.set(joint,(influences.get(joint)||0)+weight-removed);
       influences.set(spine,(influences.get(spine)||0)+removed);
     }else influences.set(joint,(influences.get(joint)||0)+weight);
   }
   if(transferred<.001)continue;
   const top=[...influences.entries()].filter(([,w])=>w>0)
     .sort((a,b)=>b[1]-a[1]).slice(0,4);
   const sum=top.reduce((value,[,weight])=>value+weight,0);
   if(sum<=0)continue;
   for(let slot=0;slot<4;slot++){
     joints.setComponent(vertex,slot,top[slot]?.[0]??0);
     weights.setComponent(vertex,slot,(top[slot]?.[1]??0)/sum);
   }
   repaired++;
 }
 joints.needsUpdate=true;
 weights.needsUpdate=true;
 geometry.userData.galleryTorsoSkinRepaired=repaired;
 return {repaired};
}
