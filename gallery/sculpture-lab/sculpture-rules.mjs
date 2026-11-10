// PROPORTION PIECE — rule-based sculpture translation V1.
// No generated-model inference, learned weights, network requests or raster extrusions.
// The painting supplies pigment clusters, colour, centroids and mark orientation.
// Hand-authored rules determine the complete front, sides and back of every object.
import * as THREE from 'three';
import {estimatePaper, pigmentOpacity} from '../visit/paper-isolation.mjs';

export const PHI = (1 + Math.sqrt(5)) / 2;
export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
export const METHODS = Object.freeze(['petal', 'ribbon', 'pigment', 'hybrid']);
const TAU = Math.PI * 2;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const rgb = (r,g,b) => '#' + [r,g,b].map(n=>Math.round(clamp(n,0,255)).toString(16).padStart(2,'0')).join('');
const v3 = (x,y,z) => new THREE.Vector3(x,y,z);
const inkColour = color => new THREE.Color(color);
const OWNED = 'ppRuleSculptureOwned';

function makeMaterial(color, metalness=.1) {
  const m = new THREE.MeshStandardMaterial({color, metalness, roughness:.52, side: THREE.DoubleSide});
  m.userData[OWNED] = true;
  return m;
}

function tileFeatures(imageData, {material='marker', paper='#f5f0e6'}={}) {
  const {width:w,height:h,data}=imageData;
  if (!(w > 0 && h > 0 && data && data.length >= 4*w*h))
    throw new Error('A real source image is required for rule-based sculpture');
  const background = estimatePaper(imageData, paper);
  const block = 6;
  const nx = Math.ceil(w/block), ny = Math.ceil(h/block);
  const tiles = new Array(nx*ny).fill(null);
  for (let ty=0;ty<ny;ty++) for (let tx=0;tx<nx;tx++) {
    let weight=0, xw=0, yw=0, rw=0, gw=0, bw=0, inkPixels=0;
    for(let y=ty*block;y<Math.min(h,(ty+1)*block);y++) {
      for(let x=tx*block;x<Math.min(w,(tx+1)*block);x++) {
        const p=4*(y*w+x), r=data[p],g=data[p+1],b=data[p+2];
        const alpha=(data[p+3]/255)*pigmentOpacity(r,g,b,background,material);
        if(alpha<.24)continue;
        weight+=alpha; inkPixels++;
        xw+=alpha*(x+.5); yw+=alpha*(y+.5);
        rw+=alpha*r;gw+=alpha*g;bw+=alpha*b;
      }
    }
    if(inkPixels<2||weight<1.1)continue;
    tiles[ty*nx+tx]={
      tx,ty,x:(xw/weight/w-.5)*1.34,
      y:(.5-yw/weight/h)*1.88,
      color:[rw/weight,gw/weight,bw/weight],
      weight,inkPixels,coverage:inkPixels/(block*block)
    };
  }
  return {tiles,nx,ny};
}

function compatible(a,b) {
  if (!a||!b)return false;
  const d=(a.color[0]-b.color[0])**2+(a.color[1]-b.color[1])**2+
    (a.color[2]-b.color[2])**2;
  return d < 81**2;
}

/** Group neighbouring similarly coloured pigment tiles; split large groups
 * into local parts so one continuous dark stroke never swallows the painting.
 * All transformations are deterministic and invert no source coordinates. */
export function extractRuleMarks(imageData, settings={}) {
  const {tiles,nx,ny}=tileFeatures(imageData,settings);
  const seen=new Uint8Array(tiles.length), groups=[];
  for(let id=0;id<tiles.length;id++) {
    const start=tiles[id];
    if(!start||seen[id])continue;
    seen[id]=1;
    const queue=[id], group=[];
    for(let i=0;i<queue.length;i++) {
      const index=queue[i], current=tiles[index];group.push(current);
      const x=index%nx,y=Math.floor(index/nx);
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
        const xx=x+dx,yy=y+dy;
        if(xx<0||yy<0||xx>=nx||yy>=ny)continue;
        const next=yy*nx+xx;
        if(!seen[next]&&compatible(current,tiles[next])){
          seen[next]=1;queue.push(next);
        }
      }
    }
    groups.push(group);
  }
  const sections=[];
  for(const group of groups) {
    if(group.length<=4){sections.push(group);continue;}
    const total=group.length;
    const mx=group.reduce((s,t)=>s+t.x,0)/total;
    const my=group.reduce((s,t)=>s+t.y,0)/total;
    const xx=group.reduce((s,t)=>s+(t.x-mx)**2,0);
    const yy=group.reduce((s,t)=>s+(t.y-my)**2,0);
    const xy=group.reduce((s,t)=>s+(t.x-mx)*(t.y-my),0);
    const theta=.5*Math.atan2(2*xy,xx-yy);
    const vx=Math.cos(theta),vy=Math.sin(theta);
    const sorted=[...group].sort((a,b)=>
      ((a.x-mx)*vx+(a.y-my)*vy)-((b.x-mx)*vx+(b.y-my)*vy));
    const parts=Math.ceil(group.length/4),each=Math.ceil(group.length/parts);
    for(let i=0;i<sorted.length;i+=each) sections.push(sorted.slice(i,i+each));
  }
  const marks=[];
  for(const section of sections) {
    const weight=section.reduce((s,t)=>s+t.weight,0);
    if(!weight)continue;
    const x=section.reduce((s,t)=>s+t.x*t.weight,0)/weight;
    const y=section.reduce((s,t)=>s+t.y*t.weight,0)/weight;
    const mean=[0,1,2].map(c=>section.reduce((s,t)=>s+t.color[c]*t.weight,0)/weight);
    let covXX=.0025,covYY=.0025,covXY=0;
    for(const t of section) {
      const dx=t.x-x,dy=t.y-y;
      covXX+=t.weight/weight*dx*dx;
      covYY+=t.weight/weight*dy*dy;
      covXY+=t.weight/weight*dx*dy;
    }
    const discriminant=Math.sqrt(Math.max(0,(covXX-covYY)**2+4*covXY**2));
    const major=Math.sqrt(Math.max(.0025,(covXX+covYY+discriminant)/2));
    const minor=Math.sqrt(Math.max(.0025,(covXX+covYY-discriminant)/2));
    const angle=.5*Math.atan2(2*covXY,covXX-covYY);
    const coverage=section.reduce((s,t)=>s+t.coverage*t.weight,0)/weight;
    const ratio=major/Math.max(.04,minor);
    const kind=ratio>2.0?'stroke':coverage>.42&&section.length>=3?'field':'spot';
    marks.push({
      x,y,color:rgb(...mean),coverage,kind,angle,
      span:clamp(major*2.2+.09,.10,.52),
      breadth:clamp(minor*1.6+.060,.055,.29),
      mass:weight,tiles:section.length
    });
  }
  // Prioritise visually important pigment without rearranging its XY.
  marks.sort((a,b)=>b.mass-a.mass || a.y-b.y || a.x-b.x);
  const chosen=marks.slice(0,100);
  if(!chosen.length)throw new Error('No distinguishable pigment in source drawing');
  return chosen;
}

function ownedMesh(geometry,color,name,metalness=.1) {
  const mesh=new THREE.Mesh(geometry,makeMaterial(color,metalness));
  mesh.name=name;
  return mesh;
}

/** Curved, varying elliptical cross-section along a 3D centreline.
 * A closed solid with actual front, sides and back. Not a flat ribbon, XY
 * texture plane or extrusion of a traced 2D polygon. */
function sweptSolid(path, width, thickness, color, name) {
  const curve=new THREE.CatmullRomCurve3(path,false,'centripetal',.4);
  const segments=38, radial=9;
  const frames=curve.computeFrenetFrames(segments,false);
  const verts=[],idx=[];
  for(let i=0;i<=segments;i++) {
    const t=i/segments, centre=curve.getPoint(t);
    const n=frames.normals[i],b=frames.binormals[i];
    const taper=.045+.955*Math.pow(Math.sin(Math.PI*t),.50);
    for(let j=0;j<=radial;j++) {
      const a=j/radial*TAU;
      const pt=centre.clone().addScaledVector(n,Math.cos(a)*width*.5*taper)
        .addScaledVector(b,Math.sin(a)*thickness*.5*taper);
      verts.push(pt.x,pt.y,pt.z);
    }
  }
  const stride=radial+1;
  for(let i=0;i<segments;i++)for(let j=0;j<radial;j++) {
    const a=i*stride+j,b=a+stride;
    idx.push(a,b,a+1,a+1,b,b+1);
  }
  // End caps close the volume instead of leaving open extrusion ends.
  const first=verts.length/3;
  verts.push(...path[0]);
  const last=verts.length/3;
  verts.push(...path[path.length-1]);
  for(let j=0;j<radial;j++){
    idx.push(first,j,j+1);
    const a=segments*stride+j;idx.push(last,a+1,a);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
  geo.setIndex(idx);geo.computeVertexNormals();
  return ownedMesh(geo,color,name,.07);
}

function makeBulb(position,scale,color,name) {
  const mesh=ownedMesh(new THREE.IcosahedronGeometry(1,2),color,name,.08);
  mesh.scale.set(scale[0],scale[1],scale[2]);
  mesh.position.copy(position);
  return mesh;
}

function markPoints(mark,i,depth) {
  const p=mark;
  const a=i*GOLDEN_ANGLE;
  const axis=v3(Math.cos(p.angle),Math.sin(p.angle),0);
  const perp=v3(-Math.sin(p.angle),Math.cos(p.angle),0);
  const front=v3(p.x,p.y,.43*depth);
  const reach=Math.min(.25,p.span*.48);
  const before=front.clone().addScaledVector(axis,-reach);
  before.z=.31*depth;
  const after=front.clone().addScaledVector(axis,reach);
  after.z=.27*depth;
  const radial=v3(Math.cos(a),Math.sin(a),0);
  const bend=.13+Math.min(.12,p.span/PHI/3);
  const side=after.clone().addScaledVector(perp,Math.sin(a)*bend)
    .addScaledVector(radial,.12);
  side.z=-.08*depth;
  const rear=v3(p.x/PHI+radial.x*(.16+p.span/PHI/4),
    p.y/PHI+radial.y*(.16+p.breadth/PHI/3),(-.55-.08*(i%3))*depth);
  const tail=v3(p.x/PHI/PHI,p.y/PHI/PHI,-.79*depth);
  return {front,before,after,side,rear,tail,radial,axis,perp};
}

function petal(mark,i,depth,group) {
  const p=markPoints(mark,i,depth);
  const mid=p.front.clone().addScaledVector(p.perp,mark.breadth*.15);
  mid.z=.56*depth;
  const controls=[p.before,mid,p.after,p.side,p.rear,p.tail];
  const width=clamp(mark.breadth*.85+.045,.08,.24);
  const thickness=clamp(width/PHI,.06,.18);
  const mesh=sweptSolid(controls,width,thickness,mark.color,'φ-curved petal volume');
  mesh.userData.ruleKind='petal';
  group.add(mesh);
  return 1;
}

function ribbon(mark,i,depth,group) {
  const p=markPoints(mark,i,depth);
  const controls=[
    p.before,
    p.front.clone().addScaledVector(p.perp,mark.breadth*.23),
    p.after,
    p.side.clone().addScaledVector(p.radial,.07),
    p.rear,
    p.tail
  ];
  const width=clamp(mark.breadth*.45+.036,.055,.15);
  const mesh=sweptSolid(controls,width,clamp(width/PHI/PHI,.035,.10),mark.color,
    'Golden-angle stroke returning around the sculpture');
  mesh.userData.ruleKind='ribbon';
  group.add(mesh);
  return 1;
}

function pigment(mark,i,depth,group) {
  const p=markPoints(mark,i,depth);
  const rx=clamp(mark.span*.40+.035,.065,.21);
  const ry=clamp(mark.breadth*.56+.035,.065,.18);
  const rz=clamp((rx+ry)/PHI+.055,.12,.35)*depth;
  const front=p.front.clone();front.z=.24*depth;
  const head=makeBulb(front,[rx,ry,rz],mark.color,'Paint mass interpreted as full 3D volume');
  head.rotation.set(mark.angle/PHI,i*GOLDEN_ANGLE/PHI,mark.angle*.25);
  head.userData.ruleKind='pigment';
  group.add(head);
  const backColor=inkColour(mark.color).multiplyScalar(.83);
  const back=makeBulb(p.rear,[rx/PHI,ry/PHI,rz*1.23],backColor,
    'φ-scaled rear counter-mass');
  back.rotation.set(mark.angle,0,i*GOLDEN_ANGLE/PHI);
  back.userData.ruleKind='pigment';
  group.add(back);
  const bridge=sweptSolid([front,p.side,p.rear],
    clamp(rx*.34,.046,.10),clamp(ry*.34,.045,.095),mark.color,
    'Solid sculptural bridge from source mark to back');
  bridge.userData.ruleKind='pigment';
  group.add(bridge);
  return 3;
}

function addRearArmature(group,marks,depth) {
  const n=Math.min(70,Math.max(26,marks.length*2));
  const path=[];
  for(let i=0;i<=n;i++) {
    const u=i/n;
    const a=u*TAU*PHI;
    const radius=.19+.07*Math.sin(Math.PI*u);
    path.push(v3(Math.sin(a)*radius,(u-.5)*1.30,-(.45+.19*u)*depth+
      Math.cos(a)*.07));
  }
  const mesh=new THREE.Mesh(new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(path),n*2,.019,7,false),
    makeMaterial('#5f635c',.22));
  mesh.name='Golden spiral internal armature';
  mesh.userData.ruleKind='armature';
  group.add(mesh);
}

/** All four alternatives are actual objects in the round, not rendered
 * image planes. XY pigment anchors are taken directly from the painting;
 * golden-angle geometry only affects depth, side curvature and back.
 * Contrast between variants is geometric, not a different painting. */
export function buildRuleSculpture(method,marks,{depth=1}={}) {
  if(!METHODS.includes(method))throw new Error('Unsupported sculpture method');
  if(!Array.isArray(marks)||!marks.length)throw new Error('Sculpture needs real image-derived marks');
  const group=new THREE.Group();
  group.name='PROPORTION PIECE — RULES / '+method;
  const n=Math.min(marks.length,96);
  const counts={petal:0,ribbon:0,pigment:0};
  const anchorList=[];
  const modeMax={petal:80,ribbon:80,pigment:80,hybrid:85}[method];
  const count=Math.min(n,modeMax);
  for(let i=0;i<count;i++) {
    const mark=marks[i];
    const mode=method==='hybrid'?
      (mark.kind==='stroke'?'ribbon':mark.kind==='field'?'petal':'pigment')
      :method;
    counts[mode]+=({petal,ribbon,pigment}[mode])(mark,i,depth,group);
    anchorList.push({x:mark.x,y:mark.y,kind:mark.kind,color:mark.color});
  }
  addRearArmature(group,marks,depth);
  group.userData={
    engine:'rules-v1',method,depth,
    elementCounts:counts,sourceAnchors:anchorList,
    noImageExtrusion:true,noModelInference:true
  };
  return group;
}

export function disposeRuleSculpture(group) {
  if(!group)return;
  const geometries=new Set(),materials=new Set();
  group.traverse(x=>{
    if(x.geometry)geometries.add(x.geometry);
    if(x.material){
      for(const m of (Array.isArray(x.material)?x.material:[x.material]))
        if(m.userData?.[OWNED])materials.add(m);
    }
  });
  group.removeFromParent();
  group.clear();
  for(const geo of geometries)geo.dispose();
  for(const m of materials)m.dispose();
}
