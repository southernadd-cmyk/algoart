// PROPORTION PIECE Sculpture Lab V3 — source-anchored anamorphic construction.
// IMPORTANT: experimental lab module only. Gallery tower and publishing do not import it.
// The front XY of every recorded stroke remains unchanged. All new folds, ribs and
// returns are continuous solids growing BACKWARDS from those actual source marks.
import * as THREE from 'three';
import {buildMaterialSculpture,disposeMaterialSculpture,pigmentField} from './material-surface.mjs';

export const V3_METHODS=Object.freeze(['armature','fold','mass','hybrid']);
const PHI=(1+Math.sqrt(5))/2;
const GOLDEN_ANGLE=Math.PI*(3-Math.sqrt(5));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const FRONT=.69;
const W=1.34,H=1.88;

function colour(hex,bronze=false){
  return new THREE.MeshStandardMaterial({
    color:bronze?'#967c57':hex||'#61513d',roughness:bronze?.43:.66,
    metalness:bronze?.33:.015,side:THREE.DoubleSide
  });
}
function cleanPoints(stroke){
  const result=[];
  for(const p of stroke.points||[]){
    if(Number.isFinite(p.x)&&Number.isFinite(p.y)){
      const last=result[result.length-1];
      if(!last||Math.hypot(p.x-last.x,p.y-last.y)>.0003)
        result.push({x:p.x,y:p.y});
    }
  }
  // Sample by arc length (not point index): preserves actual mark topology.
  if(result.length<=72)return result;
  let total=0;
  const dist=[0];
  for(let i=1;i<result.length;i++){
    total+=Math.hypot(result[i].x-result[i-1].x,result[i].y-result[i-1].y);
    dist.push(total);
  }
  const sampled=[];let k=1;
  for(let i=0;i<72;i++){
    const target=total*i/71;
    while(k<dist.length-1&&dist[k]<target)k++;
    const a=result[k-1],b=result[k],t=clamp((target-dist[k-1])/Math.max(1e-8,dist[k]-dist[k-1]),0,1);
    sampled.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
  }
  return sampled;
}
function sourceMarks(strokes,features){
  const input=Array.isArray(strokes)&&strokes.length?strokes:(features.gestures||[]);
  return input.map((s,i)=>({...s,points:cleanPoints(s),sourceId:s.sourceIndex??i}))
    .filter(s=>s.points.length>=2)
    .sort((a,b)=>(b.score||b.weight||b.length||0)-(a.score||a.weight||a.length||0))
    .slice(0,115);
}
function makeTube(group,pts,radius,material,name,segments=40){
  if(pts.length<2)return;
  const curve=new THREE.CatmullRomCurve3(pts,false,'centripetal');
  const geometry=new THREE.TubeGeometry(curve,
    Math.max(8,Math.min(90,segments)),radius,7,false);
  const mesh=new THREE.Mesh(geometry,material);
  mesh.name=name;mesh.userData.ppV3Owned=true;group.add(mesh);
}
function materialFor(cache,s,bronze){
  const hex=bronze?'#967c57':s.color||'#665548';
  if(!cache.has(hex))cache.set(hex,colour(hex,bronze));
  return cache.get(hex);
}
function originalMarks(group,marks,bronze,quality){
  const cache=new Map();
  const count=Math.min(marks.length,quality==='mobile'?62:115);
  for(let i=0;i<count;i++){
    const s=marks[i],r=clamp((s.width||.012)*.78,.0038,.043);
    const pts=s.points.map(p=>new THREE.Vector3(p.x,p.y,FRONT+.004*(i%4)));
    makeTube(group,pts,r,materialFor(cache,s,bronze),
      'Recorded source mark '+s.sourceId,Math.max(12,pts.length*2));
  }
  return count;
}
function returnRibs(group,marks,bronze,{fidelity,depth,phiPull,quality,multiplier=1}){
  const cache=new Map(),count=Math.min(marks.length,quality==='mobile'?13:24);
  const drift=.012+.13*(1-fidelity);
  for(let i=0;i<count;i++){
    const s=marks[i],p=s.points;
    if(p.length<3)continue;
    const angle=i*GOLDEN_ANGLE*phiPull;
    const a=p[0],q=p[Math.floor((p.length-1)/3)],
      b=p[Math.floor((p.length-1)*2/3)],z=p[p.length-1];
    const r=clamp((s.width||.012)*.53,.008,.029)*multiplier;
    const shape=[
      new THREE.Vector3(a.x,a.y,FRONT),
      new THREE.Vector3(q.x,q.y,.16),
      new THREE.Vector3(q.x+drift*Math.cos(angle),q.y+drift*Math.sin(angle),-depth*.62),
      new THREE.Vector3(b.x+drift*Math.cos(angle+GOLDEN_ANGLE),b.y+drift*Math.sin(angle+GOLDEN_ANGLE),-depth),
      new THREE.Vector3(z.x,z.y,-depth*.12),
      new THREE.Vector3(z.x,z.y,FRONT)
    ];
    makeTube(group,shape,r,materialFor(cache,s,bronze),
      'Source-attached rear structural rib',45);
  }
}
function foldedMembranes(group,marks,bronze,{fidelity,depth,phiPull,quality}){
  const cache=new Map();
  const count=Math.min(marks.length,quality==='mobile'?11:19);
  for(let i=0;i<count;i++){
    const s=marks[i],pts=s.points;
    if(pts.length<3)continue;
    const positions=[],indices=[];
    const rows=Math.min(46,pts.length),bands=6;
    const amplitude=(.032+.23*(1-fidelity))*(i%3===0?PHI:1);
    const roll=i*GOLDEN_ANGLE*phiPull;
    for(let j=0;j<rows;j++){
      const t=j/(rows-1),ix=Math.round(t*(pts.length-1));
      const p=pts[ix],before=pts[Math.max(0,ix-1)],after=pts[Math.min(pts.length-1,ix+1)];
      const dx=after.x-before.x,dy=after.y-before.y;
      const norm=Math.max(1e-8,Math.hypot(dx,dy)),nx=-dy/norm,ny=dx/norm;
      for(let k=0;k<=bands;k++){
        const v=k/bands;
        const fold=Math.sin(Math.PI*v)*Math.sin(t*Math.PI*2+roll);
        const lateral=amplitude*v*(.3+.7*Math.sin(Math.PI*t)**2)+amplitude*.45*fold;
        // v=0 exactly matches the source curve; every other vertex goes into Z.
        const x=p.x+nx*lateral,y=p.y+ny*lateral;
        const z=FRONT-v*(FRONT+depth*(.52+.4*Math.sin(t*Math.PI+roll)**2));
        positions.push(x,y,z);
      }
    }
    for(let j=0;j<rows-1;j++)for(let k=0;k<bands;k++){
      const a=j*(bands+1)+k,b=(j+1)*(bands+1)+k;
      indices.push(a,b,a+1,b,b+1,a+1);
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setIndex(indices);geometry.computeVertexNormals();
    const mesh=new THREE.Mesh(geometry,materialFor(cache,s,bronze));
    mesh.name='Source-anchored folded membrane '+s.sourceId;
    mesh.userData.ppV3Owned=true;group.add(mesh);
  }
}
function pigmentBody(group,kind,{pixels,texture,material,paper,depth,quality}){
  if(!pixels||!texture)return false;
  // Actual source pigment controls the WHOLE body, not a painted card placed
  // in front of an unrelated sculpture. The rear is a continuous isosurface.
  const mode=kind==='fold'?'ribbon':kind==='armature'?'petal':
    kind==='mass'?'pigment':'hybrid';
  const profile=kind==='fold'?'fold':kind==='armature'?'spiral':
    kind==='mass'?'pebble':'shoulder';
  const body=buildMaterialSculpture(mode,pixels,texture,{
    depth:Math.max(.45,depth*.86),material,paper,quality,bodyProfile:profile
  });
  body.name='Original pigment grown into a three-dimensional surface';
  body.userData.ppV3Owned=true;
  group.add(body);
  return true;
}
export function buildAnamorphicSculpture(kind,{
  features,strokes=[],pixels=null,texture=null,material='marker',
  paper='#f5f0e6',fidelity=.88,phiPull=.80,depth=.85,colourMode='pigment',
  quality='desktop'
}={}){
  if(!V3_METHODS.includes(kind))throw Error('Unknown anamorphic method '+kind);
  if(!features)throw Error('Source analysis required');
  const opt={
    fidelity:clamp(fidelity,.5,1),phiPull:clamp(phiPull,0,1),
    depth:clamp(depth,.40,1.3),quality
  };
  const marks=sourceMarks(strokes,features);
  if(marks.length<1)throw Error('No original marks to construct');
  const group=new THREE.Group();
  group.name='Anamorphic sculpture V3 / '+kind;
  const bronze=colourMode==='bronze';
  let body=false;
  // Source pigments become volumetric matter for broad painted materials.
  // The Marker engine needs only its exact, continuous vector marks.
  if(kind==='mass'||kind==='hybrid'||material!=='marker'){
    body=pigmentBody(group,kind,{pixels,texture,material,paper,
      depth:opt.depth,quality});
  }
  const count=originalMarks(group,marks,bronze,quality);
  if(kind==='armature'){
    returnRibs(group,marks,bronze,{...opt,multiplier:1});
  }else if(kind==='fold'){
    foldedMembranes(group,marks,bronze,opt);
  }else if(kind==='mass'){
    returnRibs(group,marks,bronze,{...opt,multiplier:.65});
  }else{
    foldedMembranes(group,marks,bronze,opt);
    returnRibs(group,marks,bronze,{...opt,multiplier:.8});
  }
  const box=new THREE.Box3().setFromObject(group);
  if(box.isEmpty())throw Error('Anamorphic construction produced no geometry');
  const size=box.getSize(new THREE.Vector3());
  // These models share a single authoritative 1.34 x 1.88 drawing space.
  // NEVER rescale their XY independently: that would falsify the front match.
  group.userData={
    engine:'source-anchored-v3',method:kind,sourceKind:features.sourceKind,
    preservedOriginalXY:true,sourceStrokeCount:count,
    sourceBody:body,meshCount:group.children.reduce((v,c)=>v+(c.isMesh?1:c.children.length),0),
    noImagePlane:true,noSilhouetteExtrusion:true,
    extent:[size.x,size.y,size.z],phiStructural:true,
    fidelityTarget:opt.fidelity
  };
  return group;
}
export function measureFrontSilhouette(renderer,group,imageData,{material='marker',paper='#f5f0e6'}={}){
  if(!imageData)return null;
  const field=pigmentField(imageData,{material,paper});
  const w=field.width,h=field.height;
  const target=new THREE.WebGLRenderTarget(w,h,{depthBuffer:true});
  const scene=new THREE.Scene();
  const camera=new THREE.OrthographicCamera(-W/2,W/2,H/2,-H/2,.01,8);
  camera.position.set(0,0,4);camera.lookAt(0,0,0);
  const previous=renderer.getRenderTarget();
  const clearColour=renderer.getClearColor(new THREE.Color()).clone();
  const clearAlpha=renderer.getClearAlpha();
  const white=new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide});
  const pixels=new Uint8Array(w*h*4);
  try{
    scene.add(group);
    scene.overrideMaterial=white;
    renderer.setRenderTarget(target);
    renderer.setClearColor(0x000000,0);
    renderer.clear(true,true,true);
    renderer.render(scene,camera);
    renderer.readRenderTargetPixels(target,0,0,w,h,pixels);
  }finally{
    renderer.setRenderTarget(previous);
    renderer.setClearColor(clearColour,clearAlpha);
    scene.remove(group);
    scene.overrideMaterial=null;
    white.dispose();target.dispose();
  }
  let intersection=0,union=0,painted=0,projected=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const source=!!field.occupancy[y*w+x];
    // Readback is bottom-up; source image is top-down.
    const index=(h-1-y)*w+x;
    const rendered=pixels[index*4+3]>30;
    if(source)painted++;
    if(rendered)projected++;
    if(source&&rendered)intersection++;
    if(source||rendered)union++;
  }
  return {
    iou:union?intersection/union:0,
    precision:projected?intersection/projected:0,
    recall:painted?intersection/painted:0,
    pixels:[w,h],painted,projected,intersection
  };
}
export function disposeAnamorphicSculpture(group){
  if(!group)return;
  group.traverse(o=>{
    o.geometry?.dispose();
    if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])
      if(m?.userData?.ppOwned||m?.userData?.ppV3Owned)m.dispose();
  });
  group.removeFromParent();group.clear();
  // Source texture belongs to the loaded painting, not any sculpture.
}
