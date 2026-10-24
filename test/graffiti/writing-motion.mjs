// Shared writing rhythm for paint deposition and playback. Distances are in
// letter coordinates; durations are seconds before the player's display scale.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function hash(text){let n=2166136261;for(const c of text){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;}
export function writerIdentity(hand,profile){
 const variants=Object.fromEntries([... 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789φ.!?-'].map(c=>[c,hash(hand+'|letter|'+c)%3]));
 return {id:hand,variants,nib:profile.angle+((hash(hand+'|nib')%1000)/999-.5)*.05,
  pace:.88+(hash(hand+'|pace')%1000)/999*.24,
  accent:['none','dots','none','dash','none','quotes'][hash(hand+'|accent')%6]};
}
function unitVector(x,y){const d=Math.hypot(x,y)||1;return {x:x/d,y:y/d};}
export function connectingStroke(from,to,{unit=5,force=false}={}){
 const a=from.points.at(-1),b=to.points[0],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
 if(d<1e-7)return [{...a}];
 if(!force&&(dx<-unit*1.5||d>unit*13))return null;
 const before=from.points.at(-2)||a,after=to.points[1]||b;
 const exit=unitVector(a.x-before.x,a.y-before.y),entry=unitVector(after.x-b.x,after.y-b.y),handle=Math.min(d/3,unit*3);
 const minX=Math.min(a.x,b.x),maxX=Math.max(a.x,b.x),minY=Math.min(a.y,b.y)-unit,maxY=Math.max(a.y,b.y)+unit;
 const c={x:clamp(a.x+exit.x*handle,minX,maxX),y:clamp(a.y+exit.y*handle,minY,maxY)};
 const e={x:clamp(b.x-entry.x*handle,minX,maxX),y:clamp(b.y-entry.y*handle,minY,maxY)};
 const n=Math.max(3,Math.ceil(d/2)),points=[];
 for(let i=0;i<=n;i++){const t=i/n,s=1-t;points.push({x:s**3*a.x+3*s*s*t*c.x+3*s*t*t*e.x+t**3*b.x,y:s**3*a.y+3*s*s*t*c.y+3*s*t*t*e.y+t**3*b.y});}
 points[0]={...a};points[n]={...b};return points;
}
export function orientConnection(from,to,{lockFrom=false}={}){
 // Reversing an open movement preserves its letter shape. Pick the shortest
 // of the four real endpoint pairs before attempting a connecting stroke.
 const left=from.points,right=to.points;
 let best=null;
 for(const reverseFrom of lockFrom?[false]:[false,true])for(const reverseTo of [false,true]){
  const a=reverseFrom?left[0]:left.at(-1),b=reverseTo?right.at(-1):right[0];
  const score=Math.hypot(b.x-a.x,b.y-a.y)+Math.max(0,a.x-b.x)*2;
  if(!best||score<best.score)best={score,reverseFrom,reverseTo};
 }
 if(best.reverseFrom)from.points=left.slice().reverse();if(best.reverseTo)to.points=right.slice().reverse();
}
export function connectionClear(points,movements,unit=5){
 const start=points[0],end=points.at(-1);
 for(let i=1;i<points.length;i++){
  const p=points[i-1],q=points[i],dx=q.x-p.x,dy=q.y-p.y;
  for(const movement of movements)for(let j=1;j<movement.points.length;j++){
   const a=movement.points[j-1],b=movement.points[j],ex=b.x-a.x,ey=b.y-a.y,den=dx*ey-dy*ex;
   if(Math.abs(den)<1e-8)continue;
   const t=((a.x-p.x)*ey-(a.y-p.y)*ex)/den,v=((a.x-p.x)*dy-(a.y-p.y)*dx)/den;
   if(t<=0||t>=1||v<=0||v>=1)continue;
   const x=p.x+t*dx,y=p.y+t*dy;
   if(Math.hypot(x-start.x,y-start.y)>unit*.75&&Math.hypot(x-end.x,y-end.y)>unit*.75)return false;
  }
 }
 return true;
}
export function planWritingMotion(strokes,{pace=1}={}){
 const planned=[];let clock=0,previous=null,totalLength=0;
 for(const stroke of strokes){
  const ps=stroke.points,distances=[0];
  for(let i=1;i<ps.length;i++)distances.push(distances.at(-1)+Math.hypot(ps[i].x-ps[i-1].x,ps[i].y-ps[i-1].y));
  const length=distances.at(-1),speeds=[];
  let left=0,right=0;
  for(let i=0;i<ps.length;i++){
   while(left<i&&distances[left]<distances[i]-7)left++;
   right=Math.max(right,i);while(right<ps.length-1&&distances[right]<distances[i]+7)right++;
   const a=ps[left],b=ps[i],c=ps[right],d1=Math.hypot(b.x-a.x,b.y-a.y),d2=Math.hypot(c.x-b.x,c.y-b.y);
   const angle=d1&&d2?Math.acos(clamp(((b.x-a.x)*(c.x-b.x)+(b.y-a.y)*(c.y-b.y))/(d1*d2),-1,1))/Math.PI:0;
   const endEase=1-Math.min(1,distances[i]/9,(length-distances[i])/9);
   speeds.push(clamp(.96-angle*.7-endEase*.22,.27,.98));
  }
  const times=[0],nominal=280*pace*(stroke.kind==='flourish'?1.12:1);
  for(let i=1;i<ps.length;i++)times.push(times.at(-1)+(distances[i]-distances[i-1])/(nominal*(speeds[i]+speeds[i-1])*.5));
  const travel=previous?Math.hypot(ps[0].x-previous.x,ps[0].y-previous.y):0;
  const pause=travel>.05?.035+Math.min(.14,travel/900):0;clock+=pause;
  const duration=times.at(-1)||.004;
  planned.push({start:clock,duration,times,speeds,distances,length,pause});clock+=duration;totalLength+=length;previous=ps.at(-1);
 }
 return {strokes:planned,duration:clock,length:totalLength};
}
export function tagDuration(tag){return tag.motion?.duration??tag.strokes.reduce((n,s)=>n+s.points.length,0);}
export function strokeFraction(tag,index,progress){
 const stroke=tag.strokes[index],motion=tag.motion?.strokes[index];
 if(!motion){const before=tag.strokes.slice(0,index).reduce((n,s)=>n+s.points.length,0);return clamp((tagDuration(tag)*progress-before)/stroke.points.length,0,1);}
 const time=tagDuration(tag)*clamp(progress,0,1)-motion.start;
 if(time<=0)return 0;if(time>=motion.duration)return 1;
 let lo=0,hi=motion.times.length-1;
 while(lo+1<hi){const mid=(lo+hi)>>1;if(motion.times[mid]<=time)lo=mid;else hi=mid;}
 const f=(time-motion.times[lo])/Math.max(1e-9,motion.times[hi]-motion.times[lo]);
 return (lo+f)/(stroke.points.length-1);
}
