// PROPORTION PIECE Sculpture Lab V4.2 — genuine source-colour spatial volumes.
import * as THREE from 'three';
import {V4_METHODS} from './sculpture-v4-topology.mjs';
import {buildPlanarRegion,sampleRegion,signedArea} from './sculpture-v4-contours.mjs';
export {V4_METHODS};
const W=1.34,H=1.88,PHI=(1+Math.sqrt(5))/2;
const GOLDEN_ANGLE=Math.PI*(3-Math.sqrt(5));
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function paintMaterial(color,material,map=null,bumpMap=null){
  const rough={oil:.57,action:.66,marker:.78,tissue:.94,watercolour:.87}[material]??.78;
  const bumpScale={oil:.029,action:.025,marker:.011,tissue:.007,watercolour:.010}[material]??.01;
  const m=new THREE.MeshStandardMaterial({
    color,roughness:rough,metalness:0,side:THREE.DoubleSide,
    ...(map?{map}:{}),...(bumpMap?{bumpMap,bumpScale}:{})
  });
  m.userData.ppV4Owned=true;return m;
}
export function regionLayerOffset(r,method,depth=.85,phiPull=.8,count=1){
  const hsl={h:0,s:0,l:0};
  new THREE.Color(r.color).getHSL(hsl);
  const rank=count===1?0:r.id/(count-1)-.5;
  const phase=(r.id+1)*GOLDEN_ANGLE+hsl.h*Math.PI;
  const stagger=.48*Math.sin(phase)+.3*rank+(.5-hsl.l)*.7;
  const spread=method==='assembly'?1.7:method==='gesture'?1.25:
    method==='medial'?1.1:.80;
  return clamp(stagger,-.72,.72)*depth*(.32+.68*phiPull)*spread;
}
function surfaceHeight(r,p,mode,method,depth,phiPull,fidelity,material){
  const u=sampleRegion(r,r.potential,p.x,p.y);
  const d=sampleRegion(r,r.distance,p.x,p.y);
  const radius=Math.max(d,sampleRegion(r,r.radius,p.x,p.y));
  const scale=(W/r.width+H/r.height)*.5;
  const base=mode==='medial'?scale*Math.sqrt(Math.max(0,d*(2*radius-d))):
    2*scale*Math.sqrt(Math.max(0,u));
  const contrast=sampleRegion(r,r.localInk,p.x,p.y)-r.meanInk;
  const amp={oil:.06,action:.053,marker:.019,tissue:.013,watercolour:.021}[material]??.017;
  const detail=depth*amp*(method==='gesture'?2.3:method==='assembly'?1.45:1)*
    contrast*clamp(d/1.2,0,1);
  return Math.max(.009,base*depth*(.72+.28*fidelity)*
    (1+.17*phiPull*Math.sin((r.id+1)*GOLDEN_ANGLE*PHI))+detail);
}
function regionGeometry(r,{mode,method,depth,phiPull,fidelity,
  material,quality,count}){
  const plane=buildPlanarRegion(r,{quality});
  const {vertices,triangles,boundaries}=plane;
  const pos=[],uv=[],upper=[],lower=[],faces=[],rim=[];
  const offset=regionLayerOffset(r,method,depth,phiPull,count);
  const phase=(r.id+1)*GOLDEN_ANGLE;
  const sweep=phiPull*(1-.5*fidelity)*depth*
    (method==='assembly'?.31:method==='gesture'?.23:
      method==='medial'?.19:.13);
  const theta=phiPull*(method==='assembly'?.40:method==='gesture'?.20:
    method==='medial'?.15:.08);
  const c=Math.cos(theta),s=Math.sin(theta);
  const rear=method==='assembly'?1.57:method==='medial'?1.32:
    method==='gesture'?1.21:1.11;
  const fore=method==='gesture'?.72:method==='assembly'?1.11:1;
  function xy(p,isRear){
    const x=(p.x/r.width-.5)*W,y=(.5-p.y/r.height)*H;
    if(!isRear)return[x,y];
    const dx=x-r.centerX,dy=y-r.centerY;
    return[r.centerX+dx*c-dy*s+Math.cos(phase)*sweep,
      r.centerY+dx*s+dy*c+Math.sin(phase)*sweep*.72];
  }
  function z(p,isRear){
    const h=surfaceHeight(r,p,mode,method,depth,phiPull,fidelity,material);
    return offset+(isRear?-rear*h:fore*h);
  }
  function add(v,depthValue,source){
    const k=pos.length/3;pos.push(v[0],v[1],depthValue);
    uv.push(source.x/r.width,1-source.y/r.height);return k;
  }
  for(const p of vertices)upper.push(add(xy(p,false),z(p,false),p));
  for(const p of vertices)lower.push(add(xy(p,true),z(p,true),p));
  for(const t of triangles){
    let [a,b,d]=t;
    const p=vertices[a],q=vertices[b],v=vertices[d];
    if((q.x-p.x)*(v.y-p.y)-(q.y-p.y)*(v.x-p.x)>0)[b,d]=[d,b];
    faces.push(upper[a],upper[b],upper[d],lower[a],lower[d],lower[b]);
  }
  // A separate rounded side strip owns its own normals. No shading pollution
  // from side walls into the textured front/back surfaces.
  const nSteps=quality==='mobile'?4:7;
  for(const ring of boundaries){
    const ids=ring.indices,n=ids.length;
    if(n<3)continue;
    const points=ids.map(i=>vertices[i]);
    const winding=signedArea(points)>=0?1:-1;
    // A common bevel section at every contour vertex joins *both*
    // adjacent wall faces. Per-edge outward normals left open seams.
    const normals=points.map((p,i)=>{
      const before=points[(i+n-1)%n],after=points[(i+1)%n];
      const l0=Math.hypot(p.x-before.x,p.y-before.y)||1;
      const l1=Math.hypot(after.x-p.x,after.y-p.y)||1;
      const tx=(p.x-before.x)/l0+(after.x-p.x)/l1;
      const ty=(p.y-before.y)/l0+(after.y-p.y)/l1;
      const len=Math.hypot(tx,ty)||1;
      return[winding*ty/len,-winding*tx/len];
    });
    const layers=points.map((p,i)=>{
      const f=xy(p,false),b=xy(p,true);
      const hz=z(p,false)-offset,hb=offset-z(p,true);
      const [nx,ny]=normals[i],row=[];
      for(let j=0;j<=nSteps;j++){
        const angle=Math.PI*j/nSteps,t=j/nSteps;
        const bevel=Math.sin(angle)*(quality==='mobile'?.18:.24);
        const x=f[0]*(1-t)+b[0]*t+nx*bevel*W/r.width;
        const y=f[1]*(1-t)+b[1]*t-ny*bevel*H/r.height;
        const dz=offset+Math.cos(angle)*(angle<=Math.PI/2?hz:hb);
        row.push(add([x,y],dz,p));
      }
      return row;
    });
    for(let i=0;i<n;i++){
      const left=layers[i],right=layers[(i+1)%n];
      for(let j=0;j<nSteps;j++){
        const a=left[j],b=right[j],c=right[j+1],d=left[j+1];
        rim.push(a,b,c,a,c,d);
      }
    }
  }
  // Ear-clipped contours sometimes retain duplicate coplanar triangles
  // where an ink contour has a touching/collinear run. Remove identical
  // triangles by actual XYZ (not just vertex index) before calculating normals.
  const triKey=i=>[pos[i*3],pos[i*3+1],pos[i*3+2]]
    .map(v=>Math.round(v*1e6)).join(':');
  const seen=new Set();
  function dedup(input){
    const result=[];
    for(let i=0;i<input.length;i+=3){
      const k=[triKey(input[i]),triKey(input[i+1]),triKey(input[i+2])]
        .sort().join('|');
      if(seen.has(k))continue;
      seen.add(k);
      result.push(input[i],input[i+1],input[i+2]);
    }
    return result;
  }
  const cleanFaces=dedup(faces),cleanRim=dedup(rim);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geometry.setIndex([...cleanFaces,...cleanRim]);
  geometry.addGroup(0,cleanFaces.length,0);
  geometry.addGroup(cleanFaces.length,cleanRim.length,1);
  geometry.computeVertexNormals();
  const anchors=boundaries.flatMap(line=>{
    const spacing=Math.max(1,Math.floor(line.indices.length/24));
    return line.indices.filter((_,i)=>i%spacing===0).map(i=>{
      const p=vertices[i],v=xy(p,false);
      return new THREE.Vector3(v[0],v[1],z(p,false));
    });
  });
  return{geometry,anchors,zLayer:offset,triangles:(cleanFaces.length+cleanRim.length)/3,
    roundedRimTriangles:cleanRim.length/3,boundaryLoops:boundaries.length};
}
function actualStrokes(group,strokes,depth,material,max){
  let count=0;
  for(const s of strokes||[]){
    if(count>=max)break;
    if(s.sourceKind==='pigment-contour'||!Array.isArray(s.points)||s.points.length<3)
      continue;
    const p=s.points.filter(v=>Number.isFinite(v.x)&&Number.isFinite(v.y));
    if(p.length<3)continue;
    const line=p.map((v,i)=>new THREE.Vector3(v.x,v.y,
      depth*(.17+.22*Math.sin(i/(p.length-1)*Math.PI))));
    const curve=new THREE.CatmullRomCurve3(line,false,'centripetal');
    const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,
      Math.min(90,Math.max(16,p.length)),clamp((s.width||.009)*.65,.0028,.015),8,false),
      paintMaterial(s.color||'#756d63',material));
    mesh.userData.ppV4Owned=true;mesh.castShadow=true;
    mesh.name='Recorded 3D brush gesture';group.add(mesh);count++;
  }
  return count;
}
function connectRegions(group,items,strength,material,quality){
  if(strength<.18||items.length<2)return 0;
  const top=items.slice(0,quality==='mobile'?9:16),options=[];
  for(let i=0;i<top.length;i++)for(let j=i+1;j<top.length;j++){
    if(Math.abs(top[i].zLayer-top[j].zLayer)<.035)continue;
    let closest=Infinity,found=null;
    for(const a of top[i].anchors)for(const b of top[j].anchors){
      const dist=(a.x-b.x)**2+(a.y-b.y)**2;
      if(dist<closest){closest=dist;found=[a,b];}
    }
    if(found&&closest<.19**2)options.push({i,j,closest,found});
  }
  options.sort((a,b)=>a.closest-b.closest);
  const limit=Math.round(strength*Math.min(7,top.length-1));
  let built=0;
  for(const item of options.slice(0,limit)){
    const [a,b]=item.found,middle=new THREE.Vector3().lerpVectors(a,b,.5);
    middle.z+=(Math.abs(a.z-b.z)*.18+.028)*Math.sin((item.i+1)*GOLDEN_ANGLE);
    const mesh=new THREE.Mesh(new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([a,middle,b]),12,.004+.007*strength,8,false),
      paintMaterial(top[item.i].color,material));
    mesh.name='Inter-region XYZ bridge';mesh.castShadow=true;
    mesh.userData.ppV4Owned=true;group.add(mesh);built++;
  }
  return built;
}
export function buildV4Sculpture(method,{
  topology,texture,bumpTexture=null,strokes=[],material='marker',
  fidelity=.9,phiPull=.8,depth=.85,connection=.65,quality='desktop'
}={}){
  if(!V4_METHODS.includes(method))throw Error('Unknown V4 method '+method);
  if(!topology?.regions?.length||!texture?.isTexture)
    throw Error('Archived pigment regions and painting texture required');
  const group=new THREE.Group();
  group.name='V4.2 source-shaped 360 degree sculpture / '+method;
  const painted=paintMaterial('#ffffff',material,texture,bumpTexture);
  const regions=topology.regions.slice(0,quality==='mobile'?48:72);
  const items=[];
  let poisson=0,medial=0,triangles=0,rim=0;
  for(const r of regions){
    const type=method==='medial'||method==='gesture'?'medial':
      method==='assembly'&&(r.id%2===1||r.aspect>=1.75)?'medial':'poisson';
    if(type==='medial')medial++;else poisson++;
    const result=regionGeometry(r,{mode:type,method,depth,phiPull,
      fidelity,material,quality,count:regions.length});
    const mesh=new THREE.Mesh(result.geometry,
      [painted,paintMaterial(r.color,material)]);
    mesh.name='Source-derived '+type+' solid '+r.id;
    mesh.castShadow=true;mesh.receiveShadow=true;
    mesh.userData={ppV4Owned:true,regionId:r.id,area:r.area,
      sourceCenter:[r.centerX,r.centerY],sourceColor:r.color,algorithm:type,
      zLayer:result.zLayer,contourLoops:result.boundaryLoops,
      sourceInkRelief:true};
    group.add(mesh);
    triangles+=result.triangles;rim+=result.roundedRimTriangles;
    items.push({...result,color:r.color});
  }
  const sourceStrokes=(method==='gesture'||method==='assembly')?
    actualStrokes(group,strokes,depth,material,quality==='mobile'?10:22):0;
  const links=(method==='gesture'||method==='assembly')?
    connectRegions(group,items,connection,material,quality):0;
  const bounds=new THREE.Box3().setFromObject(group);
  if(bounds.isEmpty())throw Error('V4.2 source regions produced no geometry');
  const size=bounds.getSize(new THREE.Vector3());
  const omitted=topology.omittedCells+
    topology.regions.slice(regions.length).reduce((sum,r)=>sum+r.area,0);
  group.userData={
    engine:'region-inflation-v4',method,noImagePlane:true,
    noSilhouetteExtrusion:true,preservedOriginalXY:true,
    sourceBody:true,meshCount:group.children.length,
    regionCount:regions.length,medialRegions:medial,poissonRegions:poisson,
    sourceStrokeCount:sourceStrokes,realConnections:links,
    sourceCoverage:topology.covered/Math.max(1,topology.pigmented),
    originalShapeCount:topology.separateShapes,
    omittedCells:omitted,polygonTriangles:triangles,
    roundedRimTriangles:rim,roundedSides:true,
    sourceInkRelief:true,localIndependentSolids:true,sourceColourOnFront:true,
    phiStructural:phiPull>0,
    zLayerExtent:Math.max(...items.map(x=>x.zLayer))-
      Math.min(...items.map(x=>x.zLayer)),
    extent:[size.x,size.y,size.z]
  };
  return group;
}
export function disposeV4Sculpture(group){
  if(!group)return;
  const geos=new Set(),mats=new Set();
  group.traverse(o=>{
    if(o.geometry)geos.add(o.geometry);
    for(const m of Array.isArray(o.material)?o.material:(o.material?[o.material]:[]))
      if(m?.userData?.ppV4Owned)mats.add(m);
  });
  group.removeFromParent();group.clear();
  geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());
}