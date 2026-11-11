// V3 sculpture finishing: deterministic contour smoothing and geometric sampling.
// Coordinates here are pixel-space, never guessed pigment-region centroids.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
export function smoothClosedContour(source,{passes=3,spacing=2.4,maxPoints=92}={}){
  if(!Array.isArray(source)||source.length<3)return [];
  let points=source.map(([x,y])=>[x,y]).filter(p=>p.every(Number.isFinite));
  if(points.length>3&&dist(points[0],points.at(-1))<1e-9)points.pop();
  if(points.length<3)return [];
  const count=points.length;
  // Circular Gaussian filtering removes pixel staircase, preserving the
  // original location to within a small fraction of one source pixel.
  for(let pass=0;pass<passes;pass++){
    points=points.map((p,i)=>{
      const a=points[(i+count-1)%count],b=points[(i+1)%count];
      return [p[0]*.6+.2*(a[0]+b[0]),p[1]*.6+.2*(a[1]+b[1])];
    });
  }
  const arc=[0];let total=0;
  for(let i=0;i<count;i++){
    total+=dist(points[i],points[(i+1)%count]);
    arc.push(total);
  }
  const samples=clamp(Math.ceil(total/spacing),Math.min(10,count),maxPoints);
  const result=[];let k=0;
  for(let i=0;i<samples;i++){
    const d=total*i/samples;
    while(k<count-1&&arc[k+1]<d)k++;
    const a=points[k],b=points[(k+1)%count];
    const u=clamp((d-arc[k])/Math.max(1e-8,arc[k+1]-arc[k]),0,1);
    result.push([a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u]);
  }
  result.push([...result[0]]);
  return result;
}
export function interpolatePath(points,t){
  if(!points?.length)return {x:0,y:0};
  const p=clamp(t,0,1)*(points.length-1),i=Math.min(points.length-2,Math.floor(p));
  const u=p-i,a=points[i],b=points[i+1];
  return {x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u};
}
export function selectBalancedMarks(input,budget=48){
  const ranked=[...input].filter(s=>s?.points?.length>=2);
  ranked.sort((a,b)=>(b.score||b.weight||b.length||0)-(a.score||a.weight||a.length||0));
  if(ranked.length<=budget)return ranked;
  const selected=[],seen=new Set();
  // One pass favours strong source silhouettes spread over the composition.
  for(const s of ranked){
    const p=s.points[Math.floor(s.points.length/2)];
    const zone=Math.floor((p.x+.67)/(.335))+
      4*Math.floor((p.y+.94)/(.376));
    if(seen.has(zone))continue;
    seen.add(zone);selected.push(s);
    if(selected.length>=Math.ceil(budget*.4))break;
  }
  const chosen=new Set(selected);
  for(const s of ranked){
    if(selected.length>=budget)break;
    if(!chosen.has(s)){chosen.add(s);selected.push(s);}
  }
  return selected;
}
