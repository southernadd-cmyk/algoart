// TEST-only bounded light-selection policy. Light objects are kept alive
// independently of destination floors, so lighting shader counts stay stable.
// Selection moves real lights among the original phi-planned room anchors.
export const PHI_ROOM_POOL_SIZE=3;
export const PHI_ART_POOL_SIZE=3;

export function chooseNearestPhiRoomAnchors(candidates,viewer,count=PHI_ROOM_POOL_SIZE){
 if(!Number.isInteger(count)||count<0)throw RangeError('Invalid room light pool size');
 if(!Array.isArray(candidates)||!viewer)return [];
 return candidates.map((candidate,index)=>{
  const p=candidate.position;
  const dx=p.x-viewer.x,dz=p.z-viewer.z;
  return {candidate,index,distance:dx*dx+dz*dz};
 }).sort((a,b)=>a.distance-b.distance||a.index-b.index)
  .slice(0,count).map(x=>x.candidate);
}
