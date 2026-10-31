export const PHI=(1+Math.sqrt(5))/2;
export const POOL_COMPOSITION=Object.freeze({x:3,z:18,width:7.4,depth:7.4/PHI});
export function planPoolSculptures({doorway,outward}){
 const transverse={x:outward.z,z:-outward.x};
 const pool=POOL_COMPOSITION,goldenAngle=Math.PI*(3-Math.sqrt(5));
 // Place the pair on the entrance side of the pool, away from the central route.
 const start=Math.PI+Math.PI/PHI**5;
 return [pool.width,pool.width*PHI].map((radius,i)=>{
  const angle=start+i*goldenAngle;
  const local={x:pool.x+radius*Math.cos(angle),z:pool.z+radius*Math.sin(angle)};
  const x=doorway.x+transverse.x*local.x+outward.x*local.z;
  const z=doorway.z+transverse.z*local.x+outward.z*local.z;
  const poolX=doorway.x+transverse.x*pool.x+outward.x*pool.z;
  const poolZ=doorway.z+transverse.z*pool.x+outward.z*pool.z;
  return {x,z,yaw:Math.atan2(poolX-x,poolZ-z),radius,angle,local};
 });
}
