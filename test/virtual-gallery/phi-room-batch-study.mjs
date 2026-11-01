import {batchPhiPaintingFrames} from './phi-painting-frame-batch.mjs';
import {batchPhiPaintingCaptions} from './phi-caption-batch.mjs';
import {batchPhiStaticArchitecture} from './phi-static-architecture.mjs';

// TEST ONLY. Room roots start at identity in the planner's floor-local space.
// After they are added to the scene, the EXISTING golden-angle floor transform
// rotates each root exactly as it rotates every other constructed object.
//
// Keep common walls, portals, lighting and bridges out of the room roots.
// Only a valid merged-room owner is eligible; ambiguous art remains separate.
export function createPhiRoomBatchStudy(THREE,scene,roomCount,{enabled=false}={}){
 const groups=Array.from({length:roomCount},(_,i)=>{
  const root=new THREE.Group();
  root.name='phi-room-batch-'+i;
  return root;
 });
 const buckets=groups.map(()=>({exhibits:[],architecture:[]}));
 let moved=0,architecturalMerges=0,architecturalDrawCallsSaved=0,late=0;
 const valid=i=>Number.isInteger(i)&&i>=0&&i<groups.length;
 const take=(room,object,{architecture=false}={})=>{
  if(!enabled||!valid(room)||!object)return false;
  if(architecture)buckets[room].architecture.push(object);
  else buckets[room].exhibits.push(object);
  return true;
 };
 const finish=()=>{
  if(!enabled)return {active:false,rooms:0,moved:0,architecturalMerges:0,architecturalDrawCallsSaved:0};
  for(let i=0;i<groups.length;i++){
   const group=groups[i],{exhibits,architecture}=buckets[i];
   for(const object of [...architecture,...exhibits]){
    // Do not transfer an object out of another container/installation.
    if(object?.parent!==scene)continue;
    group.add(object);
    moved++;
   }
   if(architecture.length){
    const result=batchPhiStaticArchitecture(THREE,group,architecture);
    architecturalMerges+=result.batches;
    architecturalDrawCallsSaved+=result.savedDrawCalls;
   }
   if(group.children.length)scene.add(group);
  }
  return snapshot();
 };
 const attachLate=(room,object)=>{
  if(!enabled||!valid(room)||!object||!groups[room].parent||!object.parent)return false;
  // Deferred sculpture positions are already in final world coordinates.
  // attach() preserves the world transform when the room root has rotated.
  groups[room].attach(object);late++;
  return true;
 };
 const snapshot=()=>({active:enabled,rooms:groups.filter(g=>!!g.parent).length,
  moved,architecturalMerges,architecturalDrawCallsSaved,late,
  members:groups.map((root,room)=>({room,count:root.children.length,attached:!!root.parent}))});
 return {take,finish,attachLate,group:i=>valid(i)?groups[i]:null,snapshot};
}

// The atlas and instancing algorithms are unchanged. Splitting ONLY by real
// room owner means the same pixels and shader coordinates remain in use.
export function packPhiRoomPaintingGroups(THREE,scene,study,{
 frames=[],captions=[],maxTextureSize=4096,frameBatchEnabled=true,
 captionBatchEnabled=true,createFrameMaterial
}={}){
 const rooms=new Set([...frames,...captions].map(p=>p.room).filter(Number.isInteger));
 const stats={frame:{original:frames.length,batched:0,savedDrawCalls:0},
  caption:{original:captions.length,batched:0,drawCallsSaved:0},
  rooms:rooms.size};
 for(const room of rooms){
  for(const [name,items,enabled,call] of [
   ['frame',frames.filter(x=>x.room===room),frameBatchEnabled,
    list=>batchPhiPaintingFrames(THREE,scene,list,{createMaterial:createFrameMaterial})],
   ['caption',captions.filter(x=>x.room===room),captionBatchEnabled,
    list=>batchPhiPaintingCaptions(THREE,scene,list,{maxTextureSize})]
  ]){
   if(!items.length)continue;
   const candidates=items.map(x=>x.mesh);
   let outputs=candidates,part={active:false};
   if(enabled&&candidates.length>=2){
    const before=new Set(scene.children);
    part=call(candidates);
    if(part.active){
     outputs=scene.children.filter(obj=>!before.has(obj));
     if(outputs.length!==part.batched){
      throw new Error('Room '+room+' '+name+' batch count mismatch');
     }
    }
   }
   outputs.forEach(mesh=>study.take(room,mesh));
   stats[name].batched+=outputs.length;
   if(name==='frame')stats[name].savedDrawCalls+=part.active?(part.savedDrawCalls||0):0;
   else stats[name].drawCallsSaved+=part.active?(part.drawCallsSaved||0):0;
  }
 }
 return stats;
}
