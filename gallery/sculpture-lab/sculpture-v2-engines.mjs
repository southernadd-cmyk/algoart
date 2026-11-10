// PROPORTION PIECE — four truly different XYZ construction engines.
// No image-plane geometry, silhouette extrusion, or image-as-texture decal.
import * as THREE from 'three';
import {PHI,GOLDEN_ANGLE,clamp} from './sculpture-v2-features.mjs';

export const ENGINE_TYPES=Object.freeze(['strand','ribbon','mass','hybrid']);
const v=p=>new THREE.Vector3(p.x,p.y,p.z);
const safeColor=str=>{try{return new THREE.Color(str||'#786f62');}catch{return new THREE.Color('#786f62');}};
const finishes={
  oil:{roughness:.47,metalness:.05},tissue:{roughness:.94,metalness:0},
  watercolour:{roughness:.88,metalness:0},marker:{roughness:.71,metalness:0},
  action:{roughness:.61,metalness:.04}
};
function paintMaterial(material,colour,vertexColors=false,colourMode='pigment'){
  const f=finishes[material]||finishes.marker;
  const m=new THREE.MeshStandardMaterial({
    color:vertexColors?'#ffffff':colourMode==='bronze'?'#817057':colour,
    vertexColors,roughness:f.roughness,metalness:colourMode==='bronze'?.48:f.metalness,
    side:THREE.DoubleSide
  });
  m.userData.ppV2Owned=true;
  return m;
}
function sweep(points,rx,ry,material,{
  closed=false,twist=0,segments=32,radial=10,name='3D swept gesture'
}={}){
  const valid=points.map(v);
  const curve=new THREE.CatmullRomCurve3(valid,closed,'centripetal',.35);
  const n=Math.max(16,Math.min(90,segments)),s=Math.max(8,radial);
  const frames=curve.computeFrenetFrames(n,closed);
  const pos=[],uv=[],index=[];
  for(let i=0;i<=n;i++){
    const t=i/n,p=curve.getPoint(t);
    const phi=twist*t*GOLDEN_ANGLE;
    const normal=frames.normals[i].clone().multiplyScalar(Math.cos(phi))
      .addScaledVector(frames.binormals[i],Math.sin(phi));
    const binormal=frames.binormals[i].clone().multiplyScalar(Math.cos(phi))
      .addScaledVector(frames.normals[i],-Math.sin(phi));
    const taper=closed?1:.16+.84*Math.pow(Math.sin(Math.PI*t),.42);
    const wave=1+.10*Math.sin(t*Math.PI*4+GOLDEN_ANGLE);
    for(let j=0;j<=s;j++){
      const a=j/s*Math.PI*2;
      const pt=p.clone().addScaledVector(normal,Math.cos(a)*rx*taper*wave)
        .addScaledVector(binormal,Math.sin(a)*ry*taper*wave);
      pos.push(pt.x,pt.y,pt.z);uv.push(t,j/s);
    }
  }
  for(let i=0;i<n;i++)for(let j=0;j<s;j++){
    const a=i*(s+1)+j,b=(i+1)*(s+1)+j;
    index.push(a,b,a+1,a+1,b,b+1);
  }
  if(!closed){
    const first=pos.length/3,last=first+1;
    pos.push(...valid[0].toArray(),...valid[valid.length-1].toArray());
    uv.push(0,.5,1,.5);
    for(let j=0;j<s;j++){
      index.push(first,j+1,j);
      const a=n*(s+1)+j;index.push(last,a,a+1);
    }
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geo.setIndex(index);geo.computeVertexNormals();
  const mesh=new THREE.Mesh(geo,material);mesh.name=name;
  mesh.userData.ppV2Owned=true;return mesh;
}
function makeStrands(group,graph,source,colourMode,max=16,withReturns=true){
  const g=graph.gestures.slice(0,max);
  for(let i=0;i<g.length;i++){
    const a=g[i],m=paintMaterial(source.material,a.colour,false,colourMode);
    const path=a.paths;
    group.add(sweep(path,clamp(a.radius*.75,.017,.074),
      clamp(a.radius*.74,.017,.074),m,{
        segments:clamp(path.length*4,22,64),radial:9,
        twist:.12,name:'Original gesture translated to a 3D strand'
      }));
    if(withReturns&&i%2===0){
      const ret=a.returnPath;
      group.add(sweep(ret,clamp(a.radius*.51,.011,.038),
        clamp(a.radius*.51,.011,.038),paintMaterial(source.material,a.colour,false,colourMode),{
          segments:30,radial:8,twist:.38,name:'Rear spatial continuation of the gesture'
        }));
    }
  }
}
function makeRibbons(group,graph,source,colourMode,max=11){
  const g=[...graph.gestures].sort((a,b)=>b.radius-a.radius||b.weight-a.weight).slice(0,max);
  for(let i=0;i<g.length;i++){
    const a=g[i],width=clamp(.105+Math.sqrt(a.radius)*.29,.14,.29);
    const merged=i%3===0?[...a.paths,...a.returnPath.slice(1)]:a.paths;
    group.add(sweep(merged,width,clamp(width/PHI/7,.020,.046),
      paintMaterial(source.material,a.colour,false,colourMode),{
        twist:(i%2?-1:1)*(1.65+(i%3)*.44),
        segments:clamp(merged.length*4,32,84),radial:12,
        name:'Volumetric folded ribbon with real return and thickness'
      }));
  }
}
function ellipsoidDistance(p,node){
  const c=node.position;
  const sx=node.radius*1.08,sy=node.radius*1.36,sz=node.breadth*1.55;
  const dx=(p[0]-c.x)/sx,dy=(p[1]-c.y)/sy,dz=(p[2]-c.z)/sz;
  return (Math.hypot(dx,dy,dz)-1)*Math.min(sx,sy,sz);
}
function capsuleDistance(p,a,b,r){
  const vx=b.x-a.x,vy=b.y-a.y,vz=b.z-a.z;
  const t=clamp(((p[0]-a.x)*vx+(p[1]-a.y)*vy+(p[2]-a.z)*vz)/
    Math.max(1e-5,vx*vx+vy*vy+vz*vz),0,1);
  return Math.hypot(p[0]-a.x-t*vx,p[1]-a.y-t*vy,p[2]-a.z-t*vz)-r;
}
function smoothMin(a,b,k){
  const h=Math.max(k-Math.abs(a-b),0)/k;
  return Math.min(a,b)-h*h*k*.25;
}
function buildMassGeometry(graph,nodeLimit=10){
  const nodes=graph.nodes.slice(0,nodeLimit);
  const byId=new Map(nodes.map(n=>[n.id,n]));
  const links=graph.links.filter(l=>byId.has(l.from)&&byId.has(l.to));
  const bounds={x:[-.94,.94],y:[-1.18,1.18],z:[-1.07,1.07]};
  const dims=[38,49,35],s=[dims[0]+1,dims[1]+1,dims[2]+1];
  const plane=s[0]*s[1],count=plane*s[2],field=new Float32Array(count);
  const index=(i,j,k)=>k*plane+j*s[0]+i;
  const xyz=(i,j,k)=>[
    bounds.x[0]+i/dims[0]*(bounds.x[1]-bounds.x[0]),
    bounds.y[0]+j/dims[1]*(bounds.y[1]-bounds.y[0]),
    bounds.z[0]+k/dims[2]*(bounds.z[1]-bounds.z[0])
  ];
  function value(p){
    let d=2;
    for(const node of nodes)d=smoothMin(d,ellipsoidDistance(p,node),.09);
    for(const l of links){
      const a=byId.get(l.from),b=byId.get(l.to);
      const thickness=clamp(Math.min(a.radius,b.radius)*(.26+.19*graph.options.connection),.032,.10);
      d=smoothMin(d,capsuleDistance(p,a.position,b.position,thickness),.075);
    }
    return d;
  }
  for(let k=0;k<s[2];k++)for(let j=0;j<s[1];j++)for(let i=0;i<s[0];i++)
    field[index(i,j,k)]=value(xyz(i,j,k));
  const corners=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],
    [0,0,1],[1,0,1],[1,1,1],[0,1,1]];
  const tetra=[[0,5,1,6],[0,1,2,6],[0,2,3,6],
    [0,3,7,6],[0,7,4,6],[0,4,5,6]];
  const positions=[],colours=[];
  function sampleColour(p){
    let chosen=nodes[0],best=Infinity;
    for(const n of nodes){
      const d=Math.hypot((p[0]-n.position.x)/n.radius,
        (p[1]-n.position.y)/n.radius,(p[2]-n.position.z)/Math.max(.05,n.breadth));
      if(d<best){chosen=n;best=d;}
    }
    return safeColor(chosen.colour);
  }
  function emit(tri){
    const p0=new THREE.Vector3(...tri[0]),p1=new THREE.Vector3(...tri[1]),
      p2=new THREE.Vector3(...tri[2]);
    const centroid=p0.clone().add(p1).add(p2).multiplyScalar(1/3);
    const eps=.013,p=centroid.toArray();
    const normal=new THREE.Vector3(
      value([p[0]+eps,p[1],p[2]])-value([p[0]-eps,p[1],p[2]]),
      value([p[0],p[1]+eps,p[2]])-value([p[0],p[1]-eps,p[2]]),
      value([p[0],p[1],p[2]+eps])-value([p[0],p[1],p[2]-eps])
    );
    if(p1.clone().sub(p0).cross(p2.clone().sub(p0)).dot(normal)<0)
      [tri[1],tri[2]]=[tri[2],tri[1]];
    for(const vertex of tri){
      positions.push(...vertex);
      const c=sampleColour(vertex);colours.push(c.r,c.g,c.b);
    }
  }
  const crossing=(a,b)=>{
    const t=clamp(a.d/(a.d-b.d),0,1);
    return [0,1,2].map(d=>a.p[d]+(b.p[d]-a.p[d])*t);
  };
  for(let k=0;k<dims[2];k++)for(let j=0;j<dims[1];j++)for(let i=0;i<dims[0];i++){
    const cube=corners.map(([di,dj,dk])=>({
      p:xyz(i+di,j+dj,k+dk),d:field[index(i+di,j+dj,k+dk)]
    }));
    if(!cube.some(c=>c.d<0)||!cube.some(c=>c.d>=0))continue;
    for(const tet of tetra){
      const inside=tet.filter(a=>cube[a].d<0),outside=tet.filter(a=>cube[a].d>=0);
      if(!inside.length||!outside.length)continue;
      if(inside.length===1){
        emit(outside.map(o=>crossing(cube[inside[0]],cube[o])));
      }else if(inside.length===3){
        emit(inside.map(n=>crossing(cube[n],cube[outside[0]])));
      }else{
        const a=crossing(cube[inside[0]],cube[outside[0]]);
        const b=crossing(cube[inside[0]],cube[outside[1]]);
        const c=crossing(cube[inside[1]],cube[outside[0]]);
        const d=crossing(cube[inside[1]],cube[outside[1]]);
        emit([a,b,c]);emit([b,d,c]);
      }
    }
  }
  if(positions.length<120)throw Error('3D composition graph produced no volumetric mass');
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));
  geometry.computeVertexNormals();
  return geometry;
}
function makeMass(group,graph,source,colourMode,nodeLimit=11){
  const geometry=buildMassGeometry(graph,nodeLimit);
  const mat=paintMaterial(source.material,'#ffffff',true,colourMode);
  // Colours are sampled from the actual source pigment regions.
  if(colourMode==='bronze'){
    const colour=geometry.getAttribute('color');
    const bronze=safeColor('#8b7756');
    for(let i=0;i<colour.count;i++)colour.setXYZ(i,bronze.r,bronze.g,bronze.b);
  }
  const mesh=new THREE.Mesh(geometry,mat);
  mesh.name='Source pigment mass composition: fused three-dimensional SDF';
  mesh.userData.ppV2Owned=true;group.add(mesh);
}
export function buildSculptureEngine(kind,graph,features,{colourMode='pigment'}={}){
  if(!ENGINE_TYPES.includes(kind))throw Error('Unknown 3D-first engine '+kind);
  const group=new THREE.Group();group.name='Sculpture v2 — '+kind;
  if(kind==='strand')makeStrands(group,graph,features,colourMode,19,true);
  if(kind==='ribbon')makeRibbons(group,graph,features,colourMode,12);
  if(kind==='mass')makeMass(group,graph,features,colourMode,12);
  if(kind==='hybrid'){
    makeMass(group,graph,features,colourMode,6);
    makeRibbons(group,graph,features,colourMode,5);
    makeStrands(group,graph,features,colourMode,9,true);
  }
  const b=new THREE.Box3().setFromObject(group);
  if(b.isEmpty())throw Error('Sculpture engine generated empty geometry');
  const size=b.getSize(new THREE.Vector3());
  const factor=Math.min(1,1.33/Math.max(size.x,.01),
    1.86/Math.max(size.y,.01),1.46/Math.max(size.z,.01));
  group.scale.setScalar(factor);
  group.userData={
    engine:'spatial-v2',method:kind,
    sourceKind:features.sourceKind,
    generation:'gesture-graph-XYZ',
    noImagePlane:true,noSilhouetteExtrusion:true,
    phiStructural:true,originalSourceRegions:features.regions.length,
    originalSourceGestures:features.gestures.length,
    meshCount:group.children.filter(c=>c.isMesh).length,
    spatialScale:factor
  };
  return group;
}
export function disposeSculptureV2(group){
  if(!group)return;
  const materials=new Set(),geometries=new Set();
  group.traverse(o=>{
    if(o.geometry)geometries.add(o.geometry);
    if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])
      if(m.userData?.ppV2Owned)materials.add(m);
  });
  group.removeFromParent();group.clear();
  for(const g of geometries)g.dispose();
  for(const m of materials)m.dispose();
}
