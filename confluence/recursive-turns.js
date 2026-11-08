// Confluence-only: one Recursive Divisions cell may contain an entire
// rectangle (and several further marks). Divide its *existing* recorded
// geometry into chronological ink gestures. No new shapes are generated,
// no marks are duplicated, and the solo renderer remains unchanged.
const EPS=1e-7;
const length=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y);
function routeLength(points){
  let n=0;
  for(let i=1;i<points.length;i++)n+=length(points[i-1],points[i]);
  return n;
}
function atDistance(points,d){
  if(points.length<2)return points[0];
  let travelled=0;
  for(let i=1;i<points.length;i++){
    const span=length(points[i-1],points[i]);
    if(travelled+span>=d-EPS||i===points.length-1){
      const t=span?Math.max(0,Math.min(1,(d-travelled)/span)):0;
      return {x:points[i-1].x+(points[i].x-points[i-1].x)*t,
        y:points[i-1].y+(points[i].y-points[i-1].y)*t};
    }
    travelled+=span;
  }
  return points.at(-1);
}
export function sliceStroke(points,from,to){
  if(points.length<2)return points.slice();
  const total=routeLength(points);
  if(total<EPS)return points.slice(0,2);
  const start=Math.max(0,Math.min(total,from*total));
  const end=Math.max(start,Math.min(total,to*total));
  const result=[atDistance(points,start)];
  let soFar=0;
  for(let i=1;i<points.length-1;i++){
    soFar+=length(points[i-1],points[i]);
    if(soFar>start+EPS&&soFar<end-EPS)result.push(points[i]);
  }
  result.push(atDistance(points,end));
  return result;
}
function commandsFor(points){
  return points.map((p,i)=>({type:i?'L':'M',points:[p]}));
}
function geometryFor(points){
  return points.map((p,i)=>(i?'L ':'M ')+p.x.toFixed(5)+' '+p.y.toFixed(5)).join(' ');
}
function groupPiece(source,trace,entries,number,parts,sampler){
  const begin=number/parts,end=(number+1)/parts;
  const points=sliceStroke(trace.points,begin,end);
  const paths=entries.map(({path,commands})=>{
    const segment=sliceStroke(sampler(commands),begin,end);
    const next={...path,d:geometryFor(segment)};
    // These fields were intentionally non-enumerable on recorder paths.
    for(const key of ['mark','pass','passes','kind','group'])next[key]=path[key];
    return {path:next,commands:commandsFor(segment)};
  });
  const probes=points.map((p,i)=>({p,next:points[i+1]||points[i-1]||p}));
  const stride=Math.max(1,Math.ceil(probes.length/26));
  const center=points.reduce((v,p)=>({x:v.x+p.x/points.length,
    y:v.y+p.y/points.length}),{x:0,y:0});
  return {...source,id:source.id+'/gesture-'+trace.mark+'-'+(number+1),
    label:source.label+' · stroke '+(number+1)+'/'+parts,
    paths,traces:[{...trace,points}],
    probes:probes.filter((_,i)=>i%stride===0),center,
    fragmentParent:source.id,fragmentNumber:number,fragmentTotal:parts};
}

// Preserve original cell sequence but let a study develop across all cells
// instead of using its first 55 turns on a single oversized rectangle.
// A 56-gesture target permits 55 Fibonacci turns even for sparse source
// compositions. Smaller strokes must still be split without creating ink.
export function expandRecursiveTurns(groups,sampler,target=56){
  if(groups.length>=target||!groups.length)return groups;
  const desired=Math.max(1,Math.ceil(target/groups.length));
  const expanded=groups.map(group=>{
    const sources=group.traces.filter(trace=>trace.points.length>=2&&
      routeLength(trace.points)>EPS);
    if(!sources.length)return [group];
    const portions=new Map(sources.map(trace=>[trace.mark,1]));
    let missing=Math.max(0,desired-sources.length);
    while(missing>0){
      let chosen=null,score=0;
      for(const trace of sources){
        const have=portions.get(trace.mark);
        // Split the longest remaining piece. A fixed 8px minimum used to
        // suppress subdivision altogether at low Elements settings, causing
        // the whole study to collapse from 55 to 8 turns. Even a short source
        // segment can be drawn progressively; it is NEVER repeated or
        // geometrically extended. Original stroke coverage stays unchanged.
        const available=routeLength(trace.points)/(have+1);
        if(available>score&&available>EPS){chosen=trace;score=available}
      }
      if(!chosen)break;
      portions.set(chosen.mark,portions.get(chosen.mark)+1);
      missing--;
    }
    const fragments=[];
    for(const trace of sources){
      const paths=group.paths.filter(entry=>entry.path.mark===trace.mark);
      if(!paths.length)continue;
      const count=portions.get(trace.mark);
      for(let part=0;part<count;part++)
        fragments.push(groupPiece(group,trace,paths,part,count,sampler));
    }
    return fragments.length?fragments:[group];
  });
  // Round-robin cell development: every actual cell begins contributing
  // before the first cell can monopolise dozens of successive turns.
  const result=[];
  const rows=Math.max(...expanded.map(items=>items.length));
  for(let row=0;row<rows;row++)
    for(const items of expanded)if(items[row])result.push(items[row]);
  return result;
}
