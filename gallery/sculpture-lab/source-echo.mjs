// PROPORTION PIECE — deterministic source-mark surface gestures.
// Retains the painting's XY gestures while the JSCAD core develops a
// separate, connected 3D form behind them. These are true round tubes and
// volumetric pigment masses, not a flat image texture or linear extrusion.
import * as THREE from 'three';

const PHI=(1+Math.sqrt(5))/2;
const GOLDEN_ANGLE=Math.PI*(3-Math.sqrt(5));
const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));
const vector=(x,y,z)=>new THREE.Vector3(x,y,z);

export function selectSourceDetailMarks(marks,max=48) {
  const candidates=marks.filter(m=>Number.isFinite(m.x)&&Number.isFinite(m.y)&&
    m.color&&Number.isFinite(m.angle)&&Number.isFinite(m.span)&&Number.isFinite(m.breadth));
  if(!candidates.length)return [];
  const ordered=[...candidates].sort((a,b)=>(b.mass||0)-(a.mass||0)||a.y-b.y||a.x-b.x);
  const selected=[ordered[0]],remaining=ordered.slice(1);
  const limit=Math.min(max,ordered.length);
  const peak=Math.max(1,...ordered.map(m=>m.mass||0));
  while(selected.length<limit&&remaining.length) {
    let best=-Infinity,position=0;
    for(let i=0;i<remaining.length;i++) {
      const m=remaining[i];
      const dist=Math.min(...selected.map(o=>Math.hypot(m.x-o.x,m.y-o.y)));
      const color=new THREE.Color(m.color);
      const colorDist=Math.min(...selected.map(o=>{
        const prev=new THREE.Color(o.color);
        return Math.hypot(color.r-prev.r,color.g-prev.g,color.b-prev.b);
      }));
      // Spatial and palette coverage prevent light gestures from being lost
      // merely because dense oil paint regions have larger pixel mass.
      const score=.53*clamp(dist/.24,0,1.6)+
        .28*clamp(colorDist/.4,0,1)+
        .19*Math.sqrt(clamp((m.mass||0)/peak,0,1));
      if(score>best){best=score;position=i;}
    }
    selected.push(remaining.splice(position,1)[0]);
  }
  return selected.sort((a,b)=>a.y-b.y||a.x-b.x);
}

function material(hex,shade=1) {
  const m=new THREE.MeshStandardMaterial({
    color:new THREE.Color(hex).multiplyScalar(shade),
    metalness:.06,roughness:.56,
    side:THREE.DoubleSide
  });
  m.userData.ppOwned=true;
  return m;
}

function returnPath(mark,index,depth,fidelity) {
  const a=mark.angle,ux=Math.cos(a),uy=Math.sin(a);
  const reach=clamp(mark.span*.45,.025,.19);
  // The *front* line is entirely in source XY, at three separate 3D
  // heights; the return curves inward and around behind the sculpture.
  const z=.52*depth;
  const front0=vector(mark.x-ux*reach,mark.y-uy*reach,z-.04*depth);
  const centre=vector(mark.x,mark.y,z+.07*depth);
  const front1=vector(mark.x+ux*reach,mark.y+uy*reach,z-.02*depth);
  const ang=index*GOLDEN_ANGLE;
  const drift=(1-fidelity)*.14+.035;
  const side=vector(mark.x+ux*reach+Math.cos(ang)*drift,
    mark.y+uy*reach+Math.sin(ang)*drift,.04*depth);
  const rear=vector(mark.x/PHI+Math.cos(ang)*.09,
    mark.y/PHI+Math.sin(ang)*.09,-.41*depth);
  return [front0,centre,front1,side,rear];
}

/** A source stroke becomes a round, bent, fully three-dimensional branch
 * whose visible front run is anchored to the real painting. Dense marks also
 * receive non-planar pigment masses at the original positions. */
export function buildSourceDetailLayer(marks,{depth=1,fidelity=.85,maxMarks=80}={}) {
  const f=clamp(fidelity,0,1);
  const num=Math.min(maxMarks,Math.round(8+f*66));
  const chosen=selectSourceDetailMarks(marks,num);
  const group=new THREE.Group();
  group.name='Source-faithful 3D front gestures';
  const materialCache=new Map();
  function pigment(hex,shade=1) {
    const key=hex+'/'+shade;
    if(!materialCache.has(key))materialCache.set(key,material(hex,shade));
    return materialCache.get(key);
  }
  let strokes=0,masses=0;
  for(let i=0;i<chosen.length;i++){
    const mark=chosen[i],path=returnPath(mark,i,depth,f);
    const width=clamp(mark.breadth*.22+.011,.013,.053);
    const isField=mark.kind==='field';
    if(isField || mark.kind==='spot') {
      const rx=clamp(mark.span*.19+.025,.042,.115);
      const ry=clamp(mark.breadth*.31+.022,.035,.11);
      const rz=clamp((rx+ry)/PHI,.04,.115)*depth;
      const head=new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),
        pigment(mark.color));
      // Image-space orientation is not lost: ellipsoid major axis follows
      // its extracted mark covariance, not the golden-angle sequence.
      head.position.set(mark.x,mark.y,.53*depth);
      head.scale.set(rx,ry,rz);
      head.rotation.z=mark.angle;
      head.userData.ppOwned=true;
      head.name='Source pigment mass in three dimensions';
      head.userData.originalXY=[mark.x,mark.y];
      group.add(head);masses++;
    }
    const curve=new THREE.CatmullRomCurve3(path,false,'centripetal');
    const thickness=isField ? width*.75 : width;
    const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,20,thickness,7,false),
      pigment(mark.color));
    mesh.name='Source mark curved into the third dimension';
    mesh.userData.ppOwned=true;
    mesh.userData.originalXY=[mark.x,mark.y];
    mesh.userData.frontDirection=mark.angle;
    group.add(mesh);strokes++;
  }
  group.userData={
    engine:'source-echo-v1',fidelity:f,
    sourceTraceCount:chosen.length,
    sourceStrokes:strokes,sourceMasses:masses,
    sourceAnchors:chosen.map(m=>({
      x:m.x,y:m.y,color:m.color,angle:m.angle,kind:m.kind
    })),
    allRound:true,noImageExtrusion:true
  };
  return group;
}
