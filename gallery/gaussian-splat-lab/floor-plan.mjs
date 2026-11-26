// A global density cap treats every eligible face equally, independent of the visitor.
export function planFloorSamples(faces,requestedDensity,budget){
 if(!Number.isFinite(requestedDensity)||requestedDensity<=0||!Number.isSafeInteger(budget)||budget<=0)throw Error('Invalid floor sampling budget');
 if(!faces.length)throw Error('No eligible static architecture');
 const at=density=>faces.map(face=>({face,px:Math.min(512,Math.max(4,Math.ceil(face.width*density))),py:Math.min(512,Math.max(4,Math.ceil(face.height*density)))}));
 const count=items=>items.reduce((sum,{px,py})=>sum+px*py,0);
 let density=requestedDensity,items=at(density);
 if(count(items)>budget){
  if(count(at(0))>budget)throw Error('Floor exceeds minimum complete coverage budget');
  let lo=0,hi=density;
  for(let i=0;i<24;i++){const mid=(lo+hi)/2;if(count(at(mid))<=budget)lo=mid;else hi=mid;}
  density=lo;items=at(density);
 }
 return {items,requestedDensity,effectiveDensity:density,total:count(items),area:faces.reduce((sum,f)=>sum+f.width*f.height,0)};
}
