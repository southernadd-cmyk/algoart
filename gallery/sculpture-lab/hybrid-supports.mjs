// PROPORTION PIECE / Sculpture Lab — four actual plinth attachments for ONE
// painted hybrid sculpture. Support hardware is not an image overlay and is
// deliberately separate from the original oil/tissue material on the artwork.
import * as THREE from 'three';

export const SUPPORT_VARIANTS=Object.freeze([
  {id:'pin',title:'Museum pin',description:'One slender straight bronze post'},
  {id:'stem',title:'Curved stem',description:'A φ-tapered bowed stem'},
  {id:'twin',title:'Twin braces',description:'Two anchored support points'},
  {id:'root',title:'Pigment root',description:'A branched sculptural root'}
]);
export const PLINTH_TOP_LOCAL_Y=.7825-1.60; // actual plinth top at world Y .7825

const PHI=(1+Math.sqrt(5))/2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const v=(x,y,z)=>new THREE.Vector3(x,y,z);

function paintedVertices(sculpture){
  sculpture.updateMatrixWorld(true);
  const points=[];
  const p=new THREE.Vector3();
  sculpture.traverse(node=>{
    if(!node.isMesh||!node.geometry?.attributes?.position)return;
    const attr=node.geometry.attributes.position;
    // Budget protects mobile for large non-indexed marching-tetra meshes.
    const stride=Math.max(1,Math.floor(attr.count/16000));
    for(let i=0;i<attr.count;i+=stride){
      p.fromBufferAttribute(attr,i).applyMatrix4(node.matrixWorld);
      if(Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z))
        points.push(p.clone());
    }
  });
  if(!points.length)throw Error('Cannot mount hybrid without sculpted pigment vertices');
  return points;
}
function nearest(items,target,weightedY=.45){
  let chosen=items[0],best=Infinity;
  for(const p of items){
    const d=(p.x-target.x)**2+(p.z-target.z)**2+
      weightedY*(p.y-target.y)**2;
    if(d<best){best=d;chosen=p;}
  }
  return chosen.clone();
}
/** Pick actual painted surface vertices, NOT a computed bounding-box point.
 * Low pigment clusters anchor into the stem; left/right supports attach to
 * spatially distinct real paint areas. */
export function chooseSupportAnchors(sculpture){
  const points=paintedVertices(sculpture);
  const sorted=[...points].sort((a,b)=>a.y-b.y);
  const bottom=sorted[0].y,top=sorted[sorted.length-1].y;
  const bandLimit=bottom+Math.max(.15,(top-bottom)*.20);
  const low=sorted.filter(p=>p.y<=bandLimit);
  const xs=[...low].sort((a,b)=>a.x-b.x);
  const mid=low[Math.floor(low.length*.50)];
  const preferred=v(0,bottom+Math.max(.075,(top-bottom)*.09),0);
  const central=nearest(low,preferred,.9);
  const leftSample=xs[Math.floor((xs.length-1)*.14)];
  const rightSample=xs[Math.floor((xs.length-1)*.86)];
  // Candidate endpoints remain exactly on the actual source-derived mesh.
  const left=nearest(low,v(leftSample.x,mid.y,leftSample.z),.40);
  const right=nearest(low,v(rightSample.x,mid.y,rightSample.z),.40);
  const pairSeparation=Math.hypot(left.x-right.x,left.z-right.z);
  const extended=sorted.filter(p=>p.y<=bottom+Math.max(.24,(top-bottom)*.38));
  let secondary=nearest(extended,v(central.x+.20,central.y+.17,central.z-.05),.3);
  if(secondary.distanceTo(central)<.11)
    secondary=nearest(extended,v(central.x-.22,central.y+.20,central.z+.13),.3);
  return {central,left,right,secondary,pairSeparation,
    sculptureBottom:bottom,sculptureTop:top};
}

function material(colour,roughness=.66,metalness=.35){
  const m=new THREE.MeshStandardMaterial({color:colour,roughness,metalness,
    side:THREE.DoubleSide});
  m.userData.ppSupportOwned=true;
  return m;
}
function tubeBetween(a,b,radius,mat){
  const start=a.clone(),end=b.clone();
  const d=end.clone().sub(start);
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius*.83,radius,d.length(),12,1),mat);
  mesh.position.copy(start).addScaledVector(d,.5);
  mesh.quaternion.setFromUnitVectors(v(0,1,0),d.normalize());
  mesh.name='Physical support from painted hybrid to plinth';
  return mesh;
}
function taperedCurve(points,baseRadius,tipRadius,mat,name){
  const curve=new THREE.CatmullRomCurve3(points,false,'centripetal');
  const segments=28,radial=9;
  const frames=curve.computeFrenetFrames(segments,false);
  const positions=[],indices=[];
  for(let i=0;i<=segments;i++){
    const t=i/segments;
    const p=curve.getPoint(t),n=frames.normals[i],b=frames.binormals[i];
    const phiT=Math.pow(t,1/PHI);
    const radius=baseRadius*(1-phiT)+tipRadius*phiT;
    for(let k=0;k<=radial;k++){
      const a=k/radial*Math.PI*2;
      const point=p.clone().addScaledVector(n,Math.cos(a)*radius)
        .addScaledVector(b,Math.sin(a)*radius);
      positions.push(point.x,point.y,point.z);
    }
  }
  const row=radial+1;
  for(let i=0;i<segments;i++)for(let k=0;k<radial;k++){
    const a=i*row+k,c=(i+1)*row+k;
    indices.push(a,c,a+1,a+1,c,c+1);
  }
  // Close the ends; this is a genuine solid support, not a decorative line.
  const first=positions.length/3;
  positions.push(...points[0].toArray());
  const last=positions.length/3;
  positions.push(...points[points.length-1].toArray());
  for(let k=0;k<radial;k++){
    indices.push(first,k+1,k);
    const a=segments*row+k;
    indices.push(last,a,a+1);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,mat);mesh.name=name;return mesh;
}
function foot(group,point,mat,r=.07){
  const g=new THREE.Mesh(new THREE.CylinderGeometry(r*.82,r,.025,20),mat);
  g.name='Support foot physically seated on the plinth';
  g.position.set(point.x,PLINTH_TOP_LOCAL_Y+.0125,point.z);
  group.add(g);
}
function blendPigment(pixels,anchor){
  if(!pixels?.data||!pixels.width||!pixels.height)return '#6a7168';
  const x=clamp(Math.round((anchor.x/1.34+.5)*(pixels.width-1)),0,pixels.width-1);
  const y=clamp(Math.round((.5-anchor.y/1.88)*(pixels.height-1)),0,pixels.height-1);
  const i=(y*pixels.width+x)*4;
  const color=new THREE.Color().setRGB(pixels.data[i]/255,
    pixels.data[i+1]/255,pixels.data[i+2]/255,THREE.SRGBColorSpace);
  // Muted local pigment reads as sculptural root, not another painted mark.
  color.lerp(new THREE.Color('#5c5b50'),.45);
  return color;
}
/** One identical hybrid mesh per plinth. Its geometry is never modified.
 * The support endpoints meet exact mesh vertices and the feet meet the
 * recorded plinth top. Every scaffold can be disposed on a painting switch. */
export function createHybridSupport(sculpture,variant,{pixels=null}={}){
  if(!SUPPORT_VARIANTS.some(v=>v.id===variant))
    throw Error('Unrecognised hybrid support '+variant);
  const anchors=chooseSupportAnchors(sculpture);
  const group=new THREE.Group();
  group.name='Hybrid support — '+variant;
  const brass=material('#665e4d',.54,.47);
  const patinated=material('#505a51',.72,.28);
  // Undo the display-only lift when finding the source painting pixel.
  const localPigmentPoint=anchors.central.clone();
  localPigmentPoint.y-=sculpture.position.y;
  const pigment=material(blendPigment(pixels,localPigmentPoint),.83,.10);
  const baseY=PLINTH_TOP_LOCAL_Y+.025;
  const points=[],feet=[];
  const addStem=(base,anchor,style,mat)=>{
    if(anchor.y<baseY+.09)
      throw Error('Hybrid sculpture intersects plinth: support would have no visible height');
    const endpoint=anchor.clone().add(v(0,.026,0)); // penetrate painted mesh
    const root=base.clone();root.y=baseY;
    if(style==='straight'){
      group.add(tubeBetween(root,endpoint,.018,mat));
    }else{
      const rise=anchor.y-baseY;
      const bow=style==='root'?.10:.075;
      const sign=style==='root'?-1:1;
      const q1=v(root.x+(anchor.x-root.x)*.20+sign*bow,baseY+rise/PHI/PHI,
        root.z+(anchor.z-root.z)*.24+.02);
      const q2=v(root.x+(anchor.x-root.x)*.70-sign*bow*.42,baseY+rise/PHI,
        root.z+(anchor.z-root.z)*.75-.025);
      group.add(taperedCurve([root,q1,q2,endpoint],
        style==='root'?.062:.038,style==='root'?.026:.020,mat,
        style==='root'?'Tapered coloured sculpture root':'Curved phi-tapered gallery support'));
    }
    points.push(anchor.toArray());feet.push([root.x,PLINTH_TOP_LOCAL_Y,root.z]);
  };
  if(variant==='pin'){
    const p=anchors.central;
    const base=v(p.x*.45,baseY,p.z*.40);
    addStem(base,p,'straight',brass);
    foot(group,base,brass,.055);
  }else if(variant==='stem'){
    const p=anchors.central;
    const base=v(p.x*.37+.04,baseY,p.z*.30-.025);
    addStem(base,p,'curve',brass);
    foot(group,base,brass,.074);
  }else if(variant==='twin'){
    let left=anchors.left,right=anchors.right;
    // Narrow paintings may have no horizontal pair. Use a separated Z/Y
    // anchor instead; never invent an endpoint away from actual geometry.
    if(anchors.pairSeparation<.12)right=anchors.secondary;
    const leftBase=v(-.19,baseY,.06),rightBase=v(.19,baseY,.06);
    addStem(leftBase,left,'straight',patinated);
    addStem(rightBase,right,'straight',patinated);
    foot(group,leftBase,patinated,.052);
    foot(group,rightBase,patinated,.052);
    const beam=tubeBetween(v(-.19,baseY+.055,.06),
      v(.19,baseY+.055,.06),.016,patinated);
    beam.name='Twin support stabilising crossbar';group.add(beam);
  }else{
    const p=anchors.central;
    const base=v(clamp(p.x*.35,-.18,.18),baseY,clamp(p.z*.20,-.17,.17));
    addStem(base,p,'root',pigment);
    foot(group,base,pigment,.09);
    const second=anchors.secondary;
    const branchBase=v(base.x+.018,baseY+.16,base.z);
    // Short organic branch shares the main root, ending in second real mark.
    if(second.distanceTo(p)>.09&&second.y>branchBase.y+.055){
      group.add(taperedCurve([branchBase,
        v((branchBase.x+second.x)*.5,branchBase.y+
          (second.y-branchBase.y)*.50,branchBase.z+.045),
        second.clone().add(v(0,.02,0))],.027,.012,pigment,
      'Secondary supporting root merged visually into painted mass'));
      points.push(second.toArray());
    }
  }
  group.userData={
    ppSupport:true,variant,
    anchorPoints:points,plinthPoints:feet,
    plinthTopY:PLINTH_TOP_LOCAL_Y,
    attachedToActualMesh:true,
    anchorCount:points.length,
    supportMeshes:group.children.filter(c=>c.isMesh).length,
    anchorSpacing:anchors.pairSeparation
  };
  return group;
}
export function disposeHybridSupport(group){
  if(!group)return;
  const geometries=new Set(),mats=new Set();
  group.traverse(o=>{
    if(o.geometry)geometries.add(o.geometry);
    for(const m of Array.isArray(o.material)?o.material:(o.material?[o.material]:[]))
      if(m.userData?.ppSupportOwned)mats.add(m);
  });
  group.removeFromParent();
  group.clear();
  geometries.forEach(g=>g.dispose());
  mats.forEach(m=>m.dispose());
}
