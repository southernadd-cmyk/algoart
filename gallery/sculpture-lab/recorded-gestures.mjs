// PROPORTION PIECE — source-fidelity geometry from actual renderer recordings.
// The marker engine's precise SVG paths already encode the hand's wobble,
// original curves, pass order, stroke width and dash gaps. We translate those
// points into true curved 3D threads without moving the source's image XY.
// For mixed media, gate source strokes against the *visible* archived pigment.
import * as THREE from 'three';
import {selectRecordedPaths,strokeSections,portraitCoords} from '../visit/vector-geometry.mjs';
import {estimatePaper,pigmentOpacity} from '../visit/paper-isolation.mjs';

const PHI=(1+Math.sqrt(5))/2,TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function colourFromCSS(str) {
  try{return new THREE.Color(str);}catch{return new THREE.Color('#45413a');}
}
function pigmentAt(imageData, x, y, type, paper) {
  if(!imageData)return null;
  const ix=clamp(Math.round(x/imageData.sourceWidth*imageData.width),0,imageData.width-1);
  const iy=clamp(Math.round(y/imageData.sourceHeight*imageData.height),0,imageData.height-1);
  const offset=4*(iy*imageData.width+ix);
  const a=imageData.data[offset+3]/255;
  const r=imageData.data[offset],g=imageData.data[offset+1],b=imageData.data[offset+2];
  return {r,g,b,opacity:a*pigmentOpacity(r,g,b,paper,type)};
}
function assessVisible(section,capture,material,imageData,paper) {
  if(material==='marker'||!imageData)return {coverage:1,color:null};
  let hits=0,total=0,weight=0,r=0,g=0,b=0;
  const stride=Math.max(1,Math.floor(section.length/16));
  for(let i=0;i<section.length;i+=stride){
    const p=section[i];
    const sample=pigmentAt(imageData,p.x,p.y,material,paper);
    if(!sample)continue;
    total++;
    if(sample.opacity>.2){
      hits++;weight+=sample.opacity;
      r+=sample.r*sample.opacity;
      g+=sample.g*sample.opacity;
      b+=sample.b*sample.opacity;
    }
  }
  if(!total||!weight)return {coverage:0,color:null};
  const color=new THREE.Color().setRGB(r/weight/255,g/weight/255,b/weight/255,
    THREE.SRGBColorSpace);
  return {coverage:hits/total,color:'#'+color.getHexString()};
}
function lineLen(points) {
  let sum=0;
  for(let i=1;i<points.length;i++)sum+=Math.hypot(points[i].x-points[i-1].x,
    points[i].y-points[i-1].y);
  return sum;
}
function makeMaterial(hex,opacity=1){
  const mat=new THREE.MeshBasicMaterial({
    color:colourFromCSS(hex),toneMapped:false,side:THREE.DoubleSide,
    transparent:opacity<.97,opacity:clamp(opacity,.18,1),
    depthWrite:opacity>=.97
  });
  mat.userData.ppOwned=true;
  return mat;
}
/** Exposes real recorded source lines, not centroids inferred from a raster.
 * No JSCAD is needed for the front: JSCAD builds and carves the rear body.
 * Original point coordinates are retained verbatim as source evidence. */
export function prepareOriginalStrokes(capture, {
  material='marker',imageData=null,maxPaths=64,minimumCoverage=.32
}={}) {
  if(!capture||!Array.isArray(capture.paths)||!capture.width||!capture.height)
    throw Error('Exact renderer source capture is required');
  const widths={marker:1,tissue:.85,watercolour:1.3,oil:1.25,action:1.2};
  const profile=widths[material]||1;
  const selected=selectRecordedPaths(capture,'desktop');
  const paper=imageData?estimatePaper(imageData,'#f5f0e6'):null;
  const ranked=[];
  for(const stroke of selected){
    const chunks=strokeSections(stroke).sort((a,b)=>lineLen(b)-lineLen(a));
    let emitted=0;
    for(const section of chunks){
      if(emitted>=3)break;
      const length=lineLen(section);
      if(section.length<2 || length<4)continue;
      const visibility=assessVisible(section,capture,material,imageData,paper);
      if(material!=='marker'&&imageData&&visibility.coverage<minimumCoverage)continue;
      const points=portraitCoords(section,capture.width,capture.height);
      const color=visibility.color||stroke.stroke;
      const s={
        sourceIndex:stroke.i,
        points,strokeWidth:stroke.width,
        opacity:stroke.opacity,kind:'source-stroke',
        color,sourceColor:stroke.stroke,
        coverage:visibility.coverage,
        length:lineLen(points),score:stroke.score*(.35+.65*visibility.coverage),
        width:clamp(
          stroke.width*Math.min(1.34/capture.width,1.88/capture.height)*profile*.85,
          .004,.035)
      };
      ranked.push(s);emitted++;
    }
  }
  ranked.sort((a,b)=>b.score-a.score||a.sourceIndex-b.sourceIndex);
  const total=Math.min(maxPaths,ranked.length);
  const keep=new Set(ranked.slice(0,Math.floor(total*.72)));
  const remain=total-keep.size;
  const byOrder=[...ranked].sort((a,b)=>a.sourceIndex-b.sourceIndex);
  for(let i=0;i<remain&&byOrder.length;i++)keep.add(byOrder[
    Math.min(byOrder.length-1,Math.floor((i+.5)*byOrder.length/remain))]);
  return [...keep].slice(0,maxPaths).sort((a,b)=>a.sourceIndex-b.sourceIndex);
}
export function buildRecordedSculptureLayer(strokes, {
  depth=1,fidelity=.85,quality='desktop'
}={}){
  const group=new THREE.Group();
  group.name='Exact original engine paths — volumetric gestures';
  const limit=Math.round((quality==='mobile'?27:48)+(quality==='mobile'?20:52)*clamp(fidelity,0,1));
  const chosen=strokes.slice(0,limit);
  const cache=new Map();
  function surface(hex,opacity) {
    const key=hex+'|'+Math.round(opacity*10);
    if(!cache.has(key))cache.set(key,makeMaterial(hex,opacity));
    return cache.get(key);
  }
  let front=0,returns=0;
  for(let i=0;i<chosen.length;i++){
    const s=chosen[i];
    const pts=s.points;
    if(pts.length<2)continue;
    // Preserve every source XY point; z's small wave is an explicit 3D
    // gesture, not 2D extrusion. The front remains image-faithful head-on.
    const vectors=pts.map((p,j)=>new THREE.Vector3(
      p.x,p.y,depth*(.56+.023*Math.sin(Math.PI*j/Math.max(1,pts.length-1)))));
    const curve=new THREE.CatmullRomCurve3(vectors,false,'centripetal');
    const radius=clamp(s.width*.85+.002,.005,.032);
    const geometry=new THREE.TubeGeometry(curve,
      Math.min(48,Math.max(8,pts.length*2)),radius,6,false);
    const obj=new THREE.Mesh(geometry,surface(s.color,Math.max(.52,s.opacity)));
    obj.name='Actual renderer stroke, original XY, shaped in 3D';
    obj.userData={
      ppOwned:true,sourceFacing:true,originalPoints:pts,
      originalColor:s.color,sourceIndex:s.sourceIndex,recorded:true,
      imageSpaceMaxError:0,materialVisibility:s.coverage
    };
    group.add(obj);front++;
    // Controlled three-dimensional growth towards the JSCAD interior.
    // Only some real paths acquire a return, otherwise sparse paintings
    // look like a web of invented lines from the front.
    if(i%8===0 && s.length>.035){
      const p=pts[pts.length-1],angle=i*Math.PI*(3-Math.sqrt(5));
      const returnPoints=[
        vectors[vectors.length-1],
        new THREE.Vector3(p.x,p.y,.12*depth),
        new THREE.Vector3(
          p.x/PHI+Math.cos(angle)*.09,
          p.y/PHI+Math.sin(angle)*.07,
          -.30*depth)
      ];
      const returnCurve=new THREE.CatmullRomCurve3(returnPoints);
      const pipe=new THREE.Mesh(new THREE.TubeGeometry(returnCurve,14,
        radius*.59,6,false),surface(s.color,.8));
      pipe.name='φ-rule return of original drawn stroke';
      pipe.userData={ppOwned:true,returnBranch:true,recorded:true};
      group.add(pipe);returns++;
    }
  }
  group.userData={
    engine:'recorded-source-v1',
    recordedPaths:chosen.length,recordedFront:front,
    recordedReturns:returns,originalPointCount:chosen.reduce(
      (n,s)=>n+s.points.length,0),
    imageSpaceMaxError:0,allRound:true
  };
  return group;
}
/** Actual pigment boundaries from the archive's material contour bake, not
 * marker-svg paths masquerading as finished oil/watercolour brush marks.
 * Closed polylines become sculpted round coloured loops that turn in Z; the
 * JSCAD core remains responsible for volume and connectivity. */
export function buildMaterialContourLayer(entries, {
  depth=1,fidelity=.85,quality='desktop'
}={}) {
  const group=new THREE.Group();
  group.name='Archived rendered-pigment contour returns';
  const candidates=(entries||[]).filter(e=>
    e.kind==='paint'&&Array.isArray(e.points)&&e.points.length>=3&&
    e.points.length<=700&&e.color);
  const ranked=candidates.map((e,i)=>{
    let area=0;
    for(let j=0;j<e.points.length;j++){
      const a=e.points[j],b=e.points[(j+1)%e.points.length];
      area+=a[0]*b[1]-a[1]*b[0];
    }
    return {e,i,area:Math.abs(area)/2};
  }).filter(x=>x.area>.0004)
    .sort((a,b)=>b.area-a.area||a.i-b.i);
  const limit=Math.min(ranked.length,
    Math.round((quality==='mobile'?9:13)+(quality==='mobile'?5:11)*fidelity));
  const cache=new Map();
  let contours=0;
  for(const {e} of ranked.slice(0,limit)){
    // Work with the actually baked polygon outline from the finished paint.
    const stride=Math.max(1,Math.ceil(e.points.length/55));
    const sampled=e.points.filter((_,i)=>i%stride===0)
      .map(p=>new THREE.Vector3(p[0],p[1],.48*depth));
    if(sampled.length<3)continue;
    const first=sampled[0];
    if(sampled[sampled.length-1].distanceTo(first)>.002)sampled.push(first.clone());
    const colour=e.side||e.color;
    if(!cache.has(colour))cache.set(colour,makeMaterial(colour,.94));
    const curve=new THREE.CatmullRomCurve3(sampled,true,'centripetal');
    const radius=clamp(.008+Math.sqrt(Math.max(.0004,e.depth||.02))*.025,
      .009,.027);
    const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,
      Math.min(80,Math.max(18,sampled.length*2)),radius,7,true),
      cache.get(colour));
    mesh.name='Original painted-region boundary as shaped 3D loop';
    mesh.userData={ppOwned:true,materialContour:true,sourcePoints:e.points};
    group.add(mesh);contours++;
  }
  group.userData={
    engine:'archived-material-contours-v1',contours,
    source:'baked actual final material boundaries',allRound:true
  };
  return group;
}
export function disposeRecordedLayer(group){
  if(!group)return;
  const geos=new Set(),materials=new Set();
  group.traverse(o=>{
    if(o.geometry)geos.add(o.geometry);
    if(o.material)for(const m of (Array.isArray(o.material)?o.material:[o.material]))
      if(m.userData?.ppOwned)materials.add(m);
  });
  group.removeFromParent();group.clear();
  geos.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
}
