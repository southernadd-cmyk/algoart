// PROPORTION PIECE — JSCAD / 360-degree CSG studies.
// Geometry is invented by explicit φ/mark rules, never by model inference.
// JSCAD builds connected, watertight CSG solids; Three.js only displays them.
// No flat image planes, raster extrusion, external model generation, or texture wrapping.
import * as THREE from 'three';
import {buildSourceDetailLayer} from './source-echo.mjs';
import {buildRecordedSculptureLayer,buildMaterialContourLayer,disposeRecordedLayer}
  from './recorded-gestures.mjs';

const PHI=(1+Math.sqrt(5))/2;
const GOLDEN_ANGLE=Math.PI*(3-Math.sqrt(5));
const TAU=Math.PI*2;
const METHODS=['petal','ribbon','pigment','hybrid'];
const clamp=(a,lo,hi)=>Math.max(lo,Math.min(hi,a));
const toColor=(hex)=>new THREE.Color(hex);

export function selectCSGMarks(marks,max=12){
  if(!Array.isArray(marks)||!marks.length)throw new Error('No painted marks');
  const sorted=[...marks].filter(m=>Number.isFinite(m.x)&&Number.isFinite(m.y)&&m.color)
    .sort((a,b)=>b.mass-a.mass || a.x-b.x || a.y-b.y);
  if(!sorted.length)throw new Error('No usable painting marks');
  const chosen=[sorted[0]], remaining=sorted.slice(1);
  while(chosen.length<max && remaining.length){
    // Retain high-salience pigment AND spatial coverage. Golden-angle rules
    // are applied in Z only; mark XY is never scattered by the angle.
    const top=Math.max(1,...sorted.map(m=>m.mass||1));
    let best=-Infinity, bestIndex=0;
    for(let i=0;i<remaining.length;i++){
      const mark=remaining[i];
      const distance=Math.min(...chosen.map(m=>Math.hypot(mark.x-m.x,mark.y-m.y)));
      const score=.67*clamp(distance/.55,0,2)+
        .33*Math.sqrt(clamp((mark.mass||1)/top,0,1));
      if(score>best){best=score;bestIndex=i;}
    }
    chosen.push(remaining.splice(bestIndex,1)[0]);
  }
  return chosen.sort((a,b)=>a.y-b.y||a.x-b.x);
}

function jscadFeatures(jscad) {
  if(!jscad?.primitives?.sphere||!jscad?.hulls?.hullChain||
      !jscad?.booleans?.union||!jscad?.booleans?.subtract||
      !jscad?.geometries?.geom3?.toPolygons)
    throw new Error('JSCAD 2 modelling library is not available');
  const {sphere,cylinder}=jscad.primitives;
  const {scale,translate,rotateY,rotateX}=jscad.transforms;
  const {union,subtract}=jscad.booleans;
  const {hullChain,hull}=jscad.hulls;
  const {geom3}=jscad.geometries;
  const {measureVolume}=jscad.measurements;
  const ellipsoid=(pos,radii)=>translate(pos,scale(radii,sphere({radius:1,segments:10})));
  return {sphere,cylinder,scale,translate,rotateY,rotateX,
    union,subtract,hullChain,hull,geom3,measureVolume,ellipsoid};
}

function projected(mark,z,depth,flip=0) {
  const angle=(flip+1)*GOLDEN_ANGLE;
  return [
    mark.x*(z>.0?1:1/PHI)+Math.sin(angle)*Math.abs(z)*.17,
    mark.y*(z>.0?1:1/PHI)+Math.cos(angle)*Math.abs(z)*.14,
    z*depth
  ];
}

function regionRule(f,mode,region,idx,depth){
  const {ellipsoid,hullChain,union,hull}=f;
  const cx=region.reduce((n,m)=>n+m.x,0)/region.length;
  const cy=region.reduce((n,m)=>n+m.y,0)/region.length;
  const avg=region.reduce((n,m)=>n+m.span,0)/region.length;
  const ang=idx*GOLDEN_ANGLE;
  const shellBack=[
    cx/PHI+Math.cos(ang)*.20,
    cy/PHI+Math.sin(ang)*.15,
    -.56*depth
  ];
  const shellEdge=[
    cx*.83+Math.cos(ang)*(.25+avg/PHI/3),
    cy*.86+Math.sin(ang)*.19,
    -.19*depth
  ];
  const marks=region.map(m=>ellipsoid([m.x,m.y,.30*depth],[
    clamp(m.span*.24+.030,.055,.17),
    clamp(m.breadth*.33+.032,.055,.14),
    clamp((m.breadth*.30+.055)*depth,.067,.17*depth)
  ]));
  const rear=ellipsoid(shellBack,[.12,.12,.19*depth]);
  const edge=ellipsoid(shellEdge,[.10,.09,.13*depth]);
  if(mode==='petal'){
    const fin=ellipsoid([cx,cy,.45*depth],[.10+avg*.17,.105,.095*depth]);
    // A connected, curved lobe grows from the genuine front mark positions
    // into a lateral wing, then returns to the rear armature.
    return hullChain(...marks,fin,edge,rear);
  }
  if(mode==='ribbon'){
    const lateral=ellipsoid([cx+Math.cos(ang)*.31,cy+Math.sin(ang)*.27,
      -.01*depth],[.095,.085,.13*depth]);
    const lower=ellipsoid([cx/PHI+Math.sin(ang)*.28,
      cy/PHI+Math.cos(ang)*.22,-.36*depth],[.10,.10,.12*depth]);
    return hullChain(...marks,lateral,edge,lower,rear);
  }
  if(mode==='pigment'){
    const blobs=marks.map((part,i)=>{
      const m=region[i];
      const back=ellipsoid(projected(m,-.54,depth,idx+i),[
        clamp(m.span*.32+.065,.095,.26),
        clamp(m.breadth*.58+.065,.10,.23),
        .19*depth
      ]);
      return hull(part,back);
    });
    return union(...blobs,hull(edge,rear));
  }
  throw new Error('Unsupported region rule '+mode);
}

function buildSpine(f,depth){
  const {ellipsoid,hullChain}=f;
  const joints=[];
  for(let i=0;i<=7;i++){
    const u=i/7,a=u*TAU*PHI;
    joints.push(ellipsoid([
      Math.cos(a)*(.07+.06/PHI),
      (u-.5)*1.35,
      (-.53-.13*u)*depth
    ],[.10,.095,.115*depth]));
  }
  return hullChain(...joints);
}

function voidCutter(f,depth,offset=[0,0]){
  const {cylinder,rotateY,translate}=f;
  return translate([offset[0],offset[1],-.38*depth],rotateY(Math.PI/2,
    cylinder({radius:.085,height:2.0,segments:12})));
}

function safePolygons(f,solid){
  const polygons=f.geom3.toPolygons(solid);
  if(!Array.isArray(polygons)||!polygons.length)
    throw new Error('CSG shape has no polygon surfaces');
  return polygons;
}

function nearestPigment(pos,marks,depth) {
  const [x,y,z]=pos;
  let best=marks[0],cost=Infinity;
  // Front retains mark locality; side/back becomes a φ-related material echo.
  const factor=z<0?PHI:1;
  for(const mark of marks){
    const d=(x*factor-mark.x)**2+(y*factor-mark.y)**2;
    if(d<cost){cost=d;best=mark;}
  }
  const color=toColor(best.color);
  const shade=1-(Math.max(0,-z)/Math.max(depth,.1))*.17;
  color.multiplyScalar(shade);
  return color;
}

export function jscadSolidToThree(solid,marks,depth,jscad) {
  const f=jscadFeatures(jscad);
  const polygons=safePolygons(f,solid);
  const positions=[],colors=[];
  let skipped=0;
  for(const poly of polygons){
    const pts=poly.vertices;
    if(!pts||pts.length<3){skipped++;continue;}
    // JSCAD geom3 polygons are convex, so a fan triangulates their boundary.
    for(let i=1;i<pts.length-1;i++){
      const triangle=[pts[0],pts[i],pts[i+1]];
      for(const point of triangle){
        positions.push(point[0],point[1],point[2]);
        const color=nearestPigment(point,marks,depth);
        colors.push(color.r,color.g,color.b);
      }
    }
  }
  if(!positions.length)throw new Error('CSG converted to empty triangle mesh');
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  const mat=new THREE.MeshStandardMaterial({
    vertexColors:true,side:THREE.DoubleSide,roughness:.56,metalness:.10
  });
  mat.userData.ppOwned=true;
  const mesh=new THREE.Mesh(geo,mat);
  mesh.userData={ppOwned:true,csgPolygons:polygons.length,skippedPolygons:skipped};
  return mesh;
}

/** Four experiments, one painting. Each is built from explicit JSCAD solids.
 * Region bodies merge with a common rear spine, so they are not disconnected
 * petals. A cross-cut at the rear produces negative space rather than simply
 * painting a dark spot on a mesh. Hybrid uses actual CSG unions and subtract. */
export function buildJSCADSculpture(method,marks,jscad,{depth=1,debugSolid=false,fidelity=.85,sourceData=null}={}) {
  if(!METHODS.includes(method))throw new Error('Invalid CSG method');
  const f=jscadFeatures(jscad);
  const selected=selectCSGMarks(marks,12);
  const numGroups=Math.min(6,Math.max(3,Math.ceil(selected.length/2)));
  // Farthest-first spatial seeds; avoid connecting unrelated strokes into
  // huge flat ribbons merely because they share a colour.
  const centres=[selected[0]];
  while(centres.length<numGroups&&centres.length<selected.length) {
    let best=-1, next=null;
    for(const mark of selected) {
      if(centres.includes(mark))continue;
      const distance=Math.min(...centres.map(c=>Math.hypot(
        mark.x-c.x,mark.y-c.y)));
      if(distance>best){best=distance;next=mark;}
    }
    if(!next)break;
    centres.push(next);
  }
  const groups=centres.map(()=>[]);
  for(const mark of selected) {
    const colour=new THREE.Color(mark.color);
    const best=centres.map((centre,i)=>{
      const c=new THREE.Color(centre.color);
      const colourDistance=Math.hypot(colour.r-c.r,colour.g-c.g,colour.b-c.b);
      const spatial=Math.hypot(mark.x-centre.x,mark.y-centre.y);
      return {i,cost:spatial+colourDistance*.11};
    }).sort((a,b)=>a.cost-b.cost||a.i-b.i)[0];
    groups[best.i].push(mark);
  }
  // Source position defines region order; golden angle develops only the back.
  // Some regions are larger: no assumption that RGB segmentation yields a
  // specific number of elements across oil, tissue and watercolour.
  const forms=[];
  for(let i=0;i<groups.length;i++){
    if(!groups[i].length)continue;
    let type=method;
    if(method==='hybrid'){
      const kinds=groups[i].map(m=>m.kind);
      type=kinds.includes('stroke')?'ribbon':
        kinds.includes('field')?'petal':'pigment';
    }
    const regionSolid=regionRule(f,type,groups[i],i,depth);
    const cx=groups[i].reduce((n,m)=>n+m.x,0)/groups[i].length;
    const cy=groups[i].reduce((n,m)=>n+m.y,0)/groups[i].length;
    const ang=i*GOLDEN_ANGLE;
    const rear=[cx/PHI+Math.cos(ang)*.20,
      cy/PHI+Math.sin(ang)*.15,-.56*depth];
    // Join EVERY local sculptural region to a precise joint of the rear
    // spine. Without this, a boolean union can still contain disconnected
    // shells, even though Three.js renders it as one mesh.
    const jointIndex=clamp(Math.round((cy+.675)/1.35*7),0,7);
    const u=jointIndex/7,theta=u*TAU*PHI;
    const spineJoint=[
      Math.cos(theta)*(.07+.06/PHI),
      (u-.5)*1.35,
      (-.53-.13*u)*depth
    ];
    const bridge=f.hull(
      f.ellipsoid(rear,[.103,.103,.13*depth]),
      f.ellipsoid(spineJoint,[.103,.103,.13*depth])
    );
    forms.push(f.union(regionSolid,bridge));
  }
  if(!forms.length)throw new Error('Could not construct any CSG bodies');
  const spine=buildSpine(f,depth);
  const joined=f.union(spine,...forms);
  const baseVolume=Math.abs(f.measureVolume(joined));
  // A rear side-to-side passage is purposefully subtracted through the merged
  // body. This is genuine 3D negative space, not a drawn circular mask.
  const through=voidCutter(f,depth);
  const hollowed=f.subtract(joined,through);
  const resultVolume=Math.abs(f.measureVolume(hollowed));
  const useCut=Number.isFinite(resultVolume)&&resultVolume>0&&resultVolume<baseVolume-.00001;
  const final=useCut?hollowed:joined;
  const mesh=jscadSolidToThree(final,selected,depth,jscad);
  const group=new THREE.Group();
  // Source-facing detail remains legible in the original image XY.
  // Recede and narrow the JSCAD bulk rather than projecting broad joined
  // solids through the original drawing's negative space.
  const resemblance=clamp(fidelity,0,1);
  mesh.position.z-=.15*depth+.19*depth*resemblance;
  const coreXY=1-.25*resemblance;
  mesh.scale.set(coreXY,coreXY,1);
  group.add(mesh);
  // Only use the heuristic centroid-gesture reconstruction as a fallback.
  // The recorded original path and material boundary take priority.
  const exactStrokes=sourceData?.strokes||[];
  let sourceLayer=exactStrokes.length
    ?buildRecordedSculptureLayer(exactStrokes,{
       depth,fidelity:resemblance,quality:sourceData.quality||'desktop'
     })
    :buildSourceDetailLayer(marks,{depth,fidelity:resemblance});
  group.add(sourceLayer);
  let contourLayer=null;
  if(sourceData?.material!=='marker'&&sourceData?.materialContours?.length){
    contourLayer=buildMaterialContourLayer(sourceData.materialContours,{
      depth,fidelity:resemblance,quality:sourceData.quality||'desktop'
    });
    if(contourLayer.userData.contours>0)group.add(contourLayer);
    else disposeRecordedLayer(contourLayer);
  }
  group.name='JSCAD '+method+' / true fused CSG';
  group.userData={
    ...(debugSolid?{rawCSG:final}:{}),
    engine:'jscad-csg-v1',
    method,
    fidelity:clamp(fidelity,0,1),
    sourceTraceCount:sourceLayer.userData.sourceTraceCount||
      sourceLayer.userData.recordedFront||0,
    sourceOrigin:exactStrokes.length?'original-engine-recorded':
      contourLayer?.userData.contours?'archived-pigment-contours':'sampled-pixels-fallback',
    sourceOriginalPoints:sourceLayer.userData.originalPointCount||0,
    materialContours:contourLayer?.userData.contours||0,
    sourceDetailAnchors:sourceLayer.userData.sourceAnchors||
      exactStrokes.map(a=>({x:a.points[0]?.x,y:a.points[0]?.y,color:a.color})),
    coreRecess:.15*depth+.19*depth*resemblance,
    noImageExtrusion:true,
    noModelInference:true,
    sourceAnchors:selected.map(m=>({x:m.x,y:m.y,color:m.color,kind:m.kind})),
    csgFragments:forms.length,
    inputVolume:baseVolume,
    outputVolume:useCut?resultVolume:baseVolume,
    subtractApplied:useCut,
    csgPolygons:mesh.userData.csgPolygons
  };
  return group;
}

export function disposeJSCADSculpture(group) {
  if(!group)return;
  const geos=new Set(),mats=new Set();
  group.traverse(o=>{
    if(o.geometry)geos.add(o.geometry);
    if(o.material){
      for(const m of (Array.isArray(o.material)?o.material:[o.material]))
        if(m.userData?.ppOwned)mats.add(m);
    }
  });
  group.removeFromParent();group.clear();
  for(const g of geos)g.dispose();
  for(const m of mats)m.dispose();
}
