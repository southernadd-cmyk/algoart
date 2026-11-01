// Pure positional selection for the test-tower visitor chat toolbar.
// No range cap: the toolbar can start a remote conversation with the
// nearest real visitor even when no proximity prompt is displayed.
// The vertical guard prevents choosing visitors on another floor.
export function nearestVisitorOnFloor(speakers,position,{heightTolerance=2.5}={}){
 if(!position||!Array.isArray(speakers))return null;
 const {x,y,z}=position;
 if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z))return null;
 let nearest=null,bestDistanceSquared=Infinity;
 for(const person of speakers){
  if(!person||!Number.isFinite(person.x)||!Number.isFinite(person.y)||
     !Number.isFinite(person.z)||Math.abs(person.y-y)>heightTolerance)continue;
  const dx=person.x-x,dz=person.z-z,distanceSquared=dx*dx+dz*dz;
  if(distanceSquared<bestDistanceSquared){
   bestDistanceSquared=distanceSquared;
   nearest=person;
  }
 }
 return nearest;
}
