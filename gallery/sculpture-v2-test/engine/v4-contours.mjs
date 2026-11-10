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
// Small isolated source marks can fall below the smoothed isocontour's area
// threshold. Recover ONLY source-occupied pixels not represented by any
// contour; use exact boundary edges instead of inventing a generic dot.
export function recoverUnrepresentedPigment(r,rings){
  const unseen=new Uint8Array(r.mask.length);
  let missing=0;
  for(const j of r.ids){
    const p={x:r.minX+(j%r.rw)+.5,y:r.minY+Math.floor(j/r.rw)+.5};
    let covered=false;
    for(const ring of rings)if(inside(p,ring))covered=!covered;
    if(!covered){unseen[j]=1;missing++;}
  }
  if(!missing)return rings;
  const visited=new Uint8Array(unseen.length),width=r.rw,height=r.rh;
  const neighbours=[[-1,0],[1,0],[0,-1],[0,1]];
  const recovered=[];
  for(const first of r.ids){
    if(!unseen[first]||visited[first])continue;
    const queue=[first],members=new Set([first]);
    visited[first]=1;
    for(let at=0;at<queue.length;at++){
      const i=queue[at],x=i%width,y=(i/width)|0;
      for(const [dx,dy] of neighbours){
        const xx=x+dx,yy=y+dy;
        if(xx<0||yy<0||xx>=width||yy>=height)continue;
        const j=yy*width+xx;
        if(unseen[j]&&!visited[j]){
          visited[j]=1;members.add(j);queue.push(j);
        }
      }
    }
    const edges=[],byStart=new Map();
    const add=(a,b)=>{
      const index=edges.length;
      edges.push({a,b,used:false});
      const k=key(a.x,a.y);
      if(!byStart.has(k))byStart.set(k,[]);
      byStart.get(k).push(index);
    };
    const occupied=(x,y)=>x>=0&&x<width&&y>=0&&y<height&&
      members.has(y*width+x);
    for(const i of queue){
      const lx=i%width,ly=(i/width)|0;
      const x=r.minX+lx,y=r.minY+ly;
      if(!occupied(lx,ly-1))add({x,y},{x:x+1,y});
      if(!occupied(lx+1,ly))add({x:x+1,y},{x:x+1,y:y+1});
      if(!occupied(lx,ly+1))add({x:x+1,y:y+1},{x,y:y+1});
      if(!occupied(lx-1,ly))add({x,y:y+1},{x,y});
    }
    for(const firstEdge of edges){
      if(firstEdge.used)continue;
      const start=key(firstEdge.a.x,firstEdge.a.y);
      const poly=[];
      let edge=firstEdge,closed=false,guard=0;
      while(edge&&!edge.used&&guard++<=edges.length){
        edge.used=true;
        poly.push(edge.a);
        const end=key(edge.b.x,edge.b.y);
        if(end===start){closed=true;break;}
        const next=byStart.get(end)||[];
        edge=next.map(i=>edges[i]).find(e=>!e.used);
      }
      if(!closed||poly.length<3)continue;
      // Remove zero-angle collinear vertices, preserving exact pixel areas.
      for(let changes=true;changes&&poly.length>3;){
        changes=false;
        for(let i=0;i<poly.length&&poly.length>3;i++){
          const a=poly[(i+poly.length-1)%poly.length],
            b=poly[i],c=poly[(i+1)%poly.length];
          const cross=(b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);
          if(Math.abs(cross)<1e-9){poly.splice(i,1);changes=true;i--;}
        }
      }
      if(Math.abs(signedArea(poly))>=.05)recovered.push(poly);
    }
  }
  return [...rings,...recovered];
}

export function extractContours(r,step=.5){
  const nx=Math.ceil((r.rw+2)/step),ny=Math.ceil((r.rh+2)/step);
  // Avoid the exact half-occupancy pixel-edge isovalue.
  const x0=r.minX-1+step*.27,y0=r.minY-1+step*.41,nx1=nx+1;
  const field=r.soft||r.mask;
  const grid=new Float32Array(nx1*(ny+1));
  for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++)
    grid[y*nx1+x]=sampleRegion(r,field,x0+x*step,y0+y*step);
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
    if(!closed||coords.length<3||Math.abs(signedArea(coords))<.025)continue;
    // Remove near-coincident points before Taubin smoothing.
    let p=[];
    for(const c of coords){
      const last=p[p.length-1];
      if(!last||Math.hypot(c.x-last.x,c.y-last.y)>=step*.35)p.push(c);
    }
    while(p.length>3&&Math.hypot(p[0].x-p[p.length-1].x,
      p[0].y-p[p.length-1].y)<step*.35)p.pop();
    if(p.length<3)continue;
    // Non-shrinking smoothing preserves the exterior/interior proportions.
    for(let pass=0;pass<4;pass++)for(const f of [.5,-.53]){
      p=p.map((c,i)=>{
        const a=p[(i+p.length-1)%p.length],b=p[(i+1)%p.length];
        return{x:c.x+f*((a.x+b.x)*.5-c.x),
          y:c.y+f*((a.y+b.y)*.5-c.y)};
      });
    }
    // Straight diagonal runs must not yield zero-area ear-clipping slivers.
    for(let changed=true;changed&&p.length>3;){
      changed=false;
      for(let i=0;i<p.length&&p.length>3;i++){
        const a=p[(i+p.length-1)%p.length],c=p[i],b=p[(i+1)%p.length];
        const twice=Math.abs((c.x-a.x)*(b.y-a.y)-(c.y-a.y)*(b.x-a.x));
        if(twice<.02*Math.hypot(b.x-a.x,b.y-a.y)){
          p.splice(i,1);changed=true;i--;
        }
      }
    }
    if(Math.abs(signedArea(p))>.025)rings.push(p);
  }
  // A source pixel that has no enclosing reconstructed contour is still
  // paint. Keep its exact lattice silhouette as a separate physical solid.
  return recoverUnrepresentedPigment(r,rings)
    .sort((a,b)=>Math.abs(signedArea(b))-Math.abs(signedArea(a)));
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
export function subdivideConforming(vertices,triangles,maxEdge=1.8,boundaries=[]){
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
    // Subdivision of a perimeter edge must also subdivide the wall loop.
    // Otherwise the rounded rim ends against a longer unsplit edge and
    // the mesh is open even though every triangle individually looks valid.
    for(const ring of boundaries){
      const previous=ring.indices,refined=[];
      for(let i=0;i<previous.length;i++){
        const p=previous[i],q=previous[(i+1)%previous.length];
        refined.push(p);
        const m=mids.get(ek(p,q));
        if(m!==undefined)refined.push(m);
      }
      ring.indices=refined;
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
  delaunayFlip(vertices,triangles);
  const refined=subdivideConforming(vertices,triangles,
    quality==='mobile'?2.55:1.8);
  // Trace the ACTUAL cap boundary half-edges, not the original outlines:
  // triangles may pinch at one vertex and each source island must retain
  // an independently closed, rounded side wall.
  return{vertices,triangles:refined,boundaries:boundaryLoops(vertices,refined),
    boundaryCount};
}

export function boundaryLoops(vertices,triangles){
  const uses=new Map();
  for(const t of triangles)for(let i=0;i<3;i++){
    const k=ek(t[i],t[(i+1)%3]);
    uses.set(k,(uses.get(k)||0)+1);
  }
  const edges=[],adjacent=new Map();
  for(const t of triangles)for(let i=0;i<3;i++){
    let a=t[i],b=t[(i+1)%3],c=t[(i+2)%3];
    if(uses.get(ek(a,b))!==1)continue;
    const p=vertices[a],q=vertices[b],inside=vertices[c];
    if(!p||!q||!inside)throw Error('V2 cap has an invalid boundary triangle');
    const area=(q.x-p.x)*(inside.y-p.y)-(q.y-p.y)*(inside.x-p.x);
    if(!Number.isFinite(area)||Math.abs(area)<1e-12)
      throw Error('V2 cap has a degenerate boundary triangle');
    // Choose an initial direction with the cap interior to the right.
    if(area>0)[a,b]=[b,a];
    const edge={id:edges.length,a,b,c,used:false};
    edges.push(edge);
    for(const id of [a,b]){
      if(!adjacent.has(id))adjacent.set(id,[]);
      adjacent.get(id).push(edge);
    }
  }
  if(!edges.length)throw Error('V2 cap has no exterior boundary edges');
  // Traverse by edge identity, not a vertex->successor map. Real artwork
  // includes touching components and face winding can be inconsistent at
  // a pinch; both would silently erase a branch in the former algorithm.
  for(const [id,incidents] of adjacent)if(incidents.length%2)
    throw Error('V2 cap has a non-manifold open boundary at vertex '+
      id+' (degree '+incidents.length+')');
  const loops=[];
  for(const first of edges){
    if(first.used)continue;
    let from=first.a,to=first.b,edge=first,closed=false;
    const indices=[],edgeNormals=[];
    for(let guard=0;guard<=edges.length;guard++){
      if(edge.used)throw Error('V2 cap boundary reused an edge');
      edge.used=true;indices.push(from);
      const p=vertices[from],q=vertices[to],inside=vertices[edge.c];
      let nx=q.y-p.y,ny=-(q.x-p.x);
      const length=Math.hypot(nx,ny);
      if(!Number.isFinite(length)||length<1e-12)
        throw Error('V2 cap has a zero-length perimeter segment');
      nx/=length;ny/=length;
      if(nx*(inside.x-p.x)+ny*(inside.y-p.y)>0){nx=-nx;ny=-ny;}
      edgeNormals.push([nx,ny]);
      if(to===first.a){closed=true;break;}
      const available=(adjacent.get(to)||[]).filter(e=>!e.used);
      if(!available.length)
        throw Error('V2 cap has an open boundary chain at vertex '+to);
      const previous=p,current=q,dx=current.x-previous.x,
        dy=current.y-previous.y;
      const next=available.map(e=>{
        const target=e.a===to?e.b:e.a,point=vertices[target],
          ix=point.x-current.x,iy=point.y-current.y,
          insidePoint=vertices[e.c];
        const turn=Math.atan2(dx*iy-dy*ix,dx*ix+dy*iy);
        const interiorSide=ix*(insidePoint.y-current.y)-
          iy*(insidePoint.x-current.x);
        return{e,target,turn,aligned:interiorSide<0};
      }).sort((u,v)=>Number(v.aligned)-Number(u.aligned)||
          u.turn-v.turn||u.e.id-v.e.id)[0];
      edge=next.e;from=to;to=next.target;
    }
    if(!closed||indices.length<3)
      throw Error('V2 cap perimeter did not close to a polygon');
    const outward=edgeNormals.map((q,i)=>{
      const p=edgeNormals[(i+edgeNormals.length-1)%edgeNormals.length],
        x=p[0]+q[0],y=p[1]+q[1],length=Math.hypot(x,y);
      return length>1e-10?[x/length,y/length]:q;
    });
    loops.push({indices,outward});
  }
  if(edges.some(e=>!e.used))throw Error('V2 rim omitted boundary edges');
  return loops;
}

// Flip interior diagonals before refining, eliminating ear-clipped slivers.
export function delaunayFlip(vertices,triangles,maxPasses=60){
  const orient=(a,b,c)=>{
    const p=vertices[a],q=vertices[b],r=vertices[c];
    return(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
  };
  const sign=Math.sign(triangles.reduce((v,t)=>v+orient(...t),0))||1;
  const inCircle=(a,b,c,d)=>{
    const [A,B,C,D]=[a,b,c,d].map(i=>vertices[i]);
    const ax=A.x-D.x,ay=A.y-D.y,bx=B.x-D.x,by=B.y-D.y,
      cx=C.x-D.x,cy=C.y-D.y;
    return sign*((ax*ax+ay*ay)*(bx*cy-cx*by)-
      (bx*bx+by*by)*(ax*cy-cx*ay)+
      (cx*cx+cy*cy)*(ax*by-bx*ay));
  };
  for(let pass=0;pass<maxPasses;pass++){
    const owner=new Map();
    triangles.forEach((t,n)=>{for(let e=0;e<3;e++){
      const k=ek(t[e],t[(e+1)%3]);
      owner.set(k,(owner.get(k)||[]).concat(n));
    }});
    const touched=new Set();let flips=0;
    for(const [k,list] of owner){
      if(list.length!==2)continue;
      const [n,m]=list;if(touched.has(n)||touched.has(m))continue;
      const t=triangles[n],o=triangles[m];
      const i=[0,1,2].find(e=>ek(t[e],t[(e+1)%3])===k);
      const a=t[i],b=t[(i+1)%3],c=t[(i+2)%3];
      const d=o.find(v=>v!==a&&v!==b);
      if(!(inCircle(a,b,c,d)>1e-12))continue;
      const t1=[a,d,c],t2=[d,b,c];
      if(orient(...t1)*sign<=1e-12||orient(...t2)*sign<=1e-12)
        continue;
      triangles[n]=t1;triangles[m]=t2;
      touched.add(n);touched.add(m);flips++;
    }
    if(!flips)break;
  }
  return triangles;
}
