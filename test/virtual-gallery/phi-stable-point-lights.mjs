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
  rebalances:0,stable:true,zeroIntensity:true,shadowCastingSpares:0};
 function sync(){
  if(!enabled)return {...stats};
  const real=countVisibleRealPhiPointLights(scene,spares);
  const count=Math.max(0,target-real);
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
   shadowCastingSpares:0,rebalances:stats.rebalances+1});
  return {...stats};
 }
 return {spares,stats,sync};
}
