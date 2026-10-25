// Golden-section placement within the usable wall area, after allowing for
// the full rotated paint bounds. Values remain stable for an exhibition seed.
import {PHI} from './layout-v2.mjs';
export const goldenFraction=index=>((index+1)/PHI)%1;
export function tagAngle(slot,phase=0){
 return (slot%2?-1:1)*3*PHI**(1+(slot+phase)%4)*Math.PI/180;
}
export function fitPhiTag({bounds,desiredWidth,maxHeight,lo,hi,bottom,top,slot,phase=0}){
 const aspect=bounds.width/bounds.height,rotation=tagAngle(slot,phase),c=Math.abs(Math.cos(rotation)),s=Math.abs(Math.sin(rotation));
 let width=Math.min(desiredWidth,hi-lo,maxHeight*aspect),height=width/aspect;
 const fit=Math.min(1,(hi-lo)/(width*c+height*s),(top-bottom)/(height*c+width*s));
 width*=fit;height*=fit;
 const halfAlong=(width*c+height*s)/2,halfUp=(height*c+width*s)/2;
 const uFraction=goldenFraction(slot+phase),vFraction=goldenFraction(slot*2+phase);
 return {width,height,rotation,halfAlong,halfUp,
  u:lo+halfAlong+Math.max(0,hi-lo-halfAlong*2)*uFraction,
  centreY:bottom+halfUp+Math.max(0,top-bottom-halfUp*2)*vFraction,
  phi:{uFraction,vFraction,uIndex:slot+phase,vIndex:slot*2+phase}};
}
