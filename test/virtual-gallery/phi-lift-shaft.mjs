// Shaft enclosure follows each floor's actual rotated exit. No continuous
// square corner posts are allowed to cross a landing's walking aperture.
import {PHI} from './phi-architecture.mjs';
export function planPhiLiftShaft(count,spacing=6.2){
 const radius=2.03,segments=32,halfOpening=.80,panels=[],openings=[];
 for(let level=0;level<count;level++){
  const angle=-level*2*Math.PI/(PHI*PHI),base=level*spacing;
  openings.push({level,angle,halfAngle:halfOpening,y:base,width:2*radius*Math.sin(halfOpening)});
  for(let i=0;i<segments;i++){
   const a=i*2*Math.PI/segments,b=(i+1)*2*Math.PI/segments,mid=(a+b)/2;
   const within=Math.abs(Math.atan2(Math.sin(mid-angle),Math.cos(mid-angle)))<halfOpening;
   const start={x:radius*Math.cos(a),z:radius*Math.sin(a)},end={x:radius*Math.cos(b),z:radius*Math.sin(b)};
   if(!within)panels.push({a:start,b:end,y0:base,y1:base+3.25,level,landing:true});
   panels.push({a:start,b:end,y0:base+3.25,y1:base+spacing,level,landing:false});
  }
 }
 return {radius,panels,openings};
}
