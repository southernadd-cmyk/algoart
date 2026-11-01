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
