// PROPORTION PIECE Sculpture Lab V4 — actual region-derived, closed 3D bodies.
// 2D source pixel topology controls *every* XY footprint; no universal rocket
// cross-section, no painted image card, no contour outlines passed off as strokes.
import * as THREE from 'three';
import {V4_METHODS,regionElevation} from './sculpture-v4-topology.mjs';
export {V4_METHODS};
const PHI=(1+Math.sqrt(5))/2,GOLDEN_ANGLE=Math.PI*(3-Math.sqrt(5));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const W=1.34,H=1.88;
function regionGeometry(r,{mode='poisson',depth=.85,phiPull=.8,
                            fidelity=.90,method='poisson'}={}){
  const positions=[],uvs=[],triTop=[],triBack=[],triWalls=[];
  const vertexMap=new Map(),rw=r.rw,w=r.width,h=r.height;
  const heightMemo=new Map();
  const offset=method==='assembly'? .11*phiPull*depth*
    Math.sin((r.id+1)*GOLDEN_ANGLE):0;
  const weight=1+.20*phiPull*Math.sin((r.id+1)*GOLDEN_ANGLE*PHI);
  const volumeScale=depth*(.72+.28*fidelity)*weight;
  const frontMult=method==='gesture'?.77:1;
  const backMult=method==='medial'?1.03:method==='assembly'?1.16:1;
  function height(x,y){
    const k=x+','+y;
    if(heightMemo.has(k))return heightMemo.get(k);
    let total=0,n=0;
    for(const yy of [y-1,y])for(const xx of [x-1,x]){
      const j=(yy-r.minY)*rw+(xx-r.minX);
      if(xx>=r.minX&&xx<r.minX+rw&&
         yy>=r.minY&&yy<r.minY+r.rh&&r.mask[j]){
        total+=regionElevation(r,xx,yy,mode);n++;
      }
    }
    // Pixel corners on the boundary retain small physical thickness, letting
    // the two curved faces close with a real side rim.
    const v=n===4?Math.max(.0038,total/n):.0038;
    heightMemo.set(k,v);
    return v;
  }
  function vertex(x,y){
    const key=x+','+y;
    if(vertexMap.has(key))return vertexMap.get(key);
    const xx=(x/w-.5)*W,yy=(.5-y/h)*H,uvx=x/w,uvy=1-y/h;
    const elevation=height(x,y)*volumeScale;
    const front=positions.length/3;
    positions.push(xx,yy,offset+elevation*frontMult);
    uvs.push(uvx,uvy);
    const back=positions.length/3;
    positions.push(xx,yy,offset-elevation*backMult);
    uvs.push(uvx,uvy);
    const pair=[front,back];vertexMap.set(key,pair);return pair;
  }
  for(const i of r.ids){
    const x=i%rw+r.minX,y=((i/rw)|0)+r.minY;
    const a=vertex(x,y),b=vertex(x+1,y),
      c=vertex(x+1,y+1),d=vertex(x,y+1);
    // The top half-space looks toward the front orthographic camera (+z).
    triTop.push(a[0],d[0],b[0],b[0],d[0],c[0]);
    triBack.push(a[1],b[1],d[1],b[1],c[1],d[1]);
    const inside=(xx,yy)=>{
      if(xx<r.minX||xx>=r.minX+rw||yy<r.minY||yy>=r.minY+r.rh)return false;
      return !!r.mask[(yy-r.minY)*rw+(xx-r.minX)];
    };
    function side(q,s){
      // Outward-facing winding is consistent with the top's orientation,
      // and the double-sided material provides a safe fallback for thin rims.
      triWalls.push(q[0],q[1],s[0],s[0],q[1],s[1]);
    }
    if(!inside(x,y-1))side(a,b);
    if(!inside(x+1,y))side(b,c);
    if(!inside(x,y+1))side(c,d);
    if(!inside(x-1,y))side(d,a);
  }
  const faces=[...triTop,...triBack,...triWalls];
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setIndex(faces);
  geometry.addGroup(0,triTop.length,0);
  geometry.addGroup(triTop.length,triBack.length+triWalls.length,1);
  geometry.computeVertexNormals();
  return {geometry,frontTriangles:triTop.length/3,
    backTriangles:triBack.length/3,sideTriangles:triWalls.length/3,
    vertices:positions.length/3};
}
function pigmentMaterial(texture){
  const m=new THREE.MeshStandardMaterial({
    map:texture,roughness:.78,metalness:.015,side:THREE.DoubleSide
  });
  m.userData.ppV4Owned=true;return m;
}
function materialColor(hex,bronze=false,material='marker'){
  const colour=bronze?'#9a7f59':hex;
  const m=new THREE.MeshPhysicalMaterial({
    color:colour,roughness:bronze?.49:material==='oil'?.56:.82,
    metalness:bronze?.32:.045,clearcoat:material==='oil'?.18:.03,
    side:THREE.DoubleSide
  });
  m.userData.ppV4Owned=true;return m;
}
function genuineSourceStrokes(group,strokes,{depth,phiPull,colourMode,material,limit=18}){
  const original=(strokes||[]).filter(s=>s.sourceKind!=='pigment-contour'&&
    Array.isArray(s.points)&&s.points.length>2);
  // An extracted closed pigment boundary is NOT a real mark. Never use it.
  let count=0;
  for(const s of original.slice(0,limit)){
    const pts=s.points.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
    if(pts.length<3)continue;
    const curve=new THREE.CatmullRomCurve3(pts.map((p,j)=>{
      const t=j/Math.max(1,pts.length-1);
      const z=.025+depth*(.035+.055*phiPull*Math.sin(Math.PI*t));
      return new THREE.Vector3(p.x,p.y,z);
    }),false,'centripetal');
    const radius=clamp((s.width||.009)*.65,.0025,.015);
    const geometry=new THREE.TubeGeometry(curve,
      Math.min(90,Math.max(12,pts.length*2)),radius,9,false);
    const mesh=new THREE.Mesh(geometry,materialColor(
      s.color||'#70584b',colourMode==='bronze',material));
    mesh.name='Actual archived rendering gesture '+(s.sourceIndex??count);
    mesh.userData.ppV4Owned=true;group.add(mesh);count++;
  }
  return count;
}
export function buildV4Sculpture(method,{topology,texture,strokes=[],
  material='marker',fidelity=.90,phiPull=.8,depth=.85,
  colourMode='pigment',quality='desktop'}={}){
  if(!V4_METHODS.includes(method))throw Error('Unknown V4 method '+method);
  if(!topology?.regions?.length)throw Error('No source region available for inflation');
  if(!texture?.isTexture)throw Error('Archived painting texture required');
  const bronze=colourMode==='bronze';
  const group=new THREE.Group();group.name='Source topology V4 / '+method;
  const frontMaterial=bronze?materialColor('#9a7f59',true,material):pigmentMaterial(texture);
  const max=quality==='mobile'?23:32;
  let count=0,maxHeight=0,triangles=0,medial=0,poisson=0;
  const regions=topology.regions.slice(0,max);
  for(const r of regions){
    const type=method==='medial'?'medial':
      method==='gesture'?(r.aspect>=1.7?'medial':'poisson'):
      method==='assembly'?(r.aspect>2.2||r.id%3===1?'medial':'poisson'):
      'poisson';
    if(type==='medial')medial++;else poisson++;
    const {geometry,frontTriangles,backTriangles,sideTriangles}=regionGeometry(r,{
      mode:type,method,depth,phiPull,fidelity
    });
    const side=materialColor(r.color,bronze,material);
    const mesh=new THREE.Mesh(geometry,[frontMaterial,side]);
    mesh.name='Inflated actual pigment region '+r.id+' / '+type;
    mesh.userData={ppV4Owned:true,regionId:r.id,area:r.area,
      algorithm:type,sourceCenter:[r.centerX,r.centerY],
      areaAspect:r.aspect,sourceColor:r.color};
    group.add(mesh);
    count++;triangles+=frontTriangles+backTriangles+sideTriangles;
    maxHeight=Math.max(maxHeight,r.maxPotential);
  }
  let sourceStrokes=0;
  if(method==='gesture'||method==='assembly')
    sourceStrokes=genuineSourceStrokes(group,strokes,{
      depth,phiPull,colourMode,material,limit:quality==='mobile'?10:24
    });
  // User data makes topology available to browser tests and UI diagnostics.
  const box=new THREE.Box3().setFromObject(group);
  if(box.isEmpty())throw Error('V4 source regions produced no geometry');
  const ext=box.getSize(new THREE.Vector3());
  group.userData={
    engine:'region-inflation-v4',method,
    noImagePlane:true,noSilhouetteExtrusion:true,
    preservedOriginalXY:true,
    sourceBody:true,sourceStrokeCount:sourceStrokes,meshCount:group.children.length,
    regionCount:count,medialRegions:medial,poissonRegions:poisson,
    sourceCoverage:topology.covered/Math.max(1,topology.pigmented),
    originalShapeCount:topology.separateShapes,
    polygonTriangles:triangles,maximumPotential:maxHeight,
    localIndependentSolids:true,sourceColourOnFront:!bronze,
    extent:[ext.x,ext.y,ext.z],
    roundedSides:true,phiStructural:phiPull>0
  };
  return group;
}
export function disposeV4Sculpture(group){
  if(!group)return;
  const geometries=new Set(),materials=new Set();
  group.traverse(o=>{
    if(o.geometry)geometries.add(o.geometry);
    for(const m of Array.isArray(o.material)?o.material:(o.material?[o.material]:[])){
      if(m?.userData?.ppV4Owned)materials.add(m);
    }
  });
  group.removeFromParent();group.clear();
  for(const g of geometries)g.dispose();
  for(const m of materials)m.dispose();
  // Archive texture remains owned by the painting loader.
}
