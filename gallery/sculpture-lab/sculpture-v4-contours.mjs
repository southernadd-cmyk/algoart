// V4.2 region contours: subpixel marching squares and hole-aware triangulation.
// No browser APIs: deterministic math shared by desktop and mobile renderers.
import * as THREE from 'three';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const key=(x,y)=>Math.round(x*1e5)+','+Math.round(y*1e5);
export function sampleRegion(r,field,x,y){
  const u=x-r.minX-.5,v=y-r.minY-.5,ix=Math.floor(u),iy=Math.floor(v);
  const fx=u-ix,fy=v-iy;
  const at=(xx,yy)=>xx<0||yy<0||xx>=r.rw||yy>=r.rh?0:field[yy*r.rw+xx];
  return (at(ix,iy)*(1-fx)+at(ix+1,iy)*fx)*(1-fy)+
    (at(ix,iy+1)*(1-fx)+at(ix+1,iy+1)*fx)*fy;
}
export function signedArea(points){
  let a=0;
  for(let i=0;i<points.length;i++){
    const p=points[i],q=points[(i+1)%points.length];
    a+=p.x*q.y-q.x*p.y;
  }
  return .5*a;
}
function inside(point,points){
  let yes=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
    const p=points[i],q=points[j];
    if((p.y>point.y)!==(q.y>point.y)&&
      point.x<(q.x-p.x)*(point.y-p.y)/(q.y-p.y)+p.x)yes=!yes;
  }
  return yes;
}
export function extractContours(r,step=.5){
  const nx=Math.ceil((r.rw+2)/step),ny=Math.ceil((r.rh+2)/step);
  const x0=r.minX-1,y0=r.minY-1,nx1=nx+1;
  const grid=new Float32Array(nx1*(ny+1));
  for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++)
    grid[y*nx1+x]=sampleRegion(r,r.mask,x0+x*step,y0+y*step);
  const edges=[],byPoint=new Map();
  function add(a,b){
    if(key(a.x,a.y)===key(b.x,b.y))return;
    const id=edges.length;edges.push({a,b,used:false});
    for(const p of [a,b]){
      const k=key(p.x,p.y);if(!byPoint.has(k))byPoint.set(k,[]);
      byPoint.get(k).push(id);
    }
  }
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
    const X=x0+x*step,Y=y0+y*step;
    const p=[{x:X,y:Y},{x:X+step,y:Y},{x:X+step,y:Y+step},{x:X,y:Y+step}];
    const v=[grid[y*nx1+x],grid[y*nx1+x+1],
      grid[(y+1)*nx1+x+1],grid[(y+1)*nx1+x]];
    const crossing=[];
    for(let e=0;e<4;e++)if((v[e]>=.5)!==(v[(e+1)%4]>=.5))crossing.push(e);
    const cross=e=>{
      const next=(e+1)%4,denom=v[next]-v[e],
        t=Math.abs(denom)<1e-9?.5:clamp((.5-v[e])/denom,0,1);
      return{x:p[e].x+(p[next].x-p[e].x)*t,
        y:p[e].y+(p[next].y-p[e].y)*t};
    };
    if(crossing.length===2)add(cross(crossing[0]),cross(crossing[1]));
    else if(crossing.length===4){
      // Disambiguate opposing pixels without spuriously connecting diagonals.
      const average=v.reduce((s,z)=>s+z,0)*.25;
      const clockwise=(v[0]>=.5)===(average>=.5);
      const pairs=clockwise?[[0,3],[1,2]]:[[0,1],[2,3]];
      for(const [a,b] of pairs)add(cross(a),cross(b));
    }
  }
  const rings=[];
  for(const first of edges){
    if(first.used)continue;
    const origin=key(first.a.x,first.a.y),coords=[first.a];
    let edge=first,next=first.b,closed=false,count=0;
    while(edge&&!edge.used&&count++<edges.length+1){
      edge.used=true;
      if(key(next.x,next.y)===origin){closed=true;break;}
      coords.push(next);
      const other=(byPoint.get(key(next.x,next.y))||[])
        .map(i=>edges[i]).find(e=>!e.used);
      if(!other)break;
      next=key(other.a.x,other.a.y)===key(next.x,next.y)?other.b:other.a;
      edge=other;
    }
    if(!closed||coords.length<3||Math.abs(signedArea(coords))<.25)continue;
    let p=coords;
    for(let pass=0;pass<2;pass++){
      p=p.map((c,i)=>{
        const a=p[(i+p.length-1)%p.length],b=p[(i+1)%p.length];
        return{x:c.x*.76+.12*(a.x+b.x),y:c.y*.76+.12*(a.y+b.y)};
      });
    }
    if(Math.abs(signedArea(p))>.25)rings.push(p);
  }
  return rings.sort((a,b)=>Math.abs(signedArea(b))-Math.abs(signedArea(a)));
}
function makeGroups(rings){
  const entries=rings.map((ring,i)=>({ring,i,parent:-1,depth:0}));
  for(let i=0;i<entries.length;i++){
    for(let j=i-1;j>=0;j--)if(inside(entries[i].ring[0],entries[j].ring)){
      entries[i].parent=j;entries[i].depth=entries[j].depth+1;break;
    }
  }
  return entries.filter(e=>e.depth%2===0).map(e=>({
    outer:e.ring,holes:entries.filter(x=>x.parent===e.i&&x.depth===e.depth+1)
      .map(x=>x.ring)
  }));
}
const ek=(a,b)=>a<b?a+':'+b:b+':'+a;
export function subdivideConforming(vertices,triangles,maxEdge=1.8){
  for(let pass=0;pass<10;pass++){
    const split=new Set();
    for(const [a,b,c] of triangles)for(const [u,v] of [[a,b],[b,c],[c,a]]){
      const p=vertices[u],q=vertices[v];
      if(Math.hypot(p.x-q.x,p.y-q.y)>maxEdge)split.add(ek(u,v));
    }
    if(!split.size)break;
    const mids=new Map(),next=[];
    const mid=(a,b)=>{
      const k=ek(a,b);
      if(!split.has(k))return-1;
      if(mids.has(k))return mids.get(k);
      const p=vertices[a],q=vertices[b],id=vertices.length;
      vertices.push({x:(p.x+q.x)*.5,y:(p.y+q.y)*.5});
      mids.set(k,id);return id;
    };
    for(const original of triangles){
      let[a,b,c]=original;
      const ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);
      const n=(ab>=0)+(bc>=0)+(ca>=0);
      if(n===0){next.push([a,b,c]);continue;}
      if(n===3){next.push([a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]);continue;}
      if(ab<0){if(bc>=0)[a,b,c]=[b,c,a];else[a,b,c]=[c,a,b];}
      const m0=mid(a,b),m1=mid(b,c),m2=mid(c,a);
      if(n===1)next.push([a,m0,c],[m0,b,c]);
      else if(m1>=0)next.push([a,m0,c],[m0,m1,c],[m0,b,m1]);
      else next.push([a,m0,m2],[m0,b,c],[m2,m0,c]);
    }
    triangles=next;
  }
  return triangles;
}
export function buildPlanarRegion(r,{quality='desktop'}={}){
  const rings=extractContours(r,quality==='mobile'?.75:.5);
  const vertices=[],triangles=[],boundaries=[];
  for(const group of makeGroups(rings)){
    const start=vertices.length,loops=[group.outer,...group.holes],
      outlines=loops.map((ring,i)=>{
        const points=ring.map(p=>new THREE.Vector2(p.x,p.y));
        const clockwise=THREE.ShapeUtils.isClockWise(points);
        if(i===0?!clockwise:clockwise)points.reverse();
        return points;
      });
    for(const ring of outlines)for(const p of ring)vertices.push({x:p.x,y:p.y});
    for(const t of THREE.ShapeUtils.triangulateShape(outlines[0],outlines.slice(1)))
      triangles.push(t.map(k=>k+start));
    let offset=start;
    for(let i=0;i<outlines.length;i++){
      boundaries.push({indices:outlines[i].map((_,j)=>offset+j),hole:i>0});
      offset+=outlines[i].length;
    }
  }
  if(!triangles.length)throw Error('V4 marching squares triangulation found no surface');
  const boundaryCount=vertices.length;
  const refined=subdivideConforming(vertices,triangles,quality==='mobile'?2.55:1.8);
  return{vertices,triangles:refined,boundaries,boundaryCount};
}