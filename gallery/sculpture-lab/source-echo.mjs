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
    m.color&&Number.isFinite(m.angle??0)&&Number.isFinite(m.span)&&Number.isFinite(m.breadth));
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
  const ink=new THREE.Color(hex).multiplyScalar(shade);
  // Frontal marks retain the source image's actual sRGB colours; shaded
  // sculptural continuations are separate materials farther behind them.
  const m=shade>=.99
    ?new THREE.MeshBasicMaterial({color:ink,toneMapped:false,side:THREE.DoubleSide})
    :new THREE.MeshStandardMaterial({
      color:ink,metalness:.03,roughness:.68,side:THREE.DoubleSide
    });
  m.userData.ppOwned=true;
  return m;
}

function returnPath(mark,index,depth,fidelity) {
  const a=mark.angle??0,ux=Math.cos(a),uy=Math.sin(a);
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
  let strokes=0,masses=0,returns=0;
  for(let i=0;i<chosen.length;i++){
    const mark=chosen[i],path=returnPath(mark,i,depth,f);
    const frontRadius=clamp(mark.breadth*.12+.010,.011,.029);
    const isField=mark.kind==='field';
    if(isField || mark.kind==='spot') {
      const rx=clamp(mark.span*.14+.013,.025,.077);
      const ry=clamp(mark.breadth*.23+.014,.024,.073);
      const rz=clamp((rx+ry)/PHI,.028,.075)*depth;
      const head=new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),
        pigment(mark.color));
      head.position.set(mark.x,mark.y,.56*depth);
      head.scale.set(rx,ry,rz);
      head.rotation.z=mark.angle??0;
      head.userData.ppOwned=true;
      head.name='Small sculptural pigment mark at source XY';
      head.userData.originalXY=[mark.x,mark.y];
      group.add(head);masses++;
    }
    // A *short* rounded physical stroke reproduces the actual orientation
    // and position of each source gesture; it bends slightly in Z.
    // Long return branches no longer drown out the source composition.
    const frontCurve=new THREE.CatmullRomCurve3(path.slice(0,3),false,'centripetal');
    const front=new THREE.Mesh(new THREE.TubeGeometry(frontCurve,14,frontRadius,7,false),
      pigment(mark.color));
    front.name='Colour-faithful front mark — original XY and direction';
    front.userData.ppOwned=true;
    front.userData.originalXY=[mark.x,mark.y];
    front.userData.frontDirection=mark.angle??0;
    front.userData.sourceFacing=true;
    group.add(front);strokes++;
    // One in three selected marks becomes a narrow 3D return, allowing the
    // rest to retain whitespace from the actual painting when seen head-on.
    if(i%3===0){
      const tailCurve=new THREE.CatmullRomCurve3(path.slice(2),false,'centripetal');
      const tail=new THREE.Mesh(new THREE.TubeGeometry(tailCurve,15,
        Math.max(.010,frontRadius*.56),6,false),pigment(mark.color,.82));
      tail.name='Thin φ-controlled return behind source gesture';
      tail.userData.ppOwned=true;
      tail.userData.returnBranch=true;
      group.add(tail);returns++;
    }
  }
  group.userData={
    engine:'source-echo-v1',fidelity:f,
    sourceTraceCount:chosen.length,
    sourceStrokes:strokes,sourceMasses:masses,returnBranches:returns,
    sourceAnchors:chosen.map(m=>({
      x:m.x,y:m.y,color:m.color,angle:m.angle??0,kind:m.kind
    })),
    allRound:true,noImageExtrusion:true
  };
  return group;
}
