// Test-only point-light shader stability study.
// Three.js specialises lit material shaders by the number of visible lights.
// When the old reception is released, fill the missing point-light slots with
// zero-intensity, non-shadow-casting point lights, preserving all real lighting.
export const PHI_STABLE_POINT_COUNT=7;

export function countVisibleRealPhiPointLights(scene,spares=[]){
 const spareSet=new Set(spares);
 let count=0;
 const visit=(object,parentsVisible)=>{
  const visible=parentsVisible&&object.visible!==false;
  if(!visible)return;
  if(object.isPointLight&&!spareSet.has(object))count++;
  for(const child of object.children||[])visit(child,visible);
 };
 visit(scene,true);
 return count;
}

export function createPhiStablePointLightPool({THREE,scene,enabled=false,target=PHI_STABLE_POINT_COUNT}={}){
 if(!Number.isInteger(target)||target<0)throw new RangeError('Stable point light count must be a nonnegative integer');
 if(!THREE?.PointLight||!scene?.add||!scene?.remove)throw new TypeError('Three.js and scene are required');
 const spares=enabled?Array.from({length:target},(_,i)=>{
  const light=new THREE.PointLight(0xffffff,0,0,2);
  light.name='phi-zero-point-light-spare-'+i;
  light.castShadow=false;
  light.visible=true;
  light.intensity=0;
  return light;
 }):[];
 const stats={enabled,target,real:0,spares:0,total:0,overCapacity:0,
  rebalances:0,stable:true,zeroIntensity:true,shadowCastingSpares:0,
  peakReal:0,peakTotal:0,overCapacityEvents:0,lightChanges:[]};
 function sync(reason='boundary'){
  if(!enabled)return {...stats};
  const real=countVisibleRealPhiPointLights(scene,spares);
  const count=Math.max(0,target-real);
  const observed=real+spares.filter(light=>light.parent===scene).length;
  if(real!==stats.real||count!==stats.spares||real>target){
   // Keep a compact record of *when* a new real light appeared. This is
   // more meaningful than the final-state snapshot in the previous export.
   stats.lightChanges.push({reason,real,spares:count,before:observed,
     after:real+count,overCapacity:Math.max(0,real-target)});
   if(stats.lightChanges.length>24)stats.lightChanges.shift();
  }
  if(real>target)stats.overCapacityEvents++;
  for(let i=0;i<spares.length;i++){
   const light=spares[i],needed=i<count;
   // A blank spare is always present in the light list but contributes no
   // illumination and does not cast or receive any shadow maps.
   light.intensity=0;
   light.castShadow=false;
   light.visible=true;
   if(needed&&light.parent!==scene){light.parent?.remove(light);scene.add(light);}
   else if(!needed&&light.parent===scene)scene.remove(light);
  }
  Object.assign(stats,{real,spares:count,total:real+count,
   overCapacity:Math.max(0,real-target),stable:real<=target,
   peakReal:Math.max(stats.peakReal,real),
   peakTotal:Math.max(stats.peakTotal,real+count),
   shadowCastingSpares:0,rebalances:stats.rebalances+1});
  return {...stats};
 }
 return {spares,stats,sync};
}
