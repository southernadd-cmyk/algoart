// Geometry transforms for the exact M/L/C path syntax used by marker.js.
// The recorded paths include hand wobble, curvature, pass order, stroke width,
// dashes, colours and phi sheet transforms. This module invents no new drawing.
const NUM=/[-+]?(?:\d*\.?\d+)(?:[eE][-+]?\d+)?/g;
const TOK=/[MLC]|[-+]?(?:\d*\.?\d+)(?:[eE][-+]?\d+)?/gi;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function matrixFromPath(path){
  const a=String(path.transform||'').match(NUM)?.map(Number);
  return a?.length===6?a:null;
}
function transform(point,m){
  return m?{x:m[0]*point.x+m[2]*point.y+m[4],y:m[1]*point.x+m[3]*point.y+m[5]}:point;
}
export function traceRecordedPath(path,maxPoints=320){
  const t=String(path.d||'').match(TOK)||[];
  const points=[];
  let p=null,i=0,command=null;
  const matrix=matrixFromPath(path);
  function read(){
    const x=Number(t[i++]),y=Number(t[i++]);
    if(!Number.isFinite(x)||!Number.isFinite(y))throw Error('Invalid source geometry');
    return{x,y};
  }
  while(i<t.length && points.length<maxPoints){
    if(/^[MLC]$/i.test(t[i])){command=t[i++].toUpperCase();continue;}
    if(command==='M'||command==='L'){
      p=read();points.push(transform(p,matrix));command='L';
    }else if(command==='C'){
      if(!p)break;
      const a=read(),b=read(),e=read(),start=p;
      // Curvature is sampled from the *actual* cubic, never fabricated paths.
      const magnitude=Math.hypot(e.x-start.x,e.y-start.y)+
        Math.hypot(a.x-start.x,a.y-start.y)+Math.hypot(e.x-b.x,e.y-b.y);
      const steps=clamp(Math.ceil(magnitude/15),5,24);
      for(let j=1;j<=steps && points.length<maxPoints;j++){
        const u=j/steps,v=1-u;
        points.push(transform({
          x:v*v*v*start.x+3*v*v*u*a.x+3*v*u*u*b.x+u*u*u*e.x,
          y:v*v*v*start.y+3*v*v*u*a.y+3*v*u*u*b.y+u*u*u*e.y
        },matrix));
      }
      p=e;
    }else throw Error('Unsupported source SVG path segment '+command);
  }
  return points.filter((v,i,a)=>i===0||Math.hypot(v.x-a[i-1].x,v.y-a[i-1].y)>.00001);
}
function polyLength(p){let d=0;for(let i=1;i<p.length;i++)d+=Math.hypot(p[i].x-p[i-1].x,p[i].y-p[i-1].y);return d;}
export function selectRecordedPaths(source,quality='desktop'){
  const limit={desktop:190,mobile:80,vr:110}[quality]||190;
  const raw=(source.paths||[]).map((stroke,i)=>{
    const points=traceRecordedPath(stroke,500);
    const width=Number(stroke.width)||1;
    const alpha=Number(stroke.opacity)||.45;
    const length=polyLength(points);
    return {i,points,width,opacity:alpha,stroke:stroke.stroke||'#272720',
      dash:stroke.dash||[],dashOffset:stroke.dashOffset||0,
      length,score:length*Math.sqrt(Math.max(.2,width))*Math.max(.20,alpha)};
  }).filter(p=>p.points.length>1&&p.length>3);
  // Keep representative strokes distributed through source draw order as well
  // as the visually substantial ones; this reduces overdraw without
  // selecting unrelated paths or losing small late marks.
  if(raw.length<=limit)return raw;
  const ranking=[...raw].sort((a,b)=>b.score-a.score||a.i-b.i);
  const keep=new Set(ranking.slice(0,Math.round(limit*.72)).map(p=>p.i));
  const interval=(raw.length-1)/Math.max(1,limit-keep.size);
  for(let j=0;j<limit-keep.size;j++)keep.add(raw[Math.min(raw.length-1,Math.round(j*interval))].i);
  return raw.filter(p=>keep.has(p.i)).slice(0,limit);
}
export function strokeSections(stroke,widthPx=stroke.width){
  // Segment long paths before extrusion: avoids invalid self-intersecting
  // extrusion polygons at spiral crossings while retaining their true route.
  // Interpolate along the real path; never substitute a procedural curve.
  const points=stroke.points;
  const chunks=[];
  for(let start=0;start<points.length-1;start+=14){
    const end=Math.min(points.length-1,start+14);
    const slice=points.slice(start,end+1);
    if(polyLength(slice)>=.2)chunks.push(slice);
  }
  return chunks;
}
export function strokeOutline(points,width){
  if(points.length<2||width<=0)return [];
  const half=width/2,left=[],right=[];
  const normal=(a,b)=>{
    const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;
    return{x:-dy/len,y:dx/len};
  };
  for(let i=0;i<points.length;i++){
    const before=normal(points[Math.max(0,i-1)],points[Math.min(points.length-1,i)]);
    const after=normal(points[Math.max(0,i)],points[Math.min(points.length-1,i+1)]);
    let nx=before.x+after.x,ny=before.y+after.y;
    if(i===0){nx=after.x;ny=after.y;}
    if(i===points.length-1){nx=before.x;ny=before.y;}
    const size=Math.hypot(nx,ny)||1;nx/=size;ny/=size;
    // Cap joins to avoid long triangular spikes on tight bends.
    const miter=clamp(1/Math.max(.36,Math.abs(nx*after.x+ny*after.y)),1,1.65);
    left.push({x:points[i].x+nx*half*miter,y:points[i].y+ny*half*miter});
    right.push({x:points[i].x-nx*half*miter,y:points[i].y-ny*half*miter});
  }
  return [...left,...right.reverse()];
}
export function portraitCoords(points,width=1000,height=1400,physicalW=1.34,physicalH=1.88){
  return points.map(p=>({
    x:(p.x/width-.5)*physicalW,
    y:(.5-p.y/height)*physicalH
  }));
}
